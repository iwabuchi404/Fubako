# Fubako データ設計ドキュメント

**バージョン:** 5.0.0 (Final)  
**最終更新:** 2025年11月24日

---

## 概要

Zola（Rust製SSG）の仕様に完全準拠しつつ、Electronアプリでの管理（GUI操作）を前提とした詳細データ設計ドキュメントです。

Zolaは**「Frontmatterの`extra`セクションにカスタムデータを入れる」**という明確なルールがあるため、データ構造が厳格で扱いやすいのが特徴です。

---

## 1. ファイルシステム構造

Zolaの標準ディレクトリ構造に、本ツール独自の管理設定ファイル（`site-config.yml`）を追加した構成です。

```text
site-data/
├── config.toml                # [Zola] サイト全体設定（ビルド用）
├── site-config.yml            # [App] 管理画面用設定（フィールド定義、Git設定）
│
├── content/                   # [Zola] 記事データ (Markdown)
│   ├── _index.md              # トップページ
│   ├── news/
│   │   ├── _index.md          # セクション設定 (ページネーション等)
│   │   ├── 2025-11-01-abc.md
│   │   └── ...
│   ├── cases/
│   │   ├── _index.md
│   │   └── ...
│   └── pages/                 # 固定ページ
│       ├── about.md
│       ├── contact.md
│       └── ...
│
├── static/                    # [Zola] 静的ファイル
│   └── uploads/               # [App] 画像保存先 (一元管理)
│       ├── 2025/
│       │   └── 11/
│       │       └── ...
│       └── common/
│
├── templates/                 # [Zola] テーマテンプレート (HTML/Tera)
└── sass/                      # [Zola] スタイルシート
```

---

## 2. コンテンツデータモデル (Markdown + Frontmatter)

ZolaはTOMLとYAMLの両方のFrontmatterをサポートしています。
**本ツールでは、JavaScript (Vue) でのパースの容易さと可読性から `YAML (---)` を採用します。**

### 2.1 共通データ構造

すべてのコンテンツタイプで共通する基本フィールドです。

```yaml
---
# ===== Zola標準フィールド (Built-in) =====
title: "記事タイトル"           # string (必須)
description: "SEO用ディスクリプション" # string
date: 2025-11-24               # YYYY-MM-DD
draft: false                   # boolean (trueならビルド対象外)
template: "custom.html"        # string (使用するテンプレートファイル)

# ===== タクソノミー (Categories/Tags) - Phase 2以降 =====
taxonomies:
  categories: ["お知らせ"]
  tags: ["新商品", "イベント"]

# ===== カスタムフィールド (Zolaの仕様で `extra` 下に配置) =====
extra:
  thumbnail: "/uploads/2025/11/img.jpg"
  # ここ以下に、タイプごとの独自データが入る
---

ここから本文（Markdown形式）。
アプリ内では `_content` キーで編集される。
```

### 2.2 コンテンツタイプ別定義

#### A. ニュース (News)
*   **Path:** `content/news/{YYYY-MM-DD}-{slug}.md`
*   **Template:** `news/page.html` (Zolaデフォルト)

**Phase 1 サンプル:**
```yaml
---
title: "年末年始休業のお知らせ"
date: 2025-12-01
draft: false

extra:
  thumbnail: "/uploads/2025/11/holiday.jpg"
  author: "広報担当"
---

# お知らせ内容

平素より格別のご高配を賜り、誠にありがとうございます。

年末年始の休業期間についてお知らせいたします...
```

**Phase 2以降で追加:**
```yaml
---
title: "年末年始休業のお知らせ"
date: 2025-12-01

taxonomies:
  categories: ["お知らせ"]
  tags: ["休業", "年末年始"]

extra:
  thumbnail: "/uploads/2025/11/holiday.jpg"
  author: "広報担当"
  related_links:
    - label: "詳細PDF"
      url: "/uploads/files/notice.pdf"
---

本文...
```

#### B. 導入事例 (Cases)
*   **Path:** `content/cases/{slug}.md`
*   **Template:** `cases/page.html` (明示的に指定する場合あり)

**Phase 1 サンプル:**
```yaml
---
title: "株式会社サンプル様 導入事例"
date: 2025-11-20

extra:
  client_name: "株式会社サンプル"
  industry: "製造業"
  logo: "/uploads/2025/11/sample-logo.png"
  
  challenges:
    - "在庫管理が手書き"
    - "発注漏れが多発"
  
  results:
    - "在庫差異 0%"
    - "作業時間 30%削減"
    
  gallery:
    - "/uploads/2025/11/sample-1.jpg"
    - "/uploads/2025/11/sample-2.jpg"
---

## 導入前の課題

株式会社サンプル様では、長年手書きでの在庫管理を行っていました...

## 導入後の成果

システム導入により、在庫差異がゼロになり...
```

