# دليل النشر - نظام إدارة المؤسسة التعليمية

## الطريقة 1: Docker (موصى بها)

```bash
# بناء وتشغيل
docker-compose up -d --build

# التطبيق سيعمل على http://localhost:3000
# تسجيل الدخول: admin / admin123
```

## الطريقة 2: Vercel

```bash
# تثبيت Vercel CLI
npm i -g vercel

# نشر
vercel --prod
```

## الطريقة 3: Netlify

```bash
# تثبيت Netlify CLI
npm i -g netlify-cli

# نشر
netlify deploy --prod --dir=.next
```

## الطريقة 4: خادم VPS

```bash
# تثبيت الحزم
bun install

# توليد Prisma
bunx prisma generate
bunx prisma db push --accept-data-loss

# بناء
bun run build

# تشغيل
bun run start
```

## بيانات الدخول الافتراضية
- **المدير:** admin / admin123
- **كلمة مرور القسم المالي:** admin123

## ملاحظات
- قاعدة البيانات: SQLite (تُنشأ تلقائياً)
- المنفذ: 3000
- اللغة: العربية (RTL)
