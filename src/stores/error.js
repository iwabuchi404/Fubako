import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// エラーパターン定義
const errorPatterns = [
  // パス衝突
  {
    type: 'path-collision',
    pattern: /path collision|collision|パス.*衝突/i,
    summary: 'URLパスの衝突',
    details: '同じURLパスを持つページが複数存在します',
    severity: 'high'
  },
  // プロセス異常終了
  {
    type: 'process-exit',
    pattern: /process.*exited|exited with code/i,
    summary: 'プレビューサーバーが停止しました',
    details: 'プロセスが異常終了しました。プレビューを再起動してください',
    severity: 'high'
  },
  // Frontmatter解析エラー
  {
    type: 'parse-error',
    pattern: /failed to parse|parse error|TOML.*error|frontmatter/i,
    summary: 'Frontmatterの解析エラー',
    details: 'Markdownファイルの先頭設定にエラーがあります',
    severity: 'high'
  },
  // ビルドエラー（一般的）
  {
    type: 'build-error',
    pattern: /build.*error|compilation error|building error/i,
    summary: 'ビルドエラーが発生しました',
    details: 'Zolaのビルド中にエラーが発生しました。詳細を確認してください',
    severity: 'high'
  },
  // 設定エラー
  {
    type: 'config-error',
    pattern: /config.*error|toml.*error|configuration/i,
    summary: '設定ファイルのエラー',
    details: 'config.tomlまたは設定ファイルにエラーがあります',
    severity: 'high'
  },
  // ファイルエラー
  {
    type: 'file-error',
    pattern: /file.*not found|no such file|ENOENT/i,
    summary: 'ファイルが見つかりません',
    details: '必要なファイルが見つかりません',
    severity: 'medium'
  },
  // テンプレートエラー
  {
    type: 'template-error',
    pattern: /template.*error|tera.*error|failed to render/i,
    summary: 'テンプレートエラー',
    details: 'テンプレートのレンダリングに失敗しました',
    severity: 'high'
  },
  // ネットワークエラー
  {
    type: 'network-error',
    pattern: /network|ECONNREFUSED|connection refused/i,
    summary: 'ネットワークエラー',
    details: 'サーバーへの接続に失敗しました',
    severity: 'medium'
  },
  // 権限エラー
  {
    type: 'permission-error',
    pattern: /permission|EACCES|EPERM/i,
    summary: '権限エラー',
    details: 'ファイルやディレクトリへのアクセス権限がありません',
    severity: 'medium'
  }
]

// デフォルトエラー情報（パターンにマッチしない場合）
const defaultErrorInfo = {
  summary: 'エラーが発生しました',
  details: '詳細なエラーメッセージを確認してください',
  type: 'unknown',
  severity: 'medium'
}

/**
 * 生エラーメッセージからエラー情報をパースする
 * @param {string} rawError - 生のエラーメッセージ
 * @param {string} knownType - 既知のエラータイプ（ある場合）
 * @returns {Object} エラー情報 { type, summary, details, severity }
 */
export function parseError(rawError, knownType = null) {
  const errorText = String(rawError || '')

  // 既知のタイプがある場合、対応するパターンを探す
  if (knownType) {
    const patternInfo = errorPatterns.find(p => p.type === knownType)
    if (patternInfo) {
      return {
        type: patternInfo.type,
        summary: patternInfo.summary,
        details: patternInfo.details,
        severity: patternInfo.severity
      }
    }
  }

  // パターンマッチング
  for (const patternInfo of errorPatterns) {
    if (patternInfo.pattern.test(errorText)) {
      return {
        type: patternInfo.type,
        summary: patternInfo.summary,
        details: patternInfo.details,
        severity: patternInfo.severity
      }
    }
  }

  // マッチしない場合、デフォルトを返す
  return { ...defaultErrorInfo }
}

export const useErrorStore = defineStore('error', () => {
  // エラーリスト
  const errors = ref([])

  // アクティブなエラー
  const activeErrors = computed(() => {
    return errors.value.filter(e => e.status === 'active')
  })

  // 解消済みエラー
  const resolvedErrors = computed(() => {
    return errors.value.filter(e => e.status !== 'active')
  })

  // アクティブなエラー数（ヘッダーインジケーター用）
  const activeErrorCount = computed(() => activeErrors.value.length)

  /**
   * エラーを追加する
   * @param {Object} errorData
   * @param {string} errorData.type - エラー種類
   * @param {string} errorData.summary - 1行表示用サマリ（日本語）
   * @param {string} errorData.details - 詳細（日本語）
   * @param {string} errorData.rawError - 生のエラーメッセージ
   * @param {string} errorData.severity - 重要度（将来用: 'low' | 'medium' | 'high'）
   * @param {Array} errorData.actions - アクションボタン [{ label, handler }]
   * @returns {string} エラーID
   */
  function addError(errorData) {
    const id = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    errors.value.push({
      id,
      type: errorData.type || 'unknown',
      summary: errorData.summary || 'エラーが発生しました',
      details: errorData.details || '',
      rawError: errorData.rawError || '',
      severity: errorData.severity || 'medium', // 将来用
      actions: errorData.actions || [],
      status: 'active',
      createdAt: new Date().toISOString()
    })
    return id
  }

  /**
   * エラーを削除（無視）する
   * @param {string} id - エラーID
   */
  function dismissError(id) {
    const error = errors.value.find(e => e.id === id)
    if (error) {
      error.status = 'dismissed'
      error.dismissedAt = new Date().toISOString()
    }
  }

  /**
   * エラーを解消する
   * @param {string} id - エラーID
   */
  function resolveError(id) {
    const error = errors.value.find(e => e.id === id)
    if (error) {
      error.status = 'resolved'
      error.resolvedAt = new Date().toISOString()
    }
  }

  /**
   * エラー種類で解消する（ビルド成功時など）
   * @param {string} type - エラー種類
   */
  function resolveErrorsByType(type) {
    errors.value.forEach(error => {
      if (error.type === type && error.status === 'active') {
        error.status = 'resolved'
        error.resolvedAt = new Date().toISOString()
      }
    })
  }

  /**
   * すべてのエラーをクリアする
   */
  function clearErrors() {
    errors.value = []
  }

  /**
   * アクティブエラーのみをクリアする
   */
  function clearActiveErrors() {
    errors.value = errors.value.filter(e => e.status !== 'active')
  }

  return {
    errors,
    activeErrors,
    resolvedErrors,
    activeErrorCount,
    addError,
    dismissError,
    resolveError,
    resolveErrorsByType,
    clearErrors,
    clearActiveErrors
  }
})
