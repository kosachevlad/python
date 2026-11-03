(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KodikProjectStore=api})(globalThis,()=>{
'use strict';
const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
const clone=value=>JSON.parse(JSON.stringify(value));
function path(value){
if(typeof value!=='string'||value.length>1024||/[\x00-\x1f]/.test(value))throw new Error('Некоректний шлях');
value=value.replace(/\\/g,'/').trim();
if(!value||value.startsWith('/')||/^[A-Za-z]:/.test(value)||value.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Використай відносний шлях без «..»');
return value;
}
const parent=value=>value.includes('/')?value.slice(0,value.lastIndexOf('/')):'';
const base=value=>value.split('/').pop();
function validate(input){
if(!input||input.format!=='kodik-project'||input.version!==1||!Array.isArray(input.nodes))throw new Error('Це не проєкт Кодика');
if(input.nodes.length>3000)throw new Error('У проєкті забагато файлів');
const ids=new Set(),paths=new Map(),nodes=input.nodes.map(node=>{
const p=path(node.path),id=String(node.id||uid());
if(ids.has(id)||paths.has(p))throw new Error('У проєкті повторюються назви файлів');
if(!['file','dir'].includes(node.type))throw new Error('Невідомий тип файлу');
ids.add(id);paths.set(p,node.type);
if(node.type==='dir')return {id,path:p,type:'dir'};
const encoding=node.encoding||'utf8';
if(!['utf8','base64'].includes(encoding)||typeof node.content!=='string')throw new Error('Некоректний вміст файлу');
if(encoding==='base64'&&!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(node.content))throw new Error('Некоректний бінарний файл');
return {id,path:p,type:'file',encoding,content:node.content};
});
for(const node of nodes){
let dir=parent(node.path);
while(dir){if(paths.get(dir)!=='dir')throw new Error('Для файлу відсутня папка: '+dir);dir=parent(dir)}
}
const files=new Set(nodes.filter(n=>n.type==='file').map(n=>n.id));
const openIds=[...new Set((input.openIds||[]).filter(id=>files.has(id)))];
const activeId=openIds.includes(input.activeId)?input.activeId:openIds[0]||null;
return {format:'kodik-project',version:1,id:String(input.id||uid()),name:String(input.name||'Мій проєкт').slice(0,100),
nodes,openIds,activeId,selectedId:ids.has(input.selectedId)?input.selectedId:activeId,
expanded:[...new Set((input.expanded||[]).filter(p=>paths.get(p)==='dir'))]};
}
class Project{
constructor(state){this.state=validate(state)}
static empty(name='Мій проєкт'){return new Project({format:'kodik-project',version:1,id:uid(),name,nodes:[],openIds:[],expanded:[]})}
static fromTabs(tabs){
const p=Project.empty();
for(const [i,tab] of tabs.entries()){
let name;
try{name=path(tab.name||'main.py')}catch{name='lesson-'+i+'.py'}
name=p.unique(name);
p.create(name,'file',String(tab.code||''));
}
p.state.activeId=p.state.openIds[0]||null;p.state.selectedId=p.state.activeId;
return p;
}
get(id){return this.state.nodes.find(n=>n.id===id)||null}
at(p){return this.state.nodes.find(n=>n.path===p)||null}
active(){return this.get(this.state.activeId)}
snapshot(){return clone(this.state)}
unique(value){
const clean=path(value);if(!this.at(clean))return clean;
const slash=parent(clean),name=base(clean),dot=name.lastIndexOf('.'),stem=dot>0?name.slice(0,dot):name,ext=dot>0?name.slice(dot):'';
let i=2,candidate;do{candidate=(slash?slash+'/':'')+stem+'-'+i+++ext}while(this.at(candidate));
return candidate;
}
parents(p){
const parts=p.split('/');parts.pop();let current='';
for(const part of parts){current+=(current?'/':'')+part;const node=this.at(current);
if(node&&node.type!=='dir')throw new Error('Файл заважає створенню папки: '+current);
}
current='';
for(const part of parts){current+=(current?'/':'')+part;if(!this.at(current))this.state.nodes.push({id:uid(),path:current,type:'dir'})}
}
create(value,type='file',content='',encoding='utf8'){
const p=path(value);
if(this.at(p))throw new Error('Ця назва вже існує');
if(!['file','dir'].includes(type))throw new Error('Невідомий тип');
this.parents(p);
const node={id:uid(),path:p,type};
if(type==='file')Object.assign(node,{content,encoding});
this.state.nodes.push(node);this.state.selectedId=node.id;
let folder=type==='dir'?p:parent(p);
while(folder){if(!this.state.expanded.includes(folder))this.state.expanded.push(folder);folder=parent(folder)}
if(type==='file')this.open(node.id);
return node;
}
open(id){const node=this.get(id);if(!node||node.type!=='file')return;
if(!this.state.openIds.includes(id))this.state.openIds.push(id);
this.state.activeId=this.state.selectedId=id;
let dir=parent(node.path);while(dir){if(!this.state.expanded.includes(dir))this.state.expanded.push(dir);dir=parent(dir)}
}
close(id){
const i=this.state.openIds.indexOf(id);if(i<0)return;
this.state.openIds.splice(i,1);
if(this.state.activeId===id)this.state.activeId=this.state.openIds[Math.min(i,this.state.openIds.length-1)]||null;
}
rename(id,value){
const node=this.get(id);if(!node)throw new Error('Файл не знайдено');
const destination=path(value),old=node.path;
if(destination===old)return;
if(destination.startsWith(old+'/'))throw new Error('Не можна перенести папку всередину себе');
const moving=this.state.nodes.filter(n=>n.path===old||n.path.startsWith(old+'/'));
const movingIds=new Set(moving.map(n=>n.id));
const changed=moving.map(n=>({node:n,path:destination+n.path.slice(old.length)}));
for(const item of changed){const existing=this.at(item.path);if(existing&&!movingIds.has(existing.id))throw new Error('Ця назва вже існує')}
let dir=parent(destination);
while(dir){const existing=this.at(dir);if(existing&&(existing.type!=='dir'||movingIds.has(existing.id)))throw new Error('Некоректна батьківська папка');dir=parent(dir)}
this.parents(destination);
for(const item of changed)item.node.path=item.path;
this.state.expanded=this.state.expanded.map(p=>p===old||p.startsWith(old+'/')?destination+p.slice(old.length):p);
dir=parent(destination);while(dir){if(!this.state.expanded.includes(dir))this.state.expanded.push(dir);dir=parent(dir)}
}
remove(id){
const node=this.get(id);if(!node)return [];
const removed=this.state.nodes.filter(n=>n.path===node.path||n.path.startsWith(node.path+'/'));
const ids=new Set(removed.map(n=>n.id));
this.state.nodes=this.state.nodes.filter(n=>!ids.has(n.id));
for(const key of [...this.state.openIds])if(ids.has(key))this.close(key);
if(ids.has(this.state.selectedId))this.state.selectedId=this.state.activeId;
this.state.expanded=this.state.expanded.filter(p=>p!==node.path&&!p.startsWith(node.path+'/'));
return removed;
}
update(id,content,encoding='utf8'){const node=this.get(id);if(!node||node.type!=='file')throw new Error('Файл не знайдено');node.content=content;node.encoding=encoding}
children(p=''){return this.state.nodes.filter(n=>parent(n.path)===p).sort((a,b)=>a.type===b.type?a.path.localeCompare(b.path,'uk'):a.type==='dir'?-1:1)}
selectedFolder(){const node=this.get(this.state.selectedId);return !node?'':node.type==='dir'?node.path:parent(node.path)}
toggle(p){const i=this.state.expanded.indexOf(p);if(i<0)this.state.expanded.push(p);else this.state.expanded.splice(i,1)}
}
return {Project,validate,path,parent,base,uid};
});
