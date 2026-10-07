console.log("Script started");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: {
      username: "admin",
    },
    update: {
      password: "admin123",
      name: "Administrator",
      role: "director",
      canManageTimetable: true,
    },
    create: {
      username: "admin",
      password: "admin123",
      name: "Administrator",
      role: "director",
      canManageTimetable: true,
    },
  });

  await prisma.user.upsert({
    where: {
      username: "employee",
    },
    update: {
      password: "emp123",
      name: "Employee",
      role: "employee",
      canManageTimetable: false,
    },
    create: {
      username: "employee",
      password: "emp123",
      name: "Employee",
      role: "employee",
      canManageTimetable: false,
    },
  });

  console.log("✓ Users created successfully");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });