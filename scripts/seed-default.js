const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const adminExists = await prisma.user.findFirst({
    where: { role: 'director' }
  })

  if (!adminExists) {
    await prisma.user.create({
      data: {
        username: 'admin',
        password: 'admin123',
        name: 'المدير',
        role: 'director',
        canManageTimetable: true,
      }
    })
    await prisma.setting.upsert({
      where: { key: 'finance_password' },
      update: {},
      create: { key: 'finance_password', value: 'admin123' },
    })
    console.log('[Seed] Default admin created (admin / admin123)')
  } else {
    console.log('[Seed] Admin already exists')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
