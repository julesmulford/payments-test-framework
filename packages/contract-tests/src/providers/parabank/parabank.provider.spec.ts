import path from "path";
import type { Request, Response, NextFunction } from "express";
import { Verifier } from "@pact-foundation/pact";

// PARABANK_BASE_URL includes the /parabank context path, used for state handler fetch calls.
// PARABANK_HOST is just host:port — the pact paths already start with /parabank/,
// so the http-proxy target must NOT include /parabank/ or it doubles the prefix.
const PARABANK_BASE_URL = process.env.PARABANK_BASE_URL ?? "http://localhost:3000/parabank/";
const PARABANK_HOST = PARABANK_BASE_URL.replace(/\/parabank\/?$/, "").replace(/\/$/, "");
const PACTFLOW_BROKER_URL = process.env.PACT_BROKER_BASE_URL;
const PACTFLOW_TOKEN = process.env.PACT_BROKER_TOKEN;
const GIT_SHA = process.env.GIT_SHA ?? "local";

const BASE = PARABANK_BASE_URL.replace(/\/$/, "");

console.log("[pact-provider] PARABANK_BASE_URL =", PARABANK_BASE_URL);
console.log("[pact-provider] BASE =", BASE);

async function initDB(): Promise<void> {
  const url = `${BASE}/services/bank/initializeDB`;
  console.log("[initDB] POST", url);
  const res = await fetch(url, { method: "POST" });
  console.log("[initDB] response status:", res.status);
  if (res.status !== 200 && res.status !== 204) {
    // Warn rather than throw — ParaBank sometimes returns 500 if already initialised
    console.warn(`[initDB] unexpected status ${res.status} — proceeding`);
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
    try {
      await initDB();
      const { id: customerId, accounts } = await getDemoCustomer();
      const fromAccount = accounts[0];
      const toAccount = await openAccount(customerId, 0, fromAccount.id);
      const params = {
        customerId: String(customerId),
        fromAccountId: String(fromAccount.id),
        toAccountId: String(toAccount.id),
      };
      console.log("[state] customer with two accounts →", params);
      return params;
    } catch (e) {
      console.error("[state] FAILED — customer with two accounts:", e);
      throw e;
    }
  },

  "customer 12345 exists with two accounts": async () => {
    try {
      await initDB();
      const { id: customerId, accounts } = await getDemoCustomer();
      await openAccount(customerId, 1, accounts[0].id);
      const params = { customerId: String(customerId) };
      console.log("[state] customer exists →", params);
      return params;
    } catch (e) {
      console.error("[state] FAILED — customer exists:", e);
      throw e;
    }
  },

  "account 10001 exists": async () => {
    try {
      await initDB();
      const { accounts } = await getDemoCustomer();
      const params = { fromAccountId: String(accounts[0].id) };
      console.log("[state] account exists →", params);
      return params;
    } catch (e) {
      console.error("[state] FAILED — account exists:", e);
      throw e;
    }
  },

  "account 99999 does not exist": async () => {
    console.log("[state] account does not exist — no setup needed");
    // No setup needed — sequential IDs never reach 99999 in a single test run
  },

  "account 10001 has at least one transaction": async () => {
    try {
      await initDB();
      const { id: customerId, accounts } = await getDemoCustomer();
      const fromAccount = accounts[0];
      const toAccount = await openAccount(customerId, 0, fromAccount.id);
      await transfer(fromAccount.id, toAccount.id, 50);
      const params = { accountId: String(fromAccount.id) };
      console.log("[state] account with transaction →", params);
      return params;
    } catch (e) {
      console.error("[state] FAILED — account with transaction:", e);
      throw e;
    }
  },
};

describe("ParaBank — Pact provider verification", () => {
  // Use local pact files when no broker is configured
  const verifierOptions = PACTFLOW_BROKER_URL
    ? {
        provider: "parabank",
        providerBaseUrl: PARABANK_HOST,
        pactBrokerUrl: PACTFLOW_BROKER_URL,
        pactBrokerToken: PACTFLOW_TOKEN,
        consumerVersionSelectors: [{ mainBranch: true }, { deployedOrReleased: true }],
        publishVerificationResult: true,
        providerVersion: GIT_SHA,
        providerVersionBranch: process.env.GIT_BRANCH ?? "main",
        enablePending: true,
        stateHandlers: providerStateHandlers,
        requestFilter: (req: Request, _res: Response, next: NextFunction) => {
          console.log(`[proxy] ${req.method} ${req.path}`, JSON.stringify(req.body ?? ""));
          next();
        },
        logLevel: "debug" as const,
      }
    : {
        provider: "parabank",
        providerBaseUrl: PARABANK_HOST,
        pactUrls: [
          path.resolve(__dirname, "../../../pacts/payments-gateway-parabank.json"),
          path.resolve(__dirname, "../../../pacts/reporting-service-parabank.json"),
        ],
        stateHandlers: providerStateHandlers,
        requestFilter: (req: Request, _res: Response, next: NextFunction) => {
          console.log(`[proxy] ${req.method} ${req.path}`, JSON.stringify(req.body ?? ""));
          next();
        },
        logLevel: "debug" as const,
      };

  test("verifies all consumer contracts", async () => {
    const verifier = new Verifier(verifierOptions);
    await verifier.verifyProvider();
  }, 60_000);
});
