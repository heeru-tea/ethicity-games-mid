// 저장소 래퍼 — localStorage가 막혀 있거나(사생활 모드·차단) 값이 손상돼도 게임이 멈추지 않게 한다.
// 이 게임의 키(ethicity.rights.*)만 다룬다. 다른 게임 기록은 건드리지 않는다.
(function (root) {
  'use strict';
  var KEYS = { progress: 'ethicity.rights.progress.v1', settings: 'ethicity.rights.settings.v1' };
  var memory = {};

  function read(name, fallback) {
    var raw = null;
    try { raw = root.localStorage.getItem(KEYS[name]); } catch (e) { raw = memory[name] || null; }
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }
  function write(name, value) {
    var raw = JSON.stringify(value);
    memory[name] = raw;
    try { root.localStorage.setItem(KEYS[name], raw); return true; } catch (e) { return false; }
  }
  function remove(name) {
    delete memory[name];
    try { root.localStorage.removeItem(KEYS[name]); } catch (e) { /* 저장소를 쓸 수 없으면 메모리만 지운다 */ }
  }

  root.RightsStore = { KEYS: KEYS, read: read, write: write, remove: remove };
})(window);
