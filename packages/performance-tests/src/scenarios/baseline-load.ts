import { sleep } from "k6";
import { Options } from "k6/options";
import { setupSession, runPaymentFlow, baselineThresholds } from "./helpers";

export const options: Options = {
  vus: 10,
  duration: "2m",
  thresholds: baselineThresholds,
  tags: { scenario: "baseline-load" },
};

export function setup() {
  console.log("Baseline load test starting: 10 VUs for 2 minutes");
  console.log("Thresholds: p95 < 800ms, error rate < 1%");
}

export default function (): void {
  const session = setupSession();
  runPaymentFlow(session);
  sleep(1);
}
