(()=>{
'use strict';
const panel=document.createElement('section');
panel.className='tk-panel';panel.hidden=true;
panel.setAttribute('aria-label','Графічний застосунок tkinter');
document.querySelector('.share-code').insertAdjacentElement('beforebegin',panel);
const widgets=new Map(),variables=new Map(),watchers=new Map(),notifying=new Set(),timers=new Map();
let timerCounter=0,itemCounter=0;
function invoke(callback,payload){try{return callback(payload)}finally{document.dispatchEvent(new Event('kodik-python-change'))}}
const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const get=id=>{const w=widgets.get(id);if(!w)throw new Error('Елемент tkinter уже закрито');return w};
const px=value=>number(value)+'px';
function setVariable(id,value){
variables.set(id,value);
for(const w of widgets.values())if(w.options.textvariable===id||w.options.variable===id)refreshValue(w);
if(!notifying.has(id)){
notifying.add(id);
try{for(const callback of watchers.get(id)||[])invoke(callback)}finally{notifying.delete(id)}
}
}
function valueChanged(w){
if(w.options.textvariable)setVariable(w.options.textvariable,w.control.value);
if(w.options.variable){
const o=w.options;
setVariable(o.variable,w.kind==='Radiobutton'?o.value:
w.kind==='Checkbutton'?(w.control.checked?(o.onvalue??1):(o.offvalue??0)):w.control.value);
}
}
function refreshValue(w){
const o=w.options,variable=o.textvariable||o.variable;
if(!variable)return;
const value=variables.get(variable)??'';
if(w.kind==='Checkbutton')w.control.checked=String(value)===String(o.onvalue??1);
else if(w.kind==='Radiobutton')w.control.checked=String(value)===String(o.value);
else if(['Entry','Text','Scale'].includes(w.kind))w.control.value=String(value);
else w.control.textContent=String(value);
}
function fontCss(font){
if(Array.isArray(font))return (String(font[2]||'').includes('bold')?'bold ':'')+number(font[1],12)+'px '+JSON.stringify(font[0]||'Arial');
return String(font||'14px Arial, sans-serif');
}
function configure(w,changes){
Object.assign(w.options,changes);
const o=w.options,e=w.control,box=w.box;
if('text'in changes){
if(w.kind==='LabelFrame')w.legend.textContent=String(o.text);
else if(w.label)w.label.textContent=String(o.text);
else if(!['Entry','Text','Canvas','Scale'].includes(w.kind))e.textContent=String(o.text);
}
if('bg'in changes||'background'in changes)e.style.backgroundColor=o.bg??o.background;
if('fg'in changes||'foreground'in changes)e.style.color=o.fg??o.foreground;
if('font'in changes)e.style.font=fontCss(o.font);
if('width'in changes){
if(['Tk','Frame','LabelFrame','Canvas'].includes(w.kind))e.style.width=px(o.width);
else e.style.width=number(o.width)+'ch';
}
if('height'in changes)e.style.height=['Text','Button','Label'].includes(w.kind)?number(o.height)*1.4+'em':px(o.height);
if('padding'in changes)e.style.padding=Array.isArray(o.padding)?o.padding.map(px).join(' '):px(o.padding);
if('padx'in changes)e.style.paddingLeft=e.style.paddingRight=px(o.padx);
if('pady'in changes)e.style.paddingTop=e.style.paddingBottom=px(o.pady);
if('state'in changes){e.disabled=o.state==='disabled';if(w.kind==='Entry')e.readOnly=o.state==='readonly'}
if('show'in changes&&w.kind==='Entry')e.type=o.show?'password':'text';
if('justify'in changes)e.style.textAlign=o.justify;
if('anchor'in changes&&w.kind==='Label')e.style.textAlign=String(o.anchor).includes('w')?'left':String(o.anchor).includes('e')?'right':'center';
if('wraplength'in changes)e.style.maxWidth=px(o.wraplength);
if('relief'in changes)e.style.borderStyle=o.relief==='flat'?'none':o.relief==='sunken'?'inset':o.relief==='raised'?'outset':'solid';
if('bd'in changes||'borderwidth'in changes)e.style.borderWidth=px(o.bd??o.borderwidth);
if(w.kind==='Scale'){
e.type='range';e.min=String(o.from_??o.from??0);e.max=String(o.to??100);e.step=String(o.resolution??1);
if(o.orient==='vertical')e.style.writingMode='vertical-lr';
}
if(w.kind==='Radiobutton')e.name=String(o.variable||w.id);
if(w.kind==='Canvas'){
e.setAttribute('width',String(o.width??300));e.setAttribute('height',String(o.height??200));
e.setAttribute('viewBox','0 0 '+number(o.width,300)+' '+number(o.height,200));
}
refreshValue(w);
}
function create(kind,id,parent,options){
panel.hidden=false;
const o=JSON.parse(options);
let box,control,label=null,legend=null,surface=null;
if(kind==='Tk'){
box=document.createElement('section');box.className='tk-window';
const head=document.createElement('div');head.className='tk-title';head.textContent='Вікно tkinter';box.append(head);
control=document.createElement('div');control.className='tk-surface';box.append(control);
panel.append(box);surface=control;
}else{
box=document.createElement('div');box.className='tk-widget';box.hidden=true;
if(['Checkbutton','Radiobutton'].includes(kind)){
const holder=document.createElement('label');holder.className='tk-choice';
control=document.createElement('input');control.type=kind==='Checkbutton'?'checkbox':'radio';
label=document.createElement('span');holder.append(control,label);box.append(holder);
}else{
control=kind==='Canvas'?document.createElementNS('http://www.w3.org/2000/svg','svg'):
document.createElement(kind==='Entry'?'input':kind==='Text'?'textarea':kind==='Button'?'button':kind==='Scale'?'input':kind==='LabelFrame'?'fieldset':'div');
if(kind==='Button')control.type='button';
if(kind==='LabelFrame'){legend=document.createElement('legend');control.append(legend)}
control.classList.add('tk-'+kind.toLowerCase());box.append(control);
}
get(parent).control.append(box);
}
const w={id,kind,box,control,label,legend,surface,options:{},command:null,bindings:new Map(),items:new Map()};
widgets.set(id,w);box.dataset.tkId=id;control.dataset.tkControl=id;
if(kind==='Tk')box.querySelector('.tk-title').dataset.tkTitle=id;
configure(w,o);
control.addEventListener(kind==='Scale'?'input':'change',()=>{valueChanged(w);if(['Scale','Checkbutton','Radiobutton'].includes(kind)&&w.command&&!control.disabled)invoke(w.command)});
if(kind==='Entry'||kind==='Text')control.addEventListener('input',()=>valueChanged(w));
if(kind==='Button')control.addEventListener('click',()=>{if(w.command&&!control.disabled)w.command()});
}
function layout(id,manager,json){
const w=get(id),o=JSON.parse(json),box=w.box,parent=box.parentElement;
box.hidden=false;box.style.position='';box.style.display='';box.style.margin='';box.style.alignSelf='';
const horizontal=o.padx??0,vertical=o.pady??0;
box.style.marginLeft=px(Array.isArray(horizontal)?horizontal[0]:horizontal);
box.style.marginRight=px(Array.isArray(horizontal)?horizontal[1]:horizontal);
box.style.marginTop=px(Array.isArray(vertical)?vertical[0]:vertical);
box.style.marginBottom=px(Array.isArray(vertical)?vertical[1]:vertical);
if(manager==='place'){
box.style.position='absolute';
box.style.left='calc('+number(o.relx)*100+'% + '+px(o.x??0)+')';
box.style.top='calc('+number(o.rely)*100+'% + '+px(o.y??0)+')';
if(o.width!==undefined)box.style.width=px(o.width);
if(o.height!==undefined)box.style.height=px(o.height);
const anchor=o.anchor||'nw';
box.style.transform='translate('+(anchor.includes('w')?'0':anchor.includes('e')?'-100%':'-50%')+','+(anchor.includes('n')?'0':anchor.includes('s')?'-100%':'-50%')+')';
}
if(manager==='grid'){
parent.style.display='grid';
box.style.transform='';
box.style.gridRow=(number(o.row)+1)+' / span '+number(o.rowspan,1);
box.style.gridColumn=(number(o.column)+1)+' / span '+number(o.columnspan,1);
box.style.justifySelf=String(o.sticky||'').includes('e')&&String(o.sticky||'').includes('w')?'stretch':'center';
}
if(manager==='pack'){
parent.style.display='flex';parent.style.flexDirection=['left','right'].includes(o.side)?'row':'column';
box.style.transform='';box.style.alignSelf=['x','both'].includes(o.fill)?'stretch':o.anchor==='w'?'flex-start':o.anchor==='e'?'flex-end':'center';
if(o.expand)box.style.flex='1 1 auto';
if(['right','bottom'].includes(o.side))box.style.order='1';
}
}
function index(value,text,control){
if(value==='end')return text.length;
if(value==='insert')return control.selectionStart||0;
if(String(value).includes('.')){
const [row,col]=String(value).split('.').map(Number),lines=text.split('\n');
return lines.slice(0,Math.max(0,row-1)).reduce((sum,line)=>sum+line.length+1,0)+(col||0);
}
return Math.max(0,Math.min(text.length,number(value)));
}
function destroy(id){
const w=widgets.get(id);if(!w)return;
for(const [key,child] of widgets)if(w.control.contains(child.box)&&key!==id)widgets.delete(key);
w.box.remove();widgets.delete(id);
panel.hidden=![...widgets.values()].some(value=>value.kind==='Tk');
}
function bind(id,sequence,callback,add){
const w=get(id),map={'<Button-1>':'click','<ButtonRelease-1>':'mouseup','<Double-Button-1>':'dblclick','<Return>':'keydown','<Key>':'keydown','<KeyPress>':'keydown','<Motion>':'mousemove'};
let type=map[sequence];
let requiredKey=sequence==='<Return>'?'Enter':null;
if(!type&&/^<KeyPress-.+>$/.test(sequence)){type='keydown';requiredKey=sequence.slice(10,-1)}
if(!type)throw new Error('Ця подія tkinter поки не підтримується: '+sequence);
if(!add&&w.bindings.has(sequence))w.control.removeEventListener(type,w.bindings.get(sequence));
const handler=e=>{
if(requiredKey&&e.key!==requiredKey)return;
const rect=w.control.getBoundingClientRect();
const result=invoke(callback,JSON.stringify({x:Math.round((e.clientX||rect.left)-rect.left),y:Math.round((e.clientY||rect.top)-rect.top),char:e.key?.length===1?e.key:'',keysym:e.key||'',keycode:e.keyCode||0}));
if(result==='break')e.preventDefault();
};
w.bindings.set(sequence,handler);w.control.addEventListener(type,handler);
}
function canvasTargets(w,item){return [...w.items.values()].filter(value=>item==='all'||String(value.id)===item||value.tags.includes(item))}
function styleShape(item,options){
Object.assign(item.options,options);const o=item.options,e=item.element;
e.setAttribute('fill',o.fill??(item.kind==='text'?'black':'none'));
if(item.kind==='line')e.setAttribute('stroke',o.fill||'black');
else if(item.kind!=='text')e.setAttribute('stroke',o.outline??'black');
e.setAttribute('stroke-width',String(o.width??1));
if(item.kind==='text'){
e.textContent=String(o.text??'');e.setAttribute('fill',o.fill||'black');
e.setAttribute('text-anchor',o.anchor==='w'?'start':o.anchor==='e'?'end':'middle');
e.style.font=fontCss(o.font);
}
}
window.KodikTk={
create,configure:(id,json)=>configure(get(id),JSON.parse(json)),layout,bind,destroy,
get:(id)=>get(id).control.value??get(id).control.textContent,
set(id,value){const w=get(id);w.control.value=value;valueChanged(w)},
edit(id,operation,first,last){
const w=get(id),e=w.control,text=e.value,start=index(first,text,e);
if(operation==='insert')e.value=text.slice(0,start)+last+text.slice(start);
else{
const end=last?index(last,text,e):start+1;
e.value=text.slice(0,start)+text.slice(end);
}
valueChanged(w);
},
command:(id,callback)=>get(id).command=callback,
hide:id=>get(id).box.hidden=true,
focus:id=>get(id).control.focus(),
exists:id=>widgets.has(id),
size:(id,key)=>get(id).control.getBoundingClientRect()[key],
rootTitle(id,text){const head=get(id).box.querySelector('.tk-title');if(text!==undefined)head.textContent=text;return head.textContent},
geometry(id,value){
const w=get(id),match=/^(\d+)x(\d+)/.exec(value);
if(match){w.control.style.width=px(match[1]);w.control.style.minHeight=px(match[2]);w.control.dataset.geometry=value}
return w.control.dataset.geometry||'';
},
track(id,type,index,json){
const w=get(id),o=JSON.parse(json);
if(o.weight)w.control.style[type==='row'?'gridAutoRows':'gridAutoColumns']='minmax(min-content,1fr)';
},
getVar:id=>variables.get(id)??'',
setVar:setVariable,
watchVar(id,callback){const group=watchers.get(id)||[];group.push(callback);watchers.set(id,group)},
selected:id=>get(id).control.checked,
setSelection(id,selected){const w=get(id);w.control.checked=selected;valueChanged(w)},
after(ms,callback){const id=++timerCounter;timers.set(id,setTimeout(()=>{timers.delete(id);invoke(callback)},Math.max(0,ms)));return id},
cancelAfter(id){clearTimeout(timers.get(id));timers.delete(id)},
appendOutput(text){
const output=document.getElementById('output');
if(output.textContent.includes('Графічний застосунок запущено.')||output.textContent==='Код виконано без виводу.')output.textContent='';
output.textContent+=text;document.getElementById('status').textContent='Оброблено подію · tkinter';
},
message(kind,title,text){if(kind==='confirm')return confirm(title+'\n\n'+text)?'yes':'no';alert(title+'\n\n'+text);return 'ok'},
canvasCreate(id,kind,coordsJson,optionsJson){
const w=get(id),a=JSON.parse(coordsJson),o=JSON.parse(optionsJson);
const tag={line:'polyline',rectangle:'rect',oval:'ellipse',polygon:'polygon',text:'text'}[kind];
if(!tag)throw new Error('Невідома фігура Canvas');
const e=document.createElementNS('http://www.w3.org/2000/svg',tag),item={id:++itemCounter,kind,element:e,options:{},tags:Array.isArray(o.tags)?o.tags:[String(o.tags||'')],x:0,y:0};
if(kind==='line'||kind==='polygon')e.setAttribute('points',a.reduce((parts,v,i)=>i%2?parts:parts.concat(v+','+a[i+1]),[]).join(' '));
else if(kind==='text'){e.setAttribute('x',a[0]);e.setAttribute('y',a[1])}
else{
const [x1,y1,x2,y2]=a;
if(kind==='rectangle'){e.setAttribute('x',Math.min(x1,x2));e.setAttribute('y',Math.min(y1,y2));e.setAttribute('width',Math.abs(x2-x1));e.setAttribute('height',Math.abs(y2-y1))}
else{e.setAttribute('cx',(x1+x2)/2);e.setAttribute('cy',(y1+y2)/2);e.setAttribute('rx',Math.abs(x2-x1)/2);e.setAttribute('ry',Math.abs(y2-y1)/2)}
}
styleShape(item,o);w.items.set(item.id,item);w.control.append(e);return item.id;
},
canvasDelete(id,item){const w=get(id);for(const value of canvasTargets(w,item)){value.element.remove();w.items.delete(value.id)}},
canvasMove(id,item,x,y){for(const value of canvasTargets(get(id),item)){value.x+=x;value.y+=y;value.element.setAttribute('transform','translate('+value.x+' '+value.y+')')}},
canvasConfigure(id,item,json){for(const value of canvasTargets(get(id),item))styleShape(value,JSON.parse(json))},
reset(){for(const timer of timers.values())clearTimeout(timer);timers.clear();panel.replaceChildren();panel.hidden=true;widgets.clear();variables.clear();watchers.clear();notifying.clear()},
get visible(){return !panel.hidden}
};
let sourcePromise;
window.installKodikTkinter=async pyodide=>{
if(!sourcePromise)sourcePromise=fetch(new URL('kodik_tkinter.py?v=1.23',document.baseURI)).then(response=>{
if(!response.ok)throw new Error('Не вдалося завантажити tkinter');return response.text();
}).catch(error=>{sourcePromise=null;throw error});
pyodide.FS.writeFile('/home/pyodide/kodik_tkinter.py',await sourcePromise);
pyodide.runPython("import importlib.util, sys\n_kodik_old_tk = sys.modules.get('tkinter')\nif _kodik_old_tk is not None and hasattr(_kodik_old_tk, '_cleanup'):\n    _kodik_old_tk._cleanup()\n_kodik_tk_spec = importlib.util.spec_from_file_location('tkinter', '/home/pyodide/kodik_tkinter.py')\n_kodik_tk = importlib.util.module_from_spec(_kodik_tk_spec)\nsys.modules['tkinter'] = _kodik_tk\n_kodik_tk_spec.loader.exec_module(_kodik_tk)");
window.KodikTk.reset();
};
})();