const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const { ROOT } = require('./posts');

const bus = new EventEmitter();
bus.setMaxListeners(100);

let busy = null;
let previewProc = null;

function emit(kind, text) {
  bus.emit('log', { kind, text, ts: Date.now() });
}

function run(cmd, args, label) {
  return new Promise((resolve, reject) => {
    emit('info', `$ ${cmd} ${args.join(' ')}`);
    const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env } });
    const out = (chunk) => {
      const text = chunk.toString();
      if (text) emit('out', text);
    };
    child.stdout.on('data', out);
    child.stderr.on('data', out);
    child.on('close', (code) => {
      emit('info', `${label} ${code === 0 ? '完成 ✓' : `失败 ✗ (退出码 ${code})`}`);
      if (code === 0) resolve();
      else reject(new Error(`${label} 失败，退出码 ${code}`));
    });
    child.on('error', (error) => {
      emit('error', error.message);
      reject(error);
    });
  });
}

function withLock(label, task) {
  if (busy) {
    const error = new Error(`已有任务进行中（${busy}），请等它完成`);
    error.code = 'BUSY';
    return Promise.reject(error);
  }
  busy = label;
  return Promise.resolve()
    .then(task)
    .finally(() => {
      busy = null;
    });
}

async function gitStatus() {
  const { execFile } = require('child_process');
  return new Promise((resolve) => {
    execFile('git', ['status', '--short'], { cwd: ROOT }, (error, stdout) => {
      resolve({
        branch: '',
        lines: error ? [`git status 失败: ${error.message}`] : stdout.split('\n').filter(Boolean),
      });
    });
  });
}

async function deployVercel(message) {
  return withLock('部署 Vercel', async () => {
    const msg = String(message || '').trim() || `update: ${new Date().toISOString().slice(0, 16)}`;
    await run('git', ['add', '-A'], 'git add');
    await run('git', ['commit', '-m', msg], 'git commit');
    await run('git', ['push', 'origin', 'main'], 'git push');
  });
}

async function deployPages() {
  return withLock('部署 GitHub Pages', async () => {
    await run('npx', ['hexo', 'clean'], 'hexo clean');
    await run('npx', ['hexo', 'generate'], 'hexo generate');
    await run('npx', ['hexo', 'deploy'], 'hexo deploy');
  });
}

async function build() {
  return withLock('构建', async () => {
    await run('npx', ['hexo', 'clean'], 'hexo clean');
    await run('npx', ['hexo', 'generate'], 'hexo generate');
  });
}

async function startServer() {
  if (previewProc) return { running: true };
  previewProc = spawn('npx', ['hexo', 'server'], { cwd: ROOT });
  emit('info', '本地预览启动中: http://localhost:4000');
  previewProc.stdout.on('data', (chunk) => emit('out', chunk.toString()));
  previewProc.stderr.on('data', (chunk) => emit('out', chunk.toString()));
  previewProc.on('close', (code) => {
    emit('info', `本地预览已停止（退出码 ${code ?? '—'}）`);
    previewProc = null;
  });
  previewProc.on('error', (error) => {
    emit('error', error.message);
    previewProc = null;
  });
  return { running: true };
}

async function stopServer() {
  if (!previewProc) return { running: false };
  const proc = previewProc;
  previewProc = null;
  try { proc.kill('SIGTERM'); } catch (error) { /* already gone */ }
  return { running: false };
}

function previewState() {
  return { running: !!previewProc };
}

function currentBusy() {
  return busy;
}

process.on('exit', () => {
  if (previewProc) {
    try { previewProc.kill('SIGTERM'); } catch (error) { /* ignore */ }
  }
});

const http = require('http');

function checkReady(port = 4000) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForReady(port = 4000, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!previewProc) return false;
    const ok = await checkReady(port);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

module.exports = {
  bus,
  gitStatus,
  deployVercel,
  deployPages,
  build,
  startServer,
  stopServer,
  previewState,
  currentBusy,
  checkReady,
  waitForReady,
};
