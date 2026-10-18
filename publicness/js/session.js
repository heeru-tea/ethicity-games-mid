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
    return { buses: s.draft.buses.map(function (b) {
      var r = b.routeNum != null ? routeByNum(s, b.routeNum) : null;
      return { id: b.id, route: r ? copyRoute(r) : null, offset: b.offset };
    }) };
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
      if (!used[r.num]) return;
      Graph.validateRoute(g, r).forEach(function (e) { errs.push(r.num + '번 노선: ' + e); });
    });
    s.draft.buses.forEach(function (b) {
      if (offsets.indexOf(b.offset) < 0) errs.push(b.id + '호차의 출차 시각을 다시 골라 주세요.');
      if (b.routeNum != null && !routeByNum(s, b.routeNum)) errs.push(b.id + '호차가 없는 노선에 배정되어 있어요.');
    });
    if (s.fourthPhase === s.phase) {
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

  function addRoute(s, route) {
    var r = copyRoute(route);
    r.num = s.draft.nextNum++;
    s.draft.routes.push(r);
    return r;
  }
  function updateRoute(s, num, route) {
    var r = routeByNum(s, num);
    if (!r) return null;
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
  function assign(s, busId, routeNum) { var b = bus(s, busId); if (b) b.routeNum = routeNum; }
  function setOffset(s, busId, offset) { var b = bus(s, busId); if (b) b.offset = offset; }

  function beginPlan(s) { if (s.stage === 'reveal') s.stage = 'plan'; }

  function introduceFourth(s) {
    if (s.phase < s.config.fourthFromPhase || s.owned >= s.config.bus.maxBuses) return false;
    if (s.stage !== 'reveal' && s.stage !== 'plan') return false;
    s.owned = s.config.bus.maxBuses;
    s.fourthPhase = s.phase;
    s.draft.buses.push({ id: 4, routeNum: null, offset: 0 });
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
    buses.forEach(function (pb) {
      var b = bus(s, pb.id);
      if (!b) return;
      if (!pb.route) { b.routeNum = null; b.offset = pb.offset; return; }
      var id = Graph.routeId(pb.route), found = null;
      s.draft.routes.forEach(function (r) { if (!found && Graph.validateRoute(graph(s), r).length === 0 && Graph.routeId(r) === id) found = r; });
      if (!found) found = addRoute(s, pb.route);
      b.routeNum = found.num;
      b.offset = pb.offset;
    });
  }
  function applyRecommendation(s, rec) {
    applyPlanBuses(s, rec.plan.buses);
    s.lastRec = rec;
    markGoalAction(s, 'accept');
  }
  function applyFourth(s, rec) {
    if (!rec || !rec.fourth) return false;
    if (s.owned < s.config.bus.maxBuses && !introduceFourth(s)) return false;
    applyPlanBuses(s, rec.fourth.plan.buses);
    return true;
  }

  function revealed(s) {
    var h = s.history[s.history.length - 1];
    return Advisor.makeRevealed({
      phase: s.phase, g: graph(s), requests: Demand.base(s.config, s.phase, s.seed), owned: s.owned,
      fourthAllowed: s.phase >= s.config.fourthFromPhase, prevMetrics: h ? h.metrics : null,
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
    return Metrics.summarize(res, g, p, s.config);
  }

  function startRun(s) {
    if (s.stage !== 'plan' || validate(s).length) return null;
    var g = graph(s), plan = clone(toPlan(s)), ev = s.events[s.phase - 1];
    var requests = Demand.sortReqs(Demand.base(s.config, s.phase, s.seed).concat(Demand.extra(s.config, s.phase, ev)));
    var result = Sim.run({ g: g, config: s.config, phase: s.phase, plan: plan, requests: requests, event: ev });
    s.current = { plan: plan, result: result, metrics: Metrics.summarize(result, g, plan, s.config), expected: expected(s, plan), requestsN: requests.length, event: ev };
    s.stage = 'run';
    return result;
  }

  function residentRecords(s, result) {
    var out = {};
    s.config.residents.forEach(function (rd) {
      if (rd.fromPhase > s.phase) { out[rd.id] = null; return; }
      var p = result.passengers.filter(function (x) { return x.kind === 'base' && x.o === rd.o && x.d === rd.d && x.key.slice(-2) === '-0'; })[0];
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
    toPlan: toPlan, validate: validate, addRoute: addRoute, updateRoute: updateRoute, deleteRoute: deleteRoute,
    assign: assign, setOffset: setOffset, beginPlan: beginPlan, introduceFourth: introduceFourth,
    chooseGoal: chooseGoal, markGoalAction: markGoalAction, applyRecommendation: applyRecommendation, applyFourth: applyFourth,
    revealed: revealed, expected: expected, startRun: startRun, finishRun: finishRun, nextPhase: nextPhase, endingSummary: endingSummary
  };
  root.PB = root.PB || {};
  root.PB.Session = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
