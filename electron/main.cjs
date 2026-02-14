const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const contentManager = require('./contentManager.cjs');
const imageManager = require('./imageManager.cjs');
const configManager = require('./configManager.cjs');

let currentProjectPath = null;
let currentConfig = null;

let zolaProcess = null;

// プロジェクト履歴管理
const MAX_HISTORY = 10;

function getHistoryPath() {
  return path.join(app.getPath('userData'), 'project-history.json');
}

function loadHistory() {
  try {
    const historyPath = getHistoryPath();
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load project history:', error);
  }
  return [];
}

function saveHistory(history) {
  try {
    fs.writeFileSync(getHistoryPath(), JSON.stringify(history, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save project history:', error);
  }
}

function addToHistory(projectPath, siteName) {
  const history = loadHistory();
  // 重複削除
  const filtered = history.filter(item => item.path !== projectPath);
  // 先頭に追加
  filtered.unshift({
    path: projectPath,
    name: siteName || path.basename(projectPath),
    lastOpened: new Date().toISOString()
  });
  // 最大件数で切り詰め
  saveHistory(filtered.slice(0, MAX_HISTORY));
}

function handleZolaError(stderr, event) {
  const ERROR_PATTERNS = {
    brokenLink: {
      regex: /Broken link in (.+): tried to link to (.+)/,
      getMessage: (matches) => `${matches[1]} 内のリンク「${matches[2]}」が見つかりません`
    },
    frontmatterError: {
      regex: /Failed to parse front matter/,
      getMessage: () => '記事の設定データに誤りがあります。YAMLの形式を確認してください。'
    }
  };

  for (const [type, pattern] of Object.entries(ERROR_PATTERNS)) {
    const match = stderr.match(pattern.regex);
    if (match) {
      event.sender.send('zola-error', {
        type,
        message: pattern.getMessage(match),
        raw: stderr
      });
      return;
    }
  }

  // その他のエラー
  // event.sender.send('zola-error', { type: 'unknown', message: 'ビルドエラー', raw: stderr });
}

function startZola(projectPath, event) {
  if (zolaProcess) {
    zolaProcess.kill();
  }

  const zolaBin = process.platform === 'win32' ? 'zola.exe' : 'zola';
  const isDev = process.env.NODE_ENV === 'development';
  // electron/main.cjs から見て ../bin
  const zolaPath = isDev
    ? path.join(__dirname, '../bin', zolaBin)
    : path.join(process.resourcesPath, 'bin', zolaBin);

  console.log(`Starting Zola from: ${zolaPath}`);

  if (!fs.existsSync(zolaPath)) {
    console.error('Zola binary not found');
    event.sender.send('zola-error', { type: 'system', message: `Zolaバイナリが見つかりません: ${zolaPath}` });
    return false;
  }

  zolaProcess = spawn(zolaPath, ['serve', '--port', '1111'], {
    cwd: projectPath,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  zolaProcess.stdout.on('data', (data) => {
    console.log(`Zola: ${data}`);
  });

  zolaProcess.stderr.on('data', (data) => {
    const stderr = data.toString();
    console.error(`Zola Error: ${stderr}`);
    handleZolaError(stderr, event);
  });

  return true;
}

// IPC Handlers
ipcMain.handle('open-project', async () => {
  if (process.env.FUBAKO_AUTO_PROJECT && fs.existsSync(process.env.FUBAKO_AUTO_PROJECT)) {
    return process.env.FUBAKO_AUTO_PROJECT;
  }
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

const yaml = require('js-yaml');

ipcMain.handle('load-config', async (event, projectPath) => {
  try {
    const configPath = path.join(projectPath, 'site-config.yml');
    if (!fs.existsSync(configPath)) {
      throw new Error('site-config.yml が見つかりません');
    }
    const configYaml = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.load(configYaml);

    // グローバルに保存
    currentProjectPath = projectPath;
    currentConfig = config;

    // 履歴に追加
    addToHistory(projectPath, config.site?.name);

    return { success: true, config };
  } catch (error) {
    console.error('Failed to load config:', error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle('list-contents', async (event, type) => {
  try {
    if (!currentProjectPath || !currentConfig) {
      throw new Error('プロジェクトが開かれていません');
    }
    const contents = await contentManager.listContents(currentProjectPath, type, currentConfig);
    return contents;
  } catch (error) {
    console.error('Failed to list contents:', error);
    return [];
  }
});

ipcMain.handle('load-content', async (event, { type, slug }) => {
  try {
    if (!currentProjectPath || !currentConfig) {
      throw new Error('プロジェクトが開かれていません');
    }
    const content = await contentManager.loadContent(currentProjectPath, type, slug, currentConfig);
    return content;
  } catch (error) {
    console.error('Failed to load content:', error);
    return { error: error.message };
  }
});

ipcMain.handle('save-content', async (event, { type, slug, data }) => {
  try {
    if (!currentProjectPath || !currentConfig) {
      throw new Error('プロジェクトが開かれていません');
    }
    const result = await contentManager.saveContent(currentProjectPath, type, slug, data, currentConfig);
    return result;
  } catch (error) {
    console.error('Failed to save content:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-image-file', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '画像ファイル', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] }
      ]
    })
    if (result.canceled) return null
    return result.filePaths[0]
  } catch (error) {
    console.error('Failed to select image file:', error)
    return null
  }
})

ipcMain.handle('upload-image', async (event, { filePath }) => {
  try {
    if (!currentProjectPath) {
      throw new Error('プロジェクトが開かれていません');
    }
    const result = await imageManager.uploadImage(filePath, currentProjectPath);
    return result;
  } catch (error) {
    console.error('Failed to upload image:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-content', async (event, { type, slug }) => {
  try {
    if (!currentProjectPath || !currentConfig) {
      throw new Error('プロジェクトが開かれていません');
    }
    const result = await contentManager.deleteContent(currentProjectPath, type, slug, currentConfig);
    return result;
  } catch (error) {
    console.error('Failed to delete content:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-images', async () => {
  try {
    if (!currentProjectPath) {
      throw new Error('プロジェクトが開かれていません');
    }
    const images = await imageManager.listImages(currentProjectPath);
    return images;
  } catch (error) {
    console.error('Failed to list images:', error);
    return [];
  }
});

ipcMain.handle('start-preview', async (event) => {
  try {
    if (!currentProjectPath) {
      throw new Error('プロジェクトが開かれていません');
    }
    const success = startZola(currentProjectPath, event);
    if (success) {
      return { success: true, url: 'http://localhost:1111' };
    } else {
      return { success: false, error: 'Zolaの起動に失敗しました' };
    }
  } catch (error) {
    console.error('Failed to start preview:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-preview', async () => {
  try {
    if (zolaProcess) {
      zolaProcess.kill()
      zolaProcess = null
      return { success: true }
    }
    return { success: false, error: 'プレビューサーバーは起動していません' }
  } catch (error) {
    console.error('Failed to stop preview:', error)
    return { success: false, error: error.message }
  }
});

ipcMain.handle('open-in-browser', async (event, url) => {
  try {
    await shell.openExternal(url)
    return { success: true }
  } catch (error) {
    console.error('Failed to open in browser:', error)
    return { success: false, error: error.message }
  }
});

ipcMain.handle('load-site-settings', async () => {
  try {
    if (!currentProjectPath || !currentConfig) {
      throw new Error('プロジェクトが開かれていません');
    }
    const settings = await configManager.loadSiteSettings(currentProjectPath, currentConfig);
    return { success: true, settings };
  } catch (error) {
    console.error('Failed to load site settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-site-settings', async (event, newSettings) => {
  try {
    if (!currentProjectPath || !currentConfig) {
      throw new Error('プロジェクトが開かれていません');
    }
    const result = await configManager.saveSiteSettings(currentProjectPath, currentConfig, newSettings);
    return result;
  } catch (error) {
    console.error('Failed to save site settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-project-history', async () => {
  return loadHistory();
});

ipcMain.handle('remove-project-history', async (event, projectPath) => {
  try {
    const history = loadHistory();
    const filtered = history.filter(item => item.path !== projectPath);
    saveHistory(filtered);
    return { success: true };
  } catch (error) {
    console.error('Failed to remove project history:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('exists-content', async (event, { type, slug }) => {
  try {
    if (!currentProjectPath || !currentConfig) {
      throw new Error('プロジェクトが開かれていません');
    }
    const exists = await contentManager.existsContent(currentProjectPath, type, slug, currentConfig);
    return { success: true, exists };
  } catch (error) {
    console.error('Failed to check content existence:', error);
    return { success: false, error: error.message };
  }
});




function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  createWindow();

  // オートメーション用：環境変数があれば自動セット
  if (process.env.FUBAKO_AUTO_PROJECT && fs.existsSync(process.env.FUBAKO_AUTO_PROJECT)) {
    currentProjectPath = process.env.FUBAKO_AUTO_PROJECT;
    try {
      const configPath = path.join(currentProjectPath, 'site-config.yml');
      if (fs.existsSync(configPath)) {
        const yamlContent = fs.readFileSync(configPath, 'utf8');
        currentConfig = yaml.load(yamlContent);
        console.log('[Main] Auto-set project state:', currentProjectPath);
      }
    } catch (error) {
      console.error('[Main] Failed to auto-set project state:', error);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (zolaProcess) {
    zolaProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
