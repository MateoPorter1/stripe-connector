export function validateContent(guides){
 const slugs=new Set(),titles=new Set(),descriptions=new Set();const topics=['Churn','Stripe payments','Revenue recovery'];
 for(const g of guides){
  for(const key of ['slug','title','description','answer','published','updated','reviewed','keyword'])if(typeof g[key]!=='string'||!g[key].trim())throw Error(`${g.slug}: missing ${key}`);
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(g.slug)||slugs.has(g.slug))throw Error(`Invalid or duplicate slug: ${g.slug}`);slugs.add(g.slug);
  for(const [value,seen,label] of [[g.title,titles,'title'],[g.description,descriptions,'description']]){if(seen.has(value))throw Error(`Duplicate ${label}: ${value}`);seen.add(value)}
  if(!topics.includes(g.topic)||!Array.isArray(g.sections)||g.sections.length<3||!g.sources?.length||!g.related?.length)throw Error(`${g.slug}: incomplete editorial record`);
  for(const key of ['published','updated','reviewed'])if(!/^\d{4}-\d{2}-\d{2}$/.test(g[key])||Number.isNaN(Date.parse(g[key]))||g[key]>new Date().toISOString().slice(0,10))throw Error(`${g.slug}: invalid ${key}`);
  if(g.updated<g.published)throw Error(`${g.slug}: update before publication`);
  if(g.sources.some(([label,url])=>!label||!url.startsWith('https://')))throw Error(`${g.slug}: invalid source`);
  for(const section of g.sections)if(!section.title||!section.body||/<script|javascript:|onerror=|onclick=/i.test(section.body))throw Error(`${g.slug}: invalid section HTML`);
 }
 for(const g of guides)for(const other of g.related)if(!slugs.has(other)||other===g.slug)throw Error(`${g.slug}: invalid related guide ${other}`);
}
