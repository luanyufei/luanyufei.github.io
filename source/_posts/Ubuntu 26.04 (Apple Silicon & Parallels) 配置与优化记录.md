---
title: Ubuntu 26.04 (Apple Silicon / Parallels) 配置与优化记录
slug: ubuntu-26-04-parallels-optimization
date: 2026-08-26 17:20:00
categories: 实用技巧
tags:
  - Linux
  - Ubuntu
  - Parallels
  - 折腾记录
  - 生产力
  - 桌面美化
---

很久以前我装过一次 Ubuntu，当时各种依赖、字体和驱动配置实在太折腾，没用多久就放弃了。现在有了 AI Agent，很多底层的调试和脚本一句话就能搞定，整个折腾流程顺畅了许多。

这篇文档是我在 Apple Silicon Mac 的 Parallels 虚拟机里调教 Ubuntu 26.04 的完整记录。内容涵盖了屏幕高刷锁定、GNOME 现代主题架构与深色模式避坑、全透明悬浮 Dock、输入法迁移、终端与浏览器调优、常用原生工具及系统底层服务，留作以后换机或在实体机上装 Linux 时的速查参考。

## 1. 屏幕分辨率与高刷锁定（2560×1440 @ 180Hz）

### 遇到问题
1. **分辨率与刷新率缺失**：系统初始缺少 2K 16:9（2560×1440）及 180Hz 高刷新率选项。
2. **分辨率被动态重置**：Parallels Tools 后台进程在拖动或缩放 Mac 窗口时会触发动态分辨率检测，将虚拟机强行改回当前窗口尺寸并将刷新率重置为 60Hz。

### 解决方法
* **内核 DRM 注入**：在 `/etc/default/grub.d/99_resolution.cfg` 中加入参数 `video=Virtual-1:2560x1440@180 video=2560x1440@180`，执行 `sudo update-grub`，让内核在引导时生成对应的显示模式。
* **阻止动态分辨率篡改**：将系统二进制 `/usr/bin/prlcc` 替换为包装脚本，移除 DynRes 分辨率监听逻辑，同时保留剪贴板同步（`prlcp`）、文件拖放（`prldnd`）和共享目录（`prl_fsd`）。
* **同步显示管理器配置**：将显示配置文件保存到 `~/.config/monitors.xml`，并同步复制至 `/var/lib/gdm3/.config/monitors.xml`，确保从 GDM3 登录界面到进入桌面全程锁定该配置。

## 2. GNOME 42+ 主题架构与深色模式避坑

在现代 GNOME（GNOME 42+）下给 Ubuntu 换主题，很容易遇到各种莫名其妙的 bug：比如切了深色模式设置窗口依然是白色、换了第三方图标只要按一下深色按钮就自动变回默认图标、Brave 里的 Dark Reader 变黑两秒后又自己跳回白色等。

这些坑的根源在于现代 GNOME 的底层架构分层。

### 2.1 现代 GNOME 的四层界面架构

目前的 Linux 桌面由四个相互独立的系统组成：

```text
               ┌────────────────────────────────────────┐
               │         你的应用界面 (Applications)       │
               └───────────────────┬────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│     现代应用 (GTK4 + Libadwaita)   │         │     传统应用 (GTK3 / Legacy)     │
│   (如: 系统设置、文件管理器、文本编辑器)   │         │    (如: GIMP、各种第三方老应用)     │
└────────────────┬────────────────┘         └────────────────┬────────────────┘
                 │                                           │
   ┌─────────────┴─────────────┐                             │
   ▼                           ▼                             ▼
【Libadwaita 原生引擎】   【~/.config/gtk-4.0/】       【~/.themes/ 或 /usr/share/】
 • 内置深浅色样式         • 用户强制覆盖层              • 读取 gsettings gtk-theme
 • 官方标准架构           (第三方主题强行注入点)        (Yaru / Orchis 在此生效)
 • 0ms 实时深浅热重载     • 静态文件，无法热重载
```

