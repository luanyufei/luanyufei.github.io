// search.field 设为 all 才能覆盖页面，但 hexo-generator-searchdb 会把 source/ 下的
// 静态资源（vendor JS/CSS/JSON）也编进索引，search.xml 会从几十 KB 涨到 1.4 MB，
// 而搜索面板是打开时才拉这个文件的。这里把索引裁回文档条目。
const isDocument = (url) => /\/$/.test(url) || /\.html$/.test(url);

const keepDocuments = (xml) =>
  xml.replace(/<entry>[\s\S]*?<\/entry>/g, (entry) => {
    const url = (/<url>([\s\S]*?)<\/url>/.exec(entry) || [])[1] || '';
    return isDocument(url) ? entry : '';
  });

hexo.extend.filter.register('after_generate', () => {
  const name = hexo.config.search && hexo.config.search.path;
  if (!name || !hexo.route) return;

  const stream = hexo.route.get(name);
  if (!stream || typeof stream.on !== 'function') return;

  return new Promise((resolve, reject) => {
    let xml = '';
    stream.on('data', (chunk) => { xml += chunk; });
    stream.on('error', reject);
    stream.on('end', () => {
      hexo.route.set(name, keepDocuments(xml));
      resolve();
    });
  });
});
