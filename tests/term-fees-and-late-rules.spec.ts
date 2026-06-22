import { test, expect } from "@playwright/test";
import { STORAGE_STATE_ADMIN } from "../playwright.config";
import { PrismaClient } from "@prisma/client";
import { runLateFeesCalculation } from "../src/lib/tasks/late-fees-cron";

const prisma = new PrismaClient();

test.describe("Term Fees and Smart Late Fee Rules E2E", () => {
  test.use({ storageState: STORAGE_STATE_ADMIN });

  let orgId = "";
  let branchId = "";
  let classId = "";
  let sectionId = "";
  let nextSectionId = "";
  let academicYearId = "";
  let nextAcademicYearId = "";
  let feeCategoryId = "";
  let feeStructureId = "";
  let appId = "";

  const student1FirstName = "SiliconTerm1";
  const student1LastName = "ValleyTerm1";
  const student2FirstName = "SiliconTerm2";
  const student2LastName = "ValleyTerm2";

  test.beforeAll(async () => {
    // 1. Fetch organization & branch
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error("No organization found");
    orgId = org.id;

    const branch = await prisma.branch.findFirst({ where: { organizationId: orgId, code: "CSVKRD" } })
      || await prisma.branch.findFirst({ where: { organizationId: orgId } });
    if (!branch) throw new Error("No branch found");
    branchId = branch.id;

    let ay = await prisma.academicYear.findFirst({ where: { organizationId: orgId, isCurrent: true } });
    if (!ay) {
      ay = await prisma.academicYear.findFirst({ where: { organizationId: orgId } });
      if (ay) {
        await prisma.academicYear.update({
          where: { id: ay.id },
          data: { isCurrent: true },
        });
      }
    }
    if (!ay) throw new Error("No current academic year found");
    academicYearId = ay.id;

    // Create a temporary next academic year for rollover testing
    const nextAy = await prisma.academicYear.upsert({
      where: {
        organizationId_name: {
          organizationId: orgId,
          name: "2027-28"
        }
      },
      update: {},
      create: {
        organizationId: orgId,
        name: "2027-28",
        startDate: new Date("2027-06-01"),
        endDate: new Date("2028-04-30"),
        isCurrent: false,
      }
    });
    nextAcademicYearId = nextAy.id;

    // 2. Clean up any previous test remnants
    const deleteStudents = [
      { firstName: student1FirstName, lastName: student1LastName },
      { firstName: student2FirstName, lastName: student2LastName }
    ];
    for (const stud of deleteStudents) {
      await prisma.feePayment.deleteMany({
        where: { student: { firstName: stud.firstName, lastName: stud.lastName } }
      });
      await prisma.invoice.deleteMany({
        where: { student: { firstName: stud.firstName, lastName: stud.lastName } }
      });
      await prisma.studentEnrollment.deleteMany({
        where: { student: { firstName: stud.firstName, lastName: stud.lastName } }
      });
      await prisma.leavingCertificate.deleteMany({
        where: { student: { firstName: stud.firstName, lastName: stud.lastName } }
      });
      await prisma.student.deleteMany({
        where: { firstName: stud.firstName, lastName: stud.lastName }
      });
      await prisma.admissionApplication.deleteMany({
        where: { firstName: stud.firstName, lastName: stud.lastName }
      });
    }

    // Clean up our custom test class & template structures
    await prisma.feeInstallmentTemplate.deleteMany({
      where: { class: { name: "SV-Term-Test-Class" } }
    });
    await prisma.feeStructure.deleteMany({
      where: { class: { name: "SV-Term-Test-Class" } }
    });
    await prisma.section.deleteMany({
      where: { class: { name: "SV-Term-Test-Class" } }
    });
    await prisma.class.deleteMany({
      where: { name: "SV-Term-Test-Class" }
    });
    await prisma.feeCategory.deleteMany({
      where: { name: "SV-Term-Tuition" }
    });

    // 3. Create test class, sections, fee category & structures
    const testClass = await prisma.class.create({
      data: {
        organizationId: orgId,
        branchId,
        academicYearId,
        name: "SV-Term-Test-Class",
        numericGrade: 12,
      }
    });
    classId = testClass.id;

    const testSection = await prisma.section.create({
      data: {
        classId,
        name: "A",
      }
    });
    sectionId = testSection.id;

    const testNextSection = await prisma.section.create({
      data: {
        classId,
        name: "B",
      }
    });
    nextSectionId = testNextSection.id;

    const feeCat = await prisma.feeCategory.create({
      data: {
        organizationId: orgId,
        name: "SV-Term-Tuition",
        code: "TUITION",
      }
    });
    feeCategoryId = feeCat.id;

    // Create current academic year fee structures
    await prisma.feeStructure.createMany({
      data: [
        {
          classId,
          feeCategoryId,
          amount: 30000,
          frequency: "ANNUAL",
          academicYearId,
          termType: "FULL_TERM",
        },
        {
          classId,
          feeCategoryId,
          amount: 20000,
          frequency: "ANNUAL",
          academicYearId,
          termType: "HALF_TERM",
        },
        {
          classId,
          feeCategoryId,
          amount: 10000,
          frequency: "ANNUAL",
          academicYearId,
          termType: "SHORT_TERM",
        }
      ]
    });

    // Create next academic year fee structures
    await prisma.feeStructure.createMany({
      data: [
        {
          classId,
          feeCategoryId,
          amount: 32000,
          frequency: "ANNUAL",
          academicYearId: nextAcademicYearId,
          termType: "FULL_TERM",
        },
        {
          classId,
          feeCategoryId,
          amount: 22000,
          frequency: "ANNUAL",
          academicYearId: nextAcademicYearId,
          termType: "HALF_TERM",
        },
        {
          classId,
          feeCategoryId,
          amount: 11000,
          frequency: "ANNUAL",
          academicYearId: nextAcademicYearId,
          termType: "SHORT_TERM",
        }
      ]
    });

    // Create installment templates for current academic year
    const today = new Date();
    const fiveDaysInFuture = new Date();
    fiveDaysInFuture.setDate(today.getDate() + 5);
    const tenDaysInFuture = new Date();
    tenDaysInFuture.setDate(today.getDate() + 10);
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(today.getDate() - 5);

    await prisma.feeInstallmentTemplate.createMany({
      data: [
        {
          classId,
          academicYearId,
          name: "Full Inst 1",
          amount: 15000,
          dueDate: fiveDaysInFuture,
          termType: "FULL_TERM",
          lateFeeActive: true,
          lateFeeType: "DAILY",
          lateFeeValue: 10,
          lateFeeGrace: 0,
        },
        {
          classId,
          academicYearId,
          name: "Full Inst 2",
          amount: 15000,
          dueDate: tenDaysInFuture,
          termType: "FULL_TERM",
          lateFeeActive: true,
          lateFeeType: "LUMP_SUM",
          lateFeeValue: 500,
          lateFeeGrace: 0,
        },
        {
          classId,
          academicYearId,
          name: "Half Inst 1",
          amount: 20000,
          dueDate: fiveDaysAgo,
          termType: "HALF_TERM",
          lateFeeActive: true,
          lateFeeType: "PERCENTAGE",
          lateFeeValue: 10,
          lateFeeGrace: 1,
        },
        {
          classId,
          academicYearId,
          name: "Short Inst 1",
          amount: 10000,
          dueDate: fiveDaysAgo,
          termType: "SHORT_TERM",
          lateFeeActive: true,
          lateFeeType: "DAILY",
          lateFeeValue: 20,
          lateFeeGrace: 1,
        }
      ]
    });

    // Create installment templates for NEXT academic year
    await prisma.feeInstallmentTemplate.createMany({
      data: [
        {
          classId,
          academicYearId: nextAcademicYearId,
          name: "Next Full Inst 1",
          amount: 16000,
          dueDate: fiveDaysInFuture,
          termType: "FULL_TERM",
          lateFeeActive: false,
          lateFeeType: "DAILY",
          lateFeeValue: 0,
          lateFeeGrace: 0,
        },
        {
          classId,
          academicYearId: nextAcademicYearId,
          name: "Next Full Inst 2",
          amount: 16000,
          dueDate: tenDaysInFuture,
          termType: "FULL_TERM",
          lateFeeActive: false,
          lateFeeType: "DAILY",
          lateFeeValue: 0,
          lateFeeGrace: 0,
        },
        {
          classId,
          academicYearId: nextAcademicYearId,
          name: "Next Half Inst 1",
          amount: 22000,
          dueDate: fiveDaysAgo,
          termType: "HALF_TERM",
          lateFeeActive: false,
          lateFeeType: "DAILY",
          lateFeeValue: 0,
          lateFeeGrace: 0,
        },
        {
          classId,
          academicYearId: nextAcademicYearId,
          name: "Next Short Inst 1",
          amount: 11000,
          dueDate: fiveDaysAgo,
          termType: "SHORT_TERM",
          lateFeeActive: false,
          lateFeeType: "DAILY",
          lateFeeValue: 0,
          lateFeeGrace: 0,
        }
      ]
    });

    // Create shortlisted admission application for student 1
    const app1 = await prisma.admissionApplication.create({
      data: {
        organizationId: orgId,
        branchId,
        academicYearId,
        classId,
        applicationNo: `APP-TERM1-${Date.now()}`,
        firstName: student1FirstName,
        lastName: student1LastName,
        dateOfBirth: new Date("2014-01-01"),
        gender: "FEMALE",
        address: "456 Silicon Term Road",
        pincode: "411038",
        emergencyContact: "9876543210",
        status: "SHORTLISTED",
      }
    });
    appId = app1.id;
  });

  test.afterAll(async () => {
    // Cleanup remaining test data
    const deleteStudents = [
      { firstName: student1FirstName, lastName: student1LastName },
      { firstName: student2FirstName, lastName: student2LastName }
    ];
    for (const stud of deleteStudents) {
      await prisma.feePayment.deleteMany({
        where: { student: { firstName: stud.firstName, lastName: stud.lastName } }
      });
      await prisma.invoice.deleteMany({
        where: { student: { firstName: stud.firstName, lastName: stud.lastName } }
      });
      await prisma.studentEnrollment.deleteMany({
        where: { student: { firstName: stud.firstName, lastName: stud.lastName } }
      });
      await prisma.leavingCertificate.deleteMany({
        where: { student: { firstName: stud.firstName, lastName: stud.lastName } }
      });
      await prisma.student.deleteMany({
        where: { firstName: stud.firstName, lastName: stud.lastName }
      });
      await prisma.admissionApplication.deleteMany({
        where: { firstName: stud.firstName, lastName: stud.lastName }
      });
    }
    await prisma.feeInstallmentTemplate.deleteMany({
      where: { classId }
    });
    await prisma.feeStructure.deleteMany({
      where: { classId }
    });
    await prisma.section.deleteMany({
      where: { classId }
    });
    await prisma.class.deleteMany({
      where: { id: classId }
    });
    await prisma.feeCategory.deleteMany({
      where: { id: feeCategoryId }
    });
  });

  test("Run complete Term Types and Smart Late Fees E2E scenario", async ({ page }) => {
    // ==========================================
    // STEP 1: Promote applicant with HALF_TERM
    // ==========================================
    const promoteRes = await page.request.post(`/api/v1/admissions/applications/${appId}/promote`, {
      data: {
        sectionId,
        termType: "HALF_TERM",
        admissionDate: new Date().toISOString(),
      }
    });

    expect(promoteRes.status()).toBe(201);
    const body = await promoteRes.json();
    expect(body.success).toBe(true);

    const student1 = await prisma.student.findFirst({
      where: { firstName: student1FirstName, lastName: student1LastName }
    });
    expect(student1).not.toBeNull();

    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { studentId: student1!.id, academicYearId }
    });
    expect(enrollment).not.toBeNull();
    expect(enrollment!.termType).toBe("HALF_TERM");

    const invoices = await prisma.invoice.findMany({
      where: { studentId: student1!.id }
    });
    expect(invoices.length).toBe(1);
    expect(Number(invoices[0].totalAmount)).toBe(20000);
    expect(invoices[0].lateFeeActive).toBe(true);
    expect(invoices[0].lateFeeType).toBe("PERCENTAGE");
    expect(Number(invoices[0].lateFeeValue)).toBe(10);

    // =========================================================================
    // STEP 2: Create second student and verify Late Fee Calculations
    // =========================================================================
    const student2 = await prisma.student.create({
      data: {
        organizationId: orgId,
        branchId,
        admissionNo: `ADM-T-${Date.now()}`,
        firstName: student2FirstName,
        lastName: student2LastName,
        dateOfBirth: new Date("2014-01-01"),
        gender: "MALE",
        address: "789 Tech Rd",
        pincode: "411038",
        status: "ACTIVE",
      }
    });

    await prisma.studentEnrollment.create({
      data: {
        studentId: student2.id,
        academicYearId,
        sectionId,
        termType: "FULL_TERM",
      }
    });

    // Clean up student 1 invoices first
    await prisma.invoice.deleteMany({
      where: { studentId: student1!.id }
    });

    const today = new Date();
    
    // Invoice 1: Percentage-based late fee
    // Total: 20,000, 5 days and 2 hours ago. Grace: 1. daysOverdue = 4. Rate = 10%. Expected late fee = 2,000.
    const dueDate1 = new Date();
    dueDate1.setDate(today.getDate() - 5);
    dueDate1.setHours(dueDate1.getHours() - 2);
    await prisma.invoice.create({
      data: {
        studentId: student1!.id,
        organizationId: orgId,
        number: `INV-TEST-P-${Date.now()}`,
        year: today.getFullYear(),
        totalAmount: 20000,
        paidAmount: 0,
        status: "PENDING",
        dueDate: dueDate1,
        lateFeeActive: true,
        lateFeeType: "PERCENTAGE",
        lateFeeValue: 10,
        lateFeeGrace: 1,
        lateFeeAccumulated: 0,
      }
    });

    // Invoice 2: Lump-sum late fee
    // Total: 15,000, 3 days and 2 hours ago. Grace: 0. daysOverdue = 3. Rate = 500. Expected late fee = 500.
    const dueDate2 = new Date();
    dueDate2.setDate(today.getDate() - 3);
    dueDate2.setHours(dueDate2.getHours() - 2);
    await prisma.invoice.create({
      data: {
        studentId: student2.id,
        organizationId: orgId,
        number: `INV-TEST-L-${Date.now()}`,
        year: today.getFullYear(),
        totalAmount: 15000,
        paidAmount: 0,
        status: "PENDING",
        dueDate: dueDate2,
        lateFeeActive: true,
        lateFeeType: "LUMP_SUM",
        lateFeeValue: 500,
        lateFeeGrace: 0,
        lateFeeAccumulated: 0,
      }
    });

    // Invoice 3: Daily rate late fee
    // Total: 10,000, 6 days and 2 hours ago. Grace: 1. daysOverdue = 5. Rate = 25/day. Expected late fee = 125.
    const dueDate3 = new Date();
    dueDate3.setDate(today.getDate() - 6);
    dueDate3.setHours(dueDate3.getHours() - 2);
    await prisma.invoice.create({
      data: {
        studentId: student2.id,
        organizationId: orgId,
        number: `INV-TEST-D-${Date.now()}`,
        year: today.getFullYear(),
        totalAmount: 10000,
        paidAmount: 0,
        status: "PENDING",
        dueDate: dueDate3,
        lateFeeActive: true,
        lateFeeType: "DAILY",
        lateFeeValue: 25,
        lateFeeGrace: 1,
        lateFeeAccumulated: 0,
      }
    });

    // Run batch task
    const cronRes = await runLateFeesCalculation(today);
    expect(cronRes.success).toBe(true);
    expect(cronRes.updatedCount).toBeGreaterThanOrEqual(3);

    // Retrieve and verify Invoice 1 (Percentage)
    const inv1 = await prisma.invoice.findFirst({
      where: { studentId: student1!.id, lateFeeType: "PERCENTAGE" }
    });
    expect(inv1).not.toBeNull();
    expect(Number(inv1!.lateFeeAccumulated)).toBe(2000);
    expect(inv1!.status).toBe("OVERDUE");

    // Retrieve and verify Invoice 2 (Lump-sum)
    const inv2 = await prisma.invoice.findFirst({
      where: { studentId: student2.id, lateFeeType: "LUMP_SUM" }
    });
    expect(inv2).not.toBeNull();
    expect(Number(inv2!.lateFeeAccumulated)).toBe(500);
    expect(inv2!.status).toBe("OVERDUE");

    // Retrieve and verify Invoice 3 (Daily)
    const inv3 = await prisma.invoice.findFirst({
      where: { studentId: student2.id, lateFeeType: "DAILY" }
    });
    expect(inv3).not.toBeNull();
    expect(Number(inv3!.lateFeeAccumulated)).toBe(125);
    expect(inv3!.status).toBe("OVERDUE");

    // =========================================================================
    // STEP 3: Bulk promote and verify rollover inherits/overrides Term Types
    // =========================================================================
    // Student 1 currently has HALF_TERM termType
    // Student 2 currently has FULL_TERM termType

    // Call Bulk Promotion API with no termType option (Inherit Current)
    const bulkPromoteRes = await page.request.post("/api/v1/students/promote-bulk", {
      data: {
        studentIds: [student1!.id, student2.id],
        targetSectionId: nextSectionId,
        targetAcademicYearId: nextAcademicYearId,
        discountPercent: 0,
      }
    });

    expect(bulkPromoteRes.status()).toBe(200);
    const promoteBody = await bulkPromoteRes.json();
    expect(promoteBody.success).toBe(true);

    // Verify next-year enrollments and term types
    const enrollment1 = await prisma.studentEnrollment.findFirst({
      where: { studentId: student1!.id, academicYearId: nextAcademicYearId }
    });
    expect(enrollment1).not.toBeNull();
    expect(enrollment1!.termType).toBe("HALF_TERM"); // Inherited HALF_TERM

    const enrollment2 = await prisma.studentEnrollment.findFirst({
      where: { studentId: student2.id, academicYearId: nextAcademicYearId }
    });
    expect(enrollment2).not.toBeNull();
    expect(enrollment2!.termType).toBe("FULL_TERM"); // Inherited FULL_TERM

    // Verify Student 1 has 1 next-year invoice matching HALF_TERM (amount 22000)
    const invs1 = await prisma.invoice.findMany({
      where: { studentId: student1!.id }
    });
    const nextYearInv1 = invs1.find(i => Number(i.totalAmount) === 22000);
    expect(nextYearInv1).toBeDefined();

    // Verify Student 2 has 2 next-year invoices matching FULL_TERM (amount 16000 + 16000)
    const invs2 = await prisma.invoice.findMany({
      where: { studentId: student2.id }
    });
    const nextYearInvs2 = invs2.filter(i => Number(i.totalAmount) === 16000);
    expect(nextYearInvs2.length).toBe(2);

    // Delete next-year invoices and enrollments for a clean override check
    await prisma.invoice.deleteMany({
      where: {
        studentId: { in: [student1!.id, student2.id] },
        items: {
          some: {
            description: { contains: "Next" }
          }
        }
      }
    });

    await prisma.studentEnrollment.deleteMany({
      where: {
        studentId: { in: [student1!.id, student2.id] },
        academicYearId: nextAcademicYearId,
      }
    });

    // Call Bulk Promotion API with explicit override termType: "SHORT_TERM"
    const bulkPromoteOverrideRes = await page.request.post("/api/v1/students/promote-bulk", {
      data: {
        studentIds: [student1!.id, student2.id],
        targetSectionId: nextSectionId,
        targetAcademicYearId: nextAcademicYearId,
        discountPercent: 0,
        termType: "SHORT_TERM"
      }
    });

    expect(bulkPromoteOverrideRes.status()).toBe(200);
    const promoteOverrideBody = await bulkPromoteOverrideRes.json();
    expect(promoteOverrideBody.success).toBe(true);

    // Verify both have next-year enrollments with SHORT_TERM
    const enrollment1Override = await prisma.studentEnrollment.findFirst({
      where: { studentId: student1!.id, academicYearId: nextAcademicYearId }
    });
    expect(enrollment1Override!.termType).toBe("SHORT_TERM");

    const enrollment2Override = await prisma.studentEnrollment.findFirst({
      where: { studentId: student2.id, academicYearId: nextAcademicYearId }
    });
    expect(enrollment2Override!.termType).toBe("SHORT_TERM");

    // Both should have invoices of amount 11000 matching next-year SHORT_TERM
    const allInvs = await prisma.invoice.findMany({
      where: {
        studentId: { in: [student1!.id, student2.id] },
        items: {
          some: {
            description: { contains: "Next Short Inst 1" }
          }
        }
      }
    });
    expect(allInvs.length).toBe(2);
    expect(Number(allInvs[0].totalAmount)).toBe(11000);
    expect(Number(allInvs[1].totalAmount)).toBe(11000);
  });
});
