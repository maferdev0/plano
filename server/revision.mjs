import { idsElementos, idsEstados, estadosDeclarados, tieneSelectorAdentro } from "./plano-store.mjs";

// Revisión mecánica de una versión del roadmap: lo que el Plano tiene que tener resuelto antes de prototipar o construir.
// No usa IA. Mira los JSON y devuelve hallazgos concretos; lo que no se pueda decidir por máquina se le pasa al agente
// para que lo pregunte. Cada hallazgo tiene tipo, texto en español y, si aplica, a qué tarjeta apunta.

const VERBOS = /\b(bot[oó]n|enviar|guardar|crear|agregar|sumar|quitar|borrar|eliminar|editar|conectar|marcar|elegir|seleccionar|volver|confirmar|cancelar|pagar|importar|sincronizar|verificar|invitar|filtr|buscar|tomar|asignar|registrar|iniciar|cerrar|subir|descargar|exportar|compartir|activar|desactivar|aprobar|rechazar|responder|reservar|agendar|comprar|pedir|toggle|switch|enlace|link|acceso a)\b/i;
const ENTRADA = /\b(inicio de sesi[oó]n|iniciar sesi[oó]n|entrar|registro|registrarse|login|acceso|passkey|contrase[ñn]a|cuenta nueva|crear cuenta)\b/i;
const GENERICO = /^(bot[oó]n )?(guardar|confirmar|enviar|volver( al? [a-z]+)?|cancelar|cerrar|aceptar|continuar|siguiente|atr[aá]s)$/i;
const ESTATICO = /^(lista|listado|encabezado|logo|t[ií]tulo|descripci[oó]n|insignia|aviso|estado|texto|mensajes?|calendario|horarios?|resumen|tabla|gr[aá]fico|m[eé]tricas?|nombre|precio|imagen|foto|mapa|direcci[oó]n|tel[eé]fono|historial|contador|indicador)\b/i;

