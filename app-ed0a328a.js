
const starter=`name = input("Як тебе звати? ")\nprint(f"Привіт, {name}! 👋")\n\n# Спробуй змінити цей код\nfor i in range(3):\n    print("Python — це цікаво!", i + 1)`;
const examples={uk:{new:'Нова вкладка',run:'▶ Запустити',saved:'● Збережено локально',ready:'Готово до запуску. Натисни «Запустити», щоб побачити результат.',status:'Локальний режим · дані зберігаються на цьому пристрої',prompt:'Введи відповідь для input()…'},en:{new:'New tab',run:'▶ Run',saved:'● Saved locally',ready:'Ready to run. Press “Run” to see the result.',status:'Local mode · data is saved on this device',prompt:'Type an answer for input()…'}};
let lang=localStorage.getItem('kodik-lang')||'uk', tabs=JSON.parse(localStorage.getItem('kodik-tabs')||'null')||[{name:'main.py',code:starter}], active=0, waiting=false;
const $=id=>document.getElementById(id); const mobileSymbols=$('mobileSymbols')||document.createElement('div');mobileSymbols.className='mobile-symbols';mobileSymbols.id='mobileSymbols';document.querySelector('.card').insertBefore(mobileSymbols,document.querySelector('.editor-wrap'));[':', '=', '(', ')', '"', "'", '<', '>', '/', '*', '%', '+', '-', '[', ']', '{', '}'].forEach(k=>{let b=document.createElement('button');b.textContent=k;b.setAttribute('aria-label','Вставити '+k);b.onclick=()=>insert(k);mobileSymbols.appendChild(b)}); const normalize=s=>s.replace(/[“”„‟＂]/g,'"').replace(/[‘’‚‛＇]/g,"'");
function save(){tabs[active].code=normalize($('editor').value);localStorage.setItem('kodik-tabs',JSON.stringify(tabs));$('saved').textContent=examples[lang].saved; $('chars').textContent=$('editor').value.length}
function renderTabs(){ $('tabs').innerHTML=tabs.map((t,i)=>`<button class="tab ${i===active?'active':''}" data-i="${i}"><span>${t.name}</span><span class="tab-close" role="button" aria-label="Закрити ${t.name}" data-close="${i}">×</span></button>`).join('')+`<button class="tab add" id="add" aria-label="${examples[lang].new}">+</button>`;document.querySelectorAll('.tab[data-i]').forEach(b=>b.onclick=()=>{save();active=+b.dataset.i;renderAll()});document.querySelectorAll('.tab-close').forEach(b=>b.onclick=e=>{e.stopPropagation();save();let i=+b.dataset.close;if(tabs.length===1){tabs[0].code='';active=0}else{tabs.splice(i,1);if(active>i)active--;else if(active>=tabs.length)active=tabs.length-1}localStorage.setItem('kodik-tabs',JSON.stringify(tabs));renderAll()});$('add').onclick=()=>{save();tabs.push({name:`lesson-${tabs.length}.py`,code:'# Напиши свій код\n'});active=tabs.length-1;renderAll()}}
function renderAll(){renderTabs();$('editor').value=tabs[active].code;$('output').textContent=examples[lang].ready;updateLines();$('uiLang').value=lang}
function updateLines(){let n=$('editor').value.split('\n').length;$('gutter').textContent=Array.from({length:n},(_,i)=>i+1).join('\n');$('chars').textContent=$('editor').value.length}
const keys=['(',')','[',']','{','}','"',"'",':','=','+','-','*','/','_','<','>','@','#'];$('keys').innerHTML=keys.map(k=>`<button class="key" data-k="${k}">${k}</button>`).join('')+`<button class="key wide" data-k="    ">Tab ↹</button><button class="key wide" data-k="\n">↵ Enter</button>`;
document.querySelectorAll('.key').forEach(b=>b.onclick=()=>insert(b.dataset.k));function insert(v){let e=$('editor'),a=e.selectionStart,b=e.selectionEnd;e.setRangeText(v,a,b,'end');e.dispatchEvent(new Event('input',{bubbles:true}));e.focus()}
['print("Привіт, світе!")','name = input("Імʼя: ")','for i in range(5):\n    print(i)','if x > 0:\n    print("Так")'].forEach((v,i)=>{let b=document.createElement('button');b.textContent=['print()','input()','for loop','if'][i];b.onclick=()=>insert(normalize(v));$('quick').appendChild(b)});
(()=>{const b=document.createElement('button');b.textContent='🐢 Квадрат turtle';b.onclick=()=>insert("import turtle\n\npen = turtle.Turtle()\npen.color(\"blue\")\n\nfor i in range(4):\n    pen.forward(100)\n    pen.right(90)\n\nturtle.done()");$('quick').appendChild(b)})();
let pendingCode='',pendingPrompts=[],collectedInputs=[];
const inputPattern=/input\s*\(\s*(['"])(.*?)\1\s*\)/g;
function explainPythonError(error){return '❌ '+String(error?.message||error||'Помилка виконання')}
async function executeCode(values){
$('run').disabled=true;
const code=window.KodikDiagnostics.replaceInputs(pendingCode,values);
try{
const result=await pyodide.runPythonAsync('_kd.execute_simple('+JSON.stringify(code)+','+JSON.stringify(window.KodikDiagnostics.currentPath())+')');
window.KodikRobot.finish();await window.kodikTurtle.finish();
$('output').textContent+=(result||(window.KodikRobot?.visible?'Робот готовий. Натисни «Виконати» під картою.':window.KodikTk?.visible?'Графічний застосунок запущено.':window.kodikTurtle?.visible?'Малюнок готовий.':'Код виконано без виводу.'));
$('status').textContent=window.KodikDiagnostics.hasRuntimeError?'Сталася помилка':'Виконано · Python 3';
}catch(error){$('output').textContent+='\n'+explainPythonError(error);$('status').textContent='Сталася помилка'}finally{$('run').disabled=false}
}
async function run(){save();$('output').textContent='Запускаю Python…\n';$('status').textContent='Завантажую Python 3…';try{await window.ensureKodikPython();await window.installKodikTurtle(window.pyodide);await window.installKodikTkinter(window.pyodide);await window.installKodikRobot(window.pyodide);await window.KodikDiagnostics.install(window.pyodide);if(!window.KodikDiagnostics.prepareRun(tabs[active].code,window.KodikDiagnostics.currentPath()))return;pendingCode=normalize(tabs[active].code);pendingPrompts=[...pendingCode.matchAll(inputPattern)].map(m=>m[2]);collectedInputs=[];if(pendingPrompts.length){waiting=true;$('output').textContent+='\n'+pendingPrompts[0];$('prompt').value='';$('prompt').focus();$('status').textContent='Очікую введення…'}else await executeCode([])}catch(e){$('output').textContent+='\nПомилка запуску: '+e.message;$('status').textContent='Сталася помилка'}}
$('run').onclick=run;$('editor').addEventListener('input',()=>{updateLines();save()});$('editor').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();insert('    ')}if(e.key==='"'||e.key==="'"){e.preventDefault();insert(e.key)}});$('send').onclick=async()=>{if(!waiting)return;let value=$('prompt').value;collectedInputs.push(value);$('output').textContent+='\n> '+value;$('prompt').value='';if(collectedInputs.length<pendingPrompts.length){$('output').textContent+='\n'+pendingPrompts[collectedInputs.length];$('prompt').focus()}else{waiting=false;$('output').textContent+='\n';await executeCode(collectedInputs)}};$('prompt').onkeydown=e=>{if(e.key==='Enter')$('send').click()};$('uiLang').onchange=e=>{lang=e.target.value;localStorage.setItem('kodik-lang',lang);$('run').textContent=examples[lang].run;$('prompt').placeholder=examples[lang].prompt;$('status').textContent=examples[lang].status;renderTabs()};renderAll();
const terminal=document.querySelector('.terminal');const side=document.querySelector('.side');if(terminal&&side)side.prepend(terminal);


