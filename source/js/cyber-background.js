(() => {
  const CANVAS_ID = 'particles-canvas';
  const MIN_WIDTH = 720;
  const TARGET_FPS = 30;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  const MAX_DPR = 1.5; // Slightly higher DPR for smooth orbs, they are cheap to render

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let canvas = null;
  let ctx = null;
  let particles = [];
  let animationFrame = null;
  let resizeTimer = null;
  let lastFrameTime = 0;
  let canvasW = 0;
  let canvasH = 0;
  let themeColor = '125, 211, 199'; // Default dark mode glow

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
    let base = Math.floor(area / 18000); // More particles since they have no lines
    if (mem <= 2) base = Math.floor(base * 0.5);
    else if (mem <= 4) base = Math.floor(base * 0.8);
    return Math.max(30, Math.min(80, base));
  };

  const updateThemeColor = () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    // Light mode: dark teal, Dark mode: glowing cyan
    themeColor = isLight ? '0, 127, 114' : '125, 211, 199';
  };

  /* ── Particles (Bokeh Orbs) ───────────────────── */

  const initParticles = () => {
    updateThemeColor();
    canvasW = window.innerWidth;
    canvasH = window.innerHeight;
    const count = getMaxParticles();
    particles = new Array(count);
    for (let i = 0; i < count; i++) {
      // Varying sizes for parallax feel (depth)
      const isForeground = Math.random() > 0.8;
      const size = isForeground ? Math.random() * 4 + 3 : Math.random() * 2 + 1;
      const speedMult = isForeground ? 1.5 : 0.6;
      
      particles[i] = {
        x: Math.random() * canvasW,
        y: Math.random() * canvasH,
        vx: (Math.random() - 0.5) * 0.6 * speedMult,
        vy: (Math.random() - 0.5) * 0.6 * speedMult - 0.2, // slight upward drift
        r: size,
        baseAlpha: isForeground ? (Math.random() * 0.4 + 0.3) : (Math.random() * 0.3 + 0.1),
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: Math.random() * 0.02 + 0.01,
      };
    }
  };

  const updateParticles = () => {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.phase += p.phaseSpeed;

      // Wrap around edges softly
      if (p.x < -p.r * 2) p.x = canvasW + p.r;
      else if (p.x > canvasW + p.r * 2) p.x = -p.r;
      
      if (p.y < -p.r * 2) p.y = canvasH + p.r;
      else if (p.y > canvasH + p.r * 2) p.y = -p.r;
    }
  };

  /* ── Rendering ────────────────────────────────── */

  const drawParticles = () => {
    // Draw all particles with standard filled arcs
    ctx.fillStyle = `rgba(${themeColor}, 1)`;
    
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      // Twinkle effect using sine wave on phase
      const alphaMult = 0.7 + Math.sin(p.phase) * 0.3;
      ctx.globalAlpha = p.baseAlpha * alphaMult;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.globalAlpha = 1.0;
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
    ctx = canvas.getContext('2d', { alpha: true });
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

  // Re-init particles on theme change to instantly update colors
  const themeObserver = new MutationObserver(() => {
    updateThemeColor();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  // Also sync on general class changes (for password gate unlocking)
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
