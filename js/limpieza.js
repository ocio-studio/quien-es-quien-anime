import { db, ref, get, update, query, orderByValue, endAt, limitToFirst, obtenerUid } from "./firebase.js";

const HORAS = 24;

export async function limpiarSalasAntiguas() {
  try {
    await obtenerUid();
    const limite = Date.now() - HORAS * 60 * 60 * 1000;
    const q = query(ref(db, "indice"), orderByValue(), endAt(limite), limitToFirst(50));
    const snap = await get(q);
    if (!snap.exists()) return;

    const borrar = {};
    snap.forEach((hijo) => {
      borrar[`salas/${hijo.key}`] = null;
      borrar[`indice/${hijo.key}`] = null;
    });
    await update(ref(db), borrar);
  } catch (e) {
    console.warn("No se pudo limpiar salas antiguas:", e.message);
  }
}