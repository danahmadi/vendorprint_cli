const CONFIDENCE_ORDER = { low: 1, medium: 2, high: 3 };

function strongestConfidence(left, right) {
  return CONFIDENCE_ORDER[right] > CONFIDENCE_ORDER[left] ? right : left;
}

function cnameBasis(service) {
  return service.evidence.map((item) => ({
    provider: service.provider,
    signalType: "cname",
    confidence: item.confidence,
    hostname: item.hostname,
    target: item.target,
  }));
}

function verificationBasis(finding) {
  return {
    provider: finding.provider,
    signalType: "txt_domain_verification",
    confidence: finding.confidence,
    recordPrefix: finding.recordPrefix,
  };
}

function salesEngagementBasis(finding) {
  return finding.evidence.map((item) => ({
    provider: finding.provider,
    signalType: "tracking_cname",
    confidence: item.confidence,
    hostname: item.hostname,
    target: item.target,
  }));
}

function addInference(map, inference) {
  const key = `${inference.category}:${inference.provider}`;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, inference);
    return;
  }
  existing.confidence = strongestConfidence(
    existing.confidence,
    inference.confidence,
  );
  existing.ruleIds = [...new Set([...existing.ruleIds, ...inference.ruleIds])];
  existing.basis.push(...inference.basis);
  existing.rationales = [
    ...new Set([...existing.rationales, ...inference.rationales]),
  ];
  existing.caveats = [
    ...new Set([...existing.caveats, ...inference.caveats]),
  ];
}

function findService(technologySignals, provider) {
  return technologySignals.cnameServices.find(
    (service) => service.provider === provider,
  );
}

function findVerification(technologySignals, provider) {
  return technologySignals.domainVerifications.find(
    (finding) => finding.provider === provider,
  );
}

function directCrmEvidence(technologySignals, options = {}) {
  const findings = [];
  const salesforceService = findService(technologySignals, "Salesforce");
  const salesforceVerification = findVerification(
    technologySignals,
    "Salesforce",
  );
  const dynamicsService = findService(
    technologySignals,
    "Microsoft Dynamics 365",
  );
  const hubspotService = findService(technologySignals, "HubSpot");

  if (salesforceService) {
    findings.push({
      provider: "Salesforce",
      confidence: "high",
      basis: cnameBasis(salesforceService),
    });
  } else if (salesforceVerification) {
    findings.push({
      provider: "Salesforce",
      confidence: "medium",
      basis: [verificationBasis(salesforceVerification)],
    });
  }
  if (dynamicsService) {
    findings.push({
      provider: "Microsoft Dynamics 365",
      confidence: "high",
      basis: cnameBasis(dynamicsService),
    });
  }
  if (options.includeHubSpot && hubspotService) {
    findings.push({
      provider: "HubSpot",
      confidence: "medium",
      basis: cnameBasis(hubspotService),
    });
  }
  return findings;
}

function overlayCorroboration(baseCandidates, corroboratingCrm) {
  const byProvider = new Map(
    corroboratingCrm.map((finding) => [finding.provider, finding]),
  );
  return baseCandidates.map((provider) => {
    const finding = byProvider.get(provider);
    return finding
      ? {
          provider,
          corroborated: true,
          observedConfidence: finding.confidence,
        }
      : { provider, corroborated: false };
  });
}

