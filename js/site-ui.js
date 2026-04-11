(() => {
  const initNavDropdown = () => {
    const items = Array.from(document.querySelectorAll('#nav .menus_item')).filter(
      (item) => item.querySelector('.site-page.group') && item.querySelector('.menus_item_child')
    );

    if (!items.length) return;

    const closeAll = () => {
      items.forEach((item) => {
        item.classList.remove('is-open');
        const trigger = item.querySelector('.site-page.group');
        if (trigger) {
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
    };

    items.forEach((item) => {
      const trigger = item.querySelector('.site-page.group');
      if (!trigger || trigger.dataset.bound === 'true') return;

      trigger.dataset.bound = 'true';
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('tabindex', '0');
      trigger.setAttribute('aria-expanded', 'false');

      const toggle = () => {
        const nextState = !item.classList.contains('is-open');
        closeAll();
        item.classList.toggle('is-open', nextState);
        trigger.setAttribute('aria-expanded', String(nextState));
      };

      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      });

      trigger.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggle();
      });
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('#nav .menus_item')) {
        closeAll();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeAll();
      }
    });
  };

  const initLinkHero = () => {
    const linkPage = document.querySelector('#body-wrap.type-link');
    const hero = document.querySelector('#page-site-info');
    if (!linkPage || !hero || hero.dataset.enhanced === 'true') return;

    hero.dataset.enhanced = 'true';
    document.body.classList.add('is-link-page');
    hero.innerHTML = `
      <div class="link-hero">
        <div class="link-hero-kicker">你好，我是</div>
        <h1 class="link-hero-name">Alan NOON.</h1>
        <div class="link-hero-role">
          我是一名 <span class="link-hero-typed" id="link-hero-typed"></span><span class="link-hero-cursor">|</span>
        </div>
        <div class="link-hero-meta">狒狒导航 · Feevigation · Tools, links and collected sparks</div>
      </div>
    `;

    const words = ['数字拾荒者', '工具收藏家', '软硬件折腾爱好者', '链接整理控'];
    const target = hero.querySelector('#link-hero-typed');
    if (!target) return;

    let wordIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const tick = () => {
      const current = words[wordIndex];

      if (!deleting) {
        charIndex += 1;
        target.textContent = current.slice(0, charIndex);
        if (charIndex === current.length) {
          deleting = true;
          window.setTimeout(tick, 1600);
          return;
        }
        window.setTimeout(tick, 110);
        return;
      }

      charIndex -= 1;
      target.textContent = current.slice(0, charIndex);
      if (charIndex === 0) {
        deleting = false;
        wordIndex = (wordIndex + 1) % words.length;
      }
      window.setTimeout(tick, deleting ? 55 : 420);
    };

    tick();
  };

  const start = () => {
    initNavDropdown();
    initLinkHero();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
