# Fubako データ構造・スキーマ定義書

**バージョン:** 5.0.0 (Final)  
**最終更新:** 2025年11月24日

---

## 1. データ保存モデル

Markdownファイルは、**Frontmatter (YAML)** と **本文 (Body)** に分離して保存・読み込みを行う。

### 1.1 保存ロジック（詳細仕様）

Electron Main Processは以下のルールで結合を行う。

#### Step 1: 入力データの受信

**Vue Component からの送信データ（フラット構造）:**
```json
{
  "title": "新製品リリース",
  "date": "2025-11-24",
  "draft": false,
  "taxonomies.categories": ["ニュース"],
  "extra.thumbnail": "/uploads/2025/11/thumb.jpg",
  "extra.author": "広報部",
  "extra.seo.description": "新製品の概要",
  "extra.seo.noindex": false,
  "extra.results": ["売上30%増", "認知度向上"],
  "_content": "# 製品概要\n\n新製品をリリースしました..."
}
```

#### Step 2: データ変換処理

**Main Process での処理フロー:**

```javascript
// 疑似コード
function processContentData(flatData) {
  // 1. _content 分離
  const content = flatData._content || '';
  delete flatData._content;
  
  // 2. 階層構造化
  const structured = structureData(flatData);
  
  // 3. フィールド分類
  const frontmatter = classifyFields(structured);
  
  return { frontmatter, content };
}
```

**階層構造化関数:**

```javascript
function structureData(flatData) {
  const structured = {};
  
  for (const [key, value] of Object.entries(flatData)) {
    const parts = key.split('.');
    let current = structured;
    
    // ネスト構造を作成
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    // 最終キーに値を設定
    current[parts[parts.length - 1]] = value;
  }
  
  return structured;
}
```

**実行例:**
```javascript
// 入力
{
  "extra.seo.description": "概要",
  "extra.seo.noindex": false
}

// 出力
{
  extra: {
    seo: {
      description: "概要",
      noindex: false
    }
  }
}
```

**フィールド分類関数:**

```javascript
function classifyFields(structured) {
  // Zolaの仕様に従ってルートフィールドと extra を分離
  const ROOT_FIELDS = ['title', 'description', 'date', 'draft', 'template', 'taxonomies'];
  
  const frontmatter = {};
  
  for (const [key, value] of Object.entries(structured)) {
    if (ROOT_FIELDS.includes(key)) {
      // ルート配置
      frontmatter[key] = value;
    } else {
      // extra セクションへ
      if (!frontmatter.extra) {
        frontmatter.extra = {};
      }
      frontmatter.extra[key] = value;
    }
  }
  
  return frontmatter;
}
```

**実行例:**
```javascript
// 入力
{
  title: "記事",
  date: "2025-11-24",
  thumbnail: "/uploads/img.jpg",
  author: "広報部"
}

// 出力
{
  title: "記事",
  date: "2025-11-24",
  extra: {
    thumbnail: "/uploads/img.jpg",
    author: "広報部"
  }
}
```

#### Step 3: Markdown 生成

**YAML生成:**

```javascript
const yaml = require('js-yaml');

function buildMarkdown({ frontmatter, content }) {
  // YAML生成
  const yamlString = yaml.dump(frontmatter, {
    indent: 2,           // インデント幅
    lineWidth: -1,       // 行折り返しなし
    noRefs: true,        // 参照なし
    sortKeys: false,     // キーソートなし（定義順維持）
    noCompatMode: true   // 互換モードなし
  });
  
  // Markdown結合
  return `---\n${yamlString}---\n\n${content}`;
}
```

#### Step 4: ファイル書き込み

**最終出力（Markdownファイル）:**

```yaml
---
title: "新製品リリース"
date: 2025-11-24
draft: false
taxonomies:
  categories:
    - ニュース

extra:
  thumbnail: "/uploads/2025/11/thumb.jpg"
  author: "広報部"
  seo:
    description: "新製品の概要"
    noindex: false
  results:
    - "売上30%増"
    - "認知度向上"
---

# 製品概要

新製品をリリースしました...
```

---

### 1.2 読み込みロジック（詳細仕様）

#### Step 1: Markdownファイルの読み込み

```javascript
const fs = require('fs').promises;
const yaml = require('js-yaml');

async function loadMarkdown(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  
  // Frontmatter と Body の分離
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/);
  
  if (!match) {
    throw new Error('Invalid Markdown format: Frontmatter not found');
  }
  
  const frontmatterYaml = match[1];
  const body = match[2].trim();
  
  return { frontmatterYaml, body };
}
```

#### Step 2: YAML パース

