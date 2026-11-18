// 2026-11-18 보안 검토: 저장소 읽기가 막힌 채 처음 열고 「이 게임 기록 지우기」를 누르면, 저장된 별명을 알 수 없어 이름 정리가 예약되지 않았다.
//   다른 기록(성찰 카드·진행·결과)은 접근이 돌아오면 지워지는데, 설정 속 별명(ethicity.privacy.settings.v1의 nickname)만 기기에 남았다.
//   이 검사는 app.js의 실제 지우기 코드(확인 창 콜백)와 checkRemoveFailure를 그대로 떼어 와 가짜 저장소 위에서 돌린다 — 브라우저 없음.
//   쓰기: node privacy/tests/wipe-name-1118.mjs
//   지킬 것: 접근이 돌아온 뒤 별명이 실제로 지워진다(읽어서 확인) · 소리·속도·주인공 모습 설정은 남는다 · 공통 키(ethicity.player)와 다른 게임 기록은 그대로
//            · 확인 전에는 지워졌다고 말하지 않는다(밀린 표시 유지, '확인하지 못했어요' / 읽히는데 못 지웠으면 '지우지 못했어요')
import fs from 'node:fs'; import vm from 'node:vm';
const SRC = fs.readFileSync(new URL('../js/storage.js', import.meta.url), 'utf8');
const APP = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
let pass = 0; const fails = [];
const ok = (c, name, note = '') => { if (c) pass++; else { fails.push(name + ' ' + note); console.log('  ✗ ' + name + ' ' + note); } };

// ── app.js에서 실제 코드 떼어 오기(중괄호 짝 맞추기)
function block(src, from) {
  const open = src.indexOf('{', from);
  let depth = 0, i = open, q = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) break;
  }
  return src.slice(open + 1, i);
}
const askAt = APP.indexOf("'이 게임 기록을 모두 지울까요?'");
const WIPE_BODY = block(APP, APP.indexOf("'지우기', function () {", askAt) + "'지우기', ".length);
const crfAt = APP.indexOf('function checkRemoveFailure(byUser)');
const CRF = 'var warnedRemove = false, warnedUnread = false;\nfunction checkRemoveFailure(byUser) {' + block(APP, crfAt) + '}';
ok(askAt > 0 && /cardWipe\(\)/.test(WIPE_BODY) && /S\.remove\(S\.KEYS\.progress\)/.test(WIPE_BODY), '(준비) app.js 지우기 콜백을 찾음', WIPE_BODY.slice(0, 80));
ok(crfAt > 0 && /showNotice/.test(CRF), '(준비) app.js checkRemoveFailure를 찾음');

// 가짜 저장소: fail = { read, write, remove } 가운데 켠 것만 던진다
function disk(init = {}) {
  const d = { data: { ...init }, fail: {} };
  d.ls = {
    getItem: (k) => { if (d.fail.read) throw new Error('SecurityError'); return k in d.data ? d.data[k] : null; },
    setItem: (k, v) => { if (d.fail.write) throw new Error('QuotaExceededError'); d.data[k] = String(v); },
    removeItem: (k) => { if (d.fail.remove) throw new Error('SecurityError'); delete d.data[k]; }
  };
  return d;
}
const bootS = (d) => {
  const ev = {}, on = (t, f) => { (ev[t] = ev[t] || []).push(f); };
  const ctx = { window: { localStorage: d.ls, addEventListener: on, document: { addEventListener: on } } };
  vm.runInNewContext(SRC, ctx);
  const S = ctx.window.PrivacyStorage; S.fire = (t) => (ev[t] || []).forEach((f) => f({ type: t }));
  return S;
};
// 이 게임을 여는 것 흉내: loadAll의 설정 읽기(못 읽으면 기본값) → 지우기 콜백 · checkRemoveFailure · onRetry 연결은 app.js 그대로
function openGame(d) {
  const S = bootS(d), K = S.KEYS;
  const settings = { speed: 'normal', reduceMotion: false, look: null, sound: true, nickname: '', joystick: true, helpPlaces: [], helpFold: false };
  const st = S.readJSON(K.settings).value;
  if (st && typeof st === 'object') Object.assign(settings, { speed: st.speed || 'normal', sound: st.sound !== false, look: st.look || null, nickname: typeof st.nickname === 'string' ? st.nickname : '' });
  const notices = [], nameInput = { value: settings.nickname };
  const ctx = {
    S, settings, notices, progress: null,
    $: (id) => (id === 'name-input' ? nameInput : {}),
    refreshName: () => {}, renderStart: () => {},
    cardWipe: () => { S.remove(K.card); ctx.checkRemoveFailure(); },
    showNotice: (m) => notices.push(m)
  };
  vm.createContext(ctx);
  vm.runInContext(CRF + '\nthis.checkRemoveFailure = checkRemoveFailure;', ctx);
  S.onRetry = function () { ctx.checkRemoveFailure(); }; // app.js 164행과 같은 연결
  const wipe = () => vm.runInContext('(function () {' + WIPE_BODY + '})()', ctx);
  return { S, K, settings, notices, nameInput, wipe, typeName: (n) => { settings.nickname = n; S.writeJSON(K.settings, settings); } };
}

