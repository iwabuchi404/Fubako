# Phase 0-2 進行記録

**作成日:** 2026年6月16日
**目的:** Phase 0-2 の作業内容と成果を記録し、途中で止まっても再開できるように現在地を明確にする

---

## コミット状況

- **Phase 0**: ✅ コミット済み（319b5e9, a98e97b）
- **Phase 1-2**: ❌ 未コミット（1コミットでまとめる予定）

---

## Phase 0: i18n化リファクタリング完成

### 実施内容

#### T1: electron/main.cjs のバグ修正
- ✅ startZola 内「未定義変数 sender」バグ修正
- ✅ errorPatterns の type→pattern.type 参照バグ修正

#### T2: 不足i18nキー追加
- ✅ zolaBinaryNotFound
- ✅ brokenLinkDetail
- ✅ frontMatterError
- ✅ ja/en 両ロケールに追加

#### T3: electron/preload.cjs の locale IPC公開
- ✅ setLocale/getLocale をIPCとして公開
- ✅ locale 連携完成

#### T4: electron/i18nManager.cjs パッケージ化対応
- ✅ パス解決の修正

#### T5: src/App.vue ナビの i18n化
- ✅ ナビゲーションテキストをi18n対応

#### T6: package.json の依存関係・配布設定
- ✅ vue-i18n を依存に追加
- ✅ electron-builder の配布設定に i18n関連ファイルを含める

#### T7: .gitignore 修正
- ✅ dist-electron → dist_electron のスペル不一致解消

### 成果
- i18n基盤が完成し、locale切替がElectron↔Renderer間で完全に連携
- Zolaエラー通知が多言語化対応
- main.cjs のバグ2件を修正

---

## Phase 1: GIT_SPEC.md v1.1.0 全面改訂

### 実施内容

#### T1: GIT_SPEC.md の全面改訂
- ✅ 「ファイル完全書き換え原則」を明確化
  - コンテンツ編集＝ファイル全体書き換え
  - 3-wayマージ不使用
- ✅ 「選択式同期」を明確化
  - 同一ファイル両側変更時はユーザーが local/remote 選択
- ✅ production公開を merge方式 に変更
  - force-push方式を廃止
  - 通常の merge + push 方式に
- ✅ コンフリクト解決パネルUI仕様を追加
  - ファイルごとに local/remote 選択
  - 「全て適用して完了」「同期中止」ボタン

### 成果
- Phase 2 実装のための仕様が確定
- 選択式同期というUX方針が明確化

---

## Phase 2: Git同期・コンフリクト解決実装

### T1: gitManager.cjs - production公開方式変更

#### 変更内容
- ✅ force-push方式→通常merge方式に全面変更
- ✅ fetch→checkout production→merge develop→push
- ✅ finally節で元ブランチ復帰（確実処理）
- ✅ コンフリクト時は merge --abort

#### 成果
- 本番公開フローが安全で確実なものに
- 元ブランチへの復帰が保証される

---

### T2: gitManager.cjs - develop同期 pull 関数新設

#### 実装内容
- ✅ fetch→behind/ahead判定→fast-forward/安全マージ/コンフリクト検出
- ✅ behind=0（ローカル最新または先行）→ upToDate
- ✅ ahead=0（リモートのみ進んでいる）→ fast-forward merge
- ✅ behind>0 && ahead>0（分岐状態）→ merge-base で共通祖先を取得
- ✅ conflictFiles を merge-base diffの積集合で検出（ファイル完全書き換え原則）
- ✅ 別ファイルのみ変更→安全にマージ
- ✅ コンフリクトあり→ --no-commit --no-ff でマージ開始、状態保持

#### 成果
- develop同期が「更新ボタン」で実行可能に
- コンフリクト検出が正確に（ファイル完全書き換え原則に基づく）

---

### T3: gitManager.cjs - コンフリクト解決関数新設

#### 実装内容
- ✅ resolveConflict(projectPath, branch, file, side)
  - side='local' → checkout HEAD -- file（マージ前のローカル版）
  - side='remote' → checkout origin/branch -- file（リモート版）
  - git add file でステージング
- ✅ completeMerge(projectPath)
  - commit --no-edit でマージ完了
- ✅ abortMerge(projectPath)
  - merge --abort でマージ中止
- ✅ 旧 resolveConflictLocal/Remote は統合して削除

#### 成果
- コンフリクト解決のバックエンドが完成
- 選択式同期のロジックが実装完了

---

### T4: IPC登録（preload.cjs, main.cjs, src/stores/git.js）

#### 実装内容
- ✅ preload.cjs
  - gitPull
  - gitResolveConflict
  - gitCompleteMerge
  - gitAbortMerge
- ✅ main.cjs
  - git-pull ハンドラー
  - git-resolve-conflict ハンドラー
  - git-complete-merge ハンドラー
  - git-abort-merge ハンドラー