(()=>{
const editor=$('editor'),card=document.querySelector('.card'),bar=document.createElement('div');
bar.className='edit-actions';bar.innerHTML='<button class="edit-action" id="undo" type="button">↶ Відмінити</button><button class="edit-action" id="redo" type="button">↷ Повторити</button>';card.insertBefore(bar,mobileSymbols);
const histories=new Map();let count=0;
const key=()=>{const tab=tabs[active];return tab?(tab.id||(tab._historyId||=(++count)+'-simple')):null};
const current=()=>{const id=key();if(!id)return null;if(!histories.has(id))histories.set(id,{undo:[],redo:[],last:editor.value});return histories.get(id)};
const refresh=()=>{const h=current(),locked=editor.readOnly||editor.disabled;$('undo').disabled=locked||!h?.undo.length;$('redo').disabled=locked||!h?.redo.length};
const sync=()=>{const h=current();if(h)h.last=editor.value;refresh()};
const remember=()=>{const h=current();if(!h)return;if(h.last!==editor.value){h.undo.push(h.last);if(h.undo.length>100)h.undo.shift();h.redo=[];h.last=editor.value}refresh()};
const restore=value=>{editor.value=value;current().last=value;save();updateLines();refresh()};
$('undo').onclick=()=>{const h=current();if(!h||!h.undo.length||editor.readOnly||editor.disabled)return;h.redo.push(editor.value);restore(h.undo.pop())};
$('redo').onclick=()=>{const h=current();if(!h||!h.redo.length||editor.readOnly||editor.disabled)return;h.undo.push(editor.value);restore(h.redo.pop())};
editor.addEventListener('input',remember);
editor.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();$(e.key.toLowerCase()==='z'&&!e.shiftKey?'undo':'redo').click()}});
const oldRender=renderAll;renderAll=()=>{oldRender();sync()};
window.kodikHistory={sync,clear:()=>{histories.clear();sync()}};
sync();
})();