const NICK = '검사용 별명';
const SET = { speed: 'fast', sound: false, soundSet: true, reduceMotion: true, look: 'f', nickname: NICK, joystick: false, helpPlaces: ['room'], helpFold: false };
const PLAYER = JSON.stringify({ character: 'onyu', nickname: '공통 별명' });
const WIPE = ['ethicity.privacy.card.v1', 'ethicity.privacy.progress.v2', 'ethicity.result.privacy'];
const seed = () => ({
  'ethicity.privacy.settings.v1': JSON.stringify(SET), 'ethicity.privacy.card.v1': JSON.stringify({ v: 1, name: '가상 이름', sid: '00000', answers: ['가상 답', '', ''] }),
  'ethicity.privacy.progress.v2': '{"v":1,"run":null}', 'ethicity.result.privacy': '{"game":"privacy","ending":"B"}',
  'ethicity.player': PLAYER, 'ethicity.result.data': '{"game":"data"}'
});
const stored = (d) => { const r = d.data['ethicity.privacy.settings.v1']; return r == null ? null : JSON.parse(r); };
const othersKept = (d) => d.data['ethicity.player'] === PLAYER && d.data['ethicity.result.data'] === '{"game":"data"}';
const kept = (v) => !!v && v.speed === 'fast' && v.sound === false && v.soundSet === true && v.reduceMotion === true && v.look === 'f' && v.joystick === false;
const UNREAD = /확인하지 못했어요/, NOTGONE = /지우지 못했어요/;
const pend = (S) => (typeof S.pending === 'function' ? S.pending() : null);

// ── 1. 검토 재현: 읽기가 막힌 채 처음 열기 → 모두 지우기 → 접근 회복 → 별명이 지워져야 한다
//   막힘 방식 2(통째로 · 읽기만) × 회복 계기 4(다른 키 읽기 · 창 초점 · 창 떠남 · 다른 키 쓰기)
const BLOCK = { all: { read: true, write: true, remove: true }, read: { read: true } };
for (const [mode, fail] of Object.entries(BLOCK)) {
  for (const how of ['read', 'focus', 'pagehide', 'write']) {
    const tag = `1 ${mode}/${how}`;
    const d = disk(seed()); d.fail = { ...fail };
    const g = openGame(d);
    ok(g.settings.nickname === '' && g.S.status.readable === false, tag + ' (준비) 처음 열 때 저장된 별명을 읽지 못함');
    g.wipe();
    ok(g.notices.some((m) => UNREAD.test(m)), tag + " 막힌 동안: '확인하지 못했어요' 안내", JSON.stringify(g.notices));
    ok(!g.notices.some((m) => /지웠어요\.?$/.test(m) && !UNREAD.test(m)), tag + ' 막힌 동안: 지워졌다고만 말하지 않음');
    ok(pend(g.S) === true, tag + ' 막힌 동안: 밀린 표시가 남음(이름 정리 포함 — 아직 확인 안 됨)');
    ok(stored(d).nickname === NICK, tag + ' (가짜 저장소) 막힌 동안은 아직 기기에 있음');
    // 접근 회복
    d.fail = {};
    if (how === 'read') g.S.readJSON(g.K.progress);
    else if (how === 'write') g.S.writeJSON(g.K.progress, { v: 1, run: null, explored: {}, endingsSeen: [], pos: null });
    else g.S.fire(how);
    ok(WIPE.every((k) => !(k in d.data) || (how === 'write' && k === g.K.progress)), tag + ' 회복 뒤 성찰 카드·진행·결과가 지워짐(write = 새로 쓴 진행만 남음)');
    ok(stored(d) && !stored(d).nickname, tag + ' 회복 뒤 저장소의 별명이 지워짐', d.data['ethicity.privacy.settings.v1']);
    ok(kept(stored(d)), tag + ' 소리·속도·움직임·주인공 모습·조이스틱 설정은 그대로', d.data['ethicity.privacy.settings.v1']);
    ok(othersKept(d), tag + ' 공통 플레이어 키(ethicity.player)·다른 게임 기록 그대로');
    ok(pend(g.S) === false && !g.S.status.removeFailed && g.S.status.readable, tag + ' 확인 끝: 밀린 표시가 모두 풀림', JSON.stringify(g.S.status));
    ok(!g.notices.some((m) => NOTGONE.test(m)), tag + " 지워졌으니 '지우지 못했어요'는 없음");
    const again = openGame(d);
    ok(again.settings.nickname === '' && again.settings.speed === 'fast' && again.settings.sound === false, tag + ' 새로 열어도 별명은 없고 설정은 남음');
  }
}