- ✅ src/stores/git.js
  - pull 関数（gitPull IPC呼び出し）
  - resolveConflict 関数
  - completeMerge 関数
  - abortMerge 関数

#### 成果
- IPC通信経路が完成
- Renderer→Mainのデータフローが確立

---

### T5: HomeView.vue - コンフリクト解決パネルUI

#### 実装内容
- ✅ 更新ボタンを fetch→pull に格上げ
- ✅ コンフリクト解決パネル新設
  - ファイルごとに local/remote ラジオボタン
  - 「全て適用して完了」「同期中止」ボタン
  - 全ファイル選択完了時のみ「完了」ボタン有効化
- ✅ handleGitPull の実装
  - gitStore.pull() 呼び出し
  - isConflict=true の場合パネル表示
- ✅ handleResolveConflict の実装
  - ファイルごとに選択を適用
  - 全解決完了で completeMerge 呼び出し
- ✅ handleCompleteMerge の実装
  - gitStore.completeMerge() 呼び出し
  - 成功時パネルを閉じる
- ✅ handleAbortMerge の実装
  - gitStore.abortMerge() 呼び出し
  - パネルを閉じる

#### 成果
- コンフリクト解決UIが完成
- UXが仕様通りに実装完了

---

### T6: i18n追加（locales/ja.json, en.json）

#### 実装内容
- ✅ git.sync 同期
- ✅ git.syncConflict 同期でコンフリクト
- ✅ git.conflictFiles コンフリクトファイル
- ✅ git.selectVersion バージョンを選択してください
- ✅ git.localVersion ローカル（手元の変更）
- ✅ git.remoteVersion リモート（リモートの変更）
- ✅ git.applyAll 全て適用して完了
- ✅ git.abortSync 同期を中止
- ✅ git.syncSuccess 同期が完了しました
- ✅ git.syncAborted 同期が中止されました
- ✅ git.resolvingConflict 解決中...

#### 成果
- コンフリクト解決UIが完全にi18n化
- ja/en 両対応完了

---

## 現在地（2026-06-16）

### 実装完了
- ✅ Phase 0: i18n化リファクタリング
- ✅ Phase 1: GIT_SPEC.md v1.1.0 改訂
- ✅ Phase 2: Git同期・コンフリクト解決実装（T1-T6）

### 未コミット
- ❌ Phase 1-2 の変更を1コミット予定

### 未実装・今後の継続ポイント

#### 1. 実機テスト（最重要）
- ⏳ Phase 2機能の実機確認
  - develop同期（pull/コンフリクト解決）
  - production公開（merge方式）
  - i18n locale切替
  - （現在はコード実装済み・静的検証のみ）

#### 2. Phase 3 残タスク
- ⏳ Taxonomies対応
- ⏳ SEO設定専用UI（OGP/Meta）
- ⏳ メディアライブラリ（画像再利用）
- ⏳ 定期pull（現在は手動「更新ボタン」のみ）

#### 3. UI未実装
- ⏳ ProjectView.vue（現在スタブ）
- ⏳ EditView list型編集UI（初期化のみ）
- ⏳ EditView gallery型（完全未実装）

#### 4. 配布・品質
- ⏳ インストーラー完成（electron-builder設定はあるが実ビルド未確認）
- ⏳ ハードコード日本語i18n化（HomeView以外約275箇所）
- ⏳ P3: ゴミファイル削除、console.log除去
- ⏳ テスト基盤(vitest)導入
- ⏳ Fubako自身のCI整備

### 既知の未解決・確認事項
1. EditView の list 型編集UI（部分実装：初期化のみ）、gallery 型（完全未実装）
2. ProjectView.vue がスタブ（6行）
3. ハードコード日本語約275箇所のi18n化（HomeView以外は未対応）
4. **実機テスト未実施**（コンフリクト解決UI等、Phase 2機能は静的検証のみ）
5. App.vue Gitフッター通知（PreviewStatus.vueに「未保存の変更あり」表示あり。フッター通知自体は未実装）

---

## 次回作業再開時のチェックポイント

1. コミット状況の確認
   - Phase 1-2 が未コミットであることを確認
   - 変更内容を確認してコミットメッセージ作成

2. 実機テストの実施
   - 開発サーバー起動（npm run dev）
   - Git同期・コンフリクト解決の動作確認
   - production公開の動作確認
   - i18n locale切替の確認

3. Phase 3 タスクの優先順位付け
   - Taxonomies対応
   - SEO設定UI
   - メディアライブラリ
   - 定期pull

4. UI未実装箇所の対応
   - ProjectView.vue の実装
   - EditView list型/gallery型 の実装

---

**本ドキュメントは Phase 0-2 の作業記録です。機能の完成度一覧は IMPLEMENTATION_STATUS.md を参照してください。**
