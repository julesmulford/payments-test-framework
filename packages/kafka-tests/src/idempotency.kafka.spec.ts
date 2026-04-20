import {
  TOPICS,
  createTestProducer,
  publishPaymentEvent,
  waitForMessages,
  ensureTopicsExist,
  buildPaymentRequestedEvent,
} from "../kafka.helpers";
import { request as playwrightRequest } from "@playwright/test";
import { ParaBankClient } from "../../../shared/src/client/parabank.client";
import { buildCustomer } from "../../../shared/src/fixtures/customer.factory";
import { v4 as uuidv4 } from "uuid";

const PARABANK_BASE_URL = process.env.PARABANK_BASE_URL ?? "http://localhost:3000/parabank/";

describe("Kafka — idempotency", () => {
  let producer: Awaited<ReturnType<typeof createTestProducer>>;
  let savingsId: number;
  let checkingId: number;
  let client: ParaBankClient;
  let ctx: Awaited<ReturnType<typeof playwrightRequest.newContext>>;

  beforeAll(async () => {
    await ensureTopicsExist();
    producer = await createTestProducer();

    ctx = await playwrightRequest.newContext({ baseURL: PARABANK_BASE_URL });
    client = new ParaBankClient(ctx);
    const customer = buildCustomer();
    await client.register(customer);
    const { customerId } = await client.login(customer.username, customer.password);
    const accounts = await client.getAccounts(customerId);
    savingsId = accounts[0].id;
    const checking = await client.openAccount(customerId, 0, savingsId);
    checkingId = checking.id;
  });

  afterAll(async () => {
    await producer.disconnect();
    await ctx.dispose();
  });

  test("publishing the same correlationId twice produces only one payment.completed event", async () => {
    const correlationId = uuidv4();
    const amount = 10;
    const event = buildPaymentRequestedEvent(savingsId, checkingId, amount, correlationId);

    // Collect up to 2 messages over a window — we expect only 1
    const messagesPromise = waitForMessages(
      TOPICS.PAYMENT_COMPLETED,
      correlationId,
      2,
      12_000 // window: if 2 arrive within 12s, the test fails
    );

    // Publish the same event twice in quick succession
    await publishPaymentEvent(producer, TOPICS.PAYMENT_REQUESTED, event);
    await new Promise((r) => setTimeout(r, 200));
    await publishPaymentEvent(producer, TOPICS.PAYMENT_REQUESTED, event);

    const messages = await messagesPromise;

    expect(messages.length).toBe(1);
  });

  test("duplicate payment does not double-debit the source account", async () => {
    const correlationId = uuidv4();
    const amount = 15;
    const savingsBefore = await client.getAccountById(savingsId);

    const event = buildPaymentRequestedEvent(savingsId, checkingId, amount, correlationId);

    // First event — expect completed
    const completedPromise = waitForMessages(
      TOPICS.PAYMENT_COMPLETED,
      correlationId,
      1,
      20_000
    );

    await publishPaymentEvent(producer, TOPICS.PAYMENT_REQUESTED, event);
    await new Promise((r) => setTimeout(r, 300));
    // Duplicate
    await publishPaymentEvent(producer, TOPICS.PAYMENT_REQUESTED, event);

    await completedPromise;

    // Wait a moment for any erroneous second processing
    await new Promise((r) => setTimeout(r, 3000));

    const savingsAfter = await client.getAccountById(savingsId);

    // Balance should be reduced by exactly one transfer, not two
    expect(savingsAfter.balance).toBeCloseTo(savingsBefore.balance - amount, 2);
  });

  test("two different correlationIds produce two independent completed events", async () => {
    const corr1 = uuidv4();
    const corr2 = uuidv4();
    const amount = 5;

    const [p1, p2] = await Promise.all([
      (async () => {
        const promise = waitForMessages(TOPICS.PAYMENT_COMPLETED, corr1, 1, 25_000);
        await publishPaymentEvent(
          producer,
          TOPICS.PAYMENT_REQUESTED,
          buildPaymentRequestedEvent(savingsId, checkingId, amount, corr1)
        );
        return promise;
      })(),
      (async () => {
        const promise = waitForMessages(TOPICS.PAYMENT_COMPLETED, corr2, 1, 25_000);
        await publishPaymentEvent(
          producer,
          TOPICS.PAYMENT_REQUESTED,
          buildPaymentRequestedEvent(savingsId, checkingId, amount, corr2)
        );
        return promise;
      })(),
    ]);

    expect(p1.length).toBe(1);
    expect(p2.length).toBe(1);
    expect(p1[0].correlationId).toBe(corr1);
    expect(p2[0].correlationId).toBe(corr2);
  });
});
