'use strict';

const { net, session } = require('electron');
const { execFileSync } = require('node:child_process');
const tcpNet = require('node:net');

const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
const TEST_URL = 'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=zh-CN&q=hello';

const tracked = new Set();
let state = {
  mode: 'system',
  host: '',
  port: 0,
  source: 'none',
  pac: false,
  configured: false,
  label: '未检测到代理（直连）',
};

function parseHostPort(raw) {
  if (!raw) return null;
  let value = String(raw).trim();
  if (!value) return null;
  value = value.replace(/^[a-z]+:\/\//i, '');
  value = value.replace(/\/.*$/, '');
  const ipv6 = value.match(/^\[([^\]]+)\]:(\d+)$/);
  if (ipv6) return { host: ipv6[1], port: Number(ipv6[2]) };
  const idx = value.lastIndexOf(':');
  if (idx <= 0) return null;
  const host = value.slice(0, idx);
  const port = Number(value.slice(idx + 1));
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host, port };
}

function parseProxyServer(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (raw.includes('=')) {
    const parts = {};
    for (const item of raw.split(';')) {
      const i = item.indexOf('=');
      if (i > 0) parts[item.slice(0, i).trim().toLowerCase()] = item.slice(i + 1).trim();
    }
    return parseHostPort(parts.https || parts.http || Object.values(parts)[0] || '');
  }
  return parseHostPort(raw);
}

function readEnvProxy() {
  const keys = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy'];
  for (const key of keys) {
    const parsed = parseHostPort(process.env[key]);
    if (parsed) return { ...parsed, source: `环境变量 ${key}` };
  }
  return null;
}

function regValue(name) {
  try {
    const out = execFileSync('reg.exe', ['query', REG_KEY, '/v', name], { encoding: 'utf8', windowsHide: true });
    const line = out.split(/\r?\n/).find((x) => x.includes(name));
    if (!line) return '';
    const parts = line.trim().split(/\s{2,}/);
    return parts[parts.length - 1] || '';
  } catch {
    return '';
  }
}

function collectSystemProxies() {
  const list = [];
  try {
    const enabled = regValue('ProxyEnable');
    const server = regValue('ProxyServer');
    const pac = regValue('AutoConfigURL');
    if (enabled && parseInt(enabled, 16) === 1) {
      const parsed = parseProxyServer(server);
      if (parsed) list.push({ ...parsed, source: 'Windows 系统代理' });
      else if (pac) list.push({ host: '', port: 0, source: '系统 PAC', pac: true });
    }
  } catch { /* ignore */ }
  const env = readEnvProxy();
  if (env) list.push(env);
  return list;
}

function detectSystemProxy() {
  return collectSystemProxies()[0] || null;
}

function probeTcp(host, port, timeout = 1200) {
  if (!host || !port) return Promise.resolve(false);
  return new Promise((resolve) => {
    const socket = tcpNet.connect({ host, port });
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch { /* ignore */ }
      resolve(ok);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function resolveAutoProxy() {
  for (const candidate of collectSystemProxies()) {
    if (candidate.pac) return candidate;
    if (await probeTcp(candidate.host, candidate.port)) return candidate;
  }
  return null;
}

function manualProxy(settings) {
  const host = String((settings && settings.proxyHost) || '').trim();
  const port = Number((settings && settings.proxyPort) || 0);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host, port };
}

function rulesFor(host, port) {
  return `http=${host}:${port};https=${host}:${port}`;
}

async function applyToSession(ses) {
  tracked.add(ses);
  if (state.host && state.port) {
    await ses.setProxy({
      proxyRules: rulesFor(state.host, state.port),
      proxyBypassRules: '<local>',
    });
  } else {
    await ses.setProxy({ mode: 'system' });
  }
}

async function applyProxy(settings) {
  const manual = manualProxy(settings || {});
  if (manual) {
    state = {
      mode: 'manual',
      host: manual.host,
      port: manual.port,
      source: '手动设置',
      pac: false,
      configured: true,
      label: `手动 ${manual.host}:${manual.port}`,
    };
  } else {
    const detected = await resolveAutoProxy();
    if (detected && detected.host) {
      state = {
        mode: 'auto',
        host: detected.host,
        port: detected.port,
        source: detected.source,
        pac: false,
        configured: true,
        label: `自动检测 ${detected.host}:${detected.port}`,
      };
    } else if (detected && detected.pac) {
      state = {
        mode: 'system',
        host: '',
        port: 0,
        source: detected.source,
        pac: true,
        configured: true,
        label: '系统代理（PAC）',
      };
    } else {
      state = {
        mode: 'system',
        host: '',
        port: 0,
        source: 'none',
        pac: false,
        configured: false,
        label: '未检测到代理（直连）',
      };
    }
  }

  await applyToSession(session.defaultSession);
  for (const ses of Array.from(tracked)) {
    if (!ses || (ses.isDestroyed && ses.isDestroyed())) continue;
    try {
      await applyToSession(ses);
    } catch { /* session may be closing */ }
  }
  return getProxyStatus();
}

function getProxyStatus() {
  return { ...state };
}

async function testProxy(settings = {}) {
  const rawHost = String((settings && settings.proxyHost) || '').trim();
  const rawPort = String((settings && settings.proxyPort) || '').trim();
  if ((rawHost && !rawPort) || (!rawHost && rawPort)) {
    return { ok: false, error: '请填写完整的主机和端口' };
  }
  const manual = manualProxy(settings);
  const auto = manual ? null : await resolveAutoProxy();
  const target = manual || (auto && auto.host ? auto : null);
  const ses = session.fromPartition(`asba-proxy-test-${Date.now()}`);
  const started = Date.now();
  try {
    if (target) {
      await ses.setProxy({
        proxyRules: rulesFor(target.host, target.port),
        proxyBypassRules: '<local>',
      });
    } else {
      await ses.setProxy({ mode: 'system' });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await net.fetch(TEST_URL, { session: ses, signal: controller.signal });
      const text = await res.text();
      if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
      if (!text.trim().startsWith('[') && !text.includes('"')) {
        return { ok: false, status: res.status, error: '代理返回异常内容' };
      }
      return { ok: true, status: res.status, latency: Date.now() - started };
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

module.exports = {
  applyProxy,
  applyToSession,
  getProxyStatus,
  testProxy,
  detectSystemProxy,
  parseHostPort,
};
