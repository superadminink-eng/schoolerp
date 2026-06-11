import { test, expect } from "@playwright/test";
import { STORAGE_STATE_ADMIN, STORAGE_STATE_COUNSELOR } from "../playwright.config";
import { PrismaClient } from "@prisma/client";
import { runLateFeesCalculation } from "../src/lib/tasks/late-fees-cron";

const prisma = new PrismaClient();

test.describe("Dynamic Fee Billing & Ledger System E2E", () => {
  test.use({ storageState: STORAGE_STATE_ADMIN });

  let orgId = "";
  let branchId = "";
  let classId = "";
  let sectionId = "";
  let academicYearId = "";
  let feeCategoryId = "";
  let feeStructureId = "";
  let appId = "";
  
  const studentFirstName = "Silicon";
  const studentLastName = "Valley";

  test.beforeAll(async () => {
    // 1. Fetch organization & branch
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error("No organization found");
    orgId = org.id;

    const branch = await prisma.branch.findFirst({ where: { organizationId: orgId, code: "CSVKRD" } })
      || await prisma.branch.findFirst({ where: { organizationId: orgId } });
    if (!branch) throw new Error("No branch found");
    branchId = branch.id;

    const ay = await prisma.academicYear.findFirst({ where: { organizationId: orgId, isCurrent: true } });
    if (!ay) throw new Error("No current academic year found");
    academicYearId = ay.id;

    // 2. Clean up any previous test remnants
    await prisma.feePayment.deleteMany({
      where: { student: { firstName: studentFirstName, lastName: studentLastName } }
    });
    await prisma.invoice.deleteMany({
      where: { student: { firstName: studentFirstName, lastName: studentLastName } }
    });
    await prisma.studentEnrollment.deleteMany({
      where: { student: { firstName: studentFirstName, lastName: studentLastName } }
    });
    await prisma.leavingCertificate.deleteMany({
      where: { student: { firstName: studentFirstName, lastName: studentLastName } }
    });
    await prisma.student.deleteMany({
      where: { firstName: studentFirstName, lastName: studentLastName }
    });
    await prisma.admissionApplication.deleteMany({
      where: { firstName: studentFirstName, lastName: studentLastName }
    });
    
    // Clean up our custom test class & template structures
    await prisma.feeInstallmentTemplate.deleteMany({
      where: { class: { name: "SV-Test-Class" } }
    });
    await prisma.feeStructure.deleteMany({
      where: { class: { name: "SV-Test-Class" } }
    });
    await prisma.section.deleteMany({
      where: { class: { name: "SV-Test-Class" } }
    });
    await prisma.class.deleteMany({
      where: { name: "SV-Test-Class" }
    });
    await prisma.feeCategory.deleteMany({
      where: { name: "SV-Tuition" }
    });

    // 3. Create test class, section, fee category & structures
    const testClass = await prisma.class.create({
      data: {
        organizationId: orgId,
        branchId,
        academicYearId,
        name: "SV-Test-Class",
        numericGrade: 11,
        status: "ACTIVE",
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

    const feeCat = await prisma.feeCategory.create({
      data: {
        organizationId: orgId,
        name: "SV-Tuition",
      }
    });
    feeCategoryId = feeCat.id;

    const feeStr = await prisma.feeStructure.create({
      data: {
        classId,
        feeCategoryId,
        amount: 45000,
        frequency: "ANNUAL",
        academicYearId,
      }
    });
    feeStructureId = feeStr.id;

    // Create 3 default installment templates
    // Installment 1: ₹15,000, Due today
    // Installment 2: ₹15,000, Due tomorrow
    // Installment 3: ₹15,000, Due in 2 days
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(today.getDate() + 2);

    await prisma.feeInstallmentTemplate.createMany({
      data: [
        {
          classId,
          academicYearId,
          name: "Installment 1",
          amount: 15000,
          dueDate: today,
          lateFeeActive: false,
          lateFeePerDay: 0,
          lateFeeGrace: 0,
        },
        {
          classId,
          academicYearId,
          name: "Installment 2",
          amount: 15000,
          dueDate: tomorrow,
          lateFeeActive: true,
          lateFeePerDay: 50,
          lateFeeGrace: 2,
        },
        {
          classId,
          academicYearId,
          name: "Installment 3",
          amount: 15000,
          dueDate: dayAfter,
          lateFeeActive: false,
          lateFeePerDay: 0,
          lateFeeGrace: 0,
        }
      ]
    });

    // Create a shortlisted application
    const app = await prisma.admissionApplication.create({
      data: {
        organizationId: orgId,
        branchId,
        academicYearId,
        classId,
        applicationNo: `APP-SV-${Date.now()}`,
        firstName: studentFirstName,
        lastName: studentLastName,
        dateOfBirth: new Date("2015-01-01"),
        gender: "MALE",
        address: "123 Silicon Valley Road",
        pincode: "411038",
        emergencyContact: "9999988888",
        status: "SHORTLISTED",
      }
    });
    appId = app.id;
  });

  test.afterAll(async () => {
    // Cleanup remaining test data
    await prisma.feePayment.deleteMany({
      where: { student: { firstName: studentFirstName, lastName: studentLastName } }
    });
    await prisma.invoice.deleteMany({
      where: { student: { firstName: studentFirstName, lastName: studentLastName } }
    });
    await prisma.studentEnrollment.deleteMany({
      where: { student: { firstName: studentFirstName, lastName: studentLastName } }
    });
    await prisma.leavingCertificate.deleteMany({
      where: { student: { firstName: studentFirstName, lastName: studentLastName } }
    });
    await prisma.student.deleteMany({
      where: { firstName: studentFirstName, lastName: studentLastName }
    });
    await prisma.admissionApplication.deleteMany({
      where: { firstName: studentFirstName, lastName: studentLastName }
    });
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

  test("Step 1: Promote applicant with dynamic fee proration/customization", async ({ page }) => {
    test.slow();
    // 1. Open admissions page
    await page.goto("/admissions");
    await page.waitForLoadState("networkidle");
    
    // Select Applications Desk tab
    await page.click("button:has-text('Applications Desk')");
    await page.click("button[title='Table List View']");
    
    // Search for our student
    await page.fill("input[placeholder*='Search']", studentFirstName);
    await page.waitForTimeout(500);
    
    // Verify candidate row is visible and click "Promote to Student" (or edit applicant)
    const row = page.locator(`tr:has-text('${studentFirstName} ${studentLastName}')`);
    await expect(row).toBeVisible();
    await row.click();

    // Select Section "A"
    await page.click("button:has-text('Select section')");
    await page.click("role=option >> text=A");
    
    // 2. Promotion modal details
    // Verify the installment templates list is rendered
    await expect(page.locator("h4:has-text('Fee Installments List')")).toBeVisible();
    await expect(page.locator("text=Installment 1")).toBeVisible();
    await expect(page.locator("text=Installment 2")).toBeVisible();
    await expect(page.locator("text=Installment 3")).toBeVisible();

    // 3. Customize proration:
    // Uncheck Installment 3
    const inst3 = await prisma.feeInstallmentTemplate.findFirst({ where: { classId, name: "Installment 3" } });
    if (!inst3) throw new Error("Installment 3 template not found");
    await page.uncheck(`#inst-check-${inst3.id}`);

    // Edit amount of Installment 2 (set it to 10000 instead of 15000)
    const inst2 = await prisma.feeInstallmentTemplate.findFirst({ where: { classId, name: "Installment 2" } });
    if (!inst2) throw new Error("Installment 2 template not found");
    const container = page.locator(`#inst-check-${inst2.id}`).locator('xpath=ancestor::div[2]');
    const inputLocator = container.locator(`input[type='number']`);
    await inputLocator.fill("10000");

    // Click Confirm Promotion
    const promoteResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/promote") && response.status() === 201
    );
    await page.click("button[type='submit']:has-text('Confirm Promotion')");
    await promoteResponsePromise;

    // Verify student created in database
    const student = await prisma.student.findFirst({
      where: { firstName: studentFirstName, lastName: studentLastName }
    });
    expect(student).not.toBeNull();

    // Assert only 2 invoices are generated (Inst 1 and Inst 2) with custom amounts
    const invoices = await prisma.invoice.findMany({
      where: { studentId: student?.id },
      orderBy: { dueDate: "asc" }
    });

    expect(invoices.length).toBe(2);
    expect(Number(invoices[0].totalAmount)).toBe(15000);
    expect(Number(invoices[1].totalAmount)).toBe(10000);
  });

  test("Step 2: Transaction-safe Excess Payment Rollover verification", async ({ page }) => {
    // Fetch the newly promoted student
    const student = await prisma.student.findFirst({
      where: { firstName: studentFirstName, lastName: studentLastName }
    });
    if (!student) throw new Error("Student not found");

    // We will post a payment of ₹20,000 against the student's fees endpoint.
    // Dues: Installment 1 = ₹15,000, Installment 2 = ₹10,000.
    // Excess = ₹5,000. It should pay off Installment 1 completely and partially pay Installment 2.
    const res = await page.request.post(`/api/v1/fees/${student.id}`, {
      data: {
        amount: 20000,
        method: "ONLINE",
        transactionId: "TXN-SV-12345",
        paidAt: new Date().toISOString(),
        remarks: "Excess payment testing",
      }
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Assert database invoice states
    const invoices = await prisma.invoice.findMany({
      where: { studentId: student.id },
      orderBy: { dueDate: "asc" }
    });

    expect(invoices[0].status).toBe("PAID");
    expect(Number(invoices[0].paidAmount)).toBe(15000);

    expect(invoices[1].status).toBe("PARTIAL");
    expect(Number(invoices[1].paidAmount)).toBe(5000);

    // Verify two payment receipts are linked in feePayments table
    const payments = await prisma.feePayment.findMany({
      where: { studentId: student.id }
    });
    expect(payments.length).toBe(2);
    const paymentAmounts = payments.map(p => Number(p.amount));
    expect(paymentAmounts).toContain(15000);
    expect(paymentAmounts).toContain(5000);
  });

  test("Step 3: Late Fees cron batch utility calculation", async () => {
    const student = await prisma.student.findFirst({
      where: { firstName: studentFirstName, lastName: studentLastName }
    });
    if (!student) throw new Error("Student not found");

    // Let's retrieve Invoice 2 (partially paid, status PARTIAL, late fee active)
    const invoices = await prisma.invoice.findMany({
      where: { studentId: student.id },
      orderBy: { dueDate: "asc" }
    });
    const inv2 = invoices[1];

    // Set its due date to 10 days ago so it counts as late
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    await prisma.invoice.update({
      where: { id: inv2.id },
      data: {
        dueDate: tenDaysAgo,
        lateFeeActive: true,
        lateFeePerDay: 50,
        lateFeeGrace: 2,
        lateFeeAccumulated: 0,
      }
    });

    // Run batch task programmatically with current date
    const batchResult = await runLateFeesCalculation(new Date());
    expect(batchResult.success).toBe(true);
    expect(batchResult.updatedCount).toBeGreaterThan(0);

    // Verify accumulated penalty updates
    // Days late: 10 days. Grace: 2. Overdue days = 10 - 2 = 8.
    // Penalty rate: ₹50/day. Expected = 8 * 50 = ₹400.
    const updatedInv = await prisma.invoice.findUnique({
      where: { id: inv2.id }
    });
    expect(Number(updatedInv?.lateFeeAccumulated)).toBe(400);
    expect(updatedInv?.status).toBe("OVERDUE");
  });

  test("Step 4: Leaving Certificate lock & override verification", async ({ page }) => {
    const student = await prisma.student.findFirst({
      where: { firstName: studentFirstName, lastName: studentLastName }
    });
    if (!student) throw new Error("Student not found");

    // Student has pending dues (Invoice 2 is partially paid and has late fee accumulated).
    // Attempting to generate LC without override should return 400 PENDING_DUES.
    const resBlocked = await page.request.post(`/api/v1/students/${student.id}/issue-lc`, {
      data: {
        leavingDate: new Date().toISOString(),
        reasonForLeaving: "Transfer to different city",
        conduct: "Good",
        remarks: "Active dues check",
        status: "TRANSFERRED",
        allowOverride: false,
      }
    });

    expect(resBlocked.status()).toBe(400);
    const bodyBlocked = await resBlocked.json();
    expect(bodyBlocked.error?.code).toBe("PENDING_DUES");

    // Attempting to override dues as COUNSELOR role (not allowed)
    const counselorContext = await page.context().browser()?.newContext({ storageState: STORAGE_STATE_COUNSELOR });
    if (counselorContext) {
      const pageCounselor = await counselorContext.newPage();
      const resForbidden = await pageCounselor.request.post(`/api/v1/students/${student.id}/issue-lc`, {
        data: {
          leavingDate: new Date().toISOString(),
          reasonForLeaving: "Transfer",
          conduct: "Good",
          status: "TRANSFERRED",
          allowOverride: true,
        }
      });
      expect([403, 401]).toContain(resForbidden.status());
      await counselorContext.close();
    }

    // Now call with allowOverride: true as Admin. Should succeed!
    const resSucceed = await page.request.post(`/api/v1/students/${student.id}/issue-lc`, {
      data: {
        leavingDate: new Date().toISOString(),
        reasonForLeaving: "Emergency relocation",
        conduct: "Excellent",
        remarks: "Approved by principal",
        status: "TRANSFERRED",
        allowOverride: true,
      }
    });

    expect(resSucceed.status()).toBe(201);
    const bodySucceed = await resSucceed.json();
    expect(bodySucceed.success).toBe(true);

    // Verify leaving certificate is recorded in database
    const lc = await prisma.leavingCertificate.findFirst({
      where: { studentId: student.id }
    });
    expect(lc).not.toBeNull();
    expect(lc?.remarks).toBe("Approved by principal");
  });
});
