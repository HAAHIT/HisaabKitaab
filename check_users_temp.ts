import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const userCount = await prisma.user.count();
    console.log(`User count: ${userCount}`);
    if (userCount > 0) {
      const users = await prisma.user.findMany({
        select: { email: true, role: true }
      });
      console.log("Users in database:");
      users.forEach(u => console.log(`- ${u.email} (${u.role})`));
    }
  } catch (err) {
    console.error("Database connection failed or table missing:", err);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
