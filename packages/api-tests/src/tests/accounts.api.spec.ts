import { test, expect } from "../fixtures/api.fixture";

test.describe("Accounts API", () => {
  test("customer has at least two accounts after fixture setup", async ({ api }) => {
    const accounts = await api.client.getAccounts(api.customerId);
    expect(accounts.length).toBeGreaterThanOrEqual(2);
  });

  test("each account has required fields with correct types", async ({ api }) => {
    const accounts = await api.client.getAccounts(api.customerId);
    for (const account of accounts) {
      expect(typeof account.id).toBe("number");
      expect(typeof account.customerId).toBe("number");
      expect(typeof account.balance).toBe("number");
      expect(["CHECKING", "SAVINGS"]).toContain(account.type);
    }
  });

  test("accounts belong to the correct customer", async ({ api }) => {
    const accounts = await api.client.getAccounts(api.customerId);
    for (const account of accounts) {
      expect(account.customerId).toBe(api.customerId);
    }
  });

  test("open a savings account — returns type 1", async ({ api }) => {
    const newAccount = await api.client.openAccount(api.customerId, 1, api.savingsAccount.id);
    expect(newAccount.type).toBe("SAVINGS");
    expect(newAccount.id).toBeGreaterThan(0);
    expect(newAccount.customerId).toBe(api.customerId);
  });

  test("open a checking account — returns type 0", async ({ api }) => {
    const newAccount = await api.client.openAccount(api.customerId, 0, api.savingsAccount.id);
    expect(newAccount.type).toBe("CHECKING");
  });

  test("newly opened account appears in accounts list", async ({ api }) => {
    const newAccount = await api.client.openAccount(api.customerId, 1, api.savingsAccount.id);
    const accounts = await api.client.getAccounts(api.customerId);
    const ids = accounts.map((a) => a.id);
    expect(ids).toContain(newAccount.id);
  });

  test("get account by ID returns correct account", async ({ api }) => {
    const account = await api.client.getAccountById(api.savingsAccount.id);
    expect(account.id).toBe(api.savingsAccount.id);
    expect(account.customerId).toBe(api.customerId);
  });

  test("default savings account has a positive opening balance", async ({ api }) => {
    const account = await api.client.getAccountById(api.savingsAccount.id);
    expect(account.balance).toBeGreaterThan(0);
  });
});
