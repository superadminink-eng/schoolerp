import { BasePage } from "./base-page";
import { expect } from "@playwright/test";

export class BillingLedgerPage extends BasePage {
  readonly recordPaymentButton = this.page.getByRole("button", { name: /Record Payment/i });
  readonly paymentModalTitle = this.page.getByText("Record Fee Payment");
  readonly submitPaymentButton = this.page.getByRole("button", { name: "Record Payment" });
  readonly feeLedgerTitle = this.page.locator("h1:has-text('Fee Statement')");
  readonly balanceSummary = this.page.locator(".grid:has-text('Total Outstanding')");

  async navigateToFees() {
    await this.navigateTo("/fees");
    await this.assertContainsText("h1", "Fee Ledger");
  }

  async openStudentLedger(admissionNo: string) {
    await this.waitForNetworkIdle();
    const cell = this.page.locator(`.ag-cell:has-text("${admissionNo}")`);
    await expect(cell).toBeVisible();
    await cell.click();
    await expect(this.feeLedgerTitle).toBeVisible();
  }

  async triggerPaymentModal() {
    await this.recordPaymentButton.click();
    await expect(this.paymentModalTitle).toBeVisible();
  }

  async fillPaymentForm(amount: number, method: string, transactionId = "") {
    // Fill Amount
    const amountInput = this.page.locator('input[name="amount"]');
    await amountInput.fill(amount.toString());

    // Select Method
    await this.page.locator('button[role="combobox"]').click();
    await this.page.getByRole("option", { name: method, exact: true }).click();

    // Fill optional transaction ID
    if (transactionId) {
      const txnInput = this.page.locator('input[name="transactionId"]');
      await txnInput.fill(transactionId);
    }
  }

  async submitPayment() {
    await this.submitPaymentButton.click();
    await this.waitForNetworkIdle();
  }

  async assertPaidAmountAndOutstanding(paidAmountText: string, outstandingAmountText: string) {
    await expect(this.balanceSummary).toBeVisible();
    await expect(this.page.locator(`.grid:has-text("${paidAmountText}")`)).toBeVisible();
    await expect(this.page.locator(`.grid:has-text("${outstandingAmountText}")`)).toBeVisible();
  }
}