#### C. 固定ページ (Pages)
*   **Path:** `content/pages/{filename}.md` (例: `about.md`)
*   **Template:** フロントマターの `template` で指定

**Phase 1 サンプル:**
```yaml
---
title: "会社概要"
template: "about.html"  # templates/about.html を使用

extra:
  ceo_name: "山田 太郎"
  founded_date: "2010-04-01"
  address: "東京都渋谷区..."
  map_url: "https://maps.google.com/..."
---

## 会社情報

当社は2010年に設立され...
```

---

## 3. アプリ設定スキーマ (`site-config.yml`)

このファイルが**「管理画面のUIジェネレーター」**として機能します。
エンジニア（導入者）がここを記述することで、クライアント用の入力画面が自動生成されます。

### 3.1 構造定義

**Phase 1 完全サンプル:**
```yaml
# サイト基本情報（アプリのヘッダー等に表示）
site:
  name: "株式会社〇〇 コーポレートサイト"
  preview_url: "http://localhost:1111"

# 画像設定
media:
  upload_dir: "static/uploads"
  public_path: "/uploads"      # Markdownに書き込まれるパスのプレフィックス

# コンテンツタイプ定義
content_types:
  
  # --- ニュース設定 ---
  news:
    label: "ニュース"
    folder: "content/news"
    sort: "date_desc"
    
    # 一覧画面での表示項目
    list_columns:
      - key: "date"
        label: "日付"
      - key: "title"
        label: "タイトル"
        
    # 入力フィールド定義
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

      # 本文（必須）
      - key: "_content"
        type: "markdown"
        label: "本文"

      # カスタムフィールド (extra配下)
      - key: "extra.thumbnail"
        type: "image"
        label: "サムネイル画像"
      
      - key: "extra.author"
        type: "text"
        label: "投稿者"
        placeholder: "例: 広報部"

  # --- 導入事例設定 ---
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
```

**Phase 2以降で追加される設定例:**
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

- key: "taxonomies.tags"
  type: "tags"
  label: "タグ"

# 構造化データ（オブジェクト）
- key: "extra.seo"
  type: "object"
  label: "SEO設定"
  fields:
    - key: "description"
      type: "textarea"
      label: "メタディスクリプション"
      maxlength: 160
    - key: "noindex"
      type: "toggle"
      label: "検索エンジンから除外"
      default: false
```

### 3.2 サポートするフィールドタイプ (UI Component)

Electronアプリ側で実装する入力コンポーネントの種類です。

| タイプ | UIコンポーネント | 保存データ型 | 必須属性 | オプション属性 | Phase |
|:---|:---|:---|:---|:---|:---|
| `text` | 1行テキストボックス | String | `label` | `placeholder`, `required`, `maxlength` | 1 |
| `textarea` | 複数行テキストエリア | String | `label` | `rows`, `placeholder`, `maxlength` | 1 |
| `markdown` | **TipTapエディタ** | Body (Frontmatter外) | `label` | - | 1 |
| `date` | カレンダーピッカー | String (YYYY-MM-DD) | `label` | `default: "today"` | 1 |
| `toggle` | スイッチ | Boolean | `label` | `default: false` | 1 |
| `select` | ドロップダウン | String | `label`, `options` | `required` | 1 |
| `tags` | タグ入力UI | Array [String] | `label` | `suggestions` | 2 |
| `image` | 画像アップローダー | String (Path) | `label` | `image_options` (Phase 2) | 1 |
| `gallery` | 複数画像アップローダー | Array [String] | `label` | - (image_options非対応) | 1 |
| `list` | 文字列リスト入力 | Array [String] | `label` | - | 1 |
| `object` | ネストされたフォーム | Map | `label`, `fields` | - | 1 |

#### 特殊フィールドの詳細

##### A. `markdown` タイプ
- **key:** 必ず `_content` を使用
- **保存先:** Frontmatter外（`---`区切りの後）
- **用途:** 記事本文の入力

##### B. `list` タイプ
- **UI:** 動的リスト（+ボタンで行追加、×ボタンで削除）
- **並び替え:** Phase 1 では未対応（Phase 2で実装）
- **用途:** 箇条書きデータ（課題、成果など）

```
UI イメージ（Phase 1）:
┌─────────────────────────┐
│ 項目1              [×] │
│ 項目2              [×] │
│ 項目3              [×] │
│ [+ 項目を追加]          │
└─────────────────────────┘
```

##### C. `gallery` タイプ
- **UI:** 複数画像選択・アップロード
- **並び替え:** D&D（Drag & Drop）対応
- **制限:** `image_options` は使用不可
- **保存:** 配列の順序がそのまま表示順序

##### D. `object` タイプ
- **UI:** ネストされたフォームを展開表示
- **制限:** Phase 1 では最大ネスト深度3階層まで
- **用途:** SEO設定、構造化データなど

```yaml
# 設定例
- key: "extra.contact"
  type: "object"
  label: "連絡先情報"
  fields:
    - key: "email"
      type: "text"
      label: "メールアドレス"
    - key: "phone"
      type: "text"
      label: "電話番号"
