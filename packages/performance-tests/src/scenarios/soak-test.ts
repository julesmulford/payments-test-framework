import { sleep, check } from "k6";
import { Options } from "k6/options";
import { Counter, Trend } from "k6/metrics";
import http from "k6/http";
import { setupSession, runPaymentFlow, soakThresholds, PARABANK_BASE } from "./helpers";

// Custom metrics to detect degradation over time
const transferDuration = new Trend("transfer_duration_ms", true);
const errorCount = new Counter("soak_errors_total");

export const options: Options = {
  vus: 5,
  duration: "10m",
  thresholds: {
    ...soakThresholds,
    // Detect memory leak / response time degradation: p95 must stay flat
    transfer_duration_ms: ["p(95)<1000"],
    soak_errors_total: ["count<10"],
  },
  tags: { scenario: "soak-test" },
};

export function setup() {
  console.log("Soak test: 5 VUs sustained for 10 minutes");
  console.log("Watching for response time degradation and memory-related errors");
}

export default function (): void {
  const session = setupSession();

  const start = Date.now();
  try {
    runPaymentFlow(session);
  } catch (e) {
    errorCount.add(1);
  }
  transferDuration.add(Date.now() - start);

  sleep(2);
}

export function handleSummary(data: Record<string, unknown>) {
  return {
    "soak-summary.json": JSON.stringify(data, null, 2),
  };
}
