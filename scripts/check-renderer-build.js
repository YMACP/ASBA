'use strict';

// 打包前的最后一道检查：没有渲染层产物时直接失败，避免打出空白安装包。
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'dist', 'renderer', 'index.html');
if (!fs.existsSync(file)) {
  console.error('[check-renderer] 缺少 dist/renderer/index.html，请先运行 npm run build:renderer');
  process.exit(1);
}
const html = fs.readFileSync(file, 'utf8');
if (!/<div id="root"/.test(html) || !/<script[^>]+src=/.test(html)) {
  console.error('[check-renderer] dist/renderer/index.html 内容不完整');
  process.exit(1);
}
const stat = fs.statSync(file);
console.log(`[check-renderer] ok ${file} (${stat.size} bytes)`);
