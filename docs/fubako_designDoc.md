# Fubako（フバコ） 基本設計ドキュメント

**バージョン:** 2.0.0  
**最終更新:** 2025年11月24日  
**ステータス:** Phase 1 開発着手準備完了

---

## 1. プロジェクト定義

### 1.1 プロジェクト名: **Fubako (フバコ)**
*   **由来:** 「文箱（ふばこ）」— 手紙や書き物を大切に保管するための伝統的な箱。
*   **コンセプト:** テキスト（Webコンテンツ）をローカル（手元）の箱で管理し、インターネットへ届ける。

### 1.2 プロジェクト概要
Fubakoは、**小規模制作会社およびフリーランスエンジニア**を主対象とした、コーポレートサイト特化型の静的サイト管理ツール（デスクトップアプリ）です。
データベースを使用しない「静的サイトジェネレーター（SSG）」の技術を採用しつつ、非エンジニアであるクライアントが「ブログ感覚」で更新できるGUIを提供します。

### 1.3 解決する課題
1.  **WordPressの保守コスト:** セキュリティアップデート、DB管理、サーバー費用などの「維持コスト」をゼロにする。
2.  **SaaSのランニングコスト:** 月額課金型CMS（MicroCMS等）を避け、買い切り・低コスト運用を実現する。
3.  **ローカル管理の難易度:** コマンドライン（CLI）やMarkdownを扱えないユーザーでも、SSGの恩恵を受けられるようにする。

### 1.4 提供価値
*   **Pro for Client:** エンジニアがセットアップし、クライアントは「書くだけ」。
*   **Local First:** ネットワーク依存を排除し、超高速な動作と手元でのデータ保全を実現。
*   **No Lock-in:** データは標準的なテキストファイルと画像のみ。ツールがなくなっても資産は残る。

---

## 2. アーキテクチャ設計

### 2.1 技術スタック

| コンポーネント | 技術選定 | バージョン(想定) | 選定理由 |
|:---|:---|:---|:---|
| **App Shell** | Electron | 28.x | クロスプラットフォーム配布、ローカルファイル操作権限のため。 |
| **Backend** | Node.js (Built-in) | 18.x | Electronメインプロセスとして動作。ファイルIO、Git操作を担当。 |
| **Frontend** | Vue 3 + Vite | 3.x | 開発速度とコンポーネント設計の容易さ。 |
| **SSG Engine** | **Zola** | 0.18.x | **Rust製シングルバイナリ**。超高速ビルド、依存関係不要、配布容易性。 |
| **Template** | Tera | - | Zola標準。Jinja2/Liquidライクでデザイナーが扱いやすい。 |
| **Editor** | TipTap | 2.x | Vue親和性が高いヘッドレスWYSIWYGエディタ。 |
| **Img Process** | Sharp | 0.33.x | アプリ内での高速画像リサイズ・変換処理（Phase 2以降）。 |

### 2.2 システム構成図

```mermaid
graph TD
    User[ユーザー] --> GUI[Electron Renderer (Vue 3)]
    
    subgraph "Fubako Application"
        GUI -- IPC通信 (JSON) --> Main[Electron Main Process (Node.js)]
        Main -- 1. 画像処理 --> Sharp[Sharp Lib - Phase 2]
        Main -- 2. 記事保存 --> FS[File System]
        Main -- 3. ビルド実行 --> Zola[Zola Binary (Bundled)]
    end
    
    subgraph "Local Data (site-data/)"
        FS --> Config[site-config.yml]
        FS --> MD[Markdown Files]
        FS --> Assets[static/uploads/]
    end
    
    Zola -- 参照 --> MD
    Zola -- 参照 --> Assets
    Zola -- 生成 --> Preview[Memory / Local Server]
    Preview --> GUI
```

### 2.3 データフロー
1.  **起動時:** アプリが `site-config.yml` を読み込み、入力フォーム（UI）を動的に生成。
2.  **編集時:** ユーザー入力 → Vueで状態管理 → Mainプロセスへ送信 → Markdownファイルとして保存。
3.  **プレビュー:** 保存完了を検知 → Zolaがビルド実行（数ms〜数100ms） → 内蔵ローカルサーバーでHTML配信 → アプリ内のiframeで表示。

