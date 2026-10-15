# DNS-only trust-center discovery

The supplemental pass found vendor-specific trust-center CNAMEs on **187 of the
1,000 existing cohort domains**: 88 Vanta, 91 SafeBase, and 8 Drata. These describe
published hosting configuration, not certifications, licensed compliance modules,
customer counts, or current activity. Query timestamps are October 15 UTC
(October 14 local time).

| Provider | Accepted target | Domains | Prior discovery / holdout split | Only found outside `trust` |
| --- | --- | ---: | ---: | ---: |
| Vanta | `cname.vantatrust.com` and its subdomains | 88 | 71 / 17 | 8 |
| SafeBase | `portals.safebase.io` and its subdomains | 91 | 72 / 19 | 25 |
| Drata | Exact `trust.cname.drata.com` | 8 | 6 / 2 | 0 |

Thus checking `security` and `trustcenter` found 33 domains the `trust` probe alone
would miss. Examples include Vanta on 8x8, ActivTrak, and Aerospike; SafeBase on
15Five, 6sense, and Accelevents; and Drata on AppointmentPlus, Powtoon, and
RebelMouse. A SafeBase finding on 6sense identifies 6sense's trust-center host;
it is not a way to detect 6sense customers.

## Evidence and attribution

- [Vanta's custom-domain documentation](https://help.vanta.com/en/articles/11345446-creating-your-custom-domain-trust-center)
  describes CNAME setup and links its own `trust.vanta.com` example. Live DNS
  resolved that hostname to `597a25065133f16056a18abf.cname.vantatrust.com`.
  The documentation describes the workflow; the exact suffix is corroborated
  by live DNS, rather than printed in the article text.
- [Drata's own trust center](https://trust.drata.com/) identifies its SafeBase
  hosting. Live DNS returned `drata.portals.safebase.io`. OpenAI's trust hostname
  independently returned `openai.portals.safebase.io`.
- [Drata's display-details documentation](https://help.drata.com/en/articles/8067419-display-details)
  describes the Classic Trust Center's custom URL and distinguishes the newer
  SafeBase experience. Eight cohort domains pointed at the exact vendor-owned
  `trust.cname.drata.com` endpoint. This rule was an exploratory addition after
  examining the full supplemental pass; it has no independent holdout validation.
- Nine sampled observations (three per provider) matched again through Google
  DNS-over-HTTPS. [Confirmation records](trust-centers/confirmations.json) retain
  hostnames, targets, and timestamps. Corroboration establishes repeatable DNS
  observations, not independently labelled ground truth or empirical precision.

## Method and limits

The [existing cohort](enterprise-discovery/cohort.json) is a cleaned historical
business-software list including midmarket and acquired brands, not a freshly
verified enterprise customer census. We queried `trust`, `security`, and
`trustcenter`, following up to three CNAME queries per label, plus one
deterministic wildcard-control query per domain. Eight sequential workers waited
at least 100ms before each query. No company HTTP requests, browser execution,
cookies, certificate-log lookups, or account access were used in the scan.
Official documentation/public provider pages were consulted separately for attribution.

The pass completed all 1,000 domains using 4,609 native DNS queries. There were
19 failed queries across 7 domains: 11 SERVFAIL, 5 timeouts, and 3 bad-name
responses. There were 204 wildcard-like hostname observations, which this
research excluded from positive counts. No-record/NXDOMAIN responses are not
counted as query failures. Missing signals remain inconclusive: proxying, CNAME
flattening, HTTP redirects, different hostnames, and vendor-hosted URLs can hide
the relationship from this DNS-only method.

The Vanta and SafeBase candidate suffixes were fixed before querying the cohort.
The table retains the original 800/200 split for transparency; these counts are
not independent customer validation. Drata was selected afterward. The
[results](trust-centers/results.json) preserve all positive chains, error details,
and a checksum of the complete local raw pass. [Unattributed target groups](trust-centers/research-queue.json)
remain separate: 23 domains used `elb-conveyor-<id>.aptible.in`, but Aptible is
shared infrastructure. Conveyor's [custom URL instructions](https://docs.conveyor.com/docs/setting-a-custom-url)
do not publish a universal target, so no Conveyor or generic Aptible rule was
added. SecurityPal, Whistic, and other leads also remain unpromoted.

The CLI now prioritizes `trust` in every mode; balanced/full also probe `security`
and `trustcenter`. It retains the hard 80-attempt budget. Extra labels consume
budget previously available to adaptive discovery, so this is targeted coverage
rather than an increase in the query limit. The existing runtime retains its
wildcard evidence flags; the research counts above use the stricter exclusion.

To repeat the supplemental study:

```sh
node docs/research/trust-centers/scan.mjs /tmp/trust-centers.json
node docs/research/trust-centers/summarize.mjs /tmp/trust-centers.json
```
