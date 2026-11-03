(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KodikProjectRuntime=api})(globalThis,()=>{
'use strict';
const signature=node=>node?node.type==='dir'?'dir':node.encoding+'\0'+node.content:undefined;
const bytesToBase64=bytes=>{let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text)};
const base64ToBytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
function encode(bytes){if(bytes.includes(0))return {encoding:'base64',content:bytesToBase64(bytes)};try{return {encoding:'utf8',content:new TextDecoder('utf-8',{fatal:true}).decode(bytes)}}catch{return {encoding:'base64',content:bytesToBase64(bytes)}}}
class Runtime{
constructor(py,setupSource){this.py=py;this.root='/home/pyodide/kodik-project';this.projectId=null;this.baseline=new Map();py.runPython(setupSource)}
wipe(path=this.root){
const fs=this.py.FS;
let stat;try{stat=fs.lstat(path)}catch{return}
if(fs.isDir(stat.mode)&&!fs.isLink(stat.mode)){for(const name of fs.readdir(path))if(name!=='.'&&name!=='..')this.wipe(path+'/'+name);fs.rmdir(path)}
else fs.unlink(path);
}
write(project){
const fs=this.py.FS;const previous=fs.cwd();fs.chdir('/home/pyodide');this.wipe();fs.mkdirTree(this.root);
for(const n of project.state.nodes.filter(n=>n.type==='dir').sort((a,b)=>a.path.length-b.path.length))fs.mkdirTree(this.root+'/'+n.path);
for(const n of project.state.nodes.filter(n=>n.type==='file'))fs.writeFile(this.root+'/'+n.path,n.encoding==='base64'?base64ToBytes(n.content):n.content);
try{fs.chdir(previous.startsWith(this.root)?previous:this.root)}catch{fs.chdir(this.root)}
this.projectId=project.state.id;this.baseline=new Map(project.state.nodes.map(n=>[n.path,signature(n)]));
}
scan(){
const fs=this.py.FS,nodes=[];
const visit=(absolute,relative)=>{
let stat;try{stat=fs.lstat(absolute)}catch{return}
if(fs.isLink(stat.mode))return;
if(fs.isDir(stat.mode)){
if(relative)nodes.push({path:relative,type:'dir'});
for(const name of fs.readdir(absolute)){if(name==='.'||name==='..'||name==='__pycache__'||name.endsWith('.pyc'))continue;visit(absolute+'/'+name,relative?relative+'/'+name:name)}
}else if(relative&&fs.isFile(stat.mode))nodes.push({path:relative,type:'file',...encode(fs.readFile(absolute))});
};
visit(this.root,'');return nodes;
}
capture(project){
if(this.projectId!==project.state.id)return {changed:false,conflicts:[]};
const nodes=this.scan(),found=new Map(nodes.map(n=>[n.path,n])),open=[...project.state.openIds],active=project.state.activeId,selected=project.state.selectedId;
let changed=false;const conflicts=[];
for(const n of nodes.filter(n=>n.type==='dir')){
const current=project.at(n.path);
if(current?.type==='file'&&signature(current)===this.baseline.get(n.path)){project.remove(current.id);changed=true}
if(!project.at(n.path))try{project.create(n.path,'dir');changed=true}catch{/* A newer editor file may occupy the path. */}
}
for(const n of nodes.filter(n=>n.type==='file')){
const old=this.baseline.get(n.path),incoming=signature(n),current=project.at(n.path);
if(incoming===old||signature(current)===incoming)continue;
if(current&&(current.type!=='file'||signature(current)!==old)){
const destination=project.unique(n.path+'.python-copy');
project.create(destination,'file',n.content,n.encoding);conflicts.push(destination);changed=true;
}else if(current){project.update(current.id,n.content,n.encoding);changed=true}
else{try{project.create(n.path,'file',n.content,n.encoding);changed=true}catch{const destination=project.unique('python-output/'+n.path.replaceAll('/','_'));project.create(destination,'file',n.content,n.encoding);conflicts.push(destination);changed=true}}
}
for(const [path,old] of this.baseline){
if(found.has(path))continue;
const current=project.at(path);if(!current||signature(current)!==old)continue;
if(current.type==='file'){project.remove(current.id);changed=true}
}
for(const [path,old] of [...this.baseline].sort((a,b)=>b[0].length-a[0].length)){
const current=project.at(path);
if(old==='dir'&&!found.has(path)&&current?.type==='dir'&&!project.children(path).length){project.remove(current.id);changed=true}
}
project.state.openIds=open.filter(id=>project.get(id)?.type==='file');
project.state.activeId=project.state.openIds.includes(active)?active:project.state.openIds[0]||null;
project.state.selectedId=project.get(selected)?selected:project.state.activeId;
this.baseline=new Map(nodes.map(n=>[n.path,signature(n)]));
return {changed,conflicts};
}
async execute(code,path){return await this.py.runPythonAsync('_kp_execute('+JSON.stringify(code)+','+JSON.stringify(this.root+'/'+path)+','+JSON.stringify(this.root)+')')}
leave(){if(this.projectId)this.py.runPython('_kp_leave('+JSON.stringify(this.root)+')');this.projectId=null;this.baseline.clear()}
}
return {Runtime,encode,bytesToBase64,base64ToBytes};
});
