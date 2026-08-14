const fsp = require('fs').promises;
const path = require('path');
const http = require('http');
const https = require('https');
const yaml = require('js-yaml');
const { ROOT } = require('./posts');

const SHUOSHUO_PATH = path.join(ROOT, 'source', '_data', 'shuoshuo.yml');
const LINK_PATH = path.join(ROOT, 'source', '_data', 'link.yml');
const BACKUP_DIR = path.join(ROOT, 'admin', '.backup');

async function backupFile(filePath, tag) {
  const name = path.basename(filePath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, tag, `${name}.${stamp}.bak`);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.copyFile(filePath, dest);
  return dest;
}

async function readYaml(filePath) {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return yaml.load(raw) || [];
  } catch (error) {
    return [];
  }
}

async function writeYaml(filePath, data) {
  await backupFile(filePath, 'data');
  const out = yaml.dump(data, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
  await fsp.writeFile(filePath, out, 'utf8');
}

async function readShuoshuo() {
  const list = await readYaml(SHUOSHUO_PATH);
  return Array.isArray(list) ? list : [];
}

async function saveShuoshuo(list) {
  const clean = list
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      author: item.author || '乱与狒',
      date: String(item.date || ''),
      content: String(item.content || ''),
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    }));
  await writeYaml(SHUOSHUO_PATH, clean);
  return clean;
}

async function readLinks() {
  const list = await readYaml(LINK_PATH);
  return Array.isArray(list) ? list : [];
}

async function saveLinks(list) {
  const clean = list
    .filter((group) => group && typeof group === 'object')
    .map((group) => ({
      class_name: String(group.class_name || ''),
      class_desc: String(group.class_desc || ''),
      link_list: Array.isArray(group.link_list)
        ? group.link_list
            .filter((link) => link && typeof link === 'object')
            .map((link) => ({
              name: String(link.name || ''),
              link: String(link.link || ''),
              avatar: String(link.avatar || ''),
              descr: String(link.descr || ''),
            }))
        : [],
    }));
  await writeYaml(LINK_PATH, clean);
  return clean;
}

// 友链死链与健康度探测
async function checkLinkUrl(urlStr, timeoutMs = 7000) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === 'https:' ? https : http;
      const opt = {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: timeoutMs,
        rejectUnauthorized: false,
      };
      const req = mod.request(urlStr, opt, (res) => {
        const code = res.statusCode || 0;
        resolve({
          url: urlStr,
          status: code,
          ok: code >= 200 && code < 400,
          redirect: code >= 300 && code < 400,
          location: res.headers.location || null,
        });
        res.destroy();
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ url: urlStr, status: 408, ok: false, error: '超时未响应' });
      });
      req.on('error', (err) => {
        resolve({ url: urlStr, status: 0, ok: false, error: err.code || '连接失败' });
      });
      req.end();
    } catch (e) {
      resolve({ url: urlStr, status: 0, ok: false, error: '非法URL' });
    }
  });
}

async function checkAllLinks() {
  const groups = await readLinks();
  const allUrls = [];
  for (const g of groups) {
    for (const l of g.link_list || []) {
      if (l.link) allUrls.push(l.link);
    }
  }
  const uniqueUrls = [...new Set(allUrls)];
  const results = {};
  // 6 个并发探测
  for (let i = 0; i < uniqueUrls.length; i += 6) {
    const batch = uniqueUrls.slice(i, i + 6);
    const batchResults = await Promise.all(batch.map((u) => checkLinkUrl(u)));
    for (const r of batchResults) results[r.url] = r;
  }
  return results;
}

module.exports = {
  readShuoshuo,
  saveShuoshuo,
  readLinks,
  saveLinks,
  checkAllLinks,
};
