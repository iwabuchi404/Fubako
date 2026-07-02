const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const contentManager = require('./contentManager.cjs');
const imageManager = require('./imageManager.cjs');
const configManager = require('./configManager.cjs');
const i18nManager = require('./i18nManager.cjs');
const gitManager = require('./gitManager.cjs');
const githubAuth = require('./githubAuth.cjs');

let currentProjectPath = null;
let currentConfig = null;

let zolaProcess = null;
let mainWindow = null;
let zolaStoppedIntentionally = false;
let lastZolaStderr = '';

// プロジェクトファイル監視
let fileWatcher = null;
let fileChangeTimeout = null;

function startFileWatcher(projectPath) {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
  if (fileChangeTimeout) {
    clearTimeout(fileChangeTimeout);
    fileChangeTimeout = null;
  }

  try {
    fileWatcher = fs.watch(projectPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      // .git/ と public/ の変更は無視
      const normalized = filename.replace(/\\/g, '/');
      if (normalized.startsWith('.git/') || normalized.startsWith('public/')) return;

      // デバウンス（500ms）
      if (fileChangeTimeout) clearTimeout(fileChangeTimeout);
      fileChangeTimeout = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('project-files-changed');
        }
      }, 500);
    });
  } catch (e) {
    console.warn('[main] File watcher failed to start:', e.message);
  }
}

// 言語設定
ipcMain.handle('get-locale', () => i18nManager.currentLocale);
ipcMain.handle('set-locale', (event, locale) => {
  i18nManager.setLocale(locale);
  return { success: true };
});

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

/**
 * Zolaプロセスを安全に終了させる
 * タイムアウト付きでプロセスの終了を待機し、応答がなければ強制終了する
 */
function terminateZola(timeout = 5000) {
  return new Promise((resolve) => {
    if (!zolaProcess) {
      resolve();
      return;
    }

    const proc = zolaProcess;
    zolaStoppedIntentionally = true;

    const timer = setTimeout(() => {
      // タイムアウト: 強制終了
      console.warn('Zola process did not exit in time, force killing');
      try { proc.kill('SIGKILL'); } catch (e) { /* already dead */ }
      zolaProcess = null;
      resolve();
    }, timeout);

    proc.once('close', () => {
      clearTimeout(timer);
      zolaProcess = null;
      resolve();
    });

    try { proc.kill(); } catch (e) { /* already dead */ }
  });
}

