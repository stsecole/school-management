# دليل النشر الكامل - نظام إدارة المؤسسة التعليمية

## 📋 المتطلبات
- Node.js 18+ أو Bun
- Git (لنسخ المشروع)

---

## 🖥️ الطريقة 1: التشغيل على جهازك الشخصي (Windows/Mac/Linux)

### الخطوة 1: تحميل المشروع
```bash
# انسخ مجلد المشروع كاملاً إلى جهازك
# إذا كان على GitHub:
git clone <رابط-المستودع>
cd school-management

# أو انسخ المجلد يدوياً (بدون node_modules و .next)
```

### الخطوة 2: تثبيت Bun (موصى به)
```bash
# على Mac/Linux:
curl -fsSL https://bun.sh/install | bash

# على Windows (PowerShell):
powershell -c "irm bun.sh/install.ps1 | iex"

# أو استخدم npm بدلاً من bun:
npm install
```

### الخطوة 3: تثبيت الحزم
```bash
bun install
# أو
npm install
```

### الخطوة 4: إعداد قاعدة البيانات
```bash
# توليد Prisma client
bunx prisma generate
# أو: npx prisma generate

# إنشاء قاعدة البيانات
bunx prisma db push --accept-data-loss
# أو: npx prisma db push --accept-data-loss
```

### الخطوة 5: بناء المشروع
```bash
bun run build
# أو: npm run build
```

### الخطوة 6: تشغيل التطبيق
```bash
bun run start
# أو: npm run start
```

✅ التطبيق سيعمل على: `http://localhost:3000`

### بيانات الدخول:
- **المدير:** admin / admin123
- **كلمة مرور القسم المالي:** admin123

---

## 🌐 الطريقة 2: النشر على VPS (خادم خاص بك)

### المتطلبات:
- خادم VPS (مثل: DigitalOcean, Linode, Hetzner)
- نظام Ubuntu 22.04+
- اسم دومين مشترى (مثل: my-school.com)

### الخطوة 1: شراء VPS ودومين
- **VPS:** أنصح بـ Hetzner (رخيص) أو DigitalOcean
- **دومين:** Namecheap أو Cloudflare (رخيص)

### الخطوة 2: إعداد الخادم
```bash
# SSH إلى الخادم
ssh root@your-server-ip

# تحديث النظام
apt update && apt upgrade -y

# تثبيت Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# تثبيت Nginx (كـ reverse proxy)
apt install nginx -y

# تثبيت PM2 (لتشغيل التطبيق في الخلفية)
npm install -g pm2
```

### الخطوة 3: رفع المشروع
```bash
# على جهازك الشخصي - اضغط المشروع:
tar --exclude='node_modules' --exclude='.next' -czf school.tar.gz .

# ارفع الملف للخادم:
scp school.tar.gz root@your-server-ip:/var/www/

# على الخادم - فك الضغط:
cd /var/www
mkdir school-management
cd school-management
tar -xzf ../school.tar.gz
rm ../school.tar.gz
```

### الخطوة 4: تثبيت وبناء المشروع
```bash
cd /var/www/school-management

# تثبيت الحزم
bun install

# إعداد قاعدة البيانات
bunx prisma generate
bunx prisma db push --accept-data-loss

# بناء المشروع
bun run build
```

### الخطوة 5: تشغيل التطبيق بـ PM2
```bash
# تشغيل التطبيق
cd .next/standalone
pm2 start server.js --name "school-app"
pm2 save
pm2 startup  # اتبع التعليمات
```

### الخطوة 6: إعداد Nginx (Reverse Proxy)
```bash
# إنشاء ملف إعداد Nginx
nano /etc/nginx/sites-available/school-management
```

أضف المحتوى التالي (استبدل your-domain.com بدومينك):
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # حجم أقصى للملفات المرفوعة
    client_max_body_size 10M;
}
```

تفعيل الموقع:
```bash
ln -s /etc/nginx/sites-available/school-management /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### الخطوة 7: تثبيت SSL (HTTPS مجاني)
```bash
# تثبيت Certbot
apt install certbot python3-certbot-nginx -y

# الحصول على شهادة SSL
certbot --nginx -d your-domain.com -d www.your-domain.com

# اتبع التعليمات (اختر redirect HTTP → HTTPS)
```

✅ التطبيق سيعمل على: `https://your-domain.com`

---

## 🐳 الطريقة 3: النشر بـ Docker (الأسهل)

### المتطلبات:
- Docker و Docker Compose مثبتان على الخادم

### الخطوة 1: رفع المشروع (مثل الطريقة 2)

### الخطوة 2: تشغيل بـ Docker
```bash
cd /var/www/school-management

# بناء وتشغيل
docker-compose up -d --build

# التطبيق سيعمل على المنفذ 3000
```

### الخطوة 3: إعداد Nginx + SSL (مثل الطريقة 2)

---

## 🔧 حل المشاكل الشائعة

### المشكلة: "Cannot find module @prisma/client"
```bash
bunx prisma generate
# أو
npx prisma generate
```

### المشكلة: "Database file not found"
```bash
# تأكد من وجود مجلد db
mkdir -p db
bunx prisma db push --accept-data-loss
```

### المشكلة: "Port 3000 already in use"
```bash
# ابحث عن العملية
lsof -i :3000
# أو
kill $(lsof -t -i:3000)
```

### المشكلة: التطبيق يعمل لكن الصفحة بيضاء
```bash
# تحقق من السجلات
pm2 logs school-app
# أو
cat server.log
```

---

## 📞 الدعم
إذا واجهت أي مشكلة، شارك رسالة الخطأ وسأساعدك.
