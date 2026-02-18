import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: () => import('../views/HomeView.vue')
        },
        {
            path: '/project',
            name: 'project',
            component: () => import('../views/ProjectView.vue')
        },
        {
            path: '/contents/:type',
            name: 'contents',
            component: () => import('../views/ContentsListView.vue')
        },
        {
            path: '/edit/:type/:slug?',
            name: 'edit',
            component: () => import('../views/EditView.vue')
        },
        {
            path: '/settings',
            name: 'settings',
            component: () => import('../views/SettingsView.vue')
        },
        {
            path: '/error',
            name: 'error',
            component: () => import('../views/ErrorHistoryView.vue')
        },
        {
            path: '/git-settings',
            name: 'git-settings',
            component: () => import('../views/GitSettingsView.vue')
        }
    ]
})

export default router
