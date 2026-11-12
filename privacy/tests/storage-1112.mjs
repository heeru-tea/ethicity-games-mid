// 2026-11-12 추가 검토 1번(저장 래퍼): node privacy/tests/storage-1112.mjs
//   시작할 때 쓰기 검사가 실패해도(용량 초과) 읽기·지우기는 실제로 한다 · 지우지 못했으면 false + removeFailed · 저장소 접근이 통째로 막히면 false + readable=false
//   · 저장이 되살아나면 밀린 쓰기·지우기를 다시 한다 · 새로 열어도 지운 이름·학번·답이 되살아나지 않는다 · 공통 키(ethicity.player)와 다른 게임 기록은 그대로
import fs from 'node:fs'; import vm from 'node:vm';
const SRC = fs.readFileSync(new URL('../js/storage.js', import.meta.url), 'utf8');
let pass = 0; const fails = [];
const ok = (c, name, note = '') => { if (c) pass++; else { fails.push(name + ' ' + note); console.log('  ✗ ' + name + ' ' + note); } };

// 가짜 저장소: fail = { read, write, remove } 가운데 켠 것만 던진다. calls = 실제 호출 수
function disk(init = {}) {
  const d = { data: { ...init }, fail: {}, calls: { get: 0, set: 0, remove: 0 } };
  d.ls = {
    getItem: (k) => { d.calls.get++; if (d.fail.read) throw new Error('SecurityError'); return k in d.data ? d.data[k] : null; },
    setItem: (k, v) => { d.calls.set++; if (d.fail.write) throw new Error('QuotaExceededError'); d.data[k] = String(v); },
    removeItem: (k) => { d.calls.remove++; if (d.fail.remove) throw new Error('SecurityError'); delete d.data[k]; }
  };
  return d;
}
const boot = (d) => { const ctx = { window: { localStorage: d.ls } }; vm.runInNewContext(SRC, ctx); return ctx.window.PrivacyStorage; };
const CARD = JSON.stringify({ v: 1, name: '검사용 가상 이름', sid: '00000', answers: ['가상 답변', '', ''] });
const SET = JSON.stringify({ speed: 'normal', look: 'm', nickname: '검사용 별명' });
const OTHER = { 'ethicity.player': JSON.stringify({ character: 'onyu', nickname: '공통 별명' }), 'ethicity.result.data': '{"game":"data"}' };
const seed = () => ({ 'ethicity.privacy.card.v1': CARD, 'ethicity.privacy.settings.v1': SET, 'ethicity.privacy.progress.v2': '{"v":1,"run":{"x":1}}', 'ethicity.result.privacy': '{"game":"privacy","ending":"B"}', ...OTHER });
const othersKept = (d) => d.data['ethicity.player'] === OTHER['ethicity.player'] && d.data['ethicity.result.data'] === OTHER['ethicity.result.data'];

