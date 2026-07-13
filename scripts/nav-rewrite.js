const HOME_HERO = `
<div id="site-info" class="feespace-hero">
  <div class="hero-meta" aria-hidden="true">
    <span>FEE SPACE / DIGITAL GARDEN</span>
    <span>CN · GMT+8</span>
  </div>
  <div class="hero-grid">
    <p class="hero-intro">电子扫盲、系统折腾<br>以及值得留下的经验</p>
    <h1 id="site-title"><span>Fee</span><span>Space</span></h1>
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
<div id="scroll-down"><i class="fas fa-arrow-down" aria-hidden="true"></i></div>`;

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
      <div class="menus_item"><a class="site-page" href="/archives/"><i class="fa-fw fas fa-layer-group"></i><span>文章</span></a></div>
      <div class="menus_item"><a class="site-page" href="/categories/"><i class="fa-fw fas fa-folder-open"></i><span>分类</span></a></div>
      <div class="menus_item"><a class="site-page" href="/tags/"><i class="fa-fw fas fa-tag"></i><span>标签</span></a></div>
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
    /<div id="sidebar">[\s\S]*?(?=<div class="(?:page|post)" id="body-wrap">)/,
    ''
  );

  output = output.replace(/<nav id="nav">[\s\S]*?<\/nav>/, SITE_NAV);

  output = output.replace(/<div id="search-button">[\s\S]*?<\/div>/, '');
  output = output.replace(/<div id="toggle-menu">[\s\S]*?<\/div>/, '');

  if (output.includes('<header class="full_page fixed" id="page-header">')) {
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
