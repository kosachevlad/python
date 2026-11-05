(()=>{
'use strict';
const {Project,path:cleanPath,parent,base,uid}=KodikProjectStore;
const {Runtime,encode,bytesToBase64,base64ToBytes}=KodikProjectRuntime;
const KEY='kodik-project-v1',BACKUP='kodik-project-backup-v1',MODE='kodik-mode-v1';
const original={save,renderAll,renderTabs,run,executeCode,insert};
let project,enabled=false,busy=false,execution=null,runtime=null,setupPromise=null,backupState=null;
let simpleState=null,captureScheduled=false,needsMigration=false,storageBlocked=false;
const byId=id=>document.getElementById(id);
const toolbar=document.createElement('div');toolbar.className='ide-toolbar';
toolbar.innerHTML='<div class="ide-modes" role="group" aria-label="Режим Кодика"><button type="button" id="modeSimple">Навчання</button><button type="button" id="modeIDE">Міні-IDE</button></div><button type="button" id="ideFilesToggle" hidden>📁 Файли</button><div class="ide-tools" hidden><button type="button" id="projectName" title="Перейменувати проєкт"></button><button type="button" id="projectDemo">Приклад</button><button type="button" id="projectImport">Відкрити проєкт</button><button type="button" id="projectExport">Зберегти проєкт</button><button type="button" id="projectRestore" title="Відновити попередній стан">↶ Відновити</button></div>';
document.querySelector('.topbar').insertAdjacentElement('afterend',toolbar);
const card=document.querySelector('.card'),editorArea=document.createElement('div');editorArea.className='ide-editor-area';
while(card.firstChild)editorArea.append(card.firstChild);
card.append(editorArea);
const explorer=document.createElement('aside');explorer.className='ide-explorer';explorer.hidden=true;
explorer.innerHTML='<div class="ide-explorer-title">ПРОЄКТ</div><div class="ide-file-actions"><button type="button" id="ideNewFile" title="Створити файл">＋ Файл</button><button type="button" id="ideNewFolder" title="Створити папку">＋ Папка</button><button type="button" id="ideRename" aria-label="Перейменувати вибране" title="Перейменувати вибране">✎</button><button type="button" id="ideDelete" aria-label="Видалити вибране" title="Видалити вибране">⌫</button></div><div id="ideTree" class="ide-tree" role="tree" aria-label="Файли проєкту"></div><div class="ide-explorer-footer"><button type="button" id="ideImportFiles">Додати файли</button><button type="button" id="ideDownloadFile">Зберегти файл</button><span id="ideSummary"></span></div>';
card.prepend(explorer);
const breadcrumb=document.createElement('div');breadcrumb.className='ide-breadcrumb';breadcrumb.hidden=true;
editorArea.prepend(breadcrumb);
const notice=document.createElement('p');notice.className='ide-notice';notice.hidden=true;notice.setAttribute('role','status');toolbar.insertAdjacentElement('afterend',notice);
const importProjectInput=document.createElement('input');importProjectInput.id='ideProjectUpload';importProjectInput.type='file';importProjectInput.accept='application/json,.json';importProjectInput.hidden=true;
const importFilesInput=document.createElement('input');importFilesInput.id='ideFilesUpload';importFilesInput.type='file';importFilesInput.multiple=true;importFilesInput.hidden=true;
document.body.append(importProjectInput,importFilesInput);
const dialog=document.createElement('dialog');dialog.className='ide-dialog';dialog.setAttribute('aria-labelledby','ideDialogTitle');
dialog.innerHTML='<form><h2 id="ideDialogTitle"></h2><p id="ideDialogText"></p><label id="ideDialogLabel"><span></span><input id="ideDialogInput" autocomplete="off" spellcheck="false"></label><p class="ide-dialog-error" role="alert"></p><div><button type="button" id="ideDialogCancel">Скасувати</button><button type="submit" id="ideDialogSubmit">Зберегти</button></div></form>';
document.body.append(dialog);
function showNotice(text,error=false){notice.hidden=!text;notice.textContent=text;notice.classList.toggle('is-error',error)}
function safeJSON(key){try{const value=localStorage.getItem(key);return value?JSON.parse(value):null}catch{return null}}
let rawStored=null;try{rawStored=localStorage.getItem(KEY)}catch{}
try{project=rawStored?new Project(JSON.parse(rawStored)):Project.fromTabs(tabs);needsMigration=!rawStored}
catch{project=Project.fromTabs(tabs);needsMigration=true;try{localStorage.setItem(KEY+'-recovery',rawStored)}catch{storageBlocked=true}showNotice('Збережений проєкт має помилку. Його початкові дані збережено для відновлення; експортуй поточний проєкт перед змінами.',true)}
backupState=safeJSON(BACKUP);
function persist(){
try{if(storageBlocked)throw new Error('Recovery storage unavailable');localStorage.setItem(KEY,JSON.stringify(project.snapshot()));byId('saved').textContent='● Збережено локально';return true}
catch{byId('saved').textContent='● Потрібен експорт';showNotice('У сховищі бракує місця. Збережи проєкт у файл, щоб не втратити зміни.',true);return false}
}
function backup(){backupState=project.snapshot();try{localStorage.setItem(BACKUP,JSON.stringify(backupState))}catch{}refreshControls()}
function ask({title,text='',label='',value='',action='Зберегти',danger=false,validate=null}){
return new Promise(resolve=>{
byId('ideDialogTitle').textContent=title;byId('ideDialogText').textContent=text;
const input=byId('ideDialogInput');input.value=value;
byId('ideDialogLabel').hidden=!label;byId('ideDialogLabel').querySelector('span').textContent=label;
byId('ideDialogSubmit').textContent=action;byId('ideDialogSubmit').classList.toggle('danger',danger);
dialog.querySelector('.ide-dialog-error').textContent='';
const close=value=>{dialog.close();resolve(value)};
byId('ideDialogCancel').onclick=()=>close(null);
dialog.oncancel=e=>{e.preventDefault();close(null)};
dialog.querySelector('form').onsubmit=e=>{
e.preventDefault();
try{if(validate)validate(input.value);close(label?input.value:true)}
catch(error){dialog.querySelector('.ide-dialog-error').textContent=error.message}
};
dialog.showModal();if(label){input.focus();input.select()}else byId('ideDialogCancel').focus();
});
}
const guarded=fn=>async()=>{try{await fn()}catch(error){showNotice(error.message||String(error),true)}};
function selected(){return project.get(project.state.selectedId)}
function saveEditor(){
if(!enabled)return;
const file=project.active();
if(file?.type==='file'&&file.encoding==='utf8'&&!byId('editor').readOnly){
project.update(file.id,byId('editor').value);
const tab=tabs[active];if(tab)tab.code=byId('editor').value;
persist();
}
}
function capture(force=false){
if(!runtime?.projectId||(!force&&busy))return;
if(enabled)saveEditor();
const result=runtime.capture(project);
if(result.changed){persist();if(enabled)renderIDE()}
if(result.conflicts.length)showNotice('Зміни редактора збережено. Окремі версії Python: '+result.conflicts.join(', '));
}
function syncMutation(){persist();if(runtime?.projectId===project.state.id)runtime.write(project);renderIDE()}
function tree(){
const container=byId('ideTree');container.replaceChildren();
function children(folder,depth,group){
for(const node of project.children(folder)){
const button=document.createElement('button');button.type='button';button.className='ide-tree-item';
button.style.paddingLeft=(12+depth*15)+'px';button.dataset.fileId=node.id;button.dataset.path=node.path;
button.setAttribute('role','treeitem');button.setAttribute('aria-selected',String(node.id===project.state.selectedId));button.title=node.path;
const expanded=project.state.expanded.includes(node.path);
button.textContent=(node.type==='dir'?(expanded?'▾ 📁 ':'▸ 📁 '):node.path.endsWith('.py')?'🐍 ':node.encoding==='base64'?'◈ ':'▤ ')+base(node.path);
if(node.type==='dir')button.setAttribute('aria-expanded',String(expanded));
button.onclick=()=>{if(busy)return;saveEditor();capture();if(node.type==='dir'){project.state.selectedId=node.id;project.toggle(node.path);persist();tree();refreshControls()}else{project.open(node.id);persist();renderIDE()}};
button.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){const all=[...container.querySelectorAll('button')],i=all.indexOf(button);all[Math.max(0,Math.min(all.length-1,i+(e.key==='ArrowDown'?1:-1)))]?.focus();e.preventDefault()}};
group.append(button);
if(node.type==='dir'&&expanded){const sub=document.createElement('div');sub.setAttribute('role','group');children(node.path,depth+1,sub);group.append(sub)}
}
}
children('',0,container);
if(!project.state.nodes.length){const empty=document.createElement('p');empty.className='ide-empty';empty.textContent='Проєкт порожній. Створи файл або додай готовий.';container.append(empty)}
}
function renderProjectTabs(){
const container=byId('tabs');container.replaceChildren();
for(const id of project.state.openIds){
const file=project.get(id);if(!file)continue;
const item=document.createElement('div');item.className='ide-tab-group';
const button=document.createElement('button');button.type='button';button.className='tab '+(id===project.state.activeId?'active':'');button.textContent=base(file.path);button.title=file.path;
button.onclick=()=>{if(busy)return;saveEditor();capture();project.open(id);persist();renderIDE()};
const close=document.createElement('button');close.type='button';close.className='ide-tab-close';close.textContent='×';close.setAttribute('aria-label','Закрити вкладку '+file.path);
close.onclick=()=>{if(busy)return;saveEditor();project.close(id);persist();renderIDE()};
item.append(button,close);container.append(item);
}
const add=document.createElement('button');add.type='button';add.id='add';add.className='tab add';add.textContent='+';add.setAttribute('aria-label','Створити файл');add.onclick=guarded(newFile);container.append(add);
}
function renderIDE(){
if(!enabled)return;
const file=project.active();
tabs=project.state.openIds.map(id=>{const n=project.get(id);return {id:project.state.id+':'+id,name:n.path,code:n.content}});
active=Math.max(0,project.state.openIds.indexOf(project.state.activeId));
const editor=byId('editor'),binary=file?.encoding==='base64';
const value=!file?'Створи або відкрий файл у дереві проєкту.':binary?'Бінарний файл: '+file.path+'\n\nЙого можна читати з Python або зберегти на пристрій.':file.content;
if(editor.value!==value){editor.value=value;editor.setSelectionRange(0,0)}
editor.readOnly=!file||binary;
breadcrumb.textContent=file?file.path+(binary?' · бінарний файл':''):'Мій проєкт';
byId('projectName').textContent='📁 '+project.state.name;
renderProjectTabs();tree();updateLines();window.kodikHistory?.sync();refreshControls();
}
function refreshControls(){
const isIDE=enabled,file=project.active(),canRun=file?.type==='file'&&file.encoding==='utf8'&&file.path.endsWith('.py');
byId('modeSimple').setAttribute('aria-pressed',String(!isIDE));byId('modeIDE').setAttribute('aria-pressed',String(isIDE));
byId('modeSimple').disabled=byId('modeIDE').disabled=busy||waiting;
toolbar.querySelector('.ide-tools').hidden=!isIDE;byId('ideFilesToggle').hidden=!isIDE;
for(const button of explorer.querySelectorAll('button'))button.disabled=busy;
for(const button of byId('tabs').querySelectorAll('button'))if(isIDE)button.disabled=busy;
for(const button of toolbar.querySelectorAll('.ide-tools button'))button.disabled=busy;
byId('projectRestore').disabled=busy||!backupState;
byId('ideRename').disabled=byId('ideDelete').disabled=busy||!selected();
byId('ideDownloadFile').disabled=busy||selected()?.type!=='file';
byId('run').disabled=busy||(isIDE&&!canRun);
byId('run').title=isIDE&&!canRun?'Відкрий Python-файл (.py)':'Запустити поточний Python-файл';
byId('editor').disabled=busy;
byId('ideSummary').textContent=project.state.nodes.filter(n=>n.type==='file').length+' файлів · на цьому пристрої';
}
function setBusy(value){busy=value;refreshControls();window.kodikHistory?.sync()}
function mode(value){
if(busy||waiting||enabled===value)return;
if(value){original.save();simpleState={tabs,active};if(needsMigration){project=Project.fromTabs(tabs);project.state.activeId=project.state.selectedId=project.state.openIds[active]||project.state.openIds[0]||null;needsMigration=false}enabled=true}
else{saveEditor();capture();enabled=false;tabs=simpleState.tabs;active=simpleState.active;byId('editor').readOnly=false}
card.classList.toggle('ide-active',enabled);explorer.hidden=!enabled;breadcrumb.hidden=!enabled;notice.hidden=!enabled||!notice.textContent;
localStorage.setItem(MODE,enabled?'ide':'simple');
if(enabled){persist();renderIDE()}
else{original.renderAll();window.kodikHistory?.sync();refreshControls()}
}
save=()=>{if(enabled)saveEditor();else original.save()};
renderTabs=()=>{if(enabled)renderProjectTabs();else original.renderTabs()};
renderAll=()=>{if(enabled)renderIDE();else{original.renderAll();window.kodikHistory?.sync()}};
insert=value=>{if(!byId('editor').readOnly&&!busy)original.insert(value)};
async function newFile(){
if(busy)return;
saveEditor();capture();
const folder=project.selectedFolder(),value=(folder?folder+'/':'')+'file.py';
const name=await ask({title:'Новий файл',label:'Шлях у проєкті',value,action:'Створити',validate:value=>{const copy=new Project(project.snapshot());copy.create(value)}});
if(name===null)return;project.create(name,'file','');syncMutation();byId('editor').focus();
}
async function newFolder(){
if(busy)return;
saveEditor();capture();
const folder=project.selectedFolder();
const name=await ask({title:'Нова папка',label:'Шлях у проєкті',value:(folder?folder+'/':'')+'folder',action:'Створити',validate:value=>{const copy=new Project(project.snapshot());copy.create(value,'dir')}});
if(name===null)return;project.create(name,'dir');syncMutation();
}
async function rename(){
if(busy||!selected())return;
const id=project.state.selectedId;saveEditor();capture();const node=project.get(id);if(!node)return;
const value=await ask({title:'Перейменувати',label:'Шлях у проєкті',value:node.path,validate:value=>{const copy=new Project(project.snapshot());copy.rename(node.id,value)}});
if(value===null)return;backup();project.rename(node.id,value);syncMutation();
}
async function remove(){
if(busy||!selected())return;
const id=project.state.selectedId;saveEditor();capture();const node=project.get(id);if(!node)return;const count=project.state.nodes.filter(n=>n.type==='file'&&(n.path===node.path||n.path.startsWith(node.path+'/'))).length;
const yes=await ask({title:'Видалити '+(node.type==='dir'?'папку':'файл')+'?',text:'«'+node.path+'»'+(node.type==='dir'?' · файлів: '+count:'')+'. Попередній стан можна повернути кнопкою «Відновити».',action:'Видалити',danger:true});
if(!yes)return;backup();project.remove(node.id);syncMutation();
}
function clearRuntime(){
if(runtime?.projectId){capture();runtime.leave();
if(window.pyodide)window.pyodide.runPython("import sys\n_old_tk=sys.modules.get('tkinter')\nif _old_tk is not None and hasattr(_old_tk,'_cleanup'):\n    _old_tk._cleanup()");
window.KodikRobot?.beginRun();window.KodikTk?.reset();window.kodikTurtle?.beginRun()}
}
function replaceProject(next){
saveEditor();capture();backup();clearRuntime();project=next;project.state.id=uid();window.kodikHistory?.clear();
persist();renderIDE();byId('output').textContent=examples[lang].ready;
}
async function demo(){
if(busy)return;
const yes=await ask({title:'Відкрити навчальний проєкт?',text:'Поточний проєкт буде замінено прикладом. Його копія залишиться під кнопкою «Відновити».',action:'Відкрити приклад'});
if(!yes)return;
const next=Project.empty('Мій перший проєкт');
const main=next.create('main.py','file','from helpers import greeting\nfrom pathlib import Path\n\nnames = Path("data/names.txt").read_text(encoding="utf-8").splitlines()\nfor name in names:\n    print(greeting(name))\n\nPath("result.txt").write_text("\\n".join(greeting(name) for name in names), encoding="utf-8")\nprint("Створено result.txt — відкрий його в дереві.")\n');
next.create('helpers.py','file','def greeting(name):\n    return f"Привіт, {name}! 👋"\n');
next.create('data/names.txt','file','Оля\nМаксим\nСофія\n');
next.state.openIds=[main.id];next.state.activeId=next.state.selectedId=main.id;replaceProject(next);showNotice('Запусти main.py: він імпортує helpers.py, читає data/names.txt і створює result.txt.');
}
async function download(name,bytes,mime){
if(window.KodikAndroid?.saveFile){
if(!KodikAndroid.saveFile(name,bytesToBase64(bytes),mime))throw new Error('Не вдалося відкрити збереження файлу');
showNotice('Вибери місце збереження у вікні Android.');return;
}
const blob=new Blob([bytes],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportProject(){
saveEditor();capture();persist();
const filename=(project.state.name.replace(/[\\/:*?"<>|]/g,'_')||'project')+'.kodik.json';
await download(filename,new TextEncoder().encode(JSON.stringify(project.snapshot(),null,2)),'application/json');
}
async function downloadFile(){
const id=project.state.selectedId;saveEditor();capture();const n=project.get(id);if(!n||n.type!=='file')return;
await download(base(n.path),n.encoding==='base64'?base64ToBytes(n.content):new TextEncoder().encode(n.content),n.encoding==='base64'?'application/octet-stream':'text/plain');
}
async function importProject(file){
const next=new Project(JSON.parse(await file.text()));
const yes=await ask({title:'Відкрити «'+next.state.name+'»?',text:'Поточний проєкт можна буде повернути кнопкою «Відновити».',action:'Відкрити'});
if(!yes)return;replaceProject(next);showNotice('Проєкт відкрито.');
}
async function importFiles(files){
saveEditor();capture();backup();const folder=project.selectedFolder();
for(const file of files){
const name=cleanPath((folder?folder+'/':'')+(file.webkitRelativePath||file.name));
const destination=project.unique(name),data=encode(new Uint8Array(await file.arrayBuffer()));
project.create(destination,'file',data.content,data.encoding);
}
syncMutation();showNotice('Додано файлів: '+files.length);
}
async function ensureRuntime(){
await window.ensureKodikPython();
await window.installKodikTurtle(window.pyodide);await window.installKodikTkinter(window.pyodide);await window.installKodikRobot(window.pyodide);
if(!runtime){
if(!setupPromise)setupPromise=fetch(new URL('project-runtime.py?v=1.24',document.baseURI)).then(response=>{if(!response.ok)throw new Error('Не вдалося завантажити режим проєкту');return response.text()}).catch(error=>{setupPromise=null;throw error});
runtime=new Runtime(window.pyodide,await setupPromise);
}
}
run=async()=>{
if(busy||waiting)return;
if(!enabled){
setBusy(true);
try{capture(true);runtime?.leave();await original.run()}finally{if(!waiting)setBusy(false)}
return;
}
saveEditor();const file=project.active();
if(!file||file.encoding!=='utf8'||!file.path.endsWith('.py'))return;
backup();setBusy(true);waiting=false;
byId('output').textContent='Запускаю Python…\n';byId('status').textContent='Завантажую Python 3…';
try{
await ensureRuntime();runtime.write(project);
execution={path:file.path,code:file.content};
pendingCode=file.content;pendingPrompts=[...pendingCode.matchAll(inputPattern)].map(m=>m[2]);collectedInputs=[];
if(pendingPrompts.length){waiting=true;byId('output').textContent+='\n'+pendingPrompts[0];byId('prompt').value='';byId('prompt').focus();byId('status').textContent='Очікую введення…'}
else await executeCode([]);
}catch(error){byId('output').textContent+='\n'+explainPythonError(error);byId('status').textContent='Помилка запуску';execution=null;waiting=false;setBusy(false)}
};
executeCode=async values=>{
if(!execution){try{await original.executeCode(values)}finally{setBusy(false)}return}
let index=0;const code=execution.code.replace(inputPattern,()=>JSON.stringify(values[index++]||''));
try{
const result=await runtime.execute(code,execution.path);
window.KodikRobot.finish();await window.kodikTurtle.finish();capture(true);
byId('output').textContent=byId('output').textContent.replace(/^Запускаю Python…\n?/,'');
byId('output').textContent+=result||(window.KodikRobot?.visible?'Робот готовий. Натисни «Виконати» під картою.':window.KodikTk?.visible?'Графічний застосунок запущено.':window.kodikTurtle?.visible?'Малюнок готовий.':'Код виконано без виводу.');
byId('status').textContent=(result.includes('Traceback (most recent call last)')?'Помилка · ':'Виконано · ')+execution.path;
}catch(error){byId('output').textContent+='\n'+explainPythonError(error);capture(true)}
finally{execution=null;waiting=false;setBusy(false)}
};
byId('run').onclick=run;
window.kodikProjectInput=text=>{
const value=window.prompt(text||'Введи відповідь для input()');
byId('output').textContent+='\n'+text+'\n> '+(value??'[скасовано]')+'\n';
return value;
};
window.addEventListener('kodik-python-change',()=>{
if(captureScheduled||busy||!runtime?.projectId)return;
captureScheduled=true;setTimeout(()=>{captureScheduled=false;try{capture()}catch(error){showNotice(error.message,true)}},0);
});
window.addEventListener('kodik-native-save',event=>showNotice(event.detail.ok?'Файл збережено.':event.detail.cancelled?'Збереження скасовано.':'Не вдалося зберегти файл.',!event.detail.ok&&!event.detail.cancelled));
byId('modeSimple').onclick=()=>mode(false);byId('modeIDE').onclick=()=>mode(true);
byId('ideFilesToggle').onclick=()=>{card.classList.toggle('ide-files-open');byId('ideFilesToggle').setAttribute('aria-expanded',String(card.classList.contains('ide-files-open')))};
byId('ideNewFile').onclick=guarded(newFile);byId('ideNewFolder').onclick=guarded(newFolder);byId('ideRename').onclick=guarded(rename);byId('ideDelete').onclick=guarded(remove);
byId('projectName').onclick=guarded(async()=>{const name=await ask({title:'Назва проєкту',label:'Назва',value:project.state.name,validate:value=>{if(!value.trim())throw new Error('Введи назву')}});if(name!==null){project.state.name=name.trim().slice(0,100);persist();renderIDE()}});
byId('projectDemo').onclick=guarded(demo);byId('projectExport').onclick=guarded(exportProject);
byId('projectImport').onclick=()=>{importProjectInput.value='';importProjectInput.click()};
byId('ideImportFiles').onclick=()=>{importFilesInput.value='';importFilesInput.click()};
byId('ideDownloadFile').onclick=guarded(downloadFile);
byId('projectRestore').onclick=guarded(async()=>{
if(!backupState)return;
const yes=await ask({title:'Відновити попередній стан?',text:'Поточний стан залишиться наступною копією для відновлення.',action:'Відновити'});
if(!yes)return;const next=new Project(backupState);replaceProject(next);showNotice('Попередній стан відновлено.');
});
importProjectInput.onchange=guarded(async()=>{if(importProjectInput.files[0])await importProject(importProjectInput.files[0])});
importFilesInput.onchange=guarded(async()=>{if(importFilesInput.files.length)await importFiles([...importFilesInput.files])});
window.addEventListener('keydown',e=>{if(enabled&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveEditor();showNotice('Проєкт збережено на цьому пристрої. Для копії файлом натисни «Зберегти проєкт».')}});
window.addEventListener('beforeunload',()=>{try{if(enabled){saveEditor();capture();persist()}}catch{}});
window.kodikIDE={get active(){return enabled},getState:()=>project.snapshot()};
refreshControls();
if(localStorage.getItem(MODE)==='ide')mode(true);
})();

