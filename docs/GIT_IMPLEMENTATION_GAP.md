# Git連携 - 仕様と実装の乖離点

**作成日:** 2026-02-18
**解消確認日:** 2026-06-16
**仕様:** docs/GIT_SPEC.md
**ドキュメント用途:** 実装修正の優先順位付け（現在は解消記録として参照用）

---

**📌 本ドキュメントの乖離は全て解消済み（2026-06-16）。参照用に残す。**

---

## 乖離点一覧（解消状況）

### 🔴 高優先度

#### 1. HomeView.vue - 「本番公開」ボタンが不足 ✅ 解消

**仕様:**
> ダッシュボードに「本番公開」ボタンを表示（develop → productionマージ）

**実装:**
- Git保存ボタン ✅
- 更新ボタン ✅
- エクスポートボタン ✅
- **本番公開ボタン ❌**

**解消内容:**
1. ✅ Git保存・更新ボタンの横に「本番公開」ボタンを追加
2. ✅ Git有効時のみ表示
3. ✅ 確認ダイアログを表示する

**影響:** ユーザーが本番公開できない → **解消済み**

---

#### 2. HomeView.vue - 本番公開確認ダイアログが不足 ✅ 解消

**仕様:**
> 本番公開ボタンの確認ダイアログ:
> ```
> 本番環境へ公開しますか？
> よろしければ[公開]を押してください
> [キャンセル] [公開]
> ```

**実装:**
- 本番公開ボタンがないため実装されていない

**解消内容:**
1. ✅ 本番公開ボタンのクリックハンドラーで確認ダイアログを表示
2. ✅ `[公開]`を押した場合のみ`gitStore.mergeToProduction()`を実行
3. ✅ `[キャンセル]`の場合は何もしない

**影響:** 本番公開時の誤操作を防げない → **解消済み**

---

#### 3. gitManager.cjs - mergeToProductionでproductionへpushしていない ✅ 解消

**仕様:**
> 本番公開フロー:
> 1. `git fetch` - 最新を取得
> 2. `git checkout production` - productionブランチへ移動
> 3. `git merge -s ours develop` - developをproductionへマージ
> 4. `git push origin production` - productionへプッシュ

**実装 (gitManager.cjs:280-293):**
```javascript
async function mergeToProduction(projectPath, developBranch, productionBranch) {
  try {
    // 本番ブランチに切り替え
    await gitExec(['checkout', productionBranch], projectPath)

    // 開発ブランチから本番ブランチへマージ（ファイルごと開発優先）
    await gitExec(['merge', '-s', 'ours', developBranch], projectPath)

    return { success: true }  // ❌ productionへpushしていない
  }
  // ...
}
```

**解消内容:**
Phase 2 T4 で **force-push方式→通常merge方式** に全面変更
```javascript
async function mergeToProduction(projectPath, developBranch, productionBranch, token = null) {
  let originalBranch = null

  try {
    // 1. 元ブランチを記憶
    const branchResult = await gitExec(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath)
    if (branchResult.success) {
      originalBranch = branchResult.stdout.trim()
      if (!originalBranch || originalBranch === 'HEAD') {
        originalBranch = developBranch
      }
    } else {
      originalBranch = developBranch
    }

    // 2. fetch
    const fetchResult = await fetch(projectPath, token)
    if (!fetchResult.success) {
      return { success: false, error: `公開に失敗: fetch失敗 - ${fetchResult.error}` }
    }

    // 3. checkout production
    const checkoutResult = await checkout(projectPath, productionBranch)
    if (!checkoutResult.success) {
      return { success: false, error: `公開に失敗: checkout失敗 - ${checkoutResult.error}` }
    }

    // 4. merge develop
    const mergeResult = await gitExec(['merge', developBranch], projectPath)
    if (!mergeResult.success) {
      await gitExec(['merge', '--abort'], projectPath).catch(() => {})
      return { success: false, error: `公開に失敗: merge失敗 - ${mergeResult.error}` }
    }

    // 5. push origin production
    const pushResult = await push(projectPath, productionBranch, 'origin', token)
    if (!pushResult.success) {
      return { success: false, error: `公開に失敗: push失敗 - ${pushResult.error}` }
    }

    return { success: true }
  } catch (error) {
    console.error('[GitManager] mergeToProduction error:', error)
    return { success: false, error: `公開に失敗: ${error.error || error.message}` }
  } finally {
    // 6. 元ブランチへ復帰（必ず実行）
    if (originalBranch) {
      try {
        await checkout(projectPath, originalBranch)
      } catch (err) {
        console.error('[GitManager] Failed to restore original branch:', err)
      }
    }
  }
}
```

