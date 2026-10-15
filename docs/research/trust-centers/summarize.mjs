import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getDomain } from 'tldts';
const input = process.argv[2];
if (!input) throw new Error('Usage: node summarize.mjs output-from-scan.json');
const raw = await readFile(input);
const scan = JSON.parse(raw);
if (scan.results.length !== 1000 || new Set(scan.results.map(r => r.domain)).size !== 1000) throw new Error('Expected 1,000 unique completed domains');
const candidates = [...scan.candidates, { provider: 'Drata', exact: 'trust.cname.drata.com', exploratory: true }];
const matches = (target, c) => c.exact ? target === c.exact : target === c.suffix || target.endsWith('.' + c.suffix);
const findings = [];
const queue = new Map();
const errors = [];
let wildcardObservations = 0;
for (const row of scan.results) {
  for (const q of [row.wildcard, ...row.observations.flatMap(o => o.chain)]) if (q.error) errors.push({ domain: row.domain, ...q });
  for (const o of row.observations) {
    if (o.wildcardLike) { wildcardObservations++; continue; }
    const matched = candidates.filter(c => o.chain.some(q => q.targets.some(t => matches(t, c))));
    for (const c of matched) findings.push({ domain: row.domain, split: row.split, provider: c.provider, hostname: o.hostname, chain: o.chain });
    if (matched.length) continue;
    for (const target of o.chain[0].targets) {
      const root = getDomain(target, { allowPrivateDomains: true });
      if (!root || root === row.domain) continue;
      const group = queue.get(root) ?? [];
      group.push({ domain: row.domain, hostname: o.hostname, target });
      queue.set(root, group);
    }
  }
}
const unique = rows => new Set(rows.map(x => x.domain)).size;
const counts = candidates.map(c => {
  const rows = findings.filter(f => f.provider === c.provider);
  return { ...c, domains: unique(rows), discovery: unique(rows.filter(x => x.split === 'discovery')), holdout: unique(rows.filter(x => x.split === 'holdout')),
    trustDomains: unique(rows.filter(x => x.hostname.startsWith('trust.'))),
    onlyOtherLabels: unique(rows.filter(x => !rows.some(t => t.domain === x.domain && t.hostname.startsWith('trust.')))) };
});
const result = { startedAt: scan.startedAt, completedAt: scan.completedAt, cohort: '../enterprise-discovery/cohort.json', rawSha256: createHash('sha256').update(raw).digest('hex'),
  methodology: scan.methodology, domains: scan.results.length, queries: scan.queries, labels: scan.labels,
  wildcardObservations, errorQueries: errors.length, errorDomains: unique(errors), detectedDomains: unique(findings), counts, findings, errors };
await writeFile(new URL('results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
await writeFile(new URL('research-queue.json', import.meta.url), JSON.stringify({ caveat: 'Unattributed first-hop external CNAME groups, not inferred vendors. Includes already-known providers and shared infrastructure; requires review.', candidates: [...queue].map(([targetDomain, observations]) => ({ targetDomain, domains: unique(observations), observations })).sort((a,b) => b.domains-a.domains) }, null, 2) + '\n');
console.log(JSON.stringify({ counts, detectedDomains: result.detectedDomains, queries: scan.queries, errors: errors.length, errorDomains: result.errorDomains, wildcardObservations }, null, 2));
