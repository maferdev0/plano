// Plano — interfaz de la tajada 1: proyectos + conversación + el Plano en pestañas.
import { t, idiomaActual, idiomaElegido, locale, traducirEstatico, IDIOMAS } from "./idiomas.js?v=69";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const COLECCIONES = [
  ["identidad", "Identidad"],
  ["decisiones", "Decisiones"],
  ["entidades", "Entidades"],
  ["pantallas", "Pantallas"],
  ["acciones", "Acciones"],
  ["integraciones", "Integraciones"],
  ["innegociables", "Innegociables"],
  ["preguntas", "Preguntas"],
  ["roadmap", "Roadmap"],
  ["prototipo", "Prototipo"],
];
const TITULO = Object.fromEntries(COLECCIONES.map(([k, v]) => [k, t(v)]));
const VACIAS = {
  identidad: [t("Todavía no hay identidad"), t("Qué es, para quién y por qué. Aparece apenas lo contás.")],
  construccion: [t("Todavía no hay construcción"), t("Cuando todas las pantallas de una versión están aprobadas, Plano prepara el tablero y el contrato para el agente de código.")],
  decisiones: [t("Sin decisiones"), t("Web o app, responsiva o no, cómo se cobra: cada elección queda acá.")],
  entidades: [t("Sin entidades"), t("Los sustantivos del sistema: negocio, cliente, pedido…")],
  pantallas: [t("Sin pantallas"), t("Lo que la gente ve, con lo que hay en cada una.")],
  acciones: [t("Sin acciones"), t("Los verbos: qué hace alguien, en qué pantalla, sobre qué entidad.")],
  integraciones: [t("Sin integraciones"), t("Servicios externos: pagos, mails, mapas, IA.")],
  innegociables: [t("Sin innegociables"), t("Idioma, colores, tipografía, tono. Lo que no se discute.")],
  preguntas: [t("Sin preguntas abiertas"), t("Lo que todavía no sabés. El agente no lo decide solo.")],
  prototipo: [t("Todavía no hay prototipo"), t("Se hace por versión, pantalla por pantalla, y vos aprobás cada una. Arranca desde la v1 en el Roadmap.")],
  roadmap: [t("Todavía no hay roadmap"), t("Las versiones en que se construye el proyecto, en orden. Se arman con el Plano: nada entra antes que lo que necesita.")],
};
const ETIQUETAS_IDENTIDAD = { dispositivos: t("Se usa en"), que_es: t("Qué es"), para_quien: t("Para quién"), por_que: t("Por qué existe"), objetivo: t("Objetivo"), stack: t("Tecnología"), tipo: t("Tipo"), descripcion: t("En una frase") };
// Íconos rellenos (estilo "solid"), inline para no depender de ningún CDN. Rellenos se leen mejor a 14 px que un trazo.
const svg = (paths) => `<svg viewBox="0 0 24 24" fill="currentColor">${paths}</svg>`;
const NIVELES = {
  duro: { nombre: t("Cimiento"), texto: t("Cambiarlo es caro: hay cosas construidas encima o lo definiste con firmeza. El agente no lo toca."), icono: svg(`<path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 5a3 3 0 0 1 6 0v3H9V7zm3 7a1.5 1.5 0 0 1 .75 2.8V18h-1.5v-1.2A1.5 1.5 0 0 1 12 14z"/>`) },
  blando: { nombre: t("Puede cambiar"), texto: t("Un detalle que puede moverse sin romper nada."), icono: svg(`<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-5 1 1-5L16.5 3.5zM14.9 6.1l3 3 1.5-1.5-3-3-1.5 1.5z"/>`) },
  supuesto: { nombre: t("Lo asumió el agente"), texto: t("No lo dijiste vos. Confirmalo o corregilo en la conversación."), icono: svg(`<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 16.2a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm1.2-5.1c-.5.3-.7.6-.7 1.2h-1.9c0-1.4.6-2.1 1.4-2.6.6-.4.9-.7.9-1.2 0-.6-.5-1-1.1-1-.7 0-1.2.4-1.3 1.2H8.6c.1-2 1.5-3.1 3.3-3.1 1.9 0 3.2 1.1 3.2 2.7 0 1.2-.6 1.9-1.9 2.8z"/>`) },
  propuesto: { nombre: t("Propuesta del agente"), texto: t("El agente lo pide. No existe hasta que lo apruebes."), icono: svg(`<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>`) },
};

let config = { usuario: "vos" };
let proyecto = null;
let plano = null;
let enviando = false;
let pestanaActiva = "identidad";           // colección visible en el panel del Plano
let construccion = null;   // tablero de construcción (plano/construccion.json) o null
let construible = null;    // id de la versión con todas las pantallas aprobadas, lista para preparar la construcción
let tareaActiva = null;    // tarea abierta en la pestaña Construcción
let relojConstruccion = null;
let construccionActividad = null; // qué está verificando Plano ahora mismo (lo manda el servidor)
let construccionResumen = null;   // resumen calculado en el servidor (tiempos, tareas libres)
let registroAbierto = false;
let vista = localStorage.getItem("plano.vista") || (window.innerWidth >= 1100 ? "dividida" : "completa");
let mostrandoChat = true;                  // en vista completa: ¿la pestaña activa es la conversación?

// ---------- arranque ----------
async function arrancar() {
  prepararEscritorio();
  config = await (await fetch("/api/config")).json();
  $("#lateral-usuario").textContent = config.usuario && config.usuario !== "vos" ? config.usuario : "";
  $("#lateral-version").textContent = `Plano ${config.version || ""}`;
  $("#saludo").textContent = t("Hola {usuario}, ¿qué querés construir?", { usuario: config.usuario });
  traducirEstatico();
  if (!config.claveConfigurada) { $("#barra-estado").textContent = t("Falta la clave de API: cargala en Configuración"); $("#barra-estado").style.cursor = "pointer"; $("#barra-estado").onclick = () => $("#abrir-config").click(); }
  else if (config.simulado) $("#barra-estado").textContent = t("modo simulado");
  const q = new URLSearchParams(location.search);
  if (q.get("p")) await abrirProyecto(q.get("p"));
  else if (q.has("uso")) await mostrarUso(q.get("uso"));
  else await mostrarProyectos();
}

// ---------- pantalla de inicio: sesiones + configuración ----------
const TEMAS = [
  ["grafito", "Grafito", "#18181b", "#f4f4f5"],
  ["indigo", "Índigo", "#4f46e5", "#eef2ff"],
  ["bosque", "Bosque", "#15803d", "#f0fdf4"],
  ["ladrillo", "Ladrillo", "#b91c1c", "#fef2f2"],
];

let refrescoInicio = null;
async function mostrarProyectos() {
  proyecto = null;
  clearInterval(refrescoInicio);
  refrescoInicio = setInterval(() => { if (!$("#vista-proyectos").hidden && !document.hidden) mostrarProyectos(); else clearInterval(refrescoInicio); }, 5000);
  ponerProyectoEnBarra(null);
  $("#vista-entrevista").hidden = true;
  $("#vista-uso").hidden = true;
  $("#vista-proyectos").hidden = false;
  marcarLateral("inicio");
  $("#saludo").textContent = t("Hola {usuario}", { usuario: config.usuario });
  const lista = await (await fetch("/api/proyectos")).json();
  renderLateralProyectos(lista);
  const ul = $("#lista-proyectos");
  ul.innerHTML = "";
  if (!lista.length) ul.innerHTML = `<li class="vacio">${t("Todavía no hay proyectos. Creá el primero.")}</li>`;
  for (const p of lista) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sesion";
    const quien = p.ultimoRol === "usuario" ? t("Vos") : p.ultimoRol === "plano" ? "Plano" : "";
    b.innerHTML = `
      <span class="sesion__nombre">${esc(p.nombre)}</span>${p.tipo_app && p.tipo_app !== "web" ? `<span class="sesion__tipo">${esc(p.tipo_app === "movil" ? t("móvil") : t("escritorio"))}</span>` : ""}
      <span class="sesion__cuando">${esc(cuando(p.ultimaActividad))}</span>
      ${p.trabajando ? `<span class="sesion__ultimo sesion__trabajando">${t("Trabajando…")}</span>` : p.ultimoTexto ? `<span class="sesion__ultimo">${quien ? `<b>${quien}:</b> ` : ""}${esc(p.ultimoTexto)}</span>` : `<span class="sesion__ultimo">${t("Sin mensajes todavía")}</span>`}
      <span class="sesion__ruta">${esc(p.carpeta)}</span>`;
    b.onclick = () => { history.pushState({}, "", `?p=${p.id}`); abrirProyecto(p.id); };
    const mas = document.createElement("button");
    mas.type = "button"; mas.className = "sesion__mas"; mas.setAttribute("aria-label", t("Más acciones")); mas.innerHTML = ICONO_MAS;
    mas.onclick = (e) => { e.stopPropagation(); abrirMenu(mas, [
      { texto: t("Renombrar"), fn: () => pedirRenombrar(p) },
      { texto: t("Duplicar…"), fn: () => pedirDuplicar(p) },
      { texto: t("Exportar"), fn: () => { location.href = `/api/proyectos/${p.id}/exportar`; } },
      { texto: t("Borrar…"), fn: () => pedirBorrar(p), peligro: true },
    ]); };
    li.append(b, mas);
    ul.append(li);
  }
}

function usd(n) { return "US$ " + n.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: n < 0.1 ? 3 : 2 }); }
function tokens(n) { return n >= 1e6 ? (n / 1e6).toLocaleString(locale(), { maximumFractionDigits: 1 }) + " M" : n >= 1000 ? Math.round(n / 1000).toLocaleString(locale()) + " k" : String(n); }

