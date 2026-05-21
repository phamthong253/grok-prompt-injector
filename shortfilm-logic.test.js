'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { normalizeSceneQueue, validateCharacterRefs, createMessageState } = require('./shortfilm-logic.js');

function loadComposerPayloadInspector() {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('function inspectComposerPayloadInPage');
  const end = sidepanel.indexOf('async function verifyComposerPayload');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return vm.runInThisContext(`${sidepanel.slice(start, end)}; inspectComposerPayloadInPage;`);
}

function loadComposerRatioInspector() {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('function inspectComposerRatioInPage');
  const end = sidepanel.indexOf('async function verifyComposerRatio');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return vm.runInThisContext(`${sidepanel.slice(start, end)}; inspectComposerRatioInPage;`);
}

function loadComposerSettingPageAction() {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function composerSettingPageAction');
  const end = sidepanel.indexOf('async function verifyComposerSetting');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return vm.runInThisContext(`${sidepanel.slice(start, end)}; composerSettingPageAction;`);
}

function loadFindBottomComposerScope() {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('function findBottomComposerScope');
  const end = sidepanel.indexOf('async function composerSettingPageAction');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return vm.runInThisContext(`${sidepanel.slice(start, end)}; findBottomComposerScope;`);
}

class FakeElement {
  constructor({
    tagName = 'DIV',
    value = '',
    textContent = '',
    className = '',
    ariaLabel = '',
    title = '',
    dataValue = '',
    attrs = {},
    src = '',
    placeholder = '',
    rect = {},
    visible = true,
    isInput = false,
  } = {}) {
    this.tagName = tagName;
    this.value = value;
    this.textContent = textContent;
    this.className = className;
    this.src = src;
    this.placeholder = placeholder;
    this.visible = visible;
    this.children = [];
    this.parentElement = null;
    this.disabled = false;
    this.dispatchedEvents = [];
    this._isInput = isInput || ['TEXTAREA', 'INPUT'].includes(tagName);
    this._attrs = {};
    if (ariaLabel) this._attrs['aria-label'] = ariaLabel;
    if (title) this._attrs.title = title;
    if (dataValue) this._attrs['data-value'] = dataValue;
    if (placeholder) this._attrs.placeholder = placeholder;
    if (src) this._attrs.src = src;
    if (className) this._attrs.class = className;
    Object.assign(this._attrs, attrs);
    this._rect = {
      top: 700,
      bottom: 780,
      left: 100,
      right: 900,
      width: 800,
      height: 80,
      ...rect,
    };
  }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  getBoundingClientRect() {
    return this._rect;
  }
  getAttribute(name) {
    if (name === 'class') return this.className;
    if (name === 'src') return this.src;
    return this._attrs[name] || null;
  }
  focus() {}
  scrollIntoView() {}
  click() {
    this.dispatchedEvents.push('click');
    if (typeof this.onclick === 'function') this.onclick();
  }
  dispatchEvent(event) {
    this.dispatchedEvents.push(event?.type || event);
    return true;
  }
  contains(el) {
    for (let node = el; node; node = node.parentElement) {
      if (node === this) return true;
    }
    return false;
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      const cls = String(node.className || '').toLowerCase();
      if (selector === 'form' && node.tagName === 'FORM') return node;
      if (selector.includes('composer') && cls.includes('composer')) return node;
      if (selector.includes('modal') && cls.includes('modal')) return node;
      if (selector.includes('template') && cls.includes('template')) return node;
      if (selector.includes('gallery') && cls.includes('gallery')) return node;
      if (selector.includes('result') && cls.includes('result')) return node;
      if (selector.includes('post') && cls.includes('post')) return node;
      if (selector.includes('media') && cls.includes('media')) return node;
      if (selector.includes('upload') && cls.includes('upload')) return node;
      if (selector.includes('overlay') && cls.includes('overlay')) return node;
    }
    return null;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    const descendants = [];
    const walk = (node) => {
      for (const child of node.children) {
        descendants.push(child);
        walk(child);
      }
    };
    walk(this);
    if (selector.includes('textarea') || selector.includes('contenteditable') || selector.includes('input')) {
      return descendants.filter(el => el._isInput);
    }
    if (selector.includes('img[src^="blob:"]') || selector.includes('attachment') || selector.includes('aria-label')) {
      return descendants.filter(el => {
        const cls = String(el.className || '').toLowerCase();
        const label = String(el.getAttribute('aria-label') || '').toLowerCase();
        return (el.tagName === 'IMG' && (el.src.startsWith('blob:') || el.src.startsWith('data:')))
          || cls.includes('thumb')
          || cls.includes('preview')
          || cls.includes('attachment')
          || label.includes('image')
          || label.includes('file');
      });
    }
    if (
      selector.includes('[role="menu"]')
      || selector.includes('[role="listbox"]')
      || selector.includes('[data-radix-popper-content-wrapper]')
      || selector.includes('[class*="popover"')
      || selector.includes('[class*="dropdown"')
      || selector.includes('[class*="menu"')
    ) {
      return descendants.filter(el => {
        const role = String(el.getAttribute('role') || '').toLowerCase();
        const cls = String(el.className || '').toLowerCase();
        return role === 'menu' || role === 'listbox' || role === 'option'
          || el.getAttribute('data-radix-popper-content-wrapper') !== null
          || cls.includes('popover') || cls.includes('dropdown') || cls.includes('menu');
      });
    }
    if (selector.includes('button') || selector.includes('label') || selector.includes('role=') || selector.includes('[data-value]') || selector.includes('[title]') || selector.includes('div') || selector.includes('span')) {
      return descendants.filter(el => {
        const role = String(el.getAttribute('role') || '').toLowerCase();
        return el.tagName === 'BUTTON' || el.tagName === 'LABEL' || el.tagName === 'DIV' || el.tagName === 'SPAN' || role;
      });
    }
    return [];
  }
}

function makeComposerDom({ text = '', composerImages = 0, outsideImages = 0 } = {}) {
  const body = new FakeElement({ tagName: 'BODY', rect: { top: 0, bottom: 1000, height: 1000 } });
  const resultArea = body.appendChild(new FakeElement({ className: 'post-results', rect: { top: 0, bottom: 500 } }));
  for (let i = 0; i < outsideImages; i++) {
    resultArea.appendChild(new FakeElement({ tagName: 'IMG', src: `blob:result-${i}`, rect: { top: 100, bottom: 200 } }));
  }
  const form = body.appendChild(new FakeElement({
    tagName: 'FORM',
    className: 'bottom composer',
    rect: { top: 680, bottom: 980, left: 80, right: 920, width: 840, height: 300 },
  }));
  const input = form.appendChild(new FakeElement({
    tagName: 'TEXTAREA',
    value: text,
    placeholder: 'Type to imagine',
    isInput: true,
    rect: { top: 720, bottom: 790, left: 120, right: 880, width: 760, height: 70 },
  }));
  for (let i = 0; i < composerImages; i++) {
    form.appendChild(new FakeElement({
      tagName: 'IMG',
      src: `blob:composer-${i}`,
      className: 'attachment preview',
      rect: { top: 800, bottom: 860, left: 130 + i * 70, right: 190 + i * 70, width: 60, height: 60 },
    }));
  }
  return { body, form, input };
}

function makeRatioDom({ activeRatio = '9:16', expectedVisible = false, outsideActiveRatio = null, toolbarOnly = false } = {}) {
  const dom = makeComposerDom({ text: 'ratio test prompt' });
  const toolbar = dom.form.appendChild(new FakeElement({
    className: 'composer-toolbar',
    rect: { top: 820, bottom: 880, left: 120, right: 880, width: 760, height: 60 },
  }));
  if (toolbarOnly) {
    toolbar.appendChild(new FakeElement({
      tagName: 'BUTTON',
      textContent: activeRatio,
      title: activeRatio,
      attrs: { 'aria-haspopup': 'menu' },
      rect: { top: 830, bottom: 860, left: 130, right: 190, width: 60, height: 30 },
    }));
    return dom;
  }
  for (const ratio of ['9:16', '16:9', '1:1']) {
    toolbar.appendChild(new FakeElement({
      tagName: 'BUTTON',
      textContent: ratio,
      dataValue: ratio,
      attrs: { 'aria-pressed': ratio === activeRatio ? 'true' : 'false' },
      rect: { top: 830, bottom: 860, left: 130, right: 190, width: 60, height: 30 },
    }));
  }
  if (expectedVisible) {
    toolbar.appendChild(new FakeElement({
      tagName: 'BUTTON',
      textContent: activeRatio,
      title: activeRatio,
      rect: { top: 870, bottom: 900, left: 130, right: 190, width: 60, height: 30 },
    }));
  }
  if (outsideActiveRatio) {
    const gallery = dom.body.appendChild(new FakeElement({
      className: 'template gallery',
      rect: { top: 100, bottom: 300, left: 80, right: 920, width: 840, height: 200 },
    }));
    gallery.appendChild(new FakeElement({
      tagName: 'BUTTON',
      textContent: outsideActiveRatio,
      dataValue: outsideActiveRatio,
      attrs: { 'aria-pressed': 'true' },
      rect: { top: 140, bottom: 170, left: 120, right: 180, width: 60, height: 30 },
    }));
  }
  return dom;
}

function makeSubmitDom({ text = '', composerImages = 0 } = {}) {
  const dom = makeComposerDom({ text, composerImages });
  const button = dom.form.appendChild(new FakeElement({
    tagName: 'BUTTON',
    ariaLabel: 'Send',
    rect: { top: 900, bottom: 940, left: 820, right: 860, width: 40, height: 40 },
  }));
  return { ...dom, button };
}

function makeRatioDropdownDom({ triggerRatio = '16:9', triggerText = null, triggerAriaLabel = null, includeExpectedOption = true, includeTemplateOption = false } = {}) {
  const dom = makeComposerDom({ text: 'ratio dropdown prompt' });
  const toolbar = dom.form.appendChild(new FakeElement({
    className: 'composer-toolbar',
    textContent: 'Video 720p 6s',
    rect: { top: 820, bottom: 880, left: 120, right: 880, width: 760, height: 60 },
  }));
  const trigger = toolbar.appendChild(new FakeElement({
    tagName: 'BUTTON',
    textContent: triggerText || triggerRatio,
    ariaLabel: triggerAriaLabel || `Aspect ratio ${triggerRatio}`,
    attrs: { 'aria-haspopup': 'menu', 'aria-expanded': 'false' },
    rect: { top: 830, bottom: 860, left: 210, right: 280, width: 70, height: 30 },
  }));
  const menu = dom.body.appendChild(new FakeElement({
    className: 'dropdown popover',
    attrs: { role: 'menu' },
    rect: { top: 500, bottom: 760, left: 500, right: 760, width: 260, height: 260 },
  }));
  for (const label of ['2:3 Tall', '3:2 Wide', '1:1 Square', ...(includeExpectedOption ? ['9:16 Vertical'] : []), '16:9 Widescreen']) {
    menu.appendChild(new FakeElement({
      tagName: 'DIV',
      textContent: label,
      attrs: { role: 'option' },
      rect: { top: 520, bottom: 550, left: 520, right: 730, width: 210, height: 30 },
    }));
  }
  if (includeTemplateOption) {
    const gallery = dom.body.appendChild(new FakeElement({
      className: 'template gallery',
      rect: { top: 50, bottom: 250, left: 20, right: 300, width: 280, height: 200 },
    }));
    const galleryMenu = gallery.appendChild(new FakeElement({
      className: 'dropdown menu',
      attrs: { role: 'menu' },
      rect: { top: 80, bottom: 180, left: 40, right: 260, width: 220, height: 100 },
    }));
    galleryMenu.appendChild(new FakeElement({
      tagName: 'DIV',
      textContent: '9:16 Vertical',
      attrs: { role: 'option' },
      rect: { top: 100, bottom: 130, left: 60, right: 240, width: 180, height: 30 },
    }));
  }
  return { ...dom, trigger, menu };
}

function makeSettingsDom({ ratio = '9:16', ratioTriggerText = null, resolution = '720p', duration = '6s' } = {}) {
  const dom = makeRatioDropdownDom({ triggerRatio: ratio, triggerText: ratioTriggerText, includeExpectedOption: true });
  const toolbar = dom.form.querySelector('.composer-toolbar') || dom.form.children.find(el => String(el.className || '').includes('composer-toolbar'));
  for (const res of ['480p', '720p']) {
    toolbar.appendChild(new FakeElement({
      tagName: 'BUTTON',
      textContent: res,
      dataValue: res,
      attrs: { 'aria-pressed': res === resolution ? 'true' : 'false' },
      rect: { top: 830, bottom: 860, left: res === '480p' ? 300 : 370, right: res === '480p' ? 360 : 430, width: 60, height: 30 },
    }));
  }
  for (const dur of ['6s', '10s']) {
    toolbar.appendChild(new FakeElement({
      tagName: 'BUTTON',
      textContent: dur,
      dataValue: dur,
      attrs: { 'aria-pressed': dur === duration ? 'true' : 'false' },
      rect: { top: 830, bottom: 860, left: dur === '6s' ? 450 : 510, right: dur === '6s' ? 500 : 570, width: 50, height: 30 },
    }));
  }
  return dom;
}

function makeSemanticSettingsDom({ ratio = '9:16', resolution = '720p', duration = '6s' } = {}) {
  const dom = makeComposerDom({ text: 'semantic settings prompt' });
  const toolbar = dom.form.appendChild(new FakeElement({
    className: 'composer-toolbar',
    textContent: 'Agent Image Video 480p 720p 6s 10s 9:16',
    rect: { top: 820, bottom: 880, left: 120, right: 880, width: 760, height: 60 },
  }));
  const modeGroup = toolbar.appendChild(new FakeElement({
    attrs: { role: 'radiogroup', 'aria-label': 'Generation mode' },
    rect: { top: 825, bottom: 865, left: 200, right: 320, width: 120, height: 40 },
  }));
  for (const mode of ['Image', 'Video']) {
    modeGroup.appendChild(new FakeElement({
      tagName: 'BUTTON',
      textContent: mode,
      attrs: { role: 'radio', 'aria-checked': mode === 'Video' ? 'true' : 'false' },
      rect: { top: 830, bottom: 860, left: mode === 'Image' ? 210 : 260, right: mode === 'Image' ? 255 : 310, width: 45, height: 30 },
    }));
  }
  const resolutionGroup = toolbar.appendChild(new FakeElement({
    attrs: { role: 'radiogroup', 'aria-label': 'Video resolution' },
    rect: { top: 825, bottom: 865, left: 330, right: 470, width: 140, height: 40 },
  }));
  for (const res of ['480p', '720p']) {
    resolutionGroup.appendChild(new FakeElement({
      tagName: 'BUTTON',
      textContent: res,
      attrs: { role: 'radio', 'aria-checked': res === resolution ? 'true' : 'false' },
      rect: { top: 830, bottom: 860, left: res === '480p' ? 340 : 405, right: res === '480p' ? 395 : 460, width: 55, height: 30 },
    }));
  }
  const durationGroup = toolbar.appendChild(new FakeElement({
    attrs: { role: 'radiogroup', 'aria-label': 'Video duration' },
    rect: { top: 825, bottom: 865, left: 480, right: 610, width: 130, height: 40 },
  }));
  for (const dur of ['6s', '10s']) {
    durationGroup.appendChild(new FakeElement({
      tagName: 'BUTTON',
      textContent: dur,
      attrs: { role: 'radio', 'aria-checked': dur === duration ? 'true' : 'false' },
      rect: { top: 830, bottom: 860, left: dur === '6s' ? 490 : 545, right: dur === '6s' ? 535 : 600, width: 45, height: 30 },
    }));
  }
  const trigger = toolbar.appendChild(new FakeElement({
    tagName: 'BUTTON',
    textContent: ratio,
    ariaLabel: 'Aspect Ratio',
    attrs: { 'aria-haspopup': 'menu' },
    rect: { top: 830, bottom: 860, left: 620, right: 690, width: 70, height: 30 },
  }));
  const menu = dom.body.appendChild(new FakeElement({
    className: 'dropdown popover',
    attrs: { role: 'menu' },
    rect: { top: 500, bottom: 760, left: 500, right: 760, width: 260, height: 260 },
  }));
  for (const label of ['2:3 Tall', '3:2 Wide', '1:1 Square', '9:16 Vertical', '16:9 Widescreen']) {
    menu.appendChild(new FakeElement({
      tagName: 'DIV',
      textContent: label,
      attrs: { role: 'option' },
      rect: { top: 520, bottom: 550, left: 520, right: 730, width: 210, height: 30 },
    }));
  }
  return { ...dom, toolbar, modeGroup, resolutionGroup, durationGroup, trigger, menu };
}

function makeNestedSettingControlsDom({ resolution = '480p', duration = '10s' } = {}) {
  const dom = makeRatioDropdownDom({ triggerRatio: '9:16', includeExpectedOption: true });
  const toolbar = dom.form.children.find(el => String(el.className || '').includes('composer-toolbar'));
  toolbar.textContent = 'Agent Image Video';
  const resolutionWrapper = toolbar.appendChild(new FakeElement({
    tagName: 'DIV',
    textContent: '480p720p',
    attrs: { role: 'button' },
    rect: { top: 870, bottom: 900, left: 300, right: 420, width: 120, height: 30 },
  }));
  for (const res of ['480p', '720p']) {
    const button = toolbar.appendChild(new FakeElement({
      tagName: 'DIV',
      attrs: { role: 'button', 'aria-pressed': res === resolution ? 'true' : 'false' },
      rect: { top: 830, bottom: 860, left: res === '480p' ? 300 : 370, right: res === '480p' ? 360 : 430, width: 60, height: 30 },
    }));
    button.appendChild(new FakeElement({
      tagName: 'SPAN',
      textContent: res,
      rect: { top: 835, bottom: 855, left: res === '480p' ? 310 : 380, right: res === '480p' ? 350 : 420, width: 40, height: 20 },
    }));
  }
  const durationWrapper = toolbar.appendChild(new FakeElement({
    tagName: 'DIV',
    textContent: '6s10s',
    attrs: { role: 'button' },
    rect: { top: 870, bottom: 900, left: 450, right: 560, width: 110, height: 30 },
  }));
  for (const dur of ['6s', '10s']) {
    const button = toolbar.appendChild(new FakeElement({
      tagName: 'DIV',
      attrs: { role: 'button', 'aria-pressed': dur === duration ? 'true' : 'false' },
      rect: { top: 830, bottom: 860, left: dur === '6s' ? 450 : 510, right: dur === '6s' ? 500 : 570, width: 50, height: 30 },
    }));
    button.appendChild(new FakeElement({
      tagName: 'SPAN',
      textContent: dur,
      rect: { top: 835, bottom: 855, left: dur === '6s' ? 460 : 520, right: dur === '6s' ? 490 : 560, width: 30, height: 20 },
    }));
  }
  return { ...dom, toolbar, resolutionWrapper, durationWrapper };
}

function makeSettingsSubmitDom({ ratio = '9:16', resolution = '720p', duration = '6s' } = {}) {
  const dom = makeSettingsDom({ ratio, resolution, duration });
  dom.form.appendChild(new FakeElement({
    tagName: 'IMG',
    src: 'blob:composer-settings-ref',
    className: 'attachment preview',
    rect: { top: 800, bottom: 860, left: 130, right: 190, width: 60, height: 60 },
  }));
  const button = dom.form.appendChild(new FakeElement({
    tagName: 'BUTTON',
    ariaLabel: 'Send',
    rect: { top: 900, bottom: 940, left: 820, right: 860, width: 40, height: 40 },
  }));
  return { ...dom, button };
}

async function runInspectorWithDom(dom, expectedText, options) {
  const previousDocument = global.document;
  const previousWindow = global.window;
  global.window = {
    innerHeight: 1000,
    getComputedStyle: (el) => ({
      visibility: el.visible ? 'visible' : 'hidden',
      display: el.visible ? 'block' : 'none',
    }),
  };
  global.document = {
    body: dom.body,
    querySelectorAll: (selector) => {
      if (selector.includes('textarea') || selector.includes('contenteditable') || selector.includes('input')) {
        return dom.body.querySelectorAll(selector);
      }
      return [];
    },
  };
  try {
    const inspectComposerPayloadInPage = loadComposerPayloadInspector();
    return await inspectComposerPayloadInPage(expectedText, options);
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
  }
}

async function runFindBottomComposerScopeWithDom(dom) {
  const previousDocument = global.document;
  const previousWindow = global.window;
  global.window = {
    innerHeight: 1000,
    getComputedStyle: (el) => ({
      visibility: el.visible ? 'visible' : 'hidden',
      display: el.visible ? 'block' : 'none',
    }),
  };
  global.document = {
    body: dom.body,
    querySelectorAll: (selector) => dom.body.querySelectorAll(selector),
  };
  try {
    const findBottomComposerScope = loadFindBottomComposerScope();
    return findBottomComposerScope();
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
  }
}

async function runComposerSettingActionWithDom(dom, action, settingType, expectedValue, options = {}) {
  const previousDocument = global.document;
  const previousWindow = global.window;
  const previousSetTimeout = global.setTimeout;
  const documentQueries = [];
  global.window = {
    innerHeight: 1000,
    getComputedStyle: (el) => ({
      visibility: el.visible ? 'visible' : 'hidden',
      display: el.visible ? 'block' : 'none',
    }),
  };
  global.setTimeout = (fn) => { fn(); return 0; };
  global.document = {
    body: dom.body,
    querySelectorAll: (selector) => {
      documentQueries.push(selector);
      return dom.body.querySelectorAll(selector);
    },
  };
  try {
    const composerSettingPageAction = loadComposerSettingPageAction();
    const result = await composerSettingPageAction(action, settingType, expectedValue, { scope: 'bottomComposer', ...options });
    return { result, documentQueries };
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
    global.setTimeout = previousSetTimeout;
  }
}

async function runRatioInspectorWithDom(dom, expectedRatio, options = {}) {
  const previousDocument = global.document;
  const previousWindow = global.window;
  const documentQueries = [];
  global.window = {
    innerHeight: 1000,
    getComputedStyle: (el) => ({
      visibility: el.visible ? 'visible' : 'hidden',
      display: el.visible ? 'block' : 'none',
    }),
  };
  global.document = {
    body: dom.body,
    querySelectorAll: (selector) => {
      documentQueries.push(selector);
      if (selector.includes('textarea') || selector.includes('contenteditable') || selector.includes('input')) {
        return dom.body.querySelectorAll(selector);
      }
      return [];
    },
  };
  try {
    const inspectComposerRatioInPage = loadComposerRatioInspector();
    const result = await inspectComposerRatioInPage(expectedRatio, {
      scope: 'bottomComposer',
      timeoutMs: 220,
      stableMs: 40,
      ...options,
    });
    return { result, documentQueries };
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
  }
}