const VERBO_RAICES = ["envi", "guard", "cre", "agreg", "sum", "quit", "borr", "elimin", "edit", "conect", "marc", "eleg", "seleccion", "volv", "confirm", "cancel", "pag", "import", "sincroniz", "verific", "invit", "filtr", "busc", "tom", "asign", "registr", "inici", "cerr", "sub", "descarg", "export", "compart", "activ", "desactiv", "aprob", "rechaz", "respond", "reserv", "agend", "compr", "ped"];
const sl = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// leerHtml(idPantalla) → HTML actual del prototipo o null; si no viene, las reglas sobre el HTML se saltean.
export function revisarVersion(plano, versionId, leerHtml = null) {
  const versiones = [...(plano.roadmap || [])].sort((a, b) => (a.orden || 99) - (b.orden || 99));
  const v = versiones.find((x) => x.id === versionId);
  if (!v) return { version: versionId, hallazgos: [{ tipo: "error", texto: `No existe la versión ${versionId}.` }] };
  const idx = versiones.indexOf(v);
  const ordenDe = new Map(); // "tipo/id" → índice de la versión donde entra
  versiones.forEach((ver, i) => { for (const t of ["pantallas", "entidades", "acciones", "integraciones"]) for (const id of ver[t] || []) if (!ordenDe.has(t + "/" + id)) ordenDe.set(t + "/" + id, i); });
  const enEsta = (t, id) => (ordenDe.get(t + "/" + id) ?? Infinity) <= idx;
  const buscar = (t, id) => (plano[t] || []).find((x) => x.id === id);
  const H = [];
  const h = (tipo, texto, ref = {}) => H.push({ tipo, texto, ...ref });

  const pantallas = (v.pantallas || []).map((id) => buscar("pantallas", id)).filter(Boolean);
  const acciones = (plano.acciones || []);
  const accionesV = (v.acciones || []).map((id) => buscar("acciones", id)).filter(Boolean);

  // 1. Referencias rotas: ids de la versión que no existen en el Plano
  for (const t of ["pantallas", "entidades", "acciones", "integraciones"]) for (const id of v[t] || []) if (!buscar(t, id)) h("referencia", `La versión lista ${t}/${id} y esa tarjeta no existe en el Plano.`, { coleccion: t, id });

  // 2. Cada acción de la versión tiene su pantalla y su entidad en esta versión o en una anterior
  for (const a of accionesV) {
    if (a.pantalla && !buscar("pantallas", a.pantalla)) h("referencia", `La acción «${a.titulo}» apunta a la pantalla ${a.pantalla}, que no existe.`, { coleccion: "acciones", id: a.id });
    else if (a.pantalla && !enEsta("pantallas", a.pantalla)) h("orden", `La acción «${a.titulo}» pasa en «${buscar("pantallas", a.pantalla)?.titulo}», que entra en una versión posterior.`, { coleccion: "acciones", id: a.id });
    if (a.entidad && !buscar("entidades", a.entidad)) h("referencia", `La acción «${a.titulo}» toca la entidad ${a.entidad}, que no existe.`, { coleccion: "acciones", id: a.id });
    else if (a.entidad && !enEsta("entidades", a.entidad)) h("orden", `La acción «${a.titulo}» toca «${buscar("entidades", a.entidad)?.titulo}», que entra en una versión posterior.`, { coleccion: "acciones", id: a.id });
    if (a.lleva_a && buscar("pantallas", a.lleva_a) && !enEsta("pantallas", a.lleva_a)) h("orden", `La acción «${a.titulo}» lleva a «${buscar("pantallas", a.lleva_a)?.titulo}», que todavía no entra.`, { coleccion: "acciones", id: a.id });
  }

  // 3. Entidades: lo que referencian (campos "id:otra") tiene que estar; y las que nadie usa, ¿para qué entran?
  for (const id of v.entidades || []) {
    const e = buscar("entidades", id); if (!e) continue;
    for (const [campo, tipo] of Object.entries(e.campos || {})) {
      const m = String(tipo).match(/^id:([a-z0-9-]+)/i); if (!m) continue;
      if (!buscar("entidades", m[1])) h("referencia", `«${e.titulo}».${campo} apunta a la entidad ${m[1]}, que no existe.`, { coleccion: "entidades", id });
      else if (!enEsta("entidades", m[1])) h("orden", `«${e.titulo}».${campo} necesita «${buscar("entidades", m[1])?.titulo}», que entra en una versión posterior.`, { coleccion: "entidades", id });
    }
    const laUsan = accionesV.filter((a) => a.entidad === id);
    const laMuestran = pantallas.filter((p) => (p.entidades || []).includes(id));
    if (!laUsan.length && !laMuestran.length) h("huerfana", `La entidad «${e.titulo}» entra en la ${v.id} pero ninguna acción ni pantalla de la versión la usa. ¿Qué la crea, la muestra o la cambia?`, { coleccion: "entidades", id });
    if (Object.keys(e.campos || {}).length <= 3 && laUsan.length) h("flaca", `«${e.titulo}» tiene solo ${Object.keys(e.campos || {}).length} campos (${Object.keys(e.campos || {}).join(", ")}) y ${laUsan.length} ${laUsan.length === 1 ? "acción la usa" : "acciones la usan"}. Conviene revisar si alcanza para «${laUsan[0].titulo}».`, { coleccion: "entidades", id });
  }

  // 4. Elementos que hacen algo sin acción que los respalde; y acciones de versiones posteriores con botón ya en pantalla
  for (const p of pantallas) {
    const deEsta = accionesV.filter((a) => a.pantalla === p.id);
    const posteriores = acciones.filter((a) => a.pantalla === p.id && !enEsta("acciones", a.id));
    for (const el of p.elementos || []) {
      const texto = String(el);
      if (!VERBOS.test(texto) || ESTATICO.test(texto.trim())) continue;
      const slugEl = sl(texto);
      // un botón genérico (guardar, volver, enviar) se da por cubierto si la pantalla tiene alguna acción en la versión
      if (GENERICO.test(texto.trim()) && deEsta.length) continue;
      const cubierto = deEsta.some((a) => sl(a.elemento) === slugEl || coincide(a.titulo, texto));
      const despues = posteriores.find((a) => sl(a.elemento) === slugEl || coincide(a.titulo, texto));
      if (cubierto) continue;
      if (despues) h("posterior", `En «${p.titulo}», «${texto}» corresponde a la acción «${despues.titulo}», que entra en ${versiones[ordenDe.get("acciones/" + despues.id)]?.id}. Hay que decidir si en la ${v.id} se oculta o se muestra deshabilitado.`, { coleccion: "pantallas", id: p.id });
      else h("sin-accion", `En «${p.titulo}», el elemento «${texto}» hace algo y ninguna acción de la ${v.id} lo cubre.`, { coleccion: "pantallas", id: p.id });
    }
    if (!deEsta.length && (p.elementos || []).some((el) => VERBOS.test(String(el)))) h("sin-accion", `«${p.titulo}» no tiene ninguna acción en la ${v.id}.`, { coleccion: "pantallas", id: p.id });
  }

  // 5. Acciones que crean lo que el objetivo da por hecho
  const objetivo = `${v.objetivo || ""} ${v.descripcion || ""}`.toLowerCase();
  for (const id of v.entidades || []) {
    const e = buscar("entidades", id); if (!e) continue;
    const nombre = String(e.titulo || "").toLowerCase().split(/[ (]/)[0];
    if (nombre.length > 3 && objetivo.includes(nombre) && !accionesV.some((a) => a.entidad === id && /cre|regist|alta|nuev|agreg|carg|agend|gener|descont|consum/i.test(a.titulo + " " + (a.descripcion || "")))) {
      h("creacion", `El objetivo de la ${v.id} menciona «${e.titulo}», pero ninguna acción de la versión la crea o la registra.`, { coleccion: "entidades", id });
    }
  }

  // 6. Hay pantallas de administración y nadie dijo cómo se entra
  const conAdmin = pantallas.some((p) => p.espacio === "admin" || p.espacio === "consola" || /admin\.|consola\.|panel|administr/i.test(p.titulo || "") || /^(admin|consola)-/.test(p.id));
  if (conAdmin) {
    const hayEntrada = pantallas.some((p) => ENTRADA.test(p.titulo + " " + (p.elementos || []).join(" "))) || accionesV.some((a) => ENTRADA.test(a.titulo + " " + (a.descripcion || "")));
    const decidido = (plano.decisiones || []).some((d) => ENTRADA.test(d.titulo + " " + (d.descripcion || "")) && /propietari|empresa|admin|operador|usuario/i.test(d.titulo + " " + (d.descripcion || "")));
    if (!hayEntrada) h("entrada", `La ${v.id} tiene pantallas de administración y ninguna pantalla ni acción de cómo entra el propietario (registro, inicio de sesión).${decidido ? " Hay una decisión al respecto, pero no está en la versión." : " Tampoco hay una decisión que lo defina."}`, { coleccion: "roadmap", id: v.id });
  }

  // 7. Datos con los que arranca: entidades que "se cargan desde" algo que entra después
  for (const id of v.entidades || []) {
    const e = buscar("entidades", id); if (!e) continue;
    const m = String(e.descripcion || "").match(/se (cargan|crean|definen|agregan) desde (la |el )?([a-záéíóú]+)/i);
    if (m && !pantallas.some((p) => (p.titulo + " " + p.id).toLowerCase().includes(m[3].toLowerCase()))) h("semilla", `«${e.titulo}» se carga desde ${m[3]}, que no está en la ${v.id}. Hace falta decidir con qué datos arranca.`, { coleccion: "entidades", id });
  }

  // 8. Pantallas aprobadas cuyos elementos cambiaron después de aprobarse
  for (const p of pantallas) {
    const est = (plano.prototipo || []).find((x) => x.id === p.id);
    const congelados = Array.isArray(p.elementos_congelados) ? p.elementos_congelados.map((x) => (typeof x === "string" ? x : x?.id)) : null;
    if (est?.estado === "aprobada" && congelados && JSON.stringify(congelados) !== JSON.stringify(idsElementos(p).map((e) => e.id))) {
      h("congelada", `«${p.titulo}» está aprobada con ${p.elementos_congelados.length} elementos y ahora tiene ${(p.elementos || []).length}. Hay que volver a generarla o devolverla.`, { coleccion: "pantallas", id: p.id });
    }
  }

  // 9. Estados: lo que el Plano dice de los estados de cada pantalla tiene que ser lo que el HTML hace; y ningún selector adentro
  if (leerHtml) for (const p of pantallas) {
    const html = leerHtml(p.id); if (!html) continue;
    const enPlano = idsEstados(p), enHtml = estadosDeclarados(html);
    if (tieneSelectorAdentro(html)) h("estados", `«${p.titulo}» tiene un selector de estados adentro de la pantalla (lo inventó el prototipo). ${enPlano.length ? "" : "Registrá sus estados en el Plano y "}pedí que la pase al mecanismo de estados: el selector lo pone Plano afuera y la página solo lee ?estado=.`, { coleccion: "pantallas", id: p.id });
    else if (enPlano.length && (!enHtml || JSON.stringify([...enHtml].sort()) !== JSON.stringify([...enPlano].sort()))) h("estados", `«${p.titulo}» tiene ${enPlano.length} estados en el Plano (${enPlano.join(", ")}) y el HTML ${enHtml ? `declara otros (${enHtml.join(", ")})` : "no los implementa"}. Hay que corregirla.`, { coleccion: "pantallas", id: p.id });
    else if (!enPlano.length && enHtml) h("estados", `El HTML de «${p.titulo}» declara estados (${enHtml.join(", ")}) que la pantalla no tiene en el Plano.`, { coleccion: "pantallas", id: p.id });
  }

  const orden = { referencia: 0, orden: 1, entrada: 2, creacion: 3, "sin-accion": 4, posterior: 5, huerfana: 6, semilla: 7, flaca: 8, congelada: 9, estados: 9, error: 0 };
  H.sort((a, b) => (orden[a.tipo] ?? 9) - (orden[b.tipo] ?? 9));
  return { version: v.id, hallazgos: H };
}

// Un elemento y una acción hablan de lo mismo si comparten un verbo, o al menos dos palabras con contenido.
function coincide(accion, elemento) {
  const comunes = palabrasEnComun(accion, elemento);
  if (comunes.size >= 2) return true;
  for (const w of comunes) if (VERBO_RAICES.some((r) => w.startsWith(r))) return true;
  return false;
}
function palabrasEnComun(a, b) {
  const stop = new Set(["de", "la", "el", "los", "las", "un", "una", "y", "o", "a", "en", "con", "por", "para", "del", "al", "boton", "botón", "que", "se", "su", "sus", "lo", "ia"]);
  const p = (t) => new Set(String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !stop.has(w)).map((w) => w.replace(/(es|s|ar|er|ir|ado|ido|ada|ida)$/, "")));
  const A = p(a), B = p(b);
  return new Set([...A].filter((w) => B.has(w)));
}

