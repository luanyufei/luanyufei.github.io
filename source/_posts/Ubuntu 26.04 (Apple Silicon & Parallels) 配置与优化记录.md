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

很久以前我装过一次 Ubuntu，当时各种环境依赖、字体和驱动配置实在太折腾，没用多久就放弃了。现在有了 AI Agent，很多繁琐的系统底层调试和软件配置一句话就能搞定，整个折腾流程轻松了太多。

这篇文档是我第一次深度使用并调教 Ubuntu 26.04 的完整记录。虽然目前只是在 Apple Silicon Mac 的 Parallels 虚拟机里体验摸索，不过我把屏幕高刷锁定、输入法迁移、终端渲染、字体、GNOME 深度美化、全透明悬浮 Dock 避坑、常用原生工具及系统服务的避坑细节都整理了下来，留作以后换机或在实体机上装 Linux 时的速查参考。

## 1. 屏幕分辨率与高刷锁定（2560×1440 @ 180Hz）

### 遇到问题
1. **分辨率与刷新率缺失**：系统初始缺少 2K 16:9（2560×1440）及 180Hz 高刷新率选项。
2. **分辨率被动态重置**：Parallels Tools 后台进程在拖动或缩放 Mac 窗口时会触发动态分辨率检测，将虚拟机强行改回当前窗口尺寸并将刷新率重置为 60Hz。

### 解决方法
* **内核 DRM 注入**：在 `/etc/default/grub.d/99_resolution.cfg` 中加入参数 `video=Virtual-1:2560x1440@180 video=2560x1440@180`，执行 `sudo update-grub`，让内核在引导时生成对应的显示模式。
* **阻止动态分辨率篡改**：将系统二进制 `/usr/bin/prlcc` 替换为包装脚本，移除 DynRes 分辨率监听逻辑，同时保留剪贴板同步（`prlcp`）、文件拖放（`prldnd`）和共享目录（`prl_fsd`）。
* **同步显示管理器配置**：将显示配置文件保存到 `~/.config/monitors.xml`，并同步复制至 `/var/lib/gdm3/.config/monitors.xml`，确保从 GDM3 登录界面到进入桌面全程锁定该配置。

## 2. 桌面美化、界面布局与字体渲染

### 2.1 字体安装与渲染配置
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

### 2.2 主题全家桶与 User Themes 扩展配置
通过搭配现代清爽的主题全家桶，可以获得接近 macOS / Material 2.0 的质感：

| 类别 | 推荐主题 / 扩展 | 特点与视觉风格 |
| :--- | :--- | :--- |
| **Cursor（鼠标光标）** | `WhiteSur-cursors` | 基于 macOS 风格的高清圆润光标，带平滑阴影与彩色动态等待圈 |
| **Icons（图标主题）** | `Tela` (含多色变体) | 统一圆角矩形设计，色彩鲜亮柔和，第三方软件覆盖率极高 |
| **Legacy Applications** | `Orchis-Light` | Material Design 2.0 应用程序窗口主题，圆角窗口与药丸控件 |
| **Shell（顶栏与控制中心）** | `Orchis-Light` | 浮动药丸顶栏、半透明日历与快捷面板，配合毛玻璃效果极佳 |

* **User Themes 生效机制**：
  GNOME 默认不允许用户直接切换第三方 Shell 主题。若在 GNOME Tweaks 中发现 Shell 选项置灰锁定，需安装 `User Themes` 扩展（UUID: `user-theme@gnome-shell-extensions.gcampax.github.com`）并放入 `~/.local/share/gnome-shell/extensions/`。
* **命令行应用主题**：
  ```bash
  # 应用光标
  gsettings set org.gnome.desktop.interface cursor-theme 'WhiteSur-cursors'
  # 应用图标
  gsettings set org.gnome.desktop.interface icon-theme 'Tela'
  # 应用窗口主题
  gsettings set org.gnome.desktop.interface gtk-theme 'Orchis-Light'
  # 应用 Shell 主题
  gsettings set org.gnome.shell.extensions.user-theme name 'Orchis-Light'
  ```

### 2.3 顶部状态栏 100% 透明与托盘图标居中
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

### 2.4 【核心避坑】Dock 栏 100% 全透明与悬停预览调优
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