* **Libadwaita (GTK4)**：GNOME 官方为了防止第三方主题破坏控件结构，完全废弃了从 `~/.themes/` 读取外部主题的做法。深浅色样式直接以内置资源形式编译在底层，支持毫秒级的动态切换。
* **第三方主题（如 Orchis）**：为了强行修改 Libadwaita 应用，安装脚本通常会把生成的静态 CSS 复制到 `~/.config/gtk-4.0/gtk.css`。这是 GTK4 留给用户的最高优先级覆盖层，一旦写入，就会直接废掉 Libadwaita 原生的动态深浅色切换能力。
* **GNOME Shell UI**：独立于应用窗口，专门管顶部状态栏、右上角快捷控制面板（Quick Settings）、通知中心和日历，由 `user-theme` 扩展独立控制。
* **Electron 与 Chromium / Brave**：依赖 Linux 的 XDG Desktop Portal（通过 D-Bus `org.freedesktop.portal.Settings` 广播）来接收操作系统的 `color-scheme` 切换信号。

### 2.2 五大常见故障与深度原理复盘

#### 1. 系统设了 Dark Mode，系统设置窗口依然是白色？
* **根本原因**：之前安装 Orchis 等第三方主题时，浅色样式的 CSS 文件被写入了 `~/.config/gtk-4.0/gtk.css`。GTK4 启动时无条件优先加载这个静态文件里的背景定义，导致设置窗口被强行涂白。

#### 2. 为什么 Electron 能秒切深浅色，原生设置和浏览器却不行？
* **根本原因**：Electron 实时监听 D-Bus Portal 广播信号，收到后在内存里即时重算 CSS `@media (prefers-color-scheme: dark)`。而 GTK4 外部覆盖文件只在启动时读取一次磁盘，无法实时热重绘，必须关闭窗口重开才能生效。

#### 3. Brave 里的 Dark Reader 变黑 2 秒后，自动弹回浅色？
* **根本原因（信号竞争冲突）**：
  1. 点击系统深色模式时，GNOME 先通过 D-Bus 广播 `color-scheme = 1 (Dark)`，Dark Reader 瞬间生效变黑；
  2. 如果 Brave 开启了 `Use GTK`，Chromium 底层模块在 2 秒后完成 GTK3 主题色彩重算，误判为浅色，强行推翻了之前的 Portal 信号，向页面发送 `prefers-color-scheme: light`；
  3. Dark Reader 收到错误的覆盖信号，误以为系统切回了浅色，于是自动关闭了深色渲染。

#### 4. 右上角控制中心与系统弹窗依然是白色？
* **根本原因**：桌面的系统弹窗属于 GNOME Shell UI，由 `user-theme` 扩展管理。如果之前 Shell 主题被固定指定为了浅色主题（如 `Orchis-Light`），桌面弹窗就会被强制固定为浅色。

#### 5. 换了第三方图标（如 Tela），一按深色模式又变回官方图标？
* **根本原因**：Ubuntu 的「系统设置 ➔ 外观」面板内置了绑定逻辑。只要在图形界面里点击了 Dark / Default 或切换了颜色圆圈，Ubuntu 就会自动触发 `gsettings set icon-theme Yaru-<color>-dark`，强行重置图标。

### 2.3 终极推荐配置：纯净热重载与图标防篡改

要实现**零 Bug、免重启、毫秒级平滑热重载、图标不被系统重置**，按照以下四步配置：

#### 1. 净化 GTK4 / Libadwaita（恢复原生热重载）
清理用户目录下的暴力覆盖层：
```bash
# 备份并清空 gtk-4.0 下的所有覆盖文件
mkdir -p ~/.config/gtk-4.0.bak
mv ~/.config/gtk-4.0/* ~/.config/gtk-4.0.bak/ 2>/dev/null || true
rm -rf ~/.config/gtk-4.0/*
```

#### 2. 统一官方系统主题与 Shell 主题
```bash
# 设置 GTK 传统主题为官方 Yaru-purple
gsettings set org.gnome.desktop.interface gtk-theme 'Yaru-purple'

# 重置 GNOME Shell 主题为官方原生（解决右上角弹窗保持白色的问题）
gsettings set org.gnome.shell.extensions.user-theme name ''
```

#### 3. 利用 XDG 优先级锁定 Tela 图标
Linux 标准规定：`~/.local/share/icons/` 的优先级高于 `/usr/share/icons/`。建立软链接后，就算 Ubuntu 设置面板强制写入 Yaru，系统读取到的依然是 Tela 图标：
```bash
ln -sfn ~/.local/share/icons/Tela-purple-dark ~/.local/share/icons/Yaru-purple-dark
ln -sfn ~/.local/share/icons/Tela-purple ~/.local/share/icons/Yaru-purple
ln -sfn ~/.local/share/icons/Tela-dark ~/.local/share/icons/Yaru-dark
ln -sfn ~/.local/share/icons/Tela ~/.local/share/icons/Yaru

# 立即刷新当前图标
gsettings set org.gnome.desktop.interface icon-theme 'Tela-purple-dark'
```