// El bloque que recibe el agente cuando la persona pide revisar la versión con él.
export function bloqueRevision(plano, versionId, leerHtml = null) {
  const { hallazgos } = revisarVersion(plano, versionId, leerHtml);
  const lista = hallazgos.length ? hallazgos.map((x) => `  - ${x.texto}`).join("\n") : "  (la revisión mecánica no encontró nada)";
  return `[Revisión de la versión ${versionId} antes de construirla. Lo que encontró la revisión mecánica del Plano:\n${lista}\n\nTu trabajo: leer la versión entera con leer_plano como si fueras a construirla mañana, y cerrar los huecos. Primero lo que puedas resolver solo porque ya está decidido en el Plano (registralo: acciones que faltan, campos que faltan en entidades, decisiones sobre qué se oculta en esta versión). Después, lo que de verdad no está decidido: preguntalo, de a pocas preguntas por vez, y registralo cuando la persona conteste. Buscá también lo que la revisión mecánica no ve: entidades que faltan por completo (por ejemplo, un chat sin entidad "mensaje"), flujos que el objetivo da por hechos, estados vacíos o de error. No inventes decisiones de producto: si no está en el Plano y no es obvio, se pregunta. Al terminar, decí en una línea qué quedó resuelto y qué quedó abierto.]`;
}
