import { Employee } from '../types';

export const drawBirthdayCreative = async (
  canvas: HTMLCanvasElement,
  employee: { name: string; sentence: string },
  imageSrc: string
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  await document.fonts.ready;

  // 4K Resolution (3840 x 2160)
  const width = 3840;
  const height = 2160;
  canvas.width = width;
  canvas.height = height;

  const brandDark = '#12284b';
  const brandGreen = '#1eb259';
  const brandBlue = '#046eb6';
  const brandGreenLight = '#e8f7ec';
  const brandBlueLight = '#e6f1f8';
  const gray700 = '#374151';
  const white = '#FFFFFF';

  // --- 1. Background (Gradient Mesh) ---
  ctx.fillStyle = brandGreenLight;
  ctx.fillRect(0, 0, width, height);

  const addRadial = (cx: number, cy: number, rx: number, ry: number, colorStart: string, colorEnd: string) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    grad.addColorStop(0, colorStart);
    grad.addColorStop(1, colorEnd);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // radial-gradient(at 85% 10%, rgba(4, 110, 182, 0.15) 0px, transparent 60%)
  addRadial(width * 0.85, height * 0.10, width * 0.6, width * 0.6, 'rgba(4, 110, 182, 0.15)', 'rgba(4, 110, 182, 0)');
  
  // radial-gradient(at 15% 90%, rgba(30, 178, 89, 0.12) 0px, transparent 50%)
  addRadial(width * 0.15, height * 0.90, width * 0.5, width * 0.5, 'rgba(30, 178, 89, 0.12)', 'rgba(30, 178, 89, 0)');
  
  // radial-gradient(at 50% 50%, rgba(255, 255, 255, 0.8) 0px, transparent 100%)
  addRadial(width * 0.50, height * 0.50, width, width, 'rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0)');

  // Orbs (Solid with heavy blur replaced with smooth radial gradients to prevent Canvas filter artifacts/darkness)
  ctx.save();
  // Mesh Orb 1: top: 20%, left: 30%, width: 40cqw
  const orb1Size = 1536; // 40cqw
  const orb1X = (width * 0.30) + (orb1Size / 2); // left 30% means left edge is at 30%
  const orb1Y = (height * 0.20) + (orb1Size / 2);
  const orb1Radius = (orb1Size / 2) + 460;
  addRadial(orb1X, orb1Y, orb1Radius, orb1Radius, 'rgba(4, 110, 182, 0.15)', 'rgba(4, 110, 182, 0)');

  // Mesh Orb 2: bottom: 10%, right: 20%, width: 35cqw
  const orb2Size = 1344; // 35cqw
  const orb2X = (width * 0.80) - (orb2Size / 2); // right 20% means right edge is at 80%
  const orb2Y = (height * 0.90) - (orb2Size / 2);
  const orb2Radius = (orb2Size / 2) + 384;
  addRadial(orb2X, orb2Y, orb2Radius, orb2Radius, 'rgba(30, 178, 89, 0.15)', 'rgba(30, 178, 89, 0)');
  ctx.restore();

  // --- 2. Load Image ---
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageSrc;
  });

  // Base Path
  const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
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

  // --- 3. Draw Photo on the Right ---
  // Total width: 3840. Padding left/right: 8cqw = 307px. Available: 3226.
  // Left container: 55% = 1774. Right container: 45% = 1452.
  const rightContainerX = 2081; // 307 + 1774
  const rightContainerW = 1452;
  
  const photoW = 998; // 26cqw
  const photoH = 1329; // 34.6cqw
  
  // Center in the right container
  const photoX = rightContainerX + (rightContainerW - photoW) / 2;
  const photoY = (height - photoH) / 2;
  const photoRadius = 77; // 2cqw

  const offset = 58; // 1.5cqw

  // Solid Accent Block (Green) Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 30;
  roundedRect(photoX + offset, photoY + offset, photoW, photoH, photoRadius);
  ctx.fillStyle = brandGreen;
  ctx.fill();
  ctx.restore();

  // Solid Accent Block Base
  roundedRect(photoX + offset, photoY + offset, photoW, photoH, photoRadius);
  ctx.fillStyle = brandGreen;
  ctx.fill();

  // Main Photo Frame Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 25;
  roundedRect(photoX, photoY, photoW, photoH, photoRadius);
  ctx.fillStyle = white;
  ctx.fill();
  ctx.restore();

  // Main Photo Frame Base
  roundedRect(photoX, photoY, photoW, photoH, photoRadius);
  ctx.fillStyle = white;
  ctx.fill();

  // Clip Image
  ctx.save();
  const border = 23; // 0.6cqw
  roundedRect(photoX + border, photoY + border, photoW - border * 2, photoH - border * 2, photoRadius - 8);
  ctx.clip();
  
  const innerW = photoW - border * 2;
  const innerH = photoH - border * 2;
  const imgAspect = img.width / img.height;
  const boxAspect = innerW / innerH;
  let drawWidth = innerW;
  let drawHeight = innerH;
  
  if (imgAspect > boxAspect) {
    drawWidth = drawHeight * imgAspect;
  } else {
    drawHeight = drawWidth / imgAspect;
  }
  
  ctx.drawImage(
    img,
    photoX + border - (drawWidth - innerW) / 2,
    photoY + border - (drawHeight - innerH) / 2,
    drawWidth,
    drawHeight
  );
  ctx.restore();

  // Floating Accents
  // Circle top right (top 8cqw, right -1cqw relative to photo)
  ctx.save();
  ctx.beginPath();
  const circleRadius = 58; // 3cqw / 2
  // Right edge of photo + 1cqw (38px) - radius
  const circleCX = photoX + photoW + 38 - circleRadius;
  // Top edge + 8cqw (307px) + radius
  const circleCY = photoY + 307 + circleRadius;
  ctx.arc(circleCX, circleCY, circleRadius, 0, Math.PI * 2);
  ctx.strokeStyle = brandBlue; // Pop color instead of light blue
  ctx.lineWidth = 15; // 0.4cqw
  ctx.globalAlpha = 1.0;
  ctx.stroke();
  ctx.restore();

  // Square bottom left (bottom 6cqw, left -2cqw relative to photo)
  ctx.save();
  const sqRadius = 38.5; // 2cqw / 2
  // Left edge of photo - 2cqw (77px) + radius
  const sqCX = photoX - 77 + sqRadius;
  // Bottom edge - 6cqw (230px) - radius
  const sqCY = photoY + photoH - 230 - sqRadius;
  ctx.translate(sqCX, sqCY);
  ctx.rotate(12 * Math.PI / 180);
  ctx.globalAlpha = 1.0;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 5;
  roundedRect(-sqRadius, -sqRadius, sqRadius * 2, sqRadius * 2, 8);
  ctx.fillStyle = brandGreen; // Pop color instead of white
  ctx.fill();
  ctx.restore();

  // --- 4. Draw Typography on the Left ---
  const textStartX = 307; // 8cqw padding-left
  let currentY = 523; // Calculated vertical centering

  // Pill "IT'S TIME TO CELEBRATE!"
  const pillText = "IT'S TIME TO CELEBRATE!";
  ctx.font = '700 69px Montserrat'; // 1.8cqw
  if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = '14px'; } // 0.2em
  
  let pillTextW = ctx.measureText(pillText).width;
  // Ensure we account for letter spacing if the browser measureText skips it
  if (pillTextW < 1000) {
    pillTextW += pillText.length * 14; 
  }

  const pillPadX = 77; // 2cqw
  const pillPadY = 31; // 0.8cqw
  const pillW = pillTextW + pillPadX * 2;
  const pillH = 69 + pillPadY * 2;
  
  // Pill background & border
  ctx.save();
  roundedRect(textStartX, currentY, pillW, pillH, pillH / 2);
  ctx.fillStyle = 'rgba(30, 178, 89, 0.1)'; // brand-green/10
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 178, 89, 0.3)'; // brand-green/30
  ctx.lineWidth = 4;
  ctx.stroke();

  // Pill Text
  ctx.fillStyle = brandGreen;
  ctx.textBaseline = 'middle';
  ctx.fillText(pillText, textStartX + pillPadX + 5, currentY + pillH / 2 + 4);
  if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = '0px'; }
  ctx.restore();
  
  ctx.textBaseline = 'top'; // Set global text baseline to top after restore

  currentY += pillH + 115; // + 3cqw margin-bottom

  // "HAPPY BIRTHDAY"
  ctx.font = '900 269px Montserrat'; // 7cqw
  if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = '-5px'; } // -0.02em
  
  ctx.fillStyle = brandDark;
  ctx.fillText('HAPPY', textStartX - 8, currentY); // slight negative optical shift
  
  currentY += 269; // line-height 1
  
  ctx.fillStyle = brandBlue;
  ctx.fillText('BIRTHDAY', textStartX - 8, currentY);

  if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = '0px'; }

  currentY += 269 + 77; // + 2cqw mb from H2

  // Name
  ctx.fillStyle = brandDark;
  let nameFontSize = 154; // 4cqw
  const nameText = employee.name;
  ctx.font = `700 ${nameFontSize}px Montserrat`;
  if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = '-1.5px'; }
  
  const maxTextWidth = 1774; // 55% space available roughly
  // Shrink until it fits maxTextWidth
  while (ctx.measureText(nameText).width > maxTextWidth && nameFontSize > 60) {
    nameFontSize -= 5;
    ctx.font = `700 ${nameFontSize}px Montserrat`;
  }
  ctx.fillText(nameText, textStartX, currentY);
  if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = '0px'; }

  currentY += nameFontSize + 38; // + 1cqw margin-bottom

  // Sentence (Single Line dynamically scaled)
  ctx.fillStyle = gray700;
  let sentenceFontSize = 61; // 1.6cqw
  ctx.font = `400 ${sentenceFontSize}px Montserrat`; 
  
  const maxSentenceWidth = 1344; // max-w-[35cqw]
  // Shrink until it fits maxSentenceWidth to keep it on a single line
  while (ctx.measureText(employee.sentence).width > maxSentenceWidth && sentenceFontSize > 20) {
    sentenceFontSize -= 2;
    ctx.font = `400 ${sentenceFontSize}px Montserrat`;
  }
  ctx.fillText(employee.sentence, textStartX, currentY);
};


