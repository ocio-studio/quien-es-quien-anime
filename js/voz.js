import { db, ref, set, update, push, onValue } from "./firebase.js";
import { $ } from "./utils.js";

// Servidores STUN públicos y gratuitos de Google
const ICE_SERVERS = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

let base = null;
let miId = null;
let flujoLocal = null;
let miSesion = null;
let pc = null;
let keyActual = null;
let remotaIniciada = false;
let remotaLista = false;
let pendientes = [];
const aplicados = new Set();

const estado = (t) => {
  $("estadoVoz").textContent = t;
};
const nuevaSesion = () => Math.random().toString(36).slice(2, 10);

function falla(e) {
  console.warn("Voz:", e);
  estado("🔴 No se pudo conectar la voz. Pueden hablar por Discord o Meet; el juego sigue igual.");
  $("btnReintentarVoz").style.display = "inline";
}

function cerrarConexion() {
  if (pc) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.close();
  }
  pc = null;
  keyActual = null;
  remotaIniciada = false;
  remotaLista = false;
  pendientes = [];
  aplicados.clear();
  $("audioRival").srcObject = null;
}

function crearPc(key) {
  cerrarConexion();
  keyActual = key;
  estado("Conectando...");
  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  flujoLocal.getTracks().forEach((t) => pc.addTrack(t, flujoLocal));

  pc.onicecandidate = (e) => {
    if (e.candidate && keyActual === key) {
      push(ref(db, `${base}/senal/ice/${miId}`), { key, c: JSON.stringify(e.candidate) }).catch(() => {});
    }
  };

  pc.ontrack = (e) => {
    const audio = $("audioRival");
    audio.srcObject = e.streams[0];
    audio.play().catch(() => {
      estado("Toca la pantalla para activar el sonido.");
      document.addEventListener("click", () => audio.play(), { once: true });
    });
  };

  const mipc = pc;
  pc.onconnectionstatechange = () => {
    if (pc !== mipc) return;
    const st = mipc.connectionState;
    if (st === "connected") {
      estado("🟢 Voz conectada");
      $("btnReintentarVoz").style.display = "none";
    } else if (st === "disconnected") {
      estado("⚠️ Conexión inestable...");
    } else if (st === "failed") {
      falla(new Error("connection failed"));
    }
  };
}

function vaciarPendientes() {
  pendientes.forEach((c) => pc && pc.addIceCandidate(c).catch(() => {}));
  pendientes = [];
}

function aplicarIce(lista, key) {
  if (!lista || !pc) return;
  Object.entries(lista).forEach(([id, v]) => {
    if (aplicados.has(id) || v.key !== key) return;
    aplicados.add(id);
    let cand;
    try {
      cand = JSON.parse(v.c);
    } catch {
      return;
    }
    if (remotaLista) pc.addIceCandidate(cand).catch(() => {});
    else pendientes.push(cand);
  });
}

async function iniciarComoJ1(key) {
  crearPc(key);
  const mipc = pc;
  try {
    await update(ref(db, `${base}/senal`), { oferta: null, respuesta: null, ice: null });
    if (keyActual !== key) return;
    const oferta = await mipc.createOffer();
    await mipc.setLocalDescription(oferta);
    if (keyActual !== key) return;
    await set(ref(db, `${base}/senal/oferta`), { key, sdp: mipc.localDescription.sdp });
  } catch (e) {
    if (keyActual === key) falla(e);
  }
}

async function aplicarRespuesta(r) {
  remotaIniciada = true;
  try {
    await pc.setRemoteDescription({ type: "answer", sdp: r.sdp });
    remotaLista = true;
    vaciarPendientes();
  } catch (e) {
    falla(e);
  }
}

async function iniciarComoJ2(key, oferta) {
  crearPc(key);
  remotaIniciada = true;
  const mipc = pc;
  try {
    await mipc.setRemoteDescription({ type: "offer", sdp: oferta.sdp });
    remotaLista = true;
    vaciarPendientes();
    const respuesta = await mipc.createAnswer();
    await mipc.setLocalDescription(respuesta);
    if (keyActual !== key) return;
    await set(ref(db, `${base}/senal/respuesta`), { key, sdp: mipc.localDescription.sdp });
  } catch (e) {
    if (keyActual === key) falla(e);
  }
}

function procesar(snap) {
  if (!miSesion) return;
  const s = snap.val() || {};
  const l1 = s.listo?.j1;
  const l2 = s.listo?.j2;

  if (!l1 || !l2) {
    if (keyActual) {
      cerrarConexion();
      estado("Esperando a que tu rival active la voz...");
    }
    return;
  }
  if (s.listo[miId] !== miSesion) return;

  const key = `${l1}-${l2}`;

  if (miId === "j1") {
    if (key !== keyActual) {
      iniciarComoJ1(key);
    } else {
      if (s.respuesta?.key === key && !remotaIniciada) aplicarRespuesta(s.respuesta);
      aplicarIce(s.ice?.j2, key);
    }
  } else {
    if (key !== keyActual) {
      if (keyActual) cerrarConexion();
      if (s.oferta?.key === key) iniciarComoJ2(key, s.oferta);
    } else {
      aplicarIce(s.ice?.j1, key);
    }
  }
}

async function activar() {
  $("btnActivarVoz").disabled = true;
  try {
    flujoLocal = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
  } catch (e) {
    $("btnActivarVoz").disabled = false;
    estado("No pude usar el micrófono. Pueden hablar por Discord o Meet; el juego sigue igual.");
    return;
  }

  miSesion = nuevaSesion();
  $("btnActivarVoz").style.display = "none";
  $("controlesVoz").style.display = "block";
  $("btnMic").textContent = "🎙️ Micrófono: encendido";
  estado("Esperando a que tu rival active la voz...");
  await set(ref(db, `${base}/senal/listo/${miId}`), miSesion);
}

function alternarMic() {
  const pista = flujoLocal && flujoLocal.getAudioTracks()[0];
  if (!pista) return;
  pista.enabled = !pista.enabled;
  $("btnMic").textContent = pista.enabled ? "🎙️ Micrófono: encendido" : "🔇 Micrófono: apagado";
}

async function reintentar() {
  if (!flujoLocal) return;
  $("btnReintentarVoz").style.display = "none";
  cerrarConexion();
  miSesion = nuevaSesion();
  estado("Reintentando...");
  await set(ref(db, `${base}/senal/listo/${miId}`), miSesion);
}

export function configurarVoz(codigo, id) {
  base = `salas/${codigo}`;
  miId = id;

  $("btnActivarVoz").addEventListener("click", activar);
  $("btnMic").addEventListener("click", alternarMic);
  $("btnReintentarVoz").addEventListener("click", reintentar);
  $("volumen").addEventListener("input", (e) => {
    $("audioRival").volume = e.target.value / 100;
  });

  onValue(ref(db, `${base}/senal`), procesar, () => {});
}

export async function detenerVoz() {
  cerrarConexion();
  if (flujoLocal) flujoLocal.getTracks().forEach((t) => t.stop());
  if (base && miSesion) {
    try {
      await set(ref(db, `${base}/senal/listo/${miId}`), null);
    } catch (e) {
      // si falla, igual se sale
    }
  }
  miSesion = null;
}
