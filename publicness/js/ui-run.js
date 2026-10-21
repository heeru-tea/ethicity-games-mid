/*
 * 운행 화면 — 엔진 결과를 1배속(120초) 또는 2배속(60초)으로 재생한다. 속도는 결과를 바꾸지 않는다.
 * 일시정지와 배속을 지원한다. 탭이 숨으면 화면 진행만 멈췄다가 돌아오면 같은 시각에서 이어 간다.
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

  // 정류장별·초별 대기 인원(최초 대기 + 환승 대기)
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
        items.push({ t: e.t, cls: 'event', text: app().clock(e.t) + ' · 갑자기 ' + app().nodeName(od.o) + '에서 ' + app().nodeName(od.d) + '(으)로 가려는 사람이 늘었어요('+app().duration(cfg.events.extraMinutes)+' 동안 12명).' });
      }
      if (e.type === 'petition') {
        var complaint='우리 동네에서 출발한 '+e.data.count+'명이 아직 도착하지 못했어요.';
        items.push({ t: e.t, cls: 'event', node: e.node, bubble:{kind:'petition',text:complaint}, text: app().clock(e.t) + ' · ' + app().nodeName(e.node) + ' 주민 청원: “'+complaint+'”' });
      }
    });
    var fullSeen = {};
    res.log.forEach(function (e) {
      if (e.type !== 'full' || fullSeen[e.node]) return;
      fullSeen[e.node] = true;
      var complaint=e.bus+'호차가 만차라 '+e.data.left+'명이 못 탔어요. 다음 버스를 기다려요.';
      items.push({ t: e.t, cls: 'full', node: e.node, bubble:{kind:'full',text:complaint}, text: app().clock(e.t) + ' · ' + app().nodeName(e.node) + '에서 '+complaint });
    });
    R.bubbles.forEach(function (b) {
      if(b.kind==='full')return; // Exact denied boarding counts are shown from the full log above.
      var who = b.residentId ? cfg.residents.filter(function (r) { return r.id === b.residentId; })[0].name : '주민';
      items.push({ t: b.t, cls: 'bubble', node: b.node, bubble: b, text: app().clock(b.t) + ' · ' + who + '(' + app().nodeName(b.node) + '): “' + b.text + '”' });
    });
    return items.sort(function (a, b) { return a.t - b.t; });
  }

  function start(App) {
    var s = App.s;
    cfg=s.config;
    R = { phase: s.phase, s: s, acc: 0, speed: 1, last: null, minute: -1, done: false, shown: 0, lastBubbleAt:{} };
    R.res = s.current.result;
    R.wait = waitingTable(R.res);
    R.bubbles = PB.Narrative.bubbles(R.res, s.config, W);
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
    if (document.hidden || R.paused) return;
    R.acc += Math.min(dt, 250) * R.speed;
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
    var counts=PB.Sim.occupancyAt(R.res,Math.floor(t));
    v.setBuses(R.res.timelines.map(function (tl) {
      var pos = PB.Schedule.positionAt(tl, cfg, t), num = tl.route ? App.numForPlanRoute(tl.route) : null;
      var color = num ? App.routeStyle(num).color : '#6B7280';
      if (pos.node) {
        var p = App.nodeXY(pos.node);
        var parked = pos.parked;
        return { id: tl.busId, x: p.x, y: p.y, dx: parked ? -30 : 0, dy: parked ? -24 - (tl.busId - 1) * 21 : -2, color: color, num: num,riders:counts[tl.busId],express:cfg.challengeApplied&&tl.busId===7,regional:cfg.challengeApplied&&tl.busId===9 };
      }
      var a = App.nodeXY(pos.from), b = App.nodeXY(pos.to), lane = v.laneOffset ? v.laneOffset(pos.from, pos.to, num) : { dx: 0, dy: 0 };
      return { id: tl.busId, x: a.x + (b.x - a.x) * pos.f, y: a.y + (b.y - a.y) * pos.f, dx: lane.dx, dy: lane.dy, color: color, num: num,riders:counts[tl.busId],express:cfg.challengeApplied&&tl.busId===7,regional:cfg.challengeApplied&&tl.busId===9 };
    }));
  }

  function onMinute(App, m) {
    App.updateClock(m);
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
    var important=it.bubble.kind==='full'||it.bubble.kind==='petition';
    if(!important&&R.lastBubbleAt[it.node]!=null&&it.t-R.lastBubbleAt[it.node]<8)return;
    R.lastBubbleAt[it.node]=it.t;
    var old=layer.querySelector('.bubble[data-node="'+it.node+'"]');if(old)old.remove();
    while(layer.querySelectorAll('.bubble').length>=2)layer.querySelector('.bubble').remove();
    var xy = App.nodeXY(it.node), p = App.view.project(xy.x, xy.y);
    var who = it.bubble.residentId ? cfg.residents.filter(function (r) { return r.id === it.bubble.residentId; })[0].name : '';
    var b = el('div', { 'class': 'bubble' });
    b.dataset.node=it.node;b.dataset.kind=it.bubble.kind;
    var issue={noLink:'노선 없음',full:'만차',wait:'긴 기다림',petition:'주민 민원'}[it.bubble.kind];
    if(issue)b.appendChild(el('b',{'class':'bubble-issue'},issue+' · '));
    if (who) b.appendChild(el('b', null, who + ' '));
    b.appendChild(document.createTextNode(it.bubble.text));
    b.style.left = Math.max(115,Math.min(layer.clientWidth-115,p.left)) + 'px'; b.style.top = Math.max(100,p.top) + 'px';
    layer.appendChild(b);
    root.setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 4500);
  }

  UI.run = function (App, panel) {
    var s = App.s;
    cfg=s.config;
    panel.appendChild(el('p', { 'class': 'eyebrow' }, s.phase + '단계 · ' + cfg.phases[s.phase - 1] + ' — 운행'));
    panel.appendChild(el('h2', null, '버스가 달리고 있어요'));
    panel.appendChild(el('p',{'class':'note'},'일반 버스 정원은 '+cfg.bus.capacity+'명이에요.'+(s.config.challengeApplied&&s.phase>=6?' 7호차 직행버스는 정원 18명·주행 속도 1.5배예요.':'')+(s.config.challengeApplied&&s.phase>=8?' 9호차 광역버스는 정원 24명이에요.':'')+' 출근·귀가처럼 승객이 몰리는 시간이 있어요. 만차면 남은 사람은 다음 버스를 기다려요.'));
    var speeds=$('#run-controls');speeds.textContent='';
    var paused=R&&R.s===s&&R.phase===s.phase&&!R.done&&R.paused;
    speeds.appendChild(el('button',{type:'button',id:'run-pause','class':'btn','aria-pressed':String(!!paused),onclick:function(){
      tick();if(!R||R.done||R.finishing)return;R.paused=!R.paused;R.last=root.performance.now();
      this.textContent=R.paused?'▶ 재개':'⏸ 일시정지';this.setAttribute('aria-pressed',String(R.paused));
      $('#run-status').textContent=R.paused?'일시정지 중 · 재개하면 '+R.speed+'배속으로 이어져요.':'운행 중';
    }},paused?'▶ 재개':'⏸ 일시정지'));
    [1,2].forEach(function(speed){var b=el('button',{type:'button',id:'speed-'+speed,'class':'btn','aria-pressed':String((R&&R.s===s&&R.phase===s.phase?R.speed:1)===speed),onclick:function(){
      tick();if(!R||R.done)return;R.speed=speed;
      [1,2].forEach(function(n){$('#speed-'+n).setAttribute('aria-pressed',String(n===speed));});
      if(R.paused)$('#run-status').textContent='일시정지 중 · 재개하면 '+R.speed+'배속으로 이어져요.';
    }},speed+'×');speeds.appendChild(b);});
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
