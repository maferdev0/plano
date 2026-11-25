// Construcción: cuando una versión tiene todas sus pantallas aprobadas, Plano deja en la carpeta del proyecto todo lo que
// un agente de código (Claude Code, Codex, el que sea) necesita para construirla sin saber que Plano existe:
//   - AGENTS.md (y CLAUDE.md, que solo apunta ahí): el contrato, derivado del Plano.
//   - plano/construccion.json: el tablero de tareas, derivado mecánicamente de la versión. El agente marca ahí lo que hace.
// Plano mira ese archivo, verifica lo que se puede verificar a máquina, y le muestra a la persona solo lo que tiene que mirar.
// Nada de esto usa IA: es determinista, gratis y reproducible.

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, watch, readdirSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { spawn } from "node:child_process";
import { leerPlano, actualizarItem, nivelesEntidades, idsElementos, idsEstados, slug, dispositivosDe, tipoApp } from "./plano-store.mjs";

const rutaTablero = (proyecto) => join(proyecto.carpeta, "plano", "construccion.json");
const leerJson = (ruta, porDefecto) => { try { return JSON.parse(readFileSync(ruta, "utf8")); } catch { return porDefecto; } };
const escribirJson = (ruta, datos) => writeFileSync(ruta, JSON.stringify(datos, null, 2) + "\n");

export const ESTADOS_TAREA = ["pendiente", "en_curso", "hecha", "verificando", "aprobada", "devuelta"];

// ---------- dónde vive la app ----------
// La carpeta del proyecto tiene plano/ y prototipo/ (de Plano) y la app en otra carpeta. Si ya hay una (web/, app/, src/…) se usa esa.
export function carpetaApp(proyecto, tablero) {
  if (tablero?.carpeta_app) return tablero.carpeta_app;
  const candidatas = ["web", "app", "frontend", "src", "."];
  for (const c of candidatas) {
    const ruta = join(proyecto.carpeta, c);
    if (c === "." ? existsSync(join(ruta, "package.json")) : existsSync(ruta) && statSync(ruta).isDirectory()) return c;
  }
  return "web";
}

// ---------- comandos por stack ----------
// Las tareas no dicen "npm run build": dicen qué hay que comprobar (instalar, tipos, build, test) y Plano resuelve el comando
// mirando qué hay en la carpeta de la app. Así el mismo tablero sirve para Node, Flutter, Rust, .NET o Python.
export function resolverComando(que, cwd) {
  const hay = (f) => existsSync(join(cwd, f));
  const pkg = hay("package.json") ? leerJson(join(cwd, "package.json"), {}) : null;
  const script = (n) => Boolean(pkg?.scripts?.[n]);
  if (pkg) {
    if (que === "instalar") return "npm install";
    if (que === "tipos") return hay("tsconfig.json") ? "npx tsc --noEmit" : null;
    if (que === "build") return script("build") ? "npm run build" : null;
    if (que === "test") return script("test") && !/no test specified/.test(pkg.scripts.test) ? "npm test" : null;
  }
  if (hay("pubspec.yaml")) return { instalar: "flutter pub get", tipos: "flutter analyze", build: null, test: hay("test") ? "flutter test" : null }[que] ?? null;
  if (hay("Cargo.toml")) return { instalar: "cargo fetch", tipos: "cargo check", build: "cargo build", test: "cargo test" }[que] ?? null;
  if (hay("pyproject.toml") || hay("requirements.txt")) return { instalar: hay("requirements.txt") ? "pip install -r requirements.txt" : "pip install -e .", tipos: null, build: null, test: hay("tests") || hay("test") ? "python -m pytest -q" : null }[que] ?? null;
  const csproj = (() => { try { return readdirSync(cwd).some((f) => /\.(csproj|sln)$/.test(f)); } catch { return false; } })();
  if (csproj) return { instalar: "dotnet restore", tipos: "dotnet build --no-restore", build: "dotnet build", test: "dotnet test" }[que] ?? null;
  return null;
}

// Las marcas del Plano en el código: en web es el atributo data-plano del HTML; en escritorio y móvil es el identificador de
// accesibilidad o de test del elemento (testID, Semantics identifier, AutomationId...). En ambos casos el valor es el id exacto.
const IGNORAR_CARPETAS = new Set(["node_modules", ".git", "dist", "build", ".next", ".expo", "android", "ios", "target", "bin", "obj", ".dart_tool", "coverage", ".cache", "plano", "prototipo"]);
const EXT_CODIGO = /\.(tsx?|jsx?|mjs|cjs|vue|svelte|dart|rs|swift|kt|kts|java|cs|xaml|axaml|py|html|qml)$/;
export function buscarMarcas(cwd, ids) {
  const faltan = new Set(ids);
  const pila = [cwd];
  let archivos = 0;
  while (pila.length && faltan.size && archivos < 4000) {
    const dir = pila.pop();
    let entradas = []; try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entradas) {
      if (e.isDirectory()) { if (!IGNORAR_CARPETAS.has(e.name) && !e.name.startsWith(".")) pila.push(join(dir, e.name)); continue; }
      if (!EXT_CODIGO.test(e.name)) continue;
      archivos++;
      let texto; try { texto = readFileSync(join(dir, e.name), "utf8"); } catch { continue; }
      for (const id of [...faltan]) if (texto.includes(`"${id}"`) || texto.includes(`'${id}'`) || texto.includes(`\`${id}\``)) faltan.delete(id);
    }
  }
  return { faltan: [...faltan], archivos };
}

// ---------- derivación del tablero ----------
const limpiarTitulo = (t) => String(t || "").replace(/^\s*v\d+\s*[·:\-–]\s*/i, "");

