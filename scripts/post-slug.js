const { parse } = require('hexo-front-matter');

hexo.extend.filter.register('post_permalink', function(data) {
  if (data && data.raw) {
    const parsed = parse(data.raw);
    if (parsed && parsed.slug) {
      data.slug = String(parsed.slug).trim();
    }
  }
  return data;
}, 5);