(()=>{const editor=$('editor'),gutter=$('gutter');const sync=()=>{gutter.scrollTop=editor.scrollTop};editor.addEventListener('scroll',sync);const oldUpdate=updateLines;updateLines=()=>{oldUpdate();sync()};sync()})();


(()=>{const bar=document.getElementById('mobileSymbols');if(!bar)return;const spacer=document.createElement('div');spacer.style.display='none';spacer.style.height=bar.offsetHeight+'px';bar.parentNode.insertBefore(spacer,bar);const update=()=>{if(window.innerWidth>560){bar.classList.remove('is-floating');spacer.style.display='none';return}if(!bar.classList.contains('is-floating')){if(spacer.getBoundingClientRect().top<0){spacer.style.display='block';spacer.style.height=bar.offsetHeight+'px';bar.classList.add('is-floating')}}else if(spacer.getBoundingClientRect().top>=0){bar.classList.remove('is-floating');spacer.style.display='none'}};window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);update()})();
const APP_VERSION='v1.31';console.info(`Кодик ${APP_VERSION} · версія застосунку`);const versionLabel=document.createElement('span');versionLabel.className='version';versionLabel.textContent=` (${APP_VERSION})`;document.querySelector('.brand h1')?.append(versionLabel);
(()=>{const editor=$('editor'),wrap=document.querySelector('.editor-wrap'),gutter=$('gutter');if(!editor||!wrap)return;const highlight=document.createElement('pre');highlight.className='code-highlight';wrap.insertBefore(highlight,editor);const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');const paint=line=>{
const keywords=new Set('def class if else elif for while in return import from as try except finally with and or not True False None'.split(' '));
const builtins=new Set('print input range len str int float list dict set open'.split(' '));
// Match source tokens once; never run substitutions over generated HTML.
const tokens=/#.*$|"(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?|\b[A-Za-z_]\w*\b|\b\d+(?:\.\d+)?\b/g;
let html='',offset=0;
for(const match of line.matchAll(tokens)){
const token=match[0],start=match.index;
let kind='';
if(token[0]==='#')kind='comment';
else if(token[0]==='"'||token[0]==="'")kind='string';
else if(keywords.has(token))kind='keyword';
else if(builtins.has(token))kind='builtin';
else if(/^\d/.test(token))kind='number';
else if(line[start+token.length]==='(')kind='function';
html+=esc(line.slice(offset,start));
html+=kind?'<span class="syntax-'+kind+'">'+esc(token)+'</span>':esc(token);
offset=start+token.length;
}
return html+esc(line.slice(offset))||' ';
};const update=()=>{const lines=editor.value.split('\n'),line=editor.value.slice(0,editor.selectionStart).split('\n').length;highlight.innerHTML=lines.map((v,i)=>`<span class="${i+1===line?'active-line':''}">${paint(v)}</span>`).join('\n');gutter.innerHTML=lines.map((_,i)=>`<span class="gutter-line ${i+1===line?'active':''}">${i+1}</span>`).join('');highlight.scrollTop=editor.scrollTop;highlight.scrollLeft=editor.scrollLeft};['input','keyup','click','select','focus'].forEach(e=>editor.addEventListener(e,update));editor.addEventListener('scroll',update);const old=updateLines;updateLines=()=>{old();update()};update()})();
console.info('Кодик v1.31 · версія застосунку');document.querySelectorAll('.version').forEach(e=>e.textContent='(v1.31)');
setTimeout(()=>{const h=document.querySelector('.brand h1');if(h)h.innerHTML='Кодик <span class="version">(v1.31)</span>'},0);
setTimeout(()=>{const h=document.querySelector('.brand h1');if(h)h.innerHTML='Кодик <span class="version">(v1.31)</span>'},0);
setTimeout(()=>{const h=document.querySelector('.brand h1');if(h)h.innerHTML='Кодик <span class="version">(v1.31)</span>'},0);
setTimeout(()=>{const h=document.querySelector('.brand h1');if(h)h.innerHTML='Кодик <span class="version">(v1.31)</span>'},0);
setTimeout(()=>{document.querySelectorAll('.tab').forEach(t=>t.scrollIntoView({inline:'nearest'}))},0);

