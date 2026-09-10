import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
async function walk(dir){const r=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.isDirectory())r.push(...await walk(`${dir}/${e.name}`));else r.push(`${dir}/${e.name}`);}return r;}
const files=(await walk('out')).filter(f=>!f.endsWith('.map')&&!f.endsWith('/sw.js'));
const hash=createHash('sha256');for(const f of files){hash.update(await readFile(f));}const name='fl-fave-'+hash.digest('hex').slice(0,16);
const urls=['/',...files.map(f=>'/'+f.slice(4))];
await writeFile('out/sw.js',`const CACHE=${JSON.stringify(name)};const ASSETS=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
// No skipWaiting: an active analysis keeps its current coherent release.
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fl-fave-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;event.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;if(event.request.mode==='navigate')return (await cache.match('/'))||fetch(event.request);return fetch(event.request);}));});
`);console.log('Offline cache:',name,urls.length,'assets');
