(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const endpoint = String(window.KODIK_ADMIN_API || '').replace(/\/$/, '');
  let session = '';
  let previewUrl = '';
  let busy = false;

  function status(id, message, kind = '') {
    const node = $(id);
    node.textContent = message;
    node.className = 'status' + (kind ? ' ' + kind : '');
  }

  async function request(path, body, authenticated = false) {
    if (!endpoint) throw new Error('Адмінсервер ще не підключено.');
    const response = await fetch(endpoint + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authenticated ? { Authorization: 'Bearer ' + session } : {})
      },
      body: JSON.stringify(body),
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
    if (!lastName || !firstName || !title || !code.trim() || !image) throw new Error('Заповни всі поля та вибери картинку.');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(image.type)) throw new Error('Вибери PNG, JPEG або WebP.');
    if (image.size > 2 * 1024 * 1024) throw new Error('Картинка завелика. Максимум 2 МБ.');
    if (image.size === 0) throw new Error('Картинка порожня.');
    return { lastName, firstName, title, code, image };
  }

  function preview() {
    const work = fields();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(work.image);
    $('previewImage').src = previewUrl;
    $('previewImage').alt = 'Зображення роботи «' + work.title + '»';
    $('previewWorkTitle').textContent = work.title;
    $('previewAuthor').textContent = work.lastName + ' ' + work.firstName;
    $('previewDate').textContent = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    $('previewCode').textContent = work.code;
    $('previewPanel').hidden = false;
    return work;
  }

  if (!endpoint) status('loginStatus', 'Адмінсервер ще не підключено. Публікація стане доступною після налаштування.', 'error');

  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const button = $('loginForm').querySelector('button');
    button.disabled = true;
    status('loginStatus', 'Перевіряю доступ…');
    try {
      const response = await request('/session', { username: $('username').value.trim(), password: $('password').value });
      session = response.token;
      if (!session) throw new Error('Сервер не повернув сесію.');
      $('password').value = '';
      $('loginPanel').hidden = true;
      $('editorPanel').hidden = false;
      $('surname').focus();
      status('loginStatus', '');
    } catch (error) {
      session = '';
      $('password').value = '';
      status('loginStatus', error.message, 'error');
    } finally { busy = false; button.disabled = false; }
  });

  $('logout').addEventListener('click', () => {
    session = '';
    $('loginPanel').hidden = false;
    $('editorPanel').hidden = true;
    $('password').value = '';
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

  $('workForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !session) return;
    let work;
    try { work = preview(); } catch (error) { status('publishStatus', error.message, 'error'); return; }
    busy = true;
    $('publishButton').disabled = true;
    $('previewButton').disabled = true;
    status('publishStatus', 'Публікую роботу…');
    try {
      const result = await request('/works', {
        lastName: work.lastName,
        firstName: work.firstName,
        title: work.title,
        code: work.code,
        imageType: work.image.type,
        imageBase64: await imageBase64(work.image)
      }, true);
      if (!result.id) throw new Error('Сервер не підтвердив збереження.');
      const link = document.createElement('a');
      link.href = '../';
      link.textContent = 'Відкрити Кодик';
      const node = $('publishStatus');
      node.replaceChildren('Роботу збережено. Вона доступна в галереї Кодика. ', link);
      node.className = 'status success';
      $('workForm').reset();
      $('previewPanel').hidden = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = '';
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
