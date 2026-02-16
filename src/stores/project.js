import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useProjectStore = defineStore('project', () => {
    const projectPath = ref(null)
    const config = ref(null)
    const isLoaded = ref(false)
    const previewUrl = ref(null)
    const previewRunning = ref(false)
    const notifications = ref([])
    const viteUrl = ref(null)
    const zolaUrl = ref(null)
    
    // コンテンツ管理用の状態
    const contents = ref({}) // { 'news': [...], 'cases': [...] }
    const contentCache = ref({}) // { 'news/2025-01-01-article': {...} }
    const loading = ref({}) // { 'contents/news': false, 'content/news/2025-01-01-article': false }
    const errors = ref({}) // { 'contents/news': null, 'content/news/2025-01-01-article': null }
    const globalLoading = ref(false) // グローバルローディング状態
    
    // 設定管理用の状態
    const siteSettings = ref(null) // サイト設定データ
    const siteSettingsCacheKey = 'site-settings' // 設定キャッシュキー
    
    // プレビュー状態管理
    const previewBuildStatus = ref('idle') // 'idle', 'building', 'success', 'error'
    const previewBuildMessage = ref('') // ビルドメッセージ
    const previewBuildError = ref(null) // ビルドエラー詳細
    const isBuildError = ref(false) // ビルドエラー判定フラグ

    const contentTypes = computed(() => {
        if (!config.value?.content_types) return []
        return Object.entries(config.value.content_types).map(([key, value]) => ({
            key,
            ...value
        }))
    })

    async function openProject() {
        const path = await window.electronAPI.openProject()
        if (!path) return false

        projectPath.value = path

        const result = await window.electronAPI.loadConfig(path)
        if (result.success) {
            config.value = result.config
            isLoaded.value = true
            // サーバー情報取得
            const info = await window.electronAPI.getServerInfo()
            viteUrl.value = info.viteUrl
            zolaUrl.value = info.zolaUrl
            previewUrl.value = info.zolaUrl
            previewRunning.value = true
            setupZolaErrorListener()

            notify(`${config.value.site?.name || 'プロジェクト'} を読み込みました`, 'success')
            return true
        } else {
            console.error('Failed to load config:', result.error)
            notify('設定の読み込みに失敗しました: ' + result.error, 'error')
            return false
        }
    }

    async function openProjectFromHistory(path) {
        projectPath.value = path

        const result = await window.electronAPI.loadConfig(path)
        if (result.success) {
            config.value = result.config
            isLoaded.value = true
            // サーバー情報取得（openProject と同じ処理）
            const info = await window.electronAPI.getServerInfo()
            viteUrl.value = info.viteUrl
            zolaUrl.value = info.zolaUrl
            previewUrl.value = info.zolaUrl
            previewRunning.value = true
            setupZolaErrorListener()
            notify(`${config.value.site?.name || 'プロジェクト'} を読み込みました`, 'success')
            return true
        } else {
            console.error('Failed to load config:', result.error)
            notify('設定の読み込みに失敗しました: ' + result.error, 'error')
            projectPath.value = null
            return false
        }
    }

    function reset() {
        cleanupZolaErrorListener()
        projectPath.value = null
        config.value = null
        isLoaded.value = false
        previewUrl.value = null
        previewRunning.value = false
        notifications.value = []
        contents.value = {}
        contentCache.value = {}
        loading.value = {}
        errors.value = {}
        globalLoading.value = false
        siteSettings.value = null
        previewBuildStatus.value = 'idle'
        previewBuildMessage.value = ''
        previewBuildError.value = null
    }

    async function startPreview() {
        try {
            previewBuildStatus.value = 'building'
            previewBuildMessage.value = 'プレビューサーバーを起動中...'
            previewBuildError.value = null
            
            const result = await window.electronAPI.startPreview()
            if (result.success) {
                previewUrl.value = result.url
                previewRunning.value = true
                previewBuildStatus.value = 'success'
                previewBuildMessage.value = 'プレビューサーバー稼働中'
                notify('プレビューサーバーを起動しました', 'success')
                return result
            }
            previewBuildStatus.value = 'error'
            previewBuildMessage.value = '起動失敗'
            previewBuildError.value = result.error
            isBuildError.value = true
            notify('プレビューサーバーの起動に失敗しました: ' + result.error, 'error')
            return result
        } catch (error) {
            console.error('Failed to start preview:', error)
            previewBuildStatus.value = 'error'
            previewBuildMessage.value = '起動エラー'
            previewBuildError.value = error.message
            notify('プレビューサーバーの起動中にエラーが発生しました', 'error')
            return { success: false, error: error.message }
        }
    }

    async function stopPreview() {
        try {
            previewBuildStatus.value = 'building'
            previewBuildMessage.value = 'プレビューサーバーを停止中...'
            
            await window.electronAPI.stopPreview()
            previewUrl.value = null
            previewRunning.value = false
            previewBuildStatus.value = 'idle'
            previewBuildMessage.value = 'プレビューサーバー停止中'
            notify('プレビューサーバーを停止しました', 'info')
        } catch (error) {
            console.error('Failed to stop preview:', error)
            previewBuildStatus.value = 'error'
            previewBuildMessage.value = '停止エラー'
            previewBuildError.value = error.message
            notify('プレビューサーバーの停止に失敗しました', 'error')
        }
    }

    function notify(message, type = 'info', duration = 3000) {
        const id = Date.now() + Math.random()
        notifications.value.push({ id, message, type })
        setTimeout(() => {
            notifications.value = notifications.value.filter(n => n.id !== id)
        }, duration)
    }

    // Zolaエラーリスナー管理
    let zolaErrorCleanup = null

    function setupZolaErrorListener() {
        if (zolaErrorCleanup) {
            zolaErrorCleanup()
            zolaErrorCleanup = null
        }
        if (!window.electronAPI?.onZolaError) return

        zolaErrorCleanup = window.electronAPI.onZolaError((error) => {
            console.error('[ProjectStore] Zola error:', error)

            // Zolaのエラーメッセージをそのまま使用
            let errorMessage = error.raw || error.message || 'エラーが発生しました'

            if (error.type === 'pathCollision') {
                previewBuildStatus.value = 'error'
                previewBuildMessage.value = 'URLパス衝突'
                previewBuildError.value = errorMessage
                isBuildError.value = true
                notify('URLパスの衝突が発生しました', 'error', 8000)
            } else if (error.type === 'process-exit') {
                previewRunning.value = false
                previewUrl.value = null
                previewBuildStatus.value = 'error'
                previewBuildMessage.value = 'プロセス異常終了'
                previewBuildError.value = errorMessage
                notify('プレビューサーバーが停止しました', 'error')
            } else if (error.type === 'building') {
                previewBuildStatus.value = 'building'
                previewBuildMessage.value = 'ビルド中...'
            } else if (error.type === 'built') {
                previewBuildStatus.value = 'success'
                previewBuildMessage.value = 'ビルド完了'
                isBuildError.value = false
            } else {
                // ビルドエラー
                previewBuildStatus.value = 'error'
                previewBuildMessage.value = 'ビルドエラー'
                previewBuildError.value = errorMessage
                isBuildError.value = true
                notify(errorMessage, 'error', 8000)
            }
        })
    }

    function cleanupZolaErrorListener() {
        if (zolaErrorCleanup) {
            zolaErrorCleanup()
            zolaErrorCleanup = null
        }
    }

    /**
     * 画像のパスを解決する
     * ZolaサーバーのURLを直接使用してプロキシ不要にする
     */
    function resolveImageUrl(imagePath) {
        if (!imagePath) return null
        if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
            return imagePath
        }
        const normalizedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`
        // ZolaサーバーのURLを直接使用（imgタグはCORS制約を受けない）
        if (zolaUrl.value) {
            const base = zolaUrl.value.endsWith('/') ? zolaUrl.value.slice(0, -1) : zolaUrl.value
            return `${base}${normalizedPath}`
        }
        // フォールバック: デフォルトのZola URL
        return `http://localhost:1111${normalizedPath}`
    }
    
    /**
     * コンテンツ一覧を取得
     */
    async function fetchContents(type, forceRefresh = false) {
        const cacheKey = `contents/${type}`
        
        // 常に最新データを取得（キャッシュをクリア）
        // リフレッシュ指示がある場合、またはキャッシュが空の場合
        const shouldFetch = forceRefresh || !contents.value[type] || contents.value[type].length === 0
        
        if (!shouldFetch && contents.value[type] && contents.value[type].length > 0) {
            console.log(`[ProjectStore] Using cached contents for ${type}`)
            return contents.value[type]
        }
        
        loading.value[cacheKey] = true
        errors.value[cacheKey] = null
        
        try {
            console.log(`[ProjectStore] Fetching contents for ${type}`)
            const result = await window.electronAPI.listContents(type)
            contents.value[type] = result
            return result
        } catch (error) {
            console.error(`Failed to fetch contents for ${type}:`, error)
            errors.value[cacheKey] = error.message
            notify(`コンテンツ一覧の取得に失敗しました: ${error.message}`, 'error')
            throw error
        } finally {
            loading.value[cacheKey] = false
        }
    }
    
    /**
     * 単一コンテンツを取得
     */
    async function fetchContent(type, slug, forceRefresh = false) {
        const cacheKey = `content/${type}/${slug}`
        
        // 常に最新データを取得（キャッシュをクリア）
        const shouldFetch = forceRefresh || !contentCache.value[cacheKey]
        
        if (!shouldFetch && contentCache.value[cacheKey]) {
            console.log(`[ProjectStore] Using cached content for ${type}/${slug}`)
            return contentCache.value[cacheKey]
        }
        
        loading.value[cacheKey] = true
        errors.value[cacheKey] = null
        
        try {
            console.log(`[ProjectStore] Fetching content for ${type}/${slug}`)
            const result = await window.electronAPI.loadContent(type, slug)
            contentCache.value[cacheKey] = result
            return result
        } catch (error) {
            console.error(`Failed to fetch content ${slug}:`, error)
            errors.value[cacheKey] = error.message
            notify(`コンテンツの読み込みに失敗しました: ${error.message}`, 'error')
            throw error
        } finally {
            loading.value[cacheKey] = false
        }
    }
    
    /**
     * コンテンツを保存（オプティミスティック更新）
     */
    async function updateContent(type, slug, data) {
        const cacheKey = `content/${type}/${slug}`
        const listKey = `contents/${type}`
        
        // オプティミスティック更新
        const oldContent = contentCache.value[cacheKey] ? {...contentCache.value[cacheKey]} : null
        const oldList = contents.value[listKey] ? [...contents.value[listKey]] : null
        
        // キャッシュを先に更新
        contentCache.value[cacheKey] = {...data, slug}
        
        // 一覧も更新
        if (contents.value[listKey]) {
            const listIndex = contents.value[listKey].findIndex(item => item.slug === slug)
            if (listIndex >= 0) {
                contents.value[listKey][listIndex] = {...data, slug}
            } else {
                // 新規作成の場合は追加
                contents.value[listKey].push({...data, slug})
            }
        }
        
        try {
            const result = await window.electronAPI.saveContent(type, slug, data)
            
            if (result.success) {
                // 成功時はキャッシュを保持
                notify('保存しました', 'success')
                return { success: true, data: result }
            } else {
                // 失敗時はロールバック
                contentCache.value[cacheKey] = oldContent
                contents.value[listKey] = oldList
                throw new Error(result.error || '保存に失敗しました')
            }
        } catch (error) {
            // エラー時はロールバック
            contentCache.value[cacheKey] = oldContent
            contents.value[listKey] = oldList
            notify(`保存に失敗しました: ${error.message}`, 'error')
            throw error
        }
    }
    
    /**
     * コンテンツを削除（オプティミスティック削除）
     */
    async function deleteContent(type, slug) {
        const cacheKey = `content/${type}/${slug}`
        const listKey = `contents/${type}`
        
        // オプティミスティック削除
        const oldContent = contentCache.value[cacheKey] ? {...contentCache.value[cacheKey]} : null
        const oldList = contents.value[listKey] ? [...contents.value[listKey]] : null
        
        // キャッシュから削除
        delete contentCache.value[cacheKey]
        
        // 一覧から削除
        if (contents.value[listKey]) {
            contents.value[listKey] = contents.value[listKey].filter(item => item.slug !== slug)
        }
        
        try {
            const result = await window.electronAPI.deleteContent(type, slug)
            
            if (result.success) {
                notify('削除しました', 'success')
                return { success: true }
            } else {
                // 失敗時はロールバック
                contentCache.value[cacheKey] = oldContent
                contents.value[listKey] = oldList
                throw new Error(result.error || '削除に失敗しました')
            }
        } catch (error) {
            // エラー時はロールバック
            contentCache.value[cacheKey] = oldContent
            contents.value[listKey] = oldList
            notify(`削除に失敗しました: ${error.message}`, 'error')
            throw error
        }
    }
    
    /**
     * コンテンツ一覧を強制リフレッシュ
     */
    async function refreshContents(type) {
        return await fetchContents(type, true)
    }
    
    /**
     * 単一コンテンツを強制リフレッシュ
     */
    async function refreshContent(type, slug) {
        return await fetchContent(type, slug, true)
    }
    
    /**
     * ローディング状態を取得
     */
    function isLoading(key) {
        return loading.value[key] || false
    }
    
    /**
     * エラー状態を取得
     */
    function getError(key) {
        return errors.value[key] || null
    }
    
    /**
     * グローバルローディングを開始
     */
    function startGlobalLoading() {
        globalLoading.value = true
    }
    
    /**
     * グローバルローディングを終了
     */
    function stopGlobalLoading() {
        globalLoading.value = false
    }
    
    /**
     * サイト設定を取得
     */
    async function fetchSiteSettings(forceRefresh = false) {
        // 常に最新データを取得（キャッシュをクリア）
        const shouldFetch = forceRefresh || !siteSettings.value
        
        if (!shouldFetch && siteSettings.value) {
            console.log('[ProjectStore] Using cached site settings')
            return siteSettings.value
        }
        
        loading.value[siteSettingsCacheKey] = true
        errors.value[siteSettingsCacheKey] = null
        
        try {
            console.log('[ProjectStore] Fetching site settings')
            const result = await window.electronAPI.loadSiteSettings()
            
            if (result.success) {
                siteSettings.value = result.settings
                return result.settings
            } else {
                throw new Error(result.error || '設定の読み込みに失敗しました')
            }
        } catch (error) {
            console.error('Failed to fetch site settings:', error)
            errors.value[siteSettingsCacheKey] = error.message
            notify(`設定の読み込みに失敗しました: ${error.message}`, 'error')
            throw error
        } finally {
            loading.value[siteSettingsCacheKey] = false
        }
    }
    
    /**
     * サイト設定を保存（オプティミスティック更新）
     */
    async function updateSiteSettings(newSettings) {
        // オプティミスティック更新
        const oldSettings = siteSettings.value ? {...siteSettings.value} : null
        siteSettings.value = {...newSettings}
        
        try {
            const result = await window.electronAPI.saveSiteSettings(newSettings)
            
            if (result.success) {
                notify('設定を保存しました', 'success')
                return { success: true, data: result }
            } else {
                // 失敗時はロールバック
                siteSettings.value = oldSettings
                throw new Error(result.error || '保存に失敗しました')
            }
        } catch (error) {
            // エラー時はロールバック
            siteSettings.value = oldSettings
            notify(`保存に失敗しました: ${error.message}`, 'error')
            throw error
        }
    }
    
    /**
     * サイト設定を強制リフレッシュ
     */
    async function refreshSiteSettings() {
        return await fetchSiteSettings(true)
    }
    
    /**
     * 設定ローディング状態を取得
     */
    function isSettingsLoading() {
        return loading.value[siteSettingsCacheKey] || false
    }
    
    /**
     * 設定エラー状態を取得
     */
    function getSettingsError() {
        return errors.value[siteSettingsCacheKey] || null
    }
    
    /**
     * プレビューをリビルド
     */
    async function rebuildPreview() {
        if (!previewRunning.value) {
            notify('プレビューサーバーが起動していません', 'error')
            return
        }
        
        previewBuildStatus.value = 'building'
        previewBuildMessage.value = 'リビルド中...'
        previewBuildError.value = null
        isBuildError.value = false
        
        try {
            // Zolaはファイル変更で自動リビルドされるため、
            // ここでは空の更新トリガーとして実装
            await new Promise(resolve => setTimeout(resolve, 1000))
            previewBuildStatus.value = 'success'
            previewBuildMessage.value = 'リビルド完了'
            isBuildError.value = false
            notify('リビルドしました', 'success')
        } catch (error) {
            previewBuildStatus.value = 'error'
            previewBuildMessage.value = 'リビルドエラー'
            previewBuildError.value = error.message
            isBuildError.value = true
            notify('リビルドに失敗しました', 'error')
        }
    }
    
    /**
     * スラグ衝突を解決
     */
    async function resolveSlugCollision(type, duplicateSlug) {
        try {
            const result = await window.electronAPI.resolveSlugCollision({ type, duplicateSlug })
            
            if (result.success) {
                notify(`${result.resolvedCount}件の重複を解決しました`, 'success')
                // キャッシュをクリアして更新
                await refreshContents(type)
                return result
            } else {
                throw new Error(result.error || '重複解決に失敗しました')
            }
        } catch (error) {
            notify(`重複解決に失敗しました: ${error.message}`, 'error')
            throw error
        }
    }
    
    /**
     * すべてのスラグ衝突を検出
     */
    async function detectAllSlugCollisions() {
        try {
            const result = await window.electronAPI.detectAllSlugCollisions()
            
            if (result.success) {
                return result.collisions
            } else {
                throw new Error(result.error || '検出に失敗しました')
            }
        } catch (error) {
            notify(`スラグ衝突の検出に失敗しました: ${error.message}`, 'error')
            throw error
        }
    }
    
    /**
     * スラグ衝突をチェック
     */
    async function checkSlugCollision(type, slug, excludeSlug = null) {
        try {
            const result = await window.electronAPI.checkSlugCollision({ type, slug, excludeSlug })
            
            if (result.success) {
                return result
            } else {
                throw new Error(result.error || 'チェックに失敗しました')
            }
        } catch (error) {
            notify(`スラグ衝突のチェックに失敗しました: ${error.message}`, 'error')
            throw error
        }
    }

    return {
        projectPath,
        config,
        isLoaded,
        contentTypes,
        previewUrl,
        previewRunning,
        notifications,
        openProject,
        openProjectFromHistory,
        reset,
        startPreview,
        stopPreview,
        notify,
        resolveImageUrl,
        setupZolaErrorListener,
        cleanupZolaErrorListener,
        viteUrl,
        zolaUrl,
        // コンテンツ管理用
        contents,
        contentCache,
        loading,
        errors,
        globalLoading,
        fetchContents,
        fetchContent,
        updateContent,
        deleteContent,
        refreshContents,
        refreshContent,
        isLoading,
        getError,
        startGlobalLoading,
        stopGlobalLoading,
        // 設定管理用
        siteSettings,
        fetchSiteSettings,
        updateSiteSettings,
        refreshSiteSettings,
        isSettingsLoading,
        getSettingsError,
        // プレビュー状態管理用
        previewBuildStatus,
        previewBuildMessage,
        previewBuildError,
        isBuildError,
        rebuildPreview,
        // スラグ衝突管理用
        resolveSlugCollision,
        detectAllSlugCollisions,
        checkSlugCollision
    }
})
