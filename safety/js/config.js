/*
 * 게임 설정 — 공통 팩 경로, 저장 키, 인물, 장소(배경·이동 영역·출입구·조사 대상), 선택지 문구.
 * 좌표는 모두 1280×720 논리 화면, 인물은 발 기준점(공통 팩 footAnchor 48,120).
 * 이동 영역(walk)과 막힘(block)은 이 게임이 장면마다 직접 정한 값이다. 공통 팩 walkAreas(예제용)는 쓰지 않는다.
 */
(function (root) {
  'use strict';

  var C = {
    GAME_ID: 'safety',
    TITLE: '의료 AI 안전기준 위원회',
    COMMON_BASE: '../shared/ethicity-elementary-common-v1',
    KEYS: {
      player: 'ethicity.player',              // 공통 플레이어 정보 — 읽기만
      result: 'ethicity.result.safety',       // 엔딩 도달 시 완료 기록(개인정보·성찰 글 없음)
      progress: 'ethicity.safety.progress.v1',
      settings: 'ethicity.safety.settings.v1'
    },
    STAGE_W: 1280,
    STAGE_H: 720,
    SPEED: 210,          // 걷기 속도(논리 px/초)
    TALK_RANGE: 96,      // 말 걸기 거리
    SCALE: { student: 0.82, adult: 1.1, robot: 0.65 }
  };

  // 주인공 후보(공식 학생 5명) — 이 게임에서는 '청소년 시민위원'
  C.PLAYERS = ['jiho', 'haneul', 'saebom', 'onyu', 'daon'];

  // 이 게임 전용 인물(그림은 assets/art/에서, 없으면 임시 도형)
  C.NPCS = {
    director: { name: '병원 운영 책임자', short: '운영 책임자', color: '#72b7c4' },
    doctor: { name: '의료진 대표', short: '의료진 대표', color: '#5a8c65' },
    patientrep: { name: '환자 대표', short: '환자 대표', color: '#bf7865' },
    'extra-1': { name: '대기 중인 환자', color: '#a8bb8c', extra: true },
    'extra-2': { name: '대기 중인 환자', color: '#f3cf72', extra: true },
    'extra-3': { name: '대기 중인 환자', color: '#9fae87', extra: true }
  };

  // 장소. bg: 공통 배경 ID 또는 이 게임 그림 키(art:), place: HUD 장소 이름
  //   walk [x,y,w,h] 발이 설 수 있는 사각형들, block 그 안에서 막힌 곳
  //   exits: rect에 발이 닿으면 to 장소의 spawn[at]으로 이동, sign은 화면에 그리는 안내판
  C.ROOMS = {
    // 로비·회의실 좌표는 assets/art/bg-lobby·bg-meeting 그림에 맞춘 값(그림을 바꾸면 다시 맞출 것)
    lobby: {
      place: '미래종합병원 1층 로비', bg: 'art:bg-lobby',
      // 가운데 바닥 · 접수대 옆 윗줄 · 정문 안쪽 · 왼쪽 위 복도(진찰실) · 오른쪽 위 복도(운영실) · 회의실 문
      walk: [[160, 212, 1020, 66], [236, 270, 840, 330], [490, 596, 300, 74], [214, 92, 116, 130], [1100, 92, 80, 186], [548, 184, 80, 32]],
      // 접수대 · 접수대 옆 장식장과 화분 · 문 옆 화분 · 왼쪽 위 장식장 · 대기 의자(좌우)
      block: [[712, 196, 326, 90], [1030, 196, 70, 44], [460, 196, 54, 20], [652, 196, 56, 20], [330, 196, 74, 22], [70, 270, 166, 296], [1076, 270, 204, 296]],
      exits: [
        { id: 'toExam', rect: [224, 92, 96, 18], to: 'exam', at: 'door', sign: { x: 272, y: 66, text: '진찰실', dir: 'up' } },
        { id: 'toOps', rect: [1104, 92, 72, 18], to: 'ops', at: 'door', sign: { x: 1140, y: 66, text: 'AI 운영실', dir: 'up' } },
        { id: 'toMeeting', rect: [548, 184, 80, 12], to: 'meeting', at: 'door', sign: { x: 588, y: 40, text: '위원회 회의실', dir: 'up' } }
      ],
      spawn: { start: [640, 640, 'up'], fromExam: [272, 140, 'down'], fromOps: [1140, 140, 'down'], fromMeeting: [588, 250, 'down'] },
      objects: { board: { name: '운영 현황판', x: 882, y: 100, at: [880, 302], hit: [782, 64, 200, 72] } }
    },
    meeting: {
      place: '위원회 회의실', bg: 'art:bg-meeting',
      // 가운데 바닥 · 왼쪽 아래 · 오른쪽 아래 · 입구
      walk: [[260, 222, 770, 378], [90, 420, 170, 180], [1030, 420, 160, 180], [526, 596, 228, 94]],
      // 회의 테이블과 의자 · 앞쪽 의자 · 뒤쪽 화분 · 왼쪽·오른쪽 아래 화분
      block: [[462, 210, 356, 276], [598, 486, 84, 46], [262, 206, 52, 20], [868, 206, 74, 20], [110, 420, 80, 44], [1100, 430, 76, 48]],
      exits: [{ id: 'toLobby', rect: [530, 680, 220, 20], to: 'lobby', at: 'fromMeeting', sign: { x: 640, y: 700, text: '로비', dir: 'down' } }],
      spawn: { door: [640, 640, 'up'] },
      objects: { screen: { name: '회의실 화면', x: 640, y: 75, at: [640, 566], hit: [526, 14, 230, 122] } }
    },
    ops: {
      place: '메디AI 운영실', bg: 'ai_lab',
      walk: [[250, 250, 810, 220], [490, 470, 500, 150], [560, 600, 160, 110]],
      block: [[575, 150, 150, 100]],
      exits: [{ id: 'toLobby', rect: [560, 690, 160, 20], to: 'lobby', at: 'fromOps', sign: { x: 640, y: 700, text: '로비', dir: 'down' } }],
      spawn: { door: [640, 640, 'up'] },
      objects: { terminal: { name: '메디AI 단말기', x: 1160, y: 300, at: [1040, 330], hit: [1080, 200, 150, 170] } }
    },
    exam: {
      place: '진찰실', bg: 'nurse',
      walk: [[200, 320, 890, 300], [520, 250, 340, 70], [530, 600, 220, 110]],
      block: [],
      exits: [{ id: 'toLobby', rect: [530, 690, 220, 20], to: 'lobby', at: 'fromExam', sign: { x: 640, y: 700, text: '로비', dir: 'down' } }],
      spawn: { door: [640, 640, 'up'] },
      objects: {}
    }
  };
  C.ROOMS.lobby.spawn.door = C.ROOMS.lobby.spawn.start;

  // 운영 기준 문구
  C.LEVEL = {
    all: { label: '의료진이 AI 결과를 모두 재검토', short: '의료진 전면 검토', how: '이 등급으로 분류된 환자를 모두 의료진이 다시 확인합니다.' },
    cond: { label: '위험 신호·불확실성이 있으면 우선 재확인', short: '조건부 재확인', how: '위험 신호가 있거나 AI 확신도가 70% 미만인 환자를 다시 확인합니다.' },
    sample: { label: 'AI 분류를 적극 활용하고 일부 결과를 선별 재확인', short: '선별 재확인', how: '10명 중 1명꼴로 골라 다시 확인하고, 나머지는 AI 분류대로 진료합니다.' }
  };
  C.EMERG = {
    alert: { label: 'AI가 위험 신호를 감지하여 즉시 알림', short: '즉시 의료진 평가 + AI 위험 알림', how: '위험 신호가 있는 환자를 접수하자마자 의료진에게 알립니다.' },
    summary: { label: 'AI가 증상과 검사 정보를 빠르게 요약', short: '즉시 의료진 평가 + AI 정보 요약', how: '응급 처치에 걸리는 시간이 줄어 다른 환자를 볼 시간이 생깁니다.' },
    monitor: { label: 'AI가 상태 변화와 이상 징후를 지속적으로 감시', short: '즉시 의료진 평가 + AI 상태 감시', how: '기다리는 동안 상태가 변한 환자를 20분 안에 알아챕니다.' }
  };
  C.SAFEGUARD = {
    analysis: { label: 'AI 오류 집중 분석', desc: '반복되는 오류 유형을 분석하고 개선', how: '같은 유형의 오류가 다시 나오면 위험 신호를 붙입니다.' },
    staff: { label: '고위험 환자 추가 검토 인력', desc: '의료진의 추가 확인 역량 강화', how: '재검토만 맡는 의료진 1명이 더해져 대기가 줄어듭니다.' },
    warning: { label: 'AI 불확실성 경고 강화', desc: 'AI가 판단하기 어려운 사례를 더 쉽게 발견', how: '확신도 85% 미만도 불확실로 표시합니다. 조건부 재확인 대상이 늘어납니다.' },
    training: { label: '의료진 AI 활용 교육', desc: 'AI 결과 해석과 오류 대응 방법 교육', how: '알아채기 어려운 사례도 재검토에서 발견하고, 재검토가 조금 빨라집니다.' }
  };

  // 선택 결과의 짧은 이름(프로토콜·선택 경로)
  C.OUTCOME = {
    ontime: '제때 진료', delayed: '오래 기다림', worsened: '기다리다 상태 악화',
    missed: '놓친 위험(끝내 알아채지 못함)', late: '놓친 위험(늦게 발견)'
  };
  C.HOW = { review: '의료진 재검토로 발견', alert: 'AI 위험 알림으로 발견', monitor: 'AI 상태 감시로 발견' };

  root.SafetyConfig = C;
})(this);
