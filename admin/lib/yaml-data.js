const fsp = require('fs').promises;
const path = require('path');
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

module.exports = { readShuoshuo, saveShuoshuo, readLinks, saveLinks };
