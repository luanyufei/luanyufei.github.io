---
title: Shadowrocket & Clash 进阶优化指南
slug: shadowrocket-clash-advanced-guide
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

机场默认提供的订阅配置通常只做最基础的粗粒度分流，直接拿来当主力用经常会碰到各种瓶颈：大流量机场看视频流畅，但出口多为机房 IP，访问 Gemini、Claude 极易触发风控限制；专线节点纯净度高，但价格贵流量少，拿来跑日常下载太浪费。同时，移动端的客户端如果没有配置好，自己辛辛苦苦改好的分流规则一刷新就会被机场原始配置全量覆盖。

本文整理了一套通用的进阶优化经验，并提供 iOS、电脑端以及安卓端的完整落地配置参考模板。

## 优化经验

### 1. 协议降级：阻断 QUIC (UDP 443) 规避丢包卡顿

Chromium 内核浏览器与移动端 App 访问 Google 资产时，默认优先走基于 UDP 443 端口的 QUIC 协议。大多数代理节点对 UDP 转发的优化有限，极易发生握手挂起或高丢包，导致页面白屏转圈。

在规则链顶层显式拦截目标域名的 UDP 443 请求，迫使浏览器在超时前收到拒绝响应，从而毫秒级平滑降级到稳定的 TCP (HTTPS) 通道。

```text
# Shadowrocket 写法
AND,((DEST-PORT,443),(PROTOCOL,UDP),(DOMAIN-SUFFIX,google.com)),REJECT
AND,((DEST-PORT,443),(PROTOCOL,UDP),(DOMAIN-SUFFIX,googleapis.com)),REJECT

# Clash 写法
- AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,google.com)),REJECT
- AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,googleapis.com)),REJECT
```

### 2. DNS 防污染与 CDN 本地化：防止国内流量误入代理

很多网上的配置为了防污染，把客户端 DNS 强行指向 `8.8.8.8` 并关闭系统 DNS。在国内环境下，向境外公共 DNS 发起纯文本 UDP 53 查询极易被劫持；且境外的 Anycast DNS 在解析微信、淘宝等国内服务时，会分配海外 CDN 节点，导致下游的 `GEOIP,CN` 规则误判失效，让国内流量白白绕道代理。

应保留国内公共 DNS 或系统 DNS 负责国内域名解析，海外域名交由代理节点远程解析。

```ini
# Shadowrocket 配置示例
dns-server = system, 223.5.5.5, 119.29.29.29
fallback-dns-server = 8.8.8.8, 1.1.1.1
dns-direct-system = true
```

### 3. 多订阅协同：视频大流量前置，剥离专线消耗

设定两套订阅角色：订阅 A（主力日常）承载大文件下载与 YouTube 4K 视频；订阅 B（专线 / 解锁）仅用于 AI 请求。

为了防止看视频把昂贵的专线流量耗尽，由于代理规则是从上往下匹配的，必须把 `googlevideo.com` 等视频域名写在前面绑定主力机场，将剩余的 Google 服务收拢到专线。

```text
# 1. 视频请求提前被拦截走主力机场
DOMAIN-SUFFIX,googlevideo.com,主力机场
DOMAIN-SUFFIX,youtube.com,主力机场

# 2. 剩余的 AI 请求再进专线策略组
DOMAIN-KEYWORD,gemini,AI专线
```

### 4. AI 会话闭环：底层鉴权与推理接口全量收拢

Gemini、Claude 等服务由多组后端分布式接口协同工作。如果规则只写了前端域名 `gemini.google.com`，页面通信时发起的后台鉴权 API （如 `clients6`）就会滑落到兜底规则走主力机场。服务端检测到同一会话的请求 IP 撕裂，就会判定会话异常并直接中断。

必须对底层 API 进行全域收拢，确保所有通信都在同一节点 IP 下进行。

```text
DOMAIN-SUFFIX,gemini.google.com,AI专线
DOMAIN-SUFFIX,generativelanguage.googleapis.com,AI专线
DOMAIN-SUFFIX,clients6.google.com,AI专线
DOMAIN-SUFFIX,oauth2.googleapis.com,AI专线
DOMAIN-SUFFIX,googleusercontent.com,AI专线
```

### 5. 节点池净化：剔除机场虚拟提示节点

很多机场会在节点列表中插入 `剩余流量：985.3 GB`、`距离下次重置：27 天` 的虚拟节点。如果直接把节点列表全量写进静态的 `自动选择` 或 `故障转移` 策略组，用户消耗了流量或跨越了日期，机场服务端下发的节点名称就会变化。策略组在本地找不到写死的旧名称，内核就会抛出 `'剩余流量：xxx' not found` 错误并直接拒绝启动。

