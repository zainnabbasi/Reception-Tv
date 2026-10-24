import { Employee } from '../types';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { splitNewJoiners, getDefaultLayoutForCount } from './canvas';

export type ExportFormat = 'mp4' | 'webm' | 'gif';
export type AnimationMode = 'slides' | 'carousel';
export type GifResolution = 'standard' | 'hd' | 'hd720' | 'fullhd';
export type GifPace = 'brisk' | 'balanced' | 'relaxed';
export type GifLayout = 'split' | 'hero';

export interface GifExportOptions {
  format?: ExportFormat;
  animationMode?: AnimationMode;
  resolution?: GifResolution;
  pace?: GifPace;
  layout?: GifLayout;
  fps?: number;
  loop?: boolean;
  customGapX?: number;
  balanceRows?: boolean;
  pageOffset?: number;
  totalSlidesCount?: number;
}

export interface GifProgressState {
  currentFrame: number;
  totalFrames: number;
  percentage: number;
  phase: 'loading' | 'rendering' | 'encoding' | 'done';
}

interface ResolutionConfig {
  width: number;
  height: number;
  scale: number;
}

export function getResolutionConfig(res: GifResolution = 'hd'): ResolutionConfig {
  switch (res) {
    case 'standard':
      return { width: 720, height: 405, scale: 720 / 1920 };
    case 'hd720':
      return { width: 1280, height: 720, scale: 1280 / 1920 };
    case 'fullhd':
      return { width: 1920, height: 1080, scale: 1.0 };
    case 'hd':
    default:
      return { width: 960, height: 540, scale: 960 / 1920 };
  }
}

export function getPaceConfig(pace: GifPace = 'balanced') {
  switch (pace) {
    case 'brisk':
      // ~1.6s total per joiner @ 12 fps
      return { holdFrames: 12, transFrames: 7, fps: 12 };
    case 'relaxed':
      // ~3.0s total per joiner @ 12 fps
      return { holdFrames: 26, transFrames: 10, fps: 12 };
    case 'balanced':
    default:
      // ~2.2s total per joiner @ 12 fps
      return { holdFrames: 18, transFrames: 8, fps: 12 };
  }
}

export function getSlidePaceConfig(pace: GifPace = 'balanced', fps: number = 24) {
  // Entrance transition is ~0.5s, exit transition is ~0.42s
  const inFrames = Math.max(4, Math.round(0.5 * fps));
  const outFrames = Math.max(4, Math.round(0.42 * fps));

  let holdSec = 3.2; // default balanced hold ~3.2s
  if (pace === 'brisk') holdSec = 2.2;
  if (pace === 'relaxed') holdSec = 4.5;

  const holdFrames = Math.max(8, Math.round(holdSec * fps));

  return {
    inFrames,
    holdFrames,
    outFrames,
    fps,
    totalFramesPerSlide: inFrames + holdFrames + outFrames,
    holdSec,
  };
}

// Cubic easing functions for smooth corporate motion graphics
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => Math.pow(t, 3);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
export const easeInQuad = (t: number) => t * t;

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

export const preloadJoinerImages = async (
  joiners: Employee[]
): Promise<Map<string, HTMLImageElement>> => {
  const imageMap = new Map<string, HTMLImageElement>();

  await Promise.all(
    joiners.map(async (emp) => {
      if (!emp.imageUrl) return;
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = emp.imageUrl!;
        });
        imageMap.set(emp.id, img);
      } catch {
        // Fallback handled in rendering
      }
    })
  );

  return imageMap;
};

interface ShotItemMotion {
  photoX: number;
  photoY: number;
  photoOpacity: number;
  photoScale: number;
  nameX: number;
  nameY: number;
  nameOpacity: number;
  nameScale: number;
}

/**
 * Calculates carousel positions and staggers for a joiner item.
 * type: 'enter' (sliding in from right), 'hold' (resting), 'exit' (sliding out to left)
 */
function calculateCarouselMotion(
  state: 'enter' | 'hold' | 'exit',
  p: number, // 0 to 1 progress within this state
  basePhotoX: number,
  basePhotoY: number,
  baseNameX: number,
  baseNameY: number,
  slideDist: number
): ShotItemMotion {
  if (state === 'hold') {
    return {
      photoX: basePhotoX,
      photoY: basePhotoY,
      photoOpacity: 1,
      photoScale: 1,
      nameX: baseNameX,
      nameY: baseNameY,
      nameOpacity: 1,
      nameScale: 1,
    };
  }

  if (state === 'enter') {
    // Photo enters first
    const pPhoto = Math.min(1, p / 0.85);
    const easePhoto = easeOutCubic(pPhoto);
    const photoX = basePhotoX + slideDist * (1 - easePhoto);
    const photoOpacity = Math.min(1, pPhoto * 1.4);
    const photoScale = 0.94 + 0.06 * easePhoto;

    // Name card enters with carousel stagger (starts at p=0.15)
    const pName = Math.max(0, Math.min(1, (p - 0.14) / 0.86));
    const easeName = easeOutCubic(pName);
    const nameX = baseNameX + (slideDist + 180) * (1 - easeName);
    const nameOpacity = Math.min(1, pName * 1.4);
    const nameScale = 0.94 + 0.06 * easeName;

    return {
      photoX,
      photoY: basePhotoY,
      photoOpacity,
      photoScale,
      nameX,
      nameY: baseNameY,
      nameOpacity,
      nameScale,
    };
  }

  // State === 'exit': slides out to the left
  // Photo starts sliding out first
  const pPhoto = Math.min(1, p / 0.85);
  const easePhoto = easeInCubic(pPhoto);
  const photoX = basePhotoX - slideDist * easePhoto;
  const photoOpacity = Math.max(0, 1 - pPhoto * 1.3);
  const photoScale = 1 - 0.04 * easePhoto;

  // Name card follows with slight carousel delay (starts at p=0.12)
  const pName = Math.max(0, Math.min(1, (p - 0.12) / 0.88));
  const easeName = easeInCubic(pName);
  const nameX = baseNameX - (slideDist + 180) * easeName;
  const nameOpacity = Math.max(0, 1 - pName * 1.3);
  const nameScale = 1 - 0.04 * easeName;

  return {
    photoX,
    photoY: basePhotoY,
    photoOpacity,
    photoScale,
    nameX,
    nameY: baseNameY,
    nameOpacity,
    nameScale,
  };
}

/**
 * Draws the photo card for an employee.
 */
