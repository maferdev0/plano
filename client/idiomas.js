// Idiomas de la interfaz. Las claves son el texto en español tal como está en el código; EN lo traduce.
// t("Proyecto nuevo") → "New project" en inglés, o el mismo texto si no hay traducción. Con variables: t("Quedan {n} preguntas", { n }).
// Para sumar un idioma: otro diccionario acá y una opción en Configuración.

export const IDIOMAS = { es: "Español", en: "English" };

export function idiomaElegido() {
  try { return localStorage.getItem("plano.idioma") || "sistema"; } catch { return "sistema"; }
}
export function idiomaActual() {
  const e = idiomaElegido();
  if (e !== "sistema") return e;
  return (navigator.language || "es").toLowerCase().startsWith("en") ? "en" : "es";
}
export const locale = () => (idiomaActual() === "en" ? "en-US" : "es-UY");

const EN = {
  // navegación y pestañas
  "Identidad": "Identity", "Decisiones": "Decisions", "Entidades": "Entities", "Pantallas": "Screens", "Acciones": "Actions",
  "Integraciones": "Integrations", "Innegociables": "Non-negotiables", "Preguntas": "Questions", "Roadmap": "Roadmap", "Prototipo": "Prototype",
  "Conversación": "Conversation", "Uso": "Usage", "Configuración": "Settings", "Proyecto nuevo": "New project",
  "Hola {usuario}, ¿qué querés construir?": "Hi {usuario}, what do you want to build?", "Hola {usuario}": "Hi {usuario}",
   "modo simulado": "simulated mode",
  "Todavía no hay proyectos. Creá el primero.": "No projects yet. Create the first one.",
  "Sin mensajes todavía": "No messages yet", "Vos": "You", "Plano": "Plano",
  "recién": "just now", "hace {h} h": "{h} h ago", "hace {min} min": "{min} min ago", "hoy {hora}": "today {hora}", "ayer {hora}": "yesterday {hora}",
  // tarjetas vacías
  "Todavía no hay identidad": "No identity yet", "Qué es, para quién y por qué. Aparece apenas lo contás.": "What it is, who it's for and why. It appears as soon as you tell it.",
  "Sin decisiones": "No decisions", "Web o app, responsiva o no, cómo se cobra: cada elección queda acá.": "Web or app, responsive or not, how it charges: every choice lands here.",
  "Sin entidades": "No entities", "Los sustantivos del sistema: negocio, cliente, pedido…": "The system's nouns: business, customer, order…",
  "Sin pantallas": "No screens", "Lo que la gente ve, con lo que hay en cada una.": "What people see, with what each one holds.",
  "Sin acciones": "No actions", "Los verbos: qué hace alguien, en qué pantalla, sobre qué entidad.": "The verbs: what someone does, on which screen, over which entity.",
  "Sin integraciones": "No integrations", "Servicios externos: pagos, mails, mapas, IA.": "External services: payments, email, maps, AI.",
  "Sin innegociables": "No non-negotiables", "Idioma, colores, tipografía, tono. Lo que no se discute.": "Language, colors, typography, tone. What isn't up for debate.",
  "Sin preguntas abiertas": "No open questions", "Lo que todavía no sabés. El agente no lo decide solo.": "What you don't know yet. The agent doesn't decide it alone.",
  "Todavía no hay prototipo": "No prototype yet", "Se hace por versión, pantalla por pantalla, y vos aprobás cada una. Arranca desde la v1 en el Roadmap.": "It's built per version, screen by screen, and you approve each one. Start from v1 in the Roadmap.",
  "Todavía no hay roadmap": "No roadmap yet", "Las versiones en que se construye el proyecto, en orden. Se arman con el Plano: nada entra antes que lo que necesita.": "The versions the project is built in, in order. Derived from the Plano: nothing enters before what it needs.",
  // identidad
  "Se usa en": "Used on", "Qué es": "What it is", "Para quién": "Who it's for", "Por qué existe": "Why it exists", "Objetivo": "Goal", "Tecnología": "Technology", "Tipo": "Type", "En una frase": "In one sentence",
  "Celular y escritorio": "Phone and desktop", "Solo celular": "Phone only", "Solo escritorio": "Desktop only", "Como el proyecto ({d})": "Same as the project ({d})",
  "solo celular": "phone only", "solo escritorio": "desktop only", "celular y escritorio": "phone and desktop",
  // niveles
  "Cimiento": "Foundation", "Cambiarlo es caro: hay cosas construidas encima o lo definiste con firmeza. El agente no lo toca.": "Changing it is expensive: things are built on top of it or you stated it firmly. The agent doesn't touch it.",
  "Puede cambiar": "Can change", "Un detalle que puede moverse sin romper nada.": "A detail that can move without breaking anything.",
  "Lo asumió el agente": "Assumed by the agent", "No lo dijiste vos. Confirmalo o corregilo en la conversación.": "You didn't say it. Confirm or correct it in the conversation.",
  "Propuesta del agente": "Agent's proposal", "El agente lo pide. No existe hasta que lo apruebes.": "The agent asks for it. It doesn't exist until you approve it.",
  // chat
  "Copiar": "Copy", "Editar y volver a enviar": "Edit and resend", "Reenviar": "Resend", "Reintentar": "Retry", "Leer en voz alta": "Read aloud",
  "Reintentar: la IA vuelve a responder a tu último mensaje": "Retry: the AI answers your last message again",
  "Deshacer este mensaje y lo que cambió": "Undo this message and what it changed", "Deshacer este mensaje y lo que cambió en el Plano": "Undo this message and what it changed in the Plano",
  "Pensando…": "Thinking…", "Escribí acá. Enter envía, Shift+Enter baja de línea.": "Type here. Enter sends, Shift+Enter adds a line.", "Enviar": "Send",
  "No se pudo enviar.": "Couldn't send.", "No se pudo conectar con Plano. ¿Está corriendo el servidor? El mensaje queda guardado acá.": "Couldn't reach Plano. Is the server running? The message is kept here.",
  "No se pudo conectar con Plano. ¿Está corriendo el servidor?": "Couldn't reach Plano. Is the server running?",
  "Se perdió la conexión con el servidor (90 s sin señal).": "Lost the connection to the server (90 s without a signal).",
  "Se perdió la conexión con el servidor (90 s sin señal). Podés reintentar.": "Lost the connection to the server (90 s without a signal). You can retry.",
  "La IA terminó sin escribir nada. Podés reintentar.": "The AI finished without writing anything. You can retry.", "No se pudo deshacer.": "Couldn't undo.",
  "Mencionar": "Mention", "Responder": "Answer", "Tu respuesta. Enter envía, Shift+Enter baja de línea.": "Your answer. Enter sends, Shift+Enter adds a line.",
  // siguiente paso
  "Entrevista": "Interview", "Contale a Plano qué querés construir.": "Tell Plano what you want to build.",
  "Quedan {n} preguntas abiertas. Siguiente: cerrarlas y armar el roadmap.": "{n} open questions left. Next: close them and build the roadmap.",
  "Queda 1 pregunta abierta. Siguiente: cerrarla y armar el roadmap.": "1 open question left. Next: close it and build the roadmap.",
  "El Plano está cerrado. Siguiente: armar el roadmap, las versiones en que se construye.": "The Plano is closed. Next: build the roadmap, the versions it's built in.",
  "Armar el roadmap": "Build the roadmap", "{n} versiones. Siguiente: el prototipo de la {v}, solo con sus pantallas.": "{n} versions. Next: the {v} prototype, only its screens.",
  "Prototipar la {v}": "Prototype {v}", "Prototipo {v}": "Prototype {v}",
  "«{p}» está aprobada pero sus elementos cambiaron en el Plano. Siguiente: regenerarla con los elementos nuevos.": "“{p}” is approved but its elements changed in the Plano. Next: regenerate it with the new elements.",
  "Regenerar": "Regenerate", "Las {n} pantallas de la {v} están aprobadas. Antes de construir: {k} por resolver en el Plano.": "All {n} screens of {v} are approved. Before building: {k} to resolve in the Plano.",
  "Las {n} pantallas de la {v} están aprobadas y la revisión no encontró huecos. Siguiente: construir la {v} (todavía no disponible en Plano).": "All {n} screens of {v} are approved and the review found no gaps. Next: build {v} (not available in Plano yet).",
  "{a} de {n} aprobadas. Siguiente: revisar «{p}».": "{a} of {n} approved. Next: review “{p}”.", "Revisar": "Review",
  "«{p}» está devuelta. Siguiente: pedir la corrección.": "“{p}” was sent back. Next: request the fix.", "Pedir la corrección": "Request the fix",
  "{a} de {n} aprobadas. Siguiente: generar «{p}».": "{a} of {n} approved. Next: generate “{p}”.", "Generar": "Generate", "{a} de {n} aprobadas.": "{a} of {n} approved.",
  "Resolverlo con el agente": "Resolve it with the agent", "Antes de construir": "Before building", "{n} por resolver": "{n} to resolve",
  // roadmap
  "Prototipar esta versión": "Prototype this version", "Ver el prototipo": "View the prototype", "Prototipo aprobado": "Prototype approved",
  "Armado {cuando} · {costo}": "Built {cuando} · {costo}", "todavía no": "not yet", "hecha": "done",
  // prototipo
  "pendiente": "pending", "para revisar": "to review", "devuelta": "sent back", "aprobada": "approved",
  "Aprobar": "Approve", "Devolver con un comentario": "Send back with a comment", "Devolver": "Send back", "Cancelar": "Cancel",
  "Qué hay que cambiar. Ej.: el botón enviar tiene que ser púrpura y más grande. Enter devuelve, Shift+Enter baja de línea.": "What needs to change. E.g.: the send button should be purple and bigger. Enter sends back, Shift+Enter adds a line.",
  "Aprobada": "Approved", "Estado de la pantalla": "Screen state",
  // construcción
  "Construcción": "Build", "Todavía no hay construcción": "Nothing being built yet", "Cuando todas las pantallas de una versión están aprobadas, Plano prepara el tablero y el contrato para el agente de código.": "Once every screen of a version is approved, Plano prepares the task board and the contract for the coding agent.",
  "Construcción {v}": "Build {v}", "La {v} está construida: las {n} tareas aprobadas.": "{v} is built: all {n} tasks approved.", "«{p}» pasó la verificación. Siguiente: mirarla y aprobarla.": "“{p}” passed verification. Next: look at it and approve.",
  "{n} tarea(s) devueltas esperan al agente. {a} de {t} aprobadas.": "{n} task(s) sent back, waiting for the agent. {a} of {t} approved.", "El agente está trabajando. {a} de {t} aprobadas.": "The agent is working. {a} of {t} approved.",
  "La construcción está preparada. Abrí la carpeta {c} en Claude Code y decile: seguí con el Plano.": "The build is ready. Open the {c} folder in Claude Code and tell it: continue with the Plano.", "Ver el tablero": "See the board",
  "Las {n} pantallas de la {v} están aprobadas y la revisión no encontró huecos. Siguiente: preparar la construcción.": "All {n} screens of {v} are approved and the review found no gaps. Next: prepare the build.", "Preparar la construcción de la {v}": "Prepare the {v} build",
  "No se pudo preparar la construcción.": "Could not prepare the build.", "No se pudo.": "That didn't work.", "el agente la está haciendo": "the agent is on it", "hecha, para revisar": "done, to review", "verificando…": "verifying…",
  "Cimientos": "Foundations", "Datos": "Data", "Integración": "Integration", "Recorrido": "Walkthrough", "verificada, para revisar": "verified, to review", "hecha, esperando verificación": "done, awaiting verification",
  "seguí con el Plano": "continue with the Plano", "Construida: las {n} tareas aprobadas.": "Built: all {n} tasks approved.", "{a} de {n} tareas aprobadas": "{a} of {n} tasks approved", "{n} devueltas": "{n} sent back", "{n} para revisar": "{n} to review",
  "Abrí la carpeta": "Open the folder", "del proyecto en Claude Code (o el agente que uses) y decile:": "of the project in Claude Code (or whichever agent you use) and tell it:", "El contrato está en": "The contract is in", "el agente marca cada tarea en": "the agent marks each task in", "y Plano la verifica sola. A vos te llegan las pantallas para aprobar.": "and Plano verifies it on its own. You get the screens to approve.",
  "La app de desarrollo corre en": "The dev app runs at", "Espera a:": "Waiting on:", "Notas del agente": "Agent notes", "Verificación de Plano": "Plano verification", "archivos declarados": "declared files", "salteado": "skipped", "Faltan": "Missing", "Commit": "Commit", "Archivos": "Files",
  "Lo que tiene que hacer el agente": "What the agent has to do", "Verificar de nuevo": "Verify again", "Devolver igual": "Send back anyway", "Qué está mal o qué falta, en tus palabras. El agente lo lee en la tarea.": "What's wrong or missing, in your words. The agent reads it in the task.",
  "La app construida (izquierda) y el prototipo aprobado (derecha)": "The built app (left) and the approved prototype (right)", "Abrir la app en una pestaña nueva": "Open the app in a new tab", "App construida": "Built app", "Prototipo aprobado": "Approved prototype",
  "Te toca a vos": "Your turn", "{n} tarea(s) pasaron la verificación de Plano y esperan que las mires y las apruebes o devuelvas. El agente no sigue con lo que depende de ellas hasta que lo hagas.": "{n} task(s) passed Plano's verification and are waiting for you to look at them and approve or send back. The agent won't continue with what depends on them until you do.",
  "El agente está trabajando; no hay nada que hacer de tu lado por ahora.": "The agent is working; nothing for you to do right now.", "Hay tareas devueltas esperando al agente. Si no está corriendo, abrí la carpeta en Claude Code y decile: seguí con el Plano.": "There are tasks sent back waiting for the agent. If it isn't running, open the folder in Claude Code and tell it: continue with the Plano.",
  "Lo que tenés que mirar": "What you need to check", "Lo demás (compila, archivos, data-plano) ya lo verificó Plano.": "Everything else (compiles, files, data-plano) was already verified by Plano.", "Qué quedó hecho": "What got done", "Volver a preparar": "Prepare again",
  "Plano está verificando": "Plano is verifying", "Plano tiene que verificar": "Plano has to verify", "{n} tarea(s) que el agente marcó como hechas: {l}.": "{n} task(s) the agent marked as done: {l}.", "Construida.": "Built.", "Las {n} tareas están aprobadas.": "All {n} tasks are approved.",
  "El agente está trabajando": "The agent is working", "en {l}.": "on {l}.", "Última señal del agente: {h}.": "Last sign of the agent: {h}.", "El agente está parado.": "The agent is stopped.", "El agente está entre tareas.": "The agent is between tasks.", "Hay {n} tarea(s) listas para tomar ({l}) y ninguna en curso. Si Claude Code se detuvo, decile: {c}.": "There are {n} task(s) ready to take ({l}) and none in progress. If Claude Code stopped, tell it: {c}.",
  "Hay tareas devueltas": "There are tasks sent back", "esperando al agente.": "waiting for the agent.", "Nada pendiente de tu lado por ahora.": "Nothing pending on your side for now.", "Verificar ahora": "Verify now", "guardado": "saved",
  "Reescribe AGENTS.md y las descripciones de las tareas desde el Plano actual. Sin IA, no gasta nada. No borra nada: estados, archivos, notas y commits se conservan.": "Rewrites AGENTS.md and the task descriptions from the current Plano. No AI, costs nothing. Deletes nothing: states, files, notes and commits are kept.", "sin IA": "no AI",
  "Registro": "Log",
  // configuración
  "Tu nombre": "Your name", "Cómo te llama la entrevistadora.": "What the interviewer calls you.", "Clave de API de Anthropic": "Anthropic API key", "Ver": "Show", "Ocultar": "Hide",
  "Modelo para la entrevista y el roadmap": "Model for the interview and the roadmap", "Donde pesa el criterio.": "Where judgment matters.", "Modelo para las pantallas del prototipo": "Model for prototype screens", "Generar y corregir HTML. La calidad la fijan el brief, el verificador y tu revisión.": "Generating and fixing HTML. Quality is set by the brief, the verifier and your review.",
  "Compactar la conversación a partir de": "Compact the conversation from", "Tokens del historial. Más alto, más memoria de la charla y más caro cada mensaje; lo registrado está en el Plano igual.": "History tokens. Higher means more memory of the chat and a pricier message; what was registered is in the Plano anyway.", "Guardado": "Saved", "Guardar": "Save",
  "Modo simulado: no se usa.": "Mock mode: not used.", "Cargada desde .env; si escribís una acá, manda esta.": "Loaded from .env; one typed here takes precedence.", "Cargada. Dejá el campo vacío para conservarla.": "Loaded. Leave the field empty to keep it.", "Falta. Sin clave la entrevista no responde. Se consigue en console.anthropic.com.": "Missing. Without a key the interview won't answer. Get one at console.anthropic.com.",
  "Nada se guarda en ninguna base de datos: cada proyecto vive en su carpeta y esta configuración en": "Nothing is stored in any database: each project lives in its folder and this configuration in", "No se pudo guardar.": "Could not save.", "Falta la clave de API: cargala en Configuración": "API key missing: add it in Settings",
  "el de más criterio; para la entrevista y el roadmap": "the most judgment; for the interview and the roadmap", "la mitad de precio; sobra para generar y corregir pantallas": "half the price; plenty for generating and fixing screens", "la generación anterior": "the previous generation", "Aplicación web": "Web app", "Aplicación de escritorio": "Desktop app", "Aplicación móvil": "Mobile app", "Web": "Web", "De escritorio": "Desktop", "Móvil": "Mobile", "móvil": "mobile", "escritorio": "desktop",
  "Qué tipo de aplicación es": "What kind of application it is", "Se elige una vez: de esto salen el stack, los marcos del prototipo y cómo se verifica y publica la construcción.": "Chosen once: the stack, the prototype frames and how the build is verified and published all follow from it.",
  "Elegí qué tipo de aplicación es: web, de escritorio o móvil. Después no se cambia.": "Choose what kind of application it is: web, desktop or mobile. It can't be changed later.", "Se eligió al crear el proyecto y no se cambia: de esto salen el stack, los marcos del prototipo y cómo se verifica y publica la construcción.": "Chosen when the project was created; it doesn't change: the stack, the prototype frames and how the build is verified and published all follow from it.",
  "marcas del Plano en el código": "Plano markers in the code", "Corre en el navegador. Celular, computadora o ambos. Se publica en un dominio.": "Runs in the browser. Phone, computer or both. Published on a domain.", "Se instala en la computadora (Windows, macOS, Linux). Las pantallas son ventanas.": "Installed on the computer (Windows, macOS, Linux). Screens are windows.", "Se instala en el teléfono (Android, iOS). Solo pantallas de celular.": "Installed on the phone (Android, iOS). Phone screens only.", "La app publicada está en": "The published app is at", "Los pasos están en {f}. Cuando termines, apretá Verificar ahora.": "The steps are in {f}. When you are done, press Verify now.", "Los pasos están en {f}. Cuando termines, apretá Verificar de nuevo.": "The steps are in {f}. When you are done, press Verify again.", "Lo que tenés que hacer": "What you need to do", "esperando pasos tuyos": "waiting on your steps", "Publicación": "Publishing", "agente": "agent", "vos": "you", "Todavía no pasó nada.": "Nothing has happened yet.", "Cómo probarlo": "How to try it", "Decisiones que tomó el agente": "Decisions the agent made", "Volver a la actual": "Back to current", "Restaurar la versión {n}": "Restore version {n}",
  "Ver": "View", "Restaurar": "Restore", "Cerrar": "Close", "Generar la pantalla": "Generate the screen", "Generando la pantalla…": "Generating the screen…", "Corrigiendo la pantalla…": "Fixing the screen…",
  "Generá la pantalla «{p}».": "Generate the screen “{p}”.", "Corregí la pantalla «{p}»: {c}": "Fix the screen “{p}”: {c}",
  "Ver como en un celular": "View as on a phone", "Ver como en escritorio": "View as on desktop", "Navegar la app en una pestaña nueva: todas las pantallas enlazadas, sin Plano alrededor": "Browse the app in a new tab: all screens linked, without Plano around",
  "Revisar pantalla por pantalla": "Review screen by screen", "Lienzo: todas las pantallas de todas las versiones": "Canvas: every screen of every version",
  "{n} pantallas, {a} aprobadas · ": "{n} screens, {a} approved · ", "Navegar la app": "Browse the app",
  "versión {n}": "version {n}", "Historial": "History", "Alejar (Ctrl + rueda)": "Zoom out (Ctrl + wheel)", "Acercar (Ctrl + rueda)": "Zoom in (Ctrl + wheel)", "Ajustar a la ventana": "Fit to window",
  // menú de proyecto y diálogos
  "Renombrar": "Rename", "Duplicar…": "Duplicate…", "Exportar": "Export", "Borrar…": "Delete…", "Más acciones": "More actions",
  "Renombrar el proyecto": "Rename the project", "Guardar": "Save", "Duplicar {p}": "Duplicate {p}", "Duplicar": "Duplicate", "{p} (copia)": "{p} (copy)", "Elegí la carpeta.": "Choose the folder.",
  "Borrando…": "Deleting…", "Borrar el proyecto": "Delete the project", "No se pudo borrar.": "Couldn't delete.",
  "Se borran la conversación, el Plano entero y todas las pantallas del prototipo: las carpetas <code>plano</code> y <code>prototipo</code> dentro de <code>{c}</code>. El resto de esa carpeta no se toca. No se puede deshacer.": "This deletes the conversation, the whole Plano and every prototype screen: the <code>plano</code> and <code>prototipo</code> folders inside <code>{c}</code>. The rest of that folder is left alone. This can't be undone.",
  "Elegí la carpeta del proyecto.": "Choose the project folder.", "Abriendo el selector…": "Opening the picker…", "¿No se abrió? Buscar la carpeta desde Plano": "Didn't open? Browse for the folder from Plano", "Elegir carpeta…": "Choose folder…",
  // uso
  "Todos los proyectos": "All projects", "gastados desde el {d}": "spent since {d}", "tokens de entrada, {p} % leídos de caché": "input tokens, {p} % read from cache", "tokens de salida": "output tokens",
  "turno": "turn", "turnos": "turns", "{t}, {l} llamadas a la API": "{t}, {l} API calls", "En qué se va la plata": "Where the money goes", "Por tipo de trabajo": "By kind of work", "Gasto por día": "Spend per day",
  "Peso de la conversación": "Conversation weight", "Por proyecto": "By project", "Cómo bajar el gasto": "How to lower the spend", "Últimos turnos": "Latest turns", "Por pantalla del prototipo": "By prototype screen",
  "Pantalla nueva": "New screen", "Revisión de pantalla": "Screen revision",
  "Salida (lo que escribe la IA)": "Output (what the AI writes)", "Entrada nueva (sin caché)": "New input (not cached)", "Escritura de caché": "Cache write", "Lectura de caché": "Cache read",
  // sistema
  "Deshiciste el último mensaje: el Plano y el prototipo volvieron a como estaban antes.": "You undid the last message: the Plano and the prototype are back to how they were.",
  // configuración
  "Tema": "Theme", "Color de tus globos y botones, y color de los globos de la IA.": "Color of your bubbles and buttons, and of the AI's bubbles.",
  "Apariencia": "Appearance", "Clara, oscura, o la que tenga el sistema.": "Light, dark, or whatever the system uses.", "Sistema": "System", "Clara": "Light", "Oscura": "Dark",
  "Idioma": "Language", "El de la interfaz y el que usa el agente con vos. Por defecto, el del sistema.": "For the interface and for the agent talking to you. Defaults to the system's.",
  // uso (tablas y textos)
  "Cuándo": "When", "De caché": "From cache", "Entrada nueva": "New input", "Entrada": "Input", "Gasto": "Spend", "Llamadas": "Calls", "Pantalla": "Screen", "Pesa hoy": "Weighs today", "Pesó": "Weighed", "Por turno": "Per turn", "Proyecto": "Project", "Qué": "What", "Salida": "Output", "Turnos": "Turns", "Veces": "Times",
  "Todavía no hay uso registrado en este proyecto.": "No usage recorded for this project yet.", "Todavía no hay uso registrado.": "No usage recorded yet.",
  "Plano anota los tokens de cada turno desde que esta pantalla existe; lo anterior quedó solo en la consola de Anthropic.": "Plano records the tokens of every turn since this page exists; anything earlier is only in the Anthropic console.",
  "Con {m}, por millón de tokens: entrada {e}, salida {s}, escribir caché {ce}, leerla {cl}.": "With {m}, per million tokens: input {e}, output {s}, cache write {ce}, cache read {cl}.",
  "Cuántos tokens se mandaron a la API en cada turno. Plano manda la conversación cada vez; lo que ya se mandó antes se lee de caché (barato) si pasó menos de una hora desde el turno anterior. Al pasar {u} tokens se compacta sola: los mensajes viejos dejan de mandarse y el agente sigue desde el Plano.": "How many tokens were sent to the API on each turn. Plano sends the conversation every time; what was already sent is read from cache (cheap) if less than an hour passed since the previous turn. Past {u} tokens it compacts itself: old messages stop being sent and the agent carries on from the Plano.",
  "Se compactó {n} veces, la última el {f}.": "Compacted {n} times, last on {f}.", "Todavía no hay turnos suficientes para dibujarlo.": "Not enough turns to draw it yet.",
  "se compacta al pasar {u}": "compacts past {u}", "primer turno": "first turn", "último: {n} tokens": "latest: {n} tokens", "Turno {k} · {f}: {n} tokens": "Turn {k} · {f}: {n} tokens",
  "<strong>La caché está rindiendo poco: {c} % en los últimos {n} turnos.</strong> La caché dura una hora; si pasa más tiempo entre un mensaje y el siguiente, la conversación entera se vuelve a escribir ({w} por millón) en vez de leerse ({r}).": "<strong>The cache is underperforming: {c} % over the last {n} turns.</strong> The cache lasts an hour; if more time passes between one message and the next, the whole conversation is written again ({w} per million) instead of read ({r}).",
  "En {h} de esos turnos pasó más de una hora.": "In {h} of those turns more than an hour went by.", "Trabajar en sesiones seguidas sale varias veces más barato que un mensaje suelto cada tanto.": "Working in continuous sessions is several times cheaper than a stray message every so often.",
  "<strong>La caché está rindiendo bien: {c} % de la entrada de los últimos turnos vino de caché.</strong> Cada token leído de caché cuesta la vigésima parte de uno nuevo.": "<strong>The cache is doing well: {c} % of recent input came from cache.</strong> Each cached token costs a twentieth of a new one.",
  "<strong>La conversación de {p} ya pesa {n} tokens.</strong> Cada turno vuelve a mandarla entera: como mínimo {min} por turno aunque pegue toda la caché, y {max} si no pega. Lo que importa ya está en el Plano, no en el chat; al pasar {u} se compacta sola y vuelve a pesar poco; mientras tanto, mensajes cortos y en tandas.": "<strong>The {p} conversation already weighs {n} tokens.</strong> Every turn sends it whole again: at least {min} per turn even with a full cache hit, and {max} without one. What matters is already in the Plano, not the chat; past {u} it compacts itself and gets light again; meanwhile, short messages in batches.",
  "<strong>Las pantallas del prototipo son el {p} % del gasto.</strong>": "<strong>Prototype screens are {p} % of the spend.</strong>", "Generar una cuesta {c} en promedio, casi todo salida ({n} tokens a {s} el millón).": "Generating one costs {c} on average, almost all output ({n} tokens at {s} per million).",
  "Es el trabajo caro por naturaleza: la IA escribe un archivo entero. Devolver con un comentario puntual sale más barato que generar de nuevo, porque reescribe el archivo una vez y no itera a ciegas.": "It's expensive by nature: the AI writes a whole file. Sending back with a precise comment is cheaper than regenerating, because it rewrites the file once instead of iterating blindly.",
  "<strong>{n} turnos necesitaron 4 llamadas o más a la API.</strong> Cada llamada vuelve a mandar toda la conversación. Pasa cuando la IA registra muchas tarjetas de a una o cuando una pantalla falla la verificación y la corrige varias veces. Mensajes más acotados dan turnos más cortos.": "<strong>{n} turns needed 4 or more API calls.</strong> Each call sends the whole conversation again. It happens when the AI registers many cards one by one or when a screen fails verification and gets fixed several times. Tighter messages make shorter turns.",
  "<strong>La salida es el {a} % de la plata con el {b} % de los tokens.</strong> Un token escrito cuesta {x} veces uno leído y {y} veces uno de caché. Pedir respuestas cortas en la entrevista y pantallas sin adornos innecesarios es lo que más mueve la aguja.": "<strong>Output is {a} % of the money with {b} % of the tokens.</strong> A written token costs {x} times a read one and {y} times a cached one. Asking for short answers in the interview and screens without needless ornament moves the needle most.",
  "<strong>Modelo: {m}.</strong> Se cambia con PLANO_MODELO en .env. Sonnet 5.5 cuesta la mitad por token; para la entrevista suele alcanzar, para diseñar pantallas conviene probar antes de decidir.": "<strong>Model: {m}.</strong> Change it with PLANO_MODELO in .env. Sonnet 5.5 costs half per token; usually enough for the interview, for screen design try before deciding.",
  "Dónde y sobre qué": "Where and over what", "y {n} más": "and {n} more",
  "Detener la respuesta": "Stop the response", "Detuviste la respuesta. Tu mensaje quedó sin mandar: podés reenviarlo o escribir otro.": "You stopped the response. Your message wasn't sent: you can resend it or write another.",
  "Trabajando…": "Working…", "Cargando mensajes anteriores…": "Loading earlier messages…",
  "Versión": "Version",
  // navegar
  "Abrir en Plano": "Open in Plano", "Esta versión todavía no tiene pantallas.": "This version has no screens yet.",
};

const DICCIONARIOS = { en: EN };

export function t(texto, vars) {
  const dic = DICCIONARIOS[idiomaActual()];
  let out = (dic && dic[texto]) || texto;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

// Traduce lo estático del HTML: elementos con data-t (texto), data-t-placeholder, data-t-title.
export function traducirEstatico(raiz = document) {
  if (idiomaActual() === "es") return;
  for (const el of raiz.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t || el.textContent.trim());
  for (const el of raiz.querySelectorAll("[data-t-placeholder]")) el.placeholder = t(el.dataset.tPlaceholder || el.placeholder);
  for (const el of raiz.querySelectorAll("[data-t-title]")) el.title = t(el.dataset.tTitle || el.title);
}