// ── 1. 검토 재현: 시작할 때 쓰기만 실패(읽기·지우기는 됨)
{
  const d = disk(seed()); d.fail.write = true;
  const S = boot(d), K = S.KEYS;
  ok(S.status.available === false && S.status.readable === true, '1 쓰기 검사 실패: available=false, readable=true', JSON.stringify(S.status));
  ok(S.readJSON(K.card).value && S.readJSON(K.card).value.name === '검사용 가상 이름', '1 쓰기가 안 돼도 옛 기록은 읽는다(없는 것으로 치지 않는다)');
  const before = d.calls.remove;
  const r = [S.remove(K.card), S.remove(K.progress), S.remove(K.result)];
  ok(r.every((x) => x === true), '1 지우기 = true(실제로 지워짐)', JSON.stringify(r));
  ok(d.calls.remove - before === 3, '1 removeItem을 실제로 3번 부른다', String(d.calls.remove - before));
  ok(!(K.card in d.data) && !(K.progress in d.data) && !(K.result in d.data), '1 저장소에 성찰 카드·진행·결과가 남지 않는다');
  ok(S.status.removeFailed === false, '1 지워졌으니 removeFailed=false');
  // 이름이 든 설정: 못 쓰면 저장소의 옛 설정을 지운다
  const s2 = S.scrub(K.settings, { speed: 'normal', look: 'm', nickname: '' });
  ok(s2 === true && !(K.settings in d.data), '1 scrub: 못 쓰면 옛 설정(이름)을 저장소에서 지운다', JSON.stringify([s2, d.data[K.settings]]));
  ok(S.readJSON(K.settings).value.nickname === '' && S.readJSON(K.settings).value.look === 'm', '1 이 탭은 이름 없는 새 설정을 읽는다(주인공 모습은 그대로)');
  ok(S.status.removeFailed === false && S.status.writeFailed === true, '1 남은 것은 못 쓴 새 설정뿐(writeFailed)');
  ok(othersKept(d), '1 공통 플레이어 정보·다른 게임 기록은 그대로');
  // 새로 열기(쓰기는 여전히 안 됨): 이름·학번·답이 되살아나지 않는다
  const S2 = boot(d);
  ok(S2.readJSON(K.card).value === null && S2.readJSON(K.settings).value === null && S2.readJSON(K.progress).value === null, '1 새로 열어도 이름·학번·답·진행이 되살아나지 않는다');
  // 저장이 되살아남: 같은 래퍼가 다시 쓴다(밀린 설정도)
  d.fail.write = false;
  ok(S.writeJSON(K.progress, { v: 1, run: null }) === true, '1 저장이 되살아나면 같은 탭에서 다시 써진다');
  ok(S.status.available === true && S.status.writeFailed === false, '1 되살아난 뒤 available=true, writeFailed=false', JSON.stringify(S.status));
  ok(JSON.parse(d.data[K.settings]).nickname === '' && JSON.parse(d.data[K.settings]).look === 'm', '1 밀렸던 새 설정(이름 없음)이 저장소에 써진다');
  ok(othersKept(d), '1 되살아난 뒤에도 공통 키 그대로');
}

// ── 2. 저장소 접근이 통째로 거부(읽기·쓰기·지우기 모두 던짐)
{
  const d = disk(seed()); d.fail = { read: true, write: true, remove: true };
  const S = boot(d), K = S.KEYS;
  ok(S.status.available === false && S.status.readable === false, '2 통째로 막힘: available=false, readable=false', JSON.stringify(S.status));
  ok(S.readJSON(K.card).value === null, '2 읽을 수 없으면 빈 값(멈추지 않는다)');
  ok(S.writeJSON(K.card, { name: '새' }) === false && S.readJSON(K.card).value.name === '새', '2 못 써도 이 탭에서는 메모리 값을 읽는다');
  ok(S.remove(K.card) === false, '2 지우기 = false(확인할 수 없는데 성공이라고 하지 않는다)');
  ok(S.readJSON(K.card).value === null, '2 이 탭에서는 지워진 것으로 읽는다');
  ok(S.status.removeFailed === false && S.status.readable === false, '2 남았는지 알 수 없음 = removeFailed 아님, readable=false(안내는 app이 따로)', JSON.stringify(S.status));
  ok(d.data[K.card] === CARD && othersKept(d), '2 저장소는 아무것도 못 건드림(가짜 저장소 확인)');
}
// ── 2b. localStorage를 꺼내는 것부터 던지는 브라우저
{
  const ctx = { window: { get localStorage() { throw new Error('blocked'); } } };
  vm.runInNewContext(SRC, ctx); const S = ctx.window.PrivacyStorage, K = S.KEYS;
  ok(S.status.available === false && S.status.readable === false, '2b localStorage 접근 자체가 막힘');
  ok(S.writeJSON(K.progress, { a: 1 }) === false && S.readJSON(K.progress).value.a === 1 && S.remove(K.progress) === false && S.readJSON(K.progress).value === null, '2b 메모리로 굴러가고 지우기는 false');
  ok(S.scrub(K.settings, { nickname: '' }) === false && S.status.removeFailed === false, '2b scrub도 false, removeFailed로 세지 않는다');
}

