/*
 * 시나리오 설정 — PRD v2의 모든 초기 조정값을 한 곳에 모은다.
 * 이 값들은 플레이테스트로 바꿀 수 있는 게임 조정값이며 실제 교통·재정 모형이 아니다.
 * 값을 바꾸면 SCENARIO_VERSION을 올리고 node --test publicness/tests/ 를 다시 돌린다.
 */
(function (root) {
  'use strict';

  var T = true;
  function allStop(nodes) { return { nodes: nodes, stops: nodes.map(function () { return T; }) }; }

  var config = {
    SCENARIO_VERSION: 'pb-1.0.0',

    // 생활권과 정류장 (PRD §4). x,y = 고정 카메라 배치용 평면 좌표
    nodes: [
      { id: 'A', name: '중앙역', x: 0, y: 0, fromPhase: 1 },
      { id: 'B', name: '밀집 주거지', x: -2, y: 0, fromPhase: 1 },
      { id: 'C', name: '학교', x: -2, y: 2, fromPhase: 1 },
      { id: 'D', name: '병원·공공서비스', x: 0, y: 2, fromPhase: 1 },
      { id: 'E', name: '구도심 시장', x: 2, y: 2, fromPhase: 1 },
      { id: 'F', name: '외곽 마을', x: -4, y: 2, fromPhase: 1 },
      { id: 'G', name: '산업·일자리', x: 2, y: 0, fromPhase: 1 },
      { id: 'H', name: '문화·체육', x: 0, y: -2, fromPhase: 1 },
      { id: 'I', name: '신도시', x: 4, y: 0, fromPhase: 3 }
    ],

    // 양방향 도로와 이동 시간(분)
    roads: [
      { a: 'A', b: 'B', min: 2, fromPhase: 1 },
      { a: 'B', b: 'C', min: 2, fromPhase: 1 },
      { a: 'C', b: 'D', min: 2, fromPhase: 1 },
      { a: 'D', b: 'A', min: 2, fromPhase: 1 },
      { a: 'D', b: 'E', min: 2, fromPhase: 1 },
      { a: 'E', b: 'G', min: 2, fromPhase: 1 },
      { a: 'G', b: 'A', min: 2, fromPhase: 1 },
      { a: 'A', b: 'H', min: 2, fromPhase: 1 },
      { a: 'H', b: 'G', min: 3, fromPhase: 1 },
      { a: 'C', b: 'F', min: 3, fromPhase: 1 },
      { a: 'B', b: 'F', min: 4, fromPhase: 1 },
      { a: 'G', b: 'I', min: 3, fromPhase: 3 },
      { a: 'E', b: 'I', min: 4, fromPhase: 3 }
    ],

    // 기본 수요 (PRD §6) — 표 순서 그대로. 각 방향 n명
    demandRows: [
      { a: 'B', b: 'A', n: 12, fromPhase: 1 },
      { a: 'B', b: 'C', n: 10, fromPhase: 1 },
      { a: 'B', b: 'G', n: 10, fromPhase: 1 },
      { a: 'F', b: 'D', n: 6, fromPhase: 1 },
      { a: 'F', b: 'C', n: 6, fromPhase: 1 },
      { a: 'E', b: 'A', n: 8, fromPhase: 1 },
      { a: 'E', b: 'D', n: 6, fromPhase: 1 },
      { a: 'G', b: 'A', n: 10, fromPhase: 1 },
      { a: 'H', b: 'A', n: 6, fromPhase: 1 },
      { a: 'I', b: 'A', n: 8, fromPhase: 3 },
      { a: 'I', b: 'D', n: 8, fromPhase: 3 }
    ],

    bus: { capacity: 12, window: 120, requestWindow: 90, offsets: [0, 4, 8, 12], initialBuses: 3, maxBuses: 4, depot: 'A', dwell: 1, transferMin: 1 },
    finance: { fare: 1000, subsidy: 150000, holding: 20000, opPerMin: 100, movePerMin: 150 },
    events: { pNone: 0.60, pDemand: 0.85, timeBase: 35, timeSpan: 26, extraPerMin: 2, extraMinutes: 6 },
    defaultSeed: 42,
    discontent: { w: [0.5, 0.3, 0.2], waitOver: 15, tripOver: 30 },
    trust: { initial: 50, keep: 0.7 },
    ending: { stableRate: 0.8, stableMaxWait: 20, improvePts: 0.15 },
    essential: ['C', 'D'],
    reachInitial: ['F', 'E'],
    newZone: 'I',
    newTownPhase: 3,
    fourthFromPhase: 3,

    residents: [
      { id: 'haneul', name: '하늘', role: '학생', o: 'B', d: 'C', fromPhase: 1 },
      { id: 'narae', name: '나래', role: '주민', o: 'F', d: 'D', fromPhase: 1 },
      { id: 'jun', name: '준', role: '근로자', o: 'G', d: 'A', fromPhase: 1 },
      { id: 'sol', name: '솔', role: '주민', o: 'I', d: 'D', fromPhase: 3 }
    ],

    phases: ['학기 초', '적응기', '변화기', '조정기', '학기 말'],

    // 예시 노선 (PRD §4) — 수정·삭제 가능한 출발점일 뿐 정답이 아니다
    exampleRoutes: [
      allStop(['F', 'C', 'D', 'A']),
      allStop(['B', 'A', 'G', 'E']),
      allStop(['H', 'A', 'D', 'E']),
      allStop(['B', 'C', 'D', 'A']),
      allStop(['H', 'A', 'G'])
    ],
    initialDraft: {
      routes: [allStop(['B', 'A', 'G', 'E']), allStop(['B', 'C', 'D', 'A']), allStop(['H', 'A', 'G'])],
      buses: [{ id: 1, routeNum: 1, offset: 0 }, { id: 2, routeNum: 2, offset: 4 }, { id: 3, routeNum: 3, offset: 8 }]
    },

    ai: { maxCandidates: 30, maxIterations: 3 },
    playback: { msPerMinute: 500 }
  };

  root.PB = root.PB || {};
  root.PB.config = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})(typeof window !== 'undefined' ? window : globalThis);
