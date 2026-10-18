// 프로브(앱 뒤에 실행): 실제 화면 버튼을 눌러 플레이하고 결과를 <pre id="probe-out">에 남긴다.
(function () {
  var P = window.__probe;
  var pass = [], fail = [];
  function ok(cond, msg) { (cond ? pass : fail).push(msg); }
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms || 0); }); }
  function screen() { return document.body.getAttribute('data-screen'); }
  function out() {
    var pre = document.createElement('pre');
    pre.id = 'probe-out';
    pre.textContent = JSON.stringify({ scenario: P.scenario, pass: pass, fail: fail, errors: P.errors });
    document.body.appendChild(pre);
  }
  // 키보드로 누를 수 있는 요소만 쓴다: 포커스 가능·보임 확인 → 포커스 → Enter → 활성화
  function press(el, label) {
    if (typeof el === 'string') { label = label || el; el = $(el); }
    if (!el) { fail.push('없는 요소: ' + label); return false; }
    var visible = el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
    if (el.disabled || el.tabIndex < 0 || !visible) { fail.push('키보드로 누를 수 없음: ' + (label || el.id || el.className)); return false; }
    el.focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    el.click();
    return true;
  }
  async function until(fn, ms) {
    var t = 0;
    while (!fn() && t < (ms || 20000)) { await wait(50); t += 50; }
    return fn();
  }
  function bodyText() { return document.body.innerText; }
  function noNewTown(where) {
    ok(bodyText().indexOf('신도시') < 0, where + ': 화면 글에 신도시 없음');
    ok(!$('[data-node="I"]'), where + ': 지도에 I 정류장 없음');
    ok(document.body.innerHTML.indexOf('신도시') < 0, where + ': DOM(접근성 텍스트 포함)에 신도시 없음');
  }

  var SC = {};

  SC.title = async function () {
    ok(screen() === 'title', '시작 화면');
    ok($('h1') && $('h1').textContent.trim() === '이번 정류장은…', '제목 「이번 정류장은…」');
    ok(/AI 마을버스 운영단/.test($('#title-sub').textContent), '부제');
    ok(/This stop is/.test($('#title-en').textContent), '영문 표기');
    var lines = PB.Narrative.hookLines(PB.Session.create(PB.config, { mode: 'default' }));
    ok($('#hook-1').textContent === lines[0] && $('#hook-2').textContent === lines[1], '훅 두 문장 = 엔진 계산');
    ok($('input[name=setting][value=default]').checked, '기본 세팅이 기본 선택');
    ok($('input[name=setting][value=random]'), '랜덤 세팅 선택지');
    ok(/새로고침/.test(bodyText()), '새로고침 안내');
    ok(document.activeElement === $('#btn-start') || $('#btn-start').tabIndex >= 0, '시작 버튼 키보드 접근');
    press('#btn-start');
    await until(function () { return screen() === 'reveal'; });
    ok(screen() === 'reveal', '시작 → 1단계 환경 공개');
    ok(/1단계/.test($('#panel').textContent) && /학기 초/.test($('#panel').textContent), '1단계 학기 초 안내');
  };

  SC['seed-param'] = async function () {
    ok(/지정된 세팅 7/.test($('#seed-note').textContent), '지정된 세팅 표시');
    press('#btn-start');
    await until(function () { return screen() === 'reveal'; });
    ok(PB.App.state().seed === 7 && PB.App.state().mode === 'fixed', '세션 seed 7');
  };

  SC['newtown-hidden'] = async function () {
    noNewTown('시작 화면');
    press('#btn-start');
    await until(function () { return screen() === 'reveal'; });
    noNewTown('1단계 공개');
    press('#btn-begin-plan');
    await until(function () { return screen() === 'plan'; });
    noNewTown('1단계 계획');
    ok($$('[data-node]').length >= 8, '지도 정류장 8곳');
  };

  async function toPlan() {
    press('#btn-start');
    await until(function () { return screen() === 'reveal'; });
    press('#btn-begin-plan');
    await until(function () { return screen() === 'plan'; });
  }
  // 운행 화면이 없어도 세션 API로 단계를 넘긴다(설정용)
  function skipPhases(n) {
    var s = PB.App.state();
    for (var i = 0; i < n; i++) { PB.Session.beginPlan(s); PB.Session.startRun(s); PB.Session.finishRun(s); PB.Session.nextPhase(s); }
    PB.App.go('reveal');
  }
  function card(num) { return $('.route-card[data-num="' + num + '"]'); }
  async function chooseGoal(goal) {
    press('.goal-btn[data-goal="' + goal + '"]');
    await until(function () { return $('#rec-card'); }, 30000);
    return $('#rec-card');
  }
  async function buildRoute(nodes) {
    press('#btn-new-route');
    for (var i = 0; i < nodes.length; i++) {
      var b = $('.next-stop[data-node="' + nodes[i] + '"]');
      if (!press(b, '다음 정류장 ' + nodes[i])) return null;
      await wait(0);
    }
    var editing = $('.route-card.editing');
    var num = editing && Number(editing.getAttribute('data-num'));
    press(editing.querySelector('.btn-finish'), '노선 완성');
    await wait(0);
    return num;
  }
  async function depart() {
    press('#btn-depart');
    await until(function () { return $('#confirm-depart').open; });
    press('#confirm-yes');
    await until(function () { return screen() === 'run' || screen() === 'result'; });
  }

  SC['shot-plan'] = async function () { await toPlan(); await chooseGoal('reach'); ok(true, 'shot'); };

  SC['plan-keyboard'] = async function () {
    await toPlan();
    var rc = await chooseGoal('time');
    ok(!!rc, 'AI 제안 카드');
    ok(/모의 AI: 알려진 수요로 후보를 비교하는 규칙 기반 추천/.test(rc.textContent), '모의 AI 라벨');
    ok(/추가 사건 없는 기본 수요 기준/.test(rc.textContent), '예상 라벨');
    press('#rec-accept');
    await wait(0);
    ok(PB.App.state().goalHistory[0].action === 'accept', '수락 기록');
    ok(screen() === 'plan', '수락해도 운행은 자동 시작하지 않음');
    var num = await buildRoute(['F', 'C', 'D']);
    ok(num && card(num), '키보드로 F–C–D 노선 만들기');
    var sel = $('.bus-card[data-bus="3"] select');
    sel.focus(); sel.value = String(num); sel.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(0);
    ok(PB.App.state().draft.buses[2].routeNum === num, '3호차 배정');
    press('.bus-card[data-bus="3"] .offset-btn[data-offset="4"]');
    await wait(0);
    ok(PB.App.state().draft.buses[2].offset === 4, '출차 4분');
    await until(function () { return /추가 사건 없는 기본 수요 기준/.test(($('#expected') || {}).textContent || ''); });
    ok(true, '예상 지표 갱신');
    await depart();
    ok(screen() === 'run' || screen() === 'result', '출발 확인 → 운행 화면');
  };

  SC['nonadjacent-blocked'] = async function () {
    await toPlan();
    press('#btn-new-route');
    press('.next-stop[data-node="A"]');
    await wait(0);
    var nexts = $$('.next-stop').map(function (b) { return b.getAttribute('data-node'); }).sort().join('');
    ok(nexts === 'BDGH', 'A 다음은 이웃 B·D·G·H만 (' + nexts + ')');
    ok(!$('.next-stop[data-node="C"]'), 'C는 고를 수 없음');
    PB.App.onNodeClick('C');
    await wait(0);
    var r = PB.App.state().draft.routes.at(-1);
    ok(r.nodes.join('') === 'A', '지도에서 C를 눌러도 추가 안 됨');
  };

  SC['cycle-display'] = async function () {
    await toPlan();
    var num = await buildRoute(['A', 'B', 'C']);
    ok(/한 바퀴 12분/.test(card(num).textContent), 'A–B–C 주기 12분');
    press(card(num).querySelector('.chip[data-i="1"]'), 'B 정차/통과');
    await wait(0);
    ok(/한 바퀴 10분/.test(card(num).textContent), 'B 통과 후 10분');
    ok(card(num).querySelector('.chip[data-i="0"]').disabled, '끝점은 통과로 못 바꿈');
  };

  SC['fourth-bus'] = async function () {
    press('#btn-start');
    await until(function () { return screen() === 'reveal'; });
    skipPhases(2);
    await wait(0);
    ok(/4호차/.test($('#panel').textContent) && /신도시/.test($('#panel').textContent), '3단계 공개: 신도시·4호차 안내');
    ok(!!$('[data-node="I"]'), '3단계 지도에 신도시');
    press('#btn-begin-plan');
    await until(function () { return screen() === 'plan'; });
    await chooseGoal('reach');
    ok(!!$('#rec-fourth'), '4호차 별도 카드');
    press('#rec-accept');
    await wait(0);
    ok(PB.App.state().draft.buses.length === 3, '수락해도 버스 3대');
    press('#btn-fourth-intro');
    await wait(0);
    ok(!!$('.bus-card[data-bus="4"]'), '4호차 카드');
    var sel = $('.bus-card[data-bus="4"] select');
    sel.value = String(PB.App.state().draft.buses[0].routeNum); sel.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(0);
    ok(/4호차는 처음 운행할 때 새 노선/.test($('#plan-errors').textContent), '기존 노선 배정 시 오류 문구');
    ok($('#btn-depart').getAttribute('aria-disabled') === 'true' || PB.Session.validate(PB.App.state()).length > 0, '출발 막힘');
  };

  SC['double-start'] = async function () {
    await toPlan();
    var calls = 0, orig = PB.Session.startRun;
    PB.Session.startRun = function (s) { var r = orig(s); if (r) calls++; return r; };
    press('#btn-depart');
    await until(function () { return $('#confirm-depart').open; });
    var yes = $('#confirm-yes');
    yes.click(); yes.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await wait(50);
    ok(calls === 1, '운행은 한 번만 시작 (' + calls + ')');
    PB.Session.startRun = orig;
  };

  SC['invalid-draft-ai'] = async function () {
    await toPlan();
    press('#btn-new-route');
    press('.next-stop[data-node="H"]');
    await wait(0);
    var sel = $('.bus-card[data-bus="1"] select');
    sel.value = String(PB.App.state().draft.routes.at(-1).num); sel.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(0);
    var rc = await chooseGoal('profit');
    ok(!!rc && /바뀌는 점|그대로/.test(rc.textContent), '미완성 노선이 있어도 추천 카드');
    ok($('#plan-errors').textContent.length > 0, '미완성 노선 배정 오류 안내');
  };

  (async function () {
    try {
      var fn = SC[P.scenario];
      if (!fn) fail.push('알 수 없는 시나리오 ' + P.scenario);
      else await fn();
    } catch (e) { fail.push('예외: ' + (e && e.stack || e)); }
    out();
  })();
  window.__probeSC = SC;
})();