// Borrar un proyecto: se confirma escribiendo su nombre. Se van plano/ y prototipo/ de su carpeta; lo demás de la carpeta queda.
function pedirBorrar(p) {
  const dlg = $("#dialogo-borrar"), form = $("#form-borrar"), input = form.elements.nombre, ok = $("#borrar-confirmar"), error = $("#error-borrar");
  $("#borrar-nombre").textContent = p.nombre;
  $("#borrar-texto").innerHTML = t("Se borran la conversación, el Plano entero y todas las pantallas del prototipo: las carpetas <code>plano</code> y <code>prototipo</code> dentro de <code>{c}</code>. El resto de esa carpeta no se toca. No se puede deshacer.", { c: esc(p.carpeta) });
  input.value = ""; ok.disabled = true; error.hidden = true;
  $("#borrar-original").value = p.nombre;
  input.oninput = () => { ok.disabled = input.value.trim() !== p.nombre; };
  $("#borrar-copiar").innerHTML = ICONO_COPIAR;
  $("#borrar-copiar").onclick = (e) => copiar(p.nombre, e.currentTarget);
  $("#borrar-cancelar").onclick = () => dlg.close();
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (input.value.trim() !== p.nombre) return;
    ok.disabled = true; ok.textContent = t("Borrando…");
    const r = await fetch(`/api/proyectos/${p.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ nombre: input.value.trim() }) });
    const json = await r.json().catch(() => ({}));
    ok.textContent = t("Borrar el proyecto");
    if (!r.ok) { error.textContent = json.error || t("No se pudo borrar."); error.hidden = false; ok.disabled = false; return; }
    dlg.close();
    try { localStorage.removeItem(`plano.cola.${p.id}`); } catch {}
    mostrarProyectos();
  };
  dlg.showModal();
  input.focus();
}

// Renombrar y duplicar comparten el diálogo: el de duplicar pide además la carpeta de destino.
function dialogoProyecto({ titulo, boton, nombre, conCarpeta, alEnviar }) {
  const dlg = $("#dialogo-proyecto"), form = $("#form-proyecto"), error = $("#error-proyecto");
  $("#proyecto-titulo").textContent = titulo;
  $("#proyecto-ok").textContent = boton;
  form.elements.nombre.value = nombre;
  form.elements.carpeta.value = "";
  form.elements.carpeta.required = !!conCarpeta;
  $("#proyecto-carpeta-label").hidden = !conCarpeta;
  error.hidden = true;
  $("#proyecto-cancelar").onclick = () => dlg.close();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const datos = { nombre: form.elements.nombre.value.trim(), carpeta: form.elements.carpeta.value.trim() };
    if (!datos.nombre) return form.elements.nombre.focus();
    if (conCarpeta && !datos.carpeta) { error.textContent = t("Elegí la carpeta."); error.hidden = false; return; }
    const r = await alEnviar(datos);
    if (r?.error) { error.textContent = r.error; error.hidden = false; return; }
    dlg.close();
    mostrarProyectos();
  };
  dlg.showModal();
  form.elements.nombre.focus(); form.elements.nombre.select();
}
function pedirRenombrar(p) {
  dialogoProyecto({ titulo: t("Renombrar el proyecto"), boton: t("Guardar"), nombre: p.nombre, alEnviar: async ({ nombre }) => (await fetch(`/api/proyectos/${p.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ nombre }) })).json() });
}
function pedirDuplicar(p) {
  dialogoProyecto({ titulo: t("Duplicar {p}", { p: p.nombre }), boton: t("Duplicar"), nombre: t("{p} (copia)", { p: p.nombre }), conCarpeta: true, alEnviar: async (datos) => (await fetch(`/api/proyectos/${p.id}/duplicar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(datos) })).json() });
}

// "hace 5 min", "hoy 23:41", "ayer 18:02", "1 nov, 15:42"
function cuando(ts) {
  if (!ts) return "";
  const d = new Date(ts), ahora = new Date();
  const min = Math.round((ahora - d) / 60000);
  if (min < 1) return t("recién");
  if (min < 60) return t("hace {min} min", { min });
  const hora = d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  const mismoDia = (a, b) => a.toDateString() === b.toDateString();
  if (mismoDia(d, ahora)) return t("hoy {hora}", { hora });
  const ayer = new Date(ahora); ayer.setDate(ahora.getDate() - 1);
  if (mismoDia(d, ayer)) return t("ayer {hora}", { hora });
  return `${d.toLocaleDateString(locale(), { day: "numeric", month: "short" })}, ${hora}`;
}

function renderTemas() {
  const cont = $("#temas");
  cont.innerHTML = "";
  const actual = document.documentElement.dataset.tema || "grafito";
  for (const [id, nombre, primario, secundario] of TEMAS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tema" + (id === actual ? " tema--activo" : "");
    b.innerHTML = `<span class="tema__muestra"><i style="background:${primario}"></i><i style="background:${secundario}"></i></span>${esc(nombre)}`;
    b.onclick = () => { document.documentElement.dataset.tema = id; localStorage.setItem("plano.tema", id); renderTemas(); };
    cont.append(b);
  }
}

function renderModos() {
  const cont = $("#modos"), actual = document.documentElement.dataset.modo || "sistema";
  cont.innerHTML = [["sistema", t("Sistema")], ["claro", t("Clara")], ["oscuro", t("Oscura")]].map(([v, tx]) => `<button type="button" class="segmento ${v === actual ? "segmento--activo" : ""}" data-modo="${v}">${tx}</button>`).join("");
  cont.querySelectorAll(".segmento").forEach((b) => { b.onclick = () => { document.documentElement.dataset.modo = b.dataset.modo; localStorage.setItem("plano.modo", b.dataset.modo); renderModos(); avisarTemaAlEscritorio(); }; });
}
function renderIdiomas() {
  const cont = $("#idiomas"), actual = idiomaElegido();
  cont.innerHTML = [["sistema", t("Sistema")], ...Object.entries(IDIOMAS)].map(([v, tx]) => `<button type="button" class="segmento ${v === actual ? "segmento--activo" : ""}" data-idioma="${v}">${tx}</button>`).join("");
  cont.querySelectorAll(".segmento").forEach((b) => { b.onclick = () => { localStorage.setItem("plano.idioma", b.dataset.idioma); location.reload(); }; });
}
const dialogoConfig = $("#dialogo-config");
$("#abrir-config").onclick = () => { renderTemas(); renderModos(); renderIdiomas(); renderCuenta(); dialogoConfig.showModal(); };
// cuenta y modelos: se leen y se guardan en el servidor (data/config.json); la clave nunca viaja entera de vuelta
function renderCuenta() {
  const f = $("#form-config");
  f.elements.usuario.value = config.usuario === "vos" ? "" : config.usuario || "";
  f.elements.claveApi.value = "";
  f.elements.claveApi.placeholder = config.claveConfigurada && config.claveFinal ? `sk-ant-…${config.claveFinal}` : "sk-ant-…";
  $("#config-clave-estado").textContent = config.simulado ? t("Modo simulado: no se usa.") : config.claveConfigurada ? (config.origenClave === "env" ? t("Cargada desde .env; si escribís una acá, manda esta.") : t("Cargada. Dejá el campo vacío para conservarla.")) : t("Falta. Sin clave la entrevista no responde. Se consigue en console.anthropic.com.");
  for (const nombre of ["modelo", "modeloPrototipo"]) {
    const sel = f.elements[nombre]; sel.innerHTML = "";
    const actual = config[nombre];
    const lista = { ...config.modelos, ...(actual && !config.modelos[actual] ? { [actual]: { nombre: actual, nota: "" } } : {}) };
    for (const [id, m] of Object.entries(lista)) { const o = document.createElement("option"); o.value = id; o.textContent = m.nota ? `${m.nombre} · ${t(m.nota)}` : m.nombre; o.selected = id === actual; sel.append(o); }
  }
  f.elements.compactar.value = config.compactar;
  $("#config-guardado").hidden = true; $("#config-error").hidden = true;
  $("#config-version").innerHTML = `Plano ${esc(config.version)} · ${t("Nada se guarda en ninguna base de datos: cada proyecto vive en su carpeta y esta configuración en")} <code>${esc(config.rutaConfig || "data/config.json")}</code>.`;
}
$("#config-ver-clave").onclick = (e) => { const i = $("#form-config").elements.claveApi; i.type = i.type === "password" ? "text" : "password"; e.currentTarget.textContent = i.type === "password" ? t("Ver") : t("Ocultar"); };
$("#form-config").onsubmit = async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const cuerpo = { usuario: f.elements.usuario.value, modelo: f.elements.modelo.value, modeloPrototipo: f.elements.modeloPrototipo.value, compactar: Number(f.elements.compactar.value) };
  if (f.elements.claveApi.value.trim()) cuerpo.claveApi = f.elements.claveApi.value.trim();
  const r = await fetch("/api/config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
  const json = await r.json();
  if (!r.ok) { $("#config-error").textContent = json.error || t("No se pudo guardar."); $("#config-error").hidden = false; return; }
  config = json; renderCuenta();
  $("#config-guardado").hidden = false; setTimeout(() => { $("#config-guardado").hidden = true; }, 1500);
  $("#barra-estado").textContent = !config.claveConfigurada ? t("Falta la clave de API: cargala en Configuración") : config.simulado ? t("modo simulado") : "";
  if (!proyecto) $("#saludo").textContent = t("Hola {usuario}, ¿qué querés construir?", { usuario: config.usuario });
};
$("#config-cerrar").onclick = () => dialogoConfig.close();
dialogoConfig.addEventListener("click", (e) => { if (e.target === dialogoConfig) dialogoConfig.close(); });

const dialogoNuevo = $("#dialogo-nuevo");
$("#tipos-app").querySelectorAll(".segmento").forEach((b) => { b.onclick = () => { $("#tipos-app").querySelectorAll(".segmento").forEach((x) => x.classList.toggle("segmento--activo", x === b)); $("#form-nuevo").elements.tipo_app.value = b.dataset.tipo; $("#tipo-app-nota").textContent = t(b.dataset.nota); }; });
$("#nuevo-proyecto").onclick = () => { $("#form-nuevo").reset(); $("#tipos-app").querySelectorAll(".segmento").forEach((x) => x.classList.remove("segmento--activo")); $("#tipo-app-nota").textContent = ""; $("#error-nuevo").hidden = true; dialogoNuevo.showModal(); $("input[name=nombre]").focus(); };
$("#nuevo-cancelar").onclick = () => dialogoNuevo.close();
dialogoNuevo.addEventListener("click", (e) => { if (e.target === dialogoNuevo) dialogoNuevo.close(); });

$("#form-nuevo").addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(e.target));
  const err = $("#error-nuevo");
  err.hidden = true;
  if (!datos.carpeta) { err.textContent = t("Elegí la carpeta del proyecto."); err.hidden = false; $("#elegir-carpeta").focus(); return; }
  if (!datos.tipo_app) { err.textContent = t("Elegí qué tipo de aplicación es: web, de escritorio o móvil. Después no se cambia."); err.hidden = false; return; }
  const r = await fetch("/api/proyectos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(datos) });
  const json = await r.json();
  if (!r.ok) { err.textContent = json.error; err.hidden = false; return; }
  dialogoNuevo.close();
  history.pushState({}, "", `?p=${json.id}`);
  await abrirProyecto(json.id);
});

// ---------- elegir carpeta ----------
let destinoCarpeta = null; // el input que recibe la carpeta elegida
// Elegir carpeta: primero el selector nativo del sistema (lo abre el servidor). Si no aparece o no responde, el explorador de
// Plano, que siempre funciona; a los 2 segundos sin respuesta ya se ofrece como alternativa sin cancelar el nativo.
document.querySelectorAll("[data-elegir-carpeta]").forEach((boton) => boton.addEventListener("click", async () => {
  const caja = boton.closest(".carpeta");
  destinoCarpeta = caja.querySelector("input[name=carpeta]");
  boton.disabled = true;
  boton.textContent = t("Abriendo el selector…");
  let alternativa = caja.parentElement.querySelector(".carpeta__alternativa");
  if (!alternativa) { alternativa = document.createElement("button"); alternativa.type = "button"; alternativa.className = "carpeta__alternativa"; caja.parentElement.append(alternativa); }
  alternativa.hidden = true;
  alternativa.textContent = t("¿No se abrió? Buscar la carpeta desde Plano");
  alternativa.onclick = () => { alternativa.hidden = true; abrirExplorador(); };
  const aviso = setTimeout(() => { alternativa.hidden = false; }, 2000);
  try {
    if (window.plano?.elegirCarpeta) { // en la app de escritorio el diálogo es el de la propia ventana: siempre aparece
      clearTimeout(aviso);
      const carpeta = await window.plano.elegirCarpeta();
      if (carpeta) destinoCarpeta.value = carpeta;
      return;
    }
    const ctl = new AbortController(); const limite = setTimeout(() => ctl.abort(), 5 * 60 * 1000);
    const r = await fetch("/api/elegir-carpeta", { method: "POST", signal: ctl.signal });
    clearTimeout(limite);
    const json = await r.json();
    if (json.carpeta) { destinoCarpeta.value = json.carpeta; alternativa.hidden = true; }
    else if (json.sinDialogo || json.error) abrirExplorador();
  } catch {
    abrirExplorador();
  } finally {
    clearTimeout(aviso);
    boton.disabled = false;
    boton.textContent = t("Elegir carpeta…");
  }
}));

const explorador = $("#explorador");
let exploradorActual = null;
async function abrirExplorador(ruta) {
  const r = await fetch(`/api/carpetas?ruta=${encodeURIComponent(ruta || "")}`);
  const json = await r.json();
  if (!r.ok) { $("#error-nuevo").textContent = json.error; $("#error-nuevo").hidden = false; return; }
  exploradorActual = json;
  $("#explorador-ruta").textContent = json.ruta || "Unidades";
  $("#explorador-subir").disabled = !json.padre;
  $("#explorador-elegir").disabled = !json.ruta;
  const ul = $("#explorador-lista");
  ul.innerHTML = "";
  if (!json.subcarpetas.length) ul.innerHTML = `<li class="vacio">No hay subcarpetas. Podés usar esta.</li>`;
  for (const c of json.subcarpetas) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = c.nombre;
    b.onclick = () => abrirExplorador(c.ruta);
    li.append(b);
    ul.append(li);
  }
  if (!explorador.open) explorador.showModal();
}
$("#explorador-subir").onclick = () => exploradorActual?.padre && abrirExplorador(exploradorActual.padre);
$("#explorador-inicio").onclick = () => abrirExplorador(exploradorActual?.inicio || "");
$("#explorador-cancelar").onclick = () => explorador.close();
$("#explorador-elegir").onclick = () => { if (exploradorActual?.ruta && destinoCarpeta) destinoCarpeta.value = exploradorActual.ruta; explorador.close(); };

$("#volver").addEventListener("click", (e) => { e.preventDefault(); history.pushState({}, "", "/"); mostrarProyectos(); });
window.addEventListener("popstate", () => { const q = new URLSearchParams(location.search); q.get("p") ? abrirProyecto(q.get("p")) : q.has("uso") ? mostrarUso(q.get("uso")) : mostrarProyectos(); });
$("#abrir-uso").onclick = () => { history.pushState({}, "", "?uso="); mostrarUso(""); };

// ---------- pantalla de trabajo ----------
async function abrirProyecto(id) {
  const r = await fetch(`/api/proyectos/${id}`);
  if (!r.ok) { history.replaceState({}, "", "/"); return mostrarProyectos(); }
  const datos = await r.json();
  proyecto = datos.proyecto;
  plano = datos.plano;
  roadmapUso = datos.roadmapUso || null;
  construible = datos.construible || null;
  construccion = null; tareaActiva = null;
  if (datos.construccion) cargarConstruccion();
  cargarRevisiones();
  ponerProyectoEnBarra(proyecto);
  marcarLateral(null, proyecto.id);
  cargarLateralProyectos();
  $("#vista-proyectos").hidden = true;
  $("#vista-uso").hidden = true;
  $("#vista-entrevista").hidden = false;

  const caja = $("#mensajes");
  caja.innerHTML = "";
  visiblesDesde = datos.totalVisibles - datos.visibles.length; // índice del primer mensaje que se muestra
  if (!datos.visibles.length) agregarMensaje("plano", t("Hola {usuario}, ¿qué querés construir?", { usuario: config.usuario }));
  else renderVisibles(datos.visibles, { ultimo: true });
  if (datos.trabajando && !enviando) esperarTurnoAjeno();
  for (const q of leerCola()) { const div = agregarMensaje("usuario", q.texto); marcarFallido(div, t("No se pudo conectar con Plano. ¿Está corriendo el servidor?"), () => reenviarDeCola(q, div)); }

  const params = new URLSearchParams(location.search);
  if (["dividida", "completa"].includes(params.get("v"))) vista = params.get("v");
  if (["tarjetas", "filas"].includes(params.get("m"))) modo = params.get("m");
  if (["diagrama", "filas"].includes(params.get("m"))) modoEntidades = params.get("m");
  abiertas.clear(); acordeonIniciado = false;
  const pest = params.get("t") === "ruta" ? "roadmap" : params.get("t");
  pestanaActiva = TITULO[pest] ? pest : "identidad";
  mostrandoChat = !TITULO[pest];
  renderVista();
  $("#entrada").focus();
}

// Dividida: conversación a la izquierda, el Plano a la derecha. Completa: una sola cosa por vez, la conversación es una pestaña más.
$("#alternar-vista").addEventListener("click", () => {
  vista = vista === "dividida" ? "completa" : "dividida";
  localStorage.setItem("plano.vista", vista);
  if (vista === "completa") mostrandoChat = true;
  renderVista();
});

const ICONO_UNA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;
const ICONO_DOS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/></svg>`;

function renderVista() {
  const raiz = $("#vista-entrevista");
  const dividida = vista === "dividida";
  raiz.classList.toggle("trabajo--dividida", dividida);
  const chat = $("#panel-chat"), planoPanel = $("#panel-plano"), cab = $("#cabecera-plano");
  chat.hidden = !dividida && !mostrandoChat;
  planoPanel.hidden = !dividida && mostrandoChat;
  // La cabecera con las pestañas vive en la columna del Plano. En "una por vez" acompaña al panel visible.
  const dueno = dividida || !mostrandoChat ? planoPanel : chat;
  if (cab.parentElement !== dueno) dueno.prepend(cab);
  const boton = $("#alternar-vista");
  boton.innerHTML = dividida ? ICONO_UNA : ICONO_DOS;
  boton.title = dividida ? "Ver una sola cosa por vez" : "Ver la conversación y el Plano lado a lado";
  renderPestanas();
  renderContenido();
  renderSiguiente();
}

const mensajesEl = $("#mensajes");
function scrollAlFinal() { mensajesEl.scrollTop = mensajesEl.scrollHeight; }

// Respuestas rápidas debajo del último mensaje de Plano: un clic las manda como si las hubieras escrito.
function ponerSugerencias(div, lista) {
  document.querySelectorAll(".sugerencias").forEach((s) => s.remove());
  if (!lista?.length) return;
  const wrap = document.createElement("div");
  wrap.className = "sugerencias";
  for (const t of lista) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "sugerencia"; b.textContent = t;
    b.onclick = () => { wrap.remove(); enviarTexto(t); };
    wrap.append(b);
  }
  div.after(wrap);
  requestAnimationFrame(scrollAlFinal);
}

// "3,4 k tokens · US$ 0,04", al pie de cada respuesta
function costoCorto(u) { return u ? `${tokens(u.entrada + u.salida)} tokens · ${usd(u.usd)}` : ""; }
function ponerCosto(div, u) {
  if (!u) return;
  div.querySelector(".msg__costo")?.remove();
  const s = document.createElement("span"); s.className = "msg__costo"; s.textContent = costoCorto(u);
  s.title = `${tokens(u.entrada)} de entrada, ${tokens(u.salida)} de salida${u.llamadas > 1 ? `, ${u.llamadas} llamadas a la API` : ""}`;
  div.append(s);
  const h = div.querySelector(".msg__hora"); if (h) div.append(h); // la hora cierra la línea
}
// "recién", "hace 5 min", "hace 3 h"; pasado un día, la fecha y la hora tal cual
function cuandoMensaje(ts) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return t("recién");
  if (min < 60) return t("hace {min} min", { min });
  if (min < 24 * 60) return t("hace {h} h", { h: Math.round(min / 60) });
  return new Date(ts).toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}
function ponerHora(div, ts) {
  if (!ts) return;
  div.dataset.ts = ts;
  let h = div.querySelector(".msg__hora");
  if (!h) { h = document.createElement("span"); h.className = "msg__hora"; div.append(h); }
  h.textContent = cuandoMensaje(ts);
  h.title = new Date(ts).toLocaleString(locale());
}
// las horas relativas se refrescan solas
setInterval(() => { document.querySelectorAll(".msg[data-ts]").forEach((d) => { const h = d.querySelector(".msg__hora"); if (h) h.textContent = cuandoMensaje(Number(d.dataset.ts)); }); }, 30000);
function agregarMensaje(rol, texto, uso, turno, accion, ts) {
  const div = document.createElement("div");
  div.className = `msg msg--${rol}` + (accion ? " msg--accion" : "");
  if (turno) div.dataset.turno = turno;
  if (rol === "plano") { div.innerHTML = markdown(texto); ponerCosto(div, uso); }
  else if (rol === "usuario") div.innerHTML = conMenciones(texto);
  else div.textContent = texto;
  if ((rol === "plano" || rol === "usuario") && !accion) ponerHora(div, ts || Date.now());
  div.dataset.texto = texto;
  mensajesEl.append(div);
  refrescarAcciones();
  if (!cargandoAnteriores) scrollAlFinal();
  return div;
}

// Los mensajes guardados se dibujan de a 50: al abrir, los últimos; al llegar arriba, los 50 anteriores.
let visiblesDesde = 0;
let cargandoAnteriores = false;
function renderVisibles(vs, { ultimo = false, arriba = false } = {}) {
  const destino = arriba ? document.createDocumentFragment() : mensajesEl;
  const crear = (rol, texto, uso, turno, accion, ts) => {
    if (!arriba) return agregarMensaje(rol, texto, uso, turno, accion, ts);
    const div = agregarMensaje(rol, texto, uso, turno, accion, ts); destino.append(div); return div;
  };
  for (let k = 0; k < vs.length; k++) {
    const m = vs[k];
    if (m.rol === "usuario" && m.pendiente && !m.detenido) {
      const sig = vs[k + 1];
      const div = crear("usuario", m.texto, undefined, m.turno, m.accion, m.ts);
      marcarFallido(div, sig?.rol === "error" ? sig.texto : t("No se pudo enviar."), () => reintentar());
      if (sig?.rol === "error") k++;
    } else { const div = crear(m.rol, m.texto, m.uso, m.turno, m.accion, m.ts); if (ultimo && m.rol === "plano" && m.sugerencias?.length && k === vs.length - 1) ponerSugerencias(div, m.sugerencias); }
  }
  if (arriba) mensajesEl.prepend(destino);
}
async function cargarAnteriores() {
  if (cargandoAnteriores || visiblesDesde <= 0 || !proyecto) return;
  cargandoAnteriores = true;
  const aviso = document.createElement("div"); aviso.className = "msg msg--sistema msg--cargando"; aviso.textContent = t("Cargando mensajes anteriores…");
  mensajesEl.prepend(aviso);
  try {
    const r = await fetch(`/api/proyectos/${proyecto.id}/visibles?antes=${visiblesDesde}`);
    const json = await r.json();
    const altoAntes = mensajesEl.scrollHeight, topAntes = mensajesEl.scrollTop;
    aviso.remove();
    renderVisibles(json.visibles, { arriba: true });
    visiblesDesde = json.desde;
    mensajesEl.scrollTop = topAntes + (mensajesEl.scrollHeight - altoAntes); // la vista no salta
  } catch { aviso.remove(); }
  cargandoAnteriores = false;
}
mensajesEl.addEventListener("scroll", () => { if (mensajesEl.scrollTop < 120 && visiblesDesde > 0) cargarAnteriores(); });

// Si el agente está trabajando en este proyecto desde otra pestaña o desde antes de recargar, se muestra "pensando" y se
// vuelve a cargar la conversación cuando termina.
let esperandoAjeno = null;
function esperarTurnoAjeno() {
  if (esperandoAjeno) return;
  const burbuja = agregarMensaje("plano", "");
  const parar = mostrarPensando(burbuja);
  const id = proyecto.id;
  esperandoAjeno = setInterval(async () => {
    try {
      const lista = await (await fetch("/api/proyectos")).json();
      if (lista.find((p) => p.id === id)?.trabajando) return;
    } catch { return; }
    clearInterval(esperandoAjeno); esperandoAjeno = null; if (parar) parar();
    if (proyecto?.id === id && !enviando) abrirProyecto(id);
  }, 3000);
}

// Un mensaje que no llegó a la IA queda en rojo claro, con el motivo y un botón para reintentar. No se pierde:
// si el servidor lo recibió, lo guarda él (pendiente); si ni el servidor contestó, queda en una cola local del navegador.
function marcarFallido(div, motivo, alReintentar) {
  div.classList.add("msg--fallido");
  div.querySelector(".msg__fallo")?.remove();
  const f = document.createElement("div"); f.className = "msg__fallo";
  const s = document.createElement("span"); s.textContent = motivo;
  const b = document.createElement("button"); b.type = "button"; b.className = "btn btn--chico msg__reintentar"; b.textContent = t("Reintentar");
  b.onclick = (e) => { e.stopPropagation(); alReintentar(); };
  f.append(s, b); div.append(f);
  refrescarAcciones();
}
function quitarFallido(div) { div.classList.remove("msg--fallido"); div.querySelector(".msg__fallo")?.remove(); }
const claveCola = () => `plano.cola.${proyecto?.id}`;
function leerCola() { try { return JSON.parse(localStorage.getItem(claveCola()) || "[]"); } catch { return []; } }
function guardarCola(cola) { try { cola.length ? localStorage.setItem(claveCola(), JSON.stringify(cola)) : localStorage.removeItem(claveCola()); } catch {} }
function encolar(item) { guardarCola([...leerCola(), item]); }
function desencolar(ts) { guardarCola(leerCola().filter((q) => q.ts !== ts)); }
async function reenviarDeCola(q, div) {
  if (enviando) return;
  desencolar(q.ts);
  div.remove();
  await enviarTexto(q.texto, q.extra || {});
}

// Acciones de cada mensaje: copiar, leer en voz alta, reenviar o reintentar (solo en el último turno).
const ICONO_MAS = `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>`;
const ICONO_BORRAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>`;
const ICONO_COPIAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;
const ICONO_VOZ = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>`;
const ICONO_PARAR = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
const ICONO_DESHACER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>`;
const ICONO_REINTENTAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>`;
const ICONO_EDITAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

function refrescarAcciones() {
  const todos = [...mensajesEl.querySelectorAll(".msg--usuario, .msg--plano, .msg--error")];
  const ultimoUsuario = [...mensajesEl.querySelectorAll(".msg--usuario")].at(-1);
  const ultimoPlano = [...mensajesEl.querySelectorAll(".msg--plano")].at(-1);
  const ultimoDeTodos = todos.at(-1);
  for (const m of todos) {
    m.querySelector(".acciones")?.remove();
    if (m.classList.contains("msg--pensando")) continue;
    const bar = document.createElement("div");
    bar.className = "acciones";
    const texto = m.dataset.texto || m.textContent;
    const btn = (icono, titulo, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "accion"; b.title = titulo; b.innerHTML = icono; b.onclick = (e) => { e.stopPropagation(); fn(b); }; bar.append(b); return b; };
    if (m.classList.contains("msg--usuario")) {
      btn(ICONO_COPIAR, t("Copiar"), (b) => copiar(texto, b));
      btn(ICONO_EDITAR, t("Editar y volver a enviar"), () => { entrada.value = texto; ajustarEntrada(); entrada.focus(); });
      // Reenviar solo tiene sentido en el último mensaje, y si la IA todavía no respondió bien o falló
      const esUltimo = m === ultimoUsuario && (ultimoDeTodos === m || ultimoDeTodos?.classList.contains("msg--error"));
      if (esUltimo) btn(ICONO_REINTENTAR, t("Reenviar"), () => reintentar());
      // Deshacer: solo el último turno, ya terminado. Vuelve el Plano y el prototipo a como estaban antes de este mensaje.
      if (m === ultimoUsuario && m.dataset.turno && !enviando && ultimoDeTodos?.classList.contains("msg--plano")) btn(ICONO_DESHACER, t("Deshacer este mensaje y lo que cambió"), (b) => abrirMenu(b, [{ texto: t("Deshacer este mensaje y lo que cambió en el Plano"), fn: () => deshacerTurno(m.dataset.turno), peligro: true }]));
    } else if (m.classList.contains("msg--plano")) {
      btn(ICONO_COPIAR, t("Copiar"), (b) => copiar(texto, b));
      btn(ICONO_VOZ, t("Leer en voz alta"), (b) => leerEnVozAlta(m, b));
      if (m === ultimoPlano && ultimoDeTodos === m) btn(ICONO_REINTENTAR, t("Reintentar: la IA vuelve a responder a tu último mensaje"), () => reintentar());
    } else if (m.classList.contains("msg--error")) {
      if (m === ultimoDeTodos) btn(ICONO_REINTENTAR, "Reintentar", () => reintentar());
    }
    if (bar.children.length) m.append(bar);
  }
}

async function copiar(texto, b) {
  try { await navigator.clipboard.writeText(texto); } catch { return; }
  b.classList.add("accion--ok");
  setTimeout(() => b.classList.remove("accion--ok"), 1200);
}

// ---------- voz ----------
let hablando = null;
function elegirVoz() {
  const voces = speechSynthesis.getVoices();
  const orden = [locale(), "es-AR", "es-CL", "es-419", "es-MX", "es-US", "es-ES", "es"];
  for (const lang of orden) {
    const v = voces.find((x) => x.lang.replace("_", "-").toLowerCase().startsWith(lang.toLowerCase()));
    if (v) return v;
  }
  return null;
}
function leerEnVozAlta(m, b) {
  if (!("speechSynthesis" in window)) { b.title = "Este navegador no puede leer en voz alta"; return; }
  if (hablando) { speechSynthesis.cancel(); const prev = hablando; hablando = null; prev.innerHTML = ICONO_VOZ; if (prev === b) return; }
  const texto = m.cloneNode(true);
  texto.querySelector(".acciones")?.remove();
  const u = new SpeechSynthesisUtterance(texto.textContent.trim());
  const voz = elegirVoz();
  if (voz) { u.voice = voz; u.lang = voz.lang; } else u.lang = locale();
  u.rate = 1.05;
  u.onend = u.onerror = () => { if (hablando === b) { hablando = null; b.innerHTML = ICONO_VOZ; } };
  hablando = b;
  b.innerHTML = ICONO_PARAR;
  speechSynthesis.speak(u);
}
if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = () => {};

function mostrarPensando(div) {
  const inicio = Date.now();
  div.classList.add("msg--pensando");
  div.innerHTML = `<span class="pensando"><span class="pensando__puntos"><i></i><i></i><i></i></span><span class="pensando__estado">Pensando…</span> <span class="pensando__tiempo">0 s</span></span>`;
  scrollAlFinal();
  const relojP = setInterval(() => { const s = div.querySelector(".pensando__tiempo"); if (s) s.textContent = `${Math.round((Date.now() - inicio) / 1000)} s`; }, 1000);
  return () => { clearInterval(relojP); div.classList.remove("msg--pensando"); };
}

// La caja de texto arranca de una línea y crece con el contenido, hasta un tope.
const entrada = $("#entrada");
function ajustarEntrada() { entrada.style.height = "auto"; entrada.style.height = Math.min(entrada.scrollHeight, 160) + "px"; }
entrada.addEventListener("input", () => { ajustarEntrada(); actualizarSelector(); });
entrada.addEventListener("keydown", (e) => {
  if (selectorAbierto()) {
    if (e.key === "ArrowDown") { e.preventDefault(); moverSelector(1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); moverSelector(-1); return; }
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); elegirSelector(); return; }
    if (e.key === "Escape") { e.preventDefault(); cerrarSelector(); return; }
  }
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#form-mensaje").requestSubmit(); }
});
entrada.addEventListener("blur", () => setTimeout(cerrarSelector, 150));

// ---------- menciones con @ ----------
// Todas las tarjetas del Plano, para el selector y para resolver menciones al enviar.
function tarjetasMencionables() {
  const lista = [];
  for (const [clave, titulo] of COLECCIONES) {
    if (clave === "identidad") continue;
    for (const it of plano[clave] || []) lista.push({ coleccion: clave, coleccionTitulo: titulo, id: it.id, titulo: it.titulo || it.id, nivel: it.nivel || "blando" });
  }
  return lista;
}

const selector = $("#selector-menciones");
let selectorItems = [];
let selectorIndice = 0;
let selectorRango = null; // [inicio, fin] del "@texto" que se está escribiendo

const selectorAbierto = () => !selector.hidden;
function cerrarSelector() { selector.hidden = true; selectorItems = []; selectorRango = null; }

function actualizarSelector() {
  const pos = entrada.selectionStart;
  const antes = entrada.value.slice(0, pos);
  const m = antes.match(/(?:^|\s)@([^\s@]*)$/);
  if (!m) return cerrarSelector();
  const consulta = m[1].toLowerCase();
  const inicio = pos - m[1].length - 1;
  selectorItems = tarjetasMencionables()
    .filter((t) => !consulta || sinAcentos(t.titulo).includes(sinAcentos(consulta)) || t.id.includes(consulta))
    .slice(0, 8);
  if (!selectorItems.length) return cerrarSelector();
  selectorRango = [inicio, pos];
  selectorIndice = Math.min(selectorIndice, selectorItems.length - 1);
  selector.innerHTML = selectorItems.map((t, i) => `
    <button type="button" class="selector__item ${i === selectorIndice ? "selector__item--activo" : ""}" data-i="${i}">
      ${iconoNivel(t.nivel)}<span class="selector__titulo">${esc(t.titulo)}</span><span class="selector__col">${esc(t.coleccionTitulo)}</span>
    </button>`).join("");
  selector.querySelectorAll(".selector__item").forEach((b) => { b.onmousedown = (e) => { e.preventDefault(); selectorIndice = Number(b.dataset.i); elegirSelector(); }; });
  selector.hidden = false;
}
function moverSelector(d) {
  selectorIndice = (selectorIndice + d + selectorItems.length) % selectorItems.length;
  selector.querySelectorAll(".selector__item").forEach((b, i) => b.classList.toggle("selector__item--activo", i === selectorIndice));
}
function elegirSelector() {
  const men = selectorItems[selectorIndice];
  if (!men || !selectorRango) return cerrarSelector();
  insertarMencion(men, selectorRango);
  cerrarSelector();
}
// Inserta "@Título " en la caja, reemplazando el rango dado (o en el cursor).
function insertarMencion(t, rango) {
  const v = entrada.value;
  const [a, b] = rango || [entrada.selectionStart, entrada.selectionEnd];
  const antes = v.slice(0, a), despues = v.slice(b);
  const texto = `@${t.titulo} `;
  entrada.value = antes + texto + despues;
  const pos = antes.length + texto.length;
  entrada.setSelectionRange(pos, pos);
  ajustarEntrada();
  entrada.focus();
}
// Desde una tarjeta: ir a la conversación con la mención ya escrita.
function mencionarDesdeTarjeta(coleccion, it) {
  if (vista === "completa") { mostrandoChat = true; renderVista(); }
  const men = { coleccion, id: it.id, titulo: it.titulo || it.id };
  const v = entrada.value;
  if (v && !/\s$/.test(v)) entrada.value = v + " ";
  insertarMencion(men);
}
// Qué tarjetas nombra un texto (títulos más largos primero, para que "Pedido" no pise "Pedido urgente").
function resolverMenciones(texto) {
  const todas = tarjetasMencionables().sort((x, y) => y.titulo.length - x.titulo.length);
  const halladas = [];
  for (const t of todas) {
    if (texto.includes(`@${t.titulo}`) && !halladas.some((h) => h.coleccion === t.coleccion && h.id === t.id)) halladas.push(t);
  }
  return halladas;
}
// Resalta las menciones en el globo de la persona.
function conMenciones(texto) {
  let html = esc(texto);
  for (const t of resolverMenciones(texto)) html = html.split(esc(`@${t.titulo}`)).join(`<span class="mencion">@${esc(t.titulo)}</span>`);
  return html;
}
function sinAcentos(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

$("#form-mensaje").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (enviando) return;
  const texto = entrada.value.trim();
  if (!texto) return;
  entrada.value = "";
  ajustarEntrada();
  cerrarSelector();
  await enviarTexto(texto);
});
async function deshacerTurno(turno) {
  const r = await fetch(`/api/proyectos/${proyecto.id}/deshacer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ turno }) });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) { agregarMensaje("error", json.error || t("No se pudo deshacer.")); return; }
  await abrirProyecto(proyecto.id); // vuelve a cargar todo: conversación, Plano, prototipo
}

// Manda un mensaje como si lo hubieras escrito en el chat (desde el chat, o desde una tarjeta).
async function enviarTexto(texto, extra = {}) {
  if (enviando) return;
  const menciones = resolverMenciones(texto).map(({ coleccion, id, titulo }) => ({ coleccion, id, titulo }));
  document.querySelectorAll(".sugerencias").forEach((s) => s.remove());
  const div = agregarMensaje("usuario", texto, undefined, undefined, !!extra.accion || !!extra.revisarVersion);
  await correrTurno(`/api/proyectos/${proyecto.id}/mensaje`, { texto, menciones, idioma: idiomaActual(), ...extra }, { div, texto, extra });
}

// Vuelve a pedirle a la IA que responda al último mensaje. Lo que ya anotó en el Plano queda; lo que escribió se descarta.
async function reintentar() {
  if (enviando) return;
  // saco de la pantalla la respuesta o el error que se va a reemplazar
  const todos = [...mensajesEl.querySelectorAll(".msg")];
  for (let i = todos.length - 1; i >= 0 && !todos[i].classList.contains("msg--usuario"); i--) todos[i].remove();
  const ult = [...mensajesEl.querySelectorAll(".msg--usuario")].at(-1);
  if (ult) quitarFallido(ult);
  await correrTurno(`/api/proyectos/${proyecto.id}/reintentar`, {}, ult ? { div: ult, texto: ult.dataset.texto, extra: {} } : null);
}

const SILENCIO_MAXIMO = 90000; // sin ningún evento (ni latido) en este tiempo → la conexión se dio por muerta
const ICONO_DETENER = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
function botonEnviar(modo) {
  const b = $("#enviar");
  if (modo === "detener") { b.type = "button"; b.disabled = false; b.classList.add("btn--detener"); b.innerHTML = ICONO_DETENER; b.title = t("Detener la respuesta"); b.onclick = detener; }
  else { b.type = "submit"; b.disabled = false; b.classList.remove("btn--detener"); b.textContent = t("Enviar"); b.title = ""; b.onclick = null; }
}
async function detener() {
  if (!enviando || !proyecto) return;
  $("#enviar").disabled = true;
  try { await fetch(`/api/proyectos/${proyecto.id}/detener`, { method: "POST" }); } catch {}
}
async function correrTurno(url, body, enviado = null) {
  enviando = true;
  botonEnviar("detener");
  const burbuja = agregarMensaje("plano", "");
  let acumulado = "";
  let pararReloj = mostrarPensando(burbuja);
  const abortar = new AbortController();
  let vigilante = null;
  const vigilar = () => { clearTimeout(vigilante); vigilante = setTimeout(() => abortar.abort(new Error("silencio")), SILENCIO_MAXIMO); };
  vigilar();
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: abortar.signal });
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    await leerSSE(r.body, (evento, datos) => {
      vigilar();
      if (evento === "texto") {
        if (pararReloj) { pararReloj(); pararReloj = null; }
        if (generando && !acumulado) { generando.estado = "Escribiendo la pantalla…"; const g = document.querySelector(".proto__generando .pensando__estado"); if (g) g.textContent = generando.estado; }
        acumulado += datos.texto;
        burbuja.innerHTML = markdown(acumulado.replace(/\n?\s*\[Respuestas?:[^\]]*\]?\s*$/i, ""));
        burbuja.querySelector(".msg__estado")?.remove();
        scrollAlFinal();
      } else if (evento === "estado") {
        const s = burbuja.querySelector(".pensando__estado");
        if (s) s.textContent = datos.texto;
        else if (acumulado && !/Pensando/.test(datos.texto)) {
          // ya hay texto en la burbuja y la IA sigue trabajando con herramientas: se ve abajo, para que no parezca colgada
          let e = burbuja.querySelector(".msg__estado");
          if (!e) { e = document.createElement("span"); e.className = "msg__estado"; burbuja.append(e); }
          e.textContent = datos.texto;
        }
        if (generando) { generando.estado = datos.texto === "Pensando…" ? generando.estado : datos.texto; const g = document.querySelector(".proto__generando .pensando__estado"); if (g) g.textContent = generando.estado; }
      } else if (evento === "tarjeta") { if (datos.accion === "construccion") cargarConstruccion(); else aplicarTarjeta(datos); }
      else if (evento === "fin") { burbuja.querySelector(".msg__estado")?.remove(); if (typeof datos.texto === "string" && datos.texto.trim()) { burbuja.innerHTML = markdown(datos.texto); burbuja.dataset.texto = datos.texto; } ponerSugerencias(burbuja, datos.sugerencias); if (datos.turno) { const u = [...mensajesEl.querySelectorAll(".msg--usuario")].at(-1); if (u) u.dataset.turno = datos.turno; } plano = datos.plano; if (datos.roadmapUso) roadmapUso = datos.roadmapUso; cargarRevisiones(); renderPestanas(); renderContenido(); renderSiguiente(); if (datos.uso) { const ult = [...mensajesEl.querySelectorAll(".msg--plano")].at(-1); if (ult) ponerCosto(ult, datos.uso); } if (datos.vacio) agregarMensaje("error", t("La IA terminó sin escribir nada. Podés reintentar.")); }
      else if (evento === "error") {
        const ult = [...mensajesEl.querySelectorAll(".msg--usuario")].at(-1);
        if (datos.pendiente && ult) marcarFallido(ult, datos.mensaje, () => reintentar());
        else agregarMensaje("error", datos.mensaje);
      }
      else if (evento === "detenido") { if (pararReloj) { pararReloj(); pararReloj = null; } acumulado = ""; burbuja.remove(); agregarMensaje("sistema", t("Detuviste la respuesta. Tu mensaje quedó sin mandar: podés reenviarlo o escribir otro.")); }
      else if (evento === "aviso") { const pensando = mensajesEl.querySelector(".msg--pensando"); const div = agregarMensaje("sistema", datos.texto); if (pensando) mensajesEl.insertBefore(div, pensando); }
    });
  } catch (err) {
    const silencio = abortar.signal.aborted;
    const sinServidor = err instanceof TypeError && !silencio; // "Failed to fetch": el servidor no contestó, el mensaje nunca salió
    if (sinServidor && enviado) {
      const q = { texto: enviado.texto, extra: enviado.extra, ts: Date.now() };
      encolar(q);
      marcarFallido(enviado.div, t("No se pudo conectar con Plano. ¿Está corriendo el servidor? El mensaje queda guardado acá."), () => reenviarDeCola(q, enviado.div));
    } else if (enviado) {
      marcarFallido(enviado.div, silencio ? t("Se perdió la conexión con el servidor (90 s sin señal).") : err.message, () => reintentar());
    } else agregarMensaje("error", silencio ? t("Se perdió la conexión con el servidor (90 s sin señal). Podés reintentar.") : err.message);
  } finally {
    clearTimeout(vigilante);
    if (pararReloj) pararReloj();
    if (!acumulado.trim()) burbuja.remove();
    else { burbuja.dataset.texto = acumulado; ponerHora(burbuja, Date.now()); }
    enviando = false;
    botonEnviar("enviar");
    refrescarAcciones();
    terminarGeneracion();
    if (pestanaActiva === "prototipo") { renderContenido(); renderSiguiente(); } // los botones del visor dependen de "enviando"
    entrada.focus();
  }
}

async function leerSSE(body, onEvento) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    let corte;
    while ((corte = buffer.indexOf("\n\n")) >= 0) {
      const bloque = buffer.slice(0, corte);
      buffer = buffer.slice(corte + 2);
      let evento = "message", data = "";
      for (const linea of bloque.split("\n")) {
        if (linea.startsWith("event:")) evento = linea.slice(6).trim();
        else if (linea.startsWith("data:")) data += linea.slice(5).trim();
      }
      if (data) onEvento(evento, JSON.parse(data));
    }
  }
}

// ---------- pestañas ----------
function cantidad(clave) {
  if (clave === "prototipo") { const p = plano.prototipo || []; return p.length ? `${p.filter((x) => x.estado === "aprobada").length}/${p.length}` : 0; }
  if (clave === "construccion") { const tt = construccion?.tareas || []; return tt.length ? `${tt.filter((x) => x.estado === "aprobada").length}/${tt.length}` : 0; }
  if (clave === "identidad") return Object.keys(plano.identidad || {}).filter((k) => !["nivel", "id", "titulo"].includes(k)).length;
  return (plano[clave] || []).length;
}

function renderPestanas(subio) {
  const nav = $("#pestanas");
  nav.innerHTML = "";
  const dividida = vista === "dividida";
  if (!dividida) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pestana" + (mostrandoChat ? " pestana--activa" : "");
    b.textContent = t("Conversación");
    b.onclick = () => { mostrandoChat = true; renderVista(); };
    nav.append(b);
  }
  const visibles = COLECCIONES.filter(([clave]) => clave === "identidad" || cantidad(clave));
  if (construccion) visibles.push(["construccion", "Construcción"]);
  if (!visibles.some(([c]) => c === pestanaActiva)) pestanaActiva = "identidad";
  for (const [clave, titulo] of visibles) {
    const b = document.createElement("button");
    b.type = "button";
    const activa = clave === pestanaActiva && (dividida || !mostrandoChat);
    b.className = "pestana" + (activa ? " pestana--activa" : "");
    b.innerHTML = clave === "identidad" ? t(titulo) : `${t(titulo)}<span class="pestana__n ${subio === clave ? "pestana__n--sube" : ""}">${cantidad(clave)}</span>`;
    b.onclick = () => { pestanaActiva = clave; mostrandoChat = false; renderVista(); };
    nav.append(b);
  }
}

function aplicarTarjeta({ accion, coleccion, item }) {
  if (coleccion === "identidad") plano.identidad = { ...plano.identidad, ...item };
  else {
    const lista = plano[coleccion] || (plano[coleccion] = []);
    const i = lista.findIndex((x) => x.id === item.id);
    if (accion === "quitar") { if (i >= 0) lista.splice(i, 1); }
    else if (i >= 0) lista[i] = { ...lista[i], ...item };
    else lista.push(item);
  }
  if (coleccion === "prototipo") { pantallaActiva = item.id; modoProto = "revisar"; }
  // En vista dividida la pestaña que recibe la tarjeta pasa al frente. En completa, solo salta el contador.
  if (vista === "dividida") pestanaActiva = coleccion;
  renderPestanas(coleccion);
  if (vista === "dividida") renderContenido(item.id);
  renderSiguiente();
}

// ---------- contenido del Plano ----------
function renderContenido(resaltarId) {
  const cont = $("#contenido-plano");
  cont.innerHTML = "";
  const clave = pestanaActiva;
  if (clave === "identidad") {
    const id = plano.identidad || {};
    if (!cantidad("identidad")) return cont.append(vacio(clave));
    cont.append(renderFicha(id, Boolean(resaltarId)));
    return;
  }
  if (clave === "construccion") { cont.append(renderConstruccion()); renderModo(); return; }
  const lista = plano[clave] || [];
  if (clave === "roadmap") { cont.append(renderRoadmap(lista, resaltarId)); renderModo(); return; }
  if (clave === "prototipo") { cont.append(modoProto === "lienzo" && (plano.prototipo || []).length && !resaltarId ? renderLienzo() : renderPrototipo(resaltarId)); renderModo(); return; }
  if (!lista.length) return cont.append(vacio(clave));
  if (clave === "entidades" && modoActual() === "diagrama") { cont.append(renderDiagrama(lista, resaltarId)); renderModo(); return; }
  const grid = document.createElement("div");
  const m = modoActual();
  grid.className = m === "filas" ? "filas" : "columnas";
  for (const it of lista) grid.append(m === "filas" ? renderFila(clave, it, it.id === resaltarId) : renderTarjeta(clave, it, it.id === resaltarId));
  cont.append(grid);
  const nueva = grid.querySelector(".tarjeta--nueva");
  if (nueva) { nueva.scrollIntoView({ block: "nearest", behavior: "smooth" }); setTimeout(() => nueva.classList.remove("tarjeta--nueva"), 1600); }
  renderModo();
}

// ---------- tarjetas o filas (esquina inferior derecha del Plano) ----------
// Entidades tiene su propio modo (diagrama o filas); el resto comparte tarjetas o filas.
let modo = localStorage.getItem("plano.modo") || "tarjetas";
let modoEntidades = localStorage.getItem("plano.modoEntidades") || "diagrama";
let modoProto = localStorage.getItem("plano.modoProto") || "revisar";
const ICONO_REVISAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>`;
const ICONO_LIENZO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="5" height="9" rx="1"/><rect x="11" y="4" width="5" height="9" rx="1"/><rect x="19" y="4" width="2" height="9" rx="0.5"/><path d="M8 8h3M16 8h3M5 17v3M13 17v3"/></svg>`;
function modoActual() { return pestanaActiva === "entidades" ? modoEntidades : modo; }
const ICONO_DIAGRAMA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="6" rx="1.5"/><rect x="14" y="3" width="7" height="6" rx="1.5"/><rect x="8.5" y="15" width="7" height="6" rx="1.5"/><path d="M6.5 9v3h11V9M12 12v3"/></svg>`;
const ICONO_TARJETAS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>`;
const ICONO_FILAS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`;
function renderModo() {
  const cont = $("#modo-vista");
  cont.hidden = pestanaActiva === "identidad" || pestanaActiva === "roadmap" || pestanaActiva === "construccion" || (pestanaActiva === "prototipo" && !(plano.prototipo || []).length);
  const m = pestanaActiva === "prototipo" ? modoProto : modoActual();
  const boton = (id, icono, titulo) => `<button type="button" class="modo__btn ${m === id ? "modo__btn--activo" : ""}" data-modo="${id}" title="${titulo}">${icono}</button>`;
  cont.innerHTML = pestanaActiva === "prototipo"
    ? boton("revisar", ICONO_REVISAR, t("Revisar pantalla por pantalla")) + boton("lienzo", ICONO_LIENZO, t("Lienzo: todas las pantallas de todas las versiones"))
    : pestanaActiva === "entidades"
    ? boton("diagrama", ICONO_DIAGRAMA, "Ver como diagrama") + boton("filas", ICONO_FILAS, "Ver como filas")
    : boton("tarjetas", ICONO_TARJETAS, "Ver como tarjetas") + boton("filas", ICONO_FILAS, "Ver como filas");
  cont.querySelectorAll(".modo__btn").forEach((b) => { b.onclick = () => {
    if (pestanaActiva === "prototipo") { modoProto = b.dataset.modo; localStorage.setItem("plano.modoProto", modoProto); }
    else if (pestanaActiva === "entidades") { modoEntidades = b.dataset.modo; localStorage.setItem("plano.modoEntidades", modoEntidades); }
    else { modo = b.dataset.modo; localStorage.setItem("plano.modo", modo); }
    renderContenido();
  }; });
}

// ---------- el roadmap: una supertarjeta por versión, en acordeón ----------
const TIPOS_ROADMAP = [["pantallas", t("Pantallas")], ["entidades", t("Entidades")], ["acciones", t("Acciones")], ["integraciones", t("Integraciones")]];
const abiertas = new Set(); // versiones desplegadas
let acordeonIniciado = false; // la primera vez se abre la v1; después manda la persona

// Qué necesita cada ítem para existir: una pantalla, las entidades de las acciones que entran con ella o antes;
// una acción, su pantalla y su entidad; una entidad, las que referencia. Con eso se avisa si algo entra antes que lo que necesita.
function necesidades(tipo, id, donde, i) {
  const out = [];
  if (tipo === "entidades") {
    const e = (plano.entidades || []).find((x) => x.id === id);
    for (const d of dependenciasDe(e || {})) out.push(["entidades", d]);
  } else if (tipo === "acciones") {
    const a = (plano.acciones || []).find((x) => x.id === id);
    if (a?.pantalla) out.push(["pantallas", a.pantalla]);
    if (a?.entidad) out.push(["entidades", a.entidad]);
  } else if (tipo === "pantallas") {
    for (const a of (plano.acciones || []).filter((x) => x.pantalla === id)) {
      const w = donde?.get("acciones/" + a.id);
      if (a.entidad && (w === undefined || w <= i)) out.push(["entidades", a.entidad]);
    }
  }
  return out;
}

// Manda al agente los hallazgos de la revisión mecánica para que cierre lo que pueda y pregunte lo demás.
function resolverVersion(v) {
  if (vista === "completa") { mostrandoChat = true; renderVista(); }
  enviarTexto(`Revisemos la ${v.id} antes de construirla.`, { revisarVersion: v.id });
}
const tituloVersion = (v) => String(v.titulo || v.id).replace(/^\s*v\d+\s*[·:\-–]\s*/i, "");

function renderRoadmap(versiones, resaltarId) {
  const wrap = document.createElement("div");
  wrap.className = "roadmap";
  const ordenadas = [...versiones].sort((a, b) => (a.orden || 99) - (b.orden || 99));
  if (ordenadas.length && roadmapUso) {
    const p = document.createElement("p"); p.className = "roadmap__costo";
    p.textContent = t("Armado {cuando} · {costo}", { cuando: cuando(roadmapUso.ts), costo: costoCorto(roadmapUso) });
    wrap.append(p);
  }
  if (!ordenadas.length) {
    const v = vacio("roadmap");
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn btn--primario"; b.textContent = t("Armar el roadmap");
    b.style.marginTop = "14px";
    b.onclick = () => derivarRoadmap();
    v.append(b);
    wrap.append(v);
    return wrap;
  }
  if (!acordeonIniciado) { abiertas.add(ordenadas[0].id); acordeonIniciado = true; }
  if (resaltarId) abiertas.add(resaltarId);

  const donde = new Map();
  ordenadas.forEach((v, i) => { for (const [tipo] of TIPOS_ROADMAP) for (const id of v[tipo] || []) donde.set(tipo + "/" + id, i); });
  const sueltos = [];
  for (const [tipo] of TIPOS_ROADMAP) for (const it of plano[tipo] || []) if (!donde.has(tipo + "/" + it.id) && it.nivel !== "propuesto") sueltos.push([tipo, it]);
  let rojos = 0;

  const itemEl = (tipo, id, desdeId, i) => {
    const it = (plano[tipo] || []).find((x) => x.id === id);
    const faltan = i === undefined ? [] : necesidades(tipo, id, donde, i).filter(([t, d]) => { const w = donde.get(t + "/" + d); return w === undefined ? (plano[t] || []).some((x) => x.id === d) : w > i; });
    if (faltan.length) rojos++;
    const el = document.createElement("div");
    el.className = "ritem" + (faltan.length ? " ritem--falta" : "");
    el.innerHTML = `${iconoNivel(it?.nivel || "blando")}<button type="button" class="ritem__titulo">${esc(recortar(it?.titulo || id, 60))}</button><button type="button" class="ritem__menu" title="Mover a otra versión">⋯</button>` +
      (faltan.length ? `<span class="ritem__aviso">necesita ${esc(faltan.map(([t, d]) => (plano[t] || []).find((x) => x.id === d)?.titulo || d).join(", "))}</span>` : "");
    el.querySelector(".ritem__titulo").onclick = () => { if (it) abrirDetalle(tipo, it); };
    el.querySelector(".ritem__menu").onclick = (e) => abrirMenu(e.currentTarget, [
      ...ordenadas.filter((v) => v.id !== desdeId).map((v) => ({ texto: `Mover a v${v.orden} · ${tituloVersion(v)}`, fn: () => moverEnRoadmap(tipo, id, desdeId, v.id) })),
      ...(desdeId ? [{ texto: "Sacar de esta versión", fn: () => moverEnRoadmap(tipo, id, desdeId, null) }] : []),
    ]);
    return el;
  };

  ordenadas.forEach((v, i) => {
    const card = document.createElement("section");
    const abierta = abiertas.has(v.id);
    card.className = "version" + (abierta ? " version--abierta" : "") + (v.id === resaltarId ? " tarjeta--nueva" : "");
    const total = TIPOS_ROADMAP.reduce((n, [t]) => n + (v[t] || []).length, 0);
    card.innerHTML = `
      <button type="button" class="version__cab">
        <span class="version__flecha">▸</span>
        <span class="version__n">v${v.orden || i + 1}</span>
        <span class="version__titulo">${esc(tituloVersion(v))}</span>
        ${iconoNivel(v.nivel || "propuesto")}
        <span class="version__objetivo">${esc(v.objetivo || v.descripcion || "")}</span>
        <span class="version__resumen">${TIPOS_ROADMAP.map(([t, tt]) => (v[t] || []).length ? `${(v[t] || []).length} ${tt.toLowerCase()}` : "").filter(Boolean).join(" · ") || "vacía"}${(revisiones[v.id] || []).length ? ` · <span class="version__pendientes">${t("{n} por resolver", { n: revisiones[v.id].length })}</span>` : ""}</span>
      </button>
      <div class="version__cuerpo"></div>`;
    card.querySelector(".version__cab").onclick = () => { abiertas.has(v.id) ? abiertas.delete(v.id) : abiertas.add(v.id); renderContenido(); };
    const cuerpo = card.querySelector(".version__cuerpo");
    if (abierta) {
      for (const [tipo, titulo] of TIPOS_ROADMAP) {
        const ids = v[tipo] || [];
        const grupo = document.createElement("div");
        grupo.className = "version__grupo";
        grupo.innerHTML = `<div class="version__tipo">${titulo}<span>${ids.length}</span></div>`;
        if (!ids.length) grupo.insertAdjacentHTML("beforeend", `<div class="version__nada">—</div>`);
        for (const id of ids) grupo.append(itemEl(tipo, id, v.id, i));
        cuerpo.append(grupo);
      }
      const hallazgos = revisiones[v.id] || [];
      if (hallazgos.length) {
        const rev = document.createElement("div");
        rev.className = "version__revision";
        rev.innerHTML = `<div class="version__tipo">${t("Antes de construir")}<span>${hallazgos.length}</span></div><ul>${hallazgos.map((x) => `<li>${esc(x.texto)}</li>`).join("")}</ul>`;
        const b = document.createElement("button");
        b.type = "button"; b.className = "btn btn--primario btn--chico"; b.textContent = t("Resolverlo con el agente");
        b.onclick = () => resolverVersion(v);
        rev.append(b);
        cuerpo.append(rev);
      }
      const pie = document.createElement("div");
      pie.className = "version__pie";
      const estadoV = estadoVersion(v);
      if (estadoV === "siguiente" && (v.pantallas || []).length) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "btn btn--primario btn--chico"; b.textContent = t("Prototipar esta versión");
        b.onclick = () => iniciarPrototipo(v);
        pie.append(b);
      } else if (estadoV === "en-curso") {
        const b = document.createElement("button");
        b.type = "button"; b.className = "btn btn--secundario btn--chico"; b.textContent = t("Ver el prototipo");
        b.onclick = () => { pestanaActiva = "prototipo"; mostrandoChat = false; renderVista(); };
        pie.append(b);
      } else if (estadoV === "aprobada") {
        const s = document.createElement("span"); s.className = "version__estado"; s.textContent = t("Prototipo aprobado"); pie.append(s);
      }
      const det = document.createElement("button");
      det.type = "button"; det.className = "btn btn--secundario btn--chico"; det.textContent = t("Mencionar");
      det.onclick = () => mencionarDesdeTarjeta("roadmap", v);
      pie.append(det);
      cuerpo.append(pie);
    }
    wrap.append(card);
  });

  if (sueltos.length) {
    const s = document.createElement("section");
    s.className = "version version--abierta version--sueltos";
    s.innerHTML = `<div class="version__cab version__cab--fija"><span class="version__titulo">Sin versión</span><span class="version__objetivo">Cosas del Plano que no están en ninguna versión. Movelas a una desde el menú de cada ítem.</span></div><div class="version__cuerpo"></div>`;
    const cuerpo = s.querySelector(".version__cuerpo");
    for (const [tipo, titulo] of TIPOS_ROADMAP) {
      const ids = sueltos.filter(([t]) => t === tipo);
      if (!ids.length) continue;
      const grupo = document.createElement("div");
      grupo.className = "version__grupo";
      grupo.innerHTML = `<div class="version__tipo">${titulo}<span>${ids.length}</span></div>`;
      for (const [, it] of ids) grupo.append(itemEl(tipo, it.id, null, undefined));
      cuerpo.append(grupo);
    }
    wrap.append(s);
  }

  const barra = document.createElement("div");
  barra.className = "roadmap__barra";
  barra.innerHTML = `<span>${ordenadas.length} versiones${rojos ? ` · ${rojos} ${rojos === 1 ? "cosa entra" : "cosas entran"} antes que lo que necesita` : ""}${sueltos.length ? ` · ${sueltos.length} sin versión` : ""}</span><span class="roadmap__ayuda">Para cambiar algo, usá el menú de cada ítem o pedíselo a Plano en la conversación.</span>`;
  wrap.prepend(barra);
  return wrap;
}

// Estado del prototipo de una versión: "aprobada" (todas sus pantallas), "en-curso", "siguiente" (le toca) o "bloqueada" (falta la anterior).
function estadoVersion(v) {
  const estados = new Map((plano.prototipo || []).map((p) => [p.id, p.estado]));
  const pantallas = v.pantallas || [];
  const iniciada = pantallas.some((id) => estados.has(id));
  if (pantallas.length && pantallas.every((id) => estados.get(id) === "aprobada")) return "aprobada";
  if (iniciada) return "en-curso";
  const ordenadas = [...(plano.roadmap || [])].sort((a, b) => (a.orden || 99) - (b.orden || 99));
  const i = ordenadas.findIndex((x) => x.id === v.id);
  const anteriores = ordenadas.slice(0, i);
  return anteriores.every((a) => !(a.pantallas || []).length || estadoVersion(a) === "aprobada") ? "siguiente" : "bloqueada";
}
function versionEnCurso() {
  const ordenadas = [...(plano.roadmap || [])].sort((a, b) => (a.orden || 99) - (b.orden || 99));
  return ordenadas.find((v) => estadoVersion(v) === "en-curso") || [...ordenadas].reverse().find((v) => estadoVersion(v) === "aprobada") || null;
}

async function iniciarPrototipo(v) {
  const r = await fetch(`/api/proyectos/${proyecto.id}/prototipo/iniciar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: v.id }) });
  const json = await r.json();
  if (!r.ok) return agregarMensaje("error", json.error);
  plano = json.plano;
  pestanaActiva = "prototipo"; mostrandoChat = false;
  pantallaActiva = (v.pantallas || [])[0] || null;
  renderVista();
  generarPantalla(pantallaActiva);
}

// ---------- el prototipo: lista de pantallas + visor + aprobar / devolver ----------
let pantallaActiva = null;
let sincronizandoPrototipo = null; // versión cuyas pantallas faltantes ya se pidieron registrar
let marco = localStorage.getItem("plano.marco") || "auto"; // auto | celular | escritorio
let zoomMarco = null; // { escala, dx, dy } del marco de celular; null = ajustado a la ventana
let generando = null;  // { pantalla, inicio, estado } mientras la IA trabaja en una pantalla
let roadmapUso = null; // qué costó armar el roadmap
let revisiones = {}; // versión → hallazgos de la revisión mecánica
async function cargarRevisiones() {
  if (!proyecto) return;
  try { revisiones = await (await fetch(`/api/proyectos/${proyecto.id}/revision`)).json(); } catch { revisiones = {}; }
  if (pestanaActiva === "roadmap") renderContenido();
  renderSiguiente();
}
let viendoVersion = null; // { pantalla, n } cuando se mira una versión del historial
let estadoVisto = null; // { pantalla, estado } el estado de pantalla elegido en la barra; null = el primero
// Los estados de una pantalla (cuenta nueva / con datos, con créditos / sin…) están en el Plano; el selector va en la barra, afuera de la pantalla.
const estadosDe = (p) => (Array.isArray(p?.estados) ? p.estados : []).map((e) => (typeof e === "string" ? { id: e, titulo: e } : { id: e.id || e.titulo, titulo: e.titulo || e.id, descripcion: e.descripcion })).filter((e) => e.id);
let relojGenerando = null;
const TIPO_APP = () => ({ web: t("Aplicación web"), escritorio: t("Aplicación de escritorio"), movil: t("Aplicación móvil") });
const tipoApp = () => (["web", "escritorio", "movil"].includes(plano?.identidad?.tipo_app) ? plano.identidad.tipo_app : "web");
const dispositivosDe = (p) => { if (tipoApp() === "movil") return ["celular"]; if (tipoApp() === "escritorio") return ["escritorio"]; if (Array.isArray(p?.dispositivos) && p.dispositivos.length) return p.dispositivos; const d = plano.identidad?.dispositivos; return d === "celular" ? ["celular"] : d === "escritorio" ? ["escritorio"] : ["celular", "escritorio"]; };

let versionProtoElegida = null; // la persona puede mirar el prototipo de otra versión que ya tiene pantallas
function versionesConPrototipo() {
  const ids = new Set((plano.prototipo || []).map((p) => p.id));
  return [...(plano.roadmap || [])].sort((a, b) => (a.orden || 99) - (b.orden || 99)).filter((v) => (v.pantallas || []).some((id) => ids.has(id)));
}
function renderPrototipo(resaltarId) {
  const wrap = document.createElement("div");
  wrap.className = "proto";
  const entradas = plano.prototipo || [];
  const conProto = versionesConPrototipo();
  const v = conProto.find((x) => x.id === versionProtoElegida) || versionEnCurso() || conProto.at(-1);
  if (!v || !entradas.length) return vacio("prototipo");
  const estados = new Map(entradas.map((p) => [p.id, p]));
  const pantallas = (v.pantallas || []).map((id) => (plano.pantallas || []).find((p) => p.id === id)).filter(Boolean);
  // pantallas que el agente sumó a la versión después de arrancar el prototipo: se registran como pendientes
  const faltan = pantallas.filter((p) => !estados.has(p.id));
  if (faltan.length && sincronizandoPrototipo !== v.id) {
    sincronizandoPrototipo = v.id;
    fetch(`/api/proyectos/${proyecto.id}/prototipo/iniciar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: v.id }) })
      .then((r) => r.json()).then((json) => { if (json.plano) { plano = json.plano; renderPestanas(); renderContenido(); renderSiguiente(); } }).catch(() => {});
  }
  const existe = (id) => pantallas.some((p) => p.id === id);
  if (resaltarId && existe(resaltarId)) pantallaActiva = resaltarId;
  if (!pantallaActiva || !existe(pantallaActiva)) pantallaActiva = pantallas.find((p) => ["generada", "devuelta"].includes(estados.get(p.id)?.estado))?.id || pantallas[0]?.id;
  const actual = pantallas.find((p) => p.id === pantallaActiva);
  const est = estados.get(pantallaActiva) || {};

  const lista = document.createElement("aside");
  lista.className = "proto__lista";
  lista.innerHTML = conProto.length > 1
    ? `<div class="proto__version"><select class="proto__selector" aria-label="${t("Versión")}">${conProto.map((x) => `<option value="${esc(x.id)}" ${x.id === v.id ? "selected" : ""}>${esc(x.id)} · ${esc(tituloVersion(x))}</option>`).join("")}</select></div>`
    : `<div class="proto__version"><span class="version__n">${esc(v.id)}</span><span>${esc(tituloVersion(v))}</span></div>`;
  lista.querySelector(".proto__selector")?.addEventListener("change", (e) => { versionProtoElegida = e.target.value; pantallaActiva = null; zoomMarco = null; renderContenido(); });
  for (const p of pantallas) {
    const e = estados.get(p.id) || { estado: "pendiente" };
    const b = document.createElement("button");
    b.type = "button";
    b.className = "proto__item proto__item--" + e.estado + (p.id === pantallaActiva ? " proto__item--activa" : "");
    const gen = generando?.pantalla === p.id;
    b.innerHTML = `<span class="proto__punto ${gen ? "proto__punto--gen" : ""}"></span><span class="proto__titulo">${esc(recortar(p.titulo, 44))}</span><span class="proto__estado">${gen ? "generando…" : ESTADO_TEXTO[e.estado] || e.estado}</span>`;
    b.onclick = () => { pantallaActiva = p.id; zoomMarco = null; renderContenido(); };
    lista.append(b);
  }
  wrap.append(lista);

  const visor = document.createElement("section");
  visor.className = "proto__visor";
  if (!actual) { wrap.append(visor); return wrap; }
  const hayHtml = ["generada", "devuelta", "aprobada"].includes(est.estado);
  const disp = dispositivosDe(actual);
  const marcoActual = disp.includes(marco) ? marco : disp[0];
  const enCurso = generando?.pantalla === actual.id;
  if (viendoVersion && viendoVersion.pantalla !== actual.id) viendoVersion = null;
  const src = viendoVersion ? `/prototipo/${esc(proyecto.id)}/historial/${esc(actual.id)}/${viendoVersion.n}` : `/prototipo/${esc(proyecto.id)}/${esc(actual.id)}.html`;
  const estadosPant = estadosDe(actual);
  if (estadoVisto && estadoVisto.pantalla !== actual.id) estadoVisto = null;
  const estadoActual = estadosPant.find((e) => e.id === estadoVisto?.estado)?.id || estadosPant[0]?.id || null;
  const paramEstado = estadoActual && estadoActual !== estadosPant[0]?.id ? `estado=${encodeURIComponent(estadoActual)}&` : "";
  const historial = est.historial || [];
  const versionActual = historial.at(-1)?.n;
  // lo que costó la pantalla no va en la barra: aparece al pasar el mouse por el título
  const costoTexto = est.uso_total?.usd ? `${usd(est.uso_total.usd)}${est.uso_total.turnos > 1 ? ` en ${est.uso_total.turnos} vueltas` : ""}${est.uso_total.turnos > 1 && historial.at(-1)?.uso ? ` · ${usd(historial.at(-1).uso.usd)} la última` : ""}` : "";
  visor.innerHTML = `
    <div class="proto__cab">
      <div class="proto__cab-texto"><strong ${costoTexto ? `class="pista" data-pista="${esc(costoTexto)}"` : ""}>${esc(actual.titulo)}</strong><span>${viendoVersion ? `Viendo la versión ${viendoVersion.n} de ${versionActual} · solo lectura` : esc(ESTADO_TEXTO[est.estado] || est.estado) + (est.estado === "devuelta" && est.comentario ? ` · "${esc(recortar(est.comentario, 80))}"` : "") + (historial.length > 1 ? ` · versión ${versionActual}` : "") + (estadoActual && estadoActual !== estadosPant[0]?.id ? ` · ${esc(estadosPant.find((e) => e.id === estadoActual)?.titulo || estadoActual)}` : "")}</span></div>
      <div class="proto__acciones"></div>
      <div class="proto__marcos">
        ${disp.includes("celular") ? `<button type="button" class="modo__btn ${marcoActual === "celular" ? "modo__btn--activo" : ""}" data-marco="celular" title=t("Ver como en un celular")>${ICONO_CELULAR}</button>` : ""}
        ${disp.includes("escritorio") ? `<button type="button" class="modo__btn ${marcoActual === "escritorio" ? "modo__btn--activo" : ""}" data-marco="escritorio" title=t("Ver como en escritorio")>${ICONO_ESCRITORIO}</button>` : ""}
        ${estadosPant.length > 1 ? `<button type="button" class="modo__btn ${estadoActual !== estadosPant[0]?.id ? "modo__btn--activo" : ""}" data-estados="1" title="${esc(t("Estado de la pantalla"))}: ${esc(estadosPant.find((e) => e.id === estadoActual)?.titulo || "")}">${ICONO_ESTADOS}</button>` : ""}
        ${historial.length > 1 ? `<button type="button" class="modo__btn" data-historial="1" title="Historial de versiones de esta pantalla">${ICONO_HISTORIAL}</button>` : ""}
        <a class="modo__btn" href="/navegar/${esc(proyecto.id)}#${esc(actual.id)}" target="_blank" rel="noopener" title=t("Navegar la app en una pestaña nueva: todas las pantallas enlazadas, sin Plano alrededor")>${ICONO_ABRIR}</a>
      </div>
    </div>
    <div class="proto__comentario-zona" hidden></div>
    <div class="proto__lienzo proto__lienzo--${marcoActual}">
      ${hayHtml ? `<div class="marco-caja"><div class="marco-zoom"><div class="marco marco--${marcoActual}"><iframe class="proto__iframe" src="${src}?${paramEstado}${marcoActual === "celular" ? "celular=1&" : ""}t=${est.generada_en || ""}" title="${esc(actual.titulo)}"></iframe></div>${marcoActual === "celular" ? '<div class="bisel"></div>' : ""}</div></div>` : ""}
      ${hayHtml && marcoActual === "celular" ? `<div class="proto__zoom"><button type="button" class="modo__btn modo__btn--texto" data-zoom="-" title=t("Alejar (Ctrl + rueda)")>−</button><button type="button" class="modo__btn" data-ajustar="1" title=t("Ajustar a la ventana")>⤢</button><button type="button" class="modo__btn modo__btn--texto" data-zoom="+" title=t("Acercar (Ctrl + rueda)")>+</button></div>` : ""}
      ${enCurso ? `<div class="proto__generando ${hayHtml ? "proto__generando--encima" : ""}"><span class="pensando"><span class="pensando__puntos"><i></i><i></i><i></i></span><span class="pensando__estado">${esc(generando.estado)}</span> <span class="pensando__tiempo">${Math.round((Date.now() - generando.inicio) / 1000)} s</span></span><span class="proto__generando-nota">Podés seguir mirando el resto mientras tanto.</span></div>` : (!hayHtml ? `<div class="proto__vacio"><strong>${esc(actual.titulo)}</strong>Todavía no se generó.</div>` : "")}
    </div>`;
  visor.querySelectorAll("[data-marco]").forEach((b) => { b.onclick = () => { marco = b.dataset.marco; localStorage.setItem("plano.marco", marco); zoomMarco = null; renderContenido(); }; });
  // los estados de la pantalla se eligen de una lista; cambiar recarga solo la pantalla (el iframe) con ?estado=, el zoom y el marco quedan
  const be = visor.querySelector("[data-estados]");
  if (be) be.onclick = () => abrirMenu(be, estadosPant.map((e) => ({ texto: e.titulo, detalle: e.descripcion, activo: e.id === estadoActual, fn: () => { estadoVisto = { pantalla: actual.id, estado: e.id }; renderContenido(); } })));
  const aj = visor.querySelector("[data-ajustar]");
  if (aj) aj.onclick = () => { zoomMarco = null; ajustarMarco(visor); };
  visor.querySelectorAll("[data-zoom]").forEach((b) => { b.onclick = () => zoomCelular(visor, b.dataset.zoom === "+" ? 1.25 : 1 / 1.25); });
  const acc = visor.querySelector(".proto__acciones");
  const zona = visor.querySelector(".proto__comentario-zona");
  const h = visor.querySelector("[data-historial]");
  if (h) h.onclick = () => mostrarHistorial(zona, actual, historial);
  if (viendoVersion) {
    const b = document.createElement("button"); b.type = "button"; b.className = "btn btn--chico btn--secundario"; b.textContent = t("Volver a la actual"); b.onclick = () => { viendoVersion = null; renderContenido(); }; acc.append(b);
    const r = document.createElement("button"); r.type = "button"; r.className = "btn btn--chico btn--primario"; r.textContent = t("Restaurar la versión {n}", { n: viendoVersion.n }); r.onclick = () => restaurarVersion(actual.id, viendoVersion.n); acc.append(r);
    wrap.append(visor); requestAnimationFrame(() => ajustarMarco(visor)); return wrap;
  }
  const btn = (texto, clase, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn btn--chico " + clase; b.textContent = texto; b.onclick = fn; b.disabled = enviando || enCurso; acc.append(b); return b; };
  if (est.estado === "pendiente") btn(enCurso ? "Generando…" : "Generar esta pantalla", "btn--primario", () => generarPantalla(actual.id));
  if (est.estado === "generada" || est.estado === "devuelta") {
    btn(t("Aprobar"), "btn--primario", () => aprobar(actual.id));
    btn(t("Devolver con un comentario"), "btn--secundario", () => pedirComentario(zona, actual.id));
    if (est.estado === "devuelta" && !enCurso) btn("Pedir la corrección", "btn--secundario", () => revisarPantalla(actual.id, est.comentario));
  }
  if (est.estado === "aprobada") {
    const s = document.createElement("span"); s.className = "proto__aprobada"; s.textContent = t("Aprobada"); acc.append(s);
    btn("Devolver igual", "btn--fantasma", () => pedirComentario(zona, actual.id));
  }
  // si se estaba escribiendo una devolución de esta pantalla, la caja vuelve con el texto
  if (borradorDevolver?.id === actual.id && ["generada", "devuelta", "aprobada"].includes(est.estado)) pedirComentario(zona, actual.id, { foco: !escribiendoEnOtroLado() });
  wrap.append(visor);
  // el marco de celular es de tamaño real (390×844) y se escala para entrar en la ventana, salvo en 1:1
  requestAnimationFrame(() => ajustarMarco(visor));
  return wrap;
}

