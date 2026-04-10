(() => {
  const NAV_ID = 'cyber-nav-shell';
  const MOBILE_BREAKPOINT = 900;
  const NAV_ITEMS = [
    { label: '首页', href: '/', icon: 'fas fa-house' },
    { label: '分类', href: '/categories/', icon: 'fas fa-folder-open' },
    {
      label: '列表',
      href: '/link/',
      icon: 'fas fa-table-list',
      children: [
        { label: '音乐', href: '/music/' },
        { label: '视频', href: '/movies/' },
      ],
    },
    { label: '时间轴', href: '/archives/', icon: 'fas fa-box-archive' },
    { label: '标签', href: '/tags/', icon: 'fas fa-tags' },
    { label: '链接', href: '/link/', icon: 'fas fa-link' },
    { label: '关于', href: '/about/', icon: 'fas fa-heart' },
  ];

  const createItem = (item, mobile = false) => {
    if (!item.children || mobile) {
      const link = document.createElement('a');
      link.className = mobile ? 'cyber-nav-mobile-link' : 'cyber-nav-link';
      link.href = item.href;
      link.innerHTML = `<i class="${item.icon}"></i><span>${item.label}</span>`;
      return link;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'cyber-nav-group';

    const trigger = document.createElement('button');
    trigger.className = 'cyber-nav-link cyber-nav-trigger';
    trigger.type = 'button';
    trigger.innerHTML = `<i class="${item.icon}"></i><span>${item.label}</span><i class="fas fa-chevron-down"></i>`;

    const dropdown = document.createElement('div');
    dropdown.className = 'cyber-nav-dropdown';

    item.children.forEach((child) => {
      const childLink = document.createElement('a');
      childLink.className = 'cyber-nav-dropdown-link';
      childLink.href = child.href;
      childLink.textContent = child.label;
      dropdown.appendChild(childLink);
    });

    wrapper.append(trigger, dropdown);
    return wrapper;
  };

  const closeMobileDrawer = () => {
    document.body.classList.remove('cyber-nav-open');
  };

  const ensureNav = () => {
    if (document.getElementById(NAV_ID)) return;

    const shell = document.createElement('div');
    shell.id = NAV_ID;
    shell.innerHTML = `
      <div class="cyber-nav-backdrop" data-role="backdrop"></div>
      <div class="cyber-nav-desktop-wrap">
        <nav class="cyber-nav-desktop" aria-label="Main navigation"></nav>
      </div>
      <div class="cyber-nav-mobile-wrap">
        <button class="cyber-nav-mobile-toggle" type="button" aria-label="Open navigation">
          <span></span><span></span><span></span>
        </button>
      </div>
      <aside class="cyber-nav-mobile-panel" aria-label="Mobile navigation">
        <div class="cyber-nav-mobile-header">
          <div class="cyber-nav-mobile-title">Explore</div>
          <button class="cyber-nav-mobile-close" type="button" aria-label="Close navigation">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <div class="cyber-nav-mobile-links"></div>
      </aside>
    `;

    const desktopNav = shell.querySelector('.cyber-nav-desktop');
    const mobileLinks = shell.querySelector('.cyber-nav-mobile-links');

    NAV_ITEMS.forEach((item) => {
      desktopNav.appendChild(createItem(item));

      if (item.children) {
        const section = document.createElement('div');
        section.className = 'cyber-nav-mobile-section';

        const heading = document.createElement('a');
        heading.className = 'cyber-nav-mobile-link';
        heading.href = item.href;
        heading.innerHTML = `<i class="${item.icon}"></i><span>${item.label}</span>`;
        section.appendChild(heading);

        item.children.forEach((child) => {
          const childLink = document.createElement('a');
          childLink.className = 'cyber-nav-mobile-sublink';
          childLink.href = child.href;
          childLink.textContent = child.label;
          section.appendChild(childLink);
        });

        mobileLinks.appendChild(section);
        return;
      }

      mobileLinks.appendChild(createItem(item, true));
    });

    document.body.appendChild(shell);

    shell.querySelector('.cyber-nav-mobile-toggle').addEventListener('click', () => {
      document.body.classList.add('cyber-nav-open');
    });

    shell.querySelector('.cyber-nav-mobile-close').addEventListener('click', closeMobileDrawer);
    shell.querySelector('[data-role="backdrop"]').addEventListener('click', closeMobileDrawer);

    shell.querySelectorAll('.cyber-nav-mobile-link, .cyber-nav-mobile-sublink').forEach((link) => {
      link.addEventListener('click', closeMobileDrawer);
    });
  };

  const syncVisibility = () => {
    document.body.classList.toggle('cyber-nav-mobile-mode', window.innerWidth <= MOBILE_BREAKPOINT);
    if (window.innerWidth > MOBILE_BREAKPOINT) {
      closeMobileDrawer();
    }
  };

  const start = () => {
    ensureNav();
    syncVisibility();
    window.addEventListener('resize', syncVisibility);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
