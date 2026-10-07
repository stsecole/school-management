/**
 * توليد أيقونات PNG حقيقية (192x192 و 512x512) للتطبيق
 * باستخدام Sharp لتحويل SVG إلى PNG
 *
 * إذا لم يكن Sharp متوفراً، يتخطى العملية بصمت (الأيقونات الموجودة تُستخدم)
 */
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('[icons] Sharp not available, skipping icon generation (existing icons will be used)');
  process.exit(0);
}

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// SVG للأيقونة - شعار مدرسة السلامة
const iconSvg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3a8a"/>
      <stop offset="100%" style="stop-color:#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)" rx="${size * 0.1}"/>
  <!-- كتاب مفتوح -->
  <g transform="translate(${size * 0.2}, ${size * 0.25})">
    <path d="M0 ${size * 0.1} L${size * 0.3} 0 L${size * 0.6} ${size * 0.1} L${size * 0.6} ${size * 0.45} L${size * 0.3} ${size * 0.35} L0 ${size * 0.45} Z"
      fill="white" opacity="0.95"/>
    <line x1="${size * 0.3}" y1="0" x2="${size * 0.3}" y2="${size * 0.35}"
      stroke="#1e3a8a" stroke-width="${size * 0.015}"/>
  </g>
  <!-- قبعة التخرج -->
  <g transform="translate(${size * 0.25}, ${size * 0.6})">
    <path d="M0 ${size * 0.05} L${size * 0.25} 0 L${size * 0.5} ${size * 0.05} L${size * 0.25} ${size * 0.1} Z"
      fill="#fbbf24"/>
    <path d="M${size * 0.1} ${size * 0.08} L${size * 0.1} ${size * 0.18} L${size * 0.25} ${size * 0.22} L${size * 0.4} ${size * 0.18} L${size * 0.4} ${size * 0.08}"
      fill="#f59e0b"/>
    <line x1="${size * 0.4}" y1="${size * 0.1}" x2="${size * 0.45}" y2="${size * 0.18}"
      stroke="#fbbf24" stroke-width="${size * 0.01}"/>
    <circle cx="${size * 0.45}" cy="${size * 0.18}" r="${size * 0.015}" fill="#fbbf24"/>
  </g>
</svg>`;

async function generateIcons() {
  console.log('🎨 Generating PNG icons...');

  const sizes = [192, 512];
  for (const size of sizes) {
    const svg = Buffer.from(iconSvg(size));
    const outputPath = path.join(PUBLIC_DIR, `icon-${size}.png`);

    try {
      await sharp(svg)
        .png()
        .toFile(outputPath);
      console.log(`  ✓ Generated icon-${size}.png (${size}x${size})`);
    } catch (e) {
      console.error(`  ✗ Failed to generate icon-${size}.png:`, e.message);
      // fallback: كتابة SVG كملف .png (ليس مثالياً لكن يمنع الفساد)
      fs.writeFileSync(outputPath, svg);
      console.log(`  ⚠ Fallback: wrote SVG content as icon-${size}.png`);
    }
  }

  // أيضاً توليد favicon
  try {
    const svg32 = Buffer.from(iconSvg(32));
    await sharp(svg32).png().toFile(path.join(PUBLIC_DIR, 'favicon.png'));
    console.log('  ✓ Generated favicon.png (32x32)');
  } catch (e) {
    console.error('  ✗ Failed to generate favicon:', e.message);
  }

  // توليد apple-touch-icon (180x180)
  try {
    const svg180 = Buffer.from(iconSvg(180));
    await sharp(svg180).png().toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
    console.log('  ✓ Generated apple-touch-icon.png (180x180)');
  } catch (e) {
    console.error('  ✗ Failed to generate apple-touch-icon:', e.message);
  }

  console.log('✅ Icon generation complete.');
}

generateIcons().catch(console.error);
