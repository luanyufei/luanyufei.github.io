---
title: Brave 浏览器去除无用功能 (macOS)
date: 2026-07-18
categories: 实用技巧
---

由于 Chrome 浏览器对去广告插件有反制机制——检测到去广告扩展后会让 YouTube 变得卡顿——所以我决定转用 Brave。然而 Brave 也自带了不少臃肿功能，比如 AI、钱包、VPN 等等。下面这个方法可以通过 macOS 配置描述文件把这些功能一次性全部禁用。

## Step 1：生成配置描述文件

把下面这段命令**整段**粘贴到终端里执行：

```bash
cat << 'EOF' > ~/Desktop/BraveDebloat.mobileconfig
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadContent</key>
            <dict>
                <key>com.brave.Browser</key>
                <dict>
                    <key>Forced</key>
                    <array>
                        <dict>
                            <key>mcx_preference_settings</key>
                            <dict>
                                <key>BraveWalletDisabled</key>
                                <true/>
                                <key>BraveAIChatEnabled</key>
                                <false/>
                                <key>BraveVPNDisabled</key>
                                <true/>
                                <key>BraveRewardsDisabled</key>
                                <true/>
                                <key>BraveNewsDisabled</key>
                                <true/>
                                <key>BraveP3AEnabled</key>
                                <false/>
                                <key>BraveStatsPingEnabled</key>
                                <false/>
                                <key>MetricsReportingEnabled</key>
                                <false/>
                                <key>BraveWebDiscoveryEnabled</key>
                                <false/>
                                <key>UrlKeyedAnonymizedDataCollectionEnabled</key>
                                <false/>
                                <key>UserFeedbackAllowed</key>
                                <false/>
                            </dict>
                        </dict>
                    </array>
                </dict>
            </dict>
            <key>PayloadEnabled</key>
            <true/>
            <key>PayloadIdentifier</key>
            <string>com.apple.ManagedClient.preferences.Brave</string>
            <key>PayloadType</key>
            <string>com.apple.ManagedClient.preferences</string>
            <key>PayloadUUID</key>
            <string>98765432-ABCD-EF01-2345-6789ABCDEF01</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>Brave Debloat</string>
    <key>PayloadDisplayName</key>
    <string>Brave Debloat</string>
    <key>PayloadIdentifier</key>
    <string>com.brave.debloat.profile</string>
    <key>PayloadOrganization</key>
    <string>LocalAdmin</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadScope</key>
    <string>System</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>12345678-ABCD-EF01-2345-6789ABCDEF01</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>
EOF
```

## Step 2：安装配置描述文件

执行完成后，桌面会生成一个名为 `BraveDebloat.mobileconfig` 的文件。**双击它**，弹窗不用管，点 OK 即可。

## Step 3：在系统设置中确认安装

打开 **系统设置**，搜索 `profiles`，进入 **Device Management** 界面。双击 **Brave Debloat**，然后点 **Install** 安装。

![系统设置中的 Brave Debloat 描述文件](/image/brave-debloat-profiles.png "在 Device Management 中安装 Brave Debloat 描述文件")

## Step 4：重启 Brave

重启 Brave 浏览器，此时那些没用的功能就全部消失了。
