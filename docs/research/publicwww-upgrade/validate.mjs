import {readFile,writeFile} from 'node:fs/promises';
import {Resolver} from 'node:dns/promises';
const base=new URL('../../../../research/',import.meta.url);
const original=JSON.parse(await readFile(new URL('publicwww-2026-10-15/cohort.json',base)));
const supplement=JSON.parse(await readFile(new URL('publicwww-2026-10-15/supplementary-cohort.json',base)));
const exclude=new Set([...original.scanDomains,...supplement.scanDomains]);
const prefixes=['smartsheet-site-validation','dynatrace-site-verification','teamviewer-sso-verification','adobe-sign-verification'];
const documents=(await readFile(new URL('coverage-refresh-2026-10-14/enterprise.ndjson',base),'utf8')).trim().split('\n').map(JSON.parse);
const rows=documents.filter(d=>d.type==='result').map(d=>d.result).filter(r=>!exclude.has(r.domain));
const resolver=new Resolver({timeout:1800,tries:1});
const output=[];
for(const prefix of prefixes){
 const candidates=rows.filter(r=>JSON.stringify(r.technologySignals).includes(prefix)).slice(0,5);
 for(const row of candidates){
  try{const txt=(await resolver.resolveTxt(row.domain)).map(chunks=>chunks.join(''));output.push({domain:row.domain,prefix,present:txt.some(v=>new RegExp('^'+prefix+'\\s*=\\s*\\S+','i').test(v)),observedAt:new Date().toISOString()});}
  catch(e){output.push({domain:row.domain,prefix,error:e.code});}
  await new Promise(r=>setTimeout(r,100));
 }
}
await writeFile(new URL('validation.json',import.meta.url),JSON.stringify({selection:'Up to five domains per prefix from the prior 1000-domain software cohort, excluding all 128 PublicWWW experiment domains. Fresh TXT lookups; token values discarded.',rows:output},null,2)+'\n');
console.log(output);
