# October 2026 DNS coverage baselines

These full-mode scans replace the unrecoverable August Inc. 5000 benchmark with a new Fortune 500 domain cohort and refresh the saved 1,000-company business-software cohort. They measure observable DNS findings, not detection accuracy, active adoption, licenses, seats, or a like-for-like improvement over the old cohort.

| Cohort | Sourced / scanned | Any vendor finding | Direct product configuration | Trust-center hosting |
| --- | ---: | ---: | ---: | ---: |
| Business software | 1,000 / 1,000 | 989 (98.9%) | 821 (82.1%) | 187 (18.7%) |
| Fortune 500 domains | 500 / 499 | 487 (97.4%) | 199 (39.8%) | 10 (2.0%) |

Every sourced domain remains in the denominator, including invalid inputs and limited responses. `atmeta.com` is rejected as a private public-suffix entry by the current normalizer; it remains in the Fortune denominator. No substitute domain was silently introduced.

## Sources and scope

- Software: the saved [SaaS Mag 2021 SaaS 1000](https://www.saasmag.com/saas-1000-2021/) company list, normalized in the prior enterprise discovery research. This is a historical business-software cohort including midmarket vendors, not a freshly verified list of enterprise-only companies. See `enterprise-cohort.json` and `../../research/enterprise-discovery/domains.txt`.
- Fortune: [Installmap's September 2026 CSV](https://installmap.com/static/data/fortune-100-ai-homepage/fortune500.csv), described in its [source documentation](https://installmap.com/static/data/fortune-100-ai-homepage/README.md). **Source: Installmap, September 2026. Data: CC BY 4.0.** Adapted to retain company names and normalized domains only. [License](https://creativecommons.org/licenses/by/4.0/). All 500 source rows were retained regardless of the source's website-crawl success. Its ranking and company/domain mapping are third-party assertions, not independently verified here. No source AI mentions or website-crawl outcomes are used as Vendorprint findings.

The cohort JSON files record source URLs and input provenance. The Fortune manifest includes the original CSV checksum. Both summaries include cohort and raw-scan SHA-256 hashes. Public per-domain results contain coverage flags and diagnostics, not raw TXT verification tokens.

## What the metrics mean

- **Any vendor finding:** a recognized MX/mail-security provider or at least one categorized technology-profile finding. Generic DNS hosting and inference-graph candidates do not count.
- **Direct product configuration:** at least one non-wildcard CNAME or delegated-NS record with a `platform_configuration` relationship in a business-product category. General website hosting, email delivery, and mail productivity are excluded. TXT verification and SPF authorization alone do not count. A configured endpoint may be stale; this is not proof of active use.
- **Trust-center hosting:** non-wildcard Vanta, SafeBase, or Drata trust-center evidence. This does not establish certification or compliance.
- **Category coverage:** includes broader domain relationships and sending authorization. Categories overlap and percentages must not be added.

The catalog was frozen before these scans. This refresh does not constitute a new customer-level precision validation or an independent holdout evaluation of signatures developed from the software cohort.

## Execution and limitations

Scans began October 15, 2026 UTC (October 14 in America/Los_Angeles). Package 0.4.0 source, signature catalog `2026.10.14`, native DNS transport, full mode, certificate-transparency discovery disabled. The `scannerCommit` in each summary identifies the detection baseline `bd3d38f3b1acb48a51b18256d170b0d84d7211ca`; the Fortune run also included output-version metadata changes, with identical detection logic. The software run predates that metadata addition, so its package version is supplied explicitly by the summarizer's provenance.

The default hard cap remained **80 DNS attempts per domain**. Software: 78,981 attempts, 736 domains reached the budget, 600 had a recorded non-absence query error, and 5 had limited DNS status. Fortune: 37,868 attempts, 153 reached the budget, 281 had a non-absence query error, and none of the 499 scanned domains had limited status. Error counts include budget errors and overlap with budget counts; the summaries list error codes separately. A domain can retain valid findings while later queries fail or are skipped. These are bounded default-mode observations, not exhaustive DNS inventories. Unqueried hostnames, resolver failures, stale configuration, wildcard records and proxies limit what can be detected.

Software scan: concurrency 12, QPS 150. Fortune scan: concurrency 6, QPS 75, global in-flight DNS cap 16. Per-domain query safety limits were unchanged. No company website requests were made by Vendorprint.

## Reproduce

From this repository, install dependencies with `npm ci`, then:

```sh
node bin/vendorprint.mjs --input docs/research/enterprise-discovery/domains.txt --full --include-unclassified --format ndjson --concurrency 12 --qps 150 --output enterprise.ndjson
node bin/vendorprint.mjs --input docs/benchmarks/2026-10-14/fortune500-domains.txt --full --include-unclassified --format ndjson --concurrency 6 --qps 75 --max-inflight-dns 16 --output fortune500.ndjson
node scripts/summarize-benchmark.mjs enterprise.ndjson docs/benchmarks/2026-10-14/enterprise-cohort.json enterprise-summary.json YOUR_SCANNER_COMMIT
node scripts/summarize-benchmark.mjs fortune500.ndjson docs/benchmarks/2026-10-14/fortune500-cohort.json fortune500-summary.json YOUR_SCANNER_COMMIT
```

DNS changes over time and query scheduling can change which records fit within the budget, so fresh results need not match these snapshots. Preserve full NDJSON, the input manifest, package/catalog versions and commit when creating a new dated baseline. Raw scan files are retained locally by the operator; committed summaries allow independent recomputation of the published percentages from per-domain flags. The summarizer refuses incomplete scans or mismatched cohorts.
