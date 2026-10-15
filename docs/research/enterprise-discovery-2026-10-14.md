# Enterprise-facing software DNS discovery — October 14, 2026

## Result

Scanned **1,000 distinct company domains**, producing **77,986 DNS queries**. Added **11 documented signature rules**: eight TXT markers, two CNAME families, and one SPF target. This introduces **nine vendor identities** to the catalog and expands existing Atlassian Statuspage detection. At least one added rule matched **605 domains**; this is not 605 newly identified customers, because existing signatures may already have identified some vendors.

The run uses native DNS only. No customer website, browser, cookie banner, JavaScript container, mailbox, or authenticated account was accessed. Public websites were read separately to source the cohort and verify vendor documentation.

## Cohort and limits

- Source: [SaaS Mag SaaS 1000, 2021 edition](https://www.saasmag.com/saas-1000-2021/), retrieved October 14, 2026 through its public directory pagination endpoint. The endpoint returned 1,804 entries.
- Normalize to company domains, reject invalid public suffixes, deduplicate domains, and remove obvious consumer-only services, open-source projects, consulting/services, and other out-of-scope entries. Rank by historical source headcount and take 1,000; the smallest selected source headcount is 49.
- **This is an established business-software / SaaS seed cohort, not 1,000 independently verified current enterprise SaaS companies.** The source is historical, includes acquired brands and software/infrastructure businesses, and its headcounts have not been revalidated. Distinct domains are not necessarily independent corporate parents.
- Freeze an 800-domain discovery / 200-domain holdout split by SHA-256 domain order before scanning. Candidate rules were frozen before examining any holdout patterns. Company-parent overlap and the nonrandom seed list limit generalization.
- All 1,000 scheduled domains completed the scan. Five returned no apex nameservers or MX: `artesian.co`, `leanplum.me`, `retreavor.com`, `pageup.com`, and `triblio.com`. They remain in the denominator; no silent substitutions.

The [cohort manifest](enterprise-discovery/cohort.json) retains company names, source URLs, historical headcounts, splits, and exclusion reasons. [Source checksums](enterprise-discovery/source-checksums.json) identify the local directory snapshots.

## Promoted rules

| Vendor / signal | Discovery / 800 | Holdout / 200 | Total / 1,000 | Documentation |
|---|---:|---:|---:|---|
| Docusign — `docusign` (verification) | 250 | 69 | 319 | [Vendor source](https://support.docusign.com/s/document-item?bundleId=rrf1583359212854&language=fr&topicId=gso1583359141256.html) |
| Twilio — `twilio-domain-verification` (verification) | 60 | 21 | 81 | [Vendor source](https://www.twilio.com/docs/iam/organizations/domains) |
| Cloudflare Dashboard SSO — `cloudflare_dashboard_sso` (verification) | 38 | 6 | 44 | [Vendor source](https://developers.cloudflare.com/fundamentals/manage-members/dashboard-sso/) |
| Lovable — `lovable_verification` (verification) | 31 | 4 | 35 | [Vendor source](https://docs.lovable.dev/features/verified-domains) |
| PandaDoc — `pandadoc-domain-verification` (verification) | 7 | 0 | 7 | [Vendor source](https://support.pandadoc.com/en/articles/9715050-sso-implementation) |
| Remote — `remote-domain-verification` (verification) | 13 | 4 | 17 | [Vendor source](https://support.remote.com/hc/en-us/articles/31443994643725-SSO-Domain-Validation) |
| Sage Intacct — `intacct-esk` (verification) | 36 | 7 | 43 | [Vendor source](https://www-p50491.intacct.com/ia/docs/en_US/help_action/Company/Company_setup/Company_Information/company-information.htm) |
| Snowflake — `snowflake-verification` (verification) | 4 | 0 | 4 | [Vendor source](https://docs.snowflake.com/en/user-guide/admin-domain-verification) |
| Atlassian Statuspage — `stspg-customer.com` (cname) | 274 | 81 | 355 | [Vendor source](https://support.atlassian.com/statuspage/docs/configure-your-dns) |
| Auth0 — `edge.tenants.auth0.com` (cname) | 11 | 0 | 11 | [Vendor source](https://auth0.com/blog/custom-domains-complete-guide/) |
| Atlassian Statuspage — `stspg-customer.com` (spf) | 92 | 22 | 114 | [Vendor source](https://support.atlassian.com/statuspage/docs/configure-your-dns) |

TXT matches require the exact prefix and a nonempty value. They identify a published vendor-specific domain record, not completed verification, enabled SSO, current seats, edition, spend, or activity. Sage Intacct’s `intacct-esk` specifically concerns email sender setup. Snowflake’s marker concerns organization email-domain verification, not a measured warehouse workload. Twilio currently documents `_twilio` as the TXT owner name; these observations were at the apex, so they do not establish correct placement or completed Twilio verification.

Auth0 is restricted to `edge.tenants.auth0.com`, not all `auth0.com` names. Statuspage CNAME detection is restricted to `stspg-customer.com`; SPF identifies notification sending authorization. Generic Mailgun/SendGrid records do not imply Statuspage.

**Snowflake, PandaDoc, and Auth0 had no holdout matches.** They are supported by official exact-pattern documentation and independent-resolver checks on discovery observations, but this run provides no separate holdout corroboration for them. None of the counts estimates precision, recall, paid-customer prevalence, or active use.

Snowflake observations: `docusign.com`, `druva.com`, `uplandsoftware.com`, and `yext.com`.

## Independent checks

Selected up to three distinct discovery domains per proposed rule. Google DNS-over-HTTPS confirmed 31 of 32 initial observations. The remaining Statuspage lookup for `status.accela.com` returned `status.springbrooksoftware.com`; one recorded follow-up resolved that hostname to the same Statuspage target. Thus 32 sampled observations were corroborated using 33 independent DNS queries. Snowflake had two selected checks at the time of selection. TXT values were tested only in memory, never persisted. [Checks](enterprise-discovery/confirmations.json).

## Remaining research queue

| Unmatched pattern | Distinct domains | Disposition |
|---|---:|---|
| `asv` | 118 | Ambiguous short key; do not guess a vendor. |
| `ms` | 157 | Existing Microsoft coverage/format lead; unmatched does not necessarily mean a new vendor. |
| `smartsheet-site-validation` | 92 | Strong named lead; exact current syntax needs stronger primary documentation. |
| `wiz-domain-verification` | 69 | Strong named security lead; not promoted without exact primary documentation. |
| `wrike-verification` | 34 | Named lead; domain-verification mechanism documented but exact marker not confirmed. |
| `elevenlabs` | 30 | Vendor documents TXT verification, but exact marker remains unconfirmed in public docs. |
| `clay-domain-verification` | 1 | Only one domain and variable suffix; keep exploratory. |
| `mktossl.com` | 151 | High-priority Marketo alias coverage lead; primary target documentation/controlled-chain validation still needed. |
| `insided.com` | 51 | Community-platform lead; exact hosted-product scope still needs validation. |
| `cloudfront.net` | 237 | Shared infrastructure; no downstream SaaS attribution. |
| `mail.microsoft` | 22 | Potential Microsoft DKIM coverage update, not a new SaaS vendor. |
| `msv1.invalid` | 6 | Non-routable verification-style target; not a mail provider. |

The complete before/after audits are saved for [discovery](enterprise-discovery/audit-discovery-before.json), [holdout](enterprise-discovery/audit-holdout-before.json), and [all domains after promotion](enterprise-discovery/audit-all-after.json). No additional rules were selected from holdout-only patterns.

## Query coverage and errors

- Full scan mode: apex MX/TXT/NS, DMARC, four conventional DKIM selectors (TXT and CNAME), delegated nameservers, 47 CNAME labels plus wildcard control, bounded recursive SPF and CNAME chains, and up to two SPF-guided DKIM selectors.
- Up to 80 attempts per domain, 12 domains concurrently, 32 global DNS attempts in flight, and a maximum 150 starts/second. Four critical record types may retry once.
- **572 domains exhausted the query budget.** Therefore deeper SPF/CNAME/DKIM coverage is incomplete. This scan cannot establish absence of any vendor.
- Non-absence error codes appeared on these domain counts (overlapping): `EBADNAME` 72, `BUDGET_EXHAUSTED` 426, `ESERVFAIL` 25, `ETIMEOUT` 3. The budget flag also captures exhausted follow-up paths that do not populate the main error list. SPF macro names can produce `EBADNAME`; this is not proof that those domains have invalid DNS.
- No arbitrary DKIM-selector enumeration, MX/TXT expansion across every mail subdomain, passive CT, or browser probing.
- UTC timestamps fall on October 15; the local research date is October 14 in America/Los_Angeles.

## Package changes and validation

- Offline audit schema 1.1 counts distinct scanned registrable domains (including private-suffix tenants), deduplicates repeated reports, adds unknown MX, and inspects observed nested SPF references.
- `--include-unclassified` now retains broader redacted TXT keys. It removes customer-domain suffixes and groups some variable verification-key suffixes for investigation. This normalization never assigns a vendor.
- Audit host targets are grouped by registrable domain; first-party targets, tenant labels, and TXT values are omitted. Compact output cannot support a complete audit; use `--full --include-unclassified`.
- Preserve primary source links and narrow product scopes in generic CNAME evidence.
- 74 tests pass on Node 20, 22, and 24. Syntax checks pass. A packed npm installation was exercised against live DNS; research files and tests are excluded from the tarball.
- Prepared in v0.4.0 / PR #8. Not merged or published. GitHub Actions are disabled on this repository, so local tests are not a GitHub CI result.

## Reproduction and artifacts

Freeze `cohort.json` and `candidates.json` before using a holdout; their hashes are in `frozen.sha256`. `build-cohort.mjs` builds the manifest from the two directory JSON snapshots, and `source-checksums.json` records their hashes. The public directory endpoint is `https://www.saasmag.com/wp-admin/admin-ajax.php?action=companydatatable_action&year=2021`; snapshots used POST form fields `draw=1/2`, `start=0/1000`, `length=1000`, `order[0][column]=8`, `order[0][dir]=desc`, and empty `search[value]`. Source data can change on refetch.

```sh
node bin/vendorprint.mjs --input docs/research/enterprise-discovery/domains.txt \
  --full --include-unclassified --format ndjson --concurrency 12 --qps 150 \
  --output /path/to/findings.ndjson
node bin/vendorprint.mjs signatures audit /path/to/findings.ndjson --pretty
node docs/research/enterprise-discovery/confirm.mjs /path/to/findings.ndjson
```

`summarize.mjs /path/to/research-run` requires the completed `findings.ndjson` and a `baseline/src` directory containing the current audit/signals modules and the signature registry from baseline commit `9ca8ce4253646fb653571b4655d282b99e924133`, with `tldts` available through `baseline/node_modules`. This compares the same upgraded auditing logic against old and new signature catalogs.

The baseline scan loaded the old catalog plus the new TXT-key diagnostic collector. It was not rerun after adding signatures; candidate matches are replayed from redacted keys and observed host targets, with independent live checks of actual TXT syntax. The raw scan SHA-256, counters, per-rule observations, and split membership are in [results.json](enterprise-discovery/results.json). Full local forensic output remains outside the Git repository.
