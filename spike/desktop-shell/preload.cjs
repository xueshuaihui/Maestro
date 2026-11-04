const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('maestro', {
  report: (payload) => ipcRenderer.send('renderer:report', payload),
  smokeDone: () => ipcRenderer.send('renderer:smoke-done'),
});
