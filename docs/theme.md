# Fubako テーマ制作ガイド

**バージョン:** 5.0.0 (Final)  
**最終更新:** 2025年11月24日

---

## 1. ディレクトリ構造

Zolaの標準構造に、Fubako用の設定ファイルと画像フォルダを追加した構成とする。

```text
site-data/
├── config.toml                # [Zola] サイト全体設定
├── site-config.yml            # [Fubako] 管理画面UI設定
│
├── content/                   # [Zola] 記事データ
│   ├── _index.md              # トップページ
│   ├── news/                  # ニュースセクション
│   │   ├── _index.md
│   │   ├── 2025-11-01.md
│   │   └── ...
│   └── cases/                 # 導入事例セクション
│       ├── _index.md
│       └── ...
│
├── static/                    # [Zola] 静的アセット
│   ├── uploads/               # [Fubako] 画像保存先 (一元管理)
│   │   ├── 2025/
│   │   │   └── 11/
│   │   │       └── ...
│   │   └── common/
│   ├── css/                   # コンパイル済みCSS（Zolaが生成）
│   ├── js/                    # JavaScript
│   └── fonts/                 # Webフォント
│
├── templates/                 # [Zola] HTMLテンプレート (Tera)
│   ├── base.html              # 共通レイアウト
│   ├── index.html             # トップページ
│   ├── page.html              # 固定ページ
│   ├── news/
│   │   ├── section.html       # 記事一覧
│   │   └── page.html          # 記事詳細
│   ├── cases/
│   │   ├── section.html       # 事例一覧
│   │   └── page.html          # 事例詳細
│   ├── 404.html               # エラーページ
│   └── shortcodes/            # ショートコード
│       └── youtube.html
│
└── sass/                      # [Zola] スタイルシート
    ├── main.scss              # メインスタイル
    └── _variables.scss        # 変数定義
```

---

## 2. テーマ制作のポイント

### 2.1 テンプレートエンジン (Tera)

Zolaは **Tera** エンジンを使用する。Jinja2やLiquidに似た構文であるため、Shopify等の経験があれば容易に扱える。

#### 基本構文

**変数展開:**
```html
{{ page.title }}
{{ section.pages | length }}
```

**条件分岐:**
```html
{% if page.extra.thumbnail %}
  <img src="{{ page.extra.thumbnail }}" alt="{{ page.title }}">
{% endif %}
```

**ループ:**
```html
{% for item in page.extra.gallery %}
  <img src="{{ item }}" alt="Gallery image">
{% endfor %}
```

**コメント:**
```html
{# これはコメント #}
```

---

### 2.2 カスタムフィールドの表示

Fubakoで入力されたカスタムフィールドは、`page.extra` オブジェクトからアクセスできる。

#### 例: 導入事例ページ

**content/cases/sample.md:**
```yaml
---
title: "株式会社A様 導入事例"
date: 2025-11-24

extra:
  client_name: "株式会社A"
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
---

導入事例の本文...
```

**templates/cases/page.html:**
```html
{% extends "base.html" %}

{% block content %}
<article class="case-study">
  {# タイトルとメタ情報 #}
  <header>
    <h1>{{ page.title }}</h1>
    <p class="meta">
      <time datetime="{{ page.date }}">{{ page.date }}</time>
      {% if page.extra.industry %}
        <span class="industry">{{ page.extra.industry }}</span>
      {% endif %}
    </p>
  </header>
  
  {# 企業ロゴ #}
  {% if page.extra.logo %}
    <div class="client-logo">
      <img src="{{ page.extra.logo }}" alt="{{ page.extra.client_name }} ロゴ">
    </div>
  {% endif %}
  
  {# 本文 #}
  <div class="content">
    {{ page.content | safe }}
  </div>
  
  {# 導入前の課題 #}
  {% if page.extra.challenges %}
    <section class="challenges">
      <h2>導入前の課題</h2>
      <ul>
        {% for challenge in page.extra.challenges %}
          <li>{{ challenge }}</li>
        {% endfor %}
      </ul>
    </section>
  {% endif %}
  
  {# 導入成果 #}
  {% if page.extra.results %}
    <section class="results">
      <h2>導入成果</h2>
      <ul>
        {% for result in page.extra.results %}
          <li>{{ result }}</li>
        {% endfor %}
      </ul>
    </section>
  {% endif %}
  
  {# フォトギャラリー #}
  {% if page.extra.gallery %}
    <section class="gallery">
      <h2>フォトギャラリー</h2>
      <div class="gallery-grid">
        {% for photo in page.extra.gallery %}
          <figure>
            <img src="{{ photo }}" alt="事例写真">
          </figure>
        {% endfor %}
      </div>
    </section>
  {% endif %}
</article>
{% endblock content %}
```

