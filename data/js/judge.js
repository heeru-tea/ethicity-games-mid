/*
 * 규칙 기반 판정(기획서 §5, spec §5.4) — 실제 AI가 아니라 단순화한 규칙이다.
 * 장면마다 조합(필요한 데이터 묶음)이 가방에 충분히 들었는지만 본다.
 * - 일반 카드: 그 key +1. 한 카드는 그 key를 쓰는 모든 장면의 조합에 함께 센다.
 * - "?" 카드: 붙인 설명표가 맞으면 truthKey +ambiguousWeight, 틀리면 셈 없이 mislabeled.
 *   assigned가 null(넣지 않기)·undefined(미결정)면 제출에서 빠진다.
 * - 실패 종류는 빠진 조합으로 정한다: 침수 조합(danger)이 하나라도 빠지면 'danger', 아니면 'inconvenience'.
 */
(function (root) {
  'use strict';

  function tally(mission, bag, cfg) {
    var counts = {}, mislabeled = [];
    var weight = (cfg && cfg.ambiguousWeight) || 1;
    var amb = {};
    (mission.ambiguous || []).forEach(function (a) { amb[a.id] = a; });
    bag.forEach(function (card) {
      if (card.ambiguousId) {
        if (card.assigned === null || card.assigned === undefined) return;
        var def = amb[card.ambiguousId];
        if (def && card.assigned === def.correctLabel) counts[def.truthKey] = (counts[def.truthKey] || 0) + weight;
        else mislabeled.push(card.id);
        return;
      }
      counts[card.key] = (counts[card.key] || 0) + 1;
    });
    return { counts: counts, mislabeled: mislabeled };
  }

  function judge(mission, bag, cfg) {
    var t = tally(mission, bag || [], cfg);
    var scenes = mission.scenes.map(function (scene) {
      var missing = scene.combos.filter(function (c) {
        var have = c.keys.reduce(function (n, k) { return n + (t.counts[k] || 0); }, 0);
        return have < c.need;
      });
      var pass = missing.length === 0;
      return {
        id: scene.id,
        pass: pass,
        failKind: pass ? null : (missing.some(function (c) { return c.danger; }) ? 'danger' : 'inconvenience'),
        missing: missing.map(function (c) { return c.id; })
      };
    });
    return { scenes: scenes, mislabeled: t.mislabeled, allPass: scenes.every(function (s) { return s.pass; }) };
  }

  // 빠진 조합의 결과 문구(장면 순서, 같은 문구는 한 번만)
  function missingLines(mission, result) {
    var byId = {};
    mission.scenes.forEach(function (s) { s.combos.forEach(function (c) { byId[c.id] = c; }); });
    var out = [];
    result.scenes.forEach(function (s) {
      s.missing.forEach(function (id) {
        var line = byId[id] && byId[id].missingLine;
        if (line && out.indexOf(line) < 0) out.push(line);
      });
    });
    return out;
  }

  // 빠진 조합을 채우려면 key마다 몇 장이 더 필요한지(보충 코스용). 여러 장면이 같은 key를 쓰면 큰 쪽.
  function shortfall(mission, bag, cfg) {
    var t = tally(mission, bag || [], cfg), out = {};
    mission.scenes.forEach(function (s) {
      s.combos.forEach(function (c) {
        var have = c.keys.reduce(function (n, k) { return n + (t.counts[k] || 0); }, 0);
        var lack = c.need - have, k0 = c.keys[0];
        if (lack > 0) out[k0] = Math.max(out[k0] || 0, lack);
      });
    });
    return out;
  }

  var api = { judge: judge, missingLines: missingLines, shortfall: shortfall };
  root.DR = root.DR || {};
  root.DR.Judge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
