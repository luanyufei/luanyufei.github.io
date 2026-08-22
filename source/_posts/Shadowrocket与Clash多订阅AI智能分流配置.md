---
title: Shadowrocket & Clash 进阶优化指南
date: 2026-08-19 09:30:00
categories: 实用技巧
tags:
  - Shadowrocket
  - Clash
  - Mihomo
  - 代理分流
  - AI
  - Android
  - iOS
  - macOS
---

机场默认提供的订阅配置通常只做最基础的粗粒度分流，直接拿来日常主力使用往往会遇到各种体验瓶颈：

- **节点纯净度与流量成本冲突**：大流量机场看视频流畅、价格便宜，但出口多为数据中心 IP，访问 Gemini、Claude 等平台极易触发风控拦截；专线节点纯净度高，但单价昂贵且流量有限，拿来跑日常下载十分浪费。
- **协议与 DNS 握手卡顿**：Google 资产的 QUIC (UDP 443) 协议容易在代理链路中丢包转圈；DNS 如果死锁海外公共地址，还会导致国内微信、抖音等应用分到海外 CDN，拖慢直连体验。
- **移动端配置脆弱易丢**：自建的分流规则在手机客户端（如 Android Clash Meta）一旦触发定时刷新，容易被远端订阅直接覆盖冲掉。

本文从**协议层防护、DNS 本地化、多订阅流量调度、规则集加速以及多端持久化**五个维度，整理一套通用的进阶优化体系，并提供 iOS、macOS/Windows 以及 Android 的完整落地配置。

## 进阶优化体系

整个优化体系聚焦于网络传输质量、分流精确度与客户端稳定性：

```
[全部出站流量]
      │
      ├── 1. 协议与防泄漏 ────> 拦截 UDP 443 (降级 TCP) / 屏蔽 IPv6
      │
      ├── 2. DNS 与直连优化 ──> 国内系统 DNS 解析 + Loyalsoldier 白名单直连 (国内应用)
      │
      ├── 3. 视频大流量前置 ──> YouTube / 视频服务直通主力日常机场 (省专线)
      │
      ├── 4. AI 资产全域闭环 ──> Gemini / Claude / ChatGPT / Google API 全量路由至专线
      │
      └── 5. 兜底与日常代理 ──> 主力机场承载其余未知海外流量
```

## 核心机制与排坑实践

### 1. 协议降级：阻断 QUIC (UDP 443) 规避丢包卡顿

Chromium 内核浏览器与移动端 App 访问 Google 资产时，默认优先走基于 UDP 443 端口的 QUIC 协议。由于绝大多数代理节点对 UDP 转发的优化有限，极易发生握手挂起或高丢包，导致页面白屏转圈。

**解决策略**：在规则链顶层显式拦截目标域名的 UDP 443 请求。浏览器在 UDP 握手超时前收到 REJECT 响应后，会毫秒级平滑降级到稳定的 TCP (HTTPS) 通道。

### 2. DNS 防污染与 CDN 本地化：防止国内流量误入代理

很多配置为了防污染，把客户端 DNS 强行指向 `8.8.8.8` 或 `1.1.1.1` 并关闭了本地系统解析。这在国内网络环境下会带来两个问题：
1. 向境外公共 DNS 发起纯文本 UDP 53 查询极易被劫持；
2. 境外的 Anycast DNS 在解析微信、抖音、淘宝等大厂服务时，会将其解析到位于新加坡或日本的海外 CDN 节点，导致下游的 `GEOIP,CN` 规则误判失效，让国内流量白白绕道代理。

**解决策略**：保留国内公共 DNS（如阿里 `223.5.5.5`、腾讯 `119.29.29.29`）或系统 DNS 负责国内域名解析，海外域名交由代理节点远程解析或经由加密 DNS (DoH/DoT) 解析。

### 3. 多订阅协同：主力日常 + 专线 AI 流量分层

