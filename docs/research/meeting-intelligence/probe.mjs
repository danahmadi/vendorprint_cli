import { Resolver } from 'node:dns/promises';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
// Frozen candidate labels from the original pre-upgrade discovery run.
const FROZEN_LABELS = ["track", "tracking", "email-tracking", "click", "clicks", "link", "links", "go", "email", "hello", "engage", "connect", "outreach", "sales", "marketing", "mail", "send", "trk", "info", "pages", "offers", "resources", "learn", "discover", "events", "webinars", "meet", "calendar", "success", "updates", "news", "brand", "crm", "portal", "community", "partners", "customers", "login", "support", "help", "docs", "status", "academy", "training", "autodiscover", "www2", "lp", "gong", "fireflies", "granola", "recordings", "notes", "meetings"];
const root=new URL('./',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('cohort.json',root),'utf8'));
const split=process.argv[2];
if(!['discovery','holdout','support'].includes(split))throw Error('Expected discovery, holdout or support');
const domains=split==='support'?['tavily.com','bosch.com']: [...new Set(manifest.rows.filter(r=>r.split===split).flatMap(r=>[r.domain,...r.alternateDomains]))].sort();
const labels=FROZEN_LABELS;
let nextStart=0;
async function pace(){const now=Date.now(),wait=Math.max(0,nextStart-now);nextStart=Math.max(now,nextStart)+30;await new Promise(r=>setTimeout(r,wait));}
const resolver=new Resolver({timeout:2200,tries:1});
const rows=[];
let writes=Promise.resolve();
async function scan(domain){
 const queries=[];let count=0;
 async function lookup(name,type){if(count>=80)return {name,type,status:'budget_exhausted',values:[]};count++;await pace();try {return {name,type,status:'answered',values:await resolver.resolve(name,type)};}catch(e){return {name,type,status:['ENODATA','ENOTFOUND','ENONAME'].includes(e.code)?'no_answer':'error',code:e.code,values:[]};}}
 function scrubTxt(q){const prefixes=new Set(),spfHosts=new Set();let opaqueCount=0;
  for(const parts of q.values){const value=parts.join('').trim();if(/^v=spf1(?:\s|$)/i.test(value)){prefixes.add('v=spf1');for(const m of value.matchAll(/(?:include:|redirect=)([a-z0-9_.-]+)/gi))spfHosts.add(m[1].toLowerCase());}
  else {const prefix=value.match(/^([a-z][a-z0-9_.-]{0,80})\s*[=:]/i)?.[1];if(prefix&&(/verification|verify|validation/i.test(prefix)||prefix==='MS'))prefixes.add(prefix.toLowerCase());else opaqueCount++;}}
  return {name:q.name,type:'TXT',status:q.status,...(q.code?{code:q.code}:{}),recordCount:q.values.length,prefixes:[...prefixes].sort(),spfHosts:[...spfHosts].sort(),opaqueCount};}
 const txt=scrubTxt(await lookup(domain,'TXT'));queries.push(txt);
 queries.push(await lookup(domain,'NS'));
 const wildcard=`vp-research-${createHash('sha256').update(domain).digest('hex').slice(0,12)}.${domain}`;
 const wild=await lookup(wildcard,'CNAME');queries.push(wild);
 for(const label of labels)queries.push(await lookup(`${label}.${domain}`,'CNAME'));
 const spfQueue=[...txt.spfHosts],visited=new Set([domain]);let spfCount=0;
 while(spfQueue.length&&spfCount<10&&count<80){const name=spfQueue.shift();if(visited.has(name))continue;visited.add(name);const q=scrubTxt(await lookup(name,'TXT'));queries.push(q);spfCount++;spfQueue.push(...q.spfHosts);}
 const targets=[...new Set(queries.filter(q=>q.type==='CNAME'&&q.name!==wildcard).flatMap(q=>q.values).filter(v=>!wild.values.includes(v)))];let chainCount=0;const seen=new Set(queries.map(q=>q.name));
 for(const start of targets){let name=start;for(let hop=0;hop<3&&chainCount<10&&count<80;hop++){if(seen.has(name))break;seen.add(name);const q=await lookup(name,'CNAME');queries.push(q);chainCount++;if(q.values.length!==1)break;name=q.values[0];}}
 const row={domain,observedAt:new Date().toISOString(),split,queryCount:count,spfLookups:spfCount,chainLookups:chainCount,queries};rows.push(row);
 await (writes=writes.then(()=>writeFile(new URL(`${split}-observations.json`,root),JSON.stringify({methodology:{maxQueries:80,labels,transport:'native DNS',globalMinStartGapMs:30,domainConcurrency:4,spfMax:10,chainQueriesMax:10,chainHopsMax:3,scope:'Apex TXT prefixes and NS; fixed CNAME candidates and wildcard control; recursive SPF host references; short CNAME chains. No HTTP requests to customer sites, no CT, no private DNS. TXT values redacted before persistence.'},rows},null,2)+'\n')));
 console.log(JSON.stringify({domain,queries:count,errors:queries.filter(q=>q.status==='error').length,completed:rows.length,total:domains.length}));
}
let cursor=0;await Promise.all(Array.from({length:4},async()=>{while(cursor<domains.length){await scan(domains[cursor++]);}}));
