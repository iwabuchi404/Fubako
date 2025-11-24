const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openProject: () => ipcRenderer.invoke('open-project'),
    loadConfig: (path) => ipcRenderer.invoke('load-config', path),
    listContents: (type) => ipcRenderer.invoke('list-contents', type),
    loadContent: (type, slug) => ipcRenderer.invoke('load-content', { type, slug }),
    saveContent: (type, slug, data) => ipcRenderer.invoke('save-content', { type, slug, data }),
    uploadImage: (filePath) => ipcRenderer.invoke('upload-image', { filePath }),
    listImages: () => ipcRenderer.invoke('list-images'),
    startPreview: () => ipcRenderer.invoke('start-preview'),
    onZolaError: (callback) => ipcRenderer.on('zola-error', (_event, value) => callback(value)),
});