设定两套订阅角色：
- **订阅 A（主力日常）**：承载日常网页浏览、大文件下载与 YouTube 4K 视频；
- **订阅 B（专线 / 解锁）**：仅用于分流规则中指定的 AI 与鉴权请求。

为了防止看 YouTube 视频把昂贵的专线流量耗尽，必须把 `googlevideo.com`、`youtube.com` 等视频域名在规则链中前置并绑定到主力机场；随后再将 Gemini 相关规则收拢到专线策略组。

### 4. AI 会话闭环：底层鉴权与推理接口全量收拢

Gemini、Claude 等并非单一域名服务，而是由多组后端分布式接口协同工作。以 Google Gemini 为例：
- 前端交互：`gemini.google.com`
- 推理与生成式接口：`generativelanguage.googleapis.com`
- 鉴权与账号状态：`clients6.google.com`、`oauth2.googleapis.com`
- 渲染素材与多模态资源：`googleusercontent.com`

如果规则只写了 `gemini.google.com`，页面通信时发起的后台鉴权 API 会滑落到兜底规则并走主力机场。服务端检测到同一会话存在未解锁的 IP 地址，便会判定会话异常并直接中断。因此必须对关联的底层 API 进行全量规则闭环。

### 5. 节点池净化：剔除机场虚拟提示节点

很多机场订阅会在节点列表顶部插入形如 `剩余流量：985.3 GB`、`距离下次重置剩余：27 天` 的提示性虚拟节点。如果直接把节点列表全量填入 `自动选择` 或 `故障转移` 策略组，一旦用户消耗了流量或跨越了日期，机场服务端返回的节点名称就会变化。策略组找不到旧名称时，内核会抛出 `'剩余流量：xxx' not found` 错误并拒绝启动。

**解决策略**：在静态策略组中过滤掉包含 `剩余流量`、`到期`、`重置`、`官网` 等关键词的提示节点，只保留真实的代理服务器。

### 6. 移动端本地化持久：防止订阅更新覆盖自建分流

桌面端可以通过扩展脚本（如 `Script.js`）在每次订阅更新后自动注入自定义规则，但移动端（如 Android 版 Clash Meta）默认没有脚本后处理层。如果将主订阅作为在线 URL 导入并直接修改本地 `config.yaml`，客户端一旦执行定时刷新，就会重新下载机场的原始裸配置，把我们辛辛苦苦改好的 AI 规则全量冲掉。

**解决策略**：将移动端配置转存为本地文件（`File` 模式），切断客户端从 URL 自动下载覆盖主配置的通道；同时在配置内部配置 `proxy-providers`，把副订阅（AI 专线）交由内核在后台独立静默更新。

### 7. 规则库加速：使用国内 CDN 镜像防静默失效

Shadowrocket 与 Clash 在拉取远程规则集失败时（如规则源路径写错返回 404，或国内网络直连 GitHub 超时），通常不会报错打断，而是将该规则集静默置空，导致大量分流规则失效。引用开源规则库（如 Loyalsoldier）时，建议统一使用 jsDelivr 等国内可稳定直连的 CDN 镜像源。

## 一、 iOS / iPadOS：Shadowrocket 配置

### 操作步骤

1. 打开 Shadowrocket，点击右上角 `+`，类型选择 `Subscribe`，分别添加订阅 A 和订阅 B；
2. 进入底栏 **“设置” -> “订阅”**，开启“打开时更新”与“自动后台更新”；
3. 进入底栏 **“配置”**，点击当前配置文件右侧的 `(i)` -> 点击 **“编辑纯文本”**；
4. 清空原有内容，粘贴下方完整配置并保存；
5. 回到小火箭首页，全局路由选择 **“配置”**，节点列表选中订阅 A 的主力节点。

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
# 筛选订阅 B 中包含“新加坡”的可用节点，每 5 分钟自动测速优选
AI-Services = url-test, url = http://www.gstatic.com/generate_204, interval = 300, tolerance = 50, policy-regex-filter=新加坡|🇸🇬|SG

