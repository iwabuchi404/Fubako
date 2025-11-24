# Fubako (フバコ)

静的サイト管理ツール - Electron + Vue 3 + Zola

## 概要

Fubakoは、Zolaベースの静的サイトをGUIで管理できるデスクトップアプリケーションです。
非エンジニアでも簡単にコンテンツを更新できる「ブログ感覚」のインターフェースを提供します。

## 開発状況

**Phase 1 (MVP) - 実装中**

### 実装済み
- ✅ Electron + Vue 3 の基本構成
- ✅ IPC通信の基本実装
- ✅ プロジェクトストア (Pinia)
- ✅ ルーティング (Vue Router)
- ✅ 動的フォーム生成の基本
- ✅ サンプルサイト構造

### 未実装 (Phase 1)
- ⏳ Zolaバイナリの統合
- ⏳ Markdown読み書き実装
- ⏳ 画像アップロード機能
- ⏳ プレビュー機能
- ⏳ エラーハンドリング

### Phase 2以降
- 画像リサイズ (Sharp)
- Git連携
- taxonomies対応
- メディアライブラリ

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

これにより以下が起動します:
- Vite開発サーバー (http://localhost:5173)
- Electronアプリ

### 3. サンプルプロジェクトを開く

アプリ起動後、「プロジェクトを開く」ボタンから `sample-site` フォルダを選択してください。

## プロジェクト構造

```
Fubako/
├── electron/           # Electronメインプロセス
│   ├── main.cjs       # メインプロセスエントリーポイント
│   └── preload.cjs    # プリロードスクリプト
├── src/               # Vueアプリケーション
│   ├── views/         # ページコンポーネント
│   ├── stores/        # Piniaストア
│   ├── router/        # Vue Router設定
│   └── App.vue        # ルートコンポーネント
├── sample-site/       # サンプルZolaプロジェクト
│   ├── site-config.yml  # Fubako設定ファイル
│   ├── config.toml      # Zola設定ファイル
│   ├── content/         # コンテンツ (Markdown)
│   ├── templates/       # Teraテンプレート
│   └── sass/            # スタイルシート
├── bin/               # Zolaバイナリ配置先
└── docs/              # 設計ドキュメント
```

## 技術スタック

- **Electron** 28.x - デスクトップアプリフレームワーク
- **Vue 3** - フロントエンドフレームワーク
- **Vite** - ビルドツール
- **Pinia** - 状態管理
- **Vue Router** - ルーティング
- **Zola** 0.18.x - 静的サイトジェネレーター
- **js-yaml** - YAML パーサー

## ドキュメント

詳細な設計ドキュメントは `docs/` ディレクトリを参照してください:

- `ARCHITECTURE.md` - アーキテクチャ・機能設計
- `CONFIG.md` - site-config.yml 仕様
- `DATA_SCHEMA.md` - データ構造定義
- `fubako_designDoc.md` - 基本設計
- `theme.md` - テーマ制作ガイド

## ライセンス

MIT
