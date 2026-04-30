(() => {
  const CANVAS_ID = 'particles-canvas';
  const MIN_WIDTH = 720;
  const FRAME_INTERVAL = 1000 / 30;
  const MAX_DPR = 1.25;
  const CONNECTION_DISTANCE = 150;
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let canvas;
  let ctx;
  let particles = [];
  let animationFrame = null;
  let resizeTimer = null;
  let lastFrameTime = 0;

  class Particle {
    constructor(width, height) {
      this.size = Math.random() * 2 + 1;
      this.x = Math.random() * (width - this.size * 4) + this.size * 2;
      this.y = Math.random() * (height - this.size * 4) + this.size * 2;
      this.directionX = Math.random() - 0.5;
      this.directionY = Math.random() - 0.5;
      this.color = 'rgba(100, 255, 218, 0.5)';
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
      ctx.fillStyle = this.color;
      ctx.fill();
    }

    update(width, height) {
      if (this.x > width || this.x < 0) this.directionX = -this.directionX;
      if (this.y > height || this.y < 0) this.directionY = -this.directionY;
      this.x += this.directionX;
      this.y += this.directionY;
      this.draw();
    }
  }

  const isUnlocked = () => document.documentElement.classList.contains('site-unlocked');

  const shouldAnimate = () =>
    isUnlocked() &&
    !document.hidden &&
    !reducedMotionQuery.matches &&
    window.innerWidth >= MIN_WIDTH;

  const connectParticles = () => {
    const threshold = CONNECTION_DISTANCE * CONNECTION_DISTANCE;

    for (let a = 0; a < particles.length; a += 1) {
      for (let b = a + 1; b < particles.length; b += 1) {
        const dx = particles[a].x - particles[b].x;
        const dy = particles[a].y - particles[b].y;
        const distance = dx * dx + dy * dy;

        if (distance < threshold) {
          const opacityValue = Math.max(0, 1 - distance / threshold);
          ctx.strokeStyle = `rgba(100, 255, 218, ${opacityValue * 0.2})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(particles[a].x, particles[a].y);
          ctx.lineTo(particles[b].x, particles[b].y);
          ctx.stroke();
        }
      }
    }
  };

  const initParticles = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const amount = Math.min(52, Math.max(18, Math.floor((width * height) / 60000)));
    particles = [];

    for (let i = 0; i < amount; i += 1) {
      particles.push(new Particle(width, height));
    }
  };

  const resizeCanvas = () => {
    if (!canvas || !ctx) return;

    const ratio = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    initParticles();
  };

  const stop = () => {
    if (!animationFrame) return;
    window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
    lastFrameTime = 0;
  };

  const destroyCanvas = () => {
    stop();
    particles = [];
    if (canvas) {
      canvas.remove();
    }
    canvas = null;
    ctx = null;
  };

  const animateParticles = (timestamp = 0) => {
    if (!shouldAnimate()) {
      stop();
      return;
    }

    animationFrame = window.requestAnimationFrame(animateParticles);

    if (timestamp - lastFrameTime < FRAME_INTERVAL) {
      return;
    }

    lastFrameTime = timestamp;
    const width = window.innerWidth;
    const height = window.innerHeight;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i += 1) {
      particles[i].update(width, height);
    }

    connectParticles();
  };

  const ensureCanvas = () => {
    const existing = document.getElementById(CANVAS_ID);
    if (existing) return existing;

    const nextCanvas = document.createElement('canvas');
    nextCanvas.id = CANVAS_ID;
    nextCanvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(nextCanvas);
    return nextCanvas;
  };

  const start = () => {
    if (!shouldAnimate()) {
      destroyCanvas();
      return;
    }

    canvas = ensureCanvas();
    ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
    }

    resizeCanvas();
    animateParticles();
  };

  const sync = () => {
    if (shouldAnimate()) {
      if (!animationFrame) start();
      return;
    }

    destroyCanvas();
  };

  document.addEventListener('visibilitychange', () => {
    sync();
  });

  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!shouldAnimate()) {
        destroyCanvas();
        return;
      }

      if (!canvas) {
        start();
        return;
      }

      resizeCanvas();
    }, 160);
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
