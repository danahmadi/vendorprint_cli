import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractDomainVerifications, detectCnameTechnology, parseSpf } from '../src/signals.mjs';
import { buildTechnologyProfile } from '../src/profile.mjs';
import { auditScanDocuments } from '../src/audit.mjs';
const {candidates}=JSON.parse(await readFile(new URL('../docs/research/enterprise-discovery/candidates.json',import.meta.url)));

test('enterprise TXT signatures reject empty and lookalike keys and preserve scoped evidence',()=>{
 for(const c of candidates.filter(x=>x.family==='verification')){
  const positive=extractDomainVerifications([[c.prefix.toUpperCase()+' = ', 'private-test-token']]);
  assert.equal(positive[0]?.provider,c.provider);
  assert.equal(positive[0].productScope,c.productScope);
  assert.equal(positive[0].confidence,'medium');
  for(const text of [c.prefix+'=',c.prefix+'=   ','not-'+c.prefix+'=x',c.prefix+'-other=x','random '+c.prefix+'=x'])assert.equal(extractDomainVerifications([[text]]).length,0,text);
  const profile=buildTechnologyProfile({domainVerifications:positive,authorizedEmailSenders:[],cnameServices:[]});
  const findings=Object.values(profile).flat().filter(x=>x.provider===c.provider);
  assert.equal(findings.length,1);
  assert.equal(findings[0].productScope,c.productScope);
  assert.ok(findings[0].evidence[0].sources.some(s=>s.url===c.url));
  assert.doesNotMatch(JSON.stringify(profile),/private-test-token/);
 }
});

test('Statuspage and Auth0 require vendor hostname boundaries, not a suggestive customer label',()=>{
 for(const c of candidates.filter(x=>x.family==='cname')){
  const target='tenant.'+c.suffix;
  const signal=detectCnameTechnology('login.example.com',target.toUpperCase()+'.');
  assert.equal(signal?.provider,c.provider);
  for(const invalid of [target+'.attacker.test','not'+c.suffix,'proxy.example.net'])assert.equal(detectCnameTechnology('auth0.example.com',invalid),null);
  const profile=buildTechnologyProfile({domainVerifications:[],authorizedEmailSenders:[],cnameServices:[{provider:c.provider,category:c.category,evidence:[signal]}]});
  const finding=Object.values(profile).flat().find(x=>x.provider===c.provider);
  assert.equal(finding.productScope,c.productScope);
  assert.ok(finding.evidence[0].sources.some(s=>s.url===c.url));
 }
 assert.equal(detectCnameTechnology('auth.example.com','unrelated.auth0.com'),null);
});

test('Statuspage SPF identifies notification sending without attributing generic mail delivery to Statuspage',()=>{
 const spf=parseSpf([['v=spf1 include:stspg-customer.com include:mailgun.org ~all']]);
 assert.ok(spf.authorizedSenders.includes('Atlassian Statuspage'));
 assert.ok(!parseSpf([['v=spf1 include:mailgun.org ~all']]).authorizedSenders.includes('Atlassian Statuspage'));
 assert.ok(!parseSpf([['v=spf1 include:stspg-customer.com.attacker.test ~all']]).authorizedSenders.includes('Atlassian Statuspage'));
 const profile=buildTechnologyProfile({domainVerifications:[],authorizedEmailSenders:spf.authorizedSenders,cnameServices:[]});
 const finding=profile.customerSupport.find(x=>x.provider==='Atlassian Statuspage');
 assert.equal(finding.productScope,'statuspage_notification_sending');
 assert.equal(finding.relationshipLevel,'sending_authorization');
 assert.ok(!profile.emailDelivery.some(x=>x.provider==='Atlassian Statuspage'));
});

test('offline audits reclassify historical unknowns using the upgraded catalog',()=>{
 const r=auditScanDocuments([{results:[{domain:'example.com',technologySignals:{unmatchedTxtPrefixes:candidates.filter(x=>x.prefix).map(x=>x.prefix)},salesEngagement:{observedCnames:[{hostname:'status.example.com',targets:['abc.stspg-customer.com']}]},mail:{spf:{includes:['stspg-customer.com']}}}]}]);
 assert.deepEqual(r.candidates.txtRecordPrefixes,[]);
 assert.deepEqual(r.candidates.cnameTargetDomains,[]);
 assert.deepEqual(r.candidates.spfMechanisms,[]);
});
