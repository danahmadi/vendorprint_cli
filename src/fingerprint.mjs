import { createHash } from "node:crypto";

function providers(items = []) {
  return items
    .map((item) => ({
      provider: item.provider,
      confidence: item.confidence,
      relationshipLevel: item.relationshipLevel,
      productScope: item.productScope,
    }))
    .sort((left, right) =>
      `${left.provider}:${left.productScope}`.localeCompare(
        `${right.provider}:${right.productScope}`,
      ),
    );
}

export function fingerprintTechnologyProfile(profile) {
  const canonical = Object.fromEntries(
    Object.entries(profile)
      .filter(([, value]) => Array.isArray(value))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([category, value]) => [category, providers(value)]),
  );
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex")}`;
}

function resultRows(report) {
  if (Array.isArray(report?.results)) return report.results;
  if (Array.isArray(report?.findings)) return report.findings;
  return [];
}

function providerKeys(result) {
  const profile = result.technologyProfile ?? {};
  return new Set(
    Object.entries(profile).flatMap(([category, items]) =>
      Array.isArray(items)
        ? items.map(
            (item) =>
              `${category}:${item.provider}:${item.productScope ?? ""}`,
          )
        : [],
    ),
  );
}

export function diffTechnologyReports(before, after) {
  const beforeRows = new Map(resultRows(before).map((row) => [row.domain, row]));
  const afterRows = new Map(resultRows(after).map((row) => [row.domain, row]));
  const domains = [...new Set([...beforeRows.keys(), ...afterRows.keys()])].sort();
  const changes = [];
  for (const domain of domains) {
    const left = beforeRows.get(domain);
    const right = afterRows.get(domain);
    if (!left) {
      changes.push({ domain, status: "added_domain" });
      continue;
    }
    if (!right) {
      changes.push({ domain, status: "removed_domain" });
      continue;
    }
    const leftKeys = providerKeys(left);
    const rightKeys = providerKeys(right);
    const added = [...rightKeys].filter((key) => !leftKeys.has(key)).sort();
    const removed = [...leftKeys].filter((key) => !rightKeys.has(key)).sort();
    if (added.length || removed.length) {
      changes.push({ domain, status: "technology_changed", added, removed });
    }
  }
  return {
    schemaVersion: "1.0",
    summary: {
      beforeDomains: beforeRows.size,
      afterDomains: afterRows.size,
      changedDomains: changes.length,
    },
    changes,
  };
}
