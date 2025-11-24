# Fubako 設定ファイル仕様書 (site-config.yml)

**バージョン:** 5.0.0 (Final)  
**最終更新:** 2025年11月24日

---

## 1. 概要

`site-config.yml` は、Fubakoアプリの**管理画面UI生成のための定義ファイル**です。

エンジニアがこのファイルを記述することで、クライアント向けの入力画面（フォーム、エディタ、画像アップローダー等）が自動生成されます。

**特徴:**
- YAML形式（人間が読み書きしやすい）
- Zolaの `config.toml` とは独立（役割分担明確）
- フィールドタイプをサポート（10種類）

---

## 2. ファイル構造

### 2.1 ルート定義

```yaml
site:
  name: "株式会社サンプル コーポレートサイト"
  preview_url: "http://localhost:1111"  # Zolaプレビューサーバーのアドレス

media:
  public_path: "/uploads"       # Markdownに記述されるパスのプレフィックス
  upload_dir: "static/uploads"  # 物理保存先（Zolaのstaticフォルダ配下）

content_types:
  news:
    label: "ニュース"
    folder: "content/news"      # 監視・保存対象フォルダ
    sort: "date_desc"           # 一覧のデフォルト並び順
    fields: [ ... ]             # フィールド定義（後述）
  
  cases:
    label: "導入事例"
    folder: "content/cases"
    fields: [ ... ]
```

#### ルートフィールドの説明

| フィールド | 型 | 必須 | 説明 |
|:---|:---|:---|:---|
| `site.name` | String | ✅ | アプリのヘッダーに表示されるサイト名 |
| `site.preview_url` | String | ❌ | プレビューサーバーのURL（デフォルト: `http://localhost:1111`） |
| `media.public_path` | String | ✅ | Markdownに書き込まれる画像パスのプレフィックス |
| `media.upload_dir` | String | ✅ | 画像の物理保存先ディレクトリ |
| `content_types` | Object | ✅ | コンテンツタイプの定義（複数可） |

---

### 2.2 コンテンツタイプ定義

各コンテンツタイプ（`news`, `cases`等）は以下の構造を持ちます。

```yaml
content_types:
  {type_key}:                   # 例: news, cases, pages
    label: "表示名"              # UIに表示される名前
    folder: "content/xxx"       # Markdownファイルの保存先
    sort: "date_desc"           # 一覧のソート順（オプション）
    list_columns: [ ... ]       # 一覧画面での表示カラム（オプション）
    fields: [ ... ]             # 入力フィールド定義（必須）
```

#### フィールドの説明

| フィールド | 型 | 必須 | デフォルト | 説明 |
|:---|:---|:---|:---|:---|
| `label` | String | ✅ | - | UIに表示されるコンテンツタイプ名 |
| `folder` | String | ✅ | - | 記事の保存先ディレクトリ（`content/`からの相対パス） |
| `sort` | String | ❌ | `date_desc` | 一覧画面のデフォルトソート順（`date_desc`, `date_asc`, `title_asc`, `title_desc`） |
| `list_columns` | Array | ❌ | `[{key: "date"}, {key: "title"}]` | 一覧画面に表示するカラム |
| `fields` | Array | ✅ | - | 入力フィールドの定義配列 |

---

## 3. フィールド定義 (fields)

`fields` 配列内の各オブジェクトが、1つの入力項目を定義します。

### 3.1 共通フィールド属性

すべてのフィールドタイプで使用できる共通属性です。

| 属性 | 型 | 必須 | 説明 |
|:---|:---|:---|:---|
| `key` | String | ✅ | データ保存時のキー名（ドット記法で階層化可能） |
| `type` | String | ✅ | フィールドタイプ（後述の10種類） |
| `label` | String | ✅ | UIに表示されるラベル |
| `required` | Boolean | ❌ | 必須項目かどうか（デフォルト: `false`） |
| `help` | String | ❌ | 入力項目の説明文（UI下部に表示） |

### 3.2 フィールドタイプ一覧

| タイプ | UIコンポーネント | 保存データ型 | Phase |
|:---|:---|:---|:---|
| `text` | 1行テキストボックス | String | 1 |
| `textarea` | 複数行テキストエリア | String | 1 |
| `markdown` | TipTapエディタ | Body (Frontmatter外) | 1 |
| `date` | カレンダーピッカー | String (YYYY-MM-DD) | 1 |
| `toggle` | スイッチ | Boolean | 1 |
| `select` | ドロップダウン | String | 1 |
| `tags` | タグ入力UI | Array [String] | 2 |
| `image` | 画像アップローダー | String (Path) | 1 |
| `gallery` | 複数画像アップローダー | Array [String] | 1 |
| `list` | 文字列リスト入力 | Array [String] | 1 |
| `object` | ネストされたフォーム | Map | 1 |