## 3. 桌面深度美化与透明组件调优

### 3.1 字体安装与渲染配置
* **安装常用字体**：
  * 中文字体：苹方全字重（PingFang SC，存放于 `/usr/local/share/fonts/PingFang/`）及思源黑体（Noto Sans CJK SC）。
  * 等宽编程字体：JetBrains Mono、Fira Code。
* **全局字体渲染设置**：
  ```bash
  gsettings set org.gnome.desktop.interface font-name "PingFang SC 11"
  gsettings set org.gnome.desktop.interface document-font-name "PingFang SC 11"
  gsettings set org.gnome.desktop.interface monospace-font-name "JetBrains Mono 10"
  gsettings set org.gnome.desktop.wm.preferences titlebar-font "PingFang SC Bold 11"
  gsettings set org.gnome.desktop.interface font-antialiasing "rgba"
  gsettings set org.gnome.desktop.interface font-hinting "slight"
  ```
* **网页字体映射修复**：在 `/etc/fonts/local.conf` 中将 `SimSun`、`宋体`、`Microsoft YaHei` 和 `微软雅黑` 映射至苹方，解决部分国内网页将中文字形错误回退到衬线宋体的问题。

![Tela 图标主题与 Blur my Shell 应用抽屉磨砂背景](/image/ubuntu-app-drawer-blur.webp "Tela 图标主题与 Blur my Shell 应用抽屉磨砂背景效果")

### 3.2 顶部状态栏 100% 透明与托盘图标居中
* **顶部状态栏（Top Bar）100% 全透明**：
  GNOME 原生顶栏由底层 C/St 固化渲染并自带纯黑底色。安装专用扩展 `Transparent Top Bar (Adjustable transparency)`（UUID: `transparent-top-bar@ftpix.com`），并关闭 Blur my Shell 对顶栏的暗色磨砂，即可实现通透的全透明悬浮顶栏：
  ```bash
  gsettings set org.gnome.shell.extensions.blur-my-shell.panel blur false
  gsettings --schemadir ~/.local/share/glib-2.0/schemas/ set com.ftpix.transparentbar transparency 0
  gsettings --schemadir ~/.local/share/glib-2.0/schemas/ set com.ftpix.transparentbar dark-full-screen false
  ```
* **后台托盘图标居中**：
  通过 `Ubuntu AppIndicators`（`ubuntu-appindicators@ubuntu.com`），可将原本挤在右上角的托盘图标移至顶栏中央（紧随在时钟日历后方）：
  ```bash
  gsettings set org.gnome.shell.extensions.appindicator tray-pos 'center'
  ```

### 3.3 【核心避坑】Dock 栏 100% 全透明与悬停预览调优
很多用户将 Dock 栏调为底部居中小胶囊后，发现即使设置 `background-opacity = 0.0`，底栏依然存在灰色半透明底、磨砂气泡或直接变成纯黑一块。

#### 为什么普通方法会失效？
1. **Ubuntu Dock 源码逻辑缺陷（`theming.js`）**：在 Ubuntu Dock 内部，如果 `custom-background-color` 为 `false`，计算透明度的 Alpha 逻辑**不会被执行**，而是直接回退为系统默认的半透明深色底。单纯开启 `custom-background-color` 给 `#000000` 时，若未正确注入 Alpha，系统会渲染为纯黑块。**必须同时满足 `custom-background-color = true`、`background-color = '#000000'`、`transparency-mode = 'FIXED'` 和 `background-opacity = 0.0`**，底层才会生成 `rgba(0, 0, 0, 0)` 的完全透明内联样式。
2. **Blur my Shell 图层叠加冲突**：`Blur my Shell` 默认对 Dock 启用了毛玻璃模糊，即使透明度为 0 也会在背后叠加一层灰白色磨砂层。需显式关闭其针对 Dash-to-Dock 的模糊层。

