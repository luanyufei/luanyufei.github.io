---
title: 为 IINA 实现左右键长按倍速与松手恢复：原生插件与避坑全记录
slug: iina-arrow-key-speed-control-plugin
date: 2026-10-04 20:25:00
categories: 实用技巧
tags:
  - macOS
  - 生产力
  - 折腾记录
---

在移动端（Bilibili、YouTube）以及主流网页播放器中，长按方向键或屏幕进行 2× 倍速播放、松开立即恢复原速早已成为肌肉记忆。但在 macOS 上主力播放器 IINA 中，默认的左右方向键只能机械地向前/向后快进 5 秒。

平时遇到冗长过渡镜头想快速扫过，或者遇到精彩画面想短按微调时，固定的快进快退既容易跳过关键细节，反复狂按也极为繁琐。虽然 IINA 社区中关于“长按倍速”的 Feature Request（如 Issue #4437、#4929）讨论已久，但官方主分支至今并未内置该特性。

为了在本地彻底解决这个问题，我通过 IINA 原生插件系统实现了一套完整的双模方案：**按住右键 2.0× 加速、按住左键 0.5× 慢放、松手立即恢复原本速度；同时保留短按轻敲依然快进/快退 5 秒**。本文记录完整的技术方案、踩坑点与一键安装配置代码，方便日后查阅与多设备复用。

## 方案选型：为什么不用 mpv Lua 脚本？

IINA 底层基于 mpv，而 mpv 原生支持在 `~/.config/mpv/scripts/` 中编写 Lua 脚本。理论上可以通过 mpv 的 `mp.add_forced_key_binding(..., {complex = true})` 监听按键的 down 与 up 事件。

但在实际测试中，mpv 脚本在 IINA 上的体验并不理想：

1. **事件层级被吞**：IINA 的 macOS Cocoa 界面层与快捷键系统接管了大量全局输入，mpv 动态注册的复合按键经常无法收到干净的 `up`（释放）事件，导致播放器一直卡在加速状态。
2. **系统告警音（Beep）**：当按住方向键触发系统键盘连发时，由于 IINA 无法正确消费底层事件，macOS 会高频触发无效按键的“咚咚咚”报警音。
3. **UI 体验割裂**：无法调用 IINA 现代化的原生 OSD 浮层样式与插件偏好设置界面。

好在从 IINA 1.4.0 开始，官方推出了基于 JavaScript 的**原生插件体系（IINA Plugin API）**。它直接提供了 `iina.input.onKeyDown` 与 `iina.input.onKeyUp`，官方文档更直接点名该接口就是为了“hold to seek / hold to speed”等精细交互设计的，能够精准阻断系统连发并与 IINA UI 深度融合。

## 核心实现逻辑与避坑点

整个插件的核心目标是提供与现代流媒体一致的丝滑感，开发过程中有几个值得注意的细节：

### 1. 过滤系统按键自动重复（isRepeat）

在 macOS 系统中，按住一个键盘按键不放时，系统会在初始延迟后以数十次每秒的频率连续发送 `KeyDown` 事件。如果不加处理，长按期间会不断重置定时器或反复调用加速命令。

IINA 插件 API 在回调参数中提供了 `data.isRepeat` 标志：

```javascript
input.onKeyDown("RIGHT", (data) => {
  if (data && data.isRepeat) return true; // 直接拦截，忽略后续连发
  if (rightDown) return true;
  rightDown = true;
  // ...
  return true;
}, input.PRIORITY_HIGH);
```

通过返回 `true` 并声明 `input.PRIORITY_HIGH`，不仅可以过滤自身状态，还能彻底阻断系统报警音。

### 2. 智能双模：短按快进与长按倍速兼得

很多纯倍速脚本会直接废掉方向键原本的快进/快退功能。但日常看视频时，轻点一下微调几秒进度的需求依然很高。

因此我们引入一个延迟判定窗口（默认 250ms）：

- **按下按键**：启动 250ms 的定时器；
- **如果在 250ms 内松开**（轻按短敲）：清除定时器，执行相对 seek（快进或快退 5 秒）；
- **如果持续按住超过 250ms**：定时器触发，记录当前速度与暂停状态，切换为目标倍速并弹出 OSD 提示；松开时直接还原速度。

### 3. 记忆基准速度与暂停状态保持

