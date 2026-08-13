(() => {
  const state = {
    view: 'posts',
    postTab: 'published',
    search: '',
    editing: null,
    trend: null,
    links: null,
    images: null,
    selectedImages: new Set(),
    previewRunning: false,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const fmtBytes = (n) => {
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1048576).toFixed(1)} MB`;
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
    el.textContent = msg;
    el.className = isErr ? 'show err' : 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ''; }, 2600);
  }

  function openModal(html) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-backdrop">${html}</div>`;
    return root;
  }
  function closeModal() { $('#modal-root').innerHTML = ''; }

  function switchView(name) {
    state.view = name;
    $$('.nav-item').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === name));
    $$('.view').forEach((v) => v.classList.toggle('hidden', v.id !== `view-${name}`));
    if (name === 'posts') renderPosts();
    if (name === 'trend') renderTrend();
    if (name === 'links') renderLinks();
    if (name === 'images') renderImages();
    if (name === 'deploy') renderDeploy();
  }

  function renderPosts() {
    if (state.editing) { renderEditor(); return; }
    const container = $('#view-posts');
    container.innerHTML = `
      <div class="view-head">
        <div>
          <div class="view-title">文章管理</div>
          <div class="view-sub">source/_posts · source/_drafts</div>
        </div>
        <div class="toolbar">
          <input type="text" id="post-search" placeholder="搜索标题 / 标签 / 分类…" style="width:200px">
          <button class="btn primary" id="btn-new-post">＋ 新建文章</button>
        </div>
      </div>
      <div class="tabs" style="margin-bottom:16px">
        <button class="tab ${state.postTab === 'published' ? 'active' : ''}" data-tab="published">已发布</button>
        <button class="tab ${state.postTab === 'draft' ? 'active' : ''}" data-tab="draft">草稿</button>
      </div>
      <div class="list" id="post-list"></div>`;
    $('#post-search').value = state.search;
    $('#post-search').addEventListener('input', (e) => { state.search = e.target.value; loadPostList(); });
    $('#btn-new-post').addEventListener('click', showNewPostModal);
    $$('.tab', container).forEach((tab) => tab.addEventListener('click', () => {
      state.postTab = tab.dataset.tab;
      state.editing = null;
      renderPosts();
    }));
    loadPostList();
  }

  async function loadPostList() {
    const listEl = $('#post-list');
    if (!listEl) return;
    try {
      const url = state.postTab === 'draft' ? '/api/drafts' : '/api/posts';
      const items = await api(url);
      const q = state.search.trim().toLowerCase();
      const filtered = q ? items.filter((p) =>
        [p.title, ...(p.tags || []), ...(Array.isArray(p.categories) ? p.categories : [p.categories])]
          .filter(Boolean).join(' ').toLowerCase().includes(q)
      ) : items;
      if (!filtered.length) {
        listEl.innerHTML = `<div class="empty">${state.postTab === 'draft' ? '没有草稿' : '没有文章'}</div>`;
        return;
      }
      listEl.innerHTML = filtered.map((p) => {
        const cats = Array.isArray(p.categories) ? p.categories : (p.categories ? [p.categories] : []);
        return `
        <div class="list-item">
          <div class="li-main" data-filename="${esc(p.filename)}" data-type="${state.postTab === 'draft' ? 'draft' : 'post'}">
            <div class="li-title">${esc(p.title)}</div>
            <div class="li-meta">
              <span class="mono">${esc(p.date || '无日期')}</span>
              <span>${cats.map((c) => esc(c)).join(' / ') || '未分类'}</span>
              <span>${p.wordCount} 字${p.hasImage ? ' · 含图' : ''}</span>
              ${(p.tags || []).slice(0, 4).map((t) => `<span class="chip tag">${esc(t)}</span>`).join('')}
            </div>
          </div>
          <div class="li-actions">
            <button class="btn sm" data-action="edit" data-filename="${esc(p.filename)}">编辑</button>
            <button class="btn sm" data-action="move" data-filename="${esc(p.filename)}">${state.postTab === 'draft' ? '发布' : '转草稿'}</button>
            <button class="btn sm danger" data-action="trash" data-filename="${esc(p.filename)}">删除</button>
          </div>
        </div>`;
      }).join('');
      $$('.li-main', listEl).forEach((el) => el.addEventListener('click', () => {
        state.editing = { filename: el.dataset.filename, type: el.dataset.type };
        renderEditor();
      }));
      $$('button[data-action]', listEl).forEach((btn) => btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const filename = btn.dataset.filename;
        try {
          if (btn.dataset.action === 'edit') {
            state.editing = { filename, type: state.postTab === 'draft' ? 'draft' : 'post' };
            renderEditor();
          } else if (btn.dataset.action === 'move') {
            const to = state.postTab === 'draft' ? 'post' : 'draft';
            const refreshDate = to === 'post' && state.postTab === 'draft'
              ? confirm('发布时把日期刷新为今天？') : false;
            await api('/api/move', { method: 'POST', body: { filename, to, refreshDate } });
            toast(to === 'post' ? '已发布' : '已转入草稿');
            loadPostList();
          } else if (btn.dataset.action === 'trash') {
            if (!confirm(`确定删除「${filename}」？会移入 admin/.trash 可恢复。`)) return;
            await api('/api/post', { method: 'DELETE', body: { filename, type: state.postTab === 'draft' ? 'draft' : 'post' } });
            toast('已移入回收站');
            loadPostList();
          }
        } catch (error) { toast(error.message, true); }
      }));
    } catch (error) {
      listEl.innerHTML = `<div class="empty">加载失败：${esc(error.message)}</div>`;
    }
  }

  function showNewPostModal() {
    openModal(`
      <div class="modal">
        <h2>新建文章</h2>
        <div class="fm-field"><label>标题</label><input type="text" id="np-title" placeholder="文章标题"></div>
        <div class="fm-field"><label>日期</label><input type="date" id="np-date" value="${new Date().toISOString().slice(0, 10)}"></div>
        <div class="fm-field"><label>分类</label><input type="text" id="np-categories" placeholder="多个用英文逗号分隔"></div>
        <div class="fm-field"><label>标签</label><input type="text" id="np-tags" placeholder="多个用英文逗号分隔" list="tag-options"><datalist id="tag-options"></datalist></div>
        <div class="modal-actions">
          <button class="btn" id="np-cancel">取消</button>
          <button class="btn primary" id="np-create">创建</button>
        </div>
      </div>`);
    api('/api/tags').then((tags) => {
      $('#tag-options').innerHTML = tags.map((t) => `<option value="${esc(t)}">`).join('');
    }).catch(() => {});
    $('#np-cancel').addEventListener('click', closeModal);
    $('#np-create').addEventListener('click', async () => {
      try {
        const { filename } = await api('/api/post', {
          method: 'POST',
          body: {
            title: $('#np-title').value,
            date: $('#np-date').value,
            categories: $('#np-categories').value.split(',').map((s) => s.trim()).filter(Boolean),
            tags: $('#np-tags').value.split(',').map((s) => s.trim()).filter(Boolean),
          },
        });
        closeModal();
        state.editing = { filename, type: 'post' };
        renderEditor();
      } catch (error) { toast(error.message, true); }
    });
  }

  let editorDirty = false;
  let previewTimer;

  async function renderEditor() {
    const container = $('#view-posts');
    try {
      const post = await api(`/api/post?filename=${encodeURIComponent(state.editing.filename)}&type=${state.editing.type}`);
      const cats = Array.isArray(post.data.categories) ? post.data.categories.join(', ') : (post.data.categories || '');
      container.innerHTML = `
        <div class="view-head">
          <div>
            <div class="view-title">编辑：${esc(post.data.title || post.filename)}</div>
            <div class="view-sub">${esc(post.filename)} · ${state.editing.type === 'draft' ? '草稿' : '已发布'}</div>
          </div>
          <div class="toolbar">
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-dim)">
              <input type="checkbox" id="ed-refresh-date"> 发布时刷新日期
            </label>
            <button class="btn" id="ed-back">← 返回</button>
            <button class="btn" id="ed-move">${state.editing.type === 'draft' ? '发布' : '转草稿'}</button>
            <button class="btn danger" id="ed-trash">删除</button>
            <button class="btn primary" id="ed-save">保存</button>
          </div>
        </div>
        <div class="editor-grid">
          <div class="editor-pane">
            <h3>FRONT MATTER</h3>
            <div class="fm-grid">
              <div class="fm-field"><label>标题</label><input type="text" id="ed-title" value="${esc(post.data.title || '')}"></div>
              <div class="fm-field"><label>日期</label><input type="date" id="ed-date" value="${esc(post.data.date || '')}"></div>
              <div class="fm-field"><label>分类</label><input type="text" id="ed-categories" value="${esc(cats)}" placeholder="逗号分隔"></div>
              <div class="fm-field"><label>标签</label><input type="text" id="ed-tags" value="${esc((post.data.tags || []).join(', '))}" placeholder="逗号分隔" list="tag-options"><datalist id="tag-options"></datalist></div>
            </div>
            <h3>MARKDOWN</h3>
            <textarea class="editor-textarea" id="ed-content">${esc(post.content)}</textarea>
          </div>
          <div class="editor-pane">
            <h3>PREVIEW</h3>
            <div class="markdown-preview" id="ed-preview"></div>
          </div>
        </div>`;
      api('/api/tags').then((tags) => {
        $('#tag-options').innerHTML = tags.map((t) => `<option value="${esc(t)}">`).join('');
      }).catch(() => {});
      const updatePreview = () => {
        const preview = $('#ed-preview');
        preview.innerHTML = marked.parse($('#ed-content').value || '');
        if (window.Prism) Prism.highlightAllUnder(preview);
      };
      updatePreview();
      $('#ed-content').addEventListener('input', () => {
        editorDirty = true;
        clearTimeout(previewTimer);
        previewTimer = setTimeout(updatePreview, 350);
      });
      $('#ed-back').addEventListener('click', () => { state.editing = null; editorDirty = false; renderPosts(); });
      $('#ed-trash').addEventListener('click', async () => {
        if (!confirm(`确定删除「${state.editing.filename}」？`)) return;
        try {
          await api('/api/post', { method: 'DELETE', body: { filename: state.editing.filename, type: state.editing.type } });
          toast('已移入回收站');
          state.editing = null; editorDirty = false;
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
          toast(to === 'post' ? '已发布' : '已转入草稿');
          renderEditor();
        } catch (error) { toast(error.message, true); }
      });
      $('#ed-save').addEventListener('click', async () => {
        const btn = $('#ed-save');
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
                categories: $('#ed-categories').value.split(',').map((s) => s.trim()).filter(Boolean),
                tags: $('#ed-tags').value.split(',').map((s) => s.trim()).filter(Boolean),
              },
              content: $('#ed-content').value,
            },
          });
          editorDirty = false;
          toast('已保存（原文件已备份到 admin/.backup）');
        } catch (error) { toast(error.message, true); } finally { btn.disabled = false; }
      });
      window.addEventListener('beforeunload', (e) => {
        if (editorDirty) { e.preventDefault(); e.returnValue = ''; }
      });
    } catch (error) {
      container.innerHTML = `<div class="empty">加载失败：${esc(error.message)}</div>
        <button class="btn" onclick="location.reload()">返回</button>`;
      state.editing = null;
    }
  }

  async function renderTrend() {
    const container = $('#view-trend');
    container.innerHTML = `
      <div class="view-head">
        <div>
          <div class="view-title">动态管理</div>
          <div class="view-sub">source/_data/shuoshuo.yml · 新的在上</div>
        </div>
        <div class="toolbar">
          <button class="btn primary" id="trend-add">＋ 新增动态</button>
          <button class="btn" id="trend-save">保存全部</button>
        </div>
      </div>
      <div id="trend-list"></div>`;
    try {
      state.trend = await api('/api/trend');
      renderTrendList();
    } catch (error) {
      $('#trend-list').innerHTML = `<div class="empty">加载失败：${esc(error.message)}</div>`;
    }
    $('#trend-add').addEventListener('click', () => showTrendModal(null));
    $('#trend-save').addEventListener('click', saveTrend);
  }

  function renderTrendList() {
    const listEl = $('#trend-list');
    if (!listEl) return;
    if (!state.trend.length) listEl.innerHTML = `<div class="empty">还没有动态</div>`;
    listEl.innerHTML = state.trend.map((item, index) => `
      <div class="card">
        <div class="card-head">
          <span class="card-date">${esc(item.date)}</span>
          <div class="li-actions">
            <button class="btn sm" data-i="${index}" data-a="up">↑</button>
            <button class="btn sm" data-i="${index}" data-a="down">↓</button>
            <button class="btn sm" data-i="${index}" data-a="edit">编辑</button>
            <button class="btn sm danger" data-i="${index}" data-a="del">删除</button>
          </div>
        </div>
        <div class="card-content">${marked.parse(item.content || '')}</div>
        ${(item.tags || []).length ? `<div style="margin-top:8px">${item.tags.map((t) => `<span class="chip tag">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>`).join('');
    $$('button[data-a]', listEl).forEach((btn) => btn.addEventListener('click', () => {
      const i = Number(btn.dataset.i);
      if (btn.dataset.a === 'up' && i > 0) { [state.trend[i - 1], state.trend[i]] = [state.trend[i], state.trend[i - 1]]; renderTrendList(); }
      if (btn.dataset.a === 'down' && i < state.trend.length - 1) { [state.trend[i + 1], state.trend[i]] = [state.trend[i], state.trend[i + 1]]; renderTrendList(); }
      if (btn.dataset.a === 'edit') showTrendModal(i);
      if (btn.dataset.a === 'del') {
        if (confirm('删除这条动态？')) { state.trend.splice(i, 1); renderTrendList(); }
      }
    }));
  }

  function showTrendModal(index) {
    const item = index !== null ? state.trend[index] : { author: '乱与狒', date: '', content: '', tags: [] };
    openModal(`
      <div class="modal">
        <h2>${index !== null ? '编辑动态' : '新增动态'}</h2>
        <div class="fm-field"><label>日期时间</label><input type="text" id="tm-date" value="${esc(item.date)}" placeholder="2026-08-13 20:00:00"></div>
        <div class="fm-field"><label>内容（支持 Markdown + HTML，图片用 /image/xxx.webp）</label><textarea id="tm-content" style="min-height:160px">${esc(item.content)}</textarea></div>
        <div class="fm-field"><label>标签（逗号分隔）</label><input type="text" id="tm-tags" value="${esc((item.tags || []).join(', '))}"></div>
        <div class="modal-actions">
          <button class="btn" id="tm-cancel">取消</button>
          <button class="btn primary" id="tm-ok">确定</button>
        </div>
      </div>`);
    $('#tm-cancel').addEventListener('click', closeModal);
    $('#tm-ok').addEventListener('click', () => {
      const next = {
        author: item.author || '乱与狒',
        date: $('#tm-date').value.trim(),
        content: $('#tm-content').value,
        tags: $('#tm-tags').value.split(',').map((s) => s.trim()).filter(Boolean),
      };
      if (index !== null) state.trend[index] = next;
      else state.trend.unshift(next);
      closeModal();
      renderTrendList();
    });
  }

  async function saveTrend() {
    try {
      state.trend = await api('/api/trend', { method: 'PUT', body: state.trend });
      renderTrendList();
      toast('动态已保存（原文件已备份）');
    } catch (error) { toast(error.message, true); }
  }

  async function renderLinks() {
    const container = $('#view-links');
    container.innerHTML = `
      <div class="view-head">
        <div>
          <div class="view-title">链接页管理</div>
          <div class="view-sub">source/_data/link.yml</div>
        </div>
        <div class="toolbar">
          <button class="btn primary" id="links-add-group">＋ 新增分组</button>
          <button class="btn" id="links-save">保存全部</button>
        </div>
      </div>
      <div id="links-list"></div>`;
    try {
      state.links = await api('/api/links');
      renderLinksList();
    } catch (error) {
      $('#links-list').innerHTML = `<div class="empty">加载失败：${esc(error.message)}</div>`;
    }
    $('#links-add-group').addEventListener('click', () => {
      state.links.push({ class_name: '新分组', class_desc: '', link_list: [] });
      renderLinksList();
    });
    $('#links-save').addEventListener('click', saveLinks);
  }

  function renderLinksList() {
    const listEl = $('#links-list');
    if (!listEl) return;
    listEl.innerHTML = state.links.map((group, gi) => `
      <div class="card">
        <div class="link-group-head">
          <input type="text" data-g="${gi}" data-f="class_name" value="${esc(group.class_name)}" style="width:180px">
          <input type="text" data-g="${gi}" data-f="class_desc" value="${esc(group.class_desc)}" placeholder="英文描述">
          <div class="li-actions" style="margin-left:auto">
            <button class="btn sm" data-g="${gi}" data-a="add-link">＋ 链接</button>
            <button class="btn sm danger" data-g="${gi}" data-a="del-group">删组</button>
          </div>
        </div>
        ${group.link_list.map((link, li) => `
          <div class="link-row">
            <input type="text" data-g="${gi}" data-l="${li}" data-f="name" value="${esc(link.name)}" placeholder="名称">
            <input type="text" data-g="${gi}" data-l="${li}" data-f="link" value="${esc(link.link)}" placeholder="https://…">
            <input type="text" data-g="${gi}" data-l="${li}" data-f="avatar" value="${esc(link.avatar)}" placeholder="头像 URL">
            <button class="btn sm danger" data-g="${gi}" data-l="${li}" data-a="del-link">✕</button>
          </div>
          <div class="link-row" style="grid-template-columns:1fr 40px; margin-top:-4px">
            <input type="text" data-g="${gi}" data-l="${li}" data-f="descr" value="${esc(link.descr)}" placeholder="描述">
            <span></span>
          </div>`).join('')}
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
      if (btn.dataset.a === 'add-link') {
        state.links[gi].link_list.push({ name: '', link: '', avatar: '', descr: '' });
        renderLinksList();
      }
      if (btn.dataset.a === 'del-group') {
        if (confirm(`删除分组「${state.links[gi].class_name}」？`)) { state.links.splice(gi, 1); renderLinksList(); }
      }
      if (btn.dataset.a === 'del-link') {
        state.links[gi].link_list.splice(Number(btn.dataset.l), 1);
        renderLinksList();
      }
    }));
  }

  async function saveLinks() {
    try {
      state.links = await api('/api/links', { method: 'PUT', body: state.links });
      renderLinksList();
      toast('链接页已保存（原文件已备份）');
    } catch (error) { toast(error.message, true); }
  }

  async function renderImages() {
    const container = $('#view-images');
    container.innerHTML = `
      <div class="view-head">
        <div>
          <div class="view-title">图片转换</div>
          <div class="view-sub">source/image · source/img · PNG/JPG → WebP（自动替换引用）</div>
        </div>
        <div class="toolbar">
          <span id="img-count" style="color:var(--text-dim);font-size:12px"></span>
          <button class="btn primary" id="img-convert">转换所选 (${state.selectedImages.size})</button>
        </div>
      </div>
      <div class="img-grid" id="img-grid"></div>`;
    try {
      state.images = await api('/api/images');
      renderImageGrid();
    } catch (error) {
      $('#img-grid').innerHTML = `<div class="empty">加载失败：${esc(error.message)}</div>`;
    }
    $('#img-convert').addEventListener('click', convertSelected);
  }

  function renderImageGrid() {
    const grid = $('#img-grid');
    const unconverted = state.images.filter((img) => !img.converted);
    $('#img-count').textContent = `共 ${unconverted.length} 张待转换`;
    if (!state.images.length) {
      grid.innerHTML = `<div class="empty">没有可转换的图片，干得漂亮</div>`;
      return;
    }
    grid.innerHTML = state.images.map((img) => `
      <div class="img-card ${state.selectedImages.has(img.name) ? 'selected' : ''}" data-name="${esc(img.name)}">
        <img src="${esc(img.url)}" loading="lazy" alt="">
        <div class="img-info">
          <div class="img-name">${esc(img.name)}</div>
          <div class="img-size">${fmtBytes(img.size)}${img.converted ? ' · 已转换' : ''}</div>
        </div>
      </div>`).join('');
    $$('.img-card', grid).forEach((card) => card.addEventListener('click', () => {
      const name = card.dataset.name;
      const img = state.images.find((i) => i.name === name);
      if (img.converted) return;
      if (state.selectedImages.has(name)) state.selectedImages.delete(name);
      else state.selectedImages.add(name);
      renderImageGrid();
    }));
  }

  async function convertSelected() {
    if (!state.selectedImages.size) return toast('先点选要转换的图片', true);
    if (!confirm(`转换 ${state.selectedImages.size} 张图片为 WebP？原图会被删除（引用路径自动替换）。`)) return;
    const names = [...state.selectedImages];
    try {
      const results = await api('/api/images/convert', { method: 'POST', body: { names } });
      const saved = results.reduce((sum, r) => sum + (r.before - r.after), 0);
      state.selectedImages.clear();
      state.images = await api('/api/images');
      renderImageGrid();
      openModal(`
        <div class="modal">
          <h2>转换完成，共省 ${fmtBytes(saved)}</h2>
          ${results.map((r) => `<div class="card"><b>${esc(r.name)}</b> → ${esc(r.to)}<br>
            <span style="color:var(--text-dim);font-size:12px">${fmtBytes(r.before)} → ${fmtBytes(r.after)}
            ${r.replaced.length ? `<br>已替换引用：${r.replaced.map(esc).join('、')}` : ''}</span></div>`).join('')}
          <div class="modal-actions"><button class="btn primary" id="img-done">好的</button></div>
        </div>`);
      $('#img-done').addEventListener('click', closeModal);
      toast('转换完成');
    } catch (error) { toast(error.message, true); }
  }

  function renderDeploy() {
    const container = $('#view-deploy');
    container.innerHTML = `
      <div class="view-head">
        <div>
          <div class="view-title">构建与部署</div>
          <div class="view-sub">git · hexo · vercel · github pages</div>
        </div>
        <div class="toolbar">
          <button class="btn" id="dep-server">预览</button>
          <button class="btn" id="dep-build">构建</button>
          <button class="btn primary" id="dep-vercel">部署 Vercel</button>
          <button class="btn" id="dep-pages">部署 GitHub Pages</button>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><b>Git 状态</b><button class="btn sm" id="dep-refresh">刷新</button></div>
        <div class="git-lines" id="git-lines">加载中…</div>
      </div>
      <div class="card">
        <div class="card-head"><b>Commit 信息</b></div>
        <input type="text" id="commit-msg" placeholder="留空使用默认：update: YYYY-MM-DD HH:mm" style="font-family:var(--mono)">
      </div>
      <div class="card">
        <div class="card-head"><b>运行日志</b><button class="btn sm" id="dep-clear-log">清空</button></div>
        <div class="console" id="console"></div>
      </div>`;
    $('#dep-refresh').addEventListener('click', loadGitStatus);
    $('#dep-clear-log').addEventListener('click', () => { $('#console').innerHTML = ''; });
    $('#dep-server').addEventListener('click', toggleServer);
    $('#dep-build').addEventListener('click', () => runOp('/api/build', '构建'));
    $('#dep-vercel').addEventListener('click', () => {
      if (!confirm('确认 push 到 GitHub main 分支？Vercel 会自动部署。')) return;
      runOp('/api/deploy/vercel', '部署 Vercel', { message: $('#commit-msg').value });
    });
    $('#dep-pages').addEventListener('click', () => {
      if (!confirm('确认部署到 GitHub Pages（会执行 hexo clean/generate/deploy）？')) return;
      runOp('/api/deploy/pages', '部署 GitHub Pages');
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
    } catch (error) {
      const el = $('#git-lines');
      if (el) el.textContent = error.message;
    }
  }

  async function loadServerState() {
    try {
      const s = await api('/api/server/state');
      state.previewRunning = s.running;
      const btn = $('#dep-server');
      if (btn) btn.textContent = s.running ? '停止预览' : '预览';
    } catch (error) { /* ignore */ }
  }

  async function toggleServer() {
    const btn = $('#dep-server');
    btn.disabled = true;
    try {
      if (state.previewRunning) {
        await api('/api/server/stop', { method: 'POST' });
        state.previewRunning = false;
        btn.textContent = '预览';
        toast('预览已停止');
      } else {
        await api('/api/server/start', { method: 'POST' });
        state.previewRunning = true;
        btn.textContent = '停止预览';
        toast('预览启动中：localhost:4000');
      }
    } catch (error) { toast(error.message, true); } finally { btn.disabled = false; }
  }

  async function runOp(path, label, body) {
    const btn = document.activeElement;
    if (btn && btn.disabled !== undefined) btn.disabled = true;
    try {
      await api(path, { method: 'POST', body });
      toast(`${label}完成`);
      if (label.includes('部署') || label === '构建') loadGitStatus();
    } catch (error) {
      toast(error.message, true);
    } finally {
      if (btn && btn.disabled !== undefined) btn.disabled = false;
    }
  }

  let logSource = null;
  function connectLogs() {
    if (logSource) { logSource.close(); logSource = null; }
    logSource = new EventSource('/api/logs');
    logSource.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        const consoleEl = $('#console');
        if (!consoleEl) return;
        const line = document.createElement('div');
        line.className = `c-${entry.kind}`;
        line.textContent = entry.text;
        consoleEl.appendChild(line);
        while (consoleEl.childNodes.length > 600) consoleEl.removeChild(consoleEl.firstChild);
        consoleEl.scrollTop = consoleEl.scrollHeight;
      } catch (error) { /* ignore */ }
    };
  }

  $$('.nav-item').forEach((btn) => btn.addEventListener('click', () => {
    if (state.view !== 'deploy' && logSource) { logSource.close(); logSource = null; }
    switchView(btn.dataset.view);
  }));

  const quitBtn = $('#btn-quit');
  if (quitBtn) quitBtn.addEventListener('click', async () => {
    if (!confirm('退出 Fee Admin？面板服务和本地预览都会关闭。再次启动请双击「Fee Admin」图标。')) return;
    try {
      await api('/api/quit', { method: 'POST' });
      document.body.innerHTML = '<div style="display:grid;place-items:center;min-height:100vh;color:#8a948e;font-size:14px">Fee Admin 已退出，可以关闭此标签页。</div>';
    } catch (error) {
      toast('已退出，服务已关闭', true);
      setTimeout(() => { document.body.innerHTML = '<div style="display:grid;place-items:center;min-height:100vh;color:#8a948e;font-size:14px">Fee Admin 已退出。</div>'; }, 400);
    }
  });

  marked.setOptions({ breaks: true, gfm: true });
  switchView('posts');
})();
