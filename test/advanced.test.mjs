import test from "node:test";
import assert from "node:assert/strict";
import {
  auditScanDocuments,
  diffTechnologyReports,
  extractCertificateHosts,
  fingerprintTechnologyProfile,
  publicSignatureCatalog,
} from "../src/index.mjs";

test("publishes a serializable versioned signature catalog", () => {
  const catalog = publicSignatureCatalog();
  assert.match(catalog.catalogVersion, /^\d{4}\.\d{2}\.\d{2}$/);
  assert.ok(catalog.cname.length > 30);
  assert.equal(typeof catalog.verification[0].pattern, "string");
  assert.doesNotThrow(() => JSON.stringify(catalog));
});

test("filters CT data to bounded direct subdomains", () => {
  const hosts = extractCertificateHosts(
    [
      { name_value: "*.go.example.com\nexample.com" },
      { name_value: "deep.docs.example.com\nhelp.example.com" },
      { name_value: "other.test" },
    ],
    "example.com",
    { maxHosts: 2 },
  );
  assert.deepEqual(hosts, ["go.example.com", "help.example.com"]);
});

test("offline signature audit emits aggregates without account domains", () => {
  const report = auditScanDocuments([
    {
      results: [
        {
          domain: "secret-account.example",
          technologySignals: {
            unclassifiedDomainVerifications: [
              { recordPrefix: "new-vendor-verification" },
            ],
          },
          salesEngagement: {
            observedCnames: [
              {
                hostname: "go.secret-account.example",
                targets: ["tenant.unknown-vendor.test"],
              },
            ],
          },
          mail: { spf: { includes: ["spf.unknown-vendor.test"] } },
        },
      ],
    },
  ]);
  assert.equal(report.domainsAudited, 1);
  assert.equal(report.candidates.txtRecordPrefixes[0].count, 1);
  assert.doesNotMatch(JSON.stringify(report), /secret-account/);
});

test("fingerprints are stable and report diffs are category-aware", () => {
  const beforeProfile = {
    crm: [{ provider: "Salesforce", confidence: "high" }],
  };
  const afterProfile = {
    crm: [{ provider: "Salesforce", confidence: "high" }],
    salesEngagement: [{ provider: "Outreach", confidence: "high" }],
  };
  assert.equal(
    fingerprintTechnologyProfile(beforeProfile),
    fingerprintTechnologyProfile({ crm: [...beforeProfile.crm] }),
  );
  const diff = diffTechnologyReports(
    { results: [{ domain: "example.com", technologyProfile: beforeProfile }] },
    { results: [{ domain: "example.com", technologyProfile: afterProfile }] },
  );
  assert.equal(diff.summary.changedDomains, 1);
  assert.deepEqual(diff.changes[0].added, ["salesEngagement:Outreach:"]);
});
