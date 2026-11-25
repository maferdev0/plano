#!/usr/bin/env node
// Plano — herramientas mínimas del experimento 1.
//   node herramientas/plano.mjs generate      → escribe convex/schema.ts desde plano/entidades.json
//   node herramientas/plano.mjs verify        → chequea que el código respete el Plano (sale con 1 si no)
//   node herramientas/plano.mjs aprobar <id>  → (solo Martín) pasa una entidad propuesta a dura y la firma
//   node herramientas/plano.mjs firmar        → (solo Martín) firma todas las entidades duras
//   node herramientas/plano.mjs instalar      → (solo Martín) escribe .claude/settings.json con los hooks

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";

export const ROOT = process.env.PLANO_ROOT || process.cwd();
const P = (...x) => join(ROOT, ...x);

const NIVELES = new Set(["duro", "blando", "supuesto", "propuesto"]);

// ---------- lectura ----------
export function leerEntidades(texto) {
  const json = texto !== undefined ? JSON.parse(texto) : JSON.parse(readFileSync(P("plano/entidades.json"), "utf8"));
  if (!json || !Array.isArray(json.entidades)) throw new Error("plano/entidades.json: falta el array `entidades`");
  for (const e of json.entidades) {
    if (!e.id) throw new Error("entidad sin id");
    if (!NIVELES.has(e.nivel)) throw new Error(`entidad ${e.id}: nivel inválido "${e.nivel}" (duro|blando|propuesto)`);
    if (!e.tabla) e.tabla = e.id.endsWith("s") ? e.id : e.id + "s";
    if (!e.campos || typeof e.campos !== "object") e.campos = {};
  }
  return json.entidades;
}

export function leerFirmas() {
  if (!existsSync(P("plano/firmas.json"))) return { duro: {} };
  return JSON.parse(readFileSync(P("plano/firmas.json"), "utf8"));
}

// Hash canónico de una entidad: lo que se firma.
export function huella(e) {
  const canon = JSON.stringify({ id: e.id, tabla: e.tabla, campos: e.campos, indices: e.indices || [] });
  return createHash("sha256").update(canon).digest("hex").slice(0, 16);
}

// ---------- generador ----------
function tipoConvex(t, porId) {
  let opcional = false;
  if (t.endsWith("?")) { opcional = true; t = t.slice(0, -1); }
  let v;
  if (t === "string") v = "v.string()";
  else if (t === "number") v = "v.number()";
  else if (t === "boolean") v = "v.boolean()";
  else if (t.startsWith("id:")) {
    const ref = porId.get(t.slice(3));
    if (!ref) throw new Error(`referencia a entidad inexistente: ${t}`);
    if (ref.nivel === "propuesto") throw new Error(`referencia a entidad propuesta (no aprobada): ${t}`);
    v = `v.id("${ref.tabla}")`;
  } else throw new Error(`tipo desconocido: ${t}`);
  return opcional ? `v.optional(${v})` : v;
}

export function generarSchema(entidades) {
  const porId = new Map(entidades.map((e) => [e.id, e]));
  const activas = entidades.filter((e) => e.nivel !== "propuesto");
  const lineas = [];
  lineas.push("// GENERADO POR PLANO desde plano/entidades.json — NO EDITAR A MANO.");
  lineas.push("// Para cambiar el esquema: proponé la entidad en plano/entidades.json (nivel: propuesto)");
  lineas.push("// y esperá la aprobación de Martín. Luego: node herramientas/plano.mjs generate");
  lineas.push('import { defineSchema, defineTable } from "convex/server";');
  lineas.push('import { v } from "convex/values";');
  lineas.push("");
  lineas.push("export default defineSchema({");
  for (const e of activas) {
    lineas.push(`  // [${e.nivel}] ${e.id}: ${e.descripcion || ""}`.trimEnd());
    lineas.push(`  ${e.tabla}: defineTable({`);
    for (const [campo, tipo] of Object.entries(e.campos)) lineas.push(`    ${campo}: ${tipoConvex(tipo, porId)},`);
    let cierre = "  })";
    for (const idx of e.indices || []) cierre += `\n    .index("by_${idx.join("_")}", ${JSON.stringify(idx)})`;
    lineas.push(cierre + ",");
  }
  lineas.push("});");
  // Las propuestas viven solo en el Plano: no ensucian el esquema.
  return lineas.join("\n") + "\n";
}

// ---------- verificador ----------
function archivosTs(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    const st = statSync(ruta);
    if (st.isDirectory()) { if (nombre !== "_generated" && nombre !== "node_modules") archivosTs(ruta, acc); }
    else if (/\.(ts|tsx|js|mjs)$/.test(nombre) && nombre !== "schema.ts") acc.push(ruta);
  }
  return acc;
}

