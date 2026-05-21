'use strict';

// ── DOM ───────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// Shared
const statusDot = $('status-dot');
const statusText = $('status-text');
const footerDlCount = $('footer-dl-count');
const dlList = $('dl-list');
const clearDlBtn = $('clear-dl-btn');

// Video tab
const promptsInput = $('prompts-input');
const queueListEl = $('queue-list');
const countDisplay = $('count-display');
const charCount = $('char-count');
const runBtn = $('run-btn');
const stopBtn = $('stop-btn');
const clearBtn = $('clear-btn');
const delayInput = $('delay-input');
const timeoutInput = $('timeout-input');
const autoSubmit = $('auto-submit');
const autoDownload = $('auto-download');
const waitGenerate = $('wait-generate');
const progressWrap = $('progress-wrap');
const progBar = $('prog-bar');
const progLabel = $('prog-label');
const logEl = $('log');

// Image tab
const imgPromptsInput = $('img-prompts-input');
const imgQueueListEl = $('img-queue-list');
const imgCountDisplay = $('img-count-display');
const imgCharCount = $('img-char-count');
const imgRunBtn = $('img-run-btn');
const imgStopBtn = $('img-stop-btn');
const imgClearBtn = $('img-clear-btn');
const imgAutoDL = $('img-auto-download');
const imgWaitGen = $('img-wait-generate');
const imgOutputCountEl = $('img-output-count');
const imgProgressWrap = $('img-progress-wrap');
const imgProgBar = $('img-prog-bar');
const imgProgLabel = $('img-prog-label');
const imgLogEl = $('img-log');

// Img2Vid tab
const i2vTextarea = $('i2v-textarea');
const i2vCount = $('i2v-count');
const i2vChar = $('i2v-char');
const i2vParseBtn = $('i2v-parse-btn');
const i2vParseInfo = $('i2v-parse-info');
const i2vPairsEl = $('i2v-pairs');
const i2vGuardBanner = $('i2v-guard-banner');
const i2vOptions = $('i2v-options');
const i2vDurCard = $('i2v-dur-card');
const i2vToggleOpts = $('i2v-toggle-opts');
const i2vBtnRow = $('i2v-btn-row');
const i2vRunBtn = $('i2v-run-btn');
const i2vStopBtn = $('i2v-stop-btn');
const i2vResetBtn = $('i2v-reset-btn');
const i2vProgressWrap = $('i2v-progress-wrap');
const i2vProgBar = $('i2v-prog-bar');
const i2vProgLabel = $('i2v-prog-label');
const i2vLogEl = $('i2v-log');
const i2vAutoDL = $('i2v-auto-download');
const i2vWaitGen = $('i2v-wait-generate');
const i2vStep1 = $('i2v-step1');
const i2vStep2 = $('i2v-step2');
const i2vStep3 = $('i2v-step3');

// ── State ─────────────────────────────────────────────────────────────────────
let isRunning = false; let stopRequested = false;
let imgIsRunning = false; let imgStopReq = false;
let i2vIsRunning = false; let i2vStopReq = false;
let currentI2VSubmittingSceneId = null;
const submittedI2VSceneIds = new Set();
let i2vSceneRuntime = {};

let downloadHistory = [];
let txtQueue = [];   // [{prompt, state, duration}]
let imgQueue = [];   // [{prompt, state}]
let i2vPairs = [];   // [{id, sceneId, index, prompt, imageFile, imageDataUrl, state}]

// Ratio/duration selection
let selectedRatio = '9:16';
let imgSelectedRatio = '1:1';
let imgOutputCount = 1;
let selectedResolution = '720p';
let selectedDuration = '6s';
const DEFAULT_GLOBAL_SETTINGS = {
  ratio: '9:16',
  resolution: '720p',
  duration: '6s',
};
let globalSettingsDraft = { ...DEFAULT_GLOBAL_SETTINGS };

// ── TABS ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// ── RATIO PILLS ───────────────────────────────────────────────────────────────
function initRatioPills(containerId, setVal) {
  const c = $(containerId);
  if (!c) return;
  c.querySelectorAll('.ratio-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      c.querySelectorAll('.ratio-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      setVal(pill.dataset.ratio);
      saveSettings();
    });
  });
}
initRatioPills('ratio-pills', v => { selectedRatio = v; });
initRatioPills('img-ratio-pills', v => { imgSelectedRatio = v; });

// ── DURATION BUTTONS ──────────────────────────────────────────────────────────
function initDurBtns(containerId, setVal) {
  const c = $(containerId);
  if (!c) return;
  c.querySelectorAll('.dur-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      c.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setVal(btn.dataset.dur);
      saveSettings();
    });
  });
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function parsePrompts(text) {
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
}
function parseImagePrompts(text) {
  return text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function addLog(el, msg, type = '') {
  const div = document.createElement('div');
  if (type) div.className = 'log-' + type;
  div.textContent = msg;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function safeStringifyError(value, maxLen = 1200) {
  try {
    if (value == null) return '';
    if (typeof value === 'string') return value.slice(0, maxLen);
    if (value instanceof Error) {
      return JSON.stringify({
        name: value.name,
        message: value.message,
        stack: String(value.stack || '').slice(0, 800),
      }).slice(0, maxLen);
    }

    const seen = new WeakSet();
    const json = JSON.stringify(value, (key, val) => {
      if (typeof val === 'function') return `[Function ${val.name || 'anonymous'}]`;
      if (typeof HTMLElement !== 'undefined' && val instanceof HTMLElement) return `[HTMLElement ${val.tagName}]`;
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    });

    return String(json || '').slice(0, maxLen);
  } catch {
    try { return String(value).slice(0, maxLen); }
    catch { return '[Unserializable error]'; }
  }
}

function normalizeErrorResult(res = {}, fallback = {}) {
  const code = res.code || fallback.code || (res.reason === 'timeout' ? 'generate_timeout' : null) || 'unknown_error';
  const error = res.error || res.message || fallback.error || fallback.message || res.reason || 'Không rõ nguyên nhân.';
  const raw = res.raw || res;
  return {
    ok: false,
    code,
    error,
    step: res.step || fallback.step || '',
    detail: res.detail || res.reason || fallback.detail || error,
    fatal: res.fatal ?? fallback.fatal ?? false,
    raw,
    rawText: safeStringifyError(raw),
  };
}

function getSceneDisplayName(index) {
  const n = Number(index);
  return `Cảnh ${Number.isFinite(n) ? n + 1 : 1}`;
}

function createRunId(prefix = 'job') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSceneId(mode, index, jobId = '') {
  const prefix = mode === 'img2vid' ? 'i2v' : mode === 'text2video' ? 't2v' : 'scene';
  const sceneNumber = String(Number(index) + 1).padStart(2, '0');
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${jobId || 'job'}-scene-${sceneNumber}-${unique}`;
}

function sanitizeUserError(error, context = {}) {
  const displayName = context.displayName || (context.index != null ? getSceneDisplayName(context.index) : 'cảnh hiện tại');
  let text = String(error || 'Không rõ nguyên nhân.');
  text = text.replace(/\b(?:i2v|t2v|scene|film|sf)-[a-z0-9-]*scene-\d{2}-[a-z0-9-]+/gi, displayName);
  text = text.replace(/\bi2v-scene-\d+\b/gi, displayName);
  text = text.replace(/Duplicate sceneId:\s*[^\s]+/gi, 'Dữ liệu nội bộ bị trùng, hệ thống đã tự sửa.');
  text = text.replace(/\bduplicate_scene_id\b/gi, 'internal_data_fixed');
  return text;
}

function ensureUniqueSceneId(item, index, mode, jobId, usedSceneIds, options = {}) {
  const oldId = item.sceneId || item.id;
  let sceneId = oldId || createSceneId(mode, index, jobId);
  if (usedSceneIds.has(sceneId)) {
    const newId = createSceneId(mode, index, jobId);
    console.warn('[SceneID] duplicate regenerated', {
      oldId: sceneId,
      newId,
      sceneIndex: index,
      displayName: getSceneDisplayName(index),
    });
    sceneId = newId;
    if (options.logEl && options.feature === 'Img2Vid') {
      addLog(options.logEl, `[Img2Vid] ${getSceneDisplayName(index)} phát hiện dữ liệu bị trùng, đã tự sửa và tiếp tục xử lý.`, 'warn');
    }
  }
  usedSceneIds.add(sceneId);
  item.sceneId = sceneId;
  item.id = sceneId;
  return sceneId;
}

function getI2VSceneRuntime(sceneId) {
  if (!sceneId) return null;
  if (!i2vSceneRuntime[sceneId]) {
    i2vSceneRuntime[sceneId] = {
      state: 'idle',
      submitClicks: 0,
      accepted: false,
      generating: false,
      done: false,
      startedAt: 0,
      lastError: null,
    };
  }
  return i2vSceneRuntime[sceneId];
}

function setI2VSceneState(sceneId, state, options = {}) {
  const rt = getI2VSceneRuntime(sceneId);
  if (!rt) return null;
  rt.state = state;
  if (!rt.startedAt) rt.startedAt = Date.now();
  if (state === 'submit_accepted') rt.accepted = true;
  if (state === 'generating') rt.generating = true;
  if (state === 'done') rt.done = true;
  if (state === 'warning') rt.lastError = options.error || rt.lastError;
  if (state === 'failed') rt.lastError = options.error || rt.lastError;
  if (options.logEl && options.displayName) {
    addLog(options.logEl, `[I2V scene state] ${options.displayName} -> ${state}`, options.type || (state === 'failed' ? 'err' : 'info'));
  }
  return rt;
}

function isI2VSceneSubmittedState(rt) {
  return ['submit_clicked', 'submit_accepted', 'generating', 'post_verifying', 'done', 'warning'].includes(rt?.state);
}

function shouldSkipTextToVideoModeGuardAfterFirstPrompt({ mode, settingType, promptIndex, runState } = {}) {
  const normalizedMode = String(mode || '').toLowerCase();
  const isTextToVideo = normalizedMode === 'texttovideo'
    || normalizedMode === 'text-to-video'
    || normalizedMode === 'video'
    || (normalizedMode.includes('text') && normalizedMode.includes('video'));
  const isScene2Plus = Number(promptIndex) > 0;
  if (isTextToVideo && isScene2Plus && settingType === 'mode' && runState?.videoModeConfirmedOnFirstPrompt === true) {
    return {
      skip: true,
      reason: 'Bỏ qua mode guard từ scene/prompt 2+ vì prompt đầu tiên đã xác nhận Video mode',
    };
  }
  return { skip: false };
}

function shouldSkipTextToVideoGlobalSettingsAfterFirstPrompt({ mode, promptIndex, runState } = {}) {
  const normalizedMode = String(mode || '').toLowerCase();
  const isTextToVideo = normalizedMode === 'texttovideo'
    || normalizedMode === 'text-to-video'
    || normalizedMode === 'text2video'
    || normalizedMode === 'video'
    || (normalizedMode.includes('text') && normalizedMode.includes('video'));
  if (isTextToVideo && Number(promptIndex) > 0 && runState?.globalVideoSettingsConfirmedOnFirstPrompt === true) {
    return {
      skip: true,
      reason: 'Bỏ qua toàn bộ Global Settings từ prompt 2+ vì prompt đầu tiên đã xác nhận mode/ratio/resolution/duration',
    };
  }
  return { skip: false };
}

function logSceneError(logEl, context = {}) {
  if (!logEl) return;
  const feature = context.feature || 'Automation';
  const isPrompt = /video|image|văn bản/i.test(feature) && !/film|img2vid/i.test(feature);
  const label = isPrompt ? 'Prompt' : 'Cảnh';
  const index = Number(context.index || 0);
  const total = Number(context.total || 0);
  const title = total > 0 && index > 0 ? `${label} ${index}/${total}` : (context.sceneId ? `${label} ${context.sceneId}` : label);
  const code = sanitizeUserError(context.code || 'unknown_error', context);
  const message = sanitizeUserError(context.message || context.error || 'Không rõ nguyên nhân.', context);
  const detail = sanitizeUserError(context.detail || message, context);
  const action = context.willContinue
    ? `Bỏ qua ${label.toLowerCase()} này và chuyển sang ${isPrompt ? 'prompt' : 'cảnh'} tiếp theo.`
    : 'Dừng flow để tránh chạy sai hoặc mất đồng bộ.';

  addLog(logEl, `❌ [${feature}] ${title} bị lỗi`, 'err');
  addLog(logEl, `Bước: ${context.step || 'Không xác định'}`, 'err');
  addLog(logEl, `Mã lỗi: ${code}`, 'err');
  addLog(logEl, `Chi tiết: ${detail}`, 'err');
  addLog(logEl, `Hành động: ${action}`, context.willContinue ? 'warn' : 'err');
  const debugRaw = context.rawText || safeStringifyError(context.raw);
  if (window.__GPI_DEBUG_ERRORS === true && debugRaw) {
    try { console.debug('[GPI scene error raw]', debugRaw); } catch {}
    addLog(logEl, `Debug: ${debugRaw}`, 'warn');
  }
}

function logRunSummary(logEl, { feature = 'Automation', total = 0, done = 0, failed = 0, stopped = false, errors = [], stopReason = '' } = {}) {
  if (!logEl) return;
  const success = Math.max(0, Number(done || 0) - Number(failed || 0));
  addLog(logEl, `══ KẾT THÚC ${feature.toUpperCase()} ══`, failed || stopped ? 'warn' : 'ok');
  addLog(logEl, `Tổng ${/video|image|văn bản/i.test(feature) && !/film|img2vid/i.test(feature) ? 'prompt' : 'scene'}: ${total}`, 'info');
  addLog(logEl, `Đã xử lý: ${done}/${total}`, done === total && !failed && !stopped ? 'ok' : 'info');
  addLog(logEl, `Thành công: ${success}`, success > 0 && !failed ? 'ok' : 'info');
  addLog(logEl, `Lỗi: ${failed}`, failed ? 'err' : 'info');
  addLog(logEl, `Đã dừng: ${stopped ? 'Có' : 'Không'}`, stopped ? 'warn' : 'info');
  if (stopReason) addLog(logEl, `Lý do dừng: ${stopReason}`, stopped ? 'warn' : 'info');
  if (errors.length > 0) {
    addLog(logEl, 'Scene/prompt lỗi:', 'warn');
    errors.forEach(err => {
      const label = err.displayName || (err.index ? getSceneDisplayName(Number(err.index) - 1) : 'cảnh hiện tại');
      const code = sanitizeUserError(err.code || 'unknown_error', err);
      const message = sanitizeUserError(err.message || err.detail || err.error || 'Không rõ nguyên nhân', err);
      addLog(logEl, `- ${label}: ${code} — ${message}`, 'warn');
    });
  }
}

function setStatus(text, cls = '') {
  statusText.textContent = text;
  statusDot.className = 'dot' + (cls ? ' ' + cls : '');
}

function setProgress(bar, label, done, total, prefix = 'Đã xử lý') {
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  bar.style.width = pct + '%';
  label.innerHTML = `${prefix}: <strong>${done} / ${total}</strong> (${pct}%)`;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '')
    .trim().replace(/\s+/g, '_').slice(0, 40);
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncateText(text, max = 80) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, Math.max(0, max - 3)) + '...' : clean;
}

function normalizePromptText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function promptMatchesEditor(editorText, expectedText) {
  const a = normalizePromptText(editorText);
  const b = normalizePromptText(expectedText);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b.slice(0, Math.min(120, b.length)))) return true;
  if (b.includes(a.slice(0, Math.min(120, a.length))) && a.length > 80) return true;
  return false;
}

function getQueueItemTitle(item, index = 0) {
  return truncateText(item?.title || item?.name || item?.prompt || `Scene ${index + 1}`, 46);
}

function getQueueItemPromptPreview(item) {
  return String(item?.prompt || item?.description || item?.shot || '').replace(/\s+/g, ' ').trim();
}

function getQueueItemThumbnail(item) {
  return item?.previewImage || item?.imageDataUrl || item?.chainDataUrl || item?.genFrameDataUrl || '';
}

function getQueueStatusLabel(state, fallback = 'Sẵn sàng') {
  const map = {
    waiting: 'Sẵn sàng',
    ready: 'Sẵn sàng',
    running: 'Đang chạy',
    settings: 'Đang cấu hình',
    uploading: 'Đang upload',
    prompting: 'Đang gán prompt',
    guarding: 'Đang kiểm tra',
    submitting: 'Đang submit',
    generating: 'Đang generate',
    downloading: 'Đang tải video',
    success: 'Hoàn thành',
    done: 'Hoàn thành',
    partial: 'Hoàn thành một phần',
    error: 'Lỗi',
    timeout: 'Timeout',
  };
  return map[state] || fallback || state || 'Sẵn sàng';
}

function renderQueueThumbnail(item, label = 'Chưa có ảnh') {
  const src = getQueueItemThumbnail(item);
  if (src) {
    return `<div class="queue-thumb has-image"><img src="${escapeHtml(src)}" alt=""></div>`;
  }
  return `<div class="queue-thumb queue-thumb-placeholder"><span>${escapeHtml(label)}</span></div>`;
}

function renderI2VQueueImportThumbnail(pair, idx) {
  const src = getQueueItemThumbnail(pair);
  if (src) {
    return `<button type="button" class="queue-thumb i2v-queue-import has-image" id="i2v-qimport-${idx}" title="Đổi ảnh scene ${idx + 1}"><img src="${escapeHtml(src)}" alt=""></button>`;
  }
  return `<button type="button" class="queue-thumb i2v-queue-import queue-thumb-placeholder" id="i2v-qimport-${idx}" title="Import ảnh scene ${idx + 1}"><span>Import<br>ảnh</span></button>`;
}

// ── VIDEO QUEUE RENDER ────────────────────────────────────────────────────────
function renderTxtQueue() {
  const prompts = parsePrompts(promptsInput.value);
  const globalDuration = durationToPillValue(globalSettingsDraft.duration || selectedDuration || '6s');

  if (!isRunning) {
    const oldDurations = {};
    txtQueue.forEach((item, i) => { oldDurations[item.prompt] = item.duration || globalDuration; });
    txtQueue = prompts.map(p => ({
      prompt: p,
      state: 'waiting',
      duration: oldDurations[p] || globalDuration
    }));
  }

  if (!queueListEl) return;
  queueListEl.innerHTML = '';
  const activeCountEl = $('queue-active-count');
  if (activeCountEl) activeCountEl.textContent = String(txtQueue.filter(item => item.state === 'running').length);

  if (prompts.length === 0) return;

  txtQueue.forEach((item, idx) => {
    const card = document.createElement('div');
    const badgeClass = item.state === 'success' ? 'done' : item.state === 'timeout' ? 'error' : item.state === 'waiting' ? 'ready' : item.state;
    card.className = `q-item prompt-queue-item ${item.state}`;
    card.id = `q-item-${idx}`;

    const title = getQueueItemTitle(item, idx);
    const preview = getQueueItemPromptPreview(item);

    card.innerHTML = `
      <div class="q-item-header prompt-queue-row">
        <div class="q-item-num prompt-queue-num">${idx + 1}</div>
        <div class="prompt-queue-main">
          <div class="prompt-queue-item-title">${escapeHtml(title)}</div>
          <div class="queue-prompt-preview">${escapeHtml(preview)}</div>
          <div class="prompt-queue-item-meta">${item.duration ? `${escapeHtml(item.duration)}s` : '~45s'}</div>
        </div>
        <div class="q-item-status prompt-status-badge ${badgeClass}" id="q-status-${idx}">${getQueueStatusLabel(item.state)}</div>
      </div>
      <div class="q-prog-bar-bg"><div class="q-prog-bar" id="q-prog-${idx}"></div></div>
    `;
    queueListEl.appendChild(card);
  });
}

// ── IMAGE QUEUE RENDER ────────────────────────────────────────────────────────
function renderImgQueue() {
  const prompts = parseImagePrompts(imgPromptsInput.value);

  if (!imgIsRunning) {
    const existing = Object.fromEntries(imgQueue.map(item => [item.prompt, item]));
    imgQueue = prompts.map(p => ({
      prompt: p,
      state: 'waiting',
      expectedOutputCount: normalizeImgOutputCount(existing[p]?.expectedOutputCount || imgOutputCount),
      generatedCount: existing[p]?.generatedCount || 0,
      downloadedCount: existing[p]?.downloadedCount || 0,
      previews: existing[p]?.previews || [],
      files: existing[p]?.files || [],
    }));
  }

  if (!imgQueueListEl) return;
  imgQueueListEl.innerHTML = '';
  const imgQueueCount = $('img-queue-count');
  if (imgQueueCount) imgQueueCount.textContent = String(imgQueue.length);
  if (prompts.length === 0) return;

  imgQueue.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = `img-item prompt-queue-item ${item.state}`;
    card.id = `img-item-${idx}`;

    const title = getQueueItemTitle(item, idx);
    const preview = getQueueItemPromptPreview(item);
    const expected = normalizeImgOutputCount(item.expectedOutputCount || imgOutputCount);
    const generated = Number(item.generatedCount || 0);
    const downloaded = Number(item.downloadedCount || 0);
    const thumbs = (item.previews || []).slice(0, 4).map(src => `<img class="img-result-thumb" src="${escapeHtml(src)}" alt="">`).join('');
    const resultText = downloaded > 0 ? `Đã tải: ${downloaded}/${expected}` : `Ảnh: ${generated}/${expected}`;

    card.innerHTML = `
      <div class="img-item-header">
        <div class="img-item-num prompt-queue-num">${idx + 1}</div>
        <div class="prompt-queue-main">
          <div class="prompt-queue-item-title">${escapeHtml(title)}</div>
          <div class="queue-prompt-preview">${escapeHtml(preview)}</div>
          <div class="prompt-queue-item-meta">${escapeHtml(resultText)}</div>
          ${thumbs ? `<div class="img-result-thumbs">${thumbs}</div>` : ''}
        </div>
        <div class="img-item-status prompt-status-badge" id="img-status-${idx}">${getQueueStatusLabel(item.state)}</div>
      </div>
      <div class="img-prog-bar-bg"><div class="img-prog-bar" id="img-prog-${idx}"></div></div>
    `;
    imgQueueListEl.appendChild(card);
  });
}

// ── STATUS CHECK ──────────────────────────────────────────────────────────────
async function checkTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { setStatus('Không tìm thấy tab', 'red'); return null; }
    const url = tab.url || '';
    if (url.includes('grok.com') || url.includes('x.com')) {
      const state = getGrokPageState(tab);
      if (state === 'imagine-template') setStatus('Grok Template — không phải Imagine composer', 'orange');
      else if (state === 'imagine-post') setStatus('Grok Post — có thể tiếp tục Film', 'green');
      else if (state === 'imagine-composer') setStatus('Imagine Composer ✓', 'green');
      else setStatus('Kết nối Grok ✓', 'green');
      return tab;
    }
    setStatus('Hãy mở grok.com → Imagine', 'orange'); return null;
  } catch { setStatus('Lỗi kết nối', 'red'); return null; }
}

function getGrokPageState(tabOrUrl) {
  const url = typeof tabOrUrl === 'string' ? tabOrUrl : (tabOrUrl?.url || '');
  if (!/^(https?:\/\/)?([^/]+\.)?(grok\.com|x\.com)\b/i.test(url) && !/^\/imagine\b/i.test(url)) return 'not-grok';
  if (/(?:grok\.com)?\/imagine\/templates\//i.test(url)) return 'imagine-template';
  if (isImaginePostUrl(url)) return 'imagine-post';
  if (isImagineRootUrl(url)) return 'imagine-composer';
  if (/grok\.com\/saved\b|(?:grok\.com)?\/imagine\/saved\b/i.test(url)) return 'saved';
  return 'other-grok';
}

function checkFilmTab(tabOrUrl) {
  if (arguments.length > 0) return getGrokPageState(tabOrUrl);
  return (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) { setStatus('Không tìm thấy tab', 'red'); return null; }
      const state = getGrokPageState(tab);
      if (state === 'not-grok') {
        setStatus('Hãy mở grok.com → Imagine', 'orange');
        return null;
      }
      if (state === 'imagine-template') {
        setStatus('Grok Template — không phải Imagine composer', 'orange');
      } else if (state === 'imagine-post') {
        setStatus('Grok Post — có thể tiếp tục Film', 'green');
      } else if (state === 'imagine-post') {
        setStatus('Grok Post — có thể tiếp tục Film', 'green');
      } else if (state === 'imagine-composer') {
        setStatus('Imagine Composer ✓', 'green');
      } else {
        setStatus('Grok — sẽ chuẩn bị Imagine composer', 'orange');
      }
      return { ...tab, grokPageState: state };
    } catch {
      setStatus('Lỗi kết nối', 'red');
      return null;
    }
  })();
}

// ── INJECT ASPECT RATIO ───────────────────────────────────────────────────────
async function injectAspectRatio(tabId, ratio, options = {}) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (ratio, options) => {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      const isBlocked = (el) => !!el?.closest?.('[class*="template" i],[class*="gallery" i],[class*="result" i],[class*="post" i],[class*="media" i],[class*="upload" i],[class*="overlay" i]');
      const isBlockedComposerCandidate = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
      const findBottomComposerScope = () => {
        const inputSelectors = [
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
        ].join(',');
        return Array.from(document.querySelectorAll(inputSelectors))
          .filter(input => isVisible(input) && !isBlockedComposerCandidate(input))
          .map(input => {
            let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
            if (!root) {
              let node = input.parentElement;
              for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                const text = (node.textContent || '').toLowerCase();
                if (node.querySelector('button,[role="button"],label') && /\b(agent|image|video|480p|720p|9:16|16:9|6s|10s)\b/i.test(text)) {
                  root = node; break;
                }
              }
            }
            if (!root || isBlockedComposerCandidate(root)) return null;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
            return isBottom ? { input, root, inputRect, rootRect } : null;
          })
          .filter(Boolean)
          .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
      };
      const ratioMap = {
        '9:16': ['9:16', '9/16', 'vertical', 'portrait', 'shorts'],
        '16:9': ['16:9', '16/9', 'widescreen', 'landscape'],
        '1:1': ['1:1', '1/1', 'square'],
        '2:3': ['2:3', '2/3', 'tall'],
        '3:2': ['3:2', '3/2', 'wide'],
      };
      const allRatioAliases = Object.values(ratioMap).flat();
      const keywords = (ratioMap[ratio] || [ratio]).map(k => k.toLowerCase());
      const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const readText = (el) => [
        el.textContent,
        el.getAttribute?.('aria-label'),
        el.getAttribute?.('aria-description'),
        el.getAttribute?.('title'),
        el.getAttribute?.('data-value'),
        el.getAttribute?.('data-testid'),
        el.getAttribute?.('value'),
      ].filter(Boolean).join(' ');
      const textHasExpected = (text) => {
        const hay = normalize(text);
        return keywords.some(k => k && hay.includes(k));
      };
      const textHasAnyRatio = (text) => {
        const hay = normalize(text);
        return allRatioAliases.some(k => k && hay.includes(k.toLowerCase()));
      };
      const findSelectedRatio = (text) => {
        const hay = normalize(text);
        for (const [key, aliases] of Object.entries(ratioMap)) {
          if (aliases.some(alias => hay.includes(alias.toLowerCase()))) return key;
        }
        return null;
      };
      const scope = options?.scope === 'bottomComposer' ? findBottomComposerScope() : null;
      if (options?.scope === 'bottomComposer' && !scope) return { ok: false, reason: 'Bottom composer not found' };
      const root = scope?.root || document;

      const triggerCandidates = Array.from(root.querySelectorAll('button,[role="button"]'))
        .filter(btn => isVisible(btn) && !isBlockedComposerCandidate(btn))
        .map(btn => {
          const text = readText(btn);
          const rect = btn.getBoundingClientRect();
          const parentText = readText(btn.parentElement || btn);
          const toolbarText = readText(btn.closest?.('[class*="toolbar" i],[class*="control" i],[class*="composer" i]') || btn.parentElement || btn);
          const nearVideoControls = /\b(480p|720p|1080p|6s|10s|5s|video|image)\b/i.test(`${parentText} ${toolbarText}`);
          return {
            el: btn,
            text,
            detectedRatio: findSelectedRatio(text),
            score: (textHasExpected(text) ? 100 : 0)
              + (textHasAnyRatio(text) ? 30 : 0)
              + (nearVideoControls ? 20 : 0)
              + Math.round(rect.bottom / 100),
          };
        })
        .filter(item => item.detectedRatio || textHasAnyRatio(item.text))
        .sort((a, b) => b.score - a.score);

      const trigger = triggerCandidates[0] || null;
      const triggerText = trigger?.text || '';
      console.log('[GPI ratio dropdown] trigger candidates:', triggerCandidates.map(item => ({
        text: item.text,
        detectedRatio: item.detectedRatio,
        score: item.score,
      })));
      if (trigger) console.log('[GPI ratio dropdown] ratio trigger found:', { triggerText, detectedRatio: trigger.detectedRatio });

      const forceApply = options?.forceApply === true;
      if (trigger && trigger.detectedRatio === ratio && !forceApply) {
        console.log('[GPI ratio dropdown] final selected display:', { ratio, triggerText, detectedRatio: trigger.detectedRatio });
        return { ok: true, method: 'already-displayed', ratio, triggerText };
      }

      if (trigger) {
        trigger.el.click();
        console.log('[GPI ratio dropdown] dropdown opened:', { triggerText, ratio });
        await sleep(Math.max(200, Math.min(500, Number(options?.dropdownWaitMs || 300))));

        const menuContainers = Array.from(document.querySelectorAll([
          '[role="menu"]',
          '[role="listbox"]',
          '[role="option"]',
          '[data-radix-popper-content-wrapper]',
          '[class*="popover" i]',
          '[class*="dropdown" i]',
          '[class*="menu" i]',
        ].join(','))).filter(el => isVisible(el) && !isBlocked(el));

        const optionCandidates = [];
        const seen = new Set();
        for (const container of menuContainers) {
          const nodes = [container, ...Array.from(container.querySelectorAll(
            '[role="option"],[role="menuitem"],[role="menuitemradio"],button,[role="button"],div,span'
          ))];
          for (const node of nodes) {
            if (seen.has(node) || !isVisible(node) || isBlocked(node)) continue;
            seen.add(node);
            const text = readText(node);
            if (!textHasAnyRatio(text) && !keywords.some(k => normalize(text).includes(k))) continue;
            optionCandidates.push({ el: node, text, expected: textHasExpected(text), ratio: findSelectedRatio(text) });
          }
        }
        console.log('[GPI ratio dropdown] option candidates:', optionCandidates.map(item => ({
          text: item.text,
          ratio: item.ratio,
          expected: item.expected,
        })));

        const option = optionCandidates.find(item => item.expected);
        if (option) {
          option.el.click();
          console.log('[GPI ratio dropdown] option clicked:', { ratio, optionText: option.text });
          await sleep(300);
          const finalTriggerText = readText(trigger.el);
          const finalDetectedRatio = findSelectedRatio(finalTriggerText);
          console.log('[GPI ratio dropdown] final selected display:', { ratio, triggerText: finalTriggerText, detectedRatio: finalDetectedRatio });
          return { ok: true, method: 'dropdown-option-clicked', ratio, triggerText, optionText: option.text, finalTriggerText, finalDetectedRatio };
        }
        return { ok: false, reason: 'ratio dropdown option not found', triggerText, ratio, optionCandidates: optionCandidates.map(item => item.text).slice(0, 20) };
      }

      const allBtns = Array.from(root.querySelectorAll('button,[role="button"],[role="radio"],label'))
        .filter(btn => !isBlockedComposerCandidate(btn));
      for (const btn of allBtns) {
        const combined = readText(btn);
        if (textHasExpected(combined)) {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { btn.click(); return { ok: true, method: 'direct-ratio-clicked', ratio }; }
        }
      }
      return { ok: false, reason: 'ratio selector not found' };
    },
    args: [ratio, options],
  });
  return results?.[0]?.result || { ok: false };
}

// ── NAVIGATE TO IMAGINE → IMAGE MODE ─────────────────────────────────────────
async function navigateToImagineImage(tabId) {
  const tabInfo = await chrome.tabs.get(tabId);
  const url = tabInfo.url || '';
  if (!isImagineRootUrl(url)) {
    const updated = await chrome.tabs.update(tabId, { url: 'https://grok.com/imagine' });
    console.log('[GPI] navigateToImagineImage URL after chrome.tabs.update:', updated?.url || '');
    const urlReady = await waitForImagineRootUrl(tabId, 10000);
    if (!urlReady.ok) return urlReady;
    await sleep(1200);
  }
  const ready = await ensureGrokComposerReady(tabId);
  if (!ready.ok) return ready;
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="overlay" i]');
      const findBottomComposerScope = () => {
        const inputSelectors = [
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
        ].join(',');
    return Array.from(document.querySelectorAll(inputSelectors))
      .filter(input => isVisible(input) && !isBlockedComposerRootCandidate(input))
      .map(input => {
        let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
        if (root && !isValidComposerRoot(root, input)) root = null;
            if (!root) {
              let node = input.parentElement;
              for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                const text = (node.textContent || '').toLowerCase();
                if (node.querySelector('button,[role="button"],label') && /\b(agent|image|video|480p|720p|9:16|16:9|6s|10s)\b/i.test(text)) { root = node; break; }
              }
            }
            if (!root || isBlocked(root)) return null;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
            return isBottom ? { input, root, inputRect, rootRect } : null;
          })
          .filter(Boolean)
          .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
      };
      const scope = findBottomComposerScope();
      if (!scope) return { ok: false, error: 'Bottom composer not found' };
      const imagineKeywords = ['imagine', 'sáng tạo'];
      const navLinks = [];
      for (const el of navLinks) {
        const text = (el.textContent || '').trim().toLowerCase();
        const href = (el.getAttribute('href') || '').toLowerCase();
        if (imagineKeywords.some(k => text.includes(k) || href.includes(k))) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { el.click(); break; }
        }
      }
      const imageKeywords = ['image', 'ảnh', 'photo', 'picture', 'hình ảnh'];
      const videoKeywords = ['video', 'clip'];
      const modeBtns = Array.from(scope.root.querySelectorAll(
        'button,[role="tab"],[role="radio"],[role="button"],label'
      )).filter(btn => !isBlocked(btn));
      let imageBtn = null;
      for (const btn of modeBtns) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        const combined = txt + ' ' + aria;
        const isImage = imageKeywords.some(k => combined.includes(k));
        const isVideo = videoKeywords.some(k => combined.includes(k));
        if (isImage && !isVideo) {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { imageBtn = btn; break; }
        }
      }
      if (imageBtn) { imageBtn.click(); return { ok: true, step: 'image-mode' }; }
      return { ok: true, step: 'no-mode-btn', note: 'may already be in image mode' };
    },
  });
  return results?.[0]?.result || { ok: false };
}

// ── INJECT DURATION ───────────────────────────────────────────────────────────
async function injectDuration(tabId, duration, options = {}) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (dur, options) => {
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="overlay" i]');
      const findBottomComposerScope = () => {
        const inputSelectors = [
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
        ].join(',');
        return Array.from(document.querySelectorAll(inputSelectors))
          .filter(input => isVisible(input) && !isBlocked(input))
          .map(input => {
            let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
            if (!root) {
              let node = input.parentElement;
              for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                const text = (node.textContent || '').toLowerCase();
                if (node.querySelector('button,[role="button"],label') && /\b(agent|image|video|480p|720p|9:16|16:9|6s|10s)\b/i.test(text)) { root = node; break; }
              }
            }
            if (!root || isBlocked(root)) return null;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
            return isBottom ? { input, root, inputRect, rootRect } : null;
          })
          .filter(Boolean)
          .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
      };
      const keywords = dur === '10'
        ? ['10s', '10 sec', '10sec', '10 second']
        : ['5s', '5 sec', '5sec', '6s', '6 sec', '6sec'];
      const scope = options?.scope === 'bottomComposer' ? findBottomComposerScope() : null;
      if (options?.scope === 'bottomComposer' && !scope) return { ok: false, reason: 'Bottom composer not found' };
      const root = scope?.root || document;
      const allBtns = Array.from(root.querySelectorAll('button,[role="button"],[role="radio"],label'))
        .filter(btn => !isBlocked(btn));
      for (const btn of allBtns) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (keywords.some(k => (txt + ' ' + aria).includes(k))) {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { btn.click(); return { ok: true }; }
        }
      }
      return { ok: false, reason: 'duration selector not found' };
    },
    args: [duration, options],
  });
  return results?.[0]?.result || { ok: false };
}

// ── WAIT FOR SUBMIT BUTTON ENABLED (Film + Img2Vid) ──────────────────────────
// Chờ button submit enabled VÀ ổn định liên tục ≥ stableMs (mặc định 800ms).
// Tránh false-positive khi Grok flicker enable→disable→enable trong lúc upload ảnh.
// Dùng chung cho mọi nơi inject ảnh + text: Film scene 1, chaining, Img2Vid.
//
// stableMs: số ms button phải liên tục enabled mới trả về ok.
//   - Sau inject ảnh nhân vật (Film scene 1, nhiều ảnh): ~1000ms
//   - Sau chaining frame / Img2Vid (1 ảnh): ~800ms (default)
//   - Trước submit (chỉ cần xác nhận enabled): ~600ms
async function getCurrentVideoRatioSetting() {
  return new Promise(resolve => {
    chrome.storage.local.get(['savedRatio'], data => {
      const ratio = data?.savedRatio || selectedRatio || '9:16';
      resolve(ratio);
    });
  });
}

function normalizeFilmDurationSetting(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === '10' || raw === '10s') return '10s';
  if (raw === '6' || raw === '6s' || raw === '5' || raw === '5s') return '6s';
  return '6s';
}

function normalizeRatio(value, fallback = '9:16') {
  const raw = String(value || '').trim();
  return ['9:16', '16:9', '1:1', '2:3', '3:2'].includes(raw) ? raw : fallback;
}

function normalizeGlobalRatio(value, fallback = '9:16') {
  return normalizeRatio(value, fallback);
}

function normalizeResolution(value, fallback = '720p') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.includes('480')) return '480p';
  if (raw.includes('720')) return '720p';
  return fallback;
}

function normalizeDuration(value, fallback = '6s') {
  const normalized = normalizeFilmDurationSetting(value);
  return normalized || fallback;
}

function normalizeImgOutputCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(4, Math.max(1, Math.floor(n)));
}

async function readChromeLocal(keys) {
  return new Promise(resolve => {
    chrome.storage.local.get(keys, data => resolve(data || {}));
  });
}

async function getVideoGlobalSettings() {
  const data = await readChromeLocal([
      'savedRatio',
      'setDefaultRatio',
      'selectedRatio',
      'savedResolution',
      'savedVideoResolution',
      'selectedResolution',
      'savedDuration',
      'setDlVideoQual',
      'setDefaultDur',
      'selectedDuration',
    ]);
  const ratio = normalizeRatio(data?.savedRatio || data?.setDefaultRatio || data?.selectedRatio || selectedRatio || DEFAULT_GLOBAL_SETTINGS.ratio, DEFAULT_GLOBAL_SETTINGS.ratio);
  const resolution = normalizeResolution(data?.savedResolution || data?.savedVideoResolution || data?.setDlVideoQual || data?.selectedResolution || selectedResolution || DEFAULT_GLOBAL_SETTINGS.resolution, DEFAULT_GLOBAL_SETTINGS.resolution);
  const durationRaw = data?.savedDuration || data?.setDefaultDur || data?.selectedDuration || selectedDuration || DEFAULT_GLOBAL_SETTINGS.duration;
  const duration = normalizeDuration(durationRaw, DEFAULT_GLOBAL_SETTINGS.duration);
  return {
    type: 'video',
    mode: 'Video',
    ratio,
    resolution,
    duration,
    source: {
      ratio: data?.savedRatio ? 'savedRatio' : (data?.setDefaultRatio ? 'setDefaultRatio' : (data?.selectedRatio ? 'selectedRatio' : (selectedRatio ? 'selectedRatio' : 'fallback'))),
      resolution: data?.savedResolution ? 'savedResolution' : (data?.savedVideoResolution ? 'savedVideoResolution' : (data?.setDlVideoQual ? 'setDlVideoQual' : (data?.selectedResolution ? 'selectedResolution' : (selectedResolution ? 'selectedResolution' : 'fallback')))),
      duration: data?.savedDuration ? 'savedDuration' : (data?.setDefaultDur ? 'setDefaultDur' : (data?.selectedDuration ? 'selectedDuration' : (selectedDuration ? 'selectedDuration' : 'fallback'))),
    },
  };
}

async function getImageGlobalSettings() {
  const data = await readChromeLocal([
    'savedImgRatio',
    'setDefaultImgRatio',
    'imgSelectedRatio',
    'savedRatio',
    'setDefaultRatio',
  ]);
  const ratio = normalizeRatio(data?.savedImgRatio || data?.setDefaultImgRatio || data?.imgSelectedRatio || imgSelectedRatio || data?.savedRatio || data?.setDefaultRatio || DEFAULT_GLOBAL_SETTINGS.ratio, DEFAULT_GLOBAL_SETTINGS.ratio);
  return {
    type: 'image',
    mode: 'Image',
    ratio,
    source: {
      ratio: data?.savedImgRatio ? 'savedImgRatio'
        : (data?.setDefaultImgRatio ? 'setDefaultImgRatio'
          : (data?.imgSelectedRatio ? 'imgSelectedRatio'
            : (imgSelectedRatio ? 'imgSelectedRatio'
              : (data?.savedRatio ? 'savedRatio'
                : (data?.setDefaultRatio ? 'setDefaultRatio' : 'fallback'))))),
    },
  };
}

async function getCurrentFilmGlobalSettings() {
  return getVideoGlobalSettings();
}

function sanitizeExpectedSettings(settings = {}) {
  const clean = {};
  for (const key of ['type', 'mode', 'ratio', 'resolution', 'duration']) {
    if (settings[key]) clean[key] = settings[key];
  }
  return clean;
}

function logGlobalSettingsLoaded(logEl, prefix, settings) {
  if (!logEl || !settings) return;
  if (settings.type === 'image') {
    addLog(logEl, `${prefix} image ratio=${settings.ratio} source=${JSON.stringify(settings.source || {})}`, 'info');
    return;
  }
  addLog(logEl, `${prefix} video ratio=${settings.ratio} resolution=${settings.resolution} duration=${settings.duration} source=${JSON.stringify(settings.source || {})}`, 'info');
}

const SF_FAST_MODE = true;
const SF_CHAR_REF_STABLE_TIMEOUT = 8000;
const SF_CHAIN_WAIT_TIMEOUT = 8000;
const SF_PRE_SUBMIT_BUTTON_TIMEOUT = 8000;
const SF_PRE_SUBMIT_READY_TIMEOUT = 30000;

function isValidImageDataUrl(dataUrl) {
  return typeof dataUrl === 'string' && /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(dataUrl);
}

function findBottomComposerScope() {
  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const st = window.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
  };
  const isBlockedComposerRootCandidate = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
  const isBlockedSettingControl = (el, toolbar) => {
    if (!el || !toolbar || !toolbar.contains(el)) return true;
    return !!el.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
  };
  const hasBlockedSurfaceText = (el) => /Featured Templates|Discover|Create Template/i.test(String(el?.textContent || ''));
  const isValidComposerRoot = (root, input) => {
    if (!root || root === document.body || isBlockedComposerRootCandidate(root) || hasBlockedSurfaceText(root)) return false;
    const rootRect = root.getBoundingClientRect();
    const rootHeight = Number(rootRect.height || 0);
    const hasSemanticSettings = !!root.querySelector?.('[role="radiogroup"][aria-label*="Video resolution" i],[role="radiogroup"][aria-label*="Video duration" i],button[aria-label*="Aspect Ratio" i]');
    if (rootHeight < 80 || (!hasSemanticSettings && rootHeight > 360) || (hasSemanticSettings && rootHeight > 520)) return false;
    if (Number(rootRect.top || 0) < window.innerHeight * 0.45) return false;
    if (input && !root.contains(input)) return false;
    return true;
  };
  const inputSelectors = [
    'textarea[placeholder*="Type to imagine" i]',
    'textarea[placeholder*="Imagine" i]',
    'textarea[placeholder*="Describe" i]',
    'textarea[placeholder*="Enter" i]',
    'input[placeholder*="Imagine" i]',
    'input[placeholder*="Describe" i]',
    'input[placeholder*="Enter" i]',
    'div[contenteditable="true"][data-lexical-editor]',
    'div[contenteditable="true"]',
    'textarea',
  ].join(',');
  return Array.from(document.querySelectorAll(inputSelectors))
    .filter(input => isVisible(input) && !isBlockedComposerRootCandidate(input))
    .map(input => {
      let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
      if (root && !isValidComposerRoot(root, input)) root = null;
      if (!root) {
        let node = input.parentElement;
        for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
          const text = String(node.textContent || '').toLowerCase();
          if (node.querySelector('button,[role="button"],[role="radio"],label,input[type="file"],[data-state],[tabindex]') && /\b(agent|image|video|480p|720p|9:16|16:9|1:1|2:3|3:2|6s|10s)\b/i.test(text) && isValidComposerRoot(node, input)) {
            root = node;
            break;
          }
        }
      }
      if (root) {
        let node = root.parentElement;
        for (let depth = 0; depth < 6 && node && node !== document.body; depth++, node = node.parentElement) {
          const text = String(node.textContent || '').toLowerCase();
          if (node.contains(input) && /\b(agent|image|video|480p|720p|9:16|16:9|1:1|2:3|3:2|6s|10s)\b/i.test(text) && isValidComposerRoot(node, input)) {
            root = node;
          }
        }
      }
      if (!isValidComposerRoot(root, input)) return null;
      const inputRect = input.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const rootText = String(root.textContent || '').toLowerCase();
      const hasComposerControl = /\b(agent|image|video|480p|720p|9:16|16:9|1:1|2:3|3:2|6s|10s)\b/i.test(rootText)
        || root.querySelector('button,[role="button"],[role="radio"],label,input[type="file"],[data-state],[tabindex]');
      const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
      return isBottom && hasComposerControl ? { input, root, inputRect, rootRect } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
}

async function composerSettingPageAction(action, settingType, expectedValue, options = {}) {
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const st = window.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
  };
  const isBlockedComposerRootCandidate = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
  const isBlockedSettingControl = (el, toolbar) => {
    if (!el || !toolbar || !toolbar.contains(el)) return true;
    return !!el.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
  };
  const hasBlockedSurfaceText = (el) => /Featured Templates|Discover|Create Template/i.test(String(el?.textContent || ''));
  const isValidComposerRoot = (root, input) => {
    if (!root || root === document.body || isBlockedComposerRootCandidate(root) || hasBlockedSurfaceText(root)) return false;
    const rootRect = root.getBoundingClientRect();
    const rootHeight = Number(rootRect.height || 0);
    if (rootHeight < 80 || rootHeight > 360) return false;
    if (Number(rootRect.top || 0) < window.innerHeight * 0.45) return false;
    if (input && !root.contains(input)) return false;
    return true;
  };
  function findBottomComposerScope() {
    const inputSelectors = [
      'textarea[placeholder*="Type to imagine" i]',
      'textarea[placeholder*="Imagine" i]',
      'textarea[placeholder*="Describe" i]',
      'textarea[placeholder*="Enter" i]',
      'input[placeholder*="Imagine" i]',
      'input[placeholder*="Describe" i]',
      'input[placeholder*="Enter" i]',
      'div[contenteditable="true"][data-lexical-editor]',
      'div[contenteditable="true"]',
      'textarea',
    ].join(',');
    return Array.from(document.querySelectorAll(inputSelectors))
      .filter(input => isVisible(input) && !isBlockedComposerRootCandidate(input))
      .map(input => {
        let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
        if (root && !isValidComposerRoot(root, input)) root = null;
        if (!root) {
          let node = input.parentElement;
          for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
            const text = String(node.textContent || '').toLowerCase();
            if (node.querySelector('button,[role="button"],[role="radio"],label,input[type="file"],[data-state],[tabindex]') && /\b(agent|image|video|480p|720p|9:16|16:9|1:1|2:3|3:2|6s|10s)\b/i.test(text) && isValidComposerRoot(node, input)) {
              root = node;
              break;
            }
          }
        }
        if (root) {
          let node = root.parentElement;
          for (let depth = 0; depth < 6 && node && node !== document.body; depth++, node = node.parentElement) {
            const text = String(node.textContent || '').toLowerCase();
            if (node.contains(input) && /\b(agent|image|video|480p|720p|9:16|16:9|1:1|2:3|3:2|6s|10s)\b/i.test(text) && isValidComposerRoot(node, input)) {
              root = node;
            }
          }
        }
        if (root) {
          let semanticRoot = root;
          let node = root.parentElement;
          for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
            const rect = node.getBoundingClientRect?.() || {};
            const text = String(node.textContent || '');
            const hasSemanticSettings = node.querySelector?.('[role="radiogroup"][aria-label*="Video resolution" i],[role="radiogroup"][aria-label*="Video duration" i],button[aria-label*="Aspect Ratio" i]');
            const bottomish = Number(rect.bottom || 0) > window.innerHeight * 0.70 && Number(rect.top || 0) > window.innerHeight * 0.30;
            const reasonableSize = Number(rect.height || 0) >= 80 && Number(rect.height || 0) <= 520;
            if (node.contains(input) && hasSemanticSettings && bottomish && reasonableSize && !isBlockedComposerRootCandidate(node) && !hasBlockedSurfaceText(node)) {
              semanticRoot = node;
            }
          }
          root = semanticRoot;
        }
      if (!isValidComposerRoot(root, input)) return null;
        const inputRect = input.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        const rootText = String(root.textContent || '').toLowerCase();
        const hasComposerControl = /\b(agent|image|video|480p|720p|9:16|16:9|1:1|2:3|3:2|6s|10s)\b/i.test(rootText)
          || root.querySelector('button,[role="button"],[role="radio"],label,input[type="file"],[data-state],[tabindex]');
        const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
        return isBottom && hasComposerControl ? { input, root, inputRect, rootRect } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
  }

  const ratioMap = {
    '9:16': ['9:16', '9/16', 'vertical', 'portrait', 'shorts'],
    '16:9': ['16:9', '16/9', 'widescreen', 'landscape'],
    '1:1': ['1:1', '1/1', 'square'],
    '2:3': ['2:3', '2/3', 'tall'],
    '3:2': ['3:2', '3/2', 'wide'],
  };
  const settingMaps = {
    ratio: ratioMap,
    mode: {
      Image: ['image', 'hinh anh', 'hình ảnh', 'anh', 'ảnh'],
      Video: ['video'],
    },
    resolution: {
      '480p': ['480p', '480 p'],
      '720p': ['720p', '720 p'],
    },
    duration: {
      '6s': ['6s', '6 sec', '6sec', '6 second', '6 giay', '6 giây'],
      '10s': ['10s', '10 sec', '10sec', '10 second', '10 giay', '10 giây'],
    },
  };
  const canonicalValue = (() => {
    const raw = String(expectedValue || '').trim().toLowerCase();
    const rawUi = String(expectedValue || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (settingType === 'duration') {
      if (raw === '10' || raw === '10s') return '10s';
      if (raw === '6' || raw === '6s' || raw === '5' || raw === '5s') return '6s';
    }
    if (settingType === 'resolution') {
      if (raw.includes('480')) return '480p';
      if (raw.includes('720')) return '720p';
    }
    if (settingType === 'mode') {
      if (['image', 'hinh anh', 'anh'].includes(rawUi) || raw === 'ảnh') return 'Image';
      if (rawUi === 'video') return 'Video';
    }
    return settingMaps[settingType]?.[expectedValue] ? expectedValue : String(expectedValue || '').trim();
  })();
  const map = settingMaps[settingType] || {};
  const normalizeUiText = (text) => String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const expectedAliases = (map[canonicalValue] || [canonicalValue]).map(normalizeUiText);
  const allAliases = Object.values(map).flat().map(normalizeUiText);
  const normalize = (text) => normalizeUiText(text);
  const normalizeExact = (text) => normalize(text).replace(/\s+/g, '');
  const SETTING_GROUP_ALIASES = {
    mode: ['generation mode', 'che do tao', 'chế độ tạo', 'mode', 'generation'],
    resolution: ['video resolution', 'do phan giai video', 'độ phân giải video', 'resolution'],
    duration: ['video duration', 'thoi luong video', 'thời lượng video', 'duration'],
  };
  const normalizedSettingGroupAliases = Object.fromEntries(
    Object.entries(SETTING_GROUP_ALIASES).map(([key, aliases]) => [key, aliases.map(normalizeUiText)])
  );
  const matchesSettingGroupAlias = (text, type) => {
    const hay = normalizeUiText(text);
    return (normalizedSettingGroupAliases[type] || []).some(alias => alias && (hay === alias || hay.includes(alias)));
  };
  const isSettingGroupBySignature = (group, type) => {
    const label = normalizeUiText(group?.getAttribute?.('aria-label') || '');
    const text = normalizeUiText(group?.textContent || '');
    if (matchesSettingGroupAlias(label, type)) return true;
    if (type === 'mode') {
      const hasVideo = text.includes('video');
      const hasImage = text.includes('image') || text.includes('hinh anh') || /\banh\b/.test(text);
      return hasVideo && hasImage;
    }
    if (type === 'resolution') return /480\s*p|720\s*p/.test(text);
    if (type === 'duration') return /(^|\D)(6|10)\s*s(\D|$)/.test(text);
    return false;
  };
  const getControlParts = (el) => [
    el?.textContent,
    el?.getAttribute?.('aria-label'),
    el?.getAttribute?.('title'),
    el?.getAttribute?.('data-value'),
  ].filter(Boolean).map(text => String(text).replace(/\s+/g, ' ').trim()).filter(Boolean);
  const getControlText = (el) => getControlParts(el).join(' ').trim();
  const exactAliasesFor = (value) => (map[value] || [value]).map(v => normalizeExact(v));
  const detectValueFromParts = (parts) => {
    const normalizedParts = parts.map(normalizeExact);
    for (const [value] of Object.entries(map)) {
      const aliases = exactAliasesFor(value);
      if (normalizedParts.some(part => aliases.includes(part))) return value;
    }
    return null;
  };
  const detectValue = (text) => {
    const part = normalizeExact(text);
    for (const [value] of Object.entries(map)) {
      if (exactAliasesFor(value).includes(part)) return value;
    }
    return null;
  };
  const detectLooseValue = (text) => {
    const hay = normalize(text);
    for (const [value, aliases] of Object.entries(map)) {
      if (aliases.some(alias => hay.includes(normalizeUiText(alias)))) return value;
    }
    return null;
  };
  const containsExpected = (text) => {
    const hay = normalize(text);
    return expectedAliases.some(alias => alias && hay.includes(alias));
  };
  const hasAnySettingValue = (text) => {
    const hay = normalize(text);
    return allAliases.some(alias => alias && hay.includes(alias));
  };
  const containsMultipleSettingValues = (text) => {
    const compact = normalizeExact(text);
    if (/480p720p|720p480p|6s10s|10s6s/.test(compact)) return true;
    const values = Object.keys(map).filter(value => exactAliasesFor(value).some(alias => compact.includes(alias)));
    return values.length > 1;
  };
  const rectSummary = (el) => {
    const rect = el?.getBoundingClientRect?.() || {};
    return {
      x: Math.round(rect.left || 0),
      y: Math.round(rect.top || 0),
      w: Math.round(rect.width || 0),
      h: Math.round(rect.height || 0),
    };
  };
  const viLogs = [];
  const logVi = (msg, type = 'info') => {
    viLogs.push({ msg, type });
    try { console.log(msg); } catch {}
  };
  const withViLogs = (res) => ({ ...res, viLogs: [...viLogs, ...(res?.viLogs || [])] });
  const isSmallClickableSurface = (el) => {
    const rect = el?.getBoundingClientRect?.() || {};
    const text = getControlText(el).replace(/\s+/g, ' ').trim();
    if (Number(rect.width || 0) <= 0 || Number(rect.height || 0) <= 0) return false;
    if (Number(rect.width || 0) > 140 || Number(rect.height || 0) > 80) return false;
    if (/Featured Templates|Discover|Create Template/i.test(text)) return false;
    if (containsMultipleSettingValues(text)) return false;
    return true;
  };
  const getSelectionMethod = (el) => {
    if (['aria-pressed', 'aria-checked', 'data-active', 'data-checked'].some(attr => String(el.getAttribute?.(attr) || '').toLowerCase() === 'true')) return 'active-control';
    if (['aria-selected', 'data-selected'].some(attr => String(el.getAttribute?.(attr) || '').toLowerCase() === 'true')) return 'selected-control';
    const state = String(el.getAttribute?.('data-state') || '').toLowerCase();
    if (state === 'checked' || state === 'active') return 'active-control';
    if (state === 'selected') return 'selected-control';
    const cls = String(el.getAttribute?.('class') || el.className || '').toLowerCase();
    if (/\b(active|checked)\b/.test(cls)) return 'active-control';
    if (/\bselected\b/.test(cls)) return 'selected-control';
    return null;
  };
  const isExplicitlyInactive = (el) => ['aria-pressed', 'aria-checked', 'aria-selected', 'data-selected', 'data-active', 'data-checked']
    .some(attr => String(el.getAttribute?.(attr) || '').toLowerCase() === 'false');
  const isDisabled = (el) => el?.disabled === true
    || String(el?.getAttribute?.('disabled') || '').toLowerCase() === 'true'
    || String(el?.getAttribute?.('aria-disabled') || '').toLowerCase() === 'true'
    || String(el?.getAttribute?.('data-disabled') || '').toLowerCase() === 'true';
  const trustedClick = (el) => {
    if (!el) return;
    try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch {}
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } catch {}
    try { el.click(); } catch {}
  };
  const isSmallLeafControl = (el) => {
    const rect = el?.getBoundingClientRect?.() || {};
    const text = getControlText(el).replace(/\s+/g, ' ').trim();
    if (Number(rect.width || 0) <= 0 || Number(rect.height || 0) <= 0) return false;
    if (Number(rect.width || 0) > 160 || Number(rect.height || 0) > 80) return false;
    if (text.length > 40) return false;
    if (/Featured Templates|Discover|Create Template/i.test(text)) return false;
    if (containsMultipleSettingValues(text)) return false;
    return true;
  };
  const isClickableControl = (el) => {
    const tag = String(el?.tagName || '').toUpperCase();
    const role = String(el?.getAttribute?.('role') || '').toLowerCase();
    return (tag === 'BUTTON' || tag === 'LABEL' || ['button', 'radio', 'option', 'menuitemradio'].includes(role) || el?.getAttribute?.('tabindex') !== null) && isSmallLeafControl(el);
  };
  const isClickableElement = (el) => {
    const tag = String(el?.tagName || '').toUpperCase();
    const role = String(el?.getAttribute?.('role') || '').toLowerCase();
    const cursor = String(window.getComputedStyle?.(el)?.cursor || '').toLowerCase();
    return tag === 'BUTTON'
      || tag === 'LABEL'
      || ['button', 'radio', 'option', 'menuitemradio'].includes(role)
      || el?.getAttribute?.('tabindex') !== null
      || cursor === 'pointer';
  };
  const findComposerToolbar = (scope) => {
    const root = scope?.root;
    if (!root) return null;
    const controlValues = ['480p', '720p', '6s', '10s', '9:16', '16:9', '1:1', '2:3', '3:2'];
    const collectText = (el) => `${getControlText(el)} ${Array.from(el.querySelectorAll?.('button,[role="button"],[role="radio"],label,[data-value],[title],span,div') || []).map(getControlText).join(' ')}`;
    const candidates = [root, ...Array.from(root.querySelectorAll('[class*="toolbar" i],[class*="control" i],[class*="bar" i],footer,section,div'))]
      .filter(el => root.contains(el) && isVisible(el) && !isBlockedComposerRootCandidate(el) && !hasBlockedSurfaceText(el))
      .map(el => {
        const rect = el.getBoundingClientRect?.() || {};
        const text = collectText(el);
        const valueCount = controlValues.filter(value => normalizeExact(text).includes(normalizeExact(value))).length;
        const labelCount = /\b(image|video|agent)\b/i.test(text) ? 1 : 0;
        const className = String(el.getAttribute?.('class') || el.className || '').toLowerCase();
        const toolbarLike = /\b(toolbar|controls?|composer|bar)\b/.test(className);
        const wrapperLike = /480p720p|720p480p|6s10s|10s6s/.test(normalizeExact(text));
        return {
          el,
          rect,
          valueCount,
          labelCount,
          toolbarLike,
          wrapperLike,
          score: valueCount + labelCount,
          area: Number(rect.width || 0) * Number(rect.height || 0),
        };
      })
      .filter(item => item.score >= 2
        && Number(item.rect.height || 0) <= 180
        && Number(item.rect.top || 0) >= scope.rootRect.top - 10
        && Number(item.rect.bottom || 0) >= scope.rootRect.top
        && !(item.wrapperLike && !item.labelCount && !item.toolbarLike))
      .sort((a, b) => (a.area - b.area) || (b.rect.bottom - a.rect.bottom));
    return candidates[0]?.el || null;
  };
  const valueListForSetting = () => {
    if (settingType === 'resolution') return ['480p', '720p'];
    if (settingType === 'duration') return ['6s', '10s'];
    return Object.keys(map);
  };
  const exactValueFromText = (text) => {
    const part = normalizeExact(text);
    for (const value of valueListForSetting()) {
      if (exactAliasesFor(value).includes(part)) return value;
    }
    return null;
  };
  const findExactTextNodes = (root, values = valueListForSetting()) => {
    const aliases = new Map(values.map(value => [value, exactAliasesFor(value)]));
    const matches = [];
    const seen = new Set();
    const acceptText = (text, parentElement, node = null) => {
      const normalized = normalizeExact(text);
      for (const [value, valueAliases] of aliases.entries()) {
        if (!valueAliases.includes(normalized)) continue;
        if (!parentElement || !isVisible(parentElement) || isBlockedSettingControl(parentElement, root)) continue;
        const key = `${value}:${normalized}:${matches.length}:${parentElement}`;
        if (seen.has(key)) continue;
        seen.add(key);
        matches.push({ node, parentElement, text: String(text || '').trim(), value });
      }
    };
    if (document.createTreeWalker && window.NodeFilter) {
      const walker = document.createTreeWalker(root, window.NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const normalized = normalizeExact(node.nodeValue || '');
          const matched = values.some(value => aliases.get(value).includes(normalized));
          return matched ? window.NodeFilter.FILTER_ACCEPT : window.NodeFilter.FILTER_REJECT;
        },
      });
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        acceptText(node.nodeValue, node.parentElement, node);
      }
    }
    const elements = [root, ...Array.from(root.querySelectorAll?.('button,[role="button"],[role="radio"],label,[data-value],[title],span,div') || [])];
    for (const el of elements) {
      if (!isVisible(el) || isBlockedSettingControl(el, root)) continue;
      for (const part of getControlParts(el)) acceptText(part, el, null);
    }
    return matches;
  };
  const findClickableFromTextNode = (textNode, toolbar) => {
    let node = textNode?.parentElement || textNode;
    for (let depth = 0; depth < 6 && node && toolbar.contains(node); depth++, node = node.parentElement) {
      if (isClickableElement(node) && isSmallClickableSurface(node) && !isDisabled(node)) return { el: node, method: 'clickable-parent' };
    }
    const fallback = textNode?.parentElement || textNode;
    if (fallback && toolbar.contains(fallback) && isSmallClickableSurface(fallback) && !isDisabled(fallback)) {
      return { el: fallback, method: 'text-parent-warning' };
    }
    return { el: null, method: 'not-clickable' };
  };
  const isRatioTrigger = (el) => {
    const role = String(el?.getAttribute?.('role') || '').toLowerCase();
    const text = getControlText(el);
    const aria = String(el?.getAttribute?.('aria-label') || '').toLowerCase();
    if ((el?.tagName === 'BUTTON' || role === 'button') && aria.includes('aspect ratio')) return true;
    if (!(el?.tagName === 'BUTTON' || el?.tagName === 'LABEL' || role === 'button')) return false;
    const rect = el.getBoundingClientRect?.() || {};
    const isSmallControl = Number(rect.width || 0) <= 240 && Number(rect.height || 0) <= 80;
    if (containsExpected(text) && isSmallControl) return true;
    if (el.getAttribute?.('aria-expanded') !== null || el.getAttribute?.('aria-haspopup') !== null) return hasAnySettingValue(text);
    const parentText = getControlText(el.parentElement || el);
    return hasAnySettingValue(text) && /\b(480p|720p|6s|10s|video|image)\b/i.test(parentText);
  };
  function findRadioGroup(root, label) {
    const groups = Array.from(root?.querySelectorAll?.('[role="radiogroup"]') || []);
    const wanted = normalizeUiText(label);
    return groups.find(group => {
      if (!isVisible(group) || isBlockedComposerRootCandidate(group)) return false;
      const aria = normalizeUiText(group.getAttribute?.('aria-label') || '');
      return aria.includes(wanted);
    }) || null;
  }
  function findRadioGroupDirect(root, type) {
    const groups = Array.from(root?.querySelectorAll?.('[role="radiogroup"]') || [])
      .filter(group => isVisible(group));
    const labelMatchesType = (group) => {
      const label = normalizeUiText(group.getAttribute?.('aria-label') || '');
      if (type === 'mode') return label.includes('generation mode') || label.includes('che do tao') || matchesSettingGroupAlias(label, type);
      if (type === 'resolution') return label.includes('video resolution') || label.includes('do phan giai video') || matchesSettingGroupAlias(label, type);
      if (type === 'duration') return label.includes('video duration') || label.includes('thoi luong video') || matchesSettingGroupAlias(label, type);
      return false;
    };
    const labelMatch = groups.find(labelMatchesType);
    if (labelMatch) {
      logVi(`[SF settings] findRadioGroupDirect ${type} matched by aria-label="${labelMatch.getAttribute?.('aria-label') || ''}"`);
      return labelMatch;
    }
    const signatureMatch = groups.find(group => {
      const label = normalizeUiText(group.getAttribute?.('aria-label') || '');
      if (label && !labelMatchesType(group)) return false;
      const text = normalizeUiText(group.textContent || '');
      const optionValues = getRadioOptions(group)
        .map(option => detectValueFromParts(getControlParts(option)) || detectLooseValue(getControlText(option)) || detectLooseValue(option.textContent || ''))
        .filter(Boolean);
      if (type === 'mode') {
        const hasVideo = text.includes('video');
        const hasImage = text.includes('image') || text.includes('hinh anh') || /\banh\b/.test(text);
        return hasVideo && hasImage && optionValues.includes('Video') && optionValues.includes('Image');
      }
      if (type === 'resolution') {
        const hasResolutionText = /480\s*p/.test(text) && /720\s*p/.test(text);
        return hasResolutionText && optionValues.includes('480p') && optionValues.includes('720p') && optionValues.length <= 3;
      }
      if (type === 'duration') {
        const hasDurationText = /(^|\D)6\s*s(\D|$)/.test(text) && /(^|\D)10\s*s(\D|$)/.test(text);
        return hasDurationText && optionValues.includes('6s') && optionValues.includes('10s') && optionValues.length <= 3;
      }
      return false;
    });
    if (signatureMatch) {
      logVi(`[SF settings] ${type} matched by option signature text="${normalizeUiText(signatureMatch.textContent || '')}"`);
      return signatureMatch;
    }
    const exactDebugFallback = groups.find(group => {
      const label = normalizeUiText(group.getAttribute?.('aria-label') || '');
      return (normalizedSettingGroupAliases[type] || []).some(alias => label === alias);
    });
    if (exactDebugFallback) {
      logVi(`[SF settings] findRadioGroupDirect ${type} fallback exact aria-label="${exactDebugFallback.getAttribute?.('aria-label') || ''}"`, 'warn');
      return exactDebugFallback;
    }
    return null;
  }
  function getRadioOptions(group) {
    return Array.from(group?.querySelectorAll?.('button[role="radio"], [role="radio"]') || [])
      .filter(btn => isVisible(btn) && String(btn.getAttribute?.('role') || '').toLowerCase() === 'radio');
  }
  const exactRadioText = (el) => String(el?.textContent || '').replace(/\s+/g, '').trim();
  const readRadioCandidates = (group) => getRadioOptions(group)
    .map(btn => {
      const text = exactRadioText(btn);
      const ariaChecked = String(btn.getAttribute?.('aria-checked') || '');
      const detectedValue = detectValueFromParts(getControlParts(btn)) || detectLooseValue(getControlText(btn)) || detectLooseValue(text);
      return {
        el: btn,
        text,
        detectedValue,
        ariaChecked,
        selected: ariaChecked.toLowerCase() === 'true',
        disabled: btn.disabled === true || String(btn.getAttribute?.('aria-disabled') || '').toLowerCase() === 'true',
        rect: rectSummary(btn),
      };
    })
    .filter(candidate => Boolean(candidate.text));
  const getSemanticRadioCandidates = readRadioCandidates;
  const semanticRadioGroupLabel = settingType === 'resolution'
    ? 'Video resolution'
    : settingType === 'duration'
      ? 'Video duration'
      : settingType === 'mode'
        ? 'Generation mode'
        : null;
  const findAspectRatioTrigger = (root) => {
    const candidates = Array.from(root?.querySelectorAll?.('button,[role="button"]') || [])
      .filter(el => isVisible(el) && !isBlockedComposerRootCandidate(el) && isRatioTrigger(el))
      .map(el => ({
        el,
        text: getControlText(el),
        detectedValue: detectValueFromParts(getControlParts(el)) || detectLooseValue(getControlText(el)),
        rect: rectSummary(el),
      }))
      .filter(item => item.detectedValue || /aspect ratio/i.test(item.text));
    return candidates.sort((a, b) => (b.rect.y - a.rect.y))[0] || null;
  };
  const compactText = (el, max = 300) => normalize(String(el?.textContent || '')).slice(0, max);
  const collectRadioGroupDebug = (root) => Array.from(root?.querySelectorAll?.('[role="radiogroup"]') || [])
    .filter(group => isVisible(group))
    .map((group, index) => ({
      index: index + 1,
      ariaLabel: group.getAttribute?.('aria-label') || '',
      text: compactText(group, 160),
      optionCount: getRadioOptions(group).length,
      rect: rectSummary(group),
    }));
  const composerDebug = (root, extra = {}) => ({
    composerFound: Boolean(root),
    composerRect: rectSummary(root),
    rootTextCompact: compactText(root, 300),
    radioGroups: collectRadioGroupDebug(root),
    ...extra,
  });
  const radioCandidatePayload = (candidates) => candidates.map(({ text, detectedValue, ariaChecked, selected, disabled, rect }) => ({
    text,
    detectedValue,
    ariaChecked,
    selected,
    disabled,
    rect,
  }));
  async function handleRadioGroupSetting(actionName, root, type, expected) {
    const label = type === 'resolution' ? 'Video resolution' : type === 'duration' ? 'Video duration' : 'Generation mode';
    const wanted = type === 'resolution' ? 'video resolution' : type === 'duration' ? 'video duration' : 'generation mode';
    const wantedAliases = normalizedSettingGroupAliases[type] || [wanted];
    logVi(`[SF cài đặt] Đã tìm thấy composer dưới cùng: x=${rectSummary(root).x}, y=${rectSummary(root).y}, w=${rectSummary(root).w}, h=${rectSummary(root).h}`);
    logVi(`[SF cài đặt] Tìm nhóm "${label}" trong composer...`);
    const radioGroups = collectRadioGroupDebug(root);
    const ariaLabels = radioGroups.map(item => normalizeUiText(item.ariaLabel || ''));
    logVi(`[SF debug] wanted="${wanted}"`, 'info');
    logVi(`[SF debug] wanted aliases=${JSON.stringify(wantedAliases)}`, 'info');
    logVi(`[SF debug] ariaLabels=${JSON.stringify(ariaLabels)}`, 'info');
    const group = findRadioGroupDirect(root, type);
    if (!group) {
      const debug = composerDebug(root, { wanted, ariaLabels });
      logVi(`[SF cài đặt] Kết quả nhóm ${type}: NOT FOUND`, 'warn');
      logVi(`[SF cài đặt] KHÔNG tìm thấy nhóm "${label}".`, 'err');
      logVi(`[SF debug] Số radiogroup tìm thấy trong composer: ${debug.radioGroups.length}`, 'warn');
      debug.radioGroups.forEach((item) => logVi(`[SF debug] Radiogroup #${item.index} aria-label="${item.ariaLabel}" text="${item.text}"`, 'warn'));
      logVi(`[SF debug] Composer text rút gọn: "${debug.rootTextCompact}"`, 'warn');
      if (ariaLabels.some(aria => wantedAliases.some(alias => aria === alias || aria.includes(alias)))) {
        return withViLogs({
          ok: false,
          settingType: type,
          expectedValue: expected,
          detectedValue: null,
          error: `BUG: radioGroups debug có ${label} nhưng findRadioGroupDirect không match`,
          candidates: [],
          debug,
        });
      }
      logVi('[SF cài đặt] Không thấy radiogroup, chuyển sang fallback tìm text node.', 'warn');
      return {
        fallback: true,
        ok: false,
        settingType: type,
        expectedValue: expected,
        detectedValue: null,
        error: `Không tìm thấy nhóm ${label}`,
        candidates: [],
        debug,
        viLogs: [...viLogs],
      };
    }
    const candidates = readRadioCandidates(group);
    const selected = candidates.find(candidate => candidate.selected);
    const detectedValue = selected?.detectedValue || selected?.text || null;
    logVi(`[SF cài đặt] Kết quả nhóm ${type}: FOUND`);
    logVi(`[SF cài đặt] Tìm thấy nhóm ${type} bằng aria-label="${group.getAttribute?.('aria-label') || ''}"`);
    logVi(`[SF cài đặt] Các lựa chọn ${type}: ${candidates.map(item => `${item.text || item.detectedValue}(checked=${item.ariaChecked || 'null'})`).join(', ') || 'không có'}`);
    logVi(`[SF cài đặt] ${type === 'resolution' ? 'Resolution' : type === 'duration' ? 'Duration' : 'Mode'} hiện tại: ${detectedValue || 'unknown'} | Mong muốn: ${expected}`);
    console.log(`[SF settings guard] ${type} group found aria-label="${group.getAttribute?.('aria-label') || ''}"`);
    console.log(`[SF settings guard] ${type} candidates=`, radioCandidatePayload(candidates));
    console.log(`[SF settings guard] ${type} detected=${detectedValue || 'unknown'}`);
    const debug = composerDebug(root, { groupAriaLabel: group.getAttribute?.('aria-label') || '' });
    if (actionName === 'verify') {
      if (detectedValue === expected) {
        logVi(`[SF cài đặt] ${type === 'resolution' ? 'Resolution' : type === 'duration' ? 'Duration' : 'Mode'} đã đúng, không cần bấm.`);
        return withViLogs({
          ok: true,
          settingType: type,
          expectedValue: expected,
          detectedValue,
          method: 'active-control',
          candidates: radioCandidatePayload(candidates),
          debug,
        });
      }
      return withViLogs({
        ok: false,
        settingType: type,
        expectedValue: expected,
        detectedValue,
        method: detectedValue ? 'active-control' : 'not-detected',
        error: detectedValue ? `${type} is ${detectedValue}, expected ${expected}` : `${label} radiogroup has no selected option`,
        candidates: radioCandidatePayload(candidates),
        debug,
      });
    }
    const target = candidates.find(candidate => candidate.detectedValue === expected || normalizeExact(candidate.text) === normalizeExact(expected));
    if (!target) {
      return withViLogs({
        ok: false,
        settingType: type,
        expectedValue: expected,
        detectedValue,
        error: `Không tìm thấy nhóm ${label} hoặc không tìm thấy nút ${expected}`,
        candidates: radioCandidatePayload(candidates),
        debug,
      });
    }
    if (target.disabled) {
      return withViLogs({
        ok: false,
        settingType: type,
        expectedValue: expected,
        detectedValue,
        error: `Nút ${expected} đang bị disabled`,
        candidates: radioCandidatePayload(candidates),
        debug,
      });
    }
    logVi(`[SF cài đặt] Đang bấm nút ${type}: ${expected}`);
    console.log(`[SF settings guard] ${type} clicking target=${expected}`);
    trustedClick(target.el);
    logVi(`[SF cài đặt] Đã bấm ${expected}, chờ UI cập nhật...`);
    return withViLogs({
      ok: true,
      settingType: type,
      expectedValue: expected,
      detectedValue,
      method: 'radiogroup-option-clicked',
      clickedText: target.text,
      targetText: target.text,
      candidates: radioCandidatePayload(candidates),
      debug,
    });
  }
  async function handleAspectRatioSetting(actionName, root, expected) {
    logVi('[SF cài đặt] Tìm nút Aspect Ratio...');
    const directButton = Array.from(root?.querySelectorAll?.('button,[role="button"]') || [])
      .find(el => isVisible(el) && !isBlockedComposerRootCandidate(el) && /aspect ratio/i.test(String(el.getAttribute?.('aria-label') || '')));
    const trigger = directButton
      ? { el: directButton, text: getControlText(directButton), detectedValue: (String(directButton.textContent || '').match(/\d+:\d+/)?.[0] || detectLooseValue(getControlText(directButton))), rect: rectSummary(directButton) }
      : findAspectRatioTrigger(root);
    const triggerText = trigger?.text || '';
    const currentRatio = trigger?.detectedValue || String(trigger?.el?.textContent || triggerText || '').match(/\d+:\d+/)?.[0] || null;
    if (!trigger) {
      logVi('[SF cài đặt] KHÔNG tìm thấy nút Aspect Ratio.', 'err');
      return withViLogs({
        ok: false,
        settingType: 'ratio',
        expectedValue: expected,
        detectedValue: null,
        error: 'Aspect Ratio trigger not found',
        candidates: [],
        debug: composerDebug(root),
      });
    }
    logVi(`[SF cài đặt] Aspect Ratio hiện tại: ${currentRatio || 'unknown'} | Mong muốn: ${expected}`);
    console.log(`[SF settings guard] ratio trigger found text=${triggerText}`);
    if (actionName === 'verify') {
      if (currentRatio === expected || containsExpected(triggerText)) {
        logVi('[SF cài đặt] Aspect Ratio đã đúng, không cần bấm.');
        console.log(`[SF settings guard] ratio selected-display=${expected}`);
        return withViLogs({
          ok: true,
          settingType: 'ratio',
          expectedValue: expected,
          detectedValue: expected,
          method: 'selected-display',
          triggerText,
          debug: composerDebug(root),
        });
      }
      return withViLogs({
        ok: false,
        settingType: 'ratio',
        expectedValue: expected,
        detectedValue: currentRatio,
        method: currentRatio ? 'selected-display' : 'not-detected',
        error: currentRatio ? `ratio is ${currentRatio}, expected ${expected}` : 'Aspect Ratio trigger value not detected',
        candidates: [{ text: triggerText, detectedValue: currentRatio, rect: trigger.rect }],
        debug: composerDebug(root),
      });
    }
    if (currentRatio === expected || containsExpected(triggerText)) {
      logVi('[SF cài đặt] Aspect Ratio đã đúng, không cần bấm.');
      console.log(`[SF settings guard] ratio selected-display=${expected}`);
      return withViLogs({
        ok: true,
        method: 'already-displayed',
        settingType: 'ratio',
        expectedValue: expected,
        detectedValue: expected,
        triggerText,
        debug: composerDebug(root),
      });
    }
    trustedClick(trigger.el);
    logVi(`[SF cài đặt] Đang mở menu Aspect Ratio để chọn ${expected}...`);
    await sleep(Math.max(200, Math.min(500, Number(options?.dropdownWaitMs || 300))));
    const collectRatioDropdownCandidates = () => {
      const optionCandidates = [];
      const seen = new Set();
      const addNode = (node) => {
        if (!node || seen.has(node) || node === trigger.el || trigger.el.contains(node) || !isVisible(node) || isBlockedComposerRootCandidate(node)) return;
        seen.add(node);
        const text = getControlText(node);
        if (!hasAnySettingValue(text) && !containsExpected(text)) return;
        const rect = node.getBoundingClientRect?.() || {};
        if (Number(rect.width || 0) > 420 || Number(rect.height || 0) > 220) return;
        const role = String(node.getAttribute?.('role') || '').toLowerCase();
        const score = (containsExpected(text) ? 100 : 0)
          + (normalize(text).startsWith(normalize(expected)) ? 30 : 0)
          + (['menuitemradio', 'menuitem', 'option'].includes(role) ? 20 : 0)
          + (node.tagName === 'BUTTON' ? 10 : 0);
        optionCandidates.push({ el: node, text, detectedValue: detectValue(text) || detectLooseValue(text), expected: containsExpected(text), role, score, rect: rectSummary(node) });
      };
      const menuContainers = Array.from(document.querySelectorAll([
        '[role="menu"]',
        '[role="listbox"]',
        '[role="option"]',
        '[role="menuitem"]',
        '[role="menuitemradio"]',
        '[data-radix-popper-content-wrapper]',
        '[data-radix-collection-item]',
        '[class*="popover" i]',
        '[class*="dropdown" i]',
        '[class*="menu" i]',
      ].join(','))).filter(el => isVisible(el) && !isBlockedComposerRootCandidate(el));
      for (const container of menuContainers) {
        const nodes = [container, ...Array.from(container.querySelectorAll('[role="option"],[role="menuitem"],[role="menuitemradio"],[data-radix-collection-item],button,[role="button"],div,span'))];
        nodes.forEach(addNode);
      }
      Array.from(document.querySelectorAll('[role="option"],[role="menuitem"],[role="menuitemradio"],[data-radix-collection-item],button,[role="button"]'))
        .forEach(addNode);
      const tr = trigger.el.getBoundingClientRect?.() || {};
      for (let y = Math.max(0, Number(tr.top || 0) - 360); y <= Math.min(window.innerHeight, Number(tr.bottom || 0) + 160); y += 28) {
        for (let x = Math.max(0, Number(tr.left || 0) - 120); x <= Math.min(window.innerWidth, Number(tr.right || 0) + 180); x += 44) {
          let node = document.elementFromPoint?.(x, y);
          for (let depth = 0; depth < 4 && node && node !== document.body; depth++, node = node.parentElement) addNode(node);
        }
      }
      return optionCandidates
        .sort((a, b) => (b.score - a.score) || (a.rect.y - b.rect.y))
        .filter((item, index, list) => list.findIndex(other => other.text === item.text && other.rect.x === item.rect.x && other.rect.y === item.rect.y) === index);
    };
    let optionCandidates = [];
    let option = null;
    const start = Date.now();
    while (Date.now() - start < Number(options?.optionTimeoutMs || 5000)) {
      optionCandidates = collectRatioDropdownCandidates();
      option = optionCandidates.find(item => item.expected && item.detectedValue === expected) || optionCandidates.find(item => item.expected);
      if (option) break;
      await sleep(Number(options?.optionIntervalMs || 150));
    }
    console.log('[SF settings guard] ratio option candidates', optionCandidates.map(item => ({ text: item.text, detectedValue: item.detectedValue, expected: item.expected, role: item.role })));
    if (!option) {
      return withViLogs({
        ok: false,
        settingType: 'ratio',
        expectedValue: expected,
        detectedValue: currentRatio,
        error: 'ratio dropdown option not found',
        triggerText,
        candidates: optionCandidates.map(item => item.text).slice(0, 20),
        debug: composerDebug(root),
      });
    }
    const directOption = Array.from(document.querySelectorAll('[role="option"],[role="menuitem"],[role="menuitemradio"],[data-radix-collection-item],button,[role="button"]'))
      .find(node => node !== trigger.el && isVisible(node) && !isBlockedComposerRootCandidate(node) && containsExpected(getControlText(node)));
    const siblingOption = Array.from((directOption || option.el)?.parentElement?.children || [])
      .find(node => node !== trigger.el && isVisible(node) && !isBlockedComposerRootCandidate(node) && containsExpected(getControlText(node)));
    const optionEl = siblingOption || directOption || option.el;
    trustedClick(optionEl);
    logVi(`[SF cài đặt] Đã chọn Aspect Ratio: ${expected}`);
    await sleep(700);
    const afterRatio = String(trigger.el?.textContent || '').match(/\d+:\d+/)?.[0] || null;
    return withViLogs({
      ok: true,
      method: 'ratio-dropdown-option-clicked',
      settingType: 'ratio',
      expectedValue: expected,
      detectedValue: afterRatio || expected,
      clickedText: getControlText(optionEl) || option.text,
      optionText: getControlText(optionEl) || option.text,
      debug: composerDebug(root),
    });
  }

  const scope = options?.scope === 'bottomComposer' || !options?.scope ? findBottomComposerScope() : null;
  if (!scope) {
    logVi('[SF cài đặt] Không tìm thấy composer dưới cùng. Dừng.', 'err');
    return withViLogs({
      ok: false,
      settingType,
      expectedValue: canonicalValue,
      detectedValue: null,
      error: 'Bottom composer not found',
      candidates: [],
      debug: { composerFound: false },
    });
  }
  const root = scope.root;
  let semanticMiss = null;
  if (settingType === 'mode' || settingType === 'resolution' || settingType === 'duration') {
    const semanticRes = await handleRadioGroupSetting(action, root, settingType, canonicalValue);
    if (!semanticRes.fallback) return semanticRes;
    semanticMiss = semanticRes;
  }
  if (settingType === 'ratio') {
    const ratioRes = await handleAspectRatioSetting(action, root, canonicalValue);
    if (ratioRes.ok || ratioRes.error !== 'Aspect Ratio trigger not found') return ratioRes;
  }
  const toolbar = findComposerToolbar(scope);
  console.log('[SF settings guard] scope rect=', rectSummary(root));
  if (toolbar && settingType !== 'ratio') {
    console.log('[SF settings guard] toolbar rect=', rectSummary(toolbar));
  } else if (!toolbar && settingType !== 'ratio') {
    console.log('[SF settings guard] toolbar not found; root rect=', rectSummary(root), 'root text compact=', normalize(String(root.textContent || '')).slice(0, 200));
  }
  const controlSearchRoot = settingType === 'ratio' ? root : (toolbar || root);
  const leafControls = Array.from(controlSearchRoot.querySelectorAll(
    'button,[role="button"],[role="radio"],[role="option"],[role="menuitemradio"],[aria-pressed],[aria-checked],label,[data-value],[title],[data-state],[tabindex],div,span'
  ))
    .filter(el => controlSearchRoot.contains(el) && isVisible(el) && (settingType === 'ratio' ? !isBlockedComposerRootCandidate(el) : !isBlockedSettingControl(el, controlSearchRoot)))
    .map(el => {
      const parts = getControlParts(el);
      const text = getControlText(el);
      const detectedValue = settingType === 'ratio'
        ? (detectValueFromParts(parts) || (isSmallLeafControl(el) ? detectLooseValue(text) : null))
        : detectValueFromParts(parts);
      return {
        el,
        parts,
        text,
        displayText: parts.find(part => detectValue(part)) || text,
        detectedValue,
        selectionMethod: getSelectionMethod(el),
        inactive: isExplicitlyInactive(el),
        disabled: isDisabled(el),
        clickable: isClickableControl(el),
        rect: rectSummary(el),
        ratioTrigger: settingType === 'ratio' && isRatioTrigger(el),
        clickEl: el,
        fromExactText: false,
      };
    })
    .filter(item => {
      if (settingType === 'ratio') {
        if (!item.detectedValue && !item.ratioTrigger) return false;
        if (!item.ratioTrigger && !isSmallLeafControl(item.el)) return false;
        return true;
      }
      if (!item.detectedValue && !item.parts.some(part => detectValue(part) === canonicalValue)) return false;
      if (!isSmallLeafControl(item.el)) return false;
      return true;
    });
  const exactTextControls = settingType === 'ratio' ? [] : valueListForSetting().flatMap(value => {
    const nodes = findExactTextNodes(controlSearchRoot, [value]);
    return nodes.map(match => {
      const clickTarget = findClickableFromTextNode(match, controlSearchRoot);
      const selectionMethod = getSelectionMethod(clickTarget.el) || getSelectionMethod(match.parentElement);
      const disabled = isDisabled(clickTarget.el) || isDisabled(match.parentElement);
      return {
        el: match.parentElement,
        clickEl: clickTarget.el || match.parentElement,
        parts: [match.text],
        text: match.text,
        displayText: value,
        detectedValue: value,
        selectionMethod,
        inactive: isExplicitlyInactive(clickTarget.el) || isExplicitlyInactive(match.parentElement),
        disabled,
        clickable: Boolean(clickTarget.el) && !disabled,
        rect: rectSummary(clickTarget.el || match.parentElement),
        ratioTrigger: false,
        fromExactText: true,
        clickMethod: clickTarget.method,
      };
    });
  });
  if (settingType !== 'ratio') {
    const foundMap = Object.fromEntries(valueListForSetting().map(value => [value, exactTextControls.some(item => item.detectedValue === value)]));
    console.log(`[SF settings guard] ${settingType} exact text nodes found:`, foundMap);
  }
  const controls = [...leafControls, ...exactTextControls].filter((item, index, list) => {
    const key = `${item.detectedValue}:${item.displayText}:${item.rect.x}:${item.rect.y}:${item.rect.w}:${item.rect.h}`;
    return list.findIndex(other => `${other.detectedValue}:${other.displayText}:${other.rect.x}:${other.rect.y}:${other.rect.w}:${other.rect.h}` === key) === index;
  });

  const candidates = controls.map(item => ({
    text: item.displayText,
    ariaLabel: item.el.getAttribute?.('aria-label') || '',
    title: item.el.getAttribute?.('title') || '',
    dataValue: item.el.getAttribute?.('data-value') || '',
    className: item.el.getAttribute?.('class') || item.el.className || '',
    detectedValue: item.detectedValue,
    method: item.selectionMethod || (item.ratioTrigger ? 'selected-display' : 'visible-control'),
    inactive: item.inactive,
    disabled: item.disabled,
    selected: Boolean(item.selectionMethod),
    rect: item.rect,
  })).slice(0, 20);

  const verify = () => {
    const active = controls.find(item => item.selectionMethod && item.detectedValue);
    if (active) {
      if (active.detectedValue === canonicalValue) {
        return { ok: true, settingType, expectedValue: canonicalValue, detectedValue: active.detectedValue, method: active.selectionMethod };
      }
      return {
        ok: false,
        settingType,
        expectedValue: canonicalValue,
        detectedValue: active.detectedValue,
        method: active.selectionMethod,
        error: `${settingType} is ${active.detectedValue}, expected ${canonicalValue}`,
        candidates,
      };
    }
    if (settingType === 'ratio') {
      const trigger = controls.find(item => item.ratioTrigger && item.detectedValue === canonicalValue && !item.inactive);
      if (trigger) return { ok: true, settingType, expectedValue: canonicalValue, detectedValue: canonicalValue, method: 'selected-display', triggerText: trigger.text };
    }
    const displayed = settingType === 'ratio'
      ? controls.find(item => item.detectedValue === canonicalValue && !item.inactive)
      : null;
    if (displayed) {
      return { ok: true, settingType, expectedValue: canonicalValue, detectedValue: canonicalValue, method: 'selected-display', triggerText: displayed.text };
    }
    const detectedValue = controls.find(item => item.selectionMethod && item.detectedValue)?.detectedValue || null;
    return {
      ok: false,
      settingType,
      expectedValue: canonicalValue,
      detectedValue,
      method: detectedValue ? 'active-control' : 'not-detected',
      error: detectedValue ? `${settingType} is ${detectedValue}, expected ${canonicalValue}` : `Could not detect ${settingType}`,
      candidates,
    };
  };

  if (action === 'verify') {
    const verifyRes = verify();
    if (semanticMiss && !verifyRes.ok) {
      return {
        ...verifyRes,
        error: verifyRes.error || semanticMiss.error,
        debug: semanticMiss.debug,
        viLogs: [...(semanticMiss.viLogs || []), ...(verifyRes.viLogs || [])],
      };
    }
    return verifyRes;
  }

  if (settingType === 'ratio') {
    const triggerCandidates = controls
      .filter(item => item.ratioTrigger || item.detectedValue)
      .map(item => {
        const rect = item.el.getBoundingClientRect();
        const nearControls = /\b(480p|720p|6s|10s|video|image)\b/i.test(`${getControlText(item.el.parentElement || item.el)} ${getControlText(item.el.closest?.('[class*="toolbar" i],[class*="control" i],[class*="composer" i]') || item.el)}`);
        return {
          ...item,
          score: (item.detectedValue === canonicalValue ? 100 : 0) + (item.ratioTrigger ? 40 : 0) + (nearControls ? 20 : 0) + Math.round(rect.bottom / 100),
        };
      })
      .sort((a, b) => b.score - a.score);
    const trigger = triggerCandidates[0];
    const triggerText = trigger?.text || '';
    console.log('[SF settings guard] ratio trigger found', { triggerText, detectedValue: trigger?.detectedValue || null });
    if (!trigger) return { ok: false, settingType, expectedValue: canonicalValue, error: 'ratio dropdown trigger not found', candidates };
    if (trigger.detectedValue === canonicalValue || containsExpected(triggerText)) {
      return { ok: true, method: 'already-displayed', settingType, expectedValue: canonicalValue, detectedValue: canonicalValue, triggerText };
    }
    trigger.el.click();
    console.log('[SF settings guard] ratio dropdown opened', { triggerText, expectedValue: canonicalValue });
    await sleep(Math.max(200, Math.min(500, Number(options?.dropdownWaitMs || 300))));
    const menuContainers = Array.from(document.querySelectorAll([
      '[role="menu"]',
      '[role="listbox"]',
      '[role="option"]',
      '[data-radix-popper-content-wrapper]',
      '[class*="popover" i]',
      '[class*="dropdown" i]',
      '[class*="menu" i]',
    ].join(','))).filter(el => isVisible(el) && !isBlockedComposerRootCandidate(el));
    const optionCandidates = [];
    const seen = new Set();
    for (const container of menuContainers) {
      const nodes = [container, ...Array.from(container.querySelectorAll('[role="option"],[role="menuitem"],[role="menuitemradio"],button,[role="button"],div,span'))];
      for (const node of nodes) {
        if (seen.has(node) || !isVisible(node) || isBlockedComposerRootCandidate(node)) continue;
        seen.add(node);
        const text = getControlText(node);
        if (!hasAnySettingValue(text) && !containsExpected(text)) continue;
        optionCandidates.push({ el: node, text, detectedValue: detectValue(text), expected: containsExpected(text) });
      }
    }
    console.log('[SF settings guard] ratio option candidates', optionCandidates.map(item => ({ text: item.text, detectedValue: item.detectedValue, expected: item.expected })));
    const option = optionCandidates.find(item => item.expected);
    if (!option) {
      return { ok: false, settingType, expectedValue: canonicalValue, error: 'ratio dropdown option not found', triggerText, candidates: optionCandidates.map(item => item.text).slice(0, 20) };
    }
    option.el.click();
    console.log('[SF settings guard] ratio option clicked', { expectedValue: canonicalValue, optionText: option.text });
    await sleep(300);
    return { ok: true, method: 'dropdown-option-clicked', settingType, expectedValue: canonicalValue, optionText: option.text };
  }

  console.log(`[SF settings guard] ${settingType} candidates=`, candidates);
  const target = controls.find(item => item.fromExactText && item.detectedValue === canonicalValue && item.clickable && !item.disabled)
    || controls.find(item => item.detectedValue === canonicalValue && item.clickable && !item.disabled)
    || controls.find(item => item.parts.some(part => detectValue(part) === canonicalValue) && item.clickable && !item.disabled)
    || controls.find(item => item.detectedValue === canonicalValue && !item.disabled);
  if (!target) {
    return {
      ok: false,
      settingType,
      expectedValue: canonicalValue,
      detectedValue: semanticMiss?.detectedValue || null,
      error: semanticMiss?.error || `${settingType} control not found`,
      candidates,
      debug: semanticMiss?.debug || composerDebug(root),
      viLogs: [...(semanticMiss?.viLogs || []), ...viLogs],
    };
  }
  const clickEl = target.clickEl || target.el;
  const method = target.fromExactText ? 'exact-text-control-clicked' : 'composer-control-clicked';
  console.log(`[SF settings guard] ${settingType} clicking exact target=${canonicalValue}`, { targetText: target.displayText, rect: rectSummary(clickEl), method });
  clickEl.click();
  return { ok: true, method, settingType, expectedValue: canonicalValue, targetText: target.displayText, candidates };
}

async function verifyComposerSetting(tabId, settingType, expectedValue, options = {}) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: composerSettingPageAction,
    args: ['verify', settingType, expectedValue, { scope: 'bottomComposer', ...options }],
  });
  return results?.[0]?.result || {
    ok: false,
    settingType,
    expectedValue,
    detectedValue: null,
    error: 'Composer setting verification script failed',
    candidates: [],
  };
}

async function applyComposerSetting(tabId, settingType, expectedValue, options = {}) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: composerSettingPageAction,
    args: ['apply', settingType, expectedValue, { scope: 'bottomComposer', ...options }],
  });
  return results?.[0]?.result || {
    ok: false,
    settingType,
    expectedValue,
    error: 'Composer setting apply script failed',
  };
}

async function ensureComposerSetting(tabId, settingType, expectedValue, options = {}) {
  const mergedOptions = { scope: 'bottomComposer', ...options };
  const before = await verifyComposerSetting(tabId, settingType, expectedValue, mergedOptions);
  const detectedValue = before.detectedValue || before.detectedRatio || null;
  if (before.ok || detectedValue === expectedValue) {
    return {
      ok: true,
      alreadyCorrect: true,
      settingType,
      expectedValue,
      detectedValue: detectedValue || expectedValue,
      method: before.method || 'already-displayed',
      before,
      after: before,
      applyRes: { ok: true, skipped: true, reason: 'already correct' },
    };
  }
  const applyRes = await applyComposerSetting(tabId, settingType, expectedValue, mergedOptions);
  if (!applyRes.ok) return { ok: false, error: `Failed to apply ${settingType}`, before, applyRes };
  await sleep(Number(options?.applyWaitMs || 600));
  let after = await verifyComposerSetting(tabId, settingType, expectedValue, mergedOptions);
  for (let retry = 0; retry < 2 && !after.ok && !after.detectedValue && !after.detectedRatio; retry++) {
    await sleep(250);
    after = await verifyComposerSetting(tabId, settingType, expectedValue, mergedOptions);
  }
  const afterDetected = after.detectedValue || after.detectedRatio || null;
  const targetWasVisible = [after, before, applyRes].some(res => Array.isArray(res?.candidates)
    && res.candidates.some(candidate => String(candidate.text || '').trim() === String(expectedValue).trim()));
  if (!after.ok && !afterDetected && applyRes.ok && targetWasVisible) {
    console.warn(`[SF settings guard] ${settingType} selected state not detectable; assuming clicked target`, { expectedValue, applyRes, after });
    return {
      ok: true,
      alreadyCorrect: false,
      warning: 'selected state not detectable; assuming clicked target',
      method: 'clicked-target-assumed',
      before,
      applyRes,
      after,
    };
  }
  if (!after.ok) return { ok: false, error: `${settingType} verification failed after apply`, before, applyRes, after };
  return { ok: true, alreadyCorrect: false, before, applyRes, after };
}

function logComposerSettingViLogs(res, logEl = sfLogEl) {
  const seen = new Set();
  for (const source of [res?.before, res?.applyRes, res?.after, res]) {
    for (const entry of source?.viLogs || []) {
      const msg = typeof entry === 'string' ? entry : entry.msg;
      if (!msg || seen.has(msg)) continue;
      seen.add(msg);
      addLog(logEl, msg, typeof entry === 'string' ? 'info' : (entry.type || 'info'));
    }
  }
}

async function ensureComposerMatchesGlobalSettings(tabId, expectedSettings, options = {}) {
  const settings = { ...(expectedSettings || {}) };
  if (!settings.type && (settings.resolution || settings.duration)) settings.type = 'video';
  const logPrefix = options.logPrefix || '[settings guard]';
  const targetLogEl = options.logEl || sfLogEl;
  const expectedMode = options.expectedMode || settings.mode || (settings.type === 'image' ? 'Image' : 'Video');
  const includeMode = options.includeMode === true;
  const includeRatio = options.includeRatio !== false && Boolean(settings.ratio);
  const includeResolution = options.includeResolution !== false && settings.type !== 'image' && Boolean(settings.resolution);
  const includeDuration = options.includeDuration !== false && settings.type !== 'image' && Boolean(settings.duration);
  const order = [
    ...(includeMode ? [['mode', expectedMode]] : []),
    ...(includeRatio ? [['ratio', settings.ratio]] : []),
    ...(includeResolution ? [['resolution', settings.resolution]] : []),
    ...(includeDuration ? [['duration', settings.duration]] : []),
  ];
  const results = {};
  if (settings.ratio && !includeRatio) {
    results.ratio = {
      ok: true,
      skipped: true,
      expectedValue: settings.ratio,
      reason: 'ratio_guard_skipped_after_first_scene',
      detail: 'Bỏ qua aspect ratio từ scene/prompt 2+',
    };
    addLog(targetLogEl, `${logPrefix} ratio skipped: Bỏ qua aspect ratio từ scene/prompt 2+`, 'info');
  }
  if (!includeMode && options.skipModeReason) {
    results.mode = {
      ok: true,
      skipped: true,
      settingType: 'mode',
      expectedValue: expectedMode,
      detectedValue: 'skipped-after-first-prompt',
      reason: options.skipModeReason,
    };
    addLog(targetLogEl, `${logPrefix} mode skipped: ${options.skipModeReason}`, 'info');
  }
  for (const [settingType, expectedValue] of order) {
    const res = await ensureComposerSetting(tabId, settingType, expectedValue, {
      scope: 'bottomComposer',
      applyWaitMs: 700,
      ...options,
    });
    results[settingType] = res;
    if (typeof logComposerSettingViLogs === 'function') logComposerSettingViLogs(res, targetLogEl);
    const detected = res.detectedValue || res.after?.detectedValue || res.before?.detectedValue || res.after?.detectedRatio || res.before?.detectedRatio || 'unknown';
    addLog(targetLogEl, `${logPrefix} ${settingType} expected=${expectedValue} detected=${detected}`, res.ok ? 'info' : 'err');
    const candidateSource = res.after?.candidates || res.before?.candidates || res.applyRes?.candidates || res.candidates || [];
    if (candidateSource.length > 0) addLog(targetLogEl, `${logPrefix} ${settingType} candidates=${JSON.stringify(candidateSource).slice(0, 1200)}`, 'info');
    if (res.alreadyCorrect) {
      addLog(targetLogEl, `${logPrefix} ${settingType} already correct via ${res.method || res.before?.method || 'already-displayed'}: ${detected}`, 'info');
    } else {
      if (res.applyRes?.targetText || res.applyRes?.clickedText) addLog(targetLogEl, `${logPrefix} ${settingType} clicking target=${expectedValue}`, 'info');
      addLog(targetLogEl, `${logPrefix} ${settingType} apply result=${JSON.stringify(res.applyRes || null)}`, res.applyRes?.ok ? 'info' : 'warn');
      const afterDetected = res.after?.detectedValue || res.after?.detectedRatio || null;
      if (res.applyRes?.ok) {
        const label = settingType === 'resolution' ? 'Resolution' : settingType === 'duration' ? 'Duration' : settingType === 'mode' ? 'Mode' : 'Aspect Ratio';
        addLog(targetLogEl, `[SF cài đặt] Kiểm tra lại ${label} sau khi bấm: ${afterDetected || 'unknown'}`, afterDetected === expectedValue ? 'ok' : 'warn');
      }
      if (afterDetected === expectedValue) addLog(targetLogEl, `${logPrefix} ${settingType} after=${afterDetected} PASS`, 'ok');
    }
    if (!res.ok) {
      addLog(targetLogEl, `${logPrefix} FAIL setting=${settingType} expected=${expectedValue} detected=${detected}`, 'err');
      return {
        ok: false,
        code: settingType === 'ratio' ? 'ratio_apply_failed' : 'settings_guard_failed',
        failedSetting: settingType,
        step: 'Global Settings Guard',
        detail: res.error || `${settingType} guard failed`,
        settings,
        results,
        error: res.error || `${settingType} guard failed`,
        fatal: settingType === 'ratio',
      };
    }
  }
  return { ok: true, settings, results };
}

async function ensureFilmGlobalSettings(tabId, options = {}) {
  const settings = options.settings || await getVideoGlobalSettings();
  const logPrefix = options.logPrefix || '[SF settings guard]';
  return ensureComposerMatchesGlobalSettings(tabId, settings, {
    logPrefix,
    logEl: options.logEl || sfLogEl,
    scope: 'bottomComposer',
    applyWaitMs: 700,
    expectedMode: 'Video',
    includeMode: options.includeMode ?? true,
    includeRatio: options.includeRatio !== false,
    includeResolution: options.includeResolution !== false,
    includeDuration: options.includeDuration !== false,
    ...options,
  });
}

async function ensureImg2VidGlobalSettings(tabId, options = {}) {
  const settings = options.settings || await getVideoGlobalSettings();
  return ensureComposerMatchesGlobalSettings(tabId, settings, {
    logPrefix: '[I2V settings guard]',
    logEl: i2vLogEl,
    scope: 'bottomComposer',
    applyWaitMs: 700,
    expectedMode: 'Video',
    includeMode: options.includeMode ?? true,
    includeRatio: true,
    includeResolution: true,
    includeDuration: true,
    ...options,
  });
}

async function verifyFilmGlobalSettings(tabId, expectedSettings = null, options = {}) {
  const settings = expectedSettings || await getCurrentFilmGlobalSettings();
  const includeRatio = options.includeRatio !== false;
  const includeResolution = options.includeResolution !== false;
  const includeDuration = options.includeDuration !== false;
  const order = [
    ...(includeRatio ? [['ratio', settings.ratio]] : []),
    ...(includeResolution ? [['resolution', settings.resolution]] : []),
    ...(includeDuration ? [['duration', settings.duration]] : []),
  ];
  const results = {};
  for (const [settingType, expectedValue] of order) {
    const res = await verifyComposerSetting(tabId, settingType, expectedValue, {
      scope: 'bottomComposer',
      ...options,
    });
    results[settingType] = res;
    if (!res.ok && res.detectedValue !== expectedValue && res.detectedRatio !== expectedValue) {
      return { ok: false, failedSetting: settingType, settings, results, error: res.error || `${settingType} verification failed` };
    }
  }
  return { ok: true, settings, results };
}

async function ensureFilmPreAttachSettings(tabId, options = {}) {
  return ensureFilmGlobalSettings(tabId, {
    ...options,
    logPrefix: '[SF settings pre-attach]',
    includeRatio: true,
    includeResolution: true,
    includeDuration: true,
  });
}

async function ensureFilmPostAttachSettings(tabId, options = {}) {
  const res = await ensureFilmGlobalSettings(tabId, {
    ...options,
    logPrefix: '[SF settings post-attach]',
    includeMode: false,
    includeRatio: false,
    includeResolution: true,
    includeDuration: true,
  });
  return { ...res, ratioSkipped: true };
}

async function verifyFilmPostAttachSettings(tabId, expectedSettings = null, options = {}) {
  const res = await verifyFilmGlobalSettings(tabId, expectedSettings, {
    ...options,
    includeMode: false,
    includeRatio: false,
    includeResolution: true,
    includeDuration: true,
  });
  return { ...res, ratioSkipped: true };
}

function inspectComposerRatioInPage(expectedRatio, options = {}) {
  return new Promise(resolve => {
    const startedAt = Date.now();
    const timeoutMs = Math.max(250, Number(options?.timeoutMs || 5000));
    const stableMs = Math.max(0, Number(options?.stableMs || 300));
    const pollMs = Math.min(250, Math.max(100, Math.floor(stableMs / 3) || 150));
    const scopeName = options?.scope || 'bottomComposer';
    let stableStart = null;
    let lastSample = null;

    const ratioMap = {
      '9:16': ['9:16', '9/16', 'portrait', 'vertical', 'shorts'],
      '16:9': ['16:9', '16/9', 'landscape', 'widescreen'],
      '1:1': ['1:1', 'square', '1/1'],
      '2:3': ['2:3', '2/3'],
      '3:2': ['3:2', '3/2'],
    };
    const canonicalExpected = ratioMap[expectedRatio] ? expectedRatio : String(expectedRatio || '').trim();
    const expectedAliases = (ratioMap[canonicalExpected] || [canonicalExpected]).map(v => v.toLowerCase());

    const isVisible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };
    const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
    const normalizeHaystack = (text) => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const containsExpected = (text) => {
      const hay = normalizeHaystack(text);
      return expectedAliases.some(alias => alias && hay.includes(alias));
    };
    const detectRatio = (text) => {
      const hay = normalizeHaystack(text);
      for (const [ratio, aliases] of Object.entries(ratioMap)) {
        if (aliases.some(alias => hay.includes(alias))) return ratio;
      }
      return null;
    };
    const readControlText = (el) => [
      el.textContent,
      el.getAttribute?.('aria-label'),
      el.getAttribute?.('aria-description'),
      el.getAttribute?.('data-value'),
      el.getAttribute?.('data-testid'),
      el.getAttribute?.('title'),
      el.getAttribute?.('value'),
    ].filter(Boolean).join(' ');
    const getControlSelectionMethod = (el) => {
      if (['aria-pressed', 'aria-checked', 'data-active', 'data-checked'].some(attr => String(el.getAttribute?.(attr) || '').toLowerCase() === 'true')) {
        return 'active-control';
      }
      if (['aria-selected', 'data-selected'].some(attr => String(el.getAttribute?.(attr) || '').toLowerCase() === 'true')) {
        return 'selected-control';
      }
      const state = String(el.getAttribute?.('data-state') || '').toLowerCase();
      if (state === 'checked' || state === 'active') return 'active-control';
      if (state === 'selected') return 'selected-control';
      const cls = String(el.getAttribute?.('class') || el.className || '').toLowerCase();
      if (/\b(active|checked)\b/.test(cls)) return 'active-control';
      if (/\bselected\b/.test(cls)) return 'selected-control';
      return null;
    };
    const isExplicitlyInactive = (el) => {
      const falseAttrs = ['aria-pressed', 'aria-checked', 'aria-selected', 'data-selected', 'data-active', 'data-checked'];
      return falseAttrs.some(attr => String(el.getAttribute?.(attr) || '').toLowerCase() === 'false');
    };
    const isDropdownTrigger = (el) => {
      if (!el) return false;
      const role = String(el.getAttribute?.('role') || '').toLowerCase();
      const expanded = el.getAttribute?.('aria-expanded');
      const hasPopup = el.getAttribute?.('aria-haspopup');
      if (el.tagName === 'BUTTON' || role === 'button') {
        if (expanded !== null || hasPopup !== null) return true;
        const hay = normalizeHaystack([
          el.textContent,
          el.getAttribute?.('aria-label'),
          el.getAttribute?.('title'),
          el.getAttribute?.('data-value'),
        ].filter(Boolean).join(' '));
        const compactRatioOnly = /^(?:\d+[:/]\d+|portrait|vertical|shorts|landscape|widescreen|square|tall|wide)(?:\s+[a-z]+)?$/i.test(hay);
        const nearControls = /\b(480p|720p|1080p|6s|10s|5s|video|image)\b/i.test(el.parentElement?.textContent || '');
        return compactRatioOnly || nearControls;
      }
      return false;
    };

    const findBottomComposerScope = () => {
      const inputSelectors = [
        'textarea[placeholder*="Type to imagine" i]',
        'textarea[placeholder*="Imagine" i]',
        'textarea[placeholder*="Describe" i]',
        'textarea[placeholder*="Enter" i]',
        'input[placeholder*="Imagine" i]',
        'input[placeholder*="Describe" i]',
        'input[placeholder*="Enter" i]',
        'div[contenteditable="true"][data-lexical-editor]',
        'div[contenteditable="true"]',
        'textarea',
        'input',
      ].join(',');
      return Array.from(document.querySelectorAll(inputSelectors))
        .filter(input => isVisible(input) && !isBlocked(input))
        .map(input => {
          let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
          if (!root) {
            let node = input.parentElement;
            for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
              if (node.querySelector('button,[role="button"],[role="radio"],label,input[type="file"]')) { root = node; break; }
            }
          }
          if (!root || root === document.body || isBlocked(root)) return null;
          const inputRect = input.getBoundingClientRect();
          const rootRect = root.getBoundingClientRect();
          const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
          return isBottom ? { input, root, inputRect, rootRect } : null;
        })
        .filter(Boolean)
        .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
    };

    const sample = () => {
      if (scopeName !== 'bottomComposer') {
        return { ready: false, expectedRatio: canonicalExpected, detectedRatio: null, error: `Unsupported composer scope: ${scopeName}` };
      }
      const scope = findBottomComposerScope();
      if (!scope) {
        return { ready: false, expectedRatio: canonicalExpected, detectedRatio: null, error: 'Bottom composer not found' };
      }

      const controls = Array.from(scope.root.querySelectorAll(
        'button,[role="button"],[role="radio"],[role="option"],[role="menuitemradio"],[aria-pressed],[aria-checked],label,[data-value],[title]'
      ))
        .filter(el => scope.root.contains(el) && isVisible(el) && !isBlocked(el))
        .map(el => {
          const text = readControlText(el);
          return {
            el,
            text,
            ratio: detectRatio(text),
            selectionMethod: getControlSelectionMethod(el),
            inactive: isExplicitlyInactive(el),
          };
        })
        .filter(item => item.ratio || containsExpected(item.text));

      const activeRatioControl = controls.find(item => item.selectionMethod && item.ratio);
      if (activeRatioControl) {
        if (activeRatioControl.ratio === canonicalExpected) {
          return {
            ready: true,
            expectedRatio: canonicalExpected,
            detectedRatio: activeRatioControl.ratio,
            method: activeRatioControl.selectionMethod,
          };
        }
        return {
          ready: false,
          expectedRatio: canonicalExpected,
          detectedRatio: activeRatioControl.ratio,
          method: activeRatioControl.selectionMethod,
          error: `Active ratio is ${activeRatioControl.ratio}, expected ${canonicalExpected}`,
        };
      }

      const detectedRatios = Array.from(new Set(controls.map(item => item.ratio).filter(Boolean)));
      const expectedDisplay = controls.find(item => containsExpected(item.text) && !item.inactive);
      const selectedDisplay = controls.find(item => containsExpected(item.text) && !item.inactive && isDropdownTrigger(item.el));
      if (selectedDisplay) {
        return {
          ready: true,
          expectedRatio: canonicalExpected,
          detectedRatio: canonicalExpected,
          method: 'selected-display',
        };
      }
      if (expectedDisplay && detectedRatios.length <= 1) {
        return {
          ready: false,
          code: 'weak_ratio_signal',
          expectedRatio: canonicalExpected,
          detectedRatio: canonicalExpected,
          method: 'weak-toolbar-display',
          error: `Only weak toolbar-display signal found for ${canonicalExpected}`,
        };
      }

      const rootRatio = detectRatio(scope.root.textContent || '');
      const detectedRatio = detectedRatios[0] || rootRatio || null;
      return {
        ready: false,
        expectedRatio: canonicalExpected,
        detectedRatio,
        method: detectedRatio ? 'visible-control' : 'not-detected',
        error: detectedRatio
          ? `Composer ratio is ${detectedRatio}, expected ${canonicalExpected}`
          : `Could not detect active composer ratio for ${canonicalExpected}`,
      };
    };

    const tick = () => {
      lastSample = sample();
      if (lastSample.ready) {
        if (!stableStart) stableStart = Date.now();
        if (Date.now() - stableStart >= stableMs) {
          return resolve({
            ok: true,
          expectedRatio: lastSample.expectedRatio,
          detectedRatio: lastSample.detectedRatio,
          method: lastSample.method,
        });
        }
      } else {
        stableStart = null;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        return resolve({
          ok: false,
          expectedRatio: canonicalExpected,
          detectedRatio: lastSample?.detectedRatio || null,
          error: lastSample?.error || `Ratio verification timed out for ${canonicalExpected}`,
          method: lastSample?.method,
          code: lastSample?.code,
          timeoutMs,
        });
      }
      setTimeout(tick, pollMs);
    };
    tick();
  });
}

async function verifyComposerRatio(tabId, expectedRatio, options = {}) {
  const mergedOptions = {
    scope: 'bottomComposer',
    timeoutMs: 5000,
    stableMs: 300,
    ...options,
  };
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: inspectComposerRatioInPage,
    args: [expectedRatio, mergedOptions],
  });
  return results?.[0]?.result || {
    ok: false,
    expectedRatio,
    detectedRatio: null,
    error: 'Composer ratio verification script failed',
  };
}

async function ensureComposerRatio(tabId, expectedRatio, options = {}) {
  const mergedOptions = { scope: 'bottomComposer', ...options };
  const isStrongRatioMethod = (res) => res?.ok && (res.method === 'active-control' || res.method === 'selected-control' || res.method === 'selected-display');
  const before = await verifyComposerRatio(tabId, expectedRatio, mergedOptions);
  const forceApply = options?.forceApply === true || before?.method === 'toolbar-display' || before?.method === 'weak-toolbar-display' || before?.code === 'weak_ratio_signal';
  if (isStrongRatioMethod(before) && !forceApply) {
    return { ok: true, alreadyCorrect: true, before, after: before, applyRes: { ok: true, skipped: true, reason: 'already active-control' } };
  }

  const applyRes = await injectAspectRatio(tabId, expectedRatio, { scope: 'bottomComposer', forceApply });
  if (!applyRes.ok) return { ok: false, error: 'Failed to apply ratio', before, applyRes };

  await sleep(Number(options?.applyWaitMs || 700));

  const after = await verifyComposerRatio(tabId, expectedRatio, mergedOptions);
  if (!isStrongRatioMethod(after)) {
    return { ok: false, error: 'Ratio verification failed after apply', before, applyRes, after };
  }

  return { ok: true, alreadyCorrect: false, before, applyRes, after };
}

async function ensureShortFilmComposerForScene(tabId, scene, sceneIndex) {
  const settings = await getCurrentFilmGlobalSettings();
  addLog(sfLogEl, `[SF settings] loaded ratio=${settings.ratio} resolution=${settings.resolution} duration=${settings.duration} source=${JSON.stringify(settings.source || {})}`);
  const readyRes = await ensureGrokComposerReady(tabId, { noNavigate: true });
  if (!readyRes.ok) {
    addLog(sfLogEl, `[SF settings] composer not ready in current page: ${readyRes.error}`, 'err');
    return {
      ok: false,
      settings,
      settingsGuard: { ok: false, error: readyRes.error },
      ratioGuard: { ok: false, error: readyRes.error },
      skippedSettingsGuard: sceneIndex > 0,
      skippedRatioGuard: sceneIndex > 0,
    };
  }
  addLog(sfLogEl, `[SF settings] no navigation during scene loop; sceneId=${scene.id} index=${sceneIndex + 1}`, 'info');

  if (sceneIndex === 0) {
    addLog(sfLogEl, '[SF settings guard] deferred to scene 1 pre-attach/post-attach phases', 'info');
    return {
      ok: true,
      settings,
      ratio: settings.ratio,
      settingsGuard: { ok: true, deferred: true, reason: 'scene 1 pre-attach/post-attach phases' },
      ratioGuard: { ok: true, deferred: true, reason: 'scene 1 pre-attach phase' },
      skippedSettingsGuard: false,
      skippedRatioGuard: false,
    };
  }

  addLog(sfLogEl, `[SF settings guard] skipped sceneId=${scene.id} because settings were calibrated on scene 1`, 'info');
  addLog(sfLogEl, `[SF settings guard] scene 2+ skipped sceneId=${scene.id} because settings were calibrated on scene 1`, 'info');
  return {
    ok: true,
    settings,
    ratio: settings.ratio,
    settingsGuard: { ok: true, skipped: true, reason: 'scene 1 already calibrated' },
    ratioGuard: { ok: true, skipped: true, reason: 'ratio already validated on first scene' },
    skippedSettingsGuard: true,
    skippedRatioGuard: true,
  };
}

async function applyShortFilmSceneSettings(tabId, scene, sceneIndex) {
  return ensureShortFilmComposerForScene(tabId, scene, sceneIndex);
}

function isImagineRootUrl(url) {
  return /^(?:https?:\/\/grok\.com)?\/imagine\/?(?:[?#].*)?$/i.test(url || '');
}

function isImaginePostUrl(url) {
  return /^(?:https?:\/\/grok\.com)?\/imagine\/post\/[^/?#]+\/?(?:[?#].*)?$/i.test(url || '');
}

function isImagineComposerCapableUrl(url) {
  return isImagineRootUrl(url) || isImaginePostUrl(url);
}

async function waitForImagineRootUrl(tabId, timeoutMs = 10000) {
  const start = Date.now();
  let currentUrl = '';
  while (Date.now() - start < timeoutMs) {
    const tabInfo = await chrome.tabs.get(tabId);
    currentUrl = tabInfo.url || '';
    if (isImagineRootUrl(currentUrl)) {
      console.log('[GPI] waitForImagineRootUrl success:', currentUrl);
      return { ok: true, url: currentUrl };
    }
    await sleep(250);
  }
  const error = `URL did not become Imagine root after ${timeoutMs}ms; current URL: ${currentUrl}`;
  console.warn('[GPI] waitForImagineRootUrl fail:', error);
  return { ok: false, error, url: currentUrl };
}

async function prepareShortFilmComposer(tabId) {
  const tabInfo = await chrome.tabs.get(tabId);
  const url = tabInfo.url || '';
  addLog(sfLogEl, `[SF prepare] prepareShortFilmComposer called once`, 'info');
  addLog(sfLogEl, `[SF prepare] current URL before Short Film: ${url}`, 'info');

  const navRes = await navigateToImagineVideo(tabId);
  if (!navRes.ok) {
    addLog(sfLogEl, `[SF prepare] composer prepare failed: ${navRes.error}`, 'err');
    return navRes;
  }

  const finalTab = await chrome.tabs.get(tabId);
  const finalUrl = finalTab.url || '';
  addLog(sfLogEl, `[SF prepare] final URL before scene loop: ${finalUrl}`, 'info');
  if (!isImagineComposerCapableUrl(finalUrl)) {
    const error = `Final URL is not an Imagine composer-capable page before scene loop: ${finalUrl}`;
    addLog(sfLogEl, `[SF prepare] ${error}`, 'err');
    return { ok: false, error, url: finalUrl };
  }

  addLog(sfLogEl, '[SF prepare] ratio guard deferred to scene 1', 'info');
  return { ok: true, videoModeClicked: navRes.videoModeClicked };
}

async function normalizeFilmStartTab(tab) {
  const state = getGrokPageState(tab);
  const url = tab?.url || '';
  if (state === 'not-grok') return { ok: false, error: 'Active tab is not Grok', state, url };
  if (state === 'imagine-template') {
    console.warn('[GPI-SF] Film active tab is template; forcing one-time navigation before run:', url);
    const updated = await chrome.tabs.update(tab.id, { url: 'https://grok.com/imagine' });
    console.log('[GPI-SF] Film URL after forced chrome.tabs.update:', updated?.url || '');
    const urlReady = await waitForImagineRootUrl(tab.id, 10000);
    if (!urlReady.ok) return { ...urlReady, state, error: `Cannot leave Grok template before Film run: ${urlReady.error}` };
    const freshTab = await chrome.tabs.get(tab.id);
    return { ok: true, tab: { ...freshTab, grokPageState: getGrokPageState(freshTab) }, state: 'imagine-composer', url: freshTab.url || urlReady.url };
  }
  return { ok: true, tab: { ...tab, grokPageState: state }, state, url };
}

async function waitForSubmitButtonEnabled(tabId, timeoutMs = 60000, stableMs = 800, options = {}) {
  const pollMs = 300;           // poll nhanh hơn (500→300ms) để detect flicker chính xác
  const start   = Date.now();
  let stableStart = null;       // thời điểm button bắt đầu enabled liên tục

  while (Date.now() - start < timeoutMs) {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (options) => {
        const isVisible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
        };
        const isEnabled = (btn) => {
          return !btn.disabled && btn.getAttribute('aria-disabled') !== 'true'
            && !btn.closest('[aria-disabled="true"]');
        };
        const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="overlay" i]');
        const findBottomComposerScope = () => {
          const inputSelectors = [
            'textarea[placeholder*="Type to imagine" i]',
            'textarea[placeholder*="Imagine" i]',
            'textarea[placeholder*="Describe" i]',
            'textarea[placeholder*="Enter" i]',
            'div[contenteditable="true"][data-lexical-editor]',
            'div[contenteditable="true"]',
            'textarea',
          ].join(',');
          return Array.from(document.querySelectorAll(inputSelectors))
            .filter(input => isVisible(input) && !isBlocked(input))
            .map(input => {
              let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
              if (!root) {
                let node = input.parentElement;
                for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                  if (node.querySelector('button,[role="button"],label')) { root = node; break; }
                }
              }
              if (!root || isBlocked(root)) return null;
              const inputRect = input.getBoundingClientRect();
              const rootRect = root.getBoundingClientRect();
              const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
              return isBottom ? { input, root, inputRect, rootRect } : null;
            })
            .filter(Boolean)
            .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
        };
        if (options?.scope === 'bottomComposer') {
          const scope = findBottomComposerScope();
          if (!scope) return { ready: false, reason: 'Bottom composer not found' };
          const rootRect = scope.root.getBoundingClientRect();
          const buttons = Array.from(scope.root.querySelectorAll('button,[role="button"]'))
            .filter(b => isVisible(b) && isEnabled(b) && !isBlocked(b))
            .filter(b => {
              const r = b.getBoundingClientRect();
              const hay = [b.textContent, b.getAttribute('aria-label'), b.getAttribute('title'), b.getAttribute('data-testid')]
                .filter(Boolean).join(' ');
              const explicit = /\b(send|submit|generate|grok)\b/i.test(hay);
              const nearRightEdge = r.right > rootRect.right - 140 && r.left >= rootRect.left;
              return explicit || (nearRightEdge && !!b.querySelector('svg'));
            });
          return { ready: buttons.length > 0 };
        }

        // Check form-based bottom-right buttons (Grok 2025 layout)
        for (const form of document.querySelectorAll('form')) {
          const absDivs = Array.from(form.querySelectorAll('div.absolute')).filter(d => {
            const cls = d.className || '';
            return (cls.includes('right-') || cls.includes('end-')) && cls.includes('bottom-');
          });
          for (const div of absDivs) {
            const btns = Array.from(div.querySelectorAll('button'))
              .filter(b => isVisible(b) && isEnabled(b) && b.querySelector('svg'));
            if (btns.length > 0) return { ready: true };
          }
          // Fallback: any enabled SVG button in absolute div
          const svgBtns = Array.from(form.querySelectorAll('div.absolute button'))
            .filter(b => isVisible(b) && isEnabled(b) && b.querySelector('svg'));
          if (svgBtns.length > 0) return { ready: true };
        }

        // Legacy selectors
        const legacyBtns = Array.from(document.querySelectorAll(
          'button[type="submit"],button[aria-label*="Generate" i],button[aria-label*="Grok" i],button[aria-label*="Send" i]'
        )).filter(b => isVisible(b) && isEnabled(b));
        if (legacyBtns.length > 0) return { ready: true };

        // Grok /saved & /imagine: nút ↑ nhỏ nằm gần textarea (< 60px, vùng dưới màn hình)
        {
          const inputSels = [
            'textarea[placeholder*="Imagine" i]', 'textarea[placeholder*="Describe" i]',
            'textarea[placeholder*="Enter" i]', 'textarea[placeholder*="video" i]',
            'div[contenteditable="true"][data-lexical-editor]',
            'div[contenteditable="true"]', 'textarea',
          ];
          let inputEl = null;
          for (const sel of inputSels) {
            for (const c of document.querySelectorAll(sel)) {
              const r = c.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) { inputEl = c; break; }
            }
            if (inputEl) break;
          }
          if (inputEl) {
            const inputRect = inputEl.getBoundingClientRect();
            let node = inputEl.parentElement;
            for (let d = 0; d < 8 && node; d++, node = node.parentElement) {
              const btns = Array.from(node.querySelectorAll('button'))
                .filter(b => isVisible(b) && isEnabled(b) && b.querySelector('svg'))
                .filter(b => {
                  const r = b.getBoundingClientRect();
                  return r.right >= inputRect.left && r.bottom >= inputRect.top - 20;
                });
              if (btns.length > 0) return { ready: true };
            }
          }
          // Fallback: nút SVG nhỏ ở vùng dưới màn hình
          const vh = window.innerHeight;
          const smallBottom = Array.from(document.querySelectorAll('button'))
            .filter(b => isVisible(b) && isEnabled(b) && b.querySelector('svg'))
            .filter(b => { const r = b.getBoundingClientRect(); return r.bottom > vh * 0.6 && r.width < 60; });
          if (smallBottom.length > 0) return { ready: true };
        }

        return { ready: false };
      },
      args: [options],
    });

    const isReady = result?.[0]?.result?.ready === true;
    if (isReady) {
      if (!stableStart) stableStart = Date.now();
      if (Date.now() - stableStart >= stableMs) {
        return { ok: true };
      }
    } else {
      stableStart = null;
    }

    await sleep(pollMs);
  }
  return { ok: false, reason: 'timeout waiting for stable button' };
}

// ── VERIFY COMPOSER PAYLOAD BEFORE SUBMIT ─────────────────────────────
// Short Film must never submit an image-only composer. This guard runs in the
// page, scopes itself to the bottom composer, and waits until text + attachments
// stay present for a short stable window after Grok finishes re-rendering.
function inspectComposerPayloadInPage(expectedText, options = {}) {
  return new Promise(resolve => {
    const startedAt = Date.now();
    const timeoutMs = Math.max(1000, Number(options?.timeoutMs || 15000));
    const stableMs = Math.max(0, Number(options?.stableMs || 800));
    const pollMs = Math.min(250, Math.max(100, Math.floor(stableMs / 4) || 150));
    const requireText = options?.requireText !== false;
    const requireImage = options?.requireImage === true;
    const minTextChars = Math.max(1, Number(options?.minTextChars || 20));
    const minImages = Math.max(1, Number(options?.minImages || 1));
    const exactImages = options?.exactImages != null ? Math.max(0, Number(options.exactImages)) : null;
    const maxImages = options?.maxImages != null ? Math.max(0, Number(options.maxImages)) : null;
    const expectedSceneId = options?.expectedSceneId;
    const scopeName = options?.scope || 'bottomComposer';
    let stableStart = null;
    let lastSample = null;

    const normalizeText = (text) => String(text || '').replace(/\s+/g, ' ').trim();
    const normalizedExpected = normalizeText(expectedText);
    const expectedPrefix = normalizeText(normalizedExpected.slice(0, 80)).toLowerCase();
    const expectedWords = Array.from(new Set(
      normalizedExpected
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 4)
    )).slice(0, 32);

    const isVisible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };
    const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');

    const findBottomComposerScope = () => {
      const inputSelectors = [
        'textarea[placeholder*="Type to imagine" i]',
        'textarea[placeholder*="Imagine" i]',
        'textarea[placeholder*="Describe" i]',
        'textarea[placeholder*="Enter" i]',
        'input[placeholder*="Imagine" i]',
        'input[placeholder*="Describe" i]',
        'input[placeholder*="Enter" i]',
        'div[contenteditable="true"][data-lexical-editor]',
        'div[contenteditable="true"]',
        'textarea',
        'input',
      ].join(',');
      return Array.from(document.querySelectorAll(inputSelectors))
        .filter(input => isVisible(input) && !isBlocked(input))
        .map(input => {
          let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
          if (!root) {
            let node = input.parentElement;
            for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
              if (node.querySelector('button,[role="button"],label,input[type="file"]')) { root = node; break; }
            }
          }
          if (!root || root === document.body || isBlocked(root)) return null;
          const inputRect = input.getBoundingClientRect();
          const rootRect = root.getBoundingClientRect();
          const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
          return isBottom ? { input, root, inputRect, rootRect } : null;
        })
        .filter(Boolean)
        .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
    };

    const findActualComposerEditor = (scope) => {
      const root = scope?.root;
      if (!root) return null;
      const selectors = [
        '[data-testid="chat-input"] div[contenteditable="true"]',
        '[data-testid="chat-input"] [contenteditable="true"]',
        'div[contenteditable="true"].ProseMirror',
        'div[contenteditable="true"][translate="no"]',
        'div[contenteditable="true"]',
        'textarea',
        'input',
      ];
      const candidates = Array.from(root.querySelectorAll(selectors.join(',')))
        .filter(el => root.contains(el))
        .filter(isVisible)
        .filter(el => !isBlocked(el))
        .map(el => {
          const r = el.getBoundingClientRect();
          const inChatInput = !!el.closest('[data-testid="chat-input"]');
          const isProseMirror = String(el.className || '').includes('ProseMirror');
          return {
            el,
            score:
              (inChatInput ? 100 : 0) +
              (isProseMirror ? 80 : 0) +
              (el.isContentEditable ? 40 : 0) +
              Math.round(r.bottom / 100),
          };
        })
        .sort((a, b) => b.score - a.score);
      return candidates[0]?.el || scope.input || null;
    };

    const getActualEditorText = (editor) => {
      if (!editor) return '';
      if ('value' in editor) return normalizeText(editor.value || '');
      return normalizeText(editor.innerText || editor.textContent || '');
    };

    const readComposerText = (scope) => {
      const editor = findActualComposerEditor(scope);
      return getActualEditorText(editor);
    };

    const getTextDebug = (scope, editor) => {
      const rootText = normalizeText(scope?.root?.textContent || '');
      const editorText = getActualEditorText(editor);
      return {
        editorFound: !!editor,
        editorTag: editor?.tagName || null,
        editorClass: String(editor?.className || '').slice(0, 120),
        editorTextLength: editorText.length,
        editorTextPreview: editorText.slice(0, 160),
        rootTextLength: rootText.length,
        rootTextPreview: rootText.slice(0, 160),
      };
    };

    const countComposerImages = (scope) => {
      const attachmentSelectors = [
        'img[src^="blob:"]',
        'img[src^="data:"]',
        '[class*="thumb" i]',
        '[class*="preview" i]',
        '[class*="attachment" i]',
        '[aria-label*="image" i]',
        '[aria-label*="file" i]',
      ].join(',');
      const seen = new Set();
      for (const el of Array.from(scope.root.querySelectorAll(attachmentSelectors))) {
        if (!scope.root.contains(el) || isBlocked(el) || !isVisible(el)) continue;
        seen.add(el);
      }
      return seen.size;
    };

    const hasReliableText = (composerText) => {
      const normalizedComposer = normalizeText(composerText);
      const lowerComposer = normalizedComposer.toLowerCase();
      if (!requireText) return { ok: true, reason: 'text-not-required', keywordMatches: 0 };
      if (normalizedComposer.length < minTextChars) {
        return { ok: false, reason: 'text missing or too short', keywordMatches: 0 };
      }
      if (expectedPrefix.length >= 30 && lowerComposer.includes(expectedPrefix)) {
        return { ok: true, reason: 'expected-prefix', keywordMatches: expectedWords.length };
      }
      if (!expectedWords.length) {
        return { ok: normalizedComposer.length >= minTextChars, reason: 'min-length', keywordMatches: 0 };
      }
      const matches = expectedWords.filter(w => lowerComposer.includes(w)).length;
      const needed = Math.max(3, Math.min(8, Math.ceil(expectedWords.length * 0.35)));
      return {
        ok: normalizedComposer.length >= minTextChars && matches >= needed,
        reason: `keyword-match ${matches}/${expectedWords.length}`,
        keywordMatches: matches,
      };
    };

    const sample = () => {
      if (scopeName !== 'bottomComposer') {
        return { ready: false, code: 'bad_scope', error: `Unsupported composer scope: ${scopeName}`, stableElapsedMs: 0 };
      }
      const scope = findBottomComposerScope();
      if (!scope) {
        return { ready: false, code: 'bottom_composer_missing', error: 'Bottom composer not found', stableElapsedMs: 0 };
      }
      const editor = findActualComposerEditor(scope);
      const textDebug = getTextDebug(scope, editor);
      const composerText = textDebug.editorTextPreview.length === textDebug.editorTextLength
        ? textDebug.editorTextPreview
        : getActualEditorText(editor);
      const textCheck = hasReliableText(composerText);
      const imageCount = countComposerImages(scope);
      const imageOk = !requireImage
        || (exactImages != null
          ? imageCount === exactImages
          : (imageCount >= minImages && (maxImages == null || imageCount <= maxImages)));
      let code = null;
      let error = '';
      if (!editor) {
        code = 'text_missing';
        error = 'Actual composer editor not found';
      } else if (!textCheck.ok) {
        code = 'text_missing';
        error = 'Prompt text missing from actual editor';
      } else if (!imageOk) {
        code = imageCount < minImages || (exactImages != null && imageCount < exactImages) ? 'image_missing' : 'image_too_many';
        error = code === 'image_too_many'
          ? `Too many reference images before submit: ${imageCount}/${exactImages ?? maxImages}`
          : 'Reference image/chaining frame missing before submit';
      }
      return {
        ready: !!editor && textCheck.ok && imageOk,
        code,
        error,
        expectedSceneId,
        expectedTextLength: normalizedExpected.length,
        composerTextLength: composerText.length,
        ...textDebug,
        imageCount,
        requireText,
        requireImage,
        minTextChars,
        minImages,
        maxImages,
        exactImages,
        stableMs,
        stableElapsedMs: stableStart ? Date.now() - stableStart : 0,
        textReason: textCheck.reason,
        keywordMatches: textCheck.keywordMatches,
      };
    };

    const tick = () => {
      lastSample = sample();
      if (lastSample.ready) {
        if (!stableStart) stableStart = Date.now();
        lastSample.stableElapsedMs = Date.now() - stableStart;
        if (Date.now() - stableStart >= stableMs) {
          return resolve({ ok: true, ...lastSample, error: null });
        }
      } else {
        stableStart = null;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        const error = lastSample?.error || 'Composer payload not ready before submit';
        return resolve({ ok: false, ...(lastSample || {}), error, timeoutMs });
      }
      setTimeout(tick, pollMs);
    };
    tick();
  });
}

async function verifyComposerPayload(tabId, expectedText, options = {}) {
  const mergedOptions = {
    scope: 'bottomComposer',
    requireText: true,
    requireImage: false,
    minTextChars: 20,
    timeoutMs: 15000,
    stableMs: 800,
    ...options,
  };
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: inspectComposerPayloadInPage,
    args: [expectedText || '', mergedOptions],
  });
  return results?.[0]?.result || { ok: false, error: 'Composer payload verification script failed' };
}

async function waitComposerAttachmentStable(tabId, timeoutMs = 8000, stableMs = 1000, options = {}) {
  const pollMs = 250;
  const startedAt = Date.now();
  let stableStart = null;
  let lastCount = null;
  let lastSample = null;
  while (Date.now() - startedAt < timeoutMs) {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (options) => {
        const isVisible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
        };
        const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
        const findBottomComposerScope = () => {
          const inputSelectors = [
            'textarea[placeholder*="Type to imagine" i]',
            'textarea[placeholder*="Imagine" i]',
            'textarea[placeholder*="Describe" i]',
            'textarea[placeholder*="Enter" i]',
            'div[contenteditable="true"][data-lexical-editor]',
            'div[contenteditable="true"]',
            'textarea',
          ].join(',');
          return Array.from(document.querySelectorAll(inputSelectors))
            .filter(input => isVisible(input) && !isBlocked(input))
            .map(input => {
              let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
              if (!root) {
                let node = input.parentElement;
                for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                  if (node.querySelector('button,[role="button"],label,input[type="file"]')) { root = node; break; }
                }
              }
              if (!root || root === document.body || isBlocked(root)) return null;
              const inputRect = input.getBoundingClientRect();
              const rootRect = root.getBoundingClientRect();
              const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
              return isBottom ? { input, root, inputRect, rootRect } : null;
            })
            .filter(Boolean)
            .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
        };
        if (options?.scope !== 'bottomComposer') return { ok: false, count: 0, error: 'Unsupported composer scope' };
        const scope = findBottomComposerScope();
        if (!scope) return { ok: false, count: 0, error: 'Bottom composer not found' };
        const selectors = [
          'img[src^="blob:"]',
          'img[src^="data:"]',
          '[class*="thumb" i]',
          '[class*="preview" i]',
          '[class*="attachment" i]',
          '[aria-label*="image" i]',
          '[aria-label*="file" i]',
        ].join(',');
        const seen = new Set();
        for (const el of Array.from(scope.root.querySelectorAll(selectors))) {
          if (!scope.root.contains(el) || isBlocked(el) || !isVisible(el)) continue;
          seen.add(el);
        }
        return { ok: true, count: seen.size };
      },
      args: [{ scope: options?.scope || 'bottomComposer' }],
    });
    lastSample = result?.[0]?.result || { ok: false, count: 0, error: 'Attachment stable script failed' };
    const count = Number(lastSample.count || 0);
    const minImages = Math.max(0, Number(options?.minImages || 0));
    const exactImages = options?.exactImages != null ? Math.max(0, Number(options.exactImages)) : null;
    const maxImages = options?.maxImages != null ? Math.max(0, Number(options.maxImages)) : null;
    const countOk = exactImages != null
      ? count === exactImages
      : (count >= minImages && (maxImages == null || count <= maxImages));
    if (lastSample.ok && countOk && count === lastCount) {
      if (!stableStart) stableStart = Date.now();
      if (Date.now() - stableStart >= stableMs) {
        return { ok: true, imageCount: count, stableElapsedMs: Date.now() - stableStart, timeoutMs };
      }
    } else {
      stableStart = null;
      lastCount = count;
      if (lastSample.ok && maxImages != null && count > maxImages) {
        return {
          ok: false,
          imageCount: count,
          stableElapsedMs: 0,
          timeoutMs,
          code: 'image_too_many',
          error: `Composer has too many images: ${count}/${maxImages}`,
        };
      }
    }
    await sleep(pollMs);
  }
  return {
    ok: false,
    imageCount: Number(lastSample?.count || 0),
    stableElapsedMs: stableStart ? Date.now() - stableStart : 0,
    timeoutMs,
    error: lastSample?.error || 'Attachment count did not stabilize',
  };
}

async function getI2VComposerAttachmentState(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
      };
      const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i],[class*="result" i],[class*="post" i]');
      const findBottomComposerScope = () => {
        const inputSelectors = [
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'input[placeholder*="Imagine" i]',
          'input[placeholder*="Describe" i]',
          'input[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
          'input',
        ].join(',');
        return Array.from(document.querySelectorAll(inputSelectors))
          .filter(input => isVisible(input) && !isBlocked(input))
          .map(input => {
            let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
            if (!root) {
              let node = input.parentElement;
              for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                if (node.querySelector('button,[role="button"],label,input[type="file"]')) { root = node; break; }
              }
            }
            if (!root || root === document.body || isBlocked(root)) return null;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
            return isBottom ? { input, root, inputRect, rootRect } : null;
          })
          .filter(Boolean)
          .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
      };
      const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
      const getEditorText = (input) => {
        if (!input) return '';
        if ('value' in input) return normalize(input.value || '');
        return normalize(input.innerText || input.textContent || '');
      };
      const countPendingCards = (root) => Array.from(document.querySelectorAll('[role="progressbar"],[aria-busy="true"],[class*="generating" i],[class*="pending" i],[class*="progress" i]'))
        .filter(el => isVisible(el) && !root?.contains(el)).length;
      const scope = findBottomComposerScope();
      if (!scope) return { ok: false, count: 0, rawImageNodes: 0, uniqueImageUrls: 0, visibleThumbnails: 0, likelyComposerAttachments: 0, attachmentItems: 0, pendingCards: 0, editorTextLen: 0, error: 'Bottom composer not found' };
      const selectors = [
        'img[src^="blob:"]',
        'img[src^="data:"]',
        '[class*="thumb" i]',
        '[class*="preview" i]',
        '[class*="attachment" i]',
        '[aria-label*="image" i]',
        '[aria-label*="file" i]',
      ].join(',');
      const rawNodes = Array.from(scope.root.querySelectorAll(selectors))
        .filter(el => scope.root.contains(el) && !isBlocked(el) && isVisible(el));
      const unique = new Set();
      const attachments = [];
      for (const el of rawNodes) {
        const rect = el.getBoundingClientRect();
        const src = el.currentSrc || el.src || el.getAttribute?.('src') || '';
        const label = normalize(el.textContent || el.getAttribute?.('aria-label') || el.getAttribute?.('title') || '');
        const cls = String(el.getAttribute?.('class') || el.className || '').toLowerCase();
        const looksAttachment = /thumb|preview|attachment|file|image/i.test(`${cls} ${label}`) || (src && rect.width >= 24 && rect.height >= 24);
        if (!looksAttachment) continue;
        const key = src || `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}:${label}`;
        if (!unique.has(key)) attachments.push({ key, src: src ? 'present' : '', rect: { w: Math.round(rect.width), h: Math.round(rect.height) } });
        unique.add(key);
      }
      const editorText = getEditorText(scope.input);
      return {
        ok: true,
        rawImageNodes: rawNodes.length,
        attachmentItems: attachments.length,
        uniqueImageUrls: unique.size,
        visibleThumbnails: rawNodes.length,
        likelyComposerAttachments: attachments.length,
        count: attachments.length,
        pendingCards: countPendingCards(scope.root),
        editorTextLen: editorText.length,
      };
    },
  });
  return result?.[0]?.result || { ok: false, count: 0, rawImageNodes: 0, uniqueImageUrls: 0, pendingCards: 0, editorTextLen: 0, error: 'Attachment state script failed' };
}

async function clearI2VComposerText(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
      const inputs = Array.from(document.querySelectorAll([
        'textarea[placeholder*="Type to imagine" i]',
        'textarea[placeholder*="Imagine" i]',
        'textarea[placeholder*="Describe" i]',
        'textarea[placeholder*="Enter" i]',
        'div[contenteditable="true"][data-lexical-editor]',
        'div[contenteditable="true"]',
        'textarea',
        'input',
      ].join(','))).filter(el => isVisible(el) && !isBlocked(el));
      const input = inputs.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
      if (!input) return { ok: false, error: 'Bottom composer editor not found' };
      input.focus();
      if ('value' in input) {
        const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(input, ''); else input.value = '';
      } else {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(input);
        selection.removeAllRanges();
        selection.addRange(range);
        range.deleteContents();
        input.textContent = '';
      }
      input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'deleteContentBackward', data: null }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    },
  });
  return result?.[0]?.result || { ok: false, error: 'Clear composer text script failed' };
}

async function installI2VSubmitMonitor(tabId, sceneId, displayName = 'Cảnh hiện tại') {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sceneId, displayName) => {
      const now = () => Date.now();
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
      const findBottomComposerScope = () => {
        const selectors = [
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
          'input',
        ].join(',');
        return Array.from(document.querySelectorAll(selectors))
          .filter(input => isVisible(input) && !isBlocked(input))
          .map(input => {
            let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
            if (!root) {
              let node = input.parentElement;
              for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                if (node.querySelector('button,[role="button"],label,input[type="file"]')) { root = node; break; }
              }
            }
            if (!root || root === document.body || isBlocked(root)) return null;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
            return isBottom ? { input, root } : null;
          })
          .filter(Boolean)[0] || null;
      };
      const textOf = (el) => [el?.textContent, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title'), el?.getAttribute?.('data-testid')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      const isSubmitButton = (target) => {
        const scope = findBottomComposerScope();
        if (!scope) return false;
        const button = target?.closest?.('button,[role="button"]');
        if (!button || !scope.root.contains(button)) return false;
        const hay = textOf(button).toLowerCase();
        if (/\b(attach|upload|image|photo|file|remove|delete|close|clear|cancel|mic|voice|menu|option|more|edit)\b/.test(hay)) return false;
        const r = button.getBoundingClientRect();
        const rr = scope.root.getBoundingClientRect();
        return /\b(send|submit|generate|grok)\b/.test(hay) || (r.right > rr.right - 160 && !!button.querySelector?.('svg'));
      };
      const isEnterInComposer = (target) => {
        const scope = findBottomComposerScope();
        return !!(scope && target && scope.root.contains(target));
      };
      const countGeneratingCards = () => {
        const nodes = Array.from(document.querySelectorAll('[role="progressbar"],[aria-busy="true"],[class*="generating" i],[class*="pending" i],[class*="progress" i],article,[class*="post" i],[class*="result" i]'));
        const seen = new Set();
        for (const el of nodes) {
          if (!isVisible(el)) continue;
          const text = textOf(el);
          const cls = String(el.getAttribute?.('class') || el.className || '').toLowerCase();
          if (/%\b|\bgenerating\b|\bcreating\b|\bpreparing\b|\bpending\b|progress/i.test(`${text} ${cls}`)) seen.add(el);
        }
        return seen.size;
      };
      if (window.__gpiI2VSubmitMonitor?.installed && window.__gpiI2VSubmitMonitor.handlers) {
        document.removeEventListener('click', window.__gpiI2VSubmitMonitor.handlers.click, true);
        document.removeEventListener('submit', window.__gpiI2VSubmitMonitor.handlers.submit, true);
        document.removeEventListener('keydown', window.__gpiI2VSubmitMonitor.handlers.keydown, true);
      }
      const monitor = {
        installed: true,
        sceneId,
        displayName,
        submitClickCount: 0,
        formSubmitCount: 0,
        enterSubmitCount: 0,
        duplicateBlockedCount: 0,
        generatingCardCountBefore: countGeneratingCards(),
        generatingCardCountAfter: 0,
        events: [],
        consumedClick: false,
        consumedSubmit: false,
      };
      const pushEvent = (event) => {
        monitor.events.push({ time: now(), ...event });
        if (monitor.events.length > 50) monitor.events.shift();
      };
      const clickHandler = (event) => {
        if (monitor.sceneId !== sceneId || !isSubmitButton(event.target)) return;
        if (monitor.consumedClick) {
          monitor.duplicateBlockedCount++;
          pushEvent({ type: 'duplicate-click-blocked', text: textOf(event.target).slice(0, 80) });
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        monitor.consumedClick = true;
        monitor.submitClickCount++;
        pushEvent({ type: 'click', text: textOf(event.target).slice(0, 80) });
      };
      const submitHandler = (event) => {
        const scope = findBottomComposerScope();
        if (!scope || !event.target || !scope.root.contains(event.target)) return;
        if (monitor.consumedSubmit) {
          monitor.duplicateBlockedCount++;
          pushEvent({ type: 'duplicate-submit-blocked' });
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        monitor.consumedSubmit = true;
        monitor.formSubmitCount++;
        pushEvent({ type: 'submit' });
      };
      const keydownHandler = (event) => {
        if (event.key !== 'Enter' || !isEnterInComposer(event.target)) return;
        if (monitor.consumedClick || monitor.consumedSubmit || monitor.enterSubmitCount > 0) {
          monitor.duplicateBlockedCount++;
          pushEvent({ type: 'duplicate-enter-blocked' });
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        monitor.enterSubmitCount++;
        pushEvent({ type: 'enter' });
      };
      monitor.handlers = { click: clickHandler, submit: submitHandler, keydown: keydownHandler };
      window.__gpiI2VActiveSceneId = sceneId;
      window.__gpiI2VSubmitMonitor = monitor;
      document.addEventListener('click', clickHandler, true);
      document.addEventListener('submit', submitHandler, true);
      document.addEventListener('keydown', keydownHandler, true);
      return { ok: true, sceneId, generatingCardCountBefore: monitor.generatingCardCountBefore };
    },
    args: [sceneId, displayName],
  });
  return result?.[0]?.result || { ok: false, error: 'Install submit monitor failed' };
}

async function getI2VSubmitMonitorState(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      const textOf = (el) => [el?.textContent, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title'), el?.getAttribute?.('data-testid')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      const countGeneratingCards = () => {
        const nodes = Array.from(document.querySelectorAll('[role="progressbar"],[aria-busy="true"],[class*="generating" i],[class*="pending" i],[class*="progress" i],article,[class*="post" i],[class*="result" i]'));
        const seen = new Set();
        for (const el of nodes) {
          if (!isVisible(el)) continue;
          const text = textOf(el);
          const cls = String(el.getAttribute?.('class') || el.className || '').toLowerCase();
          if (/%\b|\bgenerating\b|\bcreating\b|\bpreparing\b|\bpending\b|progress/i.test(`${text} ${cls}`)) seen.add(el);
        }
        return seen.size;
      };
      const monitor = window.__gpiI2VSubmitMonitor || {};
      monitor.generatingCardCountAfter = countGeneratingCards();
      return {
        ok: true,
        sceneId: monitor.sceneId || '',
        submitClickCount: Number(monitor.submitClickCount || 0),
        formSubmitCount: Number(monitor.formSubmitCount || 0),
        enterSubmitCount: Number(monitor.enterSubmitCount || 0),
        duplicateBlockedCount: Number(monitor.duplicateBlockedCount || 0),
        generatingCardCountBefore: Number(monitor.generatingCardCountBefore || 0),
        generatingCardCountAfter: Number(monitor.generatingCardCountAfter || 0),
        events: Array.isArray(monitor.events) ? monitor.events.slice(-10) : [],
      };
    },
  });
  return result?.[0]?.result || { ok: false, error: 'Read submit monitor failed' };
}

async function clearI2VSubmitMonitor(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const monitor = window.__gpiI2VSubmitMonitor;
        if (monitor?.handlers) {
          document.removeEventListener('click', monitor.handlers.click, true);
          document.removeEventListener('submit', monitor.handlers.submit, true);
          document.removeEventListener('keydown', monitor.handlers.keydown, true);
        }
        window.__gpiI2VSubmitMonitor = null;
        window.__gpiI2VActiveSceneId = null;
        return { ok: true };
      },
    });
  } catch {}
}

async function prepareCleanImg2VidSceneComposer(tabId, displayName = 'Cảnh hiện tại') {
  let tabInfo = await chrome.tabs.get(tabId);
  let state = getGrokPageState(tabInfo);
  if (state === 'imagine-post' || !isImagineRootUrl(tabInfo.url || '')) {
    addLog(i2vLogEl, `[I2V prepare scene] ${displayName} current URL là post page hoặc không phải /imagine, quay về /imagine để tạo composer sạch.`, 'info');
    await chrome.tabs.update(tabId, { url: 'https://grok.com/imagine' });
    const readyUrl = await waitForImagineRootUrl(tabId, 15000);
    if (!readyUrl.ok) return readyUrl;
    await sleep(1000);
  }
  const ready = await ensureGrokComposerReady(tabId, { noNavigate: true });
  if (!ready.ok) return ready;
  let clean = await getI2VComposerAttachmentState(tabId);
  if (clean.pendingCards > 0) {
    addLog(i2vLogEl, `[I2V prepare scene] ${displayName} phát hiện pendingCards=${clean.pendingCards}, reset /imagine để tránh dính context cũ.`, 'warn');
    await chrome.tabs.update(tabId, { url: 'https://grok.com/imagine' });
    const readyUrl = await waitForImagineRootUrl(tabId, 15000);
    if (!readyUrl.ok) return readyUrl;
    await sleep(1000);
    const readyAgain = await ensureGrokComposerReady(tabId, { noNavigate: true });
    if (!readyAgain.ok) return readyAgain;
    clean = await getI2VComposerAttachmentState(tabId);
  }
  if ((clean.count || 0) > 0 || (clean.editorTextLen || 0) > 0) {
    addLog(i2vLogEl, `[I2V cleanup] ${displayName} composer chưa sạch, cleanup attachments=${clean.count || 0} editorTextLen=${clean.editorTextLen || 0}`, 'warn');
    await clearBottomComposerAttachments(tabId, { scope: 'bottomComposer', expectedFinalCount: 0, timeoutMs: 8000, stableMs: 400 });
    await clearI2VComposerText(tabId);
    await sleep(500);
    clean = await getI2VComposerAttachmentState(tabId);
  }
  const editorEmpty = (clean.editorTextLen || 0) === 0;
  addLog(i2vLogEl, `[I2V cleanup] ${displayName} composer sạch: editorEmpty=${editorEmpty ? 'yes' : 'no'} attachments=${clean.count || 0} pendingCards=${clean.pendingCards || 0}`, clean.ok && editorEmpty && (clean.count || 0) === 0 ? 'ok' : 'warn');
  if (!clean.ok || !editorEmpty || (clean.count || 0) > 0) {
    return { ok: false, code: 'composer_not_clean', error: 'Composer chưa sạch trước khi upload ảnh Img2Vid.', clean };
  }
  return { ok: true, clean };
}

function createFilmSubmitRuntime() {
  return {
    activeSceneId: null,
    submitting: false,
    accepted: false,
    clickCount: 0,
    clickCounts: new Map(),
    clickStartedAt: 0,
    submittedSceneIds: new Set(),
    phases: new Map(),
    sceneStates: new Map(),
  };
}

function getFilmScenePhase(runtime, sceneId) {
  return runtime?.phases?.get?.(String(sceneId)) || 'idle';
}

function setFilmScenePhase(runtime, sceneId, phase, logEl = sfLogEl) {
  if (!runtime || !sceneId) return phase;
  const id = String(sceneId);
  runtime.phases.set(id, phase);
  const prev = runtime.sceneStates.get(id) || {};
  runtime.sceneStates.set(id, { ...prev, state: phase, updatedAt: Date.now() });
  addLog(logEl, `[Film scene phase] sceneId=${id} -> ${phase}`, 'info');
  return phase;
}

function getFilmSubmitLockStatus(runtime, sceneId) {
  const id = String(sceneId || '');
  if (!runtime) return { ok: false, code: 'film_runtime_missing', error: 'Film submit runtime missing.' };
  if (runtime.submitting) {
    return {
      ok: false,
      code: 'duplicate_submit_blocked',
      error: runtime.activeSceneId === id
        ? 'Scene này đang submit, chặn submit lặp.'
        : `Scene khác đang submit: ${runtime.activeSceneId || 'unknown'}`,
    };
  }
  if (runtime.accepted && runtime.activeSceneId === id) {
    return { ok: false, code: 'duplicate_submit_blocked', error: 'Scene này đã được Grok nhận, không submit lại.' };
  }
  if (runtime.submittedSceneIds.has(id)) {
    return { ok: false, code: 'duplicate_submit_blocked', error: 'Scene này đã submit trước đó, không submit lại.' };
  }
  const phase = getFilmScenePhase(runtime, id);
  if (phase !== 'payload_verified') {
    return { ok: false, code: 'film_scene_phase_not_ready', error: `Scene chưa tới phase payload_verified (hiện tại: ${phase}).`, phase };
  }
  return { ok: true, phase };
}

function beginFilmSubmit(runtime, sceneId) {
  const lock = getFilmSubmitLockStatus(runtime, sceneId);
  if (!lock.ok) return lock;
  const id = String(sceneId);
  const nextClickCount = Number(runtime.clickCounts?.get?.(id) || 0) + 1;
  if (runtime.clickCounts?.set) runtime.clickCounts.set(id, nextClickCount);
  runtime.clickCount = nextClickCount;
  if (nextClickCount > 1) {
    return { ok: false, code: 'film_duplicate_submit_blocked', error: 'Đã chặn submit lặp trước khi click.' };
  }
  runtime.submitting = true;
  runtime.accepted = false;
  runtime.activeSceneId = id;
  runtime.clickStartedAt = Date.now();
  setFilmScenePhase(runtime, sceneId, 'submit_inflight');
  return { ok: true };
}

function acceptFilmSubmit(runtime, sceneId) {
  if (!runtime) return;
  const id = String(sceneId);
  runtime.submittedSceneIds.add(id);
  runtime.submitting = false;
  runtime.accepted = true;
  runtime.clickCount = Number(runtime.clickCount || 0);
  runtime.activeSceneId = id;
  setFilmScenePhase(runtime, id, 'submit_accepted');
}

function failFilmSubmit(runtime, sceneId, error = null) {
  if (!runtime) return;
  const id = String(sceneId);
  if (runtime.activeSceneId === id) runtime.activeSceneId = null;
  runtime.submitting = false;
  runtime.accepted = false;
  runtime.clickCount = 0;
  if (runtime.clickCounts?.delete) runtime.clickCounts.delete(id);
  const sceneState = { ...(runtime.sceneStates?.get?.(id) || {}), lastError: error };
  if (runtime.sceneStates?.set) runtime.sceneStates.set(id, sceneState);
}

async function installFilmEarlySubmitShield(tabId, sceneId, phase = 'preparing') {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sceneId, phase) => {
        const now = Date.now();
        const ensureState = () => {
          window.__gpiFilmEarlySubmitShield = {
            ...(window.__gpiFilmEarlySubmitShield || {}),
            active: true,
            monitorOnly: true,
            sceneId: String(sceneId || ''),
            phase: phase || 'preparing',
            blockedSubmitTotal: Number(window.__gpiFilmEarlySubmitShield?.blockedSubmitTotal || 0),
            seenSubmitTotal: Number(window.__gpiFilmEarlySubmitShield?.seenSubmitTotal || 0),
            events: Array.isArray(window.__gpiFilmEarlySubmitShield?.events) ? window.__gpiFilmEarlySubmitShield.events.slice(-30) : [],
            updatedAt: now,
          };
          return window.__gpiFilmEarlySubmitShield;
        };
        const isVisible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
        };
        const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
        const textOf = (el) => [el?.textContent, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title'), el?.getAttribute?.('type'), el?.getAttribute?.('data-testid')]
          .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
        const findBottomComposerRoot = () => {
          const inputs = Array.from(document.querySelectorAll([
            'textarea[placeholder*="Type to imagine" i]',
            'textarea[placeholder*="Imagine" i]',
            'textarea[placeholder*="Describe" i]',
            'textarea[placeholder*="Enter" i]',
            'div[contenteditable="true"][data-lexical-editor]',
            'div[contenteditable="true"]',
            'textarea',
            'input',
          ].join(','))).filter(el => isVisible(el) && !isBlocked(el));
          return inputs.map(input => {
            const root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]') || input.parentElement;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root?.getBoundingClientRect?.() || inputRect;
            return root && (inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75)
              ? { root, bottom: rootRect.bottom }
              : null;
          }).filter(Boolean).sort((a, b) => b.bottom - a.bottom)[0]?.root || null;
        };
        const isBottomComposerSubmitButton = (target) => {
          const root = findBottomComposerRoot();
          const btn = target?.closest?.('button,[role="button"]');
          if (!root || !btn || !root.contains(btn) || !isVisible(btn) || isBlocked(btn)) return false;
          const hay = textOf(btn);
          if (/^[1-4]$/.test(hay.replace(/\s+/g, ''))) return false;
          if (/\b(attach|upload|image|photo|file|remove|delete|close|clear|cancel|mic|voice|menu|option|more|edit|download|save)\b/.test(hay)) return false;
          if (/\b(send|submit|generate|create|grok)\b/.test(hay) || btn.getAttribute?.('type') === 'submit') return true;
          const r = btn.getBoundingClientRect();
          const rr = root.getBoundingClientRect();
          return !!btn.querySelector('svg') && r.right > rr.right - 180 && r.bottom > rr.bottom - 140 && r.width >= 24 && r.width <= 72 && r.height >= 24 && r.height <= 72;
        };
        const isBottomComposerForm = (form) => {
          const root = findBottomComposerRoot();
          return !!root && !!form && (root === form || root.contains(form) || form.contains?.(root));
        };
        const isBottomComposerEnter = (target, event) => {
          if (event.key !== 'Enter' || event.shiftKey) return false;
          const root = findBottomComposerRoot();
          if (!root || !target || !root.contains(target)) return false;
          return !!target.closest?.('textarea,input,div[contenteditable="true"],[contenteditable="true"]');
        };
        const shouldBlock = () => {
          return false;
        };
        const record = (kind, event, blocked) => {
          const state = ensureState();
          state.seenSubmitTotal = Number(state.seenSubmitTotal || 0) + 1;
          if (blocked) state.blockedSubmitTotal = Number(state.blockedSubmitTotal || 0) + 1;
          state.events = Array.isArray(state.events) ? state.events.slice(-30) : [];
          state.events.push({ kind, blocked, phase: state.phase, time: Date.now(), target: textOf(event?.target).slice(0, 80) });
          state.updatedAt = Date.now();
        };
        const block = (kind, event) => {
          record(kind, event, false);
          console.warn('[Film early submit shield] monitor-only, không chặn submit event', { kind, phase: window.__gpiFilmEarlySubmitShield?.phase });
        };
        if (!window.__gpiFilmEarlySubmitShieldInstalled) {
          document.addEventListener('click', (event) => {
            if (!isBottomComposerSubmitButton(event.target)) return;
            if (shouldBlock()) return block('click', event);
            record('click', event, false);
          }, true);
          document.addEventListener('submit', (event) => {
            if (!isBottomComposerForm(event.target)) return;
            if (shouldBlock()) return block('submit', event);
            record('submit', event, false);
          }, true);
          document.addEventListener('keydown', (event) => {
            if (!isBottomComposerEnter(event.target, event)) return;
            if (shouldBlock()) return block('enter', event);
            record('enter', event, false);
          }, true);
          const proto = window.HTMLFormElement?.prototype;
          if (proto && !window.__gpiFilmEarlySubmitShieldOriginalRequestSubmit) {
            window.__gpiFilmEarlySubmitShieldOriginalRequestSubmit = proto.requestSubmit;
            proto.requestSubmit = function patchedFilmRequestSubmit(...args) {
              if (isBottomComposerForm(this) && shouldBlock()) {
                record('requestSubmit', { target: this }, false);
                console.warn('[Film early submit shield] monitor-only requestSubmit', { phase: window.__gpiFilmEarlySubmitShield?.phase });
              }
              if (isBottomComposerForm(this)) record('requestSubmit', { target: this }, false);
              return window.__gpiFilmEarlySubmitShieldOriginalRequestSubmit.apply(this, args);
            };
          }
          window.__gpiFilmEarlySubmitShieldInstalled = true;
        }
        const state = ensureState();
        return { ok: true, phase: state.phase, blockedSubmitTotal: state.blockedSubmitTotal, seenSubmitTotal: state.seenSubmitTotal };
      },
      args: [sceneId, phase],
    });
    return result?.[0]?.result || { ok: false, code: 'film_shield_install_failed', error: 'Không cài được Film early submit shield.' };
  } catch (e) {
    return { ok: false, code: 'film_shield_install_failed', error: e?.message || String(e) };
  }
}

async function setFilmEarlySubmitShieldPhase(tabId, sceneId, phase, options = {}) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sceneId, phase, active) => {
        const state = window.__gpiFilmEarlySubmitShield;
        if (!state) return { ok: false, code: 'film_shield_missing' };
        state.sceneId = String(sceneId || state.sceneId || '');
        state.phase = phase || state.phase || 'preparing';
        state.active = active !== false;
        state.updatedAt = Date.now();
        return {
          ok: true,
          sceneId: state.sceneId,
          phase: state.phase,
          active: state.active,
          blockedSubmitTotal: Number(state.blockedSubmitTotal || 0),
          seenSubmitTotal: Number(state.seenSubmitTotal || 0),
        };
      },
      args: [sceneId, phase, options.active !== false],
    });
    return result?.[0]?.result || { ok: false, code: 'film_shield_phase_failed' };
  } catch (e) {
    return { ok: false, code: 'film_shield_phase_failed', error: e?.message || String(e) };
  }
}

async function getFilmEarlySubmitShieldState(tabId) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const s = window.__gpiFilmEarlySubmitShield || {};
        return {
          ok: true,
          active: !!s.active,
          monitorOnly: s.monitorOnly !== false,
          sceneId: s.sceneId || '',
          phase: s.phase || 'missing',
          blockedSubmitTotal: Number(s.blockedSubmitTotal || 0),
          seenSubmitTotal: Number(s.seenSubmitTotal || 0),
          events: Array.isArray(s.events) ? s.events.slice(-12) : [],
        };
      },
    });
    return result?.[0]?.result || { ok: false };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function clearFilmEarlySubmitShield(tabId) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (window.__gpiFilmEarlySubmitShield) {
          window.__gpiFilmEarlySubmitShield.active = false;
          window.__gpiFilmEarlySubmitShield.phase = 'disabled';
          window.__gpiFilmEarlySubmitShield.updatedAt = Date.now();
        }
        return { ok: true };
      },
    });
    return result?.[0]?.result || { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function waitFilmPromptCommitStable(tabId, expectedPrompt, options = {}) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || 8000));
  const stableMs = Math.max(300, Number(options.stableMs || 1000));
  const pollMs = Math.max(100, Number(options.pollMs || 250));
  const minTextChars = Math.max(1, Number(options.minTextChars || Math.min(80, Math.max(20, Math.floor(String(expectedPrompt || '').length * 0.15)))));
  const startedAt = Date.now();
  let stableStart = null;
  let lastText = '';
  let lastSample = null;
  while (Date.now() - startedAt < timeoutMs) {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (expectedPrompt, minTextChars) => {
        const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
        const normalizePrompt = (text) => normalize(text).toLowerCase();
        const promptMatches = (text, expected) => {
          const a = normalizePrompt(text);
          const b = normalizePrompt(expected);
          if (!a || !b || a.length < minTextChars) return false;
          if (a === b) return true;
          const prefix = b.slice(0, Math.min(120, b.length));
          return prefix.length >= 30 && a.includes(prefix);
        };
        const isVisible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
        };
        const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
        const scope = Array.from(document.querySelectorAll([
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
          'input',
        ].join(','))).filter(input => isVisible(input) && !isBlocked(input))
          .map(input => {
            const root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]') || input.parentElement;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root?.getBoundingClientRect?.() || inputRect;
            return (inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75) ? { input, root } : null;
          }).filter(Boolean)[0];
        if (!scope) return { ok: false, code: 'composer_not_found', editorTextLen: 0, rootTextLen: 0, promptMatch: false };
        const editor = Array.from(scope.root.querySelectorAll('[data-testid="chat-input"] [contenteditable="true"],div[contenteditable="true"].ProseMirror,div[contenteditable="true"],textarea,input'))
          .filter(el => scope.root.contains(el) && isVisible(el) && !isBlocked(el))[0] || scope.input;
        const editorText = 'value' in editor ? normalize(editor.value || '') : normalize(editor.innerText || editor.textContent || '');
        const rootText = normalize(scope.root.innerText || scope.root.textContent || '');
        return {
          ok: promptMatches(editorText, expectedPrompt) && promptMatches(rootText, expectedPrompt),
          code: null,
          editorTextLen: editorText.length,
          rootTextLen: rootText.length,
          promptMatch: promptMatches(editorText, expectedPrompt),
          rootPromptMatch: promptMatches(rootText, expectedPrompt),
          editorTextPreview: editorText.slice(0, 160),
        };
      },
      args: [expectedPrompt, minTextChars],
    });
    lastSample = result?.[0]?.result || { ok: false, code: 'script_failed', editorTextLen: 0, rootTextLen: 0 };
    const currentText = lastSample.editorTextPreview || '';
    if (lastSample.ok && currentText === lastText) {
      if (!stableStart) stableStart = Date.now();
      if (Date.now() - stableStart >= stableMs) {
        return { ...lastSample, ok: true, stable: true, stableElapsedMs: Date.now() - stableStart, timeoutMs };
      }
    } else {
      stableStart = null;
      lastText = currentText;
    }
    addLog(sfLogEl, `[SF prompt commit] sceneId=${options.sceneId || ''} editorTextLen=${lastSample.editorTextLen || 0} rootTextLen=${lastSample.rootTextLen || 0} stable=${stableStart ? Date.now() - stableStart : 0}/${stableMs}`, lastSample.ok ? 'info' : 'warn');
    await sleep(pollMs);
  }
  return { ...(lastSample || {}), ok: false, stable: false, code: lastSample?.code || 'prompt_commit_unstable', error: 'Prompt chưa commit ổn định trước submit.' };
}

async function waitFilmComposerReadyForSubmit(tabId, expectedPrompt, options = {}) {
  const timeoutMs = Math.max(3000, Number(options.timeoutMs || SF_PRE_SUBMIT_READY_TIMEOUT));
  const stableMs = Math.max(400, Number(options.stableMs || 1200));
  const pollMs = Math.max(150, Number(options.pollMs || 300));
  const guardOptions = options.guardOptions || {};
  const refsReady = options.refsReady === true;
  const maxRefs = Math.max(1, Number(options.maxRefs || SF_MAX_REFERENCE_IMAGES));
  const requireImage = guardOptions.requireImage === true;
  const minImages = Math.max(1, Number(guardOptions.minImages || 1));
  const logEl = options.logEl || sfLogEl;
  const sceneId = options.sceneId || guardOptions.expectedSceneId || '';
  const startedAt = Date.now();
  let stableStart = null;
  let lastKey = '';
  let lastLogAt = 0;
  let lastDebugLogAt = 0;
  let lastSample = null;

  while (Date.now() - startedAt < timeoutMs) {
    const [payload, state, submitState] = await Promise.all([
      verifyComposerPayload(tabId, expectedPrompt, guardOptions),
      getFilmComposerCleanState(tabId),
      findFilmSubmitButtonState(tabId, {
        sceneId,
        feature: 'Film',
        scope: 'currentComposer',
        logEl,
      }),
    ]);
    const attachmentCount = Number(state?.attachmentCount || 0);
    const pendingCards = Number(state?.pendingCards || 0);
    const buttonFound = submitState?.buttonFound === true && submitState?.buttonDisabled !== true;
    const textReady = payload?.ok === true;
    const imageReady = requireImage
      ? Number(payload?.imageCount || 0) >= minImages
      : (!refsReady || attachmentCount > 0);
    const refsWithinLimit = attachmentCount <= maxRefs;
    const pendingReady = pendingCards === 0;
    const ready = textReady && imageReady && refsWithinLimit && buttonFound && pendingReady;
    const key = [
      payload?.composerTextLength || 0,
      payload?.editorTextLength || payload?.textLen || 0,
      payload?.imageCount || 0,
      attachmentCount,
      state?.rawImageNodes || 0,
      pendingCards,
      buttonFound ? 'button' : 'no-button',
      textReady ? 'text' : 'no-text',
    ].join('|');
    lastSample = {
      ok: ready,
      code: ready ? null : 'film_composer_not_ready_for_submit',
      error: ready ? null : 'Composer chưa sẵn sàng để submit Film.',
      payload,
      state,
      submitState,
      textReady,
      imageReady,
      refsWithinLimit,
      pendingReady,
      buttonFound,
      buttonDisabled: submitState?.buttonDisabled === true,
      attachmentCount,
      pendingCards,
      stableElapsedMs: stableStart ? Date.now() - stableStart : 0,
      timeoutMs,
    };

    if (ready && key === lastKey) {
      if (!stableStart) stableStart = Date.now();
      const elapsed = Date.now() - stableStart;
      if (elapsed >= stableMs) {
        return { ...lastSample, ok: true, stable: true, stableElapsedMs: elapsed };
      }
    } else {
      stableStart = null;
      lastKey = key;
    }

    if (Date.now() - lastLogAt > 1200) {
      addLog(
        logEl,
        `[SF ready] sceneId=${sceneId} text=${textReady ? 'yes' : 'no'} refs=${imageReady ? 'yes' : 'no'} attachmentCount=${attachmentCount} pending=${pendingCards} button=${buttonFound ? 'yes' : 'no'} stable=${stableStart ? Date.now() - stableStart : 0}/${stableMs}`,
        ready ? 'info' : 'warn'
      );
      if (buttonFound) {
        addLog(logEl, `[SF ready] submit button found via unified finder: type=${submitState.selectedButton?.type || ''} aria=${submitState.selectedButton?.aria || ''} rect=${JSON.stringify(submitState.selectedButton?.rect || {})}`, 'info');
      } else if (Date.now() - lastDebugLogAt > 3500) {
        addLog(logEl, `[SF ready debug] composerFound=${submitState?.composerFound ? 'yes' : 'no'} composerType=${submitState?.composerType || 'unknown'} reason=${submitState?.reason || 'unknown'}`, 'warn');
        const candidates = (submitState?.candidates || []).slice(0, 5);
        if (candidates.length) {
          addLog(logEl, `[SF ready debug] buttons found: ${candidates.map((btn, idx) => `#${idx + 1} aria=${btn.aria || ''} type=${btn.type || ''} disabled=${btn.disabled ? 'true' : 'false'} score=${btn.score ?? ''} rect=${JSON.stringify(btn.rect || {})}`).join(' | ')}`, 'warn');
        }
        lastDebugLogAt = Date.now();
      }
      lastLogAt = Date.now();
    }
    await sleep(pollMs);
  }

  return {
    ...(lastSample || {}),
    ok: false,
    stable: false,
    code: lastSample?.code || 'film_composer_ready_timeout',
    error: lastSample?.error || 'Hết thời gian chờ composer Film sẵn sàng để submit.',
  };
}

async function clickSubmitButtonInPage(tabId, options = {}) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (opts = {}) => {
        const method = String(opts.method || 'pointer-mouse-click');
        const isVisible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
        };
        const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
        const findBottomComposerScope = () => {
          const selectors = [
            'textarea[placeholder*="Type to imagine" i]',
            'textarea[placeholder*="Imagine" i]',
            'textarea[placeholder*="Describe" i]',
            'textarea[placeholder*="Enter" i]',
            'input[placeholder*="Imagine" i]',
            'input[placeholder*="Describe" i]',
            'input[placeholder*="Enter" i]',
            'div[contenteditable="true"][data-lexical-editor]',
            'div[contenteditable="true"]',
            'textarea',
            'input',
          ].join(',');
          return Array.from(document.querySelectorAll(selectors))
            .filter(input => isVisible(input) && !isBlocked(input))
            .map(input => {
              let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
              if (!root) {
                let node = input.parentElement;
                for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                  if (node.querySelector('button,[role="button"],label,input[type="file"]')) { root = node; break; }
                }
              }
              if (!root || root === document.body || isBlocked(root)) return null;
              const inputRect = input.getBoundingClientRect();
              const rootRect = root.getBoundingClientRect();
              return (inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75)
                ? { input, root, inputRect, rootRect }
                : null;
            })
            .filter(Boolean)
            .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
        };
        const isEnabled = (btn) => btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true' && !btn.closest('[aria-disabled="true"]');
        const buttonText = (btn) => [btn?.getAttribute?.('aria-label'), btn?.getAttribute?.('title'), btn?.getAttribute?.('data-testid'), btn?.textContent].filter(Boolean).join(' ').toLowerCase();
        const getSubmitButtonCandidates = (scope) => {
          const rootRect = scope.root.getBoundingClientRect();
          return Array.from(scope.root.querySelectorAll('button,[role="button"],button[type="submit"]'))
            .filter(btn => isVisible(btn) && !isBlocked(btn))
            .map((btn, idx) => {
              const r = btn.getBoundingClientRect();
              const text = buttonText(btn);
              const type = btn.getAttribute?.('type') || '';
              const svg = !!btn.querySelector('svg');
              const rightSide = r.right > rootRect.right - 180;
              const bottomSide = r.bottom > rootRect.bottom - 120;
              const positive = /\b(send|submit|generate|create|grok)\b/.test(text)
                || /send|submit|generate/i.test(btn.getAttribute?.('aria-label') || '')
                || type.toLowerCase() === 'submit'
                || (rightSide && svg);
              const negative = /\b(attach|upload|image|photo|file|remove|delete|close|clear|cancel|mic|voice|menu|option|more|edit|aspect|saved|canvas)\b/.test(text);
              const disabled = !isEnabled(btn);
              return {
                btn,
                idx,
                text,
                type,
                disabled,
                svg,
                rightSide,
                bottomSide,
                rect: {
                  x: Math.round(r.left),
                  y: Math.round(r.top),
                  w: Math.round(r.width),
                  h: Math.round(r.height),
                  right: Math.round(r.right),
                  bottom: Math.round(r.bottom),
                },
                score: (positive ? 100 : 0) + (type.toLowerCase() === 'submit' ? 60 : 0) + (rightSide ? 25 : 0) + (bottomSide ? 10 : 0) + (svg ? 10 : 0) - (negative ? 120 : 0) - (disabled ? 80 : 0),
              };
            })
            .sort((a, b) => b.score - a.score || b.rect.right - a.rect.right);
        };
        const trustedClick = (el) => {
          el.scrollIntoView({ block: 'center', inline: 'center' });
          el.focus();
          try { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, view: window })); } catch {}
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 1 }));
          try { el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, view: window })); } catch {}
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 0 }));
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 0 }));
          try { el.click(); } catch {}
        };
        const nativeButtonClick = (el) => {
          el.scrollIntoView({ block: 'center', inline: 'center' });
          el.focus();
          el.click();
        };
        const formRequestSubmit = (el) => {
          const form = el.closest('form');
          if (!form || typeof form.requestSubmit !== 'function') {
            return { ok: false, code: 'form_request_submit_unavailable', error: 'Không tìm thấy form.requestSubmit cho composer.' };
          }
          form.requestSubmit(el);
          return { ok: true };
        };
        const keyboardSubmit = (scope) => {
          const editor = scope.input || Array.from(scope.root.querySelectorAll('div[contenteditable="true"],textarea,input'))
            .filter(el => isVisible(el) && !isBlocked(el))[0];
          if (!editor) return { ok: false, code: 'keyboard_editor_not_found', error: 'Không tìm thấy editor để gửi phím submit.' };
          editor.focus();
          const init = { bubbles: true, cancelable: true, composed: true, key: 'Enter', code: 'Enter', which: 13, keyCode: 13 };
          editor.dispatchEvent(new KeyboardEvent('keydown', { ...init, ctrlKey: true }));
          editor.dispatchEvent(new KeyboardEvent('keyup', { ...init, ctrlKey: true }));
          editor.dispatchEvent(new KeyboardEvent('keydown', init));
          editor.dispatchEvent(new KeyboardEvent('keyup', init));
          return { ok: true };
        };

        const scope = findBottomComposerScope();
        if (!scope) return { ok: false, clicked: false, method, code: 'composer_not_found', error: 'Bottom composer not found', buttonFound: false, buttonDisabled: null };
        const candidates = getSubmitButtonCandidates(scope);
        const candidate = candidates.find(item => item.score > 0 && !item.disabled);
        const button = candidate?.btn || null;
        if (!button) {
          return {
            ok: false,
            clicked: false,
            method,
            code: 'submit_button_not_found',
            error: 'Không tìm thấy nút submit trong bottom composer.',
            buttonFound: false,
            buttonDisabled: null,
            buttonCandidates: candidates.slice(0, 8).map(item => ({ text: item.text, type: item.type, disabled: item.disabled, score: item.score, rect: item.rect, svg: item.svg, rightSide: item.rightSide })),
          };
        }
        if (!isEnabled(button)) {
          return { ok: false, clicked: false, method, code: 'submit_button_disabled', error: 'Nút submit đang disabled.', buttonFound: true, buttonDisabled: true };
        }
        const r = button.getBoundingClientRect();
        let methodResult = { ok: true };
        if (method === 'native-button-click-only') nativeButtonClick(button);
        else if (method === 'form-request-submit') methodResult = formRequestSubmit(button);
        else if (method === 'keyboard-submit') methodResult = keyboardSubmit(scope);
        else trustedClick(button);
        if (!methodResult.ok) {
          return {
            ok: false,
            clicked: false,
            method,
            code: methodResult.code || 'submit_method_failed',
            error: methodResult.error || 'Submit method failed.',
            buttonFound: true,
            buttonDisabled: false,
          };
        }
        return {
          ok: true,
          clicked: true,
          method,
          buttonFound: true,
          buttonDisabled: false,
          buttonCenter: { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) },
          feature: opts.feature || '',
          sceneId: String(opts.sceneId || ''),
        };
      },
      args: [{ feature: options.feature || '', sceneId: options.sceneId || '', scope: options.scope || 'bottomComposer', method: options.method || 'pointer-mouse-click' }],
    });
    return result?.[0]?.result || { ok: false, clicked: false, method: options.method || 'pointer-mouse-click', code: 'page_click_failed', error: 'Không chạy được page click script.' };
  } catch (e) {
    return { ok: false, clicked: false, method: options.method || 'pointer-mouse-click', code: 'page_click_failed', error: e?.message || String(e) };
  }
}

async function getSubmitAcceptedSnapshot(tabId, options = {}) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (opts) => {
        const normalizeText = (text) => String(text || '').replace(/\s+/g, ' ').trim();
        const isVisible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
        };
        const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
        const countVisible = (selector) => Array.from(document.querySelectorAll(selector)).filter(el => isVisible(el) && !isBlocked(el)).length;
        const findBottomComposerScope = () => {
          const selectors = [
            'textarea[placeholder*="Type to imagine" i]',
            'textarea[placeholder*="Imagine" i]',
            'textarea[placeholder*="Describe" i]',
            'textarea[placeholder*="Enter" i]',
            'input[placeholder*="Imagine" i]',
            'input[placeholder*="Describe" i]',
            'input[placeholder*="Enter" i]',
            'div[contenteditable="true"][data-lexical-editor]',
            'div[contenteditable="true"]',
            'textarea',
            'input',
          ].join(',');
          return Array.from(document.querySelectorAll(selectors))
            .filter(input => isVisible(input) && !isBlocked(input))
            .map(input => {
              let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
              if (!root) {
                let node = input.parentElement;
                for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                  if (node.querySelector('button,[role="button"],label,input[type="file"]')) { root = node; break; }
                }
              }
              if (!root || root === document.body || isBlocked(root)) return null;
              const inputRect = input.getBoundingClientRect();
              const rootRect = root.getBoundingClientRect();
              return (inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75)
                ? { input, root, inputRect, rootRect }
                : null;
            })
            .filter(Boolean)
            .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
        };
        const findEditor = (scope) => {
          if (!scope?.root) return scope?.input || null;
          return Array.from(scope.root.querySelectorAll('[data-testid="chat-input"] [contenteditable="true"],div[contenteditable="true"].ProseMirror,div[contenteditable="true"],textarea,input'))
            .filter(el => scope.root.contains(el) && isVisible(el) && !isBlocked(el))[0] || scope.input || null;
        };
        const isEnabled = (btn) => btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true' && !btn.closest('[aria-disabled="true"]');
        const buttonText = (btn) => [btn?.getAttribute?.('aria-label'), btn?.getAttribute?.('title'), btn?.getAttribute?.('data-testid'), btn?.textContent].filter(Boolean).join(' ').toLowerCase();
        const findSubmitButton = (scope) => {
          if (!scope?.root) return null;
          const rootRect = scope.root.getBoundingClientRect();
          return Array.from(scope.root.querySelectorAll('button,[role="button"],button[type="submit"]'))
            .filter(btn => isVisible(btn) && !isBlocked(btn))
            .map(btn => {
              const r = btn.getBoundingClientRect();
              const text = buttonText(btn);
              const type = btn.getAttribute?.('type') || '';
              const positive = /\b(send|submit|generate|create|grok)\b/.test(text)
                || type.toLowerCase() === 'submit'
                || (r.right > rootRect.right - 180 && !!btn.querySelector('svg'));
              const negative = /\b(attach|upload|image|photo|file|remove|delete|close|clear|cancel|mic|voice|menu|option|more|edit)\b/.test(text);
              return { btn, score: (positive ? 100 : 0) + (type.toLowerCase() === 'submit' ? 60 : 0) - (negative ? 120 : 0), disabled: !isEnabled(btn) };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)[0]?.btn || null;
        };
        const scope = findBottomComposerScope();
        const editor = findEditor(scope);
        const button = findSubmitButton(scope);
        const editorText = editor ? (('value' in editor) ? normalizeText(editor.value || '') : normalizeText(editor.innerText || editor.textContent || '')) : '';
        const bodyText = normalizeText(document.body.innerText || document.body.textContent || '').toLowerCase();
        const loading = !!document.querySelector('[aria-busy="true"],[class*="loading" i],[class*="generating" i],[class*="pending" i],[class*="skeleton" i],[role="progressbar"]')
          || /\b(generating|creating|preparing|đang tạo|đang chuẩn bị)\b/i.test(bodyText);
        const i2v = window.__gpiI2VSubmitMonitor || {};
        const film = window.__gpiFilmEarlySubmitShield || {};
        const filmEvents = Array.isArray(film.events) ? film.events : [];
        const filmLastEvent = filmEvents[filmEvents.length - 1] || {};
        return {
          ok: true,
          feature: opts.feature || '',
          sceneId: String(opts.sceneId || ''),
          url: String(location.href || ''),
          editorTextLen: editorText.length,
          buttonDisabled: button ? !isEnabled(button) : false,
          loading,
          generatingCards: countVisible('article,[class*="post" i],[class*="result" i],[class*="progress" i],[class*="generating" i],[role="progressbar"]'),
          mediaPlaceholders: countVisible('[class*="placeholder" i],[class*="skeleton" i],[aria-busy="true"],[class*="pending" i]'),
          i2vSubmitClickCount: Number(i2v.submitClickCount || 0),
          i2vFormSubmitCount: Number(i2v.formSubmitCount || 0),
          i2vEnterSubmitCount: Number(i2v.enterSubmitCount || 0),
          filmSeenSubmitTotal: Number(film.seenSubmitTotal || 0),
          filmBlockedSubmitTotal: Number(film.blockedSubmitTotal || 0),
          filmLastEventKind: String(filmLastEvent.kind || ''),
          filmLastEventBlocked: filmLastEvent.blocked === true,
        };
      },
      args: [{ feature: options.feature || '', sceneId: options.sceneId || '' }],
    });
    return result?.[0]?.result || { ok: false, code: 'submit_snapshot_failed' };
  } catch (e) {
    return { ok: false, code: 'submit_snapshot_failed', error: e?.message || String(e) };
  }
}

async function waitSubmitAcceptedAfterPageClick(tabId, options = {}) {
  const feature = options.feature || 'Submit';
  const normalizedFeature = String(feature || '').toLowerCase();
  const sceneId = options.sceneId || '';
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || 8000));
  const pollMs = Math.max(100, Number(options.pollMs || 250));
  const before = options.beforeSnapshot || await getSubmitAcceptedSnapshot(tabId, { feature, sceneId });
  const startedAt = Date.now();
  let after = before;
  let signals = {};
  let reason = 'no-submit-signal';
  while (Date.now() - startedAt < timeoutMs) {
    after = await getSubmitAcceptedSnapshot(tabId, { feature, sceneId });
    signals = {
      deltaClick: Number(after.i2vSubmitClickCount || 0) - Number(before.i2vSubmitClickCount || 0),
      deltaForm: Number(after.i2vFormSubmitCount || 0) - Number(before.i2vFormSubmitCount || 0),
      deltaEnter: Number(after.i2vEnterSubmitCount || 0) - Number(before.i2vEnterSubmitCount || 0),
      deltaFilmSubmit: Number(after.filmSeenSubmitTotal || 0) - Number(before.filmSeenSubmitTotal || 0),
      deltaFilmBlocked: Number(after.filmBlockedSubmitTotal || 0) - Number(before.filmBlockedSubmitTotal || 0),
      urlChanged: String(after.url || '') !== String(before.url || ''),
      newGeneratingCard: Number(after.generatingCards || 0) > Number(before.generatingCards || 0),
      newMediaPlaceholder: Number(after.mediaPlaceholders || 0) > Number(before.mediaPlaceholders || 0),
      buttonDisabled: after.buttonDisabled === true && before.buttonDisabled !== true,
      loading: after.loading === true && before.loading !== true,
      composerCleared: Number(before.editorTextLen || 0) > 10 && Number(after.editorTextLen || 0) < Math.min(10, Number(before.editorTextLen || 0)),
    };
    const filmSubmitKind = String(after.filmLastEventKind || '').toLowerCase();
    const filmStrongSubmitEvent = signals.deltaFilmSubmit > 0
      && after.filmLastEventBlocked !== true
      && /click|submit|requestsubmit|enter/.test(filmSubmitKind);
    const featureSubmitSignal = normalizedFeature.includes('film')
      ? filmStrongSubmitEvent
      : normalizedFeature.includes('img2vid') || normalizedFeature.includes('i2v')
        ? (signals.deltaClick > 0 || signals.deltaForm > 0 || signals.deltaEnter > 0)
        : (signals.deltaClick > 0 || signals.deltaForm > 0 || signals.deltaEnter > 0 || filmStrongSubmitEvent);
    const strong = featureSubmitSignal
      || signals.urlChanged || signals.newGeneratingCard || signals.newMediaPlaceholder || signals.buttonDisabled || signals.loading;
    if (strong) {
      reason = filmStrongSubmitEvent ? `film-${filmSubmitKind || 'submit'}`
        : signals.deltaForm > 0 ? 'form-submit'
          : signals.deltaClick > 0 ? 'submit-click'
            : signals.deltaEnter > 0 ? 'enter-submit'
              : signals.urlChanged ? 'url-changed'
                : signals.newGeneratingCard ? 'generating-card'
                  : signals.newMediaPlaceholder ? 'media-placeholder'
                    : signals.buttonDisabled ? 'button-disabled'
                      : 'loading';
      return { accepted: true, strongAccepted: true, reason, signals, before, after };
    }
    await sleep(pollMs);
  }
  return { accepted: false, strongAccepted: false, reason, signals, before, after };
}

async function submitComposerWithoutDebugger(tabId, options = {}) {
  const feature = options.feature || 'Submit';
  const isFilm = String(feature).toLowerCase().includes('film');
  const sceneId = options.sceneId || '';
  const logEl = isFilm ? sfLogEl : i2vLogEl;
  const sceneLabel = isFilm
    ? `Cảnh ${sceneId || ''}`.trim()
    : (options.displayName || `Cảnh ${sceneId || ''}`.trim());
  const requireImage = options.requireImage === true;
  const minImages = Math.max(1, Number(options.minImages || 1));
  const minTextChars = Math.max(1, Number(options.minTextChars || 20));
  const timeoutPerMethodMs = Math.max(1000, Number(options.timeoutPerMethodMs || 2500));
  const methods = [
    'pointer-mouse-click',
    'native-button-click-only',
    'form-request-submit',
    'keyboard-submit',
  ];
  let clicked = false;
  let lastResult = null;
  let lastGuard = null;

  for (const method of methods) {
    const guard = await verifyComposerPayload(tabId, options.expectedText || '', {
      scope: options.scope || 'bottomComposer',
      requireText: true,
      requireImage,
      minImages,
      minTextChars,
      timeoutMs: 2500,
      stableMs: 250,
      expectedSceneId: sceneId,
    });
    lastGuard = guard;
    const editorTextLen = guard.editorTextLength ?? guard.composerTextLength ?? guard.textLen ?? 0;
    const imageCount = guard.imageCount ?? guard.count ?? 0;
    if (!guard.ok) {
      const textMissing = guard.code === 'text_missing' || editorTextLen < minTextChars;
      const imageMissing = requireImage && imageCount < minImages;
      const code = textMissing ? 'text_missing_before_submit_fallback'
        : imageMissing ? 'image_missing_before_submit_fallback'
          : (guard.code || 'payload_missing_before_submit_fallback');
      const error = textMissing
        ? 'Prompt mất trước fallback submit, không tiếp tục để tránh submit ảnh-only.'
        : imageMissing
          ? 'Thiếu ảnh tham chiếu trước fallback submit.'
          : (guard.error || 'Payload không còn hợp lệ trước fallback submit.');
      addLog(logEl, `[Submit method] ${feature} ${sceneLabel} dừng trước ${method}: ${error}`, 'err');
      return {
        ok: false,
        payloadOk: false,
        clicked,
        accepted: false,
        strongAccepted: false,
        method,
        acceptedReason: 'payload-missing',
        code,
        error,
        preClickGuard: guard,
        debug: { lastGuard, lastResult },
      };
    }

    addLog(logEl, `[Submit method] ${feature} ${sceneLabel} thử ${method}.`, 'info');
    const beforeSnapshot = await getSubmitAcceptedSnapshot(tabId, { feature, sceneId });
    const clickRes = await clickSubmitButtonInPage(tabId, {
      feature,
      sceneId,
      scope: options.scope || 'bottomComposer',
      method,
    });
    clicked = clicked || clickRes.clicked === true;
    lastResult = clickRes;
    addLog(logEl, `[Submit click] method=${clickRes.method || method} clicked=${clickRes.clicked ? 'yes' : 'no'}.`, clickRes.ok ? 'info' : 'warn');
    if (!clickRes.ok || !clickRes.clicked) {
      addLog(logEl, `[Submit accepted] accepted=no reason=${clickRes.code || 'click-failed'} method=${method}.`, 'warn');
      if (clickRes.code === 'submit_button_not_found' || clickRes.code === 'submit_button_disabled') {
        return {
          ok: false,
          payloadOk: true,
          clicked,
          accepted: false,
          strongAccepted: false,
          method,
          acceptedReason: clickRes.code || 'click-failed',
          code: clickRes.code || 'submit_click_failed',
          error: clickRes.error || 'Không click được nút submit.',
          preClickGuard: guard,
          clickResult: clickRes,
          debug: { lastGuard, lastResult },
        };
      }
      continue;
    }

    const accepted = await waitSubmitAcceptedAfterPageClick(tabId, {
      feature,
      sceneId,
      beforeSnapshot,
      timeoutMs: timeoutPerMethodMs,
      pollMs: options.pollMs || 250,
    });
    addLog(logEl, `[Submit accepted] accepted=${accepted.accepted ? 'yes' : 'no'} reason=${accepted.reason || 'no-submit-signal'} method=${method}.`, accepted.accepted ? 'ok' : 'warn');
    if (accepted.accepted && accepted.strongAccepted) {
      return {
        ok: true,
        payloadOk: true,
        clicked: true,
        accepted: true,
        strongAccepted: true,
        method,
        acceptedReason: accepted.reason,
        code: null,
        error: null,
        preClickGuard: guard,
        clickResult: clickRes,
        acceptedCheck: accepted,
        debug: { lastGuard: guard, lastResult: clickRes },
      };
    }
  }

  return {
    ok: false,
    payloadOk: !!lastGuard?.ok,
    clicked,
    accepted: false,
    strongAccepted: false,
    method: lastResult?.method || methods[methods.length - 1],
    acceptedReason: 'no-submit-signal',
    code: 'submit_not_accepted',
    error: 'Đã thử tất cả submit methods không dùng debugger nhưng Grok không nhận job.',
    preClickGuard: lastGuard,
    clickResult: lastResult,
    debug: { lastGuard, lastResult },
  };
}

function debuggerAttachAsync(target, version = '1.3') {
  return new Promise((resolve, reject) => {
    if (!chrome?.debugger?.attach) {
      reject(new Error('Extension chưa có quyền chrome.debugger để auto submit bằng native click.'));
      return;
    }
    chrome.debugger.attach(target, version, () => {
      const err = chrome.runtime?.lastError;
      if (err) reject(new Error(err.message || String(err)));
      else resolve(true);
    });
  });
}

function debuggerSendCommandAsync(target, command, params = {}) {
  return new Promise((resolve, reject) => {
    if (!chrome?.debugger?.sendCommand) {
      reject(new Error('chrome.debugger.sendCommand unavailable'));
      return;
    }
    chrome.debugger.sendCommand(target, command, params, (result) => {
      const err = chrome.runtime?.lastError;
      if (err) reject(new Error(err.message || String(err)));
      else resolve(result);
    });
  });
}

function debuggerDetachAsync(target) {
  return new Promise((resolve, reject) => {
    if (!chrome?.debugger?.detach) {
      resolve(false);
      return;
    }
    chrome.debugger.detach(target, () => {
      const err = chrome.runtime?.lastError;
      if (err) reject(new Error(err.message || String(err)));
      else resolve(true);
    });
  });
}

async function findSubmitButtonCenterInPage(tabId, options = {}) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (opts = {}) => {
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const isVisible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
        };
        const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
        const rectSummary = (el) => {
          const r = el?.getBoundingClientRect?.() || {};
          return {
            x: Math.round(r.left || 0),
            y: Math.round(r.top || 0),
            w: Math.round(r.width || 0),
            h: Math.round(r.height || 0),
            right: Math.round(r.right || 0),
            bottom: Math.round(r.bottom || 0),
          };
        };
        const compactText = (el) => String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const findGrokBottomComposerRoot = () => {
          const selectors = [
            'textarea[placeholder*="Type to imagine" i]',
            'textarea[placeholder*="Imagine" i]',
            'textarea[placeholder*="Describe" i]',
            'textarea[placeholder*="Enter" i]',
            'input[placeholder*="Imagine" i]',
            'input[placeholder*="Describe" i]',
            'input[placeholder*="Enter" i]',
            'div[contenteditable="true"][data-lexical-editor]',
            'div[contenteditable="true"]',
            'textarea',
            'input',
          ].join(',');
          const inputScopes = Array.from(document.querySelectorAll(selectors))
            .filter(input => isVisible(input) && !isBlocked(input))
            .map(input => {
              let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
              if (!root) {
                let node = input.parentElement;
                for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                  if (node.querySelector('button,[role="button"],label,input[type="file"]')) { root = node; break; }
                }
              }
              if (!root || root === document.body || isBlocked(root)) return null;
              const inputRect = input.getBoundingClientRect();
              const rootRect = root.getBoundingClientRect();
              return (inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75)
                ? { input, root, inputRect, rootRect, source: 'editor' }
                : null;
            })
            .filter(Boolean);
          const containerScopes = Array.from(document.querySelectorAll('form,section,div'))
            .filter(root => {
              if (!isVisible(root) || isBlocked(root) || root === document.body) return false;
              const r = root.getBoundingClientRect();
              if (r.width < 280 || r.height < 80 || r.height > window.innerHeight * 0.75) return false;
              if (r.bottom < window.innerHeight * 0.55) return false;
              const text = compactText(root);
              const hasEditor = !!root.querySelector('[data-testid="chat-input"] [contenteditable="true"],.ProseMirror[contenteditable="true"],div[contenteditable="true"],textarea,input');
              const hasSubmit = !!root.querySelector('button[type="submit"],button[aria-label*="submit" i],[role="button"][aria-label*="submit" i]');
              const hasControls = /(image|video|480p|720p|6s|10s|9:16|16:9|aspect)/i.test(text);
              return hasEditor && (hasSubmit || hasControls);
            })
            .map(root => {
              const rootRect = root.getBoundingClientRect();
              const input = root.querySelector('[data-testid="chat-input"] [contenteditable="true"],.ProseMirror[contenteditable="true"],div[contenteditable="true"],textarea,input');
              const inputRect = input?.getBoundingClientRect?.() || rootRect;
              return { input, root, inputRect, rootRect, source: 'container' };
            });
          return [...inputScopes, ...containerScopes]
            .map(scope => {
              const text = compactText(scope.root);
              const hasSubmit = !!scope.root.querySelector('button[type="submit"],button[aria-label*="submit" i],[role="button"][aria-label*="submit" i]');
              const hasControls = /(image|video|480p|720p|6s|10s|9:16|16:9|aspect)/i.test(text);
              const area = Math.max(1, scope.rootRect.width * scope.rootRect.height);
              return {
                ...scope,
                text,
                score: (scope.rootRect.bottom / Math.max(1, window.innerHeight)) * 100
                  + (hasSubmit ? 180 : 0)
                  + (hasControls ? 80 : 0)
                  + (scope.source === 'container' ? 20 : 0)
                  - (area > window.innerWidth * window.innerHeight * 0.65 ? 160 : 0),
              };
            })
            .sort((a, b) => b.score - a.score || b.rootRect.bottom - a.rootRect.bottom)[0] || null;
        };
        const isEnabled = (btn) => btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true' && !btn.closest('[aria-disabled="true"]');
        const buttonText = (btn) => [btn?.getAttribute?.('aria-label'), btn?.getAttribute?.('title'), btn?.getAttribute?.('data-testid'), btn?.textContent, btn?.getAttribute?.('type')].filter(Boolean).join(' ').toLowerCase();
        const getSubmitButtonCandidates = (scope) => {
          const rootRect = scope.root.getBoundingClientRect();
          return Array.from(scope.root.querySelectorAll('button,[role="button"],button[type="submit"]'))
            .filter(btn => isVisible(btn) && !isBlocked(btn))
            .map((btn) => {
              const r = btn.getBoundingClientRect();
              const text = buttonText(btn);
              const type = btn.getAttribute?.('type') || '';
              const aria = btn.getAttribute?.('aria-label') || '';
              const role = btn.getAttribute?.('role') || '';
              const svg = !!btn.querySelector('svg');
              const rightSide = r.right > rootRect.right - 180;
              const bottomSide = r.bottom > rootRect.bottom - 120;
              const queryBar = !!btn.closest('[data-testid*="query" i],[data-testid*="composer" i],[class*="query" i],[class*="composer" i],[class*="toolbar" i]');
              const positive = /\b(send|submit|generate|create|grok)\b/.test(text)
                || /send|submit|generate/i.test(aria)
                || type.toLowerCase() === 'submit'
                || (rightSide && svg);
              const negative = /\b(attach|upload|photo|file|remove|delete|close|clear|cancel|mic|voice|menu|option|more|edit|aspect|saved|canvas|agent|beta|480p|720p|6s|10s|9:16|16:9)\b/.test(text)
                || role === 'radio';
              const disabled = !isEnabled(btn);
              return {
                btn,
                text,
                type,
                aria,
                role,
                disabled,
                svg,
                rightSide,
                bottomSide,
                queryBar,
                rect: rectSummary(btn),
                score: (positive ? 120 : 0)
                  + (type.toLowerCase() === 'submit' ? 300 : 0)
                  + (/submit/i.test(aria) ? 250 : 0)
                  + (queryBar ? 200 : 0)
                  + (rightSide ? 150 : 0)
                  + (svg ? 100 : 0)
                  + (bottomSide ? 30 : 0)
                  - (negative ? 300 : 0)
                  - (disabled ? 300 : 0),
              };
            })
            .sort((a, b) => b.score - a.score || b.rect.right - a.rect.right);
        };
        const hitInfo = (el) => {
          const text = [el?.textContent, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title'), el?.getAttribute?.('type'), el?.className].filter(Boolean).join(' ');
          return {
            tag: el?.tagName || '',
            text: String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120),
            aria: el?.getAttribute?.('aria-label') || '',
            type: el?.getAttribute?.('type') || '',
            className: String(el?.className || '').slice(0, 120),
          };
        };
        const pickHitPoint = (button) => {
          const r = button.getBoundingClientRect();
          const points = [
            { name: 'center', x: r.left + r.width / 2, y: r.top + r.height / 2 },
            { name: 'right-inner', x: r.right - Math.min(8, Math.max(2, r.width / 4)), y: r.top + r.height / 2 },
            { name: 'left-inner', x: r.left + Math.min(8, Math.max(2, r.width / 4)), y: r.top + r.height / 2 },
          ];
          const tests = points.map(point => {
            const x = Math.round(point.x);
            const y = Math.round(point.y);
            const inViewport = x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight;
            const hit = inViewport ? document.elementFromPoint(x, y) : null;
            const hitInsideButton = !!hit && (hit === button || button.contains(hit));
            return { ...point, x, y, inViewport, hitInsideButton, hit: hitInfo(hit) };
          });
          return { tests, selected: tests.find(t => t.inViewport && t.hitInsideButton) || null };
        };

        const scope = findGrokBottomComposerRoot();
        if (!scope) return { ok: false, code: 'composer_not_found', error: 'Bottom composer not found', buttonFound: false };
        const candidates = getSubmitButtonCandidates(scope);
        const candidate = candidates.find(item => item.score > 0 && !item.disabled);
        if (!candidate?.btn) {
          return {
            ok: false,
            code: 'submit_button_not_found',
            error: 'Không tìm thấy nút submit trong bottom composer.',
            buttonFound: false,
            composerRootRect: rectSummary(scope.root),
            rootTextCompact: scope.text?.slice(0, 240) || compactText(scope.root).slice(0, 240),
            buttonCandidates: candidates.slice(0, 8).map(item => ({ text: item.text, aria: item.aria, type: item.type, role: item.role, disabled: item.disabled, score: item.score, rect: item.rect, svg: item.svg, rightSide: item.rightSide })),
          };
        }
        if (!isEnabled(candidate.btn)) {
          return { ok: false, code: 'submit_button_disabled', error: 'Nút submit đang disabled.', buttonFound: true, buttonDisabled: true };
        }
        const beforeScrollRect = rectSummary(candidate.btn);
        candidate.btn.scrollIntoView({ block: 'center', inline: 'center' });
        await sleep(200);
        const r = candidate.btn.getBoundingClientRect();
        const hit = pickHitPoint(candidate.btn);
        if (!hit.selected) {
          return {
            ok: false,
            code: 'submit_hit_test_failed',
            error: 'Không có tọa độ nào trúng nút submit thật.',
            buttonFound: true,
            buttonDisabled: false,
            composerRootRect: rectSummary(scope.root),
            rootTextCompact: scope.text?.slice(0, 240) || compactText(scope.root).slice(0, 240),
            beforeScrollRect,
            afterScrollRect: rectSummary(candidate.btn),
            viewport: { innerWidth: window.innerWidth, innerHeight: window.innerHeight, dpr: window.devicePixelRatio || 1 },
            hitTests: hit.tests,
            selectedButton: { text: candidate.text, aria: candidate.aria, type: candidate.type, score: candidate.score, rect: rectSummary(candidate.btn) },
            buttonCandidates: candidates.slice(0, 8).map(item => ({ text: item.text, aria: item.aria, type: item.type, role: item.role, disabled: item.disabled, score: item.score, rect: item.rect, svg: item.svg, rightSide: item.rightSide })),
          };
        }
        return {
          ok: true,
          buttonFound: true,
          buttonDisabled: false,
          x: hit.selected.x,
          y: hit.selected.y,
          buttonCenter: { x: hit.selected.x, y: hit.selected.y },
          hitInsideButton: true,
          hitPoint: hit.selected.name,
          hitTests: hit.tests,
          composerRootRect: rectSummary(scope.root),
          rootTextCompact: scope.text?.slice(0, 240) || compactText(scope.root).slice(0, 240),
          beforeScrollRect,
          afterScrollRect: rectSummary(candidate.btn),
          viewport: { innerWidth: window.innerWidth, innerHeight: window.innerHeight, dpr: window.devicePixelRatio || 1 },
          selectedButton: { text: candidate.text, aria: candidate.aria, type: candidate.type, score: candidate.score, rect: rectSummary(candidate.btn) },
          buttonCandidates: candidates.slice(0, 8).map(item => ({ text: item.text, aria: item.aria, type: item.type, role: item.role, disabled: item.disabled, score: item.score, rect: item.rect, svg: item.svg, rightSide: item.rightSide })),
          feature: opts.feature || '',
          sceneId: String(opts.sceneId || ''),
        };
      },
      args: [{ feature: options.feature || '', sceneId: options.sceneId || '', scope: options.scope || 'bottomComposer' }],
    });
    return result?.[0]?.result || { ok: false, code: 'submit_button_lookup_failed', error: 'Không lấy được vị trí nút submit.' };
  } catch (e) {
    return { ok: false, code: 'submit_button_lookup_failed', error: e?.message || String(e) };
  }
}

function getTabZoomAsync(tabId) {
  return new Promise(resolve => {
    try {
      chrome.tabs.getZoom(tabId, zoom => {
        const err = chrome.runtime?.lastError;
        resolve(err ? 1 : Number(zoom || 1));
      });
    } catch {
      resolve(1);
    }
  });
}

function setTabZoomAsync(tabId, zoomFactor) {
  return new Promise(resolve => {
    try {
      chrome.tabs.setZoom(tabId, zoomFactor, () => resolve(!chrome.runtime?.lastError));
    } catch {
      resolve(false);
    }
  });
}

async function findSubmitButtonCenterForGrok(tabId, options = {}) {
  const oldZoom = await getTabZoomAsync(tabId);
  const zoomCandidates = Array.isArray(options.zoomCandidates) && options.zoomCandidates.length
    ? options.zoomCandidates
    : [oldZoom || 1, 0.8, 0.67];
  const tried = [];
  let currentZoom = oldZoom || 1;
  for (const rawZoom of zoomCandidates) {
    const zoom = Math.max(0.25, Math.min(5, Number(rawZoom || 1)));
    if (Math.abs(zoom - currentZoom) > 0.01) {
      await setTabZoomAsync(tabId, zoom);
      currentZoom = zoom;
      await sleep(500);
    }
    const res = await findSubmitButtonCenterInPage(tabId, options);
    tried.push({ zoom, ok: res.ok, code: res.code, x: res.x, y: res.y, hitPoint: res.hitPoint, viewport: res.viewport });
    if (res.ok) {
      return { ...res, oldZoom, appliedZoom: zoom, zoomTried: tried, shouldRestoreZoom: Math.abs(zoom - oldZoom) > 0.01 };
    }
  }
  return {
    ok: false,
    code: 'submit_button_center_not_found',
    error: 'Không tìm được tọa độ submit hợp lệ sau khi thử scroll/zoom.',
    oldZoom,
    appliedZoom: currentZoom,
    shouldRestoreZoom: Math.abs(Number(currentZoom || 1) - Number(oldZoom || 1)) > 0.01,
    zoomTried: tried,
  };
}

async function focusFilmComposerBeforeSubmitLookup(tabId, options = {}) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const isVisible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
        };
        const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
        const candidates = Array.from(document.querySelectorAll('[data-testid="chat-input"] [contenteditable="true"],.ProseMirror[contenteditable="true"],div[contenteditable="true"],textarea,input'))
          .filter(el => isVisible(el) && !isBlocked(el))
          .map(el => {
            const r = el.getBoundingClientRect();
            let root = el.closest('form') || el.closest('[data-testid*="composer" i],[class*="composer" i],[class*="query" i]');
            if (!root) {
              let node = el.parentElement;
              for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                if (node.querySelector('button,[role="button"],label,input[type="file"]')) { root = node; break; }
              }
            }
            const rr = root?.getBoundingClientRect?.() || r;
            return { el, rect: r, rootRect: rr, score: rr.bottom + (r.top > window.innerHeight * 0.45 ? 300 : 0) };
          })
          .sort((a, b) => b.score - a.score);
        const item = candidates[0];
        if (!item?.el) return { ok: false, code: 'film_editor_not_found_for_focus' };
        item.el.scrollIntoView({ block: 'center', inline: 'center' });
        item.el.focus();
        try { item.el.click(); } catch {}
        try { item.el.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
        return {
          ok: true,
          rect: {
            x: Math.round(item.rect.left),
            y: Math.round(item.rect.top),
            w: Math.round(item.rect.width),
            h: Math.round(item.rect.height),
          },
        };
      },
      args: [{ sceneId: options.sceneId || '' }],
    });
    return result?.[0]?.result || { ok: false, code: 'film_focus_script_failed' };
  } catch (e) {
    return { ok: false, code: 'film_focus_script_failed', error: e?.message || String(e) };
  }
}

async function findFilmSubmitButtonState(tabId, options = {}) {
  const logEl = options.logEl || sfLogEl;
  const sceneId = options.sceneId || '';
  const lookup = async (label) => {
    const res = await findSubmitButtonCenterForGrok(tabId, {
      feature: options.feature || 'Film',
      sceneId,
      scope: options.scope || 'currentComposer',
      autoZoom: true,
      zoomCandidates: options.zoomCandidates || undefined,
      forceRecompute: true,
    });
    if (res.shouldRestoreZoom && Number.isFinite(Number(res.oldZoom))) {
      await setTabZoomAsync(tabId, Number(res.oldZoom));
    }
    return { ...res, lookupLabel: label };
  };

  let state = await lookup('initial');
  if (!state.ok) {
    addLog(logEl, '[SF ready] button chưa thấy, focus composer và tìm lại.', 'warn');
    await focusFilmComposerBeforeSubmitLookup(tabId, { sceneId });
    await sleep(300);
    state = await lookup('after-focus');
    addLog(logEl, `[SF ready] sau focus: button=${state.ok ? 'yes' : 'no'}.`, state.ok ? 'info' : 'warn');
  }

  const buttonFound = state.ok === true && state.buttonFound !== false;
  return {
    ok: buttonFound && state.buttonDisabled !== true,
    buttonFound,
    buttonDisabled: state.buttonDisabled === true,
    buttonCenter: state.buttonCenter || (Number.isFinite(Number(state.x)) && Number.isFinite(Number(state.y)) ? { x: state.x, y: state.y } : null),
    composerFound: state.code !== 'composer_not_found',
    composerType: state.rootTextCompact && /480p|720p|6s|10s|9:16|16:9|aspect/i.test(state.rootTextCompact) ? 'imagine-composer' : 'post-composer',
    selectedButton: state.selectedButton,
    candidates: state.buttonCandidates || [],
    buttonCandidates: state.buttonCandidates || [],
    hitInsideButton: state.hitInsideButton === true,
    reason: state.code || (buttonFound ? 'button-found' : 'button-not-found'),
    raw: state,
  };
}

async function clickSubmitButtonWithCDP(tabId, options = {}) {
  const target = { tabId };
  let attached = false;
  let x = null;
  let y = null;
  let center = null;
  const feature = options.feature || '';
  const sceneId = String(options.sceneId || '');
  const logEl = String(feature).toLowerCase().includes('film') ? sfLogEl : i2vLogEl;
  try {
    if (!chrome?.debugger?.attach || !chrome?.debugger?.sendCommand) {
      return {
        ok: false,
        clicked: false,
        method: 'cdp-input-dispatch',
        code: 'debugger_permission_missing',
        error: 'Extension chưa có quyền chrome.debugger để auto submit bằng native click.',
      };
    }

    try {
      await debuggerAttachAsync(target, '1.3');
      attached = true;
    } catch (attachErr) {
      const msg = attachErr?.message || String(attachErr);
      if (/already attached|Another debugger|debugger is already attached/i.test(msg)) {
        try { await debuggerDetachAsync(target); } catch {}
        await sleep(120);
        await debuggerAttachAsync(target, '1.3');
        attached = true;
      } else {
        throw attachErr;
      }
    }

    addLog(logEl, '[Submit CDP] debugger attached, waiting layout settle...', 'info');
    await sleep(Number(options.attachSettleMs || 500));
    addLog(logEl, '[Submit CDP] recompute button after debugger attach.', 'info');
    center = await findSubmitButtonCenterForGrok(tabId, {
      ...options,
      forceRecompute: true,
      autoZoom: true,
    });
    if (!center.ok) {
      return {
        ...center,
        ok: false,
        clicked: false,
        method: 'cdp-input-dispatch',
        code: center.code === 'submit_hit_test_failed' ? 'cdp_hit_test_failed' : (center.code || 'submit_button_center_missing'),
        error: center.error || 'Không lấy được tọa độ nút submit sau khi attach debugger.',
      };
    }
    x = Number(center.x ?? center.buttonCenter?.x);
    y = Number(center.y ?? center.buttonCenter?.y);
    const viewport = center.viewport || {};
    addLog(logEl, `[Submit CDP] viewport after attach innerWidth=${viewport.innerWidth ?? 'n/a'} innerHeight=${viewport.innerHeight ?? 'n/a'}.`, 'info');
    addLog(logEl, `[Submit CDP] submit button rect after attach x=${center.afterScrollRect?.x ?? center.selectedButton?.rect?.x ?? 'n/a'} y=${center.afterScrollRect?.y ?? center.selectedButton?.rect?.y ?? 'n/a'} w=${center.afterScrollRect?.w ?? center.selectedButton?.rect?.w ?? 'n/a'} h=${center.afterScrollRect?.h ?? center.selectedButton?.rect?.h ?? 'n/a'}.`, 'info');
    addLog(logEl, `[Submit CDP] hitInsideButton=${center.hitInsideButton ? 'yes' : 'no'} point=${center.hitPoint || 'n/a'}.`, center.hitInsideButton ? 'info' : 'err');
    if (!Number.isFinite(x) || !Number.isFinite(y) || center.hitInsideButton !== true) {
      return {
        ok: false,
        clicked: false,
        method: 'cdp-input-dispatch',
        x: Number.isFinite(x) ? x : null,
        y: Number.isFinite(y) ? y : null,
        code: 'cdp_hit_test_failed',
        error: 'Hit-test sau khi attach debugger không trúng nút submit thật.',
        center,
      };
    }

    await debuggerSendCommandAsync(target, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await sleep(80);
    await debuggerSendCommandAsync(target, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(100);
    await debuggerSendCommandAsync(target, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    return {
      ok: true,
      clicked: true,
      method: 'cdp-input-dispatch',
      x,
      y,
      feature,
      sceneId,
      center,
      buttonCenter: center.buttonCenter,
      buttonCandidates: center.buttonCandidates,
      hitInsideButton: center.hitInsideButton === true,
      hitPoint: center.hitPoint,
    };
  } catch (err) {
    return {
      ok: false,
      clicked: false,
      method: 'cdp-input-dispatch',
      x: Number.isFinite(x) ? x : null,
      y: Number.isFinite(y) ? y : null,
      code: /debugger/i.test(err?.message || '') ? 'debugger_permission_missing' : 'cdp_click_failed',
      error: err?.message || String(err),
      center,
    };
  } finally {
    if (attached) {
      try { await debuggerDetachAsync(target); } catch {}
    }
    if (center?.shouldRestoreZoom && Number.isFinite(Number(center.oldZoom))) {
      await setTabZoomAsync(tabId, Number(center.oldZoom));
    }
  }
}

async function submitComposerWithCDPAndAccepted(tabId, options = {}) {
  const feature = options.feature || 'Submit';
  const isFilm = String(feature).toLowerCase().includes('film');
  const sceneId = options.sceneId || '';
  const logEl = isFilm ? sfLogEl : i2vLogEl;
  const sceneLabel = isFilm ? `Cảnh ${sceneId || ''}`.trim() : (options.displayName || `Cảnh ${sceneId || ''}`.trim());
  const requireImage = options.requireImage === true;
  const minImages = Math.max(1, Number(options.minImages || 1));
  const minTextChars = Math.max(1, Number(options.minTextChars || 20));
  const guard = await verifyComposerPayload(tabId, options.expectedText || '', {
    scope: options.scope || 'bottomComposer',
    requireText: options.requireText !== false,
    requireImage,
    minImages,
    minTextChars,
    timeoutMs: options.payloadTimeoutMs || 3000,
    stableMs: options.payloadStableMs || 300,
    expectedSceneId: sceneId,
  });
  const editorTextLen = guard.editorTextLength ?? guard.composerTextLength ?? guard.textLen ?? 0;
  const imageCount = guard.imageCount ?? guard.count ?? 0;
  if (!guard.ok) {
    const textMissing = guard.code === 'text_missing' || editorTextLen < minTextChars;
    const imageMissing = requireImage && imageCount < minImages;
    return {
      ok: false,
      payloadOk: false,
      clicked: false,
      accepted: false,
      strongAccepted: false,
      method: 'cdp-input-dispatch',
      acceptedReason: 'payload-missing',
      code: textMissing ? 'text_missing_before_cdp_submit' : imageMissing ? 'image_missing_before_cdp_submit' : (guard.code || 'payload_missing_before_cdp_submit'),
      error: textMissing ? 'Prompt chưa sẵn sàng ngay trước CDP submit.' : imageMissing ? 'Thiếu ảnh tham chiếu ngay trước CDP submit.' : (guard.error || 'Payload chưa sẵn sàng trước CDP submit.'),
      preClickGuard: guard,
    };
  }

  addLog(logEl, `[Submit CDP] ${feature} ${sceneLabel} payload OK editorTextLen=${editorTextLen} imageCount=${imageCount}.`, 'info');
  let cdpClick;
  let accepted;
  try {
    const beforeSnapshot = await getSubmitAcceptedSnapshot(tabId, { feature, sceneId });
    cdpClick = await clickSubmitButtonWithCDP(tabId, {
      feature,
      sceneId,
      scope: options.scope || 'bottomComposer',
      zoomCandidates: options.zoomCandidates || undefined,
    });
    addLog(logEl, `[Submit CDP] ${cdpClick.ok ? 'dispatch native click' : 'FAIL'} x=${cdpClick.x ?? 'n/a'} y=${cdpClick.y ?? 'n/a'}.`, cdpClick.ok ? 'info' : 'err');
    if (!cdpClick.ok || !cdpClick.clicked) {
      if (cdpClick.code === 'debugger_permission_missing' || cdpClick.code === 'debugger_api_unavailable') {
        addLog(logEl, '[Submit CDP] Chrome Debugger API không khả dụng. Cần permission "debugger" trong manifest.', 'err');
      }
      return {
        ok: false,
        payloadOk: true,
        clicked: false,
        accepted: false,
        strongAccepted: false,
        method: 'cdp-input-dispatch',
        acceptedReason: cdpClick.code || 'cdp-click-failed',
        code: cdpClick.code || 'cdp_click_failed',
        error: cdpClick.error || 'Không click native bằng CDP được.',
        preClickGuard: guard,
        cdpClick,
        buttonCenter: cdpClick.buttonCenter,
        buttonCandidates: cdpClick.buttonCandidates,
        debug: { center: cdpClick.center },
      };
    }

    accepted = await waitSubmitAcceptedAfterPageClick(tabId, {
      feature,
      sceneId,
      beforeSnapshot,
      timeoutMs: options.timeoutMs || 10000,
      pollMs: options.pollMs || 250,
    });
    addLog(logEl, `[Submit CDP accepted] accepted=${accepted.accepted ? 'yes' : 'no'} reason=${accepted.reason || 'no-submit-signal'}.`, accepted.accepted ? 'ok' : 'err');
    if (isFilm && Number(accepted.signals?.deltaFilmBlocked || 0) > 0) {
      return {
        ok: false,
        payloadOk: true,
        clicked: true,
        accepted: false,
        strongAccepted: false,
        acceptedReason: 'film-gate-blocked',
        method: 'cdp-input-dispatch',
        code: 'film_submit_blocked_by_gate',
        error: 'Film gate vẫn chặn submit click hợp lệ.',
        preClickGuard: guard,
        cdpClick,
        acceptedCheck: accepted,
        buttonCenter: cdpClick.buttonCenter,
        buttonCandidates: cdpClick.buttonCandidates,
        debug: { center: cdpClick.center, accepted },
      };
    }
    const ok = accepted.accepted === true && accepted.strongAccepted === true;
    return {
      ok,
      payloadOk: true,
      clicked: true,
      accepted: accepted.accepted === true,
      strongAccepted: accepted.strongAccepted === true,
      acceptedReason: accepted.reason || 'no-submit-signal',
      method: 'cdp-input-dispatch',
      code: ok ? null : 'submit_not_accepted',
      error: ok ? null : 'Đã click native bằng CDP nhưng chưa phát hiện Grok nhận job.',
      preClickGuard: guard,
      cdpClick,
      acceptedCheck: accepted,
      buttonCenter: cdpClick.buttonCenter,
      buttonCandidates: cdpClick.buttonCandidates,
      debug: { center: cdpClick.center, accepted },
    };
  } catch (err) {
    return {
      ok: false,
      payloadOk: true,
      clicked: !!cdpClick?.clicked,
      accepted: false,
      strongAccepted: false,
      method: 'cdp-input-dispatch',
      acceptedReason: 'cdp-submit-exception',
      code: 'cdp_submit_exception',
      error: err?.message || String(err),
      preClickGuard: guard,
      cdpClick,
      acceptedCheck: accepted,
      debug: { center: cdpClick?.center, accepted },
    };
  }
}

async function submitShortFilmAtomically(tabId, scene, fullPrompt, options = {}) {
  const sceneId = String(scene?.id || options.sceneId || '');
  const requireImage = options.requireImage === true;
  const minTextChars = Math.max(1, Number(options.minTextChars || 20));
  const minImages = Math.max(1, Number(options.minImages || 1));
  if (options.filmRuntime) {
    const runtimePhase = getFilmScenePhase(options.filmRuntime, sceneId);
    if (runtimePhase !== 'submit_inflight') {
      addLog(sfLogEl, `[Film submit lock] Chặn submit cho scene ${sceneId}: phase hiện tại là ${runtimePhase}, không phải submit_inflight.`, 'err');
      return {
        ok: false,
        code: 'film_submit_lock_not_held',
        error: 'Film atomic submit chỉ được chạy khi scene đã giữ submit lock.',
        clicked: false,
        accepted: false,
        phase: runtimePhase,
      };
    }
  }
  addLog(sfLogEl, `[SF atomic submit] sceneId=${sceneId} kiểm tra text + ảnh trong cùng composer.`, 'info');
  const preClickGuard = await verifyComposerPayload(tabId, fullPrompt, {
    scope: 'bottomComposer',
    requireText: true,
    requireImage,
    minImages,
    minTextChars,
    timeoutMs: 3000,
    stableMs: 500,
    expectedSceneId: sceneId,
  });
  if (!preClickGuard.ok) {
    return { ok: false, code: preClickGuard.code || 'preclick_payload_missing', error: preClickGuard.error || 'Payload chưa đủ ngay trước submit.', preClickGuard };
  }

  await setFilmEarlySubmitShieldPhase(tabId, sceneId, 'open_for_atomic_submit');
  let result;
  try {
    result = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (opts) => {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      const expectedText = String(opts.expectedText || '');
      const minTextChars = Math.max(1, Number(opts.minTextChars || 20));
      const minImages = Math.max(1, Number(opts.minImages || 1));
      const requireImage = opts.requireImage === true;
      const acceptTimeoutMs = Math.max(3000, Number(opts.acceptTimeoutMs || 12000));
      const normalizeText = (text) => String(text || '').replace(/\s+/g, ' ').trim();
      const normalizePromptText = (text) => normalizeText(text).toLowerCase();
      const promptMatchesEditor = (editorText, expected) => {
        const a = normalizePromptText(editorText);
        const b = normalizePromptText(expected);
        if (!a || !b || a.length < minTextChars) return false;
        if (a === b) return true;
        const bPrefix = b.slice(0, Math.min(120, b.length));
        const aPrefix = a.slice(0, Math.min(120, a.length));
        if (bPrefix.length >= 30 && a.includes(bPrefix)) return true;
        if (a.length > 80 && aPrefix.length >= 30 && b.includes(aPrefix)) return true;
        return false;
      };
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
      const findBottomComposerScope = () => {
        const selectors = [
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'input[placeholder*="Imagine" i]',
          'input[placeholder*="Describe" i]',
          'input[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
          'input',
        ].join(',');
        return Array.from(document.querySelectorAll(selectors))
          .filter(input => isVisible(input) && !isBlocked(input))
          .map(input => {
            let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
            if (!root) {
              let node = input.parentElement;
              for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                if (node.querySelector('button,[role="button"],label,input[type="file"]')) { root = node; break; }
              }
            }
            if (!root || root === document.body || isBlocked(root)) return null;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
            return isBottom ? { input, root, inputRect, rootRect } : null;
          })
          .filter(Boolean)
          .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
      };
      const findActualComposerEditor = (scope) => {
        const selectors = [
          '[data-testid="chat-input"] div[contenteditable="true"]',
          '[data-testid="chat-input"] [contenteditable="true"]',
          'div[contenteditable="true"].ProseMirror',
          'div[contenteditable="true"][translate="no"]',
          'div[contenteditable="true"]',
          'textarea',
          'input',
        ];
        return Array.from(scope.root.querySelectorAll(selectors.join(',')))
          .filter(el => scope.root.contains(el) && isVisible(el) && !isBlocked(el))
          .map(el => {
            const r = el.getBoundingClientRect();
            return {
              el,
              score: (el.closest('[data-testid="chat-input"]') ? 100 : 0)
                + (String(el.className || '').includes('ProseMirror') ? 80 : 0)
                + (el.isContentEditable ? 40 : 0)
                + Math.round(r.bottom / 100),
            };
          })
          .sort((a, b) => b.score - a.score)[0]?.el || scope.input || null;
      };
      const getEditorText = (editor) => {
        if (!editor) return '';
        if ('value' in editor) return normalizeText(editor.value || '');
        return normalizeText(editor.innerText || editor.textContent || '');
      };
      const dispatchTextEvents = (editor, text) => {
        try { editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: text })); } catch {}
        try { editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text })); }
        catch { editor.dispatchEvent(new Event('input', { bubbles: true })); }
        editor.dispatchEvent(new Event('change', { bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
      };
      const setEditorTextLikeUser = (editor, text) => {
        editor.focus();
        if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
          const proto = editor.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(editor, text); else editor.value = text;
          dispatchTextEvents(editor, text);
          return;
        }
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection.removeAllRanges();
        selection.addRange(range);
        range.deleteContents();
        let inserted = false;
        try { inserted = document.execCommand('insertText', false, text); } catch { inserted = false; }
        dispatchTextEvents(editor, text);
        if (!inserted || !promptMatchesEditor(getEditorText(editor), text)) {
          editor.textContent = text;
          dispatchTextEvents(editor, text);
        }
      };
      const countImages = (scope) => {
        const selectors = [
          'img[src^="blob:"]',
          'img[src^="data:"]',
          '[class*="thumb" i]',
          '[class*="preview" i]',
          '[class*="attachment" i]',
          '[aria-label*="image" i]',
          '[aria-label*="file" i]',
        ].join(',');
        const seen = new Set();
        for (const el of Array.from(scope.root.querySelectorAll(selectors))) {
          if (!scope.root.contains(el) || isBlocked(el) || !isVisible(el)) continue;
          seen.add(el);
        }
        return seen.size;
      };
      const isEnabled = (btn) => btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true' && !btn.closest('[aria-disabled="true"]');
      const buttonText = (btn) => [btn?.getAttribute?.('aria-label'), btn?.getAttribute?.('title'), btn?.getAttribute?.('data-testid'), btn?.textContent].filter(Boolean).join(' ').toLowerCase();
      const getSubmitButtonCandidates = (scope) => {
        const rootRect = scope.root.getBoundingClientRect();
        return Array.from(scope.root.querySelectorAll('button,[role="button"],button[type="submit"]'))
          .filter(btn => isVisible(btn) && !isBlocked(btn))
          .map((btn, idx) => {
            const r = btn.getBoundingClientRect();
            const text = buttonText(btn);
            const type = btn.getAttribute?.('type') || '';
            const svg = !!btn.querySelector('svg');
            const rightSide = r.right > rootRect.right - 180;
            const bottomSide = r.bottom > rootRect.bottom - 120;
            const positive = /\b(send|submit|generate|create|grok)\b/.test(text)
              || /send|submit|generate/i.test(btn.getAttribute?.('aria-label') || '')
              || type.toLowerCase() === 'submit'
              || (rightSide && svg);
            const negative = /\b(attach|upload|image|photo|file|remove|delete|close|clear|cancel|mic|voice|menu|option|more|edit)\b/.test(text);
            const disabled = !isEnabled(btn);
            return {
              btn, idx, text, type, disabled, svg, rightSide, bottomSide,
              rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) },
              score: (positive ? 100 : 0) + (type.toLowerCase() === 'submit' ? 60 : 0) + (rightSide ? 25 : 0) + (bottomSide ? 10 : 0) + (svg ? 10 : 0) - (negative ? 120 : 0) - (disabled ? 80 : 0),
            };
          })
          .sort((a, b) => b.score - a.score || b.rect.right - a.rect.right);
      };
      const findSubmitButton = (scope) => {
        const candidate = getSubmitButtonCandidates(scope).find(item => item.score > 0 && !item.disabled);
        return candidate?.btn || null;
      };
      const countVisible = (selector) => Array.from(document.querySelectorAll(selector)).filter(isVisible).length;
      const inspectAccepted = (scope, editor, button, before) => {
        const editorText = getEditorText(editor);
        const rootText = normalizeText(scope.root.innerText || scope.root.textContent || '');
        const hay = normalizeText(document.body.innerText || document.body.textContent || '').toLowerCase();
        const loading = !!document.querySelector('[aria-busy="true"],[class*="loading" i],[class*="generating" i],[class*="pending" i],[class*="skeleton" i],[role="progressbar"]')
          || /\b(generating|creating|preparing|đang tạo|đang chuẩn bị)\b/i.test(hay);
        const buttonDisabled = !isEnabled(button);
        const composerCleared = before.text.length >= minTextChars && editorText.length < Math.min(10, before.text.length);
        const urlChanged = String(location.href || '') !== String(before.url || '');
        const generatingCards = countVisible('article,[class*="post" i],[class*="result" i],[class*="progress" i],[class*="generating" i],[role="progressbar"]');
        const mediaPlaceholders = countVisible('[class*="placeholder" i],[class*="skeleton" i],[aria-busy="true"],[class*="pending" i]');
        const newGeneratingCard = generatingCards > before.generatingCards;
        const newMediaPlaceholder = mediaPlaceholders > before.mediaPlaceholders;
        const postPlaceholder = newGeneratingCard || newMediaPlaceholder;
        const strong = composerCleared || buttonDisabled || loading || urlChanged || newGeneratingCard || newMediaPlaceholder;
        const weakOnly = postPlaceholder && !strong;
        const reason = composerCleared ? 'composer-cleared'
          : buttonDisabled ? 'button-disabled'
            : loading ? 'generating-overlay'
              : urlChanged ? 'url-changed'
                : newGeneratingCard ? 'new-progress-card'
                  : newMediaPlaceholder ? 'new-media-placeholder'
                    : postPlaceholder ? 'weak_accept_signal' : 'none';
        return {
          accepted: strong,
          strong,
          weakOnly,
          reason,
          editorTextLen: editorText.length,
          rootTextLen: rootText.length,
          buttonDisabled,
          loading,
          composerCleared,
          urlChanged,
          newGeneratingCard,
          newMediaPlaceholder,
          postPlaceholder,
        };
      };

      const scope = findBottomComposerScope();
      if (!scope) return { ok: false, code: 'composer_not_found', error: 'Bottom composer not found', clicked: false, editorFound: false, editorTextLen: 0, promptMatch: false, imageCount: 0, buttonFound: false, accepted: false };
      const editor = findActualComposerEditor(scope);
      let editorText = getEditorText(editor);
      let promptMatch = promptMatchesEditor(editorText, expectedText);
      let imageCount = countImages(scope);
      let button = findSubmitButton(scope);
      const debug = () => ({
        editorFound: !!editor,
        editorTextLen: editorText.length,
        editorTextPreview: editorText.slice(0, 160),
        promptMatch,
        imageCount,
        buttonFound: !!button,
        buttonDisabled: button ? !isEnabled(button) : null,
        composerFound: true,
        rootTextLen: normalizeText(scope.root.innerText || scope.root.textContent || '').length,
        rootTextPreview: normalizeText(scope.root.innerText || scope.root.textContent || '').slice(0, 160),
        editorCandidateCount: scope.root.querySelectorAll('[data-testid="chat-input"] [contenteditable="true"],div[contenteditable="true"].ProseMirror,div[contenteditable="true"],textarea,input').length,
        buttonCandidates: getSubmitButtonCandidates(scope).slice(0, 8).map(item => ({
          text: item.text,
          type: item.type,
          disabled: item.disabled,
          score: item.score,
          rect: item.rect,
          svg: item.svg,
          rightSide: item.rightSide,
        })),
        buttonCenter: button ? (() => {
          const r = button.getBoundingClientRect();
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })() : null,
      });
      if (!editor) return { ok: false, code: 'text_missing_before_atomic_submit', error: 'Không tìm thấy editor thật trước submit.', clicked: false, accepted: false, ...debug() };
      if (requireImage && imageCount < minImages) return { ok: false, code: 'image_missing_before_atomic_submit', error: 'Thiếu ảnh tham chiếu trước submit.', clicked: false, accepted: false, ...debug() };
      for (let attempt = 1; attempt <= 3 && !promptMatch; attempt++) {
        setEditorTextLikeUser(editor, expectedText);
        await sleep(350);
        editorText = getEditorText(editor);
        promptMatch = promptMatchesEditor(editorText, expectedText);
      }
      imageCount = countImages(scope);
      button = findSubmitButton(scope);
      editorText = getEditorText(editor);
      promptMatch = promptMatchesEditor(editorText, expectedText);
      if (!promptMatch || editorText.length < minTextChars) return { ok: false, code: 'text_missing_before_atomic_submit', error: 'Prompt không tồn tại hoặc không khớp trong editor thật ngay trước submit.', clicked: false, accepted: false, ...debug() };
      if (requireImage && imageCount < minImages) return { ok: false, code: 'image_missing_before_atomic_submit', error: 'Thiếu ảnh tham chiếu ngay trước submit.', clicked: false, accepted: false, ...debug() };
      if (!button) return { ok: false, code: 'submit_button_not_found', error: 'Không tìm thấy nút submit trong bottom composer.', clicked: false, accepted: false, ...debug() };
      if (!isEnabled(button)) return { ok: false, code: 'submit_button_disabled', error: 'Nút submit đang disabled trước submit.', clicked: false, accepted: false, ...debug() };

      const before = {
        text: editorText,
        url: String(location.href || ''),
        generatingCards: countVisible('article,[class*="post" i],[class*="result" i],[class*="progress" i],[class*="generating" i],[role="progressbar"]'),
        mediaPlaceholders: countVisible('[class*="placeholder" i],[class*="skeleton" i],[aria-busy="true"],[class*="pending" i]'),
      };
      if (window.__gpiFilmEarlySubmitShield && String(window.__gpiFilmEarlySubmitShield.sceneId || '') === String(opts.sceneId || '')) {
        window.__gpiFilmEarlySubmitShield.phase = 'open_for_atomic_submit';
        window.__gpiFilmEarlySubmitShield.active = true;
        window.__gpiFilmEarlySubmitShield.updatedAt = Date.now();
      }
      button.scrollIntoView({ block: 'center', inline: 'center' });
      button.focus();
      await sleep(80);
      return {
        ok: true,
        code: null,
        clicked: false,
        readyToPageClick: true,
        accepted: false,
        strongAccepted: false,
        acceptedReason: 'page-click-pending',
        method: 'atomic-film-verified-before-page-click',
        ...debug(),
      };
      },
      args: [{
        sceneId,
        expectedText: fullPrompt,
        minTextChars,
        minImages,
        requireImage,
        acceptTimeoutMs: options.acceptTimeoutMs || 12000,
      }],
    });
  } catch (err) {
    result = [{ result: { ok: false, code: 'atomic_submit_failed', error: err?.message || String(err), clicked: false, accepted: false, editorFound: false, editorTextLen: 0, promptMatch: false, imageCount: 0 } }];
  }
  let submitRes = result?.[0]?.result || { ok: false, code: 'atomic_submit_failed', error: 'Atomic Film submit script failed', clicked: false, accepted: false };
  if (!submitRes.ok && preClickGuard?.ok && submitRes.editorFound === false && (preClickGuard.imageCount || preClickGuard.editorTextLength || preClickGuard.textLen)) {
    submitRes = {
      ...submitRes,
      code: 'atomic_locator_mismatch',
      error: 'Atomic submit không tìm thấy composer/editor dù pre-click guard đã pass.',
      preClickGuardEditorFound: preClickGuard.editorFound,
      preClickGuardTextLen: preClickGuard.editorTextLength || preClickGuard.textLen || 0,
      preClickGuardImageCount: preClickGuard.imageCount || 0,
    };
  }
  if (submitRes.ok && submitRes.readyToPageClick && !submitRes.clicked) {
    addLog(sfLogEl, '[SF atomic submit] payload OK, submit bằng CDP native click.', 'info');
    const submitAttempt = await submitComposerWithCDPAndAccepted(tabId, {
      feature: 'Film',
      sceneId,
      expectedText: fullPrompt,
      requireText: true,
      requireImage,
      minImages,
      minTextChars,
      scope: 'bottomComposer',
      timeoutMs: options.acceptTimeoutMs || 10000,
      pollMs: options.pollMs || 250,
    });
    submitRes = {
      ...submitRes,
      ...submitAttempt,
      clicked: submitAttempt.clicked === true,
      accepted: submitAttempt.accepted === true,
      strongAccepted: submitAttempt.strongAccepted === true,
      acceptedReason: submitAttempt.acceptedReason || submitAttempt.reason || 'no-submit-signal',
      ok: submitAttempt.accepted === true && submitAttempt.strongAccepted === true,
      code: submitAttempt.accepted === true && submitAttempt.strongAccepted === true ? null : (submitAttempt.code || 'submit_not_accepted'),
      error: submitAttempt.accepted === true && submitAttempt.strongAccepted === true ? null : (submitAttempt.error || 'Đã click nút submit nhưng chưa phát hiện Grok nhận job.'),
    };
  }
  if (submitRes.composerFound !== undefined) addLog(sfLogEl, `[SF atomic submit] composer found=${submitRes.composerFound ? 'yes' : 'no'} rootTextLen=${submitRes.rootTextLen || 0}`, submitRes.composerFound ? 'info' : 'err');
  addLog(sfLogEl, `[SF atomic submit] editorFound=${submitRes.editorFound ? 'yes' : 'no'} editorTextLen=${submitRes.editorTextLen || 0} promptMatch=${submitRes.promptMatch ? 'yes' : 'no'} imageCount=${submitRes.imageCount || 0}`, submitRes.promptMatch && (!requireImage || submitRes.imageCount >= minImages) ? 'info' : 'warn');
  if (submitRes.code === 'atomic_locator_mismatch') {
    addLog(sfLogEl, '❌ [Film] Atomic submit không tìm thấy composer, nhưng pre-click guard đã tìm thấy.', 'err');
    addLog(sfLogEl, 'Bước: Atomic submit', 'err');
    addLog(sfLogEl, 'Mã lỗi: atomic_locator_mismatch', 'err');
    addLog(sfLogEl, 'Chi tiết: submitShortFilmAtomically đang lệch locator so với verifyComposerPayload.', 'err');
    addLog(sfLogEl, 'Hành động: Dừng submit để tránh click sai composer.', 'warn');
  }
  if (submitRes.clicked) addLog(sfLogEl, '[SF atomic submit] click submit đúng 1 lần.', 'info');
  if (submitRes.code === 'weak_accept_signal') {
    addLog(sfLogEl, '[SF atomic submit] post-placeholder là tín hiệu yếu, không đủ xác nhận Grok đã nhận job.', 'warn');
  }
  addLog(sfLogEl, `[SF atomic submit] accepted=${submitRes.accepted ? 'yes' : 'no'} reason=${submitRes.acceptedReason || 'none'}`, submitRes.accepted ? 'ok' : (submitRes.clicked && submitRes.ok ? 'warn' : 'err'));
  if (submitRes.ok && submitRes.accepted && submitRes.strongAccepted) {
    addLog(sfLogEl, `✓ [Film] Submit hợp lệ, Grok đã nhận scene ${sceneId}.`, 'ok');
  } else if (submitRes.clicked) {
    addLog(sfLogEl, '⚠ [Film] Đã click nút submit nhưng chưa có tín hiệu Grok nhận job.', 'warn');
  }
  const acceptedOk = submitRes.accepted === true && submitRes.strongAccepted === true;
  return {
    ...submitRes,
    payloadOk: preClickGuard.ok === true,
    ok: acceptedOk,
    code: acceptedOk ? null : (submitRes.code || 'submit_not_accepted'),
    sceneId,
    preClickGuard,
    clickCount: submitRes.clicked ? 1 : 0,
    verified: acceptedOk,
  };
}

async function submitFilmSceneAtomic(tabId, scene, fullPrompt, options = {}) {
  addLog(sfLogEl, `[Film atomic submit] Cảnh ${options.sceneIndex != null ? Number(options.sceneIndex) + 1 : (scene?.id || '')} payload hợp lệ, click submit đúng 1 lần.`, 'info');
  return submitShortFilmAtomically(tabId, scene, fullPrompt, options);
}

// ── CLICK SUBMIT BUTTON (standalone, không đụng vào text input) ───────────────
// Dùng riêng cho Img2Vid/Short Film: sau khi đã inject ảnh + text, chỉ cần click submit.
async function getBottomComposerImageCount(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
      const findBottomComposerScope = () => {
        const inputSelectors = [
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
        ].join(',');
        return Array.from(document.querySelectorAll(inputSelectors))
          .filter(input => isVisible(input) && !isBlocked(input))
          .map(input => {
            let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
            if (!root) {
              let node = input.parentElement;
              for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                if (node.querySelector('button,[role="button"],label,input[type="file"]')) { root = node; break; }
              }
            }
            if (!root || root === document.body || isBlocked(root)) return null;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
            return isBottom ? { input, root, inputRect, rootRect } : null;
          })
          .filter(Boolean)
          .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
      };
      const scope = findBottomComposerScope();
      if (!scope) return { ok: false, imageCount: 0, thumbnails: [], error: 'Bottom composer not found' };
      const selectors = [
        'img[src^="blob:"]',
        'img[src^="data:"]',
        '[class*="thumb" i]',
        '[class*="preview" i]',
        '[class*="attachment" i]',
        '[aria-label*="image" i]',
        '[aria-label*="file" i]',
      ].join(',');
      const thumbnails = [];
      const seen = new Set();
      for (const el of Array.from(scope.root.querySelectorAll(selectors))) {
        if (!scope.root.contains(el) || isBlocked(el) || !isVisible(el) || seen.has(el)) continue;
        seen.add(el);
        const r = el.getBoundingClientRect();
        thumbnails.push({
          tag: el.tagName,
          text: String(el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 80),
          rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        });
      }
      return { ok: true, imageCount: seen.size, thumbnails };
    },
  });
  return result?.[0]?.result || { ok: false, imageCount: 0, thumbnails: [], error: 'Image count script failed' };
}

async function clearBottomComposerAttachments(tabId, options = {}) {
  if ((options.scope || 'bottomComposer') !== 'bottomComposer') {
    return { ok: false, beforeCount: 0, afterCount: 0, removedCount: 0, error: 'Unsupported composer scope' };
  }
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || 8000));
  const stableMs = Math.max(0, Number(options.stableMs || 500));
  const expectedFinalCount = Math.max(0, Number(options.expectedFinalCount ?? 0));
  const startedAt = Date.now();
  let beforeCount = null;
  let afterCount = null;
  let removedCount = 0;
  let stableStart = null;
  let lastError = '';

  while (Date.now() - startedAt < timeoutMs) {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (expectedFinalCount) => {
        const isVisible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
        };
        const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
        const findBottomComposerScope = () => {
          const inputSelectors = [
            'textarea[placeholder*="Type to imagine" i]',
            'textarea[placeholder*="Imagine" i]',
            'textarea[placeholder*="Describe" i]',
            'textarea[placeholder*="Enter" i]',
            'div[contenteditable="true"][data-lexical-editor]',
            'div[contenteditable="true"]',
            'textarea',
          ].join(',');
          return Array.from(document.querySelectorAll(inputSelectors))
            .filter(input => isVisible(input) && !isBlocked(input))
            .map(input => {
              let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
              if (!root) {
                let node = input.parentElement;
                for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                  if (node.querySelector('button,[role="button"],label,input[type="file"]')) { root = node; break; }
                }
              }
              if (!root || root === document.body || isBlocked(root)) return null;
              const inputRect = input.getBoundingClientRect();
              const rootRect = root.getBoundingClientRect();
              const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
              return isBottom ? { input, root, inputRect, rootRect } : null;
            })
            .filter(Boolean)
            .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
        };
        const scope = findBottomComposerScope();
        if (!scope) return { ok: false, count: 0, removed: 0, error: 'Bottom composer not found' };
        const attachmentSelectors = [
          'img[src^="blob:"]',
          'img[src^="data:"]',
          '[class*="thumb" i]',
          '[class*="preview" i]',
          '[class*="attachment" i]',
          '[aria-label*="image" i]',
          '[aria-label*="file" i]',
        ].join(',');
        const readText = (el) => String([
          el.textContent,
          el.getAttribute?.('aria-label'),
          el.getAttribute?.('title'),
          el.getAttribute?.('class'),
        ].filter(Boolean).join(' ')).replace(/\s+/g, ' ').trim().toLowerCase();
        const attachments = Array.from(scope.root.querySelectorAll(attachmentSelectors))
          .filter(el => scope.root.contains(el) && !isBlocked(el) && isVisible(el));
        let removed = 0;
        const findRemoveButton = (attachment) => {
          const container = attachment.closest?.('[class*="attachment" i], [class*="preview" i], [class*="thumb" i], [class*="file" i]') || attachment.parentElement;
          const localButtons = Array.from((container || scope.root).querySelectorAll('button,[role="button"]'))
            .filter(btn => scope.root.contains(btn) && !isBlocked(btn) && isVisible(btn));
          const byLabel = localButtons.find(btn => /remove|delete|close|clear|\b(x|×)\b/i.test(readText(btn)));
          if (byLabel) return byLabel;
          const ar = attachment.getBoundingClientRect();
          return Array.from(scope.root.querySelectorAll('button,[role="button"]'))
            .filter(btn => scope.root.contains(btn) && !isBlocked(btn) && isVisible(btn))
            .map(btn => ({ btn, r: btn.getBoundingClientRect(), text: readText(btn) }))
            .filter(item => {
              const small = item.r.width <= 48 && item.r.height <= 48;
              const near = item.r.left >= ar.left - 20 && item.r.left <= ar.right + 20 && item.r.top >= ar.top - 30 && item.r.top <= ar.bottom + 20;
              return small && near && !/send|submit|generate|grok/i.test(item.text);
            })[0]?.btn || null;
        };
        if (attachments.length > expectedFinalCount) {
          for (const attachment of attachments) {
            const btn = findRemoveButton(attachment);
            if (!btn) continue;
            btn.click();
            removed++;
          }
        }
        return { ok: true, count: attachments.length, removed };
      },
      args: [expectedFinalCount],
    });
    const sample = result?.[0]?.result || { ok: false, count: 0, removed: 0, error: 'Clear attachments script failed' };
    if (beforeCount == null) beforeCount = Number(sample.count || 0);
    afterCount = Number(sample.count || 0);
    removedCount += Number(sample.removed || 0);
    lastError = sample.error || '';
    if (sample.ok && afterCount <= expectedFinalCount) {
      if (!stableStart) stableStart = Date.now();
      if (Date.now() - stableStart >= stableMs) {
        return { ok: true, beforeCount, afterCount, removedCount, error: null };
      }
    } else {
      stableStart = null;
    }
    await sleep(250);
  }
  const finalCheck = await getBottomComposerImageCount(tabId);
  return {
    ok: finalCheck.ok && finalCheck.imageCount <= expectedFinalCount,
    beforeCount: beforeCount ?? finalCheck.imageCount,
    afterCount: finalCheck.imageCount,
    removedCount,
    error: finalCheck.imageCount > expectedFinalCount
      ? `Composer still has ${finalCheck.imageCount} images after cleanup`
      : (lastError || finalCheck.error || 'Attachment cleanup timed out'),
  };
}

const SF_MAX_REFERENCE_IMAGES = 7;

function getFilmRefKey(ch, index = 0) {
  const idPart = ch?.id != null ? String(ch.id) : String(index + 1);
  const namePart = slugify(ch?.name || ch?.role || `ref_${index + 1}`) || `ref_${index + 1}`;
  return `char:${idPart}:${namePart}`;
}

function buildFilmDesiredRefs(charRefs = []) {
  return (charRefs || [])
    .filter(ch => ch?.imageDataUrl)
    .map((ch, index) => {
      const refKey = getFilmRefKey(ch, index);
      const safeName = slugify(ch?.name || ch?.role || `ref_${index + 1}`) || `ref_${index + 1}`;
      const safeId = ch?.id != null ? String(ch.id).replace(/[^a-z0-9_-]/gi, '') : String(index + 1);
      return {
        refKey,
        fileName: `sf_${refKey.replace(/[^a-z0-9_-]/gi, '_')}.jpg`,
        label: ch?.name || ch?.role || `Ảnh ${index + 1}`,
        slug: safeName,
        id: safeId,
        dataUrl: ch.imageDataUrl,
      };
    });
}

function dedupeFilmRefs(refs = []) {
  const seen = new Set();
  const out = [];
  for (const ref of refs || []) {
    if (!ref?.dataUrl) continue;
    const key = String(ref.refKey || ref.fileName || ref.dataUrl.slice(0, 96));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

async function getFilmComposerAttachmentState(tabId) {
  const cleanState = await getFilmComposerCleanState(tabId);
  return {
    ok: cleanState.ok,
    count: cleanState.attachmentCount,
    refs: cleanState.attachments || [],
    rawImageNodes: cleanState.rawImageNodes,
    uniqueImageUrls: cleanState.uniqueImageUrls,
    pendingCards: cleanState.pendingCards,
    editorTextLen: cleanState.editorTextLen,
    error: cleanState.error || '',
    cleanState,
  };
}

async function cleanupFilmComposerAttachments(tabId) {
  return clearBottomComposerAttachments(tabId, {
    scope: 'bottomComposer',
    expectedFinalCount: 0,
    timeoutMs: 9000,
    stableMs: 500,
  });
}

async function getFilmComposerCleanState(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
      };
      const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i],[class*="result" i],[class*="post" i]');
      const findBottomComposerScope = () => {
        const inputSelectors = [
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'input[placeholder*="Imagine" i]',
          'input[placeholder*="Describe" i]',
          'input[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
          'input',
        ].join(',');
        return Array.from(document.querySelectorAll(inputSelectors))
          .filter(input => isVisible(input) && !isBlocked(input))
          .map(input => {
            let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
            if (!root) {
              let node = input.parentElement;
              for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                if (node.querySelector('button,[role="button"],label,input[type="file"]')) { root = node; break; }
              }
            }
            if (!root || root === document.body || isBlocked(root)) return null;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
            return isBottom ? { input, root, inputRect, rootRect } : null;
          })
          .filter(Boolean)
          .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
      };
      const scope = findBottomComposerScope();
      if (!scope) {
        return {
          ok: false,
          composerFound: false,
          attachmentCount: 0,
          rawImageNodes: 0,
          uniqueImageUrls: 0,
          editorTextLen: 0,
          buttonFound: false,
          attachments: [],
          debug: { reason: 'Bottom composer not found' },
          error: 'Bottom composer not found',
        };
      }
      const editor = scope.input;
      const editorText = normalize(('value' in editor) ? editor.value : (editor.innerText || editor.textContent || ''));
      const attachmentSelectors = [
        'img[src^="blob:"]',
        'img[src^="data:"]',
        'img[src*="assets.grok.com"]',
        'img[src*="/content"]',
        '[class*="thumb" i]',
        '[class*="preview" i]',
        '[class*="attachment" i]',
        '[class*="file" i]',
        '[aria-label*="image" i]',
        '[aria-label*="file" i]',
      ].join(',');
      const rawNodes = Array.from(scope.root.querySelectorAll(attachmentSelectors))
        .filter(el => scope.root.contains(el) && !isBlocked(el) && isVisible(el));
      const seen = new Set();
      const attachments = [];
      for (const el of rawNodes) {
        const rect = el.getBoundingClientRect();
        const src = el.currentSrc || el.src || el.getAttribute?.('src') || '';
        const container = el.closest?.('[class*="attachment" i],[class*="preview" i],[class*="thumb" i],[class*="file" i]') || el;
        const text = normalize([
          el.textContent,
          el.getAttribute?.('alt'),
          el.getAttribute?.('aria-label'),
          el.getAttribute?.('title'),
          container?.textContent,
          container?.getAttribute?.('aria-label'),
          container?.getAttribute?.('title'),
        ].filter(Boolean).join(' '));
        const key = src || `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}:${text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        attachments.push({
          tag: el.tagName,
          text: text.slice(0, 80),
          srcKind: src.startsWith('blob:') ? 'blob' : src.startsWith('data:') ? 'data' : src ? 'url' : '',
          rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
        });
      }
      const buttons = Array.from(scope.root.querySelectorAll('button,[role="button"],button[type="submit"]'))
        .filter(btn => scope.root.contains(btn) && !isBlocked(btn) && isVisible(btn))
        .map(btn => {
          const r = btn.getBoundingClientRect();
          return {
            text: normalize([btn.textContent, btn.getAttribute?.('aria-label'), btn.getAttribute?.('title'), btn.getAttribute?.('type')].filter(Boolean).join(' ')).slice(0, 80),
            disabled: !!btn.disabled || btn.getAttribute('aria-disabled') === 'true',
            rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) },
          };
        });
      const rootRect = scope.root.getBoundingClientRect();
      return {
        ok: true,
        composerFound: true,
        attachmentCount: attachments.length,
        rawImageNodes: rawNodes.length,
        uniqueImageUrls: seen.size,
        editorTextLen: editorText.length,
        buttonFound: buttons.some(btn => !btn.disabled && (/\b(send|submit|generate|create|grok)\b/i.test(btn.text) || btn.rect.right > rootRect.right - 180)),
        pendingCards: Array.from(scope.root.querySelectorAll('[aria-busy="true"],[role="progressbar"],[class*="pending" i],[class*="generating" i]')).filter(isVisible).length,
        attachments,
        debug: {
          rootRect: { x: Math.round(rootRect.left), y: Math.round(rootRect.top), w: Math.round(rootRect.width), h: Math.round(rootRect.height), bottom: Math.round(rootRect.bottom) },
          buttonCount: buttons.length,
          buttons: buttons.slice(0, 8),
          editorTextPreview: editorText.slice(0, 120),
        },
      };
    },
  });
  return result?.[0]?.result || { ok: false, composerFound: false, attachmentCount: 0, rawImageNodes: 0, uniqueImageUrls: 0, editorTextLen: 0, buttonFound: false, debug: {}, error: 'Film composer clean state script failed' };
}

async function prepareFilmSceneComposerForPersistedRefs(tabId, sceneCtx = {}) {
  const sceneDisplayName = sceneCtx.displayName || `Cảnh ${Number(sceneCtx.sceneIndex || 0) + 1}`;
  const logEl = sceneCtx.logEl || sfLogEl;
  const maxRefs = Math.max(1, Number(sceneCtx.maxRefs || SF_MAX_REFERENCE_IMAGES));
  const ready = await ensureGrokComposerReady(tabId, { noNavigate: true });
  if (!ready.ok) return { ...ready, code: ready.code || 'composer_not_ready' };

  let state = await getFilmComposerCleanState(tabId);
  if (!state.ok) return { ok: false, code: 'film_prepare_state_failed', error: state.error || 'Không đọc được composer Film.', state };

  addLog(logEl, `[SF prepare scene] ${sceneDisplayName}: giữ nguyên ảnh tham chiếu Grok đã tự gán, chỉ chuẩn bị text composer.`, 'info');
  addLog(logEl, `[SF prepare scene] attachmentCount=${state.attachmentCount || 0}, editorTextLen=${state.editorTextLen || 0}`, 'info');

  if ((state.attachmentCount || 0) > maxRefs) {
    return {
      ok: false,
      code: 'film_refs_over_limit',
      error: `Composer có ${state.attachmentCount} ảnh tham chiếu, vượt giới hạn ${maxRefs} của Grok.`,
      state,
      attachmentCount: state.attachmentCount,
      editorTextLen: state.editorTextLen,
    };
  }

  if ((state.editorTextLen || 0) > 0) {
    addLog(logEl, `[SF prepare scene] ${sceneDisplayName}: clear text cũ, không clear ảnh tham chiếu.`, 'warn');
    await clearI2VComposerText(tabId);
    await sleep(400);
    state = await getFilmComposerCleanState(tabId);
    if (!state.ok) return { ok: false, code: 'film_prepare_state_failed', error: state.error || 'Không đọc được composer sau khi clear text.', state };
    if ((state.attachmentCount || 0) > maxRefs) {
      return {
        ok: false,
        code: 'film_refs_over_limit',
        error: `Composer có ${state.attachmentCount} ảnh tham chiếu, vượt giới hạn ${maxRefs} của Grok.`,
        state,
        attachmentCount: state.attachmentCount,
        editorTextLen: state.editorTextLen,
      };
    }
  }

  addLog(logEl, `[SF prepare scene] attachmentCount=${state.attachmentCount || 0}, hợp lệ, không clear ảnh.`, 'ok');
  return {
    ok: true,
    method: 'persisted-refs',
    state,
    attachmentCount: state.attachmentCount || 0,
    editorTextLen: state.editorTextLen || 0,
  };
}

async function getComposerReferenceState(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
      };
      const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i],[class*="result" i],[class*="post" i]');
      const findBottomComposerScope = () => {
        const inputSelectors = [
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
        ].join(',');
        return Array.from(document.querySelectorAll(inputSelectors))
          .filter(input => isVisible(input) && !isBlocked(input))
          .map(input => {
            let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
            if (!root) {
              let node = input.parentElement;
              for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                if (node.querySelector('button,[role="button"],label,input[type="file"]')) { root = node; break; }
              }
            }
            if (!root || root === document.body || isBlocked(root)) return null;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
            return isBottom ? { input, root, inputRect, rootRect } : null;
          })
          .filter(Boolean)
          .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
      };
      const scope = findBottomComposerScope();
      if (!scope) return { ok: false, count: 0, refs: [], fingerprints: [], error: 'Bottom composer not found' };
      const selectors = [
        'img[src^="blob:"]',
        'img[src^="data:"]',
        '[class*="thumb" i]',
        '[class*="preview" i]',
        '[class*="attachment" i]',
        '[aria-label*="image" i]',
        '[aria-label*="file" i]',
      ].join(',');
      const rawNodes = Array.from(scope.root.querySelectorAll(selectors))
        .filter(el => scope.root.contains(el) && !isBlocked(el) && isVisible(el));
      const seen = new Set();
      const refs = [];
      for (const el of rawNodes) {
        const rect = el.getBoundingClientRect();
        const src = el.currentSrc || el.src || el.getAttribute?.('src') || '';
        const metaText = normalize([
          el.textContent,
          el.getAttribute?.('alt'),
          el.getAttribute?.('aria-label'),
          el.getAttribute?.('title'),
          el.getAttribute?.('data-filename'),
          el.getAttribute?.('download'),
          el.closest?.('[class*="attachment" i],[class*="preview" i],[class*="thumb" i],[class*="file" i]')?.textContent,
        ].filter(Boolean).join(' '));
        const srcKind = src.startsWith('blob:') ? 'blob' : src.startsWith('data:') ? 'data' : src ? 'url' : '';
        const srcPreview = src ? src.slice(0, 80) : '';
        const fingerprint = normalize(`${metaText} ${srcKind} ${srcPreview}`).toLowerCase();
        const key = src || `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}:${fingerprint}`;
        if (seen.has(key)) continue;
        seen.add(key);
        refs.push({
          fingerprint,
          fileName: metaText,
          srcKind,
          srcPreview,
          rect: { w: Math.round(rect.width), h: Math.round(rect.height), x: Math.round(rect.left), y: Math.round(rect.top) },
        });
      }
      return {
        ok: true,
        count: refs.length,
        refs,
        fingerprints: refs.map(ref => ref.fingerprint).filter(Boolean),
        rawImageNodes: rawNodes.length,
      };
    },
  });
  return result?.[0]?.result || { ok: false, count: 0, refs: [], fingerprints: [], error: 'Reference state script failed' };
}

async function cleanupUploadWarnings(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      document.querySelectorAll(
        '[aria-label*="warning" i],[aria-label*="error" i],[class*="upload-error" i],[class*="file-error" i]'
      ).forEach(el => el.closest('[class*="attach" i],[class*="preview" i],[class*="thumb" i]')?.remove());
    }
  });
}

async function ensureFilmPersistedRefs(tabId, sceneCtx, filmRefsRuntime, options = {}) {
  const logEl = sceneCtx?.logEl || options.logEl || sfLogEl;
  const sceneId = sceneCtx?.sceneId;
  const sceneIndex = Math.max(0, Number(sceneCtx?.sceneIndex || 0));
  const desiredRefs = dedupeFilmRefs(sceneCtx?.desiredRefs || []);
  const maxRefs = Math.max(1, Number(sceneCtx?.maxRefs || SF_MAX_REFERENCE_IMAGES));
  const expectedRefCount = desiredRefs.length;
  const runtimeKey = String(sceneId || sceneIndex);
  const prior = filmRefsRuntime?.get?.(runtimeKey);
  addLog(logEl, `[SF refs] sceneId=${sceneId} desiredRefs=${expectedRefCount} max=${maxRefs}`, 'info');

  if (expectedRefCount > maxRefs) {
    const error = `Số ảnh tham chiếu vượt quá giới hạn ${maxRefs} của Grok`;
    addLog(logEl, `❌ [SF refs] Số ảnh tham chiếu vượt quá giới hạn ${maxRefs} của Grok.`, 'err');
    return { ok: false, code: 'film_refs_over_limit', error, beforeCount: 0, injectedCount: 0, finalCount: 0 };
  }

  const composerReady = await ensureGrokComposerReady(tabId, { noNavigate: true });
  if (!composerReady.ok) {
    return { ok: false, code: 'composer_not_ready', error: composerReady.error || 'Composer chưa sẵn sàng.', beforeCount: 0, injectedCount: 0, finalCount: 0 };
  }

  const before = await getFilmComposerAttachmentState(tabId);
  if (!before.ok) {
    return { ok: false, code: 'reference_state_failed', error: before.error || 'Không đọc được trạng thái ảnh trong composer.', beforeCount: 0, injectedCount: 0, finalCount: 0 };
  }
  const beforeCount = Number(before.count || 0);
  addLog(logEl, `[SF refs] sceneId=${sceneId} currentAttachmentCount=${beforeCount}`, 'info');
  if (beforeCount > maxRefs) {
    return {
      ok: false,
      code: 'film_refs_over_limit',
      error: `Composer có ${beforeCount} ảnh tham chiếu, vượt giới hạn ${maxRefs} của Grok.`,
      beforeCount,
      injectedCount: 0,
      finalCount: beforeCount,
      before,
    };
  }

  if (sceneIndex > 0 && beforeCount > 0) {
    addLog(logEl, `[SF refs] Cảnh ${sceneIndex + 1}: Grok đã tự giữ ${beforeCount} ảnh tham chiếu, không inject thêm.`, 'ok');
    filmRefsRuntime?.set?.(runtimeKey, { handled: true, skippedInject: true, reason: 'grok_persisted_refs', beforeCount, desiredRefCount: expectedRefCount, finalCount: beforeCount, handledAt: Date.now() });
    return {
      ok: true,
      skippedInject: true,
      reason: 'grok_persisted_refs',
      beforeCount,
      attachmentCount: beforeCount,
      currentAttachmentCount: beforeCount,
      count: beforeCount,
      injectedCount: 0,
      finalCount: beforeCount,
      successCount: beforeCount,
      imageCount: beforeCount,
      before,
    };
  }

  if (prior?.handled) {
    addLog(logEl, `[SF refs] sceneId=${sceneId} đã xử lý refs trong scene này, bỏ qua để tránh inject trùng.`, 'warn');
    return {
      ok: true,
      skippedInject: true,
      code: 'film_refs_already_handled_for_scene',
      reason: prior.reason || 'already_handled',
      beforeCount,
      attachmentCount: beforeCount || prior.finalCount || 0,
      currentAttachmentCount: beforeCount || prior.finalCount || 0,
      count: beforeCount || prior.finalCount || 0,
      injectedCount: 0,
      finalCount: beforeCount || prior.finalCount || 0,
      successCount: beforeCount || prior.finalCount || 0,
      imageCount: beforeCount || prior.finalCount || 0,
    };
  }

  if (expectedRefCount === 0) {
    addLog(logEl, `[SF refs] sceneId=${sceneId} không có ảnh tham chiếu cấu hình và composer chưa có ảnh.`, 'info');
    filmRefsRuntime?.set?.(runtimeKey, { handled: true, skippedInject: true, reason: 'no_configured_refs', beforeCount, desiredRefCount: 0, finalCount: 0, handledAt: Date.now() });
    return { ok: true, skippedInject: true, reason: 'no_configured_refs', beforeCount, injectedCount: 0, finalCount: 0 };
  }

  addLog(logEl, sceneIndex === 0
    ? `[SF refs] Cảnh 1: inject bộ ảnh tham chiếu cấu hình ban đầu.`
    : `[SF refs] Cảnh ${sceneIndex + 1}: không thấy ảnh tham chiếu do Grok giữ, inject lại bộ refs cấu hình một lần.`, 'warn');
  if (sceneIndex === 0 && beforeCount > 0) {
    addLog(logEl, `[SF refs] Cảnh 1 đang có ${beforeCount} ảnh trong composer; vẫn inject refs cấu hình ban đầu theo yêu cầu scene đầu tiên.`, 'warn');
  }

  let injectedCount = 0;
  for (const ref of desiredRefs) {
    const res = await injectImageToPage(tabId, ref.dataUrl, ref.mime || 'image/jpeg', ref.fileName, {
      preferComposer: true,
      sceneId,
      replaceExisting: false,
    });
    if (res.ok) {
      injectedCount++;
      addLog(logEl, `    ✓ ${ref.label}: nhận OK`, 'ok');
    } else {
      addLog(logEl, `    ⚠ ${ref.label}: ${res.error} — bỏ qua ảnh này`, 'warn');
      await cleanupUploadWarnings(tabId);
    }
    await sleep(1000);
  }
  if (injectedCount < expectedRefCount) {
    return { ok: false, code: 'film_refs_inject_failed', error: `Chỉ inject được ${injectedCount}/${expectedRefCount} ảnh tham chiếu.`, beforeCount, injectedCount, finalCount: injectedCount };
  }

  const waitStart = Date.now();
  const attachmentWait = await waitComposerAttachmentStable(tabId, SF_CHAR_REF_STABLE_TIMEOUT, 1000, {
    scope: 'bottomComposer',
    minImages: 1,
    maxImages: maxRefs,
  });
  const waitMs = Date.now() - waitStart;
  addLog(logEl, `[SF timing] refsWaitMs=${waitMs} ok=${attachmentWait.ok ? 'yes' : 'no'} imageCount=${attachmentWait.imageCount ?? 0}`, attachmentWait.ok ? 'info' : 'warn');

  const finalState = await getFilmComposerAttachmentState(tabId);
  const effectiveImageCount = Math.max(Number(finalState.count || 0), Number(attachmentWait.imageCount || 0));
  if (effectiveImageCount > maxRefs) {
    addLog(logEl, `❌ [SF refs] Số ảnh tham chiếu trong composer là ${effectiveImageCount}, vượt giới hạn ${maxRefs} của Grok. Dừng scene để tránh lỗi.`, 'err');
    return {
      ok: false,
      code: 'film_refs_too_many_after_inject',
      error: `Composer có ${effectiveImageCount} ảnh tham chiếu, vượt quá giới hạn ${maxRefs} của Grok.`,
      beforeCount,
      injectedCount,
      finalCount: effectiveImageCount,
      finalState, attachmentWait,
    };
  }
  if (effectiveImageCount === 0) {
    return {
      ok: false,
      code: 'film_refs_missing_after_inject',
      error: `Composer chưa có ảnh tham chiếu sau inject.`,
      beforeCount, injectedCount, finalCount: 0, finalState, attachmentWait,
    };
  }
  if (!attachmentWait.ok) {
    if (effectiveImageCount <= maxRefs) {
      addLog(logEl, `[SF refs] imageCount=${effectiveImageCount}, đủ ảnh tham chiếu, tiếp tục.`, 'ok');
      addLog(logEl, `[SF refs] Đã có ảnh tham chiếu trong composer, tiếp tục.`, 'ok');
      addLog(logEl, `⚠ [SF refs] Attachment count chưa ổn định tuyệt đối nhưng đã đủ ảnh, tiếp tục để tránh dừng sai.`, 'warn');
      filmRefsRuntime?.set?.(runtimeKey, { handled: true, injected: true, desiredRefCount: expectedRefCount, beforeCount, injectedCount, finalCount: effectiveImageCount, handledAt: Date.now() });
      return {
        ok: true,
        warning: true,
        code: 'refs_not_fully_stable_but_enough',
        beforeCount, injectedCount, finalCount: effectiveImageCount,
        attachmentCount: effectiveImageCount,
        currentAttachmentCount: effectiveImageCount,
        count: effectiveImageCount,
        successCount: injectedCount, expectedRefCount, imageCount: effectiveImageCount,
        finalState, attachmentWait,
      };
    }
    return {
      ok: false,
      code: attachmentWait.code || 'film_refs_not_stable',
      error: attachmentWait.error || 'Ảnh tham chiếu chưa ổn định trong composer.',
      beforeCount, injectedCount, finalCount: effectiveImageCount, attachmentWait, finalState,
    };
  }
  addLog(logEl, `[SF refs] imageCount=${effectiveImageCount}, đủ ảnh tham chiếu, tiếp tục.`, 'ok');
  addLog(logEl, `[SF refs] Đã có ảnh tham chiếu trong composer, tiếp tục.`, 'ok');
  addLog(logEl, `[SF refs] injected=${injectedCount} finalCount=${effectiveImageCount}`, 'info');
  addLog(logEl, `[SF refs] Hoàn tất refs cho sceneId=${sceneId}.`, 'ok');
  filmRefsRuntime?.set?.(runtimeKey, { handled: true, injected: true, desiredRefCount: expectedRefCount, beforeCount, injectedCount, finalCount: effectiveImageCount, handledAt: Date.now() });
  return {
    ok: true,
    beforeCount,
    injectedCount,
    finalCount: effectiveImageCount,
    attachmentCount: effectiveImageCount,
    currentAttachmentCount: effectiveImageCount,
    count: effectiveImageCount,
    successCount: injectedCount,
    expectedRefCount,
    imageCount: effectiveImageCount,
    finalState,
    attachmentWait,
  };
}

async function clickSubmitButton(tabId, timeoutMs = 15000, options = {}) {
  const pollMs = 500;
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (timeoutMs, pollMs, options) => {
      return new Promise(resolve => {
        let attempts = 0;
        const maxAttempts = Math.ceil(timeoutMs / pollMs);
        const maxClicks = Math.max(1, Number(options?.maxClicks || 99));
        const once = options?.once === true || maxClicks === 1;
        let clickCount = 0;
        const tried = new WeakSet();

        const isVisible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
        };
        const isEnabled = (btn) => !btn.disabled
          && btn.getAttribute('aria-disabled') !== 'true'
          && !btn.closest('[aria-disabled="true"]');
        const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="overlay" i]');

        const rightmost = (btns) => btns
          .map(b => ({ b, r: b.getBoundingClientRect() }))
          .sort((a, z) => (z.r.right - a.r.right) || (z.r.bottom - a.r.bottom))[0]?.b || null;

        const buttonText = (btn) => [
          btn.getAttribute('aria-label'),
          btn.getAttribute('title'),
          btn.getAttribute('data-testid'),
          btn.getAttribute('class'),
          btn.textContent,
        ].filter(Boolean).join(' ').toLowerCase();

        const isBadIconButton = (btn) => {
          const hay = buttonText(btn);
          if (/\b(send|submit|generate|grok)\b/.test(hay)) return false;
          if (/\b(attach|upload|image|photo|file|remove|delete|close|clear|cancel|mic|voice|menu|option|more|edit)\b/.test(hay)) {
            return true;
          }
          return !!btn.closest('[class*="preview" i],[class*="thumb" i],[class*="attachment" i],[class*="upload" i]');
        };

        const isLikelySubmit = (btn, inputEl = null, allowGeneric = false) => {
          if (!isVisible(btn) || !isEnabled(btn) || isBadIconButton(btn)) return false;
          const hay = buttonText(btn);
          const explicit = /\b(send|submit|generate|grok)\b/.test(hay) || btn.type === 'submit';
          if (explicit) return true;
          if (!allowGeneric || !btn.querySelector('svg')) return false;

          const r = btn.getBoundingClientRect();
          if (r.width < 24 || r.width > 64 || r.height < 24 || r.height > 64) return false;
          if (inputEl) {
            const ir = inputEl.getBoundingClientRect();
            return r.right >= ir.left && r.left <= ir.right + 80 && r.bottom >= ir.top - 30 && r.top <= ir.bottom + 120;
          }
          return r.bottom > window.innerHeight * 0.55;
        };

        const clickAndVerify = (button, method) => {
          if (clickCount >= maxClicks) {
            return resolve({ ok: false, error: 'Submit click limit reached', method, clickCount });
          }
          const inputBefore = findInput();
          const beforeText = ((inputBefore?.value ?? inputBefore?.textContent) || '').trim();
          const preClick = inspectPreClickPayload();
          console.log('[SF pre-click guard]', preClick);
          if (!preClick.ok) {
            const finalCode = preClick.code === 'settings_mismatch'
              ? 'preclick_settings_mismatch'
              : 'preclick_payload_missing';
            return resolve({
              ok: false,
              error: finalCode === 'preclick_settings_mismatch'
                ? 'Pre-click settings guard failed'
                : 'Pre-click payload guard failed',
              method,
              clickCount,
              ...preClick,
              code: finalCode,
              preClickCode: preClick.code || null,
            });
          }
          clickCount++;
          const rect = button.getBoundingClientRect();
          console.log('[GPI-submit] click candidate:', method, {
            label: button.getAttribute('aria-label') || button.getAttribute('title') || button.getAttribute('data-testid') || button.textContent?.trim() || button.className?.slice?.(0, 50),
            textLen: beforeText.length,
            x: Math.round(rect.right), y: Math.round(rect.bottom),
          });
          button.scrollIntoView({ block: 'center', inline: 'center' });
          button.focus();
          if (options?.clickMode === 'nativeOnly') {
            button.click();
          } else {
            ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(type => {
              button.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
            });
          }

          setTimeout(() => {
            const inputAfter = findInput() || inputBefore;
            const afterText = ((inputAfter?.value ?? inputAfter?.textContent) || '').trim();
            const busy = !!document.querySelector('[aria-busy="true"],[class*="loading" i],[class*="generating" i],[class*="pending" i],[role="progressbar"]');
            const disabledNow = !isEnabled(button);
            const cleared = beforeText.length > 0 && afterText.length === 0;
            const verified = cleared || busy || disabledNow;
            console.log('[GPI-submit] verify:', { method, beforeLen: beforeText.length, afterLen: afterText.length, busy, disabledNow, verified, clickCount, once });
            if (verified || once) return resolve({ ok: true, method, verified, clickCount, preClickGuard: preClick });
            tried.add(button);
            setTimeout(tryClick, Math.max(120, pollMs / 2));
          }, once ? 1800 : 900);
        };

        // Tìm textarea/input đang active
        const findInput = () => {
          const sels = [
            'textarea[placeholder*="Imagine" i]', 'textarea[placeholder*="Describe" i]',
            'textarea[placeholder*="Enter" i]', 'textarea[placeholder*="video" i]',
            'div[contenteditable="true"][data-lexical-editor]',
            'div[contenteditable="true"]', 'textarea',
          ];
          for (const sel of sels) {
            for (const c of document.querySelectorAll(sel)) {
              if (isVisible(c)) return c;
            }
          }
          return null;
        };

        const findBottomComposerScope = () => {
          const inputSelectors = [
            'textarea[placeholder*="Type to imagine" i]',
            'textarea[placeholder*="Imagine" i]',
            'textarea[placeholder*="Describe" i]',
            'textarea[placeholder*="Enter" i]',
            'div[contenteditable="true"][data-lexical-editor]',
            'div[contenteditable="true"]',
            'textarea',
          ].join(',');
          return Array.from(document.querySelectorAll(inputSelectors))
            .filter(input => isVisible(input) && !isBlocked(input))
            .map(input => {
              let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
              if (!root) {
                let node = input.parentElement;
                for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                  if (node.querySelector('button,[role="button"],label')) { root = node; break; }
                }
              }
              if (!root || isBlocked(root)) return null;
              const inputRect = input.getBoundingClientRect();
              const rootRect = root.getBoundingClientRect();
              const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
              return isBottom ? { input, root, inputRect, rootRect } : null;
            })
            .filter(Boolean)
            .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
        };

        const normalizeText = (text) => String(text || '').replace(/\s+/g, ' ').trim();
        const findActualComposerEditor = (scope) => {
          const root = scope?.root;
          if (!root) return null;
          const selectors = [
            '[data-testid="chat-input"] div[contenteditable="true"]',
            '[data-testid="chat-input"] [contenteditable="true"]',
            'div[contenteditable="true"].ProseMirror',
            'div[contenteditable="true"][translate="no"]',
            'div[contenteditable="true"]',
            'textarea',
            'input',
          ];
          const candidates = Array.from(root.querySelectorAll(selectors.join(',')))
            .filter(el => root.contains(el))
            .filter(isVisible)
            .filter(el => !isBlocked(el))
            .map(el => {
              const r = el.getBoundingClientRect();
              const inChatInput = !!el.closest('[data-testid="chat-input"]');
              const isProseMirror = String(el.className || '').includes('ProseMirror');
              return {
                el,
                score:
                  (inChatInput ? 100 : 0) +
                  (isProseMirror ? 80 : 0) +
                  (el.isContentEditable ? 40 : 0) +
                  Math.round(r.bottom / 100),
              };
            })
            .sort((a, b) => b.score - a.score);
          return candidates[0]?.el || scope.input || null;
        };

        const getActualEditorText = (editor) => {
          if (!editor) return '';
          if ('value' in editor) return normalizeText(editor.value || '');
          return normalizeText(editor.innerText || editor.textContent || '');
        };

        const readComposerText = (scope) => {
          const editor = findActualComposerEditor(scope);
          return getActualEditorText(editor);
        };

        const getTextDebug = (scope, editor) => {
          const rootText = normalizeText(scope?.root?.textContent || '');
          const editorText = getActualEditorText(editor);
          return {
            editorFound: !!editor,
            editorTag: editor?.tagName || null,
            editorClass: String(editor?.className || '').slice(0, 120),
            editorTextLen: editorText.length,
            editorTextPreview: editorText.slice(0, 160),
            rootTextLen: rootText.length,
            rootTextPreview: rootText.slice(0, 160),
          };
        };

        const countComposerImages = (scope) => {
          const selectors = [
            'img[src^="blob:"]',
            'img[src^="data:"]',
            '[class*="thumb" i]',
            '[class*="preview" i]',
            '[class*="attachment" i]',
            '[aria-label*="image" i]',
            '[aria-label*="file" i]',
          ].join(',');
          const seen = new Set();
          for (const el of Array.from(scope.root.querySelectorAll(selectors))) {
            if (!scope.root.contains(el) || isBlocked(el) || !isVisible(el)) continue;
            seen.add(el);
          }
          return seen.size;
        };

        const inspectComposerSettings = (scope) => {
          const expectedSettings = options?.expectedSettings || {};
          const allowedSettingKeys = ['ratio', 'resolution', 'duration'];
          const ignoredKeys = Object.keys(expectedSettings).filter(key => !allowedSettingKeys.includes(key));
          ignoredKeys.forEach(key => console.warn(`[SF pre-click settings] Bỏ qua metadata key: ${key}`));
          const state = options?.settingsState || {};
          const ratioVerifiedBeforeAttach = state.ratioVerifiedBeforeAttach === true || options?.ratioVerifiedBeforeAttach === true;
          const resolutionVerified = state.resolutionVerified === true;
          const durationVerified = state.durationVerified === true;
          const skipRatio = options?.skipRatio === true || ratioVerifiedBeforeAttach === true;
          const ratioMap = {
            '9:16': ['9:16', '9/16', 'vertical', 'portrait', 'shorts'],
            '16:9': ['16:9', '16/9', 'widescreen', 'landscape'],
            '1:1': ['1:1', '1/1', 'square'],
            '2:3': ['2:3', '2/3', 'tall'],
            '3:2': ['3:2', '3/2', 'wide'],
          };
          const maps = {
            ratio: ratioMap,
            resolution: {
              '480p': ['480p', '480 p'],
              '720p': ['720p', '720 p'],
            },
            duration: {
              '6s': ['6s', '6 sec', '6sec', '6 second'],
              '10s': ['10s', '10 sec', '10sec', '10 second'],
            },
          };
          const read = (el) => [
            el.textContent,
            el.getAttribute?.('aria-label'),
            el.getAttribute?.('aria-description'),
            el.getAttribute?.('data-value'),
            el.getAttribute?.('title'),
            el.getAttribute?.('value'),
          ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
          const methodFor = (el) => {
            if (['aria-pressed', 'aria-checked', 'data-active', 'data-checked'].some(attr => String(el.getAttribute?.(attr) || '').toLowerCase() === 'true')) return 'active-control';
            if (['aria-selected', 'data-selected'].some(attr => String(el.getAttribute?.(attr) || '').toLowerCase() === 'true')) return 'selected-control';
            const state = String(el.getAttribute?.('data-state') || '').toLowerCase();
            if (state === 'checked' || state === 'active') return 'active-control';
            if (state === 'selected') return 'selected-control';
            const cls = String(el.getAttribute?.('class') || el.className || '').toLowerCase();
            if (/\b(active|checked)\b/.test(cls)) return 'active-control';
            if (/\bselected\b/.test(cls)) return 'selected-control';
            return null;
          };
          const inactive = (el) => ['aria-pressed', 'aria-checked', 'aria-selected', 'data-selected', 'data-active', 'data-checked']
            .some(attr => String(el.getAttribute?.(attr) || '').toLowerCase() === 'false');
          const detect = (settingType, text) => {
            for (const [value, aliases] of Object.entries(maps[settingType] || {})) {
              if (aliases.some(alias => text.includes(String(alias).toLowerCase()))) return value;
            }
            return null;
          };
          const controls = Array.from(scope.root.querySelectorAll(
            'button,[role="button"],[role="radio"],label,[data-value],[title],[aria-pressed],[aria-checked]'
          )).filter(el => scope.root.contains(el) && isVisible(el) && !isBlocked(el));
          const inspectSoft = (settingType, expected) => {
            const items = controls.map(el => ({ el, text: read(el), method: methodFor(el), inactive: inactive(el) }))
              .map(item => ({ ...item, detectedValue: detect(settingType, item.text) }))
              .filter(item => item.detectedValue || item.text.includes(String(expected).toLowerCase()));
            const active = items.find(item => item.method && item.detectedValue);
            const selected = items.find(item => item.detectedValue === expected && !item.inactive);
            const chosen = active || selected || items[0] || null;
            return {
              detectedValue: chosen?.detectedValue || null,
              method: chosen?.method || (chosen?.detectedValue === expected ? 'selected-display' : 'not-detected'),
              candidates: items.slice(0, 8).map(item => ({ text: item.text, detectedValue: item.detectedValue, method: item.method })),
            };
          };
          const results = {};
          const fail = (settingType, expected, reason, soft = {}) => {
            results[settingType] = {
              ok: false,
              expectedValue: expected,
              detectedValue: soft.detectedValue || null,
              method: soft.method || 'verified-state',
              reason,
              candidates: soft.candidates || [],
            };
          };
          for (const settingType of allowedSettingKeys) {
            const expected = expectedSettings?.[settingType];
            if (settingType === 'ratio' && skipRatio) {
              results.ratio = {
                ok: ratioVerifiedBeforeAttach,
                expectedValue: expected,
                detectedValue: ratioVerifiedBeforeAttach ? expected : null,
                method: ratioVerifiedBeforeAttach ? 'verified-before-attach' : 'not-verified',
                skipped: true,
                reason: ratioVerifiedBeforeAttach ? null : 'ratio_not_verified_before_attach',
              };
              continue;
            }
            if (!expected) continue;
            const soft = inspectSoft(settingType, expected);
            const stateVerified = settingType === 'resolution' ? resolutionVerified : (settingType === 'duration' ? durationVerified : false);
            if (!stateVerified) {
              fail(settingType, expected, `${settingType}_not_verified`, soft);
              continue;
            }
            if (soft.detectedValue && soft.detectedValue !== expected) {
              fail(settingType, expected, `${settingType}_mismatch`, soft);
              continue;
            }
            results[settingType] = {
              ok: true,
              expectedValue: expected,
              detectedValue: soft.detectedValue || null,
              method: soft.detectedValue ? (soft.method || 'soft-check') : 'verified-state',
              stateVerified: true,
              softCheck: soft.detectedValue ? 'matched' : 'not-detected',
              candidates: soft.candidates,
            };
          }
          const failedSetting = Object.entries(results).find(([, res]) => !res.ok)?.[0] || null;
          if (failedSetting) {
            console.log('[SF pre-click settings] FAIL', {
              setting: failedSetting,
              reason: results[failedSetting]?.reason,
              expectedValue: results[failedSetting]?.expectedValue,
              detectedValue: results[failedSetting]?.detectedValue,
            });
          } else if (Object.values(results).some(res => res.softCheck === 'not-detected')) {
            console.log('[SF pre-click settings] soft-check not detected, using verified state', {
              sceneId: options?.sceneId,
              ratioBeforeAttach: ratioVerifiedBeforeAttach,
              resolutionVerified,
              durationVerified,
            });
          }
          console.log('[SF pre-click settings]', {
            sceneId: options?.sceneId,
            pass: failedSetting ? 'no' : 'yes',
            method: 'verified-state',
            ratioBeforeAttach: ratioVerifiedBeforeAttach,
            resolutionVerified,
            durationVerified,
            ignoredKeys,
          });
          return {
            ok: !failedSetting,
            failedSetting,
            results,
            ignoredKeys,
            ratioVerifiedBeforeAttach,
            resolutionVerified,
            durationVerified,
            method: 'verified-state',
          };
        };

        const inspectPreClickPayload = () => {
          const sceneId = options?.sceneId;
          if (options?.preClickGuard !== true) {
            return { ok: true, pass: true, skipped: true, sceneId, reason: 'preClickGuard disabled' };
          }
          const scope = options?.scope === 'bottomComposer' ? findBottomComposerScope() : null;
          if (!scope) {
            return { ok: false, pass: false, sceneId, code: 'bottom_composer_missing', textLen: 0, imageCount: 0 };
          }
          const editor = findActualComposerEditor(scope);
          const textDebug = getTextDebug(scope, editor);
          const composerText = getActualEditorText(editor);
          const textLen = composerText.length;
          const imageCount = countComposerImages(scope);
          const requireText = options?.requireText !== false;
          const requireImage = options?.requireImage === true;
          const minTextChars = Math.max(1, Number(options?.minTextChars || 20));
          const minImages = Math.max(1, Number(options?.minImages || 1));
          const exactImages = options?.exactImages != null ? Math.max(0, Number(options.exactImages)) : null;
          const maxImages = options?.maxImages != null ? Math.max(0, Number(options.maxImages)) : null;
          const textOk = !requireText || (!!editor && textLen >= minTextChars);
          const imageOk = !requireImage
            || (exactImages != null
              ? imageCount === exactImages
              : (imageCount >= minImages && (maxImages == null || imageCount <= maxImages)));
          const requireSettings = options?.requireSettings === true;
          const settings = requireSettings ? inspectComposerSettings(scope) : { ok: true, skipped: true };
          const settingsOk = !requireSettings || settings.ok;
          console.log('[SF pre-click payload]', {
            sceneId,
            textLen,
            imageCount,
            pass: textOk && imageOk ? 'yes' : 'no',
          });
          console.log('[I2V submit debug]', {
            sceneId,
            beforeClickEditorTextLen: textDebug.editorTextLen,
            rootTextLen: textDebug.rootTextLen,
            editorTextPreview: textDebug.editorTextPreview,
            expectedTextPreview: normalizeText(options?.expectedText || '').slice(0, 160),
          });
          const payloadCode = textOk
            ? (imageOk ? (settingsOk ? null : 'settings_mismatch') : (imageCount < minImages || (exactImages != null && imageCount < exactImages) ? 'image_missing' : 'image_too_many'))
            : 'text_missing';
          return {
            ok: textOk && imageOk && settingsOk,
            pass: textOk && imageOk && settingsOk,
            sceneId,
            textLen,
            editorTextLen: textDebug.editorTextLen,
            rootTextLen: textDebug.rootTextLen,
            editorTextPreview: textDebug.editorTextPreview,
            rootTextPreview: textDebug.rootTextPreview,
            imageCount,
            requireText,
            requireImage,
            requireSettings,
            minTextChars,
            minImages,
            maxImages,
            exactImages,
            settings,
            code: payloadCode,
            error: payloadCode === 'text_missing' ? 'Prompt text missing from actual editor before submit' : null,
          };
        };

        const tryClick = () => {
          attempts++;
          console.log(`[GPI-submit] attempt #${attempts}/${maxAttempts}`);
          if (options?.scope === 'bottomComposer') {
            const scope = findBottomComposerScope();
            if (!scope) return resolve({ ok: false, error: 'Bottom composer not found' });
            const buttons = Array.from(scope.root.querySelectorAll('button,[role="button"]'))
              .filter(b => !tried.has(b) && isLikelySubmit(b, scope.input, true) && !isBlocked(b));
            const btn = rightmost(buttons);
            if (btn) return clickAndVerify(btn, 'bottom-composer-rightmost');
            if (attempts >= maxAttempts) return resolve({ ok: false, error: 'No submit button in bottom composer' });
            return setTimeout(tryClick, pollMs);
          }

          const inputEl = findInput();

          // ── Strategy 1: aria-label / type / data-testid ──────────────────────
          const ariaSelectors = [
            'button[aria-label*="Send" i]', 'button[aria-label*="Grok" i]',
            'button[aria-label*="Generate" i]', 'button[aria-label*="Submit" i]',
            'button[type="submit"]',
            'button[data-testid*="send" i]', 'button[data-testid*="submit" i]',
          ];
          for (const s of ariaSelectors) {
            const b = Array.from(document.querySelectorAll(s)).find(b => !tried.has(b) && isLikelySubmit(b, inputEl, false));
            if (b) { console.log('[GPI-submit] ✅ aria:', s); return clickAndVerify(b, 'aria:' + s); }
          }

          // ── Strategy 2: button trong form > div.absolute (bottom-right) ──────
          const rootForm = inputEl?.closest('form');
          const forms = Array.from(document.querySelectorAll('form'));
          const orderedForms = rootForm ? [rootForm, ...forms.filter(f => f !== rootForm)] : forms;
          for (const form of orderedForms) {
            const absDivs = Array.from(form.querySelectorAll('div.absolute')).filter(d => {
              const cls = d.className || '';
              return (cls.includes('right-') || cls.includes('end-')) && cls.includes('bottom-');
            });
            for (const div of absDivs) {
              const btns = Array.from(div.querySelectorAll('button'))
                .filter(b => !tried.has(b) && isLikelySubmit(b, inputEl, true));
              const btn = rightmost(btns);
              if (btn) { console.log('[GPI-submit] ✅ form-abs-div'); return clickAndVerify(btn, 'form-abs-div'); }
            }
            const svgBtns = Array.from(form.querySelectorAll('button'))
              .filter(b => !tried.has(b) && isLikelySubmit(b, inputEl, true));
            if (svgBtns.length) {
              const btn = rightmost(svgBtns);
              console.log('[GPI-submit] ✅ form-svg');
              return clickAndVerify(btn, 'form-svg');
            }
          }

          // ── Strategy 3: leo DOM từ input, tìm button anh em ──────────────────
          // Đây là cách chắc chắn nhất cho /saved và /imagine
          if (inputEl) {
            let node = inputEl.parentElement;
            for (let depth = 0; depth < 10 && node && node !== document.body; depth++, node = node.parentElement) {
              // Lấy TẤT CẢ button trong container cha này (không filter SVG để không miss)
              const btns = Array.from(node.querySelectorAll('button'))
                .filter(b => !tried.has(b) && isLikelySubmit(b, inputEl, true));
              // Loại trừ button có text (thường là navigation/label button)
              const iconBtns = btns.filter(b => {
                const txt = (b.textContent || '').trim();
                // Nút submit thường: không có text, hoặc text rất ngắn, hoặc có SVG
                return b.querySelector('svg') && txt.length < 20;
              });
              if (iconBtns.length > 0) {
                const btn = rightmost(iconBtns);
                const r = btn.getBoundingClientRect();
                console.log(`[GPI-submit] ✅ near-input depth=${depth} btn at x=${Math.round(r.right)},y=${Math.round(r.bottom)} size=${Math.round(r.width)}x${Math.round(r.height)}`);
                return clickAndVerify(btn, `near-input-d${depth}`);
              }
            }
          }

          // ── Strategy 4: button SVG nhỏ ở góc dưới màn hình ─────────────────
          {
            const vh = window.innerHeight;
            const allBtns = Array.from(document.querySelectorAll('button'))
              .filter(b => !tried.has(b) && isLikelySubmit(b, inputEl, true));
            // Button submit tròn của Grok thường 32–48px, nằm ở nửa dưới màn hình
            const smallLow = allBtns.filter(b => {
              const r = b.getBoundingClientRect();
              return r.bottom > vh * 0.55 && r.width >= 28 && r.width <= 56;
            });
            if (smallLow.length > 0) {
              const btn = rightmost(smallLow);
              const r = btn.getBoundingClientRect();
              console.log(`[GPI-submit] ✅ small-low btn at x=${Math.round(r.right)},y=${Math.round(r.bottom)}`);
              return clickAndVerify(btn, 'small-low-svg');
            }
          }

          // ── Strategy 5 (last): Enter key ────────────────────────────────────
          if (attempts >= maxAttempts) {
            if (once) {
              return resolve({ ok: false, error: 'Submit button not found in one-click mode', clickCount });
            }
            const inputEl2 = findInput();
            if (inputEl2) {
              console.log('[GPI-submit] ⚠ fallback Enter key');
              inputEl2.focus();
              ['keydown','keypress','keyup'].forEach(type => {
                inputEl2.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
              });
              setTimeout(() => {
                const afterText = ((inputEl2.value ?? inputEl2.textContent) || '').trim();
                const busy = !!document.querySelector('[aria-busy="true"],[class*="loading" i],[class*="generating" i],[class*="pending" i],[role="progressbar"]');
                if (afterText.length === 0 || busy) return resolve({ ok: true, method: 'enter-key', verified: true });
                return resolve({ ok: false, error: 'Không tìm thấy submit button hoặc click không được xác nhận' });
              }, 1000);
              return;
            }
            return resolve({ ok: false, error: 'Không tìm thấy submit button' });
          }
          setTimeout(tryClick, pollMs);
        };
        setTimeout(tryClick, 200);
      });
    },
    args: [timeoutMs, pollMs, options],
  });
  return results?.[0]?.result || { ok: false, error: 'Script thất bại' };
}

async function submitImg2VidAtomically(tabId, options = {}) {
  const sceneId = options.sceneId || '';
  const displayName = options.displayName || options.sceneId || 'Cảnh hiện tại';
  const expectedText = String(options.expectedText || '');
  const minTextChars = Math.max(1, Number(options.minTextChars || 20));
  const maxTextRetry = Math.max(0, Number(options.maxTextRetry ?? 2));
  const sceneRuntime = getI2VSceneRuntime(sceneId);
  if (isI2VSceneSubmittedState(sceneRuntime)) {
    addLog(i2vLogEl, `⚠ [Img2Vid] ${displayName} đã ở trạng thái ${sceneRuntime.state}, chặn submit lặp để tránh tạo nhiều video.`, 'warn');
    return {
      ok: false,
      code: 'scene_already_submitted',
      error: 'Scene này đã submit hoặc đang generate',
      clicked: false,
      buttonFound: false,
      buttonDisabled: null,
      sameRoot: false,
      sceneState: sceneRuntime.state,
      submitClicks: sceneRuntime.submitClicks,
    };
  }
  addLog(i2vLogEl, `[I2V submit lock] ${displayName} lock=${currentI2VSubmittingSceneId ? 'busy' : 'none'} submitted=${submittedI2VSceneIds.has(sceneId) ? 'yes' : 'no'}`, 'info');
  if (currentI2VSubmittingSceneId && currentI2VSubmittingSceneId !== sceneId) {
    addLog(i2vLogEl, `[I2V submit lock] ${displayName} đã có job đang generate, không submit thêm.`, 'warn');
    return {
      ok: false,
      code: 'submit_lock_busy',
      error: 'Đang có scene khác trong trạng thái submit/generate, không click thêm.',
      clicked: false,
      buttonFound: false,
      buttonDisabled: null,
      sameRoot: false,
    };
  }
  if ((currentI2VSubmittingSceneId === sceneId && sceneId) || submittedI2VSceneIds.has(sceneId)) {
    addLog(i2vLogEl, `[I2V submit lock] ${displayName} đã submit trước đó, chặn click lặp để tránh tạo nhiều video và hao token.`, 'warn');
    return {
      ok: false,
      code: 'duplicate_submit_blocked',
      error: 'Scene này đã được submit một lần, không submit lại.',
      clicked: false,
      buttonFound: false,
      buttonDisabled: null,
      sameRoot: false,
    };
  }
  currentI2VSubmittingSceneId = sceneId;
  sceneRuntime.state = 'submit_clicked';
  sceneRuntime.submitClicks += 1;
  if (sceneRuntime.submitClicks > 1) {
    if (currentI2VSubmittingSceneId === sceneId) currentI2VSubmittingSceneId = null;
    addLog(i2vLogEl, `❌ [Img2Vid] ${displayName} bị phát hiện submit lần 2`, 'err');
    addLog(i2vLogEl, 'Bước: Submit', 'err');
    addLog(i2vLogEl, 'Mã lỗi: duplicate_submit_blocked', 'err');
    addLog(i2vLogEl, 'Chi tiết: Scene đã có 1 submit hợp lệ trước đó.', 'err');
    addLog(i2vLogEl, 'Hành động: Chặn click để tránh hao token.', 'warn');
    return {
      ok: false,
      code: 'duplicate_submit_blocked',
      error: 'Scene đã có 1 submit hợp lệ trước đó.',
      clicked: false,
      sceneState: sceneRuntime.state,
      submitClicks: sceneRuntime.submitClicks,
    };
  }
  addLog(i2vLogEl, `[I2V scene state] ${displayName} -> submit_clicked`, 'info');
  addLog(i2vLogEl, `[I2V submit lock] ${displayName} giữ lock trước khi click, chưa đánh dấu accepted`, 'info');
  addLog(i2vLogEl, `[I2V atomic submit] ${displayName}: kiểm tra text + ảnh trong cùng composer.`, 'info');
  let result;
  try {
    result = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (opts) => {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      const expectedText = String(opts.expectedText || '');
      const minTextChars = Math.max(1, Number(opts.minTextChars || 20));
      const maxTextRetry = Math.max(0, Number(opts.maxTextRetry ?? 2));
      const normalizePromptText = (text) => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const normalizeText = (text) => String(text || '').replace(/\s+/g, ' ').trim();
      const promptMatchesEditor = (editorText, expected) => {
        const e = normalizePromptText(editorText);
        const x = normalizePromptText(expected);
        if (!e || !x) return false;
        if (e.length < minTextChars) return false;
        if (e === x) return true;
        const xPrefix = x.slice(0, Math.min(120, x.length));
        const ePrefix = e.slice(0, Math.min(120, e.length));
        if (xPrefix.length >= 30 && e.includes(xPrefix)) return true;
        if (e.length > 80 && ePrefix.length >= 30 && x.includes(ePrefix)) return true;
        return false;
      };
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
      const findBottomComposerScope = () => {
        const selectors = [
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'input[placeholder*="Imagine" i]',
          'input[placeholder*="Describe" i]',
          'input[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
          'input',
        ].join(',');
        return Array.from(document.querySelectorAll(selectors))
          .filter(input => isVisible(input) && !isBlocked(input))
          .map(input => {
            let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
            if (!root) {
              let node = input.parentElement;
              for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                if (node.querySelector('button,[role="button"],label,input[type="file"]')) { root = node; break; }
              }
            }
            if (!root || root === document.body || isBlocked(root)) return null;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
            return isBottom ? { input, root, inputRect, rootRect } : null;
          })
          .filter(Boolean)
          .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
      };
      const findActualComposerEditor = (scope) => {
        const root = scope?.root;
        if (!root) return null;
        const selectors = [
          '[data-testid="chat-input"] div[contenteditable="true"]',
          '[data-testid="chat-input"] [contenteditable="true"]',
          'div[contenteditable="true"].ProseMirror',
          'div[contenteditable="true"][translate="no"]',
          'div[contenteditable="true"]',
          'textarea',
          'input',
        ];
        return Array.from(root.querySelectorAll(selectors.join(',')))
          .filter(el => root.contains(el) && isVisible(el) && !isBlocked(el))
          .map(el => {
            const r = el.getBoundingClientRect();
            return {
              el,
              score: (el.closest('[data-testid="chat-input"]') ? 100 : 0)
                + (String(el.className || '').includes('ProseMirror') ? 80 : 0)
                + (el.isContentEditable ? 40 : 0)
                + Math.round(r.bottom / 100),
            };
          })
          .sort((a, b) => b.score - a.score)[0]?.el || scope.input || null;
      };
      const getEditorText = (editor) => {
        if (!editor) return '';
        if ('value' in editor) return normalizeText(editor.value || '');
        return normalizeText(editor.innerText || editor.textContent || '');
      };
      const rectSummary = (el) => {
        const r = el?.getBoundingClientRect?.() || {};
        return { x: Math.round(r.left || 0), y: Math.round(r.top || 0), w: Math.round(r.width || 0), h: Math.round(r.height || 0) };
      };
      const dispatchTextEvents = (editor, text) => {
        try {
          editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
        } catch {}
        try {
          editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
        } catch {
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        editor.dispatchEvent(new Event('change', { bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
      };
      const setEditorTextLikeUser = (editor, text) => {
        editor.focus();
        if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
          const proto = editor.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(editor, text); else editor.value = text;
          dispatchTextEvents(editor, text);
        } else {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          selection.removeAllRanges();
          selection.addRange(range);
          range.deleteContents();
          let inserted = false;
          try { inserted = document.execCommand('insertText', false, text); } catch { inserted = false; }
          dispatchTextEvents(editor, text);
          if (!inserted || !promptMatchesEditor(getEditorText(editor), text)) {
            try {
              const dt = new DataTransfer();
              dt.setData('text/plain', text);
              editor.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
            } catch {}
          }
        }
      };
      const countImages = (scope) => {
        const selectors = [
          'img[src^="blob:"]',
          'img[src^="data:"]',
          '[class*="thumb" i]',
          '[class*="preview" i]',
          '[class*="attachment" i]',
          '[aria-label*="image" i]',
          '[aria-label*="file" i]',
        ].join(',');
        const seen = new Set();
        for (const el of Array.from(scope.root.querySelectorAll(selectors))) {
          if (!scope.root.contains(el) || isBlocked(el) || !isVisible(el)) continue;
          seen.add(el);
        }
        return seen.size;
      };
      const isEnabled = (btn) => btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true' && !btn.closest('[aria-disabled="true"]');
      const isDisabled = (btn) => !isEnabled(btn);
      const buttonText = (btn) => [btn.getAttribute('aria-label'), btn.getAttribute('title'), btn.getAttribute('data-testid'), btn.textContent].filter(Boolean).join(' ').toLowerCase();
      const findSubmitButton = (scope) => {
        const rootRect = scope.root.getBoundingClientRect();
        const buttons = Array.from(scope.root.querySelectorAll('button,[role="button"]'))
          .filter(btn => isVisible(btn) && isEnabled(btn) && !isBlocked(btn))
          .filter(btn => {
            const hay = buttonText(btn);
            if (/\b(attach|upload|image|photo|file|remove|delete|close|clear|cancel|mic|voice|menu|option|more|edit)\b/.test(hay)) return false;
            const explicit = /\b(send|submit|generate|grok)\b/.test(hay);
            const r = btn.getBoundingClientRect();
            const rightish = r.right > rootRect.right - 160 && r.bottom >= rootRect.top;
            return explicit || (rightish && !!btn.querySelector('svg'));
          })
          .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
        return buttons[0] || null;
      };
      const trustedClick = (el) => {
        el.scrollIntoView({ block: 'center', inline: 'center' });
        el.focus();
        try {
          window.__gpiI2VActiveSceneId = opts.sceneId || window.__gpiI2VActiveSceneId || '';
        } catch {}
        try { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' })); } catch {}
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        try { el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' })); } catch {}
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      };

      const scope = findBottomComposerScope();
      if (!scope) return { ok: false, code: 'composer_not_found', error: 'Bottom composer not found', clicked: false, editorFound: false, editorTextLen: 0, editorTextPreview: '', expectedTextPreview: normalizeText(expectedText).slice(0, 160), promptMatch: false, imageCount: 0, buttonFound: false, buttonDisabled: null, sameRoot: false };
      const editor = findActualComposerEditor(scope);
      let editorText = getEditorText(editor);
      let imageCount = countImages(scope);
      let button = findSubmitButton(scope);
      let sameRoot = !!(editor && button && scope.root.contains(editor) && scope.root.contains(button));
      let promptMatch = promptMatchesEditor(editorText, expectedText);
      const expectedTextPreview = normalizeText(expectedText).slice(0, 160);
      const baseDebug = () => ({
        editorFound: !!editor,
        editorTextLen: editorText.length,
        editorTextPreview: editorText.slice(0, 160),
        expectedTextPreview,
        promptMatch,
        imageCount,
        rootTextLen: normalizeText(scope?.root?.innerText || scope?.root?.textContent || '').length,
        rootTextPreview: normalizeText(scope?.root?.innerText || scope?.root?.textContent || '').slice(0, 160),
        buttonFound: !!button,
        buttonDisabled: button ? isDisabled(button) : null,
        sameRoot,
        rootRect: rectSummary(scope?.root),
        editorRect: rectSummary(editor),
        buttonRect: rectSummary(button),
        buttonCenter: button ? (() => {
          const r = button.getBoundingClientRect();
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })() : null,
      });
      if (imageCount < 1) return { ok: false, code: 'image_missing_before_atomic_submit', error: 'Reference image missing before atomic submit', clicked: false, ...baseDebug() };
      if (!editor) return { ok: false, code: 'text_missing_before_submit', error: 'Không có prompt text trong editor thật trước submit.', clicked: false, ...baseDebug() };
      if (!promptMatch || editorText.length < minTextChars) {
        for (let attempt = 1; attempt <= maxTextRetry + 1; attempt++) {
          setEditorTextLikeUser(editor, expectedText);
          await sleep(350);
          editorText = getEditorText(editor);
          promptMatch = promptMatchesEditor(editorText, expectedText);
          if (promptMatch && editorText.length >= minTextChars) break;
        }
      } else {
        await sleep(120);
        editorText = getEditorText(editor);
        promptMatch = promptMatchesEditor(editorText, expectedText);
      }
      imageCount = countImages(scope);
      button = findSubmitButton(scope);
      sameRoot = !!(editor && button && scope.root.contains(editor) && scope.root.contains(button));
      editorText = getEditorText(editor);
      promptMatch = promptMatchesEditor(editorText, expectedText);
      if (!promptMatch) return { ok: false, code: 'text_missing_before_submit', error: 'Prompt text does not match expected scene prompt before atomic submit', clicked: false, ...baseDebug() };
      if (editorText.length < minTextChars) return { ok: false, code: 'text_missing_before_submit', error: 'Không có prompt text trong editor thật trước submit.', clicked: false, ...baseDebug() };
      if (imageCount < 1) return { ok: false, code: 'image_missing_before_atomic_submit', error: 'Reference image missing before atomic submit', clicked: false, ...baseDebug() };
      if (!button) return { ok: false, code: 'submit_button_not_found', error: 'Submit button not found', clicked: false, ...baseDebug(), sameRoot: false };
      if (isDisabled(button)) return { ok: false, code: 'submit_button_disabled', error: 'Submit button is disabled before atomic submit', clicked: false, ...baseDebug() };
      if (!sameRoot) return { ok: false, code: 'submit_root_mismatch', error: 'Editor and submit button are not in same composer root', clicked: false, ...baseDebug() };
      button.scrollIntoView({ block: 'center', inline: 'center' });
      button.focus();
      return {
        ok: true,
        code: null,
        clicked: false,
        readyToPageClick: true,
        accepted: false,
        strongAccepted: false,
        method: 'atomic-i2v-verified-before-page-click',
        ...baseDebug(),
      };
    },
    args: [{ expectedText, minTextChars, maxTextRetry, sceneId }],
  });
  } catch (err) {
    result = [{ result: { ok: false, code: 'atomic_submit_failed', error: err?.message || String(err), clicked: false } }];
  }
  const res = result?.[0]?.result || { ok: false, code: 'atomic_submit_failed', error: 'Atomic submit script failed', clicked: false };
  if (res.ok && res.readyToPageClick && !res.clicked) {
    addLog(i2vLogEl, `[I2V click] ${displayName} payload OK, submit bằng CDP native click.`, 'info');
    const submitAttempt = await submitComposerWithCDPAndAccepted(tabId, {
      feature: 'Img2Vid',
      sceneId,
      displayName,
      expectedText,
      requireText: true,
      requireImage: true,
      minImages: 1,
      minTextChars,
      scope: 'bottomComposer',
      timeoutMs: options.acceptTimeoutMs || 10000,
      pollMs: options.pollMs || 250,
    });
    Object.assign(res, {
      ...submitAttempt,
      clicked: submitAttempt.clicked === true,
      accepted: submitAttempt.accepted === true,
      strongAccepted: submitAttempt.strongAccepted === true,
      acceptedReason: submitAttempt.acceptedReason || submitAttempt.reason || 'no-submit-signal',
      ok: submitAttempt.accepted === true && submitAttempt.strongAccepted === true,
      code: submitAttempt.accepted === true && submitAttempt.strongAccepted === true ? null : (submitAttempt.code || 'submit_not_accepted'),
      error: submitAttempt.accepted === true && submitAttempt.strongAccepted === true ? null : (submitAttempt.error || 'Đã click nút submit nhưng chưa phát hiện Grok nhận job.'),
    });
  }
  if (!res.ok || !res.accepted || !res.strongAccepted) {
    if (currentI2VSubmittingSceneId === sceneId) currentI2VSubmittingSceneId = null;
    submittedI2VSceneIds.delete(sceneId);
    sceneRuntime.state = 'failed';
    sceneRuntime.lastError = res.error || res.code;
  } else {
    submittedI2VSceneIds.add(sceneId);
    sceneRuntime.state = 'submit_accepted';
  }
  addLog(i2vLogEl, `[I2V atomic submit] ${displayName}: editorFound=${res.editorFound ? 'yes' : 'no'} editorTextLen=${res.editorTextLen || 0}`, res.ok ? 'info' : 'warn');
  addLog(i2vLogEl, `[I2V atomic submit] ${displayName}: promptMatch=${res.promptMatch ? 'yes' : 'no'}`, res.promptMatch ? 'info' : 'warn');
  addLog(i2vLogEl, `[I2V atomic submit] ${displayName}: imageCount=${res.imageCount || 0}`, res.imageCount >= 1 ? 'info' : 'err');
  if (res.ok && res.accepted && res.strongAccepted) addLog(i2vLogEl, `[I2V atomic submit] ${displayName}: PASS, Grok đã nhận submit.`, 'ok');
  else if (res.clicked) addLog(i2vLogEl, `[I2V atomic submit] ${displayName}: đã click nhưng Grok chưa nhận submit.`, 'err');
  else if (res.code === 'image_missing_before_atomic_submit') addLog(i2vLogEl, `[I2V atomic submit] ${displayName}: FAIL thiếu ảnh tham chiếu trước submit.`, 'err');
  else if (res.code === 'text_missing_before_submit' || res.code === 'text_missing_before_atomic_submit' || res.code === 'prompt_mismatch_before_atomic_submit') {
    if ((res.rootTextLen || 0) > 0 && (res.editorTextLen || 0) === 0) {
      addLog(i2vLogEl, `[I2V guard] ${displayName} editorTextLen=0, rootTextLen=${res.rootTextLen} nhưng editor rỗng -> KHÔNG submit.`, 'err');
    }
    addLog(i2vLogEl, `[I2V atomic submit] ${displayName}: BLOCK chỉ có ảnh hoặc prompt chưa nằm trong editor thật, không submit.`, 'err');
  }
  else addLog(i2vLogEl, `[I2V atomic submit] ${displayName}: FAIL ${sanitizeUserError(res.error || res.code, options)}`, 'err');
  return {
    ...res,
    payloadOk: res.editorFound === true && res.promptMatch === true && (res.imageCount || 0) >= 1,
    ok: res.accepted === true && res.strongAccepted === true,
    code: res.accepted === true && res.strongAccepted === true ? null : (res.code || 'submit_not_accepted'),
  };
}

async function waitImg2VidPromptCommitStable(tabId, expectedPrompt, options = {}) {
  const displayName = options.displayName || options.sceneId || 'Cảnh hiện tại';
  const stableMs = Math.max(100, Number(options.stableMs || 800));
  const timeoutMs = Math.max(stableMs + 200, Number(options.timeoutMs || 5000));
  const minTextChars = Math.max(1, Number(options.minTextChars || Math.min(80, Math.max(20, Math.floor(String(expectedPrompt || '').length * 0.15)))));
  const startedAt = Date.now();
  let stableStart = null;
  let lastSample = null;
  while (Date.now() - startedAt < timeoutMs) {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (expectedPrompt, minTextChars) => {
        const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
        const normalizePrompt = (text) => normalize(text).toLowerCase();
        const promptMatches = (editorText, expected) => {
          const a = normalizePrompt(editorText);
          const b = normalizePrompt(expected);
          if (!a || !b || a.length < minTextChars) return false;
          if (a === b) return true;
          const bPrefix = b.slice(0, Math.min(120, b.length));
          const aPrefix = a.slice(0, Math.min(120, a.length));
          if (bPrefix.length >= 30 && a.includes(bPrefix)) return true;
          if (a.length > 80 && aPrefix.length >= 30 && b.includes(aPrefix)) return true;
          return false;
        };
        const isVisible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
        };
        const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
        const findBottomComposerScope = () => {
          const selectors = [
            'textarea[placeholder*="Type to imagine" i]',
            'textarea[placeholder*="Imagine" i]',
            'textarea[placeholder*="Describe" i]',
            'textarea[placeholder*="Enter" i]',
            'input[placeholder*="Imagine" i]',
            'input[placeholder*="Describe" i]',
            'input[placeholder*="Enter" i]',
            'div[contenteditable="true"][data-lexical-editor]',
            'div[contenteditable="true"]',
            'textarea',
            'input',
          ].join(',');
          return Array.from(document.querySelectorAll(selectors))
            .filter(input => isVisible(input) && !isBlocked(input))
            .map(input => {
              let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
              if (!root) {
                let node = input.parentElement;
                for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                  if (node.querySelector('button,[role="button"],label,input[type="file"]')) { root = node; break; }
                }
              }
              if (!root || root === document.body || isBlocked(root)) return null;
              const inputRect = input.getBoundingClientRect();
              const rootRect = root.getBoundingClientRect();
              return (inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75)
                ? { input, root, inputRect, rootRect }
                : null;
            })
            .filter(Boolean)
            .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
        };
        const findActualEditor = (scope) => {
          const root = scope?.root;
          if (!root) return null;
          const selectors = [
            '[data-testid="chat-input"] div[contenteditable="true"]',
            '[data-testid="chat-input"] [contenteditable="true"]',
            'div[contenteditable="true"].ProseMirror',
            'div[contenteditable="true"][translate="no"]',
            'div[contenteditable="true"]',
            'textarea',
            'input',
          ].join(',');
          return Array.from(root.querySelectorAll(selectors))
            .filter(el => root.contains(el) && isVisible(el) && !isBlocked(el))
            .map(el => {
              const r = el.getBoundingClientRect();
              return {
                el,
                score: (el.closest('[data-testid="chat-input"]') ? 100 : 0)
                  + (String(el.className || '').includes('ProseMirror') ? 80 : 0)
                  + (el.isContentEditable ? 40 : 0)
                  + Math.round(r.bottom / 100),
              };
            })
            .sort((a, b) => b.score - a.score)[0]?.el || scope.input || null;
        };
        const scope = findBottomComposerScope();
        if (!scope) return { ok: false, code: 'bottom_composer_missing', editorFound: false, editorTextLen: 0, rootTextLen: 0, promptMatch: false };
        const editor = findActualEditor(scope);
        const editorText = editor ? normalize('value' in editor ? editor.value : (editor.innerText || editor.textContent || '')) : '';
        const rootText = normalize(scope.root.innerText || scope.root.textContent || '');
        const match = promptMatches(editorText, expectedPrompt);
        return {
          ok: !!editor && match && editorText.length >= minTextChars,
          code: !editor ? 'text_missing_before_submit' : !match ? 'text_missing_before_submit' : null,
          editorFound: !!editor,
          editorTextLen: editorText.length,
          editorTextPreview: editorText.slice(0, 160),
          rootTextLen: rootText.length,
          rootTextPreview: rootText.slice(0, 160),
          promptMatch: match,
        };
      },
      args: [expectedPrompt, minTextChars],
    });
    lastSample = result?.[0]?.result || { ok: false, code: 'script_failed', editorTextLen: 0, rootTextLen: 0, promptMatch: false };
    if (lastSample.ok) {
      if (!stableStart) stableStart = Date.now();
      const stableElapsed = Date.now() - stableStart;
      addLog(i2vLogEl, `[I2V prompt commit] ${displayName} editorTextLen=${lastSample.editorTextLen || 0} stable=${stableElapsed}/${stableMs}`, 'info');
      if (stableElapsed >= stableMs) {
        addLog(i2vLogEl, `[I2V prompt commit] ${displayName} editorTextLen=${lastSample.editorTextLen || 0} stable=${stableElapsed}/${stableMs} PASS`, 'ok');
        return { ok: true, ...lastSample, stableElapsedMs: stableElapsed };
      }
    } else {
      stableStart = null;
      addLog(i2vLogEl, `[I2V prompt commit] ${displayName} editorTextLen=${lastSample.editorTextLen || 0} rootTextLen=${lastSample.rootTextLen || 0} promptMatch=${lastSample.promptMatch ? 'yes' : 'no'}`, 'warn');
      if ((lastSample.rootTextLen || 0) > 0 && (lastSample.editorTextLen || 0) === 0) {
        addLog(i2vLogEl, `[I2V prompt commit] ${displayName} editor bị clear hoặc prompt chỉ nằm ngoài editor thật.`, 'warn');
      }
    }
    await sleep(250);
  }
  return { ok: false, code: 'text_missing_before_submit', error: 'Prompt chưa commit ổn định trong editor thật trước submit.', ...(lastSample || {}), timeoutMs };
}

async function inspectLatestPostPrompt(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      const cards = Array.from(document.querySelectorAll('article,[class*="post" i],[class*="result" i],[data-testid*="post" i]'))
        .filter(isVisible)
        .map(el => ({ el, rect: el.getBoundingClientRect() }))
        .sort((a, b) => b.rect.bottom - a.rect.bottom);
      const card = cards[0]?.el || document.body;
      const text = normalize(card.innerText || card.textContent || '');
      const cleaned = text.replace(/\b(download|share|like|copy|open|close|more)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      return { ok: true, postPromptLen: cleaned.length, postPromptPreview: cleaned.slice(0, 180) };
    },
  });
  return result?.[0]?.result || { ok: false, postPromptLen: 0 };
}

async function verifyGeneratedPostPrompt(tabId, expectedText) {
  const post = await inspectLatestPostPrompt(tabId);
  const postPromptLen = Number(post.postPromptLen || 0);
  return {
    ...post,
    postPromptLen,
    empty: postPromptLen === 0,
    promptMatch: postPromptLen > 0 && promptMatchesPost(post.postPromptPreview || '', expectedText),
  };
}

function promptMatchesPost(postText, expectedText) {
  return promptMatchesEditor(postText, expectedText);
}

async function finalizeLastI2VScene(tabId, scene, ctx = {}) {
  const displayName = ctx.displayName || getSceneDisplayName(ctx.expectedSceneIndex || 0);
  const logEl = ctx.logEl || i2vLogEl;
  const sceneId = ctx.sceneId || scene?.sceneId || '';
  const expectedText = ctx.expectedText || scene?.prompt || '';

  setI2VSceneState(sceneId, 'post_verifying', { logEl, displayName });
  addLog(logEl, `[I2V post verify] ${displayName} bắt đầu kiểm tra prompt ở post...`, 'info');
  const postPrompt = await verifyGeneratedPostPrompt(tabId, expectedText);
  addLog(logEl, `[I2V post verify] ${displayName} postPromptLen=${postPrompt.postPromptLen || 0}`, postPrompt.postPromptLen > 0 ? 'info' : 'warn');
  addLog(logEl, `[I2V post verify] ${displayName} promptMatch=${postPrompt.promptMatch ? 'yes' : 'no'}`, postPrompt.promptMatch ? 'info' : 'warn');

  if ((postPrompt.postPromptLen || 0) === 0) {
    const detail = 'Kết quả video đã tạo nhưng prompt ở post đang trống. Có khả năng Grok không nhận prompt đúng cho scene cuối.';
    setI2VSceneState(sceneId, 'warning', { logEl, displayName, type: 'warn', error: 'final_scene_post_prompt_empty' });
    addLog(logEl, `⚠ [Img2Vid] ${displayName} generate xong nhưng post prompt trống.`, 'warn');
    addLog(logEl, 'Chi tiết: Có khả năng Grok không nhận prompt đúng cho scene cuối.', 'warn');
    addLog(logEl, `[I2V finalize] ${displayName} có cảnh báo: post prompt trống.`, 'warn');
    addLog(logEl, `[I2V finalize] ${displayName} giữ trạng thái Cảnh báo, không tự submit lại để tránh hao token.`, 'warn');
    return {
      ok: false,
      warning: true,
      code: 'final_scene_post_verify_warning',
      error: detail,
      postPrompt,
    };
  }

  if (!postPrompt.promptMatch) {
    const detail = 'Kết quả video đã tạo nhưng prompt ở post không khớp với prompt mong muốn. Có thể scene cuối bị submit với state không đồng bộ.';
    setI2VSceneState(sceneId, 'warning', { logEl, displayName, type: 'warn', error: 'final_scene_post_prompt_mismatch' });
    addLog(logEl, `⚠ [Img2Vid] ${displayName} generate xong nhưng post prompt không khớp với prompt mong muốn.`, 'warn');
    addLog(logEl, 'Chi tiết: Có thể scene cuối bị submit với state không đồng bộ.', 'warn');
    addLog(logEl, `[I2V finalize] ${displayName} có cảnh báo: post prompt không khớp.`, 'warn');
    addLog(logEl, `[I2V finalize] ${displayName} giữ trạng thái Cảnh báo, không tự submit lại để tránh hao token.`, 'warn');
    return {
      ok: false,
      warning: true,
      code: 'final_scene_post_verify_warning',
      error: detail,
      postPrompt,
    };
  }

  setI2VSceneState(sceneId, 'done', { logEl, displayName, type: 'ok' });
  addLog(logEl, `[I2V finalize] ${displayName} đủ điều kiện hoàn tất.`, 'ok');
  return { ok: true, code: 'final_scene_verified', postPrompt };
}

// ── INJECT TEXT PROMPT ────────────────────────────────────────────────────────
async function injectTextPrompt(tabId, prompt, doSubmit) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (promptText, doSubmit) => {
      console.log('[GPI] injectTextPrompt START', { doSubmit, promptLen: promptText.length });
      const isVisible = (node) => {
        if (!node) return false;
        const r = node.getBoundingClientRect();
        const st = window.getComputedStyle(node);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      const isBlocked = (node) => !!node?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="overlay" i]');
      const findBottomComposerScope = () => {
        const inputSelectors = [
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
        ].join(',');
        return Array.from(document.querySelectorAll(inputSelectors))
          .filter(input => isVisible(input) && !isBlocked(input))
          .map(input => {
            let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
            if (!root) {
              let node = input.parentElement;
              for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                if (node.querySelector('button,[role="button"],label')) { root = node; break; }
              }
            }
            if (!root || isBlocked(root)) return null;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
            return isBottom ? { input, root, inputRect, rootRect } : null;
          })
          .filter(Boolean)
          .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
      };
      const bottomScope = findBottomComposerScope();
      if (!bottomScope) return { ok: false, error: 'Bottom composer not found' };
      console.log('[GPI] bottom composer input selected', {
        inputTop: Math.round(bottomScope.inputRect.top),
        rootBottom: Math.round(bottomScope.rootRect.bottom),
      });
      const normalizeText = (text) => String(text || '').replace(/\s+/g, ' ').trim();
      const findActualComposerEditor = (scope) => {
        const root = scope?.root;
        if (!root) return null;
        const selectors = [
          '[data-testid="chat-input"] div[contenteditable="true"]',
          '[data-testid="chat-input"] [contenteditable="true"]',
          'div[contenteditable="true"].ProseMirror',
          'div[contenteditable="true"][translate="no"]',
          'div[contenteditable="true"]',
          'textarea',
          'input',
        ];
        const candidates = Array.from(root.querySelectorAll(selectors.join(',')))
          .filter(candidate => root.contains(candidate))
          .filter(isVisible)
          .filter(candidate => !isBlocked(candidate))
          .map(candidate => {
            const r = candidate.getBoundingClientRect();
            const inChatInput = !!candidate.closest('[data-testid="chat-input"]');
            const isProseMirror = String(candidate.className || '').includes('ProseMirror');
            return {
              el: candidate,
              score: (inChatInput ? 100 : 0) + (isProseMirror ? 80 : 0) + (candidate.isContentEditable ? 40 : 0) + Math.round(r.bottom / 100),
            };
          })
          .sort((a, b) => b.score - a.score);
        return candidates[0]?.el || scope.input || null;
      };
      const getActualEditorText = (editor) => {
        if (!editor) return '';
        if ('value' in editor) return normalizeText(editor.value || '');
        return normalizeText(editor.innerText || editor.textContent || '');
      };
      const getTextDebug = (scope, editor) => {
        const rootText = normalizeText(scope?.root?.textContent || '');
        const editorText = getActualEditorText(editor);
        return {
          editorTextLen: editorText.length,
          editorTextPreview: editorText.slice(0, 160),
          rootTextLen: rootText.length,
          rootTextPreview: rootText.slice(0, 160),
        };
      };
      const selectors = [
        'textarea[placeholder*="Imagine"]', 'textarea[placeholder*="Describe"]',
        'textarea[placeholder*="Enter"]',
        'div[contenteditable="true"][data-lexical-editor]',
        'div[contenteditable="true"]', 'textarea',
      ];
      let el = findActualComposerEditor(bottomScope);
      /*
      for (const sel of selectors) {
        for (const c of document.querySelectorAll(sel)) {
          const r = c.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            console.log('[GPI] Found input:', sel, c.tagName, `${r.width}x${r.height}`);
            el = c; break;
          }
        }
        if (el) break;
      }
      */
      if (!el) { console.error('[GPI] ❌ No input found!'); return { ok: false, error: 'Không tìm thấy hộp nhập prompt' }; }

      console.log('[GPI inject text] selected editor:', {
        tag: el.tagName,
        className: String(el.className || '').slice(0, 120),
        inChatInput: !!el.closest('[data-testid="chat-input"]'),
      });
      el.focus();
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        console.log('[GPI] Using TEXTAREA setter');
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, promptText); else el.value = promptText;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        console.log('[GPI] Using contenteditable insertText');
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
        range.deleteContents();
        document.execCommand('insertText', false, promptText);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: promptText }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        if (getActualEditorText(el).length < Math.min(20, Math.max(1, normalizeText(promptText).length))) {
          el.textContent = promptText;
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: promptText }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      const textDebug = getTextDebug(bottomScope, el);
      console.log('[GPI] Text injected, editor debug:', textDebug);
      const expectedPrefix = normalizeText(promptText).slice(0, 60).toLowerCase();
      const editorLower = getActualEditorText(el).toLowerCase();
      if (textDebug.editorTextLen < Math.min(20, Math.max(1, normalizeText(promptText).length)) || (expectedPrefix.length >= 20 && !editorLower.includes(expectedPrefix))) {
        return { ok: false, error: 'Prompt text missing from actual editor after inject', ...textDebug };
      }

      if (!doSubmit) { console.log('[GPI] doSubmit=false, returning'); return { ok: true, ...textDebug }; }

      console.log('[GPI] Starting submit button search...');
      return new Promise(resolve => {
        let attempts = 0;
        let submitted = false;
        // FIX: Tăng maxAttempts từ 100 → 200, mỗi lần cách 300ms → tổng 60s
        // Đủ thời gian cho Grok xử lý ảnh reference và re-enable button
        const maxAttempts = 200;
        const pollInterval = 300;

        const isVisible = (node) => {
          if (!node) return false;
          const r = node.getBoundingClientRect();
          const st = window.getComputedStyle(node);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
        };
        const isEnabled = (button) => {
          if (!button) return false;
          return !button.disabled
            && button.getAttribute('aria-disabled') !== 'true'
            && !button.closest('[aria-disabled="true"]');
        };
        const clickSubmit = (button, method, extra = {}) => {
          const rect = button.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          console.log('[GPI] CLICK submit:', method, {
            label: button.getAttribute('aria-label') || button.textContent?.trim() || button.className?.slice?.(0, 50),
            x: Math.round(x), y: Math.round(y), w: Math.round(rect.width), h: Math.round(rect.height)
          });
          button.scrollIntoView({ block: 'center', inline: 'center' });
          button.focus();
          button.click();
          submitted = true;
          setTimeout(() => {
            const currentText = (el.value ?? el.textContent ?? '').trim();
            const busy = !!document.querySelector('[aria-busy="true"],[class*="loading"],[class*="generating"],[class*="pending"]');
            const buttonNowDisabled = !isEnabled(button);
            const looksSubmitted = currentText.length === 0 || buttonNowDisabled || busy;
            console.log('[GPI] submit verify:', { method, currentLen: currentText.length, buttonNowDisabled, busy, looksSubmitted });
            resolve({ ok: true, method, verified: looksSubmitted, ...extra });
          }, 900);
        };
        const rightmostButton = (buttons) => {
          return buttons
            .map(button => ({ button, rect: button.getBoundingClientRect() }))
            .sort((a, b) => (b.rect.right - a.rect.right) || (b.rect.bottom - a.rect.bottom))[0]?.button || null;
        };
        const tryClick = () => {
          if (submitted) return;
          attempts++;
          console.log(`[GPI] Submit attempt #${attempts}/${maxAttempts}`);

          // 1. Try aria-label selectors
          const btnsels = [
            'button[aria-label*="Grok" i]', 'button[aria-label*="Send" i]',
            'button[aria-label*="Generate" i]', 'button[aria-label*="Submit" i]',
            'button[type="submit"]',
            'button[data-testid*="send" i]', 'button[data-testid*="submit" i]',
            'button[data-testid*="generate" i]',
          ];
          for (const s of btnsels) {
            const matches = Array.from(document.querySelectorAll(s));
            const b = matches.find(btn => isVisible(btn) && isEnabled(btn));
            if (matches.length) console.log(`[GPI]   aria sel "${s}": found=${matches.length}, enabled=${!!b}`);
            if (b && isVisible(b) && isEnabled(b)) {
              console.log('[GPI] ✅ CLICK aria-button:', s);
              clickSubmit(b, 'aria-button', { sel: s }); return;
            }
          }

          // 2. Find submit button inside form — target bottom-right action bar (Grok 2025)
          const rootForm = el.closest('form');
          const allForms = Array.from(document.querySelectorAll('form'));
          const forms = rootForm ? [rootForm, ...allForms.filter(f => f !== rootForm)] : allForms;
          console.log(`[GPI]   forms found: ${forms.length}, rootFirst=${!!rootForm}`);
          for (const form of forms) {
            const allAbsDivs = Array.from(form.querySelectorAll('div.absolute'));
            const bottomRightDivs = allAbsDivs.filter(d => {
              const cls = d.className || '';
              return (cls.includes('right-') || cls.includes('end-')) && cls.includes('bottom-');
            });
            console.log(`[GPI]   bottomRightDivs: ${bottomRightDivs.length}`);
            for (const div of bottomRightDivs) {
              const btns = Array.from(div.querySelectorAll('button'))
                .filter(b => isVisible(b) && isEnabled(b) && b.querySelector('svg'));
              const rightBtn = rightmostButton(btns);
              if (rightBtn) {
                console.log('[GPI] ✅ CLICK bottom-right-rightmost-svg');
                clickSubmit(rightBtn, 'bottom-right-btn'); return;
              }
              for (let k = btns.length - 1; k >= 0; k--) {
                const b = btns[k];
                const hasSvg = !!b.querySelector('svg');
                console.log(`[GPI]     btn[${k}] disabled=${b.disabled} ariaDisabled=${b.getAttribute('aria-disabled')} hasSvg=${hasSvg}`);
                if (isVisible(b) && isEnabled(b) && hasSvg) {
                  console.log('[GPI] ✅ CLICK bottom-right-last-svg');
                  clickSubmit(b, 'bottom-right-btn'); return;
                }
              }
            }
            const allSvgBtns = Array.from(form.querySelectorAll('div.absolute button'))
              .filter(b => isVisible(b) && isEnabled(b) && b.querySelector('svg'));
            console.log(`[GPI]   allSvgBtns (enabled): ${allSvgBtns.length}`);
            if (allSvgBtns.length > 0) {
              const btn = rightmostButton(allSvgBtns);
              console.log('[GPI] ✅ CLICK last-svg-btn:', btn.className.slice(0,50));
              clickSubmit(btn, 'last-svg-btn'); return;
            }
            const enabledFormBtns = Array.from(form.querySelectorAll('button:not([disabled])'))
              .filter(b => isVisible(b) && isEnabled(b) && b.querySelector('svg'));
            console.log(`[GPI]   enabled form svg buttons: ${enabledFormBtns.length}`);
            if (enabledFormBtns.length > 0) {
              clickSubmit(rightmostButton(enabledFormBtns), 'last-form-svg-btn'); return;
            }

            // FIX: Thêm fallback form.requestSubmit() nếu có input text đã điền
            const inputFilled = (el.value || el.textContent || '').trim().length > 0;
            if (inputFilled && attempts >= 20 && attempts % 20 === 0) {
              try {
                console.log('[GPI] Trying form.requestSubmit()...');
                form.requestSubmit();
                submitted = true;
                setTimeout(() => resolve({ ok: true, method: 'form-requestSubmit' }), 900);
                return;
              } catch(e) { console.log('[GPI] form.requestSubmit() failed:', e.message); }
            }
          }

          // 3. FIX: Fallback Enter key — thêm Ctrl+Enter và metaKey
          if (attempts >= maxAttempts) {
            console.log('[GPI] ⚠ Max attempts reached, trying Enter/Ctrl+Enter fallback');
            if (!submitted) {
              el.focus();
              // Try plain Enter
              el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
              el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
              setTimeout(() => {
                // Try Ctrl+Enter after 500ms if still not submitted
                el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, ctrlKey: true, metaKey: true, bubbles: true, cancelable: true }));
                el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, ctrlKey: true, metaKey: true, bubbles: true }));
              }, 500);
            }
            setTimeout(() => resolve({ ok: false, method: 'enter-fallback', error: 'Không tìm thấy nút submit sau khi inject prompt' }), 1200);
          } else {
            setTimeout(tryClick, pollInterval);
          }
        };
        setTimeout(tryClick, 300);
      });
    },
    args: [prompt, doSubmit],
  });
  return results?.[0]?.result || { ok: false, error: 'Không có phản hồi' };
}

// ── INJECT IMAGE FILE ─────────────────────────────────────────────────────────
async function injectImageToPage(tabId, dataUrl, mimeType, fileName, options = {}) {
  // Đảm bảo dataUrl đúng format trước khi inject
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return { ok: false, error: 'dataUrl không hợp lệ' };
  }
  // Nếu mimeType không khớp header dataUrl, sửa lại
  const headerMatch = dataUrl.match(/^data:([^;]+);/);
  const actualMime = headerMatch ? headerMatch[1] : mimeType;

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (dataUrl, mimeType, fileName, options) => {
      console.log('[GPI] injectImageToPage START', { fileName, mimeType, dataUrlLen: dataUrl?.length });

      // Convert dataUrl → Blob đúng cách, tránh corrupt
      let blob;
      try {
        const res = await fetch(dataUrl);
        blob = await res.blob();
      } catch (e) {
        // Fallback: manual base64 decode
        const b64 = dataUrl.split(',')[1];
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        blob = new Blob([arr], { type: mimeType });
      }
      if (blob.size < 100) return { ok: false, error: `Blob quá nhỏ (${blob.size}b) — ảnh có thể corrupt` };

      const file = new File([blob], fileName, { type: mimeType });
      console.log('[GPI] File created:', file.name, file.size, 'bytes');

      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };

      const isTemplateOrModal = (el) => !!el?.closest?.(
        '[role="dialog"],[class*="modal" i],[class*="template" i],[class*="overlay" i]'
      );

      const findBottomComposerScope = () => {
        const inputSelectors = [
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
        ].join(',');
        const candidates = Array.from(document.querySelectorAll(inputSelectors))
          .filter(input => visible(input) && !isTemplateOrModal(input))
          .map(input => {
            let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
            if (!root) {
              let node = input.parentElement;
              for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                const hasButton = node.querySelector('button,[role="button"],label');
                if (hasButton) { root = node; break; }
              }
            }
            if (!root || isTemplateOrModal(root)) return null;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
            if (!isBottom) return null;
            return { input, root, inputRect, rootRect };
          })
          .filter(Boolean)
          .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top));
        const scope = candidates[0] || null;
        if (!scope) {
          console.log('[GPI] bottom composer found: false');
          return null;
        }
        console.log('[GPI] bottom composer found: true', {
          inputTop: Math.round(scope.inputRect.top),
          rootBottom: Math.round(scope.rootRect.bottom),
          rootHeight: Math.round(scope.rootRect.height),
        });
        return scope;
      };

      const pickFileInput = () => {
        if (options && options.preferComposer) {
          const scope = findBottomComposerScope();
          if (!scope) return { input: null, error: 'Bottom composer not found' };
          const all = Array.from(scope.root.querySelectorAll('input[type="file"]'));
          const imageOnly = all.filter(i => (i.accept || '').toLowerCase().includes('image'));
          const pool = imageOnly.length ? imageOnly : all;
          const root = scope.root;
          const inRoot = pool.filter(i => root.contains(i) && !isTemplateOrModal(i));
          console.log('[GPI] file inputs found inside bottom composer:', inRoot.length);
          if (!inRoot.length) return { input: null, error: 'Composer file input not found', root };
          return { input: inRoot[inRoot.length - 1], reason: 'bottom-composer-root', root };
        }
        const all = Array.from(document.querySelectorAll('input[type="file"]'));
        const imageOnly = all.filter(i => (i.accept || '').toLowerCase().includes('image'));
        const pool = imageOnly.length ? imageOnly : all;
        if (!pool.length) return { input: null };
        const visibleFirst = pool.find(visible);
        return { input: visibleFirst || pool[pool.length - 1], reason: visibleFirst ? 'visible-first' : 'last-file-input' };
      };

      let picked = pickFileInput();
      let fileInput = picked?.input || null;
      console.log('[GPI] fileInput found (initial):', !!fileInput, fileInput?.accept, 'preferComposer=', !!options?.preferComposer, 'reason=', picked?.reason, 'error=', picked?.error);
      if (options?.preferComposer && picked?.error === 'Bottom composer not found') {
        return { ok: false, error: 'Bottom composer not found' };
      }

      if (!fileInput) {
        if (options?.preferComposer && !picked?.root) {
          return { ok: false, error: picked?.error || 'Bottom composer not found' };
        }
        console.log('[GPI] No file input, trying trigger buttons...');
        const triggers = [
          'button[aria-label*="image"]', 'button[aria-label*="Image"]',
          'button[aria-label*="upload"]', 'button[aria-label*="attach"]',
          'label[for*="file"]', '[data-testid*="attach"]',
        ];
        for (const s of triggers) {
          const btn = options?.preferComposer ? picked.root.querySelector(s) : document.querySelector(s);
          if (btn) {
            if (isTemplateOrModal(btn)) {
              console.log('[GPI] blocked template/modal upload candidate:', s);
              continue;
            }
            console.log('[GPI] Trigger clicked:', s);
            btn.click(); await new Promise(r => setTimeout(r, 600)); break;
          }
        }
        picked = pickFileInput();
        fileInput = picked?.input || null;
        console.log('[GPI] fileInput found (after trigger):', !!fileInput, 'reason=', picked?.reason, 'error=', picked?.error);
        if (options?.preferComposer && !fileInput) {
          return { ok: false, error: picked?.error || 'Composer file input not found' };
        }
      }

      if (!fileInput) { console.error('[GPI] ❌ No file input!'); return { ok: false, error: 'Không tìm thấy input file' }; }

      // Snapshot số lượng warning icon trước khi inject
      const countWarnings = () => document.querySelectorAll(
        '[aria-label*="warning" i],[aria-label*="error" i],[title*="warning" i],[title*="error" i],' +
        'svg[class*="warn" i],svg[class*="error" i],[class*="upload-error" i],[class*="file-error" i]'
      ).length;
      const warnsBefore = countWarnings();

      // Snapshot số thumbnail ảnh trong composer trước khi inject
      const countThumbs = () => {
        const scope = findBottomComposerScope();
        if (!scope) return 0;
        return scope.root.querySelectorAll('img[src^="blob:"],img[src^="data:"],img[class*="thumb" i],[class*="attachment" i] img').length;
      };
      const thumbsBefore = countThumbs();

      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      fileInput.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('[GPI] File dispatched, waiting for Grok to process...');

      // Chờ tối đa 8s để Grok xử lý: thumbnail xuất hiện = thành công, warning tăng = thất bại
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 400));
        const thumbsNow = countThumbs();
        const warnsNow  = countWarnings();
        if (thumbsNow > thumbsBefore) {
          console.log('[GPI] ✅ Thumbnail appeared — image accepted by Grok');
          return { ok: true };
        }
        if (warnsNow > warnsBefore) {
          console.log('[GPI] ⚠ Warning icon appeared — Grok rejected the image');
          return { ok: false, error: 'Grok từ chối ảnh (warning icon xuất hiện)' };
        }
      }
      // Timeout nhưng không có warning → coi như thành công (Grok có thể không show thumbnail)
      console.log('[GPI] ⏰ 8s timeout, no thumbnail/warning — assuming ok');
      return { ok: true };
    },
    args: [dataUrl, actualMime, fileName, options],
  });
  const imgResult = results?.[0]?.result || { ok: false, error: 'Script thất bại' };
  console.log('[GPI-sidepanel] injectImageToPage result:', imgResult);
  return imgResult;
}

// ── SNAPSHOT URLS ─────────────────────────────────────────────────────────────
async function snapshotVideoUrls(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const urls = new Set();
      document.querySelectorAll('video').forEach(v => {
        if (v.src) urls.add(v.src);
        v.querySelectorAll('source').forEach(s => { if (s.src) urls.add(s.src); });
      });
      return [...urls];
    }
  });
  return new Set(result?.[0]?.result || []);
}

async function snapshotImageUrls(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      return Array.from(document.querySelectorAll('img, picture source'))
        .map(el => el.src || el.srcset || '')
        .filter(src => src && !src.startsWith('data:'));
    }
  });
  return new Set(result?.[0]?.result || []);
}

// ── READ GROK REAL PROGRESS ───────────────────────────────────────────────────
async function readGrokProgress(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      for (const el of document.querySelectorAll('[role="progressbar"][aria-valuenow]')) {
        const now = parseFloat(el.getAttribute('aria-valuenow'));
        const max = parseFloat(el.getAttribute('aria-valuemax') || '100');
        if (!isNaN(now) && max > 0) return Math.round((now / max) * 100);
      }
      const progClasses = ['progress', 'Progress', 'prog-bar', 'progressBar', 'loading-bar'];
      for (const el of document.querySelectorAll('*')) {
        const cls = typeof el.className === 'string' ? el.className : '';
        if (progClasses.some(c => cls.includes(c))) {
          const w = parseFloat(el.style.width);
          if (!isNaN(w) && w > 0 && w < 100) return w;
        }
      }
      const spinnerParents = Array.from(document.querySelectorAll(
        '[class*="loading"],[class*="spinner"],[class*="generating"],[aria-busy="true"]'
      ));
      for (const sp of spinnerParents) {
        const container = sp.closest('[class]') || sp.parentElement;
        if (!container) continue;
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
          const m = node.nodeValue.trim().match(/^(\d{1,3})%$/);
          if (m) { const v = parseInt(m[1]); if (v > 0 && v <= 100) return v; }
        }
      }
      const walker2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node2;
      while ((node2 = walker2.nextNode())) {
        const m = node2.nodeValue.trim().match(/^(\d{1,3})%$/);
        if (m) { const v = parseInt(m[1]); if (v > 5 && v < 100) return v; }
      }
      return null;
    }
  });
  return result?.[0]?.result ?? null;
}

// ── WAIT FOR VIDEO GENERATE ───────────────────────────────────────────────────
function getGeneratePollInterval(elapsedMs) {
  if (elapsedMs < 30000) return 1000;
  if (elapsedMs < 120000) return 2000;
  return 4000;
}

async function waitForGenerate(tabId, timeoutMs, knownVideoUrls = new Set(), stopFlagFn, progressCallback = null, options = {}) {
  const start = Date.now();
  let lastSpinnerTime = Date.now();
  let simulatedPct = 10;
  let btnWasDisabled = false;
  const knownImageSnapshot = await snapshotImageUrls(tabId);

  console.log('[GPI-SF] waitForGenerate START, timeout:', timeoutMs, 'knownVids:', knownVideoUrls.size, 'knownImgs:', knownImageSnapshot.size);

  while (Date.now() - start < timeoutMs) {
    if (stopFlagFn()) return { ok: false, reason: 'stopped' };

    const grokPct = await readGrokProgress(tabId);
    const elapsed = Date.now() - start;

    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (knownUrlsArr, knownImgArr) => {
        const knownUrls = new Set(knownUrlsArr);
        const knownImgs = new Set(knownImgArr);

        const spinners = Array.from(document.querySelectorAll(
          '[class*="loading"],[class*="spinner"],[class*="generating"],[aria-busy="true"],' +
          '[aria-label*="loading"],[aria-label*="Loading"],[class*="skeleton"],[class*="pending"]'
        )).filter(s => { const r = s.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

        const newVideoUrls = [];
        document.querySelectorAll('video').forEach(v => {
          if (v.src && !knownUrls.has(v.src)) newVideoUrls.push(v.src);
          v.querySelectorAll('source').forEach(s => {
            if (s.src && !knownUrls.has(s.src)) newVideoUrls.push(s.src);
          });
        });

        const newImgUrls = Array.from(document.querySelectorAll('img'))
          .map(img => img.currentSrc || img.src)
          .filter(src => src && !knownImgs.has(src) && !src.startsWith('data:') && !src.startsWith('blob:data'));

        const dlReady = Array.from(document.querySelectorAll(
          'a[download],button[aria-label*="Download"],button[aria-label*="download"]'
        )).some(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

        // ── Detect moderation / error message từ Grok ────────────────────────
        // Grok thường hiện text báo từ chối trong vài giây đầu
        const moderated = (() => {
          const moderationPhrases = [
            "can't generate", "cannot generate", "unable to generate",
            "against our", "violates", "policy", "not able to create",
            "content policy", "inappropriate", "i'm sorry, i can't",
            "i cannot create", "this request", "unable to fulfill",
            "không thể tạo", "vi phạm", "từ chối",
          ];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
          let node;
          while ((node = walker.nextNode())) {
            const txt = node.nodeValue.trim().toLowerCase();
            if (txt.length > 10 && moderationPhrases.some(p => txt.includes(p))) {
              // Chỉ tính nếu element đang visible
              const el = node.parentElement;
              if (el) {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) return true;
              }
            }
          }
          return false;
        })();

        // Detect Grok template "Done" stepper (Upload → Generate → Done)
        const doneStep = (() => {
          const candidates = Array.from(document.querySelectorAll('span,p,div,li'));
          return candidates.some(el => {
            if (el.children.length > 0) return false;
            const txt = (el.textContent || '').trim();
            if (txt !== 'Done') return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
        })();

        // Detect video inside modal/dialog popup (Grok template result)
        const modalVideo = Array.from(document.querySelectorAll(
          '[role="dialog"] video, [class*="modal"] video, [class*="popup"] video, [class*="overlay"] video'
        )).some(v => { const r = v.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

        const forms = document.querySelectorAll('form');
        let formBtnReady = false;
        for (const form of forms) {
          const actionBtns = form.querySelectorAll('div.absolute button');
          for (const b of actionBtns) {
            if (!b.disabled && b.querySelector('svg')) { formBtnReady = true; break; }
          }
          if (!formBtnReady) {
            const allFormBtns = form.querySelectorAll('button:not([disabled])');
            if (allFormBtns.length > 0) { formBtnReady = true; }
          }
          if (formBtnReady) break;
        }
        const legacyBtns = Array.from(document.querySelectorAll(
          'button[type="submit"],button[aria-label*="Generate"],button[aria-label*="Grok"],button[aria-label*="Send"]'
        )).filter(b => !b.disabled);
        const genReady = formBtnReady || legacyBtns.length > 0;
        const anyBtnExists = forms.length > 0 || legacyBtns.length > 0;
        const btnDisabled = anyBtnExists && !genReady;

        return { spinners: spinners.length, hasNewVideo: newVideoUrls.length > 0, newImgUrls, genReady, btnDisabled, dlReady, doneStep, modalVideo, moderated };
      },
      args: [[...knownVideoUrls], [...knownImageSnapshot]]
    });

    const r = result?.[0]?.result;
    if (r) {
      if (r.spinners > 0) lastSpinnerTime = Date.now();
      if (r.btnDisabled) btnWasDisabled = true;
      const silentMs = Date.now() - lastSpinnerTime;

      console.log(`[GPI-SF] poll: spinners=${r.spinners} newVideo=${r.hasNewVideo} doneStep=${r.doneStep} modalVideo=${r.modalVideo} moderated=${r.moderated} newImgs=${r.newImgUrls?.length} dlReady=${r.dlReady} genReady=${r.genReady} btnDisabled=${r.btnDisabled} silent=${Math.round(silentMs/1000)}s elapsed=${Math.round(elapsed/1000)}s`);

      if (progressCallback) {
        if (grokPct !== null) progressCallback(grokPct);
        else { simulatedPct = Math.min(95, 10 + (elapsed / Math.min(timeoutMs, 90000)) * 82); progressCallback(simulatedPct); }
      }

      // Moderation: Grok từ chối → thoát sớm, không chờ hết timeout
      if (r.moderated && elapsed > 2000) {
        console.log('[GPI-SF] 🚫 Moderation detected, exiting early');
        return { ok: false, reason: 'moderated' };
      }

      if (r.hasNewVideo) { console.log('[GPI-SF] ✅ Done: new video detected'); return { ok: true, reason: 'new-video' }; }
      // Detect Grok template "Done" popup (Img2Vid template flow)
      if (r.doneStep && elapsed > 3000) { console.log('[GPI-SF] ✅ Done: doneStep stepper detected'); return { ok: true, reason: 'done-step' }; }
      if (r.modalVideo && elapsed > 3000) { console.log('[GPI-SF] ✅ Done: modal video detected'); return { ok: true, reason: 'modal-video' }; }
      if (r.dlReady && elapsed > 5000) { console.log('[GPI-SF] ✅ Done: download btn (template)'); return { ok: true, reason: 'dl-btn' }; }
      if (!options.requireNewVideo && r.newImgUrls?.length > 0 && elapsed > 5000) {
        console.log('[GPI-SF] ✅ Done: new image detected', r.newImgUrls.length);
        return { ok: true, reason: 'new-image' };
      }
      if (!options.requireNewVideo && btnWasDisabled && r.genReady && silentMs > 5000 && elapsed > 10000) {
        console.log('[GPI-SF] ✅ Done: btn transition disabled→enabled, silent', silentMs);
        return { ok: true, reason: 'btn-transition' };
      }
      if (!options.requireNewVideo && silentMs > 12000 && r.genReady && elapsed > 15000) {
        console.log('[GPI-SF] ✅ Done: long silence fallback');
        return { ok: true, reason: 'silence-fallback' };
      }
    }

    await sleep(getGeneratePollInterval(Date.now() - start));
  }
  console.log('[GPI-SF] ⏰ waitForGenerate TIMEOUT');
  return { ok: false, reason: 'timeout' };
}

// ── WAIT FOR IMAGE GENERATE ───────────────────────────────────────────────────
async function waitForImage(tabId, timeoutMs, knownImageUrls = new Set(), stopFlagFn, progressCallback = null) {
  const start = Date.now();
  let lastSpinnerTime = Date.now();
  let simulatedPct = 10;
  let btnWasDisabled = false;

  while (Date.now() - start < timeoutMs) {
    if (stopFlagFn()) return { ok: false, reason: 'stopped' };

    const grokPct = await readGrokProgress(tabId);
    const elapsed = Date.now() - start;

    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (knownUrlsArr) => {
        const knownUrls = new Set(knownUrlsArr);
        const spinners = Array.from(document.querySelectorAll(
          '[class*="loading"],[class*="spinner"],[class*="generating"],[aria-busy="true"],[class*="skeleton"],[class*="pending"]'
        )).filter(s => { const r = s.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

        const newImgUrls = Array.from(document.querySelectorAll('img'))
          .map(img => img.currentSrc || img.src)
          .filter(src => src && !knownUrls.has(src) && !src.startsWith('data:') && !src.startsWith('blob:data'));

        const dlReady = Array.from(document.querySelectorAll(
          'a[download],a[href*=".jpg"],a[href*=".png"],a[href*=".webp"],'
          + 'button[aria-label*="Download"],button[aria-label*="download"]'
        )).some(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

        const submitBtns = Array.from(document.querySelectorAll(
          'button[type="submit"],button[aria-label*="Generate"],button[aria-label*="Grok"],button[aria-label*="Send"]'
        ));
        const btnExists  = submitBtns.length > 0;
        const genReady   = submitBtns.some(b => !b.disabled);
        const btnDisabled = btnExists && !genReady;

        return { spinners: spinners.length, newImgUrls, genReady, btnDisabled, dlReady };
      },
      args: [[...knownImageUrls]]
    });

    const r = result?.[0]?.result;
    if (r) {
      if (r.spinners > 0) lastSpinnerTime = Date.now();
      if (r.btnDisabled) btnWasDisabled = true;
      if (progressCallback) {
        if (grokPct !== null) { progressCallback(grokPct); }
        else { simulatedPct = Math.min(95, 10 + (elapsed / Math.min(timeoutMs, 60000)) * 82); progressCallback(simulatedPct); }
      }
      if (r.newImgUrls.length > 0) { return { ok: true, newImgUrls: r.newImgUrls }; }
      if (r.dlReady && elapsed > 8000) { return { ok: true, reason: 'dl-btn' }; }
      const silentMs = Date.now() - lastSpinnerTime;
      if (btnWasDisabled && r.genReady && silentMs > 3000 && elapsed > 8000) { return { ok: true, reason: 'btn-ready' }; }
      if (silentMs > 12000 && elapsed > 20000) { return { ok: true, reason: 'silence' }; }
    }

    await sleep(getGeneratePollInterval(Date.now() - start));
  }
  return { ok: false, reason: 'timeout' };
}

async function waitForMediaStableAfterGenerate(tabId, mediaType, knownState = {}, options = {}) {
  const stablePolls = Math.max(1, Number(options.stablePolls || 2));
  const timeoutMs = Math.max(2000, Number(options.timeoutMs || 12000));
  const expectedImageCount = normalizeImgOutputCount(options.expectedImageCount || options.expectedCount || 1);
  const minImageCount = Math.max(1, Number(options.minImageCount || 1));
  const minimumWaitAfterFirstImage = Math.max(0, Number(options.minimumWaitAfterFirstImage || 4000));
  const logTarget = options.logEl || logEl;
  const logPrefix = options.logPrefix || '[Image generate]';
  const shouldStop = options.shouldStop || (() => false);
  const knownVideos = knownState.videoUrls || knownState.knownVideoUrls || new Set();
  const knownImages = knownState.imageUrls || knownState.knownImageUrls || new Set();
  const start = Date.now();
  let lastKey = '';
  let stableCount = 0;
  let lastUrls = [];
  let firstImageAt = 0;

  while (Date.now() - start < timeoutMs) {
    if (shouldStop()) return { ok: false, reason: 'stopped', newUrls: lastUrls };
    const urlSets = [];
    if (mediaType === 'video' || mediaType === 'any') {
      const videos = await snapshotVideoUrls(tabId);
      urlSets.push(...[...videos].filter(url => !knownVideos.has(url)));
    }
    if (mediaType === 'image' || mediaType === 'any') {
      const images = await snapshotImageUrls(tabId);
      urlSets.push(...[...images].filter(url => !knownImages.has(url)));
    }
    const newUrls = Array.from(new Set(urlSets.filter(Boolean))).sort();
    if ((mediaType === 'image' || mediaType === 'any') && newUrls.length > 0 && !firstImageAt) firstImageAt = Date.now();
    const key = newUrls.join('|');
    lastUrls = newUrls;
    if ((mediaType === 'image' || mediaType === 'any') && newUrls.length > 0 && expectedImageCount > 1) {
      addLog(logTarget, `${logPrefix} đã phát hiện ${newUrls.length}/${expectedImageCount} ảnh.`, newUrls.length >= expectedImageCount ? 'ok' : 'info');
      if (newUrls.length >= expectedImageCount) {
        return { ok: true, reason: 'new-images', newUrls, newImagesCount: newUrls.length, expectedImageCount, partial: false, stablePolls: stableCount };
      }
    }
    if (newUrls.length > 0 && key === lastKey) {
      stableCount++;
      if (stableCount >= stablePolls) {
        if ((mediaType === 'image' || mediaType === 'any') && expectedImageCount > 1) {
          const waitedEnough = firstImageAt && Date.now() - firstImageAt >= minimumWaitAfterFirstImage;
          if (!waitedEnough && newUrls.length < expectedImageCount) {
            await sleep(getGeneratePollInterval(Date.now() - start));
            continue;
          }
          return { ok: newUrls.length >= minImageCount, reason: 'new-images-partial-stable', newUrls, newImagesCount: newUrls.length, expectedImageCount, partial: newUrls.length < expectedImageCount, stablePolls: stableCount };
        }
        return { ok: true, reason: 'media-stable', newUrls, stablePolls: stableCount };
      }
    } else {
      stableCount = newUrls.length > 0 ? 1 : 0;
      lastKey = key;
    }
    await sleep(getGeneratePollInterval(Date.now() - start));
  }
  return {
    ok: (mediaType === 'image' || mediaType === 'any') ? lastUrls.length >= minImageCount : lastUrls.length > 0,
    reason: lastUrls.length > 0 ? 'media-detected-not-stable' : 'media-not-detected',
    newUrls: lastUrls,
    newImagesCount: (mediaType === 'image' || mediaType === 'any') ? lastUrls.length : undefined,
    expectedImageCount: (mediaType === 'image' || mediaType === 'any') ? expectedImageCount : undefined,
    partial: (mediaType === 'image' || mediaType === 'any') ? lastUrls.length > 0 && lastUrls.length < expectedImageCount : undefined,
    stablePolls: stableCount,
  };
}

async function waitForGrokGenerationDone(tabId, options = {}) {
  const mediaType = options.mediaType || 'video';
  const sceneId = options.sceneId || options.promptIndex || 'unknown';
  const logPrefix = options.logPrefix || '[Generate]';
  const logTarget = options.logEl || logEl;
  const timeoutMs = Number(options.timeoutMs || 300000);
  const knownState = options.knownState || {};
  const shouldStop = options.shouldStop || (() => false);
  const progressCallback = options.progressCallback || null;
  const startedAt = Date.now();

  addLog(logTarget, `${logPrefix} sceneId=${sceneId} waitGenerateWithSignals start mediaType=${mediaType}`, 'info');
  const knownVideos = knownState.videoUrls || knownState.knownVideoUrls || new Set();
  const knownImages = knownState.imageUrls || knownState.knownImageUrls || new Set();

  const accepted = mediaType === 'image'
    ? await waitForImage(tabId, timeoutMs, knownImages, shouldStop, progressCallback)
    : await waitForGenerate(tabId, timeoutMs, knownVideos, shouldStop, progressCallback, {
        requireNewVideo: mediaType === 'video',
      });

  if (!accepted.ok) {
    return {
      ok: false,
      code: accepted.reason === 'timeout' ? 'FAILED_TIMEOUT' : accepted.reason === 'stopped' ? 'FAILED_SUBMIT' : 'FAILED_MEDIA',
      reason: accepted.reason,
      elapsedMs: Date.now() - startedAt,
      mediaState: 'FAILED',
      newUrls: accepted.newImgUrls || [],
    };
  }

  const stable = await waitForMediaStableAfterGenerate(tabId, mediaType, knownState, {
    stablePolls: options.stablePolls || 2,
    timeoutMs: Math.min(15000, Math.max(4000, Number(options.acceptTimeoutMs || 12000))),
    shouldStop,
    expectedImageCount: options.expectedImageCount,
    minImageCount: options.minImageCount,
    minimumWaitAfterFirstImage: options.minimumWaitAfterFirstImage,
    logEl: logTarget,
    logPrefix,
  });

  const ok = stable.ok || accepted.reason === 'dl-btn' || accepted.reason === 'done-step' || accepted.reason === 'modal-video' || accepted.reason === 'btn-ready' || accepted.reason === 'silence' || accepted.reason === 'btn-transition' || accepted.reason === 'silence-fallback';
  if (ok) {
    addLog(logTarget, `${logPrefix} sceneId=${sceneId} media stable, ready to download`, 'ok');
  }
  return {
    ok,
    reason: stable.ok ? 'media-stable' : accepted.reason,
    elapsedMs: Date.now() - startedAt,
    mediaState: stable.ok ? 'MEDIA_STABLE' : 'MEDIA_DETECTED',
    newUrls: stable.newUrls || accepted.newImgUrls || [],
    newImagesCount: stable.newImagesCount || (stable.newUrls || accepted.newImgUrls || []).length,
    expectedImageCount: options.expectedImageCount,
    partial: stable.partial || false,
    signal: accepted,
    stable,
    code: ok ? undefined : 'FAILED_MEDIA',
  };
}

// ── DOWNLOAD MEDIA ────────────────────────────────────────────────────────────
async function downloadMedia(tabId, prompt, mode = 'video', knownVideoUrls = new Set(), knownImageUrls = new Set()) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: (knownVArr, knownIArr, mode) => {
      const knownV = new Set(knownVArr);
      const knownI = new Set(knownIArr);
      const urls = [];

      if (mode === 'video' || mode === 'auto') {
        const allVideoUrls = [];
        document.querySelectorAll('video').forEach(v => {
          const src = v.currentSrc || v.src || '';
          if (src) {
            allVideoUrls.push(src);
            if (!knownV.has(src)) urls.push({ type: 'video', url: src, ext: 'mp4' });
          }
          v.querySelectorAll('source').forEach(s => {
            if (s.src) {
              allVideoUrls.push(s.src);
              if (!knownV.has(s.src)) urls.push({ type: 'video', url: s.src, ext: 'mp4' });
            }
          });
        });
        if (urls.length === 0 && allVideoUrls.length > 0 && (mode === 'video' || mode === 'auto')) {
          const last = allVideoUrls[allVideoUrls.length - 1];
          urls.push({ type: 'video', url: last, ext: 'mp4' });
        }
      }

      if ((mode === 'image' || (mode === 'auto' && urls.length === 0))) {
        const newImgs = Array.from(document.querySelectorAll('img'))
          .map(img => img.currentSrc || img.src)
          .filter(src => src && !knownI.has(src) && !src.startsWith('data:'));
        newImgs.forEach(src => {
          const ext = src.includes('.png') ? 'png' : src.includes('.webp') ? 'webp' : 'jpg';
          urls.push({ type: 'image', url: src, ext });
        });
      }

      if (urls.length === 0) {
        const anchors = Array.from(document.querySelectorAll('a[download],a[href*=".mp4"],a[href*=".jpg"],a[href*=".png"]'));
        if (anchors.length > 0) {
          const last = anchors[anchors.length - 1];
          if (last.href) {
            const ext = last.href.includes('.mp4') ? 'mp4' : last.href.includes('.png') ? 'png' : 'jpg';
            urls.push({ type: 'file', url: last.href, ext });
          }
        }
      }

      // Grok template popup: click the Download button directly (⬇ icon button)
      if (urls.length === 0 && (mode === 'video' || mode === 'auto')) {
        const dlBtns = Array.from(document.querySelectorAll(
          'button[aria-label*="Download" i], button[aria-label*="download" i], button[title*="Download" i]'
        )).filter(b => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && !b.disabled;
        });
        if (dlBtns.length > 0) {
          dlBtns[dlBtns.length - 1].click();
          return [{ type: 'video', url: '__native_dl__', ext: 'mp4' }];
        }
      }

      return [...new Map(urls.map(u => [u.url, u])).values()].slice(-1);
    },
    args: [[...knownVideoUrls], [...knownImageUrls], mode],
  });

  const mediaList = result?.[0]?.result || [];
  const logTarget = i2vIsRunning ? i2vLogEl : imgIsRunning ? imgLogEl : logEl;

  if (mediaList.length === 0) {
    addLog(logTarget, '  ⚠ Không tìm thấy media mới', 'warn');
    return [];
  }

  const downloaded = [];
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const slug = slugify(prompt);
  const prefix = mode === 'image' ? 'img' : 'vid';

  for (const [i, media] of mediaList.entries()) {
    const filename = `grok_${prefix}_${slug}_${ts}_${i + 1}.${media.ext}`;
    // Native download: button was already clicked inside the page script
    if (media.url === '__native_dl__') {
      addLog(logTarget, `  ⬇ Đã click nút Download của Grok (lưu tự động vào thư mục Download)`, 'dl');
      downloaded.push({ filename: 'grok_template_download.mp4', type: 'video', prompt, time: Date.now() });
      continue;
    }
    try {
      if (media.url.startsWith('blob:')) {
        const fr = await chrome.scripting.executeScript({
          target: { tabId },
          func: async (blobUrl, fname) => {
            try {
              const resp = await fetch(blobUrl);
              const blob = await resp.blob();
              const reader = new FileReader();
              return await new Promise(res => {
                reader.onload = () => res({ ok: true, dataUrl: reader.result, filename: fname });
                reader.onerror = () => res({ ok: false });
                reader.readAsDataURL(blob);
              });
            } catch (e) { return { ok: false, error: e.message }; }
          },
          args: [media.url, filename],
        });
        const r = fr?.[0]?.result;
        if (r?.ok) {
          await chrome.downloads.download({ url: r.dataUrl, filename: r.filename, saveAs: false });
          downloaded.push({ filename, type: media.type, prompt, time: Date.now() });
          addLog(logTarget, `  ⬇ Tải: ${filename}`, 'dl');
        }
      } else {
        await chrome.downloads.download({ url: media.url, filename, saveAs: false });
        downloaded.push({ filename, type: media.type, prompt, time: Date.now() });
        addLog(logTarget, `  ⬇ Tải: ${filename}`, 'dl');
      }
    } catch (e) { addLog(logTarget, `  ✗ Lỗi tải: ${e.message}`, 'err'); }
  }
  return downloaded;
}

async function getLatestVisibleVideoUrl(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 20
          && r.height > 20
          && st.display !== 'none'
          && st.visibility !== 'hidden'
          && st.opacity !== '0';
      };
      const candidates = [];
      document.querySelectorAll('video').forEach((v, idx) => {
        const rect = v.getBoundingClientRect();
        const add = (url, source) => {
          if (!url || !isVisible(v)) return;
          candidates.push({
            url,
            idx,
            bottom: rect.bottom,
            area: rect.width * rect.height,
            source,
          });
        };
        add(v.currentSrc || v.src || '', 'video-src');
        v.querySelectorAll('source').forEach(s => add(s.src || '', 'video-source'));
      });
      document.querySelectorAll('a[href]').forEach((a, idx) => {
        const href = a.href || '';
        if (!/\.mp4(?:\?|$)/i.test(href) && !/video/i.test(href)) return;
        const rect = a.getBoundingClientRect();
        candidates.push({
          url: href,
          idx,
          bottom: rect.bottom,
          area: rect.width * rect.height,
          source: 'anchor-video',
        });
      });
      const unique = [];
      const seen = new Set();
      for (const c of candidates) {
        if (!c.url || seen.has(c.url)) continue;
        seen.add(c.url);
        unique.push(c);
      }
      unique.sort((a, b) => (b.bottom - a.bottom) || (b.area - a.area) || (b.idx - a.idx));
      return unique[0]
        ? { ok: true, url: unique[0].url, source: unique[0].source, count: unique.length }
        : { ok: false, error: 'No visible video URL found', count: 0 };
    },
  });
  return result?.[0]?.result || { ok: false, error: 'executeScript failed', count: 0 };
}

async function getLatestResultCardVideoUrl(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 20 && r.height > 20 && st.display !== 'none' && st.visibility !== 'hidden';
      };
      const cards = Array.from(document.querySelectorAll([
        '[class*="post" i]',
        '[class*="result" i]',
        '[class*="media" i]',
        '[data-testid*="post" i]',
        'article',
      ].join(','))).filter(isVisible);
      const candidates = [];
      cards.forEach((card, cardIndex) => {
        const cr = card.getBoundingClientRect();
        card.querySelectorAll('video').forEach((v, idx) => {
          if (!isVisible(v)) return;
          const vr = v.getBoundingClientRect();
          const urls = [v.currentSrc || v.src || '', ...Array.from(v.querySelectorAll('source')).map(s => s.src || '')].filter(Boolean);
          urls.forEach(url => candidates.push({
            url,
            cardIndex,
            idx,
            bottom: Math.max(cr.bottom, vr.bottom),
            area: vr.width * vr.height,
            source: 'result-card-video',
          }));
        });
      });
      const unique = [];
      const seen = new Set();
      for (const c of candidates) {
        if (!c.url || seen.has(c.url)) continue;
        seen.add(c.url);
        unique.push(c);
      }
      unique.sort((a, b) => (b.bottom - a.bottom) || (b.cardIndex - a.cardIndex) || (b.idx - a.idx));
      return unique[0]
        ? { ok: true, url: unique[0].url, source: unique[0].source, count: unique.length }
        : { ok: false, error: 'No result card video URL found', count: 0 };
    },
  });
  return result?.[0]?.result || { ok: false, error: 'executeScript failed', count: 0 };
}

async function clickLatestGrokDownloadButton(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 8 && r.height > 8 && st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
      };
      const read = (el) => String([
        el.textContent,
        el.getAttribute?.('aria-label'),
        el.getAttribute?.('title'),
        el.getAttribute?.('download'),
        el.getAttribute?.('href'),
        el.getAttribute?.('data-testid'),
      ].filter(Boolean).join(' ')).toLowerCase();
      const candidates = Array.from(document.querySelectorAll('a[download],a[href],button,[role="button"]'))
        .filter(el => isVisible(el) && !el.disabled && el.getAttribute?.('aria-disabled') !== 'true')
        .map((el, idx) => {
          const text = read(el);
          const r = el.getBoundingClientRect();
          const isDownload = /download|tải|tai|save|\.mp4|video/.test(text)
            || (el.tagName === 'A' && (el.hasAttribute('download') || /\.mp4(?:\?|$)/i.test(el.href || '')));
          const nearMedia = !!el.closest?.('article,[class*="post" i],[class*="result" i],[class*="media" i],[data-testid*="post" i]');
          return {
            el,
            idx,
            text,
            isDownload,
            nearMedia,
            bottom: r.bottom,
            right: r.right,
            score: (isDownload ? 100 : 0) + (nearMedia ? 30 : 0) + Math.round(r.bottom / 100),
          };
        })
        .filter(item => item.isDownload)
        .sort((a, b) => b.score - a.score || b.bottom - a.bottom || b.right - a.right);
      const picked = candidates[0];
      if (!picked) return { ok: false, error: 'No download button found', count: candidates.length };
      try {
        picked.el.scrollIntoView({ block: 'center', inline: 'center' });
        picked.el.click();
        return { ok: true, method: 'native-download-button', count: candidates.length, text: picked.text.slice(0, 80) };
      } catch (e) {
        return { ok: false, error: e?.message || String(e), count: candidates.length };
      }
    },
  });
  return result?.[0]?.result || { ok: false, error: 'executeScript failed', count: 0 };
}

async function ensureImageOutputCount(tabId, expectedCount, options = {}) {
  const count = normalizeImgOutputCount(expectedCount);
  const hasLogElOption = Object.prototype.hasOwnProperty.call(options, 'logEl');
  const targetLogEl = hasLogElOption ? options.logEl : imgLogEl;
  const logPrefix = options.logPrefix || '[TextToImg output count]';
  const allowUnlabeledNumericControl = options.allowUnlabeledNumericControl === true;
  const mediaLabel = options.mediaLabel || 'ảnh';
  if (targetLogEl) addLog(targetLogEl, `${logPrefix} Đang cấu hình Grok tạo ${count} ${mediaLabel}...`, 'info');
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (expectedCount, allowUnlabeledNumericControl) => {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="gallery" i],[class*="overlay" i]');
      const read = (el) => [el.textContent, el.getAttribute?.('aria-label'), el.getAttribute?.('title'), el.getAttribute?.('data-value'), el.value].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
      const isImageCountContext = (el) => /images?|outputs?|variations?|số ảnh|ảnh/i.test(read(el.parentElement || el) + ' ' + read(el.closest?.('[class*="control" i],[class*="setting" i],[class*="toolbar" i]') || el));
      const findBottomComposerRoot = () => {
        const inputs = Array.from(document.querySelectorAll([
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
          'input',
        ].join(','))).filter(el => isVisible(el) && !isBlocked(el));
        return inputs.map(input => {
          const root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]') || input.parentElement;
          const inputRect = input.getBoundingClientRect();
          const rootRect = root?.getBoundingClientRect?.() || inputRect;
          return root && (inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75)
            ? { root, bottom: rootRect.bottom }
            : null;
        }).filter(Boolean).sort((a, b) => b.bottom - a.bottom)[0]?.root || null;
      };
      const click = (el) => {
        try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch {}
        try { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' })); } catch {}
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        try { el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' })); } catch {}
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        try { el.click(); } catch {}
      };
      const bottomRoot = findBottomComposerRoot();
      const isInBottomComposer = (el) => !!bottomRoot && (bottomRoot === el || bottomRoot.contains(el));
      const isLikelyUnlabeledOutputControl = (el) => {
        if (!allowUnlabeledNumericControl || !isInBottomComposer(el)) return false;
        const txt = read(el).replace(/\s+/g, '');
        if (!/^[1-4]$/.test(txt)) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 18 || r.width > 72 || r.height < 18 || r.height > 72) return false;
        const cls = String(el.getAttribute?.('class') || el.className || '').toLowerCase();
        const label = read(el.closest?.('[class*="toolbar" i],[class*="control" i],[class*="composer" i]') || el);
        return r.bottom > window.innerHeight * 0.55 || /toolbar|control|composer|output|variation|video|image|ảnh/.test(`${cls} ${label}`);
      };
      const findMenuOption = () => Array.from(document.querySelectorAll('button,[role="button"],[role="radio"],[role="option"],[role="menuitem"],label,[data-value],div,span'))
        .filter(el => isVisible(el) && !isBlocked(el))
        .find(el => {
          const txt = read(el).replace(/\s+/g, '');
          if (txt !== String(expectedCount)) return false;
          const inMenu = !!el.closest?.('[role="menu"],[role="listbox"],[class*="popover" i],[class*="dropdown" i],[class*="menu" i],[data-radix-popper-content-wrapper]');
          return inMenu || isImageCountContext(el) || isLikelyUnlabeledOutputControl(el);
        });
      const controls = Array.from(document.querySelectorAll('button,[role="button"],[role="radio"],[role="option"],[role="menuitem"],select,input[type="number"],label,[data-value]'))
        .filter(el => isVisible(el) && !isBlocked(el));
      const exact = controls.find(el => {
        const txt = read(el);
        const compact = txt.replace(/\s+/g, '');
        return (compact === String(expectedCount) || compact === `${expectedCount}images` || compact === `${expectedCount}ảnh`) && (isImageCountContext(el) || isLikelyUnlabeledOutputControl(el));
      });
      if (exact) {
        const compact = read(exact).replace(/\s+/g, '');
        if (compact === String(expectedCount) && isLikelyUnlabeledOutputControl(exact) && !isImageCountContext(exact)) {
          return { ok: true, expectedCount, detectedCount: expectedCount, method: 'already-set-unlabeled-control' };
        }
        click(exact);
        await sleep(250);
        return { ok: true, expectedCount, detectedCount: expectedCount, method: 'count-control-clicked' };
      }
      const trigger = controls.find(el => {
        const compact = read(el).replace(/\s+/g, '');
        return /^[1-4]$/.test(compact) && compact !== String(expectedCount) && (isImageCountContext(el) || isLikelyUnlabeledOutputControl(el));
      });
      if (trigger) {
        click(trigger);
        await sleep(350);
        const option = findMenuOption();
        if (option) {
          click(option);
          await sleep(250);
          return { ok: true, expectedCount, detectedCount: expectedCount, method: 'numeric-trigger-option' };
        }
        return { ok: true, skipped: true, expectedCount, detectedCount: Number(read(trigger).replace(/\s+/g, '')) || null, method: 'numeric-trigger-no-option', error: 'Không tìm thấy option output count sau khi mở menu' };
      }
      const select = controls.find(el => el.tagName === 'SELECT' && Array.from(el.options || []).some(o => String(o.value || o.textContent).trim() === String(expectedCount)) && isImageCountContext(el));
      if (select) {
        select.value = String(expectedCount);
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true, expectedCount, detectedCount: expectedCount, method: 'select-value' };
      }
      return { ok: true, skipped: true, expectedCount, detectedCount: null, method: 'not-found', error: 'Không tìm thấy control số ảnh trong Grok' };
    },
    args: [count, allowUnlabeledNumericControl],
  });
  const res = result?.[0]?.result || { ok: true, skipped: true, expectedCount: count, error: 'executeScript failed' };
  if (targetLogEl) {
    if (res.skipped) addLog(targetLogEl, `${logPrefix} Không tìm thấy control số output trong Grok, tiếp tục với cấu hình hiện tại.`, 'warn');
    else addLog(targetLogEl, `${logPrefix} Đã cấu hình ${count} ${mediaLabel}/prompt`, res.ok ? 'ok' : 'warn');
  }
  return res;
}

async function ensureI2VSingleOutput(tabId, options = {}) {
  const logEl = options.logEl || i2vLogEl;
  const displayName = options.displayName || 'Cảnh hiện tại';
  addLog(logEl, `[I2V output count] ${displayName} đảm bảo output video = 1.`, 'info');
  const res = await ensureImageOutputCount(tabId, 1, { logEl: null, allowUnlabeledNumericControl: true, mediaLabel: 'video' });
  if (!res.ok || res.skipped) {
    addLog(logEl, '[I2V output count] Không tìm thấy control output count, tiếp tục nhưng sẽ giám sát generating cards.', 'warn');
    return { ok: true, skipped: true, expectedCount: 1, detectedCount: res.detectedCount || null, method: res.method || 'not-found' };
  }
  return { ...res, ok: true, expectedCount: 1 };
}

async function ensureFilmSingleOutput(tabId, options = {}) {
  const logEl = options.logEl || sfLogEl;
  const displayName = options.displayName || 'Cảnh hiện tại';
  addLog(logEl, `[SF output count] ${displayName}: đảm bảo Grok chỉ tạo 1 video.`, 'info');
  const res = await ensureImageOutputCount(tabId, 1, {
    logEl: null,
    allowUnlabeledNumericControl: true,
    mediaLabel: 'video',
    logPrefix: '[SF output count]',
  });
  if (!res.ok || res.skipped) {
    addLog(logEl, `[SF output count] ${displayName}: không tìm thấy control output count, tiếp tục nhưng sẽ kiểm soát submit đúng 1 lần.`, 'warn');
    return { ok: true, skipped: true, expectedCount: 1, detectedCount: res.detectedCount || null, method: res.method || 'not-found' };
  }
  addLog(logEl, `[SF output count] ${displayName}: đã đặt output video = 1 bằng ${res.method || 'unknown'}.`, 'ok');
  return { ...res, ok: true, expectedCount: 1 };
}

async function downloadSpecificMediaUrl(tabId, url, filename, options = {}) {
  if (!url) return [];
  const type = options.type || 'video';
  const prompt = options.prompt || filename || 'media';
  const safeFilename = filename || `grok_${type}_${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`;
  try {
    if (String(url).startsWith('blob:')) {
      console.warn('[I2V download] blob video detected, direct download may fail');
      const fr = await chrome.scripting.executeScript({
        target: { tabId },
        func: async (blobUrl, fname) => {
          try {
            const resp = await fetch(blobUrl);
            const blob = await resp.blob();
            const reader = new FileReader();
            return await new Promise(resolve => {
              reader.onload = () => resolve({ ok: true, dataUrl: reader.result, filename: fname });
              reader.onerror = () => resolve({ ok: false, error: 'FileReader failed' });
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            return { ok: false, error: e?.message || String(e) };
          }
        },
        args: [url, safeFilename],
      });
      const r = fr?.[0]?.result;
      if (!r?.ok) return [];
      await chrome.downloads.download({ url: r.dataUrl, filename: r.filename, saveAs: false });
    } else {
      await chrome.downloads.download({ url, filename: safeFilename, saveAs: false });
    }
    return [{ filename: safeFilename, type, prompt, time: Date.now() }];
  } catch (e) {
    console.warn('[I2V download] downloadSpecificMediaUrl failed', { message: e?.message || String(e) });
    return [];
  }
}

async function downloadMediaWithFallback(tabId, sceneSlug, knownVideoUrls = new Set(), knownImageUrls = new Set(), genResult = {}, options = {}) {
  const logTarget = options.logEl || i2vLogEl;
  const displayName = options.displayName || 'cảnh hiện tại';
  const maxAttempts = Math.max(1, Number(options.maxAttempts || 1));
  const retryDelayMs = Math.max(0, Number(options.retryDelayMs || 0));
  const maxFiles = Math.max(1, Number(options.maxFiles || 1));
  const limitFiles = (files) => Array.isArray(files) ? files.slice(0, maxFiles) : [];
  addLog(logTarget, `[I2V download] thử tải media mới cho ${displayName}`, 'info');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const files = limitFiles(await downloadMedia(tabId, sceneSlug, 'video', knownVideoUrls, knownImageUrls));
    if (files?.length > 0) return { ok: true, files, method: 'new-url' };
    if (attempt < maxAttempts) {
      addLog(logTarget, `[I2V download] retry ${attempt}/${maxAttempts} cho ${displayName}`, 'warn');
      await sleep(retryDelayMs);
    }
  }

  const filename = `grok_vid_${slugify(sceneSlug)}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.mp4`;
  const genUrls = Array.isArray(genResult?.newUrls) ? genResult.newUrls.filter(Boolean) : [];
  if (genUrls.length > 0) {
    addLog(logTarget, '[I2V download] không thấy media mới, thử tải URL video đã detect từ bước generate', 'warn');
    for (const url of genUrls) {
      const files = limitFiles(await downloadSpecificMediaUrl(tabId, url, filename, { type: 'video', prompt: sceneSlug }));
      if (files?.length > 0) return { ok: true, files, method: 'gen-new-url' };
    }
  }

  addLog(logTarget, '[I2V download] không thấy URL mới, thử tải video mới nhất đang hiển thị', 'warn');
  const latest = await getLatestVisibleVideoUrl(tabId);
  addLog(logTarget, `[I2V download] latest visible candidates=${latest?.count || 0}`, latest?.ok ? 'info' : 'warn');
  if (latest?.ok && latest.url) {
    console.debug('[I2V download] latest visible video candidate', { source: latest.source, count: latest.count });
    const files = limitFiles(await downloadSpecificMediaUrl(tabId, latest.url, filename, { type: 'video', prompt: sceneSlug }));
    if (files?.length > 0) return { ok: true, files, method: 'latest-visible-video' };
  }

  const card = await getLatestResultCardVideoUrl(tabId);
  addLog(logTarget, `[I2V download] result card video candidates=${card?.count || 0}`, card?.ok ? 'info' : 'warn');
  if (card?.ok && card.url) {
    console.debug('[I2V download] result card video candidate', { source: card.source, count: card.count });
    const files = limitFiles(await downloadSpecificMediaUrl(tabId, card.url, filename, { type: 'video', prompt: sceneSlug }));
    if (files?.length > 0) return { ok: true, files, method: 'result-card-video' };
  }

  addLog(logTarget, '[I2V download] không lấy được URL video, thử click nút Download mới nhất của Grok', 'warn');
  const nativeDl = await clickLatestGrokDownloadButton(tabId);
  if (nativeDl?.ok) {
    const nativeFile = { filename: filename, type: 'video', prompt: sceneSlug, time: Date.now(), nativeDownload: true };
    return { ok: true, files: [nativeFile], method: 'native-download-button' };
  }
  console.debug('[I2V download] native download fallback failed', nativeDl);

  return {
    ok: false,
    code: 'download_failed',
    error: 'Không tìm thấy video để tải sau khi thử tất cả fallback.',
  };
}

async function collectGeneratedImageCandidates(tabId, knownImageUrls = new Set()) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: (knownArr) => {
      const known = new Set(knownArr);
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width >= 80 && r.height >= 80 && st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
      };
      const isBlocked = (el) => !!el.closest?.('form,[data-testid*="composer" i],[class*="composer" i],[class*="avatar" i],[class*="sidebar" i],[class*="attachment" i]');
      const candidates = [];
      const add = (url, el, source) => {
        if (!url || known.has(url) || url.startsWith('data:') || isBlocked(el) || !isVisible(el)) return;
        const r = el.getBoundingClientRect();
        const nw = Number(el.naturalWidth || r.width || 0);
        const nh = Number(el.naturalHeight || r.height || 0);
        if (nw < 256 || nh < 256) return;
        const inResult = !!el.closest('[class*="post" i],[class*="result" i],[class*="media" i],article,[data-testid*="post" i]');
        candidates.push({ url, source, width: nw, height: nh, area: nw * nh, bottom: r.bottom, inResult });
      };
      document.querySelectorAll('img').forEach(img => add(img.currentSrc || img.src || '', img, 'img'));
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.href || '';
        if (/\.(jpg|jpeg|png|webp)(?:\?|$)/i.test(href) || /assets\.grok\.com|\/content/i.test(href)) add(href, a, 'anchor-image');
      });
      const unique = [];
      const seen = new Set();
      for (const c of candidates) {
        if (seen.has(c.url)) continue;
        seen.add(c.url);
        unique.push(c);
      }
      unique.sort((a, b) => Number(b.inResult) - Number(a.inResult) || b.area - a.area || b.bottom - a.bottom);
      return unique;
    },
    args: [[...knownImageUrls]],
  });
  return result?.[0]?.result || [];
}

async function downloadGeneratedImagesForPrompt(tabId, options = {}) {
  const prompt = options.prompt || '';
  const promptIndex = Number(options.promptIndex || 1);
  const expectedCount = normalizeImgOutputCount(options.expectedCount || imgOutputCount);
  const knownImageUrls = options.knownImageUrls || new Set();
  const targetLogEl = options.logEl || imgLogEl;
  addLog(targetLogEl, `[TextToImg download] Prompt ${promptIndex}: cần tải ${expectedCount} ảnh.`, 'info');
  const candidates = (await collectGeneratedImageCandidates(tabId, knownImageUrls)).slice(0, expectedCount);
  addLog(targetLogEl, `[TextToImg download] phát hiện ${candidates.length} ảnh mới.`, candidates.length >= expectedCount ? 'ok' : 'warn');
  if (candidates.length > 0 && candidates.length < expectedCount) {
    addLog(targetLogEl, `[TextToImg download] Chỉ phát hiện ${candidates.length}/${expectedCount} ảnh mới, tải ${candidates.length} ảnh đã có.`, 'warn');
  }
  const files = [];
  const previews = [];
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const slug = slugify(prompt);
  for (const [idx, item] of candidates.entries()) {
    const ext = /\.png(?:\?|$)/i.test(item.url) ? 'png' : /\.webp(?:\?|$)/i.test(item.url) ? 'webp' : 'jpg';
    const filename = `grok_img_prompt${String(promptIndex).padStart(2, '0')}_${String(idx + 1).padStart(2, '0')}_${slug}_${ts}.${ext}`;
    addLog(targetLogEl, `[TextToImg download] Tải ảnh ${idx + 1}/${expectedCount}...`, 'info');
    const downloaded = await downloadSpecificMediaUrl(tabId, item.url, filename, { type: 'image', prompt });
    if (downloaded.length > 0) {
      files.push(...downloaded);
      previews.push(item.url);
    }
  }
  addLog(targetLogEl, `[TextToImg download] Hoàn tất ${files.length}/${expectedCount} ảnh.`, files.length >= expectedCount ? 'ok' : files.length > 0 ? 'warn' : 'err');
  return { ok: files.length > 0, downloaded: files.length, expectedCount, files, previews, detected: candidates.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO — Main loop
// ─────────────────────────────────────────────────────────────────────────────
async function runInjector() {
  if (isRunning) return;
  const prompts = parsePrompts(promptsInput.value);
  if (prompts.length === 0) { alert('Vui lòng nhập ít nhất 1 prompt!'); return; }

  if (!txtQueue.length || txtQueue.length !== prompts.length) {
    const globalDuration = durationToPillValue(globalSettingsDraft.duration || selectedDuration || '6s');
    txtQueue = prompts.map(p => ({ prompt: p, state: 'waiting', duration: globalDuration }));
    renderTxtQueue();
  }

  const tab = await checkTab();
  if (!tab) { alert('Hãy mở grok.com → Imagine!'); return; }

  const delay = Math.max(500, parseInt(delayInput.value) || 2000);
  const doSubmitUI = autoSubmit.checked;
  const doSubmit = true;
  const doDL = autoDownload.checked;
  const doWaitUI = waitGenerate.checked;
  const doWait = true;
  const tmOut = (parseInt(timeoutInput.value) || 300) * 1000;

  isRunning = true; stopRequested = false;
  runBtn.disabled = true; stopBtn.disabled = false;
  promptsInput.disabled = true;
  logEl.innerHTML = '';
  progressWrap.classList.add('show');
  setProgress(progBar, progLabel, 0, prompts.length);
  if (!doSubmitUI) addLog(logEl, 'ℹ Queue mode: luôn bật Auto Submit để đảm bảo chạy tuần tự.', 'warn');
  if (!doWaitUI) addLog(logEl, 'ℹ Queue mode: luôn chờ generate xong trước khi chạy prompt tiếp theo.', 'warn');
  addLog(logEl, '[Import guard] feature=TextToVideo skip image import.', 'info');

  document.querySelectorAll('.q-dur-mini').forEach(b => b.classList.add('disabled'));

  let done = 0;
  let failed = 0;
  let stopped = false;
  const runErrors = [];
  const recordVideoError = (i, step, res, willContinue = true) => {
    const normalized = normalizeErrorResult(res, { step, code: res?.code || 'unknown_error' });
    const entry = {
      sceneId: `video-prompt-${i + 1}`,
      index: i + 1,
      step,
      code: normalized.code,
      message: normalized.error,
      detail: normalized.detail,
    };
    runErrors.push(entry);
    failed++;
    logSceneError(logEl, {
      feature: 'Văn bản thành Video',
      sceneId: entry.sceneId,
      index: entry.index,
      total: prompts.length,
      step,
      code: entry.code,
      message: entry.message,
      detail: entry.detail,
      willContinue,
      raw: normalized.raw,
    });
  };
  const videoRuntimeState = {
    ratioValidated: false,
    videoModeConfirmedOnFirstPrompt: false,
    confirmedVideoMode: null,
    globalVideoSettingsConfirmedOnFirstPrompt: false,
    confirmedVideoSettings: null,
  };
  for (let i = 0; i < prompts.length; i++) {
    if (stopRequested) { stopped = true; addLog(logEl, `⏹ Dừng tại prompt ${i + 1}`, 'warn'); break; }

    const prompt = prompts[i];
    const short = prompt.length > 55 ? prompt.slice(0, 52) + '…' : prompt;

    setStatus(`⏳ Prompt ${i + 1}/${prompts.length}`, 'orange');
    addLog(logEl, `[${i + 1}/${prompts.length}] ${short}`);

    txtQueue[i].state = 'running';
    const activeCountEl = $('queue-active-count');
    if (activeCountEl) activeCountEl.textContent = '1';
    const card = $(`q-item-${i}`);
    const stat = $(`q-status-${i}`);
    const pbar = $(`q-prog-${i}`);
    if (card) { card.className = 'q-item running'; card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    if (stat) stat.textContent = 'Đang chạy';
    if (pbar) pbar.style.width = '5%';

    if (doSubmit) {
      const videoSettings = await getVideoGlobalSettings();
      logGlobalSettingsLoaded(logEl, '[Global settings]', videoSettings);
      const skipGlobalSettings = shouldSkipTextToVideoGlobalSettingsAfterFirstPrompt({
        mode: 'text2video',
        promptIndex: i,
        runState: videoRuntimeState,
      });
      if (skipGlobalSettings.skip) {
        addLog(logEl, `[Video settings guard] skipped: ${skipGlobalSettings.reason}`, 'info');
      } else {
        const includeRatio = i === 0 && !videoRuntimeState.ratioValidated;
        const includeResolution = i === 0;
        const includeDuration = i === 0;
        if (!includeRatio) addLog(logEl, `[Video ratio] promptIndex=${i + 1} bỏ qua aspect ratio guard vì đã xác nhận ở prompt đầu tiên`, 'info');
        const modeSkip = shouldSkipTextToVideoModeGuardAfterFirstPrompt({
          mode: 'text-to-video',
          settingType: 'mode',
          promptIndex: i,
          runState: videoRuntimeState,
        });
        const settingsRes = await ensureComposerMatchesGlobalSettings(tab.id, videoSettings, {
          logPrefix: '[Video settings guard]',
          logEl,
          expectedMode: 'Video',
          includeMode: !modeSkip.skip,
          skipModeReason: modeSkip.reason,
          promptIndex: i,
          includeRatio,
          includeResolution,
          includeDuration,
        });
        if (!settingsRes.ok) {
          recordVideoError(i, 'Kiểm tra Global Settings', settingsRes, true);
          txtQueue[i].state = 'error';
          if (activeCountEl) activeCountEl.textContent = '0';
          if (card) card.className = 'q-item error';
          if (stat) stat.textContent = 'Lỗi';
          if (pbar) pbar.style.width = '0%';
          continue;
        }
        if (includeRatio && settingsRes.results?.ratio?.ok) videoRuntimeState.ratioValidated = true;
        if (i === 0) {
          videoRuntimeState.videoModeConfirmedOnFirstPrompt = true;
          videoRuntimeState.confirmedVideoMode = 'Video';
          videoRuntimeState.globalVideoSettingsConfirmedOnFirstPrompt = true;
          videoRuntimeState.confirmedVideoSettings = {
            mode: 'Video',
            ratio: videoSettings.ratio,
            resolution: videoSettings.resolution,
            duration: videoSettings.duration,
          };
        }
        addLog(logEl, `[Video settings guard] PASS ratio=${videoSettings.ratio} resolution=${videoSettings.resolution} duration=${videoSettings.duration}`, 'ok');
        await sleep(300);
      }
    }

    const knownVideoUrls = await snapshotVideoUrls(tab.id);

    try {
      const res = await injectTextPrompt(tab.id, prompt, doSubmit);
      if (!res.ok) {
        recordVideoError(i, 'Inject prompt text / Submit', { ...res, code: res.code || 'submit_failed' }, true);
        txtQueue[i].state = 'error';
        if (card) card.className = 'q-item error';
        if (stat) stat.textContent = 'Lỗi';
        if (pbar) pbar.style.width = '0%';
        continue;
      }
      addLog(logEl, `  ✓ Đã submit`, 'ok');
      if (pbar) pbar.style.width = '10%';
    } catch (e) {
      recordVideoError(i, 'Inject prompt text / Submit', { code: 'exception', error: e?.message || String(e), detail: e?.stack?.slice(0, 500), raw: e }, true);
      txtQueue[i].state = 'error';
      if (activeCountEl) activeCountEl.textContent = '0';
      if (card) card.className = 'q-item error';
      if (stat) stat.textContent = 'Lỗi';
      if (pbar) pbar.style.width = '0%';
      continue;
    }

    if (doWait && doSubmit) {
      setStatus(`⏳ Chờ generate ${i + 1}/${prompts.length}...`, 'orange');
      addLog(logEl, `  ⏳ Chờ Grok generate...`);
      // Giảm từ 2000ms → 800ms: poll ngay khi Grok nhanh (đường truyền tốt)
      await sleep(800);

      addLog(logEl, `[Video generate] promptIndex=${i + 1} waitGenerateWithSignals start.`, 'info');
      const gen = await waitForGrokGenerationDone(tab.id, {
        sceneId: `prompt-${i + 1}`,
        promptIndex: i + 1,
        mediaType: 'video',
        knownState: { videoUrls: knownVideoUrls },
        timeoutMs: tmOut,
        shouldStop: () => stopRequested,
        progressCallback: (pct) => { if (pbar) pbar.style.width = pct + '%'; },
        logPrefix: '[Video generate]',
        logEl,
      });

      // Nếu detect bằng fallback (không phải video URL trực tiếp),
      // chờ thêm tối đa 8s để video URL thực sự xuất hiện trong DOM
      if (gen.ok && gen.reason !== 'new-video' && gen.reason !== 'media-stable') {
        addLog(logEl, `  ⏳ Xác nhận video (${gen.reason})...`, 'info');
        const confirmStart = Date.now();
        while (Date.now() - confirmStart < 8000) {
          await sleep(800);
          const confirmUrls = await snapshotVideoUrls(tab.id);
          const hasNew = [...confirmUrls].some(u => !knownVideoUrls.has(u));
          if (hasNew) {
            addLog(logEl, `  ✅ Video URL confirmed!`, 'ok');
            break;
          }
        }
      }

      if (gen.ok) {
        if (pbar) pbar.style.width = '100%';
        addLog(logEl, `  ✅ Generate xong! (${gen.reason})`, 'ok');
        txtQueue[i].state = 'success';
        if (activeCountEl) activeCountEl.textContent = '0';
        if (card) card.className = 'q-item success';
        if (stat) stat.textContent = 'Hoàn thành';
        // ★ GUARD: Đảm bảo download thành công TRƯỚC khi sang prompt tiếp theo
if (doDL) {
  let dlSuccess = false;
  let dlAttempts = 0;
  const maxDlAttempts = await getMaxRetries();

  while (!dlSuccess && dlAttempts < maxDlAttempts) {
    dlAttempts++;
    addLog(logEl, `  ⬇ Tải video (lần ${dlAttempts}/${maxDlAttempts})...`);

    const files = await downloadMedia(tab.id, prompt, 'video', knownVideoUrls);

    if (files.length > 0) {
      downloadHistory.push(...files);
      renderDownloads();
      addLog(logEl, `  ✅ Tải video thành công!`, 'ok');
      dlSuccess = true;
    } else {
      if (dlAttempts < maxDlAttempts) {
        addLog(logEl, `  ⏳ Chờ 20s rồi thử tải lại (${dlAttempts}/${maxDlAttempts})...`, 'warn');
        await sleep(20000);
      } else {
        addLog(logEl, `  ✗ Không tải được video sau ${maxDlAttempts} lần thử`, 'err');
      txtQueue[i].state = 'error';
      if (activeCountEl) activeCountEl.textContent = '0';
        if (card) card.className = 'q-item error';
        if (stat) stat.textContent = 'Lỗi';
      }
    }
  }

  if (!dlSuccess) {
    recordVideoError(i, 'Download media', { code: 'download_failed', error: `Không tải được video sau ${maxDlAttempts} lần thử` }, true);
    addLog(logEl, `  ⚠ Bỏ qua prompt ${i+1} — chạy tiếp prompt tiếp theo...`, 'warn');
    // Không break — tiếp tục queue dù download thất bại
  }
}
      } else if (gen.reason === 'moderated') {
        if (pbar) pbar.style.width = '0%';
        recordVideoError(i, 'Chờ Grok generate', { code: 'moderated', error: 'Prompt bị Grok từ chối (moderation).', reason: gen.reason }, true);
        txtQueue[i].state = 'error';
        if (activeCountEl) activeCountEl.textContent = '0';
        if (card) card.className = 'q-item error';
        if (stat) stat.textContent = 'Lỗi';
        // Không break — skip prompt này, tiếp tục queue
      } else if (gen.reason === 'timeout') {
        if (pbar) pbar.style.width = '100%';
        recordVideoError(i, 'Chờ Grok generate', { code: 'generate_timeout', error: `Không phát hiện media mới sau ${timeoutInput.value || 300} giây.`, reason: gen.reason }, true);
        txtQueue[i].state = 'timeout';
        if (activeCountEl) activeCountEl.textContent = '0';
        if (card) card.className = 'q-item error';
        if (stat) stat.textContent = 'Timeout';
      } else if (gen.reason === 'stopped') {
        stopped = true;
        txtQueue[i].state = 'waiting';
        if (activeCountEl) activeCountEl.textContent = '0';
        if (card) card.className = 'q-item waiting';
        if (stat) stat.textContent = 'Sẵn sàng';
        if (pbar) pbar.style.width = '0%';
        break;
      }
    }

    done++;
    setProgress(progBar, progLabel, done, prompts.length);
    if (i < prompts.length - 1 && !stopRequested) await sleep(delay);
  }

  isRunning = false;
  runBtn.disabled = false; stopBtn.disabled = true;
  promptsInput.disabled = false;
  document.querySelectorAll('.q-dur-mini').forEach(b => b.classList.remove('disabled'));

  const allOk = done === prompts.length;
  setStatus(allOk ? `✓ Xong ${done} prompt` : `Xong ${done}/${prompts.length}`, allOk ? 'green' : 'orange');
  addLog(logEl, `── Hoàn tất: ${done}/${prompts.length} ──`, allOk ? 'ok' : 'warn');
  logRunSummary(logEl, {
    feature: 'Văn bản thành Video',
    total: prompts.length,
    done,
    failed,
    stopped,
    errors: runErrors,
    stopReason: stopped ? 'Người dùng dừng hoặc Grok trả về stopped.' : '',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE — Main loop
// ─────────────────────────────────────────────────────────────────────────────
async function runImageGenerator() {
  if (imgIsRunning) return;
  const prompts = parseImagePrompts(imgPromptsInput.value);
  if (prompts.length === 0) { alert('Vui lòng nhập ít nhất 1 dòng prompt!'); return; }

  const outputCount = normalizeImgOutputCount(imgOutputCount);
  imgQueue = prompts.map(p => ({
    prompt: p,
    state: 'waiting',
    expectedOutputCount: outputCount,
    generatedCount: 0,
    downloadedCount: 0,
    previews: [],
    files: [],
  }));
  renderImgQueue();

  const tab = await checkTab();
  if (!tab) { alert('Hãy mở grok.com → Imagine!'); return; }

  const delay = Math.max(500, parseInt(delayInput.value) || 2000);
  const doWait = imgWaitGen.checked;
  const tmOut = (parseInt(timeoutInput.value) || 300) * 1000;

  imgIsRunning = true; imgStopReq = false;
  imgRunBtn.disabled = true; imgStopBtn.disabled = false;
  imgPromptsInput.disabled = true;
  imgLogEl.innerHTML = '';
  imgProgressWrap.classList.add('show');
  setProgress(imgProgBar, imgProgLabel, 0, prompts.length, 'Đã tạo ảnh');
  addLog(imgLogEl, '[Import guard] feature=TextToImage skip image import.', 'info');
  addLog(imgLogEl, `[TextToImg] outputCount=${outputCount} ảnh/prompt`, 'info');

  addLog(imgLogEl, '🔄 Chuyển sang Imagine → Image mode...');
  const navRes = await navigateToImagineImage(tab.id);
  if (navRes.ok) {
    addLog(imgLogEl, `  ✓ Đã chuyển sang Image mode (${navRes.step})`, 'ok');
  } else {
    addLog(imgLogEl, '  ⚠ Không tìm thấy Image mode selector, tiếp tục...', 'warn');
  }
  await sleep(800);

  let done = 0;
  let failed = 0;
  let stopped = false;
  const runErrors = [];
  const recordImageError = (i, step, res, willContinue = true) => {
    const normalized = normalizeErrorResult(res, { step, code: res?.code || 'unknown_error' });
    const entry = {
      sceneId: `image-prompt-${i + 1}`,
      index: i + 1,
      step,
      code: normalized.code,
      message: normalized.error,
      detail: normalized.detail,
    };
    runErrors.push(entry);
    failed++;
    logSceneError(imgLogEl, {
      feature: 'Text to Image',
      sceneId: entry.sceneId,
      index: entry.index,
      total: prompts.length,
      step,
      code: entry.code,
      message: entry.message,
      detail: entry.detail,
      willContinue,
      raw: normalized.raw,
    });
  };
  const imageRuntimeState = { ratioValidated: false };
  for (let i = 0; i < prompts.length; i++) {
    if (imgStopReq) { stopped = true; addLog(imgLogEl, `⏹ Dừng tại ảnh ${i + 1}`, 'warn'); break; }

    const prompt = prompts[i];
    const short = prompt.length > 55 ? prompt.slice(0, 52) + '…' : prompt;

    setStatus(`🖼 Tạo ảnh ${i + 1}/${prompts.length}`, 'orange');
    addLog(imgLogEl, `[${i + 1}/${prompts.length}] ${short}`);

    imgQueue[i].state = 'running';
    imgQueue[i].expectedOutputCount = outputCount;
    imgQueue[i].generatedCount = 0;
    imgQueue[i].downloadedCount = 0;
    imgQueue[i].previews = [];
    imgQueue[i].files = [];
    const card = $(`img-item-${i}`);
    const stat = $(`img-status-${i}`);
    const pbar = $(`img-prog-${i}`);
    if (card) { card.className = 'img-item running'; card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    if (stat) stat.textContent = '⏳ Đang tạo';
    if (pbar) pbar.style.width = '5%';
    renderImgQueue();

    const knownImageUrls = await snapshotImageUrls(tab.id);

    if (i > 0) { await navigateToImagineImage(tab.id); await sleep(400); }

    const imageSettings = await getImageGlobalSettings();
    logGlobalSettingsLoaded(imgLogEl, '[Global settings]', imageSettings);
    const includeRatio = i === 0 && !imageRuntimeState.ratioValidated;
    if (!includeRatio) addLog(imgLogEl, `[Image ratio] promptIndex=${i + 1} bỏ qua aspect ratio guard vì đã xác nhận ở prompt đầu tiên`, 'info');
    const settingsRes = await ensureComposerMatchesGlobalSettings(tab.id, imageSettings, {
      logPrefix: '[Image settings guard]',
      logEl: imgLogEl,
      expectedMode: 'Image',
      includeMode: true,
      includeRatio,
      includeResolution: false,
      includeDuration: false,
    });
    if (!settingsRes.ok) {
      recordImageError(i, 'Kiểm tra Global Settings', settingsRes, true);
      imgQueue[i].state = 'error';
      if (card) card.className = 'img-item error';
      if (stat) stat.textContent = '✗ Lỗi';
      if (pbar) pbar.style.width = '0%';
      continue;
    }
    if (includeRatio && settingsRes.results?.ratio?.ok) imageRuntimeState.ratioValidated = true;
    addLog(imgLogEl, `[Image settings guard] PASS ratio=${imageSettings.ratio}`, 'ok');
    await sleep(200);
    const outputRes = await ensureImageOutputCount(tab.id, outputCount, { logEl: imgLogEl });
    addLog(imgLogEl, `[TextToImg output count] expected=${outputCount} method=${outputRes.method || 'unknown'}`, outputRes.ok ? 'info' : 'warn');

    try {
      const res = await injectTextPrompt(tab.id, prompt, true);
      if (!res.ok) {
        recordImageError(i, 'Inject prompt text / Submit', { ...res, code: res.code || 'submit_failed' }, true);
        imgQueue[i].state = 'error';
        if (card) card.className = 'img-item error';
        if (stat) stat.textContent = '✗ Lỗi';
        if (pbar) pbar.style.width = '0%';
        continue;
      }
      addLog(imgLogEl, `  ✓ Đã submit`, 'ok');
      if (pbar) pbar.style.width = '10%';
    } catch (e) {
      recordImageError(i, 'Inject prompt text / Submit', { code: 'exception', error: e?.message || String(e), detail: e?.stack?.slice(0, 500), raw: e }, true);
      imgQueue[i].state = 'error';
      if (card) card.className = 'img-item error';
      if (stat) stat.textContent = '✗ Lỗi';
      if (pbar) pbar.style.width = '0%';
      continue;
    }

    setStatus(`⏳ Chờ ảnh ${i + 1}/${prompts.length}...`, 'orange');
    addLog(imgLogEl, `  ⏳ Chờ Grok tạo ảnh...`);
    await sleep(2000);

    addLog(imgLogEl, `[Image generate] promptIndex=${i + 1} waitGenerateWithSignals start.`, 'info');
    addLog(imgLogEl, '[TextToImg generate] Chờ đủ ảnh output...', 'info');
    const gen = await waitForGrokGenerationDone(tab.id, {
      sceneId: `image-${i + 1}`,
      promptIndex: i + 1,
      mediaType: 'image',
      knownState: { imageUrls: knownImageUrls },
      expectedImageCount: outputCount,
      minImageCount: 1,
      minimumWaitAfterFirstImage: 4000,
      timeoutMs: tmOut,
      shouldStop: () => imgStopReq,
      progressCallback: (pct) => { if (pbar) pbar.style.width = pct + '%'; },
      logPrefix: '[Image generate]',
      logEl: imgLogEl,
    });

    if (gen.ok) {
      if (pbar) pbar.style.width = '100%';
      const generatedCount = Number(gen.newImagesCount || gen.newUrls?.length || 0);
      imgQueue[i].generatedCount = generatedCount;
      addLog(imgLogEl, `  ✅ Tạo ảnh xong! (${generatedCount}/${outputCount})`, gen.partial ? 'warn' : 'ok');
      imgQueue[i].state = gen.partial ? 'partial' : 'success';
      if (card) card.className = 'img-item success';
      if (stat) stat.textContent = gen.partial ? 'Hoàn thành một phần' : '✅ Xong';
      if (imgAutoDL.checked) {
        await sleep(500);
        const dl = await downloadGeneratedImagesForPrompt(tab.id, {
          prompt,
          promptIndex: i + 1,
          expectedCount: outputCount,
          knownImageUrls,
          logEl: imgLogEl,
        });
        imgQueue[i].downloadedCount = dl.downloaded || 0;
        imgQueue[i].previews = dl.previews || [];
        imgQueue[i].files = dl.files || [];
        if (dl.files.length > 0) {
          downloadHistory.push(...dl.files);
          renderDownloads();
          imgQueue[i].state = dl.downloaded >= outputCount ? 'success' : 'partial';
          if (stat) stat.textContent = dl.downloaded >= outputCount ? '✅ Xong' : 'Hoàn thành một phần';
          if (dl.downloaded < outputCount) addLog(imgLogEl, `[TextToImg] Hoàn thành một phần: ${dl.downloaded}/${outputCount} ảnh.`, 'warn');
        }
        else {
          recordImageError(i, 'Download media', { code: 'download_failed', error: 'Không tải được ảnh (có thể ảnh chưa render).' }, true);
          imgQueue[i].state = 'error';
        }
      }
      renderImgQueue();
    } else if (gen.reason === 'timeout') {
      if (pbar) pbar.style.width = '100%';
      recordImageError(i, 'Chờ Grok generate', { code: 'generate_timeout', error: `Không phát hiện ảnh mới sau ${timeoutInput.value || 300} giây.`, reason: gen.reason }, true);
      imgQueue[i].state = 'error';
      if (card) card.className = 'img-item error';
      if (stat) stat.textContent = '⏰ Timeout';
    } else if (gen.reason === 'stopped') {
      stopped = true;
      imgQueue[i].state = 'waiting';
      if (card) card.className = 'img-item waiting';
      if (stat) stat.textContent = 'Chờ xử lý';
      if (pbar) pbar.style.width = '0%';
      break;
    }

    done++;
    setProgress(imgProgBar, imgProgLabel, done, prompts.length, 'Đã tạo ảnh');
    if (i < prompts.length - 1 && !imgStopReq) await sleep(delay);
  }

  imgIsRunning = false;
  imgRunBtn.disabled = false; imgStopBtn.disabled = true;
  imgPromptsInput.disabled = false;

  const allOk = done === prompts.length;
  setStatus(allOk ? `✓ Tạo xong ${done} ảnh` : `Xong ${done}/${prompts.length} ảnh`, allOk ? 'green' : 'orange');
  addLog(imgLogEl, `── Hoàn tất: ${done}/${prompts.length} ảnh ──`, allOk ? 'ok' : 'warn');
  logRunSummary(imgLogEl, {
    feature: 'Text to Image',
    total: prompts.length,
    done,
    failed,
    stopped,
    errors: runErrors,
    stopReason: stopped ? 'Người dùng dừng hoặc Grok trả về stopped.' : '',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// IMG2VID — Parse & render
// ─────────────────────────────────────────────────────────────────────────────
function i2vUpdateCount() {
  const prompts = parsePrompts(i2vTextarea.value);
  i2vCount.textContent = prompts.length;
  i2vChar.textContent = i2vTextarea.value.length + ' ký tự';
}

function i2vSetStep(step) {
  [i2vStep1, i2vStep2, i2vStep3].forEach((el, idx) => {
    el.classList.remove('active', 'done');
    if (idx + 1 < step) el.classList.add('done');
    if (idx + 1 === step) el.classList.add('active');
  });
}

function ensureI2VSceneIds() {
  i2vPairs = i2vPairs.map((pair, index) => {
    const fallbackId = createSceneId('img2vid', index, 'draft');
    const sceneId = pair.sceneId || pair.id || fallbackId;
    return {
      ...pair,
      id: pair.id || sceneId,
      sceneId,
      index,
      state: pair.state || (pair.imageDataUrl ? 'ready' : 'waiting'),
    };
  });
  return i2vPairs;
}

function i2vRenderPairs() {
  const prompts = parsePrompts(i2vTextarea.value);
  const i2vQueueCount = $('i2v-queue-count');
  if (i2vQueueCount) i2vQueueCount.textContent = String(prompts.length);
  if (prompts.length === 0) {
    i2vPairsEl.innerHTML = '';
    if (i2vOptions) i2vOptions.style.display = 'none';
    if (i2vDurCard) i2vDurCard.style.display = 'none';
    i2vToggleOpts.style.display = 'none';
    i2vBtnRow.style.display = 'none';
    i2vParseInfo.innerHTML = 'Nhập prompt, cách 1 dòng để tự tạo scene tiếp theo ↓';
    i2vSetStep(1); return;
  }

  const existingMap = {};
  i2vPairs.forEach(p => { existingMap[p.prompt] = p; });
  i2vPairs = prompts.map((prompt, index) => {
    const ex = existingMap[prompt];
    const fallbackId = createSceneId('img2vid', index, 'draft');
    return {
      id: ex?.id || ex?.sceneId || fallbackId,
      sceneId: ex?.sceneId || ex?.id || fallbackId,
      index,
      prompt,
      imageFile: ex?.imageFile || null,
      imageDataUrl: ex?.imageDataUrl || null,
      state: ex?.state || (ex?.imageDataUrl ? 'ready' : 'waiting'),
    };
  });
  ensureI2VSceneIds();

  i2vPairsEl.innerHTML = '';
  i2vPairs.forEach((pair, idx) => renderPairCard(pair, idx));

  if (i2vOptions) i2vOptions.style.display = 'none';
  if (i2vDurCard) i2vDurCard.style.display = 'none';
  i2vToggleOpts.style.display = 'flex';
  i2vBtnRow.style.display = 'flex';
  i2vParseInfo.innerHTML = `<strong>${prompts.length}</strong> scene — gán ảnh cho từng scene ↓`;
  i2vGuardBanner.classList.remove('show');
  i2vSetStep(2);
}

function renderPairCard(pair, idx) {
  const card = document.createElement('div');
  card.className = 'i2v-pair';
  card.id = `i2v-pair-${idx}`;
  const title = getQueueItemTitle(pair, idx);
  const preview = getQueueItemPromptPreview(pair);
  card.innerHTML = `
    <div class="i2v-pair-header">
      <div class="i2v-pair-num">${idx + 1}</div>
      ${renderI2VQueueImportThumbnail(pair, idx)}
      <div class="prompt-queue-main">
        <div class="prompt-queue-item-title">${escapeHtml(title)}</div>
        <div class="i2v-pair-prompt-preview queue-prompt-preview">${escapeHtml(preview)}</div>
        <div class="prompt-queue-item-meta">${escapeHtml(getSceneDisplayName(idx))}</div>
      </div>
      <span class="i2v-pair-status" id="i2v-pstatus-${idx}">Chờ ảnh</span>
    </div>
    <div class="i2v-pair-body">
      <div class="i2v-upload-zone ${pair.imageDataUrl ? 'has-image' : ''}" id="i2v-zone-${idx}">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" id="i2v-file-${idx}">
        <div class="i2v-upload-icon">🖼</div>
        <div class="i2v-upload-label">Nhấp để<br>chọn ảnh</div>
        <img class="i2v-preview-img" id="i2v-img-${idx}" src="${pair.imageDataUrl || ''}" alt="">
        <button class="i2v-remove-btn" id="i2v-rm-${idx}" title="Xóa ảnh">✕</button>
      </div>
      <div class="i2v-pair-text">${escapeHtml(pair.prompt)}</div>
    </div>
    <div class="i2v-pair-prog-bg"><div class="i2v-pair-prog" id="i2v-pprog-${idx}"></div></div>
    <div class="i2v-pair-error-msg" id="i2v-perr-${idx}"></div>`;
  i2vPairsEl.appendChild(card);

  const openSceneImagePicker = () => {
    const input = $(`i2v-file-${idx}`);
    if (input) input.click();
  };
  $(`i2v-qimport-${idx}`)?.addEventListener('click', openSceneImagePicker);
  $(`i2v-qimport-${idx}`)?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openSceneImagePicker();
    }
  });

  $(`i2v-file-${idx}`).addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) { showPairError(idx, 'Chỉ chấp nhận file ảnh'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      i2vPairs[idx].imageFile = file;
      i2vPairs[idx].imageDataUrl = ev.target.result;
      $(`i2v-img-${idx}`).src = ev.target.result;
      const queueThumbImg = $(`i2v-pair-${idx}`)?.querySelector('.queue-thumb img');
      const queueThumb = $(`i2v-pair-${idx}`)?.querySelector('.queue-thumb');
      if (queueThumbImg) queueThumbImg.src = ev.target.result;
      if (queueThumb) {
        queueThumb.classList.add('has-image');
        queueThumb.classList.remove('queue-thumb-placeholder');
        queueThumb.innerHTML = `<img src="${escapeHtml(ev.target.result)}" alt="">`;
        queueThumb.title = `Đổi ảnh scene ${idx + 1}`;
      }
      $(`i2v-zone-${idx}`).classList.add('has-image');
      clearPairError(idx);
      updatePairStatus(idx, 'ready');
      i2vGuardBanner.classList.remove('show');
    };
    reader.readAsDataURL(file);
  });

  $(`i2v-rm-${idx}`).addEventListener('click', e => {
    e.stopPropagation();
    i2vPairs[idx].imageFile = null;
    i2vPairs[idx].imageDataUrl = null;
    $(`i2v-img-${idx}`).src = '';
    const queueThumb = $(`i2v-pair-${idx}`)?.querySelector('.queue-thumb');
    if (queueThumb) {
      queueThumb.classList.remove('has-image');
      queueThumb.classList.add('queue-thumb-placeholder');
      queueThumb.innerHTML = '<span>Import<br>ảnh</span>';
      queueThumb.title = `Import ảnh scene ${idx + 1}`;
    }
    $(`i2v-zone-${idx}`).classList.remove('has-image');
    $(`i2v-file-${idx}`).value = '';
    updatePairStatus(idx, 'waiting');
  });

  if (pair.imageDataUrl) updatePairStatus(idx, 'ready');
}

function updatePairStatus(idx, state) {
  if (i2vPairs[idx]) i2vPairs[idx].state = state;
  const card = $(`i2v-pair-${idx}`);
  const status = $(`i2v-pstatus-${idx}`);
  if (!card || !status) return;
  card.classList.remove('error', 'success', 'running');
  const map = {
    waiting: ['', 'Chờ ảnh'],
    ready: ['', 'Sẵn sàng'],
    running: ['running', 'Đang chạy'],
    settings: ['running', 'Đang cấu hình'],
    uploading: ['running', 'Đang upload ảnh'],
    prompting: ['running', 'Đang gán prompt'],
    guarding: ['running', 'Đang kiểm tra'],
    submitting: ['running', 'Đang submit'],
    generating: ['running', 'Đang generate'],
    post_verifying: ['running', 'Đang kiểm tra kết quả'],
    downloading: ['running', 'Đang tải video'],
    success: ['success', 'Xong'],
    warning: ['error', 'Cảnh báo'],
    error: ['error', 'Lỗi'],
    timeout: ['error', 'Timeout'],
  };
  const [cls, label] = map[state] || ['', state];
  if (cls) card.classList.add(cls);
  status.textContent = label;
}

function showPairError(idx, msg) {
  const card = $(`i2v-pair-${idx}`);
  const errEl = $(`i2v-perr-${idx}`);
  if (card) card.classList.add('error');
  if (errEl) errEl.textContent = '⚠ ' + msg;
  updatePairStatus(idx, 'error');
}

function showPairWarning(idx, msg) {
  const card = $(`i2v-pair-${idx}`);
  const errEl = $(`i2v-perr-${idx}`);
  if (card) card.classList.add('error');
  if (errEl) errEl.textContent = '⚠ ' + msg;
  updatePairStatus(idx, 'warning');
}

function clearPairError(idx) {
  const card = $(`i2v-pair-${idx}`);
  const errEl = $(`i2v-perr-${idx}`);
  if (card) card.classList.remove('error');
  if (errEl) errEl.textContent = '';
}

function i2vValidate() {
  if (i2vPairs.length === 0) {
    i2vGuardBanner.textContent = '⚠ Hãy nhập prompt và gán ảnh cho từng scene trước khi chạy.';
    i2vGuardBanner.classList.add('show'); return false;
  }
  const errors = [];
  i2vPairs.forEach((pair, idx) => {
    clearPairError(idx);
    if (!pair.imageFile && !pair.imageDataUrl) {
      showPairError(idx, `Prompt #${idx + 1} chưa có ảnh`);
      errors.push(idx + 1);
    }
  });
  if (errors.length > 0) {
    i2vGuardBanner.innerHTML =
      `⚠ <strong>${errors.length} prompt chưa có ảnh:</strong> #${errors.join(', #')}<br>Mỗi prompt phải có 1 ảnh.`;
    i2vGuardBanner.classList.add('show');
    const first = $(`i2v-pair-${errors[0] - 1}`);
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  i2vGuardBanner.classList.remove('show');
  return true;
}


// ── NAVIGATE VỀ IMAGINE VIDEO MODE ───────────────────────────────────────────
// Đảm bảo trang đang ở /imagine (không phải /saved hay /templates/...) và ở Video mode
async function ensureGrokComposerReady(tabId, options = {}) {
  const tabInfo = await chrome.tabs.get(tabId);
  let url = tabInfo.url || '';
  let state = getGrokPageState(url);
  let isComposerCapable = isImagineComposerCapableUrl(url);
  if (state === 'imagine-template' || !isComposerCapable) {
    if (options?.noNavigate) {
      return { ok: false, error: `Current URL is not the active Imagine composer: ${url}` };
    }
    console.log('[GPI] ensureGrokComposerReady navigating to Imagine root from:', url);
    const updated = await chrome.tabs.update(tabId, { url: 'https://grok.com/imagine' });
    console.log('[GPI] ensureGrokComposerReady URL after chrome.tabs.update:', updated?.url || '');
    const urlReady = await waitForImagineRootUrl(tabId, 10000);
    if (!urlReady.ok) return urlReady;
    url = urlReady.url;
    state = getGrokPageState(url);
    isComposerCapable = isImagineComposerCapableUrl(url);
  }

  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const isVisible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
        };
        const isTemplateOrModal = (el) => !!el?.closest?.(
          '[role="dialog"],[class*="modal" i],[class*="template" i],[class*="overlay" i]'
        );
        document.querySelectorAll('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="overlay" i]').forEach(root => {
          const close = Array.from(root.querySelectorAll('button,[role="button"]')).find(btn => {
            const txt = (btn.textContent || '').trim().toLowerCase();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            return isVisible(btn) && (aria.includes('close') || aria.includes('dismiss') || txt === '×' || txt === 'x');
          });
          if (close) close.click();
        });
        const inputSelectors = [
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
        ].join(',');
        const scope = Array.from(document.querySelectorAll(inputSelectors))
          .filter(el => isVisible(el) && !isTemplateOrModal(el))
          .map(input => {
            let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
            if (!root) {
              let node = input.parentElement;
              for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                if (node.querySelector('button,[role="button"],label')) { root = node; break; }
              }
            }
            if (!root || isTemplateOrModal(root)) return null;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
            return isBottom ? { input, root, inputRect, rootRect } : null;
          })
          .filter(Boolean)
          .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
        if (!scope) return { ok: false, error: 'Bottom composer not found' };
        const { input, root } = scope;
        if (!root || isTemplateOrModal(root)) return { ok: false, error: 'Composer root not found' };
        return { ok: true, inputTop: Math.round(input.getBoundingClientRect().top), rootBottom: Math.round(root.getBoundingClientRect().bottom) };
      },
    });
    const ready = result?.[0]?.result;
    if (ready?.ok) return { ...ready, url, state };
    await sleep(500);
  }
  if (isComposerCapable && !options?.noNavigate && !options?._retriedImagineRoot) {
    console.warn('[GPI] Bottom composer missing on Imagine page; navigating to root once:', url);
    const updated = await chrome.tabs.update(tabId, { url: 'https://grok.com/imagine' });
    console.log('[GPI] ensureGrokComposerReady URL after missing-composer update:', updated?.url || '');
    const urlReady = await waitForImagineRootUrl(tabId, 10000);
    if (!urlReady.ok) return urlReady;
    return ensureGrokComposerReady(tabId, { ...options, _retriedImagineRoot: true });
  }
  const missing = isComposerCapable
    ? 'Bottom composer not found on current Imagine page'
    : 'Composer input not found';
  return { ok: false, error: missing, url, state };
}

async function navigateToImagineVideo(tabId) {
  // Nếu URL không phải /imagine thuần, navigate về
  const tabInfo = await chrome.tabs.get(tabId);
  const url = tabInfo.url || '';
  const isImagineRoot = isImagineRootUrl(url);
  if (!isImagineRoot) {
    console.log('[GPI] navigateToImagineVideo navigating to Imagine root from:', url);
    const updated = await chrome.tabs.update(tabId, { url: 'https://grok.com/imagine' });
    console.log('[GPI] navigateToImagineVideo URL after chrome.tabs.update:', updated?.url || '');
    const urlReady = await waitForImagineRootUrl(tabId, 10000);
    if (!urlReady.ok) return urlReady;
    await new Promise(r => setTimeout(r, 1500)); // chờ React render
  }
  // Click chọn Video mode
  const readyBeforeMode = await ensureGrokComposerReady(tabId);
  if (!readyBeforeMode.ok) return readyBeforeMode;
  const modeResult = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const isVisible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      const isBlocked = (el) => !!el.closest('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="overlay" i]');
      const findBottomComposerScope = () => {
        const inputSelectors = [
          'textarea[placeholder*="Type to imagine" i]',
          'textarea[placeholder*="Imagine" i]',
          'textarea[placeholder*="Describe" i]',
          'textarea[placeholder*="Enter" i]',
          'div[contenteditable="true"][data-lexical-editor]',
          'div[contenteditable="true"]',
          'textarea',
        ].join(',');
        return Array.from(document.querySelectorAll(inputSelectors))
          .filter(input => isVisible(input) && !isBlocked(input))
          .map(input => {
            let root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
            if (!root) {
              let node = input.parentElement;
              for (let depth = 0; depth < 8 && node && node !== document.body; depth++, node = node.parentElement) {
                const text = (node.textContent || '').toLowerCase();
                if (node.querySelector('button,[role="button"],label') && /\b(agent|image|video|480p|720p|9:16|16:9|6s|10s)\b/i.test(text)) { root = node; break; }
              }
            }
            if (!root || isBlocked(root)) return null;
            const inputRect = input.getBoundingClientRect();
            const rootRect = root.getBoundingClientRect();
            const isBottom = inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75;
            return isBottom ? { input, root, inputRect, rootRect } : null;
          })
          .filter(Boolean)
          .sort((a, b) => (b.rootRect.bottom - a.rootRect.bottom) || (b.inputRect.top - a.inputRect.top))[0] || null;
      };
      const scope = findBottomComposerScope();
      if (!scope) return { ok: false, error: 'Bottom composer not found' };
      const videoKeywords = ['video', 'vid'];
      const imageKeywords = ['image', 'ảnh', 'photo', 'picture'];
      const btns = Array.from(scope.root.querySelectorAll('button,[role="tab"],[role="radio"],[role="button"],label'));
      for (const btn of btns) {
        if (isBlocked(btn)) continue;
        const txt = (btn.textContent || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        const combined = txt + ' ' + aria;
        const isVideo = videoKeywords.some(k => combined === k || combined.startsWith(k + ' ') || combined.endsWith(' ' + k));
        const isImage = imageKeywords.some(k => combined.includes(k));
        if (isVideo && !isImage) {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { btn.click(); return true; }
        }
      }
      return false;
    },
  });
  const readyAfterMode = await ensureGrokComposerReady(tabId);
  if (!readyAfterMode.ok) return readyAfterMode;
  return { ok: true, videoModeClicked: !!modeResult?.[0]?.result };
}

async function prepareImg2VidComposer(tabId) {
  const tabInfo = await chrome.tabs.get(tabId);
  const url = tabInfo.url || '';
  addLog(i2vLogEl, `[I2V prepare] current URL before Img2Vid: ${url}`, 'info');

  const navRes = await navigateToImagineVideo(tabId);
  if (!navRes.ok) {
    addLog(i2vLogEl, `[I2V prepare] composer prepare failed: ${navRes.error}`, 'err');
    return navRes;
  }

  const ready = await ensureGrokComposerReady(tabId, { noNavigate: true });
  if (!ready.ok) {
    addLog(i2vLogEl, `[I2V prepare] composer ready failed: ${ready.error}`, 'err');
    return ready;
  }

  const finalTab = await chrome.tabs.get(tabId);
  const finalUrl = finalTab.url || '';
  addLog(i2vLogEl, `[I2V prepare] final URL before scene loop: ${finalUrl}`, 'info');
  if (!isImagineComposerCapableUrl(finalUrl)) {
    const error = `Final URL is not an Imagine composer-capable page before Img2Vid loop: ${finalUrl}`;
    addLog(i2vLogEl, `[I2V prepare] ${error}`, 'err');
    return { ok: false, error, url: finalUrl };
  }

  addLog(i2vLogEl, '[I2V prepare] done; scene loop will not navigate/reload', 'ok');
  return { ok: true, videoModeClicked: navRes.videoModeClicked, url: finalUrl };
}

async function fallbackImg2VidComposerForNextScene(tabId, sceneId, displayName = 'cảnh hiện tại') {
  addLog(i2vLogEl, `[I2V fallback] ${displayName}: quay về https://grok.com/imagine để reset composer`, 'info');
  const updated = await chrome.tabs.update(tabId, { url: 'https://grok.com/imagine' });
  console.log('[I2V fallback] URL after chrome.tabs.update:', updated?.url || '');
  const readyUrl = await waitForImagineRootUrl(tabId, 15000);
  if (!readyUrl.ok) {
    console.warn('[I2V fallback] URL reset failed', { sceneId, error: readyUrl.error });
    addLog(i2vLogEl, `[I2V fallback] URL reset thất bại sau ${displayName}: ${sanitizeUserError(readyUrl.error, {})}`, 'err');
    return readyUrl;
  }
  await sleep(1200);
  const readyComposer = await ensureGrokComposerReady(tabId, { noNavigate: true });
  if (!readyComposer.ok) {
    console.warn('[I2V fallback] composer ready failed', { sceneId, error: readyComposer.error });
    addLog(i2vLogEl, `[I2V fallback] composer chưa sẵn sàng sau ${displayName}: ${sanitizeUserError(readyComposer.error, {})}`, 'err');
    return readyComposer;
  }
  addLog(i2vLogEl, `[I2V fallback] composer moi da san sang cho scene tiep theo`, 'ok');
  return { ok: true, url: readyUrl.url, composer: readyComposer };
}

// ─────────────────────────────────────────────────────────────────────────────
// IMG2VID — Main run loop
// ─────────────────────────────────────────────────────────────────────────────
async function runImg2Vid() {
  if (i2vIsRunning) {
    addLog(i2vLogEl, '[I2V run guard] Img2Vid đang chạy, không bắt đầu job mới.', 'warn');
    return;
  }
  if (!i2vIsRunning) {
    i2vRenderPairs();
    ensureI2VSceneIds();
  }
  ensureI2VSceneIds();
  if (!i2vValidate()) return;

  let tab = await checkFilmTab();
  if (!tab) { alert('Hay mo grok.com -> Imagine!'); return; }
  await clearFilmEarlySubmitShield(tab.id);

  const doDL = i2vAutoDL.checked;
  const doWaitUI = i2vWaitGen.checked;
  const tmOut = (parseInt(timeoutInput.value) || 300) * 1000;
  const delay = Math.max(500, parseInt(delayInput.value) || 2000);

  i2vIsRunning = true; i2vStopReq = false;
  i2vRunBtn.disabled = true; i2vStopBtn.disabled = false;
  i2vLogEl.innerHTML = '';
  i2vProgressWrap.classList.add('show');
  setProgress(i2vProgBar, i2vProgLabel, 0, i2vPairs.length, `Img2Vid: scene 0/${i2vPairs.length} | xong 0 | lỗi 0`);
  i2vSetStep(3);
  if (!doWaitUI) addLog(i2vLogEl, 'Info: Img2Vid always waits for generation before the next pair.', 'warn');

  submittedI2VSceneIds.clear();
  currentI2VSubmittingSceneId = null;
  i2vSceneRuntime = {};
  const i2vRuntimeState = { videoRatioValidated: false };
  const i2vRunId = createRunId('i2v-job');
  const usedI2VSceneIds = new Set();

  const normalizedStart = await normalizeFilmStartTab(tab);
  if (!normalizedStart.ok) {
    const errEntry = {
      sceneId: 'i2v-prepare',
      index: 0,
      step: 'Prepare composer',
      code: 'composer_not_found',
      message: normalizedStart.error || 'Không chuẩn bị được tab Grok.',
    };
    logSceneError(i2vLogEl, {
      feature: 'Img2Vid',
      sceneId: errEntry.sceneId,
      step: errEntry.step,
      code: errEntry.code,
      message: errEntry.message,
      detail: errEntry.message,
      willContinue: false,
      raw: normalizedStart,
    });
    addLog(i2vLogEl, `[I2V prepare] cannot normalize start tab: ${normalizedStart.error}`, 'err');
    logRunSummary(i2vLogEl, { feature: 'Img2Vid', total: i2vPairs.length, done: 0, failed: 1, stopped: true, errors: [errEntry], stopReason: errEntry.message });
    setStatus('Img2Vid: composer prepare failed', 'red');
    i2vIsRunning = false; i2vRunBtn.disabled = false; i2vStopBtn.disabled = true;
    return;
  }
  tab = normalizedStart.tab || tab;

  const prepareRes = await prepareImg2VidComposer(tab.id);
  if (!prepareRes.ok) {
    const errEntry = {
      sceneId: 'i2v-prepare',
      index: 0,
      step: 'Prepare composer',
      code: prepareRes.code || 'composer_not_found',
      message: prepareRes.error || 'Composer chưa sẵn sàng.',
    };
    logSceneError(i2vLogEl, {
      feature: 'Img2Vid',
      sceneId: errEntry.sceneId,
      step: errEntry.step,
      code: errEntry.code,
      message: errEntry.message,
      detail: errEntry.message,
      willContinue: false,
      raw: prepareRes,
    });
    logRunSummary(i2vLogEl, { feature: 'Img2Vid', total: i2vPairs.length, done: 0, failed: 1, stopped: true, errors: [errEntry], stopReason: errEntry.message });
    setStatus('Img2Vid: composer not ready', 'red');
    i2vIsRunning = false; i2vRunBtn.disabled = false; i2vStopBtn.disabled = true;
    return;
  }

  let done = 0;
  let failed = 0;
  let stopped = false;
  const runErrors = [];
  const recordI2VError = (i, sceneId, step, res, willContinue = true) => {
    const normalized = normalizeErrorResult(res, { step, code: res?.code || 'unknown_error' });
    const entry = {
      sceneId,
      index: i + 1,
      step,
      code: normalized.code,
      message: normalized.error,
      detail: normalized.detail,
    };
    runErrors.push(entry);
    logSceneError(i2vLogEl, {
      feature: 'Img2Vid',
      sceneId,
      index: i + 1,
      total: i2vPairs.length,
      step,
      code: entry.code,
      message: entry.message,
      detail: entry.detail,
      willContinue,
      raw: normalized.raw,
    });
  };
  for (let i = 0; i < i2vPairs.length; i++) {
    if (i2vStopReq) { stopped = true; addLog(i2vLogEl, `[I2V scene] stopped before index=${i + 1}`, 'warn'); break; }

    const pair = i2vPairs[i];
    const isLastI2VScene = i === i2vPairs.length - 1;
    const sceneDisplayName = getSceneDisplayName(i);
    // User-facing duplicate scene data repair log stays friendly: [Img2Vid] ${sceneDisplayName} phát hiện dữ liệu bị trùng...
    let sceneId = ensureUniqueSceneId(pair, i, 'img2vid', i2vRunId, usedI2VSceneIds, {
      logEl: i2vLogEl,
      feature: 'Img2Vid',
    });
    const short = pair.prompt.length > 45 ? pair.prompt.slice(0, 42) + '...' : pair.prompt;
    const pprog = $(`i2v-pprog-${i}`);
    setI2VSceneState(sceneId, 'preparing', { logEl: i2vLogEl, displayName: sceneDisplayName });

    setStatus(`Img2Vid: pair ${i + 1}/${i2vPairs.length}`, 'orange');
    addLog(i2vLogEl, `[I2V scene] ${sceneDisplayName}/${i2vPairs.length}; không điều hướng trong scene loop`);
    addLog(i2vLogEl, `[${i + 1}/${i2vPairs.length}] ${short}`);
    updatePairStatus(i, 'running');
    const pcard = $(`i2v-pair-${i}`);
    if (pcard) pcard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (pprog) pprog.style.width = '5%';

    const cleanScene = await prepareCleanImg2VidSceneComposer(tab.id, sceneDisplayName);
    if (!cleanScene.ok) {
      setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: cleanScene.error || cleanScene.code });
      recordI2VError(i, sceneId, 'Chuẩn bị composer sạch', { ...cleanScene, code: cleanScene.code || 'composer_not_clean' }, true);
      showPairError(i, cleanScene.error || 'Composer chưa sạch trước khi chạy scene.');
      failed++; continue;
    }

    const composerReady = await ensureGrokComposerReady(tab.id, { noNavigate: true });
    if (!composerReady.ok) {
      setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: composerReady.error || 'composer_not_found' });
      recordI2VError(i, sceneId, 'Prepare composer', { ...composerReady, code: 'composer_not_found' }, true);
      addLog(i2vLogEl, `[I2V scene] composer chưa sẵn sàng ở ${sceneDisplayName}: ${sanitizeUserError(composerReady.error, { index: i })}`, 'err');
      showPairError(i, composerReady.error);
      failed++; continue;
    }
    if (submittedI2VSceneIds.has(sceneId)) {
      setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: 'duplicate_submit_blocked' });
      addLog(i2vLogEl, `[I2V submit lock] ${sceneDisplayName} đã submit trước đó, chặn click lặp để tránh tạo nhiều video và hao token.`, 'warn');
      recordI2VError(i, sceneId, 'Atomic submit', {
        code: 'duplicate_submit_blocked',
        error: 'Scene này đã được submit một lần, không submit lại.',
      }, true);
      updatePairStatus(i, 'error');
      failed++; continue;
    }

    updatePairStatus(i, 'settings');
    if (pprog) pprog.style.width = '10%';
    setProgress(i2vProgBar, i2vProgLabel, done, i2vPairs.length, `Img2Vid: scene ${i + 1}/${i2vPairs.length} | xong ${done} | lỗi ${failed}`);
    const expectedI2VSettings = await getVideoGlobalSettings();
    addLog(i2vLogEl, `[I2V settings] loaded ratio=${expectedI2VSettings.ratio} resolution=${expectedI2VSettings.resolution} duration=${expectedI2VSettings.duration} source=${JSON.stringify(expectedI2VSettings.source || {})}`, 'info');
    addLog(i2vLogEl, `[I2V settings guard] ${sceneDisplayName}: kiểm tra video global settings...`, 'info');
    const includeRatio = i === 0 && !i2vRuntimeState.videoRatioValidated;
    if (!includeRatio) addLog(i2vLogEl, `[I2V ratio] ${sceneDisplayName} bỏ qua aspect ratio guard (scene 2+) vì đã xác nhận ở scene đầu tiên`, 'info');
    const settingsRes = await ensureImg2VidGlobalSettings(tab.id, {
      settings: expectedI2VSettings,
      includeMode: true,
      includeRatio,
      includeResolution: true,
      includeDuration: true,
    });
    if (!settingsRes.ok) {
      setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: settingsRes.error || settingsRes.failedSetting });
      recordI2VError(i, sceneId, 'Kiểm tra Global Settings', settingsRes, true);
      const expectedValue = settingsRes.settings?.[settingsRes.failedSetting] || 'unknown';
      addLog(i2vLogEl, `[I2V settings guard] FAIL setting=${settingsRes.failedSetting} expected=${expectedValue}`, 'err');
      showPairError(i, `Không áp dụng được global setting: ${settingsRes.failedSetting}`);
      if (pprog) pprog.style.width = '0%';
      failed++;
      updatePairStatus(i, 'error');
      continue;
    }
    if (includeRatio && settingsRes.results?.ratio?.ok) i2vRuntimeState.videoRatioValidated = true;
    addLog(i2vLogEl, `[I2V settings guard] PASS ratio=${settingsRes.settings?.ratio} resolution=${settingsRes.settings?.resolution} duration=${settingsRes.settings?.duration}`, 'ok');

    const outputCountRes = await ensureI2VSingleOutput(tab.id, { logEl: i2vLogEl, displayName: sceneDisplayName });
    addLog(i2vLogEl, `[I2V output count] ${sceneDisplayName} result method=${outputCountRes.method || 'unknown'} skipped=${outputCountRes.skipped ? 'yes' : 'no'}`, outputCountRes.ok ? 'info' : 'warn');

    let beforeAttachmentState = await getI2VComposerAttachmentState(tab.id);
    addLog(i2vLogEl, `[I2V attachment] ${sceneDisplayName} before upload count=${beforeAttachmentState.count || 0}`, (beforeAttachmentState.count || 0) === 0 ? 'info' : 'warn');
    if ((beforeAttachmentState.count || 0) > 0) {
      addLog(i2vLogEl, `[I2V attachment] ${sceneDisplayName} phát hiện attachment cũ count=${beforeAttachmentState.count}, cleanup trước khi upload.`, 'warn');
      const cleanAgain = await prepareCleanImg2VidSceneComposer(tab.id, sceneDisplayName);
      if (!cleanAgain.ok) {
        setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: cleanAgain.error || cleanAgain.code });
        recordI2VError(i, sceneId, 'Cleanup attachment cũ', { ...cleanAgain, code: cleanAgain.code || 'composer_not_clean' }, true);
        showPairError(i, cleanAgain.error || 'Không cleanup được attachment cũ.');
        failed++; continue;
      }
      beforeAttachmentState = await getI2VComposerAttachmentState(tab.id);
    }

    addLog(i2vLogEl, `[I2V upload] ${sceneDisplayName}: import ảnh của scene hiện tại.`);
    updatePairStatus(i, 'uploading');
    if (pprog) pprog.style.width = '25%';
    const uploadCurrentSceneImage = async () => injectImageToPage(
      tab.id,
      pair.imageDataUrl,
      pair.imageFile?.type || 'image/jpeg',
      pair.imageFile?.name || `${sceneId}.jpg`,
      { preferComposer: true, sceneId, replaceExisting: true }
    );
    try {
      const imgRes = await injectImageToPage(
        tab.id,
        pair.imageDataUrl,
        pair.imageFile?.type || 'image/jpeg',
        pair.imageFile?.name || `${sceneId}.jpg`,
        { preferComposer: true, sceneId, replaceExisting: true }
      );
      if (!imgRes.ok) {
        setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: imgRes.error || imgRes.code });
        recordI2VError(i, sceneId, 'Upload ảnh tham chiếu', { ...imgRes, code: imgRes.code || 'upload_failed' }, true);
        addLog(i2vLogEl, `[I2V upload] import ảnh thất bại ở ${sceneDisplayName}: ${sanitizeUserError(imgRes.error, { index: i })}`, 'err');
        showPairError(i, imgRes.error); if (pprog) pprog.style.width = '0%'; failed++; continue;
      }
      addLog(i2vLogEl, `[I2V upload] đã import ảnh cho ${sceneDisplayName}`, 'ok');
    } catch (e) {
      setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: e?.message || String(e) });
      recordI2VError(i, sceneId, 'Upload ảnh tham chiếu', { code: 'exception', error: e?.message || String(e), detail: e?.stack?.slice(0, 500), raw: e }, true);
      addLog(i2vLogEl, `[I2V upload] lỗi import ảnh ở ${sceneDisplayName}: ${sanitizeUserError(e.message, { index: i })}`, 'err');
      showPairError(i, e.message); if (pprog) pprog.style.width = '0%'; failed++; continue;
    }

    addLog(i2vLogEl, `[I2V upload] chờ ảnh attach ổn định cho ${sceneDisplayName}`);
    const stableRes = await waitComposerAttachmentStable(tab.id, 8000, 800, {
      scope: 'bottomComposer',
      minImages: 1,
      sceneId,
    });
    addLog(i2vLogEl, `[I2V upload] ${sceneDisplayName} stable ${stableRes.ok ? 'ok' : 'warn'} imageCount=${stableRes.imageCount ?? 0}${(stableRes.imageCount ?? 0) > 1 ? ', tiếp tục vì Grok có thể render 1 ảnh thành nhiều node' : ''}`, stableRes.ok ? 'ok' : 'warn');
    if (!stableRes.ok) {
      setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: stableRes.error || 'image_missing' });
      recordI2VError(i, sceneId, 'Wait attachment stable', { ...stableRes, code: stableRes.code || 'image_missing', error: stableRes.error || 'Không tìm thấy ảnh trong composer sau khi upload.' }, true);
      addLog(i2vLogEl, `[I2V upload] FAIL: ảnh chưa ổn định ở ${sceneDisplayName} imageCount=${stableRes.imageCount ?? 0}`, 'err');
      showPairError(i, stableRes.error || 'Composer image upload not stable');
      if (pprog) pprog.style.width = '0%';
      failed++; continue;
    }
    setI2VSceneState(sceneId, 'image_attached', { logEl: i2vLogEl, displayName: sceneDisplayName });
    let afterAttachmentState = await getI2VComposerAttachmentState(tab.id);
    addLog(i2vLogEl, `[I2V attachment] ${sceneDisplayName} before=${beforeAttachmentState.count || 0} after=${afterAttachmentState.count || 0} unique=${afterAttachmentState.uniqueImageUrls || 0} rawNodes=${afterAttachmentState.rawImageNodes || 0}`, afterAttachmentState.count > 1 ? 'warn' : 'info');
    if ((afterAttachmentState.count || 0) > 1) {
      addLog(i2vLogEl, `[I2V attachment] phát hiện nhiều attachment thật count=${afterAttachmentState.count}, cleanup để tránh Grok nhận nhiều ảnh.`, 'warn');
      const cleanAgain = await prepareCleanImg2VidSceneComposer(tab.id, sceneDisplayName);
      if (!cleanAgain.ok) {
        setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: cleanAgain.error || cleanAgain.code });
        recordI2VError(i, sceneId, 'Cleanup nhiều attachment', { ...cleanAgain, code: cleanAgain.code || 'composer_not_clean' }, true);
        showPairError(i, cleanAgain.error || 'Không cleanup được nhiều attachment.');
        failed++; continue;
      }
      const reuploadRes = await uploadCurrentSceneImage();
      if (!reuploadRes.ok) {
        setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: reuploadRes.error || reuploadRes.code });
        recordI2VError(i, sceneId, 'Upload lại ảnh sau cleanup', { ...reuploadRes, code: reuploadRes.code || 'upload_failed' }, true);
        showPairError(i, reuploadRes.error || 'Upload lại ảnh thất bại.');
        failed++; continue;
      }
      const reStable = await waitComposerAttachmentStable(tab.id, 8000, 800, { scope: 'bottomComposer', minImages: 1, sceneId });
      afterAttachmentState = await getI2VComposerAttachmentState(tab.id);
      addLog(i2vLogEl, `[I2V attachment] ${sceneDisplayName} sau cleanup/reupload count=${afterAttachmentState.count || 0} rawNodes=${afterAttachmentState.rawImageNodes || 0}`, reStable.ok && afterAttachmentState.count <= 1 ? 'ok' : 'warn');
      if (!reStable.ok || (afterAttachmentState.count || 0) > 1) {
        setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: 'image_too_many' });
        recordI2VError(i, sceneId, 'Attachment guard', { code: 'image_too_many', error: 'Composer vẫn có nhiều attachment thật sau cleanup.' }, true);
        showPairError(i, 'Composer vẫn có nhiều attachment thật sau cleanup.');
        failed++; continue;
      }
    }
    if (pprog) pprog.style.width = '35%';

    const knownVideoUrls = await snapshotVideoUrls(tab.id);
    updatePairStatus(i, 'prompting');
    if (pprog) pprog.style.width = '40%';
    addLog(i2vLogEl, `[I2V prompt] gán text cho ${sceneDisplayName}`);
    try {
      const txtRes = await injectTextPrompt(tab.id, pair.prompt, false);
      if (!txtRes.ok) {
        setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: txtRes.error || txtRes.code });
        recordI2VError(i, sceneId, 'Inject prompt text', { ...txtRes, code: txtRes.code || 'text_missing' }, true);
        addLog(i2vLogEl, `[I2V prompt] gán text thất bại ở ${sceneDisplayName}: ${sanitizeUserError(txtRes.error, { index: i })}`, 'err');
        showPairError(i, txtRes.error); if (pprog) pprog.style.width = '0%'; failed++; continue;
      }
      addLog(i2vLogEl, `[I2V prompt] đã gán text cho ${sceneDisplayName}`, 'ok');
      if (pprog) pprog.style.width = '45%';
    } catch (e) {
      setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: e?.message || String(e) });
      recordI2VError(i, sceneId, 'Inject prompt text', { code: 'exception', error: e?.message || String(e), detail: e?.stack?.slice(0, 500), raw: e }, true);
      addLog(i2vLogEl, `[I2V prompt] lỗi gán text ở ${sceneDisplayName}: ${sanitizeUserError(e.message, { index: i })}`, 'err');
      showPairError(i, e.message); if (pprog) pprog.style.width = '0%'; failed++; continue;
    }

    const minTextChars = Math.min(80, Math.max(20, Math.floor(pair.prompt.length * 0.15)));
    let promptCommit = await waitImg2VidPromptCommitStable(tab.id, pair.prompt, {
      sceneId,
      displayName: sceneDisplayName,
      minTextChars,
      stableMs: 800,
      timeoutMs: 5000,
    });
    if (!promptCommit.ok) {
      addLog(i2vLogEl, `[I2V prompt] Re-inject prompt cho ${sceneDisplayName} vì editor bị rỗng trước submit.`, 'warn');
      const retryText = await injectTextPrompt(tab.id, pair.prompt, false);
      if (retryText.ok) {
        promptCommit = await waitImg2VidPromptCommitStable(tab.id, pair.prompt, {
          sceneId,
          displayName: sceneDisplayName,
          minTextChars,
          stableMs: 800,
          timeoutMs: 5000,
        });
      }
    }
    if (!promptCommit.ok) {
      setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: promptCommit.error || promptCommit.code });
      recordI2VError(i, sceneId, 'Prompt commit stable', { ...promptCommit, code: promptCommit.code || 'text_missing_before_submit', error: promptCommit.error || 'Prompt chưa nằm trong editor thật trước submit.' }, true);
      addLog(i2vLogEl, `[I2V guard] ${sceneDisplayName}: Chặn submit vì prompt không nằm trong editor thật.`, 'err');
      showPairError(i, promptCommit.error || 'Prompt chưa nằm trong editor thật trước submit.');
      if (pprog) pprog.style.width = '0%';
      failed++; continue;
    }

    const guardOptions = {
      scope: 'bottomComposer',
      requireText: true,
      requireImage: true,
      minImages: 1,
      minTextChars,
      timeoutMs: 15000,
      stableMs: 800,
      expectedSceneId: sceneId,
    };
    let payloadGuard = null;
    let guardTextRetryCount = 0;
    updatePairStatus(i, 'guarding');
    if (pprog) pprog.style.width = '50%';
    for (let guardAttempt = 1; guardAttempt <= 3; guardAttempt++) {
      payloadGuard = await verifyComposerPayload(tab.id, pair.prompt, guardOptions);
      addLog(
        i2vLogEl,
        `[I2V guard] ${sceneDisplayName} attempt=${guardAttempt} pass=${payloadGuard.ok ? 'yes' : 'no'} textLen=${payloadGuard.composerTextLength ?? 0} imageCount=${payloadGuard.imageCount ?? 0} code=${sanitizeUserError(payloadGuard.code || 'none', { index: i })}`,
        payloadGuard.ok ? 'ok' : 'warn'
      );
      addLog(i2vLogEl, `[I2V guard debug] ${sceneDisplayName} editorFound=${payloadGuard.editorFound ? 'yes' : 'no'} editorTextLen=${payloadGuard.editorTextLength ?? payloadGuard.editorTextLen ?? 0} rootTextLen=${payloadGuard.rootTextLength ?? payloadGuard.rootTextLen ?? 0}`, payloadGuard.ok ? 'info' : 'warn');
      if (payloadGuard.editorTextPreview || payloadGuard.rootTextPreview) {
        addLog(i2vLogEl, `[I2V guard debug] editorTextPreview="${payloadGuard.editorTextPreview || ''}" rootTextPreview="${payloadGuard.rootTextPreview || ''}"`, 'info');
      }
      if (!payloadGuard.ok && (payloadGuard.rootTextLength ?? 0) > 0 && (payloadGuard.editorTextLength ?? payloadGuard.editorTextLen ?? 0) === 0) {
        addLog(i2vLogEl, `[I2V guard] ${sceneDisplayName}: root có text nhưng editor thật đang trống, không submit`, 'warn');
      }
      if (payloadGuard.ok) break;
      if (payloadGuard.code === 'text_missing' && guardTextRetryCount < 2) {
        guardTextRetryCount++;
        addLog(i2vLogEl, `[I2V guard] ${sceneDisplayName}: thiếu prompt text trước submit, thử gán lại lần ${guardTextRetryCount}`, 'warn');
        const retryText = await injectTextPrompt(tab.id, pair.prompt, false);
        if (!retryText.ok) {
          addLog(i2vLogEl, `[I2V guard] gán lại text thất bại ở ${sceneDisplayName}: ${sanitizeUserError(retryText.error, { index: i })}`, 'err');
          break;
        }
        const commitRetry = await waitImg2VidPromptCommitStable(tab.id, pair.prompt, {
          sceneId,
          displayName: sceneDisplayName,
          minTextChars,
          stableMs: 800,
          timeoutMs: 5000,
        });
        if (!commitRetry.ok) {
          addLog(i2vLogEl, `[I2V guard] ${sceneDisplayName}: prompt vẫn chưa commit ổn định sau khi gán lại`, 'err');
          break;
        }
        continue;
      }
      if (payloadGuard.code === 'image_missing') {
        addLog(i2vLogEl, `[I2V guard] ${sceneDisplayName}: thiếu ảnh tham chiếu trước submit`, 'err');
      }
      break;
    }
    if (!payloadGuard?.ok) {
      setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: payloadGuard?.error || payloadGuard?.code });
      recordI2VError(i, sceneId, 'Payload guard', { ...payloadGuard, code: payloadGuard?.code || 'payload_guard_failed', error: payloadGuard?.error || 'Payload chưa đủ trước khi submit.' }, true);
      showPairError(i, `Payload chưa đủ: ${payloadGuard?.error || payloadGuard?.code || 'unknown'}`);
      if (pprog) pprog.style.width = '0%';
      failed++; continue;
    }
    setI2VSceneState(sceneId, 'prompt_ready', { logEl: i2vLogEl, displayName: sceneDisplayName });

    await sleep(500);
    let preSubmitPayloadGuard = null;
    for (let preSubmitAttempt = 1; preSubmitAttempt <= 3; preSubmitAttempt++) {
      preSubmitPayloadGuard = await verifyComposerPayload(tab.id, pair.prompt, {
        ...guardOptions,
        timeoutMs: 3000,
        stableMs: 500,
      });
      addLog(i2vLogEl, `[I2V guard] pre-submit recheck ${sceneDisplayName} attempt=${preSubmitAttempt} pass=${preSubmitPayloadGuard.ok ? 'yes' : 'no'} editorTextLen=${preSubmitPayloadGuard.editorTextLength ?? preSubmitPayloadGuard.editorTextLen ?? preSubmitPayloadGuard.composerTextLength ?? 0} rootTextLen=${preSubmitPayloadGuard.rootTextLength ?? preSubmitPayloadGuard.rootTextLen ?? 0} imageCount=${preSubmitPayloadGuard.imageCount ?? 0} code=${sanitizeUserError(preSubmitPayloadGuard.code || 'none', { index: i })}`, preSubmitPayloadGuard.ok ? 'ok' : 'warn');
      if (preSubmitPayloadGuard.ok) break;
      if (preSubmitPayloadGuard.code === 'text_missing' && preSubmitAttempt < 3) {
        addLog(i2vLogEl, `[I2V guard] text biến mất trước submit ở ${sceneDisplayName}; thử gán lại lần ${preSubmitAttempt}`, 'warn');
        const retryText = await injectTextPrompt(tab.id, pair.prompt, false);
        if (!retryText.ok) {
          addLog(i2vLogEl, `[I2V guard] pre-submit retry text thất bại ở ${sceneDisplayName}: ${sanitizeUserError(retryText.error, { index: i })}`, 'err');
          break;
        }
        const commitRetry = await waitImg2VidPromptCommitStable(tab.id, pair.prompt, {
          sceneId,
          displayName: sceneDisplayName,
          minTextChars,
          stableMs: 800,
          timeoutMs: 5000,
        });
        if (!commitRetry.ok) {
          addLog(i2vLogEl, `[I2V guard] pre-submit prompt vẫn chưa commit ổn định ở ${sceneDisplayName}`, 'err');
          break;
        }
        continue;
      }
      break;
    }
    if (!preSubmitPayloadGuard?.ok) {
      setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: preSubmitPayloadGuard?.error || preSubmitPayloadGuard?.code });
      recordI2VError(i, sceneId, 'Payload guard trước submit', { ...preSubmitPayloadGuard, code: preSubmitPayloadGuard?.code || 'payload_guard_failed', error: preSubmitPayloadGuard?.error || 'Payload biến mất trước khi submit.' }, true);
      showPairError(i, `Payload blinked before submit: ${preSubmitPayloadGuard?.error || preSubmitPayloadGuard?.code || 'unknown'}`);
      if (pprog) pprog.style.width = '0%';
      failed++; continue;
    }

    addLog(i2vLogEl, `[I2V submit lock] ${sceneDisplayName} lock=${currentI2VSubmittingSceneId ? 'busy' : 'none'} submitted=${submittedI2VSceneIds.has(sceneId) ? 'yes' : 'no'}`);
    if (currentI2VSubmittingSceneId && currentI2VSubmittingSceneId !== sceneId) {
      recordI2VError(i, sceneId, 'Atomic submit', { code: 'submit_lock_busy', error: `Submit lock busy: ${currentI2VSubmittingSceneId}` }, false);
      addLog(i2vLogEl, `[I2V submit lock] ${sceneDisplayName} đã có job đang generate, không submit thêm`, 'err');
      showPairError(i, sanitizeUserError(`Submit lock busy: ${currentI2VSubmittingSceneId}`, { index: i }));
      failed++; break;
    }
    if (currentI2VSubmittingSceneId === sceneId || submittedI2VSceneIds.has(sceneId)) {
      recordI2VError(i, sceneId, 'Atomic submit', { code: 'duplicate_submit_blocked', error: 'Scene này đã được submit một lần, không submit lại.' }, true);
      addLog(i2vLogEl, `[I2V submit lock] ${sceneDisplayName} đã submit, chặn click lặp`, 'warn');
      showPairError(i, 'Duplicate submit blocked');
      failed++; continue;
    }

    updatePairStatus(i, 'submitting');
    if (pprog) pprog.style.width = '60%';
    const monitorInstall = await installI2VSubmitMonitor(tab.id, sceneId, sceneDisplayName);
    addLog(i2vLogEl, `[I2V monitor] ${sceneDisplayName} installed=${monitorInstall.ok ? 'yes' : 'no'} generatingCardsBefore=${monitorInstall.generatingCardCountBefore || 0}`, monitorInstall.ok ? 'info' : 'warn');
    const btnReady = await waitForSubmitButtonEnabled(tab.id, 8000, 600, { scope: 'bottomComposer' });
    addLog(i2vLogEl, `[I2V submit] button ready ${sceneDisplayName} ok=${btnReady.ok ? 'yes' : 'no'}`, btnReady.ok ? 'info' : 'warn');

    let submitRes = { ok: false, error: 'Submit not attempted' };
    try {
      submitRes = await submitImg2VidAtomically(tab.id, {
        sceneId,
        displayName: sceneDisplayName,
        expectedText: pair.prompt,
        requireImage: true,
        minImages: 1,
        minTextChars,
        maxTextRetry: 2,
        scope: 'bottomComposer',
      });
      if (!submitRes.ok) {
        await clearI2VSubmitMonitor(tab.id);
        setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: submitRes.error || submitRes.code });
        recordI2VError(i, sceneId, 'Atomic submit', { ...submitRes, code: submitRes.code || 'submit_failed' }, true);
        addLog(i2vLogEl, `[I2V submit] submit thất bại ở ${sceneDisplayName}: ${sanitizeUserError(submitRes.error || submitRes.code || 'unknown', { index: i })}`, 'err');
        showPairError(i, submitRes.error || submitRes.code || 'Submit failed'); if (pprog) pprog.style.width = '0%'; failed++; continue;
      }
      setI2VSceneState(sceneId, 'submit_accepted', { logEl: i2vLogEl, displayName: sceneDisplayName });
      addLog(i2vLogEl, `[I2V submit] đã submit một lần cho ${sceneDisplayName}`, 'ok');
      if (pprog) pprog.style.width = '65%';
      await sleep(1600);
      const monitorState = await getI2VSubmitMonitorState(tab.id);
      addLog(i2vLogEl, `[I2V monitor] ${sceneDisplayName} submitClick=${monitorState.submitClickCount || 0} formSubmit=${monitorState.formSubmitCount || 0} enterSubmit=${monitorState.enterSubmitCount || 0} generatingCardsAfter=${monitorState.generatingCardCountAfter || 0}`, 'info');
      if ((monitorState.duplicateBlockedCount || 0) > 0) {
        addLog(i2vLogEl, `[I2V page lock] ${sceneDisplayName} chặn duplicate submit event.`, 'warn');
      }
      const realSubmitCount = (monitorState.submitClickCount || 0) + (monitorState.enterSubmitCount || 0);
      if (realSubmitCount > 1 || (monitorState.formSubmitCount || 0) > 1) {
        addLog(i2vLogEl, `❌ [Img2Vid] ${sceneDisplayName} phát hiện nhiều submit event thật, đã chặn các event lặp nếu có.`, 'err');
      }
      if ((monitorState.generatingCardCountAfter || 0) > 1 && realSubmitCount <= 1) {
        addLog(i2vLogEl, `⚠ [Img2Vid] ${sceneDisplayName} chỉ submit 1 lần nhưng Grok tạo ${monitorState.generatingCardCountAfter} job. Có thể composer còn context cũ hoặc output count không phải 1.`, 'warn');
      }
    } catch (e) {
      if (currentI2VSubmittingSceneId === sceneId) currentI2VSubmittingSceneId = null;
      submittedI2VSceneIds.delete(sceneId);
      await clearI2VSubmitMonitor(tab.id);
      recordI2VError(i, sceneId, 'Atomic submit', { code: 'exception', error: e?.message || String(e), detail: e?.stack?.slice(0, 500), raw: e }, true);
      addLog(i2vLogEl, `[I2V submit] lỗi submit ở ${sceneDisplayName}: ${sanitizeUserError(e.message, { index: i })}`, 'err');
      showPairError(i, e.message); if (pprog) pprog.style.width = '0%'; failed++; continue;
    }

    updatePairStatus(i, 'generating');
    setI2VSceneState(sceneId, 'generating', { logEl: i2vLogEl, displayName: sceneDisplayName });
    if (pprog) pprog.style.width = '75%';
    setStatus(`Img2Vid: waiting scene ${i + 1}`, 'orange');
    addLog(i2vLogEl, `[I2V generate] ${sceneDisplayName} waitGenerateWithSignals start.`);
    await sleep(800);
    const gen = await waitForGrokGenerationDone(tab.id, {
      sceneId: sceneDisplayName,
      mediaType: 'video',
      knownState: { videoUrls: knownVideoUrls },
      timeoutMs: tmOut,
      shouldStop: () => i2vStopReq,
      progressCallback: (pct) => { if (pprog) pprog.style.width = pct + '%'; },
      logPrefix: '[I2V generate]',
      logEl: i2vLogEl,
      stablePolls: 2,
    });
    if (currentI2VSubmittingSceneId === sceneId) {
      currentI2VSubmittingSceneId = null;
      addLog(i2vLogEl, `[I2V submit lock] ${sceneDisplayName} clear lock sau khi wait generate kết thúc`, 'info');
    }
    const finalMonitorState = await getI2VSubmitMonitorState(tab.id);
    if ((finalMonitorState.generatingCardCountAfter || 0) > 1) {
      addLog(i2vLogEl, `⚠ [Img2Vid] ${sceneDisplayName} phát hiện ${finalMonitorState.generatingCardCountAfter} job generate sau 1 submit. Extension sẽ không submit thêm và chỉ tải 1 video.`, 'warn');
    }
    await clearI2VSubmitMonitor(tab.id);
    if (gen.ok && gen.reason !== 'new-video' && gen.reason !== 'media-stable') {
      addLog(i2vLogEl, `[I2V generate] xác nhận video URL cho ${sceneDisplayName} reason=${gen.reason}`, 'info');
      const cfStart = Date.now();
      while (Date.now() - cfStart < 8000) {
        await sleep(800);
        const cfUrls = await snapshotVideoUrls(tab.id);
        if ([...cfUrls].some(u => !knownVideoUrls.has(u))) {
          addLog(i2vLogEl, `[I2V generate] video URL confirmed cho ${sceneDisplayName}`, 'ok');
          break;
        }
      }
    }

    if (!gen.ok) {
      if (gen.reason === 'stopped') {
        stopped = true;
        setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: 'user_stopped' });
        updatePairStatus(i, 'waiting');
        if (pprog) pprog.style.width = '0%';
        break;
      }
      addLog(i2vLogEl, `[I2V generate] generate thất bại ở ${sceneDisplayName} reason=${gen.reason}`, gen.reason === 'timeout' ? 'warn' : 'err');
      setI2VSceneState(sceneId, 'failed', { logEl: i2vLogEl, displayName: sceneDisplayName, error: gen.reason || 'generate_failed' });
      recordI2VError(i, sceneId, 'Chờ Grok generate', { ...gen, code: gen.code || (gen.reason === 'timeout' ? 'generate_timeout' : 'generate_failed'), error: gen.error || gen.reason || 'Generate failed' }, true);
      updatePairStatus(i, gen.reason === 'timeout' ? 'timeout' : 'error');
      if (pprog) pprog.style.width = '0%';
      failed++; done++;
      setProgress(i2vProgBar, i2vProgLabel, done, i2vPairs.length, `Img2Vid: scene ${i + 1}/${i2vPairs.length} | xong ${done} | lỗi ${failed}`);
      if (i < i2vPairs.length - 1 && !i2vStopReq) { setStatus(`Wait ${delay}ms...`, 'orange'); await sleep(delay); }
      continue;
    }

    addLog(i2vLogEl, `[I2V generate] xong ${sceneDisplayName} reason=${gen.reason}`, 'ok');
    updatePairStatus(i, 'post_verifying');
    let sceneFinalizeOk = true;
    let sceneWarningOrErrorRecorded = false;
    if (isLastI2VScene) {
      const finalRes = await finalizeLastI2VScene(tab.id, pair, {
        sceneId,
        displayName: sceneDisplayName,
        expectedText: pair.prompt,
        expectedImage: pair.imageDataUrl,
        expectedSceneIndex: i,
        totalScenes: i2vPairs.length,
        logEl: i2vLogEl,
      });
      sceneFinalizeOk = finalRes.ok;
      if (!finalRes.ok) {
        if (finalRes.warning) {
          addLog(i2vLogEl, `[I2V finalize] ${sceneDisplayName} chỉ ghi cảnh báo hậu kiểm, không tính là lỗi generate.`, 'warn');
          showPairWarning(i, 'Hậu kiểm scene cuối cảnh báo: post prompt trống hoặc không khớp.');
        } else {
          recordI2VError(i, sceneId, 'Hậu kiểm scene cuối', {
            code: finalRes.code || 'final_scene_post_verify_failed',
            error: finalRes.error || 'Kết quả video đã tạo nhưng prompt ở post không khớp hoặc bị trống.',
            detail: finalRes.error,
            raw: finalRes,
          }, true);
          failed++;
          showPairWarning(i, 'Hậu kiểm scene cuối cảnh báo: post prompt trống hoặc không khớp.');
          sceneWarningOrErrorRecorded = true;
        }
      }
    } else {
      setI2VSceneState(sceneId, 'post_verifying', { logEl: i2vLogEl, displayName: sceneDisplayName });
      const postPrompt = await verifyGeneratedPostPrompt(tab.id, pair.prompt);
      addLog(i2vLogEl, `[I2V post verify] ${sceneDisplayName} postPromptLen=${postPrompt.postPromptLen || 0}`, postPrompt.postPromptLen > 0 ? 'info' : 'warn');
      addLog(i2vLogEl, `[I2V post verify] ${sceneDisplayName} promptMatch=${postPrompt.promptMatch ? 'yes' : 'no'}`, postPrompt.promptMatch ? 'info' : 'warn');
      if ((postPrompt.postPromptLen || 0) === 0) {
        addLog(i2vLogEl, `⚠ [Img2Vid] ${sceneDisplayName} generate xong nhưng post prompt trống.`, 'warn');
        addLog(i2vLogEl, 'Chi tiết: Grok có thể đã nhận ảnh nhưng không nhận prompt text.', 'warn');
      } else if (!postPrompt.promptMatch) {
        addLog(i2vLogEl, `⚠ [Img2Vid] ${sceneDisplayName} post prompt không khớp hoàn toàn prompt scene hiện tại.`, 'warn');
      }
      setI2VSceneState(sceneId, 'done', { logEl: i2vLogEl, displayName: sceneDisplayName, type: 'ok' });
    }
    if (pprog) pprog.style.width = '100%';

    if (doDL) {
      updatePairStatus(i, 'downloading');
      if (pprog) pprog.style.width = '90%';
      addLog(i2vLogEl, `[I2V download] tải video cho ${sceneDisplayName} trước khi qua cảnh tiếp theo`);
      const knownImgs = await snapshotImageUrls(tab.id);
      const sceneSlug = `i2v_scene${String(i + 1).padStart(2, '0')}_${slugify(pair.prompt)}`;
      const maxAttempts = await getMaxRetries();
      const dlRes = await downloadMediaWithFallback(tab.id, sceneSlug, knownVideoUrls, knownImgs, gen, {
        logEl: i2vLogEl,
        displayName: sceneDisplayName,
        maxAttempts,
        retryDelayMs: 15000,
        maxFiles: 1,
      });
      const files = dlRes.files || [];
      if (dlRes.ok && files.length > 0) {
        downloadHistory.push(...files.map(f => ({ ...f, prompt: sceneSlug })));
        renderDownloads();
        addLog(i2vLogEl, `[I2V download] đã tải video cho ${sceneDisplayName} bằng phương thức ${dlRes.method}`, 'ok');
        updatePairStatus(i, sceneFinalizeOk ? 'success' : 'warning');
      } else {
        recordI2VError(i, sceneId, 'Download media', { code: dlRes.code || 'download_failed', error: dlRes.error || 'Không tìm thấy video để tải sau khi thử tất cả fallback.' }, true);
        addLog(i2vLogEl, `[I2V download] không tìm thấy video để tải sau khi thử tất cả fallback cho ${sceneDisplayName}`, 'err');
        showPairError(i, 'Download failed after fallback attempts');
        if (!sceneWarningOrErrorRecorded) failed++;
        sceneWarningOrErrorRecorded = true;
      }
    } else {
      updatePairStatus(i, sceneFinalizeOk ? 'success' : 'warning');
    }

    if (i < i2vPairs.length - 1 && !i2vStopReq) {
      const fallbackRes = await fallbackImg2VidComposerForNextScene(tab.id, sceneId, sceneDisplayName);
      if (!fallbackRes.ok) {
        recordI2VError(i, sceneId, 'Fallback /imagine cho scene tiếp theo', { ...fallbackRes, code: fallbackRes.code || 'fallback_failed' }, false);
        addLog(i2vLogEl, `[I2V fallback] reset composer thất bại sau ${sceneDisplayName}: ${sanitizeUserError(fallbackRes.error, { index: i })}`, 'err');
        showPairError(i, fallbackRes.error || 'Fallback composer reset failed');
        failed++;
        break;
      }
    }

    done++;
    setProgress(i2vProgBar, i2vProgLabel, done, i2vPairs.length, `Img2Vid: scene ${i + 1}/${i2vPairs.length} | xong ${done} | lỗi ${failed}`);
    if (i < i2vPairs.length - 1 && !i2vStopReq) { setStatus(`Wait ${delay}ms...`, 'orange'); await sleep(delay); }
  }

  currentI2VSubmittingSceneId = null;
  i2vIsRunning = false;
  i2vRunBtn.disabled = false; i2vStopBtn.disabled = true;
  const allOk = done === i2vPairs.length && failed === 0;
  setStatus(allOk ? `Img2Vid done ${done} pairs` : `Img2Vid: ${done}/${i2vPairs.length}`, allOk ? 'green' : 'orange');
  addLog(i2vLogEl, `-- Đã xử lý: ${done}/${i2vPairs.length} | Thành công: ${Math.max(0, done - failed)} | Lỗi: ${failed} --`, allOk ? 'ok' : 'warn');
  logRunSummary(i2vLogEl, {
    feature: 'Img2Vid',
    total: i2vPairs.length,
    done,
    failed,
    stopped,
    errors: runErrors,
    stopReason: stopped ? 'Người dùng dừng hoặc Grok trả về stopped.' : '',
  });
}

// SHORT FILM PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

// ── SF DOM refs ───────────────────────────────────────────────────────────────
const sfWorldEl    = $('sf-world');
const sfStyleEl    = $('sf-style');
const sfAnchorPrev = $('sf-anchor-preview');
const sfBibleBody  = $('sf-bible-body');
const sfBibleArrow = $('sf-bible-arrow');
const sfCharListEl = $('sf-char-list');
const sfCharCountLabel = $('sf-char-count-label');
const sfSceneList  = $('sf-scene-list');
const sfCountLabel = $('sf-scene-count-label');
const sfGuardBanner= $('sf-guard-banner');
const sfRunBtn     = $('sf-run-btn');
const sfStopBtn    = $('sf-stop-btn');
const sfResetBtn   = $('sf-reset-btn');
const sfProgWrap   = $('sf-progress-wrap');
const sfProgBar    = $('sf-prog-bar');
const sfProgLabel  = $('sf-prog-label');
const sfLogEl      = $('sf-log');
const sfExportCard = $('sf-export-card');
const sfDownloadSummary  = $('sf-download-summary');
const sfExportList = $('sf-export-list');
const sfAutoDL     = $('sf-auto-download');
const sfChaining   = $('sf-chaining');
const sfWaitGen    = $('sf-wait-gen');
const sfDelayInput = $('sf-delay-input');
const sfTimeoutInput = $('sf-timeout-input');

// ── SF State ──────────────────────────────────────────────────────────────────
let sfIsRunning = false;
let sfStopReq   = false;
let sfScenes = [];
let sfSceneIdCounter = 0;

let sfCharacters = [];
let sfCharIdCounter = 0;
let sfMessageStates = new Map();

const SHOT_TYPES = [
  'Extreme Wide Shot (EWS)', 'Wide Shot (WS)', 'Medium Wide Shot (MWS)',
  'Medium Shot (MS)', 'Medium Close-Up (MCU)', 'Close-Up (CU)',
  'Extreme Close-Up (ECU)', 'Over-the-Shoulder (OTS)', 'POV Shot',
  'Two-Shot', 'Insert Shot',
];
const CAMERA_MOVES = [
  'Static', 'Pan left', 'Pan right', 'Tilt up', 'Tilt down',
  'Dolly in', 'Dolly out', 'Tracking shot', 'Handheld', 'Crane up',
];

// ── CAPTURE LAST FRAME ────────────────────────────────────────────────────────
async function captureLastFrame(tabId) {
  // Chờ một chút để video render xong trước khi capture
  await sleep(1500);
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => new Promise(resolve => {
      // Lấy tất cả video đủ lớn, ưu tiên video MỚI NHẤT (cuối page)
      const videos = Array.from(document.querySelectorAll('video')).filter(v => {
        const r = v.getBoundingClientRect();
        return r.width > 100 && r.height > 100;
      });

      if (videos.length === 0) {
        // Fallback: tìm img blob mới nhất
        const imgs = Array.from(document.querySelectorAll('img[src]')).filter(img => {
          const src = img.src || '';
          const r   = img.getBoundingClientRect();
          return (src.startsWith('blob:') || src.includes('media') || src.includes('grok'))
                 && r.width > 100 && r.height > 100;
        }).sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);

        if (imgs.length > 0) {
          const img = imgs[0];
          if (img.src.startsWith('blob:')) {
            fetch(img.src).then(r => r.blob()).then(blob => {
              const reader = new FileReader();
              reader.onload  = () => resolve({ ok: true, dataUrl: reader.result, source: 'image' });
              reader.onerror = () => resolve({ ok: false, error: 'Read failed' });
              reader.readAsDataURL(blob);
            }).catch(e => resolve({ ok: false, error: e.message }));
          } else {
            resolve({ ok: true, dataUrl: img.src, source: 'image' });
          }
        } else {
          resolve({ ok: false, error: 'Không tìm thấy media để capture' });
        }
        return;
      }

      // Lấy video cuối cùng (mới nhất)
      const v = videos[videos.length - 1];

      const doCapture = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width  = v.videoWidth  || v.clientWidth;
          canvas.height = v.videoHeight || v.clientHeight;
          if (canvas.width < 10 || canvas.height < 10) {
            resolve({ ok: false, error: 'Video dimensions không hợp lệ' });
            return;
          }
          const ctx = canvas.getContext('2d');
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
          // Kiểm tra không phải ảnh đen (corrupt)
          const imgData = ctx.getImageData(0, 0, Math.min(50, canvas.width), Math.min(50, canvas.height));
          const avg = imgData.data.reduce((s, v, i) => i % 4 !== 3 ? s + v : s, 0) / (imgData.data.length * 3/4);
          if (avg < 5) {
            resolve({ ok: false, error: 'Frame bị đen (video chưa render)' });
          } else {
            resolve({ ok: true, dataUrl, source: 'video' });
          }
        } catch (e) {
          resolve({ ok: false, error: `Canvas error: ${e.message}` });
        }
      };

      // Seek đến frame cuối (duration - 0.1s) để lấy frame cuối đúng
      if (v.readyState >= 2 && v.duration && isFinite(v.duration)) {
        const wasPaused = v.paused;
        v.pause();
        v.currentTime = Math.max(0, v.duration - 0.1);
        const onSeeked = () => {
          v.removeEventListener('seeked', onSeeked);
          setTimeout(doCapture, 200);
          if (!wasPaused) v.play().catch(() => {});
        };
        v.addEventListener('seeked', onSeeked);
        // Fallback nếu seeked không fire trong 3s
        setTimeout(() => { v.removeEventListener('seeked', onSeeked); doCapture(); }, 3000);
      } else {
        // Video chưa load đủ, capture ngay currentTime
        doCapture();
      }
    }),
  });
  return results?.[0]?.result || { ok: false, error: 'Capture script thất bại' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHARACTER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════
function sfUpdateCharCount() {
  sfCharCountLabel.textContent = `— ${sfCharacters.length} nhân vật`;
}

function sfAddCharacter(data = null) {
  const id = ++sfCharIdCounter;
  const isFirst = sfCharacters.length === 0;
  const ch = data || {
    id, name: '', description: '', role: isFirst ? 'main' : 'sub',
    imageDataUrl: null, imageFileName: null,
  };
  if (!data) ch.id = id;
  sfCharacters.push(ch);
  renderCharCard(ch, sfCharacters.length - 1);
  sfUpdateCharCount();
  updateAnchorPreview();
}

function sfDeleteCharacter(id) {
  const idx = sfCharacters.findIndex(c => c.id === id);
  if (idx < 0) return;
  sfCharacters.splice(idx, 1);
  if (sfCharacters.length > 0 && !sfCharacters.some(c => c.role === 'main')) {
    sfCharacters[0].role = 'main';
  }
  rebuildCharList();
  sfUpdateCharCount();
  updateAnchorPreview();
}

function rebuildCharList() {
  sfCharListEl.innerHTML = '';
  sfCharacters.forEach((ch, i) => renderCharCard(ch, i));
}

function renderCharCard(ch, idx) {
  const card = document.createElement('div');
  card.className = 'sf-char-card';
  card.id = `sf-ch-${ch.id}`;

  const isMain = ch.role === 'main';
  const roleCls = isMain ? 'main' : 'sub';
  const roleText = isMain ? 'Chính' : 'Phụ';
  const hasImg = !!ch.imageDataUrl;

  card.innerHTML = `
    <div class="sf-char-header">
      <span class="sf-char-role ${roleCls}" id="sf-chrole-${ch.id}">${roleText}</span>
      <input class="sf-char-name-input" id="sf-chname-${ch.id}"
             placeholder="Tên nhân vật (VD: Linh, Tuấn...)" value="${escapeHtml(ch.name)}">
      <button class="sf-char-del" id="sf-chdel-${ch.id}" title="Xóa nhân vật">✕</button>
    </div>
    <div class="sf-char-body">
      <div class="sf-char-img-zone ${hasImg ? 'has-image' : ''}" id="sf-chzone-${ch.id}">
        <input type="file" accept="image/*" id="sf-chfile-${ch.id}">
        <div class="sf-char-img-icon">📷</div>
        <div class="sf-char-img-label">Ảnh ref</div>
        <img class="sf-char-preview-img" id="sf-chimg-${ch.id}" src="${ch.imageDataUrl || ''}" alt="">
        <button class="sf-char-rm-img" id="sf-chrm-${ch.id}">✕</button>
      </div>
      <div class="sf-char-text">
        <textarea class="sf-char-desc" id="sf-chdesc-${ch.id}"
          placeholder="${isMain ? 'VD: Cô gái 20 tuổi, tóc đen dài, mắt nâu, áo dài trắng...' : 'VD: Chàng trai 25 tuổi, tóc ngắn, áo sơ mi xanh...'}"
        >${escapeHtml(ch.description)}</textarea>
      </div>
    </div>`;

  sfCharListEl.appendChild(card);

  $(`sf-chname-${ch.id}`).addEventListener('input', e => { ch.name = e.target.value; updateAnchorPreview(); });
  $(`sf-chdesc-${ch.id}`).addEventListener('input', e => { ch.description = e.target.value; updateAnchorPreview(); });
  $(`sf-chdel-${ch.id}`).addEventListener('click', () => sfDeleteCharacter(ch.id));

  $(`sf-chfile-${ch.id}`).addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      ch.imageDataUrl  = ev.target.result;
      ch.imageFileName = file.name;
      $(`sf-chimg-${ch.id}`).src = ev.target.result;
      $(`sf-chzone-${ch.id}`).classList.add('has-image');
      saveBible();
    };
    reader.readAsDataURL(file);
  });

  $(`sf-chrm-${ch.id}`).addEventListener('click', e => {
    e.stopPropagation();
    ch.imageDataUrl = null; ch.imageFileName = null;
    $(`sf-chimg-${ch.id}`).src = '';
    $(`sf-chzone-${ch.id}`).classList.remove('has-image');
    $(`sf-chfile-${ch.id}`).value = '';
    saveBible();
  });
}

// ── BIBLE ─────────────────────────────────────────────────────────────────────
function buildAnchorPrompt() {
  const world = sfWorldEl.value.trim();
  const style = sfStyleEl.value.trim();
  const parts = [];
  if (style) parts.push(`[VISUAL STYLE] ${style}`);

  sfCharacters.forEach(ch => {
    if (!ch.name && !ch.description) return;
    const tag = ch.role === 'main' ? 'MAIN CHARACTER' : 'SUPPORTING CHARACTER';
    const nameStr = ch.name ? ch.name : 'Unknown';
    const desc = ch.description ? `: ${ch.description}` : '';
    const hasRef = ch.imageDataUrl ? ' (reference image attached)' : '';
    parts.push(`[${tag}] ${nameStr}${desc}${hasRef}`);
  });

  if (world) parts.push(`[WORLD] ${world}`);
  parts.push('[CONSISTENCY] Same characters, same visual style, same color grading across all scenes. Cinematic short film.');
  return parts.join('\n');
}

function updateAnchorPreview() {
  const anchor = buildAnchorPrompt();
  sfAnchorPrev.textContent = anchor || '← Thêm nhân vật và điền các trường để xem preview';
  saveBible();
}

function saveBible() {
  const lightChars = sfCharacters.map(c => ({
    id: c.id, name: c.name, description: c.description, role: c.role,
    imageDataUrl: null, imageFileName: c.imageFileName,
  }));
  chrome.storage.local.set({
    sfCharacters: lightChars,
    sfCharIdCounter,
    sfWorld: sfWorldEl.value,
    sfStyle: sfStyleEl.value,
  });
}

[sfWorldEl, sfStyleEl].forEach(el => {
  if (el) el.addEventListener('input', updateAnchorPreview);
});

$('sf-add-char-btn').addEventListener('click', () => {
  if (sfCharacters.length >= 8) { alert('Tối đa 8 nhân vật!'); return; }
  sfAddCharacter();
});

$('sf-bible-toggle-btn').addEventListener('click', () => {
  const collapsed = sfBibleBody.classList.toggle('collapsed');
  sfBibleArrow.textContent = collapsed ? '▶ Mở rộng' : '▼ Thu gọn';
});

// ── SCENE MANAGEMENT ──────────────────────────────────────────────────────────
function sfUpdateSceneCount() {
  sfCountLabel.textContent = `— ${sfScenes.length} cảnh`;
  const sfQueueCount = $('sf-scene-queue-count');
  if (sfQueueCount) sfQueueCount.textContent = String(sfScenes.length);
}

function sfAddScene(data = null) {
  const id = ++sfSceneIdCounter;
  const scene = data || {
    id, title: '', shot: SHOT_TYPES[2], camera: CAMERA_MOVES[0],
    prompt: '', chainDataUrl: null, chainFileName: null, genFrameDataUrl: null, status: 'idle',
  };
  if (!data) scene.id = id;
  sfScenes.push(scene);
  renderSceneCard(scene, sfScenes.length - 1);
  sfUpdateSceneCount();
  saveScenes();
}

function sfDeleteScene(id) {
  const idx = sfScenes.findIndex(s => s.id === id);
  if (idx < 0) return;
  sfScenes.splice(idx, 1);
  rebuildSceneList();
  sfUpdateSceneCount();
  saveScenes();
}

function rebuildSceneList() {
  sfSceneList.innerHTML = '';
  sfScenes.forEach((scene, i) => renderSceneCard(scene, i));
}

function renderSceneCard(scene, idx) {
  const card = document.createElement('div');
  card.className = 'sf-scene-card';
  card.id = `sf-scene-${scene.id}`;
  if (scene.status === 'done')    card.classList.add('done');
  if (scene.status === 'error')   card.classList.add('error');
  if (scene.status === 'running') card.classList.add('running');

  const shotOpts = SHOT_TYPES.map(s => `<option ${s===scene.shot?'selected':''}>${s}</option>`).join('');
  const camOpts  = CAMERA_MOVES.map(s => `<option ${s===scene.camera?'selected':''}>${s}</option>`).join('');

  const chainThumb = scene.chainDataUrl
    ? `<img class="sf-chain-thumb" src="${scene.chainDataUrl}" alt="ref">`
    : `<div class="sf-chain-placeholder">🔗</div>`;
  const chainDesc = scene.chainDataUrl
    ? (scene.chainFileName || 'Reference frame')
    : (idx === 0 ? 'Không cần (cảnh đầu)' : 'Chưa có — sẽ tự lấy từ cảnh trước');

  const genFrameShow = scene.genFrameDataUrl ? 'show' : '';
  const genFrameSrc  = scene.genFrameDataUrl || '';
  const badgeText = scene.status === 'done' ? '✅ Xong' : scene.status === 'error' ? '✗ Lỗi' : scene.status === 'running' ? '⏳ Đang chạy' : 'Chờ';
  const sceneQueueItem = {
    ...scene,
    previewImage: scene.chainDataUrl || scene.genFrameDataUrl || '',
    prompt: scene.prompt || [scene.shot, scene.camera].filter(Boolean).join(' '),
  };
  const sceneTitle = getQueueItemTitle({ ...sceneQueueItem, title: scene.title || `Scene ${idx + 1}` }, idx);
  const scenePreview = getQueueItemPromptPreview(sceneQueueItem) || 'Chưa có mô tả cảnh';

  card.innerHTML = `
    <div class="sf-scene-header">
      <div class="sf-scene-num">${idx+1}</div>
      <div class="prompt-queue-main">
        <input class="sf-scene-title-input" id="sf-stitle-${scene.id}"
               placeholder="Cảnh ${idx+1} — Tên cảnh (tùy chọn)" value="${escapeHtml(scene.title || sceneTitle)}">
        <div class="queue-prompt-preview">${escapeHtml(scenePreview)}</div>
        <div class="prompt-queue-item-meta">sceneId=${escapeHtml(scene.id)}</div>
      </div>
      <span class="sf-scene-badge" id="sf-sbadge-${scene.id}">${badgeText}</span>
      <button class="sf-scene-del" id="sf-sdel-${scene.id}" title="Xóa cảnh">✕</button>
    </div>
    <div class="sf-scene-body">
      <div class="sf-scene-meta-row">
        <select class="sf-select" id="sf-sshot-${scene.id}">${shotOpts}</select>
        <select class="sf-select" id="sf-scam-${scene.id}">${camOpts}</select>
      </div>
      <div>
        <div class="sf-field-label" style="font-size:9.5px;margin-bottom:3px">
          SCENE PROMPT <span>— mô tả hành động cảnh này; anchor tự gắn</span>
        </div>
        <textarea class="sf-scene-prompt" id="sf-sprompt-${scene.id}"
          placeholder="VD: Linh đi chậm dọc đường, tay cầm bức thư, nhìn xuống với vẻ buồn bã."
          >${escapeHtml(scene.prompt)}</textarea>
      </div>
      <div class="sf-chain-row">
        ${chainThumb}
        <div class="sf-chain-info">
          <div class="sf-chain-label">🔗 Reference Frame (Chaining)</div>
          <div class="sf-chain-desc" id="sf-chaindesc-${scene.id}">${chainDesc}</div>
        </div>
        <label class="sf-chain-upload">
          📁 Upload
          <input type="file" accept="image/*" id="sf-chainfile-${scene.id}">
        </label>
      </div>
      <div class="sf-gen-frame ${genFrameShow}" id="sf-genframe-${scene.id}">
        <img src="${genFrameSrc}" alt="generated frame" id="sf-genimg-${scene.id}">
        <div class="sf-gen-frame-info">
          ✅ Frame cuối đã capture
          <span>Sẽ dùng làm reference cho cảnh sau</span>
        </div>
      </div>
      <div class="sf-scene-error" id="sf-serr-${scene.id}"></div>
    </div>`;

  sfSceneList.appendChild(card);

  $(`sf-stitle-${scene.id}`).addEventListener('input', e => { scene.title = e.target.value; saveScenes(); });
  $(`sf-sshot-${scene.id}`).addEventListener('change', e => { scene.shot = e.target.value; saveScenes(); });
  $(`sf-scam-${scene.id}`).addEventListener('change', e => { scene.camera = e.target.value; saveScenes(); });
  $(`sf-sprompt-${scene.id}`).addEventListener('input', e => { scene.prompt = e.target.value; saveScenes(); });
  $(`sf-sdel-${scene.id}`).addEventListener('click', () => sfDeleteScene(scene.id));
  $(`sf-chainfile-${scene.id}`).addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      scene.chainDataUrl  = ev.target.result;
      scene.chainFileName = file.name;
      const zone = $(`sf-scene-${scene.id}`)?.querySelector('.sf-chain-row');
      if (zone) {
        const placeholder = zone.querySelector('.sf-chain-placeholder');
        const existing    = zone.querySelector('.sf-chain-thumb');
        if (placeholder) {
          const img = document.createElement('img');
          img.className = 'sf-chain-thumb'; img.src = ev.target.result; img.alt = 'ref';
          zone.insertBefore(img, placeholder); placeholder.remove();
      } else if (existing) { existing.src = ev.target.result; }
      }
      $(`sf-chaindesc-${scene.id}`).textContent = file.name;
      saveScenes();
    };
    reader.readAsDataURL(file);
  });
}

function sfSetSceneStatus(sceneId, status) {
  const scene = sfScenes.find(s => s.id === sceneId);
  if (scene) scene.status = status;
  const card  = $(`sf-scene-${sceneId}`);
  const badge = $(`sf-sbadge-${sceneId}`);
  if (!card || !badge) return;
  card.classList.remove('running','done','error','chaining');
  const map = {
    idle:     ['', 'Chờ'],
    running:  ['running', '⏳ Đang chạy'],
    chaining: ['chaining', '🔗 Chaining...'],
    done:     ['done', '✅ Xong'],
    error:    ['error', '✗ Lỗi'],
    timeout:  ['error', '⏰ Timeout'],
  };
  const [cls, label] = map[status] || ['', status];
  if (cls) card.classList.add(cls);
  badge.textContent = label;
}

// ── SF PIPELINE (FIXED) ───────────────────────────────────────────────────────
async function runShortFilm() {
  if (sfIsRunning) return;

  // Guard
  const anchor = buildAnchorPrompt();
  const errors = [];
  sfScenes.forEach((scene, i) => {
    if (!scene.prompt.trim()) errors.push(`Cảnh ${i+1}: chưa có scene prompt`);
  });
  if (!sfScenes.length) errors.push('Chưa có cảnh nào — nhấn "Thêm cảnh mới"');
  if (!sfCharacters.length && !sfWorldEl.value.trim() && !sfStyleEl.value.trim())
    errors.push('Character Bible trống — thêm ít nhất 1 nhân vật hoặc bối cảnh');

  const charErrors = (window.ShortFilmLogic?.validateCharacterRefs || (() => []))(sfCharacters);
  errors.push(...charErrors);

  if (errors.length) {
    sfGuardBanner.textContent = '';
    const title = document.createElement('div');
    title.textContent = '⚠ Không thể chạy:';
    sfGuardBanner.appendChild(title);
    const ul = document.createElement('ul');
    errors.forEach(e => { const li = document.createElement('li'); li.textContent = e; ul.appendChild(li); });
    sfGuardBanner.appendChild(ul);
    sfGuardBanner.classList.add('show');
    return;
  }
  sfGuardBanner.classList.remove('show');

  let tab = await checkFilmTab();
  if (!tab) { alert('Hãy mở grok.com → Imagine!'); return; }

  const doChain  = sfChaining.checked;
  const doDL     = true;
  const doWaitUI = sfWaitGen.checked;
  const doWait   = true;
  const delay    = Math.max(1000, parseInt(sfDelayInput.value) || 2500);
  const tmOut    = (parseInt(sfTimeoutInput.value) || 150) * 1000;

  sfIsRunning = true; sfStopReq = false;
  sfRunBtn.disabled = true; sfStopBtn.disabled = false;
  sfLogEl.innerHTML = '';
  sfProgWrap.classList.add('show');
  sfExportCard.classList.remove('show');
  setProgress(sfProgBar, sfProgLabel, 0, sfScenes.length, 'Cảnh xong');
  addLog(sfLogEl, `[SF tab] active tab state=${tab.grokPageState}; url=${tab.url || ''}`, 'info');
  const normalizedStart = await normalizeFilmStartTab(tab);
  if (!normalizedStart.ok) {
    const errEntry = {
      sceneId: 'film-prepare',
      index: 0,
      step: 'Prepare composer',
      code: 'composer_not_found',
      message: normalizedStart.error || 'Không chuẩn bị được tab Grok trước khi chạy Film.',
    };
    logSceneError(sfLogEl, {
      feature: 'Film',
      sceneId: errEntry.sceneId,
      step: errEntry.step,
      code: errEntry.code,
      message: errEntry.message,
      detail: errEntry.message,
      willContinue: false,
      raw: normalizedStart,
    });
    addLog(sfLogEl, `[SF tab] Không thể rời Grok Template trước khi chạy Film: ${normalizedStart.error}`, 'err');
    logRunSummary(sfLogEl, { feature: 'Film', total: sfScenes.length, done: 0, failed: 1, stopped: true, errors: [errEntry], stopReason: errEntry.message });
    sfIsRunning = false;
    sfRunBtn.disabled = false;
    sfStopBtn.disabled = true;
    return;
  }
  tab = normalizedStart.tab;
  addLog(sfLogEl, `[SF tab] normalized start state=${normalizedStart.state}; url=${normalizedStart.url}`, 'info');
  if (!doWaitUI) addLog(sfLogEl, 'ℹ Short Film luôn chạy FIFO: tự động chờ scene xong trước khi qua scene tiếp theo.', 'warn');
  if (!sfAutoDL.checked) addLog(sfLogEl, 'Short Film FIFO: auto-download is required and will stay on for this run.', 'warn');

  const downloadedFiles = [];
  let prevFrameDataUrl  = null;
  let done = 0;
  let failed = 0;
  let stopped = false;
  const runErrors = [];
  const recordFilmError = (i, scene, step, res, willContinue = false) => {
    const normalized = normalizeErrorResult(res, { step, code: res?.code || 'unknown_error' });
    const entry = {
      sceneId: scene?.id || `scene-${i + 1}`,
      index: i + 1,
      step,
      code: normalized.code,
      message: normalized.error,
      detail: normalized.detail,
    };
    runErrors.push(entry);
    failed++;
    logSceneError(sfLogEl, {
      feature: 'Film',
      sceneId: entry.sceneId,
      index: entry.index,
      total: sceneQueue?.length || sfScenes.length,
      step,
      code: entry.code,
      message: entry.message,
      detail: entry.detail,
      willContinue,
      raw: normalized.raw,
    });
  };
  const usePersistentCharacterRefs = true;
  const sceneQueue = (window.ShortFilmLogic?.normalizeSceneQueue || (x => [...x]))(sfScenes);
  sfMessageStates = new Map(sceneQueue.map(s => [s.id, (window.ShortFilmLogic?.createMessageState || ((id) => ({id, status: 'pending', error: null})))(s.id)]));
  const filmSubmitRuntime = createFilmSubmitRuntime();
  const submittedSceneIds = filmSubmitRuntime.submittedSceneIds;
  const filmRefsRuntime = new Map();
  let currentSubmittingSceneId = null;

  const prepareRes = await prepareShortFilmComposer(tab.id);
  if (!prepareRes.ok) {
    const errEntry = {
      sceneId: 'film-prepare',
      index: 0,
      step: 'Prepare composer',
      code: prepareRes.code || 'composer_not_found',
      message: prepareRes.error || 'Không chuẩn bị được composer trước Short Film.',
    };
    logSceneError(sfLogEl, {
      feature: 'Film',
      sceneId: errEntry.sceneId,
      step: errEntry.step,
      code: errEntry.code,
      message: errEntry.message,
      detail: errEntry.message,
      willContinue: false,
      raw: prepareRes,
    });
    addLog(sfLogEl, `Không chuẩn bị được composer trước Short Film: ${prepareRes.error}`, 'err');
    logRunSummary(sfLogEl, { feature: 'Film', total: sceneQueue.length, done: 0, failed: 1, stopped: true, errors: [errEntry], stopReason: errEntry.message });
    sfIsRunning = false;
    sfRunBtn.disabled = false;
    sfStopBtn.disabled = true;
    return;
  }
  addLog(sfLogEl, `[SF prepare] done; scene loop will not navigate/reload`, 'ok');
  addLog(sfLogEl, '[Film submit audit] Đã tìm thấy submit path legacy: clickSubmitButton / Enter fallback / requestSubmit / auto submit sau upload ảnh.', 'info');
  addLog(sfLogEl, '[Film submit audit] Đã disable legacy submit path trong Film: injectTextPrompt luôn doSubmit=false, clickSubmitButton không dùng, retry submit cũ không chạy.', 'info');
  addLog(sfLogEl, '[Film submit audit] Submit entry point duy nhất: submitFilmSceneAtomic', 'ok');

  for (let i = 0; i < sceneQueue.length; i++) {
    if (sfStopReq) { stopped = true; addLog(sfLogEl, `⏹ Dừng tại cảnh ${i+1}`, 'warn'); break; }

    const scene = sceneQueue[i];
    const msgState = sfMessageStates.get(scene.id);
    try {
      sfSetSceneStatus(scene.id, 'running');
      setFilmScenePhase(filmSubmitRuntime, scene.id, 'idle');
      const shieldInstall = await installFilmEarlySubmitShield(tab.id, scene.id, 'idle');
      addLog(sfLogEl, `[Film submit shield] Cảnh ${i + 1}: active=${shieldInstall.ok ? 'yes' : 'no'} phase=idle, monitor-only, không chặn DOM event.`, shieldInstall.ok ? 'info' : 'warn');
      if (msgState) msgState.status = 'running';
      $(`sf-scene-${scene.id}`)?.scrollIntoView({ behavior:'smooth', block:'nearest' });

      console.log(`[GPI-SF] ═══ SCENE ${i+1}/${sfScenes.length} ═══`, scene.title || '');
      addLog(sfLogEl, `[SF scene] index=${i + 1}/${sceneQueue.length}; no navigation during scene loop`, 'info');

      const preparedScene = await prepareFilmSceneComposerForPersistedRefs(tab.id, {
        sceneId: scene.id,
        sceneIndex: i,
        displayName: `Cảnh ${i + 1}`,
        maxRefs: SF_MAX_REFERENCE_IMAGES,
        logEl: sfLogEl,
      });
      if (!preparedScene.ok) {
        recordFilmError(i, scene, 'Chuẩn bị composer refs persist', preparedScene, false);
        addLog(sfLogEl, `[SF prepare scene] FAIL Cảnh ${i + 1}: ${preparedScene.error || preparedScene.code}`, 'err');
        sfSetSceneStatus(scene.id, 'error');
        $(`sf-serr-${scene.id}`).textContent = `Không chuẩn bị được composer Film: ${preparedScene.error || preparedScene.code}`;
        break;
      }

      console.log('[GPI-SF] Scrolling page to bottom...');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const inputSelectors = [
            'textarea[placeholder*="Type to imagine" i]',
            'textarea[placeholder*="Imagine" i]',
            'textarea[placeholder*="Describe" i]',
            'textarea[placeholder*="Enter" i]',
            'div[contenteditable="true"][data-lexical-editor]',
            'div[contenteditable="true"]',
            'textarea',
          ].join(',');
          const input = Array.from(document.querySelectorAll(inputSelectors))
            .filter(el => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && r.top > window.innerHeight * 0.50;
            })
            .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
          if (input) input.scrollIntoView({ block: 'center', inline: 'nearest' });
        },
      });
        await sleep(500);

      const sceneSettings = await ensureShortFilmComposerForScene(tab.id, scene, i);
      if (!sceneSettings.ok) {
        recordFilmError(i, scene, 'Prepare composer / Settings guard', { code: sceneSettings.code || 'settings_guard_failed', error: sceneSettings.settingsGuard?.error || sceneSettings.error || sceneSettings.ratioGuard?.error || 'settings guard failed', raw: sceneSettings }, false);
        sfSetSceneStatus(scene.id, 'error');
        $(`sf-serr-${scene.id}`).textContent = `Không chuẩn bị được composer/settings: ${sceneSettings.settingsGuard?.error || sceneSettings.error || sceneSettings.ratioGuard?.error || sceneSettings.ratioGuard?.before?.error || sceneSettings.ratioGuard?.after?.error || 'settings guard failed'}`;
        break;
      }
      const expectedFilmSettings = sceneSettings.settings || await getCurrentFilmGlobalSettings();
      await sleep(300);

      // Build full prompt
      const shotLine   = `[SHOT] ${scene.shot}. [CAMERA] ${scene.camera}.`;
      const sceneLabel = `[SCENE ${i+1}${scene.title ? ' — ' + scene.title : ''}]`;
      const refLine    = '[REFERENCE] Use attached reference image(s) as strict identity anchor. Keep character face, hair, outfit, and key accessories consistent.';
      const fullPrompt = `${anchor}
${shotLine}
${refLine}
${sceneLabel} ${scene.prompt.trim()}`;

      console.log('[GPI-SF] fullPrompt length:', fullPrompt.length);
      addLog(sfLogEl, `\n▶ CẢNH ${i+1}${scene.title ? ' — ' + scene.title : ''}`, 'ok');
      addLog(sfLogEl, `  Shot: ${scene.shot} | Cam: ${scene.camera}`);
      addLog(sfLogEl, `  Prompt: ${scene.prompt.slice(0,55)}...`);
      setStatus(`🎬 Cảnh ${i+1}/${sfScenes.length}`, 'orange');
      addLog(sfLogEl, `[Film submit audit] Submit entry point duy nhất: submitFilmSceneAtomic`, 'info');
      addLog(sfLogEl, `[SF phase] sceneId=${scene.id} -> uploading_refs`, 'info');
      addLog(sfLogEl, `[Film phase] Cảnh ${i + 1} -> uploading_refs`, 'info');
      await setFilmEarlySubmitShieldPhase(tab.id, scene.id, 'uploading_refs');

      // ── Step A0: Inject character reference images ─────────────────────────
      const sceneSettingsState = {
        ratioVerifiedBeforeAttach: false,
        resolutionVerified: false,
        durationVerified: false,
        preAttachOk: false,
        postAttachOk: false,
        settings: expectedFilmSettings,
        verifiedAt: null,
      };
      const settingDetectedValue = (res) => res?.detectedValue || res?.detectedRatio || res?.after?.detectedValue || res?.after?.detectedRatio || res?.before?.detectedValue || res?.before?.detectedRatio || null;
      const isVerifiedStateUsableForMissingSettingDom = (guard) => {
        const failed = Object.entries(guard?.results || {}).filter(([, res]) => !res?.ok);
        if (failed.length === 0) return false;
        return failed.every(([key, res]) => {
          if (key !== 'resolution' && key !== 'duration') return false;
          const stateOk = key === 'resolution' ? sceneSettingsState.resolutionVerified : sceneSettingsState.durationVerified;
          return stateOk && !settingDetectedValue(res);
        });
      };
      if (i === 0) {
        addLog(sfLogEl, `[SF settings pre-attach] running before reference upload sceneId=${scene.id}`, 'info');
        const preAttachSettings = await ensureFilmPreAttachSettings(tab.id, { scope: 'bottomComposer' });
        for (const key of ['ratio', 'resolution', 'duration']) {
          const res = preAttachSettings.results?.[key] || {};
          const detected = res.detectedValue || res.after?.detectedValue || res.before?.detectedValue || res.detectedRatio || res.after?.detectedRatio || res.before?.detectedRatio || 'unknown';
          addLog(sfLogEl, `[SF settings pre-attach] ${key} expected=${preAttachSettings.settings?.[key] || expectedFilmSettings?.[key] || 'unknown'} detected=${detected}`, res.ok ? 'info' : 'err');
        }
        if (!preAttachSettings.ok) {
          const failed = preAttachSettings.failedSetting || 'unknown';
          recordFilmError(i, scene, 'Global Settings Guard trước upload reference', preAttachSettings, false);
          addLog(sfLogEl, `[SF settings pre-attach] FAIL setting=${failed}`, 'err');
          sfSetSceneStatus(scene.id, 'error');
          $(`sf-serr-${scene.id}`).textContent = `Settings guard failed before reference upload: ${preAttachSettings.error || failed}`;
          break;
        }
        sceneSettingsState.ratioVerifiedBeforeAttach = preAttachSettings.results?.ratio?.ok === true;
        sceneSettingsState.resolutionVerified = preAttachSettings.results?.resolution?.ok === true;
        sceneSettingsState.durationVerified = preAttachSettings.results?.duration?.ok === true;
        sceneSettingsState.preAttachOk = true;
        sceneSettingsState.verifiedAt = Date.now();
        addLog(sfLogEl, '[SF settings pre-attach] PASS', 'ok');
      } else {
        addLog(sfLogEl, `[SF ratio] sceneId=${scene.id} bỏ qua aspect ratio guard vì đã xác nhận ở scene 1`, 'info');
      }

      const charRefs = sfCharacters.filter(c => c.imageDataUrl);
      const desiredRefs = usePersistentCharacterRefs ? buildFilmDesiredRefs(charRefs) : [];
      let characterRefSuccessCount = 0;
      let filmRefsReady = false;
      let filmRefsReadyCount = 0;
      let filmRefsReadySource = 'none';
      if (usePersistentCharacterRefs || desiredRefs.length === 0) {
        addLog(sfLogEl, `[SF refs] sceneId=${scene.id} kiểm tra ảnh tham chiếu Grok persist.`, 'info');
        addLog(sfLogEl, `  📷 Film dùng refs xuyên suốt: chỉ inject ${desiredRefs.length} ảnh cấu hình nếu composer chưa có ảnh.`, 'chain');
        const refsRes = await ensureFilmPersistedRefs(tab.id, {
          sceneId: scene.id,
          sceneIndex: i,
          totalScenes: sceneQueue.length,
          desiredRefs,
          maxRefs: SF_MAX_REFERENCE_IMAGES,
        }, filmRefsRuntime, {
          logEl: sfLogEl,
          displayScene: `Cảnh ${i + 1}`,
        });
        if (!refsRes.ok) {
          recordFilmError(i, scene, 'Reference images guard', refsRes, false);
          addLog(sfLogEl, `[SF refs] FAIL sceneId=${scene.id}: ${refsRes.error || refsRes.code}`, 'err');
          sfSetSceneStatus(scene.id, 'error');
          $(`sf-serr-${scene.id}`).textContent = `Reference guard failed: ${refsRes.error || refsRes.code}`;
          break;
        }
        filmRefsReadyCount = Number(
          refsRes.attachmentCount
          ?? refsRes.currentAttachmentCount
          ?? refsRes.count
          ?? refsRes.imageCount
          ?? refsRes.finalCount
          ?? refsRes.successCount
          ?? 0
        );
        filmRefsReadySource = refsRes.reason || (refsRes.skippedInject ? 'grok_persisted_refs' : 'configured_refs_injected');
        filmRefsReady = refsRes.ok && (
          filmRefsReadyCount > 0
          || refsRes.skippedInject === true
          || refsRes.reason === 'grok_persisted_refs'
        );
        addLog(sfLogEl, `[SF refs] sceneId=${scene.id} refsReady=${filmRefsReady ? 'yes' : 'no'} attachmentCount=${filmRefsReadyCount} source=${filmRefsReadySource}`, filmRefsReady ? 'ok' : 'warn');
        characterRefSuccessCount = refsRes.successCount || refsRes.finalCount || filmRefsReadyCount || desiredRefs.length;
        addLog(sfLogEl, `[SF scene] char refs ready sceneId=${scene.id}: count=${characterRefSuccessCount}; skippedInject=${refsRes.skippedInject ? 'yes' : 'no'}`, 'info');
        await sleep(300);
      } else {
        addLog(sfLogEl, `[SF scene] char refs ready sceneId=${scene.id}: no`, 'info');
      }

      // ── Step A: Inject reference frame (chaining) — CHỈ SCENE 2+ ──────────
      // Scene đầu tiên không có prevFrameDataUrl → bỏ qua hoàn toàn
      if (i === 0) {
        addLog(sfLogEl, `[SF settings post-attach] running after reference upload sceneId=${scene.id}`, 'info');
        addLog(sfLogEl, '[SF settings post-attach] ratio skipped because Grok hides ratio after reference image attach', 'info');
        const postAttachSettings = await ensureFilmPostAttachSettings(tab.id, { scope: 'bottomComposer' });
        let postAttachAcceptedByVerifiedState = false;
        for (const key of ['resolution', 'duration']) {
          const res = postAttachSettings.results?.[key] || {};
          const detected = res.detectedValue || res.after?.detectedValue || res.before?.detectedValue || 'unknown';
          addLog(sfLogEl, `[SF settings post-attach] ${key} expected=${postAttachSettings.settings?.[key] || expectedFilmSettings?.[key] || 'unknown'} detected=${detected}`, res.ok ? 'info' : 'err');
        }
        if (!postAttachSettings.ok && isVerifiedStateUsableForMissingSettingDom(postAttachSettings)) {
          addLog(sfLogEl, '[SF settings post-attach] soft-check not detected, using verified pre-attach state', 'warn');
          postAttachAcceptedByVerifiedState = true;
        } else if (!postAttachSettings.ok) {
          const failed = postAttachSettings.failedSetting || 'unknown';
          recordFilmError(i, scene, 'Global Settings Guard sau upload reference', postAttachSettings, false);
          addLog(sfLogEl, `[SF settings post-attach] FAIL setting=${failed}`, 'err');
          sfSetSceneStatus(scene.id, 'error');
          $(`sf-serr-${scene.id}`).textContent = `Settings guard failed after reference upload: ${postAttachSettings.error || failed}`;
          break;
        }
        sceneSettingsState.resolutionVerified = sceneSettingsState.resolutionVerified || postAttachSettings.results?.resolution?.ok === true;
        sceneSettingsState.durationVerified = sceneSettingsState.durationVerified || postAttachSettings.results?.duration?.ok === true;
        sceneSettingsState.postAttachOk = postAttachSettings.ok || postAttachAcceptedByVerifiedState;
        sceneSettingsState.verifiedAt = Date.now();
        addLog(sfLogEl, '[SF settings post-attach] PASS', 'ok');
      }

      const refDataUrl = (doChain && prevFrameDataUrl) ? prevFrameDataUrl : scene.chainDataUrl;
      const hasRefDataUrl = Boolean(refDataUrl);
      const validRefDataUrl = isValidImageDataUrl(refDataUrl);
      let chainingRefSuccess = false;
      if (hasRefDataUrl && !validRefDataUrl) {
        addLog(sfLogEl, `[SF chain] invalid prevFrameDataUrl skipped sceneId=${scene.id} prefix=${String(refDataUrl || '').slice(0, 32)}`, 'warn');
        addLog(sfLogEl, `[SF chain] skip chaining frame because invalid dataUrl`, 'warn');
        addLog(sfLogEl, `[SF timing] chainWaitMs=0 skipped because invalid dataUrl`, 'warn');
      }
      if (hasRefDataUrl && validRefDataUrl) {
        addLog(sfLogEl, `[SF chaining] Bỏ qua inject chaining frame để không cộng thêm ảnh tham chiếu.`, 'info');
        addLog(sfLogEl, `[SF scene] chaining frame injected sceneId=${scene.id}: skipped-by-ref-policy`, 'info');
        addLog(sfLogEl, `[SF timing] chainWaitMs=0 skipped by reference policy`, 'info');
        await sleep(300);
      } else {
        addLog(sfLogEl, `[SF scene] chaining frame injected sceneId=${scene.id}: no`, 'info');
      }
      setFilmScenePhase(filmSubmitRuntime, scene.id, 'refs_attached');
      addLog(sfLogEl, `[Film phase] Cảnh ${i + 1} -> refs_attached`, 'info');
      await setFilmEarlySubmitShieldPhase(tab.id, scene.id, 'refs_attached');

      const filmOutputCount = await ensureFilmSingleOutput(tab.id, {
        logEl: sfLogEl,
        displayName: `Cảnh ${i + 1}`,
      });
      addLog(sfLogEl, `[SF output count] sceneId=${scene.id} expected=1 method=${filmOutputCount.method || 'unknown'} skipped=${filmOutputCount.skipped ? 'yes' : 'no'}`, filmOutputCount.ok ? 'info' : 'warn');

      const knownVids = await snapshotVideoUrls(tab.id);

      // ── Step B: Inject prompt (không submit) ───────────────────────────────
      // Tại thời điểm này button đã enabled (chứng tỏ Grok đã nhận xong ảnh),
      // an toàn để inject text. Dùng doSubmit=false, submit riêng ở Step B2.
      addLog(sfLogEl, `[Film phase] Cảnh ${i + 1} -> injecting_prompt`, 'info');
      await setFilmEarlySubmitShieldPhase(tab.id, scene.id, 'injecting_prompt');
      addLog(sfLogEl, `  ✍ Gán prompt text...`);

      // Thử inject text tối đa 3 lần (đề phòng composer chưa nhận được)
      let txtRes = { ok: false, error: 'Chưa thử' };
      for (let attempt = 1; attempt <= 3; attempt++) {
        txtRes = await injectTextPrompt(tab.id, fullPrompt, false); // doSubmit=false
        if (txtRes.ok) break;
        addLog(sfLogEl, `  ⚠ Inject text lần ${attempt} thất bại, thử lại...`, 'warn');
        await sleep(1000);
      }
      if (!txtRes.ok) {
        addLog(sfLogEl, `  ✗ ${txtRes.error}`, 'err');
        sfSetSceneStatus(scene.id, 'error');
        $(`sf-serr-${scene.id}`).textContent = `⚠ Inject thất bại: ${txtRes.error}`;
        continue;
      }
      addLog(sfLogEl, `[SF scene] prompt injected sceneId=${scene.id}: yes`, 'info');
      setFilmScenePhase(filmSubmitRuntime, scene.id, 'prompt_injected');
      addLog(sfLogEl, `  ✓ Đã gán text`, 'ok');
      addLog(sfLogEl, `[Film phase] Cảnh ${i + 1} -> prompt_committing`, 'info');
      await setFilmEarlySubmitShieldPhase(tab.id, scene.id, 'prompt_committing');
      const promptCommit = await waitFilmPromptCommitStable(tab.id, fullPrompt, {
        scope: 'bottomComposer',
        stableMs: 1000,
        timeoutMs: 8000,
        sceneId: scene.id,
      });
      if (!promptCommit.ok) {
        setFilmScenePhase(filmSubmitRuntime, scene.id, 'failed');
        recordFilmError(i, scene, 'Prompt commit stable', { ...promptCommit, code: promptCommit.code || 'prompt_commit_unstable', error: promptCommit.error || 'Prompt chưa commit ổn định trước submit.' }, false);
        addLog(sfLogEl, '[SF prompt commit] FAIL', 'err');
        sfSetSceneStatus(scene.id, 'error');
        $(`sf-serr-${scene.id}`).textContent = `Prompt chưa ổn định: ${promptCommit.error || promptCommit.code}`;
        break;
      }
      addLog(sfLogEl, '[SF prompt commit] PASS', 'ok');
      setFilmScenePhase(filmSubmitRuntime, scene.id, 'prompt_committed');
      addLog(sfLogEl, `[Film phase] Cảnh ${i + 1} -> prompt_ready`, 'info');
      await setFilmEarlySubmitShieldPhase(tab.id, scene.id, 'prompt_ready');

      // ── Step B2: Guard payload rồi submit riêng ─────────────────────────────
      await sleep(300);
      if (i === 0) {
        addLog(sfLogEl, `[SF settings guard] pre-submit verify sceneId=${scene.id}`, 'info');
        addLog(sfLogEl, '[SF settings guard] pre-submit ratio skipped; verified before attach', sceneSettingsState.ratioVerifiedBeforeAttach ? 'info' : 'err');
        if (!sceneSettingsState.ratioVerifiedBeforeAttach) {
          addLog(sfLogEl, '[SF settings guard] FAIL ratio was never verified before attach', 'err');
          sfSetSceneStatus(scene.id, 'error');
          $(`sf-serr-${scene.id}`).textContent = 'Settings guard failed before submit: ratio was never verified before attach';
          break;
        }
        let preSubmitSettings = await verifyFilmPostAttachSettings(tab.id, expectedFilmSettings, { scope: 'bottomComposer' });
        if (!preSubmitSettings.ok && isVerifiedStateUsableForMissingSettingDom(preSubmitSettings)) {
          addLog(sfLogEl, '[SF settings guard] pre-submit soft-check not detected, using verified state', 'warn');
          preSubmitSettings = {
            ...preSubmitSettings,
            ok: true,
            failedSetting: null,
            results: {
              resolution: preSubmitSettings.results?.resolution || { ok: true, expectedValue: expectedFilmSettings.resolution, detectedValue: null, method: 'verified-state' },
              duration: preSubmitSettings.results?.duration || { ok: true, expectedValue: expectedFilmSettings.duration, detectedValue: null, method: 'verified-state' },
            },
          };
        } else if (!preSubmitSettings.ok) {
          const failed = preSubmitSettings.failedSetting || 'unknown';
          const failedRes = preSubmitSettings.results?.[failed] || {};
          const detected = failedRes.detectedValue || failedRes.detectedRatio || 'unknown';
          addLog(sfLogEl, `[SF settings guard] pre-submit mismatch setting=${failed} expected=${expectedFilmSettings?.[failed] || 'unknown'} detected=${detected}; applying once`, 'warn');
          const reappliedSettings = await ensureFilmPostAttachSettings(tab.id, { scope: 'bottomComposer' });
          if (!reappliedSettings.ok) {
            recordFilmError(i, scene, 'Global Settings Guard trước submit', reappliedSettings, false);
            addLog(sfLogEl, `[SF settings guard] FAIL setting=${reappliedSettings.failedSetting || failed} expected=${expectedFilmSettings?.[reappliedSettings.failedSetting || failed] || 'unknown'} detected=${detected}`, 'err');
            sfSetSceneStatus(scene.id, 'error');
            $(`sf-serr-${scene.id}`).textContent = `Settings guard failed before submit: ${reappliedSettings.error || failed}`;
            break;
          }
          preSubmitSettings = await verifyFilmPostAttachSettings(tab.id, expectedFilmSettings, { scope: 'bottomComposer' });
          if (!preSubmitSettings.ok && isVerifiedStateUsableForMissingSettingDom(preSubmitSettings)) {
            addLog(sfLogEl, '[SF settings guard] pre-submit soft-check still not detected after apply, using verified state', 'warn');
            preSubmitSettings = {
              ...preSubmitSettings,
              ok: true,
              failedSetting: null,
              results: {
                resolution: preSubmitSettings.results?.resolution || { ok: true, expectedValue: expectedFilmSettings.resolution, detectedValue: null, method: 'verified-state' },
                duration: preSubmitSettings.results?.duration || { ok: true, expectedValue: expectedFilmSettings.duration, detectedValue: null, method: 'verified-state' },
              },
            };
          }
        }
        if (!preSubmitSettings.ok) {
          const failed = preSubmitSettings.failedSetting || 'unknown';
          const failedRes = preSubmitSettings.results?.[failed] || {};
          const detected = failedRes.detectedValue || failedRes.detectedRatio || 'unknown';
          recordFilmError(i, scene, 'Global Settings Guard trước submit', preSubmitSettings, false);
          addLog(sfLogEl, `[SF settings guard] FAIL setting=${failed} expected=${expectedFilmSettings?.[failed] || 'unknown'} detected=${detected}`, 'err');
          sfSetSceneStatus(scene.id, 'error');
          $(`sf-serr-${scene.id}`).textContent = `Settings guard failed before submit: ${preSubmitSettings.error || failed}`;
          break;
        }
        const finalRatio = sceneSettingsState.ratioVerifiedBeforeAttach ? `${expectedFilmSettings.ratio} (verified before attach)` : 'not-verified';
        const finalResolution = preSubmitSettings.results?.resolution?.detectedValue || expectedFilmSettings.resolution;
        const finalDuration = preSubmitSettings.results?.duration?.detectedValue || expectedFilmSettings.duration;
        addLog(sfLogEl, `[SF pre-click settings] ratio skipped; verified before attach`, 'info');
        addLog(sfLogEl, `[SF pre-click settings] resolution=${finalResolution}`, 'info');
        addLog(sfLogEl, `[SF pre-click settings] duration=${finalDuration}`, 'info');
        addLog(sfLogEl, `[SF settings guard] final ratio/resolution/duration before submit: ${finalRatio}/${finalResolution}/${finalDuration}`, 'ok');
      }
      const requireSceneImage = Boolean(chainingRefSuccess || characterRefSuccessCount > 0 || (usePersistentCharacterRefs && charRefs.length > 0));
      const payloadGuardRequireImage = requireSceneImage && !filmRefsReady;
      if (requireSceneImage && filmRefsReady) {
        addLog(sfLogEl, `[SF guard] sceneId=${scene.id} bỏ qua image check trong payload guard vì Film refs đã được xác nhận ở Reference guard.`, 'info');
      }
      const guardOptions = {
        scope: 'bottomComposer',
        requireText: true,
        requireImage: payloadGuardRequireImage,
        minTextChars: Math.min(80, Math.max(20, Math.floor(fullPrompt.length * 0.15))),
        timeoutMs: 15000,
        stableMs: 800,
        expectedSceneId: scene.id,
      };
      const expectedSettingsForGuard = {
        ratio: expectedFilmSettings?.ratio,
        resolution: expectedFilmSettings?.resolution,
        duration: expectedFilmSettings?.duration,
      };
      let payloadGuard = await verifyComposerPayload(tab.id, fullPrompt, guardOptions);
      addLog(
        sfLogEl,
        `[SF guard] sceneId=${scene.id} pass=${payloadGuard.ok ? 'yes' : 'no'} expectedTextLen=${payloadGuard.expectedTextLength ?? fullPrompt.length} composerTextLen=${payloadGuard.composerTextLength ?? 0} imageCount=${payloadGuard.imageCount ?? 0} refsReady=${filmRefsReady ? 'yes' : 'no'} persistedRefCount=${filmRefsReadyCount} requireImage=${payloadGuardRequireImage} textOnly=${payloadGuardRequireImage ? 'no' : 'yes'} stable=${payloadGuard.stableElapsedMs ?? 0}/${guardOptions.stableMs} error=${payloadGuard.error || 'none'}`,
        payloadGuard.ok ? 'info' : 'warn'
      );
      let guardTextRetryCount = 0;
      while (!payloadGuard.ok && payloadGuard.code === 'text_missing' && guardTextRetryCount < 2) {
        guardTextRetryCount++;
        addLog(sfLogEl, `[SF guard] retry inject text count=${guardTextRetryCount} sceneId=${scene.id}`, 'warn');
        const retryTxtRes = await injectTextPrompt(tab.id, fullPrompt, false);
        if (!retryTxtRes.ok) {
          addLog(sfLogEl, `[SF guard] retry inject text failed sceneId=${scene.id}: ${retryTxtRes.error}`, 'warn');
        }
        await sleep(300);
        payloadGuard = await verifyComposerPayload(tab.id, fullPrompt, guardOptions);
        addLog(
          sfLogEl,
          `[SF guard] sceneId=${scene.id} retry=${guardTextRetryCount} pass=${payloadGuard.ok ? 'yes' : 'no'} expectedTextLen=${payloadGuard.expectedTextLength ?? fullPrompt.length} composerTextLen=${payloadGuard.composerTextLength ?? 0} imageCount=${payloadGuard.imageCount ?? 0} refsReady=${filmRefsReady ? 'yes' : 'no'} persistedRefCount=${filmRefsReadyCount} requireImage=${payloadGuardRequireImage} textOnly=${payloadGuardRequireImage ? 'no' : 'yes'} stable=${payloadGuard.stableElapsedMs ?? 0}/${guardOptions.stableMs} error=${payloadGuard.error || 'none'}`,
          payloadGuard.ok ? 'info' : 'warn'
        );
      }
      if (!payloadGuard.ok) {
        setFilmScenePhase(filmSubmitRuntime, scene.id, 'failed');
        recordFilmError(i, scene, 'Payload guard', { ...payloadGuard, code: payloadGuard.code || 'payload_guard_failed', error: payloadGuard.error || 'Payload chưa đủ trước khi submit.' }, true);
        if (payloadGuard.code === 'image_missing') {
          addLog(sfLogEl, `[SF guard] Reference image/chaining frame missing before submit sceneId=${scene.id}`, 'err');
        }
        addLog(sfLogEl, `[SF guard] Payload not ready sceneId=${scene.id}: ${payloadGuard.error}`, 'err');
        sfSetSceneStatus(scene.id, 'error');
        $(`sf-serr-${scene.id}`).textContent = `Payload chưa đủ: ${payloadGuard.error}`;
        continue;
      }
      addLog(sfLogEl, `[SF guard] guard pass sceneId=${scene.id}; retry inject text count=${guardTextRetryCount}`, 'ok');
      if (filmRefsReady) {
        addLog(sfLogEl, `[SF guard] sceneId=${scene.id} pass=yes textOnly=true composerTextLen=${payloadGuard.composerTextLength ?? 0}`, 'ok');
      }
      setFilmScenePhase(filmSubmitRuntime, scene.id, 'payload_verified');
      addLog(sfLogEl, `[Film phase] Cảnh ${i + 1} -> payload_verified`, 'info');
      addLog(sfLogEl, `[SF ready] Cảnh ${i + 1}: payload đã đủ, chờ động đến khi ảnh + prompt + nút submit ổn định.`, 'info');
      const readyForSubmit = await waitFilmComposerReadyForSubmit(tab.id, fullPrompt, {
        sceneId: scene.id,
        guardOptions,
        refsReady: filmRefsReady,
        maxRefs: SF_MAX_REFERENCE_IMAGES,
        timeoutMs: SF_PRE_SUBMIT_READY_TIMEOUT,
        stableMs: 1200,
        logEl: sfLogEl,
      });
      addLog(
        sfLogEl,
        `[SF ready] sceneId=${scene.id} ok=${readyForSubmit.ok ? 'yes' : 'no'} text=${readyForSubmit.textReady ? 'yes' : 'no'} refs=${readyForSubmit.imageReady ? 'yes' : 'no'} attachmentCount=${readyForSubmit.attachmentCount ?? 0} pending=${readyForSubmit.pendingCards ?? 0} button=${readyForSubmit.buttonFound ? 'yes' : 'no'} stable=${readyForSubmit.stableElapsedMs ?? 0}/1200`,
        readyForSubmit.ok ? 'ok' : 'warn'
      );
      if (!readyForSubmit.ok) {
        setFilmScenePhase(filmSubmitRuntime, scene.id, 'failed');
        recordFilmError(i, scene, 'Pre-submit ready guard', { ...readyForSubmit, code: readyForSubmit.code || 'pre_submit_ready_failed', error: readyForSubmit.error || 'Composer chưa sẵn sàng ngay trước submit.' }, false);
        sfSetSceneStatus(scene.id, 'error');
        $(`sf-serr-${scene.id}`).textContent = `Composer chưa sẵn sàng trước submit: ${readyForSubmit.error || readyForSubmit.code}`;
        break;
      }
      addLog(sfLogEl, `  [SF timing] waiting briefly for submit button...`);
      const preSubmitWaitStart = Date.now();
      const btnReadySF = await waitForSubmitButtonEnabled(tab.id, SF_PRE_SUBMIT_BUTTON_TIMEOUT, 600, { scope: 'bottomComposer' });
      const preSubmitWaitMs = Date.now() - preSubmitWaitStart;
      addLog(sfLogEl, `[SF timing] preSubmitWaitMs=${preSubmitWaitMs} ok=${btnReadySF.ok ? 'yes' : 'no'}`, btnReadySF.ok ? 'info' : 'warn');
      if (!btnReadySF.ok) {
        addLog(sfLogEl, `  Submit button not ready after ${SF_PRE_SUBMIT_BUTTON_TIMEOUT}ms; trying one guarded click...`, 'warn');
      }
      addLog(sfLogEl, `[SF submit] sceneId=${scene.id} lock=${currentSubmittingSceneId || 'none'} submitted=${submittedSceneIds.has(scene.id)} phase=${getFilmScenePhase(filmSubmitRuntime, scene.id)}`);
      const submitLock = beginFilmSubmit(filmSubmitRuntime, scene.id);
      if (!submitLock.ok) {
        addLog(sfLogEl, `[Film submit lock] Chặn submit lặp cho scene ${i + 1}: ${submitLock.error}`, 'warn');
        addLog(sfLogEl, `[SF submit] duplicate submit ignored sceneId=${scene.id}`, 'warn');
        continue;
      }
      currentSubmittingSceneId = scene.id;
      let submitResSF = { ok: false, error: 'Submit not attempted' };
      addLog(sfLogEl, `[SF submit] atomic start sceneId=${scene.id}; lock=${currentSubmittingSceneId || 'none'}; attempt=1`, 'info');
      addLog(sfLogEl, `  Submit...`);
      submitResSF = await submitFilmSceneAtomic(tab.id, scene, fullPrompt, {
        requireImage: payloadGuardRequireImage,
        minTextChars: guardOptions.minTextChars,
        expectedSettings: expectedSettingsForGuard,
        requireSettings: i === 0,
        settingsState: sceneSettingsState,
        filmRuntime: filmSubmitRuntime,
        sceneIndex: i,
      });
      addLog(sfLogEl, `[SF pre-click guard] sceneId=${scene.id} textLen=${submitResSF.preClickGuard?.composerTextLength ?? submitResSF.preClickGuard?.textLen ?? submitResSF.textLen ?? 0} imageCount=${submitResSF.preClickGuard?.imageCount ?? submitResSF.imageCount ?? 0} pass=${submitResSF.ok ? 'yes' : 'no'} code=${submitResSF.code || 'none'}`, submitResSF.ok ? 'info' : 'warn');
      if (submitResSF.code === 'submit_button_not_found') {
        const candidates = Array.isArray(submitResSF.buttonCandidates) ? submitResSF.buttonCandidates : [];
        addLog(sfLogEl, `[SF submit debug] Không tìm thấy nút submit. buttonCandidates=${candidates.length}`, 'warn');
        candidates.slice(0, 6).forEach((btn, idx) => {
          addLog(sfLogEl, `[SF submit debug] #${idx + 1} text="${truncateText(btn.text || '', 60)}" type=${btn.type || 'none'} disabled=${btn.disabled ? 'yes' : 'no'} score=${btn.score} rect=${JSON.stringify(btn.rect || {})}`, 'warn');
        });
      }
      addLog(sfLogEl, `[SF submit] result sceneId=${scene.id}: ${JSON.stringify(submitResSF)}`, submitResSF.ok ? 'info' : 'err');
      if (!submitResSF.ok) {
        failFilmSubmit(filmSubmitRuntime, scene.id, submitResSF);
        await setFilmEarlySubmitShieldPhase(tab.id, scene.id, 'submit_failed');
        if (currentSubmittingSceneId === scene.id) currentSubmittingSceneId = null;
        setFilmScenePhase(filmSubmitRuntime, scene.id, 'failed');
        recordFilmError(i, scene, 'Submit', { ...submitResSF, code: submitResSF.code || 'submit_failed' }, false);
        addLog(sfLogEl, `  ✗ Submit thất bại: ${submitResSF.error}`, 'err');
        sfSetSceneStatus(scene.id, 'error');
        $(`sf-serr-${scene.id}`).textContent = `⚠ Submit thất bại: ${submitResSF.error}`;
        addLog(sfLogEl, `  ⏳ Chờ 5s trước khi dừng queue...`, 'warn');
        await sleep(5000);
        break;
      }
      acceptFilmSubmit(filmSubmitRuntime, scene.id);
      await setFilmEarlySubmitShieldPhase(tab.id, scene.id, 'submit_accepted');
      const shieldAfterSubmit = await getFilmEarlySubmitShieldState(tab.id);
      addLog(sfLogEl, `[Film submit shield] Cảnh ${i + 1}: blocked=${shieldAfterSubmit.blockedSubmitTotal || 0} seen=${shieldAfterSubmit.seenSubmitTotal || 0} phase=${shieldAfterSubmit.phase || 'unknown'}`, (shieldAfterSubmit.blockedSubmitTotal || 0) > 0 ? 'warn' : 'info');
      addLog(sfLogEl, `[SF submit] marked submitted sceneId=${scene.id}; accepted=yes`, 'info');
      addLog(sfLogEl, `  ✓ Đã submit (${submitResSF.method || 'ok'})`, 'ok');

      let generatedOk = true;
      if (doWait) {
        setStatus(`⏳ Chờ generate cảnh ${i+1}...`, 'orange');
        setFilmScenePhase(filmSubmitRuntime, scene.id, 'generating');
        await setFilmEarlySubmitShieldPhase(tab.id, scene.id, 'generating');
        addLog(sfLogEl, `  ⏳ Chờ Grok generate...`);
        await sleep(800);
        addLog(sfLogEl, `[SF generate] sceneId=${scene.id} waitGenerateWithSignals start.`, 'info');
        const gen = await waitForGrokGenerationDone(tab.id, {
          sceneId: scene.id,
          mediaType: 'video',
          knownState: { videoUrls: knownVids },
          timeoutMs: tmOut,
          shouldStop: () => sfStopReq,
          progressCallback: () => {},
          logPrefix: '[SF generate]',
          logEl: sfLogEl,
          stablePolls: 2,
        });

        // Nếu detect bằng fallback, chờ thêm tối đa 8s để video URL xuất hiện
        if (gen.ok && gen.reason !== 'new-video' && gen.reason !== 'media-stable') {
          addLog(sfLogEl, `  ⏳ Xác nhận video (${gen.reason})...`, 'info');
          const cfStart = Date.now();
          while (Date.now() - cfStart < 8000) {
            await sleep(800);
            const cfUrls = await snapshotVideoUrls(tab.id);
            if ([...cfUrls].some(u => !knownVids.has(u))) {
              addLog(sfLogEl, `  ✅ Video URL confirmed!`, 'ok');
          break;
        }
          }
        }

        // ── Xử lý moderation ────────────────────────────────────────────────
        if (gen.reason === 'moderated') {
          recordFilmError(i, scene, 'Chờ Grok generate', { ...gen, code: 'moderated', error: 'Cảnh bị Grok từ chối (moderation).' }, true);
          addLog(sfLogEl, `  🚫 Cảnh ${i+1} bị Grok từ chối (moderation)`, 'warn');
          sfSetSceneStatus(scene.id, 'error');
          $(`sf-serr-${scene.id}`).textContent = `⚠ Bị moderation — bỏ qua, tiếp cảnh tiếp theo`;
          if (msgState) msgState.status = 'moderated';
          generatedOk = false;
          if (currentSubmittingSceneId === scene.id) currentSubmittingSceneId = null;
          filmSubmitRuntime.activeSceneId = null;
          filmSubmitRuntime.accepted = false;
          // Không break — skip cảnh này và chạy tiếp
          done++; // vẫn tính là đã xử lý để progress bar đúng
          setProgress(sfProgBar, sfProgLabel, done, sfScenes.length, 'Cảnh xong');
          if (i < sfScenes.length - 1 && !sfStopReq) await sleep(delay);
          continue;
        }

        if (!gen.ok) {
          if (gen.reason === 'stopped') {
        stopped = true;
        addLog(sfLogEl, `  ⏹ Người dùng dừng`, 'warn');
        sfSetSceneStatus(scene.id, 'idle');
        if (msgState) msgState.status = 'stopped';
            if (currentSubmittingSceneId === scene.id) currentSubmittingSceneId = null;
            filmSubmitRuntime.activeSceneId = null;
            filmSubmitRuntime.accepted = false;
            break; // Chỉ dừng queue khi người dùng bấm Stop
          } else if (gen.reason === 'timeout') {
            setFilmScenePhase(filmSubmitRuntime, scene.id, 'failed');
            recordFilmError(i, scene, 'Chờ Grok generate', { ...gen, code: 'generate_timeout', error: `Không phát hiện media mới sau ${sfTimeoutInput.value || 150} giây.` }, false);
            addLog(sfLogEl, `  ⚠ Timeout cảnh ${i+1}`, 'warn');
            sfSetSceneStatus(scene.id, 'timeout');
            if (msgState) msgState.status = 'timeout';
            addLog(sfLogEl, '  ⛔ Queue dừng: cảnh hiện tại chưa generate xong.', 'warn');
            if (currentSubmittingSceneId === scene.id) currentSubmittingSceneId = null;
            filmSubmitRuntime.activeSceneId = null;
            filmSubmitRuntime.accepted = false;
            break;
      }
          generatedOk = false;
        } else {
          addLog(sfLogEl, `  ✅ Generate xong!`, 'ok');
          if (msgState) msgState.status = 'generated';
        }

        if (generatedOk && doChain) {
          await sleep(1500);
          addLog(sfLogEl, `  📸 Capture frame cuối...`, 'chain');
        const capture = await captureLastFrame(tab.id);
        addLog(sfLogEl, `[SF chain] capture source=${capture.source || 'unknown'} dataUrl prefix=${String(capture.dataUrl || '').slice(0, 32)}`, capture.ok ? 'info' : 'warn');
        if (capture.ok && isValidImageDataUrl(capture.dataUrl)) {
          prevFrameDataUrl      = capture.dataUrl;
          scene.genFrameDataUrl = capture.dataUrl;
          const genFrameEl = $(`sf-genframe-${scene.id}`);
          const genImgEl   = $(`sf-genimg-${scene.id}`);
          if (genFrameEl && genImgEl) { genImgEl.src = capture.dataUrl; genFrameEl.classList.add('show'); }
            addLog(sfLogEl, `  🔗 Frame captured → sẽ dùng cho cảnh ${i+2}`, 'chain');
        } else if (capture.ok) {
          addLog(sfLogEl, `[SF chain] invalid captured dataUrl skipped source=${capture.source || 'unknown'} prefix=${String(capture.dataUrl || '').slice(0, 32)}`, 'warn');
          prevFrameDataUrl = null;
        } else {
            addLog(sfLogEl, `  ⚠ Capture thất bại: ${capture.error}`, 'warn');
          prevFrameDataUrl = null;
        }
      }
      }

      // ── Step E: Download ─────────────────────────────────────────────────────
      if (doDL && generatedOk) {
        setStatus(`⬇ Tải cảnh ${i+1}...`, 'orange');
        addLog(sfLogEl, `  Queue download: chờ tải video cảnh ${i+1} xong trước khi qua cảnh tiếp theo...`);
        addLog(sfLogEl, `  Download video scene ${i+1} before continuing...`);
        const knownImgs = await snapshotImageUrls(tab.id);
        const sceneSlug = `scene${String(i+1).padStart(2,'0')}_${slugify(scene.title||scene.prompt)}`;
        let files = [];
        const sfMaxAttempts = await getMaxRetries();
        for (let attempt = 1; attempt <= sfMaxAttempts; attempt++) {
          files = await downloadMedia(tab.id, sceneSlug, 'video', knownVids, knownImgs);
          if (files.length > 0) break;
          if (attempt < sfMaxAttempts) {
            addLog(sfLogEl, `  ⏳ Chờ media ổn định (${attempt}/${sfMaxAttempts})...`, 'warn');
            await sleep(15000);
          }
        }
        if (files.length === 0) {
          recordFilmError(i, scene, 'Download media', { code: 'download_failed', error: `Không tải được video cảnh ${i+1}` }, false);
          addLog(sfLogEl, `  ⚠ Không tải được video cảnh ${i+1}`, 'warn');
          if (msgState) msgState.status = 'failed';
          sfSetSceneStatus(scene.id, 'error');
          $(`sf-serr-${scene.id}`).textContent = `Không tải được video cảnh ${i+1}`;
          addLog(sfLogEl, '  ⛔ Queue dừng: cảnh hiện tại chưa tải video xong.', 'err');
          if (currentSubmittingSceneId === scene.id) currentSubmittingSceneId = null;
          filmSubmitRuntime.activeSceneId = null;
          filmSubmitRuntime.accepted = false;
          break;
        } else {
          downloadHistory.push(...files.map(f => ({ ...f, prompt: `Cảnh ${i+1}: ${scene.prompt.slice(0,40)}` })));
          downloadedFiles.push(...files);
          if (msgState) msgState.status = 'downloaded';
          addLog(sfLogEl, `  ✅ Đã tải ${files.length} video cho cảnh ${i+1}`, 'ok');
          renderDownloads();
        }
      }

      sfSetSceneStatus(scene.id, 'done');
      setFilmScenePhase(filmSubmitRuntime, scene.id, 'done');
      if (currentSubmittingSceneId === scene.id) currentSubmittingSceneId = null;
      filmSubmitRuntime.activeSceneId = null;
      filmSubmitRuntime.accepted = false;
      if (msgState && msgState.status !== 'downloaded') msgState.status = 'generated';
      done++;
      setProgress(sfProgBar, sfProgLabel, done, sfScenes.length, 'Cảnh xong');
      saveScenes();

      if (i < sfScenes.length - 1 && !sfStopReq) {
        setStatus(`⏱ Chờ ${delay}ms...`, 'orange');
        await sleep(delay);
      }
    } catch (e) {
      if (currentSubmittingSceneId === scene.id) currentSubmittingSceneId = null;
      failFilmSubmit(filmSubmitRuntime, scene.id, e);
      setFilmScenePhase(filmSubmitRuntime, scene.id, 'failed');
      recordFilmError(i, scene, 'Runtime exception', { code: 'exception', error: e?.message || String(e), detail: e?.stack?.slice(0, 500), raw: e }, false);
      addLog(sfLogEl, `  ✗ Lỗi cảnh ${i+1}: ${e.message}`, 'err');
      sfSetSceneStatus(scene.id, 'error');
      if (msgState) { msgState.status = 'failed'; msgState.error = e.message; }
      $(`sf-serr-${scene.id}`).textContent = `⚠ Runtime error: ${e.message}`;
      addLog(sfLogEl, '  ⛔ Queue dừng: cảnh hiện tại lỗi runtime.', 'err');
      break;
    }
  }
  await clearFilmEarlySubmitShield(tab.id);
  sfIsRunning = false;
  sfRunBtn.disabled = false; sfStopBtn.disabled = true;
  const allSfOk = done === sfScenes.length;
  setStatus(allSfOk ? `✅ Short Film xong ${done} cảnh!` : `Film: ${done}/${sfScenes.length}`, allSfOk ? 'green' : 'orange');
  addLog(sfLogEl, `\n══ Hoàn tất: ${done}/${sfScenes.length} cảnh ══`, allSfOk ? 'ok' : 'warn');
  logRunSummary(sfLogEl, {
    feature: 'Film',
    total: sceneQueue.length,
    done,
    failed,
    stopped,
    errors: runErrors,
    stopReason: stopped ? 'Người dùng dừng hoặc Grok trả về stopped.' : (runErrors.find(err => err.code)?.message || ''),
  });

  if (downloadedFiles.length > 0) sfShowExport(downloadedFiles);
}

// ── Export guide ──────────────────────────────────────────────────────────────
function sfShowExport(files) {
  sfExportCard.classList.add('show');
  if (sfDownloadSummary) sfDownloadSummary.textContent = `${files.length} video cảnh đã tải xong.`;
  sfExportList.innerHTML = '';
  files.forEach((f, i) => {
    const div = document.createElement('div');
    div.className = 'sf-export-item ready';
    div.innerHTML = `<div class="dot green"></div> Cảnh ${i+1}: <strong>${f.filename}</strong>`;
    sfExportList.appendChild(div);
  });
}

// ── Scene save/load ───────────────────────────────────────────────────────────
function saveScenes() {
  const lightweight = sfScenes.map(s => ({
    id: s.id, title: s.title, shot: s.shot, camera: s.camera,
    prompt: s.prompt, status: 'idle', chainDataUrl: null, genFrameDataUrl: null,
  }));
  chrome.storage.local.set({ sfScenes: lightweight, sfSceneIdCounter });
}

// ── DOWNLOAD HISTORY ──────────────────────────────────────────────────────────
function renderDownloads() {
  footerDlCount.textContent = `${downloadHistory.length} file đã tải`;
  if (downloadHistory.length === 0) {
    dlList.innerHTML = `<div class="empty-state"><div class="icon">📂</div>Chưa có file nào.</div>`;
    return;
  }
  dlList.innerHTML = '';
  [...downloadHistory].reverse().forEach(item => {
    const el = document.createElement('div');
    el.className = 'dl-item';
    const icon = item.type === 'video' ? '🎬' : '🖼';
    const timeStr = new Date(item.time).toLocaleTimeString('vi-VN');
    el.innerHTML = `
      <div class="dl-thumb">${icon}</div>
      <div class="dl-info">
        <div class="dl-name">${item.filename}</div>
        <div class="dl-meta">${item.prompt.slice(0, 50)}${item.prompt.length > 50 ? '…' : ''}</div>
        <div class="dl-meta">${timeStr}</div>
      </div>
      <span class="dl-status ok">✓ OK</span>`;
    dlList.appendChild(el);
  });
}

// ── EVENTS ────────────────────────────────────────────────────────────────────
// Video tab
promptsInput.addEventListener('input', () => {
  const p = parsePrompts(promptsInput.value);
  countDisplay.textContent = p.length;
  charCount.textContent = promptsInput.value.length + ' ký tự';
  chrome.storage.local.set({ savedPrompts: promptsInput.value });
  if (!isRunning) renderTxtQueue();
});
runBtn.addEventListener('click', runInjector);
stopBtn.addEventListener('click', () => { stopRequested = true; stopBtn.disabled = true; });
clearBtn.addEventListener('click', () => {
  promptsInput.value = '';
  countDisplay.textContent = '0';
  charCount.textContent = '0 ký tự';
  logEl.innerHTML = '';
  progressWrap.classList.remove('show');
  txtQueue = []; renderTxtQueue();
});

// Image tab
imgPromptsInput.addEventListener('input', () => {
  const p = parseImagePrompts(imgPromptsInput.value);
  imgCountDisplay.textContent = p.length;
  imgCharCount.textContent = imgPromptsInput.value.length + ' ký tự';
  chrome.storage.local.set({ savedImgPrompts: imgPromptsInput.value });
  if (!imgIsRunning) renderImgQueue();
});
imgRunBtn.addEventListener('click', runImageGenerator);
imgStopBtn.addEventListener('click', () => { imgStopReq = true; imgStopBtn.disabled = true; });
imgOutputCountEl?.addEventListener('change', () => {
  imgOutputCount = normalizeImgOutputCount(imgOutputCountEl.value);
  imgOutputCountEl.value = String(imgOutputCount);
  chrome.storage.local.set({ savedImgOutputCount: imgOutputCount });
  if (!imgIsRunning) renderImgQueue();
});
imgClearBtn.addEventListener('click', () => {
  imgPromptsInput.value = '';
  imgCountDisplay.textContent = '0';
  imgCharCount.textContent = '0 ký tự';
  imgLogEl.innerHTML = '';
  imgProgressWrap.classList.remove('show');
  imgQueue = []; renderImgQueue();
});

// Img2Vid
let i2vRenderTimer = null;
i2vTextarea.addEventListener('input', () => {
  i2vUpdateCount();
  chrome.storage.local.set({ savedI2vPrompts: i2vTextarea.value });
  clearTimeout(i2vRenderTimer);
  i2vRenderTimer = setTimeout(() => {
    if (!i2vIsRunning) i2vRenderPairs();
  }, 300);
});
if (i2vParseBtn) i2vParseBtn.addEventListener('click', i2vRenderPairs);
i2vRunBtn.addEventListener('click', runImg2Vid);
i2vStopBtn.addEventListener('click', () => { i2vStopReq = true; i2vStopBtn.disabled = true; });
i2vResetBtn.addEventListener('click', () => {
  i2vPairs = [];
  i2vPairsEl.innerHTML = '';
  const i2vQueueCount = $('i2v-queue-count');
  if (i2vQueueCount) i2vQueueCount.textContent = '0';
  [i2vOptions, i2vDurCard, i2vToggleOpts, i2vBtnRow].forEach(el => { if (el) el.style.display = 'none'; });
  i2vProgressWrap.classList.remove('show');
  i2vLogEl.innerHTML = '';
  i2vGuardBanner.classList.remove('show');
  i2vParseInfo.textContent = 'Nhập prompt, cách 1 dòng để tự tạo scene tiếp theo ↓';
  i2vSetStep(1);
});

// Settings
[delayInput, timeoutInput].forEach(el => el.addEventListener('change', saveSettings));
[autoSubmit, autoDownload, waitGenerate, imgAutoDL, imgWaitGen, i2vAutoDL, i2vWaitGen,
 sfAutoDL, sfChaining, sfWaitGen].forEach(el => el.addEventListener('change', saveSettings));
[sfDelayInput, sfTimeoutInput].forEach(el => el.addEventListener('change', saveSettings));
clearDlBtn.addEventListener('click', () => { downloadHistory = []; renderDownloads(); });

// Short Film
sfRunBtn.addEventListener('click', runShortFilm);
sfStopBtn.addEventListener('click', () => { sfStopReq = true; sfStopBtn.disabled = true; });
sfResetBtn.addEventListener('click', () => {
  sfScenes.forEach(s => { s.status = 'idle'; s.genFrameDataUrl = null; sfSetSceneStatus(s.id, 'idle'); });
  sfProgWrap.classList.remove('show'); sfLogEl.innerHTML = '';
  sfExportCard.classList.remove('show'); sfGuardBanner.classList.remove('show');
  setStatus('Reset xong', 'orange'); saveScenes();
});
$('sf-collapse-all-btn').addEventListener('click', () => {
  const bodies = document.querySelectorAll('.sf-scene-card .sf-scene-body');
  const anyVisible = Array.from(bodies).some(b => !b.classList.contains('collapsed'));
  bodies.forEach(b => b.classList.toggle('collapsed', anyVisible));
});
$('sf-clear-all-btn').addEventListener('click', () => {
  if (sfScenes.length && !confirm(`Xóa tất cả ${sfScenes.length} cảnh?`)) return;
  sfScenes = []; sfSceneList.innerHTML = ''; sfUpdateSceneCount();
  sfExportCard.classList.remove('show'); sfGuardBanner.classList.remove('show'); saveScenes();
});
$('sf-add-scene-btn').addEventListener('click', () => {
  if (sfScenes.length >= 20) { alert('Tối đa 20 cảnh!'); return; }
  sfAddScene(); $(`sf-scene-${sfScenes[sfScenes.length-1].id}`)?.scrollIntoView({ behavior:'smooth' });
});

// ── SETTINGS SAVE / LOAD ──────────────────────────────────────────────────────
function saveSettings() {
  chrome.storage.local.set({
    savedDelay: delayInput.value,
    savedTimeout: timeoutInput.value,
    savedAutoSubmit: autoSubmit.checked,
    savedAutoDL: autoDownload.checked,
    savedWaitGen: waitGenerate.checked,
    savedImgAutoDL: imgAutoDL.checked,
    savedImgWaitGen: imgWaitGen.checked,
    savedImgOutputCount: imgOutputCount,
    savedI2vAutoDL: i2vAutoDL.checked,
    savedI2vWaitGen: i2vWaitGen.checked,
    savedRatio: selectedRatio,
    savedImgRatio: imgSelectedRatio,
    savedResolution: selectedResolution,
    savedDuration: selectedDuration,
    sfDelay: sfDelayInput.value,
    sfTimeout: sfTimeoutInput.value,
    sfAutoDLSetting: sfAutoDL.checked,
    sfChainingSetting: sfChaining.checked,
    sfWaitGenSetting: sfWaitGen.checked,
  });
}

function applyRatioPill(containerId, value) {
  const c = $(containerId);
  if (!c) return;
  c.querySelectorAll('.ratio-pill').forEach(p => p.classList.toggle('active', p.dataset.ratio === value));
}
function applyDurBtn(containerId, value) {
  const c = $(containerId);
  if (!c) return;
  c.querySelectorAll('.dur-btn').forEach(b => b.classList.toggle('active', b.dataset.dur === value));
}

// ── INIT ──────────────────────────────────────────────────────────────────────
function durationToPillValue(duration) {
  return normalizeFilmDurationSetting(duration) === '10s' ? '10' : '5';
}

function activateSettingPill(containerId, value) {
  const c = $(containerId);
  if (!c) return;
  const normalizedValue = containerId === 'set-default-dur-pills' ? durationToPillValue(value) : value;
  c.querySelectorAll('.set-pill,.ratio-pill').forEach(p => {
    const pVal = p.dataset.val || p.dataset.ratio;
    p.classList.toggle('active', pVal === normalizedValue || pVal === value);
  });
}

function storageSetAsync(payload) {
  return new Promise(resolve => chrome.storage.local.set(payload, resolve));
}

async function saveGlobalSettings() {
  const ratio = globalSettingsDraft.ratio || DEFAULT_GLOBAL_SETTINGS.ratio;
  const resolution = globalSettingsDraft.resolution || DEFAULT_GLOBAL_SETTINGS.resolution;
  const duration = normalizeFilmDurationSetting(globalSettingsDraft.duration || DEFAULT_GLOBAL_SETTINGS.duration);

  globalSettingsDraft = { ratio, resolution, duration };
  selectedRatio = ratio;
  imgSelectedRatio = ratio;
  selectedResolution = resolution;
  selectedDuration = duration;

  await storageSetAsync({
    savedRatio: ratio,
    setDefaultRatio: ratio,
    savedResolution: resolution,
    savedVideoResolution: resolution,
    setDlVideoQual: resolution,
    savedDuration: duration,
    setDefaultDur: duration,
    savedImgRatio: ratio,
  });

  applyRatioPill('ratio-pills', ratio);
  applyRatioPill('img-ratio-pills', ratio);
  applyRatioPill('set-default-ratio-pills', ratio);
  activateSettingPill('set-dl-video-qual-pills', resolution);
  activateSettingPill('set-default-dur-pills', duration);
  setStatus('Đã lưu Global Settings ✓', 'green');
}

async function resetGlobalSettingsToDefault() {
  globalSettingsDraft = { ...DEFAULT_GLOBAL_SETTINGS };
  applyRatioPill('set-default-ratio-pills', DEFAULT_GLOBAL_SETTINGS.ratio);
  activateSettingPill('set-dl-video-qual-pills', DEFAULT_GLOBAL_SETTINGS.resolution);
  activateSettingPill('set-default-dur-pills', DEFAULT_GLOBAL_SETTINGS.duration);
  await saveGlobalSettings();
  setStatus('Đã khôi phục mặc định ✓', 'green');
}

chrome.storage.local.get([
  'savedPrompts', 'savedImgPrompts', 'savedI2vPrompts',
  'savedDelay', 'savedTimeout',
  'savedAutoSubmit', 'savedAutoDL', 'savedWaitGen',
  'savedImgAutoDL', 'savedImgWaitGen', 'savedImgOutputCount',
  'savedI2vAutoDL', 'savedI2vWaitGen',
  'savedRatio', 'setDefaultRatio', 'savedImgRatio', 'savedResolution', 'savedVideoResolution', 'savedDuration', 'setDlVideoQual', 'setDefaultDur',
  'sfCharacters', 'sfCharIdCounter', 'sfWorld', 'sfStyle', 'sfScenes', 'sfSceneIdCounter',
  'sfDelay', 'sfTimeout', 'sfAutoDLSetting', 'sfChainingSetting', 'sfWaitGenSetting',
], data => {
  if (data.savedPrompts) promptsInput.value = data.savedPrompts;
  if (data.savedImgPrompts) imgPromptsInput.value = data.savedImgPrompts;
  if (data.savedI2vPrompts) { i2vTextarea.value = data.savedI2vPrompts; i2vUpdateCount(); }

  if (data.savedDelay) delayInput.value = data.savedDelay;
  if (data.savedTimeout) timeoutInput.value = data.savedTimeout;

  if (data.savedAutoSubmit !== undefined) autoSubmit.checked = data.savedAutoSubmit;
  if (data.savedAutoDL !== undefined) autoDownload.checked = data.savedAutoDL;
  if (data.savedWaitGen !== undefined) waitGenerate.checked = data.savedWaitGen;
  if (data.savedImgAutoDL !== undefined) imgAutoDL.checked = data.savedImgAutoDL;
  if (data.savedImgWaitGen !== undefined) imgWaitGen.checked = data.savedImgWaitGen;
  imgOutputCount = normalizeImgOutputCount(data.savedImgOutputCount || imgOutputCount);
  if (imgOutputCountEl) imgOutputCountEl.value = String(imgOutputCount);
  if (data.savedI2vAutoDL !== undefined) i2vAutoDL.checked = data.savedI2vAutoDL;
  if (data.savedI2vWaitGen !== undefined) i2vWaitGen.checked = data.savedI2vWaitGen;

  globalSettingsDraft = {
    ratio: data.savedRatio || data.setDefaultRatio || selectedRatio || DEFAULT_GLOBAL_SETTINGS.ratio,
    resolution: data.savedResolution || data.savedVideoResolution || data.setDlVideoQual || selectedResolution || DEFAULT_GLOBAL_SETTINGS.resolution,
    duration: normalizeFilmDurationSetting(data.savedDuration || data.setDefaultDur || selectedDuration || DEFAULT_GLOBAL_SETTINGS.duration),
  };

  if (globalSettingsDraft.ratio) {
    selectedRatio = globalSettingsDraft.ratio;
    applyRatioPill('ratio-pills', selectedRatio);
    applyRatioPill('set-default-ratio-pills', globalSettingsDraft.ratio);
  }
  if (data.savedImgRatio) { imgSelectedRatio = data.savedImgRatio; applyRatioPill('img-ratio-pills', imgSelectedRatio); }
  selectedResolution = globalSettingsDraft.resolution;
  selectedDuration = globalSettingsDraft.duration;
  activateSettingPill('set-dl-video-qual-pills', globalSettingsDraft.resolution);
  activateSettingPill('set-default-dur-pills', globalSettingsDraft.duration);

  if (data.sfCharacters?.length) {
    sfCharIdCounter = data.sfCharIdCounter || data.sfCharacters.length;
    data.sfCharacters.forEach(ch => sfAddCharacter(ch));
  }
  if (data.sfWorld) sfWorldEl.value = data.sfWorld;
  if (data.sfStyle) sfStyleEl.value = data.sfStyle;
  updateAnchorPreview();

  if (data.sfDelay)   sfDelayInput.value   = data.sfDelay;
  if (data.sfTimeout) sfTimeoutInput.value = data.sfTimeout;
  if (data.sfAutoDLSetting   !== undefined) sfAutoDL.checked   = data.sfAutoDLSetting;
  if (data.sfChainingSetting !== undefined) sfChaining.checked  = data.sfChainingSetting;
  if (data.sfWaitGenSetting  !== undefined) sfWaitGen.checked   = data.sfWaitGenSetting;

  if (data.sfScenes?.length) {
    sfSceneIdCounter = data.sfSceneIdCounter || data.sfScenes.length;
    data.sfScenes.forEach(s => { sfScenes.push(s); renderSceneCard(s, sfScenes.length-1); });
    sfUpdateSceneCount();
  }

  const vp = parsePrompts(promptsInput.value);
  countDisplay.textContent = vp.length;
  charCount.textContent = promptsInput.value.length + ' ký tự';
  renderTxtQueue();

  const ip = parseImagePrompts(imgPromptsInput.value);
  imgCountDisplay.textContent = ip.length;
  imgCharCount.textContent = imgPromptsInput.value.length + ' ký tự';
  renderImgQueue();
});

checkTab();
renderDownloads();

// ═══════════════════════════════════════════════════════════════════════════════
// GROK GUARD OVERLAY
// ═══════════════════════════════════════════════════════════════════════════════
(function initGrokGuard() {
  const overlay = document.getElementById('grok-guard-overlay');
  const gotoBtn = document.getElementById('ggo-goto-btn');
  if (!overlay || !gotoBtn) return;

  async function getActivePageState() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return getGrokPageState(tab);
    } catch { return 'not-grok'; }
  }

  async function isBottomComposerReady(tabId) {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const isVisible = (el) => {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            const st = window.getComputedStyle(el);
            return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
          };
          const isBlocked = (el) => !!el?.closest?.('[role="dialog"],[class*="modal" i],[class*="template" i],[class*="overlay" i]');
          const inputSelectors = [
            'textarea[placeholder*="Type to imagine" i]',
            'textarea[placeholder*="Imagine" i]',
            'textarea[placeholder*="Describe" i]',
            'textarea[placeholder*="Enter" i]',
            'div[contenteditable="true"][data-lexical-editor]',
            'div[contenteditable="true"]',
            'textarea',
          ].join(',');
          return Array.from(document.querySelectorAll(inputSelectors)).some(input => {
            if (!isVisible(input) || isBlocked(input)) return false;
            const root = input.closest('form') || input.closest('[data-testid*="composer" i],[class*="composer" i]');
            const inputRect = input.getBoundingClientRect();
            const rootRect = root?.getBoundingClientRect?.() || inputRect;
            return !isBlocked(root || input) && (inputRect.top > window.innerHeight * 0.50 || rootRect.bottom > window.innerHeight * 0.75);
          });
        },
      });
      return result?.[0]?.result === true;
    } catch { return false; }
  }

  async function updateOverlay() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const state = await getActivePageState();
    overlay.classList.toggle('show', state === 'not-grok');
    if (state === 'imagine-template') {
      setStatus('Grok Template — không phải Imagine composer', 'orange');
    } else if (state === 'imagine-post' && tab?.id && await isBottomComposerReady(tab.id)) {
      setStatus('Grok Post — có thể tiếp tục Film', 'green');
    } else if (state === 'imagine-post') {
      setStatus('Grok Post — đang tìm composer', 'orange');
    } else if (state === 'imagine-composer' && tab?.id && await isBottomComposerReady(tab.id)) {
      setStatus('Imagine Composer ✓', 'green');
    } else if (state === 'imagine-composer') {
      setStatus('Imagine đang tải composer...', 'orange');
    } else if (state === 'not-grok') {
      setStatus('Không ở trang Grok', 'orange');
    } else {
      setStatus('Grok — không phải Imagine composer', 'orange');
    }
  }

  // Điều hướng đến Grok khi bấm nút
  gotoBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) await chrome.tabs.update(tab.id, { url: 'https://grok.com/imagine' });
      else     await chrome.tabs.create({ url: 'https://grok.com/imagine' });
    } catch { await chrome.tabs.create({ url: 'https://grok.com/imagine' }); }
    // Chờ tab load rồi kiểm tra lại
    setTimeout(updateOverlay, 2000);
  });

  // Kiểm tra mỗi 1.5s
  updateOverlay();
  setInterval(updateOverlay, 1500);

  // Phản ứng ngay khi user chuyển tab hoặc tab load xong
  chrome.tabs.onActivated.addListener(() => setTimeout(updateOverlay, 500));
  chrome.tabs.onUpdated.addListener((_id, info) => {
    if (info.status === 'complete') setTimeout(updateOverlay, 500);
  });
})();

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS TAB LOGIC
// ═══════════════════════════════════════════════════════════════════════════════
(function initSettingsTab() {

  // ── Helpers ────────────────────────────────────────────────────────────────
  function makePillGroup(containerId, storageKey, onChange, options = {}) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.querySelectorAll('.set-pill,.ratio-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        c.querySelectorAll('.set-pill,.ratio-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const val = pill.dataset.val || pill.dataset.ratio;
        if (options.saveOnClick !== false) chrome.storage.local.set({ [storageKey]: val });
        if (onChange) onChange(val);
      });
    });
  }

  function activatePill(containerId, val) {
    const c = document.getElementById(containerId);
    if (!c) return;
    const normalizedVal = containerId === 'set-default-dur-pills' ? durationToPillValue(val) : val;
    c.querySelectorAll('.set-pill,.ratio-pill').forEach(p => {
      const pVal = p.dataset.val || p.dataset.ratio;
      p.classList.toggle('active', pVal === normalizedVal || pVal === val);
    });
  }

  // ── Mô hình hình ảnh ───────────────────────────────────────────────────────
  makePillGroup('set-img-model-pills', 'setImgModel', val => {
    // Áp dụng model lên Grok khi user chọn (inject click vào Grok page)
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab) return;
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (model) => {
          const keywords = model === 'quality'
            ? ['quality', 'chất lượng', 'high quality', 'best']
            : ['speed', 'fast', 'tốc độ', 'quick'];
          const btns = Array.from(document.querySelectorAll('button,[role="button"],[role="radio"]'));
          for (const btn of btns) {
            const txt = (btn.textContent || '').toLowerCase();
            if (keywords.some(k => txt.includes(k))) {
              const r = btn.getBoundingClientRect();
              if (r.width > 0) { btn.click(); break; }
            }
          }
        },
        args: [val],
      }).catch(() => {});
    });
  });

  // ── Tỷ lệ khung hình mặc định ─────────────────────────────────────────────
  makePillGroup('set-default-ratio-pills', 'setDefaultRatio', val => {
    // Cập nhật tất cả ratio pill trong các tab khác
    globalSettingsDraft.ratio = val;
  }, { saveOnClick: false });

  // ── Tùy chọn video mặc định ───────────────────────────────────────────────
  makePillGroup('set-default-dur-pills', 'setDefaultDur', val => {
    globalSettingsDraft.duration = normalizeFilmDurationSetting(val);
  }, { saveOnClick: false });

  // ── Số lần thử tối đa ─────────────────────────────────────────────────────
  let maxRetries = 5;
  const retryValEl  = document.getElementById('set-retry-val');
  const retryMinus  = document.getElementById('set-retry-minus');
  const retryPlus   = document.getElementById('set-retry-plus');

  function updateRetryDisplay() {
    if (retryValEl) retryValEl.textContent = maxRetries;
  }
  retryMinus?.addEventListener('click', () => {
    if (maxRetries > 1) { maxRetries--; updateRetryDisplay(); chrome.storage.local.set({ setMaxRetries: maxRetries }); }
  });
  retryPlus?.addEventListener('click', () => {
    if (maxRetries < 20) { maxRetries++; updateRetryDisplay(); chrome.storage.local.set({ setMaxRetries: maxRetries }); }
  });

  // ── Chất lượng tải xuống ─────────────────────────────────────────────────
  makePillGroup('set-dl-video-qual-pills', 'setDlVideoQual', val => {
    globalSettingsDraft.resolution = val;
  }, { saveOnClick: false });
  makePillGroup('set-dl-img-qual-pills',   'setDlImgQual',   () => {});
  document.getElementById('set-save-global-btn')?.addEventListener('click', saveGlobalSettings);
  document.getElementById('set-reset-default-btn')?.addEventListener('click', resetGlobalSettingsToDefault);

  // ── Mở cài đặt tải xuống của trình duyệt ─────────────────────────────────
  document.getElementById('set-open-dl-settings')?.addEventListener('click', async () => {
    // Detect browser: Chrome = chrome://, Edge = edge://, Brave cÅ©ng dùng chrome://
    const ua = navigator.userAgent.toLowerCase();
    let scheme = 'chrome';
    if (ua.includes('edg/') || ua.includes('edge/')) scheme = 'edge';
    else if (ua.includes('firefox')) scheme = 'about:preferences'; // fallback
    const url = scheme === 'about:preferences'
      ? 'about:preferences#general'
      : `${scheme}://settings/downloads`;
    try {
      await chrome.tabs.create({ url });
    } catch {
      // Nếu scheme bị block, mở trang hướng dẫn
      await chrome.tabs.create({ url: 'https://support.google.com/chrome/answer/95759' });
    }
  });

  // ── Load saved settings ────────────────────────────────────────────────────
  chrome.storage.local.get([
    'setImgModel', 'savedRatio', 'setDefaultRatio', 'savedResolution', 'savedVideoResolution', 'setDefaultDur', 'savedDuration',
    'setMaxRetries', 'setDlVideoQual', 'setDlImgQual',
  ], data => {
    if (data.setImgModel)    activatePill('set-img-model-pills',    data.setImgModel);
    globalSettingsDraft = {
      ratio: data.savedRatio || data.setDefaultRatio || globalSettingsDraft.ratio || DEFAULT_GLOBAL_SETTINGS.ratio,
      resolution: data.savedResolution || data.savedVideoResolution || data.setDlVideoQual || globalSettingsDraft.resolution || DEFAULT_GLOBAL_SETTINGS.resolution,
      duration: normalizeFilmDurationSetting(data.savedDuration || data.setDefaultDur || globalSettingsDraft.duration || DEFAULT_GLOBAL_SETTINGS.duration),
    };
    applyRatioPill('set-default-ratio-pills', globalSettingsDraft.ratio);
    activatePill('set-dl-video-qual-pills', globalSettingsDraft.resolution);
    activatePill('set-default-dur-pills', globalSettingsDraft.duration);
    if (data.setMaxRetries)  { maxRetries = data.setMaxRetries; updateRetryDisplay(); }
    if (data.setDlImgQual)   activatePill('set-dl-img-qual-pills',   data.setDlImgQual);
  });

})();

// Expose maxRetries getter for use in runInjector / runShortFilm
function getMaxRetries() {
  return new Promise(resolve => {
    chrome.storage.local.get('setMaxRetries', d => resolve(d.setMaxRetries || 5));
  });
}
function getDlVideoQual() {
  return new Promise(resolve => {
    chrome.storage.local.get('setDlVideoQual', d => resolve(d.setDlVideoQual || '720p'));
  });
}
function getDlImgQual() {
  return new Promise(resolve => {
    chrome.storage.local.get('setDlImgQual', d => resolve(d.setDlImgQual || '1k'));
  });
}