async function startZola(projectPath, event = null) {
  // 旧プロセスの終了を待ってから起動
  await terminateZola();
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

  // git config の previewPort で上書き（1111以外が設定されている場合）
  try {
    const gitConfigResult = await gitManager.loadGitConfig(projectPath);
    if (gitConfigResult?.config?.previewPort && gitConfigResult.config.previewPort !== 1111) {
      port = String(gitConfigResult.config.previewPort);
    }
  } catch (e) {
    console.warn('[main] Failed to load git config for previewPort:', e);
  }

  const zolaBin = process.platform === 'win32' ? 'zola.exe' : 'zola';
  const isDev = process.env.NODE_ENV === 'development';
  // electron/main.cjs から見て ../bin
  const zolaPath = isDev
    ? path.join(__dirname, '../bin', zolaBin)
    : path.join(process.resourcesPath, 'bin', zolaBin);

  console.log(`Starting Zola on port ${port} from: ${zolaPath}`);

  // 送信先を決定（event有無問わずmainWindowが利用可能ならそこへ送る）
  const sender = event ? event.sender : (mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null);

  if (!fs.existsSync(zolaPath)) {
    console.error('Zola binary not found');
    const msg = i18nManager.t('project.zolaBinaryNotFound', { path: zolaPath });
    console.error(msg);
    if (sender) sender.send('zola-error', { type: 'error', message: msg, raw: msg });
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
    lastZolaStderr = stderr;
    console.log(`Zola stderr: ${stderr}`);

    // エラーハンドリング: event有無に関わらず同じパース処理を行う
    if (!sender) return;

    // ビルド状態メッセージを判定（エラーではない通常のメッセージ）
    if (stderr.includes('Building site...')) {
      sender.send('zola-error', { type: 'building', message: i18nManager.t('project.buildInProgress'), raw: stderr });
      return;
    }
    if (stderr.includes('Done in')) {
      sender.send('zola-error', { type: 'built', message: i18nManager.t('project.buildComplete'), raw: stderr });
      return;
    }

    const errorPatterns = [
      {
        type: 'pathCollision',
        regex: /Reason: URL collision: (.+) is generated by multiple files/,
        getMessage: (matches) => i18nManager.t('project.slugCollisionDetail', { slug: matches[1] })
      },
      {
        type: 'brokenLink',
        regex: /Reason: Link check failed: Link "(.*)" in (.*) not found/,
        getMessage: (matches) => i18nManager.t('project.brokenLinkDetail', { link: matches[1], file: matches[2] })
      },
      {
        type: 'frontmatterError',
        regex: /Reason: Failed to parse front matter/,
        getMessage: () => i18nManager.t('project.frontMatterError')
      }
    ];

    for (const pattern of errorPatterns) {
      const match = stderr.match(pattern.regex);
      if (match) {
        sender.send('zola-error', {
          type: pattern.type,
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

    // 異常終了をレンダラーに通知（lastZolaStderrを含める）
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('zola-error', {
        type: 'process-exit',
        message: `プレビューサーバーが停止しました（終了コード: ${code}）`,
        raw: lastZolaStderr || `Zola process exited with code ${code}`
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

    // プロジェクト切替時にインデックスキャッシュをクリア
    contentManager.invalidateIndexCache();

    // ファイル変更監視を開始（Git未保存状態の即時検知用）
    startFileWatcher(projectPath);

    // プレビューサーバーを自動起動
    await startZola(projectPath);

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

ipcMain.handle('delete-image', async (event, { imagePath }) => {
  console.log('[Main] delete-image start:', imagePath);
  try {
    if (!currentProjectPath) {
      throw new Error('プロジェクトが開かれていません');
    }
    const result = await imageManager.deleteImage(imagePath, currentProjectPath);
    console.log('[Main] delete-image result:', result);
    return result;
  } catch (error) {
    console.error('[Main] Failed to delete image:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-image-references', async (event, { imagePath }) => {
  console.log('[Main] get-image-references start:', imagePath);
  try {
    if (!currentProjectPath || !currentConfig) {
      throw new Error('プロジェクトが開かれていません');
    }
    const references = await contentManager.findImageReferences(currentProjectPath, imagePath, currentConfig);
    console.log('[Main] get-image-references count:', references.length);
    return references;
  } catch (error) {
    console.error('[Main] Failed to get image references:', error);
    return [];
  }
});

ipcMain.handle('start-preview', async (event) => {
  try {
    if (!currentProjectPath) {
      throw new Error('プロジェクトが開かれていません');
    }
    const success = await startZola(currentProjectPath, event);
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
      await terminateZola();
      return { success: true };
    }
    return { success: false, error: 'プレビューサーバーは起動していません' };
  } catch (error) {
    console.error('Failed to stop preview:', error);
    return { success: false, error: error.message };
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

// Git関連
ipcMain.handle('git-init', async (event, { projectPath, developBranch }) => {
  try {
    const result = await gitManager.initRepo(projectPath, developBranch);
    return result;
  } catch (error) {
    console.error('Failed to init git repo:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-load-config', async (event, projectPath) => {
  try {
    const result = await gitManager.loadGitConfig(projectPath);
    return result;
  } catch (error) {
    console.error('Failed to load Git config:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-save-config', async (event, { projectPath, config }) => {
  try {
    const result = await gitManager.saveGitConfig(projectPath, config);
    return result;
  } catch (error) {
    console.error('Failed to save Git config:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-get-status', async (event, projectPath) => {
  try {
    const result = await gitManager.getStatus(projectPath);
    return result;
  } catch (error) {
    console.error('Failed to get Git status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-commit', async (event, { projectPath, message }) => {
  try {
    const result = await gitManager.commit(projectPath, message);
    return result;
  } catch (error) {
    console.error('Failed to commit:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-push', async (event, { projectPath, branch }) => {
  try {
    const token = githubAuth.loadToken();
    const result = await gitManager.push(projectPath, branch, 'origin', token);
    return result;
  } catch (error) {
    console.error('Failed to push:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-fetch', async (event, projectPath) => {
  try {
    const token = githubAuth.loadToken();
    const result = await gitManager.fetch(projectPath, token);
    return result;
  } catch (error) {
    console.error('Failed to fetch:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-pull', async (event, { projectPath, branch }) => {
  try {
    const token = githubAuth.loadToken();
    const result = await gitManager.pull(projectPath, branch, token);
    return result;
  } catch (error) {
    console.error('Failed to pull:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-resolve-conflict', async (event, { projectPath, branch, file, side }) => {
  try {
    const result = await gitManager.resolveConflict(projectPath, branch, file, side);
    return result;
  } catch (error) {
    console.error('Failed to resolve conflict:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-complete-merge', async (event, projectPath) => {
  try {
    const result = await gitManager.completeMerge(projectPath);
    return result;
  } catch (error) {
    console.error('Failed to complete merge:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-abort-merge', async (event, projectPath) => {
  try {
    const result = await gitManager.abortMerge(projectPath);
    return result;
  } catch (error) {
    console.error('Failed to abort merge:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-merge-to-production', async (event, { projectPath, developBranch, productionBranch }) => {
  try {
    const token = githubAuth.loadToken();
    const result = await gitManager.mergeToProduction(projectPath, developBranch, productionBranch, token);
    return result;
  } catch (error) {
    console.error('Failed to merge to production:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-export-dist', async (event, projectPath) => {
  try {
    // 保存先ダイアログを表示
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'エクスポート先を選択',
      defaultPath: 'site-export.zip',
      filters: [
        { name: 'ZIPファイル', extensions: ['zip'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, cancelled: true };
    }

    const result = await gitManager.exportDist(projectPath, filePath);
    return result;
  } catch (error) {
    console.error('Failed to export dist:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-checkout', async (event, { projectPath, branch }) => {
  try {
    const result = await gitManager.checkout(projectPath, branch);
    return result;
  } catch (error) {
    console.error('Failed to checkout branch:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-generate-ci', async (event, { projectPath, deployTarget, options }) => {
  try {
    const token = githubAuth.loadToken();
    const result = await gitManager.generateCIFiles(projectPath, deployTarget, options, token);
    if (!result.success) return result;

    // GitHub Pages の Source を "GitHub Actions" に自動設定
    if (token && deployTarget === 'github-pages') {
      try {
        const { exec } = require('dugite');
        const urlResult = await exec(['remote', 'get-url', 'origin'], projectPath, {
          env: { ...process.env, LC_ALL: 'C' }
        });
        const remoteUrl = urlResult.stdout.trim();
        const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
        if (match) {
          const owner = match[1];
          const repo = match[2];
          const getResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
          });
          if (getResp.ok) {
            const updateResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
              method: 'PUT',
              headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
              body: JSON.stringify({ build_type: 'workflow' })
            });
            console.log('[githubAuth] Pages source update:', updateResp.status);
          } else if (getResp.status === 404) {
            const createResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
              body: JSON.stringify({ build_type: 'workflow' })
            });
            console.log('[githubAuth] Pages source create:', createResp.status);
          }
        }
      } catch (pagesError) {
        console.error('[githubAuth] Pages auto-config error:', pagesError.message);
      }
    }

    return result;
  } catch (error) {
    console.error('Failed to generate CI files:', error);
    return { success: false, error: error.message };
  }
});

// GitHub Device Flow 認証
ipcMain.handle('github-auth-start', async () => {
  try {
    const data = await githubAuth.requestDeviceCode();
    shell.openExternal(data.verification_uri);
    return { success: true, ...data };
  } catch (error) {
    console.error('Failed to start GitHub auth:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('github-auth-poll', async (event, { deviceCode }) => {
  try {
    const data = await githubAuth.pollForToken(deviceCode);
    if (data.access_token) {
      // 保存前にトークンを検証
      try {
        const verifyResp = await fetch('https://api.github.com/user', {
          headers: { 'Authorization': `token ${data.access_token}`, 'Accept': 'application/vnd.github+json' }
        });
        console.log('[githubAuth] Pre-save verify: status=' + verifyResp.status + ', token starts=' + data.access_token.substring(0, 8) + ', length=' + data.access_token.length);
        if (verifyResp.ok) {
          const userData = await verifyResp.json();
          console.log('[githubAuth] Pre-save verify: user=' + userData.login);
        } else {
          const errBody = await verifyResp.text();
          console.error('[githubAuth] Pre-save verify FAILED: ' + errBody);
        }
      } catch (e) {
        console.error('[githubAuth] Pre-save verify error:', e.message);
      }
      githubAuth.saveToken(data.access_token);
      // 保存後にも検証
      const loadedToken = githubAuth.loadToken();
      console.log('[githubAuth] Post-load: starts=' + (loadedToken ? loadedToken.substring(0, 8) : 'null') + ', length=' + (loadedToken ? loadedToken.length : 0) + ', match=' + (loadedToken === data.access_token));
      return { success: true, authenticated: true };
    }
    if (data.error === 'authorization_pending') {
      return { success: true, authenticated: false, pending: true };
    }
    if (data.error === 'slow_down') {
      return { success: true, authenticated: false, pending: true, slowDown: true };
    }
    return { success: false, error: data.error_description || data.error };
  } catch (error) {
    console.error('Failed to poll GitHub auth:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('github-auth-status', async () => {
  const token = githubAuth.loadToken();
  if (!token) return { authenticated: false };
  // トークンの有効性をGitHub APIで検証
  try {
    const resp = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `token `, 'Accept': 'application/vnd.github+json' }
    });
    if (resp.ok) {
      const data = await resp.json();
      console.log('[githubAuth] Token valid, user:', data.login);
      return { authenticated: true, username: data.login };
    } else {
      console.warn('[githubAuth] Token invalid, status:', resp.status);
      return { authenticated: false, tokenInvalid: true };
    }
  } catch (e) {
    console.error('[githubAuth] Token check failed:', e.message);
    return { authenticated: true, warning: 'Token check failed' };
  }
});

ipcMain.handle('github-auth-clear', async () => {
  githubAuth.clearToken();
  return { success: true };
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

app.on('window-all-closed', async () => {
  await terminateZola();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
