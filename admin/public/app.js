(() => {
  const state = {
    view: 'posts',
    postTab: 'published', // 'published' | 'draft' | 'trash' | 'stats'
    search: '',
    selectedCategory: '',
    selectedTag: '',
    sortBy: 'date-desc', // 'date-desc' | 'date-asc' | 'words-desc' | 'words-asc' | 'title'
    editing: null,
    posts: [],
    drafts: [],
    trash: [],
    stats: null,
    categories: [],
    allTags: [],
    trend: null,
    links: null,
    linkHealth: null,
    isCheckingLinks: false,
    images: null,
    imageSubTab: 'webp', // 'webp' | 'orphans'
    orphanData: null,
    selectedImages: new Set(),
    selectedOrphans: new Set(),
    previewRunning: false,
    previewStarting: false,
    gitLines: [],
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const fmtBytes = (n) => {
    if (!n || isNaN(n)) return '0 B';
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1048576).toFixed(1)} MB`;
  };

  const toRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.replace(/-/g, '/'));
      const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return '刚刚';
      if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
      if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
      return dateStr.slice(0, 10);
    } catch (e) {
      return dateStr;
    }
  };

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
    return data;
  }

  let toastTimer;
  function toast(msg, isErr = false) {
    const el = $('#toast');
    const icon = isErr
      ? `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
      : `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    el.innerHTML = `${icon}<span>${esc(msg)}</span>`;
    el.className = isErr ? 'show err' : 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ''; }, 2800);
  }

  function openModal(html) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><div class="modal-dialog">${html}</div></div>`;
    $('#modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') closeModal();
    });
    return root;
  }
  function closeModal() { $('#modal-root').innerHTML = ''; }

  const VIEW_TITLES = {
    posts: '文章管理',
    trend: '动态快讯',
    links: '导航链接',
    images: '图片转换',
    projects: '精选项目管理',
    resume: '简历与个人档案',
    deploy: '构建与部署',
  };

  function switchView(name, updateHash = true) {
    state.view = name;
    if (updateHash && !state.editing) {
      window.location.hash = `#${name}`;
    }
    const titleEl = $('#topbar-title');
    if (titleEl) titleEl.textContent = state.editing ? `编辑文章 / ${state.editing.filename}` : (VIEW_TITLES[name] || name);

    $$('.nav-item').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === name));
    $$('.view').forEach((v) => v.classList.toggle('hidden', v.id !== `view-${name}`));

    if (name === 'posts') renderPosts();
    if (name === 'trend') renderTrend();
    if (name === 'links') renderLinks();
    if (name === 'images') renderImages();
    if (name === 'projects') renderProjects();
    if (name === 'resume') renderResume();
    if (name === 'deploy') renderDeploy();

    refreshGlobalBadges();
  }

  async function refreshGlobalBadges() {
    try {
      const [posts, drafts, trend, links, images, projects, git, trash] = await Promise.allSettled([
        api('/api/posts'),
        api('/api/drafts'),
        api('/api/trend'),
        api('/api/links'),
        api('/api/images'),
        api('/api/projects'),
        api('/api/git/status'),
        api('/api/trash'),
      ]);

      if (posts.status === 'fulfilled') state.posts = posts.value;
      if (drafts.status === 'fulfilled') state.drafts = drafts.value;
      if (trash.status === 'fulfilled') state.trash = trash.value;

      if (posts.status === 'fulfilled' || drafts.status === 'fulfilled') {
        const total = (state.posts || []).length + (state.drafts || []).length;
        const b = $('#badge-posts');
        if (b) b.textContent = `${total}`;
      }

      if (trend.status === 'fulfilled') {
        state.trend = trend.value;
        const b = $('#badge-trend');
        if (b) b.textContent = `${state.trend.length}`;
      }

      if (links.status === 'fulfilled') {
        state.links = links.value;
        const totalLinks = state.links.reduce((sum, g) => sum + (g.link_list || []).length, 0);
        const b = $('#badge-links');
        if (b) b.textContent = `${totalLinks}`;
      }

      if (projects.status === 'fulfilled') {
        state.projects = projects.value;
        const b = $('#badge-projects');
        if (b) b.textContent = `${(state.projects?.projects || []).length}`;
      }

      if (images.status === 'fulfilled') {
        state.images = images.value;
        const pending = state.images.filter((i) => !i.converted).length;
        const b = $('#badge-images');
        if (b) {
          b.textContent = `${pending}`;
          b.classList.toggle('warning', pending > 0);
        }
      }

      if (git.status === 'fulfilled') {
        state.gitLines = git.value.lines || [];
        const ind = $('#indicator-git');
        if (ind) ind.classList.toggle('has-changes', state.gitLines.length > 0);
      }
    } catch (e) {}
  }

  // ==================== 文章管理 ====================
  function renderPosts() {
    if (state.editing) { renderEditor(); return; }
    const container = $('#view-posts');

    const totalPub = state.posts ? state.posts.length : 0;
    const totalDraft = state.drafts ? state.drafts.length : 0;
    const totalTrash = state.trash ? state.trash.length : 0;
    const totalWords = [...(state.posts || []), ...(state.drafts || [])].reduce((sum, p) => sum + (p.wordCount || 0), 0);

    container.innerHTML = `
      <div class="view-head">
        <div class="view-title-group">
          <div class="view-title">文章管理</div>
          <div class="view-sub">source/_posts · source/_drafts · admin/.trash</div>
        </div>
        <div class="toolbar">
          <button class="btn" id="btn-import-md" title="将本地 Markdown 笔记导入为草稿">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>导入 Markdown</span>
          </button>
          <button class="btn primary" id="btn-new-post">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>新建文章</span>
          </button>
        </div>
      </div>

      <div class="stats-strip">
        <div class="stat-card">
          <div class="stat-label">已发布文章</div>
          <div class="stat-value" id="stat-pub-count" style="color:var(--success)">${totalPub} <span>篇</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">草稿箱</div>
          <div class="stat-value" id="stat-draft-count" style="color:var(--warning)">${totalDraft} <span>篇</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">回收站</div>
          <div class="stat-value" id="stat-trash-count" style="color:var(--danger)">${totalTrash} <span>篇</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">全站总字数</div>
          <div class="stat-value" id="stat-words-count">${(totalWords / 1000).toFixed(1)}k <span>字</span></div>
        </div>
      </div>

      <div class="controls-bar">
        <div class="segmented-tabs">
          <button class="tab-btn ${state.postTab === 'published' ? 'active' : ''}" data-tab="published" id="tab-btn-pub">
            <span class="tab-dot published"></span>
            <span id="tab-label-pub">已发布 (${totalPub})</span>
          </button>
          <button class="tab-btn ${state.postTab === 'draft' ? 'active' : ''}" data-tab="draft" id="tab-btn-draft">
            <span class="tab-dot draft"></span>
            <span id="tab-label-draft">草稿箱 (${totalDraft})</span>
          </button>
          <button class="tab-btn ${state.postTab === 'trash' ? 'active' : ''}" data-tab="trash" id="tab-btn-trash">
            <span class="tab-dot" style="background:var(--danger)"></span>
            <span id="tab-label-trash">回收站 (${totalTrash})</span>
          </button>
          <button class="tab-btn ${state.postTab === 'stats' ? 'active' : ''}" data-tab="stats" id="tab-btn-stats">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            <span>统计与热力图</span>
          </button>
        </div>

        ${state.postTab !== 'stats' ? `
        <div class="search-wrapper">
          <span class="search-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input type="text" class="search-input" id="post-search" placeholder="搜索标题、分类或标签…">
          <button class="search-clear-btn" id="search-clear">✕</button>
        </div>` : ''}
      </div>

      ${state.postTab !== 'stats' && state.postTab !== 'trash' ? `
      <!-- 多维筛选与排序工具栏 -->
      <div class="post-filter-toolbar">
        <select class="filter-select" id="post-filter-category">
          <option value="">所有分类</option>
        </select>
        <select class="sort-select" id="post-sort-by">
          <option value="date-desc" ${state.sortBy === 'date-desc' ? 'selected' : ''}>按最新日期 ↓</option>
          <option value="date-asc" ${state.sortBy === 'date-asc' ? 'selected' : ''}>按最早日期 ↑</option>
          <option value="words-desc" ${state.sortBy === 'words-desc' ? 'selected' : ''}>按字数多到少 ↓</option>
          <option value="words-asc" ${state.sortBy === 'words-asc' ? 'selected' : ''}>按字数少到多 ↑</option>
          <option value="title" ${state.sortBy === 'title' ? 'selected' : ''}>按标题 (A-Z)</option>
        </select>
        <div class="tag-pills-wrap" id="post-tag-pills"></div>
      </div>` : ''}

      <div class="list-container" id="post-list">
        <div class="empty-state"><div class="empty-title">正在加载…</div></div>
      </div>`;

    // 绑定导入 Markdown 文件
    const importBtn = $('#btn-import-md');
    const mdInput = $('#md-import-input');
    if (importBtn && mdInput) {
      importBtn.addEventListener('click', () => mdInput.click());
      mdInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const content = await file.text();
          const res = await api('/api/post/import', {
            method: 'POST',
            body: { content, name: file.name, targetType: 'draft' },
          });
          toast(`✓ 已成功导入草稿「${res.filename}」`);
          state.postTab = 'draft';
          mdInput.value = '';
          renderPosts();
        } catch (err) { toast(err.message, true); }
      };
    }

    const searchInput = $('#post-search');
    const searchClear = $('#search-clear');
    if (searchInput) {
      searchInput.value = state.search;
      if (searchClear) searchClear.classList.toggle('visible', !!state.search);

      searchInput.addEventListener('input', (e) => {
        state.search = e.target.value;
        if (searchClear) searchClear.classList.toggle('visible', !!state.search);
        loadPostList();
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        state.search = '';
        if (searchInput) searchInput.value = '';
        searchClear.classList.remove('visible');
        loadPostList();
      });
    }

    const newPostBtn = $('#btn-new-post');
    if (newPostBtn) newPostBtn.addEventListener('click', showNewPostModal);

    $$('.tab-btn', container).forEach((tab) => tab.addEventListener('click', () => {
      state.postTab = tab.dataset.tab;
      state.editing = null;
      renderPosts();
    }));

    // 筛选与排序事件绑定
    const catSelect = $('#post-filter-category');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        state.selectedCategory = e.target.value;
        loadPostList();
      });
    }

    const sortSelect = $('#post-sort-by');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        loadPostList();
      });
    }

    loadPostList();
  }

  async function loadPostList() {
    const listEl = $('#post-list');
    if (!listEl) return;

    if (state.postTab === 'stats') {
      renderStatsView(listEl);
      return;
    }

    if (state.postTab === 'trash') {
      renderTrashView(listEl);
      return;
    }

    try {
      const isDraft = state.postTab === 'draft';
      const endpoint = isDraft ? '/api/drafts' : '/api/posts';
      const items = await api(endpoint);
      if (isDraft) state.drafts = items;
      else state.posts = items;

      const totalPub = (state.posts || []).length;
      const totalDraft = (state.drafts || []).length;
      const totalTrash = (state.trash || []).length;
      const totalWords = [...(state.posts || []), ...(state.drafts || [])].reduce((sum, p) => sum + (p.wordCount || 0), 0);

      const pubCountEl = $('#stat-pub-count');
      const draftCountEl = $('#stat-draft-count');
      const trashCountEl = $('#stat-trash-count');
      const wordsCountEl = $('#stat-words-count');
      const tabPubLabel = $('#tab-label-pub');
      const tabDraftLabel = $('#tab-label-draft');
      const tabTrashLabel = $('#tab-label-trash');

      if (pubCountEl) pubCountEl.innerHTML = `${totalPub} <span>篇</span>`;
      if (draftCountEl) draftCountEl.innerHTML = `${totalDraft} <span>篇</span>`;
      if (trashCountEl) trashCountEl.innerHTML = `${totalTrash} <span>篇</span>`;
      if (wordsCountEl) wordsCountEl.innerHTML = `${(totalWords / 1000).toFixed(1)}k <span>字</span>`;
      if (tabPubLabel) tabPubLabel.textContent = `已发布 (${totalPub})`;
      if (tabDraftLabel) tabDraftLabel.textContent = `草稿箱 (${totalDraft})`;
      if (tabTrashLabel) tabTrashLabel.textContent = `回收站 (${totalTrash})`;

      // 加载所有分类与标签，填充下拉框
      const [allCats, allTags] = await Promise.all([
        api('/api/categories').catch(() => []),
        api('/api/tags').catch(() => []),
      ]);
      state.categories = allCats;
      state.allTags = allTags;

      const catSelect = $('#post-filter-category');
      if (catSelect) {
        catSelect.innerHTML = `<option value="">所有分类 (${allCats.length})</option>` +
          allCats.map((c) => `<option value="${esc(c)}" ${state.selectedCategory === c ? 'selected' : ''}>${esc(c)}</option>`).join('');
      }

      const tagPillsWrap = $('#post-tag-pills');
      if (tagPillsWrap) {
        tagPillsWrap.innerHTML = allTags.slice(0, 10).map((t) => `
          <button class="filter-tag-pill ${state.selectedTag === t ? 'active' : ''}" data-tag="${esc(t)}">
            #${esc(t)}
          </button>
        `).join('');

        $$('.filter-tag-pill', tagPillsWrap).forEach((pill) => pill.addEventListener('click', () => {
          const tag = pill.dataset.tag;
          state.selectedTag = state.selectedTag === tag ? '' : tag;
          renderPosts();
        }));
      }

      // 过滤与排序处理
      let filtered = items.filter((p) => {
        if (state.search) {
          const q = state.search.toLowerCase();
          const inTitle = (p.title || p.filename).toLowerCase().includes(q);
          const inCat = (Array.isArray(p.categories) ? p.categories.join(' ') : (p.categories || '')).toLowerCase().includes(q);
          const inTag = (p.tags || []).join(' ').toLowerCase().includes(q);
          if (!inTitle && !inCat && !inTag) return false;
        }

        if (state.selectedCategory) {
          const cats = Array.isArray(p.categories) ? p.categories : (p.categories ? [p.categories] : []);
          if (!cats.includes(state.selectedCategory)) return false;
        }

        if (state.selectedTag) {
          const tags = Array.isArray(p.tags) ? p.tags : [];
          if (!tags.includes(state.selectedTag)) return false;
        }

        return true;
      });

      // 排序
      filtered.sort((a, b) => {
        if (state.sortBy === 'date-desc') return String(b.date).localeCompare(String(a.date)) || b.filename.localeCompare(a.filename);
        if (state.sortBy === 'date-asc') return String(a.date).localeCompare(String(b.date)) || a.filename.localeCompare(b.filename);
        if (state.sortBy === 'words-desc') return (b.wordCount || 0) - (a.wordCount || 0);
        if (state.sortBy === 'words-asc') return (a.wordCount || 0) - (b.wordCount || 0);
        if (state.sortBy === 'title') return String(a.title || a.filename).localeCompare(String(b.title || b.filename), 'zh');
        return 0;
      });

      if (!filtered.length) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div>
            <div class="empty-title">没有找到匹配的文章</div>
            <div class="empty-desc">尝试调整筛选条件或搜索关键词</div>
          </div>`;
        return;
      }

      listEl.innerHTML = filtered.map((p) => {
        const cats = Array.isArray(p.categories) ? p.categories : (p.categories ? [p.categories] : []);
        const estMinutes = Math.max(1, Math.ceil((p.wordCount || 0) / 350));
        return `
        <div class="article-row" data-filename="${esc(p.filename)}" data-type="${isDraft ? 'draft' : 'post'}">
          <div class="row-status-dot ${isDraft ? 'draft' : 'post'}" title="${isDraft ? '草稿' : '已发布'}"></div>
          <div class="row-content">
            <div class="row-title">${esc(p.title || p.filename)}</div>
            <div class="row-meta">
              <span class="meta-item mono">
                <span class="meta-icon">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                </span>
                ${esc(p.date || '无日期')}
              </span>
              ${cats.length ? `
                <span class="meta-item category-tag">
                  <span class="meta-icon" style="color:inherit">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                  </span>
                  ${cats.map((c) => esc(c)).join(' / ')}
                </span>` : ''}
              <span class="meta-item mono">
                <span class="meta-icon">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                </span>
                ${p.wordCount || 0} 字 · 约 ${estMinutes} 分钟
              </span>
              ${p.hasImage ? `
                <span class="meta-item img-indicator">
                  <span class="meta-icon" style="color:#60a5fa">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  </span>
                  含配图
                </span>` : ''}
              ${(p.tags || []).map((t) => `<span class="tag-pill">#${esc(t)}</span>`).join('')}
            </div>
          </div>
          <div class="row-actions">
            <button class="btn sm" data-action="edit" data-filename="${esc(p.filename)}" title="编辑文章">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              <span>编辑</span>
            </button>
            <button class="btn sm" data-action="move" data-filename="${esc(p.filename)}" title="${isDraft ? '发布到线上' : '转入草稿箱'}">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
              <span>${isDraft ? '发布' : '转草稿'}</span>
            </button>
            <button class="btn sm danger" data-action="trash" data-filename="${esc(p.filename)}" title="移入回收站">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>`;
      }).join('');

      $$('.article-row', listEl).forEach((row) => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('.row-actions')) return;
          state.editing = { filename: row.dataset.filename, type: row.dataset.type };
          window.location.hash = `#editor?filename=${encodeURIComponent(row.dataset.filename)}&type=${row.dataset.type}`;
          renderEditor();
        });
      });

      $$('button[data-action]', listEl).forEach((btn) => btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const filename = btn.dataset.filename;
        const action = btn.dataset.action;
        try {
          if (action === 'edit') {
            state.editing = { filename, type: isDraft ? 'draft' : 'post' };
            window.location.hash = `#editor?filename=${encodeURIComponent(filename)}&type=${state.editing.type}`;
            renderEditor();
          } else if (action === 'move') {
            const to = isDraft ? 'post' : 'draft';
            const refreshDate = to === 'post' && isDraft
              ? confirm('发布时是否把 Front-Matter 日期自动更新为今天？') : false;
            await api('/api/move', { method: 'POST', body: { filename, to, refreshDate } });
            toast(to === 'post' ? '✨ 文章已发布' : '📦 已转入草稿箱');
            loadPostList();
          } else if (action === 'trash') {
            if (!confirm(`确定要将「${filename}」移入回收站？\n您随时可以在回收站一键恢复。`)) return;
            await api('/api/post', { method: 'DELETE', body: { filename, type: isDraft ? 'draft' : 'post' } });
            toast('🗑 已移入回收站');
            refreshGlobalBadges();
            loadPostList();
          }
        } catch (error) { toast(error.message, true); }
      }));
    } catch (error) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-title">加载失败：${esc(error.message)}</div></div>`;
    }
  }

  // ==================== 回收站视图 ====================
  async function renderTrashView(listEl) {
    try {
      const items = await api('/api/trash');
      state.trash = items;

      if (!items.length) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></div>
            <div class="empty-title">回收站是空的</div>
            <div class="empty-desc">被删除的文章会临时保存在这里，可随时恢复</div>
          </div>`;
        return;
      }

      listEl.innerHTML = `
        <div class="trash-banner">
          <div>回收站共 <b>${items.length}</b> 篇软删除文件（保存在 <code>admin/.trash</code>）</div>
          <button class="btn sm danger" id="btn-purge-all">清空回收站</button>
        </div>
        ${items.map((t) => `
          <div class="article-row" style="opacity:0.9">
            <span class="trash-card-tag">${t.type === 'draft' ? '草稿' : '文章'}</span>
            <div class="row-content">
              <div class="row-title">${esc(t.title || t.originalFilename)}</div>
              <div class="row-meta">
                <span class="meta-item mono">原名: ${esc(t.originalFilename)}</span>
                <span class="meta-item mono">删除时间: ${esc(toRelativeTime(t.trashedAt))}</span>
                <span class="meta-item mono">${t.wordCount || 0} 字</span>
              </div>
            </div>
            <div class="row-actions">
              <button class="btn sm primary" data-trash-act="restore" data-file="${esc(t.trashedFile)}">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                <span>恢复</span>
              </button>
              <button class="btn sm danger" data-trash-act="purge" data-file="${esc(t.trashedFile)}" title="彻底删除无法找回">
                彻底删除
              </button>
            </div>
          </div>
        `).join('')}
      `;

      $('#btn-purge-all').addEventListener('click', async () => {
        if (!confirm('确定彻底清空回收站？此操作不可逆！')) return;
        try {
          await api('/api/trash/purge', { method: 'POST', body: {} });
          toast('✓ 回收站已清空');
          renderPosts();
        } catch (e) { toast(e.message, true); }
      });

      $$('button[data-trash-act]', listEl).forEach((btn) => btn.addEventListener('click', async () => {
        const file = btn.dataset.file;
        const act = btn.dataset.trashAct;
        try {
          if (act === 'restore') {
            const res = await api('/api/trash/restore', { method: 'POST', body: { filename: file } });
            toast(`✓ 已恢复「${res.filename}」至 ${res.type === 'draft' ? '草稿箱' : '已发布'}`);
            renderPosts();
          } else if (act === 'purge') {
            if (!confirm('确定彻底删除该文件？')) return;
            await api('/api/trash/purge', { method: 'POST', body: { filename: file } });
            toast('已永久删除');
            renderPosts();
          }
        } catch (e) { toast(e.message, true); }
      }));
    } catch (e) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-title">加载回收站失败：${esc(e.message)}</div></div>`;
    }
  }

  // ==================== 统计与热力图视图 ====================
  async function renderStatsView(listEl) {
    try {
      const stats = await api('/api/stats');
      state.stats = stats;

      // 生成近 364 天（52 周）热力图网格
      const today = new Date();
      const weeks = [];
      let currentWeek = [];

      // 回溯 52 周 (364 天)
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - (52 * 7 - 1) - today.getDay());

      for (let i = 0; i < 53 * 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        if (d > today) break;

        const pad = (n) => String(n).padStart(2, '0');
        const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const count = stats.heatmap[dateStr] || 0;

        let level = 0;
        if (count >= 5) level = 4;
        else if (count >= 3) level = 3;
        else if (count >= 2) level = 2;
        else if (count >= 1) level = 1;

        currentWeek.push({ date: dateStr, count, level });
        if (currentWeek.length === 7) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }
      if (currentWeek.length) weeks.push(currentWeek);

      listEl.innerHTML = `
        <div class="stats-overview-container">
          <div class="heatmap-card">
            <div class="heatmap-header">
              <div class="heatmap-title">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span>近一年创作活动热力图 (Activity Heatmap)</span>
              </div>
              <div class="heatmap-legend">
                <span>少</span>
                <span class="heatmap-legend-cell" style="background:var(--border-subtle)"></span>
                <span class="heatmap-legend-cell" style="background:rgba(189,255,53,0.28)"></span>
                <span class="heatmap-legend-cell" style="background:rgba(189,255,53,0.55)"></span>
                <span class="heatmap-legend-cell" style="background:rgba(189,255,53,0.85)"></span>
                <span class="heatmap-legend-cell" style="background:#bdff35"></span>
                <span>多</span>
              </div>
            </div>
            <div class="heatmap-scroll-wrap">
              <div class="heatmap-table" id="heatmap-grid">
                ${weeks.map((w) => `
                  <div class="heatmap-week">
                    ${w.map((cell) => `
                      <div class="heatmap-cell" data-date="${cell.date}" data-count="${cell.count}" data-level="${cell.level}"></div>
                    `).join('')}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="stats-charts-row">
            <div class="chart-box">
              <div class="chart-title">分类文章分布</div>
              <div class="category-bar-list">
                ${stats.categories.map((c) => {
                  const pct = Math.round((c.count / (stats.postsCount + stats.draftsCount || 1)) * 100);
                  return `
                    <div class="category-bar-item">
                      <div class="category-bar-info">
                        <span>${esc(c.name)}</span>
                        <span class="mono">${c.count} 篇 (${pct}%)</span>
                      </div>
                      <div class="category-progress-bg">
                        <div class="category-progress-fill" style="width:${pct}%"></div>
                      </div>
                    </div>`;
                }).join('')}
              </div>
            </div>

            <div class="chart-box">
              <div class="chart-title">高频标签云</div>
              <div class="tag-cloud-list">
                ${stats.tags.map((t) => `
                  <span class="tag-cloud-item">
                    <span>#${esc(t.name)}</span>
                    <span class="tag-cloud-count">${t.count}</span>
                  </span>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;

      // 绑定热力图 tooltip
      let tooltip = $('.heatmap-tooltip');
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'heatmap-tooltip';
        document.body.appendChild(tooltip);
      }

      $$('.heatmap-cell', listEl).forEach((cell) => {
        cell.addEventListener('mouseenter', (e) => {
          const date = cell.dataset.date;
          const count = cell.dataset.count;
          tooltip.textContent = `${date}: ${count} 次创作记录`;
          tooltip.classList.add('visible');
          const rect = cell.getBoundingClientRect();
          tooltip.style.left = `${rect.left + rect.width / 2}px`;
          tooltip.style.top = `${rect.top}px`;
        });
        cell.addEventListener('mouseleave', () => {
          tooltip.classList.remove('visible');
        });
      });
    } catch (e) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-title">加载统计数据失败：${esc(e.message)}</div></div>`;
    }
  }

  function showNewPostModal() {
    const today = new Date().toISOString().slice(0, 10);
    openModal(`
      <h2>新建 Markdown 文章</h2>
      <div class="fm-field" style="margin-bottom:12px">
        <label>文章标题 (将自动生成文件名)</label>
        <input type="text" id="np-title" placeholder="输入文章标题…" autofocus>
      </div>
      <div class="fm-grid" style="margin-bottom:12px">
        <div class="fm-field">
          <label>发布日期</label>
          <input type="date" id="np-date" value="${today}">
        </div>
        <div class="fm-field">
          <label>所属分类</label>
          <input type="text" id="np-categories" placeholder="例如：技术 / 随笔">
        </div>
      </div>
      <div class="fm-field" style="margin-bottom:16px">
        <label>标签 (逗号分隔)</label>
        <input type="text" id="np-tags" placeholder="例如：Linux, Hexo, Web" list="tag-options">
        <datalist id="tag-options"></datalist>
      </div>
      <div class="modal-actions">
        <button class="btn" id="np-cancel">取消</button>
        <button class="btn primary" id="np-create">立即创建</button>
      </div>`);

    api('/api/tags').then((tags) => {
      const dl = $('#tag-options');
      if (dl) dl.innerHTML = tags.map((t) => `<option value="${esc(t)}">`).join('');
    }).catch(() => {});

    $('#np-cancel').addEventListener('click', closeModal);
    $('#np-create').addEventListener('click', async () => {
      const title = $('#np-title').value.trim();
      if (!title) return toast('请输入文章标题', true);
      try {
        const { filename } = await api('/api/post', {
          method: 'POST',
          body: {
            title,
            date: $('#np-date').value,
            categories: $('#np-categories').value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
            tags: $('#np-tags').value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
          },
        });
        closeModal();
        toast('文章已创建');
        state.editing = { filename, type: 'post' };
        window.location.hash = `#editor?filename=${encodeURIComponent(filename)}&type=post`;
        renderEditor();
      } catch (error) { toast(error.message, true); }
    });
  }

  // ==================== 双栏 Markdown 编辑器 ====================
  let editorDirty = false;
  let previewTimer;

  async function renderEditor() {
    const container = $('#view-posts');
    try {
      const post = await api(`/api/post?filename=${encodeURIComponent(state.editing.filename)}&type=${state.editing.type}`);
      const cats = Array.isArray(post.data.categories) ? post.data.categories.join(', ') : (post.data.categories || '');
      const tags = Array.isArray(post.data.tags) ? post.data.tags.join(', ') : (post.data.tags || '');

      const isDraft = state.editing.type === 'draft';

      container.innerHTML = `
        <div class="view-head">
          <div class="view-title-group">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="view-title" id="ed-display-title">${esc(post.data.title || post.filename)}</div>
              <span class="row-status-dot ${isDraft ? 'draft' : 'post'}"></span>
              <span class="tag-pill" style="font-size:11px">${isDraft ? '草稿箱' : '已发布'}</span>
              <span class="dirty-indicator" id="dirty-badge" style="display:none">● 未保存改动</span>
            </div>
            <div class="view-sub">${esc(post.filename)} · 实时双栏预览 · 支持图片粘贴拖拽直传</div>
          </div>
          <div class="toolbar">
            <button class="btn" id="ed-revisions" title="查看历史备份版本与差异回滚">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
              <span>历史版本</span>
            </button>
            <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);cursor:pointer;margin-right:4px">
              <input type="checkbox" id="ed-refresh-date">
              <span>发布时更新日期</span>
            </label>
            <button class="btn" id="ed-back">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>返回列表</span>
            </button>
            <button class="btn" id="ed-move">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
              <span>${isDraft ? '发布到线上' : '转入草稿箱'}</span>
            </button>
            <button class="btn danger" id="ed-trash" title="移入回收站">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
            <button class="btn primary" id="ed-save">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              <span>保存 (⌘S)</span>
            </button>
          </div>
        </div>

        <div class="editor-layout">
          <!-- 左栏：源码与属性 -->
          <div class="editor-column editor-pane" id="editor-left-pane">
            <div class="editor-drop-overlay" id="editor-drop-overlay" style="display:none">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              <div class="editor-drop-text">释放图片直接上传并转为 WebP</div>
            </div>

            <div class="panel-header">
              <span class="panel-title">Source &amp; Front-Matter</span>
              <span class="panel-sub" id="ed-word-count">0 字</span>
            </div>
            <div class="panel-body">
              <div class="fm-card">
                <div class="fm-grid">
                  <div class="fm-field full-width">
                    <label>标题 Title</label>
                    <input type="text" id="ed-title" value="${esc(post.data.title || '')}" placeholder="文章主标题">
                  </div>
                  <div class="fm-field">
                    <label>
                      <span>日期 Date</span>
                      <span class="quick-now-btn" id="btn-set-today">设为今天</span>
                    </label>
                    <input type="date" id="ed-date" value="${esc(post.data.date || '')}">
                  </div>
                  <div class="fm-field">
                    <label>分类 Categories</label>
                    <input type="text" id="ed-categories" value="${esc(cats)}" placeholder="逗号分隔，如：技术, 教程">
                  </div>
                  <div class="fm-field full-width">
                    <label>标签 Tags</label>
                    <input type="text" id="ed-tags" value="${esc(tags)}" placeholder="逗号分隔，如：Linux, Hexo" list="tag-options">
                    <datalist id="tag-options"></datalist>
                  </div>
                </div>
              </div>

              <!-- Markdown 工具栏 -->
              <div class="md-toolbar">
                <button class="tool-btn" data-tool="bold" title="粗体 (⌘B)"><b>B</b></button>
                <button class="tool-btn" data-tool="italic" title="斜体 (⌘I)"><i>I</i></button>
                <button class="tool-btn" data-tool="h2" title="二级标题">H2</button>
                <button class="tool-btn" data-tool="h3" title="三级标题">H3</button>
                <button class="tool-btn" data-tool="quote" title="引用">&ldquo;</button>
                <button class="tool-btn" data-tool="code" title="代码块">&lt;/&gt;</button>
                <button class="tool-btn" data-tool="table" title="插入表格">▦ 表格</button>
                <button class="tool-btn" data-tool="image" title="选择图片上传 (自动转WebP)">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  <span>上传图片</span>
                </button>
                <button class="tool-btn" data-tool="link" title="插入链接">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                  <span>链接</span>
                </button>
              </div>
              <textarea class="editor-textarea" id="ed-content" placeholder="在这里使用 Markdown 撰写正文…（可直接从剪贴板粘贴截图 ⌘V 或拖拽图片文件）">${esc(post.content)}</textarea>
            </div>
          </div>

          <!-- 右栏：实时预览 -->
          <div class="editor-column">
            <div class="panel-header">
              <span class="panel-title">Live Preview</span>
              <span class="panel-sub">FeeSpace Theme Renderer</span>
            </div>
            <div class="panel-body">
              <div class="markdown-preview" id="ed-preview"></div>
            </div>
          </div>
        </div>`;

      const titleInput = $('#ed-title');
      const contentTextarea = $('#ed-content');
      const previewEl = $('#ed-preview');
      const dirtyBadge = $('#dirty-badge');
      const wordCountEl = $('#ed-word-count');
      const dropOverlay = $('#editor-drop-overlay');

      const markDirty = () => {
        editorDirty = true;
        dirtyBadge.style.display = 'inline-flex';
      };

      api('/api/tags').then((tagsList) => {
        const dl = $('#tag-options');
        if (dl) dl.innerHTML = tagsList.map((t) => `<option value="${esc(t)}">`).join('');
      }).catch(() => {});

      $('#btn-set-today').addEventListener('click', () => {
        $('#ed-date').value = new Date().toISOString().slice(0, 10);
        markDirty();
      });

      titleInput.addEventListener('input', () => {
        $('#ed-display-title').textContent = titleInput.value || '未命名文章';
        markDirty();
      });

      const updatePreview = () => {
        const raw = contentTextarea.value || '';
        previewEl.innerHTML = marked.parse(raw);
        if (window.Prism) Prism.highlightAllUnder(previewEl);

        const stripped = raw.replace(/```[\s\S]*?```/g, '').replace(/[#>*`~\-_|]/g, '');
        const cjk = (stripped.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
        const words = (stripped.match(/[A-Za-z0-9]+/g) || []).length;
        wordCountEl.textContent = `${cjk + words} 字`;
      };
      updatePreview();

      contentTextarea.addEventListener('input', () => {
        markDirty();
        clearTimeout(previewTimer);
        previewTimer = setTimeout(updatePreview, 200);
      });

      // 支持 Tab 缩进 2 空格
      contentTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = contentTextarea.selectionStart;
          const end = contentTextarea.selectionEnd;
          contentTextarea.value = contentTextarea.value.substring(0, start) + '  ' + contentTextarea.value.substring(end);
          contentTextarea.selectionStart = contentTextarea.selectionEnd = start + 2;
          markDirty();
          updatePreview();
        }
      });

      // ==================== 图片上传与粘贴/拖拽处理 ====================
      const handleImageUpload = async (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        toast('⏳ 正在上传并转换为 WebP…');
        try {
          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = reader.result;
            const res = await api('/api/images/upload', {
              method: 'POST',
              body: { name: file.name, data: dataUrl, mimeType: file.type },
            });

            // 在光标处插入图片 Markdown
            const ta = contentTextarea;
            const start = ta.selectionStart || ta.value.length;
            const end = ta.selectionEnd || ta.value.length;
            const alt = file.name.replace(/\.[^.]+$/, '');
            const insert = `\n![${alt}](${res.url})\n`;

            ta.setRangeText(insert, start, end, 'end');
            markDirty();
            updatePreview();
            toast(`✓ 图片已上传: ${res.filename}`);
          };
          reader.readAsDataURL(file);
        } catch (e) {
          toast(`图片上传失败: ${e.message}`, true);
        }
      };

      // 剪贴板粘贴图片 (⌘V)
      contentTextarea.addEventListener('paste', async (e) => {
        const items = (e.clipboardData || window.clipboardData).items;
        for (const item of items) {
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            await handleImageUpload(file);
            return;
          }
        }
      });

      // 拖拽图片直传
      const leftPane = $('#editor-left-pane');
      if (leftPane) {
        leftPane.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropOverlay.style.display = 'flex';
        });
        leftPane.addEventListener('dragleave', (e) => {
          if (e.target === dropOverlay || !leftPane.contains(e.relatedTarget)) {
            dropOverlay.style.display = 'none';
          }
        });
        leftPane.addEventListener('drop', async (e) => {
          e.preventDefault();
          dropOverlay.style.display = 'none';
          if (e.dataTransfer.files && e.dataTransfer.files.length) {
            for (const file of e.dataTransfer.files) {
              if (file.type.startsWith('image/')) {
                await handleImageUpload(file);
              }
            }
          }
        });
      }

      // 工具栏快捷插入
      $$('.tool-btn').forEach((btn) => btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        const ta = contentTextarea;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const sel = ta.value.substring(start, end);
        let insert = '';

        if (tool === 'bold') insert = `**${sel || '粗体文字'}**`;
        else if (tool === 'italic') insert = `*${sel || '斜体文字'}*`;
        else if (tool === 'h2') insert = `\n## ${sel || '标题内容'}\n`;
        else if (tool === 'h3') insert = `\n### ${sel || '小标题'}\n`;
        else if (tool === 'quote') insert = `\n> ${sel || '引用文本'}\n`;
        else if (tool === 'code') insert = `\n\`\`\`javascript\n${sel || '// 代码内容'}\n\`\`\`\n`;
        else if (tool === 'table') insert = `\n| 列 1 | 列 2 |\n|---|---|\n| 数据 1 | 数据 2 |\n`;
        else if (tool === 'image') {
          const imgInput = $('#image-upload-input');
          if (imgInput) {
            imgInput.onchange = (e) => {
              if (e.target.files && e.target.files[0]) {
                handleImageUpload(e.target.files[0]);
                imgInput.value = '';
              }
            };
            imgInput.click();
          }
          return;
        } else if (tool === 'link') insert = `[${sel || '链接文字'}](https://example.com)`;

        ta.setRangeText(insert, start, end, 'select');
        markDirty();
        updatePreview();
        ta.focus();
      }));

      // 查看历史版本
      $('#ed-revisions').addEventListener('click', async () => {
        try {
          const revs = await api(`/api/post/revisions?filename=${encodeURIComponent(state.editing.filename)}&type=${state.editing.type}`);
          if (!revs.length) return toast('暂无历史修订版本（每次点击保存都会生成自动备份）');

          openModal(`
            <div class="revisions-modal">
              <h2>📜 历史修订版本 (${revs.length})</h2>
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">
                每次保存文件前系统会自动在 <code>admin/.backup</code> 留存快照，点击可预览并一键回滚。
              </div>
              <div class="revisions-list">
                ${revs.map((r, i) => `
                  <div class="revision-item">
                    <div class="revision-meta">
                      <div class="revision-time">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                        <span>${new Date(r.timestamp).toLocaleString()}</span>
                        <span class="tag-pill" style="font-size:10px">${toRelativeTime(r.timestamp)}</span>
                      </div>
                      <div class="revision-desc">${fmtBytes(r.size)} · ${r.wordCount} 字</div>
                    </div>
                    <div style="display:flex;gap:6px">
                      <button class="btn sm" data-rev-idx="${i}" data-rev-act="preview">查看正文</button>
                      <button class="btn sm primary" data-rev-file="${esc(r.backupFile)}" data-rev-act="restore">恢复此版本</button>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div class="modal-actions">
                <button class="btn" id="rev-close">关闭</button>
              </div>
            </div>
          `);

          $('#rev-close').addEventListener('click', closeModal);

          $$('button[data-rev-act]').forEach((btn) => btn.addEventListener('click', async () => {
            const act = btn.dataset.revAct;
            if (act === 'restore') {
              const bfile = btn.dataset.revFile;
              if (!confirm('确定将当前文章回滚至该历史版本？当前未保存内容将被覆盖（原内容已再次自动备份）。')) return;
              await api('/api/post/restore-revision', {
                method: 'POST',
                body: { filename: state.editing.filename, type: state.editing.type, backupFile: bfile },
              });
              closeModal();
              toast('✓ 已恢复至选中的历史版本');
              renderEditor();
            } else if (act === 'preview') {
              const idx = Number(btn.dataset.revIdx);
              const r = revs[idx];
              alert(`【历史版本正文预览 - ${new Date(r.timestamp).toLocaleString()}】\n\n` + r.content.slice(0, 1000) + (r.content.length > 1000 ? '\n\n...(内容较长已截断)' : ''));
            }
          }));
        } catch (e) { toast(e.message, true); }
      });

      $('#ed-back').addEventListener('click', () => {
        if (editorDirty && !confirm('有尚未保存的更改，确认返回吗？')) return;
        state.editing = null;
        editorDirty = false;
        window.location.hash = '#posts';
        renderPosts();
      });

      $('#ed-trash').addEventListener('click', async () => {
        if (!confirm(`确定将「${state.editing.filename}」移入回收站？`)) return;
        try {
          await api('/api/post', { method: 'DELETE', body: { filename: state.editing.filename, type: state.editing.type } });
          toast('已移入回收站');
          state.editing = null;
          editorDirty = false;
          window.location.hash = '#posts';
          renderPosts();
        } catch (error) { toast(error.message, true); }
      });

      $('#ed-move').addEventListener('click', async () => {
        const to = state.editing.type === 'draft' ? 'post' : 'draft';
        try {
          await api('/api/move', {
            method: 'POST',
            body: { filename: state.editing.filename, to, refreshDate: $('#ed-refresh-date').checked },
          });
          state.editing.type = to;
          toast(to === 'post' ? '✨ 已发布至文章列表' : '📦 已移入草稿箱');
          renderEditor();
        } catch (error) { toast(error.message, true); }
      });

      const doSave = async () => {
        const btn = $('#ed-save');
        if (!btn) return;
        btn.disabled = true;
        try {
          await api('/api/post', {
            method: 'PUT',
            body: {
              filename: state.editing.filename,
              type: state.editing.type,
              data: {
                title: $('#ed-title').value,
                date: $('#ed-date').value,
                categories: $('#ed-categories').value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
                tags: $('#ed-tags').value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
              },
              content: $('#ed-content').value,
            },
          });
          editorDirty = false;
          dirtyBadge.style.display = 'none';
          toast('✓ 保存成功（已备份历史至 admin/.backup）');
        } catch (error) { toast(error.message, true); } finally { btn.disabled = false; }
      };

      $('#ed-save').addEventListener('click', doSave);
    } catch (error) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">加载文章失败：${esc(error.message)}</div>
          <button class="btn" style="margin-top:14px" id="ed-fail-back">返回列表</button>
        </div>`;
      $('#ed-fail-back').addEventListener('click', () => {
        state.editing = null;
        window.location.hash = '#posts';
        renderPosts();
      });
    }
  }

  // ==================== 动态快讯 (FeeFee动态 / shuoshuo.yml) ====================
  async function renderTrend() {
    const container = $('#view-trend');
    container.innerHTML = `
      <div class="view-head">
        <div class="view-title-group">
          <div class="view-title">动态快讯</div>
          <div class="view-sub">source/_data/shuoshuo.yml · 按时间倒序展示</div>
        </div>
        <div class="toolbar">
          <button class="btn primary" id="trend-add">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>发布动态</span>
          </button>
          <button class="btn" id="trend-save">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path></svg>
            <span>保存全部更改</span>
          </button>
        </div>
      </div>
      <div class="timeline-feed" id="trend-feed">
        <div class="empty-state"><div class="empty-title">正在加载动态…</div></div>
      </div>`;

    try {
      state.trend = await api('/api/trend');
      renderTrendList();
    } catch (error) {
      $('#trend-feed').innerHTML = `<div class="empty-state"><div class="empty-title">加载失败：${esc(error.message)}</div></div>`;
    }

    $('#trend-add').addEventListener('click', () => showTrendModal(null));
    $('#trend-save').addEventListener('click', saveTrend);
  }

  function renderTrendList() {
    const feedEl = $('#trend-feed');
    if (!feedEl) return;
    if (!state.trend || !state.trend.length) {
      feedEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></div>
          <div class="empty-title">还没有任何动态</div>
          <div class="empty-desc">点击右上角「发布动态」记录此刻生活与想法</div>
        </div>`;
      return;
    }

    feedEl.innerHTML = state.trend.map((item, index) => {
      const relTime = toRelativeTime(item.date);
      return `
      <div class="timeline-item">
        <div class="timeline-node"></div>
        <div class="timeline-head">
          <div class="timeline-author-meta">
            <div class="author-avatar-dot">狒</div>
            <div class="author-name">${esc(item.author || '乱与狒')}</div>
            <span class="timeline-date">${esc(item.date || '')} ${relTime ? `(${relTime})` : ''}</span>
          </div>
          <div class="row-actions">
            <button class="btn sm" data-i="${index}" data-a="up" title="上移" ${index === 0 ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>
            </button>
            <button class="btn sm" data-i="${index}" data-a="down" title="下移" ${index === state.trend.length - 1 ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <button class="btn sm" data-i="${index}" data-a="edit" title="编辑动态">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="btn sm danger" data-i="${index}" data-a="del" title="删除动态">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
            </button>
          </div>
        </div>
        <div class="timeline-body">${marked.parse(item.content || '')}</div>
        ${(item.tags || []).length ? `
          <div class="timeline-footer">
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${item.tags.map((t) => `<span class="tag-pill">#${esc(t)}</span>`).join('')}
            </div>
          </div>` : ''}
      </div>`;
    }).join('');

    $$('button[data-a]', feedEl).forEach((btn) => btn.addEventListener('click', () => {
      const i = Number(btn.dataset.i);
      const a = btn.dataset.a;
      if (a === 'up' && i > 0) {
        [state.trend[i - 1], state.trend[i]] = [state.trend[i], state.trend[i - 1]];
        renderTrendList();
      } else if (a === 'down' && i < state.trend.length - 1) {
        [state.trend[i + 1], state.trend[i]] = [state.trend[i], state.trend[i + 1]];
        renderTrendList();
      } else if (a === 'edit') {
        showTrendModal(i);
      } else if (a === 'del') {
        if (confirm('确认删除这条动态？')) {
          state.trend.splice(i, 1);
          renderTrendList();
        }
      }
    }));
  }

  function showTrendModal(index) {
    const isEdit = index !== null;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const nowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const item = isEdit ? state.trend[index] : { author: '乱与狒', date: nowStr, content: '', tags: [] };

    openModal(`
      <h2>${isEdit ? '编辑动态' : '发布新动态'}</h2>
      <div class="fm-field" style="margin-bottom:12px">
        <label>
          <span>发布时间</span>
          <span class="quick-now-btn" id="tm-now-btn">设为当前时间</span>
        </label>
        <input type="text" id="tm-date" value="${esc(item.date || nowStr)}" style="font-family:var(--font-mono)">
      </div>
      <div class="fm-field" style="margin-bottom:12px">
        <label>动态内容 (支持 Markdown 与 HTML，图片使用 /image/xxx.webp)</label>
        <textarea id="tm-content" style="min-height:160px;font-family:var(--font-mono)">${esc(item.content)}</textarea>
      </div>
      <div class="fm-field" style="margin-bottom:16px">
        <label>标签 (逗号分隔)</label>
        <input type="text" id="tm-tags" value="${esc((item.tags || []).join(', '))}" placeholder="例如：生活, 摄影">
      </div>
      <div class="modal-actions">
        <button class="btn" id="tm-cancel">取消</button>
        <button class="btn primary" id="tm-ok">${isEdit ? '保存修改' : '确认发布'}</button>
      </div>`);

    $('#tm-now-btn').addEventListener('click', () => {
      const d = new Date();
      $('#tm-date').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    });

    $('#tm-cancel').addEventListener('click', closeModal);
    $('#tm-ok').addEventListener('click', () => {
      const next = {
        author: item.author || '乱与狒',
        date: $('#tm-date').value.trim() || nowStr,
        content: $('#tm-content').value,
        tags: $('#tm-tags').value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      };
      if (isEdit) state.trend[index] = next;
      else state.trend.unshift(next);
      closeModal();
      renderTrendList();
      saveTrend();
    });
  }

  async function saveTrend() {
    try {
      state.trend = await api('/api/trend', { method: 'PUT', body: state.trend });
      renderTrendList();
      toast('✓ 动态已保存（原文件已自动备份）');
    } catch (error) { toast(error.message, true); }
  }

  // ==================== 导航链接 (link.yml & 死链检测) ====================
  async function renderLinks() {
    const container = $('#view-links');
    container.innerHTML = `
      <div class="view-head">
        <div class="view-title-group">
          <div class="view-title">导航链接管理</div>
          <div class="view-sub">source/_data/link.yml · 友情链接与常用工具</div>
        </div>
        <div class="toolbar">
          <button class="btn" id="links-check-health" title="并发检测所有外链 HTTP 连通性">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
            <span id="links-check-label">${state.isCheckingLinks ? '正在检测…' : '运行死链检测'}</span>
          </button>
          <button class="btn primary" id="links-add-group">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>新增分组</span>
          </button>
          <button class="btn" id="links-save">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path></svg>
            <span>保存全部链接</span>
          </button>
        </div>
      </div>
      <div class="links-container" id="links-list">
        <div class="empty-state"><div class="empty-title">正在加载链接…</div></div>
      </div>`;

    try {
      state.links = await api('/api/links');
      renderLinksList();
    } catch (error) {
      $('#links-list').innerHTML = `<div class="empty-state"><div class="empty-title">加载失败：${esc(error.message)}</div></div>`;
    }

    $('#links-add-group').addEventListener('click', () => {
      state.links.push({ class_name: '新分类分组', class_desc: 'Custom Group', link_list: [] });
      renderLinksList();
    });
    $('#links-save').addEventListener('click', saveLinks);

    $('#links-check-health').addEventListener('click', async () => {
      if (state.isCheckingLinks) return;
      state.isCheckingLinks = true;
      const label = $('#links-check-label');
      if (label) label.textContent = '正在检测死链…';
      toast('⏳ 正在并发探测所有友链连通性…');
      try {
        state.linkHealth = await api('/api/links/check');
        state.isCheckingLinks = false;
        if (label) label.textContent = '运行死链检测';
        toast('✓ 死链检测完成');
        renderLinksList();
      } catch (e) {
        state.isCheckingLinks = false;
        if (label) label.textContent = '运行死链检测';
        toast(e.message, true);
      }
    });
  }

  function renderLinksList() {
    const listEl = $('#links-list');
    if (!listEl) return;
    if (!state.links || !state.links.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-title">暂无链接分组</div></div>`;
      return;
    }

    listEl.innerHTML = state.links.map((group, gi) => `
      <div class="link-group-card">
        <div class="link-group-header">
          <input type="text" class="group-name-input" data-g="${gi}" data-f="class_name" value="${esc(group.class_name)}" placeholder="分组中文名">
          <input type="text" class="group-desc-input" data-g="${gi}" data-f="class_desc" value="${esc(group.class_desc)}" placeholder="英文描述 / Description">
          <div class="row-actions" style="margin-left:auto">
            <button class="btn sm" data-g="${gi}" data-a="add-link">＋ 添加链接</button>
            <button class="btn sm danger" data-g="${gi}" data-a="del-group">删除分组</button>
          </div>
        </div>
        <div class="link-rows-list">
          ${(group.link_list || []).map((link, li) => {
            const health = state.linkHealth && link.link ? state.linkHealth[link.link] : null;
            let healthHtml = '';
            if (health) {
              if (health.ok && !health.redirect) healthHtml = `<span class="link-health-pill health-ok" title="HTTP 200 正常响应">● 200 OK</span>`;
              else if (health.redirect) healthHtml = `<span class="link-health-pill health-warn" title="重定向至: ${esc(health.location || '')}">● ${health.status} 重定向</span>`;
              else healthHtml = `<span class="link-health-pill health-err" title="${esc(health.error || `HTTP ${health.status}`)}">● ${health.status || '异常'}</span>`;
            }

            return `
            <div class="link-item-row">
              <img src="${esc(link.avatar || '/favicon.ico')}" class="link-avatar-thumb" onerror="this.src='/favicon.ico'" alt="">
              <input type="text" data-g="${gi}" data-l="${li}" data-f="name" value="${esc(link.name)}" placeholder="站点名称">
              <div style="display:flex;align-items:center;gap:6px">
                <input type="text" data-g="${gi}" data-l="${li}" data-f="link" value="${esc(link.link)}" placeholder="https://… 网址" style="flex:1">
                ${healthHtml}
              </div>
              <input type="text" data-g="${gi}" data-l="${li}" data-f="avatar" value="${esc(link.avatar)}" placeholder="头像/图标URL">
              <input type="text" data-g="${gi}" data-l="${li}" data-f="descr" value="${esc(link.descr)}" placeholder="站点简短描述">
              <button class="btn sm danger" data-g="${gi}" data-l="${li}" data-a="del-link" title="删除链接">✕</button>
            </div>`;
          }).join('')}
          ${!(group.link_list || []).length ? `<button class="add-link-btn-dashed" data-g="${gi}" data-a="add-link">＋ 在此分组添加第一个链接</button>` : ''}
        </div>
      </div>`).join('');

    $$('input[data-f]', listEl).forEach((input) => input.addEventListener('change', () => {
      const gi = Number(input.dataset.g);
      const field = input.dataset.f;
      if (input.dataset.l !== undefined) {
        const li = Number(input.dataset.l);
        state.links[gi].link_list[li][field] = input.value;
      } else {
        state.links[gi][field] = input.value;
      }
    }));

    $$('button[data-a]', listEl).forEach((btn) => btn.addEventListener('click', () => {
      const gi = Number(btn.dataset.g);
      const a = btn.dataset.a;
      if (a === 'add-link') {
        state.links[gi].link_list = state.links[gi].link_list || [];
        state.links[gi].link_list.push({ name: '', link: 'https://', avatar: '', descr: '' });
        renderLinksList();
      } else if (a === 'del-group') {
        if (confirm(`确定删除分组「${state.links[gi].class_name}」及其所有链接？`)) {
          state.links.splice(gi, 1);
          renderLinksList();
        }
      } else if (a === 'del-link') {
        state.links[gi].link_list.splice(Number(btn.dataset.l), 1);
        renderLinksList();
      }
    }));
  }

  async function saveLinks() {
    try {
      state.links = await api('/api/links', { method: 'PUT', body: state.links });
      renderLinksList();
      toast('✓ 导航链接已保存');
    } catch (error) { toast(error.message, true); }
  }

  // ==================== 图片管理 (WebP 转换 & 孤儿图片清理) ====================
  async function renderImages() {
    const container = $('#view-images');
    const isOrphanTab = state.imageSubTab === 'orphans';

    container.innerHTML = `
      <div class="view-head">
        <div class="view-title-group">
          <div class="view-title">图片转换与资源治理</div>
          <div class="view-sub">source/image · source/img · 转换 WebP · 扫描清理未引用孤儿图片</div>
        </div>
        <div class="toolbar">
          ${!isOrphanTab ? `
            <button class="btn" id="img-select-all">全选待转换</button>
            <button class="btn" id="img-clear-select">清空选择</button>
            <button class="btn primary" id="img-convert">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline></svg>
              <span id="img-convert-label">一键转换 (0)</span>
            </button>` : `
            <button class="btn" id="orphan-select-all">全选孤儿图片</button>
            <button class="btn" id="orphan-refresh">重新扫描</button>
            <button class="btn danger" id="orphan-delete-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
              <span id="orphan-delete-label">一键清理选中 (0)</span>
            </button>`}
        </div>
      </div>

      <div class="subnav-tabs">
        <button class="subnav-tab ${!isOrphanTab ? 'active' : ''}" data-subtab="webp">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>待转换 WebP</span>
        </button>
        <button class="subnav-tab ${isOrphanTab ? 'active' : ''}" data-subtab="orphans">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          <span>🧹 孤儿图片清理</span>
        </button>
      </div>

      <div class="img-grid-container" id="img-grid">
        <div class="empty-state"><div class="empty-title">正在扫描本地图片…</div></div>
      </div>`;

    $$('.subnav-tab', container).forEach((btn) => btn.addEventListener('click', () => {
      state.imageSubTab = btn.dataset.subtab;
      renderImages();
    }));

    if (!isOrphanTab) {
      try {
        state.images = await api('/api/images');
        renderImageGrid();
      } catch (error) {
        $('#img-grid').innerHTML = `<div class="empty-state"><div class="empty-title">加载失败：${esc(error.message)}</div></div>`;
      }

      $('#img-select-all').addEventListener('click', () => {
        state.images.filter((i) => !i.converted).forEach((i) => state.selectedImages.add(i.name));
        renderImageGrid();
      });
      $('#img-clear-select').addEventListener('click', () => {
        state.selectedImages.clear();
        renderImageGrid();
      });
      $('#img-convert').addEventListener('click', convertSelected);
    } else {
      renderOrphanView();
    }
  }

  function renderImageGrid() {
    const grid = $('#img-grid');
    const convertBtnLabel = $('#img-convert-label');
    if (convertBtnLabel) convertBtnLabel.textContent = `一键转换 (${state.selectedImages.size})`;

    if (!state.images || !state.images.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
          <div class="empty-title">所有图片都已是 WebP 格式</div>
          <div class="empty-desc">没有需要转换的文件，站点性能表现优异</div>
        </div>`;
      return;
    }

    grid.innerHTML = state.images.map((img) => {
      const isSelected = state.selectedImages.has(img.name);
      const ext = img.name.split('.').pop().toUpperCase();
      return `
      <div class="img-item-card ${isSelected ? 'selected' : ''}" data-name="${esc(img.name)}">
        <div class="img-preview-box">
          <img src="${esc(img.url)}" loading="lazy" alt="${esc(img.name)}" class="fs-lightbox-target">
          <button class="img-zoom-btn" title="查看大图" data-src="${esc(img.url)}">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16" y2="16"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </button>
          <div class="img-select-check">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <span class="img-format-tag ${img.converted ? 'webp' : ''}">${esc(ext)}</span>
        </div>
        <div class="img-meta-info">
          <div class="img-filename" title="${esc(img.name)}">${esc(img.name)}</div>
          <div class="img-filesize">
            <span>${fmtBytes(img.size)}</span>
            <span style="color:${img.converted ? 'var(--success)' : 'var(--warning)'}">${img.converted ? '✓ 已转换' : '待转换'}</span>
          </div>
        </div>
      </div>`;
    }).join('');

    $$('.img-item-card', grid).forEach((card) => card.addEventListener('click', (e) => {
      if (e.target.closest('.img-zoom-btn')) {
        e.stopPropagation();
        const src = e.target.closest('.img-zoom-btn').dataset.src;
        Lightbox.open(src);
        return;
      }
      const name = card.dataset.name;
      const img = state.images.find((i) => i.name === name);
      if (img.converted) return;
      if (state.selectedImages.has(name)) state.selectedImages.delete(name);
      else state.selectedImages.add(name);
      renderImageGrid();
    }));
  }

  async function renderOrphanView() {
    const grid = $('#img-grid');
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-title">正在扫描全站未引用的孤儿图片…</div></div>`;
    try {
      state.orphanData = await api('/api/images/orphans');
      const data = state.orphanData;
      const delLabel = $('#orphan-delete-label');
      if (delLabel) delLabel.textContent = `一键清理选中 (${state.selectedOrphans.size})`;

      if (!data.orphans.length) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1">
            <div class="empty-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
            <div class="empty-title">全站没有孤儿废弃图片！</div>
            <div class="empty-desc">所有图片均在文章或动态中有明确引用，仓库结构非常纯净。</div>
          </div>`;
        return;
      }

      grid.innerHTML = `
        <div class="orphan-summary" style="grid-column:1/-1">
          <div>共扫描到 <b>${data.orphanCount}</b> 张未被引用的图片，累计可释放 <b>${fmtBytes(data.orphanTotalSize)}</b> 空间</div>
        </div>
        ${data.orphans.map((img) => {
          const isSelected = state.selectedOrphans.has(img.name);
          return `
          <div class="img-item-card ${isSelected ? 'selected' : ''}" data-orphan-name="${esc(img.name)}">
            <div class="img-preview-box">
              <img src="${esc(img.url)}" loading="lazy" alt="${esc(img.name)}" class="fs-lightbox-target">
              <button class="img-zoom-btn" title="查看大图" data-src="${esc(img.url)}">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16" y2="16"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </button>
              <div class="img-select-check">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <span class="img-format-tag" style="background:var(--danger-tint);color:var(--danger)">未引用</span>
            </div>
            <div class="img-meta-info">
              <div class="img-filename" title="${esc(img.name)}">${esc(img.name)}</div>
              <div class="img-filesize">
                <span>${fmtBytes(img.size)}</span>
                <span>${esc(img.dir)}</span>
              </div>
            </div>
          </div>`;
        }).join('')}
      `;

      $('#orphan-select-all').onclick = () => {
        data.orphans.forEach((o) => state.selectedOrphans.add(o.name));
        renderOrphanView();
      };

      $('#orphan-refresh').onclick = () => renderOrphanView();

      $('#orphan-delete-btn').onclick = async () => {
        if (!state.selectedOrphans.size) return toast('请先勾选要清理的孤儿图片', true);
        if (!confirm(`确定彻底删除选中的 ${state.selectedOrphans.size} 张孤儿图片？`)) return;
        try {
          const res = await api('/api/images/orphans/delete', {
            method: 'POST',
            body: { names: [...state.selectedOrphans] },
          });
          toast(`✓ 已清理 ${res.count} 张无用图片`);
          state.selectedOrphans.clear();
          renderOrphanView();
        } catch (e) { toast(e.message, true); }
      };

      $$('.img-item-card', grid).forEach((card) => card.addEventListener('click', (e) => {
        if (e.target.closest('.img-zoom-btn')) {
          e.stopPropagation();
          const src = e.target.closest('.img-zoom-btn').dataset.src;
          Lightbox.open(src);
          return;
        }
        const name = card.dataset.orphanName;
        if (state.selectedOrphans.has(name)) state.selectedOrphans.delete(name);
        else state.selectedOrphans.add(name);
        renderOrphanView();
      }));
    } catch (e) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-title">扫描失败：${esc(e.message)}</div></div>`;
    }
  }

  async function convertSelected() {
    if (!state.selectedImages.size) return toast('请先勾选需要转换的图片', true);
    if (!confirm(`确定将选中的 ${state.selectedImages.size} 张图片转换为 WebP？\n原文件将被清理，Markdown 中的引用将自动无缝替换。`)) return;

    const names = [...state.selectedImages];
    try {
      const results = await api('/api/images/convert', { method: 'POST', body: { names } });
      const saved = results.reduce((sum, r) => sum + (r.before - r.after), 0);
      state.selectedImages.clear();
      state.images = await api('/api/images');
      renderImageGrid();

      openModal(`
        <h2>⚡ WebP 转换完成</h2>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">
          共节省存储空间：<b style="color:var(--accent);font-family:var(--font-mono)">${fmtBytes(saved)}</b>
        </div>
        <div style="max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:8px">
          ${results.map((r) => `
            <div style="background:var(--surface-input);padding:10px 12px;border-radius:6px;border:1px solid var(--border);font-size:12px">
              <div style="font-weight:600;font-family:var(--font-mono)">${esc(r.name)} → ${esc(r.to)}</div>
              <div style="color:var(--text-tertiary);margin-top:2px;font-family:var(--font-mono)">
                ${fmtBytes(r.before)} → ${fmtBytes(r.after)}
                ${r.replaced.length ? ` · 已自动替换引用：${r.replaced.map(esc).join(', ')}` : ''}
              </div>
            </div>`).join('')}
        </div>
        <div class="modal-actions">
          <button class="btn primary" id="img-done">好的</button>
        </div>`);
      $('#img-done').addEventListener('click', closeModal);
      toast('✓ 图片转换已完成');
      refreshGlobalBadges();
    } catch (error) { toast(error.message, true); }
  }

  // ==================== 项目管理 (projects.yml & projects/index.md 渲染) ====================
  async function renderProjects() {
    const container = $('#view-projects');
    container.innerHTML = `
      <div class="view-head">
        <div class="view-title-group">
          <div class="view-title">精选项目管理</div>
          <div class="view-sub">source/_data/projects.yml · 独立同步渲染至前台 /projects 页面</div>
        </div>
        <div class="toolbar">
          <button class="btn" id="projects-preview-btn" title="在新标签页中查看 /projects 页面">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            <span>预览前台项目页</span>
          </button>
          <button class="btn primary" id="projects-save-btn">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            <span>保存全部更改 (⌘S)</span>
          </button>
        </div>
      </div>
      <div class="resume-editor-wrap" id="projects-editor-content">
        <div class="empty-state"><div class="empty-title">正在载入项目列表…</div></div>
      </div>`;

    try {
      state.projects = await api('/api/projects');
      renderProjectsEditor();
    } catch (e) {
      $('#projects-editor-content').innerHTML = `<div class="empty-state"><div class="empty-title">加载失败：${esc(e.message)}</div></div>`;
    }

    $('#projects-preview-btn').addEventListener('click', () => {
      window.open('http://localhost:4000/projects/', '_blank');
    });

    $('#projects-save-btn').addEventListener('click', saveProjects);
  }

  function renderProjectsEditor() {
    const wrap = $('#projects-editor-content');
    if (!wrap || !state.projects) return;

    const list = Array.isArray(state.projects.projects) ? state.projects.projects : [];

    wrap.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px">
        ${list.map((proj, pi) => {
          const isFeatured = !!proj.featured;
          const links = Array.isArray(proj.links) ? proj.links : [];
          return `
          <div class="resume-section-box project-box" data-pi="${pi}">
            <div class="resume-box-header" style="background:var(--surface)">
              <div class="resume-box-title-group" style="cursor:pointer" data-pi="${pi}" data-pa="toggle-card">
                <div class="resume-icon-circle" style="background:${isFeatured ? 'rgba(189,255,53,0.18)' : 'rgba(249,115,22,0.15)'};color:${isFeatured ? '#111412' : '#f97316'};font-weight:800;font-size:12px">
                  #${pi + 1}
                </div>
                <div style="display:flex;flex-direction:column;gap:2px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:15px;font-weight:700;color:var(--text)">${esc(proj.title || '未命名项目')}</span>
                    ${isFeatured ? `<span style="font-size:11px;font-weight:700;background:var(--accent);color:#0b0d0b;padding:1px 6px;border-radius:3px">★ 推荐精选</span>` : ''}
                  </div>
                  <div style="font-size:12px;color:var(--text-secondary);font-family:var(--font-mono)">
                    ${esc(proj.category || '未分类')} ${proj.time ? `· ${esc(proj.time)}` : ''}
                  </div>
                </div>
              </div>
              <div class="resume-box-actions">
                <button class="btn sm" data-pi="${pi}" data-pa="up" title="上移项目" ${pi === 0 ? 'disabled' : ''}>↑</button>
                <button class="btn sm" data-pi="${pi}" data-pa="down" title="下移项目" ${pi === list.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="btn sm danger" data-pi="${pi}" data-pa="del" title="删除此项目">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                </button>
                <button class="btn sm" data-pi="${pi}" data-pa="toggle-card" title="折叠/展开">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
              </div>
            </div>

            <div class="resume-box-body collapsed" id="proj-body-${pi}">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="fm-field">
                  <label>项目名称 / 标题</label>
                  <input type="text" data-pi="${pi}" data-pf="title" value="${esc(proj.title || '')}" placeholder="例如：Fee Space 博客管理控制台">
                </div>
                <div class="fm-field">
                  <label>项目分类 / 架构标签</label>
                  <input type="text" data-pi="${pi}" data-pf="category" value="${esc(proj.category || '')}" placeholder="例如：全栈工程 / 架构设计">
                </div>
                <div class="fm-field">
                  <label>起止时间</label>
                  <input type="text" data-pi="${pi}" data-pf="time" value="${esc(proj.time || '')}" placeholder="例如：2026.02 - 至今">
                </div>
                <div class="fm-field" style="display:flex;align-items:center;gap:8px;padding-top:22px">
                  <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:0;font-size:13px">
                    <input type="checkbox" data-pi="${pi}" data-pf="featured" ${isFeatured ? 'checked' : ''}>
                    <span>设为首推精选代表作（高亮边框与样式）</span>
                  </label>
                </div>
                <div class="fm-field form-full">
                  <label>核心技术栈标签 (逗号分隔)</label>
                  <input type="text" data-pi="${pi}" data-pf="tags" value="${esc((proj.tags || []).join(', '))}" placeholder="例如：Node.js, Express 5, Vanilla JS, Hexo">
                </div>
                <div class="fm-field form-full">
                  <label>项目概述 / 详细描述</label>
                  <textarea data-pi="${pi}" data-pf="desc" style="min-height:75px">${esc(proj.desc || '')}</textarea>
                </div>
                <div class="fm-field form-full">
                  <label>核心工程亮点清单 (每行一条)</label>
                  <textarea data-pi="${pi}" data-pf="highlights" style="min-height:70px" placeholder="每行输入一条亮点，例如：\n剪贴板（⌘V）与拖拽图片秒级直传\n52 周创作活动热力图与分类词云">${esc((proj.highlights || []).join('\n'))}</textarea>
                </div>
              </div>

              <!-- 链接按钮列表 -->
              <div style="margin-top:8px;padding-top:12px;border-top:1px dashed var(--border)">
                <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
                  <span>底部跳转链接与按钮</span>
                  <button class="btn sm" data-pi="${pi}" data-pa="add-link" style="font-size:11px">+ 添加链接</button>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px">
                  ${links.map((lnk, li) => `
                    <div style="display:grid;grid-template-columns:140px 1fr 140px auto;gap:8px;align-items:center;background:var(--surface-input);padding:8px;border-radius:4px;border:1px solid var(--border)">
                      <input type="text" data-pi="${pi}" data-li="${li}" data-lf="label" value="${esc(lnk.label || '')}" placeholder="按钮文字 (如 GitHub 源码 ↗)">
                      <input type="text" data-pi="${pi}" data-li="${li}" data-lf="url" value="${esc(lnk.url || '')}" placeholder="链接地址 (如 https://... 或 /about/)">
                      <input type="text" data-pi="${pi}" data-li="${li}" data-lf="icon" value="${esc(lnk.icon || '')}" placeholder="图标 (如 fab fa-github)">
                      <button class="btn sm danger" data-pi="${pi}" data-li="${li}" data-pa="del-link" title="删除链接">✕</button>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>`;
        }).join('')}

        <!-- 新增项目按钮 -->
        <button class="resume-add-section-dashed" id="btn-add-project" style="margin-top:4px">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>新增一个精选项目卡片</span>
        </button>
      </div>
    `;

    // 绑定项目表单输入事件
    $$('input[data-pf], textarea[data-pf]', wrap).forEach((el) => {
      el.addEventListener('input', () => {
        const pi = Number(el.dataset.pi);
        const f = el.dataset.pf;
        const item = state.projects.projects[pi];
        if (!item) return;

        if (f === 'tags') {
          item.tags = el.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
        } else if (f === 'highlights') {
          item.highlights = el.value.split('\n').map(s => s.trim()).filter(Boolean);
        } else if (f === 'featured') {
          item.featured = el.checked;
        } else {
          item[f] = el.value;
        }
      });
    });

    $$('input[data-pf="featured"]', wrap).forEach((el) => {
      el.addEventListener('change', () => {
        const pi = Number(el.dataset.pi);
        const item = state.projects.projects[pi];
        if (item) item.featured = el.checked;
      });
    });

    // 绑定链接输入事件
    $$('input[data-lf]', wrap).forEach((el) => {
      el.addEventListener('input', () => {
        const pi = Number(el.dataset.pi);
        const li = Number(el.dataset.li);
        const f = el.dataset.lf;
        const lnk = state.projects.projects[pi].links[li];
        if (lnk) lnk[f] = el.value;
      });
    });

    // 绑定项目操作按钮
    $$('button[data-pa]', wrap).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pi = Number(btn.dataset.pi);
        const pa = btn.dataset.pa;
        const list = state.projects.projects;

        if (pa === 'up' && pi > 0) {
          [list[pi - 1], list[pi]] = [list[pi], list[pi - 1]];
          renderProjectsEditor();
        } else if (pa === 'down' && pi < list.length - 1) {
          [list[pi + 1], list[pi]] = [list[pi], list[pi + 1]];
          renderProjectsEditor();
        } else if (pa === 'del') {
          if (confirm(`确定删除项目「${list[pi].title || '此项目'}」？`)) {
            list.splice(pi, 1);
            renderProjectsEditor();
          }
        } else if (pa === 'toggle-card') {
          $(`#proj-body-${pi}`).classList.toggle('collapsed');
        } else if (pa === 'add-link') {
          list[pi].links = list[pi].links || [];
          list[pi].links.push({ label: '新链接 ↗', url: 'https://', icon: 'fas fa-link', primary: false });
          renderProjectsEditor();
          $(`#proj-body-${pi}`).classList.remove('collapsed');
        } else if (pa === 'del-link') {
          const li = Number(btn.dataset.li);
          list[pi].links.splice(li, 1);
          renderProjectsEditor();
          $(`#proj-body-${pi}`).classList.remove('collapsed');
        }
      });
    });

    // 绑定头部点击折叠
    $$('.resume-box-title-group[data-pa="toggle-card"]', wrap).forEach((hdr) => {
      hdr.addEventListener('click', () => {
        const pi = Number(hdr.dataset.pi);
        $(`#proj-body-${pi}`).classList.toggle('collapsed');
      });
    });

    // 绑定新增项目
    $('#btn-add-project').addEventListener('click', () => {
      state.projects.projects = state.projects.projects || [];
      state.projects.projects.push({
        id: `proj-${Date.now()}`,
        title: '新建精选项目',
        category: '全栈工程 / 架构设计',
        time: '2026.01 - 至今',
        featured: false,
        desc: '在此输入项目的核心背景与架构设计概述…',
        tags: ['JavaScript', 'Node.js'],
        highlights: ['实现了核心架构与功能模块设计', '优化了系统性能与用户体验'],
        links: [
          { label: 'GitHub 源码 ↗', url: 'https://github.com/luanyufei', icon: 'fab fa-github', primary: true }
        ]
      });
      renderProjectsEditor();
      const lastBody = $(`#proj-body-${state.projects.projects.length - 1}`);
      if (lastBody) lastBody.classList.remove('collapsed');
      toast('✓ 已添加新项目卡片');
    });
  }

  async function saveProjects() {
    try {
      const res = await api('/api/projects', { method: 'PUT', body: state.projects });
      state.projects = res;
      toast('✓ 项目列表已成功保存并重新渲染至 /projects 页面！');
    } catch (e) {
      toast(e.message, true);
    }
  }

  // ==================== 简历管理 (resume.yml & about 渲染) ====================
  async function renderResume() {
    const container = $('#view-resume');
    container.innerHTML = `
      <div class="view-head">
        <div class="view-title-group">
          <div class="view-title">简历与个人档案</div>
          <div class="view-sub">source/_data/resume.yml · 实时同步渲染至 /about 个人履历页面</div>
        </div>
        <div class="toolbar">
          <button class="btn" id="resume-preview-btn" title="在新标签页中查看 /about 页面">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            <span>预览前台关于页</span>
          </button>
          <button class="btn primary" id="resume-save-btn">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            <span>保存全部更改 (⌘S)</span>
          </button>
        </div>
      </div>
      <div class="resume-editor-wrap" id="resume-editor-content">
        <div class="empty-state"><div class="empty-title">正在载入简历配置…</div></div>
      </div>`;

    try {
      state.resume = await api('/api/resume');
      renderResumeEditor();
    } catch (e) {
      $('#resume-editor-content').innerHTML = `<div class="empty-state"><div class="empty-title">加载失败：${esc(e.message)}</div></div>`;
    }

    $('#resume-preview-btn').addEventListener('click', () => {
      window.open('http://localhost:4000/about/', '_blank');
    });

    $('#resume-save-btn').addEventListener('click', saveResume);
  }

  function renderResumeEditor() {
    const wrap = $('#resume-editor-content');
    if (!wrap || !state.resume) return;

    const basic = state.resume.basic || {};
    const sections = state.resume.sections || [];

    wrap.innerHTML = `
      <!-- 基本信息 -->
      <div class="resume-section-box" id="box-basic">
        <div class="resume-box-header">
          <div class="resume-box-title-group">
            <div class="resume-icon-circle">👤</div>
            <h3 class="resume-box-title">基本信息</h3>
          </div>
          <div class="resume-box-actions">
            <button class="btn sm" id="btn-toggle-basic" title="展开/收起">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
          </div>
        </div>
        <div class="resume-box-body" id="body-basic">
          <div class="resume-item-card" style="background:var(--surface-input)">
            <div class="resume-item-header" style="cursor:default">
              <div class="resume-item-info">
                <div class="resume-item-headline">${esc(basic.name || '未填姓名')}</div>
                <div class="resume-item-subline">${esc(basic.phone || '无电话')} | ${esc(basic.email || '无邮箱')}</div>
              </div>
            </div>
            <div class="resume-item-form" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
              <div class="fm-field">
                <label>姓名</label>
                <input type="text" data-bf="name" value="${esc(basic.name || '')}" placeholder="例如：栾宇飞">
              </div>
              <div class="fm-field">
                <label>英文名 / 别名</label>
                <input type="text" data-bf="englishName" value="${esc(basic.englishName || '')}" placeholder="例如：Noon Yjufee / Alan Noon">
              </div>
              <div class="fm-field">
                <label>联系电话</label>
                <input type="text" data-bf="phone" value="${esc(basic.phone || '')}" placeholder="198...">
              </div>
              <div class="fm-field">
                <label>电子邮箱</label>
                <input type="text" data-bf="email" value="${esc(basic.email || '')}" placeholder="...@qq.com">
              </div>
              <div class="fm-field">
                <label>所在城市 / 地点</label>
                <input type="text" data-bf="location" value="${esc(basic.location || '')}" placeholder="例如：保定 / 北京">
              </div>
              <div class="fm-field">
                <label>意向职位 / 核心标签</label>
                <input type="text" data-bf="title" value="${esc(basic.title || '')}" placeholder="例如：通信工程 · 全栈开发 / 嵌入式与 AI">
              </div>
              <div class="fm-field form-full">
                <label>GitHub 用户名 (不加前缀)</label>
                <input type="text" data-bf="github" value="${esc(basic.github || '')}" placeholder="例如：luanyufei">
              </div>
              <div class="fm-field form-full">
                <label>个人概述 / 简介</label>
                <textarea data-bf="bio" style="min-height:70px">${esc(basic.bio || '')}</textarea>
              </div>
              <div class="fm-field form-full">
                <label>PDF 简历外链 (可选，留空则不显示下载按钮)</label>
                <input type="text" data-bf="pdfResumeUrl" value="${esc(basic.pdfResumeUrl || '')}" placeholder="https://... 或 /file/resume.pdf">
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 板块列表 -->
      ${sections.map((sec, si) => {
        const isSkills = sec.type === 'skills';
        return `
        <div class="resume-section-box" data-si="${si}">
          <div class="resume-box-header">
            <div class="resume-box-title-group">
              <div class="resume-icon-circle">${sec.icon || '📌'}</div>
              <h3 class="resume-box-title">
                <span class="sec-title-text">${esc(sec.title || '自定义板块')}</span>
                <button class="resume-title-edit-btn" data-si="${si}" data-sa="edit-title" title="修改板块名称与图标">✎</button>
              </h3>
            </div>
            <div class="resume-box-actions">
              <button class="btn sm" data-si="${si}" data-sa="up" title="上移板块" ${si === 0 ? 'disabled' : ''}>↑</button>
              <button class="btn sm" data-si="${si}" data-sa="down" title="下移板块" ${si === sections.length - 1 ? 'disabled' : ''}>↓</button>
              <button class="btn sm danger" data-si="${si}" data-sa="del-sec" title="删除此板块">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
              </button>
              <button class="btn sm" data-si="${si}" data-sa="toggle-sec" title="折叠/展开">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
            </div>
          </div>
          <div class="resume-box-body" id="sec-body-${si}">
            ${!isSkills ? `
              <!-- 教育 / 项目 / 自定义经历条目 -->
              ${(sec.items || []).map((item, ii) => `
                <div class="resume-item-card" data-si="${si}" data-ii="${ii}">
                  <div class="resume-item-header" data-si="${si}" data-ii="${ii}">
                    <div class="resume-item-info">
                      <div class="resume-item-headline">${esc(item.title || '未命名条目')}</div>
                      <div class="resume-item-subline">${esc(item.subtitle || '')} ${item.time ? `| ${esc(item.time)}` : ''}</div>
                    </div>
                    <div class="resume-item-actions">
                      <button class="btn sm" data-si="${si}" data-ii="${ii}" data-ia="up-item" title="上移此条目" ${ii === 0 ? 'disabled' : ''}>↑</button>
                      <button class="btn sm" data-si="${si}" data-ii="${ii}" data-ia="down-item" title="下移此条目" ${ii === (sec.items || []).length - 1 ? 'disabled' : ''}>↓</button>
                      <button class="btn sm danger" data-si="${si}" data-ii="${ii}" data-ia="del-item" title="删除此项">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                      </button>
                      <button class="btn sm" data-si="${si}" data-ii="${ii}" data-ia="toggle-item" title="展开编辑">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </button>
                    </div>
                  </div>
                  <div class="resume-item-form collapsed" id="item-form-${si}-${ii}">
                    <div class="fm-field">
                      <label>主标题 / 学校 / 项目名称</label>
                      <input type="text" data-si="${si}" data-ii="${ii}" data-if="title" value="${esc(item.title || '')}" placeholder="例如：河北大学 / 项目名称">
                    </div>
                    <div class="fm-field">
                      <label>副标题 / 学历专业 / 角色</label>
                      <input type="text" data-si="${si}" data-ii="${ii}" data-if="subtitle" value="${esc(item.subtitle || '')}" placeholder="例如：通信工程 · 学士学位">
                    </div>
                    <div class="fm-field">
                      <label>起止时间</label>
                      <input type="text" data-si="${si}" data-ii="${ii}" data-if="time" value="${esc(item.time || '')}" placeholder="例如：2022.09 - 2026.06">
                    </div>
                    <div class="fm-field">
                      <label>技术栈 / 标签 (逗号分隔)</label>
                      <input type="text" data-si="${si}" data-ii="${ii}" data-if="tags" value="${esc((item.tags || []).join(', '))}" placeholder="例如：Node.js, Express, Hexo">
                    </div>
                    <div class="fm-field form-full">
                      <label>详细描述 / 主修课程 / 核心亮点</label>
                      <textarea data-si="${si}" data-ii="${ii}" data-if="desc" style="min-height:65px">${esc(item.details || item.desc || '')}</textarea>
                    </div>
                  </div>
                </div>
              `).join('')}
              <button class="resume-add-item-btn" data-si="${si}" data-sa="add-item">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                <span>添加一段${esc(sec.title || '经历')}</span>
              </button>
            ` : `
              <!-- 专业技能组 -->
              ${(sec.items || []).map((group, gi) => `
                <div class="resume-item-card" data-si="${si}" data-gi="${gi}">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px">
                    <div class="fm-field" style="flex:1;margin:0">
                      <label style="font-size:11px">技能分类名</label>
                      <input type="text" data-si="${si}" data-gi="${gi}" data-gf="category" value="${esc(group.category || '')}" placeholder="例如：开发语言与核心">
                    </div>
                    <div style="display:flex;align-items:center;gap:4px;align-self:flex-end;margin-bottom:2px">
                      <button class="btn sm" data-si="${si}" data-gi="${gi}" data-ga="up-group" title="上移此分类" ${gi === 0 ? 'disabled' : ''}>↑</button>
                      <button class="btn sm" data-si="${si}" data-gi="${gi}" data-ga="down-group" title="下移此分类" ${gi === (sec.items || []).length - 1 ? 'disabled' : ''}>↓</button>
                      <button class="btn sm danger" data-si="${si}" data-gi="${gi}" data-ga="del-group" title="删除此组">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                      </button>
                    </div>
                  </div>
                  <div class="fm-field">
                    <label style="font-size:11px">包含技能 (逗号分隔)</label>
                    <input type="text" data-si="${si}" data-gi="${gi}" data-gf="list" value="${esc((group.list || []).join(', '))}" placeholder="例如：C / C++, JavaScript, Python">
                  </div>
                </div>
              `).join('')}
              <button class="resume-add-item-btn" data-si="${si}" data-sa="add-skill-group">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                <span>添加技能分类组</span>
              </button>
            `}
          </div>
        </div>`;
      }).join('')}

      <!-- 新增自定义板块按钮 -->
      <button class="resume-add-section-dashed" id="btn-add-section">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        <span>新增自定义板块（如：工作/实习经历、荣誉奖项、个人作品等）</span>
      </button>
    `;

    // 绑定基本信息输入事件
    $$('input[data-bf], textarea[data-bf]', wrap).forEach((el) => {
      el.addEventListener('input', () => {
        const f = el.dataset.bf;
        state.resume.basic = state.resume.basic || {};
        state.resume.basic[f] = el.value;
      });
    });

    // 绑定基本信息收缩
    $('#btn-toggle-basic').addEventListener('click', () => {
      $('#body-basic').classList.toggle('collapsed');
    });

    // 绑定条目输入事件
    $$('input[data-if], textarea[data-if]', wrap).forEach((el) => {
      el.addEventListener('input', () => {
        const si = Number(el.dataset.si);
        const ii = Number(el.dataset.ii);
        const f = el.dataset.if;
        const item = state.resume.sections[si].items[ii];
        if (f === 'tags') {
          item.tags = el.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
        } else if (f === 'desc') {
          item.desc = el.value;
          item.details = el.value;
        } else {
          item[f] = el.value;
        }
      });
    });

    // 绑定技能分类输入事件
    $$('input[data-gf]', wrap).forEach((el) => {
      el.addEventListener('input', () => {
        const si = Number(el.dataset.si);
        const gi = Number(el.dataset.gi);
        const f = el.dataset.gf;
        const grp = state.resume.sections[si].items[gi];
        if (f === 'list') {
          grp.list = el.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
        } else {
          grp.category = el.value;
        }
      });
    });

    // 绑定板块操作
    $$('button[data-sa]', wrap).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const si = Number(btn.dataset.si);
        const sa = btn.dataset.sa;
        const sec = state.resume.sections[si];

        if (sa === 'up' && si > 0) {
          [state.resume.sections[si - 1], state.resume.sections[si]] = [state.resume.sections[si], state.resume.sections[si - 1]];
          renderResumeEditor();
        } else if (sa === 'down' && si < state.resume.sections.length - 1) {
          [state.resume.sections[si + 1], state.resume.sections[si]] = [state.resume.sections[si], state.resume.sections[si + 1]];
          renderResumeEditor();
        } else if (sa === 'del-sec') {
          if (confirm(`确定删除板块「${sec.title}」及其全部内容？`)) {
            state.resume.sections.splice(si, 1);
            renderResumeEditor();
          }
        } else if (sa === 'toggle-sec') {
          $(`#sec-body-${si}`).classList.toggle('collapsed');
        } else if (sa === 'edit-title') {
          const newTitle = prompt('请输入新的板块标题：', sec.title || '');
          if (newTitle && newTitle.trim()) {
            sec.title = newTitle.trim();
            const newIcon = prompt('请输入板块图标 Emoji（如 🎓, 💼, ⚡, 🏢, 🏆, 📜）：', sec.icon || '📌');
            if (newIcon && newIcon.trim()) sec.icon = newIcon.trim();
            renderResumeEditor();
          }
        } else if (sa === 'add-item') {
          sec.items = sec.items || [];
          sec.items.push({
            title: `新${sec.title.slice(0, 2)}名称`,
            subtitle: '',
            time: '2026.01 - 至今',
            tags: [],
            desc: '',
          });
          renderResumeEditor();
          const newForm = $(`#item-form-${si}-${sec.items.length - 1}`);
          if (newForm) newForm.classList.remove('collapsed');
        } else if (sa === 'add-skill-group') {
          sec.items = sec.items || [];
          sec.items.push({ category: '新建技能分类', list: [] });
          renderResumeEditor();
        }
      });
    });

    // 绑定条目操作（排序、删除与展开）
    $$('button[data-ia]', wrap).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const si = Number(btn.dataset.si);
        const ii = Number(btn.dataset.ii);
        const ia = btn.dataset.ia;
        const items = state.resume.sections[si].items;

        if (ia === 'up-item' && ii > 0) {
          [items[ii - 1], items[ii]] = [items[ii], items[ii - 1]];
          renderResumeEditor();
        } else if (ia === 'down-item' && ii < items.length - 1) {
          [items[ii + 1], items[ii]] = [items[ii], items[ii + 1]];
          renderResumeEditor();
        } else if (ia === 'del-item') {
          if (confirm('确定删除此经历条目？')) {
            items.splice(ii, 1);
            renderResumeEditor();
          }
        } else if (ia === 'toggle-item') {
          $(`#item-form-${si}-${ii}`).classList.toggle('collapsed');
        }
      });
    });

    // 绑定条目头部点击展开
    $$('.resume-item-header', wrap).forEach((hdr) => {
      hdr.addEventListener('click', (e) => {
        if (e.target.closest('.resume-item-actions')) return;
        const si = Number(hdr.dataset.si);
        const ii = Number(hdr.dataset.ii);
        $(`#item-form-${si}-${ii}`).classList.toggle('collapsed');
      });
    });

    // 绑定技能组排序与删除
    $$('button[data-ga]', wrap).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const si = Number(btn.dataset.si);
        const gi = Number(btn.dataset.gi);
        const ga = btn.dataset.ga;
        const items = state.resume.sections[si].items;
        if (ga === 'up-group' && gi > 0) {
          [items[gi - 1], items[gi]] = [items[gi], items[gi - 1]];
          renderResumeEditor();
        } else if (ga === 'down-group' && gi < items.length - 1) {
          [items[gi + 1], items[gi]] = [items[gi], items[gi + 1]];
          renderResumeEditor();
        } else if (ga === 'del-group') {
          if (confirm('确定删除此技能分类？')) {
            items.splice(gi, 1);
            renderResumeEditor();
          }
        }
      });
    });

    // 绑定新增自定义板块
    $('#btn-add-section').addEventListener('click', () => {
      openModal(`
        <h2>新增自定义板块</h2>
        <div class="fm-field" style="margin-bottom:12px">
          <label>板块标题 (例如：工作实习经历、荣誉与奖项)</label>
          <input type="text" id="nsec-title" placeholder="输入板块名称…" autofocus>
        </div>
        <div class="fm-field" style="margin-bottom:12px">
          <label>板块图标 Emoji</label>
          <input type="text" id="nsec-icon" value="🏢" placeholder="例如：🏢, 🏆, 📜, 🌟, 💡">
        </div>
        <div class="fm-field" style="margin-bottom:16px">
          <label>板块呈现类型</label>
          <select id="nsec-type" style="width:100%;height:36px;background:var(--surface-input);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:0 8px">
            <option value="custom">时间轴 / 经历卡片列表 (类似项目/教育)</option>
            <option value="skills">技能分类标签组</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn" id="nsec-cancel">取消</button>
          <button class="btn primary" id="nsec-create">立即添加</button>
        </div>
      `);

      $('#nsec-cancel').addEventListener('click', closeModal);
      $('#nsec-create').addEventListener('click', () => {
        const title = $('#nsec-title').value.trim();
        if (!title) return toast('请输入板块标题', true);
        const icon = $('#nsec-icon').value.trim() || '📌';
        const type = $('#nsec-type').value;

        state.resume.sections.push({
          id: `sec_${Date.now()}`,
          type,
          title,
          icon,
          items: type === 'skills' ? [{ category: '分类名', list: [] }] : [{ title: `第一条${title}`, subtitle: '', time: '', desc: '' }],
        });

        closeModal();
        renderResumeEditor();
        toast(`✓ 已添加「${title}」板块`);
      });
    });
  }

  async function saveResume() {
    try {
      const res = await api('/api/resume', { method: 'PUT', body: state.resume });
      state.resume = res;
      toast('✓ 简历已成功保存并重新渲染至关于页！');
    } catch (e) {
      toast(e.message, true);
    }
  }

  // ==================== 构建与部署 ====================
  function renderDeploy() {
    const container = $('#view-deploy');
    container.innerHTML = `
      <div class="view-head">
        <div class="view-title-group">
          <div class="view-title">构建与部署</div>
          <div class="view-sub">Git · Hexo 本地预览 · Vercel 自动部署 · GitHub Pages</div>
        </div>
        <div class="toolbar">
          <button class="btn" id="dep-server-btn">
            <span class="server-status-dot ${state.previewRunning ? 'running' : ''}" id="dep-server-dot"></span>
            <span id="dep-server-text">${state.previewRunning ? '停止本地预览' : '启动本地预览'}</span>
          </button>
          <button class="btn" id="dep-build-btn">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
            <span>重新构建 (Clean &amp; Build)</span>
          </button>
        </div>
      </div>

      <div class="deploy-grid">
        <div class="deploy-action-box">
          <div class="deploy-box-title">
            <span>Git 工作区状态</span>
            <button class="btn sm" id="dep-refresh-git">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
              <span>刷新</span>
            </button>
          </div>
          <div class="git-status-pane" id="git-lines">正在检查 Git 状态…</div>
          <div class="fm-field">
            <label>Commit 提交信息 (可选)</label>
            <input type="text" id="commit-msg" placeholder="留空使用默认：update: YYYY-MM-DD HH:mm" style="font-family:var(--font-mono)">
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:auto">
            <button class="btn primary" id="dep-all" style="width:100%;font-size:13.5px;font-weight:700;padding:10px 16px;display:flex;align-items:center;justify-content:center;gap:8px">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 2 22 22 22"></polygon></svg>
              <span>一键全平台部署 (Vercel &amp; GitHub Pages)</span>
            </button>
            <div style="font-size:11.5px;color:var(--text-tertiary);text-align:center;line-height:1.4">
              推送源码至 main（触发 Vercel 自动构建）+ 同步发布至 GitHub Pages
            </div>
          </div>
        </div>

        <!-- 终端窗口 -->
        <div class="terminal-window">
          <div class="terminal-header">
            <div class="terminal-dots">
              <div class="terminal-dot dot-red"></div>
              <div class="terminal-dot dot-yellow"></div>
              <div class="terminal-dot dot-green"></div>
            </div>
            <div class="terminal-title">TERMINAL · SSE LIVE STREAM</div>
            <button class="btn sm" id="dep-clear-log">清空日志</button>
          </div>
          <div class="terminal-body" id="console"></div>
        </div>
      </div>`;

    $('#dep-refresh-git').addEventListener('click', loadGitStatus);
    $('#dep-clear-log').addEventListener('click', () => { $('#console').innerHTML = ''; });
    $('#dep-server-btn').addEventListener('click', toggleServer);
    $('#dep-build-btn').addEventListener('click', () => runOp('/api/build', '构建'));
    $('#dep-all').addEventListener('click', () => {
      if (!confirm('确认一键部署到全平台？\n将自动提交并推送至 GitHub main 分支（触发 Vercel 自动构建发布），并同时执行 Hexo 静态生成与部署至 GitHub Pages。')) return;
      runOp('/api/deploy/all', '一键全平台部署', { message: $('#commit-msg').value });
    });

    loadGitStatus();
    loadServerState();
    connectLogs();
  }

  async function loadGitStatus() {
    try {
      const status = await api('/api/git/status');
      const el = $('#git-lines');
      if (el) el.textContent = status.lines.join('\n');
      const ind = $('#indicator-git');
      if (ind) ind.classList.toggle('has-changes', status.lines.length > 0);
    } catch (error) {
      const el = $('#git-lines');
      if (el) el.textContent = error.message;
    }
  }

  async function loadServerState() {
    try {
      const s = await api('/api/server/state');
      state.previewRunning = s.running;
      updateServerUI();
    } catch (error) {}
  }

  function updateServerUI() {
    const isStarting = !!state.previewStarting;
    const isRunning = !!state.previewRunning;

    const sideDot = $('#server-dot');
    const sideLabel = $('#server-status-label');
    const sideBtn = $('#sidebar-server-toggle');

    if (sideDot) {
      sideDot.className = isRunning
        ? 'server-status-dot running'
        : (isStarting ? 'server-status-dot starting' : 'server-status-dot');
    }
    if (sideLabel) {
      sideLabel.textContent = isRunning
        ? '本地预览：运行中'
        : (isStarting ? '本地预览：启动中…' : '本地预览：未启动');
    }
    if (sideBtn) {
      sideBtn.textContent = isRunning ? '停止' : (isStarting ? '启动中…' : '启动');
      sideBtn.disabled = isStarting;
    }

    const depDot = $('#dep-server-dot');
    const depText = $('#dep-server-text');
    const depBtn = $('#dep-server-btn');

    if (depDot) {
      depDot.className = isRunning
        ? 'server-status-dot running'
        : (isStarting ? 'server-status-dot starting' : 'server-status-dot');
    }
    if (depText) {
      depText.textContent = isRunning
        ? '停止本地预览'
        : (isStarting ? '本地预览启动中…' : '启动本地预览');
    }
    if (depBtn) depBtn.disabled = isStarting;
  }

  async function toggleServer() {
    if (state.previewStarting) return;
    try {
      if (state.previewRunning) {
        await api('/api/server/stop', { method: 'POST' });
        state.previewRunning = false;
        state.previewStarting = false;
        toast('本地预览已停止');
        updateServerUI();
      } else {
        state.previewStarting = true;
        updateServerUI();
        toast('⏳ 本地预览启动中，服务就绪后将自动打开…');

        let previewTab = null;
        try {
          previewTab = window.open('about:blank', '_blank');
          if (previewTab) {
            previewTab.document.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Fee Space - 本地预览启动中...</title>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                    body {
                      background: #0b0d0c;
                      color: #f0f4f1;
                      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      height: 100vh;
                      margin: 0;
                      background-image: 
                        linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
                      background-size: 48px 48px;
                    }
                    .card {
                      text-align: center;
                      background: #151917;
                      padding: 36px 44px;
                      border-radius: 16px;
                      border: 1px solid rgba(255, 255, 255, 0.08);
                      box-shadow: 0 16px 40px rgba(0,0,0,0.6);
                      max-width: 380px;
                    }
                    .spinner {
                      width: 36px;
                      height: 36px;
                      border: 3px solid rgba(189, 255, 53, 0.15);
                      border-top-color: #bdff35;
                      border-radius: 50%;
                      animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                      margin: 0 auto 20px;
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    h2 { font-size: 16px; margin: 0 0 8px; font-weight: 600; letter-spacing: -0.01em; }
                    p { font-size: 13px; color: #8a968f; margin: 0; line-height: 1.6; }
                  </style>
                </head>
                <body>
                  <div class="card">
                    <div class="spinner"></div>
                    <h2>Fee Space 正在生成并启动…</h2>
                    <p>服务就绪后将自动载入页面<br><code style="color:#bdff35;font-family:monospace">http://localhost:4000</code></p>
                  </div>
                </body>
              </html>
            `);
          }
        } catch (e) {}

        await api('/api/server/start', { method: 'POST' });

        const waitRes = await api('/api/server/wait');
        state.previewStarting = false;

        if (waitRes && waitRes.ready) {
          state.previewRunning = true;
          updateServerUI();
          toast('✓ 本地预览已就绪，已为您打开页面');

          if (previewTab && !previewTab.closed) {
            previewTab.location.href = 'http://localhost:4000';
          } else {
            window.open('http://localhost:4000', '_blank');
          }
        } else {
          state.previewRunning = false;
          updateServerUI();
          toast('⚠️ 本地预览服务启动超时，请在部署日志中查看详情', true);
        }
      }
    } catch (error) {
      state.previewStarting = false;
      updateServerUI();
      toast(error.message, true);
    }
  }

  const sidebarServerToggle = $('#sidebar-server-toggle');
  if (sidebarServerToggle) sidebarServerToggle.addEventListener('click', toggleServer);

  async function runOp(path, label, body) {
    const btn = document.activeElement;
    if (btn && btn.disabled !== undefined) btn.disabled = true;
    try {
      await api(path, { method: 'POST', body });
      toast(`✓ ${label}完成`);
      loadGitStatus();
    } catch (error) {
      toast(error.message, true);
    } finally {
      if (btn && btn.disabled !== undefined) btn.disabled = false;
    }
  }

  let logSource = null;
  function connectLogs() {
    if (logSource) { logSource.close(); logSource = null; }
    setTimeout(() => {
      if (state.view !== 'deploy') return;
      try {
        logSource = new EventSource('/api/logs');
        logSource.onmessage = (event) => {
          try {
            const entry = JSON.parse(event.data);
            const consoleEl = $('#console');
            if (!consoleEl) return;
            const line = document.createElement('div');
            line.className = `c-${entry.kind}`;
            line.textContent = `[${new Date().toLocaleTimeString()}] ${entry.text}`;
            consoleEl.appendChild(line);
            while (consoleEl.childNodes.length > 600) consoleEl.removeChild(consoleEl.firstChild);
            consoleEl.scrollTop = consoleEl.scrollHeight;
          } catch (error) {}
        };
      } catch (e) {}
    }, 1200);
  }

  // 侧边栏导航点击
  $$('.nav-item').forEach((btn) => btn.addEventListener('click', () => {
    state.editing = null;
    if (state.view !== 'deploy' && logSource) { logSource.close(); logSource = null; }
    switchView(btn.dataset.view);
  }));

  // 退出面板
  const quitBtn = $('#btn-quit');
  if (quitBtn) quitBtn.addEventListener('click', async () => {
    if (!confirm('确认退出 Fee Admin 面板？\n管理后台服务与本地预览将会安全关闭。再次启动请双击「Fee Admin」应用图标。')) return;
    try {
      await api('/api/quit', { method: 'POST' });
      document.body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0b0d0c;color:#9aa59e;gap:12px">
          <div style="font-size:24px;font-weight:700;color:#f0f4f1">Fee Admin 已安全退出</div>
          <div style="font-size:13px">后台服务已停止，您可以关闭此浏览器标签页。</div>
        </div>`;
    } catch (error) {
      toast('服务已关闭', true);
    }
  });

  // 全局快捷键
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      const saveBtn = $('#ed-save') || $('#trend-save') || $('#links-save') || $('#projects-save-btn') || $('#resume-save-btn');
      if (saveBtn) saveBtn.click();
    }
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      const search = $('#post-search');
      if (search) search.focus();
    }
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  // ==================== Fee Space 专属图片查看器 (Lightbox) ====================
  const Lightbox = (() => {
    let overlay = null;
    let viewImg = null;
    let state = null;
    let activePointerId = null;

    const applyTransform = (withTransition = false) => {
      if (!viewImg || !state) return;
      if (withTransition) {
        viewImg.style.transition = 'transform 0.32s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      } else {
        viewImg.style.transition = 'none';
      }
      viewImg.style.transform = `translate3d(${state.x}px, ${state.y}px, 0px) rotate(${state.r}deg) scale(${state.s})`;
    };

    const open = (src, alt = '') => {
      if (overlay || !src || src.startsWith('data:')) return;

      state = { x: 0, y: 0, r: 0, s: 0.6 };

      overlay = document.createElement('div');
      overlay.className = 'fs-custom-lightbox';

      viewImg = document.createElement('img');
      viewImg.className = 'fs-custom-lightbox-img';
      viewImg.src = src;
      viewImg.alt = alt;
      viewImg.draggable = false;

      const hint = document.createElement('div');
      hint.className = 'fs-lightbox-hint';
      hint.innerHTML = '<span>左键拖拽平移</span><span>•</span><span>中键旋转</span><span>•</span><span>滚轮缩放</span><span>•</span><span>单击/右键/ESC退出</span>';

      overlay.appendChild(viewImg);
      overlay.appendChild(hint);
      document.body.appendChild(overlay);
      document.body.classList.add('fs-lightbox-active');

      applyTransform(false);
      void overlay.offsetWidth;

      requestAnimationFrame(() => {
        overlay.classList.add('is-open');
        state.s = 1.0;
        applyTransform(true);
      });

      setTimeout(() => {
        if (viewImg) viewImg.style.transition = 'none';
      }, 330);

      overlay.addEventListener('contextmenu', handleContextMenu);
      overlay.addEventListener('auxclick', handleAuxClick);
      overlay.addEventListener('pointerdown', handlePointerDown);
      overlay.addEventListener('pointermove', handlePointerMove);
      overlay.addEventListener('pointerup', handlePointerUp);
      overlay.addEventListener('pointercancel', handlePointerUp);
      overlay.addEventListener('touchstart', handleTouchStart, { passive: false });
      overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
      overlay.addEventListener('touchend', handleTouchEnd, { passive: false });
      overlay.addEventListener('touchcancel', handleTouchEnd, { passive: false });
      overlay.addEventListener('wheel', handleWheel, { passive: false });
      document.addEventListener('keydown', handleKeyDown);
    };

    const close = () => {
      if (!overlay) return;
      document.body.classList.remove('fs-lightbox-dragging');
      const currentOverlay = overlay;
      const currentImg = viewImg;
      overlay = null;
      viewImg = null;
      state = null;

      currentOverlay.classList.remove('is-open');
      currentOverlay.classList.add('is-closing');

      if (currentImg) {
        currentImg.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease';
        currentImg.style.transform = `translate3d(0px, 0px, 0px) rotate(0deg) scale(0.6)`;
        currentImg.style.opacity = '0';
      }

      document.removeEventListener('keydown', handleKeyDown);

      setTimeout(() => {
        currentOverlay.remove();
        document.body.classList.remove('fs-lightbox-active');
      }, 260);
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
      close();
    };

    const handleAuxClick = (e) => {
      if (e.button === 1 || e.button === 2) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };

    let isPointerDown = false;
    let dragButton = -1;
    let startX = 0;
    let startY = 0;
    let startStateX = 0;
    let startStateY = 0;
    let startStateR = 0;
    let startStateS = 0;
    let startAngle = 0;
    let movedDistance = 0;

    let initialTouchDist = 0;
    let initialTouchAngle = 0;
    let initialTouchStateS = 1;
    let initialTouchStateR = 0;
    let initialTouchStateX = 0;
    let initialTouchStateY = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let isTouchActive = false;
    let isMultiTouch = false;

    const getTouchDist = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const getTouchAngle = (t1, t2) => Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);

    const handleTouchStart = (e) => {
      if (!state) return;
      if (e.touches.length === 1) {
        isTouchActive = true;
        isMultiTouch = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        initialTouchStateX = state.x;
        initialTouchStateY = state.y;
        movedDistance = 0;
      } else if (e.touches.length === 2) {
        isTouchActive = true;
        isMultiTouch = true;
        initialTouchDist = getTouchDist(e.touches[0], e.touches[1]);
        initialTouchAngle = getTouchAngle(e.touches[0], e.touches[1]);
        initialTouchStateS = state.s;
        initialTouchStateR = state.r;
        initialTouchStateX = state.x;
        initialTouchStateY = state.y;
        touchStartX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        touchStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    };

    const handleTouchMove = (e) => {
      if (!isTouchActive || !state) return;
      e.preventDefault();

      if (e.touches.length === 1 && !isMultiTouch) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        movedDistance += Math.hypot(dx, dy);
        state.x = initialTouchStateX + dx;
        state.y = initialTouchStateY + dy;
        applyTransform(false);
      } else if (e.touches.length === 2) {
        const currentDist = getTouchDist(e.touches[0], e.touches[1]);
        const currentAngle = getTouchAngle(e.touches[0], e.touches[1]);
        const currentMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const currentMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        if (initialTouchDist > 0) {
          const scaleRatio = currentDist / initialTouchDist;
          state.s = Math.max(0.1, Math.min(20, initialTouchStateS * scaleRatio));
        }

        const deltaAngle = currentAngle - initialTouchAngle;
        const rawR = initialTouchStateR + deltaAngle;
        const snapTarget = Math.round(rawR / 90) * 90;
        if (Math.abs(rawR - snapTarget) < 4.5) {
          state.r = snapTarget;
        } else {
          state.r = rawR;
        }

        state.x = initialTouchStateX + (currentMidX - touchStartX);
        state.y = initialTouchStateY + (currentMidY - touchStartY);
        applyTransform(false);
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length === 0) {
        if (!isMultiTouch && movedDistance < 5 && e.target === overlay) {
          close();
        }
        isTouchActive = false;
        isMultiTouch = false;
      } else if (e.touches.length === 1) {
        isMultiTouch = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        initialTouchStateX = state.x;
        initialTouchStateY = state.y;
      }
    };

    const handlePointerDown = (e) => {
      if (e.pointerType === 'touch') return;
      if (!state || isPointerDown) return;
      if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;

      if (e.button === 2) {
        e.preventDefault();
        close();
        return;
      }

      e.preventDefault();
      isPointerDown = true;
      dragButton = e.button;
      activePointerId = e.pointerId;
      try { overlay.setPointerCapture(e.pointerId); } catch (err) {}

      document.body.classList.add('fs-lightbox-dragging');
      if (overlay) overlay.classList.add('is-dragging');

      startX = e.clientX;
      startY = e.clientY;
      startStateX = state.x;
      startStateY = state.y;
      startStateR = state.r;
      startStateS = state.s;
      movedDistance = 0;

      const rect = overlay.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

      if (viewImg) {
        viewImg.style.transition = 'none';
        viewImg.classList.add('is-dragging');
      }
    };

    const handlePointerMove = (e) => {
      if (e.pointerType === 'touch') return;
      if (!isPointerDown || !state) return;
      e.preventDefault();

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      movedDistance += Math.hypot(dx, dy);

      if (dragButton === 0) {
        state.x = startStateX + dx;
        state.y = startStateY + dy;
        applyTransform(false);
      } else if (dragButton === 1) {
        const rect = overlay.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

        const rawR = startStateR + (currentAngle - startAngle);
        const snapTarget = Math.round(rawR / 90) * 90;
        if (Math.abs(rawR - snapTarget) < 4.5) {
          state.r = snapTarget;
        } else {
          state.r = rawR;
        }
        applyTransform(false);
      }
    };

    const handlePointerUp = (e) => {
      if (e.pointerType === 'touch') return;
      if (!isPointerDown) return;

      document.body.classList.remove('fs-lightbox-dragging');
      if (overlay) overlay.classList.remove('is-dragging');

      if (activePointerId !== null && overlay && overlay.hasPointerCapture && overlay.hasPointerCapture(activePointerId)) {
        try { overlay.releasePointerCapture(activePointerId); } catch (err) {}
      }

      if (viewImg) viewImg.classList.remove('is-dragging');

      if (dragButton === 0 && movedDistance < 5 && (e.target === overlay || e.target === viewImg)) {
        close();
      }

      isPointerDown = false;
      dragButton = -1;
      activePointerId = null;
    };

    const handleWheel = (e) => {
      if (!state) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.85;
      state.s = Math.max(0.1, Math.min(20, state.s * factor));
      applyTransform(false);
    };

    // 全局事件委托：单击任何内容图片即可打开图片查看器
    document.addEventListener('click', (e) => {
      const img = e.target.closest('.markdown-preview img, .timeline-body img, .img-preview-box img, .link-avatar-thumb, img.fs-lightbox-target');
      if (img && !img.classList.contains('no-lightbox') && !e.target.closest('.img-zoom-btn')) {
        if (e.target.closest('.img-select-check')) return;
        e.preventDefault();
        e.stopPropagation();
        open(img.src, img.alt || '');
      }
    });

    return { open, close };
  })();

  // ==================== 主题切换 (复用 Fee Space 逻辑) ====================
  const THEME_KEY = 'theme';

  const normalizeThemeMode = (value) =>
    value === 'light' || value === 'dark' || value === 'system' ? value : undefined;

  const readThemeMode = () => {
    try {
      const raw = sessionStorage.getItem(THEME_KEY);
      if (!raw) return 'system';
      try {
        const parsed = JSON.parse(raw);
        return normalizeThemeMode(parsed.value) || 'system';
      } catch (error) {
        return normalizeThemeMode(raw) || 'system';
      }
    } catch (error) {
      return 'system';
    }
  };

  const saveThemeMode = (mode) => {
    try {
      localStorage.removeItem(THEME_KEY);
      sessionStorage.setItem(THEME_KEY, JSON.stringify({ value: mode }));
    } catch (error) {}
  };

  const getSystemTheme = () =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  const resolveTheme = (mode) => {
    if (mode === 'light') return 'light';
    if (mode === 'dark') return 'dark';
    return getSystemTheme();
  };

  const syncThemeColor = (actualTheme) => {
    let meta = $('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', actualTheme === 'dark' ? '#0f1111' : '#f3f6f2');
  };

  const THEME_ICONS = {
    system: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`,
    light: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
    dark: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
  };

  const updateThemeButton = (mode, actualTheme) => {
    const btn = $('#theme-toggle');
    const iconEl = $('#theme-icon');
    const labelEl = $('#theme-label');
    if (!btn) return;

    let label = '跟随系统';
    let nextLabel = '浅色';

    if (mode === 'light') {
      label = '浅色模式';
      nextLabel = '深色';
    } else if (mode === 'dark') {
      label = '深色模式';
      nextLabel = '跟随系统';
    } else {
      label = `跟随系统 (${actualTheme === 'dark' ? '深色' : '浅色'})`;
      nextLabel = '浅色';
    }

    btn.dataset.themeMode = mode;
    btn.dataset.theme = actualTheme;
    btn.setAttribute('aria-label', `当前外观：${label}，点击切换为${nextLabel}模式`);
    btn.setAttribute('title', `外观：${label} (点击切换为${nextLabel})`);

    if (iconEl) iconEl.innerHTML = THEME_ICONS[mode] || THEME_ICONS.system;
    if (labelEl) labelEl.textContent = label;
  };

  const applyThemeMode = (mode, persist = false) => {
    const validMode = normalizeThemeMode(mode) || 'system';
    const actualTheme = resolveTheme(validMode);

    document.documentElement.dataset.theme = actualTheme;
    document.documentElement.dataset.themeMode = validMode;

    if (persist) saveThemeMode(validMode);
    syncThemeColor(actualTheme);
    updateThemeButton(validMode, actualTheme);
  };

  const getNextThemeMode = (currentMode) => {
    if (currentMode === 'system') return 'light';
    if (currentMode === 'light') return 'dark';
    return 'system';
  };

  let currentThemeMode = readThemeMode();
  const initTheme = () => {
    applyThemeMode(currentThemeMode);

    const btn = $('#theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        currentThemeMode = getNextThemeMode(currentThemeMode);
        applyThemeMode(currentThemeMode, true);
        toast(`外观已切换为：${currentThemeMode === 'system' ? '跟随系统' : (currentThemeMode === 'light' ? '浅色模式' : '深色模式')}`);
      });
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentThemeMode === 'system') {
        applyThemeMode('system');
      }
    });
  };

  // Hash 路由初始化
  function handleHashRoute() {
    const hash = window.location.hash.slice(1) || 'posts';
    if (hash.startsWith('editor')) {
      const params = new URLSearchParams(hash.slice(7));
      const filename = params.get('filename');
      const type = params.get('type') || 'post';
      if (filename) {
        state.editing = { filename, type };
        switchView('posts', false);
        return;
      }
    }
    state.editing = null;
    const validViews = ['posts', 'trend', 'links', 'images', 'projects', 'resume', 'deploy'];
    const target = validViews.includes(hash) ? hash : 'posts';
    switchView(target, false);
  }

  window.addEventListener('hashchange', handleHashRoute);

  marked.setOptions({ breaks: true, gfm: true });
  initTheme();
  handleHashRoute();
  loadServerState();
})();
