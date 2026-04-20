import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests",
  timeout: 30_000,
  retries: 1,
  workers: 2,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results.json" }],
  ],
  projects: [
    {
      name: "api",
      use: {
        baseURL: process.env.PARABANK_BASE_URL ?? "http://localhost:3000/parabank/",
        extraHTTPHeaders: {
          Accept: "application/json",
        },
      },
    },
  ],
});
