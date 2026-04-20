import path from "path";
import { PactV3, MatchersV3 } from "@pact-foundation/pact";

const { like, integer, decimal, string, eachLike } = MatchersV3;

const provider = new PactV3({
  consumer: "reporting-service",
  provider: "parabank",
  dir: path.resolve(__dirname, "../../../pacts"),
  logLevel: "warn",
});

describe("reporting-service → parabank: transaction contract", () => {
  test("given account has transactions, returns array with required reporting fields", async () => {
    await provider
      .given("account 10001 has at least one transaction")
      .uponReceiving("a request to retrieve transactions for account 10001")
      .withRequest({
        method: "GET",
        path: "/parabank/services/bank/accounts/10001/transactions",
      })
      .willRespondWith({
        status: 200,
        headers: { "Content-Type": like("application/json") },
        body: eachLike({
          id: integer(1001),
          accountId: integer(10001),
          type: string("Credit"),
          date: string("2024-01-15"),
          amount: decimal(100.0),
          description: string("Opening deposit"),
        }),
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(
          `${mockServer.url}/parabank/services/bank/accounts/10001/transactions`
        );
        expect(res.status).toBe(200);
        const body = await res.json() as Record<string, unknown>[];
        expect(Array.isArray(body)).toBe(true);

        // The reporting service requires these exact fields for its ledger
        const requiredFields = ["id", "accountId", "type", "date", "amount", "description"];
        for (const field of requiredFields) {
          expect(body[0]).toHaveProperty(field);
        }

        // amount must be numeric — reporting breaks if it comes back as a string
        expect(typeof body[0].amount).toBe("number");
      });
  });

  test("transaction type is one of Debit or Credit", async () => {
    await provider
      .given("account 10001 has at least one transaction")
      .uponReceiving("a request to validate transaction types for reporting")
      .withRequest({
        method: "GET",
        path: "/parabank/services/bank/accounts/10001/transactions",
      })
      .willRespondWith({
        status: 200,
        body: eachLike({
          id: integer(1001),
          accountId: integer(10001),
          type: string("Debit"),
          date: string("2024-01-15"),
          amount: decimal(50.0),
          description: string("Fund transfer"),
        }),
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(
          `${mockServer.url}/parabank/services/bank/accounts/10001/transactions`
        );
        const body = await res.json() as Record<string, unknown>[];
        for (const txn of body) {
          expect(["Debit", "Credit"]).toContain(txn.type);
        }
      });
  });
});
