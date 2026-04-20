#!/usr/bin/env ts-node
/**
 * emit-dora-event.ts
 *
 * Emits a deployment event to a local DORA log (dora-events.jsonl).
 * Each line is a newline-delimited JSON object so it can be ingested by
 * Grafana, Datadog, or any log aggregator.
 *
 * Also computes a rolling summary (dora-summary.json) with the four metrics.
 *
 * Usage (called by CI pipelines):
 *   PIPELINE_STATUS=success GIT_SHA=abc123 npx ts-node scripts/emit-dora-event.ts
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const EVENTS_FILE = path.resolve(__dirname, "../dora-events.jsonl");
const SUMMARY_FILE = path.resolve(__dirname, "../dora-summary.json");

interface DoraEvent {
  eventType: "deployment" | "incident_start" | "incident_resolved";
  timestamp: string;
  gitSha: string;
  gitBranch: string;
  pipelineName: string;
  pipelineStatus: "success" | "failure";
  durationMs?: number;
  environment: string;
}

interface DoraSummary {
  generatedAt: string;
  window: string;
  deploymentFrequency: {
    deploymentsLast30Days: number;
    avgPerDay: number;
    rating: string;
  };
  leadTimeForChanges: {
    avgMinutes: number;
    rating: string;
  };
  changeFailureRate: {
    percentage: number;
    rating: string;
  };
  totalDeployments: number;
  totalFailures: number;
}

function appendEvent(event: DoraEvent): void {
  fs.appendFileSync(EVENTS_FILE, JSON.stringify(event) + "\n");
}

function loadEvents(): DoraEvent[] {
  if (!fs.existsSync(EVENTS_FILE)) return [];
  return fs
    .readFileSync(EVENTS_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function computeSummary(events: DoraEvent[]): DoraSummary {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const deployments = events.filter((e) => e.eventType === "deployment");
  const recent = deployments.filter((e) => new Date(e.timestamp) > thirtyDaysAgo);
  const recentFailures = recent.filter((e) => e.pipelineStatus === "failure");

  const deploymentsLast30Days = recent.length;
  const avgPerDay = parseFloat((deploymentsLast30Days / 30).toFixed(2));
  const changeFailureRate = deploymentsLast30Days > 0
    ? parseFloat(((recentFailures.length / deploymentsLast30Days) * 100).toFixed(1))
    : 0;

  // DORA ratings
  const dfRating =
    avgPerDay >= 1 ? "Elite" :
    avgPerDay >= 1 / 7 ? "High" :
    avgPerDay >= 1 / 30 ? "Medium" : "Low";

  const cfrRating =
    changeFailureRate <= 5 ? "Elite" :
    changeFailureRate <= 10 ? "High" :
    changeFailureRate <= 15 ? "Medium" : "Low";

  return {
    generatedAt: now.toISOString(),
    window: "30 days",
    deploymentFrequency: {
      deploymentsLast30Days,
      avgPerDay,
      rating: dfRating,
    },
    leadTimeForChanges: {
      avgMinutes: 0, // Populated from CI pipeline start→deploy timestamps
      rating: "N/A — connect pipeline start time for full measurement",
    },
    changeFailureRate: {
      percentage: changeFailureRate,
      rating: cfrRating,
    },
    totalDeployments: deployments.length,
    totalFailures: deployments.filter((e) => e.pipelineStatus === "failure").length,
  };
}

function main(): void {
  let gitSha = process.env.GIT_SHA ?? "unknown";
  try {
    gitSha = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    // Use env var fallback
  }

  const event: DoraEvent = {
    eventType: "deployment",
    timestamp: new Date().toISOString(),
    gitSha,
    gitBranch: process.env.GIT_BRANCH ?? process.env.GITHUB_REF_NAME ?? "unknown",
    pipelineName: process.env.PIPELINE_NAME ?? "unknown",
    pipelineStatus:
      process.env.PIPELINE_STATUS === "failure" ? "failure" : "success",
    environment: process.env.DEPLOY_ENVIRONMENT ?? "staging",
  };

  appendEvent(event);
  console.log(`[dora] Deployment event recorded: ${event.gitSha} — ${event.pipelineStatus}`);

  const allEvents = loadEvents();
  const summary = computeSummary(allEvents);
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2));

  console.log("[dora] Summary updated:");
  console.log(`  Deployment frequency (30d): ${summary.deploymentFrequency.deploymentsLast30Days} deploys (${summary.deploymentFrequency.rating})`);
  console.log(`  Change failure rate:        ${summary.changeFailureRate.percentage}% (${summary.changeFailureRate.rating})`);
}

main();
