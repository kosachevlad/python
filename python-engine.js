(()=>{
'use strict';
const badge=document.createElement('button');badge.type='button';badge.id='pythonEngineStatus';badge.className='engine-status';
badge.setAttribute('aria-live','polite');document.querySelector('.topbar').insertAdjacentElement('afterend',badge);
const base=new URL(window.KODIK_PYODIDE_URL||(window.KodikAndroid?'pyodide/':'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'),document.baseURI);
let pending=null,state='idle';
function update(next,message){state=next;badge.textContent=message;badge.dataset.state=next;badge.disabled=next==='loading'||next==='ready';window.dispatchEvent(new CustomEvent('kodik-engine-state',{detail:{state:next,message}}))}
update('idle','Python · підготувати');
async function loadScript(){
if(typeof window.loadPyodide==='function')return;
await new Promise((resolve,reject)=>{
const script=document.createElement('script');script.src=new URL('pyodide.js',base).href;script.async=true;
const timer=setTimeout(()=>{script.remove();reject(new Error('Не вдалося завантажити Python. Перевір інтернет і спробуй ще раз.'))},45000);
script.onload=()=>{clearTimeout(timer);resolve()};script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('Не вдалося завантажити Python. Перевір інтернет і спробуй ще раз.'))};document.head.append(script);
});
}
window.ensureKodikPython=()=>{
if(window.pyodide){update('ready','Python готовий');return Promise.resolve(window.pyodide)}
if(pending)return pending;
update('loading','Готую Python… Перший запуск потребує завантаження середовища.');
pending=(async()=>{await loadScript();window.pyodide=await window.loadPyodide({indexURL:base.href});update('ready','Python готовий');return window.pyodide})().catch(error=>{pending=null;update('error','Python не завантажився · натисни, щоб повторити');throw error});
return pending;
};
window.kodikEngine={get state(){return state}};
badge.onclick=()=>window.ensureKodikPython().catch(()=>{});
// Prepare while the pupil reads/types; Data Saver and very slow connections opt out.
const connection=navigator.connection;
if(!connection?.saveData&&!['slow-2g','2g'].includes(connection?.effectiveType)){
setTimeout(()=>{if(document.visibilityState==='visible')window.ensureKodikPython().catch(()=>{})},1800);
}
})();
