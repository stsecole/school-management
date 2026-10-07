import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
  // إنشاء مجلد db إذا لم يكن موجوداً
  const dbDir = path.join(process.cwd(), 'db')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  // إنشاء مستخدم المدير الافتراضي إذا لم يكن موجوداً
  const adminExists = await prisma.user.findFirst({
    where: { role: 'director' }
  })

  if (!adminExists) {
    console.log('[Seed] Creating default admin user...')
    await prisma.user.create({
      data: {
        username: 'admin',
        password: 'admin123',
        name: 'المدير',
        role: 'director',
        canManageTimetable: true,
      }
    })
    console.log('[Seed] Default admin created (admin / admin123)')

    // إنشاء كلمة مرور القسم المالي
    await prisma.setting.upsert({
      where: { key: 'finance_password' },
      update: {},
      create: { key: 'finance_password', value: 'admin123' },
    })
    console.log('[Seed] Finance password set to: admin123')

    // إنشاء موظف افتراضي
    const employeeExists = await prisma.user.findFirst({
      where: { role: 'employee' }
    })
    if (!employeeExists) {
      await prisma.user.create({
        data: {
          username: 'employee',
          password: 'employee123',
          name: 'موظف التسجيل',
          role: 'employee',
          canManageTimetable: false,
        }
      })
      console.log('[Seed] Default employee created (employee / employee123)')
    }
  } else {
    console.log('[Seed] Admin user already exists')
  }

  console.log('[Seed] Done')
}

main()
  .catch(e => {
    console.error('[Seed] Error:', e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
