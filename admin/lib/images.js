const fsp = require('fs').promises;
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { ROOT } = require('./posts');

const IMAGE_DIRS = [
  { label: 'image', dir: path.join(ROOT, 'source', 'image') },
  { label: 'img', dir: path.join(ROOT, 'source', 'img') },
];

const EXT_RE = /\.(png|jpe?g)$/i;
const ALL_IMG_EXT_RE = /\.(png|jpe?g|webp|gif|svg|ico)$/i;
const TEXT_EXT_RE = /\.(md|yml|yaml|html|js|css)$/i;

async function findCwebp() {
  const candidates = ['/opt/homebrew/bin/cwebp', '/usr/local/bin/cwebp', '/usr/bin/cwebp'];
  for (const bin of candidates) {
    try {
      await fsp.access(bin);
      return bin;
    } catch (error) {
      // keep looking
    }
  }
  return null;
}

function runCwebp(bin, src, dest, quality = 80) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['-q', String(quality), src, '-o', dest]);
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr || `cwebp exited ${code}`))));
    child.on('error', reject);
  });
}

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

async function scanImages() {
  const items = [];
  for (const { label, dir } of IMAGE_DIRS) {
    const files = await walk(dir);
    for (const file of files) {
      if (!EXT_RE.test(file)) continue;
      const base = file.replace(EXT_RE, '');
      const stat = await fsp.stat(file);
      const twin = await fsp.access(`${base}.webp`).then(() => true).catch(() => false);
      items.push({
        path: file,
        name: path.basename(file),
        dir: label,
        url: `/${label}/${encodeURIComponent(path.basename(file))}`,
        size: stat.size,
        converted: twin,
      });
    }
  }
  return items;
}

async function collectTextFiles() {
  const sourceDir = path.join(ROOT, 'source');
  const files = (await walk(sourceDir)).filter(
    (f) => TEXT_EXT_RE.test(f) && !f.includes(`${path.sep}data${path.sep}arial-rounded`)
  );
  // 同时加入主题配置文件
  const butterflyConfig = path.join(ROOT, '_config.butterfly.yml');
  const mainConfig = path.join(ROOT, '_config.yml');
  try { await fsp.access(butterflyConfig); files.push(butterflyConfig); } catch (e) {}
  try { await fsp.access(mainConfig); files.push(mainConfig); } catch (e) {}
  return files;
}

function replaceReferences(text, fromName, toName) {
  const from = fromName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(from, 'g');
  return text.replace(re, toName);
}

async function convertImages(selectedNames) {
  const bin = await findCwebp();
  if (!bin) {
    const error = new Error('未找到 cwebp，请先运行: brew install webp');
    error.code = 'NO_CWEBP';
    throw error;
  }
  const items = await scanImages();
  const targets = items.filter((item) => selectedNames.includes(item.name));
  const results = [];
  for (const item of targets) {
    if (item.converted) continue;
    const dest = item.path.replace(EXT_RE, '.webp');
    const destName = path.basename(dest);
    await runCwebp(bin, item.path, dest, 80);
    const beforeStat = await fsp.stat(item.path);
    const afterStat = await fsp.stat(dest);

    // 替换所有引用
    const textFiles = await collectTextFiles();
    const replaced = [];
    for (const tf of textFiles) {
      const raw = await fsp.readFile(tf, 'utf8');
      if (raw.includes(item.name)) {
        const next = replaceReferences(raw, item.name, destName);
        await fsp.writeFile(tf, next, 'utf8');
        replaced.push(path.relative(ROOT, tf));
      }
    }
    // 清理原文件
    await fsp.unlink(item.path);
    results.push({
      name: item.name,
      to: destName,
      before: beforeStat.size,
      after: afterStat.size,
      replaced,
    });
  }
  return results;
}

