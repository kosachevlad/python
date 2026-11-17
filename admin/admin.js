(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const endpoint = String(window.KODIK_ADMIN_API || '').replace(/\/$/, '');
  let session = '';
  let previewUrl = '';
  let busy = false;
  let editing = null;

  function status(id, message, kind = '') {
    const node = $(id);
    node.textContent = message;
    node.className = 'status' + (kind ? ' ' + kind : '');
  }

  async function request(path, body, authenticated = false, method = 'POST') {
    if (!endpoint) throw new Error('Адмінсервер ще не підключено.');
    const response = await fetch(endpoint + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authenticated ? { Authorization: 'Bearer ' + session } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store'
    });
    let result;
    try { result = await response.json(); } catch { result = {}; }
    if (!response.ok) throw new Error(result.error || 'Помилка сервера (HTTP ' + response.status + ').');
    return result;
  }

  async function imageBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Не вдалося прочитати картинку.'));
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.readAsDataURL(file);
    });
  }

  function fields() {
    const lastName = $('surname').value.trim().replace(/\s+/g, ' ');
    const firstName = $('firstName').value.trim().replace(/\s+/g, ' ');
    const title = $('title').value.trim();
    const code = $('code').value;
    const image = $('image').files[0];
    if (!lastName || !firstName || !title || !code.trim() || (!image && !editing)) throw new Error('Заповни всі поля та вибери картинку.');
    if (image && !['image/png', 'image/jpeg', 'image/webp'].includes(image.type)) throw new Error('Вибери PNG, JPEG або WebP.');
    if (image && image.size > 2 * 1024 * 1024) throw new Error('Картинка завелика. Максимум 2 МБ.');
    if (image && image.size === 0) throw new Error('Картинка порожня.');
    return { lastName, firstName, title, code, image };
  }

  function preview() {
    const work = fields();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = work.image ? URL.createObjectURL(work.image) : '';
    $('previewImage').src = previewUrl || new URL(editing.image, location.href).href;
    $('previewImage').alt = 'Зображення роботи «' + work.title + '»';
    $('previewWorkTitle').textContent = work.title;
    $('previewAuthor').textContent = work.lastName + ' ' + work.firstName;
    $('previewDate').textContent = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).format(editing ? new Date(editing.date + 'T12:00:00') : new Date());
    $('previewCode').textContent = work.code;
    $('previewPanel').hidden = false;
    return work;
  }


  function resetEditor() {
    editing = null;
    $('workForm').reset();
    $('editorEyebrow').textContent = 'НОВА ПУБЛІКАЦІЯ';
    $('editorTitle').textContent = 'Додати роботу';
    $('publishButton').textContent = 'Опублікувати';
    $('cancelEditButton').hidden = true;
    $('imageHint').textContent = 'PNG, JPEG або WebP, до 2 МБ. Зображення й ім’я будуть публічними.';
    $('previewPanel').hidden = true;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    status('publishStatus', '');
  }

  async function loadWorks() {
    status('worksStatus', 'Завантажую роботи…');
    const results = await Promise.allSettled([
      request('/works', undefined, false, 'GET'),
      fetch('../student-works.json', { cache: 'no-store' }).then(r => {
        if (!r.ok) throw new Error('Не вдалося завантажити старі роботи.');
        return r.json();
      })
    ]);
    if (results.every(r => r.status === 'rejected')) {
      status('worksStatus', 'Не вдалося завантажити роботи. Онови сторінку.', 'error');
      return;
    }
    const remote = results[0].status === 'fulfilled' ? results[0].value : [];
    const local = results[1].status === 'fulfilled' ? results[1].value : [];
    const works = [...remote, ...local].filter((work, index, all) =>
      work && typeof work.id === 'string' && all.findIndex(other => other?.id === work.id) === index);
    const list = $('worksList');
    list.replaceChildren();
    for (const work of works) {
      const row = document.createElement('article');
      row.className = 'work-row';
      const img = document.createElement('img');
      img.src = new URL(work.image, document.baseURI).href;
      img.alt = '';
      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = work.title;
      const meta = document.createElement('small');
      meta.textContent = work.surname + ' · ' + work.date;
      info.append(title, meta);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = 'Редагувати';
      button.addEventListener('click', () => {
        editing = work;
        const names = work.lastName && work.firstName ? [work.lastName, work.firstName] : [work.surname.split(' ')[0], work.surname.split(' ').slice(1).join(' ')];
        $('surname').value = names[0] || '';
        $('firstName').value = names[1] || '';
        $('title').value = work.title;
        $('code').value = work.code;
        $('image').value = '';
        $('editorEyebrow').textContent = 'РЕДАГУВАННЯ';
        $('editorTitle').textContent = 'Редагувати роботу';
        $('publishButton').textContent = 'Зберегти зміни';
        $('cancelEditButton').hidden = false;
        $('imageHint').textContent = 'Поточна картинка залишиться. Вибери нову, якщо хочеш її замінити (PNG, JPEG або WebP, до 2 МБ).';
        $('previewPanel').hidden = true;
        status('publishStatus', '');
        $('editorPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('surname').focus({ preventScroll: true });
      });
      row.append(img, info, button);
      list.append(row);
    }
    status('worksStatus', results.some(r => r.status === 'rejected') ? 'Частина робіт тимчасово недоступна.' : (works.length ? '' : 'Поки що немає робіт.'), results.some(r => r.status === 'rejected') ? 'error' : '');
  }

  $('newWorkButton').addEventListener('click', () => { resetEditor(); $('editorPanel').scrollIntoView({ behavior: 'smooth' }); });
  $('cancelEditButton').addEventListener('click', resetEditor);

  if (!endpoint) status('loginStatus', 'Адмінсервер ще не підключено. Публікація стане доступною після налаштування.', 'error');

  $('togglePassword').addEventListener('click', () => {
    const show = $('password').type === 'password';
    $('password').type = show ? 'text' : 'password';
    $('togglePassword').textContent = show ? 'Сховати пароль' : 'Показати пароль';
    $('togglePassword').setAttribute('aria-pressed', String(show));
    $('password').focus();
  });
  $('loginForm').addEventListener('submit', event => event.preventDefault());
  $('loginForm').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); $('loginButton').click(); }
  });
  $('loginButton').addEventListener('click', async () => {
    if (busy || !$('loginForm').reportValidity()) return;
    busy = true;
    const button = $('loginButton');
    button.disabled = true;
    status('loginStatus', 'Перевіряю доступ…');
    try {
      const response = await request('/session', { username: $('username').value.trim(), password: $('password').value.trim() });
      session = response.token;
      if (!session) throw new Error('Сервер не повернув сесію.');
      $('password').value = '';
      $('password').type = 'password';
      $('togglePassword').textContent = 'Показати пароль';
      $('togglePassword').setAttribute('aria-pressed', 'false');
      $('loginPanel').hidden = true;
      $('editorPanel').hidden = false;
      $('worksPanel').hidden = false;
      await loadWorks();
      $('surname').focus();
      status('loginStatus', '');
    } catch (error) {
      session = '';
      status('loginStatus', error.message === 'Неправильний логін або пароль.' ? 'Неправильний логін або пароль. Перевір регістр літер і символи через «Показати пароль».' : error.message, 'error');
    } finally { busy = false; button.disabled = false; }
  });

  $('logout').addEventListener('click', () => {
    session = '';
    $('loginPanel').hidden = false;
    $('editorPanel').hidden = true;
    $('worksPanel').hidden = true;
    $('worksList').replaceChildren();
    editing = null;
    $('password').value = '';
    $('workForm').reset();
    $('previewPanel').hidden = true;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    status('publishStatus', '');
    $('username').focus();
  });

  $('previewButton').addEventListener('click', () => {
    try {
      preview();
      status('publishStatus', '');
      $('previewPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { status('publishStatus', error.message, 'error'); }
  });

  $('workForm').addEventListener('submit', event => event.preventDefault());
  $('workForm').addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') event.preventDefault();
  });
  $('publishButton').addEventListener('click', async () => {
    if (busy || !session || !$('workForm').reportValidity()) return;
    let work;
    try { work = preview(); } catch (error) { status('publishStatus', error.message, 'error'); return; }
    busy = true;
    $('publishButton').disabled = true;
    $('previewButton').disabled = true;
    status('publishStatus', 'Публікую роботу…');
    try {
      const result = await request(editing ? '/works/' + encodeURIComponent(editing.id) : '/works', {
        ...(editing && !editing.id.startsWith('work-') ? { legacy: { id: editing.id, image: editing.image, date: editing.date } } : {}),
        lastName: work.lastName,
        firstName: work.firstName,
        title: work.title,
        code: work.code,
        ...(work.image ? { imageType: work.image.type, imageBase64: await imageBase64(work.image) } : {})
      }, true, editing ? 'PUT' : 'POST');
      if (!result.id) throw new Error('Сервер не підтвердив збереження.');
      const link = document.createElement('a');
      link.href = '../';
      link.textContent = 'Відкрити Кодик';
      const node = $('publishStatus');
      const wasEditing = Boolean(editing);
      resetEditor();
      node.replaceChildren(wasEditing ? 'Зміни збережено. Оновлена робота доступна в галереї Кодика. ' : 'Роботу збережено. Вона доступна в галереї Кодика. ', link);
      node.className = 'status success';
      await loadWorks();
    } catch (error) {
      if (/сесія|увійди/i.test(error.message)) session = '';
      status('publishStatus', error.message, 'error');
    } finally {
      busy = false;
      $('publishButton').disabled = false;
      $('previewButton').disabled = false;
    }
  });

  window.addEventListener('pagehide', () => {
    session = '';
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });
})();
