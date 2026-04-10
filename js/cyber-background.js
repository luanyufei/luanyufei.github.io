(() => {
  const CANVAS_ID = 'particles-canvas';
  let canvas;
  let ctx;
  let particles = [];
  let animationFrame = null;
  let resizeTimer = null;

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

  const connectParticles = (width, height) => {
    for (let a = 0; a < particles.length; a += 1) {
      for (let b = a; b < particles.length; b += 1) {
        const dx = particles[a].x - particles[b].x;
        const dy = particles[a].y - particles[b].y;
        const distance = dx * dx + dy * dy;
        const threshold = (width / 7) * (height / 7);

        if (distance < threshold) {
          const opacityValue = Math.max(0, 1 - distance / 20000);
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
    const amount = Math.max(24, Math.floor((width * height) / 15000));
    particles = [];

    for (let i = 0; i < amount; i += 1) {
      particles.push(new Particle(width, height));
    }
  };

  const resizeCanvas = () => {
    if (!canvas) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    initParticles();
  };

  const animateParticles = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i += 1) {
      particles[i].update(width, height);
    }

    connectParticles(width, height);
    animationFrame = window.requestAnimationFrame(animateParticles);
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
    canvas = ensureCanvas();
    ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
    }

    resizeCanvas();
    animateParticles();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      return;
    }

    if (!animationFrame && ctx) {
      animateParticles();
    }
  });

  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resizeCanvas, 120);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
