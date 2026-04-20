import { test, expect, request as playwrightRequest } from "@playwright/test";
import { ParaBankClient } from "../../../shared/src/client/parabank.client";

// Component tests run against WireMock — no real ParaBank needed.
// The stubs in ../stubs/parabank-stubs.json must be loaded into WireMock first.

const WIREMOCK_URL = process.env.WIREMOCK_BASE_URL ?? "http://localhost:8082/parabank/";

test.describe("Transfer — component tests (WireMock doubles)", () => {
  let client: ParaBankClient;

  test.beforeEach(async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: WIREMOCK_URL });
    client = new ParaBankClient(ctx);
  });

  test("successful transfer returns 200", async ({ request }) => {
    const res = await request.post(
      "services/bank/transfer?fromAccountId=10001&toAccountId=10002&amount=100"
    );
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("Successfully transferred funds");
  });

  test("transfer from account 99999 returns 500 with error body", async ({ request }) => {
    const res = await request.post(
      "services/bank/transfer?fromAccountId=99999&toAccountId=10002&amount=100"
    );
    expect(res.status()).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Insufficient funds");
  });

  test("get accounts returns array with balance and type fields", async ({ request }) => {
    const res = await request.get("services/bank/customers/12345/accounts");
    expect(res.status()).toBe(200);
    const accounts = await res.json();
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBeGreaterThan(0);
    for (const account of accounts) {
      expect(account).toHaveProperty("id");
      expect(account).toHaveProperty("balance");
      expect(account).toHaveProperty("type");
      expect(typeof account.balance).toBe("number");
    }
  });

  test("open savings account returns account with type 1", async ({ request }) => {
    const res = await request.post(
      "services/bank/createAccount?customerId=12345&newAccountType=1&fromAccountId=10001"
    );
    expect(res.status()).toBe(200);
    const account = await res.json();
    expect(account.type).toBe(1);
    expect(account.id).toBeTruthy();
  });

  test("open checking account returns account with type 0", async ({ request }) => {
    const res = await request.post(
      "services/bank/createAccount?customerId=12345&newAccountType=0&fromAccountId=10001"
    );
    expect(res.status()).toBe(200);
    const account = await res.json();
    expect(account.type).toBe(0);
  });

  test("valid login returns customer object with id", async ({ request }) => {
    const res = await request.get("services/bank/login/testuser/testpass");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(12345);
    expect(body.firstName).toBeTruthy();
  });

  test("invalid login returns 401", async ({ request }) => {
    const res = await request.get("services/bank/login/baduser/badpass");
    expect(res.status()).toBe(401);
  });

  test("transfer response does not include sensitive account data", async ({ request }) => {
    const res = await request.post(
      "services/bank/transfer?fromAccountId=10001&toAccountId=10002&amount=50"
    );
    expect(res.status()).toBe(200);
    // Transfer endpoint should not leak account details
    const body = await res.text();
    expect(body).not.toContain("password");
    expect(body).not.toContain("ssn");
  });
});
