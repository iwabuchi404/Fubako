const path = require('path')
const fs = require('fs')
const { exec } = require('dugite')

// 設定ファイルパス
const GIT_CONFIG_FILE = 'fubako-git-config.json'

/**
 * Gitコマンド実行ヘルパー (dugite使用)
 * @param {string[]} args - Gitコマンド引数
 * @param {string} cwd - 作業ディレクトリ
 * @returns {Promise<Object>} { success, stdout, stderr, error }
 */
async function gitExec(args, cwd) {
  try {
    const result = await exec(args, cwd, {
      env: { ...process.env, LC_ALL: 'C' }
    })

    if (result.exitCode === 0) {
      return { success: true, stdout: result.stdout, stderr: result.stderr }
    } else {
      console.warn('[GitManager] gitExec warning:', {
        args,
        cwd,
        exitCode: result.exitCode,
        stderr: result.stderr,
        stdout: result.stdout
      })
      // Return stdout on error to capture messages like "nothing to commit"
      return { success: false, error: result.stderr || `Git exited with code ${result.exitCode}`, stdout: result.stdout, exitCode: result.exitCode }
    }
  } catch (err) {
    console.error('[GitManager] gitExec error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * トークンを HTTP ヘッダーとして注入する git -c オプション引数を生成
 * @param {string|null} token - GitHub アクセストークン
 * @returns {string[]} git コマンドの先頭に付与する引数
 */
function tokenArgs(token) {
  if (!token) return []
  return ['-c', `http.extraHeader=Authorization: token ${token}`]
}

/**
 * Gitリポジトリ初期化
 * @param {string} projectPath - プロジェクトパス
 * @returns {Promise<Object>} 結果
 */
async function initRepo(projectPath, developBranch = 'develop') {
  try {
    // 既にGitリポジトリか確認（現在のディレクトリがルートであるか）
    const rootResult = await gitExec(['rev-parse', '--show-toplevel'], projectPath)
    if (rootResult.success) {
      const repoRoot = rootResult.stdout.trim().replace(/\//g, path.sep).toLowerCase()
      const currentPath = projectPath.toLowerCase()
      const normalizedRepo = repoRoot.endsWith(path.sep) ? repoRoot.slice(0, -1) : repoRoot
      const normalizedCurrent = currentPath.endsWith(path.sep) ? currentPath.slice(0, -1) : currentPath

      // リポジトリルートと一致する場合のみ「初期化済み」とみなす
      if (normalizedRepo === normalizedCurrent) {
        return { success: true, alreadyInitialized: true }
      }
    }

    // 初期化
    const initResult = await gitExec(['init'], projectPath)
    if (!initResult.success) return { success: false, error: initResult.error }

    // .gitignore を作成（存在しない場合のみ）
    const gitignorePath = path.join(projectPath, '.gitignore')
    if (!fs.existsSync(gitignorePath)) {
      // Zola の公開ディレクトリのみ除外（static/uploads/ は除外しない）
      fs.writeFileSync(gitignorePath, 'public\n', 'utf-8')
    }

    // 初期コミット
    const addResult = await gitExec(['add', '.'], projectPath)
    if (!addResult.success) return { success: false, error: addResult.error }

    const commitResult = await gitExec(['commit', '-m', 'Initial commit'], projectPath)
    if (!commitResult.success) return { success: false, error: commitResult.error }

    // デフォルトブランチを develop にリネーム（設定に合わせる）
    await gitExec(['branch', '-M', developBranch], projectPath)

    return { success: true }
  } catch (error) {
    console.error('[GitManager] initRepo error:', error)
    return { success: false, error: error.error || error.message }
  }
}

/**
 * Gitステータス取得
 * @param {string} projectPath - プロジェクトパス
 * @returns {Promise<Object>} 結果
 */
async function getStatus(projectPath) {
  try {
    // 現在のブランチ
    const branchResult = await gitExec(['branch', '--show-current'], projectPath)
    const currentBranch = branchResult.success ? branchResult.stdout.trim() : null

    // ステータス
    const statusResult = await gitExec(['status', '--porcelain', '-u'], projectPath)

    // リモート情報
    const remoteResult = await gitExec(['remote'], projectPath)
    const remotes = remoteResult.success ? remoteResult.stdout.trim().split('\n') : []
    const hasRemote = remotes.length > 0 && remotes[0] !== ''

    // リポジトリルートを確認（重要: プロジェクトフォルダ自体がリポジトリルートであるかを確認）
    // これにより、親ディレクトリがGit管理下にある場合でも、プロジェクト自体に.gitがない場合は「未初期化」として扱う
    const rootResult = await gitExec(['rev-parse', '--show-toplevel'], projectPath)
    if (rootResult.success) {
      const repoRoot = rootResult.stdout.trim().replace(/\//g, path.sep).toLowerCase()
      const currentPath = projectPath.toLowerCase()

      // パス末尾の区切り文字を削除して比較
      const normalizedRepo = repoRoot.endsWith(path.sep) ? repoRoot.slice(0, -1) : repoRoot
      const normalizedCurrent = currentPath.endsWith(path.sep) ? currentPath.slice(0, -1) : currentPath

      if (normalizedRepo !== normalizedCurrent) {
        console.log('[GitManager] Project is inside a repo but not the root. Treating as not initialized.', { repoRoot, currentPath })
        return {
          success: true,
          isRepo: false,
          currentBranch: null,
          hasUncommittedChanges: false,
          files: [],
          isAheadOfRemote: false,
          isBehindRemote: false,
          hasRemoteUpdates: false,
          hasRemote: false
        }
      }
    }

    let isAheadOfRemote = false
    let isBehindRemote = false
    let hasRemoteUpdates = false

    if (hasRemote && currentBranch) {
      // リモートブランチの存在確認
      const remoteBranchResult = await gitExec(['rev-parse', '--verify', `origin/${currentBranch}`], projectPath)
      const hasRemoteBranch = remoteBranchResult.success

      if (!hasRemoteBranch) {
        // リモートブランチがない場合、ローカルにあれば「先行している」とみなす（初回プッシュ前など）
        isAheadOfRemote = true
        isBehindRemote = false
        hasRemoteUpdates = false
      } else {
        // ahead/behind情報を取得
        try {
          const revListResult = await gitExec(['rev-list', '--count', '--left-right', `origin/${currentBranch}...HEAD`], projectPath)
          if (revListResult.success) {
            const [behind, ahead] = revListResult.stdout.trim().split('\t').map(Number)
            isBehindRemote = behind > 0
            isAheadOfRemote = ahead > 0
          }
        } catch {
          // エラー時は変更なしと仮定
        }

        // リモートブランチの最新コミットを比較
        try {
          const remoteCommit = await gitExec(['rev-parse', `origin/${currentBranch}`], projectPath)
          const localCommit = await gitExec(['rev-parse', 'HEAD'], projectPath)

          if (remoteCommit.success && localCommit.success) {
            hasRemoteUpdates = remoteCommit.stdout.trim() !== localCommit.stdout.trim()
          }
        } catch {
          hasRemoteUpdates = false
        }
      }
    }

    // 未コミットの変更をパース
    const files = []
    if (statusResult.success) {
      const lines = statusResult.stdout.trim().split('\n')
      for (const line of lines) {
        if (!line) continue
        const status = line.substring(0, 2)
        let filePath = line.substring(3)
        // 引用符で囲まれている場合の処理
        if (filePath.startsWith('"') && filePath.endsWith('"')) {
          filePath = filePath.slice(1, -1)
        }

        // カレントディレクトリ外の変更（../で始まるもの）は無視する
        if (filePath.startsWith('../') || filePath.includes('/../') || filePath === '..') {
          continue
        }

        files.push({
          path: filePath,
          status: status.trim(),
          inConflict: status.includes('U')
        })
      }
    }

    return {
      success: true,
      isRepo: true,
      currentBranch,
      hasUncommittedChanges: files.length > 0,
      files,
      isAheadOfRemote,
      isBehindRemote,
      hasRemoteUpdates,
      hasRemote
    }
  } catch (error) {
    console.error('[GitManager] getStatus error:', error)
    // Gitリポジトリでない場合
    if (error.error && (error.error.includes('not a git repository') || error.error.includes('not found'))) {
      return {
        success: true,
        isRepo: false,
        currentBranch: null,
        hasUncommittedChanges: false,
        files: [],
        isAheadOfRemote: false,
        isBehindRemote: false,
        hasRemoteUpdates: false,
        hasRemote: false
      }
    }
    return { success: false, error: error.error || error.message }
  }
}

/**
 * コミット
 * @param {string} projectPath - プロジェクトパス
 * @param {string} message - コミットメッセージ
 * @returns {Promise<Object>} 結果
 */
async function commit(projectPath, message) {
  try {
    // Gitユーザー設定を確認・設定
    try {
      await gitExec(['config', 'user.name', 'Fubako User'], projectPath)
      await gitExec(['config', 'user.email', 'fubako@example.com'], projectPath)
    } catch {
      // 設定失敗は無視
    }

    // static/uploads/ 内のファイルが gitignore されていないか確認して警告
    const ignoredUploads = await gitExec(
      ['ls-files', '--ignored', '--exclude-standard', '-o', '--', 'static/uploads/'],
      projectPath
    )
    const hasIgnoredImages = ignoredUploads.success && ignoredUploads.stdout.trim().length > 0

    // すべての変更をステージング
    const addResult = await gitExec(['add', '.'], projectPath)
    if (!addResult.success) {
      return { success: false, error: addResult.error }
    }

    // コミット
    const commitResult = await gitExec(['commit', '-m', message], projectPath)

    if (!commitResult.success) {
      // 何もコミットするものがない場合は成功扱いにする (exitCode 1)
      // "nothing to commit" = 変更なし (working tree clean)
      // "no changes added to commit" = 変更はあるがステージングされていない (add . で対象外だった場合など)
      const stdout = commitResult.stdout || ''
      const stderr = commitResult.error || ''

      if (stderr.includes('nothing to commit') || stdout.includes('nothing to commit') ||
        stdout.includes('no changes added to commit')) {
        return { success: true, warning: 'Changes unchanged' }
      }
      return { success: false, error: commitResult.error }
    }

    // 画像が gitignore されている場合は警告を追加
    if (hasIgnoredImages) {
      return {
        success: true,
        warning: 'gitignore_images',
        ignoredFiles: ignoredUploads.stdout.trim().split('\n').filter(Boolean)
      }
    }

    return { success: true }
  } catch (error) {
    console.error('[GitManager] commit error:', error)
    const errMsg = error.error || error.message
    return { success: false, error: errMsg }
  }
}

/**
 * プッシュ
 * @param {string} projectPath - プロジェクトパス
 * @param {string} branch - ブランチ名
 * @param {string} remote - リモート名（デフォルト: origin）
 * @returns {Promise<Object>} 結果
 */
async function push(projectPath, branch, remote = 'origin', token = null) {
  try {
    // 常に origin <branch> を明示してプッシュ（--set-upstream でトラッキングも更新）
    // 引数なしの git push はトラッキング設定に依存するため、ブランチ名不一致時にエラーになる
    const pushResult = await gitExec([...tokenArgs(token), 'push', '--set-upstream', remote, branch], projectPath)

    if (!pushResult.success) {
      return { success: false, error: pushResult.error }
    }

    return { success: true }
  } catch (error) {
    console.error('[GitManager] push error:', error)
    return { success: false, error: error.error || error.message }
  }
}

/**
 * フェッチ
 * @param {string} projectPath - プロジェクトパス
 * @returns {Promise<Object>} 結果
 */
async function fetch(projectPath, token = null) {
  try {
    const result = await gitExec([...tokenArgs(token), 'fetch'], projectPath)
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true }
  } catch (error) {
    console.error('[GitManager] fetch error:', error)
    return { success: false, error: error.error || error.message }
  }
}

/**
 * 開発ブランチから本番ブランチへマージ
 * @param {string} projectPath - プロジェクトパス
 * @param {string} developBranch - 開発ブランチ名
 * @param {string} productionBranch - 本番ブランチ名
 * @returns {Promise<Object>} 結果
 */
async function mergeToProduction(projectPath, developBranch, productionBranch, token = null) {
  try {
    // dev ブランチの内容を直接 main へ push（checkout/merge 不要）
    // git push origin dev:main は dev の完全な状態を main に反映する
    // ブランチ切り替えなしで実行できるため、.github 等の欠落が起きない
    const pushResult = await gitExec(
      [...tokenArgs(token), 'push', '--force-with-lease', 'origin', `${developBranch}:${productionBranch}`],
      projectPath
    )

    if (!pushResult.success) {
      return { success: false, error: `公開に失敗: ${pushResult.error}` }
    }

    return { success: true }
  } catch (error) {
    console.error('[GitManager] mergeToProduction error:', error)
    return { success: false, error: error.error || error.message }
  }
}

/**
 * ブランチを切り替える
 * @param {string} projectPath - プロジェクトパス
 * @param {string} branch - 切り替え先ブランチ名
 * @returns {Promise<Object>} 結果
 */
async function checkout(projectPath, branch) {
  try {
    const result = await gitExec(['checkout', branch], projectPath)
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true }
  } catch (error) {
    console.error('[GitManager] checkout error:', error)
    return { success: false, error: error.error || error.message }
  }
}

/**
 * public/をzipにしてエクスポート
 * @param {string} projectPath - プロジェクトパス
 * @param {string} outputPath - 出力先ファイルパス
 * @returns {Promise<Object>} 結果
 */
async function exportDist(projectPath, outputPath) {
  try {
    const archiver = require('archiver')
    // outputPathが指定されていない場合はプロジェクト内に保存（後方互換）
    const finalOutputPath = outputPath || path.join(projectPath, 'dist-export.zip')

    const output = fs.createWriteStream(finalOutputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => {
      console.log(`[GitManager] Export completed: ${archive.pointer()} bytes`)
    })

    archive.on('error', (err) => {
      throw err
    })

    archive.pipe(output)

    // public/ディレクトリを追加（Zolaのビルド出力先）
    const publicPath = path.join(projectPath, 'public')
    if (fs.existsSync(publicPath)) {
      archive.directory(publicPath, 'public')
    } else {
      return { success: false, error: 'public/ディレクトリが存在しません。先にプレビューを起動してビルドしてください。' }
    }

    await archive.finalize()

    return { success: true, outputPath: finalOutputPath }
  } catch (error) {
    console.error('[GitManager] exportDist error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Git設定を保存
 * @param {string} projectPath - プロジェクトパス
 * @param {Object} config - Git設定
 * @returns {Promise<Object>} 結果
 */
async function saveGitConfig(projectPath, config) {
  try {
    // リモートURLの設定をGitに反映
    if (config.remoteUrl !== undefined) {
      await setRemote(projectPath, config.remoteUrl)
    }

    const configPath = path.join(projectPath, GIT_CONFIG_FILE)
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    return { success: true }
  } catch (error) {
    console.error('[GitManager] saveGitConfig error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * リモートURLを設定
 * @param {string} projectPath - プロジェクトパス
 * @param {string} url - リモートURL
 * @param {string} remote - リモート名（デフォルト: origin）
 * @returns {Promise<Object>} 結果
 */
async function setRemote(projectPath, url, remote = 'origin') {
  try {
    // 既存のリモートを確認
    const checkResult = await gitExec(['remote', 'get-url', remote], projectPath)

    if (checkResult.success) {
      // 既存があれば更新
      if (url) {
        await gitExec(['remote', 'set-url', remote, url], projectPath)
      } else {
        // URLが空なら削除
        await gitExec(['remote', 'remove', remote], projectPath)
      }
    } else {
      // なければ追加
      if (url) {
        await gitExec(['remote', 'add', remote, url], projectPath)
      }
    }

    return { success: true }
  } catch (error) {
    console.error('[GitManager] setRemote error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Git設定を読み込み
 * @param {string} projectPath - プロジェクトパス
 * @returns {Promise<Object>} 結果
 */
async function loadGitConfig(projectPath) {
  try {
    const configPath = path.join(projectPath, GIT_CONFIG_FILE)

    if (!fs.existsSync(configPath)) {
      return { success: true, config: null }
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    return { success: true, config }
  } catch (error) {
    console.error('[GitManager] loadGitConfig error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * コンフリクトのあるファイルを解消（手元優先）
 * @param {string} projectPath - プロジェクトパス
 * @param {string} filePath - ファイルパス
 * @returns {Promise<Object>} 結果
 */
async function resolveConflictLocal(projectPath, filePath) {
  try {
    // 手元のバージョンを採用
    await gitExec(['checkout', '--ours', filePath], projectPath)
    await gitExec(['add', filePath], projectPath)

    return { success: true }
  } catch (error) {
    console.error('[GitManager] resolveConflictLocal error:', error)
    return { success: false, error: error.error || error.message }
  }
}

/**
 * コンフリクトのあるファイルを解消（リモート優先）
 * @param {string} projectPath - プロジェクトパス
 * @param {string} filePath - ファイルパス
 * @returns {Promise<Object>} 結果
 */
async function resolveConflictRemote(projectPath, filePath) {
  try {
    // リモートのバージョンを採用
    await gitExec(['checkout', '--theirs', filePath], projectPath)
    await gitExec(['add', filePath], projectPath)

    return { success: true }
  } catch (error) {
    console.error('[GitManager] resolveConflictRemote error:', error)
    return { success: false, error: error.error || error.message }
  }
}

/**
 * CIファイルを生成してコミット・プッシュ
 * @param {string} projectPath - プロジェクトパス
 * @param {string} deployTarget - 'github-pages'
 * @param {Object} options - { productionBranch, workingBranch, zolaVersion }
 */
async function generateCIFiles(projectPath, deployTarget, options, token = null) {
  const {
    productionBranch = 'main',
    workingBranch,
    zolaVersion = '0.19.2',
    productionBaseUrl = ''
  } = options

  // base_url が指定されていれば --base-url オプションを追加
  const buildCmd = productionBaseUrl
    ? `zola build --base-url ${productionBaseUrl}`
    : 'zola build'

  const githubDir = path.join(projectPath, '.github')
  const workflowDir = path.join(githubDir, 'workflows')

  // ディレクトリ作成（なければ作成）
  if (!fs.existsSync(githubDir)) fs.mkdirSync(githubDir)
  if (!fs.existsSync(workflowDir)) fs.mkdirSync(workflowDir)

  // deploy.yml の内容（GitHub Pages用）
  const deployYml = `name: Deploy to GitHub Pages

on:
  push:
    branches: [${productionBranch}]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - name: Install Zola
        uses: taiki-e/install-action@v2
        with:
          tool: zola@${zolaVersion}

      - name: Build
        run: ${buildCmd}

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
`

  // dependabot.yml の内容（全デプロイ先共通）
  const dependabotYml = `version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
    labels:
      - "ci"
`

  fs.writeFileSync(path.join(workflowDir, 'deploy.yml'), deployYml, 'utf-8')
  fs.writeFileSync(path.join(githubDir, 'dependabot.yml'), dependabotYml, 'utf-8')

  // コミット
  const commitResult = await commit(projectPath, 'ci: GitHub Pages デプロイ設定を追加')
  if (!commitResult.success) return commitResult

  // 現在のブランチを取得してプッシュ
  const branchResult = await gitExec(['branch', '--show-current'], projectPath)
  const currentBranch = branchResult.success ? branchResult.stdout.trim() : (workingBranch || 'draft')
  const pushResult = await push(projectPath, currentBranch, 'origin', token)
  if (!pushResult.success) return pushResult

  return { success: true }
}

module.exports = {
  initRepo,
  getStatus,
  commit,
  push,
  fetch,
  mergeToProduction,
  exportDist,
  saveGitConfig,
  loadGitConfig,
  setRemote,
  checkout,
  resolveConflictLocal,
  resolveConflictRemote,
  generateCIFiles
}
