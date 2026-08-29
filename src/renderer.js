const $ = id => document.getElementById(id);

const messages = {
  zh: {
    appName: '链接下载器', settings: '设置',
    heroTitle: '把链接变成文件', heroDescription: '支持主流视频平台，一次粘贴，统一管理。', douyin: '抖音',
    mediaLink: '媒体链接', inputPlaceholder: '粘贴一个链接或平台分享文案', inspect: '解析链接', inspecting: '解析中…',
    contentInfo: '内容信息', waiting: '等待解析', emptyHint: '解析后将在这里显示标题、作者和可用格式', cover: '封面',
    downloadQuality: '下载质量', bestQuality: '最佳可用质量（自动合并）', saveMetadata: '同时保存封面、文案和元数据', addQueue: '加入下载队列',
    downloadQueue: '下载队列', noTasks: '还没有下载任务', chooseFolder: '选择保存位置', defaultOutput: '未选择，使用默认目录',
    preparing: '准备中', waitingStart: '等待开始',
    done: '完成', failed: '失败', saved: '已保存到本地', downloading: '下载中', processing: '处理中', seconds: '秒', unknownDuration: '时长未知',
    noDescription: '暂无文案', autoMergeAudio: '自动合并音频', parseFailed: '解析失败', emptyInput: '请先粘贴链接或平台分享文案',
    bridgeError: '应用桥接加载失败，请重启应用。', languageSwitch: 'Switch to English', themeToDark: '切换深色主题', themeToLight: '切换浅色主题',
    errorFreshCookies: '抖音会先在后台解析；只有后台方式失败时才会打开浏览器供你完成验证。',
    errorCookies: '该内容可能要求登录；当前版本仅处理公开媒体链接。',
    errorUnsupportedDouyin: '请粘贴包含 modal_id 的抖音精选链接、标准作品链接或完整分享文案。',
    errorRestricted: '请换一个公开且未受地区限制的链接。', errorChallenge: '该平台最近调整了网页接口，可尝试更新 yt-dlp 后重试。'
  },
  en: {
    appName: 'Media Link Downloader', settings: 'Settings',
    heroTitle: 'Turn links into files', heroDescription: 'Download from popular video platforms. Paste once, manage in one place.', douyin: 'Douyin',
    mediaLink: 'Media link', inputPlaceholder: 'Paste a link or shared post text', inspect: 'Inspect link', inspecting: 'Inspecting…',
    contentInfo: 'Content details', waiting: 'Waiting', emptyHint: 'The title, creator, and available formats will appear here', cover: 'Cover',
    downloadQuality: 'Download quality', bestQuality: 'Best available quality (auto merge)', saveMetadata: 'Also save the cover, caption, and metadata', addQueue: 'Add to download queue',
    downloadQueue: 'Download queue', noTasks: 'No download tasks yet', chooseFolder: 'Choose save folder', defaultOutput: 'Not selected; using the default folder',
    preparing: 'Preparing', waitingStart: 'Waiting to start',
    done: 'Done', failed: 'Failed', saved: 'Saved locally', downloading: 'Downloading', processing: 'Processing', seconds: 'sec', unknownDuration: 'Duration unknown',
    noDescription: 'No caption available', autoMergeAudio: 'audio merged automatically', parseFailed: 'Inspection failed', emptyInput: 'Paste a link or shared post text first',
    bridgeError: 'The application bridge failed to load. Please restart the app.', languageSwitch: '切换到中文', themeToDark: 'Switch to dark theme', themeToLight: 'Switch to light theme',
    errorFreshCookies: 'Douyin is inspected in the background first. A visible browser opens only when manual verification is required.',
    errorCookies: 'This content may require a login. The current version handles public media links only.',
    errorUnsupportedDouyin: 'Paste a Douyin modal_id URL, a standard work URL, or the complete shared post text.',
    errorRestricted: 'Try another public link that is not region-restricted.', errorChallenge: 'The platform recently changed its web interface. Update yt-dlp and try again.'
  }
};

function readSetting(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; }
}

const state = {
  media: null,
  outputDir: '',
  tasks: new Map(),
  language: readSetting('language', 'zh') === 'en' ? 'en' : 'zh',
  theme: readSetting('theme', 'light') === 'dark' ? 'dark' : 'light',
  busy: false,
  errorRaw: ''
};