setTimeout(()=>{const h=document.querySelector('.brand h1');if(h)h.innerHTML='Кодик <span class="version">(v1.31)</span>'},0);
setTimeout(()=>{const h=document.querySelector('.brand h1');if(h)h.innerHTML='Кодик <span class="version">(v1.31)</span>'},0);
setTimeout(()=>{const h=document.querySelector('.brand h1');if(h)h.innerHTML='Кодик <span class="version">(v1.31)</span>'},0);
(()=>{const originalExecuteCode=executeCode;executeCode=async values=>{await originalExecuteCode(values);const o=$('output');if(o)setTimeout(()=>{o.textContent=o.textContent.replace(/^Запускаю Python…\n?/,'').replace(/^Запускаю Python\.\.\.\n?/,'')},1000)}})();setInterval(()=>{const row=document.querySelector('.prompt-row');if(row)row.style.display=waiting?'flex':'none'},100);setInterval(()=>{const row=document.querySelector('.prompt-row');if(!row)return;try{const visible=typeof waiting!=='undefined'&&waiting===true;row.hidden=!visible;row.style.display=visible?'flex':'none'}catch(e){row.hidden=true;row.style.display='none'}},50);(()=>{const row=document.querySelector('.prompt-row');if(row){row.hidden=true;row.style.display='none'}setInterval(()=>{const r=document.querySelector('.prompt-row');if(!r)return;const visible=typeof waiting!=='undefined'&&waiting===true;r.hidden=!visible;r.style.display=visible?'flex':'none'},50)})();(()=>{const terminal=document.querySelector('.terminal');if(!terminal)return;const share=document.createElement('button');share.className='share-code';share.type='button';share.textContent='↗ Поділитись кодом і виконанням';share.style.cssText='margin-top:12px;width:100%;padding:12px 16px;border:1px solid #294565;border-radius:10px;background:#162d49;color:#eaf3ff;font:inherit;cursor:pointer';terminal.insertAdjacentElement('afterend',share);
const shareNotice=document.createElement('div');
shareNotice.className='share-notice';shareNotice.hidden=true;
shareNotice.style.cssText='margin-top:10px;padding:12px;border:1px solid #365171;border-radius:10px;color:#eaf3ff;background:#101d30;font-size:14px;line-height:1.5;overflow-wrap:anywhere';
shareNotice.setAttribute('aria-live','polite');
const shareMessage=document.createElement('p');shareMessage.style.margin='0';
const shareDownload=document.createElement('button');shareDownload.type='button';shareDownload.textContent='↓ Завантажити PNG';shareDownload.hidden=true;
shareDownload.style.cssText='margin-top:10px;padding:9px 12px;border:1px solid #365171;border-radius:8px;background:#1b3049;color:#eaf3ff;font:inherit;cursor:pointer';
shareNotice.append(shareMessage,shareDownload);share.insertAdjacentElement('afterend',shareNotice);
let preparedShareBlob=null;
const showShareNotice=(message,error=false)=>{
shareNotice.hidden=false;shareNotice.setAttribute('role',error?'alert':'status');
shareMessage.textContent=message;shareDownload.hidden=!preparedShareBlob;
};
const downloadShareImage=()=>{
if(!preparedShareBlob)return;
let url;
try{
url=URL.createObjectURL(preparedShareBlob);
const link=document.createElement('a');link.href=url;link.download='kodik-python.png';
document.body.appendChild(link);link.click();link.remove();
showShareNotice('Запит на завантаження PNG передано браузеру. Перевір список завантажень. Якщо нічого не сталося, відкрий сайт у звичайному браузері.');
}catch(error){
showShareNotice('Браузер не зміг почати завантаження. Відкрий сайт у Chrome або Safari та спробуй ще раз. Код помилки: '+(error.name||'UnknownError'),true);
}finally{if(url)setTimeout(()=>URL.revokeObjectURL(url),30000)}
};
shareDownload.onclick=downloadShareImage;
const makeImage=async()=>{
// Repaint first so programmatic edits and the active tab are reflected in the export.
updateLines();
if(document.fonts)await document.fonts.ready;
const code=$('editor')?.value||'',out=$('output')?.textContent||'';
const codeLines=code.split('\n'),outputLines=out.split('\n');
const rows=document.querySelector('.code-highlight')?.children;
const scale=2,pad=28,line=25,font='16px ui-monospace,Consolas,monospace';
const c=document.createElement('canvas'),x=c.getContext('2d');
x.font=font;
const numberWidth=x.measureText(String(codeLines.length)).width+24;
const codeX=pad+numberWidth;
// Size the PNG to visible content rather than a fixed 1000px minimum.
x.font='bold 22px sans-serif';
const titleWidth=x.measureText('Кодик — Python').width+pad*2;
x.font=font;
const headingWidth=x.measureText('──── Результат виконання ────').width+pad*2;
const width=Math.ceil(Math.max(titleWidth,headingWidth,...codeLines.map(v=>codeX+x.measureText(v.trimEnd()).width+pad),...outputLines.map(v=>pad*2+x.measureText(v.trimEnd()).width)));
const outputY=72+(codeLines.length+2)*line;
const drawing=window.kodikTurtle?.visible?window.kodikTurtle.canvas:null;
const drawingY=outputY+outputLines.length*line+pad;
const drawingWidth=drawing?Math.min(width-pad*2,drawing.width):0;
const drawingHeight=drawing?drawing.height*drawingWidth/drawing.width:0;
const height=drawingY+drawingHeight+pad;
c.width=width*scale;c.height=height*scale;
x.scale(scale,scale);
x.fillStyle='#08111f';x.fillRect(0,0,width,height);
x.fillStyle='#2bd9a7';x.font='bold 22px sans-serif';
x.fillText('Кодик — Python',pad,36);
x.font=font;
codeLines.forEach((text,i)=>{
const y=72+i*line;
x.fillStyle='#62758f';x.fillText(String(i+1),pad,y);
let left=codeX;
const row=rows?.[i];
// Use the editor's rendered tokens and CSS colors instead of another highlighter.
if(row&&row.textContent===(text||' ')){
for(const node of row.childNodes){
const value=node.textContent||'';
x.fillStyle=getComputedStyle(node.nodeType===1?node:row).color;
x.fillText(value,left,y);
left+=x.measureText(value).width;
}
}else{
x.fillStyle='#eaf4ff';x.fillText(text,left,y);
}
});
x.fillStyle='#8da2bd';x.fillText('──── Результат виконання ────',pad,outputY-line);
x.fillStyle='#dcecff';
outputLines.forEach((text,i)=>x.fillText(text,pad,outputY+i*line));
if(drawing)x.drawImage(drawing,pad,drawingY,drawingWidth,drawingHeight);
return new Promise((resolve,reject)=>c.toBlob(blob=>blob?resolve(blob):reject(new Error('Не вдалося створити зображення')),'image/png'));
};share.onclick=async()=>{
share.disabled=true;preparedShareBlob=null;shareDownload.hidden=true;
showShareNotice('Готую зображення…');
let phase='image';
try{
const blob=await makeImage();preparedShareBlob=blob;phase='share';
const file=new File([blob],'kodik-python.png',{type:'image/png'});
if(navigator.share&&navigator.canShare?.({files:[file]})){
await navigator.share({title:'Мій код Python',text:'Код і результат виконання з Кодика',files:[file]});
showShareNotice('Зображення передано системному меню поширення.');
}else{
showShareNotice('Цей браузер не підтримує поширення PNG. Зображення можна завантажити кнопкою нижче.');
downloadShareImage();
}
}catch(error){
const name=error.name||'UnknownError';
if(phase==='image'){
showShareNotice('Не вдалося створити PNG. Якщо коду або виводу багато, скороти його та спробуй ще раз. Код помилки: '+name,true);
}else if(name==='AbortError'){
showShareNotice('Поширення скасовано або немає доступних застосунків для надсилання. Можна завантажити PNG кнопкою нижче.');
}else{
const reasons={
NotAllowedError:'Браузер заблокував поширення. Можлива причина — обмеження браузера або затримка підготовки зображення.',
SecurityError:'Поширення заблоковане правилами безпеки браузера. Відкрий HTTPS-адресу сайту безпосередньо у браузері.',
InvalidStateError:'Інше вікно поширення вже відкрите або сторінка неактивна. Закрий його та повернися на сайт.',
TypeError:'Браузер не підтримує передавання цього зображення.',
DataError:'Не вдалося передати зображення вибраному застосунку.'
};
showShareNotice((reasons[name]||'Не вдалося відкрити меню поширення.')+' Спробуй завантажити PNG кнопкою нижче. Код помилки: '+name,true);
}
}finally{share.disabled=false}
}})();
