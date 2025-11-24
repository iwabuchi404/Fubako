const fs = require('fs').promises;
const fsSyncModule = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 画像をアップロード（Phase 1: リサイズなし）
 */
async function uploadImage(sourcePath, projectPath) {
    try {
        // 1. UUID生成
        const uuid = crypto.randomUUID();
        const ext = path.extname(sourcePath);

        // 2. 保存先パス決定（年/月）
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');

        const uploadDir = path.join(
            projectPath,
            'static/uploads',
            String(year),
            month
        );

        // 3. ディレクトリ作成（存在しない場合）
        if (!fsSyncModule.existsSync(uploadDir)) {
            await fs.mkdir(uploadDir, { recursive: true });
        }

        // 4. ファイル名決定
        const fileName = `${uuid}${ext}`;
        const destPath = path.join(uploadDir, fileName);

        // 5. ファイルコピー
        await fs.copyFile(sourcePath, destPath);

        // 6. Markdown用のパス返却（static/ を除く）
        const publicPath = `/uploads/${year}/${month}/${fileName}`;

        return {
            success: true,
            path: publicPath,
            fileName: fileName
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * アップロード済み画像の一覧を取得
 */
async function listImages(projectPath) {
    const uploadsDir = path.join(projectPath, 'static/uploads');

    if (!fsSyncModule.existsSync(uploadsDir)) {
        return [];
    }

    const images = [];

    async function scanDirectory(dir, relativePath = '') {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.join(relativePath, entry.name);

            if (entry.isDirectory()) {
                await scanDirectory(fullPath, relPath);
            } else if (entry.isFile()) {
                // 画像ファイルのみ
                const ext = path.extname(entry.name).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                    const stats = await fs.stat(fullPath);
                    images.push({
                        name: entry.name,
                        path: `/uploads/${relPath.replace(/\\/g, '/')}`,
                        size: stats.size,
                        modified: stats.mtime
                    });
                }
            }
        }
    }

    await scanDirectory(uploadsDir);

    // 新しい順にソート
    images.sort((a, b) => b.modified - a.modified);

    return images;
}

module.exports = {
    uploadImage,
    listImages
};
