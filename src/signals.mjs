export const FAST_TRACKING_LABELS = [
  "go",
  "info",
  "hello",
  "email",
  "support",
  "www2",
  "sales",
  "links",
  "pages",
  "partners",
];

export const BALANCED_TRACKING_LABELS = [
  ...FAST_TRACKING_LABELS,
  "outreach",
  "tracking",
  "click",
  "link",
  "mail",
  "resources",
  "discover",
  "marketing",
  "engage",
  "send",
  "trk",
  "learn",
  "offers",
];

export const DEFAULT_TRACKING_LABELS = [
  "track",
  "tracking",
  "click",
  "clicks",
  "link",
  "links",
  "go",
  "email",
  "hello",
  "engage",
  "connect",
  "outreach",
  "sales",
  "marketing",
  "mail",
  "send",
  "trk",
  "info",
  "pages",
  "offers",
  "resources",
  "learn",
  "discover",
  "events",
  "webinars",
  "meet",
  "calendar",
  "success",
  "updates",
  "news",
  "brand",
  "crm",
  "portal",
  "community",
  "partners",
  "customers",
  "login",
  "support",
  "help",
  "docs",
  "status",
  "academy",
  "training",
  "autodiscover",
  "www2",
  "lp",
];

const SALES_VENDOR_PATTERNS = [
  {
    provider: "Outreach",
    confidence: "high",
    patterns: [
      /(^|\.)outrch\.com$/i,
      /(^|\.)outreach\.io$/i,
      /(^|\.)outreach-mail\.com$/i,
    ],
  },
  {
    provider: "Apollo",
    confidence: "high",
    patterns: [
      /(^|\.)apollo\.io$/i,
      /(^|\.)apollo-mail\.io$/i,
      /(^|\.)apollomail\.io$/i,
      /(^|\.)tryapollo\.io$/i,
    ],
  },
  {
    provider: "Apollo",
    confidence: "medium",
    patterns: [/(^|\.)aplolinks\.com$/i],
  },
  {
    provider: "Salesloft",
    confidence: "high",
    patterns: [/(^|\.)salesloft\.com$/i],
  },
  {
    provider: "Gong Engage",
    confidence: "high",
    patterns: [/(^|\.)email-composer-webhooks\.gong\.io$/i],
  },
  {
    provider: "Mixmax",
    confidence: "high",
    patterns: [/(^|\.)mixmax\.com$/i],
  },
];

const CNAME_TECHNOLOGY_PATTERNS = [
  {
    provider: "Adobe Marketo",
    category: "marketing_automation",
    patterns: [/(^|\.)mktoweb\.com$/i, /^mkto-[a-z0-9-]+\.com$/i],
  },
  {
    provider: "HubSpot",
    category: "marketing_automation",
    patterns: [
      /(^|\.)hubspot\.net$/i,
      /(^|\.)sites(?:-proxy)?\.hscoscdn(?:[0-9]{2}|-[a-z0-9]+)?\.net$/i,
    ],
  },
  {
    provider: "Salesforce Pardot",
    category: "marketing_automation",
    patterns: [/(^|\.)pardot\.com$/i],
  },
  {
    provider: "Oracle Eloqua",
    category: "marketing_automation",
    patterns: [/(^|\.)eloqua\.com$/i],
  },
  {
    provider: "Act-On",
    category: "marketing_automation",
    patterns: [
      /(^|\.)actonservice\.com$/i,
      /(^|\.)ez-touch\.net$/i,
    ],
  },
  {
    provider: "Iterable",
    category: "customer_messaging",
    patterns: [
      /^links\.iterable\.com$/i,
      /^links\.eu\.iterable\.com$/i,
    ],
  },
  {
    provider: "Unbounce",
    category: "landing_pages",
    patterns: [
      /(^|\.)unbouncepages\.com$/i,
      /(^|\.)ubpages\.com$/i,
    ],
  },
  {
    provider: "Klaviyo",
    category: "marketing_automation",
    patterns: [/(^|\.)klaviyodns\.com$/i],
  },
  {
    provider: "SendGrid",
    category: "email_delivery",
    patterns: [/(^|\.)sendgrid\.net$/i],
  },
  {
    provider: "Mailgun",
    category: "email_delivery",
    patterns: [/(^|\.)mailgun\.org$/i],
  },
  {
    provider: "SMTP2GO",
    category: "email_delivery",
    patterns: [/(^|\.)smtp2go\.net$/i],
  },
  {
    provider: "Customer.io",
    category: "customer_messaging",
    patterns: [/(^|\.)customeriomail\.com$/i],
  },
  {
    provider: "SparkPost",
    category: "email_delivery",
    patterns: [
      /(^|\.)sparkpostmail\.com$/i,
      /(^|\.)spgo\.io$/i,
      /(^|\.)mail\.e\.sparkpost\.com$/i,
      /(^|\.)et\.e\.sparkpost\.com$/i,
    ],
  },
  {
    provider: "Salesforce Marketing Cloud Engagement",
    category: "marketing_automation",
    patterns: [
      /(^|\.)sfmc-content\.com$/i,
      /(^|\.)exacttarget\.com$/i,
    ],
  },
  {
    provider: "Salesforce",
    category: "crm_or_hosted_site",
    patterns: [
      /(^|\.)siteforce\.com$/i,
      /(^|\.)force\.com$/i,
      /(^|\.)salesforce\.com$/i,
    ],
  },
  {
    provider: "Microsoft Dynamics 365",
    category: "crm_or_hosted_site",
    patterns: [
      /(^|\.)dynamics\.com$/i,
      /(^|\.)microsoftcrmportals\.com$/i,
    ],
  },
  {
    provider: "Microsoft Power Pages",
    category: "power_platform_hosted_site",
    patterns: [/(^|\.)powerappsportals\.com$/i],
  },
];

