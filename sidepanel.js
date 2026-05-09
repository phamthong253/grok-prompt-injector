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
      console.log('[GPI] injectTextPrompt START', { doSubmit, promptLen: promptText.length });
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
          if (r.width > 0 && r.height > 0) {
            console.log('[GPI] Found input:', sel, c.tagName, `${r.width}x${r.height}`);
            el = c; break;
          }
        }
        if (el) break;
      }
      if (!el) { console.error('[GPI] ❌ No input found!'); return { ok: false, error: 'Không tìm thấy hộp nhập prompt' }; }

      el.focus();
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        console.log('[GPI] Using TEXTAREA setter');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (setter) setter.call(el, promptText); else el.value = promptText;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        console.log('[GPI] Using contenteditable insertText');
        el.innerHTML = '';
        document.execCommand('insertText', false, promptText);
        if (!el.textContent.trim()) {
          el.textContent = promptText;
          el.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
        }
      }
      console.log('[GPI] Text injected, content length:', el.textContent?.length || el.value?.length);

      if (!doSubmit) { console.log('[GPI] doSubmit=false, returning'); return { ok: true }; }

      console.log('[GPI] Starting submit button search...');
      return new Promise(resolve => {
        let attempts = 0;
        let submitted = false;
        const tryClick = () => {
          if (submitted) return;
          attempts++;
          console.log(`[GPI] Submit attempt #${attempts}`);

          // 1. Try aria-label selectors (legacy Grok versions)
          const btnsels = [
            'button[aria-label*="Grok"]', 'button[aria-label*="Send"]',
            'button[aria-label*="Generate"]', 'button[type="submit"]',
            'button[data-testid*="send"]', 'button[data-testid*="submit"]',
          ];
          for (const s of btnsels) {
            const b = document.querySelector(s);
            if (b) console.log(`[GPI]   aria sel "${s}": found, disabled=${b.disabled}`);
            if (b && !b.disabled) {
              console.log('[GPI] ✅ CLICK aria-button:', s);
              b.click(); submitted = true;
              resolve({ ok: true, method: 'aria-button', sel: s }); return;
            }
          }
          // 2. Find submit button inside form — target bottom-right action bar (Grok 2025)
          const rootForm = el.closest('form');
          const allForms = Array.from(document.querySelectorAll('form'));
          const forms = rootForm ? [rootForm, ...allForms.filter(f => f !== rootForm)] : allForms;
          console.log(`[GPI]   forms found: ${forms.length}, rootFirst=${!!rootForm}`);
          for (const form of forms) {
            // Target specifically the bottom-right absolute div (exact Grok layout)
            const allAbsDivs = Array.from(form.querySelectorAll('div.absolute'));
            const bottomRightDivs = allAbsDivs.filter(d => {
              const cls = d.className || '';
              return cls.includes('right-') && cls.includes('bottom-');
            });
            console.log(`[GPI]   bottomRightDivs: ${bottomRightDivs.length}`);
            for (const div of bottomRightDivs) {
              const btns = Array.from(div.querySelectorAll('button'));
              // Take the LAST enabled SVG button (send is always rightmost)
              for (let k = btns.length - 1; k >= 0; k--) {
                const b = btns[k];
                const hasSvg = !!b.querySelector('svg');
                console.log(`[GPI]     btn[${k}] disabled=${b.disabled} hasSvg=${hasSvg} class="${b.className.slice(0,50)}"`);
                if (!b.disabled && hasSvg) {
                  console.log('[GPI] ✅ CLICK bottom-right-last-svg');
                  b.click(); submitted = true;
                  resolve({ ok: true, method: 'bottom-right-btn' }); return;
                }
              }
            }
            // Fallback: last enabled SVG button in any absolute div
            const allSvgBtns = Array.from(form.querySelectorAll('div.absolute button'))
              .filter(b => !b.disabled && b.querySelector('svg'));
            console.log(`[GPI]   allSvgBtns (enabled): ${allSvgBtns.length}`);
            if (allSvgBtns.length > 0) {
              const btn = allSvgBtns[allSvgBtns.length - 1];
              console.log('[GPI] ✅ CLICK last-svg-btn:', btn.className.slice(0,50));
              btn.click(); submitted = true;
              resolve({ ok: true, method: 'last-svg-btn' }); return;
            }
          }

          // 3. Last resort: Enter key
          if (attempts >= 15) {
            console.log('[GPI] ⚠ Max attempts reached, using Enter key fallback');
            if (!submitted) {
              el.focus();
              el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
              el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
              submitted = true;
            }
            resolve({ ok: true, method: 'enter-fallback' });
          } else {
          if (msgState) msgState.status = 'downloaded';
            setTimeout(tryClick, 200);
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
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (dataUrl, mimeType, fileName, options) => {
      console.log('[GPI] injectImageToPage START', { fileName, mimeType, dataUrlLen: dataUrl?.length });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: mimeType });
      console.log('[GPI] File created:', file.name, file.size, 'bytes');

      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };

      const findComposerRoot = () => {
        const promptNodes = Array.from(document.querySelectorAll(
          'textarea[placeholder*="Imagine" i],textarea[placeholder*="Describe" i],textarea[placeholder*="Enter" i],div[contenteditable="true"][data-lexical-editor],div[contenteditable="true"]'
        )).filter(visible);
        const active = promptNodes[0] || document.activeElement;
        return active ? (active.closest('form') || active.closest('[data-testid*="composer" i],[class*="composer" i]') || document.body) : document.body;
      };

      const pickFileInput = () => {
        const all = Array.from(document.querySelectorAll('input[type="file"]'));
        const imageOnly = all.filter(i => (i.accept || '').toLowerCase().includes('image'));
        const pool = imageOnly.length ? imageOnly : all;
        if (!pool.length) return null;

        if (options && options.preferComposer) {
          const root = findComposerRoot();
          const inRoot = pool.filter(i => root.contains(i));
          if (inRoot.length) return inRoot[inRoot.length - 1];
        }

        const visibleFirst = pool.find(visible);
        return visibleFirst || pool[pool.length - 1];
      };

      let fileInput = pickFileInput();
      console.log('[GPI] fileInput found (initial):', !!fileInput, fileInput?.accept, 'preferComposer=', !!options?.preferComposer);

      if (!fileInput) {
        console.log('[GPI] No file input, trying trigger buttons...');
        const triggers = [
          'button[aria-label*="image"]', 'button[aria-label*="Image"]',
          'button[aria-label*="upload"]', 'button[aria-label*="attach"]',
          'label[for*="file"]', '[data-testid*="attach"]',
        ];
        for (const s of triggers) {
          const btn = document.querySelector(s);
          if (btn) {
            console.log('[GPI] Trigger clicked:', s);
            btn.click(); await new Promise(r => setTimeout(r, 600)); break;
          }
        }
        fileInput = pickFileInput();
        console.log('[GPI] fileInput found (after trigger):', !!fileInput);
      }

      if (!fileInput) { console.error('[GPI] ❌ No file input!'); return { ok: false, error: 'Không tìm thấy input file' }; }
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      fileInput.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('[GPI] ✅ Image injected OK');
      return { ok: true };
    },
    args: [dataUrl, mimeType, fileName, options],
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
async function waitForGenerate(tabId, timeoutMs, knownVideoUrls = new Set(), stopFlagFn, progressCallback = null, options = {}) {
  const pollInterval = 1200;
  const start = Date.now();
  let lastSpinnerTime = Date.now();
  let simulatedPct = 10;
  let btnWasDisabled = false;
  const knownImageSnapshot = await snapshotImageUrls(tabId); // also track images

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

        // Detect new videos
        const newVideoUrls = [];
        document.querySelectorAll('video').forEach(v => {
          if (v.src && !knownUrls.has(v.src)) newVideoUrls.push(v.src);
          v.querySelectorAll('source').forEach(s => {
            if (s.src && !knownUrls.has(s.src)) newVideoUrls.push(s.src);
          });
        });

        // Detect new images (for image generation mode)
        const newImgUrls = Array.from(document.querySelectorAll('img'))
          .map(img => img.currentSrc || img.src)
          .filter(src => src && !knownImgs.has(src) && !src.startsWith('data:') && !src.startsWith('blob:data'));

        // Download button appeared
        const dlReady = Array.from(document.querySelectorAll(
          'a[download],button[aria-label*="Download"],button[aria-label*="download"]'
        )).some(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

        // Submit button ready — use form-based detection matching actual Grok layout
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
        // Legacy selectors
        const legacyBtns = Array.from(document.querySelectorAll(
          'button[type="submit"],button[aria-label*="Generate"],button[aria-label*="Grok"],button[aria-label*="Send"]'
        )).filter(b => !b.disabled);
        const genReady = formBtnReady || legacyBtns.length > 0;
        const anyBtnExists = forms.length > 0 || legacyBtns.length > 0;
        const btnDisabled = anyBtnExists && !genReady;

        return { spinners: spinners.length, hasNewVideo: newVideoUrls.length > 0, newImgUrls, genReady, btnDisabled, dlReady };
      },
      args: [[...knownVideoUrls], [...knownImageSnapshot]]
    });

    const r = result?.[0]?.result;
    if (r) {
      if (r.spinners > 0) lastSpinnerTime = Date.now();
      if (r.btnDisabled) btnWasDisabled = true;
      const silentMs = Date.now() - lastSpinnerTime;

      console.log(`[GPI-SF] poll: spinners=${r.spinners} newVideo=${r.hasNewVideo} newImgs=${r.newImgUrls?.length} dlReady=${r.dlReady} genReady=${r.genReady} btnDisabled=${r.btnDisabled} silent=${Math.round(silentMs/1000)}s elapsed=${Math.round(elapsed/1000)}s`);

      if (progressCallback) {
        if (grokPct !== null) progressCallback(grokPct);
        else { simulatedPct = Math.min(95, 10 + (elapsed / Math.min(timeoutMs, 90000)) * 82); progressCallback(simulatedPct); }
      }

      // ── Completion signals ─────────────────────────────────────────────
      // 1. New video appeared
      if (r.hasNewVideo) { console.log('[GPI-SF] ✅ Done: new video detected'); return { ok: true, reason: 'new-video' }; }

      // 2. New image appeared (image mode)
      if (!options.requireNewVideo && r.newImgUrls?.length > 0 && elapsed > 5000) {
        console.log('[GPI-SF] ✅ Done: new image detected', r.newImgUrls.length);
        return { ok: true, reason: 'new-image' };
      }

      // 3. Download button appeared
      if (!options.requireNewVideo && r.dlReady && elapsed > 8000) { console.log('[GPI-SF] ✅ Done: download btn'); return { ok: true, reason: 'dl-btn' }; }

      // 4. Spinner gone + button re-enabled (transition: disabled→enabled)
      if (!options.requireNewVideo && btnWasDisabled && r.genReady && silentMs > 5000 && elapsed > 10000) {
        console.log('[GPI-SF] ✅ Done: btn transition disabled→enabled, silent', silentMs);
        return { ok: true, reason: 'btn-transition' };
      }

      // 5. Long silence (no spinners) + button ready
      if (!options.requireNewVideo && silentMs > 12000 && r.genReady && elapsed > 15000) {
        console.log('[GPI-SF] ✅ Done: long silence fallback');
        return { ok: true, reason: 'silence-fallback' };
      }
    }

    await sleep(pollInterval);
  }
  console.log('[GPI-SF] ⏰ waitForGenerate TIMEOUT');
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
        const allVideoUrls = [];
        document.querySelectorAll('video').forEach(v => {
          const src = v.src || '';
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
        // Fallback: some runs reuse same video URL; use newest visible video URL anyway.
        if (urls.length === 0 && allVideoUrls.length > 0 && (mode === 'video' || mode === 'auto')) {
          const last = allVideoUrls[allVideoUrls.length - 1];
          urls.push({ type: 'video', url: last, ext: 'mp4' });
        }
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
  const doSubmitUI = autoSubmit.checked;
  const doSubmit = true; // Queue FIFO: mỗi prompt phải submit rồi mới chờ xong để chạy prompt kế.
  const doDL = autoDownload.checked;
  const doWaitUI = waitGenerate.checked;
  const doWait = true; // Queue FIFO: luôn chờ generate xong trước khi xử lý prompt tiếp theo.
  const tmOut = (parseInt(timeoutInput.value) || 300) * 1000;

  isRunning = true; stopRequested = false;
  runBtn.disabled = true; stopBtn.disabled = false;
  promptsInput.disabled = true;
  logEl.innerHTML = '';
  progressWrap.classList.add('show');
  setProgress(progBar, progLabel, 0, prompts.length);
  if (!doSubmitUI) addLog(logEl, 'ℹ Queue mode: luôn bật Auto Submit để đảm bảo chạy tuần tự.', 'warn');
  if (!doWaitUI) addLog(logEl, 'ℹ Queue mode: luôn chờ generate xong trước khi chạy prompt tiếp theo.', 'warn');

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
        (pct) => { if (pbar) pbar.style.width = pct + '%'; },
        { requireNewVideo: true }
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
  const doWaitUI = i2vWaitGen.checked;
  const doWait = true; // Queue FIFO cho Img2Vid.
  const tmOut = (parseInt(timeoutInput.value) || 300) * 1000;
  const delay = Math.max(500, parseInt(delayInput.value) || 2000);

  i2vIsRunning = true; i2vStopReq = false;
  i2vRunBtn.disabled = true; i2vStopBtn.disabled = false;
  i2vLogEl.innerHTML = '';
  i2vProgressWrap.classList.add('show');
  setProgress(i2vProgBar, i2vProgLabel, 0, i2vPairs.length, 'Đã xử lý');
  i2vSetStep(3);
  if (!doWaitUI) addLog(i2vLogEl, 'ℹ Queue mode: Img2Vid luôn chờ generate xong trước khi chạy cặp tiếp theo.', 'warn');

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
        (pct) => { if (pprog) pprog.style.width = pct + '%'; },
        { requireNewVideo: true }
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

// ═══════════════════════════════════════════════════════════════════════════════
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
const sfFfmpegCmd  = $('sf-ffmpeg-cmd');
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

// Characters: [{id, name, description, role:'main'|'sub', imageDataUrl, imageFileName}]
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
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const videos = Array.from(document.querySelectorAll('video')).filter(v => {
        const r = v.getBoundingClientRect();
        return r.width > 100 && r.height > 100;
      });
      if (videos.length > 0) {
        const v = videos[videos.length - 1];
        try {
          const canvas = document.createElement('canvas');
          canvas.width  = v.videoWidth  || v.clientWidth;
          canvas.height = v.videoHeight || v.clientHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          return { ok: true, dataUrl: canvas.toDataURL('image/jpeg', 0.85), source: 'video' };
        } catch { /* cross-origin fallback */ }
      }
      const imgs = Array.from(document.querySelectorAll('img[src]')).filter(img => {
        const src = img.src || '';
        const r   = img.getBoundingClientRect();
        return (src.includes('blob:') || src.includes('media') || src.includes('grok'))
               && r.width > 100 && r.height > 100;
      }).sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
      if (imgs.length > 0) {
        const img = imgs[0];
        if (img.src.startsWith('blob:')) {
          return fetch(img.src).then(r => r.blob()).then(blob => {
            const reader = new FileReader();
            return new Promise(res => {
              reader.onload = () => res({ ok: true, dataUrl: reader.result, source: 'image' });
              reader.onerror = () => res({ ok: false, error: 'Read failed' });
              reader.readAsDataURL(blob);
            });
          });
        }
        return { ok: true, dataUrl: img.src, source: 'image' };
      }
      return { ok: false, error: 'Không tìm thấy media để capture' };
    },
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
  // If we deleted the main and there are still chars, promote first to main
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

  // Events
  $(`sf-chname-${ch.id}`).addEventListener('input', e => { ch.name = e.target.value; updateAnchorPreview(); });
  $(`sf-chdesc-${ch.id}`).addEventListener('input', e => { ch.description = e.target.value; updateAnchorPreview(); });
  $(`sf-chdel-${ch.id}`).addEventListener('click', () => sfDeleteCharacter(ch.id));

  // Image upload
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

  // Remove image
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

  // Characters
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
  // Save characters (exclude large imageDataUrl to avoid quota — only save text)
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

// World/Style input listeners
[sfWorldEl, sfStyleEl].forEach(el => {
  if (el) el.addEventListener('input', updateAnchorPreview);
});

// Add character button
$('sf-add-char-btn').addEventListener('click', () => {
  if (sfCharacters.length >= 8) { alert('Tối đa 8 nhân vật!'); return; }
  sfAddCharacter();
});

// Bible collapse
$('sf-bible-toggle-btn').addEventListener('click', () => {
  const collapsed = sfBibleBody.classList.toggle('collapsed');
  sfBibleArrow.textContent = collapsed ? '▶ Mở rộng' : '▼ Thu gọn';
});

// ── SCENE MANAGEMENT ──────────────────────────────────────────────────────────
function sfUpdateSceneCount() {
  sfCountLabel.textContent = `— ${sfScenes.length} cảnh`;
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

  card.innerHTML = `
    <div class="sf-scene-header">
      <div class="sf-scene-num">${idx+1}</div>
      <input class="sf-scene-title-input" id="sf-stitle-${scene.id}"
             placeholder="Cảnh ${idx+1} — Tên cảnh (tùy chọn)" value="${escapeHtml(scene.title)}">
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

  // Events
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

// ── SF PIPELINE ───────────────────────────────────────────────────────────────
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

  const tab = await checkTab();
  if (!tab) { alert('Hãy mở grok.com → Imagine!'); return; }

  const doChain  = sfChaining.checked;
  const doDL     = sfAutoDL.checked;
  const doWaitUI = sfWaitGen.checked;
  const doWait   = true; // FIFO strict: luôn chờ scene hiện tại xong rồi mới qua scene tiếp theo.
  const delay    = Math.max(1000, parseInt(sfDelayInput.value) || 2500);
  const tmOut    = (parseInt(sfTimeoutInput.value) || 150) * 1000;

  sfIsRunning = true; sfStopReq = false;
  sfRunBtn.disabled = true; sfStopBtn.disabled = false;
  sfLogEl.innerHTML = '';
  sfProgWrap.classList.add('show');
  sfExportCard.classList.remove('show');
  setProgress(sfProgBar, sfProgLabel, 0, sfScenes.length, 'Cảnh xong');
  if (!doWaitUI) addLog(sfLogEl, 'ℹ Short Film luôn chạy FIFO: tự động chờ scene xong trước khi qua scene tiếp theo.', 'warn');

  const downloadedFiles = [];
  let prevFrameDataUrl  = null;
  let done = 0;
  const sceneQueue = (window.ShortFilmLogic?.normalizeSceneQueue || (x => [...x]))(sfScenes);
  sfMessageStates = new Map(sceneQueue.map(s => [s.id, (window.ShortFilmLogic?.createMessageState || ((id) => ({id, status: "pending", error: null})))(s.id)]));

  for (let i = 0; i < sceneQueue.length; i++) {
    if (sfStopReq) { addLog(sfLogEl, `⏹ Dừng tại cảnh ${i+1}`, 'warn'); break; }

    const scene = sceneQueue[i];
    const msgState = sfMessageStates.get(scene.id);
    try {
      sfSetSceneStatus(scene.id, 'running');
      if (msgState) msgState.status = 'running';
      $(`sf-scene-${scene.id}`)?.scrollIntoView({ behavior:'smooth', block:'nearest' });

      console.log(`[GPI-SF] ═══ SCENE ${i+1}/${sfScenes.length} ═══`, scene.title || '');

      // ★ Scroll page to bottom & ensure clean input for next scene
      console.log('[GPI-SF] Scrolling page to bottom...');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          console.log('[GPI] scrollTo bottom, body.scrollHeight:', document.body.scrollHeight);
          window.scrollTo(0, document.body.scrollHeight);
        },
      });
      await sleep(500);

      // Build full prompt
      const shotLine   = `[SHOT] ${scene.shot}. [CAMERA] ${scene.camera}.`;
      const sceneLabel = `[SCENE ${i+1}${scene.title ? ' — ' + scene.title : ''}]`;
      const refLine    = '[REFERENCE] Use attached reference image(s) as strict identity anchor. Keep character face, hair, outfit, and key accessories consistent.';
      const fullPrompt = `${anchor}
${shotLine}
${refLine}
${sceneLabel} ${scene.prompt.trim()}`;

      console.log('[GPI-SF] fullPrompt length:', fullPrompt.length);
      addLog(sfLogEl, `
▶ CẢNH ${i+1}${scene.title ? ' — ' + scene.title : ''}`, 'ok');
      addLog(sfLogEl, `  Shot: ${scene.shot} | Cam: ${scene.camera}`);
      addLog(sfLogEl, `  Prompt: ${scene.prompt.slice(0,55)}...`);
      setStatus(`🎬 Cảnh ${i+1}/${sfScenes.length}`, 'orange');

      // Step A0: Inject character reference images (every scene for consistency)
      const charRefs = sfCharacters.filter(c => c.imageDataUrl);
      if (charRefs.length > 0) {
        addLog(sfLogEl, `  📷 Inject ${charRefs.length} ảnh reference nhân vật...`, 'chain');
        for (const ch of charRefs) {
          const fname = `char_${slugify(ch.name || 'ref')}_${ch.id}.jpg`;
          const res = await injectImageToPage(tab.id, ch.imageDataUrl, 'image/jpeg', fname, { preferComposer: true });
          if (res.ok) addLog(sfLogEl, `    ✓ ${ch.name || 'Nhân vật'}: ảnh ref đã gán`, 'ok');
          else        addLog(sfLogEl, `    ⚠ ${ch.name || 'Nhân vật'}: ${res.error}`, 'warn');
          await sleep(1000);
        }
        addLog(sfLogEl, `  ⏳ Chờ Grok xử lý ảnh...`);
        await sleep(2000);
      }

      // Step A: Inject reference frame (chaining)
      const refDataUrl = (doChain && prevFrameDataUrl) ? prevFrameDataUrl : scene.chainDataUrl;
      if (refDataUrl) {
        sfSetSceneStatus(scene.id, 'chaining');
        addLog(sfLogEl, `  🔗 Inject reference frame...`, 'chain');
        const imgRes = await injectImageToPage(tab.id, refDataUrl, 'image/jpeg', `ref_scene_${i+1}.jpg`, { preferComposer: true });
        if (imgRes.ok) { addLog(sfLogEl, `  ✓ Reference frame đã gán`, 'ok'); }
        else           { addLog(sfLogEl, `  ⚠ Không gán được ref: ${imgRes.error}`, 'warn'); }
        sfSetSceneStatus(scene.id, 'running');
        await sleep(1500);
      }

      const knownVids = await snapshotVideoUrls(tab.id);

      // Step B: Inject prompt + submit
      addLog(sfLogEl, `  ✍ Inject prompt + submit...`);
      await sleep(800);
      const txtRes = await injectTextPrompt(tab.id, fullPrompt, true);
      if (!txtRes.ok) {
        addLog(sfLogEl, `  ✗ ${txtRes.error}`, 'err');
        sfSetSceneStatus(scene.id, 'error');
        $(`sf-serr-${scene.id}`).textContent = `⚠ Inject thất bại: ${txtRes.error}`;
        continue;
      }
      addLog(sfLogEl, `  ✓ Đã submit (${txtRes.method || 'ok'})`, 'ok');

      let generatedOk = true;
      if (doWait) {
        setStatus(`⏳ Chờ generate cảnh ${i+1}...`, 'orange');
        addLog(sfLogEl, `  ⏳ Chờ Grok generate...`);
        await sleep(2000);
        const gen = await waitForGenerate(tab.id, tmOut, knownVids,
          () => sfStopReq,
          () => {}
        );
        if (!gen.ok) {
          const reason = gen.reason === 'timeout' ? 'Timeout' : 'Đã dừng';
          addLog(sfLogEl, `  ⚠ ${reason}`, 'warn');
          sfSetSceneStatus(scene.id, gen.reason === 'timeout' ? 'timeout' : 'idle');
          // FIFO strict: scene hiện tại chưa xong thì dừng queue.
          if (msgState) msgState.status = gen.reason === 'timeout' ? 'timeout' : 'stopped';
          if (gen.reason === 'stopped' || gen.reason === 'timeout') { addLog(sfLogEl, '  ⛔ Queue dừng theo policy FIFO strict.', 'warn'); break; }
          generatedOk = false;
        } else {
          addLog(sfLogEl, `  ✅ Generate xong!`, 'ok');
          if (msgState) msgState.status = 'generated';
        }

        if (generatedOk && doChain) {
          addLog(sfLogEl, `  📸 Capture frame cuối...`, 'chain');
          const capture = await captureLastFrame(tab.id);
          if (capture.ok) {
            prevFrameDataUrl      = capture.dataUrl;
            scene.genFrameDataUrl = capture.dataUrl;
            const genFrameEl = $(`sf-genframe-${scene.id}`);
            const genImgEl   = $(`sf-genimg-${scene.id}`);
            if (genFrameEl && genImgEl) { genImgEl.src = capture.dataUrl; genFrameEl.classList.add('show'); }
            addLog(sfLogEl, `  🔗 Frame captured → sẽ dùng cho cảnh ${i+2}`, 'chain');
          } else {
            addLog(sfLogEl, `  ⚠ Capture thất bại: ${capture.error}`, 'warn');
            prevFrameDataUrl = null;
          }
        }
      }

      // Step E: Download independent from doWait. Retry to avoid late URL hydration.
      if (doDL && generatedOk) {
        setStatus(`⬇ Tải cảnh ${i+1}...`, 'orange');
        const knownImgs = await snapshotImageUrls(tab.id);
        const sceneSlug = `scene${String(i+1).padStart(2,'0')}_${slugify(scene.title||scene.prompt)}`;
        let files = [];
        for (let attempt = 1; attempt <= 3; attempt++) {
          files = await downloadMedia(tab.id, sceneSlug, 'video', knownVids, knownImgs);
          if (files.length > 0) break;
          if (attempt < 3) {
            addLog(sfLogEl, `  ⏳ Chờ media ổn định (${attempt}/3)...`, 'warn');
            await sleep(1500);
          }
        }
        if (files.length === 0) {
          addLog(sfLogEl, `  ⚠ Chưa tải được video mới cho cảnh ${i+1}`, 'warn');
        } else {
          downloadHistory.push(...files.map(f => ({ ...f, prompt: `Cảnh ${i+1}: ${scene.prompt.slice(0,40)}` })));
          downloadedFiles.push(...files);
          if (msgState) msgState.status = 'downloaded';
          addLog(sfLogEl, `  ✅ Đã tải ${files.length} video cho cảnh ${i+1}`, 'ok');
          renderDownloads();
        }
      }

      sfSetSceneStatus(scene.id, 'done');
      if (msgState && msgState.status !== 'downloaded') msgState.status = 'generated';
      done++;
      setProgress(sfProgBar, sfProgLabel, done, sfScenes.length, 'Cảnh xong');
      saveScenes();

      if (i < sfScenes.length - 1 && !sfStopReq) {
        setStatus(`⏱ Chờ ${delay}ms...`, 'orange');
        await sleep(delay);
      }
    } catch (e) {
      addLog(sfLogEl, `  ✗ Lỗi cảnh ${i+1}: ${e.message}`, 'err');
      sfSetSceneStatus(scene.id, 'error');
      if (msgState) { msgState.status = 'failed'; msgState.error = e.message; }
      $(`sf-serr-${scene.id}`).textContent = `⚠ Runtime error: ${e.message}`;
      addLog(sfLogEl, '  ⛔ Queue dừng do lỗi scene hiện tại.', 'err');
      break;
    }
  }
  sfIsRunning = false;
  sfRunBtn.disabled = false; sfStopBtn.disabled = true;
  const allSfOk = done === sfScenes.length;
  setStatus(allSfOk ? `✅ Short Film xong ${done} cảnh!` : `Film: ${done}/${sfScenes.length}`, allSfOk ? 'green' : 'orange');
  addLog(sfLogEl, `\n══ Hoàn tất: ${done}/${sfScenes.length} cảnh ══`, allSfOk ? 'ok' : 'warn');

  if (downloadedFiles.length > 0) sfShowExport(downloadedFiles);
}

// ── Export guide ──────────────────────────────────────────────────────────────
function sfShowExport(files) {
  sfExportCard.classList.add('show');
  const fileList = files.map(f => `file '${f.filename}'`).join('\n');
  const cmd = `# 1. Tạo file danh sách:\necho "${fileList.replace(/'/g, '"')}" > filelist.txt\n\n# 2. Ghép thành phim:\nffmpeg -f concat -safe 0 -i filelist.txt -c copy short_film.mp4`;
  sfFfmpegCmd.textContent = cmd;
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
    savedI2vAutoDL: i2vAutoDL.checked,
    savedI2vWaitGen: i2vWaitGen.checked,
    savedRatio: selectedRatio,
    savedImgRatio: imgSelectedRatio,
    savedI2vRatio: i2vSelectedRatio,
    savedI2vDuration: i2vSelectedDuration,
    // Short Film
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
chrome.storage.local.get([
  'savedPrompts', 'savedImgPrompts', 'savedI2vPrompts',
  'savedDelay', 'savedTimeout',
  'savedAutoSubmit', 'savedAutoDL', 'savedWaitGen',
  'savedImgAutoDL', 'savedImgWaitGen',
  'savedI2vAutoDL', 'savedI2vWaitGen',
  'savedRatio', 'savedImgRatio', 'savedI2vRatio', 'savedI2vDuration',
  // Short Film
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
  if (data.savedI2vAutoDL !== undefined) i2vAutoDL.checked = data.savedI2vAutoDL;
  if (data.savedI2vWaitGen !== undefined) i2vWaitGen.checked = data.savedI2vWaitGen;

  if (data.savedRatio) { selectedRatio = data.savedRatio; applyRatioPill('ratio-pills', selectedRatio); }
  if (data.savedImgRatio) { imgSelectedRatio = data.savedImgRatio; applyRatioPill('img-ratio-pills', imgSelectedRatio); }
  if (data.savedI2vRatio) { i2vSelectedRatio = data.savedI2vRatio; applyRatioPill('i2v-ratio-pills', i2vSelectedRatio); }
  if (data.savedI2vDuration) { i2vSelectedDuration = data.savedI2vDuration; applyDurBtn('i2v-dur-btns', i2vSelectedDuration); }

  // Short Film Bible — restore characters
  if (data.sfCharacters?.length) {
    sfCharIdCounter = data.sfCharIdCounter || data.sfCharacters.length;
    data.sfCharacters.forEach(ch => sfAddCharacter(ch));
  }
  if (data.sfWorld) sfWorldEl.value = data.sfWorld;
  if (data.sfStyle) sfStyleEl.value = data.sfStyle;
  updateAnchorPreview();

  // Short Film settings
  if (data.sfDelay)   sfDelayInput.value   = data.sfDelay;
  if (data.sfTimeout) sfTimeoutInput.value = data.sfTimeout;
  if (data.sfAutoDLSetting   !== undefined) sfAutoDL.checked   = data.sfAutoDLSetting;
  if (data.sfChainingSetting !== undefined) sfChaining.checked  = data.sfChainingSetting;
  if (data.sfWaitGenSetting  !== undefined) sfWaitGen.checked   = data.sfWaitGenSetting;

  // Restore scenes
  if (data.sfScenes?.length) {
    sfSceneIdCounter = data.sfSceneIdCounter || data.sfScenes.length;
    data.sfScenes.forEach(s => { sfScenes.push(s); renderSceneCard(s, sfScenes.length-1); });
    sfUpdateSceneCount();
  }

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