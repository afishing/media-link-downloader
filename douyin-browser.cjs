const { app, BrowserWindow, session } = require('electron');
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { once } = require('node:events');
const { Readable } = require('node:stream');
const { spawn } = require('node:child_process');

const PARTITION = 'persist:douyin-resolver';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function isDouyinUrl(url) {
  try { return /(^|\.)douyin\.com$/i.test(new URL(url).hostname); }
  catch (_) { return false; }
}

function douyinWorkId(...urls) {
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const id = parsed.pathname.match(/\/(?:video|note)\/(\d+)/)?.[1] || parsed.searchParams.get('modal_id');
      if (id) return id;
    } catch (_) {}
  }
  return '';
}

function mediaCandidate(url, resourceType = '', contentType = '') {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'byteeffecttos.com' || host.endsWith('.byteeffecttos.com')) return false;
    const value = url.toLowerCase();
    const mediaHint = resourceType === 'media'
      || /\.(?:mp4|m4a|mp3|aac|webm|m3u8|m4s|flv)(?:[?#]|$)/i.test(value)
      || /\/aweme\/v\d+\/play\b|\/video\/tos\//i.test(value)
      || /^(?:video|audio)\//i.test(contentType);
    return mediaHint;
  } catch (_) { return false; }
}

function responseContentType(headers = {}) {
  const value = headers['content-type'] || headers['Content-Type'] || [];
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

async function readPage(win) {
  return win.webContents.executeJavaScript(`(() => {
    const absolute = value => {
      const text = String(value || '').trim();
      if (!text || text.startsWith('blob:')) return '';
      if (text.startsWith('//')) return location.protocol + text;
      try { return new URL(text, location.href).href; } catch (_) { return ''; }
    };
    const meta = (selector, attr = 'content') => document.querySelector(selector)?.getAttribute(attr)?.trim() || '';
    const video = document.querySelector('video');
    if (video) {
      video.muted = false;
      video.volume = 1;
      video.play().catch(() => {});
    }
    const urls = [
      meta('meta[property="og:video"]'),
      video?.currentSrc,
      video?.getAttribute('src'),
      ...Array.from(document.querySelectorAll('video source')).map(node => node.getAttribute('src')),
      ...performance.getEntriesByType('resource').map(entry => entry.name)
    ].map(absolute).filter(Boolean);
    const title = meta('meta[property="og:title"]') || document.title || '';
    const description = meta('meta[property="og:description"]') || meta('meta[name="description"]') || '';
    const thumbnail = absolute(meta('meta[property="og:image"]'));
    const author = meta('meta[name="author"]') || meta('meta[property="og:author"]')
      || document.querySelector('[data-e2e="video-author"]')?.textContent?.trim()
      || document.querySelector('[class*="author"]')?.textContent?.trim() || '';
    return {
      pageUrl: location.href,
      title,
      description,
      thumbnail,
      author,
      duration: Number.isFinite(video?.duration) ? video.duration : 0,
      urls
    };
  })()`, true);
}

async function inspectDouyinWithElectron(url) {
  const ses = session.fromPartition(PARTITION, { cache: true });
  ses.setUserAgent(USER_AGENT, 'zh-CN,zh');
  const found = new Set();
  let closedByUser = false;
  const win = new BrowserWindow({
    width: 1120,
    height: 780,
    show: true,
    title: '抖音解析窗口（请等待视频开始播放）',
    backgroundColor: '#111111',
    webPreferences: {
      session: ses,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('closed', () => { closedByUser = true; });

  const filter = { urls: ['*://*/*'] };
  const beforeListener = details => {
    if (details.webContentsId === win.webContents.id && mediaCandidate(details.url, details.resourceType)) found.add(details.url);
  };
  const completedListener = details => {
    if (details.webContentsId === win.webContents.id && mediaCandidate(details.url, details.resourceType, responseContentType(details.responseHeaders))) found.add(details.url);
  };
  ses.webRequest.onBeforeRequest(filter, beforeListener);
  ses.webRequest.onCompleted(filter, completedListener);

  let details = null;
  try {
    await win.loadURL(url, { userAgent: USER_AGENT });
    for (let attempt = 0; attempt < 36; attempt += 1) {
      if (closedByUser || win.isDestroyed()) throw new Error('抖音解析窗口已关闭，解析已取消。');
      await sleep(attempt === 0 ? 2500 : 2000);
      try {
        details = await readPage(win);
        for (const candidate of details.urls || []) if (mediaCandidate(candidate)) found.add(candidate);
      } catch (_) {
        continue;
      }
      if (found.size) {
        await sleep(2500);
        try {
          const latest = await readPage(win);
          details = { ...details, ...latest };
          for (const candidate of latest.urls || []) if (mediaCandidate(candidate)) found.add(candidate);
        } catch (_) {}
        break;
      }
      if (attempt === 10 && !win.isDestroyed()) win.setTitle('抖音解析窗口（如有验证或登录提示，请在此窗口完成）');
    }
    if (!found.size) throw new Error('未捕获到抖音媒体地址。请在弹出的窗口中完成验证并播放视频后重试。');

    const id = douyinWorkId(details?.pageUrl, url);
    const mediaUrls = [...found];
    return {
      id,
      title: details?.title?.replace(/\s*-\s*抖音\s*$/i, '').trim() || `抖音作品 ${id}`,
      uploader: details?.author || '抖音作者',
      platform: 'Douyin',
      duration: details?.duration || 0,
      thumbnail: details?.thumbnail || '',
      description: details?.description || '',
      formats: [{ format_id: 'douyin-browser', ext: 'mp4', resolution: '浏览器原画', filesize: 0, vcodec: 'unknown', acodec: 'unknown' }],
      mediaUrls,
      pageUrl: details?.pageUrl || url,
      partition: PARTITION
    };
  } finally {
    ses.webRequest.onBeforeRequest(filter, null);
    ses.webRequest.onCompleted(filter, null);
    if (!win.isDestroyed()) win.close();
  }
}

function chromeExecutable() {
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
      ]
    : ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'];
  return candidates.find(candidate => candidate && fs.existsSync(candidate));
}

async function readChromePage(page) {
  return page.evaluate(() => {
    const absolute = value => {
      const text = String(value || '').trim();
      if (!text || text.startsWith('blob:')) return '';
      if (text.startsWith('//')) return location.protocol + text;
      try { return new URL(text, location.href).href; } catch (_) { return ''; }
    };
    const meta = (selector, attr = 'content') => document.querySelector(selector)?.getAttribute(attr)?.trim() || '';
    const video = document.querySelector('video');
    if (video) {
      video.muted = true;
      video.play().catch(() => {});
    }
    const urls = [
      meta('meta[property="og:video"]'),
      video?.currentSrc,
      video?.getAttribute('src'),
      ...Array.from(document.querySelectorAll('video source')).map(node => node.getAttribute('src')),
      ...performance.getEntriesByType('resource').map(entry => entry.name)
    ].map(absolute).filter(Boolean);
    return {
      pageUrl: location.href,
      title: meta('meta[property="og:title"]') || document.title || '',
      description: meta('meta[property="og:description"]') || meta('meta[name="description"]') || '',
      thumbnail: absolute(video?.getAttribute('poster') || meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]')),
      author: meta('meta[name="author"]') || meta('meta[property="og:author"]')
        || document.querySelector('[data-e2e="video-author"]')?.textContent?.trim()
        || document.querySelector('[data-e2e="video-author-nickname"]')?.textContent?.trim()
        || Array.from(document.querySelectorAll('a[href*="/user/"]'))
          .map(node => node.textContent?.trim()).find(text => text && !/^(?:我的|首页|推荐|关注|朋友|直播)$/i.test(text))
        || document.querySelector('[class*="author"]')?.textContent?.trim() || '',
      duration: Number.isFinite(video?.duration) ? video.duration : 0,
      urls
    };
  });
}

async function inspectDouyinWithChrome(url, executablePath, headless) {
  const profile = path.join(app.getPath('userData'), 'douyin-chrome-profile');
  const context = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless,
    viewport: headless ? { width: 1280, height: 800 } : null,
    locale: 'zh-CN',
    userAgent: USER_AGENT,
    args: ['--autoplay-policy=no-user-gesture-required']
  });
  const found = new Set();
  const page = context.pages()[0] || await context.newPage();
  page.on('request', request => {
    if (mediaCandidate(request.url(), request.resourceType())) found.add(request.url());
  });
  page.on('response', response => {
    response.allHeaders().then(headers => {
      if (mediaCandidate(response.url(), response.request().resourceType(), responseContentType(headers))) found.add(response.url());
    }).catch(() => {});
  });

  let details = null;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    if (!headless) await page.bringToFront();
    await page.mouse.click(720, 420).catch(() => {});
    const maxAttempts = headless ? 12 : 45;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (page.isClosed()) throw new Error('抖音解析窗口已关闭，解析已取消。');
      await sleep(attempt === 0 ? 2500 : 2000);
      try {
        details = await readChromePage(page);
        for (const candidate of details.urls || []) if (mediaCandidate(candidate)) found.add(candidate);
      } catch (_) { continue; }
      if (found.size) {
        await page.evaluate(() => {
          const video = document.querySelector('video');
          if (video) { video.muted = false; video.volume = 1; video.play().catch(() => {}); }
        }).catch(() => {});
        await page.mouse.click(720, 420).catch(() => {});
        await sleep(10000);
        try {
          const latest = await readChromePage(page);
          details = { ...details, ...latest };
          for (const candidate of latest.urls || []) if (mediaCandidate(candidate)) found.add(candidate);
        } catch (_) {}
        break;
      }
    }
    if (!found.size) {
      throw new Error(headless
        ? '后台解析未捕获到抖音媒体地址。'
        : '未捕获到抖音媒体地址。请在 Chrome 解析窗口中完成验证并播放视频后重试。');
    }

    const id = douyinWorkId(details?.pageUrl, url);
    const cookies = await context.cookies();
    let thumbnail = details?.thumbnail || '';
    if (thumbnail) {
      try {
        const response = await context.request.get(thumbnail, { headers: { Referer: details?.pageUrl || url } });
        if (response.ok()) {
          const body = await response.body();
          const contentType = (await response.headerValue('content-type')) || 'image/jpeg';
          if (body.length <= 5 * 1024 * 1024) thumbnail = `data:${contentType};base64,${body.toString('base64')}`;
        }
      } catch (_) {}
    }
    if (!thumbnail) {
      try {
        const video = page.locator('video').first();
        const box = await video.boundingBox();
        if (box && box.width > 80 && box.height > 80) {
          const body = await page.screenshot({ type: 'jpeg', quality: 85, clip: box });
          if (body.length <= 5 * 1024 * 1024) thumbnail = `data:image/jpeg;base64,${body.toString('base64')}`;
        }
      } catch (_) {}
    }
    return {
      id,
      title: details?.title?.replace(/\s*-\s*抖音\s*$/i, '').trim() || `抖音作品 ${id}`,
      uploader: details?.author || '抖音作者',
      platform: 'Douyin',
      duration: details?.duration || 0,
      thumbnail,
      description: details?.description || '',
      formats: [{ format_id: 'douyin-browser', ext: 'mp4', resolution: '浏览器原画', filesize: 0, vcodec: 'unknown', acodec: 'unknown' }],
      mediaUrls: [...found],
      pageUrl: details?.pageUrl || url,
      cookieHeader: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
      userAgent: USER_AGENT
    };
  } finally {
    await context.close().catch(() => {});
  }
}