const MX_PATTERNS = [
  {
    provider: "Google Workspace",
    patterns: [/(^|\.)google\.com$/i, /(^|\.)googlemail\.com$/i],
  },
  {
    provider: "Microsoft 365",
    patterns: [/(^|\.)mail\.protection\.outlook\.com$/i],
  },
  { provider: "Zoho Mail", patterns: [/(^|\.)zoho\.(com|eu|in|com\.au)$/i] },
  { provider: "Fastmail", patterns: [/(^|\.)messagingengine\.com$/i] },
  { provider: "Proton Mail", patterns: [/(^|\.)protonmail\.ch$/i] },
  { provider: "Apple iCloud Mail", patterns: [/(^|\.)mail\.icloud\.com$/i] },
  { provider: "GoDaddy Email", patterns: [/(^|\.)secureserver\.net$/i] },
  { provider: "Titan Mail", patterns: [/(^|\.)titan\.email$/i] },
];

const GATEWAY_PATTERNS = [
  { provider: "Mimecast", patterns: [/(^|\.)mimecast\.com$/i] },
  {
    provider: "Proofpoint",
    patterns: [/(^|\.)pphosted\.com$/i, /(^|\.)proofpoint\.com$/i],
  },
  {
    provider: "Barracuda",
    patterns: [/(^|\.)barracudanetworks\.com$/i, /(^|\.)barracudanetworks\.net$/i],
  },
  { provider: "Cisco Email Security", patterns: [/(^|\.)iphmx\.com$/i] },
];

const SPF_SENDER_PATTERNS = [
  { provider: "Google Workspace", patterns: [/(^|\.)_spf\.google\.com$/i] },
  {
    provider: "Microsoft 365",
    patterns: [/(^|\.)spf\.protection\.outlook\.com$/i],
  },
  { provider: "Salesforce", patterns: [/(^|\.)_spf\.salesforce\.com$/i] },
  { provider: "HubSpot", patterns: [/(^|\.)hubspotemail\.net$/i] },
  { provider: "Adobe Marketo", patterns: [/(^|\.)mktomail\.com$/i] },
  { provider: "Act-On", patterns: [/(^|\.)_spf\.act-on\.net$/i] },
  { provider: "Zendesk", patterns: [/(^|\.)mail\.zendesk\.com$/i] },
  {
    provider: "Mailchimp",
    patterns: [/(^|\.)servers\.mcsv\.net$/i, /(^|\.)mandrillapp\.com$/i],
  },
  { provider: "SendGrid", patterns: [/(^|\.)sendgrid\.net$/i] },
  { provider: "Mailgun", patterns: [/(^|\.)mailgun\.org$/i] },
  { provider: "Amazon SES", patterns: [/(^|\.)amazonses\.com$/i] },
  { provider: "Atlassian", patterns: [/(^|\.)_spf\.atlassian\.net$/i] },
  { provider: "Help Scout", patterns: [/(^|\.)helpscoutemail\.com$/i] },
  { provider: "Freshworks", patterns: [/(^|\.)freshemail\.io$/i] },
];

