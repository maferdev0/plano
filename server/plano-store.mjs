// Almacén del Plano: todo vive como archivos JSON dentro de <proyecto>/plano/.
// No hay base de datos. El repo del proyecto es la fuente de verdad.

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, renameSync, rmSync, cpSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATA = process.env.PLANO_DATA ? resolve(process.env.PLANO_DATA) : join(RAIZ, "data");
const REGISTRO = join(DATA, "proyectos.json");

// Colecciones del Plano. `identidad` es un objeto único; el resto son listas de ítems con id y nivel.
export const COLECCIONES = ["identidad", "decisiones", "entidades", "pantallas", "acciones", "integraciones", "innegociables", "preguntas", "roadmap", "prototipo"];

// Orden de construcción derivado del grafo de entidades: nivel 0 no depende de nada; nivel n depende de algo de nivel n-1.
export function nivelesEntidades(entidades) {
  const ids = new Set(entidades.map((e) => e.id));
  const nivel = new Map();
  const deps = (e) => Object.values(e.campos || {}).map((t) => String(t).replace(/\?$/, "")).filter((t) => t.startsWith("id:")).map((t) => t.slice(3)).filter((d) => ids.has(d) && d !== e.id);
  const calc = (id, pila = new Set()) => {
    if (nivel.has(id)) return nivel.get(id);
    if (pila.has(id)) return 0;
    pila.add(id);
    const e = entidades.find((x) => x.id === id);
    const d = deps(e);
    const n = d.length ? Math.max(...d.map((x) => calc(x, pila))) + 1 : 0;
    nivel.set(id, n);
    return n;
  };
  for (const e of entidades) calc(e.id);
  return entidades.map((e) => ({ id: e.id, nivel: nivel.get(e.id), depende_de: deps(e) }));
}
export const NIVELES = ["duro", "blando", "supuesto", "propuesto"];

const leerJson = (ruta, porDefecto) => (existsSync(ruta) ? JSON.parse(readFileSync(ruta, "utf8")) : porDefecto);
const escribirJson = (ruta, valor) => writeFileSync(ruta, JSON.stringify(valor, null, 2) + "\n");

// Cada colección (salvo identidad) se guarda como { "<coleccion>": [ ...items ] },
// el mismo formato que leen el generador y el verificador (herramientas/plano.mjs).
const leerLista = (ruta, coleccion) => { const j = leerJson(ruta, null); return Array.isArray(j?.[coleccion]) ? j[coleccion] : []; };
const escribirLista = (ruta, coleccion, lista) => escribirJson(ruta, { [coleccion]: lista });

// ---------- registro de proyectos (data/proyectos.json, propio de Plano) ----------
export function listarProyectos() {
  return leerJson(REGISTRO, []);
}

// Tokens y dólares gastados en un proyecto, sumando todos sus turnos.
export function resumirUso(turnos) {
  const t = { entrada: 0, salida: 0, cacheEscritura: 0, cacheLectura: 0, usd: 0, turnos: 0 };
  for (const u of turnos || []) { t.entrada += u.entrada || 0; t.salida += u.salida || 0; t.cacheEscritura += u.cacheEscritura || 0; t.cacheLectura += u.cacheLectura || 0; t.usd += u.usd || 0; t.turnos++; }
  return t;
}

// Para la pantalla principal: cada proyecto con su última actividad, el más reciente primero.
export function listarProyectosConActividad() {
  return listarProyectos()
    .map((p) => {
      const e = leerJson(join(p.carpeta, "plano", ".entrevista.json"), null);
      const visibles = e?.visibles || [];
      const ultimo = visibles.at(-1);
      return {
        ...p,
        uso: resumirUso(e?.uso),
        mensajes: visibles.length,
        ultimaActividad: ultimo?.ts || Date.parse(p.creado) || 0,
        ultimoTexto: ultimo ? String(ultimo.texto).replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim().slice(0, 140) : "",
        ultimoRol: ultimo?.rol || null,
      };
    })
    .sort((a, b) => b.ultimaActividad - a.ultimaActividad);
}

