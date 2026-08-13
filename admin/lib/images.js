const fsp = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { ROOT } = require('./posts');

const IMAGE_DIRS = [
  { label: 'image', dir: path.join(ROOT, 'source', 'image') },
  { label: 'img', dir: path.join(ROOT, 'source', 'img') },
];

const EXT_RE = /\.(png|jpe?g)$/i;
const TEXT_EXT_RE = /\.(md|yml|yaml|html)$/i;

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

function runCwebp(bin, src, dest, quality) {
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
        url: `/srcimg/${label}/${encodeURIComponent(path.basename(file))}`,
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
    const quality = item.dir === 'img' ? 82 : 80;
    const dest = item.path.replace(EXT_RE, '.webp');
    await runCwebp(bin, item.path, dest, quality);
    const stat = await fsp.stat(dest);
    const replaced = [];
    for (const file of await collectTextFiles()) {
      const text = await fsp.readFile(file, 'utf8');
      const next = replaceReferences(text, item.name, path.basename(dest));
      if (next !== text) {
        await fsp.writeFile(file, next, 'utf8');
        replaced.push(path.relative(ROOT, file));
      }
    }
    await fsp.unlink(item.path);
    results.push({
      name: item.name,
      to: path.basename(dest),
      before: item.size,
      after: stat.size,
      replaced,
    });
  }
  return results;
}

module.exports = { scanImages, convertImages };
