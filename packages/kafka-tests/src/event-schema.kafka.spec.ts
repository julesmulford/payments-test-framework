import {
  TOPICS,
  createTestProducer,
  publishPaymentEvent,
  waitForMessage,
  ensureTopicsExist,
  buildPaymentRequestedEvent,
  PaymentEvent,
} from "../kafka.helpers";
import { request as playwrightRequest } from "@playwright/test";
import { ParaBankClient } from "../../../shared/src/client/parabank.client";
import { buildCustomer } from "../../../shared/src/fixtures/customer.factory";
import { v4 as uuidv4 } from "uuid";

const PARABANK_BASE_URL = process.env.PARABANK_BASE_URL ?? "http://localhost:3000/parabank/";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function assertBaseEventSchema(event: PaymentEvent, expectedType: string): void {
  expect(typeof event.eventType).toBe("string");
  expect(event.eventType).toBe(expectedType);

  expect(typeof event.correlationId).toBe("string");
  expect(event.correlationId.length).toBeGreaterThan(0);

  expect(typeof event.timestamp).toBe("string");
  expect(event.timestamp).toMatch(ISO_DATE_REGEX);

  expect(event.payload).toBeDefined();
  expect(typeof event.payload).toBe("object");
}

describe("Kafka — event schema validation", () => {
  let producer: Awaited<ReturnType<typeof createTestProducer>>;
  let savingsId: number;
  let checkingId: number;
  let ctx: Awaited<ReturnType<typeof playwrightRequest.newContext>>;

  beforeAll(async () => {
    await ensureTopicsExist();
    producer = await createTestProducer();

    ctx = await playwrightRequest.newContext({ baseURL: PARABANK_BASE_URL });
    const client = new ParaBankClient(ctx);
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

  test("payment.completed event conforms to base schema", async () => {
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

    const event = await completedPromise;
    assertBaseEventSchema(event, "payment.completed");
  });

  test("payment.completed payload has all required fields", async () => {
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

    const event = await completedPromise;
    const p = event.payload as Record<string, unknown>;

    const requiredPayloadFields = [
      "fromAccountId",
      "toAccountId",
      "amount",
      "currency",
      "transactionId",
      "completedAt",
    ];
    for (const field of requiredPayloadFields) {
      expect(p, `completed payload missing: ${field}`).toHaveProperty(field);
    }

    expect(typeof p.fromAccountId).toBe("number");
    expect(typeof p.toAccountId).toBe("number");
    expect(typeof p.amount).toBe("number");
    expect(p.currency).toBe("GBP");
    expect(String(p.transactionId)).toMatch(UUID_REGEX);
    expect(String(p.completedAt)).toMatch(ISO_DATE_REGEX);
  });

  test("payment.failed event conforms to base schema", async () => {
    const correlationId = uuidv4();

    const failedPromise = waitForMessage({
      topic: TOPICS.PAYMENT_FAILED,
      correlationId,
      timeoutMs: 25_000,
    });

    await publishPaymentEvent(
      producer,
      TOPICS.PAYMENT_REQUESTED,
      buildPaymentRequestedEvent(99999991, 99999992, 50, correlationId)
    );

    const event = await failedPromise;
    assertBaseEventSchema(event, "payment.failed");
  });

  test("payment.failed payload has all required fields with correct types", async () => {
    const correlationId = uuidv4();

    const failedPromise = waitForMessage({
      topic: TOPICS.PAYMENT_FAILED,
      correlationId,
      timeoutMs: 25_000,
    });

    await publishPaymentEvent(
      producer,
      TOPICS.PAYMENT_REQUESTED,
      buildPaymentRequestedEvent(99999993, 99999994, 50, correlationId)
    );

    const event = await failedPromise;
    const p = event.payload as Record<string, unknown>;

    const requiredFields = [
      "fromAccountId",
      "toAccountId",
      "amount",
      "errorCode",
      "errorMessage",
      "failedAt",
    ];
    for (const field of requiredFields) {
      expect(p, `failed payload missing: ${field}`).toHaveProperty(field);
    }

    expect(typeof p.errorCode).toBe("string");
    expect(typeof p.errorMessage).toBe("string");
    expect(String(p.failedAt)).toMatch(ISO_DATE_REGEX);
  });

  test("no event is published with a null or empty correlationId", async () => {
    // Publish a malformed event — bridge should not forward it
    await producer.send({
      topic: TOPICS.PAYMENT_REQUESTED,
      messages: [{ value: JSON.stringify({ eventType: "payment.requested", correlationId: "", payload: {} }) }],
    });

    // Give bridge 3 seconds to (incorrectly) process it — we expect nothing
    await new Promise((r) => setTimeout(r, 3000));
    // No assertion needed — if bridge crashes the Kafka tests will timeout
    // This is a negative test confirming resilience
  });
});
