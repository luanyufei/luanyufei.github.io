'use strict';

const { encodeURL, escapeHTML: escape, url_for } = require('hexo-util');
const { join } = require('path').posix;

hexo.extend.filter.register('marked:renderer', function(renderer) {
  renderer.image = function({ href, title, text }) {
    const { options } = this;
    const hexoCtx = (options && options.hexo) || hexo;
    const { relative_link } = hexoCtx.config;
    const { prependRoot, postPath } = options || {};

    let finalHref = href;
    if (!/^(#|\/\/|http(s)?:)/.test(finalHref) && !relative_link && prependRoot) {
      if (!finalHref.startsWith('/') && !finalHref.startsWith('\\') && postPath) {
        const PostAsset = hexoCtx.model('PostAsset');
        const asset = PostAsset.findById(join(postPath, finalHref.replace(/\\/g, '/')));
        if (asset) finalHref = asset.path.replace(/\\/g, '/');
      }
      finalHref = url_for.call(hexoCtx, finalHref);
    }

    let imgHtml = `<img src="${encodeURL(finalHref)}"`;
    if (text) imgHtml += ` alt="${escape(text)}"`;
    if (title) imgHtml += ` title="${escape(title)}"`;
    imgHtml += ` loading="lazy" decoding="async">`;

    // Extract remark/caption: prioritize explicit title, fallback to meaningful alt text
    let caption = '';
    if (title && title.trim()) {
      caption = title.trim();
    } else if (text && text.trim()) {
      const t = text.trim();
      if (!/^(image|img|photo|picture|图片|一张图片|插图|截图)$/i.test(t)) {
        caption = t;
      }
    }

    if (caption) {
      return `<figure class="article-image-figure">${imgHtml}<figcaption class="image-caption">${escape(caption)}</figcaption></figure>`;
    }
    return imgHtml;
  };
});
