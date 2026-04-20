// ── Domain Types ─────────────────────────────────────────────────────────────

export interface Customer {
  id?: number;
  firstName: string;
  lastName: string;
  address: Address;
  phoneNumber: string;
  ssn: string;
  username: string;
  password: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface Account {
  id: number;
  customerId: number;
  type: AccountType;
  balance: number;
}

export type AccountType = "CHECKING" | "SAVINGS";

export interface Transaction {
  id: number;
  accountId: number;
  type: TransactionType;
  date: number;
  amount: number;
  description: string;
}

export type TransactionType = "Debit" | "Credit";

export interface TransferRequest {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
}

export interface TransferResult {
  success: boolean;
  message?: string;
}

export interface LoginResult {
  customerId: number;
  firstName: string;
  lastName: string;
}

export interface BillPayRequest {
  payeeName: string;
  address: Address;
  phoneNumber: string;
  accountNumber: string;
  routingNumber: string;
  amount: number;
  fromAccountId: number;
}

// ── Kafka Event Types ─────────────────────────────────────────────────────────

export interface PaymentEvent {
  eventType: PaymentEventType;
  correlationId: string;
  timestamp: string; // ISO 8601
  payload: PaymentRequestedPayload | PaymentCompletedPayload | PaymentFailedPayload;
}

export type PaymentEventType = "payment.requested" | "payment.completed" | "payment.failed";

export interface PaymentRequestedPayload {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  currency: string;
  requestedBy: string;
}

export interface PaymentCompletedPayload {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  currency: string;
  transactionId: string;
  completedAt: string;
}

export interface PaymentFailedPayload {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  errorCode: PaymentErrorCode;
  errorMessage: string;
  failedAt: string;
}

export type PaymentErrorCode =
  | "INSUFFICIENT_FUNDS"
  | "ACCOUNT_NOT_FOUND"
  | "INVALID_AMOUNT"
  | "DUPLICATE_TRANSACTION"
  | "PROVIDER_ERROR";
