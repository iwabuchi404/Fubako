# Fubako (フバコ)

静的サイト管理ツール - Electron + Vue 3 + Zola

## 概要

Fubakoは、Zolaベースの静的サイトをGUIで管理できるデスクトップアプリケーションです。
非エンジニアでも簡単にコンテンツを更新できる「ブログ感覚」のインターフェースを提供します。

## 主な機能

- **プロジェクト管理** — Zolaプロジェクトフォルダを開いて管理。履歴から素早くアクセス
- **コンテンツ編集** — Markdownフロントマター対応の動的フォーム生成。ニュース・導入事例・サービス・固定ページなどコンテンツタイプごとに管理
- **画像管理** — アップロード（UUID+年月フォルダ）、リサイズ、ダミー画像生成
- **ライブプレビュー** — Zolaのserveコマンドと連携したリアルタイムプレビュー
- **サイト設定** — config.toml（TOML）のGUI編集
- **スラグ衝突検知** — Zolaのパスコリジョンを事前検出・自動修正

## 必要な準備

### Zolaバイナリの配置

開発環境で動作させるには、Zolaバイナリが必要です。

1. [Zola公式サイト](https://www.getzola.org/documentation/getting-started/installation/)からダウンロード
2. `bin/` ディレクトリに配置
   - Windows: `bin/zola.exe`
   - macOS/Linux: `bin/zola`

## 開発手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 開発サーバーの起動

```bash
npm run dev
```

これにより以下が同時に起動します:
- Vite開発サーバー (http://localhost:5173)
- Electronアプリ

### 3. プロダクションビルド

```bash
npm run build
```

### 4. サンプルプロジェクトを開く

アプリ起動後、「プロジェクトを開く」ボタンから `sample-site` フォルダを選択してください。
3つのコンテンツタイプ（ニュース、導入事例、サービス）と固定ページ（会社概要、採用情報、プライバシーポリシー）を持つ企業サイト構成です。

## アーキテクチャ

```
Electron Main Process (CommonJS)
  ├── electron/main.cjs            # ウィンドウ作成、IPC登録、Zolaプロセス管理
  ├── electron/preload.cjs         # contextBridge経由でelectronAPIを公開
  ├── electron/contentManager.cjs  # Markdown読み書き、Frontmatterパース
  ├── electron/imageManager.cjs    # 画像アップロード・リサイズ・ダミー生成
  └── electron/configManager.cjs   # config.toml (TOML) 読み書き

Renderer Process (Vue 3, ES Modules)
  ├── src/App.vue                  # ルートコンポーネント
  ├── src/stores/project.js        # Piniaストア（プロジェクト状態、プレビュー制御）
  ├── src/router/index.js          # ルーティング定義
  ├── src/views/
  │   ├── HomeView.vue             # ダッシュボード
  │   ├── ProjectView.vue          # プロジェクト管理
  │   ├── ContentsListView.vue     # コンテンツ一覧
  │   ├── EditView.vue             # コンテンツ作成・編集
  │   └── SettingsView.vue         # サイト設定
  └── src/components/
      ├── PreviewPanel.vue         # プレビューiframe
      └── PreviewStatus.vue        # プレビュー状態表示
```

### IPC通信

Main↔Renderer間は `preload.cjs` の `contextBridge` で `window.electronAPI` として公開。Node Integrationは無効（contextIsolation=true）。

### データフロー

1. **プロジェクト読み込み**: フォルダ選択 → `site-config.yml` パース → Piniaストアに保存
2. **コンテンツ編集**: Markdown読込 → YAML Frontmatter→フォーム → 編集 → ファイル書き込み
3. **プレビュー**: `zola serve` をspawn → stderr監視 → iframe表示
4. **画像アップロード**: ファイル選択 → UUID生成 → `static/uploads/YYYY/MM/` にコピー

## プロジェクト構造

```
Fubako/
├── electron/            # Electronメインプロセス (.cjs = CommonJS)
├── src/                 # Vueアプリケーション (ES Modules)
│   ├── views/           # ページコンポーネント
│   ├── components/      # 共通コンポーネント
│   ├── stores/          # Piniaストア
│   └── router/          # Vue Router設定
├── sample-site/         # サンプルZolaプロジェクト
│   ├── site-config.yml  # Fubako設定ファイル
│   ├── config.toml      # Zola設定ファイル
│   ├── content/         # コンテンツ (Markdown)
│   ├── templates/       # Teraテンプレート
│   └── sass/            # スタイルシート
├── bin/                 # Zolaバイナリ配置先
└── docs/                # 設計ドキュメント
```

## site-config.yml

各Zolaプロジェクトの `site-config.yml` がFubakoの動作を定義する設定ファイルです。
コンテンツタイプ、フォームフィールド定義、一覧カラム定義、サイト設定グループを含みます。

対応フィールドタイプ: `text`, `textarea`, `date`, `toggle`, `select`, `image`, `gallery`, `list`, `markdown`

## 開発ロードマップ

### Phase 0 (MVP) — これがないと移行不可能 ✅ 完了

| # | 機能 | 状態 | 説明 |
| --- | ------ | ------ | ------ |
| 1 | Markdown読み書き | ✅ 実装済 | YAML Frontmatterのパース・保存。contentManager.cjsで対応 |
| 2 | 画像アップロード・管理 | ✅ 実装済 | UUID+年月フォルダ管理、リサイズ（Sharp）、ダミー画像生成 |
| 3 | プレビュー機能 | ✅ 実装済 | `zola serve` 連携、stderrエラーパース、iframe表示 |
| 4 | ニュース投稿・一覧管理 | ✅ 実装済 | site-config.ymlによる動的フォーム生成、日付ソート、公開/下書き切り替え |
| 5 | 固定ページの編集UI | ✅ 実装済 | 会社概要・採用情報・プライバシーポリシー等をGUIから編集 |

### Phase 1 — 移行はできるが運用に支障が出る 🚧 未着手

| # | 機能 | 状態 | 説明 |
| --- | ------ | ------ | ------ |
| 6 | Git連携（push/pullの抽象化） | ⏳ 未実装 | 「保存」「公開」ボタンで裏側のcommit & pushを実行。コンフリクト時の分かりやすいエラー表示 |
| 7 | デプロイパイプラインの接続 | ⏳ 未実装 | Git push → GitHub Actions → Netlify/Vercel等への自動デプロイ。CIテンプレートとドキュメント提供 |
| 8 | お問い合わせフォームの代替手段 | ⏳ 未実装 | テーマ側でFormspree・Googleフォーム等を埋め込み対応。移行ガイドをドキュメントとして用意 |

### Phase 2 — あると運用品質が上がる 🚧 一部実装済

| # | 機能 | 状態 | 説明 |
| --- | ------ | ------ | ------ |
| 9 | SEO設定UI（meta description、OGP） | ⏳ 未実装 | Zolaのfront matterで対応可能な項目をGUIから設定 |
| 10 | 画像リサイズ・最適化 | ✅ 実装済 | Sharp連携による自動リサイズ。アップロード時にサイズ指定可能 |
| 11 | エラーハンドリング（Zolaビルドエラー表示） | ✅ 実装済 | パスコリジョン・リンク切れ・Frontmatterエラーをパースして日本語メッセージ表示 |

### Phase 3 — 将来の拡張

| # | 機能 | 状態 | 説明 |
| --- | ------ | ------ | ------ |
| 12 | Taxonomies対応 | ⏳ 未実装 | Zolaのtaxonomy機能をGUIで管理（カテゴリ・タグ） |
| 13 | メディアライブラリ | ⏳ 未実装 | アップロード済み画像の一覧・検索・再利用UI |
| 14 | Electronパッケージング | ⏳ 未実装 | electron-builderによるインストーラー配布（Windows/macOS） |

## 技術スタック

- **Electron** 28.x — デスクトップアプリフレームワーク
- **Vue 3** — フロントエンドフレームワーク
- **Vite** (rolldown-vite) — ビルドツール
- **Pinia** — 状態管理
- **Vue Router** — ルーティング
- **Zola** — 静的サイトジェネレーター
- **Sharp** — 画像リサイズ
- **js-yaml** — YAMLパーサー
- **@iarna/toml** — TOMLパーサー

## ドキュメント

詳細な設計ドキュメントは `docs/` ディレクトリを参照してください:

- `ARCHITECTURE.md` — アーキテクチャ・機能設計
- `CONFIG.md` — site-config.yml 仕様
- `DATA_SCHEMA.md` — データ構造定義
- `fubako_designDoc.md` — 基本設計
- `theme.md` — テーマ制作ガイド
- `IMAGE_REQUIREMENTS.md` — 画像機能要件

## ライセンス

MIT
