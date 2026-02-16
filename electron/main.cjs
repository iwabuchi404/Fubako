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
let mainWindow = null;
let zolaStoppedIntentionally = false;

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

function startZola(projectPath, event = null) {
  if (zolaProcess) {
    zolaStoppedIntentionally = true;
    zolaProcess.kill();
    zolaProcess = null;
  }
  zolaStoppedIntentionally = false;

  // ポートを site-config.yml から取得
  let port = '1111'; // デフォルト
  if (currentConfig?.site?.preview_url) {
    try {
      const url = new URL(currentConfig.site.preview_url);
      if (url.port) {
        port = url.port;
      }
    } catch (e) {
      console.warn('Failed to parse preview_url from config:', e);
    }
  }

  const zolaBin = process.platform === 'win32' ? 'zola.exe' : 'zola';
  const isDev = process.env.NODE_ENV === 'development';
  // electron/main.cjs から見て ../bin
  const zolaPath = isDev
    ? path.join(__dirname, '../bin', zolaBin)
    : path.join(process.resourcesPath, 'bin', zolaBin);

  console.log(`Starting Zola on port ${port} from: ${zolaPath}`);

  if (!fs.existsSync(zolaPath)) {
    console.error('Zola binary not found');
    const msg = `Zolaバイナリが見つかりません: ${zolaPath}`;
    if (event) {
      event.sender.send('zola-error', { type: 'system', message: msg });
    } else if (mainWindow) {
      mainWindow.webContents.send('zola-error', { type: 'system', message: msg });
    }
    return false;
  }

  zolaProcess = spawn(zolaPath, ['serve', '--port', port], {
    cwd: projectPath,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  zolaProcess.stdout.on('data', (data) => {
    console.log(`Zola: ${data}`);
  });

  zolaProcess.stderr.on('data', (data) => {
    const stderr = data.toString();
    console.log(`Zola stderr: ${stderr}`);

    // エラーハンドリング: event有無に関わらず同じパース処理を行う
    const sender = event ? event.sender : (mainWindow ? mainWindow.webContents : null);
    if (!sender) return;

    // ビルド状態メッセージを判定（エラーではない通常のメッセージ）
    if (stderr.includes('Building site') || stderr.includes('Checking all')) {
      sender.send('zola-error', { type: 'building', message: 'ビルド中...', raw: stderr });
      return;
    }
    if (stderr.includes('Done in') || stderr.includes('Site built')) {
      sender.send('zola-error', { type: 'built', message: 'ビルド完了', raw: stderr });
      return;
    }

    // エラーパターンをチェック
    const ERROR_PATTERNS = {
      pathCollision: {
        regex: /Found path collisions[\s\S]*?`([^`]+)`/,
        getMessage: (matches) => `URLパスの衝突: ${matches[1]} が複数のファイルから生成されています。ファイル名を変更してください。`
      },
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
        sender.send('zola-error', {
          type,
          message: pattern.getMessage(match),
          raw: stderr
        });
        return;
      }
    }

    // マッチしない stderr は無視（通常のログ出力）
  });

  zolaProcess.on('close', (code) => {
    console.log(`Zola process exited with code ${code}`);
    zolaProcess = null;

    if (zolaStoppedIntentionally) {
      zolaStoppedIntentionally = false;
      return;
    }

    // 異常終了をレンダラーに通知
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('zola-error', {
        type: 'process-exit',
        message: `プレビューサーバーが停止しました（終了コード: ${code}）`
      });
    }
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

    // プレビューサーバーを自動起動
    startZola(projectPath);

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
  console.log('[Main] upload-image start:', filePath);
  try {
    if (!currentProjectPath) {
      throw new Error('プロジェクトが開かれていません');
    }
    const result = await imageManager.uploadImage(filePath, currentProjectPath);
    console.log('[Main] upload-image result:', result);
    return result;
  } catch (error) {
    console.error('[Main] Failed to upload image:', error);
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

ipcMain.handle('resize-image', async (event, { imagePath, width, height }) => {
  console.log('[Main] resize-image start:', { imagePath, width, height });
  try {
    if (!currentProjectPath) {
      throw new Error('プロジェクトが開かれていません');
    }
    const result = await imageManager.resizeImage(imagePath, width, height, currentProjectPath);
    console.log('[Main] resize-image result:', result);
    return result;
  } catch (error) {
    console.error('[Main] Failed to resize image:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generate-dummy-image', async (event, options) => {
  console.log('[Main] generate-dummy-image start:', options);
  try {
    if (!currentProjectPath) {
      throw new Error('プロジェクトが開かれていません');
    }
    const result = await imageManager.generateDummyImage({ ...options, projectPath: currentProjectPath });
    console.log('[Main] generate-dummy-image result:', result);
    return result;
  } catch (error) {
    console.error('[Main] Failed to generate dummy image:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-preview', async (event) => {
  try {
    if (!currentProjectPath) {
      throw new Error('プロジェクトが開かれていません');
    }
    const success = startZola(currentProjectPath, event);
    if (success) {
      const url = currentConfig?.site?.preview_url || 'http://localhost:1111';
      return { success: true, url };
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
      zolaStoppedIntentionally = true;
      zolaProcess.kill();
      zolaProcess = null;
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

ipcMain.handle('get-server-info', async () => {
  // startZola と同じロジックでポートを決定
  let zolaPort = '1111';
  if (currentConfig?.site?.preview_url) {
    try {
      const url = new URL(currentConfig.site.preview_url);
      if (url.port) {
        zolaPort = url.port;
      }
    } catch (e) {
      // preview_url のパースに失敗した場合はデフォルト使用
    }
  }
  return {
    viteUrl: process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null,
    zolaUrl: `http://localhost:${zolaPort}`
  };
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

ipcMain.handle('check-slug-collision', async (event, { type, slug, excludeSlug }) => {
  try {
    if (!currentProjectPath || !currentConfig) {
      throw new Error('プロジェクトが開かれていません');
    }
    const result = await contentManager.checkSlugCollision(
      currentProjectPath, type, slug, currentConfig, excludeSlug || null
    );
    return { success: true, ...result };
  } catch (error) {
    console.error('Failed to check slug collision:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('resolve-slug-collision', async (event, { type, duplicateSlug }) => {
  try {
    if (!currentProjectPath || !currentConfig) {
      throw new Error('プロジェクトが開かれていません');
    }
    const result = await contentManager.resolveSlugCollision(
      currentProjectPath, type, duplicateSlug, currentConfig
    );
    return result;
  } catch (error) {
    console.error('Failed to resolve slug collision:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('detect-all-slug-collisions', async () => {
  try {
    if (!currentProjectPath || !currentConfig) {
      throw new Error('プロジェクトが開かれていません');
    }
    const collisions = await contentManager.detectAllSlugCollisions(
      currentProjectPath, currentConfig
    );
    return { success: true, collisions };
  } catch (error) {
    console.error('Failed to detect slug collisions:', error);
    return { success: false, error: error.message };
  }
});




function createWindow() {
  mainWindow = new BrowserWindow({
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
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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
