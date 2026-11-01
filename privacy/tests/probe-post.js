// 프로브(앱 뒤에 실행): 실제 화면 버튼을 눌러 플레이하고 결과를 <pre id="probe-out">에 남긴다.
(function () {
  var P = window.__probe;
  // 시작 직후 주의 화면은 'warning' 시나리오만 직접 확인하고, 나머지 시나리오에선 바로 '확인'을 누른다
  if (!/warning/.test(P.scenario)) new MutationObserver(function () {
    var w = document.getElementById('warning');
    if (w && !w.hidden) { var b = document.getElementById('btn-warning-ok'); if (b) b.click(); }
  }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
  var carried = JSON.parse(sessionStorage.getItem('probe-carry') || '{"pass":[],"fail":[]}');
  var pass = carried.pass, fail = carried.fail;
  function carry() { sessionStorage.setItem('probe-carry', JSON.stringify({ pass: pass, fail: fail })); }
  function ok(cond, msg) { (cond ? pass : fail).push(msg); }
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms || 0); }); }
  function view() { return document.body.getAttribute('data-view'); }
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return '(blocked)'; } }
  function out() {
    var pre = document.createElement('pre');
    pre.id = 'probe-out';
    pre.textContent = JSON.stringify({ scenario: P.scenario, pass: pass, fail: fail, errors: P.errors });
    document.body.appendChild(pre);
  }
  function loadRoutes() {
    return new Promise(function (r) { var s = document.createElement('script'); s.src = 'tests/routes.js'; s.onload = r; document.head.appendChild(s); });
  }
  function confirmYes() { $('#confirm-yes').click(); }

  // route를 화면 조작으로 진행. upto: 이 개수만큼 선택하고 멈춤. keyboard: 숫자 키로 선택
  async function play(route, opts) {
    opts = opts || {};
    var i = opts.from || 0, guard = 0, badWords = 0;
    while (guard++ < 400) {
      await wait(opts.delay || 0);
      var v = view();
      if (v === 'v-ending') break;
      if (v === 'v-chapter') { if (opts.stopAtChapter != null && i >= opts.stopAtChapter) return i; $('#btn-chapter-go').click(); continue; }
      if (v === 'v-map') {
        if (opts.upto != null && opts.stopAtMap && i >= opts.upto) return i;
        if (opts.walk) await walkToTarget(opts);
        else { $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk(); }
        await wait(opts.delay || 0);
        continue;
      }
      if (v !== 'v-game') { fail.push('예상 밖 화면: ' + v); break; }
      if ($('#talk') && !$('#talk').hidden) { await passTalk(); continue; }
      if (PrivacyApp.staging && PrivacyApp.staging()) { await wait(50); continue; }
      var skip = $('.skip-btn');
      if (skip) { skip.click(); continue; }
      var choices = $$('#g-dock .choice');
      if (choices.length) {
        if (opts.upto != null && i >= opts.upto) return i;
        var want = route[i], sc = want.split('#')[0], id = want.split('#')[1];
        var st = PrivacyApp.state();
        if (st.scene !== sc) { fail.push('경로 어긋남: 현재 ' + st.scene + ', 예정 ' + want); break; }
        choices.forEach(function (b) { if (/정답|오답/.test(b.textContent)) badWords++; });
        var idx = choices.findIndex(function (b) { return b.getAttribute('data-choice') === id; });
        if (idx < 0) { fail.push('선택지 없음: ' + want); break; }
        if (opts.keyboard) document.dispatchEvent(new KeyboardEvent('keydown', { key: String(idx + 1), bubbles: true }));
        else choices[idx].click();
        i++;
        continue;
      }
      var next = $('#btn-next');
      if (next) { next.click(); continue; }
      fail.push('진행 버튼이 없음 @' + PrivacyApp.state().scene); break;
    }
    ok(badWords === 0, '선택지에 정답/오답 표시 없음');
    return i;
  }

  // 대화창이 열려 있으면 ▼를 눌러 끝까지 넘긴다
  function realLis() { return $$('#g-log li').filter(function (li) { return !li.classList.contains('typing'); }); } // '입력 중…' 줄 빼고
  async function passTalk(o) { var g = 0; while ($('#talk') && !$('#talk').hidden && g++ < 60) { if (o) o.talkLines = (o.talkLines || 0) + $$('#talk .talk-text p').length; $('#btn-talk-next').click(); await wait(20); } }
  function key(k, type) { document.dispatchEvent(new KeyboardEvent(type || 'keydown', { key: k, bubbles: true })); }
  var ARROW = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  async function walkToTarget(opts) {
    var M = PrivacyMap.debug, route = M.route();
    if (!route) { fail.push('맵: 대상까지 길 없음'); return; }
    opts.walked = (opts.walked || 0) + route.length;
    for (var k = 0; k < route.length; k++) {
      key(ARROW[route[k]]); key(ARROW[route[k]], 'keyup');
      var g = 0; await wait(16);
      while (M.me().moving && g++ < 100) await wait(16);
      var area = M.me().area;
      if (opts.areas && opts.areas[opts.areas.length - 1] !== area) opts.areas.push(area);
    }
    if (!M.nearTarget()) fail.push('맵: 걸어서 대상 옆에 도착하지 못함 ' + JSON.stringify(M.me()));
    key(' ');
    var g2 = 0; while (view() === 'v-map' && g2++ < 200) { await passTalk(opts); await wait(20); }
  }
  function checkOthersKept() {
    var same = Object.keys(P.OTHER).every(function (k) { return ls(k) === P.OTHER[k]; });
    ok(same, '다른 게임 저장 데이터 보존');
  }
  function checkResult(code) {
    var raw = ls('ethicity.result.privacy'), r = null;
    try { r = JSON.parse(raw); } catch (e) { /* */ }
    ok(!!r && r.game === 'privacy' && r.completed === true && r.ending === code && typeof r.card === 'string' && r.card.length > 0,
      '공통 결과 저장 ' + code + ' ' + raw);
    ok(!!r && Object.keys(r).sort().join(',') === 'card,completed,ending,game', '결과에 내부 상태를 추가하지 않음');
  }
  async function finishChecks(code, routeLen) {
    ok(view() === 'v-ending', '엔딩 화면 도착');
    ok($('#e-eyebrow').textContent === '엔딩 ' + code, '엔딩 코드 표시 ' + $('#e-eyebrow').textContent);
    ok($$('#e-events .event-card').length === 9, '사건별 결과 9개 표시');
    ok($$('#e-events .event-card li').length >= 9, '사건 결과 문장 존재');
    checkResult(code);
    ok(ls('ethicity.player') === P.PLAYER || P.scenario === 'no-player' || P.scenario === 'blocked', '공통 플레이어 정보를 덮어쓰지 않음');
    checkOthersKept();
    $('#btn-end-path').click(); await wait();
    ok(view() === 'v-path', '선택 경로 화면');
    ok($$('.path-opts li.mine').length === routeLen, '경로의 내 선택 수 = ' + routeLen + ' (표시 ' + $$('.path-opts li.mine').length + ')');
    ok($$('.path-opts li.other').length > 0, '고르지 않은 선택지도 표시');
    ok($$('.ending-chips li').length === 4, '엔딩 목록 4종');
    $('#btn-path-reflect').click(); await wait();
    ok(view() === 'v-reflect' && $$('#r-basic li').length === PRIVACY_STORY.reflection.basic.length && $$('#r-basic li').length === 6 && $$('#r-deep li').length === 6, '성찰 질문 6+6');
    $('#btn-reflect-back').click(); await wait();
    ok(view() === 'v-path', '성찰 → 경로로 돌아가기');
    $('#btn-path-back').click(); await wait();
    ok(view() === 'v-ending', '경로 → 엔딩으로 돌아가기');
  }

  // ── 사건 8 확장 「렌즈 안에 갇힌 밤」 CG 프로브 ──
  // R.A 경로에서 사건 8만 바꿔 현장 → 싸움 → 지원 요청으로 간다(사건 8 첫 선택 = 13번째, 0부터 12)
  function nfRoute(R, list) { return R.A.reduce(function (a, x) { return a.concat(x === 'c3_e8_a#tell' ? list : [x]); }, []); }
  var NF_FIGHT = ['c3_e8_a#meet', 'c3_e8_b#go', 'c3_e8_c#fight', 'c3_e8_f#support'];
  function cgNow() {
    var c = $('#cg');
    if (!c || c.hidden) return null;
    var im = c.querySelector('.cg-img'), rec = c.querySelector('.cg-rec');
    return { k: c.getAttribute('data-cg'), src: im && !im.hidden ? im.getAttribute('src') || '' : '', rec: !!rec && !rec.hidden, shake: c.classList.contains('shake'), dim: c.classList.contains('dim'),
      loading: !!im && im.hasAttribute('data-loading') };
  }
  // CG·화면 변화를 순서대로 적는다(같은 값 연속은 하나로)
  function nfWatch() {
    var log = [];
    function push(e) { var last = log[log.length - 1]; if (!last || JSON.stringify(last) !== JSON.stringify(e)) log.push(e); }
    function snap() { var c = cgNow(); push(c ? { cg: c.k, src: c.src, rec: c.rec, shake: c.shake, dim: c.dim, loading: c.loading } : { cg: null }); }
    new MutationObserver(snap).observe($('#cg'), { attributes: true, subtree: true });
    new MutationObserver(function () { if (!$('#cut').hidden) push({ cut: $('#cut').textContent, cgOn: !$('#cg').hidden }); }).observe($('#cut'), { attributes: true, childList: true, characterData: true, subtree: true });
    new MutationObserver(function () { push({ view: view(), scene: (PrivacyApp.state() || {}).scene }); }).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
    return log;
  }
  function seqHas(log, keys) { var i = 0; log.forEach(function (e) { if (i < keys.length && e.cg === keys[i]) i++; }); return i === keys.length; }

  async function nightfox(s, R) {
    var route = nfRoute(R, NF_FIGHT);
    var text = JSON.stringify(window.PRIVACY_STORY);
    ok(!/야차룰|승리|콤보|체력바/.test(text), '이야기에 싸움을 경기처럼 보이게 하는 말 없음');
    if (s === 'nf-flow') { // 여 주인공 · 한 번에+움직임 줄이기(기본 프로브 설정) → 줄 단위 보려고 보통 속도
      ok(!!$('#cg') && $('#cg').hidden, 'CG 레이어는 처음엔 숨김');
      var note = ($('#warning') || {}).textContent || '';
      ok(/가상/.test(note) && /1388/.test(note) && /117/.test(note) && /118/.test(note), '주의 화면 안내·도움 연락처: ' + note.slice(0, 40));
      var log = nfWatch();
      $('#btn-new').click();
      await play(route, { upto: 13 });
      PrivacyApp.setSpeed('normal');
      await play(route, { from: 13, upto: 16 });
      var st = PrivacyApp.state();
      ok(st.scene === 'c3_e9_a', '수습 뒤 사건 9로 복귀: ' + st.scene);
      ok(seqHas(log, ['arrival', 'confrontation', 'clash', 'recorded', 'classroom-reaction', 'teacher-support']), 'CG 순서 도착→대치→충돌→촬영→교실→담임: ' + log.filter(function (e) { return 'cg' in e && e.cg; }).map(function (e) { return e.cg; }).join('>'));
      var arr = log.filter(function (e) { return e.cg === 'arrival'; })[0] || {};
      ok(/girl-arrival\.(png|webp)/.test(arr.src || ''), '여 주인공 → girl- 그림: ' + arr.src);
      var cls = log.filter(function (e) { return e.cg === 'classroom-reaction'; })[0] || {};
      ok(/\/classroom-reaction\.(png|webp)/.test(cls.src || ''), '교실 반응은 공용 그림: ' + cls.src);
      var rec = log.filter(function (e) { return e.cg === 'recorded'; });
      ok(rec.length && rec.some(function (e) { return e.rec; }), '촬영 장면에 REC 테두리');
      ok(!log.some(function (e) { return (e.cg === 'arrival' || e.cg === 'confrontation') && e.rec; }), '촬영 전엔 REC 없음');
      ok(!log.some(function (e) { return e.shake; }), '움직임 줄이기면 흔들림 없음');
      ok(log.some(function (e) { return e.cg === 'recorded' && e.dim; }), '끝 줄에서 화면이 어두워짐');
      var iDark = log.findIndex(function (e) { return e.dim; }), iCls = log.findIndex(function (e) { return e.cg === 'classroom-reaction'; });
      ok(log.slice(iDark, iCls).some(function (e) { return e.cg === null; }), '그날 밤 SNS(폰) 장면에선 CG 숨김');
      var iT = log.findIndex(function (e) { return e.cg === 'teacher-support'; });
      ok(iT > 0 && !log.slice(iT).some(function (e) { return e.view === 'v-map'; }), '싸움 경로는 사건 9 전에 다시 걷지 않음');
      ok($('#cg').hidden, '사건 9 교실에선 CG 숨김');
      ok(!document.body.classList.contains('cg-on'), 'CG가 없으면 대화창 글자도 원래 크기');
      var prevK = null, stale = [];
      log.forEach(function (e) { if (!('cg' in e)) return; if (e.cg && e.cg !== prevK && !e.loading) stale.push(e.cg); prevK = e.cg; });
      ok(!stale.length, '새 그림을 받는 동안 앞 그림을 보여 주지 않음(잔상 없음): ' + stale.join(','));
      ok(log.some(function (e) { return /렌즈 안에 갇힌 밤/.test(e.cut || ''); }), '에피소드 제목이 화면(컷 카드)에 나옴');
      var cutCounsel = log.filter(function (e) { return /상담실/.test(e.cut || ''); })[0];
      ok(!!cutCounsel && !cutCounsel.cgOn, '컷 카드 뒤로 앞 장면 CG가 비치지 않음');
      ok(st.flags.e8_confrontation === 'fight' && st.flags.e8_video_spread === true && st.flags.e8_response === 'support', '플래그 기록');
      PrivacyApp.setSpeed('instant');
      await play(route, { from: 16 });
      ok(view() === 'v-ending', '엔딩까지 완주');
      ok(PrivacyApp.state().ending === 'D', '정문에서 싸운 경로는 수습해도 D(B 아님): ' + PrivacyApp.state().ending);
      ok(/도움을 청했다/.test(document.body.textContent) && !/도움을 요청하는 건 지는 게 아니다/.test(document.body.textContent), 'D 본문은 도움을 청한 경우 문장');
      ok(/촬영은 계속됐다/.test(document.body.textContent), '사건 결과에 촬영 계속 기록');
    }
    else if (s === 'nf-resume') { // 남 주인공 · 보통 속도 · 움직임 허용
      var PK = 'ethicity.privacy.progress.v2';
      if (P.phase === 0) {
        $('#btn-new').click();
        PrivacyApp.setSpeed('instant');
        await play(route, { upto: 14 });
        PrivacyApp.setSpeed('normal');
        $$('#g-dock .choice').filter(function (b) { return b.getAttribute('data-choice') === 'fight'; })[0].click();
        await wait(50);
        ok(PrivacyApp.state().reaction === 'fight', '싸움 선택 직후(반응 중)');
        sessionStorage.setItem('probe-phase', '1'); carry(); location.reload(); return;
      }
      if (P.phase === 1) {
        $('#btn-continue').click(); await wait(300);
        var c1 = cgNow();
        ok(!!c1 && c1.k === 'confrontation' && /boy-confrontation/.test(c1.src), '반응 중 복원 → 대치 CG(남): ' + JSON.stringify(c1));
        var tf = parseFloat(getComputedStyle($('#talk .talk-text')).fontSize), bf = parseFloat(getComputedStyle(document.body).fontSize);
        ok(document.body.classList.contains('cg-on') && tf >= bf * 1.15, 'CG 장면 대화창 글자가 더 큼: ' + tf + 'px / 본문 ' + bf + 'px');
        ok(/NanumSquare/.test(getComputedStyle(document.body).fontFamily), '본문 글꼴 나눔스퀘어');
        var shook = false; // 흔들림은 0.36초 뒤 클래스가 빠지므로, 한 번이라도 붙었는지 기록
        new MutationObserver(function () { if ($('#cg').classList.contains('shake')) shook = true; }).observe($('#cg'), { attributes: true, attributeFilter: ['class'] });
        await passTalk(); await wait(); $('#btn-next').click(); await wait(300);
        var g = 0; while (PrivacyApp.staging() && g++ < 100) await wait(50);
        var c2 = cgNow();
        ok(PrivacyApp.state().scene === 'c3_e8_d' && !!c2 && c2.k === 'clash' && /boy-clash/.test(c2.src), '충돌 장면 첫 CG: ' + JSON.stringify(c2));
        ok(shook, '움직임 허용이면 충돌 순간 흔들림');
        sessionStorage.setItem('probe-phase', '2'); carry(); location.reload(); return;
      }
      $('#btn-continue').click(); await wait(300);
      var c3 = cgNow();
      ok(PrivacyApp.state().scene === 'c3_e8_d' && !!c3 && c3.k === 'clash', '새로고침 → 장면 첫 CG부터 다시: ' + JSON.stringify(c3));
      sessionStorage.removeItem('probe-phase'); sessionStorage.removeItem('probe-carry');
    }
    else if (s === 'nf-undo') {
      $('#btn-new').click();
      await play(route, { upto: 14 });
      var before = PrivacyApp.state();
      $$('#g-dock .choice').filter(function (b) { return b.getAttribute('data-choice') === 'fight'; })[0].click();
      await wait(50); await passTalk();
      ok(PrivacyApp.state().trust.haneul === before.trust.haneul - 1, '싸움·영상 확산 → 하늘 −1');
      $('#btn-undo').click(); await wait(); confirmYes(); await wait(100);
      var af = PrivacyApp.state();
      ok(af.scene === 'c3_e8_c' && !af.reaction && JSON.stringify(af.trust) === JSON.stringify(before.trust) && af.flags.e8_confrontation === undefined && JSON.stringify(af.stats) === JSON.stringify(before.stats), '되돌리면 신뢰·수치·플래그 원복');
      await passTalk();
      ok($$('#g-dock .choice').length === 3, '현장 선택지 3개 다시');
      var cu = cgNow();
      ok(!!cu && cu.k === 'confrontation', '되돌린 뒤 현장 CG: ' + JSON.stringify(cu));
    }
    else if (s === 'nf-noimg') { // 그림을 못 불러오는 환경 — 대사만으로 끝까지
      $('#btn-new').click();
      await play(route, { upto: 15 });
      ok(PrivacyApp.state().scene === 'c3_e8_f' && $$('#g-dock .choice').length === 3, '그림 없이도 교실 반응 선택지');
      await wait(200);
      ok($('#cg').hidden, '그림을 못 불러오면 빈 CG 레이어를 남기지 않음');
      await play(route, { from: 15 });
      ok(view() === 'v-ending', '그림 없이 엔딩까지');
    }
  }

  // 지금 걷기 구간에 선 인물의 칸(장면 그림 맵은 좌표가 장면마다 달라 직접 쓰지 않는다)
  function castOf(who) { var t = window.PRIVACY_WORLD.triggers[PrivacyApp.state().mapTarget]; return t.cast.filter(function (c) { return c.who === who; })[0]; }
  async function walkToCell(tx, ty) {
    var M = PrivacyMap.debug, rt = M.routeTo(tx, ty);
    if (!rt) return false;
    for (var k = 0; k < rt.length; k++) { key(ARROW[rt[k]]); key(ARROW[rt[k]], 'keyup'); var g = 0; await wait(16); while (M.me().moving && g++ < 100) await wait(16); }
    var m = M.me(); return m.x === tx && m.y === ty;
  }

  async function run() {
    await loadRoutes();
    var R = window.PRIVACY_ROUTES;
    await wait(10);
    var s = P.scenario;

    if (/^route-[ABCD]$/.test(s) || s === 'route-B-key') {
      var code = s.charAt(6);
      ok(view() === 'v-start', '시작 화면');
      ok($('#player-name').textContent === '반짝이는 고래', '별명 표시');
      $('#btn-new').click();
      await play(R[code], { keyboard: s === 'route-B-key' });
      await finishChecks(code, R[code].length);
    }

    else if (/^nf-/.test(s)) { await nightfox(s, R); }

    else if (s === 'walk-A') {
      $('#btn-new').click();
      var o = { walk: true, areas: [] };
      await play(R.A, o);
      ok(o.walked > 200, '방향키로 실제 걸은 칸 수 ' + o.walked);
      var seq = o.areas.join('>');
      ok(/교문>마을 길>내 방/.test(seq), '교문 → 마을 길 → 내 방 순서로 이동: ' + seq.slice(0, 120));
      ok((seq.match(/내 방/g) || []).length >= 3, '집 사건 3번 모두 걸어서 귀가 (' + (seq.match(/내 방/g) || []).length + '회)');
      await finishChecks('A', R.A.length);
    }

    else if (s === 'tap') {
      $('#btn-new').click();
      await play(R.A, { upto: 1, stopAtMap: true });
      ok(view() === 'v-map', '첫 사건 전에 맵 화면');
      ok(/집/.test($('#m-mission').textContent), '지금 할 일 표시(하교): ' + $('#m-mission').textContent);
      var cs = castOf('saebom'), pt = PrivacyMap.debug.tileToClient(cs.x, cs.y); // 새봄 자리
      $('#m-canvas').dispatchEvent(new PointerEvent('pointerdown', { clientX: pt.x, clientY: pt.y, bubbles: true }));
      var g = 0; while ($('#talk').hidden && g++ < 300) await wait(20);
      ok(!$('#talk').hidden && /새봄/.test($('#talk .talk-name').textContent), '새봄을 누르면 걸어가서 말 걸기 ' + JSON.stringify([pt, PrivacyMap.debug.me()]));
      await passTalk();
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk(); await wait();
      ok(view() === 'v-game' && PrivacyApp.state().scene === 'c1_e1_a', '침대에 가면 정산 장면 시작');
      // 맵에서 되돌리기: 다음 맵으로 간 뒤 되돌리면 이전 장면 선택 전으로
      await play(R.A, { from: 1, upto: 3, stopAtMap: true });
      ok(view() === 'v-map' && PrivacyApp.state().screen === 'map', '두 번째 사건 전 맵');
      $('#btn-undo').click(); await wait(); confirmYes(); await wait();
      ok(view() === 'v-game' && PrivacyApp.state().scene === 'c1_e1_b' && !PrivacyApp.state().reaction, '맵에서 되돌리기 → 직전 선택 전으로');
      $('#btn-map-act');
      // 사물 조사·다른 인물 대사
      await play(R.A, { from: 2, upto: 3, stopAtMap: true });
      $('#btn-map-act').click(); await wait();
      ok(view() === 'v-map' && $('#m-say').textContent.length > 0, '대상이 아닌 곳에서 누르면 안내 문구');
    }

    else if (s === 'frame') {
      $('#btn-new').click();
      await play(R.A, { upto: 1, stopAtMap: true });
      ok(!!$('#stage') && $('#stage').contains($('#m-canvas')), '캔버스가 #stage 안에 있음');
      ok(view() === 'v-map' && !$('#stage').hidden && getComputedStyle($('#stage')).display !== 'none', '맵 화면에서 무대 보임');
      var cr = $('#m-canvas').getBoundingClientRect(), sr = { width: $('#stage').clientWidth, height: $('#stage').clientHeight };
      ok(Math.abs(cr.width - sr.width) < 2 && Math.abs(cr.height - sr.height) < 2, '캔버스가 무대를 채움 ' + [cr.width, cr.height, sr.width, sr.height].map(Math.round));
      // 새봄이 아닌 하늘을 누르면 걸어가서 말을 건다 → 대화창
      var ch = castOf('haneul'), pd = PrivacyMap.debug.tileToClient(ch.x, ch.y);
      $('#m-canvas').dispatchEvent(new PointerEvent('pointerdown', { clientX: pd.x, clientY: pd.y, bubbles: true }));
      var gt = 0; while ((!$('#talk') || $('#talk').hidden) && gt++ < 300) await wait(20);
      ok(!!$('#talk') && !$('#talk').hidden && /\S/.test($('#talk .talk-text').textContent), '말 걸기 결과가 대화창에 나옴');
      ok(!!$('#talk .talk-name') && /하늘/.test($('#talk .talk-name').textContent), '대화창 이름 탭');
      ok($('#talk').getBoundingClientRect().height >= 118, '한 줄이어도 넉넉한 대화창 높이 ' + Math.round($('#talk').getBoundingClientRect().height));
      key(' '); await wait(30);
      ok($('#talk').hidden && view() === 'v-map', 'Space로 대화창 닫힘, 맵 그대로');
    }

    else if (s === 'opening') {
      $('#btn-new').click(); await wait(30);
      var st0 = PrivacyApp.state();
      ok(view() === 'v-map' && st0.screen === 'map' && st0.mapTarget === 'pro_1', '시작하면 바로 맵(등교)');
      ok(/내 방/.test($('#m-area').textContent), '내 방에서 시작: ' + $('#m-area').textContent);
      ok(/방향키/.test($('#m-say').textContent), '첫 걸음 안내: ' + $('#m-say').textContent);
      ok(/교실/.test($('#m-mission').textContent), '지금 할 일: ' + $('#m-mission').textContent);
      var ow = { walk: true, areas: [] }, tOut = null, tGone = null;
      new MutationObserver(function () {
        var tx = $('#m-say').textContent, now = performance.now();
        if (tOut == null && /밖으로 나왔다/.test(tx)) tOut = now;
        else if (tOut != null && tGone == null && !/밖으로 나왔다/.test(tx)) tGone = now;
      }).observe($('#m-say'), { childList: true, characterData: true, subtree: true });
      var seenBubble = {}, bt = setInterval(function () { (PrivacyMap.debug.stage().bubbles || []).forEach(function (w) { seenBubble[w] = true; }); }, 30);
      await walkToTarget(ow);
      clearInterval(bt); ow.passGreet = !!seenBubble.haneul;
      ok(tOut != null && tGone != null && tGone - tOut <= 2600, '“밖으로 나왔다”는 잠깐 뜨고 사라짐: ' + (tGone != null && tOut != null ? Math.round(tGone - tOut) + 'ms' : '안 사라짐'));
      var oseq = ow.areas.join('>');
      ok(/내 방.*마을 길.*교문.*현관 앞.*2학년 3반 교실/.test(oseq), '내 방→마을 길→교문→현관 앞→교실: ' + oseq);
      ok(ow.passGreet === true, '하늘이 곁을 지나가면 인사 말풍선이 저절로');
      ok($('#m-say').textContent.indexOf('방향키') < 0, '걷기 시작하면 첫 안내가 사라짐');
      ok(ow.talkLines >= 4, '새봄의 친구 소개 ' + ow.talkLines + '줄');
      ok(view() === 'v-game' && PrivacyApp.state().scene === 'pro_1', '소개 뒤 pro_1 장면');
    }

    else if (s === 'resume-old') {
      var E2 = window.PrivacyEngine, ST = window.PRIVACY_STORY, PK = 'ethicity.privacy.progress.v2';
      if (P.phase === 0) { // 개편 전 저장 1: 프롤로그 장면에서 바로 시작하던 형태
        var old = E2.createState(ST); old.screen = 'scene'; old.mapTarget = null; old.visited = ['pro_1'];
        localStorage.setItem(PK, JSON.stringify({ v: 1, run: old, explored: {}, endingsSeen: [] }));
        sessionStorage.setItem('probe-phase', '1'); carry(); location.reload(); return;
      }
      if (P.phase === 1) {
        ok(!$('#btn-continue').hidden, '개편 전 저장(프롤로그 장면) → 이어 하기');
        $('#btn-continue').click(); await wait();
        ok(view() === 'v-game' && PrivacyApp.state().scene === 'pro_1' && $$('#g-dock .choice').length > 0, 'pro_1 장면에서 그대로 이어짐');
        // 개편 전 저장 2: 1장 첫 맵, 교실 안 위치(6,4)
        var m = E2.createState(ST), gg = 0;
        while (!(m.screen === 'map' && m.mapTarget === 'c1_e1_a') && gg++ < 8) m = m.screen === 'scene' && E2.needsChoice(ST, m) ? E2.choose(ST, m, 'photo') : E2.advance(ST, m);
        m.history = [];
        localStorage.setItem(PK, JSON.stringify({ v: 1, run: m, explored: {}, endingsSeen: [], pos: { x: 6, y: 4, dir: 'left', for: 'c1_e1_a' } }));
        sessionStorage.setItem('probe-phase', '2'); carry(); location.reload(); return;
      }
      $('#btn-continue').click(); await wait();
      var mm = PrivacyMap.debug.me();
      var sp = window.PRIVACY_WORLD.SPAWNS.classroom;
      ok(view() === 'v-map' && PrivacyApp.state().mapTarget === 'c1_e1_a' && mm.x === sp.x && mm.y === sp.y, '개편 전 맵 저장 위치는 버리고 걷기 시작점에서(진행은 그대로) ' + JSON.stringify(mm));
      sessionStorage.removeItem('probe-phase'); sessionStorage.removeItem('probe-carry');
    }

    else if (s === 'stage-mode') {
      $('#btn-new').click(); await wait(30);
      var SG = window.PRIVACY_WORLD.STAGES;
      var before = PrivacyMap.debug.me();
      await PrivacyMap.stage(SG.c1_e2_b, { card: '그날 밤 · 내 방' });
      var d = PrivacyMap.debug.stage();
      ok(d.mode === 'stage' && d.place === 'room' && d.tint === 'night', '무대 모드: 내 방·밤 ' + JSON.stringify(d));
      ok($('#cut').hidden, '컷 카드는 끝나면 사라짐');
      var m1 = PrivacyMap.debug.me();
      key('ArrowLeft'); key('ArrowLeft', 'keyup'); await wait(300);
      var m2 = PrivacyMap.debug.me();
      ok(m1.x === m2.x && m1.y === m2.y, '무대 모드에선 방향키로 걷지 않음');
      await PrivacyMap.stage(SG.pro_1);
      ok(PrivacyMap.bubble('haneul', '📱…') && PrivacyMap.bubble('jiho', '…'), '무대 인물 말풍선');
      ok(!PrivacyMap.bubble('teacher', 'x'), '무대에 없는 인물은 말풍선 없음');
      var b = PrivacyMap.debug.stage().bubbles;
      ok(b.indexOf('haneul') >= 0 && b.indexOf('jiho') >= 0, '두 명 말풍선 동시: ' + b);
      PrivacyMap.clearBubbles();
      ok(PrivacyMap.debug.stage().bubbles.length === 0, '말풍선 지우기');
    }

    else if (s === 'stage-phone') {
      $('#btn-new').click();
      await play(R.A, { upto: 0 });
      var d = PrivacyMap.debug.stage();
      ok(view() === 'v-game' && d.mode === 'stage' && d.place === 'classroom', '단톡 장면이 교실 무대 위에서 ' + JSON.stringify(d));
      ok(['saebom', 'haneul', 'jiho', 'minjun'].every(function (w) { return d.cast.indexOf(w) >= 0; }), '같은 공간 친구 4명: ' + d.cast);
      ok($('#g-phone').getAttribute('data-device') === 'phone' && !$('#g-phone').hidden, '폰 오버레이');
      ok($('#g-phone').getBoundingClientRect().width <= $('#stage').clientWidth * 0.45, '데스크톱에서 폰은 무대 폭의 45% 이하 ' + Math.round($('#g-phone').getBoundingClientRect().width) + '/' + $('#stage').clientWidth);
      ok(d.bubbles.indexOf('haneul') >= 0 && d.bubbles.indexOf('minjun') >= 0, '메시지 보낸 친구 머리 위 말풍선: ' + d.bubbles);
      ok(d.bubbleTexts.indexOf('…') >= 0 && d.bubbleTexts.indexOf('👀') >= 0, '손으로 쓴 반응(지호 …, 새봄 👀): ' + d.bubbleTexts);
      ok(d.bubbleTexts.every(function (t) { return t.indexOf('올린다') < 0; }), '폰 메시지 원문은 머리 위에 안 뜸');
      var mp = PrivacyMap.debug.me(), mpt = PrivacyMap.debug.tileToClient(mp.x, mp.y), phr = $('#g-phone').getBoundingClientRect(), dkr = $('#g-dock').getBoundingClientRect();
      ok(phr.right < dkr.left, '시선 순서: 폰(카톡)은 왼쪽, 선택 상자는 오른쪽 ' + [Math.round(phr.right), Math.round(dkr.left)]);
      ok(mpt.x > phr.right && mpt.y < dkr.top, '주인공이 폰·선택 상자에 가리지 않음 ' + JSON.stringify([Math.round(mpt.x), Math.round(mpt.y), Math.round(phr.left), Math.round(dkr.top)]));
      var m1 = PrivacyMap.debug.me(); key('ArrowLeft'); key('ArrowLeft', 'keyup'); await wait(300); var m2 = PrivacyMap.debug.me();
      ok(m1.x === m2.x && m1.y === m2.y && view() === 'v-game', '장면 중 방향키로 걷지 않음');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true })); await wait();
      ok(PrivacyApp.state().reaction === 'photo', '숫자 키로 선택');
    }

    else if (s === 'stage-flow') {
      $('#btn-new').click();
      await play(R.A, { upto: 1, stopAtMap: true });
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk(); await wait(50);
      var f1 = PrivacyMap.debug.stage();
      ok(view() === 'v-game' && f1.place === 'room' && f1.tint === 'evening', '하교해 침대 → 내 방 저녁 무대 ' + JSON.stringify(f1));
      await play(R.A, { from: 1, upto: 3 });
      ok(PrivacyApp.state().scene === 'c1_e2_a' && $('#g-phone').hidden && $$('#g-dock .choice').length > 0, '장소 장면: 폰 없이 대화창 → 선택지');
      ok(PrivacyMap.debug.stage().place === 'classroom', '장소 장면 무대: 교실');
      await play(R.A, { from: 3, upto: 4 });
      ok(PrivacyApp.state().scene === 'c1_e2_b' && PrivacyMap.debug.stage().place === 'room' && PrivacyMap.debug.stage().tint === 'night', '그날 밤 내 방');
      $('#btn-undo').click(); await wait(); confirmYes(); await wait(50); await passTalk(); await wait(50);
      ok(PrivacyApp.state().scene === 'c1_e2_a' && PrivacyMap.debug.stage().place === 'classroom', '되돌리면 무대도 교실로');
      await play(R.A, { from: 3, upto: 8 });
      ok(PrivacyApp.state().scene === 'c2_e5_a' && $('#g-phone').getAttribute('data-device') === 'monitor', 'AI 도우미는 모니터');
      ok(PrivacyMap.debug.stage().place === 'room', '모니터 장면 무대: 내 방');
    }

    else if (s === 'stage-resize') {
      $('#btn-new').click();
      await play(R.A, { upto: 0 });
      $('#stage').style.width = '400px';
      window.dispatchEvent(new Event('resize')); await wait(300);
      var cw = $('#m-canvas').getBoundingClientRect().width;
      ok(Math.abs(cw - $('#stage').clientWidth) < 2, '좁아지면 캔버스도 무대 폭으로 ' + Math.round(cw) + '/' + $('#stage').clientWidth);
      var pr = $('#g-phone').getBoundingClientRect(), sr = $('#stage').getBoundingClientRect();
      ok(pr.width > sr.width * 0.8 && pr.height < sr.height * 0.75, '좁은 무대: 폰은 아래 시트 ' + [pr.width, pr.height, sr.width, sr.height].map(Math.round));
      ok(pr.top > sr.top + 60, '폰 위로 맵이 보임');
      var rme = PrivacyMap.debug.me(), rpt = PrivacyMap.debug.tileToClient(rme.x, rme.y);
      ok(rpt.y < pr.top && rpt.x > sr.left && rpt.x < sr.right, '좁아진 뒤에도 주인공이 폰 위에 보임 ' + JSON.stringify([Math.round(rpt.x), Math.round(rpt.y), Math.round(pr.top)]));
    }

    else if (s === 'yard') { // 장면 그림 맵: 장면 5개(교실·도서관·마당·마을 길·내 방)를 출입구로 오간다
      var WY = window.PRIVACY_WORLD;
      ok(WY.SCENES.length === 5 && WY.W === 160 && WY.H === 18, '장면 5개·격자 160×18: ' + WY.W + '×' + WY.H);
      $('#btn-new').click();
      await play(R.A, { upto: 1, stopAtMap: true }); // 하교 걷기(교실에서 출발)
      var S = {}; WY.SCENES.forEach(function (c) { S[c.id] = c; });
      ok(await walkToCell(S.library.ox + 15, 13), '교실 → 마당 → 도서관 문으로 걸어 들어감');
      ok(PrivacyMap.debug.me().area === '도서관', '도서관 안: ' + PrivacyMap.debug.me().area);
      ok(await walkToCell(S.yard.ox + 22, 10), '도서관 → 마당');
      ok(PrivacyMap.debug.me().area !== '도서관' && WY.sceneAt(PrivacyMap.debug.me().x).id === 'yard', '마당: ' + PrivacyMap.debug.me().area);
      // 천막·매점은 지나갈 수 없음(그림 위 막힌 칸)
      var tn = WY.object('tent1'), sto = WY.object('store');
      ok(!WY.walkable(tn.x + 1, tn.y + 1) && !WY.walkable(sto.x + 1, sto.y + 1), '천막·매점 칸은 막힘');
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk(); await wait(50);
      ok(view() === 'v-game' && PrivacyApp.state().scene === 'c1_e1_a', '돌아다닌 뒤 본편 진행');
    }

    else if (s === 'warning') { // 시작하자마자 어두운 화면의 주의 안내(가상 상황 고지·다루는 장면·도움 연락처)
      if (P.phase === 0) {
        ok(!$('#content-note'), '시작 화면 아래 작은 안내는 주의 화면으로 옮김');
        $('#btn-new').click(); await wait(50);
        var w = $('#warning');
        ok(!!w && !w.hidden, '시작하기 → 주의 화면');
        ok(!!w && getComputedStyle(w).position === 'fixed' && /rgb\(\s*[0-2]?\d,\s*[0-2]?\d,\s*[0-2]?\d/.test(getComputedStyle(w).backgroundColor), '화면 전체를 덮는 어두운 배경: ' + (w && getComputedStyle(w).backgroundColor));
        var wt = w ? w.textContent : '';
        ok(/WARNING/.test(wt) && /가상/.test(wt) && /실제와 관계없/.test(wt), '가상 상황 고지: ' + wt.slice(0, 60));
        ok(/1388/.test(wt) && /117/.test(wt) && /118/.test(wt), '도움 연락처');
        ok(document.activeElement === $('#btn-warning-ok'), '확인 버튼에 포커스(키보드 Enter로 진행)');
        await wait(3000);
        ok(!w.hidden && view() === 'v-start', '읽기 전엔 저절로 넘어가지 않음');
        $('#btn-warning-ok').click(); await wait(50);
        ok(w.hidden && view() === 'v-map', '확인하면 게임 시작(등교 맵)');
        sessionStorage.setItem('probe-phase', '1'); carry(); location.reload(); return;
      }
      ok(!$('#btn-continue').hidden, '진행 저장됨');
      $('#btn-continue').click(); await wait(50);
      ok($('#warning').hidden && view() !== 'v-start', '이어 하기는 주의 화면 없이 바로');
      sessionStorage.removeItem('probe-phase'); sessionStorage.removeItem('probe-carry');
    }

    else if (s === 'chat-face') { // 단톡·개인 대화 프로필에 친구 얼굴 그림(이니셜 대신)
      $('#btn-new').click();
      await play(R.A, { upto: 0 });
      var avs = $$('#g-log .ln.msg:not(.me) .av');
      ok(avs.length > 0, '대화 프로필 있음');
      var named = avs.filter(function (a) { return /saebom|haneul|jiho|minjun|teacher/.test(a.getAttribute('data-who') || ''); });
      ok(named.length > 0 && named.every(function (a) { var w = a.getAttribute('data-who'); return a.classList.contains('has-face') && new RegExp(w + '-portraits\\.png').test(a.style.backgroundImage); }), '친구 프로필 = 공통 팩 초상화(기본 표정): ' + named.map(function (a) { return a.getAttribute('data-who'); }).join(','));
      ok(named.every(function (a) { return a.textContent === '' && !a.querySelector('img'); }), '얼굴이 있으면 이니셜 글자 없음');
      var others = avs.filter(function (a) { return !a.classList.contains('has-face'); });
      ok(others.every(function (a) { return a.textContent.length > 0; }), '그림이 없는 인물은 이니셜');
    }

    else if (s === 'photo') { // 민준이 엎드려 자는 사진: 흐리게 올라오고, 눌러야 보인다
      $('#btn-new').click();
      await play(R.A, { upto: 4 });
      ok(PrivacyApp.state().scene === 'c1_e2_b', '사진을 받은 하늘 개인 대화');
      var ph = $('#g-log .photo');
      ok(!!ph && ph.classList.contains('blurred'), '사진은 흐리게 가려진 채 올라옴');
      var pim = ph && ph.querySelector('img');
      await wait(300);
      ok(!!pim && /assets\/photos\/minjun-sleep\.(png|webp)/.test(pim.getAttribute('src') || '') && !!pim.alt && pim.complete && pim.naturalWidth === 1200 && pim.naturalHeight === 900, '현재 민준 디자인의 실제 사진 로드·1200×900·대체 텍스트: ' + (pim && pim.getAttribute('src')));
      ok(!ph.classList.contains('pixel'), '사진에 맵 스프라이트 확대 스타일 미적용');
      ok(!/보여 주지 않아요/.test($('#g-log').textContent), '“보여 주지 않아요” 문구 없음');
      var rv = ph && ph.querySelector('.photo-reveal');
      ok(!!rv && /눌러서 보기/.test(rv.textContent), '눌러서 보기 버튼');
      if (rv) rv.click();
      await wait();
      ok(!ph.classList.contains('blurred') && !ph.querySelector('.photo-reveal'), '누르면 선명해지고 버튼은 사라짐');
      ok($$('#g-dock .choice').length > 0, '선택지는 그대로');
    }

    else if (s === 'name-input') { // 공통 플레이어 정보가 없을 때 이 게임에서만 이름 입력
      var SK = 'ethicity.privacy.settings.v1';
      function typeName(v) { var f = $('#name-input'); f.value = v; f.dispatchEvent(new Event('input', { bubbles: true })); }
      if (P.phase === 0) {
        ok(!!$('#name-field') && !$('#name-field').hidden, '공통 정보가 없으면 이름 입력칸 보임');
        ok($('#player-name').textContent === '플레이어', '비워 두면 기본 이름');
        typeName('<b>x</b>');
        ok(!$('#player-name b') && $('#player-name').textContent === '<b>x</b>', '이름은 글자로만 표시');
        typeName('  가나다라마바사아자차카  ');
        ok($('#player-name').textContent === '가나다라마바사아자차', '앞뒤 공백 제거·10자까지: ' + $('#player-name').textContent);
        typeName('지우');
        ok($('#player-name').textContent === '지우', '입력한 이름 표시');
        ok(ls('ethicity.player') === null, '공통 플레이어 키는 만들지 않음');
        ok(JSON.parse(ls(SK) || '{}').nickname === '지우', '이 게임 설정에만 저장');
        typeName('   ');
        ok($('#player-name').textContent === '플레이어', '공백만 지우면 기본 이름으로');
        typeName('지우');
        sessionStorage.setItem('probe-phase', '1'); carry(); location.reload(); return;
      }
      ok($('#name-input').value === '지우' && $('#player-name').textContent === '지우', '새로고침해도 이름 유지');
      $('#btn-new').click();
      await play(R.A, { upto: 0 });
      ok(/지우 넌 뭐 할래/.test($('#g-log').textContent), '대사 {name}에 입력한 이름');
      ok(ls('ethicity.player') === null, '플레이 뒤에도 공통 키 그대로(없음)');
      sessionStorage.removeItem('probe-phase'); sessionStorage.removeItem('probe-carry');
    }

    else if (s === 'title') {
      ok(view() === 'v-start', '시작 화면');
      ok(!!$('#name-field') && $('#name-field').hidden, '공통 플레이어 정보가 있으면 이름 입력칸 숨김');
      ok(!$('.start-phone'), '메신저 푸시 알림 장식 없음');
      ok(/단톡방 28명, 스토리 조회 312회, 캡처 1장/.test($('#v-start').textContent), '훅 문장 유지');
      var imgs = $$('#look-pick .hero-card .hero-face');
      ok(imgs.length === 2 && /onyu-portraits\.png/.test(imgs[0].style.backgroundImage) && /daon-portraits\.png/.test(imgs[1].style.backgroundImage), '두 주인공 = 공통 팩 온유·다온 초상화');
      await wait(100);
      var r0 = imgs[0].getBoundingClientRect(), r1 = imgs[1].getBoundingClientRect();
      ok(Math.abs(r0.width - r1.width) < 1 && Math.abs(r0.height - r1.height) < 1 && r0.height >= 150, '두 주인공 같은 비중 ' + [r0.width, r0.height, r1.width, r1.height].map(Math.round));
      ok(Math.abs(r0.top - r1.top) < 1, '나란히 배치');
      ok($$('input[name=look]').length === 2 && $$('.hero-card input[name=look]').length === 2, '카드 자체가 고르기(라디오)');
      // 첫 화면 안에 시작 버튼: 휴대폰·노트북 크기 iframe
      var sizes = [[375, 667], [1280, 720]];
      for (var si = 0; si < sizes.length; si++) {
        var fr = document.createElement('iframe');
        fr.style.cssText = 'position:absolute;left:0;top:0;border:0;width:' + sizes[si][0] + 'px;height:' + sizes[si][1] + 'px';
        fr.src = 'index.html';
        document.body.appendChild(fr);
        await new Promise(function (r) { fr.onload = r; });
        var fd = fr.contentDocument, fg = 0;
        var fimgs = Array.prototype.slice.call(fd.querySelectorAll('#look-pick .hero-card .hero-face'));
        await wait(50);
        var bb = fd.getElementById('btn-new').getBoundingClientRect();
        var h0 = fimgs[0].getBoundingClientRect(), h1 = fimgs[1].getBoundingClientRect();
        ok(bb.bottom <= sizes[si][1] && bb.top > 0, sizes[si].join('×') + ': 시작 버튼이 첫 화면 안 (아래끝 ' + Math.round(bb.bottom) + ')');
        ok(Math.abs(h0.height - h1.height) < 1 && Math.abs(h0.top - h1.top) < 1 && h0.right <= sizes[si][0] && h1.right <= sizes[si][0] + 1, sizes[si].join('×') + ': 두 주인공 나란히·같은 크기·가로 넘침 없음');
        ok(fd.documentElement.scrollWidth <= sizes[si][0] + 1, sizes[si].join('×') + ': 가로 스크롤 없음');
        fr.remove();
      }
      // 고르고 시작
      $$('input[name=look]')[0].click(); await wait();
      ok($$('.hero-card')[0].matches('.hero-card:has(input:checked)'), '고른 카드 표시');
      $('#btn-new').click(); await wait(30);
      ok(view() === 'v-map', '시작하면 등교 맵');
    }

    else if (s === 'chapter-face') {
      $('#btn-new').click();
      var ci = await play(R.A, { stopAtChapter: 6 });
      ok(ci === 6 && view() === 'v-chapter' && !$('#stage').hidden, '1장 끝: 장 카드가 맵 무대 위에');
      var lis = $$('#c-summary .trust-list li');
      ok(lis.length >= 4 && lis.every(function (li) { return li.lastElementChild && li.lastElementChild.matches('.spr.face'); }), '관계 줄마다 오른쪽 끝에 얼굴 (' + lis.length + '줄)');
      ok(lis.every(function (li) { return !!li.querySelector('.trust-mark'); }), '믿음 생김·그대로·줄어듦 표식');
      var mj = $('#c-summary .trust-list li[data-who="minjun"] .spr.face');
      var gl = 0; while (mj && !mj.classList.contains('loaded') && gl++ < 100) await wait(30);
      ok(!!mj && mj.getAttribute('data-who') === 'minjun' && /characters-official\/minjun-portraits\.png/.test(mj.style.backgroundImage), '민준 줄엔 공통 규격 민준 초상화');
      ok(!!mj && mj.getBoundingClientRect().width >= 60 && mj.getBoundingClientRect().right <= $('#c-summary .trust-list').getBoundingClientRect().right + 1, '얼굴 2배 크기, 줄 안에 들어감');
      $('#btn-chapter-go').click();
      await play(R.A, { from: 6 });
      ok($$('#e-stats .trust-list li .spr.face').length >= 4, '엔딩 관계 줄에도 얼굴');
    }

    else if (s === 'no-sprites') {
      $('#btn-new').click();
      await play(R.C);
      ok(view() === 'v-ending', '그림을 못 불러와도 엔딩까지 진행');
      var fb = $$('#e-stats .trust-list .spr.face');
      ok(fb.length >= 4 && fb.every(function (n) { return n.classList.contains('fallback') && n.textContent.length > 0; }), '얼굴 대신 이니셜 ' + fb.map(function (n) { return n.textContent; }));
    }

    else if (s === 'quest-icon') {
      $('#btn-new').click(); await wait(30);
      ok($('#v-map').textContent.indexOf('❗') < 0 && $$('#v-map .map-help .ico-quest').length === 1 && $$('#v-map .map-help .ico-talk').length === 1, '맵 안내 문장: 목적지 핀·물음표 말풍선 그림');
      key('ArrowRight'); key('ArrowRight', 'keyup'); await wait(300); // 침대 옆에서 한 칸 비켜 아무것도 없는 곳으로
      $('#btn-map-act').click(); await wait(30);
      ok(!!$('#m-say .ico-quest') && $('#m-say').textContent.indexOf('❗') < 0, '대상 아닌 곳에서 누를 때 안내에도 그림');
      $('#btn-map-skip').click(); await wait(30);
      ok(!!$('#btn-map-act .ico-talk') && $('#btn-map-act').textContent.indexOf('❗') < 0 && /새봄에게 말 걸기/.test($('#btn-map-act').textContent), '목적지 버튼(인물): ? 그림 + 새봄에게 말 걸기');
      ok($$('.ico-quest').every(function (im) { return /markers\/dest\.png/.test(getComputedStyle(im).backgroundImage) && im.getAttribute('role') === 'img' && !!im.getAttribute('aria-label'); }) && $$('.ico-talk').every(function (im) { return /markers\/talk\.png/.test(getComputedStyle(im).backgroundImage) && im.getAttribute('role') === 'img' && !!im.getAttribute('aria-label'); }), '표시 그림(dest·talk.png) 사용·대체 글자 있음');
    }

    else if (s === 'webp' || s === 'webp-fallback') {
      var WL = window.PRIVACY_WEBP || {};
      ok(Object.keys(WL).length >= 30, 'webp 목록 ' + Object.keys(WL).length + '장');
      $('#btn-new').click();
      await play(R.A, { upto: 1, stopAtMap: true });
      var SCx = window.PRIVACY_WORLD.SCENES;
      for (var si = 0; si < SCx.length; si++) { PrivacyMap.debug.place(SCx[si].ox + 15, 15, 'up'); await wait(250); }
      var gw = 0; while (performance.getEntriesByType('resource').filter(function (e) { return /assets\/scenes\//.test(e.name); }).length < 3 && gw++ < 100) await wait(50);
      ok(true, '장면 그림 5장을 차례로 띄움');
      var names = performance.getEntriesByType('resource').map(function (e) { return decodeURI(new URL(e.name).pathname).replace(/^\/privacy\//, ''); });
      var pngHits = names.filter(function (n) { return /\.png$/.test(n) && WL[n]; });
      var webpHits = names.filter(function (n) { return /\.webp$/.test(n); });
      if (s === 'webp') {
        ok(pngHits.length === 0, '변환된 그림은 png를 받지 않음 ' + pngHits.slice(0, 4).join(','));
        ok(webpHits.filter(function (n) { return /^assets\/scenes\//.test(n); }).length >= 3, '장면 그림은 webp로 받음 ' + webpHits.length + '장');
      } else ok(pngHits.filter(function (n) { return /^assets\/scenes\//.test(n); }).length >= 3, 'webp가 안 되면 png로 되돌아감 ' + pngHits.length + '장');
    }

    else if (s === 'portrait') {
      function pv() { var p = $('#talk-portrait'); return p && !p.hidden && getComputedStyle(p).display !== 'none' ? p.style.backgroundImage : null; }
      $('#btn-new').click(); await wait(30);
      PrivacyApp.setSpeed('normal'); // 한 줄씩(한꺼번에 모드는 초상화 없이)
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(50);
      ok(/saebom-portraits\.png/.test(pv() || ''), '오프닝 소개: 새봄 초상화 ' + pv());
      var pr = $('#talk-portrait').getBoundingClientRect(), tr = $('#talk').getBoundingClientRect(), mc = $('#v-map .map-controls').getBoundingClientRect();
      ok(pr.bottom <= tr.top + 16 && pr.bottom <= mc.top, '초상화는 대화창 위에 서고 아래 버튼을 가리지 않음');
      var sawMinjun = false, gg = 0;
      while (!$('#talk').hidden && gg++ < 60) { if (/minjun-portraits\.png/.test(pv() || '')) sawMinjun = true; $('#btn-talk-next').click(); await wait(30); }
      ok(sawMinjun, '민준이 말하는 줄에선 민준 초상화');
      ok(pv() === null, '대사가 끝나면 초상화도 사라짐');
      PrivacyApp.setSpeed('instant');
      await play(R.A, { upto: 0 });
      ok(view() === 'v-game' && pv() === null, '폰(단톡) 장면에선 초상화 없음');
      await play(R.A, { upto: 1, stopAtMap: true });
      PrivacyApp.setSpeed('normal');
      var ch2 = castOf('haneul'), pd = PrivacyMap.debug.tileToClient(ch2.x, ch2.y); // 하늘
      $('#m-canvas').dispatchEvent(new PointerEvent('pointerdown', { clientX: pd.x, clientY: pd.y, bubbles: true }));
      var gt = 0; while ($('#talk').hidden && gt++ < 300) await wait(20);
      ok(/haneul-portraits\.png/.test(pv() || ''), '맵에서 하늘에게 말 걸기: 하늘 초상화');
      key(' '); await wait(30);
      // 사물 조사(해설)엔 초상화 없음: 교탁 바로 아래로 가서 위를 보고 조사
      var td = window.PRIVACY_WORLD.object('tdesk');
      await walkToCell(td.x + 1, td.y + td.h);
      key('ArrowUp'); key('ArrowUp', 'keyup'); await wait(200); key(' '); await wait(30);
      ok(!$('#talk').hidden && pv() === null, '사물 조사(해설)엔 초상화 없음');
      key(' '); await wait(30);
      // 장소 장면(잠든 민준이)은 기본 표정 초상화를 띄우지 않음
      PrivacyApp.setSpeed('instant');
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk(); await wait(50);
      await play(R.A, { from: 1, upto: 3 });
      PrivacyApp.setSpeed('normal');
      $$('#g-dock .choice')[0].click(); await wait(50);
      ok(PrivacyApp.state().scene === 'c1_e2_a' && pv() === null, '장소 장면 대화창엔 초상화 없음');
    }

    else if (s === 'smooth') {
      $('#btn-new').click();
      await play(R.A, { upto: 1, stopAtMap: true });
      var SM = PrivacyMap.debug;
      // 장면이 화면보다 커지도록 좁게(휴대폰 폭) — 넓은 화면에선 장면 전체가 한눈에 보여 카메라가 움직이지 않는다
      document.querySelector('.app') && (document.querySelector('.app').style.maxWidth = '400px'); window.dispatchEvent(new Event('resize')); await wait(300);
      // 마을 길 가운데로 가서 움직임 줄이기를 끈다
      var r0 = SM.routeTo(96 + 8, 9) || [];
      for (var k = 0; k < r0.length; k++) { key(ARROW[r0[k]]); key(ARROW[r0[k]], 'keyup'); var g = 0; await wait(16); while (SM.me().moving && g++ < 100) await wait(16); }
      $('#opt-motion').checked = true; $('#opt-motion').click(); await wait(400);
      // 데드존 카메라: 화면 가운데 상자 안에서는 배경이 움직이지 않고, 벗어날 때만 지연 없이 따라간다(어지러움 줄이기)
      async function step(k) { key(k); key(k, 'keyup'); var gg = 0; await wait(16); while (SM.me().moving && gg++ < 100) await wait(16); }
      var c0 = SM.cam();
      await step('ArrowLeft'); await step('ArrowRight'); await step('ArrowUp'); await step('ArrowDown');
      var c1 = SM.cam();
      ok(c1.x === c0.x && c1.y === c0.y, '가운데 상자 안에서 한 칸씩 움직이면 배경 고정 ' + JSON.stringify([c0, c1]));
      key('ArrowRight'); SM.tick(50); // 걷는 도중에도
      var cm = SM.cam();
      ok(Math.abs(cm.x - cm.tx) < 1 && Math.abs(cm.y - cm.ty) < 1, '카메라가 늦게 미끄러지지 않음(지연 없음) ' + JSON.stringify(cm));
      ok(cm.x === Math.round(cm.x), '카메라 좌표는 정수 픽셀(흔들림 방지)');
      key('ArrowRight', 'keyup');
      var gw = 0; while (SM.me().moving && gw++ < 100) await wait(16);
      for (var kk = 0; kk < 8; kk++) await step('ArrowRight');
      var c2 = SM.cam();
      ok(c2.x > c0.x, '상자 밖으로 계속 걸으면 카메라가 따라감 ' + JSON.stringify([c0, c2]));
      await wait(300);
      var c3 = SM.cam();
      ok(c3.x === c2.x && c3.y === c2.y, '멈추면 배경도 바로 멈춤(뒤늦게 흐르지 않음)');
      // 걷기 동작: 반 칸마다 한 프레임(한 칸에 약 2번 바뀜, 칸이 바뀌어도 이어짐). 시간 대신 걸은 칸 수로 잰다
      var r1 = SM.routeTo(96 + 2, 7) || [];
      for (var k1 = 0; k1 < r1.length; k1++) { key(ARROW[r1[k1]]); key(ARROW[r1[k1]], 'keyup'); var g1 = 0; await wait(16); while (SM.me().moving && g1++ < 100) await wait(16); }
      var lastF = SM.walkFrame(), lastX = SM.me().x, fch = 0, tiles = 0;
      key('ArrowRight');
      for (var st = 0; st < 80; st++) { // 15ms씩 80번(=1.2초) 직접 진행
        SM.tick(15);
        var wf = SM.walkFrame(), mx = SM.me().x;
        if (wf !== lastF) fch++;
        lastF = wf;
        if (mx !== lastX) { tiles += Math.abs(mx - lastX); lastX = mx; }
      }
      key('ArrowRight', 'keyup');
      ok(tiles >= 6 && fch / tiles >= 1 && fch / tiles <= 2.6, '걷기 동작: 한 칸에 약 2번 바뀜(' + fch + '번/' + tiles + '칸)');
      // 움직임 줄이기를 켜면 카메라는 바로 붙는다
      $('#opt-motion').checked = false; $('#opt-motion').click(); await wait(300);
      key('ArrowRight'); SM.tick(50); var c3 = SM.cam(); key('ArrowRight', 'keyup');
      ok(Math.abs(c3.x - c3.tx) < 1, '움직임 줄이기면 카메라가 바로 따라붙음');
    }

    else if (s === 'talk-marks' || s === 'talk-marks-motion') {
      // ? 말풍선: 말을 걸어 볼 만한 사람(목적지 인물·이번 걷기에서 할 말·선택에 반응하는 한 줄) 머리 위에만, 말 걸면 사라짐
      var TW = window.PRIVACY_WORLD, TM = PrivacyMap.debug;
      function marksNow(ms) { TM.tick(ms || 16); return TM.talkMarks(); }
      function whoList(ms) { return marksNow(ms).map(function (m) { return m.who + ':' + m.why; }).sort().join(','); }
      $('#btn-new').click(); await wait(300);
      var yard = TW.SCENES.filter(function (c) { return c.id === 'yard'; })[0];
      if (s === 'talk-marks-motion') { // 움직임 허용: 위아래로 살짝 흔들림
        TM.place(yard.ox + 14, 8, 'down'); await wait(50);
        var ys = [0, 300, 600, 900].map(function (ms) { var m = marksNow(ms).filter(function (q) { return q.who === 'haneul'; })[0]; return m ? m.y : null; });
        ok(ys.every(function (v) { return v != null; }) && Math.max.apply(null, ys) - Math.min.apply(null, ys) >= 1, '움직임 허용이면 ?가 위아래로 흔들림 ' + JSON.stringify(ys));
        ok(TM.marker().kind === 'dest', '목적지(다른 장면)는 핀');
      } else {
        // 내 방(첫날 아침): 방에는 아무도 없음 → ? 없음, 목적지(교실의 새봄)는 다른 장면이라 방문에 핀
        ok(marksNow().length === 0, '내 방엔 ? 없음');
        ok(TM.marker().kind === 'dest', '다른 장면 목적지 = 핀 ' + JSON.stringify(TM.marker()));
        // 마당: 오프닝에서 자기소개할 하늘·지호 머리 위에 ?
        TM.place(yard.ox + 14, 8, 'down'); await wait(50);
        ok(whoList() === 'haneul:lines,jiho:lines', '마당: 하늘·지호에게 ? ' + whoList());
        var lbl = $('#m-canvas').getAttribute('aria-label');
        ok(/물음표/.test(lbl) && /하늘/.test(lbl) && /지호/.test(lbl), '지도 설명 글에도 ?가 뜬 사람 이름: ' + lbl);
        var y0 = marksNow(0)[0].y, y1 = marksNow(300)[0].y, y2 = marksNow(700)[0].y;
        ok(y0 === y1 && y1 === y2, '움직임 줄이기면 ?가 흔들리지 않음 ' + [y0, y1, y2]);
        // 지호 옆으로 걸어가 Space → 대화, 끝나면 지호의 ?만 사라짐
        var jc = castOf('jiho');
        ok(await walkToCell(jc.x, jc.y + 1), '지호 옆까지 걸어감');
        key('ArrowUp'); key('ArrowUp', 'keyup'); await wait(50);
        ok(/지호에게 말 걸기/.test($('#btn-map-act').textContent) && !!$('#btn-map-act .ico-talk'), '버튼 글자: ? 그림 + 지호에게 말 걸기 ' + $('#btn-map-act').textContent);
        key(' '); await wait(50);
        ok(!$('#talk').hidden && /지호/.test($('#talk .talk-name').textContent), '지호와 대화');
        await passTalk(); await wait(3400); // 말하는 동안 뜬 말풍선(3.2초)이 사라진 뒤
        ok(whoList(4000) === 'haneul:lines', '말 건 지호의 ?는 사라지고 하늘만 남음 ' + whoList());
        var st0 = JSON.stringify([PrivacyApp.state().trust, PrivacyApp.state().stats, PrivacyApp.state().flags]);
        // 하늘의 ?를 눌러도 가서 말 걸기
        var hm = marksNow().filter(function (m) { return m.who === 'haneul'; })[0], cr = $('#m-canvas').getBoundingClientRect();
        $('#m-canvas').dispatchEvent(new PointerEvent('pointerdown', { clientX: cr.left + hm.x, clientY: cr.top + hm.y, bubbles: true }));
        var g = 0; while ($('#talk').hidden && g++ < 300) await wait(20);
        ok(!$('#talk').hidden && /하늘/.test($('#talk .talk-name').textContent), '? 말풍선을 누르면 걸어가서 하늘에게 말 걸기');
        await passTalk(); await wait(50);
        ok(marksNow(4000).length === 0, '둘 다 말 걸면 마당에 ? 없음');
        ok(JSON.stringify([PrivacyApp.state().trust, PrivacyApp.state().stats, PrivacyApp.state().flags]) === st0 && PrivacyApp.state().mapTarget === 'pro_1', '말 걸기는 관계·점수·플래그를 바꾸지 않음');
        // 교실: 목적지 새봄 = ?(핀 대신), 할 말 없는 민준은 ? 없음
        var cls = TW.SCENES[0];
        TM.place(cls.ox + 15, 12, 'up'); await wait(50); marksNow();
        var mk = TM.marker();
        ok(mk.kind === 'talk' && mk.who === 'saebom', '같은 장면의 목적지 인물은 ? ' + JSON.stringify(mk));
        ok(marksNow().length === 0, '할 말 없는 민준에겐 ? 없음 ' + whoList());
        // 다른 걷기: 지금 상태에서 조건이 맞는 반응 줄이 있는 사람에게만 ?(목적지 인물 제외)
        await play(R.A, { upto: 3, stopAtMap: true });
        TM.place(cls.ox + 15, 15, 'up'); await wait(3400);
        var trg = TW.triggers[PrivacyApp.state().mapTarget], rs = PrivacyApp.state();
        var expect = trg.cast.filter(function (c) {
          if (c.who === trg.target.npc || TW.sceneAt(c.x) !== TW.sceneAt(TM.me().x)) return false;
          if (trg.castLines && trg.castLines[c.who]) return true;
          var hit = (TW.idle[c.who] || []).filter(function (l) { return PrivacyEngine.evalCond(l.if, rs); })[0];
          return !!(hit && hit.if);
        }).map(function (c) { return c.who; }).sort().join(',');
        var got = marksNow().map(function (m) { return m.who; }).sort().join(',');
        ok(got === expect, PrivacyApp.state().mapTarget + ' 시작 장면: ? 대상이 규칙과 같음 [' + got + '] = [' + expect + ']');
      }
    }

    else if (s === 'marker') {
      // ❗가 위 안내 상자·아래 버튼·안내 문구에 가리지 않는지(화면 좌표로 겹침 검사)
      function markerVisible(label) {
        var mk = PrivacyMap.debug.marker(), cr = $('#m-canvas').getBoundingClientRect();
        if (!mk) { fail.push(label + ': ❗ 없음'); return null; }
        var px = cr.left + mk.x, py = cr.top + mk.y;
        var hits = ['.hud-left', '.hud .bar-actions', '#v-map .map-controls', '#v-map .map-help', '#m-say'].filter(function (q) {
          var e = $(q); if (!e || !e.getClientRects().length) return false;
          var r = e.getBoundingClientRect(); return px >= r.left - 12 && px <= r.right + 12 && py >= r.top - 12 && py <= r.bottom + 12;
        });
        ok(hits.length === 0 && px > cr.left && px < cr.right && py > cr.top && py < cr.bottom, label + ': ❗가 안내 상자·버튼에 가리지 않음 ' + JSON.stringify([Math.round(px), Math.round(py), hits]));
        return mk;
      }
      $('#btn-new').click(); await wait(300);
      var mk0 = markerVisible('첫날 아침 내 방');
      ok(!!mk0 && mk0.kind === 'dest', '다른 장면 목적지는 핀(dest) ' + (mk0 && mk0.kind));
      var WDm = window.PRIVACY_WORLD;
      ok(!!mk0 && !!WDm.DOORS[mk0.tx + ',' + mk0.ty] && WDm.sceneAt(mk0.tx).id === 'room', '방 안에서 목적지가 다른 장면이면 ❗는 방문(출입구)에 ' + JSON.stringify(mk0));
      // 집 밖(마을 길)으로 나가면 ❗는 학교로 가는 출입구 쪽
      var hd = WDm.DOORS[mk0.tx + ',' + mk0.ty].to;
      await walkToCell(hd[0] - 3, hd[1] + 1); await wait(100);
      var mk1 = markerVisible('집 앞');
      ok(!!mk1 && WDm.sceneAt(mk1.tx).id === 'village' && !!WDm.DOORS[mk1.tx + ',' + mk1.ty] && WDm.DOORS[mk1.tx + ',' + mk1.ty].scene === 'yard', '마을 길에선 ❗가 학교로 가는 길 끝에 ' + JSON.stringify(mk1));
    }

    else if (s === 'neighborhood') { // 마을 길: 이웃집 2채(조사만) + 길 끝 마지막 집이 우리 집
      $('#btn-new').click();
      await play(R.A, { upto: 1, stopAtMap: true });
      var NW = window.PRIVACY_WORLD, NM = PrivacyMap.debug;
      ok(NW.NEIGHBORS.length === 2, '이웃집 2채');
      for (var ni = 0; ni < NW.NEIGHBORS.length; ni++) {
        var nb = NW.NEIGHBORS[ni];
        ok(await walkToCell(nb.approach.x, nb.approach.y), nb.name + ' 현관 앞까지 걸어감');
        ok(NM.me().area === '마을 길', nb.name + ' 앞은 마을 길: ' + NM.me().area);
        key('ArrowUp'); key('ArrowUp', 'keyup'); await wait(250);
        var nm = NM.me();
        ok(nm.x === nb.approach.x && nm.y === nb.approach.y && nm.dir === 'up', nb.name + ' 안으로는 들어가지 않음');
        key(' '); await wait(50);
        ok(!$('#talk').hidden && $('#talk .talk-text').textContent.indexOf(nb.look.slice(0, 8)) >= 0, nb.name + ' 조사: 생활 대사');
        await passTalk();
        var ns = PrivacyApp.state();
        ok(view() === 'v-map' && ns.screen === 'map' && ns.mapTarget === 'c1_e1_a', nb.name + ' 조사 뒤에도 같은 걷기');
      }
      var homeKey = Object.keys(NW.DOORS).filter(function (k) { return NW.DOORS[k].scene === 'room'; })[0], hx = Number(homeKey.split(',')[0]);
      ok(NW.NEIGHBORS.every(function (n) { return n.approach.x < hx; }), '우리 집은 길 끝 마지막 집');
      var mb = NW.object('mailbox');
      ok(await walkToCell(mb.x - 1, mb.y), '우편함 옆');
      key('ArrowRight'); key('ArrowRight', 'keyup'); await wait(250); key(' '); await wait(50);
      ok(!$('#talk').hidden && /우편함/.test($('#talk .talk-text').textContent), '노란 우편함 조사');
      await passTalk();
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk(); await wait(50);
      ok(view() === 'v-game' && PrivacyApp.state().scene === 'c1_e1_a', '마을을 돌아본 뒤 본편 진행');
    }

    else if (s === 'pos-recover') {
      var E3 = window.PrivacyEngine, ST3 = window.PRIVACY_STORY, PK3 = 'ethicity.privacy.progress.v2';
      var NB3 = window.PRIVACY_WORLD.NEIGHBORS[1], BX = NB3.x + 2, BY = NB3.y + 2;
      if (P.phase === 0) { // 저장 위치가 벽돌집(걸을 수 없는 칸) 안
        var m3 = E3.createState(ST3), g3 = 0;
        while (!(m3.screen === 'map' && m3.mapTarget === 'c1_e1_a') && g3++ < 8) m3 = m3.screen === 'scene' && E3.needsChoice(ST3, m3) ? E3.choose(ST3, m3, 'photo') : E3.advance(ST3, m3);
        m3.history = [];
        localStorage.setItem(PK3, JSON.stringify({ v: 1, run: m3, explored: { pro_1: ['photo'] }, endingsSeen: ['B'], pos: { x: BX, y: BY, dir: 'up', for: 'c1_e1_a', v: window.PRIVACY_WORLD.VERSION } }));
        sessionStorage.setItem('probe-saved', JSON.stringify(m3.stats));
        sessionStorage.setItem('probe-phase', '1'); carry(); location.reload(); return;
      }
      ok(!$('#btn-continue').hidden, '이어 하기');
      $('#btn-continue').click(); await wait(50);
      var rm = PrivacyMap.debug.me();
      ok(view() === 'v-map' && PrivacyApp.state().mapTarget === 'c1_e1_a', '같은 걷기에서 이어짐');
      ok(window.PRIVACY_WORLD.walkable(rm.x, rm.y) && Math.abs(rm.x - BX) + Math.abs(rm.y - BY) <= 5, '집 안 저장 위치 → 가까운 걸을 수 있는 칸 ' + JSON.stringify(rm));
      var pg = JSON.parse(ls(PK3));
      ok(pg.endingsSeen.indexOf('B') >= 0 && pg.explored.pro_1 && JSON.stringify(PrivacyApp.state().stats) === sessionStorage.getItem('probe-saved'), '진행·완료 기록은 그대로');
      checkOthersKept();
      ok(ls('ethicity.player') === P.PLAYER, '공통 플레이어 정보 보존');
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk(); await wait(50);
      ok(view() === 'v-game' && PrivacyApp.state().scene === 'c1_e1_a', '복구 뒤 본편 진행');
      sessionStorage.removeItem('probe-phase'); sessionStorage.removeItem('probe-carry');
    }

    else if (s === 'sound') {
      ok(!/"sound":true/.test(ls('ethicity.privacy.settings.v1') || ''), '효과음은 기본 꺼짐');
      $('#btn-new').click();
      await play(R.A, { upto: 0 });
      ok(window.__beeps === 0, '꺼져 있으면 메시지가 와도 소리 없음');
      $('#btn-menu').click(); await wait();
      ok(!!$('#opt-sound') && !$('#opt-sound').checked, '메뉴에 효과음 켜기(꺼짐 표시)');
      $('#opt-sound').click(); await wait();
      $('#btn-menu-close').click(); await wait();
      ok(JSON.parse(ls('ethicity.privacy.settings.v1')).sound === true && (function (fx) { return fx.length === 1 && /tap\.wav$/.test(fx[0]); })(window.__plays.filter(function (u) { return !/assets\/bgm\//.test(u); })), '켠 설정이 저장되고 미리듣기(tap) 한 번(배경음악 제외): ' + window.__plays.join(','));
      await wait(300);
      var b0 = window.__beeps;
      $$('#g-dock .choice')[0].click(); await wait(400);
      var got = window.__beeps - b0;
      ok(got >= 1 && got <= 3, '친구 메시지가 오면 수신음(한꺼번에 와도 겹치지 않게) ' + got + '번');
      var gn = 0; while (!$('#btn-next') && gn++ < 100) await wait(20);
      var b1 = window.__beeps;
      $('#btn-next').click(); await wait(50);
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(400); await passTalk(); await wait(50);
      ok(window.__beeps >= b1, '맵·대화창에서는 수신음 강요 없음');
    }

    else if (s === 'finale') {
      $('#btn-new').click();
      await play(R.D, { upto: R.D.length - 1 });
      // 마지막 선택은 보통 속도·움직임 켬으로: 글이 차례로 떠오르는지 본다
      $('#opt-motion').checked = true; $('#opt-motion').click(); PrivacyApp.setSpeed('normal'); await wait(); // 움직임 줄이기 끔
      await play(R.D, { from: R.D.length - 1 });
      var fin = $('#finale');
      ok(!!fin && !fin.hidden && view() === 'v-ending', '엔딩 도착 → 검은 화면 연출');
      ok(!!fin && getComputedStyle(fin).backgroundColor === 'rgb(0, 0, 0)', '검은 화면');
      ok(!!fin && fin.getAttribute('role') === 'dialog' && document.activeElement && fin.contains(document.activeElement), '연출에 포커스(대화상자)');
      var shown0 = $$('#finale .finale-line:not(.on)').length;
      ok(shown0 > 0, '처음엔 글이 다 뜨지 않음(차례로 떠오름) 남은 줄 ' + shown0);
      fin.click(); await wait(50);
      ok($$('#finale .finale-line:not(.on)').length === 0, '누르면 남은 줄이 한꺼번에');
      ok(/게임이 끝났습니다\./.test(fin.textContent) && /과연 당신의 선택은 어떠했을까요\?/.test(fin.textContent), '두 문장');
      var picks = $$('#finale .finale-choice');
      ok(picks.length === 9, '9개 사건 내 선택 ' + picks.length + '줄');
      var st = PrivacyApp.state(), ST = window.PRIVACY_STORY;
      var e1 = st.history.filter(function (h) { return ST.scenes[h.scene].event === 'e1'; })[0];
      var e1text = ST.scenes[e1.scene].choices.filter(function (c) { return c.id === e1.choice; })[0].text;
      ok(picks[0] && picks[0].textContent.indexOf(ST.events.e1.title) >= 0 && picks[0].textContent.indexOf(e1text.replace(/\{name\}/g, '').slice(0, 8)) >= 0, '첫 줄 = 정산 계좌번호 + 그때 고른 선택');
      var bonds = $$('#finale .finale-bond');
      var mark0 = st.chapterMarks[0].trust;
      var okBonds = bonds.length === ST.trustable.length && bonds.every(function (b) {
        var w = b.getAttribute('data-who'), d = st.trust[w] - (mark0[w] || 0);
        var word = d > 0 ? '믿음이 생김' : d < 0 ? '믿음이 줄어듦' : '그대로';
        return !!b.querySelector('.spr.face') && b.textContent.indexOf(ST.characters[w].name) >= 0 && b.textContent.indexOf(word) >= 0;
      });
      ok(okBonds, '친구마다 얼굴 + 믿음이 생김/그대로/줄어듦(실제 신뢰 변화와 일치) ' + bonds.map(function (b) { return b.textContent; }).join(' / '));
      ok(/엔딩 D/.test($('#finale .finale-end').textContent), '마지막에 엔딩 이름');
      ok(!!$('#finale .finale-odds') && $('#finale .finale-odds').textContent.indexOf(window.PRIVACY_ODDS.D + '%') >= 0 && /아무거나 골랐다면/.test($('#finale .finale-odds').textContent), '“아무거나 골랐다면” 확률: ' + ($('#finale .finale-odds') || {}).textContent);
      $('#finale-go').click(); await wait(50);
      ok($('#finale').hidden && view() === 'v-ending' && /엔딩 D/.test($('#e-eyebrow').textContent), '결과 보기 → 엔딩 페이지');
      $('#btn-end-path').click(); await wait(); $('#btn-path-back').click(); await wait();
      ok(view() === 'v-ending' && $('#finale').hidden, '경로에서 돌아올 땐 연출 없이');
    }

    else if (s === 'talk-guard') {
      $('#btn-new').click(); await wait(30);
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(30);
      ok(!$('#talk').hidden && document.activeElement === $('#btn-talk-next'), '대화창이 열리면 ▼에 키보드 포커스');
      key('ArrowLeft'); key('ArrowLeft', 'keyup'); await wait(200);
      ok(!$('#talk').hidden && view() === 'v-map', '새봄 소개 중 방향키로 건너뛰지 않음');
      // 소개 도중 처음부터 다시 → 내 방에서 다시 걷기(바로 장면으로 넘어가면 안 됨)
      $('#btn-menu').click(); await wait(); $('#btn-menu-restart').click(); await wait(); confirmYes(); await wait(50);
      if (!$('#talk').hidden) { $('#btn-talk-next').click(); await wait(50); }
      var rs = PrivacyApp.state();
      ok(view() === 'v-map' && rs.screen === 'map' && rs.mapTarget === 'pro_1' && /내 방/.test($('#m-area').textContent), '소개 중 처음부터 다시 → 내 방 걷기부터 ' + JSON.stringify([view(), rs.screen, $('#m-area').textContent]));
      // 장소 장면에서 대화창이 열린 채 되돌리기 → 대화창 닫힘
      await play(R.A, { upto: 2 });
      $$('#g-dock .choice').filter(function (b) { return b.getAttribute('data-choice') === 'fix'; })[0].click(); await wait(50);
      var gn = 0; while (!$('#btn-next') && gn++ < 100) await wait(20);
      $('#btn-next').click(); await wait(50);
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(50);
      var gt = 0; while ($('#talk').hidden && gt++ < 100) await wait(20);
      ok(PrivacyApp.state().scene === 'c1_e2_a' && !$('#talk').hidden, '장소 장면 대화창 열림');
      $('#btn-undo').click(); await wait(); confirmYes(); await wait(100);
      ok(PrivacyApp.state().scene === 'c1_e1_b' && $('#talk').hidden, '되돌리면 이전 장면 대화창은 닫힘');
    }

    else if (s === 'map-resume') {
      if (P.phase === 0) {
        $('#btn-new').click();
        await play(R.A, { upto: 1, stopAtMap: true });
        key('ArrowLeft'); key('ArrowLeft', 'keyup'); await wait(400);
        key('ArrowLeft'); key('ArrowLeft', 'keyup'); await wait(400);
        var m0 = PrivacyMap.debug.me();
        sessionStorage.setItem('probe-saved', JSON.stringify(m0));
        await wait(600);
        sessionStorage.setItem('probe-phase', '1'); carry();
        location.reload();
        return;
      }
      var m0b = JSON.parse(sessionStorage.getItem('probe-saved'));
      ok(!$('#btn-continue').hidden, '맵에서 새로고침 → 이어 하기');
      $('#btn-continue').click(); await wait();
      var m1 = PrivacyMap.debug.me();
      ok(view() === 'v-map' && m1.x === m0b.x && m1.y === m0b.y && m0b.x === window.PRIVACY_WORLD.SPAWNS.classroom.x - 2, '같은 위치에서 재개 (' + m1.x + ',' + m1.y + ')');
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk(); await wait();
      ok(view() === 'v-game' && PrivacyApp.state().scene === 'c1_e1_a', '재개 후 사건 시작');
      sessionStorage.removeItem('probe-phase'); sessionStorage.removeItem('probe-carry');
    }

    else if (s === 'no-player' || s === 'damaged-player' || s === 'wrong-player') {
      ok($('#player-name').textContent === '플레이어', '기본 별명 ‘플레이어’');
      ok($('#player-avatar').getAttribute('src') === 'assets/avatar-default.svg', '기본 아바타');
      ok(!$('#player-note').hidden, '안내 문구 표시: ' + $('#player-note').textContent);
      ok(s === 'no-player' ? ls('ethicity.player') === null : ls('ethicity.player') !== null, '공통 플레이어 키를 만들거나 고치지 않음');
      $('#btn-new').click();
      await play(R.C);
      await finishChecks('C', R.C.length);
    }

    else if (s === 'xss') {
      var name = JSON.parse(P.PLAYER).nickname;
      ok($('#player-name').textContent === name, '별명이 글자 그대로 표시');
      $('#btn-new').click();
      await play(R.A, { upto: 0 });
      ok($('#g-log').textContent.indexOf(name) >= 0, '대사 속 {name} 치환은 텍스트로');
      $('#g-dock .choice').click(); await wait();
      var body = document.body;
      ok(!window.__xss, '별명 속 스크립트 실행 안 됨');
      // 프로필 얼굴·대화방 사진 자리는 게임이 넣는 그림 — 그 밖의 img가 생기면 별명이 태그로 해석된 것
      ok($$('#v-game img, #v-start .player-chip img').filter(function (im) { return !im.closest('.av.has-face, .photo'); }).length === 1 && !$$('#v-game img').some(function (im) { return /(^|\/)x$/.test(im.getAttribute('src') || ''); }), '별명이 이미지 태그로 해석되지 않음');
      ok(!$('#v-game b'), '별명이 굵게 태그로 해석되지 않음');
      var who = $$('.who').filter(function (w) { return w.textContent.indexOf('<img') === 0; })[0];
      ok(!!who && who.scrollWidth >= who.clientWidth, '긴 별명 줄임 처리 요소 존재');
      ok(document.documentElement.scrollWidth <= window.innerWidth + 1, '긴 별명으로 가로 넘침 없음');
      await play(R.A, { from: 1 });
      ok(!window.__xss, '완주 후에도 스크립트 실행 없음');
      await finishChecks('A', R.A.length);
    }

    else if (s === 'resume') {
      if (P.phase === 0) {
        $('#btn-new').click();
        var n = await play(R.D, { upto: 7 });
        var st = PrivacyApp.state();
        sessionStorage.setItem('probe-saved', JSON.stringify({ scene: st.scene, hist: st.history.length, flags: st.flags, stats: st.stats, n: n }));
        sessionStorage.setItem('probe-phase', '1'); carry();
        location.reload();
        return; // 새 페이지에서 계속
      }
      if (P.phase === 1) {
        var saved = JSON.parse(sessionStorage.getItem('probe-saved'));
        ok(view() === 'v-start' && !$('#btn-continue').hidden, '새로고침 뒤 시작 화면에 이어 하기');
        $('#btn-continue').click(); await wait();
        var st1 = PrivacyApp.state();
        ok(st1.scene === saved.scene && st1.history.length === saved.hist && JSON.stringify(st1.flags) === JSON.stringify(saved.flags), '같은 장면·기록으로 재개 ' + st1.scene);
        ok($$('#g-log li').length > 0 && $$('#g-dock .choice').length > 0, '재개 장면의 대사·선택지 표시');
        // 선택 → 되돌리기
        var before = JSON.stringify([st1.flags, st1.stats, st1.trust]);
        $$('#g-dock .choice')[0].click(); await wait();
        ok(PrivacyApp.state().history.length === saved.hist + 1, '선택하면 기록 +1');
        $('#btn-undo').click(); await wait();
        ok(!$('#confirm').hidden, '되돌리기 전 확인 창');
        confirmYes(); await wait();
        var st2 = PrivacyApp.state();
        ok(st2.history.length === saved.hist && JSON.stringify([st2.flags, st2.stats, st2.trust]) === before && st2.scene === saved.scene && !st2.reaction, '되돌리면 선택 전 상태로 정확히 복원');
        // 다른 선택 → 반응 표시 중 새로고침 없이 되돌리기 한 번 더(취소 버튼도 확인)
        $$('#g-dock .choice')[1].click(); await wait();
        $('#btn-undo').click(); await wait();
        $('#confirm-no').click(); await wait();
        ok(PrivacyApp.state().history.length === saved.hist + 1, '확인 창에서 취소하면 그대로');
        $('#btn-undo').click(); await wait(); confirmYes(); await wait();
        ok(PrivacyApp.state().history.length === saved.hist && view() === 'v-game', '되돌린 뒤에도 기록 수 일관');
        var left = await play(R.D, { from: saved.n });
        ok(left === R.D.length, '나머지 경로 완주');
        await finishChecks('D', R.D.length);
        sessionStorage.setItem('probe-phase', '2'); carry();
        location.reload();
        return;
      }
      if (P.phase === 2) {
        ok(view() === 'v-start' && $('#btn-continue').hidden, '완료 뒤 새로고침: 이어 하기 없음');
        ok(!$('#last-result').hidden && /엔딩 D/.test($('#last-result').textContent), '최근 결과 표시');
        ok(!$('#start-links').hidden && !$('#btn-start-path').hidden, '지난 선택 경로 링크');
        checkResult('D');
        sessionStorage.removeItem('probe-phase'); sessionStorage.removeItem('probe-carry');
      }
    }

    else if (s === 'blocked') {
      ok(!$('#notice').hidden && /저장할 수 없/.test($('#notice').textContent), '저장소 불가 안내');
      ok(!$('#look-pick').hidden, '공통 캐릭터가 없으면 모습 고르기 표시');
      $('#btn-new').click(); await wait();
      ok(view() === 'v-start' && !$('#look-msg').hidden, '모습을 안 고르면 시작 전 안내');
      $$('input[name=look]')[1].click(); await wait();
      $('#btn-new').click();
      await play(R.C);
      ok(view() === 'v-ending' && $('#e-eyebrow').textContent === '엔딩 C', '저장소 없이도 엔딩까지 진행');
      $('#btn-end-path').click(); await wait();
      ok($$('.path-opts li.mine').length === R.C.length, '메모리 기록으로 경로 화면');
    }

    else if (s === 'corrupt-progress' || s === 'stale-progress') {
      ok(!$('#notice').hidden, '손상 기록 안내: ' + $('#notice').textContent);
      ok($('#btn-continue').hidden, '손상된 진행은 이어 하기 숨김');
      $('#btn-new').click();
      await play(R.A);
      await finishChecks('A', R.A.length);
      if (s === 'stale-progress') {
        ok($$('.ending-chips li.seen').length === 2, '이전 엔딩 기록(B)은 유지 + A');
        ok($$('.opt-note').length >= 1, '이전 플레이에서 고른 선택 표시');
      }
    }

    else if (s === 'wipe' || s === 'restart-keeps') {
      $('#btn-new').click();
      await play(R.B);
      await finishChecks('B', R.B.length);
      if (s === 'wipe') {
        $('#btn-end-replay').click(); await wait();
        $('#btn-menu').click(); await wait();
        $('#btn-menu-wipe').click(); await wait();
        confirmYes(); await wait();
        ok(ls('ethicity.privacy.progress.v2') === null && ls('ethicity.result.privacy') === null, '이 게임 진행·결과 삭제');
        ok(ls('ethicity.player') === P.PLAYER, '공통 플레이어 정보 유지');
        checkOthersKept();
        ok(view() === 'v-start' && $('#last-result').hidden, '시작 화면에 결과 없음');
      } else {
        $('#btn-end-replay').click(); await wait();
        var st3 = PrivacyApp.state();
        ok(st3.scene === 'pro_1' && st3.history.length === 0, '다시 하기: 새 진행');
        checkResult('B');
        var p = JSON.parse(ls('ethicity.privacy.progress.v2'));
        ok(p.endingsSeen.indexOf('B') >= 0 && Object.keys(p.explored).length > 5, '해금 기록 유지');
        // 중간에 처음부터 → 확인 창
        $('#btn-menu').click(); await wait(); $('#btn-menu-home').click(); await wait();
        $('#btn-new').click(); await wait();
        ok(!$('#confirm').hidden, '진행 중 새로 시작 시 확인');
        $('#confirm-no').click();
      }
    }

    else if (s === 'normal-speed') {
      $('#btn-new').click(); await wait();
      var tLines = [];
      new MutationObserver(function () { var n = realLis().length; if (n > tLines.length) tLines.push(performance.now()); }).observe($('#g-log'), { childList: true });
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk();
      var gw = 0; while (!realLis().length && gw++ < 200) await wait(20);
      var shown = realLis().length;
      await wait(1700);
      ok(tLines.length >= 2 && tLines[1] - tLines[0] >= 1300, '메시지가 하나씩 천천히(간격 ' + (tLines.length >= 2 ? Math.round(tLines[1] - tLines[0]) : '?') + 'ms ≥ 1.3초)');
      ok(shown >= 1 && shown < 8 && !!$('.skip-btn'), '대사가 차례로 나옴(100ms 뒤 ' + shown + '줄)');
      $('.skip-btn').click(); await wait();
      ok(realLis().length === 8 && !$('#g-log li.typing') && !$('#g-log .type-rest') && $$('#g-dock .choice').length === 3, '모두 보기 → 남은 대사 한꺼번에 → 선택지');
      $$('#g-dock .choice')[0].click();
      var gn = 0; while (!$('#btn-next') && gn++ < 400) await wait(50); // 반응 줄도 하나씩(입력 중… → 주르륵 → 쉼)
      ok(!!$('#btn-next'), '반응 표시 뒤 계속 버튼');
      ok(document.activeElement === $('#btn-next'), '계속 버튼에 키보드 포커스');
      $('#btn-menu').click(); await wait();
      ok(!$('#menu').hidden, '메뉴 열림');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait();
      ok($('#menu').hidden, 'Esc로 메뉴 닫힘');
    }

    else if (s === 'greet-met' || s === 'greet-met-2') {
      // 오프닝 새봄의 "오는 길에 하늘이랑 지호도 봤지?"는 이 걷기에서 둘 다 마주쳤을 때만(지나가며 인사·말 걸기), 아니면 다른 줄
      var TW = window.PRIVACY_WORLD, TM = PrivacyMap.debug;
      $('#btn-new').click(); await wait(300);
      var cls = TW.SCENES.filter(function (c) { return c.id === 'classroom'; })[0], yard = TW.SCENES.filter(function (c) { return c.id === 'yard'; })[0];
      if (s === 'greet-met-2') { // 마당에서 하늘·지호 곁을 지나감(말은 안 걸음)
        var hc = castOf('haneul'), jc = castOf('jiho');
        TM.place(yard.ox + 14, 8, 'down'); await wait(50);
        ok(await walkToCell(hc.x, hc.y + 1), '하늘 곁 지나가기');
        ok(await walkToCell(jc.x, jc.y + 1), '지호 곁 지나가기');
      }
      TM.place(cls.ox + 15, 12, 'up'); await wait(50);
      var sb = castOf('saebom');
      ok(await walkToCell(sb.x, sb.y + 1), '새봄 앞까지 걸어감');
      key('ArrowUp'); key('ArrowUp', 'keyup'); await wait(50);
      key(' '); await wait(100);
      var tx = $('#talk .talk-text').textContent;
      if (s === 'greet-met') ok(!$('#talk').hidden && /마당에 있더라/.test(tx) && !/봤지\?/.test(tx), '둘을 안 마주쳤으면 "봤지?" 대신 다른 줄: …' + tx.slice(-50));
      else ok(!$('#talk').hidden && /봤지\?/.test(tx) && !/마당에 있더라/.test(tx), '둘 다 지나쳤으면 "오는 길에 하늘이랑 지호도 봤지?": …' + tx.slice(-50));
    }

    else if (s === 'route-bad') {
      // 지시서 [나쁜 경로]: 내가 해친 민준이는 9시 전에 말리지 않는다(아무도 없으면 '알림'), 엔딩 D 본문에 양면·책임 행동
      var BAD = ['pro_1#sns', 'c1_e1_a#public', 'c1_e1_b#pass', 'c1_e2_a#shoot', 'c1_e2_b#story', 'c1_e2_d#no', 'c1_e3_b#capture', 'c1_e3_cap#none',
        'c2_e4_a#forward', 'c2_e4_b#blame', 'c2_e5_a#all', 'c2_e5_b#close', 'c2_e6_a#post', 'c2_e6_b#deny',
        'c3_e7_a#join', 'c3_e7_b#hide', 'c3_e8_a#meet', 'c3_e8_b#go', 'c3_e8_c#fight', 'c3_e8_f#silence', 'c3_e8_i#fine', 'c3_e9_a#share', 'c3_e9_b#keep'];
      var heads = {};
      new MutationObserver(function () { var st = PrivacyApp.state(); var h = $('#g-head .head-title'); if (st && h) heads[st.scene] = h.textContent; }).observe($('#g-head'), { childList: true, subtree: true });
      $('#btn-new').click(); await wait();
      await play(BAD);
      ok(heads.c3_e8_b === '알림', '9시 전: 민준 개인톡이 아님(말리는 친구 없음 → 알림) ' + heads.c3_e8_b);
      ok(heads.c3_e8_i === '민준', '다음 날 민준 개인톡은 그대로 ' + heads.c3_e8_i);
      ok(view() === 'v-ending' && /엔딩 D/.test($('#e-eyebrow').textContent), '엔딩 D');
      ok(/퍼뜨린 사람이기도/.test($('#e-body').textContent) && /사과하고/.test($('#e-body').textContent) && /협조/.test($('#e-body').textContent), '엔딩 D 본문: 양면 + 책임지는 행동');
    }

    else if (s === 'typing') {
      // 1) 대화창(오프닝 소개): 첫 누르기 = 이 줄 다 보이기, 다음 누르기 = 다음 줄
      $('#btn-new').click(); await wait(30);
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(30);
      var tt = $('#talk .talk-text');
      ok(!$('#talk').hidden && PrivacyTalk.typing() && !!tt.querySelector('.type-rest'), '대화창 글자가 한 글자씩 나오는 중');
      ok(tt.getAttribute('aria-hidden') === 'true' && $('#talk .talk-live').textContent === '' && !$('#talk').hasAttribute('aria-live'), '치는 동안은 화면 읽기에 안 읽힘(대화창 자체는 aria-live 아님)');
      var full1 = tt.textContent, part1 = tt.querySelector('p span').textContent;
      ok(part1.length < full1.length, '보이는 글자가 전체보다 짧음 ' + part1.length + '/' + full1.length);
      $('#btn-talk-next').click(); await wait();
      ok(!$('#talk').hidden && !PrivacyTalk.typing() && tt.textContent === full1 && !tt.querySelector('.type-rest'), '첫 누르기: 같은 줄을 다 보여 줌(넘기지 않음)');
      ok(!tt.hasAttribute('aria-hidden') && $('#talk .talk-live').textContent.indexOf(full1) >= 0, '다 보인 줄은 한 번 읽힘: ' + $('#talk .talk-live').textContent);
      $('#btn-talk-next').click(); await wait();
      ok($('#talk').hidden || tt.textContent !== full1, '두 번째 누르기: 다음 줄로(누른 것을 버리지 않음)');
      if (!$('#talk').hidden && PrivacyTalk.typing()) { var full2 = tt.textContent; key(' '); await wait(); ok(!PrivacyTalk.typing() && tt.textContent === full2 && !$('#talk').hidden, 'Space도 첫 번째는 완성'); }
      await passTalk();
      // 2) 폰 단톡(pro_1): '입력 중…' → 주르륵 → 누르면 완성 → 다시 누르면 다음 메시지
      var added = [];
      new MutationObserver(function (ms) {
        ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.tagName === 'LI') added.push(n.classList.contains('typing') ? 'dots' : n.classList.contains('msg') ? 'msg' : 'etc'); }); });
      }).observe($('#g-log'), { childList: true });
      var gw = 0; while (!$('#g-log .type-rest') && gw++ < 600) await wait(10);
      var li = ($('#g-log .type-rest') || document.body).closest('li');
      ok(!!li, '말풍선 글자가 주르륵 나오기 시작');
      if (li) {
        var fullT = li.querySelector('.bubble p').textContent, before = realLis().length;
        ok(li.getAttribute('aria-hidden') === 'true', '치는 중인 말풍선은 화면 읽기에서 숨김');
        ok(li.querySelector('.bubble p span').textContent.length < fullT.length, '보이는 글자가 아직 일부');
        ok(added.indexOf('dots') >= 0 && added.indexOf('dots') < added.indexOf('msg'), '친구 메시지 앞에 “입력 중…”: ' + added.join(','));
        ok(!$('#g-log li.typing') || /입력 중/.test($('#g-log li.typing').textContent), '“입력 중…” 글자');
        $('#g-log').click(); await wait();
        ok(!$('#g-log .type-rest') && li.querySelector('.bubble p').textContent === fullT && realLis().length === before, '첫 누르기: 지금 메시지를 다 보여 줌(다음으로 안 넘어감)');
        ok(!li.hasAttribute('aria-hidden'), '다 보인 말풍선은 숨김 해제');
        $('#g-log').click(); await wait();
        ok(realLis().length === before + 1, '두 번째 누르기: 바로 다음 메시지 ' + before + '→' + realLis().length);
        if ($('#g-log .type-rest')) { var n2 = realLis().length, f2 = $('#g-log .type-rest').closest('p').textContent; key(' '); await wait(); ok(!$('#g-log .type-rest') && realLis().length === n2 && $$('#g-log .bubble p').some(function (p) { return p.textContent === f2; }), 'Space도 첫 번째는 완성'); }
      }
      // 3) 나머지는 그냥 두고 속도 재기: 글자당 약 30ms, 긴 메시지도 1.5초 안
      var dur = [], cur = null, t0 = 0;
      gw = 0;
      while (!$$('#g-dock .choice').length && gw++ < 3000) {
        var r = $('#g-log .type-rest');
        var p = r ? r.closest('p, li') : null;
        if (p !== cur) { if (cur) dur.push({ len: Array.from(cur.textContent).length, ms: performance.now() - t0 }); cur = p; t0 = performance.now(); }
        await wait(5);
      }
      if (cur) dur.push({ len: Array.from(cur.textContent).length, ms: performance.now() - t0 });
      var maxMs = Math.max.apply(null, dur.map(function (d) { return d.ms; }).concat([0]));
      var shortOnes = dur.slice(1).filter(function (d) { return d.len >= 8 && d.len <= 40; });
      var perChar = shortOnes.map(function (d) { return d.ms / d.len; });
      ok(dur.length >= 3, '타자 효과로 나온 줄 ' + dur.length + '개');
      ok(maxMs <= 1700, '가장 긴 줄도 1.5초 안팎(' + Math.round(maxMs) + 'ms): ' + dur.map(function (d) { return d.len + '자 ' + Math.round(d.ms); }).join(' / '));
      ok(perChar.length && perChar.every(function (x) { return x >= 20 && x <= 45; }), '짧은 줄은 글자당 25~35ms 안팎: ' + perChar.map(function (x) { return x.toFixed(1); }).join(','));
      // 4) 화면 읽기: 다 쳐진 메시지만, 메시지마다 한 번
      var lives = $$('#g-live p').map(function (q) { return q.textContent; }), lis = realLis();
      ok(!$('#g-log').hasAttribute('aria-live') && $('#g-live').getAttribute('aria-live') === 'polite', '한 글자씩 바뀌는 로그는 aria-live 아님, 따로 읽기 칸');
      ok(lives.length === lis.length, '읽히는 문장 수 = 메시지 수(한 번씩) ' + lives.length + '/' + lis.length);
      ok(lis.every(function (x, i) { var t = (x.querySelector('.bubble p') || x).textContent; return !!lives[i] && lives[i].indexOf(t) >= 0; }), '읽히는 문장은 완성된 전체 글자');
      ok(!lis.some(function (x) { return x.hasAttribute('aria-hidden'); }), '다 끝나면 숨긴 말풍선 없음');
      // 4-2) 아주 긴 줄(100자)도 1.5초에 끝남(글자당 시간을 줄임)
      var lb = document.createElement('p'), tS = performance.now(), tE = 0;
      PrivacyTyper.start(lb, new Array(101).join('가'), function () { tE = performance.now(); });
      gw = 0; while (!tE && gw++ < 400) await wait(10);
      ok(tE && tE - tS >= 1300 && tE - tS <= 1650 && lb.textContent.length === 100, '100자 줄도 약 1.5초(' + Math.round(tE - tS) + 'ms)');
      // 5) 선택 뒤 반응 줄도 같은 방식, 끝나면 계속 버튼
      $$('#g-dock .choice')[0].click();
      var sawR = false; gw = 0; while (!$('#btn-next') && gw++ < 2000) { if ($('#g-log .type-rest')) sawR = true; await wait(10); }
      ok(sawR && !!$('#btn-next') && !$('#g-log .type-rest'), '반응 줄도 주르륵 → 계속 버튼');
    }

    else if (s === 'typing-reduce' || s === 'typing-os-reduce') {
      var sawType = false, sawDots = false;
      new MutationObserver(function () { if (document.querySelector('.type-rest')) sawType = true; if (document.querySelector('#g-log li.typing')) sawDots = true; }).observe(document.body, { childList: true, subtree: true });
      ok(!PrivacyTyper.enabled(), '타자 효과 꺼짐(' + (s === 'typing-reduce' ? '게임 메뉴 움직임 줄이기' : '기기 동작 줄이기') + ')');
      $('#btn-new').click(); await wait(30);
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(30);
      ok(!$('#talk').hidden && !PrivacyTalk.typing() && !$('#talk .type-rest') && /\S/.test($('#talk .talk-live').textContent), '대화창 줄이 바로 다 보이고 한 번 읽힘');
      await passTalk();
      var gw = 0; while (!$$('#g-dock .choice').length && gw++ < 3000) await wait(10);
      ok($$('#g-dock .choice').length === 3, '선택지까지 진행');
      ok(!sawType && !sawDots, '한 글자씩·입력 중 표시 없이 메시지가 통째로');
      ok($$('#g-live p').length === $$('#g-log li').length, '메시지마다 한 번 읽힘 ' + $$('#g-live p').length + '/' + $$('#g-log li').length);
    }

    else if (s.indexOf('shot-') === 0) { // 스크린샷용: 특정 지점까지 진행 후 멈춤(결과 출력 없음)
      if (s === 'shot-yard-overview') { // 학교 부지 전체를 게임 렌더러로 축소해 그림(플레이 화면 아님)
        var gw = 0; while (!(window.PrivacySchoolyard && PrivacySchoolyard.ready()) && gw++ < 100) await wait(50);
        var WDo = window.PRIVACY_WORLD, t = 26, cv = document.createElement('canvas');
        cv.width = 23 * t; cv.height = WDo.H * t;
        cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99;background:#eee;height:100vh;width:auto';
        var g2 = cv.getContext('2d'), cam0 = { x: 0, y: 0 };
        for (var yy = 11; yy < WDo.H; yy++) for (var xx = 1; xx < 22; xx++) PrivacySchoolyard.drawCell(g2, WDo.grid[yy][xx], xx, yy, t, cam0);
        WDo.OBJECTS.filter(function (o) { return ['store', 'tent1', 'tent2', 'yardGoalLeft', 'yardGoalRight'].indexOf(o.id) >= 0; }).forEach(function (o) { PrivacySchoolyard.object(g2, o, t, cam0); });
        document.body.appendChild(cv); await wait(300); return;
      }
      if (s === 'shot-warning') { $('#btn-new').click(); await wait(1200); return; } // 시작 직후 주의 화면
      if (s === 'shot-chat-a' || s === 'shot-chat-b' || s === 'shot-chat-c') { // 채팅 장면(한 번에 보기): 민준 DM · 하늘 DM(캡처) · 신상 스토리
        $('#btn-new').click(); await play(R.D, { upto: { 'shot-chat-a': 5, 'shot-chat-b': 7, 'shot-chat-c': 21 }[s] }); await wait(600); return;
      }
      if (s === 'shot-chat-dots' || s === 'shot-chat-typing') { // 단톡 타자 효과를 멈춰 찍기: '입력 중…' / 글자 반쯤
        $('#btn-new').click(); await wait(30);
        $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk();
        var gq = 0;
        while (gq++ < 3000) {
          var tr = $('#g-log .type-rest');
          // 입력 중: 세 줄이 다 보인 뒤 쉬는 사이에 멈추면, 이미 걸린 타이머가 '입력 중…'을 띄우고 거기서 선다
          if (s === 'shot-chat-dots' && realLis().length >= 3 && !tr && !$('#g-log li.typing')) break;
          // 글자 반쯤: 네 번째 줄 이후, 남은 글자가 15자 넘게 있을 때(0.3초 더 기다려 나타나는 움직임이 끝나게)
          if (s === 'shot-chat-typing' && tr && realLis().length >= 4 && tr.textContent.length > 15) { await wait(300); break; }
          await wait(5);
        }
        window.setTimeout = function () { return 0; }; // 새 타이머를 막아 이 순간에서 찍는다
        return;
      }
      if (s === 'shot-photo') { $('#btn-new').click(); await play(R.A, { upto: 4 }); await wait(600); return; } // 하늘 DM의 흐린 사진
      if (s === 'shot-start-noname') { await wait(300); return; } // 공통 정보 없는 시작 화면(이름 입력칸)
      if (/^shot-marks-/.test(s)) { // 지도 표시(목적지 핀·? 말풍선) 확인용: 그 자리로 순간이동
        $('#btn-new').click(); await wait(300);
        var MW = window.PRIVACY_WORLD, MD = PrivacyMap.debug, sox = function (id) { return MW.SCENES.filter(function (c) { return c.id === id; })[0].ox; };
        if (s === 'shot-marks-sleep') await play(R.A, { upto: 3, stopAtMap: true }); // 사건 2: 엎드려 자는 민준
        if (s === 'shot-marks-library') await play(R.A, { upto: 10, stopAtMap: true }); // 사건 6: 도서관 공용 PC
        var spot = { 'shot-marks-yard': ['yard', 14, 9, 'left'], 'shot-marks-class': ['classroom', 15, 13, 'up'], 'shot-marks-sleep': ['classroom', 22, 14, 'right'], 'shot-marks-library': ['library', 16, 11, 'up'], 'shot-marks-room': ['room', 12, 12, 'down'] }[s];
        if (spot) MD.place(sox(spot[0]) + spot[1], spot[2], spot[3]);
        await wait(600); return;
      }
      if (/^shot-nf-/.test(s)) { // 렌즈 안에 갇힌 밤: 대치(선택지) · 촬영(REC) · 교실 반응(선택지)
        var nr = nfRoute(R, NF_FIGHT);
        $('#btn-new').click();
        await play(nr, { upto: s === 'shot-nf-class' ? 15 : 14 });
        if (s === 'shot-nf-rec') {
          PrivacyApp.setSpeed('normal');
          $$('#g-dock .choice').filter(function (b) { return b.getAttribute('data-choice') === 'fight'; })[0].click();
          await wait(50); await passTalk(); $('#btn-next').click(); await wait(300);
          var gs = 0; while (PrivacyApp.staging() && gs++ < 100) await wait(50);
          $('#btn-talk-next').click();
        }
        await wait(1200);
        return;
      }
      if (s === 'shot-map' || s === 'shot-road') {
        $('#btn-new').click();
        await play(R.A, { upto: s === 'shot-map' ? 1 : 5, stopAtMap: true });
        if (s === 'shot-road') {
          var rt = PrivacyMap.debug.route().slice(0, 30);
          for (var q = 0; q < rt.length; q++) { key(ARROW[rt[q]]); key(ARROW[rt[q]], 'keyup'); await wait(16); while (PrivacyMap.debug.me().moving) await wait(16); }
        } else { $('#btn-map-skip').click(); }
        await wait(300);
        return;
      }
      if (s === 'shot-portrait') { $('#btn-new').click(); await wait(30); PrivacyApp.setSpeed('normal'); $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(400); return; }
      if (s === 'shot-opening') { $('#btn-new').click(); await wait(500); return; }
      if (s === 'shot-talk') { $('#btn-new').click(); await play(R.A, { upto: 1, stopAtMap: true }); var pd = PrivacyMap.debug.tileToClient(8, 2); $('#m-canvas').dispatchEvent(new PointerEvent('pointerdown', { clientX: pd.x, clientY: pd.y, bubbles: true })); await wait(1500); return; }
      if (s === 'shot-hood' || s === 'shot-gate' || s === 'shot-south' || s === 'shot-edge' || s === 'shot-front' || s === 'shot-house' || s === 'shot-yard' || s === 'shot-booth') { // 주택가·교문 화면 확인용: 그 자리까지 걸어감
        $('#btn-new').click(); await play(R.A, { upto: 1, stopAtMap: true });
        var dest = { 'shot-hood': [40, 20], 'shot-gate': [16, 16], 'shot-south': [21, 18], 'shot-edge': [53, 21], 'shot-front': [12, 14], 'shot-house': [34, 19], 'shot-yard': [7, 20], 'shot-booth': [9, 20] }[s]; // 2026-10-31 56×23 지도
        var rr = PrivacyMap.debug.routeTo(dest[0], dest[1]) || [];
        for (var q = 0; q < rr.length; q++) { key(ARROW[rr[q]]); key(ARROW[rr[q]], 'keyup'); await wait(16); while (PrivacyMap.debug.me().moving) await wait(16); }
        await wait(500); return;
      }
      if (s === 'shot-chapter') { $('#btn-new').click(); await play(R.A, { stopAtChapter: 6 }); await wait(500); $('#c-summary .change-grid').scrollIntoView({ block: 'center' }); return; }
      var stop = { 'shot-start': -1, 'shot-game': 9, 'shot-react': 9, 'shot-ending': null, 'shot-path': null }[s];
      if (stop === -1) return;
      $('#btn-new').click();
      await play(R.D, stop == null ? {} : { upto: stop });
      if (s === 'shot-react') { $$('#g-dock .choice')[1].click(); await wait(); }
      if (s === 'shot-path') { $('#btn-end-path').click(); }
      window.scrollTo(0, 0);
      return;
    }

    out();
  }
  run().catch(function (e) { fail.push('프로브 예외: ' + e.message + ' ' + e.stack); out(); });
})();
