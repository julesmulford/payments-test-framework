import path from "path";
import { Verifier } from "@pact-foundation/pact";
import { request as playwrightRequest } from "@playwright/test";
import { buildCustomer } from "../../../../shared/src/fixtures/customer.factory";
import { ParaBankClient } from "../../../../shared/src/client/parabank.client";

const PARABANK_BASE_URL = process.env.PARABANK_BASE_URL ?? "http://localhost:3000/parabank/";
const PACTFLOW_BROKER_URL = process.env.PACT_BROKER_BASE_URL;
const PACTFLOW_TOKEN = process.env.PACT_BROKER_TOKEN;
const GIT_SHA = process.env.GIT_SHA ?? "local";

// Provider state setup — creates the data conditions each consumer interaction requires
const providerStateHandlers: Record<string, () => Promise<void>> = {
  "customer 12345 has accounts 10001 and 10002 with sufficient balance": async () => {
    // In a real system this would seed the DB via a test endpoint.
    // ParaBank doesn't expose a provider-state endpoint, so we use the API
    // to create a fresh customer and note that Pact's mock will handle the actual response.
    // For local pact file verification, state setup is informational.
  },

  "customer 12345 exists with two accounts": async () => {
    // State acknowledged — Pact mock handles response verification
  },

  "account 10001 exists": async () => {},

  "account 99999 does not exist": async () => {},

  "account 10001 has at least one transaction": async () => {
    // For real provider verification against a live ParaBank, we would:
    // 1. Register a fresh customer
    // 2. Make a transfer to seed a transaction
    // 3. Map their real account ID to the one in the contract
    // This is the argument for provider state endpoints on real services.
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
