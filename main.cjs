const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { isDouyinUrl, inspectDouyinWithBrowser, downloadDouyinResolved } = require('./douyin-browser.cjs');
const { normalizeUrl } = require('./url-utils.cjs');

const isWin = process.platform === 'win32';
const binaryName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
const ffmpegName = isWin ? 'ffmpeg.exe' : 'ffmpeg';
const douyinMediaCache = new Map();

function bundledBinary(name) {
  const candidates = [
    path.join(__dirname, 'bin', name),
    path.join(process.resourcesPath, 'bin', name)
  ];
  const candidate = candidates.find(file => fs.existsSync(file));
  return candidate || name;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#f5f7fb',
    webPreferences: { preload: path.resolve(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  win.removeMenu();
  win.webContents.on('preload-error', (_, preloadPath, error) => console.error(`Preload failed: ${preloadPath}\n${error.stack || error.message}`));
  win.webContents.on('console-message', (_, level, message) => { if (level >= 2) console.error(`Renderer: ${message}`); });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

function runYtdlp(args, sender, taskId, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(bundledBinary(binaryName), args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = timeoutMs > 0 ? setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`解析超时（${Math.round(timeoutMs / 1000)} 秒）。请检查网络后重试。`));
    }, timeoutMs) : null;
    child.stdout.on('data', data => {
      stdout += data.toString();
      for (const line of data.toString().split(/\r?\n/).filter(Boolean)) {
        try { sender.send('task:event', { taskId, ...JSON.parse(line) }); } catch (_) { sender.send('task:log', { taskId, line }); }
      }
    });
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.on('error', error => { if (settled) return; settled = true; if (timer) clearTimeout(timer); reject(new Error(`无法启动 yt-dlp：${error.message}`)); });
    child.on('close', code => { if (settled) return; settled = true; if (timer) clearTimeout(timer); code === 0 ? resolve(stdout) : reject(new Error(stderr.trim() || `yt-dlp 退出码：${code}`)); });
  });
}

function addYoutubeClientArgs(args, url) {
  if (!/^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url)) return args;
  const separator = args.indexOf('--');
  args.splice(separator >= 0 ? separator : args.length, 0, '--extractor-args', 'youtube:player_client=android');
  return args;
}

function parseExtractorJson(raw) {
  const text = String(raw || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('解析器没有返回有效媒体信息');
  return JSON.parse(text.slice(start, end + 1));
}

function normalizeFormat(format) {
  if (!format || format === 'bv*+ba/b') return 'bv*+ba/b';
  return /^\d+$/.test(format) ? `${format}+bestaudio/${format}` : format;
}

function commandAvailable(command) {
  return new Promise(resolve => {
    const versionArg = /(?:^|[\\/])ffmpeg(?:\.exe)?$/i.test(command) ? '-version' : '--version';
    const child = spawn(command, [versionArg], { windowsHide: true });
    child.on('error', () => resolve(false));
    child.on('close', code => resolve(code === 0));
  });
}

ipcMain.handle('choose-directory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('default-directory', () => app.getPath('downloads'));
ipcMain.handle('check-dependencies', async () => ({
  ytdlp: await commandAvailable(bundledBinary(binaryName)),
  ffmpeg: await commandAvailable(bundledBinary(ffmpegName))
}));

ipcMain.handle('inspect-url', async (event, { url, taskId }) => {
  try {
    url = normalizeUrl(url);
    let data;
    if (isDouyinUrl(url)) {
      data = await inspectDouyinWithBrowser(url);
      douyinMediaCache.set(url, data);
    } else {
      const args = addYoutubeClientArgs(['--dump-single-json', '--no-warnings', '--skip-download', '--', url], url);
      const raw = await runYtdlp(args, event.sender, taskId, 120000);
      data = parseExtractorJson(raw);
    }
    return {
      id: data.id, title: data.title || '未命名内容', uploader: data.uploader || data.channel || '未知作者',
      platform: data.extractor_key || data.extractor || data.platform || '未知平台', duration: data.duration || 0,
      thumbnail: data.thumbnail || '', description: data.description || '',
      formats: (data.formats || []).filter(f => f.vcodec !== 'none' || f.acodec !== 'none').slice(-30).map(f => ({
        format_id: f.format_id, ext: f.ext, resolution: f.resolution || (f.height ? `${f.height}p` : '音频'),
        filesize: f.filesize || f.filesize_approx || 0, vcodec: f.vcodec, acodec: f.acodec
      }))
    };
  } catch (error) { throw new Error(error.message); }
});

ipcMain.handle('download-url', async (event, options) => {
  let { url, taskId, format, writeDescription } = options;
  url = normalizeUrl(url);
  const outputDir = options.outputDir || app.getPath('downloads');
  fs.mkdirSync(outputDir, { recursive: true });
  const cachedDouyin = douyinMediaCache.get(url);
  if (cachedDouyin) {
    try {
      await downloadDouyinResolved(cachedDouyin, {
        outputDir,
        ffmpegPath: bundledBinary(ffmpegName),
        sender: event.sender,
        taskId,
        writeDescription
      });
      return { ok: true, browserFallback: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }
  const template = path.join(outputDir, '%(uploader)s - %(title)s [%(id)s].%(ext)s');
  const baseArgs = ['--newline', '--progress', '--no-warnings', '--retries', '3', '--fragment-retries', '3', '--socket-timeout', '30', '-o', template, '--format', normalizeFormat(format), '--merge-output-format', 'mp4', '--ffmpeg-location', bundledBinary(ffmpegName), '--', url];
  const args = addYoutubeClientArgs(baseArgs, url);
  if (writeDescription) args.splice(3, 0, '--write-description', '--write-info-json', '--write-thumbnail');
  try { await runYtdlp(args, event.sender, taskId); return { ok: true }; }
  catch (error) {
    if (/403|Forbidden/i.test(error.message) && normalizeFormat(format) !== 'bv*+ba/b') {
      const fallback = addYoutubeClientArgs(['--newline', '--progress', '--no-warnings', '--retries', '3', '--fragment-retries', '3', '--socket-timeout', '30', '-o', template, '--format', 'bv*+ba/b', '--merge-output-format', 'mp4', '--ffmpeg-location', bundledBinary(ffmpegName), '--', url], url);
      try { await runYtdlp(fallback, event.sender, taskId); return { ok: true, retried: true }; }
      catch (retryError) { return { ok: false, error: `${retryError.message}\n已自动使用最佳格式重试。` }; }
    }
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('open-path', async (_, target) => { await shell.openPath(target); return true; });

app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