// ── 2. 읽기만 돌아오고 쓰기·지우기는 계속 막힘: 남은 것이 확인됨 → '지우지 못했어요', 이 탭은 별명 없는 값으로 읽음. 다 풀리면 그때 정리
{
  const d = disk(seed()); d.fail = { ...BLOCK.all };
  const g = openGame(d); g.wipe();
  d.fail = { write: true, remove: true };
  g.S.fire('focus');
  ok(stored(d).nickname === NICK && pend(g.S) === true && g.S.status.removeFailed === true, '2 읽기만 회복: 별명이 남은 것이 확인됨(removeFailed)', JSON.stringify(g.S.status));
  ok(g.notices.some((m) => NOTGONE.test(m)), "2 그때 '지우지 못했어요' 안내(지워졌다고 말하지 않음)", JSON.stringify(g.notices));
  ok(g.S.readJSON(g.K.settings).value.nickname === '' && g.S.readJSON(g.K.settings).value.speed === 'fast', '2 이 탭은 별명 없이 읽음(설정은 저장된 값)');
  d.fail = {}; g.S.fire('focus');
  ok(!stored(d).nickname && kept(stored(d)) && pend(g.S) === false && !g.S.status.removeFailed, '2 모두 풀리면 별명만 지워지고 설정은 남음', d.data['ethicity.privacy.settings.v1']);
  ok(othersKept(d), '2 공통 키 그대로');
}

// ── 3. 읽기·지우기는 되는데 쓰기만 안 됨(용량 초과): 별명만 뺀 값을 못 쓰면 옛 설정을 통째로 지운다(이름이 남지 않는 것이 먼저)
{
  const d = disk(seed()); d.fail = { ...BLOCK.all };
  const g = openGame(d); g.wipe();
  d.fail = { write: true }; g.S.fire('focus');
  ok(!('ethicity.privacy.settings.v1' in d.data) || !stored(d).nickname, '3 쓰기만 안 되면 옛 설정을 지워서라도 별명을 남기지 않음', d.data['ethicity.privacy.settings.v1']);
  ok(!g.S.status.removeFailed && othersKept(d), '3 지워졌으니 removeFailed 아님, 공통 키 그대로', JSON.stringify(g.S.status));
}

// ── 4. 막힌 동안 이 탭에서 이름을 적었다가(못 씀) 지우기 → 회복 뒤 그 이름도, 옛 이름도 남지 않음
{
  const d = disk(seed()); d.fail = { ...BLOCK.all };
  const g = openGame(d); g.typeName('막힌 동안 이름');
  g.wipe(); d.fail = {}; g.S.fire('focus');
  const v = stored(d);
  ok(!v || !v.nickname, '4 막힌 동안 적은 이름도 회복 뒤 저장소에 남지 않음', d.data['ethicity.privacy.settings.v1']);
  ok(pend(g.S) === false && othersKept(d), '4 표시 풀림, 공통 키 그대로');
}

// ── 5. 지운 뒤(막힌 채) 새 이름을 적으면 그 새 이름은 지키고 옛 이름만 사라진다
{
  const d = disk(seed()); d.fail = { ...BLOCK.all };
  const g = openGame(d); g.wipe(); g.typeName('새 이름');
  d.fail = {}; g.S.fire('focus');
  ok(stored(d).nickname === '새 이름', '5 지운 뒤 적은 새 이름은 저장됨(이름 정리가 새 이름을 지우지 않음)', d.data['ethicity.privacy.settings.v1']);
  ok(pend(g.S) === false, '5 표시 풀림');
}

// ── 6. 정상(막힘 없음): 지우기 즉시 별명만 사라지고 설정·공통 키 그대로, 밀린 것 없음, 안내 없음
{
  const d = disk(seed()); const g = openGame(d);
  ok(g.settings.nickname === NICK, '6 (준비) 정상으로 열면 별명이 읽힘');
  g.wipe();
  ok(!stored(d).nickname && stored(d).look === 'f' && WIPE.every((k) => !(k in d.data)) && othersKept(d), '6 정상: 별명·기록 지워짐, 주인공 모습·공통 키 그대로', d.data['ethicity.privacy.settings.v1']);
  ok(pend(g.S) === false && g.notices.length === 0, '6 정상: 밀린 것·안내 없음', JSON.stringify(g.notices));
}
// ── 7. 저장된 설정이 아예 없을 때 막힌 채 지우기 → 회복 뒤 설정 키를 새로 만들지 않음
{
  const init = seed(); delete init['ethicity.privacy.settings.v1'];
  const d = disk(init); d.fail = { ...BLOCK.all };
  const g = openGame(d); g.wipe(); d.fail = {}; g.S.fire('focus');
  ok(!('ethicity.privacy.settings.v1' in d.data) && pend(g.S) === false && othersKept(d), '7 저장된 설정이 없으면 회복 뒤에도 만들지 않고 표시만 풀림', JSON.stringify(d.data));
}

console.log(`\nwipe-name-1118: 통과 ${pass} · 실패 ${fails.length}`);
process.exit(fails.length ? 1 : 0);
