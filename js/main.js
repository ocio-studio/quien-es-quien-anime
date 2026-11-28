import { $, leerSesion, mostrarError } from "./utils.js";
import { obtenerUid } from "./firebase.js";
import { crearSala, unirseASala, reconectar } from "./salas.js";

$("crear").disabled = true;
$("unirse").disabled = true;

try {
  await obtenerUid();
} catch (e) {
  mostrarError("No se pudo iniciar sesión: " + e.message);
  throw e;
}

$("crear").disabled = false;
$("unirse").disabled = false;
$("crear").addEventListener("click", crearSala);
$("unirse").addEventListener("click", unirseASala);

const sesion = leerSesion();
if (sesion) reconectar(sesion.codigo, sesion.miId);

$("serie").addEventListener("focus", () => {
  document.querySelector('input[name="modo"][value="serie"]').checked = true;
});
