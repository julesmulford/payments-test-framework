import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests",
  timeout: 15_000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  projects: [
    {
      name: "component",
      use: {
        baseURL: process.env.WIREMOCK_BASE_URL ?? "http://localhost:8082/parabank/",
        extraHTTPHeaders: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      },
    },
  ],
});
