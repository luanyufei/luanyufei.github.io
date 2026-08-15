const fsp = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { ROOT } = require('./posts');

const PROJECTS_PATH = path.join(ROOT, 'source', '_data', 'projects.yml');
const PROJECTS_MD_PATH = path.join(ROOT, 'source', 'projects', 'index.md');
const BACKUP_DIR = path.join(ROOT, 'admin', '.backup');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

async function backupFile(filePath, tag) {
  const name = path.basename(filePath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, tag, `${name}.${stamp}.bak`);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.copyFile(filePath, dest);
  return dest;
}

async function readProjects() {
  try {
    const raw = await fsp.readFile(PROJECTS_PATH, 'utf8');
    const data = yaml.load(raw) || {};
    return {
      projects: Array.isArray(data.projects) ? data.projects : [],
    };
  } catch (error) {
    return { projects: [] };
  }
}

function renderProjectsMarkdown(data) {
  const list = Array.isArray(data.projects) ? data.projects : [];

  const cardsHtml = list.map(item => {
    const isFeatured = !!item.featured;
    const catBadge = item.category
      ? `<div class="project-type-badge"><i class="fas fa-layer-group"></i> ${esc(item.category)}</div>`
      : '';
    const timePill = item.time
      ? `<span class="project-time-pill"><i class="far fa-calendar-alt"></i> ${esc(item.time)}</span>`
      : '';
    const headerHtml = (catBadge || timePill)
      ? `<div class="project-card-header">\n${catBadge}\n${timePill}\n</div>`
      : '';

    const tagsHtml = (item.tags && item.tags.length)
      ? `<div class="project-tags">\n${item.tags.map(t => `<span class="project-tag">${esc(t)}</span>`).join('\n')}\n</div>`
      : '';

    const highlightsHtml = (item.highlights && item.highlights.length)
      ? `<div class="project-highlights">\n${item.highlights.map(h => `<div class="highlight-item"><i class="fas fa-check-circle"></i> ${esc(h)}</div>`).join('\n')}\n</div>`
      : '';

    const linksHtml = (item.links && item.links.length)
      ? `<div class="project-card-footer">\n${item.links.map(l => {
          const isPri = !!l.primary;
          const iconHtml = l.icon ? `<i class="${esc(l.icon)}"></i> ` : '';
          const target = (l.url || '').startsWith('http') ? ' target="_blank" rel="noopener"' : '';
          return `<a href="${esc(l.url || '#')}" class="project-btn${isPri ? ' primary' : ''}"${target}>${iconHtml}<span>${esc(l.label || '查看链接')}</span></a>`;
        }).join('\n')}\n</div>`
      : '';

    const descHtml = item.desc ? `<p class="project-desc">${esc(item.desc)}</p>` : '';

    return `<article class="project-showcase-card${isFeatured ? ' featured' : ''}">
${headerHtml}
<div class="project-card-body">
<h2 class="project-title">${esc(item.title || '未命名项目')}</h2>
${descHtml}
${tagsHtml}
${highlightsHtml}
</div>
${linksHtml}
</article>`;
  }).join('\n\n');

  return `---
title: 项目
date: 2025-02-12 21:20:42
---

{% raw %}
<div class="projects-container">
<div class="projects-grid">
${cardsHtml}
</div>
</div>
{% endraw %}
`;
}

async function saveProjects(data) {
  await backupFile(PROJECTS_PATH, 'projects_data');
  const out = yaml.dump(data, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
  await fsp.writeFile(PROJECTS_PATH, out, 'utf8');

  // 同步生成并更新 source/projects/index.md
  await backupFile(PROJECTS_MD_PATH, 'projects_page');
  const mdContent = renderProjectsMarkdown(data);
  await fsp.writeFile(PROJECTS_MD_PATH, mdContent, 'utf8');

  return data;
}

module.exports = {
  PROJECTS_PATH,
  PROJECTS_MD_PATH,
  readProjects,
  saveProjects,
  renderProjectsMarkdown,
};
