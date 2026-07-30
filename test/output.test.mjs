import test from "node:test";
import assert from "node:assert/strict";
import { parseNdjsonCheckpoint } from "../src/output.mjs";

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
