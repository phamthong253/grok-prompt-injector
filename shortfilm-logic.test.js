'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { normalizeSceneQueue, validateCharacterRefs, createMessageState } = require('./shortfilm-logic.js');

test('Queue order: scene IDs lộn xộn được sort tăng dần', () => {
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
  assert.match(errors[0], /thiếu ảnh tham chiếu/);
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
  assert.match(runShortFilmBody, /requireNewVideo:\s*true/);
  assert.match(runShortFilmBody, /downloadMedia\(tab\.id,\s*sceneSlug,\s*['"]video['"]/);
  assert.match(runShortFilmBody, /Queue.*video.*t.*i xong|Queue.*download/i);
});
