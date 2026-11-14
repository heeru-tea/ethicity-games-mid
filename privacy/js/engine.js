/*
 * 상태 엔진 — 화면(DOM)을 모르는 순수 로직. 브라우저와 Node(검증 스크립트) 양쪽에서 쓴다.
 * 상태는 JSON으로 그대로 저장·복원할 수 있는 평범한 객체다.
 */
(function (root) {
  'use strict';

  var STAT_KEYS = ['spread', 'consent', 'minimize', 'repair', 'help', 'serious'];
  var TRUST_MIN = -3, TRUST_MAX = 3;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ── 계산 플래그: 저장하지 않고 지금까지의 선택으로 그때그때 판정한다(조건 문법 그대로) ──
   *   hurt.<인물>  내가 그 친구를 해친 적이 있음(사진·번호·캡처·가짜 영상·계정) — 피해자가 나를 위로·사과하지 않게 대사를 가른다
   *   harmed_others 내가 다른 사람의 정보를 퍼뜨린 적이 있음 — 엔딩 C·D와 에필로그에서 책임을 다룬다
   *   harm_count   내가 해친 친구 수(0~4, hurt.* 가운데 참인 개수) — 엔딩 B 판정에 쓴다(2026-11-10 플레이테스트: 여럿을 해치고 수습만 해서는 B가 아님)
   *   overrode_wish 당사자의 뜻을 무시한 행동을 한 적이 있음 — 엔딩 A 판정에 쓴다(2026-11-13 교사 요청: A에서 '동의 2번 이상'을 빼고 이것으로).
   *     "묻지 않았다"만으로는 해당하지 않는다(안 찍기·안 올리기·필요한 것만 전하기는 묻지 않아도 무시가 아님). 실제로 한 행동만 센다:
   *     ㉠ 거절·비밀·삭제 요청을 어김: e2post=group|story(민준 "올리진 마" 뒤 포함) · e2fix=no(삭제 요청 넘김) · e3=capture(지호 "아무한테도 말하지 마") · e5j=jiho(그 대화를 AI 도우미에 — 2026-11-13 사건 5를 두 일로 나눠 e5j로 옮김)
   *     ㉡ 허락이 필요한 촬영·공유·사용을 묻지 않고 함: e2shot=nocheck(자는 얼굴 촬영) · e4=forward(새봄 가짜 영상 전달) · e5=all(하늘 번호·계좌 든 단톡 통째 입력)
   *        · e6=peek|post(하늘 계정 DM 열람·글 올리기) · e6b=cap(DM 캡처 전달) · e7=join(민준 번호를 낯선 사람에게) · e9=share(남의 이름·학교·동네·얼굴 공유)
   *     넣지 않은 것: e1=public(내 정보) · e1b=pass(하늘이 스스로 올림) · e7=silent·e7b=none·e4b=blame·e6b=deny(행동이 아니라 방관·말 — harm_count가 맡음)
   *       · e8=meet|crew(내 정보) · e8_response=expose(상대가 공개 게시판에 직접 쓴 계정·댓글 — 확산 수치가 맡음). 표는 README 「엔딩 A 기준(2026-11-13)」
   *   값이 { count: [조건…] }이면 참인 조건의 개수(숫자), 문자열이면 참/거짓 */
  var COMPUTED = {
    'hurt.minjun': 'e2post=story|group || e2fix=no || e7=join|silent || e7b=none',
    'hurt.saebom': 'e4=forward || e4b=blame',
    'hurt.jiho': 'e3=capture',
    'hurt.haneul': 'e6=post || e6b=deny|cap',
    // 2026-11-02: 지호 대화 캡처 전달·하늘 DM 캡처 전달 추가 · 2026-11-10: 28명 단톡방에 올린 사진(e2post=group)도 퍼뜨린 것(엔딩 판정과 무관, 책임 문단만)
    harmed_others: 'e4=forward || e6=post || e7=join || e9=share || e2post=story|group || e3=capture || e6b=cap',
    harm_count: { count: ['hurt.minjun', 'hurt.saebom', 'hurt.jiho', 'hurt.haneul'] },
    overrode_wish: 'e2shot=nocheck || e2post=group|story || e2fix=no || e3=capture || e4=forward || e5=all || e5j=jiho || e6=peek|post || e6b=cap || e7=join || e9=share',

    /* 회복 A(2026-11-14 교사 요청): '제한적인 실수 뒤 그 사건에 맞게 끝까지 수습한 경로'도 A. 예방 A(위 조건)는 그대로.
     *   slip.<사건> = 회복할 수 있는 실수 — 묻지 않아서 한 일이고(상대가 분명히 거절·비밀로 한 것을 어긴 게 아님) 남의 안전을 위협하지 않은 것
     *     e2 묻지 않고 찍음(반 단톡방까지) · e5 친구 번호가 든 단톡을 AI에 통째로 · e6 공용 PC에서 하늘이 DM 열람 · e7 번호 장난 옆에서 가만히 있음(방관)
     *   fix.<사건> = 그 사건에 맞는 수습(다른 사건의 수습·도움 점수로 대신할 수 없다)
     *     e2 내리고 저장한 사람에게도 지워 달라고 부탁(e2fix=all — 사과만 하고 내린 sorry는 사본 회수 요청이 없어 부족)
     *     e5 대화 지우고 기록 설정 확인(e5fix=del) · e6 캡처 없이 로그아웃하고 하늘이에게 알림(e6b=stop) · e7 글을 지우게 하고 민준이와 선생님께(e7b=help — 지우라고만 한 del은 부족)
     *     게임에 없는 행동은 수습으로 치지 않는다: 묻지 않고 찍은 뒤 올리기 전에 물어본 경로(e2post=ask)는 사진을 지우는 선택이 없어 수습 완료로 볼 수 없다
     *   grave_harm = 회복 A로 올라갈 수 없는 일: 거절·비밀·삭제 요청을 어김(e2 "올리진 마" 뒤 올림·e2fix=no·e3 capture·e5j jiho) · 학교 밖 공개(e2post=story)
     *     · 남을 위험하게 함(e4 forward·e6 post·e7 join·e9 share — seriousSplit '다른 사람을 위험하게 한 일') · 같은 사건에서 거듭 침해(e6b=cap) · 수습 거절·피해자 탓(e6b=deny·e7b=none·e4b=blame)
     *   recovered = 실수한 사건이 정확히 하나(같은 친구라도 사건이 둘이면 둘 — 민준 사진 + 번호 방관) + 그 사건 수습 완료 + grave_harm 없음
     *   피해 기록(hurt.*·harm_count·harmed_others)과 믿음 상한은 그대로다 — 회복 A가 피해를 지우지 않는다. 표·근거는 README 「엔딩 A 회복 경로(2026-11-14)」 */
    'slip.e2': 'e2shot=nocheck && e2post!=story',
    'slip.e5': 'e5=all',
    'slip.e6': 'e6=peek',
    'slip.e7': 'e7=silent',
    'fix.e2': 'e2fix=all',
    'fix.e5': 'e5fix=del',
    'fix.e6': 'e6b=stop',
    'fix.e7': 'e7b=help',
    slip_count: { count: ['slip.e2', 'slip.e5', 'slip.e6', 'slip.e7'] },
    slip_fixed: 'slip.e2 && fix.e2 || slip.e5 && fix.e5 || slip.e6 && fix.e6 || slip.e7 && fix.e7',
    grave_harm: 'e2shot=asked && e2post=group || e2post=story || e2fix=no || e3=capture || e4=forward || e4b=blame || e5j=jiho || e6=post || e6b=cap|deny || e7=join || e7b=none || e9=share',
    recovered: 'slip_count=1 && slip_fixed && !grave_harm'
  };
  function computed(key, state) {
    var c = COMPUTED[key];
    if (c && c.count) return c.count.filter(function (x) { return evalCond(x, state); }).length;
    return evalCond(c, state);
  }

  /* ── 조건 ───────────────────────── */
  function getVal(state, key) {
    if (key.indexOf('+') >= 0) {
      return key.split('+').reduce(function (s, k) { return s + Number(getVal(state, k.trim()) || 0); }, 0);
    }
    if (COMPUTED.hasOwnProperty(key)) return computed(key, state);
    if (key.indexOf('trust.') === 0) return state.trust[key.slice(6)] || 0;
    if (STAT_KEYS.indexOf(key) >= 0) return state.stats[key] || 0;
    return state.flags[key];
  }

  function evalOne(cond, state) {
    cond = cond.trim();
    if (cond.charAt(0) === '!' && cond.charAt(1) !== '=') return !getVal(state, cond.slice(1).trim());
    var m = cond.match(/^([\w.+]+)\s*(>=|<=|!=|=|>|<)\s*(.+)$/);
    if (!m) return !!getVal(state, cond);
    var v = getVal(state, m[1]), op = m[2], rhs = m[3].trim();
    if (op === '=' || op === '!=') {
      var hit = rhs.split('|').indexOf(String(v)) >= 0;
      return op === '=' ? hit : !hit;
    }
    var x = Number(v || 0), n = Number(rhs);
    if (op === '>=') return x >= n;
    if (op === '<=') return x <= n;
    if (op === '>') return x > n;
    return x < n;
  }

  function evalCond(cond, state) {
    if (cond == null || cond === '') return true;
    if (Array.isArray(cond)) return cond.every(function (c) { return evalCond(c, state); });
    if (cond.indexOf('||') >= 0) return cond.split('||').some(function (c) { return evalCond(c, state); });
    if (cond.indexOf('&&') >= 0) return cond.split('&&').every(function (c) { return evalOne(c, state); });
    return evalOne(cond, state);
  }

  /* ── 대사 ───────────────────────── */
  function normLine(line, story) {
    if (typeof line !== 'string') return line;
    var i = line.indexOf(': ');
    if (i > 0) {
      var who = line.slice(0, i);
      if (who === 'narr' || who === 'sys' || story.characters[who]) return { who: who, text: line.slice(i + 2) };
    }
    return { who: 'narr', text: line };
  }
  function visibleLines(story, lines, state) {
    return (lines || []).map(function (l) { return normLine(l, story); })
      .filter(function (l) { return evalCond(l.if, state); });
  }
  function visibleChoices(story, scene, state) {
    return (scene.choices || []).filter(function (c) { return evalCond(c.if, state); });
  }

  /* ── 상태 ───────────────────────── */
  function emptyStats() { var s = {}; STAT_KEYS.forEach(function (k) { s[k] = 0; }); return s; }

  function createState(story) {
    var trust = {};
    story.trustable.forEach(function (k) { trust[k] = 0; });
    // 시작 장면에도 트리거가 있으면(등교 오프닝) 걸어서 들어간다
    var walkIn = !!(story.triggers && story.triggers[story.start]);
    return {
      v: 1,
      screen: walkIn ? 'map' : 'scene', // scene | map | chapter | ending
      mapTarget: walkIn ? story.start : null, // map 화면일 때 도착하면 열릴 장면 id
      scene: story.start,
      chapter: 0,
      nextChapter: null,
      reaction: null,           // 방금 고른 선택지 id (반응 표시 중)
      stats: emptyStats(),
      trust: trust,
      flags: {},
      visited: walkIn ? [] : [story.start],
      history: [],              // [{ scene, choice, snap }]
      chapterMarks: { 0: { stats: emptyStats(), trust: clone(trust) } },
      ending: null
    };
  }

  function snapshot(state) {
    var s = clone(state);
    delete s.history;
    return s;
  }

  // v2 = story.endingV2(엔딩 판정 v2) — 켜졌으면 choice.addV2도 더한다
  // choice.when = [{ if, set?, add?, addV2? }] 조건부 효과(2026-11-13 사건 5): 기본 set을 적용한 상태로 모든 if를 먼저 판정하고,
  //   맞는 것의 set을 덧쓰고 add(+V2면 addV2)를 기본 add와 합쳐 한 번에 더한다(합친 뒤 0 밑으로 안 내려감)
  function applyEffects(state, choice, v2) {
    var set = choice.set || {}, add = {}, k0;
    function sum(obj) { for (var k in (obj || {})) add[k] = (add[k] || 0) + obj[k]; }
    sum(choice.add);
    if (v2) sum(choice.addV2);
    Object.keys(set).forEach(function (k) { state.flags[k] = set[k]; });
    var hits = (choice.when || []).filter(function (w) { return evalCond(w.if, state); });
    hits.forEach(function (w) {
      Object.keys(w.set || {}).forEach(function (k) { state.flags[k] = w.set[k]; });
      sum(w.add);
      if (v2) sum(w.addV2);
    });
    Object.keys(add).forEach(function (k) {
      if (k.indexOf('trust.') === 0) {
        var who = k.slice(6);
        var v = (state.trust[who] || 0) + add[k];
        state.trust[who] = Math.max(TRUST_MIN, Math.min(TRUST_MAX, v));
      } else {
        state.stats[k] = Math.max(0, (state.stats[k] || 0) + add[k]);
      }
    });
    capTrust(state);
  }

  /* 내가 해친 친구(hurt.<인물>)의 믿음은 0을 넘지 않는다(2026-11-10 플레이테스트) —
   *   사진을 올리고 지워 준 것처럼, 수습을 했다고 피해를 준 친구의 믿음이 처음보다 올라가지는 않게. 선택할 때마다 다시 맞춘다 */
  function capTrust(state) {
    Object.keys(state.trust).forEach(function (who) {
      var key = 'hurt.' + who;
      if (state.trust[who] > 0 && COMPUTED.hasOwnProperty(key) && computed(key, state)) state.trust[who] = 0;
    });
  }

  function choose(story, state, choiceId) {
    if (state.screen !== 'scene' || state.reaction) throw new Error('지금은 선택할 수 없음');
    var scene = story.scenes[state.scene];
    var choice = visibleChoices(story, scene, state).filter(function (c) { return c.id === choiceId; })[0];
    if (!choice) throw new Error('없는 선택지: ' + state.scene + '#' + choiceId);
    var next = clone(state);
    next.history.push({ scene: state.scene, choice: choiceId, snap: snapshot(state) });
    applyEffects(next, choice, story.endingV2 === true);
    next.reaction = choiceId;
    return next;
  }

  function resolveNext(target, state) {
    if (!Array.isArray(target)) return target;
    for (var i = 0; i < target.length; i++) if (evalCond(target[i].if, state)) return target[i].to;
    return null;
  }

  /* 현재 장면에서 '계속'을 눌렀을 때의 목적지 */
  function pendingNext(story, state) {
    var scene = story.scenes[state.scene];
    if (state.reaction) {
      var ch = (scene.choices || []).filter(function (c) { return c.id === state.reaction; })[0];
      return resolveNext(ch.next, state);
    }
    return resolveNext(scene.next, state);
  }

  /* 선택지가 남아 있으면 계속할 수 없다 */
  function needsChoice(story, state) {
    if (state.screen !== 'scene' || state.reaction) return false;
    return visibleChoices(story, story.scenes[state.scene], state).length > 0;
  }

  function goTo(story, state, target) {
    var next = clone(state);
    next.reaction = null;
    if (target === '@ending') {
      next.screen = 'ending';
      next.ending = resolveEnding(story, next).code;
    } else if (typeof target === 'string' && target.indexOf('@chapter:') === 0) {
      next.screen = 'chapter';
      var ck = target.split(':')[1];
      next.nextChapter = /^\d+$/.test(ck) ? Number(ck) : ck; // 숫자 아닌 장 키도(특별 수업 'sc', 2026-11-10)
    } else {
      enterScene(story, next, target);
    }
    return next;
  }

  /* 걸어서 들어갈 장면인가 — 트리거가 있고, skipIf 조건이 참이 아니면(예: 이미 그 장소에 있음) */
  function walkTrigger(story, target, state) {
    var tr = story.triggers && story.triggers[target];
    return !!tr && !(tr.skipIf && evalCond(tr.skipIf, state));
  }

  /* 맵 트리거가 있는 장면은 먼저 맵(이동) 화면을 거친다 */
  function enterScene(story, next, target) {
    if (!story.scenes[target]) throw new Error('없는 장면: ' + target);
    if (walkTrigger(story, target, next)) {
      next.screen = 'map';
      next.mapTarget = target;
      return;
    }
    next.screen = 'scene';
    next.scene = target;
    next.visited.push(target);
  }

  function advance(story, state) {
    if (state.screen === 'chapter') {
      var n = state.nextChapter, ch = story.chapters[n];
      var next = clone(state);
      next.chapter = n;
      next.nextChapter = null;
      next.chapterMarks[n] = { stats: clone(state.stats), trust: clone(state.trust) };
      enterScene(story, next, ch.start);
      return next;
    }
    if (state.screen === 'map') {
      var m = clone(state);
      m.screen = 'scene';
      m.scene = state.mapTarget;
      m.mapTarget = null;
      m.visited.push(m.scene);
      return m;
    }
    if (needsChoice(story, state)) throw new Error('선택이 필요함: ' + state.scene);
    return goTo(story, state, pendingNext(story, state));
  }

  /* 마지막 선택 하나를 되돌린다 — 그 뒤 기록은 모두 버린다 */
  function undo(state) {
    if (!state.history.length) return state;
    var hist = state.history.slice(0, -1);
    var restored = clone(state.history[state.history.length - 1].snap);
    restored.history = hist;
    return restored;
  }

  function resolveEnding(story, state) {
    for (var i = 0; i < story.endings.length; i++) {
      if (evalCond(story.endings[i].if, state)) return story.endings[i];
    }
    return story.endings[story.endings.length - 1];
  }

  /* 엔딩 본문 줄(문자열 배열): body의 조건 줄 + ENDING_V2면 endingNotes(첫 줄에 lead) */
  function endingBody(story, end, state) {
    var out = [];
    (end.body || []).forEach(function (p) {
      if (typeof p === 'object' && !evalCond(p.if, state)) return;
      out.push(typeof p === 'object' ? p.text : p);
    });
    var notes = story.endingV2 === true && story.endingNotes;
    if (notes) {
      var lead = (notes.lead || {})[end.code] || '';
      notes.lines.forEach(function (n) {
        if (!evalCond(n.if, state)) return;
        out.push(lead + n.text); lead = '';
      });
    }
    return out;
  }

  /* 엔딩 한 줄 요약: 문자열 또는 [{ if, text }](위에서부터 처음 맞는 것, if가 없으면 늘 맞음).
   *   좋은 엔딩이어도 실제 선택과 어긋난 말을 하지 않게(2026-11-12 외부 검토 1번) */
  function endingSummary(story, end, state) {
    var s = end.summary;
    if (typeof s === 'string') return s;
    for (var i = 0; i < (s || []).length; i++) if (!s[i].if || evalCond(s[i].if, state)) return s[i].text;
    return '';
  }

  /* ENDING_V2 결과 지표: serious를 두 줄로 [{ label, value }]. ch를 주면 그 장 사건만 센다. 꺼져 있으면 null */
  function seriousSplit(story, state, ch) {
    if (story.endingV2 !== true || !story.seriousSplit) return null;
    return story.seriousSplit.map(function (row) {
      var n = 0;
      row.items.forEach(function (it) { if ((ch == null || it.ch === ch) && evalCond(it.if, state)) n++; });
      return { label: row.label, value: n };
    });
  }

  function eventOutcomes(story, eventId, state) {
    var ev = story.events[eventId];
    return ev.outcomes.filter(function (o) { return evalCond(o.if, state); }).map(function (o) { return o.text; });
  }

  /* 저장된 상태가 현재 스토리와 맞는지 */
  function isValidState(story, s) {
    if (!s || s.v !== 1 || typeof s !== 'object') return false;
    if (!s.stats || !s.trust || !s.flags || !Array.isArray(s.history) || !Array.isArray(s.visited)) return false;
    if (['scene', 'map', 'chapter', 'ending'].indexOf(s.screen) < 0) return false;
    if (s.screen === 'map' && !(story.scenes[s.mapTarget] && walkTrigger(story, s.mapTarget, s))) return false;
    if (!story.scenes[s.scene]) return false;
    if (s.screen === 'chapter' && !story.chapters[s.nextChapter]) return false;
    if (s.reaction) {
      var ok = (story.scenes[s.scene].choices || []).some(function (c) { return c.id === s.reaction; });
      if (!ok) return false;
    }
    return s.history.every(function (h) { return h && story.scenes[h.scene] && h.snap; });
  }

  /* 옛 진행 옮기기(2026-11-13 사건 5를 두 일로 나눔) — 저장된 run을 불러올 때 isValidState 앞에서 한 번. 원본은 그대로(새 객체).
   *   옛 흐름은 c2_e5_a 한 장면에서 all|min|jiho|anon 중 하나 → 지호 일(jiho|anon)은 새 플래그 e5j와 새 장면 c2_e5_j로.
   *   ① state·기록 snap의 flags.e5 = jiho|anon → flags.e5j로 옮기고 e5는 지움(안내문 일은 안 한 것으로)
   *   ② 기록의 c2_e5_a#jiho|anon → c2_e5_j(선택 경로 화면이 '내 선택'을 찾게) ③ c2_e5_a에서 jiho|anon 반응 중이면 c2_e5_j 반응으로
   *   수치는 옛 선택 때 이미 더해졌으므로 건드리지 않는다(새 흐름의 지호 일 보정은 고를 때만 일어난다). 이야기에 c2_e5_j가 없으면 아무것도 안 함 */
  var LEGACY_E5J = { jiho: 1, anon: 1 };
  function migrate(story, state) {
    if (!state || typeof state !== 'object' || !story.scenes || !story.scenes.c2_e5_j) return state;
    function moveFlag(s) {
      if (s && s.flags && LEGACY_E5J[s.flags.e5]) { s.flags.e5j = s.flags.e5; delete s.flags.e5; return true; }
      return false;
    }
    var touched = !!(state.flags && LEGACY_E5J[state.flags.e5]) ||
      (Array.isArray(state.history) && state.history.some(function (h) {
        return h && ((h.scene === 'c2_e5_a' && LEGACY_E5J[h.choice]) || (h.snap && h.snap.flags && LEGACY_E5J[h.snap.flags.e5]));
      }));
    if (!touched) return state;
    var next = clone(state);
    moveFlag(next);
    if (next.scene === 'c2_e5_a' && LEGACY_E5J[next.reaction]) next.scene = 'c2_e5_j';
    // 지나온 장면에도 c2_e5_j를(선택 경로 화면이 '이번에 지나지 않은 장면'으로 함께 보이지 않게, 최종 검토 2026-11-14)
    if (Array.isArray(next.visited) && next.visited.indexOf('c2_e5_j') < 0 && (next.scene === 'c2_e5_j' || (next.history || []).some(function (h) { return h && h.scene === 'c2_e5_j'; }))) next.visited.push('c2_e5_j');
    (next.history || []).forEach(function (h) {
      if (!h) return;
      if (h.scene === 'c2_e5_a' && LEGACY_E5J[h.choice]) h.scene = 'c2_e5_j';
      moveFlag(h.snap);
    });
    return next;
  }

  /* 특별 수업 「우리 교실에 AI CCTV를 단다면」(2026-11-10): 플래그만 쓰고 엔딩·수치와 무관.
   *   specialClassNotes = 고른 보기마다 선생님 반문 한 줄(순서: 알림 범위 → 보관 → 열람 → 설치 안 함), specialClassRows = 결과 칸 줄(설정된 것만)
   *   지금 보기에 없는 값(예: 배포 전 로컬 저장의 ccxPurpose = incident|guide|ai)은 그 줄만 '—'로 비워 보인다(unknown: true) — 화면이 깨지지 않게 */
  function specialClassNotes(story, state) {
    var sc = story.specialClass;
    return sc ? sc.notes.filter(function (n) { return evalCond(n.if, state); }).map(function (n) { return n.text; }) : [];
  }
  function specialClassRows(story, state) {
    var sc = story.specialClass;
    if (!sc) return [];
    var flags = (state && state.flags) || {};
    return sc.rows.filter(function (r) { return flags[r.key] != null; })
      .map(function (r) {
        var known = typeof flags[r.key] === 'string' && Object.prototype.hasOwnProperty.call(r.values, flags[r.key]);
        return known ? { label: r.label, text: r.values[flags[r.key]] } : { label: r.label, text: '—', unknown: true };
      });
  }

  var api = {
    STAT_KEYS: STAT_KEYS,
    COMPUTED: COMPUTED,
    evalCond: evalCond,
    normLine: normLine,
    visibleLines: visibleLines,
    visibleChoices: visibleChoices,
    createState: createState,
    choose: choose,
    advance: advance,
    needsChoice: needsChoice,
    pendingNext: pendingNext,
    undo: undo,
    resolveEnding: resolveEnding,
    endingBody: endingBody,
    endingSummary: endingSummary,
    seriousSplit: seriousSplit,
    specialClassNotes: specialClassNotes,
    specialClassRows: specialClassRows,
    eventOutcomes: eventOutcomes,
    isValidState: isValidState,
    migrate: migrate,
    clone: clone
  };
  root.PrivacyEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
