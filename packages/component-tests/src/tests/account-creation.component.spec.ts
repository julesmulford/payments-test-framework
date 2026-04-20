import { test, expect } from "@playwright/test";

test.describe("Account Creation — component tests (WireMock doubles)", () => {
  test("savings account has type 1 and non-negative balance", async ({ request }) => {
    const res = await request.post(
      "services/bank/createAccount?customerId=12345&newAccountType=1&fromAccountId=10001"
    );
    expect(res.status()).toBe(200);
    const account = await res.json();
    expect(account.type).toBe(1);
    expect(account.balance).toBeGreaterThanOrEqual(0);
    expect(account.customerId).toBe(12345);
  });

  test("checking account has type 0", async ({ request }) => {
    const res = await request.post(
      "services/bank/createAccount?customerId=12345&newAccountType=0&fromAccountId=10001"
    );
    expect(res.status()).toBe(200);
    const account = await res.json();
    expect(account.type).toBe(0);
  });

  test("created account has an id assigned", async ({ request }) => {
    const res = await request.post(
      "services/bank/createAccount?customerId=12345&newAccountType=1&fromAccountId=10001"
    );
    const account = await res.json();
    expect(typeof account.id).toBe("number");
    expect(account.id).toBeGreaterThan(0);
  });

  test("account list returns correct shape", async ({ request }) => {
    const res = await request.get("services/bank/customers/12345/accounts");
    expect(res.status()).toBe(200);
    const accounts = await res.json();
    expect(Array.isArray(accounts)).toBe(true);

    const requiredFields = ["id", "customerId", "type", "balance"];
    for (const account of accounts) {
      for (const field of requiredFields) {
        expect(account, `account missing field: ${field}`).toHaveProperty(field);
      }
    }
  });

  test("account balance is a number not a string", async ({ request }) => {
    // Guards against a common serialisation bug where numeric fields come back quoted
    const res = await request.get("services/bank/customers/12345/accounts");
    const accounts = await res.json();
    for (const account of accounts) {
      expect(typeof account.balance).toBe("number");
      expect(typeof account.id).toBe("number");
    }
  });
});
