import { PrismaClient } from "@prisma/client";

async function globalTeardown() {
  console.log("Global Teardown: Cleaning up E2E seeded dummy students...");
  const prisma = new PrismaClient();
  try {
    const result = await prisma.student.deleteMany({
      where: {
        admissionNo: {
          startsWith: "ADM-SEED-",
        },
      },
    });
    console.log(`Global Teardown: Cleaned up ${result.count} dummy students.`);
  } catch (error) {
    console.error("Global Teardown Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

export default globalTeardown;