// El tipo de aplicación es la primera decisión dura: de él salen el stack posible, los marcos del prototipo, cómo se verifica
// cada pantalla construida y qué significa publicar. Se elige al crear el proyecto y no se cambia después.
export const TIPOS_APP = ["web", "escritorio", "movil"];
export const dispositivosPorTipo = (tipo) => (tipo === "movil" ? "celular" : tipo === "escritorio" ? "escritorio" : "ambos");
export const tipoApp = (plano) => (TIPOS_APP.includes(plano?.identidad?.tipo_app) ? plano.identidad.tipo_app : "web");
// Para proyectos de antes de que existiera el campo: se deduce del texto de la identidad y queda escrito.
function inferirTipoApp(identidad) {
  const texto = `${identidad?.tipo || ""} ${identidad?.stack || ""} ${identidad?.que_es || ""}`.toLowerCase();
  if (/\b(m[oó]vil|android|ios|react native|flutter|expo|app store|play store)\b/.test(texto) && !/\bweb\b/.test(texto)) return "movil";
  if (/\b(escritorio|desktop|electron|tauri|windows|macos|linux)\b/.test(texto) && !/\bweb\b/.test(texto)) return "escritorio";
  return "web";
}

export function crearProyecto({ nombre, carpeta, tipo_app }) {
  if (!nombre?.trim()) throw new Error("Falta el nombre del proyecto");
  if (!carpeta?.trim()) throw new Error("Falta la carpeta del proyecto");
  if (!TIPOS_APP.includes(tipo_app)) throw new Error("Falta el tipo de aplicación: web, escritorio o móvil");
  const ruta = resolve(carpeta);
  mkdirSync(join(ruta, "plano"), { recursive: true });
  const proyectos = listarProyectos();
  const id = slug(nombre) + "-" + Date.now().toString(36).slice(-4);
  const proyecto = { id, nombre: nombre.trim(), carpeta: ruta, tipo_app, creado: new Date().toISOString() };
  proyectos.unshift(proyecto);
  mkdirSync(DATA, { recursive: true });
  escribirJson(REGISTRO, proyectos);
  // identidad mínima para que el Plano exista desde el primer segundo; el tipo ya es una decisión dura
  const identidad = join(ruta, "plano", "identidad.json");
  const actual = existsSync(identidad) ? leerJson(identidad, {}) : {};
  escribirJson(identidad, { nombre: proyecto.nombre, nivel: "blando", ...actual, tipo_app: actual.tipo_app && TIPOS_APP.includes(actual.tipo_app) ? actual.tipo_app : tipo_app, dispositivos: dispositivosPorTipo(actual.tipo_app && TIPOS_APP.includes(actual.tipo_app) ? actual.tipo_app : tipo_app) });
  return proyecto;
}

// ---------- deshacer un turno ----------
// Antes de cada turno se guarda una copia de plano/ y prototipo/ en plano/.deshacer/<id>/. Deshacer el último turno
// vuelve a esa copia: el Plano y las pantallas quedan como estaban, la conversación pierde ese mensaje y su respuesta,
// y queda una marca visible. El registro de uso no se toca: lo gastado, gastado está.
const carpetaDeshacer = (proyecto) => join(proyecto.carpeta, "plano", ".deshacer");
export function guardarInstantanea(proyecto) {
  const id = Date.now().toString(36);
  const destino = join(carpetaDeshacer(proyecto), id);
  mkdirSync(join(destino, "plano"), { recursive: true });
  const plano = join(proyecto.carpeta, "plano");
  for (const f of readdirSync(plano)) if (f.endsWith(".json")) cpSync(join(plano, f), join(destino, "plano", f));
  const proto = join(proyecto.carpeta, "prototipo");
  if (existsSync(proto)) cpSync(proto, join(destino, "prototipo"), { recursive: true });
  // se guardan las últimas 8
  const todas = readdirSync(carpetaDeshacer(proyecto)).sort();
  for (const vieja of todas.slice(0, -8)) rmSync(join(carpetaDeshacer(proyecto), vieja), { recursive: true, force: true });
  return id;
}
export function deshacerTurno(proyecto, id) {
  const origen = join(carpetaDeshacer(proyecto), String(id).replace(/[^a-z0-9]/gi, ""));
  if (!existsSync(join(origen, "plano"))) throw new Error("Ya no hay cómo deshacer ese mensaje: la copia no está.");
  const actual = leerEntrevista(proyecto);
  const plano = join(proyecto.carpeta, "plano");
  for (const f of readdirSync(plano)) if (f.endsWith(".json")) rmSync(join(plano, f), { force: true });
  for (const f of readdirSync(join(origen, "plano"))) cpSync(join(origen, "plano", f), join(plano, f));
  const proto = join(proyecto.carpeta, "prototipo");
  rmSync(proto, { recursive: true, force: true });
  if (existsSync(join(origen, "prototipo"))) cpSync(join(origen, "prototipo"), proto, { recursive: true });
  // la conversación vuelve atrás, pero el uso (lo que costó) se conserva
  const restaurada = leerEntrevista(proyecto);
  restaurada.uso = actual.uso || [];
  restaurada.visibles = [...(restaurada.visibles || []), { rol: "sistema", texto: "Deshiciste el último mensaje: el Plano y el prototipo volvieron a como estaban antes.", ts: Date.now() }];
  guardarEntrevista(proyecto, restaurada);
  rmSync(origen, { recursive: true, force: true });
  return restaurada;
}