---

### 2.3 画像パスの扱い

#### Co-location 廃止

記事フォルダ内に画像を置く（Asset Co-location）方式は採用しない。

**理由:**
- Fubakoでは画像を一元管理（`static/uploads/`）
- 記事の移動・削除が容易
- 画像の再利用が簡単

#### 絶対パス参照

すべての画像は `/uploads/...` から始まるルート相対パスとして保存される。

**Markdown内での記述:**
```markdown
![画像説明](/uploads/2025/11/sample.jpg)
```

**テンプレート内での記述:**
```html
<img src="{{ page.extra.thumbnail }}" alt="{{ page.title }}">
```

**重要:** Zolaは `static/` フォルダの中身をビルド時にルートへコピーするため、テンプレートやMarkdown内では `static` を除いたパス（`/uploads/...`）で記述すれば正しく表示される。

---

### 2.4 タクソノミー連携（Phase 2以降）

`site-config.yml` でタグ入力を有効にする場合、Zola側の `config.toml` にも定義が必要となる。

**config.toml:**
```toml
[taxonomies]
categories = { name = "categories", paginate_by = 5 }
tags = { name = "tags", paginate_by = 10 }
```

**テンプレートでの表示:**
```html
{# カテゴリ表示 #}
{% if page.taxonomies.categories %}
  <div class="categories">
    {% for category in page.taxonomies.categories %}
      <a href="{{ get_taxonomy_url(kind='categories', name=category) }}">
        {{ category }}
      </a>
    {% endfor %}
  </div>
{% endif %}

{# タグ表示 #}
{% if page.taxonomies.tags %}
  <div class="tags">
    {% for tag in page.taxonomies.tags %}
      <a href="{{ get_taxonomy_url(kind='tags', name=tag) }}" class="tag">
        {{ tag }}
      </a>
    {% endfor %}
  </div>
{% endif %}
```

**整合性管理:**
この整合性はエンジニアが管理する（Phase 1ではアプリによるチェックなし）。

---

### 2.5 検索機能の実装（Phase 3以降）

Zolaの標準機能である **elasticlunr.js** を利用した検索インデックス生成を推奨する。

**config.toml:**
```toml
build_search_index = true
default_language = "ja"
```

**テンプレート側:**

`static/js/search.js` などを配置し、クライアントサイドでインデックス（`/search_index.ja.js`）をフェッチして検索窓を機能させる。

```html
<!-- templates/base.html -->
<div class="search-box">
  <input type="text" id="search-input" placeholder="サイト内検索...">
  <div id="search-results"></div>
</div>

<script src="/js/elasticlunr.min.js"></script>
<script src="/search_index.ja.js"></script>
<script src="/js/search.js"></script>
```

```javascript
// static/js/search.js
const searchIndex = elasticlunr.Index.load(window.searchIndex);

document.getElementById('search-input').addEventListener('input', (e) => {
  const query = e.target.value;
  if (query.length < 2) return;
  
  const results = searchIndex.search(query, {
    fields: {
      title: { boost: 2 },
      body: { boost: 1 }
    }
  });
  
  displayResults(results);
});
```

**注意:** これに対するUIサポートはPhase 3以降で検討するが、テーマ側で先行実装することは可能。

---

## 3. テンプレートファイル構成例

一般的なコーポレートサイトの構成例。

| ファイル名 | 役割 | 備考 |
|:---|:---|:---|
| `base.html` | 共通レイアウト | Header, Footer, Metaタグ定義 |
| `index.html` | トップページ | `content/_index.md` に対応 |
| `page.html` | 固定ページ | About, Contactなど |
| `news/section.html` | ニュース一覧 | ページネーション処理 |
| `news/page.html` | ニュース詳細 | 日付、カテゴリ表示 |
| `cases/section.html` | 事例一覧 | グリッドレイアウト |
| `cases/page.html` | 事例詳細 | カスタムフィールド（課題・結果）の表示 |
| `404.html` | エラーページ | 必須 |

