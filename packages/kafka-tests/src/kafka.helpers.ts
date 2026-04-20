import { Kafka, Producer, Consumer, Admin, EachMessagePayload } from "kafkajs";
import { v4 as uuidv4 } from "uuid";

export const TOPICS = {
  PAYMENT_REQUESTED: "payment.requested",
  PAYMENT_COMPLETED: "payment.completed",
  PAYMENT_FAILED: "payment.failed",
  ACCOUNT_CREATED: "account.created",
} as const;

const BROKERS = (process.env.KAFKA_BROKERS ?? "localhost:9092").split(",");

export interface PaymentEvent {
  eventType: string;
  correlationId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

// ── Kafka client factory ──────────────────────────────────────────────────────

export function createKafkaClient(clientId?: string): Kafka {
  return new Kafka({
    clientId: clientId ?? `test-client-${uuidv4().slice(0, 8)}`,
    brokers: BROKERS,
    logLevel: 1, // ERROR only — suppress INFO noise in test output
  });
}

// ── Producer helper ───────────────────────────────────────────────────────────

export async function createTestProducer(): Promise<Producer> {
  const kafka = createKafkaClient("test-producer");
  const producer = kafka.producer();
  await producer.connect();
  return producer;
}

export async function publishPaymentEvent(
  producer: Producer,
  topic: string,
  event: PaymentEvent
): Promise<void> {
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

// ── Consumer helper — waits for a matching message ────────────────────────────

export interface WaitForMessageOptions {
  topic: string;
  correlationId: string;
  timeoutMs?: number;
}

export async function waitForMessage(
  options: WaitForMessageOptions
): Promise<PaymentEvent> {
  const { topic, correlationId, timeoutMs = 20_000 } = options;
  const kafka = createKafkaClient("test-consumer");
  const consumer = kafka.consumer({
    groupId: `test-group-${uuidv4().slice(0, 8)}`,
  });

  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });

  return new Promise<PaymentEvent>((resolve, reject) => {
    const timeout = setTimeout(async () => {
      await consumer.disconnect();
      reject(new Error(`Timeout waiting for correlationId "${correlationId}" on topic "${topic}" after ${timeoutMs}ms`));
    }, timeoutMs);

    consumer.run({
      eachMessage: async ({ message }: EachMessagePayload) => {
        if (!message.value) return;
        const event: PaymentEvent = JSON.parse(message.value.toString());
        if (event.correlationId === correlationId) {
          clearTimeout(timeout);
          await consumer.disconnect();
          resolve(event);
        }
      },
    });
  });
}

// ── Wait for multiple messages matching a correlationId ───────────────────────

export async function waitForMessages(
  topic: string,
  correlationId: string,
  expectedCount: number,
  timeoutMs = 20_000
): Promise<PaymentEvent[]> {
  const kafka = createKafkaClient("test-multi-consumer");
  const consumer = kafka.consumer({
    groupId: `test-group-multi-${uuidv4().slice(0, 8)}`,
  });

  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });

  const collected: PaymentEvent[] = [];

  return new Promise<PaymentEvent[]>((resolve, reject) => {
    const timeout = setTimeout(async () => {
      await consumer.disconnect();
      // Return what we collected even if not enough — test will assert count
      resolve(collected);
    }, timeoutMs);

    consumer.run({
      eachMessage: async ({ message }: EachMessagePayload) => {
        if (!message.value) return;
        const event: PaymentEvent = JSON.parse(message.value.toString());
        if (event.correlationId === correlationId) {
          collected.push(event);
          if (collected.length >= expectedCount) {
            clearTimeout(timeout);
            await consumer.disconnect();
            resolve(collected);
          }
        }
      },
    });
  });
}

// ── Admin — ensure topics exist ───────────────────────────────────────────────

export async function ensureTopicsExist(): Promise<void> {
  const kafka = createKafkaClient("test-admin");
  const admin: Admin = kafka.admin();
  await admin.connect();

  const existing = await admin.listTopics();
  const toCreate = Object.values(TOPICS).filter((t) => !existing.includes(t));

  if (toCreate.length > 0) {
    await admin.createTopics({
      topics: toCreate.map((topic) => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1,
      })),
    });
  }

  await admin.disconnect();
}

// ── Event builders ────────────────────────────────────────────────────────────

export function buildPaymentRequestedEvent(
  fromAccountId: number,
  toAccountId: number,
  amount: number,
  correlationId?: string
): PaymentEvent {
  return {
    eventType: "payment.requested",
    correlationId: correlationId ?? uuidv4(),
    timestamp: new Date().toISOString(),
    payload: {
      fromAccountId,
      toAccountId,
      amount,
      currency: "GBP",
      requestedBy: "test-suite",
    },
  };
}
