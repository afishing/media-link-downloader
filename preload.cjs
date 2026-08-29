const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('downloader', {
  chooseDirectory: () => ipcRenderer.invoke('choose-directory'),
  defaultDirectory: () => ipcRenderer.invoke('default-directory'),
  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),
  inspectUrl: payload => ipcRenderer.invoke('inspect-url', payload),
  downloadUrl: payload => ipcRenderer.invoke('download-url', payload),
  openPath: target => ipcRenderer.invoke('open-path', target),
  onTaskEvent: callback => ipcRenderer.on('task:event', (_, data) => callback(data)),
  onTaskLog: callback => ipcRenderer.on('task:log', (_, data) => callback(data))
});
