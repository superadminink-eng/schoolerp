import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Searching for users with email containing 'kasture' or 'gmail.com'...");
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: "kasture" } },
        { email: { contains: "admin" } }
      ]
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      deletedAt: true
    }
  });
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
