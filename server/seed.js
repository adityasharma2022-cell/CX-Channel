const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  const users = [
    {
      username: "admin",
      password: "admin123",
      role: "team",
      department: "admin",
    },
    {
      username: "service",
      password: "service123",
      role: "team",
      department: "service",
    },
    {
      username: "customer1",
      password: "cust123",
      role: "customer",
      email: "customer1@example.com",
    },
  ];
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: { ...u, password: hash },
    });
  }
  console.log("Seeded users");
}
main().finally(() => prisma.$disconnect());
