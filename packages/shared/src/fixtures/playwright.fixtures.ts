import { test as base, request as playwrightRequest } from "@playwright/test";
import { ParaBankClient } from "../client/parabank.client";
import { buildCustomer } from "./customer.factory";
import type { Customer, Account, LoginResult } from "../types/domain";

export interface CustomerFixture {
  customer: Customer;
  customerId: number;
  login: LoginResult;
  accounts: Account[];
  savingsAccount: Account;
  checkingAccount: Account;
  client: ParaBankClient;
}

const PARABANK_BASE_URL = process.env.PARABANK_BASE_URL ?? "http://localhost:3000/parabank/";

export const test = base.extend<{ customerFixture: CustomerFixture }>({
  customerFixture: async ({}, use) => {
    const ctx = await playwrightRequest.newContext({ baseURL: PARABANK_BASE_URL });
    const client = new ParaBankClient(ctx);

    // Create unique customer
    const customer = buildCustomer();
    await client.register(customer);
    const loginResult = await client.login(customer.username, customer.password);
    const customerId = loginResult.customerId;

    // Get the default account created at registration
    const initialAccounts = await client.getAccounts(customerId);
    const defaultAccount = initialAccounts[0];

    // Open a second account (checking) from the default
    const checkingAccount = await client.openAccount(customerId, 0, defaultAccount.id);
    const savingsAccount = defaultAccount; // default is savings (type 1)

    // Refresh accounts list
    const accounts = await client.getAccounts(customerId);

    await use({
      customer,
      customerId,
      login: loginResult,
      accounts,
      savingsAccount,
      checkingAccount,
      client,
    });

    await ctx.dispose();
  },
});

export { expect } from "@playwright/test";
