'use strict';

const { sleep } = require('./util');
const { fetchUrl } = require('./net');

const PROTOCOLS = ['chat', 'messages', 'responses'];

function normalizeBase(input) {
  let u = String(input || '').trim().replace(/\s+/g, '');
  if (!u) throw new Error('请填写 Base URL');
  u = u.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error('Base URL 格式不正确');
  }
  // If the user just gave a host (e.g. https://api.deepseek.com), append /v1
  if (!parsed.pathname || parsed.pathname === '/') {
    u = parsed.origin + '/v1';
  }
  return u;
}

function endpointOf(protocol, base) {
  if (protocol === 'chat') return base + '/chat/completions';
  if (protocol === 'messages') return base + '/messages';
  if (protocol === 'responses') return base + '/responses';
  throw new Error('未知协议: ' + protocol);
}

function headersOf(protocol, apiKey) {
  const h = { 'Content-Type': 'application/json' };
  if (protocol === 'messages') {
    if (apiKey) h['x-api-key'] = apiKey;
    h['anthropic-version'] = '2023-06-01';
    h['anthropic-dangerous-direct-browser-access'] = 'true';
  } else {
    if (apiKey) h.Authorization = `Bearer ${apiKey}`;
  }
  return h;
}

function bodyOf(protocol, cfg, { system, user, maxTokens, temperature }) {
  const model = cfg.model;
  if (!model) throw new Error('请填写模型名称');
  if (protocol === 'chat') {
    const body = {
      model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens || 4096,
    };
    if (typeof temperature === 'number') body.temperature = temperature;
    return body;
  }
  if (protocol === 'messages') {
    const body = {
      model,
      max_tokens: maxTokens || 4096,
      messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
    };
    if (system) body.system = system;
    if (typeof temperature === 'number') body.temperature = temperature;
    return body;
  }
  const body = {
    model,
    input: [
      {
        role: 'user',
        content: [{ type: 'input_text', text: user }],
      },
    ],
    max_output_tokens: maxTokens || 4096,
  };
  if (system) body.instructions = system;
  if (typeof temperature === 'number') body.temperature = temperature;
  return body;
}

function textOf(protocol, data) {
  if (!data || typeof data !== 'object') return '';
  if (protocol === 'chat') {
    const c = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map((p) => p.text || p.content || '').join('');
    return '';
  }
  if (protocol === 'messages') {
    if (typeof data.content === 'string') return data.content;
    if (Array.isArray(data.content)) return data.content.filter((c) => c.type === 'text').map((c) => c.text || '').join('');
    return '';
  }
  // responses
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text;
  if (Array.isArray(data.output)) {
    const parts = [];
    for (const item of data.output) {
      for (const c of item.content || []) {
        if (c.type === 'output_text' && c.text) parts.push(c.text);
        else if (c.type === 'text' && c.text) parts.push(c.text);
      }
    }
    if (parts.length) return parts.join('');
  }
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
  return '';
}

function errorText(status, body) {
  try {
    const j = JSON.parse(body);
    return j.error?.message || j.message || j.error || `HTTP ${status}`;
  } catch {
    return `HTTP ${status}: ${String(body || '').slice(0, 300)}`;
  }
}

async function request(settings, { system, user, maxTokens, temperature, timeout = 120000, retries = 2 }) {
  const protocol = PROTOCOLS.includes(settings.protocol) ? settings.protocol : 'chat';
  const base = normalizeBase(settings.baseUrl);
  const url = endpointOf(protocol, base);
  const payload = bodyOf(protocol, settings, {
    system,
    user,
    maxTokens: maxTokens || settings.maxTokens,
    temperature: typeof temperature === 'number' ? temperature : settings.temperature,
  });

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetchUrl(url, {
        method: 'POST',
        headers: headersOf(protocol, settings.apiKey),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        const msg = errorText(res.status, text);
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          lastErr = new Error(msg);
          await sleep(1500 * (attempt + 1));
          continue;
        }
        throw new Error(msg);
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('模型返回了非 JSON 响应：' + text.slice(0, 200));
      }
      const out = textOf(protocol, data).trim();
      if (!out) throw new Error('模型返回内容为空');
      return { text: out, raw: data, protocol };
    } catch (e) {
      lastErr = e;
      const retryable = /fetch failed|network|ECONNRESET|ETIMEDOUT|aborted|timeout/i.test(e.message);
      if (attempt < retries && retryable) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error('请求失败');
}

async function testConnection(settings) {
  const started = Date.now();
  const r = await request(
    { ...settings, maxTokens: Math.min(settings.maxTokens || 512, 512) },
    {
      system: 'You are a connectivity test. Reply with exactly: OK',
      user: 'Reply with exactly: OK',
      temperature: 0,
      timeout: 45000,
      retries: 0,
    }
  );
  return {
    ok: true,
    latency: Date.now() - started,
    model: settings.model,
    protocol: settings.protocol,
    reply: r.text.slice(0, 200),
  };
}

module.exports = { request, testConnection, normalizeBase, PROTOCOLS };
