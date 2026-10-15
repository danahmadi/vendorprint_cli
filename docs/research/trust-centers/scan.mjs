// Supplemental DNS-only trust-center pass. No HTTP requests to company sites.
import { Resolver } from 'node:dns/promises';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const output = process.argv[2];
if (!output) throw new Error('Usage: node scan.mjs output.json');
const cohort = JSON.parse(await readFile(new URL('../enterprise-discovery/cohort.json', import.meta.url)));
const labels = ['trust', 'security', 'trustcenter'];
// Fixed before querying the cohort. Other targets remain exploratory leads.
const candidates = [
  { provider: 'Vanta', suffix: 'cname.vantatrust.com' },
  { provider: 'SafeBase', suffix: 'portals.safebase.io' },
];
const resolver = new Resolver({ timeout: 3000, tries: 1 });
const startedAt = new Date().toISOString();
let queries = 0;
let cursor = 0;
const results = [];
async function query(hostname) {
  queries++;
  await new Promise(resolve => setTimeout(resolve, 100));
  try { return { hostname, targets: (await resolver.resolveCname(hostname)).map(x => x.toLowerCase().replace(/\.$/, '')), error: null }; }
  catch (e) { return { hostname, targets: [], error: ['ENODATA', 'ENOTFOUND'].includes(e.code) ? null : e.code }; }
}
async function worker() {
  while (cursor < cohort.rows.length) {
    const row = cohort.rows[cursor++];
    const wildcard = await query(`vp-trust-${createHash('sha256').update(row.domain).digest('hex').slice(0, 10)}.${row.domain}`);
    const observations = [];
    for (const label of labels) {
      const first = await query(`${label}.${row.domain}`);
      const chain = [first];
      const seen = new Set([first.hostname]);
      // Follow a single bounded CNAME path; preserve all answers at each hop.
      while (chain.length < 3 && chain.at(-1).targets.length === 1) {
        const next = chain.at(-1).targets[0];
        if (seen.has(next)) break;
        seen.add(next);
        chain.push(await query(next));
      }
      const wildcardLike = first.targets.some(x => wildcard.targets.includes(x));
      observations.push({ hostname: first.hostname, chain, wildcardLike,
        providers: wildcardLike ? [] : candidates.filter(c => chain.some(h => h.targets.some(t => t === c.suffix || t.endsWith('.' + c.suffix)))).map(c => c.provider) });
    }
    results.push({ domain: row.domain, split: row.split, wildcard, observations });
    if (results.length % 100 === 0) console.log(JSON.stringify({ completed: results.length, queries }));
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
results.sort((a, b) => a.domain.localeCompare(b.domain));
await writeFile(output, JSON.stringify({ startedAt, completedAt: new Date().toISOString(), labels, candidates, queries,
  methodology: '1,000 existing cohort domains; native DNS, 8 sequential workers, >=100ms between queries per worker, 3 CNAME queries per label maximum plus one wildcard control. The previous split is descriptive, not independently labelled ground truth. Only Vanta and SafeBase candidates fixed before this supplemental pass.', results }, null, 2) + '\n');
console.log(JSON.stringify({ completed: results.length, queries, output }));
