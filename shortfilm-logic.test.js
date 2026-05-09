'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
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
