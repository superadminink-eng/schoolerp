import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Classes ===");
  const classes = await prisma.class.findMany();
  console.log(classes.map(c => ({ id: c.id, name: c.name, grade: c.numericGrade })));

  console.log("=== Sections ===");
  const sections = await prisma.section.findMany({ include: { class: true } });
  console.log(sections.map(s => ({ id: s.id, name: s.name, className: s.class.name })));

  console.log("=== Fee Categories ===");
  const feeCategories = await prisma.feeCategory.findMany();
  console.log(feeCategories.map(fc => ({ id: fc.id, name: fc.name })));

  console.log("=== Fee Structures ===");
  const feeStructures = await prisma.feeStructure.findMany({ include: { feeCategory: true, class: true } });
  console.log(feeStructures.map(fs => ({ id: fs.id, className: fs.class.name, categoryName: fs.feeCategory.name, amount: fs.amount })));

  console.log("=== Academic Years ===");
  const academicYears = await prisma.academicYear.findMany();
  console.log(academicYears.map(ay => ({ id: ay.id, name: ay.name, isCurrent: ay.isCurrent })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
