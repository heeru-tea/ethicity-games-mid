/*
 * 운행 화면 — 엔진 결과를 1배속(120초)·2배속(60초)·4배속(30초)으로 재생한다. 엔진 결과는 출발할 때 이미 계산되어
 * 배속은 재생 속도만 바꾼다(수송·대기·비용·인물 판정은 같다). 고른 배속은 이 브라우저에 기억한다.
 * 빨리 지나가도 읽을 수 있게 ‘지금 운행 상황’(도착·대기·노선 없음·만차·주요 인물)을 분마다 갱신하고,
 * 지나간 소식은 운행 소식 목록과 결과 화면의 ‘운행 기록’에 남긴다. 사건마다 멈추거나 모달을 띄우지 않는다.
 * 헤드리스·저사양에서 rAF가 드물게 돌아도 멈추지 않도록 rAF + 50ms 타이머로 함께 구동한다.
 */
(function (root) {
  'use strict';
  var PB = root.PB, cfg = PB.config, D = PB.Demand;
  var UI = PB.UI = PB.UI || {};
  var $ = function (s) { return document.querySelector(s); };
  var W = cfg.bus.window;
  var SPEEDS = [1, 2, 4];
  var R = null; // 재생 상태

  function app() { return PB.App; }
  function el(t, a, x) { return app().el(t, a, x); }

  // 정류장별·초별 대기 인원(최초 대기 + 환승 대기). 노선이 없어 떠나지 못한 요청은 ‘대기’로 세지 않는다
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
      if (p.fail === 'NO_LINK') return;
      var b = boards[p.id] || [];
      add(p.o, p.t, b.length ? b[0] : W + 1);
      var al = alights[p.id];
      if (al) add(al.node, al.t + cfg.bus.transferMin, b.length > 1 ? b[1] : W + 1);
    });
    var out = {};
    Object.keys(diff).forEach(function (n) { var run = 0; out[n] = diff[n].map(function (d) { run += d; return run; }); });
    return out;
  }

  // 운행 소식(사건·청원·만차·주민 말). 운행 화면과 결과 화면의 ‘운행 기록’이 같은 목록을 쓴다
  function runFeed(s) {
    var res = s.current.result, c = s.config, items = [], ev = s.current.event;
    res.log.forEach(function (e) {
      if (e.type === 'event' && e.data.type === 'demand') {
        var od = D.directional(c, s.phase)[ev.odIndex];
        items.push({ t: e.t, cls: 'event', text: app().clock(e.t) + ' · 갑자기 ' + app().nodeName(od.o) + '에서 ' + PB.Narrative.josa(app().nodeName(od.d), '으로') + ' 가려는 사람이 늘었어요(' + app().duration(c.events.extraMinutes) + ' 동안 12명).' });
      }
      if (e.type === 'petition') {
        var complaint = '우리 동네에서 출발한 ' + e.data.count + '명이 아직 도착하지 못했어요.';
        items.push({ t: e.t, cls: 'event', node: e.node, bubble: { kind: 'petition', text: complaint }, text: app().clock(e.t) + ' · ' + app().nodeName(e.node) + ' 주민 청원: “' + complaint + '”' });
      }
    });
    var fullSeen = {};
    res.log.forEach(function (e) {
      if (e.type !== 'full' || fullSeen[e.node]) return;
      fullSeen[e.node] = true;
      var complaint = e.bus + '호차가 만차라 ' + e.data.left + '명이 못 탔어요. 다음 버스를 기다려요.';
      items.push({ t: e.t, cls: 'full', node: e.node, bubble: { kind: 'full', text: complaint }, text: app().clock(e.t) + ' · ' + app().nodeName(e.node) + '에서 ' + complaint });
    });
    PB.Narrative.bubbles(res, c, W).forEach(function (b) {
      if (b.kind === 'full') return; // 만차는 위의 실제 로그(남은 인원)로 보여 준다
      var who = b.residentId ? c.residents.filter(function (r) { return r.id === b.residentId; })[0].name : '주민';
      items.push({ t: b.t, cls: b.residentId ? 'resident' : 'bubble', node: b.node, bubble: b, text: app().clock(b.t) + ' · ' + who + '(' + app().nodeName(b.node) + '): “' + b.text + '”' });
    });
    return items.sort(function (a, b) { return a.t - b.t; });
  }
  UI.runFeed = runFeed;

  // 주요 인물의 이동 상태(그 시각까지의 로그만). 한 인물은 첫 이동과(도착하면 생기는) 다음 이동 두 건
  function residentStates(s, m) {
    var res = s.current.result, out = [];
    PB.Demand.residents(s.config, s.phase).forEach(function (rd) {
      var legs = res.passengers.filter(function (p) { return p.residentId === rd.id; }).sort(function (a, b) { return a.t - b.t; });
      var first = legs[0], now = null;
      legs.forEach(function (p) { if (p.t <= m) now = p; });
      var text;
      if (!first) text = '오늘 일정 없음';
      else if (!now) text = app().clock(first.t) + ' ' + app().nodeName(first.o) + '에서 출발 예정';
      else text = legState(now, m, rd);
      out.push({ id: rd.id, name: rd.name, text: text, done: legs.length >= 2 && legs[1].arriveT != null && legs[1].arriveT <= m });
    });
    return out;
  }
  function legState(p, m, rd) {
    var dest = app().nodeName(p.d), where = p.leg === 'return' ? '다음 이동' : '첫 이동';
    if (p.fail === 'NO_LINK') return where + ' — ' + app().nodeName(p.o) + '→' + dest + ' 잇는 노선이 없어 떠나지 못함';
    if (p.fail === 'NO_TRIP_IN_WINDOW') return where + ' — 운행 시간 안에 탈 수 있는 버스가 없음';
    if (p.arriveT != null && p.arriveT <= m) return dest + ' 도착 ' + app().clock(p.arriveT) + (p.leg === 'return' ? ' · 일정 끝' : ' · 볼일 뒤 다음 이동');
    var boards = R.boardsByPid[p.id] || [], boarded = boards.filter(function (t) { return t <= m; });
    var onBus = R.onBusAt(p.id, m);
    if (onBus) return PB.Narrative.josa(dest, '으로') + ' 가는 버스 안' + (boarded.length > 1 ? ' · 갈아탄 뒤' : '');
    if (boarded.length) return '갈아탈 버스를 기다리는 중';
    return app().nodeName(p.o) + '에서 기다리는 중 · ' + app().duration(m - p.t) + '째';
  }

  function start(App) {
    var s = App.s;
    cfg = s.config;
    R = { phase: s.phase, s: s, acc: 0, speed: App.speed || 1, last: null, minute: -1, done: false, shown: 0, lastBubbleAt: {} };
    R.res = s.current.result;
    R.wait = waitingTable(R.res);
    R.items = runFeed(s);
    R.chimeAt = {};
    R.res.log.forEach(function (e) {
      if (e.type === 'event' || e.type === 'petition') R.chimeAt[e.t] = true;
    });
    R.items.forEach(function (it) { if (it.cls === 'resident' && it.bubble.kind === 'arrive') R.chimeAt[it.t] = true; });
    // 정류장에 승객이 생기는 시각(분 단위): 인원 수와 주요 인물 여부
    var who = {}, byId = {}; R.res.passengers.forEach(function (p) { who[p.id] = p.residentId; byId[p.id] = p; });
    R.byId = byId;
    R.reqAt = {}; R.lastPop = 0;
    R.res.log.forEach(function (e) { if (e.type !== 'request') return; var k = Math.floor(e.t), q = R.reqAt[k] = R.reqAt[k] || { n: 0, resident: false }; q.n++; if (who[e.pid]) q.resident = true; });
    // 승객별 승하차 시각(주요 인물 상태용)
    R.boardsByPid = {}; var offs = {};
    R.res.log.forEach(function (e) {
      if (e.type === 'board') (R.boardsByPid[e.pid] = R.boardsByPid[e.pid] || []).push(e.t);
      if (e.type === 'alight' || e.type === 'arrive') (offs[e.pid] = offs[e.pid] || []).push(e.t);
    });
    // 주요 인물의 탑승 구간(승차 시각·버스 → 다음 하차 시각)
    var rname = {}; s.config.residents.forEach(function (r) { rname[r.id] = r.name; });
    R.residentRides = []; var open = {};
    R.res.log.forEach(function (e) {
      var p = e.pid != null ? byId[e.pid] : null; if (!p || !p.residentId) return;
      if (e.type === 'board') { open[e.pid] = { name: rname[p.residentId], bus: e.bus, on: e.t, off: null }; R.residentRides.push(open[e.pid]); }
      if ((e.type === 'alight' || e.type === 'arrive') && open[e.pid]) { open[e.pid].off = e.t; open[e.pid] = null; }
    });
    R.onBusAt = function (pid, m) { var on = (R.boardsByPid[pid] || []).filter(function (t) { return t <= m; }).length, off = (offs[pid] || []).filter(function (t) { return t <= m; }).length; return on > off; };
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
    if (document.hidden || R.paused) return;
    R.acc += Math.min(dt, 250) * R.speed;
    var App = app(), tf = Math.min(W, R.acc / App.msPerMinute());
    var m = Math.floor(tf);
    drawBuses(App, App.reducedMotion() ? m : tf);
    if (m !== R.minute) {
      // 차임 > 주요 인물 등장 > 일반 승객 '톡'(0.45초에 한 번까지) 순으로 한 번만 울린다
      var chimed = false, people = 0, resident = false;
      for (var k = R.minute + 1; k <= m; k++) { if (R.chimeAt[k]) chimed = true; var q = R.reqAt[k]; if (q) { people += q.n; resident = resident || q.resident; } }
      if (chimed) App.chime();
      else if (resident) App.sfx('resident');
      else if (people && now - R.lastPop > 450) { R.lastPop = now; App.sfx('person'); }
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

  // 버스별로 지금 타고 있는 주요 인물 이름(특수 캐릭터) — 버스 위 말풍선에 [하늘]처럼 띄운다
  function namesOnBus(m) {
    var out = {};
    R.residentRides.forEach(function (x) { if (x.on <= m && (x.off == null || x.off > m)) (out[x.bus] = out[x.bus] || []).push(x.name); });
    return out;
  }
  function drawBuses(App, t) {
    var v = App.view;
    var counts = PB.Sim.occupancyAt(R.res, Math.floor(t)), names = namesOnBus(Math.floor(t));
    v.setBuses(R.res.timelines.map(function (tl) {
      var pos = PB.Schedule.positionAt(tl, cfg, t), num = tl.route ? App.numForPlanRoute(tl.route) : null;
      var color = num ? App.routeStyle(num).color : '#6B7280';
      if (pos.node) {
        var p = App.nodeXY(pos.node);
        var parked = pos.parked;
        return { id: tl.busId, x: p.x, y: p.y, dx: parked ? -30 : 0, dy: parked ? -24 - (tl.busId - 1) * 21 : -2, color: color, num: num, riders: counts[tl.busId], names: names[tl.busId] || [], express: cfg.challengeApplied && tl.busId === 7, regional: cfg.challengeApplied && tl.busId === 9 };
      }
      var a = App.nodeXY(pos.from), b = App.nodeXY(pos.to), lane = v.laneOffset ? v.laneOffset(pos.from, pos.to, num) : { dx: 0, dy: 0 };
      return { id: tl.busId, x: a.x + (b.x - a.x) * pos.f, y: a.y + (b.y - a.y) * pos.f, dx: lane.dx, dy: lane.dy, color: color, num: num, riders: counts[tl.busId], names: names[tl.busId] || [], express: cfg.challengeApplied && tl.busId === 7, regional: cfg.challengeApplied && tl.busId === 9 };
    }));
  }

  // ‘지금 운행 상황’ — 그 분까지의 로그로 센다(엔진이 이미 계산한 결과를 시간순으로 보여 줄 뿐)
  function liveCounts(m) {
    var c = { requests: 0, arrived: 0, noLink: 0, fulls: 0, left: 0 };
    R.res.log.forEach(function (e) {
      if (e.t > m) return;
      if (e.type === 'request') { c.requests++; if (R.byId[e.pid] && R.byId[e.pid].fail === 'NO_LINK') c.noLink++; }
      if (e.type === 'arrive') c.arrived++;
      if (e.type === 'full') { c.fulls++; c.left += e.data.left; }
    });
    var occ = PB.Sim.occupancyAt(R.res, m); c.riding = Object.keys(occ).reduce(function (a, k) { return a + occ[k]; }, 0);
    c.waiting = 0; var top = null;
    Object.keys(R.wait).forEach(function (n) { var w = R.wait[n][m] || 0; c.waiting += w; if (w && (!top || w > top.n)) top = { node: n, n: w }; });
    c.top = top;
    return c;
  }
  function renderLive(m) {
    var box = $('#run-live'); if (!box) return;
    var c = liveCounts(m), rows = [
      ['생긴 이동 요청', c.requests + '건'], ['목적지 도착', c.arrived + '건'],
      ['지금 버스 안', c.riding + '명'], ['지금 정류장 대기', c.waiting + '명' + (c.top ? ' · 가장 많은 곳 ' + app().nodeName(c.top.node) + ' ' + c.top.n + '명' : '')],
      ['노선이 없어 떠나지 못함', c.noLink + '건'], ['만차로 남겨짐', c.fulls ? c.fulls + '번 · ' + c.left + '명' : '없음']
    ];
    var dl = box.querySelector('dl'); dl.textContent = '';
    rows.forEach(function (r) { dl.appendChild(el('dt', null, r[0])); dl.appendChild(el('dd', null, r[1])); });
    var ul = box.querySelector('#run-residents'); ul.textContent = '';
    residentStates(R.s, m).forEach(function (r) { ul.appendChild(el('li', { 'data-resident': r.id, 'class': r.done ? 'done' : '' }, r.name + ' · ' + r.text)); });
  }

  function onMinute(App, m) {
    App.updateClock(m);
    var counts = {};
    Object.keys(R.wait).forEach(function (n) { counts[n] = R.wait[n][m]; });
    App.view.setWaiting(counts);
    renderLive(m);
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
    var important = it.bubble.kind === 'full' || it.bubble.kind === 'petition';
    if (!important && R.lastBubbleAt[it.node] != null && it.t - R.lastBubbleAt[it.node] < 8) return;
    R.lastBubbleAt[it.node] = it.t;
    var old = layer.querySelector('.bubble[data-node="' + it.node + '"]'); if (old) old.remove();
    while (layer.querySelectorAll('.bubble').length >= 2) layer.querySelector('.bubble').remove();
    var xy = App.nodeXY(it.node), p = App.view.project(xy.x, xy.y);
    var who = it.bubble.residentId ? cfg.residents.filter(function (r) { return r.id === it.bubble.residentId; })[0].name : '';
    var b = el('div', { 'class': 'bubble' });
    b.dataset.node = it.node; b.dataset.kind = it.bubble.kind;
    var issue = { noLink: '노선 없음', full: '만차', wait: '긴 기다림', petition: '주민 민원' }[it.bubble.kind];
    if (issue) b.appendChild(el('b', { 'class': 'bubble-issue' }, issue + ' · '));
    if (who) b.appendChild(el('b', null, who + ' '));
    b.appendChild(document.createTextNode(it.bubble.text));
    b.style.left = Math.max(115, Math.min(layer.clientWidth - 115, p.left)) + 'px'; b.style.top = Math.max(100, p.top) + 'px';
    layer.appendChild(b);
    // 배속이 빨라도 말풍선은 같은 실제 시간(4.5초) 동안 남는다
    root.setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 4500);
  }

  function setSpeed(speed) {
    app().setSpeed(speed);
    if (R && !R.done) R.speed = speed;
    SPEEDS.forEach(function (n) { var b = $('#speed-' + n); if (b) b.setAttribute('aria-pressed', String(n === speed)); });
    if (R && R.paused) $('#run-status').textContent = '일시정지 중 · 재개하면 ' + speed + '배속으로 이어져요.';
  }

  UI.run = function (App, panel) {
    var s = App.s;
    cfg = s.config;
    panel.appendChild(el('p', { 'class': 'eyebrow' }, s.phase + '단계 · ' + cfg.phases[s.phase - 1] + ' — 운행'));
    panel.appendChild(el('h2', null, '버스가 달리고 있어요'));
    var speeds = $('#run-controls'); speeds.textContent = '';
    var paused = R && R.s === s && R.phase === s.phase && !R.done && R.paused;
    // 좁은 화면에서는 아이콘만 보이도록 글자를 따로 감싼다(이름은 aria-label로 유지)
    function iconLabel(b, icon, text) { b.textContent = ''; b.appendChild(el('span', { 'aria-hidden': 'true' }, icon + ' ')); b.appendChild(el('span', { 'class': 'btn-text' }, text)); b.setAttribute('aria-label', text); return b; }
    speeds.appendChild(iconLabel(el('button', { type: 'button', id: 'run-pause', 'class': 'btn', 'aria-pressed': String(!!paused), onclick: function () {
      tick(); if (!R || R.done || R.finishing) return; R.paused = !R.paused; R.last = root.performance.now();
      iconLabel(this, R.paused ? '▶' : '⏸', R.paused ? '재개' : '일시정지'); this.setAttribute('aria-pressed', String(R.paused));
      $('#run-status').textContent = R.paused ? '일시정지 중 · 재개하면 ' + R.speed + '배속으로 이어져요.' : '운행 중';
    } }), paused ? '▶' : '⏸', paused ? '재개' : '일시정지'));
    SPEEDS.forEach(function (speed) {
      var b = el('button', { type: 'button', id: 'speed-' + speed, 'class': 'btn', 'aria-pressed': String((App.speed || 1) === speed), title: '하루를 ' + (120 / speed) + '초에 보기', onclick: function () { tick(); setSpeed(speed); } }, speed + '×');
      speeds.appendChild(b);
    });
    speeds.appendChild(iconLabel(el('button', { type: 'button', id: 'run-sound', 'class': 'btn', 'aria-pressed': String(App.sound), title: '효과음 켜기/끄기', onclick: function () { App.setSound(!App.sound); if (App.sound) App.sfx('person'); } }), App.sound ? '🔊' : '🔇', '소리'));
    panel.appendChild(el('p', { id: 'run-status', 'class': 'h-small', role: 'status' }, '운행 시작'));
    var live = el('section', { id: 'run-live', 'aria-labelledby': 'run-live-h' });
    live.appendChild(el('h3', { id: 'run-live-h' }, '지금 운행 상황'));
    live.appendChild(el('dl', { 'class': 'kv run-counts' }));
    live.appendChild(el('h4', null, '주요 인물'));
    live.appendChild(el('ul', { id: 'run-residents', 'class': 'plain run-residents' }));
    panel.appendChild(live);
    panel.appendChild(el('h3', null, '운행 소식'));
    panel.appendChild(el('ul', { id: 'run-feed', 'class': 'feed', 'aria-live': 'polite' }));
    panel.appendChild(el('p', { 'class': 'note' }, '일반 버스 정원은 ' + cfg.bus.capacity + '명이에요.' + (s.config.challengeApplied && s.phase >= 6 ? ' 7호차 직행버스는 정원 18명·주행 속도 1.5배예요.' : '') + (s.config.challengeApplied && s.phase >= 8 ? ' 9호차 광역버스는 정원 24명이에요.' : '') + ' 운행 중에는 노선과 배차를 바꿀 수 없어요. 배속은 보는 속도만 바꾸고 결과는 같아요. 지나간 소식은 결과 화면의 ‘운행 기록’에서 다시 볼 수 있어요.'));
    panel.appendChild(el('p', { id: 'node-info', 'class': 'note', 'aria-live': 'polite' }));
    App.onNodeClick = function (id) {
      var n = R && R.wait[id] ? R.wait[id][Math.max(0, R.minute)] : 0;
      $('#node-info').textContent = App.nodeName(id) + ' 정류장: 지금 기다리는 사람 ' + (n || 0) + '명';
    };
    if (!R || R.phase !== s.phase || R.s !== s || R.done) { stop(); start(App); }
    else if (R.minute >= 0) { renderLive(R.minute); R.shown = 0; while (R.shown < R.items.length && R.items[R.shown].t <= R.minute) { var it = R.items[R.shown++]; $('#run-feed').insertBefore(el('li', { 'class': 'feed-' + it.cls }, it.text), $('#run-feed').firstChild); } }
    return { keepBuses: true };
  };
  UI.stopRun = stop;

  document.addEventListener('visibilitychange', function () { if (R && !document.hidden) R.last = root.performance.now(); });
})(window);