---

### 3.3 タイプ別の詳細仕様

#### A. `text` タイプ

**用途:** 短いテキスト入力（タイトル、名前など）

```yaml
- key: "title"
  type: "text"
  label: "タイトル"
  required: true
  placeholder: "記事のタイトルを入力"
  maxlength: 100
```

**オプション属性:**

| 属性 | 型 | デフォルト | 説明 | Phase |
|:---|:---|:---|:---|:---|
| `placeholder` | String | - | プレースホルダー文字列 | 1 |
| `maxlength` | Integer | - | 最大文字数（Phase 2で検証実装） | 2 |

---

#### B. `textarea` タイプ

**用途:** 複数行のテキスト入力（概要、説明など）

```yaml
- key: "description"
  type: "textarea"
  label: "概要"
  rows: 5
  placeholder: "記事の概要を入力"
  maxlength: 500
```

**オプション属性:**

| 属性 | 型 | デフォルト | 説明 | Phase |
|:---|:---|:---|:---|:---|
| `rows` | Integer | 3 | 表示行数 | 1 |
| `placeholder` | String | - | プレースホルダー文字列 | 1 |
| `maxlength` | Integer | - | 最大文字数（Phase 2で検証実装） | 2 |

---

#### C. `markdown` タイプ

**用途:** 記事本文の入力（TipTapエディタ）

```yaml
- key: "_content"
  type: "markdown"
  label: "本文"
```

**重要な制約:**
- `key` は**必ず `_content`** を使用
- 保存先はFrontmatter外（`---`区切りの後）
- 1つのコンテンツタイプに1つのみ定義可能

**オプション属性:** なし

---

#### D. `date` タイプ

**用途:** 日付入力（公開日、イベント日など）

```yaml
- key: "date"
  type: "date"
  label: "公開日"
  default: "today"
```

**オプション属性:**

| 属性 | 型 | デフォルト | 説明 | Phase |
|:---|:---|:---|:---|:---|
| `default` | String | - | デフォルト値（`"today"` で今日の日付） | 1 |

**保存形式:** `YYYY-MM-DD`（例: `2025-11-24`）

---

#### E. `toggle` タイプ

**用途:** ON/OFF スイッチ（下書き、公開フラグなど）

```yaml
- key: "draft"
  type: "toggle"
  label: "下書き"
  default: false
```

**オプション属性:**

| 属性 | 型 | デフォルト | 説明 | Phase |
|:---|:---|:---|:---|:---|
| `default` | Boolean | `false` | デフォルト値 | 1 |

**保存形式:** `true` / `false`

---

#### F. `select` タイプ

**用途:** ドロップダウン選択（カテゴリ、業種など）

```yaml
- key: "extra.industry"
  type: "select"
  label: "業種"
  options: ["製造業", "小売業", "サービス業", "IT", "その他"]
  required: true
```

**オプション属性:**

| 属性 | 型 | デフォルト | 説明 | Phase |
|:---|:---|:---|:---|:---|
| `options` | Array[String] | - | 選択肢の配列（必須） | 1 |

**保存形式:** String（選択された1つの値）

---

#### G. `tags` タイプ（Phase 2以降）

**用途:** タグ入力（カテゴリ、タグなど）

```yaml
- key: "taxonomies.categories"
  type: "tags"
  label: "カテゴリー"
  suggestions: ["お知らせ", "プレスリリース", "その他"]
```

**オプション属性:**

| 属性 | 型 | デフォルト | 説明 | Phase |
|:---|:---|:---|:---|:---|
| `suggestions` | Array[String] | - | サジェスト候補（フリー入力も可） | 2 |

**保存形式:** Array[String]（例: `["お知らせ", "新機能"]`）

**Phase 2での注意:**
- `config.toml` に対応する taxonomies 定義が必要
- アプリ起動時に整合性チェックを実施

---

#### H. `image` タイプ

**用途:** 画像アップロード（サムネイル、ロゴなど）

**Phase 1:**
```yaml
- key: "extra.thumbnail"
  type: "image"
  label: "サムネイル画像"
```

**Phase 2以降:**
```yaml
- key: "extra.thumbnail"
  type: "image"
  label: "サムネイル画像"
  image_options:
    width: 800           # 長辺をこのサイズにリサイズ
    format: "webp"       # 変換フォーマット（webp, jpg, png）
```

