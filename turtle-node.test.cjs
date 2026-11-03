const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadPyodide}=require(path.join(process.env.PYODIDE_DIR||path.join(__dirname,'pyodide'),'pyodide.js'));
const commands=[];
globalThis.kodikTurtle={enqueue:text=>commands.push(JSON.parse(text)),validColor:()=>true};
(async()=>{
const py=await loadPyodide({indexURL:(process.env.PYODIDE_DIR||path.join(__dirname,'pyodide'))+path.sep});
py.FS.writeFile('/home/pyodide/kodik_turtle.py',fs.readFileSync(path.join(__dirname,'turtle.py'),'utf8'));
const install="import importlib.util, sys\nspec=importlib.util.spec_from_file_location('turtle','/home/pyodide/kodik_turtle.py')\nturtle=importlib.util.module_from_spec(spec)\nsys.modules['turtle']=turtle\nspec.loader.exec_module(turtle)\n";
py.runPython(install+fs.readFileSync(path.join(__dirname,'examples/turtle-square.py'),'utf8'));
const moves=commands.filter(c=>c.op==='move');
assert.equal(moves.length,4);
for(const [i,[x,y]] of [[100,0],[100,-100],[0,-100],[0,0]].entries()){
assert(Math.abs(moves[i].x-x)<1e-8);assert(Math.abs(moves[i].y-y)<1e-8);
assert.equal(moves[i].color,'blue');assert.equal(moves[i].draw,true);
}
commands.length=0;
py.runPython(install+[
"from turtle import *","speed(0)","penup()","goto(-50,20)","pendown()","color('red')","forward(50)",
"assert position() == (0.0,20.0)","assert heading() == 0","assert distance(0,20) == 0",
"begin_fill()","for i in range(3):","    forward(30)","    left(120)","end_fill()",
"dot(5)","write('Привіт')","clear()","reset()","circle(20)","assert abs(heading()) < 1e-8",
"Screen().colormode(255)","color(0,0,255)","assert pencolor() == '#0000ff'","hideturtle()","done()"
].join('\n'));
assert.equal(commands.find(c=>c.op==='move').draw,false);
assert(commands.some(c=>c.op==='fill'&&c.points.length===4));
assert(commands.some(c=>c.op==='write'&&c.text==='Привіт'));
assert(commands.some(c=>c.op==='clear'));
assert(commands.some(c=>c.op==='pose'&&c.color==='#0000ff'));
console.log('PASS: actual Pyodide import turtle, exact blue square, module-level API, penup, position, fills, dots, text, reset, circle and RGB colors.');
})().catch(error=>{console.error(error);process.exitCode=1});
