const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../.browser-test');
(async()=>{
const server=http.createServer((req,res)=>{const p=decodeURIComponent(req.url.split('?')[0]),file=path.join(root,p==='/'?'index.html':p);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end()}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.zip':'application/zip'})[path.extname(file)]||'text/plain');res.end(data)})});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
await context.addInitScript(()=>{window.KODIK_PYODIDE_URL='/pyodide/';if(!localStorage.getItem('mobile-seeded')){localStorage.setItem('mobile-seeded','1');localStorage.setItem('kodik-tabs',JSON.stringify([{name:'main.py',code:'print("ready")'}]))}});
const run=async code=>{await page.locator('#mobileCode').click();await page.locator('#editor').fill(code);await page.locator('#mobileRun').click()};
const finished=async text=>{await page.waitForFunction(t=>document.getElementById('output').textContent.includes(t),text,{timeout:90000});await page.waitForFunction(()=>!document.getElementById('mobileRun').disabled)};
try{
await page.goto(url);await page.waitForFunction(()=>navigator.serviceWorker.controller,{},{timeout:30000});
await page.waitForFunction(()=>window.kodikEngine?.state==='ready',{},{timeout:90000});
assert.equal(await page.locator('script[src$="/pyodide/pyodide.js"]').count(),1);
assert(await page.locator('#editor').isVisible());assert(await page.locator('.terminal').isHidden());
assert(await page.locator('#pythonEngineStatus').isHidden());assert.equal(await page.locator('#pythonEngineStatus').textContent(),'');
assert(await page.locator('.share-footer .share-code').isVisible());
assert(await page.locator('.share-footer').evaluate(e=>e===document.querySelector('.app').lastElementChild));
await page.locator('.mobile-dock').screenshot({path:path.join(__dirname,'artifacts/mobile-run-bar.png')});
await run('name = input("Як тебе звати? ")\nage = input("Який у тебе клас? ")\nprint("Привіт", name, age)');
await page.waitForFunction(()=>typeof waiting!=='undefined'&&waiting,{},{timeout:90000});
await page.waitForFunction(()=>document.activeElement.id==='prompt');
assert(await page.locator('#editor').isHidden());assert(await page.locator('#prompt').isVisible());
const visible=await page.locator('#prompt').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=window.visualViewport.height+window.visualViewport.offsetTop});assert(visible);
await page.screenshot({path:path.join(__dirname,'artifacts/mobile-input.png'),fullPage:true});
await page.locator('#prompt').fill('Оля');await page.locator('#send').click();await page.locator('#prompt').fill('7');await page.locator('#send').click();await finished('Привіт Оля 7');
assert.equal(await page.evaluate(()=>kodikMobile.currentView),'result');
assert(await page.locator('.share-footer .share-code').isVisible());
await page.locator('#mobileCode').click();assert((await page.locator('#editor').inputValue()).includes('input('));
assert(await page.locator('.share-footer .share-code').isVisible());
await page.evaluate(()=>Object.defineProperty(navigator,'share',{value:undefined,configurable:true}));
const downloaded=page.waitForEvent('download',{timeout:10000});await page.locator('.share-code').click();await downloaded;
assert(await page.locator('.share-footer .share-notice').isVisible());
await page.locator('#modeIDE').click();await run('from pathlib import Path\nPath("answer.txt").write_text("42")\nprint("IDE працює")');await finished('IDE працює');
assert((await page.evaluate(()=>kodikIDE.getState())).nodes.some(n=>n.path==='answer.txt'));
await run('import tkinter as tk\nr=tk.Tk()\ntk.Label(r,text="Привіт, клас!").pack()\nr.mainloop()');
await page.locator('.tk-panel').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('mobileRun').disabled);assert.equal(await page.evaluate(()=>kodikMobile.currentView),'result');
await page.locator('#mobileCode').click();await page.locator('#modeSimple').click();
await run('raise ValueError("перевірка")');await finished('ValueError');
await page.locator('#mobileCode').click();await page.setViewportSize({width:320,height:720});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.screenshot({path:path.join(__dirname,'artifacts/mobile-editor.png'),fullPage:true});
// Reload online once to cache the document, then prove all Python assets survive offline.
await page.reload();await page.waitForFunction(()=>kodikEngine.state==='ready',{},{timeout:90000});
await run('print("online cache")');await finished('online cache');
await page.waitForFunction(async()=>{const cache=await caches.open('kodik-python-0.26.2');return !!await cache.match(new URL('/pyodide/pyodide.asm.wasm',location.href))});
await context.setOffline(true);await page.reload();await page.waitForFunction(()=>kodikEngine.state==='ready',{},{timeout:90000});
await run('print("Працює без мережі")');await finished('Працює без мережі');await context.setOffline(false);
assert.deepEqual(errors,[]);
// Desktop keeps the simultaneous editor/output layout.
await page.setViewportSize({width:1200,height:900});assert(await page.locator('#editor').isVisible());assert(await page.locator('.terminal').isVisible());assert(await page.locator('.mobile-dock').isHidden());
console.log('PASS: background Python, single loader, mobile code/result/run navigation, input visibility and focus, multiple inputs, IDE files, Tkinter, errors, 320px layout, offline runtime cache and desktop layout');
// An explicit retry works after a loader/network error; Data Saver suppresses preloading.
const retryContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await retryContext.addInitScript(()=>{window.KODIK_PYODIDE_URL='/pyodide/';Object.defineProperty(navigator,'connection',{value:{saveData:true}})});
const retry=await retryContext.newPage();let fail=true;await retry.route('**/pyodide/pyodide.js',r=>fail?r.abort():r.continue());await retry.goto(url);
await retry.waitForTimeout(2000);assert.equal(await retry.evaluate(()=>kodikEngine.state),'idle');await retry.locator('#pythonEngineStatus').click();await retry.waitForFunction(()=>kodikEngine.state==='error');fail=false;await retry.locator('#pythonEngineStatus').click();await retry.waitForFunction(()=>kodikEngine.state==='ready',{},{timeout:90000});await retryContext.close();
console.log('PASS: Data Saver respects manual loading and failed Python download can be retried');
}catch(e){await page.screenshot({path:path.join(__dirname,'artifacts/mobile-failure.png'),fullPage:true});console.error(await page.locator('#output').innerText());throw e}finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
