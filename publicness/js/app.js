/*
 * 앱 — 화면 전환·상단 바·무대(지도) 동기화·대화 상자. 화면별 패널은 ui-*.js가 PB.UI에 등록한다.
 * 상태는 PB.Session 객체 하나이고, 화면을 그릴 때마다 브라우저에 자동 저장한다(첫 화면 ‘이어하기’).
 */
(function (root) {
  'use strict';
  var PB = root.PB, cfg = PB.config, S = PB.Session;
  var $ = function (s) { return document.querySelector(s); };

  // 노선 색 = 서울 지하철 노선색 계열(1번만 빨강 — 신분당선)을 채도만 낮춘 차분한 톤(원색은 어른 눈에 쨍해서, 2026-10-23).
  // 연결된 노선은 모두 실선이고, 점선은 AI 제안 미리보기만 쓴다
  var COLORS = ['#C4505E', '#3F9B6B', '#D98A45', '#4A9CC2', '#8D77AA', '#A97C52'];
  var COLOR_NAMES = ['빨강', '초록', '주황', '하늘', '보라', '갈색'];

  var App = {
    s: null, view: null, map2d: null, seedParam: null, player: null,
    sound: false, motion: false, busy: false, speed: 1
  };
  // 운행 재생 배속(1·2·4). 재생 속도만 바꾸며 이 브라우저에 기억한다
  App.setSpeed = function (v) { if (PB.Storage.SPEEDS.indexOf(v) < 0) return; App.speed = v; PB.Storage.writeSpeed(v); };
  // 자동 저장 — 화면을 그릴 때마다(계획 편집·출발·결과·다음 단계). 운행 결과는 저장하지 않고 다시 계산한다
  App.save = function () {
    if (!App.s || document.body.getAttribute('data-screen') === 'title') return;
    PB.Storage.writeSave({ version: cfg.SCENARIO_VERSION, savedAt: Date.now(), session: S.serialize(App.s) });
  };
  App.resume = function (saved) {
    App.s = S.restore(saved.session, cfg);
    App._sceneKey = null;
    var st = App.s.stage;
    App.go(st === 'run' ? 'run' : st === 'reveal' ? 'reveal' : st === 'result' ? 'result' : st === 'ending' ? 'ending' : 'plan');
  };

  function routeStyle(num) {
    var i = (num - 1) % COLORS.length;
    return { color: COLORS[i], colorName: COLOR_NAMES[i] };
  }
  App.routeStyle = routeStyle;
  App.state = function () { return App.s; };
  App.nodeName = function (id) { return PB.Narrative.nodeName(App.s?App.s.config:cfg, id); };
  App.clock = function(t){return PB.Demand.clock(App.s?App.s.config:cfg,t);};
  App.updateClock = function(t, status){
    var c=App.s?App.s.config:cfg,p=Math.max(0,Math.min(1,t/c.bus.window));
    var hour=c.day?(c.day.start+(c.day.end-c.day.start)*p)/60:5+18*p;
    var light=hour<7?'dawn':hour<18?'day':hour<20?'dusk':'night',sun=hour>=7&&hour<18;
    $('#top-clock').textContent=c.day?App.clock(t):Math.floor(t)+'초';
    $('#clock-period').textContent=status||(c.day?PB.Demand.period(c,t):'운행 중');
    $('#map-clock').dataset.daylight=light;$('#stage').dataset.daylight=light;
    $('#clock-orb').setAttribute('transform','translate('+(12+120*p)+' '+(32-92*p*(1-p))+')');
    $('#clock-sun').style.display=sun?'':'none';$('#clock-sun').removeAttribute('hidden');
    $('#clock-moon').style.display=sun?'none':'';
  };
  App.duration = function(t){return PB.Demand.duration(App.s?App.s.config:cfg,t);};
  // 0원 근처의 음수를 ‘0원’으로 반올림해 적자 판정과 달라 보이지 않게 한다(−1원 미만)
  App.won = function (n) { return PB.Narrative.won(n); };
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
    if(screen==='reveal'&&App.s&&App.s.transitionStep==='reflect')screen='reflect';
    document.body.classList.remove('result-map-open');
    document.body.setAttribute('data-screen', screen);
    App.render();
  };
  App.render = function () {
    document.querySelector('#stage').dataset.daylight='day';
    var screen = document.body.getAttribute('data-screen');
    if (screen === 'title') return;
    renderTopbar();
    var panel = $('#panel');
    panel.innerHTML = '';
    var fn = screen === 'reveal' ? renderReveal : (PB.UI && PB.UI[screen]);
    App.onNodeClick = null;
    App.onLink = null; App.onRouteClick = null;
    var stageOpts = fn ? fn(App, panel) : null;
    var heading=panel.querySelector('h2'),focus=PB.stories.phaseEthics[App.s.phase-1];
    if(screen==='reveal'&&heading&&focus){
      // 단계 질문은 한 줄. 단계 안내에서는 그대로, 다른 화면에서는 접어 두고 펼치면 전체 문장
      var line=el('span'),ethics;line.appendChild(el('b',null,'이번 단계 질문 · '));line.appendChild(document.createTextNode(focus.short||focus.title));
      if(screen==='reveal'){ethics=el('p',{'class':'callout ethics-focus','data-phase':App.s.phase});ethics.appendChild(line);}
      else{ethics=el('details',{'class':'callout ethics-focus','data-phase':App.s.phase});var sm=el('summary');sm.appendChild(line);ethics.appendChild(sm);ethics.appendChild(el('p',null,focus.title+' — '+focus.text));}
      heading.insertAdjacentElement('afterend',ethics);
    }
    if(screen!=='reflect')App.syncStage(stageOpts || {});
    renderTextRoutes();
    App.save();
    var h = panel.querySelector('h2');
    if (h && !App.keepFocus) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    App.keepFocus = false;
  };

  function renderTopbar() {
    var s = App.s, cfg=s.config, ol = $('#top-phase');
    ol.innerHTML = '';
    cfg.phases.forEach(function (name, i) {
      var li = el('li', { 'class': i + 1 < s.phase || s.stage === 'ending' ? 'done' : i + 1 === s.phase ? 'now' : '' }, (i + 1) + ' ' + name);
      if (i + 1 === s.phase && s.stage !== 'ending') li.setAttribute('aria-current', 'step');
      ol.appendChild(li);
    });
    var bal = s.history.reduce(function (a, h) { return a + h.metrics.costs.total; }, 0);
    $('#top-balance').textContent = '누적 잔액 ' + App.won(bal);
    // 랜덤(도전) 모드는 플레이 내내 누적 적자 횟수를 보여 준다
    var fin = S.financeStatus(s), def = $('#top-deficit');
    def.hidden = fin.rule !== 'deficit-count';
    def.textContent = '누적 적자 ' + fin.deficits + '/' + fin.limit + '회';
    def.classList.toggle('warn', fin.deficits >= fin.limit - 1);
    if (s.stage !== 'run') App.updateClock(s.stage==='result'||s.stage==='ending'?s.config.bus.window:0,s.stage==='ending'?'학기 끝':s.stage==='result'?'운행 끝':'계획 중');
  }

  /* ── 무대 ───────────────────────── */
  App.stageRoutes = function () {
    var s = App.s, used = {};
    s.draft.buses.forEach(function (b) { if (b.routeNum != null) used[b.routeNum] = true; });
    var g = S.graph(s);
    return s.draft.routes.filter(function (r) { return r.nodes.length >= 2 && r.nodes.every(function (n) { return g.has(n); }); }).map(function (r) {
      var st = routeStyle(r.num);
      return { num: r.num, route: r, color: st.color, dim: !used[r.num] };
    });
  };
  App.syncStage = function (opts) {
    opts = opts || {};
    var s = App.s, g = S.graph(s), v = App.view;
    if (!v) return;
    var nodes = g.nodes.map(function (id) { return s.config.nodes.filter(function (n) { return n.id === id; })[0]; });
    var roads = [];
    var key = s.phase + ':' + nodes.length;
    if (App._sceneKey !== key) {
      // Decorative terrain only: route distance and accessibility remain unchanged.
      var river = [];
      if(s.mode === 'default')for(var y=-7;y<=7;y+=.15)river.push({x:-3.9+.45*Math.sin(y*.48),y:y});
      var frame = s.config.nodes.filter(function (n) { return n.id !== 'N' || g.has('N'); });
      v.setScene({ nodes: nodes, frame: frame, roads: roads, phase: s.phase, river: river, load: PB.Demand.stopLoad(s.config, s.phase, s.seed), boundary: nodes.some(function(n){return n.id==='N';}) ? {x:Math.sign(nodes.filter(function(n){return n.id==='N';})[0].x)*6.4} : null }); App._sceneKey = key;
    }
    // 붐비는 정류장의 장식용 대기 인물은 계획 전·계획 중에만. 운행·결과에서는 실제 대기 인원만 보인다
    if (v.setCrowd) v.setCrowd(s.stage === 'reveal' || s.stage === 'plan');
    var routes = s.stage === 'run' || s.stage === 'result'
      ? (s.current ? s.current.plan.buses : []).filter(function (b) { return b.route; }).map(function (b) {
        var num = App.numForPlanRoute(b.route), st = routeStyle(num);
        return { num: num, route: b.route, color: st.color, dim: false };
      }).filter(function (r, i, arr) { return arr.findIndex(function (x) { return x.num === r.num; }) === i; })
      : App.stageRoutes();
    if(s.stage==='run')(s.emergencyLog||[]).filter(function(a){return a.phase===s.phase&&a.route;}).forEach(function(a){if(!routes.some(function(r){return r.num===a.routeNum;}))routes.push({num:a.routeNum,route:a.route,color:routeStyle(a.routeNum).color});});
    if(opts.preview){
      var previewState=Object.assign({},s,{draft:JSON.parse(JSON.stringify(s.draft)),goalHistory:JSON.parse(JSON.stringify(s.goalHistory))});
      S.applyRecommendation(previewState,{plan:opts.preview});
      routes=routes.concat(previewState.draft.routes.filter(function(r){return r.nodes.length>=2;}).map(function(r){var style=routeStyle(r.num);return{num:r.num,route:r,color:style.color,dash:'8 6',preview:true};}));
    }
    else if(s.stage==='plan'&&opts.activeRoute!=null)routes.forEach(function(r){r.dim=r.num!==opts.activeRoute;});
    v.setRoutes(routes);
    document.querySelector('#stage').classList.toggle('previewing',!!opts.preview);
    document.querySelector('#stage').dataset.caption=opts.preview?'AI 제안 미리보기 · 적용 전':'정류장을 연결해 나만의 노선을 만드세요';
    v.setSelectable(opts.selectable || []);
    v.setSelected(opts.selected || []);
    if (!opts.keepBuses) {
      v.setBuses(s.draft.buses.map(function (b) {
        var r=b.routeNum!=null?S.routeByNum(s,b.routeNum):null;
        var a = nodeXY(r&&r.nodes.length?r.nodes[0]:cfg.bus.depot);
        return { id: b.id, x: a.x, y: a.y, dx: -30, dy: -24 - (b.id - 1) * 21, riders:0,color: b.routeNum != null ? routeStyle(b.routeNum).color : '#6B7280' };
      }));
      v.setWaiting({});
    }
  };
  function nodeXY(id) { var n = (App.s ? App.s.config : cfg).nodes.filter(function (x) { return x.id === id; })[0]; return { x: n.x, y: n.y }; }
  App.nodeXY = nodeXY;
  // 운행 중·결과 화면의 노선 번호는 초안의 같은 노선 번호를 따른다
  App.numForPlanRoute = function (route) {
    var hit = App.s.draft.routes.filter(function (r) { return r.nodes.join('|')===route.nodes.join('|')&&r.stops.join('|')===route.stops.join('|'); })[0];
    return hit ? hit.num : 99;
  };

  function onNode(id) { if (App.onNodeClick) App.onNodeClick(id); }

  // 3D 마을 ↔ 지도(SVG) 전환. 운행 중이면 재생이 다음 틱에 버스·대기를 다시 그린다
  App.toggleView = function () {
    if (!App.view3d) return;
    var to3d = App.view !== App.view3d;
    App.view = to3d ? App.view3d : App.map2d;
    App.view3d.show(to3d); App.map2d.show(!to3d);
    App.view.setReducedMotion(App.reducedMotion());
    $('#btn-view-toggle').textContent = to3d ? '지도·텍스트 보기' : '3D 마을 보기';
    App._sceneKey = null;
    if (App.s && App.s.stage === 'run') App.syncStage({ keepBuses: true }); else if (App.s) { App.keepFocus = true; App.render(); }
  };

  /* ── 글로 보는 노선·버스 ───────────── */
  App.describeRoute = function (r) {
    return r.nodes.map(function (id, i) { return App.nodeName(id) + '(' + id + ') ' + (r.stops[i] ? '정차' : '통과'); }).join(' → ');
  };
  function renderTextRoutes() {
    var s = App.s, box = $('#text-routes-body'), g = S.graph(s);
    box.innerHTML = '';
    var ul = el('ul', { 'class': 'plain' });
    S.routesInOrder(s).forEach(function (r) {
      var st = routeStyle(r.num), buses = s.draft.buses.filter(function (b) { return b.routeNum === r.num; });
      var ok = PB.Graph.validateRoute(g, r).length === 0;
      var li = el('li', null, r.num + '번 노선(' + st.colorName + '): ' + App.describeRoute(r) +
        (ok ? ' · 한 바퀴 ' + App.duration(PB.Graph.cycleMinutes(g, r)) : ' · 아직 완성되지 않음') +
        ' · ' + (buses.length ? buses.map(function (b) { return b.id + '호차'; }).join(', ') : '배정된 버스 없음'));
      ul.appendChild(li);
    });
    s.draft.buses.filter(function (b) { return b.routeNum == null; }).forEach(function (b) {
      ul.appendChild(el('li', null, b.id + '호차: 미배정 — 기차역에 주차(보유비는 들어요)'));
    });
    box.appendChild(ul);
  }

  /* ── 단계 공개 화면 ───────────────── */
  // 단계 안내 = 변화 카드: 줄마다 사실 하나, 지난 단계와 비교되는 값은 차이를 붙인다. 반복 설명은 넣지 않는다
  var NEW_PLACE = { H: '경기·운동하러 오가는 사람들', I: '새 주거지 · 기차역·병원으로 오가는 주민', J: '기차역·시장을 오가는 이동과 운동장 왕복', K: '외곽 마을·밀집 주거지에서 낮 방문',
    L: '가족 3팀(12명)이 함께 방문하고 귀가', M: '낮 방문 60명 · 저녁 귀가 60명', N: '아침 출발 36명 · 저녁 귀가 36명' };
  function signed(n) { return n > 0 ? '+' + n : String(n); }
  function renderReveal(app, panel) {
    if(App.s.phase>1)return PB.UI.changes(App,panel);
    var s = App.s, cfg = s.config, p = s.phase, reqs = PB.Demand.base(cfg, p, s.seed).length, prog = cfg.progression;
    panel.appendChild(el('p', { 'class': 'eyebrow' }, p + '단계 · ' + cfg.phases[p - 1]));
    panel.appendChild(el('h2', null, p === 1 ? '첫 운행을 준비해요' : '이번 단계에서 달라진 것'));
    if (p === 1 && App.player) panel.appendChild(el('p', null, App.player.nickname + ' 운영자님, 반가워요.'));
    var rows = [], limit = S.routeLimit(s);
    if (p === 1) {
      rows.push(['버스·노선', '버스 ' + s.owned + '대 · 노선 최대 ' + limit + '개']);
      rows.push(['오늘 이동 요청', requestText(cfg, p, s.seed)]);
      rows.push(['할 일', '정류장을 이어 첫 노선을 만들어 보세요']);
      rows.push(['학기 말 기준', (cfg.challengeApplied ? '총 ' + cfg.phases.length + '단계 · ' : '') + PB.Narrative.satisfactionText(cfg)]);
      rows.push(['재정 규칙', App.financeRuleText(s)]);
    } else {
      var h = s.history[s.history.length - 1], m = h.metrics;
      rows.push(['지난 운행', m.N + '건 중 ' + m.arrived + '건 도착 (' + Math.round(m.arrived / Math.max(1, m.N) * 100) + '%)']);
      var places = cfg.nodes.filter(function (n) { return n.fromPhase === p; });
      if (places.length) rows.push(['새로 생김', places.map(function (n) { return n.name + (NEW_PLACE[n.id] ? ' — ' + NEW_PLACE[n.id] : ''); }).join(' · ')]);
      var people = cfg.residents.filter(function (r) { return r.fromPhase === p; }).map(function (r) { var rd = PB.Demand.residents(cfg, p).filter(function (x) { return x.id === r.id; })[0] || r; return { name: r.name, o: rd.o, d: rd.d }; });
      if (people.length) rows.push(['새 인물', people.map(function (r) { return r.name; }).join('·') + ' (' + App.nodeName(people[0].o) + ' → ' + App.nodeName(people[0].d) + ')']);
      var dBus = prog ? s.owned - prog.buses[p - 2] : 0, dRoute = prog ? limit - prog.routes[p - 2] : 0;
      var bus = '버스 ' + s.owned + '대' + (dBus ? ' (' + signed(dBus) + ')' : '') + ' · 노선 최대 ' + limit + '개' + (dRoute ? ' (' + signed(dRoute) + ')' : '');
      var newest = s.draft.buses[s.draft.buses.length - 1];
      if (cfg.challengeApplied && p === 6 && S.routeByNum(s, 5)) bus += ' · 7호차 직행(정원 18명·1.5배)은 5번 직행 전용, 정류장 3곳까지';
      else if (cfg.challengeApplied && p === 8) bus += ' · 9호차 광역(정원 24명)은 6번 광역 전용';
      else if (dBus && newest && newest.routeNum == null) bus += ' · 새 ' + newest.id + '호차는 직접 배정';
      rows.push(['버스·노선', bus]);
      var prev = PB.Demand.base(cfg, p - 1, s.seed).length;
      rows.push(['오늘 이동 요청', requestText(cfg, p, s.seed) + ' · 예정 이동 ' + signed(reqs - prev) + '건']);
      var now = PB.Demand.stopLoad(cfg, p, s.seed), before = PB.Demand.stopLoad(cfg, p - 1, s.seed);
      var grew = Object.keys(now).filter(function (id) { return before[id] && now[id].count - before[id].count >= 5; })
        .sort(function (x, y) { return (now[y].count - before[y].count) - (now[x].count - before[x].count); }).slice(0, 2);
      if (grew.length) rows.push(['늘어난 곳', grew.map(function (id) { return App.nodeName(id) + ' ' + signed(now[id].count - before[id].count) + '건'; }).join(' · ')]);
    }
    var dl = el('dl', { id: 'phase-changes', 'class': 'kv phase-changes' });
    rows.forEach(function (r) { dl.appendChild(el('dt', null, r[0])); dl.appendChild(el('dd', null, r[1])); });
    panel.appendChild(dl);
    panel.appendChild(el('p', { 'class': 'note', id: 'request-terms' }, '이동 요청 1건 = 한 사람의 한 번 이동이에요. 지도의 정류장 숫자는 그 정류장에서 출발하거나 도착하는 요청이라, 모두 더하면 이동 요청의 두 배가 돼요. 실제 운행에는 돌발 수요가 더해질 수 있어요.'));
    learning(panel, s.phase);
    panel.appendChild(el('button', { type: 'button', 'class': 'btn btn-primary btn-lg', id: 'btn-begin-plan', onclick: function () { S.beginPlan(App.s); App.go('plan'); if (App.s.phase === 1 && !App.s.tutorialSeen) App.showTutorial(); } }, '계획 시작'));
  }

  // 안내용 이동 요청: 예정 이동 + 목적지에 도착하면 생기는 다음 이동(주요 인물·가족). 예상·결과와 같은 이름을 쓴다
  function requestText(c, phase, seed) {
    var q = PB.Demand.requestPlan(c, phase, seed);
    return '예정 ' + q.planned + '건' + (q.followUps ? ' + 도착하면 생기는 다음 이동 최대 ' + q.followUps + '건' : '');
  }
  App.requestText = requestText;
  // ‘잠깐 생각해 보기’ — 별도 창 대신 단계 안내 안에서 읽는다(교육 내용은 그대로)
  function learning(panel, phase) {
    var item = PB.stories.learning[phase - 1]; if (!item) return;
    var sec = el('section', { id: 'learning', 'class': 'learning', 'aria-labelledby': 'learning-title', 'data-phase': phase });
    sec.appendChild(el('p', { 'class': 'eyebrow' }, '잠깐 생각해 보기'));
    sec.appendChild(el('h3', { id: 'learning-title' }, item.title));
    if (item.subtitle) sec.appendChild(el('p', { 'class': 'note learning-subtitle' }, item.subtitle));
    sec.appendChild(el('p', { 'class': 'learning-case' }, item.text));
    var q = el('p', { 'class': 'learning-question' }); q.appendChild(el('b', null, '생각 질문 · ')); q.appendChild(document.createTextNode(item.question)); sec.appendChild(q);
    [{ label: item.source, url: item.url }].concat(item.extraSources || []).forEach(function (src) { sec.appendChild(el('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer', 'class': 'learning-source' }, '출처: ' + src.label + ' (새 탭)')); });
    panel.appendChild(sec);
  }

  App.renderLearning=learning;

  /* ── 첫 노선 안내(1단계 계획에 처음 들어올 때, 도움말에서 다시 보기) ── */
  App.showTutorial = function () {
    var s = App.s; if (!s) return; s.tutorialSeen = true;
    var d = document.querySelector('#tutorial-dialog');
    if (!d) { d = el('dialog', { id: 'tutorial-dialog', 'class': 'dialog', 'aria-labelledby': 'tutorial-title' }); document.body.appendChild(d); }
    var list = PB.Demand.residents(s.config, s.phase), who = list.filter(function (r) { return r.id === 'narae'; })[0] || list[0];
    d.textContent = '';
    d.appendChild(el('p', { 'class': 'eyebrow' }, '첫 노선 만들기'));
    d.appendChild(el('h2', { id: 'tutorial-title', tabindex: '-1' }, '정류장 두 곳을 이어 보세요'));
    var ol = el('ol', { 'class': 'tutorial-steps' });
    ['지도에서 출발할 정류장을 누르세요(‘텍스트로 편집’ 안의 정류장 목록으로 골라도 돼요).', '이어서 갈 정류장을 누르면 노선이 생겨요. 정류장을 끌어서 이어도 돼요.', '새 버스는 처음에 ‘쉬기’예요. 하단 버스 토큰을 노선으로 끌어 놓고 ‘이 노선으로 출발’을 누르세요.'].forEach(function (t) { ol.appendChild(el('li', null, t)); });
    d.appendChild(ol);
    if (who) d.appendChild(el('p', null, '예: ' + who.name + ' · ' + App.clock(who.depart) + ' ' + App.nodeName(who.o) + ' → ' + App.nodeName(who.d) + '. 누구의 길부터 이을지는 직접 정하세요.'));
    d.appendChild(el('p', { 'class': 'note' }, '이번 단계는 버스 ' + s.owned + '대, 노선 ' + S.routeLimit(s) + '개까지예요. 버스 토큰을 선택한 뒤 ‘쉬게 하기’를 누를 수 있어요.'));
    d.appendChild(el('p', { 'class': 'note' }, '출발하면 05:00~23:00 하루를 약 20초에 보여 줘요. 3단계부터는 오전·오후에 한 번씩 멈춰 버스 한 대를 조정할 수 있어요. 결과를 보고 다음 계획을 고쳐 보세요.'));
    d.appendChild(el('button', { type: 'button', id: 'btn-tutorial-close', 'class': 'btn btn-primary', onclick: function () { d.close(); } }, '정류장 이어 보기'));
    // 닫으면 누를 수 있는 정류장을 한 번 깜빡여 지도로 시선을 옮긴다
    d.onclose = function () { if (App.s === s && s.stage === 'plan') { S.visibleNodeIds(s).forEach(function (id) { App.view.flash(id); }); var h = document.querySelector('#panel h2'); if (h) h.focus({ preventScroll: true }); } };
    d.showModal(); d.querySelector('h2').focus();
  };

  /* ── 시작 ───────────────────────── */
  // 캐릭터 소개 뒤 바로 단계 안내(‘생각해 보기’ 포함). 별도 Stage 카드·교육 창은 두지 않는다
  // 모드별 재정 규칙(안내·결과·종료 화면이 같은 문장을 쓴다)
  App.financeRuleText = function (s) {
    return S.financeRule(s) === 'deficit-count'
      ? '단계가 끝날 때마다 회차 수지(지원금·운임 − 운영 비용)를 정산해요. 0원 미만인 적자가 누적 ' + S.DEFICIT_LIMIT + '번이면 잔액이 남아 있어도 운영 계약이 종료돼요. 흑자가 나도 적자 횟수는 줄지 않아요.'
      : '중간에 돈이 모자라도 운행은 계속돼요. 마지막 단계가 끝난 뒤 누적 잔액이 0원 미만이면 파산으로 끝나요.';
  };
  // 다시 하기: 기본은 같은 시나리오, 랜덤은 같은 조건(같은 세팅 번호 → 같은 지도·수요·사건) 또는 새 랜덤 게임. 진행 상태는 모두 새로 만든다
  App.retry = function (kind) {
    var s = App.s, opt = kind === 'new' ? { mode: 'random' } : s.mode === 'default' ? { mode: 'default' } : { mode: s.mode, seed: s.seed };
    PB.Storage.clearSave();
    App.s = S.create(cfg, opt);
    App._sceneKey = null; App._resultFor = null;
    App.go('reveal');
  };
  App.startGame = function () {
    var chosen = document.querySelector('input[name=setting]:checked');
    var opt = App.seedParam.mode === 'fixed' ? { mode: 'fixed', seed: App.seedParam.seed } : { mode: chosen ? chosen.value : 'default' };
    PB.Storage.clearSave();
    App.s = S.create(cfg, opt);
    App._sceneKey = null;
    App.go('reveal');
  };

  /* ── 효과음(기본 켜짐, 파일 없이 합성). 끈 상태는 이 브라우저에 기억 ─── */
  var audio = null;
  function tone(f, start, len, peak, type) {
    audio = audio || new (root.AudioContext || root.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    var o = audio.createOscillator(), gn = audio.createGain(), t = audio.currentTime + start;
    o.frequency.value = f; o.type = type || 'sine';
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(peak, t + 0.015);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(gn); gn.connect(audio.destination);
    o.start(t); o.stop(t + len + 0.02);
  }
  // 정류장 안내 차임: 사건·청원·주요 인물 도착
  App.chime = function () {
    if (!App.sound) return;
    try { tone(659, 0, 0.3, 0.12); tone(523, 0.18, 0.3, 0.12); } catch (e) { /* 소리 없이 계속 */ }
  };
  // 승객이 정류장에 생길 때 짧고 작은 '톡', 주요 인물이 나타날 때는 조금 높고 또렷한 두 음
  App.sfx = function (kind) {
    if (!App.sound) return;
    try {
      if (kind === 'resident') { tone(784, 0, 0.16, 0.07, 'triangle'); tone(1047, 0.09, 0.2, 0.07, 'triangle'); }
      else tone(1175, 0, 0.07, 0.035, 'triangle');
    } catch (e) { /* 소리 없이 계속 */ }
  };
  App.setSound = function (on) {
    App.sound = !!on; PB.Storage.writeSound(App.sound);
    var c = document.querySelector('#opt-sound'); if (c) c.checked = App.sound;
    var b = document.querySelector('#run-sound'); if (b) { b.setAttribute('aria-pressed', String(App.sound)); b.querySelector('[aria-hidden]').textContent = (App.sound ? '🔊' : '🔇') + ' '; }
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

    var controls={onNode:onNode,canEdit:function(){return App.s&&App.s.stage==='plan';},onLink:function(a,b){if(App.onLink)App.onLink(a,b);},onRoute:function(n,i){if(App.onRouteClick)App.onRouteClick(n,i);},
      // 지도 위 시계 영역 — 2D 지도는 이 영역 밑에 정류장이 깔리지 않도록 화면을 비켜 그린다
      reserved:function(){return ['#map-clock','#run-controls'].map(function(id){return $(id);}).filter(function(c){return c&&c.getClientRects().length;}).map(function(c){return c.getBoundingClientRect();});}};
    App.map2d = PB.Map2D.create($('#stage-svg'), controls);
    App.view = App.map2d;
    var want3d = new URLSearchParams(location.search).get('no3d') !== '1';
    var note3d = $('#no3d-note');
    if (want3d && PB.View3D) {
      var v3 = PB.View3D.create($('#stage-3d'), controls);
      if (v3.ok) {
        App.view3d = v3; App.view = v3;
        $('#stage-3d').hidden = false; App.map2d.show(false);
        $('#btn-view-toggle').hidden = false;
      } else { note3d.hidden = false; note3d.textContent = '이 기기에서는 3D 화면을 쓸 수 없어 지도로 보여 드려요. 모든 기능은 그대로예요.'; }
    } else if (!want3d) { note3d.hidden = false; note3d.textContent = '지도 보기로 시작했어요.'; }
    $('#btn-view-toggle').addEventListener('click', App.toggleView);
    App.motion = !!root.__pbReduceMotion;
    $('#opt-motion').checked = App.reducedMotion();
    $('#opt-motion').addEventListener('change', function (e) { App.motion = e.target.checked; App.view.setReducedMotion(App.reducedMotion()); });
    App.sound = PB.Storage.readSound(); $('#opt-sound').checked = App.sound;
    App.speed = PB.Storage.readSpeed();
    $('#opt-sound').addEventListener('change', function (e) { App.setSound(e.target.checked); if (App.sound) App.chime(); });
    // 캐릭터 소개 → 맵 화면 위 Stage 1 카드 → 교육 모달 → 단계 안내 순서. 세팅 라디오는 소개 전에 읽어 둔다
    function newGame() { PB.Cutscene.play('intro', function () { App.startGame(); }); }
    // 저장된 진행이 있으면 ‘이어하기’를 먼저 보여 주고, 새로 시작은 지워도 되는지 한 번 묻는다
    var saved = PB.Storage.readSave(cfg.SCENARIO_VERSION), cont = $('#btn-continue');
    if (saved && cont) {
      var ss = saved.session, total = (ss.config ? ss.config.phases.length : cfg.phases.length);
      cont.hidden = false;
      $('#continue-note').textContent = (ss.mode === 'default' ? '기본' : '랜덤') + ' 세팅 · ' + (ss.stage === 'ending' ? (ss.end && ss.end.cause === 'bankrupt' ? '파산으로 운영 종료' : ss.end && ss.end.cause === 'contract' ? '적자 누적으로 운영 계약 종료' : '학기 마무리') : ss.phase + ' / ' + total + '단계 ' + ({ reveal: '안내', plan: '계획', run: typeof ss.runCursor==='number'?'운행 이어보기':'운행(출발 직전 계획으로 돌아가요)', result: '결과' }[ss.stage] || '')) + ' · ' + new Date(saved.savedAt).toLocaleString('ko-KR');
      cont.addEventListener('click', function () { App.resume(PB.Storage.readSave(cfg.SCENARIO_VERSION) || saved); });
      $('#btn-start').textContent = '새로 시작하기';
      $('#btn-start').classList.remove('btn-primary');
    }
    $('#btn-start').addEventListener('click', function () {
      if (PB.Storage.readSave(cfg.SCENARIO_VERSION)) { App.restartToNew = true; $('#confirm-restart').showModal(); return; }
      newGame();
    });
    App.newGame = newGame;
    $('#btn-help').addEventListener('click', function () { $('#btn-tutorial-replay').hidden = !App.s; $('#help').showModal(); });
    $('#btn-tutorial-replay').addEventListener('click', function () { $('#help').close(); App.showTutorial(); });
    $('#btn-settings').addEventListener('click', function () { $('#settings').showModal(); });
    $('#restart-no').addEventListener('click', function () { $('#confirm-restart').close(); });
    $('#restart-yes').addEventListener('click', function () { $('#confirm-restart').close(); PB.Storage.clearSave(); if (App.restartToNew && !App.s) { App.restartToNew = false; newGame(); } else location.reload(); });
    if (App.afterInit) App.afterInit();
  }

  root.PB.App = App;
  // 스크립트는 body 끝에서 읽히므로 DOM이 이미 있다 — 바로 초기화
  init();
  App.ready = true;
})(window);
