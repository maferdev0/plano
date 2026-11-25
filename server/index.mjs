import "dotenv/config";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { revisarVersion, bloqueRevision } from "./revision.mjs";
import { configPublica, guardarConfig, claveApi, VERSION } from "./config.mjs";
import { prepararConstruccion, leerConstruccion, resumenConstruccion, versionConstruible, aprobarTarea, devolverTarea, verificarTarea, verificarPendientes, guardarConstruccion, escribirContrato, actividadDe, vigilarConstruccion } from "./construccion.mjs";
import { fileURLToPath } from "node:url";
import { resolve, sep } from "node:path";
import {
  listarProyectos, listarProyectosConActividad, crearProyecto, obtenerProyecto, borrarProyecto, renombrarProyecto, duplicarProyecto, exportarProyecto, guardarInstantanea, deshacerTurno, leerPlano, actualizarItem,
  iniciarPrototipo, aprobarPantalla, devolverPantalla, leerPantallaPrototipo, leerVersionPantalla, restaurarVersionPantalla, slug,
  leerEntrevista, guardarEntrevista, carpetaExiste,
} from "./plano-store.mjs";
import { responder, repararHistorial, bloquePrototipo, compactarHistorial, tokensDelHistorial, podarHistorial, tipoDeTurno, UMBRAL_COMPACTAR, MODELO, PRECIOS, costoUsd } from "./entrevista.mjs";
import { dialogoCarpeta, listarCarpetas } from "./carpetas.mjs";

process.chdir(resolve(fileURLToPath(new URL("..", import.meta.url))));

const PUERTO = Number(process.env.PLANO_PUERTO || 4747);
const app = new Hono();

// Configuración: clave, nombre, modelos, umbral. Se guarda en data/config.json; la clave nunca vuelve entera a la interfaz.
app.get("/api/config", (c) => c.json(configPublica()));
app.put("/api/config", async (c) => {
  try { return c.json(guardarConfig(await c.req.json())); }
  catch (e) { return c.json({ error: e.message }, 400); }
});

// Turnos en curso por proyecto: para detenerlos desde la interfaz y para mostrar "trabajando" en la lista.
const turnosActivos = new Map();
app.get("/api/proyectos", (c) => c.json(listarProyectosConActividad().map((p) => ({ ...p, trabajando: turnosActivos.has(p.id) }))));

// Abre el diálogo nativo de carpetas en la máquina donde corre el servidor.
app.post("/api/elegir-carpeta", async (c) => {
  try { return c.json(await dialogoCarpeta()); }
  catch (e) { return c.json({ error: e.message, sinDialogo: true }, 501); }
});

// Explorador de respaldo.
app.get("/api/carpetas", async (c) => {
  try { return c.json(await listarCarpetas(c.req.query("ruta") || "")); }
  catch (e) { return c.json({ error: e.message }, 400); }
});

app.post("/api/proyectos", async (c) => {
  const body = await c.req.json();
  try {
    if (!carpetaExiste(body.carpeta)) return c.json({ error: `La carpeta no existe: ${body.carpeta}. Creala primero (o elegí una que exista).` }, 400);
    return c.json(crearProyecto(body));
  } catch (e) {
    return c.json({ error: e.message }, 400);
  }
});

app.get("/api/proyectos/:id", (c) => {
  try {
    const proyecto = obtenerProyecto(c.req.param("id"));
    const entrevista = leerEntrevista(proyecto);
    const PAGINA = 50;
    const plano = leerPlano(proyecto); const tablero = leerConstruccion(proyecto);
    return c.json({ proyecto, plano, construccion: tablero ? { version: tablero.version, resumen: resumenConstruccion(tablero) } : null, construible: versionConstruible(plano)?.id || null, visibles: entrevista.visibles.slice(-PAGINA), totalVisibles: entrevista.visibles.length, roadmapUso: entrevista.roadmapUso || null, trabajando: turnosActivos.has(proyecto.id) });
  } catch (e) {
    return c.json({ error: e.message }, 404);
  }
});

