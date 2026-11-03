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

const square=fs.readFileSync(path.resolve(__dirname,'../examples/turtle-square.py'),'utf8');
await page.locator('#editor').fill(square);
await page.locator('#run').click();
await page.waitForFunction(()=>window.kodikTurtle.visible);
await page.waitForFunction(()=>!document.getElementById('run').disabled,{},{timeout:15000});
const pixels=await page.evaluate(()=>{
const c=document.getElementById('turtleCanvas'),ctx=c.getContext('2d');
return [[370,240],[420,290],[370,340],[320,290],[370,290]].map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data));
});
for(const pixel of pixels.slice(0,4))assert(pixel[2]>pixel[0]+50&&pixel[2]>pixel[1]+50,JSON.stringify(pixels));
assert(pixels[4].slice(0,3).every(value=>value===255),'Square interior stays white');
await page.locator('.share-code').click();
await page.waitForFunction(()=>!document.querySelector('.share-code').disabled);
const turtlePng=await page.evaluate(()=>window.sharedPng);
fs.writeFileSync(path.join(__dirname,'artifacts/turtle-shared.png'),Buffer.from(turtlePng,'base64'));
await page.locator('.turtle-panel').screenshot({path:path.join(__dirname,'artifacts/turtle-square.png')});
await page.screenshot({path:path.join(__dirname,'artifacts/turtle-mobile.png'),fullPage:true});
// A later run must not keep the old drawing or the old turtle position.
await page.locator('#editor').fill('import turtle\nturtle.speed(0)\nturtle.forward(30)\nprint("новий запуск")');
await page.locator('#run').click();
await page.waitForFunction(()=>document.getElementById('output').textContent.includes('новий запуск'));
assert.deepEqual(await page.evaluate(()=>Array.from(document.getElementById('turtleCanvas').getContext('2d').getImageData(420,290,1,1).data)),[255,255,255,255]);
await page.locator('#editor').fill('print("без малювання")');
await page.locator('#run').click();
await page.waitForFunction(()=>document.getElementById('output').textContent.includes('без малювання'));
assert(await page.locator('.turtle-panel').isHidden());
console.log('PASS: exact user turtle example draws four blue edges, exports PNG, resets on rerun, hides on ordinary programs.');

assert.deepEqual(errors,[]);
console.log('PASS: mobile UI, offline Python, Ukrainian input, f-string, loop, native PNG share adapter.');
}finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
