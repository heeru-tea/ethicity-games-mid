/*
 * 팀 공통 저장 키만 다룬다. 진행 상태는 저장하지 않는다(새로고침하면 처음부터).
 *   ethicity.player            읽기만 — {"character":"…","nickname":"…"}
 *   ethicity.result.publicness 결말 도달 시 쓰기 — {"game":"publicness","completed":true,"ending":null,"card":"…"}
 * 저장소가 막혔거나 손상됐으면 조용히 건너뛴다.
 */
(function (root) {
  'use strict';
  var RESULT_KEY = 'ethicity.result.publicness';

  function store(s) {
    if (s) return s;
    try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch (e) { return null; }
  }

  function readPlayer(s) {
    try {
      var st = store(s);
      if (!st) return null;
      var raw = st.getItem('ethicity.player');
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o.nickname !== 'string' || !o.nickname.trim()) return null;
      return { nickname: o.nickname.trim() };
    } catch (e) { return null; }
  }

  function writeResult(card, s) {
    try {
      var st = store(s);
      if (!st) return false;
      st.setItem(RESULT_KEY, JSON.stringify({ game: 'publicness', completed: true, ending: null, card: card }));
      return true;
    } catch (e) { return false; }
  }

  var api = { readPlayer: readPlayer, writeResult: writeResult, RESULT_KEY: RESULT_KEY };
  root.PB = root.PB || {};
  root.PB.Storage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
