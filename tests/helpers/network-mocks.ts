import { type Page } from "@playwright/test";

/**
 * Intercepts external analytics, font CDNs, and image requests to ensure tests
 * are isolated, faster, and offline-compatible.
 */
export async function setupMockRoutes(page: Page) {
  // 1. Intercept analytics and tracker engines
  await page.route(/(google-analytics\.com|googletagmanager\.com)/, (route) => {
    route.fulfill({ status: 200, body: "" });
  });

  // 2. Intercept and mock image loading with a 1x1 transparent placeholder
  await page.route(/\.(png|jpg|jpeg|gif|svg|webp)(\?.*)?$/, (route) => {
    const transparentPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(transparentPngBase64, "base64"),
    });
  });

  // 3. Mock external identity toolkit / verification calls
  await page.route(/identitytoolkit\.googleapis\.com\/v1\/accounts/, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ localId: "mock-uid-123", email: "test@school.com" }),
    });
  });
}
