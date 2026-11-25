// Lo poco que la interfaz puede pedirle a la cáscara de escritorio. Si `window.plano` no existe, la interfaz corre en un
// navegador común y se comporta como siempre.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("plano", {
  escritorio: true,
  plataforma: process.platform,
  info: () => ipcRenderer.invoke("plano:info"),
  tema: (oscuro) => ipcRenderer.send("plano:tema", { oscuro: Boolean(oscuro) }),
  abrirExterno: (url) => ipcRenderer.send("plano:abrir-externo", String(url)),
  elegirCarpeta: () => ipcRenderer.invoke("plano:elegir-carpeta"),
  reiniciarParaActualizar: () => ipcRenderer.send("plano:reiniciar-para-actualizar"),
  alActualizar: (fn) => { ipcRenderer.on("plano:actualizacion", (_e, datos) => fn(datos)); },
});
