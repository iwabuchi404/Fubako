import { createI18n } from 'vue-i18n'
import ja from './locales/ja.json'
import en from './locales/en.json'

// デフォルト言語の取得（将来的にlocalStorageなどから取得可能）
const savedLocale = localStorage.getItem('fubako-locale') || 'ja'

const i18n = createI18n({
    legacy: false, // Vue 3 Composition API style
    locale: savedLocale,
    fallbackLocale: 'en',
    messages: {
        ja,
        en
    }
})

export default i18n
