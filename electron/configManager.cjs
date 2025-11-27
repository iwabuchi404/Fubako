const fs = require('fs');
const path = require('path');
const toml = require('@iarna/toml');

/**
 * ネストされたキー（"extra.company_name"）から値を取得
 * @param {Object} obj - TOMLオブジェクト
 * @param {string} key - ドット区切りのキー
 * @returns {any} 値
 */
function getNestedValue(obj, key) {
    const keys = key.split('.');
    let value = obj;
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return undefined;
        }
    }
    return value;
}

/**
 * ネストされたキー（"extra.company_name"）に値を設定
 * @param {Object} obj - TOMLオブジェクト
 * @param {string} key - ドット区切りのキー
 * @param {any} value - 設定する値
 */
function setNestedValue(obj, key, value) {
    const keys = key.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!(k in current) || typeof current[k] !== 'object') {
            current[k] = {};
        }
        current = current[k];
    }

    current[keys[keys.length - 1]] = value;
}

/**
 * サイト設定を読み込む
 * @param {string} projectPath - プロジェクトパス
 * @param {Object} siteConfig - site-config.ymlの内容
 * @returns {Promise<Object>} 設定値のオブジェクト
 */
async function loadSiteSettings(projectPath, siteConfig) {
    if (!siteConfig.site_settings) {
        throw new Error('site_settings が site-config.yml に定義されていません');
    }

    const targetFile = siteConfig.site_settings.target_file;
    const configPath = path.join(projectPath, targetFile);

    if (!fs.existsSync(configPath)) {
        throw new Error(`設定ファイルが見つかりません: ${targetFile}`);
    }

    const configContent = fs.readFileSync(configPath, 'utf-8');
    const configData = toml.parse(configContent);

    // 各フィールドの値を取得
    const settings = {};
    for (const group of siteConfig.site_settings.groups) {
        for (const field of group.fields) {
            const value = getNestedValue(configData, field.key);
            settings[field.key] = value !== undefined ? value : '';
        }
    }

    return settings;
}

/**
 * サイト設定を保存
 * @param {string} projectPath - プロジェクトパス
 * @param {Object} siteConfig - site-config.ymlの内容
 * @param {Object} newSettings - 新しい設定値
 * @returns {Promise<Object>} 結果
 */
async function saveSiteSettings(projectPath, siteConfig, newSettings) {
    if (!siteConfig.site_settings) {
        throw new Error('site_settings が site-config.yml に定義されていません');
    }

    const targetFile = siteConfig.site_settings.target_file;
    const configPath = path.join(projectPath, targetFile);

    let configData = {};

    // 既存のファイルがあれば読み込む
    if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        configData = toml.parse(configContent);
    }

    // 新しい値を設定
    for (const [key, value] of Object.entries(newSettings)) {
        setNestedValue(configData, key, value);
    }

    // TOMLとして書き込む
    const tomlString = toml.stringify(configData);
    fs.writeFileSync(configPath, tomlString, 'utf-8');

    return { success: true };
}

module.exports = {
    loadSiteSettings,
    saveSiteSettings
};
