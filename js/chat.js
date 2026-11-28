import { db, ref, update, push } from "./firebase.js";
import { $, mostrarError } from "./utils.js";
import { activarModoElegir, obtenerSeleccionado } from "./tablero.js";

let adivinando = false;
let faseActual = null;

export function configurarChat(codigo, miId) {
  const base = `salas/${codigo}`;

  async function enviarPregunta() {
    const texto = $("pregunta").value.trim();
    if (!texto) return mostrarError("Escribe una pregunta.");
    mostrarError("");
    $("enviarPregunta").disabled = true;

    const clave = push(ref(db, `${base}/mensajes`)).key;
    await update(ref(db, base), {
      fase: "responder",
      [`mensajes/${clave}`]: { de: miId, tipo: "pregunta", texto, hora: Date.now() }
    });
    $("pregunta").value = "";
  }

  async function responder(texto) {
    $("btnSi").disabled = true;
    $("btnNo").disabled = true;

    const clave = push(ref(db, `${base}/mensajes`)).key;
    await update(ref(db, base), {
      turno: miId,
      fase: "preguntar",
      [`mensajes/${clave}`]: { de: miId, tipo: "respuesta", texto, hora: Date.now() }
    });
  }

  $("enviarPregunta").addEventListener("click", enviarPregunta);
  $("pregunta").addEventListener("keydown", (e) => {
    if (e.key === "Enter") enviarPregunta();
  });
  $("btnSi").addEventListener("click", () => responder("Sí"));
  $("btnNo").addEventListener("click", () => responder("No"));

  // ---------- Adivinar ----------
  $("btnAdivinar").addEventListener("click", () => {
    mostrarError("");
    adivinando = true;
    $("panelPregunta").style.display = "none";
    $("panelAdivinar").style.display = "block";
    activarModoElegir(true);
  });

  $("cancelarAdivinar").addEventListener("click", () => {
    mostrarError("");
    adivinando = false;
    activarModoElegir(false);
    $("panelAdivinar").style.display = "none";
    $("panelPregunta").style.display = "block";
  });

  $("confirmarAdivinar").addEventListener("click", async () => {
    const p = obtenerSeleccionado();
    if (!p) return mostrarError("Haz clic en la tarjeta que crees que es el personaje de tu rival.");

    if (faseActual !== "preguntar") {
      adivinando = false;
      activarModoElegir(false);
      $("panelAdivinar").style.display = "none";
      return mostrarError("Tu rival ya intentó adivinar.");
    }
    mostrarError("");

    $("confirmarAdivinar").disabled = true;
    adivinando = false;
    activarModoElegir(false);
    $("panelAdivinar").style.display = "none";

    const clave = push(ref(db, `${base}/mensajes`)).key;
    await update(ref(db, base), {
      fase: "verificar",
      adivinanza: { de: miId, id: p.id, nombre: p.nombre },
      [`mensajes/${clave}`]: { de: miId, tipo: "adivinanza", texto: p.nombre, hora: Date.now() }
    });
  });
}

export function actualizarChat(sala, miId) {
  const voz = sala.modo === "voz";
  faseActual = sala.fase;

  $("chat").style.display = voz && sala.fase === "fin" ? "none" : "block";

  const caja = $("mensajes");
  caja.style.display = voz ? "none" : "";
  if (!voz) {
    const lista = Object.values(sala.mensajes || {}).sort((a, b) => a.hora - b.hora);
    caja.innerHTML = "";
    lista.forEach((m) => {
      const p = document.createElement("p");
      const quien = m.de === miId ? "Tú" : sala.jugadores[m.de].nombre;
      if (m.tipo === "pregunta") p.textContent = `${quien} pregunta: ${m.texto}`;
      if (m.tipo === "respuesta") p.textContent = `${quien} responde: ${m.texto}`;
      if (m.tipo === "adivinanza") p.textContent = `${quien} intenta adivinar: ${m.texto}`;
      p.className = m.tipo;
      caja.appendChild(p);
    });
    caja.scrollTop = caja.scrollHeight;
  }

  $("filaPregunta").style.display = voz ? "none" : "";
  $("panelVoz").style.display = voz && sala.fase !== "fin" ? "block" : "none";

  const miTurno = sala.turno === miId;
  const puedoPreguntar = voz ? sala.fase === "preguntar" : miTurno && sala.fase === "preguntar";
  const puedoResponder = !voz && !miTurno && sala.fase === "responder";

  if (!puedoPreguntar && adivinando) {
    adivinando = false;
    activarModoElegir(false);
  }

  $("panelPregunta").style.display = puedoPreguntar && !adivinando ? "block" : "none";
  $("panelAdivinar").style.display = puedoPreguntar && adivinando ? "block" : "none";
  $("panelResponder").style.display = puedoResponder ? "block" : "none";

  if (puedoPreguntar) {
    $("enviarPregunta").disabled = false;
    $("confirmarAdivinar").disabled = false;
  }
  if (puedoResponder) {
    $("btnSi").disabled = false;
    $("btnNo").disabled = false;
  }
}
