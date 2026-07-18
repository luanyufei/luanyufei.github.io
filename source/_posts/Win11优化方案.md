---
title: Windows 11 优化方案
date: 2026-07-18
categories: 实用技巧
---

Windows 11 自带了大量臃肿功能和恼人的 UI 变动。以下是一套完整的优化方案，涵盖精简系统、还原经典界面、激活、禁用更新等。

## 精简系统镜像

与其装完再删，不如一开始就用精简版镜像。GitHub 上有两个知名项目：

- **Tiny11** — 删除了大部分无用系统组件，保留核心功能，适合大多数人
- **nano11** — 比 Tiny11 更激进的精简方案，适合追求极致精简的用户

在 GitHub 搜索 `Tiny11` 或 `nano11` 即可找到。配合 **Rufus**（开源刷机工具）制作启动 U 盘进行安装。

## 还原经典开始菜单和任务栏

Win11 的开始菜单和任务栏改动很大，如果你更习惯 Win10 的风格，可以使用 **StartAllBack** 一键还原。

下载地址：<https://www.ghxi.com/startallback.html>

## 还原经典右键菜单

Win11 的右键菜单默认只显示几个选项，完整菜单被折叠了。用以下方法可以恢复 Win10 样式的完整右键菜单。

以**管理员身份**打开 CMD 或 PowerShell，输入：

```powershell
reg add "HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32" /f /ve
```

然后重启资源管理器即可生效。

如果想恢复回 Win11 默认右键菜单：

```powershell
reg delete "HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}" /f
```

## 关闭动画和半透明效果

打开 **设置 → 辅助功能 → 视觉效果**，关闭以下两项：

- **动画效果** — 关闭
- **透明效果** — 关闭

关闭后系统响应会更跟手，尤其对低配机器提升明显。

## 激活 Windows 和 Office

以**管理员身份**打开 CMD 或 PowerShell，输入：

```powershell
irm https://get.activated.win | iex
```

在弹出的菜单中选择：

- `[1] HWID` — 永久激活 Windows（硬件数字许可证）
- `[2] Ohook` — 永久激活 Office

## 永久禁止 Windows 更新

使用 **Windows Update Blocker** 工具，一键永久禁止自动更新：

下载地址：<https://www.sordum.org/downloads/?st-windows-update-blocker>

## 删除 / 禁用 Win11 无用功能

**Chris Titus Tech** 的 Windows 工具箱，提供图形界面，一键删除或禁用各种臃肿功能。

以**管理员身份**打开 CMD 或 PowerShell，输入：

```powershell
irm https://christitus.com/win | iex
```

GitHub 项目地址：<https://github.com/ChrisTitusTech/winutil>

## 系统汉化

如果安装的是英文版 Windows，参考以下教程进行汉化：

<https://www.cnblogs.com/ACDIV/p/19156603>

## 推荐软件

- **Flow Launcher** — 开源的快速启动器，类似 macOS 的 Spotlight，按快捷键即可搜索应用、文件、网页等