- **基准速度记忆**：如果视频原本就在 1.25× 或 1.5× 播放，长按加速松手后应该恢复到原来的速度，而不是武断地重置为 1.0×。插件在每次进入长按前，读取 `mpv.getNumber("speed")` 进行暂存。
- **暂停状态唤醒**：当视频处于暂停时，按住右键通常是想快速走带预览画面。此时自动将 `pause` 设为 `false`，松手恢复原速的同时自动恢复暂停状态。

### 4. mpv.command 的参数类型陷阱

在实现短按快进时，最初尝试直接调用 `mpv.command("seek", 5)`，结果发现长按加减速一切正常，但短按完全无反应。

查阅 IINA 插件 TypeScript 声明才发现，IINA 封装的 `mpv.command` 签名严格要求参数为**字符串数组**：

```typescript
mpv.command(name: string, args: string[]): void
```

传入原始数字会导致类型校验在 Swift 桥接层失败。正确的调用方式必须将参数转为字符串并显式指定相对 seek：

```javascript
// 快进 5 秒
mpv.command("seek", [String(step), "relative"]);
// 快退 5 秒
mpv.command("seek", [`-${step}`, "relative"]);
```

### 5. 快捷键配置优先级解绑

IINA 内置的默认快捷键预设（`IINA Default`）对左右键的绑定（`RIGHT seek 5` / `LEFT seek -5`）具有顶层优先级，这会抢在插件前消费按键事件，导致插件无法捕获松开（KeyUp）。

解决方法非常简单：在 `~/Library/Application Support/com.colliderli.iina/input_conf/` 中派生一份配置文件（如 `ArrowSpeed.conf`），保留所有默认快捷键，仅将 `RIGHT` 和 `LEFT` 两行注释掉，让左右键完全交由插件接管。

## 完整源码

插件由 3 个文件构成，存放在 `~/Library/Application Support/com.colliderli.iina/plugins/com.antigravity.iina-arrow-speed.iinaplugin/` 目录下。

### 1. Info.json（清单配置）

```json
{
  "name": "Arrow Key Speed Control",
  "identifier": "com.antigravity.iina-arrow-speed",
  "version": "1.0.1",
  "description": "Hold Right Arrow to speed up, Left Arrow to slow down, release to restore original speed. Tap for seek.",
  "author": {
    "name": "Antigravity",
    "email": "",
    "url": ""
  },
  "entry": "main.js",
  "minApiVersion": "1.1",
  "minIINAVersion": "1.4.0",
  "permissions": [
    "show-osd"
  ],
  "preferencesPage": "preferences.html",
  "preferenceDefaults": {
    "fastSpeed": 2.0,
    "slowSpeed": 0.5,
    "holdDelay": 250,
    "seekStep": 5,
    "enableTapSeek": true
  }
}
```

### 2. main.js（核心业务脚本）

