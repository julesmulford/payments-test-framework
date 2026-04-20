import { check, sleep } from "k6";
import http from "k6/http";

export const PARABANK_BASE = __ENV.PARABANK_BASE_URL ?? "http://localhost:3000/parabank";
const BANK_API = `${PARABANK_BASE}/services/bank`;

// ── Thresholds — imported by each scenario ────────────────────────────────────

export const baselineThresholds = {
  http_req_duration: ["p(95)<800", "p(99)<1500"],
  http_req_failed: ["rate<0.01"],
  http_reqs: ["rate>5"],
};

export const spikeThresholds = {
  http_req_duration: ["p(95)<2000", "p(99)<4000"],
  http_req_failed: ["rate<0.02"],
};

export const soakThresholds = {
  http_req_duration: ["p(95)<1000"],
  http_req_failed: ["rate<0.005"],
};

// ── Session management ────────────────────────────────────────────────────────

interface Session {
  customerId: number;
  savingsAccountId: number;
  checkingAccountId: number;
  cookie: string;
}

let vuCounter = 0;

export function setupSession(): Session {
  // Use ParaBank's built-in demo user, registering a fresh user per VU
  // For real load tests against ParaBank, we use the seeded john/demo account
  // to avoid overwhelming the registration endpoint
  const loginRes = http.get(`${BANK_API}/login/john/demo`, {
    headers: { Accept: "application/json" },
  });

  check(loginRes, {
    "login: status 200": (r) => r.status === 200,
  });

  const customer = loginRes.json() as { id: number };
  const setCookie = loginRes.headers["Set-Cookie"] ?? "";
  const customerId = customer.id;

  // Get accounts
  const accountsRes = http.get(`${BANK_API}/customers/${customerId}/accounts`, {
    headers: { Accept: "application/json", Cookie: setCookie },
  });

  check(accountsRes, {
    "get accounts: status 200": (r) => r.status === 200,
  });

  const accounts = accountsRes.json() as Array<{ id: number; type: number }>;
  const savings = accounts.find((a) => a.type === 1) ?? accounts[0];
  const checking = accounts.find((a) => a.type === 0) ?? accounts[1] ?? accounts[0];

  return {
    customerId,
    savingsAccountId: savings.id,
    checkingAccountId: checking.id,
    cookie: setCookie,
  };
}

// ── Core payment flow ─────────────────────────────────────────────────────────

export function runPaymentFlow(session: Session): void {
  const headers = {
    Accept: "application/json",
    Cookie: session.cookie,
  };

  // Step 1 — get accounts
  const accountsRes = http.get(
    `${BANK_API}/customers/${session.customerId}/accounts`,
    { headers, tags: { name: "get_accounts" } }
  );
  check(accountsRes, { "get accounts: 200": (r) => r.status === 200 });

  sleep(0.5);

  // Step 2 — transfer
  const transferRes = http.post(
    `${BANK_API}/transfer?fromAccountId=${session.savingsAccountId}&toAccountId=${session.checkingAccountId}&amount=1`,
    null,
    { headers, tags: { name: "transfer" } }
  );
  check(transferRes, { "transfer: 200": (r) => r.status === 200 });

  sleep(0.3);

  // Step 3 — get transactions
  const txnRes = http.get(
    `${BANK_API}/accounts/${session.savingsAccountId}/transactions`,
    { headers, tags: { name: "get_transactions" } }
  );
  check(txnRes, { "get transactions: 200": (r) => r.status === 200 });

  sleep(0.2);

  // Step 4 — get account balance
  const balanceRes = http.get(
    `${BANK_API}/accounts/${session.savingsAccountId}`,
    { headers, tags: { name: "get_balance" } }
  );
  check(balanceRes, { "get balance: 200": (r) => r.status === 200 });
}