async function inspectDouyinWithBrowser(url) {
  const executablePath = chromeExecutable();
  if (!executablePath) return inspectDouyinWithElectron(url);
  try {
    return await inspectDouyinWithChrome(url, executablePath, true);
  } catch (headlessError) {
    try {
      return await inspectDouyinWithChrome(url, executablePath, false);
    } catch (visibleError) {
      throw new Error(`${visibleError.message}\n后台解析失败原因：${headlessError.message}`);
    }
  }
}

function safeName(value) {
  return String(value || '抖音作品').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 120) || '抖音作品';
}

function extensionFor(url, contentType) {
  if (/image\/(?:jpeg|jpg)/i.test(contentType)) return '.jpg';
  if (/image\/png/i.test(contentType)) return '.png';
  if (/image\/webp/i.test(contentType)) return '.webp';
  if (/image\/gif/i.test(contentType)) return '.gif';
  if (/audio\/mp4/i.test(contentType)) return '.m4a';
  if (/audio\/(?:mpeg|mp3)/i.test(contentType)) return '.mp3';
  if (/video\/webm/i.test(contentType)) return '.webm';
  if (/audio\//i.test(contentType)) return '.aac';
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if (/^\.(?:mp4|m4a|mp3|aac|webm)$/.test(ext)) return ext;
  } catch (_) {}
  return '.mp4';
}

