import test from "node:test";
import assert from "node:assert/strict";
import {
  compactEvent,
  compactReport,
  compactResult,
  parseNdjsonCheckpoint,
} from "../src/output.mjs";

function fullResult(overrides = {}) {
  return {
    domain: "example.com",
    status: "ok",
    mail: {
      provider: "Google Workspace",
      confidence: "high",
      gateways: [],
    },
    technologyProfile: {
      aiWorkspaces: [],
      crm: [
        {
          provider: "Salesforce",
          confidence: "high",
          relationshipLevel: "platform_configuration",
          productScope: "salesforce_platform",
          evidence: [
            {
              type: "cname",
              confidence: "high",
              relationship: "platform_configuration",
              hostname: "support.example.com",
              target: "tenant.force.com",
            },
          ],
          caveat:
            "A hosted custom domain proves platform use, not active seats.",
        },
      ],
      marketingAutomation: [],
      inferenceGraph: {
        version: "1.0",
        inferred: [],
        candidateSets: [{ category: "crm", candidates: ["Salesforce"] }],
      },
    },
    technologySignals: {
      cnameServices: [],
    },
    querySafety: {
      candidateLabelsChecked: 46,
      adaptive: {
        delegatedSubdomainsChecked: ["email", "mail", "news"],
      },
    },
    salesEngagement: {
      labelsChecked: ["click", "track", "go"],
      detected: [],
    },
    ...overrides,
  };
}

test("result-first output keeps findings and hides scan internals", () => {
  const output = compactResult(fullResult());

  assert.deepEqual(output, {
    domain: "example.com",
    status: "ok",
    email: {
      provider: "Google Workspace",
      confidence: "high",
    },
    technologyProfile: {
      crm: [
        {
          provider: "Salesforce",
          confidence: "high",
          relationshipLevel: "platform_configuration",
          productScope: "salesforce_platform",
          evidence: [
            {
              type: "cname",
              confidence: "high",
              relationship: "platform_configuration",
              hostname: "support.example.com",
              target: "tenant.force.com",
            },
          ],
          caveat:
            "A hosted custom domain proves platform use, not active seats.",
        },
      ],
    },
  });
  assert.doesNotMatch(
    JSON.stringify(output),
    /labelsChecked|querySafety|candidateSets|inferenceGraph/,
  );
});

test("result-first output explains an inconclusive empty result", () => {
  const output = compactResult(
    fullResult({
      status: "limited_dns_response",
      mail: {
        provider: "No MX record",
        confidence: "none",
        gateways: [],
      },
      technologyProfile: {
        crm: [],
        marketingAutomation: [],
        inferenceGraph: {
          inferred: [],
          candidateSets: [],
        },
      },
    }),
  );

  assert.deepEqual(output.technologyProfile, {});
  assert.match(output.interpretation, /Absence is inconclusive/);
  assert.equal("email" in output, false);
});

test("compact reports and events omit methodology and signature diagnostics", () => {
  const report = compactReport({
    schemaVersion: "1.2",
    signatureCatalogVersion: "2026.07.29",
    generatedAt: "2026-07-30T00:00:00.000Z",
    durationMs: 25,
    methodology: { scope: "full detail" },
    summary: { requested: 1, scanned: 1, invalid: 0 },
    invalidInputs: [],
    results: [fullResult()],
  });
  assert.equal("methodology" in report, false);
  assert.equal("signatureCatalogVersion" in report, false);
  assert.equal("invalidInputs" in report, false);

  const event = compactEvent({
    type: "meta",
    schemaVersion: "1.2",
    signatureCatalogVersion: "2026.07.29",
    generatedAt: "2026-07-30T00:00:00.000Z",
    methodology: { scope: "full detail" },
    summary: { requested: 1, scheduled: 1, invalid: 0 },
    invalidInputs: [],
  });
  assert.deepEqual(event, {
    type: "meta",
    schemaVersion: "1.2",
    generatedAt: "2026-07-30T00:00:00.000Z",
    summary: { requested: 1, scheduled: 1, invalid: 0 },
  });
});

test("reads completed domains from full and compact NDJSON events", () => {
  const checkpoint = parseNdjsonCheckpoint(
    [
      JSON.stringify({ type: "meta", schemaVersion: "1.1" }),
      JSON.stringify({
        type: "result",
        result: { domain: "example.com" },
      }),
      JSON.stringify({
        type: "result",
        finding: { domain: "example.org" },
      }),
      JSON.stringify({ type: "summary" }),
      "",
    ].join("\n"),
  );
  assert.deepEqual(
    [...checkpoint.completedDomains],
    ["example.com", "example.org"],
  );
  assert.equal(checkpoint.resultEvents, 2);
  assert.equal(checkpoint.hasSummary, true);
  assert.equal(checkpoint.trailingPartial, false);
});

test("tolerates only a final partial NDJSON line after interruption", () => {
  const checkpoint = parseNdjsonCheckpoint(
    `${JSON.stringify({
      type: "result",
      result: { domain: "example.com" },
    })}\n{"type":"res`,
  );
  assert.deepEqual([...checkpoint.completedDomains], ["example.com"]);
  assert.equal(checkpoint.trailingPartial, true);

  assert.throws(
    () => parseNdjsonCheckpoint('{"broken"\n{"type":"summary"}\n'),
    /line 1/,
  );
});
