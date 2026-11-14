// Firebase is loaded only when the student gallery is opened.
// The configuration is public web-app metadata, never a service-account key.
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getCountFromServer,
  runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const WORKS_COLLECTION = 'studentWorks';
const safeId = id => typeof id === 'string' && /^[a-z0-9-]{1,100}$/.test(id);

export function createFirebaseLikes(config) {
  for (const key of ['apiKey', 'authDomain', 'projectId', 'appId']) {
    if (typeof config?.[key] !== 'string' || !config[key].trim()) {
      throw new Error('Firebase не налаштовано. Додай конфігурацію вебзастосунку.');
    }
  }

  const app = getApps().length ? getApp() : initializeApp(config);
  const db = getFirestore(app);
  const auth = getAuth(app);
  let authPromise;

  function identity() {
    if (!authPromise) {
      authPromise = new Promise((resolve, reject) => {
        const stop = onAuthStateChanged(auth, async user => {
          stop();
          if (user) {
            resolve(user);
          } else {
            try {
              resolve((await signInAnonymously(auth)).user);
            } catch (error) {
              reject(error);
            }
          }
        }, reject);
      }).catch(error => {
        authPromise = null;
        throw error;
      });
    }
    return authPromise;
  }

  function votes(id) {
    if (!safeId(id)) throw new Error('Невірний ідентифікатор роботи.');
    return collection(db, WORKS_COLLECTION, id, 'votes');
  }

  async function state(id) {
    const [countSnapshot, user] = await Promise.all([
      getCountFromServer(votes(id)),
      identity()
    ]);
    const userVote = await getDoc(doc(votes(id), user.uid));
    return {
      count: countSnapshot.data().count,
      liked: userVote.exists()
    };
  }

  async function like(id) {
    const user = await identity();
    const voteRef = doc(votes(id), user.uid);
    // Transaction + security rule allowing only create make repeat votes harmless.
    const created = await runTransaction(db, async transaction => {
      const current = await transaction.get(voteRef);
      if (current.exists()) return false;
      transaction.set(voteRef, { createdAt: serverTimestamp() });
      return true;
    });
    return { created, ...await state(id) };
  }

  return { state, like };
}
