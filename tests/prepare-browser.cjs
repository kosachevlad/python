const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
const root=path.resolve(__dirname,'..'),dest=path.join(root,'.browser-test');await fs.mkdir(path.join(dest,'pyodide'),{recursive:true});
const html=await fs.readFile(path.join(root,'index.html'),'utf8');
const assets=['index.html','styles.css','feedback.css','sw.js','turtle.py','kodik_tkinter.py','project-runtime.py','robot-bundle.json',...[...html.matchAll(/<script src="([^"?]+)/g)].map(m=>m[1])];
for(const file of new Set(assets))await fs.copyFile(path.join(root,file),path.join(dest,file));
for(const name of ['pyodide.js','pyodide.asm.js','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json']){
const r=await fetch('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'+name);if(!r.ok)throw Error(name+': '+r.status);await fs.writeFile(path.join(dest,'pyodide',name),Buffer.from(await r.arrayBuffer()));
}
console.log('Prepared local browser test environment');
})().catch(e=>{console.error(e);process.exitCode=1});