const t = key => messages[state.language][key] || key;
const platformKey = value => ({ Youtube: 'YouTube', TikTok: 'TikTok', Instagram: 'Instagram', Bilibili: 'Bilibili', Douyin: t('douyin') }[value] || value);

if (!window.downloader) {
  document.body.insertAdjacentHTML('afterbegin', `<div class="bridge-error">${t('bridgeError')}</div>`);
  throw new Error('Electron preload bridge is unavailable');
}

function saveSetting(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }

function renderThemeButton() {
  const toDark = state.theme === 'light';
  $('themeIcon').textContent = toDark ? '☾' : '☀';
  $('themeBtn').title = t(toDark ? 'themeToDark' : 'themeToLight');
  $('themeBtn').setAttribute('aria-label', $('themeBtn').title);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  saveSetting('theme', state.theme);
  renderThemeButton();
}

function applyLanguage() {
  document.documentElement.lang = state.language === 'zh' ? 'zh-CN' : 'en';
  document.title = t('appName');
  document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => { element.placeholder = t(element.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-alt]').forEach(element => { element.alt = t(element.dataset.i18nAlt); });
  $('languageBtn').textContent = state.language === 'zh' ? 'EN' : '中';
  $('languageBtn').title = t('languageSwitch');
  $('outputPath').textContent = state.outputDir || t('defaultOutput');
  renderThemeButton();
  setBusy(state.busy);
  if (state.media) renderMedia(state.media);
  else if (state.errorRaw) showError(state.errorRaw);
  for (const task of state.tasks.values()) renderTaskText(task);
  saveSetting('language', state.language);
}

$('languageBtn').onclick = () => { state.language = state.language === 'zh' ? 'en' : 'zh'; applyLanguage(); };
$('themeBtn').onclick = () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; applyTheme(); };
$('settingsBtn').onclick = () => $('folderBtn').click();
$('folderBtn').onclick = async () => {
  const dir = await window.downloader.chooseDirectory();
  if (dir) { state.outputDir = dir; $('outputPath').textContent = dir; }
};

window.downloader.defaultDirectory().then(dir => { state.outputDir = dir; $('outputPath').textContent = dir; });
function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function taskCard(task) {
  const element = document.createElement('div');
  element.className = 'queue-item';
  element.id = `task-${task.id}`;
  element.innerHTML = `<div class="task-head"><span class="task-title">${escapeHtml(task.title)}</span><span class="task-status"></span></div><div class="progress"><i style="width:0%"></i></div><div class="task-meta"><span class="task-percent"></span><span class="task-platform"></span></div>`;
  return element;
}

function renderTaskText(task) {
  const element = $(`task-${task.id}`);
  if (!element) return;
  element.querySelector('.task-status').textContent = task.statusKey ? t(task.statusKey) : (task.statusText || t('downloading'));
  element.querySelector('.task-percent').textContent = task.messageKey ? t(task.messageKey) : (task.messageText || `${task.percent.toFixed(0)}%`);
  element.querySelector('.task-platform').textContent = platformKey(task.platform);
}

function setBusy(busy) {
  state.busy = busy;
  $('inspectBtn').disabled = busy;
  $('inspectBtn').innerHTML = busy ? t('inspecting') : `${t('inspect')} <span>→</span>`;
}

