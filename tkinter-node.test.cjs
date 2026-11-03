const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=process.env.PYODIDE_DIR||path.resolve(__dirname,'../turtle/pyodide');
const {loadPyodide}=require(path.join(dir,'pyodide.js'));
const widgets=new Map(),values=new Map(),callbacks=new Map(),timers=new Map(),output=[];
globalThis.KodikTk={
create(kind,id,parent,json){widgets.set(id,{kind,id,parent,options:JSON.parse(json),value:''})},
configure(id,json){Object.assign(widgets.get(id).options,JSON.parse(json))},
layout(){},command:(id,callback)=>callbacks.set(id,callback),reset(){widgets.clear();values.clear();callbacks.clear();timers.clear()},
get:id=>widgets.get(id).value,
set(id,value){widgets.get(id).value=value},
edit(id,op,first,last){const w=widgets.get(id),i=first==='end'?w.value.length:Number(first)||0;if(op==='insert')w.value=w.value.slice(0,i)+last+w.value.slice(i);else w.value=w.value.slice(0,i)+(last==='end'?'':w.value.slice((Number(last)||i+1)))},
getVar:id=>values.get(id),setVar:(id,value)=>values.set(id,value),
watchVar(){},rootTitle(){},geometry(){},destroy:id=>widgets.delete(id),
appendOutput:text=>output.push(text),bind:(id,event,callback)=>callbacks.set(id+event,callback),
after(ms,callback){timers.set(1,callback);return 1},cancelAfter:id=>timers.delete(id),
focus(){},exists:id=>widgets.has(id),size:()=>320,track(){},hide(){},
canvasCreate:()=>1,canvasDelete(){},canvasMove(){},canvasConfigure(){},setSelection(){},selected:()=>false
};
(async()=>{
const py=await loadPyodide({indexURL:dir+path.sep});
py.FS.writeFile('/home/pyodide/kodik_tkinter.py',fs.readFileSync(path.join(__dirname,'kodik_tkinter.py'),'utf8'));
const install="import importlib.util,sys\nspec=importlib.util.spec_from_file_location('tkinter','/home/pyodide/kodik_tkinter.py')\ntkinter=importlib.util.module_from_spec(spec)\nsys.modules['tkinter']=tkinter\nspec.loader.exec_module(tkinter)\n";
py.runPython(install+fs.readFileSync(path.join(__dirname,'examples/tkinter-calculator.py'),'utf8'));
const entries=[...widgets.values()].filter(w=>w.kind==='Entry'),button=[...widgets.values()].find(w=>w.kind==='Button');
entries[0].value='7';entries[1].value='5';callbacks.get(button.id)();
assert([...widgets.values()].some(w=>w.options.text==='Сума: 12'&&w.options.fg==='blue'));
entries[0].value='abc';callbacks.get(button.id)();
assert([...widgets.values()].some(w=>w.options.text==='Введи саме числа'&&w.options.fg==='red'));
py.runPython("from tkinter import ttk, messagebox\nvalue=tkinter.IntVar(value=4)\nassert value.get()==4\nvalue.set(9)\nassert value.get()==9\nframe=ttk.Frame(window,padding=10)\nframe.grid(row=0,column=0)\nc=tkinter.Canvas(window,width=100,height=100)\nassert c.create_rectangle(1,2,3,4,fill='red')==1\nwindow.after(10,lambda:result.config(text='timer'))");
timers.get(1)();assert([...widgets.values()].some(w=>w.options.text==='timer'));
py.runPython("window.bind('<Return>',lambda event: result.config(text=event.keysym))");
const root=[...widgets.values()].find(w=>w.kind==='Tk');
callbacks.get(root.id+'<Return>')(JSON.stringify({keysym:'Return'}));assert([...widgets.values()].some(w=>w.options.text==='Return'));
py.runPython("broken=tkinter.Button(window,command=lambda:1/0)");
const broken=[...widgets.values()].filter(w=>w.kind==='Button').at(-1);
callbacks.get(broken.id)();assert(output.some(text=>text.includes('ZeroDivisionError')));
py.runPython("tkinter._cleanup()");
assert.equal(widgets.size,0);assert.equal(timers.size,0);
console.log('PASS: actual Pyodide Tkinter import, calculator callbacks, invalid input, variables, ttk, Canvas, timers, bind events, callback errors and cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1});
