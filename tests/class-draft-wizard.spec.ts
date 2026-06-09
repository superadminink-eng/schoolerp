import { test, expect } from "@playwright/test";
import { STORAGE_STATE_ADMIN } from "../playwright.config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.describe("Class Wizard Draft & Edit Lock E2E", () => {
  test.use({ storageState: STORAGE_STATE_ADMIN });

  test.beforeAll(async () => {
    // 1. Fetch organization & main branch
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error("No organization found");

    const branch = await prisma.branch.findFirst({ where: { organizationId: org.id, isMain: true } });
    if (!branch) throw new Error("No main branch found");

    // 2. Create a mock teacher in the main branch so the class wizard doesn't render the empty state
    await prisma.staff.upsert({
      where: {
        branchId_employeeId: {
          branchId: branch.id,
          employeeId: "EMP-WIZ-123",
        }
      },
      update: {
        role: "TEACHER",
        status: "ACTIVE"
      },
      create: {
        branchId: branch.id,
        employeeId: "EMP-WIZ-123",
        name: "Wizard Test Teacher",
        role: "TEACHER",
        status: "ACTIVE"
      }
    });
  });

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log(`BROWSER CONSOLE [Admin]: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`BROWSER ERROR [Admin]: ${err.message}`));
    page.on("requestfailed", (req) => console.log(`REQUEST FAILED [Admin]: ${req.url()} - ${req.failure()?.errorText}`));
  });

  test.afterAll(async () => {
    // Cleanup the created class and mock staff
    await prisma.feeInstallmentTemplate.deleteMany({
      where: { class: { name: "E2E Wizard Class" } }
    });
    await prisma.feeStructure.deleteMany({
      where: { class: { name: "E2E Wizard Class" } }
    });
    await prisma.section.deleteMany({
      where: { class: { name: "E2E Wizard Class" } }
    });
    await prisma.class.deleteMany({
      where: { name: "E2E Wizard Class" }
    });
    await prisma.staff.deleteMany({
      where: { employeeId: "EMP-WIZ-123" }
    });
    await prisma.$disconnect();
  });

  test("Class wizard CRUD lifecycle: Draft to Active and Edit Lock validation", async ({ page }) => {
    // 1. Navigate to Add Class
    await page.goto("/classes/new");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1.text-headline-md")).toContainText("Add Class");

    // 2. Fill Details Tab
    await page.fill("input[placeholder='e.g. Class 1']", "E2E Wizard Class");
    await page.fill("input[placeholder='e.g. 1']", "8");

    // Select branch dynamically
    await page.click("button:has-text('Select branch')");
    await page.click("role=option >> nth=0");

    // Select academic year dynamically
    const activeAY = await prisma.academicYear.findFirst({ where: { isCurrent: true } }) || await prisma.academicYear.findFirst();
    if (!activeAY) throw new Error("No academic year found");
    const academicYearName = activeAY.name;

    await page.click("button:has-text('Select academic year')");
    await page.click(`role=option >> text=${academicYearName}`);

    // Click "Save & Continue" to go to Divisions tab
    await page.click("button:has-text('Save & Continue')");
    await page.waitForTimeout(1000);

    // Verify we are still in DRAFT mode and transitioned to Divisions tab
    // Let's assert class is created in database with DRAFT status
    let classRecord = await prisma.class.findFirst({ where: { name: "E2E Wizard Class" } });
    expect(classRecord).not.toBeNull();
    expect(classRecord!.status).toBe("DRAFT");

    // On Divisions tab, fill division name
    await page.fill("input[placeholder='e.g. A']", "A");

    // Click "Save & Continue" to go to Fees tab
    await page.click("button:has-text('Save & Continue')");
    await page.waitForTimeout(1000);

    // Click "Finish & Activate" to activate class
    await page.click("button:has-text('Finish & Activate')");
    await page.waitForTimeout(1000);

    // Assert class status is now ACTIVE
    classRecord = await prisma.class.findFirst({ where: { name: "E2E Wizard Class" } });
    expect(classRecord!.status).toBe("ACTIVE");

    // Go to classes list page and verify it appears as Active
    await page.goto("/classes");
    await page.waitForLoadState("networkidle");
    const classRow = page.locator(".ag-row").filter({ hasText: "E2E Wizard" });
    await expect(classRow).toBeVisible();
    await expect(classRow.locator("text=Active")).toBeVisible();

    // 3. Edit Lock Verification
    // Add student to the class section to lock editing
    const org = await prisma.organization.findFirst();
    const branch = await prisma.branch.findFirst({ where: { organizationId: org!.id, isMain: true } });
    const currentAcademicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } }) || await prisma.academicYear.findFirst();
    const section = await prisma.section.findFirst({ where: { classId: classRecord!.id } });

    const testStudent = await prisma.student.create({
      data: {
        branchId: branch!.id,
        admissionNo: `ADM-WIZ-${Date.now()}`,
        firstName: "WizardStudent",
        lastName: "Test",
        dateOfBirth: new Date("2015-05-15"),
        gender: "MALE",
        status: "ACTIVE",
        enrollments: {
          create: {
            academicYearId: currentAcademicYear!.id,
            sectionId: section!.id,
          }
        }
      }
    });

    // Go to the edit page for this class
    await page.goto(`/classes/${classRecord!.id}/edit`);
    await page.waitForLoadState("networkidle");

    // Verify warning banner in Marathi is visible
    await expect(page.locator("text=वर्ग लॉक आहे (Class Locked)")).toBeVisible();
    await expect(page.locator("text=या वर्गात विद्यार्थी प्रवेशित असल्यामुळे")).toBeVisible();

    // Verify inputs are disabled
    await expect(page.locator("input[placeholder='e.g. Class 1']")).toBeDisabled();
    await expect(page.locator("input[placeholder='e.g. 1']")).toBeDisabled();

    // Cleanup student
    await prisma.studentEnrollment.deleteMany({ where: { studentId: testStudent.id } });
    await prisma.student.delete({ where: { id: testStudent.id } });
  });
});
