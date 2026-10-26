/*
 * 저장 키
 *   ethicity.player                 읽기만(팀 공통) — {"character":"…","nickname":"…"}. 절대 덮어쓰지 않는다
 *   ethicity.result.humanrights     보고서 화면 도달 시 쓰기(팀 공통) — {"game":"humanrights","completed":true,"ending":null,"card":"…"}
 *   ethicity.humanrights.progress.v1  진행·답 자동 저장 — 버전이 다르면 버린다
 *   ethicity.humanrights.settings.v1  효과음 켬/끔
 * 저장소가 막혔거나 손상됐으면 조용히 건너뛰고 메모리로만 진행한다.
 */
(function (root) {
  'use strict';
  var RESULT_KEY = 'ethicity.result.humanrights';
  var PROGRESS_KEY = 'ethicity.humanrights.progress.v1';
  var SETTINGS_KEY = 'ethicity.humanrights.settings.v1';

  function store(s) {
    if (s) return s;
    try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch (e) { return null; }
  }

  function available(s) {
    try { var st = store(s); if (!st) return false; st.setItem('ethicity.humanrights.probe', '1'); st.removeItem('ethicity.humanrights.probe'); return true; } catch (e) { return false; }
  }

  function readPlayer(s) {
    try {
      var st = store(s);
      if (!st) return null;
      var raw = st.getItem('ethicity.player');
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o.nickname !== 'string' || !o.nickname.trim()) return null;
      return { nickname: o.nickname.trim().slice(0, 20) };
    } catch (e) { return null; }
  }

  function writeResult(card, s) {
    try {
      var st = store(s);
      if (!st) return false;
      st.setItem(RESULT_KEY, JSON.stringify({ game: 'humanrights', completed: true, ending: null, card: card }));
      return true;
    } catch (e) { return false; }
  }

  function readProgress(s) { try { var st = store(s), raw = st && st.getItem(PROGRESS_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function writeProgress(state, s) { try { var st = store(s); if (!st) return false; st.setItem(PROGRESS_KEY, JSON.stringify(state)); return true; } catch (e) { return false; } }

  function readSettings(s) {
    try { var st = store(s), o = JSON.parse((st && st.getItem(SETTINGS_KEY)) || '{}'); return { sound: o.sound === true }; } catch (e) { return { sound: false }; }
  }
  function writeSettings(v, s) { try { var st = store(s); if (st) st.setItem(SETTINGS_KEY, JSON.stringify({ sound: !!v.sound })); } catch (e) { /* 이번 창에서만 적용 */ } }

  // 이 게임 기록만 지운다(공통 플레이어 정보·다른 게임 키는 그대로)
  function clearGame(s) {
    try { var st = store(s); if (!st) return; st.removeItem(PROGRESS_KEY); st.removeItem(RESULT_KEY); } catch (e) { /* 무시 */ }
  }

  var api = {
    available: available, readPlayer: readPlayer, writeResult: writeResult,
    readProgress: readProgress, writeProgress: writeProgress, readSettings: readSettings, writeSettings: writeSettings, clearGame: clearGame,
    RESULT_KEY: RESULT_KEY, PROGRESS_KEY: PROGRESS_KEY, SETTINGS_KEY: SETTINGS_KEY
  };
  root.HR = root.HR || {};
  root.HR.Storage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
