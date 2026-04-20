import path from "path";
import { Verifier } from "@pact-foundation/pact";

const PARABANK_BASE_URL = process.env.PARABANK_BASE_URL ?? "http://localhost:3000/parabank/";
const PACTFLOW_BROKER_URL = process.env.PACT_BROKER_BASE_URL;
const PACTFLOW_TOKEN = process.env.PACT_BROKER_TOKEN;
const GIT_SHA = process.env.GIT_SHA ?? "local";

// Provider state setup — uses native fetch against ParaBank's REST API.
// Each handler calls initializeDB for a clean, deterministic starting state,
// then logs in as the seeded demo user (john/demo) to obtain real IDs which
// are returned as provider state params for fromProviderState matchers.

const BASE = PARABANK_BASE_URL.replace(/\/$/, "");

async function initDB(): Promise<void> {
  const res = await fetch(`${BASE}/services/bank/initializeDB`, { method: "POST" });
  if (res.status !== 200 && res.status !== 204) {
    throw new Error(`initializeDB failed: ${res.status}`);
  }
}

async function getDemoCustomer(): Promise<{ id: number; accounts: Array<{ id: number; type: number }> }> {
  const loginRes = await fetch(`${BASE}/services/bank/login/john/demo`, {
    headers: { Accept: "application/json" },
  });
  if (!loginRes.ok) throw new Error(`login failed: ${loginRes.status}`);
  const customer = await loginRes.json() as { id: number };

  const accountsRes = await fetch(`${BASE}/services/bank/customers/${customer.id}/accounts`, {
    headers: { Accept: "application/json" },
  });
  if (!accountsRes.ok) throw new Error(`getAccounts failed: ${accountsRes.status}`);
  const accounts = await accountsRes.json() as Array<{ id: number; type: number }>;

  return { id: customer.id, accounts };
}

async function openAccount(customerId: number, type: 0 | 1, fromAccountId: number): Promise<{ id: number }> {
  const res = await fetch(
    `${BASE}/services/bank/createAccount?customerId=${customerId}&newAccountType=${type}&fromAccountId=${fromAccountId}`,
    { method: "POST", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`openAccount failed: ${res.status}`);
  return res.json() as Promise<{ id: number }>;
}

async function transfer(fromAccountId: number, toAccountId: number, amount: number): Promise<void> {
  const res = await fetch(
    `${BASE}/services/bank/transfer?fromAccountId=${fromAccountId}&toAccountId=${toAccountId}&amount=${amount}`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error(`transfer failed: ${res.status}`);
}

const providerStateHandlers: Record<string, () => Promise<Record<string, string> | void>> = {
  "customer 12345 has accounts 10001 and 10002 with sufficient balance": async () => {
    await initDB();
    const { id: customerId, accounts } = await getDemoCustomer();
    const fromAccount = accounts[0];
    const toAccount = await openAccount(customerId, 0, fromAccount.id);
    return {
      customerId: String(customerId),
      fromAccountId: String(fromAccount.id),
      toAccountId: String(toAccount.id),
    };
  },

  "customer 12345 exists with two accounts": async () => {
    await initDB();
    const { id: customerId, accounts } = await getDemoCustomer();
    await openAccount(customerId, 1, accounts[0].id);
    return { customerId: String(customerId) };
  },

  "account 10001 exists": async () => {
    await initDB();
    const { accounts } = await getDemoCustomer();
    return { fromAccountId: String(accounts[0].id) };
  },

  "account 99999 does not exist": async () => {
    // No setup needed — sequential IDs never reach 99999 in a single test run
  },

  "account 10001 has at least one transaction": async () => {
    await initDB();
    const { id: customerId, accounts } = await getDemoCustomer();
    const fromAccount = accounts[0];
    const toAccount = await openAccount(customerId, 0, fromAccount.id);
    await transfer(fromAccount.id, toAccount.id, 50);
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
