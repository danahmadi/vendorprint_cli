import test from "node:test";
import assert from "node:assert/strict";
import { Resolver } from "node:dns/promises";
import { scanDomains } from "../src/scanner.mjs";
import { buildTechnologyProfile } from "../src/profile.mjs";
import { fingerprintTechnologyProfile } from "../src/fingerprint.mjs";
import { detectSalesVendor, dedupeVendorSignals, detectCnameTechnology, extractDomainVerifications } from "../src/signals.mjs";

const gongTarget = "us-6653.email-composer-webhooks.gong.io";

test("Fireflies needs a nonempty exact marker, joins TXT chunks, and redacts values", () => {
  const findings = extractDomainVerifications([
    ["fireflies-verifi", "cation=private-fixture-value"],
    ["FIREFLIES-VERIFICATION = second-private-fixture"],
    ["fireflies-verification="],
    ["fireflies-verification=   "],
    ["not-fireflies-verification=other"],
    ["fireflies-verification-unknown=other"],
    ["random text fireflies-verification=other"],
  ]);
  assert.equal(findings.length, 2);
  for (const finding of findings) {
    assert.equal(finding.provider, "Fireflies.ai");
    assert.equal(finding.productScope, "fireflies_domain_verification");
    assert.equal(finding.confidence, "medium");
    assert.ok(finding.sources.some((source) => source.kind === "public_dns_research"));
  }
  assert.doesNotMatch(JSON.stringify(findings), /private-fixture/);
});

test("Gong target boundaries reject generic hosts, spoof suffixes, and suggestive labels", () => {
  assert.equal(detectSalesVendor("email-tracking.example.com", `${gongTarget.toUpperCase()}.`)?.provider, "Gong Engage");
  for (const target of ["gong.io", "app.gong.io", `${gongTarget}.example.net`, "notemail-composer-webhooks.gong.io", "proxy.example.net"]) {
    assert.equal(detectSalesVendor("gong.example.com", target), null);
  }
  assert.notEqual(detectCnameTechnology("granola.example.com", "tenant.workos-dns.com")?.provider, "Granola");
  assert.equal(extractDomainVerifications([["granola-verification=unvalidated-fixture"]]).length, 0);
});

test("Read AI and Reachdesk markers require exact nonempty values and keep narrow scopes", () => {
  for (const [prefix, provider, category, scope] of [
    ["read-ai-verification", "Read AI", "meetingIntelligence", "read_ai_domain_verification"],
    ["reachdesk-verification", "Reachdesk", "advertisingAndAbm", "reachdesk_email_domain_verification"],
  ]) {
    const findings = extractDomainVerifications([
      [`${prefix} = `, "private-test-value"],
      [`not-${prefix}=value`],
      [`${prefix}-other=value`],
      [`${prefix}=`],
      [`${prefix}=  `],
    ]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].provider, provider);
    assert.equal(findings[0].confidence, "medium");
    const profile = buildTechnologyProfile({ domainVerifications: findings, authorizedEmailSenders: [], cnameServices: [] });
    assert.equal(profile[category][0].productScope, scope);
    assert.ok(profile[category][0].evidence[0].sources.length);
    assert.doesNotMatch(JSON.stringify(profile), /private-test-value/);
  }
});

test("profiles preserve narrow scopes and sources without implying recording or completed SSO", () => {
  const signals = { domainVerifications: extractDomainVerifications([["fireflies-verification=private-fixture-value"]]), authorizedEmailSenders: [], cnameServices: [] };
  const profile = buildTechnologyProfile(signals, { salesEngagement: dedupeVendorSignals([detectSalesVendor("email-tracking.example.com", gongTarget)]) });
  assert.deepEqual(profile.meetingIntelligence.map((item) => item.provider), ["Fireflies.ai"]);
  assert.equal(profile.meetingIntelligence[0].productScope, "fireflies_domain_verification");
  assert.match(profile.meetingIntelligence[0].caveat, /does not establish completed verification/);
  assert.match(profile.meetingIntelligence[0].evidence[0].interpretation, /publishes/);
  assert.equal(profile.salesEngagement[0].productScope, "gong_engage_link_tracking");
  assert.match(profile.salesEngagement[0].caveat, /not Gong call recording/);
  assert.ok(profile.salesEngagement[0].evidence[0].sources.length);
  assert.doesNotMatch(JSON.stringify(profile), /private-fixture-value/);
  const updatedSources = structuredClone(profile);
  updatedSources.salesEngagement[0].evidence[0].sources.push({ url: "https://example.com/new-docs" });
  assert.equal(fingerprintTechnologyProfile(profile), fingerprintTechnologyProfile(updatedSources));
});

test("balanced and full scans discover the documented Gong hostname within the DNS budget", async (t) => {
  const queried = [];
  t.mock.method(Resolver.prototype, "resolveMx", async () => []);
  t.mock.method(Resolver.prototype, "resolveTxt", async () => []);
  t.mock.method(Resolver.prototype, "resolveNs", async () => ["ns.example.net"]);
  t.mock.method(Resolver.prototype, "resolveCname", async (name) => {
    queried.push(name);
    return name === "email-tracking.example.com" ? [gongTarget] : [];
  });
  for (const mode of ["balanced", "full"]) {
    const { results: [result] } = await scanDomains(["example.com"], { mode });
    assert.ok(result.salesEngagement.labelsChecked.includes("email-tracking"));
    assert.equal(result.technologyProfile.salesEngagement[0].productScope, "gong_engage_link_tracking");
    assert.ok(result.querySafety.queryAttempts <= 80);
    assert.ok(result.technologyProfile.salesEngagement[0].evidence[0].sources.length);
  }
  assert.ok(queried.includes("email-tracking.example.com"));
});