function drawEmployeePhotoCard(
  ctx: CanvasRenderingContext2D,
  emp: Employee,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  opacity: number,
  scale: number
) {
  if (opacity <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Apply scale relative to card center
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  const brandDark = '#12284b';
  const brandGreen = '#1eb259';
  const white = '#FFFFFF';

  // 1. Accent Block shadow & offset (Ratnaafin creative motif)
  const offset = Math.round(w * 0.035);
  ctx.save();
  ctx.shadowColor = 'rgba(18, 40, 75, 0.14)';
  ctx.shadowBlur = Math.round(w * 0.08);
  ctx.shadowOffsetY = Math.round(w * 0.04);
  drawRoundedRect(ctx, x + offset, y + offset, w, h, radius);
  ctx.fillStyle = brandGreen;
  ctx.fill();
  ctx.restore();

  // 2. Accent Block base
  drawRoundedRect(ctx, x + offset, y + offset, w, h, radius);
  ctx.fillStyle = brandGreen;
  ctx.fill();

  // 3. Main Photo Frame Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(18, 40, 75, 0.22)';
  ctx.shadowBlur = Math.round(w * 0.09);
  ctx.shadowOffsetY = Math.round(w * 0.04);
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = white;
  ctx.fill();
  ctx.restore();

  // 4. White Frame Base
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = white;
  ctx.fill();

  // 5. Clipped Photo
  const border = Math.round(w * 0.024);
  const innerX = x + border;
  const innerY = y + border;
  const innerW = w - border * 2;
  const innerH = h - border * 2;
  const innerRadius = Math.max(4, radius - border);

  ctx.save();
  drawRoundedRect(ctx, innerX, innerY, innerW, innerH, innerRadius);
  ctx.clip();

  if (image) {
    const imgAspect = image.width / image.height;
    const boxAspect = innerW / innerH;
    let sWidth: number;
    let sHeight: number;
    let sx: number;
    let sy: number;

    if (imgAspect > boxAspect) {
      sHeight = image.height;
      sWidth = image.height * boxAspect;
      sx = (image.width - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = image.width;
      sHeight = image.width / boxAspect;
      sx = 0;
      sy = 0;
    }
    ctx.drawImage(image, sx, sy, sWidth, sHeight, innerX, innerY, innerW, innerH);
  } else {
    // Silhouette Monogram Fallback
    const grad = ctx.createLinearGradient(innerX, innerY, innerX + innerW, innerY + innerH);
    grad.addColorStop(0, brandDark);
    grad.addColorStop(1, '#046eb6');
    ctx.fillStyle = grad;
    ctx.fillRect(innerX, innerY, innerW, innerH);

    const initials = (emp.name || 'NJ')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');

    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.font = `800 ${Math.round(innerW * 0.28)}px Montserrat`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials || 'NJ', innerX + innerW / 2, innerY + innerH * 0.38);
  }

  // Subtle gradient shade at bottom of photo
  const photoGrad = ctx.createLinearGradient(innerX, innerY + innerH * 0.7, innerX, innerY + innerH);
  photoGrad.addColorStop(0, 'rgba(18, 40, 75, 0)');
  photoGrad.addColorStop(1, 'rgba(18, 40, 75, 0.55)');
  ctx.fillStyle = photoGrad;
  ctx.fillRect(innerX, innerY, innerW, innerH);

  ctx.restore();

  // 6. Corner Badge: "★ NEW JOINER"
  const badgeW = Math.round(w * 0.42);
  const badgeH = Math.round(h * 0.068);
  const badgeX = x + w - badgeW - Math.round(w * 0.04);
  const badgeY = y + h - badgeH - Math.round(w * 0.04);
  const badgeR = badgeH / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 10;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeR);
  ctx.fillStyle = brandDark;
  ctx.fill();
  ctx.strokeStyle = brandGreen;
  ctx.lineWidth = Math.max(1.5, Math.round(w * 0.005));
  ctx.stroke();

  ctx.fillStyle = brandGreen;
  ctx.font = `800 ${Math.round(badgeH * 0.46)}px Montserrat`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★ NEW JOINER', badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);
  ctx.restore();

  ctx.restore();
}

/**
 * Draws the Name Card / Information panel for an employee.
 */
function drawEmployeeNameCard(
  ctx: CanvasRenderingContext2D,
  emp: Employee,
  index: number,
  total: number,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  opacity: number,
  scale: number
) {
  if (opacity <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Apply scale relative to card center
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  const brandDark = '#12284b';
  const brandGreen = '#1eb259';
  const brandBlue = '#046eb6';
  const white = '#FFFFFF';

  // Card Outer Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(18, 40, 75, 0.16)';
  ctx.shadowBlur = Math.round(w * 0.05);
  ctx.shadowOffsetY = Math.round(w * 0.02);
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = white;
  ctx.fill();
  ctx.restore();

  // Card Body Clipped for inner styling
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.clip();

  // Base background: clean crisp white with subtle top-to-bottom tint
  const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
  bgGrad.addColorStop(0, '#FFFFFF');
  bgGrad.addColorStop(1, '#f8fafc');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);

  // Left vertical brand accent bar
  const accentBarW = Math.round(w * 0.016);
  const barGrad = ctx.createLinearGradient(x, y, x, y + h);
  barGrad.addColorStop(0, brandBlue);
  barGrad.addColorStop(0.5, brandGreen);
  barGrad.addColorStop(1, brandDark);
  ctx.fillStyle = barGrad;
  ctx.fillRect(x, y, accentBarW, h);

  // Fine top accent line
  const topBarH = Math.round(h * 0.012);
  ctx.fillStyle = brandGreen;
  ctx.fillRect(x, y, w, topBarH);

  // Typography layout
  const padLeft = Math.round(w * 0.08);
  const padRight = Math.round(w * 0.08);
  const maxTextW = w - padLeft - padRight;
  const startX = x + padLeft;

  let currentY = y + Math.round(h * 0.14);

  // 1. Tag line: "WELCOME TO THE TEAM"
  ctx.save();
  const tagSize = Math.round(h * 0.046);
  ctx.font = `700 ${tagSize}px Montserrat`;
  ctx.fillStyle = brandGreen;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  if ('letterSpacing' in ctx) {
    (ctx as any).letterSpacing = '3px';
  }
  ctx.fillText('WELCOME TO THE TEAM', startX, currentY);
  ctx.restore();

  currentY += tagSize + Math.round(h * 0.04);

  // 2. Employee Name (Bold commanding headline)
  ctx.save();
  let nameSize = Math.round(h * 0.125);
  ctx.font = `900 ${nameSize}px Montserrat`;
  ctx.fillStyle = brandDark;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const nameText = (emp.name || 'New Joiner').toUpperCase();

  // Dynamic shrink to fit width
  while (ctx.measureText(nameText).width > maxTextW && nameSize > Math.round(h * 0.07)) {
    nameSize -= 2;
    ctx.font = `900 ${nameSize}px Montserrat`;
  }
  ctx.fillText(nameText, startX, currentY);
  ctx.restore();

  currentY += nameSize + Math.round(h * 0.035);

  // 3. Horizontal subtle divider
  ctx.save();
  ctx.strokeStyle = 'rgba(18, 40, 75, 0.1)';
  ctx.lineWidth = Math.max(1, Math.round(h * 0.004));
  ctx.beginPath();
  ctx.moveTo(startX, currentY);
  ctx.lineTo(startX + Math.min(maxTextW, Math.round(w * 0.75)), currentY);
  ctx.stroke();
  ctx.restore();

  currentY += Math.round(h * 0.045);

  // 4. Designation (Role / Title)
  ctx.save();
  let desigSize = Math.round(h * 0.065);
  ctx.font = `600 ${desigSize}px Montserrat`;
  ctx.fillStyle = '#334155';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const desigText = emp.designation || 'Team Member';
  while (ctx.measureText(desigText).width > maxTextW && desigSize > Math.round(h * 0.045)) {
    desigSize -= 1;
    ctx.font = `600 ${desigSize}px Montserrat`;
  }
  ctx.fillText(desigText, startX, currentY);
  ctx.restore();

  currentY += desigSize + Math.round(h * 0.045);

  // 5. Location & Badge Row
  const locSize = Math.round(h * 0.052);
  const locText = (emp.location || 'RATNAAFIN').toUpperCase();

  ctx.save();
  ctx.font = `700 ${locSize}px Montserrat`;
  const locWidth = ctx.measureText(locText).width;
  const pillPadX = Math.round(w * 0.028);
  const pillPadY = Math.round(h * 0.024);
  const pillW = locWidth + pillPadX * 2 + Math.round(locSize * 1.2);
  const pillH = locSize + pillPadY * 2;
  const pillR = Math.round(pillH * 0.35);

  // Soft emerald pill
  drawRoundedRect(ctx, startX, currentY, pillW, pillH, pillR);
  ctx.fillStyle = 'rgba(30, 178, 89, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 178, 89, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Pin icon circle
  const pinCx = startX + pillPadX + locSize * 0.45;
  const pinCy = currentY + pillH / 2;
  ctx.beginPath();
  ctx.arc(pinCx, pinCy, locSize * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = brandGreen;
  ctx.fill();

  // Location text
  ctx.fillStyle = '#0f766e';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(locText, startX + pillPadX + Math.round(locSize * 1.1), currentY + pillH / 2);
  ctx.restore();

  // 6. Corporate Greeting / Quote at bottom
  const quoteY = y + h - Math.round(h * 0.12);
  ctx.save();
  const quoteSize = Math.round(h * 0.042);
  ctx.font = `500 italic ${quoteSize}px Montserrat`;
  ctx.fillStyle = '#64748b';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  const quoteText =
    emp.sentence ||
    'Wishing you a rewarding, impactful, and inspiring journey with our team!';
  
  // Truncate if overflows
  let displayQuote = quoteText;
  if (ctx.measureText(displayQuote).width > maxTextW) {
    while (ctx.measureText(displayQuote + '...').width > maxTextW && displayQuote.length > 20) {
      displayQuote = displayQuote.slice(0, -1).trim();
    }
    displayQuote += '...';
  }
  ctx.fillText(displayQuote, startX, quoteY);
  ctx.restore();

  ctx.restore(); // end clip

  // 7. Subtle Border around card
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.strokeStyle = 'rgba(18, 40, 75, 0.08)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

/**
 * Draws the Top Header Strip with corporate branding and animated carousel indicator.
 */
function drawHeader(
  ctx: CanvasRenderingContext2D,
  width: number,
  headerHeight: number,
  scale: number,
  activeJoinerIndex: number,
  totalJoiners: number,
  shotProgress: number // 0 to 1 progress of current shot
) {
  const brandDark = '#12284b';
  const brandGreen = '#1eb259';
  const white = '#FFFFFF';

  // 1. Header Drop Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(18, 40, 75, 0.25)';
  ctx.shadowBlur = Math.round(24 * scale);
  ctx.shadowOffsetY = Math.round(8 * scale);
  ctx.fillStyle = brandDark;
  ctx.fillRect(0, 0, width, headerHeight);
  ctx.restore();

  // Solid header bar
  ctx.fillStyle = brandDark;
  ctx.fillRect(0, 0, width, headerHeight);

  // Left Content
  const padLeft = Math.round(80 * scale);
  const padRight = Math.round(80 * scale);
  const startY = Math.round(headerHeight * 0.22);

  // Pre-title: "WEEKLY UPDATES"
  ctx.save();
  ctx.fillStyle = brandGreen;
  ctx.font = `600 ${Math.round(24 * scale)}px Montserrat`;
  if ('letterSpacing' in ctx) {
    (ctx as any).letterSpacing = `${3 * scale}px`;
  }
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText('WEEKLY UPDATES', padLeft, startY);
  ctx.restore();

  // Main Title: "Welcome New Joiners"
  const titleY = startY + Math.round(32 * scale);
  ctx.save();
  ctx.font = `900 ${Math.round(54 * scale)}px Montserrat`;
  if ('letterSpacing' in ctx) {
    (ctx as any).letterSpacing = `${-1 * scale}px`;
  }
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = white;
  ctx.fillText('Welcome ', padLeft, titleY);
  const welcomeW = ctx.measureText('Welcome ').width;
  ctx.fillStyle = brandGreen;
  ctx.fillText('New Joiners', padLeft + welcomeW, titleY);
  ctx.restore();

  // Right Content: Counter badge & animated carousel dots
  const badgeText = `JOINER ${activeJoinerIndex + 1} OF ${totalJoiners}`;
  ctx.save();
  const badgeFont = `700 ${Math.round(22 * scale)}px Montserrat`;
  ctx.font = badgeFont;
  const badgeTextW = ctx.measureText(badgeText).width;
  const badgePadX = Math.round(24 * scale);
  const badgePadY = Math.round(10 * scale);
  const badgeW = badgeTextW + badgePadX * 2;
  const badgeH = Math.round(22 * scale) + badgePadY * 2;
  const badgeX = width - padRight - badgeW;
  const badgeY = Math.round((headerHeight - badgeH) / 2);

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fillStyle = 'rgba(30, 178, 89, 0.15)';
  ctx.fill();
  ctx.strokeStyle = brandGreen;
  ctx.lineWidth = Math.max(1.5, Math.round(2 * scale));
  ctx.stroke();

  ctx.fillStyle = brandGreen;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);
  ctx.restore();

  // Animated Shot Progress Bar at bottom of header strip
  const barH = Math.max(2, Math.round(4 * scale));
  const barY = headerHeight - barH;

  // Background track
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(0, barY, width, barH);

  // Active progress fill
  const progressW = Math.round(width * Math.max(0, Math.min(1, shotProgress)));
  const barGrad = ctx.createLinearGradient(0, barY, progressW, barY);
  barGrad.addColorStop(0, '#046eb6');
  barGrad.addColorStop(1, brandGreen);
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, barY, progressW, barH);
}