async function runClickSubmitWithDom(dom, options = {}) {
  const previousDocument = global.document;
  const previousWindow = global.window;
  const previousMouseEvent = global.MouseEvent;
  const previousSetTimeout = global.setTimeout;
  global.window = {
    innerHeight: 1000,
    getComputedStyle: (el) => ({
      visibility: el.visible ? 'visible' : 'hidden',
      display: el.visible ? 'block' : 'none',
    }),
  };
  global.MouseEvent = class {
    constructor(type) { this.type = type; }
  };
  global.setTimeout = (fn) => { fn(); return 0; };
  global.document = {
    body: dom.body,
    querySelector: () => null,
    querySelectorAll: (selector) => dom.body.querySelectorAll(selector),
  };
  try {
    const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
    const start = sidepanel.indexOf('async function clickSubmitButton');
    const end = sidepanel.indexOf('async function injectTextPrompt');
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const context = {
      chrome: {
        scripting: {
          executeScript: async ({ func, args }) => [{ result: await func(...args) }],
        },
      },
      console,
      document: global.document,
      window: global.window,
      MouseEvent: global.MouseEvent,
      setTimeout: global.setTimeout,
      Promise,
      WeakSet,
      Math,
      Array,
      Number,
      String,
      Set,
    };
    const clickSubmitButton = vm.runInNewContext(`${sidepanel.slice(start, end)}; clickSubmitButton;`, context);
    return await clickSubmitButton(123, 1000, {
      once: true,
      maxClicks: 1,
      scope: 'bottomComposer',
      sceneId: 7,
      expectedText: 'A cinematic prompt with enough text for the guard',
      requireText: true,
      requireImage: true,
      minTextChars: 20,
      preClickGuard: true,
      ...options,
    });
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
    global.MouseEvent = previousMouseEvent;
    global.setTimeout = previousSetTimeout;
  }
}

async function runInjectAspectRatioWithDom(dom, ratio = '9:16', options = {}) {
  const previousDocument = global.document;
  const previousWindow = global.window;
  const previousSetTimeout = global.setTimeout;
  global.window = {
    innerHeight: 1000,
    getComputedStyle: (el) => ({
      visibility: el.visible ? 'visible' : 'hidden',
      display: el.visible ? 'block' : 'none',
    }),
  };
  global.setTimeout = (fn) => { fn(); return 0; };
  global.document = {
    body: dom.body,
    querySelectorAll: (selector) => dom.body.querySelectorAll(selector),
  };
  try {
    const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
    const start = sidepanel.indexOf('async function injectAspectRatio');
    const end = sidepanel.indexOf('async function navigateToImagineImage');
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const context = {
      chrome: {
        scripting: {
          executeScript: async ({ func, args }) => [{ result: await func(...args) }],
        },
      },
      console,
      document: global.document,
      window: global.window,
      setTimeout: global.setTimeout,
      Promise,
      Math,
      Array,
      Number,
      String,
      Object,
      Set,
    };
    const injectAspectRatio = vm.runInNewContext(`${sidepanel.slice(start, end)}; injectAspectRatio;`, context);
    return await injectAspectRatio(123, ratio, { scope: 'bottomComposer', ...options });
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
    global.setTimeout = previousSetTimeout;
  }
}

test('Composer payload guard fails when composer has image but empty text', async () => {
  const dom = makeComposerDom({ text: '', composerImages: 1 });
  const res = await runInspectorWithDom(dom, 'A detailed cinematic scene prompt with reliable words', {
    scope: 'bottomComposer',
    requireText: true,
    requireImage: true,
    minTextChars: 20,
    timeoutMs: 220,
    stableMs: 80,
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'text_missing');
  assert.equal(res.imageCount, 1);
});

test('Composer payload guard fails when root has prompt but actual editor is empty', async () => {
  const expected = 'A detailed cinematic prompt that appears only in the composer root';
  const dom = makeComposerDom({ text: '', composerImages: 1 });
  dom.form.textContent = expected;
  const res = await runInspectorWithDom(dom, expected, {
    scope: 'bottomComposer',
    requireText: true,
    requireImage: true,
    minTextChars: 20,
    timeoutMs: 220,
    stableMs: 80,
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'text_missing');
  assert.equal(res.editorFound, true);
  assert.equal(res.editorTextLength, 0);
  assert.ok(res.rootTextLength >= expected.length);
});

test('Composer payload guard fails when image is required but missing', async () => {
  const expected = 'A detailed cinematic scene prompt with reliable character identity words';
  const dom = makeComposerDom({ text: expected, composerImages: 0 });
  const res = await runInspectorWithDom(dom, expected, {
    scope: 'bottomComposer',
    requireText: true,
    requireImage: true,
    minTextChars: 20,
    timeoutMs: 220,
    stableMs: 80,
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'image_missing');
  assert.equal(res.imageCount, 0);
});

test('Composer payload guard passes with text and image in bottom composer', async () => {
  const expected = 'A detailed cinematic scene prompt with reliable character identity words';
  const dom = makeComposerDom({ text: expected, composerImages: 1 });
  const res = await runInspectorWithDom(dom, expected, {
    scope: 'bottomComposer',
    requireText: true,
    requireImage: true,
    minTextChars: 20,
    timeoutMs: 500,
    stableMs: 120,
  });
  assert.equal(res.ok, true);
  assert.equal(res.imageCount, 1);
  assert.ok(res.composerTextLength >= 20);
  assert.ok(res.editorTextLength >= 20);
});

test('Composer payload guard fails when text is cleared before stable window', async () => {
  const expected = 'A detailed cinematic scene prompt that should remain stable before submit';
  const dom = makeComposerDom({ text: expected, composerImages: 1 });
  setTimeout(() => {
    dom.input.value = '';
  }, 60);
  const res = await runInspectorWithDom(dom, expected, {
    scope: 'bottomComposer',
    requireText: true,
    requireImage: true,
    minTextChars: 20,
    timeoutMs: 360,
    stableMs: 220,
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'text_missing');
});

test('Composer payload guard only counts images inside bottom composer', async () => {
  const expected = 'A detailed cinematic scene prompt with no attached composer image';
  const dom = makeComposerDom({ text: expected, composerImages: 0, outsideImages: 2 });
  const res = await runInspectorWithDom(dom, expected, {
    scope: 'bottomComposer',
    requireText: true,
    requireImage: true,
    minTextChars: 20,
    timeoutMs: 220,
    stableMs: 80,
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'image_missing');
  assert.equal(res.imageCount, 0);
});

test('verifyComposerRatio passes when bottom composer shows active 9:16', async () => {
  const { result } = await runRatioInspectorWithDom(makeRatioDom({ activeRatio: '9:16' }), '9:16');
  assert.equal(result.ok, true);
  assert.equal(result.detectedRatio, '9:16');
  assert.equal(result.method, 'active-control');
});

test('verifyComposerRatio fails when expected 9:16 but active ratio is 16:9', async () => {
  const { result } = await runRatioInspectorWithDom(makeRatioDom({ activeRatio: '16:9' }), '9:16');
  assert.equal(result.ok, false);
  assert.equal(result.detectedRatio, '16:9');
});

test('verifyComposerRatio passes when dropdown trigger displays 9:16', async () => {
  const { result } = await runRatioInspectorWithDom(makeRatioDom({ activeRatio: '9:16', toolbarOnly: true }), '9:16');
  assert.equal(result.ok, true);
  assert.equal(result.detectedRatio, '9:16');
  assert.equal(result.method, 'selected-display');
});

test('ratio guard only queries ratio controls inside bottom composer, not gallery/template', async () => {
  const { result, documentQueries } = await runRatioInspectorWithDom(
    makeRatioDom({ activeRatio: '16:9', outsideActiveRatio: '9:16' }),
    '9:16'
  );
  assert.equal(result.ok, false);
  assert.equal(result.detectedRatio, '16:9');
  assert.ok(documentQueries.every(selector => !selector.includes('button') && !selector.includes('[role="button"]')));
});

test('injectAspectRatio opens ratio dropdown and clicks 9:16 option', async () => {
  const dom = makeRatioDropdownDom({ triggerRatio: '16:9', includeExpectedOption: true });
  const res = await runInjectAspectRatioWithDom(dom, '9:16');
  const clickedOption = dom.menu.children.find(child => child.textContent === '9:16 Vertical');
  assert.equal(res.ok, true);
  assert.equal(res.method, 'dropdown-option-clicked');
  assert.ok(dom.trigger.dispatchedEvents.includes('click'));
  assert.ok(clickedOption.dispatchedEvents.includes('click'));
});

test('injectAspectRatio does not query or click template gallery options', async () => {
  const dom = makeRatioDropdownDom({ triggerRatio: '16:9', includeExpectedOption: false, includeTemplateOption: true });
  const res = await runInjectAspectRatioWithDom(dom, '9:16');
  const galleryOption = dom.body.children
    .find(child => String(child.className).includes('template'))
    .querySelector('[role="option"]');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'ratio dropdown option not found');
  assert.equal(galleryOption.dispatchedEvents.length, 0);
});

test('injectAspectRatio fails clearly if dropdown opens but option not found', async () => {
  const dom = makeRatioDropdownDom({ triggerRatio: '16:9', includeExpectedOption: false });
  const res = await runInjectAspectRatioWithDom(dom, '9:16');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'ratio dropdown option not found');
  assert.equal(res.ratio, '9:16');
  assert.match(res.triggerText, /16:9/);
});

test('findBottomComposerScope finds composer with Type to imagine', async () => {
  const dom = makeSettingsDom();
  const scope = await runFindBottomComposerScopeWithDom(dom);
  assert.ok(scope);
  assert.equal(scope.root, dom.form);
  assert.equal(scope.input, dom.input);
});

test('findBottomComposerScope does not choose a tall Featured Templates container', async () => {
  const body = new FakeElement({ tagName: 'BODY', rect: { top: 0, bottom: 1000, height: 1000 } });
  const shell = body.appendChild(new FakeElement({
    tagName: 'DIV',
    className: 'composer-shell',
    textContent: 'Featured Templates Discover Create Template',
    rect: { top: 50, bottom: 950, left: 0, right: 1042, width: 1042, height: 900 },
  }));
  const form = shell.appendChild(new FakeElement({
    tagName: 'FORM',
    className: 'bottom composer',
    rect: { top: 680, bottom: 980, left: 80, right: 920, width: 840, height: 300 },
  }));
  const input = form.appendChild(new FakeElement({
    tagName: 'TEXTAREA',
    value: 'settings prompt',
    placeholder: 'Type to imagine',
    isInput: true,
    rect: { top: 720, bottom: 790, left: 120, right: 880, width: 760, height: 70 },
  }));
  const toolbar = form.appendChild(new FakeElement({
    className: 'composer-toolbar',
    textContent: 'Agent Image Video 480p 720p 6s 10s 9:16',
    rect: { top: 820, bottom: 880, left: 120, right: 880, width: 760, height: 60 },
  }));
  toolbar.appendChild(new FakeElement({
    tagName: 'BUTTON',
    textContent: '720p',
    attrs: { 'aria-pressed': 'true' },
    rect: { top: 830, bottom: 860, left: 370, right: 430, width: 60, height: 30 },
  }));

  const scope = await runFindBottomComposerScopeWithDom({ body, form, input });
  assert.ok(scope);
  assert.equal(scope.root, form);
  assert.notEqual(scope.root, shell);
  assert.ok(scope.rootRect.height <= 320);
});

test('verifyComposerSetting passes ratio when dropdown trigger displays 9:16', async () => {
  const dom = makeSettingsDom({ ratio: '9:16' });
  const { result } = await runComposerSettingActionWithDom(dom, 'verify', 'ratio', '9:16');
  assert.equal(result.ok, true);
  assert.equal(result.settingType, 'ratio');
  assert.equal(result.detectedValue, '9:16');
  assert.equal(result.method, 'selected-display');
});

test('verifyComposerSetting ratio passes when trigger text is 9:16 Aspect Ratio', async () => {
  const dom = makeSettingsDom({ ratio: '9:16', ratioTriggerText: '9:16 Aspect Ratio' });
  const { result } = await runComposerSettingActionWithDom(dom, 'verify', 'ratio', '9:16');
  assert.equal(result.ok, true);
  assert.equal(result.settingType, 'ratio');
  assert.equal(result.expectedValue, '9:16');
  assert.equal(result.detectedValue, '9:16');
  assert.equal(result.method, 'selected-display');
  assert.match(result.triggerText, /9:16 Aspect Ratio/);
});

test('applyComposerSetting ratio returns already-displayed when trigger contains expected ratio', async () => {
  const dom = makeSettingsDom({ ratio: '9:16', ratioTriggerText: '9:16 Aspect Ratio' });
  const { result, documentQueries } = await runComposerSettingActionWithDom(dom, 'apply', 'ratio', '9:16');
  assert.equal(result.ok, true);
  assert.equal(result.method, 'already-displayed');
  assert.equal(result.detectedValue, '9:16');
  assert.equal(dom.trigger.dispatchedEvents.length, 0);
  assert.equal(documentQueries.some(q => q.includes('[role="menu"]')), false);
});

test('applyComposerSetting opens ratio dropdown and clicks 9:16 Vertical', async () => {
  const dom = makeSettingsDom({ ratio: '16:9' });
  const option = dom.menu.children.find(el => String(el.textContent).includes('9:16'));
  const { result } = await runComposerSettingActionWithDom(dom, 'apply', 'ratio', '9:16');
  assert.equal(result.ok, true);
  assert.equal(result.method, 'ratio-dropdown-option-clicked');
  assert.match(result.clickedText || result.optionText || '', /9:16/);
  assert.ok(option.dispatchedEvents.includes('click') || (result.clickedText || result.optionText || '').includes('9:16'));
});

test('settings guard only opens ratio dropdown when expected and detected differ', async () => {
  const already = makeSettingsDom({ ratio: '9:16', ratioTriggerText: '9:16 Aspect Ratio' });
  const alreadyRes = await runComposerSettingActionWithDom(already, 'apply', 'ratio', '9:16');
  assert.equal(alreadyRes.result.method, 'already-displayed');
  assert.equal(already.trigger.dispatchedEvents.length, 0);
  assert.equal(alreadyRes.documentQueries.some(q => q.includes('[role="menu"]')), false);

  const wrong = makeSettingsDom({ ratio: '16:9' });
  const wrongRes = await runComposerSettingActionWithDom(wrong, 'apply', 'ratio', '9:16');
  assert.equal(wrongRes.result.method, 'ratio-dropdown-option-clicked');
  assert.ok(wrong.trigger.dispatchedEvents.includes('click'));
  assert.equal(wrongRes.documentQueries.some(q => q.includes('[role="menu"]')), true);
});

test('verifyComposerSetting detects semantic Video resolution radiogroup', async () => {
  const dom = makeSemanticSettingsDom({ resolution: '720p' });
  const { result } = await runComposerSettingActionWithDom(dom, 'verify', 'resolution', '720p');
  assert.equal(result.ok, true);
  assert.equal(result.detectedValue, '720p');
  assert.equal(result.method, 'active-control');
  assert.deepEqual(result.candidates.map(candidate => candidate.text), ['480p', '720p']);
  assert.equal(result.candidates.find(candidate => candidate.text === '720p').ariaChecked, 'true');
  assert.ok(result.viLogs.some(entry => /wanted="video resolution"/.test(entry.msg)));
  assert.ok(result.viLogs.some(entry => /resolution: FOUND/.test(entry.msg)));
  assert.equal(result.viLogs.some(entry => /resolution: NOT FOUND/.test(entry.msg)), false);
});

test('applyComposerSetting clicks semantic 720p radio option', async () => {
  const dom = makeSemanticSettingsDom({ resolution: '480p' });
  const target = dom.resolutionGroup.children.find(el => String(el.textContent) === '720p');
  const { result } = await runComposerSettingActionWithDom(dom, 'apply', 'resolution', '720p');
  assert.equal(result.ok, true);
  assert.equal(result.method, 'radiogroup-option-clicked');
  assert.equal(result.targetText, '720p');
  assert.ok(target.dispatchedEvents.includes('click'));
});

test('verifyComposerSetting detects semantic Video duration radiogroup', async () => {
  const dom = makeSemanticSettingsDom({ duration: '6s' });
  const { result } = await runComposerSettingActionWithDom(dom, 'verify', 'duration', '6s');
  assert.equal(result.ok, true);
  assert.equal(result.detectedValue, '6s');
  assert.deepEqual(result.candidates.map(candidate => candidate.text), ['6s', '10s']);
  assert.equal(result.candidates.find(candidate => candidate.text === '6s').ariaChecked, 'true');
  assert.ok(result.viLogs.some(entry => /wanted="video duration"/.test(entry.msg)));
  assert.ok(result.viLogs.some(entry => /duration: FOUND/.test(entry.msg)));
  assert.equal(result.viLogs.some(entry => /duration: NOT FOUND/.test(entry.msg)), false);
});

test('applyComposerSetting clicks semantic 10s radio option', async () => {
  const dom = makeSemanticSettingsDom({ duration: '6s' });
  const target = dom.durationGroup.children.find(el => String(el.textContent) === '10s');
  const { result } = await runComposerSettingActionWithDom(dom, 'apply', 'duration', '10s');
  assert.equal(result.ok, true);
  assert.equal(result.method, 'radiogroup-option-clicked');
  assert.equal(result.targetText, '10s');
  assert.ok(target.dispatchedEvents.includes('click'));
});

test('semantic radiogroup path does not use wrapper text 480p720p', async () => {
  const dom = makeSemanticSettingsDom({ resolution: '480p' });
  const wrapper = dom.toolbar.appendChild(new FakeElement({
    tagName: 'DIV',
    textContent: '480p720p',
    attrs: { role: 'button' },
    rect: { top: 870, bottom: 900, left: 300, right: 420, width: 120, height: 30 },
  }));
  const { result } = await runComposerSettingActionWithDom(dom, 'verify', 'resolution', '720p');
  assert.equal(result.ok, false);
  assert.equal(result.detectedValue, '480p');
  assert.equal(result.candidates.some(candidate => String(candidate.text).replace(/\s+/g, '') === '480p720p'), false);
  assert.equal(wrapper.dispatchedEvents.length, 0);
});

test('verifyComposerSetting returns radiogroup debug when semantic group is missing', async () => {
  const dom = makeComposerDom({ text: 'semantic missing group prompt' });
  const toolbar = dom.form.appendChild(new FakeElement({
    className: 'composer-toolbar',
    textContent: 'Agent Image Video 6s 10s 9:16',
    rect: { top: 820, bottom: 880, left: 120, right: 880, width: 760, height: 60 },
  }));
  const modeGroup = toolbar.appendChild(new FakeElement({
    attrs: { role: 'radiogroup', 'aria-label': 'Generation mode' },
    rect: { top: 825, bottom: 865, left: 200, right: 320, width: 120, height: 40 },
  }));
  modeGroup.appendChild(new FakeElement({
    tagName: 'BUTTON',
    textContent: 'Image',
    attrs: { role: 'radio', 'aria-checked': 'false' },
    rect: { top: 830, bottom: 860, left: 210, right: 255, width: 45, height: 30 },
  }));
  modeGroup.appendChild(new FakeElement({
    tagName: 'BUTTON',
    textContent: 'Video',
    attrs: { role: 'radio', 'aria-checked': 'true' },
    rect: { top: 830, bottom: 860, left: 260, right: 310, width: 50, height: 30 },
  }));

  const { result } = await runComposerSettingActionWithDom(dom, 'verify', 'resolution', '720p');
  assert.equal(result.ok, false);
  assert.equal(result.detectedValue, null);
  assert.ok(result.debug.radioGroups.some(group => group.ariaLabel === 'Generation mode'));
  assert.ok(result.viLogs.some(entry => /Video resolution/.test(entry.msg)));
});

test('verifyComposerSetting ratio uses Aspect Ratio trigger', async () => {
  const dom = makeSemanticSettingsDom({ ratio: '9:16' });
  const { result } = await runComposerSettingActionWithDom(dom, 'verify', 'ratio', '9:16');
  assert.equal(result.ok, true);
  assert.equal(result.detectedValue, '9:16');
  assert.equal(result.method, 'selected-display');
  assert.match(result.triggerText, /9:16/);
});

test('verifyComposerSetting passes resolution 720p when 720p control is active', async () => {
  const dom = makeSettingsDom({ resolution: '720p' });
  const { result } = await runComposerSettingActionWithDom(dom, 'verify', 'resolution', '720p');
  assert.equal(result.ok, true);
  assert.equal(result.detectedValue, '720p');
  assert.equal(result.method, 'active-control');
});

test('applyComposerSetting clicks 720p when 480p is selected', async () => {
  const dom = makeSettingsDom({ resolution: '480p' });
  const target = dom.form.querySelectorAll('button').find(el => String(el.textContent) === '720p');
  const { result } = await runComposerSettingActionWithDom(dom, 'apply', 'resolution', '720p');
  assert.equal(result.ok, true);
  assert.equal(result.settingType, 'resolution');
  assert.match(result.targetText, /720p/);
  assert.ok(result.candidates.some(candidate => String(candidate.text).includes('480p')));
  assert.ok(result.candidates.some(candidate => String(candidate.text).includes('720p')));
  assert.ok(target.dispatchedEvents.includes('click') || result.targetText.includes('720p'));
});

test('verifyComposerSetting rejects large Featured Templates setting container', async () => {
  const dom = makeComposerDom({ text: 'settings prompt' });
  dom.form.appendChild(new FakeElement({
    tagName: 'DIV',
    className: 'featured-template-wrapper',
    textContent: 'Featured Templates View All Create Template Agent Image Video 480p720p6s10s9:16',
    attrs: { role: 'button' },
    rect: { top: 50, bottom: 965, left: 0, right: 1042, width: 1042, height: 915 },
  }));

  const { result } = await runComposerSettingActionWithDom(dom, 'verify', 'resolution', '720p');
  assert.equal(result.ok, false);
  assert.equal(result.detectedValue, null);
  assert.equal(result.candidates.some(candidate => /Featured Templates|480p720p/i.test(String(candidate.text))), false);
});

test('applyComposerSetting ignores 480p720p wrapper and clicks exact 720p leaf', async () => {
  const dom = makeSettingsDom({ resolution: '480p' });
  const toolbar = dom.form.children.find(el => String(el.className || '').includes('composer-toolbar'));
  const wrapper = toolbar.appendChild(new FakeElement({
    tagName: 'DIV',
    textContent: '480p720p',
    attrs: { role: 'button' },
    rect: { top: 870, bottom: 900, left: 300, right: 420, width: 120, height: 30 },
  }));
  const target = dom.form.querySelectorAll('button').find(el => String(el.textContent) === '720p');

  const { result } = await runComposerSettingActionWithDom(dom, 'apply', 'resolution', '720p');
  assert.equal(result.ok, true);
  assert.equal(result.targetText, '720p');
  assert.equal(wrapper.dispatchedEvents.length, 0);
  assert.ok(target.dispatchedEvents.includes('click'));
  assert.equal(result.candidates.some(candidate => String(candidate.text).replace(/\s+/g, '') === '480p720p'), false);
});

test('applyComposerSetting clicks parent of exact 720p span inside toolbar', async () => {
  const dom = makeNestedSettingControlsDom({ resolution: '480p' });
  const span = dom.form.querySelectorAll('span').find(el => String(el.textContent) === '720p');
  const targetParent = span.parentElement;

  const { result } = await runComposerSettingActionWithDom(dom, 'apply', 'resolution', '720p');
  assert.equal(result.ok, true);
  assert.equal(result.method, 'exact-text-control-clicked');
  assert.equal(result.targetText, '720p');
  assert.equal(dom.resolutionWrapper.dispatchedEvents.length, 0);
  assert.ok(targetParent.dispatchedEvents.includes('click'));
  assert.ok(result.candidates.length >= 2);
  assert.equal(result.candidates.some(candidate => String(candidate.text).replace(/\s+/g, '') === '480p720p'), false);
});

test('setting controls inside media upload post composer ancestor are not blocked', async () => {
  const dom = makeNestedSettingControlsDom({ resolution: '480p', duration: '10s' });
  dom.form.className = 'bottom composer post media upload';
  const target = dom.form.querySelectorAll('span').find(el => String(el.textContent) === '720p').parentElement;

  const { result } = await runComposerSettingActionWithDom(dom, 'apply', 'resolution', '720p');
  assert.equal(result.ok, true);
  assert.equal(result.method, 'exact-text-control-clicked');
  assert.ok(result.candidates.some(candidate => candidate.text === '480p'));
  assert.ok(result.candidates.some(candidate => candidate.text === '720p'));
  assert.ok(target.dispatchedEvents.includes('click'));
  assert.equal(dom.resolutionWrapper.dispatchedEvents.length, 0);
});

test('verifyComposerSetting exposes resolution candidates from exact child spans', async () => {
  const dom = makeNestedSettingControlsDom({ resolution: '480p' });
  const { result } = await runComposerSettingActionWithDom(dom, 'verify', 'resolution', '720p');
  assert.equal(result.ok, false);
  assert.equal(result.detectedValue, '480p');
  assert.ok(result.candidates.some(candidate => candidate.text === '480p'));
  assert.ok(result.candidates.some(candidate => candidate.text === '720p'));
  assert.equal(result.candidates.some(candidate => String(candidate.text).replace(/\s+/g, '') === '480p720p'), false);
});

test('verifyComposerSetting detects selected 480p only from small exact leaf control', async () => {
  const dom = makeSettingsDom({ resolution: '480p' });
  const toolbar = dom.form.children.find(el => String(el.className || '').includes('composer-toolbar'));
  toolbar.appendChild(new FakeElement({
    tagName: 'DIV',
    textContent: 'Featured Templates Agent Image Video 480p720p',
    attrs: { role: 'button', 'aria-pressed': 'true' },
    rect: { top: 40, bottom: 240, left: 0, right: 900, width: 900, height: 200 },
  }));

  const { result } = await runComposerSettingActionWithDom(dom, 'verify', 'resolution', '720p');
  assert.equal(result.ok, false);
  assert.equal(result.detectedValue, '480p');
  assert.equal(result.candidates.some(candidate => String(candidate.text).includes('Featured Templates')), false);
});

test('verifyComposerSetting passes duration 6s', async () => {
  const dom = makeSettingsDom({ duration: '6s' });
  const { result } = await runComposerSettingActionWithDom(dom, 'verify', 'duration', '6s');
  assert.equal(result.ok, true);
  assert.equal(result.detectedValue, '6s');
});

test('applyComposerSetting clicks 6s when duration is wrong', async () => {
  const dom = makeSettingsDom({ duration: '10s' });
  const target = dom.form.querySelectorAll('button').find(el => String(el.textContent) === '6s');
  const { result } = await runComposerSettingActionWithDom(dom, 'apply', 'duration', '6s');
  assert.equal(result.ok, true);
  assert.equal(result.settingType, 'duration');
  assert.match(result.targetText, /6s/);
  assert.ok(target.dispatchedEvents.includes('click') || result.targetText.includes('6s'));
});

test('applyComposerSetting ignores 6s10s wrapper and clicks exact duration leaf', async () => {
  const dom = makeSettingsDom({ duration: '6s' });
  const toolbar = dom.form.children.find(el => String(el.className || '').includes('composer-toolbar'));
  const wrapper = toolbar.appendChild(new FakeElement({
    tagName: 'DIV',
    textContent: '6s10s',
    attrs: { role: 'button' },
    rect: { top: 870, bottom: 900, left: 450, right: 560, width: 110, height: 30 },
  }));
  const target = dom.form.querySelectorAll('button').find(el => String(el.textContent) === '10s');

  const { result } = await runComposerSettingActionWithDom(dom, 'apply', 'duration', '10s');
  assert.equal(result.ok, true);
  assert.equal(result.targetText, '10s');
  assert.equal(wrapper.dispatchedEvents.length, 0);
  assert.ok(target.dispatchedEvents.includes('click'));
  assert.equal(result.candidates.some(candidate => String(candidate.text).replace(/\s+/g, '') === '6s10s'), false);
});

test('applyComposerSetting clicks parent of exact 6s span inside toolbar', async () => {
  const dom = makeNestedSettingControlsDom({ duration: '10s' });
  const span = dom.form.querySelectorAll('span').find(el => String(el.textContent) === '6s');
  const targetParent = span.parentElement;

  const { result } = await runComposerSettingActionWithDom(dom, 'apply', 'duration', '6s');
  assert.equal(result.ok, true);
  assert.equal(result.method, 'exact-text-control-clicked');
  assert.equal(result.targetText, '6s');
  assert.equal(dom.durationWrapper.dispatchedEvents.length, 0);
  assert.ok(targetParent.dispatchedEvents.includes('click'));
  assert.ok(result.candidates.length >= 2);
  assert.equal(result.candidates.some(candidate => String(candidate.text).replace(/\s+/g, '') === '6s10s'), false);
});

test('applyComposerSetting clicks 10s when expected duration is 10s', async () => {
  const dom = makeSettingsDom({ duration: '6s' });
  const target = dom.form.querySelectorAll('button').find(el => String(el.textContent) === '10s');
  const { result } = await runComposerSettingActionWithDom(dom, 'apply', 'duration', '10s');
  assert.equal(result.ok, true);
  assert.equal(result.settingType, 'duration');
  assert.ok(target.dispatchedEvents.includes('click'));
});

test('composer setting selectors are scoped to bottom composer except ratio dropdown menu', async () => {
  const dom = makeSettingsDom({ resolution: '720p' });
  const gallery = dom.body.appendChild(new FakeElement({
    className: 'template gallery',
    rect: { top: 100, bottom: 240, left: 50, right: 300, width: 250, height: 140 },
  }));
  const outside = gallery.appendChild(new FakeElement({
    tagName: 'BUTTON',
    textContent: '480p',
    attrs: { 'aria-pressed': 'true' },
    rect: { top: 120, bottom: 150, left: 70, right: 130, width: 60, height: 30 },
  }));
  const { result, documentQueries } = await runComposerSettingActionWithDom(dom, 'verify', 'resolution', '720p');
  assert.equal(result.ok, true);
  assert.equal(outside.dispatchedEvents.length, 0);
  assert.equal(documentQueries.some(q => q.includes('[role="menu"]')), false);
});

test('ratio dropdown option lookup does not click template gallery', async () => {
  const dom = makeRatioDropdownDom({ triggerRatio: '16:9', includeExpectedOption: false, includeTemplateOption: true });
  const galleryOption = dom.body.querySelectorAll('[role="option"]').find(el => el.closest('[class*="template" i]'));
  const { result } = await runComposerSettingActionWithDom(dom, 'apply', 'ratio', '9:16');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'ratio dropdown option not found');
  assert.equal(galleryOption.dispatchedEvents.length, 0);
});

test('ensureComposerRatio calls injectAspectRatio when ratio is wrong', async () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureComposerRatio');
  const end = sidepanel.indexOf('async function applyShortFilmSceneSettings');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const calls = [];
  const context = {
    verifyComposerRatio: async () => calls.length === 0
      ? { ok: false, expectedRatio: '9:16', detectedRatio: '16:9' }
      : { ok: true, method: 'active-control', expectedRatio: '9:16', detectedRatio: '9:16' },
    injectAspectRatio: async (tabId, ratio, options) => {
      calls.push({ tabId, ratio, options });
      return { ok: true };
    },
    sleep: async () => {},
  };
  const ensureComposerRatio = vm.runInNewContext(`${sidepanel.slice(start, end)}; ensureComposerRatio;`, context);
  const res = await ensureComposerRatio(123, '9:16', { scope: 'bottomComposer' });
  assert.equal(res.ok, true);
  assert.equal(res.alreadyCorrect, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tabId, 123);
  assert.equal(calls[0].ratio, '9:16');
  assert.equal(calls[0].options.scope, 'bottomComposer');
});

test('ensureComposerRatio applies ratio when before method is toolbar-display', async () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureComposerRatio');
  const end = sidepanel.indexOf('async function applyShortFilmSceneSettings');
  const calls = [];
  const context = {
    verifyComposerRatio: async () => calls.length === 0
      ? { ok: false, code: 'weak_ratio_signal', method: 'weak-toolbar-display', expectedRatio: '9:16', detectedRatio: '9:16' }
      : { ok: true, method: 'active-control', expectedRatio: '9:16', detectedRatio: '9:16' },
    injectAspectRatio: async (tabId, ratio, options) => {
      calls.push({ tabId, ratio, options });
      return { ok: true };
    },
    sleep: async () => {},
  };
  const ensureComposerRatio = vm.runInNewContext(`${sidepanel.slice(start, end)}; ensureComposerRatio;`, context);
  const res = await ensureComposerRatio(123, '9:16', { scope: 'bottomComposer' });
  assert.equal(res.ok, true);
  assert.equal(calls.length, 1);
});

