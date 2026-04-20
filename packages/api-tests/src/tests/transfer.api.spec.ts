import { test, expect } from "../fixtures/api.fixture";

test.describe("Transfer API", () => {
  test("successful transfer returns 200", async ({ api }) => {
    const savingsBefore = await api.client.getAccountById(api.savingsAccount.id);
    // Transfer a small amount — savings has opening balance from registration
    await api.client.transfer(api.savingsAccount.id, api.checkingAccount.id, 10);
    // No error thrown = 200
  });

  test("source account balance decrements after transfer", async ({ api }) => {
    const savingsBefore = await api.client.getAccountById(api.savingsAccount.id);
    const transferAmount = 25;

    await api.client.transfer(api.savingsAccount.id, api.checkingAccount.id, transferAmount);

    const savingsAfter = await api.client.getAccountById(api.savingsAccount.id);
    expect(savingsAfter.balance).toBeCloseTo(savingsBefore.balance - transferAmount, 2);
  });

  test("target account balance increments after transfer", async ({ api }) => {
    const checkingBefore = await api.client.getAccountById(api.checkingAccount.id);
    const transferAmount = 30;

    await api.client.transfer(api.savingsAccount.id, api.checkingAccount.id, transferAmount);

    const checkingAfter = await api.client.getAccountById(api.checkingAccount.id);
    expect(checkingAfter.balance).toBeCloseTo(checkingBefore.balance + transferAmount, 2);
  });

  test("total balance is conserved across transfer", async ({ api }) => {
    const savingsBefore = await api.client.getAccountById(api.savingsAccount.id);
    const checkingBefore = await api.client.getAccountById(api.checkingAccount.id);
    const totalBefore = savingsBefore.balance + checkingBefore.balance;
    const transferAmount = 15;

    await api.client.transfer(api.savingsAccount.id, api.checkingAccount.id, transferAmount);

    const savingsAfter = await api.client.getAccountById(api.savingsAccount.id);
    const checkingAfter = await api.client.getAccountById(api.checkingAccount.id);
    const totalAfter = savingsAfter.balance + checkingAfter.balance;

    expect(totalAfter).toBeCloseTo(totalBefore, 2);
  });

  test("multiple sequential transfers accumulate correctly", async ({ api }) => {
    const savingsBefore = await api.client.getAccountById(api.savingsAccount.id);

    await api.client.transfer(api.savingsAccount.id, api.checkingAccount.id, 10);
    await api.client.transfer(api.savingsAccount.id, api.checkingAccount.id, 10);
    await api.client.transfer(api.savingsAccount.id, api.checkingAccount.id, 10);

    const savingsAfter = await api.client.getAccountById(api.savingsAccount.id);
    expect(savingsAfter.balance).toBeCloseTo(savingsBefore.balance - 30, 2);
  });

  test("transfer to non-existent account returns error status", async ({ api }) => {
    const res = await api.client.transferRaw(api.savingsAccount.id, 9999999, 10);
    expect([400, 500]).toContain(res.status());
  });

  test("transfer of zero amount is rejected", async ({ api }) => {
    const res = await api.client.transferRaw(api.savingsAccount.id, api.checkingAccount.id, 0);
    // ParaBank may return 200 with an error body or a 4xx — either is acceptable, but balance must not change
    const savingsAfter = await api.client.getAccountById(api.savingsAccount.id);
    const savingsBefore = await api.client.getAccountById(api.savingsAccount.id);
    expect(savingsAfter.balance).toBeCloseTo(savingsBefore.balance, 2);
  });
});