const VERIFICATION_PATTERNS = [
  {
    provider: "Google",
    purpose: "Google site or domain ownership",
    pattern: /^google-site-verification\s*=/i,
  },
  {
    provider: "Microsoft",
    purpose: "Microsoft domain ownership",
    pattern: /^MS=ms[a-z0-9]+$/i,
  },
  {
    provider: "Apple Business",
    purpose: "Apple Business domain ownership",
    pattern: /^apple-domain-verification\s*=/i,
  },
  {
    provider: "Atlassian",
    purpose: "Atlassian organization domain ownership",
    pattern: /^atlassian-domain-verification\s*=/i,
  },
  {
    provider: "Meta",
    purpose: "Meta Business domain ownership",
    pattern: /^facebook-domain-verification\s*=/i,
  },
  {
    provider: "Adobe",
    purpose: "Adobe identity domain ownership",
    pattern: /^adobe-idp-site-verification\s*=/i,
  },
  {
    provider: "Zoom",
    purpose: "Zoom domain ownership",
    pattern: /^(?:zoom-domain-verification|zoom_verify_)\s*[=:]/i,
  },
  {
    provider: "OpenAI",
    purpose: "OpenAI workspace domain ownership",
    pattern: /^openai-domain-verification\s*=/i,
  },
  {
    provider: "Slack",
    purpose: "Slack organization domain ownership",
    pattern: /^slack-domain-verification\s*=/i,
  },
  {
    provider: "Docker",
    purpose: "Docker organization domain ownership",
    pattern: /^docker-verification\s*=/i,
  },
  {
    provider: "Canva",
    purpose: "Canva site ownership",
    pattern: /^canva-site-verification\s*=/i,
  },
  {
    provider: "OneTrust",
    purpose: "OneTrust domain ownership",
    pattern: /^onetrust-domain-verification\s*=/i,
  },
  {
    provider: "Anthropic",
    purpose: "Anthropic workspace domain ownership",
    pattern: /^anthropic-domain-verification(?:-[a-z0-9]+)?\s*=/i,
  },
  {
    provider: "Box",
    purpose: "Box organization domain ownership",
    pattern: /^box-domain-verification\s*=/i,
  },
  {
    provider: "Uber for Business",
    purpose: "Uber organization domain ownership",
    pattern: /^uber-domain-verification\s*=/i,
  },
  {
    provider: "HubSpot",
    purpose: "HubSpot domain, DNS, or developer ownership",
    pattern: /^hubspot-(?:domain|dns|developer)-verification\s*=/i,
  },
  {
    provider: "Klaviyo",
    purpose: "Klaviyo branded sending domain ownership",
    pattern: /^klaviyo-site-verification\s*=/i,
  },
  {
    provider: "Linear",
    purpose: "Linear workspace domain ownership",
    pattern: /^linear-domain-verification\s*=/i,
  },
  {
    provider: "Reachdesk",
    purpose: "Reachdesk domain ownership",
    pattern: /^reachdesk-verification\s*=/i,
  },
  {
    provider: "Cisco",
    purpose: "Cisco service domain ownership",
    pattern: /^cisco-ci-domain-verification\s*=/i,
  },
  {
    provider: "Cursor",
    purpose: "Cursor organization domain ownership",
    pattern: /^cursor-domain-verification(?:-[a-z0-9]+)?\s*=/i,
  },
  {
    provider: "Gradle",
    purpose: "Gradle organization domain ownership",
    pattern: /^gradle-verification\s*=/i,
  },
  {
    provider: "Lucid",
    purpose: "Lucidchart organization domain ownership",
    pattern: /^lucidchart-verification\s*=/i,
  },
  {
    provider: "Postman",
    purpose: "Postman organization domain ownership",
    pattern: /^postman-domain-verification\s*=/i,
  },
  {
    provider: "Atlassian Statuspage",
    purpose: "Statuspage custom domain ownership",
    pattern: /^status-page-domain-verification\s*=/i,
  },
  {
    provider: "Zapier",
    purpose: "Zapier organization domain ownership",
    pattern: /^zapier-domain-verification-challenge\s*=/i,
  },
  {
    provider: "Airtable",
    purpose: "Airtable organization domain ownership",
    pattern: /^airtable-verification\s*=/i,
  },
  {
    provider: "Bugcrowd",
    purpose: "Bugcrowd domain ownership",
    pattern: /^bugcrowd-verification\s*=/i,
  },
  {
    provider: "Drift",
    purpose: "Drift domain ownership",
    pattern: /^drift-domain-verification\s*=/i,
  },
  {
    provider: "Miro",
    purpose: "Miro organization domain ownership",
    pattern: /^miro-verification\s*=/i,
  },
  {
    provider: "Figma",
    purpose: "Figma organization domain ownership",
    pattern: /^figma-domain-verification\s*=/i,
  },
  {
    provider: "Mailgun",
    purpose: "Mailgun sending domain ownership",
    pattern: /^mgverify\s*=/i,
  },
  {
    provider: "GoTo / LogMeIn",
    purpose: "GoTo organization domain ownership",
    pattern: /^logmein-verification-code\s*=/i,
  },
  {
    provider: "JetBrains",
    purpose: "JetBrains organization domain ownership",
    pattern: /^jetbrains-domain-verification\s*=/i,
  },
  {
    provider: "Loom",
    purpose: "Loom organization domain ownership",
    pattern: /^loom-site-verification\s*=/i,
  },
  {
    provider: "Mixpanel",
    purpose: "Mixpanel organization domain ownership",
    pattern: /^mixpanel-domain-verify\s*=/i,
  },
  {
    provider: "Notion",
    purpose: "Notion organization domain ownership",
    pattern: /^notion-domain-verification\s*=/i,
  },
  {
    provider: "Sinch",
    purpose: "Sinch sending domain ownership",
    pattern: /^sinch-domain-verification\s*=/i,
  },
  {
    provider: "1Password",
    purpose: "1Password organization domain ownership",
    pattern: /^1password-site-verification\s*=/i,
  },
  {
    provider: "Have I Been Pwned",
    purpose: "Have I Been Pwned domain ownership",
    pattern: /^have-i-been-pwned-verification\s*=/i,
  },
  {
    provider: "Atlassian",
    purpose: "Atlassian sending domain ownership",
    pattern: /^atlassian-sending-domain-verification\s*=/i,
  },
  {
    provider: "Salesforce",
    purpose: "Salesforce domain ownership",
    pattern: /^salesforce-domain-verification\s*=/i,
  },
];

