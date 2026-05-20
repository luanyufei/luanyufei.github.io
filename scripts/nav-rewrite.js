hexo.extend.filter.register('after_render:html', (html) => {
  if (!html || typeof html !== 'string') return html;

  let output = html;

  // Remove sidebar (kept hidden via CSS, but removing from DOM saves memory)
  output = output.replace(
    /<div id="sidebar">[\s\S]*?(<div class="page[^"]*" id="body-wrap">)/,
    '$1'
  );

  // Replace nav wrapper to use custom class
  output = output.replace(
    /<nav id="nav">[\s\S]*?<div id="menus">/,
    '<nav id="nav" class="cyber-native-nav"><div id="menus">'
  );

  // Remove search-button and toggle-menu elements
  output = output.replace(/<div id="search-button">[\s\S]*?<\/div>/, '');
  output = output.replace(/<div id="toggle-menu">[\s\S]*?<\/div>/, '');

  return output;
});