**オプション属性:**

| 属性 | 型 | デフォルト | 説明 | Phase |
|:---|:---|:---|:---|:---|
| `image_options.width` | Integer | - | リサイズ幅（長辺） | 2 |
| `image_options.format` | String | - | 変換フォーマット（webp, jpg, png） | 2 |

**保存形式:** String（画像パス、例: `/uploads/2025/11/abc123.jpg`）

---

#### I. `gallery` タイプ

**用途:** 複数画像の一括アップロード

```yaml
- key: "extra.gallery"
  type: "gallery"
  label: "フォトギャラリー"
```

**オプション属性:** なし（`image_options` は使用不可）

**保存形式:** Array[String]（画像パスの配列）

```yaml
extra:
  gallery:
    - "/uploads/2025/11/photo1.jpg"
    - "/uploads/2025/11/photo2.jpg"
    - "/uploads/2025/11/photo3.jpg"
```

**UI機能:**
- D&D（Drag & Drop）で並び替え可能
- 各画像に削除ボタン表示
- 配列の順序がそのまま表示順序

---

#### J. `list` タイプ

**用途:** 文字列リストの入力（箇条書き）

```yaml
- key: "extra.results"
  type: "list"
  label: "導入成果"
```

**オプション属性:** なし

**保存形式:** Array[String]

```yaml
extra:
  results:
    - "コスト30%削減"
    - "作業時間50%短縮"
    - "顧客満足度向上"
```

**UI仕様（Phase 1）:**
```
┌────────────────────────────────┐
│ コスト30%削減           [×]   │
│ 作業時間50%短縮         [×]   │
│ 顧客満足度向上          [×]   │
│ [+ 項目を追加]                 │
└────────────────────────────────┘
```

- +ボタンで1行追加
- ×ボタンで削除
- Phase 1では並び替え不可（Phase 2で実装）

---

#### K. `object` タイプ

**用途:** 構造化データの入力（ネストフォーム）

```yaml
- key: "extra.contact"
  type: "object"
  label: "連絡先情報"
  fields:
    - key: "email"
      type: "text"
      label: "メールアドレス"
      placeholder: "info@example.com"
    - key: "phone"
      type: "text"
      label: "電話番号"
      placeholder: "03-1234-5678"
    - key: "address"
      type: "textarea"
      label: "住所"
      rows: 3
```

**オプション属性:**

| 属性 | 型 | デフォルト | 説明 | Phase |
|:---|:---|:---|:---|:---|
| `fields` | Array | - | 子フィールドの定義配列（必須） | 1 |

**保存形式:** Map（オブジェクト）

```yaml
extra:
  contact:
    email: "info@example.com"
    phone: "03-1234-5678"
    address: "東京都渋谷区..."
```

**制約（Phase 1）:**
- 最大ネスト深度: 3階層まで
- `object` の中に `object` を定義可能だが、3階層を超えると警告

---

## 4. 実装サンプル

### 4.1 Phase 1 完全サンプル

```yaml
site:
  name: "株式会社サンプル コーポレートサイト"
  preview_url: "http://localhost:1111"

media:
  public_path: "/uploads"
  upload_dir: "static/uploads"

content_types:
  # ===== ニュース =====
  news:
    label: "ニュース"
    folder: "content/news"
    sort: "date_desc"
    
    list_columns:
      - key: "date"
        label: "日付"
      - key: "title"
        label: "タイトル"
    
    fields:
      # Zola標準フィールド
      - key: "title"
        type: "text"
        label: "タイトル"
        required: true
        placeholder: "記事のタイトルを入力"
      
      - key: "date"
        type: "date"
        label: "公開日"
        default: "today"
      
      - key: "draft"
        type: "toggle"
        label: "下書き"
        default: false
      
      # 本文
      - key: "_content"
        type: "markdown"
        label: "本文"
      
      # カスタムフィールド
      - key: "extra.thumbnail"
        type: "image"
        label: "サムネイル画像"
      
      - key: "extra.author"
        type: "text"
        label: "投稿者"
        placeholder: "例: 広報部"

  # ===== 導入事例 =====
  cases:
    label: "導入事例"
    folder: "content/cases"
    
    fields:
      - key: "title"
        type: "text"
        label: "事例タイトル"
        required: true
      
      - key: "date"
        type: "date"
        label: "公開日"
        default: "today"
      
      - key: "_content"
        type: "markdown"
        label: "本文"
      
      - key: "extra.client_name"
        type: "text"
        label: "企業名"
        required: true
      
      - key: "extra.industry"
        type: "select"
        label: "業種"
        options: ["製造業", "小売業", "サービス業", "IT", "その他"]
      
      - key: "extra.logo"
        type: "image"
        label: "企業ロゴ"
      
      - key: "extra.challenges"
        type: "list"
        label: "導入前の課題"
      
      - key: "extra.results"
        type: "list"
        label: "導入成果"
      
      - key: "extra.gallery"
        type: "gallery"
        label: "フォトギャラリー"
      
      - key: "extra.contact"
        type: "object"
        label: "担当者情報"
        fields:
          - key: "name"
            type: "text"
            label: "氏名"
          - key: "position"
            type: "text"
            label: "役職"

  # ===== 固定ページ =====
  pages:
    label: "固定ページ"
    folder: "content/pages"
    
    fields:
      - key: "title"
        type: "text"
        label: "ページタイトル"
        required: true
      
      - key: "template"
        type: "select"
        label: "テンプレート"
        options: ["page.html", "about.html", "contact.html"]
      
      - key: "_content"
        type: "markdown"
        label: "本文"
```

