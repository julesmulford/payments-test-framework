import path from "path";
import { Verifier } from "@pact-foundation/pact";
import { request as playwrightRequest } from "@playwright/test";
import { buildCustomer } from "../../../../shared/src/fixtures/customer.factory";
import { ParaBankClient } from "../../../../shared/src/client/parabank.client";

const PARABANK_BASE_URL = process.env.PARABANK_BASE_URL ?? "http://localhost:3000/parabank/";
const PACTFLOW_BROKER_URL = process.env.PACT_BROKER_BASE_URL;
const PACTFLOW_TOKEN = process.env.PACT_BROKER_TOKEN;
const GIT_SHA = process.env.GIT_SHA ?? "local";

// Provider state setup — creates the data conditions each consumer interaction requires.
// Each handler registers a fresh customer so tests are fully isolated, and returns
// the real IDs as provider state params for fromProviderState matchers in the pacts.
async function makeClient() {
  const ctx = await playwrightRequest.newContext({ baseURL: PARABANK_BASE_URL });
  return { client: new ParaBankClient(ctx), ctx };
}

const providerStateHandlers: Record<string, () => Promise<Record<string, string> | void>> = {
  "customer 12345 has accounts 10001 and 10002 with sufficient balance": async () => {
    const { client, ctx } = await makeClient();
    const customerId = await client.register(buildCustomer());
    const [fromAccount] = await client.getAccounts(customerId);
    const toAccount = await client.openAccount(customerId, 0, fromAccount.id);
    await ctx.dispose();
    return {
      customerId: String(customerId),
      fromAccountId: String(fromAccount.id),
      toAccountId: String(toAccount.id),
    };
  },

  "customer 12345 exists with two accounts": async () => {
    const { client, ctx } = await makeClient();
    const customerId = await client.register(buildCustomer());
    const [firstAccount] = await client.getAccounts(customerId);
    await client.openAccount(customerId, 1, firstAccount.id);
    await ctx.dispose();
    return { customerId: String(customerId) };
  },

  "account 10001 exists": async () => {
    const { client, ctx } = await makeClient();
    const customerId = await client.register(buildCustomer());
    const [account] = await client.getAccounts(customerId);
    await ctx.dispose();
    return { fromAccountId: String(account.id) };
  },

  "account 99999 does not exist": async () => {
    // No setup — ParaBank's sequential IDs never reach 99999 in a single test run
  },

  "account 10001 has at least one transaction": async () => {
    const { client, ctx } = await makeClient();
    const customerId = await client.register(buildCustomer());
    const [fromAccount] = await client.getAccounts(customerId);
    const toAccount = await client.openAccount(customerId, 0, fromAccount.id);
    await client.transfer(fromAccount.id, toAccount.id, 50);
    await ctx.dispose();
    return { accountId: String(fromAccount.id) };
  },
};

describe("ParaBank — Pact provider verification", () => {
  // Use local pact files when no broker is configured
  const verifierOptions = PACTFLOW_BROKER_URL
    ? {
        provider: "parabank",
        providerBaseUrl: PARABANK_BASE_URL,
        pactBrokerUrl: PACTFLOW_BROKER_URL,
        pactBrokerToken: PACTFLOW_TOKEN,
        consumerVersionSelectors: [{ mainBranch: true }, { deployedOrReleased: true }],
        publishVerificationResult: true,
        providerVersion: GIT_SHA,
        providerVersionBranch: process.env.GIT_BRANCH ?? "main",
        enablePending: true,
        stateHandlers: providerStateHandlers,
        logLevel: "warn" as const,
      }
    : {
        provider: "parabank",
        providerBaseUrl: PARABANK_BASE_URL,
        pactUrls: [
          path.resolve(__dirname, "../../../pacts/payments-gateway-parabank.json"),
          path.resolve(__dirname, "../../../pacts/reporting-service-parabank.json"),
        ],
        stateHandlers: providerStateHandlers,
        logLevel: "warn" as const,
      };

  test("verifies all consumer contracts", async () => {
    const verifier = new Verifier(verifierOptions);
    await verifier.verifyProvider();
  }, 60_000);
});