```yaml
# Clash 策略组中，严禁混入虚拟节点，仅填写真实的服务器节点名称
- name: 自动选择
  type: url-test
  proxies:
    - 🇯🇵日本-01
    - 🇺🇸美国-01
    # 绝对不能填入 - 剩余流量：985.3 GB
```

### 6. 移动端本地化持久：防止订阅更新覆盖自建分流

安卓端（如 Clash Meta for Android）默认没有桌面端的脚本注入功能。如果在客户端把主订阅作为在线 URL 导入，然后手动去改本地的 `config.yaml` 加上分流规则，一旦触发定时刷新，客户端就会重新下载机场的原始裸配置，把你写好的规则全量覆盖冲掉。

需要将移动端配置转存为本地文件（`File` 模式），切断客户端对该文件的自动下载覆盖。副订阅（AI 专线）的节点更新需求，直接通过配置文件里的 `proxy-providers` 交给内核去独立后台静默拉取。

```yaml
# 在 File 模式下的本地 config.yaml 中配置独立节点池
proxy-providers:
  ai-provider:
    type: http
    url: "https://sub-b.com/link"
    interval: 86400 # 独立控制后台拉取频率，不依赖客户端 UI 的订阅刷新
    path: ./proxy_providers/ai_nodes.yaml
    filter: "新加坡|🇸🇬|SG"
```

### 7. 规则库加速：使用国内 CDN 镜像防静默失效

拉取远程规则集失败时（如规则源路径写错，或国内网络直连 GitHub 遇到阻断），Shadowrocket 与 Clash 通常不会报错打断，而是直接将该规则集静默置空。这意味着数万条分流白名单根本没有加载进内存。引用开源规则库时，必须将原版的 GitHub 原生链接替换为 jsDelivr 等国内可稳定直连的 CDN 镜像源。

```text
# 错误写法（极易超时丢包）
RULE-SET,https://raw.githubusercontent.com/Loyalsoldier/surge-rules/release/apple.txt,PROXY

# 正确写法（CDN 稳定直连）
RULE-SET,https://cdn.jsdelivr.net/gh/Loyalsoldier/surge-rules@release/apple.txt,PROXY
```

## 配置文件参考模板

以下模板包含了上文提到的所有排坑措施。请根据实际需求替换其中的节点和订阅链接。

### iOS / iPadOS (Shadowrocket)

1. 在 Shadowrocket 右上角 `+` 分别导入订阅 A 和订阅 B；
2. 进入底栏 **“配置”**，点击当前配置文件右侧的 `(i)` -> 点击 **“编辑纯文本”**；
3. 清空原有内容，粘贴下方配置并保存；
4. 回到首页，全局路由选择 **“配置”**，节点列表选中订阅 A 的主力节点。

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

### 电脑端 (以 Clash Verge Rev 为例)

桌面端通过**扩展脚本 (Script)** 可以实现配置与规则解耦：更新机场订阅时，Verge 会重新执行脚本把自定义规则注入进去，无需手动反复修改配置文件。

1. 在客户端中正常导入订阅 A（设为主力激活配置）和订阅 B；
2. 进入 **“订阅 (Profiles)”** -> 右键主力订阅 A -> 选择 **“脚本 (Script)”**；
3. 粘贴下方代码，将 `UNLOCK_SUB_URL` 替换为真实的订阅 B 链接；
4. 保存后右键点击订阅 A 选择 **“启用”** 即可。

