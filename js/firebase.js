import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import {
  getDatabase, ref, set, get, onValue, update, push,
  query, orderByValue, endAt, limitToFirst
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js";
import {
  getAuth, setPersistence, browserSessionPersistence, signInAnonymously
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwEmI_1MkC-2K7BhKUwDQrD4NathLdIEw",
  authDomain: "quien-es-quien-anime.firebaseapp.com",
  databaseURL: "https://quien-es-quien-anime-default-rtdb.firebaseio.com",
  projectId: "quien-es-quien-anime",
  storageBucket: "quien-es-quien-anime.firebasestorage.app",
  messagingSenderId: "313904041686",
  appId: "1:313904041686:web:bb2fbc4149403b77790377"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
const auth = getAuth(app);

let promesaUid = null;
export function obtenerUid() {
  if (!promesaUid) {
    promesaUid = (async () => {
      await setPersistence(auth, browserSessionPersistence); // una identidad por pestaña
      await auth.authStateReady();
      if (!auth.currentUser) await signInAnonymously(auth);
      return auth.currentUser.uid;
    })().catch((e) => {
      promesaUid = null;
      throw e;
    });
  }
  return promesaUid;
}

export { ref, set, get, onValue, update, push, query, orderByValue, endAt, limitToFirst };
