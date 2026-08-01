import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.applicationDocument.findMany({
    where: { documentType: 'STUDENT_PHOTO' },
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  console.log(JSON.stringify(docs, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
