const path = require('path');
const express = require('express');
const posts = require('./lib/posts');
const yamlData = require('./lib/yaml-data');
const images = require('./lib/images');
const git = require('./lib/git');
const resume = require('./lib/resume');

const PORT = 4321;
const app = express();

app.use(express.json({ limit: '30mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/vendor/marked.min.js', (req, res) => res.sendFile(path.join(posts.ROOT, 'node_modules/marked/marked.min.js')));
app.get('/vendor/prism.js', (req, res) => res.sendFile(path.join(posts.ROOT, 'node_modules/prismjs/prism.js')));
app.get('/vendor/prism/themes/:file', (req, res) =>
  res.sendFile(path.join(posts.ROOT, 'node_modules/prismjs/themes', path.basename(req.params.file)))
);
app.get('/vendor/prism/components/:file', (req, res) =>
  res.sendFile(path.join(posts.ROOT, 'node_modules/prismjs/components', path.basename(req.params.file)))
);

app.use('/image', express.static(path.join(posts.ROOT, 'source/image')));
app.use('/img', express.static(path.join(posts.ROOT, 'source/img')));

app.get('/srcimg/:dir/:file', (req, res) => {
  const dirName = req.params.dir === 'img' ? 'img' : 'image';
  res.sendFile(path.join(posts.ROOT, 'source', dirName, path.basename(req.params.file)));
});

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((error) => {
    res.status(error.code === 'BUSY' ? 409 : 400).json({ error: error.message, code: error.code });
  });

// 文章与草稿
app.get('/api/posts', wrap(async (req, res) => res.json(await posts.readPosts(posts.POSTS_DIR))));
app.get('/api/drafts', wrap(async (req, res) => res.json(await posts.readPosts(posts.DRAFTS_DIR))));
app.get('/api/tags', wrap(async (req, res) => res.json(await posts.getAllTags())));
app.get('/api/categories', wrap(async (req, res) => res.json(await posts.getAllCategories())));
app.get('/api/stats', wrap(async (req, res) => res.json(await posts.getActivityStats())));

app.get('/api/post', wrap(async (req, res) => {
  const { filename, type } = req.query;
  if (!filename) return res.status(400).json({ error: '缺少 filename' });
  res.json(await posts.getPost(filename, type === 'draft' ? 'draft' : 'post'));
}));

app.put('/api/post', wrap(async (req, res) => {
  const { filename, type, data, content } = req.body || {};
  if (!filename) return res.status(400).json({ error: '缺少 filename' });
  res.json(await posts.savePost(filename, type === 'draft' ? 'draft' : 'post', { data, content }));
}));

app.post('/api/post', wrap(async (req, res) => {
  res.json(await posts.createPost(req.body || {}));
}));

app.post('/api/post/import', wrap(async (req, res) => {
  const { content, name, targetType } = req.body || {};
  if (!content) return res.status(400).json({ error: '缺少导入内容' });
  res.json(await posts.importPost(content, name, targetType || 'draft'));
}));

app.post('/api/move', wrap(async (req, res) => {
  const { filename, to, refreshDate } = req.body || {};
  if (!filename) return res.status(400).json({ error: '缺少 filename' });
  const fromType = to === 'draft' ? 'post' : 'draft';
  res.json(await posts.movePost(filename, fromType, to, { refreshDate: !!refreshDate }));
}));

app.delete('/api/post', wrap(async (req, res) => {
  const { filename, type } = req.body || {};
  if (!filename) return res.status(400).json({ error: '缺少 filename' });
  const dest = await posts.trashPost(filename, type === 'draft' ? 'draft' : 'post');
  res.json({ trashedTo: path.relative(posts.ROOT, dest) });
}));

// 回收站
app.get('/api/trash', wrap(async (req, res) => res.json(await posts.getTrashList())));
app.post('/api/trash/restore', wrap(async (req, res) => {
  const { filename } = req.body || {};
  if (!filename) return res.status(400).json({ error: '缺少 filename' });
  res.json(await posts.restoreTrash(filename));
}));
app.post('/api/trash/purge', wrap(async (req, res) => {
  const { filename } = req.body || {};
  res.json(await posts.purgeTrash(filename));
}));

// 历史修订版本
app.get('/api/post/revisions', wrap(async (req, res) => {
  const { filename, type } = req.query;
  if (!filename) return res.status(400).json({ error: '缺少 filename' });
  res.json(await posts.getRevisions(filename, type === 'draft' ? 'draft' : 'post'));
}));

app.post('/api/post/restore-revision', wrap(async (req, res) => {
  const { filename, type, backupFile } = req.body || {};
  if (!filename || !backupFile) return res.status(400).json({ error: '缺少参数' });
  res.json(await posts.restoreRevision(filename, type === 'draft' ? 'draft' : 'post', backupFile));
}));

// 动态与链接
app.get('/api/trend', wrap(async (req, res) => res.json(await yamlData.readShuoshuo())));
app.put('/api/trend', wrap(async (req, res) => res.json(await yamlData.saveShuoshuo(req.body || []))));

app.get('/api/links', wrap(async (req, res) => res.json(await yamlData.readLinks())));
app.put('/api/links', wrap(async (req, res) => res.json(await yamlData.saveLinks(req.body || []))));
app.get('/api/links/check', wrap(async (req, res) => res.json(await yamlData.checkAllLinks())));

// 简历管理
app.get('/api/resume', wrap(async (req, res) => {
  delete require.cache[require.resolve('./lib/resume')];
  const r = require('./lib/resume');
  res.json(await r.readResume());
}));
app.put('/api/resume', wrap(async (req, res) => {
  delete require.cache[require.resolve('./lib/resume')];
  const r = require('./lib/resume');
  res.json(await r.saveResume(req.body || {}));
}));

// 项目管理
app.get('/api/projects', wrap(async (req, res) => {
  delete require.cache[require.resolve('./lib/projects')];
  const p = require('./lib/projects');
  res.json(await p.readProjects());
}));
app.put('/api/projects', wrap(async (req, res) => {
  delete require.cache[require.resolve('./lib/projects')];
  const p = require('./lib/projects');
  res.json(await p.saveProjects(req.body || {}));
}));

// 图片管理与上传
app.get('/api/images', wrap(async (req, res) => res.json(await images.scanImages())));
app.post('/api/images/convert', wrap(async (req, res) => {
  const names = Array.isArray(req.body?.names) ? req.body.names : [];
  if (!names.length) return res.status(400).json({ error: '没有选择任何图片' });
  res.json(await images.convertImages(names));
}));

app.post('/api/images/upload', wrap(async (req, res) => {
  const { name, data, mimeType } = req.body || {};
  if (!data) return res.status(400).json({ error: '缺少图片数据' });
  // data 可能是 base64 URL (data:image/png;base64,xxxx) 或纯 base64
  const base64Data = data.includes(';base64,') ? data.split(';base64,')[1] : data;
  const buffer = Buffer.from(base64Data, 'base64');
  res.json(await images.uploadImage({ buffer, originalName: name, mimeType }));
}));

app.get('/api/images/orphans', wrap(async (req, res) => res.json(await images.scanOrphanImages())));
app.post('/api/images/orphans/delete', wrap(async (req, res) => {
  const names = Array.isArray(req.body?.names) ? req.body.names : [];
  if (!names.length) return res.status(400).json({ error: '未指定要删除的文件' });
  res.json(await images.deleteOrphanImages(names));
}));

// Git 与构建部署
app.get('/api/git/status', wrap(async (req, res) => res.json(await git.gitStatus())));
app.post('/api/build', wrap(async (req, res) => {
  await git.build();
  res.json({ ok: true });
}));
app.post('/api/deploy/all', wrap(async (req, res) => {
  await git.deployAll(req.body?.message);
  res.json({ ok: true });
}));
app.post('/api/deploy/vercel', wrap(async (req, res) => {
  await git.deployVercel(req.body?.message);
  res.json({ ok: true });
}));
app.post('/api/deploy/pages', wrap(async (req, res) => {
  await git.deployPages();
  res.json({ ok: true });
}));
app.post('/api/server/start', wrap(async (req, res) => res.json(await git.startServer())));
app.post('/api/server/stop', wrap(async (req, res) => res.json(await git.stopServer())));
app.get('/api/server/state', wrap(async (req, res) => res.json(git.previewState())));
app.get('/api/server/ready', wrap(async (req, res) => res.json({ ready: await git.checkReady() })));
app.get('/api/server/wait', wrap(async (req, res) => res.json({ ready: await git.waitForReady() })));

app.post('/api/quit', async (req, res) => {
  res.json({ ok: true, message: 'Fee Admin 正在退出…' });
  setTimeout(() => process.exit(0), 300);
});

app.get('/api/logs', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const onLog = (entry) => res.write(`data: ${JSON.stringify(entry)}\n\n`);
  git.bus.on('log', onLog);
  const heartbeat = setInterval(() => res.write(':hb\n\n'), 15000);
  req.on('close', () => {
    git.bus.off('log', onLog);
    clearInterval(heartbeat);
  });
});

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Fee Admin 已启动: http://localhost:${PORT} (仅本机可访问)`);
});
