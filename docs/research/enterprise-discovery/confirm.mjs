import { readFile, writeFile } from 'node:fs/promises';
import { createDohResolver } from '../../../src/doh-resolver.mjs';
const input = process.argv[2];
if (!input) throw new Error('Usage: node confirm.mjs /path/to/findings.ndjson');
const cohort = JSON.parse(await readFile(new URL('cohort.json', import.meta.url)));
const candidates = JSON.parse(await readFile(new URL('candidates.json', import.meta.url))).candidates;
const discovery = new Set(cohort.rows.filter(x => x.split === 'discovery').map(x => x.domain));
const rows=(await readFile(input,'utf8')).trim().split('\n').flatMap(line=>{try{const e=JSON.parse(line);return e.type==='result'&&discovery.has(e.result.domain)?[e.result]:[];}catch{return[];}});
const dns=createDohResolver({timeoutMs:5000});const results=[];
for(const c of candidates){
 const targets=[];
 for(const r of rows){
  if(c.family==='verification' && r.technologySignals.unmatchedTxtPrefixes?.includes(c.prefix))targets.push({domain:r.domain,hostname:r.domain,type:'TXT'});
  if(c.family==='cname')for(const o of r.salesEngagement.observedCnames??[])if(!o.wildcardLike&&o.targets.some(t=>t===c.suffix||t.endsWith('.'+c.suffix)))targets.push({domain:r.domain,hostname:o.hostname,type:'CNAME'});
  if(c.family==='spf' && [...r.mail.spf.includes,...r.mail.spf.redirects].includes(c.exact))targets.push({domain:r.domain,hostname:r.domain,type:'TXT'});
 }
 const seen=new Set();const selected=targets.filter(x=>!seen.has(x.domain)&&seen.add(x.domain)).slice(0,3);
 for(const target of selected){
  await new Promise(r=>setTimeout(r,200));
  try{const values=await dns[target.type==='TXT'?'resolveTxt':'resolveCname'](target.hostname);
   const matched=c.family==='verification'?values.some(parts=>new RegExp('^'+c.prefix+'\\s*=\\s*\\S+','i').test(parts.join('').trim())):c.family==='spf'?values.some(parts=>parts.join('').includes('include:'+c.exact)):values.some(t=>t===c.suffix||t.endsWith('.'+c.suffix));
   results.push({provider:c.provider,family:c.family,...target,matched,observedAt:new Date().toISOString(),resolver:'Google DNS-over-HTTPS',...(c.prefix?{prefix:c.prefix}:{}),...(target.type==='CNAME'?{targets:values}:{})});
  }catch(error){results.push({provider:c.provider,family:c.family,...target,matched:false,error:error.code??error.message});}
 }
}
await writeFile(new URL('confirmations.json',import.meta.url),JSON.stringify({privacy:'TXT values are tested only in memory; never persisted.',results},null,2)+'\n');
console.log(JSON.stringify({queries:results.length,matched:results.filter(x=>x.matched).length,failed:results.filter(x=>!x.matched)}));