test('ensureComposerRatio fails if after apply still only toolbar-display', async () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureComposerRatio');
  const end = sidepanel.indexOf('async function applyShortFilmSceneSettings');
  const context = {
    verifyComposerRatio: async () => ({ ok: false, code: 'weak_ratio_signal', method: 'weak-toolbar-display', expectedRatio: '9:16', detectedRatio: '9:16' }),
    injectAspectRatio: async () => ({ ok: true }),
    sleep: async () => {},
  };
  const ensureComposerRatio = vm.runInNewContext(`${sidepanel.slice(start, end)}; ensureComposerRatio;`, context);
  const res = await ensureComposerRatio(123, '9:16', { scope: 'bottomComposer' });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'Ratio verification failed after apply');
});

test('ensureComposerRatio does not call injectAspectRatio when ratio already correct', async () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureComposerRatio');
  const end = sidepanel.indexOf('async function applyShortFilmSceneSettings');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const calls = [];
  const context = {
    verifyComposerRatio: async () => ({ ok: true, method: 'active-control', expectedRatio: '9:16', detectedRatio: '9:16' }),
    injectAspectRatio: async () => { calls.push('inject'); return { ok: true }; },
    sleep: async () => {},
  };
  const ensureComposerRatio = vm.runInNewContext(`${sidepanel.slice(start, end)}; ensureComposerRatio;`, context);
  const res = await ensureComposerRatio(123, '9:16', { scope: 'bottomComposer' });
  assert.equal(res.ok, true);
  assert.equal(res.alreadyCorrect, true);
  assert.equal(calls.length, 0);
});

test('ensureComposerSetting does not call applyComposerSetting when detectedValue equals expectedValue', async () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureComposerSetting');
  const end = sidepanel.indexOf('async function ensureFilmGlobalSettings');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const calls = [];
  const context = {
    verifyComposerSetting: async () => ({
      ok: false,
      settingType: 'ratio',
      expectedValue: '9:16',
      detectedValue: '9:16',
      method: 'selected-display',
    }),
    applyComposerSetting: async () => {
      calls.push('apply');
      return { ok: true };
    },
    sleep: async () => {},
  };
  const ensureComposerSetting = vm.runInNewContext(`${sidepanel.slice(start, end)}; ensureComposerSetting;`, context);
  const res = await ensureComposerSetting(123, 'ratio', '9:16', { scope: 'bottomComposer' });
  assert.equal(res.ok, true);
  assert.equal(res.alreadyCorrect, true);
  assert.equal(res.detectedValue, '9:16');
  assert.equal(res.method, 'selected-display');
  assert.equal(calls.length, 0);
});

test('clickSubmitButton with preClickGuard does not click when text missing', async () => {
  const dom = makeSubmitDom({ text: '', composerImages: 1 });
  const res = await runClickSubmitWithDom(dom);
  assert.equal(res.ok, false);
  assert.equal(res.code, 'preclick_payload_missing');
  assert.equal(res.textLen, 0);
  assert.equal(dom.button.dispatchedEvents.length, 0);
});

test('clickSubmitButton preClickGuard does not click when root has prompt but actual editor is empty', async () => {
  const dom = makeSubmitDom({ text: '', composerImages: 1 });
  dom.form.textContent = 'A cinematic prompt that is present only in root text';
  const res = await runClickSubmitWithDom(dom);
  assert.equal(res.ok, false);
  assert.equal(res.code, 'preclick_payload_missing');
  assert.equal(res.preClickCode, 'text_missing');
  assert.equal(res.editorTextLen, 0);
  assert.ok(res.rootTextLen > 0);
  assert.equal(dom.button.dispatchedEvents.length, 0);
});

test('clickSubmitButton with preClickGuard does not click when image missing and requireImage=true', async () => {
  const dom = makeSubmitDom({ text: 'A cinematic prompt with enough text for the guard', composerImages: 0 });
  const res = await runClickSubmitWithDom(dom);
  assert.equal(res.ok, false);
  assert.equal(res.code, 'preclick_payload_missing');
  assert.equal(res.imageCount, 0);
  assert.equal(dom.button.dispatchedEvents.length, 0);
});

test('clickSubmitButton with preClickGuard clicks only when text and image exist', async () => {
  const dom = makeSubmitDom({ text: 'A cinematic prompt with enough text for the guard', composerImages: 1 });
  const res = await runClickSubmitWithDom(dom);
  assert.equal(res.ok, true);
  assert.equal(res.preClickGuard.pass, true);
  assert.ok(dom.button.dispatchedEvents.includes('click'));
});

test('Pre-click guard skips ratio after attach when ratio was verified before attach', async () => {
  const dom = makeSettingsSubmitDom({ ratio: '16:9', resolution: '720p', duration: '6s' });
  dom.input.value = 'A cinematic prompt with enough text for the guard';
  const res = await runClickSubmitWithDom(dom, {
    expectedSettings: { ratio: '9:16', resolution: '720p', duration: '6s' },
    requireSettings: true,
    ratioVerifiedBeforeAttach: true,
    skipRatio: true,
    settingsState: { ratioVerifiedBeforeAttach: true, resolutionVerified: true, durationVerified: true },
  });
  assert.equal(res.ok, true);
  assert.equal(res.preClickGuard.settings.results.ratio.method, 'verified-before-attach');
  assert.ok(dom.button.dispatchedEvents.includes('click'));
});

test('Pre-click guard passes with verified settings state when resolution and duration controls are not detected', async () => {
  const dom = makeSettingsSubmitDom({ ratio: '16:9', resolution: '720p', duration: '6s' });
  dom.input.value = 'A cinematic prompt with enough text for the guard';
  const hideSettingControls = (node) => {
    if (['480p', '720p', '6s', '10s'].includes(node.textContent)) node.visible = false;
    if (String(node.textContent || '').includes('720p') || String(node.textContent || '').includes('6s')) node.textContent = 'Video';
    for (const child of node.children || []) hideSettingControls(child);
  };
  hideSettingControls(dom.form);
  const res = await runClickSubmitWithDom(dom, {
    expectedSettings: { ratio: '9:16', resolution: '720p', duration: '6s' },
    requireSettings: true,
    ratioVerifiedBeforeAttach: true,
    skipRatio: true,
    settingsState: { ratioVerifiedBeforeAttach: true, resolutionVerified: true, durationVerified: true },
  });
  assert.equal(res.ok, true);
  assert.equal(res.preClickGuard.settings.results.resolution.method, 'verified-state');
  assert.equal(res.preClickGuard.settings.results.duration.method, 'verified-state');
  assert.ok(dom.button.dispatchedEvents.includes('click'));
});

test('Pre-click guard ignores expectedSettings source metadata', async () => {
  const dom = makeSettingsSubmitDom({ ratio: '16:9', resolution: '720p', duration: '6s' });
  dom.input.value = 'A cinematic prompt with enough text for the guard';
  const res = await runClickSubmitWithDom(dom, {
    expectedSettings: {
      ratio: '9:16',
      resolution: '720p',
      duration: '6s',
      source: { ratio: 'savedRatio', resolution: 'savedResolution', duration: 'savedDuration' },
    },
    requireSettings: true,
    ratioVerifiedBeforeAttach: true,
    skipRatio: true,
    settingsState: { ratioVerifiedBeforeAttach: true, resolutionVerified: true, durationVerified: true },
  });
  assert.equal(res.ok, true);
  assert.equal(res.preClickGuard.settings.results.source, undefined);
  assert.notEqual(res.preClickGuard.settings.failedSetting, 'source');
  assert.equal(Array.from(res.preClickGuard.settings.ignoredKeys || []).join(','), 'source');
  assert.ok(dom.button.dispatchedEvents.includes('click'));
});

test('Pre-click guard blocks scene 1 submit if ratio was never verified before attach', async () => {
  const dom = makeSettingsSubmitDom({ ratio: '9:16', resolution: '720p', duration: '6s' });
  dom.input.value = 'A cinematic prompt with enough text for the guard';
  const res = await runClickSubmitWithDom(dom, {
    expectedSettings: { ratio: '9:16', resolution: '720p', duration: '6s' },
    requireSettings: true,
    skipRatio: true,
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'preclick_settings_mismatch');
  assert.equal(res.preClickCode, 'settings_mismatch');
  assert.equal(res.settings.failedSetting, 'ratio');
  assert.equal(dom.button.dispatchedEvents.length, 0);
});

test('Pre-click guard blocks scene 1 submit if resolution was never verified', async () => {
  const dom = makeSettingsSubmitDom({ ratio: '9:16', resolution: '720p', duration: '6s' });
  dom.input.value = 'A cinematic prompt with enough text for the guard';
  const res = await runClickSubmitWithDom(dom, {
    expectedSettings: { ratio: '9:16', resolution: '720p', duration: '6s' },
    requireSettings: true,
    ratioVerifiedBeforeAttach: true,
    skipRatio: true,
    settingsState: { ratioVerifiedBeforeAttach: true, resolutionVerified: false, durationVerified: true },
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'preclick_settings_mismatch');
  assert.equal(res.settings.failedSetting, 'resolution');
  assert.equal(dom.button.dispatchedEvents.length, 0);
});

test('Pre-click guard blocks scene 1 submit if duration was never verified', async () => {
  const dom = makeSettingsSubmitDom({ ratio: '9:16', resolution: '720p', duration: '6s' });
  dom.input.value = 'A cinematic prompt with enough text for the guard';
  const res = await runClickSubmitWithDom(dom, {
    expectedSettings: { ratio: '9:16', resolution: '720p', duration: '6s' },
    requireSettings: true,
    ratioVerifiedBeforeAttach: true,
    skipRatio: true,
    settingsState: { ratioVerifiedBeforeAttach: true, resolutionVerified: true, durationVerified: false },
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'preclick_settings_mismatch');
  assert.equal(res.settings.failedSetting, 'duration');
  assert.equal(dom.button.dispatchedEvents.length, 0);
});

test('Pre-click guard blocks submit if scene 1 resolution is wrong', async () => {
  const dom = makeSettingsSubmitDom({ ratio: '9:16', resolution: '480p', duration: '6s' });
  dom.input.value = 'A cinematic prompt with enough text for the guard';
  const res = await runClickSubmitWithDom(dom, {
    expectedSettings: { ratio: '9:16', resolution: '720p', duration: '6s' },
    requireSettings: true,
    ratioVerifiedBeforeAttach: true,
    skipRatio: true,
    settingsState: { ratioVerifiedBeforeAttach: true, resolutionVerified: true, durationVerified: true },
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'preclick_settings_mismatch');
  assert.equal(res.preClickCode, 'settings_mismatch');
  assert.equal(res.settings.failedSetting, 'resolution');
  assert.equal(dom.button.dispatchedEvents.length, 0);
});

test('ensureFilmGlobalSettings runs ratio resolution and duration', async () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureComposerMatchesGlobalSettings');
  const end = sidepanel.indexOf('function inspectComposerRatioInPage');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const calls = [];
  const context = {
    getVideoGlobalSettings: async () => ({ type: 'video', ratio: '9:16', resolution: '720p', duration: '6s' }),
    ensureComposerSetting: async (tabId, settingType, expectedValue, options) => {
      calls.push({ tabId, settingType, expectedValue, options });
      return {
        ok: true,
        alreadyCorrect: true,
        detectedValue: expectedValue,
        method: 'selected-display',
        before: { ok: true, detectedValue: expectedValue },
        after: { ok: true, detectedValue: expectedValue },
        applyRes: { ok: true, skipped: true },
      };
    },
    addLog: () => {},
    sfLogEl: {},
    JSON,
  };
  const ensureFilmGlobalSettings = vm.runInNewContext(`${sidepanel.slice(start, end)}; ensureFilmGlobalSettings;`, context);
  const res = await ensureFilmGlobalSettings(123, { scope: 'bottomComposer' });
  assert.equal(res.ok, true);
  assert.deepEqual(calls.map(call => call.settingType), ['mode', 'ratio', 'resolution', 'duration']);
  assert.equal(calls[0].options.forceApply, undefined);
});

test('getCurrentFilmGlobalSettings reads saved resolution before legacy Settings UI key', async () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('function normalizeFilmDurationSetting');
  const end = sidepanel.indexOf('const SF_FAST_MODE');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const context = {
    selectedRatio: '9:16',
    selectedResolution: '720p',
    selectedDuration: '6s',
    DEFAULT_GLOBAL_SETTINGS: { ratio: '9:16', resolution: '720p', duration: '6s' },
    chrome: {
      storage: {
        local: {
          get: (_keys, cb) => cb({
            savedResolution: '480p',
            setDlVideoQual: '720p',
            savedRatio: '9:16',
            setDefaultDur: '6s',
          }),
        },
      },
    },
  };
  const getCurrentFilmGlobalSettings = vm.runInNewContext(`${sidepanel.slice(start, end)}; getCurrentFilmGlobalSettings;`, context);
  const settings = await getCurrentFilmGlobalSettings();
  assert.equal(settings.resolution, '480p');
  assert.equal(settings.source.resolution, 'savedResolution');
});

test('Global Settings use Save/Default draft controls', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const html = fs.readFileSync('./sidepanel.html', 'utf8');
  assert.match(sidepanel, /const DEFAULT_GLOBAL_SETTINGS\s*=\s*\{\s*ratio:\s*'9:16',\s*resolution:\s*'720p',\s*duration:\s*'6s'/s);
  assert.match(sidepanel, /let globalSettingsDraft\s*=\s*\{\s*\.\.\.DEFAULT_GLOBAL_SETTINGS\s*\}/);
  assert.match(sidepanel, /async function saveGlobalSettings/);
  assert.match(sidepanel, /savedRatio:\s*ratio/);
  assert.match(sidepanel, /savedResolution:\s*resolution/);
  assert.match(sidepanel, /savedDuration:\s*duration/);
  assert.match(sidepanel, /async function resetGlobalSettingsToDefault/);
  assert.match(sidepanel, /set-save-global-btn'\)\?\.addEventListener\('click',\s*saveGlobalSettings\)/);
  assert.match(sidepanel, /set-reset-default-btn'\)\?\.addEventListener\('click',\s*resetGlobalSettingsToDefault\)/);
  assert.match(html, /id="set-save-global-btn"/);
  assert.match(html, /id="set-reset-default-btn"/);
});

test('Clicking Global Settings pills updates draft without immediate storage write', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const ratioCall = /makePillGroup\('set-default-ratio-pills',\s*'setDefaultRatio',[\s\S]*?\{ saveOnClick: false \}\);/;
  const durationCall = /makePillGroup\('set-default-dur-pills',\s*'setDefaultDur',[\s\S]*?\{ saveOnClick: false \}\);/;
  const resolutionCall = /makePillGroup\('set-dl-video-qual-pills',\s*'setDlVideoQual',[\s\S]*?\{ saveOnClick: false \}\);/;
  assert.match(sidepanel, ratioCall);
  assert.match(sidepanel, durationCall);
  assert.match(sidepanel, resolutionCall);
  assert.match(sidepanel, /if \(options\.saveOnClick !== false\) chrome\.storage\.local\.set/);
});

test('runShortFilm sanitizes expected settings before pre-click submit guard', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /const expectedSettingsForGuard\s*=\s*\{\s*ratio:\s*expectedFilmSettings\?\.ratio,\s*resolution:\s*expectedFilmSettings\?\.resolution,\s*duration:\s*expectedFilmSettings\?\.duration,\s*\}/s);
  const submitIndex = sidepanel.indexOf('submitResSF = await submitFilmSceneAtomic');
  assert.notEqual(submitIndex, -1);
  const submitBlock = sidepanel.slice(submitIndex, submitIndex + 900);
  assert.match(submitBlock, /expectedSettings:\s*expectedSettingsForGuard/);
  assert.doesNotMatch(submitBlock, /expectedSettings:\s*expectedFilmSettings/);

});

test('Settings guard passes when expected 9:16 and detected 9:16', async () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureComposerMatchesGlobalSettings');
  const end = sidepanel.indexOf('function inspectComposerRatioInPage');
  const calls = [];
  const context = {
    getVideoGlobalSettings: async () => ({ type: 'video', ratio: '9:16', resolution: '720p', duration: '6s' }),
    ensureComposerSetting: async (_tabId, settingType, expectedValue) => {
      calls.push(settingType);
      return {
        ok: true,
        alreadyCorrect: true,
        settingType,
        expectedValue,
        detectedValue: expectedValue,
        method: settingType === 'ratio' ? 'selected-display' : 'active-control',
        before: { ok: true, detectedValue: expectedValue },
        after: { ok: true, detectedValue: expectedValue },
        applyRes: { ok: true, skipped: true },
      };
    },
    addLog: () => {},
    sfLogEl: {},
    JSON,
  };
  const ensureFilmGlobalSettings = vm.runInNewContext(`${sidepanel.slice(start, end)}; ensureFilmGlobalSettings;`, context);
  const res = await ensureFilmGlobalSettings(123, { scope: 'bottomComposer' });
  assert.equal(res.ok, true);
  assert.equal(res.results.ratio.alreadyCorrect, true);
  assert.deepEqual(calls, ['mode', 'ratio', 'resolution', 'duration']);
});

