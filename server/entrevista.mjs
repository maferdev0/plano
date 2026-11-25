// El agente de la entrevista fundacional.
// Conversa con la persona y, a medida que decide cosas, las registra en el Plano con herramientas.
// Lo que no queda registrado, no existe. Por eso cada decisión se vuelve tarjeta en el momento.

import Anthropic from "@anthropic-ai/sdk";
import { dispositivosDe, tipoApp } from "./plano-store.mjs";
import { COLECCIONES, NIVELES, leerPlano, registrarItem, actualizarItem, quitarItem, nivelesEntidades, idsElementos, idsEstados, escribirPantallaPrototipo, leerPantallaPrototipo, slug, aprobarPantalla, devolverPantalla, iniciarPrototipo } from "./plano-store.mjs";
import { revisarVersion } from "./revision.mjs";
import { prepararConstruccion, leerConstruccion, resumenConstruccion } from "./construccion.mjs";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative, isAbsolute, join } from "node:path";

import { claveApi, usuario as nombreUsuario, modeloEntrevista, modeloPrototipo, umbralCompactar } from "./config.mjs";
// Los modelos y el umbral salen de la configuración (data/config.json, o .env), y se leen en cada turno: cambiarlos no pide reiniciar.
export const MODELO = () => modeloEntrevista();
// Las pantallas del prototipo (generar y corregir HTML) no necesitan el modelo más caro: el brief, el verificador y la revisión
// de la persona son lo que fija la calidad. Sonnet cuesta la mitad por token y arranca cada pantalla en un contexto chico.
export const MODELO_PROTOTIPO = () => modeloPrototipo();
export const modeloPara = (tipo) => (tipo === "prototipo" || tipo === "revision" ? modeloPrototipo() : modeloEntrevista());

// Precios por millón de tokens (USD), según platform.claude.com/docs/en/about-claude/pricing (nov. 2026):
// entrada, salida, escritura de caché de 1 hora (la de 5 min sale 5 / 6,25 / 2,5 / 12,5), lectura de caché.
// Se usa la caché de 1 hora: entre revisar una pantalla y la siguiente suelen pasar más de 5 minutos, y cada vez que la
// caché vence se vuelve a escribir la conversación entera; con una hora, eso pasa una vez por sesión de trabajo.
export const PRECIOS = {
  "claude-opus-5-5": { entrada: 4, salida: 20, cacheEscritura: 8, cacheLectura: 0.2 },
  "claude-opus-5": { entrada: 5, salida: 25, cacheEscritura: 10, cacheLectura: 0.5 },
  "claude-sonnet-5-5": { entrada: 2, salida: 10, cacheEscritura: 4, cacheLectura: 0.1 },
  "claude-fable-5-1": { entrada: 10, salida: 50, cacheEscritura: 20, cacheLectura: 0.25 },
};
export const CACHE_MINUTOS = 60;
export function costoUsd(uso, modelo = modeloEntrevista()) {
  const p = PRECIOS[modelo] || PRECIOS[Object.keys(PRECIOS).find((k) => modelo.startsWith(k))] || PRECIOS["claude-opus-5-5"];
  return (uso.entrada * p.entrada + uso.salida * p.salida + uso.cacheEscritura * p.cacheEscritura + uso.cacheLectura * p.cacheLectura) / 1e6;
}
export function extraerSugerencias(texto) {
  // tolera variantes: con o sin corchetes, "Respuestas rápidas:", espacios o puntuación al final
  const m = String(texto || "").match(/\n?\s*\[?\s*Respuestas?(?: r[aá]pidas)?:\s*([^\]\n]+?)\s*\]?\s*[.]?\s*$/i);
  if (!m) return { texto, lista: [] };
  const lista = m[1].split("|").map((x) => x.trim().replace(/^["«]|["»]$/g, "")).filter(Boolean).slice(0, 3);
  return { texto: texto.slice(0, m.index).trimEnd(), lista };
}

// ---------- compactación ----------
// Cuando la conversación pesa más que el umbral, se dejan de mandar los mensajes viejos. No se pide un resumen a la IA:
// el Plano ya es el resumen, y lo que no llegó al Plano es, por definición, lo que no importaba. Se conservan los últimos
// turnos tal cual, y una nota al principio le dice al agente que lea el Plano. En el chat queda una marca visible.
// 40k por defecto: la conversación vieja vale poco (lo que importa está en el Plano) y cada reescritura de caché cuesta
// proporcional al contexto. Con 100k, una tarde de trabajo con cortes de más de una hora salía el triple.
export const UMBRAL_COMPACTAR = () => umbralCompactar();
const MENSAJES_QUE_QUEDAN = 8;
// Cuánto pesa el historial que se va a mandar (ya podado), en tokens aproximados. Es lo que decide si se compacta: medir el
// contexto de la última llamada engañaba, porque dentro del turno viajan resultados de herramientas que después se podan.
export const tokensDelHistorial = (mensajes) => Math.round(JSON.stringify(mensajes || []).length / 3.5);
export function compactarHistorial(entrevista, ahora = Date.now()) {
  const m = entrevista.mensajes;
  // el corte tiene que caer en un mensaje de la persona con texto (no en un tool_result), para no partir un par tool_use/tool_result
  let corte = Math.max(0, m.length - MENSAJES_QUE_QUEDAN);
  while (corte > 0 && !(m[corte].role === "user" && typeof m[corte].content === "string")) corte--;
  if (corte === 0) return null;
  const fuera = m.slice(0, corte);
  const temas = fuera.filter((x) => x.role === "user" && typeof x.content === "string").slice(-4)
    .map((x) => x.content.split("\n\n[")[0].replace(/\s+/g, " ").trim().slice(0, 100));
  const nota = `[Conversación compactada el ${new Date(ahora).toLocaleString("es-UY")}: los ${fuera.length} mensajes anteriores ya no se mandan. Todo lo que se registró está en el Plano: si te falta algo, leer_plano sin parámetros te da el índice y leer_plano({ coleccion, ids }) el detalle; no pidas el Plano completo, y no vuelvas a preguntar lo que ya está. Lo último que se venía hablando: ${temas.map((t) => `"${t}"`).join("; ") || "(sin texto)"}.]\n\n`;
  const restantes = m.slice(corte);
  restantes[0] = { ...restantes[0], content: nota + restantes[0].content };
  entrevista.mensajes = restantes;
  (entrevista.compactaciones ||= []).push({ ts: ahora, mensajes: fuera.length, quedaron: restantes.length });
  return { mensajes: fuera.length };
}