export function derivarTareas(plano, versionId, opciones = {}) {
  const versiones = [...(plano.roadmap || [])].sort((a, b) => (a.orden || 99) - (b.orden || 99));
  const v = versiones.find((x) => x.id === versionId);
  if (!v) throw new Error(`No existe la versión ${versionId}`);
  const idx = versiones.indexOf(v);
  const anteriores = versiones.slice(0, idx);
  const yaHecho = (t, id) => anteriores.some((a) => (a[t] || []).includes(id)); // lo que entró en versiones anteriores ya está construido
  const buscar = (t, id) => (plano[t] || []).find((x) => x.id === id);
  const id = plano.identidad || {};
  const tipo = tipoApp(plano);
  const esWeb = tipo === "web";
  const T = [];
  const tarea = (t) => { T.push({ estado: "pendiente", depende_de: [], ...t, orden: T.length + 1 }); return t.id; };

  // 1. Cimientos: solo en la primera versión que se construye
  const esPrimera = idx === 0 || !anteriores.some((a) => a.construida);
  let cimientos = null;
  if (esPrimera) {
    cimientos = tarea({
      id: "cimientos", tipo: "cimientos", titulo: "Proyecto base",
      descripcion: [
        `Crear la aplicación ${TIPO_TEXTO[tipo]} en la carpeta de la app con el stack del proyecto: ${id.stack || "(el stack está en plano/identidad.json)"}.`,
        "Si ya hay archivos de configuración (.env, .env.local) en esa carpeta, la app los usa tal cual: no se crean, no se editan, no se imprimen.",
        "Armar la base visual a partir del prototipo: tipografía, colores, fondo, radios y espaciados salen de los archivos prototipo/*.html (están en el CSS de cada uno), no se inventan. Un layout raíz, estilos globales y los componentes mínimos compartidos (botón, campo, tarjeta) para que las pantallas se vean iguales al prototipo.",
        ...(plano.innegociables || []).filter((i) => i.nivel !== "propuesto").map((i) => `Innegociable: ${i.titulo}. ${i.descripcion || ""}`.trim()),
      ].join("\n"),
      criterios: [{ tipo: "comando", que: "instalar" }, { tipo: "comando", que: "tipos" }, { tipo: "comando", que: "build" }],
    });
  }

  // 2. Entidades de la versión, por nivel de dependencia (nivel 0 primero)
  const niveles = nivelesEntidades(plano.entidades || []);
  const entidadesV = (v.entidades || []).map((e) => buscar("entidades", e)).filter(Boolean).filter((e) => !yaHecho("entidades", e.id));
  entidadesV.sort((a, b) => (niveles[a.id] ?? 0) - (niveles[b.id] ?? 0));
  const accionesV = (v.acciones || []).map((a) => buscar("acciones", a)).filter(Boolean);
  const tareaEntidad = {};
  for (const e of entidadesV) {
    const campos = Object.entries(e.campos || {});
    const usan = accionesV.filter((a) => a.entidad === e.id);
    const refs = campos.filter(([, t]) => String(t).startsWith("id:")).map(([, t]) => String(t).slice(3));
    tareaEntidad[e.id] = tarea({
      id: `entidad-${e.id}`, tipo: "entidad", titulo: `Datos: ${e.titulo}`,
      descripcion: [
        `${e.descripcion || ""}`.trim(),
        `Tabla "${e.tabla || slug(e.titulo) + "s"}" en el esquema de la base, con exactamente estos campos: ${campos.map(([k, t]) => `${k} (${t})`).join(", ") || "(sin campos definidos: definilos mínimos y anotalo en notas)"}. Los campos "id:<entidad>" son referencias a esa tabla. Los que terminan en "?" son opcionales. Ningún campo más sin anotarlo en notas.`,
        usan.length ? `Funciones del backend que la usan en esta versión (una por acción, con validación de entrada):\n${usan.map((a) => `  - ${a.id}: ${a.titulo}. ${a.descripcion || ""}`).join("\n")}` : "En esta versión ninguna acción la toca directamente: alcanza con la tabla y una consulta de lectura.",
      ].join("\n"),
      referencias: { entidades: [e.id], acciones: usan.map((a) => a.id) },
      depende_de: [cimientos, ...refs.map((r) => tareaEntidad[r]).filter(Boolean)].filter(Boolean),
      criterios: [{ tipo: "comando", que: "tipos" }, { tipo: "archivos" }],
    });
  }

  // 3. Una tarea por pantalla, en el orden de la versión; el prototipo aprobado es el diseño exacto
  const pantallasV = (v.pantallas || []).map((p) => buscar("pantallas", p)).filter(Boolean).filter((p) => !yaHecho("pantallas", p.id));
  for (const p of pantallasV) {
    const acciones = (plano.acciones || []).filter((a) => a.pantalla === p.id && (v.acciones || []).includes(a.id));
    const entIds = [...new Set(acciones.map((a) => a.entidad).filter(Boolean))];
    const elementos = idsElementos(p);
    const estados = idsEstados(p);
    const disp = dispositivosDe(p, id);
    const ruta = p.ruta || `/${p.id}`;
    const marcas = [p.id, ...elementos.map((e) => `${p.id}/${e.id}`)];
    tarea({
      id: `pantalla-${p.id}`, tipo: "pantalla", titulo: `Pantalla: ${p.titulo}`,
      ...(esWeb ? { ruta } : {}), prototipo: `prototipo/${slug(p.id)}.html`,
      descripcion: [
        `${p.descripcion || ""}`.trim(),
        esWeb ? `Ruta de la app: ${ruta}. Los enlaces del prototipo a "otra.html" pasan a ser enlaces a "/otra".` : `${tipo === "movil" ? "Pantalla de la app móvil" : "Ventana o vista de la app de escritorio"}; los enlaces del prototipo a "otra.html" son la navegación a esa pantalla.`,
        `Diseño: el archivo ${`prototipo/${slug(p.id)}.html`} es la pantalla aprobada por la persona${esWeb ? "" : " (es HTML, pero es el diseño: mismos elementos, mismos textos, misma disposición, con los componentes nativos del stack)"}. La construida tiene que verse igual (estructura, textos, estilos, comportamiento visible), pero con datos reales en lugar de los de mentira. No agregues ni saques elementos.`,
        esWeb
          ? `Cada elemento del Plano lleva su atributo data-plano, igual que en el prototipo; el contenedor principal lleva data-plano="${p.id}". Plano verifica la ruta buscando exactamente estos atributos:\n${elementos.map((e) => `  - data-plano="${p.id}/${e.id}"  (${e.texto})`).join("\n")}`
          : `Cada elemento del Plano lleva como identificador de accesibilidad o de test (testID, Semantics identifier, AutomationId, accessibilityIdentifier: el que use el stack) exactamente su id del Plano, escrito como texto literal en el código; la pantalla entera lleva "${p.id}". Plano busca estos literales en el código de la app:\n${marcas.map((m, i) => `  - "${m}"${i ? `  (${elementos[i - 1].texto})` : "  (la pantalla)"}`).join("\n")}`,
        acciones.length ? `Acciones de esta pantalla, conectadas a las funciones del backend (no a datos fijos):\n${acciones.map((a) => `  - ${a.titulo}: ${a.descripcion || ""}${a.entidad ? ` (sobre ${a.entidad})` : ""}${a.elemento ? ` · la dispara "${a.elemento}"` : ""}${a.lleva_a ? ` · lleva a /${slug(a.lleva_a)}` : ""}`).join("\n")}` : "Esta pantalla no tiene acciones registradas: es de lectura.",
        estados.length ? `Estados: en el prototipo la pantalla tiene los estados ${estados.join(", ")} elegidos con ?estado=. En la app real el estado sale de los datos (no de un parámetro): tiene que ser posible llegar a cada uno con datos reales, y cada uno se tiene que ver como en el prototipo.` : "",
        `Se usa en: ${disp.join(" y ")}.${disp.length === 2 ? " Responsiva, mobile-first." : ""}`,
      ].filter(Boolean).join("\n"),
      referencias: { pantallas: [p.id], acciones: acciones.map((a) => a.id), entidades: entIds },
      data_plano: marcas,
      depende_de: [cimientos, ...entIds.map((e) => tareaEntidad[e]).filter(Boolean)].filter(Boolean),
      criterios: [{ tipo: "comando", que: "tipos" }, esWeb ? { tipo: "ruta", ruta, data_plano: marcas } : { tipo: "marcas", data_plano: marcas }, { tipo: "persona", texto: "Se ve y se comporta como el prototipo aprobado." }],
    });
  }

  // 4. Integraciones de la versión
  for (const iid of v.integraciones || []) {
    const it = buscar("integraciones", iid); if (!it || yaHecho("integraciones", iid)) continue;
    tarea({
      id: `integracion-${it.id}`, tipo: "integracion", titulo: `Integración: ${it.titulo}`,
      descripcion: `${it.descripcion || ""}\nAnotá en notas qué servicio externo se usa, qué variables de entorno necesita (sin sus valores) y cómo se prueba a mano.`.trim(),
      referencias: { integraciones: [it.id] },
      depende_de: [cimientos].filter(Boolean),
      criterios: [{ tipo: "comando", que: "tipos" }, { tipo: "archivos" }],
    });
  }

  // 5. El recorrido: la versión es una tajada usable de punta a punta, y eso lo comprueba una persona
  tarea({
    id: `recorrido-${v.id}`, tipo: "recorrido", titulo: `Recorrido completo de la ${v.id}`,
    descripcion: [
      `Objetivo de la versión: ${v.objetivo || v.descripcion || "(sin objetivo escrito)"}`,
      "Hacer el recorrido entero con datos reales, de principio a fin, como lo haría una persona real. Arreglar lo que se corte. Dejar datos de ejemplo cargados para que la persona pueda repetir el recorrido sin preparar nada, y anotar en notas los pasos exactos.",
      "La aplicación tiene que levantar con un solo comando (anotarlo en notas) y compilar sin errores.",
    ].join("\n"),
    referencias: { version: v.id },
    depende_de: T.map((t) => t.id),
    criterios: [{ tipo: "comando", que: "build" }, { tipo: "comando", que: "test" }, { tipo: "persona", texto: "El recorrido del objetivo se puede hacer de punta a punta." }],
  });

  // 6. Publicación: la versión corre en el dominio real. Lo que el agente no puede hacer (DNS, crear la app en el panel del
  // servidor) lo deja escrito paso a paso; Plano verifica la URL pública igual que la de desarrollo.
  const dominio = dominioDe(plano);
  const primera = pantallasV[0] || (v.pantallas || []).map((x) => buscar("pantallas", x)).filter(Boolean)[0];
  if (!esWeb) tarea({
    id: `publicacion-${v.id}`, tipo: "publicacion", titulo: tipo === "movil" ? `Instalable de la ${v.id} para el teléfono` : `Instalador de la ${v.id}`,
    descripcion: [
      tipo === "movil"
        ? `Producir un instalable de prueba para el teléfono de la persona (APK firmado de debug, build de TestFlight o de Expo, según el stack: ${id.stack || "ver plano/identidad.json"}) y dejar en DEPLOY.md, en la carpeta de la app, cómo instalarlo paso a paso. Las tiendas quedan para la versión final, no para esta.`
        : `Producir el instalador o ejecutable para el sistema de la persona (según el stack: ${id.stack || "ver plano/identidad.json"}) y dejar en DEPLOY.md, en la carpeta de la app, dónde queda el archivo y cómo instalarlo paso a paso.`,
      "Anotar en notas el comando exacto que genera el instalable y la ruta del archivo producido, relativa a la raíz del proyecto, en archivos.",
    ].join("\n"),
    referencias: { version: v.id },
    depende_de: [`recorrido-${v.id}`],
    criterios: [{ tipo: "comando", que: "build" }, { tipo: "archivos" }, { tipo: "persona", texto: tipo === "movil" ? "Instalado en el teléfono, la versión funciona igual que en desarrollo." : "Instalado en la computadora, la versión funciona igual que en desarrollo." }],
  });
  else tarea({
    id: `publicacion-${v.id}`, tipo: "publicacion", titulo: `Publicar la ${v.id}${dominio ? ` en ${dominio}` : ""}`,
    descripcion: [
      `Dejar la versión corriendo en producción${dominio ? ` en https://${dominio}` : " en el dominio del proyecto (si el Plano no lo dice, devolvé la tarea preguntándolo)"}. Infraestructura según el stack: ${id.stack || "(ver plano/identidad.json)"}.`,
      "Lo que podés hacer vos: el Dockerfile (o la configuración de build que use la plataforma), la build de producción, el deploy de las funciones del backend contra el servidor real con las variables que ya están en la carpeta de la app, y un archivo DEPLOY.md en la carpeta de la app con los pasos exactos que le quedan a la persona.",
      "Lo que no podés hacer vos (y va en DEPLOY.md, numerado, sin omitir nada): apuntar el DNS, crear la aplicación en el panel del servidor, cargar las variables de entorno ahí (nombres sí, valores nunca), activar el certificado. Cuando la persona lo haga, Plano verifica la URL pública.",
      `Plano va a pedir la URL publicada (campo url_prod del tablero)${primera ? ` y la ruta ${primera.ruta || `/${primera.id}`}, buscando data-plano="${primera.id}"` : ""}. Las variables de build del cliente (las VITE_*) se tienen que pasar en el build de producción, no solo en el runtime.`,
    ].join("\n"),
    referencias: { version: v.id },
    depende_de: [`recorrido-${v.id}`],
    criterios: [{ tipo: "ruta", produccion: true, ruta: primera ? primera.ruta || `/${primera.id}` : "/", data_plano: primera ? [primera.id] : [] }, { tipo: "persona", texto: `La versión funciona en el dominio real${dominio ? ` (${dominio})` : ""} igual que en desarrollo.` }],
  });

  return T;
}

