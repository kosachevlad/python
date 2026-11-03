const assert=require('node:assert/strict');
const {Project,validate,path}=require('./project-store.js');
const p=Project.fromTabs([{name:'main.py',code:'print(1)'},{name:'main.py',code:'print(2)'}]);
assert.equal(p.state.nodes.length,2);assert.equal(p.at('main-2.py').content,'print(2)');
const moduleFile=p.create('utils/math.py','file','VALUE=3');
assert.equal(p.at('utils').type,'dir');
p.rename(p.at('utils').id,'lib');
assert.equal(p.get(moduleFile.id).path,'lib/math.py');assert(p.state.openIds.includes(moduleFile.id));
assert.throws(()=>p.rename(p.at('lib').id,'lib/nested'));
assert.throws(()=>p.create('main.py'));
assert.throws(()=>p.create('main.py/child.py'));
for(const bad of ['/etc/passwd','../x.py','a/../x.py','a//b','C:\\a.py','a\u0000b'])assert.throws(()=>path(bad),bad);
const before=p.snapshot();assert.throws(()=>p.rename(moduleFile.id,'main.py'));assert.deepEqual(p.snapshot(),before);
p.close(moduleFile.id);assert(p.get(moduleFile.id));assert(!p.state.openIds.includes(moduleFile.id));
p.open(moduleFile.id);p.remove(p.at('lib').id);assert(!p.get(moduleFile.id));assert(!p.state.openIds.includes(moduleFile.id));
const binary=p.create('assets/image.bin','file','AP8=','base64');
assert.equal(new Project(p.snapshot()).get(binary.id).encoding,'base64');
for(const mutate of [
s=>s.nodes.push({...s.nodes[0]}),
s=>s.nodes.push({id:'x',path:'escape/child.py',type:'file',encoding:'utf8',content:''}),
s=>s.nodes[0].path='../escape.py',
s=>s.nodes[0].type='symlink',
s=>{s.nodes[0].encoding='base64';s.nodes[0].content='not base64!'}
]){const state=p.snapshot();mutate(state);assert.throws(()=>validate(state))}
const restored=new Project(p.snapshot());assert.deepEqual(restored.snapshot(),p.snapshot());
const ids=restored.state.nodes.filter(n=>n.type==='file').map(n=>n.id);for(const id of ids)restored.remove(id);
assert.equal(restored.state.openIds.length,0);assert.equal(restored.state.activeId,null);
console.log('PASS: migration, nested folders, paths, collisions, rename, close vs delete, binary round-trip, import validation and empty project.');
