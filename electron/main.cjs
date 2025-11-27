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

app.whenReady().then(() => {
  createWindow();

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
