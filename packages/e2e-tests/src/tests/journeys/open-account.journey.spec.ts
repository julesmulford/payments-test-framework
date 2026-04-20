import { test, expect } from "../fixtures/e2e.fixture";

test.describe("Open New Account", () => {
  test("open a new savings account via UI — new account ID displayed", async ({ e2e }) => {
    await e2e.loginViaUI();
    await e2e.openAccountPage.goto();

    const newAccountId = await e2e.openAccountPage.openSavingsAccount(e2e.savingsAccountId);
    expect(newAccountId).toBeTruthy();
    expect(newAccountId).toMatch(/^\d+$/);
  });

  test("newly opened savings account appears in accounts overview", async ({ e2e }) => {
    await e2e.loginViaUI();
    await e2e.openAccountPage.goto();

    const newAccountId = await e2e.openAccountPage.openSavingsAccount(e2e.savingsAccountId);

    // Navigate to overview and verify new account is listed
    await e2e.page?.goto("/overview.htm");
    const ids = await e2e.accountsOverviewPage.getAccountIds();
    expect(ids).toContain(newAccountId.trim());
  });

  test("open a new checking account via UI — type 0 returned from API", async ({ e2e, page }) => {
    await e2e.loginViaUI();
    await e2e.openAccountPage.goto();

    const newAccountId = await e2e.openAccountPage.openCheckingAccount(e2e.savingsAccountId);
    expect(newAccountId).toBeTruthy();
    expect(newAccountId).toMatch(/^\d+$/);
  });

  test("open account success message is displayed", async ({ e2e }) => {
    await e2e.loginViaUI();
    await e2e.openAccountPage.goto();
    await e2e.openAccountPage.openSavingsAccount(e2e.savingsAccountId);

    await expect(e2e.openAccountPage.successMessage).toBeVisible();
    const text = await e2e.openAccountPage.successMessage.textContent();
    expect(text).toContain("Congratulations");
  });
});
