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
    onZolaError: (callback) => {
        const handler = (_event, value) => callback(value)
        ipcRenderer.on('zola-error', handler)
        // クリーンアップ用の関数を返す
        return () => ipcRenderer.removeListener('zola-error', handler)
    },
    loadSiteSettings: () => ipcRenderer.invoke('load-site-settings'),
    saveSiteSettings: (settings) => ipcRenderer.invoke('save-site-settings', settings),
    existsContent: (params) => ipcRenderer.invoke('exists-content', params),
    getProjectHistory: () => ipcRenderer.invoke('get-project-history'),
    removeProjectHistory: (projectPath) => ipcRenderer.invoke('remove-project-history', projectPath),
    resizeImage: (params) => ipcRenderer.invoke('resize-image', params),
    generateDummyImage: (options) => ipcRenderer.invoke('generate-dummy-image', options),
    getServerInfo: () => ipcRenderer.invoke('get-server-info'),
    checkSlugCollision: (params) => ipcRenderer.invoke('check-slug-collision', params),
    resolveSlugCollision: (params) => ipcRenderer.invoke('resolve-slug-collision', params),
    detectAllSlugCollisions: () => ipcRenderer.invoke('detect-all-slug-collisions'),

    // Git関連
    gitInit: (projectPath, developBranch) => ipcRenderer.invoke('git-init', { projectPath, developBranch }),
    loadGitConfig: (projectPath) => ipcRenderer.invoke('git-load-config', projectPath),
    saveGitConfig: (projectPath, config) => ipcRenderer.invoke('git-save-config', { projectPath, config }),
    getGitStatus: (projectPath) => ipcRenderer.invoke('git-get-status', projectPath),
    gitCommit: (projectPath, message) => ipcRenderer.invoke('git-commit', { projectPath, message }),
    gitPush: (projectPath, branch) => ipcRenderer.invoke('git-push', { projectPath, branch }),
    gitFetch: (projectPath) => ipcRenderer.invoke('git-fetch', projectPath),
    gitMergeToProduction: (projectPath, developBranch, productionBranch) => ipcRenderer.invoke('git-merge-to-production', { projectPath, developBranch, productionBranch }),
    gitExportDist: (projectPath) => ipcRenderer.invoke('git-export-dist', projectPath),
    gitResolveConflictLocal: (projectPath, filePath) => ipcRenderer.invoke('git-resolve-conflict-local', { projectPath, filePath }),
    gitResolveConflictRemote: (projectPath, filePath) => ipcRenderer.invoke('git-resolve-conflict-remote', { projectPath, filePath }),
    gitCheckout: (projectPath, branch) => ipcRenderer.invoke('git-checkout', { projectPath, branch }),
    gitGenerateCI: (projectPath, deployTarget, options) =>
      ipcRenderer.invoke('git-generate-ci', { projectPath, deployTarget, options }),

    // GitHub認証 (Device Flow)
    githubAuthStart: () => ipcRenderer.invoke('github-auth-start'),
    githubAuthPoll: (deviceCode) => ipcRenderer.invoke('github-auth-poll', { deviceCode }),
    githubAuthStatus: () => ipcRenderer.invoke('github-auth-status'),
    githubAuthClear: () => ipcRenderer.invoke('github-auth-clear'),
});