---

## 3. ディレクトリ・データ設計

### 3.1 フォルダ構成
Zolaの標準構成をベースに、Fubako独自の管理設定ファイルを追加します。

```text
site-data/
├── config.toml                # [Zola] サイト全体設定（URL、言語、ビルド設定）
├── site-config.yml            # [Fubako] 管理画面用設定（フィールド定義、Git設定）
│
├── content/                   # [Zola] 記事データ
│   ├── _index.md              # トップページ
│   ├── news/                  # ニュースセクション
│   │   ├── _index.md
│   │   ├── 2025-11-01-open.md
│   │   └── ...
│   ├── cases/                 # 導入事例セクション
│   │   └── ...
│   └── pages/                 # 固定ページ
│       ├── about.md
│       └── contact.md
│
├── static/                    # [Zola] 静的アセット
│   └── uploads/               # [Fubako] 画像保存先（一元管理）
│       ├── 2025/
│       │   └── 11/
│       │       ├── company-logo.png
│       │       └── office-view.jpg
│       └── common/
│
├── templates/                 # [Zola] HTMLテンプレート (Tera)
└── sass/                      # [Zola] スタイルシート (SCSS)
```

### 3.2 データモデル (Markdown Frontmatter)
Zolaの仕様に従い、カスタムデータは `extra` セクションに格納します。形式は可読性の高いYAMLを採用します。

**例: 導入事例 (`content/cases/example.md`)**
```yaml
---
title: "株式会社A様 導入事例"    # Zola標準フィールド
date: 2025-11-24               # Zola標準フィールド
draft: false                   # trueの場合、本番ビルドから除外

extra:                         # カスタムフィールド領域
  client_name: "株式会社A"
  industry: "製造業"
  logo: "/uploads/2025/11/logo-a.png"
  gallery:
    - "/uploads/2025/11/photo1.jpg"
    - "/uploads/2025/11/photo2.jpg"
  results:                     # 構造化データ
    - "コスト30%削減"
    - "残業時間ゼロ"
---

# 導入の背景
ここから本文（Markdown形式）。
アプリ内では `_content` キーで編集される。
```

### 3.3 管理設定 (`site-config.yml`) スキーマ
エンジニアはこのファイルを記述することで、FubakoのUIを制御します。

**Phase 1 サンプル（最小構成）:**
```yaml
site:
  name: "サンプルコーポレート"
  
media:
  public_path: "/uploads"      # Markdownに記述されるパスの接頭辞
  upload_dir: "static/uploads" # 実際の保存場所

content_types:
  news:
    label: "ニュース"
    folder: "content/news"
    
    fields:
      - key: "title"
        type: "text"
        label: "タイトル"
        required: true
        
      - key: "date"
        type: "date"
        label: "公開日"
        default: "today"
        
      - key: "_content"
        type: "markdown"
        label: "本文"
        
      - key: "extra.thumbnail"
        type: "image"
        label: "サムネイル画像"

  cases:
    label: "導入事例"
    folder: "content/cases"
    
    fields:
      - key: "title"
        type: "text"
        label: "事例タイトル"
        required: true
        
      - key: "_content"
        type: "markdown"
        label: "本文"
        
      - key: "extra.client_name"
        type: "text"
        label: "クライアント名"
        
      - key: "extra.logo"
        type: "image"
        label: "企業ロゴ"
        
      - key: "extra.gallery"
        type: "gallery"
        label: "フォトギャラリー"
        
      - key: "extra.results"
        type: "list"
        label: "導入成果"
```

**Phase 2以降で追加される機能:**
```yaml
# 画像リサイズ設定（Phase 2）
- key: "extra.thumbnail"
  type: "image"
  label: "サムネイル"
  image_options:
    width: 800
    format: "webp"

# タクソノミー（Phase 2）
- key: "taxonomies.categories"
  type: "tags"
  label: "カテゴリー"
  suggestions: ["お知らせ", "プレスリリース", "その他"]
```

---

## 4. 機能詳細仕様

### 4.1 エディタ・編集機能