#### 100% 真正全透明 Dock 标准配置
```bash
# 1. 底部居中小胶囊
gsettings set org.gnome.shell.extensions.dash-to-dock dock-position 'BOTTOM'
gsettings set org.gnome.shell.extensions.dash-to-dock extend-height false
gsettings set org.gnome.shell.extensions.dash-to-dock custom-theme-shrink true
gsettings set org.gnome.shell.extensions.dash-to-dock dash-max-icon-size 48
gsettings set org.gnome.shell.extensions.dash-to-dock running-indicator-style 'DOTS'
gsettings set org.gnome.shell.extensions.dash-to-dock autohide true
gsettings set org.gnome.shell.extensions.dash-to-dock intellihide true
gsettings set org.gnome.shell.extensions.dash-to-dock show-mounts false

# 2. 触发底层 0 不透明度注入（关键避坑）
gsettings set org.gnome.shell.extensions.dash-to-dock apply-custom-theme false
gsettings set org.gnome.shell.extensions.dash-to-dock custom-background-color true
gsettings set org.gnome.shell.extensions.dash-to-dock background-color '#000000'
gsettings set org.gnome.shell.extensions.dash-to-dock transparency-mode 'FIXED'
gsettings set org.gnome.shell.extensions.dash-to-dock background-opacity 0.0

# 3. 移除多余的毛玻璃图层
gsettings set org.gnome.shell.extensions.blur-my-shell.dash-to-dock blur false

# 4. 热重载 Dock 扩展即时生效
gnome-extensions disable ubuntu-dock@ubuntu.com && sleep 0.2 && gnome-extensions enable ubuntu-dock@ubuntu.com
```

![Ubuntu 全透明顶栏与居中悬浮 Dock 最终效果](/image/ubuntu-desktop-transparent-dock.webp "Ubuntu 全透明顶栏与居中悬浮 Dock 最终效果")

#### Dock 鼠标悬停实时窗口缩略图（零延迟即消）
安装 **`Dock Window Preview`**（UUID: `dock-window-preview@quivio`），可实现类似 Windows / macOS 的悬停缩略图：
1. **水平卡片与灵敏度**：
   ```bash
   gsettings --schemadir ~/.local/share/glib-2.0/schemas/ set org.gnome.shell.extensions.dock-window-preview preview-layout 'horizontal'
   gsettings --schemadir ~/.local/share/glib-2.0/schemas/ set org.gnome.shell.extensions.dock-window-preview show-close-button true
   gsettings --schemadir ~/.local/share/glib-2.0/schemas/ set org.gnome.shell.extensions.dock-window-preview hover-delay-ms 150
   ```
2. **零延迟即时消失调优**：修改扩展目录中的 `extension.js`，将 `HIDE_DELAY_MS` 从 `240ms` 改为 `0ms`，将鼠标离开扫描周期 `POINTER_POLL_MS` 改为 `40ms`，实现鼠标悬停 0.15 秒弹出、移开瞬间 0 延迟消失。

### 3.4 GNOME 扩展清单
管理工具通过 `sudo apt install gnome-shell-extension-manager` 安装，目前启用的扩展包括：
* **User Themes** (`user-theme@gnome-shell-extensions.gcampax.github.com`)：解锁自定义 Shell 主题。
* **Blur my Shell** (`blur-my-shell@aunetx`)：应用抽屉与概览背景半透明毛玻璃效果。
* **Transparent Top Bar** (`transparent-top-bar@ftpix.com`)：顶栏 100% 全透明。
* **Dock Window Preview** (`dock-window-preview@quivio`)：Dock 栏悬停实时窗口预览卡片。
* **Logo Menu** (`logomenu@aryan_k`)：顶栏左侧系统菜单入口。
* **Vitals** (`Vitals@CoreCoding.com`)：顶栏显示 CPU、内存、实时网速与存储状态。
* **Compiz Magic Lamp** (`compiz-alike-magic-lamp-effect@hermes83.github.com`)：窗口最小化神奇缩放动效。
* **Ubuntu AppIndicators** (`ubuntu-appindicators@ubuntu.com`)：系统托盘图标支持与居中对齐。

### 3.5 一键美化与恢复脚本速查
重装系统或新机配置时，可直接保存执行以下脚本一键还原整套美化：

