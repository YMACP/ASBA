// Minimal mock LLM server implementing Chat / Messages / Responses shapes.
const http = require('node:http');

const PORT = Number(process.env.MOCK_PORT || 8765);

function translateAll(arr) {
  return arr.map((s) => {
    const t = String(s);
    const cjk = /[\u4e00-\u9fff]/.test(t);
    return cjk ? t : '【中译】' + t.slice(0, 40) + (t.length > 40 ? '…' : '');
  });
}

function extractUserText(pathname, body) {
  if (pathname.endsWith('/chat/completions')) {
    const msgs = body.messages || [];
    const last = [...msgs].reverse().find((m) => m.role === 'user');
    return typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content || '');
  }
  if (pathname.endsWith('/messages')) {
    const c = body.messages?.[0]?.content;
    if (Array.isArray(c)) return c.map((x) => x.text || '').join('');
    return String(c || '');
  }
  if (pathname.endsWith('/responses')) {
    const c = body.input?.[0]?.content;
    if (Array.isArray(c)) return c.map((x) => x.text || '').join('');
    return String(c || '');
  }
  return '';
}

function parseArray(text) {
  try {
    const v = JSON.parse(text);
    if (Array.isArray(v)) return v;
    if (Array.isArray(v.translations)) return v.translations;
  } catch { /* not an array */ }
  return null;
}

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { /* ignore */ }
    const url = new URL(req.url, 'http://x');
    const userText = extractUserText(url.pathname, body);
    const arr = parseArray(userText);
    const outText = arr ? JSON.stringify(translateAll(arr)) : 'OK';
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname.endsWith('/chat/completions')) {
      res.end(JSON.stringify({ id: 'mock', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: outText }, finish_reason: 'stop' }], usage: { total_tokens: 1 } }));
    } else if (url.pathname.endsWith('/messages')) {
      res.end(JSON.stringify({ id: 'msg_mock', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: outText }] }));
    } else if (url.pathname.endsWith('/responses')) {
      res.end(JSON.stringify({ id: 'resp_mock', object: 'response', model: body.model, output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: outText }] }] }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: { message: 'not found ' + url.pathname } }));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('mock llm listening on ' + PORT);
});