// 图片直接上传（支持从剪贴板/拖拽直传并自动转 WebP）
async function uploadImage({ buffer, originalName, mimeType = 'image/png' }) {
  const imageDir = path.join(ROOT, 'source', 'image');
  await fsp.mkdir(imageDir, { recursive: true });

  const rawExt = (path.extname(originalName || '') || '.png').toLowerCase();
  const baseName = (originalName || 'upload')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_')
    .replace(/^_+|_+$/g, '') || `img_${Date.now()}`;

  const bin = await findCwebp();
  const shouldConvertToWebp = bin && (rawExt === '.png' || rawExt === '.jpg' || rawExt === '.jpeg');

  let finalName = shouldConvertToWebp ? `${baseName}.webp` : `${baseName}${rawExt}`;
  let finalPath = path.join(imageDir, finalName);

  // 避免重名
  let counter = 1;
  while (true) {
    try {
      await fsp.access(finalPath);
      const namePart = shouldConvertToWebp ? `${baseName}_${counter++}.webp` : `${baseName}_${counter++}${rawExt}`;
      finalName = namePart;
      finalPath = path.join(imageDir, finalName);
    } catch (e) {
      break;
    }
  }

  if (shouldConvertToWebp) {
    const tmpSrc = path.join(os.tmpdir(), `upload_${Date.now()}${rawExt}`);
    await fsp.writeFile(tmpSrc, buffer);
    try {
      await runCwebp(bin, tmpSrc, finalPath, 80);
    } finally {
      await fsp.unlink(tmpSrc).catch(() => {});
    }
  } else {
    await fsp.writeFile(finalPath, buffer);
  }

  const stat = await fsp.stat(finalPath);
  return {
    url: `/image/${encodeURIComponent(finalName)}`,
    filename: finalName,
    size: stat.size,
    converted: shouldConvertToWebp,
  };
}

// 孤儿未引用图片扫描
async function scanOrphanImages() {
  // 1. 扫描所有图片文件
  const allImages = [];
  for (const { label, dir } of IMAGE_DIRS) {
    const files = await walk(dir);
    for (const f of files) {
      if (!ALL_IMG_EXT_RE.test(f)) continue;
      const stat = await fsp.stat(f);
      allImages.push({
        path: f,
        name: path.basename(f),
        dir: label,
        url: `/${label}/${encodeURIComponent(path.basename(f))}`,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
      });
    }
  }

  // 2. 读取所有文本文件正文并拼接为一个总文本池进行高效检索
  const textFiles = await collectTextFiles();
  const textContents = [];
  for (const tf of textFiles) {
    try {
      const c = await fsp.readFile(tf, 'utf8');
      textContents.push(c);
    } catch (e) {}
  }
  const bigTextPool = textContents.join('\n');

  // 3. 找出未被引用的图片
  // 保护核心默认图片：例如 touxiang.webp, noon-avatar.webp, favicon 等
  const protectedNames = new Set(['touxiang.webp', 'noon-avatar.webp', 'favicon.ico', 'touxiang.png', 'noon-avatar.png']);

  const orphans = allImages.filter((img) => {
    if (protectedNames.has(img.name)) return false;
    // 检查文件名是否出现在任何文本中
    return !bigTextPool.includes(img.name);
  });

  return {
    totalImages: allImages.length,
    orphanCount: orphans.length,
    orphanTotalSize: orphans.reduce((sum, o) => sum + o.size, 0),
    orphans,
  };
}

// 批量清理孤儿图片
async function deleteOrphanImages(names) {
  const nameSet = new Set(names);
  const { orphans } = await scanOrphanImages();
  const targets = orphans.filter((o) => nameSet.has(o.name));
  const deleted = [];
  for (const t of targets) {
    try {
      await fsp.unlink(t.path);
      deleted.push(t.name);
    } catch (e) {}
  }
  return { ok: true, count: deleted.length, deleted };
}

module.exports = {
  scanImages,
  convertImages,
  uploadImage,
  scanOrphanImages,
  deleteOrphanImages,
};
