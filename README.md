# 链接下载器

一个基于 Electron 的 Windows 桌面媒体链接下载器。粘贴公开的 YouTube、TikTok、Instagram、抖音或 Bilibili 链接，即可统一解析视频信息并加入下载队列。

## Features

- 支持网页 URL、抖音短链接和抖音分享文案
- 使用 yt-dlp 负责媒体解析与下载，FFmpeg 负责音视频合并
- 抖音优先使用后台浏览器解析，只有需要人工验证时才打开可见浏览器
- 可保存封面、文案和元数据
- 支持中英文界面、浅色/深色主题
- 不绕过 DRM，只处理用户拥有权利或已获授权的公开内容

## Run

1. Install Node.js 20+.
2. Install `yt-dlp` and `ffmpeg`, then make both commands available in `PATH`, or put `yt-dlp.exe` and `ffmpeg.exe` under a `bin/` folder next to the packaged app.
3. Run `npm install`.
4. Run `npm start`.

The application uses yt-dlp for extraction and downloading. It does not bypass DRM or access content without authorization.

Douyin links are resolved in a background Chrome session first. A visible Chrome window is opened only if background resolution fails and user verification is required.

The app is intended for public media links. Login-only and private content are outside the default workflow.
