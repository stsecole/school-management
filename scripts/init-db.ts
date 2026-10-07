/**
 * تهيئة قاعدة البيانات في الـ deployment
 * - ينشئ مجلد db إذا لم يكن موجوداً
 * - ينشئ قاعدة البيانات (db push) إذا لم تكن موجودة
 * - ينشئ المستخدم الافتراضي (admin) إذا لم يكن موجوداً
 *
 * يُشغّل تلقائياً قبل بدء التطبيق في الإنتاج
 */
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

async function initDatabase() {
  console.log('[Init] Starting database initialization...')

  const projectRoot = process.cwd()
  const dbDir = path.join(projectRoot, 'db')
  const dbPath = path.join(dbDir, 'custom.db')

  // 1. التأكد من وجود مجلد db
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
    console.log('[Init] Created db directory:', dbDir)
  }

  // 2. التحقق من وجود قاعدة البيانات
  const dbExists = fs.existsSync(dbPath)
  console.log('[Init] Database file exists:', dbExists)

  if (!dbExists) {
    console.log('[Init] Database not found. It will be created automatically by Prisma on first connection.')
    // ملاحظة: مع SQLite، Prisma ينشئ الملف تلقائياً عند أول اتصال
    // لكن يجب أن يكون الـ schema مطبّقاً (db push)
    // في الـ deployment، يتم تشغيل `prisma db push` قبل `start`
  }

  // 3. التحقق من وجود المستخدم الافتراضي
  try {
    const prisma = new PrismaClient()
    const adminExists = await prisma.user.findFirst({
      where: { role: 'director' },
    })

    if (!adminExists) {
      console.log('[Init] No director found. Creating default admin user...')
      await prisma.user.create({
        data: {
          username: 'admin',
          password: 'admin123',
          name: 'المدير',
          role: 'director',
          canManageTimetable: true,
        },
      })
      console.log('[Init] Default admin created (username: admin, password: admin123)')

      // إنشاء كلمة مرور القسم المالي الافتراضية
      const settingExists = await prisma.setting.findUnique({
        where: { key: 'finance_password' },
      })
      if (!settingExists) {
        await prisma.setting.create({
          data: { key: 'finance_password', value: 'admin123' },
        })
        console.log('[Init] Default finance password set to: admin123')
      }
    } else {
      console.log('[Init] Director user already exists:', adminExists.username)
    }

    await prisma.$disconnect()
  } catch (e: any) {
    console.error('[Init] Error checking/creating admin user:', e.message)
    // لا نفشل العملية، فقط نسجّل الخطأ
  }

  console.log('[Init] Database initialization complete.')
}

// تشغيل إذا استُدعي مباشرة
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('[Init] Failed:', e)
      process.exit(1)
    })
}

export { initDatabase }
