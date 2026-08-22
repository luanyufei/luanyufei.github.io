---
title: Shadowrocket & Clash 进阶分流指南：多订阅 AI 调度与排坑实践
date: 2026-08-19 09:30:00
categories: 实用技巧
tags:
  - Shadowrocket
  - Clash
  - Mihomo
  - 代理分流
  - AI
---

日常使用代理服务时，单套订阅往往很难兼顾所有场景：

- **主力日常机场**：流量多、带宽足、看高码率视频流畅，但节点出口多为机房数据中心 IP，极易触发 Google Gemini、Claude 等严格的风控限制；
- **专线/解锁机场**：节点干净，能稳定访问各类 AI 服务，但单价高、流量有限，全量拿来跑日常下载和刷视频太浪费。

通过客户端的策略组（Proxy Group / Proxy Provider）与分流规则，我们可以把两套订阅结合起来：**日常网页、视频与下载走主力机场，AI 相关请求自动走专线解锁节点，国内流量完全直连。**

但如果只是简单地把 `gemini.google.com` 指向解锁节点，经常会遇到页面无限转圈、图片无法生成或频繁提示“当前地区不受支持”。这里先整理八个常见排坑点，随后提供适用于 **Shadowrocket** 与 **Clash (Mihomo)** 的完整配置方案。

## 分流架构设计

为了便于直接套用，本文设定两套通用订阅模型：

- **订阅 A（主力日常机场）**：
  - 角色定位：作为全局默认的 `PROXY` 出口，承载绝大部分日常流量与 4K 视频。
- **订阅 B（AI 专线 / 解锁机场）**：
  - 角色定位：仅用于分流规则中指定的 AI 请求与鉴权通信。

```
                       ┌─── [国内流量] ───────> DIRECT 直连
                       │
[全部网络请求] ───────┼─── [YouTube/普通网页] ──> 订阅 A (主力日常机场)
                       │
                       └─── [Gemini/Antigravity/AI API] ──> 订阅 B (新加坡专线)
```

整个分流链条分为四个层级：
1. **顶层协议拦截**：阻断目标域名的 UDP 443 (QUIC)，强制回退至稳定的 TCP；
2. **大流量视频前置**：将 `googlevideo.com`、`youtube.com` 等前置指向主力机场，防止看视频消耗昂贵的专线流量；
3. **AI 资产全域闭环**：将 Gemini、Antigravity 及底层通信接口（`clients6.google.com`、`googleapis.com` 等）统一收拢至专线策略组；
4. **精细化直连与兜底**：通过 Loyalsoldier 规则库保障国内流量直连，其余流量由主力机场兜底。

## 八大底层陷阱与排坑复盘

### 1. 会话撕裂与底层接口漏网

Gemini 并非单一网页，而是由前端界面与多组后端 API 协同通信：
- 前端页面接入：`gemini.google.com`
- 模型推理与生成式接口：`generativelanguage.googleapis.com`、`appsgenaiserver-pa.googleapis.com`
- 核心鉴权与账号状态：`clients6.google.com`、`oauth2.googleapis.com`
- 多模态图片渲染：`googleusercontent.com`
- 开发者与关联平台：`aistudio.google.com`、`ai.google.dev`、`deepmind.google`

若规则列表中仅配置了 `gemini.google.com`，页面交互时后台发起的 `oauth2` 或 `clients6` 请求会落入兜底规则，被送往未解锁的主力机场。服务端检测到同一会话内存在未解锁 IP，便会直接中断连接或判定地区受限。因此必须将底层 API 进行全域收拢。

### 2. QUIC (HTTP/3) 握手挂起

Chromium 内核浏览器与 Safari 访问 Google 服务时，默认优先发起基于 UDP 443 端口的 QUIC 连接。多数代理节点在转发 UDP 流量时的稳定性不如 TCP，极易发生丢包或握手超时，导致页面长时间空白。在规则顶层拦截目标域名的 UDP 443 请求，可促使浏览器快速降级至稳定的 TCP (HTTPS) 通道。