export const drawAnniversaryCreative = async (
  canvas: HTMLCanvasElement,
  employee: { name: string; sentence: string },
  imageSrc: string
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  await document.fonts.ready;

  // 4K Resolution (3840 x 2160)
  const width = 3840;
  const height = 2160;
  canvas.width = width;
  canvas.height = height;

  const brandDark = '#12284b';
  const brandGreen = '#1eb259';
  const brandBlue = '#046eb6';
  const brandGreenLight = '#e8f7ec';
  const brandBlueLight = '#e6f1f8';
  const white = '#FFFFFF';

  // Base Background
  ctx.fillStyle = brandDark;
  ctx.fillRect(0, 0, width, height);

  // --- Background Decorative Elements ---
  
  // 1. d1-circle-1 (Top Right)
  const circ1Radius = 960; // 50cqw/2
  const circ1X = 3264; // X mapping based on CSS right -10cqw
  const circ1Y = 192; // Y mapping based on CSS top -20cqw
  ctx.beginPath();
  const grad1 = ctx.createRadialGradient(circ1X, circ1Y, 0, circ1X, circ1Y, circ1Radius);
  grad1.addColorStop(0, 'rgba(4,110,182,0.8)');
  grad1.addColorStop(0.7, 'rgba(18,40,75,0)');
  ctx.fillStyle = grad1;
  ctx.arc(circ1X, circ1Y, circ1Radius, 0, Math.PI * 2);
  ctx.fill();

  // 2. d1-circle-2 (Bottom Left)
  const circ2Radius = 768; // 40cqw/2
  const circ2X = 384; // X mapping based on left -10cqw
  const circ2Y = 1968; // Y mapping based on bottom -15cqw
  ctx.beginPath();
  const grad2 = ctx.createRadialGradient(circ2X, circ2Y, 0, circ2X, circ2Y, circ2Radius);
  grad2.addColorStop(0, 'rgba(30,178,89,0.4)');
  grad2.addColorStop(0.7, 'rgba(18,40,75,0)');
  ctx.fillStyle = grad2;
  ctx.arc(circ2X, circ2Y, circ2Radius, 0, Math.PI * 2);
  ctx.fill();

  // 3. d1-dots (Top Right Pattern)
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = 57.6; // 1.5cqw
  patternCanvas.height = 57.6;
  const pCtx = patternCanvas.getContext('2d');
  if (pCtx) {
     pCtx.fillStyle = 'rgba(255,255,255,0.2)';
     pCtx.beginPath();
     pCtx.arc(28.8, 28.8, 8.64, 0, Math.PI * 2);
     pCtx.fill();
     const pattern = ctx.createPattern(patternCanvas, 'repeat');
     if (pattern) {
       ctx.fillStyle = pattern;
       // top 5cqw(192), right 5cqw(192). w=15cqw(576), h=15cqw(576)
       ctx.fillRect(3840 - 192 - 576, 192, 576, 576);
     }
  }

  // --- Load Image ---
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageSrc;
  });

  // Base Path Helper
  const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
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

  // --- Right Side Content (Photo) ---
  const photoWidth = 960; // 25cqw
  const photoHeight = 1280; // 33.33cqw
  const paddingRight = 307.2; // 8cqw right padding
  const photoX = width - paddingRight - photoWidth; // 2572.8
  const photoY = (height - photoHeight) / 2; // 440
  const outerRadius = 76.8; // 2cqw

  // Outer shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 100;
  ctx.shadowOffsetY = 40;
  roundedRect(photoX, photoY, photoWidth, photoHeight, outerRadius);
  ctx.fillStyle = white; // shadow base
  ctx.fill();
  ctx.restore();

  // Outer Box Gradient
  ctx.save();
  roundedRect(photoX, photoY, photoWidth, photoHeight, outerRadius);
  const boxGrad = ctx.createLinearGradient(photoX + photoWidth, photoY, photoX, photoY + photoHeight); // top-right to bottom-left
  boxGrad.addColorStop(0, brandBlue);
  boxGrad.addColorStop(0.5, brandGreen);
  boxGrad.addColorStop(1, white);
  ctx.fillStyle = boxGrad;
  ctx.fill();
  ctx.restore();

  // Inner Box
  const p = 30.72; // 0.8cqw padding
  const innerX = photoX + p;
  const innerY = photoY + p;
  const innerW = photoWidth - p * 2;
  const innerH = photoHeight - p * 2;
  const innerR = 57.6; // 1.5cqw

  // Inner Border Base
  ctx.save();
  roundedRect(innerX, innerY, innerW, innerH, innerR);
  ctx.lineWidth = 23.04; // 0.6cqw
  ctx.strokeStyle = brandDark;
  ctx.stroke();

  // Clip & Image
  ctx.clip();
  const imgAspect = img.width / img.height;
  const boxAspect = innerW / innerH;
  let drawWidth = innerW;
  let drawHeight = innerH;
  if (imgAspect > boxAspect) {
    drawWidth = drawHeight * imgAspect;
  } else {
    drawHeight = drawWidth / imgAspect;
  }
  ctx.drawImage(img, innerX - (drawWidth - innerW)/2, innerY - (drawHeight - innerH)/2, drawWidth, drawHeight);
  ctx.restore();

  // Badge decoration (Bottom Right of Photo Box)
  // CSS: absolute -bottom-[1cqw] -right-[1cqw] w-[6cqw] h-[6cqw]
  const badgeRadius = 115.2; // 3cqw
  const badgeX = photoX + photoWidth + 38.4 - badgeRadius;
  const badgeY = photoY + photoHeight + 38.4 - badgeRadius;

  ctx.save();
  // Badge Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 15;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
  ctx.fillStyle = brandBlue;
  ctx.fill();
  ctx.restore();

  // Badge Stroke
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
  ctx.lineWidth = 15.36; // 0.4cqw
  ctx.strokeStyle = brandDark;
  ctx.stroke();

  // Star Icon inside Badge
  ctx.save();
  ctx.translate(badgeX, badgeY);
  ctx.scale(4.8, 4.8); // 115.2 / 24
  ctx.translate(-12, -12); // Center 24x24 path
  ctx.fillStyle = white;
  const starPath = new Path2D("M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z");
  ctx.fill(starPath);
  ctx.restore();

  // --- Left Side Content (Typography) ---
  const textStartX = 307.2; // 8cqw left padding
  const maxTextWidth = 2112; // 55% of 3840
  let currentY = 560; // Starting Y coordinate to balance vertical space

  // "Celebrating Your Journey"
  ctx.fillStyle = brandGreenLight + 'E6'; // Opacity 0.9
  ctx.font = '600 69px Montserrat';
  ctx.textBaseline = 'top';
  if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = '20px'; }
  ctx.fillText('CELEBRATING YOUR JOURNEY', textStartX, currentY);
  if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = '0px'; }
  
  currentY += 107; // 69px line height + 1cqw margin

  // Green Line
  roundedRect(textStartX, currentY, 307.2, 15.36, 7.68);
  ctx.fillStyle = brandGreen;
  ctx.fill();

  currentY += 130; // 15.36 h + 3cqw margin

  // "HAPPY WORK"
  ctx.fillStyle = white;
  ctx.font = '900 215px Montserrat';
  ctx.fillText('HAPPY WORK', textStartX - 15, currentY); // Negative shift for optical alignment
  
  currentY += 226; // 215px * 1.05

  // "ANNIVERSARY"
  ctx.fillStyle = brandGreen;
  ctx.font = '900 215px Montserrat';
  ctx.fillText('ANNIVERSARY', textStartX - 15, currentY);

  currentY += 310; // 226 line height + arbitrary space before name

  // Name
  ctx.fillStyle = white;
  let nameFontSize = 175;
  const nameText = employee.name;
  ctx.font = `700 ${nameFontSize}px Montserrat`;
  if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = '-1px'; }
  
  // Shrink until it fits maxTextWidth
  while (ctx.measureText(nameText).width > maxTextWidth && nameFontSize > 75) {
    nameFontSize -= 5;
    ctx.font = `700 ${nameFontSize}px Montserrat`;
  }
  ctx.fillText(nameText, textStartX, currentY);
  if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = '0px'; }

  currentY += nameFontSize + 30; // margin 0.5cqw

  // Sentence
  ctx.fillStyle = brandBlueLight;
  ctx.font = '400 61px Montserrat';
  wrapText(ctx, employee.sentence, textStartX, currentY, 1344, 92); // max 35cqw (1344), lh 1.5 (92)
};

