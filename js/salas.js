import { db, ref, set, get, onValue, update, obtenerUid } from "./firebase.js";
import { $, mostrarError, generarCodigo, guardarSesion, borrarSesion } from "./utils.js";
import { personajesGeneral, personajesSerie } from "./anilist.js";
import {
  mostrarTablero, activarModoElegir, obtenerSeleccionado, configurarGuardado, reiniciarTablero
} from "./tablero.js";
import { configurarChat, actualizarChat } from "./chat.js";
import { limpiarSalasAntiguas } from "./limpieza.js";
import { activarAutocompletar } from "./autocompletar.js";
import { configurarVoz, detenerVoz } from "./voz.js";

const autoSerie = activarAutocompletar($("serie"), $("sugerencias"));
const autoNueva = activarAutocompletar($("serieNueva"), $("sugerenciasNueva"));

$("serieNueva").addEventListener("focus", () => {
  document.querySelector('input[name="modoNueva"][value="serie"]').checked = true;
});

let secreto = null;
let yaConfirme = false;
let verificando = false;
let revelado = false;
let rondaLocal = null;
let ultimaSala = null;
let vozConfigurada = false;

export async function crearSala() {
  mostrarError("");
  const nombre = $("nombre").value.trim().slice(0, 20);
  if (!nombre) return mostrarError("Escribe tu nombre primero.");

  const modo = document.querySelector('input[name="modo"]:checked').value;
  const modoJuego = document.querySelector('input[name="modoJuego"]:checked').value;
  let personajes, titulo;

  try {
    $("crear").disabled = true;
    $("crear").textContent = "Creando...";
    if (modo === "serie") {
      const nombreSerie = $("serie").value.trim();
      if (!nombreSerie) throw new Error("Escribe el nombre de la serie.");
      const r = await personajesSerie(nombreSerie, autoSerie.obtenerId());
      personajes = r.lista;
      titulo = r.titulo;
    } else {
      personajes = await personajesGeneral();
      titulo = "Personajes populares";
    }
  } catch (e) {
    $("crear").disabled = false;
    $("crear").textContent = "Crear sala";
    return mostrarError(e.message);
  }

  limpiarSalasAntiguas();

  try {
    const uid = await obtenerUid();

    let codigo;
    do {
      codigo = generarCodigo();
    } while ((await get(ref(db, "indice/" + codigo))).exists());

    const creada = Date.now();
    await update(ref(db), {
      [`salas/${codigo}`]: {
        estado: "esperando",
        turno: "j1",
        turnoInicial: "j1",
        fase: "preguntar",
        ronda: 0,
        modo: modoJuego,
        creada,
        titulo,
        personajes,
        jugadores: { j1: { nombre, uid } }
      },
      [`indice/${codigo}`]: creada
    });

    entrarASala(codigo, "j1");
  } catch (e) {
    $("crear").disabled = false;
    $("crear").textContent = "Crear sala";
    mostrarError("No se pudo crear la sala: " + e.message);
  }
}

export async function unirseASala() {
  mostrarError("");
  const nombre = $("nombre").value.trim().slice(0, 20);
  const codigo = $("codigo").value.trim().toUpperCase();
  if (!nombre) return mostrarError("Escribe tu nombre primero.");
  if (!codigo) return mostrarError("Escribe el código de la sala.");

  try {
    const uid = await obtenerUid();
    // Se intenta entrar directo: las reglas decidirán si la sala existe y tiene lugar
    await set(ref(db, `salas/${codigo}/jugadores/j2`), { nombre, uid });
  } catch (e) {
    return mostrarError("No pude entrar: la sala no existe o ya está llena.");
  }

  entrarASala(codigo, "j2");
}

export async function reconectar(codigo, miId) {
  try {
    const uid = await obtenerUid();
    const snap = await get(ref(db, "salas/" + codigo));
    if (!snap.exists() || snap.val().jugadores?.[miId]?.uid !== uid) {
      borrarSesion();
      return;
    }
  } catch (e) {
    borrarSesion();
    return;
  }

  const guardado = sessionStorage.getItem(`qeq_secreto_${codigo}_${miId}`);
  if (guardado) {
    secreto = JSON.parse(guardado);
    yaConfirme = true;
    mostrarMiSecreto(secreto);
  }

  entrarASala(codigo, miId);
}

function mostrarMiSecreto(p) {
  const caja = $("miSecreto");
  caja.innerHTML = `<p>Tu personaje secreto:</p><img src="${p.imagen}" width="80" alt=""><div></div>`;
  caja.querySelector("div").textContent = p.nombre;
  caja.style.display = "block";
}

