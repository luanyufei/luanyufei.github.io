const HOME_HERO = `
<div id="site-info" class="feespace-hero">
  <div class="hero-meta" aria-hidden="true">
    <span>FEE SPACE / DIGITAL GARDEN</span>
    <span>CN · GMT+8</span>
  </div>
  <div class="hero-grid">
    <p class="hero-intro">电子扫盲、系统折腾<br>以及值得留下的经验</p>
    <h1 id="site-title" class="kinetic-title" aria-label="Fee Space">
      <span class="kinetic-word kinetic-word-fee" data-word="FEE" aria-hidden="true"><span class="kinetic-face">FEE</span></span>
      <span class="kinetic-word kinetic-word-space" data-word="SPACE" aria-hidden="true"><span class="kinetic-face">SPACE</span></span>
      <span class="kinetic-axis kinetic-axis-x" aria-hidden="true"></span>
      <span class="kinetic-axis kinetic-axis-y" aria-hidden="true"></span>
      <span class="kinetic-corner kinetic-corner-tl" aria-hidden="true"></span>
      <span class="kinetic-corner kinetic-corner-br" aria-hidden="true"></span>
      <span class="kinetic-hud" aria-hidden="true"><span>TYPE.SYS / FS-01</span><span data-kinetic-coordinates>X 50 / Y 50</span></span>
    </h1>
    <p class="hero-statement">把复杂的技术讲清楚<br>把真实的折腾写下来</p>
  </div>
  <div class="hero-footer">
    <span>乱与狒的数字花园 © 2026</span>
    <div class="hero-links">
      <a href="https://github.com/luanyufei" target="_blank" rel="noopener">GitHub ↗</a>
      <a href="https://space.bilibili.com/3493130162669961" target="_blank" rel="noopener">Bilibili ↗</a>
      <a href="mailto:noonyjufee@gmail.com">Email ↗</a>
    </div>
  </div>
</div>
<button id="scroll-down" type="button" aria-label="滚动到最近文章">
  <i class="fas fa-chevron-down" aria-hidden="true"></i>
</button>`;

const COLLECTION_HEAD = `
<header class="collection-head">
  <p>INDEX / NOTES</p>
  <h2>最近写下的东西</h2>
  <a href="/archives/">全部文章 <span aria-hidden="true">↗</span></a>
</header>`;

const SITE_NAV = `
<nav id="nav" class="feespace-nav">
  <a class="site-wordmark" href="/" aria-label="Fee Space 首页"><span>Fee Space</span><small>©2026</small></a>
  <div id="blog-info" aria-hidden="true"><a href="/"><span class="site-name">Fee Space</span></a></div>
  <div id="menus">
    <div class="menus_items">
      <div class="menus_item"><a class="site-page" href="/"><i class="fa-fw fas fa-home"></i><span>首页</span></a></div>
      <div class="menus_item menus_item-article">
        <a class="site-page" href="/archives/" aria-haspopup="true" aria-expanded="false">
          <i class="fa-fw fas fa-layer-group"></i><span>文章</span><i class="menu-caret fas fa-chevron-down" aria-hidden="true"></i>
        </a>
        <div class="menu-dropdown" role="menu" aria-label="文章导航">
          <a class="menu-dropdown-link" href="/categories/" role="menuitem"><span>分类</span><small>Categories</small></a>
          <a class="menu-dropdown-link" href="/tags/" role="menuitem"><span>标签</span><small>Tags</small></a>
        </div>
      </div>
      <div class="menus_item"><a class="site-page" href="/trend/"><i class="fa-fw fas fa-bolt"></i><span>动态</span></a></div>
      <div class="menus_item"><a class="site-page" href="/link/"><i class="fa-fw fas fa-compass"></i><span>链接</span></a></div>
      <div class="menus_item"><a class="site-page" href="/about/"><i class="fa-fw fas fa-user"></i><span>关于</span></a></div>
    </div>
  </div>
</nav>`;

hexo.extend.filter.register('after_render:html', (html) => {
  if (!html || typeof html !== 'string') return html;

  let output = html;

  // Butterfly renders a full mobile sidebar before the page. The custom nav
  // handles mobile navigation, so remove the duplicate tree on every route.
  output = output.replace(
    /<div id="sidebar">[\s\S]*?(?=<div[^>]*id="body-wrap"[^>]*>)/,
    ''
  );

  output = output.replace(/<nav id="nav">[\s\S]*?<\/nav>/, SITE_NAV);

  output = output.replace(/<div id="search-button">[\s\S]*?<\/div>/, '');
  output = output.replace(/<div id="toggle-menu">[\s\S]*?<\/div>/, '');

  if (output.includes('<header class="full_page fixed" id="page-header"')) {
    output = output.replace(
      /<div id="site-info">[\s\S]*?<div id="scroll-down">[\s\S]*?<\/div>/,
      HOME_HERO
    );

    output = output.replace(
      /(<div class="recent-posts[^>]*" id="recent-posts">)/,
      `$1${COLLECTION_HEAD}`
    );
  }

  return output;
});
