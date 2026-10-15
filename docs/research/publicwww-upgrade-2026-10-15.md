# PublicWWW follow-up: hostname coverage and verification signatures

Reviewed October 15, 2026 for vendorprint 0.5.0 / catalog 2026.10.15.

The discovery experiment scanned 128 domains: 57 Demandbase candidates, 38 6sense candidates, 15 Unbounce candidates, and 20 unlabeled software-background domains, with two overlapping ABM candidates. PublicWWW snippets are leads, not customer attestations. Allowlist, preload, and commented script references were present. We made no HTTP requests to candidate companies.

Normal v0.4.0 scans found Unbounce on zero of the 15 candidates. Direct DNS queries of PublicWWW-observed hostnames found seven, all matching the existing `unbouncepages.com` signature. The existing `--labels www,try,join,landingpages` option recovered those same seven. `--preserve-hostname` alone previously found zero, because the supplied base hostname's CNAME was never queried. Version 0.5.0 queries the input/base CNAME, retains exact URL hostnames when grouping by registrable domain, prioritizes `www`, and accepts scoped hostname hints. Nested hints receive parent-level wildcard controls, and downstream chains retain wildcard attribution. The 80-attempt cap still includes all these queries.

No attributable 6sense, Demandbase, company-target.com, or Engagio marker was found in the collected DNS evidence. No ABM signature was added. Bounded scans cannot rule out other configurations.

## Promoted verification signatures

| Provider | Exact prefix | Discovery domains | Fresh independent checks |
|---|---|---:|---:|
| Smartsheet | `smartsheet-site-validation` | 28 | 5/5 |
| Dynatrace | `dynatrace-site-verification` | 12 | 5/5 |
| TeamViewer | `teamviewer-sso-verification` | 9 | 5/5 |
| Adobe Acrobat Sign | `adobe-sign-verification` | 8 | 5/5 |

Independent checks used domains from the earlier 1,000-domain software cohort, excluding all 128 discovery domains. This is independent of the discovery sample, not a known-negative/precision study. Fresh TXT queries confirmed all twenty selected prefix/domain pairs. The [redacted observations](publicwww-upgrade/validation.json) retain domain, prefix, timestamp, and presence; verification values are discarded. [Candidate metadata](publicwww-upgrade/candidates.json) and the [validation script](publicwww-upgrade/validate.mjs) document the work. The script requires the locally saved research cohorts, which are not distributed in the npm package.

Evidence basis:

- [Smartsheet](https://help.smartsheet.com/learning-track/system-admin-access-and-authentication/domain-management) documents DNS TXT domain validation. The exact self-identifying prefix is corroborated by the discovery sample and five fresh independent domains; the documentation page does not expose the literal prefix in its text.
- [Dynatrace](https://docs.dynatrace.com/docs/manage/identity-access-management/user-and-group-management/access-saml) documents publishing a TXT record before domain verification for SAML. Exact-prefix attribution combines that workflow with repeated self-identifying DNS records; the page does not expose the literal prefix in its text.
- [TeamViewer](https://www.teamviewer.com/en-us/global/support/knowledge-base/teamviewer-tensor/sso/single-sign-on-for-centrify/) documents TXT ownership checks before SSO activation. Exact-prefix attribution combines that workflow with repeated self-identifying DNS records; the page does not expose the literal prefix in its text.
- [Adobe Acrobat Sign](https://helpx.adobe.com/sign/web/using/claim-domain-names.html) explicitly documents `adobe-sign-verification=` for domain claiming, independently corroborated in DNS.

Rules are anchored, require a nonempty value, reject lookalike keys, and accept split TXT chunks. All are medium-confidence **domain relationships**. They do not prove successful verification, enabled SSO, an active subscription, seats, or usage. Unit tests cover these boundaries and token redaction.

## Held candidates

Wiz (11 discovery domains), Perplexity (5), and Wrike (5) remain unmatched. Public documentation located in this pass did not corroborate their exact verification workflows sufficiently. The unmatched `mktossl.com` and `pardot.com` variants also remain research candidates pending more specific rule validation. Shared infrastructure and generic keys are not promoted based on co-occurrence.

## Completeness

84 of the 128 v0.4.0 scans exhausted the budget while retaining `status: ok`; compact output dropped the budget diagnostics. Version 0.5.0 adds `scanCompleteness` and `observedAt` to both output forms. Completion refers only to the bounded scan plan. Budget-skipped hostnames/follow-ups, DNS errors (including downstream CNAME errors), SPF lookup truncation, chain depth limits, and optional discovery errors are visible independently of finding confidence. The legacy DNS-response `status` remains for compatibility.

The catalog now has 125 provider/product names and 159 registry rules. The website's v0.4.0 benchmark percentages remain explicitly historical; they have not been relabeled as v0.5.0 measurements.