### 3. 香港节点的地区黑洞

Google Gemini 至今未对中国香港地区开放服务。若策略组对订阅 B 的全部节点进行无差别测速，香港节点通常因物理距离近、延迟低而胜出，导致请求被送往不支持的地区。在策略组中必须配置正则过滤，强制仅保留新加坡、日本或美国等受支持地区的节点。

### 4. IPv6 真实地址泄漏

当本地网络支持 IPv6 且客户端未做防护时，浏览器发起的 AAAA 查询若未被代理内核接管，流量可能通过本地运营商网络直连，暴露出真实 IP 归属地。建议在代理配置中全局关闭 IPv6 解析。

### 5. DNS 解析错位导致国内流量误入代理

有些配置会把客户端 DNS 强行指定为 `8.8.8.8` 或 `1.1.1.1` 并关闭系统 DNS。在国内网络环境下，向 `8.8.8.8` 发起 UDP 53 查询极易受到污染；即便未被污染，海外公共 DNS 在解析微信、抖音、网易云等大厂服务时，往往会分配它们位于海外（如新加坡或日本）的 CDN 节点。这直接导致下游的 `GEOIP,CN` 规则判定失效，让本该直连的国内流量一路滑落到底部的 `FINAL,PROXY`。保留国内/系统 DNS 来处理直连解析才是正确的做法。

### 6. 远程规则集拉取失败与静默回退

Shadowrocket 与 Clash 在拉取远程规则集失败时（例如规则源路径写错返回 404，或国内网络直连 `raw.githubusercontent.com` 超时），通常不会弹出报错提示，而是将该规则集静默置空。这意味着写在配置里的数万条域名白名单可能根本没有加载进内存。引用远程规则时，建议使用国内可稳定直连的 CDN 镜像（如 jsDelivr），并确认文件路径与扩展名准确无误。

### 7. 移动端订阅更新覆盖自建分流规则

桌面端的 Clash Verge Rev 可以通过扩展脚本在订阅更新后动态注入规则，但安卓端（如 Clash Meta for Android）默认缺少这种后处理层。如果在安卓客户端中将主订阅作为在线 URL 导入后直接修改本地的 `config.yaml`，一旦触发定时更新或手动刷新，客户端就会重新下载机场的原始配置，直接把自建的 AI 规则和 `proxy-providers` 覆盖成空白。处理这类客户端时，需要将配置转存为本地文件（File 模式）来切断远端全量覆盖，同时将副订阅（AI 专线）交由配置内部的 `proxy-providers` 进行后台独立更新。

### 8. 机场虚拟提示节点导致策略组解析崩溃

许多机场订阅会在节点列表中塞入形如 `剩余流量：985.3 GB`、`距离下次重置剩余：27 天` 的提示性虚拟节点。如果直接将节点全量填入 `自动选择` 或 `故障转移` 策略组，一旦用户消耗了流量或跨越了日期，机场服务端返回的节点名称就会发生变动。由于策略组中记录的旧节点名失效，Clash 内核在校验时会抛出 `'剩余流量：xxx' not found` 错误并直接拒绝启动。在配置静态策略组时，必须剔除这类包含流量或到期关键词的非代理节点。

## 一、 Shadowrocket（iOS / iPadOS）配置方案

### 操作步骤

1. 打开 Shadowrocket，点击右上角 `+`，类型选择 `Subscribe`，分别添加订阅 A 和订阅 B；
2. 进入底栏 **“设置” -> “订阅”**，开启“打开时更新”与“自动后台更新”；
3. 进入底栏 **“配置”**，点击当前使用的配置文件（如 `default.conf`）右侧的 `(i)` -> 点击 **“编辑纯文本”**；
4. 清空原有内容，粘贴下方完整配置并保存；
5. 回到小火箭首页，全局路由选择 **“配置”**，在节点列表中选中订阅 A 的某个节点作为主力节点。

