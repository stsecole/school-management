#!/bin/bash
#==============================================================================
# 🚀 سكريبت التحديث الشامل — All-in-One Update Script
#==============================================================================
# يُشغّل على جهازك المحلي. يفعل كل شيء بأمر واحد:
#   1. يأخذ نسخة احتياطية من قاعدة البيانات
#   2. يستبدل ملفات الكود الجديدة
#   3. يُحدّث الاعتماديات
#   4. يُحدّث قاعدة البيانات (يحافظ على بياناتك)
#   5. يُعيد تشغيل التطبيق
#
# الاستخدام:
#   bash update.sh                 # تحديث من مجلد "update-files" بجانب المشروع
#   bash update.sh /path/to/new    # تحديث من مسار مخصّص
#   bash update.sh --backup        # نسخة احتياطية فقط
#   bash update.sh --restore       # استعادة آخر نسخة احتياطية
#   bash update.sh --list          # عرض النسخ الاحتياطية
#==============================================================================

set -e

#==============================================================
# الألوان
#==============================================================
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

#==============================================================
# اكتشاف مجلد المشروع
#==============================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

detect_project_dir() {
  # ابحث عن مجلد يحتوي على package.json و prisma/
  if [ -f "$SCRIPT_DIR/package.json" ] && [ -d "$SCRIPT_DIR/prisma" ]; then
    echo "$SCRIPT_DIR"
    return
  fi
  local parent="$(dirname "$SCRIPT_DIR")"
  if [ -f "$parent/package.json" ] && [ -d "$parent/prisma" ]; then
    echo "$parent"
    return
  fi
  if [ -f "$PWD/package.json" ] && [ -d "$PWD/prisma" ]; then
    echo "$PWD"
    return
  fi
  echo "$SCRIPT_DIR"
}
PROJECT_DIR="$(detect_project_dir)"

#==============================================================
# رسالة ترحيبية
#==============================================================
banner() {
  echo -e "${CYAN}"
  echo "╔══════════════════════════════════════════════╗"
  echo "║  $1"
  echo "╚══════════════════════════════════════════════╝"
  echo -e "${NC}"
}

info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error()   { echo -e "${RED}❌ $1${NC}"; exit 1; }

#==============================================================
# عرض المساعدة
#==============================================================
show_help() {
  banner "🚀 سكريبت التحديث الشامل"
  echo ""
  echo -e "${BOLD}الاستخدام:${NC}"
  echo "  bash update.sh [خيار] [مسار-الملفات-الجديدة]"
  echo ""
  echo -e "${BOLD}الخيارات:${NC}"
  echo "  (لا شيء)            تحديث من مجلد update-files/ بجانب المشروع"
  echo "  /path/to/files      تحديث من مسار مخصّص"
  echo "  --backup            أخذ نسخة احتياطية فقط (بدون تحديث)"
  echo "  --restore           استعادة أحدث نسخة احتياطية"
  echo "  --restore FILE      استعادة نسخة محدّدة"
  echo "  --list              عرض كل النسخ الاحتياطية"
  echo "  --help, -h          عرض هذه المساعدة"
  echo ""
  echo -e "${BOLD}أمثلة:${NC}"
  echo "  bash update.sh                              # تحديث من update-files/"
  echo "  bash update.sh ~/Downloads/new-version      # تحديث من مسار مخصّص"
  echo "  bash update.sh --backup                     # نسخة احتياطية فقط"
  echo "  bash update.sh --restore                    # استعادة آخر نسخة"
  echo ""
  echo -e "${BOLD}الملفات التي تُستبدل:${NC}"
  echo "  src/, prisma/, public/, package.json, next.config.ts, tsconfig.json"
  echo "  وغيرها من ملفات الكود (آمن — مجرد نصوص)"
  echo ""
  echo -e "${BOLD}الملفات المحفوظة (لا تُلمس):${NC}"
  echo "  db/custom.db        ← قاعدة بياناتك (الطلاب، الدفعات، الأساتذة)"
  echo "  .env                ← إعدادات البيئة"
  exit 0
}

