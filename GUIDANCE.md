# Fee Space Guidance

这份文档是给未来的你留的，目标只有一个：
即使没有 Codex，你也能独立把这个站点跑起来、修改、部署到 Vercel 和 GitHub Pages。

## 1. 项目是什么

这是一个 `Hexo + Butterfly` 的静态博客项目。

当前有两套发布链路：

- `Vercel`
  - 读取源码仓库的 `main` 分支
  - 自动执行 `npm run build`
  - 根据 [`vercel.json`](/Users/luanyufei/NOON's%20Documents/FeeSpace/vercel.json) 发布 `public/`
  - 你的正式域名现在走它：`luanyufei.cn`

- `GitHub Pages`
  - 不直接读 `main`
  - 读的是生成后的静态分支 `gh-pages`
  - 这个分支内容来自 Hexo 部署目录 `.deploy_git`
  - 默认地址是 `https://luanyufei.github.io`

一句话记住：

- `main` 是源码
- `gh-pages` 是编译后的静态文件

## 2. 重要文件

- [`package.json`](/Users/luanyufei/NOON's%20Documents/FeeSpace/package.json)
  - 常用命令入口
- [`_config.yml`](/Users/luanyufei/NOON's%20Documents/FeeSpace/_config.yml)
  - Hexo 主配置
- [`_config.butterfly.yml`](/Users/luanyufei/NOON's%20Documents/FeeSpace/_config.butterfly.yml)
  - Butterfly 主题覆盖配置
- [`vercel.json`](/Users/luanyufei/NOON's%20Documents/FeeSpace/vercel.json)
  - Vercel 构建配置
- [`source/css/cyber-background.css`](/Users/luanyufei/NOON's%20Documents/FeeSpace/source/css/cyber-background.css)
  - 主要自定义样式
- [`source/js/cyber-background.js`](/Users/luanyufei/NOON's%20Documents/FeeSpace/source/js/cyber-background.js)
  - 粒子背景
- [`source/js/site-ui.js`](/Users/luanyufei/NOON's%20Documents/FeeSpace/source/js/site-ui.js)
  - 导航下拉、link 页打字机等交互
- [`scripts/nav-rewrite.js`](/Users/luanyufei/NOON's%20Documents/FeeSpace/scripts/nav-rewrite.js)
  - Hexo 在生成 HTML 后的重写逻辑
- [`source/_data/link.yml`](/Users/luanyufei/NOON's%20Documents/FeeSpace/source/_data/link.yml)
  - link 页链接数据

## 3. 本地开发

### 第一次装依赖

在项目根目录运行：

```bash
npm install
```

### 本地预览

```bash
npm run clean
npm run build
npm run server
```

然后打开：

```text
http://localhost:4000
```

### 常用命令

```bash
npm run clean
npm run build
npm run server
npm run deploy
```

它们分别表示：

- `clean`：清掉旧缓存和旧生成产物
- `build`：生成 `public/`
- `server`：本地预览
- `deploy`：把 `public/` 发到 `.deploy_git`，并尝试推送到 GitHub Pages

## 4. 日常修改流程

如果你只是正常改文章、样式、导航、link 数据，推荐流程：

```bash
npm run clean
npm run build
npm run server
```

本地确认没问题以后：

```bash
git add .
git commit -m "你的提交说明"
git push origin main
```

如果你本地没有配置 `origin`，就直接用你自己的仓库地址推：

```bash
git push https://github.com/luanyufei/luanyufei.github.io.git main
```

推到 `main` 后：

- Vercel 会自动部署
- 但 GitHub Pages 不会自动同步，因为它读的是 `gh-pages`

## 5. 部署到 Vercel

### 方式 A：正常情况，推荐

只要你把源码推到 GitHub 的 `main`，Vercel 会自动构建。

也就是说通常你只需要：

```bash
git add .
git commit -m "update"
git push origin main
```

### 方式 B：手动触发本地部署

如果未来自动部署失效，或者你只是想手工发一次：

```bash
vercel
vercel --prod
```

当前项目构建规则由 [`vercel.json`](/Users/luanyufei/NOON's%20Documents/FeeSpace/vercel.json) 控制：

- `buildCommand`: `npm run build`
- `outputDirectory`: `public`

### Vercel 域名

现在 Vercel 已绑定：

- `luanyufei.cn`
- `www.luanyufei.cn`

如果未来你换域名，一般去 Vercel Dashboard 里给项目加域名，然后在 DNS 侧按它提示配记录。

## 6. 部署到 GitHub Pages

### 标准方式

如果你的 GitHub SSH 是通的，直接：

```bash
npm run deploy
```

它会：

1. 读取 `public/`
2. 更新 `.deploy_git`
3. 尝试推送到 `gh-pages`

### 这台机器上的特殊情况

这台机器目前有过一个问题：

- GitHub SSH 推送可能失败
- 报错类似：

```text
Connection closed by ... port 22
fatal: Could not read from remote repository.
```

这不是 Hexo 配置错了，是 SSH 通道被拦了。

### SSH 失败时的手动补救

先照常生成并部署：

```bash
npm run deploy
```

即使最后 SSH 推送失败，`.deploy_git` 往往已经生成好了。

然后进入 `.deploy_git`，手动用 HTTPS 推到 `gh-pages`：

```bash
git -C .deploy_git push https://github.com/luanyufei/luanyufei.github.io.git HEAD:gh-pages
```

如果 GitHub 要你认证，就用：

- GitHub PAT
- 或者你本机已经登录过的 Git 凭据

### 最稳妥的 GitHub Pages 发布顺序

```bash
npm run clean
npm run build
git add .
git commit -m "update source"
git push origin main
npm run deploy
```

如果最后一步 SSH 报错，再补：

```bash
git -C .deploy_git push https://github.com/luanyufei/luanyufei.github.io.git HEAD:gh-pages
```

## 7. 修改 link 页

link 页数据文件在：

[`source/_data/link.yml`](/Users/luanyufei/NOON's%20Documents/FeeSpace/source/_data/link.yml)

每个链接结构大概长这样：

```yml
- class_name: 最常访问
  class_desc: Most Frequently Accessed
  link_list:
    - name: Google
      link: https://google.com/
      avatar: https://...
      descr: 谷歌
```

你只需要维护：

- `class_name`
- `class_desc`
- `name`
- `link`
- `avatar`
- `descr`

改完后重新：

```bash
npm run build
npm run server
```

## 8. 修改导航

导航的数据来源主要在：

[`_config.butterfly.yml`](/Users/luanyufei/NOON's%20Documents/FeeSpace/_config.butterfly.yml)

这里的 `menu:` 就是导航项。

交互逻辑在：

[`source/js/site-ui.js`](/Users/luanyufei/NOON's%20Documents/FeeSpace/source/js/site-ui.js)

样式在：

[`source/css/cyber-background.css`](/Users/luanyufei/NOON's%20Documents/FeeSpace/source/css/cyber-background.css)

如果未来导航又出现“主题默认行为和自定义行为打架”的问题，优先检查这两个文件。

## 9. 修改粒子背景

粒子动画脚本在：

[`source/js/cyber-background.js`](/Users/luanyufei/NOON's%20Documents/FeeSpace/source/js/cyber-background.js)

如果你觉得卡：

- 减少粒子数量
- 降低连线阈值
- 降低重绘频率

## 10. 如果构建出来和你想的不一样

按这个顺序排查：

1. 先清缓存再重建

```bash
npm run clean
npm run build
```

2. 看 `public/` 里生成结果是否正确

比如：

```bash
sed -n '1,200p' public/index.html
sed -n '1,200p' public/link/index.html
```

3. 如果 `public/` 正确，但线上不对：

- Vercel：检查 `main` 是否已 push
- GitHub Pages：检查 `gh-pages` 是否已更新

4. 如果浏览器还显示旧样式，先强刷

- Firefox/macOS:

```text
Cmd + Shift + R
```

## 11. 一套你未来最常用的命令

### 只本地预览

```bash
npm run clean
npm run build
npm run server
```

### 发布到 Vercel

```bash
git add .
git commit -m "update"
git push origin main
```

### 同时更新 Vercel 和 GitHub Pages

```bash
npm run clean
npm run build
git add .
git commit -m "update"
git push origin main
npm run deploy
```

如果最后 SSH 失败，再补：

```bash
git -C .deploy_git push https://github.com/luanyufei/luanyufei.github.io.git HEAD:gh-pages
```

## 12. 最后一句

未来你如果只记得一句话，就记这个：

```text
改源码 -> 本地 build/server 看效果 -> push main 给 Vercel -> deploy gh-pages 给 GitHub Pages
```