```bash
#!/usr/bin/env bash
# 一键应用桌面美化与透明配置

# 1. 应用主题
gsettings set org.gnome.desktop.interface cursor-theme 'WhiteSur-cursors'
gsettings set org.gnome.desktop.interface icon-theme 'Tela-purple-dark'
gsettings set org.gnome.desktop.interface gtk-theme 'Yaru-purple'
gsettings set org.gnome.shell.extensions.user-theme name ''

# 2. 托盘居中
gsettings set org.gnome.shell.extensions.appindicator tray-pos 'center'

# 3. Dock 真正全透明
gsettings set org.gnome.shell.extensions.dash-to-dock dock-position 'BOTTOM'
gsettings set org.gnome.shell.extensions.dash-to-dock extend-height false
gsettings set org.gnome.shell.extensions.dash-to-dock custom-theme-shrink true
gsettings set org.gnome.shell.extensions.dash-to-dock apply-custom-theme false
gsettings set org.gnome.shell.extensions.dash-to-dock custom-background-color true
gsettings set org.gnome.shell.extensions.dash-to-dock background-color '#000000'
gsettings set org.gnome.shell.extensions.dash-to-dock transparency-mode 'FIXED'
gsettings set org.gnome.shell.extensions.dash-to-dock background-opacity 0.0
gsettings set org.gnome.shell.extensions.blur-my-shell.dash-to-dock blur false

# 4. 顶栏 100% 纯透明
gsettings set org.gnome.shell.extensions.blur-my-shell.panel blur false
gsettings --schemadir ~/.local/share/glib-2.0/schemas/ set com.ftpix.transparentbar transparency 0 2>/dev/null || true
gsettings --schemadir ~/.local/share/glib-2.0/schemas/ set com.ftpix.transparentbar dark-full-screen false 2>/dev/null || true

# 5. Dock 悬停预览参数
gsettings --schemadir ~/.local/share/glib-2.0/schemas/ set org.gnome.shell.extensions.dock-window-preview preview-layout 'horizontal' 2>/dev/null || true
gsettings --schemadir ~/.local/share/glib-2.0/schemas/ set org.gnome.shell.extensions.dock-window-preview show-close-button true 2>/dev/null || true
gsettings --schemadir ~/.local/share/glib-2.0/schemas/ set org.gnome.shell.extensions.dock-window-preview hover-delay-ms 150 2>/dev/null || true

# 6. 重启扩展生效
gnome-extensions disable ubuntu-dock@ubuntu.com && sleep 0.2 && gnome-extensions enable ubuntu-dock@ubuntu.com
gnome-extensions disable blur-my-shell@aunetx && sleep 0.2 && gnome-extensions enable blur-my-shell@aunetx
nautilus -q 2>/dev/null || true

echo "✨ 美化与透明配置已全部应用成功！"
```

## 4. Rime 输入法与小鹤双拼

### 实施细节
* **安装依赖**：
  ```bash
  sudo apt install -y ibus-rime librime-bin librime-plugin-lua
  ```
* **同步 Mac 词库与配置**：从 Mac 共享路径 `/media/psf/Home/Library/Rime` 同步雾凇拼音（`rime_ice`）、双拼方案、词库文件（`cn_dicts/`、`en_dicts/`）、自定义短语（`custom_phrase.txt`）、Lua 插件及 OpenCC 规则到 `~/.config/ibus/rime/`。
* **设定默认方案**：在 `default.custom.yaml` 中将 `double_pinyin_flypy`（小鹤双拼）置于首位。
* **行内拼音显示**：在 `ibus_rime.custom.yaml` 中配置 `style/preedit_style: composition`，使输入框内直接显示键入的拼音字母（如 `na xie`），按空格确认后汉字上屏。
* **快捷键**：输入法切换键设为 `Ctrl + Space`（避免与 macOS 的 Spotlight 冲突），中英文在 Rime 内通过 `Shift` 切换。

## 5. 终端环境（Ghostty）

### 5.1 安装与默认终端切换
1. 通过 `sudo apt install -y ghostty` 安装官方 ARM64 版本。
2. 注册为默认终端：
   ```bash
   sudo update-alternatives --install /usr/bin/x-terminal-emulator x-terminal-emulator /usr/bin/ghostty 50
   sudo update-alternatives --set x-terminal-emulator /usr/bin/ghostty
   ```
3. 绑定快捷键 `Ctrl + Alt + T` 唤起 Ghostty，并将 Dock 栏中的终端图标替换为 Ghostty。