function ajustarMarco(visor) {
  const lienzo = visor.querySelector(".proto__lienzo"), caja = visor.querySelector(".marco-caja"), m = visor.querySelector(".marco--celular");
  if (!lienzo || !caja || !m) return;
  const W = 390 + 20, H = 844 + 20; // con el bisel
  if (!zoomMarco) {
    const escala = Math.min(1, (lienzo.clientHeight - 24) / H, (lienzo.clientWidth - 24) / W);
    zoomMarco = { escala, dx: (lienzo.clientWidth - W * escala) / 2, dy: (lienzo.clientHeight - H * escala) / 2, auto: true };
  }
  aplicarZoom(caja);
  if (lienzo.dataset.zoomListo) return;
  lienzo.dataset.zoomListo = "1";
  // overflow: hidden igual se desplaza cuando algo adentro del iframe recibe foco; eso corre el celular y la pastilla de estados
  lienzo.addEventListener("scroll", () => { lienzo.scrollTop = 0; lienzo.scrollLeft = 0; });
  // rueda sobre el fondo: acercar o alejar centrado en el cursor
  lienzo.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = lienzo.getBoundingClientRect();
    zoomCelular(visor, e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  // Ctrl + rueda (o pellizco en el trackpad) sobre la pantalla: es del mismo origen, así que se puede escuchar adentro; la rueda sola la scrollea
  const iframe = visor.querySelector(".proto__iframe");
  const engancharRueda = () => {
    try {
      const doc = iframe.contentWindow.document;
      if (doc.plano_rueda) return;
      doc.plano_rueda = true;
      doc.addEventListener("wheel", (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const r = lienzo.getBoundingClientRect(), ri = iframe.getBoundingClientRect();
        zoomCelular(visor, e.deltaY < 0 ? 1.1 : 1 / 1.1, ri.left - r.left + e.clientX * zoomMarco.escala, ri.top - r.top + e.clientY * zoomMarco.escala);
      }, { passive: false });
    } catch {}
  };
  if (iframe) { iframe.addEventListener("load", engancharRueda); if (iframe.contentDocument?.readyState === "complete" && iframe.contentDocument.location.href !== "about:blank") engancharRueda(); }
  // arrastrar el fondo (no la pantalla, que tiene sus propios gestos) para mover el celular
  let gesto = null;
  lienzo.addEventListener("pointerdown", (e) => { if (e.button !== 0 || e.target.closest(".proto__iframe, .proto__generando, .proto__zoom")) return; gesto = { x: e.clientX - zoomMarco.dx, y: e.clientY - zoomMarco.dy }; lienzo.setPointerCapture(e.pointerId); lienzo.classList.add("proto__lienzo--arrastrando"); });
  lienzo.addEventListener("pointermove", (e) => { if (!gesto) return; zoomMarco = { ...zoomMarco, dx: e.clientX - gesto.x, dy: e.clientY - gesto.y }; aplicarZoom(caja); });
  const soltar = () => { gesto = null; lienzo.classList.remove("proto__lienzo--arrastrando"); };
  lienzo.addEventListener("pointerup", soltar); lienzo.addEventListener("pointercancel", soltar);
}
// Se usa zoom (no transform: scale): con un ancestro escalado, Chrome deja de recortar el iframe por las esquinas redondeadas
function aplicarZoom(caja) {
  caja.style.left = zoomMarco.dx + "px";
  caja.style.top = zoomMarco.dy + "px";
  const z = caja.querySelector(".marco-zoom");
  if (z) z.style.zoom = zoomMarco.escala;
}
function zoomCelular(visor, factor, cx, cy) {
  const lienzo = visor.querySelector(".proto__lienzo"), caja = visor.querySelector(".marco-caja");
  if (!lienzo || !caja || !zoomMarco) return;
  if (cx === undefined) { cx = lienzo.clientWidth / 2; cy = lienzo.clientHeight / 2; }
  const nueva = Math.min(3, Math.max(0.25, zoomMarco.escala * factor));
  zoomMarco = { escala: nueva, dx: cx - (cx - zoomMarco.dx) * (nueva / zoomMarco.escala), dy: cy - (cy - zoomMarco.dy) * (nueva / zoomMarco.escala) };
  aplicarZoom(caja);
}
window.addEventListener("resize", () => { const v = document.querySelector(".proto__visor"); if (v && zoomMarco?.auto) { zoomMarco = null; ajustarMarco(v); } });
const ESTADO_TEXTO = { pendiente: t("pendiente"), generada: t("para revisar"), devuelta: t("devuelta"), aprobada: t("aprobada") };
const ICONO_CELULAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>`;
const ICONO_ESCRITORIO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>`;
const ICONO_CANDADO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
const ICONO_ESTADOS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 20.5 12 12 20.5 3.5 12Z"/><path d="M12 8.5 15.5 12 12 15.5 8.5 12Z"/></svg>`;
const ICONO_HISTORIAL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></svg>`;
const ICONO_ABRIR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>`;

function mostrarHistorial(cont, pantalla, historial) {
  cont.hidden = false;
  cont.innerHTML = "";
  cont.classList.add("proto__comentario-zona--historial");
  const ul = document.createElement("div");
  ul.className = "historial";
  const actual = historial.at(-1)?.n;
  for (const h of [...historial].reverse()) {
    const fila = document.createElement("div");
    fila.className = "historial__fila" + (h.n === actual ? " historial__fila--actual" : "");
    fila.innerHTML = `<span class="historial__n">v${h.n}</span><span class="historial__motivo">${esc(h.motivo || "")}</span><span class="historial__cuando">${h.uso ? costoCorto(h.uso) + " · " : ""}${esc(cuando(Date.parse(h.ts)))}${h.n === actual ? " · actual" : ""}</span>`;
    if (h.n !== actual) {
      const ver = document.createElement("button"); ver.type = "button"; ver.className = "btn btn--chico btn--secundario"; ver.textContent = t("Ver"); ver.onclick = () => { viendoVersion = { pantalla: pantalla.id, n: h.n }; renderContenido(); };
      const res = document.createElement("button"); res.type = "button"; res.className = "btn btn--chico btn--fantasma"; res.textContent = t("Restaurar"); res.title = `Vuelve a la v${h.n} y borra las posteriores`; res.onclick = () => restaurarVersion(pantalla.id, h.n);
      fila.append(ver, res);
    }
    ul.append(fila);
  }
  const cerrar = document.createElement("button"); cerrar.type = "button"; cerrar.className = "btn btn--chico btn--fantasma"; cerrar.textContent = t("Cerrar"); cerrar.onclick = () => renderContenido();
  cont.append(ul, cerrar);
}
async function restaurarVersion(id, n) {
  const r = await fetch(`/api/proyectos/${proyecto.id}/prototipo/${encodeURIComponent(id)}/restaurar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ n }) });
  const json = await r.json();
  if (!r.ok) return agregarMensaje("error", json.error);
  plano = json.plano; viendoVersion = null;
  renderPestanas(); renderContenido(); renderSiguiente();
}

// Lo que se viene escribiendo para devolver sobrevive a cualquier redibujo (cambiar de marco, de estado, un evento que llega):
// el borrador vive acá, por pantalla, y la caja se vuelve a abrir sola con el texto.
let borradorDevolver = null; // { id, texto }
// Al redibujar con un borrador abierto, la caja recupera el foco salvo que la persona esté escribiendo en otro campo (el chat, por ejemplo).
const escribiendoEnOtroLado = () => { const a = document.activeElement; return Boolean(a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && !a.classList.contains("proto__comentario")); };
function pedirComentario(cont, id, { foco = true } = {}) {
  cont.hidden = false;
  cont.innerHTML = "";
  if (borradorDevolver?.id !== id) borradorDevolver = { id, texto: "" };
  const ta = document.createElement("textarea");
  ta.className = "proto__comentario"; ta.rows = 1; ta.placeholder = t("Qué hay que cambiar. Ej.: el botón enviar tiene que ser púrpura y más grande. Enter devuelve, Shift+Enter baja de línea.");
  ta.value = borradorDevolver.texto;
  const ajustar = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; };
  ta.oninput = () => { borradorDevolver = { id, texto: ta.value }; ajustar(); };
  ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar.click(); } if (e.key === "Escape") cancelar.click(); };
  const enviar = document.createElement("button"); enviar.type = "button"; enviar.className = "btn btn--primario"; enviar.textContent = t("Devolver");
  const cancelar = document.createElement("button"); cancelar.type = "button"; cancelar.className = "btn btn--secundario"; cancelar.textContent = t("Cancelar");
  enviar.onclick = async () => { const c = ta.value.trim(); if (!c) return ta.focus(); borradorDevolver = null; await devolver(id, c); };
  cancelar.onclick = () => { borradorDevolver = null; renderContenido(); };
  cont.append(ta, enviar, cancelar);
  if (ta.value) requestAnimationFrame(ajustar);
  if (foco) requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }); // recién cuando la caja está en la página
}

function generarPantalla(id) {
  if (enviando || !id) return;
  const p = (plano.pantallas || []).find((x) => x.id === id);
  const texto = t("Generá la pantalla «{p}».", { p: p?.titulo || id });
  agregarMensaje("usuario", texto, undefined, undefined, true);
  empezarGeneracion(id, t("Generando la pantalla…"));
  correrTurno(`/api/proyectos/${proyecto.id}/mensaje`, { texto, menciones: [], idioma: idiomaActual(), prototipo: { pantalla: id, modo: "generar" } });
}
function revisarPantalla(id, comentario) {
  if (enviando || !id) return;
  const p = (plano.pantallas || []).find((x) => x.id === id);
  const texto = t("Corregí la pantalla «{p}»: {c}", { p: p?.titulo || id, c: comentario });
  agregarMensaje("usuario", texto, undefined, undefined, true);
  empezarGeneracion(id, t("Corrigiendo la pantalla…"));
  correrTurno(`/api/proyectos/${proyecto.id}/mensaje`, { texto, menciones: [], idioma: idiomaActual(), prototipo: { pantalla: id, modo: "revisar", comentario } });
}
function empezarGeneracion(id, estado) {
  generando = { pantalla: id, inicio: Date.now(), estado };
  pantallaActiva = id;
  clearInterval(relojGenerando);
  relojGenerando = setInterval(() => { const el = document.querySelector(".proto__generando .pensando__tiempo"); if (el && generando) el.textContent = `${Math.round((Date.now() - generando.inicio) / 1000)} s`; }, 1000);
  if (pestanaActiva === "prototipo") renderContenido();
}
function terminarGeneracion() { generando = null; clearInterval(relojGenerando); relojGenerando = null; }
async function aprobar(id) {
  const r = await fetch(`/api/proyectos/${proyecto.id}/prototipo/${encodeURIComponent(id)}/aprobar`, { method: "POST" });
  const json = await r.json();
  if (!r.ok) return agregarMensaje("error", json.error);
  plano = json.plano;
  // paso a la siguiente pendiente, si hay
  const v = versionEnCurso();
  const estados = new Map((plano.prototipo || []).map((p) => [p.id, p.estado]));
  const ids = v?.pantallas || [], desde = ids.indexOf(id);
  const orden = [...ids.slice(desde + 1), ...ids.slice(0, desde)];
  pantallaActiva = orden.find((pid) => estados.get(pid) !== "aprobada") || id;
  zoomMarco = null;
  renderPestanas(); renderContenido(); renderSiguiente();
}
async function devolver(id, comentario) {
  const r = await fetch(`/api/proyectos/${proyecto.id}/prototipo/${encodeURIComponent(id)}/devolver`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ comentario }) });
  const json = await r.json();
  if (!r.ok) return agregarMensaje("error", json.error);
  plano = json.plano;
  renderPestanas(); renderContenido(); renderSiguiente();
  revisarPantalla(id, comentario);
}

// menú contextual chico, sin librerías
let menuAbierto = null;
function abrirMenu(ancla, opciones) {
  cerrarMenu();
  const m = document.createElement("div");
  m.className = "menu";
  for (const o of opciones) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = o.texto;
    if (o.detalle) { const d = document.createElement("small"); d.textContent = o.detalle; b.append(d); }
    if (o.activo) b.classList.add("menu__activo");
    if (o.peligro) b.classList.add("menu__peligro");
    b.onclick = () => { cerrarMenu(); o.fn(); };
    m.append(b);
  }
  document.body.append(m);
  const r = ancla.getBoundingClientRect();
  m.style.top = Math.min(window.innerHeight - m.offsetHeight - 8, r.bottom + 4) + "px";
  m.style.left = Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + "px";
  menuAbierto = m;
  setTimeout(() => document.addEventListener("pointerdown", cerrarMenuSiAfuera, { once: true }), 0);
}
function cerrarMenuSiAfuera(e) { if (menuAbierto && !menuAbierto.contains(e.target)) cerrarMenu(); else if (menuAbierto) document.addEventListener("pointerdown", cerrarMenuSiAfuera, { once: true }); }
function cerrarMenu() { menuAbierto?.remove(); menuAbierto = null; }

async function moverEnRoadmap(tipo, id, desdeId, haciaId) {
  const versiones = plano.roadmap || [];
  const desde = versiones.find((v) => v.id === desdeId), hacia = versiones.find((v) => v.id === haciaId);
  const cambios = [];
  if (desde) { desde[tipo] = (desde[tipo] || []).filter((x) => x !== id); cambios.push([desde.id, { [tipo]: desde[tipo] }]); }
  if (hacia) { hacia[tipo] = [...(hacia[tipo] || []).filter((x) => x !== id), id]; cambios.push([hacia.id, { [tipo]: hacia[tipo] }]); abiertas.add(hacia.id); }
  renderContenido();
  for (const [vid, c] of cambios) {
    const r = await fetch(`/api/proyectos/${proyecto.id}/roadmap/${encodeURIComponent(vid)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(c) });
    if (!r.ok) agregarMensaje("error", (await r.json()).error || "No se pudo guardar el cambio en el roadmap");
  }
}

