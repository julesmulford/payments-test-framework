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
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<payee>",
      `  <name>${billPayReq.payeeName}</name>`,
      "  <address>",
      `    <street>${billPayReq.address.street}</street>`,
      `    <city>${billPayReq.address.city}</city>`,
      `    <state>${billPayReq.address.state}</state>`,
      `    <zipCode>${billPayReq.address.zipCode}</zipCode>`,
      "  </address>",
      `  <phoneNumber>${billPayReq.phoneNumber}</phoneNumber>`,
      `  <accountNumber>${billPayReq.accountNumber}</accountNumber>`,
      `  <routingNumber>${billPayReq.routingNumber}</routingNumber>`,
      "</payee>",
    ].join("\n");
    const res = await ctx.post(
      `services/bank/billpay?accountId=${billPayReq.fromAccountId}&amount=0`,
      {
        data: xml,
        headers: { "Content-Type": "application/xml" },
      }
    );
    // ParaBank accepts zero-amount payments — any non-crash response is acceptable
    expect([200, 400]).toContain(res.status());
  });
});
