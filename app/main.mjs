// Plano de escritorio: la cáscara. Arranca el servidor de Plano en este mismo proceso, abre una ventana con la interfaz,
// vive en la bandeja, arranca con el sistema si la persona quiere, y se actualiza desde los releases de GitHub.
// No hay nada de Plano acá: todo lo que importa sigue en server/ y client/. Esta carpeta solo sabe de ventanas.

import { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, nativeTheme, dialog } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const EMPAQUETADA = app.isPackaged;
const VERSION = app.getVersion();

// Los datos de Plano (registro de proyectos, configuración, clave) van en la carpeta de datos de la persona, no junto al
// programa: en Windows %APPDATA%\\Plano\\data, en macOS ~/Library/Application Support/Plano/data, en Linux ~/.config/Plano/data.
// Si la persona venía usando `npm run dev` con data/ en la carpeta del código, se le migra una vez para que no pierda nada.
const DATA = join(app.getPath("userData"), "data");
process.env.PLANO_DATA = DATA;
function migrarDatosViejos() {
  const viejo = join(RAIZ, "data");
  if (existsSync(join(DATA, "proyectos.json")) || !existsSync(join(viejo, "proyectos.json"))) return;
  try {
    mkdirSync(DATA, { recursive: true });
    for (const f of ["proyectos.json", "config.json"]) if (existsSync(join(viejo, f))) writeFileSync(join(DATA, f), readFileSync(join(viejo, f)));
  } catch {}
}

// Una sola instancia: si se abre otra vez, se muestra la ventana que ya hay.
if (!app.requestSingleInstanceLock()) app.quit();

let ventana = null, bandeja = null, puerto = null, saliendo = false;
const preferencias = {
  ruta: join(app.getPath("userData"), "escritorio.json"),
  leer() { try { return JSON.parse(readFileSync(this.ruta, "utf8")); } catch { return {}; } },
  guardar(c) { try { mkdirSync(dirname(this.ruta), { recursive: true }); writeFileSync(this.ruta, JSON.stringify({ ...this.leer(), ...c }, null, 2)); } catch {} },
};

// Colores de los botones de ventana (minimizar, maximizar, cerrar), que dibuja el sistema sobre la barra de la página:
// siguen al tema claro/oscuro de la interfaz; la página avisa cuando cambia.
const overlay = (oscuro) => ({ color: oscuro ? "#161618" : "#ffffff", symbolColor: oscuro ? "#e4e4e7" : "#3f3f46", height: 40 });

async function arrancarServidor() {
  migrarDatosViejos();
  const { iniciar } = await import(new URL("../server/index.mjs", import.meta.url).href);
  const r = await iniciar(Number(process.env.PLANO_PUERTO || 4747), { buscarLibre: true });
  puerto = r.puerto;
  return puerto;
}

function crearVentana() {
  const p = preferencias.leer();
  const oscuro = nativeTheme.shouldUseDarkColors;
  ventana = new BrowserWindow({
    width: p.ancho || 1360, height: p.alto || 860, x: p.x, y: p.y, minWidth: 820, minHeight: 560,
    show: false, backgroundColor: oscuro ? "#161618" : "#ffffff",
    titleBarStyle: "hidden", // la barra de título la dibuja la página; los botones de ventana quedan a cargo del sistema
    ...(process.platform === "darwin" ? { trafficLightPosition: { x: 14, y: 13 } } : { titleBarOverlay: overlay(oscuro) }),
    webPreferences: { preload: join(RAIZ, "app", "preload.cjs"), contextIsolation: true, sandbox: true, spellcheck: true },
  });
  ventana.loadURL(`http://localhost:${puerto}/`);
  ventana.once("ready-to-show", () => ventana.show());
  // los enlaces afuera de Plano (la app construida, la consola de Anthropic) van al navegador de la persona
  ventana.webContents.setWindowOpenHandler(({ url }) => { if (!url.startsWith(`http://localhost:${puerto}`)) { shell.openExternal(url); return { action: "deny" }; } return { action: "allow" }; });
  ventana.webContents.on("will-navigate", (e, url) => { if (!url.startsWith(`http://localhost:${puerto}`)) { e.preventDefault(); shell.openExternal(url); } });
  // cerrar la ventana no cierra Plano: queda en la bandeja, verificando construcciones y listo para abrir
  ventana.on("close", (e) => { if (!saliendo) { e.preventDefault(); ventana.hide(); } });
  const guardarTamano = () => { if (!ventana.isMaximized()) { const b = ventana.getBounds(); preferencias.guardar({ ancho: b.width, alto: b.height, x: b.x, y: b.y }); } };
  ventana.on("resize", guardarTamano); ventana.on("move", guardarTamano);
  if (p.maximizada) ventana.maximize();
  ventana.on("maximize", () => preferencias.guardar({ maximizada: true }));
  ventana.on("unmaximize", () => preferencias.guardar({ maximizada: false }));
}

