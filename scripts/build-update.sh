#!/bin/bash
# ============================================================
# build-update.sh — يبني حزمة تحديث فقط (بدون Node.js وبدون DB)
# ============================================================
# الفرق بين build-portable.sh و build-update.sh:
# - build-portable.sh: حزمة كاملة (80 MB) — للتثبيت الأول
# - build-update.sh: حزمة تحديث (~10-20 MB) — لتحديث فرع موجود
#
# الاستخدام:
#   chmod +x scripts/build-update.sh
#   ./scripts/build-update.sh
#
# النتيجة: school-management-update.zip جاهز للتوزيع
# ============================================================

set -e

echo "🔄 بناء حزمة التحديث لنظام إدارة المؤسسة التعليمية..."
echo ""

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# ===== 1. بناء Next.js =====
echo "📦 [1/4] بناء Next.js (standalone)..."
npm run build

# ===== 2. إنشاء مجلد التحديث =====
echo "📁 [2/4] إنشاء مجلد التحديث..."
UPDATE_DIR="$PROJECT_ROOT/school-management-update"
rm -rf "$UPDATE_DIR"
mkdir -p "$UPDATE_DIR/.next"
mkdir -p "$UPDATE_DIR/prisma"
mkdir -p "$UPDATE_DIR/public"

# ===== 3. نسخ الملفات المحدّثة فقط =====
echo "📋 [3/4] نسخ الملفات المحدّثة..."

