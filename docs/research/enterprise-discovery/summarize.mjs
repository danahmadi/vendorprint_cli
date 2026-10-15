import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { auditScanDocuments } from '../../../src/audit.mjs';
const root=process.argv[2];
if(!root)throw new Error('Usage: node summarize.mjs /path/to/research-run');
const input=await readFile(`${root}/findings.ndjson`,'utf8');
const events=input.trim().split('\n').map(line=>JSON.parse(line));
const results=events.filter(x=>x.type==='result').map(x=>x.result);
if(results.length!==1000||!events.some(x=>x.type==='summary'))throw new Error(`Scan incomplete (${results.length}/1000)`);
const cohort=JSON.parse(await readFile(new URL('cohort.json',import.meta.url)));
const split=new Map(cohort.rows.map(x=>[x.domain,x.split]));
if(new Set(results.map(x=>x.domain)).size!==1000||results.some(x=>!split.has(x.domain)))throw new Error('Cohort mismatch');
const {candidates}=JSON.parse(await readFile(new URL('candidates.json',import.meta.url)));
const stats=candidates.map(c=>{
 const observations=[];
 for(const r of results){
  const base={domain:r.domain,split:split.get(r.domain)};
  if(c.family==='verification'&&r.technologySignals.unmatchedTxtPrefixes?.includes(c.prefix)) observations.push({...base,prefix:c.prefix});
  if(c.family==='cname')for(const o of r.salesEngagement.observedCnames??[])for(const target of o.targets)if(target===c.suffix||target.endsWith('.'+c.suffix))observations.push({...base,hostname:o.hostname,target,wildcardLike:o.wildcardLike});
  if(c.family==='spf')for(const node of [r.mail.spf,...r.mail.spf.resolvedIncludes])if([...node.includes,...node.redirects].includes(c.exact))observations.push({...base,host:node.host??r.domain,include:c.exact});
 }
 const domains=new Set(observations.map(x=>x.domain));
 return {...c,discoveryDomains:[...domains].filter(d=>split.get(d)==='discovery').length,holdoutDomains:[...domains].filter(d=>split.get(d)==='holdout').length,totalDomains:domains.size,observations};
});
const errors={};for(const r of results)for(const code of r.dns.nonAbsenceQueryErrors)errors[code]=(errors[code]??0)+1;
const summary={generatedAt:new Date().toISOString(),scanStartedAt:events[0].generatedAt,cohortDomains:results.length,discoveryDomains:800,holdoutDomains:200,baselineGitCommit:'9ca8ce4253646fb653571b4655d282b99e924133',rawScanSha256:createHash('sha256').update(input).digest('hex'),queries:results.reduce((n,x)=>n+x.querySafety.queryAttempts,0),budgetExhaustedDomains:results.filter(x=>x.querySafety.budgetExhausted).length,limitedDnsDomains:results.filter(x=>x.status!=='ok').map(x=>x.domain),domainsWithNoApexNameservers:results.filter(x=>!x.dns.nameservers.length).map(x=>x.domain),domainsWithNonAbsenceErrorByCode:errors,interpretation:'Counts are distinct domains with matching DNS observations, not verified customer counts, prevalence estimates, precision, recall, completed verification, or paid usage. Source cohort contains historical/acquired brands.',candidates:stats};
await writeFile(new URL('results.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
const {auditScanDocuments:baselineAudit}=await import(pathToFileURL(`${root}/baseline/src/audit.mjs`));
for(const group of ['discovery','holdout','all']){
 const rows=results.filter(x=>group==='all'||split.get(x.domain)===group);
 for(const [name,fn]of [['before',baselineAudit],['after',auditScanDocuments]])await writeFile(new URL(`audit-${group}-${name}.json`,import.meta.url),JSON.stringify(fn([{results:rows}]),null,2)+'\n');
}
console.log(JSON.stringify({...summary,candidates:stats.map(({observations,...x})=>x)},null,2));