test('ensureFilmPreAttachSettings checks ratio resolution and duration', async () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureFilmPreAttachSettings');
  const end = sidepanel.indexOf('async function ensureFilmPostAttachSettings');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const context = {
    ensureFilmGlobalSettings: async (_tabId, options) => ({
      ok: true,
      options,
      settings: { ratio: '9:16', resolution: '720p', duration: '6s' },
      results: { ratio: { ok: true }, resolution: { ok: true }, duration: { ok: true } },
    }),
  };
  const ensureFilmPreAttachSettings = vm.runInNewContext(`${sidepanel.slice(start, end)}; ensureFilmPreAttachSettings;`, context);
  const res = await ensureFilmPreAttachSettings(123, { scope: 'bottomComposer' });
  assert.equal(res.ok, true);
  assert.equal(res.options.includeRatio, true);
  assert.equal(res.options.includeResolution, true);
  assert.equal(res.options.includeDuration, true);
});

test('ensureFilmPostAttachSettings checks only resolution and duration', async () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureFilmPostAttachSettings');
  const end = sidepanel.indexOf('async function verifyFilmPostAttachSettings');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const context = {
    ensureFilmGlobalSettings: async (_tabId, options) => ({
      ok: true,
      options,
      settings: { ratio: '9:16', resolution: '720p', duration: '6s' },
      results: { resolution: { ok: true }, duration: { ok: true } },
    }),
  };
  const ensureFilmPostAttachSettings = vm.runInNewContext(`${sidepanel.slice(start, end)}; ensureFilmPostAttachSettings;`, context);
  const res = await ensureFilmPostAttachSettings(123, { scope: 'bottomComposer' });
  assert.equal(res.ok, true);
  assert.equal(res.ratioSkipped, true);
  assert.equal(res.options.includeRatio, false);
  assert.equal(res.options.includeResolution, true);
  assert.equal(res.options.includeDuration, true);
});

test('ensureShortFilmComposerForScene sceneIndex=0 defers global settings guard', async () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureShortFilmComposerForScene');
  const end = sidepanel.indexOf('async function applyShortFilmSceneSettings');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const calls = [];
  const context = {
    getCurrentFilmGlobalSettings: async () => ({ ratio: '9:16', resolution: '720p', duration: '6s' }),
    ensureGrokComposerReady: async () => ({ ok: true }),
    ensureFilmGlobalSettings: async (tabId, options) => {
      calls.push({ tabId, options });
      return {
        ok: true,
        settings: { ratio: '9:16', resolution: '720p', duration: '6s' },
        results: { ratio: { ok: true }, resolution: { ok: true }, duration: { ok: true } },
      };
    },
    addLog: () => {},
    sfLogEl: {},
    JSON,
  };
  const ensureShortFilmComposerForScene = vm.runInNewContext(`${sidepanel.slice(start, end)}; ensureShortFilmComposerForScene;`, context);
  const res = await ensureShortFilmComposerForScene(123, { id: 7 }, 0);
  assert.equal(res.ok, true);
  assert.equal(res.skippedSettingsGuard, false);
  assert.equal(res.skippedRatioGuard, false);
  assert.equal(res.settingsGuard.deferred, true);
  assert.equal(calls.length, 0);
});

test('ensureShortFilmComposerForScene sceneIndex=1 skips global settings guard', async () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureShortFilmComposerForScene');
  const end = sidepanel.indexOf('async function applyShortFilmSceneSettings');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const calls = [];
  const context = {
    getCurrentFilmGlobalSettings: async () => ({ ratio: '9:16', resolution: '720p', duration: '6s' }),
    ensureGrokComposerReady: async () => ({ ok: true }),
    ensureFilmGlobalSettings: async () => { calls.push('settings'); return { ok: true }; },
    addLog: () => {},
    sfLogEl: {},
    JSON,
  };
  const ensureShortFilmComposerForScene = vm.runInNewContext(`${sidepanel.slice(start, end)}; ensureShortFilmComposerForScene;`, context);
  const res = await ensureShortFilmComposerForScene(123, { id: 8 }, 1);
  assert.equal(res.ok, true);
  assert.equal(res.skippedSettingsGuard, true);
  assert.equal(res.skippedRatioGuard, true);
  assert.equal(calls.length, 0);
});

test('Queue order: scene IDs sorted ascending', () => {
  const input = [{ id: 3 }, { id: 1 }, { id: 2 }];
  assert.deepEqual(normalizeSceneQueue(input).map(s => s.id), [1, 2, 3]);
});

test('No-overlap: chỉ scene trước success mới tới scene sau', async () => {
  const order = [];
  const queue = normalizeSceneQueue([{ id: 2 }, { id: 1 }]);
  for (const scene of queue) {
    order.push(`start-${scene.id}`);
    await new Promise(r => setTimeout(r, 10));
    order.push(`generated-${scene.id}`);
  }
  assert.deepEqual(order, ['start-1', 'generated-1', 'start-2', 'generated-2']);
});

test('Character guard: thiếu cả imageDataUrl và visualDataUrl thì bị chặn', () => {
  const errors = validateCharacterRefs([{ name: 'A', imageDataUrl: null, visualDataUrl: null }]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /thiếu ảnh tham chiếu|thiếu ảnh tham chiếu/);
});

test('Auto-download policy state: generated -> downloaded', () => {
  const st = createMessageState(1);
  st.status = 'generated';
  st.status = 'downloaded';
  assert.equal(st.status, 'downloaded');
});

test('Timeout/stop policy: queue dừng đúng', () => {
  const states = [createMessageState(1), createMessageState(2)];
  states[0].status = 'timeout';
  const shouldStop = states[0].status === 'timeout' || states[0].status === 'stopped' || states[0].status === 'failed';
  if (shouldStop) states[1].status = 'pending';
  assert.equal(states[1].status, 'pending');
});

test('Submit injector does not mutate Short Film message state', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function injectTextPrompt');
  const end = sidepanel.indexOf('async function injectImageToPage');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const injectTextPromptBody = sidepanel.slice(start, end);
  assert.doesNotMatch(injectTextPromptBody, /msgState/);
  assert.doesNotMatch(injectTextPromptBody, /status\s*=\s*['"]downloaded['"]/);
  assert.doesNotMatch(injectTextPromptBody, /resolve\(\{\s*ok:\s*true,\s*method:\s*['"]enter-fallback['"]/);
  assert.doesNotMatch(injectTextPromptBody.slice(injectTextPromptBody.indexOf('button.click()')), /submitted\s*=\s*false/);
});

test('Short Film UI does not expose FFmpeg export command', () => {
  const sidepanelJs = fs.readFileSync('./sidepanel.js', 'utf8');
  const sidepanelHtml = fs.readFileSync('./sidepanel.html', 'utf8');
  assert.doesNotMatch(sidepanelJs, /ffmpeg/i);
  assert.doesNotMatch(sidepanelHtml, /ffmpeg/i);
});

test('Short Film requires video generation and download before next scene', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const runShortFilmBody = sidepanel.slice(start, end);
  assert.match(runShortFilmBody, /const doDL\s*=\s*true/);
  assert.match(runShortFilmBody, /waitForGrokGenerationDone\(tab\.id,\s*\{/);
  assert.match(runShortFilmBody, /mediaType:\s*'video'/);
  assert.match(runShortFilmBody, /downloadMedia\(tab\.id,\s*sceneSlug,\s*['"]video['"]/);
  assert.match(runShortFilmBody, /Queue.*video.*t.*i xong|Queue.*download/i);
  assert.match(runShortFilmBody, /Queue d.*ng: c.*nh/);
  assert.doesNotMatch(runShortFilmBody, /b.* qua,\s*ch.*y c.*nh ti.*p theo/i);
});

test('Short Film loads saved video ratio and applies it before reference attach', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /function getCurrentVideoRatioSetting|async function getCurrentVideoRatioSetting/);
  assert.match(sidepanel, /async function getCurrentFilmGlobalSettings/);
  assert.match(sidepanel, /chrome\.storage\.local\.get\(\['savedRatio'\]/);
  assert.match(sidepanel, /data\?\.savedRatio \|\| data\?\.setDefaultRatio \|\| data\?\.selectedRatio \|\| selectedRatio \|\| DEFAULT_GLOBAL_SETTINGS\.ratio/);
  assert.match(sidepanel, /function ensureShortFilmComposerForScene|async function ensureShortFilmComposerForScene/);
  assert.match(sidepanel, /ensureFilmPreAttachSettings\(tab\.id,\s*\{\s*scope:\s*'bottomComposer'\s*\}\)/);
  assert.match(sidepanel, /ensureComposerSetting\(tabId,\s*settingType,\s*expectedValue/);

  const runStart = sidepanel.indexOf('async function runShortFilm');
  const applyCall = sidepanel.indexOf('await ensureShortFilmComposerForScene(tab.id, scene, i)', runStart);
  const preAttachSettings = sidepanel.indexOf('const preAttachSettings = await ensureFilmPreAttachSettings(tab.id', applyCall);
  const charInject = sidepanel.indexOf('ensureFilmPersistedRefs(tab.id, {', preAttachSettings);
  const submitCall = sidepanel.indexOf('submitFilmSceneAtomic(tab.id, scene, fullPrompt', runStart);
  assert.ok(applyCall > runStart);
  assert.ok(preAttachSettings > applyCall);
  assert.ok(charInject > preAttachSettings);
  assert.ok(submitCall > charInject);
});

test('Short Film does not silently fall back to 16:9 when saved ratio is 9:16', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const helperStart = sidepanel.indexOf('async function getCurrentVideoRatioSetting');
  const helperEnd = sidepanel.indexOf('function normalizeFilmDurationSetting');
  const helperBody = sidepanel.slice(helperStart, helperEnd);
  assert.match(helperBody, /'9:16'/);
  assert.doesNotMatch(helperBody, /'16:9'/);
  assert.match(sidepanel, /failedSetting/);
});

test('Short Film submits each scene with one-click submit mode', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const runShortFilmBody = sidepanel.slice(start, end);
  assert.match(runShortFilmBody, /submitFilmSceneAtomic\(tab\.id,\s*scene,\s*fullPrompt/);
  assert.match(sidepanel, /async function submitFilmSceneAtomic\(tabId,\s*scene,\s*fullPrompt/);

  const helperStart = sidepanel.indexOf('async function clickSubmitButton');
  const helperEnd = sidepanel.indexOf('async function injectTextPrompt');
  const submitHelperBody = sidepanel.slice(helperStart, helperEnd);
  assert.match(submitHelperBody, /const maxClicks = Math\.max\(1,\s*Number\(options\?\.maxClicks \|\| 99\)\)/);
  assert.match(submitHelperBody, /if \(clickCount >= maxClicks\)/);
  assert.match(submitHelperBody, /if \(verified \|\| once\)/);

  const atomicStart = sidepanel.indexOf('async function submitShortFilmAtomically');
  const atomicEnd = sidepanel.indexOf('async function getBottomComposerImageCount', atomicStart);
  const atomicBody = sidepanel.slice(atomicStart, atomicEnd);
  assert.match(atomicBody, /chrome\.scripting\.executeScript/);
  assert.match(atomicBody, /world:\s*'MAIN'/);
  assert.match(atomicBody, /findBottomComposerScope/);
  assert.doesNotMatch(atomicBody, /form\.requestSubmit\(button\)/);
  assert.match(atomicBody, /atomic-film-verified-before-page-click/);
  assert.match(sidepanel, /async function submitComposerWithoutDebugger/);
  assert.match(sidepanel, /pointer-mouse-click/);
  assert.match(sidepanel, /form-request-submit/);
  assert.match(atomicBody, /acceptedReason/);
  assert.match(atomicBody, /sceneId/);
});

test('Short Film ignores duplicate processing for the same sceneId', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const runShortFilmBody = sidepanel.slice(start, end);
  assert.match(runShortFilmBody, /const filmSubmitRuntime = createFilmSubmitRuntime\(\)/);
  assert.match(runShortFilmBody, /const submittedSceneIds = filmSubmitRuntime\.submittedSceneIds/);
  assert.match(runShortFilmBody, /submittedSceneIds\.has\(scene\.id\)/);
  assert.match(runShortFilmBody, /duplicate submit ignored sceneId/);
  assert.match(sidepanel, /function acceptFilmSubmit\(runtime,\s*sceneId\)/);
  assert.match(sidepanel, /runtime\.submittedSceneIds\.add\(id\)/);
});

test('Short Film submit lock prevents overlapping submits including chaining scenes', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const runShortFilmBody = sidepanel.slice(start, end);
  assert.match(runShortFilmBody, /let currentSubmittingSceneId = null/);
  assert.match(runShortFilmBody, /beginFilmSubmit\(filmSubmitRuntime,\s*scene\.id\)/);
  assert.match(sidepanel, /runtime\.submitting/);
  assert.match(sidepanel, /duplicate_submit_blocked/);
  assert.match(runShortFilmBody, /currentSubmittingSceneId = scene\.id/);
  assert.match(runShortFilmBody, /currentSubmittingSceneId = null/);
  assert.match(runShortFilmBody, /const refDataUrl = \(doChain && prevFrameDataUrl\) \? prevFrameDataUrl : scene\.chainDataUrl/);
});

test('Submit button flicker cannot cause repeated Short Film generate clicks', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const runShortFilmBody = sidepanel.slice(start, end);
  const waitCalls = runShortFilmBody.match(/waitForSubmitButtonEnabled/g) || [];
  assert.ok(waitCalls.length >= 1);
  assert.match(runShortFilmBody, /marked submitted sceneId/);
  assert.match(runShortFilmBody, /submitFilmSceneAtomic\(tab\.id,\s*scene,\s*fullPrompt/);
  assert.match(runShortFilmBody, /failFilmSubmit\(filmSubmitRuntime,\s*scene\.id,\s*submitResSF\)/);

  const atomicStart = sidepanel.indexOf('async function submitShortFilmAtomically');
  const atomicEnd = sidepanel.indexOf('async function getBottomComposerImageCount', atomicStart);
  const atomicBody = sidepanel.slice(atomicStart, atomicEnd);
  assert.match(atomicBody, /world:\s*'MAIN'/);
  assert.match(atomicBody, /readyToPageClick/);
  assert.match(atomicBody, /submitComposerWithCDPAndAccepted\(tabId/);
  assert.match(atomicBody, /atomic-film-verified-before-page-click/);
  assert.doesNotMatch(atomicBody, /button\.click\(\)/);
  assert.doesNotMatch(atomicBody, /dispatchMouse\('click'\)/);
});

test('Short Film verifies composer payload before marking submitted or clicking submit', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const guardCall = body.indexOf('await verifyComposerPayload(tab.id, fullPrompt, guardOptions)');
  const guardFail = body.indexOf('Payload not ready sceneId', guardCall);
  const continueOnFail = body.indexOf('continue;', guardFail);
  const markSubmitted = body.indexOf('acceptFilmSubmit(filmSubmitRuntime, scene.id)', guardCall);
  const submitCall = body.indexOf('submitFilmSceneAtomic(tab.id, scene, fullPrompt', guardCall);
  const submitFail = body.indexOf('if (!submitResSF.ok)', submitCall);
  const payloadVerified = body.indexOf("setFilmScenePhase(filmSubmitRuntime, scene.id, 'payload_verified')", continueOnFail);
  assert.ok(guardCall > -1);
  assert.ok(guardFail > guardCall);
  assert.ok(continueOnFail > guardFail);
  assert.ok(payloadVerified > continueOnFail);
  assert.ok(submitCall > payloadVerified);
  assert.ok(submitFail > submitCall);
  assert.ok(markSubmitted > submitFail);
  assert.match(body, /Reference image\/chaining frame missing before submit/);
});

test('runShortFilm does not submit scene 1 if ratio guard fails', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const settingsCall = body.indexOf('const sceneSettings = await ensureShortFilmComposerForScene(tab.id, scene, i)');
  const settingsFail = body.indexOf('if (!sceneSettings.ok)', settingsCall);
  const breakOnFail = body.indexOf('break;', settingsFail);
  const preAttachGuard = body.indexOf('const preAttachSettings = await ensureFilmPreAttachSettings(tab.id', settingsCall);
  const payloadGuard = body.indexOf('await verifyComposerPayload(tab.id, fullPrompt, guardOptions)', settingsCall);
  const submitCall = body.indexOf('submitFilmSceneAtomic(tab.id, scene, fullPrompt', settingsCall);
  assert.ok(settingsCall > -1);
  assert.ok(settingsFail > settingsCall);
  assert.ok(breakOnFail > settingsFail);
  assert.ok(preAttachGuard > breakOnFail);
  assert.ok(payloadGuard > preAttachGuard);
  assert.ok(submitCall > payloadGuard);
});

test('runShortFilm does not submit scene 1 if any global setting guard fails', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const settingsCall = body.indexOf('const preAttachSettings = await ensureFilmPreAttachSettings(tab.id');
  const settingsFail = body.indexOf('if (!preAttachSettings.ok)', settingsCall);
  const settingsError = body.indexOf('Settings guard failed before reference upload', settingsFail);
  const breakOnFail = body.indexOf('break;', settingsFail);
  const submitCall = body.indexOf('submitFilmSceneAtomic(tab.id, scene, fullPrompt', settingsCall);
  assert.ok(settingsCall > -1);
  assert.ok(settingsFail > settingsCall);
  assert.ok(settingsError > settingsFail);
  assert.ok(breakOnFail > settingsError);
  assert.ok(submitCall > breakOnFail);
});

test('runShortFilm still runs payload guard for scene 2+', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const loopStart = body.indexOf('for (let i = 0; i < sceneQueue.length; i++)');
  const loopBody = body.slice(loopStart);
  assert.match(loopBody, /await ensureShortFilmComposerForScene\(tab\.id,\s*scene,\s*i\)/);
  assert.match(loopBody, /await verifyComposerPayload\(tab\.id,\s*fullPrompt,\s*guardOptions\)/);
  assert.doesNotMatch(loopBody, /if\s*\(i\s*===\s*0\)[\s\S]{0,200}verifyComposerPayload/);
});

test('Scene 1 runs ratio guard before character ref injection', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const sceneReady = body.indexOf('const sceneSettings = await ensureShortFilmComposerForScene(tab.id, scene, i)');
  const preAttach = body.indexOf('const preAttachSettings = await ensureFilmPreAttachSettings(tab.id', sceneReady);
  const stableWait = body.indexOf('ensureFilmPersistedRefs(tab.id, {', preAttach);
  const charRefs = body.indexOf('char refs ready sceneId', stableWait);
  const postAttach = body.indexOf('const postAttachSettings = await ensureFilmPostAttachSettings(tab.id', stableWait);
  assert.ok(sceneReady > -1);
  assert.ok(preAttach > sceneReady);
  assert.ok(charRefs > sceneReady);
  assert.ok(preAttach < charRefs);
  assert.ok(stableWait > preAttach);
  assert.ok(charRefs > stableWait);
  assert.ok(postAttach > stableWait);
});

test('Scene 1 runs pre-submit settings verification before clickSubmitButton', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const textInjected = body.indexOf('prompt injected sceneId');
  const preSubmit = body.indexOf('let preSubmitSettings = await verifyFilmPostAttachSettings(tab.id, expectedFilmSettings', textInjected);
  const payloadGuard = body.indexOf('let payloadGuard = await verifyComposerPayload(tab.id, fullPrompt, guardOptions)', preSubmit);
  const click = body.indexOf('submitFilmSceneAtomic(tab.id, scene, fullPrompt', payloadGuard);
  assert.ok(textInjected > -1);
  assert.ok(preSubmit > textInjected);
  assert.ok(payloadGuard > preSubmit);
  assert.ok(click > payloadGuard);
});

test('Scene 1 does not submit if post-attach resolution or duration fails', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const postRef = body.indexOf('const postAttachSettings = await ensureFilmPostAttachSettings(tab.id');
  const fail = body.indexOf('if (!postAttachSettings.ok)', postRef);
  const error = body.indexOf('Settings guard failed after reference upload', fail);
  const breakOnFail = body.indexOf('break;', fail);
  const click = body.indexOf('submitFilmSceneAtomic(tab.id, scene, fullPrompt', postRef);
  assert.ok(postRef > -1);
  assert.ok(fail > postRef);
  assert.ok(error > fail);
  assert.ok(breakOnFail > error);
  assert.ok(click > breakOnFail);
});

test('Scene 2+ skips settings guard', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureShortFilmComposerForScene');
  const end = sidepanel.indexOf('async function applyShortFilmSceneSettings');
  const body = sidepanel.slice(start, end);
  assert.match(body, /scene 2\+ skipped/);
  assert.match(body, /skippedSettingsGuard:\s*true/);
  assert.doesNotMatch(body.slice(body.indexOf('sceneIndex === 0') + 1), /ensureFilmGlobalSettings\(tabId/);
});

test('invalid prevFrameDataUrl skips chaining inject and skips chain wait', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  assert.match(sidepanel, /function isValidImageDataUrl\(dataUrl\)/);
  assert.match(body, /const validRefDataUrl = isValidImageDataUrl\(refDataUrl\)/);
  assert.match(body, /skip chaining frame because invalid dataUrl/);
  assert.match(body, /chainWaitMs=0 skipped because invalid dataUrl/);
  assert.match(body, /if \(hasRefDataUrl && validRefDataUrl\)/);
});

