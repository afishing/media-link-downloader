import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bin = join(root, 'bin');
const ytdlp = join(bin, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const ffmpeg = join(bin, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
const output = join(root, '.verification-output');

const cases = [
  { name: 'YouTube', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' },
  { name: 'TikTok', url: 'https://www.tiktok.com/@tiktok/video/6718335390845095173' },
  { name: 'Instagram', url: 'https://www.instagram.com/reel/B1ox0BWF8S1/' },
  { name: 'Bilibili', url: 'https://www.bilibili.com/video/BV1cW411N7wz/' },
  { name: 'Douyin', url: 'https://jingxuan.douyin.com/m/video/7651225878966036337' }
];

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => resolve({ code: -1, stdout, stderr: `${stderr}\n${error.message}` }));
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

function parseJson(stdout) {
  const start = stdout.indexOf('{');
  if (start < 0) return null;
  try { return JSON.parse(stdout.slice(start)); } catch { return null; }
}

function status(value) { return value ? '有' : '无'; }

console.log('媒体链接下载器提取验证');
console.log(`yt-dlp: ${existsSync(ytdlp) ? '已找到' : '缺失'}`);
console.log(`FFmpeg: ${existsSync(ffmpeg) ? '已找到' : '缺失'}`);
if (!existsSync(ytdlp)) process.exitCode = 1;

for (const item of cases) {
  const result = await run(ytdlp, ['--dump-single-json', '--skip-download', '--no-warnings', '--no-playlist', '--', item.url]);
  const data = result.code === 0 ? parseJson(result.stdout) : null;
  if (!data) {
    console.log(`[${item.name}] 失败：${(result.stderr || result.stdout).trim().split(/\r?\n/).slice(-1)[0] || `退出码 ${result.code}`}`);
    continue;
  }
  console.log(`[${item.name}] 成功 | 平台=${data.extractor_key || data.extractor || '未知'} | 标题=${status(data.title)} | 作者=${status(data.uploader || data.channel)} | 封面=${status(data.thumbnail)} | 文案=${status(data.description)} | 格式=${(data.formats || []).length}`);
}

if (existsSync(output)) rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
const download = await run(ytdlp, [
  '--newline', '--no-warnings', '--no-playlist', '--format', 'bv*+ba/b', '--merge-output-format', 'mp4',
  '--ffmpeg-location', ffmpeg, '--max-filesize', '20M', '-o', join(output, '%(id)s.%(ext)s'), '--', cases[0].url
]);
const files = existsSync(output) ? await readdir(output) : [];
const mergedFile = files.find(file => file.toLowerCase().endsWith('.mp4'));
console.log(`[YouTube 下载+FFmpeg] ${download.code === 0 && mergedFile ? `成功 | 文件=${mergedFile} | 大小=${statSync(join(output, mergedFile)).size} 字节` : `失败：${(download.stderr || download.stdout).trim().split(/\r?\n/).slice(-1)[0] || `退出码 ${download.code}`}`}`);
console.log(`验证文件目录：${output}`);
