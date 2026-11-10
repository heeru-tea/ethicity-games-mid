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
   *   harmed_others 내가 다른 사람의 정보를 퍼뜨린 적이 있음 — 엔딩 C·D와 에필로그에서 책임을 다룬다 */
  var COMPUTED = {
    'hurt.minjun': 'e2post=story|group || e2fix=no || e7=join|silent || e7b=none',
    'hurt.saebom': 'e4=forward || e4b=blame',
    'hurt.jiho': 'e3=capture',
    'hurt.haneul': 'e6=post || e6b=deny|cap',
    harmed_others: 'e4=forward || e6=post || e7=join || e9=share || e2post=story || e3=capture || e6b=cap' // 2026-11-02: 지호 대화 캡처 전달·하늘 DM 캡처 전달 추가(엔딩 판정과 무관, 책임 문단만)
  };

  /* ── 조건 ───────────────────────── */
  function getVal(state, key) {
    if (key.indexOf('+') >= 0) {
      return key.split('+').reduce(function (s, k) { return s + Number(getVal(state, k.trim()) || 0); }, 0);
    }
    if (COMPUTED.hasOwnProperty(key)) return evalCond(COMPUTED[key], state);
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
  function applyEffects(state, choice, v2) {
    var set = choice.set || {}, add = {}, k0;
    for (k0 in (choice.add || {})) add[k0] = choice.add[k0];
    if (v2) for (k0 in (choice.addV2 || {})) add[k0] = (add[k0] || 0) + choice.addV2[k0];
    Object.keys(set).forEach(function (k) { state.flags[k] = set[k]; });
    Object.keys(add).forEach(function (k) {
      if (k.indexOf('trust.') === 0) {
        var who = k.slice(6);
        var v = (state.trust[who] || 0) + add[k];
        state.trust[who] = Math.max(TRUST_MIN, Math.min(TRUST_MAX, v));
      } else {
        state.stats[k] = Math.max(0, (state.stats[k] || 0) + add[k]);
      }
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
    seriousSplit: seriousSplit,
    specialClassNotes: specialClassNotes,
    specialClassRows: specialClassRows,
    eventOutcomes: eventOutcomes,
    isValidState: isValidState,
    clone: clone
  };
  root.PrivacyEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
