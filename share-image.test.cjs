const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=__dirname,source=fs.readFileSync(path.join(root,'app-ed0a328a.js'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const a=source.indexOf('const esc=s=>'),b=source.indexOf(';const update=()=>',a);
const paint=vm.runInNewContext(source.slice(a,b)+';paint');
const colors=Object.fromEntries([...css.matchAll(/\.syntax-([a-z]+)\{color:([^}]+)\}/g)].map(m=>[m[1],m[2]]));
const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const code='# Спробуй змінити цей код\nprint("Привіт # 👋")\nfor i in range(3):\n'+ 'x'.repeat(180);
const rows=code.split('\n').map(line=>{
const nodes=[],re=/<span class="syntax-([a-z]+)">([\s\S]*?)<\/span>|([^<]+)/g;
for(const m of paint(line).matchAll(re))nodes.push({nodeType:m[1]?1:3,textContent:decode(m[2]??m[3]),color:colors[m[1]]});
return {textContent:line,childNodes:nodes,color:'#eaf4ff'};
});
const output='Привіт 👋\nPython — це цікаво! 1';
let repaints=0;
const draws=[],ctx={font:'',fillStyle:'',scale(){},fillRect(){},measureText(text){return {width:Array.from(text).length*10}},fillText(text,x,y){draws.push({text,x,y,color:this.fillStyle})}};
const blob={type:'image/png'};
const canvas={getContext:()=>ctx,toBlob:callback=>callback(blob)};
const document={fonts:{ready:Promise.resolve()},querySelector:()=>({children:rows}),createElement:()=>canvas};
const env={document,$:id=>id==='editor'?{value:code}:{textContent:output},getComputedStyle:node=>({color:node.color}),updateLines:()=>repaints++};
const start=source.indexOf('const makeImage='),end=source.indexOf(';share.onclick=',start);
const makeImage=vm.runInNewContext(source.slice(start,end)+';makeImage',env);
(async()=>{
assert.equal(await makeImage(),blob);
assert.equal(repaints,1);
assert(draws.some(d=>d.text==='# Спробуй змінити цей код'&&d.color===colors.comment));
assert(draws.some(d=>d.text==='print'&&d.color===colors.builtin));
assert(draws.some(d=>d.text==='"Привіт # 👋"'&&d.color===colors.string));
assert(draws.some(d=>d.text==='for'&&d.color===colors.keyword));
assert(draws.some(d=>d.text==='3'&&d.color===colors.number));
assert(draws.some(d=>d.text==='x'.repeat(180)));
assert(canvas.width>2000,'Long lines expand the image');
for(const [i,line] of code.split('\n').entries()){
const parts=draws.filter(d=>d.y===72+i*25&&d.x>28);
assert.equal(parts.map(d=>d.text).join(''),line);
for(let j=1;j<parts.length;j++)assert.equal(parts[j].x,parts[j-1].x+ctx.measureText(parts[j-1].text).width);
}
for(const text of output.split('\n'))assert(draws.some(d=>d.text===text&&d.color==='#dcecff'));
canvas.toBlob=callback=>callback(null);
await assert.rejects(makeImage(),/Не вдалося створити зображення/);
console.log('Passed: shared PNG uses editor token colors, preserves code/output and Unicode, sizes long lines, handles PNG failures.');
})().catch(error=>{console.error(error);process.exitCode=1});
