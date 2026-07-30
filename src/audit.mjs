import { getDomain } from "tldts";
import {
  detectCnameTechnology,
  detectSalesVendor,
  parseSpf,
} from "./signals.mjs";
import {
  SIGNATURE_REGISTRY,
  findHostSignature,
} from "./signature-registry.mjs";

function rowsFromDocument(document) {
  if (Array.isArray(document?.results)) return document.results;
  if (Array.isArray(document?.findings)) return document.findings;
  if (document?.type === "result") {
    return [document.result ?? document.finding].filter(Boolean);
  }
  return [];
}

export function parseScanDocuments(value) {
  const text = String(value).trim();
  if (!text) return [];
  try {
    return [JSON.parse(text)];
  } catch {
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          throw new Error(
            `Invalid JSON or NDJSON at line ${index + 1}: ${error.message}`,
          );
        }
      });
  }
}

function increment(map, key) {
  if (key) map.set(key, (map.get(key) ?? 0) + 1);
}

function ranked(map) {
  return [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

export function auditScanDocuments(documents) {
  const unknownTxt = new Map();
  const unknownCname = new Map();
  const unknownSpf = new Map();
  const unknownDkim = new Map();
  const unknownDelegatedNs = new Map();
  let domains = 0;

  for (const document of documents) {
    for (const row of rowsFromDocument(document)) {
      domains += 1;
      for (const finding of
        row.technologySignals?.unclassifiedDomainVerifications ??
        row.infrastructure?.unclassifiedDomainVerifications ??
        []) {
        const nowClassified = SIGNATURE_REGISTRY.verification.some(
          ({ pattern }) => pattern.test(`${finding.recordPrefix}=redacted`),
        );
        if (!nowClassified) increment(unknownTxt, finding.recordPrefix);
      }
      for (const observation of row.salesEngagement?.observedCnames ?? []) {
        for (const target of observation.targets ?? []) {
          if (
            !detectSalesVendor(observation.hostname, target) &&
            !detectCnameTechnology(observation.hostname, target)
          ) {
            increment(unknownCname, getDomain(target) ?? target);
          }
        }
      }
      const spf =
        row.mail?.spf ??
        (row.rawDns?.txt ? parseSpf(row.rawDns.txt) : { includes: [], redirects: [] });
      for (const host of [...(spf.includes ?? []), ...(spf.redirects ?? [])]) {
        if (!findHostSignature(host, "spf")) increment(unknownSpf, host);
      }
      for (const selector of row.mail?.observedDkimSelectors ?? []) {
        for (const target of selector.type === "CNAME" ? selector.value ?? [] : []) {
          if (!findHostSignature(target, "dkim")) {
            increment(unknownDkim, getDomain(target) ?? target);
          }
        }
      }
      for (const delegation of row.dns?.delegatedNameservers ?? []) {
        for (const host of delegation.nameservers ?? []) {
          if (!findHostSignature(host, "delegatedNs")) {
            increment(unknownDelegatedNs, getDomain(host) ?? host);
          }
        }
      }
    }
  }

  return {
    schemaVersion: "1.0",
    privacy:
      "Aggregates unmatched signatures only. Domain names and verification tokens are not emitted.",
    domainsAudited: domains,
    candidates: {
      txtRecordPrefixes: ranked(unknownTxt),
      cnameTargetDomains: ranked(unknownCname),
      spfMechanisms: ranked(unknownSpf),
      dkimTargetDomains: ranked(unknownDkim),
      delegatedNameserverDomains: ranked(unknownDelegatedNs),
    },
  };
}
