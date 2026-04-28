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

let downloadHistory = [];
let txtQueue = [];   // [{prompt, state, duration}]
let imgQueue = [];   // [{prompt, state}]
let i2vPairs = [];   // [{prompt, imageFile, imageDataUrl}]

// Ratio/duration selection
let selectedRatio = '9:16';
let imgSelectedRatio = '1:1';
let i2vSelectedRatio = '9:16';
let i2vSelectedDuration = '5';
// (Video tab has per-prompt duration, no global)

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
initRatioPills('i2v-ratio-pills', v => { i2vSelectedRatio = v; });

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
initDurBtns('i2v-dur-btns', v => { i2vSelectedDuration = v; });

// ── HELPERS ───────────────────────────────────────────────────────────────────
// Video prompts: separated by blank line
function parsePrompts(text) {
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
}
// Image prompts: each non-empty line
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── VIDEO QUEUE RENDER ────────────────────────────────────────────────────────
function renderTxtQueue() {
  const prompts = parsePrompts(promptsInput.value);

  if (!isRunning) {
    // Preserve existing duration choices when re-rendering
    const oldDurations = {};
    txtQueue.forEach((item, i) => { oldDurations[item.prompt] = item.duration || '5'; });
    txtQueue = prompts.map(p => ({
      prompt: p,
      state: 'waiting',
      duration: oldDurations[p] || '5'
    }));
  }

  if (!queueListEl) return;
  queueListEl.innerHTML = '';

  if (prompts.length === 0) return;

  txtQueue.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = `q-item ${item.state}`;
    card.id = `q-item-${idx}`;

    const stateMap = {
      waiting: 'Chờ xử lý',
      running: '⏳ Đang chạy',
      success: '✅ Hoàn thành',
      error: '✗ Lỗi',
      timeout: '⏰ Timeout'
    };

    card.innerHTML = `
      <div class="q-item-header">
        <div class="q-item-num">${idx + 1}</div>
        <div class="q-item-status" id="q-status-${idx}">${stateMap[item.state]}</div>
        <div class="q-dur-row">
          <div class="q-dur-mini${item.duration === '5' ? ' active' : ''}" data-dur="5" data-idx="${idx}">5s</div>
          <div class="q-dur-mini${item.duration === '10' ? ' active' : ''}" data-dur="10" data-idx="${idx}">10s</div>
        </div>
      </div>
      <div class="q-item-body">${escapeHtml(item.prompt)}</div>
      <div class="q-prog-bar-bg"><div class="q-prog-bar" id="q-prog-${idx}"></div></div>
    `;
    queueListEl.appendChild(card);

    // Per-prompt duration click handlers
    card.querySelectorAll('.q-dur-mini').forEach(btn => {
      btn.addEventListener('click', () => {
        if (isRunning) return; // lock during run
        const i = parseInt(btn.dataset.idx);
        const dur = btn.dataset.dur;
        txtQueue[i].duration = dur;
        card.querySelectorAll('.q-dur-mini').forEach(b => b.classList.toggle('active', b.dataset.dur === dur));
      });
    });
  });
}

