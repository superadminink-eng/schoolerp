import { defineConfig, devices } from "@playwright/test";
import path from "path";

const SCRATCH_DIR = "C:/Users/Admin/.gemini/antigravity/brain/532c3931-a4a0-4f51-ab61-122b1ddfd523/scratch";

export const STORAGE_STATE_ADMIN = path.join(SCRATCH_DIR, "auth/admin.json");
export const STORAGE_STATE_COUNSELOR = path.join(SCRATCH_DIR, "auth/counselor.json");

export default defineConfig({
  testDir: "./tests",
  outputDir: path.join(SCRATCH_DIR, "test-results"),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { outputFolder: path.join(SCRATCH_DIR, "playwright-report"), open: "never" }]],
  globalSetup: require.resolve("./tests/global-setup"),
  use: {
    baseURL: "http://localhost:3007",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