### 完整配置文件（`.conf`）

```ini
[General]
bypass-system = true
skip-proxy = 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, localhost, *.local, captive.apple.com
tun-excluded-routes = 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.0.0.0/24, 192.0.2.0/24, 192.88.99.0/24, 192.168.0.0/16, 198.51.100.0/24, 203.0.113.0/24, 224.0.0.0/4, 255.255.255.255/32, 239.255.255.250/32
dns-server = system, 223.5.5.5, 119.29.29.29
fallback-dns-server = 8.8.8.8, 1.1.1.1
ipv6 = false
prefer-ipv6 = false
dns-fallback-system = false
dns-direct-system = true
icmp-auto-reply = true
always-reject-url-rewrite = false
private-ip-answer = true
dns-direct-fallback-proxy = true
udp-policy-not-supported-behaviour = REJECT

[Proxy Group]
# 策略组：通过 policy-regex-filter 筛选订阅 B 中包含“新加坡”的节点，每 5 分钟测速并选取最快节点
AI-Services = url-test, url = http://www.gstatic.com/generate_204, interval = 300, tolerance = 50, policy-regex-filter=新加坡|🇸🇬|SG

[Rule]
# 1. 协议阻断：拦截 Google UDP 443，强制回退至稳定 TCP
AND,((DEST-PORT,443),(PROTOCOL,UDP),(DOMAIN-SUFFIX,google.com)),REJECT
AND,((DEST-PORT,443),(PROTOCOL,UDP),(DOMAIN-SUFFIX,googleapis.com)),REJECT
AND,((DEST-PORT,443),(PROTOCOL,UDP),(DOMAIN-SUFFIX,gstatic.com)),REJECT
AND,((DEST-PORT,443),(PROTOCOL,UDP),(DOMAIN-SUFFIX,googleusercontent.com)),REJECT
AND,((DEST-PORT,443),(PROTOCOL,UDP),(DOMAIN-SUFFIX,googlevideo.com)),REJECT

# 2. YouTube 视频与普通服务前置（优先走主力机场 PROXY，不耗专线）
DOMAIN-SUFFIX,googlevideo.com,PROXY
DOMAIN-SUFFIX,youtube.com,PROXY
DOMAIN-SUFFIX,youtu.be,PROXY
DOMAIN-SUFFIX,ytimg.com,PROXY
DOMAIN-SUFFIX,youtubei.googleapis.com,PROXY
DOMAIN-SUFFIX,yt3.ggpht.com,PROXY

# 3. AI 资产与底层通信全量闭环（路由至 AI-Services 专线策略组）
DOMAIN-KEYWORD,antigravity,AI-Services
DOMAIN-KEYWORD,gemini,AI-Services
DOMAIN-KEYWORD,colab,AI-Services
DOMAIN-KEYWORD,deepmind,AI-Services
DOMAIN-SUFFIX,gemini.google.com,AI-Services
DOMAIN-SUFFIX,bard.google.com,AI-Services
DOMAIN-SUFFIX,aistudio.google.com,AI-Services
DOMAIN-SUFFIX,ai.google.dev,AI-Services
DOMAIN-SUFFIX,makersuite.google.com,AI-Services
DOMAIN-SUFFIX,deepmind.google,AI-Services
DOMAIN-SUFFIX,deepmind.com,AI-Services
DOMAIN-SUFFIX,clients6.google.com,AI-Services
DOMAIN-SUFFIX,googleusercontent.com,AI-Services
DOMAIN-SUFFIX,googleapis.com,AI-Services

# 4. Loyalsoldier 远程精细分流规则集（日常流量与订阅 A 兜底，走 jsDelivr CDN 加速）
RULE-SET,https://cdn.jsdelivr.net/gh/Loyalsoldier/surge-rules@release/private.txt,DIRECT
RULE-SET,https://cdn.jsdelivr.net/gh/Loyalsoldier/surge-rules@release/reject.txt,REJECT
RULE-SET,https://cdn.jsdelivr.net/gh/Loyalsoldier/surge-rules@release/icloud.txt,DIRECT
RULE-SET,https://cdn.jsdelivr.net/gh/Loyalsoldier/surge-rules@release/apple.txt,PROXY
RULE-SET,https://cdn.jsdelivr.net/gh/Loyalsoldier/surge-rules@release/proxy.txt,PROXY
RULE-SET,https://cdn.jsdelivr.net/gh/Loyalsoldier/surge-rules@release/gfw.txt,PROXY
RULE-SET,https://cdn.jsdelivr.net/gh/Loyalsoldier/surge-rules@release/greatfire.txt,PROXY
RULE-SET,https://cdn.jsdelivr.net/gh/Loyalsoldier/surge-rules@release/telegramcidr.txt,PROXY,no-resolve
RULE-SET,https://cdn.jsdelivr.net/gh/Loyalsoldier/surge-rules@release/direct.txt,DIRECT
RULE-SET,https://cdn.jsdelivr.net/gh/Loyalsoldier/surge-rules@release/cncidr.txt,DIRECT,no-resolve
GEOIP,CN,DIRECT
RULE-SET,https://cdn.jsdelivr.net/gh/Loyalsoldier/surge-rules@release/tld-not-cn.txt,PROXY
FINAL,PROXY
```

