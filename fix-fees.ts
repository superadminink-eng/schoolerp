import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.feeCategory.findMany({
    where: { code: null }
  });

  for (const cat of categories) {
    const code = cat.name.toUpperCase().replace(/\s+/g, '_') + '_' + Math.floor(Math.random() * 1000);
    await prisma.feeCategory.update({
      where: { id: cat.id },
      data: { code }
    });
    console.log(`Updated FeeCategory ${cat.name} with code ${code}`);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