#### Phase 1 実装範囲
*   **WYSIWYG:** TipTapを使用し、Markdownを意識させないリッチテキスト編集を提供。
*   **カスタムフィールド:** `site-config.yml` の定義に基づき、以下の入力コンポーネントを描画。
    *   **実装対象:** Text, Textarea, Date, Toggle, Select, Image, Gallery, List, Object
    *   **Markdown:** TipTapエディタ（`_content`キー専用）
*   **バリデーション:** 必須項目チェック（`required: true`）のみ。

#### Phase 2以降で追加
*   文字数制限（`maxlength`）
*   カスタムバリデーションルール
*   リアルタイムプレビュー同期の高速化

### 4.2 画像管理・処理機能

#### Phase 1 実装範囲
*   **一元管理:** `static/uploads/YYYY/MM/` 形式で自動整理。
*   **リネーム:** アップロード時、ファイル名を「UUID v4」に自動変換し、ファイル名重複と日本語ファイル名によるトラブルを防止。
*   **単純コピー:** 画像をそのまま保存（リサイズなし）。

**Phase 1の動作例:**
```
入力: 社内旅行.jpg (5MB)
↓
処理:
1. UUID生成: a3f2c8e9-1234-5678-90ab-cdef12345678
2. パス決定: static/uploads/2025/11/a3f2c8e9-1234-5678-90ab-cdef12345678.jpg
3. コピー保存（変換なし）
↓
Markdownへの記述: /uploads/2025/11/a3f2c8e9-1234-5678-90ab-cdef12345678.jpg
```

#### Phase 2以降で追加
*   **リサイズ:** Electron側（Sharp）でアップロード時に以下を生成。
    *   Original: 生データ（ただし長辺2000px等で制限）
    *   Thumbnail: 管理画面一覧用（長辺400px）
*   **`image_options`対応:** 設定に基づくリサイズ・フォーマット変換

#### 画像削除の仕様（全Phase共通）
*   **記事編集時:** エディタ上で画像を削除しても、Markdown内のパス記述が消えるのみ。**物理ファイルは削除しない**。
*   **物理削除:** Phase 2以降で実装する「メディアライブラリ画面」にて、ユーザーが明示的に削除を行った場合のみ実行する。

### 4.3 プレビュー機能

#### Phase 1 実装範囲
*   **ローカルサーバー:** バックグラウンドで `zola serve` を稼働させる。
*   **Live Reload:** ファイル保存を検知し、Zolaが差分ビルド。アプリ内のWebView/Iframeをリフレッシュ。
*   **基本エラーハンドリング:** Zolaのビルドエラーを検知し、以下の3パターンのみ対応。

**Phase 1 対応エラーパターン:**

| Zolaエラーメッセージ | 正規表現 | ユーザー向け表示 |
|:---|:---|:---|
| `Broken link in (.+): tried to link to (.+)` | リンク切れ | 「{ファイル名}内のリンクが見つかりません」 |
| `Failed to parse front matter` | Frontmatter構文エラー | 「記事の設定データに誤りがあります」 |
| その他すべて | - | 「ビルドエラーが発生しました。プレビューを表示できません。」 |

#### Phase 2以降で追加
*   詳細なエラー解析（行番号、該当箇所の表示）
*   エラー修正サジェスト機能
*   テンプレート不在エラーの詳細表示

### 4.4 Git連携（排他制御）

#### Phase 1: Git機能なし
*   ローカルファイル編集のみ。
*   Gitコマンドは一切使用しない。

#### Phase 2以降で実装
*   **同期方式:** "Last Write Wins"（後勝ち）を採用。複雑なマージ機能は持たない。
*   **競合検知フロー:**
    1.  編集開始時に `git rev-parse HEAD` (現在のコミットハッシュ) を記録。
    2.  保存ボタン押下時、再度 `git fetch` & ハッシュ比較。
    3.  変更がある場合、「サーバー上のデータが更新されています。上書きしますか？」と警告モーダルを表示。
*   **デプロイ:** 「公開」ボタンで `git push` を実行。Netlify/Vercel側のWebHookでビルドが走る想定。

---

## 5. UI/UXデザイン

### 5.1 画面遷移
1.  **起動画面:** プロジェクトフォルダ（`site-data`）の選択。
2.  **ダッシュボード:**
    *   サイトの状態（最終更新日時）
    *   最近編集した記事リスト（5件まで）
    *   クイックアクション（新規ニュース作成など）