function createTaskId() {
  return globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

$('inspectBtn').onclick = async () => {
  const url = $('urlInput').value.trim();
  if (!url) return alert(t('emptyInput'));
  setBusy(true);
  state.errorRaw = '';
  const taskId = createTaskId();
  try {
    state.media = await window.downloader.inspectUrl({ url, taskId });
    renderMedia(state.media);
  } catch (error) {
    state.media = null;
    state.errorRaw = error.message;
    showError(error.message);
  } finally {
    setBusy(false);
  }
};

$('downloadBtn').onclick = async () => {
  if (!state.media) return;
  const taskId = createTaskId();
  const task = {
    id: taskId,
    title: state.media.title,
    platform: state.media.platform,
    url: $('urlInput').value.trim(),
    percent: 0,
    statusKey: 'preparing',
    messageKey: 'waitingStart',
    statusText: '',
    messageText: ''
  };
  state.tasks.set(taskId, task);
  const card = taskCard(task);
  $('queueList').querySelector('.empty')?.remove();
  $('queueList').prepend(card);
  $('queueCount').textContent = state.tasks.size;
  renderTaskText(task);
  const result = await window.downloader.downloadUrl({
    url: task.url,
    taskId,
    outputDir: state.outputDir || defaultDirectory(),
    format: $('formatSelect').value,
    writeDescription: $('metadataCheck').checked
  });
  updateTask({ taskId, statusKey: result.ok ? 'done' : 'failed', percent: result.ok ? 100 : 0, messageKey: result.ok ? 'saved' : '', messageText: result.ok ? '' : friendlyError(result.error) });
};

function defaultDirectory() { return state.outputDir; }

function renderMedia(media) {
  $('emptyState').classList.add('hidden');
  $('mediaInfo').classList.remove('hidden');
  $('formatArea').classList.remove('hidden');
  $('platformBadge').classList.remove('muted');
  $('thumbnail').src = media.thumbnail || '';
  $('mediaTitle').textContent = media.title;
  $('mediaAuthor').textContent = `${media.uploader} · ${media.duration ? `${Math.round(media.duration)} ${t('seconds')}` : t('unknownDuration')}`;
  $('mediaDescription').textContent = media.description || t('noDescription');
  $('platformBadge').textContent = platformKey(media.platform);
  const select = $('formatSelect');
  select.innerHTML = '';
  const best = document.createElement('option');
  best.value = 'bv*+ba/b';
  best.textContent = t('bestQuality');
  select.appendChild(best);
  for (const format of (media.formats || []).filter(item => item.vcodec !== 'none' && item.resolution && !/audio/i.test(item.resolution)).slice(-8).reverse()) {
    const option = document.createElement('option');
    option.value = format.format_id;
    option.textContent = `${format.resolution} · ${format.ext} (${t('autoMergeAudio')})`;
    select.appendChild(option);
  }
}

function showError(message) {
  $('platformBadge').textContent = t('parseFailed');
  $('platformBadge').classList.add('muted');
  $('mediaInfo').classList.add('hidden');
  $('formatArea').classList.add('hidden');
  $('emptyState').classList.remove('hidden');
  $('emptyState').querySelector('p').textContent = friendlyError(message);
}

function updateTask(event) {
  const task = state.tasks.get(event.taskId);
  const element = $(`task-${event.taskId}`);
  if (!task || !element) return;
  task.percent = Math.max(0, Math.min(100, Number(event.percent ?? task.percent ?? 0)));
  if (event.statusKey) { task.statusKey = event.statusKey; task.statusText = ''; }
  if (event.statusText) { task.statusText = event.statusText; task.statusKey = ''; }
  if (event.messageKey) { task.messageKey = event.messageKey; task.messageText = ''; }
  if (event.messageText) { task.messageText = event.messageText; task.messageKey = ''; }
  element.querySelector('i').style.width = `${task.percent}%`;
  renderTaskText(task);
}

function friendlyError(message) {
  if (/fresh cookies/i.test(message)) return `${message}\n\n${t('errorFreshCookies')}`;
  if (/cookies/i.test(message)) return `${message}\n\n${t('errorCookies')}`;
  if (/Unsupported URL/i.test(message) && /douyin\.com/i.test(message)) return `${message}\n\n${t('errorUnsupportedDouyin')}`;
  if (/geo-restricted|deleted/i.test(message)) return `${message}\n\n${t('errorRestricted')}`;
  if (/Unexpected response|challenge/i.test(message)) return `${message}\n\n${t('errorChallenge')}`;
  return message;
}

window.downloader.onTaskEvent(event => {
  const percent = event._percent_str ? parseFloat(event._percent_str) : event.percent;
  updateTask({ taskId: event.taskId, statusKey: 'downloading', percent, messageText: event._percent_str ? `${event._percent_str} · ${event._speed_str || ''}` : '' });
});
window.downloader.onTaskLog(event => {
  if (/error|failed/i.test(event.line)) updateTask({ taskId: event.taskId, statusKey: 'processing', messageText: event.line.slice(0, 80) });
});

applyTheme();
applyLanguage();
