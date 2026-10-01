# vendorprint

vendorprint builds an evidence-backed vendor fingerprint from public DNS. It is a
Node.js CLI that checks for:

- the inbound email provider or security gateway;
- recursive SPF, DMARC, and conventional plus evidence-guided DKIM selectors;
- self-identifying TXT ownership proofs for SaaS products;
- authorized third-party email senders and DMARC monitoring vendors;
- short CNAME chains and delegated sending subdomains attributable to GTM vendors;
- evidence-ranked profiles across sales engagement, CRM, marketing automation,
  customer data, analytics, support, education, events, payments, and delivery.

## Demo and documentation

The product site includes an interactive sample replay and complete CLI
documentation. The replay does not make browser-side DNS or website requests.

- [Interactive demo](https://vendorprint.vercel.app)
- [Documentation](https://vendorprint.vercel.app/docs)

## Why the result is a signal, not a verdict

The useful sales-engagement clue is a custom tracking subdomain whose CNAME target
identifies a vendor. SPF and DKIM generally describe the connected mailbox provider,
not the sequencing product. A positive CNAME is strong setup evidence, but it can be
stale. A negative result is inconclusive because DNS cannot list arbitrary subdomains,
the customer chooses the label, a proxy can hide the CNAME, or branded tracking can
be disabled.

## Run instantly

Node.js 20 or newer is the only requirement. Run a scan without installing a
global command:

```bash
npx vendorprint@latest example.com
```

To keep the `vendorprint` command available globally:

```bash
npm install --global vendorprint
vendorprint --help
```

To use the library API from a Node.js project:

```bash
npm install vendorprint
```

## Run

```bash
npm test
vendorprint example.com another.example
vendorprint example.com --full --pretty
vendorprint --input accounts.txt --output findings.json
vendorprint --input accounts.txt --format ndjson \
  --output findings.ndjson
vendorprint signatures --pretty
vendorprint signatures audit findings.ndjson --pretty
vendorprint diff prior.json current.json --pretty
```

The default output is a result-first JSON report: observed email and technology
providers, confidence, relationship level, evidence, and caveats. It omits the
candidate labels searched, raw DNS answers, query budgets, and empty technology
categories. Use `--full` when you need that forensic scan detail.

This output choice is separate from scan depth. `--mode full` is still the
accuracy-first scan default; `balanced` and `fast` remain explicit opt-ins for
cases where reduced coverage is acceptable.

Input files may be comma-, space-, or newline-separated. To use a commented file:

```bash
rg -v '^\s*(#|$)' examples/accounts.txt |
  vendorprint --stdin > findings.json
```

If you know a company's naming convention, add candidate labels:

```bash
vendorprint sample.example \
  --labels news,updates,teamname,brandname
```

The output is formatted JSON on stdout unless `--output` is supplied. Diagnostics
and CLI errors go to stderr, so redirecting stdout is safe. `--pretty` remains
accepted for backwards compatibility and for the offline utility commands.

For large jobs, use NDJSON. Each completed domain is appended immediately, which
keeps memory bounded and creates a durable checkpoint:

```bash
vendorprint --input accounts.txt --format ndjson --output findings.ndjson

# If the process is interrupted, rerun with the same original input:
vendorprint --input accounts.txt --resume findings.ndjson
```

Resume reads both full and compact result events, skips normalized domains already
present, tolerates a final partially written line, and appends the remaining results.
New output files are created without overwriting an existing file.

The default discovery view returns only non-empty arrays under
`technologyProfile`, including
`aiWorkspaces`, `crm`, `salesEngagement`, `marketingAutomation`,
`advertisingAndAbm`, `customerData`, `productAnalytics`, `customerSupport`,
`customerSuccessAndEducation`, `eventsAndWebinars`, `meetingIntelligence`,
`commerceAndPayments`, `emailDelivery`, and `businessSoftware`. The profile also
separates `websiteAndContent`, `brandAndCreative`, `identityAndAccess`,
`securityAndCompliance`, and `itServiceManagement`.
`--findings-only` remains as a backwards-compatible alias for this default.
`--full` additionally includes the inference graph, deterministic technology
fingerprint, raw DNS records, and scan diagnostics.

Each technology result retains the evidence, strongest confidence, product scope,
relationship level, and a caveat. The relationship levels are:
`domain_relationship` for ownership TXT records, `sending_authorization` for SPF,
and `platform_configuration` for attributable CNAMEs. For example, an OpenAI
ownership TXT record is useful evidence of an OpenAI domain relationship, but it
does not by itself prove ChatGPT Enterprise. Likewise, a Salesforce-hosted custom
domain proves Salesforce platform use without proving that Sales Cloud seats are
active. Salesforce Marketing Cloud Engagement configuration also produces a
medium-confidence Salesforce CRM inference, explicitly labeled `inferred`, because
it proves a Salesforce customer relationship without directly proving Sales Cloud.

The inference graph never silently converts compatibility into an observed product.
For example, Marketo produces a CRM candidate set containing Salesforce, Microsoft
Dynamics 365, Veeva, and other/no native CRM. Independent CRM DNS evidence marks a
candidate as `corroborated` and raises the candidate-set confidence, but the other
possibilities remain because co-presence does not prove an enabled integration.

## Library API

The scanner can be imported without invoking the CLI:

```js
import { scanDomains } from "vendorprint";

const report = await scanDomains(["example.com"], {
  concurrency: 4,
  maxInflightDns: 32,
  qps: 100,
  // dnsTransport: "https", // opt in to Google DNS-over-HTTPS
});
```

`scanDomainEvents()` exposes the same scanner as an async iterator for
completion-order streaming:

```js
import { scanDomainEvents } from "vendorprint";

for await (const event of scanDomainEvents(domains)) {
  // meta, then one result per completed domain, then summary
  process.stdout.write(`${JSON.stringify(event)}\n`);
}
```

## Signature catalog and offline maintenance

Signatures live in a versioned registry, and each scan identifies the catalog
version it used:

```bash
vendorprint signatures --pretty
```

Audit an existing full JSON or NDJSON scan without making network requests. The
audit emits aggregate unmatched TXT prefixes and CNAME, SPF, DKIM, and delegated-NS
targets. It never emits account domains or verification tokens:

```bash
vendorprint signatures audit findings.ndjson --pretty
```

Compare two JSON reports to identify category/provider additions and removals:

```bash
vendorprint diff before.json after.json --pretty
```

## Optional certificate transparency discovery

`--ct` asks a third-party public certificate-transparency index for direct
subdomains, then validates the resulting labels with DNS. It is disabled by
default, limited to 100 domains per run, waits at least 500ms between index
requests, and never contacts company web endpoints.

```bash
vendorprint --input accounts.txt --ct \
  --ct-cache .vendorprint-ct-cache.json \
  --output findings.json
```

Use a cache and small batches. Certificate data can be stale, and a certificate
name alone never becomes a technology finding without live DNS corroboration.

## Coverage and operational notes

- Full mode tries common tracking, help, community, education, and hosted-content
  labels, plus adaptive SPF, CNAME, DKIM, and delegated-NS checks. It is the default.
- `--mode fast` uses the 10 highest-yield labels and omits DKIM: about 14 queries
  per domain.
- `--mode balanced` uses 23 labels and omits DKIM: about 27 queries per domain.
- URLs and hostnames are normalized to their registrable company domain using the
  Public Suffix List. Use `--preserve-hostname` only when a specific delegated
  hostname should be scanned.
- TXT verification records are often self-identifying (`openai-domain-verification`,
  `slack-domain-verification`, and similar). Their tokens are intentionally redacted.
  A live record proves that the domain was configured with that service, not that
  seats are paid, assigned, or recently active.
- Generic verification-looking TXT records are excluded from named vendor evidence.
  `--include-unclassified` exposes them in a separate diagnostic array.
- `--concurrency 4` controls how many account domains run at once.
- `--timeout 1800` controls the resolver attempt timeout.
- DNS uses the system's configured recursive resolver by default. Use
  `--dns-transport https` (or `dnsTransport: "https"` in the library) when
  native DNS is unavailable. This sends queried names to Google's public
  DNS-over-HTTPS service at `https://dns.google/resolve`. It honors
  `HTTPS_PROXY`/`https_proxy` and `NO_PROXY`/`no_proxy`; proxy credentials in
  the URL are supported. A failed HTTPS lookup is reported as a query error,
  with no silent fallback to the system resolver. Query caps, concurrency,
  retries, and `--timeout` still apply. The proxy and DoH service must be
  reachable; enabling HTTPS does not guarantee network access.
- The default domain concurrency is four and the CLI rejects values above 12.
- Each domain has a hard budget of 80 DNS attempts, no more than four logical
  queries in flight, and at least 25ms between per-domain query starts. A global
  default ceiling of 32 in-flight attempts and 100 starts per second protects the
  configured recursive resolver across concurrent domains.
- Only MX, apex TXT, DMARC, and nameserver lookups receive one retry after a
  non-absence resolver failure. The retry reserve is included in the 80-attempt
  budget. Extra candidate labels are safely skipped when the budget is exhausted
  and reported in `querySafety`.
- Recursive SPF follows `include` and `redirect` terms with a maximum of ten
  recursive lookups.
- Positive CNAME answers can be followed for up to three hops. Delegated sending
  subdomains and evidence-guided DKIM selectors are checked only in full mode and
  remain inside the same hard budget.
- A deterministic nonexistent-label preflight identifies wildcard DNS. Wildcard
  records can create irrelevant answers, but a vendor is emitted only
  when the CNAME target matches a supported vendor domain.
- Wildcard-like CNAME answers are collapsed to one observation and reported in
  `cnameDiagnostics`, preventing dozens of guessed labels from inflating evidence.
- Cloudflare-proxied records often expose only A/AAAA records and therefore hide the
  upstream CNAME.
- vendorprint performs DNS lookups only; it does not request company websites,
  tracking endpoints, login pages, or application APIs.
- See [Responsible use](RESPONSIBLE_USE.md) before scanning at scale.

## Sources behind the confidence model

- Outreach documents branded tracking URLs as CNAMEs and says Outreach itself does
  not require vendor-specific SPF/DKIM configuration.
- [Apollo documents custom tracking CNAMEs](https://knowledge.apollo.io/hc/en-us/articles/4415240542733-Set-Up-a-Custom-Tracking-Subdomain)
  and explicitly says its messages are sent through the connected email provider.
  The observed `aplolinks.com` fingerprint is
  deliberately medium-confidence because Apollo's public setup documentation does
  not name that generated target.
- Gong documents Engage branded URL CNAMEs whose unbranded target is under
  `email-composer-webhooks.gong.io`.
- Salesloft supports custom tracking domains; its attributable target used by the
  detector is `custom-tracking.salesloft.com`.
- [HubSpot documents reverse-proxy targets under `hscoscdn.net`](https://developers.hubspot.com/docs/cms/best-practices/testing-staging-performance/reverse-proxies/setup),
  [Salesforce documents Marketing Cloud targets under `sfmc-content.com`](https://help.salesforce.com/s/articleView?id=000363183&language=en_US&type=1),
  and [SparkPost documents branded sending-domain CNAME configuration](https://developers.sparkpost.com/api/sending-domains/).
  These signals are classified by their narrowest defensible product scope.
- [Adobe documents native Marketo connectors for Salesforce, Microsoft Dynamics,
  and Veeva](https://experienceleague.adobe.com/en/docs/experiences-by-you/implementing-new-instance/syncing-fields-for-crm-integration),
  while [its developer documentation also describes operation without a native
  CRM](https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/getting-started).
- [Microsoft documents Dataverse as a required Power Pages component](https://learn.microsoft.com/en-us/power-pages/admin/connectivity).
  Power Pages therefore infers Dataverse directly while keeping Dynamics 365 as an
  unconfirmed candidate.