// ---------- poda del historial ----------
// El HTML de las pantallas y el Plano completo viajan por las herramientas (leer_pantalla, escribir_pantalla, leer_plano,
// leer_archivo) y pesan miles de tokens cada uno. Dentro del turno hacen falta; terminado el turno, quedarían en el
// historial para siempre y se volverían a mandar en cada llamada. Acá se reemplazan por una nota corta: lo que dicen sigue
// en los archivos y el agente puede volver a pedirlo. Se hace al cerrar cada turno, así que el caché del prefijo anterior
// no se toca (lo de este turno todavía no estaba en caché).
const PESADAS = new Set(["leer_pantalla", "leer_plano", "leer_archivo", "listar_archivos", "brief_pantalla", "revisar_version"]);
const PODA_MINIMO = Number(process.env.PLANO_PODA_MINIMO || 1500); // caracteres: por debajo de esto no vale la pena tocar nada
export function podarHistorial(mensajes, desde = 0) {
  let podados = 0, caracteres = 0;
  const nombres = new Map(); // tool_use_id → { name, input }
  for (let i = 0; i < mensajes.length; i++) {
    const m = mensajes[i];
    if (!Array.isArray(m.content)) continue;
    const contenido = m.content.map((b) => {
      if (b.type === "tool_use") {
        nombres.set(b.id, b);
        if (i < desde) return b;
        if (b.name === "escribir_pantalla" && typeof b.input?.html === "string" && b.input.html.length > PODA_MINIMO) {
          caracteres += b.input.html.length; podados++;
          return { ...b, input: { ...b.input, html: `[HTML de ${b.input.html.length} caracteres guardado en prototipo/${b.input.pantalla}.html; se sacó del historial para ahorrar contexto. Si lo necesitás, leelo con leer_pantalla.]` } };
        }
        return b;
      }
      if (b.type === "tool_result" && i >= desde) {
        const uso = nombres.get(b.tool_use_id);
        if (!uso || !PESADAS.has(uso.name)) return b;
        const texto = typeof b.content === "string" ? b.content : Array.isArray(b.content) ? b.content.map((x) => x.text || "").join("") : "";
        if (texto.length < PODA_MINIMO) return b;
        caracteres += texto.length; podados++;
        const que = uso.name === "leer_pantalla" ? `el HTML de la pantalla ${uso.input?.pantalla}` : uso.name === "leer_plano" ? "el Plano completo" : uso.name === "leer_archivo" ? `el archivo ${uso.input?.ruta || ""}` : `el resultado de ${uso.name}`;
        return { ...b, content: `[Acá venía ${que} (${texto.length} caracteres); se sacó del historial para ahorrar contexto. Lo actual está en los archivos: si lo necesitás, volvé a llamar ${uso.name}.]` };
      }
      return b;
    });
    mensajes[i] = { ...m, content: contenido };
  }
  return { podados, caracteres };
}
export { dispositivosDe } from "./plano-store.mjs";

// ---------- lectura de la carpeta del proyecto ----------
// El agente puede mirar lo que hay en la carpeta del proyecto (y nada más): sirve para ver qué está construido, leer un
// documento que la persona dejó, o entender un repo existente. Las rutas se resuelven con path, así que da igual el sistema.
const IGNORAR = new Set(["node_modules", ".git", ".next", "dist", "build", ".cache", ".turbo", "coverage", ".venv", "__pycache__", ".deshacer"]);
function dentroDelProyecto(proyecto, ruta) {
  const base = resolve(proyecto.carpeta);
  const destino = resolve(base, String(ruta || "").replace(/^[\\/]+/, ""));
  const rel = relative(base, destino);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("Esa ruta queda fuera de la carpeta del proyecto.");
  return destino;
}
function listarArchivos(proyecto, ruta, profundidad) {
  try {
    const base = dentroDelProyecto(proyecto, ruta);
    if (!existsSync(base)) return { error: `No existe ${ruta || "la raíz"}.` };
    const max = Math.max(1, Math.min(4, Number(profundidad) || 2));
    const lineas = [];
    const bajar = (dir, nivel, prefijo) => {
      const entradas = readdirSync(dir, { withFileTypes: true }).filter((e) => !IGNORAR.has(e.name)).sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));
      for (const e of entradas) {
        if (lineas.length >= 400) { lineas.push(prefijo + "… (recortado)"); return; }
        const full = join(dir, e.name);
        if (e.isDirectory()) { lineas.push(`${prefijo}${e.name}/`); if (nivel < max) bajar(full, nivel + 1, prefijo + "  "); }
        else { let tam = 0; try { tam = statSync(full).size; } catch {} lineas.push(`${prefijo}${e.name} (${tam < 1024 ? tam + " B" : Math.round(tam / 1024) + " KB"})`); }
      }
    };
    bajar(base, 1, "");
    return { carpeta: relative(resolve(proyecto.carpeta), base) || ".", archivos: lineas.join("\n") };
  } catch (e) { return { error: e.message }; }
}
function leerArchivo(proyecto, ruta) {
  try {
    const full = dentroDelProyecto(proyecto, ruta);
    if (!existsSync(full) || statSync(full).isDirectory()) return { error: `No existe el archivo ${ruta}.` };
    const tam = statSync(full).size;
    if (tam > 60 * 1024) return { error: `El archivo pesa ${Math.round(tam / 1024)} KB; el máximo es 60 KB. Pedí una parte o un archivo más chico.` };
    const buf = readFileSync(full);
    if (buf.subarray(0, 512).includes(0)) return { error: "Es un archivo binario, no texto." };
    return { ruta, contenido: buf.toString("utf8") };
  } catch (e) { return { error: e.message }; }
}

// Imágenes y fuentes de marca en la carpeta del proyecto: carpetas típicas, primer nivel, hasta 20 archivos.
export function recursosDeMarca(proyecto) {
  const out = [];
  for (const dir of ["logos", "logo", "marca", "brand", "assets", "recursos", "public"]) {
    const full = join(proyecto.carpeta, dir);
    if (!existsSync(full) || !statSync(full).isDirectory()) continue;
    for (const f of readdirSync(full)) if (/\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf)$/i.test(f)) out.push(`${dir}/${f}`);
    if (out.length >= 20) break;
  }
  return out.slice(0, 20);
}

