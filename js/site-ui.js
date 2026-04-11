(() => {
  const PASSWORD_GATE_CONFIG = {
    enabled: true,
    password: 'AlanNOON2026',
    storageKey: 'feespace-password-pass-day',
    skipHosts: ['localhost', '127.0.0.1'],
    title: '进入 Fee Space',
    hint: '请输入访问密码',
    helper: '验证通过后，这台设备在今天之内不需要再次输入。',
  };

  const getTodayStamp = () => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
  };

  const shouldSkipPasswordGate = () =>
    PASSWORD_GATE_CONFIG.skipHosts.includes(window.location.hostname);

  const hasPasswordAccess = () => {
    if (!PASSWORD_GATE_CONFIG.enabled || shouldSkipPasswordGate()) return true;

    try {
      return localStorage.getItem(PASSWORD_GATE_CONFIG.storageKey) === getTodayStamp();
    } catch (error) {
      return false;
    }
  };

  const markPasswordAccess = () => {
    try {
      localStorage.setItem(PASSWORD_GATE_CONFIG.storageKey, getTodayStamp());
    } catch (error) {
      return false;
    }

    return true;
  };

  const unlockSite = () => {
    document.documentElement.classList.remove('site-locked');
    document.documentElement.classList.add('site-unlocked');
    document.body.classList.remove('password-gate-active');
    document.body.classList.add('password-gate-passed');
    document.querySelector('.site-password-gate')?.remove();
  };

  const initPasswordGate = () => {
    if (hasPasswordAccess()) {
      unlockSite();
      return;
    }

    document.documentElement.classList.remove('site-unlocked');
    document.documentElement.classList.add('site-locked');
    document.body.classList.add('password-gate-active');

    if (document.querySelector('.site-password-gate')) return;

    const gate = document.createElement('div');
    gate.className = 'site-password-gate';
    gate.innerHTML = `
      <div class="site-password-gate__shell">
        <div class="site-password-gate__kicker">Fee Space Access</div>
        <h1 class="site-password-gate__title">${PASSWORD_GATE_CONFIG.title}</h1>
        <p class="site-password-gate__copy">这是一个前端密码门禁页，用来挡住随手点进来的访客。</p>
        <form class="site-password-gate__form" novalidate>
          <label class="site-password-gate__label" for="site-password-input">${PASSWORD_GATE_CONFIG.hint}</label>
          <input id="site-password-input" class="site-password-gate__input" type="password" autocomplete="current-password" placeholder="Password" />
          <button class="site-password-gate__button" type="submit">进入主页</button>
          <p class="site-password-gate__helper">${PASSWORD_GATE_CONFIG.helper}</p>
          <p class="site-password-gate__error" aria-live="polite"></p>
        </form>
      </div>
    `;

    document.body.appendChild(gate);

    const form = gate.querySelector('.site-password-gate__form');
    const input = gate.querySelector('.site-password-gate__input');
    const error = gate.querySelector('.site-password-gate__error');

    if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || !error) {
      return;
    }

    window.requestAnimationFrame(() => input.focus());

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      if (input.value === PASSWORD_GATE_CONFIG.password) {
        markPasswordAccess();
        unlockSite();
        return;
      }

      error.textContent = '密码不对，再试一次。';
      gate.classList.remove('is-shaking');
      void gate.offsetWidth;
      gate.classList.add('is-shaking');
      input.select();
    });

    gate.addEventListener('animationend', () => {
      gate.classList.remove('is-shaking');
    });
  };

  const initNavDropdown = () => {
    const items = Array.from(document.querySelectorAll('#nav .menus_item')).filter(
      (item) => item.querySelector('.site-page.group') && item.querySelector('.menus_item_child')
    );

    if (!items.length) return;
    const isHoverMode = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

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

      item.addEventListener('pointerenter', () => {
        if (!isHoverMode()) return;
        closeAll();
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      });

      item.addEventListener('pointerleave', () => {
        if (!isHoverMode()) return;
        item.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      });

      trigger.addEventListener('click', (event) => {
        if (isHoverMode()) return;
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
    initPasswordGate();
    initNavDropdown();
    initLinkHero();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
