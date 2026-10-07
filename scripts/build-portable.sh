#!/bin/bash
# ============================================================
# build-portable.sh — يبني حزمة قابلة للنقل لأجهزة Windows
# ============================================================
# ينشئ مجلد school-management-portable/ يحتوي على:
# - Node.js portable (node.exe لـ Windows)
# - Next.js standalone build
# - Prisma schema + DB فارغة
# - install.bat + start-school.bat
# - public/uploads/
#
# الاستخدام:
#   chmod +x scripts/build-portable.sh
#   ./scripts/build-portable.sh
#
# النتيجة: school-management-portable.zip جاهز للتوزيع
# ============================================================

set -e

echo "🏗️  بناء الحزمة المحمولة لنظام إدارة المؤسسة التعليمية..."
echo ""

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# ===== 1. بناء Next.js =====
echo "📦 [1/6] بناء Next.js (standalone)..."
npm run build

# ===== 2. إنشاء مجلد الحزمة =====
echo "📁 [2/6] إنشاء مجلد الحزمة..."
PORTABLE_DIR="$PROJECT_ROOT/school-management-portable"
rm -rf "$PORTABLE_DIR"
mkdir -p "$PORTABLE_DIR"

# ===== 3. نسخ ملفات Next.js standalone =====
echo "📋 [3/6] نسخ ملفات التطبيق..."
mkdir -p "$PORTABLE_DIR/.next"
cp -r .next/standalone/* "$PORTABLE_DIR/"
cp -r .next/static "$PORTABLE_DIR/.next/static"
cp -r public "$PORTABLE_DIR/public"

# ===== 4. نسخ Prisma + إنشاء DB =====
echo "🗄️ [4/6] نسخ Prisma..."
mkdir -p "$PORTABLE_DIR/prisma"
cp prisma/schema.prisma "$PORTABLE_DIR/prisma/"
mkdir -p "$PORTABLE_DIR/db"

# ===== 5. نسخ السكربتات =====
echo "⚙️ [5/6] نسخ سكربتات التثبيت والتشغيل..."
cp scripts/install.bat "$PORTABLE_DIR/"
cp scripts/start-school.bat "$PORTABLE_DIR/"
cp scripts/uninstall.bat "$PORTABLE_DIR/"

# ===== 6. تحميل Node.js portable لـ Windows =====
echo "📥 [6/6] تحميل Node.js portable لـ Windows..."
NODE_VERSION="v20.11.1"
NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-win-x64.zip"
NODE_ZIP="/tmp/node-win.zip"

if [ ! -f "$NODE_ZIP" ]; then
  echo "   تحميل Node.js ${NODE_VERSION} لـ Windows..."
  curl -L -o "$NODE_ZIP" "$NODE_URL"
fi

echo "   استخراج node.exe..."
mkdir -p /tmp/node-extract
unzip -o -q "$NODE_ZIP" -d /tmp/node-extract
NODE_DIR=$(ls /tmp/node-extract | grep "node-v" | head -1)
mkdir -p "$PORTABLE_DIR/node"
cp /tmp/node-extract/$NODE_DIR/node.exe "$PORTABLE_DIR/node/"
# نسخ الملفات الضرورية لتشغيل node
cp /tmp/node-extract/$NODE_DIR/*.dll "$PORTABLE_DIR/node/" 2>/dev/null || true

# تنظيف
rm -rf /tmp/node-extract

# ===== إنشاء ملف README =====
cat > "$PORTABLE_DIR/README-INSTALL.txt" << 'README'
============================================================
  نظام إدارة المؤسسة التعليمية — التثبيت
============================================================

طريقة التثبيت (3 خطوات):
1. انسخ هذا المجلد بالكامل إلى القرص C (أو أي مكان ثابت)
   مثال: C:\SchoolManagement\
2. اضغط يميناً على install.bat ← "تشغيل كمسؤول"
3. انتظر حتى ينتهي التثبيت — سيفتح المتصفح تلقائياً

بعد التثبيت:
- التطبيق يعمل تلقائياً عند تشغيل Windows
- اختصار على سطح المكتب: "نظام إدارة المؤسسة"
- الوصول من الأجهزة الأخرى: http://[IP-الجهاز]:3000

للتشغيل اليدوي:
- اضغط مرتين على start-school.bat

لإلغاء التثبيت:
- اضغط يميناً على uninstall.bat ← "تشغيل كمسؤول"

بيانات الدخول الافتراضية:
- المدير: admin / admin123
- الموظف: employee / emp123
(غيّر كلمات المرور بعد أول دخول!)
README

# ===== ضغط الحزمة =====
echo ""
echo "🗜️  ضغط الحزمة..."
cd "$PROJECT_ROOT"
zip -r school-management-portable.zip school-management-portable/ -q

# ===== معلومات النهاية =====
SIZE=$(du -sh school-management-portable.zip | cut -f1)
echo ""
echo "✅ تم إنشاء الحزمة بنجاح!"
echo ""
echo "📁 المجلد: school-management-portable/"
echo "📦 الملف المضغوط: school-management-portable.zip ($SIZE)"
echo ""
echo "📋 الخطوات التالية:"
echo "   1. انسخ school-management-portable.zip إلى جهاز Windows"
echo "   2. استخرج الملف في C:\ (أو أي مكان ثابت)"
echo "   3. اضغط يميناً على install.bat ← 'تشغيل كمسؤول'"
echo "   4. انتظر — سيفتح المتصفح تلقائياً"
echo ""
echo "🌐 للتوزيع على الفروع:"
echo "   - انسخ school-management-portable.zip لكل فرع"
echo "   - كل فرع يثبّته على جهازه"
echo "   - كل فرع سيكون له قاعدة بيانات مستقلة"
echo ""