const TIPO_TEXTO = { web: "web", escritorio: "de escritorio", movil: "móvil" };

// El dominio del proyecto, si el Plano lo dice (campo dominio de la identidad, o uno que aparezca en el stack / qué es).
export function dominioDe(plano) {
  const id = plano.identidad || {};
  if (id.dominio) return String(id.dominio).replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const texto = `${id.stack || ""} ${id.que_es || ""} ${id.descripcion || ""}`;
  const m = texto.match(/\b(?:dominio|domain)\s*:?\s*([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i) || texto.match(/\b((?:[a-z0-9-]+\.)+(?:uy|com|net|org|io|app|dev|ar|cl|mx|es|co))\b/i);
  return m ? m[1].toLowerCase() : null;
}

// ---------- el tablero en disco ----------
export function leerConstruccion(proyecto) {
  return leerJson(rutaTablero(proyecto), null);
}
export function guardarConstruccion(proyecto, tablero) {
  tablero.actualizado = new Date().toISOString();
  escribirJson(rutaTablero(proyecto), tablero);
  return tablero;
}

// Prepara (o vuelve a preparar) la construcción de una versión: escribe el tablero y el contrato. Si ya había tablero de la
// misma versión, conserva el estado de las tareas que siguen existiendo (lo que el agente ya hizo no se pierde).
export function prepararConstruccion(proyecto, versionId, opciones = {}) {
  const plano = leerPlano(proyecto);
  const v = (plano.roadmap || []).find((x) => x.id === versionId);
  if (!v) throw new Error(`No existe la versión ${versionId}`);
  const sinAprobar = (v.pantallas || []).filter((p) => (plano.prototipo || []).find((x) => x.id === p)?.estado !== "aprobada");
  if (sinAprobar.length && !opciones.forzar) throw new Error(`La ${v.id} tiene ${sinAprobar.length} pantalla(s) sin aprobar en el prototipo: ${sinAprobar.join(", ")}. La construcción arranca con el prototipo aprobado entero.`);
  const previo = leerConstruccion(proyecto);
  const tareas = derivarTareas(plano, versionId);
  if (previo?.version === versionId) {
    const antes = new Map((previo.tareas || []).map((t) => [t.id, t]));
    for (const t of tareas) {
      const a = antes.get(t.id); if (!a) continue;
      for (const k of ["estado", "archivos", "notas", "comentario", "verificacion", "actualizado", "aprobada_por", "ruta"]) if (a[k] !== undefined) t[k] = a[k];
      if (t.ruta && t.tipo === "pantalla") { const c = t.criterios.find((x) => x.tipo === "ruta"); if (c) c.ruta = t.ruta; t.descripcion = t.descripcion.replace(/Ruta de la app: \S+\./, `Ruta de la app: ${t.ruta}.`); }
    }
  }
  const tablero = {
    version: v.id, titulo: limpiarTitulo(v.titulo), objetivo: v.objetivo || "",
    tipo_app: tipoApp(plano),
    carpeta_app: carpetaApp(proyecto, previo?.version === versionId ? previo : null),
    url_dev: previo?.version === versionId && previo.url_dev ? previo.url_dev : "http://localhost:5173",
    url_prod: previo?.url_prod || (dominioDe(plano) ? `https://${dominioDe(plano)}` : ""),
    git: previo?.git ?? true,
    generado: new Date().toISOString(),
    protocolo: "Leé AGENTS.md en la raíz del proyecto. Las tareas se hacen en orden de dependencias; el agente escribe solo estado, archivos, notas y ruta de cada tarea.",
    tareas,
  };
  if (previo?.version === versionId && previo.registro) tablero.registro = previo.registro;
  guardarConstruccion(proyecto, tablero);
  escribirContrato(proyecto, plano, tablero);
  ultimoVisto.delete(proyecto.id);
  registrar(proyecto, "plano", previo?.version === versionId ? `volvió a preparar la construcción de la ${v.id}: contrato y tablero reescritos desde el Plano; el estado de las ${tareas.length} tareas se conservó` : `preparó la construcción de la ${v.id}: ${tareas.length} tareas, contrato en AGENTS.md`);
  return tablero;
}

// ---------- el contrato ----------
export function textoContrato(proyecto, plano, tablero) {
  const id = plano.identidad || {};
  const app = tablero.carpeta_app;
  const duras = (plano.decisiones || []).filter((d) => d.nivel === "duro");
  const L = [];
  L.push(`# ${id.nombre || proyecto.nombre} — contrato de construcción`);
  L.push("");
  L.push(`Este proyecto se construye a partir de un **Plano**: un conjunto de archivos JSON en \`plano/\` que define qué es, para quién, qué pantallas, entidades y acciones tiene, y en qué orden se construye. El Plano es la fuente de verdad. Lo que no está en el Plano no existe: no se inventan pantallas, campos, flujos ni "mejoras".`);
  L.push("");
  L.push("## Qué es");
  L.push(`${id.que_es || ""}`.trim());
  if (id.para_quien) L.push(`\n**Para quién:** ${id.para_quien}`);
  if (id.objetivo) L.push(`\n**Objetivo:** ${id.objetivo}`);
  L.push("");
  L.push("## Tipo de aplicación y stack");
  L.push(`**${{ web: "Aplicación web", escritorio: "Aplicación de escritorio", movil: "Aplicación móvil" }[tablero.tipo_app || "web"]}.** Es una decisión dura del Plano: no se cambia.`);
  L.push(`\n${id.stack || "(ver plano/identidad.json)"}`);
  L.push(`\nLa aplicación vive en \`${app}/\`. Las variables de entorno ya están en \`${app}/.env.local\` (o \`.env\`): se usan, nunca se crean, editan ni imprimen. No se agregan servicios ni dependencias que el stack no pida sin anotarlo en \`notas\` de la tarea.`);
  L.push("");
  L.push("## Innegociables");
  for (const i of (plano.innegociables || []).filter((x) => x.nivel !== "propuesto")) L.push(`- **${i.titulo}.** ${i.descripcion || ""}`.trim());
  if (duras.length) { L.push("\n## Decisiones firmes"); for (const d of duras) L.push(`- ${d.titulo}${d.descripcion ? `: ${d.descripcion}` : ""}`); }
  L.push("");
  L.push("## Dónde está cada cosa");
  L.push("- `plano/identidad.json`, `entidades.json`, `pantallas.json`, `acciones.json`, `integraciones.json`, `innegociables.json`, `decisiones.json`, `roadmap.json`: el Plano. Solo lectura.");
  L.push("- `prototipo/<pantalla>.html`: el prototipo **aprobado** de cada pantalla. Es el diseño exacto: estructura, textos, estilos y comportamiento visible. La pantalla construida tiene que verse igual, con datos reales. Los colores, la tipografía y los espaciados salen de ahí.");
  L.push("- `plano/construccion.json`: el tablero de tareas de la versión en construcción. Es el único archivo de `plano/` que podés escribir, y solo los campos que dice el protocolo.");
  L.push("");
  L.push("## Reglas");
  L.push("1. Una tarea por vez, en orden de dependencias. No se empieza una tarea si alguna de `depende_de` no está `aprobada`.");
  L.push((tablero.tipo_app || "web") === "web"
    ? "2. Cada elemento del Plano lleva su atributo `data-plano` en el HTML renderizado, con el id exacto que dice la tarea. El contenedor principal de una pantalla lleva `data-plano=\"<id-pantalla>\"`. Plano verifica las rutas buscando esos atributos: si faltan, la tarea vuelve."
    : "2. Cada elemento del Plano lleva como identificador de accesibilidad o de test (`testID`, `Semantics(identifier:)`, `AutomationId`, `accessibilityIdentifier`: el que use el stack) exactamente su id del Plano, como texto literal en el código, y la pantalla entera lleva su id. Plano busca esos literales en el código: si faltan, la tarea vuelve.");
  L.push("3. Los datos salen del backend, nunca de constantes en la interfaz. Las acciones del Plano son funciones del backend con validación de entrada.");
  L.push("4. Nada de `.env*`, nada de `git push`, nada de borrar carpetas que no creaste, nada de tocar `plano/` ni `prototipo/` salvo `plano/construccion.json`.");
  L.push("5. Si algo del Plano es imposible, contradictorio o ambiguo, no lo resolvés inventando: marcá la tarea `devuelta` con el problema en `comentario`, y seguí con otra tarea que no dependa de ella.");
  L.push("6. No anuncies lo que vas a hacer ni expliques lo que hiciste en la conversación: lo que importa queda en `notas` de la tarea.");
  L.push("");
  L.push("## Protocolo de trabajo (plano/construccion.json)");
  L.push("Cada tarea tiene `id`, `tipo`, `titulo`, `descripcion`, `depende_de`, `criterios` y `estado`. Estados: `pendiente` → `en_curso` → `hecha` → (Plano verifica) → `aprobada` o `devuelta`.");
  L.push("");
  L.push("1. Leé el archivo entero. Elegí la primera tarea en `pendiente` o `devuelta` cuyas `depende_de` estén todas en `aprobada`. Si una `devuelta` tiene `comentario`, eso es lo que hay que arreglar.");
  L.push("2. Ponela en `en_curso` (volvé a leer el archivo justo antes de escribirlo, Plano también lo escribe) y hacela completa.");
  L.push("3. Corré vos mismo los criterios de tipo `comando` (en la carpeta de la app) hasta que pasen. Los de tipo `ruta` los verifica Plano pidiendo la ruta a la app en `url_dev`: dejá la app de desarrollo corriendo; si usa otro puerto, cambiá `url_dev` en el tablero. Los de tipo `persona` los mira la persona en Plano.");
  L.push("4. Ponela en `hecha`, con `archivos` (rutas que creaste o cambiaste, relativas a la raíz del proyecto) y `notas`. Las notas las lee una persona que no lee código, en la pantalla de Plano: son un objeto con tres campos cortos, no un párrafo. `hecho`: qué quedó funcionando, en una o dos frases. `probar`: lista de pasos concretos para probarlo a mano en la app (URL, qué tocar, qué tiene que pasar), uno por elemento. `decisiones`: lista de lo que decidiste vos porque el Plano no lo decía, una frase cada una; vacía si no hubo. Nada de detalles de implementación salvo que la persona los necesite para probar. Si cambiaste la ruta de una pantalla, actualizá `ruta`. Si volvés a tocar una tarea que ya tenía `verificacion`, borrá ese campo para que Plano la verifique de nuevo.");
  L.push("5. Plano la verifica solo. Si queda `aprobada`, seguí con la siguiente. Si queda `devuelta`, leé `comentario` y volvé al paso 2. Si la siguiente depende de una que sigue en `hecha`, esperá releyendo el archivo cada 15 segundos, hasta 3 minutos; si sigue así, parar y decirlo.");
  L.push("6. Nunca más de una tarea en `en_curso`. Nunca pongas `aprobada` vos: eso lo pone Plano o la persona.");
  L.push("");
  L.push(`## Versión en construcción: ${tablero.version} · ${tablero.titulo}`);
  if (tablero.objetivo) L.push(`\n${tablero.objetivo}`);
  L.push(`\nTareas (${tablero.tareas.length}): ${tablero.tareas.map((t) => `${t.id}`).join(", ")}.`);
  L.push("");
  L.push("_Generado por Plano. Se vuelve a generar al preparar la construcción; no lo edites a mano._");
  return L.join("\n") + "\n";
}

export function escribirContrato(proyecto, plano, tablero) {
  const raiz = proyecto.carpeta;
  writeFileSync(join(raiz, "AGENTS.md"), textoContrato(proyecto, plano, tablero));
  const puntero = "# Instrucciones\n\nLeé y seguí `AGENTS.md` en la raíz del proyecto antes de hacer nada. Ahí está el contrato de construcción y el protocolo de trabajo.\n";
  writeFileSync(join(raiz, "CLAUDE.md"), puntero);
  const app = join(raiz, tablero.carpeta_app);
  if (tablero.carpeta_app !== ".") {
    mkdirSync(app, { recursive: true });
    const sube = relative(app, raiz).split(/[\\/]/).filter(Boolean).map(() => "..").join("/") || ".";
    const texto = `# Instrucciones\n\nEsta es la carpeta de la aplicación. El contrato de construcción y el protocolo están en \`${sube}/AGENTS.md\` (raíz del proyecto): leelo y seguilo antes de hacer nada. El Plano está en \`${sube}/plano/\` y el prototipo aprobado en \`${sube}/prototipo/\`.\n`;
    writeFileSync(join(app, "AGENTS.md"), texto);
    writeFileSync(join(app, "CLAUDE.md"), texto);
  }
}

// ---------- cambios de una tarea desde Plano ----------
export function actualizarTarea(proyecto, tareaId, cambios) {
  const tablero = leerConstruccion(proyecto);
  if (!tablero) throw new Error("No hay construcción preparada");
  const t = tablero.tareas.find((x) => x.id === tareaId);
  if (!t) throw new Error(`No existe la tarea ${tareaId}`);
  Object.assign(t, cambios, { actualizado: new Date().toISOString() });
  guardarConstruccion(proyecto, tablero);
  return t;
}

// Aprobar una tarea desde Plano (la persona, o Plano mismo cuando no hay nada que mirar) y dejar el commit.
export async function aprobarTarea(proyecto, tareaId, quien = "persona") {
  const t = actualizarTarea(proyecto, tareaId, { estado: "aprobada", aprobada_por: quien, comentario: undefined });
  const tablero = leerConstruccion(proyecto);
  if (tablero.git !== false) t.commit = await commitAprobada(proyecto, t).catch((e) => ({ error: e.message }));
  actualizarTarea(proyecto, tareaId, { commit: t.commit });
  if (quien === "persona") registrar(proyecto, "persona", `aprobó «${t.titulo}»${t.commit?.hash ? ` (commit ${t.commit.hash})` : ""}`, tareaId);
  // con la última tarea aprobada, la versión queda construida en el roadmap: la siguiente versión arranca desde ahí
  const ahora = leerConstruccion(proyecto);
  if (ahora.tareas.every((x) => x.estado === "aprobada")) {
    const version = (leerPlano(proyecto).roadmap || []).find((x) => x.id === ahora.version);
    if (version && !version.construida) { actualizarItem(proyecto, "roadmap", version.id, { construida: true, construida_en: new Date().toISOString() }); registrar(proyecto, "plano", `la ${ahora.version} quedó construida entera: las ${ahora.tareas.length} tareas aprobadas. La siguiente versión del roadmap se prototipa y se construye desde acá.`); }
  }
  return t;
}
export function devolverTarea(proyecto, tareaId, comentario, quien = "persona") {
  if (quien === "persona") { const t = leerConstruccion(proyecto)?.tareas.find((x) => x.id === tareaId); if (t) registrar(proyecto, "persona", `devolvió «${t.titulo}»: ${String(comentario || "").slice(0, 160)}`, tareaId); }
  // al devolver se borra la verificación anterior: cuando el agente la vuelva a marcar hecha, Plano la verifica de nuevo
  return actualizarTarea(proyecto, tareaId, { estado: "devuelta", comentario: String(comentario || "").trim(), devuelta_por: quien, aprobada_por: undefined, verificacion: undefined, commit: undefined });
}

// ---------- registro: qué pasó y cuándo, para que la persona sepa dónde está parada la construcción ----------
// Plano anota lo que hace y lo que ve hacer al agente (cambios de estado entre una lectura y la siguiente). Va en el tablero.
const ultimoVisto = new Map(); // proyecto.id → { tareaId: estado }
export function registrar(proyecto, quien, texto, tarea = null) {
  const tablero = leerConstruccion(proyecto);
  if (!tablero) return;
  (tablero.registro ||= []).push({ ts: new Date().toISOString(), quien, texto, ...(tarea ? { tarea } : {}) });
  if (tablero.registro.length > 300) tablero.registro = tablero.registro.slice(-300);
  guardarConstruccion(proyecto, tablero);
}
export function observarAgente(proyecto) {
  const tablero = leerConstruccion(proyecto);
  if (!tablero) return;
  const antes = ultimoVisto.get(proyecto.id);
  const ahora = Object.fromEntries(tablero.tareas.map((t) => [t.id, t.estado]));
  ultimoVisto.set(proyecto.id, ahora);
  if (!antes) return; // primera lectura: no hay con qué comparar
  for (const t of tablero.tareas) {
    const previo = antes[t.id];
    if (previo === undefined || previo === t.estado) continue;
    // lo que Plano mismo cambia (verificando, aprobada, devuelta por verificación) ya quedó anotado por Plano
    if (t.estado === "en_curso") registrar(proyecto, "agente", `empezó «${t.titulo}»`, t.id);
    else if (t.estado === "hecha" && previo !== "verificando") registrar(proyecto, "agente", `marcó hecha «${t.titulo}»`, t.id);
    else if (t.estado === "devuelta" && t.devuelta_por !== "plano" && t.devuelta_por !== "persona") registrar(proyecto, "agente", `devolvió «${t.titulo}»: ${t.comentario || ""}`, t.id);
    else if (t.estado === "pendiente" && previo !== "pendiente") registrar(proyecto, "agente", `volvió a pendiente «${t.titulo}»`, t.id);
  }
}

// Qué está haciendo Plano ahora mismo (la verificación puede tardar: tsc, build…), para mostrarlo en vivo.
const actividad = new Map(); // proyecto.id → { tarea, titulo, paso, desde }
export const actividadDe = (proyectoId) => actividad.get(proyectoId) || null;

// Plano se entera al instante cuando el agente escribe el tablero: mira el archivo, además del repaso cada tanto.
const vigilados = new Map();
export function vigilarConstruccion(proyecto, alCambiar) {
  if (vigilados.has(proyecto.id)) return;
  const carpeta = join(proyecto.carpeta, "plano");
  if (!existsSync(carpeta)) return;
  let reloj = null;
  try {
    const w = watch(carpeta, (evento, nombre) => {
      if (nombre && !String(nombre).startsWith("construccion.json")) return;
      clearTimeout(reloj);
      reloj = setTimeout(() => alCambiar(proyecto), 700); // el agente escribe de a golpes; se espera a que termine
    });
    w.on("error", () => { vigilados.delete(proyecto.id); });
    vigilados.set(proyecto.id, w);
  } catch {}
}

// ---------- verificación mecánica ----------
function correr(comando, cwd, ms = 240000) {
  return new Promise((resolver) => {
    const inicio = Date.now();
    let salida = "";
    const p = spawn(comando, { cwd, shell: true, env: { ...process.env, CI: "1", FORCE_COLOR: "0" }, windowsHide: true });
    const reloj = setTimeout(() => { p.kill(); salida += "\n[Plano: se cortó por tiempo]"; }, ms);
    p.stdout.on("data", (d) => { salida += d; });
    p.stderr.on("data", (d) => { salida += d; });
    p.on("close", (codigo) => { clearTimeout(reloj); resolver({ codigo, salida: salida.slice(-4000).trim(), ms: Date.now() - inicio }); });
    p.on("error", (e) => { clearTimeout(reloj); resolver({ codigo: -1, salida: e.message, ms: Date.now() - inicio }); });
  });
}
function tieneScript(cwd, nombre) {
  const pkg = leerJson(join(cwd, "package.json"), null);
  return Boolean(pkg?.scripts?.[nombre]);
}

export async function verificarTarea(proyecto, tareaId) {
  const tablero = leerConstruccion(proyecto);
  const t = tablero?.tareas.find((x) => x.id === tareaId);
  if (!t) throw new Error(`No existe la tarea ${tareaId}`);
  const cwd = resolve(proyecto.carpeta, tablero.carpeta_app || ".");
  actualizarTarea(proyecto, tareaId, { estado: "verificando" });
  registrar(proyecto, "plano", `empezó a verificar «${t.titulo}»`, t.id);
  const paso = (texto) => actividad.set(proyecto.id, { tarea: t.id, titulo: t.titulo, paso: texto, desde: new Date().toISOString() });
  const resultados = [];
  let fallo = null, falloPersona = null; // falloPersona: lo que falta no lo arregla el agente (DNS, panel del servidor), lo hace la persona
  for (const c of t.criterios || []) {
    if (c.tipo === "comando") {
      if (!existsSync(cwd)) { resultados.push({ ...c, ok: false, salida: `no existe la carpeta ${tablero.carpeta_app}` }); fallo ||= `No existe la carpeta de la app (${tablero.carpeta_app}).`; continue; }
      // tableros viejos traen el comando escrito; los nuevos solo dicen qué comprobar y el comando sale del stack que hay en la carpeta
      if (c.si_existe && !existsSync(join(cwd, c.si_existe))) { resultados.push({ ...c, ok: true, salteado: `no hay ${c.si_existe}` }); continue; }
      if (c.si_script && !tieneScript(cwd, c.si_script)) { resultados.push({ ...c, ok: true, salteado: `no hay script "${c.si_script}"` }); continue; }
      const comando = c.comando || resolverComando(c.que, cwd);
      if (!comando) { resultados.push({ ...c, ok: true, salteado: `nada que correr para "${c.que}" con este stack` }); continue; }
      paso(`corriendo ${comando}`);
      const r = await correr(comando, cwd);
      resultados.push({ ...c, comando, ok: r.codigo === 0, codigo: r.codigo, ms: r.ms, salida: r.salida });
      if (r.codigo !== 0) fallo ||= `Falló "${comando}" (código ${r.codigo}):\n${r.salida.slice(-1500)}`;
    } else if (c.tipo === "archivos") {
      paso("comprobando los archivos declarados");
      const faltan = (t.archivos || []).filter((a) => !existsSync(resolve(proyecto.carpeta, a)));
      const ok = (t.archivos || []).length > 0 && !faltan.length;
      resultados.push({ ...c, ok, faltan, declarados: (t.archivos || []).length });
      if (!ok) fallo ||= !(t.archivos || []).length ? "La tarea no declara archivos (campo archivos): anotá qué creaste o cambiaste." : `Archivos declarados que no existen: ${faltan.join(", ")}`;
    } else if (c.tipo === "ruta") {
      const base = c.produccion ? tablero.url_prod : tablero.url_dev || "http://localhost:5173";
      if (c.produccion && !base) { resultados.push({ ...c, ok: false, error: "no hay URL publicada (url_prod) en el tablero" }); falloPersona ||= "Falta la URL publicada: escribila en Plano (campo «La app publicada está en»)."; continue; }
      const url = base.replace(/\/$/, "") + (c.produccion ? c.ruta || "/" : t.ruta || c.ruta || "/");
      paso(`pidiendo ${url}`);
      let html = null, error = null;
      try {
        const ctl = new AbortController(); const reloj = setTimeout(() => ctl.abort(), 15000);
        const resp = await fetch(url, { signal: ctl.signal, headers: { accept: "text/html" } });
        clearTimeout(reloj);
        html = await resp.text();
        if (!resp.ok) error = `la ruta respondió ${resp.status}`;
      } catch (e) { error = `no se pudo pedir ${url}: ${e.cause?.code || e.message}`; }
      if (error) { resultados.push({ ...c, ok: false, url, error }); if (c.produccion) falloPersona ||= `${error}. La versión publicada todavía no responde en ${base}: seguí los pasos de DEPLOY.md y verificá de nuevo.`; else fallo ||= `${error}. La app tiene que estar corriendo en ${tablero.url_dev} (si usa otro puerto, cambiá url_dev en plano/construccion.json).`; continue; }
      const faltan = (c.data_plano || []).filter((d) => !new RegExp(`data-plano=["']${d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(html));
      const hayAlguno = /data-plano=/.test(html);
      const ok = !faltan.length;
      resultados.push({ ...c, ok, url, faltan, sin_ssr: !hayAlguno && html.length < 20000 });
      if (!ok) { const m = hayAlguno
        ? `En ${url} faltan estos data-plano: ${faltan.join(", ")}`
        : `En ${url} no hay ningún data-plano en el HTML que devuelve el servidor. Si la app renderiza solo en el navegador (sin SSR), activá el render del lado del servidor para esta ruta o anotalo en notas; Plano verifica el HTML que llega del servidor.`;
        if (c.produccion) falloPersona ||= `${m} (puede ser que lo publicado sea una build vieja).`; else fallo ||= m; }
    } else if (c.tipo === "marcas") {
      paso("buscando las marcas del Plano en el código");
      const { faltan, archivos } = buscarMarcas(cwd, c.data_plano || []);
      resultados.push({ ...c, ok: !faltan.length, faltan, archivos });
      if (faltan.length) fallo ||= `En el código de la app no aparecen estos identificadores del Plano (como texto literal, en el identificador de accesibilidad o de test del elemento): ${faltan.join(", ")}`;
    } else if (c.tipo === "persona") {
      resultados.push({ ...c, ok: null }); // lo mira la persona
    }
  }
  const necesitaPersona = (t.criterios || []).some((c) => c.tipo === "persona");
  const verificacion = { ts: new Date().toISOString(), ok: !fallo && !falloPersona, resultados };
  actividad.delete(proyecto.id);
  if (!fallo && falloPersona) {
    // queda hecha, esperando pasos de la persona; Plano vuelve a probar cada tanto y cuando la persona pide "verificar ahora"
    const yaAvisado = t.verificacion?.esperandoPersona;
    actualizarTarea(proyecto, tareaId, { estado: "hecha", verificacion: { ...verificacion, esperandoPersona: falloPersona } });
    if (!yaAvisado) registrar(proyecto, "plano", `«${t.titulo}»: lo que falta lo tiene que hacer la persona. ${falloPersona.split("\n")[0].slice(0, 160)}`, t.id);
  } else if (fallo) { devolverTarea(proyecto, tareaId, `[Verificación de Plano] ${fallo}`, "plano"); actualizarTarea(proyecto, tareaId, { verificacion }); registrar(proyecto, "plano", `la verificación de «${t.titulo}» falló; la devolvió al agente: ${fallo.split("\n")[0].slice(0, 160)}`, t.id); }
  else if (necesitaPersona) { actualizarTarea(proyecto, tareaId, { estado: "hecha", verificacion }); registrar(proyecto, "plano", `«${t.titulo}» pasó la verificación; espera que la persona la mire`, t.id); }
  else { actualizarTarea(proyecto, tareaId, { verificacion }); const ap = await aprobarTarea(proyecto, tareaId, "plano"); registrar(proyecto, "plano", `«${t.titulo}» pasó la verificación y quedó aprobada${ap.commit?.hash ? ` (commit ${ap.commit.hash})` : ""}`, t.id); }
  return leerConstruccion(proyecto).tareas.find((x) => x.id === tareaId);
}

// Verifica las tareas que el agente marcó como hechas y todavía no se verificaron (o cambiaron después de la última verificación).
// Una por vez por proyecto, para no pisar comandos.
const verificando = new Set();
export async function verificarPendientes(proyecto, { forzar = false } = {}) {
  if (verificando.has(proyecto.id)) return [];
  observarAgente(proyecto);
  const tablero = leerConstruccion(proyecto);
  if (!tablero) return [];
  // hecha sin verificación, o con una verificación que falló (la tarea volvió a hecha después de una devolución)
  const porVerificar = tablero.tareas.filter((t) => t.estado === "hecha" && t.verificacion?.ok !== true && !(t.verificacion?.esperandoPersona && !forzar && Date.now() - Date.parse(t.verificacion.ts) < 5 * 60000));
  // verificadas que no tienen nada que mirar una persona (por ejemplo, si cambiaron los criterios al volver a preparar)
  for (const t of tablero.tareas) if (t.estado === "hecha" && t.verificacion?.ok === true && !(t.criterios || []).some((c) => c.tipo === "persona")) await aprobarTarea(proyecto, t.id, "plano");
  if (!porVerificar.length) return [];
  verificando.add(proyecto.id);
  const hechas = [];
  try { for (const t of porVerificar) hechas.push(await verificarTarea(proyecto, t.id)); }
  catch (e) { registrar(proyecto, "plano", `la verificación se cortó con un error: ${e.message}`); throw e; }
  finally { verificando.delete(proyecto.id); actividad.delete(proyecto.id); }
  return hechas;
}

// ---------- git ----------
async function commitAprobada(proyecto, tarea) {
  const raiz = proyecto.carpeta;
  const hay = await correr("git --version", raiz, 10000);
  if (hay.codigo !== 0) return { salteado: "git no está instalado" };
  if (!existsSync(join(raiz, ".git"))) {
    await correr("git init", raiz, 20000);
    const gi = join(raiz, ".gitignore");
    if (!existsSync(gi)) writeFileSync(gi, ["node_modules/", "dist/", "build/", ".env", ".env.*", "!.env.example", "plano/.deshacer/", ".DS_Store"].join("\n") + "\n");
  }
  await correr("git add -A", raiz, 60000);
  const msg = `${tarea.titulo} (${tarea.id})`.replace(/"/g, "'");
  const r = await correr(`git -c user.name="Plano" -c user.email="plano@local" commit -q -m "${msg}" --allow-empty`, raiz, 60000);
  if (r.codigo !== 0) return { error: r.salida.slice(-500) };
  const h = await correr("git rev-parse --short HEAD", raiz, 10000);
  return { hash: h.salida.trim(), mensaje: msg };
}

// Resumen para la interfaz: cuántas en cada estado y cuál es la siguiente que le toca a la persona.
export function resumenConstruccion(tablero) {
  if (!tablero) return null;
  const por = {};
  for (const t of tablero.tareas) por[t.estado] = (por[t.estado] || 0) + 1;
  const paraPersona = tablero.tareas.filter((t) => t.estado === "hecha" && t.verificacion?.ok && (t.criterios || []).some((c) => c.tipo === "persona"));
  const reg = tablero.registro || [];
  const ultimo = (quien) => reg.filter((r) => r.quien === quien).at(-1)?.ts || null;
  // la siguiente tarea que el agente podría tomar (libre de dependencias): si hay una y nada en curso, el agente está parado
  const aprobadas = new Set(tablero.tareas.filter((t) => t.estado === "aprobada").map((t) => t.id));
  const libres = tablero.tareas.filter((t) => ["pendiente", "devuelta"].includes(t.estado) && (t.depende_de || []).every((d) => aprobadas.has(d)));
  const esperandoPersona = tablero.tareas.filter((t) => t.estado === "hecha" && t.verificacion?.esperandoPersona).map((t) => t.id);
  return { total: tablero.tareas.length, por, paraPersona: paraPersona.map((t) => t.id), esperandoPersona, terminada: tablero.tareas.every((t) => t.estado === "aprobada"), ultimoAgente: ultimo("agente"), ultimoPlano: ultimo("plano"), libres: libres.map((t) => t.id), enCurso: tablero.tareas.filter((t) => t.estado === "en_curso").map((t) => t.id) };
}

export function versionConstruible(plano) {
  // la primera versión del roadmap con todas sus pantallas aprobadas y que todavía no se marcó construida
  const versiones = [...(plano.roadmap || [])].sort((a, b) => (a.orden || 99) - (b.orden || 99));
  return versiones.find((v) => (v.pantallas || []).length && (v.pantallas || []).every((p) => (plano.prototipo || []).find((x) => x.id === p)?.estado === "aprobada")) || null;
}