function textoTurno(sala, miId) {
  if (sala.modo === "voz") {
    return sala.fase === "verificar"
      ? "Verificando la adivinanza..."
      : "🎙️ Voz libre: pregunten hablando. Pulsa «Quiero adivinar» cuando creas saber.";
  }
  const miTurno = sala.turno === miId;
  if (sala.fase === "verificar") return "Verificando la adivinanza...";
  if (sala.fase === "preguntar") {
    return miTurno ? "👉 Tu turno: haz una pregunta o intenta adivinar" : "Tu rival está pensando una pregunta...";
  }
  return miTurno ? "Esperando la respuesta de tu rival..." : "Tu rival te preguntó. Responde Sí o No.";
}

function agregarBloque(contenedor, titulo, p) {
  const div = document.createElement("div");
  div.className = "bloque";
  const t = document.createElement("p");
  t.textContent = titulo;
  div.appendChild(t);
  if (p) {
    const img = document.createElement("img");
    img.src = p.imagen;
    div.appendChild(img);
    const n = document.createElement("div");
    n.textContent = p.nombre;
    div.appendChild(n);
  }
  contenedor.appendChild(div);
}

function mostrarFin(sala, miId) {
  const gane = sala.ganador === miId;
  $("fin").style.display = "block";
  $("resultado").textContent = gane
    ? "🎉 ¡Ganaste!"
    : `Perdiste. Ganó ${sala.jugadores[sala.ganador].nombre}.`;

  const rivalId = miId === "j1" ? "j2" : "j1";
  const rev = sala.reveal || {};
  $("secretos").innerHTML = "";
  agregarBloque($("secretos"), "Tu personaje", secreto || rev[miId]);
  agregarBloque($("secretos"), `Personaje de ${sala.jugadores[rivalId].nombre}`, rev[rivalId]);

  if (sala.jugadores[rivalId]?.salio) {
    $("avisoRival").textContent = "Tu rival salió de la sala. Pulsa Salir para volver al inicio.";
    $("revancha").disabled = true;
    $("btnNuevaRonda").disabled = true;
    $("panelNueva").style.display = "none";
    $("botonesFin").style.display = "block";
  }
}

function reiniciarLocal(codigo, miId) {
  secreto = null;
  yaConfirme = false;
  verificando = false;
  revelado = false;
  sessionStorage.removeItem(`qeq_secreto_${codigo}_${miId}`);
  reiniciarTablero();
  activarModoElegir(false);
  $("miSecreto").style.display = "none";
  $("fin").style.display = "none";
  $("chat").style.display = "none";
  $("revancha").disabled = false;
  $("btnNuevaRonda").disabled = false;
  $("confirmarAdivinar").disabled = false;
  $("panelNueva").style.display = "none";
  $("botonesFin").style.display = "block";
  $("avisoRival").textContent = "";
  $("confirmarNueva").disabled = false;
  $("confirmarNueva").textContent = "Empezar nueva ronda";
  autoNueva.limpiar();
}

async function reiniciarSala(codigo, extra = {}) {
  const empieza = ultimaSala.ganador === "j1" ? "j2" : "j1";
  await update(ref(db, `salas/${codigo}`), {
    estado: "eligiendo",
    fase: "preguntar",
    ronda: (ultimaSala.ronda || 0) + 1,
    turnoInicial: empieza,
    turno: empieza,
    mensajes: null,
    listos: null,
    adivinanza: null,
    ganador: null,
    reveal: null,
    ...extra
  });
}