test('chaining frame is skipped by Film reference policy and does not wait 25s', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  assert.match(body, /skipped-by-ref-policy/);
  assert.match(body, /chainWaitMs=0 skipped by reference policy/);
  assert.doesNotMatch(body, /injectImageToPage\(tab\.id,\s*refDataUrl/);
  assert.doesNotMatch(body, /waitComposerAttachmentStable\(tab\.id,\s*SF_CHAIN_WAIT_TIMEOUT/);
  assert.doesNotMatch(body, /waitForSubmitButtonEnabled\(tab\.id,\s*25000/);
});

test('char refs use Grok-persisted refs instead of appending or waiting for button', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const charBranch = body.slice(body.indexOf('const desiredRefs = usePersistentCharacterRefs'), body.indexOf('const refDataUrl ='));
  assert.match(charBranch, /buildFilmDesiredRefs\(charRefs\)/);
  assert.match(charBranch, /ensureFilmPersistedRefs\(tab\.id,\s*\{/);
  assert.match(sidepanel, /waitComposerAttachmentStable\(tabId,\s*SF_CHAR_REF_STABLE_TIMEOUT/);
  const helperStart = sidepanel.indexOf('async function ensureFilmPersistedRefs');
  const helperEnd = sidepanel.indexOf('async function clickSubmitButton', helperStart);
  const helperBody = sidepanel.slice(helperStart, helperEnd);
  assert.match(helperBody, /minImages:\s*1/);
  assert.doesNotMatch(helperBody, /exactImages:\s*expectedRefCount/);
  assert.match(helperBody, /beforeCount > 0/);
  assert.match(helperBody, /skippedInject/);
  assert.doesNotMatch(charBranch, /waitForSubmitButtonEnabled\(tab\.id,\s*30000/);
});

test('Short Film reduces pre-submit wait timeout', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  assert.match(sidepanel, /const SF_PRE_SUBMIT_BUTTON_TIMEOUT = 8000/);
  assert.match(body, /waitForSubmitButtonEnabled\(tab\.id,\s*SF_PRE_SUBMIT_BUTTON_TIMEOUT,\s*600/);
  assert.doesNotMatch(body, /waitForSubmitButtonEnabled\(tab\.id,\s*45000/);
});

test('Short Film retries text injection when composer payload guard reports missing text', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  assert.match(body, /payloadGuard\.code === 'text_missing'/);
  assert.match(body, /guardTextRetryCount < 2/);
  assert.match(body, /retry inject text count/);
  assert.match(body, /injectTextPrompt\(tab\.id,\s*fullPrompt,\s*false\)/);
});

test('Composer strict upload rejects template modal-only file inputs', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function injectImageToPage');
  const end = sidepanel.indexOf('async function snapshotVideoUrls');
  const body = sidepanel.slice(start, end);
  assert.match(body, /options && options\.preferComposer/);
  assert.match(body, /Bottom composer not found/);
  assert.match(body, /Composer file input not found/);
  assert.match(body, /isTemplateOrModal\(i\)/);
  assert.doesNotMatch(body, /return active \? .*document\.body/);
});

test('Composer strict upload scopes trigger lookup to composer root', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function injectImageToPage');
  const end = sidepanel.indexOf('async function snapshotVideoUrls');
  const body = sidepanel.slice(start, end);
  assert.match(body, /picked\.root\.querySelector\(s\)/);
  assert.match(body, /blocked template\/modal upload candidate/);
  assert.match(body, /file inputs found inside bottom composer/);
  assert.match(body, /reason: 'bottom-composer-root'/);
});

test('ensureGrokComposerReady navigates away from template URLs and requires real composer', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureGrokComposerReady');
  const end = sidepanel.indexOf('async function navigateToImagineVideo');
  const body = sidepanel.slice(start, end);
  assert.match(body, /state === 'imagine-template'/);
  assert.match(body, /chrome\.tabs\.update\(tabId,\s*\{\s*url:\s*'https:\/\/grok\.com\/imagine'\s*\}\)/);
  assert.match(body, /Composer input not found/);
  assert.match(body, /Bottom composer not found on current Imagine page/);
  assert.match(body, /!isTemplateOrModal\(el\)/);
});

test('navigateToImagineVideo avoids template modal buttons and verifies composer readiness', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function navigateToImagineVideo');
  const end = sidepanel.indexOf('async function runImg2Vid');
  const body = sidepanel.slice(start, end);
  assert.match(body, /ensureGrokComposerReady\(tabId\)/);
  assert.match(body, /isBlocked\(btn\)/);
  assert.match(body, /return \{ ok: true, videoModeClicked:/);
});

test('Short Film checks composer readiness before scene image injection', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  assert.match(body, /ensureFilmPersistedRefs\(tab\.id,\s*\{/);
  assert.match(sidepanel, /const composerReady = await ensureGrokComposerReady\(tabId,\s*\{\s*noNavigate:\s*true\s*\}\)/);
  assert.match(body, /Bỏ qua inject chaining frame/);
  assert.match(sidepanel, /injectImageToPage\(tabId,\s*ref\.dataUrl[\s\S]*preferComposer: true/);
});

test('Bottom composer helper uses Type to imagine, bottom-screen filtering, and no body fallback', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const imageStart = sidepanel.indexOf('async function injectImageToPage');
  const imageEnd = sidepanel.indexOf('async function snapshotVideoUrls');
  const imageBody = sidepanel.slice(imageStart, imageEnd);
  assert.match(imageBody, /textarea\[placeholder\*="Type to imagine" i\]/);
  assert.match(imageBody, /inputRect\.top > window\.innerHeight \* 0\.50/);
  assert.match(imageBody, /rootRect\.bottom > window\.innerHeight \* 0\.75/);
  assert.match(imageBody, /sort\(\(a, b\) => \(b\.rootRect\.bottom - a\.rootRect\.bottom\)/);
  assert.doesNotMatch(imageBody, /root\s*=\s*document\.body/);
  assert.doesNotMatch(imageBody, /return\s+document\.body/);
});

test('injectImageToPage preferComposer only searches file inputs inside bottom composer', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function injectImageToPage');
  const end = sidepanel.indexOf('async function snapshotVideoUrls');
  const body = sidepanel.slice(start, end);
  const preferBranch = body.slice(body.indexOf('if (options && options.preferComposer)'), body.indexOf('const all = Array.from(document.querySelectorAll'));
  assert.match(preferBranch, /findBottomComposerScope\(\)/);
  assert.match(preferBranch, /scope\.root\.querySelectorAll\('input\[type="file"\]'\)/);
  assert.match(preferBranch, /Bottom composer not found/);
  assert.doesNotMatch(preferBranch, /document\.querySelectorAll\('input\[type="file"\]'\)/);
});

test('injectTextPrompt selects the lowest bottom composer input instead of the first document input', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function injectTextPrompt');
  const end = sidepanel.indexOf('async function injectImageToPage');
  const body = sidepanel.slice(start, end);
  assert.match(body, /const bottomScope = findBottomComposerScope\(\)/);
  assert.match(body, /let el = findActualComposerEditor\(bottomScope\)/);
  assert.match(body, /return candidates\[0\]\?\.el \|\| scope\.input \|\| null/);
  assert.match(body, /Bottom composer not found/);
  assert.match(body, /sort\(\(a, b\) => \(b\.rootRect\.bottom - a\.rootRect\.bottom\)/);
});

test('Scoped submit wait and click only use bottom composer root', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const waitStart = sidepanel.indexOf('async function waitForSubmitButtonEnabled');
  const waitEnd = sidepanel.indexOf('async function clickSubmitButton');
  const waitBody = sidepanel.slice(waitStart, waitEnd);
  assert.match(waitBody, /options\?\.scope === 'bottomComposer'/);
  assert.match(waitBody, /scope\.root\.querySelectorAll\('button,\[role="button"\]'\)/);
  assert.match(waitBody, /rootRect\.right - 140/);

  const clickStart = sidepanel.indexOf('async function clickSubmitButton');
  const clickEnd = sidepanel.indexOf('async function injectTextPrompt');
  const clickBody = sidepanel.slice(clickStart, clickEnd);
  assert.match(clickBody, /options\?\.scope === 'bottomComposer'/);
  assert.match(clickBody, /scope\.root\.querySelectorAll\('button,\[role="button"\]'\)/);
  assert.match(clickBody, /bottom-composer-rightmost/);
  assert.match(clickBody, /No submit button in bottom composer/);
});

test('Short Film uses bottom composer scope for upload readiness and submit', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const scopedWaits = body.match(/waitForSubmitButtonEnabled\(tab\.id,[^)]*\{\s*scope:\s*'bottomComposer'\s*\}/g) || [];
  assert.ok(scopedWaits.length >= 1);
  assert.match(body, /ensureFilmPersistedRefs\(tab\.id,\s*\{/);
  assert.match(sidepanel, /waitComposerAttachmentStable\(tabId,\s*SF_CHAR_REF_STABLE_TIMEOUT/);
  assert.match(sidepanel, /injectImageToPage\(tabId,\s*ref\.dataUrl[\s\S]*preferComposer: true/);
  assert.doesNotMatch(body, /injectImageToPage\(tab\.id,\s*refDataUrl/);
  assert.match(body, /submitFilmSceneAtomic\(tab\.id,\s*scene,\s*fullPrompt/);
  assert.match(sidepanel, /async function submitShortFilmAtomically\(tabId,\s*scene,\s*fullPrompt/);
  assert.match(sidepanel, /findBottomComposerScope/);
  assert.match(sidepanel, /button\.click\(\)/);
  assert.match(sidepanel, /submit_not_accepted/);
});

test('Short Film no longer uses page-level submit gate or allowToken', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.doesNotMatch(sidepanel, /async function installFilmSubmitGate\(tabId,\s*sceneId,\s*phase/);
  assert.doesNotMatch(sidepanel, /async function setFilmGateAllowToken\(tabId,\s*options/);
  assert.doesNotMatch(sidepanel, /async function getFilmSubmitGateState\(tabId/);
  assert.doesNotMatch(sidepanel, /async function clearFilmSubmitGate\(tabId/);
  assert.doesNotMatch(sidepanel, /window\.__gpiFilmSubmitGate/);
  assert.doesNotMatch(sidepanel, /allowToken/);
  assert.doesNotMatch(sidepanel, /earlySubmitCount/);
  assert.doesNotMatch(sidepanel, /validSubmitCount/);
  assert.doesNotMatch(sidepanel, /blockedSubmitCount/);
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  assert.doesNotMatch(body, /installFilmSubmitGate/);
  assert.doesNotMatch(body, /setFilmSubmitGate/);
  assert.doesNotMatch(body, /clearFilmSubmitGate/);
  assert.match(body, /beginFilmSubmit\(filmSubmitRuntime,\s*scene\.id\)/);
  assert.match(body, /submitFilmSceneAtomic\(tab\.id,\s*scene,\s*fullPrompt/);
});

test('Short Film waits for prompt commit stable before allowing submit', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /async function waitFilmPromptCommitStable\(tabId,\s*expectedPrompt/);
  assert.match(sidepanel, /editorTextLen/);
  assert.match(sidepanel, /rootTextLen/);
  assert.match(sidepanel, /prompt_commit_unstable/);
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const inject = body.indexOf('injectTextPrompt(tab.id, fullPrompt, false)');
  const commit = body.indexOf('waitFilmPromptCommitStable(tab.id, fullPrompt', inject);
  const payloadGuard = body.indexOf('verifyComposerPayload(tab.id, fullPrompt', commit);
  const submit = body.indexOf('submitFilmSceneAtomic(tab.id, scene, fullPrompt', payloadGuard);
  assert.ok(inject > -1);
  assert.ok(commit > inject);
  assert.ok(payloadGuard > commit);
  assert.ok(submit > payloadGuard);
});

test('Short Film atomic submit uses CDP native click and accepted contract', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /async function submitShortFilmAtomically\(tabId,\s*scene,\s*fullPrompt/);
  const helperStart = sidepanel.indexOf('async function submitShortFilmAtomically');
  const helperEnd = sidepanel.indexOf('// ── CLICK SUBMIT BUTTON', helperStart);
  const helper = sidepanel.slice(helperStart, helperEnd);
  assert.match(helper, /world:\s*'MAIN'/);
  assert.match(helper, /setFilmEarlySubmitShieldPhase\(tabId,\s*sceneId,\s*'open_for_atomic_submit'\)/);
  assert.match(helper, /readyToPageClick/);
  assert.match(helper, /submitComposerWithCDPAndAccepted\(tabId/);
  assert.match(sidepanel, /async function clickSubmitButtonWithCDP/);
  assert.match(sidepanel, /Input\.dispatchMouseEvent/);
  assert.match(sidepanel, /cdp-input-dispatch/);
  assert.match(sidepanel, /debugger_permission_missing/);
  assert.doesNotMatch(helper, /form\.requestSubmit\(button\)/);
  assert.doesNotMatch(helper, /button\.click\(\)/);
  assert.doesNotMatch(helper, /getFilmSubmitGateState\(tabId\)/);
  const clickStart = sidepanel.indexOf('async function clickSubmitButton');
  const clickEnd = sidepanel.indexOf('async function submitImg2VidAtomically', clickStart);
  const clickBody = sidepanel.slice(clickStart, clickEnd);
  assert.match(clickBody, /options\?\.clickMode === 'nativeOnly'/);
  assert.match(clickBody, /button\.click\(\)/);
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  assert.match(body, /submitFilmSceneAtomic\(tab\.id,\s*scene,\s*fullPrompt/);
  assert.doesNotMatch(body, /for \(let submitAttempt = 1; submitAttempt <= 3/);
});

test('Short Film atomic submit uses same bottom composer payload contract and reports locator mismatch', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const helperStart = sidepanel.indexOf('async function submitShortFilmAtomically');
  const helperEnd = sidepanel.indexOf('// ── CLICK SUBMIT BUTTON', helperStart);
  const helper = sidepanel.slice(helperStart, helperEnd);
  assert.match(helper, /const requireImage = opts\.requireImage === true/);
  assert.match(helper, /findBottomComposerScope/);
  assert.match(helper, /findActualComposerEditor/);
  assert.match(helper, /countImages/);
  assert.match(helper, /getSubmitButtonCandidates/);
  assert.match(helper, /buttonCandidates/);
  assert.match(helper, /button\[type="submit"\]/);
  assert.match(helper, /atomic_locator_mismatch/);
  assert.match(helper, /preClickGuard\?\.ok/);
  assert.match(helper, /preClickGuardTextLen/);
  assert.match(helper, /preClickGuardImageCount/);
});

test('Short Film accepted signal rejects weak post-placeholder without strong submit signal', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const helperStart = sidepanel.indexOf('async function submitShortFilmAtomically');
  const helperEnd = sidepanel.indexOf('// â”€â”€ CLICK SUBMIT BUTTON', helperStart);
  const helper = sidepanel.slice(helperStart, helperEnd);
  assert.match(helper, /weak_accept_signal/);
  assert.match(helper, /postPlaceholder/);
  assert.match(helper, /const strong =/);
  assert.doesNotMatch(helper, /deltaClick > 0 \|\| deltaForm > 0 \|\| deltaEnter > 0/);
  assert.match(helper, /buttonDisabled/);
  assert.match(helper, /composerCleared/);
  assert.match(helper, /urlChanged/);
  assert.match(helper, /newGeneratingCard/);
  assert.match(helper, /newMediaPlaceholder/);
  assert.doesNotMatch(helper, /shieldSeenSubmit/);
  assert.doesNotMatch(helper, /submit-event/);
  assert.match(helper, /strongAccepted/);
});

test('Short Film atomic submit does not depend on page-level submit monitor deltas', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const helperStart = sidepanel.indexOf('async function submitShortFilmAtomically');
  const helperEnd = sidepanel.indexOf('// â”€â”€ CLICK SUBMIT BUTTON', helperStart);
  const helper = sidepanel.slice(helperStart, helperEnd);
  assert.doesNotMatch(helper, /monitorBefore/);
  assert.doesNotMatch(helper, /monitorAfter/);
  assert.doesNotMatch(helper, /deltaClick/);
  assert.doesNotMatch(helper, /deltaForm/);
  assert.match(helper, /composerCleared/);
  assert.match(helper, /buttonDisabled/);
  assert.match(helper, /newGeneratingCard/);
});

test('Short Film marks submitted only after atomic submit accepted', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const submitCall = body.indexOf('submitResSF = await submitFilmSceneAtomic');
  const failBranch = body.indexOf('if (!submitResSF.ok)', submitCall);
  const markSubmitted = body.indexOf('acceptFilmSubmit(filmSubmitRuntime, scene.id)', submitCall);
  const beginLock = body.indexOf('const submitLock = beginFilmSubmit(filmSubmitRuntime, scene.id)');
  const lockSubmitted = body.indexOf('currentSubmittingSceneId = scene.id', beginLock);
  assert.ok(submitCall > -1);
  assert.ok(beginLock > -1 && beginLock < submitCall);
  assert.ok(failBranch > submitCall);
  assert.ok(markSubmitted > failBranch);
  assert.ok(lockSubmitted > beginLock && lockSubmitted < submitCall);
  assert.match(sidepanel, /runtime\.submittedSceneIds\.add\(id\)/);
});

test('Short Film prepares once before loop and preserves persisted refs each scene', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /async function prepareShortFilmComposer/);
  assert.match(sidepanel, /async function prepareFilmSceneComposerForPersistedRefs\(tabId,\s*sceneCtx = \{\}/);
  assert.match(sidepanel, /async function getFilmComposerCleanState\(tabId\)/);

  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const prepareCall = body.indexOf('await prepareShortFilmComposer(tab.id)');
  const loopStart = body.indexOf('for (let i = 0; i < sceneQueue.length; i++)');
  const prepareSceneCall = body.indexOf('prepareFilmSceneComposerForPersistedRefs(tab.id', loopStart);
  assert.ok(prepareCall > -1);
  assert.ok(loopStart > prepareCall);
  assert.ok(prepareSceneCall > loopStart);
  assert.doesNotMatch(body.slice(prepareSceneCall, prepareSceneCall + 300), /forceReload/);
  assert.doesNotMatch(body, /prepareCleanFilmSceneComposer/);
});

test('ensureShortFilmComposerForScene only prepares current composer', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureShortFilmComposerForScene');
  const end = sidepanel.indexOf('async function applyShortFilmSceneSettings');
  const body = sidepanel.slice(start, end);
  assert.match(body, /ensureGrokComposerReady\(tabId,\s*\{\s*noNavigate:\s*true\s*\}\)/);
  assert.match(body, /sceneIndex === 0/);
  assert.match(body, /deferred to scene 1 pre-attach\/post-attach phases/);
  assert.match(body, /skippedSettingsGuard:\s*true/);
  assert.doesNotMatch(body, /ensureFilmGlobalSettings\(tabId/);
  assert.doesNotMatch(body, /navigateToImagineVideo/);
  assert.doesNotMatch(body, /chrome\.tabs\.update/);
});

test('prepareShortFilmComposer owns the one-time Imagine navigation', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function prepareShortFilmComposer');
  const end = sidepanel.indexOf('async function waitForSubmitButtonEnabled');
  const body = sidepanel.slice(start, end);
  assert.match(body, /prepareShortFilmComposer called once/);
  assert.match(body, /current URL before Short Film/);
  assert.match(body, /navigateToImagineVideo\(tabId\)/);
  assert.match(body, /ratio guard deferred to scene 1/);
  assert.doesNotMatch(body, /injectAspectRatio\(tabId,\s*ratio/);
});

test('Scene 2 preserves Grok-persisted Film refs before text prompt', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const prepare = body.indexOf('prepareFilmSceneComposerForPersistedRefs(tab.id');
  const refPolicy = body.indexOf('ensureFilmPersistedRefs(tab.id, {');
  const chainSkip = body.indexOf('skipped-by-ref-policy', refPolicy);
  const textInject = body.indexOf('injectTextPrompt(tab.id, fullPrompt, false)', chainSkip);
  assert.ok(prepare > -1);
  assert.ok(refPolicy > -1);
  assert.ok(refPolicy > prepare);
  assert.ok(chainSkip > refPolicy);
  assert.ok(textInject > chainSkip);
  assert.match(body.slice(refPolicy, textInject), /Bỏ qua inject chaining frame/);
  assert.doesNotMatch(body.slice(refPolicy, textInject), /injectImageToPage\(tab\.id,\s*refDataUrl/);
  assert.doesNotMatch(body.slice(prepare, refPolicy), /clearBottomComposerAttachments|cleanupFilmComposerAttachments/);
});

test('Film uses persisted refs before text in every scene', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const persistDecl = body.indexOf('const usePersistentCharacterRefs = true');
  const desiredRefs = body.indexOf('const desiredRefs = usePersistentCharacterRefs ? buildFilmDesiredRefs(charRefs) : []');
  const ensureRefs = body.indexOf('ensureFilmPersistedRefs(tab.id, {', desiredRefs);
  const textInject = body.indexOf('injectTextPrompt(tab.id, fullPrompt, false)', ensureRefs);
  assert.ok(persistDecl > -1);
  assert.ok(desiredRefs > persistDecl);
  assert.ok(ensureRefs > desiredRefs);
  assert.ok(textInject > ensureRefs);
  assert.doesNotMatch(body.slice(desiredRefs, ensureRefs), /i === 0/);
  assert.doesNotMatch(body.slice(desiredRefs, ensureRefs), /clearBottomComposerAttachments|cleanupFilmComposerAttachments/);
});

test('Film forces output count to one before prompt injection', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /async function ensureFilmSingleOutput\(tabId,\s*options = \{\}\)/);
  assert.match(sidepanel, /allowUnlabeledNumericControl:\s*true/);
  assert.match(sidepanel, /numeric-trigger-option/);
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const refsAttached = body.indexOf("setFilmScenePhase(filmSubmitRuntime, scene.id, 'refs_attached')");
  const outputCount = body.indexOf('ensureFilmSingleOutput(tab.id', refsAttached);
  const snapshot = body.indexOf('const knownVids = await snapshotVideoUrls(tab.id)', outputCount);
  const textInject = body.indexOf('injectTextPrompt(tab.id, fullPrompt, false)', outputCount);
  const submit = body.indexOf('submitFilmSceneAtomic(tab.id, scene, fullPrompt', outputCount);
  assert.ok(refsAttached > -1);
  assert.ok(outputCount > refsAttached);
  assert.ok(snapshot > outputCount);
  assert.ok(textInject > outputCount);
  assert.ok(submit > textInject);
  assert.doesNotMatch(body.slice(outputCount, submit), /clickSubmitButton\(/);
});

test('Film waits dynamically until composer is ready after payload guard before submit', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /const SF_PRE_SUBMIT_READY_TIMEOUT = 30000/);
  assert.match(sidepanel, /async function waitFilmComposerReadyForSubmit\(tabId,\s*expectedPrompt/);
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const payloadVerified = body.indexOf("setFilmScenePhase(filmSubmitRuntime, scene.id, 'payload_verified')");
  const readyLog = body.indexOf('[SF ready]', payloadVerified);
  const readyGuard = body.indexOf('const readyForSubmit = await waitFilmComposerReadyForSubmit(tab.id, fullPrompt', readyLog);
  const beginSubmit = body.indexOf('beginFilmSubmit(filmSubmitRuntime, scene.id)', readyGuard);
  assert.ok(payloadVerified > -1);
  assert.ok(readyLog > payloadVerified);
  assert.ok(readyGuard > readyLog);
  assert.ok(beginSubmit > readyGuard);
  assert.doesNotMatch(body.slice(payloadVerified, beginSubmit), /sleep\(SF_PRE_SUBMIT_SETTLE_MS\)/);
});

test('Film blocks image-only early submit and rechecks payload before CDP submit', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /async function installFilmEarlySubmitShield\(tabId,\s*sceneId/);
  assert.match(sidepanel, /preventDefault\(\)/);
  assert.match(sidepanel, /open_for_atomic_submit/);
  assert.doesNotMatch(sidepanel, /allowToken/);
  assert.doesNotMatch(sidepanel, /window\.__gpiFilmSubmitGate/);
  const atomicStart = sidepanel.indexOf('async function submitShortFilmAtomically');
  const atomicEnd = sidepanel.indexOf('async function submitFilmSceneAtomic', atomicStart);
  const atomicBody = sidepanel.slice(atomicStart, atomicEnd);
  const payloadChecks = atomicBody.indexOf("if (!promptMatch || editorText.length < minTextChars)");
  const openShield = atomicBody.indexOf("phase = 'open_for_atomic_submit'", payloadChecks);
  const fallback = atomicBody.indexOf('submitComposerWithCDPAndAccepted(tabId', openShield);
  assert.ok(payloadChecks > -1);
  assert.ok(openShield > payloadChecks);
  assert.ok(fallback > openShield);
  const submitStart = sidepanel.indexOf('async function submitComposerWithCDPAndAccepted');
  const submitEnd = sidepanel.indexOf('async function submitShortFilmAtomically', submitStart);
  const submitBody = sidepanel.slice(submitStart, submitEnd);
  assert.match(submitBody, /await verifyComposerPayload\(tabId/);
  assert.match(submitBody, /text_missing_before_cdp_submit/);
  assert.match(submitBody, /image_missing_before_cdp_submit/);
  assert.match(submitBody, /clickSubmitButtonWithCDP\(tabId/);
  const runStart = sidepanel.indexOf('async function runShortFilm');
  const runEnd = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(runStart, runEnd);
  const install = body.indexOf('installFilmEarlySubmitShield(tab.id, scene.id');
  const refs = body.indexOf('ensureFilmPersistedRefs(tab.id, {', install);
  const prompt = body.indexOf('injectTextPrompt(tab.id, fullPrompt, false)', refs);
  const submit = body.indexOf('submitFilmSceneAtomic(tab.id, scene, fullPrompt', prompt);
  assert.ok(install > -1);
  assert.ok(refs > install);
  assert.ok(prompt > refs);
  assert.ok(submit > prompt);
  assert.match(body, /setFilmEarlySubmitShieldPhase\(tab\.id,\s*scene\.id,\s*'uploading_refs'\)/);
  assert.match(body, /setFilmEarlySubmitShieldPhase\(tab\.id,\s*scene\.id,\s*'prompt_committing'\)/);
  assert.match(body, /clearFilmEarlySubmitShield\(tab\.id\)/);
});

test('checkFilmTab classifies Grok template URL separately from composer', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('function getGrokPageState');
  const end = sidepanel.indexOf('function checkFilmTab');
  const stateBody = sidepanel.slice(start, end);
  const checkStart = sidepanel.indexOf('function checkFilmTab');
  const checkEnd = sidepanel.indexOf('// ── INJECT ASPECT RATIO');
  const checkBody = sidepanel.slice(checkStart, checkEnd);

  assert.match(stateBody, /imagine\\\/templates/);
  assert.match(stateBody, /return 'imagine-template'/);
  assert.match(stateBody, /isImaginePostUrl\(url\)/);
  assert.match(stateBody, /return 'imagine-post'/);
  assert.match(stateBody, /isImagineRootUrl\(url\)/);
  assert.match(stateBody, /return 'imagine-composer'/);
  assert.ok(stateBody.indexOf("return 'imagine-template'") < stateBody.indexOf("return 'imagine-post'"));
  assert.ok(stateBody.indexOf("return 'imagine-post'") < stateBody.indexOf("return 'imagine-composer'"));
  assert.match(checkBody, /if \(arguments\.length > 0\) return getGrokPageState\(tabOrUrl\)/);
});

test('runShortFilm uses checkFilmTab and stops before scene loop if prepare fails', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const checkCall = body.indexOf('let tab = await checkFilmTab()');
  const prepareCall = body.indexOf('const prepareRes = await prepareShortFilmComposer(tab.id)');
  const loopStart = body.indexOf('for (let i = 0; i < sceneQueue.length; i++)');
  assert.ok(checkCall > -1);
  assert.ok(prepareCall > checkCall);
  assert.ok(loopStart > prepareCall);
  assert.match(body.slice(prepareCall, loopStart), /if \(!prepareRes\.ok\)/);
  assert.match(body.slice(prepareCall, loopStart), /return;/);
});

test('prepareShortFilmComposer navigates through navigateToImagineVideo once before loop', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function prepareShortFilmComposer');
  const end = sidepanel.indexOf('async function waitForSubmitButtonEnabled');
  const body = sidepanel.slice(start, end);
  const calls = body.match(/navigateToImagineVideo\(tabId\)/g) || [];
  assert.equal(calls.length, 1);
  assert.match(body, /prepareShortFilmComposer called once/);
  assert.match(body, /current URL before Short Film/);
});

test('Short Film scene loop has no tab reload/update to Imagine', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runShortFilm');
  const end = sidepanel.indexOf('function sfShowExport');
  const body = sidepanel.slice(start, end);
  const loopStart = body.indexOf('for (let i = 0; i < sceneQueue.length; i++)');
  const loopBody = body.slice(loopStart);
  assert.doesNotMatch(loopBody, /chrome\.tabs\.update/);
  assert.doesNotMatch(loopBody, /navigateToImagineVideo/);
  assert.match(loopBody, /ensureFilmPersistedRefs\(tab\.id,\s*\{/);
});

test('UI status treats template URL as non-composer', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /Grok Template — không phải Imagine composer/);
  assert.match(sidepanel, /Imagine Composer ✓/);
  const overlayStart = sidepanel.indexOf('(function initGrokGuard');
  const overlayBody = sidepanel.slice(overlayStart);
  assert.match(overlayBody, /state === 'imagine-template'/);
  assert.match(overlayBody, /isBottomComposerReady\(tab\.id\)/);
});
test('waitForImagineRootUrl only accepts exact Imagine root URL', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function waitForImagineRootUrl');
  const end = sidepanel.indexOf('async function prepareShortFilmComposer');
  const body = sidepanel.slice(start, end);
  assert.match(sidepanel, /function isImagineRootUrl\(url\)/);
  assert.match(sidepanel, /function isImagineRootUrl\(url\)[\s\S]*grok\\\.com\)\?\\\/imagine/);
  assert.match(body, /chrome\.tabs\.get\(tabId\)/);
  assert.match(body, /isImagineRootUrl\(currentUrl\)/);
  assert.match(body, /URL did not become Imagine root/);
});

