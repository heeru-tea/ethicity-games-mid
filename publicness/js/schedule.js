/*
 * 버스 시각표 (PRD §5) — 정원과 무관하게 운행 전에 버스별로 전부 계산한다.
 * 모든 버스는 0분에 중앙역 A에 비어 있다. 출차 시각에 A를 떠나 노선의 첫 노드까지 공차 이동,
 * 도착하면 첫 정차를 처리하고 왕복을 계속한다. 정차 = 그 분에 승하차 후 1분 뒤 출발, 통과 = 머물지 않음,
 * 끝점 = 1분 정차 후 방향 전환. run = 끝점에서 끝점까지 한 방향 구간 번호.
 */
(function (root) {
  'use strict';
  var Graph = (typeof require === 'function' && typeof module !== 'undefined') ? require('./graph.js') : root.PB.Graph;

  function timeline(g, config, busId, route, offset) {
    var W = config.bus.window, dwell = config.bus.dwell;
    var tl = { busId: busId, route: route || null, routeId: route ? Graph.routeId(route) : null, offset: offset, visits: [], segments: [], opMinutes: 0, moveMinutes: 0 };
    if (!route) return tl;
    tl.opMinutes = W - offset;

    var t = offset;
    var dh = Graph.shortestPath(g, config.bus.depot, route.nodes[0]);
    for (var i = 1; i < dh.nodes.length && t < W; i++) {
      var m = g.time(dh.nodes[i - 1], dh.nodes[i]);
      tl.segments.push({ from: dh.nodes[i - 1], to: dh.nodes[i], t0: t, t1: t + m, deadhead: true });
      t += m;
    }

    var n = route.nodes.length, run = 0, idx = 0, dir = 1;
    if (t <= W) tl.visits.push({ t: t, node: route.nodes[0], kind: 'stop', runIn: -1, runOut: 0 });
    t += dwell;
    while (t < W) {
      var next = idx + dir;
      var mm = g.time(route.nodes[idx], route.nodes[next]);
      tl.segments.push({ from: route.nodes[idx], to: route.nodes[next], t0: t, t1: t + mm, deadhead: false });
      t += mm;
      idx = next;
      if (t > W) break;
      var isEnd = idx === 0 || idx === n - 1;
      if (isEnd) {
        tl.visits.push({ t: t, node: route.nodes[idx], kind: 'stop', runIn: run, runOut: run + 1 });
        run++; dir = -dir; t += dwell;
      } else if (route.stops[idx]) {
        tl.visits.push({ t: t, node: route.nodes[idx], kind: 'stop', runIn: run, runOut: run });
        t += dwell;
      } else {
        tl.visits.push({ t: t, node: route.nodes[idx], kind: 'pass', runIn: run, runOut: run });
      }
    }

    tl.moveMinutes = tl.segments.reduce(function (s, x) { return s + Math.max(0, Math.min(x.t1, W) - Math.max(x.t0, 0)); }, 0);
    return tl;
  }

  // 렌더용 위치. 출차 전·미배정은 A에 주차
  function positionAt(tl, config, t) {
    if (!tl.route || t < tl.offset) return { node: config.bus.depot, parked: true };
    for (var i = 0; i < tl.segments.length; i++) {
      var s = tl.segments[i];
      if (t >= s.t0 && t < s.t1) return { from: s.from, to: s.to, f: (t - s.t0) / (s.t1 - s.t0), parked: false };
    }
    var node = config.bus.depot;
    for (var j = 0; j < tl.segments.length; j++) if (tl.segments[j].t1 <= t) node = tl.segments[j].to;
    return { node: node, parked: false };
  }

  var api = { timeline: timeline, positionAt: positionAt };
  root.PB = root.PB || {};
  root.PB.Schedule = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
