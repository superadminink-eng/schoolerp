import { test as base, Page } from "@playwright/test";
import { StudentSisPage } from "../pages/student-sis-page";
import { BillingLedgerPage } from "../pages/billing-ledger-page";
import { STORAGE_STATE_ADMIN, STORAGE_STATE_COUNSELOR } from "../../playwright.config";

type CustomFixtures = {
  adminPage: Page;
  counselorPage: Page;
  studentSisPage: StudentSisPage;
  billingLedgerPage: BillingLedgerPage;
};

export const test = base.extend<CustomFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE_ADMIN });
    const page = await context.newPage();
    await page.goto("/dashboard");
    await use(page);
    await context.close();
  },
  counselorPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE_COUNSELOR });
    const page = await context.newPage();
    await page.goto("/dashboard");
    await use(page);
    await context.close();
  },
  studentSisPage: async ({ adminPage }, use) => {
    const sisPage = new StudentSisPage(adminPage);
    await use(sisPage);
  },
  billingLedgerPage: async ({ adminPage }, use) => {
    const ledgerPage = new BillingLedgerPage(adminPage);
    await use(ledgerPage);
  },
});

export { expect } from "@playwright/test";