// Qué disparó el turno, para la pantalla de uso: entrevista, roadmap, prototipo (generar) o revisión (devolver).
export function tipoDeTurno(mensaje) {
  const t = typeof mensaje?.content === "string" ? mensaje.content : "";
  const m = t.match(/\[Prototipo: (generar|revisar) la pantalla "[^"]*" \(id: ([^)]+)\)/);
  if (m) return { tipo: m[1] === "revisar" ? "revision" : "prototipo", pantalla: m[2] };
  if (/armar el roadmap desde la interfaz/.test(t)) return { tipo: "roadmap" };
  return { tipo: "entrevista" };
}
// Caché de prompt: el sistema es fijo por proyecto y el historial solo crece, así que casi todo el turno siguiente se lee de caché.
function conCache(bloque) { return { ...bloque, cache_control: { type: "ephemeral", ttl: "1h" } }; }
function mensajesConCache(historial) {
  if (!historial.length) return historial;
  const copia = historial.slice();
  const ultimo = copia.at(-1);
  const contenido = typeof ultimo.content === "string" ? [{ type: "text", text: ultimo.content }] : ultimo.content.slice();
  if (contenido.length) contenido[contenido.length - 1] = conCache(contenido.at(-1));
  copia[copia.length - 1] = { ...ultimo, content: contenido };
  return copia;
}
const MAX_VUELTAS = 12;
const MAX_TOKENS = 16000;

// ---------- herramientas que el agente usa para escribir el Plano ----------
const ITEM_SCHEMA = {
  type: "object",
  description: "El ítem. Para toda colección salvo identidad: id (slug corto en minúsculas), titulo, descripcion y nivel. Para identidad: solo los campos de la ficha (nombre, que_es, para_quien, por_que, tipo, objetivo, stack) y nivel; sin id ni titulo.",
  properties: {
    id: { type: "string", description: "slug único dentro de la colección, ej. 'negocio', 'chat-unico', 'reservar-turno'" },
    titulo: { type: "string" },
    descripcion: { type: "string", description: "Una o dos frases, en las palabras de la persona, no en jerga." },
    nivel: { type: "string", enum: NIVELES, description: "duro: cimiento, cambiarlo es caro. blando: puede cambiar. supuesto: lo asumiste vos porque la persona no lo dijo; se marca para revisión." },
    tabla: { type: "string", description: "Solo entidades: nombre de la tabla en plural, en minúsculas (negocios, clientes, conversaciones)." },
    campos: { type: "object", description: "Solo entidades: { nombreCampo: 'string' | 'number' | 'boolean' | 'string?' | 'id:<entidad>' }. Registrá los campos que la persona nombró; si no nombró ninguno, los mínimos obvios como supuesto.", additionalProperties: { type: "string" } },
    elementos: { type: "array", items: { type: "string" }, description: "Solo pantallas: qué hay en la pantalla (lista, botón, formulario...), con nombres cortos." },
    pantalla: { type: "string", description: "Solo acciones: id de la pantalla donde ocurre." },
    entidad: { type: "string", description: "Solo acciones: id de la entidad que toca." },
    espacio: { type: "string", enum: ["app", "admin", "consola"], description: "Solo pantallas: dónde vive. app = lo que usa el cliente final; admin = el panel de la empresa; consola = la consola interna." },
    dispositivos: { type: "array", items: { type: "string", enum: ["celular", "escritorio"] }, description: "Solo pantallas: en qué se usa esta pantalla, si es distinto de lo que dice la identidad del proyecto (dispositivos: ambos, celular o escritorio). Vacío = lo del proyecto." },
    estados: { type: "array", items: { type: "object", properties: { id: { type: "string" }, titulo: { type: "string" }, descripcion: { type: "string" } }, required: ["id", "titulo"] }, description: "Solo pantallas: si la pantalla se ve distinta según la situación (cuenta nueva / con datos, con créditos / pocos / sin, vacío / con resultados), cada situación es un estado con id (slug), titulo corto y qué cambia. El primero es el normal. Plano pone el selector de estados afuera de la pantalla; el prototipo solo lee ?estado=." },
    elemento: { type: "string", description: "Solo acciones: el elemento de su pantalla que la dispara, escrito igual que en la lista de elementos de la pantalla (ej. \"botón guardar\")." },
    lleva_a: { type: "string", description: "Solo acciones: id de la pantalla a la que lleva, si al hacerla la persona pasa a otra pantalla (abrir un detalle, confirmar y volver, ir al perfil). Vacío si se queda en la misma." },
    por_que_importa: { type: "string", description: "Solo preguntas: qué se traba si no se responde." },
    orden: { type: "integer", description: "Solo roadmap: número de la versión (1, 2, 3…)." },
    objetivo: { type: "string", description: "Solo roadmap: qué puede hacer una persona de punta a punta cuando esta versión está terminada, en una frase." },
    pantallas: { type: "array", items: { type: "string" }, description: "Solo roadmap: ids de las pantallas que entran en esta versión." },
    entidades: { type: "array", items: { type: "string" }, description: "Solo roadmap: ids de las entidades que entran en esta versión." },
    acciones: { type: "array", items: { type: "string" }, description: "Solo roadmap: ids de las acciones que entran en esta versión." },
    integraciones: { type: "array", items: { type: "string" }, description: "Solo roadmap: ids de las integraciones que entran en esta versión." },
  },
  required: ["nivel"],
  additionalProperties: true,
};

export const TOOLS = [
  {
    name: "registrar_item",
    description:
      "Registra una decisión en el Plano apenas la persona la toma o la confirma. Colecciones: identidad (objeto único: nombre, que_es, para_quien, por_que, objetivo, stack, dispositivos: ambos, celular o escritorio; tipo_app es de solo lectura, se eligió al crear el proyecto), decisiones (elecciones técnicas o de producto), entidades (los sustantivos del sistema), pantallas (lo que la persona ve; con espacio: app, admin o consola), acciones (los verbos: qué hace alguien en una pantalla sobre una entidad; si lleva a otra pantalla, lleva_a con su id), integraciones (servicios externos), innegociables (diseño, idioma, tono, lo que no se discute), preguntas (lo que la persona todavía no sabe y el agente NO debe decidir solo), roadmap (las versiones en que se construye el proyecto, en orden: cada una con orden, objetivo y los ids de pantallas, entidades, acciones e integraciones que entran). Si el ítem ya existe con ese id, se actualiza.",
    input_schema: {
      type: "object",
      properties: {
        coleccion: { type: "string", enum: COLECCIONES },
        item: ITEM_SCHEMA,
      },
      required: ["coleccion", "item"],
    },
  },
  {
    name: "actualizar_item",
    description: "Cambia campos de un ítem existente (por ejemplo, subirlo de supuesto a duro cuando la persona lo confirma, o corregir una descripción).",
    input_schema: {
      type: "object",
      properties: {
        coleccion: { type: "string", enum: COLECCIONES },
        id: { type: "string" },
        cambios: { type: "object", additionalProperties: true },
      },
      required: ["coleccion", "id", "cambios"],
    },
  },
  {
    name: "quitar_item",
    description: "Quita un ítem del Plano porque la persona lo descartó.",
    input_schema: {
      type: "object",
      properties: { coleccion: { type: "string", enum: COLECCIONES }, id: { type: "string" } },
      required: ["coleccion", "id"],
    },
  },
  {
    name: "escribir_pantalla",
    description: "Guarda el HTML de una pantalla del prototipo (prototipo/<pantalla>.html). El HTML tiene que ser una página completa, autocontenida (CSS y JS adentro; solo se permite Google Fonts como recurso externo), en español, con datos de mentira, y con data-plano en el contenedor principal y en CADA elemento que el Plano le pide a esa pantalla (los ids te los pasan). Si falta algo, la herramienta devuelve los errores y NO guarda: corregí y volvé a llamar.",
    input_schema: { type: "object", properties: { pantalla: { type: "string", description: "id de la pantalla en el Plano" }, html: { type: "string" } }, required: ["pantalla", "html"] },
  },
  {
    name: "leer_pantalla",
    description: "Devuelve el HTML actual de una pantalla del prototipo, para revisarla o corregirla sin rehacerla entera.",
    input_schema: { type: "object", properties: { pantalla: { type: "string" } }, required: ["pantalla"] },
  },
  {
    name: "editar_pantalla",
    description: "Cambia partes puntuales del HTML de una pantalla ya generada, sin mandar el archivo entero: cada cambio es un texto a buscar (tiene que aparecer EXACTAMENTE una vez en el HTML actual) y el texto que lo reemplaza. Es la herramienta para correcciones chicas (un enlace, un texto, un color, un bloque). Si el resultado no pasa la verificación, no se guarda nada y te devuelve los errores.",
    input_schema: {
      type: "object",
      properties: {
        pantalla: { type: "string", description: "id de la pantalla en el Plano" },
        cambios: { type: "array", minItems: 1, items: { type: "object", properties: { buscar: { type: "string" }, reemplazar: { type: "string" } }, required: ["buscar", "reemplazar"] } },
      },
      required: ["pantalla", "cambios"],
    },
  },
  {
    name: "niveles_entidades",
    description: "Calcula mecánicamente el orden de dependencia de las entidades del Plano: nivel 0 no depende de nada; nivel n usa alguna de nivel n-1. Es la base para armar el roadmap: nada puede entrar en una versión antes que las entidades que necesita.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "leer_plano",
    description: "Lee el Plano tal como está en los archivos. Sin parámetros devuelve el índice: la identidad entera y, de cada colección, solo id, título y nivel (más pantalla/entidad/lleva_a en acciones, espacio en pantallas, y las listas de ids de cada versión del roadmap). Es barato: usalo al retomar una conversación o para ubicarte. Para ver ítems completos pedí coleccion (y opcionalmente ids). completo: true trae todo el Plano entero, que es grande: solo antes de proponer el cierre de una versión.",
    input_schema: { type: "object", properties: { coleccion: { type: "string", enum: ["identidad", "decisiones", "entidades", "pantallas", "acciones", "integraciones", "innegociables", "preguntas", "roadmap", "prototipo"] }, ids: { type: "array", items: { type: "string" } }, completo: { type: "boolean" } } },
  },
  // Lo mismo que hacen los botones de Plano, para que pedirlo por chat sea exactamente igual que apretar el botón.
  {
    name: "brief_pantalla",
    description: "Devuelve el brief exacto de una pantalla para generarla o corregirla: elementos con su data-plano, acciones, entidades, innegociables, dispositivos. Llamalo SIEMPRE antes de escribir_pantalla cuando la persona te pide por chat generar, regenerar o corregir una pantalla (cuando te llega el bloque [Prototipo: …] ya viene incluido).",
    input_schema: { type: "object", properties: { pantalla: { type: "string", description: "id de la pantalla" }, comentario: { type: "string", description: "si es una corrección, qué pidió la persona" } }, required: ["pantalla"] },
  },
  {
    name: "aprobar_pantalla",
    description: "Aprueba una pantalla del prototipo: pasa a dura y sus elementos quedan congelados. Solo cuando la persona lo dice explícitamente.",
    input_schema: { type: "object", properties: { pantalla: { type: "string" } }, required: ["pantalla"] },
  },
  {
    name: "devolver_pantalla",
    description: "Marca una pantalla del prototipo como devuelta con un comentario de la persona, sin corregirla todavía.",
    input_schema: { type: "object", properties: { pantalla: { type: "string" }, comentario: { type: "string" } }, required: ["pantalla", "comentario"] },
  },
  {
    name: "iniciar_prototipo",
    description: "Empieza el prototipo de una versión del roadmap: registra sus pantallas como pendientes. Solo si el roadmap existe.",
    input_schema: { type: "object", properties: { version: { type: "string", description: "id de la versión, ej. v1" } }, required: ["version"] },
  },
  {
    name: "listar_archivos",
    description: "Lista los archivos y carpetas del proyecto (la carpeta donde vive el Plano), para ver qué hay construido o qué trajo la persona. Solo dentro de esa carpeta; ignora node_modules, .git y similares.",
    input_schema: { type: "object", properties: { ruta: { type: "string", description: "subcarpeta relativa, vacío para la raíz" }, profundidad: { type: "integer", description: "niveles a bajar, 1 a 4 (por defecto 2)" } } },
  },
  {
    name: "leer_archivo",
    description: "Devuelve el contenido de un archivo de texto del proyecto (código, configuración, documentos). Solo dentro de la carpeta del proyecto; hasta 60 KB.",
    input_schema: { type: "object", properties: { ruta: { type: "string", description: "ruta relativa a la carpeta del proyecto" } }, required: ["ruta"] },
  },
  {
    name: "preparar_construccion",
    description: "Prepara la construcción de una versión del roadmap cuando todas sus pantallas están aprobadas en el prototipo: deriva mecánicamente el tablero de tareas (plano/construccion.json) y escribe el contrato para el agente de código (AGENTS.md y CLAUDE.md) en la carpeta del proyecto. Es lo mismo que el botón de Plano. Si falta aprobar pantallas, devuelve cuáles.",
    input_schema: { type: "object", properties: { version: { type: "string" } }, required: ["version"] },
  },
  {
    name: "leer_construccion",
    description: "Devuelve el tablero de construcción (tareas y estados) de la versión en construcción, o null si todavía no se preparó.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "revisar_version",
    description: "Corre la revisión mecánica de una versión del roadmap y devuelve los hallazgos (lo que falta resolver antes de construirla).",
    input_schema: { type: "object", properties: { version: { type: "string" } }, required: ["version"] },
  },
];

// ---------- el guion ----------
const TIPO_APP_TEXTO = {
  web: "web (corre en el navegador; se usa en celular, computadora o ambos; se publica en un dominio)",
  escritorio: "de escritorio (se instala en la computadora: Windows, macOS o Linux; las pantallas son ventanas, solo marco de escritorio; se publica como instalador)",
  movil: "móvil (se instala en el teléfono: Android, iOS o ambos; solo marco de celular; se publica en las tiendas o como instalable de prueba)",
};
function systemPrompt(proyecto, idioma = "es") {
  return `${idioma === "en" ? "IMPORTANT: the person uses Plano in English. Speak to them in English and write everything you register in the Plano (titles, descriptions) in English. The rules below are in Spanish; follow them, answer in English.\n\n" : ""}Sos la entrevistadora de Plano. Tu trabajo es ayudar a ${nombreUsuario()} a definir los cimientos del proyecto "${proyecto.nombre}" y dejarlos registrados en el Plano, que es un conjunto de archivos JSON que después van a leer agentes de IA que construyan el proyecto. Lo que no registrás con las herramientas, no existe.

Tipo de aplicación: ${TIPO_APP_TEXTO[tipoApp(leerPlano(proyecto))]}. Es una decisión dura tomada al crear el proyecto: no se cambia, no se discute, y todo lo demás (stack, pantallas, prototipo, construcción) tiene que ser coherente con eso. Si la persona pide algo que contradice el tipo (una app móvil con pantallas de escritorio, un sitio web que "se instala"), decíselo.

Cómo trabajás:
- Hablás en español rioplatense, con vos, sin formalidades, corto y claro. Una pregunta por vez, o dos si están muy relacionadas. Nunca una lista de ocho preguntas.
- En la identidad va dispositivos: si la aplicación se usa en el celular, en la computadora o en ambas. Preguntalo al principio si no surge solo; "ambas" es lo normal para una web. Una pantalla puede tener sus propios dispositivos si se aparta de eso (un panel que solo tiene sentido en escritorio, por ejemplo).
- Estados de pantalla: si una pantalla se ve distinta según la situación (cuenta recién creada o con datos, con créditos / pocos / sin créditos, lista vacía o con resultados), eso son estados y van en el Plano, en el campo estados de la pantalla (id, titulo, qué cambia; el primero es el normal). Registralos cuando surgen en la entrevista o cuando al prototipar ves que hacen falta (actualizar_item antes de escribir la pantalla). Nunca inventes un selector de estados adentro del HTML: Plano lo pone afuera, en la barra de la pantalla, y la página solo lee ?estado=<id> de la URL. Una misma situación (los créditos, por ejemplo) se ve igual en todas las pantallas donde aparece.
- Ningún elemento que hace algo sin acción: si registrás una pantalla con un botón, un campo que se envía o un enlace, registrá en el mismo turno la acción que lo respalda, con pantalla, entidad y elemento. Lo que se ve y no hace nada es un dibujo, no un Plano.
- Las acciones conectan pantallas: cuando registrás una acción que lleva a otra pantalla (abrir, confirmar, volver, ir a), ponele lleva_a con el id de esa pantalla, y si no está claro a dónde va, preguntalo; de ahí salen las flechas del lienzo y los enlaces del prototipo.
- Si el brief de una pantalla lista recursos de marca (logos, íconos), los usás con esa ruta exacta (recursos/…), nunca un cuadrado con iniciales en su lugar.
- Podés mirar la carpeta del proyecto con listar_archivos y leer_archivo cuando la persona te lo pide o cuando hace falta para el Plano (qué hay construido, un documento que dejó, un repo que ya existe). Solo lectura, y solo esa carpeta.
- Todo lo que se hace con botones en Plano se puede pedir por chat, y hacés exactamente lo mismo: generar o corregir una pantalla (brief_pantalla y después escribir_pantalla para generar, o leer_pantalla y editar_pantalla para corregir), aprobarla, devolverla, empezar el prototipo de una versión, armar el roadmap, revisar una versión. Nunca digas "hacelo desde Plano": tenés la herramienta, usala. Si te piden varias pantallas, hacés una por turno y preguntás si seguís con la siguiente.
- Respuestas rápidas, casi siempre: terminás el mensaje con una línea exacta [Respuestas: opción | opción | opción] cada vez que la persona tiene algo que decidir, confirmar, elegir o un siguiente paso obvio (seguir, aprobar, dejarlo para después, pedir más detalle). Hasta tres opciones, cortas, escritas como las diría la persona. Ejemplos: [Respuestas: Sí, va | No, sacalo | Dejalo para la v2] · [Respuestas: Seguí con la siguiente | Mostrame lo que falta] · [Respuestas: Passkey como el cliente | Código por email | Google]. Solo la omitís cuando la respuesta es puramente informativa y no hay nada que decidir. Esa línea no se muestra como texto: Plano la convierte en botones.
- No anunciás lo que vas a hacer. Si tenés que usar herramientas, las usás primero, sin texto previo del tipo "primero registro…"; cuando terminás, contás el resultado una sola vez. Lo que escribís antes de las herramientas y lo que escribís después se muestra junto, así que no repitas.
- Registrás en el momento. Apenas la persona dice algo que define el proyecto (qué es, para quién, si es web o app, colores, una entidad, una pantalla, una integración), llamás a registrar_item en ese mismo turno. No esperás a "tener todo". No preguntás "¿lo registro?": registrás y seguís.
- Nivel: si la persona lo dice con firmeza o es estructural (entidades, tipo de app, stack, dominio del problema), duro. Si es detalle que puede cambiar (textos, un color secundario, orden de una pantalla), blando. Si lo asumiste vos para poder avanzar porque la persona no lo dijo, supuesto, y lo decís en voz alta en una frase: "Asumo X, decime si no". Nunca registrás algo como duro si lo inventaste vos.
- Lo que la persona no sabe no lo decidís: lo registrás en preguntas, con por_que_importa, y seguís. Las preguntas abiertas son tan valiosas como las respuestas.
- Adaptás el vocabulario a la persona. Si la pregunta tiene una decisión técnica atrás que la persona no puede simplificar, explicás en una frase qué cambia con cada opción, pero no le escondés la pregunta.
- Orden sugerido, flexible: qué es y para quién → por qué existe / objetivo (comercial, personal, para un cliente) → web o app, y si es web, responsiva o no → público concreto y primer usuario real → innegociables (idioma, colores, tipografía, tono) → las entidades (los sustantivos) → las pantallas (lo que se ve, con sus elementos) → las acciones (los verbos que unen pantallas y entidades) → integraciones externas → stack, si la persona tiene opinión; si no, lo proponés como supuesto.
- Cada tanto, cuando una parte quedó cerrada, resumís en dos líneas lo que quedó registrado y seguís. No recitás todo el Plano.
- Cuando ya hay identidad, al menos tres entidades, las pantallas principales con sus elementos y las acciones básicas, decís que el Plano tiene lo mínimo para arrancar un prototipo, y preguntás si quiere seguir definiendo o parar acá. No insistís.
- Al retomar una conversación anterior, primero llamás a leer_plano y seguís desde donde quedó, sin volver a preguntar lo que ya está.
- Si el mensaje termina con "[Tarjetas mencionadas con @: coleccion/id (...)]", la persona está hablando de esas tarjetas: actualizalas con actualizar_item usando exactamente esa colección e id (por ejemplo, para responder una pregunta abierta, actualizá esa pregunta o quitala y registrá la decisión que la responde). No repitas esa línea en tu respuesta.
- El roadmap: es el orden en que se construye el proyecto, en versiones; cada versión es una tajada vertical usable de punta a punta (una persona real puede hacer algo completo con ella). Cuando el Plano queda cerrado (sin preguntas abiertas y con el alcance de la primera versión aprobado), vos lo decís y proponés armar el roadmap como siguiente paso. Si la persona acepta, o te lo pide, lo armás: llamás a niveles_entidades y a leer_plano, y registrás las versiones en la colección "roadmap" con ids v1, v2, v3…, nivel "propuesto", título SIN el prefijo "v1 ·" (el número va en el campo orden). Reglas: la v1 es el alcance que la persona aprobó, si hay uno; cada pantalla, entidad, acción e integración aparece en exactamente UNA versión; nada entra antes que las entidades que necesita; los ítems propuestos que la persona no aprobó no entran. Entre 3 y 7 versiones. Después resumís en dos líneas por versión y preguntás si cambia algo. Si ya había versiones, las reemplazás (quitás las viejas, registrás las nuevas). Lo que la persona mueva a mano entre versiones no lo deshacés.
- El prototipo se hace por versión, empezando por la v1, y nunca sin roadmap: sin roadmap no hay versión y prototipar "la aplicación entera" es volver al vibe coding. Si la persona pide prototipar y no hay roadmap, no aceptás ni ofrecés prototipar: le decís eso en una frase y ofrecés armar el roadmap. Si hay roadmap, le decís que el prototipo de la v1 es el siguiente paso y que lo hace Plano, no esta conversación.
- El prototipo: cuando te llega un bloque "[Prototipo: generar …]" o "[Prototipo: revisar …]", dejás de entrevistar y hacés UNA pantalla, la que te indican, con escribir_pantalla. Es un prototipo clickeable: HTML, CSS y JS en un solo archivo, datos de mentira creíbles (nombres, precios, horas reales de Uruguay), nada de backend. Respetás los innegociables al pie de la letra. El contenedor principal lleva data-plano="<id-pantalla>" y cada elemento del Plano lleva su data-plano="<id-pantalla>/<id-elemento>" (te pasan la lista exacta; si la herramienta devuelve errores, corregís y volvés a llamar; no inventás elementos que el Plano no pide, y si creés que falta uno, lo decís en tu respuesta, no lo agregás). Las pantallas de app.atendia.uy se diseñan para un celular de 390 px de ancho; las de admin. y consola. para escritorio, y se adaptan. Sin backdrop-filter (se ve mal dentro del marco de celular de Plano); para un encabezado translúcido alcanza con un fondo semitransparente. Para navegar entre pantallas de la misma versión usás enlaces relativos "<id-pantalla>.html". Cuando terminás, decís en dos o tres líneas qué hiciste y qué decisiones de diseño tomaste que la persona debería mirar, y pedís que la revise: la aprueba o la devuelve con un comentario desde la interfaz, no acá. No generás la siguiente pantalla hasta que te la pidan.
- Corregir una pantalla que ya existe: leer_pantalla una vez y después editar_pantalla con los fragmentos exactos a cambiar. Mandar el HTML entero con escribir_pantalla cuesta diez veces más y solo se justifica para generarla por primera vez o cuando la persona pide rehacerla. Si el cambio toca varias pantallas (por ejemplo, una flecha o un enlace que se repite), hacé un editar_pantalla por pantalla, sin volver a leer las que ya leíste en este turno.
- Los resultados largos de las herramientas (HTML, Plano completo, archivos) se sacan del historial cuando termina el turno y quedan reemplazados por una nota. Si en un turno nuevo necesitás algo de eso, volvé a pedirlo: nunca lo reconstruyas de memoria.
- La construcción: cuando todas las pantallas de una versión están aprobadas, el siguiente paso es preparar la construcción (preparar_construccion, o el botón de Plano). Eso deja en la carpeta del proyecto el contrato (AGENTS.md) y el tablero de tareas (plano/construccion.json) para que un agente de código (Claude Code u otro) construya la versión; Plano verifica lo que hace y la persona aprueba pantalla por pantalla. Vos no programás ni le explicás al agente: el contrato ya lo dice todo. Si la persona pregunta cómo va la construcción, leé el tablero con leer_construccion y contestá con eso.
- No escribís código ni propones arquitectura detallada fuera del prototipo: esto es el Plano, no la implementación.

Ids: slugs cortos en minúsculas con guiones (negocio, cliente, chat-unico, reservar-turno). Descripciones: en las palabras de la persona, una o dos frases.`;
}

// ---------- contexto para prototipar una pantalla ----------
// Todo lo que el agente necesita para hacer UNA pantalla, sacado del Plano: ni más ni menos.
export function bloquePrototipo(proyecto, pantallaId, modo, comentario) {
  const plano = leerPlano(proyecto);
  const pantalla = (plano.pantallas || []).find((p) => p.id === pantallaId);
  if (!pantalla) throw new Error(`No existe la pantalla ${pantallaId}`);
  const version = (plano.roadmap || []).find((v) => (v.pantallas || []).includes(pantallaId));
  const acciones = (plano.acciones || []).filter((a) => a.pantalla === pantallaId);
  const entIds = new Set(acciones.map((a) => a.entidad).filter(Boolean));
  const entidades = (plano.entidades || []).filter((e) => entIds.has(e.id));
  const otras = (plano.pantallas || []).filter((p) => p.id !== pantallaId && (version?.pantallas || []).includes(p.id));
  const estados = new Map((plano.prototipo || []).map((p) => [p.id, p.estado]));
  const id = plano.identidad || {};
  const L = [];
  L.push(`[Prototipo: ${modo === "revisar" ? "revisar" : "generar"} la pantalla "${pantalla.titulo}" (id: ${pantalla.id})${version ? `, de la ${version.id} · ${String(version.titulo || "").replace(/^\s*v\d+\s*[·:\-–]\s*/i, "")}` : ""}]`);
  if (modo === "revisar") L.push(`La persona la devolvió con este comentario: "${comentario || ""}". Leé el HTML actual con leer_pantalla y aplicá el cambio con editar_pantalla (buscar/reemplazar sobre los fragmentos exactos); escribir_pantalla solo si el pedido es rehacerla. No rehagas lo que no te pidieron.`);
  L.push(`Proyecto: ${id.nombre || proyecto.nombre}. ${id.que_es || ""} Para: ${id.para_quien || ""}`);
  if (version?.objetivo) L.push(`Objetivo de la versión: ${version.objetivo}`);
  L.push(`Pantalla: ${pantalla.descripcion || ""}`);
  L.push("Elementos que TIENE que tener, con el data-plano exacto de cada uno:\n" + idsElementos(pantalla).map((x) => `  - "${x.texto}" → data-plano="${pantalla.id}/${x.id}"`).join("\n"));
  L.push(`Contenedor principal: data-plano="${pantalla.id}"`);
  const estadosP = idsEstados(pantalla);
  if (estadosP.length) {
    L.push(`Estados de esta pantalla (${estadosP.length}): el selector NO va adentro del HTML, lo pone Plano en la barra de la pantalla. La página lee el estado de la URL al cargar (new URLSearchParams(location.search).get("estado")), si no viene nada muestra el primero, y el contenedor principal lleva además data-plano-estados="${estadosP.join(",")}":\n` + pantalla.estados.map((e, i) => `  - ${estadosP[i]} «${e.titulo || e}»${e.descripcion ? `: ${e.descripcion}` : ""}${i === 0 ? " (el normal, se ve si no viene ?estado=)" : ""}`).join("\n"));
  } else L.push("Esta pantalla no tiene estados registrados en el Plano. Si al hacerla ves que se tiene que ver distinta según la situación (vacía / con datos, con créditos / sin), registrá primero esos estados con actualizar_item (campo estados) y después escribila siguiendo el mecanismo de estados; nunca pongas un selector de estados adentro del HTML.");
  if (acciones.length) L.push("Acciones que pasan en esta pantalla (simulalas con datos de mentira):\n" + acciones.map((a) => `  - ${a.titulo}: ${a.descripcion || ""}${a.entidad ? ` (sobre ${a.entidad})` : ""}${a.lleva_a ? ` → lleva a "${slug(a.lleva_a)}.html": el elemento que la dispara tiene que ser un enlace a esa ruta` : ""}`).join("\n"));
  if (entidades.length) L.push("Entidades que muestra, con sus campos:\n" + entidades.map((en) => `  - ${en.titulo} (${en.id}): ${Object.entries(en.campos || {}).map(([k, v]) => k + ":" + v).join(", ")}`).join("\n"));
  L.push("Innegociables:\n" + (plano.innegociables || []).map((i) => `  - ${i.titulo}: ${i.descripcion || ""}`).join("\n"));
  const decisiones = (plano.decisiones || []).filter((d) => d.nivel === "duro");
  if (decisiones.length) L.push("Decisiones firmes del proyecto (respetalas, no las repitas):\n" + decisiones.map((d) => `  - ${d.titulo}`).join("\n"));
  if (otras.length) L.push("Otras pantallas de la misma versión, para enlazar con href relativo:\n" + otras.map((p) => `  - ${p.titulo} → "${slug(p.id)}.html" (${estados.get(p.id) || "pendiente"})`).join("\n"));
  const disp = dispositivosDe(pantalla, id);
  const recursos = recursosDeMarca(proyecto);
  if (recursos.length) L.push("Recursos de marca disponibles (usalos en vez de inventar logos o iniciales; la ruta va tal cual, relativa a la pantalla): " + recursos.map((r) => `recursos/${r}`).join(", "));
  L.push("Se usa en: " + (disp.length === 2 ? "celular (390 px) y escritorio: diseñala responsiva, mobile-first, que se vea bien en los dos" : disp[0] === "celular" ? "celular, 390 px de ancho; no hace falta que funcione en escritorio" : "escritorio; no hace falta que funcione en celular"));
  return L.join("\n\n");
}

// ---------- el loop ----------
// emitir(evento, datos) manda al cliente por SSE: "texto" (delta), "tarjeta" (cambio en el Plano), "fin", "error".
export async function responder({ proyecto, mensajes, emitir, idioma = "es", signal, modelo = null }) {
  // 4 reintentos automáticos ante 429/529/5xx y cortes de red, con espera creciente (lo hace el SDK)
  const cliente = process.env.PLANO_MOCK ? mockCliente(proyecto) : new Anthropic({ apiKey: claveApi() || undefined, maxRetries: 4 });
  const historial = [...mensajes];
  let textoTurno = "";
  const uso = { entrada: 0, salida: 0, cacheEscritura: 0, cacheLectura: 0, llamadas: 0, contexto: 0, ...tipoDeTurno(mensajes.at(-1)) };
  const model = modelo || modeloPara(uso.tipo);

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    emitir("estado", { texto: vuelta === 0 ? "Pensando…" : "Sigo pensando…" });
    const stream = cliente.messages.stream({
      model,
      max_tokens: MAX_TOKENS,
      system: [conCache({ type: "text", text: systemPrompt(proyecto, idioma) })],
      tools: TOOLS,
      messages: mensajesConCache(historial),
    }, { signal });
    let primeroDeLaVuelta = true;
    stream.on("text", (t) => {
      // si ya había texto de una vuelta anterior (antes de usar herramientas), lo nuevo va en otro párrafo
      if (primeroDeLaVuelta && textoTurno && !/\n\s*$/.test(textoTurno)) { textoTurno += "\n\n"; emitir("texto", { texto: "\n\n" }); }
      primeroDeLaVuelta = false;
      textoTurno += t; emitir("texto", { texto: t });
    });
    const mensaje = await stream.finalMessage();
    const u = mensaje.usage || {};
    uso.entrada += u.input_tokens || 0; uso.salida += u.output_tokens || 0;
    uso.cacheEscritura += u.cache_creation_input_tokens || 0; uso.cacheLectura += u.cache_read_input_tokens || 0; uso.llamadas++;
    // lo que pesó la conversación en la última llamada: todo lo que se mandó, venga de caché o no
    uso.contexto = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
    const cortado = mensaje.stop_reason === "max_tokens";
    // Si se cortó por largo, el último bloque puede ser una llamada incompleta: se descarta para no dejar basura en el historial.
    const contenido = cortado ? mensaje.content.filter((b) => b.type !== "tool_use" || esInputValido(b.input)) : mensaje.content;
    if (contenido.length) historial.push({ role: "assistant", content: contenido });

    const usos = contenido.filter((b) => b.type === "tool_use");
    // Regla de la API: todo tool_use necesita su tool_result en el mensaje siguiente. Se ejecutan SIEMPRE, aunque se haya cortado.
    if (usos.length) {
      const resultados = [];
      emitir("estado", { texto: "Anotando en el Plano…" });
      for (const uso of usos) {
        let salida;
        try {
          salida = ejecutar(proyecto, uso.name, uso.input, emitir);
        } catch (e) {
          salida = { error: e.message };
        }
        resultados.push({ type: "tool_result", tool_use_id: uso.id, content: JSON.stringify(salida) });
      }
      if (cortado) resultados.push({ type: "text", text: "(Tu respuesta se cortó por largo. Seguí desde donde quedaste, sin repetir lo que ya registraste.)" });
      historial.push({ role: "user", content: resultados });
      continue;
    }
    if (cortado) {
      // se cortó escribiendo texto, sin herramientas: que siga
      historial.push({ role: "user", content: "(Tu respuesta se cortó por largo. Seguí desde donde quedaste.)" });
      continue;
    }
    break;
  }
  // la línea [Respuestas: a | b | c] del final no se muestra como texto: son las respuestas rápidas
  const sugerencias = extraerSugerencias(textoTurno);
  return { historial, texto: sugerencias.texto, sugerencias: sugerencias.lista, uso: { ...uso, usd: costoUsd(uso, model), modelo: model, ts: Date.now() } };
}