### 4.2 Phase 2 追加サンプル

```yaml
# Phase 2で追加される機能の例

content_types:
  news:
    fields:
      # 画像リサイズ設定
      - key: "extra.thumbnail"
        type: "image"
        label: "サムネイル"
        image_options:
          width: 800
          format: "webp"
      
      # タクソノミー（タグ）
      - key: "taxonomies.categories"
        type: "tags"
        label: "カテゴリー"
        suggestions: ["お知らせ", "プレスリリース", "その他"]
      
      - key: "taxonomies.tags"
        type: "tags"
        label: "タグ"
      
      # SEO設定（オブジェクト）
      - key: "extra.seo"
        type: "object"
        label: "SEO設定"
        fields:
          - key: "description"
            type: "textarea"
            label: "メタディスクリプション"
            maxlength: 160
          - key: "keywords"
            type: "text"
            label: "メタキーワード"
          - key: "noindex"
            type: "toggle"
            label: "検索エンジンから除外"
            default: false
```

---

## 5. ベストプラクティス

### 5.1 キー命名規則

**推奨:**
- Zola標準フィールド: `title`, `date`, `draft`, `template`
- カスタムフィールド: `extra.{field_name}`
- タクソノミー: `taxonomies.{taxonomy_name}`

**非推奨:**
- スペースを含むキー名
- 予約語の使用（`type`, `id`, `url` など）

### 5.2 必須フィールドの設定

**必ず含めるべきフィールド:**
```yaml
- key: "title"
  type: "text"
  required: true

- key: "date"
  type: "date"
  default: "today"

- key: "_content"
  type: "markdown"
```

### 5.3 画像フィールドの配置

**推奨順序:**
1. 標準フィールド（title, date, draft）
2. 本文（_content）
3. 画像（thumbnail, logo）
4. その他カスタムフィールド

**理由:** ユーザーは上から順に入力するため、重要度順に配置

---

## 6. トラブルシューティング

### Q1. フィールドが表示されない

**原因:**
- `key` のスペルミス
- YAML構文エラー

**対策:**
- YAMLバリデーターで構文チェック
- アプリのエラーログを確認

### Q2. 画像がアップロードできない

**原因:**
- `media.upload_dir` のパスが間違っている
- ディレクトリの書き込み権限がない

**対策:**
- パスを確認（`static/uploads` が正しい）
- フォルダが存在するか確認

### Q3. taxonomies が機能しない（Phase 2）

**原因:**
- `config.toml` に定義がない
- キー名が不一致

**対策:**
- `config.toml` に以下を追加:
```toml
[taxonomies]
categories = { name = "categories" }
tags = { name = "tags" }
```

---

## 7. まとめ

`site-config.yml` は、Fubakoの**UIを制御する中核ファイル**です。

**Phase 1 で使用可能なフィールドタイプ:**
- text, textarea, markdown, date, toggle, select, image, gallery, list, object

**Phase 2以降で追加されるフィールドタイプ:**
- tags（タクソノミー対応）

**Phase 2以降で追加される機能:**
- `image_options` によるリサイズ
- `maxlength` バリデーション
- taxonomies の自動整合性チェック

---

**本仕様書に基づき、エンジニアは `site-config.yml` を作成し、Fubakoアプリで管理画面を構築できます。**