### 5.2 渲染问题修复
* **遇到问题**：Ghostty 依赖 OpenGL 4.3 的片元着色器 SSBO 特性，而 Parallels 虚拟显卡仅支持 OpenGL 3.3，导致直接启动时崩溃或无响应。
* **修复方法**：将二进制文件移动为 `/usr/bin/ghostty.bin`，并创建 `/usr/bin/ghostty` 包装脚本，指定 Mesa 的 `llvmpipe` 软件渲染引擎：
  ```bash
  #!/bin/sh
  export LIBGL_ALWAYS_SOFTWARE=1
  export MESA_LOADER_DRIVER_OVERRIDE=llvmpipe
  exec /usr/bin/ghostty.bin "$@"
  ```
* **主题配置**：在 `~/.config/ghostty/config` 中配置标准主题：
  ```ini
  font-size = 13
  theme = dark:Catppuccin Mocha,light:Catppuccin Latte
  window-padding-x = 8
  window-padding-y = 8
  ```

## 6. 浏览器环境（Brave）

### 6.1 移除 Firefox
```bash
sudo snap remove --purge firefox
sudo apt remove --purge -y firefox
rm -rf ~/snap/firefox ~/.mozilla
```

### 6.2 安装 Brave 并配置企业策略
1. **添加官方仓库并安装**：
   ```bash
   sudo curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg
   sudo curl -fsSLo /etc/apt/sources.list.d/brave-browser-release.sources https://brave-browser-apt-release.s3.brave.com/brave-browser.sources
   sudo apt update && sudo apt install -y brave-browser
   ```
2. **写入企业策略配置文件**：创建 `/etc/brave/policies/managed/brave_debloat.json`，关闭加密钱包、内置 AI、VPN、推广奖励与遥测，并将字体统一指定为苹方与 JetBrains Mono：
   ```json
   {
     "BraveWalletDisabled": true,
     "BraveAIChatEnabled": false,
     "BraveVPNDisabled": true,
     "BraveRewardsDisabled": true,
     "BraveNewsDisabled": true,
     "BraveP3AEnabled": false,
     "BraveStatsPingEnabled": false,
     "MetricsReportingEnabled": false,
     "BraveWebDiscoveryEnabled": false,
     "UrlKeyedAnonymizedDataCollectionEnabled": false,
     "UserFeedbackAllowed": false,
     "StandardFontFamily": "PingFang SC",
     "SansserifFontFamily": "PingFang SC",
     "FixedFontFamily": "JetBrains Mono"
   }
   ```
3. **设为默认浏览器**：
   ```bash
   xdg-settings set default-web-browser brave-browser.desktop
   ```

### 6.3 外观与深浅色跟随避坑
打开 Brave 进入 `brave://settings/appearance`：
* **Linux 主题选项**：选择 **Classic（经典主题）**。如果当前显示 `Reset to Classic`，点击重置（**切勿点击 Use GTK 或 Use QT**，否则会引发前面提到的色彩信号竞争 bug）。
* **Brave colors**：选择 **Same as Linux**（跟随系统）。
* **Dark Reader 扩展**：移除了 GTK 的冲突信号后，Dark Reader 选择“跟随系统”即可正常工作，不再出现 2 秒后弹回浅色的问题。

## 7. 系统底层与外设优化

### 7.1 ZRAM 内存实时压缩
* 安装 `zram-tools` 并启用 `zramswap.service`。
* 在 `/etc/default/zramswap` 中将压缩算法设为 `zstd`，容量上限设为 100% 物理内存（5.3GB），优先级设为 100。
* **效果**：系统可用 Swap 扩充至 9.1GB，优先在内存中压缩暂存不活跃数据，避免因内存不足触发磁盘 I/O 卡顿。

### 7.2 截图快捷键
* 将交互式截图工具快捷键绑定为 `Ctrl + Shift + S`：
  ```bash
  gsettings set org.gnome.shell.keybindings show-screenshot-ui "['Print', '<Control><Shift>s', '<Super><Shift>s']"
  ```
* 支持区域框选、窗口截图与屏幕录制，截图自动存入剪贴板并保存在 `~/Pictures/Screenshots`。

### 7.3 剪贴板与拖拽服务
创建 Systemd 用户守护服务 `~/.config/systemd/user/parallels-tools-user.service` 并安装 `wl-clipboard` 与 `xclip`，确保登录后自动恢复与 Mac 宿主机的双向剪贴板和文件拖放支持。

