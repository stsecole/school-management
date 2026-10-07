#!/bin/bash
#==============================================================================
# سكريبت تحديث السيرفر — Server Update Script
# Usage: bash scripts/server-update.sh
#==============================================================================
# يُشغّل على السيرفر بعد رفع ملفات المشروع.
# ينفّذ الخطوات التالية بالترتيب:
#   1. فحص المتطلبات (Node.js, npm)
#   2. نسخة احتياطية من قاعدة البيانات
#   3. تثبيت الاعتماديات
#   4. تحديث قاعدة البيانات (prisma db push)
#   5. توليد Prisma Client
#   6. بناء التطبيق
#   7. إعادة تشغيل الخادم (PM2/systemd/direct)
#==============================================================================

set -e

# ألوان للطباعة
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  تحديث السيرفر — Server Update${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# الانتقال لمجلد المشروع
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo -e "${YELLOW}المجلد الحالي: ${PROJECT_DIR}${NC}"
echo ""

# ===== الخطوة 1: فحص المتطلبات =====
echo -e "${BLUE}[1/7] فحص المتطلبات...${NC}"

if ! command -v node &> /dev/null; then
  echo -e "${RED}  ❌ Node.js غير مثبّت. ثبّته أولاً:${NC}"
  echo -e "     https://nodejs.org/"
  exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}  ✓ Node.js: ${NODE_VERSION}${NC}"

if ! command -v npm &> /dev/null; then
  echo -e "${RED}  ❌ npm غير مثبّت${NC}"
  exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}  ✓ npm: ${NPM_VERSION}${NC}"

# فحص bun إن وُجد
USE_BUN=false
if command -v bun &> /dev/null; then
  BUN_VERSION=$(bun -v)
  echo -e "${GREEN}  ✓ bun: ${BUN_VERSION} (سيُستخدم بدلاً من npm)${NC}"
  USE_BUN=true
fi

# فحص PM2
USE_PM2=false
if command -v pm2 &> /dev/null; then
  echo -e "${GREEN}  ✓ pm2 متاح${NC}"
  USE_PM2=true
fi

echo ""

# ===== الخطوة 2: نسخة احتياطية من قاعدة البيانات =====
echo -e "${BLUE}[2/7] نسخة احتياطية من قاعدة البيانات...${NC}"
if [ -f "db/custom.db" ]; then
  BACKUP_NAME="db/custom.db.backup-$(date +%Y%m%d-%H%M%S)"
  cp db/custom.db "$BACKUP_NAME"
  echo -e "${GREEN}  ✓ تم إنشاء نسخة احتياطية: ${BACKUP_NAME}${NC}"
else
  echo -e "${YELLOW}  ⚠️ لا توجد قاعدة بيانات حالية — سيتم إنشاؤها${NC}"
  mkdir -p db
fi
echo ""

# ===== الخطوة 3: تثبيت الاعتماديات =====
echo -e "${BLUE}[3/7] تثبيت الاعتماديات...${NC}"
if [ "$USE_BUN" = true ]; then
  bun install
else
  npm install
fi
echo -e "${GREEN}  ✓ تم تثبيت الاعتماديات${NC}"
echo ""

# ===== الخطوة 4: تحديث قاعدة البيانات =====
echo -e "${BLUE}[4/7] تحديث قاعدة البيانات (prisma db push)...${NC}"
npx prisma db push
echo -e "${GREEN}  ✓ تم تحديث قاعدة البيانات${NC}"
echo ""

# ===== الخطوة 5: توليد Prisma Client =====
echo -e "${BLUE}[5/7] توليد Prisma Client...${NC}"
npx prisma generate
echo -e "${GREEN}  ✓ تم توليد Prisma Client${NC}"
echo ""

# ===== الخطوة 6: بناء التطبيق =====
echo -e "${BLUE}[6/7] بناء التطبيق...${NC}"
echo -e "${YELLOW}  قد يستغرق هذا عدة دقائق...${NC}"
if [ "$USE_BUN" = true ]; then
  bun run build
else
  npm run build
fi
BUILD_STATUS=$?
if [ $BUILD_STATUS -ne 0 ]; then
  echo -e "${RED}  ❌ فشل البناء! تحقّق من الأخطاء أعلاه${NC}"
  exit 1
fi
echo -e "${GREEN}  ✓ تم بناء التطبيق${NC}"
echo ""

# ===== الخطوة 7: إعادة تشغيل الخادم =====
echo -e "${BLUE}[7/7] إعادة تشغيل الخادم...${NC}"

if [ "$USE_PM2" = true ]; then
  # فحص إن كان التطبيق مُسجّلاً في PM2
  if pm2 list 2>/dev/null | grep -q "school-management\|next-app\|app"; then
    pm2 restart all
    echo -e "${GREEN}  ✓ تم إعادة التشغيل عبر PM2${NC}"
  else
    # تسجيل التطبيق في PM2 إن لم يكن مُسجّلاً
    if [ "$USE_BUN" = true ]; then
      pm2 start "bun run start" --name "school-management"
    else
      pm2 start "npm run start" --name "school-management"
    fi
    pm2 save
    echo -e "${GREEN}  ✓ تم تشغيل التطبيق عبر PM2${NC}"
  fi
elif command -v systemctl &> /dev/null && systemctl list-unit-files | grep -q "school\|next\|app"; then
  sudo systemctl restart school-management 2>/dev/null || sudo systemctl restart next-app 2>/dev/null
  echo -e "${GREEN}  ✓ تم إعادة التشغيل عبر systemd${NC}"
else
  echo -e "${YELLOW}  ⚠️ لم يتم العثور على نظام إدارة عمليات (PM2/systemd)${NC}"
  echo -e "${YELLOW}  ستحتاج لإعادة تشغيل الخادم يدوياً:${NC}"
  echo -e "     ${BLUE}npm run start${NC}"
  echo -e "  أو لتشغيل دائم، ثبّت PM2:"
  echo -e "     ${BLUE}npm install -g pm2${NC}"
  echo -e "     ${BLUE}pm2 start \"npm run start\" --name school-management${NC}"
  echo -e "     ${BLUE}pm2 startup && pm2 save${NC}"
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  ✅ تم التحديث بنجاح!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "الخطوات التالية:"
echo -e "  1. افتح المتصفح على دومينك"
echo -e "  2. سجّل الدخول بـ: ${BLUE}admin / admin123${NC}"
echo -e "  3. تحقّق من ظهور قسم ${BLUE}«المساعد الذكي»${NC} في القائمة الجانبية"
echo -e "  4. جرّب طرح سؤال مثل: ${BLUE}«كم عدد الطلاب؟»${NC}"
echo ""
echo -e "إن واجهت مشاكل:"
echo -e "  - تحقّق من السجلات: ${BLUE}pm2 logs school-management${NC}"
echo -e "  - أو: ${BLUE}cat /home/your-user/.pm2/logs/school-management-out.log${NC}"
echo ""
