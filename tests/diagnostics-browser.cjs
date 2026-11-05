const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../.browser-test');
(async()=>{
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(req.url.split('?')[0])==='/'?'index.html':decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.zip':'application/zip'})[path.extname(file)]||'text/plain');res.end(data)})});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>{window.KODIK_PYODIDE_URL='/pyodide/'});fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
const code=async text=>{await page.locator('#mobileCode').click();await page.locator('#editor').fill(text)};
const done=async()=>page.waitForFunction(()=>!document.getElementById('mobileRun').disabled,{},{timeout:90000});
const run=async text=>{await code(text);await page.locator('#mobileRun').click();await done()};
const items=()=>page.evaluate(()=>KodikDiagnostics.items);
const check=async()=>{await page.locator('#checkPython').click();await page.waitForFunction(()=>!KodikDiagnostics.checking,{},{timeout:90000})};
const choose=async file=>page.locator('#ideTree button').evaluateAll((buttons,p)=>buttons.find(b=>b.dataset.path===p)?.click(),file);
const newFile=async name=>{await page.locator('#ideNewFile').click();await page.locator('#ideDialogInput').fill(name);await page.locator('#ideDialogSubmit').click()};
try{
await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>kodikEngine.state==='ready',{},{timeout:90000});
await run('x = 1\nif x == 1\n    print(x)');
assert.equal((await items())[0].line,2);assert((await items())[0].title.includes('двокрапка'));assert.equal(await page.evaluate(()=>waiting),false);
await page.locator('.diagnostics-panel').screenshot({path:path.join(__dirname,'artifacts/python-missing-colon.png')});
await page.locator('.diagnostic-location').click();assert(await page.locator('#editor').isVisible());
assert.equal(await page.locator('#editor').evaluate(e=>e.value.slice(0,e.selectionStart).split('\n').length),2);
assert.equal(await page.locator('.diagnostic-gutter').textContent(),'2');
await run('print(“привіт”)');assert.equal((await items())[0].type,'SyntaxError');assert((await items())[0].title.includes('символ'));await page.locator('#mobileCode').click();assert.equal(await page.locator('#editor').inputValue(),'print(“привіт”)');
await run('print("Не змінюй “лапки” всередині тексту")');assert((await page.locator('#output').textContent()).includes('“лапки”'));
await code('print("НЕ ВИКОНУВАТИ")\npritn("hi")');const before=await page.locator('#output').textContent();await check();assert.equal(await page.locator('#output').textContent(),before);assert((await items()).some(i=>i.type==='UndefinedName'&&i.hint.includes('print')));
await code('print("коментар # ( { без помилки")');await check();assert.equal((await items()).length,0);
await run('x = 10\ny = 0\nprint(x / y)');assert.equal((await items()).at(-1).line,3);assert.equal((await items()).at(-1).type,'ZeroDivisionError');await page.waitForTimeout(1200);assert((await page.locator('#output').textContent()).includes('main.py:3'));assert(!(await page.locator('#output').textContent()).includes('на рядку 2'));
await page.locator('.diagnostics-panel').screenshot({path:path.join(__dirname,'artifacts/python-runtime-error.png')});
await code('name = input(\n    "Імʼя? "\n)\nprint(int(name))');await page.locator('#mobileRun').click();await page.waitForFunction(()=>waiting);await page.locator('#prompt').fill('abc');await page.locator('#send').click();await done();assert.equal((await items()).at(-1).line,4);assert.equal((await items()).at(-1).type,'ValueError');
await run('x = input("Name?")\nif True\n    pass');assert.equal(await page.evaluate(()=>waiting),false);assert.equal((await items())[0].line,2);
await page.locator('#mobileCode').click();await page.locator('#modeIDE').click();await page.locator('#ideFilesToggle').click();
await newFile('helper.py');await page.locator('#editor').fill('def fail():\n    return 1 / 0\n');await choose('main.py');
await run('from helper import fail\nfail()');assert.equal((await items()).at(-1).file,'helper.py');assert.equal((await items()).at(-1).line,2);
await page.locator('.diagnostic-location').last().click();assert((await page.locator('#editor').inputValue()).includes('return 1 / 0'));assert.equal(await page.locator('#editor').evaluate(e=>e.value.slice(0,e.selectionStart).split('\n').length),2);
await page.locator('#editor').fill('if True\n    pass\n');await choose('main.py');await run('import helper');assert.equal((await items()).at(-1).file,'helper.py');assert.equal((await items()).at(-1).line,1);assert((await items()).at(-1).title.includes('двокрапка'));
const gui='import tkinter as tk\nr = tk.Tk()\ndef fail():\n    value = 1 / 0\ntk.Button(r, text="Помилка з кнопки", command=fail).pack()\nr.mainloop()\n';
await run(gui);await page.getByRole('button',{name:'Помилка з кнопки',exact:true}).click();assert.equal((await items()).at(-1).line,4);assert.equal((await items()).at(-1).type,'ZeroDivisionError');
// Checking edited code does not rewrite source locations of a still-live GUI callback.
await code(gui+'# edited\n');await check();await page.locator('#mobileResult').click();await page.getByRole('button',{name:'Помилка з кнопки',exact:true}).click();await page.locator('.diagnostic-location').last().click();assert((await page.locator('#diagnosticStatus').textContent()).includes('Код уже змінено'));
await page.locator('#mobileCode').click();await page.locator('#uiLang').selectOption('en');await code('if True\n    pass');await check();assert((await items())[0].title.includes('colon'));assert((await page.locator('#checkPython').textContent()).includes('Check'));
await page.setViewportSize({width:320,height:720});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.setViewportSize({width:1200,height:900});assert(await page.locator('#editor').isVisible());assert(await page.locator('.terminal').isVisible());
assert.deepEqual(errors,[]);console.log('PASS: browser preflight, exact lines/carets, manual no-execution check, highlights and jump, multiline input, imported-file navigation/syntax, Tk callbacks, stale source protection, English, mobile/desktop and no legacy rewrites');
}catch(e){await page.screenshot({path:path.join(__dirname,'artifacts/diagnostics-failure.png'),fullPage:true});console.error(await page.locator('#output').textContent());throw e}finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
