import { test as base, request as playwrightRequest, Page } from "@playwright/test";
import { ParaBankClient } from "../../../shared/src/client/parabank.client";
import { buildCustomer } from "../../../shared/src/fixtures/customer.factory";
import {
  LoginPage,
  AccountsOverviewPage,
  OpenAccountPage,
  TransferPage,
  TransactionHistoryPage,
} from "../pages";
import type { Account } from "../../../shared/src/types/domain";

const API_BASE = process.env.PARABANK_BASE_URL ?? "http://localhost:3000/parabank/";

export interface E2EFixture {
  // Test data (created via API)
  customerId: number;
  username: string;
  password: string;
  savingsAccountId: string;
  checkingAccountId: string;

  // Page objects
  loginPage: LoginPage;
  accountsOverviewPage: AccountsOverviewPage;
  openAccountPage: OpenAccountPage;
  transferPage: TransferPage;
  transactionHistoryPage: TransactionHistoryPage;

  // Helper: log in via UI
  loginViaUI: () => Promise<void>;
}

export const test = base.extend<{ e2e: E2EFixture }>({
  e2e: async ({ page }, use) => {
    // ── Create customer via API (fast, deterministic) ─────────────────────
    const apiCtx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const client = new ParaBankClient(apiCtx);
    const customer = buildCustomer();

    await client.register(customer);
    const { customerId } = await client.login(customer.username, customer.password);
    const accounts = await client.getAccounts(customerId);
    const savings = accounts[0];
    const checking: Account = await client.openAccount(customerId, 0, savings.id);

    // ── Wire up page objects ──────────────────────────────────────────────
    const loginPage = new LoginPage(page);
    const accountsOverviewPage = new AccountsOverviewPage(page);
    const openAccountPage = new OpenAccountPage(page);
    const transferPage = new TransferPage(page);
    const transactionHistoryPage = new TransactionHistoryPage(page);

    await use({
      customerId,
      username: customer.username,
      password: customer.password,
      savingsAccountId: String(savings.id),
      checkingAccountId: String(checking.id),
      loginPage,
      accountsOverviewPage,
      openAccountPage,
      transferPage,
      transactionHistoryPage,
      loginViaUI: async () => {
        await loginPage.goto();
        await loginPage.login(customer.username, customer.password);
        await accountsOverviewPage.waitForLoad();
      },
    });

    await apiCtx.dispose();
  },
});

export { expect } from "@playwright/test";
