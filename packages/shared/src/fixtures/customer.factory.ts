import type { Customer, Address, BillPayRequest } from "../types/domain";

let counter = 0;

function nextId(): number {
  return Date.now() + ++counter;
}

const STREETS = ["Maple Street", "Oak Avenue", "Pine Road", "Cedar Lane", "Elm Court"];
const CITIES = ["Springfield", "Riverside", "Fairview", "Madison", "Georgetown"];
const STATES = ["CA", "NY", "TX", "FL", "WA"];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDigits(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
}

// ABA checksum: 3*d1 + 7*d2 + d3 + 3*d4 + 7*d5 + d6 + 3*d7 + 7*d8 + d9 ≡ 0 (mod 10)
function validRoutingNumber(): string {
  const d = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10));
  const weights = [3, 7, 1, 3, 7, 1, 3, 7];
  const sum = d.reduce((acc, digit, i) => acc + digit * weights[i], 0);
  const check = (10 - (sum % 10)) % 10;
  return [...d, check].join("");
}

export function buildAddress(overrides: Partial<Address> = {}): Address {
  return {
    street: `${Math.floor(Math.random() * 999) + 1} ${randomElement(STREETS)}`,
    city: randomElement(CITIES),
    state: randomElement(STATES),
    zipCode: randomDigits(5),
    ...overrides,
  };
}

export function buildCustomer(overrides: Partial<Customer> = {}): Customer {
  const id = nextId();
  const username = `user_${id}`;
  return {
    firstName: `Test${id}`,
    lastName: `User`,
    address: buildAddress(),
    phoneNumber: `555-${randomDigits(3)}-${randomDigits(4)}`,
    ssn: randomDigits(9),
    username,
    password: `Pass${id}!`,
    ...overrides,
  };
}

export function buildBillPayRequest(fromAccountId: number, overrides: Partial<BillPayRequest> = {}): BillPayRequest {
  const id = nextId();
  return {
    payeeName: `Utility Co ${id}`,
    address: buildAddress(),
    phoneNumber: `555-${randomDigits(3)}-${randomDigits(4)}`,
    accountNumber: randomDigits(10),
    routingNumber: validRoutingNumber(),
    amount: Math.floor(Math.random() * 200) + 10,
    fromAccountId,
    ...overrides,
  };
}