/**
 * Main function to render a single animation frame onto a canvas.
 * Can be used for both live UI preview and GIF encoding.
 */
export function renderJoinerFrame(
  canvas: HTMLCanvasElement,
  joiners: Employee[],
  images: Map<string, HTMLImageElement>,
  frameIndex: number,
  paceConfig = getPaceConfig('balanced'),
  layout: GifLayout = 'split'
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || joiners.length === 0) return;

  const width = canvas.width;
  const height = canvas.height;
  const scale = width / 1920;

  const { holdFrames, transFrames } = paceConfig;
  const totalFramesPerJoiner = holdFrames + transFrames;
  const N = joiners.length;
  const totalFrames = N * totalFramesPerJoiner;

  const normalizedFrame = ((frameIndex % totalFrames) + totalFrames) % totalFrames;
  const currentJoinerIdx = Math.floor(normalizedFrame / totalFramesPerJoiner);
  const frameInShot = normalizedFrame % totalFramesPerJoiner;

  // 1. Draw Canvas Backdrop
  const brandLightBg = '#e2eff8';
  ctx.fillStyle = brandLightBg;
  ctx.fillRect(0, 0, width, height);

  // Soft ambient radial orbs for depth
  const addOrb = (cx: number, cy: number, r: number, color: string) => {
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(226, 239, 248, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  addOrb(width * 0.85, height * 0.35, width * 0.45, 'rgba(4, 110, 182, 0.09)');
  addOrb(width * 0.15, height * 0.85, width * 0.4, 'rgba(30, 178, 89, 0.08)');

  // 2. Dimensions for cards in 1920x1080 virtual coordinate space
  const headerHeight = Math.round(145 * scale);
  const slideDist = Math.round(1200 * scale);

  let photoW: number;
  let photoH: number;
  let photoRadius: number;
  let photoBaseX: number;
  let photoBaseY: number;

  let nameW: number;
  let nameH: number;
  let nameRadius: number;
  let nameBaseX: number;
  let nameBaseY: number;

  if (layout === 'hero') {
    // Broadcast Hero: Large centered photo with layered lower-third information dock
    photoW = Math.round(620 * scale);
    photoH = Math.round(740 * scale);
    photoRadius = Math.round(32 * scale);
    photoBaseX = Math.round((width - photoW) / 2);
    photoBaseY = headerHeight + Math.round(40 * scale);

    nameW = Math.round(920 * scale);
    nameH = Math.round(360 * scale);
    nameRadius = Math.round(28 * scale);
    nameBaseX = Math.round((width - nameW) / 2);
    nameBaseY = height - nameH - Math.round(50 * scale);
  } else {
    // Executive Split: Featured Portrait on Left, Info Card on Right
    photoW = Math.round(540 * scale);
    photoH = Math.round(720 * scale);
    photoRadius = Math.round(32 * scale);
    photoBaseX = Math.round(150 * scale);
    photoBaseY = headerHeight + Math.round((height - headerHeight - photoH) / 2);

    nameW = Math.round(980 * scale);
    nameH = Math.round(560 * scale);
    nameRadius = Math.round(30 * scale);
    nameBaseX = photoBaseX + photoW + Math.round(80 * scale);
    nameBaseY = headerHeight + Math.round((height - headerHeight - nameH) / 2);
  }

  // 3. Carousel Motion State
  const isHolding = frameInShot < holdFrames;
  const activeJoiner = joiners[currentJoinerIdx];
  const activeImg = images.get(activeJoiner.id);

  if (isHolding) {
    // In Hold phase: display stationary active joiner
    const shotProgress = frameInShot / totalFramesPerJoiner;

    // Draw photo & name card at resting positions
    drawEmployeePhotoCard(
      ctx,
      activeJoiner,
      activeImg,
      photoBaseX,
      photoBaseY,
      photoW,
      photoH,
      photoRadius,
      1,
      1
    );

    drawEmployeeNameCard(
      ctx,
      activeJoiner,
      currentJoinerIdx,
      N,
      nameBaseX,
      nameBaseY,
      nameW,
      nameH,
      nameRadius,
      1,
      1
    );

    // Draw header on top
    drawHeader(ctx, width, headerHeight, scale, currentJoinerIdx, N, shotProgress);
  } else {
    // In Transition phase: outgoing joiner exits left, incoming joiner enters right
    const transProgress = (frameInShot - holdFrames + 1) / transFrames;
    const shotProgress = frameInShot / totalFramesPerJoiner;

    const nextJoinerIdx = (currentJoinerIdx + 1) % N;
    const nextJoiner = joiners[nextJoinerIdx];
    const nextImg = images.get(nextJoiner.id);

    // Outgoing motion (sliding out to left with carousel stagger)
    const outMotion = calculateCarouselMotion(
      'exit',
      transProgress,
      photoBaseX,
      photoBaseY,
      nameBaseX,
      nameBaseY,
      slideDist
    );

    // Incoming motion (sliding in from right with carousel stagger)
    const inMotion = calculateCarouselMotion(
      'enter',
      transProgress,
      photoBaseX,
      photoBaseY,
      nameBaseX,
      nameBaseY,
      slideDist
    );

    // Draw outgoing joiner elements
    drawEmployeePhotoCard(
      ctx,
      activeJoiner,
      activeImg,
      outMotion.photoX,
      outMotion.photoY,
      photoW,
      photoH,
      photoRadius,
      outMotion.photoOpacity,
      outMotion.photoScale
    );

    drawEmployeeNameCard(
      ctx,
      activeJoiner,
      currentJoinerIdx,
      N,
      outMotion.nameX,
      outMotion.nameY,
      nameW,
      nameH,
      nameRadius,
      outMotion.nameOpacity,
      outMotion.nameScale
    );

    // Draw incoming joiner elements
    drawEmployeePhotoCard(
      ctx,
      nextJoiner,
      nextImg,
      inMotion.photoX,
      inMotion.photoY,
      photoW,
      photoH,
      photoRadius,
      inMotion.photoOpacity,
      inMotion.photoScale
    );

    drawEmployeeNameCard(
      ctx,
      nextJoiner,
      nextJoinerIdx,
      N,
      inMotion.nameX,
      inMotion.nameY,
      nameW,
      nameH,
      nameRadius,
      inMotion.nameOpacity,
      inMotion.nameScale
    );

    // Header counter shifts smoothly at mid-transition
    const displayIdx = transProgress >= 0.5 ? nextJoinerIdx : currentJoinerIdx;
    drawHeader(ctx, width, headerHeight, scale, displayIdx, N, shotProgress);
  }
}

const drawSlideRoundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const renderSlideAvatarSilhouette = (
  ctx: CanvasRenderingContext2D,
  emp: Employee,
  x: number,
  y: number,
  w: number,
  h: number
) => {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#12284b');
  grad.addColorStop(1, '#046eb6');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  const initials = (emp.name || 'New Joiner')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = `800 ${Math.round(w * 0.25)}px Montserrat`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials || 'NJ', x + w / 2, y + h * 0.35);
  ctx.restore();
};

