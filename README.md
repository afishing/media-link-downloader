# 🎬 链接下载器 · Media Link Downloader

> 把链接变成文件 —— 一个简洁、可扩展、面向 Windows 的多平台媒体下载桌面工具。✨

[![GitHub](https://img.shields.io/badge/GitHub-afishing%2Fmedia--link--downloader-181717?logo=github)](https://github.com/afishing/media-link-downloader)
[![Electron](https://img.shields.io/badge/Electron-37-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![yt--dlp](https://img.shields.io/badge/engine-yt--dlp-ff0000)](https://github.com/yt-dlp/yt-dlp)
[![License](https://img.shields.io/badge/license-for%20personal%20use-blue)](#-使用边界)

## 🌟 产品简介

链接下载器是一款本地运行的 Windows 桌面应用。你只需要粘贴一个媒体网页地址、抖音短链接，或者完整的抖音分享文案，就可以完成：

```text
粘贴链接 🔗  →  解析内容 🔍  →  选择质量 🎞️  →  加入队列 📥  →  保存到本地 📁
```

它将 `yt-dlp` 的平台适配能力、`FFmpeg` 的音视频处理能力和 Electron 的桌面体验组合在一起，适合保存自己拥有权利或已经获得授权的公开媒体内容。🛡️

## 📺 支持的平台

当前界面支持展示和识别以下平台：

| 平台 | 输入方式 | 主要能力 |
| --- | --- | --- |
| ▶️ YouTube | 网页 URL、`youtu.be` 短链接 | 视频信息、格式、封面、文案、下载 |
| 🎵 TikTok | 网页 URL | 视频信息和公开媒体下载 |
| 📸 Instagram | Reels / 视频网页 URL | 视频信息和公开媒体下载 |
| 🎶 抖音 Douyin | 网页 URL、`v.douyin.com` 短链接、分享文案 | 后台解析、封面、文案、下载 |
| 📺 Bilibili | 视频网页 URL | 视频信息、格式、封面、文案、下载 |

> ⚠️ 平台网页接口会变化。对登录专属、私密、地区受限或需要人工验证的内容，能否解析取决于平台当前策略和你的访问权限。

## ✨ 功能亮点

- 🔗 **一处粘贴，统一解析**：支持网页 URL 和带文案的分享文本。
- 🧩 **抖音短链接适配**：识别 `v.douyin.com` 分享链接，优先使用后台浏览器解析。
- 🕶️ **按需打开浏览器**：抖音只有在后台解析失败且需要人工验证时才打开可见窗口。
- 🎞️ **格式与质量选择**：展示解析到的视频格式，并支持最佳可用质量自动合并音视频。
- 🖼️ **媒体信息预览**：查看标题、作者、时长和封面。
- 📝 **元数据保存**：可选保存封面、文案和元数据。
- 📥 **下载队列**：多个任务统一管理，并显示进度、状态和平台来源。
- 🌗 **双主题**：支持浅色 / 深色主题，偏好会自动保存。
- 🌍 **双语言**：支持中文 / English，界面文案和任务状态同步切换。
- 🎨 **本地 Logo 与视觉效果**：平台 Logo 使用内嵌 SVG，不依赖远程图片 CDN。
- 🧱 **本地处理**：核心媒体处理在本机完成，不需要额外的在线中转站。

## 🖥️ 界面预览

界面采用卡片式布局，包含顶部工具栏、平台 Logo 区、链接输入区、内容信息区和下载队列：

```text
┌──────────────────────────────────────────────────────────┐
│  ↓  链接下载器                         EN   ☾   设置     │
├──────────────────────────────────────────────────────────┤
│  MEDIA LINK DOWNLOADER                                   │
│  把链接变成文件                                          │
│  ▶️ YouTube  🎵 TikTok  📸 Instagram  🎶 抖音  📺 Bilibili │
├──────────────────────────────────────────────────────────┤
│  媒体链接                                                 │
│  [ 粘贴一个链接或平台分享文案                 ][解析链接] │
├───────────────────────────┬──────────────────────────────┤
│  内容信息                  │  下载队列                    │
│  封面 / 标题 / 作者 / 格式 │  进度 / 状态 / 平台           │
└───────────────────────────┴──────────────────────────────┘
```

## 🚀 直接下载 Release 版本

打开仓库的 [Releases](https://github.com/afishing/media-link-downloader/releases) 页面，根据需要选择：

- 📦 **安装版 `.exe`**：适合日常使用，可以创建开始菜单和桌面快捷方式。
- 🧳 **便携版 `.exe`**：无需安装，下载后直接运行。

Release 已经内置 `yt-dlp.exe` 和 `ffmpeg.exe`，普通用户不需要另外配置命令行环境。首次运行时如果 Windows SmartScreen 提示，请确认文件来自你信任的 GitHub Release，并按系统提示操作。🔐

## 🛠️ 从源码运行

### 环境要求

- 🪟 Windows 10 / 11
- 🟢 Node.js 20 或更高版本
- 🌐 可以访问目标平台的网络环境

### 安装依赖

```bash
npm install
```

### 启动开发版

```bash
npm start
```

### 运行检查

```bash
npm run check
```

### 构建 Windows 安装包和便携版

```bash
npm run dist:win
```

构建产物会输出到 `release-dist/` 目录。构建前需要准备本地依赖：

```text
bin/
├─ ffmpeg.exe
└─ yt-dlp.exe
```

项目不会把这些第三方二进制提交进 Git 仓库；构建时会从本地 `bin/` 目录复制到 Release 包中。📦

## 🧠 技术架构

```text
┌──────────────┐     IPC      ┌────────────────────────┐
│  Renderer UI │ ◄──────────► │  Electron Main Process │
│ HTML/CSS/JS  │              │  process management    │
└──────┬───────┘              └───────────┬────────────┘
       │                                  │
       │ unified media object             │ spawn
       ▼                                  ▼
  title / author / formats          yt-dlp + FFmpeg
       │                                  │
       └────────── download queue ◄───────┘

        Douyin short link ──► background browser ──► media URL
```

### 核心组件

- ⚛️ **Electron**：创建桌面窗口、处理 IPC 和本地文件目录。
- 🔍 **yt-dlp**：解析平台地址、提取媒体信息、执行下载。
- 🎚️ **FFmpeg**：合并视频流和音频流，并输出常用媒体格式。
- 🌐 **Playwright / Electron session**：处理抖音短链接和需要页面跳转的场景。
- 🎨 **原生 HTML / CSS / JavaScript**：保持轻量，不引入前端构建步骤。

### 解析流程

1. 📋 从输入内容中提取 URL。
2. 🧹 对 URL 做平台相关的标准化处理。
3. 🔍 普通平台直接交给 yt-dlp 获取 JSON 信息。
4. 🕶️ 抖音短链接先尝试后台浏览器解析。
5. 🖼️ 将标题、作者、封面、文案、时长和格式统一展示。
6. 📥 下载任务通过 IPC 进入队列并实时更新状态。

## 🧰 项目结构

```text
.
├─ main.cjs                 # Electron 主进程和下载任务管理
├─ preload.cjs              # 安全的渲染进程桥接 API
├─ douyin-browser.cjs       # 抖音后台解析和必要的验证流程
├─ url-utils.cjs            # URL 提取与标准化
├─ src/
│  ├─ index.html            # 页面结构和平台 Logo
│  ├─ renderer.js           # 界面交互、i18n、主题和队列状态
│  └─ styles.css            # 响应式视觉样式
├─ scripts/
│  ├─ test-url-utils.mjs    # URL 单元测试
│  └─ verify.mjs            # 平台提取与下载验证脚本
├─ docs/
│  └─ CSDN-博客草稿.md      # 项目实践文章
└─ package.json             # 启动、检查和打包配置
```

## 🧯 常见问题

### 解析按钮没有反应怎么办？

先确认输入框里是完整 URL 或完整分享文案，再检查应用是否被安全软件拦截。如果是开发版，请在终端运行 `npm run check`，确认主进程和渲染进程没有语法错误。🔧

### 为什么某个平台出现 403？

403 通常来自平台的访问策略、地区限制、登录要求、频率限制或接口变化。应用不会绕过 DRM、验证码或平台权限。请只使用你有权访问的公开内容，并尝试更新 yt-dlp。⚠️

### 抖音为什么有时会打开浏览器？

应用会先在后台解析。只有后台页面无法取得媒体地址、平台要求验证或需要用户确认访问状态时，才会打开可见浏览器窗口。🕶️

### Release 版本提示缺少 FFmpeg？

请重新下载最新 Release 的完整安装版或便携版，不要只复制主程序。构建版需要将 `ffmpeg.exe` 与 `yt-dlp.exe` 一起打包到应用资源目录。📦

## 🗺️ 后续计划

- 📚 批量导入链接和拖拽文本
- 🧾 下载历史与文件定位
- ⏹️ 任务取消、暂停和重试
- 🎛️ 更多格式筛选和清晰度标签
- 🔄 yt-dlp 版本检查与更新提示
- 📦 更完善的安装包、自动更新和版本发布流程

## ⚖️ 使用边界

本项目仅用于处理用户拥有权利或已获授权的公开媒体内容。请遵守目标平台的服务条款、版权规则和当地法律法规。项目不提供 DRM 破解、验证码绕过、账号盗用或访问私密内容的功能。🛡️

第三方组件及媒体平台各自遵循其对应的许可证、服务条款和版权政策：

- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [FFmpeg](https://ffmpeg.org/)
- [Electron](https://www.electronjs.org/)
- [Playwright](https://playwright.dev/)

## 📖 项目文章

项目实践文章草稿位于 [`docs/CSDN-博客草稿.md`](docs/CSDN-博客草稿.md)，内容包括技术选型、抖音短链接处理、Electron IPC、界面设计和后续规划。✍️

## 🙌 致谢

感谢 Electron、yt-dlp、FFmpeg 和 Playwright 社区提供的优秀开源工具。开源生态让一个想法可以快速变成真正可运行的产品。🌍
