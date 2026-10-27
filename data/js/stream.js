/*
 * 코스 생성(기획서 §4.2·§7.3) — 같은 seed면 같은 코스.
 * 카드를 섞어 "줄"(같은 z)마다 1~2장씩 놓고, 드문 카드("?" 포함)는 같은 레인 바로 앞에 노이즈 벽을 둔다.
 * 벽은 그 밖에도 줄 사이에 듬성듬성(카드 수의 약 15%). 한 줄을 세 레인 모두 막는 일은 없다.
 * 보충(focusKeys): 짧은 코스, 카드 12장 중 8장을 빠진 조합 key로 고르게 채운다.
 */
(function (root) {
  'use strict';

  var START_SECONDS = 3, END_SECONDS = 1.5;
  var SUPPLEMENT_CARDS = 12, SUPPLEMENT_FOCUS = 8, EXTRA_WALL_RATE = 0.15;

  function rngApi() {
    if (root.DR && root.DR.Rng) return root.DR.Rng;
    return require('./rng.js');
  }

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng.next() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function isRare(mission, c) { return !!c.ambiguousId || !!(mission.cardTypes[c.key] && mission.cardTypes[c.key].rare); }

  function mainDeck(mission) {
    var deck = [];
    Object.keys(mission.counts).forEach(function (k) {
      for (var i = 0; i < mission.counts[k]; i++) deck.push({ key: k });
    });
    (mission.ambiguous || []).forEach(function (a) { deck.push({ ambiguousId: a.id }); });
    return deck;
  }

  function supplementDeck(mission, focusKeys) {
    var deck = [];
    for (var i = 0; i < SUPPLEMENT_FOCUS; i++) deck.push({ key: focusKeys[i % focusKeys.length] });
    // 나머지는 흔한 카드(드물지 않은 것 중 많은 순)
    var common = Object.keys(mission.counts).filter(function (k) { return !mission.cardTypes[k].rare; })
      .sort(function (a, b) { return mission.counts[b] - mission.counts[a]; });
    for (var j = 0; deck.length < SUPPLEMENT_CARDS; j++) deck.push({ key: common[j % common.length] });
    return deck;
  }

  function build(mission, cfg, opts) {
    var focus = opts.focusKeys && opts.focusKeys.length ? opts.focusKeys : null;
    var seconds = opts.seconds || (focus ? mission.supplementSeconds : mission.runSeconds);
    var length = seconds * cfg.baseSpeed;
    var rng = rngApi().create(opts.seed);
    var deck = shuffle(focus ? supplementDeck(mission, focus) : mainDeck(mission), rng);

    // 줄 수: 한 줄에 1~2장
    var rowCount = Math.max(1, Math.ceil(deck.length / 1.35));
    var z0 = cfg.baseSpeed * START_SECONDS, z1 = length - cfg.baseSpeed * END_SECONDS;
    var step = rowCount > 1 ? (z1 - z0) / (rowCount - 1) : 0;
    var rows = [];
    for (var r = 0; r < rowCount; r++) rows.push({ z: z0 + step * r, cards: [] });
    // 각 줄에 한 장씩, 남는 카드는 아직 한 장뿐인 줄 중 무작위로
    var di = 0;
    rows.forEach(function (row) { row.cards.push(deck[di++]); });
    var singles = shuffle(rows.slice(), rng);
    for (var s = 0; di < deck.length; s++) singles[s].cards.push(deck[di++]);

    var items = [];
    rows.forEach(function (row) {
      var lanes = shuffle([0, 1, 2], rng);
      row.cards.forEach(function (c, i) {
        var item = { kind: 'card', lane: lanes[i], z: row.z };
        if (c.ambiguousId) item.ambiguousId = c.ambiguousId; else item.key = c.key;
        items.push(item);
        if (isRare(mission, c)) items.push({ kind: 'wall', lane: lanes[i], z: row.z - cfg.rareWallGap });
      });
    });

    // 줄 사이 듬성듬성 벽
    var gaps = [];
    for (var g = 0; g < rowCount - 1; g++) gaps.push(g);
    shuffle(gaps, rng);
    var extra = Math.min(gaps.length, Math.round(deck.length * EXTRA_WALL_RATE));
    for (var e = 0; e < extra; e++) {
      var gi = gaps[e];
      items.push({ kind: 'wall', lane: Math.floor(rng.next() * 3), z: (rows[gi].z + rows[gi + 1].z) / 2 });
    }

    items.sort(function (a, b) { return a.z - b.z || a.lane - b.lane; });
    var nc = 0, nw = 0;
    items = items.map(function (it) {
      var o = { uid: it.kind === 'card' ? 'c' + (nc++) : 'w' + (nw++), kind: it.kind };
      if (it.key) o.key = it.key;
      if (it.ambiguousId) o.ambiguousId = it.ambiguousId;
      o.lane = it.lane; o.z = it.z;
      return o;
    });
    return { length: length, items: items };
  }

  var api = { build: build };
  root.DR = root.DR || {};
  root.DR.Stream = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
