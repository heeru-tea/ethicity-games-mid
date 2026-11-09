/*
 * 엔딩별 "아무거나 골랐다면" 확률(%) — 선택지를 무작위로 골라 10만 번 완주한 비율(tests/check-story.mjs가 계산).
 * 엔딩 연출에서 "아무거나 골랐다면 이 엔딩에 닿을 확률은 n%예요"로 보여 준다. 플레이어 기록은 모으지 않는다.
 * 이야기를 고쳐 비율이 1%p 넘게 달라지면 check-story가 알려 준다 → 그 값으로 고칠 것.
 * ENDING_V2(js/story.js, 2026-11-09)가 켜졌으면 V2, 꺼졌으면 V1(이전 판정)을 쓴다. 둘 다 확인: node tests/check-story.mjs / ENDING_V2=0 node tests/check-story.mjs
 */
(function (root) {
  'use strict';
  var V1 = { A: 8.9, B: 40.4, C: 17.4, D: 33.3 }; // 2026-11-02 계정 사칭(e6 post) serious+1 후(check-story 10만 회). 이전 A 9.0·B 43.0·C 21.6·D 26.3
  var V2 = { A: 6.4, B: 39.4, C: 20.9, D: 33.3 }; // 2026-11-09 ENDING_V2: AI 통째 입력 spread+1·minimize−1, 계정 장난 consent−1
  var st = root.PRIVACY_STORY;
  var ODDS = st && st.endingV2 === false ? V1 : V2;
  root.PRIVACY_ODDS = ODDS;
  if (typeof module !== 'undefined' && module.exports) module.exports = ODDS;
})(typeof window !== 'undefined' ? window : globalThis);