export function buildTechnologyInferenceGraph(
  technologySignals,
  context = {},
) {
  const inferred = new Map();
  const candidateSets = [];
  const salesEngagement = context.salesEngagement ?? [];
  const pardot = findService(technologySignals, "Salesforce Pardot");
  const marketingCloud = findService(
    technologySignals,
    "Salesforce Marketing Cloud Engagement",
  );
  const hubspot = findService(technologySignals, "HubSpot");
  const marketo = findService(technologySignals, "Adobe Marketo");
  const powerPages = findService(technologySignals, "Microsoft Power Pages");

  if (pardot) {
    addInference(inferred, {
      category: "crm",
      provider: "Salesforce",
      confidence: "high",
      inferenceType: "suite_dependency",
      directlyObserved: false,
      ruleIds: ["pardot_implies_salesforce_crm"],
      basis: cnameBasis(pardot),
      rationales: [
        "Salesforce Account Engagement is provisioned and synchronized through a Salesforce CRM organization.",
      ],
      caveats: [
        "The DNS record can be stale and does not prove active Sales Cloud seats or recent CRM usage.",
      ],
    });
  }

  if (marketingCloud) {
    addInference(inferred, {
      category: "crm",
      provider: "Salesforce",
      confidence: "medium",
      inferenceType: "suite_relationship",
      directlyObserved: false,
      ruleIds: ["sfmc_implies_salesforce_crm"],
      basis: cnameBasis(marketingCloud),
      rationales: [
        "Marketing Cloud Engagement establishes a Salesforce customer relationship and is commonly connected to Sales or Service Cloud.",
      ],
      caveats: [
        "Marketing Cloud Engagement can operate without Marketing Cloud Connect, so this does not directly prove Sales Cloud or Service Cloud.",
      ],
    });
  }

  if (hubspot) {
    addInference(inferred, {
      category: "crm",
      provider: "HubSpot",
      confidence: "medium",
      inferenceType: "platform_relationship",
      directlyObserved: false,
      ruleIds: ["hubspot_hosting_implies_hubspot_platform"],
      basis: cnameBasis(hubspot),
      rationales: [
        "HubSpot-hosted marketing or content infrastructure establishes a HubSpot customer-platform relationship.",
      ],
      caveats: [
        "The DNS target does not identify whether teams actively use HubSpot CRM, Marketing Hub, CMS Hub, or another Hub.",
      ],
    });
  }

  if (powerPages) {
    addInference(inferred, {
      category: "data_platform",
      provider: "Microsoft Dataverse",
      confidence: "high",
      inferenceType: "platform_dependency",
      directlyObserved: false,
      ruleIds: ["power_pages_requires_dataverse"],
      basis: cnameBasis(powerPages),
      rationales: [
        "Microsoft Power Pages uses Dataverse for site metadata and business data.",
      ],
      caveats: [
        "Dataverse can support Power Platform applications without Dynamics 365 Sales.",
      ],
    });
    candidateSets.push({
      subject: "power_pages_business_application",
      category: "crm",
      confidence: "low",
      exhaustive: false,
      candidates: [
        { provider: "Microsoft Dynamics 365", corroborated: false },
        { provider: "Custom Power Platform application", corroborated: false },
        { provider: "No Dynamics CRM", corroborated: false },
      ],
      basis: cnameBasis(powerPages),
      rationale:
        "Power Pages proves Dataverse, but the backing business application is not exposed in public DNS.",
    });
  }

  if (marketo) {
    const corroboratingCrm = directCrmEvidence(technologySignals);
    const candidates = overlayCorroboration(
      [
        "Salesforce",
        "Microsoft Dynamics 365",
        "Veeva CRM (Salesforce platform)",
        "Other or no native CRM",
      ],
      corroboratingCrm,
    );
    candidateSets.push({
      subject: "marketo_crm_connector",
      category: "crm",
      confidence: corroboratingCrm.length ? "medium" : "low",
      exhaustive: false,
      candidates,
      basis: [
        ...cnameBasis(marketo),
        ...corroboratingCrm.flatMap((finding) => finding.basis),
      ],
      rationale: corroboratingCrm.length
        ? "Independent CRM DNS evidence prioritizes a Marketo connector candidate, but other candidates remain possible because co-presence does not prove integration."
        : "Marketo supports native Salesforce, Microsoft Dynamics, and Veeva connectors and can also operate without a native CRM connection.",
    });
  }

  if (salesEngagement.length > 0) {
    const corroboratingCrm = directCrmEvidence(technologySignals, {
      includeHubSpot: true,
    });
    candidateSets.push({
      subject: "sales_engagement_crm",
      category: "crm",
      confidence: corroboratingCrm.length ? "medium" : "low",
      exhaustive: false,
      candidates: overlayCorroboration(
        [
          "Salesforce",
          "Microsoft Dynamics 365",
          "HubSpot",
          "Other or no connected CRM",
        ],
        corroboratingCrm,
      ),
      basis: [
        ...salesEngagement.flatMap(salesEngagementBasis),
        ...corroboratingCrm.flatMap((finding) => finding.basis),
      ],
      rationale: corroboratingCrm.length
        ? "Independent CRM DNS evidence prioritizes the likely system paired with the observed sales-engagement platform; other candidates remain possible and the integration is not directly observed."
        : "Sales-engagement platforms commonly connect to a CRM, but their tracking CNAME does not expose which CRM is connected.",
    });
  }

  return {
    version: "1.0",
    inferred: [...inferred.values()],
    candidateSets,
  };
}
