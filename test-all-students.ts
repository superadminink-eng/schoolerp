import { prisma } from "./src/lib/prisma";

async function main() {
  const students = await prisma.student.findMany({
    include: { enrollments: { include: { section: { include: { class: true } } }, orderBy: { enrolledAt: 'desc' } } }
  });
  console.dir(students, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
