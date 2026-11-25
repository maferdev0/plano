#!/usr/bin/env node
// Hook de Claude Code. Es el "capataz": lo que el agente NO PUEDE hacer, aunque quiera.
//   pre  → antes de Edit/Write/MultiEdit/Bash: bloquea tocar cimientos
//   post → después: corre el verificador y le devuelve los errores al agente
//   stop → al terminar: no deja terminar con el Plano roto

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const modo = process.argv[2];
let entrada = {};
try { entrada = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch {}

const ROOT = process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd();
process.env.PLANO_ROOT = ROOT;
const { verificar, leerEntidades, huella } = await import(pathToFileURL(join(ROOT, "herramientas", "plano.mjs")).href);

const norm = (p) => (p || "").replace(/\\/g, "/");
const bloquear = (razon) => {
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "PLANO: " + razon },
  }));
  process.exit(0);
};

// ---------- PRE ----------
if (modo === "pre") {
  const tool = entrada.tool_name;
  const ti = entrada.tool_input || {};

  if (tool === "Bash") {
    const cmd = ti.command || "";
    // Siempre: aprobar, firmar e instalar son de Martín.
    if (/plano\.mjs\s+(aprobar|firmar|instalar)\b/i.test(cmd))
      bloquear("aprobar, firmar e instalar son comandos de Martín. Dejá la propuesta en plano/entidades.json y avisale.");
    // Leer los cimientos está bien (cat, grep, type...). Escribirlos, no.
    const tocaCimientos = /schema\.ts|firmas\.json|\.claude[\/\\]|plano-hook\.mjs|herramientas[\/\\]plano\.mjs/i.test(cmd);
    const escribe = /(^|[^<])>|>>|\bsed\s+-i|\btee\b|\b(mv|cp|rm|del|erase|ren|move|copy)\s|\b(Set-Content|Out-File|Add-Content|Remove-Item|Move-Item|Copy-Item|Rename-Item)\b|writeFile|\bnode\s+-e\b|\bpython3?\b|\bperl\b|\btruncate\b|\bchmod\b|\bgit\s+checkout\b/i.test(cmd);
    if (tocaCimientos && escribe)
      bloquear("ese comando escribiría sobre cimientos (schema.ts, firmas, hooks o scripts del Plano). Leerlos está bien; para cambiar el esquema, proponé en plano/entidades.json y esperá a Martín.");
    process.exit(0);
  }

  const archivo = norm(ti.file_path);
  if (/\/convex\/schema\.ts$/.test(archivo) || /^convex\/schema\.ts$/.test(archivo))
    bloquear("convex/schema.ts se genera desde plano/entidades.json y no se edita a mano. Si necesitás una entidad nueva, agregala en plano/entidades.json con nivel \"propuesto\" y corré `node herramientas/plano.mjs generate`. No existirá hasta que Martín la apruebe.");
  if (/plano\/firmas\.json$/.test(archivo))
    bloquear("plano/firmas.json solo lo escribe Martín.");
  if (/\/\.claude\//.test(archivo) || /herramientas\/plano(-hook)?\.mjs$/.test(archivo) || /^\.claude\//.test(archivo))
    bloquear("los hooks y herramientas del Plano no se modifican desde una sesión de agente.");

  if (/plano\/entidades\.json$/.test(archivo)) {
    const ruta = join(ROOT, "plano", "entidades.json");
    const actualTexto = existsSync(ruta) ? readFileSync(ruta, "utf8") : '{"entidades":[]}';
    let nuevoTexto;
    if (tool === "Write") nuevoTexto = ti.content ?? "";
    else if (tool === "Edit") {
      if (!actualTexto.includes(ti.old_string)) bloquear("old_string no aparece en plano/entidades.json.");
      nuevoTexto = ti.replace_all ? actualTexto.split(ti.old_string).join(ti.new_string) : actualTexto.replace(ti.old_string, ti.new_string);
    } else if (tool === "MultiEdit") {
      nuevoTexto = actualTexto;
      for (const e of ti.edits || []) nuevoTexto = e.replace_all ? nuevoTexto.split(e.old_string).join(e.new_string) : nuevoTexto.replace(e.old_string, e.new_string);
    } else process.exit(0);

    let actual, nuevo;
    try { actual = leerEntidades(actualTexto); } catch { actual = []; }
    try { nuevo = leerEntidades(nuevoTexto); } catch (e) { bloquear(`plano/entidades.json quedaría inválido: ${e.message}`); }
    const nuevoPorId = new Map(nuevo.map((e) => [e.id, e]));
    const actualPorId = new Map(actual.map((e) => [e.id, e]));
    for (const e of actual) {
      const n = nuevoPorId.get(e.id);
      if (e.nivel === "duro") {
        if (!n) bloquear(`la entidad "${e.id}" es dura y no se puede borrar sin la firma de Martín.`);
        if (n.nivel !== "duro" || huella(n) !== huella(e)) bloquear(`la entidad "${e.id}" es dura: solo Martín puede cambiarla. Si necesitás algo distinto, proponé una entidad nueva con nivel "propuesto" y explicá por qué en su descripción.`);
      }
      if (n && e.nivel === "propuesto" && n.nivel !== "propuesto") bloquear(`la entidad "${e.id}" está propuesta; solo Martín la aprueba (node herramientas/plano.mjs aprobar ${e.id}).`);
    }
    for (const n of nuevo) {
      if (!actualPorId.has(n.id) && n.nivel !== "propuesto") bloquear(`la entidad nueva "${n.id}" tiene que entrar con nivel "propuesto", no "${n.nivel}".`);
    }
  }
  process.exit(0);
}

// ---------- POST ----------
if (modo === "post") {
  const errores = verificar();
  if (errores.length) {
    console.error("PLANO: el código no respeta el Plano. Arreglalo antes de seguir:\n" + errores.map((e) => "  - " + e).join("\n"));
    process.exit(2);
  }
  process.exit(0);
}

// ---------- STOP ----------
if (modo === "stop") {
  if (entrada.stop_hook_active) process.exit(0);
  const errores = verificar();
  if (errores.length) {
    console.log(JSON.stringify({ decision: "block", reason: "PLANO: no podés terminar con el Plano roto:\n" + errores.map((e) => "  - " + e).join("\n") + "\nSi necesitás una entidad nueva, dejala como \"propuesto\" y no la uses en el código todavía." }));
    process.exit(0);
  }
  process.exit(0);
}

process.exit(0);