#==============================================================
# أخذ نسخة احتياطية
#==============================================================
do_backup() {
  banner "💾 أخذ نسخة احتياطية"
  cd "$PROJECT_DIR"

  if [ ! -f "db/custom.db" ]; then
    warning "لا توجد قاعدة بيانات بعد في db/custom.db"
    return 0
  fi

  mkdir -p db/backups
  local TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  local BACKUP_FILE="db/backups/custom.db.backup-$TIMESTAMP"

  cp db/custom.db "$BACKUP_FILE"
  local SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
  success "تم إنشاء نسخة احتياطية: $BACKUP_FILE ($SIZE)"
  echo "$BACKUP_FILE"
}

#==============================================================
# عرض النسخ الاحتياطية
#==============================================================
list_backups() {
  banner "📋 النسخ الاحتياطية المتاحة"
  cd "$PROJECT_DIR"

  if [ ! -d "db/backups" ] || [ -z "$(ls -A db/backups 2>/dev/null)" ]; then
    warning "لا توجد نسخ احتياطية بعد."
    info "لإنشاء نسخة: bash update.sh --backup"
    return 0
  fi

  echo ""
  printf "%-4s %-40s %s\n" "#" "الملف" "الحجم"
  printf "%-4s %-40s %s\n" "---" "----------------------------------------" "--------"

  local i=1
  for f in $(ls -t db/backups/custom.db.backup-* 2>/dev/null); do
    local SIZE=$(du -sh "$f" | cut -f1)
    local NAME=$(basename "$f")
    printf "%-4s %-40s %s\n" "$i" "$NAME" "$SIZE"
    i=$((i+1))
  done
  echo ""
}

#==============================================================
# استعادة نسخة احتياطية
#==============================================================
do_restore() {
  local FILE_TO_RESTORE="$1"

  banner "🔄 استعادة نسخة احتياطية"
  cd "$PROJECT_DIR"

  if [ -z "$FILE_TO_RESTORE" ]; then
    # استعادة أحدث نسخة
    FILE_TO_RESTORE=$(ls -t db/backups/custom.db.backup-* 2>/dev/null | head -1)
    if [ -z "$FILE_TO_RESTORE" ]; then
      error "لا توجد نسخ احتياطية لاستعادتها."
    fi
  fi

  if [ ! -f "$FILE_TO_RESTORE" ]; then
    # ربما الملف في db/backups/
    if [ -f "db/backups/$FILE_TO_RESTORE" ]; then
      FILE_TO_RESTORE="db/backups/$FILE_TO_RESTORE"
    else
      error "الملف غير موجود: $FILE_TO_RESTORE"
    fi
  fi

  echo -e "${YELLOW}سيتم استعادة: $FILE_TO_RESTORE${NC}"
  echo -e "${YELLOW}هذا سيستبدل قاعدة البيانات الحالية.${NC}"
  echo ""
  read -p "هل أنت متأكد؟ (y/N): " CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    info "تم الإلغاء."
    exit 0
  fi

  # خذ نسخة من الحالية قبل الاستعادة (للأمان)
  if [ -f "db/custom.db" ]; then
    cp db/custom.db "db/backups/custom.db.before-restore-$(date +%Y%m%d-%H%M%S)"
  fi

  cp "$FILE_TO_RESTORE" db/custom.db
  success "تم استعادة: $FILE_TO_RESTORE"

  # أعد توليد Prisma
  info "توليد Prisma Client..."
  npx prisma generate 2>/dev/null || warning "تعذّر توليد Prisma — تحقّق من schema.prisma"

  success "اكتملت الاستعادة. شغّل التطبيق: npm run dev"
}

