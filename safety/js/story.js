/*
 * 대사·선택지 데이터 — 문구를 고치려면 이 파일만 바꾸면 된다(흐름은 app.js).
 *   대사 한 줄: [누가, 문장, 표정]   누가 = narr(해설) · robot · me(주인공) · director · doctor · patientrep
 *   표정 = neutral · happy · worried · explaining (생략하면 neutral)
 * 안내 로봇은 정답을 알려 주지 않는다. 질문하고, 단서를 안내하고, 선택 뒤 돌아보게 한다(탐험형 모듈 5).
 * 미션 2의 사건·사례 문장 속 {case}는 시뮬레이션에서 고른 환자 설명으로 바뀐다.
 */
(function (root) {
  'use strict';

  var S = {};

  // 단계: 장(HUD), 시각, 지금 할 일, 장소, 목표
  S.STEPS = {
    p1: { chapter: '프롤로그', time: '오전 8:50', mission: '로비에서 세 사람의 이야기를 들어 봅니다', room: 'lobby', progress: 0 },
    p3: { chapter: '프롤로그', time: '오전 9:10', mission: '위원회 회의실에서 운영 책임자를 만납니다', room: 'meeting', target: 'director', progress: 0 },
    m1: { chapter: '미션 1', time: '오전 10:00', mission: 'AI 운영실에서 메디AI 단말기를 살펴봅니다', room: 'ops', target: 'terminal', progress: 1 },
    m2a: { chapter: '미션 2', time: '오후 1:10', mission: '로비의 운영 현황판에서 결과를 확인합니다', room: 'lobby', target: 'board', progress: 2 },
    m2b: { chapter: '미션 2', time: '오후 1:20', mission: '진찰실에서 의료진 대표의 이야기를 듣습니다', room: 'exam', target: 'doctor', progress: 2 },
    m3: { chapter: '미션 3', time: '오후 2:00', mission: 'AI 운영실에서 긴급 오류 보고서를 확인합니다', room: 'ops', target: 'terminal', progress: 3 },
    m4: { chapter: '미션 4', time: '오후 3:00', mission: '위원회 회의실에서 안전 규칙을 완성합니다', room: 'meeting', target: 'director', progress: 4 },
    result: { chapter: '엔딩', time: '오후 4:00', mission: '나의 안전 운영 프로토콜을 확인합니다', progress: 5 },
    end: { chapter: '엔딩', time: '오후 4:10', mission: '돌아보고 생각을 정리합니다', progress: 5 }
  };
  S.ORDER = ['p1', 'p3', 'm1', 'm2a', 'm2b', 'm3', 'm4', 'result', 'end'];

  // 단계마다 인물이 서 있는 곳 [장소, x, y, 방향]
  S.CAST = {
    p1: { director: ['lobby', 420, 360, 'down'], doctor: ['lobby', 860, 360, 'down'], patientrep: ['lobby', 300, 480, 'right'] },
    p3: { director: ['meeting', 330, 420, 'right'], patientrep: ['lobby', 300, 480, 'right'], doctor: ['exam', 600, 380, 'down'] },
    m1: { director: ['meeting', 330, 420, 'right'], patientrep: ['lobby', 300, 480, 'right'], doctor: ['exam', 600, 380, 'down'] },
    m2a: { director: ['meeting', 330, 420, 'right'], patientrep: ['lobby', 300, 480, 'right'], doctor: ['exam', 600, 380, 'down'] },
    m2b: { director: ['meeting', 330, 420, 'right'], patientrep: ['lobby', 300, 480, 'right'], doctor: ['exam', 600, 380, 'down'] },
    m3: { director: ['meeting', 330, 420, 'right'], patientrep: ['lobby', 300, 480, 'right'], doctor: ['ops', 860, 330, 'left'] },
    m4: { director: ['meeting', 330, 420, 'right'], doctor: ['meeting', 950, 420, 'left'], patientrep: ['meeting', 860, 540, 'up'] }
  };
  // 대기실의 다른 환자(그림이 있으면 그리고, 말을 걸 수 있다)
  S.EXTRAS = [['extra-1', 'lobby', 270, 330, 'right'], ['extra-2', 'lobby', 1040, 340, 'left'], ['extra-3', 'lobby', 1040, 520, 'left']];

  S.INTRO = [
    ['narr', '미래종합병원에는 매일 많은 환자가 방문합니다.'],
    ['narr', '최근 환자가 늘어나면서 진료 대기시간이 길어졌습니다. 의료진은 환자를 빠르게 확인하기 위해 노력하지만, 업무가 계속 쌓이고 있습니다.'],
    ['narr', '병원은 이 문제를 해결하기 위해 AI 진료 보조 시스템 ‘메디AI’를 도입하려고 합니다.'],
    ['narr', '하지만 한 가지 걱정이 있습니다. AI도 실수할 수 있다는 것입니다.'],
    ['robot', '안녕하세요, 위원님! 저는 위원회 안내 로봇이에요. 오늘 위원님 곁에서 함께 다닐게요.', 'happy'],
    ['robot', '저는 정답을 알려 드리지 않아요. 대신 함께 생각해 볼 질문을 드릴게요. 막히면 위쪽의 ‘로봇에게 묻기’를 눌러 주세요.', 'explaining'],
    ['robot', '먼저 로비에 있는 세 분의 이야기를 들어 봐요. 머리 위에 느낌표가 떠 있는 분이에요.', 'explaining']
  ];

  // P-2 서로 다른 입장
  S.MEET = {
    director: [
      ['director', 'AI가 환자의 정보를 빠르게 분석해 주면 의료진이 더 많은 환자를 돌볼 수 있습니다.', 'explaining'],
      ['director', '진료가 늦어지는 것도 위험합니다. 지금도 대기실에서 두 시간 넘게 기다리는 분이 계세요.', 'worried']
    ],
    doctor: [
      ['doctor', 'AI가 환자의 위험을 잘못 판단할 수도 있습니다.', 'worried'],
      ['doctor', 'AI가 안전하다고 했다는 이유로 중요한 확인을 생략해서는 안 됩니다.', 'explaining']
    ],
    patientrep: [
      ['patientrep', '빨리 진료받는 것도 중요하지요.', 'neutral'],
      ['patientrep', '하지만 AI의 실수 때문에 치료 시기를 놓칠까 봐 걱정됩니다.', 'worried']
    ]
  };
  S.MET_ALL = [
    ['robot', '세 분 모두 환자를 위한 이야기를 했는데, 서로 걱정하는 위험이 달랐어요.', 'explaining'],
    ['robot', '이제 위원회 회의실로 가 봐요. 로비 위쪽 문이에요.', 'happy']
  ];

  // P-3 임명
  S.APPOINT = [
    ['director', '와 주셨군요. 오늘부터 당신은 의료 AI 안전기준 제정위원입니다.', 'happy'],
    ['director', '병원은 시민의 목소리를 듣기 위해 청소년 시민위원도 위원회에 모셨습니다.', 'explaining'],
    ['director', 'AI를 활용해 진료를 빠르게 하면서도 환자의 안전을 지켜야 합니다.', 'neutral'],
    ['director', 'AI를 어디까지 활용할지, 언제 의사가 다시 확인해야 할지 결정해 주세요.', 'explaining']
  ];
  S.PRIORITY = {
    question: '당신은 어떤 방향으로 AI 활용 기준을 만들겠습니까?',
    options: [
      { id: 'speed', text: 'AI를 적극 활용해 진료 지연을 최대한 줄인다.' },
      { id: 'safety', text: '의사의 재확인을 강화해 AI 오류를 최대한 줄인다.' },
      { id: 'balance', text: '환자의 위험도에 따라 AI 활용 범위를 다르게 정한다.' }
    ]
  };
  S.AFTER_PRIORITY = [
    ['robot', '첫 생각을 기록해 두었어요. 맞고 틀리고는 없어요. 마지막에 이 생각과 다시 비교해 봐요.', 'happy'],
    ['director', '그럼 메디AI가 실제로 어떻게 판단하는지부터 보시죠. AI 운영실은 로비 오른쪽 안쪽 복도로 가면 됩니다.', 'explaining']
  ];

  // 미션 1
  S.M1_CARD = { eyebrow: '미션 1', title: 'AI를 어디까지 믿을 것인가?', text: '환자의 위험도와 오류가 생겼을 때의 피해를 생각하며 AI 활용 기준을 정합니다.' };
  S.M1_EXPLAIN = [
    ['robot', '이게 메디AI 단말기예요. 환자의 증상과 검사 정보를 분석해서 위험도를 보여 줘요.', 'explaining'],
    ['robot', '하지만 AI의 판단이 항상 정확한 것은 아니에요. 위험도가 낮다고 판단한 환자에게 실제로 심각한 질환이 있을 수도 있어요.', 'worried'],
    ['robot', '반대로, 괜찮은 환자를 위험하다고 분류해서 의료진의 일을 늘릴 때도 있어요.', 'explaining'],
    ['robot', '환자의 위험도와 오류가 생겼을 때의 피해를 생각하며 기준을 정해 주세요.', 'explaining']
  ];
  S.REASONS = {
    question: '왜 이러한 기준을 선택했나요? (1~2개)',
    options: [
      { id: 'harm', text: 'AI의 실수로 발생할 수 있는 피해를 줄이기 위해' },
      { id: 'delay', text: '진료 지연으로 인한 위험을 줄이기 위해' },
      { id: 'risk', text: '위험도가 높은 환자에게 의료진의 확인이 더 중요하다고 생각해서' },
      { id: 'both', text: '의료진의 업무 부담과 환자 안전을 함께 고려해서' }
    ]
  };
  S.AFTER_POLICY = [
    ['robot', '기준이 정해졌어요. 이 기준으로 오늘 오전 환자 100명을 진료해 볼게요.', 'happy'],
    ['robot', '어떤 환자가 가장 먼저 다시 확인될지 상상해 보세요. 결과는 점심 뒤 로비 운영 현황판에 올라와요.', 'explaining']
  ];

  // 미션 2
  S.M2_CARD = { eyebrow: '미션 2', title: '환자 100명을 진료한 결과는?', text: '같은 환자 100명에게 당신의 기준을 적용한 결과를 확인합니다.' };
  S.M2_INTRO = [
    ['narr', '당신이 설정한 기준에 따라 미래종합병원이 가상의 환자 100명을 진료하는 시뮬레이션을 실시했습니다.'],
    ['robot', '같은 환자 100명에게 기준만 바꾸면 결과가 달라져요. 오전 9시부터 오후 1시까지를 빠르게 돌려 볼게요.', 'explaining']
  ];
  S.M2_AFTER = [
    ['robot', '숫자 뒤에는 한 사람 한 사람이 있어요. 진찰실에서 의료진 대표가 기다리고 있어요. 로비 왼쪽 안쪽 복도예요.', 'explaining']
  ];
  S.EVENTS = {
    A: {
      title: '사건 A. AI를 적극 활용한 경우',
      lines: [
        ['doctor', '메디AI는 한 환자를 경증으로 분류했습니다. {case}였어요.', 'worried'],
        ['doctor', '하지만 그 환자는 실제로 빠른 치료가 필요한 중증환자였습니다. {detail}', 'worried'],
        ['doctor', '추가 확인이 늦어지면서 치료도 지연되었습니다.', 'worried'],
        ['narr', 'AI를 활용하여 전체 진료 속도는 빨라졌지만, 일부 환자의 위험을 놓치는 문제가 나타났습니다.']
      ]
    },
    B: {
      title: '사건 B. 모든 결과를 재확인한 경우',
      lines: [
        ['doctor', '저희는 메디AI의 판단을 모두 처음부터 재확인했습니다. 덕분에 일부 오류를 발견했지요.', 'explaining'],
        ['doctor', '하지만 검토해야 할 환자가 많아지면서 진료 대기시간도 길어졌습니다.', 'worried'],
        ['doctor', '{case}는 진료를 기다리는 동안 상태가 나빠졌어요. {detail}', 'worried'],
        ['narr', '오류를 줄이려는 재확인이, 기다리는 다른 환자에게는 새로운 위험이 되었습니다.']
      ]
    },
    C: {
      title: '사건 C. 조건부 재확인을 적용한 경우',
      lines: [
        ['doctor', '저희는 AI가 위험 신호를 표시한 환자를 우선적으로 검토했습니다. 덕분에 일부 위험 환자를 빠르게 확인할 수 있었어요.', 'explaining'],
        ['doctor', '그런데 {case}는 위험 신호가 표시되지 않았습니다. {detail}', 'worried'],
        ['doctor', 'AI가 위험 신호를 제대로 감지하지 못한 환자는 재확인 대상에서 빠질 수 있었던 거예요.', 'worried'],
        ['narr', '조건부 재확인에도 한계가 있다는 사실이 드러났습니다.']
      ]
    }
  };
  S.EVENT_SAFE = ['doctor', '이번에는 그 환자를 다행히 제때 찾아냈습니다. 하지만 다음에도 그럴 거라고 장담할 수는 없어요.', 'explaining'];
  S.MID = {
    question: '당신의 기준이 만든 결과 가운데 가장 중요하다고 생각하는 문제는 무엇인가요?',
    lead: '당신의 기준은 어떤 문제를 해결했나요? 반대로 어떤 새로운 위험을 만들었나요?',
    options: [
      { id: 'delay', text: '오래 기다린 환자가 생겼다' },
      { id: 'missed', text: '제때 발견하지 못한 위험 환자가 있었다' },
      { id: 'workload', text: '의료진의 검토 업무가 크게 늘었다' }
    ]
  };
  S.AFTER_MID = [
    ['robot', '한 문제를 줄이면 다른 문제가 커질 때가 많아요. 그 사이에서 무엇을 지킬지 정하는 게 위원회의 일이에요.', 'explaining'],
    ['robot', '어, 운영실에서 긴급 알림이 왔어요! 메디AI 단말기로 가 봐요.', 'worried']
  ];

  // 미션 3
  S.M3_CARD = { eyebrow: '미션 3', title: 'AI가 자신 있게 틀릴 수도 있다!', text: '새로운 오류 보고서를 읽고, 처음 정한 기준을 다시 검토합니다.' };
  S.M3_INTRO = [
    ['doctor', '시뮬레이션 결과를 분석하던 중, 메디AI에서 새로운 문제가 발견되었습니다.', 'worried'],
    ['doctor', 'AI가 매우 높은 확신도를 표시했는데도 실제 판단이 틀린 사례가 있었어요.', 'explaining']
  ];
  S.CONFIDENCE = {
    question: 'AI가 높은 확신도를 표시하면 의사는 그 결과를 그대로 믿어도 될까요?',
    options: [
      { id: 'trust', text: '확신도가 높다면 대부분 그대로 활용할 수 있다.' },
      { id: 'check', text: '확신도가 높더라도 환자의 상태와 위험 신호를 함께 확인해야 한다.' },
      { id: 'always', text: '높은 확신도도 오류가 있을 수 있으므로 AI 결과는 항상 처음부터 다시 검토해야 한다.' }
    ]
  };
  S.CONFIDENCE_FEEDBACK = [
    ['robot', 'AI의 확신도가 높다는 것은 AI가 자신의 판단에 높은 점수를 주었다는 뜻이에요. 그 판단이 반드시 정확하다는 뜻은 아니에요.', 'explaining'],
    ['robot', '그래서 AI의 성능, 환자의 위험도, 오류가 생겼을 때의 피해를 함께 생각해야 해요.', 'explaining'],
    ['robot', '새로운 정보를 확인했어요. 처음 정한 기준을 유지할지, 수정할지 정해 주세요. 어느 쪽이든 이유가 있다면 의미 있는 결정이에요.', 'happy']
  ];
  S.REVISION = {
    question: '기존 기준을 유지하거나 수정한 가장 중요한 이유는 무엇인가요?',
    options: [
      { id: 'confidence', text: 'AI의 높은 확신도도 틀릴 수 있다는 점을 고려했다.' },
      { id: 'delay', text: '진료 지연 위험도 여전히 중요하다고 판단했다.' },
      { id: 'tiered', text: '위험도에 따라 재확인 기준을 달리해야 한다고 생각했다.' },
      { id: 'keep', text: '기존 기준이 여전히 합리적이라고 판단했다.' }
    ]
  };
  S.AFTER_REVISION = [
    ['doctor', '기준을 정리해 주셔서 고맙습니다. 저도 회의실로 갈게요. 마지막 결정이 남았거든요.', 'happy'],
    ['robot', '위원회 회의실로 가 봐요. 로비 위쪽 문이에요.', 'explaining']
  ];

  // 미션 4
  S.M4_CARD = { eyebrow: '미션 4', title: '안전 규칙을 완성하라!', text: '한정된 예산으로 안전장치를 고르고, 오류 대응과 책임 체계를 정합니다.' };
  S.M4_INTRO = [
    ['director', '병원은 AI의 안전성을 높이기 위해 추가 예산을 마련했습니다. 하지만 예산은 한정되어 있습니다.', 'explaining'],
    ['director', '기본적인 환자 보호 의무는 모두 지켜야 합니다. 이제 추가로 강화할 안전장치를 골라 주세요.', 'neutral']
  ];
  S.ERROR_RESPONSE = {
    lead: '의료 AI의 오류가 발견되었습니다. 환자를 보호하고 같은 문제가 반복되지 않도록 어떤 조치를 우선 강화해야 할까요?',
    question: '오류가 발견되면 무엇을 먼저 강화할까요?',
    note: '환자에 대한 즉각적인 보호와 필요한 의료 조치는 모든 선택에 공통으로 적용됩니다.',
    options: [
      { id: 'report', text: '오류를 기록·보고하고 원인을 분석한다.', short: '오류를 기록·보고하고 원인을 분석합니다' },
      { id: 'suspend', text: '문제가 있는 AI 기능을 일시 중단하고 검증한다.', short: '문제가 있는 AI 기능을 일시 중단하고 검증합니다' },
      { id: 'monitor', text: '의료진의 추가 검토와 오류 감시를 강화한다.', short: '의료진의 추가 검토와 오류 감시를 강화합니다' }
    ]
  };
  S.RESPONSIBILITY = {
    lead: 'AI가 위험 환자를 잘못 분류하고, 의료진도 이를 발견하지 못했습니다. 비슷한 문제가 반복되지 않도록 누구에게 어떤 책임이 필요할까요?',
    question: '어떤 책임 체계를 강화할까요?',
    options: [
      { id: 'clinician', text: '의료진의 검토와 판단 책임을 중심으로 강화한다.', short: '의료진의 검토와 판단 책임을 중심으로 강화합니다' },
      { id: 'developer', text: 'AI 개발사의 성능 검증과 오류 개선 책임을 중심으로 강화한다.', short: 'AI 개발사의 성능 검증과 오류 개선 책임을 중심으로 강화합니다' },
      { id: 'shared', text: '의료진·병원·개발사의 역할별 책임과 공동 대응 체계를 강화한다.', short: '의료진·병원·개발사가 역할별 책임을 나누고 함께 대응합니다' }
    ]
  };
  S.M4_FINAL = [
    ['director', '모든 결정이 완료되었습니다. 이 기준과 안전장치로 같은 환자 100명을 다시 진료해 보겠습니다.', 'explaining']
  ];
  S.M4_DONE = [
    ['robot', '이제 위원님이 만든 의료 AI 안전 운영 프로토콜을 확인해 봐요.', 'happy']
  ];

  // 필수 안전 원칙(바꿀 수 없음)
  S.PRINCIPLES = [
    'AI는 의료진의 진단과 판단을 지원하는 도구입니다.',
    '응급환자는 AI 결과와 관계없이 의료진의 즉각적인 평가와 처치를 받습니다.',
    '환자의 상태가 악화되거나 위험 신호가 발견되면 의료진에게 즉시 연결합니다.',
    'AI 오류가 의심되면 환자 보호, 오류 보고, 원인 분석 절차를 시행합니다.',
    '의료진·병원·개발사는 각자의 역할에 따른 안전관리 책임을 가집니다.'
  ];

  // 엔딩 경향(정답이 아니다)
  S.TENDENCY = {
    speed: { title: '신속한 진료 중심', trait: 'AI 활용을 확대하고 진료 효율을 중시했습니다.', question: 'AI의 판단을 놓치지 않고 검증할 방법이 충분한가?' },
    thorough: { title: '철저한 검토 중심', trait: '의료진의 재확인과 오류 예방을 중시했습니다.', question: '검토 업무 증가가 다른 환자의 안전에 영향을 주지 않는가?' },
    balance: { title: '위험도별 균형 중심', trait: '위험도와 상황에 따라 AI 활용 범위를 조정했습니다.', question: '위험도 분류 자체가 틀렸을 때 어떻게 대응할 것인가?' }
  };
  S.REFLECT = [
    { id: 'q1', text: '처음에 정한 AI 활용 기준과 최종 기준은 어떻게 달라졌나요?' },
    { id: 'q2', text: 'AI 오류와 진료 지연 사이에서 어떤 위험을 더 중요하게 고려했나요? 그 이유는 무엇인가요?' },
    { id: 'q3', text: '의료 AI를 안전하게 사용하기 위해 가장 중요한 규칙은 무엇이라고 생각하나요?' }
  ];
  S.FINAL_MESSAGE = [
    'AI는 편리하지만 언제나 정확하지는 않습니다.',
    '중요한 것은 AI를 무조건 믿거나 사용하지 않는 것이 아니라, 언제 AI를 활용하고, 언제 사람이 확인하며, 실수가 발생하면 어떻게 대응할지 미리 정하는 것입니다.',
    '안전한 AI 활용은 기술을 믿는 것에서 끝나지 않고, 위험을 예측하고 책임 있게 관리하는 것에서 시작됩니다.'
  ];
  S.REMEMBER = 'AI의 확신도는 정답 확률이 아닙니다. 사람이 언제 확인할지 미리 정해 두어야 합니다.';
  S.NEXT = '수업에서 다른 친구들의 프로토콜과 비교해 보세요. 같은 환자 100명인데 무엇을 다르게 지키려 했나요?';
  S.LAST_QUESTION = 'AI가 실수할 수 있다는 사실을 알고 있다면, 우리는 어떤 규칙을 만들어야 AI의 도움을 받으면서도 사람을 안전하게 지킬 수 있을까?';

  // 로봇에게 묻기 — 단계별 질문과 단서(정답은 말하지 않는다)
  S.HINTS = {
    p1: ['세 분은 모두 환자를 걱정하고 있어요. 각자 가장 걱정하는 위험은 무엇일까요?', '느낌표가 떠 있는 분에게 다가가 Space를 누르거나, 그분을 눌러 보세요.'],
    p3: ['로비 위쪽 문으로 가면 위원회 회의실이에요. 길을 모르겠다면 ‘길 안내’를 눌러 보세요.'],
    m1: ['AI가 틀렸을 때 피해가 가장 큰 환자는 누구일까요?', '모든 환자를 다시 확인하면 그동안 다른 환자는 어떻게 될까요?'],
    m2a: ['운영 현황판은 로비 접수대 뒤쪽 벽에 있어요.'],
    m2b: ['진찰실은 로비 왼쪽 안쪽 복도에 있어요. 숫자 하나가 어떤 사람의 이야기인지 들어 봐요.'],
    m3: ['확신도 96%는 “96% 확률로 맞다”는 뜻일까요, 아니면 “AI가 스스로 96점을 줬다”는 뜻일까요?'],
    m4: ['예산이 5포인트뿐이에요. 지금 기준에서 가장 약한 곳은 어디였나요?', '안전장치마다 도움이 되는 환자가 달라요. 설명을 잘 읽어 보세요.']
  };

  // 다른 사람에게 말을 걸었을 때(목표가 아닐 때) 짧은 반응
  S.CHATTER = {
    director: ['director', '결정은 위원님께 맡기겠습니다. 병원은 그 기준대로 운영할 거예요.', 'neutral'],
    doctor: ['doctor', '어떤 기준이든 응급환자는 저희가 바로 봅니다. 그건 변하지 않아요.', 'explaining'],
    patientrep: ['patientrep', '환자들은 오늘 정해질 기준을 궁금해하고 있어요.', 'neutral'],
    'extra-1': ['narr', '대기 중인 환자가 번호표를 들고 전광판을 바라보고 있습니다.'],
    'extra-2': ['narr', '대기 중인 환자가 시계를 자꾸 확인합니다.'],
    'extra-3': ['narr', '대기 중인 환자가 조용히 순서를 기다리고 있습니다.'],
    screen: ['narr', '화면에 “의료 AI 안전기준 위원회”라고 적혀 있습니다.'],
    board: ['narr', '운영 현황판에 오늘의 대기 환자 수가 표시되어 있습니다.'],
    terminal: ['narr', '메디AI 단말기가 환자 위험도 분석 화면을 보여 주고 있습니다.']
  };

  root.SafetyStory = S;
})(this);
