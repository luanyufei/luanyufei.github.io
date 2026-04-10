hexo.extend.filter.register('after_render:html', (html) => {
  let output = html;

  output = output.replace(
    /<div id="sidebar">[\s\S]*?<\/div><div class="page" id="body-wrap">/,
    '<div class="page" id="body-wrap">'
  );

  output = output.replace(
    /<nav id="nav">[\s\S]*?<div id="menus">/,
    '<nav id="nav" class="cyber-native-nav"><div id="menus">'
  );

  output = output.replace(/<div id="search-button">[\s\S]*?<\/div>/, '');
  output = output.replace(/<div id="toggle-menu">[\s\S]*?<\/div>/, '');

  return output;
});
