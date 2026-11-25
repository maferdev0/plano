// Configuración de Plano: la clave de API, el nombre de la persona, los modelos y el umbral de compactación.
// Vive en data/config.json (nunca en una base de datos). Lo que no esté ahí se toma de las variables de entorno (.env),
// así los que ya venían con .env no tienen que tocar nada; y lo que no esté en ningún lado tiene un valor por defecto.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATA = process.env.PLANO_DATA ? resolve(process.env.PLANO_DATA) : join(RAIZ, "data");
const RUTA = join(DATA, "config.json");

export const VERSION = (() => { try { return JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8")).version || "0.0.0"; } catch { return "0.0.0"; } })();

export const MODELOS = {
  "claude-opus-5-5": { nombre: "Claude Opus 5.5", nota: "el de más criterio; para la entrevista y el roadmap" },
  "claude-sonnet-5-5": { nombre: "Claude Sonnet 5.5", nota: "la mitad de precio; sobra para generar y corregir pantallas" },
  "claude-opus-5": { nombre: "Claude Opus 5", nota: "la generación anterior" },
};

const POR_DEFECTO = { usuario: "", claveApi: "", modelo: "claude-opus-5-5", modeloPrototipo: "claude-sonnet-5-5", compactar: 40000 };
const CLAVES = Object.keys(POR_DEFECTO);

let archivo = null; // lo que hay en data/config.json, cargado una vez y actualizado al guardar
function leerArchivo() {
  if (archivo) return archivo;
  try { archivo = existsSync(RUTA) ? JSON.parse(readFileSync(RUTA, "utf8")) : {}; } catch { archivo = {}; }
  return archivo;
}

// La configuración vigente: archivo → variables de entorno → por defecto.
export function leerConfig() {
  const a = leerArchivo();
  const env = {
    usuario: process.env.PLANO_USUARIO,
    claveApi: process.env.ANTHROPIC_API_KEY,
    modelo: process.env.PLANO_MODELO,
    modeloPrototipo: process.env.PLANO_MODELO_PROTOTIPO,
    compactar: process.env.PLANO_COMPACTAR ? Number(process.env.PLANO_COMPACTAR) : undefined,
  };
  const c = {};
  for (const k of CLAVES) c[k] = a[k] !== undefined && a[k] !== "" ? a[k] : env[k] !== undefined && env[k] !== "" ? env[k] : POR_DEFECTO[k];
  c.compactar = Math.max(10000, Number(c.compactar) || POR_DEFECTO.compactar);
  c.origenClave = a.claveApi ? "config" : env.claveApi ? "env" : null;
  return c;
}

export const claveApi = () => leerConfig().claveApi || "";
export const usuario = () => leerConfig().usuario || "vos";
export const modeloEntrevista = () => leerConfig().modelo;
export const modeloPrototipo = () => leerConfig().modeloPrototipo;
export const umbralCompactar = () => leerConfig().compactar;

// Guarda solo lo que vino, validado. Una clave vacía no borra la que había: para borrarla se manda borrarClave: true.
export function guardarConfig(cambios = {}) {
  const a = { ...leerArchivo() };
  if (typeof cambios.usuario === "string") a.usuario = cambios.usuario.trim().slice(0, 60);
  if (typeof cambios.claveApi === "string" && cambios.claveApi.trim()) {
    const k = cambios.claveApi.trim();
    if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k)) throw new Error("Esa clave no tiene la forma de una clave de API de Anthropic (empieza con sk-ant-).");
    a.claveApi = k;
  }
  if (cambios.borrarClave) delete a.claveApi;
  for (const k of ["modelo", "modeloPrototipo"]) if (typeof cambios[k] === "string" && cambios[k].trim()) {
    if (!/^claude-[a-z0-9.-]+$/.test(cambios[k].trim())) throw new Error(`"${cambios[k]}" no parece un nombre de modelo de Claude.`);
    a[k] = cambios[k].trim();
  }
  if (cambios.compactar !== undefined) {
    const n = Number(cambios.compactar);
    if (!Number.isFinite(n) || n < 10000 || n > 400000) throw new Error("El umbral de compactación va entre 10.000 y 400.000 tokens.");
    a.compactar = Math.round(n);
  }
  mkdirSync(DATA, { recursive: true });
  writeFileSync(RUTA, JSON.stringify(a, null, 2) + "\n");
  archivo = a;
  return configPublica();
}

// Lo que ve la interfaz: nunca la clave entera.
export function configPublica() {
  const c = leerConfig();
  const simulado = Boolean(process.env.PLANO_MOCK);
  return {
    usuario: usuario(),
    modelo: c.modelo,
    modeloPrototipo: c.modeloPrototipo,
    compactar: c.compactar,
    claveConfigurada: Boolean(c.claveApi) || simulado,
    claveFinal: c.claveApi ? c.claveApi.slice(-4) : null,
    origenClave: c.origenClave,
    simulado,
    version: VERSION,
    modelos: MODELOS,
    rutaConfig: RUTA,
  };
}