// ── 3. 플레이 도중 실패(시작은 정상)
{
  const d = disk(seed()); const S = boot(d), K = S.KEYS;
  ok(S.status.available && S.status.readable, '3 시작은 정상');
  // 3a 도중에 지우기만 실패
  d.fail.remove = true;
  ok(S.remove(K.card) === false && S.status.removeFailed === true, '3a 지우기 실패 = false + removeFailed');
  ok(S.readJSON(K.card).value === null && d.data[K.card] === CARD, '3a 이 탭은 지운 것으로 읽고, 저장소에는 남아 있다');
  d.fail.remove = false;
  ok(S.writeJSON(K.progress, { v: 1 }) === true && !(K.card in d.data) && S.status.removeFailed === false, '3a 지우기가 되살아나면 다음 쓰기 때 밀린 지우기를 마친다');
  // 3b 도중에 쓰기만 실패 → 지우기는 된다
  d.fail.write = true;
  ok(S.writeJSON(K.card, { name: '도중' }) === false && S.status.writeFailed === true && S.readJSON(K.card).value.name === '도중', '3b 쓰기 실패: 메모리 값을 읽는다');
  ok(S.remove(K.card) === true && S.readJSON(K.card).value === null && S.status.writeFailed === false, '3b 그 키를 지우면 밀린 쓰기도 없어진다');
  // 3c 지워지지 않는 저장소(removeItem이 조용히 아무것도 안 함)
  const d2 = disk(seed()); d2.ls.removeItem = () => { d2.calls.remove++; };
  const S3 = boot(d2);
  ok(S3.remove(K.card) === false && S3.status.removeFailed === true && S3.readJSON(K.card).value === null, '3c 지웠다는데 읽으면 남아 있음 = false(읽어서 확인한다)');
  // 3d scrub: 쓰기도 지우기도 실패(읽기는 됨) → 옛 값이 남았다고 알린다
  const d3 = disk(seed()); const S4 = boot(d3); d3.fail.write = true; d3.fail.remove = true;
  ok(S4.scrub(K.settings, { nickname: '' }) === false && S4.status.removeFailed === true, '3d scrub 실패 = false + removeFailed(옛 이름이 기기에 남음)');
  ok(S4.readJSON(K.settings).value.nickname === '', '3d 이 탭은 새 값을 읽는다');
  d3.fail = {};
  ok(S4.flush() === true && JSON.parse(d3.data[K.settings]).nickname === '' && S4.status.removeFailed === false && S4.status.writeFailed === false, '3d 되살아난 뒤 flush: 새 값으로 덮어쓰고 표시가 풀린다');
}

// ── 4. 정상 경로는 예전 그대로
{
  const d = disk(seed()); const S = boot(d), K = S.KEYS;
  ok(S.writeJSON(K.card, { name: 'x' }) === true && JSON.parse(d.data[K.card]).name === 'x' && S.readJSON(K.card).value.name === 'x', '4 쓰기·읽기');
  ok(S.remove(K.card) === true && !(K.card in d.data), '4 지우기');
  ok(!S.status.writeFailed && !S.status.removeFailed && !('__ethicity_privacy_probe__' in d.data), '4 표시 없음, 검사용 키 안 남음');
  ok(S.readPlayer('온유').nickname === '공통 별명' && othersKept(d), '4 공통 플레이어 정보 읽기만');
  const a = {}; a.self = a;
  ok(S.writeJSON(K.card, a) === false && !S.status.writeFailed, '4 문자열로 못 바꾸는 값은 저장소 문제가 아니다');
}

console.log(`\nstorage-1112: 통과 ${pass} · 실패 ${fails.length}`);
process.exit(fails.length ? 1 : 0);
