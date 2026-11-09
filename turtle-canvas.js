(()=>{
'use strict';
const panel=document.createElement('section');
panel.className='turtle-panel';panel.hidden=true;
panel.innerHTML='<div class="turtle-head"><span id="turtleTitle">🐢 Черепашка</span><span>turtle · Python</span></div><canvas id="turtleCanvas" width="640" height="480" aria-label="Малюнок Python turtle"></canvas>';
const share=document.querySelector('.share-code');
if(share)share.insertAdjacentElement('beforebegin',panel);
else document.querySelector('.terminal').insertAdjacentElement('afterend',panel);
const canvas=panel.querySelector('canvas'),ctx=canvas.getContext('2d');
const art=document.createElement('canvas'),ink=art.getContext('2d');
art.width=canvas.width;art.height=canvas.height;
let queue=[],history=[],turtles=new Map(),background='white',animated=true;
let frame=0,current=null,resolvers=[],generation=0;
let animationMultiplier = 1;
const point=(x,y)=>[canvas.width/2+x,canvas.height/2-y];
const segment=(context,c,x0=c.x0,y0=c.y0,x=c.x,y=c.y)=>{
if(!c.draw)return;
context.beginPath();context.moveTo(...point(x0,y0));context.lineTo(...point(x,y));
context.lineWidth=c.width;context.lineCap='round';context.lineJoin='round';
context.strokeStyle=c.color;context.stroke();
};
function drawMark(c){
if(c.op==='move')segment(ink,c);
if(c.op==='dot'){
ink.beginPath();ink.arc(...point(c.x,c.y),Math.max(0,c.size)/2,0,Math.PI*2);ink.fillStyle=c.color;ink.fill();
}
if(c.op==='fill'&&c.points.length){
ink.beginPath();c.points.forEach((p,i)=>ink[i?'lineTo':'moveTo'](...point(...p)));ink.closePath();
ink.fillStyle=c.color;ink.fill();
}
if(c.op==='write'){
ink.fillStyle=c.color;ink.font=c.size+'px sans-serif';
ink.textAlign=['left','center','right'].includes(c.align)?c.align:'left';
ink.textBaseline='bottom';ink.fillText(c.text,...point(c.x,c.y));
}
}
function redrawArt(){ink.clearRect(0,0,art.width,art.height);history.forEach(drawMark)}
function render(){
ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(art,0,0);
if (current) segment(ctx, current.command, current.command.x0, current.command.y0, current.x, current.y);
for(const t of turtles.values()){
if(!t.visible||t.shape==='blank')continue;
ctx.save();ctx.translate(...point(t.x,t.y));ctx.rotate(-t.angle*Math.PI/180);
ctx.fillStyle=t.color;ctx.strokeStyle='#304451';ctx.lineWidth=1;
if(t.shape==='turtle'){
for(const [x,y] of [[-6,-7],[6,-7],[-6,7],[6,7],[11,0]]){
ctx.beginPath();ctx.ellipse(x,y,4,3,0,0,Math.PI*2);ctx.fill();ctx.stroke();
}
ctx.beginPath();ctx.ellipse(0,0,9,6,0,0,Math.PI*2);
}else if(t.shape==='circle'){ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2)}
else if(t.shape==='square'){ctx.beginPath();ctx.rect(-7,-7,14,14)}
else{ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-8,-6);ctx.lineTo(-4,0);ctx.lineTo(-8,6);ctx.closePath()}
ctx.fill();ctx.stroke();ctx.restore();
}
}
function settle(){if(!queue.length&&!current){const waiting=resolvers;resolvers=[];waiting.forEach(resolve=>resolve())}}
function tick(now,token){
if(token!==generation)return;
frame=0;
let budget=0;
let nextStart = now;
while(budget++<300){
if (current) {
  const {command, start, duration} = current;
  const progress = Math.min(1, (now - start) / duration);
  const x = command.x0 + (command.x - command.x0) * progress;
  const y = command.y0 + (command.y - command.y0) * progress;
  Object.assign(turtles.get(command.id), {x, y});
  Object.assign(current, {x, y});
  if (progress < 1) break;
  drawMark(command);
  history.push(command);
  nextStart = start + duration;
  current = null;
}
const c=queue.shift();if(!c)break;
if(c.op==='pose')turtles.set(c.id,c);
if(c.op==='move'){
if(!turtles.has(c.id))turtles.set(c.id,{...c,angle:0,visible:true,shape:'classic'});
const duration = animated && c.speed
  ? Math.min(1000, Math.hypot(c.x-c.x0, c.y-c.y0) * 12 / (c.speed+1)) / animationMultiplier
  : 0;
if (duration > 0) {
  current = {command: c, start: nextStart, duration, x: c.x0, y: c.y0};
  // Use the rest of this frame for short moves, such as the segments of a circle.
  continue;
}
drawMark(c);history.push(c);Object.assign(turtles.get(c.id),{x:c.x,y:c.y});
}
if(['dot','fill','write'].includes(c.op)){history.push(c);drawMark(c)}
if(c.op==='clear'){history=history.filter(mark=>mark.id!==c.id);redrawArt()}
if(c.op==='clear_all'){history=[];turtles.clear();redrawArt()}
if(c.op==='background')background=c.color;
if(c.op==='title')panel.querySelector('#turtleTitle').textContent='🐢 '+c.text;
if(c.op==='tracer')animated=c.enabled;
if (c.op === 'animation_speed') animationMultiplier = c.multiplier;
if(c.op==='close')panel.hidden=true;
if(c.op==='setup'){
canvas.width=art.width=c.width;canvas.height=art.height=c.height;redrawArt();
}
}
render();
if(queue.length||current)frame=requestAnimationFrame(time=>tick(time,token));
else settle();
}
const bridge={
enqueue(text){
if(queue.length>=50000)throw new Error('Забагато команд turtle за один запуск');
const command=JSON.parse(text);
panel.hidden=false;queue.push(command);
if(!frame)frame=requestAnimationFrame(time=>tick(time,generation));
},
validColor(value){return typeof value==='string'&&CSS.supports('color',value)},
beginRun(){
generation++;if(frame)cancelAnimationFrame(frame);frame=0;queue=[];current=null;history=[];
turtles.clear();background='white';animated=true;canvas.width=art.width=640;canvas.height=art.height=480;
animationMultiplier = 1;
panel.querySelector('#turtleTitle').textContent='🐢 Черепашка';panel.hidden=true;render();settle();
},
finish(){return queue.length||current?new Promise(resolve=>resolvers.push(resolve)):Promise.resolve()},
get visible(){return !panel.hidden},
get canvas(){return canvas}
};
window.kodikTurtle=bridge;
let sourcePromise;
window.installKodikTurtle=async pyodide=>{
if(!sourcePromise)sourcePromise=fetch(new URL('turtle.py?v=animation-speed-1',document.baseURI)).then(response=>{
if(!response.ok)throw new Error('Не вдалося завантажити turtle');return response.text();
}).catch(error=>{sourcePromise=null;throw error});
const source=await sourcePromise;
pyodide.FS.writeFile('/home/pyodide/kodik_turtle.py',source);
pyodide.runPython("import importlib.util, sys\n_kodik_spec = importlib.util.spec_from_file_location('turtle', '/home/pyodide/kodik_turtle.py')\n_kodik_turtle = importlib.util.module_from_spec(_kodik_spec)\nsys.modules['turtle'] = _kodik_turtle\n_kodik_spec.loader.exec_module(_kodik_turtle)");
bridge.beginRun();
};
})();