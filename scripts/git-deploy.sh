#!/bin/bash
#==============================================================================
# سكريبت التحديث السريع عبر Git — Quick Git Update
# Usage: bash scripts/git-deploy.sh [commit message]
#==============================================================================
# يُستخدم بعد إجراء تعديلات محلياً لنشرها بسرعة عبر Git.
#
# المتطلبات:
#   - Git مثبّت محلياً وعلى السيرفر
#   - مستودع GitHub/GitLab مُعد مسبقاً
#   - السيرفر يستخرج من نفس المستودع
#==============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/home/z/my-project"
cd "$PROJECT_DIR"

COMMIT_MSG="${1:-feat: update AI assistant module $(date +%Y-%m-%d)}"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  النشر السريع عبر Git${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# التحقق من Git
if ! command -v git &> /dev/null; then
  echo -e "${RED}❌ Git غير مثبّت${NC}"
  exit 1
fi

# التحقق من وجود مستودع Git
if [ ! -d ".git" ]; then
  echo -e "${YELLOW}⚠️  لا يوجد مستودع Git بعد. سأُنشئه الآن...${NC}"
  git init
  git branch -M main
  echo -e "${GREEN}  ✓ تم إنشاء مستودع Git${NC}"
  echo ""
  echo -e "${YELLOW}أضف مستودع بعيد:${NC}"
  echo -e "  ${BLUE}git remote add origin https://github.com/your-username/school-management.git${NC}"
  echo -e "${YELLOW}ثم أعد تشغيل هذا السكريبت${NC}"
  exit 0
fi

# التحقق من المستودع البعيد
if ! git remote -v | grep -q origin; then
  echo -e "${RED}❌ لا يوجد مستودع بعيد (origin)${NC}"
  echo -e "${YELLOW}أضفه:${NC}"
  echo -e "  ${BLUE}git remote add origin https://github.com/your-username/school-management.git${NC}"
  exit 1
fi

echo -e "${BLUE}[1/4] فحص التغييرات...${NC}"
git status -s
echo ""

echo -e "${BLUE}[2/4] إضافة كل التغييرات...${NC}"
git add .
echo -e "${GREEN}  ✓ تمت الإضافة${NC}"
echo ""

echo -e "${BLUE}[3/4] إنشاء commit...${NC}"
git commit -m "$COMMIT_MSG"
echo -e "${GREEN}  ✓ commit: $COMMIT_MSG${NC}"
echo ""

echo -e "${BLUE}[4/4] الرفع إلى المستودع البعيد...${NC}"
git push origin main
echo -e "${GREEN}  ✓ تم الرفع${NC}"
echo ""

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  ✅ تم النشر إلى المستودع!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${YELLOW}الخطوات على السيرفر:${NC}"
echo -e "  ${BLUE}cd /path/to/school-management${NC}"
echo -e "  ${BLUE}git pull origin main${NC}"
echo -e "  ${BLUE}npm install${NC}  ${YELLOW}# إن تغيّرت الاعتماديات${NC}"
echo -e "  ${BLUE}npx prisma db push${NC}  ${YELLOW}# إن تغيّر الـ schema${NC}"
echo -e "  ${BLUE}npm run build${NC}"
echo -e "  ${BLUE}pm2 restart school-management${NC}"
echo ""
echo -e "أو ببساطة:"
echo -e "  ${BLUE}bash scripts/server-update.sh${NC}"
echo ""
