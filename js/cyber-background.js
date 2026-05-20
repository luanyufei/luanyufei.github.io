(() => {
  const CANVAS_ID = 'particles-canvas';
  const MIN_WIDTH = 720;
  const TARGET_FPS = 30;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  const MAX_DPR = 1;
  const CONNECTION_DIST = 140;
  const CONNECTION_DIST_SQ = CONNECTION_DIST * CONNECTION_DIST;
  const CELL_SIZE = CONNECTION_DIST;
  const PARTICLE_COLOR = '100, 255, 218';
  const PARTICLE_ALPHA = 0.45;
  const LINE_ALPHA_MAX = 0.18;
  const OPACITY_BUCKETS = 4;

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let canvas = null;
  let ctx = null;
  let particles = [];
  let grid = new Map();
  let animationFrame = null;
  let resizeTimer = null;
  let lastFrameTime = 0;
  let canvasW = 0;
  let canvasH = 0;
  let gridCols = 0;
  let gridRows = 0;

  /* ── Helpers ──────────────────────────────────── */

  const isUnlocked = () => document.documentElement.classList.contains('site-unlocked');

  const shouldAnimate = () =>
    isUnlocked() &&
    !document.hidden &&
    !reducedMotionQuery.matches &&
    window.innerWidth >= MIN_WIDTH;

  const getMaxParticles = () => {
    const mem = navigator.deviceMemory || 4;
    const area = window.innerWidth * window.innerHeight;
    let base = Math.floor(area / 65000);
    if (mem <= 2) base = Math.floor(base * 0.5);
    else if (mem <= 4) base = Math.floor(base * 0.75);
    return Math.max(14, Math.min(42, base));
  };

  /* ── Spatial Grid ─────────────────────────────── */

  const cellKey = (cx, cy) => (cy << 16) | cx;

  const buildGrid = () => {
    grid.clear();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const cx = (p.x / CELL_SIZE) | 0;
      const cy = (p.y / CELL_SIZE) | 0;
      const key = cellKey(cx, cy);
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push(i);
    }
  };

  /* ── Particles ────────────────────────────────── */

  const initParticles = () => {
    canvasW = window.innerWidth;
    canvasH = window.innerHeight;
    gridCols = Math.ceil(canvasW / CELL_SIZE);
    gridRows = Math.ceil(canvasH / CELL_SIZE);
    const count = getMaxParticles();
    particles = new Array(count);
    for (let i = 0; i < count; i++) {
      const size = Math.random() * 1.8 + 0.8;
      particles[i] = {
        x: Math.random() * (canvasW - size * 4) + size * 2,
        y: Math.random() * (canvasH - size * 4) + size * 2,
        dx: (Math.random() - 0.5) * 0.8,
        dy: (Math.random() - 0.5) * 0.8,
        r: size,
      };
    }
  };

  const updateParticles = () => {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.x > canvasW || p.x < 0) p.dx = -p.dx;
      if (p.y > canvasH || p.y < 0) p.dy = -p.dy;
      p.x += p.dx;
      p.y += p.dy;
    }
  };

  /* ── Rendering ────────────────────────────────── */

  const drawParticles = () => {
    ctx.fillStyle = `rgba(${PARTICLE_COLOR}, ${PARTICLE_ALPHA})`;
    ctx.beginPath();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.moveTo(p.x + p.r, p.y);
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
    }
    ctx.fill();
  };

  const drawConnections = () => {
    // Batch lines by opacity bucket for minimal draw calls
    const bucketPaths = new Array(OPACITY_BUCKETS);
    for (let b = 0; b < OPACITY_BUCKETS; b++) {
      bucketPaths[b] = [];
    }

    buildGrid();

    for (let i = 0; i < particles.length; i++) {
      const pa = particles[i];
      const cx = (pa.x / CELL_SIZE) | 0;
      const cy = (pa.y / CELL_SIZE) | 0;

      // Check only current cell and 4 neighbors (right, bottom-left, bottom, bottom-right)
      // to avoid double-checking pairs
      for (let dcy = 0; dcy <= 1; dcy++) {
        const startDcx = dcy === 0 ? 0 : -1;
        for (let dcx = startDcx; dcx <= 1; dcx++) {
          const nx = cx + dcx;
          const ny = cy + dcy;
          if (nx < 0 || ny < 0 || nx >= gridCols || ny >= gridRows) continue;

          const bucket = grid.get(cellKey(nx, ny));
          if (!bucket) continue;

          for (let k = 0; k < bucket.length; k++) {
            const j = bucket[k];
            if (j <= i) continue; // avoid duplicate pairs

            const pb = particles[j];
            const ddx = pa.x - pb.x;
            const ddy = pa.y - pb.y;
            const distSq = ddx * ddx + ddy * ddy;

            if (distSq < CONNECTION_DIST_SQ) {
              const ratio = 1 - distSq / CONNECTION_DIST_SQ;
              const bucketIdx = Math.min((ratio * OPACITY_BUCKETS) | 0, OPACITY_BUCKETS - 1);
              bucketPaths[bucketIdx].push(pa.x, pa.y, pb.x, pb.y);
            }
          }
        }
      }
    }

    // Draw each bucket with a single stroke call
    ctx.lineWidth = 1;
    for (let b = 0; b < OPACITY_BUCKETS; b++) {
      const coords = bucketPaths[b];
      if (coords.length === 0) continue;

      const alpha = ((b + 0.5) / OPACITY_BUCKETS) * LINE_ALPHA_MAX;
      ctx.strokeStyle = `rgba(${PARTICLE_COLOR}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      for (let c = 0; c < coords.length; c += 4) {
        ctx.moveTo(coords[c], coords[c + 1]);
        ctx.lineTo(coords[c + 2], coords[c + 3]);
      }
      ctx.stroke();
    }
  };

  /* ── Animation Loop ───────────────────────────── */

  const animate = (timestamp) => {
    if (!shouldAnimate()) {
      stop();
      return;
    }

    animationFrame = requestAnimationFrame(animate);

    const delta = timestamp - lastFrameTime;
    if (delta < FRAME_INTERVAL) return;
    lastFrameTime = timestamp - (delta % FRAME_INTERVAL);

    ctx.clearRect(0, 0, canvasW, canvasH);
    updateParticles();
    drawParticles();
    drawConnections();
  };

  /* ── Lifecycle ────────────────────────────────── */

  const stop = () => {
    if (!animationFrame) return;
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
    lastFrameTime = 0;
  };

  const destroyCanvas = () => {
    stop();
    particles = [];
    grid.clear();
    if (canvas) canvas.remove();
    canvas = null;
    ctx = null;
  };

  const ensureCanvas = () => {
    const existing = document.getElementById(CANVAS_ID);
    if (existing) return existing;
    const el = document.createElement('canvas');
    el.id = CANVAS_ID;
    el.setAttribute('aria-hidden', 'true');
    document.body.prepend(el);
    return el;
  };

  const resizeCanvas = () => {
    if (!canvas || !ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvasW = window.innerWidth;
    canvasH = window.innerHeight;
    canvas.width = Math.floor(canvasW * ratio);
    canvas.height = Math.floor(canvasH * ratio);
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    initParticles();
  };

  const start = () => {
    if (!shouldAnimate()) {
      destroyCanvas();
      return;
    }
    canvas = ensureCanvas();
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    resizeCanvas();
    animate(0);
  };

  const sync = () => {
    if (shouldAnimate()) {
      if (!animationFrame) start();
      return;
    }
    destroyCanvas();
  };

  /* ── Event Bindings ───────────────────────────── */

  document.addEventListener('visibilitychange', sync);

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!shouldAnimate()) { destroyCanvas(); return; }
      if (!canvas) { start(); return; }
      resizeCanvas();
    }, 180);
  });

  reducedMotionQuery.addEventListener?.('change', sync);

  const classObserver = new MutationObserver(sync);
  classObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
