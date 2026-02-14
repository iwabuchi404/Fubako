import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useProjectStore = defineStore('project', () => {
    const projectPath = ref(null)
    const config = ref(null)
    const isLoaded = ref(false)
    const previewUrl = ref(null)
    const previewRunning = ref(false)
    const notifications = ref([])

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
        projectPath.value = null
        config.value = null
        isLoaded.value = false
        previewUrl.value = null
        previewRunning.value = false
        notifications.value = []
    }

    async function startPreview() {
        try {
            const result = await window.electronAPI.startPreview()
            if (result.success) {
                previewUrl.value = result.url
                previewRunning.value = true
                notify('プレビューサーバーを起動しました', 'success')
                return result
            }
            notify('プレビューサーバーの起動に失敗しました: ' + result.error, 'error')
            return result
        } catch (error) {
            console.error('Failed to start preview:', error)
            notify('プレビューサーバーの起動中にエラーが発生しました', 'error')
            return { success: false, error: error.message }
        }
    }

    async function stopPreview() {
        try {
            await window.electronAPI.stopPreview()
            previewUrl.value = null
            previewRunning.value = false
            notify('プレビューサーバーを停止しました', 'info')
        } catch (error) {
            console.error('Failed to stop preview:', error)
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
        notify
    }
})
