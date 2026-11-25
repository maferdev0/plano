// Elegir una carpeta del disco sin escribir rutas a mano.
// 1) Diálogo nativo del sistema (lo abre el servidor, que corre en la máquina de la persona).
// 2) Respaldo: un explorador de carpetas servido por la API, para cuando no hay diálogo.

import { execFile } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

const correr = (cmd, args) => new Promise((res, rej) => {
  execFile(cmd, args, { windowsHide: false, timeout: 5 * 60 * 1000, maxBuffer: 1 << 20 }, (err, stdout, stderr) => {
    if (err) rej(new Error(stderr?.trim() || err.message));
    else res(stdout);
  });
});

// Devuelve { carpeta } o { cancelado: true }. Lanza si no hay diálogo disponible.
export async function dialogoCarpeta(titulo = "Elegí la carpeta del proyecto") {
  if (process.platform === "win32") {
    const ps = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      [System.Windows.Forms.Application]::EnableVisualStyles()
      $f = New-Object System.Windows.Forms.Form
      $f.TopMost = $true; $f.ShowInTaskbar = $false; $f.Opacity = 0; $f.Size = New-Object System.Drawing.Size(1, 1)
      $f.StartPosition = 'CenterScreen'
      $f.Show(); $f.Activate()
      $d = New-Object System.Windows.Forms.FolderBrowserDialog
      $d.Description = '${titulo.replace(/'/g, "''")}'
      $d.ShowNewFolderButton = $true
      try { $d.UseDescriptionForTitle = $true } catch {}
      $r = $d.ShowDialog($f)
      $f.Close()
      if ($r -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.SelectedPath } else { Write-Output '__CANCELADO__' }`;
    const salida = (await correr("powershell.exe", ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", ps])).trim();
    return salida === "__CANCELADO__" || !salida ? { cancelado: true } : { carpeta: salida };
  }
  if (process.platform === "darwin") {
    try {
      const salida = (await correr("osascript", ["-e", `POSIX path of (choose folder with prompt "${titulo}")`])).trim();
      return { carpeta: salida.replace(/\/$/, "") };
    } catch (e) {
      if (/-128/.test(e.message)) return { cancelado: true };
      throw e;
    }
  }
  // Linux: zenity si está
  try {
    const salida = (await correr("zenity", ["--file-selection", "--directory", `--title=${titulo}`])).trim();
    return salida ? { carpeta: salida } : { cancelado: true };
  } catch (e) {
    if (/exit code 1|code 1/.test(e.message) || e.message === "") return { cancelado: true };
    throw new Error("No hay diálogo de carpetas disponible en este sistema");
  }
}

// Explorador de respaldo: lista subcarpetas de una ruta (o las raíces si no hay ruta).
export async function listarCarpetas(ruta) {
  if (!ruta) {
    if (process.platform === "win32") {
      const salida = await correr("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Get-PSDrive -PSProvider FileSystem | ForEach-Object { $_.Root }"]);
      const raices = salida.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      return { ruta: null, padre: null, subcarpetas: raices.map((r) => ({ nombre: r, ruta: r })), inicio: homedir() };
    }
    return listarCarpetas("/");
  }
  const abs = resolve(ruta);
  let entradas = [];
  try { entradas = readdirSync(abs, { withFileTypes: true }); } catch (e) { throw new Error(`No se puede leer ${abs}: ${e.message}`); }
  const subcarpetas = entradas
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && !["node_modules", "$RECYCLE.BIN", "System Volume Information"].includes(d.name))
    .map((d) => ({ nombre: d.name, ruta: join(abs, d.name) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const padre = dirname(abs);
  return { ruta: abs, padre: padre === abs ? null : padre, subcarpetas, inicio: homedir() };
}

export function esCarpeta(ruta) {
  try { return statSync(resolve(ruta)).isDirectory(); } catch { return false; }
}