function derivarRoadmap() {
  if (enviando) return;
  if (vista === "completa") { mostrandoChat = true; renderVista(); }
  const texto = (plano.roadmap || []).length ? "Armá el roadmap de nuevo con el Plano actual." : "Armá el roadmap.";
  agregarMensaje("usuario", texto, undefined, undefined, true);
  correrTurno(`/api/proyectos/${proyecto.id}/mensaje`, { texto, menciones: [], idioma: idiomaActual(), derivarRoadmap: true });
}

// ---------- el siguiente paso: barra fija debajo de la conversación ----------
function renderSiguiente() {
  const el = $("#siguiente");
  if (!el || !plano) return;
  const preguntas = (plano.preguntas || []).length;
  const versiones = (plano.roadmap || []).length;
  // un Plano recién creado ya trae nombre y tipo de aplicación: eso no es una entrevista hecha
  const sinIdentidad = !plano.identidad?.que_es;
  const faltan = [];
  if (!(plano.pantallas || []).length) faltan.push(t("pantallas"));
  if (!(plano.entidades || []).length) faltan.push(t("entidades"));
  let paso, texto, accion = null;
  if (sinIdentidad) { paso = t("Entrevista"); texto = t("Contale a Plano qué querés construir."); }
  else if (faltan.length && !versiones) { paso = t("Entrevista"); texto = t("La entrevista sigue: todavía no hay {q} registradas. Contá cómo se usa y qué maneja.", { q: faltan.join(` ${t("ni")} `) }); }
  else if (preguntas) { paso = t("Entrevista"); texto = preguntas === 1 ? t("Queda 1 pregunta abierta. Siguiente: cerrarla y armar el roadmap.") : t("Quedan {n} preguntas abiertas. Siguiente: cerrarlas y armar el roadmap.", { n: preguntas }); }
  else if (!versiones) { paso = t("Entrevista"); texto = t("El Plano está cerrado. Siguiente: armar el roadmap, las versiones en que se construye."); accion = [t("Armar el roadmap"), derivarRoadmap]; }
  else {
    const v = versionEnCurso();
    const entradas = plano.prototipo || [];
    if (!v || !entradas.length) {
      const primera = [...(plano.roadmap || [])].sort((a, b) => (a.orden || 99) - (b.orden || 99))[0];
      paso = t("Roadmap"); texto = t("{n} versiones. Siguiente: el prototipo de la {v}, solo con sus pantallas.", { n: versiones, v: primera?.id || "v1" });
      if (primera?.pantallas?.length) accion = [t("Prototipar la {v}", { v: primera.id }), () => iniciarPrototipo(primera)];
    } else {
      const estados = new Map(entradas.map((p) => [p.id, p]));
      const ids = v.pantallas || [];
      const aprobadas = ids.filter((id) => estados.get(id)?.estado === "aprobada").length;
      const titulo = (id) => (plano.pantallas || []).find((p) => p.id === id)?.titulo || id;
      const revisar = ids.find((id) => ["generada"].includes(estados.get(id)?.estado));
      const devuelta = ids.find((id) => estados.get(id)?.estado === "devuelta");
      const pendiente = ids.find((id) => (estados.get(id)?.estado || "pendiente") === "pendiente");
      paso = t("Prototipo {v}", { v: v.id });
      const irA = (id) => () => { pantallaActiva = id; pestanaActiva = "prototipo"; mostrandoChat = false; renderVista(); };
      const pendientes = (revisiones[v.id] || []).length;
      const cambiada = (revisiones[v.id] || []).find((x) => x.tipo === "congelada");
      if (cambiada) { texto = t("«{p}» está aprobada pero sus elementos cambiaron en el Plano. Siguiente: regenerarla con los elementos nuevos.", { p: titulo(cambiada.id) }); accion = [t("Regenerar"), () => { pantallaActiva = cambiada.id; revisarPantalla(cambiada.id, "Los elementos de la pantalla cambiaron en el Plano. Regenerala con la lista actual de elementos, manteniendo lo demás como estaba aprobado."); }]; }
      else if (aprobadas === ids.length && pendientes) { texto = t("Las {n} pantallas de la {v} están aprobadas. Antes de construir: {k} por resolver en el Plano.", { n: ids.length, v: v.id, k: pendientes }); accion = [t("Resolverlo con el agente"), () => resolverVersion(v)]; }
      else if (aprobadas === ids.length && construccion?.version === v.id) {
        const r = resumenConstruccion(construccion);
        paso = t("Construcción {v}", { v: v.id });
        const irC = () => { pestanaActiva = "construccion"; mostrandoChat = false; renderVista(); };
        if (r.terminada) texto = t("La {v} está construida: las {n} tareas aprobadas.", { v: v.id, n: r.total });
        else if (r.paraPersona.length) { const tt = construccion.tareas.find((x) => x.id === r.paraPersona[0]); texto = t("«{p}» pasó la verificación. Siguiente: mirarla y aprobarla.", { p: tt?.titulo || r.paraPersona[0] }); accion = [t("Revisar"), () => { tareaActiva = r.paraPersona[0]; irC(); }]; }
        else if (r.por.devuelta) texto = t("{n} tarea(s) devueltas esperan al agente. {a} de {t} aprobadas.", { n: r.por.devuelta, a: r.por.aprobada || 0, t: r.total });
        else if (r.por.en_curso || r.por.hecha || r.por.verificando) texto = t("El agente está trabajando. {a} de {t} aprobadas.", { a: r.por.aprobada || 0, t: r.total });
        else { texto = t("La construcción está preparada. Abrí la carpeta {c} en Claude Code y decile: seguí con el Plano.", { c: construccion.carpeta_app }); accion = [t("Ver el tablero"), irC]; }
      }
      else if (aprobadas === ids.length) { texto = t("Las {n} pantallas de la {v} están aprobadas y la revisión no encontró huecos. Siguiente: preparar la construcción.", { n: ids.length, v: v.id }); accion = [t("Preparar la construcción de la {v}", { v: v.id }), () => prepararConstruccion(v.id)]; }
      else if (revisar) { texto = t("{a} de {n} aprobadas. Siguiente: revisar «{p}».", { a: aprobadas, n: ids.length, p: titulo(revisar) }); accion = [t("Revisar"), irA(revisar)]; }
      else if (devuelta) { texto = t("«{p}» está devuelta. Siguiente: pedir la corrección.", { p: titulo(devuelta) }); accion = [t("Pedir la corrección"), () => revisarPantalla(devuelta, estados.get(devuelta)?.comentario)]; }
      else if (pendiente) { texto = t("{a} de {n} aprobadas. Siguiente: generar «{p}».", { a: aprobadas, n: ids.length, p: titulo(pendiente) }); accion = [t("Generar"), () => { pantallaActiva = pendiente; generarPantalla(pendiente); }]; }
      else texto = t("{a} de {n} aprobadas.", { a: aprobadas, n: ids.length });
    }
  }
  el.innerHTML = `<span class="siguiente__paso">${esc(paso)}</span><span class="siguiente__texto">${esc(texto)}</span>`;
  if (accion) { const b = document.createElement("button"); b.type = "button"; b.className = "btn btn--primario btn--chico"; b.textContent = accion[0]; b.onclick = accion[1]; el.append(b); }
}

