import type { TransferRequest } from "../types/domain";

// ── Validator (src would live in shared, kept here for demo) ──────────────

export type ValidationResult = { valid: true } | { valid: false; errors: string[] };

export function validateTransfer(req: Partial<TransferRequest>): ValidationResult {
  const errors: string[] = [];

  if (req.amount === undefined || req.amount === null) {
    errors.push("amount is required");
  } else if (typeof req.amount !== "number" || isNaN(req.amount)) {
    errors.push("amount must be a number");
  } else if (req.amount <= 0) {
    errors.push("amount must be greater than zero");
  } else if (!Number.isFinite(req.amount)) {
    errors.push("amount must be finite");
  }

  if (!req.fromAccountId) {
    errors.push("fromAccountId is required");
  }

  if (!req.toAccountId) {
    errors.push("toAccountId is required");
  }

  if (
    req.fromAccountId &&
    req.toAccountId &&
    req.fromAccountId === req.toAccountId
  ) {
    errors.push("source and target accounts must be different");
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
