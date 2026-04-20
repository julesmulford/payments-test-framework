import { Page, Locator, expect } from "@playwright/test";

// ── Login Page ────────────────────────────────────────────────────────────────

export class LoginPage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(private readonly page: Page) {
    this.usernameInput = page.locator('input[name="username"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.loginButton = page.locator('input[value="Log In"]');
    this.errorMessage = page.locator(".error");
  }

  async goto(): Promise<void> {
    await this.page.goto("/index.htm");
  }

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await expect(this.page).not.toHaveURL(/login/);
  }

  async loginExpectError(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}

// ── Accounts Overview Page ────────────────────────────────────────────────────

export class AccountsOverviewPage {
  readonly heading: Locator;
  readonly accountRows: Locator;
  readonly totalBalance: Locator;
  readonly welcomeMessage: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.locator("h1.title");
    this.accountRows = page.locator("#accountTable tbody tr");
    this.totalBalance = page.locator("#accountTable tfoot .ng-binding").last();
    this.welcomeMessage = page.locator("#leftPanel p.smallText").first();
  }

  async waitForLoad(): Promise<void> {
    await expect(this.page).toHaveURL(/overview/);
    await expect(this.accountRows.first()).toBeVisible({ timeout: 10_000 });
  }

  async getAccountCount(): Promise<number> {
    return this.accountRows.count();
  }

  async getAccountIds(): Promise<string[]> {
    const ids: string[] = [];
    const rows = await this.accountRows.all();
    for (const row of rows) {
      const link = row.locator("a").first();
      const text = await link.textContent();
      if (text) ids.push(text.trim());
    }
    return ids;
  }
}

// ── Open Account Page ─────────────────────────────────────────────────────────

export class OpenAccountPage {
  readonly accountTypeSelect: Locator;
  readonly fromAccountSelect: Locator;
  readonly openButton: Locator;
  readonly newAccountId: Locator;
  readonly successMessage: Locator;

  constructor(private readonly page: Page) {
    this.accountTypeSelect = page.locator('select[id="type"]');
    this.fromAccountSelect = page.locator('select[id="fromAccountId"]');
    this.openButton = page.locator('input[value="Open New Account"]');
    this.newAccountId = page.locator("#newAccountId");
    this.successMessage = page.locator("#openAccountResult h1");
  }

  async goto(): Promise<void> {
    await this.page.goto("/openaccount.htm");
  }

  async openSavingsAccount(fromAccountId: string): Promise<string> {
    await this.accountTypeSelect.selectOption("1");
    await this.fromAccountSelect.selectOption(fromAccountId);
    await this.openButton.click();
    await expect(this.newAccountId).toBeVisible({ timeout: 10_000 });
    return (await this.newAccountId.textContent()) ?? "";
  }

  async openCheckingAccount(fromAccountId: string): Promise<string> {
    await this.accountTypeSelect.selectOption("0");
    await this.fromAccountSelect.selectOption(fromAccountId);
    await this.openButton.click();
    await expect(this.newAccountId).toBeVisible({ timeout: 10_000 });
    return (await this.newAccountId.textContent()) ?? "";
  }
}

// ── Transfer Funds Page ───────────────────────────────────────────────────────

export class TransferPage {
  readonly fromAccountSelect: Locator;
  readonly toAccountSelect: Locator;
  readonly amountInput: Locator;
  readonly transferButton: Locator;
  readonly successMessage: Locator;
  readonly transferredAmount: Locator;
  readonly fromAccountConfirm: Locator;
  readonly toAccountConfirm: Locator;

  constructor(private readonly page: Page) {
    this.fromAccountSelect = page.locator('select[id="fromAccountId"]');
    this.toAccountSelect = page.locator('select[id="toAccountId"]');
    this.amountInput = page.locator('input[id="amount"]');
    this.transferButton = page.locator('input[value="Transfer"]');
    this.successMessage = page.locator("#showResult h1");
    this.transferredAmount = page.locator("#amount");
    this.fromAccountConfirm = page.locator("#fromAccountId");
    this.toAccountConfirm = page.locator("#toAccountId");
  }

  async goto(): Promise<void> {
    await this.page.goto("/transfer.htm");
  }

  async transfer(
    fromAccountId: string,
    toAccountId: string,
    amount: number
  ): Promise<void> {
    await this.fromAccountSelect.selectOption(fromAccountId);
    await this.toAccountSelect.selectOption(toAccountId);
    await this.amountInput.fill(String(amount));
    await this.transferButton.click();
    await expect(this.successMessage).toBeVisible({ timeout: 10_000 });
  }

  async getSuccessText(): Promise<string> {
    return (await this.successMessage.textContent()) ?? "";
  }
}

// ── Transaction History Page ──────────────────────────────────────────────────

export class TransactionHistoryPage {
  readonly transactionRows: Locator;
  readonly accountHeading: Locator;
  readonly noTransactionsMessage: Locator;

  constructor(private readonly page: Page) {
    this.transactionRows = page.locator("#transactionTable tbody tr");
    this.accountHeading = page.locator("h1.title");
    this.noTransactionsMessage = page.locator("#noTransactions");
  }

  async gotoForAccount(accountId: string): Promise<void> {
    await this.page.goto(`/activity.htm?id=${accountId}`);
    await this.page.waitForLoadState("networkidle");
  }

  async getTransactionCount(): Promise<number> {
    return this.transactionRows.count();
  }

  async getAllAmounts(): Promise<string[]> {
    const amounts: string[] = [];
    const rows = await this.transactionRows.all();
    for (const row of rows) {
      const cells = await row.locator("td").all();
      if (cells.length >= 4) {
        const amount = await cells[3].textContent();
        if (amount) amounts.push(amount.trim());
      }
    }
    return amounts;
  }
}