```javascript
// Arrow Key Speed Control — IINA Plugin
// Hold Right = Speed Up, Hold Left = Slow Down. Release = Restore Speed. Tap = Seek.

const { core, input, mpv, event, menu, console: log } = iina;

// 读取用户偏好配置（含严格兜底）
const getFastSpeed = () => {
  const val = iina.preferences.get("fastSpeed");
  return val != null && !isNaN(val) ? Number(val) : 2.0;
};
const getSlowSpeed = () => {
  const val = iina.preferences.get("slowSpeed");
  return val != null && !isNaN(val) ? Number(val) : 0.5;
};
const getHoldDelay = () => {
  const val = iina.preferences.get("holdDelay");
  return val != null && !isNaN(val) ? Number(val) : 250;
};
const getSeekStep = () => {
  const val = iina.preferences.get("seekStep");
  return val != null && !isNaN(val) ? Number(val) : 5;
};
const getTapSeek = () => {
  const val = iina.preferences.get("enableTapSeek");
  return val != null ? Boolean(val) : true;
};

// 运行时状态
let rightTimer = null;
let leftTimer = null;
let isHoldingRight = false;
let isHoldingLeft = false;
let rightDown = false;
let leftDown = false;
let savedSpeed = 1.0;
let wasPausedRight = false;
let wasPausedLeft = false;

// 跟踪文件加载与播放基础速度
event.on("iina.file-loaded", () => {
  savedSpeed = mpv.getNumber("speed") || 1.0;
});

function restoreSpeed() {
  try {
    mpv.set("speed", savedSpeed);
    core.osd(`▶  恢复 ${savedSpeed}× 正常速度`);
    log.log(`[arrow-speed] restored speed to ${savedSpeed}×`);
  } catch (e) {
    log.log("[arrow-speed] restoreSpeed error: " + e);
  }
}

// ──────────────────────────────────────────────
// 右方向键 (Right Arrow) -> 加速 / 快进
// ──────────────────────────────────────────────
function handleRightDown(data) {
  if (data && data.isRepeat) return true; // 拦截系统重复触发，防止抖动
  if (rightDown) return true;

  rightDown = true;
  isHoldingRight = false;

  // 记录按下前的真实速度（若未处于左键慢放中）
  if (!isHoldingLeft) {
    savedSpeed = mpv.getNumber("speed") || 1.0;
    wasPausedRight = mpv.getFlag("pause");
  }

  const delay = getHoldDelay();
  if (delay <= 0) {
    // 零延迟模式：立即加速
    isHoldingRight = true;
    const speed = getFastSpeed();
    if (wasPausedRight) mpv.set("pause", false);
    mpv.set("speed", speed);
    core.osd(`▶▶  ${speed}× 加速播放`);
    log.log(`[arrow-speed] boost to ${speed}× (zero delay)`);
  } else {
    // 延迟判定：超过阈值视为长按加速
    rightTimer = setTimeout(() => {
      if (!rightDown) return;
      isHoldingRight = true;
      const speed = getFastSpeed();
      if (wasPausedRight) mpv.set("pause", false);
      mpv.set("speed", speed);
      core.osd(`▶▶  ${speed}× 加速播放`);
      log.log(`[arrow-speed] hold detected -> boost to ${speed}×`);
    }, delay);
  }

  return true;
}

function handleRightUp() {
  rightDown = false;

  if (rightTimer !== null) {
    clearTimeout(rightTimer);
    rightTimer = null;
  }

  if (isHoldingRight) {
    // 结束长按，恢复原本速度与暂停状态
    restoreSpeed();
    if (wasPausedRight) {
      mpv.set("pause", true);
    }
    isHoldingRight = false;
  } else if (getTapSeek()) {
    // 短按：快进对应步长（严格传递字符串数组）
    const step = getSeekStep();
    try {
      mpv.command("seek", [String(step), "relative"]);
      core.osd(`▶▶ 快进 +${step}s`);
      log.log(`[arrow-speed] tap seek executed: +${step}s`);
    } catch (e) {
      log.log(`[arrow-speed] tap seek failed: ` + e);
    }
  }

  return true;
}

// ──────────────────────────────────────────────
// 左方向键 (Left Arrow) -> 慢放 / 快退
// ──────────────────────────────────────────────
function handleLeftDown(data) {
  if (data && data.isRepeat) return true;
  if (leftDown) return true;

  leftDown = true;
  isHoldingLeft = false;

  if (!isHoldingRight) {
    savedSpeed = mpv.getNumber("speed") || 1.0;
    wasPausedLeft = mpv.getFlag("pause");
  }

  const delay = getHoldDelay();
  if (delay <= 0) {
    isHoldingLeft = true;
    const speed = getSlowSpeed();
    if (wasPausedLeft) mpv.set("pause", false);
    mpv.set("speed", speed);
    core.osd(`◀◀  ${speed}× 慢放播放`);
    log.log(`[arrow-speed] slow down to ${speed}× (zero delay)`);
  } else {
    leftTimer = setTimeout(() => {
      if (!leftDown) return;
      isHoldingLeft = true;
      const speed = getSlowSpeed();
      if (wasPausedLeft) mpv.set("pause", false);
      mpv.set("speed", speed);
      core.osd(`◀◀  ${speed}× 慢放播放`);
      log.log(`[arrow-speed] hold detected -> slow down to ${speed}×`);
    }, delay);
  }

  return true;
}

function handleLeftUp() {
  leftDown = false;

  if (leftTimer !== null) {
    clearTimeout(leftTimer);
    leftTimer = null;
  }

  if (isHoldingLeft) {
    restoreSpeed();
    if (wasPausedLeft) {
      mpv.set("pause", true);
    }
    isHoldingLeft = false;
  } else if (getTapSeek()) {
    const step = getSeekStep();
    try {
      mpv.command("seek", [`-${step}`, "relative"]);
      core.osd(`◀◀ 快退 -${step}s`);
      log.log(`[arrow-speed] tap seek executed: -${step}s`);
    } catch (e) {
      log.log(`[arrow-speed] tap seek failed: ` + e);
    }
  }

  return true;
}

// 注册监听器（大写 mpv key code，高优先级拦截）
input.onKeyDown("RIGHT", handleRightDown, input.PRIORITY_HIGH);
input.onKeyUp("RIGHT", handleRightUp, input.PRIORITY_HIGH);

input.onKeyDown("LEFT", handleLeftDown, input.PRIORITY_HIGH);
input.onKeyUp("LEFT", handleLeftUp, input.PRIORITY_HIGH);

// ──────────────────────────────────────────────
// 快捷菜单栏支持（在播放中方便随时切换常用倍速）
// ──────────────────────────────────────────────
const FAST_SPEED_OPTIONS = [1.5, 2.0, 2.5, 3.0, 4.0];
const SLOW_SPEED_OPTIONS = [0.25, 0.5, 0.75];

function buildPluginMenu() {
  try {
    menu.removeAllItems();
    const currentFast = getFastSpeed();
    const currentSlow = getSlowSpeed();

    const fastMenu = menu.item(`右键加速 (${currentFast}×)`, null);
    FAST_SPEED_OPTIONS.forEach((spd) => {
      fastMenu.addSubMenuItem(
        menu.item(`${spd}×`, () => {
          iina.preferences.set("fastSpeed", spd);
          iina.preferences.persist();
          core.osd(`右键加速已设为: ${spd}×`);
          buildPluginMenu();
        }, { selected: spd === currentFast })
      );
    });
    menu.addItem(fastMenu);

    const slowMenu = menu.item(`左键慢放 (${currentSlow}×)`, null);
    SLOW_SPEED_OPTIONS.forEach((spd) => {
      slowMenu.addSubMenuItem(
        menu.item(`${spd}×`, () => {
          iina.preferences.set("slowSpeed", spd);
          iina.preferences.persist();
          core.osd(`左键慢放已设为: ${spd}×`);
          buildPluginMenu();
        }, { selected: spd === currentSlow })
      );
    });
    menu.addItem(slowMenu);
  } catch (err) {
    log.log("[arrow-speed] build menu error: " + err);
  }
}

buildPluginMenu();
log.log("[arrow-speed] plugin loaded and listeners initialized");
```

