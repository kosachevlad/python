const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.join(__dirname,'app/src/main/assets/web');
(async()=>{
const server=http.createServer((req,res)=>{
const name=decodeURIComponent(req.url.split('?')[0]),file=path.join(root,name==='/'?'index.html':name);
if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.zip':'application/zip'};
fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404);return res.end()}res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');res.end(bytes)});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:412,height:915},acceptDownloads:true});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
const state=()=>page.evaluate(()=>window.kodikIDE.getState());
const choose=async p=>page.locator('#ideTree button').filter({has:page.locator(':scope')}).count();
const file=async p=>{await page.locator('#ideTree button').evaluateAll((buttons,path)=>buttons.find(b=>b.dataset.path===path)?.click(),p)};
const submit=async value=>{if(value!==undefined)await page.locator('#ideDialogInput').fill(value);await page.locator('#ideDialogSubmit').click()};
const openTree=async()=>{if(!await page.locator('#ideTree').isVisible())await page.locator('#ideFilesToggle').click()};
const run=async input=>{
await page.locator('#run').click();
if(input!==undefined){await page.locator('#prompt').waitFor({state:'visible',timeout:90000});await page.locator('#prompt').fill(input);await page.locator('#send').click()}
await page.waitForFunction(()=>!document.getElementById('run').disabled,{},{timeout:90000});
};
try{
await page.addInitScript(()=>{
if(!localStorage.getItem('ide-test-seeded')){
localStorage.setItem('ide-test-seeded','1');localStorage.setItem('kodik-tabs',JSON.stringify([{name:'main.py',code:'print("legacy edited")'},{name:'old.py',code:'# old'}]));
}});
await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
await page.goto('http://127.0.0.1:'+server.address().port);
await page.locator('#editor').fill('print("legacy edited")');
await page.locator('#modeIDE').click();await openTree();
assert.equal((await state()).nodes.find(n=>n.path==='main.py').content,'print("legacy edited")');
await page.locator('#ideNewFolder').click();await submit('data');
await page.locator('#ideNewFile').click();await submit('data/notes.txt');
await page.locator('#editor').fill('Привіт');
await page.getByRole('button',{name:'Закрити вкладку data/notes.txt',exact:true}).click();
assert((await state()).nodes.some(n=>n.path==='data/notes.txt'));
await file('data');await page.locator('#ideRename').click();await submit('assets');
assert((await state()).nodes.some(n=>n.path==='assets/notes.txt'));
await file('assets');await file('assets/notes.txt');assert.equal(await page.locator('#editor').inputValue(),'Привіт');
await file('main.py');
const main='from helper import answer\nfrom pathlib import Path\nname = input("Імʼя: ")\nprint(answer(), Path("assets/notes.txt").read_text(), name)\nPath("result.txt").write_text("готово", encoding="utf-8")\nPath("binary.bin").write_bytes(bytes([0,255,10]))\n';
await page.locator('#editor').fill(main);
await page.locator('#ideNewFile').click();await submit('helper.py');
await page.locator('#editor').fill('def answer():\n    return 42\n');
await page.locator('#editor').fill('def answer():\n    return 43\n');
await page.locator('#undo').click();assert((await page.locator('#editor').inputValue()).includes('42'));
await page.locator('#redo').click();assert((await page.locator('#editor').inputValue()).includes('43'));
await file('main.py');await run('Оля');
assert((await page.locator('#output').innerText()).includes('43 Привіт Оля'));
assert((await state()).nodes.some(n=>n.path==='result.txt'&&n.content==='готово'));
await file('result.txt');assert.equal(await page.locator('#editor').inputValue(),'готово');
await file('binary.bin');assert(await page.locator('#editor').getAttribute('readonly')!==null);assert(await page.locator('#run').isDisabled());
await file('helper.py');await page.locator('#editor').fill('def answer():\n    return 99\n');
await file('main.py');await run('Оля');assert((await page.locator('#output').innerText()).includes('99 Привіт Оля'));
// File writes from a Tkinter callback are persisted too, preserving simultaneous editor changes.
const graphical='from pathlib import Path\nimport tkinter as tk\nr=tk.Tk()\ndef save_file():\n    Path("assets/notes.txt").write_text("з кнопки", encoding="utf-8")\ntk.Button(r,text="Записати файл",command=save_file).pack()\nr.mainloop()\n';
await page.locator('#editor').fill(graphical);await run();
await file('assets/notes.txt');await page.locator('#editor').fill('редактор');
await page.getByRole('button',{name:'Записати файл',exact:true}).click();
await page.waitForFunction(()=>window.kodikIDE.getState().nodes.some(n=>n.path.includes('python-copy')));
assert.equal((await state()).nodes.find(n=>n.path==='assets/notes.txt').content,'редактор');
assert((await state()).nodes.some(n=>n.path.includes('python-copy')&&n.content==='з кнопки'));
// Folder removal is reversible and closes tabs without destroying unrelated files.
await file('assets');await page.locator('#ideDelete').click();await submit();
assert(!(await state()).nodes.some(n=>n.path.startsWith('assets/')));
await page.locator('#projectRestore').click();await submit();
assert((await state()).nodes.some(n=>n.path==='assets/notes.txt'&&n.content==='редактор'));
// Portable export/import and native export bridge.
const downloadPromise=page.waitForEvent('download');await page.locator('#projectExport').click();
const download=await downloadPromise,downloaded=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
assert.equal(downloaded.format,'kodik-project');assert(downloaded.nodes.some(n=>n.path==='binary.bin'&&n.encoding==='base64'));
await page.locator('#ideProjectUpload').setInputFiles({name:'roundtrip.kodik.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(downloaded))});
await submit();assert.equal((await state()).nodes.length,downloaded.nodes.length);
const before=(await state()).nodes.length;
await page.locator('#ideProjectUpload').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...downloaded,nodes:[{id:'bad',path:'../escape.py',type:'file',content:'',encoding:'utf8'}]}))});
await page.waitForFunction(()=>document.querySelector('.ide-notice').classList.contains('is-error'));
assert.equal((await state()).nodes.length,before);
await page.locator('#ideFilesUpload').setInputFiles([{name:'extra.py',mimeType:'text/plain',buffer:Buffer.from('print("імпорт")')},{name:'asset.dat',mimeType:'application/octet-stream',buffer:Buffer.from([0,1,2])}]);
await page.waitForFunction(()=>window.kodikIDE.getState().nodes.some(n=>n.path.endsWith('extra.py')));
await page.evaluate(()=>{window.KodikAndroid={saveFile(name,encoded,mime){window.nativeExport={name,encoded,mime};window.dispatchEvent(new CustomEvent('kodik-native-save',{detail:{ok:true}}));return true}}});
await page.locator('#projectExport').click();await page.waitForFunction(()=>window.nativeExport);
const native=await page.evaluate(()=>window.nativeExport);assert.equal(native.mime,'application/json');assert.equal(JSON.parse(Buffer.from(native.encoded,'base64').toString('utf8')).format,'kodik-project');
// Reload and mode switching preserve both workspaces independently.
await page.reload();await page.waitForFunction(()=>window.kodikIDE.active);
assert((await state()).nodes.some(n=>n.path.endsWith('extra.py')));
await page.locator('#modeSimple').click();assert.equal(await page.locator('#editor').inputValue(),'print("legacy edited")');
await page.locator('.tab[data-i="1"]').click();await page.locator('.tab-close[data-close="1"]').click();
assert.equal(await page.locator('#editor').inputValue(),'print("legacy edited")');
await page.locator('#editor').fill('print("simple change")');
await page.locator('#modeIDE').click();assert.equal((await state()).nodes.find(n=>n.path==='main.py').content,graphical);
// Built-in project demonstrates imports and relative files without setup.
await page.locator('#projectDemo').click();await submit();await run();
assert((await page.locator('#output').innerText()).includes('Створено result.txt'));
assert((await state()).nodes.some(n=>n.path==='result.txt'&&n.content.includes('Софія')));
await page.setViewportSize({width:1440,height:1000});
await page.screenshot({path:path.join(__dirname,'artifacts/mini-ide-desktop.png'),fullPage:true});
await page.setViewportSize({width:412,height:915});await openTree();
await page.screenshot({path:path.join(__dirname,'artifacts/mini-ide-mobile.png'),fullPage:true});
assert.deepEqual(errors,[]);
console.log('PASS: migration, file tree CRUD, rename folders, close tabs, per-file undo, Python imports/cache/data I/O, binaries, Tk callbacks/conflicts, recovery, exports/imports, reload, modes, native export bridge and responsive demo.');
}catch(error){await page.screenshot({path:path.join(__dirname,'artifacts/mini-ide-failure.png'),fullPage:true});console.error(await page.locator('#output').innerText());throw error}
finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
