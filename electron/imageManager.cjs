const fs = require('fs').promises;
const fsSyncModule = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 画像をアップロード
 */
async function uploadImage(sourcePath, projectPath) {
    console.log('[ImageManager] uploadImage start:', { sourcePath, projectPath });
    try {
        const uuid = crypto.randomUUID();
        const ext = path.extname(sourcePath);
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');

        const uploadDir = path.join(projectPath, 'static/uploads', String(year), month);

        if (!fsSyncModule.existsSync(uploadDir)) {
            await fs.mkdir(uploadDir, { recursive: true });
        }

        const fileName = `${uuid}${ext}`;
        const destPath = path.join(uploadDir, fileName);

        await fs.copyFile(sourcePath, destPath);

        const publicPath = `/uploads/${year}/${month}/${fileName}`;
        console.log('[ImageManager] uploadImage success:', publicPath);

        return { success: true, path: publicPath, fileName: fileName };
    } catch (error) {
        console.error('[ImageManager] uploadImage error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 画像をリサイズする
 */
async function resizeImage(imagePath, width, height, projectPath) {
    console.log('[ImageManager] resizeImage start:', { imagePath, width, height });
    try {
        const sharp = require('sharp');
        // publicパス (/uploads/...) を絶対パスに変換
        const absolutePath = path.join(projectPath, 'static', imagePath);
        if (!fsSyncModule.existsSync(absolutePath)) {
            throw new Error('File not found: ' + absolutePath);
        }

        const ext = path.extname(absolutePath);
        const dir = path.dirname(absolutePath);
        const base = path.basename(absolutePath, ext);

        // 新しいファイル名 (例: uuid_resized_800x600.jpg)
        const newFileName = `${base}_res_${width}x${height}${ext}`;
        const newPath = path.join(dir, newFileName);

        await sharp(absolutePath)
            .resize(width, height, {
                fit: 'cover',
                position: 'center'
            })
            .toFile(newPath);

        // フォルダ構造を維持したpublicパスを生成
        const relativeFromStatic = path.relative(path.join(projectPath, 'static'), newPath);
        const publicPath = '/' + relativeFromStatic.replace(/\\/g, '/');

        console.log('[ImageManager] resizeImage success:', publicPath);
        return { success: true, path: publicPath };
    } catch (error) {
        console.error('[ImageManager] resizeImage error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ダミー画像を生成する
 */
async function generateDummyImage(options) {
    const { width = 800, height = 450, bgColor = '#2d2d35', textColor = '#ffffff', text = 'DUMMY', projectPath } = options;
    console.log('[ImageManager] generateDummyImage start:', { width, height, text });

    try {
        const sharp = require('sharp');
        const uuid = crypto.randomUUID();
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const uploadDir = path.join(projectPath, 'static/uploads', String(year), month);

        if (!fsSyncModule.existsSync(uploadDir)) {
            await fs.mkdir(uploadDir, { recursive: true });
        }

        const fileName = `dummy_${uuid}.png`;
        const destPath = path.join(uploadDir, fileName);

        // SVGを生成してSharpでレンダリング
        const svg = `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="${bgColor}" />
                <text 
                    x="50%" 
                    y="50%" 
                    font-family="sans-serif" 
                    font-size="${Math.min(width, height) / 5}px" 
                    fill="${textColor}" 
                    text-anchor="middle" 
                    dominant-baseline="middle"
                >${text}</text>
            </svg>
        `;

        await sharp(Buffer.from(svg))
            .png()
            .toFile(destPath);

        const publicPath = `/uploads/${year}/${month}/${fileName}`;
        console.log('[ImageManager] generateDummyImage success:', publicPath);

        return { success: true, path: publicPath };
    } catch (error) {
        console.error('[ImageManager] generateDummyImage error:', error);
        return { success: false, error: error.message };
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
    images.sort((a, b) => b.modified - a.modified);
    return images;
}

module.exports = {
    uploadImage,
    resizeImage,
    generateDummyImage,
    listImages
};