export function renombrarProyecto(id, nombre) {
  if (!nombre?.trim()) throw new Error("Falta el nombre");
  const proyectos = listarProyectos();
  const p = proyectos.find((x) => x.id === id);
  if (!p) throw new Error(`No existe el proyecto ${id}`);
  p.nombre = nombre.trim();
  escribirJson(REGISTRO, proyectos);
  return p;
}

// Copia plano/ y prototipo/ a otra carpeta y registra el resultado como proyecto nuevo.
export function duplicarProyecto(id, { nombre, carpeta }) {
  const origen = obtenerProyecto(id);
  const destino = resolve(carpeta || "");
  if (!carpeta?.trim()) throw new Error("Falta la carpeta de destino");
  if (destino === origen.carpeta) throw new Error("La carpeta de destino es la misma que la del original");
  if (existsSync(join(destino, "plano"))) throw new Error("Esa carpeta ya tiene un Plano adentro");
  const nuevo = crearProyecto({ nombre: nombre || origen.nombre + " (copia)", carpeta: destino });
  for (const sub of ["plano", "prototipo"]) if (existsSync(join(origen.carpeta, sub))) cpSync(join(origen.carpeta, sub), join(destino, sub), { recursive: true });
  return nuevo;
}

// Todo el proyecto en un solo JSON: el Plano, la conversación y las pantallas del prototipo con su historial.
export function exportarProyecto(id) {
  const proyecto = obtenerProyecto(id);
  const plano = leerPlano(proyecto);
  const prototipo = {};
  for (const p of plano.prototipo || []) {
    const html = leerPantallaPrototipo(proyecto, p.id);
    if (html === null) continue;
    prototipo[p.id] = { html, historial: (p.historial || []).map((h) => ({ ...h, html: leerVersionPantalla(proyecto, p.id, h.n) })) };
  }
  return { formato: "plano/1", exportado: new Date().toISOString(), proyecto: { nombre: proyecto.nombre, creado: proyecto.creado }, plano, entrevista: leerEntrevista(proyecto), prototipo };
}

// Borra lo que Plano creó en la carpeta del proyecto (plano/ y prototipo/) y lo saca de la lista. El resto de la carpeta no se toca.
export function borrarProyecto(id) {
  const proyecto = obtenerProyecto(id);
  for (const sub of ["plano", "prototipo"]) rmSync(join(proyecto.carpeta, sub), { recursive: true, force: true });
  escribirJson(REGISTRO, listarProyectos().filter((p) => p.id !== id));
  return proyecto;
}

export function obtenerProyecto(id) {
  const p = listarProyectos().find((x) => x.id === id);
  if (!p) throw new Error(`No existe el proyecto ${id}`);
  return p;
}

// ---------- el Plano de un proyecto ----------
const rutaColeccion = (proyecto, coleccion) => join(proyecto.carpeta, "plano", `${coleccion}.json`);

export function leerPlano(proyecto) {
  // migración: la colección "ruta" pasó a llamarse "roadmap"
  const viejo = join(proyecto.carpeta, "plano", "ruta.json"), nuevo = join(proyecto.carpeta, "plano", "roadmap.json");
  if (existsSync(viejo) && !existsSync(nuevo)) { const j = leerJson(viejo, {}); escribirJson(nuevo, { roadmap: j.ruta || [] }); renameSync(viejo, viejo + ".migrado"); }
  const plano = {};
  for (const c of COLECCIONES) plano[c] = c === "identidad" ? leerJson(rutaColeccion(proyecto, c), {}) : leerLista(rutaColeccion(proyecto, c), c);
  // migración: proyectos de antes del tipo de aplicación
  if (plano.identidad && Object.keys(plano.identidad).length && !TIPOS_APP.includes(plano.identidad.tipo_app)) {
    plano.identidad.tipo_app = proyecto.tipo_app && TIPOS_APP.includes(proyecto.tipo_app) ? proyecto.tipo_app : inferirTipoApp(plano.identidad);
    if (plano.identidad.tipo_app !== "web") plano.identidad.dispositivos = dispositivosPorTipo(plano.identidad.tipo_app);
    escribirJson(rutaColeccion(proyecto, "identidad"), plano.identidad);
  }
  return plano;
}

