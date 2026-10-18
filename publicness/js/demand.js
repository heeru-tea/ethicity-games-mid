/*
 * 기본 수요와 사건 (PRD §6).
 * 각 요청자는 그 단계에 한 번 이동하는 고유 가상 인물이다.
 * 요청 id: 기본 phase*100000 + r*100 + i, 사건 추가분 phase*100000 + 90000 + k
 */
(function (root) {
  'use strict';
  var Rng = (typeof require === 'function' && typeof module !== 'undefined') ? require('./rng.js') : root.PB.Rng;

  // 표의 행을 위에서부터, 각 행의 앞→뒤·뒤→앞 순으로 펼친다. r = 펼친 행 번호
  function directional(config, phase) {
    var out = [];
    config.demandRows.forEach(function (row, k) {
      if (row.fromPhase > phase) return;
      out.push({ r: 2 * k, o: row.a, d: row.b, n: row.n });
      out.push({ r: 2 * k + 1, o: row.b, d: row.a, n: row.n });
    });
    return out;
  }

  function sortReqs(list) {
    return list.sort(function (a, b) { return a.t - b.t || a.id - b.id; });
  }

  function base(config, phase, seed) {
    var W = config.bus.requestWindow, out = [];
    directional(config, phase).forEach(function (od) {
      for (var i = 0; i < od.n; i++) {
        var t = (Math.floor(W * i / od.n) + seed + 11 * od.r + 7 * phase) % W;
        out.push({ id: phase * 100000 + od.r * 100 + i, key: 'P' + phase + '-R' + od.r + '-' + i, o: od.o, d: od.d, t: t, kind: 'base', row: od.r, i: i });
      }
    });
    return sortReqs(out);
  }

  // 세션 시작 시 단계 순서대로 유형→시각→OD를 한 번씩 추첨(무사건도 세 값을 모두 소비)
  function drawEvents(config, seed) {
    var r = Rng.create(seed), E = config.events, out = [];
    for (var p = 1; p <= config.phases.length; p++) {
      var u1 = r.next(), u2 = r.next(), u3 = r.next();
      out.push({
        phase: p,
        type: u1 < E.pNone ? 'none' : u1 < E.pDemand ? 'demand' : 'petition',
        t: E.timeBase + Math.floor(E.timeSpan * u2),
        odIndex: Math.floor(directional(config, p).length * u3)
      });
    }
    return out;
  }

  // 추가 수요: 사건 시각부터 0~5분 사이에 매 분 2명(총 12명)
  function extra(config, phase, ev) {
    if (!ev || ev.type !== 'demand') return [];
    var od = directional(config, phase)[ev.odIndex], E = config.events, out = [], k = 0;
    for (var m = 0; m < E.extraMinutes; m++) {
      for (var j = 0; j < E.extraPerMin; j++, k++) {
        out.push({ id: phase * 100000 + 90000 + k, key: 'P' + phase + '-E-' + k, o: od.o, d: od.d, t: ev.t + m, kind: 'extra', row: od.r, i: k });
      }
    }
    return out;
  }

  var api = { directional: directional, base: base, drawEvents: drawEvents, extra: extra, sortReqs: sortReqs };
  root.PB = root.PB || {};
  root.PB.Demand = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