```javascript
function parseFrontmatter(frontmatterYaml) {
  try {
    const frontmatter = yaml.load(frontmatterYaml);
    return frontmatter;
  } catch (error) {
    throw new Error(`YAML parse error: ${error.message}`);
  }
}
```

#### Step 3: フラット化

```javascript
function flattenData(frontmatter, body) {
  const flat = { _content: body };
  
  function flatten(obj, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      // オブジェクトの場合は再帰
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        flatten(value, newKey);
      } else {
        // プリミティブ値または配列
        flat[newKey] = value;
      }
    }
  }
  
  flatten(frontmatter);
  return flat;
}
```

**実行例:**
```javascript
// 入力（Frontmatter）
{
  title: "記事",
  date: "2025-11-24",
  extra: {
    thumbnail: "/uploads/img.jpg",
    seo: {
      description: "概要",
      noindex: false
    }
  }
}

// 出力（フラット構造）
{
  "_content": "# 本文...",
  "title": "記事",
  "date": "2025-11-24",
  "extra.thumbnail": "/uploads/img.jpg",
  "extra.seo.description": "概要",
  "extra.seo.noindex": false
}
```

#### Step 4: Vue Component への送信

**Renderer Process での受信:**

```javascript
// Vue Component
const formData = reactive({});

async function loadContent(type, slug) {
  const data = await window.electronAPI.loadContent(type, slug);
  
  // フラットデータをフォームに反映
  Object.assign(formData, data);
}
```

---

## 2. データ型と変換規則

### 2.1 フィールドタイプ別の保存形式

| フィールドタイプ | 入力形式 | 保存形式 | 例 |
|:---|:---|:---|:---|
| `text` | String | String | `"サンプル"` |
| `textarea` | String | String | `"複数行\nテキスト"` |
| `markdown` | String | Body | `"# 見出し\n本文"` |
| `date` | String | String (YYYY-MM-DD) | `"2025-11-24"` |
| `toggle` | Boolean | Boolean | `true` / `false` |
| `select` | String | String | `"製造業"` |
| `tags` | Array[String] | Array[String] | `["お知らせ", "重要"]` |
| `image` | String | String (Path) | `"/uploads/2025/11/abc.jpg"` |
| `gallery` | Array[String] | Array[String] | `["/uploads/1.jpg", "/uploads/2.jpg"]` |
| `list` | Array[String] | Array[String] | `["項目1", "項目2"]` |
| `object` | Object | Object | `{ name: "値", flag: true }` |

### 2.2 特殊な変換ルール

#### A. 空文字列の扱い

```javascript
// 空文字列は null または undefined に変換せず、そのまま保存
{
  "extra.author": ""  // → extra.author: ""
}
```

**理由:** 意図的に空にした場合と未入力を区別するため

#### B. 空配列の扱い

```javascript
// 空配列はそのまま保存
{
  "extra.gallery": []  // → extra.gallery: []
}
```

#### C. null/undefined の扱い

```javascript
// null/undefined は YAML に出力しない
{
  "extra.thumbnail": null  // → extra.thumbnail フィールド自体を削除
}
```

**実装:**
```javascript
function removeNullFields(obj) {
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      delete obj[key];
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      removeNullFields(value);
    }
  }
  return obj;
}
```

---

## 3. バリデーション仕様

### 3.1 Phase 1 実装範囲

**保存前に実行する検証:**

```javascript
function validateContent(data, fields) {
  const errors = [];
  
  for (const field of fields) {
    const value = data[field.key];
    
    // 1. 必須チェック
    if (field.required && !value) {
      errors.push({
        field: field.key,
        message: `${field.label} は必須項目です`
      });
    }
    
    // 2. 日付形式チェック
    if (field.type === 'date' && value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        errors.push({
          field: field.key,
          message: `${field.label} の形式が正しくありません（YYYY-MM-DD）`
        });
      }
    }
    
    // 3. 本文チェック（_content）
    if (field.key === '_content' && field.required && !value) {
      errors.push({
        field: '_content',
        message: '本文は必須です'
      });
    }
  }
  
  return errors;
}
```

**エラー表示:**

```vue
<!-- Vue Component -->
<template>
  <div v-if="validationErrors.length" class="validation-errors">
    <h4>入力エラー</h4>
    <ul>
      <li v-for="error in validationErrors" :key="error.field">
        {{ error.message }}
      </li>
    </ul>
  </div>
</template>
```

### 3.2 Phase 2以降で追加

**追加される検証:**
- `maxlength` の文字数制限
- カスタムバリデーションルール（正規表現）
- 画像ファイルの存在確認
- リンク切れチェック

