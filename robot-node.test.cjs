const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=process.env.PYODIDE_DIR||path.resolve(__dirname,'../../turtle/pyodide');
const {loadPyodide}=require(path.join(dir,'pyodide.js'));
(async()=>{
const py=await loadPyodide({indexURL:dir+path.sep}),data=JSON.parse(fs.readFileSync(path.join(__dirname,'robot-bundle.json'))),frames=[];
globalThis.KodikRobot={mapText:()=>data.maps['map3.map'],enqueue:s=>frames.push(JSON.parse(s))};
py.FS.mkdirTree('/home/pyodide/robot/maps');
for(const [n,s] of Object.entries(data.files))py.FS.writeFile('/home/pyodide/robot/'+n,s);
for(const [n,s] of Object.entries(data.maps))py.FS.writeFile('/home/pyodide/robot/maps/'+n,s);
py.runPython(`from robot import *
assert position() == (3,3)
right()
forward(11)
right()
forward(2)
right()
forward(13)
left()
forward(2)
left()
forward(13)
right()
forward(2)
right()
forward(11)
assert frontIsEnergon()
assert pickUp()
assert collected() == EnergonTotal() == 1
assert EnergonLeft() == 0
assert position() == (3,9)
load_map_text('direction:\\neast\\n\\nmap:\\nAAAAAAA\\nA@ *  A\\nA     A\\nAAAAAAA\\n')
assert frontIsClear() and leftIsObstacle() and rightIsClear()
paintWhite()
forward()
assert isPainted(1,1) and isPainted(2,1)
assert frontIsEnergon()
assert pickUp() and not pickUp()
backward()
assert position() == (1,1)
paintBlack()
assert get_world().is_black(1,1)
assert clearPaint() and not isPainted(1,1)
stopPainting()
assert setSpeed(10) == getSpeed() == 10
assert skin('grass') == 'grass'
try:
    west(1)
    assert False
except CollisionError:
    pass
load_map_text('map:\\n@ \\n')
try:
    north()
    assert False
except OutOfBoundsError:
    pass
for n in range(1,28):
    load_map('map%d.map' % n)
    assert get_world().width > 0
try:
    load_map_text('map:\\n@@\\n')
    assert False
except ValueError:
    pass
done()
`);
assert(frames.length>50);assert(frames.some(f=>f.collected===1));
console.log('PASS: actual Pyodide, 27 original maps, complete map3 route, sensors, painting, pickup, collisions, bounds and validation');
})().catch(e=>{console.error(e);process.exitCode=1});
