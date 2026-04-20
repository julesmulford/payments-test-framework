import { Publisher } from "@pact-foundation/pact-core";
import path from "path";
import { execSync } from "child_process";

const brokerUrl = process.env.PACT_BROKER_BASE_URL;
const brokerToken = process.env.PACT_BROKER_TOKEN;

if (!brokerUrl || !brokerToken) {
  console.error("ERROR: PACT_BROKER_BASE_URL and PACT_BROKER_TOKEN must be set");
  process.exit(1);
}

let gitSha = `local-${Date.now()}`;
try {
  const sha = execSync("git rev-parse --short HEAD").toString().trim();
  const dirty = execSync("git status --porcelain").toString().trim();
  gitSha = dirty ? `${sha}-dirty` : sha;
} catch {
  console.warn("Could not read git SHA — using timestamped local version");
}

const publisher = new Publisher({
  pactBroker: brokerUrl,
  pactBrokerToken: brokerToken,
  pactFilesOrDirs: [path.resolve(__dirname, "../../pacts")],
  consumerVersion: gitSha,
  tags: [process.env.GIT_BRANCH ?? "main"],
});

publisher
  .publish()
  .then(() => {
    console.log(`Pacts published successfully (version: ${gitSha})`);
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error("Pact publish failed:", err);
    process.exit(1);
  });