// ── IMAGE QUEUE RENDER ────────────────────────────────────────────────────────
function renderImgQueue() {
  const prompts = parseImagePrompts(imgPromptsInput.value);

  if (!imgIsRunning) {
    imgQueue = prompts.map(p => ({ prompt: p, state: 'waiting' }));
  }

  if (!imgQueueListEl) return;
  imgQueueListEl.innerHTML = '';
  if (prompts.length === 0) return;

  imgQueue.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = `img-item ${item.state}`;
    card.id = `img-item-${idx}`;

    const stateMap = {
      waiting: 'Chờ xử lý',
      running: '⏳ Đang tạo',
      success: '✅ Xong',
      error: '✗ Lỗi',
    };

    card.innerHTML = `
      <div class="img-item-header">
        <div class="img-item-num">${idx + 1}</div>
        <div style="flex:1;min-width:0;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${escapeHtml(item.prompt.length > 60 ? item.prompt.slice(0, 57) + '…' : item.prompt)}
        </div>
        <div class="img-item-status" id="img-status-${idx}">${stateMap[item.state] || item.state}</div>
      </div>
      <div class="img-item-body">${escapeHtml(item.prompt)}</div>
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
      setStatus('Kết nối Grok ✓', 'green'); return tab;
    }
    setStatus('Hãy mở grok.com → Imagine', 'orange'); return null;
  } catch { setStatus('Lỗi kết nối', 'red'); return null; }
}

// ── INJECT ASPECT RATIO ───────────────────────────────────────────────────────
async function injectAspectRatio(tabId, ratio) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (ratio) => {
      const ratioMap = {
        '16:9': ['16:9', '16/9', 'landscape', 'widescreen'],
        '9:16': ['9:16', '9/16', 'portrait', 'vertical', 'shorts'],
        '1:1': ['1:1', 'square', '1/1'],
        '2:3': ['2:3', '2/3'],
        '3:2': ['3:2', '3/2'],
      };
      const keywords = ratioMap[ratio] || [ratio];
      const allBtns = Array.from(document.querySelectorAll('button,[role="button"],[role="radio"],label'));
      for (const btn of allBtns) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        const val = (btn.getAttribute('data-value') || '').toLowerCase();
        const combined = txt + ' ' + aria + ' ' + val;
        if (keywords.some(k => combined.includes(k.toLowerCase()))) {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { btn.click(); return { ok: true }; }
        }
      }
      return { ok: false, reason: 'ratio selector not found' };
    },
    args: [ratio],
  });
  return results?.[0]?.result || { ok: false };
}

// ── NAVIGATE TO IMAGINE → IMAGE MODE ─────────────────────────────────────────
// Grok has mode selector: Image / Video. This ensures we're in Image mode.
async function navigateToImagineImage(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // Step 1: Look for "Imagine" tab/link and click it if we're not already there
      const imagineKeywords = ['imagine', 'sáng tạo'];
      const navLinks = Array.from(document.querySelectorAll('a, button, [role="tab"], [role="link"], nav a, nav button'));
      for (const el of navLinks) {
        const text = (el.textContent || '').trim().toLowerCase();
        const href = (el.getAttribute('href') || '').toLowerCase();
        if (imagineKeywords.some(k => text.includes(k) || href.includes(k))) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            el.click();
            break;
          }
        }
      }

      // Step 2: Find and click "Image" mode button (as opposed to "Video")
      const imageKeywords = ['image', 'ảnh', 'photo', 'picture', 'hình ảnh'];
      const videoKeywords = ['video', 'clip'];
      const modeBtns = Array.from(document.querySelectorAll(
        'button, [role="tab"], [role="radio"], [role="button"], label, a'
      ));

      let imageBtn = null;
      for (const btn of modeBtns) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        const combined = txt + ' ' + aria;
        // Must match "image" but NOT "video" (avoid clicking "image-to-video")
        const isImage = imageKeywords.some(k => combined.includes(k));
        const isVideo = videoKeywords.some(k => combined.includes(k));
        if (isImage && !isVideo) {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            imageBtn = btn;
            break;
          }
        }
      }

      if (imageBtn) {
        imageBtn.click();
        return { ok: true, step: 'image-mode' };
      }

      // If no explicit image mode button found, we may already be in image mode
      return { ok: true, step: 'no-mode-btn', note: 'may already be in image mode' };
    },
  });
  return results?.[0]?.result || { ok: false };
}

// ── INJECT DURATION ───────────────────────────────────────────────────────────
async function injectDuration(tabId, duration) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (dur) => {
      // Try both "5s"/"10s" and "6s" labels (Grok sometimes shows 5 or 6 seconds)
      const keywords = dur === '10'
        ? ['10s', '10 sec', '10sec', '10 second']
        : ['5s', '5 sec', '5sec', '6s', '6 sec', '6sec'];
      const allBtns = Array.from(document.querySelectorAll('button,[role="button"],[role="radio"],label'));
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
    args: [duration],
  });
  return results?.[0]?.result || { ok: false };
}

// ── INJECT TEXT PROMPT ────────────────────────────────────────────────────────
async function injectTextPrompt(tabId, prompt, doSubmit) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (promptText, doSubmit) => {
      const selectors = [
        'textarea[placeholder*="Imagine"]', 'textarea[placeholder*="Describe"]',
        'textarea[placeholder*="Enter"]',
        'div[contenteditable="true"][data-lexical-editor]',
        'div[contenteditable="true"]', 'textarea',
      ];
      let el = null;
      for (const sel of selectors) {
        for (const c of document.querySelectorAll(sel)) {
          const r = c.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { el = c; break; }
        }
        if (el) break;
      }
      if (!el) return { ok: false, error: 'Không tìm thấy hộp nhập prompt' };

      el.focus();
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (setter) setter.call(el, promptText); else el.value = promptText;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        el.innerHTML = '';
        document.execCommand('insertText', false, promptText);
        if (!el.textContent.trim()) {
          el.textContent = promptText;
          el.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
        }
      }

      if (!doSubmit) return { ok: true };

      return new Promise(resolve => {
        let attempts = 0;
        let submitted = false;
        const btnsels = [
          'button[aria-label*="Grok"]', 'button[aria-label*="Send"]',
          'button[aria-label*="Generate"]', 'button[type="submit"]',
          'button[data-testid*="send"]', 'button[data-testid*="submit"]',
        ];
        const tryClick = () => {
          if (submitted) return;
          for (const s of btnsels) {
            const b = document.querySelector(s);
            if (b && !b.disabled) {
              b.click(); submitted = true;
              resolve({ ok: true, method: 'button' }); return;
            }
          }
          if (++attempts >= 20) {
            if (!submitted) {
              el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
              submitted = true;
            }
            resolve({ ok: true, method: 'keydown-fallback' });
          } else {
            setTimeout(tryClick, 150);
          }
        };
        setTimeout(tryClick, 500);
      });
    },
    args: [prompt, doSubmit],
  });
  return results?.[0]?.result || { ok: false, error: 'Không có phản hồi' };
}

// ── INJECT IMAGE FILE ─────────────────────────────────────────────────────────
async function injectImageToPage(tabId, dataUrl, mimeType, fileName) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (dataUrl, mimeType, fileName) => {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: mimeType });

      let fileInput = document.querySelector('input[type="file"][accept*="image"]')
        || document.querySelector('input[type="file"]');

      if (!fileInput) {
        const triggers = [
          'button[aria-label*="image"]', 'button[aria-label*="Image"]',
          'button[aria-label*="upload"]', 'button[aria-label*="attach"]',
          'label[for*="file"]', '[data-testid*="attach"]',
        ];
        for (const s of triggers) {
          const btn = document.querySelector(s);
          if (btn) { btn.click(); await new Promise(r => setTimeout(r, 600)); break; }
        }
        fileInput = document.querySelector('input[type="file"][accept*="image"]')
          || document.querySelector('input[type="file"]');
      }

      if (!fileInput) return { ok: false, error: 'Không tìm thấy input file' };
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      fileInput.dispatchEvent(new Event('input', { bubbles: true }));
      return { ok: true };
    },
    args: [dataUrl, mimeType, fileName],
  });
  return results?.[0]?.result || { ok: false, error: 'Script thất bại' };
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
      // Capture ALL img srcs (no size filter) for a complete baseline.
      // This ensures any image Grok adds to the page — even lazy-loaded ones
      // or ones that haven't painted yet — is correctly identified as "new".
      return Array.from(document.querySelectorAll('img, picture source'))
        .map(el => el.src || el.srcset || '')
        .filter(src => src && !src.startsWith('data:'));
    }
  });
  return new Set(result?.[0]?.result || []);
}

// ── READ GROK REAL PROGRESS ───────────────────────────────────────────────────
// Returns 0-100 if found, null otherwise
async function readGrokProgress(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // Method 1: aria-valuenow on progressbar role
      for (const el of document.querySelectorAll('[role="progressbar"][aria-valuenow]')) {
        const now = parseFloat(el.getAttribute('aria-valuenow'));
        const max = parseFloat(el.getAttribute('aria-valuemax') || '100');
        if (!isNaN(now) && max > 0) return Math.round((now / max) * 100);
      }

      // Method 2: style.width on elements with progress-like class names
      const progClasses = ['progress', 'Progress', 'prog-bar', 'progressBar', 'loading-bar'];
      for (const el of document.querySelectorAll('*')) {
        const cls = typeof el.className === 'string' ? el.className : '';
        if (progClasses.some(c => cls.includes(c))) {
          const w = parseFloat(el.style.width);
          if (!isNaN(w) && w > 0 && w < 100) return w;
        }
      }

      // Method 3: Look for percentage text near spinners
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
          if (m) {
            const v = parseInt(m[1]);
            if (v > 0 && v <= 100) return v;
          }
        }
      }

      // Method 4: Any visible percentage text on page
      const walker2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node2;
      while ((node2 = walker2.nextNode())) {
        const m = node2.nodeValue.trim().match(/^(\d{1,3})%$/);
        if (m) {
          const v = parseInt(m[1]);
          if (v > 5 && v < 100) return v; // skip 0% and 100% noise
        }
      }

      return null;
    }
  });
  return result?.[0]?.result ?? null;
}

// ── WAIT FOR VIDEO GENERATE ───────────────────────────────────────────────────
async function waitForGenerate(tabId, timeoutMs, knownVideoUrls = new Set(), stopFlagFn, progressCallback = null) {
  const pollInterval = 1200;
  const start = Date.now();
  let lastSpinnerTime = Date.now();
  let simulatedPct = 10;

  while (Date.now() - start < timeoutMs) {
    if (stopFlagFn()) return { ok: false, reason: 'stopped' };

    // Read real Grok progress
    const grokPct = await readGrokProgress(tabId);

    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (knownUrlsArr) => {
        const knownUrls = new Set(knownUrlsArr);

        const spinners = Array.from(document.querySelectorAll(
          '[class*="loading"],[class*="spinner"],[class*="generating"],[aria-busy="true"],' +
          '[aria-label*="loading"],[aria-label*="Loading"]'
        )).filter(s => { const r = s.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

        const newVideoUrls = [];
        document.querySelectorAll('video').forEach(v => {
          if (v.src && !knownUrls.has(v.src)) newVideoUrls.push(v.src);
          v.querySelectorAll('source').forEach(s => {
            if (s.src && !knownUrls.has(s.src)) newVideoUrls.push(s.src);
          });
        });

        const genBtns = Array.from(document.querySelectorAll(
          'button[type="submit"],button[aria-label*="Generate"],button[aria-label*="Grok"],button[aria-label*="Send"]'
        )).filter(b => !b.disabled);

        return { spinners: spinners.length, hasNewVideo: newVideoUrls.length > 0, genReady: genBtns.length > 0 };
      },
      args: [[...knownVideoUrls]]
    });

    const r = result?.[0]?.result;
    if (r) {
      if (r.spinners > 0) lastSpinnerTime = Date.now();

      // Update progress bar
      if (progressCallback) {
        if (grokPct !== null) {
          progressCallback(grokPct);
        } else {
          // Simulate smooth progress if Grok doesn't expose it
          const elapsed = Date.now() - start;
          simulatedPct = Math.min(95, 10 + (elapsed / Math.min(timeoutMs, 90000)) * 82);
          progressCallback(simulatedPct);
        }
      }

      if (r.hasNewVideo) return { ok: true };

      const silentMs = Date.now() - lastSpinnerTime;
      if (silentMs > 8000 && r.genReady && (Date.now() - start) > 15000) {
        return { ok: true, reason: 'fallback' };
      }
    }

    await sleep(pollInterval);
  }
  return { ok: false, reason: 'timeout' };
}

// ── WAIT FOR IMAGE GENERATE ───────────────────────────────────────────────────
async function waitForImage(tabId, timeoutMs, knownImageUrls = new Set(), stopFlagFn, progressCallback = null) {
  const pollInterval = 1200;
  const start = Date.now();
  let lastSpinnerTime = Date.now();
  let simulatedPct = 10;
  // Track button state transition: disabled → enabled = generation done
  let btnWasDisabled = false;

  while (Date.now() - start < timeoutMs) {
    if (stopFlagFn()) return { ok: false, reason: 'stopped' };

    const grokPct = await readGrokProgress(tabId);
    const elapsed = Date.now() - start;

    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (knownUrlsArr) => {
        const knownUrls = new Set(knownUrlsArr);

        // Spinner: broaden class selectors
        const spinners = Array.from(document.querySelectorAll(
          '[class*="loading"],[class*="spinner"],[class*="generating"],[aria-busy="true"],[class*="skeleton"],[class*="pending"]'
        )).filter(s => { const r = s.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

        // FIX 1: Detect new images WITHOUT size restriction.
        // BoundingClientRect = 0 for lazy-loaded or off-screen images.
        // We rely solely on "src not in snapshot" as the signal.
        const newImgUrls = Array.from(document.querySelectorAll('img'))
          .map(img => img.currentSrc || img.src)
          .filter(src => src && !knownUrls.has(src) && !src.startsWith('data:') && !src.startsWith('blob:data'));

        // FIX 2: Also detect download links/buttons that appear after generation
        const dlReady = Array.from(document.querySelectorAll(
          'a[download],a[href*=".jpg"],a[href*=".png"],a[href*=".webp"],'
          + 'button[aria-label*="Download"],button[aria-label*="download"]'
        )).some(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

        // Submit button state (for transition tracking)
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

      // Track the disabled → enabled button transition
      if (r.btnDisabled) btnWasDisabled = true;

      // Update progress
      if (progressCallback) {
        if (grokPct !== null) {
          progressCallback(grokPct);
        } else {
          simulatedPct = Math.min(95, 10 + (elapsed / Math.min(timeoutMs, 60000)) * 82);
          progressCallback(simulatedPct);
        }
      }

      // ── Completion signals ────────────────────────────────────────────────

      // Signal 1: New image URLs appeared in DOM
      if (r.newImgUrls.length > 0) {
        return { ok: true, newImgUrls: r.newImgUrls };
      }

      // Signal 2: Download button/link appeared (Grok shows this after generation)
      if (r.dlReady && elapsed > 8000) {
        return { ok: true, reason: 'dl-btn' };
      }

      const silentMs = Date.now() - lastSpinnerTime;

      // Signal 3 (FIX): Button transitioned disabled → enabled.
      // Do NOT require genReady alone — combine with silence to avoid false positives.
      if (btnWasDisabled && r.genReady && silentMs > 3000 && elapsed > 8000) {
        return { ok: true, reason: 'btn-ready' };
      }

      // Signal 4 (FIX): Long silence regardless of button state.
      // If spinners were never detected (class mismatch), lastSpinnerTime ≈ start,
      // so silentMs grows immediately. We gate on elapsed > 20s to avoid early exits.
      if (silentMs > 12000 && elapsed > 20000) {
        return { ok: true, reason: 'silence' };
      }
    }

    await sleep(pollInterval);
  }
  return { ok: false, reason: 'timeout' };
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
        document.querySelectorAll('video').forEach(v => {
          const src = v.src || '';
          if (src && !knownV.has(src)) urls.push({ type: 'video', url: src, ext: 'mp4' });
          v.querySelectorAll('source').forEach(s => {
            if (s.src && !knownV.has(s.src)) urls.push({ type: 'video', url: s.src, ext: 'mp4' });
          });
        });
      }

      if ((mode === 'image' || (mode === 'auto' && urls.length === 0))) {
        // FIX: No size restriction — lazy-loaded or off-screen images have rect=0
        const newImgs = Array.from(document.querySelectorAll('img'))
          .map(img => img.currentSrc || img.src)
          .filter(src => src && !knownI.has(src) && !src.startsWith('data:'));
        newImgs.forEach(src => {
          const ext = src.includes('.png') ? 'png' : src.includes('.webp') ? 'webp' : 'jpg';
          urls.push({ type: 'image', url: src, ext });
        });
      }

      // anchor link fallback
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

      // Take last occurrence only (newest)
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

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO — Main loop
// ─────────────────────────────────────────────────────────────────────────────
async function runInjector() {
  if (isRunning) return;
  const prompts = parsePrompts(promptsInput.value);
  if (prompts.length === 0) { alert('Vui lòng nhập ít nhất 1 prompt!'); return; }

  // Sync queue if needed
  if (!txtQueue.length || txtQueue.length !== prompts.length) {
    txtQueue = prompts.map(p => ({ prompt: p, state: 'waiting', duration: '5' }));
    renderTxtQueue();
  }

  const tab = await checkTab();
  if (!tab) { alert('Hãy mở grok.com → Imagine!'); return; }

  const delay = Math.max(500, parseInt(delayInput.value) || 2000);
  const doSubmit = autoSubmit.checked;
  const doDL = autoDownload.checked;
  const doWait = waitGenerate.checked;
  const tmOut = (parseInt(timeoutInput.value) || 300) * 1000;

  isRunning = true; stopRequested = false;
  runBtn.disabled = true; stopBtn.disabled = false;
  promptsInput.disabled = true;
  logEl.innerHTML = '';
  progressWrap.classList.add('show');
  setProgress(progBar, progLabel, 0, prompts.length);

  // Lock per-prompt duration buttons during run
  document.querySelectorAll('.q-dur-mini').forEach(b => b.classList.add('disabled'));

  let done = 0;
  for (let i = 0; i < prompts.length; i++) {
    if (stopRequested) { addLog(logEl, `⏹ Dừng tại prompt ${i + 1}`, 'warn'); break; }

    const prompt = prompts[i];
    const duration = txtQueue[i]?.duration || '5';
    const short = prompt.length > 55 ? prompt.slice(0, 52) + '…' : prompt;

    setStatus(`⏳ Prompt ${i + 1}/${prompts.length}`, 'orange');
    addLog(logEl, `[${i + 1}/${prompts.length}] ${short}`);

    txtQueue[i].state = 'running';
    const card = $(`q-item-${i}`);
    const stat = $(`q-status-${i}`);
    const pbar = $(`q-prog-${i}`);
    if (card) { card.className = 'q-item running'; card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    if (stat) stat.textContent = '⏳ Đang chạy';
    if (pbar) pbar.style.width = '5%';

    // Snapshot before generate
    const knownVideoUrls = await snapshotVideoUrls(tab.id);

    // Inject ratio + duration
    if (doSubmit) {
      const ratioRes = await injectAspectRatio(tab.id, selectedRatio);
      addLog(logEl, ratioRes.ok ? `  📐 Ratio: ${selectedRatio}` : `  ℹ Ratio: không tìm thấy`, 'info');

      const durRes = await injectDuration(tab.id, duration);
      addLog(logEl, durRes.ok ? `  ⏱ Duration: ${duration}s` : `  ℹ Duration: không tìm thấy`, 'info');

      await sleep(300);
    }

    // Inject prompt
    try {
      const res = await injectTextPrompt(tab.id, prompt, doSubmit);
      if (!res.ok) {
        addLog(logEl, `  ✗ ${res.error}`, 'err');
        txtQueue[i].state = 'error';
        if (card) card.className = 'q-item error';
        if (stat) stat.textContent = '✗ Lỗi';
        if (pbar) pbar.style.width = '0%';
        continue;
      }
      addLog(logEl, `  ✓ Đã submit`, 'ok');
      if (pbar) pbar.style.width = '10%';
    } catch (e) {
      addLog(logEl, `  ✗ ${e.message}`, 'err');
      txtQueue[i].state = 'error';
      if (card) card.className = 'q-item error';
      if (stat) stat.textContent = '✗ Lỗi';
      if (pbar) pbar.style.width = '0%';
      continue;
    }

    if (doWait && doSubmit) {
      setStatus(`⏳ Chờ generate ${i + 1}/${prompts.length}...`, 'orange');
      addLog(logEl, `  ⏳ Chờ Grok generate...`);
      await sleep(2000);

      const gen = await waitForGenerate(tab.id, tmOut, knownVideoUrls,
        () => stopRequested,
        (pct) => { if (pbar) pbar.style.width = pct + '%'; }
      );

      if (gen.ok) {
        if (pbar) pbar.style.width = '100%';
        addLog(logEl, `  ✅ Generate xong!`, 'ok');
        txtQueue[i].state = 'success';
        if (card) card.className = 'q-item success';
        if (stat) stat.textContent = '✅ Hoàn thành';
        if (doDL) {
          const files = await downloadMedia(tab.id, prompt, 'video', knownVideoUrls);
          downloadHistory.push(...files); renderDownloads();
        }
      } else if (gen.reason === 'timeout') {
        if (pbar) pbar.style.width = '100%';
        addLog(logEl, `  ⚠ Timeout vượt giới hạn ${timeoutInput.value}s`, 'warn');
        txtQueue[i].state = 'timeout';
        if (card) card.className = 'q-item error';
        if (stat) stat.textContent = '⏰ Timeout';
      } else if (gen.reason === 'stopped') {
        txtQueue[i].state = 'waiting';
        if (card) card.className = 'q-item waiting';
        if (stat) stat.textContent = 'Chờ xử lý';
        if (pbar) pbar.style.width = '0%';
        break;
      }
    } else {
      if (pbar) pbar.style.width = '100%';
      txtQueue[i].state = 'success';
      if (card) card.className = 'q-item success';
      if (stat) stat.textContent = '✅ Hoàn thành';
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
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE — Main loop
// ─────────────────────────────────────────────────────────────────────────────
async function runImageGenerator() {
  if (imgIsRunning) return;
  const prompts = parseImagePrompts(imgPromptsInput.value);
  if (prompts.length === 0) { alert('Vui lòng nhập ít nhất 1 dòng prompt!'); return; }

  imgQueue = prompts.map(p => ({ prompt: p, state: 'waiting' }));
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

  // ── Step 0: Navigate to Imagine → Image mode ONCE at start ──
  addLog(imgLogEl, '🔄 Chuyển sang Imagine → Image mode...');
  const navRes = await navigateToImagineImage(tab.id);
  if (navRes.ok) {
    addLog(imgLogEl, `  ✓ Đã chuyển sang Image mode (${navRes.step})`, 'ok');
  } else {
    addLog(imgLogEl, '  ⚠ Không tìm thấy Image mode selector, tiếp tục...', 'warn');
  }
  await sleep(800); // Wait for UI transition

  let done = 0;
  for (let i = 0; i < prompts.length; i++) {
    if (imgStopReq) { addLog(imgLogEl, `⏹ Dừng tại ảnh ${i + 1}`, 'warn'); break; }

    const prompt = prompts[i];
    const short = prompt.length > 55 ? prompt.slice(0, 52) + '…' : prompt;

    setStatus(`🖼 Tạo ảnh ${i + 1}/${prompts.length}`, 'orange');
    addLog(imgLogEl, `[${i + 1}/${prompts.length}] ${short}`);

    imgQueue[i].state = 'running';
    const card = $(`img-item-${i}`);
    const stat = $(`img-status-${i}`);
    const pbar = $(`img-prog-${i}`);
    if (card) { card.className = 'img-item running'; card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    if (stat) stat.textContent = '⏳ Đang tạo';
    if (pbar) pbar.style.width = '5%';

    // Snapshot ALL current images before this prompt
    const knownImageUrls = await snapshotImageUrls(tab.id);

    // Re-ensure Image mode is selected (in case Grok resets between prompts)
    if (i > 0) {
      await navigateToImagineImage(tab.id);
      await sleep(400);
    }

    // Inject ratio
    const ratioRes = await injectAspectRatio(tab.id, imgSelectedRatio);
    addLog(imgLogEl, ratioRes.ok ? `  📐 Ratio: ${imgSelectedRatio}` : `  ℹ Ratio: không tìm thấy`, 'info');
    await sleep(200);

    // Inject prompt + submit
    try {
      const res = await injectTextPrompt(tab.id, prompt, true);
      if (!res.ok) {
        addLog(imgLogEl, `  ✗ ${res.error}`, 'err');
        imgQueue[i].state = 'error';
        if (card) card.className = 'img-item error';
        if (stat) stat.textContent = '✗ Lỗi';
        if (pbar) pbar.style.width = '0%';
        continue;
      }
      addLog(imgLogEl, `  ✓ Đã submit`, 'ok');
      if (pbar) pbar.style.width = '10%';
    } catch (e) {
      addLog(imgLogEl, `  ✗ ${e.message}`, 'err');
      imgQueue[i].state = 'error';
      if (card) card.className = 'img-item error';
      if (stat) stat.textContent = '✗ Lỗi';
      if (pbar) pbar.style.width = '0%';
      continue;
    }

    // ── Always wait for image and auto-download ──
    setStatus(`⏳ Chờ ảnh ${i + 1}/${prompts.length}...`, 'orange');
    addLog(imgLogEl, `  ⏳ Chờ Grok tạo ảnh...`);
    await sleep(2000);

    const gen = await waitForImage(tab.id, tmOut, knownImageUrls,
      () => imgStopReq,
      (pct) => { if (pbar) pbar.style.width = pct + '%'; }
    );

    if (gen.ok) {
      if (pbar) pbar.style.width = '100%';
      addLog(imgLogEl, `  ✅ Tạo ảnh xong!`, 'ok');
      imgQueue[i].state = 'success';
      if (card) card.className = 'img-item success';
      if (stat) stat.textContent = '✅ Xong';

      // Auto-download: always download (the toggle controls this at UI level)
      if (imgAutoDL.checked) {
        await sleep(500); // Brief wait for image to fully render
        const files = await downloadMedia(tab.id, prompt, 'image', new Set(), knownImageUrls);
        if (files.length > 0) {
          downloadHistory.push(...files);
          renderDownloads();
        } else {
          addLog(imgLogEl, '  ⚠ Không tải được ảnh (có thể ảnh chưa render)', 'warn');
        }
      }
    } else if (gen.reason === 'timeout') {
      if (pbar) pbar.style.width = '100%';
      addLog(imgLogEl, `  ⚠ Timeout`, 'warn');
      imgQueue[i].state = 'error';
      if (card) card.className = 'img-item error';
      if (stat) stat.textContent = '⏰ Timeout';
    } else if (gen.reason === 'stopped') {
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

function i2vRenderPairs() {
  const prompts = parsePrompts(i2vTextarea.value);
  if (prompts.length === 0) {
    i2vPairsEl.innerHTML = '';
    i2vOptions.style.display = 'none';
    i2vDurCard.style.display = 'none';
    i2vToggleOpts.style.display = 'none';
    i2vBtnRow.style.display = 'none';
    i2vParseInfo.innerHTML = 'Nhập prompt rồi nhấn "Tạo danh sách" ↓';
    i2vSetStep(1); return;
  }

  const existingMap = {};
  i2vPairs.forEach(p => { existingMap[p.prompt] = p; });
  i2vPairs = prompts.map(prompt => {
    const ex = existingMap[prompt];
    return { prompt, imageFile: ex?.imageFile || null, imageDataUrl: ex?.imageDataUrl || null };
  });

  i2vPairsEl.innerHTML = '';
  i2vPairs.forEach((pair, idx) => renderPairCard(pair, idx));

  i2vOptions.style.display = 'block';
  i2vDurCard.style.display = 'block';
  i2vToggleOpts.style.display = 'flex';
  i2vBtnRow.style.display = 'flex';
  i2vParseInfo.innerHTML = `<strong>${prompts.length}</strong> prompt — gán ảnh ↓`;
  i2vGuardBanner.classList.remove('show');
  i2vSetStep(2);
}

function renderPairCard(pair, idx) {
  const card = document.createElement('div');
  card.className = 'i2v-pair';
  card.id = `i2v-pair-${idx}`;
  card.innerHTML = `
    <div class="i2v-pair-header">
      <div class="i2v-pair-num">${idx + 1}</div>
      <div class="i2v-pair-prompt-preview">${escapeHtml(pair.prompt)}</div>
      <span class="i2v-pair-status" id="i2v-pstatus-${idx}">Chờ ảnh</span>
    </div>
    <div class="i2v-pair-body">
      <div class="i2v-upload-zone ${pair.imageDataUrl ? 'has-image' : ''}" id="i2v-zone-${idx}">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" id="i2v-file-${idx}">
        <div class="i2v-upload-icon">🖼</div>
        <div class="i2v-upload-label">Click để<br>chọn ảnh</div>
        <img class="i2v-preview-img" id="i2v-img-${idx}" src="${pair.imageDataUrl || ''}" alt="">
        <button class="i2v-remove-btn" id="i2v-rm-${idx}" title="Xóa ảnh">✕</button>
      </div>
      <div class="i2v-pair-text">${escapeHtml(pair.prompt)}</div>
    </div>
    <div class="i2v-pair-prog-bg"><div class="i2v-pair-prog" id="i2v-pprog-${idx}"></div></div>
    <div class="i2v-pair-error-msg" id="i2v-perr-${idx}"></div>`;
  i2vPairsEl.appendChild(card);

  $(`i2v-file-${idx}`).addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) { showPairError(idx, 'Chỉ chấp nhận file ảnh'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      i2vPairs[idx].imageFile = file;
      i2vPairs[idx].imageDataUrl = ev.target.result;
      $(`i2v-img-${idx}`).src = ev.target.result;
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
    $(`i2v-zone-${idx}`).classList.remove('has-image');
    $(`i2v-file-${idx}`).value = '';
    updatePairStatus(idx, 'waiting');
  });

  if (pair.imageDataUrl) updatePairStatus(idx, 'ready');
}

function updatePairStatus(idx, state) {
  const card = $(`i2v-pair-${idx}`);
  const status = $(`i2v-pstatus-${idx}`);
  if (!card || !status) return;
  card.classList.remove('error', 'success', 'running');
  const map = {
    waiting: ['', 'Chờ ảnh'],
    ready: ['', '✓ Sẵn sàng'],
    running: ['running', '⏳ Đang chạy'],
    success: ['success', '✅ Xong'],
    error: ['error', '✗ Lỗi'],
    timeout: ['error', '⏰ Timeout'],
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

function clearPairError(idx) {
  const card = $(`i2v-pair-${idx}`);
  const errEl = $(`i2v-perr-${idx}`);
  if (card) card.classList.remove('error');
  if (errEl) errEl.textContent = '';
}

function i2vValidate() {
  if (i2vPairs.length === 0) {
    i2vGuardBanner.textContent = '⚠ Hãy nhập prompt và tạo danh sách trước!';
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

// ─────────────────────────────────────────────────────────────────────────────
// IMG2VID — Main run loop
// ─────────────────────────────────────────────────────────────────────────────
async function runImg2Vid() {
  if (i2vIsRunning) return;
  if (!i2vValidate()) return;

  const tab = await checkTab();
  if (!tab) { alert('Hãy mở grok.com → Imagine!'); return; }

  const doDL = i2vAutoDL.checked;
  const doWait = i2vWaitGen.checked;
  const tmOut = (parseInt(timeoutInput.value) || 300) * 1000;
  const delay = Math.max(500, parseInt(delayInput.value) || 2000);

  i2vIsRunning = true; i2vStopReq = false;
  i2vRunBtn.disabled = true; i2vStopBtn.disabled = false;
  i2vLogEl.innerHTML = '';
  i2vProgressWrap.classList.add('show');
  setProgress(i2vProgBar, i2vProgLabel, 0, i2vPairs.length, 'Đã xử lý');
  i2vSetStep(3);

  let done = 0;
  for (let i = 0; i < i2vPairs.length; i++) {
    if (i2vStopReq) { addLog(i2vLogEl, `⏹ Dừng tại cặp ${i + 1}`, 'warn'); break; }

    const pair = i2vPairs[i];
    const short = pair.prompt.length > 45 ? pair.prompt.slice(0, 42) + '…' : pair.prompt;
    const pprog = $(`i2v-pprog-${i}`);

    setStatus(`Img2Vid: cặp ${i + 1}/${i2vPairs.length}`, 'orange');
    addLog(i2vLogEl, `[${i + 1}/${i2vPairs.length}] ${short}`);
    updatePairStatus(i, 'running');
    const pcard = $(`i2v-pair-${i}`);
    if (pcard) pcard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (pprog) pprog.style.width = '5%';

    // Inject ratio + duration
    await injectAspectRatio(tab.id, i2vSelectedRatio);
    await injectDuration(tab.id, i2vSelectedDuration);
    addLog(i2vLogEl, `  📐 ${i2vSelectedRatio}  ⏱ ${i2vSelectedDuration}s`, 'info');
    await sleep(200);

    // Inject image
    addLog(i2vLogEl, `  🖼 Gán ảnh: ${pair.imageFile?.name || 'ảnh'}`);
    if (pprog) pprog.style.width = '10%';
    try {
      const imgRes = await injectImageToPage(
        tab.id, pair.imageDataUrl,
        pair.imageFile?.type || 'image/jpeg',
        pair.imageFile?.name || `img_${i + 1}.jpg`
      );
      if (!imgRes.ok) {
        addLog(i2vLogEl, `  ✗ ${imgRes.error}`, 'err');
        showPairError(i, imgRes.error); if (pprog) pprog.style.width = '0%'; continue;
      }
      addLog(i2vLogEl, `  ✓ Ảnh đã gán`, 'ok');
    } catch (e) {
      addLog(i2vLogEl, `  ✗ ${e.message}`, 'err');
      showPairError(i, e.message); if (pprog) pprog.style.width = '0%'; continue;
    }

    await sleep(800);
    if (pprog) pprog.style.width = '15%';

    const knownVideoUrls = await snapshotVideoUrls(tab.id);

    // Inject prompt
    addLog(i2vLogEl, `  ✍ Gán prompt...`);
    try {
      const txtRes = await injectTextPrompt(tab.id, pair.prompt, true);
      if (!txtRes.ok) {
        addLog(i2vLogEl, `  ✗ ${txtRes.error}`, 'err');
        showPairError(i, txtRes.error); if (pprog) pprog.style.width = '0%'; continue;
      }
      addLog(i2vLogEl, `  ✓ Đã submit`, 'ok');
      if (pprog) pprog.style.width = '20%';
    } catch (e) {
      addLog(i2vLogEl, `  ✗ ${e.message}`, 'err');
      showPairError(i, e.message); if (pprog) pprog.style.width = '0%'; continue;
    }

    if (doWait) {
      setStatus(`⏳ Chờ generate cặp ${i + 1}...`, 'orange');
      addLog(i2vLogEl, `  ⏳ Chờ Grok generate video...`);
      await sleep(2000);

      const gen = await waitForGenerate(tab.id, tmOut, knownVideoUrls,
        () => i2vStopReq,
        (pct) => { if (pprog) pprog.style.width = pct + '%'; }
      );

      if (gen.ok) {
        if (pprog) pprog.style.width = '100%';
        addLog(i2vLogEl, `  ✅ Generate xong!`, 'ok');
        updatePairStatus(i, 'success');
        if (doDL) {
          const files = await downloadMedia(tab.id, pair.prompt, 'video', knownVideoUrls);
          downloadHistory.push(...files); renderDownloads();
        }
      } else if (gen.reason === 'timeout') {
        if (pprog) pprog.style.width = '100%';
        addLog(i2vLogEl, `  ⚠ Timeout`, 'warn');
        updatePairStatus(i, 'timeout');
      } else if (gen.reason === 'stopped') {
        updatePairStatus(i, 'waiting');
        if (pprog) pprog.style.width = '0%'; break;
      }
    } else {
      if (pprog) pprog.style.width = '100%';
      updatePairStatus(i, 'success');
    }

    done++;
    setProgress(i2vProgBar, i2vProgLabel, done, i2vPairs.length, 'Đã xử lý');
    if (i < i2vPairs.length - 1 && !i2vStopReq) { setStatus(`⏱ Chờ ${delay}ms...`, 'orange'); await sleep(delay); }
  }

  i2vIsRunning = false;
  i2vRunBtn.disabled = false; i2vStopBtn.disabled = true;
  const allOk = done === i2vPairs.length;
  setStatus(allOk ? `✓ Img2Vid xong ${done} cặp` : `Img2Vid: ${done}/${i2vPairs.length}`, allOk ? 'green' : 'orange');
  addLog(i2vLogEl, `── Hoàn tất: ${done}/${i2vPairs.length} ──`, allOk ? 'ok' : 'warn');
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
imgClearBtn.addEventListener('click', () => {
  imgPromptsInput.value = '';
  imgCountDisplay.textContent = '0';
  imgCharCount.textContent = '0 ký tự';
  imgLogEl.innerHTML = '';
  imgProgressWrap.classList.remove('show');
  imgQueue = []; renderImgQueue();
});

// Img2Vid
i2vTextarea.addEventListener('input', () => {
  i2vUpdateCount();
  chrome.storage.local.set({ savedI2vPrompts: i2vTextarea.value });
});
i2vParseBtn.addEventListener('click', i2vRenderPairs);
i2vRunBtn.addEventListener('click', runImg2Vid);
i2vStopBtn.addEventListener('click', () => { i2vStopReq = true; i2vStopBtn.disabled = true; });
i2vResetBtn.addEventListener('click', () => {
  i2vPairs = [];
  i2vPairsEl.innerHTML = '';
  [i2vOptions, i2vDurCard, i2vToggleOpts, i2vBtnRow].forEach(el => el.style.display = 'none');
  i2vProgressWrap.classList.remove('show');
  i2vLogEl.innerHTML = '';
  i2vGuardBanner.classList.remove('show');
  i2vParseInfo.textContent = 'Nhập prompt rồi nhấn "Tạo danh sách" ↓';
  i2vSetStep(1);
});

// Settings
[delayInput, timeoutInput].forEach(el => el.addEventListener('change', saveSettings));
[autoSubmit, autoDownload, waitGenerate, imgAutoDL, imgWaitGen, i2vAutoDL, i2vWaitGen]
  .forEach(el => el.addEventListener('change', saveSettings));
clearDlBtn.addEventListener('click', () => { downloadHistory = []; renderDownloads(); });

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
    savedI2vAutoDL: i2vAutoDL.checked,
    savedI2vWaitGen: i2vWaitGen.checked,
    savedRatio: selectedRatio,
    savedImgRatio: imgSelectedRatio,
    savedI2vRatio: i2vSelectedRatio,
    savedI2vDuration: i2vSelectedDuration,
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
chrome.storage.local.get([
  'savedPrompts', 'savedImgPrompts', 'savedI2vPrompts',
  'savedDelay', 'savedTimeout',
  'savedAutoSubmit', 'savedAutoDL', 'savedWaitGen',
  'savedImgAutoDL', 'savedImgWaitGen',
  'savedI2vAutoDL', 'savedI2vWaitGen',
  'savedRatio', 'savedImgRatio', 'savedI2vRatio', 'savedI2vDuration',
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
  if (data.savedI2vAutoDL !== undefined) i2vAutoDL.checked = data.savedI2vAutoDL;
  if (data.savedI2vWaitGen !== undefined) i2vWaitGen.checked = data.savedI2vWaitGen;

  if (data.savedRatio) { selectedRatio = data.savedRatio; applyRatioPill('ratio-pills', selectedRatio); }
  if (data.savedImgRatio) { imgSelectedRatio = data.savedImgRatio; applyRatioPill('img-ratio-pills', imgSelectedRatio); }
  if (data.savedI2vRatio) { i2vSelectedRatio = data.savedI2vRatio; applyRatioPill('i2v-ratio-pills', i2vSelectedRatio); }
  if (data.savedI2vDuration) { i2vSelectedDuration = data.savedI2vDuration; applyDurBtn('i2v-dur-btns', i2vSelectedDuration); }

  // Update counts
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
