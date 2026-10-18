/*
 * 승객 엔진 (PRD §7·§9) — 결정적 순수 함수.
 * 같은 계획·요청이면 재생 속도와 무관하게 승객별로 같은 결과를 낸다.
 *
 * 한 분(t) 안의 처리 순서:
 *   ① 요청 생성(여정 1회 탐색) → 사건 기록·청원 판정
 *   ② 환승 준비 완료(하차 1분 뒤) → 대기열
 *   ③ 버스 ID순 도착 처리: 하차(목적지 도착 / 환승지 하차) → 빈 좌석에 대기열 순서대로 승차(120분엔 승차 없음)
 * 여정은 정원을 무시한 최단 도착(직행 또는 다른 노선으로 1회 환승)으로 정하고 구간(노선·승하차 정류장)을 고정한다.
 * 만차·연결을 놓치면 같은 구간의 다음 버스를 기다린다(재탐색 없음).
 */
(function (root) {
  'use strict';
  var NODE = typeof require === 'function' && typeof module !== 'undefined';
  var Graph = NODE ? require('./graph.js') : root.PB.Graph;
  var Schedule = NODE ? require('./schedule.js') : root.PB.Schedule;

  function operatingRoutes(plan) {
    var seen = {}, out = [];
    plan.buses.forEach(function (b) {
      if (!b.route) return;
      var id = Graph.routeId(b.route);
      if (!seen[id]) { seen[id] = true; out.push({ id: id, route: b.route }); }
    });
    return out.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
  }

  function stopSet(route) {
    var s = {};
    route.nodes.forEach(function (n, i) { if (route.stops[i]) s[n] = true; });
    return s;
  }

  // 운행 노선으로 최대 1회 환승해 구조적으로 이어지는지(정차 지점만, 시간·정원 무시)
  function structural(g, plan, o, d) {
    var rs = operatingRoutes(plan).map(function (r) { return { id: r.id, s: stopSet(r.route) }; });
    for (var i = 0; i < rs.length; i++) {
      if (!rs[i].s[o]) continue;
      if (rs[i].s[d]) return true;
      for (var j = 0; j < rs.length; j++) {
        if (j === i || !rs[j].s[d]) continue;
        for (var x in rs[i].s) if (x !== o && rs[j].s[x]) return true;
      }
    }
    return false;
  }

  // 버스별 정차 방문에서 “같은 run 안에서 앞으로 정차할 노드 → 도착 시각” 표를 만든다
  function indexBus(tl) {
    var stops = [];
    tl.visits.forEach(function (v, k) { if (v.kind === 'stop') stops.push(k); });
    var ahead = {};
    stops.forEach(function (k) {
      var v = tl.visits[k], map = {};
      for (var m = k + 1; m < tl.visits.length; m++) {
        var w = tl.visits[m];
        if (w.runIn !== v.runOut) break;
        if (w.kind === 'stop' && map[w.node] == null) map[w.node] = w.t;
        if (w.runOut !== w.runIn) break; // 끝점에서 run이 끝난다
      }
      ahead[k] = map;
    });
    var byNode = {};
    stops.forEach(function (k) { (byNode[tl.visits[k].node] = byNode[tl.visits[k].node] || []).push(k); });
    return { tl: tl, ahead: ahead, byNode: byNode };
  }

  function makePlanner(buses, window) {
    var memo = new Map(), pairs = {};
    // 버스별 (x→d) 승차 시각·도착 시각 표(승차 시각 오름차순). 처음 필요할 때 만든다
    function pairTable(x, d) {
      var key = x + d;
      if (pairs[key]) return pairs[key];
      var list = [];
      buses.forEach(function (b) {
        var boards = [], arrs = [], ks = b.byNode[x] || [];
        for (var i = 0; i < ks.length; i++) {
          var v = b.tl.visits[ks[i]], arr = b.ahead[ks[i]][d];
          if (arr != null && v.t < window) { boards.push(v.t); arrs.push(arr); }
        }
        if (boards.length) list.push({ routeId: b.tl.routeId, boards: boards, arrs: arrs });
      });
      return (pairs[key] = list);
    }
    // x에서 ready 이후 타서 d에 가장 일찍 내리는 시각(노선 excl 제외). 없으면 null
    function direct(x, d, ready, excl) {
      var key = x + d + '|' + ready + '|' + excl;
      var hit = memo.get(key);
      if (hit !== undefined) return hit;
      var best = null, list = pairTable(x, d);
      for (var j = 0; j < list.length; j++) {
        var e = list[j];
        if (e.routeId === excl) continue;
        var lo = 0, hi = e.boards.length;
        while (lo < hi) { var mid = (lo + hi) >> 1; if (e.boards[mid] < ready) lo = mid + 1; else hi = mid; }
        if (lo === e.boards.length) continue;
        var arr = e.arrs[lo];
        if (!best || arr < best.arr || (arr === best.arr && e.routeId < best.routeId)) best = { arr: arr, routeId: e.routeId };
      }
      memo.set(key, best);
      return best;
    }
    function better(a, b) {
      if (!b) return true;
      if (a.arr !== b.arr) return a.arr < b.arr;
      if (a.legs.length !== b.legs.length) return a.legs.length < b.legs.length;
      for (var i = 0; i < a.legs.length; i++) if (a.legs[i].routeId !== b.legs[i].routeId) return a.legs[i].routeId < b.legs[i].routeId;
      return a.legs[0].to < b.legs[0].to;
    }
    return function plan(o, d, ready, transferMin) {
      var best = null;
      var dir = direct(o, d, ready, null);
      if (dir) best = { arr: dir.arr, legs: [{ routeId: dir.routeId, from: o, to: d }] };
      buses.forEach(function (b) {
        var ks = b.byNode[o] || [], tried = {};
        for (var i = 0; i < ks.length; i++) {
          var v = b.tl.visits[ks[i]];
          if (v.t < ready || v.t >= window) continue;
          var ah = b.ahead[ks[i]];
          for (var x in ah) {
            // 같은 버스에서 x까지는 먼저 탈수록 먼저 도착하므로 첫 승차만 보면 된다
            if (x === d || tried[x]) continue;
            tried[x] = true;
            var second = direct(x, d, ah[x] + transferMin, b.tl.routeId);
            if (!second) continue;
            var cand = { arr: second.arr, legs: [{ routeId: b.tl.routeId, from: o, to: x }, { routeId: second.routeId, from: x, to: d }] };
            if (better(cand, best)) best = cand;
          }
        }
      });
      return best;
    };
  }

  function run(input) {
    var g = input.g, config = input.config, plan = input.plan, event = input.event || null;
    var W = config.bus.window, cap = config.bus.capacity, tMin = config.bus.transferMin, F = config.finance;
    var timelines = plan.buses.map(function (b) { return Schedule.timeline(g, config, b.id, b.route, b.offset); });
    var indexed = timelines.filter(function (tl) { return tl.route; }).map(indexBus);
    var planner = makePlanner(indexed, W);

    var passengers = input.requests.map(function (r) {
      return { id: r.id, key: r.key, o: r.o, d: r.d, t: r.t, kind: r.kind, journey: null, fail: null, status: 'pending',
        firstBoardT: null, arriveT: null, waitTotal: 0, boardings: 0, legIndex: 0, _waitStart: null, _ready: null, _bus: null };
    });
    var byT = {};
    passengers.forEach(function (p) { (byT[p.t] = byT[p.t] || []).push(p); });
    var queue = [];       // 정류장에서 기다리는 사람(최초·환승)
    var walking = [];     // 환승 이동 중(준비 시각 대기)
    var onBus = {};       // busId → 탑승자
    timelines.forEach(function (tl) { onBus[tl.busId] = []; });
    var visitAt = {};     // t → [{tl, visit, idx}]
    indexed.forEach(function (b) {
      b.tl.visits.forEach(function (v, k) { (visitAt[v.t] = visitAt[v.t] || []).push({ b: b, v: v, k: k }); });
    });
    Object.keys(visitAt).forEach(function (t) { visitAt[t].sort(function (a, c) { return a.b.tl.busId - c.b.tl.busId; }); });

    var log = [], petition = null, linkMemo = {};

    for (var t = 0; t <= W; t++) {
      // ① 요청 생성
      (byT[t] || []).forEach(function (p) {
        var j = planner(p.o, p.d, t, tMin);
        p.status = 'waiting';
        p._waitStart = t;
        if (j) { p.journey = j.legs; queue.push(p); }
        else {
          var lk = p.o + p.d;
          if (!(lk in linkMemo)) linkMemo[lk] = structural(g, plan, p.o, p.d);
          p.fail = linkMemo[lk] ? 'NO_TRIP_IN_WINDOW' : 'NO_LINK';
        }
        log.push({ t: t, type: 'request', pid: p.id, node: p.o });
      });
      if (event && event.t === t && event.type !== 'none') {
        log.push({ t: t, type: 'event', data: { type: event.type } });
        if (event.type === 'petition') petition = judgePetition(passengers, t);
        if (petition) log.push({ t: t, type: 'petition', node: petition.zone, data: petition });
      }
      // ② 환승 준비 완료
      walking = walking.filter(function (p) {
        if (p._ready !== t) return true;
        p._waitStart = t;
        queue.push(p);
        return false;
      });
      // ③ 버스 도착
      (visitAt[t] || []).forEach(function (e) {
        if (e.v.kind !== 'stop') return;
        var busId = e.b.tl.busId, riders = onBus[busId];
        onBus[busId] = riders.filter(function (p) {
          var leg = p.journey[p.legIndex];
          if (leg.to !== e.v.node) return true;
          if (p.legIndex === p.journey.length - 1) {
            p.status = 'arrived'; p.arriveT = t; p._bus = null;
            log.push({ t: t, type: 'arrive', pid: p.id, bus: busId, node: e.v.node });
          } else {
            p.status = 'transfer'; p.legIndex++; p._ready = t + tMin; p._bus = null;
            walking.push(p);
            log.push({ t: t, type: 'alight', pid: p.id, bus: busId, node: e.v.node });
          }
          return false;
        });
        if (t >= W) return;
        var ah = e.b.ahead[e.k];
        var eligible = queue.filter(function (p) {
          var leg = p.journey[p.legIndex];
          return leg.from === e.v.node && leg.routeId === e.b.tl.routeId && ah[leg.to] != null;
        }).sort(function (a, c) { return a._waitStart - c._waitStart || a.id - c.id; });
        var free = cap - onBus[busId].length;
        eligible.slice(0, Math.max(0, free)).forEach(function (p) {
          p.waitTotal += t - p._waitStart;
          p._waitStart = null;
          if (p.firstBoardT == null) p.firstBoardT = t;
          p.status = 'riding';
          p.boardings++;
          p._bus = busId;
          onBus[busId].push(p);
          queue.splice(queue.indexOf(p), 1);
          log.push({ t: t, type: 'board', pid: p.id, bus: busId, node: e.v.node });
        });
      });
    }

    // 종료: 아직 기다리는 사람의 대기를 120분까지 더한다
    passengers.forEach(function (p) {
      if (p._waitStart != null && p.status !== 'arrived') p.waitTotal += W - p._waitStart;
      if (p.status === 'transfer' || p.status === 'riding' || p.status === 'arrived') return;
      p.status = 'waiting';
    });
    passengers.forEach(function (p) { delete p._waitStart; delete p._ready; delete p._bus; });

    var users = passengers.filter(function (p) { return p.firstBoardT != null; });
    var costs = {
      subsidy: F.subsidy,
      fare: F.fare * users.length,
      holding: F.holding * plan.buses.length,
      op: F.opPerMin * timelines.reduce(function (s, tl) { return s + tl.opMinutes; }, 0),
      move: F.movePerMin * timelines.reduce(function (s, tl) { return s + tl.moveMinutes; }, 0),
      paidUnfinished: users.filter(function (p) { return p.status !== 'arrived'; }).length
    };
    costs.total = costs.subsidy + costs.fare - costs.holding - costs.op - costs.move;

    return { timelines: timelines, passengers: passengers, log: log, costs: costs, petition: petition };
  }

  // 그 시각까지 생긴 요청 중 미완료 비율이 가장 높은 출발 생활권(동률 ID순). 미완료 0명이면 없음
  function judgePetition(passengers, t) {
    var z = {};
    passengers.forEach(function (p) {
      if (p.t > t) return;
      var s = z[p.o] = z[p.o] || { total: 0, open: 0 };
      s.total++;
      if (p.status !== 'arrived') s.open++;
    });
    var best = null;
    Object.keys(z).sort().forEach(function (id) {
      var r = z[id].open / z[id].total;
      if (!best || r > best.r) best = { id: id, r: r };
    });
    if (!best || z[best.id].open === 0) return null;
    return { zone: best.id, t: t, count: z[best.id].open, total: z[best.id].total };
  }

  // 승객별 결과를 짧은 해시로(FNV-1a) — 결정성 검사용
  function hash(result) {
    var s = result.passengers.map(function (p) { return [p.id, p.status, p.firstBoardT, p.arriveT, p.waitTotal, p.boardings].join(','); }).join(';');
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16);
  }

  var api = { run: run, operatingRoutes: operatingRoutes, structural: structural, hash: hash };
  root.PB = root.PB || {};
  root.PB.Sim = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
