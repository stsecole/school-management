#!/bin/bash
#==============================================================================
# سكريبت تحضير حزمة النشر — Deployment Package Builder
# Usage: bash scripts/deploy.sh
#==============================================================================
# يُنشئ ملف ZIP نظيف يحتوي على كل ملفات المشروع الضرورية للنشر،
# باستثناء: node_modules, .next, db, logs, cache.
#
# يحتوي الملف الناتج على:
#   - كل أكواد src/
#   - prisma/schema.prisma
#   - package.json + bun.lock
#   - public/ (الأيقونات، manifest، sw.js)
#   - next.config.ts, tsconfig.json, tailwind.config.ts, postcss.config.mjs
#   - .env.example (قالب البيئة)
#   - scripts/server-update.sh (سكريبت التحديث للسيرفر)
#==============================================================================

set -e

PROJECT_DIR="/home/z/my-project"
OUTPUT_DIR="${PROJECT_DIR}/download"
PACKAGE_NAME="school-management-deploy-$(date +%Y%m%d-%H%M%S)"
PACKAGE_DIR="${OUTPUT_DIR}/${PACKAGE_NAME}"
ZIP_FILE="${OUTPUT_DIR}/${PACKAGE_NAME}.zip"

echo "================================================"
echo "  تحضير حزمة النشر — Building Deployment Package"
echo "================================================"
echo ""

# تنظيف أي حزمة سابقة بنفس الاسم
rm -rf "${PACKAGE_DIR}" "${ZIP_FILE}"
mkdir -p "${PACKAGE_DIR}"

cd "${PROJECT_DIR}"

echo "[1/8] نسخ ملفات الكود المصدري (src/)..."
cp -r src "${PACKAGE_DIR}/"

echo "[2/8] نسخ مجلد Prisma..."
cp -r prisma "${PACKAGE_DIR}/"

echo "[3/8] نسخ الملفات العامة (public/)..."
cp -r public "${PACKAGE_DIR}/"

echo "[4/8] نسخ ملفات الإعداد..."
cp package.json "${PACKAGE_DIR}/"
cp bun.lock "${PACKAGE_DIR}/" 2>/dev/null || echo "  (no bun.lock found, skipping)"
cp next.config.ts "${PACKAGE_DIR}/"
cp tsconfig.json "${PACKAGE_DIR}/"
cp tailwind.config.ts "${PACKAGE_DIR}/"
cp postcss.config.mjs "${PACKAGE_DIR}/"
cp components.json "${PACKAGE_DIR}/"
cp eslint.config.mjs "${PACKAGE_DIR}/"
cp .env "${PACKAGE_DIR}/.env.example" 2>/dev/null || echo "DATABASE_URL=\"file:./db/custom.db\"" > "${PACKAGE_DIR}/.env.example"

echo "[5/8] نسخ مجلد scripts/ (سكريبتات السيرفر)..."
mkdir -p "${PACKAGE_DIR}/scripts"
cp scripts/server-update.sh "${PACKAGE_DIR}/scripts/" 2>/dev/null || echo "  (server-update.sh not yet created)"
cp scripts/seed.ts "${PACKAGE_DIR}/scripts/" 2>/dev/null || true
cp scripts/seed-departments.ts "${PACKAGE_DIR}/scripts/" 2>/dev/null || true

echo "[6/8] إنشاء ملف .gitignore للحزمة..."
cat > "${PACKAGE_DIR}/.gitignore" << 'GITEOF'
# Dependencies
node_modules/

# Build output
.next/
out/

# Database
db/*.db
db/*.db-journal

# Logs
*.log
dev.log
server.log

# Environment
.env

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Cache
.cache/
.turbo/
GITEOF

echo "[7/8] إنشاء ملف README للحزمة..."
cat > "${PACKAGE_DIR}/DEPLOY-README.md" << 'READMEEOF'
# دليل النشر السريع — Quick Deployment Guide

## الخطوة 1: رفع الملفات
1. فُك ضغط ملف ZIP في مجلد المشروع على السيرفر
2. تأكد من أن كل الملفات في مكانها الصحيح

## الخطوة 2: تثبيت الاعتماديات
```bash
npm install
# أو: bun install
```

## الخطوة 3: تحديث قاعدة البيانات
```bash
# احتياطي قاعدة البيانات الحالية إن وُجدت
cp db/custom.db db/custom.db.backup-$(date +%Y%m%d)

# تطبيق التحديثات على القاعدة
npx prisma db push
npx prisma generate
```

## الخطوة 4: بناء التطبيق
```bash
npm run build
```

## الخطوة 5: إعادة تشغيل الخادم
```bash
# إذا كنت تستخدم PM2:
pm2 restart all

# أو إذا كنت تستخدم systemd:
sudo systemctl restart your-app-name

# أو تشغيل مباشر:
npm run start
```

## الخطوة 6: التحقق
- افتح المتصفح على دومينك
- سجّل الدخول بـ admin / admin123
- تحقق من ظهور قسم "المساعد الذكي" في القائمة الجانبية

## الطريقة البديلة: سكريبت تلقائي
```bash
bash scripts/server-update.sh
```
READMEEOF

echo "[8/8] إنشاء ملف ZIP..."
cd "${OUTPUT_DIR}"
zip -qr "${ZIP_FILE}" "${PACKAGE_NAME}"

# حساب الحجم
SIZE=$(du -sh "${ZIP_FILE}" | cut -f1)
FILE_COUNT=$(find "${PACKAGE_NAME}" -type f | wc -l)

echo ""
echo "================================================"
echo "  ✅ تم إنشاء الحزمة بنجاح!"
echo "================================================"
echo ""
echo "📁 المجلد المؤقت: ${PACKAGE_DIR}"
echo "📦 ملف ZIP:       ${ZIP_FILE}"
echo "📊 الحجم:          ${SIZE}"
echo "📄 عدد الملفات:    ${FILE_COUNT}"
echo ""
echo "الخطوات التالية:"
echo "  1. حمّل ملف ZIP: ${ZIP_FILE}"
echo "  2. ارفعه إلى السيرفر (عبر FTP أو cPanel)"
echo "  3. فُك ضغطه في مجلد المشروع"
echo "  4. شغّل: bash scripts/server-update.sh"
echo ""

# عرض محتويات الحزمة (إن طُلب ذلك كوسيط)
if [ "$1" = "--show" ] || [ "$1" = "-s" ]; then
  echo ""
  echo "محتويات الحزمة:"
  echo "----------------"
  cd "${PACKAGE_DIR}"
  find . -type f | sort | head -80
  echo ""
  echo "... (و ${FILE_COUNT} ملف إجمالاً)"
fi

echo ""
echo "💡 لعرض المحتويات: bash scripts/deploy.sh --show"
echo "💡 للاطلاع على دليل النشر: cat download/DEPLOYMENT-GUIDE.md"
