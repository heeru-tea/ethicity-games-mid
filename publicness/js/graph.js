/*
 * 도로 그래프와 노선 규칙 (PRD §4) — 화면을 모르는 순수 함수.
 * Route = { nodes: ['B','A','G','E'], stops: [true,true,false,true] } (양 끝은 항상 정차)
 */
(function (root) {
  'use strict';

  function build(config, phase) {
    var nodes = config.nodes.filter(function (n) { return n.fromPhase <= phase; }).map(function (n) { return n.id; }).sort();
    var adj = {};
    nodes.forEach(function (id) { adj[id] = []; });
    config.roads.forEach(function (r) {
      if (r.fromPhase > phase || !adj[r.a] || !adj[r.b]) return;
      adj[r.a].push({ to: r.b, min: r.min });
      adj[r.b].push({ to: r.a, min: r.min });
    });
    Object.keys(adj).forEach(function (id) { adj[id].sort(function (p, q) { return p.to < q.to ? -1 : 1; }); });
    return {
      phase: phase,
      nodes: nodes,
      adj: adj,
      has: function (id) { return !!adj[id]; },
      time: function (a, b) {
        if (!adj[a]) return null;
        for (var i = 0; i < adj[a].length; i++) if (adj[a][i].to === b) return adj[a][i].min;
        return null;
      }
    };
  }

  function neighbors(g, id) {
    return (g.adj[id] || []).map(function (e) { return e.to; });
  }

  function validateRoute(g, route) {
    var errs = [];
    var n = route && route.nodes, s = route && route.stops;
    if (!n || !s || n.length !== s.length) return ['노선 정보가 올바르지 않아요.'];
    if (n.length < 2) errs.push('노선에는 정류장이 두 곳 이상 있어야 해요.');
    var seen = {};
    for (var i = 0; i < n.length; i++) {
      if (!g.has(n[i])) { errs.push('지금 지도에 없는 정류장이 들어 있어요.'); break; }
      if (seen[n[i]]) { errs.push('한 방향 노선에서 같은 정류장을 두 번 지날 수 없어요.'); break; }
      seen[n[i]] = true;
      if (i > 0 && g.time(n[i - 1], n[i]) == null) { errs.push('도로로 바로 이어지지 않은 정류장이 있어요.'); break; }
    }
    if (n.length >= 2 && (!s[0] || !s[n.length - 1])) errs.push('노선의 양 끝 정류장은 반드시 정차해야 해요.');
    return errs;
  }

  function idString(nodes, stops) {
    return nodes.map(function (id, i) { return stops[i] ? id : id.toLowerCase(); }).join('-');
  }
  function routeId(route) {
    var fwd = idString(route.nodes, route.stops);
    var rev = idString(route.nodes.slice().reverse(), route.stops.slice().reverse());
    return fwd.toUpperCase() < rev.toUpperCase() || (fwd.toUpperCase() === rev.toUpperCase() && fwd <= rev) ? fwd : rev;
  }

  function oneWayMinutes(g, route) {
    var sum = 0;
    for (var i = 1; i < route.nodes.length; i++) sum += g.time(route.nodes[i - 1], route.nodes[i]);
    return sum;
  }

  // 편도 도로 합×2 + 끝점 정차 2분 + 내부 정차 지점 수×2분
  function cycleMinutes(g, route) {
    var inner = 0;
    for (var i = 1; i < route.nodes.length - 1; i++) if (route.stops[i]) inner++;
    return oneWayMinutes(g, route) * 2 + 2 + inner * 2;
  }

  function lessPath(p, q) {
    for (var i = 0; i < Math.min(p.length, q.length); i++) if (p[i] !== q[i]) return p[i] < q[i];
    return p.length < q.length;
  }

  // 최단 시간 경로. 동률이면 노드 열을 사전순으로 비교해 앞선 것
  function shortestPath(g, from, to) {
    var best = {};
    best[from] = { minutes: 0, nodes: [from] };
    var done = {};
    for (;;) {
      var cur = null;
      Object.keys(best).forEach(function (id) {
        if (done[id]) return;
        if (!cur || best[id].minutes < best[cur].minutes || (best[id].minutes === best[cur].minutes && lessPath(best[id].nodes, best[cur].nodes))) cur = id;
      });
      if (!cur) return null;
      if (cur === to) return { nodes: best[cur].nodes, minutes: best[cur].minutes };
      done[cur] = true;
      g.adj[cur].forEach(function (e) {
        if (done[e.to]) return;
        var cand = { minutes: best[cur].minutes + e.min, nodes: best[cur].nodes.concat(e.to) };
        var old = best[e.to];
        if (!old || cand.minutes < old.minutes || (cand.minutes === old.minutes && lessPath(cand.nodes, old.nodes))) best[e.to] = cand;
      });
    }
  }

  var api = {
    build: build,
    neighbors: neighbors,
    validateRoute: validateRoute,
    routeId: routeId,
    oneWayMinutes: oneWayMinutes,
    cycleMinutes: cycleMinutes,
    shortestPath: shortestPath
  };
  root.PB = root.PB || {};
  root.PB.Graph = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
