import { sleep } from "k6";
import { Options } from "k6/options";
import { setupSession, runPaymentFlow, spikeThresholds } from "./helpers";

export const options: Options = {
  thresholds: spikeThresholds,
  tags: { scenario: "spike-test" },
  stages: [
    { duration: "30s", target: 1 },   // warm up
    { duration: "30s", target: 50 },  // ramp to spike
    { duration: "1m",  target: 50 },  // hold spike
    { duration: "30s", target: 1 },   // ramp down
    { duration: "30s", target: 0 },   // cool down
  ],
};

export function setup() {
  console.log("Spike test: ramp 1 → 50 VUs over 30s, hold 1 min, ramp down");
  console.log("Thresholds: p95 < 2000ms, error rate < 2%");
}

export default function (): void {
  const session = setupSession();
  runPaymentFlow(session);
  sleep(0.5);
}
