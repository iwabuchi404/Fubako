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

module.exports = {
    parseMarkdown,
    parseFrontmatter,
    flattenData,
    structureData,
    buildMarkdown,
    listContents,
    loadContent,
    saveContent,
    deleteContent
};
