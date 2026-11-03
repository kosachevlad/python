const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.join(__dirname,'app/src/main/assets/web');
(async()=>{
const server=http.createServer((req,res)=>{
const name=decodeURIComponent(req.url.split('?')[0]);
const file=path.join(root,name==='/'?'index.html':name);
if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.zip':'application/zip'};
fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);return res.end()}res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');res.end(data)});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
await page.goto('http://127.0.0.1:'+server.address().port);
await page.locator('#editor').fill(fs.readFileSync(path.resolve(__dirname,'../examples/krypta-d20.py'),'utf8'));
await page.locator('#run').click();
await page.getByRole('button',{name:'Почати пригоду',exact:true}).waitFor({timeout:90000});
await page.waitForFunction(()=>!document.getElementById('run').disabled);
await page.locator('.tk-panel input').fill('Тестер');
await page.getByRole('button',{name:'Маг',exact:true}).click();
assert((await page.locator('.tk-panel').innerText()).includes('Вогняна куля'));
await page.locator('.tk-panel').screenshot({path:path.join(__dirname,'artifacts/d20-start.png')});
// Deterministic rolls exist only in this test, not in the distributed game.
await page.evaluate(()=>window.pyodide.runPython('class _BrowserRolls:\n    def randint(self,a,b):\n        return b\napp.game.rng=_BrowserRolls()'));
await page.getByRole('button',{name:'Почати пригоду',exact:true}).click();
assert(await page.getByRole('button',{name:'Маг',exact:true}).isDisabled());
assert(await page.getByRole('button',{name:'Атакувати',exact:true}).isEnabled());
assert(await page.locator('.tk-panel input').isDisabled());
assert(await page.locator('.tk-panel svg rect').count()>40);
await page.locator('.tk-panel').screenshot({path:path.join(__dirname,'artifacts/d20-combat.png')});
await page.getByRole('button',{name:'Уміння (2)',exact:true}).click();
assert.equal(await page.evaluate(()=>window.pyodide.runPython('app.game.phase')),'camp');
await page.getByRole('button',{name:'Перепочити',exact:true}).click();
assert(await page.getByRole('button',{name:'Перепочити',exact:true}).isDisabled());
await page.getByRole('button',{name:'Обшукати',exact:true}).click();
assert(await page.getByRole('button',{name:'Обшукати',exact:true}).isDisabled());
for(let i=0;i<30;i++){
const phase=await page.evaluate(()=>window.pyodide.runPython('app.game.phase'));
if(phase==='won')break;
assert.notEqual(phase,'lost');
if(phase==='camp'){
if(await page.getByRole('button',{name:'Перепочити',exact:true}).isEnabled())await page.getByRole('button',{name:'Перепочити',exact:true}).click();
await page.getByRole('button',{name:'До наступної кімнати',exact:true}).click();
}else{
const skill=page.getByRole('button',{name:/^Уміння \(/});
if(await skill.isEnabled())await skill.click();
else await page.getByRole('button',{name:'Атакувати',exact:true}).click();
}
}
assert.equal(await page.evaluate(()=>window.pyodide.runPython('app.game.phase')),'won');
assert((await page.locator('.tk-panel').innerText()).includes('ПЕРЕМОГА'));
assert(await page.getByRole('button',{name:'Атакувати',exact:true}).isDisabled());
await page.locator('.tk-panel').screenshot({path:path.join(__dirname,'artifacts/d20-victory.png')});
await page.getByRole('button',{name:'Зіграти ще раз',exact:true}).click();
assert.equal(await page.evaluate(()=>window.pyodide.runPython('app.game.phase')),'combat');
await page.getByRole('button',{name:'Нова пригода',exact:true}).click();
assert.equal(await page.evaluate(()=>window.pyodide.runPython('app.game.phase')),'ready');
await page.getByRole('button',{name:'Розбійник',exact:true}).click();
await page.getByRole('button',{name:'Почати пригоду',exact:true}).click();
await page.evaluate(()=>window.pyodide.runPython("app.game.hero['hp']=1"));
await page.getByRole('button',{name:'Захищатися',exact:true}).click();
assert.equal(await page.evaluate(()=>window.pyodide.runPython('app.game.phase')),'lost');
assert((await page.locator('.tk-panel').innerText()).includes('ПОРАЗКА'));
assert.deepEqual(errors,[]);
assert(!(await page.locator('#output').innerText()).includes('❌'));
console.log('PASS: mobile GUI, class selection, d20 combat, skills, rest/search, four-room victory, restart, defeat and button states.');
}catch(error){
await page.screenshot({path:path.join(__dirname,'artifacts/d20-failure.png'),fullPage:true});
throw error;
}finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
