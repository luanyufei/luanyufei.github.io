(() => {
  const THEME_KEY = 'theme';
  const THEME_TTL_DAYS = 365;

  const normalizeThemeMode = (value) =>
    value === 'light' || value === 'dark' || value === 'system' ? value : undefined;

  const readThemeMode = () => {
    try {
      const raw = sessionStorage.getItem(THEME_KEY);
      if (!raw) return 'system';

      try {
        const parsed = JSON.parse(raw);
        return normalizeThemeMode(parsed.value) || 'system';
      } catch (error) {
        return normalizeThemeMode(raw) || 'system';
      }
    } catch (error) {
      return 'system';
    }
  };

  const saveThemeMode = (mode) => {
    try {
      localStorage.removeItem(THEME_KEY);

      sessionStorage.setItem(
        THEME_KEY,
        JSON.stringify({
          value: mode,
        })
      );
    } catch (error) {
      // The selected theme still applies to this page when storage is blocked.
    }
  };

  const getSystemTheme = () =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  const resolveTheme = (mode) => {
    if (mode === 'light') return 'light';
    if (mode === 'dark') return 'dark';
    return getSystemTheme();
  };

  const syncThemeColor = (actualTheme) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', actualTheme === 'dark' ? '#0f1111' : '#f3f6f2');
  };

  const updateThemeButton = (button, mode, actualTheme) => {
    if (!button) return;

    let svgIcon = '';
    let label = '跟随系统';
    let nextLabel = '浅色';

    if (mode === 'light') {
      label = '浅色';
      nextLabel = '深色';
      svgIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    } else if (mode === 'dark') {
      label = '深色';
      nextLabel = '跟随系统';
      svgIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    } else {
      label = `跟随系统 (${actualTheme === 'dark' ? '深色' : '浅色'})`;
      nextLabel = '浅色';
      svgIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>';
    }

    button.dataset.themeMode = mode;
    button.dataset.theme = actualTheme;
    button.setAttribute('aria-label', `当前外观：${label}，点击切换为${nextLabel}模式`);
    button.setAttribute('title', `外观：${label} (点击切换为${nextLabel})`);
    button.innerHTML = svgIcon;
  };

  const applyThemeMode = (mode, persist = false) => {
    const validMode = normalizeThemeMode(mode) || 'system';
    const actualTheme = resolveTheme(validMode);

    if (actualTheme === 'dark' && window.btf?.activateDarkMode) {
      window.btf.activateDarkMode();
    } else if (actualTheme === 'light' && window.btf?.activateLightMode) {
      window.btf.activateLightMode();
    } else {
      document.documentElement.dataset.theme = actualTheme;
    }

    if (persist) saveThemeMode(validMode);
    syncThemeColor(actualTheme);
    updateThemeButton(document.querySelector('.site-theme-toggle'), validMode, actualTheme);
  };

  const getNextThemeMode = (currentMode) => {
    if (currentMode === 'system') return 'light';
    if (currentMode === 'light') return 'dark';
    return 'system';
  };

  const initTheme = () => {
    let currentMode = readThemeMode();

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'site-theme-toggle';
    document.body.appendChild(button);

    applyThemeMode(currentMode);

    button.addEventListener('click', () => {
      currentMode = getNextThemeMode(currentMode);
      applyThemeMode(currentMode, true);
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentMode === 'system') {
        applyThemeMode('system');
      }
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

    const articleMenu = menus.querySelector('.menus_item-article');
    const articleMenuTrigger = articleMenu?.querySelector(':scope > .site-page');
    const setArticleMenu = (isOpen) => {
      if (!articleMenu || !articleMenuTrigger) return;
      articleMenu.classList.toggle('dropdown-open', isOpen);
      articleMenuTrigger.setAttribute('aria-expanded', String(isOpen));
    };

    articleMenu?.addEventListener('pointerenter', () => setArticleMenu(true), { passive: true });
    articleMenu?.addEventListener('pointerleave', () => setArticleMenu(false), { passive: true });
    articleMenu?.addEventListener('focusin', () => setArticleMenu(true));
    articleMenu?.addEventListener('focusout', (event) => {
      if (!articleMenu.contains(event.relatedTarget)) setArticleMenu(false);
    });
    articleMenu?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setArticleMenu(false);
        articleMenuTrigger?.focus();
      }
    });

    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    menus.querySelectorAll('a.site-page, a.menu-dropdown-link').forEach((link) => {
      const linkPath = new URL(link.href, window.location.origin).pathname.replace(/\/$/, '') || '/';
      if (linkPath === currentPath || (linkPath !== '/' && currentPath.startsWith(`${linkPath}/`))) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
        if (link.classList.contains('menu-dropdown-link')) {
          articleMenuTrigger?.classList.add('is-active');
        }
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

  const hasHeadingIndex = (rawText) => {
    if (!rawText) return false;
    const text = String(rawText)
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
    if (!text) return false;

    // 1. Chinese section/step prefixes: 第一章, 第1节, 第 2 部分, 步骤 1, 步骤一, 篇一, 其一
    if (/^(?:第\s*[0-9一二三四五六七八九十百千]+\s*[章节部分篇点条步次项]|步骤\s*[0-9一二三四五六七八九十]+|篇\s*[0-9一二三四五六七八九十]+|其\s*[一二三四五六七八九十]+)/i.test(text)) {
      return true;
    }

    // 2. English step/part/case/section prefixes: Step 1, Step 01, Part 1, Case 1, Section 1
    if (/^(?:Step|Part|Case|Section|Item|Phase)\s*[0-9]+[.:：、\s]/i.test(text)) {
      return true;
    }

    // 3. Chinese numerals with brackets or pause mark/dot/colon: 一、, 一., （一）, (一), 【一】, [一]
    if (/^[（(【\[]\s*[一二三四五六七八九十]+\s*[）)】\]]/.test(text)) {
      return true;
    }
    if (/^[一二三四五六七八九十百千万]+[、.．:：\s]/.test(text)) {
      return true;
    }

    // 4. Bracketed digits/letters/Roman: (1), （1）, [1], 【1】, (1.1), (A), [IV]
    if (/^[（(【\[]\s*(?:[0-9]+(?:\.[0-9]+)*|[a-zA-Z]|[ivxIVX]+)\s*[）)】\]][、.．:：\s]?/.test(text)) {
      return true;
    }

    // 5. Circled numbers: ①, ②, ⑴, ⒈
    if (/^[①②③④⑤⑥⑦⑧⑨⑩⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽⒈⒉⒊⒋⒌]/.test(text)) {
      return true;
    }

    // 6. Roman numerals with delimiter: I., II., III., IV., i.
    if (/^(?:[IVXLCDMivxlcdm]+)[.、．:：]\s+/.test(text)) {
      return true;
    }

    // 7. Single letter with delimiter: A., B., A、, a.
    if (/^[A-Za-z][.、．:：]\s+/.test(text)) {
      return true;
    }

    // 8. Hierarchical decimal numbers: 1.1, 1.1.1, 2.4.1 (must NOT be followed by units/words like %, K, M, G, px)
    if (/^[0-9]+(?:\.[0-9]+)+[.、．:：\s]/.test(text)) {
      return true;
    }
    if (/^[0-9]+(?:\.[0-9]+)+$/.test(text)) {
      return true;
    }

    // 9. Single integer with delimiter: 1., 1、, 1:, 1 - (must NOT be 100%, 2K, 3D, 1080P, etc.)
    if (/^[0-9]+[、.．:：]\s*/.test(text)) {
      return true;
    }
    if (/^[0-9]+\s*-\s*[0-9]+/.test(text)) {
      return true;
    }

    return false;
  };

  const initTocCollapsing = () => {
    const toc = document.querySelector('#card-toc .toc-content');
    if (!toc) return;

    // Deduplicate and complete TOC numbering:
    // If the heading text itself already starts with a recognized index/number, remove redundant toc-number.
    toc.querySelectorAll('.toc-link').forEach((link) => {
      const numberSpan = link.querySelector('.toc-number');
      const textSpan = link.querySelector('.toc-text');
      if (!textSpan) return;

      const rawText = textSpan.textContent || '';
      if (hasHeadingIndex(rawText)) {
        if (numberSpan) {
          numberSpan.remove();
        }
      }
    });

    toc.classList.add('is-expand', 'is-user-collapsible');

    toc.querySelectorAll('.toc-item').forEach((item, index) => {
      const child = Array.from(item.children).find((element) => element.classList?.contains('toc-child'));
      const link = Array.from(item.children).find((element) => element.classList?.contains('toc-link'));
      if (!child || !link) return;

      const childId = child.id || `toc-branch-${index + 1}`;
      child.id = childId;
      item.classList.add('has-children');

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'toc-branch-toggle';
      button.setAttribute('aria-expanded', 'true');
      button.setAttribute('aria-controls', childId);
      button.setAttribute('aria-label', `收起 ${link.textContent.trim()}`);
      button.setAttribute('title', '收起下级目录');

      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const isCollapsed = item.classList.toggle('is-collapsed');
        button.setAttribute('aria-expanded', String(!isCollapsed));
        button.setAttribute('aria-label', `${isCollapsed ? '展开' : '收起'} ${link.textContent.trim()}`);
        button.setAttribute('title', isCollapsed ? '展开下级目录' : '收起下级目录');
      });

      item.insertBefore(button, link.nextSibling);
    });

    // Mobile TOC interaction & floating button handling
    const cardToc = document.getElementById('card-toc');

    if (cardToc) {
      // Ensure cardToc is mounted to body on mobile so it escapes any parent stacking context
      let isBodyMounted = false;
      const ensureBodyMounted = () => {
        if (!isBodyMounted && window.innerWidth <= 900) {
          document.body.appendChild(cardToc);
          isBodyMounted = true;
        }
      };

      // Create dedicated floating mobile TOC button if not present
      let mobileTocToggle = document.querySelector('.site-toc-toggle');
      if (!mobileTocToggle) {
        mobileTocToggle = document.createElement('button');
        mobileTocToggle.type = 'button';
        mobileTocToggle.className = 'site-toc-toggle';
        mobileTocToggle.setAttribute('aria-label', '打开目录');
        mobileTocToggle.setAttribute('title', '查看目录');
        mobileTocToggle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>';
        document.body.appendChild(mobileTocToggle);
      }

      // Create mobile backdrop
      let backdrop = document.querySelector('.mobile-toc-backdrop');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'mobile-toc-backdrop';
        document.body.appendChild(backdrop);
      }

      // Add mobile close button in headline if not present
      const headline = cardToc.querySelector('.item-headline');
      if (headline && !headline.querySelector('.mobile-toc-close-btn')) {
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'mobile-toc-close-btn';
        closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        closeBtn.setAttribute('aria-label', '关闭目录');
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          cardToc.classList.remove('open');
          backdrop.classList.remove('show');
        });
        headline.appendChild(closeBtn);
      }

      const toggleMobileToc = (e) => {
        if (e) e.stopPropagation();
        ensureBodyMounted();
        const isOpen = cardToc.classList.toggle('open');
        backdrop.classList.toggle('show', isOpen);
      };

      mobileTocToggle.addEventListener('click', toggleMobileToc);

      backdrop.addEventListener('click', () => {
        cardToc.classList.remove('open');
        backdrop.classList.remove('show');
      });

      // Handle TOC link clicks on desktop and mobile: scroll accurately below navigation bar
      cardToc.addEventListener('click', (e) => {
        const link = e.target.closest('.toc-link');
        if (!link) return;

        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          const targetId = decodeURIComponent(href.slice(1));
          const targetElement = document.getElementById(targetId);
          if (targetElement) {
            e.preventDefault();
            e.stopPropagation();

            const nav = document.getElementById('nav');
            const navHeight = nav ? nav.offsetHeight : 64;
            // Align targetTop so top > heading.offsetTop - 80 is strictly satisfied for the target heading
            const targetTop = targetElement.getBoundingClientRect().top + window.pageYOffset - (navHeight + 6);

            window.scrollTo({
              top: Math.max(0, targetTop),
              behavior: 'smooth'
            });

            // update active link state immediately
            cardToc.querySelectorAll('.toc-link').forEach((l) => l.classList.remove('active'));
            link.classList.add('active');

            if (history.pushState) {
              history.pushState(null, '', href);
            }
          }
        }

        if (window.innerWidth <= 900) {
          setTimeout(() => {
            cardToc.classList.remove('open');
            backdrop.classList.remove('show');
          }, 150);
        }
      });
    }
  };

  const initThreeHero = () => {
    const canvas = document.getElementById('feespace-hero-canvas');
    const hero = document.querySelector('.feespace-hero');
    if (!canvas || !hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    createThreeTitle(canvas, hero);
  };

  // Interactive 3D title (FEE SPACE).
  const createThreeTitle = (canvas, hero) => {
    const instance = { dispose: () => disposeOnce?.() };
    let disposeOnce = null;
    let cancelled = false;

    Promise.all([
      import('three'),
      import('three/addons/loaders/FontLoader.js'),
      import('three/addons/environments/RoomEnvironment.js'),
    ]).then(async ([THREE, { FontLoader }, { RoomEnvironment }]) => {
      if (cancelled || !canvas.isConnected) return;

      const font = await new Promise((resolve, reject) => {
        new FontLoader().load(
          '/data/arial-rounded-bold.typeface.json',
          resolve,
          undefined,
          reject
        );
      });
      if (cancelled || !canvas.isConnected) return;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.22;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 40);
      camera.position.set(0, 0.1, 9.2);

      // A soft studio environment so the metal reads as metal (not black).
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
      pmrem.dispose();

      // One shared glossy metal material, tinted to match the site theme.
      const textMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x9aa3a0,
        metalness: 0.88,
        roughness: 0.28,
        clearcoat: 1,
        clearcoatRoughness: 0.14,
        iridescence: 0.42,
        iridescenceIOR: 1.35,
        envMapIntensity: 0.95,
      });
      let shaderUniforms = null;
      textMaterial.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shaderUniforms = shader.uniforms;
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', 'uniform float uTime;\nvoid main() {')
          .replace(
            '#include <dithering_fragment>',
            `float shimmer = 0.5 + 0.5 * sin(gl_FragCoord.x * 0.014 + gl_FragCoord.y * 0.008 + uTime * 1.1);
            vec3 shimmerColor = mix(vec3(1.0), vec3(0.72, 0.95, 0.6), shimmer);
            outgoingLight = mix(outgoingLight, outgoingLight * shimmerColor, 0.08);
            #include <dithering_fragment>`
          );
      };

      // Per-letter extruded geometry, cached per glyph (F/E/S/P/A/C are reused).
      const unitScale = 1.2 / (font.data.resolution || 2048);
      const letterGeometries = new Map();
      const getLetterGeometry = (char) => {
        if (!letterGeometries.has(char)) {
          const geometry = new THREE.ExtrudeGeometry(font.generateShapes(char, 1.2), {
            depth: 0.32,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.13,
            bevelSize: 0.11,
            bevelSegments: 6,
          });
          geometry.computeBoundingBox();
          letterGeometries.set(char, geometry);
        }
        return letterGeometries.get(char);
      };

      // Two stacked lines, right edges aligned — mirrors the HTML fallback title.
      const letterSpacing = 0.12;
      const lineHeight = (font.data.ascender - font.data.descender) * unitScale;
      const lineGap = lineHeight * 0.16;
      const lines = ['FEE', 'SPACE'].map((word) => {
        const glyphs = Array.from(word).map((char) => ({
          char,
          geometry: getLetterGeometry(char),
          advance: (font.data.glyphs[char]?.ha || 0) * unitScale,
        }));
        let cursor = 0;
        glyphs.forEach((item) => {
          item.x = cursor;
          cursor += item.advance + letterSpacing;
        });
        return { glyphs, width: cursor - letterSpacing };
      });

      const titleGroup = new THREE.Group();
      scene.add(titleGroup);

      const letterMeshes = [];
      lines.forEach((line, lineIndex) => {
        const baselineY = (lineIndex === 0 ? 1 : -1) * (lineHeight + lineGap) * 0.5;
        line.glyphs.forEach((item, index) => {
          const mesh = new THREE.Mesh(item.geometry, textMaterial);
          mesh.position.set(
            item.x - line.width * 0.5,
            baselineY,
            0
          );
          titleGroup.add(mesh);
          mesh.userData = {
            layoutX: mesh.position.x,
            layoutY: mesh.position.y,
          };
          letterMeshes.push(mesh);
        });
      });

      // Center the composition and measure it for fitting.
      const union = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
      letterMeshes.forEach((mesh) => {
        const box = mesh.geometry.boundingBox;
        union.minX = Math.min(union.minX, mesh.position.x + box.min.x);
        union.maxX = Math.max(union.maxX, mesh.position.x + box.max.x);
        union.minY = Math.min(union.minY, mesh.position.y + box.min.y);
        union.maxY = Math.max(union.maxY, mesh.position.y + box.max.y);
      });
      const centerX = (union.minX + union.maxX) * 0.5;
      const centerY = (union.minY + union.maxY) * 0.5;
      letterMeshes.forEach((mesh) => {
        mesh.position.x -= centerX;
        mesh.position.y -= centerY;
        mesh.userData.layoutX = mesh.position.x;
        mesh.userData.layoutY = mesh.position.y;
      });
      union.minX -= centerX;
      union.maxX -= centerX;
      union.minY -= centerY;
      union.maxY -= centerY;

      const textWidth = Math.max(1, union.maxX - union.minX);
      const textHeight = Math.max(1, union.maxY - union.minY);
      const textFitScale = Math.min(0.86, 6 / textWidth, 3.1 / textHeight);
      titleGroup.scale.setScalar(textFitScale);
      const baseY = 0.2;
      let layoutBaseY = baseY;
      titleGroup.position.set(0, baseY, 0);

      const rimLight = new THREE.DirectionalLight(0xffffff, 1.5);
      rimLight.position.set(3, 3.5, 6);
      scene.add(rimLight);

      const accentLight = new THREE.DirectionalLight(0xbdff35, 0.9);
      accentLight.position.set(-4, 2, -2.5);
      scene.add(accentLight);

      const coolLight = new THREE.PointLight(0xa4ef47, 2.2, 14);
      coolLight.position.set(4, -1, 3.5);
      scene.add(coolLight);

      const warmLight = new THREE.PointLight(0xffe0a8, 2, 12);
      warmLight.position.set(-3, -2.5, 3);
      scene.add(warmLight);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x2c322f, 0.4));

      const updateTheme = () => {
        const dark = document.documentElement.dataset.theme === 'dark';
        textMaterial.color.setHex(dark ? 0xaab3b0 : 0x9aa3a0);
        textMaterial.envMapIntensity = dark ? 0.8 : 0.95;
        renderer.toneMappingExposure = dark ? 1.05 : 1.22;
      };

      const easeOutBack = (t) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const x = t - 1;
        return 1 + c3 * x * x * x + c1 * x * x;
      };
      const clamp01 = (value) => Math.min(1, Math.max(0, value));

      const START_DELAY = 0.18;
      const STAGGER = 0.06;
      const RISE_DURATION = 0.8;
      const RISE_DISTANCE = 1.4;
      const entranceTotal = START_DELAY + letterMeshes.length * STAGGER + RISE_DURATION;

      let visible = true;
      let frame = 0;
      let lastFrame = 0;
      let startTime = null;
      let entranceDone = false;
      let pointerX = 0;
      let pointerY = 0;
      let targetX = 0;
      let targetY = 0;
      let draggingLetter = null;
      let dragPointerId = null;
      let dragNdcX = 0;
      let dragNdcY = 0;
      let grabOffsetLocalX = 0;
      let grabOffsetLocalY = 0;

      const raycaster = new THREE.Raycaster();
      const edgeRaycaster = new THREE.Raycaster();
      const dragPoint = new THREE.Vector3();
      const ptLeft = new THREE.Vector3();
      const ptRight = new THREE.Vector3();
      const ptBottom = new THREE.Vector3();
      const ptTop = new THREE.Vector3();

      const getPointerNdc = (eventOrTouch) => ({
        x: (eventOrTouch.clientX / window.innerWidth) * 2 - 1,
        y: -((eventOrTouch.clientY / window.innerHeight) * 2 - 1),
      });

      const raycastLetters = (ndcX, ndcY) => {
        if (!entranceDone) return null;
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
        const hits = raycaster.intersectObjects(letterMeshes, false);
        return hits.length ? hits[0].object : null;
      };

      const render = (time) => {
        frame = 0;
        if (!visible) return;
        if (time - lastFrame < (draggingLetter || !entranceDone ? 0 : 30)) {
          frame = window.requestAnimationFrame(render);
          return;
        }
        const dt = Math.min(0.05, Math.max(0.016, (time - lastFrame) * 0.001));
        lastFrame = time;
        const seconds = time * 0.001;
        if (startTime === null) startTime = seconds;
        if (seconds - startTime >= entranceTotal) entranceDone = true;

        pointerX += (targetX - pointerX) * 0.09;
        pointerY += (targetY - pointerY) * 0.09;

        const elapsed = seconds - startTime;

        // The whole title always tilts toward the pointer, even while dragging.
        titleGroup.rotation.y = -0.06 + Math.sin(seconds * 0.5) * 0.05 + pointerX * 0.22;
        titleGroup.rotation.x = -0.07 + Math.cos(seconds * 0.42) * 0.025 + pointerY * 0.14;
        titleGroup.position.y = layoutBaseY + Math.sin(seconds * 0.7) * 0.03;
        titleGroup.updateMatrixWorld();

        const titlePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0).applyMatrix4(titleGroup.matrixWorld);

        letterMeshes.forEach((mesh, index) => {
          const data = mesh.userData;
          const entrance = clamp01((elapsed - START_DELAY - index * STAGGER) / RISE_DURATION);
          const eased = easeOutBack(entrance);

          if (mesh === draggingLetter) {
            raycaster.setFromCamera(new THREE.Vector2(dragNdcX, dragNdcY), camera);
            if (raycaster.ray.intersectPlane(titlePlane, dragPoint)) {
              const localTarget = dragPoint.clone();
              titleGroup.worldToLocal(localTarget);
              localTarget.x += grabOffsetLocalX;
              localTarget.y += grabOffsetLocalY;

              // Calculate visible viewport boundary on the title's 3D plane
              edgeRaycaster.setFromCamera(new THREE.Vector2(-1.0, dragNdcY), camera);
              edgeRaycaster.ray.intersectPlane(titlePlane, ptLeft);
              titleGroup.worldToLocal(ptLeft);

              edgeRaycaster.setFromCamera(new THREE.Vector2(1.0, dragNdcY), camera);
              edgeRaycaster.ray.intersectPlane(titlePlane, ptRight);
              titleGroup.worldToLocal(ptRight);

              edgeRaycaster.setFromCamera(new THREE.Vector2(dragNdcX, -1.0), camera);
              edgeRaycaster.ray.intersectPlane(titlePlane, ptBottom);
              titleGroup.worldToLocal(ptBottom);

              edgeRaycaster.setFromCamera(new THREE.Vector2(dragNdcX, 1.0), camera);
              edgeRaycaster.ray.intersectPlane(titlePlane, ptTop);
              titleGroup.worldToLocal(ptTop);

              const box = mesh.geometry.boundingBox;
              const boxMinX = box ? box.min.x : 0;
              const boxMaxX = box ? box.max.x : 0;
              const boxMinY = box ? box.min.y : 0;
              const boxMaxY = box ? box.max.y : 0;

              const minX = Math.min(ptLeft.x, ptRight.x) - boxMinX;
              const maxX = Math.max(ptLeft.x, ptRight.x) - boxMaxX;
              const minY = Math.min(ptBottom.y, ptTop.y) - boxMinY;
              const maxY = Math.max(ptBottom.y, ptTop.y) - boxMaxY;

              const clampedX = Math.max(minX, Math.min(maxX, localTarget.x));
              const clampedY = Math.max(minY, Math.min(maxY, localTarget.y));

              data.layoutX = clampedX;
              data.layoutY = clampedY;
              mesh.position.x = clampedX;
              mesh.position.y = clampedY;
              mesh.position.z = 0;
            }
            return;
          }

          if (entrance < 1) {
            mesh.position.x = data.layoutX;
            mesh.position.y = data.layoutY - RISE_DISTANCE * (1 - eased);
            mesh.position.z = 0;
            mesh.rotation.x = -1.15 * (1 - eased);
            mesh.rotation.z = (index % 2 === 0 ? 0.32 : -0.32) * (1 - eased);
            mesh.scale.setScalar(0.86 + 0.14 * eased);
          } else {
            const idleT = seconds + index * 1.1;
            mesh.position.x = data.layoutX;
            mesh.position.y = data.layoutY + Math.sin(idleT * 0.85) * 0.045;
            mesh.position.z = 0;
            mesh.rotation.x = 0;
            mesh.rotation.z = Math.sin(idleT * 0.55 + 1.4) * 0.03;
            mesh.scale.setScalar(1);
          }
        });

        if (shaderUniforms?.uTime) shaderUniforms.uTime.value = seconds;
        coolLight.position.x = 4 + pointerX * 2.4;
        coolLight.position.y = 1.5 - pointerY * 1.8;
        renderer.render(scene, camera);
        frame = window.requestAnimationFrame(render);
      };

      const requestRender = () => {
        if (!frame) frame = window.requestAnimationFrame(render);
      };

      const resize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const aspect = width / Math.max(height, 1);
        camera.aspect = aspect;
        camera.position.z = 10.2;

        // Calculate visible viewport dimensions at z=0 plane
        const vFOV = (camera.fov * Math.PI) / 180;
        const visibleHeight = 2 * Math.tan(vFOV / 2) * camera.position.z;
        const visibleWidth = visibleHeight * aspect;

        // Ensure title width fits within ~82% of viewport width on narrow screens,
        // and scales appropriately on desktop screens.
        let fitScale;
        if (aspect < 1.1) {
          fitScale = Math.min((visibleWidth * 0.82) / textWidth, (visibleHeight * 0.38) / textHeight);
          layoutBaseY = baseY + 0.1;
        } else {
          fitScale = Math.min(0.86, 6 / textWidth, (visibleHeight * 0.55) / textHeight);
          layoutBaseY = baseY;
        }

        titleGroup.scale.setScalar(fitScale);
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        requestRender();
      };

      const setGlobalCursor = (cursorStyle) => {
        document.body.style.cursor = cursorStyle;
        hero.style.cursor = cursorStyle;
      };

      const onPointerDown = (event) => {
        if (!entranceDone || !visible) return;
        const ndc = getPointerNdc(event);
        const hit = raycastLetters(ndc.x, ndc.y);
        if (!hit) return;

        if (event.cancelable) {
          event.preventDefault();
        }

        draggingLetter = hit;
        dragPointerId = event.pointerId;
        dragNdcX = ndc.x;
        dragNdcY = ndc.y;
        targetX = ndc.x;
        targetY = ndc.y;
        hit.rotation.set(0, 0, 0);
        hit.scale.setScalar(1);

        titleGroup.updateMatrixWorld();
        const titlePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0).applyMatrix4(titleGroup.matrixWorld);
        raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
        if (raycaster.ray.intersectPlane(titlePlane, dragPoint)) {
          const localHit = dragPoint.clone();
          titleGroup.worldToLocal(localHit);
          grabOffsetLocalX = hit.position.x - localHit.x;
          grabOffsetLocalY = hit.position.y - localHit.y;
        } else {
          grabOffsetLocalX = 0;
          grabOffsetLocalY = 0;
        }

        if (event.pointerType === 'mouse') {
          setGlobalCursor('grabbing');
        }
        document.body.style.userSelect = 'none';
        requestRender();
      };

      const onPointerMove = (event) => {
        const ndc = getPointerNdc(event);
        targetX = (event.clientX / window.innerWidth) * 2 - 1;
        targetY = (event.clientY / window.innerHeight) * 2 - 1;

        if (draggingLetter && (dragPointerId === null || event.pointerId === dragPointerId)) {
          if (event.cancelable) {
            event.preventDefault();
          }
          dragNdcX = ndc.x;
          dragNdcY = ndc.y;
        } else if (!draggingLetter && event.pointerType === 'mouse') {
          if (visible && entranceDone && raycastLetters(ndc.x, ndc.y)) {
            setGlobalCursor('grab');
          } else {
            setGlobalCursor('');
          }
        }
        requestRender();
      };

      const endDrag = (event) => {
        if (draggingLetter === null) return;
        if (event?.pointerId !== undefined && dragPointerId !== null && event.pointerId !== dragPointerId) return;
        draggingLetter = null;
        dragPointerId = null;
        grabOffsetLocalX = 0;
        grabOffsetLocalY = 0;
        setGlobalCursor('');
        document.body.style.userSelect = '';
        requestRender();
      };

      const onTouchStart = (event) => {
        if (!entranceDone || !visible || event.touches.length !== 1) return;
        const touch = event.touches[0];
        const ndc = getPointerNdc(touch);
        const hit = raycastLetters(ndc.x, ndc.y);
        if (hit) {
          if (event.cancelable) {
            event.preventDefault();
          }
          draggingLetter = hit;
          dragPointerId = touch.identifier ?? 'touch';
          dragNdcX = ndc.x;
          dragNdcY = ndc.y;
          targetX = ndc.x;
          targetY = ndc.y;
          hit.rotation.set(0, 0, 0);
          hit.scale.setScalar(1);

          titleGroup.updateMatrixWorld();
          const titlePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0).applyMatrix4(titleGroup.matrixWorld);
          raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
          if (raycaster.ray.intersectPlane(titlePlane, dragPoint)) {
            const localHit = dragPoint.clone();
            titleGroup.worldToLocal(localHit);
            grabOffsetLocalX = hit.position.x - localHit.x;
            grabOffsetLocalY = hit.position.y - localHit.y;
          } else {
            grabOffsetLocalX = 0;
            grabOffsetLocalY = 0;
          }
          requestRender();
        }
      };

      const onTouchMove = (event) => {
        if (draggingLetter && event.touches.length === 1) {
          if (event.cancelable) {
            event.preventDefault();
          }
          const touch = event.touches[0];
          targetX = (touch.clientX / window.innerWidth) * 2 - 1;
          targetY = (touch.clientY / window.innerHeight) * 2 - 1;
          dragNdcX = (touch.clientX / window.innerWidth) * 2 - 1;
          dragNdcY = -((touch.clientY / window.innerHeight) * 2 - 1);
          requestRender();
        }
      };

      const clearCursor = () => {
        if (!draggingLetter) {
          setGlobalCursor('');
        }
      };

      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) {
          clearCursor();
        }
        if (visible) requestRender();
      });
      const themeObserver = new MutationObserver(() => {
        updateTheme();
        requestRender();
      });

      window.addEventListener('pointerdown', onPointerDown, { passive: false });
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
      window.addEventListener('blur', endDrag);

      window.addEventListener('touchstart', onTouchStart, { passive: false });
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', endDrag, { passive: true });
      window.addEventListener('touchcancel', endDrag, { passive: true });

      window.addEventListener('resize', resize, { passive: true });
      observer.observe(hero);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      hero.classList.add('webgl-ready');
      updateTheme();
      resize();
      requestRender();

      disposeOnce = () => {
        cancelled = true;
        if (frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
        window.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', endDrag);
        window.removeEventListener('pointercancel', endDrag);
        window.removeEventListener('blur', endDrag);

        window.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', endDrag);
        window.removeEventListener('touchcancel', endDrag);

        window.removeEventListener('resize', resize);
        observer.disconnect();
        themeObserver.disconnect();
        hero.classList.remove('webgl-ready');
        setGlobalCursor('');
        hero.style.cursor = '';
        letterGeometries.forEach((geometry) => geometry.dispose());
        textMaterial.dispose();
        renderer.dispose();
        canvas.hidden = true;
      };
    }).catch((error) => {
      canvas.hidden = true;
      console.warn('3D title unavailable.', error);
    });

    return instance;
  };

  const initPixelTrail = () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    if (reduceMotion || !finePointer) return;

    const CELL_SIZE = 16;
    const CELL_INSET = 1;
    const MAX_CELLS = 14;
    const FADE_RATE = 2;
    const MIN_STRENGTH = 0.025;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    canvas.className = 'pixel-grid-trail';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    const cells = [];
    let lastCell = null;
    let frame = 0;
    let lastFrameTime = performance.now();
    let devicePixelRatio = 1;

    const resize = () => {
      devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(window.innerWidth * devicePixelRatio);
      canvas.height = Math.ceil(window.innerHeight * devicePixelRatio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };

    const addCell = (column, row) => {
      const duplicateIndex = cells.findIndex(
        (cell) => cell.column === column && cell.row === row
      );
      if (duplicateIndex >= 0) cells.splice(duplicateIndex, 1);
      cells.unshift({ column, row, strength: 1 });
      if (cells.length > MAX_CELLS) cells.length = MAX_CELLS;
    };

    const addCrossedCells = (from, to) => {
      const columnDistance = to.column - from.column;
      const rowDistance = to.row - from.row;
      const steps = Math.max(Math.abs(columnDistance), Math.abs(rowDistance));

      for (let step = 1; step <= steps; step += 1) {
        const ratio = step / steps;
        const column = Math.round(from.column + columnDistance * ratio);
        const row = Math.round(from.row + rowDistance * ratio);
        const previous = cells[0];
        if (!previous || previous.column !== column || previous.row !== row) {
          addCell(column, row);
        }
      }
    };

    const render = (time) => {
      const delta = Math.min((time - lastFrameTime) / 1000, 0.05);
      lastFrameTime = time;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      context.fillStyle = '#c0fe04';

      cells.forEach((cell) => {
        cell.strength *= Math.exp(-FADE_RATE * delta);
        context.globalAlpha = Math.min(0.96, cell.strength);
        context.fillRect(
          cell.column * CELL_SIZE + CELL_INSET,
          cell.row * CELL_SIZE + CELL_INSET,
          CELL_SIZE - CELL_INSET * 2,
          CELL_SIZE - CELL_INSET * 2
        );
      });

      context.globalAlpha = 1;
      while (cells.at(-1)?.strength < MIN_STRENGTH) cells.pop();

      if (cells.length) {
        frame = window.requestAnimationFrame(render);
      } else {
        frame = 0;
        lastCell = null;
      }
    };

    const wake = () => {
      if (frame) return;
      lastFrameTime = performance.now();
      frame = window.requestAnimationFrame(render);
    };

    document.addEventListener('pointermove', (event) => {
      if (!event.isPrimary) return;
      const currentCell = {
        column: Math.floor(event.clientX / CELL_SIZE),
        row: Math.floor(event.clientY / CELL_SIZE),
      };

      if (!lastCell) {
        addCell(currentCell.column, currentCell.row);
      } else if (
        lastCell.column !== currentCell.column ||
        lastCell.row !== currentCell.row
      ) {
        addCrossedCells(lastCell, currentCell);
      }

      lastCell = currentCell;
      wake();
    }, { passive: true });

    document.addEventListener('pointerleave', () => {
      lastCell = null;
    }, { passive: true });
    window.addEventListener('blur', () => {
      lastCell = null;
    }, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    resize();
  };

  const PIXEL_NOTES = [
    'Welcome to FEE SPACE!!',
    'Notes, tools, observations & more!',
    'Do not drag the letters!',
  ];

  const initPixelNote = () => {
    const note = document.querySelector('.hero-pixel-note');
    if (!note) return;

    note.textContent = PIXEL_NOTES[Math.floor(Math.random() * PIXEL_NOTES.length)];
  };

  const initHomeTransition = () => {
    const heroHeader = document.querySelector('#page-header.full_page');
    const collection = document.querySelector('#recent-posts .collection-head');
    const content = document.getElementById('content-inner');
    if (!heroHeader || !collection || !content) return;

    document.body.classList.add('is-home-page');
    document.documentElement.classList.add('home-snap');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('scroll-down')?.addEventListener('click', () => {
      content.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });

    if (reduceMotion) {
      document.body.classList.add('collection-is-visible');
      return;
    }

    let frame = 0;
    const render = () => {
      const distance = Math.max(1, window.innerHeight * 0.82);
      const progress = Math.min(1, Math.max(0, window.scrollY / distance));
      document.documentElement.style.setProperty('--home-shift', `${(-progress * 54).toFixed(2)}px`);
      document.documentElement.style.setProperty('--home-scale', (1 - progress * 0.045).toFixed(4));
      document.documentElement.style.setProperty('--home-opacity', (1 - progress * 0.72).toFixed(3));
      document.documentElement.style.setProperty('--home-wipe-scale', progress.toFixed(3));
      if (progress > 0.68) document.body.classList.add('collection-is-visible');
      frame = 0;
    };

    window.addEventListener('scroll', () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    }, { passive: true });
    window.addEventListener('resize', render, { passive: true });
    render();

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        document.body.classList.add('collection-is-visible');
        observer.disconnect();
      }
    }, { threshold: 0.18 });
    observer.observe(collection);
  };

  const initTrendPage = () => {
    const trendPage = document.querySelector('#body-wrap.type-shuoshuo');
    const container = trendPage?.querySelector('#article-container');
    if (!trendPage) return;

    if (!container || container.children.length) return;

    container.innerHTML = `
      <section class="trend-empty">
        <div class="trend-signal" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <p>STATUS / READY</p>
        <h2>还没长成文章的，<br>先在这里发生。</h2>
        <div class="trend-empty-copy">短想法、临时发现和随手分享都会留在这里，像一块更安静的个人空间。</div>
        <span>等待第一条动态</span>
      </section>
    `;
  };

  const initPageHero = () => {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    let tag = '';
    let title = '';

    if (path.startsWith('/trend')) {
      tag = 'MOMENTS & SHORTS';
      title = 'FeeFee动态';
      document.body.classList.add('is-trend-page');
    } else if (path.startsWith('/link')) {
      tag = 'LINK DIRECTORY';
      title = '狒狒导航';
      document.body.classList.add('is-link-page');
    } else if (path.startsWith('/projects')) {
      tag = 'PORTFOLIO & SHOWCASE';
      title = '项目';
      document.body.classList.add('is-projects-page');
    } else if (path.startsWith('/about')) {
      tag = 'CURRICULUM VITAE';
      title = '个人履历';
      document.body.classList.add('is-about-page');
    } else if (path.startsWith('/music')) {
      tag = 'MUSIC & SOUNDTRACKS';
      title = '狒狒音乐盒';
      document.body.classList.add('is-music-page');
    } else if (path.startsWith('/archives')) {
      tag = 'ARCHIVES / COLLECTION';
      title = '全部文章';
    } else if (path.startsWith('/categories')) {
      tag = 'CATEGORIES / INDEX';
      title = '分类';
    } else if (path.startsWith('/tags')) {
      tag = 'TAGS / INDEX';
      title = '标签';
    }

    const postInfo = document.getElementById('post-info');
    if (postInfo) {
      if (!postInfo.querySelector('.fs-hero-tag')) {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'fs-hero-tag';
        tagSpan.textContent = 'NOTE & ARTICLE';
        postInfo.insertBefore(tagSpan, postInfo.firstChild);
      }
      return;
    }

    const hero = document.getElementById('page-site-info');
    if (!hero) return;

    if (hero.querySelector('.fs-unified-hero')) return;

    if (tag && title) {
      hero.innerHTML = `
        <div class="fs-unified-hero">
          <span class="fs-hero-tag">${tag}</span>
          <h1 class="fs-hero-title">${title}</h1>
        </div>
      `;
    } else {
      const siteTitle = hero.querySelector('#site-title, .fs-hero-title');
      if (siteTitle) {
        hero.innerHTML = `
          <div class="fs-unified-hero">
            <span class="fs-hero-tag">INDEX / COLLECTION</span>
            <h1 class="fs-hero-title">${siteTitle.textContent.trim()}</h1>
          </div>
        `;
      }
    }
  };

  const initLightbox = () => {
    let overlay = null;
    let viewImg = null;
    let state = null;
    let activePointerId = null;

    const applyTransform = (withTransition = false) => {
      if (!viewImg || !state) return;
      if (withTransition) {
        viewImg.style.transition = 'transform 0.32s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      } else {
        viewImg.style.transition = 'none';
      }
      viewImg.style.transform = `translate3d(${state.x}px, ${state.y}px, 0px) rotate(${state.r}deg) scale(${state.s})`;
    };

    const open = (srcImg) => {
      if (overlay) return;
      const src = srcImg.dataset.lazySrc || srcImg.src;
      if (!src || src.startsWith('data:')) return;

      state = { x: 0, y: 0, r: 0, s: 0.6 };

      overlay = document.createElement('div');
      overlay.className = 'fs-custom-lightbox';

      viewImg = document.createElement('img');
      viewImg.className = 'fs-custom-lightbox-img';
      viewImg.src = src;
      viewImg.alt = srcImg.alt || '';
      viewImg.draggable = false;

      overlay.appendChild(viewImg);
      document.body.appendChild(overlay);
      document.body.classList.add('fs-lightbox-active');

      applyTransform(false);

      void overlay.offsetWidth;

      requestAnimationFrame(() => {
        overlay.classList.add('is-open');
        state.s = 1.0;
        applyTransform(true);
      });

      setTimeout(() => {
        if (viewImg) viewImg.style.transition = 'none';
      }, 330);

      overlay.addEventListener('contextmenu', handleContextMenu);
      overlay.addEventListener('auxclick', handleAuxClick);
      overlay.addEventListener('pointerdown', handlePointerDown);
      overlay.addEventListener('pointermove', handlePointerMove);
      overlay.addEventListener('pointerup', handlePointerUp);
      overlay.addEventListener('pointercancel', handlePointerUp);
      overlay.addEventListener('touchstart', handleTouchStart, { passive: false });
      overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
      overlay.addEventListener('touchend', handleTouchEnd, { passive: false });
      overlay.addEventListener('touchcancel', handleTouchEnd, { passive: false });
      overlay.addEventListener('wheel', handleWheel, { passive: false });
      document.addEventListener('keydown', handleKeyDown);
    };

    const close = () => {
      if (!overlay) return;
      document.body.classList.remove('fs-lightbox-dragging');
      const currentOverlay = overlay;
      const currentImg = viewImg;
      overlay = null;
      viewImg = null;
      state = null;

      currentOverlay.classList.remove('is-open');
      currentOverlay.classList.add('is-closing');

      if (currentImg) {
        currentImg.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease';
        currentImg.style.transform = `translate3d(0px, 0px, 0px) rotate(0deg) scale(0.6)`;
        currentImg.style.opacity = '0';
      }

      document.removeEventListener('keydown', handleKeyDown);

      setTimeout(() => {
        currentOverlay.remove();
        document.body.classList.remove('fs-lightbox-active');
      }, 260);
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
      close();
    };

    const handleAuxClick = (e) => {
      if (e.button === 1 || e.button === 2) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };

    let isPointerDown = false;
    let dragButton = -1;
    let startX = 0;
    let startY = 0;
    let startStateX = 0;
    let startStateY = 0;
    let startStateR = 0;
    let startStateS = 0;
    let startAngle = 0;
    let movedDistance = 0;

    // Mobile touch gesture state
    let initialTouchDist = 0;
    let initialTouchAngle = 0;
    let initialTouchStateS = 1;
    let initialTouchStateR = 0;
    let initialTouchStateX = 0;
    let initialTouchStateY = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let isTouchActive = false;
    let isMultiTouch = false;

    const getTouchDist = (t1, t2) => {
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      return Math.hypot(dx, dy);
    };

    const getTouchAngle = (t1, t2) => {
      return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
    };

    const handleTouchStart = (e) => {
      if (!state) return;
      if (e.touches.length === 1) {
        isTouchActive = true;
        isMultiTouch = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        initialTouchStateX = state.x;
        initialTouchStateY = state.y;
        movedDistance = 0;
      } else if (e.touches.length === 2) {
        isTouchActive = true;
        isMultiTouch = true;
        initialTouchDist = getTouchDist(e.touches[0], e.touches[1]);
        initialTouchAngle = getTouchAngle(e.touches[0], e.touches[1]);
        initialTouchStateS = state.s;
        initialTouchStateR = state.r;
        initialTouchStateX = state.x;
        initialTouchStateY = state.y;
        touchStartX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        touchStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    };

    const handleTouchMove = (e) => {
      if (!isTouchActive || !state) return;
      e.preventDefault();

      if (e.touches.length === 1 && !isMultiTouch) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        movedDistance += Math.hypot(dx, dy);
        state.x = initialTouchStateX + dx;
        state.y = initialTouchStateY + dy;
        applyTransform(false);
      } else if (e.touches.length === 2) {
        const currentDist = getTouchDist(e.touches[0], e.touches[1]);
        const currentAngle = getTouchAngle(e.touches[0], e.touches[1]);
        const currentMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const currentMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        if (initialTouchDist > 0) {
          const scaleRatio = currentDist / initialTouchDist;
          state.s = Math.max(0.1, Math.min(20, initialTouchStateS * scaleRatio));
        }

        const deltaAngle = currentAngle - initialTouchAngle;
        const rawR = initialTouchStateR + deltaAngle;
        const snapTarget = Math.round(rawR / 90) * 90;
        if (Math.abs(rawR - snapTarget) < 4.5) {
          state.r = snapTarget;
        } else {
          state.r = rawR;
        }

        state.x = initialTouchStateX + (currentMidX - touchStartX);
        state.y = initialTouchStateY + (currentMidY - touchStartY);

        applyTransform(false);
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length === 0) {
        if (!isMultiTouch && movedDistance < 5 && e.target === overlay) {
          close();
        }
        isTouchActive = false;
        isMultiTouch = false;
      } else if (e.touches.length === 1) {
        isMultiTouch = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        initialTouchStateX = state.x;
        initialTouchStateY = state.y;
      }
    };

    const handlePointerDown = (e) => {
      if (e.pointerType === 'touch') return;
      if (!state || isPointerDown) return;
      if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;

      if (e.button === 2) {
        e.preventDefault();
        close();
        return;
      }

      e.preventDefault();
      isPointerDown = true;
      dragButton = e.button;
      activePointerId = e.pointerId;
      try { overlay.setPointerCapture(e.pointerId); } catch (err) {}

      document.body.classList.add('fs-lightbox-dragging');
      if (overlay) overlay.classList.add('is-dragging');

      startX = e.clientX;
      startY = e.clientY;
      startStateX = state.x;
      startStateY = state.y;
      startStateR = state.r;
      startStateS = state.s;
      movedDistance = 0;

      const rect = overlay.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

      if (viewImg) {
        viewImg.style.transition = 'none';
        viewImg.classList.add('is-dragging');
      }
    };

    const handlePointerMove = (e) => {
      if (e.pointerType === 'touch') return;
      if (!isPointerDown || !state) return;
      e.preventDefault();

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      movedDistance += Math.hypot(dx, dy);

      if (dragButton === 0) {
        state.x = startStateX + dx;
        state.y = startStateY + dy;
        applyTransform(false);
      } else if (dragButton === 1) {
        const rect = overlay.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

        const rawR = startStateR + (currentAngle - startAngle);
        const snapTarget = Math.round(rawR / 90) * 90;
        if (Math.abs(rawR - snapTarget) < 4.5) {
          state.r = snapTarget;
        } else {
          state.r = rawR;
        }

        applyTransform(false);
      }
    };

    const handlePointerUp = (e) => {
      if (e.pointerType === 'touch') return;
      if (!isPointerDown) return;

      document.body.classList.remove('fs-lightbox-dragging');
      if (overlay) overlay.classList.remove('is-dragging');

      if (activePointerId !== null && overlay && overlay.hasPointerCapture && overlay.hasPointerCapture(activePointerId)) {
        try { overlay.releasePointerCapture(activePointerId); } catch (err) {}
      }

      if (viewImg) viewImg.classList.remove('is-dragging');

      if (dragButton === 0 && movedDistance < 5 && e.target === overlay) {
        close();
      }

      isPointerDown = false;
      dragButton = -1;
      activePointerId = null;
    };


    const handleWheel = (e) => {
      if (!state) return;
      e.preventDefault();

      const factor = e.deltaY < 0 ? 1.15 : 0.85;
      state.s = Math.max(0.1, Math.min(20, state.s * factor));
      applyTransform(false);
    };

    const bind = () => {
      document.querySelectorAll('#article-container img:not(.no-lightbox)').forEach((img) => {
        if (img.dataset.fsLightboxBound) return;
        img.dataset.fsLightboxBound = 'true';
        img.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          open(img);
        });
      });
    };

    bind();
    if (window.lazyLoadInstance) {
      const origUpdate = window.lazyLoadInstance.update.bind(window.lazyLoadInstance);
      window.lazyLoadInstance.update = (...args) => {
        origUpdate(...args);
        setTimeout(bind, 200);
      };
    }
  };


  const start = () => {
    initTheme();
    initNav();
    initSearch();
    initReadingProgress();
    initTocCollapsing();
    initThreeHero();
    initPixelNote();
    initPixelTrail();
    initHomeTransition();
    initPageHero();
    initTrendPage();
    initLightbox();
    window.requestAnimationFrame(() => document.documentElement.classList.add('site-ready'));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