[Rule]
# 1. 协议阻断：拦截 Google UDP 443，强制回退 TCP
AND,((DEST-PORT,443),(PROTOCOL,UDP),(DOMAIN-SUFFIX,google.com)),REJECT
AND,((DEST-PORT,443),(PROTOCOL,UDP),(DOMAIN-SUFFIX,googleapis.com)),REJECT
AND,((DEST-PORT,443),(PROTOCOL,UDP),(DOMAIN-SUFFIX,gstatic.com)),REJECT
AND,((DEST-PORT,443),(PROTOCOL,UDP),(DOMAIN-SUFFIX,googleusercontent.com)),REJECT
AND,((DEST-PORT,443),(PROTOCOL,UDP),(DOMAIN-SUFFIX,googlevideo.com)),REJECT

# 2. YouTube 视频大流量前置（走主力机场 PROXY，不耗专线）
DOMAIN-SUFFIX,googlevideo.com,PROXY
DOMAIN-SUFFIX,youtube.com,PROXY
DOMAIN-SUFFIX,youtu.be,PROXY
DOMAIN-SUFFIX,ytimg.com,PROXY
DOMAIN-SUFFIX,youtubei.googleapis.com,PROXY
DOMAIN-SUFFIX,yt3.ggpht.com,PROXY

# 3. AI 资产与底层 API 闭环（路由至 AI-Services 策略组）
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

# 4. Loyalsoldier 远程精细分流规则库（jsDelivr CDN 加速）
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

## 二、 macOS / Windows：Clash Verge Rev 扩展脚本

桌面端使用 Clash Verge Rev（Mihomo 内核）时，利用**扩展脚本 (Script)** 可以实现配置与规则解耦：订阅更新后，Verge 会自动执行脚本重新注入规则，无需手动反复修改。

### 操作步骤

1. 在客户端中正常导入订阅 A（设为主力激活配置）和订阅 B；
2. 进入 **“订阅 (Profiles)”** -> 右键主力订阅 A -> 选择 **“脚本 (Script)”**；
3. 粘贴下方代码，将 `UNLOCK_SUB_URL` 替换为真实的订阅 B 链接；
4. 保存后右键点击订阅 A 选择 **“刷新”** 即可生效。

### 扩展脚本代码（`Script.js`）

```javascript
function main(config, profileName) {
  // 1. 防泄漏与 DNS 规则遵从
  config["ipv6"] = false;
  if (config["dns"]) {
    config["dns"]["ipv6"] = false;
    config["dns"]["respect-rules"] = true;
  }

  // 2. 自定义参数（替换为真实的专线订阅链接）
  const UNLOCK_SUB_URL = "https://sub-b.com/link";
  const AI_GROUP_NAME = "AI-Services";
  const NODE_FILTER = "新加坡|🇸🇬|SG";

  // 3. 注入 proxy-providers（按正则过滤专线节点池）
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
  config["proxy-groups"] = config["proxy-groups"].filter(g => g.name !== AI_GROUP_NAME);

  // 4. 自动探测主力机场的代理策略组名称
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

  // 6. 引入 Loyalsoldier 远程精细规则库 (jsDelivr CDN)
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

  // ② YouTube 视频前置（走主力机场）
  const youtubeRules = [
    `DOMAIN-SUFFIX,googlevideo.com,${mainProxyGroupName}`,
    `DOMAIN-SUFFIX,youtube.com,${mainProxyGroupName}`,
    `DOMAIN-SUFFIX,youtu.be,${mainProxyGroupName}`,
    `DOMAIN-SUFFIX,ytimg.com,${mainProxyGroupName}`,
    `DOMAIN-SUFFIX,youtubei.googleapis.com,${mainProxyGroupName}`,
    `DOMAIN-SUFFIX,yt3.ggpht.com,${mainProxyGroupName}`
  ];

  // ③ AI 专属规则与底层 API 闭环（路由至 AI-Services）
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

## 三、 Android：Clash Meta 本地持久化配置

安卓端客户端（如 Clash Meta for Android、Flclash）没有桌面端的扩展脚本环境。为了避免订阅自动刷新时冲掉自建分流规则，需要采用 **本地配置（File 模式）+ 内核级 Provider 自动更新** 的组合拳。

### 操作步骤

1. 在客户端中新建一个配置，类型选择 **“本地文件 (File)”**（若已有 URL 订阅，可在应用内导出为本地文件）；
2. 剔除主力节点列表中包含 `剩余流量`、`到期时间` 等提示性虚拟节点，防止策略组解析报错；
3. 将副订阅（AI 专线）作为 `proxy-providers` 写入本地 YAML，由 Mihomo 内核每隔 5 分钟在后台静默更新节点；
4. 激活该本地配置。

### 核心配置结构模板（`config.yaml` 关键片段）

```yaml
# 1. 专线节点池：内核后台独立拉取，不依赖客户端 UI 刷新
proxy-providers:
  ai-provider:
    type: http
    url: "https://sub-b.com/link"
    interval: 86400
    path: ./proxy_providers/ai_nodes.yaml
    filter: "新加坡|🇸🇬|SG"
    health-check:
      enable: true
      interval: 300
      url: http://www.gstatic.com/generate_204

