import { test as base, request as playwrightRequest } from "@playwright/test";
import { ParaBankClient } from "../../../shared/src/client/parabank.client";
import { buildCustomer } from "../../../shared/src/fixtures/customer.factory";
import type { Account } from "../../../shared/src/types/domain";

export interface ApiFixture {
  client: ParaBankClient;
  customerId: number;
  savingsAccount: Account;
  checkingAccount: Account;
}

const BASE_URL = process.env.PARABANK_BASE_URL ?? "http://localhost:3000/parabank/";

export const test = base.extend<{ api: ApiFixture }>({
  api: async ({}, use) => {
    const ctx = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { Accept: "application/json" },
    });
    const client = new ParaBankClient(ctx);
    const customer = buildCustomer();

    await client.register(customer);
    const { customerId } = await client.login(customer.username, customer.password);

    let allAccounts = await client.getAccounts(customerId);
    // ParaBank occasionally returns empty list immediately after registration — retry once
    if (allAccounts.length === 0) {
      allAccounts = await client.getAccounts(customerId);
    }
    if (allAccounts.length === 0) throw new Error(`No accounts found for customer ${customerId}`);
    const savingsAccount = allAccounts[0];
    const checkingAccount = await client.openAccount(customerId, 0, savingsAccount.id);

    await use({ client, customerId, savingsAccount, checkingAccount });
    await ctx.dispose();
  },
});

export { expect } from "@playwright/test";
