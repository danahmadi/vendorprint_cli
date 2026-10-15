import test from 'node:test';
import assert from 'node:assert/strict';
import { auditScanDocuments } from '../src/audit.mjs';
import { extractUnmatchedTxtPrefixes } from '../src/signals.mjs';
import { scanDomains } from '../src/scanner.mjs';
import { Resolver } from 'node:dns/promises';

test('unknown TXT keys do not require verification wording and never retain values',()=>{
 const values=[['new-vendor-key=', 'secret-token'],['9vendor: secret-token'],['v=spf1 include:example.net ~all'],['google-site-verification=secret-token'],['opaque-secret-token'],['empty=  '],['a'.repeat(40)+'=value']];
 assert.deepEqual(extractUnmatchedTxtPrefixes(values),['9vendor','new-vendor-key']);
 assert.deepEqual(extractUnmatchedTxtPrefixes([['new-domain-verification-ab12cd=secret'],['new-domain-verification-ef34gh=other'],['service-key.customer.example=secret']]),['new-domain-verification','service-key']);
});

test('SPF macro aggregation retains the vendor suffix without expanding sender data',()=>{
 const r=auditScanDocuments([{results:[{domain:'customer.example',mail:{spf:{includes:['%{i}._ip.%{h}._ehlo.%{d}._spf.vali.email']}}}]}]);
 assert.deepEqual(r.candidates.spfMechanisms,[{value:'vali.email',count:1}]);
 assert.doesNotMatch(JSON.stringify(r),/%\{|customer\.example/);
});

test('independent tenants on private suffixes remain separate accounts',()=>{
 const r=auditScanDocuments([{results:['first.vercel.app','second.vercel.app'].map(domain=>({domain,technologySignals:{unmatchedTxtPrefixes:['new-key']},mail:{mx:[{exchange:'mail.'+domain,priority:10}]}}))}]);
 assert.equal(r.domainsAudited,2);
 assert.deepEqual(r.candidates.txtRecordPrefixes,[{value:'new-key',count:2}]);
 assert.deepEqual(r.candidates.mxTargetDomains,[]);
});

test('audit counts distinct companies across repeated scans and multiple hosts; captures unknown MX and nested SPF',()=>{
 const row={domain:'customer.example',technologySignals:{unmatchedTxtPrefixes:['NEW-VENDOR-KEY'],unclassifiedDomainVerifications:[{recordPrefix:'NEW-VENDOR-KEY'}]},salesEngagement:{observedCnames:[{hostname:'go.customer.example',targets:['a.vendor.test','b.vendor.test','mail.customer.example']}]},mail:{mx:[{exchange:'mx.provider.test',priority:10},{exchange:'aspmx.l.google.com',priority:20},{exchange:'mx2.provider.test',priority:30}],spf:{includes:['spf.mailer.test'],resolvedIncludes:[{includes:['nested.sender.test']}]},observedDkimSelectors:[{type:'CNAME',value:['tenant.dkim.test','other.dkim.test']} ]}};
 const result=auditScanDocuments([{results:[row,row,{...row,domain:'other.example'}]}]);
 assert.equal(result.domainsAudited,2);
 for(const key of ['txtRecordPrefixes','dkimTargetDomains','mxTargetDomains']) assert.equal(result.candidates[key][0].count,2);
 assert.deepEqual(result.candidates.mxTargetDomains,[{value:'provider.test',count:2}]);
 assert.ok(result.candidates.spfMechanisms.some(x=>x.value==='sender.test'&&x.count===2));
 assert.equal(result.candidates.cnameTargetDomains.find(x=>x.value==='vendor.test').count,2);
 const single=auditScanDocuments([{results:[row]}]);
 assert.doesNotMatch(JSON.stringify(single),/customer|secret-token|tenant\./);
});

test('audit suppresses first-party targets, handles mixed known/unknown MX, null MX and compact inputs',()=>{
 const r=auditScanDocuments([{results:[{domain:'Example.com.',mail:{mx:[{exchange:'.',priority:0},{exchange:'mx.example.com',priority:5},{exchange:'mx.unknown.test',priority:10}]}},{domain:'example.com'},{technologyProfile:{}}]}]);
 assert.equal(r.domainsAudited,1);
 assert.deepEqual(r.candidates.mxTargetDomains,[{value:'unknown.test',count:1}]);
 assert.equal(r.diagnostics.rowsWithoutDomain,1);
 assert.equal(r.diagnostics.rowsWithoutDiagnostics,2);
});

test('scanner exposes unmatched keys only in opt-in diagnostics',async(t)=>{
 t.mock.method(Resolver.prototype,'resolveMx',async()=>[]);
 t.mock.method(Resolver.prototype,'resolveNs',async()=>['ns.example.net']);
 t.mock.method(Resolver.prototype,'resolveCname',async()=>[]);
 t.mock.method(Resolver.prototype,'resolveTxt',async(name)=>name==='example.com'?[['novel-key=private-token']]:[]);
 for (const include of [false,true]) {
  const {results:[r]}=await scanDomains(['example.com'],{mode:'fast',includeUnclassifiedVerifications:include});
  assert.deepEqual(r.technologySignals.unmatchedTxtPrefixes,include?['novel-key']:undefined);
  assert.doesNotMatch(JSON.stringify(r),/private-token/);
 }
});
