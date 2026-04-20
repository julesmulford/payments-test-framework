import { v4 as uuidv4 } from "uuid";
import type {
  PaymentEvent,
  PaymentEventType,
  PaymentRequestedPayload,
  PaymentCompletedPayload,
  PaymentFailedPayload,
  PaymentErrorCode,
} from "../types/domain";

export function buildPaymentRequestedEvent(
  fromAccountId: number,
  toAccountId: number,
  amount: number,
  requestedBy: string,
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
      requestedBy,
    } as PaymentRequestedPayload,
  };
}

export function buildPaymentCompletedEvent(
  correlationId: string,
  fromAccountId: number,
  toAccountId: number,
  amount: number,
  transactionId: string
): PaymentEvent {
  return {
    eventType: "payment.completed",
    correlationId,
    timestamp: new Date().toISOString(),
    payload: {
      fromAccountId,
      toAccountId,
      amount,
      currency: "GBP",
      transactionId,
      completedAt: new Date().toISOString(),
    } as PaymentCompletedPayload,
  };
}

export function buildPaymentFailedEvent(
  correlationId: string,
  fromAccountId: number,
  toAccountId: number,
  amount: number,
  errorCode: PaymentErrorCode,
  errorMessage: string
): PaymentEvent {
  return {
    eventType: "payment.failed",
    correlationId,
    timestamp: new Date().toISOString(),
    payload: {
      fromAccountId,
      toAccountId,
      amount,
      errorCode,
      errorMessage,
      failedAt: new Date().toISOString(),
    } as PaymentFailedPayload,
  };
}

export function serialiseEvent(event: PaymentEvent): string {
  return JSON.stringify(event);
}

export function deserialiseEvent(raw: string): PaymentEvent {
  const parsed = JSON.parse(raw);
  assertValidEvent(parsed);
  return parsed;
}

export function assertValidEvent(event: unknown): asserts event is PaymentEvent {
  if (!event || typeof event !== "object") throw new Error("Event must be an object");
  const e = event as Record<string, unknown>;
  if (!e.eventType) throw new Error("Missing eventType");
  if (!e.correlationId) throw new Error("Missing correlationId");
  if (!e.timestamp) throw new Error("Missing timestamp");
  if (!e.payload) throw new Error("Missing payload");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(e.timestamp as string)) {
    throw new Error("timestamp must be ISO 8601");
  }
}
