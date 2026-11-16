'use strict';

const { net, session } = require('electron');
const { sleep } = require('./util');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

async function fetchUrl(url, options) {
  return net.fetch(url, options || {});
}

function isNetworkError(error) {
  const text = String((error && (error.message || error)) || '').trim();
  return /网络不可达|ERR_|ENOTFOUND|EAI_AGAIN|ECONN|ETIMEDOUT|timed?\s*out|abort|fetch failed|load failed|net::|proxy|代理|连接失败/i.test(
    text
  );
}

async function fetchText(url, { timeout = 45000, headers = {}, retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetchUrl(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          ...headers,
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}${body ? ' :: ' + body.slice(0, 200) : ''}`);
      }
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await sleep(1200 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error('fetch failed');
}

module.exports = { fetchText, fetchUrl, isNetworkError, UA, session };
