const VERSION='kodik-v1.30',PYTHON_CACHE='kodik-python-0.26.2';
const core=new Set(['pyodide.js','pyodide.asm.js','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json']);
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
for(const name of await caches.keys())if(name.startsWith('kodik-v')&&name!==VERSION)await caches.delete(name);
await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
if(event.request.method!=='GET')return;
const url=new URL(event.request.url),name=url.pathname.split('/').pop();
const python=core.has(name)&&((url.origin==='https://cdn.jsdelivr.net'&&url.pathname.startsWith('/pyodide/v0.26.2/full/'))||(url.origin===self.location.origin&&url.pathname.startsWith(new URL('pyodide/',self.registration.scope).pathname)));
if(python){
event.respondWith((async()=>{
const cache=await caches.open(PYTHON_CACHE),saved=await cache.match(event.request);if(saved)return saved;
const response=await fetch(event.request);if(response.ok)try{await cache.put(event.request,response.clone())}catch{/* Storage may be full or unavailable; Python can still load. */}
return response;
})());return;
}
event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
if(response.ok)caches.open(VERSION).then(cache=>cache.put(event.request,response.clone())).catch(()=>{});
return response;
}).catch(()=>caches.match(event.request)));
});