// Helper for wrapping text on canvas
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {

  const words = text.split(' ');
  let line = '';

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

// -------------------------------------------------------------
// Weekly Updates – New Joiners (TV Format 16:9, 3840x2160 4K)
// -------------------------------------------------------------

export interface NewJoinersLayoutConfig {
  count: number;
  rows: number[]; // e.g. [1], [2], [3], [4], [3, 2], [3, 3], [4, 3], [4, 4], [5, 4], [5, 5]
  cardH: number;
  cardW: number;
  defaultGapX: number;
  minGapX: number;
  maxGapX: number;
  gapY: number;
}

/**
 * Returns balanced dimensions and gaps tailored specifically for each card count (1 to 10).
 * When cards are fewer, card sizes and horizontal gaps are enlarged to gracefully fill the canvas.
 */
export function getDefaultLayoutForCount(count: number): NewJoinersLayoutConfig {
  const safeCount = Math.max(1, count);
  if (safeCount <= 1) {
    return {
      count: 1,
      rows: [1],
      cardH: 1180,
      cardW: 885,
      defaultGapX: 0,
      minGapX: 0,
      maxGapX: 0,
      gapY: 0,
    };
  }
  if (safeCount === 2) {
    return {
      count: 2,
      rows: [2],
      cardH: 1040,
      cardW: 780,
      defaultGapX: 220,
      minGapX: 40,
      maxGapX: 460,
      gapY: 0,
    };
  }
  if (safeCount === 3) {
    return {
      count: 3,
      rows: [3],
      cardH: 940,
      cardW: 705,
      defaultGapX: 180,
      minGapX: 30,
      maxGapX: 360,
      gapY: 0,
    };
  }
  if (safeCount === 4) {
    return {
      count: 4,
      rows: [4],
      cardH: 860,
      cardW: 645,
      defaultGapX: 130,
      minGapX: 20,
      maxGapX: 280,
      gapY: 0,
    };
  }
  if (safeCount === 5) {
    return {
      count: 5,
      rows: [3, 2],
      cardH: 780,
      cardW: 585,
      defaultGapX: 160,
      minGapX: 30,
      maxGapX: 320,
      gapY: 48,
    };
  }
  if (safeCount === 6) {
    return {
      count: 6,
      rows: [3, 3],
      cardH: 780,
      cardW: 585,
      defaultGapX: 160,
      minGapX: 30,
      maxGapX: 320,
      gapY: 48,
    };
  }
  if (safeCount === 7) {
    return {
      count: 7,
      rows: [4, 3],
      cardH: 755,
      cardW: 566,
      defaultGapX: 110,
      minGapX: 20,
      maxGapX: 240,
      gapY: 44,
    };
  }
  if (safeCount === 8) {
    return {
      count: 8,
      rows: [4, 4],
      cardH: 755,
      cardW: 566,
      defaultGapX: 110,
      minGapX: 20,
      maxGapX: 240,
      gapY: 44,
    };
  }
  if (safeCount === 9) {
    return {
      count: 9,
      rows: [5, 4],
      cardH: 750,
      cardW: 560,
      defaultGapX: 76,
      minGapX: 16,
      maxGapX: 180,
      gapY: 42,
    };
  }
  // 10 joiners (5 + 5)
  return {
    count: Math.min(10, safeCount),
    rows: [5, 5],
    cardH: 750,
    cardW: 560,
    defaultGapX: 76,
    minGapX: 16,
    maxGapX: 180,
    gapY: 42,
  };
}

export function calculateNewJoinersMetrics(
  count: number,
  customGapX?: number,
  balanceRows: boolean = true
) {
  const layout = getDefaultLayoutForCount(count);
  const activeGapX = customGapX !== undefined ? customGapX : layout.defaultGapX;
  const maxCols = layout.rows[0];
  const maxRowWidth = maxCols * layout.cardW + (maxCols - 1) * activeGapX;
  const sidePadding = Math.max(0, Math.round((3840 - maxRowWidth) / 2));

  return {
    ...layout,
    activeGapX,
    maxRowWidth,
    sidePadding,
  };
}

/**
 * Distributes new joiners evenly across creatives with a maximum of 10 per creative.
 * If 11 to 14:
 * 11 -> 6 + 5
 * 12 -> 6 + 6
 * 13 -> 7 + 6
 * 14 -> 7 + 7
 */
export function splitNewJoiners(employees: Employee[]): Employee[][] {
  const n = employees.length;
  if (n === 0) return [];
  if (n <= 10) return [employees];

  const numCreatives = Math.ceil(n / 10);
  const baseCount = Math.floor(n / numCreatives);
  const remainder = n % numCreatives;

  const chunks: Employee[][] = [];
  let startIndex = 0;

  for (let i = 0; i < numCreatives; i++) {
    const chunkSize = i < remainder ? baseCount + 1 : baseCount;
    chunks.push(employees.slice(startIndex, startIndex + chunkSize));
    startIndex += chunkSize;
  }

  return chunks;
}

const drawRoundedRectPath = (
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

const loadCanvasImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
};

const renderAvatarSilhouette = (
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
    .map(p => p[0].toUpperCase())
    .join('');

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = `800 ${Math.round(w * 0.25)}px Montserrat`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials || 'NJ', x + w / 2, y + h * 0.35);
  ctx.restore();
};

