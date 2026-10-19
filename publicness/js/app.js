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
    if(screen!=='ending'&&heading&&focus){
      var ethics=el('aside',{'class':'callout ethics-focus','data-phase':App.s.phase,'aria-label':'이번 단계에서 살펴볼 것'});
      ethics.appendChild(el('b',null,'이번 단계에서 살펴볼 것 · '+focus.title));
      ethics.appendChild(el('p',null,focus.text));heading.insertAdjacentElement('afterend',ethics);
    }
    App.syncStage(stageOpts || {});
    renderTextRoutes();
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
    if (s.stage !== 'run') App.updateClock(s.stage==='result'||s.stage==='ending'?s.config.bus.window:0,s.stage==='ending'?'학기 끝':s.stage==='result'?'운행 끝':'계획 중');
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
    var nodes = g.nodes.map(function (id) { return s.config.nodes.filter(function (n) { return n.id === id; })[0]; });
    var roads = [];
    var key = s.phase + ':' + nodes.length;
    if (App._sceneKey !== key) {
      // Decorative terrain only: route distance and accessibility remain unchanged.
      var river = [];
      if(s.mode === 'default')for(var y=-7;y<=7;y+=.15)river.push({x:-3.9+.45*Math.sin(y*.48),y:y});
      v.setScene({ nodes: nodes, roads: roads, phase: s.phase, river: river, boundary: nodes.some(function(n){return n.id==='N';}) ? {x:Math.sign(nodes.filter(function(n){return n.id==='N';})[0].x)*6.4} : null }); App._sceneKey = key;
    }
    var routes = s.stage === 'run' || s.stage === 'result'
      ? (s.current ? s.current.plan.buses : []).filter(function (b) { return b.route; }).map(function (b) {
        var num = App.numForPlanRoute(b.route), st = routeStyle(num);
        return { num: num, route: b.route, color: st.color, dash: st.dash, dim: false };
      }).filter(function (r, i, arr) { return arr.findIndex(function (x) { return x.num === r.num; }) === i; })
      : App.stageRoutes();
    if(opts.preview){
      var previewState=Object.assign({},s,{draft:JSON.parse(JSON.stringify(s.draft)),goalHistory:JSON.parse(JSON.stringify(s.goalHistory))});
      S.applyRecommendation(previewState,{plan:opts.preview});
      routes=previewState.draft.routes.filter(function(r){return r.nodes.length>=2;}).map(function(r){var style=routeStyle(r.num);return{num:r.num,route:r,color:style.color,dash:'8 6',preview:true};});
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
      var li = el('li', null, r.num + '번 노선(' + st.colorName + ' ' + st.dashName + '): ' + App.describeRoute(r) +
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
  function renderReveal(app, panel) {
    var s = App.s, cfg=s.config, p = s.phase, reqs = PB.Demand.base(cfg, p, s.seed).length;
    panel.appendChild(el('p', { 'class': 'eyebrow' }, p + '단계 · ' + cfg.phases[p - 1]));
    panel.appendChild(el('h2', null, p === 1 ? '첫 운행을 준비해요' : p === cfg.newTownPhase ? '마을에 새 동네가 생겼어요' : '다음 운행을 준비해요'));
    if (p === 1 && App.player) panel.appendChild(el('p', null, App.player.nickname + ' 운영자님, 반가워요.'));
    var body = [];
    if (p === 1) body.push('버스 ' + s.owned + '대와 빈 노선 2개가 준비되어 있어요. 정해진 경로는 없어요. 이번 운행에는 승차 요청 ' + reqs + '건이 들어올 예정이에요.',
      '지도의 정류장을 이어 노선을 만드세요. 필요하면 AI 제안도 받아 볼 수 있어요.');
    else if (p === cfg.newTownPhase) {
      var nt = cfg.nodes.filter(function (n) { return n.id === cfg.newZone; })[0];
      var newReqs = PB.Demand.base(cfg, p, s.seed).filter(function (q) { return q.o === cfg.newZone || q.d === cfg.newZone; }).length;
      body.push(nt.name + '(' + nt.id + ')가 생겼어요. 어느 정류장과도 연결할 수 있어요.',
        nt.name + ' 주민의 승차 요청 ' + newReqs + '건이 더해져 이번 운행 창의 요청은 ' + reqs + '건이에요.',
        '빈 노선 하나와 버스 한 대가 추가됐어요. 노선 4개와 버스 4대로 새 동네까지 연결해 보세요.');
    } else {
      var h = s.history[s.history.length - 1];
      body.push('지난 운행에서는 요청 ' + h.metrics.N + '건 중 ' + h.metrics.arrived + '건이 목적지에 도착했어요.',
        '이번 운행 창의 기본 요청은 ' + reqs + '건이에요. 결과를 보고 노선과 배차를 고칠 수 있어요.');
    }
    if (p === 2) body.push('솔잎마을 종합운동장이 완공되었습니다! 경기와 운동을 즐기려는 사람들이 찾아옵니다. 종합운동장으로 가는 노선을 연결해 주세요.','빈 노선 하나와 버스 한 대가 추가됐어요. 이제 노선 3개와 버스 3대로 연결을 넓혀 보세요.');
    if (p === 4 && s.config.nodes.some(function(n){return n.id==='J';})) body.push('고속버스터미널(J)이 문을 열었어요. 기본 맵에서는 산업·일자리 아래에 있어요. 기차역·구도심 시장을 오가는 이동 요청 20건과 종합운동장 왕복 요청 8건이 추가됩니다. 기존 노선을 연장하거나 경유지를 바꿔 연결해 보세요.');
    if (p === 5 && s.config.nodes.some(function(n){return n.id==='K';})) body.push('어린이·노인복지관(K)이 문을 열었어요. 외곽 마을과 밀집 주거지를 오가는 작은 이동 요청 12건이 더해져요. 낮에 방문하고 저녁 전에 돌아오는 길까지 연결해 보세요.');
    if (p === 6) body.push('호수공원(L)이 열렸어요. 가족 3팀, 총 12명이 나들이를 계획하고 있어요. 가족 모두의 방문과 귀가를 연결해 보세요. 5번 직행 노선과 전용 직행버스 7호차가 함께 추가됩니다. 7호차는 정원 18명·주행 속도 1.5배이며, 5번 노선에만 배정할 수 있어요. 5번 노선은 최대 3개 정류장만 연결하며, 정류장은 언제든 바꿀 수 있어요.');
    if (p === 7) body.push('솔잎몰(M)이 문을 열었어요. 낮 방문과 저녁 귀가 시간에 일반 승객 120명이 집중돼요. 새 8호차를 어디에 배정할지 결정하고, 기존 주민과 가족의 이동도 살펴보세요.');
    if (p === 8) body.push('행정 경계 너머 대도시(N)로 출퇴근하는 주민이 생겼어요. 6번 광역 노선과 정원 24명의 전용 9호차를 지급합니다. 마을 정류장 한 곳과 대도시 한 곳만 연결하는 왕복 노선이에요. 시내버스와 갈아탈 곳을 고르고, 아침 출발 36명과 저녁 귀가 36명의 길을 이어 주세요.');
    if (p >= 4) body.push('버스 한 대가 추가되어 총 ' + s.owned + '대예요. 노선은 최대 '+S.routeLimit(s)+'개이며, '+(p===8?'새 버스는 6번 광역 노선에 배정되어 있어요.':p===6&&S.routeByNum(s,5)?'새 버스는 5번 직행 노선에 배정되어 있어요.':'새 버스를 배정할 노선을 직접 선택하세요.')+' 같은 노선의 버스는 자동으로 간격을 두고 출발해요.');
    if(p===1)body.push((cfg.challengeApplied?'랜덤 도전은 총 '+cfg.phases.length+'단계입니다. ':'')+'학기 말에 주요 인물마다 만족했는지 확인해요. 만족 기준은 '+PB.Narrative.satisfactionText(cfg)+'이에요. 진행 상황은 계획 화면의 일정과 결과 화면에서 볼 수 있어요.');
    if(s.config.day)body.push('05:00부터 23:00까지의 하루를 실제 120초 동안 운행해요. 출근·낮·귀가 시간에 따라 이동 수요가 달라져요. 주요 인물의 다음 이동 요청은 목적지 도착 후 체류 시간을 채워야 생겨요.');
    body.forEach(function (t) { panel.appendChild(el('p', null, t)); });
    panel.appendChild(el('button', { type: 'button', 'class': 'btn btn-primary btn-lg', id: 'btn-begin-plan', onclick: function () { S.beginPlan(App.s); App.go('plan'); } }, '계획 시작'));
  }

  /* ── 시작 ───────────────────────── */
  App.showLearning = function () {
    var item=PB.stories.learning[App.s.phase-1];if(!item)return;
    var d=document.querySelector('#learning-dialog');
    if(!d){d=el('dialog',{id:'learning-dialog','class':'dialog','aria-labelledby':'learning-title'});document.body.appendChild(d);}
    d.textContent='';d.dataset.phase=App.s.phase;
    d.appendChild(el('p',{'class':'eyebrow'},App.s.phase+'단계 · 잠깐 생각해 보기'));
    d.appendChild(el('h2',{id:'learning-title',tabindex:'-1'},item.title));
    if(item.subtitle)d.appendChild(el('p',{'class':'note learning-subtitle'},item.subtitle));
    d.appendChild(el('p',{'class':'learning-case'},item.text));
    var q=el('section',{'class':'learning-question'});q.appendChild(el('h3',null,'생각 질문'));q.appendChild(el('p',null,item.question));d.appendChild(q);
    d.appendChild(el('a',{href:item.url,target:'_blank',rel:'noopener noreferrer','class':'learning-source'},'출처: '+item.source+' (새 탭)'));
    (item.extraSources||[]).forEach(function(source){d.appendChild(el('a',{href:source.url,target:'_blank',rel:'noopener noreferrer','class':'learning-source'},'출처: '+source.label+' (새 탭)'));});
    if(App.s.phase===4)d.appendChild(el('a',{href:'https://ai.hel.fi/en/the-rental-apartment-search-chatbot/',target:'_blank',rel:'noopener noreferrer','class':'learning-source'},'언어 지원 한계를 밝힌 챗봇 등록 기록 (새 탭)'));
    d.appendChild(el('button',{id:'btn-learning-continue',type:'button','class':'btn btn-primary',onclick:function(){d.close();}},'생각하고 시작하기'));
    d.onclose=function(){var b=document.querySelector('#btn-begin-plan');if(b)b.focus();};
    d.showModal();d.querySelector('h2').focus();
  };
  App.startGame = function () {
    var chosen = document.querySelector('input[name=setting]:checked');
    var opt = App.seedParam.mode === 'fixed' ? { mode: 'fixed', seed: App.seedParam.seed } : { mode: chosen ? chosen.value : 'default' };
    App.s = S.create(cfg, opt);
    App._sceneKey = null;
    App.go('reveal');
    App.showLearning();
  };

  // 세션을 만들기 전에 보여 줄 Stage 1 카드. 랜덤·지정 세팅은 Session.create처럼 도전 단계를 더한다
  function firstStage() {
    var chosen = document.querySelector('input[name=setting]:checked');
    var challenge = cfg.challenge && (App.seedParam.mode === 'fixed' || (chosen && chosen.value === 'random'));
    return { number: 1, total: cfg.phases.length + (challenge ? cfg.challenge.phases.length : 0), name: cfg.phases[0] };
  }

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
    $('#opt-sound').addEventListener('change', function (e) { App.sound = e.target.checked; if (App.sound) App.chime(); });
    $('#btn-start').addEventListener('click', function () { PB.Cutscene.play('intro',App.startGame,null,firstStage()); });
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
