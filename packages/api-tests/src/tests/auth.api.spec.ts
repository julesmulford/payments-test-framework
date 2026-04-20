import { test, expect } from "../fixtures/api.fixture";
import { buildCustomer } from "../../../shared/src/fixtures/customer.factory";
import { request as playwrightRequest } from "@playwright/test";

const BASE_URL = process.env.PARABANK_BASE_URL ?? "http://localhost:3000/parabank/";

test.describe("Authentication API", () => {
  test("register a new customer and receive a customerId", async ({ api }) => {
    // Fixture has already registered — verify we have a valid ID
    expect(api.customerId).toBeGreaterThan(0);
  });

  test("login with valid credentials returns customerId and name", async ({}) => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL });
    const customer = buildCustomer();

    // Register via form POST
    await ctx.get("register.htm");
    await ctx.post("register.htm", {
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

    const loginRes = await ctx.get(
      `services/bank/login/${customer.username}/${customer.password}`
    );
    expect(loginRes.status()).toBe(200);
    const body = await loginRes.json();
    expect(body.id).toBeGreaterThan(0);
    expect(body.firstName).toBe(customer.firstName);
    expect(body.lastName).toBe(customer.lastName);
    await ctx.dispose();
  });

  test("login with wrong password returns 401", async ({}) => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL });
    const res = await ctx.get("services/bank/login/nonexistent_user_xyz/wrongpass");
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test("login response does not expose password or SSN", async ({ api }) => {
    // The api fixture already logged in — re-request to inspect shape
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL });
    // Use a fresh customer to test login response shape
    const customer = buildCustomer();
    await ctx.get("register.htm");
    await ctx.post("register.htm", {
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
    const loginRes = await ctx.get(
      `services/bank/login/${customer.username}/${customer.password}`
    );
    const body = await loginRes.json();
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain(customer.password);
    expect(bodyStr).not.toContain(customer.ssn);
    await ctx.dispose();
  });
});
