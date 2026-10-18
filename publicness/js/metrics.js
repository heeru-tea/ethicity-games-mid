/*
 * 지표·불만·신뢰·결말 소제목 (PRD §9·§10).
 * 모든 비율의 분모는 현재 단계의 실제 요청 수 N. 분모가 0이면 null(화면에서 ‘요청 없음’).
 * 불만 D와 신뢰는 게임 반응 속도를 위한 설명용 지수이며 실제 주민 심리 척도가 아니다.
 */
(function (root) {
  'use strict';
  var Sim = (typeof require === 'function' && typeof module !== 'undefined') ? require('./sim.js') : root.PB.Sim;

  function r1(x) { return Math.round(x * 10) / 10; }
  function ratio(a, n) { return n ? a / n : null; }
  function avg(list) { return list.length ? list.reduce(function (s, x) { return s + x; }, 0) / list.length : null; }

  function discontent(z, config) {
    if (!z.N) return null;
    var w = config.discontent.w;
    return r1(100 * (w[0] * (z.N - z.arrived) / z.N + w[1] * z.waitOver / z.N + w[2] * z.tripOver / z.N));
  }

  function nextTrust(prev, D, config) {
    if (D == null) return prev;
    var k = config.trust.keep;
    return r1(k * prev + (1 - k) * (100 - D));
  }

  function summarize(result, g, plan, config) {
    var W = config.bus.window, ps = result.passengers;
    var count = function (list, s) { return list.filter(function (p) { return p.status === s; }).length; };
    var zones = {};
    g.nodes.forEach(function (id) {
      var mine = ps.filter(function (p) { return p.o === id; });
      var z = {
        N: mine.length,
        arrived: count(mine, 'arrived'), waiting: count(mine, 'waiting'), transfer: count(mine, 'transfer'), riding: count(mine, 'riding'),
        maxWait: mine.reduce(function (m, p) { return Math.max(m, p.waitTotal); }, 0),
        waitOver: mine.filter(function (p) { return p.waitTotal > config.discontent.waitOver; }).length,
        tripOver: mine.filter(function (p) { return (p.arriveT != null ? p.arriveT : W) - p.t > config.discontent.tripOver; }).length
      };
      z.rate = ratio(z.arrived, z.N);
      z.D = discontent(z, config);
      zones[id] = z;
    });
    var done = ps.filter(function (p) { return p.status === 'arrived'; });
    var open = ps.filter(function (p) { return p.status !== 'arrived'; });
    var ess = ps.filter(function (p) { return config.essential.indexOf(p.d) >= 0; });
    var linkMemo = {};
    var linked = ess.filter(function (p) {
      var k = p.o + p.d;
      if (!(k in linkMemo)) linkMemo[k] = Sim.structural(g, plan, p.o, p.d);
      return linkMemo[k];
    });
    return {
      N: ps.length,
      users: ps.filter(function (p) { return p.firstBoardT != null; }).length,
      boardings: ps.reduce(function (s, p) { return s + p.boardings; }, 0),
      arrived: done.length, waiting: count(ps, 'waiting'), transfer: count(ps, 'transfer'), riding: count(ps, 'riding'),
      arrivalRate: ratio(done.length, ps.length),
      maxWait: ps.reduce(function (m, p) { return Math.max(m, p.waitTotal); }, 0),
      travel: {
        doneAvg: avg(done.map(function (p) { return p.arriveT - p.t; })),
        openAvg: avg(open.map(function (p) { return W - p.t; }))
      },
      essential: {
        N: ess.length,
        linkRate: ratio(linked.length, ess.length),
        arriveRate: ratio(ess.filter(function (p) { return p.status === 'arrived'; }).length, ess.length)
      },
      zones: zones,
      costs: result.costs
    };
  }

  // 생활권 결말 소제목. 관측 단계 = 요청이 있던 단계
  function subtitle(zoneHistory, config) {
    var E = config.ending, obs = zoneHistory.filter(function (h) { return h.N > 0; });
    var out = { kind: 'remaining', rates: obs.map(function (h) { return h.rate; }), first: null, last: null, firstPhase: null, lastPhase: null };
    if (!obs.length) return out;
    var first = obs[0], last = obs[obs.length - 1];
    out.first = first.rate; out.last = last.rate; out.firstPhase = first.phase; out.lastPhase = last.phase;
    if (obs.length < 2) return out;
    var tail = obs.slice(-2);
    var stable = tail.every(function (h) { return h.rate >= E.stableRate && h.maxWait <= E.stableMaxWait; });
    if (stable) out.kind = 'stable';
    else if (last.rate - first.rate >= E.improvePts - 1e-9) out.kind = 'improving';
    return out;
  }

  function fmtRate(r) { return r == null ? '요청 없음' : Math.round(r * 100) + '%'; }

  var api = { summarize: summarize, discontent: discontent, nextTrust: nextTrust, subtitle: subtitle, fmtRate: fmtRate };
  root.PB = root.PB || {};
  root.PB.Metrics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
