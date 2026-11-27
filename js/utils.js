export const $ = (id) => document.getElementById(id);

export const mostrarError = (texto) => {
  $("mensaje").textContent = texto;
};

export function mezclar(arr) {
  return arr.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}

// Letras sin I, O, 0, 1 para evitar confusiones
export function generarCodigo() {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 4; i++) c += letras[Math.floor(Math.random() * letras.length)];
  return c;
}

const CLAVE_SESION = "qeq_sesion";

export function guardarSesion(codigo, miId) {
  sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ codigo, miId }));
}

export function leerSesion() {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_SESION));
  } catch {
    return null;
  }
}

export function borrarSesion() {
  sessionStorage.removeItem(CLAVE_SESION);
}
