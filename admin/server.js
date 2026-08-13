const path = require('path');
const express = require('express');
const posts = require('./lib/posts');
const yamlData = require('./lib/yaml-data');
const images = require('./lib/images');
const git = require('./lib/git');

const PORT = 4321;
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/vendor/marked.min.js', (req, res) => res.sendFile(path.join(posts.ROOT, 'node_modules/marked/marked.min.js')));
app.get('/vendor/prism.js', (req, res) => res.sendFile(path.join(posts.ROOT, 'node_modules/prismjs/prism.js')));
app.get('/vendor/prism/themes/:file', (req, res) =>
  res.sendFile(path.join(posts.ROOT, 'node_modules/prismjs/themes', path.basename(req.params.file)))
);
app.get('/vendor/prism/components/:file', (req, res) =>
  res.sendFile(path.join(posts.ROOT, 'node_modules/prismjs/components', path.basename(req.params.file)))
);

app.get('/srcimg/:dir/:file', (req, res) => {
  const dirName = req.params.dir === 'img' ? 'img' : 'image';
  res.sendFile(path.join(posts.ROOT, 'source', dirName, path.basename(req.params.file)));
});

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((error) => {
    res.status(error.code === 'BUSY' ? 409 : 400).json({ error: error.message, code: error.code });
  });

app.get('/api/posts', wrap(async (req, res) => res.json(await posts.readPosts(posts.POSTS_DIR))));
app.get('/api/drafts', wrap(async (req, res) => res.json(await posts.readPosts(posts.DRAFTS_DIR))));
app.get('/api/tags', wrap(async (req, res) => res.json(await posts.getAllTags())));

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

app.get('/api/trend', wrap(async (req, res) => res.json(await yamlData.readShuoshuo())));
app.put('/api/trend', wrap(async (req, res) => res.json(await yamlData.saveShuoshuo(req.body || []))));

app.get('/api/links', wrap(async (req, res) => res.json(await yamlData.readLinks())));
app.put('/api/links', wrap(async (req, res) => res.json(await yamlData.saveLinks(req.body || []))));

app.get('/api/images', wrap(async (req, res) => res.json(await images.scanImages())));

app.post('/api/images/convert', wrap(async (req, res) => {
  const names = Array.isArray(req.body?.names) ? req.body.names : [];
  if (!names.length) return res.status(400).json({ error: '没有选择任何图片' });
  res.json(await images.convertImages(names));
}));

app.get('/api/git/status', wrap(async (req, res) => res.json(await git.gitStatus())));
app.post('/api/build', wrap(async (req, res) => {
  await git.build();
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
