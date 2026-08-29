import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeUrl } = require('../url-utils.cjs');

assert.equal(
  normalizeUrl('8.20 01/03 j@p.dA yGV:/ :4pm 我原本没想降维打击 https://v.douyin.com/Grwk38hJwSU/ 复制此链接，打开抖音观看！'),
  'https://v.douyin.com/Grwk38hJwSU/'
);
assert.equal(
  normalizeUrl('复制这段文案\n打开抖音观看\nhttps://v.douyin.com/Grwk38hJwSU/'),
  'https://v.douyin.com/Grwk38hJwSU/'
);
assert.equal(
  normalizeUrl('https://www.douyin.com/jingxuan?modal_id=7673858521674635903'),
  'https://www.douyin.com/video/7673858521674635903'
);
assert.equal(
  normalizeUrl('[视频](https://youtu.be/QbvY3_dLrkE?si=test)'),
  'https://www.youtube.com/watch?v=QbvY3_dLrkE'
);

console.log('URL normalization tests passed');