function entrarASala(codigo, miId) {
  guardarSesion(codigo, miId);
  configurarGuardado(`qeq_descartados_${codigo}_${miId}`);

  $("inicio").style.display = "none";
  $("sala").style.display = "block";
  $("codigoSala").textContent = codigo;
  $("miId").textContent = miId;

  configurarChat(codigo, miId);

  // ---------- Botones de la pantalla final ----------
  $("revancha").addEventListener("click", async () => {
    if (!ultimaSala || ultimaSala.estado !== "terminada") return;
    mostrarError("");
    $("revancha").disabled = true;
    try {
      await reiniciarSala(codigo);
    } catch (e) {
      $("revancha").disabled = false;
      mostrarError("No se pudo reiniciar la sala: " + e.message);
    }
  });

  $("btnNuevaRonda").addEventListener("click", () => {
    mostrarError("");
    $("botonesFin").style.display = "none";
    $("panelNueva").style.display = "block";
  });

  $("cancelarNueva").addEventListener("click", () => {
    mostrarError("");
    $("panelNueva").style.display = "none";
    $("botonesFin").style.display = "block";
  });

  $("confirmarNueva").addEventListener("click", async () => {
    if (!ultimaSala || ultimaSala.estado !== "terminada") return;
    mostrarError("");
    const modo = document.querySelector('input[name="modoNueva"]:checked').value;

    $("confirmarNueva").disabled = true;
    $("confirmarNueva").textContent = "Buscando personajes...";
    try {
      let personajes, titulo;
      if (modo === "serie") {
        const nombreSerie = $("serieNueva").value.trim();
        if (!nombreSerie) throw new Error("Escribe el nombre de la serie.");
        const r = await personajesSerie(nombreSerie, autoNueva.obtenerId());
        personajes = r.lista;
        titulo = r.titulo;
      } else {
        personajes = await personajesGeneral();
        titulo = "Personajes populares";
      }
      await reiniciarSala(codigo, { personajes, titulo });
    } catch (e) {
      mostrarError(e.message);
      $("confirmarNueva").disabled = false;
      $("confirmarNueva").textContent = "Empezar nueva ronda";
    }
  });

  $("salir").addEventListener("click", async () => {
    $("salir").disabled = true;
    await detenerVoz();
    try {
      await set(ref(db, `salas/${codigo}/jugadores/${miId}/salio`), true);
    } catch (e) {
      // si falla el aviso, igual se sale
    }
    borrarSesion();
    sessionStorage.removeItem(`qeq_secreto_${codigo}_${miId}`);
    sessionStorage.removeItem(`qeq_descartados_${codigo}_${miId}`);
    location.reload();
  });

  $("confirmarSecreto").addEventListener("click", async () => {
    const p = obtenerSeleccionado();
    if (!p) return mostrarError("Haz clic en una tarjeta para elegir tu personaje.");
    mostrarError("");

    secreto = p;
    yaConfirme = true;
    sessionStorage.setItem(`qeq_secreto_${codigo}_${miId}`, JSON.stringify(p));
    activarModoElegir(false);
    $("panelElegir").style.display = "none";
    mostrarMiSecreto(p);

    await set(ref(db, `salas/${codigo}/listos/${miId}`), true);
  });

  onValue(
    ref(db, "salas/" + codigo),
    (snap) => {
      const sala = snap.val();
      if (!sala) return;
      ultimaSala = sala;

      const ronda = sala.ronda || 0;
      if (rondaLocal === null) rondaLocal = ronda;
      else if (ronda !== rondaLocal) {
        rondaLocal = ronda;
        reiniciarLocal(codigo, miId);
      }

      $("listaJugadores").innerHTML = Object.entries(sala.jugadores)
        .map(([id, j]) => `<li>${id}: ${j.nombre}</li>`)
        .join("");

      $("tituloTablero").textContent = sala.titulo || "";
      $("modoSala").textContent = sala.modo === "voz" ? "Voz libre (sin turnos)" : "Por turnos (chat)";
      $("barraVoz").style.display = sala.modo === "voz" ? "block" : "none";
      if (sala.modo === "voz" && !vozConfigurada) {
        vozConfigurada = true;
        configurarVoz(codigo, miId);
      }
      if (sala.personajes) mostrarTablero(sala.personajes);

      if (sala.estado === "esperando") {
        $("estado").textContent = "Esperando al segundo jugador...";
        $("turno").textContent = "";

        if (miId === "j1" && sala.jugadores.j2) {
          update(ref(db, `salas/${codigo}`), { estado: "eligiendo" });
        }
      }

      if (sala.estado === "eligiendo") {
        $("turno").textContent = "";
        if (!yaConfirme) {
          $("estado").textContent = "Elige tu personaje secreto.";
          $("panelElegir").style.display = "block";
          activarModoElegir(true);
        } else {
          $("estado").textContent = "Esperando a que tu rival elija su personaje...";
        }

        if (miId === "j1" && sala.listos?.j1 && sala.listos?.j2) {
          update(ref(db, `salas/${codigo}`), {
            estado: "jugando",
            turno: sala.turnoInicial || "j1",
            fase: "preguntar"
          });
        }
      }

      if (sala.estado === "jugando") {
        $("estado").textContent = "¡A jugar!";
        $("panelElegir").style.display = "none";
        $("turno").textContent = textoTurno(sala, miId);
        actualizarChat(sala, miId);

        if (sala.fase === "verificar" && sala.adivinanza && sala.adivinanza.de !== miId && !verificando && secreto) {
          verificando = true;
          const acerto = sala.adivinanza.id === secreto.id;
          update(ref(db, `salas/${codigo}`), {
            estado: "terminada",
            fase: "fin",
            ganador: acerto ? sala.adivinanza.de : miId
          });
        }
      }

      if (sala.estado === "terminada") {
        $("estado").textContent = "Partida terminada";
        $("turno").textContent = "";
        $("panelElegir").style.display = "none";
        activarModoElegir(false);
        actualizarChat(sala, miId);

        if (!revelado && secreto) {
          revelado = true;
          set(ref(db, `salas/${codigo}/reveal/${miId}`), { nombre: secreto.nombre, imagen: secreto.imagen });
        }
        mostrarFin(sala, miId);
      }
    },
    (error) => mostrarError("Se perdió el acceso a la sala: " + error.message)
  );
}
