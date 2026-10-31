/*
 * 운영 시뮬레이션 — 같은 환자 100명에 운영 기준만 바꿔 적용한다. 같은 입력이면 늘 같은 결과(난수 없음).
 *
 * 정책 policy = { mild, severe, emergency }
 *   mild·severe(AI가 붙인 등급에 적용 — 의료진은 실제 상태를 미리 모른다)
 *     all   의료진이 AI 결과를 모두 재검토
 *     cond  위험 신호·불확실성(확신도 70% 미만)이 있으면 우선 재확인
 *     sample AI 분류를 적극 활용하고 일부(10명 중 1명)만 선별 재확인
 *   emergency(응급환자 평가는 어떤 선택에서도 즉시 이뤄진다. AI가 맡는 보조 역할만 다르다)
 *     alert   위험 신호를 감지해 즉시 알림 → 위험 신호가 있는 환자를 접수 즉시 중증으로 올림
 *     summary 증상·검사 정보를 빠르게 요약 → 응급 처치 시간이 줄어 다른 환자에게 쓸 시간이 생김
 *     monitor 상태 변화를 지속적으로 감시 → 기다리는 동안 상태가 변한 중증 환자를 20분 만에 알아챔
 * 안전장치 safeguards(미션 4, 최종 운영에만) — 점수를 더하지 않고 특정 환자와 절차에 작용한다(기획 6-2.6)
 *     analysis  AI 오류 집중 분석: 반복 오류 유형(pattern)에 위험 신호를 붙인다
 *     staff     고위험 환자 추가 검토 인력: 재검토만 맡는 의료진 1명이 더해진다
 *     warning   AI 불확실성 경고 강화: 불확실성 기준이 확신도 70% → 85% 미만으로 넓어진다
 *     training  의료진 AI 활용 교육: 알아채기 어려운 사례도 재검토에서 발견, 재검토 시간 5분 → 4분
 *
 * 진료 모델: 의사 3명이 오전 9시부터 접수 순서대로 들어오는 환자를 우선순위대로 본다.
 *   우선순위 0 응급 평가·처치 / 1 AI 중증 재검토 / 2 중증 진료 / 2.5 AI 경증 재검토 / 3 경증 진료
 *   진료 지연 = 접수 후 60분 넘게 기다린 환자
 *   놓친 위험 = 실제 중증인데 끝내 알아채지 못했거나, 알아챘어도 30분 안에 진료를 시작하지 못한 환자
 *   검토 업무 = 의료진 재검토 건수
 *   상태 악화 = 오래(90분 초과) 기다리다 상태가 나빠진 경증 환자(진료 지연에 포함)
 */
