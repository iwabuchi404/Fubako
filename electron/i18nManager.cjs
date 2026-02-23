const fs = require('fs');
const path = require('path');

class I18nManager {
    constructor() {
        this.locales = {};
        this.currentLocale = 'ja';
        this.loadLocales();
    }

    loadLocales() {
        // Rendererプロセスのソースディレクトリにあるlocaleファイルを読み込む
        // electron/ フォルダから見て ../src/locales/
        const localesDir = path.join(__dirname, '../src/locales');
        const files = fs.readdirSync(localesDir);

        files.forEach(file => {
            if (file.endsWith('.json')) {
                const lang = path.basename(file, '.json');
                const content = fs.readFileSync(path.join(localesDir, file), 'utf8');
                this.locales[lang] = JSON.parse(content);
            }
        });
    }

    setLocale(locale) {
        if (this.locales[locale]) {
            this.currentLocale = locale;
        }
    }

    t(key, params = {}) {
        const keys = key.split('.');
        let result = this.locales[this.currentLocale];

        for (const k of keys) {
            if (result && result[k]) {
                result = result[k];
            } else {
                return key; // 見つからない場合はキーを返す
            }
        }

        // パラメータ置換 (例: {name} -> params.name)
        if (typeof result === 'string') {
            Object.keys(params).forEach(p => {
                result = result.replace(`{${p}}`, params[p]);
            });
        }

        return result;
    }
}

module.exports = new I18nManager();
