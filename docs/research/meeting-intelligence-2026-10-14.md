# Meeting-intelligence DNS research — October 14, 2026

We investigated **35 Gong, 32 Fireflies, and 30 Granola public organization references**, using source evidence to select domains before examining their DNS. The resulting changes target **vendorprint 0.4.0**, signature catalog **2026.10.14**.

The principal finding is low observable coverage in this bounded sample. It does **not** establish that these vendors cannot be detected through DNS, or that a company without a matching record does not use them.

## Results

| Reported vendor | Public references | Discovery / holdout | Matching vendor-specific DNS signal in its own cohort |
| --- | ---: | ---: | --- |
| Gong | 35 case studies | 27 / 8 | 0 Gong Engage tracking CNAMEs; no validated general Gong recording marker |
| Fireflies | 32 case studies | 26 / 6 | 0 Fireflies verification markers; 31 primary domains answered NS, one did not |
| Granola | 30 references of varying strength | 18 / 12 | No attributable Granola marker or CNAME identified |

Granola's sample contains 16 vendor-named team references, one detailed case study, one vendor-reported team adoption, three company workflow posts, one company privacy notice, three attributed individual testimonials, and five reports of leadership/partner use. **Eight references establish individual use or endorsement at an organization, not an organization-wide customer deployment.** These are not 30 independently verified paid customers. Brex appears in both Gong and Granola, giving 96 distinct primary domains across 97 vendor–organization references.

Fireflies' sample includes four 2026 articles and 28 older articles from 2020–2022. Historical customer evidence does not establish current use. `ohpcoach.com` returned no apex NS or TXT answer; it is retained transparently rather than replaced after seeing its DNS. `eventengage.io` and `boulderthinking.com` had no apex TXT answer but did answer NS.

Additional findings across the sample and separately selected supporting domains:

| Signal | Discovery evidence | Holdout evidence | Decision |
| --- | --- | --- | --- |
| `fireflies-verification=` | Webflow, in the Gong cohort; also prior lead-selected Tavily and Bosch | None | Retain existing medium-confidence detector; require a nonempty value, add provenance and narrower interpretation |
| `read-ai-verification=` | Gusto, in the Granola cohort | None | Add medium-confidence Read AI domain-verification detector: exact prefix is officially documented and independently DNS-confirmed |
| `reachdesk-verification=` | Atlan, Greenhouse's `greenhouse.io` alternate domain, Webflow | Figma; also Reachdesk's own domain | Refine existing detector, remove duplicate permissive rules, add provenance and branded-correspondence scope |
| Gong Engage target suffix | Official Gong configuration documentation; no sample match | None | Retain existing target signature; add documented `email-tracking` discovery label to balanced/full modes |
| Granola / generic identity infrastructure | No Granola-specific candidate | No attributable match | Do not add a Granola signature or infer it from WorkOS, Okta, Microsoft, Google, or shared mail services |

The Read AI rule did **not** replicate in this holdout. Its inclusion rests on the exact vendor-published DNS format, a live observation, and confirmation through a second resolver—not a measured customer-detection rate. Reachdesk's own domain is vendor self-configuration, not an additional independent customer confirmation. Reachdesk and Fireflies were already recognized by 0.3.2; Read AI is the newly recognized provider.

## What DNS evidence means

A vendor-specific TXT marker indicates that someone published a record associated with that vendor's domain-verification workflow. It does not show whether the vendor accepted the challenge, whether SSO is enabled, whether a subscription is paid, or whether meetings are being recorded. A stale record can remain after use stops.

Gong's documented CNAME identifies **Gong Engage branded link tracking**. It does not identify use of Gong call recording. Granola's SSO documentation alone does not establish a public, vendor-specific DNS marker. A customer's public website domain also need not be its employee email or SSO domain.

Public case studies, endorsements, and company disclosures are the source of the reported customer relationships. DNS is a separate observation. Co-occurrence with another vendor is not a false positive: companies can use multiple tools. There is no verified non-customer control group, so this study does not estimate precision, specificity, or population recall.