(function (root) {
  'use strict';

  var P = (typeof module !== 'undefined' && module.exports) ? require('./patients.js') : root.SafetyPatients;

  // 분 단위 처리 시간과 판정 기준(tests/sweep.mjs로 조정)
  var T = { doctors: 3, emergency: 20, emergencySummary: 15, review: 5, reviewTrained: 4, severe: 6, mild: 5,
    delay: 60, deadline: 30, monitorAfter: 20, worsenAfter: 90, uncertain: 70, uncertainWarning: 85 };

  var BUDGET = 5;
  var SAFEGUARDS = {
    analysis: { cost: 2 },
    staff: { cost: 3 },
    warning: { cost: 2 },
    training: { cost: 1 }
  };

  function sampled(p) { return p.n % 10 === 0; }

  // 이 환자를 재검토 대상으로 보낼까(AI 등급별 정책)
  function needsReview(p, policy, sg) {
    if (p.ai === 'emergency') return false;
    var rule = policy[p.ai];
    var flag = p.flag || (sg.analysis && p.pattern);
    var uncertain = p.conf < (sg.warning ? T.uncertainWarning : T.uncertain);
    if (rule === 'all') return true;
    if (rule === 'cond') return !!(flag || uncertain);
    return sampled(p);
  }

  function run(policy, safeguards) {
    var sg = {};
    (safeguards || []).forEach(function (k) { sg[k] = true; });
    var reviewTime = sg.training ? T.reviewTrained : T.review;
    var emergencyTime = policy.emergency === 'summary' ? T.emergencySummary : T.emergency;

    // 환자별 상태
    var st = P.list.map(function (p) {
      var flag = p.flag || !!(sg.analysis && p.pattern);
      var known = p.ai; // 의료진이 지금 알고 있는 등급
      var how = null;   // 알아챈 경로
      if (p.ai === 'mild' && policy.emergency === 'alert' && flag && p.actual === 'severe') { known = 'severe'; how = 'alert'; }
      return { p: p, flag: flag, known: known, how: how, review: needsReview(p, policy, sg), reviewed: false, reviewStart: null, careStart: null, careEnd: null };
    });

    // 할 일 목록: 재검토가 필요한 환자는 재검토 → 진료, 아니면 바로 진료
    var tasks = [];
    st.forEach(function (s) {
      if (s.p.ai === 'emergency') tasks.push({ s: s, kind: 'care', ready: s.p.arrive });
      else if (s.review) tasks.push({ s: s, kind: 'review', ready: s.p.arrive });
      else tasks.push({ s: s, kind: 'care', ready: s.p.arrive });
    });

    function priority(task, now) {
      var s = task.s;
      if (s.p.ai === 'emergency') return 0;
      // 재검토: AI가 중증이라 한 환자는 중증 진료보다 먼저, 경증이라 한 환자는 중증 진료 다음
      if (task.kind === 'review') return s.p.ai === 'severe' ? 1 : 2.5;
      // 상태 감시: 기다린 지 20분이 지나 상태 변화가 보이는 실제 중증 환자는 바로 의료진에게 연결
      if (policy.emergency === 'monitor' && s.p.actual === 'severe' && (s.p.worsen || s.known === 'severe') && now - s.p.arrive >= T.monitorAfter) {
        if (s.known !== 'severe') { s.known = 'severe'; s.how = 'monitor'; }
        return 0;
      }
      return s.known === 'severe' ? 2 : 3;
    }

    var doctors = [];
    for (var d = 0; d < T.doctors; d++) doctors.push({ free: 0, reviewOnly: false });
    if (sg.staff) doctors.push({ free: 0, reviewOnly: true });

    var reviews = 0, guard = 0;
    while (tasks.length && guard++ < 10000) {
      // 가장 먼저 비는 의료진
      doctors.sort(function (a, b) { return a.free - b.free || (a.reviewOnly ? 1 : 0) - (b.reviewOnly ? 1 : 0); });
      var picked = null, doc = null;
      for (var i = 0; i < doctors.length && !picked; i++) {
        var dr = doctors[i];
        var pool = tasks.filter(function (t) { return !dr.reviewOnly || t.kind === 'review'; });
        if (!pool.length) continue;
        var now = Math.max(dr.free, Math.min.apply(null, pool.map(function (t) { return t.ready; })));
        var ready = pool.filter(function (t) { return t.ready <= now; });
        ready.sort(function (a, b) { return priority(a, now) - priority(b, now) || a.ready - b.ready || a.s.p.n - b.s.p.n; });
        picked = ready[0]; doc = dr; picked._now = now;
      }
      if (!picked) break;
      tasks.splice(tasks.indexOf(picked), 1);
      var t0 = picked._now, s = picked.s;
      if (picked.kind === 'review') {
        reviews++;
        s.reviewed = true; s.reviewStart = t0;
        var canSee = !s.p.subtle || sg.training;
        if (canSee && s.known !== s.p.actual) { s.known = s.p.actual; s.how = s.how || 'review'; }
        doc.free = t0 + reviewTime;
        tasks.push({ s: s, kind: 'care', ready: doc.free });
      } else {
        s.careStart = t0;
        var dur = s.p.ai === 'emergency' ? emergencyTime : (s.known === 'severe' ? T.severe : T.mild);
        s.careEnd = t0 + dur;
        doc.free = s.careEnd;
      }
    }

    // 결과 정리
    var out = { delayed: 0, missed: 0, worsened: 0, reviews: reviews, emergencyOnTime: 0, patients: {} };
    st.forEach(function (s) {
      var p = s.p, wait = s.careStart - p.arrive;
      // 상태 감시는 진료 순서와 상관없이 20분 만에 상태 변화를 알린다(경증으로 이미 진료를 받던 중이어도)
      if (policy.emergency === 'monitor' && p.actual === 'severe' && p.worsen && s.known !== 'severe') {
        s.known = 'severe'; s.how = 'monitor'; wait = Math.min(wait, T.monitorAfter);
      }
      var r = { wait: wait, reviewed: s.reviewed, known: s.known, how: s.how, state: 'ontime' };
      if (p.actual === 'emergency') { if (wait <= 5) out.emergencyOnTime++; }
      if (p.actual === 'severe') {
        if (s.known !== 'severe') r.state = 'missed';
        else if (wait > T.deadline) r.state = 'late';
      }
      if (r.state === 'missed' || r.state === 'late') out.missed++;
      if (wait > T.delay) { out.delayed++; if (r.state === 'ontime') r.state = 'delayed'; }
      if (p.fragile && wait > T.worsenAfter) { out.worsened++; r.state = 'worsened'; }
      out.patients[p.id] = r;
    });
    return out;
  }

  // 미션 2의 중심 사건 — 오류는 대부분 AI가 경증으로 분류한 무리에 숨어 있어 경증 기준이 사건을 정한다
  function eventFor(policy) { return policy.mild === 'all' ? 'B' : policy.mild === 'cond' ? 'C' : 'A'; }

  // 엔딩 경향(점수가 아니다)
  function tendency(policy) {
    var v = { sample: 0, cond: 1, all: 2 }, score = v[policy.mild] + v[policy.severe];
    if (score <= 1) return 'speed';
    if (score === 4 || (score === 3 && policy.mild === 'all')) return 'thorough';
    return 'balance';
  }

  function cost(list) { return (list || []).reduce(function (a, k) { return a + (SAFEGUARDS[k] ? SAFEGUARDS[k].cost : 0); }, 0); }

  var api = { run: run, eventFor: eventFor, tendency: tendency, cost: cost, BUDGET: BUDGET, SAFEGUARDS: SAFEGUARDS,
    LEVELS: ['all', 'cond', 'sample'], EMERGENCY: ['alert', 'summary', 'monitor'], T: T };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SafetySim = api;
})(this);
