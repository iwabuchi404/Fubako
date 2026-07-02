const path = require('path')
const fs = require('fs')
const { exec } = require('dugite')

// 設定ファイルパス
const GIT_CONFIG_FILE = 'fubako-git-config.json'

/**
 * Gitコマンド実行ヘルパー (dugite使用)
 * @param {string[]} args - Gitコマンド引数
 * @param {string} cwd - 作業ディレクトリ
 * @param {string} token - GitHubアクセストークン（認証が必要な場合）
 * @returns {Promise<Object>} { success, stdout, stderr, error }
 */
async function gitExec(args, cwd) {
  try {
    const result = await exec(args, cwd, {
      env: { ...process.env, LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }
    })

    if (result.exitCode === 0) {
      return { success: true, stdout: result.stdout, stderr: result.stderr }
    } else {
      console.warn('[GitManager] gitExec warning:', {
        args: redactGitArgs(args),
        cwd,
        exitCode: result.exitCode,
        stderr: result.stderr,
        stdout: result.stdout
      })
      return { success: false, error: result.stderr || `Git exited with code ${result.exitCode}`, stdout: result.stdout, exitCode: result.exitCode }
    }
  } catch (err) {
    console.error('[GitManager] gitExec error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Gitコマンド引数から認証情報をマスクする
 * @param {string[]} args - Gitコマンド引数
 * @returns {string[]} マスク済み引数
 */
function redactGitArgs(args) {
  return args.map((arg) => {
    if (typeof arg !== 'string') return arg
    return arg
      .replace(/(Authorization:\s*token\s+)[^\s]+/gi, '$1[REDACTED]')
      .replace(/(Authorization:\s*Bearer\s+)[^\s]+/gi, '$1[REDACTED]')
      .replace(/(Authorization:\s*Basic\s+)[^\s]+/gi, '$1[REDACTED]')
      .replace(/(x-access-token:)[^@]+@/gi, '$1[REDACTED]@')
  })
}

/**
 * GitHub.com HTTPS 通信に限定してトークンを HTTP ヘッダーとして注入する git -c オプション引数を生成
 * @param {string|null} token - GitHub アクセストークン
 * @returns {string[]} git コマンドの先頭に付与する引数
 */
// tokenArgs is deprecated - auth is now handled via GIT_CONFIG_COUNT env vars in gitExec
function tokenArgs(token) {
  if (!token) return []
  return []
}


/**
 * 指定refにファイルが存在するか確認する
 * @param {string} projectPath - プロジェクトパス
 * @param {string} ref - Git ref
 * @param {string} file - ファイルパス
 * @returns {Promise<boolean>} 存在する場合 true
 */
async function pathExistsInRef(projectPath, ref, file) {
  const result = await gitExec(['ls-tree', '-r', '--name-only', ref, '--', file], projectPath)
  if (!result.success) return false
  return result.stdout.trim().split('\n').filter(Boolean).includes(file)
}

/**
 * 指定refのファイル状態を作業ツリーとindexに適用する。ref側で削除済みなら削除を適用する。
 * @param {string} projectPath - プロジェクトパス
 * @param {string} ref - Git ref
 * @param {string} file - ファイルパス
 * @returns {Promise<Object>} 結果
 */
async function applyPathFromRef(projectPath, ref, file) {
  const exists = await pathExistsInRef(projectPath, ref, file)

  if (exists) {
    const checkoutResult = await gitExec(['checkout', ref, '--', file], projectPath)
    if (!checkoutResult.success) return checkoutResult

    return await gitExec(['add', file], projectPath)
  }

  return await gitExec(['rm', '--ignore-unmatch', '--', file], projectPath)
}

/**
 * Git ref が存在するか確認する
 * @param {string} projectPath - プロジェクトパス
 * @param {string} ref - Git ref
 * @returns {Promise<boolean>} 存在する場合 true
 */
async function refExists(projectPath, ref) {
  const result = await gitExec(['rev-parse', '--verify', ref], projectPath)
  return result.success
}

/**
 * リモート側とローカル側の ahead/behind 数を取得する
 * @param {string} projectPath - プロジェクトパス
 * @param {string} remoteRef - 比較するリモート ref
 * @param {string} localRef - 比較するローカル ref
 * @returns {Promise<Object>} { success, behind, ahead, error }
 */
async function getAheadBehind(projectPath, remoteRef, localRef) {
  const result = await gitExec(['rev-list', '--left-right', '--count', `${remoteRef}...${localRef}`], projectPath)
  if (!result.success) return { success: false, error: result.error }

  const [behindRaw, aheadRaw] = result.stdout.trim().split('\t')
  return {
    success: true,
    behind: behindRaw ? parseInt(behindRaw, 10) : 0,
    ahead: aheadRaw ? parseInt(aheadRaw, 10) : 0
  }
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
    } else {
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
    if (token) {
      const extraHeader = 'Authorization: Basic ' + Buffer.from('x-access-token:' + token).toString('base64')
      const baseArgs = ['-c', 'http.extraHeader=' + extraHeader]

      let pushResult
      const trackResult = await gitExec([...baseArgs, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], projectPath)
      if (!trackResult.success) {
        pushResult = await gitExec([...baseArgs, 'push', '--set-upstream', remote, branch], projectPath)
      } else {
        pushResult = await gitExec([...baseArgs, 'push', remote, branch], projectPath)
      }

      if (!pushResult.success) {
        return { success: false, error: pushResult.error }
      }
      return { success: true }
    } else {
      const pushResult = await gitExec(['push', '--set-upstream', remote, branch], projectPath)
      if (!pushResult.success) return { success: false, error: pushResult.error }
      return { success: true }
    }
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
    if (token) {
      const extraHeader = 'Authorization: Basic ' + Buffer.from('x-access-token:' + token).toString('base64')
      const result = await gitExec(['-c', 'http.extraHeader=' + extraHeader, 'fetch'], projectPath)
      if (!result.success) {
        return { success: false, error: result.error }
      }
      return { success: true }
    } else {
      const result = await gitExec(['fetch'], projectPath)
      if (!result.success) {
        return { success: false, error: result.error }
      }
      return { success: true }
    }
  } catch (error) {
    console.error('[GitManager] fetch error:', error)
    return { success: false, error: error.error || error.message }
  }
}

/**
 * 開発ブランチから本番ブランチへマージ（通常merge方式）
 * @param {string} projectPath - プロジェクトパス
 * @param {string} developBranch - 開発ブランチ名
 * @param {string} productionBranch - 本番ブランチ名
 * @param {string|null} token - GitHubアクセストークン
 * @returns {Promise<Object>} 結果
 */
async function mergeToProduction(projectPath, developBranch, productionBranch, token = null) {
  let originalBranch = null

  try {
    // 1. 元ブランチを記憶
    const branchResult = await gitExec(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath)
    if (branchResult.success) {
      originalBranch = branchResult.stdout.trim()
      // detached HEAD 状態の場合は developBranch へフォールバック
      if (!originalBranch || originalBranch === 'HEAD') {
        originalBranch = developBranch
      }
    } else {
      // 取得失敗時は developBranch へフォールバック
      originalBranch = developBranch
    }

    // 2. 公開前チェック: develop上で、未コミット変更がない状態だけ許可
    if (originalBranch !== developBranch) {
      return { success: false, error: `公開に失敗: 現在のブランチが ${developBranch} ではありません（現在: ${originalBranch}）` }
    }

    const statusResult = await gitExec(['status', '--porcelain', '-u'], projectPath)
    if (!statusResult.success) {
      return { success: false, error: `公開に失敗: 作業ツリー状態の確認に失敗 - ${statusResult.error}` }
    }
    if (statusResult.stdout.trim()) {
      return { success: false, error: '公開に失敗: Gitに未保存の変更があります。先にGit保存してください。' }
    }

    // 3. fetch
    const fetchResult = await fetch(projectPath, token)
    if (!fetchResult.success) {
      return { success: false, error: `公開に失敗: fetch失敗 - ${fetchResult.error}` }
    }

    const localDevelopRef = `refs/heads/${developBranch}`
    const remoteDevelopRef = `refs/remotes/origin/${developBranch}`
    const localProductionRef = `refs/heads/${productionBranch}`
    const remoteProductionRef = `refs/remotes/origin/${productionBranch}`

    const localDevelopExists = await refExists(projectPath, localDevelopRef)
    if (!localDevelopExists) {
      return { success: false, error: `公開に失敗: 開発ブランチ ${developBranch} が存在しません` }
    }

    const remoteDevelopExists = await refExists(projectPath, remoteDevelopRef)
    if (!remoteDevelopExists) {
      return { success: false, error: `公開に失敗: リモートの ${developBranch} が存在しません。先にGit保存してください。` }
    }

    const developSync = await getAheadBehind(projectPath, remoteDevelopRef, localDevelopRef)
    if (!developSync.success) {
      return { success: false, error: `公開に失敗: ${developBranch} の同期状態確認に失敗 - ${developSync.error}` }
    }
    if (developSync.behind > 0) {
      return { success: false, error: `公開に失敗: ${developBranch} がリモートより古いです。先に更新してください。` }
    }
    if (developSync.ahead > 0) {
      return { success: false, error: `公開に失敗: ${developBranch} に未pushのコミットがあります。先にGit保存してください。` }
    }

    const localProductionExists = await refExists(projectPath, localProductionRef)
    const remoteProductionExists = await refExists(projectPath, remoteProductionRef)
    if (!localProductionExists && !remoteProductionExists) {
      return { success: false, error: `公開に失敗: 本番ブランチ ${productionBranch} が存在しません。先に本番ブランチを作成してください。` }
    }

    // 4. checkout production
    let checkoutResult = await checkout(projectPath, productionBranch)
    if (!checkoutResult.success && remoteProductionExists && !localProductionExists) {
      checkoutResult = await gitExec(['checkout', '-b', productionBranch, '--track', `origin/${productionBranch}`], projectPath)
    }
    if (!checkoutResult.success) {
      return { success: false, error: `公開に失敗: checkout失敗 - ${checkoutResult.error}` }
    }

    if (remoteProductionExists) {
      const ffProductionResult = await gitExec(['merge', '--ff-only', `origin/${productionBranch}`], projectPath)
      if (!ffProductionResult.success) {
        return { success: false, error: `公開に失敗: ${productionBranch} をリモート最新へ更新できません - ${ffProductionResult.error}` }
      }
    }

    // 5. merge develop
    const mergeResult = await gitExec(['merge', developBranch], projectPath)
    if (!mergeResult.success) {
      // コンフリクト等で失敗した場合は merge を中止
      await gitExec(['merge', '--abort'], projectPath).catch(() => {
        // abort 自体の失敗は無視
      })
      return { success: false, error: `公開に失敗: merge失敗 - ${mergeResult.error}` }
    }

    // 6. push origin production
    const pushResult = await push(projectPath, productionBranch, 'origin', token)
    if (!pushResult.success) {
      return { success: false, error: `公開に失敗: push失敗 - ${pushResult.error}` }
    }

    return { success: true }
  } catch (error) {
    console.error('[GitManager] mergeToProduction error:', error)
    return { success: false, error: `公開に失敗: ${error.error || error.message}` }
  } finally {
    // 6. 元ブランチへ復帰（必ず実行）
    if (originalBranch) {
      try {
        await checkout(projectPath, originalBranch)
      } catch (err) {
        console.error('[GitManager] Failed to restore original branch:', err)
      }
    }
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
 * プル（同期）
 * @param {string} projectPath - プロジェクトパス
 * @param {string} branch - ブランチ名
 * @param {string|null} token - GitHubアクセストークン
 * @returns {Promise<Object>} 結果
 */
async function pull(projectPath, branch, token = null) {
  try {
    // 1. fetch
    const fetchResult = await fetch(projectPath, token)
    if (!fetchResult.success) {
      return { success: false, error: `同期に失敗: fetch失敗 - ${fetchResult.error}` }
    }

    // 2. behind/ahead カウント取得
    // rev-list --left-right --count origin/branch...HEAD
    // 出力: "<behind>\t<ahead>" (behind=remote側コミット数, ahead=local側コミット数)
    const revListResult = await gitExec(['rev-list', '--left-right', '--count', `origin/${branch}...HEAD`], projectPath)
    if (!revListResult.success) {
      // リモートブランチが存在しない場合など
      return { success: true, upToDate: true, warning: 'リモートブランチが存在しません' }
    }

    const parts = revListResult.stdout.trim().split('\t')
    const behind = parts[0] ? parseInt(parts[0], 10) : 0
    const ahead = parts[1] ? parseInt(parts[1], 10) : 0

    // 3. 分岐判定
    if (behind === 0) {
      // ローカルが最新または先行している場合
      return { success: true, upToDate: true }
    }

    if (ahead === 0) {
      // リモートのみが進んでいる → fast-forward可能
      const ffResult = await gitExec(['merge', '--ff-only', `origin/${branch}`], projectPath)
      if (!ffResult.success) {
        return { success: false, error: `同期に失敗: fast-forward merge失敗 - ${ffResult.error}` }
      }
      return { success: true, fastForwarded: true }
    }

    // ここから先は behind>0 && ahead>0（分岐状態）

    // 4. merge-base を取得
    const baseResult = await gitExec(['merge-base', branch, `origin/${branch}`], projectPath)
    if (!baseResult.success) {
      return { success: false, error: `同期に失敗: merge-base取得失敗 - ${baseResult.error}` }
    }
    const base = baseResult.stdout.trim()

    // 5. 変更ファイルを取得
    const localFilesResult = await gitExec(['diff', '--name-only', `${base}..HEAD`], projectPath)
    const remoteFilesResult = await gitExec(['diff', '--name-only', `${base}..origin/${branch}`], projectPath)

    const localFiles = localFilesResult.success ? localFilesResult.stdout.trim().split('\n').filter(Boolean) : []
    const remoteFiles = remoteFilesResult.success ? remoteFilesResult.stdout.trim().split('\n').filter(Boolean) : []

    // 6. コンフリクトファイルを検出（両側で変更されたファイル）
    const conflictFiles = localFiles.filter(f => remoteFiles.includes(f))

    if (conflictFiles.length === 0) {
      // 別ファイルのみの変更 → 安全にマージ
      const mergeResult = await gitExec(['merge', `origin/${branch}`], projectPath)
      if (!mergeResult.success) {
        // マージ失敗時は中止
        await gitExec(['merge', '--abort'], projectPath).catch(() => {})
        return { success: false, error: `同期に失敗: merge失敗 - ${mergeResult.error}` }
      }
      return { success: true, merged: true }
    }

    // 7. コンフリクトがある場合は通常の3-way mergeを避ける。
    // ファイル完全書き換え原則に従い、merge commitの土台だけ作り、
    // remoteのみの変更は取り込み、両側変更ファイルはUIで local/remote を選択させる。
    const mergeNoCommitResult = await gitExec(['merge', '--no-commit', '--no-ff', '-s', 'ours', `origin/${branch}`], projectPath)
    if (!mergeNoCommitResult.success) {
      // マージ開始失敗時は中止
      await gitExec(['merge', '--abort'], projectPath).catch(() => {})
      return { success: false, error: `同期に失敗: merge開始失敗 - ${mergeNoCommitResult.error}` }
    }

    const localFileSet = new Set(localFiles)
    const remoteOnlyFiles = remoteFiles.filter(f => !localFileSet.has(f))
    for (const file of remoteOnlyFiles) {
      const applyResult = await applyPathFromRef(projectPath, `origin/${branch}`, file)
      if (!applyResult.success) {
        await gitExec(['merge', '--abort'], projectPath).catch(() => {})
        return { success: false, error: `同期に失敗: リモート変更の適用に失敗 - ${file}: ${applyResult.error}` }
      }
    }

    // マージ状態を保持したまま返す（abortしない）
    return { success: true, isConflict: true, conflictFiles }

  } catch (error) {
    console.error('[GitManager] pull error:', error)
    // エラー時はマージ状態をクリーンアップ
    await gitExec(['merge', '--abort'], projectPath).catch(() => {})
    return { success: false, error: `同期に失敗: ${error.error || error.message}` }
  }
}

/**
 * コンフリクト解決（統合関数）
 * @param {string} projectPath - プロジェクトパス
 * @param {string} branch - ブランチ名
 * @param {string} file - ファイルパス
 * @param {string} side - 'local' または 'remote'
 * @returns {Promise<Object>} 結果
 */
async function resolveConflict(projectPath, branch, file, side) {
  try {
    let result
    if (side === 'local') {
      // マージ前のローカル版（HEAD）で上書き
      result = await applyPathFromRef(projectPath, 'HEAD', file)
    } else if (side === 'remote') {
      // リモート版で上書き
      result = await applyPathFromRef(projectPath, `origin/${branch}`, file)
    } else {
      return { success: false, error: `無効なside指定: ${side}` }
    }

    if (!result.success) {
      return { success: false, error: result.error }
    }

    return { success: true }
  } catch (error) {
    console.error('[GitManager] resolveConflict error:', error)
    return { success: false, error: error.error || error.message }
  }
}

/**
 * マージを完了（コミット）
 * @param {string} projectPath - プロジェクトパス
 * @returns {Promise<Object>} 結果
 */
async function completeMerge(projectPath) {
  try {
    const result = await gitExec(['commit', '--no-edit'], projectPath)
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true }
  } catch (error) {
    console.error('[GitManager] completeMerge error:', error)
    return { success: false, error: error.error || error.message }
  }
}

/**
 * マージを中止
 * @param {string} projectPath - プロジェクトパス
 * @returns {Promise<Object>} 結果
 */
async function abortMerge(projectPath) {
  try {
    const result = await gitExec(['merge', '--abort'], projectPath)
    // --abort は成功しても exitCode 1 になることがあるが、マージ状態が解除されれば成功とみなす
    return { success: true }
  } catch (error) {
    console.error('[GitManager] abortMerge error:', error)
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
    productionBranch = 'production',
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

  // productionブランチが存在しない場合は作成してプッシュ
  const prodBranchResult = await gitExec(['rev-parse', '--verify', productionBranch], projectPath)
  if (!prodBranchResult.success) {
    // productionブランチを現在のブランチから作成
    const createProdResult = await gitExec(['branch', productionBranch], projectPath)
    if (!createProdResult.success) {
      return { success: false, error: 'productionブランチの作成に失敗: ' + createProdResult.error }
    }
    const prodPushResult = await push(projectPath, productionBranch, 'origin', token)
    if (!prodPushResult.success) {
      return { success: false, error: 'productionブランチのプッシュに失敗: ' + prodPushResult.error }
    }
  } else {
    // productionブランチが存在する場合はプッシュ確認
    const prodPushResult = await push(projectPath, productionBranch, 'origin', token)
    if (!prodPushResult.success) {
      return { success: false, error: 'productionブランチのプッシュに失敗: ' + prodPushResult.error }
    }
  }

  return { success: true }
}

module.exports = {
  initRepo,
  getStatus,
  commit,
  push,
  fetch,
  pull,
  mergeToProduction,
  exportDist,
  saveGitConfig,
  loadGitConfig,
  setRemote,
  checkout,
  resolveConflict,
  completeMerge,
  abortMerge,
  generateCIFiles
}
