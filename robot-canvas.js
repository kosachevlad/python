(()=>{
'use strict';
const panel=document.createElement('section');panel.className='robot-panel';panel.hidden=true;
panel.setAttribute('aria-label','Навчальний робот');
panel.innerHTML=`<div class="robot-heading"><strong>🤖 Робот</strong><label>Карта <select id="robotMap" aria-label="Карта робота"></select></label></div>
<div class="robot-toolbar"><button id="robotPlay">▶ Виконати</button><button id="robotStep">▸ Крок</button><button id="robotStop">⏸ Стоп</button><button id="robotReset">↺ Скинути</button></div>
<canvas id="robotCanvas" aria-label="Карта, робот і кристали"></canvas>
<div id="robotStatus" role="status"></div><div class="robot-options"><label>Швидкість <input id="robotSpeed" type="range" min="0" max="10" value="5"></label><label>Скін <select id="robotSkin"><option value="desert">Пісок</option><option value="grass">Трава</option><option value="mind">Космос</option><option value="lego">Конструктор</option><option value="default">Класичний</option></select></label><button id="robotLoad">Відкрити .map</button><input id="robotFile" type="file" accept=".map,text/plain" hidden></div>
<p class="robot-help">Обери карту → запусти Python → натисни «Виконати» або «Крок» тут. Змінив карту — запусти Python ще раз.</p>`;
document.querySelector('.share-code').insertAdjacentElement('beforebegin',panel);
const $=id=>panel.querySelector('#'+id),canvas=$('robotCanvas'),ctx=canvas.getContext('2d');
let frames=[],cursor=0,timer=0,prepared=false,data,selected='map1.map',custom='',speedOverride=null,skinOverride=null;
let failure='',bytes=0;
try{selected=localStorage.getItem('kodik-robot-map')||selected}catch{}
const palettes={desert:['#ebc887','#e2bc79','#6b625a','#888078'],grass:['#b0d18d','#a5c47d','#586d61','#708578'],mind:['#273756','#2d4061','#536382','#6b7c9c'],lego:['#ebd25b','#e5c94e','#b54b4d','#d46666'],default:['#dce5ec','#d0dce5','#60768b','#8096ac']};
function pause(){clearTimeout(timer);timer=0}
function status(text){$('robotStatus').textContent=text}
function draw(){
 const f=frames[cursor];if(!f)return;
 const p=palettes[skinOverride||f.skin]||palettes.desert,c=36;
 canvas.width=f.width*c;canvas.height=f.height*c;
 for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){
  const tile=f.rows[y]?.[x],wall=tile===undefined||/^[A-Z]$/.test(tile);
  ctx.fillStyle=wall?p[2]:p[(x+y)%2];ctx.fillRect(x*c,y*c,c,c);
  ctx.strokeStyle=wall?'#2228':'#0002';ctx.strokeRect(x*c+.5,y*c+.5,c-1,c-1);
  if(wall){ctx.fillStyle=p[3];ctx.fillRect(x*c+4,y*c+4,c-8,c-8);ctx.strokeStyle='#fff2';ctx.strokeRect(x*c+7,y*c+7,c-14,c-14)}
  if(f.paint[y]?.[x]){ctx.fillStyle=f.paint[y][x]==='w'?'#fff':'#222';ctx.beginPath();ctx.arc((x+.5)*c,(y+.5)*c,c*.27,0,Math.PI*2);ctx.fill()}
 }
 for(const e of f.energons){const x=(e.x+.5)*c,y=(e.y+.5)*c;ctx.fillStyle='#7361ff';ctx.strokeStyle='#d5ccff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-12);ctx.lineTo(x+10,y);ctx.lineTo(x,y+12);ctx.lineTo(x-10,y);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.fillRect(x-3,y-6,3,5)}
 ctx.save();ctx.translate((f.robot.x+.5)*c,(f.robot.y+.5)*c);ctx.rotate(f.robot.dir*Math.PI/2);
 ctx.fillStyle='#263748';ctx.fillRect(-15,-9,6,23);ctx.fillRect(9,-9,6,23);
 ctx.fillStyle=f.robot.bumped?'#ff7777':'#37d7bb';ctx.strokeStyle='#113f46';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-10,-12,20,25,5);ctx.fill();ctx.stroke();
 ctx.fillStyle='#153a48';ctx.fillRect(-7,-6,14,8);ctx.fillStyle='#fff';ctx.fillRect(-5,-5,3,3);ctx.fillRect(2,-5,3,3);
 ctx.fillStyle='#ffe184';ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(-5,-13);ctx.lineTo(5,-13);ctx.closePath();ctx.fill();ctx.restore();
 const end=cursor===frames.length-1;
 status(`${f.label||'Старт'} · крок ${cursor}/${frames.length-1} · 💎 ${f.collected}/${f.total}`+(end?(failure?' · '+failure:f.total>0&&f.collected===f.total?' · Усі кристали зібрано!':prepared?' · Завершено':''):''));
 $('robotPlay').disabled=!prepared||frames.length<2;
 $('robotStep').disabled=!prepared||cursor>=frames.length-1;
}
function step(){pause();if(!prepared)return;if(cursor<frames.length-1)cursor++;draw()}
function tick(){timer=0;if(cursor>=frames.length-1)return;cursor++;draw();if(cursor<frames.length-1){const s=speedOverride??frames[cursor].speed;timer=setTimeout(tick,50+4.6*(10-s)**2)}}
$('robotPlay').onclick=()=>{pause();if(!prepared)return;if(cursor===frames.length-1)cursor=0;tick()};
$('robotStep').onclick=step;$('robotStop').onclick=pause;$('robotReset').onclick=()=>{pause();cursor=0;draw()};
$('robotSpeed').oninput=e=>{speedOverride=Number(e.target.value)};
$('robotSkin').onchange=e=>{skinOverride=e.target.value;draw()};
$('robotMap').onchange=e=>{selected=e.target.value;try{localStorage.setItem('kodik-robot-map',selected)}catch{}invalidate()};
function invalidate(){pause();frames=[];cursor=0;prepared=false;ctx.clearRect(0,0,canvas.width,canvas.height);$('robotPlay').disabled=$('robotStep').disabled=true;status('Карту змінено. Натисни «Запустити» над редактором.')}
$('robotLoad').onclick=()=>$('robotFile').click();
$('robotFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw Error('Максимум 1 МБ');custom=await file.text();if(!/^map:/m.test(custom))throw Error('Немає секції map:');let option=$('robotMap').querySelector('[value="custom"]');if(!option){option=new Option('Власна карта','custom');$('robotMap').add(option)}selected='custom';$('robotMap').value=selected;invalidate()}catch(error){status(error.message)}finally{e.target.value=''}};
window.KodikRobot={
 enqueue(text){bytes+=text.length;if(frames.length>=10000||bytes>16000000)throw Error('Завелика програма robot; скороти кількість кроків');panel.hidden=false;frames.push(JSON.parse(text));if(frames.length===1)draw()},
 mapText(){return selected==='custom'?custom:data.maps[selected]||data.maps['map1.map']},
 beginRun(){pause();frames=[];bytes=0;cursor=0;prepared=false;failure='';speedOverride=skinOverride=null;panel.hidden=true},
 finish(){if(!frames.length)return;prepared=true;cursor=0;failure=frames.at(-1).robot.bumped?'Зіткнення! Перевір повідомлення у виводі.':'';draw();$('robotSpeed').value=frames.at(-1).speed;$('robotSkin').value=frames.at(-1).skin},
 get visible(){return !panel.hidden},get state(){return {cursor,count:frames.length,prepared,frame:frames[cursor],playing:!!timer}},get canvas(){return canvas}
};
let sourcePromise;
window.installKodikRobot=async py=>{
 window.KodikRobot.beginRun();
 if(!sourcePromise)sourcePromise=fetch(new URL('robot-bundle.json?v=1.25',document.baseURI)).then(r=>{if(!r.ok)throw Error('Не вдалося завантажити robot');return r.json()}).catch(e=>{sourcePromise=null;throw e});
 data=await sourcePromise;
 if(!$('robotMap').options.length){for(const name of Object.keys(data.maps))$('robotMap').add(new Option(name,name));if(!data.maps[selected])selected='map1.map';$('robotMap').value=selected}
 py.FS.mkdirTree('/home/pyodide/kodik_robot/robot/maps');
 for(const [name,source] of Object.entries(data.files))py.FS.writeFile('/home/pyodide/kodik_robot/robot/'+name,source);
 for(const [name,source] of Object.entries(data.maps))py.FS.writeFile('/home/pyodide/kodik_robot/robot/maps/'+name,source);
 py.runPython("import sys\nfor _name in list(sys.modules):\n    if _name == 'robot' or _name.startswith('robot.'):\n        del sys.modules[_name]\nif '/home/pyodide/kodik_robot' not in sys.path:\n    sys.path.insert(0, '/home/pyodide/kodik_robot')");
};
})();