async function saveResponse(response, target, onProgress) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.body) throw new Error('媒体响应没有数据');
  const total = Number(response.headers.get('content-length') || 0);
  const stream = fs.createWriteStream(target);
  let received = 0;
  try {
    for await (const chunk of Readable.fromWeb(response.body)) {
      received += chunk.length;
      if (!stream.write(chunk)) await once(stream, 'drain');
      if (total > 0) onProgress(Math.min(99, received / total * 100));
    }
    stream.end();
    await once(stream, 'finish');
  } catch (error) {
    stream.destroy();
    await fsp.rm(target, { force: true });
    throw error;
  }
}

function probeMedia(ffmpegPath, file) {
  return new Promise(resolve => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-i', file], { windowsHide: true });
    let output = '';
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    child.on('error', () => resolve({ video: false, audio: false }));
    child.on('close', () => resolve({ video: /Stream #.*Video:/i.test(output), audio: /Stream #.*Audio:/i.test(output) }));
  });
}

function mergeMedia(ffmpegPath, videoFile, audioFile, outputFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-y', '-i', videoFile, '-i', audioFile, '-c', 'copy', '-map', '0:v:0', '-map', '1:a:0', outputFile], { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(stderr.trim() || `FFmpeg 退出码 ${code}`)));
  });
}

