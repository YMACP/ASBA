'use strict';

const { net } = require('electron');

function normalizeBase(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  s = s.replace(/\/+$/, '');
  s = s.replace(/\/(?:chat\/completions|responses|messages)$/i, '');
  return s;
}

function modelCandidates(protocol, base) {
  const out = [];
  const add = (u) => {
    if (u && !out.includes(u)) out.push(u);
  };
  add(`${base}/models`);
  if (!/\/v1$/i.test(base)) add(`${base}/v1/models`);
  try {
    const origin = new URL(base).origin;
    add(`${origin}/models`);
    add(`${origin}/v1/models`);
  } catch { /* ignore malformed URL */ }
  return out;
}

function extractModels(data) {
  const list = Array.isArray(data) ? data
    : Array.isArray(data?.data) ? data.data
      : Array.isArray(data?.models) ? data.models
        : [];
  const seen = new Set();
  const models = [];
  for (const item of list) {
    const id = typeof item === 'string' ? item
      : String(item?.id || item?.name || item?.model || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push(id);
  }
  return models;
}

async function listModels({ protocol, baseUrl, apiKey }) {
  const base = normalizeBase(baseUrl);
  const key = String(apiKey || '').trim();
  if (!base || !key) return { models: [] };

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${key}`,
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'User-Agent': 'ASBA/1.0',
  };

  let lastError = null;
  for (const endpoint of modelCandidates(protocol, base)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await net.fetch(endpoint, { headers, signal: controller.signal });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      const data = await res.json().catch(() => null);
      const models = extractModels(data);
      if (models.length) return { models };
      lastError = new Error('接口未返回模型列表');
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(lastError?.message || '无法获取模型列表');
}

module.exports = { listModels };
