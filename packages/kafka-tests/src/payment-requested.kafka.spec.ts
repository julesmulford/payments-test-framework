import {
  TOPICS,
  createTestProducer,
  publishPaymentEvent,
  waitForMessage,
  ensureTopicsExist,
  buildPaymentRequestedEvent,
} from "../kafka.helpers";
import { request as playwrightRequest } from "@playwright/test";
import { ParaBankClient } from "../../../shared/src/client/parabank.client";
import { buildCustomer } from "../../../shared/src/fixtures/customer.factory";
import { v4 as uuidv4 } from "uuid";

const PARABANK_BASE_URL = process.env.PARABANK_BASE_URL ?? "http://localhost:3000/parabank/";

// ── Test setup: create a real customer with two funded accounts ───────────────

async function setupTestAccounts(): Promise<{
  savingsId: number;
  checkingId: number;
  client: ParaBankClient;
  cleanup: () => Promise<void>;
}> {
  const ctx = await playwrightRequest.newContext({ baseURL: PARABANK_BASE_URL });
  const client = new ParaBankClient(ctx);
  const customer = buildCustomer();

  await client.register(customer);
  const { customerId } = await client.login(customer.username, customer.password);
  const accounts = await client.getAccounts(customerId);
  const savingsAccount = accounts[0];
  const checkingAccount = await client.openAccount(customerId, 0, savingsAccount.id);

  return {
    savingsId: savingsAccount.id,
    checkingId: checkingAccount.id,
    client,
    cleanup: () => ctx.dispose(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Kafka — payment.requested → payment.completed", () => {
  let producer: Awaited<ReturnType<typeof createTestProducer>>;

  beforeAll(async () => {
    await ensureTopicsExist();
    producer = await createTestProducer();
  });

  afterAll(async () => {
    await producer.disconnect();
  });

  test("publish payment.requested → receive payment.completed with matching correlationId", async () => {
    const { savingsId, checkingId, cleanup } = await setupTestAccounts();
    const correlationId = uuidv4();
    const amount = 15;

    const event = buildPaymentRequestedEvent(savingsId, checkingId, amount, correlationId);

    // Start listening before publishing to avoid race condition
    const completedPromise = waitForMessage({
      topic: TOPICS.PAYMENT_COMPLETED,
      correlationId,
      timeoutMs: 25_000,
    });

    await publishPaymentEvent(producer, TOPICS.PAYMENT_REQUESTED, event);

    const completed = await completedPromise;

    expect(completed.eventType).toBe("payment.completed");
    expect(completed.correlationId).toBe(correlationId);
    expect(completed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await cleanup();
  });

  test("completed event payload contains correct account IDs and amount", async () => {
    const { savingsId, checkingId, cleanup } = await setupTestAccounts();
    const correlationId = uuidv4();
    const amount = 20;

    const completedPromise = waitForMessage({
      topic: TOPICS.PAYMENT_COMPLETED,
      correlationId,
      timeoutMs: 25_000,
    });

    await publishPaymentEvent(
      producer,
      TOPICS.PAYMENT_REQUESTED,
      buildPaymentRequestedEvent(savingsId, checkingId, amount, correlationId)
    );

    const completed = await completedPromise;
    const payload = completed.payload as Record<string, unknown>;

    expect(payload.fromAccountId).toBe(savingsId);
    expect(payload.toAccountId).toBe(checkingId);
    expect(payload.amount).toBe(amount);
    expect(payload.currency).toBe("GBP");
    expect(typeof payload.transactionId).toBe("string");

    await cleanup();
  });

  test("completed event contains a transactionId", async () => {
    const { savingsId, checkingId, cleanup } = await setupTestAccounts();
    const correlationId = uuidv4();

    const completedPromise = waitForMessage({
      topic: TOPICS.PAYMENT_COMPLETED,
      correlationId,
      timeoutMs: 25_000,
    });

    await publishPaymentEvent(
      producer,
      TOPICS.PAYMENT_REQUESTED,
      buildPaymentRequestedEvent(savingsId, checkingId, 10, correlationId)
    );

    const completed = await completedPromise;
    const payload = completed.payload as { transactionId: string; completedAt: string };

    expect(payload.transactionId).toBeTruthy();
    expect(payload.transactionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(payload.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await cleanup();
  });

  test("ParaBank balance is reduced after Kafka-triggered transfer", async () => {
    const { savingsId, checkingId, client, cleanup } = await setupTestAccounts();
    const correlationId = uuidv4();
    const amount = 25;

    const savingsBefore = await client.getAccountById(savingsId);

    const completedPromise = waitForMessage({
      topic: TOPICS.PAYMENT_COMPLETED,
      correlationId,
      timeoutMs: 25_000,
    });

    await publishPaymentEvent(
      producer,
      TOPICS.PAYMENT_REQUESTED,
      buildPaymentRequestedEvent(savingsId, checkingId, amount, correlationId)
    );

    await completedPromise;

    const savingsAfter = await client.getAccountById(savingsId);
    expect(savingsAfter.balance).toBeCloseTo(savingsBefore.balance - amount, 2);

    await cleanup();
  });
});