---

### 3.1 base.html（共通レイアウト）

```html
<!DOCTYPE html>
<html lang="{{ lang }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  {# タイトル #}
  <title>
    {% block title %}{{ config.title }}{% endblock title %}
  </title>
  
  {# メタタグ #}
  {% if page.description %}
    <meta name="description" content="{{ page.description }}">
  {% elif section.description %}
    <meta name="description" content="{{ section.description }}">
  {% endif %}
  
  {# SEO設定（Phase 2以降） #}
  {% if page.extra.seo %}
    {% if page.extra.seo.description %}
      <meta name="description" content="{{ page.extra.seo.description }}">
    {% endif %}
    {% if page.extra.seo.noindex %}
      <meta name="robots" content="noindex">
    {% endif %}
  {% endif %}
  
  {# OGP（Open Graph Protocol） #}
  <meta property="og:title" content="{{ page.title | default(value=config.title) }}">
  <meta property="og:type" content="website">
  {% if page.extra.thumbnail %}
    <meta property="og:image" content="{{ config.base_url }}{{ page.extra.thumbnail }}">
  {% endif %}
  
  {# スタイルシート #}
  <link rel="stylesheet" href="{{ get_url(path='main.css') }}">
  
  {% block extra_head %}{% endblock extra_head %}
</head>
<body>
  {# ヘッダー #}
  <header class="site-header">
    <div class="container">
      <h1 class="site-title">
        <a href="{{ get_url(path='/') }}">{{ config.title }}</a>
      </h1>
      <nav class="site-nav">
        <ul>
          <li><a href="{{ get_url(path='/') }}">ホーム</a></li>
          <li><a href="{{ get_url(path='/news') }}">ニュース</a></li>
          <li><a href="{{ get_url(path='/cases') }}">導入事例</a></li>
          <li><a href="{{ get_url(path='/pages/about') }}">会社概要</a></li>
          <li><a href="{{ get_url(path='/pages/contact') }}">お問い合わせ</a></li>
        </ul>
      </nav>
    </div>
  </header>
  
  {# メインコンテンツ #}
  <main class="site-main">
    <div class="container">
      {% block content %}{% endblock content %}
    </div>
  </main>
  
  {# フッター #}
  <footer class="site-footer">
    <div class="container">
      <p>&copy; {{ now() | date(format="%Y") }} {{ config.title }}. All rights reserved.</p>
      {% if config.extra.footer_text %}
        <p>{{ config.extra.footer_text }}</p>
      {% endif %}
    </div>
  </footer>
  
  {% block extra_js %}{% endblock extra_js %}
</body>
</html>
```

---

### 3.2 index.html（トップページ）

```html
{% extends "base.html" %}

{% block content %}
<section class="hero">
  <h2>{{ page.title }}</h2>
  <div class="hero-content">
    {{ page.content | safe }}
  </div>
</section>

{# 最新ニュース #}
<section class="latest-news">
  <h2>最新ニュース</h2>
  {% set news_section = get_section(path="news/_index.md") %}
  <ul class="news-list">
    {% for page in news_section.pages | slice(end=5) %}
      <li>
        <time datetime="{{ page.date }}">{{ page.date }}</time>
        <a href="{{ page.permalink }}">{{ page.title }}</a>
      </li>
    {% endfor %}
  </ul>
  <a href="{{ get_url(path='/news') }}" class="more-link">ニュース一覧</a>
</section>

{# 導入事例 #}
<section class="featured-cases">
  <h2>導入事例</h2>
  {% set cases_section = get_section(path="cases/_index.md") %}
  <div class="case-grid">
    {% for page in cases_section.pages | slice(end=3) %}
      <article class="case-card">
        {% if page.extra.logo %}
          <img src="{{ page.extra.logo }}" alt="{{ page.extra.client_name }}">
        {% endif %}
        <h3>{{ page.title }}</h3>
        <p>{{ page.extra.industry }}</p>
        <a href="{{ page.permalink }}" class="read-more">詳しく見る</a>
      </article>
    {% endfor %}
  </div>
  <a href="{{ get_url(path='/cases') }}" class="more-link">事例一覧</a>
</section>
{% endblock content %}
```

---

### 3.3 news/section.html（ニュース一覧）

