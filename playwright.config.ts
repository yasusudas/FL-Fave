import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.e2e.ts",
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  outputDir: "/tmp/fl-fave-e2e-results",
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    channel: "chrome",
    viewport: { width: 1200, height: 900 },
    acceptDownloads: true,
  },
  reporter: "list",
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
  },
});
