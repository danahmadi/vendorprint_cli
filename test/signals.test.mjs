import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyMx,
  classifyDnsProvider,
  dedupeVendorSignals,
  detectCnameTechnology,
  detectSalesVendor,
  extractDomainVerifications,
  parseDmarc,
  parseSpf,
} from "../src/signals.mjs";

test("classifies Google Workspace MX", () => {
  assert.deepEqual(
    classifyMx([{ exchange: "aspmx.l.google.com.", priority: 1 }]),
    { provider: "Google Workspace", confidence: "high", gateways: [] },
  );
});

test("keeps security gateways distinct from mailbox providers", () => {
  assert.deepEqual(
    classifyMx([{ exchange: "us-smtp-inbound-1.mimecast.com", priority: 10 }]),
    {
      provider: "Unknown behind email security gateway",
      confidence: "low",
      gateways: ["Mimecast"],
    },
  );
});

test("detects each supported sales vendor from a CNAME target", () => {
  const examples = [
    ["hello.example.com", "tenant-id.outrch.com", "Outreach"],
    ["track.example.com", "custom.apollomail.io", "Apollo"],
    ["links.example.com", "custom-tracking.salesloft.com", "Salesloft"],
    [
      "email.example.com",
      "us-6653.email-composer-webhooks.gong.io",
      "Gong Engage",
    ],
  ];
  for (const [hostname, target, provider] of examples) {
    assert.equal(detectSalesVendor(hostname, target)?.provider, provider);
  }
});

test("marks the observed Apollo aplolinks target as medium-confidence", () => {
  const signal = detectSalesVendor(
    "click.example.com",
    "tenant.aplolinks.com",
  );
  assert.equal(signal?.provider, "Apollo");
  assert.equal(signal?.confidence, "medium");
});

test("does not infer a vendor from a suggestive hostname alone", () => {
  assert.equal(detectSalesVendor("outreach.example.com", "proxy.example.net"), null);
});

test("classifies repeated marketing and email CNAME services", () => {
  assert.equal(
    detectCnameTechnology("info.example.com", "tenant.mktoweb.com")?.provider,
    "Adobe Marketo",
  );
  assert.equal(
    detectCnameTechnology("email.example.com", "u123.wl.sendgrid.net")?.provider,
    "SendGrid",
  );
  assert.equal(
    detectCnameTechnology("marketing.example.com", "a123.actonservice.com")
      ?.provider,
    "Act-On",
  );
  assert.equal(
    detectCnameTechnology("links.example.com", "links.iterable.com")?.provider,
    "Iterable",
  );
  assert.equal(
    detectCnameTechnology(
      "hello.example.com",
      "tenant.unbouncepages.com",
    )?.provider,
    "Unbounce",
  );
  assert.equal(
    detectCnameTechnology("send.example.com", "1.klaviyodns.com")?.provider,
    "Klaviyo",
  );
  assert.equal(
    detectCnameTechnology(
      "www2.example.com",
      "123.sites-proxy.hscoscdn20.net",
    )?.provider,
    "HubSpot",
  );
  assert.equal(
    detectCnameTechnology(
      "cloud.example.com",
      "tenant.sfmc-content.com",
    )?.provider,
    "Salesforce Marketing Cloud Engagement",
  );
  assert.equal(
    detectCnameTechnology(
      "email.example.com",
      "tenant.sparkpostmail.com",
    )?.provider,
    "SparkPost",
  );
  assert.equal(
    detectCnameTechnology(
      "portal.example.com",
      "tenant.powerappsportals.com",
    )?.provider,
    "Microsoft Power Pages",
  );
});