function esInputValido(input) {
  return input && typeof input === "object" && !Array.isArray(input) && Object.keys(input).length > 0;
}

// Deja el historial en un estado que la API acepte: cada tool_use con su tool_result en el mensaje siguiente,
// y nada colgando al final. Arregla conversaciones que quedaron truncas por versiones anteriores.
export function repararHistorial(mensajes) {
  const out = [];
  let cambios = 0;
  for (let i = 0; i < mensajes.length; i++) {
    const m = mensajes[i];
    out.push(m);
    if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
    const ids = m.content.filter((b) => b.type === "tool_use").map((b) => b.id);
    if (!ids.length) continue;
    const sig = mensajes[i + 1];
    const respondidos = new Set(Array.isArray(sig?.content) ? sig.content.filter((b) => b.type === "tool_result").map((b) => b.tool_use_id) : []);
    const faltan = ids.filter((id) => !respondidos.has(id));
    if (!faltan.length) continue;
    cambios++;
    const relleno = faltan.map((id) => ({ type: "tool_result", tool_use_id: id, content: JSON.stringify({ error: "interrumpido; si hacía falta, volvé a hacerlo" }) }));
    if (sig?.role === "user" && Array.isArray(sig.content) && respondidos.size) {
      // el mensaje siguiente ya tiene algunos resultados: se completan ahí
      mensajes[i + 1] = { ...sig, content: [...relleno, ...sig.content] };
    } else {
      out.push({ role: "user", content: relleno });
    }
  }
  // el historial tiene que terminar en un turno de la persona para poder agregar el siguiente
  while (out.length && out.at(-1).role === "assistant") { out.pop(); cambios++; }
  return { mensajes: out, cambios };
}