// Mensajes anteriores de la conversación, de a 50, para el scroll hacia arriba: ?antes=<índice> devuelve los 100 previos a ese índice.
app.get("/api/proyectos/:id/visibles", (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  const todos = leerEntrevista(proyecto).visibles;
  const antes = Math.min(Math.max(0, Number(c.req.query("antes")) || 0), todos.length);
  const desde = Math.max(0, antes - 50);
  return c.json({ visibles: todos.slice(desde, antes), desde, total: todos.length });
});

// Revisión mecánica de cada versión del roadmap: lo que falta resolver antes de prototiparla o construirla.
// ---------- construcción ----------
// El tablero vive en plano/construccion.json; lo escribe el agente de código (estado, archivos, notas) y Plano (verificación, aprobación).
app.get("/api/proyectos/:id/construccion", (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  const tablero = leerConstruccion(proyecto);
  // lo que el agente marcó como hecho se verifica solo, en segundo plano; la próxima consulta ya lo trae
  if (tablero) { vigilarConstruccion(proyecto, verificarAlCambiar); verificarPendientes(proyecto).catch((e) => console.warn("[plano] verificación:", e.message)); }
  return c.json({ tablero, resumen: resumenConstruccion(tablero), construible: versionConstruible(leerPlano(proyecto))?.id || null, verificando: tablero?.tareas.some((t) => t.estado === "verificando") || false, actividad: actividadDe(proyecto.id) });
});
// verificar ahora, a pedido de la persona (lo mismo que hace Plano solo, pero sin esperar)
app.post("/api/proyectos/:id/construccion/verificar", async (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  verificarPendientes(proyecto, { forzar: true }).catch((e) => console.warn("[plano] verificación:", e.message));
  await new Promise((r) => setTimeout(r, 300));
  const tablero = leerConstruccion(proyecto);
  return c.json({ tablero, resumen: resumenConstruccion(tablero), actividad: actividadDe(proyecto.id) });
});
app.post("/api/proyectos/:id/construccion", async (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  try { const { version, forzar } = await c.req.json(); const tablero = prepararConstruccion(proyecto, version, { forzar: Boolean(forzar) }); vigilarConstruccion(proyecto, verificarAlCambiar); return c.json({ tablero, resumen: resumenConstruccion(tablero) }); }
  catch (e) { return c.json({ error: e.message }, 400); }
});
app.patch("/api/proyectos/:id/construccion", async (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  const tablero = leerConstruccion(proyecto);
  if (!tablero) return c.json({ error: "No hay construcción preparada" }, 400);
  const { url_dev, url_prod, carpeta_app, git } = await c.req.json();
  if (typeof url_dev === "string" && url_dev.trim()) tablero.url_dev = url_dev.trim().replace(/\/$/, "");
  if (typeof url_prod === "string") tablero.url_prod = url_prod.trim().replace(/\/$/, "");
  if (typeof git === "boolean") tablero.git = git;
  if (typeof carpeta_app === "string" && carpeta_app.trim()) { tablero.carpeta_app = carpeta_app.trim().replace(/^[\\/]+|[\\/]+$/g, "") || "."; escribirContrato(proyecto, leerPlano(proyecto), tablero); }
  guardarConstruccion(proyecto, tablero);
  return c.json({ tablero, resumen: resumenConstruccion(tablero) });
});
app.post("/api/proyectos/:id/construccion/:tarea/:accion", async (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  const tarea = c.req.param("tarea"), accion = c.req.param("accion");
  try {
    let t;
    if (accion === "aprobar") t = await aprobarTarea(proyecto, tarea, "persona");
    else if (accion === "devolver") { const { comentario } = await c.req.json().catch(() => ({})); t = devolverTarea(proyecto, tarea, comentario, "persona"); }
    else if (accion === "verificar") t = await verificarTarea(proyecto, tarea);
    else return c.json({ error: `acción desconocida: ${accion}` }, 400);
    return c.json({ tarea: t, tablero: leerConstruccion(proyecto) });
  } catch (e) { return c.json({ error: e.message }, 400); }
});