```javascript
function main(config, profileName) {
  // 防泄漏与 DNS 规则遵从
  config["ipv6"] = false;
  if (config["dns"]) {
    config["dns"]["ipv6"] = false;
    config["dns"]["respect-rules"] = true;
  }

  // 自定义参数（替换为真实的专线订阅链接）
  const UNLOCK_SUB_URL = "https://sub-b.com/link";
  const AI_GROUP_NAME = "AI-Services";
  const NODE_FILTER = "新加坡|🇸🇬|SG";

  // 注入 proxy-providers 专线节点池
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

  // 自动探测主力机场的代理策略组名称
  let mainProxyGroupName = "PROXY";
  const detectedGroup = config["proxy-groups"].find(
    g => g.type === "select" && g.name !== "GLOBAL" && g.name !== AI_GROUP_NAME
  );
  if (detectedGroup) {
    mainProxyGroupName = detectedGroup.name;
  }

  // 插入 AI 专属 URL-Test 自动测速策略组
  config["proxy-groups"].unshift({
    name: AI_GROUP_NAME,
    type: "url-test",
    url: "http://www.gstatic.com/generate_204",
    interval: 300,
    tolerance: 50,
    use: ["ai-provider"]
  });

  // 引入 Loyalsoldier 远程精细规则库 (jsDelivr CDN)
  config["rule-providers"] = config["rule-providers"] || {};
  const loyalProviders = {
    reject: { type: "http", behavior: "domain", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt", path: "./ruleset/loyalsoldier/reject.yaml", interval: 86400 },
    icloud: { type: "http", behavior: "domain", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/icloud.txt", path: "./ruleset/loyalsoldier/icloud.yaml", interval: 86400 },
    apple: { type: "http", behavior: "domain", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/apple.txt", path: "./ruleset/loyalsoldier/apple.yaml", interval: 86400 },
    proxy: { type: "http", behavior: "domain", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt", path: "./ruleset/loyalsoldier/proxy.yaml", interval: 86400 },
    direct: { type: "http", behavior: "domain", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt", path: "./ruleset/loyalsoldier/direct.yaml", interval: 86400 },
    private: { type: "http", behavior: "domain", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt", path: "./ruleset/loyalsoldier/private.yaml", interval: 86400 },
    gfw: { type: "http", behavior: "domain", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt", path: "./ruleset/loyalsoldier/gfw.yaml", interval: 86400 },
    greatfire: { type: "http", behavior: "domain", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/greatfire.txt", path: "./ruleset/loyalsoldier/greatfire.yaml", interval: 86400 },
    "tld-not-cn": { type: "http", behavior: "domain", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/tld-not-cn.txt", path: "./ruleset/loyalsoldier/tld-not-cn.yaml", interval: 86400 },
    telegramcidr: { type: "http", behavior: "ipcidr", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt", path: "./ruleset/loyalsoldier/telegramcidr.yaml", interval: 86400 },
    cncidr: { type: "http", behavior: "ipcidr", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt", path: "./ruleset/loyalsoldier/cncidr.yaml", interval: 86400 },
    lancidr: { type: "http", behavior: "ipcidr", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/lancidr.txt", path: "./ruleset/loyalsoldier/lancidr.yaml", interval: 86400 },
    applications: { type: "http", behavior: "classical", url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/applications.txt", path: "./ruleset/loyalsoldier/applications.yaml", interval: 86400 }
  };
  Object.assign(config["rule-providers"], loyalProviders);

  // 顶层 QUIC 拦截
  const quicBlockRules = [
    "AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,google.com)),REJECT",
    "AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,googleapis.com)),REJECT",
    "AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,gstatic.com)),REJECT",
    "AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,googleusercontent.com)),REJECT",
    "AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,googlevideo.com)),REJECT"
  ];

  // YouTube 视频前置
  const youtubeRules = [
    `DOMAIN-SUFFIX,googlevideo.com,${mainProxyGroupName}`,
    `DOMAIN-SUFFIX,youtube.com,${mainProxyGroupName}`,
    `DOMAIN-SUFFIX,youtu.be,${mainProxyGroupName}`,
    `DOMAIN-SUFFIX,ytimg.com,${mainProxyGroupName}`,
    `DOMAIN-SUFFIX,youtubei.googleapis.com,${mainProxyGroupName}`,
    `DOMAIN-SUFFIX,yt3.ggpht.com,${mainProxyGroupName}`
  ];

  // AI 底层 API 闭环
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

  // 日常流量兜底
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

### 安卓端 (Clash Meta)

由于安卓客户端（如 Clash Meta for Android、Flclash）没有扩展脚本功能，为避免更新订阅时丢掉分流规则，必须采用 **本地文件 (File) 模式 + 内核 proxy-providers 后台更新**。

1. 在客户端中新建配置，类型选择 **“本地文件 (File)”**；
2. 剔除主力节点列表中包含 `剩余流量` 等字眼的虚拟节点；
3. 将副订阅写入 `proxy-providers` 交给内核后台独立更新；
4. 保存后激活该本地配置。

以下为关键片段的结构模板（在完整的本地 yaml 文件中修改这三块即可）：

```yaml
# 1. 专线节点池：交由内核在后台独立拉取
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

# 2. 策略组结构（严禁混入虚拟节点名）
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
      # 此处填入真实的节点名称
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

# 3. 分流规则注入
rules:
  # QUIC 阻断
  - AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,google.com)),REJECT
  - AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,googleapis.com)),REJECT
  - AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,gstatic.com)),REJECT
  - AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,googleusercontent.com)),REJECT
  - AND,((DST-PORT,443),(NETWORK,UDP),(DOMAIN-SUFFIX,googlevideo.com)),REJECT
  
  # YouTube 剥离专线消耗
  - DOMAIN-SUFFIX,googlevideo.com,主力代理
  - DOMAIN-SUFFIX,youtube.com,主力代理
  - DOMAIN-SUFFIX,youtu.be,主力代理
  - DOMAIN-SUFFIX,ytimg.com,主力代理
  
  # AI 闭环走专线
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
  
  # Loyalsoldier 国内直连与兜底
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

## 规则扩展与多模型适配

若后续需要分流其他平台，只需在对应的 AI 规则区追加域名：

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
