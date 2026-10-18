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
