import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useProjectStore = defineStore('project', () => {
    const projectPath = ref(null)
    const config = ref(null)
    const isLoaded = ref(false)

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
            return true
        } else {
            console.error('Failed to load config:', result.error)
            return false
        }
    }

    function reset() {
        projectPath.value = null
        config.value = null
        isLoaded.value = false
    }

    return {
        projectPath,
        config,
        isLoaded,
        contentTypes,
        openProject,
        reset
    }
})
