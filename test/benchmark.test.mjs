import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBenchmark } from '../scripts/summarize-benchmark.mjs';
const row = (domain, evidence, category = 'securityAndCompliance') => ({ domain, mail: {provider:'Unknown'}, technologyProfile: {[category]: [{provider:'Vanta', productScope:'vanta_trust_center', evidence}]}, querySafety: {queryAttempts: 20}, dns:{nonAbsenceQueryErrors:[]}, status:'ok' });
test('benchmark keeps all sourced domains and separates TXT, wildcard and direct configuration', () => {
  const evidence = {type:'cname',relationship:'platform_configuration'};
  const rows = [row('a.com',[evidence]),row('b.com',[{type:'txt_domain_verification',relationship:'domain_relationship'}]),row('c.com',[{...evidence,wildcardLikeCname:true}]),row('d.com',[evidence],'websiteAndContent')];
  const events = [{type:'meta',generatedAt:'date',signatureCatalogVersion:'test',methodology:{dnsTransport:'native'},invalidInputs:[{input:'invalid'}]}, ...rows.map(result=>({type:'result',result})),{type:'summary',summary:{scanned:4}}];
  const manifest = {rows:[...rows.map(r=>({domain:r.domain})),{domain:'invalid'}]};
  const summary = summarizeBenchmark(events,manifest,{packageVersion:'test',scannerCommit:'test'});
  assert.deepEqual(summary.metrics.productConfiguration,{count:1,denominator:5,percent:20});
  assert.equal(summary.metrics.anyVendorFinding.count,4);
  assert.equal(summary.scannedDomains,4);
  assert.throws(()=>summarizeBenchmark(events.slice(0,-1),manifest,{}),/complete/);
  assert.throws(()=>summarizeBenchmark(events,{rows:[{domain:'a.com'}]},{}),/Cohort/);
});
