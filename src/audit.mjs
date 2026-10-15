import { getDomain } from "tldts";
import {
  detectCnameTechnology,
  detectSalesVendor,
  parseSpf,
  classifyMx,
  extractUnmatchedTxtPrefixes,
} from "./signals.mjs";
import { findHostSignature } from "./signature-registry.mjs";

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

function ranked(map) {
  return [...map.entries()]
    .map(([value, domains]) => ({ value, count: domains.size }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

export function auditScanDocuments(documents) {
  const buckets = Object.fromEntries([
    "txtRecordPrefixes", "cnameTargetDomains", "spfMechanisms",
    "dkimTargetDomains", "delegatedNameserverDomains", "mxTargetDomains",
  ].map(key => [key, new Map()]));
  const domains = new Set();
  let rowsWithoutDomain = 0;
  let rowsWithoutDiagnostics = 0;
  for (const document of documents) {
    for (const row of rowsFromDocument(document)) {
      const domain = typeof row.domain === "string"
        ? row.domain.trim().toLowerCase().replace(/\.$/, "") : "";
      if (!domain) { rowsWithoutDomain++; continue; }
      const account = getDomain(domain, { allowPrivateDomains: true }) ?? domain;
      domains.add(account);
      if (!row.salesEngagement?.observedCnames && !row.technologySignals && !row.rawDns) {
        rowsWithoutDiagnostics++;
      }
      const add = (bucket, value, host = false) => {
        if (typeof value !== "string" || !value) return;
        value = value.trim().toLowerCase().replace(/\.$/, "");
        if (!value) return;
        if (host) {
          // Aggregate at the registrable domain and suppress first-party targets.
          // Tenant labels and scanned account names do not belong in this report.
          // SPF macros are not expanded without a mail transaction. Strip macro
          // labels for aggregation only, retaining the literal vendor suffix.
          if (getDomain(value, { allowPrivateDomains: true }) === account) return;
          const labels = value.replace(/%\{[^}]+\}/g, "macro").split(".");
          while (labels.length && !/^[a-z0-9_-]+$/.test(labels[0])) labels.shift();
          value = getDomain(labels.join("."));
          if (!value) return;
          if (value === account || value === domain) return;
        }
        if (!buckets[bucket].has(value)) buckets[bucket].set(value, new Set());
        buckets[bucket].get(value).add(account);
      };
      const prefixes = [
        ...(row.technologySignals?.unmatchedTxtPrefixes ?? []),
        ...(row.technologySignals?.unclassifiedDomainVerifications ??
          row.infrastructure?.unclassifiedDomainVerifications ?? []).map(x => x.recordPrefix),
        ...(row.rawDns?.txt ? extractUnmatchedTxtPrefixes(row.rawDns.txt) : []),
      ];
      for (const prefix of prefixes) {
        // Apply the same redaction constraints to old scan files as live scans.
        for (const safe of extractUnmatchedTxtPrefixes([[`${prefix}=redacted`]])) {
          add("txtRecordPrefixes", safe);
        }
      }
      for (const observation of row.salesEngagement?.observedCnames ?? []) {
        for (const target of observation.targets ?? []) {
          if (!detectSalesVendor(observation.hostname, target) &&
              !detectCnameTechnology(observation.hostname, target)) {
            add("cnameTargetDomains", target, true);
          }
        }
      }
      const spf = row.mail?.spf ??
        (row.rawDns?.txt ? parseSpf(row.rawDns.txt) : {});
      for (const node of [spf, ...(spf.resolvedIncludes ?? [])]) {
        for (const host of [...(node.includes ?? []), ...(node.redirects ?? [])]) {
          if (!findHostSignature(host, "spf")) add("spfMechanisms", host, true);
        }
      }
      for (const selector of row.mail?.observedDkimSelectors ?? []) {
        for (const target of selector.type === "CNAME" ? selector.value ?? [] : []) {
          if (!findHostSignature(target, "dkim")) add("dkimTargetDomains", target, true);
        }
      }
      for (const delegation of row.dns?.delegatedNameservers ?? []) {
        for (const host of delegation.nameservers ?? []) {
          if (!findHostSignature(host, "delegatedNs")) add("delegatedNameserverDomains", host, true);
        }
      }
      for (const record of row.mail?.mx ?? []) {
        const classification = classifyMx([record]);
        if (classification.provider === "Unknown" && !classification.gateways.length) {
          add("mxTargetDomains", record.exchange, true);
        }
      }
    }
  }
  return {
    schemaVersion: "1.1",
    privacy: "Aggregates unmatched key names and registrable target domains only; TXT values, tenant labels, and first-party targets are omitted.",
    counting: "Each count is distinct scanned registrable domains, deduplicated across records and repeated scan rows. SPF targets are grouped by registrable domain.",
    domainsAudited: domains.size,
    diagnostics: { rowsWithoutDomain, rowsWithoutDiagnostics,
      recommendation: "Use --full --include-unclassified when scanning; compact reports omit discovery evidence." },
    candidates: Object.fromEntries(Object.entries(buckets).map(([key,map]) => [key,ranked(map)])),
  };
}
