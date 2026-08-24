const PROFILE_CATEGORIES = [
  "aiWorkspaces",
  "crm",
  "marketingAutomation",
  "emailDelivery",
  "salesEngagement",
  "advertisingAndAbm",
  "customerData",
  "productAnalytics",
  "customerSupport",
  "customerSuccessAndEducation",
  "eventsAndWebinars",
  "meetingIntelligence",
  "commerceAndPayments",
  "businessSoftware",
  "websiteAndContent",
  "brandAndCreative",
  "identityAndAccess",
  "securityAndCompliance",
  "itServiceManagement",
];

function resultFirstTechnologyProfile(profile = {}) {
  return Object.fromEntries(
    PROFILE_CATEGORIES.filter(
      (category) =>
        Array.isArray(profile[category]) && profile[category].length > 0,
    ).map((category) => [category, profile[category]]),
  );
}

function resultFirstEmail(mail = {}) {
  const securityGateways = Array.isArray(mail.gateways) ? mail.gateways : [];
  const providerFound = !["Unknown", "No MX record", undefined].includes(
    mail.provider,
  );
  if (!providerFound && securityGateways.length === 0) return null;

  return {
    ...(providerFound
      ? {
          provider: mail.provider,
          confidence: mail.confidence,
        }
      : {}),
    ...(securityGateways.length > 0 ? { securityGateways } : {}),
  };
}

export function compactResult(result) {
  const email = resultFirstEmail(result.mail);
  const technologyProfile = resultFirstTechnologyProfile(
    result.technologyProfile,
  );
  const hasTechnologyFindings = Object.keys(technologyProfile).length > 0;

  return {
    domain: result.domain,
    status: result.status,
    ...(email ? { email } : {}),
    technologyProfile,
    ...(!email && !hasTechnologyFindings
      ? {
          interpretation:
            "No attributable public DNS technology signals were found. Absence is inconclusive because DNS cannot enumerate arbitrary subdomains and proxies can hide upstream services.",
        }
      : {}),
  };
}

export function compactReport(report) {
  return {
    schemaVersion: report.schemaVersion,
    generatedAt: report.generatedAt,
    durationMs: report.durationMs,
    summary: report.summary,
    ...(report.invalidInputs.length > 0
      ? { invalidInputs: report.invalidInputs }
      : {}),
    findings: report.results.map(compactResult),
  };
}

export function compactEvent(event) {
  if (event.type === "result") {
    return {
      type: "result",
      index: event.index,
      finding: compactResult(event.result),
    };
  }
  if (event.type === "meta") {
    return {
      type: "meta",
      schemaVersion: event.schemaVersion,
      generatedAt: event.generatedAt,
      summary: event.summary,
      ...(event.invalidInputs.length > 0
        ? { invalidInputs: event.invalidInputs }
        : {}),
    };
  }
  if (event.type === "summary") {
    return {
      type: "summary",
      schemaVersion: event.schemaVersion,
      generatedAt: event.generatedAt,
      durationMs: event.durationMs,
      summary: event.summary,
    };
  }
  return event;
}

export function parseNdjsonCheckpoint(value) {
  const lines = String(value).split(/\r?\n/);
  const completedDomains = new Set();
  let resultEvents = 0;
  let hasSummary = false;
  let trailingPartial = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch (error) {
      const isLastNonemptyLine = lines
        .slice(index + 1)
        .every((candidate) => candidate.trim() === "");
      if (isLastNonemptyLine) {
        trailingPartial = true;
        break;
      }
      throw new Error(
        `Invalid NDJSON checkpoint at line ${index + 1}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    if (event?.type === "result") {
      const domain = event.result?.domain ?? event.finding?.domain;
      if (typeof domain === "string" && domain) {
        completedDomains.add(domain);
        resultEvents += 1;
      }
    } else if (event?.type === "summary") {
      hasSummary = true;
    }
  }

  return {
    completedDomains,
    resultEvents,
    hasSummary,
    trailingPartial,
  };
}
