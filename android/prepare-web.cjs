const fs=require('node:fs/promises'),path=require('node:path');
const repo=path.resolve(__dirname,'..'),dest=path.join(__dirname,'app/src/main/assets/web');
async function main(){
await fs.mkdir(path.join(dest,'pyodide'),{recursive:true});
let html=await fs.readFile(path.join(repo,'index.html'),'utf8');
const script=html.match(/<script src="([^"?]+)(?:\?[^"]*)?"><\/script>/)[1];
let app=await fs.readFile(path.join(repo,script),'utf8');
app=app.replace("https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js","pyodide/pyodide.js")
.replace("await loadPyodide()","await loadPyodide({indexURL:new URL('pyodide/',location.href).href})")
.replaceAll("v1.25","v1.25 · Android 1.4");
const needle="if(navigator.share&&navigator.canShare?.({files:[file]}))";
if(!app.includes(needle))throw Error('Share handler changed; update Android adapter.');
app=app.replace(needle,"if(window.KodikAndroid){\nconst encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob)});\nif(!KodikAndroid.sharePng(encoded))throw new Error('Не вдалося передати зображення Android');\n}else if(navigator.share&&navigator.canShare?.({files:[file]}))");
html=html.replace(/<script>if\('serviceWorker'[\s\S]*?<\/script>/,'')
.replaceAll('v1.25','v1.25 · Android 1.4');
await fs.writeFile(path.join(dest,script),app);
await fs.writeFile(path.join(dest,'index.html'),html);
for(const file of ['robot-bundle.json','robot-canvas.js','turtle.py','turtle-canvas.js','kodik_tkinter.py','tkinter-dom.js','project-store.js','project-runtime.js','project-runtime.py','project-ide.js'])await fs.copyFile(path.join(repo,file),path.join(dest,file));
const ideFile=path.join(dest,'project-ide.js');
let ide=await fs.readFile(ideFile,'utf8');
ide=ide.replace('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js','pyodide/pyodide.js').replace('await loadPyodide()','await loadPyodide({indexURL:new URL(\'pyodide/\',location.href).href})');
await fs.writeFile(ideFile,ide);
await fs.copyFile(path.join(repo,'styles.css'),path.join(dest,'styles.css'));
await fs.appendFile(path.join(dest,'styles.css'),'\nbody{overscroll-behavior-y:contain}.app{padding-bottom:28px}\n');
for(const name of ['pyodide.js','pyodide.asm.js','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json']){
const response=await fetch('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'+name);
if(!response.ok)throw Error(name+': '+response.status);
const data=Buffer.from(await response.arrayBuffer());
await fs.writeFile(path.join(dest,'pyodide',name),data);
console.log(name,data.length);
}
console.log('Prepared offline Android assets from '+script);
}
main().catch(error=>{console.error(error);process.exitCode=1});

