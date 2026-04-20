#!/usr/bin/env ts-node
/**
 * quarantine-flaky.ts
 *
 * Reads a Playwright JSON test results file, compares against the rolling
 * history stored in flaky-history.json, and flags any test that has exceeded
 * the failure rate threshold. Flagged tests are written to flaky-tests.json
 * which CI can use to skip or tag them with @flaky.
 *
 * Usage:
 *   npx ts-node scripts/quarantine-flaky.ts --report packages/api-tests/test-results.json
 *   npx ts-node scripts/quarantine-flaky.ts --report packages/e2e-tests/test-results.json
 */

import fs from "fs";
import path from "path";

const HISTORY_FILE = path.resolve(__dirname, "../flaky-history.json");
const QUARANTINE_FILE = path.resolve(__dirname, "../flaky-tests.json");
const FAILURE_RATE_THRESHOLD = 0.10; // 10%
const ROLLING_WINDOW = 20;

interface TestResult {
  title: string;
  fullTitle: string;
  file: string;
  status: "passed" | "failed" | "skipped" | "flaky";
  retry: number;
}

interface PlaywrightReport {
  suites: Array<{
    title: string;
    file: string;
    specs: Array<{
      title: string;
      ok: boolean;
      tests: Array<{
        status: string;
        results: Array<{ status: string; retry: number }>;
      }>;
    }>;
  }>;
}

interface TestHistory {
  [testKey: string]: {
    runs: Array<{ timestamp: string; passed: boolean }>;
    quarantined: boolean;
    quarantinedAt?: string;
  };
}

function loadHistory(): TestHistory {
  if (!fs.existsSync(HISTORY_FILE)) return {};
  return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
}

function saveHistory(history: TestHistory): void {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function loadQuarantine(): string[] {
  if (!fs.existsSync(QUARANTINE_FILE)) return [];
  return JSON.parse(fs.readFileSync(QUARANTINE_FILE, "utf8"));
}

function saveQuarantine(tests: string[]): void {
  fs.writeFileSync(QUARANTINE_FILE, JSON.stringify(tests, null, 2));
}

function parseReport(reportPath: string): TestResult[] {
  const raw = fs.readFileSync(reportPath, "utf8");
  const report: PlaywrightReport = JSON.parse(raw);
  const results: TestResult[] = [];

  for (const suite of report.suites ?? []) {
    for (const spec of suite.specs ?? []) {
      const passed = spec.ok;
      const hasRetries = spec.tests?.some((t) =>
        t.results?.some((r) => r.retry > 0)
      );
      results.push({
        title: spec.title,
        fullTitle: `${suite.title} > ${spec.title}`,
        file: suite.file,
        status: hasRetries ? "flaky" : passed ? "passed" : "failed",
        retry: 0,
      });
    }
  }

  return results;
}

function updateHistory(results: TestResult[], history: TestHistory): void {
  const now = new Date().toISOString();

  for (const result of results) {
    const key = result.fullTitle;
    if (!history[key]) {
      history[key] = { runs: [], quarantined: false };
    }

    history[key].runs.push({
      timestamp: now,
      passed: result.status === "passed",
    });

    // Keep only the rolling window
    if (history[key].runs.length > ROLLING_WINDOW) {
      history[key].runs = history[key].runs.slice(-ROLLING_WINDOW);
    }
  }
}

function identifyFlaky(history: TestHistory): string[] {
  const flaky: string[] = [];

  for (const [testKey, data] of Object.entries(history)) {
    if (data.runs.length < 5) continue; // not enough data yet

    const failCount = data.runs.filter((r) => !r.passed).length;
    const failRate = failCount / data.runs.length;

    if (failRate > FAILURE_RATE_THRESHOLD && !data.quarantined) {
      flaky.push(testKey);
      data.quarantined = true;
      data.quarantinedAt = new Date().toISOString();
      console.log(
        `[quarantine] FLAGGED: "${testKey}" — ${Math.round(failRate * 100)}% failure rate over last ${data.runs.length} runs`
      );
    }
  }

  return flaky;
}

function main(): void {
  const reportFlag = process.argv.indexOf("--report");
  if (reportFlag === -1 || !process.argv[reportFlag + 1]) {
    console.error("Usage: quarantine-flaky.ts --report <path-to-test-results.json>");
    process.exit(1);
  }

  const reportPath = path.resolve(process.argv[reportFlag + 1]);
  if (!fs.existsSync(reportPath)) {
    console.error(`Report not found: ${reportPath}`);
    process.exit(1);
  }

  console.log(`[quarantine] Reading report: ${reportPath}`);
  const results = parseReport(reportPath);
  console.log(`[quarantine] Parsed ${results.length} test results`);

  const history = loadHistory();
  updateHistory(results, history);

  const newlyFlaky = identifyFlaky(history);
  saveHistory(history);

  const existingQuarantine = loadQuarantine();
  const allQuarantined = [
    ...new Set([...existingQuarantine, ...newlyFlaky]),
  ];
  saveQuarantine(allQuarantined);

  console.log(`[quarantine] Total quarantined tests: ${allQuarantined.length}`);

  if (newlyFlaky.length > 0) {
    console.warn(`[quarantine] WARNING: ${newlyFlaky.length} new test(s) quarantined this run`);
    process.exit(2); // non-zero so CI can flag this, but not a hard failure
  } else {
    console.log("[quarantine] No new flaky tests detected");
    process.exit(0);
  }
}

main();
