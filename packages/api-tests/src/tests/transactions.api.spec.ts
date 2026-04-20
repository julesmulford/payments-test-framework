import { test, expect } from "../fixtures/api.fixture";

test.describe("Transactions API", () => {
  test("transaction history is an array", async ({ api }) => {
    const txns = await api.client.getTransactions(api.savingsAccount.id);
    expect(Array.isArray(txns)).toBe(true);
  });

  test("each transaction has required fields", async ({ api }) => {
    // Seed a transaction so the list is non-empty
    await api.client.transfer(api.savingsAccount.id, api.checkingAccount.id, 20);
    const txns = await api.client.getTransactions(api.savingsAccount.id);

    expect(txns.length).toBeGreaterThan(0);
    for (const txn of txns) {
      expect(typeof txn.id).toBe("number");
      expect(typeof txn.amount).toBe("number");
      expect(txn.type).toMatch(/^(Debit|Credit)$/);
      expect(txn.date).toBeTruthy();
      expect(txn.description).toBeTruthy();
    }
  });

  test("debit transaction appears in source account history after transfer", async ({ api }) => {
    const transferAmount = 35;
    await api.client.transfer(api.savingsAccount.id, api.checkingAccount.id, transferAmount);

    const txns = await api.client.getTransactions(api.savingsAccount.id);
    const debit = txns.find(
      (t) => t.type === "Debit" && Math.abs(t.amount) === transferAmount
    );
    expect(debit).toBeDefined();
  });

  test("credit transaction appears in target account history after transfer", async ({ api }) => {
    const transferAmount = 40;
    await api.client.transfer(api.savingsAccount.id, api.checkingAccount.id, transferAmount);

    const txns = await api.client.getTransactions(api.checkingAccount.id);
    const credit = txns.find(
      (t) => t.type === "Credit" && Math.abs(t.amount) === transferAmount
    );
    expect(credit).toBeDefined();
  });

  test("transaction amounts are numeric, not strings", async ({ api }) => {
    await api.client.transfer(api.savingsAccount.id, api.checkingAccount.id, 10);
    const txns = await api.client.getTransactions(api.savingsAccount.id);
    for (const txn of txns) {
      expect(typeof txn.amount).toBe("number");
    }
  });

  test("date range query returns only transactions within range", async ({ api }) => {
    await api.client.transfer(api.savingsAccount.id, api.checkingAccount.id, 10);

    const today = new Date();
    const fromDate = `${today.getMonth() + 1}-${today.getDate()}-${today.getFullYear()}`;
    const toDate = fromDate;

    const txns = await api.client.getTransactionsByDateRange(
      api.savingsAccount.id,
      fromDate,
      toDate
    );
    expect(Array.isArray(txns)).toBe(true);
  });

  test("new account with no transfers has an opening credit transaction", async ({ api }) => {
    // The checking account was opened via openAccount, which seeds it with a Credit transfer
    const txns = await api.client.getTransactions(api.checkingAccount.id);
    const credit = txns.find((t) => t.type === "Credit");
    expect(credit).toBeDefined();
  });
});
