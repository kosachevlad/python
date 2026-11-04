const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'app-ed0a328a.js'),'utf8');
const setup=source.slice(source.indexOf('const shareNotice='),source.indexOf('const makeImage='));
const handler=source.slice(source.indexOf(';share.onclick=',source.indexOf('const makeImage=')),source.lastIndexOf('})();'));
function create({name,unsupported=false,imageError=false,downloadError=false,canShareError=false}={}){
const nodes=[],share={disabled:false,insertAdjacentElement(){}},timers=[],revoked=[];
let downloads=0,shares=0;
const document={body:{appendChild(){}},createElement(tag){const n={tag,hidden:false,style:{},attributes:{},append(){},setAttribute(k,v){this.attributes[k]=v},click(){downloads++;if(downloadError)throw Object.assign(new Error('download'),{name:'SecurityError'})},remove(){}};nodes.push(n);return n}};
const context={share,document,setTimeout:f=>timers.push(f),URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:u=>revoked.push(u)},File:class{},makeImage:async()=>{if(imageError)throw new Error('PNG failed');return {type:'image/png'}},navigator:{canShare:()=>{if(canShareError)throw Object.assign(new Error(),{name:'SecurityError'});return !unsupported},share:async()=>{shares++;if(name)throw Object.assign(new Error('native error'),{name})}}};
vm.runInNewContext(setup+handler,context);
return {share,notice:nodes[0],message:nodes[1],download:nodes[2],timers,revoked,failImage(){imageError=true},get downloads(){return downloads},get shares(){return shares}};
}
(async()=>{
for(const [name,text] of Object.entries({NotAllowedError:'заблокував',SecurityError:'безпеки',InvalidStateError:'вже відкрите',TypeError:'не підтримує',DataError:'передати',UnexpectedError:'Не вдалося'})){
const t=create({name});await t.share.onclick();assert(!t.share.disabled);assert.equal(t.notice.attributes.role,'alert');assert(t.message.textContent.includes(text));assert(t.message.textContent.includes(name));assert(!t.download.hidden);t.download.onclick();assert.equal(t.downloads,1);assert(t.message.textContent.includes('Перевір список завантажень'));t.timers.forEach(f=>f());assert.deepEqual(t.revoked,['blob:test']);
}
const cancel=create({name:'AbortError'});await cancel.share.onclick();assert.equal(cancel.notice.attributes.role,'status');assert(cancel.message.textContent.includes('скасовано'));assert(!cancel.download.hidden);
const png=create({imageError:true});await png.share.onclick();assert.equal(png.notice.attributes.role,'alert');assert(png.message.textContent.includes('створити PNG'));assert(png.download.hidden);assert(!png.share.disabled);assert.equal(png.shares,0);
const success=create();await success.share.onclick();assert.equal(success.shares,1);assert(success.message.textContent.includes('системному меню'));
const unsupported=create({unsupported:true});await unsupported.share.onclick();assert.equal(unsupported.shares,0);assert.equal(unsupported.downloads,1);assert(!unsupported.download.hidden);
const failSave=create({unsupported:true,downloadError:true});await failSave.share.onclick();assert.equal(failSave.notice.attributes.role,'alert');assert(failSave.message.textContent.includes('SecurityError'));assert(!failSave.share.disabled);
const policy=create({canShareError:true});await policy.share.onclick();assert(policy.message.textContent.includes('SecurityError'));assert(!policy.download.hidden);
// A new failed image must not offer a stale PNG from a previous attempt.
success.failImage();await success.share.onclick();assert(success.download.hidden);assert(!success.share.disabled);
console.log('PASS: sharing errors, cancellation, PNG failures, unsupported browsers, manual download, download failures, URL cleanup and enabled retry');
})().catch(e=>{console.error(e);process.exitCode=1});
