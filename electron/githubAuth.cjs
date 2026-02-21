const { safeStorage, app } = require('electron')
const path = require('path')
const fs = require('fs')

// ← GitHub OAuth App を登録後にここを差し替える
// https://github.com/settings/developers で "New OAuth App" を作成し、
// "Enable Device Flow" を有効にしたあと Client ID を設定する
const GITHUB_CLIENT_ID = 'Ov23liitpHyBjSMaPSFM'

// トークンファイルパス（遅延取得: IPC呼び出し時点では app.ready 後）
function getTokenFile() {
  return path.join(app.getPath('userData'), 'fubako-github-token.dat')
}

/**
 * Device Flow の開始: デバイスコードを取得してブラウザを開く準備
 * @returns {{ device_code, user_code, verification_uri, interval, expires_in }}
 */
async function requestDeviceCode() {
  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, scope: 'repo,workflow' })
  })
  const data = await response.json()
  if (data.error) throw new Error(data.error_description || data.error)
  return data
}

/**
 * トークンのポーリング（1回のみ試行）
 * @param {string} deviceCode - requestDeviceCode で取得した device_code
 * @returns {{ access_token?, error? }}
 */
async function pollForToken(deviceCode) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    })
  })
  return await response.json()
}

/**
 * トークンを暗号化してファイルに保存
 * @param {string} token - GitHub アクセストークン
 */
function saveToken(token) {
  const encrypted = safeStorage.encryptString(token)
  fs.writeFileSync(getTokenFile(), encrypted)
}

/**
 * 保存済みトークンを復号して返す
 * @returns {string|null}
 */
function loadToken() {
  const tokenFile = getTokenFile()
  if (!fs.existsSync(tokenFile)) return null
  try {
    const encrypted = fs.readFileSync(tokenFile)
    return safeStorage.decryptString(encrypted)
  } catch (error) {
    console.error('[githubAuth] Failed to decrypt token:', error)
    return null
  }
}

/**
 * 保存済みトークンを削除
 */
function clearToken() {
  const tokenFile = getTokenFile()
  if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile)
}

module.exports = { requestDeviceCode, pollForToken, saveToken, loadToken, clearToken }
