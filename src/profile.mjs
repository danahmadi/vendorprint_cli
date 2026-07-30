import { buildTechnologyInferenceGraph } from "./inference.mjs";

const CONFIDENCE_ORDER = { low: 1, medium: 2, high: 3 };
const RELATIONSHIP_ORDER = {
  sending_authorization: 1,
  domain_relationship: 2,
  platform_configuration: 3,
};

function strongestConfidence(evidence) {
  return evidence.reduce(
    (best, item) =>
      CONFIDENCE_ORDER[item.confidence] > CONFIDENCE_ORDER[best]
        ? item.confidence
        : best,
    "low",
  );
}

function pushFinding(map, provider, evidence, details = {}) {
  const existing = map.get(provider) ?? {
    provider,
    confidence: "low",
    evidence: [],
    ...details,
  };
  existing.evidence.push(evidence);
  existing.confidence = strongestConfidence(existing.evidence);
  existing.relationshipLevel = existing.evidence.reduce(
    (strongest, item) =>
      (RELATIONSHIP_ORDER[item.relationship] ?? 0) >
      (RELATIONSHIP_ORDER[strongest] ?? 0)
        ? item.relationship
        : strongest,
    "sending_authorization",
  );
  map.set(provider, existing);
}

function verificationEvidence(finding) {
  return {
    type: "txt_domain_verification",
    confidence: finding.confidence,
    relationship: "domain_relationship",
    recordPrefix: finding.recordPrefix,
    interpretation:
      "The domain completed this vendor's ownership challenge. This proves configuration, not current licensing or seat activity.",
  };
}

function cnameEvidence(service) {
  return service.evidence.map((item) => ({
    type: "cname",
    confidence: item.confidence,
    relationship: "platform_configuration",
    hostname: item.hostname,
    target: item.target,
    ...(item.wildcardLikeCname
      ? {
          wildcardLikeCname: true,
          interpretation:
            "The same target answered for most candidate labels and is counted once.",
        }
      : {}),
  }));
}

function spfEvidence(provider) {
  return {
    type: "spf_authorization",
    confidence: "low",
    relationship: "sending_authorization",
    provider,
    interpretation:
      "The domain authorizes this vendor to send mail. The authorization can be stale and may not identify a CRM module.",
  };
}

function nameserverEvidence(finding) {
  return {
    type: "delegated_nameserver",
    confidence: finding.confidence,
    relationship: "platform_configuration",
    hostname: finding.hostname,
    nameservers: finding.nameservers,
    interpretation:
      "A public subdomain delegates authoritative DNS to product-specific vendor infrastructure.",
  };
}