---

## 4. データ整合性の保証

### 4.1 Frontmatter のキー命名規則

**許可されるキー名:**
- 英数字、アンダースコア、ハイフン
- 例: `client_name`, `seo-title`, `thumbnail2`

**禁止されるキー名:**
- スペースを含む
- 予約語（`type`, `id` は Zola 内部で使用される可能性）

**検証:**

```javascript
function validateKeyName(key) {
  // スペースチェック
  if (key.includes(' ')) {
    throw new Error(`キー名にスペースは使用できません: ${key}`);
  }
  
  // 予約語チェック
  const RESERVED_WORDS = ['type', 'id'];
  if (RESERVED_WORDS.includes(key.toLowerCase())) {
    throw new Error(`予約語は使用できません: ${key}`);
  }
  
  // 文字種チェック
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    throw new Error(`キー名に使用できない文字が含まれています: ${key}`);
  }
}
```

### 4.2 配列データの整合性

**問題:** 配列の順序が意図せず変わる可能性

**対策:**
```javascript
// YAML生成時に順序を保持
yaml.dump(data, {
  sortKeys: false  // キーソートを無効化
});
```

### 4.3 画像パスの整合性

**問題:** 画像ファイルが存在しないパスが保存される可能性

**Phase 1 での対応:**
- 保存時にチェックしない（ファイルアクセスのオーバーヘッド削減）
- プレビュー時に Zola が検知（404エラー）

**Phase 2 での対応:**
- 保存前に画像ファイルの存在確認
- 存在しない場合は警告表示

```javascript
async function validateImagePaths(data) {
  const imagePaths = extractImagePaths(data);
  const missing = [];
  
  for (const path of imagePaths) {
    const fullPath = path.join(projectPath, 'static', path);
    if (!fs.existsSync(fullPath)) {
      missing.push(path);
    }
  }
  
  return missing;
}
```

---

## 5. データマイグレーション

### 5.1 バージョン間の互換性

**Phase 1 → Phase 2 への移行:**

Phase 2 で taxonomies が追加された場合、既存のMarkdownファイルには taxonomies フィールドがない。

**対応:** 読み込み時にデフォルト値を補完

```javascript
function migrateData(frontmatter) {
  // taxonomies がない場合は空オブジェクトを追加
  if (!frontmatter.taxonomies) {
    frontmatter.taxonomies = {};
  }
  
  return frontmatter;
}
```

### 5.2 スキーマ変更時の対応

**site-config.yml でフィールドが削除された場合:**

**問題:** Markdown内に残っている古いフィールドデータ

**対応:**
- 削除されたフィールドは無視（エラーにしない）
- 保存時に自動削除されない（データ保全）

```javascript
function filterObsoleteFields(data, currentFields) {
  const validKeys = currentFields.map(f => f.key);
  const filtered = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (validKeys.includes(key) || key === '_content') {
      filtered[key] = value;
    }
    // 削除されたフィールドは filtered に含めない
  }
  
  return filtered;
}
```

---

## 6. エラーハンドリング

### 6.1 ファイル読み込みエラー

**発生するエラー:**
- ファイルが存在しない
- 読み込み権限がない
- Frontmatter の形式が不正

**処理:**

```javascript
async function safeLoadMarkdown(filePath) {
  try {
    const { frontmatterYaml, body } = await loadMarkdown(filePath);
    const frontmatter = parseFrontmatter(frontmatterYaml);
    const flat = flattenData(frontmatter, body);
    
    return { success: true, data: flat };
  } catch (error) {
    return {
      success: false,
      error: {
        type: error.name,
        message: error.message,
        file: filePath
      }
    };
  }
}
```

**Renderer での表示:**

```vue
<template>
  <div v-if="loadError" class="error">
    <h3>ファイル読み込みエラー</h3>
    <p>{{ loadError.message }}</p>
    <p>ファイル: {{ loadError.file }}</p>
  </div>
</template>
```

### 6.2 保存エラー

**発生するエラー:**
- ディスク容量不足
- 書き込み権限がない
- ファイル名に使用できない文字

**処理:**

```javascript
async function safeSaveMarkdown(filePath, markdown) {
  try {
    await fs.writeFile(filePath, markdown, 'utf-8');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: {
        type: error.code,
        message: getErrorMessage(error),
        file: filePath
      }
    };
  }
}

function getErrorMessage(error) {
  switch (error.code) {
    case 'ENOSPC':
      return 'ディスク容量が不足しています';
    case 'EACCES':
      return 'ファイルへの書き込み権限がありません';
    case 'EPERM':
      return 'このファイルは編集できません';
    default:
      return `保存エラー: ${error.message}`;
  }
}
```