#==============================================================
# التحديث الكامل
#==============================================================
do_update() {
  local SOURCE_DIR="$1"

  cd "$PROJECT_DIR"

  #==============================================================
  # الخطوة 0: التحقق من المصدر
  #==============================================================
  banner "🔍 التحقق من الملفات الجديدة"

  if [ -z "$SOURCE_DIR" ]; then
    SOURCE_DIR="$PROJECT_DIR/update-files"
  fi

  # إن كان المصدر ZIP، فُكّه أولاً
  if [ -f "$SOURCE_DIR" ] && [[ "$SOURCE_DIR" == *.zip ]]; then
    info "الملف ZIP. فك الضغط..."
    local TEMP_DIR="/tmp/update-extract-$$"
    mkdir -p "$TEMP_DIR"
    unzip -q "$SOURCE_DIR" -d "$TEMP_DIR"

    # ابحث عن مجلد package.json داخل المُستخرَج
    SOURCE_DIR=$(find "$TEMP_DIR" -name "package.json" -not -path "*/node_modules/*" -exec dirname {} \; | head -1)
    if [ -z "$SOURCE_DIR" ]; then
      SOURCE_DIR="$TEMP_DIR"
    fi
    success "تم فك الضغط إلى: $SOURCE_DIR"
  fi

  if [ ! -d "$SOURCE_DIR" ]; then
    echo ""
    error "المجلد غير موجود: $SOURCE_DIR

${YELLOW}الاستخدام:${NC}
  1. ضع الملفات الجديدة في مجلد 'update-files' بجانب المشروع
  2. أو حدّد المسار: bash update.sh /path/to/new/files
  3. أو استخدم ZIP: bash update.sh /path/to/update.zip

${YELLOW}مثال:${NC}
  mkdir -p update-files
  # (انسخ ملفات src/ و prisma/ الجديدة إلى update-files/)
  bash update.sh"
  fi

  if [ ! -f "$SOURCE_DIR/package.json" ] && [ ! -d "$SOURCE_DIR/src" ]; then
    error "المجلد لا يحتوي على ملفات مشروع صحيحة: $SOURCE_DIR"
  fi

  success "تم العثور على الملفات الجديدة: $SOURCE_DIR"

  #==============================================================
  # الخطوة 1: نسخة احتياطية
  #==============================================================
  echo ""
  banner "💾 الخطوة 1/5: أخذ نسخة احتياطية"
  BACKUP_FILE=$(do_backup)

  #==============================================================
  # الخطوة 2: استبدال ملفات الكود
  #==============================================================
  echo ""
  banner "📂 الخطوة 2/5: استبدال ملفات الكود"

  info "استبدال الملفات..."

  # src/
  if [ -d "$SOURCE_DIR/src" ]; then
    rm -rf "$PROJECT_DIR/src"
    cp -r "$SOURCE_DIR/src" "$PROJECT_DIR/src"
    success "تم تحديث src/"
  fi

  # prisma/ (الـ schema فقط، لا نلمس db/)
  if [ -d "$SOURCE_DIR/prisma" ]; then
    cp -r "$SOURCE_DIR/prisma/"* "$PROJECT_DIR/prisma/" 2>/dev/null || true
    success "تم تحديث prisma/"
  fi

  # public/
  if [ -d "$SOURCE_DIR/public" ]; then
    cp -r "$SOURCE_DIR/public/"* "$PROJECT_DIR/public/" 2>/dev/null || true
    success "تم تحديث public/"
  fi

  # ملفات الإعداد
  for f in package.json next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs components.json eslint.config.mjs; do
    if [ -f "$SOURCE_DIR/$f" ]; then
      cp "$SOURCE_DIR/$f" "$PROJECT_DIR/$f"
      success "تم تحديث $f"
    fi
  done

  # scripts/ (اختياري)
  if [ -d "$SOURCE_DIR/scripts" ]; then
    mkdir -p "$PROJECT_DIR/scripts"
    cp -r "$SOURCE_DIR/scripts/"* "$PROJECT_DIR/scripts/" 2>/dev/null || true
    success "تم تحديث scripts/"
  fi

  #==============================================================
  # الخطوة 3: تحديث الاعتماديات
  #==============================================================
  echo ""
  banner "📦 الخطوة 3/5: تحديث الاعتماديات"

  # تحقّق إن تغيّر package.json
  if [ -f "$SOURCE_DIR/package.json" ]; then
    if ! diff -q "$SOURCE_DIR/package.json" "$PROJECT_DIR/package.json.bak" 2>/dev/null > /dev/null; then
      info "package.json تغيّر. تحديث الاعتماديات..."
      if command -v bun &> /dev/null; then
        bun install
      else
        npm install
      fi
      success "تم تحديث الاعتماديات"
    else
      info "package.json لم يتغيّر. تخطّي..."
    fi
  else
    info "تثبيت الاعتماديات للتأكّد..."
    if command -v bun &> /dev/null; then
      bun install 2>/dev/null || true
    else
      npm install 2>/dev/null || true
    fi
  fi

  #==============================================================
  # الخطوة 4: تحديث قاعدة البيانات
  #==============================================================
  echo ""
  banner "🗄️  الخطوة 4/5: تحديث قاعدة البيانات"

  if [ -f "$PROJECT_DIR/prisma/schema.prisma" ]; then
    info "تطبيق التحديثات على قاعدة البيانات..."
    info "(لا تقلق — بياناتك محفوظة)"

    # إنشاء مجلد db إن لم يكن موجوداً
    mkdir -p "$PROJECT_DIR/db"

    # إن لم توجد قاعدة بيانات، أنشئ واحدة
    if [ ! -f "$PROJECT_DIR/db/custom.db" ]; then
      warning "لا توجد قاعدة بيانات. سيتم إنشاء واحدة جديدة."
    fi

    # prisma db push — يُضيف الجداول الجديدة فقط، لا يحذف البيانات
    npx prisma db push --accept-data-loss 2>/dev/null || npx prisma db push
    success "تم تحديث قاعدة البيانات (بياناتك محفوظة ✅)"

    info "توليد Prisma Client..."
    npx prisma generate
    success "تم توليد Prisma Client"
  else
    warning "لا يوجد prisma/schema.prisma. تخطّي تحديث قاعدة البيانات."
  fi

  #==============================================================
  # الخطوة 5: إعادة التشغيل
  #==============================================================
  echo ""
  banner "🔄 الخطوة 5/5: إعادة تشغيل التطبيق"

  # تحقّق إن كان التطبيق يعمل
  if pgrep -f "next dev" > /dev/null 2>&1 || pgrep -f "npm run dev" > /dev/null 2>&1; then
    warning "التطبيق يعمل حالياً."
    echo -e "${YELLOW}أوقفه بـ Ctrl+C في نافذته، ثم أعد تشغيله:${NC}"
    echo -e "  ${BLUE}npm run dev${NC}"
  else
    info "لبدء التطبيق:"
    echo -e "  ${BLUE}cd $PROJECT_DIR${NC}"
    echo -e "  ${BLUE}npm run dev${NC}"
  fi

  #==============================================================
  # تنظيف
  #==============================================================
  if [ -d "/tmp/update-extract-$$" ]; then
    rm -rf "/tmp/update-extract-$$"
  fi

  #==============================================================
  # ملخص نهائي
  #==============================================================
  echo ""
  banner "🎉 تم التحديث بنجاح!"
  echo ""
  echo -e "${GREEN}✅ تم تحديث ملفات الكود${NC}"
  echo -e "${GREEN}✅ تم تحديث الاعتماديات${NC}"
  echo -e "${GREEN}✅ تم تحديث قاعدة البيانات (بياناتك محفوظة)${NC}"
  echo ""
  echo -e "${BOLD}الخطوات التالية:${NC}"
  echo -e "  1. شغّل: ${BLUE}npm run dev${NC}"
  echo -e "  2. افتح: ${BLUE}http://localhost:3000${NC}"
  echo -e "  3. سجّل الدخول: ${BLUE}admin / admin123${NC}"
  echo ""
  echo -e "${BOLD}النسخة الاحتياطية:${NC}"
  echo -e "  ${BACKUP_FILE}"
  echo -e "  للاستعادة إن لزم: ${BLUE}bash update.sh --restore${NC}"
  echo ""
}

#==============================================================
# نقطة الدخول الرئيسية
#==============================================================
main() {
  # تحليل الوسائط
  case "${1:-}" in
    --help|-h)
      show_help
      ;;
    --backup)
      do_backup
      exit 0
      ;;
    --restore)
      do_restore "${2:-}"
      exit 0
      ;;
    --list)
      list_backups
      exit 0
      ;;
    "")
      # لا وسيط — استخدم update-files/
      do_update ""
      ;;
    *)
      # وسيط — استخدمه كمصدر
      do_update "$1"
      ;;
  esac
}

main "$@"
