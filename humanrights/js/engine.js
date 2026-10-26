/*
 * 상태 엔진 — 진행 순서·진행 조건·최초 판단 잠금·계산 문항·정책 결과 시뮬레이터·일관성 점검.
 * DOM을 모르는 순수 로직이라 Node 테스트에서도 그대로 쓴다. 문장은 Stories, 조정값은 Config 에서 받는다.
 *
 * 흐름: intro → agenda(0..2, step 0..6) → guideline → rebuttal → reflection → report
 * 시뮬레이터는 점수를 내지 않는다. 측면마다 '기대되는 효과'와 '남아 있는 위험'을 따로 보여 주는 말만 만든다.
 */
(function (root) {
  'use strict';

  var STEPS = ['brief', 'data', 'initial', 'extra', 'interview', 'sim', 'final'];
  var STEP_NAMES = ['사건 브리핑', '데이터 분석', '최초 판단', '추가 정보', '시민 인터뷰', '정책 결과 시뮬레이터', '최종 판단'];
  var WRAP = ['guideline', 'rebuttal', 'reflection'];
  var WRAP_NAMES = ['정책 가이드라인', '반론 검토', '개인 성찰'];

  function agendaAnswer() {
    return {
      data: { picks: [], q: {} },
      initial: null,
      interview: { opened: false, pick: null, reason: '' },
      sim: { choice: 'B', prot: [], ran: false },
      final: { choice: null, prot: [], text: '', factor: null }
    };
  }

  function newState(S, version) {
    var answers = {};
    S.AGENDAS.forEach(function (ag) { answers[ag.id] = agendaAnswer(); });
    var g = {};
    S.GUIDELINE_FIELDS.forEach(function (f) { g[f.id] = ''; });
    var r = {};
    S.REFLECTION_FIELDS.forEach(function (f) { r[f.id] = ''; });
    return {
      v: version,
      phase: 'intro', agenda: 0, step: 0,
      answers: answers,
      guideline: g,
      consistency: {},
      rebuttal: { id: null, text: '', decision: null },
      reflection: r,
      completedAt: null
    };
  }

  function filled(text, min) { return typeof text === 'string' && text.trim().length >= min; }

  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (x) { if (x && !seen[x]) { seen[x] = true; out.push(x); } });
    return out;
  }

  function cleanProt(prot, S) {
    var ids = S.PROTECTIONS.map(function (p) { return p.id; });
    return uniq((prot || []).filter(function (id) { return ids.indexOf(id) >= 0; }));
  }

  // ── 계산 문항: 맞히거나 두 번 시도하면 설명을 보여 주고 다음으로 넘어갈 수 있다
  function answerQuestion(state, ag, qid, value) {
    var q = null;
    (ag.data.questions || []).forEach(function (x) { if (x.id === qid) q = x; });
    if (!q || q.type === 'text') return null;
    var rec = state.answers[ag.id].data.q[qid] || { value: null, tries: 0, done: false, correct: false };
    if (rec.done) return rec;
    var v = q.type === 'number' ? Number(String(value).replace(/[^0-9.\-]/g, '')) : Number(value);
    rec.value = value;
    rec.tries += 1;
    rec.correct = v === q.answer;
    rec.done = rec.correct || rec.tries >= 2;
    state.answers[ag.id].data.q[qid] = rec;
    return rec;
  }

  function stepReady(state, ag, step, min) {
    var a = state.answers[ag.id];
    switch (STEPS[step]) {
      case 'data':
        if (ag.data.kind === 'checklist') return a.data.picks.length > 0;
        return ag.data.questions.every(function (q) {
          if (q.type === 'text') return filled((a.data.q[q.id] || {}).value, min);
          return !!(a.data.q[q.id] && a.data.q[q.id].done);
        });
      case 'initial': return !!a.initial;
      case 'interview':
        if (!ag.interviewTask) return true;
        return a.interview.pick !== null && filled(a.interview.reason, min);
      case 'sim': return a.sim.ran;
      case 'final':
        if (!a.final.choice) return false;
        if (a.final.choice === 'B' && a.final.prot.length === 0) return false;
        if (ag.finalFactor && !a.final.factor) return false;
        return filled(a.final.text, min);
      default: return true;
    }
  }

  function canAdvance(state, S, min) {
    if (state.phase === 'agenda') return stepReady(state, S.AGENDAS[state.agenda], state.step, min);
    if (state.phase === 'guideline') {
      var gOk = S.GUIDELINE_FIELDS.every(function (f) { return filled(state.guideline[f.id], min); });
      var cOk = consistencyQuestions(state, S).every(function (q) { return filled(state.consistency[q.id], min); });
      return gOk && cOk;
    }
    if (state.phase === 'rebuttal') return filled(state.rebuttal.text, min) && !!state.rebuttal.decision;
    if (state.phase === 'reflection') return S.REFLECTION_FIELDS.every(function (f) { return filled(state.reflection[f.id], min); });
    return state.phase === 'intro';
  }

  function next(state, S, min) {
    if (!canAdvance(state, S, min)) return false;
    if (state.phase === 'intro') { state.phase = 'agenda'; state.agenda = 0; state.step = 0; }
    else if (state.phase === 'agenda') {
      if (state.step < STEPS.length - 1) state.step += 1;
      else if (state.agenda < S.AGENDAS.length - 1) { state.agenda += 1; state.step = 0; }
      else state.phase = 'guideline';
    }
    else if (state.phase === 'guideline') state.phase = 'rebuttal';
    else if (state.phase === 'rebuttal') state.phase = 'reflection';
    else if (state.phase === 'reflection') { state.phase = 'report'; if (!state.completedAt) state.completedAt = new Date().toISOString(); }
    return true;
  }

  // 되돌아가 보기는 자유. 최초 판단은 잠겨 있어 돌아가도 바꿀 수 없다
  function back(state, S) {
    if (state.phase === 'agenda') {
      if (state.step > 0) state.step -= 1;
      else if (state.agenda > 0) { state.agenda -= 1; state.step = STEPS.length - 1; }
      else state.phase = 'intro';
    }
    else if (state.phase === 'guideline') { state.phase = 'agenda'; state.agenda = S.AGENDAS.length - 1; state.step = STEPS.length - 1; }
    else if (state.phase === 'rebuttal') state.phase = 'guideline';
    else if (state.phase === 'reflection') state.phase = 'rebuttal';
    else if (state.phase === 'report') state.phase = 'reflection';
    else return false;
    return true;
  }

  function lockInitial(state, ag, choice, S) {
    var a = state.answers[ag.id];
    if (a.initial || !S.CHOICES[choice]) return false;
    a.initial = choice;
    // 시뮬레이터는 최초 판단에서 출발한다(학생이 바꿔 볼 수 있음)
    a.sim.choice = choice;
    return true;
  }

  // ── 정책 결과 시뮬레이터
  function level(text, meter) { return { text: text, meter: meter }; }

  function simulate(ag, choice, prot, S) {
    var sim = ag.sim, res = { choice: choice, aspects: {}, rightsProtected: [], rightsAtRisk: [], unresolved: [], affected: [], reduced: 0 };
    S.ASPECTS.forEach(function (x) { res.aspects[x.id] = { level: null, effects: [], risks: [] }; });
    var A = res.aspects;

    if (choice === 'C') {
      sim.noAdopt.effects.forEach(function (e) { A[e.aspect].effects.push(e.text); });
      sim.noAdopt.risks.forEach(function (r) { A[r.aspect].risks.push(r.text); });
      A.cost.effects.push('새 장비·운영 비용이 들지 않아요.');
      res.rightsProtected = uniq(sim.risks.map(function (r) { return r.right; }));
      res.unresolved = sim.noAdopt.unresolved.slice();
      res.affected = sim.noAdopt.affected.slice();
      A.efficiency.level = level('변화 없음', 1);
      A.cost.level = level('늘지 않음', 0);
      A.rights.level = level('새 위험 없음', 0);
      A.trust.level = level('그대로', 1);
      return res;
    }

    var chosen = choice === 'B' ? cleanProt(prot, S) : [];
    var names = {};
    S.PROTECTIONS.forEach(function (p) { names[p.id] = p.name; });

    sim.benefits.forEach(function (b) { A[b.aspect].effects.push(b.text); res.affected.push(b.who); });
    A.cost.risks.push(sim.adoptCost);
    res.rightsProtected = sim.adoptProtects.slice();

    var slows = false, costly = 0;
    chosen.forEach(function (id) {
      var n = sim.protNotes[id] || {};
      if (n.efficiency) A.efficiency.risks.push('[' + names[id] + '] ' + n.efficiency);
      if (n.cost) { A.cost.risks.push('[' + names[id] + '] ' + n.cost); costly += 1; }
      if (n.slows) slows = true;
    });

    var remaining = 0;
    sim.risks.forEach(function (r) {
      var by = r.fixedBy.filter(function (id) { return chosen.indexOf(id) >= 0; });
      if (by.length) {
        A[r.aspect].effects.push('[' + by.map(function (id) { return names[id]; }).join('·') + '] ' + r.reduced);
        res.rightsProtected.push(r.right);
        res.reduced += 1;
      } else {
        A[r.aspect].risks.push(r.text);
        res.rightsAtRisk.push(r.right);
        res.affected.push(r.who);
        remaining += 1;
      }
    });

    // 조치와 관계없는 효과가 없는 조치는 따로 알린다
    var related = {};
    sim.risks.forEach(function (r) { r.fixedBy.forEach(function (id) { related[id] = true; }); });
    var idle = chosen.filter(function (id) { return !related[id]; });
    if (idle.length) res.unresolved.push(idle.map(function (id) { return names[id]; }).join('·') + '은(는) 이 안건의 주요 위험을 직접 줄이지 않아요.');

    res.unresolved = res.unresolved.concat(sim.alwaysUnresolved);
    if (res.reduced) res.unresolved.push('보호 조치는 위험을 줄이지만 0으로 만들지는 않아요. 운영하면서 계속 확인해야 해요.');
    if (remaining) res.unresolved.push('보호 조치가 닿지 않은 위험이 ' + remaining + '가지 남아 있어요.');

    res.rightsProtected = uniq(res.rightsProtected);
    res.rightsAtRisk = uniq(res.rightsAtRisk);
    res.affected = uniq(res.affected);

    A.efficiency.level = slows ? level('좋아짐', 2) : level('크게 좋아짐', 3);
    A.cost.level = costly >= 3 ? level('많이 늘어남', 3) : level('늘어남', 2);
    A.rights.level = remaining === 0 ? level('낮음', 1) : remaining === 1 ? level('중간', 2) : level('높음', 3);
    A.trust.level = remaining === 0 ? level('높아짐', 3) : remaining === 1 ? level('나뉨', 2) : level('낮아짐', 1);
    return res;
  }

  // ── 마무리: 세 판단이 서로 어긋나는 곳을 질문으로 (최대 3개)
  function consistencyQuestions(state, S) {
    var ags = S.AGENDAS, fin = {}, out = [];
    ags.forEach(function (ag) { fin[ag.id] = state.answers[ag.id].final; });
    var lib = fin.library, hir = fin.hiring, pol = fin.policing;

    if (lib && hir && lib.choice && hir.choice && ((lib.choice === 'A' && hir.choice === 'C') || (lib.choice === 'C' && hir.choice === 'A'))) {
      out.push({ id: 'contrast:library:hiring', text: '출입과 채용은 모두 집단 간 인증 실패율 차이가 있었어요. 그런데 한쪽은 도입하고 다른 쪽은 도입하지 않았어요. 무엇이 판단을 갈랐나요?' });
    }
    if (pol && pol.choice === 'A' && ((lib && lib.choice && lib.choice !== 'A') || (hir && hir.choice && hir.choice !== 'A'))) {
      out.push({ id: 'contrast:policing', text: '치안에서는 조건 없이 도입했는데, 다른 안건에서는 조건을 붙이거나 도입하지 않았어요. 모든 시민이 대상인 치안에서 조건이 필요 없다고 본 이유는 무엇인가요?' });
    }

    S.PROTECTIONS.forEach(function (p) {
      ags.forEach(function (x) {
        ags.forEach(function (y) {
          if (x === y) return;
          var fx = fin[x.id], fy = fin[y.id];
          if (!fx || !fy || fx.choice !== 'B' || fx.prot.indexOf(p.id) < 0) return;
          if (fy.choice !== 'A' && fy.choice !== 'B') return;
          if (fy.choice === 'B' && fy.prot.indexOf(p.id) >= 0) return;
          if (y.related.indexOf(p.id) < 0) return;
          out.push({ id: 'prot:' + p.id + ':' + x.id + ':' + y.id, text: x.short + '에서는 ' + p.obj + ' 요구했는데 ' + y.short + '에서는 왜 요구하지 않았나요?' });
        });
      });
    });

    out = out.slice(0, 3);
    if (!out.length) out.push({ id: 'common', text: '세 안건의 판단에 공통으로 적용한 기준은 무엇이었나요?' });
    return out;
  }

  function cardText(state, S, title) {
    return title + ' · ' + S.AGENDAS.map(function (ag) {
      var f = state.answers[ag.id].final;
      return ag.short + ' ' + (f && f.choice ? S.CHOICES[f.choice].short : '-');
    }).join(' · ');
  }

  // 저장된 진행을 불러올 때 형식을 확인하고, 빠진 칸은 새 상태로 채운다
  function restore(saved, S, version) {
    if (!saved || saved.v !== version || !saved.answers) return null;
    var base = newState(S, version);
    var phases = ['intro', 'agenda', 'guideline', 'rebuttal', 'reflection', 'report'];
    if (phases.indexOf(saved.phase) < 0) return null;
    base.phase = saved.phase;
    base.agenda = Math.max(0, Math.min(S.AGENDAS.length - 1, saved.agenda | 0));
    base.step = Math.max(0, Math.min(STEPS.length - 1, saved.step | 0));
    S.AGENDAS.forEach(function (ag) {
      var a = saved.answers[ag.id], b = base.answers[ag.id];
      if (!a) return;
      if (a.data) { b.data.picks = Array.isArray(a.data.picks) ? a.data.picks : []; b.data.q = a.data.q || {}; }
      b.initial = S.CHOICES[a.initial] ? a.initial : null;
      if (a.interview) { b.interview.opened = !!a.interview.opened; b.interview.pick = a.interview.pick == null ? null : a.interview.pick; b.interview.reason = String(a.interview.reason || ''); }
      if (a.sim) { b.sim.choice = S.CHOICES[a.sim.choice] ? a.sim.choice : b.sim.choice; b.sim.prot = cleanProt(a.sim.prot, S); b.sim.ran = !!a.sim.ran; }
      if (a.final) {
        b.final.choice = S.CHOICES[a.final.choice] ? a.final.choice : null;
        b.final.prot = cleanProt(a.final.prot, S);
        b.final.text = String(a.final.text || '');
        b.final.factor = a.final.factor || null;
      }
    });
    ['guideline', 'reflection', 'consistency'].forEach(function (k) {
      if (saved[k] && typeof saved[k] === 'object') Object.keys(saved[k]).forEach(function (id) { base[k][id] = String(saved[k][id] || ''); });
    });
    if (saved.rebuttal) {
      base.rebuttal.id = S.REBUTTALS[saved.rebuttal.id] ? saved.rebuttal.id : null;
      base.rebuttal.text = String(saved.rebuttal.text || '');
      base.rebuttal.decision = saved.rebuttal.decision === 'keep' || saved.rebuttal.decision === 'revise' ? saved.rebuttal.decision : null;
    }
    base.completedAt = saved.completedAt || null;
    return base;
  }

  var api = {
    STEPS: STEPS, STEP_NAMES: STEP_NAMES, WRAP: WRAP, WRAP_NAMES: WRAP_NAMES,
    newState: newState, restore: restore, canAdvance: canAdvance, next: next, back: back,
    lockInitial: lockInitial, answerQuestion: answerQuestion, simulate: simulate,
    consistencyQuestions: consistencyQuestions, cardText: cardText, cleanProt: cleanProt
  };
  root.HR = root.HR || {};
  root.HR.Engine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
