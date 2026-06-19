import { defineConfig, devices } from "@playwright/test";
import path from "path";

const SCRATCH_DIR = path.join(__dirname, "tests", "tmp");

export const STORAGE_STATE_ADMIN = path.join(SCRATCH_DIR, "auth/admin.json");
export const STORAGE_STATE_COUNSELOR = path.join(SCRATCH_DIR, "auth/counselor.json");

export default defineConfig({
  testDir: "./tests",
  outputDir: path.join(SCRATCH_DIR, "test-results"),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  expect: {
    toHaveScreenshot: { maxDiffPixels: 200, threshold: 0.2 },
  },
  reporter: [["html", { outputFolder: path.join(SCRATCH_DIR, "playwright-report"), open: "never" }]],
  globalSetup: require.resolve("./tests/global-setup"),
  globalTeardown: require.resolve("./tests/global-teardown"),
  use: {
    baseURL: "http://localhost:3007",
    trace: "on-first-retry",
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