# 2. 策略组结构（净化提示节点）
proxy-groups:
  - name: AI-Services
    type: url-test
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50
    use:
      - ai-provider
  - name: 主力代理
    type: select
    proxies:
      - 自动选择
      - 故障转移
      # 此处填入主力机场的真实节点名，切勿包含“剩余流量”等虚拟节点
      - 🇯🇵日本-01
      - 🇺🇸美国-01
  - name: 自动选择
    type: url-test
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50
    proxies:
      - 🇯🇵日本-01
      - 🇺🇸美国-01

# 3. 规则部分：注入 QUIC 阻断、YouTube 前置、AI 闭环与 Loyalsoldier 规则库
rules:
  # ① QUIC 阻断
  - AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,google.com)),REJECT
  - AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,googleapis.com)),REJECT
  - AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,gstatic.com)),REJECT
  - AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,googleusercontent.com)),REJECT
  - AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,googlevideo.com)),REJECT
  # ② YouTube 前置走主力
  - DOMAIN-SUFFIX,googlevideo.com,主力代理
  - DOMAIN-SUFFIX,youtube.com,主力代理
  - DOMAIN-SUFFIX,youtu.be,主力代理
  - DOMAIN-SUFFIX,ytimg.com,主力代理
  # ③ AI 全量闭环走专线
  - DOMAIN-KEYWORD,antigravity,AI-Services
  - DOMAIN-KEYWORD,gemini,AI-Services
  - DOMAIN-KEYWORD,colab,AI-Services
  - DOMAIN-KEYWORD,deepmind,AI-Services
  - DOMAIN-SUFFIX,gemini.google.com,AI-Services
  - DOMAIN-SUFFIX,bard.google.com,AI-Services
  - DOMAIN-SUFFIX,ai.google.dev,AI-Services
  - DOMAIN-SUFFIX,aistudio.google.com,AI-Services
  - DOMAIN-SUFFIX,clients6.google.com,AI-Services
  - DOMAIN-SUFFIX,googleusercontent.com,AI-Services
  - DOMAIN-SUFFIX,googleapis.com,AI-Services
  # ④ Loyalsoldier 国内直连与主力兜底
  - RULE-SET,applications,DIRECT
  - RULE-SET,private,DIRECT
  - RULE-SET,reject,REJECT
  - RULE-SET,icloud,DIRECT
  - RULE-SET,apple,主力代理
  - RULE-SET,proxy,主力代理
  - RULE-SET,gfw,主力代理
  - RULE-SET,direct,DIRECT
  - GEOIP,LAN,DIRECT,no-resolve
  - GEOIP,CN,DIRECT
  - MATCH,主力代理
```

## 四、 规则扩展与多模型适配

若后续需要将分流规则扩展至其他主流 AI 平台，只需在各端的 AI 规则区追加相应域名即可：

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
