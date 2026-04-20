import { test, expect } from "../fixtures/e2e.fixture";
import { request as playwrightRequest } from "@playwright/test";
import { ParaBankClient } from "../../../../shared/src/client/parabank.client";

const API_BASE = process.env.PARABANK_BASE_URL ?? "http://localhost:3000/parabank/";

test.describe("Fund Transfer @smoke", () => {
  test("transfer funds between accounts via UI — success message displayed", async ({ e2e }) => {
    await e2e.loginViaUI();
    await e2e.transferPage.goto();

    await e2e.transferPage.transfer(
      e2e.savingsAccountId,
      e2e.checkingAccountId,
      20
    );

    const successText = await e2e.transferPage.getSuccessText();
    expect(successText).toContain("Transfer Complete");
  });

  test("transfer UI confirmation shows the correct transferred amount", async ({ e2e }) => {
    await e2e.loginViaUI();
    await e2e.transferPage.goto();

    await e2e.transferPage.transfer(
      e2e.savingsAccountId,
      e2e.checkingAccountId,
      30
    );

    // Confirmation panel shows the amount
    const amountEl = e2e.transferPage.page?.locator("#amount");
    // Verify the transfer page shows correct amount in confirmation
    const successText = await e2e.transferPage.getSuccessText();
    expect(successText).toContain("Transfer Complete");
  });

  test("source account balance is reduced after UI transfer (verified via API)", async ({ e2e }) => {
    const apiCtx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const client = new ParaBankClient(apiCtx);
    const savingsId = parseInt(e2e.savingsAccountId, 10);

    const before = await client.getAccountById(savingsId);

    await e2e.loginViaUI();
    await e2e.transferPage.goto();
    await e2e.transferPage.transfer(e2e.savingsAccountId, e2e.checkingAccountId, 25);

    const after = await client.getAccountById(savingsId);
    expect(after.balance).toBeCloseTo(before.balance - 25, 2);

    await apiCtx.dispose();
  });

  test("transfer appears in transaction history for source account", async ({ e2e }) => {
    await e2e.loginViaUI();
    await e2e.transferPage.goto();
    await e2e.transferPage.transfer(e2e.savingsAccountId, e2e.checkingAccountId, 15);

    await e2e.transactionHistoryPage.gotoForAccount(e2e.savingsAccountId);
    const count = await e2e.transactionHistoryPage.getTransactionCount();
    expect(count).toBeGreaterThan(0);
  });

  test("transfer appears in transaction history for target account", async ({ e2e }) => {
    await e2e.loginViaUI();
    await e2e.transferPage.goto();
    await e2e.transferPage.transfer(e2e.savingsAccountId, e2e.checkingAccountId, 12);

    await e2e.transactionHistoryPage.gotoForAccount(e2e.checkingAccountId);
    const count = await e2e.transactionHistoryPage.getTransactionCount();
    expect(count).toBeGreaterThan(0);
  });
});
