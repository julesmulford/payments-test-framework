import { Kafka, Producer, Consumer, EachMessagePayload } from "kafkajs";
import { v4 as uuidv4 } from "uuid";

// ── Config ────────────────────────────────────────────────────────────────────

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS ?? "localhost:9092").split(",");
const PARABANK_BASE_URL = process.env.PARABANK_BASE_URL ?? "http://localhost:3000/parabank";
const TOPIC_REQUESTED = process.env.PAYMENT_REQUESTED_TOPIC ?? "payment.requested";
const TOPIC_COMPLETED = process.env.PAYMENT_COMPLETED_TOPIC ?? "payment.completed";
const TOPIC_FAILED = process.env.PAYMENT_FAILED_TOPIC ?? "payment.failed";
const GROUP_ID = "kafka-bridge-payment-processor";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaymentRequestedPayload {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  currency: string;
  requestedBy: string;
}

interface PaymentEvent {
  eventType: string;
  correlationId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

// ── In-flight deduplication (correlationId → processed) ──────────────────────

const processedCorrelationIds = new Set<string>();

// ── ParaBank HTTP helpers ─────────────────────────────────────────────────────

async function initParaBankSession(): Promise<{ cookie: string; customerId: number }> {
  // Use the test admin account that ParaBank ships with
  const loginUrl = `${PARABANK_BASE_URL}/services/bank/login/john/demo`;
  const res = await fetch(loginUrl, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`ParaBank login failed: ${res.status}`);
  }

  const setCookie = res.headers.get("set-cookie") ?? "";
  const body = (await res.json()) as { id: number };
  return { cookie: setCookie, customerId: body.id };
}

async function executeParaBankTransfer(
  fromAccountId: number,
  toAccountId: number,
  amount: number,
  cookie: string
): Promise<void> {
  const url = `${PARABANK_BASE_URL}/services/bank/transfer?fromAccountId=${fromAccountId}&toAccountId=${toAccountId}&amount=${amount}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Cookie: cookie,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Transfer failed (${res.status}): ${body}`);
  }
}

// ── Kafka client ──────────────────────────────────────────────────────────────

const kafka = new Kafka({
  clientId: "kafka-bridge",
  brokers: KAFKA_BROKERS,
  retry: { retries: 5, initialRetryTime: 1000 },
});

const producer: Producer = kafka.producer();
const consumer: Consumer = kafka.consumer({ groupId: GROUP_ID });

async function publishEvent(topic: string, event: PaymentEvent): Promise<void> {
  await producer.send({
    topic,
    messages: [
      {
        key: event.correlationId,
        value: JSON.stringify(event),
        headers: {
          "event-type": event.eventType,
          "correlation-id": event.correlationId,
        },
      },
    ],
  });
}

// ── Message processor ─────────────────────────────────────────────────────────

async function processPaymentRequested(
  raw: string,
  session: { cookie: string }
): Promise<void> {
  const event: PaymentEvent = JSON.parse(raw);
  const { correlationId } = event;
  const payload = event.payload as PaymentRequestedPayload;

  // Idempotency check — skip if already processed
  if (processedCorrelationIds.has(correlationId)) {
    console.log(`[bridge] Skipping duplicate correlationId: ${correlationId}`);
    return;
  }

  console.log(`[bridge] Processing payment: ${correlationId} — £${payload.amount} from ${payload.fromAccountId} → ${payload.toAccountId}`);

  try {
    await executeParaBankTransfer(
      payload.fromAccountId,
      payload.toAccountId,
      payload.amount,
      session.cookie
    );

    processedCorrelationIds.add(correlationId);

    await publishEvent(TOPIC_COMPLETED, {
      eventType: "payment.completed",
      correlationId,
      timestamp: new Date().toISOString(),
      payload: {
        fromAccountId: payload.fromAccountId,
        toAccountId: payload.toAccountId,
        amount: payload.amount,
        currency: payload.currency ?? "GBP",
        transactionId: uuidv4(),
        completedAt: new Date().toISOString(),
      },
    });

    console.log(`[bridge] Payment completed: ${correlationId}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    const errorCode = errorMessage.includes("Insufficient")
      ? "INSUFFICIENT_FUNDS"
      : errorMessage.includes("not found") || errorMessage.includes("404")
      ? "ACCOUNT_NOT_FOUND"
      : "PROVIDER_ERROR";

    processedCorrelationIds.add(correlationId); // Mark as processed to prevent retry loops

    await publishEvent(TOPIC_FAILED, {
      eventType: "payment.failed",
      correlationId,
      timestamp: new Date().toISOString(),
      payload: {
        fromAccountId: payload.fromAccountId,
        toAccountId: payload.toAccountId,
        amount: payload.amount,
        errorCode,
        errorMessage,
        failedAt: new Date().toISOString(),
      },
    });

    console.log(`[bridge] Payment failed: ${correlationId} — ${errorCode}: ${errorMessage}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("[bridge] Starting kafka-bridge...");
  console.log(`[bridge] Brokers: ${KAFKA_BROKERS.join(", ")}`);
  console.log(`[bridge] ParaBank: ${PARABANK_BASE_URL}`);

  await producer.connect();
  await consumer.connect();

  const session = await initParaBankSession();
  console.log(`[bridge] Authenticated with ParaBank (customerId: ${session.customerId})`);

  await consumer.subscribe({ topic: TOPIC_REQUESTED, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }: EachMessagePayload) => {
      if (!message.value) return;
      await processPaymentRequested(message.value.toString(), session);
    },
  });

  console.log(`[bridge] Listening on topic: ${TOPIC_REQUESTED}`);

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("[bridge] Shutting down...");
    await consumer.disconnect();
    await producer.disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[bridge] Fatal error:", err);
  process.exit(1);
});
