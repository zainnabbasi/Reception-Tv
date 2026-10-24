const fs = require('fs');
const content = fs.readFileSync('src/lib/canvas.ts', 'utf-8');

const newBirthdayFunction = `export const drawBirthdayCreative = async (
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

  const addRadial = (x: number, y: number, r: number, color: string) => {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  addRadial(width * 0.85, height * 0.10, width * 0.6, 'rgba(4, 110, 182, 0.15)');
  addRadial(width * 0.15, height * 0.90, width * 0.5, 'rgba(30, 178, 89, 0.12)');
  addRadial(width * 0.50, height * 0.50, width * 1.0, 'rgba(255, 255, 255, 0.8)');
  
  // Orbs
  addRadial(width * 0.30, height * 0.20, 768, 'rgba(4, 110, 182, 0.15)'); // 40cqw/2 = 20cqw = 768
  addRadial(width * 0.80, height * 0.90, 672, 'rgba(30, 178, 89, 0.15)'); // 35cqw/2 = 17.5cqw = 672

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
  const photoW = 998; // 26cqw
  const photoH = 1329; // 34.6cqw
  const photoX = 2400; // Centered in the right 45% of the screen
  const photoY = (height - photoH) / 2; // 415.5
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
  // Circle top right
  ctx.save();
  ctx.beginPath();
  // 8cqw top (307), -1cqw right (-38). Relative to right side of photo container
  ctx.arc(photoX + photoW + 38, photoY + 307, 57.6, 0, Math.PI * 2); // 3cqw / 2 = 57.6
  ctx.strokeStyle = brandBlueLight;
  ctx.lineWidth = 15; // 0.4cqw
  ctx.globalAlpha = 0.8;
  ctx.stroke();
  ctx.restore();

  // Square bottom left
  ctx.save();
  // 6cqw bottom (230), -2cqw left (-76)
  const sqX = photoX - 76;
  const sqY = photoY + photoH - 230;
  ctx.translate(sqX, sqY);
  ctx.rotate(12 * Math.PI / 180);
  ctx.globalAlpha = 0.9;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 5;
  roundedRect(-38, -38, 77, 77, 8); // 2cqw (76.8) size, centered
  ctx.fillStyle = white;
  ctx.fill();
  ctx.restore();

  // --- 4. Draw Typography on the Left ---
  const textStartX = 307; // 8cqw padding-left
  let currentY = 511; // Calculated vertical centering

  // Pill "It's Time to Celebrate!"
  const pillText = "IT'S TIME TO CELEBRATE!";
  ctx.font = '700 69px Montserrat'; // 1.8cqw
  if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = '14px'; } // 0.2em
  const pillTextW = ctx.measureText(pillText).width;
  const pillPadX = 77; // 2cqw
  const pillPadY = 31; // 0.8cqw
  const pillW = pillTextW + pillPadX * 2;
  const pillH = 69 + pillPadY * 2;
  
  // Pill background & border
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
  ctx.textBaseline = 'top'; // Reset

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

  currentY += 269 + 77 + 77; // + 2cqw mb from H2 + 2cqw mt to Name

  // Name
  ctx.fillStyle = brandDark;
  let nameFontSize = 154; // 4cqw
  const nameText = employee.name;
  ctx.font = \`700 \${nameFontSize}px Montserrat\`;
  if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = '-1.5px'; }
  
  const maxTextWidth = 1774; // 55% space available roughly
  // Shrink until it fits maxTextWidth
  while (ctx.measureText(nameText).width > maxTextWidth && nameFontSize > 60) {
    nameFontSize -= 5;
    ctx.font = \`700 \${nameFontSize}px Montserrat\`;
  }
  ctx.fillText(nameText, textStartX, currentY);
  if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = '0px'; }

  currentY += nameFontSize + 38; // + 1cqw margin-bottom

  // Sentence
  ctx.fillStyle = gray700;
  ctx.font = '400 61px Montserrat'; // 1.6cqw
  wrapText(ctx, employee.sentence, textStartX, currentY, 1344, 92); // max 35cqw (1344), lh 1.5 (92)
};`;

const regex = /export const drawBirthdayCreative = async \([\s\S]*?\n};\n/;
const updatedContent = content.replace(regex, newBirthdayFunction + '\n\n');
fs.writeFileSync('src/lib/canvas.ts', updatedContent);
console.log('Patch applied successfully.');
