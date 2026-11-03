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
const edgePixels=await page.evaluate(()=>{
const ctx=document.getElementById('turtleCanvas').getContext('2d'),values=[];
// Exclude the turtle cursor drawn over the first 13 pixels of the top edge.
for(let n=20;n<80;n++)for(const [x,y] of [[320+n,240],[420,240+n],[320+n,340],[320,240+n]])values.push(Array.from(ctx.getImageData(x,y,1,1).data));
return values;
});
assert(edgePixels.every(pixel=>pixel[2]>pixel[0]+50&&pixel[2]>pixel[1]+50),'Final edges must be solid after animation: '+JSON.stringify(edgePixels.filter(pixel=>!(pixel[2]>pixel[0]+50&&pixel[2]>pixel[1]+50)).slice(0,8)));
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


// Real DOM callbacks after Python has returned from mainloop().
const calculator=fs.readFileSync(path.resolve(__dirname,'../examples/tkinter-calculator.py'),'utf8');
await page.locator('#editor').fill(calculator);
await page.locator('#run').click();
await page.locator('.tk-panel input').first().waitFor();
await page.waitForFunction(()=>!document.getElementById('run').disabled);
const tkInputs=page.locator('.tk-panel input');
await tkInputs.nth(0).fill('7');await tkInputs.nth(1).fill('5');
await page.getByRole('button',{name:'Додати',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('.tk-panel').textContent.includes('Сума: 12'));
assert.equal(await page.locator('.tk-label').filter({hasText:'Сума: 12'}).evaluate(e=>getComputedStyle(e).color),'rgb(0, 0, 255)');
await page.locator('.tk-panel').screenshot({path:path.join(__dirname,'artifacts/tkinter-calculator.png')});
await page.screenshot({path:path.join(__dirname,'artifacts/tkinter-mobile.png'),fullPage:true});
await tkInputs.nth(0).fill('abc');await page.getByRole('button',{name:'Додати',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('.tk-panel').textContent.includes('Введи саме числа'));
assert.equal(await page.locator('.tk-label').filter({hasText:'Введи саме числа'}).evaluate(e=>getComputedStyle(e).color),'rgb(255, 0, 0)');
await page.locator('#editor').fill([
'from tkinter import *','root=Tk()', 'value=StringVar(value="Старт")',
'entry=Entry(root,textvariable=value)','entry.grid(row=0,column=0)',
'Label(root,textvariable=value).grid(row=1,column=0)',
'root.bind("<Return>",lambda event:value.set("Enter працює"))',
'root.after(100,lambda:value.set("Таймер працює"))','root.mainloop()'
].join('\n'));
await page.locator('#run').click();
await page.waitForFunction(()=>document.querySelector('.tk-panel').textContent.includes('Таймер працює'));
assert.equal(await page.locator('.tk-panel input').count(),1,'Prior calculator widgets are gone');
await page.locator('.tk-panel input').fill('Привіт');
await page.waitForFunction(()=>document.querySelector('.tk-panel').textContent.includes('Привіт'));
await page.locator('.tk-panel input').press('Enter');
await page.waitForFunction(()=>document.querySelector('.tk-panel').textContent.includes('Enter працює'));
await page.locator('#editor').fill([
'from tkinter import *','from tkinter import ttk','root=Tk()',
'c=Canvas(root,width=200,height=120)','c.pack()',
'r=c.create_rectangle(10,10,70,60,fill="blue")','c.move(r,5,7)',
'def broken():','    print("натиснуто")','    1/0',
'ttk.Button(root,text="Помилка",command=broken).pack()',
'ttk.Button(root,text="Закрити",command=root.destroy).pack()',
'root.after(1000,lambda:print("СТАРИЙ ТАЙМЕР"))','root.mainloop()'
].join('\n'));
await page.locator('#run').click();
await page.getByRole('button',{name:'Помилка',exact:true}).waitFor();
assert.equal(await page.locator('.tk-panel svg rect').getAttribute('transform'),'translate(5 7)');
await page.getByRole('button',{name:'Помилка',exact:true}).click();
await page.waitForFunction(()=>document.getElementById('output').textContent.includes('ZeroDivisionError'));
assert((await page.locator('#output').innerText()).includes('натиснуто'));
await page.getByRole('button',{name:'Закрити',exact:true}).click();
assert(await page.locator('.tk-panel').isHidden());
await page.locator('#editor').fill('print("чистий запуск")');
await page.locator('#run').click();
await page.waitForFunction(()=>document.getElementById('output').textContent.includes('чистий запуск'));
await page.waitForTimeout(1100);
assert(!(await page.locator('#output').innerText()).includes('СТАРИЙ ТАЙМЕР'));
assert(await page.locator('.tk-panel').isHidden());
console.log('PASS: Tkinter calculator 7+5=12, invalid input, variables, grid, keyboard binding, timers, ttk, Canvas, event stdout/errors, destroy and reset.');

assert.deepEqual(errors,[]);
console.log('PASS: mobile UI, offline Python, Ukrainian input, f-string, loop, native PNG share adapter.');
}finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