---

## 7. パフォーマンス最適化

### 7.1 大量データの処理

**問題:** 1000件以上の記事がある場合、一覧取得が遅い

**Phase 1 での対応:**
- 一度に全件読み込み（メモリ上に保持）
- フィルタリング・ソートは JavaScript で処理

```javascript
async function listContents(type) {
  const folder = path.join(projectPath, config.content_types[type].folder);
  const files = await fs.readdir(folder);
  
  const contents = [];
  for (const file of files) {
    if (file.endsWith('.md') && file !== '_index.md') {
      const filePath = path.join(folder, file);
      const { frontmatterYaml } = await loadMarkdown(filePath);
      const frontmatter = parseFrontmatter(frontmatterYaml);
      
      contents.push({
        slug: file.replace('.md', ''),
        title: frontmatter.title,
        date: frontmatter.date,
        draft: frontmatter.draft || false
      });
    }
  }
  
  // ソート
  contents.sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });
  
  return contents;
}
```

**Phase 2 での対応:**
- ページネーション（1ページ50件）
- インデックスファイルの作成（高速検索）

### 7.2 キャッシング

**Phase 2 での実装:**

```javascript
const cache = new Map();

async function getCachedContent(filePath) {
  const stat = await fs.stat(filePath);
  const mtime = stat.mtime.getTime();
  
  const cached = cache.get(filePath);
  if (cached && cached.mtime === mtime) {
    return cached.data;
  }
  
  const data = await loadMarkdown(filePath);
  cache.set(filePath, { data, mtime });
  
  return data;
}
```

---

## 8. データ構造の実例

### 8.1 シンプルなニュース記事

**入力データ（Vue）:**
```json
{
  "title": "年末年始休業のお知らせ",
  "date": "2025-12-01",
  "draft": false,
  "extra.author": "広報部",
  "_content": "年末年始の休業期間をお知らせします..."
}
```

**保存されるMarkdown:**
```yaml
---
title: "年末年始休業のお知らせ"
date: 2025-12-01
draft: false

extra:
  author: "広報部"
---

年末年始の休業期間をお知らせします...
```

### 8.2 複雑な導入事例

**入力データ（Vue）:**
```json
{
  "title": "株式会社サンプル様 導入事例",
  "date": "2025-11-20",
  "extra.client_name": "株式会社サンプル",
  "extra.industry": "製造業",
  "extra.logo": "/uploads/2025/11/logo.png",
  "extra.challenges": ["在庫管理が手書き", "発注漏れが多発"],
  "extra.results": ["在庫差異 0%", "作業時間 30%削減"],
  "extra.gallery": ["/uploads/2025/11/photo1.jpg", "/uploads/2025/11/photo2.jpg"],
  "extra.contact.name": "山田太郎",
  "extra.contact.position": "情報システム部長",
  "_content": "## 導入前の課題\n\n手書きでの在庫管理..."
}
```

**保存されるMarkdown:**
```yaml
---
title: "株式会社サンプル様 導入事例"
date: 2025-11-20

extra:
  client_name: "株式会社サンプル"
  industry: "製造業"
  logo: "/uploads/2025/11/logo.png"
  challenges:
    - "在庫管理が手書き"
    - "発注漏れが多発"
  results:
    - "在庫差異 0%"
    - "作業時間 30%削減"
  gallery:
    - "/uploads/2025/11/photo1.jpg"
    - "/uploads/2025/11/photo2.jpg"
  contact:
    name: "山田太郎"
    position: "情報システム部長"
---

## 導入前の課題

手書きでの在庫管理...
```

---

## 9. まとめ

### Phase 1 で完成するデータスキーマ

**実装済み:**
- Frontmatter (YAML) と Body の分離
- フラット構造 ↔ 階層構造の双方向変換
- `_content` による本文の識別
- `extra` セクションへの自動振り分け
- 基本的なバリデーション

**未実装（Phase 2以降）:**
- `maxlength` 検証
- 画像パスの存在確認
- taxonomies の config.toml 整合性チェック
- データキャッシング

### データスキーマの特徴

✅ **Zola準拠:** YAMLフォーマット、extra セクション使用  
✅ **変換ロジック明確:** フラット ↔ 階層の変換規則を明示  
✅ **エラーハンドリング:** 読み込み・保存時のエラーを適切に処理  
✅ **拡張性:** 新しいフィールドタイプの追加が容易

---

**本スキーマ定義に基づき、Phase 1 のデータ処理実装を開始できます。**