export function verificar() {
  const errores = [];
  let entidades;
  try { entidades = leerEntidades(); } catch (e) { return [`plano/entidades.json inválido: ${e.message}`]; }

  // 1. firmas: todo lo duro está firmado y no cambió; nada firmado desapareció
  const firmas = leerFirmas();
  const porId = new Map(entidades.map((e) => [e.id, e]));
  for (const e of entidades) {
    if (e.nivel !== "duro") continue;
    const f = firmas.duro[e.id];
    if (!f) errores.push(`entidad dura sin firma de Martín: ${e.id} (solo Martín puede correr "aprobar"/"firmar")`);
    else if (f !== huella(e)) errores.push(`entidad dura modificada sin firma: ${e.id}`);
  }
  for (const id of Object.keys(firmas.duro)) {
    if (!porId.has(id)) errores.push(`entidad dura borrada del Plano: ${id}`);
    else if (porId.get(id).nivel !== "duro") errores.push(`entidad ${id} bajó de nivel duro sin firma`);
  }

  // 2. schema.ts es exactamente lo generado
  let esperado;
  try { esperado = generarSchema(entidades); } catch (e) { errores.push(`no se puede generar el esquema: ${e.message}`); }
  const rutaSchema = P("convex/schema.ts");
  if (esperado) {
    if (!existsSync(rutaSchema)) errores.push("falta convex/schema.ts (corré: node herramientas/plano.mjs generate)");
    else if (readFileSync(rutaSchema, "utf8").replace(/\r\n/g, "\n") !== esperado) errores.push("convex/schema.ts no coincide con el Plano (fue editado a mano o falta regenerar)");
  }

  // 3. mundo cerrado: el código solo usa tablas aprobadas
  const tablasOk = new Set(entidades.filter((e) => e.nivel !== "propuesto").map((e) => e.tabla));
  const re = /\b(?:db\.(?:insert|query)|v\.id)\(\s*["'`]([A-Za-z_][\w]*)["'`]/g;
  for (const archivo of archivosTs(P("convex"))) {
    const src = readFileSync(archivo, "utf8");
    let m;
    while ((m = re.exec(src))) {
      if (!tablasOk.has(m[1])) errores.push(`${relative(ROOT, archivo).split(sep).join("/")}: usa la tabla "${m[1]}", que no está aprobada en el Plano`);
    }
    if (/defineTable\s*\(/.test(src)) errores.push(`${relative(ROOT, archivo).split(sep).join("/")}: define tablas fuera de schema.ts`);
  }
  return errores;
}

// ---------- comandos ----------
function cmdGenerate() {
  writeFileSync(P("convex/schema.ts"), generarSchema(leerEntidades()));
  console.log("convex/schema.ts generado desde el Plano.");
}
function cmdVerify() {
  const errores = verificar();
  if (errores.length) {
    console.error("PLANO: el código no respeta el Plano:\n" + errores.map((e) => "  - " + e).join("\n"));
    process.exit(1);
  }
  console.log("PLANO: todo en orden.");
}
function cmdAprobar(id) {
  if (process.env.PLANO_AGENTE) { console.error("Solo Martín aprueba entidades."); process.exit(1); }
  const json = JSON.parse(readFileSync(P("plano/entidades.json"), "utf8"));
  const e = json.entidades.find((x) => x.id === id);
  if (!e) { console.error(`no existe la entidad ${id}`); process.exit(1); }
  e.nivel = "duro";
  writeFileSync(P("plano/entidades.json"), JSON.stringify(json, null, 2) + "\n");
  const firmas = leerFirmas();
  firmas.duro[id] = huella(e);
  writeFileSync(P("plano/firmas.json"), JSON.stringify(firmas, null, 2) + "\n");
  cmdGenerate();
  console.log(`Entidad ${id} aprobada y firmada.`);
}
function cmdFirmar() {
  if (process.env.PLANO_AGENTE) { console.error("Solo Martín firma."); process.exit(1); }
  const entidades = leerEntidades();
  const firmas = { duro: {} };
  for (const e of entidades) if (e.nivel === "duro") firmas.duro[e.id] = huella(e);
  writeFileSync(P("plano/firmas.json"), JSON.stringify(firmas, null, 2) + "\n");
  console.log(`Firmadas ${Object.keys(firmas.duro).length} entidades duras.`);
}

function cmdInstalar() {
  if (process.env.PLANO_AGENTE) { console.error("Solo Martín instala los hooks."); process.exit(1); }
  const dir = P(".claude");
  mkdirSync(dir, { recursive: true });
  const ruta = join(dir, "settings.json");
  const hook = (modo) => ({ type: "command", command: `node "\${CLAUDE_PROJECT_DIR}/herramientas/plano-hook.mjs" ${modo}` });
  const actual = existsSync(ruta) ? JSON.parse(readFileSync(ruta, "utf8")) : {};
  actual.hooks = {
    ...(actual.hooks || {}),
    PreToolUse: [{ matcher: "Edit|Write|MultiEdit|Bash", hooks: [hook("pre")] }],
    PostToolUse: [{ matcher: "Edit|Write|MultiEdit|Bash", hooks: [hook("post")] }],
    Stop: [{ hooks: [hook("stop")] }],
  };
  writeFileSync(ruta, JSON.stringify(actual, null, 2) + "\n");
  console.log(`Hooks del Plano instalados en ${relative(ROOT, ruta)}.`);
}
const esPrincipal = process.argv[1] && /plano\.mjs$/.test(process.argv[1]);
if (esPrincipal) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "generate") cmdGenerate();
  else if (cmd === "verify") cmdVerify();
  else if (cmd === "aprobar") cmdAprobar(arg);
  else if (cmd === "firmar") cmdFirmar();
  else if (cmd === "instalar") cmdInstalar();
  else { console.error("uso: plano.mjs generate|verify|aprobar <id>|firmar|instalar"); process.exit(1); }
}