#### Dock 鼠标悬停实时窗口缩略图（零延迟即消）
安装 **`Dock Window Preview`**（UUID: `dock-window-preview@quivio`），可实现类似 Windows / macOS 的悬停缩略图：
1. **水平卡片与灵敏度**：
   ```bash
   gsettings --schemadir ~/.local/share/glib-2.0/schemas/ set org.gnome.shell.extensions.dock-window-preview preview-layout 'horizontal'
   gsettings --schemadir ~/.local/share/glib-2.0/schemas/ set org.gnome.shell.extensions.dock-window-preview show-close-button true
   gsettings --schemadir ~/.local/share/glib-2.0/schemas/ set org.gnome.shell.extensions.dock-window-preview hover-delay-ms 150
   ```
2. **零延迟即时消失调优**：修改扩展目录中的 `extension.js`，将 `HIDE_DELAY_MS` 从 `240ms` 改为 `0ms`，将鼠标离开扫描周期 `POINTER_POLL_MS` 改为 `40ms`，实现鼠标悬停 0.15 秒弹出、移开瞬间 0 延迟消失。

### 2.5 GNOME 扩展清单
管理工具通过 `sudo apt install gnome-shell-extension-manager` 安装，目前启用的扩展包括：
* **User Themes** (`user-theme@gnome-shell-extensions.gcampax.github.com`)：解锁自定义 Shell 主题。
* **Blur my Shell** (`blur-my-shell@aunetx`)：应用抽屉与概览背景半透明毛玻璃效果。
* **Transparent Top Bar** (`transparent-top-bar@ftpix.com`)：顶栏 100% 全透明。
* **Dock Window Preview** (`dock-window-preview@quivio`)：Dock 栏悬停实时窗口预览卡片。
* **Logo Menu** (`logomenu@aryan_k`)：顶栏左侧系统菜单入口。
* **Vitals** (`Vitals@CoreCoding.com`)：顶栏显示 CPU、内存、实时网速与存储状态。
* **Compiz Magic Lamp** (`compiz-alike-magic-lamp-effect@hermes83.github.com`)：窗口最小化神奇缩放动效。
* **Ubuntu AppIndicators** (`ubuntu-appindicators@ubuntu.com`)：系统托盘图标支持与居中对齐。

### 2.6 一键美化与恢复脚本速查
重装系统或新机配置时，可直接保存执行以下脚本一键还原整套美化：