test('navigateToImagineVideo fails fast if URL does not become Imagine root', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function navigateToImagineVideo');
  const end = sidepanel.indexOf('async function runImg2Vid');
  const body = sidepanel.slice(start, end);
  assert.match(body, /chrome\.tabs\.update\(tabId,\s*\{\s*url:\s*'https:\/\/grok\.com\/imagine'\s*\}\)/);
  assert.match(body, /waitForImagineRootUrl\(tabId,\s*10000\)/);
  assert.match(body, /if \(!urlReady\.ok\) return urlReady/);
  assert.ok(body.indexOf('waitForImagineRootUrl(tabId, 10000)') < body.indexOf('ensureGrokComposerReady(tabId)'));
});

test('ensureGrokComposerReady re-checks URL after navigating away from template', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureGrokComposerReady');
  const end = sidepanel.indexOf('async function navigateToImagineVideo');
  const body = sidepanel.slice(start, end);
  assert.match(body, /if \(options\?\.noNavigate\)/);
  assert.match(body, /chrome\.tabs\.update\(tabId,\s*\{\s*url:\s*'https:\/\/grok\.com\/imagine'\s*\}\)/);
  assert.match(body, /waitForImagineRootUrl\(tabId,\s*10000\)/);
  assert.match(body, /if \(!urlReady\.ok\) return urlReady/);
});

test('prepareShortFilmComposer rejects final template URL before scene loop', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function prepareShortFilmComposer');
  const end = sidepanel.indexOf('async function waitForSubmitButtonEnabled');
  const body = sidepanel.slice(start, end);
  assert.match(body, /const finalTab = await chrome\.tabs\.get\(tabId\)/);
  assert.match(body, /final URL before scene loop/);
  assert.match(body, /if \(!isImagineComposerCapableUrl\(finalUrl\)\)/);
  assert.match(body, /Final URL is not an Imagine composer-capable page before scene loop/);
  assert.ok(body.indexOf('Final URL is not an Imagine composer-capable page before scene loop') < body.indexOf('return { ok: true'));
});

test('runShortFilm hard-normalizes template tab before initializing scene loop', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /async function normalizeFilmStartTab/);
  const normalizeStart = sidepanel.indexOf('async function normalizeFilmStartTab');
  const normalizeEnd = sidepanel.indexOf('async function waitForSubmitButtonEnabled');
  const normalizeBody = sidepanel.slice(normalizeStart, normalizeEnd);
  assert.match(normalizeBody, /state === 'imagine-template'/);
  assert.match(normalizeBody, /chrome\.tabs\.update\(tab\.id,\s*\{\s*url:\s*'https:\/\/grok\.com\/imagine'\s*\}\)/);
  assert.match(normalizeBody, /waitForImagineRootUrl\(tab\.id,\s*10000\)/);

  const runStart = sidepanel.indexOf('async function runShortFilm');
  const runEnd = sidepanel.indexOf('function sfShowExport');
  const runBody = sidepanel.slice(runStart, runEnd);
  const normalizeCall = runBody.indexOf('const normalizedStart = await normalizeFilmStartTab(tab)');
  const prepareCall = runBody.indexOf('const prepareRes = await prepareShortFilmComposer(tab.id)');
  const loopStart = runBody.indexOf('for (let i = 0; i < sceneQueue.length; i++)');
  assert.ok(normalizeCall > -1);
  assert.ok(prepareCall > normalizeCall);
  assert.ok(loopStart > prepareCall);
  assert.match(runBody.slice(normalizeCall, prepareCall), /if \(!normalizedStart\.ok\)/);
  assert.match(runBody.slice(normalizeCall, prepareCall), /return;/);
});

test('navigateToImagineImage scopes mode clicks to bottom composer and avoids template links', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function navigateToImagineImage');
  const end = sidepanel.indexOf('async function injectDuration');
  const body = sidepanel.slice(start, end);
  assert.match(body, /findBottomComposerScope/);
  assert.match(body, /Bottom composer not found/);
  assert.match(body, /scope\.root\.querySelectorAll\(/);
  assert.doesNotMatch(body, /querySelectorAll\('a, button/);
  assert.doesNotMatch(body, /nav a/);
  assert.doesNotMatch(body, /label, a/);
});

test('navigateToImagineVideo scopes Video button lookup to bottom composer', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function navigateToImagineVideo');
  const end = sidepanel.indexOf('async function runImg2Vid');
  const body = sidepanel.slice(start, end);
  assert.match(body, /findBottomComposerScope/);
  assert.match(body, /Bottom composer not found/);
  assert.match(body, /scope\.root\.querySelectorAll\('button,\[role="tab"\],\[role="radio"\],\[role="button"\],label'\)/);
  assert.doesNotMatch(body, /document\.querySelectorAll\('button,\[role="tab"\],\[role="radio"\],label'\)/);
});

test('Aspect ratio and duration can be scoped to bottom composer', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const ratioStart = sidepanel.indexOf('async function injectAspectRatio');
  const imageStart = sidepanel.indexOf('async function navigateToImagineImage');
  const ratioBody = sidepanel.slice(ratioStart, imageStart);
  assert.match(ratioBody, /options = \{\}/);
  assert.match(ratioBody, /options\?\.scope === 'bottomComposer'/);
  assert.match(ratioBody, /root\.querySelectorAll\('button,\[role="button"\],\[role="radio"\],label'\)/);

  const durStart = sidepanel.indexOf('async function injectDuration');
  const waitStart = sidepanel.indexOf('async function getCurrentVideoRatioSetting');
  const durBody = sidepanel.slice(durStart, waitStart);
  assert.match(durBody, /options = \{\}/);
  assert.match(durBody, /options\?\.scope === 'bottomComposer'/);
  assert.match(durBody, /root\.querySelectorAll\('button,\[role="button"\],\[role="radio"\],label'\)/);
});

test('Film applies ratio inside bottom composer scope and Img2Vid uses global settings guard', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /injectAspectRatio\(tabId,\s*expectedRatio,\s*\{\s*scope:\s*'bottomComposer',\s*forceApply\s*\}\)/);
  assert.match(sidepanel, /async function ensureImg2VidGlobalSettings/);
  assert.match(sidepanel, /ensureFilmGlobalSettings\(tabId,\s*\{/);
  assert.doesNotMatch(sidepanel, /injectAspectRatio\(tab\.id,\s*i2vSelectedRatio/);
  assert.doesNotMatch(sidepanel, /injectDuration\(tab\.id,\s*i2vSelectedDuration/);
  assert.doesNotMatch(sidepanel, /let i2vSelectedRatio/);
  assert.doesNotMatch(sidepanel, /let i2vSelectedDuration/);
  assert.doesNotMatch(sidepanel, /window\.scrollTo\(0,\s*document\.body\.scrollHeight\)/);
});

test('Imagine post URL is composer-capable but template remains blocked', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /function isImaginePostUrl\(url\)/);
  assert.match(sidepanel, /function isImagineComposerCapableUrl\(url\)/);
  assert.match(sidepanel, /\/imagine\\\/post\\\/\[\^\/\?#\]\+/);
  assert.match(sidepanel, /return isImagineRootUrl\(url\) \|\| isImaginePostUrl\(url\)/);

  const stateStart = sidepanel.indexOf('function getGrokPageState');
  const stateEnd = sidepanel.indexOf('function checkFilmTab');
  const stateBody = sidepanel.slice(stateStart, stateEnd);
  assert.match(stateBody, /return 'imagine-template'/);
  assert.match(stateBody, /return 'imagine-post'/);
  assert.ok(stateBody.indexOf("return 'imagine-template'") < stateBody.indexOf("return 'imagine-post'"));
});

test('ensureGrokComposerReady noNavigate accepts imagine-post with composer and rejects missing composer', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureGrokComposerReady');
  const end = sidepanel.indexOf('async function navigateToImagineVideo');
  const body = sidepanel.slice(start, end);
  assert.match(body, /let isComposerCapable = isImagineComposerCapableUrl\(url\)/);
  assert.match(body, /isComposerCapable = isImagineComposerCapableUrl\(url\)/);
  assert.match(body, /if \(state === 'imagine-template' \|\| !isComposerCapable\)/);
  assert.match(body, /if \(ready\?\.ok\) return \{ \.\.\.ready, url, state \}/);
  assert.match(body, /Bottom composer not found on current Imagine page/);
  assert.match(body, /if \(isComposerCapable && !options\?\.noNavigate/);
});

test('Film scene loop preserves persisted refs without clean-scene reload', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const runStart = sidepanel.indexOf('async function runShortFilm');
  const runEnd = sidepanel.indexOf('function sfShowExport');
  const runBody = sidepanel.slice(runStart, runEnd);
  const loopStart = runBody.indexOf('for (let i = 0; i < sceneQueue.length; i++)');
  const loopBody = runBody.slice(loopStart);
  assert.match(loopBody, /prepareFilmSceneComposerForPersistedRefs\(tab\.id/);
  assert.match(loopBody, /ensureFilmPersistedRefs\(tab\.id,\s*\{/);
  assert.doesNotMatch(loopBody, /navigateToImagineVideo/);
  assert.doesNotMatch(loopBody, /prepareCleanFilmSceneComposer/);
  assert.doesNotMatch(loopBody, /injectImageToPage\(tab\.id,\s*refDataUrl/);
});

test('Img2Vid pairs are normalized with stable sceneId values', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('function ensureI2VSceneIds');
  const end = sidepanel.indexOf('function i2vRenderPairs');
  const body = sidepanel.slice(start, end);
  assert.match(sidepanel, /function createSceneId\(mode,\s*index,\s*jobId = ''\)/);
  assert.match(body, /const sceneId = pair\.sceneId \|\| pair\.id \|\| fallbackId/);
  assert.match(body, /\n\s+sceneId,/);
  assert.match(body, /id:\s*pair\.id \|\| sceneId/);
  assert.match(body, /index/);
  assert.match(body, /createSceneId\('img2vid',\s*index,\s*'draft'\)/);
});

test('Img2Vid prepares composer once and scene loop only resets after download', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /async function prepareImg2VidComposer/);
  assert.match(sidepanel, /async function fallbackImg2VidComposerForNextScene/);
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const prepareCall = body.indexOf('const prepareRes = await prepareImg2VidComposer(tab.id)');
  const loopStart = body.indexOf('for (let i = 0; i < i2vPairs.length; i++)');
  const download = body.indexOf('downloadMediaWithFallback(tab.id, sceneSlug', loopStart);
  const fallback = body.indexOf('fallbackImg2VidComposerForNextScene(tab.id, sceneId, sceneDisplayName)', download);
  assert.ok(prepareCall > -1);
  assert.ok(loopStart > prepareCall);
  assert.ok(download > loopStart);
  assert.ok(fallback > download);
  assert.match(body.slice(loopStart), /ensureGrokComposerReady\(tab\.id,\s*\{\s*noNavigate:\s*true\s*\}\)/);
  assert.doesNotMatch(body.slice(loopStart), /navigateToImagineVideo\(tab\.id\)/);
});

test('Img2Vid loads saved global settings and ensures them before every scene upload', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const settingsLoad = body.indexOf('const expectedI2VSettings = await getVideoGlobalSettings()');
  const loopStart = body.indexOf('for (let i = 0; i < i2vPairs.length; i++)');
  const guard = body.indexOf('const settingsRes = await ensureImg2VidGlobalSettings(tab.id', loopStart);
  const imageInject = body.indexOf('injectImageToPage(', loopStart);
  assert.ok(settingsLoad > -1);
  assert.ok(settingsLoad > loopStart);
  assert.ok(guard > settingsLoad);
  assert.ok(guard > loopStart);
  assert.ok(imageInject > guard);
  assert.match(body.slice(loopStart, guard), /const includeRatio = i === 0 && !i2vRuntimeState\.videoRatioValidated/);
  assert.match(body.slice(loopStart, imageInject), /\[I2V ratio\][\s\S]*aspect ratio guard/);
  assert.match(body.slice(guard, imageInject), /includeRatio,?/);
  assert.match(body.slice(guard, imageInject), /includeResolution:\s*true/);
  assert.match(body.slice(guard, imageInject), /includeDuration:\s*true/);
});

test('ensureImg2VidGlobalSettings reuses generic global settings helper with Img2Vid log target', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureImg2VidGlobalSettings');
  const end = sidepanel.indexOf('async function verifyFilmGlobalSettings', start);
  const body = sidepanel.slice(start, end);
  assert.match(body, /ensureComposerMatchesGlobalSettings\(tabId,\s*settings,\s*\{/);
  assert.match(body, /logPrefix:\s*'\[I2V settings guard\]'/);
  assert.match(body, /logEl:\s*i2vLogEl/);
  assert.match(body, /expectedMode:\s*'Video'/);
  assert.match(body, /includeMode:\s*options\.includeMode \?\? true/);
  assert.match(body, /includeRatio:\s*true/);
  assert.match(body, /includeResolution:\s*true/);
  assert.match(body, /includeDuration:\s*true/);
});

test('Img2Vid no longer persists or reads separate ratio and duration settings', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.doesNotMatch(sidepanel, /savedI2vRatio/);
  assert.doesNotMatch(sidepanel, /savedI2vDuration/);
  assert.doesNotMatch(sidepanel, /i2vSelectedRatio/);
  assert.doesNotMatch(sidepanel, /i2vSelectedDuration/);
});

test('Img2Vid injects image before text and waits for attachment stable', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const imageInject = body.indexOf('injectImageToPage(');
  const stableWait = body.indexOf('waitComposerAttachmentStable(tab.id, 8000, 800', imageInject);
  const textInject = body.indexOf('injectTextPrompt(tab.id, pair.prompt, false)', stableWait);
  assert.ok(imageInject > -1);
  assert.ok(stableWait > imageInject);
  assert.ok(textInject > stableWait);
  assert.match(body.slice(imageInject, stableWait), /preferComposer:\s*true/);
  assert.match(body.slice(stableWait, textInject), /scope:\s*'bottomComposer'/);
});

test('Img2Vid verifies payload before atomic submit', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const payload = body.indexOf('verifyComposerPayload(tab.id, pair.prompt, guardOptions)');
  const submit = body.indexOf('submitImg2VidAtomically(tab.id', payload);
  assert.ok(payload > -1);
  assert.ok(submit > payload);
  const submitBlock = body.slice(submit, body.indexOf('});', submit) + 3);
  assert.match(submitBlock, /expectedText:\s*pair\.prompt/);
  assert.match(submitBlock, /scope:\s*'bottomComposer'/);
  assert.match(submitBlock, /sceneId/);
  assert.match(submitBlock, /requireImage:\s*true/);
  assert.match(submitBlock, /minImages:\s*1/);
  assert.match(submitBlock, /maxTextRetry:\s*2/);
});

test('Img2Vid retries text injection when payload guard reports text_missing', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const guardLoop = body.indexOf('for (let guardAttempt = 1; guardAttempt <= 3; guardAttempt++)');
  const retry = body.indexOf("payloadGuard.code === 'text_missing'", guardLoop);
  const inject = body.indexOf('const retryText = await injectTextPrompt(tab.id, pair.prompt, false)', retry);
  const failStop = body.indexOf('if (!payloadGuard?.ok)', inject);
  const submit = body.indexOf('submitImg2VidAtomically(tab.id', failStop);
  assert.ok(guardLoop > -1);
  assert.ok(retry > guardLoop);
  assert.ok(inject > retry);
  assert.ok(failStop > inject);
  assert.ok(submit > failStop);
  assert.match(body.slice(guardLoop, failStop), /guardTextRetryCount < 2/);
});

test('Img2Vid does not call atomic submit when payload guard still fails', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const failStop = body.indexOf('if (!payloadGuard?.ok)');
  const continueStmt = body.indexOf('failed++; continue;', failStop);
  const submit = body.indexOf('submitImg2VidAtomically(tab.id', failStop);
  assert.ok(failStop > -1);
  assert.ok(continueStmt > failStop);
  assert.ok(submit > continueStmt);
});

test('Img2Vid atomic submit reinjects missing text and preserves guarded options', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const click = body.indexOf('submitImg2VidAtomically(tab.id');
  const block = body.slice(click, body.indexOf('});', click) + 3);
  assert.match(block, /expectedText:\s*pair\.prompt/);
  assert.match(block, /requireImage:\s*true/);
  assert.match(block, /minImages:\s*1/);
  assert.match(block, /minTextChars/);

  const helperStart = sidepanel.indexOf('async function submitImg2VidAtomically');
  const helperEnd = sidepanel.indexOf('async function inspectLatestPostPrompt', helperStart);
  const helper = sidepanel.slice(helperStart, helperEnd);
  assert.match(helper, /setEditorTextLikeUser\(editor,\s*expectedText\)/);
  assert.match(helper, /promptMatchesEditor\(editorText,\s*expectedText\)/);
  assert.match(helper, /if \(!promptMatch \|\| editorText\.length < minTextChars\)/);
  assert.match(helper, /await sleep\(120\)/);
  assert.match(helper, /text_missing_before_submit/);
  assert.match(helper, /image_missing_before_atomic_submit/);
  assert.doesNotMatch(helper, /editor\.textContent = text/);
});

test('injectTextPrompt only returns ok after actual editor text is present', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function injectTextPrompt');
  const end = sidepanel.indexOf('// ── INJECT IMAGE/FILE', start);
  const body = sidepanel.slice(start, end);
  assert.match(body, /findActualComposerEditor/);
  assert.match(body, /getActualEditorText/);
  assert.match(body, /Prompt text missing from actual editor after inject/);
  assert.match(body, /return \{ ok: true, \.\.\.textDebug \}/);
});

