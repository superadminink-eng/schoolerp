const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const org = await prisma.organization.findFirst();
  console.log("Logo is:", org.logo);
}
main().catch(console.error).finally(() => prisma.$disconnect());
