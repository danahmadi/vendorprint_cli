import {Resolver} from 'node:dns/promises';
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('./',import.meta.url),cohort=JSON.parse(await readFile(new URL('cohort.json',root),'utf8'));
const resolver=new Resolver({timeout:2200,tries:1});const rows=[];
for(const {domain} of cohort.rows){
 let values=[],code=null;try{values=await resolver.resolveTxt(domain)}catch(e){code=e.code}
 const prefixes=values.flatMap(parts=>{const prefix=parts.join('').trim().match(/^([a-z0-9][a-z0-9_.-]{0,80})\s*[=:]/i)?.[1];return prefix&&/verification|verify|validation/i.test(prefix)?[prefix.toLowerCase()]:[]});
 rows.push({domain,observedAt:new Date().toISOString(),status:code??'answered',prefixes:[...new Set(prefixes)].sort()});await new Promise(r=>setTimeout(r,40));
}
await writeFile(new URL('prefix-checks.json',root),JSON.stringify({purpose:'Supplemental apex TXT check supporting digit-prefixed vendor names such as 6sense; values never retained.',queryCount:rows.length,rows},null,2)+'\n');
console.log(JSON.stringify({queries:rows.length,candidates:rows.flatMap(r=>r.prefixes.filter(p=>/6sense|demandbase|engagio|saleswhale/.test(p)).map(prefix=>({domain:r.domain,prefix})))}));
