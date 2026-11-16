'use strict';

// 把 build/license-zh.txt 转成 RTF：指定微软雅黑，保证中文句号落在字格右下角。
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'build', 'license-zh.txt');
const out = path.join(root, 'build', 'license.rtf');

const text = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');

function escapeRtf(value) {
  let result = '';
  for (const ch of value) {
    const code = ch.codePointAt(0);
    if (ch === '\\') result += '\\\\';
    else if (ch === '{') result += '\\{';
    else if (ch === '}') result += '\\}';
    else if (ch === '\n') result += '\\par\n';
    else if (code >= 32 && code < 127) result += ch;
    else {
      const signed = code > 32767 ? code - 65536 : code;
      result += `\\u${signed}?`;
    }
  }
  return result;
}

const body = escapeRtf(text);
const rtf = [
  '{\\rtf1\\ansi\\ansicpg1252\\deff0\\deflang2052',
  '{\\fonttbl{\\f0\\fnil\\fcharset134 Microsoft YaHei;}}',
  '\\viewkind4\\uc1\\pard\\f0\\fs19\\sl276\\slmult1',
  body,
  '}',
].join('\n');

fs.writeFileSync(out, rtf, 'utf8');
console.log(`[make-license-rtf] wrote ${out} (${rtf.length} bytes)`);