export function buildTechnologyProfile(technologySignals, context = {}) {
  const ai = new Map();
  const crm = new Map();
  const marketing = new Map();
  const emailDelivery = new Map();
  const salesEngagement = new Map();
  const advertisingAndAbm = new Map();
  const customerData = new Map();
  const productAnalytics = new Map();
  const customerSupport = new Map();
  const customerSuccessAndEducation = new Map();
  const eventsAndWebinars = new Map();
  const meetingIntelligence = new Map();
  const commerceAndPayments = new Map();
  const businessSoftware = new Map();
  const websiteAndContent = new Map();
  const brandAndCreative = new Map();
  const identityAndAccess = new Map();
  const categoryMaps = {
    ai_workspace: ai,
    crm: crm,
    marketing_automation: marketing,
    customer_messaging: marketing,
    landing_pages: marketing,
    email_delivery: emailDelivery,
    advertising_abm: advertisingAndAbm,
    customer_data: customerData,
    product_analytics: productAnalytics,
    customer_support: customerSupport,
    customer_community: customerSuccessAndEducation,
    customer_education: customerSuccessAndEducation,
    events_webinars: eventsAndWebinars,
    meeting_intelligence: meetingIntelligence,
    commerce_payments: commerceAndPayments,
    business_software: businessSoftware,
    mail_productivity: businessSoftware,
    website_cms: websiteAndContent,
    website_hosting: websiteAndContent,
    link_management: websiteAndContent,
    brand_management: brandAndCreative,
    identity_access: identityAndAccess,
  };

  for (const finding of technologySignals.domainVerifications) {
    if (finding.provider === "OpenAI") {
      pushFinding(
        ai,
        "OpenAI",
        verificationEvidence(finding),
        {
          productScope: "openai_organization_or_builder_profile",
          caveat:
            "OpenAI uses domain verification for organization/SSO setup and Custom GPT builder identity. It does not by itself confirm ChatGPT Enterprise, edition, seats, or activity.",
        },
      );
    } else if (finding.provider === "Anthropic") {
      pushFinding(
        ai,
        "Anthropic",
        verificationEvidence(finding),
        {
          productScope: "anthropic_domain_verification",
          caveat:
            "The self-identifying ownership challenge proves an Anthropic domain relationship, not a specific plan, seats, or current activity.",
        },
      );
    }
    if (finding.provider === "Salesforce") {
      pushFinding(crm, "Salesforce", verificationEvidence(finding), {
        productScope: "salesforce_platform",
        caveat: "A verification record does not prove Sales Cloud specifically.",
      });
    }
    if (finding.provider === "HubSpot") {
      const evidence = verificationEvidence(finding);
      pushFinding(crm, "HubSpot", { ...evidence, confidence: "low" }, {
        productScope: "hubspot_platform",
        caveat:
          "HubSpot DNS does not distinguish CRM, Marketing Hub, CMS Hub, or another HubSpot product.",
      });
      pushFinding(
        marketing,
        "HubSpot",
        { ...evidence, confidence: "medium" },
        {
          productScope: "hubspot_platform",
          caveat:
            "This proves a HubSpot relationship, but does not identify the licensed Hub.",
        },
      );
    } else if (finding.provider === "Klaviyo") {
      pushFinding(marketing, "Klaviyo", verificationEvidence(finding), {
        productScope: "branded_sending_domain",
        caveat:
          "The ownership record proves Klaviyo sending-domain configuration, not current campaign activity.",
      });
    }
    const genericMap = categoryMaps[finding.category];
    if (genericMap && !genericMap.has(finding.provider)) {
      pushFinding(genericMap, finding.provider, verificationEvidence(finding), {
        productScope: finding.category,
        caveat:
          "The ownership challenge proves a configured domain relationship, not an active subscription, edition, seats, or recent use.",
      });
    }
  }

  for (const service of technologySignals.cnameServices) {
    const evidence = cnameEvidence(service);
    if (service.provider === "Salesforce") {
      for (const item of evidence) {
        pushFinding(crm, "Salesforce", item, {
          productScope: "salesforce_platform_or_experience_cloud",
          caveat:
            "A Salesforce-hosted custom domain proves platform use, but not Sales Cloud seats.",
        });
      }
    } else if (service.provider === "Microsoft Dynamics 365") {
      for (const item of evidence) {
        pushFinding(crm, "Microsoft Dynamics 365", item, {
          productScope: "dynamics_or_crm_portal",
          caveat:
            "A Dynamics-hosted portal proves Microsoft business-app infrastructure without identifying the exact Dynamics module.",
        });
      }
    } else if (service.provider === "HubSpot") {
      for (const item of evidence) {
        pushFinding(crm, "HubSpot", { ...item, confidence: "medium" }, {
          productScope: "hubspot_platform",
          caveat:
            "A HubSpot-hosted domain may be CMS, Marketing Hub, CRM, or another HubSpot product.",
        });
        pushFinding(marketing, "HubSpot", item, {
          productScope: "hubspot_content_or_marketing",
          caveat:
            "The CNAME proves HubSpot hosting but not a specific licensed Hub.",
        });
      }
    } else if (service.provider === "Adobe Marketo") {
      for (const item of evidence) {
        pushFinding(marketing, "Adobe Marketo Engage", item, {
          productScope: "landing_pages_or_email_tracking",
          caveat:
            "This is a product-specific Marketo landing-page or tracking-domain pattern.",
        });
      }
    } else if (service.provider === "Salesforce Pardot") {
      for (const item of evidence) {
        pushFinding(marketing, "Salesforce Account Engagement (Pardot)", item, {
          productScope: "tracker_domain",
          caveat: "This is a product-specific Account Engagement tracker domain.",
        });
        pushFinding(
          crm,
          "Salesforce",
          {
            ...item,
            inferred: true,
            inferredFrom: "Salesforce Account Engagement (Pardot)",
            interpretation:
              "Account Engagement configuration is provisioned through Salesforce CRM and is used here as a CRM inference.",
          },
          {
            productScope: "salesforce_crm_inferred_from_marketing_products",
            caveat:
              "This is a Salesforce CRM inference from Account Engagement configuration. It does not prove active Sales Cloud seats or recent CRM usage.",
          },
        );
      }
    } else if (service.provider === "Oracle Eloqua") {
      for (const item of evidence) {
        pushFinding(marketing, "Oracle Eloqua", item, {
          productScope: "landing_pages_or_tracking",
          caveat: "This is an Eloqua-hosted branded domain.",
        });
      }
    } else if (service.provider === "Customer.io") {
      for (const item of evidence) {
        pushFinding(marketing, "Customer.io", item, {
          productScope: "customer_messaging",
          caveat: "This is a Customer.io branded sending or tracking domain.",
        });
      }
    } else if (service.provider === "Act-On") {
      for (const item of evidence) {
        pushFinding(marketing, "Act-On", item, {
          productScope: "marketing_domain",
          caveat:
            "This is an Act-On-hosted marketing, landing-page, or tracking domain.",
        });
      }
    } else if (service.provider === "Iterable") {
      for (const item of evidence) {
        pushFinding(marketing, "Iterable", item, {
          productScope: "link_tracking",
          caveat: "This is an Iterable-hosted link-tracking domain.",
        });
      }
    } else if (service.provider === "Unbounce") {
      for (const item of evidence) {
        pushFinding(marketing, "Unbounce", item, {
          productScope: "landing_pages",
          caveat: "This is an Unbounce-hosted landing-page domain.",
        });
      }
    } else if (service.provider === "Klaviyo") {
      for (const item of evidence) {
        pushFinding(marketing, "Klaviyo", item, {
          productScope: "branded_sending_domain",
          caveat: "This is a Klaviyo-hosted sending-domain CNAME.",
        });
      }
    } else if (service.provider === "Salesforce Marketing Cloud Engagement") {
      for (const item of evidence) {
        pushFinding(
          marketing,
          "Salesforce Marketing Cloud Engagement",
          item,
          {
            productScope: "marketing_cloud_content_or_cloudpages",
            caveat:
              "This is Salesforce Marketing Cloud-hosted content or CloudPages configuration, not proof of a particular edition, seats, or recent campaign activity.",
          },
        );
        pushFinding(
          crm,
          "Salesforce",
          {
            ...item,
            confidence: "medium",
            inferred: true,
            inferredFrom: "Salesforce Marketing Cloud Engagement",
            interpretation:
              "Marketing Cloud Engagement configuration establishes a Salesforce customer relationship and is used here as a CRM inference.",
          },
          {
            productScope: "salesforce_crm_inferred_from_marketing_products",
            caveat:
              "This is a Salesforce CRM inference from Marketing Cloud Engagement configuration. It does not directly prove Sales Cloud, active CRM seats, or recent CRM usage.",
          },
        );
      }
    } else if (
      ["SendGrid", "Mailgun", "SMTP2GO", "SparkPost"].includes(
        service.provider,
      )
    ) {
      for (const item of evidence) {
        pushFinding(emailDelivery, service.provider, item, {
          productScope: "branded_email_delivery_or_tracking",
          caveat:
            "This proves public email-delivery configuration, not current message volume or account activity.",
        });
      }
    }
    const genericMap = categoryMaps[service.category];
    const explicitlyProfiled = new Set([
      "Salesforce",
      "Microsoft Dynamics 365",
      "HubSpot",
      "Adobe Marketo",
      "Salesforce Pardot",
      "Oracle Eloqua",
      "Customer.io",
      "Act-On",
      "Iterable",
      "Unbounce",
      "Klaviyo",
      "Salesforce Marketing Cloud Engagement",
      "SendGrid",
      "Mailgun",
      "SMTP2GO",
      "SparkPost",
    ]);
    if (genericMap && !explicitlyProfiled.has(service.provider)) {
      for (const item of evidence) {
        pushFinding(genericMap, service.provider, item, {
          productScope: service.category,
          caveat:
            "The public CNAME proves product infrastructure is configured, not that the product is actively used today.",
        });
      }
    }
  }

  for (const provider of technologySignals.authorizedEmailSenders) {
    if (provider === "Salesforce") {
      pushFinding(crm, "Salesforce", spfEvidence(provider), {
        productScope: "salesforce_email_sending",
        caveat:
          "SPF proves Salesforce sending authorization, not necessarily Sales Cloud.",
      });
    } else if (provider === "HubSpot") {
      pushFinding(crm, "HubSpot", spfEvidence(provider), {
        productScope: "hubspot_email_sending",
        caveat:
          "SPF proves HubSpot sending authorization, not necessarily HubSpot CRM.",
      });
      pushFinding(marketing, "HubSpot", {
        ...spfEvidence(provider),
        confidence: "medium",
      }, {
        productScope: "hubspot_email_sending",
        caveat: "This is evidence of HubSpot-managed email sending.",
      });
    } else if (provider === "Adobe Marketo") {
      pushFinding(marketing, "Adobe Marketo Engage", {
        ...spfEvidence(provider),
        confidence: "medium",
      }, {
        productScope: "email_sending",
        caveat: "SPF authorization can remain after a product is retired.",
      });
    } else if (provider === "Mailchimp") {
      pushFinding(marketing, "Mailchimp", {
        ...spfEvidence(provider),
        confidence: "medium",
      }, {
        productScope: "email_marketing",
        caveat: "SPF authorization can remain after a product is retired.",
      });
    } else if (provider === "Act-On") {
      pushFinding(marketing, "Act-On", {
        ...spfEvidence(provider),
        confidence: "medium",
      }, {
        productScope: "email_sending",
        caveat: "SPF authorization can remain after a product is retired.",
      });
    } else if (
      [
        "Brevo",
        "Campaign Monitor",
        "MailerLite",
        "Salesforce Pardot",
      ].includes(provider)
    ) {
      pushFinding(
        marketing,
        provider === "Salesforce Pardot"
          ? "Salesforce Account Engagement (Pardot)"
          : provider,
        { ...spfEvidence(provider), confidence: "medium" },
        {
          productScope: "email_marketing_sending",
          caveat:
            "SPF authorization is useful sending evidence but can remain after a product is retired.",
        },
      );
    }
    if (
      [
        "SendGrid",
        "Mailgun",
        "Amazon SES",
        "SparkPost",
        "Brevo",
        "MailChannels",
        "Email Signatures 365",
      ].includes(provider)
    ) {
      pushFinding(emailDelivery, provider, spfEvidence(provider), {
        productScope: "email_sending",
        caveat:
          "SPF authorization permits sending but can remain after a service is retired.",
      });
    }
  }

  for (const finding of technologySignals.delegatedServices ?? []) {
    const evidence = nameserverEvidence(finding);
    if (finding.category === "marketing_automation") {
      pushFinding(marketing, finding.provider, evidence, {
        productScope: "delegated_sending_subdomain",
        caveat:
          "Delegation is strong configuration evidence but can remain after a service is retired.",
      });
    }
  }

  for (const finding of technologySignals.dkimServices ?? []) {
    pushFinding(
      emailDelivery,
      finding.provider,
      {
        type: "dkim_cname",
        confidence: finding.confidence,
        relationship: "platform_configuration",
        target: finding.target,
        interpretation:
          "A DKIM selector points to vendor-attributable signing infrastructure.",
      },
      {
        productScope: "dkim_signing",
        caveat:
          "A published key can remain after a sender is retired and does not expose message volume.",
      },
    );
  }

  for (const finding of context.salesEngagement ?? []) {
    for (const item of finding.evidence ?? [finding]) {
      pushFinding(
        salesEngagement,
        finding.provider,
        {
          type: item.signalType ?? "tracking_cname",
          confidence: item.confidence ?? finding.confidence,
          relationship: item.relationship ?? "platform_configuration",
          hostname: item.hostname,
          target: item.target,
        },
        {
          productScope: "sales_engagement_tracking",
          caveat:
            "Tracking-domain configuration is strong setup evidence, but does not prove active seats or recent sequence activity.",
        },
      );
    }
  }

  const profile = {
    aiWorkspaces: [...ai.values()],
    crm: [...crm.values()],
    marketingAutomation: [...marketing.values()],
    emailDelivery: [...emailDelivery.values()],
    salesEngagement: [...salesEngagement.values()],
    advertisingAndAbm: [...advertisingAndAbm.values()],
    customerData: [...customerData.values()],
    productAnalytics: [...productAnalytics.values()],
    customerSupport: [...customerSupport.values()],
    customerSuccessAndEducation: [...customerSuccessAndEducation.values()],
    eventsAndWebinars: [...eventsAndWebinars.values()],
    meetingIntelligence: [...meetingIntelligence.values()],
    commerceAndPayments: [...commerceAndPayments.values()],
    businessSoftware: [...businessSoftware.values()],
    websiteAndContent: [...websiteAndContent.values()],
    brandAndCreative: [...brandAndCreative.values()],
    identityAndAccess: [...identityAndAccess.values()],
  };
  return {
    ...profile,
    inferenceGraph: buildTechnologyInferenceGraph(
      technologySignals,
      context,
    ),
  };
}
