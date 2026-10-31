/*
 * 흐름 — START(주의·주인공) → 프롤로그 → 미션 1~4 → 프로토콜(RESULT) → 엔딩·성찰(COMPLETE)
 * 탐험 → 목적지 → 인물·물건 → 사건 → 선택 → 이야기 결과 → 다시 걷기(탐험형 모듈 1).
 * 상태값 이름은 기획 6-3을 그대로 쓴다. 단계가 끝날 때마다 저장해 이어 하기를 지원한다.
 * 통합 이벤트: ethicity:ready / ethicity:progress(total 6) / ethicity:complete — 부모 창(postMessage)과 window(CustomEvent) 양쪽에 보낸다.
 */
(function () {
  'use strict';

  var C = window.SafetyConfig, St = window.SafetyStory, Sim = window.SafetySim, P = window.SafetyPatients;
  var U = window.SafetyUI, W = window.SafetyWorld, Pn = window.SafetyPanels, Pr = window.SafetyProtocol, Store = window.SafetyStore;
  var TOTAL = 6;

  var assets = null, art = {};
  var settings = Object.assign({ speed: 'normal', reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, sound: false }, Store.read(C.KEYS.settings) || {});
  var S = null;          // 진행 상태
  var busy = false, warned = false, autoGuide = false;

  function $(id) { return document.getElementById(id); }
  function el(t, c, x) { return U.el(t, c, x); }

  // ── 저장 ──
  function fresh(character) {
    return { v: 1, step: 'p1', introDone: false, met: [], character: character, room: 'lobby', pos: null, progressMax: 0, finished: false, data: {} };
  }
  function save() {
    if (!S) return;
    S.room = W.state.roomId || S.room;
    if (W.state.room) S.pos = [Math.round(W.me.x), Math.round(W.me.y), W.me.dir];
    Store.write(C.KEYS.progress, S);
    if (Store.status.writeFailed && !save.warned) { save.warned = true; U.notice('이 브라우저는 저장을 막고 있어요. 새로고침하면 처음부터 다시 해야 해요.'); }
  }
  function saveSettings() { Store.write(C.KEYS.settings, settings); }
  function valid(p) { return p && p.v === 1 && St.STEPS[p.step] && C.PLAYERS.indexOf(p.character) >= 0; }

  // ── 통합 이벤트 ──
  function emit(type, extra) {
    var msg = Object.assign({ type: type, gameId: C.GAME_ID }, extra || {});
    try { if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*'); } catch (e) { /* 무시 */ }
    try { window.dispatchEvent(new CustomEvent(type, { detail: msg })); } catch (e) { /* 무시 */ }
  }
  function progress(n) {
    if (n <= S.progressMax) return;
    S.progressMax = n; save();
    emit('ethicity:progress', { current: n, total: TOTAL });
  }

  function sound(id) { if (assets && settings.sound) assets.playSound(id); }
  function applySettings() {
    document.documentElement.classList.toggle('reduce-motion', !!settings.reduceMotion);
    if (assets) assets.setSound(!!settings.sound);
    U.state.settings = settings;
  }

  // ── 화면 전환 ──
  function show(view) {
    ['v-start', 'v-play', 'v-result', 'v-end'].forEach(function (id) { $(id).hidden = id !== view; });
    if (view === 'v-play') { W.start(); setTimeout(function () { $('world').focus({ preventScroll: true }); }, 30); }
    else W.stop();
    window.scrollTo(0, 0);
  }

  // ── 시작 화면 ──
  var pickedLook = null;
  function renderStart() {
    var saved = Store.read(C.KEYS.progress), player = Store.read(C.KEYS.player) || {};
    var resume = valid(saved) && !saved.finished ? saved : null;
    pickedLook = (resume && resume.character) || (C.PLAYERS.indexOf(player.character) >= 0 ? player.character : null);
    var list = $('pick-list'); list.innerHTML = '';
    C.PLAYERS.forEach(function (id) {
      var b = el('button', 'pick'); b.type = 'button'; b.dataset.id = id;
      b.appendChild(U.faceCanvas(id, 'happy', 88));
      b.appendChild(el('span', 'pick-name', window.ETHICITY_COMMON_MANIFEST.characters[id].name));
      b.addEventListener('click', function () { pickedLook = id; sound('tap'); syncPick(); $('pick-msg').hidden = true; });
      list.appendChild(b);
    });
    syncPick();
    $('btn-continue').hidden = !resume;
    $('btn-new').textContent = resume ? '처음부터 새로 하기' : '탐험을 시작합니다';
    $('btn-new').classList.toggle('secondary', !!resume);
    var done = Store.read(C.KEYS.result);
    $('last-done').hidden = !(done && done.completed);
    show('v-start');
  }
  function syncPick() {
    Array.prototype.forEach.call($('pick-list').children, function (b) { b.setAttribute('aria-pressed', b.dataset.id === pickedLook ? 'true' : 'false'); });
  }
  function warnThen(fn) {
    if (warned) { fn(); return; }
    var box = $('warning'); box.hidden = false; $('btn-warning-ok').focus();
    $('btn-warning-ok').onclick = function () { warned = true; box.hidden = true; sound('tap'); fn(); };
  }
  function startNew() {
    if (!pickedLook) { $('pick-msg').hidden = false; $('pick-list').querySelector('button').focus(); return; }
    var saved = Store.read(C.KEYS.progress);
    var go = function () { warnThen(function () { S = fresh(pickedLook); save(); enterPlay(); }); };
    if (valid(saved) && !saved.finished) {
      U.ask('처음부터 새로 할까요?', '지금까지 진행한 기록과 성찰 글이 지워집니다.', '새로 시작하기', '돌아가기').then(function (ok) { if (ok) go(); });
    } else go();
  }
  function continueGame() {
    var saved = Store.read(C.KEYS.progress);
    if (!valid(saved)) { renderStart(); return; }
    if (pickedLook && pickedLook !== saved.character) saved.character = pickedLook;
    warnThen(function () { S = saved; enterPlay(true); });
  }

  // ── 무대 ──
  function stepInfo() { return St.STEPS[S.step]; }
  function castFor(step) {
    var map = St.CAST[step] || St.CAST.m4, list = [];
    Object.keys(map).forEach(function (id) { var c = map[id]; list.push({ id: id, kind: 'npc', room: c[0], x: c[1], y: c[2], dir: c[3] }); });
    St.EXTRAS.forEach(function (e) { list.push({ id: e[0], kind: 'extra', room: e[1], x: e[2], y: e[3], dir: e[4] }); });
    return list;
  }
  function targetsFor(step) {
    if (step === 'p1') return ['director', 'doctor', 'patientrep'].filter(function (id) { return S.met.indexOf(id) < 0; });
    var t = St.STEPS[step].target; return t ? [t] : [];
  }
  // 목표가 있는 장소
  function targetRoom() {
    var step = S.step, ids = targetsFor(step);
    if (!ids.length) return null;
    var cast = St.CAST[step] || {};
    var id = ids[0];
    return { id: id, room: cast[id] ? cast[id][0] : St.STEPS[step].room };
  }
  function enterRoom(room, spawn) {
    W.setRoom(room, spawn);
    W.setCast(castFor(S.step));
    W.setTargets(targetsFor(S.step));
    W.setGuide(null);
    $('hud-place').textContent = C.ROOMS[room].place;
    $('sr-status').textContent = C.ROOMS[room].place + '에 들어왔습니다.';
    save();
  }
  function renderHud() {
    var st = stepInfo();
    $('hud-chapter').textContent = st.chapter;
    $('hud-time').textContent = st.time;
    $('hud-mission').textContent = st.mission;
    $('hud-step').textContent = '진행 ' + Math.min(TOTAL, st.progress + 1) + ' / ' + TOTAL;
  }

  function enterPlay(resumed) {
    U.state.player = S.character;
    W.me.id = S.character;
    if (S.step === 'result') { showResult(); return; }
    if (S.step === 'end') { showEnd(); return; }
    show('v-play');
    renderHud();
    var room = S.room || stepInfo().room || 'lobby';
    enterRoom(room, resumed && S.pos ? S.pos : (room === 'lobby' ? 'start' : 'door'));
    if (S.step === 'p1' && !S.introDone) runScript(function () { return U.talk(St.INTRO).then(function () { S.introDone = true; save(); }); });
    else if (resumed) { U.notice('이어서 진행합니다: ' + stepInfo().mission); }
  }

  // 대화·창이 열려 있는 동안 걷기를 멈춘다
  function runScript(fn) {
    if (busy) return Promise.resolve();
    busy = true; W.pause(true); setAct(null);
    return Promise.resolve().then(fn).catch(function (e) { console.error(e); U.notice('문제가 생겼어요. 새로고침하면 이 단계부터 이어집니다.'); })
      .then(function () { busy = false; W.pause(false); W.setTargets(targetsFor(S.step)); setAct(W.nearest()); if (!$('v-play').hidden) $('world').focus({ preventScroll: true }); });
  }

  function advance(next) {
    S.step = next; save();
    if (next === 'result') { showResult(); return Promise.resolve(); }
    renderHud();
    W.setCast(castFor(next)); W.setTargets(targetsFor(next)); W.setGuide(null);
    var cards = { m1: St.M1_CARD, m2a: St.M2_CARD, m3: St.M3_CARD, m4: St.M4_CARD };
    if (cards[next]) { sound('paper'); return U.card(cards[next]); }
    return Promise.resolve();
  }

  // ── 상호작용 ──
  function onInteract(id) {
    if (busy) return;
    autoGuide = false;
    var step = S.step;
    runScript(function () {
      if (step === 'p1' && St.MEET[id] && S.met.indexOf(id) < 0) {
        return U.talk(St.MEET[id]).then(function () {
          S.met.push(id); save(); W.setTargets(targetsFor('p1'));
          if (S.met.length >= 3) return U.talk(St.MET_ALL).then(function () { return advance('p3'); });
        });
      }
      if (id === stepInfo().target && W.state.roomId === roomOfTarget(id)) return STEP_SCRIPTS[step]();
      var line = St.CHATTER[id];
      return U.talk([line || ['narr', '특별한 것은 보이지 않습니다.']]);
    });
  }
  function roomOfTarget(id) { var c = (St.CAST[S.step] || {})[id]; return c ? c[0] : stepInfo().room; }

  var STEP_SCRIPTS = {
    p3: function () {
      return U.talk(St.APPOINT)
        .then(function () { return U.choose({ eyebrow: '첫 번째 선택', question: St.PRIORITY.question, options: St.PRIORITY.options }); })
        .then(function (v) { S.data.initial_priority = v; save(); return U.talk(St.AFTER_PRIORITY); })
        .then(function () { progress(1); return advance('m1'); });
    },
    m1: function () {
      return U.talk(St.M1_EXPLAIN)
        .then(function () { return Pn.policy({ eyebrow: '미션 1', title: '의료 AI 활용 기준 설정', lead: '환자의 위험도별로 의료진이 AI 결과를 얼마나 다시 확인할지 정해 주세요.' }); })
        .then(function (pol) { S.data.initial_policy = pol; save(); return U.choose({ eyebrow: '미션 1', question: St.REASONS.question, options: St.REASONS.options, min: 1, max: 2 }); })
        .then(function (v) { S.data.initial_reason = v; save(); sound('collect'); return U.talk(St.AFTER_POLICY); })
        .then(function () { progress(2); return advance('m2a'); });
    },
    m2a: function () {
      var r = Sim.run(S.data.initial_policy);
      return U.talk(St.M2_INTRO)
        .then(function () { return Pn.playback(r, { eyebrow: '미션 2', title: '가상 환자 100명 운영 결과', policyLabel: '나의 기준: ' + Pn.policyText(S.data.initial_policy), reducedMotion: settings.reduceMotion }); })
        .then(function () { S.data.first_result = summary(r); save(); return U.talk(St.M2_AFTER); })
        .then(function () { return advance('m2b'); });
    },
    m2b: function () {
      var r = Sim.run(S.data.initial_policy), kind = Sim.eventFor(S.data.initial_policy), ev = St.EVENTS[kind];
      var pick = eventCase(kind, r), p = P.byId(pick.id);
      var lines = ev.lines.slice();
      if (pick.safe) lines.splice(lines.length - 1, 0, St.EVENT_SAFE);
      S.data.event = kind;
      return U.card({ eyebrow: '미션 2 · 사건', title: ev.title, text: '진찰실에서 의료진 대표가 오늘 오전에 있었던 일을 이야기합니다.', button: '이야기 듣기' })
        .then(function () { return U.talk(lines, { case: p.note, detail: p.detail }); })
        .then(function () { return U.choose({ eyebrow: '중간 성찰', lead: St.MID.lead, question: St.MID.question, options: St.MID.options }); })
        .then(function (v) { S.data.mid_reflection = v; save(); return U.talk(St.AFTER_MID); })
        .then(function () { progress(3); return advance('m3'); });
    },
    m3: function () {
      var first = Sim.run(S.data.initial_policy);
      return U.talk(St.M3_INTRO)
        .then(function () { sound('paper'); return Pn.report(first); })
        .then(function () { return U.choose({ eyebrow: '미션 3', question: St.CONFIDENCE.question, options: St.CONFIDENCE.options }); })
        .then(function (v) { S.data.confidence_judgment = v; save(); return U.talk(St.CONFIDENCE_FEEDBACK); })
        .then(function () { return Pn.policy({ eyebrow: '미션 3', title: '처음 정한 기준을 유지할까요, 수정할까요?', lead: '새로운 정보를 확인했습니다. 처음 기준이 미리 골라져 있어요. 그대로 두면 유지, 바꾸면 수정입니다.', first: S.data.initial_policy, value: S.data.initial_policy }); })
        .then(function (pol) { S.data.revised_policy = pol; save(); return U.choose({ eyebrow: '미션 3', question: St.REVISION.question, options: St.REVISION.options }); })
        .then(function (v) { S.data.revision_reason = v; save(); return U.talk(St.AFTER_REVISION); })
        .then(function () { progress(4); return advance('m4'); });
    },
    m4: function () {
      var first = Sim.run(S.data.initial_policy);
      return U.talk(St.M4_INTRO)
        .then(function () { return Pn.budget(); })
        .then(function (b) { S.data.budget_allocation = b; save(); return U.choose({ eyebrow: '미션 4 · 오류 대응', lead: St.ERROR_RESPONSE.lead, question: St.ERROR_RESPONSE.question, options: St.ERROR_RESPONSE.options, note: St.ERROR_RESPONSE.note }); })
        .then(function (v) { S.data.error_response = v; save(); return U.choose({ eyebrow: '미션 4 · 책임 체계', lead: St.RESPONSIBILITY.lead, question: St.RESPONSIBILITY.question, options: St.RESPONSIBILITY.options }); })
        .then(function (v) { S.data.responsibility_policy = v; save(); return U.talk(St.M4_FINAL); })
        .then(function () {
          var fin = Sim.run(S.data.revised_policy, S.data.budget_allocation);
          S.data.final_result = summary(fin); save();
          var sg = S.data.budget_allocation.length ? ' + ' + S.data.budget_allocation.map(function (k) { return C.SAFEGUARD[k].label; }).join(' · ') : '';
          return Pn.playback(fin, { eyebrow: '미션 4', title: '최종 운영 결과', before: first, policyLabel: '최종 기준: ' + Pn.policyText(S.data.revised_policy) + sg, lead: '왼쪽 숫자는 1차 운영, 굵은 숫자는 최종 운영입니다.', reducedMotion: settings.reduceMotion, button: '프로토콜 확인하기' });
        })
        .then(function () { sound('win'); return U.talk(St.M4_DONE); })
        .then(function () { progress(5); return advance('result'); });
    }
  };
  function summary(r) { return { delayed: r.delayed, missed: r.missed, reviews: r.reviews, worsened: r.worsened }; }

  // 미션 2 사건에 등장할 환자(시뮬레이션 결과에서 고른다)
  function eventCase(kind, r) {
    var lists = { A: ['P058', 'P023', 'P008', 'P035', 'P070', 'P084'], B: ['P062', 'P046', 'P089'], C: ['P058', 'P084', 'P023', 'P047'] };
    var bad = kind === 'B' ? ['worsened'] : ['missed', 'late'];
    var hit = lists[kind].filter(function (id) { return bad.indexOf(r.patients[id].state) >= 0; })[0];
    return hit ? { id: hit, safe: false } : { id: lists[kind][0], safe: true };
  }

  // ── 출입 ──
  function onExit(ex) {
    if (busy) return;
    sound('door');
    var stage = $('stage');
    if (!settings.reduceMotion) { stage.classList.add('fade'); setTimeout(function () { stage.classList.remove('fade'); }, 260); }
    enterRoom(ex.to, ex.at);
    if (autoGuide) setTimeout(guide, 120);
  }

  // ── 길 안내 ──
  function guide() {
    if (busy) return;
    var t = targetRoom();
    if (!t) return;
    autoGuide = true;
    var cur = W.state.roomId;
    if (cur === t.room) {
      W.setGuide({ id: t.id });
      if (!W.walkToTarget(t.id)) U.notice('가는 길이 막혀 있어요. 방향키로 조금 움직여 보세요.');
      return;
    }
    var exits = C.ROOMS[cur].exits, ex = exits.filter(function (e) { return e.to === t.room; })[0] || exits.filter(function (e) { return e.to === 'lobby'; })[0];
    if (!ex) return;
    W.setGuide({ exit: ex.id });
    W.walkToExit(ex.id);
  }

  // 말 걸기/살펴보기 버튼
  function setAct(it) {
    var b = $('btn-act');
    if (!it || busy) { b.hidden = true; return; }
    var name = it.kind === 'object' ? C.ROOMS[W.state.roomId].objects[it.id].name : (C.NPCS[it.id] || {}).short || (C.NPCS[it.id] || {}).name;
    b.hidden = false;
    b.textContent = (it.kind === 'object' ? '살펴보기' : '말 걸기') + ' · ' + name;
  }

  // ── 메뉴 ──
  function openMenu() {
    if (U.sheetOpen()) return;
    var wasBusy = busy; W.pause(true);
    var body = el('div', 'menu');
    body.appendChild(el('h3', 'menu-h', '대사 속도'));
    body.appendChild(U.choiceList([{ id: 'slow', text: '느리게' }, { id: 'normal', text: '보통' }, { id: 'fast', text: '빠르게' }, { id: 'instant', text: '한 번에 보기' }],
      { value: settings.speed, label: '대사 속도', onChange: function (v) { settings.speed = v; saveSettings(); applySettings(); } }).el);
    function toggle(label, key, sub) {
      var b = el('button', 'ee-choice'); b.type = 'button';
      function sync() { b.setAttribute('aria-pressed', settings[key] ? 'true' : 'false'); b.textContent = label + ': ' + (settings[key] ? '켜짐' : '꺼짐'); if (sub) b.appendChild(el('span', 'choice-sub', sub)); }
      b.addEventListener('click', function () { settings[key] = !settings[key]; saveSettings(); applySettings(); sync(); if (key === 'sound' && settings.sound) sound('tap'); });
      sync(); return b;
    }
    body.appendChild(el('h3', 'menu-h', '화면과 소리'));
    var g = el('div', 'choice-list');
    g.appendChild(toggle('움직임 줄이기', 'reduceMotion', '깜빡임·흔들림을 없애고 운영 재생을 바로 결과로 보여 줘요.'));
    g.appendChild(toggle('효과음', 'sound', '처음에는 꺼져 있어요.'));
    body.appendChild(g);
    body.appendChild(el('p', 'sheet-help', '조작: 방향키·WASD로 걷기, Space로 말 걸기. 바닥이나 사람을 눌러도 그곳으로 걸어가요. 선택지는 숫자 키 1~4로도 고를 수 있어요.'));
    var sh = U.openSheet({ title: '메뉴', body: body });
    sh.button('처음 화면으로', 'secondary', function () { sh.close(); save(); renderStart(); });
    sh.button('기록 지우기', 'secondary', function () {
      sh.close();
      U.ask('기록을 지울까요?', '진행 기록과 성찰 글, 완료 기록을 이 기기에서 지웁니다. 설정은 그대로 둡니다.', '지우기', '돌아가기').then(function (ok) {
        if (ok) { Store.remove(C.KEYS.progress); Store.remove(C.KEYS.result); S = null; renderStart(); U.notice('기록을 지웠어요.'); }
        else if (!wasBusy) W.pause(false);
      });
    });
    sh.button('닫기', '', function () { sh.close(); if (!wasBusy && !busy) W.pause(false); });
  }

  // ── 결과(프로토콜) ──
  function currentDoc() { return Pr.build(S.data); }
  function exportButtons(host, getDoc) {
    var pb = el('button', 'ee-button secondary'); pb.type = 'button'; pb.textContent = '인쇄하기';
    pb.addEventListener('click', function () { Pr.print(getDoc()); });
    var ib = el('button', 'ee-button secondary'); ib.type = 'button'; ib.textContent = '이미지로 저장';
    ib.addEventListener('click', function () { saveImage(getDoc()); });
    host.appendChild(pb); host.appendChild(ib);
  }
  function saveImage(doc) {
    Pr.image(doc).then(function (url) {
      var body = el('div', 'image-preview');
      var img = el('img'); img.src = url; img.alt = '나의 의료 AI 안전 운영 프로토콜 이미지'; body.appendChild(img);
      body.appendChild(el('p', 'sheet-help', '저장 버튼이 동작하지 않는 기기에서는 이미지를 길게 누르거나 오른쪽 클릭해 저장하세요.'));
      var sh = U.openSheet({ title: '프로토콜 이미지', body: body, wide: true });
      var a = el('a', 'ee-button', '이미지 파일 저장하기'); a.href = url; a.download = '의료AI-안전운영-프로토콜.png';
      sh.actions.appendChild(a);
      sh.button('닫기', 'secondary', function () { sh.close(); });
    }).catch(function () { U.notice('이미지를 만들지 못했어요. 인쇄하기를 이용해 주세요.'); });
  }
  function showResult() {
    S.step = 'result'; save();
    var doc = currentDoc(), host = $('result-doc');
    host.innerHTML = ''; host.appendChild(Pr.render(doc));
    var act = $('result-actions'); act.innerHTML = '';
    exportButtons(act, currentDoc);
    var next = el('button', 'ee-button'); next.type = 'button'; next.textContent = '엔딩과 성찰로';
    next.addEventListener('click', function () { sound('tap'); S.step = 'end'; save(); showEnd(); });
    act.appendChild(next);
    show('v-result');
    $('result-title').focus({ preventScroll: true });
  }

  // ── 엔딩·성찰 ──
  function optText(list, id) { var o = list.options.filter(function (x) { return x.id === id; })[0]; return o ? o.text : ''; }
  function showEnd() {
    var d = S.data, doc = currentDoc(), tend = St.TENDENCY[doc.tendency];
    $('end-tendency').textContent = tend.title;
    $('end-trait').textContent = tend.trait;
    $('end-question').textContent = tend.question;
    // 선택 → 일어난 일
    var ol = $('end-story'); ol.innerHTML = '';
    function step(title, text) { var li = el('li'); li.appendChild(el('strong', '', title)); li.appendChild(el('span', '', text)); ol.appendChild(li); }
    step('처음 생각', optText(St.PRIORITY, d.initial_priority));
    step('처음 기준', Pn.policyText(d.initial_policy));
    step('최종 기준', Pn.policyText(d.revised_policy) + (d.budget_allocation.length ? ' + ' + d.budget_allocation.map(function (k) { return C.SAFEGUARD[k].label; }).join(' · ') : ''));
    step('일어난 일', '진료 지연 ' + doc.first.delayed + '명 → ' + doc.final.delayed + '명, 놓친 위험 ' + doc.first.missed + '명 → ' + doc.final.missed + '명, 검토 업무 ' + doc.first.reviews + '건 → ' + doc.final.reviews + '건');
    step(doc.case.id + ' ' + doc.case.who, doc.case.text);
    // 성찰
    var refl = d.reflection || (d.reflection = { q1: '', q2: '', q3: '' });
    var host = $('end-reflect'); host.innerHTML = '';
    St.REFLECT.forEach(function (q, i) {
      var wrap = el('div', 'reflect-q');
      var label = el('label', 'reflect-label', (i + 1) + '. ' + q.text); label.htmlFor = 'refl-' + q.id; wrap.appendChild(label);
      if (q.id === 'q1') {
        var same = JSON.stringify(d.initial_policy) === JSON.stringify(d.revised_policy);
        wrap.appendChild(el('p', 'reflect-hint', same ? '처음 기준을 그대로 유지했어요: ' + Pn.policyText(d.revised_policy) : '처음: ' + Pn.policyText(d.initial_policy) + ' → 최종: ' + Pn.policyText(d.revised_policy)));
      }
      if (q.id === 'q2') wrap.appendChild(el('p', 'reflect-hint', '미션 2에서 가장 중요하다고 고른 문제: ' + optText(St.MID, d.mid_reflection)));
      var ta = el('textarea', 'reflect-input'); ta.id = 'refl-' + q.id; ta.rows = 3; ta.maxLength = 400; ta.value = refl[q.id] || '';
      var count = el('span', 'reflect-count'); count.setAttribute('aria-live', 'off');
      function upd() { count.textContent = ta.value.length + ' / 400자'; }
      var t = 0;
      ta.addEventListener('input', function () { refl[q.id] = ta.value; upd(); clearTimeout(t); t = setTimeout(save, 400); });
      upd();
      wrap.appendChild(ta); wrap.appendChild(count);
      host.appendChild(wrap);
    });
    $('end-final').hidden = !S.finished;
    $('btn-reflect-done').hidden = !!S.finished;
    if (S.finished) renderFinal();
    show('v-end');
    $('end-title').focus({ preventScroll: true });
  }
  function finishReflection() {
    var r = S.data.reflection || {}, empty = St.REFLECT.filter(function (q) { return !(r[q.id] || '').trim(); }).length;
    var go = function () {
      S.finished = true; save();
      Store.write(C.KEYS.result, { completed: true, tendency: Sim.tendency(S.data.revised_policy), at: new Date().toISOString().slice(0, 10) });
      progress(6);
      emit('ethicity:complete', { result: { completed: true } });
      sound('win');
      $('btn-reflect-done').hidden = true;
      $('end-final').hidden = false;
      renderFinal();
      $('end-final-title').focus({ preventScroll: false });
    };
    if (empty) U.ask('비워 둔 질문이 있어요', '답하지 않은 질문이 ' + empty + '개 있어요. 그대로 마칠까요? 성찰 글은 점수가 매겨지지 않아요.', '그대로 마치기', '더 쓰기').then(function (ok) { if (ok) go(); });
    else go();
  }
  function renderFinal() {
    var m = $('end-message'); m.innerHTML = '';
    St.FINAL_MESSAGE.forEach(function (t) { m.appendChild(el('p', '', t)); });
    $('end-remember').textContent = St.REMEMBER;
    $('end-next').textContent = St.NEXT;
    $('end-last').textContent = St.LAST_QUESTION;
    // 선택 경로
    var d = S.data, ul = $('end-path'); ul.innerHTML = '';
    function row(k, v) { var li = el('li'); li.appendChild(el('strong', '', k)); li.appendChild(el('span', '', v)); ul.appendChild(li); }
    row('프롤로그 · 첫 판단', optText(St.PRIORITY, d.initial_priority));
    row('미션 1 · 처음 기준', Pn.policyText(d.initial_policy));
    row('미션 1 · 근거', (d.initial_reason || []).map(function (id) { return optText(St.REASONS, id); }).join(' / '));
    row('미션 2 · 사건', St.EVENTS[d.event || Sim.eventFor(d.initial_policy)].title);
    row('미션 2 · 가장 중요한 문제', optText(St.MID, d.mid_reflection));
    row('미션 3 · 확신도 판단', optText(St.CONFIDENCE, d.confidence_judgment));
    row('미션 3 · 최종 기준', Pn.policyText(d.revised_policy));
    row('미션 3 · 유지·수정 이유', optText(St.REVISION, d.revision_reason));
    row('미션 4 · 안전장치', d.budget_allocation.length ? d.budget_allocation.map(function (k) { return C.SAFEGUARD[k].label; }).join(' · ') : '없음');
    row('미션 4 · 오류 대응', optText(St.ERROR_RESPONSE, d.error_response));
    row('미션 4 · 책임 체계', optText(St.RESPONSIBILITY, d.responsibility_policy));
    var act = $('end-actions'); act.innerHTML = '';
    exportButtons(act, currentDoc);
    var again = el('button', 'ee-button secondary'); again.type = 'button'; again.textContent = '다시 해 보기';
    again.addEventListener('click', function () { var c = S.character; S = fresh(c); save(); enterPlay(); });
    var home = el('button', 'ee-button'); home.type = 'button'; home.textContent = '처음 화면으로';
    home.addEventListener('click', function () { renderStart(); });
    act.appendChild(again); act.appendChild(home);
  }

  // ── 시작 ──
  function bind() {
    $('btn-new').addEventListener('click', startNew);
    $('btn-continue').addEventListener('click', continueGame);
    $('btn-guide').addEventListener('click', function () { sound('tap'); guide(); });
    $('btn-ask').addEventListener('click', function () {
      if (busy) return;
      var h = St.HINTS[S.step] || [];
      runScript(function () { return U.talk(h.map(function (t) { return ['robot', t, 'explaining']; })); });
    });
    $('btn-menu').addEventListener('click', openMenu);
    $('btn-act').addEventListener('click', function () { W.interact(); });
    $('btn-reflect-done').addEventListener('click', finishReflection);
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('v-play').hidden && !U.sheetOpen() && !U.isTalking()) openMenu();
    });
    window.addEventListener('beforeunload', function () { if (S && !$('v-play').hidden) save(); });
  }

  function hudIcons() {
    [['btn-guide', 'map'], ['btn-ask', 'robot'], ['btn-menu', 'settings']].forEach(function (x) {
      var c = document.querySelector('#' + x[0] + ' canvas');
      if (c) assets.drawIcon(c.getContext('2d'), x[1], 0, 0, 64);
    });
  }

  function loadArt() {
    var list = window.SAFETY_ART || {};
    return Promise.all(Object.keys(list).map(function (k) {
      return new Promise(function (res) {
        var img = new Image();
        img.onload = function () { art[k] = img; res(); };
        img.onerror = function () { res(); };
        img.src = 'assets/art/' + k + '.png';
      });
    }));
  }

  function boot() {
    bind();
    Promise.all([window.EthicityAssets.load(window.ETHICITY_COMMON_MANIFEST, C.COMMON_BASE), loadArt()]).then(function (res) {
      assets = res[0];
      U.state.assets = assets; U.state.art = art; U.state.onSound = sound;
      applySettings();
      W.init({ canvas: $('world'), assets: assets, art: art, reducedMotion: function () { return settings.reduceMotion; },
        on: { interact: onInteract, exit: onExit, near: setAct } });
      hudIcons();
      $('boot').hidden = true;
      renderStart();
      emit('ethicity:ready');
    }).catch(function (e) {
      console.error(e);
      $('boot').textContent = '그림을 불러오지 못했어요. 새로고침하면 다시 시도합니다. (' + e.message + ')';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
