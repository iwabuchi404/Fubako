const fs = require('fs').promises;
const fsSyncModule = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Markdownファイルをパースして、FrontmatterとBodyに分離
 */
async function parseMarkdown(filePath) {
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

/**
 * Frontmatter YAMLをパース
 */
function parseFrontmatter(frontmatterYaml) {
    try {
        return yaml.load(frontmatterYaml);
    } catch (error) {
        throw new Error(`YAML parse error: ${error.message}`);
    }
}

/**
 * ネストされたオブジェクトをフラット化
 * 例: { extra: { thumbnail: "..." } } → { "extra.thumbnail": "..." }
 */
function flattenData(frontmatter, body) {
    const flat = { _content: body };

    function flatten(obj, prefix = '') {
        for (const [key, value] of Object.entries(obj)) {
            const newKey = prefix ? `${prefix}.${key}` : key;

            // オブジェクトの場合は再帰（配列は除く）
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

/**
 * フラットなデータを階層構造に変換
 * 例: { "extra.thumbnail": "..." } → { extra: { thumbnail: "..." } }
 */
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

/**
 * null/undefined フィールドを削除
 */
function removeNullFields(obj) {
    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) {
            delete obj[key];
        } else if (typeof value === 'object' && !Array.isArray(value)) {
            removeNullFields(value);
            // 空オブジェクトも削除
            if (Object.keys(value).length === 0) {
                delete obj[key];
            }
        }
    }
    return obj;
}

/**
 * Markdownファイルを構築
 */
function buildMarkdown(frontmatter, content) {
    // null/undefined を削除
    const cleaned = removeNullFields(JSON.parse(JSON.stringify(frontmatter)));

    // YAML生成
    const yamlString = yaml.dump(cleaned, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
        noCompatMode: true
    });

    // Markdown結合
    return `---\n${yamlString}---\n\n${content}`;
}

/**
 * コンテンツ一覧を取得
 */
async function listContents(projectPath, contentType, config) {
    const typeConfig = config.content_types[contentType];
    if (!typeConfig) {
        throw new Error(`Unknown content type: ${contentType}`);
    }

    const folderPath = path.join(projectPath, typeConfig.folder);

    // フォルダが存在しない場合は空配列を返す
    if (!fsSyncModule.existsSync(folderPath)) {
        return [];
    }

    const files = await fs.readdir(folderPath);
    const contents = [];

    for (const file of files) {
        // _index.md は除外
        if (file.endsWith('.md') && file !== '_index.md') {
            try {
                const filePath = path.join(folderPath, file);
                const { frontmatterYaml } = await parseMarkdown(filePath);
                const frontmatter = parseFrontmatter(frontmatterYaml);

                contents.push({
                    slug: file.replace('.md', ''),
                    title: frontmatter.title || 'Untitled',
                    date: frontmatter.date || '',
                    draft: frontmatter.draft || false,
                    ...frontmatter
                });
            } catch (error) {
                console.error(`Failed to parse ${file}:`, error);
            }
        }
    }

    // ソート
    const sortOrder = typeConfig.sort || 'date_desc';
    if (sortOrder === 'date_desc') {
        contents.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sortOrder === 'date_asc') {
        contents.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sortOrder === 'title_asc') {
        contents.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOrder === 'title_desc') {
        contents.sort((a, b) => b.title.localeCompare(a.title));
    }

    return contents;
}

/**
 * コンテンツを読み込み
 */
async function loadContent(projectPath, contentType, slug, config) {
    const typeConfig = config.content_types[contentType];
    if (!typeConfig) {
        throw new Error(`Unknown content type: ${contentType}`);
    }

    const filePath = path.join(projectPath, typeConfig.folder, `${slug}.md`);

    if (!fsSyncModule.existsSync(filePath)) {
        throw new Error(`Content not found: ${slug}`);
    }

    const { frontmatterYaml, body } = await parseMarkdown(filePath);
    const frontmatter = parseFrontmatter(frontmatterYaml);
    const flat = flattenData(frontmatter, body);

    return flat;
}

/**
 * コンテンツを保存
 */
async function saveContent(projectPath, contentType, slug, data, config) {
    const typeConfig = config.content_types[contentType];
    if (!typeConfig) {
        throw new Error(`Unknown content type: ${contentType}`);
    }

    // _content を分離
    const { _content, ...frontmatterData } = data;
    const content = _content || '';

    // 階層構造化
    const structured = structureData(frontmatterData);

    // Markdown生成
    const markdown = buildMarkdown(structured, content);

    // ファイルパス決定
    const folderPath = path.join(projectPath, typeConfig.folder);

    // フォルダが存在しない場合は作成
    if (!fsSyncModule.existsSync(folderPath)) {
        await fs.mkdir(folderPath, { recursive: true });
    }

    const filePath = path.join(folderPath, `${slug}.md`);

    // ファイル書き込み
    await fs.writeFile(filePath, markdown, 'utf-8');

    return { success: true, path: filePath };
}

/**
 * コンテンツを削除
 */
async function deleteContent(projectPath, contentType, slug, config) {
    const typeConfig = config.content_types[contentType];
    if (!typeConfig) {
        throw new Error(`Unknown content type: ${contentType}`);
    }

    const filePath = path.join(projectPath, typeConfig.folder, `${slug}.md`);

    if (!fsSyncModule.existsSync(filePath)) {
        throw new Error(`Content not found: ${slug}`);
    }

    await fs.unlink(filePath);

    return { success: true };
}

/**
 * コンテンツが存在するか確認
 */
async function existsContent(projectPath, contentType, slug, config) {
    const typeConfig = config.content_types[contentType];
    if (!typeConfig) {
        throw new Error(`Unknown content type: ${contentType}`);
    }

    const filePath = path.join(projectPath, typeConfig.folder, `${slug}.md`);
    return fsSyncModule.existsSync(filePath);
}

/**
 * ファイル名からZolaが生成するURLスラグを抽出
 * Zolaは YYYY-MM-DD- プレフィックスを自動的に除去する
 */
function extractZolaSlug(filename) {
    const datePrefix = /^\d{4}-\d{2}-\d{2}-/;
    return datePrefix.test(filename) ? filename.replace(datePrefix, '') : filename;
}

/**
 * Zolaのスラグコリジョンをチェック
 * 同じURLスラグを生成するファイルが既に存在するかチェック
 */
async function checkSlugCollision(projectPath, contentType, newSlug, config, excludeSlug = null) {
    const typeConfig = config.content_types[contentType];
    if (!typeConfig) {
        throw new Error(`Unknown content type: ${contentType}`);
    }

    const folderPath = path.join(projectPath, typeConfig.folder);
    if (!fsSyncModule.existsSync(folderPath)) {
        return { collision: false, collidingFile: null };
    }

    const newZolaSlug = extractZolaSlug(newSlug);
    const files = await fs.readdir(folderPath);

    for (const file of files) {
        if (!file.endsWith('.md') || file === '_index.md') continue;

        const existingSlug = file.replace('.md', '');
        // 自分自身は除外
        if (excludeSlug && existingSlug === excludeSlug) continue;

        if (extractZolaSlug(existingSlug) === newZolaSlug) {
            return { collision: true, collidingFile: existingSlug };
        }
    }

    return { collision: false, collidingFile: null };
}

/**
 * 重複スラグを一意なスラグに自動修正
 */
async function resolveSlugCollision(projectPath, contentType, duplicateSlug, config) {
    const typeConfig = config.content_types[contentType];
    if (!typeConfig) {
        throw new Error(`Unknown content type: ${contentType}`);
    }

    const folderPath = path.join(projectPath, typeConfig.folder);
    if (!fsSyncModule.existsSync(folderPath)) {
        return { success: false, error: 'Folder not found' };
    }

    const newZolaSlug = extractZolaSlug(duplicateSlug);
    const files = await fs.readdir(folderPath);
    const collidingFiles = [];

    // 重複するファイルをすべて収集
    for (const file of files) {
        if (!file.endsWith('.md') || file === '_index.md') continue;
        const existingSlug = file.replace('.md', '');

        if (extractZolaSlug(existingSlug) === newZolaSlug) {
            collidingFiles.push(existingSlug);
        }
    }

    if (collidingFiles.length < 2) {
        return { success: false, error: 'No collision found' };
    }

    // 重複を解決：最初のファイル以外は一意なスラグを生成
    const results = [];
    for (let i = 1; i < collidingFiles.length; i++) {
        const oldSlug = collidingFiles[i];
        const newSlug = `${newZolaSlug}-${i + 1}`;
        const oldPath = path.join(folderPath, `${oldSlug}.md`);
        const newPath = path.join(folderPath, `${newSlug}.md`);

        try {
            // ファイルをリネーム
            await fs.rename(oldPath, newPath);

            // 新しいファイル内のslugフィールドも更新
            const { frontmatterYaml, body } = await parseMarkdown(newPath);
            const frontmatter = parseFrontmatter(frontmatterYaml);

            if (frontmatter.slug) {
                frontmatter.slug = newSlug;
                const newMarkdown = buildMarkdown(frontmatter, body);
                await fs.writeFile(newPath, newMarkdown, 'utf-8');
            }

            results.push({
                oldSlug,
                newSlug,
                path: newPath
            });
        } catch (error) {
            console.error(`Failed to resolve collision for ${oldSlug}:`, error);
        }
    }

    return { success: true, resolvedCount: results.length, details: results };
}

/**
 * コンテンツタイプ内のすべてのスラグ衝突を検出
 */
async function detectAllSlugCollisions(projectPath, config) {
    const collisions = [];

    for (const [contentType, typeConfig] of Object.entries(config.content_types)) {
        const folderPath = path.join(projectPath, typeConfig.folder);
        if (!fsSyncModule.existsSync(folderPath)) continue;

        const files = await fs.readdir(folderPath);
        const slugMap = {};

        for (const file of files) {
            if (!file.endsWith('.md') || file === '_index.md') continue;
            const slug = file.replace('.md', '');
            const zolaSlug = extractZolaSlug(slug);

            if (!slugMap[zolaSlug]) {
                slugMap[zolaSlug] = [];
            }
            slugMap[zolaSlug].push(slug);
        }

        // 重複がある場合
        for (const [zolaSlug, slugs] of Object.entries(slugMap)) {
            if (slugs.length > 1) {
                collisions.push({
                    contentType,
                    zolaSlug,
                    collidingFiles: slugs
                });
            }
        }
    }

    return collisions;
}

module.exports = {
    parseMarkdown,
    parseFrontmatter,
    flattenData,
    structureData,
    buildMarkdown,
    listContents,
    loadContent,
    saveContent,
    deleteContent,
    existsContent,
    checkSlugCollision,
    resolveSlugCollision,
    detectAllSlugCollisions
};