app.get("/api/proyectos/:id/revision", (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  const plano = leerPlano(proyecto);
  const out = {};
  for (const v of plano.roadmap || []) out[v.id] = revisarVersion(plano, v.id, (id) => leerPantallaPrototipo(proyecto, id)).hallazgos;
  return c.json(out);
});

// Para la pantalla de uso: todos los turnos de todos los proyectos, con el modelo y sus precios.
app.get("/api/uso", (c) => {
  const proyectos = listarProyectos().map((p) => ({ id: p.id, nombre: p.nombre, turnos: (leerEntrevista(p).uso || []).map((u) => ({ ...u, usd: u.usd ?? costoUsd(u, u.modelo) })), compactaciones: leerEntrevista(p).compactaciones || [] }));
  return c.json({ modelo: MODELO(), precios: PRECIOS[MODELO()] || null, umbral: UMBRAL_COMPACTAR(), proyectos });
});

// Un mensaje de la persona → respuesta en streaming (texto) + tarjetas a medida que el Plano cambia.
app.post("/api/proyectos/:id/mensaje", async (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  const { texto, menciones, derivarRoadmap, prototipo, respuestaA, revisarVersion: versionARevisar, accion, idioma } = await c.req.json();
  if (!texto?.trim()) return c.json({ error: "Mensaje vacío" }, 400);
  const turno = guardarInstantanea(proyecto); // para poder deshacer este turno entero

  // Lo que ve la persona es su texto tal cual; lo que ve el agente trae además las referencias exactas de las tarjetas nombradas con @.
  let paraAgente = texto;
  if (derivarRoadmap) paraAgente += "\n\n[La persona pidió armar el roadmap desde la interfaz. Armalo ahora siguiendo las reglas del roadmap.]";
  if (versionARevisar) paraAgente += "\n\n" + bloqueRevision(leerPlano(proyecto), String(versionARevisar), (id) => leerPantallaPrototipo(proyecto, id));
  // { pantalla, modo: "generar" | "revisar", comentario } → el agente recibe todo el contexto de esa pantalla, sacado del Plano
  if (prototipo?.pantalla) {
    try { paraAgente += "\n\n" + bloquePrototipo(proyecto, prototipo.pantalla, prototipo.modo, prototipo.comentario); }
    catch (e) { return c.json({ error: e.message }, 400); }
  }
  if (respuestaA) paraAgente += `\n\n[La persona respondió la pregunta preguntas/${String(respuestaA).replace(/[^\w-]/g, "")} desde su tarjeta. Registrá lo que decidió en la colección que corresponda (con su nivel) y quitá la pregunta con quitar_item. Si la respuesta no alcanza para cerrarla, preguntá lo que falte.]`;
  if (Array.isArray(menciones) && menciones.length) {
    paraAgente += "\n\n[Tarjetas mencionadas con @: " + menciones.map((m) => `${m.coleccion}/${m.id} ("${m.titulo}")`).join("; ") + "]";
  }
  const entrevista = leerEntrevista(proyecto);
  entrevista.mensajes.push({ role: "user", content: paraAgente });
  entrevista.visibles.push({ rol: "usuario", texto, ts: Date.now(), turno, ...(accion || derivarRoadmap || prototipo?.pantalla || versionARevisar ? { accion: true } : {}) });
  return correrTurno(c, proyecto, entrevista, idioma === "en" ? "en" : "es");
});

// La persona mueve un ítem de una versión a otra (o edita un ítem) desde la interfaz, sin pasar por la IA.
app.patch("/api/proyectos/:id", async (c) => {
  try { const { nombre } = await c.req.json(); return c.json({ ok: true, proyecto: renombrarProyecto(c.req.param("id"), nombre) }); }
  catch (e) { return c.json({ error: e.message }, 400); }
});
app.post("/api/proyectos/:id/duplicar", async (c) => {
  try { return c.json({ ok: true, proyecto: duplicarProyecto(c.req.param("id"), await c.req.json()) }); }
  catch (e) { return c.json({ error: e.message }, 400); }
});
app.get("/api/proyectos/:id/exportar", (c) => {
  try {
    const paquete = exportarProyecto(c.req.param("id"));
    c.header("content-disposition", `attachment; filename="${slug(paquete.proyecto.nombre)}.plano.json"`);
    return c.json(paquete);
  } catch (e) { return c.json({ error: e.message }, 404); }
});