export function registrarItem(proyecto, coleccion, item) {
  validarColeccion(coleccion);
  const ruta = rutaColeccion(proyecto, coleccion);
  if (coleccion === "identidad") {
    const actual = leerJson(ruta, {});
    const { id, titulo, ...campos } = item || {}; // la identidad no es un ítem con id: es la ficha del proyecto
    if (actual.tipo_app) delete campos.tipo_app; // el tipo de aplicación no se cambia una vez elegido
    else if (!TIPOS_APP.includes(campos.tipo_app)) delete campos.tipo_app;
    const nuevo = { ...actual, ...campos };
    // móvil se usa en el celular y escritorio en la computadora; solo web elige
    const tipo = nuevo.tipo_app;
    if (tipo === "movil" || tipo === "escritorio") nuevo.dispositivos = dispositivosPorTipo(tipo);
    escribirJson(ruta, nuevo);
    return nuevo;
  }
  if (!item?.id) item = { ...item, id: slug(item?.titulo || item?.nombre || "item") };
  if (!NIVELES.includes(item.nivel)) item.nivel = "blando";
  const lista = leerLista(ruta, coleccion);
  const i = lista.findIndex((x) => x.id === item.id);
  if (i >= 0) lista[i] = { ...lista[i], ...item };
  else lista.push(item);
  escribirLista(ruta, coleccion, lista);
  return item;
}

export function actualizarItem(proyecto, coleccion, id, cambios) {
  validarColeccion(coleccion);
  const ruta = rutaColeccion(proyecto, coleccion);
  if (coleccion === "identidad") return registrarItem(proyecto, coleccion, cambios);
  const lista = leerLista(ruta, coleccion);
  const i = lista.findIndex((x) => x.id === id);
  if (i < 0) throw new Error(`No existe ${coleccion}/${id}`);
  if (cambios.nivel && !NIVELES.includes(cambios.nivel)) delete cambios.nivel;
  lista[i] = { ...lista[i], ...cambios, id: lista[i].id };
  escribirLista(ruta, coleccion, lista);
  return lista[i];
}

export function quitarItem(proyecto, coleccion, id) {
  validarColeccion(coleccion);
  if (coleccion === "identidad") throw new Error("La identidad no se quita, se actualiza");
  const ruta = rutaColeccion(proyecto, coleccion);
  const lista = leerLista(ruta, coleccion);
  const restante = lista.filter((x) => x.id !== id);
  if (restante.length === lista.length) throw new Error(`No existe ${coleccion}/${id}`);
  escribirLista(ruta, coleccion, restante);
  return { id };
}

// ---------- la conversación de la entrevista (también en el repo) ----------
const rutaEntrevista = (proyecto) => join(proyecto.carpeta, "plano", ".entrevista.json");

export function leerEntrevista(proyecto) {
  return leerJson(rutaEntrevista(proyecto), { mensajes: [], visibles: [] });
}

export function guardarEntrevista(proyecto, entrevista) {
  escribirJson(rutaEntrevista(proyecto), entrevista);
}

// ---------- utilidades ----------
export function slug(texto) {
  return String(texto)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40) || "item";
}

function validarColeccion(c) {
  if (!COLECCIONES.includes(c)) throw new Error(`Colección desconocida: ${c}. Válidas: ${COLECCIONES.join(", ")}`);
}

export function carpetaExiste(carpeta) {
  try { readdirSync(resolve(carpeta)); return true; } catch { return false; }
}

// ---------- el prototipo: una pantalla HTML por cada pantalla del Plano, en <proyecto>/prototipo/ ----------
// El estado de cada pantalla (pendiente, generada, devuelta, aprobada) vive en plano/prototipo.json, como una colección más.
const carpetaPrototipo = (proyecto) => join(proyecto.carpeta, "prototipo");
const rutaPantalla = (proyecto, id) => join(carpetaPrototipo(proyecto), `${slug(id)}.html`);

