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

  // Firestore counts are global. We deliberately never fall back to misleading
  // local-only totals if Firebase has not been configured or is unavailable.
  let likesServicePromise;
  const workLikeControls = new Map();
  async function service() {
    if (!likesServicePromise) {
      likesServicePromise = (async () => {
        const response = await fetch('./firebase-config.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('Firebase config unavailable');
        const config = await response.json();
        if (!config?.apiKey || !config?.projectId || !config?.appId || !config?.authDomain) {
          throw new Error('Firebase config missing');
        }
        const { createFirebaseLikes } = await import('./firebase-likes.js?v=1');
        return createFirebaseLikes(config);
      })().catch(error => { likesServicePromise = null; throw error; });
    }
    return likesServicePromise;
  }
  function updateLikeButton(button, { count, liked, pending = false, error = false }) {
    button.disabled = pending || liked || error;
    button.setAttribute('aria-pressed', String(Boolean(liked)));
    button.textContent = error ? '♡ Лайки недоступні'
      : count == null ? '♡ Завантаження…'
      : (liked ? '♥ ' : '♡ ') + count + (liked ? ' · Вподобано' : ' · Лайк');
    button.title = error ? 'Не вдалося отримати кількість лайків із Firebase'
      : liked ? 'Ви вже вподобали цю роботу' : 'Вподобати роботу';
  }
  async function refreshLikes(ids) {
    if (!ids.length) return;
    let api;
    try { api = await service(); }
    catch {
      for (const id of ids) {
        const control = workLikeControls.get(id);
        if (control) updateLikeButton(control.button, { error: true });
      }
      return;
    }
    await Promise.all(ids.map(async id => {
      const control = workLikeControls.get(id);
      if (!control || control.busy) return;
      try {
        const state = await api.state(id);
        if (control !== workLikeControls.get(id) || control.busy) return;
        control.count = state.count;
        control.liked = state.liked;
        updateLikeButton(control.button, state);
      } catch {
        if (control === workLikeControls.get(id)) updateLikeButton(control.button, { error: true });
      }
    }));
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
    workLikeControls.clear();
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
      const control = { button: likeButton, count: null, liked: false, busy: false };
      workLikeControls.set(work.id, control);
      updateLikeButton(likeButton, { count: null, pending: true });
      likeButton.onclick = async () => {
        if (control.busy || control.liked || control.count === null) return;
        control.busy = true;
        updateLikeButton(likeButton, { count: control.count, liked: control.liked, pending: true });
        try {
          const api = await service();
          const state = await api.like(work.id);
          control.count = state.count;
          control.liked = state.liked;
          updateLikeButton(likeButton, state);
        } catch {
          updateLikeButton(likeButton, { error: true });
        } finally { control.busy = false; }
      };
      actions.append(tryButton, likeButton);
      details.append(title, author, date, actions);
      card.append(image, details);
      gallery.append(card);
    }
    if (!gallery.children.length) status.textContent = 'Поки що немає опублікованих робіт.';
    void refreshLikes([...workLikeControls.keys()]);
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
    else void refreshLikes([...workLikeControls.keys()]);
    close.focus();
  };
  close.onclick = () => dialog.close();
  dialog.addEventListener('close', () => button.focus({ preventScroll: true }));
})();
