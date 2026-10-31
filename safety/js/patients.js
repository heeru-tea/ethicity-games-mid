/*
 * 가상 환자 100명 — 모든 학생에게 똑같이 쓰는 고정 데이터(기획 6-1). 실제 병원의 비율·AI 정확도가 아니다.
 *   actual  실제 상태   mild 경증 · severe 중증 · emergency 응급
 *   ai      메디AI 분류 (응급은 접수 즉시 의료진이 보므로 항상 emergency)
 *   conf    AI 확신도(%) — AI가 스스로 매긴 점수일 뿐 정답 확률이 아니다
 *   flag    위험 신호(별도 확인이 필요한 증상·검사 수치)가 화면에 표시되는가
 *   subtle  재검토해도 알아채기 어려운 사례(의료진 AI 활용 교육이 있으면 발견)
 *   worsen  기다리는 동안 상태 변화가 나타나는가(AI 상태 감시가 알아챔)
 *   fragile 실제 경증이지만 오래 기다리면(90분 초과) 상태가 나빠지는 환자
 *   pattern 반복되는 오류 유형(AI 오류 집중 분석이 찾아냄)
 *   arrive  접수 시각(분, 오전 9:00 = 0)
 * 특별 사례(note가 있는 환자)는 이야기·오류 보고서·사례 설명에 그대로 쓰인다.
 * 미션 3의 확신도 96% 오류(P047)는 미션 2 데이터에 처음부터 들어 있다(기획 6-2).
 */
(function (root) {
  'use strict';

  // 특별 사례: 실제 중증인데 AI가 경증으로 분류한 7명 + 그 밖에 이야기에 쓰는 환자
  var SPECIAL = {
    P008: { actual: 'severe', ai: 'mild', conf: 74, flag: true, note: '두통이 심해졌다고 말한 40대 환자', detail: '혈압이 높게 측정됐지만 AI는 긴장성 두통으로 보았습니다.' },
    P023: { actual: 'severe', ai: 'mild', conf: 62, worsen: true, note: '복통으로 온 20대 환자', detail: 'AI는 확신도가 낮은 채로 장염으로 분류했습니다. 실제로는 맹장염이었습니다.' },
    P035: { actual: 'severe', ai: 'mild', conf: 79, flag: true, note: '숨이 차다고 한 70대 환자', detail: '산소포화도가 조금 낮았지만 AI는 감기로 분류했습니다.' },
    P047: { actual: 'severe', ai: 'mild', conf: 96, pattern: 'chest', note: '소화불량과 어깨 통증을 말한 60대 환자', detail: 'AI는 확신도 96%로 소화불량이라고 판단했습니다. 실제로는 빠른 치료가 필요한 심장 질환이었습니다.' },
    P058: { actual: 'severe', ai: 'mild', conf: 81, worsen: true, note: '발목을 다친 50대 환자', detail: 'AI는 단순 염좌로 분류했지만, 다리가 붓고 저리는 증상이 숨어 있었습니다.' },
    P070: { actual: 'severe', ai: 'mild', conf: 77, flag: true, note: '열이 나는 80대 환자', detail: '의식이 조금 흐려 보였지만 AI는 독감으로 분류했습니다.' },
    P084: { actual: 'severe', ai: 'mild', conf: 91, pattern: 'chest', subtle: true, note: '명치가 답답하다고 한 50대 환자', detail: 'P047과 같은 유형의 오류였습니다. 증상이 가벼워 보여 의료진도 처음에는 알아채기 어려웠습니다.' }
  };
  // 실제 경증인데 AI가 중증으로 분류한 8명(불필요한 재확인·우선 진료를 만든다)
  var FALSE_ALARM = { P005: 66, P017: 58, P029: 71, P041: 63, P052: 69, P063: 55, P077: 73, P093: 61 };
  // 실제 경증인데 위험 신호가 표시된 6명(조건부 재확인 업무를 늘린다)
  var FALSE_FLAG = { P012: 1, P031: 1, P044: 1, P066: 1, P081: 1, P097: 1 };
  // 실제 응급 10명
  var EMERGENCY = { P003: 1, P014: 1, P026: 1, P038: 1, P049: 1, P061: 1, P073: 1, P086: 1, P090: 1, P099: 1 };
  // AI가 맞게 분류한 실제 중증 13명
  var SEVERE_OK = { P006: 1, P010: 1, P019: 1, P027: 1, P033: 1, P040: 1, P051: 1, P055: 1, P068: 1, P075: 1, P079: 1, P088: 1, P095: 1 };
  // 상태 변화가 나타나는 그 밖의 중증 환자
  var WORSEN = { P019: 1, P051: 1, P079: 1 };
  // 실제 경증이지만 오래 기다리면 상태가 나빠지는 환자(90분 넘게 기다리면 추가 조치가 필요해진다)
  var FRAGILE = {
    P046: { note: '기침이 오래간 70대 환자', detail: '가벼운 기관지염이었지만, 오래 기다리는 동안 열이 오르고 숨이 가빠졌습니다.' },
    P062: { note: '어지럼증으로 온 80대 환자', detail: '가벼운 탈수였지만, 대기실에서 오래 기다리다 쓰러질 뻔해 수액 처치가 필요해졌습니다.' },
    P089: { note: '당뇨가 있는 60대 환자', detail: '정기 검사로 왔지만, 기다리는 동안 혈당이 떨어져 추가 조치가 필요해졌습니다.' }
  };

  function confFor(n) { return 60 + ((n * 37) % 39); } // 맞게 분류한 환자의 확신도 60~98(고정) — AI가 스스로 망설이는 환자도 많다

  var list = [];
  for (var n = 1; n <= 100; n++) {
    var id = 'P' + String(n).padStart(3, '0');
    var p = { id: id, n: n, arrive: Math.round((n - 1) * 2.4), actual: 'mild', ai: 'mild', conf: confFor(n), flag: false, subtle: false, worsen: false, fragile: false, pattern: null, note: null, detail: null };
    if (SPECIAL[id]) Object.assign(p, SPECIAL[id]);
    else if (EMERGENCY[id]) { p.actual = 'emergency'; p.ai = 'emergency'; p.conf = 99; }
    else if (SEVERE_OK[id]) { p.actual = 'severe'; p.ai = 'severe'; }
    else if (FALSE_ALARM[id]) { p.ai = 'severe'; p.conf = FALSE_ALARM[id]; }
    else if (FALSE_FLAG[id]) p.flag = true;
    if (WORSEN[id]) p.worsen = true;
    if (FRAGILE[id]) { p.fragile = true; Object.assign(p, FRAGILE[id]); }
    list.push(p);
  }

  var api = { list: list, byId: function (id) { return list.filter(function (p) { return p.id === id; })[0]; }, REPORT_CASE: 'P047' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SafetyPatients = api;
})(this);
