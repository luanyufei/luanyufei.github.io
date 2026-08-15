const fsp = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { ROOT } = require('./posts');

const RESUME_PATH = path.join(ROOT, 'source', '_data', 'resume.yml');
const ABOUT_MD_PATH = path.join(ROOT, 'source', 'about', 'index.md');
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

async function readResume() {
  try {
    const raw = await fsp.readFile(RESUME_PATH, 'utf8');
    const data = yaml.load(raw) || {};
    return {
      basic: data.basic || {},
      sections: Array.isArray(data.sections) ? data.sections : [],
    };
  } catch (error) {
    return {
      basic: {
        name: '栾宇飞',
        englishName: 'Noon Yjufee / Alan Noon',
        phone: '19816311055',
        email: 'alannoon@qq.com',
      },
      sections: [],
    };
  }
}

function renderAboutMarkdown(resume) {
  const basic = resume.basic || {};
  const sections = resume.sections || [];

  const mainSections = sections.filter(s => s.type !== 'skills');
  const sideSections = sections.filter(s => s.type === 'skills');

  const mainCardsHtml = mainSections.map(sec => {
    const isProject = (sec.type === 'project' || sec.id === 'projects' || (sec.title || '').includes('项目'));
    const itemsHtml = (sec.items || []).map(item => {
      const subtitleHtml = item.subtitle ? `<span class="resume-item-subtitle">${esc(item.subtitle)}</span>` : '';
      const timeHtml = item.time ? `<span class="resume-item-time"><i class="far fa-calendar-alt"></i> ${esc(item.time)}</span>` : '';
      const tagsPills = (item.tags && item.tags.length)
        ? item.tags.map(t => `<span class="resume-tag-pill">${esc(t)}</span>`).join('')
        : '';
      const metaRow = (timeHtml || tagsPills)
        ? `<div class="resume-item-meta-row">${timeHtml}${tagsPills}</div>`
        : '';
      const bodyHtml = (item.details || item.desc)
        ? `<div class="resume-item-body">${esc(item.details || item.desc || '')}</div>`
        : '';

      return `<div class="resume-item-block">
<div class="resume-item-header-row">
<h3 class="resume-item-title">${esc(item.title || '')}</h3>
${subtitleHtml}
</div>
${metaRow}
${bodyHtml}
</div>`;
    }).join('\n');

    const moreHeader = isProject
      ? `<a href="/projects/" class="resume-more-link" title="查看精选项目与详细架构解析"><span>了解更多项目</span> <i class="fas fa-arrow-right"></i></a>`
      : '';
    const footerHtml = isProject
      ? `<div class="resume-section-footer"><a href="/projects/" class="resume-section-more-btn"><i class="fas fa-layer-group"></i> <span>在「代表作与精选项目」页面查看架构图与详细解析 ➔</span></a></div>`
      : '';

    return `<section class="resume-section-card" data-section-type="${esc(sec.type || 'custom')}">
<div class="resume-section-head">
<div style="display:flex;align-items:center;gap:0.65rem">
<span class="resume-section-icon">${sec.icon || '📌'}</span>
<h2 class="resume-section-title">${esc(sec.title || '自定义板块')}</h2>
</div>
${moreHeader}
</div>
<div class="resume-items-flow">
${itemsHtml}
</div>
${footerHtml}
</section>`;
  }).join('\n');

  const sideCardsHtml = sideSections.map(sec => {
    const groupsHtml = (sec.items || []).map(group => {
      const pillsHtml = (group.list || []).map(sk => `<span class="resume-skill-pill">${esc(sk)}</span>`).join('');
      return `<div class="resume-skill-group">
<div class="resume-skill-cat">${esc(group.category || '技能分类')}</div>
<div class="resume-skill-pills">
${pillsHtml}
</div>
</div>`;
    }).join('\n');

    return `<section class="resume-section-card skills-card">
<div class="resume-section-head">
<span class="resume-section-icon">${sec.icon || '⚡'}</span>
<h2 class="resume-section-title">${esc(sec.title || '专业技能')}</h2>
</div>
<div class="resume-skills-groups">
${groupsHtml}
</div>
</section>`;
  }).join('\n');

  const phonePill = basic.phone ? `<a href="tel:${esc(basic.phone)}" class="resume-pill"><i class="fas fa-phone-alt"></i> <span>${esc(basic.phone)}</span></a>` : '';
  const emailPill = basic.email ? `<a href="mailto:${esc(basic.email)}" class="resume-pill"><i class="fas fa-envelope"></i> <span>${esc(basic.email)}</span></a>` : '';
  const githubPill = basic.github ? `<a href="https://github.com/${esc(basic.github)}" target="_blank" rel="noopener" class="resume-pill"><i class="fab fa-github"></i> <span>github.com/${esc(basic.github)} ↗</span></a>` : '';
  const locPill = basic.location ? `<span class="resume-pill static"><i class="fas fa-map-marker-alt"></i> <span>${esc(basic.location)}</span></span>` : '';
  const pdfPill = basic.pdfResumeUrl ? `<a href="${esc(basic.pdfResumeUrl)}" target="_blank" class="resume-pill resume-download-btn"><i class="fas fa-file-pdf"></i> <span>下载 PDF 简历</span></a>` : '';
  const titleBadge = basic.title ? `<div class="resume-target-title"><i class="fas fa-terminal"></i> ${esc(basic.title)}</div>` : '';
  const bioDesc = basic.bio ? `<p class="resume-bio-desc">${esc(basic.bio)}</p>` : '';

  return `---
title: 个人履历
date: 2025-02-12 21:20:42
---

{% raw %}
<div class="resume-container">
<header class="resume-hero">
<div class="resume-avatar-side">
<div class="resume-avatar-frame">
<img class="resume-avatar no-lightbox" src="${esc(basic.avatar || '/img/touxiang.webp')}" alt="${esc(basic.name)}">
<div class="resume-avatar-badge">PORTRAIT / RESUME</div>
</div>
</div>
<div class="resume-info-side">
<div class="resume-badge-kicker">CURRICULUM VITAE · PROFILE</div>
<div class="resume-name-row">
<h1 class="resume-name">${esc(basic.name || '栾宇飞')}</h1>
<span class="resume-en-name">${esc(basic.englishName || 'Noon Yjufee')}</span>
</div>
${titleBadge}
${bioDesc}
<div class="resume-contact-bar">
${phonePill}
${emailPill}
${githubPill}
${locPill}
${pdfPill}
</div>
</div>
</header>

<div class="resume-content-layout">
<div class="resume-main-column">
${mainCardsHtml}
</div>
${sideSections.length ? `<div class="resume-side-column">\n${sideCardsHtml}\n</div>` : ''}
</div>
</div>
{% endraw %}
`;
}

async function saveResume(data) {
  await backupFile(RESUME_PATH, 'data');
  const out = yaml.dump(data, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
  await fsp.writeFile(RESUME_PATH, out, 'utf8');

  // 同步生成并更新 source/about/index.md
  await backupFile(ABOUT_MD_PATH, 'about');
  const mdContent = renderAboutMarkdown(data);
  await fsp.writeFile(ABOUT_MD_PATH, mdContent, 'utf8');

  return data;
}

module.exports = {
  RESUME_PATH,
  ABOUT_MD_PATH,
  readResume,
  saveResume,
  renderAboutMarkdown,
};
