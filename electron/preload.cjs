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
    stopPreview: () => ipcRenderer.invoke('stop-preview'),
    openInBrowser: (url) => ipcRenderer.invoke('open-in-browser', url),
    onZolaError: (callback) => ipcRenderer.on('zola-error', (_event, value) => callback(value)),
    loadSiteSettings: () => ipcRenderer.invoke('load-site-settings'),
    saveSiteSettings: (settings) => ipcRenderer.invoke('save-site-settings', settings),
});
