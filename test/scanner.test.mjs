import test from "node:test";
import assert from "node:assert/strict";
import {
  collapseWildcardLikeCnames,
  followCnameChain,
  resolveWithRetry,
  resolveSpfGraph,
  scanDomainEvents,
  scanDomains,
} from "../src/scanner.mjs";

test("collapses wildcard-like CNAME answers into one observation", () => {
  const cnameResults = Array.from({ length: 30 }, (_, index) => ({
    hostname: `label-${index}.example.com`,
    value: ["shared.example.net"],
    error: null,
  }));
  cnameResults.push({
    hostname: "hello.example.com",
    value: ["tenant.outrch.com"],
    error: null,
  });

  const result = collapseWildcardLikeCnames(cnameResults, 40);

  assert.deepEqual(result.wildcardLikeTargets, [
    {
      target: "shared.example.net",
      matchingCandidateLabels: 30,
    },
  ]);
  assert.equal(result.evidenceObservations.length, 2);
  assert.equal(result.observationsCollapsed, 29);
  assert.equal(
    result.evidenceObservations.find(
      (item) => item.target === "shared.example.net",
    ).wildcardLike,
    true,
  );
});

test("collapses wildcard-like answers in the ten-label scan", () => {
  const cnameResults = Array.from({ length: 10 }, (_, index) => ({
    hostname: `label-${index}.example.com`,
    value: index < 7 ? ["shared.example.net"] : [],
    error: null,
  }));
  const result = collapseWildcardLikeCnames(cnameResults, 10);
  assert.equal(result.wildcardLikeTargets.length, 1);
  assert.equal(result.observationsCollapsed, 6);
});

test("enforces the domain concurrency ceiling through the library API", async () => {
  await assert.rejects(
    scanDomains([], { concurrency: 13 }),
    /concurrency must be an integer between 1 and 12/,
  );
});

test("rejects invalid scan modes before starting DNS work", async () => {
  await assert.rejects(
    scanDomains([], { mode: "turbo" }),
    /mode must be fast, balanced, or full/,
  );
});

test("enforces global DNS safety ceilings through the library API", async () => {
  await assert.rejects(
    scanDomains([], { maxInflightDns: 129 }),
    /maxInflightDns must be an integer between 1 and 128/,
  );
  await assert.rejects(
    scanDomains([], { qps: 501 }),
    /qps must be an integer between 1 and 500/,
  );
});

test("retries transient resolver failures but not absent records", async () => {
  let transientAttempts = 0;
  const recovered = await resolveWithRetry(
    async () => {
      transientAttempts += 1;
      if (transientAttempts === 1) {
        throw Object.assign(new Error("timeout"), { code: "ETIMEOUT" });
      }
      return ["ok"];
    },
    { retries: 1 },
  );
  assert.deepEqual(recovered.value, ["ok"]);
  assert.equal(recovered.attempts, 2);
  assert.equal(recovered.retryAttempts, 1);

  let absentAttempts = 0;
  const absent = await resolveWithRetry(
    async () => {
      absentAttempts += 1;
      throw Object.assign(new Error("not found"), { code: "ENOTFOUND" });
    },
    { retries: 2 },
  );
  assert.equal(absentAttempts, 1);
  assert.equal(absent.error, null);
});

test("streams metadata and a final summary without buffering results", async () => {
  const events = [];
  for await (const event of scanDomainEvents([])) events.push(event);
  assert.deepEqual(
    events.map((event) => event.type),
    ["meta", "summary"],
  );
  assert.equal(events[0].schemaVersion, "1.2");
  assert.equal(events[1].summary.scanned, 0);
});

test("recursively resolves SPF includes and redirects within a hard limit", async () => {
  const records = new Map([
    ["a.example.net", [["v=spf1 include:spf.sendinblue.com redirect=b.example.net"]]],
    ["spf.sendinblue.com", [["v=spf1 -all"]]],
    ["b.example.net", [["v=spf1 include:_spf.mlsend.com -all"]]],
    ["_spf.mlsend.com", [["v=spf1 -all"]]],
  ]);
  const result = await resolveSpfGraph(
    [["v=spf1 include:a.example.net -all"]],
    async (host) => ({ value: records.get(host) ?? [], error: null }),
    { maxLookups: 10 },
  );
  assert.deepEqual(result.authorizedSenders.sort(), ["Brevo", "MailerLite"]);
  assert.equal(result.lookupCount, 4);
  assert.equal(result.truncated, false);
});

test("follows short CNAME chains and stops on loops", async () => {
  const targets = new Map([
    ["proxy.example.net", ["tenant.outrch.com"]],
    ["tenant.outrch.com", ["proxy.example.net"]],
  ]);
  const paths = await followCnameChain(
    "go.example.com",
    ["proxy.example.net"],
    async (host) => ({ value: targets.get(host) ?? [], error: null }),
  );
  assert.deepEqual(paths, [
    ["go.example.com", "proxy.example.net", "tenant.outrch.com"],
  ]);
});
