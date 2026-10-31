// 진행 — data.js SCRIPT의 단계를 차례로 실행하고, 단계마다 저장한다(이어 하기). 통합 이벤트도 여기서 보낸다.
(function (root) {
  'use strict';
  var D = root.RightsData, UI = root.RightsUI, Stage = root.RightsStage, Talk = root.RightsTalk, P = root.RightsPanels, Store = root.RightsStore;
  var PARTS = ['prologue', 1, 2, 3, 'epilogue'];
  var LABEL = { prologue: '프롤로그 · 위원회 위촉', epilogue: '에필로그 · 최종 권고안' };
  var MISSION = { decideFirst: '1차 결정 내리기', decideFinal: '최종 결정 내리기', quiz: '자료를 보고 해석하기', reflect: '다시 생각해 보기', factors: '핵심 딜레마 검토하기', sort: '기술적 판단과 윤리적 판단 나누기', scope: '활용 범위 정하기', review: '나의 결정 돌아보기', guide: '인권 보장 원칙 점검하기', recommend: '정책 권고안 작성하기', value: '지금 생각 기록하기', principles: '심의 원칙 확인하기', chapter: '안건 확인하기' };

  var S = null, names = null, settings = null, A = null, roomId = null, onFinish = null;

  function fresh(hero) {
    return { v: 1, hero: hero, part: 'prologue', i: 0, found: {}, cards: [], prologue: {}, ch: { 1: { data: {} }, 2: { data: {} }, 3: { data: {} } }, rec: null, done: false };
  }
  function save() { Store.write('progress', S); }
  function load() {
    var s = Store.read('progress', null);
    return s && s.v === 1 && D.STUDENTS.indexOf(s.hero) >= 0 ? s : null;
  }
  function namesFor(hero) {
    var others = D.STUDENTS.filter(function (id) { return id !== hero; });
    var ids = { hero: hero, A: others[0], B: others[1] };
    return { ids: ids, hero: D.nameOf(ids.hero), A: D.nameOf(ids.A), B: D.nameOf(ids.B) };
  }

  // 통합 페이지로 보내는 이벤트 — 개인정보·선택 내용은 넣지 않는다.
  function emit(type, extra) {
    var msg = { type: 'ethicity:' + type, gameId: 'rights' };
    if (extra) Object.keys(extra).forEach(function (k) { msg[k] = extra[k]; });
    try { if (root.parent && root.parent !== root) root.parent.postMessage(msg, '*'); } catch (e) { /* 단독 실행 */ }
    try { root.dispatchEvent(new CustomEvent('ethicity', { detail: msg })); } catch (e) { /* 무시 */ }
  }

  function fx(id, where) {
    if (Stage.isActive()) Stage.effect(id, where);
    var snd = { clue: 'collect', correct: 'collect', retry: 'retry', key: 'win', unlock: 'door' }[id];
    if (snd) A.playSound(snd);
  }

  function hud(mission) {
    var part = S.part, label = LABEL[part] || ('CHAPTER ' + part + ' · ' + D.CHAPTERS[part].title);
    UI.$('hud-chapter').textContent = label;
    UI.$('hud-place').textContent = roomId ? D.ROOMS[roomId].name : '';
    if (mission) UI.$('hud-mission').textContent = mission;
  }
  function enterRoom(id, cast) {
    roomId = id;
    Stage.setRoom(id, cast, S.hero, names);
    Stage.show(true);
    hud();
  }

  function chOf() { return typeof S.part === 'number' ? S.part : 0; }
  async function say(lines) {
    Stage.lock(true);
    await Talk.run(lines, names, settings.textSpeed);
    Stage.resetFacing();
  }
  async function card(id) {
    if (S.cards.indexOf(id) < 0) { S.cards.push(id); A.playSound('paper'); }
    await P.card(id);
  }

  async function step(st) {
    var ch = chOf(), rec = ch ? S.ch[ch] : null;
    Stage.lock(true);
    switch (st.t) {
      case 'room': enterRoom(st.room, st.cast); hud(ch ? D.CHAPTERS[ch].title + ' 안건 회의 참여하기' : '위원회 첫 회의 참여하기'); return;
      case 'say': return say(st.lines);
      case 'card': return card(st.id);
      case 'chapter': hud(MISSION.chapter); return P.chapterStart(st.ch);
      case 'principles': hud(MISSION.principles); return P.principles();
      case 'value': hud(MISSION.value); S.prologue[st.key] = await P.value(st.key === 'again' ? S.prologue.first : null); return;
      case 'decide':
        hud(st.phase === 'first' ? MISSION.decideFirst : MISSION.decideFinal);
        if (st.phase === 'first') rec.first = await P.decide(st.ch, 'first');
        else rec.final = await P.decide(st.ch, 'final', rec.first);
        return;
      case 'branch': return say([['robot', 'explaining', D.CHAPTERS[st.ch].branch[rec.first.pick]]]);
      case 'explore': return explore(st);
      case 'quiz': hud(MISSION.quiz); rec.data[st.id] = await P.quiz(st.id); return;
      case 'reflect': hud(MISSION.reflect); rec.reflect = await P.reflect(st.id); return;
      case 'factors': hud(MISSION.factors); rec.factors = await P.factors(); return;
      case 'sort': hud(MISSION.sort); rec.sort = await P.sort(); return;
      case 'scope': hud(MISSION.scope); rec.scope = await P.scope(); return;
      case 'chapterEnd':
        fx('key');
        await P.chapterEnd(st.ch, rec);
        return;
      case 'review': hud(MISSION.review); return P.review(S);
      case 'guide': hud(MISSION.guide); return P.guide();
      case 'recommend': hud(MISSION.recommend); S.rec = await P.recommend(S.rec); return;
    }
  }

  // 조사 단계: 목표 장소로 이동(출입구 → 지도) → 표시된 곳을 모두 살펴보면 끝.
  function explore(st) {
    return new Promise(function (resolve) {
      var busy = false;
      function target() {
        return st.spots.filter(function (id) {
          var sp = D.SPOTS[id];
          return !S.found[id] && (sp.need || []).every(function (n) { return S.found[n]; });
        })[0] || null;
      }
      function refresh() {
        if (roomId !== st.room) {
          Stage.setSpots([], {}, null, true);
          hud(D.ROOMS[st.room].to + ' 이동하기 — 출입구나 지도를 이용해요');
        } else {
          Stage.setSpots(st.spots, S.found, target(), false);
          var t = target();
          hud(st.mission + (t ? ' — 다음: ' + D.SPOTS[t].label : ''));
        }
        Stage.lock(false);
      }
      async function travel() {
        if (busy) return;
        busy = true; Stage.lock(true);
        var to = await P.map(roomId, st.room);
        if (to && to !== roomId) { A.playSound('door'); enterRoom(to, st.cast); }
        busy = false;
        if (to && to === st.room && st.spots.every(function (id) { return S.found[id]; })) return finish();
        refresh();
      }
      async function interact(id, gated) {
        if (busy) return;
        busy = true; Stage.lock(true);
        if (gated) {
          var need = (D.SPOTS[id].need || []).filter(function (n) { return !S.found[n]; })[0];
          await say([['robot', 'neutral', '먼저 ‘' + D.SPOTS[need].label + '’부터 살펴볼까요?']]);
        } else {
          var mark = Stage.spotMark(id);
          for (var k = 0; k < D.SPOTS[id].steps.length; k++) await step(D.SPOTS[id].steps[k]);
          S.found[id] = true;
          save();
          fx('clue', mark);
        }
        busy = false;
        if (st.spots.every(function (x) { return S.found[x]; })) return finish();
        refresh();
      }
      function finish() {
        Stage.on('interact', null); Stage.on('exit', null);
        api.travel = null;
        Stage.lock(true);
        resolve();
      }
      Stage.on('interact', interact);
      Stage.on('exit', travel);
      api.travel = travel;
      if (roomId === st.room && st.spots.every(function (id) { return S.found[id]; })) return finish();
      refresh();
    });
  }

  // 이어 하기: 저장된 단계 앞에서 마지막으로 들어간 장소를 다시 세운다.
  function restoreRoom() {
    var steps = D.SCRIPT[S.part], hit = null;
    for (var k = Math.min(S.i, steps.length) - 1; k >= 0; k--) if (steps[k].t === 'room' || steps[k].t === 'explore') { hit = steps[k]; break; }
    if (hit) enterRoom(hit.room, hit.cast);
    else enterRoom('classroom', D.SCRIPT.prologue[0].cast);
  }

  async function run() {
    restoreRoom();
    while (S.part !== 'done') {
      var steps = D.SCRIPT[S.part];
      while (S.i < steps.length) {
        await step(steps[S.i]);
        S.i += 1;
        save();
      }
      var at = PARTS.indexOf(S.part);
      emit('progress', { current: at + 1, total: PARTS.length });
      S.part = at + 1 < PARTS.length ? PARTS[at + 1] : 'done';
      S.i = 0;
      if (S.part === 'done') S.done = true;
      save();
    }
    Stage.lock(true);
    Stage.show(false);
    if (onFinish) onFinish(S, names);
  }

  var api = {
    PARTS: PARTS, emit: emit, fx: fx, load: load, namesFor: namesFor,
    start: function (opts) {
      A = opts.assets; settings = opts.settings; onFinish = opts.onFinish;
      S = opts.state || fresh(opts.hero);
      names = namesFor(S.hero);
      save();
      return run();
    },
    state: function () { return S; }, names: function () { return names; },
    travel: null, // 조사 단계에서만 지도 이동 함수가 들어온다
    room: function () { return roomId; }
  };
  root.RightsFlow = api;
})(window);
