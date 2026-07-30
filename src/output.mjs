export function compactResult(result) {
  return {
    domain: result.domain,
    status: result.status,
    email: {
      provider: result.mail.provider,
      confidence: result.mail.confidence,
      securityGateways: result.mail.gateways,
    },
    infrastructure: {
      dnsProvider: result.technologySignals.dnsProvider,
      domainVerifications: result.technologySignals.domainVerifications,
      ...(result.technologySignals.unclassifiedDomainVerifications
        ? {
            unclassifiedDomainVerifications:
              result.technologySignals.unclassifiedDomainVerifications,
          }
        : {}),
      authorizedEmailSenders:
        result.technologySignals.authorizedEmailSenders,
      dmarcMonitoringServices:
        result.technologySignals.dmarcMonitoringServices,
      delegatedServices: result.technologySignals.delegatedServices,
      dkimServices: result.technologySignals.dkimServices,
      cnameServices: result.technologySignals.cnameServices,
    },
    querySafety: result.querySafety,
    cnameDiagnostics: {
      wildcardLikeTargets:
        result.salesEngagement.wildcardLikeCnameTargets,
      observationsCollapsedAsWildcardLike:
        result.salesEngagement.observationsCollapsedAsWildcardLike,
    },
    technologyProfile: result.technologyProfile,
    technologyFingerprint: result.technologyFingerprint,
    salesEngagement: {
      status: result.salesEngagement.status,
      detected: result.salesEngagement.detected,
    },
  };
}

export function compactReport(report) {
  return {
    schemaVersion: report.schemaVersion,
    signatureCatalogVersion: report.signatureCatalogVersion,
    generatedAt: report.generatedAt,
    durationMs: report.durationMs,
    methodology: report.methodology,
    summary: report.summary,
    invalidInputs: report.invalidInputs,
    findings: report.results.map(compactResult),
  };
}

export function compactEvent(event) {
  if (event.type !== "result") return event;
  return {
    type: "result",
    index: event.index,
    finding: compactResult(event.result),
  };
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
