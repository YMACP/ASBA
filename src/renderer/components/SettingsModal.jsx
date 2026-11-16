import React, { useEffect, useRef, useState } from 'react';
import { IconClose, IconFolder, IconSpark, IconChevronDown } from './Icons.jsx';

const PROTOCOLS = [
  { id: 'messages', name: 'Messages', desc: 'Anthropic /v1/messages' },
  { id: 'responses', name: 'Responses', desc: 'OpenAI /v1/responses' },
  { id: 'chat', name: 'Chat Completions', desc: 'OpenAI 兼容 /v1/chat/completions' },
];

export default function SettingsModal({ open, initial, onClose, onSave, onTest, onChooseDir, proxyStatus, onTestProxy }) {
  const [form, setForm] = useState(null);
  const [testing, setTesting] = useState(false);
  const [proxyTesting, setProxyTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [modelOpen, setModelOpen] = useState(false);
  const [modelActive, setModelActive] = useState(-1);
  const modelWrapRef = useRef(null);

  useEffect(() => {
    if (open && initial) {
      setForm({ ...initial });
      setTestResult(null);
      setModels([]);
      setModelsError('');
      setModelsLoading(false);
      setModelOpen(false);
      setModelActive(-1);
    }
  }, [open, initial]);

  // Fetch the model list only when both credentials are present. The 650ms
  // debounce avoids a request per keystroke while typing the key/URL.
  useEffect(() => {
    if (!open || !form) return undefined;
    const baseUrl = String(form.baseUrl || '').trim();
    const apiKey = String(form.apiKey || '').trim();
    if (!baseUrl || !apiKey) {
      setModels([]);
      setModelsLoading(false);
      setModelsError('');
      return undefined;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      if (!alive) return;
      setModelsLoading(true);
      setModelsError('');
      try {
        const res = await window.asba.models.list({
          protocol: form.protocol,
          baseUrl,
          apiKey,
        });
        if (!alive) return;
        const list = Array.isArray(res?.models) ? res.models : [];
        setModels(list);
        if (!list.length) setModelsError('接口未返回模型列表');
      } catch (e) {
        if (!alive) return;
        setModels([]);
        setModelsError(e?.message || '获取模型列表失败');
      } finally {
        if (alive) setModelsLoading(false);
      }
    }, 650);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, form?.baseUrl, form?.apiKey, form?.protocol]);

  useEffect(() => {
    if (!modelOpen) return undefined;
    const close = (e) => {
      if (modelWrapRef.current && !modelWrapRef.current.contains(e.target)) {
        setModelOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [modelOpen]);

  if (!open || !form) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const chooseModel = (id) => {
    set('model', id);
    setModelOpen(false);
    setModelActive(-1);
  };

  const onModelKeyDown = (e) => {
    if (!modelOpen) {
      if (e.key === 'ArrowDown' && models.length) {
        e.preventDefault();
        setModelOpen(true);
        setModelActive(0);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setModelOpen(false);
      return;
    }
    if (e.key === 'ArrowDown' && models.length) {
      e.preventDefault();
      setModelActive((i) => (i + 1) % models.length);
    } else if (e.key === 'ArrowUp' && models.length) {
      e.preventDefault();
      setModelActive((i) => (i <= 0 ? models.length - 1 : i - 1));
    } else if (e.key === 'Enter' && modelActive >= 0 && models[modelActive]) {
      e.preventDefault();
      chooseModel(models[modelActive]);
    }
  };

  const pdfDisplay = form.pdfDirCustom ? (form.pdfDir || '') : '...';

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await onTest(form);
      setTestResult({ ok: true, text: `连接成功 · ${r.latency}ms · ${r.model || ''} · 回复「${r.reply}」` });
    } catch (e) {
      setTestResult({ ok: false, text: e.message });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const chooseDir = async () => {
    const dir = await onChooseDir();
    if (dir) setForm((f) => ({ ...f, pdfDir: dir, pdfDirCustom: true }));
  };

  const runProxyTest = async () => {
    if (proxyTesting || !onTestProxy) return;
    setProxyTesting(true);
    try {
      await onTestProxy(form);
    } finally {
      setProxyTesting(false);
    }
  };

  return (
    <div className="modal-mask">
      <div className="modal">
        <div className="modal-head">
          <h3>设置</h3>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            <IconClose size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>接口协议</label>
            <div className="proto-tabs">
              {PROTOCOLS.map((p) => (
                <button
                  key={p.id}
                  className={form.protocol === p.id ? 'on' : ''}
                  onClick={() => set('protocol', p.id)}
                  title={p.desc}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Base URL</label>
            <input
              value={form.baseUrl || ''}
              onChange={(e) => set('baseUrl', e.target.value)}
              placeholder="https://api.deepseek.com/v1"
              spellCheck={false}
            />
          </div>

          <div className="field">
            <label>API Key</label>
            <input
              type="password"
              value={form.apiKey || ''}
              onChange={(e) => set('apiKey', e.target.value)}
              placeholder="sk-..."
              spellCheck={false}
            />
          </div>

          <div className="field">
            <label>模型名称</label>
            <div className="model-row">
              <div className="model-input-wrap" ref={modelWrapRef}>
                <input
                  value={form.model || ''}
                  onChange={(e) => set('model', e.target.value)}
                  onKeyDown={onModelKeyDown}
                  placeholder="deepseek-chat"
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="model-arrow"
                  onClick={() => setModelOpen((v) => !v)}
                  aria-label="选择模型"
                  aria-expanded={modelOpen}
                >
                  <IconChevronDown size={14} />
                </button>
                {modelOpen ? (
                  <div className="model-menu" role="listbox">
                    {modelsLoading ? <div className="model-menu-state">正在获取模型列表…</div> : null}
                    {!modelsLoading && models.length === 0 ? (
                      <div className="model-menu-state">
                        {!form.baseUrl || !form.apiKey
                          ? '请先填写 Base URL 和 API Key'
                          : modelsError || '暂无可选模型'}
                      </div>
                    ) : null}
                    {!modelsLoading && models.map((id, index) => (
                      <button
                        type="button"
                        key={id}
                        className={'model-option' + (id === form.model ? ' selected' : '') + (index === modelActive ? ' active' : '')}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => chooseModel(id)}
                        role="option"
                        aria-selected={id === form.model}
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <label className="check" title="模型支持 1M 上下文窗口">
                <input type="checkbox" checked={!!form.context1M} onChange={(e) => set('context1M', e.target.checked)} />
                <span>1M</span>
              </label>
              <label className="check" title="模型支持 128K 最大输出">
                <input type="checkbox" checked={!!form.maxOutput128K} onChange={(e) => set('maxOutput128K', e.target.checked)} />
                <span>128K</span>
              </label>
            </div>
            <div className="model-hint">
              {modelsLoading ? '正在自动获取模型列表…' : null}
              {!modelsLoading && modelsError ? <span className="bad">{modelsError}</span> : null}
              {!modelsLoading && !modelsError && models.length ? `已获取 ${models.length} 个模型，点击右侧箭头选择，也可手动输入` : null}
              {!modelsLoading && !modelsError && !models.length && (!form.baseUrl || !form.apiKey)
                ? '填写 Base URL 和 API Key 后会自动获取模型列表'
                : null}
            </div>
          </div>

          <div className="field">
            <label>PDF保存位置</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={pdfDisplay}
                readOnly
                title={form.pdfDirCustom ? form.pdfDir : '默认保存到系统下载目录'}
                placeholder="..."
              />
              <button className="btn" onClick={chooseDir} style={{ flex: '0 0 auto' }} title="选择文件夹" aria-label="选择文件夹">
                <IconFolder size={14} />
              </button>
            </div>
          </div>

          <div className="field">
            <label>代理</label>
            <div className="proxy-row">
              <input
                value={form.proxyHost || ''}
                onChange={(e) => set('proxyHost', e.target.value)}
                placeholder="主机，例如 127.0.0.1"
                spellCheck={false}
              />
              <input
                className="proxy-port"
                value={form.proxyPort || ''}
                onChange={(e) => set('proxyPort', e.target.value.replace(/[^\d]/g, ''))}
                placeholder="端口"
                inputMode="numeric"
                spellCheck={false}
              />
              <button className="btn" onClick={runProxyTest} disabled={proxyTesting} type="button">
                {proxyTesting ? <span className="spinner" /> : null}
                {proxyTesting ? '测试中…' : '测试代理'}
              </button>
            </div>
            <div className="proxy-state">当前代理：{proxyStatus?.label || '未检测到代理（直连）'}</div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn" onClick={runTest} disabled={testing || !form.baseUrl || !form.model}>
              {testing ? <span className="spinner" /> : <IconSpark size={14} />}
              {testing ? '测试中…' : '测试连接'}
            </button>
          </div>
          {testResult ? <div className={'test-result ' + (testResult.ok ? 'ok' : 'bad')}>{testResult.text}</div> : null}
        </div>
        <div className="modal-foot">
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={onClose}>取消</button>
            <button className="btn primary" onClick={save} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
