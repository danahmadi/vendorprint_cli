import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("resume skips normalized completed domains and repairs a partial tail", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vendorprint-test-"));
  const checkpointPath = join(directory, "checkpoint.ndjson");
  const completed = JSON.stringify({
    type: "result",
    finding: { domain: "example.com" },
  });
  await writeFile(checkpointPath, `${completed}\n{"type":"res`);

  const run = spawnSync(
    process.execPath,
    [
      "bin/vendorprint.mjs",
      "https://www.example.com/about",
      "--findings-only",
      "--resume",
      checkpointPath,
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    },
  );

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /No pending domains/);
  assert.equal(await readFile(checkpointPath, "utf8"), `${completed}\n`);
});

test("prints the signature catalog without performing a scan", () => {
  const run = spawnSync(
    process.execPath,
    ["bin/vendorprint.mjs", "signatures"],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    },
  );
  assert.equal(run.status, 0, run.stderr);
  const catalog = JSON.parse(run.stdout);
  assert.match(catalog.catalogVersion, /^\d{4}\.\d{2}\.\d{2}$/);
});

test("audits scan files offline through the CLI", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vendorprint-audit-"));
  const scanPath = join(directory, "scan.json");
  await writeFile(
    scanPath,
    JSON.stringify({
      results: [
        {
          domain: "private.example",
          technologySignals: {
            unclassifiedDomainVerifications: [
              { recordPrefix: "unknown-vendor-verification" },
            ],
          },
        },
      ],
    }),
  );
  const run = spawnSync(
    process.execPath,
    ["bin/vendorprint.mjs", "signatures", "audit", scanPath],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    },
  );
  assert.equal(run.status, 0, run.stderr);
  const audit = JSON.parse(run.stdout);
  assert.equal(audit.domainsAudited, 1);
  assert.doesNotMatch(run.stdout, /private\.example/);
});
