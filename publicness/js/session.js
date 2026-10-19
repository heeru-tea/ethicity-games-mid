/*
 * 세션 — 한 학기 다섯 단계의 흐름과 학생이 고치는 계획 초안을 담는다(브라우저 메모리에만).
 * 단계 흐름: reveal(환경 공개) → plan(목표·AI·편집) → run(운행, 편집 불가) → result → 다음 단계 … → ending
 * 실제 운행은 공개 기본 수요 + 이 세션에서 미리 정해진 사건으로, 예상은 공개 기본 수요만으로 계산한다.
 */
(function (root) {
  'use strict';
  var NODE = typeof require === 'function' && typeof module !== 'undefined';
  var Graph = NODE ? require('./graph.js') : root.PB.Graph;
  var Demand = NODE ? require('./demand.js') : root.PB.Demand;
  var Sim = NODE ? require('./sim.js') : root.PB.Sim;
  var Metrics = NODE ? require('./metrics.js') : root.PB.Metrics;
  var Advisor = NODE ? require('./advisor.js') : root.PB.Advisor;
  var Rng = NODE ? require('./rng.js') : root.PB.Rng;
  var Schedule = NODE ? require('./schedule.js') : root.PB.Schedule;

  function copyRoute(r) { return { nodes: r.nodes.slice(), stops: r.stops.slice() }; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function parseSeedParam(str) {
    if (str == null || str === '') return { seed: 42, mode: 'default', note: null };
    if (/^-?\d+$/.test(String(str).trim())) {
      var n = Number(str);
      if (isFinite(n)) return { seed: Number(BigInt.asUintN(32, BigInt(String(str).trim()))), mode: 'fixed', note: null };
    }
    return { seed: 42, mode: 'default', note: '세팅 번호는 정수여야 해요. 기본 세팅으로 시작합니다.' };
  }

  function create(config, opts) {
    opts = opts || {};
    var mode = opts.mode || 'default', seed;
    if (mode === 'random') seed = Math.floor((opts.rand || Math.random)() * 4294967296) >>> 0;
    else if (mode === 'fixed') seed = Number(opts.seed) >>> 0;
    else seed = config.defaultSeed;
    if (mode !== 'default' && config.map) {
      config = clone(config);
      if(config.challenge&&!config.challengeApplied){
        var challenge=config.challenge;config.challengeApplied=true;
        config.phases=config.phases.concat(challenge.phases);
        config.progression={routes:[2,3,4,4,4,5,5,6],buses:[2,3,4,5,6,7,8,9]};config.bus.maxBuses=9;
        config.satisfactionTargets=challenge.targets;config.familyTrips=challenge.families;
        config.nodes=config.nodes.concat(challenge.nodes);config.demandRows=config.demandRows.concat(challenge.demandRows);
        config.residents.forEach(function(r){if(r.itineraries){r.itineraries[6]={o:'J',d:'H',depart:60,returnAt:100,stay:20,returnTo:'B'};r.itineraries[7]=clone(r.itineraries[5]);}});
      }
      var rng=Rng.create(seed ^ 0x51ed270b),sx=rng.next()<.5?-1:1,sy=rng.next()<.5?-1:1;
      var cells=[[-.6,-2.6],[-2.4,-.6],[-2,2],[1.2,1.8],[4.4,.5],[0,-.2]];
      for(var k=cells.length-1;k>0;k--){var j=Math.floor(rng.next()*(k+1)),tmp=cells[k];cells[k]=cells[j];cells[j]=tmp;}
      config.nodes.forEach(function(n){
        var p=n.id==='F'?[-4.8,2.8]:n.id==='I'?[4.8,-2.8]:n.id==='D'?[3,-1.8]:n.id==='J'?[4.4,2.7]:n.id==='K'?[-4.4,.7]:n.id==='L'?[-4.6,-2.3]:n.id==='M'?[2.7,.2]:n.id==='N'?[8.7,0]:cells.pop();
        var jitter=['F','I','J','K','L','M','N'].indexOf(n.id)>=0?0:.12;
        n.x=sx*(p[0]+(rng.next()-.5)*jitter);n.y=sy*(p[1]+(rng.next()-.5)*jitter);
      });
    }
    var s = {
      config: config, seed: seed, mode: mode, phase: 1, stage: 'reveal',
      events: Demand.drawEvents(config, seed),
      trust: {}, owned: config.bus.initialBuses, fourthPhase: null,
      draft: {
        routes: config.initialDraft.routes.map(function (r, i) { var c = copyRoute(r); c.num = i + 1; return c; }),
        nextNum: config.initialDraft.routes.length + 1,
        buses: config.initialDraft.buses.map(function (b) { return { id: b.id, routeNum: b.routeNum, offset: b.offset }; })
      },
      goal: null, goalHistory: [], lastRec: null, current: null, history: []
    };
    graph(s).nodes.forEach(function (id) { s.trust[id] = config.trust.initial; });
    return s;
  }

  function graph(s) {
    if (!s._g || s._g.phase !== s.phase) s._g = Graph.build(s.config, s.phase);
    return s._g;
  }
  function visibleNodeIds(s) { return graph(s).nodes.slice(); }
  function routeByNum(s, num) {
    for (var i = 0; i < s.draft.routes.length; i++) if (s.draft.routes[i].num === num) return s.draft.routes[i];
    return null;
  }

  function toPlan(s) {
    return Schedule.spacePlan(graph(s), s.config, { buses: s.draft.buses.map(function (b) {
      var r = b.routeNum != null ? routeByNum(s, b.routeNum) : null;
      return { id: b.id, route: r ? copyRoute(r) : null, offset: s.config.map ? 0 : b.offset };
    }) });
  }

  function prevRouteIds(s) {
    var h = s.history[s.history.length - 1];
    return h ? h.routeIds.slice() : [];
  }

  function validate(s) {
    var g = graph(s), errs = [], offsets = s.config.bus.offsets;
    var used = {};
    s.draft.buses.forEach(function (b) { if (b.routeNum != null) used[b.routeNum] = true; });
    s.draft.routes.forEach(function (r) {
      if (!routeFits(s,r.num,r)) errs.push(routeRule(s,r.num));
      if(s.config.challengeApplied&&r.num===6&&used[r.num]&&(r.nodes.length!==2||r.nodes.indexOf('N')<0))errs.push(routeRule(s,6));
      if (!used[r.num]) return;
      Graph.validateRoute(g, r).forEach(function (e) { errs.push(r.num + '번 노선: ' + e); });
    });
    s.draft.buses.forEach(function (b) {
      if(!canAssign(s,b.id,b.routeNum))errs.push(b.id+'호차의 전용 노선 배정을 확인해 주세요.');
      if (offsets.indexOf(b.offset) < 0) errs.push(b.id + '호차의 출차 시각을 다시 골라 주세요.');
      if (b.routeNum != null && !routeByNum(s, b.routeNum)) errs.push(b.id + '호차가 없는 노선에 배정되어 있어요.');
    });
    if (!s.config.progression && s.fourthPhase === s.phase) {
      var b4 = s.draft.buses.filter(function (b) { return b.id === 4; })[0];
      var r4 = b4 && b4.routeNum != null ? routeByNum(s, b4.routeNum) : null;
      var msg = '4호차는 처음 운행할 때 새 노선에 배정해야 해요.';
      if (!r4) errs.push(msg);
      else {
        var id4 = Graph.routeId(r4);
        var others = s.draft.buses.filter(function (b) { return b.id !== 4 && b.routeNum != null; })
          .map(function (b) { var r = routeByNum(s, b.routeNum); return r ? Graph.routeId(r) : null; });
        if (prevRouteIds(s).indexOf(id4) >= 0 || others.indexOf(id4) >= 0) errs.push(msg);
      }
    }
    return errs;
  }

  function routeLimit(s) { return s.config.progression ? s.config.progression.routes[s.phase - 1] : 4; }
  function stopLimit(s,num) { return s.config.challengeApplied ? (num===6?2:num===5?3:Infinity) : Infinity; }
  function routeRule(s,num){return num===6?'6번 광역은 마을 정류장 한 곳과 대도시를 잇는 왕복 노선이에요.':'대도시는 6번 광역으로만 연결해요. 5번 직행은 최대 3개 정류장이에요.';}
  function routeFits(s,num,r) {
    if(!s.config.challengeApplied)return true;
    if(num!==6)return r.nodes.indexOf('N')<0&&new Set(r.nodes).size<=stopLimit(s,num);
    return r.nodes.length<=2&&new Set(r.nodes).size===r.nodes.length&&(r.nodes.length<2||r.nodes.indexOf('N')>=0);
  }
  function canAssign(s,id,num){return num==null||!s.config.challengeApplied||((id!==7||num===5)&&(id!==9||num===6)&&(num!==6||id===9));}
  // 화면 표시용: 노선 번호순 사본(초안 배열 순서는 생성·적용 순서라 섞일 수 있음)
  function routesInOrder(s) { return s.draft.routes.slice().sort(function (a, b) { return a.num - b.num; }); }
  function addRoute(s, route, preferNum) {
    var num = 1;
    if (preferNum && preferNum <= routeLimit(s) && !routeByNum(s, preferNum)) num = preferNum;
    else while (num <= routeLimit(s) && routeByNum(s, num)) num++;
    if (num > routeLimit(s) || s.draft.routes.length >= routeLimit(s) || !routeFits(s,num,route)) return null;
    var r = copyRoute(route);
    r.num = num;
    s.draft.routes.push(r);
    return r;
  }
  function updateRoute(s, num, route) {
    var r = routeByNum(s, num);
    if (!r || !routeFits(s,num,route)) return null;
    r.nodes = route.nodes.slice(); r.stops = route.stops.slice();
    return r;
  }
  function deleteRoute(s, num) {
    var unassigned = [];
    s.draft.routes = s.draft.routes.filter(function (r) { return r.num !== num; });
    s.draft.buses.forEach(function (b) { if (b.routeNum === num) { b.routeNum = null; unassigned.push(b.id); } });
    return { unassigned: unassigned };
  }
  function bus(s, id) { return s.draft.buses.filter(function (b) { return b.id === id; })[0]; }
  function assign(s, busId, routeNum) { var b = bus(s, busId); if(!canAssign(s,busId,routeNum))return false; if (b) b.routeNum = routeNum; }
  function setOffset(s, busId, offset) { var b = bus(s, busId); if (b) b.offset = s.config.map ? 0 : offset; }

  function beginPlan(s) { if (s.stage === 'reveal') s.stage = 'plan'; }

  function introduceFourth(s) {
    if (s.config.progression) return false;
    if (s.phase < s.config.fourthFromPhase || s.owned >= s.config.bus.maxBuses) return false;
    if (s.stage !== 'reveal' && s.stage !== 'plan') return false;
    s.owned++;
    if(s.owned===4)s.fourthPhase = s.phase;
    s.draft.buses.push({ id: s.owned, routeNum: null, offset: 0 });
    return true;
  }

  function goalEntry(s) {
    var last = s.goalHistory[s.goalHistory.length - 1];
    if (last && last.phase === s.phase) return last;
    var e = { phase: s.phase, goal: null, action: null };
    s.goalHistory.push(e);
    return e;
  }
  function chooseGoal(s, goal) { s.goal = goal; goalEntry(s).goal = goal; }
  function markGoalAction(s, action) { goalEntry(s).action = action; }

  // 추천 계획의 노선을 초안 노선으로 찾거나 새로 만들어 배정한다(운행은 시작하지 않음)
  function applyPlanBuses(s, buses) {
    var desired = toPlan(s).buses.map(function (old) { return buses.filter(function (pb) { return pb.id === old.id; })[0] || old; });
    desired=desired.map(function(pb){var r=pb.route;if(s.config.challengeApplied&&r&&((pb.id===9&&(!routeFits(s,6,r)||r.nodes.length!==2))||(pb.id!==9&&r.nodes.indexOf('N')>=0)||(pb.id===7&&!routeFits(s,5,r))))return {id:pb.id,route:null,offset:pb.offset};return pb;});
    var previous = s.draft.routes.slice();
    function same(a, b) { return a && b && a.nodes.join('|') === b.nodes.join('|') && a.stops.join('|') === b.stops.join('|'); }
    s.draft.routes = [];
    var regional=desired.filter(function(pb){return s.config.challengeApplied&&pb.id===9&&pb.route;})[0];
    if(regional){var rr=copyRoute(regional.route);rr.num=6;s.draft.routes.push(rr);}
    var dedicated=s.config.challengeApplied?desired.filter(function(pb){return pb.id===7&&pb.route&&routeFits(s,5,pb.route);})[0]:null;
    if(dedicated){var dedicatedRoute=copyRoute(dedicated.route);dedicatedRoute.num=5;s.draft.routes.push(dedicatedRoute);}
    if(s.config.challengeApplied&&routeLimit(s)>=5){
      var unique=[];desired.forEach(function(pb){if(pb.id!==9&&pb.route&&!unique.some(function(r){return same(r,pb.route);}))unique.push(pb.route);});
      if(unique.length===5&&!dedicated){
        // 5번 자리: 기존 5번 그대로 → 새로 생기는 짧은 노선 → (불가피할 때만) 기존 짧은 노선을 5번으로 옮김
        var oldExpress=previous.filter(function(r){return r.num===5;})[0],fits=unique.filter(function(r){return routeFits(s,5,r);});
        var express=fits.filter(function(r){return same(r,oldExpress);})[0]||fits.filter(function(r){return !previous.some(function(p){return same(p,r);});})[0]||fits[0];
        if(express){var er=copyRoute(express);er.num=5;s.draft.routes.push(er);}
      }
    }
    previous.forEach(function (r) {
      if (r.num >= 1 && r.num <= routeLimit(s) && routeFits(s,r.num,r) && desired.some(function (pb) { return same(r, pb.route); }) &&
          !s.draft.routes.some(function (kept) { return kept.num === r.num || same(kept, r); })) s.draft.routes.push(r);
    });
    desired.forEach(function (pb) {
      var b = bus(s, pb.id);
      if (!b) return;
      if (!pb.route) { b.routeNum = null; b.offset = pb.offset; return; }
      var found = null;
      s.draft.routes.forEach(function (r) { if (!found && Graph.validateRoute(graph(s), r).length === 0 && r.nodes.join('|') === pb.route.nodes.join('|') && r.stops.join('|') === pb.route.stops.join('|')) found = r; });
      if (!found) found = addRoute(s, pb.route);
      b.routeNum = found&&canAssign(s,b.id,found.num) ? found.num : null;
      b.offset = s.config.map ? 0 : pb.offset;
    });
  }
  function applyRecommendation(s, rec) {
    applyPlanBuses(s, rec.plan.buses);
    s.lastRec = rec;
    markGoalAction(s, 'accept');
  }
  function applyFourth(s, rec) {
    if (!rec || !rec.fourth) return false;
    if(s.owned<3)return false;
    if (s.owned < s.config.bus.maxBuses && !introduceFourth(s)) return false;
    // 4호차만 배정한다(1~3호차는 학생의 현재 초안 그대로)
    applyPlanBuses(s, rec.fourth.plan.buses.filter(function (b) { return b.id === 4; }));
    return true;
  }

  function revealed(s) {
    var h = s.history[s.history.length - 1];
    return Advisor.makeRevealed({
      phase: s.phase, g: graph(s), requests: Demand.base(s.config, s.phase, s.seed), owned: s.owned,
      fourthAllowed: !s.config.progression && s.phase >= s.config.fourthFromPhase, fourthMustBeNew: !s.config.progression && s.fourthPhase === s.phase, prevMetrics: h ? h.metrics : null,
      prevRouteIds: prevRouteIds(s), plan: toPlan(s), config: s.config
    });
  }

  function runnable(s, plan) {
    var g = graph(s);
    return { buses: plan.buses.map(function (b) { return { id: b.id, route: b.route && Graph.validateRoute(g, b.route).length === 0 ? b.route : null, offset: b.offset }; }) };
  }

  function expected(s, plan) {
    var p = runnable(s, plan || toPlan(s)), g = graph(s);
    var res = Sim.run({ g: g, config: s.config, phase: s.phase, plan: p, requests: Demand.base(s.config, s.phase, s.seed) });
    var m = Metrics.summarize(res, g, p, s.config);
    m.residents = residentRecords(s, res);
    return m;
  }

  function startRun(s) {
    if (s.stage !== 'plan' || validate(s).length) return null;
    var g = graph(s), plan = clone(toPlan(s)), ev = s.events[s.phase - 1];
    var requests = Demand.sortReqs(Demand.base(s.config, s.phase, s.seed).concat(Demand.extra(s.config, s.phase, ev)));
    var result = Sim.run({ g: g, config: s.config, phase: s.phase, plan: plan, requests: requests, event: ev });
    s.current = { plan: plan, result: result, metrics: Metrics.summarize(result, g, plan, s.config), expected: expected(s, plan), requestsN: result.passengers.length, event: ev };
    s.stage = 'run';
    return result;
  }

  function residentRecords(s, result) {
    var out = {};
    s.config.residents.forEach(function (rd) {
      if (rd.fromPhase > s.phase) { out[rd.id] = null; return; }
      var p = result.passengers.filter(function (x) { return s.config.day ? x.residentId===rd.id&&x.leg==='outbound' : x.kind === 'base' && x.o === rd.o && x.d === rd.d && x.key.slice(-2) === '-0'; })[0];
      if(s.config.day){
        var back=result.passengers.filter(function(x){return x.residentId===rd.id&&x.leg==='return';})[0];
        out[rd.id]=p?{o:p.o,d:p.d,finalDestination:p.returnTrip&&p.returnTrip.destination||p.o,multiStop:!!rd.itineraries,t:p.t,status:p.status,waitTotal:p.waitTotal+(back?back.waitTotal:0),arriveT:p.arriveT,firstBoardT:p.firstBoardT,transfer:p.boardings>1||(back&&back.boardings>1),
          returnT:back?back.t:p.returnReadyT,homeT:back?back.arriveT:null,returnStatus:back?back.status:null,dayStatus:p.status!=='arrived'?'outboundIncomplete':back&&back.status==='arrived'?'complete':'returnIncomplete'}:null;
        return;
      }
      out[rd.id] = p ? { t: p.t, status: p.status, waitTotal: p.waitTotal, arriveT: p.arriveT, firstBoardT: p.firstBoardT, boardings: p.boardings,
        transfer: !!(p.journey && p.journey.length === 2), fail: p.fail } : null;
    });
    return out;
  }

  function finishRun(s) {
    if (s.stage !== 'run' || !s.current) return null;
    var c = s.current, D = {}, before = clone(s.trust);
    Object.keys(c.metrics.zones).forEach(function (z) {
      D[z] = c.metrics.zones[z].D;
      s.trust[z] = Metrics.nextTrust(s.trust[z] != null ? s.trust[z] : s.config.trust.initial, D[z], s.config);
    });
    var entry = {
      phase: s.phase, plan: c.plan, routeIds: Sim.operatingRoutes(c.plan).map(function (r) { return r.id; }),
      metrics: c.metrics, expected: c.expected, requestsN: c.requestsN, D: D, trustBefore: before, trustAfter: clone(s.trust),
      event: c.event, petition: c.result.petition, residents: residentRecords(s, c.result), goal: s.goal
    };
    s.history.push(entry);
    s.stage = 'result';
    return entry;
  }

  function nextPhase(s) {
    if (s.stage !== 'result') return false;
    if (s.phase >= s.config.phases.length) { s.stage = 'ending'; return true; }
    s.phase++;
    if (s.config.progression) {
      // 도전 모드에서 노선 한도가 5가 되는 단계는 항상 5번 직행 자리에 새 노선을 만든다(앞 단계에서 지운 번호가 있어도)
      var express = s.config.challengeApplied ? (s.phase===8?6:s.phase===6?5:null) : null;
      var newRoute = s.config.progression.routes[s.phase-1]>s.config.progression.routes[s.phase-2] ? addRoute(s, {nodes:[], stops:[]}, express) : null;
      while (s.owned < s.config.progression.buses[s.phase - 1]) {
        s.owned++;
        s.draft.buses.push({id:s.owned, routeNum:newRoute ? newRoute.num : null, offset:0});
      }
    }
    s.stage = 'reveal'; s.goal = null; s.lastRec = null; s.current = null;
    graph(s).nodes.forEach(function (id) { if (s.trust[id] == null) s.trust[id] = s.config.trust.initial; });
    return true;
  }

  function endingSummary(s) {
    var zones = {};
    var all = Graph.build(s.config, s.config.phases.length).nodes;
    all.forEach(function (z) {
      var hist = s.history.map(function (h) {
        var m = h.metrics.zones[z];
        return { phase: h.phase, N: m ? m.N : 0, rate: m ? m.rate : null, maxWait: m ? m.maxWait : 0, trust: h.trustAfter[z] };
      });
      zones[z] = { history: hist, subtitle: Metrics.subtitle(hist, s.config) };
    });
    var residents = {};
    s.config.residents.forEach(function (rd) { residents[rd.id] = s.history.map(function (h) { return h.residents[rd.id]; }); });
    var perPhase = s.history.map(function (h) { return h.metrics.costs; });
    return {
      zones: zones, residents: residents, goalHistory: s.goalHistory.slice(), seed: s.seed, mode: s.mode,
      finance: { perPhase: perPhase, balance: perPhase.reduce(function (a, c) { return a + c.total; }, 0) }
    };
  }

  var api = {
    parseSeedParam: parseSeedParam, create: create, graph: graph, visibleNodeIds: visibleNodeIds, routeByNum: routeByNum,
    toPlan: toPlan, validate: validate, routeLimit: routeLimit, routesInOrder: routesInOrder, stopLimit:stopLimit, routeFits:routeFits, routeRule:routeRule, canAssign:canAssign, addRoute: addRoute, updateRoute: updateRoute, deleteRoute: deleteRoute,
    assign: assign, setOffset: setOffset, beginPlan: beginPlan, introduceFourth: introduceFourth,
    chooseGoal: chooseGoal, markGoalAction: markGoalAction, applyRecommendation: applyRecommendation, applyFourth: applyFourth,
    revealed: revealed, expected: expected, startRun: startRun, finishRun: finishRun, nextPhase: nextPhase, endingSummary: endingSummary
  };
  root.PB = root.PB || {};
  root.PB.Session = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