const DMARC_SERVICE_PATTERNS = [
  { provider: "Dmarcian", patterns: [/(^|\.)dmarcian\.com$/i] },
  { provider: "Valimail", patterns: [/(^|\.)vali\.email$/i] },
  { provider: "Proofpoint", patterns: [/(^|\.)proofpoint\.com$/i] },
  { provider: "Cloudflare DMARC Management", patterns: [/(^|\.)cloudflare\.net$/i] },
  { provider: "EasyDMARC", patterns: [/(^|\.)easydmarc\.(com|us|pro)$/i] },
  { provider: "Red Sift OnDMARC", patterns: [/(^|\.)ondmarc\.com$/i] },
  { provider: "DMARC Digests", patterns: [/(^|\.)dmarcdigests\.com$/i] },
  { provider: "DMARCLY", patterns: [/(^|\.)dmarcly\.com$/i] },
  { provider: "Postmark DMARC", patterns: [/(^|\.)dmarc\.postmarkapp\.com$/i] },
];

const DNS_PROVIDER_PATTERNS = [
  { provider: "Cloudflare DNS", patterns: [/(^|\.)ns\.cloudflare\.com$/i] },
  { provider: "Amazon Route 53", patterns: [/(^|\.)awsdns-[0-9-]+\.(com|net|org|co\.uk)$/i] },
  { provider: "Microsoft Azure DNS", patterns: [/(^|\.)azure-dns\.(com|net|org|info)$/i] },
  { provider: "GoDaddy DNS", patterns: [/(^|\.)domaincontrol\.com$/i] },
  { provider: "Google Cloud DNS", patterns: [/(^|\.)googledomains\.com$/i] },
  { provider: "NS1", patterns: [/(^|\.)nsone\.net$/i] },
];

