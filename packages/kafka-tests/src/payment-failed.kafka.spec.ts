import {
  TOPICS,
  createTestProducer,
  publishPaymentEvent,
  waitForMessage,
  ensureTopicsExist,
  buildPaymentRequestedEvent,
} from "../kafka.helpers";
import { v4 as uuidv4 } from "uuid";

describe("Kafka — payment.failed paths", () => {
  let producer: Awaited<ReturnType<typeof createTestProducer>>;

  beforeAll(async () => {
    await ensureTopicsExist();
    producer = await createTestProducer();
  });

  afterAll(async () => {
    await producer.disconnect();
  });

  test("payment to non-existent account publishes payment.failed event", async () => {
    const correlationId = uuidv4();
    const NON_EXISTENT_ACCOUNT = 9999999;

    const failedPromise = waitForMessage({
      topic: TOPICS.PAYMENT_FAILED,
      correlationId,
      timeoutMs: 25_000,
    });

    await publishPaymentEvent(
      producer,
      TOPICS.PAYMENT_REQUESTED,
      buildPaymentRequestedEvent(99999998, NON_EXISTENT_ACCOUNT, 50, correlationId)
    );

    const failed = await failedPromise;

    expect(failed.eventType).toBe("payment.failed");
    expect(failed.correlationId).toBe(correlationId);

    const payload = failed.payload as Record<string, unknown>;
    expect(payload.errorCode).toBeTruthy();
    expect(typeof payload.errorMessage).toBe("string");
    expect(payload.failedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("failed event preserves the original account IDs from the request", async () => {
    const correlationId = uuidv4();
    const badFrom = 88888881;
    const badTo = 88888882;

    const failedPromise = waitForMessage({
      topic: TOPICS.PAYMENT_FAILED,
      correlationId,
      timeoutMs: 25_000,
    });

    await publishPaymentEvent(
      producer,
      TOPICS.PAYMENT_REQUESTED,
      buildPaymentRequestedEvent(badFrom, badTo, 100, correlationId)
    );

    const failed = await failedPromise;
    const payload = failed.payload as Record<string, unknown>;

    expect(payload.fromAccountId).toBe(badFrom);
    expect(payload.toAccountId).toBe(badTo);
    expect(payload.amount).toBe(100);
  });

  test("failed event errorCode is one of the known error codes", async () => {
    const correlationId = uuidv4();
    const KNOWN_CODES = [
      "INSUFFICIENT_FUNDS",
      "ACCOUNT_NOT_FOUND",
      "INVALID_AMOUNT",
      "DUPLICATE_TRANSACTION",
      "PROVIDER_ERROR",
    ];

    const failedPromise = waitForMessage({
      topic: TOPICS.PAYMENT_FAILED,
      correlationId,
      timeoutMs: 25_000,
    });

    await publishPaymentEvent(
      producer,
      TOPICS.PAYMENT_REQUESTED,
      buildPaymentRequestedEvent(77777771, 77777772, 50, correlationId)
    );

    const failed = await failedPromise;
    const payload = failed.payload as { errorCode: string };

    expect(KNOWN_CODES).toContain(payload.errorCode);
  });
});
