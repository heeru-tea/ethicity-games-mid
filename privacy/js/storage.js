/*
 * 저장소 래퍼 — localStorage를 쓸 수 없거나(차단·용량·사생활 모드) 값이 손상돼도 게임이 멈추지 않게 한다.
 * 실패하면 메모리에만 보관하고 status로 알려 준다.
 * 2026-11-12(외부 검토 2번): 쓰기나 지우기가 실패한 키는 저장소의 옛 값이 아니라 이 탭의 최신 상태(메모리 값·지움 표시)를 읽는다.
 *   status.writeFailed = 저장소에 못 쓴 최신 값이 있다 · status.removeFailed = 지웠지만 저장소에는 남아 있는 값이 있다(둘 다 다시 성공하면 풀린다).
 *   remove()는 저장소에서 실제로 지워졌는지를 돌려준다 — 지우지 못했는데 "지웠다"고 말하지 않게.
 *
 * 키 규약
 *   ethicity.player              공통 플레이어 정보 — 읽기만 한다(절대 쓰지 않음)
 *   ethicity.result.privacy      공통 완료 결과 — 엔딩 도달 시에만 쓴다
 *   ethicity.privacy.progress.v2 이 게임 전용 진행 저장
 *   ethicity.privacy.settings.v1 이 게임 전용 화면 설정
 *   ethicity.privacy.card.v1     성찰 카드에 쓴 글·이름·학번(이 기기에만, 2026-11-10) — 기록 지우기·새로 시작할 때 함께 지운다
 */
(function (root) {
  'use strict';

  var KEYS = {
    player: 'ethicity.player',
    result: 'ethicity.result.privacy',
    progress: 'ethicity.privacy.progress.v2',
    settings: 'ethicity.privacy.settings.v1',
    card: 'ethicity.privacy.card.v1'
  };
  var memory = {};
  var pending = {}; // pending[키] = 'set'(못 쓴 최신 값이 memory에) | 'gone'(지웠는데 저장소에 남음) — 저장소가 이 탭을 따라오지 못한 키
  var status = { available: false, writeFailed: false, removeFailed: false };
  function refresh() {
    var w = false, r = false;
    for (var k in pending) if (Object.prototype.hasOwnProperty.call(pending, k)) { if (pending[k] === 'set') w = true; else r = true; }
    status.writeFailed = w; status.removeFailed = r;
  }

  function ls() { return root.localStorage; }
  (function probe() {
    try {
      var k = '__ethicity_privacy_probe__';
      ls().setItem(k, '1');
      ls().removeItem(k);
      status.available = true;
    } catch (e) { status.available = false; }
  })();

  function get(key) {
    if (pending[key] === 'gone') return null;
    if (pending[key] === 'set') return memory[key];
    if (status.available) {
      try { return ls().getItem(key); } catch (e) { /* 메모리로 */ }
    }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }
  function set(key, value) {
    memory[key] = value;
    if (!status.available) return false;
    try { ls().setItem(key, value); delete pending[key]; refresh(); return true; }
    catch (e) { pending[key] = 'set'; refresh(); return false; }
  }
  // 저장소에서 실제로 지워졌으면 true. 저장소를 못 쓰는 브라우저(메모리만)는 지울 것이 메모리뿐이라 true
  function remove(key) {
    delete memory[key];
    if (!status.available) return true;
    try { ls().removeItem(key); delete pending[key]; refresh(); return true; }
    catch (e) { pending[key] = 'gone'; refresh(); return false; }
  }
  function readJSON(key) {
    var raw = get(key);
    if (raw == null) return { ok: true, value: null };
    try { return { ok: true, value: JSON.parse(raw) }; } catch (e) { return { ok: false, value: null }; }
  }
  function writeJSON(key, value) {
    try { return set(key, JSON.stringify(value)); } catch (e) { return false; } // 문자열로 못 바꾸는 값(순환 참조 등) — 저장소 문제가 아니다
  }

  /* 공통 플레이어 정보 — 손상·누락 시 기본값. 원본은 건드리지 않는다. */
  function readPlayer(defaultNickname) {
    var r = readJSON(KEYS.player);
    var fallback = { character: null, nickname: defaultNickname, source: 'default' };
    if (!r.ok) { fallback.source = 'damaged'; return fallback; }
    var v = r.value;
    if (v == null) return fallback;
    if (typeof v !== 'object' || Array.isArray(v)) { fallback.source = 'damaged'; return fallback; }
    var nick = typeof v.nickname === 'string' ? v.nickname.replace(/[\u0000-\u001f\u007f]/g, '').trim() : '';
    var ch = typeof v.character === 'string' && /^[\w-]{1,64}$/.test(v.character) ? v.character : null;
    if (!nick && !ch) { fallback.source = 'damaged'; return fallback; }
    return { character: ch, nickname: nick || defaultNickname, source: 'stored' };
  }

  function saveResult(ending, card) {
    return writeJSON(KEYS.result, { game: 'privacy', completed: true, ending: ending, card: card });
  }
  function readResult() {
    var r = readJSON(KEYS.result);
    var v = r.value;
    if (!r.ok || !v || typeof v !== 'object' || v.game !== 'privacy' || typeof v.ending !== 'string') return null;
    return v;
  }

  root.PrivacyStorage = {
    KEYS: KEYS,
    status: status,
    readJSON: readJSON,
    writeJSON: writeJSON,
    remove: remove,
    readPlayer: readPlayer,
    saveResult: saveResult,
    readResult: readResult
  };
})(window);
