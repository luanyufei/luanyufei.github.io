---
title: 给 IINA 加上长按倍速：左右键加速慢放，短按快进退
slug: iina-arrow-key-speed-control-plugin
date: 2026-10-04 20:25:00
categories: 实用技巧
tags:
  - macOS
  - 生产力
  - 折腾记录
---

平时在手机或网页上看视频，长按倍速、松开恢复原速用得很顺手。但在 Mac 上用 IINA 时，左右方向键默认只能固定快进/快退 5 秒。想快速过一下无聊片段时狂按快进容易跳过关键内容，按住不放又完全没反应。GitHub issue 里早有人提过这类需求（比如 #4437、#4929），但官方一直没有内置。

其实写一个 IINA 原生 JavaScript 插件就能解决：**按住右键 2.0× 加速，按住左键 0.5× 慢放，松手恢复原速；轻敲短按一下依然是快进/快退 5 秒**。

把插件代码和几个踩坑点记在这里，换机时直接复制就能用。

## 为什么不用 mpv Lua 脚本？

IINA 底层是 mpv，写 `~/.config/mpv/scripts/` 下的 Lua 脚本看起来最省事。但实际测试下来问题不少：

- **松手事件经常丢失**：IINA 的 Cocoa 界面会拦截输入，mpv 动态绑定的按键经常收不到 `up`（按键松开）事件，导致手都松开了视频还在 2 倍速狂飙；
- **系统报警音**：长按方向键触发系统键盘连发时，IINA 没法干净地消费底层事件，系统会一直发出“咚咚咚”的无效按键提示音；
- **调不到原生 UI**：没法使用 IINA 自带的 OSD 提示和偏好设置面板。

而从 IINA 1.4.0 开始支持的原生 JavaScript 插件系统，提供了 `iina.input.onKeyDown` 和 `iina.input.onKeyUp`，官方文档本身就提到这两个接口适用于“hold to speed / hold to seek”，能很好地处理长按拦截和松手还原。

## 实现细节与踩坑点

开发过程中有几个值得注意的细节：

### 1. 过滤系统按键自动重复（isRepeat）

在 macOS 里长按一个键，系统会在短暂延迟后以很高的频率连续发送 `KeyDown`。如果不处理，长按过程中会频繁重置计时器或重复触发命令。

IINA 插件 API 的回调参数里自带了 `data.isRepeat`，只要判断为重复事件就直接拦截：

```javascript
input.onKeyDown("RIGHT", (data) => {
  if (data && data.isRepeat) return true; // 直接拦截，忽略后续连发
  if (rightDown) return true;
  rightDown = true;
  // ...
  return true;
}, input.PRIORITY_HIGH);
```

通过返回 `true` 并声明 `input.PRIORITY_HIGH`，不仅可以过滤自身状态，还能彻底消除系统的“咚咚”报警音。

### 2. 短按快进与长按倍速兼得

日常看视频时，轻敲一下快进几秒微调进度的需求很常见，不能为了长按加速把短按快进搞丢了。

这里加了一个 250ms 的定时器：

- 按下时启动计时；
- 如果在 250ms 内松开（轻按短敲），清除定时器，正常执行快进/快退 5 秒；
- 如果按住超过 250ms（长按），进入倍速播放，松手时恢复。

### 3. 记住原本速度与暂停状态

- **原本速度**：如果视频原本就在 1.25× 播放，松手后应该回到 1.25×，而不是死板地重置为 1.0×。在长按前读一下 `mpv.getNumber("speed")` 存起来即可。
- **暂停状态**：暂停时长按右键，一般是想快进看看画面。这时候顺便把 `pause` 设为 `false`，松手时恢复倍速的同时也自动恢复暂停。

### 4. mpv.command 的参数必须是字符串数组

写短按快进时，顺手写了 `mpv.command("seek", 5)`，结果长按加减速正常，短按快进却毫无反应。

翻了 API 文档才发现，IINA 插件封装的 `mpv.command` 参数类型严格要求是 `string[]`：

```typescript
mpv.command(name: string, args: string[]): void
```

传数字会在 Swift 桥接层直接报错退出。正确的写法必须把秒数转为字符串，并带上相对寻轨参数：

```javascript
// 快进 5 秒
mpv.command("seek", [String(step), "relative"]);
// 快退 5 秒
mpv.command("seek", [`-${step}`, "relative"]);
```

