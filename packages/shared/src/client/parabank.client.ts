import { APIRequestContext, expect } from "@playwright/test";
import type {
  Customer,
  Account,
  Transaction,
  LoginResult,
  BillPayRequest,
} from "../types/domain";

const BANK = "services/bank";

export class ParaBankClient {
  constructor(private readonly request: APIRequestContext) {}

  // ── Auth ─────────────────────────────────────────────────────────────────

  async register(customer: Customer): Promise<number> {
    // ParaBank requires a GET to establish a session before POSTing registration
    await this.request.get("register.htm");

    const res = await this.request.post("register.htm", {
      form: {
        customer_firstName: customer.firstName,
        customer_lastName: customer.lastName,
        customer_address_street: customer.address.street,
        customer_address_city: customer.address.city,
        customer_address_state: customer.address.state,
        customer_address_zipCode: customer.address.zipCode,
        customer_phoneNumber: customer.phoneNumber,
        customer_ssn: customer.ssn,
        customer_username: customer.username,
        customer_password: customer.password,
        repeatedPassword: customer.password,
      },
    });

    expect(res.status(), `register failed for ${customer.username}`).toBe(200);
    const body = await res.text();

    // Extract customerId from the success response
    const match = body.match(/customerId=(\d+)/);
    if (!match) {
      // Try login to get ID if already registered
      return this.login(customer.username, customer.password).then((r) => r.customerId);
    }
    return parseInt(match[1], 10);
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const res = await this.request.get(`${BANK}/login/${username}/${password}`);
    expect(res.status(), `login failed for ${username}`).toBe(200);
    const data = await res.json();
    return {
      customerId: data.id,
      firstName: data.firstName,
      lastName: data.lastName,
    };
  }

  // ── Accounts ─────────────────────────────────────────────────────────────

  async getAccounts(customerId: number): Promise<Account[]> {
    const res = await this.request.get(`${BANK}/customers/${customerId}/accounts`);
    expect(res.status()).toBe(200);
    return res.json();
  }

  async openAccount(customerId: number, type: 0 | 1, fromAccountId: number): Promise<Account> {
    const res = await this.request.post(
      `${BANK}/createAccount?customerId=${customerId}&newAccountType=${type}&fromAccountId=${fromAccountId}`
    );
    expect(res.status()).toBe(200);
    return res.json();
  }

  async getAccountById(accountId: number): Promise<Account> {
    const res = await this.request.get(`${BANK}/accounts/${accountId}`);
    expect(res.status()).toBe(200);
    return res.json();
  }

  // ── Transfers ─────────────────────────────────────────────────────────────

  async transfer(fromAccountId: number, toAccountId: number, amount: number): Promise<void> {
    const res = await this.request.post(
      `${BANK}/transfer?fromAccountId=${fromAccountId}&toAccountId=${toAccountId}&amount=${amount}`
    );
    expect(res.status(), `transfer of ${amount} from ${fromAccountId} to ${toAccountId} failed`).toBe(200);
  }

  async transferRaw(fromAccountId: number, toAccountId: number, amount: number) {
    return this.request.post(
      `${BANK}/transfer?fromAccountId=${fromAccountId}&toAccountId=${toAccountId}&amount=${amount}`
    );
  }

  // ── Transactions ──────────────────────────────────────────────────────────

  async getTransactions(accountId: number): Promise<Transaction[]> {
    const res = await this.request.get(`${BANK}/accounts/${accountId}/transactions`);
    expect(res.status()).toBe(200);
    return res.json();
  }

  async getTransactionsByDateRange(
    accountId: number,
    fromDate: string,
    toDate: string
  ): Promise<Transaction[]> {
    const res = await this.request.get(
      `${BANK}/accounts/${accountId}/transactions/fromDate/${fromDate}/toDate/${toDate}`
    );
    expect(res.status()).toBe(200);
    return res.json();
  }

  // ── Bill Pay ──────────────────────────────────────────────────────────────

  async billPay(customerId: number, req: BillPayRequest): Promise<void> {
    const res = await this.request.post(
      `${BANK}/billpay?accountId=${req.fromAccountId}&amount=${req.amount}`,
      {
        data: {
          name: req.payeeName,
          address: req.address,
          phoneNumber: req.phoneNumber,
          accountNumber: req.accountNumber,
          routingNumber: req.routingNumber,
        },
        headers: { "Content-Type": "application/json" },
      }
    );
    expect(res.status(), "bill pay failed").toBe(200);
  }

  // ── DB Admin ──────────────────────────────────────────────────────────────

  async initializeDB(): Promise<void> {
    const res = await this.request.post(`${BANK}/initializeDB`);
    // 204 or 200 are both acceptable
    expect([200, 204]).toContain(res.status());
  }
}
