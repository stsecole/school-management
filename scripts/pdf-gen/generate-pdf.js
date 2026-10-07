/**
 * تحويل ملف HTML إلى PDF باستخدام Playwright
 * الاستخدام: node generate-pdf.js <input.html> <output.pdf>
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function generatePdf(htmlPath, pdfPath) {
  if (!fs.existsSync(htmlPath)) {
    console.error(`HTML file not found: ${htmlPath}`);
    process.exit(1);
  }

  console.log(`🔄 Converting: ${htmlPath} → ${pdfPath}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // تحميل ملف HTML المحلي
    const fileUrl = `file://${path.resolve(htmlPath)}`;
    await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // انتظار تحميل الخطوط
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);

    // توليد PDF
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '18mm',
        bottom: '20mm',
        left: '18mm',
      },
      preferCSSPageSize: false,
    });

    const stats = fs.statSync(pdfPath);
    console.log(`✅ PDF generated: ${pdfPath} (${(stats.size / 1024).toFixed(2)} KB)`);
  } finally {
    await browser.close();
  }
}

// قراءة المعطيات من سطر الأوامر
const [, , htmlPath, pdfPath] = process.argv;

if (!htmlPath || !pdfPath) {
  console.error('Usage: node generate-pdf.js <input.html> <output.pdf>');
  process.exit(1);
}

generatePdf(htmlPath, pdfPath).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