/**
 * Renders a full multi-card static creative slide in motion.
 * - Entrance: all cards slide in together from right (+3840 -> 0) with smooth cubic deceleration.
 * - Hold: all cards rest in place for clear readability.
 * - Exit: all cards slide out together to left (0 -> -3840) with smooth cubic acceleration.
 * - Header strip remains anchored at top with dynamic "PART X OF Y" badge.
 */
export function renderStaticSlideFrame(
  canvas: HTMLCanvasElement,
  slides: Employee[][],
  images: Map<string, HTMLImageElement>,
  frameIndex: number,
  timing: { inFrames: number; holdFrames: number; outFrames: number; fps: number },
  options?: {
    customGapX?: number;
    balanceRows?: boolean;
    pageOffset?: number;
    totalSlidesCount?: number;
  }
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  // Baseline 4K design resolution: 3840 x 2160 (16:9)
  const baseW = 3840;
  const baseH = 2160;
  const scale = width / baseW;

  ctx.save();
  ctx.scale(scale, scale);

  const brandDark = '#12284b';
  const brandGreen = '#1eb259';
  const brandLightBg = '#e2eff8';
  const white = '#FFFFFF';

  // --- 1. Background ---
  ctx.fillStyle = brandLightBg;
  ctx.fillRect(0, 0, baseW, baseH);

  if (slides.length === 0) {
    ctx.restore();
    return;
  }

  const { inFrames, holdFrames, outFrames } = timing;
  const framesPerSlide = inFrames + holdFrames + outFrames;
  const totalSlides = slides.length;
  const slideIdx = Math.floor(frameIndex / framesPerSlide) % totalSlides;
  const frameInSlide = frameIndex % framesPerSlide;
  const currentSlide = slides[slideIdx];

  const totalPages = options?.totalSlidesCount || totalSlides;
  const pageNumber = (options?.pageOffset || 0) + slideIdx + 1;

  // --- 2. Calculate Cards Horizontal Offset & Alpha ---
  let cardsOffsetX = 0;
  let cardsAlpha = 1.0;
  let badgeAlpha = 1.0;

  if (frameInSlide < inFrames) {
    // Sliding in from right (+3840 to 0)
    const p = frameInSlide / inFrames;
    const eased = easeOutCubic(p);
    cardsOffsetX = baseW * (1 - eased);
    cardsAlpha = Math.min(1, p * 2);
    badgeAlpha = Math.min(1, p * 2.5);
  } else if (frameInSlide >= inFrames + holdFrames) {
    // Sliding out together to left (0 to -3840)
    const p = (frameInSlide - inFrames - holdFrames) / outFrames;
    const eased = easeInCubic(p);
    cardsOffsetX = -baseW * eased;
    cardsAlpha = Math.max(0, 1 - p * 0.4);
    badgeAlpha = Math.max(0, 1 - p * 1.5);
  } else {
    // Resting in place
    cardsOffsetX = 0;
    cardsAlpha = 1.0;
    badgeAlpha = 1.0;
  }

  // --- 3. Render Cards Grid ---
  const headerHeight = Math.round(baseH * 0.19); // 410px
  const gridTop = headerHeight + Math.round(38.4 * 1.0);
  const gridBottom = baseH - Math.round(38.4 * 3.5);
  const gridHeight = gridBottom - gridTop;

  const K = currentSlide.length;
  if (K > 0) {
    const layout = getDefaultLayoutForCount(K);
    const primaryGapX = options?.customGapX !== undefined ? options.customGapX : layout.defaultGapX;
    const balanceRows = options?.balanceRows ?? true;

    const rows: Employee[][] = [];
    let sIdx = 0;
    for (const rCount of layout.rows) {
      if (sIdx < K) {
        rows.push(currentSlide.slice(sIdx, sIdx + rCount));
        sIdx += rCount;
      }
    }

    const cardH = layout.cardH;
    const cardW = layout.cardW;
    const gapY = layout.gapY;
    const totalRowsHeight = rows.length * cardH + (rows.length - 1) * gapY;
    const totalRowsY = gridTop + Math.max(0, Math.round((gridHeight - totalRowsHeight) / 2));
    const maxCols = Math.max(...rows.map((r) => r.length));

    ctx.save();
    ctx.translate(cardsOffsetX, 0);
    if (cardsAlpha < 1.0) {
      ctx.globalAlpha = cardsAlpha;
    }

    for (let rIndex = 0; rIndex < rows.length; rIndex++) {
      const rowItems = rows[rIndex];
      if (rowItems.length === 0) continue;

      let rowGapX = primaryGapX;
      if (balanceRows && rows.length > 1 && rowItems.length < maxCols && rowItems.length > 1) {
        const ratio = maxCols / rowItems.length;
        const targetGap = Math.round(primaryGapX * (1 + (ratio - 1) * 0.45));
        const maxAllowedGap = Math.floor((baseW - 320 - rowItems.length * cardW) / (rowItems.length - 1));
        rowGapX = Math.min(targetGap, maxAllowedGap);
      }

      const rowWidth = rowItems.length * cardW + (rowItems.length - 1) * rowGapX;
      const rowStartX = Math.round((baseW - rowWidth) / 2);
      const rowY = totalRowsY + rIndex * (cardH + gapY);

      for (let cIndex = 0; cIndex < rowItems.length; cIndex++) {
        const emp = rowItems[cIndex];
        const cardX = rowStartX + cIndex * (cardW + rowGapX);
        const cardY = rowY;
        const cardRadius = Math.round(cardW * 0.08);

        // A. Drop Shadow
        ctx.save();
        ctx.shadowColor = 'rgba(18, 40, 75, 0.18)';
        ctx.shadowBlur = Math.round(cardW * 0.2);
        ctx.shadowOffsetY = Math.round(cardW * 0.1);
        drawSlideRoundedRectPath(ctx, cardX, cardY, cardW, cardH, cardRadius);
        ctx.fillStyle = white;
        ctx.fill();
        ctx.restore();

        // B. Card Body Clipping
        ctx.save();
        drawSlideRoundedRectPath(ctx, cardX, cardY, cardW, cardH, cardRadius);
        ctx.clip();

        ctx.fillStyle = white;
        ctx.fillRect(cardX, cardY, cardW, cardH);

        // C. Photo
        const photoImg = images.get(emp.id);
        if (photoImg) {
          const imgAspect = photoImg.width / photoImg.height;
          const cardAspect = cardW / cardH;
          let sWidth: number;
          let sHeight: number;
          let sx: number;
          let sy: number;

          if (imgAspect > cardAspect) {
            sHeight = photoImg.height;
            sWidth = photoImg.height * cardAspect;
            sx = (photoImg.width - sWidth) / 2;
            sy = 0;
          } else {
            sWidth = photoImg.width;
            sHeight = photoImg.width / cardAspect;
            sx = 0;
            sy = 0;
          }
          ctx.drawImage(photoImg, sx, sy, sWidth, sHeight, cardX, cardY, cardW, cardH);
        } else {
          renderSlideAvatarSilhouette(ctx, emp, cardX, cardY, cardW, cardH);
        }

        // D. Dark Navy Gradient Overlay
        const grad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
        grad.addColorStop(0, 'rgba(18, 40, 75, 0)');
        grad.addColorStop(0.45, 'rgba(18, 40, 75, 0)');
        grad.addColorStop(0.65, 'rgba(18, 40, 75, 0.72)');
        grad.addColorStop(0.85, brandDark);
        grad.addColorStop(1.0, brandDark);
        ctx.fillStyle = grad;
        ctx.fillRect(cardX, cardY, cardW, cardH);

        // E. Card Typography
        const cardScale = cardW / 575;
        const padBottom = Math.round(42 * cardScale);
        const padX = Math.round(24 * cardScale);
        const maxTextW = cardW - padX * 2;
        const centerX = cardX + cardW / 2;

        ctx.textAlign = 'center';

        // Location
        const locSize = Math.max(18, Math.round(30 * cardScale));
        ctx.save();
        ctx.font = `700 ${locSize}px Montserrat`;
        if ('letterSpacing' in ctx) {
          (ctx as any).letterSpacing = `${1.5 * cardScale}px`;
        }
        ctx.fillStyle = brandGreen;
        ctx.textBaseline = 'bottom';
        const locText = (emp.location || 'RATNAAFIN').toUpperCase();
        const locY = cardY + cardH - padBottom;
        ctx.fillText(locText, centerX, locY);
        ctx.restore();

        // Designation
        let desigSize = Math.max(16, Math.round(27 * cardScale));
        ctx.font = `500 ${desigSize}px Montserrat`;
        ctx.fillStyle = white;
        ctx.textBaseline = 'bottom';
        const desigText = emp.designation || 'Team Member';
        while (ctx.measureText(desigText).width > maxTextW && desigSize > 14) {
          desigSize -= 1;
          ctx.font = `500 ${desigSize}px Montserrat`;
        }
        const gapLocDesig = Math.round(12 * cardScale);
        const desigY = locY - locSize - gapLocDesig;
        ctx.fillText(desigText, centerX, desigY);

        // Name
        let nameSize = Math.max(20, Math.round(46 * cardScale));
        ctx.font = `800 ${nameSize}px Montserrat`;
        ctx.fillStyle = white;
        ctx.textBaseline = 'bottom';
        const nameText = (emp.name || 'New Joiner').toUpperCase();
        while (ctx.measureText(nameText).width > maxTextW && nameSize > 18) {
          nameSize -= 2;
          ctx.font = `800 ${nameSize}px Montserrat`;
        }
        const gapDesigName = Math.round(12 * cardScale);
        const nameY = desigY - desigSize - gapDesigName;
        ctx.fillText(nameText, centerX, nameY);

        ctx.restore();

        // F. Solid White Border
        ctx.save();
        drawSlideRoundedRectPath(ctx, cardX, cardY, cardW, cardH, cardRadius);
        ctx.strokeStyle = white;
        ctx.lineWidth = Math.round(13.44 * cardScale);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // --- 4. Render Top Header Strip (Drawn on top for clean depth) ---
  ctx.save();
  ctx.shadowColor = 'rgba(18, 40, 75, 0.25)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = brandDark;
  ctx.fillRect(0, 0, baseW, headerHeight);
  ctx.restore();

  ctx.fillStyle = brandDark;
  ctx.fillRect(0, 0, baseW, headerHeight);

  const headerPadLeft = Math.round(38.4 * 5.5);
  const headerPadRight = Math.round(38.4 * 4.5);
  const startY = Math.round(headerHeight * 0.22);

  // Pre-title: "WEEKLY UPDATES"
  ctx.save();
  ctx.fillStyle = brandGreen;
  ctx.font = '600 42px Montserrat';
  if ('letterSpacing' in ctx) {
    (ctx as any).letterSpacing = '6px';
  }
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText('WEEKLY UPDATES', headerPadLeft, startY);
  ctx.restore();

  // Main Title: "Welcome New Joiners"
  const titleY = startY + 54;
  ctx.save();
  ctx.font = '900 154px Montserrat';
  if ('letterSpacing' in ctx) {
    (ctx as any).letterSpacing = '-3px';
  }
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  ctx.fillStyle = white;
  ctx.fillText('Welcome ', headerPadLeft, titleY);
  const welcomeWidth = ctx.measureText('Welcome ').width;

  ctx.fillStyle = brandGreen;
  ctx.fillText('New Joiners', headerPadLeft + welcomeWidth, titleY);
  ctx.restore();

  // Multi-part badge if totalPages > 1
  if (totalPages > 1) {
    ctx.save();
    if (badgeAlpha < 1.0) {
      ctx.globalAlpha = badgeAlpha;
    }
    const badgeText = `PART ${pageNumber} OF ${totalPages}`;
    ctx.font = '700 36px Montserrat';
    const badgeTextWidth = ctx.measureText(badgeText).width;
    const badgePadX = 36;
    const badgePadY = 16;
    const badgeW = badgeTextWidth + badgePadX * 2;
    const badgeH = 36 + badgePadY * 2;
    const badgeX = baseW - headerPadRight - badgeW;
    const badgeY = Math.round((headerHeight - badgeH) / 2);

    drawSlideRoundedRectPath(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
    ctx.fillStyle = 'rgba(30, 178, 89, 0.15)';
    ctx.fill();
    ctx.strokeStyle = brandGreen;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = brandGreen;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2 + 2);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Full GIF generation pipeline with in-browser quantization and encoding.
 */
export async function generateNewJoinersGif(
  joiners: Employee[],
  options: GifExportOptions = {},
  onProgress?: (progress: GifProgressState) => void,
  abortSignal?: { aborted: boolean }
): Promise<Blob> {
  if (joiners.length === 0) {
    throw new Error('No employees provided for GIF generation');
  }

  await document.fonts.ready;

  const resConfig = getResolutionConfig(options.resolution || 'hd');
  const animationMode = options.animationMode || 'slides';
  const pace = options.pace || 'balanced';
  const layout = options.layout || 'split';

  let { width, height } = resConfig;
  // GIFs at 1920x1080 (fullhd) require quantizing 8.3 million pixels per frame across 50-100 frames,
  // causing browser heap exhaustion / freezing and generating unusable 150MB+ files.
  // We clamp fullhd GIF exports safely to crisp HD 1280x720.
  if (width > 1280) {
    width = 1280;
    height = 720;
  }
  const fps = options.fps || 12;

  let totalFrames: number;
  let slides: Employee[][] = [];
  let slideTiming = getSlidePaceConfig(pace, fps);
  let carouselPaceConfig = getPaceConfig(pace);

  if (animationMode === 'slides') {
    slides = options.totalSlidesCount === 1 ? [joiners] : splitNewJoiners(joiners);
    totalFrames = Math.max(1, slides.length * slideTiming.totalFramesPerSlide);
  } else {
    totalFrames = joiners.length * (carouselPaceConfig.holdFrames + carouselPaceConfig.transFrames);
  }

  // 1. Preload all employee images in parallel
  onProgress?.({
    currentFrame: 0,
    totalFrames,
    percentage: 2,
    phase: 'loading',
  });

  const images = await preloadJoinerImages(joiners);

  if (abortSignal?.aborted) {
    throw new Error('GIF generation cancelled');
  }

  // 2. Setup rendering canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create 2D canvas context');

  // 3. Initialize GIF encoder
  const gif = GIFEncoder();
  const delayMs = Math.round(1000 / fps);

  // 4. Render frames and encode
  for (let f = 0; f < totalFrames; f++) {
    if (abortSignal?.aborted) {
      throw new Error('GIF generation cancelled');
    }

    // Render frame onto canvas based on chosen animation mode
    if (animationMode === 'slides') {
      renderStaticSlideFrame(canvas, slides, images, f, slideTiming, {
        customGapX: options.customGapX,
        balanceRows: options.balanceRows,
        pageOffset: options.pageOffset,
        totalSlidesCount: options.totalSlidesCount || slides.length,
      });
    } else {
      renderJoinerFrame(canvas, joiners, images, f, carouselPaceConfig, layout);
    }

    // Extract RGBA pixel data
    const imgData = ctx.getImageData(0, 0, width, height);
    const rgba = imgData.data;

    // Palette quantization (256 colors maximum)
    const palette = quantize(rgba, 256);
    const indexed = applyPalette(rgba, palette);

    // Write frame into GIF stream
    gif.writeFrame(indexed, width, height, {
      palette,
      delay: delayMs,
      repeat: 0, // Loop forever
    });

    const percent = Math.round(((f + 1) / totalFrames) * 96);
    onProgress?.({
      currentFrame: f + 1,
      totalFrames,
      percentage: Math.max(5, percent),
      phase: 'rendering',
    });

    // Yield control so UI stays responsive and updates progress bar
    if (f % 2 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // 5. Finalize GIF
  onProgress?.({
    currentFrame: totalFrames,
    totalFrames,
    percentage: 98,
    phase: 'encoding',
  });

  gif.finish();
  const bytes = gif.bytes();
  const blob = new Blob([bytes], { type: 'image/gif' });

  onProgress?.({
    currentFrame: totalFrames,
    totalFrames,
    percentage: 100,
    phase: 'done',
  });

  return blob;
}

/**
 * Extracts Sequence Parameter Set (SPS) and Picture Parameter Set (PPS)
 * from a raw keyframe buffer and constructs a standard AVCDecoderConfigurationRecord (avcC box payload).
 * Used when VideoEncoder fails to supply decoderConfig.description.
 */
function extractAvcCFromKeyframe(data: Uint8Array): Uint8Array | null {
  if (data.length < 8) return null;
  let sps: Uint8Array | null = null;
  let pps: Uint8Array | null = null;

  // 1. Try length-prefixed AVCC format (standard WebCodecs format)
  let pos = 0;
  let isAvcc = true;
  while (pos + 4 < data.length) {
    const len =
      ((data[pos] << 24) >>> 0) +
      (data[pos + 1] << 16) +
      (data[pos + 2] << 8) +
      data[pos + 3];
    if (len <= 0 || pos + 4 + len > data.length) {
      isAvcc = false;
      break;
    }
    const nalData = data.subarray(pos + 4, pos + 4 + len);
    const nalType = nalData[0] & 0x1f;
    if (nalType === 7 && !sps) sps = nalData;
    if (nalType === 8 && !pps) pps = nalData;
    pos += 4 + len;
  }

  // 2. If not AVCC, try Annex-B start codes (00 00 01 or 00 00 00 01)
  if ((!sps || !pps) && !isAvcc) {
    let i = 0;
    while (i < data.length - 4) {
      let nalStart = -1;
      if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) {
        nalStart = i + 3;
      } else if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1) {
        nalStart = i + 4;
      }

      if (nalStart !== -1) {
        let nextStart = data.length;
        for (let j = nalStart; j < data.length - 2; j++) {
          if (
            (data[j] === 0 && data[j + 1] === 0 && data[j + 2] === 1) ||
            (j + 3 < data.length && data[j] === 0 && data[j + 1] === 0 && data[j + 2] === 0 && data[j + 3] === 1)
          ) {
            nextStart = j;
            break;
          }
        }
        const nalType = data[nalStart] & 0x1f;
        const nalData = data.subarray(nalStart, nextStart);
        if (nalType === 7 && !sps) sps = nalData;
        if (nalType === 8 && !pps) pps = nalData;
        i = nextStart;
      } else {
        i++;
      }
    }
  }

  if (sps && pps && sps.length >= 4) {
    const avcC = new Uint8Array(11 + sps.length + pps.length);
    avcC[0] = 1; // configurationVersion
    avcC[1] = sps[1]; // AVCProfileIndication
    avcC[2] = sps[2]; // profile_compatibility
    avcC[3] = sps[3]; // AVCLevelIndication
    avcC[4] = 0xff; // 6 bits reserved + 2 bits lengthSizeMinusOne (4-byte lengths)
    avcC[5] = 0xe1; // 3 bits reserved + 5 bits numOfSequenceParameterSets (1)
    avcC[6] = (sps.length >> 8) & 0xff;
    avcC[7] = sps.length & 0xff;
    avcC.set(sps, 8);
    let offset = 8 + sps.length;
    avcC[offset] = 1; // numOfPictureParameterSets (1)
    avcC[offset + 1] = (pps.length >> 8) & 0xff;
    avcC[offset + 2] = pps.length & 0xff;
    avcC.set(pps, offset + 3);
    return avcC;
  }
  return null;
}

/**
 * Full MP4 generation pipeline using WebCodecs (VideoEncoder) + mp4-muxer with MediaRecorder fallback.
 */
export async function generateNewJoinersMp4(
  joiners: Employee[],
  options: GifExportOptions = {},
  onProgress?: (progress: GifProgressState) => void,
  abortSignal?: { aborted: boolean }
): Promise<Blob> {
  if (joiners.length === 0) {
    throw new Error('No employees provided for MP4 generation');
  }

  await document.fonts.ready;

  const resConfig = getResolutionConfig(options.resolution || 'hd');
  const animationMode = options.animationMode || 'slides';
  const pace = options.pace || 'balanced';
  const layout = options.layout || 'split';

  // 24 frames per second for ultra smooth MP4 video playback
  const fps = 24;

  let totalFrames: number;
  let slides: Employee[][] = [];
  let slideTiming = getSlidePaceConfig(pace, fps);
  let carouselPaceConfig = { holdFrames: 36, transFrames: 16, fps };

  if (animationMode === 'slides') {
    slides = options.totalSlidesCount === 1 ? [joiners] : splitNewJoiners(joiners);
    totalFrames = Math.max(1, slides.length * slideTiming.totalFramesPerSlide);
  } else {
    const paceConfig = getPaceConfig(pace);
    const fpsMultiplier = fps / paceConfig.fps;
    const holdFrames = Math.round(paceConfig.holdFrames * fpsMultiplier);
    const transFrames = Math.round(paceConfig.transFrames * fpsMultiplier);
    carouselPaceConfig = { holdFrames, transFrames, fps };
    totalFrames = joiners.length * (holdFrames + transFrames);
  }

  // 1. Preload all employee images
  onProgress?.({
    currentFrame: 0,
    totalFrames,
    percentage: 2,
    phase: 'loading',
  });

  const images = await preloadJoinerImages(joiners);
  if (abortSignal?.aborted) throw new Error('MP4 generation cancelled');

  // Ensure width and height are even integers (H.264 standard)
  let width = resConfig.width;
  let height = resConfig.height;
  if (width % 2 !== 0) width += 1;
  if (height % 2 !== 0) height += 1;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create 2D canvas context');

  // Check if WebCodecs VideoEncoder & VideoFrame are supported
  const hasWebCodecs =
    typeof (window as any).VideoEncoder !== 'undefined' &&
    typeof (window as any).VideoFrame !== 'undefined';

  if (hasWebCodecs) {
    try {
      const VideoEncoderClass = (window as any).VideoEncoder;
      const VideoFrameClass = (window as any).VideoFrame;

      const frameDurationUs = Math.round(1_000_000 / fps);

      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width,
          height,
          frameRate: fps,
        },
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset',
      });

      let cachedDecoderConfig: any = null;
      let encoderError: any = null;
      const videoEncoder = new VideoEncoderClass({
        output: (chunk: any, meta: any) => {
          try {
            if (meta?.decoderConfig?.description) {
              cachedDecoderConfig = meta.decoderConfig;
            } else if (!cachedDecoderConfig && chunk.type === 'key') {
              const data = new Uint8Array(chunk.byteLength);
              chunk.copyTo(data);
              const extractedAvcC = extractAvcCFromKeyframe(data);
              if (extractedAvcC) {
                cachedDecoderConfig = {
                  codec: chosenCodec,
                  description: extractedAvcC,
                };
              }
            }

            const chunkMeta = meta?.decoderConfig
              ? meta
              : cachedDecoderConfig
              ? { decoderConfig: cachedDecoderConfig }
              : meta;

            muxer.addVideoChunk(chunk, chunkMeta);
          } catch (err) {
            encoderError = err;
            console.error('Error adding video chunk to muxer:', err);
          }
        },
        error: (e: any) => {
          encoderError = e;
          console.error('VideoEncoder error:', e);
        },
      });

      const videoBitrate = width >= 1920 ? 8_000_000 : width >= 1280 ? 4_500_000 : 3_500_000;

      // Universally compatible AVC1 codecs: High Profile 4.1 & Constrained Baseline 4.1 for 1080p, Level 3.1 for 720p
      const candidateCodecs =
        width >= 1920
          ? [
              'avc1.640029', // High Profile, Level 4.1 (Worldwide standard for 1080p)
              'avc1.640028', // High Profile, Level 4.0
              'avc1.64002a', // High Profile, Level 4.2
              'avc1.4d4029', // Main Profile, Level 4.1
              'avc1.4d4028', // Main Profile, Level 4.0
              'avc1.42e029', // Constrained Baseline, Level 4.1
              'avc1.42e028', // Constrained Baseline, Level 4.0
              'avc1.42e02a', // Constrained Baseline, Level 4.2
              'avc1.420029', // Baseline Profile, Level 4.1
              'avc1.420028', // Baseline Profile, Level 4.0
              'avc1.42e01f', // Constrained Baseline, Level 3.1
              'avc1.42001f', // Baseline Profile, Level 3.1
            ]
          : [
              'avc1.42e01f', // Constrained Baseline, Level 3.1 (Worldwide standard for 720p)
              'avc1.42001f', // Baseline Profile, Level 3.1
              'avc1.4d401f', // Main Profile, Level 3.1
              'avc1.64001f', // High Profile, Level 3.1
              'avc1.42001e', // Baseline Profile, Level 3.0
            ];

      let chosenCodec = candidateCodecs[0];
      if (typeof VideoEncoderClass.isConfigSupported === 'function') {
        for (const candidate of candidateCodecs) {
          try {
            const support = await VideoEncoderClass.isConfigSupported({
              codec: candidate,
              width,
              height,
              bitrate: videoBitrate,
              framerate: fps,
              avc: { format: 'avc' },
            });
            if (support && support.supported) {
              chosenCodec = candidate;
              break;
            }
          } catch {
            try {
              const support2 = await VideoEncoderClass.isConfigSupported({
                codec: candidate,
                width,
                height,
                bitrate: videoBitrate,
                framerate: fps,
              });
              if (support2 && support2.supported) {
                chosenCodec = candidate;
                break;
              }
            } catch {}
          }
        }
      }

      try {
        videoEncoder.configure({
          codec: chosenCodec,
          width,
          height,
          bitrate: videoBitrate,
          framerate: fps,
          avc: { format: 'avc' },
        });
      } catch {
        videoEncoder.configure({
          codec: chosenCodec,
          width,
          height,
          bitrate: videoBitrate,
          framerate: fps,
        });
      }

      for (let f = 0; f < totalFrames; f++) {
        if (abortSignal?.aborted) {
          try {
            videoEncoder.close();
          } catch {}
          throw new Error('MP4 generation cancelled');
        }
        if (encoderError) throw encoderError;

        if (animationMode === 'slides') {
          renderStaticSlideFrame(canvas, slides, images, f, slideTiming, {
            customGapX: options.customGapX,
            balanceRows: options.balanceRows,
            pageOffset: options.pageOffset,
            totalSlidesCount: options.totalSlidesCount || slides.length,
          });
        } else {
          renderJoinerFrame(canvas, joiners, images, f, carouselPaceConfig, layout);
        }

        const timestampUs = Math.round((f * 1_000_000) / fps);
        const frame = new VideoFrameClass(canvas, {
          timestamp: timestampUs,
          duration: frameDurationUs,
        });
        const isKeyFrame = f === 0 || f % (fps * 2) === 0;
        videoEncoder.encode(frame, { keyFrame: isKeyFrame });
        frame.close();

        const percent = Math.round(((f + 1) / totalFrames) * 95);
        onProgress?.({
          currentFrame: f + 1,
          totalFrames,
          percentage: Math.max(5, percent),
          phase: 'rendering',
        });

        if (f % 4 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      onProgress?.({
        currentFrame: totalFrames,
        totalFrames,
        percentage: 97,
        phase: 'encoding',
      });

      await videoEncoder.flush();
      videoEncoder.close();
      muxer.finalize();

      const buffer = muxer.target.buffer;
      const blob = new Blob([buffer], { type: 'video/mp4' });

      onProgress?.({
        currentFrame: totalFrames,
        totalFrames,
        percentage: 100,
        phase: 'done',
      });

      return blob;
    } catch (err: any) {
      console.warn('WebCodecs encoding fallback triggered:', err);
      // Fall through to MediaRecorder
    }
  }

  // Fallback: Record with MediaRecorder
  return recordWithMediaRecorder(
    canvas,
    joiners,
    images,
    animationMode,
    slides,
    slideTiming,
    carouselPaceConfig,
    layout,
    options,
    onProgress,
    abortSignal
  );
}

/**
 * Full WebM video generation pipeline using canvas captureStream and MediaRecorder.
 * Uses royalty-free VP9 / VP8 codec that plays natively everywhere without AVC1 proprietary codec dependencies.
 */
export async function generateNewJoinersWebm(
  joiners: Employee[],
  options: GifExportOptions = {},
  onProgress?: (progress: GifProgressState) => void,
  abortSignal?: { aborted: boolean }
): Promise<Blob> {
  if (joiners.length === 0) {
    throw new Error('No employees provided for WebM generation');
  }

  await document.fonts.ready;

  const resConfig = getResolutionConfig(options.resolution || 'hd');
  const animationMode = options.animationMode || 'slides';
  const pace = options.pace || 'balanced';
  const layout = options.layout || 'split';

  const fps = options.fps || 24;

  let totalFrames: number;
  let slides: Employee[][] = [];
  let slideTiming = getSlidePaceConfig(pace, fps);
  let carouselPaceConfig = { holdFrames: 36, transFrames: 16, fps };

  if (animationMode === 'slides') {
    slides = options.totalSlidesCount === 1 ? [joiners] : splitNewJoiners(joiners);
    totalFrames = Math.max(1, slides.length * slideTiming.totalFramesPerSlide);
  } else {
    const paceConfig = getPaceConfig(pace);
    const fpsMultiplier = fps / paceConfig.fps;
    const holdFrames = Math.round(paceConfig.holdFrames * fpsMultiplier);
    const transFrames = Math.round(paceConfig.transFrames * fpsMultiplier);
    carouselPaceConfig = { holdFrames, transFrames, fps };
    totalFrames = joiners.length * (holdFrames + transFrames);
  }

  onProgress?.({
    currentFrame: 0,
    totalFrames,
    percentage: 2,
    phase: 'loading',
  });

  const images = await preloadJoinerImages(joiners);
  if (abortSignal?.aborted) throw new Error('WebM generation cancelled');

  let width = resConfig.width;
  let height = resConfig.height;
  if (width % 2 !== 0) width += 1;
  if (height % 2 !== 0) height += 1;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  let mimeType = 'video/webm;codecs=vp9';
  if (typeof MediaRecorder !== 'undefined') {
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        mimeType = 'video/webm;codecs=vp8';
      } else {
        mimeType = 'video/webm';
      }
    }
  }

  const stream = (canvas as any).captureStream ? (canvas as any).captureStream(fps) : null;
  if (!stream) {
    throw new Error('Canvas captureStream is not supported in this browser');
  }

  const track = stream.getVideoTracks()[0];
  const videoBits = width >= 1920 ? 8_000_000 : width >= 1280 ? 4_500_000 : 3_500_000;
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: videoBits });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  recorder.start();

  const frameIntervalMs = 1000 / fps;
  for (let f = 0; f < totalFrames; f++) {
    if (abortSignal?.aborted) {
      try {
        recorder.stop();
      } catch {}
      throw new Error('WebM generation cancelled');
    }

    const frameStart = performance.now();

    if (animationMode === 'slides') {
      renderStaticSlideFrame(canvas, slides, images, f, slideTiming, {
        customGapX: options.customGapX,
        balanceRows: options.balanceRows,
        pageOffset: options.pageOffset,
        totalSlidesCount: options.totalSlidesCount || slides.length,
      });
    } else {
      renderJoinerFrame(canvas, joiners, images, f, carouselPaceConfig, layout);
    }

    if (track && typeof (track as any).requestFrame === 'function') {
      try {
        (track as any).requestFrame();
      } catch {}
    }

    const percent = Math.round(((f + 1) / totalFrames) * 95);
    onProgress?.({
      currentFrame: f + 1,
      totalFrames,
      percentage: Math.max(5, percent),
      phase: 'rendering',
    });

    const elapsed = performance.now() - frameStart;
    const waitTime = Math.max(4, Math.round(frameIntervalMs - elapsed));
    await new Promise((r) => setTimeout(r, waitTime));
  }

  // Allow encoder buffer to settle before final stop
  await new Promise((r) => setTimeout(r, 150));

  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    recorder.stop();
  });

  onProgress?.({
    currentFrame: totalFrames,
    totalFrames,
    percentage: 100,
    phase: 'done',
  });

  return new Blob(chunks, { type: 'video/webm' });
}

