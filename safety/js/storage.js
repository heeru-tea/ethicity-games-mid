/*
 * 저장소 래퍼 — localStorage를 쓸 수 없거나(차단·사생활 모드) 값이 손상돼도 게임이 멈추지 않게 메모리로 이어 간다.
 *   ethicity.player              공통 플레이어 정보 — 읽기만 한다
 *   ethicity.result.safety       공통 완료 결과 — 엔딩 도달 시에만, 개인정보·성찰 글 없이
 *   ethicity.safety.progress.v1  진행 저장(이어 하기). 성찰 글은 이 기기 안에만 남는다
 *   ethicity.safety.settings.v1  화면 설정
 */
(function (root) {
  'use strict';

  var memory = {};
  var status = { available: false, writeFailed: false };
  try {
    var k = '__ethicity_safety_probe__';
    root.localStorage.setItem(k, '1');
    root.localStorage.removeItem(k);
    status.available = true;
  } catch (e) { status.available = false; }

  function read(key) {
    var raw = null;
    if (status.available) { try { raw = root.localStorage.getItem(key); } catch (e) { raw = null; } }
    else if (Object.prototype.hasOwnProperty.call(memory, key)) raw = memory[key];
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function write(key, value) {
    var raw = JSON.stringify(value);
    if (status.available) {
      try { root.localStorage.setItem(key, raw); return true; } catch (e) { status.writeFailed = true; }
    }
    memory[key] = raw;
    return false;
  }
  function remove(key) {
    delete memory[key];
    if (status.available) { try { root.localStorage.removeItem(key); } catch (e) { /* 무시 */ } }
  }

  root.SafetyStore = { read: read, write: write, remove: remove, status: status };
})(this);