// ---------- diagrama de entidades ----------
// Se dibuja desde el JSON: cada entidad es una caja con sus campos; cada campo "id:x" es una flecha hacia x.
// Las entidades que no dependen de nada van arriba; las que dependen de ellas, debajo. Ese orden es la ruta natural.
const DIAG = { ancho: 232, filaAlto: 19, cab: 40, pad: 10, gapX: 44, gapY: 70 };

function dependenciasDe(it) {
  return Object.values(it.campos || {}).map((t) => String(t).replace(/\?$/, "")).filter((t) => t.startsWith("id:")).map((t) => t.slice(3));
}

function nivelesDiagrama(lista) {
  const ids = new Set(lista.map((e) => e.id));
  const nivel = new Map();
  const calc = (id, pila = new Set()) => {
    if (nivel.has(id)) return nivel.get(id);
    if (pila.has(id)) return 0; // ciclo: se corta
    pila.add(id);
    const it = lista.find((e) => e.id === id);
    const deps = dependenciasDe(it).filter((d) => ids.has(d) && d !== id);
    const n = deps.length ? Math.max(...deps.map((d) => calc(d, pila))) + 1 : 0;
    nivel.set(id, n);
    return n;
  };
  for (const e of lista) calc(e.id);
  return nivel;
}

function renderDiagrama(lista, resaltarId) {
  const nivel = nivelesDiagrama(lista);
  const porNivel = new Map();
  for (const e of lista) { const n = nivel.get(e.id); if (!porNivel.has(n)) porNivel.set(n, []); porNivel.get(n).push(e); }
  const niveles = [...porNivel.keys()].sort((a, b) => a - b);

  // medidas de cada caja
  const alto = (e) => DIAG.cab + Math.max(1, Object.keys(e.campos || {}).length) * DIAG.filaAlto + DIAG.pad;
  const pos = new Map();
  let y = 20, anchoMax = 0;
  for (const n of niveles) {
    const fila = porNivel.get(n);
    const anchoFila = fila.length * DIAG.ancho + (fila.length - 1) * DIAG.gapX;
    anchoMax = Math.max(anchoMax, anchoFila);
    let x = 0;
    let altoFila = 0;
    for (const e of fila) { pos.set(e.id, { x, y, w: DIAG.ancho, h: alto(e) }); x += DIAG.ancho + DIAG.gapX; altoFila = Math.max(altoFila, alto(e)); }
    y += altoFila + DIAG.gapY;
  }
  // centrar cada fila
  for (const n of niveles) {
    const fila = porNivel.get(n);
    const anchoFila = fila.length * DIAG.ancho + (fila.length - 1) * DIAG.gapX;
    const desplazo = (anchoMax - anchoFila) / 2 + 20;
    for (const e of fila) pos.get(e.id).x += desplazo;
  }
  // posiciones guardadas por la persona (arrastre) pisan las calculadas
  const clavePos = `plano.diagrama.${proyecto.id}`;
  let guardadas = {};
  try { guardadas = JSON.parse(localStorage.getItem(clavePos) || "{}"); } catch {}
  const automatico = new Map([...pos].map(([id, p]) => [id, { x: p.x, y: p.y }]));
  for (const [id, p] of Object.entries(guardadas)) if (pos.has(id)) Object.assign(pos.get(id), { x: p.x, y: p.y });
  const limites = () => { let maxX = 0, maxY = 0; for (const p of pos.values()) { maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h); } return { W: maxX + 40, H: maxY + 40 }; };
  let { W, H } = limites();

  const salidas = new Map(), entradas = new Map();
  const pares = [];
  for (const e of lista) for (const d of new Set(dependenciasDe(e))) if (pos.has(d) && d !== e.id) pares.push([e.id, d]);
  for (const [de, a] of pares) { (salidas.get(de) || salidas.set(de, []).get(de)).push(a); (entradas.get(a) || entradas.set(a, []).get(a)).push(de); }
  const centroX = (id) => pos.get(id).x + pos.get(id).w / 2;
  const reparto = (box, lista, i) => box.x + box.w * ((i + 1) / (lista.length + 1));
  // Las flechas salen por arriba o por abajo según dónde quede la otra caja, y se reparten a lo largo del borde.
  function dibujarFlechas() {
    for (const v of salidas.values()) v.sort((p, q) => centroX(p) - centroX(q));
    for (const v of entradas.values()) v.sort((p, q) => centroX(p) - centroX(q));
    return pares.map(([de, a]) => {
      const pd = pos.get(de), pa = pos.get(a);
      const arriba = pa.y + pa.h <= pd.y; // la referida está arriba
      const x1 = reparto(pd, salidas.get(de), salidas.get(de).indexOf(a)), y1 = arriba ? pd.y : pd.y + pd.h;
      const x2 = reparto(pa, entradas.get(a), entradas.get(a).indexOf(de)), y2 = arriba ? pa.y + pa.h + 4 : pa.y - 4;
      const mid = (y1 + y2) / 2;
      return `<path class="diag__flecha" data-de="${de}" data-a="${a}" d="M${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}" marker-end="url(#punta)"/>`;
    }).join("");
  }

  const cajas = lista.map((e) => {
    const p = pos.get(e.id);
    const campos = Object.entries(e.campos || {});
    const niv = e.nivel || "blando";
    return `<g class="diag__caja diag__caja--${niv} ${e.id === resaltarId ? "diag__caja--nueva" : ""}" data-id="${esc(e.id)}" transform="translate(${p.x},${p.y})">
      <rect class="diag__fondo" width="${p.w}" height="${p.h}" rx="10"/>
      <rect class="diag__cabecera" width="${p.w}" height="${DIAG.cab - 8}" rx="10"/>
      <rect class="diag__cabecera" y="${DIAG.cab - 18}" width="${p.w}" height="10"/>
      <text class="diag__titulo" x="12" y="21">${esc(recortar(e.titulo || e.id, 26))}</text>
      ${campos.length ? campos.map(([k, v], i) => `<text class="diag__campo" x="12" y="${DIAG.cab + i * DIAG.filaAlto + 13}"><tspan class="diag__k">${esc(k)}</tspan><tspan class="diag__v" dx="6">${esc(String(v))}</tspan></text>`).join("") : `<text class="diag__campo diag__campo--vacio" x="12" y="${DIAG.cab + 13}">sin campos</text>`}
    </g>`;
  }).join("");

  const wrap = document.createElement("div");
  wrap.className = "diagrama";
  wrap.innerHTML = `<svg class="diag" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs><marker id="punta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="diag__punta"/></marker></defs>
    <g class="diag__flechas">${dibujarFlechas()}</g>${cajas}</svg>
    <div class="diagrama__pie">${lista.length} entidades · ${pares.length} relaciones</div>
    <div class="diagrama__zoom">
      <button type="button" class="modo__btn" data-zoom="-" title="Alejar">−</button>
      <button type="button" class="modo__btn" data-zoom="0" title="Ajustar a la pantalla">⤢</button>
      <button type="button" class="modo__btn" data-zoom="+" title="Acercar">+</button>
      <button type="button" class="modo__btn" data-zoom="reset" title="Reordenar por dependencias">↺</button>
    </div>`;
  const svg = wrap.querySelector("svg");
  const capaFlechas = svg.querySelector(".diag__flechas");

  // ---- zoom y desplazamiento del lienzo ----
  const cont = $("#contenido-plano");
  let escala = 1, dx = 0, dy = 0;
  const aplicar = () => { svg.style.transform = `translate(${dx}px, ${dy}px) scale(${escala})`; };
  const ajustar = () => {
    ({ W, H } = limites());
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
    escala = Math.min(1, (cont.clientWidth - 44) / W, (cont.clientHeight - 60) / H);
    dx = Math.max(0, (cont.clientWidth - 44 - W * escala) / 2); dy = 0;
    aplicar();
  };
  ajustar();
  const zoomEn = (factor, cx, cy) => {
    const nueva = Math.min(3, Math.max(0.2, escala * factor));
    // el punto bajo el cursor queda quieto
    dx = cx - (cx - dx) * (nueva / escala); dy = cy - (cy - dy) * (nueva / escala);
    escala = nueva; aplicar();
  };
  wrap.addEventListener("wheel", (e) => { e.preventDefault(); const r = wrap.getBoundingClientRect(); zoomEn(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  wrap.querySelectorAll("[data-zoom]").forEach((b) => { b.onclick = () => {
    const r = wrap.getBoundingClientRect();
    if (b.dataset.zoom === "+") zoomEn(1.25, r.width / 2, r.height / 2);
    else if (b.dataset.zoom === "-") zoomEn(1 / 1.25, r.width / 2, r.height / 2);
    else if (b.dataset.zoom === "0") ajustar();
    else reordenar();
  }; });

  function reordenar() {
    guardadas = {};
    try { localStorage.removeItem(clavePos); } catch {}
    const desde = new Map([...pos].map(([id, p]) => [id, { x: p.x, y: p.y }]));
    const inicio = performance.now(), dur = 420;
    const suave = (t) => 1 - Math.pow(1 - t, 3);
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / dur), k = suave(t);
      for (const [id, p] of pos) {
        const a = desde.get(id), b = automatico.get(id);
        p.x = a.x + (b.x - a.x) * k; p.y = a.y + (b.y - a.y) * k;
        svg.querySelector(`.diag__caja[data-id="${CSS.escape(id)}"]`)?.setAttribute("transform", `translate(${p.x},${p.y})`);
      }
      capaFlechas.innerHTML = dibujarFlechas();
      if (t < 1) requestAnimationFrame(paso); else ajustar();
    };
    requestAnimationFrame(paso);
  }

  // ---- arrastre: del lienzo (fondo) o de una caja (reordenar) ----
  let gesto = null; // { tipo: "lienzo" | "caja", ... }
  wrap.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest(".diagrama__zoom")) return;
    const caja = e.target.closest(".diag__caja");
    wrap.setPointerCapture(e.pointerId);
    if (caja) {
      const p = pos.get(caja.dataset.id);
      gesto = { tipo: "caja", id: caja.dataset.id, el: caja, x0: e.clientX, y0: e.clientY, px: p.x, py: p.y, movio: false };
      caja.classList.add("diag__caja--arrastrando");
    } else {
      gesto = { tipo: "lienzo", x0: e.clientX - dx, y0: e.clientY - dy };
      wrap.classList.add("diagrama--arrastrando");
    }
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!gesto) return;
    if (gesto.tipo === "lienzo") { dx = e.clientX - gesto.x0; dy = e.clientY - gesto.y0; aplicar(); return; }
    const mx = (e.clientX - gesto.x0) / escala, my = (e.clientY - gesto.y0) / escala;
    if (!gesto.movio && Math.hypot(mx, my) * escala < 4) return; // todavía es un clic
    gesto.movio = true;
    const p = pos.get(gesto.id);
    p.x = Math.max(0, gesto.px + mx); p.y = Math.max(0, gesto.py + my);
    gesto.el.setAttribute("transform", `translate(${p.x},${p.y})`);
    capaFlechas.innerHTML = dibujarFlechas();
  });
  const soltar = (e) => {
    if (!gesto) return;
    if (gesto.tipo === "caja") {
      gesto.el.classList.remove("diag__caja--arrastrando");
      if (gesto.movio) {
        const p = pos.get(gesto.id);
        guardadas[gesto.id] = { x: p.x, y: p.y };
        try { localStorage.setItem(clavePos, JSON.stringify(guardadas)); } catch {}
        ({ W, H } = limites()); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
      } else {
        const it = lista.find((x) => x.id === gesto.id);
        if (it) abrirDetalle("entidades", it);
      }
    } else wrap.classList.remove("diagrama--arrastrando");
    gesto = null;
  };
  wrap.addEventListener("pointerup", soltar);
  wrap.addEventListener("pointercancel", soltar);
  return wrap;
}

