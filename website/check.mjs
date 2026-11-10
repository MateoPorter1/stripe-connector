import fs from 'node:fs';import path from 'node:path';
import {validateContent} from './validate-content.mjs';
const origin='https://reboundmrr.com',guides=JSON.parse(fs.readFileSync('content/guides.json','utf8'));validateContent(guides);
const files=[];function walk(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n);if(fs.statSync(p).isDirectory())walk(p);else files.push(p)}}walk('dist');
const problems=[],htmlFiles=files.filter(f=>f.endsWith('.html')),pages=new Map(),titles=new Set(),descriptions=new Set(),incoming=new Map();let checked=0;
const attr=(s,name)=>s.match(new RegExp(name+`=["']([^"']*)["']`,'i'))?.[1];
for(const file of htmlFiles){const html=fs.readFileSync(file,'utf8'),url=file==='dist/index.html'?'/':'/'+file.slice(5,-5),ids=new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(x=>x[1]));pages.set(url,{file,html,ids});}
for(const [url,{file,html,ids}]of pages){
 const title=html.match(/<title>(.*?)<\/title>/s)?.[1],description=attr(html.match(/<meta name="description"[^>]*>/)?.[0]||'','content'),canonical=attr(html.match(/<link rel="canonical"[^>]*>/)?.[0]||'','href');
 if(!title||titles.has(title))problems.push(`${file}: missing/duplicate title`);titles.add(title);
 if(!description||descriptions.has(description))problems.push(`${file}: missing/duplicate description`);descriptions.add(description);
 if(canonical!==origin+url)problems.push(`${file}: incorrect canonical ${canonical}`);
 if((html.match(/<h1(?:\s|>)/g)||[]).length!==1)problems.push(`${file}: needs one h1`);
 if(!ids.has('main')||!html.includes('<html lang="en">'))problems.push(`${file}: missing main/language`);
 if(!html.includes('name="robots"')||!html.includes('property="og:image"')||!html.includes('name="twitter:image"'))problems.push(`${file}: missing crawler/social metadata`);
 for(const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)){
  const raw=match[1].replaceAll('&amp;','&');if(!raw.startsWith('/')&&!raw.startsWith('#')&&!raw.startsWith(origin+'/'))continue;
  const link=new URL(raw,origin+url),dest=link.pathname,target=pages.get(dest),asset=path.join('dist',dest.slice(1));checked++;
  if(!target&&!fs.existsSync(asset))problems.push(`${file}: broken ${raw}`);
  if(link.hash&&target&&!target.ids.has(decodeURIComponent(link.hash.slice(1))))problems.push(`${file}: missing anchor ${raw}`);
  if(target&&dest!==url)incoming.set(dest,(incoming.get(dest)||0)+1);
 }
 for(const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)){
  try{const data=JSON.parse(m[1]);if(data['@context']!=='https://schema.org')problems.push(`${file}: wrong schema context`);if(data['@type']==='BlogPosting'&&(!data.datePublished||!data.dateModified||!data.headline||!data.author||data.mainEntityOfPage!==canonical))problems.push(`${file}: incomplete article schema`);}
  catch{problems.push(`${file}: invalid structured data`);}
 }
 if(url.startsWith('/resources/')&&!url.includes('/topics/')&&!html.includes('BlogPosting'))problems.push(`${file}: missing article schema`);
 if(url==='/404'&&!html.includes('noindex,follow'))problems.push('404 must not be indexed');
}
const sitemap=fs.readFileSync('dist/sitemap.xml','utf8'),entries=[...sitemap.matchAll(/<url><loc>(.*?)<\/loc><lastmod>(.*?)<\/lastmod><\/url>/g)],urls=entries.map(x=>x[1]);
if(new Set(urls).size!==urls.length)problems.push('Duplicate sitemap URLs');
if(urls.length!==pages.size-1)problems.push(`Sitemap: ${urls.length} entries for ${pages.size-1} indexable pages`);
for(const [,full,date]of entries){if(!full.startsWith(origin+'/')||!pages.has(new URL(full).pathname)||full.endsWith('/404'))problems.push(`Invalid sitemap URL ${full}`);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>new Date().toISOString().slice(0,10))problems.push(`Invalid sitemap date ${date}`);}
for(const [url,p]of pages){if(url==='/404')continue;if(!urls.includes(origin+url))problems.push(`${url}: missing from sitemap`);if(url!=='/'&&!incoming.has(url))problems.push(`${url}: orphan page`);if(p.html.includes('noindex'))problems.push(`${url}: unexpectedly noindex`);}
const robot=fs.readFileSync('dist/robots.txt','utf8');if(!robot.includes(`Sitemap: ${origin}/sitemap.xml`)||robot.includes('Disallow: /'))problems.push('Crawler access blocked/missing sitemap');
const feed=fs.readFileSync('dist/feed.xml','utf8');if((feed.match(/<entry>/g)||[]).length!==guides.length)problems.push('Feed does not match guide count');
const home=pages.get('/').html;if(!home.includes('href="/resources"')||!home.includes('href="/customers/porter-metrics"'))problems.push('Homepage missing key discovery links');
for(const g of guides){const html=pages.get('/resources/'+g.slug)?.html;if(!html||!html.includes(g.answer.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')))problems.push(`${g.slug}: answer missing from server HTML`);if(!pages.get('/resources').html.includes(`/resources/${g.slug}`))problems.push(`${g.slug}: missing from library`);}
if(problems.length){console.error(problems.join('\n'));process.exit(1)}
console.log(`Passed: ${pages.size-1} indexable pages + 404, ${guides.length} guides, ${checked} internal links/assets, anchors, unique metadata, structured data, sitemap coverage, feed, crawler access, and orphan checks.`);
