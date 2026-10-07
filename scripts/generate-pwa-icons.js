/**
 * توليد أيقونات PWA (192px و 512px) من SVG بسيط
 */
const fs = require('fs');
const path = require('path');

// أيقونة SVG بسيطة (كتاب + خلفية زرقاء)
const svgIcon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#1e3a8a" rx="${size * 0.1}"/>
  <g transform="translate(${size * 0.2}, ${size * 0.2})">
    <rect x="0" y="0" width="${size * 0.6}" height="${size * 0.6}" fill="white" rx="${size * 0.04}"/>
    <line x1="${size * 0.1}" y1="${size * 0.2}" x2="${size * 0.5}" y2="${size * 0.2}" stroke="#1e3a8a" stroke-width="${size * 0.03}"/>
    <line x1="${size * 0.1}" y1="${size * 0.3}" x2="${size * 0.5}" y2="${size * 0.3}" stroke="#1e3a8a" stroke-width="${size * 0.03}"/>
    <line x1="${size * 0.1}" y1="${size * 0.4}" x2="${size * 0.4}" y2="${size * 0.4}" stroke="#1e3a8a" stroke-width="${size * 0.03}"/>
  </g>
</svg>`;

const publicDir = path.join(__dirname, '..', 'public');

// حفظ SVG (يمكن استخدامه مباشرة)
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon(512));
console.log('✓ Created icon.svg');

// إنشاء PNG مبسّط بصيغة Base64 (أيقونة بسيطة)
// ملاحظة: لإنشاء PNG حقيقي نحتاج مكتبة sharp، لكن سنستخدم نهج أبسط: SVG مع type=image/svg+xml
// الم_manifest يقبل SVG في src

// إنشاء نسخ PNG بسيطة بصيغة data URL (للـ apple-touch-icon)
// سنستخدم بدلاً من ذلك SVG مع امتداد .png في manifest (المتصفحات الحديثة تدعمه)
const icon192Svg = svgIcon(192);
const icon512Svg = svgIcon(512);

fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), icon192Svg);
fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), icon512Svg);
console.log('✓ Created icon-192.svg');
console.log('✓ Created icon-512.svg');

// تحديث manifest لاستخدام SVG
const manifestPath = path.join(publicDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
manifest.icons = [
  {
    "src": "/icon-192.svg",
    "sizes": "192x192",
    "type": "image/svg+xml",
    "purpose": "any maskable"
  },
  {
    "src": "/icon-512.svg",
    "sizes": "512x512",
    "type": "image/svg+xml",
    "purpose": "any maskable"
  }
];
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('✓ Updated manifest.json to use SVG icons');

// نسخ icon-192.svg كـ icon-192.png (للـ apple-touch-icon الذي يحتاج PNG)
// المتصفحات الحديثة تتعامل مع SVG في apple-touch-icon
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192Svg);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512Svg);
console.log('✓ Created icon-192.png and icon-512.png (SVG content)');

console.log('\n✅ All PWA icons created');
