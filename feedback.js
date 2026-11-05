(()=>{
'use strict';
const footer=document.querySelector('.share-footer');if(!footer)return;
const area=document.createElement('div');area.className='feedback-footer';
const button=document.createElement('button');button.id='contactButton';button.type='button';button.className='feedback-button';button.textContent='Зворотний зв’язок';area.append(button);footer.append(area);
const dialog=document.createElement('dialog');dialog.id='contactDialog';dialog.className='feedback-dialog';dialog.setAttribute('aria-labelledby','contactHeading');
dialog.innerHTML=`<div class="contact-heading"><h2 id="contactHeading">Зворотний зв’язок</h2><button type="button" id="closeContact" aria-label="Закрити">✕</button></div>
<p>Питання, пропозиції для уроків або ідеї нових можливостей — напишіть мені.</p>
<form id="contactForm"><label for="contactName">Ваше ім’я</label><input id="contactName" name="name" autocomplete="name" placeholder="Як до вас звертатися">
<label for="contactEmail">Ваш email</label><input id="contactEmail" name="email" type="email" autocomplete="email" placeholder="name@example.com" required>
<label for="contactMessage">Повідомлення</label><textarea id="contactMessage" name="message" placeholder="Опишіть ідею або проблему" rows="5" required></textarea>
<p class="contact-direct">Або напишіть напряму: <a href="mailto:kosachevlad@gmail.com">kosachevlad@gmail.com</a></p>
<div class="contact-actions"><button type="button" id="cancelContact">Відміна</button><button type="submit" class="contact-submit">Відкрити лист</button></div>
<p id="contactStatus" role="status" aria-live="polite"></p></form>`;
document.body.append(dialog);
const get=id=>dialog.querySelector('#'+id),form=get('contactForm'),message=get('contactMessage');
button.onclick=()=>{get('contactStatus').textContent='';dialog.showModal();get('contactName').focus()};
get('closeContact').onclick=get('cancelContact').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>button.focus({preventScroll:true}));
message.addEventListener('input',()=>message.setCustomValidity(''));
form.addEventListener('submit',event=>{
event.preventDefault();
if(!form.reportValidity())return;
const name=get('contactName').value.trim(),email=get('contactEmail').value.trim(),text=message.value.trim();
if(!text){message.setCustomValidity('Напишіть повідомлення.');message.reportValidity();return}
const body=[name?'Ім’я: '+name:'','Email: '+email,'','Кодик v1.30','',text].filter((v,i)=>v||i>1).join('\n');
get('contactStatus').textContent='Відкриваємо поштову програму. Перевірте лист і натисніть «Надіслати» в ній. Якщо вона не відкрилась, напишіть на адресу вище.';
try{window.location.href='mailto:kosachevlad@gmail.com?subject='+encodeURIComponent('Кодик — зворотний зв’язок')+'&body='+encodeURIComponent(body)}catch{
get('contactStatus').textContent='Не вдалося відкрити поштову програму. Напишіть напряму: kosachevlad@gmail.com';
}
});
})();
