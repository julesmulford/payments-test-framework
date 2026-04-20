import path from "path";
import { PactV3, MatchersV3 } from "@pact-foundation/pact";

const { like, integer, decimal, string, eachLike, fromProviderState } = MatchersV3;

const provider = new PactV3({
  consumer: "payments-gateway",
  provider: "parabank",
  dir: path.resolve(__dirname, "../../../pacts"),
  logLevel: "warn",
});

// ── Transfer Contract ─────────────────────────────────────────────────────────

describe("payments-gateway → parabank: transfer contract", () => {
  test("given two valid accounts, transfer funds successfully", async () => {
    await provider
      .given("customer 12345 has accounts 10001 and 10002 with sufficient balance")
      .uponReceiving("a request to transfer £100 from account 10001 to 10002")
      .withRequest({
        method: "POST",
        path: "/parabank/services/bank/transfer",
        query: {
          fromAccountId: fromProviderState("${fromAccountId}", "10001"),
          toAccountId: fromProviderState("${toAccountId}", "10002"),
          amount: "100",
        },
      })
      .willRespondWith({
        status: 200,
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(
          `${mockServer.url}/parabank/services/bank/transfer?fromAccountId=10001&toAccountId=10002&amount=100`,
          { method: "POST" }
        );
        expect(res.status).toBe(200);
      });
  });
});

// ── Accounts Contract ─────────────────────────────────────────────────────────

describe("payments-gateway → parabank: accounts contract", () => {
  test("given a registered customer, retrieve accounts returns array with required fields", async () => {
    await provider
      .given("customer 12345 exists with two accounts")
      .uponReceiving("a request to list accounts for customer 12345")
      .withRequest({
        method: "GET",
        path: fromProviderState(
          "/parabank/services/bank/customers/${customerId}/accounts",
          "/parabank/services/bank/customers/12345/accounts"
        ),
      })
      .willRespondWith({
        status: 200,
        headers: { "Content-Type": like("application/json") },
        body: eachLike({
          id: integer(10001),
          customerId: integer(12345),
          type: string("CHECKING"),
          balance: decimal(1000.0),
        }),
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(
          `${mockServer.url}/parabank/services/bank/customers/12345/accounts`
        );
        expect(res.status).toBe(200);
        const body = await res.json() as Record<string, unknown>[];
        expect(Array.isArray(body)).toBe(true);
        expect(body[0]).toHaveProperty("id");
        expect(body[0]).toHaveProperty("balance");
        expect(body[0]).toHaveProperty("type");
      });
  });

  test("get account by ID returns account shape", async () => {
    await provider
      .given("account 10001 exists")
      .uponReceiving("a request to get account 10001")
      .withRequest({
        method: "GET",
        path: fromProviderState(
          "/parabank/services/bank/accounts/${fromAccountId}",
          "/parabank/services/bank/accounts/10001"
        ),
      })
      .willRespondWith({
        status: 200,
        headers: { "Content-Type": like("application/json") },
        body: {
          id: integer(10001),
          customerId: integer(12345),
          type: string("CHECKING"),
          balance: decimal(1000.0),
        },
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/parabank/services/bank/accounts/10001`);
        expect(res.status).toBe(200);
        const body = await res.json() as Record<string, unknown>;
        expect(typeof body.balance).toBe("number");
      });
  });

  test("request for non-existent account returns 400", async () => {
    await provider
      .given("account 99999 does not exist")
      .uponReceiving("a request for a non-existent account")
      .withRequest({
        method: "GET",
        path: "/parabank/services/bank/accounts/99999",
      })
      .willRespondWith({
        status: 400,
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/parabank/services/bank/accounts/99999`);
        expect(res.status).toBe(400);
      });
  });
});
