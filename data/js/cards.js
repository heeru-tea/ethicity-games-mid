/*
 * 카드의 진짜 종류·붙은 이름표(spec §3.2) — 판정·코스·달리기·검수가 모두 이것을 쓴다.
 * - 보통 카드 {key}: 진짜 = key, 이름표 = cardTypes[key].label(2 임무) 또는 key 자체(1 임무).
 * - 가짜 카드 {fakeId}: 진짜 = fake.truth(없을 수 있음), 이름표 = fake.label.
 * - 2 임무에서 고친 카드는 card.label이 이름표를 덮는다.
 * - "?" 카드 {ambiguousId}: 이 모듈의 이름표 규칙 밖(첫 버전 규칙 그대로) — currentLabel·truthKey는 null.
 */
(function (root) {
  'use strict';

  function fakeDef(mission, id) {
    var list = mission.fakes || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function ambDef(mission, id) {
    var list = mission.ambiguous || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function labelOfKey(mission, key) {
    var t = mission.cardTypes[key];
    return (t && t.label) || key;
  }

  function currentLabel(mission, card) {
    if (card.ambiguousId) return null;
    if (card.label) return card.label;
    if (card.key) return labelOfKey(mission, card.key);
    var f = fakeDef(mission, card.fakeId);
    return f ? f.label : null;
  }

  function truthKey(mission, card) {
    if (card.key) return card.key;
    if (card.fakeId) { var f = fakeDef(mission, card.fakeId); return (f && f.truth) || null; }
    return null;
  }

  function isMislabeled(mission, card) {
    if (card.ambiguousId) return false;
    var t = truthKey(mission, card);
    return t === null || labelOfKey(mission, t) !== currentLabel(mission, card);
  }

  function harm(mission, card) {
    var t = truthKey(mission, card);
    return t && mission.cardTypes[t] && mission.cardTypes[t].hazard ? 'danger' : 'inconvenience';
  }

  function sourceId(mission, card) {
    if (card.fakeId) return card.fakeId;
    return 'mis:' + card.key + ':' + currentLabel(mission, card);
  }

  function scenesForLabel(mission, label) {
    return mission.scenes.filter(function (s) {
      return s.combos.some(function (c) {
        return c.keys.some(function (k) { return labelOfKey(mission, k) === label; });
      });
    }).map(function (s) { return s.id; });
  }

  function iconsOf(mission, card) {
    if (card.ambiguousId) {
      var q = ambDef(mission, card.ambiguousId);
      return card.assigned ? [q.icons[0], card.assigned] : q.icons;
    }
    var label = currentLabel(mission, card);
    if (mission.labels) return [label];
    return (mission.cardTypes[label] && mission.cardTypes[label].icons) || [];
  }

  function artId(card) { return card.key || card.ambiguousId || card.fakeId; }

  function labelText(mission, label) {
    var opts = (mission.labels || []).concat(mission.labelOptions || []);
    for (var i = 0; i < opts.length; i++) if (opts[i].id === label) return opts[i].text;
    var t = mission.cardTypes[label];
    return (t && t.name) || label;
  }

  var api = {
    fakeDef: fakeDef, labelOfKey: labelOfKey, currentLabel: currentLabel, truthKey: truthKey,
    isMislabeled: isMislabeled, harm: harm, sourceId: sourceId, scenesForLabel: scenesForLabel,
    iconsOf: iconsOf, artId: artId, labelText: labelText
  };
  root.DR = root.DR || {};
  root.DR.Cards = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
