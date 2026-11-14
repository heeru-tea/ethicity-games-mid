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
 * 2026-11-13(로컬 검토 P1): 저장소 접근이 통째로 막힌 채 지우면 예전에는 지움 표시('gone')를 버려서, 접근이 돌아오자 같은 탭이 옛 이름·학번·답을 다시 읽고 기기에도 남았다.
 *   이제 지움 표시는 읽기 가능 여부와 상관없이 남긴다 — 이 탭은 계속 지운 것으로 읽고, 저장소가 돌아오면 다시 지운다. 지우기는 "지우고 읽어서 없는 것까지 확인"됐을 때만 성공.
 *   scrub도 같다: 옛 값을 지우지 못하면(확인 못 한 경우 포함) stale로 남겨, 새 값을 쓰거나 옛 값을 지울 때까지 다시 해 본다.
 *   status.removeFailed = 지우지 못한 것이 "확인된" 값이 있다 = 밀린 지움(gone·stale)이 있고 지금 읽기가 된다. 읽기조차 안 되면 남았는지 알 수 없으니 removeFailed가 아니라 readable=false.
 *   다시 해 보는 때(flush): 쓰기·지우기가 성공한 뒤 · 읽을 때(밀린 것이 있으면 먼저) · 창에 초점이 오거나 다시 보일 때(focus·visibilitychange·pageshow) · 창을 떠날 때(pagehide — 되살아난 직후 새로 고쳐도 남지 않게).
 *   밀린 것은 이 탭의 메모리에만 있다 — 막힌 채로 창을 닫으면(저장소가 막혀 표시를 적어 둘 곳이 없다) 다음에 열 때는 모른다. 그때는 app.js가 "확인하지 못했어요"라고 이미 말했다.
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
  var pending = {}; // pending[키] = 'set'(못 쓴 최신 값이 memory에) | 'gone'(이 탭에서 지웠는데 저장소에서 지워진 것을 확인하지 못함) — 저장소가 이 탭을 따라오지 못한 키
  var stale = {};   // stale[키] = true: 새 값을 못 썼고 저장소의 옛 값도 지워진 것을 확인하지 못했다(scrub, 지운 뒤 다시 쓰기 실패) — 옛 값이 기기에 남았을 수 있다
  var status = { available: false, readable: false, writeFailed: false, removeFailed: false };
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  function refresh() {
    var w = false, r = false, k;
    for (k in pending) if (has(pending, k)) { if (pending[k] === 'set') w = true; else r = true; }
    for (k in stale) if (has(stale, k)) r = true;
    status.writeFailed = w;
    status.removeFailed = r && status.readable; // 읽을 수 없으면 남았는지 모른다 — "지우지 못했다"고 단정하지 않는다(표시는 그대로 남아 다시 해 본다)
  }
  function dirty() { var k; for (k in pending) if (has(pending, k)) return true; for (k in stale) if (has(stale, k)) return true; return false; }

  var PROBE = '__ethicity_privacy_probe__';
  function ls() { return root.localStorage; }
  function canRead() { try { ls().getItem(PROBE); return true; } catch (e) { return false; } }
  // 저장소에서 그 키를 지우고, 정말 없어졌는지 읽어서 확인한다
  function erase(key) { ls().removeItem(key); if (ls().getItem(key) != null) throw new Error('still stored'); status.readable = true; }
  (function probe() {
    status.readable = canRead();
    try { ls().setItem(PROBE, '1'); status.available = true; } catch (e) { status.available = false; }
    try { ls().removeItem(PROBE); } catch (e) { /* 무시 */ }
  })();

  // 실패한 뒤에는 지금 읽기가 되는지 다시 본다 — removeFailed(확인된 실패)와 "알 수 없음"을 가르는 근거라 늘 지금 값이어야 한다
  function failed() { status.readable = canRead(); refresh(); }

  // 밀려 있던 쓰기·지우기를 다시 해 본다. 키마다 따로(하나가 안 돼도 나머지는 해 본다). 돌려주는 값 = 밀린 것이 하나도 안 남았나
  //   'set' = 최신 값을 쓴다(옛 값도 덮인다). 못 쓰는데 옛 값이 남았을 수 있으면(stale) 적어도 옛 값은 지워 본다 — 이 탭은 계속 새 값을 읽는다
  //   'gone' = 지우고 읽어서 없는 것까지 확인돼야 표시를 푼다
  function flush() {
    var k;
    for (k in pending) {
      if (!has(pending, k)) continue;
      if (pending[k] === 'set') {
        try { ls().setItem(k, memory[k]); delete pending[k]; delete stale[k]; status.available = true; continue; } catch (e) { /* 아래 */ }
        if (stale[k]) { try { erase(k); delete stale[k]; } catch (e) { /* 다음에 */ } }
      } else {
        try { erase(k); delete pending[k]; delete stale[k]; } catch (e) { /* 다음에 */ }
      }
    }
    for (k in stale) { if (has(stale, k) && !has(pending, k)) { try { erase(k); delete stale[k]; } catch (e) { /* 다음에 */ } } }
    if (dirty()) failed(); else refresh();
    return !dirty();
  }

  function get(key) {
    if (dirty()) flush(); // 밀린 것이 있으면 읽기 전에 다시 해 본다(저장소가 되살아났으면 여기서 따라잡는다)
    if (pending[key] === 'gone') return null;
    if (pending[key] === 'set') return memory[key];
    try { var v = ls().getItem(key); status.readable = true; refresh(); return v; } catch (e) { status.readable = false; refresh(); }
    return has(memory, key) ? memory[key] : null;
  }
  function set(key, value) {
    var old = pending[key] === 'gone' || stale[key]; // 지웠는데 저장소에서 사라진 것을 확인 못 한 키 — 새 값도 못 쓰면 옛 값이 남았을 수 있다
    memory[key] = value;
    try { ls().setItem(key, value); } catch (e) { pending[key] = 'set'; if (old) stale[key] = true; failed(); return false; }
    delete pending[key]; delete stale[key]; status.available = true;
    flush();
    return true;
  }
  // 저장소에서 실제로 지워졌으면(지우고 읽어서 없는 것까지 확인) true. 아니면 false — 확인하지 못한 지우기를 성공이라고 하지 않는다.
  //   실패하면 늘 'gone' 표시를 남긴다(읽기가 되든 안 되든): 이 탭은 지운 것으로 읽고, 저장소가 되살아나면 다시 지운다.
  //   읽기는 되는데 못 지웠으면 status.removeFailed, 읽기조차 안 되면 status.readable = false(남았는지 알 수 없음 — 안내는 app.js).
  function remove(key) {
    delete memory[key];
    pending[key] = 'gone';
    try { erase(key); } catch (e) { failed(); return false; }
    delete pending[key]; delete stale[key]; status.readable = true;
    flush();
    return true;
  }
  // 값을 바꿔 쓰되, 못 쓰면 저장소에 남은 옛 값을 지운다(이름처럼 남으면 안 되는 것이 들어 있을 때). 이 탭은 계속 새 값을 읽고, 저장이 되살아나면 새 값을 쓴다.
  //   돌려주는 값 = 저장소에 옛 값이 남지 않은 것이 확인됐나(새 값이 써졌거나, 옛 값을 지우고 확인했거나).
  //   둘 다 안 되면 stale로 남겨 다시 해 본다(읽기조차 안 돼도 — 알 수 없을 뿐 남았을 수 있다). removeFailed는 읽기가 될 때만
  function scrub(key, value) {
    var text;
    try { text = JSON.stringify(value); } catch (e) { return false; }
    if (set(key, text)) return true;
    try { erase(key); delete stale[key]; refresh(); return true; } catch (e) { stale[key] = true; failed(); return false; }
  }

  // 창에 다시 초점이 오거나 보일 때, 창을 떠날 때 밀린 것을 다시 해 본다(브라우저 설정을 바꾸고 돌아온 경우 등). 다시 해 본 뒤 app이 안내를 고칠 수 있게 onRetry를 부른다
  var api;
  function retry() {
    if (!dirty()) return;
    flush();
    if (api && typeof api.onRetry === 'function') { try { api.onRetry(); } catch (e) { /* 안내 실패가 게임을 멈추지 않게 */ } }
  }
  if (typeof root.addEventListener === 'function') {
    root.addEventListener('focus', retry);
    root.addEventListener('pageshow', retry);
    root.addEventListener('pagehide', retry);
    if (root.document && typeof root.document.addEventListener === 'function') root.document.addEventListener('visibilitychange', retry);
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

  root.PrivacyStorage = api = {
    KEYS: KEYS,
    status: status,
    readJSON: readJSON,
    writeJSON: writeJSON,
    remove: remove,
    scrub: scrub,
    flush: flush,
    pending: dirty, // 밀린 쓰기·지우기가 남았나(검사·안내용)
    onRetry: null,  // app.js가 넣는다: 창 초점·보임·떠남 때 다시 해 본 뒤 부름
    readPlayer: readPlayer,
    saveResult: saveResult,
    readResult: readResult
  };
})(window);