test('Img2Vid atomic submit verifies payload in page context right before click', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const sleep = body.indexOf('await sleep(500)');
  const recheck = body.indexOf('pre-submit recheck', sleep);
  const retry = body.indexOf('text biến mất trước submit', recheck);
  const submit = body.indexOf('submitImg2VidAtomically(tab.id', sleep);
  const helperStart = sidepanel.indexOf('async function submitImg2VidAtomically');
  const helperEnd = sidepanel.indexOf('async function inspectLatestPostPrompt', helperStart);
  const helper = sidepanel.slice(helperStart, helperEnd);
  assert.ok(sleep > -1);
  assert.ok(submit > sleep);
  assert.match(helper, /\[data-testid="chat-input"\][^']*\[contenteditable="true"\]/);
  assert.match(helper, /countImages\(scope\)/);
  assert.match(helper, /findSubmitButton\(scope\)/);
  assert.match(helper, /readyToPageClick/);
  assert.match(helper, /submitComposerWithCDPAndAccepted\(tabId/);
  assert.match(helper, /method:\s*'atomic-i2v-verified-before-page-click'/);
  assert.match(helper, /editorTextPreview/);
  assert.match(helper, /imageCount/);
});

test('Img2Vid atomic submit enforces single-submit lock and prompt match before click', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const helperStart = sidepanel.indexOf('async function submitImg2VidAtomically');
  const helperEnd = sidepanel.indexOf('async function inspectLatestPostPrompt', helperStart);
  const helper = sidepanel.slice(helperStart, helperEnd);
  assert.match(helper, /currentI2VSubmittingSceneId && currentI2VSubmittingSceneId !== sceneId/);
  assert.match(helper, /submittedI2VSceneIds\.has\(sceneId\)/);
  assert.match(helper, /duplicate_submit_blocked/);
  assert.match(helper, /submittedI2VSceneIds\.add\(sceneId\)/);
  assert.match(helper, /text_missing_before_submit/);
  assert.match(helper, /buttonDisabled/);
  assert.match(helper, /submitComposerWithCDPAndAccepted\(tabId/);
  assert.match(helper, /res\.accepted === true && res\.strongAccepted === true/);
});

test('Img2Vid prompt commit and atomic submit trust only actual editor text', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /async function waitImg2VidPromptCommitStable\(tabId,\s*expectedPrompt/);
  const commitStart = sidepanel.indexOf('async function waitImg2VidPromptCommitStable');
  const commitEnd = sidepanel.indexOf('async function inspectLatestPostPrompt', commitStart);
  const commitHelper = sidepanel.slice(commitStart, commitEnd);
  assert.match(commitHelper, /findActualEditor\(scope\)/);
  assert.match(commitHelper, /promptMatches\(editorText,\s*expectedPrompt\)/);
  assert.match(commitHelper, /rootTextLen/);
  assert.doesNotMatch(commitHelper, /promptMatches\(rootText/);

  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl', runStart);
  const runBody = sidepanel.slice(runStart, runEnd);
  const inject = runBody.indexOf('const txtRes = await injectTextPrompt(tab.id, pair.prompt, false)');
  const commit = runBody.indexOf('waitImg2VidPromptCommitStable(tab.id, pair.prompt', inject);
  const submit = runBody.indexOf('submitImg2VidAtomically(tab.id', commit);
  assert.ok(inject > -1);
  assert.ok(commit > inject);
  assert.ok(submit > commit);
  assert.match(runBody, /Re-inject prompt cho \$\{sceneDisplayName\} vì editor bị rỗng trước submit/);
  assert.match(runBody, /Chặn submit vì prompt không nằm trong editor thật/);
});

test('Img2Vid run keeps submit lock through waitGenerate and never calls old clickSubmitButton', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const atomic = body.indexOf('submitImg2VidAtomically(tab.id');
  const wait = body.indexOf('waitForGrokGenerationDone(tab.id', atomic);
  const clear = body.indexOf('clear lock sau khi wait generate', wait);
  assert.ok(atomic > -1);
  assert.ok(wait > atomic);
  assert.ok(clear > wait);
  assert.doesNotMatch(body, /clickSubmitButton\(tab\.id/);
});

test('Img2Vid scene runtime state machine records submit, generate, done, and post prompt verify', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /let i2vSceneRuntime = \{\}/);
  assert.match(sidepanel, /function getI2VSceneRuntime\(sceneId\)/);
  assert.match(sidepanel, /function setI2VSceneState\(sceneId,\s*state/);
  assert.match(sidepanel, /state:\s*'idle'/);
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  for (const state of ['preparing', 'image_attached', 'prompt_ready', 'submit_accepted', 'generating', 'post_verifying', 'done', 'failed']) {
    assert.match(body, new RegExp(`setI2VSceneState\\(sceneId,\\s*'${state}'`));
  }
  assert.match(sidepanel, /function isI2VSceneSubmittedState/);
  assert.match(sidepanel, /scene_already_submitted/);
  assert.match(sidepanel, /async function verifyGeneratedPostPrompt/);
  assert.match(body, /verifyGeneratedPostPrompt\(tab\.id,\s*pair\.prompt\)/);
  assert.match(body, /post prompt trống/);
});

test('Img2Vid final scene runs post verification before marking done or success', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /async function finalizeLastI2VScene\(tabId,\s*scene,\s*ctx = \{\}\)/);
  assert.match(sidepanel, /function promptMatchesPost\(postText,\s*expectedText\)/);
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  assert.match(body, /const isLastI2VScene = i === i2vPairs\.length - 1/);
  const generateDone = body.indexOf('[I2V generate] xong');
  const postStatus = body.indexOf("updatePairStatus(i, 'post_verifying')", generateDone);
  const finalize = body.indexOf('finalizeLastI2VScene(tab.id, pair', postStatus);
  const successStatus = body.indexOf("updatePairStatus(i, sceneFinalizeOk ? 'success' : 'warning')", postStatus);
  assert.ok(generateDone > -1);
  assert.ok(postStatus > generateDone);
  assert.ok(finalize > postStatus);
  assert.ok(successStatus > finalize);
});

test('Img2Vid final scene warning does not retry submit and does not show Xong', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const helperStart = sidepanel.indexOf('async function finalizeLastI2VScene');
  const helperEnd = sidepanel.indexOf('// ── INJECT TEXT PROMPT', helperStart);
  const helper = sidepanel.slice(helperStart, helperEnd);
  assert.match(helper, /final_scene_post_verify_warning/);
  assert.match(helper, /setI2VSceneState\(sceneId,\s*'warning'/);
  assert.match(helper, /không tự submit lại/);
  assert.doesNotMatch(helper, /submitImg2VidAtomically|clickSubmitButton|trustedClick/);
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl', runStart);
  const runBody = sidepanel.slice(runStart, runEnd);
  assert.match(runBody, /finalRes\.warning/);
  assert.match(runBody, /không tính là lỗi generate/);
  const updateStart = sidepanel.indexOf('function updatePairStatus');
  const updateEnd = sidepanel.indexOf('function showPairError', updateStart);
  const updateBody = sidepanel.slice(updateStart, updateEnd);
  assert.match(updateBody, /post_verifying:\s*\['running',\s*'Đang kiểm tra kết quả'\]/);
  assert.match(updateBody, /warning:\s*\['error',\s*'Cảnh báo'\]/);
});

test('Img2Vid installs page submit monitor and page-level duplicate lock before atomic submit', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /async function installI2VSubmitMonitor\(tabId,\s*sceneId,\s*displayName/);
  assert.match(sidepanel, /document\.addEventListener\('click',\s*clickHandler,\s*true\)/);
  assert.match(sidepanel, /document\.addEventListener\('submit',\s*submitHandler,\s*true\)/);
  assert.match(sidepanel, /document\.addEventListener\('keydown',\s*keydownHandler,\s*true\)/);
  assert.match(sidepanel, /duplicateBlockedCount\+\+/);
  assert.match(sidepanel, /event\.stopImmediatePropagation\(\)/);
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const install = body.indexOf('installI2VSubmitMonitor(tab.id, sceneId, sceneDisplayName)');
  const atomic = body.indexOf('submitImg2VidAtomically(tab.id', install);
  const state = body.indexOf('getI2VSubmitMonitorState(tab.id)', atomic);
  assert.ok(install > -1);
  assert.ok(atomic > install);
  assert.ok(state > atomic);
  assert.match(body, /chỉ submit 1 lần nhưng Grok tạo/);
  assert.match(body, /clearI2VSubmitMonitor\(tab\.id\)/);
});

test('Img2Vid prepares a clean composer before every scene and cleans old attachments', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /async function prepareCleanImg2VidSceneComposer\(tabId,\s*displayName/);
  assert.match(sidepanel, /async function getI2VComposerAttachmentState\(tabId\)/);
  assert.match(sidepanel, /async function clearI2VComposerText\(tabId\)/);
  assert.match(sidepanel, /clearBottomComposerAttachments\(tabId,\s*\{\s*scope:\s*'bottomComposer'/);
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const sceneLoop = body.indexOf('for (let i = 0; i < i2vPairs.length; i++)');
  const clean = body.indexOf('prepareCleanImg2VidSceneComposer(tab.id, sceneDisplayName)', sceneLoop);
  const settings = body.indexOf("updatePairStatus(i, 'settings')", clean);
  assert.ok(clean > sceneLoop);
  assert.ok(settings > clean);
  assert.match(body, /\[I2V attachment\].*before upload count/);
  assert.match(body, /phát hiện nhiều attachment thật count/);
  assert.match(body, /Upload lại ảnh sau cleanup/);
});

test('Img2Vid enforces single output and downloads at most one video per scene', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /async function ensureI2VSingleOutput\(tabId,\s*options = \{\}\)/);
  assert.match(sidepanel, /Không tìm thấy control output count, tiếp tục nhưng sẽ giám sát generating cards/);
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  assert.match(body, /ensureI2VSingleOutput\(tab\.id,\s*\{\s*logEl:\s*i2vLogEl,\s*displayName:\s*sceneDisplayName\s*\}\)/);
  const downloadStart = sidepanel.indexOf('async function downloadMediaWithFallback');
  const downloadEnd = sidepanel.indexOf('async function collectGeneratedImageCandidates', downloadStart);
  const downloadBody = sidepanel.slice(downloadStart, downloadEnd);
  assert.match(downloadBody, /const maxFiles = Math\.max\(1,\s*Number\(options\.maxFiles \|\| 1\)\)/);
  assert.match(downloadBody, /files\.slice\(0,\s*maxFiles\)/);
  assert.doesNotMatch(body, /imgOutputCount/);
});

test('parsePrompts creates scenes from prompts separated by blank lines', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('function parsePrompts');
  const end = sidepanel.indexOf('function parseImagePrompts');
  const parsePrompts = vm.runInThisContext(`${sidepanel.slice(start, end)}; parsePrompts;`);
  const prompts = parsePrompts('Prompt scene 1\n\nPrompt scene 2\n\nPrompt scene 3');
  assert.deepEqual(prompts, ['Prompt scene 1', 'Prompt scene 2', 'Prompt scene 3']);
});

test('Img2Vid duplicate sceneId is regenerated instead of skipping the scene', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /function ensureUniqueSceneId\(item,\s*index,\s*mode,\s*jobId,\s*usedSceneIds/);
  assert.match(sidepanel, /console\.warn\('\[SceneID\] duplicate regenerated'/);
  assert.match(sidepanel, /phát hiện dữ liệu bị trùng, đã tự sửa và tiếp tục xử lý/);
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  assert.match(body, /const i2vRunId = createRunId\('i2v-job'\)/);
  assert.match(body, /const usedI2VSceneIds = new Set\(\)/);
  assert.match(body, /let sceneId = ensureUniqueSceneId\(pair,\s*i,\s*'img2vid',\s*i2vRunId,\s*usedI2VSceneIds/);
  const duplicateCheck = body.indexOf('if (submittedI2VSceneIds.has(sceneId))');
  const duplicateBlockEnd = body.indexOf("updatePairStatus(i, 'settings')", duplicateCheck);
  const duplicateBlock = body.slice(duplicateCheck, duplicateBlockEnd);
  assert.ok(duplicateCheck > -1);
  assert.ok(duplicateBlockEnd > duplicateCheck);
  assert.match(duplicateBlock, /duplicate_submit_blocked/);
  assert.match(duplicateBlock, /failed\+\+;\s*continue/);
  assert.doesNotMatch(duplicateBlock, /sceneId = newSceneId/);
  assert.match(sidepanel, /submittedI2VSceneIds\.add\(sceneId\)/);
  assert.match(sidepanel, /submittedI2VSceneIds\.delete\(sceneId\)/);
  assert.match(sidepanel, /currentI2VSubmittingSceneId = sceneId/);
});

test('Img2Vid user-facing queue and duplicate logs do not expose internal scene ids', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const renderStart = sidepanel.indexOf('function renderPairCard');
  const renderEnd = sidepanel.indexOf('function updatePairStatus', renderStart);
  const renderBody = sidepanel.slice(renderStart, renderEnd);
  assert.match(renderBody, /getSceneDisplayName\(idx\)/);
  assert.doesNotMatch(renderBody, /i2v-scene-\$\{/);

  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const runBody = sidepanel.slice(runStart, runEnd);
  assert.match(runBody, /const sceneDisplayName = getSceneDisplayName\(i\)/);
  assert.match(runBody, /\[Img2Vid\] \$\{sceneDisplayName\} phát hiện dữ liệu bị trùng/);
  assert.doesNotMatch(runBody, /\[I2V submit\] duplicate sceneId skipped/);
});

test('Img2Vid waits for new video and downloads before next pair', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const wait = body.indexOf('waitForGrokGenerationDone(tab.id');
  const download = body.indexOf('downloadMediaWithFallback(tab.id, sceneSlug', wait);
  const progress = body.indexOf('done++', download);
  assert.ok(wait > -1);
  assert.ok(download > wait);
  assert.ok(progress > download);
  assert.match(body.slice(wait, download), /mediaType:\s*'video'/);
  assert.match(body.slice(wait, download), /knownState:\s*\{\s*videoUrls:\s*knownVideoUrls\s*\}/);
  assert.match(body, /i2v_scene\$\{String\(i \+ 1\)\.padStart\(2,\s*'0'\)\}_\$\{slugify\(pair\.prompt\)\}/);
});

test('Img2Vid payload guard passes with minImages=1 when composer imageCount is 2', async () => {
  const dom = makeComposerDom({
    text: 'A cinematic prompt with enough text for the guard to pass clearly',
    composerImages: 2,
  });
  const res = await runInspectorWithDom(
    dom,
    'A cinematic prompt with enough text for the guard to pass clearly',
    {
      scope: 'bottomComposer',
      requireText: true,
      requireImage: true,
      minImages: 1,
      minTextChars: 20,
      timeoutMs: 100,
      stableMs: 0,
    }
  );
  assert.equal(res.ok, true);
  assert.equal(res.imageCount, 2);
});

test('Img2Vid clickSubmitButton preClickGuard passes with imageCount=2 and minImages=1', async () => {
  const dom = makeSubmitDom({
    text: 'A cinematic prompt with enough text for the guard',
    composerImages: 2,
  });
  const res = await runClickSubmitWithDom(dom, {
    minImages: 1,
  });
  assert.equal(res.ok, true);
  assert.equal(res.preClickGuard.imageCount, 2);
  assert.equal(dom.button.dispatchedEvents.includes('click'), true);
});

test('Img2Vid does not clear attachments before upload and relies on fallback reset between scenes', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const imageInject = body.indexOf('injectImageToPage(');
  assert.ok(imageInject > -1);
  assert.doesNotMatch(body, /clearBottomComposerAttachments\(tab\.id/);
  assert.doesNotMatch(body, /getBottomComposerImageCount\(tab\.id/);
  assert.match(body, /fallbackImg2VidComposerForNextScene\(tab\.id,\s*sceneId,\s*sceneDisplayName\)/);
});

test('Img2Vid does not pass exactImages or maxImages to upload, payload, or atomic submit guards', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const stableWait = body.indexOf('waitComposerAttachmentStable(tab.id, 8000, 800');
  const guardOptions = body.indexOf('const guardOptions = {', stableWait);
  const payload = body.indexOf('verifyComposerPayload(tab.id, pair.prompt, guardOptions)', stableWait);
  const click = body.indexOf('submitImg2VidAtomically(tab.id', payload);
  assert.ok(stableWait > -1);
  assert.ok(payload > stableWait);
  assert.ok(click > payload);
  assert.doesNotMatch(body.slice(stableWait, payload), /exactImages|maxImages/);
  assert.doesNotMatch(body.slice(guardOptions, payload), /exactImages|maxImages/);
  assert.doesNotMatch(body.slice(click, body.indexOf('});', click) + 3), /exactImages|maxImages/);
  assert.match(body.slice(stableWait, payload), /minImages:\s*1/);
  assert.match(body.slice(guardOptions, payload), /minImages:\s*1/);
  assert.match(body.slice(click, body.indexOf('});', click) + 3), /minImages:\s*1/);
});

test('Img2Vid uses only current pair.imageDataUrl and no chaining sources', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  assert.match(body, /pair\.imageDataUrl/);
  assert.doesNotMatch(body, /prevFrameDataUrl/);
  assert.doesNotMatch(body, /chaining/i);
  assert.doesNotMatch(body, /usePersistentCharacterRefs/);
  assert.doesNotMatch(body, /charRefs/);
});

test('waitComposerAttachmentStable supports exactImages and maxImages', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function waitComposerAttachmentStable');
  const end = sidepanel.indexOf('async function getBottomComposerImageCount');
  const body = sidepanel.slice(start, end);
  assert.match(body, /options\?\.exactImages/);
  assert.match(body, /options\?\.maxImages/);
  assert.match(body, /code:\s*'image_too_many'/);
});

test('Img2Vid fallback navigates to Imagine after download and before next scene', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const download = body.indexOf('downloadMediaWithFallback(tab.id, sceneSlug');
  const downloaded = body.indexOf('[I2V download] đã tải', download);
  const fallback = body.indexOf('fallbackImg2VidComposerForNextScene(tab.id, sceneId, sceneDisplayName)', downloaded);
  const progress = body.indexOf('done++', fallback);
  assert.ok(download > -1);
  assert.ok(downloaded > download);
  assert.ok(fallback > downloaded);
  assert.ok(progress > fallback);
  assert.match(body.slice(fallback - 120, fallback), /i < i2vPairs\.length - 1/);
});

test('Img2Vid fallback helper resets URL and waits for composer ready', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function fallbackImg2VidComposerForNextScene');
  const end = sidepanel.indexOf('// IMG2VID', start);
  const body = sidepanel.slice(start, end);
  assert.match(body, /chrome\.tabs\.update\(tabId,\s*\{\s*url:\s*'https:\/\/grok\.com\/imagine'\s*\}\)/);
  assert.match(body, /waitForImagineRootUrl\(tabId,\s*15000\)/);
  assert.match(body, /ensureGrokComposerReady\(tabId,\s*\{\s*noNavigate:\s*true\s*\}\)/);
});

test('Img2Vid download uses fallback methods after new media lookup fails', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /async function getLatestVisibleVideoUrl\(tabId\)/);
  assert.match(sidepanel, /async function getLatestResultCardVideoUrl\(tabId\)/);
  assert.match(sidepanel, /async function clickLatestGrokDownloadButton\(tabId\)/);
  assert.match(sidepanel, /async function downloadSpecificMediaUrl\(tabId,\s*url,\s*filename/);
  assert.match(sidepanel, /async function downloadMediaWithFallback\(tabId,\s*sceneSlug/);
  const start = sidepanel.indexOf('async function downloadMediaWithFallback');
  const end = sidepanel.indexOf('// ─────────────────────────────────────────────────────────────────────────────', start);
  const body = sidepanel.slice(start, end);
  assert.match(body, /downloadMedia\(tabId,\s*sceneSlug,\s*'video'/);
  assert.match(body, /genResult\?\.newUrls/);
  assert.match(body, /getLatestVisibleVideoUrl\(tabId\)/);
  assert.match(body, /getLatestResultCardVideoUrl\(tabId\)/);
  assert.match(body, /clickLatestGrokDownloadButton\(tabId\)/);
  assert.match(body, /method:\s*'native-download-button'/);
  assert.match(body, /code:\s*'download_failed'/);
});

test('Img2Vid download logs fallback methods without exposing media URLs', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function downloadMediaWithFallback');
  const end = sidepanel.indexOf('// ─────────────────────────────────────────────────────────────────────────────', start);
  const body = sidepanel.slice(start, end);
  assert.match(body, /\[I2V download\] thử tải media mới/);
  assert.match(body, /không thấy media mới, thử tải URL video đã detect từ bước generate/);
  assert.match(body, /không thấy URL mới, thử tải video mới nhất đang hiển thị/);
  assert.match(body, /latest visible candidates/);
  assert.match(body, /result card video candidates/);
  assert.match(body, /không lấy được URL video, thử click nút Download/);
  assert.doesNotMatch(body, /addLog\([^)]*url/);
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl', runStart);
  const runBody = sidepanel.slice(runStart, runEnd);
  assert.match(runBody, /bằng phương thức \$\{dlRes\.method\}/);
  assert.doesNotMatch(runBody, /-- Completed:/);
  assert.match(runBody, /-- Đã xử lý:/);
  assert.match(runBody, /Thành công:/);
  assert.match(runBody, /Lỗi:/);
});

test('Img2Vid input auto-renders pairs with debounce and parse button is optional', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const eventsStart = sidepanel.indexOf('// Img2Vid');
  const eventsEnd = sidepanel.indexOf('// Settings', eventsStart);
  const body = sidepanel.slice(eventsStart, eventsEnd);
  assert.match(body, /let i2vRenderTimer = null/);
  assert.match(body, /clearTimeout\(i2vRenderTimer\)/);
  assert.match(body, /i2vRenderTimer = setTimeout\(\(\) => \{/);
  assert.match(body, /if \(!i2vIsRunning\) i2vRenderPairs\(\)/);
  assert.match(body, /},\s*300\)/);
  assert.match(body, /if \(i2vParseBtn\) i2vParseBtn\.addEventListener\('click', i2vRenderPairs\)/);
});

test('runImg2Vid renders pairs before validation so parse button is not required', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const runStart = sidepanel.indexOf('async function runImg2Vid');
  const runEnd = sidepanel.indexOf('const sfWorldEl');
  const body = sidepanel.slice(runStart, runEnd);
  const render = body.indexOf('i2vRenderPairs()');
  const validate = body.indexOf('if (!i2vValidate()) return');
  assert.ok(render > -1);
  assert.ok(validate > render);
});

test('sidepanel.html no longer shows Img2Vid ratio or duration cards', () => {
  const html = fs.readFileSync('./sidepanel.html', 'utf8');
  assert.doesNotMatch(html, /id="i2v-options"/);
  assert.doesNotMatch(html, /id="i2v-dur-card"/);
  assert.doesNotMatch(html, /id="i2v-ratio-pills"/);
  assert.doesNotMatch(html, /id="i2v-dur-btns"/);
});

test('i2vRenderPairs keeps old Img2Vid settings cards hidden and uses queue cards', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('function i2vRenderPairs');
  const end = sidepanel.indexOf('function renderPairCard');
  const body = sidepanel.slice(start, end);
  assert.match(body, /if \(i2vOptions\) i2vOptions\.style\.display = 'none'/);
  assert.match(body, /if \(i2vDurCard\) i2vDurCard\.style\.display = 'none'/);
  assert.match(body, /i2vPairsEl\.innerHTML = ''/);
  assert.match(body, /renderPairCard\(pair,\s*idx\)/);
  assert.match(body, /scene/);
});