function cleanHost(value) {
  return String(value).trim().replace(/\.$/, "").toLowerCase();
}

function matchPattern(host, definitions) {
  return definitions.find((definition) =>
    definition.patterns.some((pattern) => pattern.test(host)),
  );
}

export function detectSalesVendor(hostname, cnameTarget) {
  const target = cleanHost(cnameTarget);
  const registryMatch = findHostSignature(target, "cname");
  const matched =
    registryMatch?.category === "sales_engagement"
      ? registryMatch
      : matchPattern(target, SALES_VENDOR_PATTERNS);
  if (!matched) return null;
  return {
    provider: matched.provider,
    confidence: matched.confidence,
    signalType: "tracking_cname",
    relationship: "platform_configuration",
    hostname: cleanHost(hostname),
    target,
    rationale:
      matched.confidence === "high"
        ? "A public tracking-style subdomain points to documented or vendor-attributable infrastructure. This is strong configuration evidence, but does not prove current seat usage."
        : "A public tracking-style subdomain points to infrastructure repeatedly associated with this vendor. Treat this as a corroborated candidate signal, not proof of current seat usage.",
    signatureCatalogVersion: SIGNATURE_CATALOG_VERSION,
  };
}

export function detectCnameTechnology(hostname, cnameTarget) {
  const target = cleanHost(cnameTarget);
  const matched =
    findHostSignature(target, "cname") ??
    matchPattern(target, CNAME_TECHNOLOGY_PATTERNS);
  if (!matched) return null;
  return {
    provider: matched.provider,
    category: matched.category,
    confidence: matched.confidence ?? "high",
    hostname: cleanHost(hostname),
    target,
    signatureCatalogVersion: SIGNATURE_CATALOG_VERSION,
  };
}

export function classifyMx(records) {
  const exchanges = records.map((record) => cleanHost(record.exchange));
  const providers = new Set();
  const gateways = new Set();

  for (const host of exchanges) {
    const provider = matchPattern(host, MX_PATTERNS);
    if (provider) providers.add(provider.provider);
    const gateway = matchPattern(host, GATEWAY_PATTERNS);
    if (gateway) gateways.add(gateway.provider);
  }

  let provider = "Unknown";
  let confidence = "none";
  if (providers.size === 1) {
    provider = [...providers][0];
    confidence = "high";
  } else if (providers.size > 1) {
    provider = [...providers].join(", ");
    confidence = "medium";
  } else if (gateways.size > 0) {
    provider = "Unknown behind email security gateway";
    confidence = "low";
  } else if (records.length === 0) {
    provider = "No MX record";
  }

  return { provider, confidence, gateways: [...gateways] };
}

export function classifyDnsProvider(nameservers) {
  const matched = new Set();
  for (const nameserver of nameservers.map(cleanHost)) {
    const provider = matchPattern(nameserver, DNS_PROVIDER_PATTERNS);
    if (provider) matched.add(provider.provider);
  }
  return matched.size ? [...matched] : ["Unknown"];
}

export function extractDomainVerifications(txtRecords, options = {}) {
  const values = txtRecords.map((parts) => parts.join("").trim());
  const findings = [];
  for (const value of values) {
    const known =
      SIGNATURE_REGISTRY.verification.find(({ pattern }) =>
        pattern.test(value),
      ) ?? VERIFICATION_PATTERNS.find(({ pattern }) => pattern.test(value));
    const generic = value.match(
      /^([a-z0-9_.-]*(?:verification|verify)[a-z0-9_.-]*)\s*[=:]/i,
    );
    if (
      !known &&
      (!generic || options.includeUnclassified !== true)
    ) {
      continue;
    }
    const separator = value.search(/[=:]/);
    const prefix = separator >= 0 ? value.slice(0, separator) : value.slice(0, 64);
    findings.push({
      provider: known?.provider ?? "Unclassified service",
      purpose: known?.purpose ?? "Domain or site ownership verification",
      confidence: known ? "medium" : "low",
      ...(known?.category ? { category: known.category } : {}),
      recordPrefix: prefix,
      tokenRedacted: true,
      signatureCatalogVersion: SIGNATURE_CATALOG_VERSION,
    });
  }
  return findings.filter(
    (item, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.provider === item.provider &&
          candidate.recordPrefix === item.recordPrefix,
      ) === index,
  );
}