```html
{% extends "base.html" %}

{% block title %}{{ section.title }} | {{ config.title }}{% endblock title %}

{% block content %}
<section class="news-section">
  <h1>{{ section.title }}</h1>
  
  {# カテゴリフィルター（Phase 2以降） #}
  {% if config.taxonomies %}
    <div class="category-filter">
      <a href="{{ section.permalink }}" class="filter-all">すべて</a>
      {% set categories = get_taxonomy(kind="categories") %}
      {% for term in categories.items %}
        <a href="{{ term.permalink }}">{{ term.name }}</a>
      {% endfor %}
    </div>
  {% endif %}
  
  {# 記事一覧 #}
  <div class="news-list">
    {% for page in section.pages %}
      <article class="news-item">
        <time datetime="{{ page.date }}">{{ page.date }}</time>
        
        {% if page.extra.thumbnail %}
          <img src="{{ page.extra.thumbnail }}" alt="{{ page.title }}">
        {% endif %}
        
        <h2><a href="{{ page.permalink }}">{{ page.title }}</a></h2>
        
        {% if page.description %}
          <p>{{ page.description }}</p>
        {% endif %}
        
        {% if page.taxonomies.categories %}
          <div class="categories">
            {% for category in page.taxonomies.categories %}
              <span class="category">{{ category }}</span>
            {% endfor %}
          </div>
        {% endif %}
      </article>
    {% endfor %}
  </div>
  
  {# ページネーション #}
  {% if section.paginator %}
    <nav class="pagination">
      {% if section.paginator.previous %}
        <a href="{{ section.paginator.previous }}" class="prev">前へ</a>
      {% endif %}
      
      <span class="current">
        {{ section.paginator.current_index }} / {{ section.paginator.number_pagers }}
      </span>
      
      {% if section.paginator.next %}
        <a href="{{ section.paginator.next }}" class="next">次へ</a>
      {% endif %}
    </nav>
  {% endif %}
</section>
{% endblock content %}
```

---

### 3.4 news/page.html（ニュース詳細）

```html
{% extends "base.html" %}

{% block title %}{{ page.title }} | {{ config.title }}{% endblock title %}

{% block content %}
<article class="news-detail">
  <header>
    <h1>{{ page.title }}</h1>
    <div class="meta">
      <time datetime="{{ page.date }}">{{ page.date }}</time>
      {% if page.extra.author %}
        <span class="author">投稿者: {{ page.extra.author }}</span>
      {% endif %}
    </div>
    
    {# カテゴリ・タグ（Phase 2以降） #}
    {% if page.taxonomies.categories %}
      <div class="categories">
        {% for category in page.taxonomies.categories %}
          <a href="{{ get_taxonomy_url(kind='categories', name=category) }}" class="category">
            {{ category }}
          </a>
        {% endfor %}
      </div>
    {% endif %}
  </header>
  
  {# サムネイル画像 #}
  {% if page.extra.thumbnail %}
    <figure class="thumbnail">
      <img src="{{ page.extra.thumbnail }}" alt="{{ page.title }}">
    </figure>
  {% endif %}
  
  {# 本文 #}
  <div class="content">
    {{ page.content | safe }}
  </div>
  
  {# 関連リンク（Phase 2以降） #}
  {% if page.extra.related_links %}
    <aside class="related-links">
      <h2>関連リンク</h2>
      <ul>
        {% for link in page.extra.related_links %}
          <li>
            <a href="{{ link.url }}">{{ link.label }}</a>
          </li>
        {% endfor %}
      </ul>
    </aside>
  {% endif %}
  
  {# タグ #}
  {% if page.taxonomies.tags %}
    <div class="tags">
      {% for tag in page.taxonomies.tags %}
        <a href="{{ get_taxonomy_url(kind='tags', name=tag) }}" class="tag">
          #{{ tag }}
        </a>
      {% endfor %}
    </div>
  {% endif %}
</article>

{# 前後の記事ナビゲーション #}
<nav class="post-nav">
  {% if page.earlier %}
    <a href="{{ page.earlier.permalink }}" class="prev">
      ← {{ page.earlier.title }}
    </a>
  {% endif %}
  
  {% if page.later %}
    <a href="{{ page.later.permalink }}" class="next">
      {{ page.later.title }} →
    </a>
  {% endif %}
</nav>
{% endblock content %}
```