### 7.4 系统监控与任务管理（Mission Center）
* 安装了 **Mission Center**，界面风格和交互逻辑几乎是 Windows 任务管理器的翻版，支持直观监控 CPU、内存、磁盘 I/O、网络利用率及细粒度进程管理，相比原生系统监视器更加直观好用。

### 7.5 Nautilus 一级右键菜单扩展（复制文件路径）
为了彻底摆脱二级 `Scripts` 子菜单的繁琐操作，直接在文件管理器一级右键菜单中调用复制路径：
1. **安装 Python 扩展支持库**：
   ```bash
   sudo apt install -y python3-nautilus
   ```
2. **安装 `nautilus-copy-path` 插件**：
   * 源码仓库：[chr314/nautilus-copy-path](https://github.com/chr314/nautilus-copy-path)；
   * 将插件置于 `~/.local/share/nautilus-python/extensions/`，执行 `nautilus -q` 刷新后台。
3. **使用效果**：
   * 在文件管理器中右键任意文件，一级菜单直接提供 **`Copy Path`**（复制完整路径）与 **`Copy Name`**（复制文件名）；
   * 支持快捷键：选中文件直接按 **`Ctrl + Shift + C`** 瞬间复制完整路径。

## 8. 常用软件与 Antigravity 开发环境

### 8.1 原生 ARM64 常用生产力软件（LocalSend & PeaZip）
* **LocalSend（局域网跨平台隔空互传）**：
  * 官方 Linux aarch64 原生 Flutter 构建，安装于 `~/.local/share/localsend`，支持桌面图标点击与终端 `localsend` 命令启动。
* **PeaZip（7-Zip 核心专业图形化压缩/解压管理器）**：
  * 官方 7-Zip 原生 Linux 版仅有 CLI 命令行工具（`7zz`），PeaZip 是 Linux 下成熟强大的 7-Zip 图形化管理工具，支持多标签页、密码加密、分卷压缩，并已关联为系统中 `.7z`、`.zip`、`.rar`、`.tar.gz` 等所有常见压缩格式的默认打开程序。

### 8.2 Antigravity 部署与修复
* **部署与权限**：安装于 `/opt/antigravity`，修复 `chrome-sandbox` 权限，生成 `/usr/local/bin/antigravity` 全局命令与桌面图标。
* **标题栏色差与窗口唤醒修复**：
  * 修改 `dist/ipcHandlers.js`，将主题同步平台判断放宽至非 macOS 系统，使 Linux 下窗口按钮区域颜色与主题实时匹配。
  * 修改 `dist/main.js` 中的 `second-instance` 事件逻辑，修复在 `Ctrl + W` 关闭窗口后点击 Dock 无法重新呼出界面的问题。
* **自动打补丁脚本**：编写 `/opt/antigravity/patch-linux-fixes.js` 并在启动脚本中调用，确保应用自动更新后补丁依然生效。

### 8.3 现代开发工具
* **uv**：安装于 `/usr/local/bin/uv`，用于 Python 环境隔离和包管理。
* **OpenCLI**：全局安装 `@jackwener/opencli`，并部署相关 skills 到 `~/.gemini/config/skills/`。

## 9. 核心维护与排错命令速查

平时调试深浅色和主题状态时，可以直接用这些命令查询：

| 查询 / 操作目的 | 终端命令 |
| :--- | :--- |
| **查看当前深浅色状态** | `gsettings get org.gnome.desktop.interface color-scheme` |
| **查看当前 GTK 主题** | `gsettings get org.gnome.desktop.interface gtk-theme` |
| **查看当前图标主题** | `gsettings get org.gnome.desktop.interface icon-theme` |
| **查看当前 GNOME Shell 主题** | `gsettings get org.gnome.shell.extensions.user-theme name` |
| **切换为深色模式** | `gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'` |
| **切换为浅色模式** | `gsettings set org.gnome.desktop.interface color-scheme 'default'` |
| **查询 D-Bus Portal 真实广播值** | `dbus-send --session --print-reply=literal --dest=org.freedesktop.portal.Desktop /org/freedesktop/portal/desktop org.freedesktop.portal.Settings.Read string:org.freedesktop.appearance string:color-scheme` |