function resumenItem(coleccion, it) {
  const n = (c, s, p) => `${c} ${c === 1 ? s : p}`;
  if (coleccion === "roadmap") return [["pantallas", "pantalla", "pantallas"], ["entidades", "entidad", "entidades"], ["acciones", "acción", "acciones"]].filter(([t]) => (it[t] || []).length).map(([t, s, p]) => n(it[t].length, s, p)).join(", ");
  if (it.campos && Object.keys(it.campos).length) return n(Object.keys(it.campos).length, "campo", "campos");
  if (it.elementos?.length) return n(it.elementos.length, "elemento", "elementos");
  if (coleccion === "acciones" && (it.pantalla || it.entidad)) {
    const pant = (plano.pantallas || []).find((p) => p.id === it.pantalla)?.titulo || it.pantalla;
    const ent = (plano.entidades || []).find((e) => e.id === it.entidad)?.titulo || it.entidad;
    return [pant, ent].filter(Boolean).join(" → ");
  }
  return "";
}

function renderFila(coleccion, it, nueva) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "fila" + (nueva ? " tarjeta--nueva" : "");
  const nivel = it.nivel || "blando";
  b.dataset.nivel = nivel;
  const extra = resumenItem(coleccion, it);
  b.innerHTML = `${iconoNivel(nivel)}<span class="fila__titulo">${esc(recortar(it.titulo || it.id, LIMITE.titulo))}</span><span class="fila__desc">${esc(recortar(it.descripcion || "", LIMITE.descFila))}</span><span class="fila__extra">${esc(extra)}</span>`;
  b.onclick = () => abrirDetalle(coleccion, it);
  return b;
}

function vacio(clave) {
  const [t, d] = VACIAS[clave];
  const div = document.createElement("div");
  div.className = "vacio-pestana";
  div.innerHTML = `<strong>${esc(t)}</strong>${esc(d)}`;
  return div;
}

function iconoNivel(nivel) {
  const n = NIVELES[nivel] || NIVELES.blando;
  return `<span class="nivel nivel--${nivel}" title="${esc(n.nombre)}: ${esc(n.texto)}">${n.icono}</span>`;
}

// La identidad no es una tarjeta: es la página informativa del proyecto. Sin nivel, sin clic.
function renderFicha(id, nueva) {
  const div = document.createElement("div");
  div.className = "identidad" + (nueva ? " identidad--nueva" : "");
  const nombre = id.nombre || proyecto.nombre;
  const resto = Object.entries(id).filter(([k]) => !["nombre", "nivel", "tipo", "tipo_app", "que_es", "id", "titulo"].includes(k));
  div.innerHTML = `
    <h2 class="identidad__nombre">${esc(nombre)}</h2>
    <p class="identidad__tipo-app" title="${esc(t("Se eligió al crear el proyecto y no se cambia: de esto salen el stack, los marcos del prototipo y cómo se verifica y publica la construcción."))}">${ICONO_CANDADO} ${esc(TIPO_APP()[tipoApp()])}</p>
    ${id.tipo ? `<p class="identidad__tipo">${esc(id.tipo)}</p>` : ""}
    ${id.que_es ? `<p class="identidad__que">${esc(id.que_es)}</p>` : ""}
    ${resto.length ? `<dl class="identidad__filas">${resto.map(([k, v]) => `
      <dt>${esc(ETIQUETAS_IDENTIDAD[k] || k.replace(/_/g, " "))}</dt><dd>${esc(typeof v === "object" ? JSON.stringify(v) : String(v))}</dd>`).join("")}</dl>` : ""}`;
  // en qué se usa la aplicación: decide el marco por defecto de todas las pantallas (solo web elige; móvil y escritorio ya lo dicen)
  if (tipoApp() !== "web") { if (nueva) setTimeout(() => div.classList.remove("identidad--nueva"), 1600); return div; }
  const disp = document.createElement("div"); disp.className = "identidad__dispositivos";
  const actualD = ["celular", "escritorio"].includes(id.dispositivos) ? id.dispositivos : "ambos";
  disp.innerHTML = `<span>${t("Se usa en")}</span><div class="segmentos">${[["ambos", t("Celular y escritorio")], ["celular", t("Solo celular")], ["escritorio", t("Solo escritorio")]].map(([v, t]) => `<button type="button" class="segmento ${v === actualD ? "segmento--activo" : ""}" data-disp="${v}">${t}</button>`).join("")}</div>`;
  disp.querySelectorAll(".segmento").forEach((b) => { b.onclick = async () => {
    const r = await fetch(`/api/proyectos/${proyecto.id}/identidad/identidad`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ dispositivos: b.dataset.disp }) });
    const json = await r.json();
    if (json.plano) { plano = json.plano; renderContenido(); }
  }; });
  div.append(disp);
  if (nueva) setTimeout(() => div.classList.remove("identidad--nueva"), 1600);
  return div;
}

function renderTarjeta(coleccion, it, nueva) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "tarjeta" + (nueva ? " tarjeta--nueva" : "");
  const nivel = it.nivel || "blando";
  b.dataset.nivel = nivel;
  // Sin chips: una línea en palabras. Lo completo está en el detalle.
  const detalle = esc(resumenItem(coleccion, it));
  const aviso = nivel === "supuesto" ? `<div class="tarjeta__aviso">Lo asumió el agente</div>` : "";
  b.innerHTML = `
    <div class="tarjeta__cab"><span class="tarjeta__titulo">${esc(recortar(it.titulo || it.id, LIMITE.titulo))}</span>${iconoNivel(nivel)}</div>
    ${it.descripcion ? `<div class="tarjeta__desc">${esc(recortar(it.descripcion, LIMITE.descTarjeta))}</div>` : ""}
    ${detalle ? `<div class="tarjeta__resumen">${detalle}</div>` : ""}
    ${aviso}`;
  b.onclick = () => abrirDetalle(coleccion, it);
  return b;
}

// ---------- detalle de una tarjeta ----------
const detalle = $("#detalle");
$("#detalle-cerrar").onclick = () => detalle.close();
detalle.addEventListener("click", (e) => { if (e.target === detalle) detalle.close(); });

