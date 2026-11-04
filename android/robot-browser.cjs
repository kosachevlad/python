const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.join(__dirname,'app/src/main/assets/web');
(async()=>{
const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]),file=path.join(root,name==='/'?'index.html':name);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404);return res.end()}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.zip':'application/zip'})[path.extname(file)]||'text/plain');res.end(bytes)})});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:412,height:915}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
const state=()=>page.evaluate(()=>KodikRobot.state);
const run=async code=>{await page.locator('#editor').fill(code);await page.locator('#run').click();await page.waitForFunction(()=>KodikRobot.state.prepared,{},{timeout:90000});await page.waitForFunction(()=>!document.getElementById('run').disabled)};
try{
await page.goto('http://127.0.0.1:'+server.address().port);
await run(fs.readFileSync(path.join(__dirname,'../examples/robot-start.py'),'utf8'));
assert((await page.locator('#output').innerText()).includes('Зібрано кристалів: 1'));
assert.equal((await state()).cursor,0);assert.equal((await state()).frame.collected,0);
await page.locator('#robotStep').click();assert.equal((await state()).cursor,1);assert.equal((await state()).frame.robot.y,2);
await page.locator('#robotSpeed').evaluate(e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}))});await page.locator('#robotPlay').click();await page.locator('#robotStop').click();assert.equal((await state()).playing,false);
const paused=(await state()).cursor;await page.waitForTimeout(600);assert.equal((await state()).cursor,paused);
await page.locator('#robotReset').click();assert.equal((await state()).cursor,0);
await page.locator('#robotSpeed').evaluate(e=>{e.value='10';e.dispatchEvent(new Event('input',{bubbles:true}))});await page.locator('#robotPlay').click();await page.waitForFunction(()=>KodikRobot.state.cursor===KodikRobot.state.count-1);
assert.equal((await state()).frame.collected,1);assert((await page.locator('#robotStatus').innerText()).includes('Усі кристали'));
await page.locator('#robotReset').click();
await page.locator('#robotSkin').selectOption('grass');
await page.locator('.robot-panel').screenshot({path:path.join(__dirname,'artifacts/robot-mobile.png')});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.setViewportSize({width:320,height:850});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.locator('#robotMap').selectOption('map3.map');assert.equal((await state()).prepared,false);
await run('from robot import *\nprint(position())\nforward(2)\nright()\nforward(8)\nright()\nforward()\n');
assert((await page.locator('#output').innerText()).includes('CollisionError'));
await page.locator('#robotSpeed').evaluate(e=>{e.value='10';e.dispatchEvent(new Event('input',{bubbles:true}))});await page.locator('#robotPlay').click();await page.waitForFunction(()=>KodikRobot.state.cursor===KodikRobot.state.count-1);assert((await state()).frame.robot.bumped);
await run(fs.readFileSync(path.join(__dirname,'../examples/robot-zigzag.py'),'utf8'));
assert((await page.locator('#output').innerText()).includes('Зібрано: 1 із 1'));
await page.setViewportSize({width:1000,height:900});await page.locator('.robot-panel').screenshot({path:path.join(__dirname,'artifacts/robot-map3.png')});
// Imported maps and project-relative map files in Mini-IDE.
await page.locator('#robotFile').setInputFiles({name:'small.map',mimeType:'text/plain',buffer:Buffer.from('direction:\neast\n\nmap:\nAAAAA\nA@* A\nAAAAA\n')});
await run('from robot import *\nassert frontIsEnergon()\npickUp()\nprint(collected())');assert((await page.locator('#output').innerText()).includes('1'));
await page.locator('#modeIDE').click();
await run('from pathlib import Path\nPath("level.map").write_text("direction:\\neast\\n\\nmap:\\nAAAAA\\nA@* A\\nAAAAA\\n")\nfrom robot import *\nload_map("level.map")\npickUp()\nprint("IDE", collected())');
assert((await page.locator('#output').innerText()).includes('IDE 1'));
await run('from robot import *\nload_map("map3.map")\nprint("fresh", collected(), position())');assert((await page.locator('#output').innerText()).includes('fresh 0 (3, 3)'));
await run('print("без робота")');assert(await page.locator('.robot-panel').isHidden());
assert.deepEqual(errors,[]);console.log('PASS: offline Python in both modes, playback/step/pause/reset, collisions, mobile 320px, all controls, custom and project maps, rerun cleanup');
}finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
