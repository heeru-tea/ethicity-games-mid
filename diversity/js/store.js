/*
 * 저장소 래퍼 — localStorage를 쓸 수 없거나(차단·용량·사생활 모드) 값이 손상돼도 게임이 멈추지 않게 한다.
 *   ethicity.player                공통 플레이어 정보 — 읽기만 한다(절대 쓰지 않음)
 *   ethicity.result.diversity      공통 완료 결과 — 성찰 제출 시에만 쓴다
 *   ethicity.diversity.progress.v1 이 게임 전용 진행 저장(학생이 적은 글 포함, 이 기기에만)
 *   ethicity.diversity.settings.v1 이 게임 전용 화면 설정
 */
(function (global) {
  'use strict';

  var KEYS = {
    player: 'ethicity.player',
    result: 'ethicity.result.diversity',
    progress: 'ethicity.diversity.progress.v1',
    settings: 'ethicity.diversity.settings.v1'
  };

  function read(key) {
    try {
      var raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function write(key, value) {
    try { global.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function remove(key) {
    try { global.localStorage.removeItem(key); } catch (e) { /* 저장소를 쓸 수 없으면 지울 것도 없다 */ }
  }

  var LETTERS = ['A', 'B', 'C'];
  function letter(v) { return LETTERS.indexOf(v) >= 0 ? v : null; }
  function text(v) { return typeof v === 'string' ? v.slice(0, 2000) : ''; }

  function emptyProgress() {
    return {
      v: 1,
      scene: 0,
      initial: null,
      missions: { news: { first: null, final: null }, ad: { first: null, final: null }, edu: { first: null, final: null } },
      principle: null,
      charter: { news: '', ad: '', edu: '', reason: '' },
      confirmed: false,
      reflection: { change: null, reason: '' },
      done: false
    };
  }

  // 손상되거나 다른 판의 값은 버리고, 알아볼 수 있는 칸만 살린다.
  function cleanProgress(raw, sceneCount, principleIds) {
    if (!raw || raw.v !== 1) return null;
    var p = emptyProgress();
    var scene = Number(raw.scene);
    p.scene = Number.isInteger(scene) && scene >= 0 && scene < sceneCount ? scene : 0;
    p.initial = letter(raw.initial);
    ['news', 'ad', 'edu'].forEach(function (k) {
      var m = raw.missions && raw.missions[k];
      if (m) { p.missions[k].first = letter(m.first); p.missions[k].final = letter(m.final); }
    });
    p.principle = principleIds.indexOf(raw.principle) >= 0 ? raw.principle : null;
    if (raw.charter) ['news', 'ad', 'edu', 'reason'].forEach(function (k) { p.charter[k] = text(raw.charter[k]); });
    p.confirmed = raw.confirmed === true;
    if (raw.reflection) {
      p.reflection.change = ['changed', 'refined', 'kept'].indexOf(raw.reflection.change) >= 0 ? raw.reflection.change : null;
      p.reflection.reason = text(raw.reflection.reason);
    }
    p.done = raw.done === true;
    return p;
  }

  var SETTINGS = { speed: 'normal', motion: false, sound: false };

  global.DiversityStore = {
    emptyProgress: emptyProgress,
    loadProgress: function (sceneCount, principleIds) { return cleanProgress(read(KEYS.progress), sceneCount, principleIds); },
    saveProgress: function (p) { return write(KEYS.progress, p); },
    clearProgress: function () { remove(KEYS.progress); },
    loadSettings: function () {
      var s = read(KEYS.settings) || {};
      return {
        speed: ['normal', 'fast', 'instant'].indexOf(s.speed) >= 0 ? s.speed : SETTINGS.speed,
        motion: s.motion === true,
        sound: s.sound === true
      };
    },
    saveSettings: function (s) { return write(KEYS.settings, s); },
    // 공통 플레이어 정보에서 별명만 읽는다. 인물 코드는 공통 팩 ID와 체계가 달라 쓰지 않는다.
    playerNickname: function () {
      var p = read(KEYS.player);
      var n = p && typeof p.nickname === 'string' ? p.nickname.trim() : '';
      return n && n.length <= 12 ? n : '';
    },
    saveResult: function () { return write(KEYS.result, { game: 'diversity', completed: true }); },
    clearAll: function () { remove(KEYS.progress); remove(KEYS.result); remove(KEYS.settings); }
  };
})(window);
