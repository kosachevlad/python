(()=>{
'use strict';
const $=id=>document.getElementById(id),choose=(uk,en)=>lang==='en'?en:uk;
const panel=document.createElement('section');panel.className='diagnostics-panel';panel.hidden=true;panel.setAttribute('aria-label','Python diagnostics');
document.querySelector('.workspace').insertAdjacentElement('beforebegin',panel);
const check=document.createElement('button');check.id='checkPython';check.type='button';check.className='edit-action';
document.querySelector('.edit-actions').append(check);
let installed=null,loading=null,items=[],checking=false,runtimeError=false,dismissed=false;
const lessonRoot='/home/pyodide/kodik-lessons/',projectRoot='/home/pyodide/kodik-project/';
function path(){
if(window.kodikIDE?.active){const s=kodikIDE.getState();return projectRoot+(s.nodes.find(n=>n.id===s.activeId)?.path||'main.py')}
return lessonRoot+(tabs[active]?.name||'main.py');
}
function sources(){
const result={};
if(window.kodikIDE?.active){for(const n of kodikIDE.getState().nodes)if(n.type==='file'&&n.encoding==='utf8'&&n.path.endsWith('.py'))result[projectRoot+n.path]=n.content}
else for(const tab of tabs)result[lessonRoot+tab.name]=tab.code;
result[path()]=$('editor').value;return result;
}
function format(item){
const where=item.line?`${item.file}:${item.line}:${item.column}`:item.file;
return `${item.severity==='warning'?'⚠':'❌'} ${where} — ${item.title}\n${item.hint}`+(item.text?`\n${item.text}\n${' '.repeat(Math.max(0,item.column-1))}${'^'.repeat(Math.max(1,Math.min(60,item.endColumn-item.column)))}`:'')+`\n${choose('Деталі','Details')}: ${item.type}: ${item.details}`;
}
function markers(){
const here=path(),code=$('editor').value,lines=new Set(items.filter(i=>i.path===here&&i.source===code).map(i=>i.line));
const gutter=document.querySelectorAll('#gutter .gutter-line'),rows=document.querySelector('.code-highlight')?.children||[];
for(let i=0;i<rows.length;i++){rows[i].classList.toggle('diagnostic-line',lines.has(i+1));gutter[i]?.classList.toggle('diagnostic-gutter',lines.has(i+1))}
}
function jump(item){
if(!item.line)return;
if(waiting||checking||$('run').disabled){$('diagnosticStatus').textContent=choose('Заверши поточне введення або виконання перед переходом.','Finish the current input or execution before navigating.');return}
const current=sources()[item.path];
if(current!==item.source){$('diagnosticStatus').textContent=choose('Код уже змінено. Натисни «Перевірити код» ще раз.','The code has changed. Check it again.');return}
if(item.path.startsWith(projectRoot)&&window.kodikIDE?.active){if(!kodikIDE.openFile(item.path.slice(projectRoot.length)))return}
else if(item.path.startsWith(lessonRoot)&&!window.kodikIDE?.active){save();const id=tabs.findIndex(t=>lessonRoot+t.name===item.path);if(id<0)return;if(id!==active){const previousOutput=$('output').textContent;active=id;renderAll();$('output').textContent=previousOutput}}
else return;
window.kodikMobile?.view('code');
const editor=$('editor'),lines=editor.value.split('\n');
const lineStart=lines.slice(0,item.line-1).reduce((sum,line)=>sum+line.length+1,0);
// Python columns count Unicode code points; textarea selections count UTF-16 units.
const before=Array.from(lines[item.line-1]||'').slice(0,item.column-1).join('').length;
const span=Array.from(lines[item.line-1]||'').slice(item.column-1,item.endColumn-1).join('').length;
editor.focus({preventScroll:true});editor.setSelectionRange(lineStart+before,lineStart+before+Math.max(1,span));
editor.scrollTop=Math.max(0,(item.line-1)*24-editor.clientHeight/3);editor.scrollIntoView({block:'center',behavior:'instant'});markers();
}
function render(showClean=false){
panel.replaceChildren();panel.hidden=dismissed||(!items.length&&!showClean);
const header=document.createElement('div');header.className='diagnostics-header';
const heading=document.createElement('h2');heading.textContent=choose('Перевірка Python','Python check');
const close=document.createElement('button');close.type='button';close.className='diagnostics-close';close.textContent='×';
close.setAttribute('aria-label',choose('Закрити повідомлення перевірки Python','Close Python check message'));
close.title=choose('Закрити','Close');
close.onclick=()=>{dismissed=true;panel.hidden=true;const target=check.getClientRects().length?check:$('mobileResult')||$('run');target?.focus({preventScroll:true})};
header.append(heading,close);panel.append(header);
const status=document.createElement('p');status.id='diagnosticStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
status.textContent=items.length?choose('Знайдено повідомлень: ','Messages found: ')+items.length:choose('Синтаксичних помилок і вибраних попереджень Pyflakes не знайдено. Логіку програми та всі помилки виконання це не перевіряє.','No syntax errors or selected Pyflakes warnings found. This does not verify program logic or all runtime errors.');panel.append(status);
for(const item of items){
const card=document.createElement('article');card.className='diagnostic-item '+item.severity;
const go=document.createElement('button');go.type='button';go.className='diagnostic-location';go.disabled=!item.line;
go.textContent=(item.line?`${item.file} · ${choose('рядок','line')} ${item.line}:${item.column}`:choose('Без позиції у коді','No user-code location'))+' — '+item.title;
go.onclick=()=>jump(item);card.append(go);
const hint=document.createElement('p');hint.textContent=item.hint;card.append(hint);
if(item.text){const code=document.createElement('pre');code.textContent=item.text+'\n'+' '.repeat(Math.max(0,item.column-1))+'^'.repeat(Math.max(1,Math.min(60,item.endColumn-item.column)));card.append(code)}
const details=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('pre');summary.textContent=choose('Технічні деталі','Technical details');text.textContent=item.type+': '+item.details;details.append(summary,text);card.append(details);panel.append(card);
}
markers();
}
async function install(py){
if(installed===py)return;
if(!loading)loading=Promise.all(['python-diagnostics.py','pyflakes-bundle.json'].map(name=>fetch(new URL(name+'?v=1.31',document.baseURI)).then(r=>{if(!r.ok)throw Error('Не вдалося завантажити '+name);return name.endsWith('.json')?r.json():r.text()}))).catch(e=>{loading=null;throw e});
const [source,bundle]=await loading;const root='/home/pyodide/kodik_tools';py.FS.mkdirTree(root+'/pyflakes');
py.FS.writeFile(root+'/python_diagnostics.py',source);for(const [name,text] of Object.entries(bundle.files))py.FS.writeFile(root+'/pyflakes/'+name,text);
py.runPython("import sys, importlib.util\nif '/home/pyodide/kodik_tools' not in sys.path:\n    sys.path.insert(0, '/home/pyodide/kodik_tools')\n_kd_spec = importlib.util.spec_from_file_location('_kodik_diagnostics', '/home/pyodide/kodik_tools/python_diagnostics.py')\n_kd = importlib.util.module_from_spec(_kd_spec)\nsys.modules['_kodik_diagnostics'] = _kd\n_kd_spec.loader.exec_module(_kd)");installed=py;
}
function register(forRun=false){window.pyodide.runPython('_kd.register(__import__("json").loads('+JSON.stringify(JSON.stringify(sources()))+'),'+JSON.stringify(lang)+','+(forRun?'True':'False')+')')}
function analyze(code,filename,lint=true){return JSON.parse(window.pyodide.runPython('_kd.check_json('+JSON.stringify(code)+','+JSON.stringify(filename)+','+(lint?'True':'False')+')'))}
function refresh(){check.textContent=choose('✓ Перевірити код','✓ Check code');check.disabled=checking||$('editor').readOnly||waiting||$('run').disabled;markers()}
window.kodikReportDiagnostic=text=>{
const item=JSON.parse(text);dismissed=false;runtimeError=true;items=items.filter(old=>!(old.path===item.path&&old.line===item.line));items.push(item);render();
};
check.onclick=async()=>{
if(checking||waiting||$('run').disabled||$('editor').readOnly)return;
checking=true;dismissed=false;$('run').disabled=true;refresh();
try{const py=await window.ensureKodikPython();await install(py);save();register();items=analyze($('editor').value,path());runtimeError=false;render(true)}
catch(error){items=[];render(true);$('diagnosticStatus').textContent=choose('Не вдалося перевірити код: ','Could not check code: ')+error.message}
finally{checking=false;$('run').disabled=false;refresh()}
};
const originalUpdate=updateLines;updateLines=()=>{originalUpdate();refresh()};
$('editor').addEventListener('input',()=>{items=items.filter(i=>i.path!==path());render()});
for(const event of ['keyup','click','select','focus','scroll'])$('editor').addEventListener(event,()=>requestAnimationFrame(markers));
$('uiLang').addEventListener('change',refresh);
window.KodikDiagnostics={install,currentPath:path,get checking(){return checking},get hasRuntimeError(){return runtimeError},get items(){return items.map(i=>({...i}))},format,
prepareRun(code,filename){dismissed=false;register(true);runtimeError=false;items=analyze(code,filename);render();const errors=items.filter(i=>i.severity==='error');if(errors.length){runtimeError=true;$('output').textContent=errors.map(format).join('\n\n');$('status').textContent=choose('Виправ помилку перед запуском','Fix the error before running');return false}return true},
replaceInputs(code,values){let i=0;return code.replace(inputPattern,match=>'('+JSON.stringify(values[i++]??'')+'\n'.repeat((match.match(/\n/g)||[]).length)+')')}
};
refresh();
})();
