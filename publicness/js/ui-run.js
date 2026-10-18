/*
 * 운행 화면 — 엔진이 미리 계산한 결과 로그를 약 60초 동안 재생만 한다(재생 속도는 결과를 바꾸지 않는다).
 * 일시정지·편집은 없다. 탭이 숨으면 화면 진행만 멈췄다가 돌아오면 같은 시각에서 이어 간다.
 * 헤드리스·저사양에서 rAF가 드물게 돌아도 멈추지 않도록 rAF + 50ms 타이머로 함께 구동한다.
 */
(function (root) {
  'use strict';
  var PB = root.PB, cfg = PB.config, D = PB.Demand;
  var UI = PB.UI = PB.UI || {};
  var $ = function (s) { return document.querySelector(s); };
  var W = cfg.bus.window;
  var R = null; // 재생 상태

  function app() { return PB.App; }
  function el(t, a, x) { return app().el(t, a, x); }

  // 정류장별·분별 대기 인원(최초 대기 + 환승 대기)
  function waitingTable(result) {
    var diff = {};
    function add(node, a, b) {
      var arr = diff[node] = diff[node] || new Array(W + 2).fill(0);
      a = Math.max(0, a); b = Math.min(W + 1, b);
      if (a >= b) return;
      arr[a]++; arr[b]--;
    }
    var boards = {};
    result.log.forEach(function (e) { if (e.type === 'board') (boards[e.pid] = boards[e.pid] || []).push(e.t); });
    var alights = {};
    result.log.forEach(function (e) { if (e.type === 'alight') alights[e.pid] = e; });
    result.passengers.forEach(function (p) {
      var b = boards[p.id] || [];
      add(p.o, p.t, b.length ? b[0] : W + 1);
      var al = alights[p.id];
      if (al) add(al.node, al.t + cfg.bus.transferMin, b.length > 1 ? b[1] : W + 1);
    });
    var out = {};
    Object.keys(diff).forEach(function (n) { var run = 0; out[n] = diff[n].map(function (d) { run += d; return run; }); });
    return out;
  }

  function feedItems(s) {
    var res = s.current.result, items = [], ev = s.current.event;
    res.log.forEach(function (e) {
      if (e.type === 'event' && e.data.type === 'demand') {
        var od = D.directional(cfg, s.phase)[ev.odIndex];
        items.push({ t: e.t, cls: 'event', text: e.t + '분 · 갑자기 ' + app().nodeName(od.o) + '에서 ' + app().nodeName(od.d) + '(으)로 가려는 사람이 늘었어요(6분 동안 12명).' });
      }
      if (e.type === 'petition') {
        items.push({ t: e.t, cls: 'event', node: e.node, text: e.t + '분 · ' + app().nodeName(e.node) + ' 주민 청원: “현재 우리 지역 요청 중 ' + e.data.count + '명이 아직 도착하지 못했어요.”' });
      }
    });
    var fullSeen = {};
    res.log.forEach(function (e) {
      if (e.type !== 'full' || fullSeen[e.node]) return;
      fullSeen[e.node] = true;
      items.push({ t: e.t, cls: 'full', node: e.node, text: e.t + '분 · ' + app().nodeName(e.node) + '에서 버스가 꽉 차 ' + e.data.left + '명이 다음 버스를 기다려요.' });
    });
    R.bubbles.forEach(function (b) {
      var who = b.residentId ? cfg.residents.filter(function (r) { return r.id === b.residentId; })[0].name : '주민';
      items.push({ t: b.t, cls: 'bubble', node: b.node, bubble: b, text: b.t + '분 · ' + who + '(' + app().nodeName(b.node) + '): “' + b.text + '”' });
    });
    return items.sort(function (a, b) { return a.t - b.t; });
  }

  function start(App) {
    var s = App.s;
    R = { phase: s.phase, s: s, acc: 0, last: null, minute: -1, done: false, shown: 0 };
    R.res = s.current.result;
    R.wait = waitingTable(R.res);
    R.bubbles = PB.Narrative.bubbles(R.res, cfg, W);
    R.items = feedItems(s);
    R.chimeAt = {};
    R.res.log.forEach(function (e) {
      if (e.type === 'event' || e.type === 'petition') R.chimeAt[e.t] = true;
    });
    R.bubbles.forEach(function (b) { if (b.residentId && b.kind === 'arrive') R.chimeAt[b.t] = true; });
    R.timer = root.setInterval(tick, 50);
    (function loop() { if (!R || R.done) return; tick(); R.raf = root.requestAnimationFrame(loop); })();
  }

  function stop() {
    if (!R) return;
    root.clearInterval(R.timer);
    if (R.raf) root.cancelAnimationFrame(R.raf);
    R.done = true;
  }

  function tick() {
    if (!R || R.done) return;
    var now = root.performance.now();
    if (R.last == null) R.last = now;
    var dt = now - R.last;
    R.last = now;
    if (document.hidden) return;
    R.acc += Math.min(dt, 250);
    var App = app(), tf = Math.min(W, R.acc / App.msPerMinute());
    var m = Math.floor(tf);
    drawBuses(App, App.reducedMotion() ? m : tf);
    if (m !== R.minute) {
      for (var k = R.minute + 1; k <= m; k++) if (R.chimeAt[k]) { App.chime(); break; }
      R.minute = m;
      onMinute(App, m);
    }
    if (tf >= W && !R.finishing) {
      R.finishing = true;
      var st = $('#run-status');
      if (st) st.textContent = '운행이 끝났습니다.';
      root.setTimeout(function () {
        stop();
        if (App.s === R.s && App.s.stage === 'run') { PB.Session.finishRun(App.s); App.go('result'); }
      }, root.__pbFast ? 30 : 1000);
    }
  }

  function drawBuses(App, t) {
    var v = App.view;
    v.setBuses(R.res.timelines.map(function (tl) {
      var pos = PB.Schedule.positionAt(tl, cfg, t), num = tl.route ? App.numForPlanRoute(tl.route) : null;
      var color = num ? App.routeStyle(num).color : '#6B7280';
      if (pos.node) {
        var p = App.nodeXY(pos.node);
        var parked = pos.parked;
        return { id: tl.busId, x: p.x, y: p.y, dx: parked ? -30 : 0, dy: parked ? -24 - (tl.busId - 1) * 21 : -2, color: color, num: num };
      }
      var a = App.nodeXY(pos.from), b = App.nodeXY(pos.to), lane = v.laneOffset ? v.laneOffset(pos.from, pos.to, num) : { dx: 0, dy: 0 };
      return { id: tl.busId, x: a.x + (b.x - a.x) * pos.f, y: a.y + (b.y - a.y) * pos.f, dx: lane.dx, dy: lane.dy, color: color, num: num };
    }));
  }

  function onMinute(App, m) {
    $('#top-clock').textContent = m + '분 / ' + W + '분';
    var counts = {};
    Object.keys(R.wait).forEach(function (n) { counts[n] = R.wait[n][m]; });
    App.view.setWaiting(counts);
    var feed = $('#run-feed');
    while (R.shown < R.items.length && R.items[R.shown].t <= m) {
      var it = R.items[R.shown++];
      if (feed) feed.insertBefore(el('li', { 'class': 'feed-' + it.cls }, it.text), feed.firstChild);
      if (it.node) App.view.flash(it.node);
      if (it.bubble) showBubble(App, it);
    }
  }

  function showBubble(App, it) {
    var layer = $('#stage-overlay');
    if (!layer || !App.view.project) return;
    var xy = App.nodeXY(it.node), p = App.view.project(xy.x, xy.y);
    var who = it.bubble.residentId ? cfg.residents.filter(function (r) { return r.id === it.bubble.residentId; })[0].name : '';
    var b = el('div', { 'class': 'bubble' });
    if (who) b.appendChild(el('b', null, who + ' '));
    b.appendChild(document.createTextNode(it.bubble.text));
    b.style.left = p.left + 'px'; b.style.top = p.top + 'px';
    layer.appendChild(b);
    root.setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 3000);
  }

  UI.run = function (App, panel) {
    var s = App.s;
    panel.appendChild(el('p', { 'class': 'eyebrow' }, s.phase + '단계 · ' + cfg.phases[s.phase - 1] + ' — 운행'));
    panel.appendChild(el('h2', null, '버스가 달리고 있어요'));
    panel.appendChild(el('p', { 'class': 'note' }, '운행 중에는 노선과 배차를 바꿀 수 없어요. 결과를 보고 다음 단계에서 고쳐요. 지도의 정류장을 누르면 지금 기다리는 사람 수를 볼 수 있어요.'));
    panel.appendChild(el('p', { id: 'run-status', 'class': 'h-small', role: 'status' }, '운행 시작'));
    panel.appendChild(el('p', { id: 'node-info', 'class': 'note', 'aria-live': 'polite' }));
    panel.appendChild(el('h3', null, '운행 소식'));
    panel.appendChild(el('ul', { id: 'run-feed', 'class': 'feed', 'aria-live': 'polite' }));
    App.onNodeClick = function (id) {
      var n = R && R.wait[id] ? R.wait[id][Math.max(0, R.minute)] : 0;
      $('#node-info').textContent = App.nodeName(id) + ' 정류장: 지금 기다리는 사람 ' + (n || 0) + '명';
    };
    if (!R || R.phase !== s.phase || R.s !== s || R.done) { stop(); start(App); }
    return { keepBuses: true };
  };

  document.addEventListener('visibilitychange', function () { if (R && !document.hidden) R.last = root.performance.now(); });
})(window);