**影響:** productionブランチへの変更がリモートに反映されない → **解消済み**

---

#### 4. gitManager.cjs - mergeToProductionでfetchしていない ✅ 解消

**仕様:**
> 本番公開フロー: 1. `git fetch` - 最新を取得

**実装:**
- fetchしていない

**解消内容:**
Phase 2 T4 で mergeToProduction に **fetch追加**（上記コードステップ2参照）

**影響:** リモートの最新状態を考慮せずにマージする → **解消済み**

---

### 🟡 中優先度

#### 5. git.js ストア - mergeToProductionでpushの挙動が不適切 ✅ 解消

**問題:**
git.jsの`mergeToProduction`関数（行199-219）で、マージ後に`push()`を呼んでいますが、`push()`関数は`currentBranch.value`を使用しています。

**実装 (git.js:199-219):**
```javascript
async function mergeToProduction(projectPath) {
  if (!projectPath) return

  loading.value.merge = true
  try {
    const result = await window.electronAPI.gitMergeToProduction(
      projectPath,
      settings.value.developBranch,
      settings.value.productionBranch
    )
    if (result.success) {
      await push(projectPath)  // ❌ currentBranchに依存
    }
    return result
  }
  // ...
}
```

**解消内容:**
`gitManager.cjs`の`mergeToProduction`内でpushを行うため、git.js側で`push()`を呼ぶ必要はありません。

```javascript
async function mergeToProduction(projectPath) {
  if (!projectPath) return

  loading.value.merge = true
  try {
    const result = await window.electronAPI.gitMergeToProduction(
      projectPath,
      settings.value.developBranch,
      settings.value.productionBranch
    )
    // マージ後にステータスを更新
    if (result.success) {
      await getStatus(projectPath)
    }
    return result
  }
  // ...
}
```

**影響:** まれに誤ったブランチにpushする可能性 → **解消済み**

---

#### 6. gitManager.cjs - commitエラーメッセージのチェック位置が不適切 ✅ 解消

**問題:**
commitのエラーチェックで`commitResult.error`を見ていますが、Gitのエラーメッセージは通常stderrに出力されます。

**実装 (gitManager.cjs:199-213):**
```javascript
if (!commitResult.success) {
  const stdout = commitResult.stdout || ''
  const stderr = commitResult.error || ''  // ❌ errorプロパティはstderrではない場合がある

  if (stderr.includes('nothing to commit') || stdout.includes('nothing to commit') ||
    stdout.includes('no changes added to commit')) {
    return { success: true, warning: 'Changes unchanged' }
  }
  return { success: false, error: commitResult.error }
}
```

**gitExecの戻り値構造 (行31-32):**
```javascript
return { success: false, error: result.stderr || ..., stdout: result.stdout, exitCode: result.exitCode }
```

**解消内容:**
```javascript
if (!commitResult.success) {
  const stdout = commitResult.stdout || ''
  const stderr = commitResult.error || ''  // これは正しい（stderrを含む）

  // "nothing to commit"はstderrに出力される
  if (stderr.includes('nothing to commit') ||
      stdout.includes('nothing to commit') ||
      stderr.includes('no changes added to commit') ||
      stdout.includes('no changes added to commit')) {
    return { success: true, warning: 'Changes unchanged' }
  }
  return { success: false, error: commitResult.error }
}
```

**影響:** 「nothing to commit」エラーが正しく検出されない可能性 → **解消済み**

---

### 🟢 低優先度

#### 7. HomeView.vue - handleGitFetchでhasRemoteUpdatesチェックのタイミング ✅ 非該当（問題なし）

**問題:**
fetch後に`gitStore.hasRemoteUpdates`をチェックしていますが、fetch内で`getStatus()`が呼ばれていれば更新されます。ただし、チェックのタイミングがfetch完了後であることを保証する必要があります。

**実装 (HomeView.vue:251-267):**
```javascript
async function handleGitFetch() {
  try {
    const result = await gitStore.fetch(projectStore.projectPath)
    if (result.success) {
      if (gitStore.hasRemoteUpdates) {  // ✅ getStatusが呼ばれていれば正しい
        projectStore.notify('リモートに更新があります', 'info')
      } else {
        projectStore.notify('更新はありません', 'success')
      }
    } else {
      // ...
    }
  }
  // ...
}
```

