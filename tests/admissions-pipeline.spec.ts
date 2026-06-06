import { test, expect } from "@playwright/test";
import { STORAGE_STATE_ADMIN, STORAGE_STATE_COUNSELOR } from "../playwright.config";

test.describe("Admissions Desk - Counselor Flow", () => {
  test.use({ storageState: STORAGE_STATE_COUNSELOR });

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log(`BROWSER CONSOLE [Counselor]: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`BROWSER ERROR [Counselor]: ${err.message}`));
    page.on("requestfailed", (req) => console.log(`REQUEST FAILED [Counselor]: ${req.url()} - ${req.failure()?.errorText}`));
  });

  test("Counselor can log inquiry and see it in list", async ({ page }) => {
    // 1. Go to admissions desk
    await page.goto("/admissions");
    await expect(page.locator("h1.text-headline-md")).toContainText("Admissions Overview Desk");
    
    // 2. Verify counselor only sees Counselor Inquiries
    await expect(page.locator("button:has-text('Applications Desk')")).not.toBeVisible();
    await expect(page.locator("button:has-text('Counselor Inquiries')")).toBeVisible();
    
    // 3. Create new inquiry
    await page.click("button:has-text('New Inquiry')");
    await page.click("button:has-text('Autofill')");
    await page.click("button[type='submit']:has-text('Log Inquiry')");
    
    // 4. Verify it appears in table
    const row = page.locator("tr:has-text('Omkar Ranade')");
    await expect(row).toBeVisible();
    await expect(row.locator("td").nth(4)).toContainText("INQUIRY");
  });

  test("Counselor cannot see document verification or test logs", async ({ page }) => {
    // 1. Go to admissions desk
    await page.goto("/admissions");
    
    // 2. Try to access verification/exams/promotions (which are application desk items)
    await expect(page.locator("button:has-text('Applications Desk')")).not.toBeVisible();
    await expect(page.locator("button:has-text('New Application')")).not.toBeVisible();
  });
});

test.describe("Admissions Desk - Admin Flow", () => {
  test.use({ storageState: STORAGE_STATE_ADMIN });

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log(`BROWSER CONSOLE [Admin]: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`BROWSER ERROR [Admin]: ${err.message}`));
    page.on("requestfailed", (req) => console.log(`REQUEST FAILED [Admin]: ${req.url()} - ${req.failure()?.errorText}`));
  });

  test("Admin can promote counselor inquiry to formal application", async ({ page }) => {
    // 1. Go to admissions desk
    await page.goto("/admissions");
    await expect(page.locator("h1.text-headline-md")).toContainText("Admissions Overview Desk");
    
    // 2. Admin sees both desks
    await expect(page.locator("button:has-text('Applications Desk')")).toBeVisible();
    await expect(page.locator("button:has-text('Counselor Inquiries')")).toBeVisible();
    
    // 3. Click Counselor Inquiries tab
    await page.click("button:has-text('Counselor Inquiries')");
    
    // 4. Promote "Omkar Ranade" to Application
    const row = page.locator("tr:has-text('Omkar Ranade')");
    await expect(row).toBeVisible();
    await row.locator("button:has-text('Fill Application')").click();
    
    // Fill the required application fields that are not copied from the inquiry
    await page.fill("label:has-text('Address') + input", "Flat 101, Shanti Niketan, Kothrud, Pune");
    await page.fill("label:has-text('Pincode') + input", "411038");
    await page.fill("label:has-text('Emergency Phone') + input", "9822334455");
    
    // 5. Submit the pre-filled application form
    await page.click("button[type='submit']:has-text('Submit Application')");
    await expect(page.locator("button[type='submit']:has-text('Submit Application')")).toBeHidden();
    
    // 6. Verify Omkar appears in the Applications Desk tab
    await page.click("button:has-text('Applications Desk')");
    await expect(page.locator("tr:has-text('Omkar Ranade')")).toBeVisible();
  });
});
