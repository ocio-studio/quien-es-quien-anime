import { buscarSeries } from "./anilist.js";

export function activarAutocompletar(input, lista) {
  let idElegido = null;
  let temporizador = null;
  let contador = 0;
  let items = [];
  let activo = -1;

  function cerrar() {
    lista.style.display = "none";
    lista.innerHTML = "";
    items = [];
    activo = -1;
  }

  function elegir(s) {
    input.value = s.titulo;
    idElegido = s.id;
    cerrar();
  }

  function pintar() {
    lista.innerHTML = "";
    items.forEach((s, i) => {
      const div = document.createElement("div");
      div.textContent = s.titulo;
      if (s.extra) {
        const small = document.createElement("small");
        small.textContent = "  " + s.extra;
        div.appendChild(small);
      }
      if (i === activo) div.className = "activa";

      div.addEventListener("mousedown", (e) => {
        e.preventDefault();
        elegir(s);
      });
      lista.appendChild(div);
    });
    lista.style.display = items.length ? "block" : "none";
  }

  input.addEventListener("input", () => {
    idElegido = null;
    clearTimeout(temporizador);
    const mio = ++contador;
    const texto = input.value.trim();
    if (texto.length < 2) return cerrar();

    temporizador = setTimeout(async () => {
      try {
        const resultados = await buscarSeries(texto);
        if (mio !== contador) return;
        items = resultados;
        activo = -1;
        pintar();
      } catch (e) {
        if (mio === contador) cerrar();
      }
    }, 350);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      activo = (activo + 1) % items.length;
      pintar();
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      activo = (activo - 1 + items.length) % items.length;
      pintar();
    } else if (e.key === "Enter" && activo >= 0) {
      e.preventDefault();
      elegir(items[activo]);
    } else if (e.key === "Escape") {
      cerrar();
    }
  });

  input.addEventListener("blur", () => setTimeout(cerrar, 150));

  return {
    obtenerId: () => idElegido,
    limpiar: () => {
      idElegido = null;
      input.value = "";
      cerrar();
    }
  };
}