function abrirDetalle(coleccion, it) {
  const nivel = it.nivel || "blando";
  const n = NIVELES[nivel] || NIVELES.blando;
  $("#detalle-coleccion").textContent = TITULO[coleccion] || coleccion;
  $("#detalle-titulo").textContent = it.titulo || it.id;
  const bloques = [];
  bloques.push(`<div class="detalle__nivel">${iconoNivel(nivel)}<div><strong>${esc(n.nombre)}</strong><span>${esc(n.texto)}</span></div></div>`);
  if (it.descripcion) bloques.push(`<div class="detalle__bloque"><h4>Descripción</h4><p>${esc(it.descripcion)}</p></div>`);
  if (it.campos && Object.keys(it.campos).length) bloques.push(`<div class="detalle__bloque"><h4>Campos</h4><table class="detalle__tabla">${Object.entries(it.campos).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table></div>`);
  if (it.tabla) bloques.push(`<div class="detalle__bloque"><h4>Tabla</h4><p><code>${esc(it.tabla)}</code></p></div>`);
  if (it.elementos?.length) bloques.push(`<div class="detalle__bloque"><h4>Elementos en pantalla</h4><ul class="detalle__lista">${it.elementos.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>`);
  if (it.pantalla || it.entidad || it.lleva_a) bloques.push(`<div class="detalle__bloque"><h4>${t("Dónde y sobre qué")}</h4><p>${it.pantalla ? `En la pantalla <strong>${esc(it.pantalla)}</strong>` : ""}${it.pantalla && it.entidad ? ", " : ""}${it.entidad ? `sobre la entidad <strong>${esc(it.entidad)}</strong>` : ""}${it.lleva_a ? ` · lleva a <strong>${esc((plano.pantallas || []).find((p) => p.id === it.lleva_a)?.titulo || it.lleva_a)}</strong>` : ""}</p></div>`);
  if (coleccion === "roadmap") {
    if (it.objetivo) bloques.push(`<div class="detalle__bloque"><h4>Cuando está terminada</h4><p>${esc(it.objetivo)}</p></div>`);
    for (const [tipo, titulo] of TIPOS_RUTA) {
      const ids = it[tipo] || [];
      if (ids.length) bloques.push(`<div class="detalle__bloque"><h4>${titulo}</h4><ul class="detalle__lista">${ids.map((id) => `<li>${esc((plano[tipo] || []).find((x) => x.id === id)?.titulo || id)}</li>`).join("")}</ul></div>`);
    }
  }
  if (it.por_que_importa) bloques.push(`<div class="detalle__bloque"><h4>Por qué importa</h4><p>${esc(it.por_que_importa)}</p></div>`);
  const conocidos = new Set(["id", "titulo", "descripcion", "nivel", "campos", "tabla", "elementos", "pantalla", "entidad", "lleva_a", "por_que_importa", "indices", "nombre", "que_es", "orden", "objetivo", "pantallas", "entidades", "acciones", "integraciones"]);
  const otros = Object.entries(it).filter(([k]) => !conocidos.has(k)).map(([k, v]) => [ETIQUETAS_IDENTIDAD[k] || k, v]);
  if (otros.length) bloques.push(`<div class="detalle__bloque"><h4>Más</h4><table class="detalle__tabla">${otros.map(([k, v]) => `<tr><td>${esc(k.replace(/_/g, " "))}</td><td>${esc(typeof v === "object" ? JSON.stringify(v) : String(v))}</td></tr>`).join("")}</table></div>`);
  $("#detalle-cuerpo").innerHTML = bloques.join("");
  const pie = $("#detalle-pie");
  pie.hidden = coleccion === "identidad";
  $("#detalle-mencionar").onclick = () => { detalle.close(); mencionarDesdeTarjeta(coleccion, it); };
  // en qué dispositivos se usa la pantalla: decide los marcos del visor, del lienzo y de navegar
  if (coleccion === "pantallas" && tipoApp() === "web") {
    const esp = document.createElement("div"); esp.className = "detalle__bloque detalle__espacio";
    const valor = () => (Array.isArray(it.dispositivos) && it.dispositivos.length ? (it.dispositivos.length === 2 ? "ambos" : it.dispositivos[0]) : "proyecto");
    const delProyecto = plano.identidad?.dispositivos === "celular" ? t("solo celular") : plano.identidad?.dispositivos === "escritorio" ? t("solo escritorio") : t("celular y escritorio");
    esp.innerHTML = `<h4>${t("Se usa en")}</h4><div class="segmentos">${[["proyecto", t("Como el proyecto ({d})", { d: delProyecto })], ["ambos", t("Celular y escritorio")], ["celular", t("Solo celular")], ["escritorio", t("Solo escritorio")]].map(([v, t]) => `<button type="button" class="segmento ${v === valor() ? "segmento--activo" : ""}" data-disp="${v}">${t}</button>`).join("")}</div>`;
    esp.querySelectorAll(".segmento").forEach((b) => { b.onclick = async () => {
      const d = b.dataset.disp, dispositivos = d === "proyecto" ? [] : d === "ambos" ? ["celular", "escritorio"] : [d];
      const r = await fetch(`/api/proyectos/${proyecto.id}/pantallas/${encodeURIComponent(it.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ dispositivos }) });
      const json = await r.json();
      if (json.plano) { plano = json.plano; it.dispositivos = dispositivos; esp.querySelectorAll(".segmento").forEach((x) => x.classList.toggle("segmento--activo", x === b)); renderContenido(); }
    }; });
    $("#detalle-cuerpo").append(esp);
  }
  // una pregunta se puede responder acá mismo: es mencionarla y contestar, en un paso
  const resp = $("#detalle-respuesta"), btnResp = $("#detalle-responder"), ta = $("#detalle-respuesta-texto");
  resp.hidden = true; ta.value = ""; ta.style.height = "";
  btnResp.hidden = coleccion !== "preguntas";
  btnResp.onclick = () => { resp.hidden = false; btnResp.hidden = true; ta.focus(); };
  ta.oninput = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; };
  ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); resp.requestSubmit(); } };
  resp.onsubmit = (e) => {
    e.preventDefault();
    const r = ta.value.trim();
    if (!r) return ta.focus();
    detalle.close();
    if (vista === "completa") { mostrandoChat = true; renderVista(); }
    enviarTexto(`@${it.titulo || it.id} ${r}`, { respuestaA: it.id });
  };
  detalle.showModal();
}

// ---------- markdown mínimo y seguro (escapa primero, formatea después) ----------
function markdown(src) {
  const lineas = esc(src).replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let lista = null;
  let parrafo = [];
  let codigo = null;
  const cerrarParrafo = () => { if (parrafo.length) { out.push(`<p>${inline(parrafo.join("<br>"))}</p>`); parrafo = []; } };
  const cerrarLista = () => { if (lista) { out.push(`</${lista}>`); lista = null; } };
  for (const linea of lineas) {
    if (codigo !== null) {
      if (/^```/.test(linea)) { out.push(`<pre><code>${codigo.join("\n")}</code></pre>`); codigo = null; }
      else codigo.push(linea);
      continue;
    }
    if (/^```/.test(linea)) { cerrarParrafo(); cerrarLista(); codigo = []; continue; }
    const h = linea.match(/^(#{1,4})\s+(.*)$/);
    if (h) { cerrarParrafo(); cerrarLista(); out.push(`<h3>${inline(h[2])}</h3>`); continue; }
    const ul = linea.match(/^\s*[-*•]\s+(.*)$/);
    const ol = linea.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      cerrarParrafo();
      const tipo = ul ? "ul" : "ol";
      if (lista !== tipo) { cerrarLista(); out.push(`<${tipo}>`); lista = tipo; }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
      continue;
    }
    if (!linea.trim()) { cerrarParrafo(); cerrarLista(); continue; }
    cerrarLista();
    parrafo.push(linea);
  }
  if (codigo !== null) out.push(`<pre><code>${codigo.join("\n")}</code></pre>`);
  cerrarParrafo(); cerrarLista();
  return out.join("");
}
function inline(s) {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^\w])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, `<a href="$2" target="_blank" rel="noopener">$1</a>`);
}
const LIMITE = { titulo: 48, descTarjeta: 120, descFila: 90 };
function recortar(s, n) { s = String(s ?? ""); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

arrancar();


// ---------- lienzo: todas las pantallas de todas las versiones, con las flechas de las acciones ----------
const LIENZO = { escCel: 0.3, escEsc: 0.22, anchoEsc: 1280, altoEsc: 800, hueco: 40, pie: 44, margen: 40, cabecera: 34 };
let lienzoVista = null; // { escala, dx, dy }
function renderLienzo() {
  const wrap = document.createElement("div");
  wrap.className = "lienzo";
  const mundo = document.createElement("div");
  mundo.className = "lienzo__mundo";
  wrap.append(mundo);
  const estados = new Map((plano.prototipo || []).map((p) => [p.id, p]));
  const versiones = [...(plano.roadmap || [])].sort((a, b) => (a.orden || 99) - (b.orden || 99));
  const porId = new Map((plano.pantallas || []).map((p) => [p.id, p]));
  let y = LIENZO.margen, anchoMundo = 0, total = 0, aprobadas = 0;
  const html = [];
  for (const v of versiones) {
    const ids = (v.pantallas || []).filter((id) => porId.has(id));
    if (!ids.length) continue;
    const enCurso = v === versionEnCurso();
    html.push(`<div class="lienzo__version ${enCurso ? "lienzo__version--en-curso" : ""}" style="left:${LIENZO.margen}px;top:${y}px"><span class="version__n">${esc(v.id)}</span><span>${esc(tituloVersion(v))}</span>${enCurso ? "" : `<span class="lienzo__futura">${estadoVersion(v) === "hecha" ? t("hecha") : t("todavía no")}</span>`}</div>`);
    y += LIENZO.cabecera;
    let x = LIENZO.margen, altoFila = 0;
    for (const id of ids) {
      const p = porId.get(id), e = estados.get(id)?.estado || "pendiente", disp = dispositivosDe(p);
      const hayHtml = ["generada", "devuelta", "aprobada"].includes(e);
      total++; if (e === "aprobada") aprobadas++;
      const src = `/prototipo/${esc(proyecto.id)}/${esc(id)}.html`;
      const elementos = p.elementos || [];
      // una miniatura por dispositivo en que se usa la pantalla (celular, escritorio o las dos, una al lado de la otra)
      const tam = (cel) => ({ w: Math.round(cel ? 410 * LIENZO.escCel : LIENZO.anchoEsc * LIENZO.escEsc), h: Math.round(cel ? 864 * LIENZO.escCel : LIENZO.altoEsc * LIENZO.escEsc) });
      const dispPend = hayHtml ? disp : [disp.includes("escritorio") ? "escritorio" : "celular"]; // una pendiente alcanza con una caja
      const marcos = dispPend.map((d) => {
        const cel = d === "celular", { w, h } = tam(cel);
        return hayHtml
          ? `<div class="lienzo__marco ${cel ? "lienzo__marco--celular" : "lienzo__marco--escritorio"}" style="zoom:${cel ? LIENZO.escCel : LIENZO.escEsc};width:${cel ? 410 : LIENZO.anchoEsc}px;height:${cel ? 864 : LIENZO.altoEsc}px"><iframe src="${src}" loading="lazy" tabindex="-1" title="${esc(p.titulo)}"></iframe></div>`
          : `<div class="lienzo__pendiente ${cel ? "lienzo__pendiente--celular" : ""}" style="width:${w}px;height:${h}px"><ul>${elementos.slice(0, cel ? 7 : 6).map((el) => `<li>${esc(recortar(el, cel ? 26 : 48))}</li>`).join("")}${elementos.length > (cel ? 7 : 6) ? `<li class="lienzo__mas">${t("y {n} más", { n: elementos.length - (cel ? 7 : 6) })}</li>` : ""}</ul></div>`;
      });
      const w = dispPend.reduce((s, d) => s + tam(d === "celular").w, 0) + (dispPend.length - 1) * 14;
      const h = Math.max(...dispPend.map((d) => tam(d === "celular").h));
      html.push(`<div class="lienzo__pantalla lienzo__pantalla--${e}" style="left:${x}px;top:${y}px;width:${w}px" data-id="${esc(id)}">
        <div class="lienzo__marcos" style="height:${h}px">${marcos.join("")}</div>
        <div class="lienzo__pie"><span class="lienzo__titulo">${esc(p.titulo)}</span><span class="lienzo__estado">${ESTADO_TEXTO[e] || e}</span></div>
        <div class="lienzo__tapa"></div>
      </div>`);
      x += w + LIENZO.hueco; altoFila = Math.max(altoFila, h + LIENZO.pie);
    }
    anchoMundo = Math.max(anchoMundo, x - LIENZO.hueco + LIENZO.margen);
    y += altoFila + LIENZO.hueco;
  }
  const altoMundo = y;
  mundo.style.width = anchoMundo + "px";
  mundo.style.height = altoMundo + "px";
  mundo.innerHTML = html.join("");
  if (!total) return vacio("prototipo");

  const abrir = (id) => { pantallaActiva = id; modoProto = "revisar"; localStorage.setItem("plano.modoProto", modoProto); zoomMarco = null; renderContenido(); };
  const pie = document.createElement("div");
  pie.className = "lienzo__ayuda";
  pie.innerHTML = `${t("{n} pantallas, {a} aprobadas · ", { n: total, a: aprobadas })}<a href="/navegar/${esc(proyecto.id)}" target="_blank" rel="noopener">${t("Navegar la app")}</a>`;
  wrap.append(pie);

  // zoom y arrastre, como en el marco del celular; un clic sin arrastre sobre una pantalla la abre para revisar
  const aplicar = () => { mundo.style.transform = `translate(${lienzoVista.dx}px, ${lienzoVista.dy}px) scale(${lienzoVista.escala})`; };
  requestAnimationFrame(() => {
    if (!lienzoVista) {
      const escala = Math.min(1, (wrap.clientWidth - 24) / anchoMundo, (wrap.clientHeight - 24) / altoMundo);
      lienzoVista = { escala, dx: Math.max(12, (wrap.clientWidth - anchoMundo * escala) / 2), dy: 12 };
    }
    aplicar();
  });
  wrap.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = wrap.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top;
    const nueva = Math.min(2.5, Math.max(0.15, lienzoVista.escala * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    lienzoVista = { escala: nueva, dx: cx - (cx - lienzoVista.dx) * (nueva / lienzoVista.escala), dy: cy - (cy - lienzoVista.dy) * (nueva / lienzoVista.escala) };
    aplicar();
  }, { passive: false });
  let gesto = null;
  wrap.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest(".lienzo__ayuda")) return;
    gesto = { x: e.clientX, y: e.clientY, dx: lienzoVista.dx, dy: lienzoVista.dy, movio: false, pantalla: e.target.closest(".lienzo__pantalla")?.dataset.id };
    wrap.setPointerCapture(e.pointerId);
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!gesto) return;
    if (!gesto.movio && Math.hypot(e.clientX - gesto.x, e.clientY - gesto.y) > 4) { gesto.movio = true; wrap.classList.add("lienzo--arrastrando"); }
    if (gesto.movio) { lienzoVista = { ...lienzoVista, dx: gesto.dx + e.clientX - gesto.x, dy: gesto.dy + e.clientY - gesto.y }; aplicar(); }
  });
  const soltar = (e) => {
    if (!gesto) return;
    const g = gesto; gesto = null; wrap.classList.remove("lienzo--arrastrando");
    if (e.type === "pointerup" && !g.movio && g.pantalla) abrir(g.pantalla);
  };
  wrap.addEventListener("pointerup", soltar); wrap.addEventListener("pointercancel", soltar);
  return wrap;
}

// ---------- uso: tokens y plata ----------
const TIPO_TEXTO = { entrevista: t("Entrevista"), roadmap: t("Roadmap"), prototipo: t("Pantalla nueva"), revision: t("Revisión de pantalla") };
let usoDatos = null;
async function mostrarUso(idProyecto) {
  proyecto = null;
  ponerProyectoEnBarra(null, t("Uso"));
  marcarLateral("uso");
  cargarLateralProyectos();
  $("#vista-entrevista").hidden = true;
  $("#vista-proyectos").hidden = true;
  $("#vista-uso").hidden = false;
  usoDatos = await (await fetch("/api/uso")).json();
  const sel = $("#uso-proyecto");
  sel.innerHTML = `<option value="">${t("Todos los proyectos")}</option>` + usoDatos.proyectos.map((p) => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join("");
  sel.value = usoDatos.proyectos.some((p) => p.id === idProyecto) ? idProyecto : "";
  sel.onchange = () => { history.replaceState({}, "", "?uso=" + sel.value); renderUso(sel.value); };
  renderUso(sel.value);
}

function sumarUso(turnos) {
  const tot = { entrada: 0, salida: 0, cacheEscritura: 0, cacheLectura: 0, usd: 0, turnos: 0, llamadas: 0 };
  for (const u of turnos) { for (const k of ["entrada", "salida", "cacheEscritura", "cacheLectura", "usd", "llamadas"]) tot[k] += u[k] || 0; tot.turnos++; }
  return tot;
}
function costos(tot, precios) {
  // cuánto costó cada parte, para saber en qué se va la plata
  const p = precios || { entrada: 0, salida: 0, cacheEscritura: 0, cacheLectura: 0 };
  return [
    { clave: "salida", nombre: t("Salida (lo que escribe la IA)"), tokens: tot.salida, usd: (tot.salida * p.salida) / 1e6, color: "var(--primario)" },
    { clave: "entrada", nombre: t("Entrada nueva (sin caché)"), tokens: tot.entrada, usd: (tot.entrada * p.entrada) / 1e6, color: "var(--gris-700)" },
    { clave: "cacheEscritura", nombre: t("Escritura de caché"), tokens: tot.cacheEscritura, usd: (tot.cacheEscritura * p.cacheEscritura) / 1e6, color: "var(--gris-400)" },
    { clave: "cacheLectura", nombre: t("Lectura de caché"), tokens: tot.cacheLectura, usd: (tot.cacheLectura * p.cacheLectura) / 1e6, color: "var(--gris-300)" },
  ];
}
const pct = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);
const fechaCorta = (ts) => new Date(ts).toLocaleDateString(locale(), { day: "numeric", month: "short" });
const fechaHora = (ts) => new Date(ts).toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

function renderUso(idProyecto) {
  const cuerpo = $("#uso-cuerpo");
  const precios = usoDatos.precios;
  const proyectos = usoDatos.proyectos.filter((p) => !idProyecto || p.id === idProyecto);
  const turnos = proyectos.flatMap((p) => p.turnos.map((u) => ({ ...u, proyecto: p.nombre, proyectoId: p.id }))).sort((a, b) => a.ts - b.ts);
  if (!turnos.length) {
    cuerpo.innerHTML = `<p class="vacio">${idProyecto ? t("Todavía no hay uso registrado en este proyecto.") : t("Todavía no hay uso registrado.")} ${t("Plano anota los tokens de cada turno desde que esta pantalla existe; lo anterior quedó solo en la consola de Anthropic.")}</p>`;
    return;
  }
  const tot = sumarUso(turnos);
  const entradaTotal = tot.entrada + tot.cacheEscritura + tot.cacheLectura;
  const partes = costos(tot, precios);
  const porTipo = Object.entries(turnos.reduce((m, u) => { (m[u.tipo || "entrevista"] ||= []).push(u); return m; }, {})).map(([tipo, ts]) => ({ tipo, ...sumarUso(ts) })).sort((a, b) => b.usd - a.usd);
  const porDia = Object.entries(turnos.reduce((m, u) => { const d = new Date(u.ts); const k = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); (m[k] ||= []).push(u); return m; }, {})).map(([k, ts]) => ({ dia: Number(k), ...sumarUso(ts) })).sort((a, b) => a.dia - b.dia).slice(-31);
  const porPantalla = Object.entries(turnos.filter((u) => u.pantalla).reduce((m, u) => { (m[u.pantalla] ||= []).push(u); return m; }, {})).map(([pantalla, ts]) => ({ pantalla, ...sumarUso(ts) })).sort((a, b) => b.usd - a.usd);

  cuerpo.innerHTML = `
    <section class="uso__resumen">
      <div><span class="uso__cifra">${usd(tot.usd)}</span><span class="uso__etiqueta">${t("gastados desde el {d}", { d: fechaCorta(turnos[0].ts) })}</span></div>
      <div><span class="uso__cifra">${tokens(entradaTotal)}</span><span class="uso__etiqueta">${t("tokens de entrada, {p} % leídos de caché", { p: pct(tot.cacheLectura, entradaTotal) })}</span></div>
      <div><span class="uso__cifra">${tokens(tot.salida)}</span><span class="uso__etiqueta">${t("tokens de salida")}</span></div>
      <div><span class="uso__cifra">${tot.turnos}</span><span class="uso__etiqueta">${t("{t}, {l} llamadas a la API", { t: tot.turnos === 1 ? t("turno") : t("turnos"), l: tot.llamadas })}</span></div>
    </section>

    <section class="uso__bloque">
      <h2>${t("En qué se va la plata")}</h2>
      <p class="uso__nota">${t("Con {m}, por millón de tokens: entrada {e}, salida {s}, escribir caché {ce}, leerla {cl}.", { m: esc(usoDatos.modelo), e: usd(precios?.entrada || 0), s: usd(precios?.salida || 0), ce: usd(precios?.cacheEscritura || 0), cl: usd(precios?.cacheLectura || 0) })}</p>
      ${barraApilada(partes, tot.usd)}
      <ul class="uso__leyenda">${partes.map((p) => `<li><i style="background:${p.color}"></i><span>${p.nombre}</span><span class="uso__num">${tokens(p.tokens)} tokens</span><span class="uso__num">${usd(p.usd)} · ${pct(p.usd, tot.usd)} %</span></li>`).join("")}</ul>
    </section>

    <section class="uso__bloque">
      <h2>${t("Por tipo de trabajo")}</h2>
      <table class="uso__tabla">
        <thead><tr><th>${t("Qué")}</th><th class="num">${t("Turnos")}</th><th class="num">${t("Entrada")}</th><th class="num">${t("Salida")}</th><th class="num">${t("Gasto")}</th><th class="num">${t("Por turno")}</th></tr></thead>
        <tbody>${porTipo.map((x) => `<tr><td>${TIPO_TEXTO[x.tipo] || esc(x.tipo)}</td><td class="num">${x.turnos}</td><td class="num">${tokens(x.entrada + x.cacheEscritura + x.cacheLectura)}</td><td class="num">${tokens(x.salida)}</td><td class="num">${usd(x.usd)} <span class="uso__tenue">${pct(x.usd, tot.usd)} %</span></td><td class="num">${usd(x.usd / x.turnos)}</td></tr>`).join("")}</tbody>
      </table>
      ${porPantalla.length ? `<h3>${t("Por pantalla del prototipo")}</h3><table class="uso__tabla"><thead><tr><th>${t("Pantalla")}</th><th class="num">${t("Veces")}</th><th class="num">${t("Salida")}</th><th class="num">${t("Gasto")}</th></tr></thead><tbody>${porPantalla.map((x) => `<tr><td>${esc(x.pantalla)}</td><td class="num">${x.turnos}</td><td class="num">${tokens(x.salida)}</td><td class="num">${usd(x.usd)}</td></tr>`).join("")}</tbody></table>` : ""}
    </section>

    <section class="uso__bloque">
      <h2>${t("Gasto por día")}</h2>
      ${barrasPorDia(porDia)}
    </section>

    ${idProyecto ? `<section class="uso__bloque">
      <h2>${t("Peso de la conversación")}</h2>
      <p class="uso__nota">${t("Cuántos tokens se mandaron a la API en cada turno. Plano manda la conversación cada vez; lo que ya se mandó antes se lee de caché (barato) si pasó menos de una hora desde el turno anterior. Al pasar {u} tokens se compacta sola: los mensajes viejos dejan de mandarse y el agente sigue desde el Plano.", { u: tokens(usoDatos.umbral) })}${proyectos[0]?.compactaciones?.length ? " " + t("Se compactó {n} veces, la última el {f}.", { n: proyectos[0].compactaciones.length, f: fechaHora(proyectos[0].compactaciones.at(-1).ts) }) : ""}</p>
      ${lineaContexto(turnos, usoDatos.umbral)}
    </section>` : `<section class="uso__bloque">
      <h2>${t("Por proyecto")}</h2>
      <table class="uso__tabla uso__tabla--click">
        <thead><tr><th>${t("Proyecto")}</th><th class="num">${t("Turnos")}</th><th class="num">${t("Entrada")}</th><th class="num">${t("De caché")}</th><th class="num">${t("Salida")}</th><th class="num">${t("Pesa hoy")}</th><th class="num">${t("Gasto")}</th></tr></thead>
        <tbody>${usoDatos.proyectos.map((p) => { const s = sumarUso(p.turnos); const e = s.entrada + s.cacheEscritura + s.cacheLectura; const ultimo = p.turnos.at(-1); return `<tr data-proyecto="${esc(p.id)}"><td>${esc(p.nombre)}</td><td class="num">${s.turnos}</td><td class="num">${tokens(e)}</td><td class="num">${pct(s.cacheLectura, e)} %</td><td class="num">${tokens(s.salida)}</td><td class="num">${ultimo?.contexto ? tokens(ultimo.contexto) : "—"}</td><td class="num">${usd(s.usd)}</td></tr>`; }).join("")}</tbody>
      </table>
    </section>`}

    <section class="uso__bloque">
      <h2>${t("Cómo bajar el gasto")}</h2>
      ${consejos(turnos, tot, porTipo, idProyecto)}
    </section>

    <section class="uso__bloque">
      <h2>${t("Últimos turnos")}</h2>
      <table class="uso__tabla">
        <thead><tr><th>${t("Cuándo")}</th>${idProyecto ? "" : `<th>${t("Proyecto")}</th>`}<th>${t("Qué")}</th><th class="num">${t("Llamadas")}</th><th class="num">${t("Pesó")}</th><th class="num">${t("Entrada nueva")}</th><th class="num">${t("De caché")}</th><th class="num">${t("Salida")}</th><th class="num">${t("Gasto")}</th></tr></thead>
        <tbody>${turnos.slice(-40).reverse().map((u) => `<tr><td>${fechaHora(u.ts)}</td>${idProyecto ? "" : `<td>${esc(u.proyecto)}</td>`}<td>${TIPO_TEXTO[u.tipo] || t("Entrevista")}${u.pantalla ? ` <span class="uso__tenue">${esc(u.pantalla)}</span>` : ""}</td><td class="num">${u.llamadas || 1}</td><td class="num">${u.contexto ? tokens(u.contexto) : "—"}</td><td class="num">${tokens(u.entrada + (u.cacheEscritura || 0))}</td><td class="num">${tokens(u.cacheLectura || 0)}</td><td class="num">${tokens(u.salida)}</td><td class="num">${usd(u.usd)}</td></tr>`).join("")}</tbody>
      </table>
    </section>`;
  cuerpo.querySelectorAll("tr[data-proyecto]").forEach((tr) => { tr.onclick = () => { $("#uso-proyecto").value = tr.dataset.proyecto; $("#uso-proyecto").onchange(); }; });
}

function barraApilada(partes, total) {
  if (!total) return "";
  return `<div class="uso__apilada">${partes.filter((p) => p.usd > 0).map((p) => `<i style="flex:${p.usd / total};background:${p.color}" title="${esc(p.nombre)}: ${usd(p.usd)}"></i>`).join("")}</div>`;
}

function barrasPorDia(dias) {
  const max = Math.max(...dias.map((d) => d.usd), 0.01);
  const W = 800, H = 180, mi = 64, ancho = (W - mi - 8) / dias.length, grosor = Math.min(ancho * 0.7, 48);
  const y = (v) => H - 28 - (v / max) * (H - 48);
  const marcas = [0, max / 2, max];
  return `<svg class="uso__grafica" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("Gasto por día")}">
    ${marcas.map((m) => `<line x1="${mi}" x2="${W - 8}" y1="${y(m)}" y2="${y(m)}" class="uso__eje"/><text x="${mi - 6}" y="${y(m) + 4}" class="uso__texto" text-anchor="end">${usd(m)}</text>`).join("")}
    ${dias.map((d, k) => { const x = mi + k * ancho; return `<g><title>${fechaCorta(d.dia)}: ${usd(d.usd)}, ${d.turnos} ${d.turnos === 1 ? t("turno") : t("turnos")}</title><rect x="${x + (ancho - grosor) / 2}" y="${y(d.usd)}" width="${grosor}" height="${H - 28 - y(d.usd)}" rx="3" class="uso__barra"/>${dias.length <= 16 || k % Math.ceil(dias.length / 12) === 0 ? `<text x="${x + ancho / 2}" y="${H - 10}" class="uso__texto" text-anchor="middle">${fechaCorta(d.dia)}</text>` : ""}</g>`; }).join("")}
  </svg>`;
}

function lineaContexto(turnos, umbral) {
  const con = turnos.filter((u) => u.contexto);
  if (con.length < 2) return `<p class="uso__nota">${t("Todavía no hay turnos suficientes para dibujarlo.")}</p>`;
  const max = Math.max(...con.map((u) => u.contexto), umbral ? umbral * 1.1 : 0);
  const W = 800, H = 180, mi = 64;
  const x = (k) => mi + (k / (con.length - 1)) * (W - mi - 12);
  const y = (v) => H - 28 - (v / max) * (H - 48);
  const marcas = [0, max / 2, max];
  return `<svg class="uso__grafica" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("Peso de la conversación")}">
    ${marcas.map((m) => `<line x1="${mi}" x2="${W - 8}" y1="${y(m)}" y2="${y(m)}" class="uso__eje"/><text x="${mi - 6}" y="${y(m) + 4}" class="uso__texto" text-anchor="end">${tokens(Math.round(m))}</text>`).join("")}
    ${umbral && umbral < max ? `<line x1="${mi}" x2="${W - 8}" y1="${y(umbral)}" y2="${y(umbral)}" class="uso__umbral"/><text x="${mi + 6}" y="${y(umbral) - 5}" class="uso__texto">${t("se compacta al pasar {u}", { u: tokens(umbral) })}</text>` : ""}
    <polyline class="uso__linea" points="${con.map((u, k) => `${x(k)},${y(u.contexto)}`).join(" ")}"/>
    ${con.map((u, k) => `<circle cx="${x(k)}" cy="${y(u.contexto)}" r="3" class="uso__punto"><title>${t("Turno {k} · {f}: {n} tokens", { k: k + 1, f: fechaHora(u.ts), n: tokens(u.contexto) })}</title></circle>`).join("")}
    <text x="${mi}" y="${H - 10}" class="uso__texto">${t("primer turno")}</text><text x="${W - 12}" y="${H - 10}" class="uso__texto" text-anchor="end">${t("último: {n} tokens", { n: tokens(con.at(-1).contexto) })}</text>
  </svg>`;
}

// Observaciones sacadas de los datos, no consejos genéricos.
function consejos(turnos, tot, porTipo, idProyecto) {
  const L = [];
  const ultimos = turnos.slice(-10);
  const entradaUlt = ultimos.reduce((s, u) => s + u.entrada + (u.cacheEscritura || 0) + (u.cacheLectura || 0), 0);
  const cacheUlt = pct(ultimos.reduce((s, u) => s + (u.cacheLectura || 0), 0), entradaUlt);
  const huecos = ultimos.slice(1).map((u, k) => u.ts - ultimos[k].ts).filter((d) => d > 0);
  const huecosLargos = huecos.filter((d) => d > 60 * 60 * 1000).length;
  if (ultimos.length >= 4 && cacheUlt < 60) {
    L.push(`<li>${t("<strong>La caché está rindiendo poco: {c} % en los últimos {n} turnos.</strong> La caché dura una hora; si pasa más tiempo entre un mensaje y el siguiente, la conversación entera se vuelve a escribir ({w} por millón) en vez de leerse ({r}).", { c: cacheUlt, n: ultimos.length, w: usd(usoDatos.precios?.cacheEscritura || 0), r: usd(usoDatos.precios?.cacheLectura || 0) })} ${huecosLargos ? t("En {h} de esos turnos pasó más de una hora.", { h: huecosLargos }) : ""} ${t("Trabajar en sesiones seguidas sale varias veces más barato que un mensaje suelto cada tanto.")}</li>`);
  } else if (ultimos.length >= 4) {
    L.push(`<li>${t("<strong>La caché está rindiendo bien: {c} % de la entrada de los últimos turnos vino de caché.</strong> Cada token leído de caché cuesta la vigésima parte de uno nuevo.", { c: cacheUlt })}</li>`);
  }
  const porProyecto = idProyecto ? [turnos] : Object.values(turnos.reduce((m, u) => { (m[u.proyectoId] ||= []).push(u); return m; }, {}));
  for (const ts of porProyecto) {
    const ult = ts.at(-1);
    if (ult?.contexto > 60000) {
      const porTurno = ((ult.contexto * (usoDatos.precios?.cacheLectura || 0)) / 1e6);
      L.push(`<li><strong>La conversación de ${esc(ult.proyecto)} ya pesa ${tokens(ult.contexto)} tokens.</strong> Cada turno vuelve a mandarla entera: como mínimo ${usd(porTurno)} por turno aunque pegue toda la caché, y ${usd((ult.contexto * (usoDatos.precios?.entrada || 0)) / 1e6)} si no pega. Al pasar ${tokens(usoDatos.umbral)} se compacta sola y vuelve a pesar poco; mientras tanto, mensajes cortos y en tandas.</li>`);
    }
  }
  const pantallas = porTipo.filter((x) => x.tipo === "prototipo" || x.tipo === "revision");
  const usdPantallas = pantallas.reduce((s, x) => s + x.usd, 0);
  if (usdPantallas && pct(usdPantallas, tot.usd) >= 40) {
    const gen = porTipo.find((x) => x.tipo === "prototipo");
    L.push(`<li>${t("<strong>Las pantallas del prototipo son el {p} % del gasto.</strong>", { p: pct(usdPantallas, tot.usd) })} ${gen ? t("Generar una cuesta {c} en promedio, casi todo salida ({n} tokens a {s} el millón).", { c: usd(gen.usd / gen.turnos), n: tokens(Math.round(gen.salida / gen.turnos)), s: usd(usoDatos.precios?.salida || 0) }) : ""} ${t("Es el trabajo caro por naturaleza: la IA escribe un archivo entero. Devolver con un comentario puntual sale más barato que generar de nuevo, porque reescribe el archivo una vez y no itera a ciegas.")}</li>`);
  }
  const multi = turnos.filter((u) => (u.llamadas || 1) >= 4).length;
  if (multi >= 3) L.push(`<li>${t("<strong>{n} turnos necesitaron 4 llamadas o más a la API.</strong> Cada llamada vuelve a mandar toda la conversación. Pasa cuando la IA registra muchas tarjetas de a una o cuando una pantalla falla la verificación y la corrige varias veces. Mensajes más acotados dan turnos más cortos.", { n: multi })}</li>`);
  const salidaPct = pct(costos(tot, usoDatos.precios)[0].usd, tot.usd);
  L.push(`<li>${t("<strong>La salida es el {a} % de la plata con el {b} % de los tokens.</strong> Un token escrito cuesta {x} veces uno leído y {y} veces uno de caché. Pedir respuestas cortas en la entrevista y pantallas sin adornos innecesarios es lo que más mueve la aguja.", { a: salidaPct, b: pct(tot.salida, tot.entrada + tot.cacheEscritura + tot.cacheLectura + tot.salida), x: usoDatos.precios ? Math.round(usoDatos.precios.salida / usoDatos.precios.entrada) : 5, y: usoDatos.precios ? Math.round(usoDatos.precios.salida / usoDatos.precios.cacheLectura) : 100 })}</li>`);
  L.push(`<li>${t("<strong>Modelo: {m}.</strong> Se cambia con PLANO_MODELO en .env. Sonnet 5.5 cuesta la mitad por token; para la entrevista suele alcanzar, para diseñar pantallas conviene probar antes de decidir.", { m: esc(usoDatos.modelo) })}</li>`);
  return `<ul class="uso__consejos">${L.join("")}</ul>`;
}

// ---------- construcción ----------
// El tablero vive en plano/construccion.json. Lo escribe el agente de código desde su terminal; Plano lo mira cada pocos
// segundos, verifica lo que el agente marcó como hecho, y acá se muestra lo que la persona tiene que mirar.
function resumenConstruccion(tab) {
  const por = {};
  for (const x of tab.tareas) por[x.estado] = (por[x.estado] || 0) + 1;
  const paraPersona = tab.tareas.filter((x) => x.estado === "hecha" && x.verificacion?.ok && (x.criterios || []).some((c) => c.tipo === "persona")).map((x) => x.id);
  return { total: tab.tareas.length, por, paraPersona, terminada: tab.tareas.every((x) => x.estado === "aprobada") };
}
async function cargarConstruccion() {
  if (!proyecto) return;
  try {
    const json = await (await fetch(`/api/proyectos/${proyecto.id}/construccion`)).json();
    const antes = JSON.stringify([construccion, construccionActividad]), hadTab = Boolean(construccion);
    construccion = json.tablero || null; construible = json.construible || null;
    construccionActividad = json.actividad || null; construccionResumen = json.resumen || null;
    if (JSON.stringify([construccion, construccionActividad]) !== antes && !document.activeElement?.classList.contains("constr__url")) {
      if (Boolean(construccion) !== hadTab) renderPestanas();
      else renderPestanas();
      if (pestanaActiva === "construccion") renderContenido();
      renderSiguiente();
    }
  } catch {}
  clearTimeout(relojConstruccion);
  // mientras se mira el tablero se consulta seguido; si no, cada tanto, para que la barra de "siguiente" no quede vieja
  if (construccion && !construccion.tareas.every((x) => x.estado === "aprobada")) relojConstruccion = setTimeout(cargarConstruccion, pestanaActiva === "construccion" ? (construccionActividad ? 2000 : 4000) : 20000);
}
async function prepararConstruccion(version) {
  const r = await fetch(`/api/proyectos/${proyecto.id}/construccion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version }) });
  const json = await r.json();
  if (!r.ok) return agregarMensaje("error", json.error || t("No se pudo preparar la construcción."));
  construccion = json.tablero; tareaActiva = null;
  pestanaActiva = "construccion"; mostrandoChat = false;
  renderVista();
  cargarConstruccion();
}
async function accionTarea(id, accion, cuerpo) {
  const r = await fetch(`/api/proyectos/${proyecto.id}/construccion/${encodeURIComponent(id)}/${accion}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo || {}) });
  const json = await r.json();
  if (!r.ok) return agregarMensaje("error", json.error || t("No se pudo."));
  construccion = json.tablero; renderPestanas(); renderContenido(); renderSiguiente();
}
async function ajustarConstruccion(cambios) {
  const r = await fetch(`/api/proyectos/${proyecto.id}/construccion`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(cambios) });
  const json = await r.json();
  if (r.ok) construccion = json.tablero; // sin volver a dibujar: la persona puede estar escribiendo en el campo
  return r.ok;
}
async function verificarAhora() {
  const r = await fetch(`/api/proyectos/${proyecto.id}/construccion/verificar`, { method: "POST" });
  const json = await r.json();
  if (r.ok) { construccion = json.tablero; construccionActividad = json.actividad || null; construccionResumen = json.resumen || null; renderContenido(); }
  clearTimeout(relojConstruccion); relojConstruccion = setTimeout(cargarConstruccion, 1500);
}

const ESTADO_TAREA = () => ({ pendiente: t("pendiente"), en_curso: t("el agente la está haciendo"), hecha: t("hecha, para revisar"), verificando: t("verificando…"), aprobada: t("aprobada"), devuelta: t("devuelta") });
const TIPO_TAREA = () => ({ cimientos: t("Cimientos"), entidad: t("Datos"), pantalla: t("Pantalla"), integracion: t("Integración"), recorrido: t("Recorrido"), publicacion: t("Publicación") });

function renderConstruccion() {
  const wrap = document.createElement("div");
  wrap.className = "constr";
  const tab = construccion;
  if (!tab) { wrap.append(vacio("construccion")); return wrap; }
  const r = resumenConstruccion(tab);
  const ET = ESTADO_TAREA(), TT = TIPO_TAREA();
  const estadoVisible = (x) => (x.estado === "hecha" && x.verificacion?.ok ? t("verificada, para revisar") : x.estado === "hecha" && x.verificacion?.esperandoPersona ? t("esperando pasos tuyos") : x.estado === "hecha" ? t("hecha, esperando verificación") : ET[x.estado] || x.estado);

  // cabecera: qué versión, qué está pasando ahora, dónde, cómo arrancar
  const cab = document.createElement("div");
  cab.className = "constr__cab";
  const comando = t("seguí con el Plano");
  const rs = construccionResumen || {};
  const porVerificar = tab.tareas.filter((x) => x.estado === "hecha" && x.verificacion?.ok !== true && !x.verificacion?.esperandoPersona);
  const esperandoPersona = tab.tareas.filter((x) => x.estado === "hecha" && x.verificacion?.esperandoPersona);
  const titulo = (id) => tab.tareas.find((x) => x.id === id)?.titulo || id;
  const hace = (ts) => (ts ? cuandoMensaje(new Date(ts).getTime()) : null);
  // "Ahora": una sola frase que diga de quién es el turno y por qué; es lo primero que se lee
  let ahora, tono = "agente", botonVerificar = false;
  if (construccionActividad) { ahora = `<strong>${t("Plano está verificando")}</strong> «${esc(construccionActividad.titulo)}»: ${esc(construccionActividad.paso)} · ${esc(hace(construccionActividad.desde) || "")}`; tono = "plano"; }
  else if (porVerificar.length) { ahora = `<strong>${t("Plano tiene que verificar")}</strong> ${t("{n} tarea(s) que el agente marcó como hechas: {l}.", { n: porVerificar.length, l: porVerificar.map((x) => `«${esc(x.titulo)}»`).join(", ") })}`; tono = "plano"; botonVerificar = true; }
  else if (esperandoPersona.length) { ahora = `<strong>${t("Te toca a vos")}</strong> ${esperandoPersona.map((x) => `«${esc(x.titulo)}»: ${esc(x.verificacion.esperandoPersona)}`).join(" ")} ${t("Los pasos están en {f}. Cuando termines, apretá Verificar ahora.", { f: `<code>${esc(tab.carpeta_app)}/DEPLOY.md</code>` })}`; tono = "persona"; botonVerificar = true; }
  else if (r.paraPersona.length) { ahora = `<strong>${t("Te toca a vos")}</strong> ${t("{n} tarea(s) pasaron la verificación de Plano y esperan que las mires y las apruebes o devuelvas. El agente no sigue con lo que depende de ellas hasta que lo hagas.", { n: r.paraPersona.length })}`; tono = "persona"; }
  else if (r.terminada) { ahora = `<strong>${t("Construida.")}</strong> ${t("Las {n} tareas están aprobadas.", { n: r.total })}`; tono = "ok"; }
  else if ((rs.enCurso || []).length) { ahora = `<strong>${t("El agente está trabajando")}</strong> ${t("en {l}.", { l: rs.enCurso.map((id) => `«${esc(titulo(id))}»`).join(", ") })}${rs.ultimoAgente ? ` ${t("Última señal del agente: {h}.", { h: esc(hace(rs.ultimoAgente)) })}` : ""}`; }
  else if ((rs.libres || []).length && rs.ultimoAgente && Date.now() - new Date(rs.ultimoAgente).getTime() < 120000) { ahora = `<strong>${t("El agente está entre tareas.")}</strong> ${t("Última señal del agente: {h}.", { h: esc(hace(rs.ultimoAgente)) })}`; }
  else if ((rs.libres || []).length) { ahora = `<strong>${t("El agente está parado.")}</strong> ${t("Hay {n} tarea(s) listas para tomar ({l}) y ninguna en curso. Si Claude Code se detuvo, decile: {c}.", { n: rs.libres.length, l: rs.libres.slice(0, 3).map((id) => `«${esc(titulo(id))}»`).join(", ") + (rs.libres.length > 3 ? "…" : ""), c: `<code>${esc(comando)}</code>` })}${rs.ultimoAgente ? ` ${t("Última señal del agente: {h}.", { h: esc(hace(rs.ultimoAgente)) })}` : ""}`; tono = "parado"; }
  else if (r.por.devuelta) { ahora = `<strong>${t("Hay tareas devueltas")}</strong> ${t("esperando al agente.")}`; tono = "parado"; }
  else ahora = t("Nada pendiente de tu lado por ahora.");
  cab.innerHTML = `
    <div class="constr__titulo"><div><strong>${esc(tab.version)} · ${esc(tab.titulo)}</strong><span>${t("{a} de {n} tareas aprobadas", { a: r.por.aprobada || 0, n: r.total })}${r.por.devuelta ? ` · ${t("{n} devueltas", { n: r.por.devuelta })}` : ""}${r.paraPersona.length ? ` · ${t("{n} para revisar", { n: r.paraPersona.length })}` : ""}</span></div>
      <button type="button" class="btn btn--fantasma btn--chico constr__regenerar" title="${esc(t("Reescribe AGENTS.md y las descripciones de las tareas desde el Plano actual. Sin IA, no gasta nada. No borra nada: estados, archivos, notas y commits se conservan."))}">${t("Volver a preparar")} <small>${t("sin IA")}</small></button></div>
    <div class="constr__barra"><div class="constr__progreso" style="width:${Math.round(((r.por.aprobada || 0) / Math.max(1, r.total)) * 100)}%"></div></div>
    <div class="constr__turno constr__turno--${tono}"><div>${ahora}</div>${botonVerificar ? `<button type="button" class="btn btn--chico btn--secundario constr__verificar-ahora">${t("Verificar ahora")}</button>` : ""}</div>
    <div class="constr__como">
      <p>${t("Abrí la carpeta")} <code>${esc(tab.carpeta_app)}</code> ${t("del proyecto en Claude Code (o el agente que uses) y decile:")} <button type="button" class="constr__copiar" title="${esc(t("Copiar"))}"><code>${esc(comando)}</code></button>. ${t("El contrato está en")} <code>AGENTS.md</code>; ${t("el agente marca cada tarea en")} <code>plano/construccion.json</code> ${t("y Plano la verifica sola. A vos te llegan las pantallas para aprobar.")}</p>
      <label>${t("La app de desarrollo corre en")} <input class="constr__url" data-campo="url_dev" value="${esc(tab.url_dev || "")}" spellcheck="false"><span class="constr__guardado" hidden>${t("guardado")}</span></label>
      <label>${t("La app publicada está en")} <input class="constr__url" data-campo="url_prod" value="${esc(tab.url_prod || "")}" placeholder="https://…" spellcheck="false"><span class="constr__guardado" hidden>${t("guardado")}</span></label>
    </div>
    <details class="constr__mas constr__registro" ${registroAbierto ? "open" : ""}><summary>${t("Registro")} (${(tab.registro || []).length})</summary><ol class="constr__eventos">${[...(tab.registro || [])].reverse().slice(0, 40).map((e) => `<li class="constr__evento constr__evento--${esc(e.quien)}"><time>${esc(hace(e.ts) || "")}</time><span class="constr__quien">${esc(e.quien === "plano" ? "Plano" : e.quien === "agente" ? t("agente") : t("vos"))}</span><span>${esc(e.texto)}</span></li>`).join("") || `<li class="constr__evento"><span>${t("Todavía no pasó nada.")}</span></li>`}</ol></details>`;
  cab.querySelector(".constr__copiar").onclick = (e) => { navigator.clipboard?.writeText(comando); e.currentTarget.classList.add("constr__copiar--ok"); setTimeout(() => e.currentTarget?.classList.remove("constr__copiar--ok"), 900); };
  cab.querySelector(".constr__regenerar").onclick = () => prepararConstruccion(tab.version);
  cab.querySelector(".constr__verificar-ahora")?.addEventListener("click", verificarAhora);
  cab.querySelector(".constr__registro").addEventListener("toggle", (e) => { registroAbierto = e.target.open; });
  // la URL se guarda sola mientras se escribe, sin botón
  for (const url of cab.querySelectorAll(".constr__url")) {
    const guardado = url.nextElementSibling;
    let relojUrl = null;
    url.oninput = () => { clearTimeout(relojUrl); relojUrl = setTimeout(async () => { if (await ajustarConstruccion({ [url.dataset.campo]: url.value })) { guardado.hidden = false; setTimeout(() => { guardado.hidden = true; }, 1200); } }, 600); };
  }
  wrap.append(cab);

  // el tablero: primero lo que espera a la persona, después lo que está en movimiento, después lo pendiente, y al final lo aprobado
  const orden = { hecha: 0, verificando: 1, en_curso: 2, devuelta: 3, pendiente: 4, aprobada: 5 };
  const tareas = [...tab.tareas].sort((a, b) => (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9) || a.orden - b.orden);
  const cuerpo = document.createElement("div");
  cuerpo.className = "constr__cuerpo";
  const lista = document.createElement("div");
  lista.className = "constr__lista filas";
  for (const x of tareas) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `fila constr__tarea constr__tarea--${x.estado} ${x.id === tareaActiva ? "constr__tarea--activa" : ""} ${x.estado === "hecha" && x.verificacion?.ok ? "constr__tarea--revisar" : ""}`;
    b.innerHTML = `<span class="constr__punto"></span><span class="fila__titulo">${esc(x.titulo)}</span><span class="fila__desc">${esc(TT[x.tipo] || x.tipo)}${x.estado === "devuelta" && x.comentario ? ` · ${esc(recortar(x.comentario.replace(/^\[[^\]]*\]\s*/, ""), 90))}` : ""}</span><span class="fila__extra">${esc(estadoVisible(x))}</span>`;
    b.onclick = () => { tareaActiva = x.id === tareaActiva ? null : x.id; renderContenido(); };
    lista.append(b);
    if (x.id === tareaActiva) lista.append(renderTarea(x, tab)); // el detalle se abre debajo de su fila
  }
  cuerpo.append(lista);
  wrap.append(cuerpo);
  return wrap;
}

function renderTarea(x, tab) {
  const det = document.createElement("section");
  det.className = "constr__detalle";
  const TT = TIPO_TAREA();
  const bloqueada = (x.depende_de || []).filter((d) => tab.tareas.find((y) => y.id === d)?.estado !== "aprobada");
  const paraPersona = x.estado === "hecha" && x.verificacion?.ok && (x.criterios || []).some((c) => c.tipo === "persona");
  const ver = x.verificacion;
  det.innerHTML = `
    <header class="constr__det-cab">
      <div><span class="constr__tipo">${esc(TT[x.tipo] || x.tipo)}</span><h3>${esc(x.titulo)}</h3></div>
      <div class="constr__det-acciones"></div>
    </header>
    ${x.estado === "devuelta" && x.comentario ? `<p class="constr__devuelta">${esc(x.comentario)}</p>` : ""}
    ${bloqueada.length && x.estado === "pendiente" ? `<p class="constr__nota">${t("Espera a:")} ${bloqueada.map((d) => esc(tab.tareas.find((y) => y.id === d)?.titulo || d)).join(", ")}</p>` : ""}
    ${x.verificacion?.esperandoPersona ? `<div class="constr__mirar"><strong>${t("Lo que tenés que hacer")}</strong><p>${esc(x.verificacion.esperandoPersona)}</p><span>${t("Los pasos están en {f}. Cuando termines, apretá Verificar de nuevo.", { f: `${esc(tab.carpeta_app)}/DEPLOY.md` })}</span></div>` : ""}
    ${paraPersona ? `<div class="constr__mirar"><strong>${t("Lo que tenés que mirar")}</strong>${(x.criterios || []).filter((c) => c.tipo === "persona").map((c) => `<p>${esc(c.texto)}</p>`).join("")}<span>${t("Lo demás (compila, archivos, data-plano) ya lo verificó Plano.")}</span></div>` : ""}
    <div class="constr__visor"></div>
    ${renderNotas(x.notas)}
    ${ver ? `<h4>${t("Verificación de Plano")} <small>${esc(cuandoMensaje(new Date(ver.ts).getTime()))}</small></h4><ul class="constr__verif">${ver.resultados.map((c) => `<li class="${c.ok === true ? "ok" : c.ok === false ? "mal" : "persona"}"><span>${c.ok === true ? "✓" : c.ok === false ? "✗" : "👁"}</span><div><strong>${esc(c.tipo === "comando" ? c.comando || c.que : c.tipo === "ruta" ? (c.url || c.ruta) : c.tipo === "archivos" ? t("archivos declarados") : c.tipo === "marcas" ? t("marcas del Plano en el código") : c.texto || c.tipo)}</strong>${c.salteado ? ` <em>${t("salteado")}: ${esc(c.salteado)}</em>` : ""}${c.faltan?.length ? `<div class="constr__faltan">${t("Faltan")}: ${c.faltan.map(esc).join(", ")}</div>` : ""}${c.error ? `<div class="constr__faltan">${esc(c.error)}</div>` : ""}${c.ok === false && c.salida ? `<pre>${esc(c.salida.slice(-1200))}</pre>` : ""}</div></li>`).join("")}</ul>` : ""}
    ${x.commit?.hash ? `<p class="constr__nota">${t("Commit")} <code>${esc(x.commit.hash)}</code> · ${esc(x.commit.mensaje || "")}</p>` : ""}
    ${x.archivos?.length ? `<details class="constr__mas"><summary>${t("Archivos")} (${x.archivos.length})</summary><ul class="constr__archivos">${x.archivos.map((a) => `<li><code>${esc(a)}</code></li>`).join("")}</ul></details>` : ""}
    <details class="constr__mas"><summary>${t("Lo que tiene que hacer el agente")}</summary><div class="constr__descripcion">${markdown(x.descripcion || "")}</div></details>
    <div class="constr__comentario-zona" hidden></div>`;
  const acc = det.querySelector(".constr__det-acciones");
  const zona = det.querySelector(".constr__comentario-zona");
  const btn = (texto, clase, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn btn--chico " + clase; b.textContent = texto; b.onclick = fn; acc.append(b); return b; };
  if (paraPersona) {
    btn(t("Aprobar"), "btn--primario", () => accionTarea(x.id, "aprobar"));
    btn(t("Devolver con un comentario"), "btn--secundario", () => pedirComentarioTarea(zona, x.id));
  }
  if (["hecha", "devuelta"].includes(x.estado)) btn(t("Verificar de nuevo"), "btn--fantasma", () => accionTarea(x.id, "verificar"));
  if (x.estado === "aprobada") btn(t("Devolver igual"), "btn--fantasma", () => pedirComentarioTarea(zona, x.id));
  // pantallas: la app real al lado del prototipo aprobado, en el mismo marco
  if (x.tipo === "pantalla" && ["hecha", "aprobada", "devuelta", "verificando"].includes(x.estado)) det.querySelector(".constr__visor").replaceWith(renderComparacion(x, tab));
  if (borradorTarea?.id === x.id) pedirComentarioTarea(zona, x.id, { foco: !escribiendoEnOtroLado() });
  return det;
}

// Las notas del agente: idealmente un objeto { hecho, probar[], decisiones[] } (lo pide el contrato); si vino un texto, se muestra plegado.
function renderNotas(n) {
  if (!n) return "";
  if (typeof n === "object") {
    const lista = (arr) => (Array.isArray(arr) ? arr : String(arr || "").split(/\n+/).filter(Boolean)).map((i) => `<li>${esc(String(i))}</li>`).join("");
    return `
      ${n.hecho ? `<h4>${t("Qué quedó hecho")}</h4><p class="constr__hecho">${esc(String(n.hecho))}</p>` : ""}
      ${n.probar && (Array.isArray(n.probar) ? n.probar.length : n.probar) ? `<h4>${t("Cómo probarlo")}</h4><ol class="constr__probar">${lista(n.probar)}</ol>` : ""}
      ${n.decisiones && (Array.isArray(n.decisiones) ? n.decisiones.length : n.decisiones) ? `<details class="constr__mas"><summary>${t("Decisiones que tomó el agente")}</summary><ul class="constr__decisiones">${lista(n.decisiones)}</ul></details>` : ""}`;
  }
  return `<details class="constr__mas"><summary>${t("Notas del agente")}</summary><div class="constr__notas">${markdown(String(n))}</div></details>`;
}

let borradorTarea = null; // { id, texto }: el tablero se redibuja solo cada pocos segundos y el comentario no se puede perder
function pedirComentarioTarea(cont, id, { foco = true } = {}) {
  cont.hidden = false; cont.innerHTML = "";
  if (borradorTarea?.id !== id) borradorTarea = { id, texto: "" };
  const ta = document.createElement("textarea");
  ta.className = "proto__comentario"; ta.rows = 1; ta.placeholder = t("Qué está mal o qué falta, en tus palabras. El agente lo lee en la tarea.");
  ta.value = borradorTarea.texto;
  const ajustar = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; };
  ta.oninput = () => { borradorTarea = { id, texto: ta.value }; ajustar(); };
  const enviar = document.createElement("button"); enviar.type = "button"; enviar.className = "btn btn--primario"; enviar.textContent = t("Devolver");
  const cancelar = document.createElement("button"); cancelar.type = "button"; cancelar.className = "btn btn--secundario"; cancelar.textContent = t("Cancelar");
  ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar.click(); } if (e.key === "Escape") cancelar.click(); };
  enviar.onclick = () => { const c = ta.value.trim(); if (!c) return ta.focus(); borradorTarea = null; accionTarea(id, "devolver", { comentario: c }); };
  cancelar.onclick = () => { borradorTarea = null; renderContenido(); };
  cont.append(ta, enviar, cancelar);
  if (ta.value) requestAnimationFrame(ajustar);
  if (foco) requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }); // recién cuando la caja está en la página
}

let marcoConstr = localStorage.getItem("plano.marcoConstr") || "celular";
function renderComparacion(x, tab) {
  const p = (plano.pantallas || []).find((y) => y.id === (x.referencias?.pantallas || [])[0]);
  const disp = dispositivosDe(p);
  const marcoActual = disp.includes(marcoConstr) ? marcoConstr : disp[0];
  const urlApp = (tab.url_dev || "http://localhost:5173").replace(/\/$/, "") + (x.ruta || "/");
  const urlProto = `/prototipo/${esc(proyecto.id)}/${esc(p?.id || "")}.html?celular=1`;
  const div = document.createElement("div");
  div.className = "constr__comparar";
  div.innerHTML = `
    <div class="constr__comparar-cab">
      <span>${t("La app construida (izquierda) y el prototipo aprobado (derecha)")}</span>
      <span class="proto__marcos">
        ${disp.includes("celular") ? `<button type="button" class="modo__btn ${marcoActual === "celular" ? "modo__btn--activo" : ""}" data-marco="celular">${ICONO_CELULAR}</button>` : ""}
        ${disp.includes("escritorio") ? `<button type="button" class="modo__btn ${marcoActual === "escritorio" ? "modo__btn--activo" : ""}" data-marco="escritorio">${ICONO_ESCRITORIO}</button>` : ""}
        <a class="modo__btn" href="${esc(urlApp)}" target="_blank" rel="noopener" title="${esc(t("Abrir la app en una pestaña nueva"))}">${ICONO_ABRIR}</a>
      </span>
    </div>
    <div class="constr__lado-a-lado constr__lado-a-lado--${marcoActual}">
      <div class="constr__panel"><div class="marco-zoom"><div class="marco marco--${marcoActual}"><iframe src="${esc(urlApp)}" title="${esc(t("App construida"))}"></iframe></div>${marcoActual === "celular" ? '<div class="bisel"></div>' : ""}</div><span>${esc(urlApp)}</span></div>
      <div class="constr__panel"><div class="marco-zoom"><div class="marco marco--${marcoActual}"><iframe src="${urlProto}" title="${esc(t("Prototipo aprobado"))}"></iframe></div>${marcoActual === "celular" ? '<div class="bisel"></div>' : ""}</div><span>${esc(x.prototipo || "")}</span></div>
    </div>`;
  div.querySelectorAll("[data-marco]").forEach((b) => { b.onclick = () => { marcoConstr = b.dataset.marco; localStorage.setItem("plano.marcoConstr", marcoConstr); renderContenido(); }; });
  return div;
}

// ---------- la barra lateral y la barra de título ----------
// La barra lateral es la navegación de siempre a mano: proyecto nuevo, proyectos, uso, configuración y los proyectos recientes.
// Se pliega (queda guardado); en pantallas angostas se abre por encima y se cierra al elegir algo.
const marcoApp = $("#marco-app");
const angosta = () => matchMedia("(max-width: 900px)").matches;
function plegarLateral(plegar) {
  marcoApp.classList.toggle("marco-app--plegado", plegar);
  $("#lateral-velo").hidden = plegar || !angosta();
  if (!angosta()) localStorage.setItem("plano.lateral", plegar ? "plegado" : "abierto");
}
plegarLateral(angosta() ? true : localStorage.getItem("plano.lateral") === "plegado");
matchMedia("(max-width: 900px)").addEventListener("change", (e) => plegarLateral(e.matches ? true : localStorage.getItem("plano.lateral") === "plegado"));
$("#lateral-cerrar").onclick = () => plegarLateral(true);
$("#lateral-abrir").onclick = () => plegarLateral(false);
$("#lateral-velo").onclick = () => plegarLateral(true);
const cerrarSiAngosta = () => { if (angosta()) plegarLateral(true); };
$("#lateral-nuevo").onclick = () => { cerrarSiAngosta(); $("#nuevo-proyecto").click(); };
$("#volver-barra").addEventListener("click", (e) => { e.preventDefault(); $("#volver").click(); });
$$("[data-ir]").forEach((b) => { b.onclick = () => { cerrarSiAngosta(); if (b.dataset.ir === "inicio") $("#volver").click(); else if (b.dataset.ir === "uso") $("#abrir-uso").click(); else $("#abrir-config").click(); }; });
function marcarLateral(seccion, idProyecto = null) {
  $$("[data-ir]").forEach((b) => b.classList.toggle("lateral__item--activo", b.dataset.ir === seccion));
  $$(".lateral__proyecto").forEach((b) => b.classList.toggle("lateral__proyecto--activo", b.dataset.id === idProyecto));
}
let proyectosRecientes = [];
function renderLateralProyectos(lista) {
  proyectosRecientes = lista;
  const ul = $("#lateral-proyectos");
  ul.innerHTML = "";
  for (const p of lista.slice(0, 30)) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button"; b.className = "lateral__proyecto" + (proyecto?.id === p.id ? " lateral__proyecto--activo" : ""); b.dataset.id = p.id; b.title = p.carpeta;
    b.innerHTML = `<span>${esc(p.nombre)}</span>${p.trabajando ? '<span class="lateral__punto"></span>' : ""}`;
    b.onclick = () => { cerrarSiAngosta(); if (proyecto?.id === p.id) return; history.pushState({}, "", `?p=${p.id}`); abrirProyecto(p.id); };
    li.append(b); ul.append(li);
  }
}
async function cargarLateralProyectos() {
  try { renderLateralProyectos(await (await fetch("/api/proyectos")).json()); } catch {}
}
setInterval(() => { if (!document.hidden && $("#vista-proyectos").hidden) cargarLateralProyectos(); }, 15000);
// el nombre del proyecto en la barra es un desplegable para cambiar de proyecto sin volver al inicio
function ponerProyectoEnBarra(p, texto = null) {
  const b = $("#barra-proyecto");
  if (!p && !texto) { b.hidden = true; return; }
  b.hidden = false;
  b.innerHTML = `<span>${esc(p ? p.nombre : texto)}</span>`;
  b.onclick = () => abrirMenu(b, [
    ...proyectosRecientes.slice(0, 12).map((x) => ({ texto: x.nombre, activo: x.id === p?.id, fn: () => { if (x.id !== p?.id) { history.pushState({}, "", `?p=${x.id}`); abrirProyecto(x.id); } } })),
    { texto: t("Todos los proyectos"), fn: () => $("#volver").click() },
  ]);
}

// ---------- la app de escritorio ----------
// Si la interfaz corre dentro de la cáscara de Electron, la barra es la barra de título de la ventana, los botones del sistema
// siguen al tema, la carpeta se elige con el diálogo nativo y las actualizaciones avisan acá.
const temaOscuro = () => { const m = document.documentElement.dataset.modo; return m === "oscuro" || (m !== "claro" && matchMedia("(prefers-color-scheme: dark)").matches); };
function avisarTemaAlEscritorio() { try { window.plano?.tema(temaOscuro()); } catch {} }
function prepararEscritorio() {
  if (!window.plano?.escritorio) return;
  document.body.classList.add("escritorio");
  if (window.plano.plataforma === "darwin") document.body.classList.add("mac");
  avisarTemaAlEscritorio();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", avisarTemaAlEscritorio);
  window.plano.alActualizar?.(({ version }) => {
    const e = $("#barra-estado");
    e.textContent = t("Plano {v} está listo: reiniciar para actualizar", { v: version });
    e.style.cursor = "pointer";
    e.onclick = () => window.plano.reiniciarParaActualizar();
  });
  // los enlaces que salen de Plano (la app construida, el navegable compartido) van al navegador de la persona
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a || a.target !== "_blank") return;
    const url = a.href;
    if (url.startsWith(location.origin)) return;
    e.preventDefault(); window.plano.abrirExterno(url);
  });
}
