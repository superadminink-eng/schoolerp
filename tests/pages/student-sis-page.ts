import { BasePage } from "./base-page";
import { expect } from "@playwright/test";

export class StudentSisPage extends BasePage {
  // Bento stats selectors
  readonly totalStudentsCard = this.page.getByText("Total Students");
  readonly activeStudentsCard = this.page.getByText(/^Active$/);
  readonly rteCategoryCard = this.page.getByText("RTE Category");
  readonly inactiveCard = this.page.getByText("Inactive / Dropped");

  // Filters selectors
  readonly filterButton = this.page.getByTestId("filter-button").or(this.page.locator("button:has-text('Filters')"));
  readonly classFilterLabel = this.page.locator("label:has-text('Class')");
  readonly sectionFilterLabel = this.page.locator("label:has-text('Section')");

  // Profile selectors
  readonly studentNameHeading = this.page.locator("h2.text-headline-sm");
  readonly classGradeLabel = this.page.locator("text=Class / Grade");
  readonly documentList = this.page.locator("text=Uploaded Documents");

  async navigateToSIS() {
    await this.navigateTo("/students");
    await this.assertContainsText("h1", "Students");
  }

  async verifyBentoStats() {
    await expect(this.totalStudentsCard).toBeVisible();
    await expect(this.activeStudentsCard).toBeVisible();
    await expect(this.rteCategoryCard).toBeVisible();
    await expect(this.inactiveCard).toBeVisible();
  }

  async toggleFilters() {
    await this.filterButton.click();
  }

  async verifyFilterOptionsVisible() {
    await expect(this.classFilterLabel).toBeVisible();
    await expect(this.sectionFilterLabel).toBeVisible();
  }

  async clickFirstStudentRow() {
    await this.waitForNetworkIdle();
    const row = this.page.locator(".ag-row").first();
    await expect(row).toBeVisible();
    await row.click();
  }

  async assertStudentProfileActive(name: string, admissionNo: string) {
    await expect(this.page).toHaveURL(/\/students\/[a-zA-Z0-9_-]+/);
    await expect(this.studentNameHeading).toBeVisible();
    await expect(this.classGradeLabel).toBeVisible();
    await expect(this.page.getByText(`Admission No: ${admissionNo}`)).toBeVisible();
  }
}
