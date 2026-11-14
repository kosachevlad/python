# Налаштування спільних лайків через GitHub Actions Secrets

**Важливо:** конфігурація Firebase Web SDK, включно з Web API key, є публічною інформацією для браузера. GitHub Secrets прибирає ключ із Git-комітів і репозиторію, але **не приховує його від відвідувачів готового сайту**. Безпеку Firestore забезпечують правила доступу, Authentication та обмеження API key.

## Налаштування репозиторію

1. У GitHub відкрий **Settings → Secrets and variables → Actions → New repository secret**.
2. Назва: `KODIK_FIREBASE_WEB_CONFIG`.
3. Значення: **повний JSON-об'єкт** конфігурації Firebase Web App (apiKey, authDomain, projectId, appId, storageBucket, messagingSenderId, measurementId). Без рядка `const firebaseConfig =`, без трьох бектиків.
4. Відкрий **Settings → Pages → Build and deployment → Source** та обери **GitHub Actions**. Це обов'язково: попередній Pages deployment із гілки не виконує workflow.
5. Злий PR у `main` або вручну запусти **Actions → Deploy Kodik to GitHub Pages → Run workflow** після злиття. Дочекайся успішного виконання.
6. У Firebase Console увімкни **Authentication → Sign-in method → Anonymous**.
7. Створи **Cloud Firestore** і опублікуй правила з `firestore.rules` (об'єднай з наявними правилами, якщо цей Firebase-проєкт уже використовується).
8. Перевір голосування на сайті у двох браузерах. Доступність лічильника залежить від налаштованого Firebase.

## GitHub Secret Scanning alert

- Ключ уже був записаний у коміт `d3dcea96` у старій гілці PR #8. Видалення файлу новим комітом **не стирає його зі старої історії**.
- Обмеж Firebase API key у **Google Cloud Console → APIs & Services → Credentials** за HTTP referrer (домен `kosachevlad.github.io`) і доступними API. Перед обмеженнями перевір сумісність з Firebase Auth/Firestore.
- За потреби створи новий ключ для Firebase Web App, онови Firebase-конфігурацію та Repository Secret; старий ключ відклич після переходу.
- Переглянь GitHub Security → Secret scanning → Alert і закрий його лише після оцінки та усунення ризику. Не позначай як «секрет захищений» тільки тому, що він у GitHub Actions Secrets.
- Не коміть `firebase-config.json` у репозиторій.

## Обмеження

- Лічильник спільний і рахується через Cloud Firestore; старі голоси з localStorage не мігрують.
- Один анонімний Firebase UID може голосувати один раз за роботу. Новий профіль або очищення даних може створити інший UID. Це не абсолютний захист від накрутки.
- Правило Firestore `list` потрібне для прямої клієнтської агрегації й дозволяє запити до колекції голосів. Для сильнішої приватності або захисту від накрутки потрібна серверна агрегація.
