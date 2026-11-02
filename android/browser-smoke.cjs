const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.join(__dirname,'app/src/main/assets/web');
(async()=>{
const server=http.createServer((req,res)=>{
const rel=decodeURIComponent(req.url.split('?')[0]);
const file=path.join(root,rel==='/'?'index.html':rel);
if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.zip':'application/zip'};
fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404);return res.end()}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(bytes)});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
try{
const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
await page.addInitScript(()=>{window.KodikAndroid={sharePng(encoded){window.sharedPng=encoded;return true}}});
await page.goto('http://127.0.0.1:'+server.address().port);
await page.locator('#run').click();
await page.locator('#status').filter({hasText:'Очікую введення'}).waitFor({timeout:90000});
await page.locator('#prompt').fill('Учень');
await page.locator('#send').click();
await page.waitForFunction(()=>document.getElementById('output').textContent.includes('Python — це цікаво! 3'));
const result=await page.locator('#output').innerText();
assert(result.includes('Привіт, Учень!'),result);
await page.locator('.share-code').click();
await page.waitForFunction(()=>window.sharedPng);
const png=await page.evaluate(()=>window.sharedPng);
fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'artifacts/shared-code.png'),Buffer.from(png,'base64'));
await page.screenshot({path:path.join(__dirname,'artifacts/android-preview.png'),fullPage:true});
assert.deepEqual(errors,[]);
console.log('PASS: mobile UI, offline Python, Ukrainian input, f-string, loop, native PNG share adapter.');
}finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
