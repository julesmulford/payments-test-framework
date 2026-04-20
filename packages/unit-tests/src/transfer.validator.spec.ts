import { validateTransfer } from "../../shared/src/fixtures/transfer.validator";

describe("Transfer Validator", () => {
  const valid = { fromAccountId: 12345, toAccountId: 67890, amount: 100 };

  it("passes a valid transfer request", () => {
    expect(validateTransfer(valid)).toEqual({ valid: true });
  });

  describe("amount validation", () => {
    it("rejects missing amount", () => {
      const result = validateTransfer({ ...valid, amount: undefined });
      expect(result.valid).toBe(false);
      const errors = result.valid === false ? result.errors : [];
      expect(errors).toContain("amount is required");
    });

    it("rejects zero amount", () => {
      const result = validateTransfer({ ...valid, amount: 0 });
      expect(result.valid).toBe(false);
      const errors = result.valid === false ? result.errors : [];
      expect(errors).toContain("amount must be greater than zero");
    });

    it("rejects negative amount", () => {
      const result = validateTransfer({ ...valid, amount: -50 });
      expect(result.valid).toBe(false);
    });

    it("rejects NaN amount", () => {
      const result = validateTransfer({ ...valid, amount: NaN });
      expect(result.valid).toBe(false);
    });

    it("rejects Infinity", () => {
      const result = validateTransfer({ ...valid, amount: Infinity });
      expect(result.valid).toBe(false);
    });

    it("accepts decimal amounts", () => {
      expect(validateTransfer({ ...valid, amount: 0.01 })).toEqual({ valid: true });
    });
  });

  describe("account validation", () => {
    it("rejects missing fromAccountId", () => {
      const result = validateTransfer({ ...valid, fromAccountId: undefined });
      expect(result.valid).toBe(false);
      const errors = result.valid === false ? result.errors : [];
      expect(errors).toContain("fromAccountId is required");
    });

    it("rejects missing toAccountId", () => {
      const result = validateTransfer({ ...valid, toAccountId: undefined });
      expect(result.valid).toBe(false);
      const errors = result.valid === false ? result.errors : [];
      expect(errors).toContain("toAccountId is required");
    });

    it("rejects same source and target account", () => {
      const result = validateTransfer({ ...valid, toAccountId: valid.fromAccountId });
      expect(result.valid).toBe(false);
      const errors = result.valid === false ? result.errors : [];
      expect(errors).toContain("source and target accounts must be different");
    });
  });

  it("accumulates multiple errors", () => {
    const result = validateTransfer({});
    expect(result.valid).toBe(false);
    const errors = result.valid === false ? result.errors : [];
    expect(errors.length).toBeGreaterThan(1);
  });
});