## Method

- Freeze the source-linked [cohort](meeting-intelligence/cohort.json) before expanded DNS collection. Split by SHA-256 of the primary domain: first eight hex digits modulo three equal to zero means holdout. Previously inspected domains are forced into discovery. Shared domains retain the same split across vendors.
- Inspect discovery, then freeze [candidate rules](meeting-intelligence/candidates.json) before collecting holdout results. The source/candidate SHA-256 files preserve the original manifests.
- Query apex TXT and NS; 53 fixed CNAME labels; one deterministic wildcard control; up to ten recursive SPF include/redirect lookups; and up to ten CNAME-chain lookups, at most three hops per start. The fixed hostname probes are a bounded candidate list, not enumeration of the DNS zone.
- Limit each baseline domain run to 80 queries, with four concurrent domains per process and at least 30 ms between query starts per process. Maximum actually used: 75 queries on one domain. A separate two-domain support run overlapped the holdout run.
- Run 99 cohort domains, including three source-informed alternates, plus two separately selected support domains: **101 domain runs, 6,545 baseline DNS queries**. Eleven subsequent Google DNS-over-HTTPS queries corroborated positive markers and investigated errors. All eight positive-marker domains were confirmed by that second resolver.
- Discard TXT values before persistence; retain only named verification prefixes, SPF host references, opaque-record counts, public CNAME/NS targets, and query statuses. No raw verification values are committed.
- Do not load customer websites for fingerprinting, run JavaScript, accept cookies, access private DNS, or probe vendor account endpoints. Websites were read only as public source material for the research cohort. No CT, MX, or DKIM discovery was performed in this research probe.

Two baseline queries failed: `sales.fourangle.com` timed out and the downstream CNAME query for `mkto-o0211.com` returned SERVFAIL while following a Thumbtack chain. Google DNS subsequently returned NXDOMAIN for the former and also SERVFAIL for the latter. One extra confirmation query checked `email-tracking.thumbtack.com` and returned NXDOMAIN; it did not resolve the downstream SERVFAIL. The per-domain results preserve these limitations. The lack of an NS answer for `media.bukihq.com`, an alternate subdomain, does not imply its parent company domain is unavailable.

Observation timestamps are October 15 UTC, which was October 14 in America/Los_Angeles.

## Implementation and compatibility

- Add Read AI to `meetingIntelligence`, with `read_ai_domain_verification` scope.
- Add `email-tracking` to balanced and full CNAME discovery; keep the 80-query scanner ceiling. The ten-label fast mode is unchanged.
- Narrow scopes to `gong_engage_link_tracking`, `fireflies_domain_verification`, and `reachdesk_email_domain_verification` for existing signatures.
- Carry applicable signature sources, verification date, product scope, and caveat through raw findings; include sources in the resulting profile evidence.
- Require nonempty values for Fireflies, Read AI, and Reachdesk markers. Keep exact prefix matching and DNS suffix boundaries. Remove duplicate legacy Reachdesk definitions that would otherwise bypass the stricter rule.
- Correct the generic profile statement that a published TXT record proves a completed challenge.

Existing Gong Engage, Fireflies, and Reachdesk fingerprints/product-scope diff keys change once on upgrade. This is a catalog interpretation change, not evidence of a customer's stack change. Added Read AI findings and newly discovered Gong hostnames can also change fingerprints. Source URL changes alone do not affect fingerprints.

Regression tests cover split TXT records, optional whitespace, empty values, misleading prefixes, spoofed CNAME suffixes, shared identity infrastructure, token redaction, source propagation, narrow scopes, and scanner discovery within its query budget. All test values are synthetic.

## Sources and reproducibility

