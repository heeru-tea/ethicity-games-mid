/*
 * 엔딩별 "아무거나 골랐다면" 확률(%) — 선택지를 무작위로 골라 10만 번 완주한 비율(tests/check-story.mjs가 계산).
 * 엔딩 연출에서 "아무거나 골랐다면 이 엔딩에 닿을 확률은 n%예요"로 보여 준다. 플레이어 기록은 모으지 않는다.
 * 이야기를 고쳐 비율이 1%p 넘게 달라지면 check-story가 알려 준다 → 그 값으로 고칠 것.
 * ENDING_V2(js/story.js, 2026-11-09)가 켜졌으면 V2, 꺼졌으면 V1(이전 판정)을 쓴다. 둘 다 확인: node tests/check-story.mjs / ENDING_V2=0 node tests/check-story.mjs
 */
(function (root) {
  'use strict';
  var V1 = { A: 1.2, B: 32.0, C: 36.1, D: 30.7 }; // 2026-11-12 오후 엔딩 A에 해친 친구 없음(harm_count=0) — sim-endings 12만 회. 이전 A 6.9 · B 26.9 · C 35.5 · D 30.7 ← 2026-11-12 새 난수(mulberry32)·e5 jiho 반영 뒤 다시 계산(ENDING_V2=0 sim-endings 2.9만 회). 이전 A 8.5 · B 25.4 · C 30.8 · D 35.2 ← 2026-11-10 플레이테스트(엔딩 B 조건·믿음 상한·사과 장면) 뒤 다시 계산. 이전 A 8.9 · B 40.4 · C 17.4 · D 33.3 ← // 2026-11-02 계정 사칭(e6 post) serious+1 후(check-story 10만 회). 이전 A 9.0·B 43.0·C 21.6·D 26.3
  // 2026-11-10 플레이테스트: 엔딩 B = 확산 4 이하 + 해친 친구 2명 이하, 해친 친구의 믿음 상한, 사과 장면. 이전(2026-11-09 ENDING_V2) A 6.4 · B 39.4 · C 20.9 · D 33.3
  // 2026-11-12 외부 검토 8번: 난수를 32비트 연산(mulberry32)으로 바꿔 다시 계산 — 예전 식은 10,466번마다 되풀이돼 값이 치우쳐 있었다(이전 표시 A 5.5 · B 26.1 · C 33.2 · D 35.2, 그중 D 35.2 → 30.9는 이야기를 안 바꿔도 달라진 몫).
  //   같은 날 지호의 대화를 AI에 넣은 선택(e5 jiho)도 확산 +1·최소 공유 -1 → A가 조금 줄었다. check-story 10만 회: A 4.0 · B 25.2 · C 39.8 · D 30.9.
  //   씨앗을 바꿔 세 번(tools/sim-endings.mjs, 2.2만~4.7만 회): A 4.0~4.2 · B 24.9~25.1 · C 39.9~40.0 · D 30.8~31.0 → 흔들림이 ±0.2%p 안이라 화면에는 정수로 보인다(소수 한 자리는 믿을 만한 자릿수가 아니다)
  // 2026-11-12 오후 사용자 결정: 엔딩 A에 해친 친구 없음(harm_count=0) → sim-endings 6.8만 회 A 0.9 · B 27.8 · C 40.6 · D 30.6(씨앗 7로 6만 회: 30.8, 나머지 같음). 이전 표시 A 4 · B 25 · C 40 · D 31
  var V2 = { A: 1, B: 28, C: 41, D: 31 };
  var st = root.PRIVACY_STORY;
  var ODDS = st && st.endingV2 === false ? V1 : V2;
  root.PRIVACY_ODDS = ODDS;
  if (typeof module !== 'undefined' && module.exports) module.exports = ODDS;
})(typeof window !== 'undefined' ? window : globalThis);