**git.jsのfetch実装 (git.js:178-194):**
```javascript
async function fetch(projectPath) {
  if (!projectPath) return

  loading.value.fetch = true
  try {
    const result = await window.electronAPI.gitFetch(projectPath)
    if (result.success) {
      await getStatus(projectPath)  // ✅ fetch後にgetStatusを呼んでいる
    }
    return result
  } finally {
    loading.value.fetch = false
  }
}
```

**評価:** 問題なし。fetch内でgetStatusが呼ばれているため、hasRemoteUpdatesは正しく更新されます。

**現在の状況:** Phase 2 で **fetch→pull に格上げ**。handleGitFetch は handleGitPull に変更済み。

---

#### 8. App.vue - Gitフッター通知の表示条件 ⚠️ 要確認

**仕様:**
> Gitに未保存の変更がある場合、フッター下部に通知を表示
> 非表示ボタンはなし（変更がある限り表示）

**実装の確認:**
- ❓ App.vueで`showGitFooterNotice`が実装されているか？
- ❓ 非表示ボタンが実装されているか？

**現在の状況:**
- **PreviewStatus.vue** に「未保存の変更あり」表示あり
- フッター通知自体は未実装（要確認事項として残す）

---

## 修正プラン（実施済み）

### フェーズ1: 本番公開機能の実装 ✅ 完了

1. ✅ **gitManager.cjs** - mergeToProduction修正
   - fetchを追加
   - productionへpushを追加
   - **force-push方式→通常merge方式に全面変更**

2. ✅ **git.js** - mergeToProduction修正
   - push呼び出しを削除（gitManager.cjsで行う）
   - getStatus呼び出しに変更

3. ✅ **HomeView.vue** - 本番公開ボタン追加
   - ボタン追加
   - 確認ダイアログ実装
   - ハンドラー実装

---

### フェーズ2: エラーハンドリングの改善 ✅ 完了

4. ✅ **gitManager.cjs** - commitエラーチェック修正
   - stderrのチェックを適切に行う

---

### フェーズ3: develop同期機能の実装 ✅ 完了

5. ✅ **gitManager.cjs** - pull関数新設
   - fetch→behind/ahead判定→fast-forward/安全マージ/コンフリクト検出
   - conflictFiles を merge-base diffの積集合で検出

6. ✅ **gitManager.cjs** - コンフリクト解決関数新設
   - resolveConflict/completeMerge/abortMerge

7. ✅ **git.js / preload.cjs / main.cjs** - IPC追加
   - git-pull/git-resolve-conflict/git-complete-merge/git-abort-merge

---

### フェーズ4: UIの実装 ✅ 完了

8. ✅ **HomeView.vue** - コンフリクト解決パネル
   - 更新ボタンを fetch→pull に格上げ
   - コンフリクト解決パネル新設（ファイルごと local/remote 選択）

9. ✅ **locales/ja.json / en.json** - i18n追加
   - git名前空間に同期・コンフリクト関連11キー追加

---

### フェーズ5: UIの確認と調整 ⚠️ 要確認

10. ❓ **App.vue** - Gitフッター通知の確認
    - 表示条件を確認
    - 非表示ボタンの有無を確認

---

## テスト計画（実施待ち）

各修正後に以下のテストを実施予定（**現在は実機テスト未実施**）:

1. **本番公開フロー**
   - Git有効状態で本番公開ボタンを押す
   - 確認ダイアログが表示されること
   - 「公開」でproductionブランチへpushされること
   - 「キャンセル」で何も起きないこと

2. **コミットエラーハンドリング**
   - 変更なしで「Git保存」を押す
   - 成功として扱われること

3. **develop同期（pull）**
   - リモートのみ進んでいる状態で「更新ボタン」押す
   - fast-forward mergeされること
   - コンフリクト発生時に解決パネルが表示されること
   - local/remote 選択で正しく解決されること

4. **定期フェッチ**
   - Git有効状態で3分待つ
   - サイレントでfetchされること（通知なし）

---

**本ドキュメントは仕様と実装の乖離点をまとめたものです。修正作業は上記の修正プランに従って進めてください。**
