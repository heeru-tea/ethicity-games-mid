/*
 * 앱 — 화면 전환·상단 바·무대(지도) 동기화·대화 상자. 화면별 패널은 ui-*.js가 PB.UI에 등록한다.
 * 상태는 PB.Session 객체 하나(브라우저 메모리)뿐이다.
 */
(function (root) {
  'use strict';
  var PB = root.PB, cfg = PB.config, S = PB.Session;
  var $ = function (s) { return document.querySelector(s); };

  var COLORS = ['#D97706', '#059669', '#DC2626', '#7C3AED', '#0891B2', '#DB2777'];
  var COLOR_NAMES = ['주황', '초록', '빨강', '보라', '청록', '분홍'];
  var DASHES = ['', '14 5', '4 5', '14 4 3 4', '8 8', '2 4'];
  var DASH_NAMES = ['실선', '긴 점선', '짧은 점선', '점과 선', '중간 점선', '촘촘한 점선'];

  var App = {
    s: null, view: null, map2d: null, seedParam: null, player: null,
    sound: false, motion: false, busy: false
  };

  function routeStyle(num) {
    var i = (num - 1) % COLORS.length, j = Math.floor((num - 1) / COLORS.length) % DASHES.length;
    return { color: COLORS[i], colorName: COLOR_NAMES[i], dash: DASHES[(i + j) % DASHES.length], dashName: DASH_NAMES[(i + j) % DASHES.length] };
  }
  App.routeStyle = routeStyle;
  App.state = function () { return App.s; };
  App.nodeName = function (id) { return PB.Narrative.nodeName(cfg, id); };
  App.won = function (n) { return (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('ko-KR') + '원'; };
  App.reducedMotion = function () {
    return App.motion || !!root.__pbReduceMotion || (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  App.msPerMinute = function () { return root.__pbFast ? 5 : cfg.playback.msPerMinute; };

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    if (text != null) e.textContent = text;
    return e;
  }
  App.el = el;

  /* ── 화면 ───────────────────────── */
  App.go = function (screen) {
    document.body.setAttribute('data-screen', screen);
    App.render();
  };
  App.render = function () {
    var screen = document.body.getAttribute('data-screen');
    if (screen === 'title') return;
    renderTopbar();
    var panel = $('#panel');
    panel.innerHTML = '';
    var fn = screen === 'reveal' ? renderReveal : (PB.UI && PB.UI[screen]);
    if (fn) fn(App, panel);
    App.syncStage();
    renderTextRoutes();
    var h = panel.querySelector('h2');
    if (h && !App.keepFocus) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    App.keepFocus = false;
  };

  function renderTopbar() {
    var s = App.s, ol = $('#top-phase');
    ol.innerHTML = '';
    cfg.phases.forEach(function (name, i) {
      var li = el('li', { 'class': i + 1 < s.phase || s.stage === 'ending' ? 'done' : i + 1 === s.phase ? 'now' : '' }, (i + 1) + ' ' + name);
      if (i + 1 === s.phase && s.stage !== 'ending') li.setAttribute('aria-current', 'step');
      ol.appendChild(li);
    });
    var bal = s.history.reduce(function (a, h) { return a + h.metrics.costs.total; }, 0);
    $('#top-balance').textContent = '누적 잔액 ' + App.won(bal);
    if (s.stage !== 'run') $('#top-clock').textContent = s.stage === 'ending' ? '학기 끝' : '계획 중';
  }

  /* ── 무대 ───────────────────────── */
  App.stageRoutes = function () {
    var s = App.s, used = {};
    s.draft.buses.forEach(function (b) { if (b.routeNum != null) used[b.routeNum] = true; });
    var g = S.graph(s);
    return s.draft.routes.filter(function (r) { return r.nodes.length >= 2 && r.nodes.every(function (n) { return g.has(n); }); }).map(function (r) {
      var st = routeStyle(r.num);
      return { num: r.num, route: r, color: st.color, dash: st.dash, dim: !used[r.num] };
    });
  };
  App.syncStage = function (opts) {
    opts = opts || {};
    var s = App.s, g = S.graph(s), v = App.view;
    if (!v) return;
    var nodes = g.nodes.map(function (id) { return cfg.nodes.filter(function (n) { return n.id === id; })[0]; });
    var roads = cfg.roads.filter(function (r) { return g.time(r.a, r.b) != null; });
    var key = s.phase + ':' + nodes.length;
    if (App._sceneKey !== key) { v.setScene({ nodes: nodes, roads: roads, phase: s.phase }); App._sceneKey = key; }
    var routes = s.stage === 'run' || s.stage === 'result'
      ? (s.current ? s.current.plan.buses : []).filter(function (b) { return b.route; }).map(function (b) {
        var num = App.numForPlanRoute(b.route), st = routeStyle(num);
        return { num: num, route: b.route, color: st.color, dash: st.dash, dim: false };
      }).filter(function (r, i, arr) { return arr.findIndex(function (x) { return x.num === r.num; }) === i; })
      : App.stageRoutes();
    v.setRoutes(routes);
    v.setSelectable(opts.selectable || []);
    v.setSelected(opts.selected || []);
    if (!opts.keepBuses) {
      v.setBuses(s.draft.buses.map(function (b) {
        var a = nodeXY(cfg.bus.depot);
        return { id: b.id, x: a.x, y: a.y, dx: (b.id - 2.5) * 9, dy: 22, color: b.routeNum != null ? routeStyle(b.routeNum).color : '#6B7280' };
      }));
      v.setWaiting({});
    }
  };
  function nodeXY(id) { var n = cfg.nodes.filter(function (x) { return x.id === id; })[0]; return { x: n.x, y: n.y }; }
  App.nodeXY = nodeXY;
  // 운행 중·결과 화면의 노선 번호는 초안의 같은 노선 번호를 따른다
  App.numForPlanRoute = function (route) {
    var id = PB.Graph.routeId(route), hit = App.s.draft.routes.filter(function (r) { return r.nodes.length >= 2 && PB.Graph.routeId(r) === id; })[0];
    return hit ? hit.num : 99;
  };

  function onNode(id) { if (App.onNodeClick) App.onNodeClick(id); }

  /* ── 글로 보는 노선·버스 ───────────── */
  App.describeRoute = function (r) {
    return r.nodes.map(function (id, i) { return App.nodeName(id) + '(' + id + ') ' + (r.stops[i] ? '정차' : '통과'); }).join(' → ');
  };
  function renderTextRoutes() {
    var s = App.s, box = $('#text-routes-body'), g = S.graph(s);
    box.innerHTML = '';
    var ul = el('ul', { 'class': 'plain' });
    s.draft.routes.forEach(function (r) {
      var st = routeStyle(r.num), buses = s.draft.buses.filter(function (b) { return b.routeNum === r.num; });
      var ok = PB.Graph.validateRoute(g, r).length === 0;
      var li = el('li', null, r.num + '번 노선(' + st.colorName + ' ' + st.dashName + '): ' + App.describeRoute(r) +
        (ok ? ' · 한 바퀴 ' + PB.Graph.cycleMinutes(g, r) + '분' : ' · 아직 완성되지 않음') +
        ' · ' + (buses.length ? buses.map(function (b) { return b.id + '호차(출차 ' + b.offset + '분)'; }).join(', ') : '배정된 버스 없음'));
      ul.appendChild(li);
    });
    s.draft.buses.filter(function (b) { return b.routeNum == null; }).forEach(function (b) {
      ul.appendChild(el('li', null, b.id + '호차: 미배정 — 중앙역에 주차(보유비는 들어요)'));
    });
    box.appendChild(ul);
  }

  /* ── 단계 공개 화면 ───────────────── */
  function renderReveal(app, panel) {
    var s = App.s, p = s.phase, reqs = PB.Demand.base(cfg, p, s.seed).length;
    panel.appendChild(el('p', { 'class': 'eyebrow' }, p + '단계 · ' + cfg.phases[p - 1]));
    panel.appendChild(el('h2', null, p === 1 ? '첫 운행을 준비해요' : p === cfg.newTownPhase ? '마을에 새 동네가 생겼어요' : '다음 운행을 준비해요'));
    if (p === 1 && App.player) panel.appendChild(el('p', null, App.player.nickname + ' 운영자님, 반가워요.'));
    var body = [];
    if (p === 1) body.push('버스 ' + s.owned + '대와 기본 노선 초안이 준비되어 있어요. 이번 운행 창에는 승차 요청 ' + reqs + '건이 들어올 예정이에요.',
      '운영 목표를 고르면 모의 AI가 계획을 제안해요. 받아들이거나 고친 뒤 출발하세요.');
    else if (p === cfg.newTownPhase) {
      var nt = cfg.nodes.filter(function (n) { return n.id === cfg.newZone; })[0];
      var newReqs = PB.Demand.base(cfg, p, s.seed).filter(function (q) { return q.o === cfg.newZone || q.d === cfg.newZone; }).length;
      body.push(nt.name + '(' + nt.id + ')가 생겼어요. 산업·일자리(G)와 구도심 시장(E)에서 ' + nt.name + '로 가는 도로가 열렸어요.',
        nt.name + ' 주민의 승차 요청 ' + newReqs + '건이 더해져 이번 운행 창의 요청은 ' + reqs + '건이에요.',
        '이번 단계부터 4호차를 들일 수 있어요. 처음에는 새 노선에 배정해야 하고, 보유비와 운행비가 늘어요.');
    } else {
      var h = s.history[s.history.length - 1];
      body.push('지난 운행에서는 요청 ' + h.metrics.N + '건 중 ' + h.metrics.arrived + '건이 목적지에 도착했어요.',
        '이번 운행 창의 기본 요청은 ' + reqs + '건이에요. 결과를 보고 노선과 배차를 고칠 수 있어요.');
    }
    body.forEach(function (t) { panel.appendChild(el('p', null, t)); });
    panel.appendChild(el('button', { type: 'button', 'class': 'btn btn-primary btn-lg', id: 'btn-begin-plan', onclick: function () { S.beginPlan(App.s); App.go('plan'); } }, '계획 시작'));
  }

  /* ── 시작 ───────────────────────── */
  App.startGame = function () {
    var chosen = document.querySelector('input[name=setting]:checked');
    var opt = App.seedParam.mode === 'fixed' ? { mode: 'fixed', seed: App.seedParam.seed } : { mode: chosen ? chosen.value : 'default' };
    App.s = S.create(cfg, opt);
    App._sceneKey = null;
    App.go('reveal');
  };

  /* ── 효과음(기본 꺼짐, 파일 없이 합성) ─── */
  var audio = null;
  App.chime = function () {
    if (!App.sound) return;
    try {
      audio = audio || new (root.AudioContext || root.webkitAudioContext)();
      var t = audio.currentTime;
      [659, 523].forEach(function (f, i) {
        var o = audio.createOscillator(), gn = audio.createGain();
        o.frequency.value = f; o.type = 'sine';
        gn.gain.setValueAtTime(0.0001, t + i * 0.18);
        gn.gain.exponentialRampToValueAtTime(0.12, t + i * 0.18 + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.3);
        o.connect(gn); gn.connect(audio.destination);
        o.start(t + i * 0.18); o.stop(t + i * 0.18 + 0.32);
      });
    } catch (e) { /* 소리 없이 계속 */ }
  };
  App.audioCreated = function () { return !!audio; };

  function init() {
    App.player = PB.Storage.readPlayer();
    App.seedParam = S.parseSeedParam(new URLSearchParams(location.search).get('seed'));
    var note = $('#seed-note');
    if (App.seedParam.mode === 'fixed') {
      note.textContent = '지정된 세팅 ' + App.seedParam.seed + '(으)로 시작해요.';
      Array.prototype.forEach.call(document.querySelectorAll('input[name=setting]'), function (r) { r.disabled = true; });
    } else if (App.seedParam.note) note.textContent = App.seedParam.note;
    var lines = PB.Narrative.hookLines(S.create(cfg, { mode: 'default' }));
    $('#hook-1').textContent = lines[0];
    $('#hook-2').textContent = lines[1];

    App.map2d = PB.Map2D.create($('#stage-svg'), { onNode: onNode });
    App.view = App.map2d;
    App.motion = !!root.__pbReduceMotion;
    $('#opt-motion').checked = App.reducedMotion();
    $('#opt-motion').addEventListener('change', function (e) { App.motion = e.target.checked; App.view.setReducedMotion(App.reducedMotion()); });
    $('#opt-sound').addEventListener('change', function (e) { App.sound = e.target.checked; if (App.sound) App.chime(); });
    $('#btn-start').addEventListener('click', App.startGame);
    $('#btn-help').addEventListener('click', function () { $('#help').showModal(); });
    $('#btn-settings').addEventListener('click', function () { $('#settings').showModal(); });
    $('#restart-no').addEventListener('click', function () { $('#confirm-restart').close(); });
    $('#restart-yes').addEventListener('click', function () { $('#confirm-restart').close(); location.reload(); });
    if (App.afterInit) App.afterInit();
  }

  root.PB.App = App;
  // 스크립트는 body 끝에서 읽히므로 DOM이 이미 있다 — 바로 초기화
  init();
  App.ready = true;
})(window);
