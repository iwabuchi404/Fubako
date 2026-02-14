const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openProject: () => ipcRenderer.invoke('open-project'),
    loadConfig: (path) => ipcRenderer.invoke('load-config', path),
    listContents: (type) => ipcRenderer.invoke('list-contents', type),
    loadContent: (type, slug) => ipcRenderer.invoke('load-content', { type, slug }),
    saveContent: (type, slug, data) => ipcRenderer.invoke('save-content', { type, slug, data }),
    selectImageFile: () => ipcRenderer.invoke('select-image-file'),
    uploadImage: (filePath) => ipcRenderer.invoke('upload-image', { filePath }),
    listImages: () => ipcRenderer.invoke('list-images'),
    deleteContent: (type, slug) => ipcRenderer.invoke('delete-content', { type, slug }),
    startPreview: () => ipcRenderer.invoke('start-preview'),
    stopPreview: () => ipcRenderer.invoke('stop-preview'),
    openInBrowser: (url) => ipcRenderer.invoke('open-in-browser', url),
    onZolaError: (callback) => ipcRenderer.on('zola-error', (_event, value) => callback(value)),
    loadSiteSettings: () => ipcRenderer.invoke('load-site-settings'),
    saveSiteSettings: (settings) => ipcRenderer.invoke('save-site-settings', settings),
    existsContent: (params) => ipcRenderer.invoke('exists-content', params),
    getProjectHistory: () => ipcRenderer.invoke('get-project-history'),
    removeProjectHistory: (projectPath) => ipcRenderer.invoke('remove-project-history', projectPath),
});
