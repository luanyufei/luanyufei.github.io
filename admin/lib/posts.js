const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.resolve(__dirname, '..', '..');
const POSTS_DIR = path.join(ROOT, 'source', '_posts');
const DRAFTS_DIR = path.join(ROOT, 'source', '_drafts');
const BACKUP_DIR = path.join(ROOT, 'admin', '.backup');
const TRASH_DIR = path.join(ROOT, 'admin', '.trash');

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => toDateStr(new Date());

function normalizeDate(value) {
  if (value instanceof Date) return toDateStr(value);
  if (typeof value === 'string') return value.slice(0, 10);
  return value;
}

function countWords(content) {
  if (!content) return 0;
  const stripped = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`~\-_|]/g, '');
  const cjk = (stripped.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
  const words = (stripped.match(/[A-Za-z0-9]+/g) || []).length;
  return cjk + words;
}

function sanitizeFilename(title) {
  return String(title)
    .trim()
    .replace(/[/\\]/g, '-')
    .replace(/^\.+/, '')
    .replace(/:([ ]|$)/g, '：$1');
}

function parseFile(raw, fallbackTitle) {
  let data = {};
  let content = raw;
  try {
    const parsed = matter(raw);
    data = parsed.data || {};
    content = parsed.content || '';
  } catch (error) {
    data = { title: fallbackTitle };
  }
  data.date = normalizeDate(data.date);
  if (Array.isArray(data.categories)) data.categories = data.categories.map(String);
  if (typeof data.categories === 'string') data.categories = data.categories;
  if (Array.isArray(data.tags)) data.tags = data.tags.map(String);
  if (typeof data.tags === 'string') data.tags = [data.tags];
  if (!data.tags) data.tags = [];
  return { data, content };
}

function stringify(data, content) {
  const clean = { ...data };
  if (clean.date && clean.date.length === 10) {
    clean.date = clean.date;
  } else if (clean.date) {
    clean.date = normalizeDate(clean.date);
  }
  const out = matter.stringify((content || '').replace(/\s+$/, '') + '\n', clean);
  return out;
}

async function readPosts(dir) {
  let names = [];
  try {
    names = await fsp.readdir(dir);
  } catch (error) {
    return [];
  }
  const posts = [];
  for (const name of names) {
    if (!name.endsWith('.md')) continue;
    try {
      const stat = await fsp.stat(path.join(dir, name));
      const raw = await fsp.readFile(path.join(dir, name), 'utf8');
      const { data, content } = parseFile(raw, name.replace(/\.md$/, ''));
      posts.push({
        filename: name,
        title: data.title || name.replace(/\.md$/, ''),
        date: data.date || '',
        categories: data.categories ?? [],
        tags: data.tags || [],
        wordCount: countWords(content),
        hasImage: /!\[[^\]]*\]\([^)]*\)/.test(content),
        updatedAt: stat.mtime.toISOString(),
      });
    } catch (error) {
      posts.push({
        filename: name,
        title: name.replace(/\.md$/, ''),
        date: '',
        categories: [],
        tags: [],
        wordCount: 0,
        hasImage: false,
        error: error.message,
      });
    }
  }
  posts.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.filename.localeCompare(a.filename));
  return posts;
}

async function backupFile(filePath, tag) {
  const name = path.basename(filePath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, tag, `${name}.${stamp}.bak`);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.copyFile(filePath, dest);
  return dest;
}

function resolvePost(filename, type) {
  const dir = type === 'draft' ? DRAFTS_DIR : POSTS_DIR;
  const filePath = path.join(dir, path.basename(filename));
  if (!filePath.startsWith(dir)) throw new Error('非法文件名');
  return filePath;
}

async function getPost(filename, type) {
  const filePath = resolvePost(filename, type);
  const raw = await fsp.readFile(filePath, 'utf8');
  const { data, content } = parseFile(raw, filename);
  return { filename, type, data, content, raw };
}

async function savePost(filename, type, patch) {
  const filePath = resolvePost(filename, type);
  const current = await getPost(filename, type);
  const data = { ...current.data };
  if (patch.data) {
    for (const key of ['title', 'date', 'categories', 'tags']) {
      if (Object.prototype.hasOwnProperty.call(patch.data, key)) {
        const value = patch.data[key];
        if (key === 'date') data.date = value ? String(value).slice(0, 10) : todayStr();
        else if (key === 'tags') data.tags = Array.isArray(value) ? value.map((t) => String(t).trim()).filter(Boolean) : [];
        else if (key === 'categories') {
          const cats = Array.isArray(value) ? value.map((c) => String(c).trim()).filter(Boolean) : [];
          data.categories = cats.length === 1 ? cats[0] : cats;
        } else data.title = String(value || '').trim() || current.data.title;
      }
    }
  }
  const content = patch.content !== undefined ? patch.content : current.content;
  const next = stringify(data, content);
  if (next !== current.raw) {
    await backupFile(filePath, type);
    await fsp.writeFile(filePath, next, 'utf8');
  }
  return getPost(filename, type);
}

async function createPost(patch) {
  const title = String(patch.title || '').trim() || '未命名文章';
  const filename = `${sanitizeFilename(title)}.md`;
  const data = {
    title,
    date: String(patch.date || todayStr()).slice(0, 10),
  };
  const cats = Array.isArray(patch.categories) ? patch.categories.map(String).filter(Boolean) : [];
  if (cats.length === 1) data.categories = cats[0];
  else if (cats.length > 1) data.categories = cats;
  const tags = Array.isArray(patch.tags) ? patch.tags.map(String).filter(Boolean) : [];
  if (tags.length) data.tags = tags;
  const content = String(patch.content || '');
  const filePath = path.join(POSTS_DIR, filename);
  await fsp.writeFile(filePath, stringify(data, content), 'utf8');
  return { filename, type: 'post' };
}

async function movePost(filename, fromType, toType, options = {}) {
  const from = resolvePost(filename, fromType);
  const to = resolvePost(filename, toType);
  const { data, content } = parseFile(await fsp.readFile(from, 'utf8'), filename);
  if (toType === 'post' && (!data.date || options.refreshDate)) {
    data.date = todayStr();
  }
  await backupFile(from, fromType);
  await fsp.writeFile(to, stringify(data, content), 'utf8');
  await fsp.unlink(from);
  return { filename, type: toType, data };
}

async function trashPost(filename, type) {
  const filePath = resolvePost(filename, type);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(TRASH_DIR, `${path.basename(filename)}.${stamp}.trashed`);
  await fsp.rename(filePath, dest);
  return dest;
}

async function getAllTags() {
  const [posts, drafts] = await Promise.all([readPosts(POSTS_DIR), readPosts(DRAFTS_DIR)]);
  const set = new Set();
  for (const p of [...posts, ...drafts]) {
    for (const t of p.tags || []) if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh'));
}

module.exports = {
  ROOT,
  POSTS_DIR,
  DRAFTS_DIR,
  readPosts,
  getPost,
  savePost,
  createPost,
  movePost,
  trashPost,
  getAllTags,
  countWords,
  todayStr,
};
