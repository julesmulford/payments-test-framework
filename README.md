# Payments Test Framework

A BR-DGE style multi-layer test framework targeting **ParaBank** — a locally-run Java payments demo. Covers unit, component, API integration, contract (Pact), Kafka event, E2E, and performance testing, with GitHub Actions CI/CD pipelines and DORA instrumentation.

---

## Architecture

```
payments-test-framework/
├── packages/
│   ├── shared/              # Types, ParaBank API client, fixtures, factories
│   ├── unit-tests/          # Jest — pure logic, no I/O
│   ├── component-tests/     # Playwright vs WireMock doubles — no real ParaBank
│   ├── api-tests/           # Playwright API — real ParaBank required
│   ├── contract-tests/      # Pact — consumer + provider verification
│   ├── kafka-tests/         # KafkaJS — event flow tests
│   ├── kafka-bridge/        # Node service bridging Kafka → ParaBank
│   └── performance-tests/   # k6 — load, spike, soak
├── scripts/
│   ├── init-db.sh           # Initialise ParaBank HyperSQL DB
│   ├── can-i-deploy.sh      # PactFlow can-i-deploy check
│   ├── quarantine-flaky.ts  # Parse test results, flag flaky tests
│   └── emit-dora-event.ts   # Write DORA deployment events
├── .github/workflows/
│   ├── pr-gate.yml          # Unit + Component + Pact consumer (< 5 min)
│   ├── main-gate.yml        # Publish pacts + provider verify + API tests
│   └── nightly.yml          # E2E + Kafka + performance + auto-issue on fail
└── docker-compose.yml       # Full local stack
```

---

## Quick Start

### Prerequisites

- Docker Desktop
- Node.js 20+
- k6 (`brew install k6` / [k6.io/docs/get-started](https://k6.io/docs/get-started/installation/))
- PactFlow free-tier account (for contract publishing) — [pactflow.io](https://pactflow.io)

### 1. Start the local stack

```bash
docker compose up -d
```

This starts: ParaBank (`:3000`), Kafka + Zookeeper, Schema Registry, Kafka UI (`:8090`), WireMock (`:8080`), kafka-bridge, InfluxDB, Grafana (`:3001`).

### 2. Initialise the ParaBank database

```bash
bash scripts/init-db.sh
```

### 3. Install dependencies

```bash
npm install
npx playwright install chromium --with-deps
```

---

## Running Tests

### By layer

```bash
# Unit tests (no I/O — always fast)
npm run test:unit

# Component tests (WireMock must be running — no ParaBank needed)
npm run test:component

# API integration tests (ParaBank must be running)
npm run test:api

# Pact consumer tests (generates pact files locally)
npm run test:contract:consumer

# Pact provider verification (ParaBank + PactFlow credentials needed)
PACT_BROKER_BASE_URL=https://... PACT_BROKER_TOKEN=... npm run test:contract:provider

# Kafka tests (full stack must be running)
npm run test:kafka

# E2E tests (ParaBank must be running)
npm run test:e2e

# Performance — baseline
npm run test:perf:baseline

# Performance — spike
npm run test:perf:spike
```

### CI simulation (as pipelines would run)

```bash
# PR gate (unit + component + consumer)
npm run test:ci:pr

# Main gate (publish + provider + API)
PACT_BROKER_BASE_URL=... PACT_BROKER_TOKEN=... npm run test:ci:main
```

---

## Contract Testing Setup (PactFlow)

1. Sign up at [pactflow.io](https://pactflow.io) (free tier supports 5 integrations)
2. Create an API token under Settings → API Tokens
3. Add to `.env` (never commit this file):

```bash
PACT_BROKER_BASE_URL=https://your-org.pactflow.io
PACT_BROKER_TOKEN=your-token-here
```

4. Add both as GitHub Actions secrets: `PACT_BROKER_BASE_URL` and `PACT_BROKER_TOKEN`

---

## Kafka Topics

| Topic | Direction | Description |
|---|---|---|
| `payment.requested` | Inbound | Test publishes a payment request |
| `payment.completed` | Outbound | Bridge confirms successful ParaBank transfer |
| `payment.failed` | Outbound | Bridge reports failure with errorCode |
| `account.created` | Outbound | Future: account creation events |

Inspect live messages at **Kafka UI**: [http://localhost:8090](http://localhost:8090)

---

## Performance Dashboards

Grafana is pre-provisioned with InfluxDB as a datasource. Import the k6 dashboard:

1. Open [http://localhost:3001](http://localhost:3001)
2. Dashboards → Import → ID `2587`
3. Select the `InfluxDB-k6` datasource

---

## DORA Metrics

Every successful pipeline run writes to `dora-events.jsonl` and updates `dora-summary.json`. To view current metrics:

```bash
cat dora-summary.json
```

To record a manual deployment event:

```bash
PIPELINE_STATUS=success PIPELINE_NAME=manual npx ts-node scripts/emit-dora-event.ts
```

---

## Flakiness Quarantine

After any test run, check for flaky tests:

```bash
npx ts-node scripts/quarantine-flaky.ts --report packages/api-tests/test-results.json
```

Tests exceeding a 10% failure rate over 20 runs are added to `flaky-tests.json` and exit code 2 is returned so CI can alert without blocking.

---

## Test Layers — When Each Runs

| Layer | PR gate | Main gate | Nightly | Manual |
|---|---|---|---|---|
| Unit | ✅ | — | — | `npm run test:unit` |
| Component | ✅ | — | — | `npm run test:component` |
| Pact consumer | ✅ | ✅ | — | `npm run test:contract:consumer` |
| Pact provider | — | ✅ | — | `npm run test:contract:provider` |
| API integration | — | ✅ | — | `npm run test:api` |
| Kafka | — | — | ✅ | `npm run test:kafka` |
| E2E | — | — | ✅ | `npm run test:e2e` |
| Performance | — | — | ✅ (shortened) | `npm run test:perf:baseline` |