```

---

## 4. 資産管理（画像）の設計

### 4.1 保存パスのルール

Windows/Mac間のパス互換性と、ファイル名重複を防ぐため、アプリ側でリネーム処理を行います。

#### Phase 1 の処理フロー

```
入力: 社内旅行.jpg (5MB, 4000x3000px)
↓
処理:
1. 現在年月を取得 → 2025/11
2. UUID v4 生成 → a3f2c8e9-1234-5678-90ab-cdef12345678
3. 拡張子保持 → .jpg
4. パス決定 → static/uploads/2025/11/a3f2c8e9-1234-5678-90ab-cdef12345678.jpg
5. ファイルコピー（変換なし）
↓
保存先: static/uploads/2025/11/a3f2c8e9-1234-5678-90ab-cdef12345678.jpg
Markdownへの記述: /uploads/2025/11/a3f2c8e9-1234-5678-90ab-cdef12345678.jpg
```

**注意:** Zolaは `static` フォルダの中身をルートに展開するため、パスから `static` を除く必要があります。

#### Phase 2以降の処理フロー

```
入力: 社内旅行.jpg (5MB, 4000x3000px)
↓
処理:
1. UUID生成
2. Sharp でリサイズ:
   - Original: 長辺2000pxにリサイズ（肥大化防止）
   - または image_options に従う
3. WebP変換（オプション）
4. Thumbnail生成（長辺400px）
↓
保存:
- static/uploads/2025/11/a3f2c8e9-xxx.webp (Original)
- static/uploads/2025/11/a3f2c8e9-xxx_thumb.webp (Thumbnail)
```

### 4.2 画像削除の仕様（全Phase共通）

#### 原則: 物理ファイルは削除しない

**理由:**
- 複数記事からの参照を追跡するのは複雑でバグの温床
- 誤削除のリスクが高い
- Phase 1 では参照カウント機能を実装しない

**動作:**
1. **記事編集画面で画像を削除:**
   - Markdownの `extra.thumbnail` や `gallery` 配列から該当パスを削除
   - 物理ファイル（`static/uploads/...`）は**残る**

2. **物理削除（Phase 2以降）:**
   - 「メディアライブラリ」画面で明示的に削除操作を行った場合のみ
   - 削除前に警告ダイアログ表示
   - 削除後は復元不可

---

## 5. データ整合性と保存ロジック

### 5.1 データ変換の詳細（Input → Markdown）

#### Phase 1 実装: Main Process での変換処理

**Step 1: Vue Component からの送信データ**
```json
{
  "title": "新製品リリース",
  "date": "2025-11-24",
  "draft": false,
  "extra.thumbnail": "/uploads/2025/11/thumb.jpg",
  "extra.author": "広報部",
  "extra.results": ["売上30%増", "認知度向上"],
  "_content": "# 製品概要\n\n新製品をリリースしました..."
}
```

**Step 2: Main Process での階層構造化**
```javascript
// 疑似コード
function structureData(flatData) {
  const structured = {};
  const content = flatData._content;
  delete flatData._content;
  
  for (const [key, value] of Object.entries(flatData)) {
    if (key.startsWith('extra.')) {
      // extra.thumbnail → extra: { thumbnail: "..." }
      setNested(structured, key.split('.'), value);
    } else if (key.startsWith('taxonomies.')) {
      // taxonomies.categories → taxonomies: { categories: [...] }
      setNested(structured, key.split('.'), value);
    } else {
      // title, date, draft などはルート配置
      structured[key] = value;
    }
  }
  
  return { structured, content };
}
```

**Step 3: YAML 生成と Markdown 結合**
```javascript
import yaml from 'js-yaml';

function buildMarkdown({ structured, content }) {
  const frontmatter = yaml.dump(structured, {
    indent: 2,
    lineWidth: -1, // 改行なし
    noRefs: true,  // 参照なし
  });
  
  return `---\n${frontmatter}---\n\n${content}`;
}
```

**Step 4: 最終出力（Markdownファイル）**
```yaml
---
title: "新製品リリース"
date: 2025-11-24
draft: false

extra:
  thumbnail: "/uploads/2025/11/thumb.jpg"
  author: "広報部"
  results:
    - "売上30%増"
    - "認知度向上"
---

# 製品概要

