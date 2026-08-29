function extractUrl(input) {
  const value = String(input || '').trim();
  const markdown = value.match(/^\[[^\]]+\]\((https?:\/\/[^)]+)\)$/i);
  if (markdown) return markdown[1];

  const absolute = value.match(/https?:\/\/[^\s<>"'，。！？；：、]+/i);
  if (absolute) return absolute[0].replace(/[\])}>]+$/g, '');

  const bare = value.match(/(?:www\.)?(?:v\.douyin\.com|douyin\.com|youtu\.be|youtube\.com|bilibili\.com|b23\.tv|tiktok\.com|instagram\.com)\/[^\s<>"'，。！？；：、]+/i);
  if (bare) return `https://${bare[0].replace(/[\])}>]+$/g, '')}`;
  return value;
}

function normalizeUrl(input) {
  const url = extractUrl(input);
  let parsed;
  try { parsed = new URL(url); }
  catch (_) { return url; }
  if (/^(?:www\.)?douyin\.com$/i.test(parsed.hostname)) {
    const modalId = parsed.searchParams.get('modal_id');
    if (/^\d+$/.test(modalId || '')) return `https://www.douyin.com/video/${modalId}`;
  }
  if (/^youtu\.be$/i.test(parsed.hostname)) {
    const id = parsed.pathname.slice(1);
    return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  }
  return url;
}

module.exports = { extractUrl, normalizeUrl };
