import { prisma } from "./src/lib/prisma";

async function main() {
  const years = await prisma.academicYear.findMany({ select: { id: true, name: true, isCurrent: true, organizationId: true } });
  console.log("Academic Years:", years);

  const students = await prisma.student.findMany({
    where: { firstName: "Aarav" },
    include: { enrollments: { include: { section: { include: { class: true } } }, orderBy: { enrolledAt: 'desc' } } }
  });
  console.dir(students, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
