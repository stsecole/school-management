#!/bin/bash
# سكريبت بدء التشغيل لنظام إدارة المؤسسة التعليمية
# يعمل على أي جهاز بعد تثبيت Bun

set -e

echo "============================================"
echo "  نظام إدارة المؤسسة التعليمية - بدء التشغيل"
echo "============================================"
echo ""

# التأكد من وجود مجلد db
mkdir -p db

# تحقق من وجود Prisma client
if [ ! -d "node_modules/.prisma" ]; then
  echo "[1/4] توليد Prisma client..."
  bunx prisma generate
else
  echo "[1/4] ✓ Prisma client موجود"
fi

# تحقق من وجود قاعدة البيانات
if [ ! -f "db/custom.db" ]; then
  echo "[2/4] إنشاء قاعدة البيانات..."
  bunx prisma db push --accept-data-loss
else
  echo "[2/4] ✓ قاعدة البيانات موجودة"
fi

# تحقق من وجود مستخدم admin
echo "[3/4] التحقق من المستخدم الافتراضي..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const exists = await prisma.user.findFirst({ where: { role: 'director' } });
  if (!exists) {
    await prisma.user.create({
      data: {
        username: 'admin',
        password: 'admin123',
        name: 'المدير',
        role: 'director',
        canManageTimetable: true
      }
    });
    await prisma.setting.upsert({
      where: { key: 'finance_password' },
      update: {},
      create: { key: 'finance_password', value: 'admin123' }
    });
    console.log('  ✓ تم إنشاء مستخدم المدير (admin / admin123)');
  } else {
    console.log('  ✓ مستخدم المدير موجود');
  }
}
main().catch(console.error).finally(() => prisma.\$disconnect());
" 2>/dev/null || echo "  ⚠ تخطي فحص المستخدم"

# تشغيل التطبيق
echo "[4/4] تشغيل التطبيق..."
echo ""
echo "============================================"
echo "  التطبيق سيعمل على: http://localhost:3000"
echo "  المدير: admin / admin123"
echo "  كلمة مرور القسم المالي: admin123"
echo "============================================"
echo ""

# تشغيل
if [ -d ".next/standalone" ]; then
  cd .next/standalone
  node server.js
else
  echo "❌ المشروع غير مبني. شغّل: bun run build"
  exit 1
fi
