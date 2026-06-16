# kamox 不具合レポート

**テスト日:** 2025年11月
**kamox バージョン:** v0.1.8
**対象アプリ:** Fubako (Electron + Vue 3 + Vite)
**OS:** Windows 11
**Node.js管理:** Volta

---

## 不具合一覧

| # | カテゴリ | 重要度 | 内容 |
|---|---------|--------|------|
| 1 | インストール | Critical | グローバルインストールでElectronバイナリを検出できない |
| 2 | API | Critical | `playwright/element` の click/fill アクションが Electron ウィンドウで機能しない |
| 3 | API | Major | `playwright/element` の読み取りアクションが値を返さない |
| 4 | 設定 | Minor | `kamox.config.json` の `entryPoint` がCLI起動時に反映されない場合がある |

---

## BUG-1: グローバルインストールで Electron バイナリを検出できない

### 重要度: Critical

### 再現手順

1. Volta 経由で kamox をグローバルインストール: `npm install -g kamox`
2. プロジェクトに electron がローカルインストール済み (`node_modules/electron/`)
3. `kamox electron` を実行

### 期待される動作

プロジェクトの `node_modules/.bin/electron.cmd` (Windows) または `node_modules/electron/dist/electron.exe` を検出して起動する。

### 実際の動作

```
Electron executablePath not found!
Please install it using `npm install -D electron` or set the executablePath to your Electron executable.
```

### 原因分析

`@kamox/plugin-electron` の `ElectronAdapter.js` は `node_modules/.bin/electron.cmd` を探すが、グローバルインストールされた kamox は自身の `node_modules` スコープで解決しようとするため、プロジェクトローカルの electron バイナリを見つけられない。

Volta 環境では `C:\Users\<user>\AppData\Local\Volta\tools\image\packages\kamox\` にインストールされ、その中のPlaywrightがプロジェクトルートの `node_modules` を参照できない。

### 試した回避策（すべて失敗）

- `ELECTRON_OVERRIDE_DIST_PATH` 環境変数の設定
- `NODE_PATH` でプロジェクトの `node_modules` を指定
- `kamox.config.json` に `electronPath` を明示的に設定

### ワークアラウンド

プロジェクトにローカルインストールすることで解決:

```bash
npm install --save-dev kamox
```

### 提案

- `kamox.config.json` に `electronPath` オプションを追加し、明示的にパスを指定可能にする
- グローバルインストール時もプロジェクトの `node_modules` を走査する仕組みを導入
- エラーメッセージに「ローカルインストールを推奨」の情報を追加

---

## BUG-2: `playwright/element` の click/fill アクションが Electron ウィンドウで機能しない

### 重要度: Critical

### 再現手順

1. kamox で Electron アプリを起動（ローカルインストール、`NODE_ENV=development`）
2. `/status` で2つのウィンドウ検出を確認（index 0: DevTools, index 1: App）
3. `/check-ui` で `windowIndex: 1` のDOM内容を正常に取得できることを確認
4. `playwright/element` API で click を実行:

```bash
curl -X POST http://localhost:3000/playwright/element \
  -H "Content-Type: application/json" \
  -d '{
    "selector": "button",
    "action": "click",
    "windowIndex": 1,
    "timeout": 5000
  }'
```

### 期待される動作

指定セレクタの要素がクリックされ、`{ success: true }` が返る。

### 実際の動作

常に `{ success: false }` が返る。タイムアウトエラー。
`check-ui` で DOM を確認すると `<button>` 要素は確実に存在する。

### テストバリエーション（すべて失敗）

| セレクタ | windowIndex | timeout | 結果 |
|---------|-------------|---------|------|
| `button` | 1 | 5000 | FAIL |
| `.btn-primary` | 1 | 10000 | FAIL |
| `text=プロジェクトを開く` | 1 | 5000 | FAIL |
| `button >> nth=0` | 1 | 5000 | FAIL |
| `#app button` | 1 | 5000 | FAIL |

`fill` アクションも同様にすべて失敗。

### 補足情報

- `check-ui` API は同じ `windowIndex: 1` で正常にスクリーンショットとDOM情報を取得できる
- `mock-dialog`, `mock-ipc` は正常に動作する
- DevTools（windowIndex: 0）に対しても同様に失敗

### 影響

**この不具合により、kamox 経由でのUI自動操作が一切不可能。** テスト自動化のコア機能が使えないため、以下のテストが実行不能:

- ボタンクリック（プロジェクトを開く、保存、プレビューなど）
- フォーム入力（テキストフィールド、セレクトボックスなど）
- ナビゲーション（サイドバーリンクのクリック）

---

## BUG-3: `playwright/element` の読み取りアクションが値を返さない

### 重要度: Major

### 再現手順

```bash
curl -X POST http://localhost:3000/playwright/element \
  -H "Content-Type: application/json" \
  -d '{
    "selector": "h1",
    "action": "textContent",
    "windowIndex": 1
  }'
```

### 期待される動作

```json
{
  "success": true,
  "data": {
    "result": "Fubako"
  }
}
```

### 実際の動作

```json
{
  "success": true
}
```

`success: true` は返るが、`data` フィールドが存在しない。

### 影響を受けるアクション

- `textContent` - テキスト取得
- `innerHTML` - HTML取得
- `isVisible` - 表示状態確認
- `getAttribute` - 属性値取得

### ワークアラウンド

`check-ui` API で代替可能。`data.dom.bodyText` や `data.dom.html` でDOM情報を取得できる。

ただし `check-ui` では特定要素のピンポイント取得はできないため、レスポンス全体から文字列検索で判定する必要がある。

---

## BUG-4: `kamox.config.json` の設定が反映されない場合がある

### 重要度: Minor

### 再現手順

`kamox.config.json`:
```json
{
  "mode": "electron",
  "entryPoint": "electron/main.cjs",
  "port": 3000
}
```

CLI実行: `npx kamox electron`

### 実際の動作

起動ログに `Entry: main.js` と表示される場合がある（`kamox.config.json` の `entryPoint` が無視される）。

### ワークアラウンド

CLI引数で明示的に指定:

```bash
npx kamox electron --entry-point electron/main.cjs
```

---

## 環境情報

```
kamox: v0.1.8
Node.js: v22.x (Volta管理)
npm: v10.x
electron: v33.2.1 (プロジェクトローカル)
playwright-core: kamox 同梱版
OS: Windows 11
ターミナル: PowerShell / Git Bash
```

## まとめ

BUG-2（clickアクション不動作）が最も影響が大きく、kamox の Electron テスト機能のコアが機能しない状態。`check-ui` によるスクリーンショット取得とDOM検査は正常に動作するため、**視覚的な確認は可能だが、自動操作によるE2Eテストは実行不能**。

`mock-ipc`、`mock-dialog`、`ipc-spy` などのIPC関連機能は正常に動作しており、kamox のインフラ部分は健全。Playwright と Electron ウィンドウの接続部分に問題があると推測される。