// Deshacer el último turno: solo el último, y solo si fue el que hizo la copia.
app.post("/api/proyectos/:id/deshacer", async (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  const { turno } = await c.req.json().catch(() => ({}));
  const entrevista = leerEntrevista(proyecto);
  const ultimo = entrevista.visibles.findLast?.((x) => x.rol === "usuario");
  if (!ultimo || !turno || ultimo.turno !== turno) return c.json({ error: "Solo se puede deshacer el último mensaje." }, 400);
  try {
    const restaurada = deshacerTurno(proyecto, turno);
    return c.json({ ok: true, plano: leerPlano(proyecto), visibles: restaurada.visibles, roadmapUso: restaurada.roadmapUso || null });
  } catch (e) { return c.json({ error: e.message }, 400); }
});

// Borrar un proyecto: exige el nombre exacto en el cuerpo, como segunda confirmación además de la del cliente.
app.delete("/api/proyectos/:id", async (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  const { nombre } = await c.req.json().catch(() => ({}));
  if (nombre !== proyecto.nombre) return c.json({ error: "El nombre no coincide." }, 400);
  borrarProyecto(proyecto.id);
  return c.json({ ok: true });
});

app.patch("/api/proyectos/:id/:coleccion/:item", async (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  try {
    const cambios = await c.req.json();
    const item = actualizarItem(proyecto, c.req.param("coleccion"), c.req.param("item"), cambios);
    return c.json({ ok: true, item, plano: leerPlano(proyecto) });
  } catch (e) {
    return c.json({ error: e.message }, 400);
  }
});

// ---- el prototipo ----
app.post("/api/proyectos/:id/prototipo/iniciar", async (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  try { const { version } = await c.req.json(); return c.json({ plano: iniciarPrototipo(proyecto, version) }); }
  catch (e) { return c.json({ error: e.message }, 400); }
});
app.post("/api/proyectos/:id/prototipo/:pantalla/aprobar", (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  try { return c.json({ plano: aprobarPantalla(proyecto, c.req.param("pantalla")) }); } catch (e) { return c.json({ error: e.message }, 400); }
});
app.post("/api/proyectos/:id/prototipo/:pantalla/devolver", async (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  try { const { comentario } = await c.req.json(); return c.json({ plano: devolverPantalla(proyecto, c.req.param("pantalla"), comentario) }); } catch (e) { return c.json({ error: e.message }, 400); }
});
// Las pantallas del prototipo viven en /prototipo/<proyecto>/<pantalla>.html: son páginas, no API. Las rutas viejas bajo /api siguen.
const servirVersion = (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  let html = leerVersionPantalla(proyecto, c.req.param("pantalla"), c.req.param("n"));
  if (html === null) return c.text("No existe esa versión.", 404);
  html = html.replace(/<\/head>/i, ESTILO_CELULAR + "</head>");
  return c.html(html);
};
// Dentro del marco de celular: sin barras de scroll de escritorio, y sin backdrop-filter, porque Chrome pinta esas capas
// por encima de todo y salteándose el recorte redondeado del marco (las esquinas quedan cuadradas).
const ESTILO_CELULAR = "<style>*{scrollbar-width:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}*::-webkit-scrollbar{display:none!important}</style>";
app.post("/api/proyectos/:id/prototipo/:pantalla/restaurar", async (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  try { const { n } = await c.req.json(); return c.json({ plano: restaurarVersionPantalla(proyecto, c.req.param("pantalla"), n) }); } catch (e) { return c.json({ error: e.message }, 400); }
});
// Sirve las pantallas del prototipo; los enlaces relativos entre pantallas funcionan porque viven en la misma ruta.
app.get("/prototipo/:id/historial/:pantalla/:n", servirVersion);
app.get("/api/proyectos/:id/prototipo/:pantalla/historial/:n", servirVersion);

