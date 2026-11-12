/*
 * 저장소 래퍼 — localStorage를 쓸 수 없거나(차단·용량·사생활 모드) 값이 손상돼도 게임이 멈추지 않게 한다.
 * 실패하면 메모리에만 보관하고 status로 알려 준다.
 * 2026-11-12(외부 검토 2번): 쓰기나 지우기가 실패한 키는 저장소의 옛 값이 아니라 이 탭의 최신 상태(메모리 값·지움 표시)를 읽는다.
 *   status.writeFailed = 저장소에 못 쓴 최신 값이 있다 · status.removeFailed = 지웠지만 저장소에는 남아 있는 값이 있다(둘 다 다시 성공하면 풀린다).
 *   remove()는 저장소에서 실제로 지워졌는지를 돌려준다 — 지우지 못했는데 "지웠다"고 말하지 않게.
 * 2026-11-12(추가 검토): 시작할 때의 쓰기 검사가 실패해도(용량 초과 등) 읽기·지우기는 될 수 있다 → 읽기·쓰기·지우기를 각각 실제로 해 보고 그 결과를 따른다.
 *   예전에는 쓰기 검사가 실패하면 저장소를 아예 안 건드려서, 지우기가 아무것도 안 하고 true를 돌려주고 옛 기록(이름·학번·답)이 기기에 남았다.
 *   status.available = 쓰기가 되는가(시작할 때 검사, 그 뒤 쓰기가 성공하면 true) · status.readable = 읽기가 되는가(저장소 접근이 통째로 막혔으면 false —
 *   그때는 기기에 무엇이 남았는지 알 수 없으므로 remove()는 false를 돌려주되 removeFailed로 세지 않는다. 안내는 app.js가 따로 한다).
 *   쓰기나 지우기가 한 번 성공하면 밀려 있던 다른 키도 다시 해 본다(flush). scrub(키, 값) = 값을 바꿔 쓰되, 못 쓰면 저장소의 옛 값을 지운다(이름처럼 남으면 안 되는 것).
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
  var stale = {};   // stale[키] = true: 새 값을 못 썼고 저장소의 옛 값도 못 지웠다(scrub) — 옛 값이 기기에 남아 있다
  var status = { available: false, readable: false, writeFailed: false, removeFailed: false };
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  function refresh() {
    var w = false, r = false, k;
    for (k in pending) if (has(pending, k)) { if (pending[k] === 'set') w = true; else r = true; }
    for (k in stale) if (has(stale, k)) r = true;
    status.writeFailed = w; status.removeFailed = r;
  }

  var PROBE = '__ethicity_privacy_probe__';
  function ls() { return root.localStorage; }
  function canRead() { try { ls().getItem(PROBE); return true; } catch (e) { return false; } }
  // 저장소에서 그 키를 지우고, 정말 없어졌는지 읽어서 확인한다
  function erase(key) { ls().removeItem(key); if (ls().getItem(key) != null) throw new Error('still stored'); }
  (function probe() {
    status.readable = canRead();
    try { ls().setItem(PROBE, '1'); status.available = true; } catch (e) { status.available = false; }
    try { ls().removeItem(PROBE); } catch (e) { /* 무시 */ }
  })();

  // 밀려 있던 쓰기·지우기를 다시 해 본다(다른 키의 쓰기·지우기가 성공했을 때, 또는 app이 부를 때). 하나라도 안 되면 거기서 멈춘다
  function flush(skip) {
    for (var k in pending) {
      if (!has(pending, k) || k === skip) continue;
      try {
        if (pending[k] === 'set') { ls().setItem(k, memory[k]); delete stale[k]; } else erase(k);
        delete pending[k];
      } catch (e) { break; }
    }
    refresh();
    return !status.writeFailed && !status.removeFailed;
  }

  function get(key) {
    if (pending[key] === 'gone') return null;
    if (pending[key] === 'set') return memory[key];
    try { var v = ls().getItem(key); status.readable = true; return v; } catch (e) { /* 메모리로 */ }
    return has(memory, key) ? memory[key] : null;
  }
  function set(key, value) {
    memory[key] = value;
    try { ls().setItem(key, value); } catch (e) { pending[key] = 'set'; refresh(); return false; }
    delete pending[key]; delete stale[key]; status.available = true;
    flush(key);
    return true;
  }
  // 저장소에서 실제로 지워졌으면(읽어서 없는 것까지 확인) true.
  //   지우지 못했고 읽을 수는 있으면 'gone' 표시 — 이 탭은 지운 것으로 읽고, 다음에 저장소가 될 때 다시 지운다(status.removeFailed).
  //   읽기조차 안 되면(저장소 접근이 통째로 막힘) false만 돌려준다 — 기기에 무엇이 있는지 알 수 없다(status.readable = false).
  function remove(key) {
    delete memory[key];
    try { erase(key); } catch (e) {
      if (canRead()) pending[key] = 'gone'; else { delete pending[key]; status.readable = false; }
      refresh(); return false;
    }
    delete pending[key]; delete stale[key];
    flush(key);
    return true;
  }
  // 값을 바꿔 쓰되, 못 쓰면 저장소에 남은 옛 값을 지운다(이름처럼 남으면 안 되는 것이 들어 있을 때). 이 탭은 계속 새 값을 읽고, 저장이 되살아나면 새 값을 쓴다.
  //   돌려주는 값 = 저장소에 옛 값이 남지 않았나(새 값이 써졌거나, 옛 값을 지웠거나). 읽기조차 안 되면 false(알 수 없음)
  function scrub(key, value) {
    var text;
    try { text = JSON.stringify(value); } catch (e) { return false; }
    if (set(key, text)) return true;
    try { erase(key); delete stale[key]; refresh(); return true; } catch (e) {
      if (canRead()) stale[key] = true; else status.readable = false;
      refresh(); return false;
    }
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
    scrub: scrub,
    flush: flush,
    readPlayer: readPlayer,
    saveResult: saveResult,
    readResult: readResult
  };
})(window);
