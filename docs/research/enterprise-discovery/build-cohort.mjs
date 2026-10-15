import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { normalizeDomainInput } from '../../../src/domain.mjs';
import { parse } from 'tldts';
const root = process.argv[2];
if (!root) throw new Error('Usage: node build-cohort.mjs /path/to/source-snapshots');
const excluded = new Set(`birlasoft.com innominds.com guru.com liveops.com glassdoor.com duolingo.com khanacademy.org ableton.com blackmagicdesign.com skillshare.com supportninja.com viber.com auction.com arduino.cc swagbucks.com eclipse.org parse.com joomla.org surfshark.com photobucket.com educba.com classdojo.com shmoop.com engineerbabu.com drupal.org audiokinetic.com alexa.com serif.com leadsports.com venturepact.com imgur.com crowdspring.com image-line.com reasonstudios.com maybe.co selenium.dev gnu.org dataquest.io chromium.org sitepoint.com ltv.fund atlassolutions.com tibbr.com envato.com networksolutions.com ipower.com parkbench.com mendeley.com zerys.com udacity.com edx.org`.split(' '));
const input = (await Promise.all(['saasmag-data.json','saasmag-data-2.json'].map(async name => JSON.parse(await readFile(`${root}/${name}`, 'utf8')).data))).flat();
const rows=[], rejected=[], seen=new Set();
for (const x of input.sort((a,b)=>Number(b[8])-Number(a[8]) || a[2].localeCompare(b[2]))) {
 let domain;
 try {domain=normalizeDomainInput(x[2]);if(!parse(domain).isIcann)throw new Error('Unknown public suffix');} catch {rejected.push({name:x[1],input:x[2],reason:'invalid_domain'});continue;}
 if (excluded.has(domain)) {rejected.push({name:x[1],domain,reason:'consumer_service_project_or_non_software_scope'});continue;}
 if (seen.has(domain)) {rejected.push({name:x[1],domain,reason:'duplicate_domain'});continue;}
 if (Number(x[8])<30) continue;
 seen.add(domain);
 rows.push({name:x[1],domain,sourceWebsite:x[2],historicalEmployees:Number(x[8]),source:'https://www.saasmag.com/saas-1000-2021/'});
}
const selected=rows.slice(0,1000).sort((a,b)=>a.domain.localeCompare(b.domain));
const hashOrder=[...selected].sort((a,b)=>createHash('sha256').update(a.domain).digest('hex').localeCompare(createHash('sha256').update(b.domain).digest('hex')));
const holdout=new Set(hashOrder.slice(0,200).map(x=>x.domain));
for(const row of selected)row.split=holdout.has(row.domain)?'holdout':'discovery';
const manifest={sourceRetrievedAt:new Date().toISOString(),sourceRows:input.length,eligibleUniqueDomains:rows.length,selection:'First 1,000 distinct normalized domains ranked by source historical employee count after exclusions; 800 discovery / 200 holdout assigned by SHA-256 domain order before scanning.',scope:'Established business software / SaaS seed cohort, including midmarket. Source is a historical 2021 ranking, not current headcount or independent verification of enterprise sales. Acquired brands and older domains remain; domains are not necessarily distinct corporate parents. DNS is queried live.',exclusions:rejected,rows:selected};
if(selected.length!==1000)throw new Error(`Only ${selected.length} domains`);
await writeFile(new URL('cohort.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
await writeFile(new URL('domains.txt',import.meta.url),selected.map(x=>x.domain).join('\n')+'\n');
console.log(JSON.stringify({selected:selected.length,eligible:rows.length,excluded:rejected.length,minHistoricalEmployees:Math.min(...selected.map(x=>x.historicalEmployees))}));