# نسخ Next.js standalone (التطبيق + server.js)
cp -r .next/standalone/* "$UPDATE_DIR/"

# ===== تنظيف الملفات غير الضرورية من standalone =====
# Next.js file tracing ينسخ مجلدات من جذر المشروع لا يحتاجها التطبيق
echo "🧹 تنظيف الملفات غير الضرورية..."

# حذف مجلدات المشروع التي لا يحتاجها وقت التشغيل
rm -rf "$UPDATE_DIR/download"               # مجلد التنزيلات (169M)
rm -rf "$UPDATE_DIR/skills"                 # مجلد المهارات (61M)
rm -rf "$UPDATE_DIR/src"                    # الكود المصدري (لا يُستخدم وقت التشغيل)
rm -rf "$UPDATE_DIR/tool-results"           # نتائج الأدوات
rm -rf "$UPDATE_DIR/agent-ctx"              # سياق الوكلاء
rm -rf "$UPDATE_DIR/examples"               # أمثلة
rm -rf "$UPDATE_DIR/inspect_deep.py"        # سكربتات فحص
rm -rf "$UPDATE_DIR/inspect_xlsx.py"
rm -rf "$UPDATE_DIR/image_analysis.json"    # ملفات JSON عشوائية
rm -rf "$UPDATE_DIR/image_analysis2.json"
rm -rf "$UPDATE_DIR/school-management-portable"      # حزمة قديمة
rm -rf "$UPDATE_DIR/school-management-portable.zip"  # حزمة قديمة
rm -rf "$UPDATE_DIR/school-management-update"        # مجلد التحديث القديم (recursive)
rm -rf "$UPDATE_DIR/school-management-update.zip"    # حزمة قديمة
rm -rf "$UPDATE_DIR/Caddyfile"              # ملفات خوادم Linux
rm -rf "$UPDATE_DIR/Dockerfile"            # Docker
rm -rf "$UPDATE_DIR/docker-compose.yml"
rm -rf "$UPDATE_DIR/DEPLOY.md" "$UPDATE_DIR/DEPLOY-GUIDE.md" "$UPDATE_DIR/HOSTING-GUIDE.md"
rm -rf "$UPDATE_DIR/eslint.config.mjs"      # ESLint (لا يُستخدم وقت التشغيل)
rm -rf "$UPDATE_DIR/bun.lock"               # ملفات قفل الحزم
rm -rf "$UPDATE_DIR/package-lock.json"
rm -rf "$UPDATE_DIR/components.json"        # إعدادات shadcn (للتطوير فقط)
rm -rf "$UPDATE_DIR/tsconfig.json"          # TypeScript config (للتطوير فقط)

# نسخ static files
cp -r .next/static "$UPDATE_DIR/.next/static"

# نسخ public (بدون custom.db الموجودة في public)
cp -r public/* "$UPDATE_DIR/public/" 2>/dev/null || true
rm -f "$UPDATE_DIR/public/custom.db" 2>/dev/null
rm -f "$UPDATE_DIR/public/public/custom.db" 2>/dev/null

# نسخ Prisma schema (للتحديثات على قاعدة البيانات)
cp prisma/schema.prisma "$UPDATE_DIR/prisma/"

# ===== تنظيف node_modules لتقليل الحجم =====
echo "🪶 تخفيف node_modules..."

# حذف binaries لـ sharp على Linux/Musl (نحتاج Windows فقط)
rm -rf "$UPDATE_DIR/node_modules/@img/sharp-linux-x64"
rm -rf "$UPDATE_DIR/node_modules/@img/sharp-linuxmusl-x64"
rm -rf "$UPDATE_DIR/node_modules/@img/sharp-libvips-linux-x64"
rm -rf "$UPDATE_DIR/node_modules/@img/sharp-libvips-linuxmusl-x64"
rm -rf "$UPDATE_DIR/node_modules/@img/sharp-darwin-x64"
rm -rf "$UPDATE_DIR/node_modules/@img/sharp-darwin-arm64"
# احتفظ بـ: @img/sharp-win32-x64 و @img/sharp-win32-ia32 و @img/sharp-libvips-win32-x64

# حذف typescript (20M، لا يُستخدم وقت التشغيل)
rm -rf "$UPDATE_DIR/node_modules/typescript"

# حذف @types (تعريفات الأنواع للتطوير فقط)
rm -rf "$UPDATE_DIR/node_modules/@types" 2>/dev/null

# حذف Prisma engine binaries لأنظمة لا نستخدمها (Linux/Darwin)
# نحتفظ بـ: libquery_engine-windows-* (نعمل على Windows)
# نحذف: libquery_engine-debian-* و libquery_engine-darwin-* و libquery_engine-linux-arm64-* إلخ
find "$UPDATE_DIR/node_modules/.prisma/client/" -name "libquery_engine-debian-*" -delete 2>/dev/null
find "$UPDATE_DIR/node_modules/.prisma/client/" -name "libquery_engine-darwin-*" -delete 2>/dev/null
find "$UPDATE_DIR/node_modules/.prisma/client/" -name "libquery_engine-linux-arm64-*" -delete 2>/dev/null
find "$UPDATE_DIR/node_modules/.prisma/client/" -name "libquery_engine-rhel-*" -delete 2>/dev/null
find "$UPDATE_DIR/node_modules/.prisma/client/" -name "libquery_engine-arm-*" -delete 2>/dev/null

# حذف WASM engines لقواعد بيانات لا نستخدمها (نستخدم SQLite فقط)
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_engine_bg.cockroachdb.wasm-base64.js"
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_engine_bg.cockroachdb.wasm-base64.mjs"
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_engine_bg.postgresql.wasm-base64.js"
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_engine_bg.postgresql.wasm-base64.mjs"
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_engine_bg.mysql.wasm-base64.js"
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_engine_bg.mysql.wasm-base64.mjs"
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_engine_bg.sqlserver.wasm-base64.js"
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_engine_bg.sqlserver.wasm-base64.mjs"
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_compiler_bg.cockroachdb.wasm-base64.js"
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_compiler_bg.cockroachdb.wasm-base64.mjs"
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_compiler_bg.postgresql.wasm-base64.js"
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_compiler_bg.postgresql.wasm-base64.mjs"
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_compiler_bg.mysql.wasm-base64.js"
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_compiler_bg.mysql.wasm-base64.mjs"
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_compiler_bg.sqlserver.wasm-base64.js"
rm -f "$UPDATE_DIR/node_modules/@prisma/client/runtime/query_compiler_bg.sqlserver.wasm-base64.mjs"
# احتفظ بـ: query_engine_bg.sqlite.wasm-base64.* و query_compiler_bg.sqlite.wasm-base64.*

# حذف upload/ (مجلد رفع المستخدمين — لا يُنشر مع التحديث)
rm -rf "$UPDATE_DIR/upload"

# حذف ملفات النشر القديمة من public (تحفظاتها من الإصدارات السابقة)
rm -rf "$UPDATE_DIR/public/downloads"
rm -f "$UPDATE_DIR/public/school-deploy.zip"
rm -f "$UPDATE_DIR/public/school-php.zip"
rm -f "$UPDATE_DIR/public/school-php.tar.gz"

# نسخ سكربت التحديث
cp scripts/update-branch.bat "$UPDATE_DIR/"

# إنشاء ملف معلومات التحديث
cat > "$UPDATE_DIR/UPDATE-INFO.txt" << 'INFO'
============================================================
  حزمة تحديث نظام إدارة المؤسسة التعليمية
============================================================

هذه الحزمة تحدّث التطبيق فقط WITHOUT لمس قاعدة البيانات.

طريقة التحديث:
1. استخرج هذا الملف في مجلد مؤقت
2. انسخ كل محتوياته إلى C:\SchoolManagement\ (استبدال الموجود)
3. اضغط يميناً على update-branch.bat ← "تشغيل كمسؤول"
4. أعد تشغيل التطبيق (أو أعد تشغيل الجهاز)

ماذا يُحدَّث:
- ✅ كود التطبيق (.next/)
- ✅ الملفات العامة (public/)
- ✅ Prisma schema (إذا تغيّر)
- ❌ لا يمس قاعدة البيانات (db/custom.db)
- ❌ لا يمس النسخ الاحتياطية (download/backups/)
- ❌ لا يمس إعدادات السحابة

إذا تغيّر schema (حقول جديدة):
- سيقوم update-branch.bat بتشغيل prisma db push تلقائياً
- هذا يضيف الحقول الجديدة WITHOUT فقدان البيانات
INFO

# ===== 4. ضغط الحزمة =====
echo "🗜️ [4/4] ضغط الحزمة..."
cd "$PROJECT_ROOT"
rm -f school-management-update.zip
zip -r school-management-update.zip school-management-update/ -q

# ===== معلومات النهاية =====
SIZE=$(du -sh school-management-update.zip | cut -f1)
echo ""
echo "✅ تم إنشاء حزمة التحديث بنجاح!"
echo ""
echo "📦 الملف: school-management-update.zip ($SIZE)"
echo ""
echo "📋 الخطوات التالية:"
echo "   1. انسخ school-management-update.zip إلى جهاز الفرع"
echo "   2. استخرج الملف في مكان مؤقت"
echo "   3. انسخ المحتويات إلى C:\SchoolManagement\ (استبدال)"
echo "   4. اضغط يميناً على update-branch.bat ← 'تشغيل كمسؤول'"
echo "   5. أعد تشغيل التطبيق"
echo ""
echo "⚠ آمن: لا يمس قاعدة البيانات ولا النسخ الاحتياطية"
echo ""
