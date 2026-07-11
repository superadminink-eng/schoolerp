import { config } from "dotenv";
config();
import { prisma } from "./src/lib/prisma";

async function main() {
  try {
    const org = await prisma.organization.findFirst();
    const branch = await prisma.branch.findFirst({ where: { organizationId: org?.id } });
    const ay = await prisma.academicYear.findFirst({ where: { organizationId: org?.id } });
    const cls = await prisma.class.findFirst({ where: { branchId: branch?.id } });

    if (!org || !branch || !ay || !cls) {
      console.log("Missing prerequisites");
      return;
    }

    const applicationNo = `TEST-${Date.now()}`;

    const created = await prisma.admissionApplication.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        academicYearId: ay.id,
        classId: cls.id,
        applicationNo,
        firstName: "Test",
        lastName: "User",
        dateOfBirth: new Date("2015-01-01"),
        gender: "MALE",
        address: "Test address",
        pincode: "123456",
        emergencyContact: "9876543210",
        status: "SUBMITTED",
      },
    });
    console.log("Success:", created.id);
  } catch (error) {
    console.error("Prisma error:", error);
  }
}

main().finally(() => prisma.$disconnect());