---

## 4. スタイリング

### 4.1 Sass の使用

Zolaは標準でSassをサポートしている。

**sass/main.scss:**
```scss
@import 'variables';
@import 'reset';
@import 'layout';
@import 'components';

// グローバルスタイル
body {
  font-family: $font-family-base;
  color: $color-text;
  line-height: 1.6;
}

.container {
  max-width: $container-width;
  margin: 0 auto;
  padding: 0 $spacing-base;
}
```

**sass/_variables.scss:**
```scss
// カラー
$color-primary: #007bff;
$color-secondary: #6c757d;
$color-text: #333;
$color-bg: #fff;

// タイポグラフィ
$font-family-base: 'Noto Sans JP', sans-serif;
$font-size-base: 16px;
$line-height-base: 1.6;

// レイアウト
$container-width: 1200px;
$spacing-base: 1rem;
$spacing-large: 2rem;
```

### 4.2 コンパイル

Zolaは自動的にSassをコンパイルし、`static/main.css` に出力する。

**config.toml:**
```toml
compile_sass = true
```

---

## 5. ショートコード

Zolaはショートコードをサポートしている。テンプレート内で再利用可能なコンポーネントを作成できる。

### 5.1 YouTube埋め込み

**templates/shortcodes/youtube.html:**
```html
<div class="youtube-embed">
  <iframe
    width="560"
    height="315"
    src="https://www.youtube.com/embed/{{ id }}"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen>
  </iframe>
</div>
```

**Markdown内での使用:**
```markdown
{{ youtube(id="dQw4w9WgXcQ") }}
```

### 5.2 画像ギャラリー

**templates/shortcodes/gallery.html:**
```html
<div class="gallery">
  {% for image in images %}
    <figure>
      <img src="{{ image }}" alt="Gallery image">
    </figure>
  {% endfor %}
</div>
```

**Markdown内での使用:**
```markdown
{{ gallery(images=["/uploads/1.jpg", "/uploads/2.jpg"]) }}
```

---

## 6. レスポンシブデザイン

### 6.1 ブレークポイント

```scss
// sass/_variables.scss
$breakpoint-mobile: 576px;
$breakpoint-tablet: 768px;
$breakpoint-desktop: 992px;
$breakpoint-wide: 1200px;

// Mixins
@mixin mobile {
  @media (max-width: $breakpoint-mobile) {
    @content;
  }
}

@mixin tablet {
  @media (min-width: $breakpoint-mobile + 1) and (max-width: $breakpoint-tablet) {
    @content;
  }
}

@mixin desktop {
  @media (min-width: $breakpoint-tablet + 1) {
    @content;
  }
}
```

### 6.2 使用例

```scss
.case-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  
  @include tablet {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @include mobile {
    grid-template-columns: 1fr;
  }
}
```

---

## 7. パフォーマンス最適化

### 7.1 画像の遅延読み込み

```html
<img 
  src="{{ page.extra.thumbnail }}" 
  alt="{{ page.title }}"
  loading="lazy"
>
```

### 7.2 Critical CSS

重要なスタイルを `<head>` に直接埋め込む（Phase 3以降）。

```html
<!-- base.html -->
<style>
  /* Critical CSS */
  body { margin: 0; font-family: sans-serif; }
  .site-header { background: #333; color: white; }
</style>
```

---

## 8. まとめ

### テーマ制作の要点

✅ **Tera テンプレート:** Jinja2/Liquid に似た構文  
✅ **カスタムフィールド:** `page.extra` からアクセス  
✅ **画像パス:** `/uploads/...` で統一（`static/` なし）  
✅ **タクソノミー:** config.toml との整合性が必要（Phase 2）  
✅ **Sass サポート:** 自動コンパイル  
✅ **ショートコード:** 再利用可能なコンポーネント

### Phase 1 で実装可能な機能

- 基本的なレイアウト（base.html）
- 記事一覧・詳細ページ
- カスタムフィールドの表示
- 画像表示
- レスポンシブデザイン

### Phase 2以降で追加予定

- タクソノミー（カテゴリ・タグ）
- 検索機能（elasticlunr.js）
- パフォーマンス最適化（Critical CSS）

---

**本ガイドに基づき、Fubakoに最適化されたZolaテーマを制作できます。**
