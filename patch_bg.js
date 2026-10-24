const fs = require('fs');
const content = fs.readFileSync('src/lib/canvas.ts', 'utf-8');

const replacement = `
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
  
  // Mesh Orb 1: top: 20%, left: 30%, width: 40cqw (1536px). Blur roughly simulates a gradient that fades out.
  const orb1Size = 1536; // 40cqw
  const orb1X = (width * 0.30) + (orb1Size / 2); 
  const orb1Y = (height * 0.20) + (orb1Size / 2);
  // We use a radius that covers the orb + the blur extent.
  const orb1Radius = (orb1Size / 2) + 460;
  addRadial(orb1X, orb1Y, orb1Radius, orb1Radius, 'rgba(4, 110, 182, 0.15)', 'rgba(4, 110, 182, 0)');

  // Mesh Orb 2: bottom: 10%, right: 20%, width: 35cqw (1344px)
  const orb2Size = 1344; // 35cqw
  const orb2X = (width * 0.80) - (orb2Size / 2); 
  const orb2Y = (height * 0.90) - (orb2Size / 2);
  const orb2Radius = (orb2Size / 2) + 384;
  addRadial(orb2X, orb2Y, orb2Radius, orb2Radius, 'rgba(30, 178, 89, 0.15)', 'rgba(30, 178, 89, 0)');
  
  ctx.restore();
`;

// Replace from "// --- 1. Background" to "  // --- 2. Load Image ---"
const pattern = /\/\/ --- 1\. Background[\s\S]*?\/\/ --- 2\. Load Image ---/;
const updated = content.replace(pattern, replacement.trim() + '\n\n  // --- 2. Load Image ---');
fs.writeFileSync('src/lib/canvas.ts', updated);
