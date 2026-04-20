import {
  buildPaymentRequestedEvent,
  buildPaymentCompletedEvent,
  buildPaymentFailedEvent,
  serialiseEvent,
  deserialiseEvent,
  assertValidEvent,
} from "../../shared/src/fixtures/payment-event.serialiser";

describe("Payment Event Serialiser", () => {
  const FROM = 12345;
  const TO = 67890;
  const AMOUNT = 250.0;

  describe("buildPaymentRequestedEvent()", () => {
    it("produces a valid payment.requested event", () => {
      const event = buildPaymentRequestedEvent(FROM, TO, AMOUNT, "user_001");
      expect(event.eventType).toBe("payment.requested");
      expect(event.correlationId).toBeTruthy();
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("uses the provided correlationId when supplied", () => {
      const id = "test-correlation-123";
      const event = buildPaymentRequestedEvent(FROM, TO, AMOUNT, "user_001", id);
      expect(event.correlationId).toBe(id);
    });

    it("generates a unique correlationId when not supplied", () => {
      const a = buildPaymentRequestedEvent(FROM, TO, AMOUNT, "u1");
      const b = buildPaymentRequestedEvent(FROM, TO, AMOUNT, "u1");
      expect(a.correlationId).not.toBe(b.correlationId);
    });

    it("payload contains correct account IDs and amount", () => {
      const event = buildPaymentRequestedEvent(FROM, TO, AMOUNT, "u1");
      const p = event.payload as { fromAccountId: number; toAccountId: number; amount: number };
      expect(p.fromAccountId).toBe(FROM);
      expect(p.toAccountId).toBe(TO);
      expect(p.amount).toBe(AMOUNT);
    });

    it("currency defaults to GBP", () => {
      const event = buildPaymentRequestedEvent(FROM, TO, AMOUNT, "u1");
      const p = event.payload as { currency: string };
      expect(p.currency).toBe("GBP");
    });
  });

  describe("buildPaymentCompletedEvent()", () => {
    it("produces a valid payment.completed event with matching correlationId", () => {
      const event = buildPaymentCompletedEvent("corr-abc", FROM, TO, AMOUNT, "txn-001");
      expect(event.eventType).toBe("payment.completed");
      expect(event.correlationId).toBe("corr-abc");
    });

    it("payload contains transactionId and completedAt", () => {
      const event = buildPaymentCompletedEvent("corr-abc", FROM, TO, AMOUNT, "txn-001");
      const p = event.payload as { transactionId: string; completedAt: string };
      expect(p.transactionId).toBe("txn-001");
      expect(p.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("buildPaymentFailedEvent()", () => {
    it("produces a valid payment.failed event", () => {
      const event = buildPaymentFailedEvent(
        "corr-xyz", FROM, TO, AMOUNT, "INSUFFICIENT_FUNDS", "Balance too low"
      );
      expect(event.eventType).toBe("payment.failed");
      expect(event.correlationId).toBe("corr-xyz");
    });

    it("payload contains errorCode and errorMessage", () => {
      const event = buildPaymentFailedEvent(
        "corr-xyz", FROM, TO, AMOUNT, "ACCOUNT_NOT_FOUND", "No such account"
      );
      const p = event.payload as { errorCode: string; errorMessage: string };
      expect(p.errorCode).toBe("ACCOUNT_NOT_FOUND");
      expect(p.errorMessage).toBe("No such account");
    });
  });

  describe("serialiseEvent() / deserialiseEvent()", () => {
    it("round-trips an event through JSON serialisation", () => {
      const original = buildPaymentRequestedEvent(FROM, TO, AMOUNT, "u1", "corr-rt");
      const raw = serialiseEvent(original);
      const restored = deserialiseEvent(raw);
      expect(restored).toEqual(original);
    });

    it("throws on invalid JSON", () => {
      expect(() => deserialiseEvent("not json")).toThrow();
    });

    it("throws when correlationId is missing", () => {
      const broken = JSON.stringify({ eventType: "payment.requested", timestamp: new Date().toISOString(), payload: {} });
      expect(() => deserialiseEvent(broken)).toThrow("Missing correlationId");
    });

    it("throws when timestamp is not ISO 8601", () => {
      const broken = JSON.stringify({
        eventType: "payment.requested",
        correlationId: "abc",
        timestamp: "not-a-date",
        payload: {},
      });
      expect(() => deserialiseEvent(broken)).toThrow("timestamp must be ISO 8601");
    });
  });

  describe("assertValidEvent()", () => {
    it("does not throw for a valid event object", () => {
      const event = buildPaymentRequestedEvent(FROM, TO, AMOUNT, "u1");
      expect(() => assertValidEvent(event)).not.toThrow();
    });

    it("throws for null input", () => {
      expect(() => assertValidEvent(null)).toThrow();
    });

    it("throws for a string input", () => {
      expect(() => assertValidEvent("string")).toThrow();
    });
  });
});