async function fetchAsset(entry, url, target, referer, onProgress) {
  const response = await fetch(url, { headers: {
    Referer: referer,
    Accept: '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'User-Agent': entry.userAgent || USER_AGENT,
    Cookie: entry.cookieHeader || ''
  } });
  const finalTarget = target + extensionFor(url, response.headers.get('content-type') || '');
  await saveResponse(response, finalTarget, onProgress);
  return finalTarget;
}

async function downloadDouyinResolved(entry, options) {
  const { outputDir, ffmpegPath, sender, taskId, writeDescription } = options;
  const base = safeName(`${entry.uploader} - ${entry.title} [${entry.id}]`);
  const temporary = [];
  let muxed = null;
  let videoOnly = null;
  let audioOnly = null;

  await fsp.mkdir(outputDir, { recursive: true });
  const uniqueCandidates = [...new Set(entry.mediaUrls || [])];
  const videoHints = uniqueCandidates.filter(url => /media-video/i.test(url));
  const audioHints = uniqueCandidates.filter(url => /media-audio/i.test(url));
  const otherCandidates = uniqueCandidates.filter(url => !/media-(?:video|audio)/i.test(url));
  const hintedCandidates = [];
  for (let index = 0; index < 4; index += 1) {
    if (videoHints[index]) hintedCandidates.push(videoHints[index]);
    if (audioHints[index]) hintedCandidates.push(audioHints[index]);
  }
  const candidates = [...hintedCandidates, ...otherCandidates].slice(0, 30);
  for (let index = 0; index < candidates.length; index += 1) {
    const prefix = path.join(outputDir, `.${base}.part-${index}`);
    try {
      const file = await fetchAsset(entry, candidates[index], prefix, entry.pageUrl, percent => {
        sender.send('task:event', { taskId, percent });
      });
      temporary.push(file);
      const streams = await probeMedia(ffmpegPath, file);
      if (streams.video && streams.audio) { muxed = file; break; }
      if (streams.video && !videoOnly) videoOnly = file;
      if (streams.audio && !audioOnly) audioOnly = file;
      if (videoOnly && audioOnly) break;
    } catch (_) {}
  }

  const finalPath = path.join(outputDir, `${base}.mp4`);
  if (muxed) await fsp.rename(muxed, finalPath);
  else if (videoOnly && audioOnly) await mergeMedia(ffmpegPath, videoOnly, audioOnly, finalPath);
  else {
    for (const file of temporary) await fsp.rm(file, { force: true });
    throw new Error('已捕获抖音媒体地址，但没有找到同时包含画面和声音的可下载组合。请重新解析并让视频播放数秒后再试。');
  }

  for (const file of temporary) if (file !== muxed) await fsp.rm(file, { force: true });
  if (writeDescription) {
    await fsp.writeFile(path.join(outputDir, `${base}.description.txt`), entry.description || '', 'utf8');
    await fsp.writeFile(path.join(outputDir, `${base}.info.json`), JSON.stringify({
      id: entry.id, title: entry.title, uploader: entry.uploader, description: entry.description,
      thumbnail: entry.thumbnail, webpage_url: entry.pageUrl, extractor: 'DouyinBrowser'
    }, null, 2), 'utf8');
    if (entry.thumbnail) {
      try { await fetchAsset(entry, entry.thumbnail, path.join(outputDir, `${base}.thumbnail`), entry.pageUrl, () => {}); } catch (_) {}
    }
  }
  sender.send('task:event', { taskId, percent: 100 });
  return finalPath;
}

module.exports = { isDouyinUrl, inspectDouyinWithBrowser, downloadDouyinResolved };
