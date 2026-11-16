'use strict';

// NSIS 3.0.4.1 的简体中文语言文件把 uninstall 译成了“解除安装”。
// electron-builder 直接复用这些文件，因此在构建前统一替换为“卸载”，
// 并去掉中英文之间多余的空格。
const fs = require('node:fs');
const path = require('node:path');

const roots = [
  path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache'),
  path.join(process.env.APPDATA || '', 'electron-builder', 'Cache'),
].filter(Boolean);

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/^SimpChinese\.(nsh|nlf)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function tidy(value) {
  return value
    .replace(/([\u4e00-\u9fff])[ \t]+(\$\{[A-Z_]+\})/g, '$1$2')
    .replace(/(\$\{[A-Z_]+\})[ \t]+([\u4e00-\u9fff])/g, '$1$2')
    .replace(/([\u4e00-\u9fff])[ \t]+([A-Za-z])/g, '$1$2')
    .replace(/([A-Za-z])[ \t]+([\u4e00-\u9fff])/g, '$1$2');
}

// electron-builder 自己的中英文提示（如“确定卸载 ${PRODUCT_NAME} 吗？”）
const templateDir = path.join(__dirname, '..', 'node_modules', 'app-builder-lib', 'templates', 'nsis');
for (const name of ['messages.yml', 'assistedMessages.yml']) {
  const file = path.join(templateDir, name);
  if (!fs.existsSync(file)) continue;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let touched = 0;
  const out = lines.map((line) => {
    const m = line.match(/^(\s*zh_CN:\s*)(.*)$/);
    if (!m) return line;
    const next = m[1] + tidy(m[2]);
    if (next !== line) touched++;
    return next;
  });
  if (touched) {
    fs.writeFileSync(file, out.join('\n'), 'utf8');
    console.log(`[patch-nsis-zh] updated ${name} (${touched} lines)`);
  }
}

// 在许可协议页插入自定义 SHOW 函数（对齐副标题、隐藏 PgDn 提示）
const licenseJs = path.join(__dirname, '..', 'node_modules', 'app-builder-lib', 'out', 'targets', 'nsis', 'nsisLicense.js');
if (fs.existsSync(licenseJs)) {
  let src = fs.readFileSync(licenseJs, 'utf8');
  const before = src;
  src = src.replace(
    'licensePage = [`!insertmacro MUI_PAGE_LICENSE "${license}"`];',
    'licensePage = ["!define MUI_PAGE_CUSTOMFUNCTION_SHOW LicensePageShow", `!insertmacro MUI_PAGE_LICENSE "${license}"`];'
  );
  src = src.replace(
    "licensePage.push('!insertmacro MUI_PAGE_LICENSE \"$(MUILicense)\"');",
    "licensePage.push('!define MUI_PAGE_CUSTOMFUNCTION_SHOW LicensePageShow');\n    licensePage.push('!insertmacro MUI_PAGE_LICENSE \"$(MUILicense)\"');"
  );
  if (src !== before) {
    fs.writeFileSync(licenseJs, src, 'utf8');
    console.log('[patch-nsis-zh] injected LicensePageShow into nsisLicense.js');
  }
}

// 在 MUI2 许可协议页的 SHOW 函数里调用自定义布局函数（安装器专用）。
// 卸载进度页：对齐“正在卸载”和“ASBA正在卸载”的左侧。
for (const root of roots) {
  for (const file of walkAll(root).filter((f) => /Pages[\\/]InstallFiles\.nsh$/i.test(f))) {
    let src = fs.readFileSync(file, 'utf8');
    if (src.includes('Call un.AsbaAlignHeader')) continue;
    if (src.includes('Call AsbaAlignHeader')) {
      src = src.replace(/Call AsbaAlignHeader/g, 'Call un.AsbaAlignHeader');
      fs.writeFileSync(file, src, 'utf8');
      console.log(`[patch-nsis-zh] updated uninstaller align hook in ${file}`);
      continue;
    }
    const marker = '    !insertmacro MUI_PAGE_FUNCTION_CUSTOM SHOW\n';
    if (src.includes(marker)) {
      src = src.replace(
        marker,
        `${marker}\n    !ifdef BUILD_UNINSTALLER\n      Call un.AsbaAlignHeader\n    !endif\n`
      );
      fs.writeFileSync(file, src, 'utf8');
      console.log(`[patch-nsis-zh] hooked AsbaAlignHeader in ${file}`);
    }
  }
}

function walkAll(dir, out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkAll(full, out);
    else out.push(full);
  }
  return out;
}