### 3. preferences.html（偏好设置面板）

可以在 IINA 偏好设置中以图形化滑块自由调节各项数值，完整适配系统的暗色与浅色外观：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    :root { color-scheme: light dark; }
    body {
      padding: 18px 24px;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: -apple-system-label;
      margin: 0;
      user-select: none;
    }
    .group-title {
      font-weight: 600;
      margin-bottom: 12px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.7;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    label { width: 170px; flex-shrink: 0; }
    input[type="range"] { flex: 1; margin: 0 12px; }
    .value-display {
      width: 60px;
      text-align: right;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .checkbox-row {
      display: flex;
      align-items: center;
      margin-top: 10px;
      margin-bottom: 14px;
    }
    .checkbox-row input { margin-right: 8px; }
    .hint {
      font-size: 11px;
      opacity: 0.65;
      line-height: 1.4;
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid rgba(128, 128, 128, 0.2);
    }
  </style>
</head>
<body>
  <div class="group-title">长按速度控制</div>
  <div class="row">
    <label for="fastSpeed">右键长按加速倍速：</label>
    <input type="range" id="fastSpeed" min="1.25" max="5.0" step="0.25" value="2.0" />
    <span class="value-display" id="fastSpeedDisplay">2.0×</span>
  </div>
  <div class="row">
    <label for="slowSpeed">左键长按慢放倍速：</label>
    <input type="range" id="slowSpeed" min="0.1" max="0.9" step="0.05" value="0.5" />
    <span class="value-display" id="slowSpeedDisplay">0.50×</span>
  </div>

  <div class="group-title" style="margin-top: 18px;">触发与短按行为</div>
  <div class="row">
    <label for="holdDelay">长按判定延迟 (ms)：</label>
    <input type="range" id="holdDelay" min="0" max="600" step="25" value="250" />
    <span class="value-display" id="holdDelayDisplay">250ms</span>
  </div>
  <div class="row">
    <label for="seekStep">短按快进/快退步长 (秒)：</label>
    <input type="range" id="seekStep" min="1" max="30" step="1" value="5" />
    <span class="value-display" id="seekStepDisplay">5s</span>
  </div>
  <div class="checkbox-row">
    <input type="checkbox" id="enableTapSeek" checked />
    <label for="enableTapSeek" style="width: auto;">短按轻点保留快进/快退功能</label>
  </div>
  <div class="hint">
    💡 提示：按住右键加速、按住左键慢放，松手立即恢复原速。<br/>
    轻敲一下方向键则执行快进/快退 5 秒。若想纯按住加速/慢放（无快进延迟），可将判定延迟拉至 0ms。
  </div>

  <script>
    function getPrefs() {
      try { return (window.iina || iina).preferences; } catch(e) { return null; }
    }
    const prefs = getPrefs();

    const fastSpeed = document.getElementById("fastSpeed");
    const fastSpeedDisplay = document.getElementById("fastSpeedDisplay");
    const slowSpeed = document.getElementById("slowSpeed");
    const slowSpeedDisplay = document.getElementById("slowSpeedDisplay");
    const holdDelay = document.getElementById("holdDelay");
    const holdDelayDisplay = document.getElementById("holdDelayDisplay");
    const seekStep = document.getElementById("seekStep");
    const seekStepDisplay = document.getElementById("seekStepDisplay");
    const enableTapSeek = document.getElementById("enableTapSeek");

    function updateDisplays() {
      fastSpeedDisplay.textContent = parseFloat(fastSpeed.value).toFixed(2).replace(/\.?0+$/, "") + "×";
      slowSpeedDisplay.textContent = parseFloat(slowSpeed.value).toFixed(2) + "×";
      holdDelayDisplay.textContent = parseInt(holdDelay.value) + "ms";
      seekStepDisplay.textContent = parseInt(seekStep.value) + "s";
    }

    try {
      if (prefs) {
        const fs = prefs.get("fastSpeed");
        const ss = prefs.get("slowSpeed");
        const hd = prefs.get("holdDelay");
        const st = prefs.get("seekStep");
        const et = prefs.get("enableTapSeek");

        if (fs != null) fastSpeed.value = fs;
        if (ss != null) slowSpeed.value = ss;
        if (hd != null) holdDelay.value = hd;
        if (st != null) seekStep.value = st;
        if (et != null) enableTapSeek.checked = Boolean(et);
      }
    } catch(e) {}
    updateDisplays();

    function savePref(key, value) {
      try {
        if (prefs) {
          prefs.set(key, value);
          prefs.persist();
        }
      } catch(e) {}
    }

    fastSpeed.addEventListener("input", () => {
      updateDisplays();
      savePref("fastSpeed", parseFloat(fastSpeed.value));
    });
    slowSpeed.addEventListener("input", () => {
      updateDisplays();
      savePref("slowSpeed", parseFloat(slowSpeed.value));
    });
    holdDelay.addEventListener("input", () => {
      updateDisplays();
      savePref("holdDelay", parseInt(holdDelay.value));
    });
    seekStep.addEventListener("input", () => {
      updateDisplays();
      savePref("seekStep", parseInt(seekStep.value));
    });
    enableTapSeek.addEventListener("change", () => {
      savePref("enableTapSeek", enableTapSeek.checked);
    });
  </script>
</body>
</html>
```

## 一键配置与生效

为确保 IINA 的默认快捷键不抢占事件，我们在 `input_conf` 目录下生成专属配置，并通过 `defaults` 激活插件与配置文件：

```bash
# 1. 复制官方默认快捷键，并解绑左右方向键
CONF_DIR="$HOME/Library/Application Support/com.colliderli.iina/input_conf"
mkdir -p "$CONF_DIR"
sed -e 's/^RIGHT seek  5/# RIGHT seek  5/' \
    -e 's/^LEFT  seek -5/# LEFT  seek -5/' \
    /Applications/IINA.app/Contents/Resources/config/iina-default-input.conf \
    > "$CONF_DIR/ArrowSpeed.conf"

# 2. 启用该快捷键预设与插件
defaults write com.colliderli.iina currentInputConfigName "ArrowSpeed"
defaults write com.colliderli.iina "PluginEnabled.com.antigravity.iina-arrow-speed" -bool true
```

配置完成后重启 IINA（`Cmd + Q` 彻底退出后再打开），长按倍速与短按快进即可无缝工作。

## 总结

通过 IINA 原生插件系统介入按键生命周期，既避免了 mpv Lua 脚本在 macOS 上的事件截获缺陷，又在不损失原有轻敲快进退体验的前提下，补齐了类似 Bilibili / YouTube 的长按倍速交互。整个方案纯本地执行、无外部依赖，也为后续开发其他自定义手势与交互扩展提供了可靠的原型模板。