const servirPantalla = (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  const id = slug(c.req.param("archivo").replace(/\.html$/, ""));
  const plano = leerPlano(proyecto);
  const pantalla = (plano.pantallas || []).find((p) => p.id === id);
  let html = leerPantallaPrototipo(proyecto, id);
  // una pantalla del Plano que todavía no tiene prototipo: una página que lo dice, para que navegar hasta ella no rompa
  if (html === null) return c.html(paginaPendiente(pantalla, id), pantalla ? 200 : 404);
  // ninguna pantalla del prototipo muestra barras de scroll (simula un celular, y en escritorio queda como en macOS: el scroll
  // sigue andando); tampoco backdrop-filter, que rompe las esquinas del marco
  html = html.replace(/<\/head>/i, ESTILO_CELULAR + "</head>");
  return c.html(html);
};
// Recursos de marca (logos, íconos, fuentes) desde la carpeta del proyecto, para que los prototipos usen los de verdad.
const MIME_RECURSOS = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf" };
app.get("/prototipo/:id/recursos/*", async (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.text(e.message, 404); }
  const rel = decodeURIComponent(c.req.path.split("/recursos/")[1] || "");
  const base = resolve(proyecto.carpeta), destino = resolve(base, rel);
  if (!destino.startsWith(base + sep) || !existsSync(destino) || statSync(destino).isDirectory()) return c.text("No está", 404);
  const ext = destino.split(".").pop().toLowerCase();
  if (!MIME_RECURSOS[ext]) return c.text("Solo imágenes y fuentes", 403);
  c.header("content-type", MIME_RECURSOS[ext]);
  c.header("cache-control", "public, max-age=3600");
  return c.body(await readFile(destino));
});
app.get("/prototipo/:id/:archivo", servirPantalla);
app.get("/api/proyectos/:id/prototipo/:archivo", servirPantalla);