```bash
#!/usr/bin/env bash
# 一键应用桌面美化与透明配置

# 1. 应用主题
gsettings set org.gnome.desktop.interface cursor-theme 'WhiteSur-cursors'
gsettings set org.gnome.desktop.interface icon-theme 'Tela'
gsettings set org.gnome.desktop.interface gtk-theme 'Orchis-Light'
gsettings set org.gnome.shell.extensions.user-theme name 'Orchis-Light'

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

## 3. Rime 输入法与小鹤双拼

### 实施细节
* **安装依赖**：
  ```bash
  sudo apt install -y ibus-rime librime-bin librime-plugin-lua
  ```
* **同步 Mac 词库与配置**：从 Mac 共享路径 `/media/psf/Home/Library/Rime` 同步雾凇拼音（`rime_ice`）、双拼方案、词库文件（`cn_dicts/`、`en_dicts/`）、自定义短语（`custom_phrase.txt`）、Lua 插件及 OpenCC 规则到 `~/.config/ibus/rime/`。
* **设定默认方案**：在 `default.custom.yaml` 中将 `double_pinyin_flypy`（小鹤双拼）置于首位。
* **行内拼音显示**：在 `ibus_rime.custom.yaml` 中配置 `style/preedit_style: composition`，使输入框内直接显示键入的拼音字母（如 `na xie`），按空格确认后汉字上屏。
* **快捷键**：输入法切换键设为 `Ctrl + Space`（避免与 macOS 的 Spotlight 冲突），中英文在 Rime 内通过 `Shift` 切换。

## 4. 终端环境（Ghostty）

### 安装与默认终端切换
1. 通过 `sudo apt install -y ghostty` 安装官方 ARM64 版本。
2. 注册为默认终端：
   ```bash
   sudo update-alternatives --install /usr/bin/x-terminal-emulator x-terminal-emulator /usr/bin/ghostty 50
   sudo update-alternatives --set x-terminal-emulator /usr/bin/ghostty
   ```
3. 绑定快捷键 `Ctrl + Alt + T` 唤起 Ghostty，并将 Dock 栏中的终端图标替换为 Ghostty。

### 渲染问题修复
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

## 5. 浏览器环境（Brave）

### 5.1 移除 Firefox
```bash
sudo snap remove --purge firefox
sudo apt remove --purge -y firefox
rm -rf ~/snap/firefox ~/.mozilla
```

### 5.2 安装 Brave 并配置企业策略
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

## 6. 系统底层与外设优化

### 6.1 ZRAM 内存实时压缩
* 安装 `zram-tools` 并启用 `zramswap.service`。
* 在 `/etc/default/zramswap` 中将压缩算法设为 `zstd`，容量上限设为 100% 物理内存（5.3GB），优先级设为 100。
* **效果**：系统可用 Swap 扩充至 9.1GB，优先在内存中压缩暂存不活跃数据，避免因内存不足触发磁盘 I/O 卡顿。

### 6.2 截图快捷键
* 将交互式截图工具快捷键绑定为 `Ctrl + Shift + S`：
  ```bash
  gsettings set org.gnome.shell.keybindings show-screenshot-ui "['Print', '<Control><Shift>s', '<Super><Shift>s']"
  ```
* 支持区域框选、窗口截图与屏幕录制，截图自动存入剪贴板并保存在 `~/Pictures/Screenshots`。

### 6.3 剪贴板与拖拽服务
创建 Systemd 用户守护服务 `~/.config/systemd/user/parallels-tools-user.service` 并安装 `wl-clipboard` 与 `xclip`，确保登录后自动恢复与 Mac 宿主机的双向剪贴板和文件拖放支持。

### 6.4 系统监控与任务管理（Mission Center）
* 安装了 **Mission Center**，界面风格和交互逻辑几乎是 Windows 任务管理器的翻版，支持直观监控 CPU、内存、磁盘 I/O、网络利用率及细粒度进程管理，相比原生系统监视器更加直观好用。

### 6.5 Nautilus 一级右键菜单扩展（复制文件路径）
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

## 7. 常用软件与 Antigravity 开发环境

### 7.1 原生 ARM64 常用生产力软件（LocalSend & PeaZip）
* **LocalSend（局域网跨平台隔空互传）**：
  * 官方 Linux aarch64 原生 Flutter 构建，安装于 `~/.local/share/localsend`，支持桌面图标点击与终端 `localsend` 命令启动。
* **PeaZip（7-Zip 核心专业图形化压缩/解压管理器）**：
  * 官方 7-Zip 原生 Linux 版仅有 CLI 命令行工具（`7zz`），PeaZip 是 Linux 下成熟强大的 7-Zip 图形化管理工具，支持多标签页、密码加密、分卷压缩，并已关联为系统中 `.7z`、`.zip`、`.rar`、`.tar.gz` 等所有常见压缩格式的默认打开程序。

### 7.2 Antigravity 部署与修复
* **部署与权限**：安装于 `/opt/antigravity`，修复 `chrome-sandbox` 权限，生成 `/usr/local/bin/antigravity` 全局命令与桌面图标。
* **标题栏色差与窗口唤醒修复**：
  * 修改 `dist/ipcHandlers.js`，将主题同步平台判断放宽至非 macOS 系统，使 Linux 下窗口按钮区域颜色与主题实时匹配。
  * 修改 `dist/main.js` 中的 `second-instance` 事件逻辑，修复在 `Ctrl + W` 关闭窗口后点击 Dock 无法重新呼出界面的问题。
* **自动打补丁脚本**：编写 `/opt/antigravity/patch-linux-fixes.js` 并在启动脚本中调用，确保应用自动更新后补丁依然生效。

### 7.3 现代开发工具
* **uv**：安装于 `/usr/local/bin/uv`，用于 Python 环境隔离和包管理。
* **OpenCLI**：全局安装 `@jackwener/opencli`，并部署相关 skills 到 `~/.gemini/config/skills/`。
