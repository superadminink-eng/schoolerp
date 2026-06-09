import { test, expect } from "@playwright/test";
import { STORAGE_STATE_ADMIN } from "../playwright.config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.describe("Setup & Academics Module E2E", () => {
  test.use({ storageState: STORAGE_STATE_ADMIN });

  let academicYearName: string;
  let academicYearId: string;
  let subjectName: string;
  let subjectCode: string;
  let subjectMasterId: string;
  let className: string;
  let classId: string;
  let teacherId: string;
  let branchName: string;

  test.beforeAll(async () => {
    // 1. Get organization and branch
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error("No organization found");

    const branch = await prisma.branch.findFirst({ where: { organizationId: org.id, isMain: true } })
      || await prisma.branch.findFirst({ where: { organizationId: org.id } });
    if (!branch) throw new Error("No branch found");
    branchName = branch.name;

    // 2. Ensure we have a teacher seeded
    const teacher = await prisma.staff.upsert({
      where: {
        branchId_employeeId: {
          branchId: branch.id,
          employeeId: "EMP-ACAD-123",
        }
      },
      update: {
        role: "TEACHER",
        status: "ACTIVE"
      },
      create: {
        branchId: branch.id,
        employeeId: "EMP-ACAD-123",
        name: "Academics E2E Teacher",
        role: "TEACHER",
        status: "ACTIVE"
      }
    });
    teacherId = teacher.id;
  });

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log(`BROWSER CONSOLE: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`BROWSER ERROR: ${err.message}`));
    page.on("requestfailed", (req) => console.log(`REQUEST FAILED: ${req.url()} - ${req.failure()?.errorText}`));
  });

  test.afterAll(async () => {
    // Cleanup everything created by the test
    if (classId) {
      await prisma.feeInstallmentTemplate.deleteMany({ where: { classId } });
      await prisma.feeStructure.deleteMany({ where: { classId } });
      await prisma.section.deleteMany({ where: { classId } });
      await prisma.subject.deleteMany({ where: { classId } });
      await prisma.class.deleteMany({ where: { id: classId } });
    }
    if (subjectMasterId) {
      await prisma.subjectMaster.deleteMany({ where: { id: subjectMasterId } });
    }
    if (academicYearId) {
      await prisma.academicYear.deleteMany({ where: { id: academicYearId } });
    }
    await prisma.staff.deleteMany({ where: { employeeId: "EMP-ACAD-123" } });
    await prisma.$disconnect();
  });

  test("Academics Setup human-like E2E journey", async ({ page }) => {
    // --- STEP 1: Academic Year Creation & Verification ---
    academicYearName = `AY-${Date.now()}`;
    await page.goto("/academic-years");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1.text-headline-md")).toContainText("Academic Years");

    await page.click("button:has-text('Add Academic Year')");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1.text-headline-md")).toContainText("Add Academic Year");

    await page.fill("label:has-text('Name') + input", academicYearName);
    await page.fill("label:has-text('Start date') + input", "2026-06-01");
    await page.fill("label:has-text('End date') + input", "2027-04-30");

    // Intercept POST request for creation
    const ayResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/v1/academic-years") && res.status() === 201
    );
    await page.click("button[type='submit']:has-text('Create Academic Year')");
    const ayResponse = await ayResponsePromise;
    const ayResult = await ayResponse.json();
    academicYearId = ayResult.data.id;
    expect(academicYearId).toBeDefined();

    // Verify CRUD list page
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1.text-headline-md")).toContainText("Academic Years");
    await page.fill("input[placeholder='Search academic years']", academicYearName);
    await page.waitForTimeout(500);
    const ayRow = page.locator(".ag-row").filter({ hasText: academicYearName });
    await expect(ayRow).toBeVisible();
    await expect(ayRow.locator("text=Inactive")).toBeVisible(); // Since isCurrent was false

    // --- STEP 2: Subject Master Creation & Verification ---
    subjectName = `Subj-${Date.now()}`;
    subjectCode = `CD_${Date.now().toString().slice(-6)}`;
    await page.goto("/subject-masters");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1.text-headline-md")).toContainText("Subject Catalog");

    await page.click("button:has-text('Add Subject')");
    await expect(page.locator("h2:has-text('Add Subject')")).toBeVisible();

    await page.fill("label:has-text('Name') + input", subjectName);
    await page.fill("label:has-text('Code') + input", subjectCode);
    await page.fill("label:has-text('Description') + input", "Connected workflow testing");

    // Intercept POST request for creation
    const smResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/v1/subject-masters") && res.status() === 201
    );
    await page.click("button[type='submit']:has-text('Create')");
    const smResponse = await smResponsePromise;
    const smResult = await smResponse.json();
    subjectMasterId = smResult.data.id;
    expect(subjectMasterId).toBeDefined();

    // Verify in catalog list
    await page.fill("input[placeholder='Search subjects']", subjectName);
    await page.waitForTimeout(500);
    const smRow = page.locator(".ag-row").filter({ hasText: subjectName });
    await expect(smRow).toBeVisible();
    await expect(smRow.locator("text=Theory")).toBeVisible();

    // --- STEP 3: Class creation wizard flow ---
    className = `Class-${Date.now()}`;
    await page.goto("/classes");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1.text-headline-md")).toContainText("Classes");

    await page.click("button:has-text('Add Class')");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1.text-headline-md")).toContainText("Add Class");

    // Fill Details
    await page.fill("label:has-text('Class name') + input", className);
    await page.fill("label:has-text('Numeric grade') + input", "10");

    await page.click("label:has-text('Branch') + button");
    await page.click(`role=option >> text=${branchName}`);

    await page.click("label:has-text('Academic Year') + button");
    await page.click(`role=option >> text=${academicYearName}`);

    // Select the subject in MultiSelect
    await page.click("button:has-text('Select subjects from catalog')");
    await page.fill("input[placeholder='Search subjects...']", subjectName);
    await page.click(`label:has-text('${subjectName}')`);
    
    // Close MultiSelect by pressing Escape
    await page.keyboard.press("Escape");

    // Click Save & Continue (transition to Divisions tab)
    const classCreatePromise = page.waitForResponse(
      (res) => res.url().includes("/api/v1/classes") && res.status() === 201
    );
    await page.click("button:has-text('Save & Continue')");
    const classCreateRes = await classCreatePromise;
    const classCreateResult = await classCreateRes.json();
    classId = classCreateResult.data.id;
    expect(classId).toBeDefined();

    // Verify in DB that class is DRAFT
    let dbClass = await prisma.class.findUnique({ where: { id: classId } });
    expect(dbClass).not.toBeNull();
    expect(dbClass!.status).toBe("DRAFT");

    // Divisions tab
    await page.waitForSelector("text=Divisions");
    await page.fill("label:has-text('Division name') + input", "A");

    // Assign teacher for the subject
    const row = page.locator(".contents").filter({ hasText: subjectName });
    await row.locator("button[role='combobox']:has-text('None')").click();
    await page.locator("role=option").filter({ hasText: "Academics E2E Teacher" }).click();

    // Mark as Class Teacher (CT) radio button
    await row.locator("input[type='radio']").click();

    // Click Save & Continue (transition to Fees & Installments tab)
    const classUpdatePromise1 = page.waitForResponse(
      (res) => res.url().includes(`/api/v1/classes/${classId}`) && res.status() === 200
    );
    await page.click("button:has-text('Save & Continue')");
    await classUpdatePromise1;

    // Fees & Installments tab
    await page.waitForSelector("text=Fees & Installment Plans");
    await page.click("button:has-text('Add Fee Row')");
    await page.fill("input[placeholder='Fee name (e.g. Tuition)']", "Tuition");
    await page.fill("input[placeholder='Amount (₹)']", "15000");

    await page.click("button:has-text('Add Installment')");
    await page.fill("input[placeholder='e.g. Admission / Term 1']", "Term 1");
    await page.fill("input[placeholder='e.g. 15000']", "15000");
    await page.fill("label:has-text('Due Date') + input", "2026-09-01");

    // Finish & Activate Class
    const classUpdatePromise2 = page.waitForResponse(
      (res) => res.url().includes(`/api/v1/classes/${classId}`) && res.status() === 200
    );
    await page.click("button:has-text('Finish & Activate')");
    await classUpdatePromise2;

    // --- STEP 4: Verification of Active Class in Classes List Grid ---
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1.text-headline-md")).toContainText("Classes");

    await page.fill("input[placeholder='Search classes']", className);
    await page.waitForTimeout(500);

    const classRow = page.locator(".ag-row").filter({ hasText: className });
    await expect(classRow).toBeVisible();
    await expect(classRow.locator("text=Active")).toBeVisible();
  });
});
