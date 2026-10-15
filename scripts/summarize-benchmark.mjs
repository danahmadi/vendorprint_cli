import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const PRODUCT_CATEGORIES = new Set(['crm', 'marketingAutomation', 'salesEngagement', 'advertisingAndAbm', 'customerData', 'productAnalytics', 'customerSupport', 'customerSuccessAndEducation', 'eventsAndWebinars', 'meetingIntelligence', 'commerceAndPayments', 'businessSoftware', 'brandAndCreative', 'identityAndAccess', 'securityAndCompliance', 'itServiceManagement', 'aiWorkspaces']);
const MAIL_PROVIDERS = new Set(['Google Workspace', 'Microsoft 365', 'Proton Mail', 'Zoho']);

export function summarizeBenchmark(events, manifest, provenance) {
  const meta = events.find(e => e.type === 'meta');
  const final = events.at(-1);
  const rows = events.filter(e => e.type === 'result').map(e => e.result);
  if (!meta || final?.type !== 'summary' || rows.some(r => !r?.querySafety || !r.technologyProfile)) throw new Error('A complete full-output scan is required');
  const expected = new Set(manifest.rows.map(r => r.domain));
  const observed = new Set(rows.map(r => r.domain));
  if (expected.size !== manifest.rows.length || observed.size !== rows.length || rows.length !== final.summary.scanned) throw new Error('Duplicate domains or incomplete scan');
  const invalid = meta.invalidInputs ?? [];
  if (rows.length + invalid.length !== expected.size || rows.some(r => !expected.has(r.domain)) || invalid.some(r => !expected.has(r.input))) throw new Error('Cohort does not match scan');
  const categories = {};
  const domains = rows.map(r => {
    const profile = Object.entries(r.technologyProfile).filter(([,v]) => Array.isArray(v));
    const findings = profile.flatMap(([,v]) => v);
    const hasMail = !['Unknown','No MX record',undefined].includes(r.mail?.provider) || !!r.mail?.gateways?.length;
    for (const [category, values] of profile) if (values.length) categories[category] = (categories[category] ?? 0) + 1;
    const productConfiguration = profile.some(([category, values]) => PRODUCT_CATEGORIES.has(category) && values.some(v => !MAIL_PROVIDERS.has(v.provider) && v.evidence?.some(e => e.relationship === 'platform_configuration' && ['cname','delegated_nameserver'].includes(e.type) && !e.wildcardLikeCname)));
    return { domain: r.domain, anyVendorFinding: hasMail || findings.length > 0, productConfiguration,
      trustCenter: findings.some(f => /^(vanta|safebase|drata)_trust_center$/.test(f.productScope) && f.evidence?.some(e => !e.wildcardLikeCname)),
      categories: profile.filter(([,v]) => v.length).map(([k]) => k),
      budgetExhausted: !!r.querySafety.budgetExhausted,
      errorCodes: r.dns?.nonAbsenceQueryErrors ?? [],
      queries: r.querySafety.queryAttempts, durationMs: r.durationMs, status: r.status };
  });
  const metric = count => ({ count, denominator: expected.size, percent: Number((count / expected.size * 100).toFixed(1)) });
  const errors = {};
  for (const r of domains) for (const code of new Set(r.errorCodes)) errors[code] = (errors[code] ?? 0) + 1;
  return { schemaVersion: '1.0', cohort: { id: manifest.id, title: manifest.title, source: manifest.source, scope: manifest.scope, attribution: manifest.attribution, license: manifest.license },
    packageVersion: meta.packageVersion ?? provenance.packageVersion, signatureCatalogVersion: meta.signatureCatalogVersion,
    scannerCommit: provenance.scannerCommit, startedAt: meta.generatedAt, durationMs: final.durationMs,
    mode: 'full', dnsTransport: meta.methodology.dnsTransport, certificateTransparency: false,
    requestedDomains: expected.size, scannedDomains: rows.length, invalidInputs: invalid,
    definitions: { denominator: 'All distinct sourced input domains, including invalid inputs and limited/error responses; no silent removal.',
      anyVendorFinding: 'Recognized MX/email-security provider or any categorized profile finding; inferred graph candidates and generic DNS hosting excluded.',
      productConfiguration: 'At least one direct non-wildcard CNAME/delegated-NS platform configuration in a business-product category; general website hosting, email delivery and mail productivity excluded. TXT/SPF alone do not qualify.',
      categoryCoverage: 'At least one categorized finding, including domain relationships and sending authorization. Not precision, recall, active use, or licensed adoption.' },
    metrics: { anyVendorFinding: metric(domains.filter(r => r.anyVendorFinding).length), productConfiguration: metric(domains.filter(r => r.productConfiguration).length), trustCenter: metric(domains.filter(r => r.trustCenter).length),
      categories: Object.fromEntries(Object.entries(categories).map(([k,v]) => [k,metric(v)])) },
    diagnostics: { queryAttempts: domains.reduce((n,r) => n+r.queries,0), budgetExhaustedDomains: domains.filter(r => r.budgetExhausted).length,
      limitedDnsDomains: domains.filter(r => r.status !== 'ok').length, domainsWithErrors: domains.filter(r => r.errorCodes.length).length, errorDomainsByCode: errors }, domains };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [rawPath, manifestPath, output, scannerCommit] = process.argv.slice(2);
  if (!scannerCommit) throw new Error('Usage: node scripts/summarize-benchmark.mjs scan.ndjson cohort.json summary.json scannerCommit');
  const raw = await readFile(rawPath);
  const manifestBytes = await readFile(manifestPath);
  const summary = summarizeBenchmark(raw.toString().trim().split('\n').map(JSON.parse), JSON.parse(manifestBytes), { scannerCommit, packageVersion: '0.4.0' });
  summary.rawSha256 = createHash('sha256').update(raw).digest('hex');
  summary.cohortSha256 = createHash('sha256').update(manifestBytes).digest('hex');
  await writeFile(output, JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({ cohort: summary.cohort.id, metrics: summary.metrics, diagnostics: summary.diagnostics }));
}
