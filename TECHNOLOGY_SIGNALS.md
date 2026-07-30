# Technology signal confidence

The scanner reports public DNS observations, not procurement truth. Every normalized
result includes its raw evidence and a caveat so downstream systems can preserve the
difference.

| Category | Provider and record | Confidence | What it supports |
| --- | --- | --- | --- |
| AI | OpenAI verification TXT | Medium | OpenAI organization/SSO or Custom GPT builder domain relationship |
| AI | Anthropic verification TXT | Medium | Anthropic domain-verification relationship |
| CRM | Salesforce-hosted CNAME | High | Salesforce platform or Experience Cloud use, not necessarily Sales Cloud |
| CRM | Salesforce verification TXT | Medium | Salesforce domain relationship |
| CRM | Salesforce SPF authorization | Low | Salesforce-authorized email sending only |
| CRM | HubSpot CNAME | Medium | HubSpot platform relationship; licensed Hub is ambiguous |
| CRM | HubSpot TXT or SPF | Low | HubSpot verification or sending relationship |
| CRM | Dynamics or Microsoft CRM Portals CNAME | High | Microsoft Dynamics business-app infrastructure; exact module can be ambiguous |
| Data platform | Power Pages CNAME | High inference | Microsoft Dataverse, which Power Pages requires |
| Marketing | Marketo `mktoweb.com` or `mkto-*` CNAME | High | Product-specific Marketo landing page or tracking setup |
| Marketing | Pardot `go.pardot.com` CNAME | High | Product-specific Account Engagement tracker domain |
| Marketing | Oracle Eloqua CNAME | High | Eloqua-hosted branded domain |
| Marketing | Customer.io CNAME | High | Customer.io sending or tracking domain |
| Marketing | Act-On CNAME | High | Act-On-hosted marketing or tracking domain |
| Marketing | Iterable CNAME | High | Iterable link-tracking domain |
| Marketing | Unbounce CNAME | High | Unbounce-hosted landing-page domain |
| Marketing | Klaviyo TXT or CNAME | Medium/High | Branded sending-domain verification or hosting |
| Marketing | HubSpot CNAME | High | HubSpot-hosted content/marketing infrastructure; exact Hub remains ambiguous |
| Marketing | Marketo, HubSpot, or Mailchimp SPF | Medium | Authorized vendor email sending; potentially stale |
| Marketing | Salesforce `sfmc-content.com` CNAME | High | Marketing Cloud-hosted content or CloudPages configuration |
| Sales engagement | Outreach, Apollo, Salesloft, Gong Engage, Mixmax CNAME | High | Product-specific tracking configuration |
| Sales engagement | Apollo `aplolinks.com` or Nooks `nooks.in` CNAME | Medium | Corroborated vendor infrastructure with narrower public documentation |
| Customer support | Zendesk, Intercom, or Help Scout CNAME | High | Product-specific help-center configuration |
| Customer education | Skilljar or Docebo CNAME | High | Product-hosted academy or learning domain |
| Events | Goldcast CNAME | High | Product-specific vanity event domain |
| Customer data | Segment ownership TXT | Medium | Configured Segment organization relationship |
| Product analytics | Pendo or Mixpanel ownership TXT | Medium | Configured analytics-platform relationship |
| Meeting intelligence | Fireflies ownership TXT | Medium | Configured Fireflies organization relationship |
| Payments | Stripe ownership TXT | Medium | Configured Stripe domain relationship |
| CRM inference | Salesforce Account Engagement/Pardot CNAME | High | Salesforce CRM organization relationship; not active Sales Cloud seats |
| CRM inference | Salesforce Marketing Cloud Engagement CNAME | Medium | Salesforce CRM inferred from a proven Marketing Cloud relationship; not direct proof of Sales Cloud |
| Delivery | SendGrid, Mailgun, SMTP2GO, or SparkPost CNAME | High | Branded email-delivery or tracking configuration |
| Delivery | SendGrid, Mailgun, Amazon SES, or SparkPost SPF | Low | Authorized sending only; potentially stale |

The confidence and relationship dimensions answer different questions. Confidence
describes how specifically the record identifies the provider. `relationshipLevel`
describes what the record actually proves:

- `platform_configuration`: an attributable hosted or tracking CNAME;
- `domain_relationship`: a completed ownership-verification challenge;
- `sending_authorization`: permission in SPF to send on the domain's behalf.

## Cross-tool inference graph

`technologyProfile.inferenceGraph` keeps derived findings separate from raw DNS
observations:

```json
{
  "version": "1.0",
  "inferred": [
    {
      "category": "crm",
      "provider": "Salesforce",
      "confidence": "high",
      "inferenceType": "suite_dependency",
      "directlyObserved": false,
      "ruleIds": ["pardot_implies_salesforce_crm"]
    }
  ],
  "candidateSets": [
    {
      "subject": "marketo_crm_connector",
      "category": "crm",
      "confidence": "medium",
      "exhaustive": false,
      "candidates": [
        {
          "provider": "Salesforce",
          "corroborated": true,
          "observedConfidence": "high"
        },
        {
          "provider": "Microsoft Dynamics 365",
          "corroborated": false
        }
      ]
    }
  ]
}
```

Current rules cover Salesforce Account Engagement, Salesforce Marketing Cloud
Engagement, HubSpot-hosted infrastructure, Power Pages/Dataverse, Marketo CRM
candidates, and CRM candidates for detected sales-engagement platforms.
Candidate sets are explicitly non-exhaustive and do not assert that an integration
is enabled.

## Recommended enrichment fields

Store one observation per provider rather than flattening the result to a single
vendor:

```json
{
  "provider": "Salesforce",
  "category": "crm",
  "confidence": "high",
  "relationshipLevel": "platform_configuration",
  "productScope": "salesforce_platform_or_experience_cloud",
  "observedAt": "2026-07-29T00:00:00.000Z",
  "evidence": [
    {
      "type": "cname",
      "relationship": "platform_configuration",
      "hostname": "customers.example.com",
      "target": "customers.example.com.00dxx0000000000.live.siteforce.com"
    }
  ],
  "caveat": "A Salesforce-hosted custom domain does not prove Sales Cloud seats."
}
```

Retain timestamped observations because DNS can be stale, coexist during migrations,
or represent a product used by only one team.

## Versioned signatures and adaptive evidence

The public `signatureCatalogVersion` identifies the rule set used for a scan.
`vendorprint signatures` prints the serializable catalog, including confidence,
category, target suffixes, and source metadata where available.

Full mode spends a fixed baseline query set and preserves the remaining per-domain
budget for positive evidence:

- SPF `include` and `redirect` terms are followed recursively, capped at ten DNS
  lookups.
- Positive CNAMEs are followed for up to three hops with loop detection.
- A small set of delegated sending subdomains is checked for product-specific
  nameservers.
- DKIM selectors can be selected from already observed sender evidence.
- A deterministic nonexistent-label query identifies wildcard DNS.

All branches share the same hard 80-attempt limit. Optional certificate-transparency
discovery supplies candidate labels only; a certificate name is never emitted as a
technology finding without live DNS corroboration.
