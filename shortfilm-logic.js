'use strict';

(function initShortFilmLogic(globalObj) {
  function normalizeSceneQueue(scenes) {
    return [...scenes].sort((a, b) => Number(a.id) - Number(b.id));
  }

  function validateCharacterRefs(characters) {
    const errors = [];
    characters.forEach((ch, idx) => {
      if (!ch?.imageDataUrl && !ch?.visualDataUrl) {
        const label = ch?.name?.trim() || `Nhân vật #${idx + 1}`;
        errors.push(`${label}: thiếu ảnh tham chiếu (imageDataUrl hoặc visualDataUrl)`);
      }
    });
    return errors;
  }

  function createMessageState(sceneId) {
    return { id: sceneId, status: 'pending', error: null };
  }

  const api = { normalizeSceneQueue, validateCharacterRefs, createMessageState };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalObj.ShortFilmLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