### 5. 解绑默认的左右键快捷键

IINA 自带的快捷键预设优先级很高，会抢在插件前把左右键给拦截了，导致插件收不到松手事件。

解决方法很简单：在 `~/Library/Application Support/com.colliderli.iina/input_conf/` 里放一份配置文件（比如 `ArrowSpeed.conf`），保留其他所有默认按键，只把 `RIGHT seek 5` 和 `LEFT seek -5` 注释掉，让左右键完全交给插件处理。

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

可以在 IINA 偏好设置中以图形化滑块调节数值，适配系统的暗色与浅色外观：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    :root {
      color-scheme: light dark;
    }
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
    label {
      width: 170px;
      flex-shrink: 0;
    }
    input[type="range"] {
      flex: 1;
      margin: 0 12px;
    }
    .val {
      width: 60px;
      text-align: right;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .check-row {
      display: flex;
      align-items: center;
      margin: 12px 0 14px;
    }
    .check-row input {
      margin-right: 8px;
    }
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
    <span class="val" id="fastSpeedDisplay">2.0×</span>
  </div>

  <div class="row">
    <label for="slowSpeed">左键长按慢放倍速：</label>
    <input type="range" id="slowSpeed" min="0.1" max="0.9" step="0.05" value="0.5" />
    <span class="val" id="slowSpeedDisplay">0.50×</span>
  </div>

  <div class="group-title" style="margin-top: 18px;">触发与短按行为</div>

  <div class="row">
    <label for="holdDelay">长按判定延迟 (ms)：</label>
    <input type="range" id="holdDelay" min="0" max="600" step="25" value="250" />
    <span class="val" id="holdDelayDisplay">250ms</span>
  </div>

  <div class="row">
    <label for="seekStep">短按快进/快退步长 (秒)：</label>
    <input type="range" id="seekStep" min="1" max="30" step="1" value="5" />
    <span class="val" id="seekStepDisplay">5s</span>
  </div>

  <div class="check-row">
    <input type="checkbox" id="enableTapSeek" checked />
    <label for="enableTapSeek" style="width: auto;">短按轻点保留快进/快退功能</label>
  </div>

  <div class="hint">
    💡 提示：按住右键加速、按住左键慢放，松手立即恢复原速。轻敲方向键则快进/快退 5 秒。若想纯按住加速（无快进延迟），可将判定延迟拉至 0ms。
  </div>

  <script>
    const prefs = (window.iina || iina)?.preferences;
    const fastSpeed = document.getElementById("fastSpeed");
    const fastDisp = document.getElementById("fastSpeedDisplay");
    const slowSpeed = document.getElementById("slowSpeed");
    const slowDisp = document.getElementById("slowSpeedDisplay");
    const holdDelay = document.getElementById("holdDelay");
    const holdDisp = document.getElementById("holdDelayDisplay");
    const seekStep = document.getElementById("seekStep");
    const seekDisp = document.getElementById("seekStepDisplay");
    const enableTapSeek = document.getElementById("enableTapSeek");

    function update() {
      fastDisp.textContent = parseFloat(fastSpeed.value).toFixed(2).replace(/\.?0+$/, "") + "×";
      slowDisp.textContent = parseFloat(slowSpeed.value).toFixed(2) + "×";
      holdDisp.textContent = parseInt(holdDelay.value) + "ms";
      seekDisp.textContent = parseInt(seekStep.value) + "s";
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
    } catch (e) {}
    update();

    function save(key, val) {
      try {
        prefs?.set(key, val);
        prefs?.persist();
      } catch (e) {}
    }

    fastSpeed.addEventListener("input", () => {
      update();
      save("fastSpeed", parseFloat(fastSpeed.value));
    });
    slowSpeed.addEventListener("input", () => {
      update();
      save("slowSpeed", parseFloat(slowSpeed.value));
    });
    holdDelay.addEventListener("input", () => {
      update();
      save("holdDelay", parseInt(holdDelay.value));
    });
    seekStep.addEventListener("input", () => {
      update();
      save("seekStep", parseInt(seekStep.value));
    });
    enableTapSeek.addEventListener("change", () => {
      save("enableTapSeek", enableTapSeek.checked);
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

配置完成后重启 IINA（`Cmd + Q` 彻底退出后再打开），长按倍速与短按快进即可正常工作。
