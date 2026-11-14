(() => {
  'use strict';
  const footer = document.querySelector('.feedback-footer') || document.querySelector('.share-footer') || document.querySelector('main');
  if (!footer) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'feedback-button student-works-link';
  button.textContent = '🎨 Роботи учнів';
  if (footer.classList.contains('feedback-footer')) footer.prepend(button);
  else footer.append(button);

  const dialog = document.createElement('dialog');
  dialog.className = 'student-works-dialog';
  dialog.setAttribute('aria-labelledby', 'studentWorksHeading');
  const heading = document.createElement('div');
  heading.className = 'student-works-heading';
  heading.innerHTML = '<div><h2 id="studentWorksHeading">Роботи учнів</h2><p>Цікаві програми, створені в Кодику</p></div>';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'student-works-close';
  close.textContent = '✕';
  close.setAttribute('aria-label', 'Закрити роботи учнів');
  heading.append(close);

  const status = document.createElement('p');
  status.className = 'student-works-status';
  status.setAttribute('role', 'status');
  const gallery = document.createElement('div');
  gallery.className = 'student-works-grid';
  dialog.append(heading, status, gallery);
  document.body.append(dialog);

  const likedKey = 'kodik-student-works-liked-v1';
  function likedIds() {
    try {
      const value = JSON.parse(localStorage.getItem(likedKey) || '[]');
      return Array.isArray(value) ? value.filter(x => typeof x === 'string') : [];
    } catch { return []; }
  }
  function like(id) {
    const ids = likedIds();
    if (ids.includes(id)) return false;
    try {
      localStorage.setItem(likedKey, JSON.stringify([...ids, id]));
      return true;
    } catch {
      status.textContent = 'Не вдалося зберегти лайк: браузер забороняє локальне сховище.';
      return false;
    }
  }
  function formatDate(value) {
    const date = new Date(value + 'T12:00:00');
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).format(date);
  }
  function openInEditor(work) {
    const mode = document.getElementById('modeSimple');
    if (window.kodikIDE?.active && mode && !mode.disabled) mode.click();
    if (window.kodikIDE?.active) {
      status.textContent = 'Заверши виконання програми та перемкнись у режим «Навчання».';
      return;
    }
    const add = document.getElementById('add');
    const editor = document.getElementById('editor');
    if (!add || !editor || editor.disabled || editor.readOnly || document.getElementById('run')?.disabled) {
      status.textContent = 'Редактор зайнятий. Заверши виконання програми та спробуй знову.';
      return;
    }
    add.click(); // Preserve the student's existing code in its own tab.
    editor.value = work.code;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    dialog.close();
    document.querySelector('.workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    editor.focus({ preventScroll: true });
    const output = document.getElementById('output');
    if (output) output.textContent = 'Роботу відкрито в новій вкладці. Натисни «Запустити», щоб спробувати.';
  }
  function render(items) {
    gallery.replaceChildren();
    status.textContent = '';
    if (!items.length) {
      status.textContent = 'Тут незабаром з’являться перші роботи учнів.';
      return;
    }
    for (const work of items) {
      if (!work || typeof work.id !== 'string' || typeof work.surname !== 'string' ||
          typeof work.date !== 'string' || typeof work.image !== 'string' ||
          typeof work.code !== 'string' || !work.id || !work.image) continue;
      const card = document.createElement('article');
      card.className = 'student-work-card';
      const image = document.createElement('img');
      image.src = new URL(work.image, document.baseURI).href;
      image.alt = 'Код і результат виконання роботи «' + (work.title || 'Робота учня') + '», автор: ' + work.surname;
      image.loading = 'lazy';
      image.decoding = 'async';
      const details = document.createElement('div');
      details.className = 'student-work-details';
      const title = document.createElement('h3');
      title.className = 'student-work-title';
      title.textContent = work.title || 'Робота учня';
      const author = document.createElement('p');
      author.className = 'student-work-author';
      author.textContent = work.surname;
      const date = document.createElement('time');
      date.dateTime = work.date;
      date.textContent = formatDate(work.date);
      const actions = document.createElement('div');
      actions.className = 'student-work-actions';
      const tryButton = document.createElement('button');
      tryButton.type = 'button';
      tryButton.textContent = '▶ Спробувати';
      tryButton.onclick = () => openInEditor(work);
      const likeButton = document.createElement('button');
      likeButton.type = 'button';
      likeButton.className = 'student-work-like';
      const updateLike = () => {
        const isLiked = likedIds().includes(work.id);
        // On this static GitHub Pages site we only know the current browser's vote.
        // Do not present this 0/1 value as a global like count.
        likeButton.textContent = isLiked ? '♥ 1 · Вподобано' : '♡ 0 · Лайк';
        likeButton.setAttribute('aria-label', (isLiked ? 'Вподобано' : 'Поставити лайк') + '. Лайків із цього браузера: ' + Number(isLiked));
        likeButton.setAttribute('aria-pressed', String(isLiked));
        likeButton.disabled = isLiked;
        likeButton.title = isLiked ? 'Ви вже поставили лайк на цьому пристрої' : 'Поставити лайк';
      };
      likeButton.onclick = () => { if (like(work.id)) updateLike(); };
      updateLike();
      actions.append(tryButton, likeButton);
      details.append(title, author, date, actions);
      card.append(image, details);
      gallery.append(card);
    }
    if (!gallery.children.length) status.textContent = 'Поки що немає опублікованих робіт.';
  }
  let loaded = false;
  async function load() {
    status.textContent = 'Завантажуємо роботи…';
    try {
      const response = await fetch('./student-works.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const items = await response.json();
      if (!Array.isArray(items)) throw new Error('Невірний формат списку');
      render(items);
      loaded = true;
    } catch {
      status.textContent = 'Не вдалося завантажити роботи. Перевір з’єднання й спробуй відкрити галерею знову.';
    }
  }
  button.onclick = () => {
    dialog.showModal();
    if (!loaded) load();
    close.focus();
  };
  close.onclick = () => dialog.close();
  dialog.addEventListener('close', () => button.focus({ preventScroll: true }));
})();
