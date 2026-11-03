const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.join(__dirname,'app/src/main/assets/web');
(async()=>{
const server=http.createServer((req,res)=>{
const rel=decodeURIComponent(req.url.split('?')[0]),file=path.join(root,rel==='/'?'index.html':rel);
if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.zip':'application/zip'};
fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);return res.end()}res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');res.end(data)});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:412,height:915}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
const state=()=>page.evaluate(()=>JSON.parse(window.pyodide.runPython("import json\njson.dumps({'cat':app.game.cat,'mouse':app.game.mouse,'exit':app.game.exit,'size':app.game.size,'caught':app.game.caught,'won':app.game.won,'level':app.game.level,'steps':app.game.steps,'cell':app.cell,'board':app.board_size,'grid':app.game.grid})")));
async function clickCell(point){
const s=await state(),canvas=page.locator('.tk-panel svg');
const box=await canvas.boundingBox(),scale=Math.min(box.width/s.board,box.height/s.board);
const x=box.x+(box.width-s.board*scale)/2+(point[0]+0.5)*s.cell*scale;
const y=box.y+(box.height-s.board*scale)/2+(point[1]+0.5)*s.cell*scale;
await page.mouse.click(x,y);
}
try{
await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
await page.goto('http://127.0.0.1:'+server.address().port);
await page.locator('#editor').fill(fs.readFileSync(path.resolve(__dirname,'../examples/cat-maze.py'),'utf8'));
await page.locator('#run').click();
await page.getByRole('button',{name:'Нова гра',exact:true}).waitFor({timeout:90000});
await page.waitForFunction(()=>!document.getElementById('run').disabled);
await page.evaluate(()=>window.pyodide.runPython('app.cancel_route()\napp.game=MazeState(12)\napp.draw_board()\napp.focus_game()'));
assert(await page.evaluate(()=>!!document.activeElement.closest('.tk-window')));
let s=await state();
const direction=[[1,0,'ArrowRight','d'],[0,1,'ArrowDown','s']].find(([dx,dy])=>s.grid[s.cat[1]+dy][s.cat[0]+dx]===0);
assert(direction);
await page.keyboard.press(direction[2]);assert.deepEqual((await state()).cat,[1+direction[0],1+direction[1]]);
assert(await page.locator('.tk-panel svg ellipse[fill="#ffb86a"]').first().getAttribute('transform'));
await page.keyboard.press(direction[0]?'ArrowLeft':'ArrowUp');assert.deepEqual((await state()).cat,[1,1]);
await page.keyboard.press('ArrowLeft');assert.equal((await state()).steps,2);assert.deepEqual((await state()).cat,[1,1]);
await page.keyboard.press(direction[3]);assert.deepEqual((await state()).cat,[1+direction[0],1+direction[1]]);
await page.getByRole('button',{name:direction[0]?'←':'↑',exact:true}).click();assert.deepEqual((await state()).cat,[1,1]);
// The click mapping must work when the SVG shrinks on a narrow phone.
await page.setViewportSize({width:320,height:915});
await clickCell((await state()).exit);
assert.equal((await state()).caught,false);assert.equal((await state()).won,false);
assert((await page.locator('.tk-panel').innerText()).includes('Спочатку піймай мишку'));
await page.evaluate(()=>window.pyodide.runPython('app.delay=1'));
await clickCell((await state()).mouse);
await page.waitForFunction(()=>window.pyodide.runPython('app.game.caught'),{},{timeout:15000});
assert.equal((await state()).won,false);
await page.locator('.tk-panel').screenshot({path:path.join(__dirname,'artifacts/cat-maze-mouse-found.png')});
await clickCell((await state()).exit);
await page.waitForFunction(()=>window.pyodide.runPython('app.game.won'),{},{timeout:15000});
assert((await page.locator('.tk-panel').innerText()).includes('Ви на волі'));
assert(await page.getByRole('button',{name:'Наступний рівень',exact:true}).isEnabled());
const wonSteps=(await state()).steps;await page.keyboard.press('ArrowUp');assert.equal((await state()).steps,wonSteps);
await page.getByRole('button',{name:'Наступний рівень',exact:true}).click();
assert.equal((await state()).level,2);assert.equal((await state()).caught,false);
await page.getByRole('button',{name:'Нова гра',exact:true}).click();
assert.equal((await state()).level,1);assert.equal((await state()).steps,0);
// A keyboard press cancels an outstanding mouse route.
await page.evaluate(()=>window.pyodide.runPython('app.delay=1000'));
s=await state();await clickCell(s.mouse);
const move=[[1,0,'ArrowRight'],[0,1,'ArrowDown']].find(([dx,dy])=>s.grid[1+dy][1+dx]===0);
await page.keyboard.press(move[2]);
const interrupted=(await state()).cat;
await page.waitForTimeout(1150);assert.deepEqual((await state()).cat,interrupted);
await page.setViewportSize({width:412,height:915});
await page.getByRole('button',{name:'Нова гра',exact:true}).click();
await page.locator('.tk-panel').screenshot({path:path.join(__dirname,'artifacts/cat-maze-preview.png')});
assert.deepEqual(errors,[]);
assert(!(await page.locator('#output').innerText()).includes('❌'));
console.log('PASS: actual arrow keys, WASD, screen buttons, wall collisions, scaled mouse clicks, collecting/following mouse, exit, levels, restart and timer cancellation.');
}catch(error){await page.screenshot({path:path.join(__dirname,'artifacts/cat-maze-failure.png'),fullPage:true});console.error(await page.locator('#output').innerText());throw error}
finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