function mostrar() {
  if (!ventana || ventana.isDestroyed()) crearVentana();
  else { if (ventana.isMinimized()) ventana.restore(); ventana.show(); ventana.focus(); }
}

function iconoBandeja() {
  const archivo = join(RAIZ, "app", "iconos", process.platform === "win32" ? "bandeja.ico" : process.platform === "darwin" ? "bandejaTemplate.png" : "bandeja.png");
  const img = nativeImage.createFromPath(archivo);
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}

function crearBandeja() {
  bandeja = new Tray(iconoBandeja());
  bandeja.setToolTip(`Plano ${VERSION} · http://localhost:${puerto}`);
  const armarMenu = () => Menu.buildFromTemplate([
    { label: "Abrir Plano", click: mostrar },
    { label: `Abrir en el navegador (localhost:${puerto})`, click: () => shell.openExternal(`http://localhost:${puerto}/`) },
    { type: "separator" },
    { label: "Iniciar con el sistema", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, args: ["--oculto"] }) },
    { label: "Buscar actualizaciones", click: () => buscarActualizaciones(true) },
    { type: "separator" },
    { label: `Plano ${VERSION}`, enabled: false },
    { label: "Salir", click: () => { saliendo = true; app.quit(); } },
  ]);
  bandeja.setContextMenu(armarMenu());
  bandeja.on("click", mostrar);
  bandeja.on("right-click", () => bandeja.setContextMenu(armarMenu()));
}

// ---------- actualizaciones: desde los releases de GitHub, con electron-updater ----------
let actualizador = null;
async function prepararActualizador() {
  if (!EMPAQUETADA) return;
  try {
    const { autoUpdater } = require("electron-updater");
    actualizador = autoUpdater;
    actualizador.autoDownload = true;
    actualizador.autoInstallOnAppQuit = true;
    actualizador.on("update-downloaded", (info) => {
      ventana?.webContents.send("plano:actualizacion", { version: info.version });
      bandeja?.displayBalloon?.({ title: "Plano se actualizó", content: `La versión ${info.version} queda instalada al reiniciar Plano.` });
    });
    actualizador.on("error", (e) => console.warn("[plano] actualizador:", e.message));
    setTimeout(() => buscarActualizaciones(false), 15000);
    setInterval(() => buscarActualizaciones(false), 6 * 60 * 60 * 1000);
  } catch (e) { console.warn("[plano] sin actualizador:", e.message); }
}
async function buscarActualizaciones(aPedido) {
  if (!actualizador) { if (aPedido) dialog.showMessageBox({ message: "Las actualizaciones automáticas solo funcionan en la versión instalada.", detail: `Estás corriendo Plano ${VERSION} desde el código.` }); return; }
  try {
    const r = await actualizador.checkForUpdates();
    if (aPedido && (!r?.updateInfo || r.updateInfo.version === VERSION)) dialog.showMessageBox({ message: `Plano ${VERSION} es la última versión.` });
  } catch (e) { if (aPedido) dialog.showMessageBox({ type: "warning", message: "No se pudo buscar actualizaciones.", detail: e.message }); }
}

// ---------- lo que la página puede pedirle a la cáscara ----------
ipcMain.handle("plano:info", () => ({ escritorio: true, version: VERSION, plataforma: process.platform, puerto, empaquetada: EMPAQUETADA, datos: DATA }));
ipcMain.on("plano:tema", (_e, { oscuro }) => { if (ventana && process.platform !== "darwin") { try { ventana.setTitleBarOverlay(overlay(Boolean(oscuro))); } catch {} } });
ipcMain.on("plano:abrir-externo", (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });
ipcMain.on("plano:reiniciar-para-actualizar", () => { saliendo = true; actualizador?.quitAndInstall(); });
ipcMain.handle("plano:elegir-carpeta", async () => {
  const r = await dialog.showOpenDialog(ventana, { properties: ["openDirectory", "createDirectory"], title: "Elegí la carpeta del proyecto" });
  return r.canceled ? null : r.filePaths[0];
});

app.on("second-instance", mostrar);
app.on("activate", mostrar); // macOS: clic en el dock
app.on("before-quit", () => { saliendo = true; });
app.on("window-all-closed", () => { /* la bandeja sigue; se sale desde ahí */ });

app.whenReady().then(async () => {
  if (process.platform === "win32") app.setAppUserModelId("solutions.mafer.plano");
  try { await arrancarServidor(); }
  catch (e) { dialog.showErrorBox("Plano no pudo arrancar", e.message); app.quit(); return; }
  crearBandeja();
  if (!process.argv.includes("--oculto")) crearVentana();
  prepararActualizador();
});