function actualizarItemSeguro(proyecto, coleccion, id, cambios) {
  try { return actualizarItem(proyecto, coleccion, id, cambios); }
  catch { return registrarItem(proyecto, coleccion, { id, nivel: "blando", ...cambios }); }
}

export function ejecutar(proyecto, nombre, input, emitir) {
  switch (nombre) {
    case "registrar_item": {
      const item = registrarItem(proyecto, input.coleccion, input.item);
      emitir("tarjeta", { accion: "registrar", coleccion: input.coleccion, item });
      return { ok: true, coleccion: input.coleccion, id: item.id || "identidad" };
    }
    case "actualizar_item": {
      const item = actualizarItem(proyecto, input.coleccion, input.id, input.cambios);
      emitir("tarjeta", { accion: "actualizar", coleccion: input.coleccion, item });
      return { ok: true };
    }
    case "quitar_item": {
      quitarItem(proyecto, input.coleccion, input.id);
      emitir("tarjeta", { accion: "quitar", coleccion: input.coleccion, item: { id: input.id } });
      return { ok: true };
    }
    case "escribir_pantalla": {
      const pantalla = leerPlano(proyecto).pantallas.find((p) => p.id === input.pantalla);
      if (!pantalla) return { error: `no existe la pantalla ${input.pantalla} en el Plano` };
      const previo = (leerPlano(proyecto).prototipo || []).find((p) => p.id === pantalla.id);
      const motivo = previo?.estado === "devuelta" && previo.comentario ? `Corrección: ${previo.comentario}` : previo?.historial?.length ? "Corrección" : "Generación";
      const r = escribirPantallaPrototipo(proyecto, pantalla, String(input.html || ""), motivo);
      if (!r.ok) return { error: "la pantalla no pasó la verificación", errores: r.errores };
      const estado = actualizarItemSeguro(proyecto, "prototipo", pantalla.id, { estado: "generada", generada_en: new Date().toISOString(), comentario: undefined, historial: r.historial });
      emitir("tarjeta", { accion: "actualizar", coleccion: "prototipo", item: estado });
      return { ok: true, archivo: r.archivo };
    }
    case "leer_pantalla":
      return { html: leerPantallaPrototipo(proyecto, input.pantalla) };
    case "editar_pantalla": {
      const pantalla = leerPlano(proyecto).pantallas.find((p) => p.id === input.pantalla);
      if (!pantalla) return { error: `no existe la pantalla ${input.pantalla} en el Plano` };
      const actual = leerPantallaPrototipo(proyecto, pantalla.id);
      if (actual == null) return { error: "la pantalla todavía no tiene HTML: generala con escribir_pantalla" };
      const cambios = Array.isArray(input.cambios) ? input.cambios : [];
      if (!cambios.length) return { error: "no mandaste ningún cambio" };
      let html = actual;
      for (const [i, c] of cambios.entries()) {
        const buscar = String(c?.buscar ?? "");
        if (!buscar) return { error: `el cambio ${i + 1} tiene "buscar" vacío` };
        const veces = html.split(buscar).length - 1;
        if (veces !== 1) return { error: `el cambio ${i + 1} no se aplicó: "buscar" aparece ${veces} veces en el HTML actual y tiene que aparecer exactamente una. Ampliá el texto para que sea único.`, buscar: buscar.slice(0, 200) };
        html = html.replace(buscar, () => String(c?.reemplazar ?? ""));
      }
      if (html === actual) return { error: "los cambios dejan el HTML igual que estaba" };
      const previo = (leerPlano(proyecto).prototipo || []).find((p) => p.id === pantalla.id);
      const motivo = previo?.estado === "devuelta" && previo.comentario ? `Corrección: ${previo.comentario}` : "Corrección puntual";
      const r = escribirPantallaPrototipo(proyecto, pantalla, html, motivo);
      if (!r.ok) return { error: "con esos cambios la pantalla no pasa la verificación; no se guardó nada", errores: r.errores };
      const estado = actualizarItemSeguro(proyecto, "prototipo", pantalla.id, { estado: "generada", generada_en: new Date().toISOString(), comentario: undefined, historial: r.historial });
      emitir("tarjeta", { accion: "actualizar", coleccion: "prototipo", item: estado });
      return { ok: true, archivo: r.archivo, cambios: cambios.length, caracteres: html.length };
    }
    case "brief_pantalla":
      try { return { brief: bloquePrototipo(proyecto, input.pantalla, input.comentario ? "revisar" : "generar", input.comentario) }; } catch (e) { return { error: e.message }; }
    case "aprobar_pantalla": {
      const item = aprobarPantalla(proyecto, input.pantalla);
      emitir("tarjeta", { accion: "actualizar", coleccion: "prototipo", item });
      return { ok: true, estado: item?.estado };
    }
    case "devolver_pantalla": {
      const item = devolverPantalla(proyecto, input.pantalla, input.comentario);
      emitir("tarjeta", { accion: "actualizar", coleccion: "prototipo", item });
      return { ok: true };
    }
    case "iniciar_prototipo": {
      const plano = leerPlano(proyecto);
      const v = (plano.roadmap || []).find((x) => x.id === input.version);
      if (!v) return { error: `no existe la versión ${input.version}` };
      iniciarPrototipo(proyecto, v);
      for (const item of leerPlano(proyecto).prototipo || []) emitir("tarjeta", { accion: "actualizar", coleccion: "prototipo", item });
      return { ok: true, pantallas: v.pantallas?.length || 0 };
    }
    case "revisar_version":
      return revisarVersion(leerPlano(proyecto), input.version, (id) => leerPantallaPrototipo(proyecto, id));
    case "preparar_construccion": {
      try {
        const tablero = prepararConstruccion(proyecto, input.version);
        emitir("tarjeta", { accion: "construccion", version: tablero.version });
        return { ok: true, version: tablero.version, carpeta_app: tablero.carpeta_app, tareas: tablero.tareas.map((t) => ({ id: t.id, tipo: t.tipo, titulo: t.titulo, depende_de: t.depende_de })), archivos: ["AGENTS.md", "CLAUDE.md", "plano/construccion.json", `${tablero.carpeta_app}/AGENTS.md`] };
      } catch (e) { return { error: e.message }; }
    }
    case "leer_construccion": {
      const tablero = leerConstruccion(proyecto);
      if (!tablero) return { construccion: null };
      return { version: tablero.version, carpeta_app: tablero.carpeta_app, url_dev: tablero.url_dev, resumen: resumenConstruccion(tablero), tareas: tablero.tareas.map((t) => ({ id: t.id, tipo: t.tipo, titulo: t.titulo, estado: t.estado, comentario: t.comentario, notas: t.notas, archivos: t.archivos })) };
    }
    case "listar_archivos":
      return listarArchivos(proyecto, input.ruta || "", input.profundidad || 2);
    case "leer_archivo":
      return leerArchivo(proyecto, input.ruta || "");
    case "niveles_entidades":
      return { niveles: nivelesEntidades(leerPlano(proyecto).entidades || []) };
    case "leer_plano": {
      const plano = leerPlano(proyecto);
      if (input?.completo) return plano;
      if (input?.coleccion) {
        const lista = plano[input.coleccion];
        if (input.coleccion === "identidad" || !Array.isArray(lista)) return { [input.coleccion]: lista };
        const ids = Array.isArray(input.ids) && input.ids.length ? new Set(input.ids) : null;
        return { [input.coleccion]: ids ? lista.filter((x) => ids.has(x.id)) : lista };
      }
      // el índice: lo justo para ubicarse y pedir detalle de lo que haga falta
      const corto = (x) => ({ id: x.id, titulo: x.titulo, nivel: x.nivel, ...(x.pantalla ? { pantalla: x.pantalla } : {}), ...(x.entidad ? { entidad: x.entidad } : {}), ...(x.lleva_a ? { lleva_a: x.lleva_a } : {}), ...(x.espacio ? { espacio: x.espacio } : {}), ...(x.estado ? { estado: x.estado } : {}) });
      const indice = { identidad: plano.identidad };
      for (const c of ["decisiones", "entidades", "pantallas", "acciones", "integraciones", "innegociables", "preguntas", "prototipo"]) indice[c] = (plano[c] || []).map(corto);
      indice.roadmap = (plano.roadmap || []).map((v) => ({ id: v.id, titulo: v.titulo, orden: v.orden, objetivo: v.objetivo, construida: v.construida || false, pantallas: v.pantallas || [], entidades: v.entidades || [], acciones: v.acciones || [], integraciones: v.integraciones || [] }));
      indice.nota = "Esto es el índice. Para el detalle de algo: leer_plano({ coleccion, ids }).";
      return indice;
    }
    default:
      return { error: `herramienta desconocida: ${nombre}` };
  }
}

