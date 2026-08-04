/* ============================================================
   Footer Brand Injection Script
   Injects "FeeFeeNOON" text before the Butterfly footer
   Adds a collapsible AI credit inside framework-info
   right below Hexo|Butterfly
   ============================================================ */
(() => {
  'use strict';

  // Model credit list. Rendered sorted alphabetically (case-insensitive),
  // so the order here does not matter — new models can be appended anywhere.
  // Each entry: { name, url }
  const AI_MODELS = [
    { name: 'Claude Opus 4.6',   url: 'https://claude.ai' },
    { name: 'DeepSeek V4 Flash', url: 'https://chat.deepseek.com' },
    { name: 'Gemini 3.1 Pro',    url: 'https://gemini.google.com' },
    { name: 'Gemini 3.5 Flash',  url: 'https://gemini.google.com' },
    { name: 'Gemini 3.6 Flash',  url: 'https://gemini.google.com' },
    { name: 'GPT 5.6 Luna',      url: 'https://chatgpt.com' },
    { name: 'GPT 5.6 Sol',       url: 'https://chatgpt.com' },
    { name: 'GPT 5.6 Terra',     url: 'https://chatgpt.com' },
  ];

  function createBrandSection() {
    const section = document.createElement('div');
    section.className = 'footer-brand-section';
    section.setAttribute('aria-hidden', 'true');

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'footer-brand-svg');
    svg.setAttribute('viewBox', '0 0 810 140');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '140');
    svg.setAttribute('aria-label', 'FeeFeeNOON');

    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', '50%');
    text.setAttribute('y', '108');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'footer-brand-text');
    text.textContent = 'FeeFeeNOON';

    svg.appendChild(text);
    section.appendChild(svg);
    return section;
  }

  function injectAiInfo() {
    const frameworkInfo = document.querySelector('#footer-wrap .framework-info');
    if (!frameworkInfo || document.querySelector('.powered-by-ai')) return;

    const models = AI_MODELS.slice().sort(
      (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'en')
    );
    const headline = models[0];

    const aiInfo = document.createElement('div');
    aiInfo.className = 'powered-by-ai';

    const label = document.createElement('span');
    label.className = 'ai-powered-label';
    label.textContent = 'Powered by';

    const headlineEl = document.createElement('span');
    headlineEl.className = 'ai-model ai-model-headline';
    headlineEl.textContent = headline.name;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ai-models-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = `+${models.length - 1}`;

    const pop = document.createElement('div');
    pop.className = 'ai-models-pop';
    pop.id = 'ai-models-pop';

    const listEl = document.createElement('ul');
    listEl.className = 'ai-models-pop-list';
    models.forEach((model) => {
      const item = document.createElement('li');
      item.className = 'ai-models-pop-item';
      if (model.name === headline.name) item.classList.add('is-current');

      const link = document.createElement('a');
      link.href = model.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = model.name;
      link.className = 'ai-model-link';

      item.appendChild(link);
      listEl.appendChild(item);
    });
    pop.appendChild(listEl);

    aiInfo.append(label, headlineEl, toggle, pop);
    frameworkInfo.appendChild(aiInfo);
    toggle.setAttribute('aria-controls', pop.id);

    let hideTimer = null;
    const isOpen = () => pop.classList.contains('is-open');
    const open = () => {
      window.clearTimeout(hideTimer);
      pop.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.textContent = '×';
    };
    const close = () => {
      window.clearTimeout(hideTimer);
      pop.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = `+${models.length - 1}`;
    };
    const scheduleClose = () => {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(close, 150);
    };

    // Hover opens the popover (desktop); touch falls back to a tap.
    if (window.matchMedia('(hover: hover)').matches) {
      aiInfo.addEventListener('mouseenter', open);
      aiInfo.addEventListener('mouseleave', scheduleClose);
      toggle.addEventListener('focus', open);
      toggle.addEventListener('blur', scheduleClose);
    }
    toggle.addEventListener('click', () => {
      if (isOpen()) close();
      else open();
    });
    document.addEventListener('pointerdown', (event) => {
      if (!event.target.closest('.powered-by-ai')) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  }

  function inject() {
    const footer = document.getElementById('footer');
    if (!footer) return;

    if (!footer.parentNode.querySelector('.footer-brand-section')) {
      const brandSection = createBrandSection();
      footer.parentNode.insertBefore(brandSection, footer);

      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
        );
        observer.observe(brandSection);
      } else {
        brandSection.classList.add('is-visible');
      }
    }

    injectAiInfo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