## 二、 Clash Verge Rev (Mihomo) 配置方案

在 Clash Verge Rev（或采用 Mihomo 内核的各类桌面客户端）中，利用 **扩展脚本 (Script)** 可以在不破坏订阅原文件的前提下，动态注入解锁节点池与分流规则。

无论在界面上切换到哪个主力机场，脚本均能自动识别当前的主策略组，无需反复手动修改配置文件。

### 操作步骤

1. 在客户端中正常导入订阅 A（设为主力激活订阅）和订阅 B；
2. 进入 **“订阅 (Profiles)”** -> 找到主力订阅 A，右键选择 **“脚本 (Script)”**；
3. 将下方代码复制进去，将其中的 `UNLOCK_SUB_URL` 替换为真实的订阅 B 链接；
4. 保存脚本后，右键点击订阅 A 选择 **“启用”** 或刷新即可生效。

### 扩展脚本代码（`Script.js`）

```javascript
function main(config, profileName) {
  // 1. 全局防泄漏设置
  config["ipv6"] = false;
  if (config["dns"]) {
    config["dns"]["ipv6"] = false;
    config["dns"]["respect-rules"] = true;
  }

  // 2. 自定义参数区（请将 UNLOCK_SUB_URL 替换为真实的订阅 B 链接）
  const UNLOCK_SUB_URL = "https://sub-b.com/link";
  const AI_GROUP_NAME = "AI-Services";
  const NODE_FILTER = "新加坡|🇸🇬|SG"; // 筛选解锁节点的正则表达式

  // 3. 注入 proxy-providers（仅加载订阅 B 中匹配正则的解锁节点）
  config["proxy-providers"] = config["proxy-providers"] || {};
  config["proxy-providers"]["ai-provider"] = {
    type: "http",
    url: UNLOCK_SUB_URL,
    interval: 86400,
    path: "./proxy_providers/ai_nodes.yaml",
    filter: NODE_FILTER,
    "health-check": {
      enable: true,
      interval: 300,
      url: "http://www.gstatic.com/generate_204"
    }
  };

  config["proxy-groups"] = config["proxy-groups"] || [];

  // 清除历史策略组避免重名
  config["proxy-groups"] = config["proxy-groups"].filter(g => g.name !== AI_GROUP_NAME);

  // 4. 自动探测当前主力机场的主策略组名称
  let mainProxyGroupName = "PROXY";
  const detectedGroup = config["proxy-groups"].find(
    g => g.type === "select" && g.name !== "GLOBAL" && g.name !== AI_GROUP_NAME
  );
  if (detectedGroup) {
    mainProxyGroupName = detectedGroup.name;
  }

  // 5. 插入 AI 专属 URL-Test 自动测速策略组
  config["proxy-groups"].unshift({
    name: AI_GROUP_NAME,
    type: "url-test",
    url: "http://www.gstatic.com/generate_204",
    interval: 300,
    tolerance: 50,
    use: ["ai-provider"]
  });

  // 6. 引入 Loyalsoldier 远程高精度规则库 (走 jsDelivr CDN 加速)
  config["rule-providers"] = config["rule-providers"] || {};
  const loyalProviders = {
    reject: {
      type: "http",
      behavior: "domain",
      url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt",
      path: "./ruleset/loyalsoldier/reject.yaml",
      interval: 86400
    },
    icloud: {
      type: "http",
      behavior: "domain",
      url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/icloud.txt",
      path: "./ruleset/loyalsoldier/icloud.yaml",
      interval: 86400
    },
    apple: {
      type: "http",
      behavior: "domain",
      url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/apple.txt",
      path: "./ruleset/loyalsoldier/apple.yaml",
      interval: 86400
    },
    proxy: {
      type: "http",
      behavior: "domain",
      url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt",
      path: "./ruleset/loyalsoldier/proxy.yaml",
      interval: 86400
    },
    direct: {
      type: "http",
      behavior: "domain",
      url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt",
      path: "./ruleset/loyalsoldier/direct.yaml",
      interval: 86400
    },
    private: {
      type: "http",
      behavior: "domain",
      url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt",
      path: "./ruleset/loyalsoldier/private.yaml",
      interval: 86400
    },
    gfw: {
      type: "http",
      behavior: "domain",
      url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt",
      path: "./ruleset/loyalsoldier/gfw.yaml",
      interval: 86400
    },
    greatfire: {
      type: "http",
      behavior: "domain",
      url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/greatfire.txt",
      path: "./ruleset/loyalsoldier/greatfire.yaml",
      interval: 86400
    },
    "tld-not-cn": {
      type: "http",
      behavior: "domain",
      url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/tld-not-cn.txt",
      path: "./ruleset/loyalsoldier/tld-not-cn.yaml",
      interval: 86400
    },
    telegramcidr: {
      type: "http",
      behavior: "ipcidr",
      url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt",
      path: "./ruleset/loyalsoldier/telegramcidr.yaml",
      interval: 86400
    },
    cncidr: {
      type: "http",
      behavior: "ipcidr",
      url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt",
      path: "./ruleset/loyalsoldier/cncidr.yaml",
      interval: 86400
    },
    lancidr: {
      type: "http",
      behavior: "ipcidr",
      url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/lancidr.txt",
      path: "./ruleset/loyalsoldier/lancidr.yaml",
      interval: 86400
    },
    applications: {
      type: "http",
      behavior: "classical",
      url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/applications.txt",
      path: "./ruleset/loyalsoldier/applications.yaml",
      interval: 86400
    }
  };
  Object.assign(config["rule-providers"], loyalProviders);

  // 7. 分流规则组装
  // ① 顶层 QUIC 拦截
  const quicBlockRules = [
    "AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,google.com)),REJECT",
    "AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,googleapis.com)),REJECT",
    "AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,gstatic.com)),REJECT",
    "AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,googleusercontent.com)),REJECT",
    "AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,googlevideo.com)),REJECT"
  ];

  // ② YouTube 视频与普通服务前置保护（走主力机场，不消耗专线）
  const youtubeRules = [
    `DOMAIN-SUFFIX,googlevideo.com,${mainProxyGroupName}`,
    `DOMAIN-SUFFIX,youtube.com,${mainProxyGroupName}`,
    `DOMAIN-SUFFIX,youtu.be,${mainProxyGroupName}`,
    `DOMAIN-SUFFIX,ytimg.com,${mainProxyGroupName}`,
    `DOMAIN-SUFFIX,youtubei.googleapis.com,${mainProxyGroupName}`,
    `DOMAIN-SUFFIX,yt3.ggpht.com,${mainProxyGroupName}`
  ];

  // ③ AI 专属规则与底层通信闭环（全量路由至 专线策略组）
  const aiRules = [
    `DOMAIN-KEYWORD,antigravity,${AI_GROUP_NAME}`,
    `DOMAIN-KEYWORD,gemini,${AI_GROUP_NAME}`,
    `DOMAIN-KEYWORD,colab,${AI_GROUP_NAME}`,
    `DOMAIN-KEYWORD,deepmind,${AI_GROUP_NAME}`,
    `DOMAIN-SUFFIX,gemini.google.com,${AI_GROUP_NAME}`,
    `DOMAIN-SUFFIX,bard.google.com,${AI_GROUP_NAME}`,
    `DOMAIN-SUFFIX,ai.google.dev,${AI_GROUP_NAME}`,
    `DOMAIN-SUFFIX,aistudio.google.com,${AI_GROUP_NAME}`,
    `DOMAIN-SUFFIX,makersuite.google.com,${AI_GROUP_NAME}`,
    `DOMAIN-SUFFIX,deepmind.google,${AI_GROUP_NAME}`,
    `DOMAIN-SUFFIX,deepmind.com,${AI_GROUP_NAME}`,
    `GEOSITE,google-gemini,${AI_GROUP_NAME}`,
    `GEOSITE,google-deepmind,${AI_GROUP_NAME}`,
    `DOMAIN-SUFFIX,clients6.google.com,${AI_GROUP_NAME}`,
    `DOMAIN-SUFFIX,googleusercontent.com,${AI_GROUP_NAME}`,
    `DOMAIN-SUFFIX,googleapis.com,${AI_GROUP_NAME}`
  ];

  // ④ 日常流量规则（对接主力机场）
  const loyalRules = [
    "RULE-SET,applications,DIRECT",
    "RULE-SET,private,DIRECT",
    "RULE-SET,reject,REJECT",
    "RULE-SET,icloud,DIRECT",
    `RULE-SET,apple,${mainProxyGroupName}`,
    `RULE-SET,proxy,${mainProxyGroupName}`,
    `RULE-SET,gfw,${mainProxyGroupName}`,
    `RULE-SET,greatfire,${mainProxyGroupName}`,
    `RULE-SET,telegramcidr,${mainProxyGroupName},no-resolve`,
    "RULE-SET,direct,DIRECT",
    "RULE-SET,lancidr,DIRECT,no-resolve",
    "RULE-SET,cncidr,DIRECT,no-resolve",
    "GEOIP,LAN,DIRECT,no-resolve",
    "GEOIP,CN,DIRECT",
    `RULE-SET,tld-not-cn,${mainProxyGroupName}`,
    `MATCH,${mainProxyGroupName}`
  ];

  config.rules = [...quicBlockRules, ...youtubeRules, ...aiRules, ...loyalRules];
  return config;
}
```

## 三、 规则扩展与多模型适配

若需要分流其他主流 AI 平台，可在配置中将相关域名直接追加至 AI 规则区（Shadowrocket 对应 `[Rule]` 顶层，Clash 对应 `aiRules` 数组）：

### 1. Claude (Anthropic)
```text
DOMAIN-SUFFIX,claude.ai
DOMAIN-SUFFIX,anthropic.com
```

### 2. OpenAI (ChatGPT)
```text
DOMAIN-SUFFIX,chatgpt.com
DOMAIN-SUFFIX,openai.com
DOMAIN-SUFFIX,oaistatic.com
DOMAIN-SUFFIX,oaiusercontent.com
```