// Cada elemento de una pantalla tiene un id derivado de su texto: es lo que el HTML tiene que llevar en data-plano.
export function idsElementos(pantalla) {
  const vistos = new Map();
  return (pantalla.elementos || []).map((texto) => {
    let base = slug(texto).slice(0, 40).replace(/-+$/, "") || "elemento";
    const n = (vistos.get(base) || 0) + 1;
    vistos.set(base, n);
    return { texto, id: n > 1 ? `${base}-${n}` : base };
  });
}

// Verificación mecánica de una pantalla generada: HTML completo, en español, sin scripts externos, y con TODOS los elementos del Plano marcados.
export function verificarPantallaHtml(pantalla, html) {
  const errores = [];
  if (!/<!doctype html>/i.test(html)) errores.push("falta <!doctype html>");
  if (!/<html[^>]*\blang=["'][a-z]{2}/i.test(html)) errores.push('falta el atributo lang en <html> (es, en…)');
  const externos = [...html.matchAll(/<(script|link)[^>]+(src|href)=["']https?:\/\/([^"'/]+)/gi)].map((m) => m[3]).filter((h) => !/^(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(h));
  if (externos.length) errores.push(`no se permiten recursos externos salvo Google Fonts: ${[...new Set(externos)].join(", ")}`);
  if (!new RegExp(`data-plano=["']${pantalla.id}["']`).test(html)) errores.push(`falta data-plano="${pantalla.id}" en el contenedor principal de la pantalla`);
  for (const { id, texto } of idsElementos(pantalla)) {
    if (!new RegExp(`data-plano=["']${pantalla.id}/${id}["']`).test(html)) errores.push(`falta data-plano="${pantalla.id}/${id}" (el elemento "${texto}")`);
  }
  // Estados: si la pantalla se ve distinta según la situación (con créditos, sin créditos…), los estados están en el Plano y el
  // selector lo pone Plano afuera de la pantalla. Adentro no va ningún selector: el estado llega por ?estado=<id>.
  const estados = idsEstados(pantalla);
  const declarados = estadosDeclarados(html);
  if (tieneSelectorAdentro(html)) errores.push(estados.length
    ? "la pantalla tiene un selector de estados adentro (data-demo / «Prototipo:»); sacalo: el estado llega por ?estado= y el selector lo pone Plano afuera"
    : "la pantalla tiene un selector de estados adentro (data-demo / «Prototipo:»). Los estados se registran en el Plano (campo estados de la pantalla) y Plano pone el selector afuera; adentro solo se lee ?estado=");
  if (estados.length) {
    if (!declarados) errores.push(`falta data-plano-estados="${estados.join(",")}" en el contenedor principal`);
    else if (JSON.stringify([...declarados].sort()) !== JSON.stringify([...estados].sort())) errores.push(`data-plano-estados declara "${declarados.join(",")}" y el Plano dice "${estados.join(",")}"; tienen que coincidir`);
    if (!/location\.search|URLSearchParams/.test(html)) errores.push("la pantalla declara estados pero no lee ?estado= de la URL (location.search / URLSearchParams)");
  } else if (declarados) errores.push(`el HTML declara estados (${declarados.join(",")}) que la pantalla no tiene en el Plano; registralos primero con actualizar_item (campo estados)`);
  return errores;
}
export const idsEstados = (pantalla) => (Array.isArray(pantalla?.estados) ? pantalla.estados : []).map((e) => (typeof e === "string" ? slug(e) : slug(e?.id || e?.titulo || ""))).filter(Boolean);
export const estadosDeclarados = (html) => { const m = String(html || "").match(/data-plano-estados=["']([^"']*)["']/); return m ? m[1].split(",").map((x) => x.trim()).filter(Boolean) : null; };
export const tieneSelectorAdentro = (html) => /data-demo=|Prototipo:/.test(String(html || ""));

// Cada guardado queda en el historial (prototipo/.historial/<pantalla>/<n>.html) con su motivo; la actual es la última.
const carpetaHistorial = (proyecto, id) => join(carpetaPrototipo(proyecto), ".historial", slug(id));
export function escribirPantallaPrototipo(proyecto, pantalla, html, motivo = "Generación") {
  const errores = verificarPantallaHtml(pantalla, html);
  if (errores.length) return { ok: false, errores };
  mkdirSync(carpetaPrototipo(proyecto), { recursive: true });
  writeFileSync(rutaPantalla(proyecto, pantalla.id), html);
  const plano = leerPlano(proyecto);
  const item = (plano.prototipo || []).find((p) => p.id === pantalla.id) || {};
  const historial = [...(item.historial || [])];
  const n = (historial.at(-1)?.n || 0) + 1;
  mkdirSync(carpetaHistorial(proyecto, pantalla.id), { recursive: true });
  writeFileSync(join(carpetaHistorial(proyecto, pantalla.id), `${n}.html`), html);
  historial.push({ n, ts: new Date().toISOString(), motivo });
  return { ok: true, archivo: `prototipo/${slug(pantalla.id)}.html`, historial };
}

export function leerVersionPantalla(proyecto, id, n) {
  const ruta = join(carpetaHistorial(proyecto, id), `${Number(n)}.html`);
  return existsSync(ruta) ? readFileSync(ruta, "utf8") : null;
}

// Vuelve a una versión anterior y borra las posteriores. La pantalla queda "para revisar" otra vez.
export function restaurarVersionPantalla(proyecto, id, n) {
  n = Number(n);
  const html = leerVersionPantalla(proyecto, id, n);
  if (html === null) throw new Error(`No existe la versión ${n} de ${id}`);
  const plano = leerPlano(proyecto);
  const item = (plano.prototipo || []).find((p) => p.id === id);
  if (!item) throw new Error(`La pantalla ${id} no está en el prototipo`);
  for (const h of item.historial || []) if (h.n > n) rmSync(join(carpetaHistorial(proyecto, id), `${h.n}.html`), { force: true });
  writeFileSync(rutaPantalla(proyecto, id), html);
  actualizarItem(proyecto, "prototipo", id, { historial: (item.historial || []).filter((h) => h.n <= n), estado: "generada", comentario: undefined, generada_en: new Date().toISOString() });
  return leerPlano(proyecto);
}

export function leerPantallaPrototipo(proyecto, id) {
  const ruta = rutaPantalla(proyecto, id);
  return existsSync(ruta) ? readFileSync(ruta, "utf8") : null;
}

// Arranca el prototipo de una versión: deja cada pantalla como pendiente (sin pisar las que ya tienen estado).
export function iniciarPrototipo(proyecto, version) {
  const plano = leerPlano(proyecto);
  const v = (plano.roadmap || []).find((x) => x.id === version);
  if (!v) throw new Error(`No existe la versión ${version}`);
  const actuales = new Map((plano.prototipo || []).map((p) => [p.id, p]));
  for (const id of v.pantallas || []) {
    if (!actuales.has(id)) registrarItem(proyecto, "prototipo", { id, version: v.id, estado: "pendiente", nivel: "blando" });
  }
  return leerPlano(proyecto);
}

// Aprobar congela la pantalla en el Plano: existencia y elementos pasan a duros.
export function aprobarPantalla(proyecto, id) {
  actualizarItem(proyecto, "prototipo", id, { estado: "aprobada", aprobada_en: new Date().toISOString(), comentario: undefined });
  const pantalla = leerPlano(proyecto).pantallas.find((p) => p.id === id);
  if (pantalla) actualizarItem(proyecto, "pantallas", id, { nivel: "duro", elementos_congelados: idsElementos(pantalla).map((e) => e.id) });
  return leerPlano(proyecto);
}

export function devolverPantalla(proyecto, id, comentario) {
  actualizarItem(proyecto, "prototipo", id, { estado: "devuelta", comentario: comentario || "" });
  return leerPlano(proyecto);
}

// En qué se usa una pantalla: lo suyo si lo tiene; si no, lo que dice la identidad del proyecto; si no, ambos.
export function dispositivosDe(pantalla, identidad) {
  if (identidad?.tipo_app === "movil") return ["celular"];
  if (identidad?.tipo_app === "escritorio") return ["escritorio"];
  if (Array.isArray(pantalla?.dispositivos) && pantalla.dispositivos.length) return pantalla.dispositivos;
  const d = identidad?.dispositivos;
  return d === "celular" ? ["celular"] : d === "escritorio" ? ["escritorio"] : ["celular", "escritorio"];
}
