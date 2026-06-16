# 実装状況

**最終更新:** 2026年6月16日

## ✅ 実装完了

### 1. コア・アーキテクチャ
- [x] Electron + Vue 3 + Vite (Rolldown) の統合
- [x] IPC通信 (30+ ハンドラー)
- [x] プロジェクト状態管理 (Pinia)
- [x] ルーティング (Vue Router)
- [x] **i18n対応（日本語・英語）**
  - vue-i18n導入、locale切替、IPC連携完成
  - electron/main.cjs, preload.cjs で locale 管理
  - Zolaエラー通知のi18n化

### 2. コンテンツ管理機能
- [x] **Markdown読み書き** (`contentManager.cjs`)
  - Frontmatter + Body の高度なパース
  - ドット記法による階層構造サポート
- [x] **バリデーション・検知**
  - スラグ衝突の事前検知と自動解決
  - Zolaビルドエラーのパースと多言語化対応
- [x] **UI統合**
  - 動的フォーム生成 (10+ フィールドタイプ)
  - ページネーション・高度なソート機能
  - **各種エラーメッセージのi18n化（一部）**

### 3. 画像管理機能
- [x] **画像アップロード** (`imageManager.cjs`)
  - UUIDリネーム / 年月フォルダ整理
  - **Sharpによるリサイズ・最適化**
- [x] **ユーティリティ**
  - ダミー画像生成
  - 画像一覧管理

### 4. Git / デプロイ連携
- [x] **Git基本操作** (`gitManager.cjs`)
  - リポジトリ初期化 / ステータス取得
  - Commit / Push / Fetch / Pull / Checkout
- [x] **GitHub連携** (`githubAuth.cjs`)
  - Device Flow によるセキュアな認証
- [x] **develop同期機能（pull）**
  - fetch→behind/ahead判定→fast-forward/安全マージ/コンフリクト検出
  - **コンフリクト解決パネルUI**（ファイルごとlocal/remote選択）
  - resolveConflict/completeMerge/abortMerge 関数
- [x] **production公開（merge方式）**
  - fetch→checkout production→merge develop→push
  - finally節で元ブランチ復帰（確実処理）
  - **本番公開ボタン＆確認ダイアログ**
- [x] **GitHub Actions (CI) 設定の自動生成**
- [x] **エクスポート**
  - ビルド済み資材のZIP書き出し

### 5. プレビュー・設定
- [x] **Zolaプレビュー**
  - サーバー自動起動 / 停止
  - エラー監視と通知
- [x] **サイト設定GUI** (`configManager.cjs`)
  - `config.toml` のプロパティをGUIで編集

## 🚧 進行中 / 未実装 (Phase 3)

### 1. 機能拡張
- [ ] **Taxonomies対応**
- [ ] **SEO設定専用UI** (OGP/Meta)
- [ ] **メディアライブラリ** (画像再利用)
- [ ] **定期pull**（現在は手動「更新ボタン」のみ、定期fetchはfetch-only維持）

### 2. UI未実装
- [ ] **ProjectView.vue**（現在スタブ）
- [ ] **EditView list型編集UI**（初期化のみ）
- [ ] **EditView gallery型**（完全未実装）

### 3. 配布・品質
- [ ] **インストーラー完成**（electron-builder設定はあるが実ビルド未確認）
- [ ] **ハードコード日本語i18n化**（HomeView以外約275箇所）
- [ ] **P3: ゴミファイル削除、console.log除去**
- [ ] **テスト基盤(vitest)導入**
- [ ] **Fubako自身のCI整備**

### 4. 実機テスト
- [ ] **Phase 2機能の実機確認**
  - develop同期（pull/コンフリクト解決）
  - production公開（merge方式）
  - i18n locale切替
  - （現在はコード実装済み・実機確認待ち）

## 📋 実装状況詳細

### コード実装済み・実機確認待ち

1. ✅ プロジェクトを開く・履歴からアクセス
2. ✅ コンテンツ一覧の表示・ソート・編集
3. ✅ 画像のアップロード・リサイズ
4. ✅ プレビューのリアルタイム更新
5. ✅ コミット・プッシュによる同期
6. ✅ **develop同期（pull）とコンフリクト解決UI**
7. ✅ **production公開（merge方式）**
8. ✅ GitHub Actionsによる自動デプロイ設定
9. ✅ サイト設定の変更保存
10. ✅ スラグ衝突の修正
11. ✅ **i18n対応（ja/en、locale IPC連携）**

### 実機確認済み

- **なし**（Phase 0-2の機能は静的検証のみ、実機テスト未実施）

### 既知の未解決・確認事項

1. EditView の list 型編集UI（部分実装：初期化のみ）、gallery 型（完全未実装）
2. ProjectView.vue がスタブ（6行）
3. ハードコード日本語約275箇所のi18n化（HomeView以外は未対応）
4. **実機テスト未実施**（コンフリクト解決UI等、Phase 2機能は静的検証のみ）
5. App.vue Gitフッター通知（PreviewStatus.vueに「未保存の変更あり」表示あり。フッター通知自体は未実装）
