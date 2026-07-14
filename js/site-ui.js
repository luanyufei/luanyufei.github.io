(() => {
  const THEME_KEY = 'theme';
  const THEME_TTL_DAYS = 365;

  const normalizeTheme = (value) => (value === 'light' || value === 'dark' ? value : undefined);

  const readTheme = () => {
    try {
      const butterflyValue = normalizeTheme(window.btf?.saveToLocal?.get?.(THEME_KEY));
      if (butterflyValue) return butterflyValue;

      const raw = localStorage.getItem(THEME_KEY);
      if (!raw) return undefined;

      try {
        const parsed = JSON.parse(raw);
        if (parsed.expiry && Date.now() > parsed.expiry) {
          localStorage.removeItem(THEME_KEY);
          return undefined;
        }
        return normalizeTheme(parsed.value);
      } catch (error) {
        return normalizeTheme(raw);
      }
    } catch (error) {
      return undefined;
    }
  };

  const saveTheme = (theme) => {
    try {
      if (window.btf?.saveToLocal?.set) {
        window.btf.saveToLocal.set(THEME_KEY, theme, THEME_TTL_DAYS);
        return;
      }

      localStorage.setItem(
        THEME_KEY,
        JSON.stringify({
          value: theme,
          expiry: Date.now() + THEME_TTL_DAYS * 86400000,
        })
      );
    } catch (error) {
      // The selected theme still applies to this page when storage is blocked.
    }
  };

  const preferredTheme = () =>
    readTheme() ||
    normalizeTheme(document.documentElement.dataset.theme) ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  const updateThemeButton = (button, theme) => {
    if (!button) return;
    const nextTheme = theme === 'dark' ? '浅色' : '深色';
    button.dataset.theme = theme;
    button.setAttribute('aria-label', `切换到${nextTheme}模式`);
    button.setAttribute('title', `切换到${nextTheme}模式`);
    button.innerHTML = `<i class="fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}" aria-hidden="true"></i>`;
  };

  const applyTheme = (theme, persist = false) => {
    const nextTheme = normalizeTheme(theme) || 'light';

    if (nextTheme === 'dark' && window.btf?.activateDarkMode) {
      window.btf.activateDarkMode();
    } else if (nextTheme === 'light' && window.btf?.activateLightMode) {
      window.btf.activateLightMode();
    } else {
      document.documentElement.dataset.theme = nextTheme;
    }

    if (persist) saveTheme(nextTheme);
    updateThemeButton(document.querySelector('.site-theme-toggle'), nextTheme);
  };

  const initTheme = () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'site-theme-toggle';
    document.body.appendChild(button);

    applyTheme(preferredTheme());

    button.addEventListener('click', () => {
      const current = normalizeTheme(document.documentElement.dataset.theme) || preferredTheme();
      applyTheme(current === 'dark' ? 'light' : 'dark', true);
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
      if (!readTheme()) applyTheme(event.matches ? 'dark' : 'light');
    });
  };

  const updateClock = (clock) => {
    clock.textContent = `CN ${new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date())}`;
  };

  const initNav = () => {
    const nav = document.getElementById('nav');
    const menus = document.getElementById('menus');
    if (!nav || !menus) return;

    const actions = document.createElement('div');
    actions.className = 'nav-actions';
    actions.innerHTML = `
      <span class="site-clock" aria-label="中国标准时间"></span>
      <button class="site-search-toggle" type="button" aria-label="搜索" title="搜索">
        <i class="fas fa-search" aria-hidden="true"></i>
      </button>
      <button class="site-menu-toggle" type="button" aria-label="打开导航" title="导航" aria-expanded="false">
        <i class="fas fa-bars" aria-hidden="true"></i>
      </button>
    `;
    nav.appendChild(actions);

    const clock = actions.querySelector('.site-clock');
    updateClock(clock);
    window.setInterval(() => updateClock(clock), 60000);

    const menuButton = actions.querySelector('.site-menu-toggle');
    menuButton.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('menu-open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
      menuButton.setAttribute('aria-label', isOpen ? '关闭导航' : '打开导航');
      menuButton.innerHTML = `<i class="fas ${isOpen ? 'fa-times' : 'fa-bars'}" aria-hidden="true"></i>`;
    });

    menus.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        nav.classList.remove('menu-open');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-label', '打开导航');
        menuButton.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i>';
      }
    });

    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    menus.querySelectorAll('a.site-page').forEach((link) => {
      const linkPath = new URL(link.href, window.location.origin).pathname.replace(/\/$/, '') || '/';
      if (linkPath === currentPath || (linkPath !== '/' && currentPath.startsWith(`${linkPath}/`))) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }
    });

    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  };

  const stripHtml = (html) => {
    const element = document.createElement('div');
    element.innerHTML = html;
    return (element.textContent || '').replace(/\s+/g, ' ').trim();
  };

  const initSearch = () => {
    const toggle = document.querySelector('.site-search-toggle');
    if (!toggle) return;

    const dialog = document.createElement('dialog');
    dialog.className = 'site-search-dialog';
    dialog.innerHTML = `
      <div class="search-shell">
        <header class="search-head">
          <label for="site-search-input">搜索</label>
          <button class="search-close" type="button" aria-label="关闭搜索" title="关闭">
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </header>
        <input id="site-search-input" class="search-input" type="search" placeholder="搜索文章" autocomplete="off">
        <div class="search-status" aria-live="polite"></div>
        <ol class="search-results"></ol>
      </div>
    `;
    document.body.appendChild(dialog);

    const input = dialog.querySelector('.search-input');
    const results = dialog.querySelector('.search-results');
    const status = dialog.querySelector('.search-status');
    let entries = null;
    let loadingPromise = null;

    const loadEntries = () => {
      if (entries) return Promise.resolve(entries);
      if (loadingPromise) return loadingPromise;

      status.textContent = '正在读取索引…';
      loadingPromise = fetch('/search.xml')
        .then((response) => {
          if (!response.ok) throw new Error(`Search index failed: ${response.status}`);
          return response.text();
        })
        .then((xmlText) => {
          const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
          entries = Array.from(xml.querySelectorAll('entry')).map((entry) => ({
            title: entry.querySelector('title')?.textContent?.trim() || '未命名',
            url: entry.querySelector('url')?.textContent?.trim() || '/',
            content: stripHtml(entry.querySelector('content')?.textContent || ''),
          }));
          status.textContent = '';
          return entries;
        })
        .catch(() => {
          status.textContent = '搜索索引暂时不可用';
          entries = [];
          return entries;
        });

      return loadingPromise;
    };

    const renderResults = (query) => {
      const normalizedQuery = query.trim().toLocaleLowerCase();
      results.replaceChildren();
      if (!normalizedQuery || !entries) {
        status.textContent = '';
        return;
      }

      const terms = normalizedQuery.split(/\s+/).filter(Boolean);
      const matches = entries
        .filter((entry) => {
          const haystack = `${entry.title} ${entry.content}`.toLocaleLowerCase();
          return terms.every((term) => haystack.includes(term));
        })
        .slice(0, 8);

      status.textContent = matches.length ? `${matches.length} 条结果` : '没有找到相关内容';

      matches.forEach((entry, index) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        const number = document.createElement('span');
        const copy = document.createElement('span');
        const title = document.createElement('strong');
        const excerpt = document.createElement('small');

        link.href = entry.url;
        number.className = 'search-result-number';
        number.textContent = String(index + 1).padStart(2, '0');
        copy.className = 'search-result-copy';
        title.textContent = entry.title;
        excerpt.textContent = entry.content.slice(0, 96);
        copy.append(title, excerpt);
        link.append(number, copy);
        item.appendChild(link);
        results.appendChild(item);
      });
    };

    const openSearch = () => {
      if (!dialog.open) dialog.showModal();
      document.documentElement.classList.add('search-open');
      loadEntries().then(() => renderResults(input.value));
      window.requestAnimationFrame(() => input.focus());
    };

    const closeSearch = () => {
      if (dialog.open) dialog.close();
      document.documentElement.classList.remove('search-open');
    };

    toggle.addEventListener('click', openSearch);
    dialog.querySelector('.search-close').addEventListener('click', closeSearch);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeSearch();
    });
    dialog.addEventListener('close', () => document.documentElement.classList.remove('search-open'));
    input.addEventListener('input', () => renderResults(input.value));

    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      if (event.key === '/' && !isTyping && !dialog.open) {
        event.preventDefault();
        openSearch();
      }
    });
  };

  const initReadingProgress = () => {
    const article = document.getElementById('article-container');
    const post = document.getElementById('post');
    if (!article || !post) return;

    const progress = document.createElement('div');
    progress.className = 'reading-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progress);

    let scheduled = false;
    const update = () => {
      const postTop = post.getBoundingClientRect().top + window.scrollY;
      const distance = post.offsetHeight - window.innerHeight * 0.35;
      const value = distance > 0 ? Math.min(1, Math.max(0, (window.scrollY - postTop) / distance)) : 1;
      progress.style.transform = `scaleX(${value})`;
      scheduled = false;
    };

    window.addEventListener('scroll', () => {
      if (!scheduled) {
        scheduled = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  };

  const initKineticTitle = () => {
    const hero = document.querySelector('.feespace-hero');
    const title = hero?.querySelector('.kinetic-title');
    if (!hero || !title || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const coordinates = title.querySelector('[data-kinetic-coordinates]');
    const supportsFinePointer = window.matchMedia('(pointer: fine)').matches;
    let frame = 0;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let pulseTimer = 0;

    const render = () => {
      const x = pointerX - 0.5;
      const y = pointerY - 0.5;
      title.style.setProperty('--kinetic-tilt-x', `${(-y * 9).toFixed(2)}deg`);
      title.style.setProperty('--kinetic-tilt-y', `${(x * 11).toFixed(2)}deg`);
      title.style.setProperty('--kinetic-echo-x', `${(x * 18).toFixed(2)}px`);
      title.style.setProperty('--kinetic-echo-y', `${(y * 12).toFixed(2)}px`);
      title.style.setProperty('--kinetic-scan', `${(pointerY * 76 + 12).toFixed(2)}%`);
      if (coordinates) {
        const xValue = String(Math.round(pointerX * 99)).padStart(2, '0');
        const yValue = String(Math.round(pointerY * 99)).padStart(2, '0');
        coordinates.textContent = `X ${xValue} / Y ${yValue}`;
      }
      frame = 0;
    };

    const pulse = () => {
      window.clearTimeout(pulseTimer);
      title.classList.remove('is-pulsing');
      window.requestAnimationFrame(() => title.classList.add('is-pulsing'));
      pulseTimer = window.setTimeout(() => title.classList.remove('is-pulsing'), 620);
    };

    if (supportsFinePointer) {
      hero.addEventListener('pointermove', (event) => {
        const rect = hero.getBoundingClientRect();
        pointerX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        pointerY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
        if (!frame) frame = window.requestAnimationFrame(render);
      }, { passive: true });

      hero.addEventListener('pointerleave', () => {
        pointerX = 0.5;
        pointerY = 0.5;
        if (!frame) frame = window.requestAnimationFrame(render);
      }, { passive: true });

      title.addEventListener('pointerenter', pulse, { passive: true });
    }
  };

  const initLinkHero = () => {
    const linkPage = document.querySelector('#body-wrap.type-link');
    const hero = document.getElementById('page-site-info');
    if (!linkPage || !hero) return;

    document.body.classList.add('is-link-page');
    hero.innerHTML = `
      <div class="link-hero">
        <p>LINK DIRECTORY / CURATED</p>
        <h1>狒狒导航</h1>
        <div><span>工具</span><span>灵感</span><span>长期收藏</span></div>
      </div>
    `;
  };

  const start = () => {
    initTheme();
    initNav();
    initSearch();
    initReadingProgress();
    initKineticTitle();
    initLinkHero();
    window.requestAnimationFrame(() => document.documentElement.classList.add('site-ready'));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
