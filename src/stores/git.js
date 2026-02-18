import { defineStore } from 'pinia'
import { ref, computed, onMounted, onUnmounted } from 'vue'

export const useGitStore = defineStore('git', () => {
  // Git設定
  const gitConfig = ref(null)

  // Gitステータス
  const isGitEnabled = ref(false)
  const isRepo = ref(false)
  const currentBranch = ref(null)
  const hasUncommittedChanges = ref(false)
  const files = ref([])
  const isAheadOfRemote = ref(false)
  const isBehindRemote = ref(false)
  const hasRemoteUpdates = ref(false)
  const hasRemote = ref(false)

  // ローディング状態
  const loading = ref({
    status: false,
    commit: false,
    push: false,
    fetch: false,
    merge: false,
    export: false,
    init: false
  })

  // 設定
  const settings = ref({
    developBranch: 'develop',
    productionBranch: 'production'
  })

  // 定期フェッチ用
  let fetchInterval = null
  const FETCH_INTERVAL = 3 * 60 * 1000 // 3分

  // 計算プロパティ
  const canSave = computed(() => isGitEnabled.value && (hasUncommittedChanges.value || isAheadOfRemote.value))
  const canPublish = computed(() => isGitEnabled.value && currentBranch.value === settings.value.developBranch)
  const canFetch = computed(() => isGitEnabled.value && hasRemote.value)
  const hasConflicts = computed(() => files.value.some(f => f.inConflict))

  /**
   * リポジトリ初期化
   */
  async function initRepo(projectPath) {
    if (!projectPath) return

    loading.value.init = true
    try {
      const developBranch = settings.value.developBranch || 'develop'
      const result = await window.electronAPI.gitInit(projectPath, developBranch)
      if (result.success) {
        // 初期化成功後、自動的にGit有効化
        await saveConfig(projectPath, { enabled: true })
        await getStatus(projectPath)
      }
      return result
    } catch (error) {
      console.error('Failed to init repo:', error)
      return { success: false, error: error.message }
    } finally {
      loading.value.init = false
    }
  }

  /**
   * Git設定をロード
   */
  async function loadConfig(projectPath) {
    if (!projectPath) return

    const result = await window.electronAPI.loadGitConfig(projectPath)
    if (result.success && result.config) {
      gitConfig.value = result.config
      isGitEnabled.value = result.config.enabled || false
      settings.value = {
        developBranch: result.config.developBranch || 'develop',
        productionBranch: result.config.productionBranch || 'production'
      }

      // Gitが有効な場合、ステータス取得と定期フェッチ開始
      if (result.config.enabled) {
        await getStatus(projectPath)

        // 開発ブランチ以外にいる場合は自動で切り替え
        const developBranch = result.config.developBranch || 'develop'
        if (isRepo.value && currentBranch.value && currentBranch.value !== developBranch) {
          console.log(`[GitStore] Auto-switching from ${currentBranch.value} to ${developBranch}`)
          const checkoutResult = await window.electronAPI.gitCheckout(projectPath, developBranch)
          if (checkoutResult.success) {
            await getStatus(projectPath)
          } else {
            console.warn('[GitStore] Auto-checkout failed:', checkoutResult.error)
          }
        }

        startAutoFetch(projectPath)
      }
    }
  }

  /**
   * Git設定を保存
   */
  async function saveConfig(projectPath, config) {
    if (!projectPath) return

    loading.value.config = true
    try {
      const result = await window.electronAPI.saveGitConfig(projectPath, {
        ...gitConfig.value,
        ...config
      })
      if (result.success) {
        gitConfig.value = {
          ...gitConfig.value,
          ...config
        }
        isGitEnabled.value = config.enabled || false
        settings.value = {
          developBranch: config.developBranch || 'develop',
          productionBranch: config.productionBranch || 'production'
        }

        // Gitが無効になった場合、定期フェッチを停止
        if (!config.enabled) {
          stopAutoFetch()
        } else if (config.enabled && !gitConfig.value?.enabled) {
          // Gitが有効になった場合、ステータス取得と定期フェッチ開始
          await getStatus(projectPath)
          startAutoFetch(projectPath)
        }
      }
    } catch (error) {
      console.error('Failed to save Git config:', error)
    } finally {
      loading.value.config = false
    }
  }

  /**
   * Gitステータスを取得
   */
  async function getStatus(projectPath) {
    if (!projectPath || !isGitEnabled.value) return

    loading.value.status = true
    try {
      const result = await window.electronAPI.getGitStatus(projectPath)
      if (result.success) {
        isRepo.value = result.isRepo
        currentBranch.value = result.currentBranch
        hasUncommittedChanges.value = result.hasUncommittedChanges
        files.value = result.files
        isAheadOfRemote.value = result.isAheadOfRemote
        isBehindRemote.value = result.isBehindRemote
        hasRemoteUpdates.value = result.hasRemoteUpdates
        hasRemote.value = result.hasRemote
      }
    } catch (error) {
      console.error('Failed to get Git status:', error)
    } finally {
      loading.value.status = false
    }
  }

  /**
   * コミット
   */
  async function commit(projectPath, message) {
    if (!projectPath) return

    loading.value.commit = true
    try {
      const result = await window.electronAPI.gitCommit(projectPath, message)
      if (result.success) {
        await getStatus(projectPath)
      }
      return result
    } catch (error) {
      console.error('Failed to commit:', error)
      return { success: false, error: error.message }
    } finally {
      loading.value.commit = false
    }
  }

  /**
   * プッシュ
   */
  async function push(projectPath) {
    if (!projectPath || !currentBranch.value) return

    loading.value.push = true
    try {
      const result = await window.electronAPI.gitPush(projectPath, currentBranch.value)
      if (result.success) {
        await getStatus(projectPath)
      }
      return result
    } catch (error) {
      console.error('Failed to push:', error)
      return { success: false, error: error.message }
    } finally {
      loading.value.push = false
    }
  }

  /**
   * フェッチ
   */
  async function fetch(projectPath) {
    if (!projectPath) return

    loading.value.fetch = true
    try {
      const result = await window.electronAPI.gitFetch(projectPath)
      if (result.success) {
        await getStatus(projectPath)
      }
      return result
    } catch (error) {
      console.error('Failed to fetch:', error)
      return { success: false, error: error.message }
    } finally {
      loading.value.fetch = false
    }
  }

  /**
   * 開発ブランチから本番ブランチへマージ
   */
  async function mergeToProduction(projectPath) {
    if (!projectPath) return

    loading.value.merge = true
    try {
      const result = await window.electronAPI.gitMergeToProduction(
        projectPath,
        settings.value.developBranch,
        settings.value.productionBranch
      )
      if (result.success) {
        // バックエンドがpushとブランチ切り替えを行うため、ステータスを更新するだけ
        await getStatus(projectPath)
      }
      return result
    } catch (error) {
      console.error('Failed to merge:', error)
      return { success: false, error: error.message }
    } finally {
      loading.value.merge = false
    }
  }

  /**
   * エクスポート
   */
  async function exportDist(projectPath) {
    if (!projectPath) return

    loading.value.export = true
    try {
      const result = await window.electronAPI.gitExportDist(projectPath)
      return result
    } catch (error) {
      console.error('Failed to export:', error)
      return { success: false, error: error.message }
    } finally {
      loading.value.export = false
    }
  }

  /**
   * コンフリクト解消（手元優先）
   */
  async function resolveConflictLocal(projectPath, filePath) {
    if (!projectPath) return

    const result = await window.electronAPI.gitResolveConflictLocal(projectPath, filePath)
    if (result.success) {
      await getStatus(projectPath)
    }
    return result
  }

  /**
   * コンフリクト解消（リモート優先）
   */
  async function resolveConflictRemote(projectPath, filePath) {
    if (!projectPath) return

    const result = await window.electronAPI.gitResolveConflictRemote(projectPath, filePath)
    if (result.success) {
      await getStatus(projectPath)
    }
    return result
  }

  /**
   * 定期フェッチを開始
   */
  function startAutoFetch(projectPath) {
    if (fetchInterval) {
      clearInterval(fetchInterval)
    }

    if (!isGitEnabled.value || !projectPath) return

    fetchInterval = setInterval(() => {
      fetch(projectPath)
    }, FETCH_INTERVAL)
  }

  /**
   * 定期フェッチを停止
   */
  function stopAutoFetch() {
    if (fetchInterval) {
      clearInterval(fetchInterval)
      fetchInterval = null
    }
  }

  // マウント時に定期フェッチを開始
  onMounted(() => {
    // ここではprojectPathがないので、loadConfig呼び出し時に開始
  })

  // アンマウント時に定期フェッチを停止
  onUnmounted(() => {
    stopAutoFetch()
  })

  return {
    // Git設定
    gitConfig,
    settings,

    // Gitステータス
    isGitEnabled,
    isRepo,
    currentBranch,
    hasUncommittedChanges,
    files,
    isAheadOfRemote,
    isBehindRemote,
    hasRemoteUpdates,
    hasRemote,

    // ローディング
    loading,

    // 計算プロパティ
    canSave,
    canPublish,
    canFetch,
    hasConflicts,

    // アクション
    initRepo,
    loadConfig,
    saveConfig,
    getStatus,
    commit,
    push,
    fetch,
    mergeToProduction,
    exportDist,
    resolveConflictLocal,
    resolveConflictRemote,
    startAutoFetch,
    stopAutoFetch
  }
})