function paginaPendiente(pantalla, id) {
  const e = (t) => String(t ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const elementos = (pantalla?.elementos || []).map((x) => `<li>${e(x)}</li>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(pantalla?.titulo || id)}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:15px/1.5 system-ui,sans-serif;color:#3f3f46;background:#fafafa}main{max-width:36ch;padding:32px;text-align:center}h1{font-size:18px;margin:0 0 8px;color:#18181b}p{margin:0 0 16px}ul{text-align:left;margin:0 0 20px;padding-left:20px;color:#52525b}a{color:#18181b}</style></head>
<body data-plano="${e(id)}"><main><h1>${e(pantalla?.titulo || id)}</h1><p>${pantalla ? "Esta pantalla está en el Plano pero todavía no se generó." : "Esta pantalla no está en el Plano."}</p>${elementos ? `<ul>${elementos}</ul>` : ""}<a href="javascript:history.back()">Volver</a></main></body></html>`;
}

// La app navegable: una página aparte, sin Plano alrededor, con las pantallas del prototipo enlazadas entre sí.
app.get("/navegar/:id", async (c) => {
  try { obtenerProyecto(c.req.param("id")); } catch (e) { return c.text(e.message, 404); }
  const html = await readFile(new URL("../client/navegar.html", import.meta.url), "utf8");
  return c.html(html);
});

// Reintenta el último turno: vuelve a mandar el último mensaje de la persona y descarta lo que la IA haya respondido.
// Sirve tanto para "reenviar" (cuando falló) como para "reintentar" (cuando respondió mal o vacío).
app.post("/api/proyectos/:id/reintentar", async (c) => {
  let proyecto;
  try { proyecto = obtenerProyecto(c.req.param("id")); } catch (e) { return c.json({ error: e.message }, 404); }
  const entrevista = leerEntrevista(proyecto);
  const esHumano = (m) => m.role === "user" && typeof m.content === "string";
  let i = entrevista.mensajes.length - 1;
  while (i >= 0 && !esHumano(entrevista.mensajes[i])) i--;
  let v = entrevista.visibles.length - 1;
  while (v >= 0 && entrevista.visibles[v].rol !== "usuario") v--;
  if (v < 0) return c.json({ error: "No hay ningún mensaje para reintentar" }, 400);
  entrevista.visibles = entrevista.visibles.slice(0, v + 1);
  const pendiente = entrevista.visibles[v];
  if (pendiente.pendiente) entrevista.mensajes.push({ role: "user", content: pendiente.paraAgente || pendiente.texto }); // había fallado: el historial no lo tiene
  else if (i >= 0) entrevista.mensajes = entrevista.mensajes.slice(0, i + 1); // respondió: se descarta la respuesta y se vuelve a pedir
  else entrevista.mensajes.push({ role: "user", content: pendiente.texto });
  return correrTurno(c, proyecto, entrevista);
});

app.post("/api/proyectos/:id/detener", (c) => {
  const ctrl = turnosActivos.get(c.req.param("id"));
  if (!ctrl) return c.json({ ok: false, error: "No hay nada corriendo." });
  ctrl.abort(new Error("detenido"));
  return c.json({ ok: true });
});

function correrTurno(c, proyecto, entrevista, idioma = "es") {
  const inicioTurno = Date.now();
  const control = new AbortController();
  turnosActivos.set(proyecto.id, control);
  return streamSSE(c, async (stream) => {
    const emitir = (evento, datos) => stream.writeSSE({ event: evento, data: JSON.stringify(datos) });
    // latido cada 15 s: mantiene viva la conexión y deja que el cliente detecte un corte
    const latido = setInterval(() => emitir("latido", { ts: Date.now() }).catch(() => {}), 15000);
    let mensajeDelTurno = null; // el texto del mensaje de la persona, por si el turno aparte falla y hay que reintentarlo
    try {
      const reparado = repararHistorial(entrevista.mensajes);
      if (reparado.cambios) console.warn(`[plano] historial de "${proyecto.nombre}" reparado (${reparado.cambios} arreglos)`);
      entrevista.mensajes = reparado.mensajes;
      // si el historial que se va a mandar (ya podado) pesa más que el umbral, se compacta antes de mandar este
      if (tokensDelHistorial(entrevista.mensajes) > UMBRAL_COMPACTAR()) {
        const hecho = compactarHistorial(entrevista);
        if (hecho) {
          const aviso = `Se compactó la conversación: ${hecho.mensajes} mensajes anteriores ya no se mandan a la IA. Lo registrado sigue en el Plano.`;
          entrevista.visibles.push({ rol: "sistema", texto: aviso, ts: Date.now() });
          await emitir("aviso", { texto: aviso });
        }
      }
      // Las pantallas del prototipo (generar y corregir desde los botones) corren en un contexto aparte y chico: el brief ya
      // trae todo lo que hace falta del Plano, y así la conversación no carga con HTML ni paga el contexto entero por pantalla.
      // Lo que pasó queda anotado para el próximo turno de la conversación.
      const ultimoMensaje = entrevista.mensajes.at(-1);
      const tipo = tipoDeTurno(ultimoMensaje).tipo;
      const aislado = (tipo === "prototipo" || tipo === "revision") && ultimoMensaje?.role === "user" && typeof ultimoMensaje.content === "string";
      let historial, respuesta, uso, sugerencias;
      if (aislado) {
        entrevista.mensajes.pop();
        mensajeDelTurno = ultimoMensaje.content;
        const notas = (entrevista.notasPendientes || []).join("\n");
        const mensajeAislado = { role: "user", content: (notas ? `[Contexto: ${notas}]\n\n` : "") + ultimoMensaje.content };
        ({ texto: respuesta, uso, sugerencias } = await responder({ proyecto, mensajes: [mensajeAislado], emitir, idioma, signal: control.signal }));
        uso.aislado = true;
        const pantalla = uso.pantalla ? (leerPlano(proyecto).pantallas || []).find((p) => p.id === uso.pantalla) : null;
        (entrevista.notasPendientes ||= []).push(`${tipo === "revision" ? "Se corrigió" : "Se generó"} la pantalla «${pantalla?.titulo || uso.pantalla}» en un turno aparte; su estado actual está en el Plano (leer_plano / leer_pantalla).`);
        if (entrevista.notasPendientes.length > 12) entrevista.notasPendientes = entrevista.notasPendientes.slice(-12);
      } else {
        // las notas de los turnos aparte entran como contexto del mensaje de la persona (al final del historial: no rompen la caché)
        if (entrevista.notasPendientes?.length && typeof ultimoMensaje?.content === "string") {
          ultimoMensaje.content = `[Contexto: ${entrevista.notasPendientes.join(" ")}]\n\n${ultimoMensaje.content}`;
          entrevista.notasPendientes = [];
        }
        ({ historial, texto: respuesta, uso, sugerencias } = await responder({ proyecto, mensajes: entrevista.mensajes, emitir, idioma, signal: control.signal }));
        entrevista.mensajes = historial;
        // los HTML y Planos completos que viajaron por las herramientas ya cumplieron: se reemplazan por una nota corta
        const poda = podarHistorial(entrevista.mensajes);
        if (poda.podados) { uso.podado = poda.caracteres; console.log(`[plano] "${proyecto.nombre}": ${poda.podados} resultados pesados podados del historial (${poda.caracteres} caracteres)`); }
      }
      (entrevista.uso ||= []).push(uso);
      const ultimoVisible = entrevista.visibles.findLast?.((x) => x.rol === "usuario");
      if (ultimoVisible) { delete ultimoVisible.pendiente; delete ultimoVisible.paraAgente; }
      const usoVisible = { entrada: uso.entrada + uso.cacheEscritura + uso.cacheLectura, salida: uso.salida, usd: uso.usd, llamadas: uso.llamadas };
      if (respuesta.trim()) entrevista.visibles.push({ rol: "plano", texto: respuesta, ts: Date.now(), uso: usoVisible, ...(sugerencias?.length ? { sugerencias } : {}) });
      else entrevista.visibles.push({ rol: "error", texto: "La IA terminó sin escribir nada. Podés reintentar.", ts: Date.now() });
      // lo que costó queda también donde se ve el resultado: en la versión de la pantalla, o en el roadmap
      if (uso.tipo === "roadmap") entrevista.roadmapUso = { ...usoVisible, ts: Date.now() };
      guardarEntrevista(proyecto, entrevista);
      if (uso.pantalla) anotarUsoEnPantalla(proyecto, uso.pantalla, usoVisible, inicioTurno);
      await emitir("fin", { plano: leerPlano(proyecto), vacio: !respuesta.trim(), uso: usoVisible, roadmapUso: entrevista.roadmapUso || null, turno: ultimoVisible?.turno || null, texto: respuesta, sugerencias: sugerencias || [] });
    } catch (e) {
      console.error(`[${new Date().toISOString()}] error en la entrevista de "${proyecto.nombre}":`, e);
      // el mensaje de la persona queda visible aunque la IA haya fallado; para la API se descarta y se reenvía al reintentar
      const ultimo = entrevista.mensajes.at(-1);
      let pendiente = false;
      if (ultimo?.role === "user" && typeof ultimo.content === "string") {
        entrevista.mensajes.pop();
        const visible = entrevista.visibles.findLast?.((x) => x.rol === "usuario");
        if (visible) { visible.pendiente = true; visible.paraAgente = ultimo.content; pendiente = true; }
      } else if (mensajeDelTurno) {
        // el turno aparte ya había sacado su mensaje del historial; igual queda para reintentar
        const visible = entrevista.visibles.findLast?.((x) => x.rol === "usuario");
        if (visible) { visible.pendiente = true; visible.paraAgente = mensajeDelTurno; pendiente = true; }
      }
      if (control.signal.aborted) {
        // la persona lo detuvo: no es un error; el mensaje queda sin mandar y se puede reenviar
        const visible = entrevista.visibles.findLast?.((x) => x.rol === "usuario");
        if (visible) visible.detenido = true;
        entrevista.visibles.push({ rol: "sistema", texto: "Detuviste la respuesta. Tu mensaje quedó sin mandar: podés reenviarlo o escribir otro.", ts: Date.now() });
        guardarEntrevista(proyecto, entrevista);
        await emitir("detenido", {});
        return;
      }
      const mensaje = describirError(e);
      entrevista.visibles.push({ rol: "error", texto: mensaje, ts: Date.now() });
      guardarEntrevista(proyecto, entrevista);
      await emitir("error", { mensaje, pendiente });
    } finally {
      clearInterval(latido);
      if (turnosActivos.get(proyecto.id) === control) turnosActivos.delete(proyecto.id);
    }
  });
}

// La versión de la pantalla que se escribió en este turno se queda con su costo, y la pantalla con el acumulado.
function anotarUsoEnPantalla(proyecto, pantallaId, uso, desde) {
  try {
    const item = (leerPlano(proyecto).prototipo || []).find((p) => p.id === pantallaId);
    if (!item) return;
    const historial = (item.historial || []).map((h) => (Date.parse(h.ts) >= desde - 1000 && !h.uso ? { ...h, uso } : h));
    const total = item.uso_total || { entrada: 0, salida: 0, usd: 0, turnos: 0 };
    actualizarItem(proyecto, "prototipo", pantallaId, { historial, uso_total: { entrada: total.entrada + uso.entrada, salida: total.salida + uso.salida, usd: total.usd + uso.usd, turnos: total.turnos + 1 } });
  } catch (e) { console.warn("[plano] no pude anotar el uso en la pantalla:", e.message); }
}

function describirError(e) {
  const s = e?.status;
  if (s === 401) return "La clave de API no es válida. Revisala en Configuración.";
  if (s === 403) return "La API key no tiene permiso para este modelo.";
  if (s === 429) return "Demasiadas solicitudes a la API. Esperá un momento y reintentá.";
  if (s === 529) return "La API está sobrecargada en este momento. Reintentá en unos segundos.";
  if (s >= 500) return `Error del lado de la API (${s}). Reintentá.`;
  if (s === 400) return `La API rechazó el pedido: ${e?.error?.error?.message || e?.error?.message || e.message}`.slice(0, 300);
  if (e?.name === "APIConnectionTimeoutError") return "La API tardó demasiado en responder. Reintentá.";
  if (e?.name === "APIConnectionError") return "No se pudo conectar con la API. Revisá la conexión y reintentá.";
  return e?.message || "Error desconocido";
}

app.use("/*", serveStatic({ root: "./client" }));

// Lo que el agente de código marca como hecho se verifica aunque nadie tenga Plano abierto en el navegador: el agente
// espera esa verificación para seguir. Plano mira el archivo del tablero (se entera al instante) y además repasa cada 20 s.
const verificarAlCambiar = (p) => verificarPendientes(p).catch((e) => console.warn(`[plano] verificación de "${p.nombre}":`, e.message));
for (const p of listarProyectos()) { try { if (leerConstruccion(p)) { vigilarConstruccion(p, verificarAlCambiar); verificarAlCambiar(p); } } catch {} }
setInterval(() => {
  for (const p of listarProyectos()) {
    try { if (leerConstruccion(p)?.tareas.some((t) => t.estado === "hecha")) verificarAlCambiar(p); } catch {}
  }
}, 20000).unref();

serve({ fetch: app.fetch, port: PUERTO }, () => {
  console.log(`Plano ${VERSION} escuchando en http://localhost:${PUERTO}${process.env.PLANO_MOCK ? "  (modo simulado, sin IA)" : ""}`);
  if (!claveApi() && !process.env.PLANO_MOCK) console.log("Falta la clave de API: cargala en Configuración (o ANTHROPIC_API_KEY en .env). La entrevista no va a responder hasta entonces.");
});
