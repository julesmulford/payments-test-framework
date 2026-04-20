import { test, expect } from "../fixtures/e2e.fixture";

test.describe("Register and Login @smoke", () => {
  test("customer created via API can log in via UI and see accounts overview", async ({ e2e }) => {
    await e2e.loginViaUI();
    await expect(e2e.accountsOverviewPage.accountRows.first()).toBeVisible();
  });

  test("accounts overview shows at least two accounts after fixture setup", async ({ e2e }) => {
    await e2e.loginViaUI();
    const count = await e2e.accountsOverviewPage.getAccountCount();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("savings account ID from API setup appears in the accounts table", async ({ e2e }) => {
    await e2e.loginViaUI();
    const ids = await e2e.accountsOverviewPage.getAccountIds();
    expect(ids).toContain(e2e.savingsAccountId);
  });

  test("checking account ID from API setup appears in the accounts table", async ({ e2e }) => {
    await e2e.loginViaUI();
    const ids = await e2e.accountsOverviewPage.getAccountIds();
    expect(ids).toContain(e2e.checkingAccountId);
  });

  test("invalid credentials show an error and do not navigate away", async ({ page, e2e }) => {
    await e2e.loginPage.goto();
    await e2e.loginPage.loginExpectError("nonexistent_user_xyz", "wrongpassword");
    // Should remain on login page — error is displayed
    await expect(page).toHaveURL(/index/);
    await expect(e2e.loginPage.errorMessage).toBeVisible();
  });
});