export function parseSpf(txtRecords) {
  const records = txtRecords
    .map((parts) => parts.join(""))
    .filter((value) => /^v=spf1(?:\s|$)/i.test(value));
  const includes = [
    ...new Set(
      records.flatMap((record) =>
        [...record.matchAll(/(?:^|\s)include:([^\s]+)/gi)].map((match) =>
          cleanHost(match[1]),
        ),
      ),
    ),
  ];
  const redirects = [
    ...new Set(
      records.flatMap((record) =>
        [...record.matchAll(/(?:^|\s)redirect=([^\s]+)/gi)].map((match) =>
          cleanHost(match[1]),
        ),
      ),
    ),
  ];
  const mechanisms = [...new Set([...includes, ...redirects])];
  return {
    present: records.length > 0,
    multipleRecords: records.length > 1,
    records,
    includes,
    redirects,
    authorizedSenders: [
      ...new Set(
        mechanisms
          .map(
            (host) =>
              findHostSignature(host, "spf")?.provider ??
              matchPattern(host, SPF_SENDER_PATTERNS)?.provider,
          )
          .filter(Boolean),
      ),
    ],
  };
}

export function classifyDkimTarget(host) {
  const matched = findHostSignature(cleanHost(host), "dkim");
  return matched
    ? {
        provider: matched.provider,
        confidence: matched.confidence ?? "high",
        target: cleanHost(host),
        signatureCatalogVersion: SIGNATURE_CATALOG_VERSION,
      }
    : null;
}

export function classifyDelegatedNameservers(nameservers) {
  const groups = new Map();
  for (const nameserver of nameservers.map(cleanHost)) {
    const matched = findHostSignature(nameserver, "delegatedNs");
    if (!matched) continue;
    const current = groups.get(matched.provider) ?? {
      provider: matched.provider,
      category: matched.category,
      confidence: matched.confidence ?? "high",
      nameservers: [],
      signatureCatalogVersion: SIGNATURE_CATALOG_VERSION,
    };
    current.nameservers.push(nameserver);
    groups.set(matched.provider, current);
  }
  return [...groups.values()];
}

export function parseDmarc(txtRecords) {
  const record = txtRecords
    .map((parts) => parts.join(""))
    .find((value) => /^v=DMARC1(?:;|$)/i.test(value));
  if (!record) return { present: false, policy: null, percentage: null, record: null };

  const tags = Object.fromEntries(
    record
      .split(";")
      .map((part) => part.trim().split("=", 2))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    present: true,
    policy: tags.p ?? null,
    percentage: tags.pct ? Number(tags.pct) : 100,
    reportRecipients: [...(tags.rua ?? "").matchAll(/mailto:([^,!\s]+)/gi)].map(
      (match) => match[1].toLowerCase(),
    ),
    monitoringServices: [
      ...new Set(
        [...(tags.rua ?? "").matchAll(/mailto:([^,!\s]+)/gi)]
          .map((match) => match[1].split("@").at(-1))
          .map((host) => matchPattern(host, DMARC_SERVICE_PATTERNS)?.provider)
          .filter(Boolean),
      ),
    ],
    record,
  };
}

export function dedupeVendorSignals(signals) {
  const confidenceRank = { low: 1, medium: 2, high: 3 };
  const byProvider = new Map();
  for (const signal of signals) {
    const existing = byProvider.get(signal.provider);
    if (!existing) {
      byProvider.set(signal.provider, { ...signal, evidence: [signal] });
    } else {
      existing.evidence.push(signal);
      if (
        confidenceRank[signal.confidence] >
        confidenceRank[existing.confidence]
      ) {
        existing.confidence = signal.confidence;
      }
    }
  }
  return [...byProvider.values()].map(({ evidence, ...signal }) => ({
    ...signal,
    evidence,
  }));
}
import {
  SIGNATURE_CATALOG_VERSION,
  SIGNATURE_REGISTRY,
  findHostSignature,
} from "./signature-registry.mjs";
