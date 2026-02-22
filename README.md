# Fubako (フバコ)

静的サイト管理ツール - Electron + Vue 3 + Zola

## 概要

Fubakoは、Zolaベースの静的サイトをGUIで管理できるデスクトップアプリケーションです。
非エンジニアでも簡単にコンテンツを更新できる「ブログ感覚」のインターフェースを提供します。

## 主な機能

- **プロジェクト管理** — Zolaプロジェクトフォルダを開いて管理。履歴から素早くアクセス
- **コンテンツ編集** — Markdownフロントマター対応の動的フォーム生成。ニュース・導入事例・サービス・固定ページなどコンテンツタイプごとに管理
- **画像管理** — アップロード（UUID+年月フォルダ）、リサイズ（Sharp連携）、ダミー画像生成
- **ライブプレビュー** — Zolaのserveコマンドと連携したリアルタイムプレビュー。ビルドエラーの日本語表示
- **サイト設定** — site-config.ymlに基づいた `config.toml` (TOML) のGUI編集
- **スラグ衝突検知** — Zolaのパスコリジョンを事前検出・自動修正
- **Git/GitHub連携** — 保存（Commit）、同期（Push/Pull）、GitHub Device Flow認証、GitHub Pagesへの自動デプロイ設定生成

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

### Phase 1 (MVP) — 基本機能の完成 ✅ 完了

| # | 機能 | 状態 | 説明 |
| --- | ------ | ------ | ------ |
| 1 | Markdown読み書き | ✅ 完了 | YAML Frontmatterのパース・保存。contentManager.cjsで対応 |
| 2 | 画像アップロード・管理 | ✅ 完了 | UUID+年月フォルダ管理、リサイズ（Sharp）、ダミー画像生成 |
| 3 | プレビュー機能 | ✅ 完了 | `zola serve` 連携、stderrエラーパース（日本語表示）、iframe表示 |
| 4 | コンテンツ一覧・編集 | ✅ 完了 | site-config.ymlによる動的フォーム生成、ソート、フィルタリング |
| 5 | スラグ衝突検知 | ✅ 完了 | 同名スラグによるビルドエラーを事前に防止・一括修正 |
| 6 | サイト設定GUI | ✅ 完了 | `config.toml` の主要項目をGUIから編集可能に |

### Phase 2 — 運用・デプロイ機能 ✅ 完了

| # | 機能 | 状態 | 説明 |
| --- | ------ | ------ | ------ |
| 7 | GitHub連携 | ✅ 完了 | Device Flow認証、リポジトリ初期化、Commit & Pushの直感的な操作 |
| 8 | デプロイ設定生成 | ✅ 完了 | GitHub Pagesへのデプロイパイプライン（GitHub Actions）の自動生成 |
| 9 | コンフリクト解消 | ✅ 完了 | GUI上での簡単なコンフリクト解決（手元優先/リモート優先） |
| 10 | サイトエクスポート | ✅ 完了 | staticビルド結果をZIPでエクスポートする機能 |

### Phase 3 — さらなる品質向上 🚧 進行中

| # | 機能 | 状態 | 説明 |
| --- | ------ | ------ | ------ |
| 11 | SEO設定UI | ⏳ 着手可 | メタタグ、OGP設定のGUI化 |
| 12 | メディアライブラリ | ⏳ 検討中 | アップロード済み画像の一覧・再利用UI |
| 13 | Taxonomies対応 | 🚧 開発中 | カテゴリ・タグのGUI管理 |
| 14 | パッケージング | ⏳ 予定 | electron-builderによるインストーラー配布（Win/Mac） |

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
