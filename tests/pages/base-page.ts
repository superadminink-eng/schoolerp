import { type Page, type Locator, expect } from "@playwright/test";

export class BasePage {
  constructor(public readonly page: Page) {}

  /**
   * Helper to navigate to a relative URL.
   */
  async navigateTo(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState("load");
  }

  /**
   * Waits for the network to be completely idle.
   */
  async waitForNetworkIdle() {
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Verifies that a locator is visible on the viewport.
   */
  async assertVisible(locator: Locator | string) {
    const loc = typeof locator === "string" ? this.page.locator(locator) : locator;
    await expect(loc).toBeVisible({ timeout: 10000 });
  }

  /**
   * Verifies that a locator contains expected text.
   */
  async assertContainsText(locator: Locator | string, text: string) {
    const loc = typeof locator === "string" ? this.page.locator(locator) : locator;
    await expect(loc).toContainText(text, { timeout: 10000 });
  }

  /**
   * Clicks a button identified by text role or locator.
   */
  async clickButton(nameOrSelector: string | RegExp) {
    const locator = typeof nameOrSelector === "string" && nameOrSelector.startsWith(".")
      ? this.page.locator(nameOrSelector)
      : this.page.getByRole("button", { name: nameOrSelector });
    await locator.click();
  }

  /**
   * Fills an input field identified by label, placeholder, or selector.
   */
  async fillInput(labelOrSelector: string, value: string) {
    let locator;
    if (labelOrSelector.startsWith("#") || labelOrSelector.startsWith(".")) {
      locator = this.page.locator(labelOrSelector);
    } else {
      locator = this.page.getByLabel(labelOrSelector).or(this.page.getByPlaceholder(labelOrSelector));
    }
    await locator.fill(value);
  }
}
