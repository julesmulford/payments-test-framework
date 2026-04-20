import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests",
  timeout: 45_000,
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results.json" }],
  ],
  use: {
    baseURL: process.env.PARABANK_BASE_URL ?? "http://localhost:3000/parabank",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
