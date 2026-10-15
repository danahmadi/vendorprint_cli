import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractDomainVerifications } from "../src/signals.mjs";
import { buildTechnologyProfile } from "../src/profile.mjs";
const { candidates } = JSON.parse(
  await readFile(
    new URL(
      "../docs/research/publicwww-upgrade/candidates.json",
      import.meta.url,
    ),
  ),
);
const { rows } = JSON.parse(
  await readFile(
    new URL(
      "../docs/research/publicwww-upgrade/validation.json",
      import.meta.url,
    ),
  ),
);

test("validated research signatures require exact nonempty keys and redact token values", () => {
  for (const c of candidates) {
    assert.ok(
      rows.filter((r) => r.prefix === c.prefix && r.present).length >= 3,
    );
    const findings = extractDomainVerifications([
      [c.prefix.toUpperCase() + " = ", "secret-fixture-token"],
    ]);
    assert.equal(findings[0]?.provider, c.provider);
    for (const bad of [
      c.prefix + "=",
      c.prefix + "=  ",
      "not-" + c.prefix + "=x",
      c.prefix + "-other=x",
      "text " + c.prefix + "=x",
    ])
      assert.equal(extractDomainVerifications([[bad]]).length, 0, bad);
    const profile = buildTechnologyProfile({
      domainVerifications: findings,
      authorizedEmailSenders: [],
      cnameServices: [],
    });
    const entry = profile.businessSoftware.find(
      (x) => x.provider === c.provider,
    );
    assert.equal(entry.relationshipLevel, "domain_relationship");
    assert.equal(entry.confidence, "medium");
    assert.equal(entry.productScope, c.productScope);
    assert.ok(entry.evidence[0].sources.some((s) => s.url === c.url));
    assert.doesNotMatch(JSON.stringify(profile), /secret-fixture-token/);
  }
});

test("unvalidated candidates and ABM names remain unattributed", () => {
  for (const key of [
    "wiz-domain-verification",
    "perplexity-ai-domain-verification",
    "wrike-verification",
    "6sense-domain-verification",
    "demandbase-verification",
  ])
    assert.deepEqual(extractDomainVerifications([[key + "=token"]]), []);
});
