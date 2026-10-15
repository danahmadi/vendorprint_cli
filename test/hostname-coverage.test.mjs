import test from "node:test";
import assert from "node:assert/strict";
import { Resolver } from "node:dns/promises";
import { scanDomains } from "../src/scanner.mjs";
import { compactReport } from "../src/output.mjs";

function fixture(t, answers = {}) {
  const calls = [];
  for (const [method, type] of [
    ["resolveMx", "MX"],
    ["resolveTxt", "TXT"],
    ["resolveNs", "NS"],
    ["resolveCname", "CNAME"],
  ]) {
    t.mock.method(Resolver.prototype, method, async (hostname) => {
      calls.push({ type, hostname });
      const value = answers[`${type}:${hostname}`];
      if (value instanceof Error) throw value;
      if (value !== undefined) return value;
      if (type === "NS" && hostname === "example.com")
        return ["ns.example.net"];
      throw Object.assign(new Error("Absent"), { code: "ENODATA" });
    });
  }
  return calls;
}
const options = { mode: "fast", qps: 500, criticalRetries: 0 };

test("URL inputs retain exact hostnames while grouping findings under the company domain", async (t) => {
  const calls = fixture(t, {
    "CNAME:try.example.com": ["tenant.unbouncepages.com"],
    "CNAME:www.example.com": ["other.unbouncepages.com"],
  });
  const report = await scanDomains(
    [
      "https://try.example.com/path",
      "example.com",
      "https://try.example.com/another",
    ],
    options,
  );
  assert.equal(report.results.length, 1);
  const row = report.results[0];
  assert.equal(row.domain, "example.com");
  assert.equal(
    calls.filter((q) => q.type === "CNAME" && q.hostname === "try.example.com")
      .length,
    1,
  );
  assert.ok(
    calls.some((q) => q.type === "CNAME" && q.hostname === "example.com"),
  );
  assert.ok(
    calls.some((q) => q.type === "CNAME" && q.hostname === "www.example.com"),
  );
  const finding = row.technologyProfile.marketingAutomation.find(
    (f) => f.provider === "Unbounce",
  );
  assert.ok(finding.evidence.some((e) => e.hostname === "try.example.com"));
  assert.equal(row.scanCompleteness.status, "complete");
  const compact = compactReport(report).findings[0];
  assert.deepEqual(compact.scanCompleteness, row.scanCompleteness);
  assert.ok(compact.observedAt);
});

test("preserve-hostname probes the supplied hostname CNAME itself", async (t) => {
  const calls = fixture(t, {
    "CNAME:try.example.com": ["tenant.unbouncepages.com"],
  });
  const row = (
    await scanDomains(["try.example.com"], {
      ...options,
      preserveHostname: true,
    })
  ).results[0];
  assert.equal(row.domain, "try.example.com");
  assert.ok(
    calls.some((q) => q.hostname === "try.example.com" && q.type === "CNAME"),
  );
  assert.ok(
    row.technologyProfile.marketingAutomation.some(
      (f) => f.provider === "Unbounce",
    ),
  );
});

test("per-company hints are scoped, prioritized, and guarded against nested wildcards", async (t) => {
  const { createHash } = await import("node:crypto");
  const parent = "campaign.example.com";
  const wildcard = `vp-wildcard-${createHash("sha256").update(parent).digest("hex").slice(0, 10)}.${parent}`;
  fixture(t, {
    "CNAME:offer.campaign.example.com": ["alias.example.net"],
    [`CNAME:${wildcard}`]: ["alias.example.net"],
    "CNAME:alias.example.net": ["tenant.unbouncepages.com"],
  });
  const row = (
    await scanDomains(["example.com"], {
      ...options,
      hostnameHintsByDomain: { "example.com": ["offer.campaign.example.com"] },
    })
  ).results[0];
  assert.ok(
    row.dns.additionalWildcardProbes.some((p) => p.hostname === wildcard),
  );
  const evidence = row.technologyProfile.marketingAutomation.find(
    (f) => f.provider === "Unbounce",
  ).evidence;
  assert.ok(evidence.every((e) => e.wildcardLikeCname));
  await assert.rejects(
    scanDomains(["example.com"], {
      ...options,
      hostnameHintsByDomain: { "example.com": ["example.com.attacker.test"] },
    }),
    /must belong/,
  );
  await assert.rejects(
    scanDomains([], { hostnameHintsByDomain: { "example.com": "wrong" } }),
    /arrays/,
  );
});

test("many supplied hostnames cannot exceed the query cap and skipped coverage survives compact output", async (t) => {
  const calls = fixture(t);
  const inputs = Array.from({ length: 100 }, (_, i) => `host${i}.example.com`);
  const report = await scanDomains(inputs, options);
  const row = compactReport(report).findings[0];
  assert.ok(calls.length <= 80);
  assert.equal(row.scanCompleteness.status, "partial");
  assert.ok(row.scanCompleteness.reasons.includes("query_budget"));
  assert.ok(row.scanCompleteness.skippedHostnames > 0);
  assert.equal(row.scanCompleteness.queryAttempts, calls.length);
});

test("errors in downstream CNAME queries are visible even when apex DNS succeeds", async (t) => {
  fixture(t, {
    "CNAME:www.example.com": ["alias.example.net"],
    "CNAME:alias.example.net": Object.assign(new Error("fail"), {
      code: "ESERVFAIL",
    }),
  });
  const row = compactReport(await scanDomains(["example.com"], options))
    .findings[0];
  assert.equal(row.status, "ok");
  assert.equal(row.scanCompleteness.status, "partial");
  assert.deepEqual(row.scanCompleteness.dnsErrors, ["ESERVFAIL"]);
});

test("preserved hostnames also check their parent wildcard before attribution", async (t) => {
  const { createHash } = await import("node:crypto");
  const parent = "example.com";
  const wildcard = `vp-wildcard-${createHash("sha256").update(parent).digest("hex").slice(0, 10)}.${parent}`;
  fixture(t, {
    "CNAME:try.example.com": ["tenant.unbouncepages.com"],
    [`CNAME:${wildcard}`]: ["tenant.unbouncepages.com"],
  });
  const row = (
    await scanDomains(["try.example.com"], {
      ...options,
      preserveHostname: true,
    })
  ).results[0];
  assert.ok(
    row.technologyProfile.marketingAutomation
      .find((f) => f.provider === "Unbounce")
      .evidence.every((e) => e.wildcardLikeCname),
  );
});