// ---------- modo simulado, para probar la plomería sin gastar un token ----------
function mockCliente(proyecto) {
  let turno = 0;
  return {
    messages: {
      stream(params, opciones = {}) {
        const signal = opciones.signal;
        const ultimo = { ...params.messages.at(-1) };
        if (Array.isArray(ultimo.content) && ultimo.content.every((b) => b.type === "text")) ultimo.content = ultimo.content.map((b) => b.text).join("");
        const esResultado = Array.isArray(ultimo.content) && ultimo.content[0]?.type === "tool_result";
        const handlers = {};
        const api = {
          on(ev, fn) { handlers[ev] = fn; return api; },
          async finalMessage() {
            const m = await new Promise((res, rej) => {
              signal?.addEventListener("abort", () => rej(Object.assign(new Error("Request was aborted."), { name: "APIUserAbortError" })), { once: true });
              this.finalMensaje().then(res, rej);
            });
            return { usage: { input_tokens: 900 + turno * 40, output_tokens: 180, cache_creation_input_tokens: 2000, cache_read_input_tokens: 6000 + turno * 500 }, ...m };
          },
          async finalMensaje() {
            await new Promise((r) => setTimeout(r, 150));
            // en el simulador, un mensaje que diga FALLAR simula una API saturada; COLGAR, una conexión muerta
            if (typeof ultimo.content === "string" && /FALLAR/.test(ultimo.content)) { const err = new Error("Overloaded"); err.status = 529; throw err; }
            if (typeof ultimo.content === "string" && /COLGAR/.test(ultimo.content)) await new Promise(() => {});
            // [Prototipo: …] en el simulador: una pantalla mínima con todos los data-plano pedidos
            const mp = typeof ultimo.content === "string" && ultimo.content.match(/\[Prototipo: (generar|revisar) la pantalla "([^"]+)" \(id: ([^)]+)\)/);
            if (mp) {
              await new Promise((r) => setTimeout(r, Number(process.env.PLANO_MOCK_DEMORA || 0)));
              const idp = mp[3];
              const ids = [...ultimo.content.matchAll(/data-plano="([^"]+\/[^"]+)"/g)].map((m) => m[1]);
              const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${idp}</title><style>body{margin:0;background:#000;color:#fff;font-family:Inter,system-ui,sans-serif;padding:20px}.el{border:1px solid #a855f7;border-radius:10px;padding:12px;margin:10px 0}</style></head><body><main data-plano="${idp}"><h1>${idp} (simulado)</h1>${ids.map((i) => `<div class="el" data-plano="${i}">${i.split("/")[1]}</div>`).join("")}</main></body></html>`;
              const texto = `(simulado) Hice la pantalla ${idp} con ${ids.length} elementos. `;
              handlers.text?.(texto);
              return { stop_reason: "tool_use", content: [{ type: "text", text: texto }, { type: "tool_use", id: "mock-pant-" + Date.now(), name: "escribir_pantalla", input: { pantalla: idp, html } }] };
            }
            // CORTAR simula una respuesta cortada por max_tokens a mitad de las llamadas (una válida, una trunca)
            if (typeof ultimo.content === "string" && /CORTAR/.test(ultimo.content)) {
              handlers.text?.("(simulado) registro varias cosas… ");
              return { stop_reason: "max_tokens", content: [
                { type: "text", text: "(simulado) registro varias cosas… " },
                { type: "tool_use", id: "mock-ok", name: "registrar_item", input: { coleccion: "entidades", item: { id: "cortada-ok", titulo: "Llegó entera", nivel: "duro" } } },
                { type: "tool_use", id: "mock-trunco", name: "registrar_item", input: {} },
              ] };
            }
            if (esResultado) {
              const txt = " Registrado. ¿Es una web o una app para el celular?\n\n[Respuestas: Es una web | Es una app para el celular | Las dos]";
              for (const ch of txt.split(" ")) { handlers.text?.(ch + " "); await new Promise((r) => setTimeout(r, 20)); }
              return { stop_reason: "end_turn", content: [{ type: "text", text: txt }] };
            }
            turno = params.messages.filter((m) => m.role === "user" && typeof m.content === "string").length;
            const texto = `(simulado) Entendido: "${String(ultimo.content).slice(0, 60)}".`;
            for (const ch of texto.split(" ")) { handlers.text?.(ch + " "); await new Promise((r) => setTimeout(r, 20)); }
            return {
              stop_reason: "tool_use",
              content: [
                { type: "text", text: texto },
                { type: "tool_use", id: "mock-" + turno, name: "registrar_item", input: { coleccion: turno === 1 ? "identidad" : "entidades", item: turno === 1 ? { nombre: proyecto.nombre, que_es: String(ultimo.content).slice(0, 120), nivel: "duro" } : { id: "entidad-" + turno, titulo: "Entidad " + turno, descripcion: "Salida del simulador", nivel: turno % 2 ? "duro" : "supuesto", campos: { nombre: "string" } } } },
              ],
            };
          },
        };
        return api;
      },
    },
  };
}