3.  **コンテンツ一覧:** 検索、ソート（日付順/タイトル順）、ステータス（公開/下書き）表示。
4.  **編集画面:** 左にフォーム/エディタ、右にリアルタイムプレビュー（分割表示）。
5.  **メディアライブラリ（Phase 2）:** アップロード済み画像の一覧、削除、URLコピー。
6.  **設定画面（Phase 2）:** Gitリモート設定、環境設定。

### 5.2 デザイン原則
*   **専門用語の排除:** "Commit", "Push", "Pull Request", "Build" などの用語は使わず、「保存」「公開」「同期」等の言葉を用いる。
*   **視覚的フィードバック:** 保存中はスピナーを表示、完了時はトースト通知。エラーは赤色でわかりやすく表示。
*   **最小限の操作:** クリック数を減らし、キーボードショートカット（Ctrl+S で保存等）を提供。

---

## 6. 開発フェーズ・ロードマップ

### Phase 1: MVP (Minimum Viable Product)
**目標:** 開発者自身のローカル環境で、サイトの作成・編集・プレビューが完結すること。

**実装範囲:**
*   Electron + Vue + Zola の基本連携
*   `site-config.yml` のパーサーとフォーム生成
*   Markdown (Frontmatter) のRead/Write
*   `_content`（本文）の分離・結合処理
*   画像アップロード（**リサイズなし**、UUID リネーム、単純コピー）
*   基本的なエラーハンドリング（3パターンのみ）
*   **Git機能なし**

**Phase 1で実装しない機能:**
*   画像リサイズ（Sharp）
*   `image_options` 設定
*   taxonomies（カテゴリ・タグ）
*   Git連携
*   config.toml との整合性チェック
*   メディアライブラリ画面

### Phase 2: 配布パッケージ化
**目標:** 知り合いの制作会社に配布し、テスト運用してもらうこと。

**実装範囲:**
*   Sharpによる画像リサイズ実装
*   `image_options` 設定の適用
*   taxonomies 対応
*   インストーラー作成（Electron Builder）
*   エラーハンドリング強化（詳細なパターン追加）
*   Git連携（Basic Auth / SSH Key設定UI）
*   config.toml との整合性チェック
*   メディアライブラリ画面

### Phase 3: サービス化
**目標:** 一般公開とマネタイズの開始。

**実装範囲:**
*   商用ライセンス管理機能
*   テンプレートテーマ（業種別）の拡充
*   検索機能（Elasticlunr.js）のUI統合
*   自動アップデート機能
*   チーム編集機能（複数ユーザー対応）

---

## 7. リスクと対策

| リスク項目 | 対策方針 | Phase |
|:---|:---|:---|
| **Zolaのバージョン依存** | 特定バージョンのZolaバイナリをアプリ内に同梱（バンドル）し、ユーザー環境に依存させない。 | 1 |
| **Windowsパス問題** | Node.jsの `path` モジュールを使用し、パス区切り文字（`/` vs `\`）を厳密に正規化する。 | 1 |
| **大容量画像の肥大化** | Phase 1では警告表示のみ。Phase 2でリサイズ実装により解決。 | 1→2 |
| **セキュリティ警告** | コード署名コストを回避するため、初期は「開発者モード」や「信頼除外設定」の手順書とともに配布する（エンジニア向けツールと割り切る）。 | 2 |
| **大容量サイトの遅延** | 記事数が数千件になった場合、一覧取得が重くなる。Phase 2以降でページネーションと遅延読み込みを実装する。 | 2-3 |
| **config.toml との不整合** | Phase 1では手動管理。Phase 2で自動チェック機能を実装。 | 1→2 |

---

## 8. まとめ

Fubakoは、段階的な開発アプローチにより、**まずは動くもの（Phase 1 MVP）を最速で作り上げる**ことを最優先とします。

**Phase 1の成功基準:**
- エンジニア自身が自サイトを管理できる
- 記事の作成・編集・プレビューが問題なく動作する
- 画像アップロード（リサイズなし）が機能する
- Zolaのビルドエラーが最低限検知できる

この基準をクリアした時点で、Phase 2（配布版）の開発に着手します。

---

**本ドキュメントに基づき、詳細設計および実装を開始します。**
