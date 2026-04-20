import { test, expect } from "../fixtures/api.fixture";
import { buildBillPayRequest } from "../../../shared/src/fixtures/customer.factory";

test.describe("Bill Pay API", () => {
  test("bill pay deducts the payment amount from the source account", async ({ api }) => {
    const accountBefore = await api.client.getAccountById(api.savingsAccount.id);
    const billPayReq = buildBillPayRequest(api.savingsAccount.id, { amount: 50 });

    await api.client.billPay(api.customerId, billPayReq);

    const accountAfter = await api.client.getAccountById(api.savingsAccount.id);
    expect(accountAfter.balance).toBeCloseTo(accountBefore.balance - 50, 2);
  });

  test("bill pay appears as a debit in transaction history", async ({ api }) => {
    const billPayReq = buildBillPayRequest(api.savingsAccount.id, { amount: 75 });
    await api.client.billPay(api.customerId, billPayReq);

    const txns = await api.client.getTransactions(api.savingsAccount.id);
    const billPayTxn = txns.find(
      (t) => t.type === "Debit" && t.description?.toLowerCase().includes(billPayReq.payeeName.toLowerCase())
    );
    expect(billPayTxn).toBeDefined();
  });

  test("bill pay with zero amount is handled gracefully", async ({ api }) => {
    const billPayReq = buildBillPayRequest(api.savingsAccount.id, { amount: 0 });
    const ctx = (api.client as any).request;
    const res = await ctx.post(
      `services/bank/billpay?accountId=${billPayReq.fromAccountId}&amount=0`,
      {
        data: {
          name: billPayReq.payeeName,
          address: billPayReq.address,
          phoneNumber: billPayReq.phoneNumber,
          accountNumber: billPayReq.accountNumber,
          routingNumber: billPayReq.routingNumber,
        },
        headers: { "Content-Type": "application/json" },
      }
    );
    // Should return an error — 400 or 500
    expect([400, 500]).toContain(res.status());
  });
});