- [Gong: Set up branded URLs](https://help.gong.io/docs/set-up-branded-urls) — product-specific suffix and suggested hostname.
- [Fireflies: Google Workspace SAML SSO](https://guide.fireflies.ai/articles/7821332836-how-to-setup-saml-sso-for-your-google-workspace) — domain verification workflow; the exact observed prefix is corroborated in public DNS.
- [Read AI: Verify domain ownership](https://support.read.ai/hc/en-us/articles/48607849975955-How-do-I-verify-domain-ownership) — exact `read-ai-verification` TXT format.
- [Reachdesk: Verify domains](https://support.reachdesk.com/hc/en-gb/articles/4410354225169-How-to-verify-domains-within-Reachdesk) — branded correspondence and apex TXT verification workflow; repeated public observations corroborate the prefix.
- [Granola: SSO setup guide](https://docs.granola.ai/help-center/sso-setup-guide) — SSO configuration does not by itself supply a validated DNS fingerprint.
- [Per-domain results](meeting-intelligence/results.json), [second-resolver confirmations](meeting-intelligence/confirmations.json), and [source-linked cohort](meeting-intelligence/cohort.json).

The committed results summarize only candidate-marker hits and query health. Full redacted observations and fetched source pages were retained in the local research workspace, outside the package and repository. The reproducible probe emits a fresh redacted observation file; live DNS will change over time. The research files are excluded from the npm tarball.

From the repository root, using Node 20 or newer:

```sh
node docs/research/meeting-intelligence/probe.mjs discovery
node docs/research/meeting-intelligence/probe.mjs holdout
node docs/research/meeting-intelligence/probe.mjs support
```

Each command makes live public DNS queries and overwrites only its corresponding `*-observations.json` research output. Running these commands later is replication, not a fresh blinded validation of already published hypotheses.

## Organization references

The manifest includes source publication dates when available and evidence-strength labels. Null dates mean the page did not expose the parsed publication field; they do not mean the relationship is current.

### Gong

| Organization | Domain | Split | Source evidence |
| --- | --- | --- | --- |
| Addepar | `addepar.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/addepar-leaders-increase-sales-efficiency-with-gong) |
| Frontify | `frontify.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/alignment-across-revops-and-reps-brings-frontify-a-30-increase-in-lead-conversion) |
| Sendoso | `sendoso.com` | holdout | [vendor case study](https://www.gong.io/customers/case-studies/all-paths-lead-to-retention-how-gong-forever-changed-sendosos-customer-experience-team) |
| Allvue | `allvuesystems.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/allvue-shortens-sales-cycles-boosts-qualified-close-rates-with-gong) |
| Anthropic | `anthropic.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/anthropics-64-productivity-gain-combining-revenue-ai-with-a-customer-centric-gtm-strategy) |
| AppsFlyer | `appsflyer.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/appsflyer-cuts-meeting-prep-time-by-50-with-gong-ai) |
| BairesDev | `bairesdev.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/bairesdev-is-7x-more-productive-at-strategic-decision-making-with-gong) |
| BlueCat | `bluecatnetworks.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/bluecat-empowers-their-field-team-to-understand-their-pipeline) |
| Funding Circle | `fundingcircle.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/business-financing-leader-funding-circle-credits-gong-with-more-successful-customer-interactions) |
| Chime | `chime.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/chime-b2b-growth-gong-efficiency-forecasting) |
| Culture Amp | `cultureamp.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/culture-amp-forecast-accuracy-scaled-global-sales-training) |
| Dreamdata | `dreamdata.io` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/dreamdata-scaled-onboarding-increased-average-deal-sizes) |
| Easyship | `easyship.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/easyship-boosts-forecast-accuracy-to-90-and-lifts-win-rates-by-15-using-gong) |
| Eftsure | `eftsure.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/eftsure-exceeds-targets-by-35-and-accelerates-onboarding-with-gong) |
| Egnyte | `egnyte.com` | holdout | [vendor case study](https://www.gong.io/customers/case-studies/egnyte-streamlines-customer-success-management) |
| Element451 | `element451.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/element451-accelerates-sales-performance-driving-a-131-increase-in-arr-with-gong-ai) |
| Rootly | `rootly.com` | holdout | [vendor case study](https://www.gong.io/customers/case-studies/fast-growing-rootly-sees-67-increase-in-rep-productivity-thanks-to-early-investment-in-gong) |
| Gainsight | `gainsight.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/gainsights-ceo-uses-gong-to-better-understand-the-true-market) |
| GHX | `ghx.com` | holdout | [vendor case study](https://www.gong.io/customers/case-studies/ghx-reduced-rep-ramp-time-by-85-with-gong) |
| Aircall | `aircall.io` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/gong-for-bdrs-how-aircall-boosted-qualified-pipeline-by-35-in-emea) |
| Appen | `appen.com` | holdout | [vendor case study](https://www.gong.io/customers/case-studies/gong-for-cs-appen-wants-it-loves-it-needs-it) |
| Reachdesk | `reachdesk.com` | holdout | [vendor case study](https://www.gong.io/customers/case-studies/gong-gives-reachdesk-the-gift-of-alignment-during-rapid-international-growth) |
| HubSpot | `hubspot.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/gong-lets-hubspot-sales-reps-to-go-back-and-watch-the-game-tapes) |
| Paycor | `paycor.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/gongs-revenue-intelligence-fuels-a-141-surge-in-paycors-client-sales-success) |
| Auvik | `auvik.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/how-auvik-created-its-a-team-with-gong) |
| BlueGrace Logistics | `mybluegrace.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/how-bluegraces-reps-got-an-88-lift-in-reply-rates-using-gong-engage) |
| Exterro | `exterro.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/how-exterro-increased-pipeline-using-gong-engage) |
| Jane Technologies | `iheartjane.com` | holdout | [vendor case study](https://www.gong.io/customers/case-studies/how-jane-technologies-halved-rep-onboarding-time-and-boosted-pipeline-by-125-with-gong-engage) |
| Webflow | `webflow.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/how-maggie-hott-of-webflow-uses-gong-for-work-life-balance) |
| Demandbase | `demandbase.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/how-a-sales-talk-show-boosted-acv-by-45-at-demandbase) |
| Greenhouse | `greenhouse.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/how-greenhouse-sows-the-seeds-of-success-with-ai-backed-revenue-intelligence) |
| Atlan | `atlan.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/how-fast-growing-data-and-ai-governance-platform-atlan-accelerated-growth-and-improved-forecasting-with-gong) |
| Brex | `brex.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/how-brex-improved-forecast-accuracy-and-reclaimed-time-using-gong) |
| Rippling | `rippling.com` | discovery | [vendor case study](https://www.gong.io/customers/case-studies/rippling-lifts-win-rates-13-and-increases-ltv-15-using-gong) |
| Shopify | `shopify.com` | holdout | [vendor case study](https://www.gong.io/customers/case-studies/shopify-creates-a-learning-environment-for-their-sales-team) |

### Fireflies

| Organization | Domain | Split | Source evidence |
| --- | --- | --- | --- |
| LevelUp Leads | `levelupleads.io` | discovery | [vendor case study](https://fireflies.ai/blog/how-levelup-leads-keeps-every-client-sales-and-hiring-conversation-on-track) |
| Bee Techy | `beetechy.com` | discovery | [vendor case study](https://fireflies.ai/blog/how-bee-techy-uses-fireflies-to-bring-accountability-to-every-meeting) |
| Fello | `fello.agency` | discovery | [vendor case study](https://fireflies.ai/blog/how-fello-uses-fireflies-to-run-clearer-faster-meetings-across-the-business) |
| FourAngle Consulting | `fourangle.com` | discovery | [vendor case study](https://fireflies.ai/blog/from-call-to-build-in-hours-how-fourangle-consulting-cut-70-of-spec-time-with-fireflies-splotch) |
| Baanx | `baanx.com` | discovery | [vendor case study](https://fireflies.ai/blog/fireflies-integration-capabilities-give-complete-visibility-to-baanx-group) |
| Remotish | `remotish.agency` | discovery | [vendor case study](https://fireflies.ai/blog/remotish-removes-guesswork-with-fireflies-conversation-analytics) |
| Accu | `accu.co.uk` | discovery | [vendor case study](https://fireflies.ai/blog/accu-limited-receives-complete-details-on-missed-meetings) |
| Amplified Innovation | `amplifiedinnovation.co` | holdout | [vendor case study](https://fireflies.ai/blog/amplified-innovation-maintains-effective-customer-relationships-with-fireflies-help) |
| BukiHQ Media | `bukihq.com` | discovery | [vendor case study](https://fireflies.ai/blog/how-fireflies-helped-bukihq-media-solve-pr-meeting-concerns) |
| Tokenizz | `tokenizz.com` | discovery | [vendor case study](https://fireflies.ai/blog/how-tokenizz-overcame-language-barrier-using-fireflieai) |
| Agile HRO | `agilehro.com` | discovery | [vendor case study](https://fireflies.ai/blog/agile-talent-avoids-critical-information-loss-with-fireflies-ai) |
| DigitalBull GO | `digitalbullgo.com` | holdout | [vendor case study](https://fireflies.ai/blog/how-digitalbull-go-increased-business-transparency-by-using-fireflies) |
| Glyphic Biotechnologies | `glyphic.bio` | discovery | [vendor case study](https://fireflies.ai/blog/glyphic-biotechnologies-inc-efficiently-manages-meeting-action-items-with-fireflies) |
| Aventus AI | `aventus.ai` | discovery | [vendor case study](https://fireflies.ai/blog/how-fireflies-helps-aventus-ai-limited-focus-on-critical-business-tasks) |
| KEEP Labs | `discoverkeep.com` | discovery | [vendor case study](https://fireflies.ai/blog/how-keep-labs-lean-on-fireflies-to-institutionalize-knowledge-from-calls) |
| Slingshot Effect | `slingshot-effect.com` | discovery | [vendor case study](https://fireflies.ai/blog/slingshot-effect-achieves-better-bicoastal-collaboration-with-fireflies) |
| Purnama Outreach | `shoppurnama.com` | holdout | [vendor case study](https://fireflies.ai/blog/fireflies-helps-disseminate-better-meeting-notes-for-purnama-outreach) |
| TopMarketer | `topmarketer.com` | discovery | [vendor case study](https://fireflies.ai/blog/topmarketer-boosts-meeting-engagement-with-fireflies) |
| EventEngage | `eventengage.io` | discovery | [vendor case study](https://fireflies.ai/blog/how-eventengage-saves-hours-on-documentation-thanks-to-fireflies) |
| Clara | `clara.co` | holdout | [vendor case study](https://fireflies.ai/blog/how-fireflies-helps-clara-minimize-additional-client-calls) |
| Akatia | `akatia.com` | holdout | [vendor case study](https://fireflies.ai/blog/akatia-technologies-case-study) |
| Meaningful Gigs | `meaningfulgigs.com` | discovery | [vendor case study](https://fireflies.ai/blog/meaningfulgigs-asynchronous-call-updates) |
| equalityMD | `equalitymd.com` | discovery | [vendor case study](https://fireflies.ai/blog/equalitymd-automatic-meeting-transcription) |
| Kynection | `kynection.com.au` | discovery | [vendor case study](https://fireflies.ai/blog/kynection-case-study-2) |
| Ticinocom | `ticino.com` | holdout | [vendor case study](https://fireflies.ai/blog/ticinocom-uses-fireflies-meeting-assistant-reduce-workload) |
| Mammal Digital | `mammaldigital.com` | discovery | [vendor case study](https://fireflies.ai/blog/how-mammal-digital-switched-to-automatic-meeting-transcription) |
| Utopian Healthcare | `utopianhealthcare.org` | discovery | [vendor case study](https://fireflies.ai/blog/how-utopian-healthcare-uses-fireflies-to-increase-team-accountability-and-output) |
| Omneo | `omneo.io` | discovery | [vendor case study](https://fireflies.ai/blog/omneo-marketing-team-uses-fireflies-meeting-assistant) |
| BoulderThinking | `boulderthinking.com` | discovery | [vendor case study](https://fireflies.ai/blog/boulderthinking-uses-fireflies-while-working-from-home) |
| Futurosity | `futurosity.com` | discovery | [vendor case study](https://fireflies.ai/blog/how-futurosity-uses-fireflies-to-create-accurate-transcriptions-and-help-clients-grow-their-businesses-3) |
| Beyond Intent | `beyondintent.com.au` | discovery | [vendor case study](https://fireflies.ai/blog/beyond-intent-uses-fireflies-for-automating-crm-data-entry) |
| Optimal X | `ohpcoach.com` | discovery | [vendor case study](https://fireflies.ai/blog/how-optimal-x-uses-fireflies) |

### Granola

| Organization | Domain | Split | Source evidence |
| --- | --- | --- | --- |
| PostHog | `posthog.com` | discovery | [vendor named team](https://www.granola.ai/) |
| Intercom | `intercom.com` | holdout | [vendor named team](https://www.granola.ai/) |
| Figma | `figma.com` | holdout | [vendor named team](https://www.granola.ai/) |
| Brex | `brex.com` | discovery | [vendor named team](https://www.granola.ai/) |
| Ramp | `ramp.com` | discovery | [vendor named team](https://www.granola.ai/) |
| Replit | `replit.com` | holdout | [vendor named team](https://www.granola.ai/) |
| Lovable | `lovable.dev` | discovery | [vendor named team](https://www.granola.ai/) |
| Cursor | `cursor.com` | holdout | [vendor named team](https://www.granola.ai/) |
| Bumble | `bumble.com` | discovery | [vendor named team](https://www.granola.ai/) |
| Asana | `asana.com` | discovery | [vendor named team](https://www.granola.ai/) |
| Vanta | `vanta.com` | discovery | [vendor named team](https://www.granola.ai/) |
| Linear | `linear.app` | discovery | [vendor named team](https://www.granola.ai/) |
| Gusto | `gusto.com` | discovery | [vendor named team](https://www.granola.ai/blog/series-c) |
| Thumbtack | `thumbtack.com` | holdout | [vendor named team](https://www.granola.ai/blog/series-c) |
| Decagon | `decagon.ai` | holdout | [vendor named team](https://www.granola.ai/blog/series-c) |
| Mistral AI | `mistral.ai` | holdout | [vendor named team](https://www.granola.ai/blog/series-c) |
| Zapier | `zapier.com` | discovery | [vendor case study](https://www.granola.ai/customers/zapier) |
| Andreessen Horowitz | `a16z.com` | holdout | [attributed individual testimonial](https://www.granola.ai/) |
| Vercel | `vercel.com` | discovery | [attributed individual testimonial](https://www.granola.ai/) |
| Menlo Ventures | `menlovc.com` | holdout | [attributed individual testimonial](https://www.granola.ai/) |
| Roblox | `roblox.com` | holdout | [vendor reported leadership use](https://www.granola.ai/blog/series-a) |
| Benchmark | `benchmark.com` | discovery | [vendor reported leadership use](https://www.granola.ai/blog/series-a) |
| Sequoia Capital | `sequoiacap.com` | holdout | [vendor reported leadership use](https://www.granola.ai/blog/series-a) |
| Accel | `accel.com` | holdout | [vendor reported leadership use](https://www.granola.ai/blog/series-a) |
| Union Square Ventures | `usv.com` | discovery | [vendor reported leadership use](https://www.granola.ai/blog/series-a) |
| Daversa Partners | `daversapartners.com` | discovery | [vendor reported team adoption](https://www.granola.ai/blog/second-brain-meetings-organizational-memory) |
| Clay | `clay.com` | discovery | [company workflow post](https://www.clay.com/blog/how-we-built-gtm-engineering-function) |
| Superposition | `superposition.ai` | discovery | [company workflow post](https://www.superposition.ai/blogs/interview-notes-granola-recipe) |
| DevRev | `devrev.ai` | discovery | [company privacy notice](https://devrev.ai/legal/privacy-policy) |
| Spiral Software | `spiral.co.nz` | discovery | [company workflow post](https://spiral.co.nz/blog/ai) |
