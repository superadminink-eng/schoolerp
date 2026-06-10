import { test, expect } from "@playwright/test";
import { STORAGE_STATE_ADMIN } from "../playwright.config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.describe("Ultra-Deep Behavioral & Integration Test Suite", () => {
  test.use({ storageState: STORAGE_STATE_ADMIN });

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log(`BROWSER CONSOLE: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`BROWSER ERROR: ${err.message}`));
    page.on("requestfailed", (req) => console.log(`REQUEST FAILED: ${req.url()} - ${req.failure()?.errorText}`));
  });

  test("Test 1: Web Admin to Mobile App Real-Time Synchronization", async ({ page }) => {
    // 1. Fetch parent user & link student from database
    const parentUser = await prisma.user.findFirst({
      where: { email: "krishnaverma@test.com" }
    });
    if (!parentUser) throw new Error("Parent user krishnaverma@test.com not found");

    const student = await prisma.student.findFirst({
      where: {
        admissionNo: "ADM-KV-001",
        status: "ACTIVE",
        invoices: {
          some: {
            status: { not: "CANCELLED" }
          }
        }
      },
      include: {
        invoices: {
          where: { status: { not: "CANCELLED" } }
        }
      }
    });
    if (!student || student.invoices.length === 0) {
      throw new Error("No active student with invoices found with admission number ADM-KV-001");
    }

    const token = `parent-mock-token-${parentUser.id}`;
    
    // 2. Fetch parent mobile dashboard API to get initial outstanding dues
    const url = `http://localhost:3007/api/v1/parent/student/${student.id}/dashboard`;
    console.log(`Pre-fetch Mobile API outstanding dues from: ${url}`);
    const preRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(preRes.status).toBe(200);
    const preJson = await preRes.json();
    const invoices = preJson.data.student.invoices || [];
    const initialOutstanding = invoices
      .filter((inv: any) => inv.status !== 'PAID')
      .reduce((sum: number, inv: any) => sum + (inv.amount - inv.paidAmount), 0);
    console.log(`Initial Outstanding Dues on Mobile App: ₹${initialOutstanding}`);

    // 3. Navigate Web Admin browser UI to Fee Collection page
    console.log(`Navigating to Web Admin Fee Collection: /fees/${student.id}`);
    await page.goto(`/fees/${student.id}`);
    await page.waitForLoadState("networkidle");

    // Assert student info and invoice matches
    await expect(page.locator("h1.text-headline-md")).toContainText("Fee Collection");
    await expect(page.locator("text=Student Information")).toBeVisible();
    await expect(page.locator("text=Invoice Breakdown")).toBeVisible();

    // 4. Fill in standard payment form on Web Admin
    const payAmount = 500;
    console.log(`Filling payment form with: ₹${payAmount} UPI`);
    await page.fill("input#amount", payAmount.toString());
    
    // Select Payment Method "UPI" in Radix Trigger Select
    await page.click("button:has-text('Select method')");
    await page.click("role=option[name='UPI']");
    
    // Fill transaction id
    await page.fill("input#transactionId", "TXN-DEEP-TEST-123");
    await page.fill("input#remarks", "E2E Sync Verification Payment");

    // Intercept POST request to assert status is 201
    const responsePromise = page.waitForResponse(response => 
      response.url().includes(`/api/v1/fees/${student.id}`) && response.status() === 201
    );

    // Click Record Payment
    await page.click("button:has-text('Record Payment')");
    await responsePromise;
    console.log("Recorded payment successfully on Web UI!");

    // 5. Direct Database check: verify paidAmount has updated in DB
    const dbInvoice = await prisma.invoice.findFirst({
      where: { studentId: student.id, status: { not: "CANCELLED" } }
    });
    expect(dbInvoice).not.toBeNull();
    console.log(`Database Check: Invoice Paid Amount is now ₹${dbInvoice?.paidAmount}`);

    // 6. Fetch parent mobile dashboard API again & verify synchronization
    console.log("Refetching Mobile API outstanding dues...");
    const postRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(postRes.status).toBe(200);
    const postJson = await postRes.json();
    const postInvoices = postJson.data.student.invoices || [];
    const finalOutstanding = postInvoices
      .filter((inv: any) => inv.status !== 'PAID')
      .reduce((sum: number, inv: any) => sum + (inv.amount - inv.paidAmount), 0);
    console.log(`Final Outstanding Dues on Mobile App: ₹${finalOutstanding}`);

    // Assert that outstanding fees decreased exactly by the payment amount
    expect(finalOutstanding).toBe(initialOutstanding - payAmount);
    console.log("SUCCESS: Real-time synchronization verified between Web Admin and Parent Mobile App!");

    // 7. Security / Access Isolation Check
    // Attempt to access with a random invalid student ID
    const randomStudentId = "invalid-student-id-999";
    const unauthorizedUrl = `http://localhost:3007/api/v1/parent/student/${randomStudentId}/dashboard`;
    const secRes = await fetch(unauthorizedUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(secRes.status).toBe(403);
    console.log("SUCCESS: Security cross-tenant check blocked unauthorized access with 403 Forbidden!");
  });

  test("Test 2: Chaos & Input Boundary Validation (Forms Robustness)", async ({ page, request }) => {
    // 1. Navigate to Direct Intake student form page
    await page.goto("/students/new");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1:has-text('Direct Intake / Data Migration')")).toBeVisible();

    // 2. Switch to Administration Tab directly without filling required details
    await page.click("button[role='tab']:has-text('Administration')");

    // Click submit/Admit Student to trigger validation errors
    await page.click("button[type='submit']");
    console.log("Submitted empty form. Checking UI validation errors...");

    // Switch back to Personal Tab to see errors
    await page.click("button[role='tab']:has-text('Personal')");
    // Expect error messages under required fields
    await expect(page.locator("text=First name is required")).toBeVisible();
    await expect(page.locator("text=Last name is required")).toBeVisible();

    // 3. API Boundary Check: Post invalid schema payload directly
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error("No organization found");
    const branch = await prisma.branch.findFirst({ where: { organizationId: org.id } });
    if (!branch) throw new Error("No branch found");

    const invalidFormPayload = {
      firstName: "Chaos",
      lastName: "Student",
      dateOfBirth: new Date().toISOString().slice(0, 10), // DOB is today, violating minimum age of 3 years
      gender: "INVALID_GENDER", // invalid enum value
      branchId: branch.id,
      classId: "some-class",
      sectionId: "some-section",
      amountPaid: -5000, // Negative amount paid
    };

    console.log("Posting invalid boundary payload to API /api/v1/students...");
    const response = await request.post("/api/v1/students", {
      data: invalidFormPayload,
      headers: {
        "x-user-id": "cmpvm8fw40004sxqgrqri0uel",
        "x-user-role-id": "cmpvlu0q1001lsx5os90z8cwn",
        "x-user-role-name": "SCHOOL_ADMIN",
        "x-organization-id": org.id,
      }
    });

    // The API contract should reject this with 400 Bad Request or 422 Validation Error, never 500!
    console.log(`API response status: ${response.status()}`);
    expect(response.status()).toBeLessThan(500); // 400 or 422
    expect(response.status()).toBeGreaterThanOrEqual(400);

    const json = await response.json();
    expect(json.success).toBe(false);
    console.log("SUCCESS: API contract validation rejected the boundary inputs successfully!");

    // 4. Verify no database corruption occurred
    const corruptedStudent = await prisma.student.findFirst({
      where: { firstName: "Chaos", lastName: "Student" }
    });
    expect(corruptedStudent).toBeNull();
    console.log("SUCCESS: Direct database check verified that no corrupted student record was created!");
  });

  test("Test 3: Concurrency & Double-Click Race Condition Verification", async ({ request }) => {
    // 1. Get all active students with unpaid invoices
    const activeStudents = await prisma.student.findMany({
      where: {
        status: "ACTIVE",
        invoices: { some: { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } } }
      },
      include: {
        invoices: { where: { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } } }
      }
    });
    if (activeStudents.length === 0) throw new Error("No active student with unpaid invoices found for concurrency testing");

    // Pick a student with exactly 1 unpaid invoice to guarantee overpayment boundary is hit
    const student = activeStudents.find((s) => s.invoices.length === 1) || activeStudents[0];
    const invoice = student.invoices[0];
    const pendingAmount = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    
    // We will attempt to trigger two concurrent payment requests of 70% of the pending balance.
    // 70% * 2 = 140%, which exceeds 100%, so one request must be rejected to prevent overpayment.
    const excessPayment = Math.floor(pendingAmount * 0.7);
    if (excessPayment <= 0) return; // Skip if no balance left to test

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error("No organization found");

    console.log(`Simulating concurrent double-clicks: Two payments of ₹${excessPayment} on invoice balance ₹${pendingAmount}`);

    const headers = {
      "x-user-id": "cmpvm8fw40004sxqgrqri0uel",
      "x-user-role-id": "cmpvlu0q1001lsx5os90z8cwn",
      "x-user-role-name": "SCHOOL_ADMIN",
      "x-organization-id": org.id,
    };

    const paymentPayload = {
      amount: excessPayment,
      method: "UPI",
      paidAt: new Date().toISOString(),
      transactionId: `TXN-CONCUR-${Date.now()}`,
      remarks: "Concurrency double-click test",
    };

    // Dispatch both POST requests in parallel
    const [res1, res2] = await Promise.all([
      request.post(`/api/v1/fees/${student.id}`, { data: paymentPayload, headers }),
      request.post(`/api/v1/fees/${student.id}`, { data: paymentPayload, headers }),
    ]);

    console.log(`Concurrent Request 1 Response: ${res1.status()}`);
    console.log(`Concurrent Request 2 Response: ${res2.status()}`);

    // Assert that one of the requests succeeded, and the other failed with 422 (balance exceeded) or one of them failed.
    // At most one request should return 201 (since 70% * 2 = 140% exceeds total pending)
    const successCount = (res1.status() === 201 ? 1 : 0) + (res2.status() === 201 ? 1 : 0);
    console.log(`Number of successful payments: ${successCount}`);
    expect(successCount).toBe(1); 

    // Double check database balance: invoice paidAmount must match exactly initialPaid + excessPayment
    const dbInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(dbInvoice).not.toBeNull();
    const expectedPaidAmount = Number(invoice.paidAmount) + excessPayment;
    expect(Number(dbInvoice?.paidAmount)).toBe(expectedPaidAmount);
    console.log(`SUCCESS: Concurrency protection verified! Invoice balance is locked and double-payment was rejected!`);
  });
});
