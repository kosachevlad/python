const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
function element(){return {value:'',textContent:'',className:'',style:{},children:[],handlers:{},setAttribute(){},append(...nodes){this.children.push(...nodes)},addEventListener(name,fn){this.handlers[name]=fn},focus(){this.focused=true},showModal(){this.open=true},close(){this.open=false;this.handlers.close?.()},reportValidity(){return !this.validity},setCustomValidity(value){this.validity=value}}}
const footer=element(),nodes=Object.fromEntries(['contactForm','contactName','contactEmail','contactMessage','contactStatus','closeContact','cancelContact'].map(id=>[id,element()]));
const dialog=element();dialog.querySelector=s=>nodes[s.slice(1)];
const document={body:element(),querySelector:s=>s==='.share-footer'?footer:null,createElement:tag=>tag==='dialog'?dialog:element()},window={location:{href:''}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'feedback.js'),'utf8'),{document,window,encodeURIComponent});
const button=footer.children[0].children[0];button.onclick();assert(dialog.open);assert(nodes.contactName.focused);
nodes.contactName.value='Вчитель';nodes.contactEmail.value='teacher@example.com';nodes.contactMessage.value='Класна ідея & ще ? # 💡';
nodes.contactForm.handlers.submit({preventDefault(){}});
const mail=new URL(window.location.href);assert.equal(mail.pathname,'kosachevlad@gmail.com');assert.equal(mail.searchParams.get('subject'),'Кодик — зворотний зв’язок');assert(mail.searchParams.get('body').includes('Класна ідея & ще ? # 💡'));assert(nodes.contactStatus.textContent.includes('Надіслати'));
window.location.href='';nodes.contactMessage.value='   ';nodes.contactForm.handlers.submit({preventDefault(){}});assert.equal(window.location.href,'');assert(nodes.contactMessage.validity);nodes.contactMessage.handlers.input();assert.equal(nodes.contactMessage.validity,'');
nodes.cancelContact.onclick();assert(!dialog.open);assert(button.focused);button.onclick();nodes.closeContact.onclick();assert(!dialog.open);
console.log('PASS: feedback modal, close and focus, mailto recipient and Unicode encoding, whitespace validation, explicit manual sending');
