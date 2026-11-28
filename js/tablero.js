import { $ } from "./utils.js";

let dibujado = false;
let modoElegir = false;
let seleccionado = null;
let claveGuardado = null;
let total = 0;
const descartados = new Set();

export function configurarGuardado(clave) {
  claveGuardado = clave;
}

function leerGuardados() {
  try {
    return JSON.parse(sessionStorage.getItem(claveGuardado)) || [];
  } catch {
    return [];
  }
}

function guardar() {
  if (claveGuardado) sessionStorage.setItem(claveGuardado, JSON.stringify([...descartados]));
}

function actualizarContador() {
  $("contador").textContent = `Descartados: ${descartados.size} de ${total}`;
}

export function activarModoElegir(activo) {
  modoElegir = activo;
  if (!activo) {
    seleccionado = null;
    document.querySelectorAll(".carta.seleccionada").forEach((c) => c.classList.remove("seleccionada"));
  }
}

export function obtenerSeleccionado() {
  return seleccionado;
}

export function reiniciarTablero() {
  descartados.clear();
  if (claveGuardado) sessionStorage.removeItem(claveGuardado);
  seleccionado = null;
  dibujado = false;
}

export function mostrarTablero(personajes) {
  if (dibujado) return;

  total = personajes.length;
  const grid = $("grid");
  grid.innerHTML = "";
  descartados.clear();
  const previos = new Set(leerGuardados());

  personajes.forEach((p) => {
    const carta = document.createElement("div");
    carta.className = "carta";
    carta.innerHTML = `
      <div class="carta-inner">
        <div class="cara frente">
          <img src="${p.imagen}" alt="">
          <div class="nombre"></div>
        </div>
        <div class="cara dorso">✕</div>
      </div>`;
    carta.querySelector(".nombre").textContent = p.nombre;

    if (previos.has(p.id)) {
      carta.classList.add("volteada");
      descartados.add(p.id);
    }

    carta.addEventListener("click", () => {
      if (modoElegir) {
        document.querySelectorAll(".carta.seleccionada").forEach((c) => c.classList.remove("seleccionada"));
        carta.classList.add("seleccionada");
        seleccionado = p;
        return;
      }

      carta.classList.toggle("volteada");
      if (carta.classList.contains("volteada")) descartados.add(p.id);
      else descartados.delete(p.id);
      guardar();
      actualizarContador();
    });

    grid.appendChild(carta);
  });

  actualizarContador();
  dibujado = true;
}