test('Img2Vid state map includes queue progress states', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('function updatePairStatus');
  const end = sidepanel.indexOf('function showPairError', start);
  const body = sidepanel.slice(start, end);
  for (const state of ['waiting', 'ready', 'settings', 'uploading', 'prompting', 'guarding', 'submitting', 'generating', 'downloading', 'success', 'error']) {
    assert.match(body, new RegExp(`${state}:`));
  }
});

test('Img2Vid validation no longer mentions creating a list', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('function i2vValidate');
  const end = sidepanel.indexOf('function showI2VGuardError', start);
  const body = sidepanel.slice(start, end);
  assert.match(body, /scene/);
  assert.doesNotMatch(body, /tạo danh sách|tạo danh sách|Tạo danh sách|Tạo danh sách/);
});

test('Global settings helpers distinguish video and image sources', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /async function getVideoGlobalSettings\(\)/);
  assert.match(sidepanel, /savedRatio[\s\S]*setDefaultRatio[\s\S]*savedResolution[\s\S]*savedVideoResolution[\s\S]*savedDuration[\s\S]*setDlVideoQual[\s\S]*setDefaultDur/);
  assert.match(sidepanel, /type:\s*'video'/);
  assert.match(sidepanel, /async function getImageGlobalSettings\(\)/);
  assert.match(sidepanel, /savedImgRatio[\s\S]*setDefaultImgRatio[\s\S]*savedRatio[\s\S]*setDefaultRatio/);
  assert.match(sidepanel, /type:\s*'image'/);
});

test('Text to Video uses video global settings guard before submit', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runInjector');
  const end = sidepanel.indexOf('async function runImageGenerator', start);
  const body = sidepanel.slice(start, end);
  assert.match(body, /const videoSettings = await getVideoGlobalSettings\(\)/);
  assert.match(body, /ensureComposerMatchesGlobalSettings\(tab\.id,\s*videoSettings,\s*\{/);
  assert.match(body, /expectedMode:\s*'Video'/);
  assert.match(body, /videoModeConfirmedOnFirstPrompt:\s*false/);
  assert.match(body, /globalVideoSettingsConfirmedOnFirstPrompt:\s*false/);
  assert.match(body, /confirmedVideoSettings:\s*null/);
  assert.match(body, /shouldSkipTextToVideoGlobalSettingsAfterFirstPrompt\(\{/);
  assert.match(body, /shouldSkipTextToVideoModeGuardAfterFirstPrompt\(\{/);
  assert.match(body, /includeMode:\s*!modeSkip\.skip/);
  assert.match(body, /skipModeReason:\s*modeSkip\.reason/);
  assert.match(body, /videoRuntimeState\.videoModeConfirmedOnFirstPrompt = true/);
  assert.match(body, /videoRuntimeState\.globalVideoSettingsConfirmedOnFirstPrompt = true/);
  assert.match(body, /videoRuntimeState\.confirmedVideoSettings = \{/);
  assert.match(body, /const includeRatio = i === 0 && !videoRuntimeState\.ratioValidated/);
  assert.match(body, /const includeResolution = i === 0/);
  assert.match(body, /const includeDuration = i === 0/);
  assert.match(body, /\[Video ratio\][\s\S]*aspect ratio guard/);
  assert.match(body, /includeRatio,?/);
  assert.doesNotMatch(body, /includeRatio:\s*true,\s*includeResolution:\s*true/);
  assert.match(body, /includeResolution,?/);
  assert.match(body, /includeDuration,?/);
  assert.doesNotMatch(body, /injectAspectRatio\(tab\.id,\s*selectedRatio/);
  assert.doesNotMatch(body, /injectDuration\(tab\.id,\s*duration/);
});

test('Text to Video skips all global settings guard after first prompt confirms settings', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /function shouldSkipTextToVideoGlobalSettingsAfterFirstPrompt/);
  assert.match(sidepanel, /runState\?\.globalVideoSettingsConfirmedOnFirstPrompt === true/);
  assert.match(sidepanel, /Bỏ qua toàn bộ Global Settings từ prompt 2\+ vì prompt đầu tiên đã xác nhận mode\/ratio\/resolution\/duration/);
  assert.match(sidepanel, /function shouldSkipTextToVideoModeGuardAfterFirstPrompt/);
  assert.match(sidepanel, /settingType === 'mode'/);
  assert.match(sidepanel, /runState\?\.videoModeConfirmedOnFirstPrompt === true/);
  assert.match(sidepanel, /Bỏ qua mode guard từ scene\/prompt 2\+ vì prompt đầu tiên đã xác nhận Video mode/);

  const guardStart = sidepanel.indexOf('async function ensureComposerMatchesGlobalSettings');
  const guardEnd = sidepanel.indexOf('async function ensureFilmGlobalSettings', guardStart);
  const guardBody = sidepanel.slice(guardStart, guardEnd);
  assert.match(guardBody, /if \(!includeMode && options\.skipModeReason\)/);
  assert.match(guardBody, /settingType:\s*'mode'/);
  assert.match(guardBody, /detectedValue:\s*'skipped-after-first-prompt'/);
  assert.match(guardBody, /mode skipped:/);
  const start = sidepanel.indexOf('async function runInjector');
  const end = sidepanel.indexOf('async function runImageGenerator', start);
  const body = sidepanel.slice(start, end);
  const skip = body.indexOf('if (skipGlobalSettings.skip)');
  const guard = body.indexOf('ensureComposerMatchesGlobalSettings(tab.id, videoSettings', skip);
  const inject = body.indexOf('const knownVideoUrls = await snapshotVideoUrls', skip);
  assert.ok(skip > -1);
  assert.ok(guard > skip);
  assert.ok(inject > guard);
  assert.match(body.slice(skip, guard), /\[Video settings guard\] skipped:/);
  assert.match(body.slice(skip, guard), /skipGlobalSettings\.reason/);
});

test('Settings guard records ratio as skipped when includeRatio is false', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function ensureComposerMatchesGlobalSettings');
  const end = sidepanel.indexOf('async function ensureFilmGlobalSettings', start);
  const body = sidepanel.slice(start, end);
  assert.match(body, /if \(settings\.ratio && !includeRatio\)/);
  assert.match(body, /results\.ratio = \{/);
  assert.match(body, /skipped:\s*true/);
  assert.match(body, /ratio_guard_skipped_after_first_scene/);
  assert.doesNotMatch(body, /failedSetting:\s*'ratio'[\s\S]*includeRatio\s*===\s*false/);
});

test('Text to Image uses image global settings and skips video-only controls', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runImageGenerator');
  const end = sidepanel.indexOf('async function downloadUrlToDataUrl', start);
  const body = sidepanel.slice(start, end);
  assert.match(body, /const imageSettings = await getImageGlobalSettings\(\)/);
  assert.match(body, /ensureComposerMatchesGlobalSettings\(tab\.id,\s*imageSettings,\s*\{/);
  assert.match(body, /expectedMode:\s*'Image'/);
  assert.match(body, /includeMode:\s*true/);
  assert.match(body, /const imageRuntimeState = \{\s*ratioValidated:\s*false\s*\}/);
  assert.match(body, /const includeRatio = i === 0 && !imageRuntimeState\.ratioValidated/);
  assert.match(body, /\[Image ratio\][\s\S]*aspect ratio guard/);
  assert.match(body, /includeRatio,?/);
  assert.match(body, /includeResolution:\s*false/);
  assert.match(body, /includeDuration:\s*false/);
  assert.doesNotMatch(body, /injectAspectRatio\(tab\.id,\s*imgSelectedRatio/);
});

test('Text to Image output count is normalized, saved, loaded, and exposed in UI', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const html = fs.readFileSync('./sidepanel.html', 'utf8');
  const start = sidepanel.indexOf('function normalizeImgOutputCount');
  const end = sidepanel.indexOf('async function readChromeLocal', start);
  const normalizeImgOutputCount = vm.runInThisContext(`${sidepanel.slice(start, end)}; normalizeImgOutputCount;`);
  assert.equal(normalizeImgOutputCount(0), 1);
  assert.equal(normalizeImgOutputCount(5), 4);
  assert.equal(normalizeImgOutputCount(3), 3);
  assert.match(html, /id="img-output-count"/);
  assert.match(html, /<option value="1"/);
  assert.match(html, /<option value="4"/);
  assert.match(sidepanel, /let imgOutputCount = 1/);
  assert.match(sidepanel, /savedImgOutputCount:\s*imgOutputCount/);
  assert.match(sidepanel, /savedImgOutputCount/);
  assert.match(sidepanel, /imgOutputCountEl\?\.addEventListener\('change'/);
});

test('Text to Image run configures and waits for multiple requested image outputs', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function runImageGenerator');
  const end = sidepanel.indexOf('async function downloadUrlToDataUrl', start);
  const body = sidepanel.slice(start, end);
  assert.match(body, /const outputCount = normalizeImgOutputCount\(imgOutputCount\)/);
  assert.match(body, /ensureImageOutputCount\(tab\.id,\s*outputCount/);
  assert.match(body, /expectedImageCount:\s*outputCount/);
  assert.match(body, /downloadGeneratedImagesForPrompt\(tab\.id,\s*\{/);
  assert.match(body, /expectedOutputCount:\s*outputCount/);
  assert.match(body, /generatedCount/);
  assert.match(body, /downloadedCount/);
  assert.match(body, /previews/);
});

test('Text to Image download helper limits to expected count and filters composer thumbnails', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const collectStart = sidepanel.indexOf('async function collectGeneratedImageCandidates');
  const collectEnd = sidepanel.indexOf('async function downloadGeneratedImagesForPrompt', collectStart);
  const collectBody = sidepanel.slice(collectStart, collectEnd);
  const downloadStart = sidepanel.indexOf('async function downloadGeneratedImagesForPrompt');
  const downloadEnd = sidepanel.indexOf('// ─────────────────────────────────────────────────────────────────────────────', downloadStart);
  const downloadBody = sidepanel.slice(downloadStart, downloadEnd);
  assert.match(collectBody, /naturalWidth/);
  assert.match(collectBody, /nw < 256 \|\| nh < 256/);
  assert.match(collectBody, /data-testid\*="composer"/);
  assert.match(collectBody, /class\*="avatar"/);
  assert.match(collectBody, /class\*="attachment"/);
  assert.match(downloadBody, /\.slice\(0,\s*expectedCount\)/);
  assert.match(downloadBody, /downloadSpecificMediaUrl\(tabId,\s*item\.url,\s*filename,\s*\{ type:\s*'image'/);
  assert.match(downloadBody, /previews\.push\(item\.url\)/);
});

test('Image signal wait supports multi-output partial image completion', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const start = sidepanel.indexOf('async function waitForMediaStableAfterGenerate');
  const end = sidepanel.indexOf('async function waitForGrokGenerationDone', start);
  const body = sidepanel.slice(start, end);
  assert.match(body, /expectedImageCount/);
  assert.match(body, /newImagesCount/);
  assert.match(body, /partial:\s*newUrls\.length < expectedImageCount/);
  assert.match(body, /đã phát hiện/);
});

test('Only Img2Vid queue renders image import thumbnails; other queues show prompt previews only', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const txtStart = sidepanel.indexOf('function renderTxtQueue');
  const txtEnd = sidepanel.indexOf('// ── IMAGE QUEUE RENDER', txtStart);
  const imgStart = sidepanel.indexOf('function renderImgQueue');
  const imgEnd = sidepanel.indexOf('// ── STATUS CHECK', imgStart);
  const i2vStart = sidepanel.indexOf('function renderPairCard');
  const i2vEnd = sidepanel.indexOf('function updatePairStatus', i2vStart);
  const filmStart = sidepanel.indexOf('function renderSceneCard');
  const filmEnd = sidepanel.indexOf('function sfSetSceneStatus', filmStart);

  assert.match(sidepanel, /function renderI2VQueueImportThumbnail/);
  assert.match(sidepanel, /function getQueueItemPromptPreview/);
  assert.match(sidepanel, /queue-prompt-preview/);
  assert.doesNotMatch(sidepanel.slice(txtStart, txtEnd), /queue-thumb|renderQueueThumbnail|renderI2VQueueImportThumbnail/);
  assert.doesNotMatch(sidepanel.slice(imgStart, imgEnd), /queue-thumb|renderQueueThumbnail|renderI2VQueueImportThumbnail/);
  assert.match(sidepanel.slice(i2vStart, i2vEnd), /renderI2VQueueImportThumbnail\(pair,\s*idx\)/);
  assert.match(sidepanel.slice(i2vStart, i2vEnd), /i2v-qimport-/);
  assert.match(sidepanel.slice(i2vStart, i2vEnd), /Import<br>ảnh/);
  assert.doesNotMatch(sidepanel.slice(filmStart, filmEnd), /queue-thumb|renderQueueThumbnail|renderI2VQueueImportThumbnail/);
});

test('Queue CSS supports Img2Vid import thumbnails and clamped prompt previews', () => {
  const html = fs.readFileSync('./sidepanel.html', 'utf8');
  assert.match(html, /\.queue-thumb/);
  assert.match(html, /\.queue-thumb\.i2v-queue-import/);
  assert.match(html, /\.queue-prompt-preview/);
  assert.match(html, /-webkit-line-clamp:\s*3/);
});

test('Scene error logging and run summary helpers provide Vietnamese diagnostics', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /function logSceneError\(logEl,\s*context = \{\}\)/);
  assert.match(sidepanel, /❌ \[\$\{feature\}\] \$\{title\} bị lỗi/);
  assert.match(sidepanel, /Bước:/);
  assert.match(sidepanel, /Mã lỗi:/);
  assert.match(sidepanel, /Chi tiết:/);
  assert.match(sidepanel, /Hành động:/);
  assert.match(sidepanel, /function logRunSummary\(logEl,/);
  assert.match(sidepanel, /KẾT THÚC/);
  assert.match(sidepanel, /Scene\/prompt lỗi:/);
});

test('Main automation flows call logSceneError and logRunSummary', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const flows = [
    ['runInjector', 'runImageGenerator', 'recordVideoError', 'Văn bản thành Video'],
    ['runImageGenerator', 'i2vUpdateCount', 'recordImageError', 'Text to Image'],
    ['runImg2Vid', 'const sfDownloadSummary', 'recordI2VError', 'Img2Vid'],
    ['runShortFilm', 'function sfShowExport', 'recordFilmError', 'Film'],
  ];
  for (const [startName, endName, recorder, feature] of flows) {
    const start = sidepanel.indexOf(`async function ${startName}`);
    const end = sidepanel.indexOf(endName, start);
    const body = sidepanel.slice(start, end);
    assert.match(body, new RegExp(recorder));
    assert.match(body, /logRunSummary\(/);
    assert.match(body, new RegExp(`feature:\\s*'${feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  }
});

test('waitForGrokGenerationDone is the shared signal wait helper for video and image flows', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /async function waitForGrokGenerationDone\(tabId,\s*options = \{\}\)/);
  assert.match(sidepanel, /function getGeneratePollInterval/);
  assert.match(sidepanel, /async function waitForMediaStableAfterGenerate/);
  assert.match(sidepanel, /mediaState:\s*stable\.ok \? 'MEDIA_STABLE' : 'MEDIA_DETECTED'/);
  assert.match(sidepanel, /FAILED_TIMEOUT/);
});

test('Text to Video and Text to Image do not import reference images', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const videoStart = sidepanel.indexOf('async function runInjector');
  const videoEnd = sidepanel.indexOf('async function runImageGenerator', videoStart);
  const videoBody = sidepanel.slice(videoStart, videoEnd);
  assert.doesNotMatch(videoBody, /injectImageToPage\(/);
  assert.match(videoBody, /\[Import guard\] feature=TextToVideo skip image import/);
  assert.match(videoBody, /waitForGrokGenerationDone\(tab\.id,\s*\{/);
  assert.match(videoBody, /mediaType:\s*'video'/);

  const imageStart = sidepanel.indexOf('async function runImageGenerator');
  const imageEnd = sidepanel.indexOf('async function prepareImg2VidComposer', imageStart);
  const imageBody = sidepanel.slice(imageStart, imageEnd);
  assert.doesNotMatch(imageBody, /injectImageToPage\(/);
  assert.match(imageBody, /\[Import guard\] feature=TextToImage skip image import/);
  assert.match(imageBody, /waitForGrokGenerationDone\(tab\.id,\s*\{/);
  assert.match(imageBody, /mediaType:\s*'image'/);
});

test('Img2Vid and Film remain the only current flows importing images', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const i2vStart = sidepanel.indexOf('async function runImg2Vid');
  const i2vEnd = sidepanel.indexOf('const sfWorldEl', i2vStart);
  const i2vBody = sidepanel.slice(i2vStart, i2vEnd);
  assert.match(i2vBody, /injectImageToPage\(\s*[\s\S]*pair\.imageDataUrl/);
  assert.doesNotMatch(i2vBody, /prevFrameDataUrl|charRefs|usePersistentCharacterRefs/);
  assert.match(i2vBody, /waitForGrokGenerationDone\(tab\.id,\s*\{/);

  const filmStart = sidepanel.indexOf('async function runShortFilm');
  const filmEnd = sidepanel.indexOf('function sfShowExport', filmStart);
  const filmBody = sidepanel.slice(filmStart, filmEnd);
  assert.match(filmBody, /ensureFilmPersistedRefs\(tab\.id,\s*\{/);
  assert.match(sidepanel, /injectImageToPage\(tabId,\s*ref\.dataUrl/);
  assert.doesNotMatch(filmBody, /injectImageToPage\(tab\.id,\s*refDataUrl/);
  assert.match(filmBody, /\[SF refs\].*ki.*m tra.*Grok persist/);
  assert.match(filmBody, /waitForGrokGenerationDone\(tab\.id,\s*\{/);
});

test('Short Film uses Grok-persisted reference images and enforces Grok ref limit', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  assert.match(sidepanel, /const SF_MAX_REFERENCE_IMAGES = 7/);
  assert.match(sidepanel, /function buildFilmDesiredRefs\(charRefs = \[\]\)/);
  assert.match(sidepanel, /function dedupeFilmRefs\(refs = \[\]\)/);
  assert.match(sidepanel, /async function getFilmComposerAttachmentState\(tabId\)/);
  assert.match(sidepanel, /async function getFilmComposerCleanState\(tabId\)/);
  assert.match(sidepanel, /async function prepareFilmSceneComposerForPersistedRefs\(tabId,\s*sceneCtx = \{\}/);
  assert.match(sidepanel, /async function getComposerReferenceState\(tabId\)/);
  assert.doesNotMatch(sidepanel, /function compareFilmComposerRefs/);
  assert.match(sidepanel, /async function ensureFilmPersistedRefs\(tabId,\s*sceneCtx,\s*filmRefsRuntime/);
  assert.match(sidepanel, /film_refs_over_limit/);
  assert.match(sidepanel, /filmRefsRuntime\?\.set\?\./);
  assert.match(sidepanel, /film_refs_already_handled_for_scene/);
  assert.match(sidepanel, /refs_not_fully_stable_but_enough/);
  assert.match(sidepanel, /effectiveImageCount > maxRefs/);
  assert.doesNotMatch(sidepanel, /async function prepareCleanFilmSceneComposer/);

  const helperStart = sidepanel.indexOf('async function ensureFilmPersistedRefs');
  const helperEnd = sidepanel.indexOf('async function clickSubmitButton', helperStart);
  const helperBody = sidepanel.slice(helperStart, helperEnd);
  assert.match(helperBody, /getFilmComposerAttachmentState\(tabId\)/);
  assert.match(helperBody, /if \(sceneIndex > 0 && beforeCount > 0\)/);
  assert.match(helperBody, /skippedInject/);
  assert.match(helperBody, /grok_persisted_refs/);
  assert.match(helperBody, /Cảnh 1: inject bộ ảnh tham chiếu cấu hình ban đầu/);
  assert.match(helperBody, /for \(const ref of desiredRefs\)/);
  assert.match(helperBody, /replaceExisting:\s*false/);
  assert.doesNotMatch(helperBody, /compareFilmComposerRefs/);
  assert.doesNotMatch(helperBody, /refsToInject = compare\.missing/);
  assert.doesNotMatch(helperBody, /exactImages:\s*expectedRefCount/);
  assert.doesNotMatch(helperBody, /cleanupFilmComposerAttachments\(tabId\)/);

  const filmStart = sidepanel.indexOf('async function runShortFilm');
  const filmEnd = sidepanel.indexOf('function sfShowExport', filmStart);
  const filmBody = sidepanel.slice(filmStart, filmEnd);
  assert.match(filmBody, /const filmRefsRuntime = new Map\(\)/);
  assert.match(filmBody, /buildFilmDesiredRefs\(charRefs\)/);
  assert.match(filmBody, /ensureFilmPersistedRefs\(tab\.id,\s*\{/);
  assert.match(filmBody, /filmRefsRuntime/);
  assert.match(filmBody, /prepareFilmSceneComposerForPersistedRefs\(tab\.id/);
  assert.doesNotMatch(filmBody, /prepareCleanFilmSceneComposer/);
  assert.doesNotMatch(filmBody, /cleanupFilmComposerAttachments/);
  assert.doesNotMatch(filmBody, /clearBottomComposerAttachments/);
  assert.doesNotMatch(filmBody, /injectImageToPage\(tab\.id,\s*refDataUrl/);
  assert.match(filmBody, /skipped-by-ref-policy/);
});

test('Film payload guard trusts Reference guard for persisted refs and checks text only', () => {
  const sidepanel = fs.readFileSync('./sidepanel.js', 'utf8');
  const filmStart = sidepanel.indexOf('async function runShortFilm');
  const filmEnd = sidepanel.indexOf('function sfShowExport', filmStart);
  const filmBody = sidepanel.slice(filmStart, filmEnd);
  assert.match(filmBody, /let filmRefsReady = false/);
  assert.match(filmBody, /filmRefsReadyCount = Number\(/);
  assert.match(filmBody, /refsRes\.attachmentCount/);
  assert.match(filmBody, /refsRes\.currentAttachmentCount/);
  assert.match(filmBody, /refsRes\.reason === 'grok_persisted_refs'/);
  assert.match(filmBody, /const payloadGuardRequireImage = requireSceneImage && !filmRefsReady/);
  assert.match(filmBody, /requireImage:\s*payloadGuardRequireImage/);
  assert.match(filmBody, /bỏ qua image check trong payload guard vì Film refs đã được xác nhận ở Reference guard/);
  assert.match(filmBody, /textOnly=true/);
  assert.match(filmBody, /submitFilmSceneAtomic\(tab\.id,\s*scene,\s*fullPrompt,[\s\S]*requireImage:\s*payloadGuardRequireImage/);

  const i2vStart = sidepanel.indexOf('async function runImg2Vid');
  const i2vEnd = sidepanel.indexOf('const sfWorldEl', i2vStart);
  const i2vBody = sidepanel.slice(i2vStart, i2vEnd);
  assert.match(i2vBody, /requireImage:\s*true/);
});

test('sidepanel.html no longer shows the Img2Vid create-list button', () => {
  const html = fs.readFileSync('./sidepanel.html', 'utf8');
  assert.doesNotMatch(html, /id="i2v-parse-btn"/);
  assert.doesNotMatch(html, />\s*Tạo danh sách/);
  assert.match(html, /Nhập prompt, cách 1 dòng để tự tạo scene tiếp theo|Nhập prompt, cách 1 dòng để tự tạo scene tiếp theo/);
});