/**
 * Fallback recorder using HTMLCanvasElement.captureStream and MediaRecorder.
 */
async function recordWithMediaRecorder(
  canvas: HTMLCanvasElement,
  joiners: Employee[],
  images: Map<string, HTMLImageElement>,
  animationMode: AnimationMode,
  slides: Employee[][],
  slideTiming: { inFrames: number; holdFrames: number; outFrames: number; fps: number; totalFramesPerSlide: number },
  carouselPaceConfig: { holdFrames: number; transFrames: number; fps: number },
  layout: GifLayout,
  options?: GifExportOptions,
  onProgress?: (progress: GifProgressState) => void,
  abortSignal?: { aborted: boolean }
): Promise<Blob> {
  const fps = animationMode === 'slides' ? slideTiming.fps : carouselPaceConfig.fps;
  const totalFrames =
    animationMode === 'slides'
      ? slides.length * slideTiming.totalFramesPerSlide
      : joiners.length * (carouselPaceConfig.holdFrames + carouselPaceConfig.transFrames);

  let mimeType = 'video/mp4;codecs=avc1';
  if (typeof MediaRecorder !== 'undefined') {
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9';
      } else {
        mimeType = 'video/webm';
      }
    }
  }

  const stream = (canvas as any).captureStream ? (canvas as any).captureStream(fps) : null;
  if (!stream) {
    throw new Error('Canvas captureStream is not supported in this browser');
  }

  const track = stream.getVideoTracks()[0];
  const videoBits = canvas.width >= 1920 ? 8_000_000 : canvas.width >= 1280 ? 4_500_000 : 3_500_000;
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: videoBits });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  recorder.start();

  const frameIntervalMs = 1000 / fps;
  for (let f = 0; f < totalFrames; f++) {
    if (abortSignal?.aborted) {
      try {
        recorder.stop();
      } catch {}
      throw new Error('MP4 generation cancelled');
    }

    const frameStart = performance.now();

    if (animationMode === 'slides') {
      renderStaticSlideFrame(canvas, slides, images, f, slideTiming, {
        customGapX: options?.customGapX,
        balanceRows: options?.balanceRows,
        pageOffset: options?.pageOffset,
        totalSlidesCount: options?.totalSlidesCount || slides.length,
      });
    } else {
      renderJoinerFrame(canvas, joiners, images, f, carouselPaceConfig, layout);
    }

    if (track && typeof (track as any).requestFrame === 'function') {
      try {
        (track as any).requestFrame();
      } catch {}
    }

    const percent = Math.round(((f + 1) / totalFrames) * 95);
    onProgress?.({
      currentFrame: f + 1,
      totalFrames,
      percentage: Math.max(5, percent),
      phase: 'rendering',
    });

    const elapsed = performance.now() - frameStart;
    const waitTime = Math.max(4, Math.round(frameIntervalMs - elapsed));
    await new Promise((r) => setTimeout(r, waitTime));
  }

  // Allow encoder buffer to settle before final stop
  await new Promise((r) => setTimeout(r, 150));

  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    recorder.stop();
  });

  return new Blob(chunks, { type: mimeType.startsWith('video/mp4') ? 'video/mp4' : 'video/webm' });
}