export interface NewJoinersCreativeOptions {
  pageNumber?: number;
  totalPages?: number;
  customGapX?: number;
  balanceRows?: boolean;
}

export const drawNewJoinersCreative = async (
  canvas: HTMLCanvasElement,
  joiners: Employee[],
  options?: NewJoinersCreativeOptions
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  await document.fonts.ready;

  // 4K TV Resolution (3840 x 2160, 16:9)
  const width = 3840;
  const height = 2160;
  canvas.width = width;
  canvas.height = height;

  const brandDark = '#12284b';
  const brandGreen = '#1eb259';
  const brandLightBg = '#e2eff8'; // Matched to reference image background
  const white = '#FFFFFF';

  // --- 1. Canvas Background ---
  ctx.fillStyle = brandLightBg;
  ctx.fillRect(0, 0, width, height);

  // --- 2. Top Header Strip (19% height = 410.4px) ---
  const headerHeight = Math.round(height * 0.19);

  // Header drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(18, 40, 75, 0.25)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = brandDark;
  ctx.fillRect(0, 0, width, headerHeight);
  ctx.restore();

  // Solid header background
  ctx.fillStyle = brandDark;
  ctx.fillRect(0, 0, width, headerHeight);

  // Header Content
  const headerPadLeft = Math.round(38.4 * 5.5); // 5.5cqw = 211.2px
  const headerPadRight = Math.round(38.4 * 4.5); // 4.5cqw = 172.8px
  const startY = Math.round(headerHeight * 0.22);

  // Pre-title: "WEEKLY UPDATES"
  ctx.save();
  ctx.fillStyle = brandGreen;
  ctx.font = '600 42px Montserrat'; // 1.1cqw
  if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = '6px'; } // 0.15em
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText('WEEKLY UPDATES', headerPadLeft, startY);
  ctx.restore();

  // Main Title: "Welcome New Joiners"
  const titleY = startY + 54;
  ctx.save();
  ctx.font = '900 154px Montserrat'; // 4cqw
  if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = '-3px'; }
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  ctx.fillStyle = white;
  ctx.fillText('Welcome ', headerPadLeft, titleY);
  const welcomeWidth = ctx.measureText('Welcome ').width;

  ctx.fillStyle = brandGreen;
  ctx.fillText('New Joiners', headerPadLeft + welcomeWidth, titleY);
  ctx.restore();

  // Multi-part badge (e.g. "PART 1 OF 2") if totalPages > 1
  if (options?.totalPages && options.totalPages > 1) {
    ctx.save();
    const pageNum = options.pageNumber || 1;
    const badgeText = `PART ${pageNum} OF ${options.totalPages}`;
    ctx.font = '700 36px Montserrat';
    const badgeTextWidth = ctx.measureText(badgeText).width;
    const badgePadX = 36;
    const badgePadY = 16;
    const badgeW = badgeTextWidth + badgePadX * 2;
    const badgeH = 36 + badgePadY * 2;
    const badgeX = width - headerPadRight - badgeW;
    const badgeY = Math.round((headerHeight - badgeH) / 2);

    drawRoundedRectPath(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
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

  // --- 3. Cards Grid Layout with Customizable Horizontal Gap & Balanced Padding ---
  const K = joiners.length;
  if (K === 0) return;

  const layout = getDefaultLayoutForCount(K);
  const primaryGapX = options?.customGapX !== undefined ? options.customGapX : layout.defaultGapX;
  const balanceRows = options?.balanceRows ?? true;

  // Split joiners into rows based on balanced count distribution
  const rows: Employee[][] = [];
  let startIndex = 0;
  for (const rowCount of layout.rows) {
    if (startIndex < K) {
      rows.push(joiners.slice(startIndex, startIndex + rowCount));
      startIndex += rowCount;
    }
  }

  const cardH = layout.cardH;
  const cardW = layout.cardW;
  const gapY = layout.gapY;

  const gridTop = headerHeight + Math.round(38.4 * 1.0); // +1.0cqw
  const gridBottom = height - Math.round(38.4 * 3.5); // -3.5cqw
  const gridHeight = gridBottom - gridTop; // available vertical space ~1577px

  // Vertical centering of the entire row block
  const totalRowsHeight = rows.length * cardH + (rows.length - 1) * gapY;
  const totalRowsY = gridTop + Math.max(0, Math.round((gridHeight - totalRowsHeight) / 2));

  // Pre-load images in parallel for best performance
  const loadedImages: Map<string, HTMLImageElement> = new Map();
  await Promise.all(
    joiners.map(async (emp) => {
      if (emp.imageUrl) {
        try {
          const img = await loadCanvasImage(emp.imageUrl);
          loadedImages.set(emp.id, img);
        } catch {
          // Fallback handled in card drawing
        }
      }
    })
  );

  // --- 4. Render Employee Cards ---
  const maxCols = Math.max(...rows.map(r => r.length));

  for (let rIndex = 0; rIndex < rows.length; rIndex++) {
    const rowItems = rows[rIndex];
    if (rowItems.length === 0) continue;

    let rowGapX = primaryGapX;
    // When balanceRows is enabled and row has fewer cards (e.g. 2 vs 3 in a 5-card layout),
    // softly expand the row's gap so the negative space and padding balance harmoniously
    if (balanceRows && rows.length > 1 && rowItems.length < maxCols && rowItems.length > 1) {
      const ratio = maxCols / rowItems.length;
      const targetGap = Math.round(primaryGapX * (1 + (ratio - 1) * 0.45));
      const maxAllowedGap = Math.floor((width - 320 - rowItems.length * cardW) / (rowItems.length - 1));
      rowGapX = Math.min(targetGap, maxAllowedGap);
    }

    const rowWidth = rowItems.length * cardW + (rowItems.length - 1) * rowGapX;
    // Symmetrical, balanced horizontal centering for this row
    const rowStartX = Math.round((width - rowWidth) / 2);
    const rowY = totalRowsY + rIndex * (cardH + gapY);

    for (let cIndex = 0; cIndex < rowItems.length; cIndex++) {
      const emp = rowItems[cIndex];
      const cardX = rowStartX + cIndex * (cardW + rowGapX);
      const cardY = rowY;

      // Card radius: 1.2cqw relative to 4K (46px) scaled with card size
      const cardRadius = Math.round(cardW * 0.08); // 575 * 0.08 = 46px

      // A. Card Outer Drop Shadow (0 1.5cqw 3cqw rgba(18, 40, 75, 0.15))
      ctx.save();
      ctx.shadowColor = 'rgba(18, 40, 75, 0.18)';
      ctx.shadowBlur = Math.round(cardW * 0.20);
      ctx.shadowOffsetY = Math.round(cardW * 0.10);
      drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, cardRadius);
      ctx.fillStyle = white;
      ctx.fill();
      ctx.restore();

      // B. Card Body & Clipping
      ctx.save();
      drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, cardRadius);
      ctx.clip();

      // Base background
      ctx.fillStyle = white;
      ctx.fillRect(cardX, cardY, cardW, cardH);

      // C. Draw Photo
      const photoImg = loadedImages.get(emp.id);
      if (photoImg) {
        const imgAspect = photoImg.width / photoImg.height;
        const cardAspect = cardW / cardH;
        let sWidth: number;
        let sHeight: number;
        let sx: number;
        let sy: number;

        if (imgAspect > cardAspect) {
          // Image wider than card: crop sides, center horizontally
          sHeight = photoImg.height;
          sWidth = photoImg.height * cardAspect;
          sx = (photoImg.width - sWidth) / 2;
          sy = 0;
        } else {
          // Image taller than card: crop bottom, anchor to top (faces are at top)
          sWidth = photoImg.width;
          sHeight = photoImg.width / cardAspect;
          sx = 0;
          sy = 0;
        }
        ctx.drawImage(photoImg, sx, sy, sWidth, sHeight, cardX, cardY, cardW, cardH);
      } else {
        renderAvatarSilhouette(ctx, emp, cardX, cardY, cardW, cardH);
      }

      // D. Dark Navy Gradient Overlay for Text Contrast
      // linear-gradient(to bottom, transparent 45%, rgba(18, 40, 75, 0.7) 65%, #12284b 85%, #12284b 100%)
      const grad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
      grad.addColorStop(0, 'rgba(18, 40, 75, 0)');
      grad.addColorStop(0.45, 'rgba(18, 40, 75, 0)');
      grad.addColorStop(0.65, 'rgba(18, 40, 75, 0.72)');
      grad.addColorStop(0.85, brandDark);
      grad.addColorStop(1.0, brandDark);
      ctx.fillStyle = grad;
      ctx.fillRect(cardX, cardY, cardW, cardH);

      // E. Card Typography
      const scale = cardW / 575;
      const padBottom = Math.round(42 * scale); // 1.1cqw
      const padX = Math.round(24 * scale); // 0.6cqw
      const maxTextW = cardW - padX * 2;
      const centerX = cardX + cardW / 2;

      ctx.textAlign = 'center';

      // 1. Location (bottom-most)
      // font-size: 0.8cqw = 30.7px, Montserrat 700, #1eb259, uppercase, tracking 0.05em
      const locSize = Math.max(18, Math.round(30 * scale));
      ctx.save();
      ctx.font = `700 ${locSize}px Montserrat`;
      if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = `${1.5 * scale}px`; }
      ctx.fillStyle = brandGreen;
      ctx.textBaseline = 'bottom';
      const locText = (emp.location || 'RATNAAFIN').toUpperCase();
      const locY = cardY + cardH - padBottom;
      ctx.fillText(locText, centerX, locY);
      ctx.restore();

      // 2. Designation (Title)
      // font-size: 0.72cqw = 27.6px, Montserrat 500, #FFFFFF, line-height 1.2, mb 0.3cqw
      let desigSize = Math.max(16, Math.round(27 * scale));
      ctx.font = `500 ${desigSize}px Montserrat`;
      ctx.fillStyle = white;
      ctx.textBaseline = 'bottom';
      const desigText = emp.designation || 'Team Member';

      // Dynamically fit designation into card width
      while (ctx.measureText(desigText).width > maxTextW && desigSize > 14) {
        desigSize -= 1;
        ctx.font = `500 ${desigSize}px Montserrat`;
      }
      const gapLocDesig = Math.round(12 * scale); // 0.3cqw
      const desigY = locY - locSize - gapLocDesig;
      ctx.fillText(desigText, centerX, desigY);

      // 3. Name
      // font-size: 1.2cqw = 46px, Montserrat 800, #FFFFFF, uppercase, line-height 1.2, mb 0.3cqw
      let nameSize = Math.max(20, Math.round(46 * scale));
      ctx.font = `800 ${nameSize}px Montserrat`;
      ctx.fillStyle = white;
      ctx.textBaseline = 'bottom';
      const nameText = (emp.name || 'New Joiner').toUpperCase();

      // Dynamically fit name into card width
      while (ctx.measureText(nameText).width > maxTextW && nameSize > 18) {
        nameSize -= 2;
        ctx.font = `800 ${nameSize}px Montserrat`;
      }
      const gapDesigName = Math.round(12 * scale); // 0.3cqw
      const nameY = desigY - desigSize - gapDesigName;
      ctx.fillText(nameText, centerX, nameY);

      // Restore clipped context
      ctx.restore();

      // F. Solid White Border (border: 0.35cqw solid white = 13.44px)
      ctx.save();
      drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, cardRadius);
      ctx.strokeStyle = white;
      ctx.lineWidth = Math.round(13.44 * scale);
      ctx.stroke();
      ctx.restore();
    }
  }
};