for (const root of roots) {
  for (const file of walkAll(root).filter((f) => /Pages[\\/]License\.nsh$/i.test(f))) {
    let src = fs.readFileSync(file, 'utf8');
    const marker = 'SendMessage $mui.LicensePage.TopText ${WM_SETTEXT} 0 "STR:${MUI_LICENSEPAGE_TEXT_TOP}"';
    if (src.includes(marker) && !src.includes('Call LicensePageShow')) {
      src = src.replace(
        marker,
        `${marker}\n\n    !ifndef BUILD_UNINSTALLER\n      Call LicensePageShow\n    !endif`
      );
      fs.writeFileSync(file, src, 'utf8');
      console.log(`[patch-nsis-zh] hooked LicensePageShow in ${file}`);
    }
  }
}

// 安装目录页的说明文字
const assisted = path.join(__dirname, '..', 'node_modules', 'app-builder-lib', 'templates', 'nsis', 'assistedInstaller.nsh');
if (fs.existsSync(assisted)) {
  let src = fs.readFileSync(assisted, 'utf8');
  const marker = '    !insertmacro skipPageIfUpdated\n    !insertmacro MUI_PAGE_DIRECTORY';
  const replacement = '    !insertmacro skipPageIfUpdated\n    !define MUI_DIRECTORYPAGE_TEXT_TOP "$(MUI_TEXT_DIRECTORY_TOP_CUSTOM)"\n    !insertmacro MUI_PAGE_DIRECTORY';
  if (src.includes('MUI_DIRECTORYPAGE_TEXT_TOP')) {
    src = src.replace(/!define MUI_DIRECTORYPAGE_TEXT_TOP "[^"]*"/, '!define MUI_DIRECTORYPAGE_TEXT_TOP "$(MUI_TEXT_DIRECTORY_TOP_CUSTOM)"');
    fs.writeFileSync(assisted, src, 'utf8');
    console.log('[patch-nsis-zh] updated directory page text reference');
  } else if (src.includes(marker)) {
    src = src.replace(marker, replacement);
    fs.writeFileSync(assisted, src, 'utf8');
    console.log('[patch-nsis-zh] set directory page text');
  }
}

const files = [...new Set(roots.flatMap((root) => walk(root)))];
if (!files.length) {
  console.warn('[patch-nsis-zh] 未找到 NSIS 简体中文语言文件（首次打包下载 NSIS 后再运行一次）');
  process.exit(0);
}

let changed = 0;
for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  text = text.replace(/解除安装/g, '卸载');
  // 汉字与英文/占位符之间的空格去掉：如“卸载 $(^NameDA)” -> “卸载$(^NameDA)”
  text = text.replace(/([\u4e00-\u9fff])[ \t]+(\$\(\^Name(?:DA)?\)|[A-Za-z])/g, '$1$2');
  text = text.replace(/(\$\(\^Name(?:DA)?\)|[A-Za-z])[ \t]+([\u4e00-\u9fff])/g, '$1$2');

  if (/SimpChinese\.nlf$/i.test(file)) {
    text = text
      .replace(/开始卸载进程/g, '开始卸载')
      .replace(/单击 \[卸载\(U\)\] 开始卸载。/g, '单击[卸载(U)]开始卸载。');
  }

  if (/SimpChinese\.nsh$/i.test(file)) {
    text = text
      .replace(/MUI_TEXT_LICENSE_SUBTITLE "[^"]*"/, 'MUI_TEXT_LICENSE_SUBTITLE "在安装$(^NameDA)之前，请阅读相关条款"')
      .replace(/MUI_INNERTEXT_LICENSE_TOP "[^"]*"/, 'MUI_INNERTEXT_LICENSE_TOP " "')
      .replace(/MUI_TEXT_DIRECTORY_SUBTITLE "[^"]*"/, 'MUI_TEXT_DIRECTORY_SUBTITLE " "')
      .replace(/MUI_UNTEXT_WELCOME_INFO_TEXT "[^"]*"/, 'MUI_UNTEXT_WELCOME_INFO_TEXT "$_CLICK"')
      .replace(/MUI_INNERTEXT_DIRECTORY_TOP "[^"]*"/, 'MUI_INNERTEXT_DIRECTORY_TOP "单击[浏览(B)...]选择安装目录。单击[安装(I)...]开始安装进程。"');

    const customLine = 'LangString MUI_TEXT_DIRECTORY_TOP_CUSTOM ${LANG_SIMPCHINESE} "单击[浏览(B)...]选择安装目录。单击[安装(I)...]开始安装进程。"';
    text = text.replace(/\n\s*(?:\$\{LangFileString\}|LangString)\s+MUI_TEXT_DIRECTORY_TOP_CUSTOM[^\n]*/g, '');
    text = `${text.trimEnd()}\n\n${customLine}\n`;
  }

  if (text !== before) {
    fs.writeFileSync(file, text, 'utf8');
    changed++;
    console.log(`[patch-nsis-zh] updated ${file}`);
  }
}
console.log(`[patch-nsis-zh] files=${files.length} changed=${changed}`);