新製品をリリースしました...
```

### 5.2 データ読み込みの詳細（Markdown → Input）

**Step 1: Markdownファイルの読み込み**
```javascript
import fs from 'fs';
import yaml from 'js-yaml';

function parseMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Frontmatter と Body を分離
  const match = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
  
  if (!match) {
    throw new Error('Invalid Markdown format');
  }
  
  const frontmatter = yaml.load(match[1]);
  const body = match[2].trim();
  
  return { frontmatter, body };
}
```

**Step 2: フラット化してVueへ送信**
```javascript
function flattenData(frontmatter, body) {
  const flat = { _content: body };
  
  function flatten(obj, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        flatten(value, newKey);
      } else {
        flat[newKey] = value;
      }
    }
  }
  
  flatten(frontmatter);
  return flat;
}
```

**Step 3: Vue Component での受信**
```json
{
  "title": "新製品リリース",
  "date": "2025-11-24",
  "draft": false,
  "extra.thumbnail": "/uploads/2025/11/thumb.jpg",
  "extra.author": "広報部",
  "extra.results": ["売上30%増", "認知度向上"],
  "_content": "# 製品概要\n\n新製品をリリースしました..."
}
```

### 5.3 バリデーション（Phase 1）

**実装する検証:**
- `required: true` のフィールドが空でないか
- `date` 型が有効な日付形式（YYYY-MM-DD）か
- `_content` が存在するか（本文必須の場合）

**実装しない検証（Phase 2以降）:**
- `maxlength` の文字数制限
- カスタムバリデーションルール
- リンク切れチェック
- 画像ファイルの存在確認

---

## 6. Zola設定 (`config.toml`) との関係

### 6.1 設定ファイルの役割分担

| ファイル | 役割 | 管理者 | 変更頻度 |
|:---|:---|:---|:---|
| `config.toml` | Zolaのビルド設定（URL、言語、テーマ設定） | エンジニア | 低 |
| `site-config.yml` | Fubakoの管理画面設定（フィールド定義） | エンジニア | 中 |

### 6.2 config.toml のサンプル

```toml
# config.toml
base_url = "https://example.com"
title = "My Corporate Site"
default_language = "ja"
compile_sass = true
build_search_index = false  # Phase 1では未使用

[extra]
# テーマ固有の設定（Fubakoは触らない）
footer_text = "Copyright 2025 Example Inc."
show_social_links = true
```

### 6.3 Phase 1 での扱い

**アプリの動作:**
- `config.toml` を読み込み、`base_url` と `title` を認識
- プレビューURL構築に使用
- **書き換えは行わない**

**Phase 2以降:**
- `taxonomies` の整合性チェック
- `site-config.yml` で定義された `taxonomies.*` が `config.toml` に存在するか検証
- 不一致があれば警告表示

```toml
# Phase 2で必要になる設定
[taxonomies]
categories = { name = "categories", paginate_by = 5 }
tags = { name = "tags", paginate_by = 10 }
```

---

## 7. データ整合性と排他制御（Phase 2以降）

### 7.1 ローカルファイル編集の競合検知

Git連携機能を利用する場合の簡易排他制御です。

**Phase 1:** 実装なし（単一ユーザー・ローカル編集のみ）

**Phase 2以降:**

1.  **Read時:**
    *   ファイルを読み込んだ時点での `Git Commit Hash` を記録
2.  **Write時:**
    *   保存ボタン押下直前に、`git rev-parse HEAD` で現在のハッシュを取得
    *   `Current Hash` != `Saved Hash` の場合、**「警告モーダル」**を表示
3.  **解決策:**
    *   [強制上書き] or [キャンセルしてリロード] の二択のみ提供（マージ機能は提供しない）

---

## 8. まとめ

### Phase 1 で完成するデータモデル

✅ **実装済み:**
- Markdown (Frontmatter + Body) の読み書き
- `_content` による本文の分離
- `extra` セクションへのカスタムフィールド格納
- UUID による画像リネーム
- 基本的なフィールドタイプ（text, textarea, markdown, date, toggle, select, image, gallery, list, object）

❌ **未実装（Phase 2以降）:**
- 画像リサイズ (`image_options`)
- taxonomies（カテゴリ・タグ）
- config.toml との整合性チェック
- Git連携

### データ設計の特徴

*   **Zola準拠:** データ構造はZolaが最も処理しやすい `YAML Frontmatter` + `extra` セクション構成
*   **設定分離:** アプリの挙動（UI定義）は `site-config.yml` に集約し、Zolaの `config.toml` を汚さない
*   **GUI主導:** すべてのデータモデルは、エンジニアがYAMLで定義可能にし、Vue.js側で動的にフォームをレンダリング

---

**本ドキュメントに基づき、Phase 1 の実装を開始できます。**
