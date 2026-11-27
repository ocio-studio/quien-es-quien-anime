import { mezclar } from "./utils.js";

async function consultar(query, variables) {
  const r = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables })
  });
  const json = await r.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

const aPersonaje = (c) => ({ id: c.id, nombre: c.name.full, imagen: c.image.large });

export async function personajesGeneral() {
  const pagina = Math.floor(Math.random() * 10) + 1;
  const data = await consultar(
    `query($page:Int){ Page(page:$page, perPage:50){ characters(sort:FAVOURITES_DESC){ id name{full} image{large} } } }`,
    { page: pagina }
  );
  return mezclar(data.Page.characters.filter((c) => !c.image.large.includes("default")))
    .slice(0, 24)
    .map(aPersonaje);
}

export async function personajesSerie(nombreSerie) {
  let data;
  try {
    data = await consultar(
      `query($search:String){ Media(search:$search, type:ANIME, isAdult:false){
          title{ romaji }
          characters(sort:FAVOURITES_DESC, perPage:50){
            edges{ role node{ id name{full} image{large} } }
          }
      } }`,
      { search: nombreSerie }
    );
  } catch (e) {
    throw new Error("No encontré esa serie. Prueba con otro nombre.");
  }
  const candidatos = data.Media.characters.edges
    .filter((e) => e.role !== "BACKGROUND")
    .map((e) => e.node)
    .filter((c) => !c.image.large.includes("default"))
    .slice(0, 40);
  const lista = mezclar(candidatos).slice(0, 24).map(aPersonaje);
  if (lista.length < 12) throw new Error("Esa serie tiene muy pocos personajes (mínimo 12).");
  return { titulo: data.Media.title.romaji, lista };
}
