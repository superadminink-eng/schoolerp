import { test, expect } from "@playwright/test";
import { STORAGE_STATE_ADMIN } from "../playwright.config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.describe("Notice Board Management & Mobile Sync Test Suite", () => {
  test.use({ storageState: STORAGE_STATE_ADMIN });

  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log(`BROWSER CONSOLE: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`BROWSER ERROR: ${err.message}`));
    page.on("requestfailed", (req) => console.log(`REQUEST FAILED: ${req.url()} - ${req.failure()?.errorText}`));
  });

  test("Notice Board CRUD Lifecycle and Mobile App Sync Verification", async ({ page }) => {
    test.setTimeout(60000);
    // 1. Fetch parent user & link student from database
    const parentUser = await prisma.user.findFirst({
      where: { email: "krishnaverma@test.com" }
    });
    if (!parentUser) throw new Error("Parent user krishnaverma@test.com not found");

    const student = await prisma.student.findFirst({
      where: {
        fatherEmail: "krishnaverma@test.com",
        status: "ACTIVE"
      }
    });
    if (!student) throw new Error("No active student found for krishnaverma@test.com");

    const token = `parent-mock-token-${parentUser.id}`;
    const mobileDashboardUrl = `http://localhost:3007/api/v1/parent/student/${student.id}/dashboard`;

    // 2. Navigate to notices page
    console.log("Navigating to Notices page...");
    await page.goto("/notices");
    await page.waitForLoadState("networkidle");

    // Assert page loaded correctly
    await expect(page.locator("h1:has-text('Notice Board Management')")).toBeVisible();
    await expect(page.locator("text=Total Announcements")).toBeVisible();

    // 3. Create a Draft Notice
    console.log("Creating a draft notice...");
    // Open dialog
    await page.click("button:has-text('Create Notice')");
    await page.waitForSelector("text=Create Notice");

    // Fill details
    const draftTitle = `E2E Draft Notice ${Date.now()}`;
    await page.fill("input[placeholder*='Sports Day']", draftTitle);
    await page.fill("textarea", "This notice is a draft and should not sync to the mobile app.");

    // Keep target "PARENT" checked (checked by default, but let's make sure Parents option is present)
    await expect(page.getByText("Parents", { exact: true })).toBeVisible();

    // Keep 'Publish immediately' unchecked

    // Click Create button and wait for POST request to complete
    const createResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/v1/notices") && response.status() === 201
    );
    await page.click("button[type='submit']");
    await createResponsePromise;
    console.log("Draft notice created successfully!");

    // Search and verify draft notice exists in list
    await page.fill("input[placeholder='Search notices...']", draftTitle);
    await page.waitForTimeout(500); // Wait for filtering to apply
    await expect(page.locator(`text=${draftTitle}`)).toBeVisible();

    // Verify status is "Draft"
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();

    // 4. Verify draft notice does NOT sync to Parent Mobile App API
    console.log("Checking Parent Mobile API to ensure draft notice is NOT visible...");
    const draftRes = await fetch(mobileDashboardUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(draftRes.status).toBe(200);
    const draftJson = await draftRes.json();
    const draftNotices = draftJson.data.notices || [];
    const isDraftSynced = draftNotices.some((n: any) => n.title === draftTitle);
    expect(isDraftSynced).toBe(false);
    console.log("SUCCESS: Draft notice is not synchronized to mobile dashboard.");

    // 5. Edit and Publish the Notice
    console.log("Editing notice to publish immediately...");
    // Click the notice row to edit
    await page.click(`text=${draftTitle}`);
    await page.waitForSelector("text=Edit Notice");

    const publishTitle = `E2E Published Notice ${Date.now()}`;
    await page.fill("input[placeholder*='Sports Day']", publishTitle);
    await page.fill("textarea", "This notice is published and must sync to the parent mobile app dashboard immediately.");

    // Select "Publish immediately" checkbox/label
    await page.click("text=Publish immediately");

    // Save changes
    const patchResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/v1/notices/") && response.status() === 200
    );
    await page.click("button[type='submit']");
    await patchResponsePromise;
    console.log("Notice edited and published successfully!");

    // Search and verify published notice in list
    await page.fill("input[placeholder='Search notices...']", publishTitle);
    await page.waitForTimeout(500); // Wait for filtering
    await expect(page.locator(`text=${publishTitle}`)).toBeVisible();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();

    // 6. Verify published notice SYNCED to Parent Mobile App API
    console.log("Checking Parent Mobile API to ensure published notice IS visible...");
    const pubRes = await fetch(mobileDashboardUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(pubRes.status).toBe(200);
    const pubJson = await pubRes.json();
    const pubNotices = pubJson.data.notices || [];
    const syncedNotice = pubNotices.find((n: any) => n.title === publishTitle);
    expect(syncedNotice).toBeDefined();
    expect(syncedNotice.description).toContain("This notice is published");
    console.log("SUCCESS: Real-time synchronization confirmed on parent mobile dashboard!");

    // 7. Delete the published notice
    console.log("Deleting the notice...");
    // Open action menu and delete using precise element ID
    await page.click(`#actions-trigger-${syncedNotice.id}`);
    await page.click("text=Delete");

    const deleteResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/v1/notices/") && response.status() === 200
    );
    await page.click("#confirm-delete-btn");
    await deleteResponsePromise;
    console.log("Notice deleted successfully!");

    // 8. Verify deletion synced to Mobile App API (disappears)
    console.log("Verifying deletion synced to Parent Mobile API...");
    const delRes = await fetch(mobileDashboardUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(delRes.status).toBe(200);
    const delJson = await delRes.json();
    const delNotices = delJson.data.notices || [];
    const isDeletedSynced = delNotices.some((n: any) => n.title === publishTitle);
    expect(isDeletedSynced).toBe(false);
    console.log("SUCCESS: Deletion synced to mobile app successfully!");
  });

  test("Notice Board Scheduling and Expiration Sync Verification", async ({ page }) => {
    test.setTimeout(60000);
    // 1. Fetch parent user & link student from database
    const parentUser = await prisma.user.findFirst({
      where: { email: "krishnaverma@test.com" }
    });
    if (!parentUser) throw new Error("Parent user krishnaverma@test.com not found");

    const student = await prisma.student.findFirst({
      where: {
        fatherEmail: "krishnaverma@test.com",
        status: "ACTIVE"
      }
    });
    if (!student) throw new Error("No active student found for krishnaverma@test.com");

    const token = `parent-mock-token-${parentUser.id}`;
    const mobileDashboardUrl = `http://localhost:3007/api/v1/parent/student/${student.id}/dashboard`;

    // 2. Navigate to notices page
    console.log("Navigating to Notices page...");
    await page.goto("/notices");
    await page.waitForLoadState("networkidle");

    // 3. Create a Scheduled Notice
    console.log("Creating a scheduled notice...");
    await page.click("button:has-text('Create Notice')");
    await page.waitForSelector("text=Create Notice");

    const scheduledTitle = `E2E Scheduled Notice ${Date.now()}`;
    await page.fill("input[placeholder*='Sports Day']", scheduledTitle);
    await page.fill("textarea", "This notice is scheduled for the future and should not sync to the mobile app.");

    // Fill dates dynamically
    const futurePublish = new Date();
    futurePublish.setDate(futurePublish.getDate() + 2);
    const futurePublishStr = futurePublish.toISOString().split("T")[0];

    const futureExpiry = new Date();
    futureExpiry.setDate(futureExpiry.getDate() + 5);
    const futureExpiryStr = futureExpiry.toISOString().split("T")[0];

    // We keep 'Publish immediately' unchecked.
    // Fill Publish Date and Expiry Date
    await page.fill("input[type='date'] >> nth=0", futurePublishStr);
    await page.fill("input[type='date'] >> nth=1", futureExpiryStr);

    const createResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/v1/notices") && response.status() === 201
    );
    await page.click("button[type='submit']");
    await createResponsePromise;
    console.log("Scheduled notice created successfully!");

    // Search and verify scheduled notice exists in list with status "Scheduled"
    await page.fill("input[placeholder='Search notices...']", scheduledTitle);
    await page.waitForTimeout(500);
    await expect(page.locator(`text=${scheduledTitle}`)).toBeVisible();
    await expect(page.getByText("Scheduled", { exact: true })).toBeVisible();

    // 4. Verify scheduled notice does NOT sync to Parent Mobile App API
    console.log("Checking Parent Mobile API to ensure scheduled notice is NOT visible...");
    const schedRes = await fetch(mobileDashboardUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(schedRes.status).toBe(200);
    const schedJson = await schedRes.json();
    const schedNotices = schedJson.data.notices || [];
    const isSchedSynced = schedNotices.some((n: any) => n.title === scheduledTitle);
    expect(isSchedSynced).toBe(false);
    console.log("SUCCESS: Future scheduled notice is not visible on mobile dashboard.");

    // 5. Edit and Publish Immediately
    console.log("Editing scheduled notice to publish immediately...");
    await page.click(`text=${scheduledTitle}`);
    await page.waitForSelector("text=Edit Notice");

    // Click "Publish immediately" checkbox and verify that the publish date field is disabled
    await page.click("text=Publish immediately");
    const publishDateInput = page.locator("input[type='date'] >> nth=0");
    await expect(publishDateInput).toBeDisabled();

    // Save changes
    const patchResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/v1/notices/") && response.status() === 200
    );
    await page.click("button[type='submit']");
    const patchRes = await patchResponsePromise;
    const patchJson = await patchRes.json();
    const noticeId = patchJson.data.id;
    console.log("Notice edited to publish immediately successfully!");

    // Search and verify published notice status in list
    await page.fill("input[placeholder='Search notices...']", scheduledTitle);
    await page.waitForTimeout(500);
    await expect(page.locator(`text=${scheduledTitle}`)).toBeVisible();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();

    // 6. Verify published notice IS visible on Parent Mobile App API
    console.log("Checking Parent Mobile API to ensure notice is now visible...");
    const pubRes = await fetch(mobileDashboardUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(pubRes.status).toBe(200);
    const pubJson = await pubRes.json();
    const pubNotices = pubJson.data.notices || [];
    const syncedNotice = pubNotices.find((n: any) => n.title === scheduledTitle);
    expect(syncedNotice).toBeDefined();
    console.log("SUCCESS: Real-time synchronization confirmed on mobile dashboard after publishing immediately!");

    // 7. Edit notice to expire it (set publish date to yesterday, expiry date to yesterday)
    console.log("Editing notice to set expiry date to yesterday (expired)...");
    await page.click(`text=${scheduledTitle}`);
    await page.waitForSelector("text=Edit Notice");

    // Uncheck "Publish immediately" to allow modifying dates
    await page.click("text=Publish immediately");
    await expect(publishDateInput).toBeEnabled();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const pastExpiry = new Date();
    pastExpiry.setDate(pastExpiry.getDate() - 1);
    const pastExpiryStr = pastExpiry.toISOString().split("T")[0];

    // Fill dates
    await page.fill("input[type='date'] >> nth=0", yesterdayStr);
    await page.fill("input[type='date'] >> nth=1", pastExpiryStr);

    const patchExpirePromise = page.waitForResponse(
      (response) => response.url().includes("/api/v1/notices/") && response.status() === 200
    );
    await page.click("button[type='submit']");
    await patchExpirePromise;
    console.log("Notice edited to expired successfully!");

    // 8. Verify expired notice does NOT sync to Parent Mobile App API
    console.log("Checking Parent Mobile API to ensure expired notice is NOT visible...");
    const expRes = await fetch(mobileDashboardUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(expRes.status).toBe(200);
    const expJson = await expRes.json();
    const expNotices = expJson.data.notices || [];
    const isExpiredSynced = expNotices.some((n: any) => n.title === scheduledTitle);
    expect(isExpiredSynced).toBe(false);
    console.log("SUCCESS: Expired notice is not visible on parent mobile dashboard!");

    // 9. Clean up: Delete the notice
    console.log("Deleting notice...");
    await page.click(`#actions-trigger-${noticeId}`);
    await page.click("text=Delete");

    const deletePromise = page.waitForResponse(
      (response) => response.url().includes("/api/v1/notices/") && response.status() === 200
    );
    await page.click("#confirm-delete-btn");
    await deletePromise;
    console.log("SUCCESS: Scheduled/Expired notice cleanup complete!");
  });
});
