(()=>{
'use strict';
const media=matchMedia('(max-width:560px)'),byId=id=>document.getElementById(id);
const dock=document.createElement('nav');dock.className='mobile-dock';dock.setAttribute('aria-label','Редактор і виконання');
dock.innerHTML='<button type="button" id="mobileCode">⌨ Код</button><button type="button" id="mobileResult">▸ Результат</button><button type="button" id="mobileRun">▶ Запустити</button>';
document.body.append(dock);document.body.dataset.mobileView='code';
const code=byId('mobileCode'),result=byId('mobileResult'),launch=byId('mobileRun'),output=byId('output'),prompt=byId('prompt');
const heading=document.createElement('h2');heading.className='mobile-result-heading';heading.textContent='Результат виконання';document.querySelector('.side').prepend(heading);
function view(name,{focus=false}={}){
document.body.dataset.mobileView=name;
code.setAttribute('aria-pressed',String(name==='code'));result.setAttribute('aria-pressed',String(name==='result'));
if(media.matches){window.scrollTo({top:0,behavior:'instant'});if(focus&&name==='code')byId('editor').focus({preventScroll:true})}
}
function showPrompt(){
if(!media.matches||!waiting)return;
view('result');
const row=prompt.closest('.prompt-row');row.hidden=false;row.style.display='flex';
requestAnimationFrame(()=>{prompt.focus({preventScroll:true});prompt.scrollIntoView({block:'center',behavior:'instant'});output.scrollTop=output.scrollHeight});
}
function showResult(){
if(!media.matches)return;
view('result');output.scrollTop=output.scrollHeight;
const graphic=['.tk-panel','.robot-panel','.turtle-panel'].map(s=>document.querySelector(s)).find(p=>p&&!p.hidden);
if(graphic)requestAnimationFrame(()=>graphic.scrollIntoView({block:'start',behavior:'instant'}));
}
code.onclick=()=>view('code');result.onclick=()=>{view('result');if(waiting)showPrompt()};
launch.onclick=()=>byId('run').click();
const previousRun=run,previousExecute=executeCode;
let running=false;
run=async()=>{
if(running||waiting)return;
running=true;view('result');sync();
try{await previousRun()}finally{running=false;if(waiting)showPrompt();else showResult();sync()}
};
executeCode=async values=>{try{return await previousExecute(values)}finally{if(!waiting)showResult();sync()}};
byId('run').onclick=run;
let lastPrompt='';
function sync(){
launch.disabled=running||waiting||byId('run').disabled;
launch.textContent=waiting?'Введи відповідь':running?'Виконується…':'▶ Запустити';
result.textContent=waiting?'✎ Введення':'▸ Результат';
const question=waiting?output.textContent:'';
if(waiting&&question!==lastPrompt){lastPrompt=question;showPrompt()}else if(!waiting)lastPrompt='';
}
function viewport(){
const v=window.visualViewport;
const inset=v?Math.max(0,innerHeight-v.height-v.offsetTop):0;
document.documentElement.style.setProperty('--mobile-keyboard',inset+'px');
}
window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);
window.addEventListener('resize',viewport);media.addEventListener('change',()=>{viewport();sync()});
setInterval(sync,150);view('code');viewport();sync();
window.kodikMobile={view,get currentView(){return document.body.dataset.mobileView}};
})();