test("parses SPF and DMARC without treating them as sales-vendor evidence", () => {
  assert.deepEqual(parseSpf([["v=spf1 include:_spf.google.com ", "-all"]]), {
    present: true,
    multipleRecords: false,
    records: ["v=spf1 include:_spf.google.com -all"],
    includes: ["_spf.google.com"],
    redirects: [],
    authorizedSenders: ["Google Workspace"],
  });
  assert.deepEqual(parseDmarc([["v=DMARC1; p=reject; pct=50"]]), {
    present: true,
    policy: "reject",
    percentage: 50,
    reportRecipients: [],
    monitoringServices: [],
    record: "v=DMARC1; p=reject; pct=50",
  });
});

test("extracts known ownership records without returning public tokens", () => {
  const findings = extractDomainVerifications([
      ["google-site-verification=secret-token"],
      ["MS=ms12345678"],
      ["klaviyo-site-verification=public-api-key"],
      ["some-vendor-verification=another-token"],
      ["unrelated=value"],
    ]);
  assert.deepEqual(
    findings.map(({ category, signatureCatalogVersion, ...finding }) => finding),
    [
      {
        provider: "Google",
        purpose: "Google site or domain ownership",
        confidence: "medium",
        recordPrefix: "google-site-verification",
        tokenRedacted: true,
      },
      {
        provider: "Microsoft",
        purpose: "Microsoft domain ownership",
        confidence: "medium",
        recordPrefix: "MS",
        tokenRedacted: true,
      },
      {
        provider: "Klaviyo",
        purpose: "Klaviyo branded sending domain ownership",
        confidence: "medium",
        recordPrefix: "klaviyo-site-verification",
        tokenRedacted: true,
      },
    ],
  );
});

test("returns generic verification-like records only when explicitly requested", () => {
  assert.deepEqual(
    extractDomainVerifications(
      [["some-vendor-verification=another-token"]],
      { includeUnclassified: true },
    ).map(({ signatureCatalogVersion, ...finding }) => finding),
    [
      {
        provider: "Unclassified service",
        purpose: "Domain or site ownership verification",
        confidence: "low",
        recordPrefix: "some-vendor-verification",
        tokenRedacted: true,
      },
    ],
  );
});

test("classifies newly cataloged GTM infrastructure and verification records", () => {
  assert.equal(
    detectCnameTechnology("help.example.com", "tenant.zendesk.com")?.provider,
    "Zendesk",
  );
  assert.equal(
    detectCnameTechnology("academy.example.com", "tenant.skilljarapp.com")
      ?.provider,
    "Skilljar",
  );
  assert.equal(
    detectSalesVendor("dial.example.com", "tenant.nooks.in")?.confidence,
    "medium",
  );
  assert.equal(
    extractDomainVerifications([["segment-site-verification=secret"]])[0]
      .category,
    "customer_data",
  );
});

test("classifies additional SPF senders and redirect terms", () => {
  const result = parseSpf([
    ["v=spf1 include:spf.sendinblue.com redirect=_spf.createsend.com"],
  ]);
  assert.deepEqual(result.redirects, ["_spf.createsend.com"]);
  assert.deepEqual(result.authorizedSenders.sort(), [
    "Brevo",
    "Campaign Monitor",
  ]);
});

test("classifies authoritative DNS hosting", () => {
  assert.deepEqual(classifyDnsProvider(["lana.ns.cloudflare.com."]), [
    "Cloudflare DNS",
  ]);
});

test("deduplicates multiple CNAME signals for one vendor", () => {
  const first = detectSalesVendor("go.example.com", "a.outreach.io");
  const second = detectSalesVendor("links.example.com", "b.outreach.io");
  const result = dedupeVendorSignals([first, second]);
  assert.equal(result.length, 1);
  assert.equal(result[0].evidence.length, 2);
});

test("uses the strongest confidence when deduplicating vendor evidence", () => {
  const result = dedupeVendorSignals([
    detectSalesVendor("click.example.com", "tenant.aplolinks.com"),
    detectSalesVendor("go.example.com", "tenant.apollo.io"),
  ]);
  assert.equal(result[0].confidence, "high");
});
