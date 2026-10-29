/*
 * 시나리오 데이터 — 화면에 나오는 문구는 모두 여기에 둔다.
 * 원본: 「AI 윤리 딜레마 게임 시나리오 수정안」, 보완: scenario/시나리오-보완-초안.md
 *
 * 장면(scenes)은 순서대로 진행한다. type별 필드:
 *   chapter  장 표지        eyebrow, title, sub, issue
 *   talk     대화           lines[{who, expr, text}]  (who가 없으면 안내 문구)
 *   case     안건 자료 카드  label, title, body[], request, output, quotes[{who, text}], ask
 *   rules    심의 규칙 카드
 *   choice   선택           set, slot('first'|'final'|'initial'), prompt, note
 *   result   선택 결과      set
 *   info     추가 조사 결과  set
 *   link     이전 판단 연결  set
 *   verdict  최종 판단 뒤 문구 set
 *   principle / charter / review / report / reflect / complete  최종 심의·에필로그
 * 공통: id(시나리오 번호), bg(공통 배경 ID), cast[{id, x, dir}]
 */
(function (global) {
  'use strict';

  // 공통 팩 인물 ID → 이 게임에서의 이름. 그림은 공통 팩 그대로 쓴다.
  var people = {
    teacher: '위원장 선생님',
    robot: '안내 로봇',
    librarian: '사서 선생님',
    jiho: '지호',
    haneul: '하늘',
    saebom: '새봄',
    onyu: '온유',
    daon: '다온'
  };

  var places = {
    ai_lab: '위원회 회의실 · AI 실습실',
    library: '도서관',
    courtyard: '중앙마당',
    classroom: '교실'
  };

  // 선택지. short는 보고서 표·이전 심의 결과에 쓰는 짧은 이름.
  var options = {
    initial: {
      A: { text: '그렇다. 다양성을 존중하기 위해 적극적으로 조정해야 한다.', short: '적극적으로 조정' },
      B: { text: '아니다. AI가 생성한 결과를 인위적으로 바꾸지 않는 것이 좋다.', short: '조정하지 않음' },
      C: { text: '상황과 목적에 따라 조정 여부를 결정해야 한다.', short: '상황과 목적에 따라' }
    },
    news: {
      A: { text: 'AI 이미지에 다양성을 반영하도록 수정한다.', detail: '다양한 성별과 연령의 개발자가 등장하도록 이미지를 다시 생성한다.', short: '다양성 반영 수정' },
      B: { text: '원본 AI 이미지를 사용한다.', detail: 'AI 생성 이미지임을 명시하고 원래 생성된 결과를 사용한다.', short: '원본 사용(AI 표기)' },
      C: { text: '실제 현장을 촬영한 사진으로 교체한다.', detail: 'AI 이미지 대신 실제 개발자들이 일하는 모습을 촬영한 사진을 사용한다.', short: '실제 사진으로 교체' }
    },
    ad: {
      A: { text: '다양성 보정을 의무화한다.', detail: '광고에 다양한 연령과 체형의 인물을 포함하도록 요구한다.', short: '다양성 보정 의무화' },
      B: { text: '광고주의 자율적인 선택에 맡긴다.', detail: '광고의 인물 구성은 기업이 자유롭게 결정하도록 한다.', short: '광고주 자율' },
      C: { text: '광고주의 자율성을 존중하되 부당한 배제와 비하를 제한한다.', detail: '일률적인 다양성 비율을 강제하지 않지만 차별적인 표현을 점검한다.', short: '자율 + 배제·비하 점검' }
    },
    edu: {
      A: { text: '다양한 성별의 직업인이 등장하도록 이미지를 수정한다.', detail: '학생들이 성별에 관계없이 다양한 직업을 선택할 수 있다는 점을 강조한다.', short: '다양한 성별로 수정' },
      B: { text: '실제 직업별 성별 구성을 반영한다.', detail: '확인된 통계자료를 바탕으로 현실의 직업별 인구 구성을 보여준다.', short: '통계대로 반영' },
      C: { text: '실제 통계자료와 다양한 직업인 사례를 함께 제시한다.', detail: '현실의 직업 현황과 성별에 관계없는 진로 가능성을 함께 설명한다.', short: '통계와 사례 함께' }
    }
  };

  var missions = {
    news: { label: '뉴스', title: '뉴스 AI', issue: '뉴스의 사실성·신뢰성 vs 다양성 존중' },
    ad: { label: '광고', title: '광고 AI', issue: '표현의 자율성 vs 다양성과 포용성' },
    edu: { label: '교육', title: '교육 AI', issue: '현실의 정확한 반영 vs 고정관념 예방과 교육적 책임' }
  };

  // 선택 결과: good(긍정적인 결과) · problem(새롭게 제기된 문제) · rebuttal(위원회에 접수된 반론)
  // reporter는 긍정·문제를 전하는 위원, critic은 반론을 전하는 위원.
  var results = {
    news: {
      reporter: 'jiho', critic: 'onyu',
      A: {
        good: '다양한 성별과 연령의 개발자가 등장하면서 IT 개발자에 대한 고정관념을 완화할 수 있게 되었습니다.',
        problem: '그러나 일부 독자는 이 이미지가 실제 개발자들의 인구 구성을 보여주는 것인지 혼란스러워합니다.',
        rebuttal: '다양한 사람을 보여주는 것은 중요하지만, 뉴스에서는 독자가 사실과 AI가 만들어 낸 장면을 구별할 수 있어야 하지 않을까요?'
      },
      B: {
        good: 'AI 생성 이미지임을 밝혀 독자가 실제 사진과 혼동하지 않게 되었습니다. 언론사가 이미지를 임의로 바꾸지 않았다는 점도 분명해졌습니다.',
        problem: '그러나 젊은 남성 6명만 등장하는 이미지가 그대로 실리면서, 일부 독자는 \'IT 개발자는 원래 이런 모습\'이라는 인상을 받았다는 의견을 보냈습니다. AI 표기는 이미지의 출처를 알려 주지만, 이미지가 남기는 인상까지 바꾸지는 못합니다.',
        rebuttal: 'AI가 만든 결과를 그대로 쓰는 것이 정말 중립적인 선택일까요? AI의 결과에 학습 데이터의 편향이 담겨 있다면, 그대로 쓰는 것도 하나의 선택이 아닐까요?'
      },
      C: {
        good: '실제 현장을 보여 주어 뉴스의 사실성과 신뢰성을 높일 수 있게 되었습니다. 독자는 사진 속 장면이 실제로 있었던 일임을 알 수 있습니다.',
        problem: '하지만 촬영에는 시간과 비용이 들고, 사진에 나오는 사람들의 동의도 받아야 합니다. 또 한 회사에서 찍은 사진은 그 회사의 모습일 뿐, 개발자 전체를 대표하지는 않습니다.',
        rebuttal: '실제 사진도 어떤 현장을 고르고 누구를 찍느냐에 따라 보여 주는 모습이 달라집니다. 사진으로 바꾸면 다양성의 문제는 사라지는 걸까요?'
      }
    },
    ad: {
      reporter: 'daon', critic: 'haneul',
      A: {
        good: '광고에 다양한 연령과 체형의 인물이 등장하면서 더 많은 소비자가 자신도 이 제품을 사용할 수 있다고 느낄 가능성이 생겼습니다.',
        problem: '하지만 모든 광고에 동일한 다양성 기준을 적용하면서 일부 광고주는 특정 고객층을 대상으로 한 광고 전략을 충분히 표현하기 어렵다고 주장합니다.',
        rebuttal: '다양성을 존중하는 것은 중요하지만, 모든 광고에 같은 구성 비율을 요구하는 것이 반드시 공정한 방법일까요?'
      },
      B: {
        good: '기업은 제품 전략과 고객층에 맞추어 광고를 자유롭게 기획할 수 있게 되었습니다. 표현의 자율성이 보장되면서 새로운 광고 아이디어가 나올 여지도 생겼습니다.',
        problem: '하지만 비슷한 광고가 반복되면서, 나이가 많거나 체형이 다른 소비자들은 \'이 운동화는 나를 위한 제품이 아니다\'라고 느꼈다는 의견이 위원회에 접수되었습니다.',
        rebuttal: 'AI가 학습한 데이터의 편향이 광고에 그대로 나타난다면, 그것을 기업의 자유로운 선택이라고만 볼 수 있을까요?'
      },
      C: {
        good: '광고주는 광고 전략을 유지할 수 있게 되었고, 특정 집단을 비하하거나 부당하게 배제하는 표현은 점검을 거쳐 걸러지게 되었습니다.',
        problem: '그러나 어떤 표현이 \'부당한 배제\'인지 판단하는 기준이 분명하지 않아, 점검하는 사람에 따라 결론이 달라질 수 있다는 지적이 나왔습니다. 또 비하 표현이 없어도 젊고 날씬한 사람만 등장하는 광고는 계속 만들어질 수 있습니다.',
        rebuttal: '\'부당한 배제\'의 기준은 누가, 어떻게 정해야 할까요? 차별적인 표현만 막으면 포용성이 충분히 지켜지는 걸까요?'
      }
    },
    edu: {
      reporter: 'saebom', critic: 'jiho',
      A: {
        good: '다양한 성별의 직업인이 등장하면서 학생들이 직업을 성별과 관계없이 선택할 수 있다는 메시지를 전달할 수 있게 되었습니다.',
        problem: '하지만 일부 학생들은 실제 직업별 성별 구성에 차이가 있는 이유나 현재 사회의 불균형을 충분히 이해하지 못할 수 있습니다.',
        rebuttal: '다양한 가능성을 보여주는 것도 중요하지만, 현재 사회의 현실과 불균형을 이해하도록 돕는 것도 교육의 역할이 아닐까요?'
      },
      B: {
        good: '확인된 통계를 바탕으로 학생들이 현재 직업 세계의 모습을 정확하게 알 수 있게 되었습니다.',
        problem: '하지만 일부 학생들은 자료를 보고 \'과학자나 소방관은 남자가 하는 일\', \'간호사나 유치원 교사는 여자가 하는 일\'이라고 받아들였습니다. 현재의 비율이 앞으로의 가능성처럼 전달된 것입니다.',
        rebuttal: '현실을 보여 주는 것과 현실의 불균형을 당연한 것처럼 보여 주는 것은 어떻게 다를까요? 진로 탐색이라는 자료의 목적에 맞는 선택이었을까요?'
      },
      C: {
        good: '학생들은 현재 직업별 성별 구성을 이해하는 동시에, 성별과 관계없이 다양한 직업을 선택할 수 있다는 점도 알게 되었습니다.',
        problem: '그러나 자료의 분량이 늘고 설명이 복잡해져, 일부 학생들은 통계와 사례 중 무엇이 핵심인지 헷갈려했습니다. 통계가 정확하고 최신인지 계속 확인해야 하는 부담도 생겼습니다.',
        rebuttal: '두 가지를 함께 보여 주면 언제나 더 좋은 자료가 될까요? 자료를 보는 학생이 무엇을 먼저 배워야 하는지 정하는 것도 중요하지 않을까요?'
      }
    }
  };

  var resultNote = '결과는 가능한 가상 상황이며, 특정 선택이 항상 이러한 결과를 낳는다는 뜻은 아닙니다.';

  var info = {
    news: {
      who: 'librarian',
      items: [
        'AI가 생성한 인물 구성은 실제 직업별 인구 통계와 반드시 일치하지 않습니다.',
        '이번 기사는 IT 개발자의 성별이나 연령 비율을 설명하는 기사가 아니라, 일반적인 근무 환경을 소개하는 기사입니다.',
        'AI 생성 이미지를 사용할 때에는 실제 현장 사진과 혼동하지 않도록 출처와 이미지의 성격을 명확히 밝힐 수 있습니다.'
      ]
    },
    ad: {
      who: 'robot',
      items: [
        '이 운동화는 특정 연령이나 체형에만 적합한 제품이 아니라 다양한 사람들이 사용할 수 있는 제품입니다.',
        '광고는 소비자의 관심을 끌고 구매를 유도하기 위한 콘텐츠입니다. 따라서 기업은 광고 목적과 고객층을 고려할 필요가 있습니다.',
        '광고 속 인물의 표현은 소비자에게 제품에 어울리는 사람이 누구인지에 대한 인상을 줄 수 있습니다. 그러나 모든 광고에 동일한 다양성 비율을 적용하는 것만이 유일한 해결 방법은 아닙니다.'
      ]
    },
    edu: {
      who: 'teacher',
      items: [
        '이번 교육자료는 직업별 성별 통계를 학습하기 위한 자료가 아니라, 학생들이 자신의 흥미와 적성에 맞는 직업을 탐색하도록 돕기 위한 자료입니다.',
        '특정 직업에 현재 한 성별이 많이 종사한다는 사실은 그 직업이 해당 성별에 더 적합하다는 뜻이 아닙니다.',
        '직업의 실제 현황을 보여주는 통계자료와 다양한 진로 가능성을 보여주는 사례는 목적이 다릅니다. 두 자료를 구분하여 활용할 수 있습니다.'
      ]
    }
  };

  // 최종 판단 뒤 문구: keep(처음 선택 유지) · change(수정)
  var verdicts = {
    news: {
      keep: '처음 선택을 유지했습니다. 새로운 반론에도 이 판단이 타당한 이유를 생각해 보세요.',
      change: '처음 선택을 바꿨습니다. 어떤 정보나 반론이 판단을 바꾸게 했는지 생각해 보세요.',
      closing: '뉴스에서 다양성을 존중하는 것과 사실을 정확하게 전달하는 것은 모두 중요합니다. 두 가치를 어떻게 조화시킬 수 있을까요?'
    },
    ad: {
      keep: '처음 판단을 유지했습니다. 어떤 가치가 가장 중요하다고 생각하나요?',
      change: '처음 판단을 바꿨습니다. 새로운 정보 가운데 무엇이 판단에 가장 크게 영향을 주었나요?',
      closing: '광고에서는 다양성을 존중하는 것뿐 아니라 표현의 자율성과 광고의 목적도 고려해야 합니다. 어디까지 다양성을 요구하는 것이 정당할까요?'
    },
    edu: {
      keep: '처음 판단을 유지했습니다. 학생들의 학습에 어떤 도움이 된다고 생각하나요?',
      change: '처음 판단을 바꿨습니다. 바꾼 기준이 학생들의 학습에 어떤 도움이 된다고 생각하나요?',
      closing: '교육자료는 현재 사회의 모습을 이해하도록 돕는 동시에 학생들이 다양한 미래를 상상하도록 돕습니다. 두 가지 역할을 조화시키기 위해 어떤 기준이 필요할까요?'
    }
  };

  // 이전 판단 연결
  var links = {
    // 광고 미션: 뉴스 최종 선택에 따라
    ad: {
      A: '앞선 뉴스 사건에서 당신은 다양한 사람을 보여주도록 AI 이미지를 수정하는 방식을 선택했습니다. 그렇다면 광고에서도 같은 기준을 적용해야 할까요?',
      B: '앞선 뉴스 사건에서 당신은 AI 이미지임을 밝히고 원래 생성된 결과를 사용하는 방식을 선택했습니다. 그렇다면 광고에서도 AI의 결과를 그대로 존중해야 할까요?',
      C: '앞선 뉴스 사건에서 당신은 AI 이미지 대신 실제 현장 사진을 사용하는 방식을 선택했습니다. 하지만 광고는 사실을 전달하는 기사가 아닙니다. 광고에서는 어떤 기준이 필요할까요?'
    },
    // 교육 미션: 원본 문구 + 이전 심의 결과 표 + 뉴스·광고 선택 성격에 따른 한 줄
    edu: {
      lead: '당신은 지금까지 뉴스와 광고에서 AI의 다양성 보정 기준을 결정했습니다.',
      same: '두 분야에서 당신은 비슷한 방향의 기준을 선택했습니다. 교육에서도 그 방향이 맞을까요?',
      differ: '두 분야에서 당신은 서로 다른 기준을 선택했습니다. 분야마다 기준이 달라진 이유는 무엇이었나요?',
      ask: '이제 학생들이 사용하는 교육자료에 대해서도 같은 기준을 적용할 수 있을까요?'
    }
  };

  var principles = [
    { id: 'accuracy', label: '정확성', text: '사실을 왜곡하거나 오해를 유발하지 않아야 한다.' },
    { id: 'inclusion', label: '포용성', text: '특정 집단을 부당하게 배제하거나 편견을 강화하지 않아야 한다.' },
    { id: 'purpose', label: '목적 적합성', text: '콘텐츠가 사용되는 목적과 상황을 고려해야 한다.' },
    { id: 'autonomy', label: '자율성', text: '콘텐츠 제작자의 합리적인 표현과 선택을 존중해야 한다.' }
  ];

  var charter = [
    { id: 'news', article: '제1조. 뉴스 AI', ask: '뉴스의 사실성과 다양성을 어떻게 함께 고려할까요?' },
    { id: 'ad', article: '제2조. 광고 AI', ask: '광고주의 자율성과 소비자의 포용성을 어떻게 조화시킬까요?' },
    { id: 'edu', article: '제3조. 교육 AI', ask: '현실의 정확성과 편견 예방을 어떻게 함께 고려할까요?' },
    { id: 'reason', article: '공통 원칙을 선택한 이유', ask: '' }
  ];

  var reviewChecks = [
    '당신이 제정한 기준을 세 분야에 모두 적용할 수 있나요?',
    '특정 집단이 부당하게 배제되거나 잘못 표현될 가능성은 없나요?',
    '다양성을 존중하면서도 각 분야의 목적을 충분히 고려했나요?'
  ];

  var reflection = {
    prompt: '게임을 시작할 때와 비교하여 AI의 다양성 보정에 대한 생각이 어떻게 달라졌나요?',
    options: [
      { id: 'changed', text: '처음과 다른 생각을 하게 되었다.' },
      { id: 'refined', text: '기존 생각을 유지하지만 판단 기준이 더 구체화되었다.' },
      { id: 'kept', text: '처음 생각을 유지하게 되었다.' }
    ],
    reasonLabel: '그렇게 생각한 이유를 적어 보세요.',
    closing: 'AI의 다양성 존중에는 언제나 하나의 정답만 존재하는 것은 아닙니다. 중요한 것은 AI가 어떤 목적으로 사용되는지, 누구에게 영향을 미치는지, 어떤 가치를 고려해야 하는지 충분히 생각하는 것입니다. 여러분의 선택이 더 공정하고 포용적인 AI를 만드는 출발점이 될 수 있습니다.'
  };

  var complete = {
    found: [
      '뉴스에서는 사실성과 다양성이 부딪혔습니다.',
      '광고에서는 표현의 자율성과 포용성이 부딪혔습니다.',
      '교육에서는 현실 반영과 편견 예방이 부딪혔습니다.'
    ],
    remember: '중요한 것은 AI가 어떤 목적으로 사용되는지, 누구에게 영향을 미치는지, 어떤 가치를 고려해야 하는지 충분히 생각하는 것입니다.',
    next: 'AI가 다양한 사람을 보여주도록 만드는 것만으로 충분할까? 아니면 왜, 언제, 어떻게 다양성을 반영해야 하는지 판단하는 것이 더 중요할까?',
    nextHint: '모둠 친구들의 결과 보고서와 비교해 보세요.'
  };

  // 진행 단계(통합 이벤트 progress의 total). 장 표지의 part와 맞춘다.
  var parts = ['프롤로그', '뉴스 미션', '광고 미션', '교육 미션', '최종 심의', '에필로그'];

  var LAB = [{ id: 'teacher', x: 560, dir: 'down' }, { id: 'robot', x: 720, dir: 'down' }, { id: 'saebom', x: 400, dir: 'right' }, { id: 'onyu', x: 880, dir: 'left' }];
  var LIB = [{ id: 'librarian', x: 640, dir: 'down' }, { id: 'jiho', x: 470, dir: 'right' }, { id: 'onyu', x: 810, dir: 'left' }];
  var YARD = [{ id: 'robot', x: 640, dir: 'down' }, { id: 'daon', x: 470, dir: 'right' }, { id: 'haneul', x: 810, dir: 'left' }];
  var CLASS = [{ id: 'teacher', x: 640, dir: 'down' }, { id: 'saebom', x: 470, dir: 'right' }, { id: 'jiho', x: 810, dir: 'left' }];
  var ALL = [{ id: 'saebom', x: 300, dir: 'right' }, { id: 'jiho', x: 410, dir: 'right' }, { id: 'onyu', x: 520, dir: 'down' }, { id: 'teacher', x: 640, dir: 'down' }, { id: 'robot', x: 760, dir: 'down' }, { id: 'daon', x: 870, dir: 'left' }, { id: 'haneul', x: 980, dir: 'left' }];

  var scenes = [
    // ── 프롤로그 ──
    { type: 'chapter', part: 0, bg: 'ai_lab', cast: LAB, eyebrow: '프롤로그 · 약 2분', title: '당신은 AI 윤리 위원입니다', sub: 'AI 윤리 위원 임명 및 최초 판단' },
    { type: 'talk', id: 'P-01', title: '위원회 소집', bg: 'ai_lab', cast: LAB, lines: [
      { who: 'robot', expr: 'explaining', text: '긴급 안건이 접수되었습니다.' },
      { who: 'teacher', expr: 'worried', text: '최근 AI가 생성한 이미지에서 특정한 모습의 사람들만 반복적으로 등장한다는 문제가 제기되고 있습니다.' },
      { who: 'teacher', expr: 'neutral', text: '일부에서는 AI가 다양한 사람들을 보여주도록 조정해야 한다고 주장합니다.' },
      { who: 'teacher', expr: 'neutral', text: '반면 다른 사람들은 AI가 현실과 다른 모습을 만들어 내면 오히려 문제가 발생할 수 있다고 우려합니다.' },
      { who: 'teacher', expr: 'explaining', text: 'AI의 다양성 보정은 어디까지 허용되어야 할까요?' }
    ] },
    { type: 'talk', id: 'P-02', title: '위원 임명 및 임무 안내', bg: 'ai_lab', cast: LAB, effect: 'unlock', sound: 'door', lines: [
      { who: 'teacher', expr: 'happy', text: '당신은 AI 윤리 기준 제정 위원으로 임명되었습니다.' },
      { who: 'teacher', expr: 'explaining', text: '위원회에는 뉴스, 광고, 교육 분야에서 발생한 세 가지 사건이 접수되었습니다.' },
      { who: 'teacher', expr: 'neutral', text: '당신은 각 사건을 검토하고 AI의 다양성 보정 기준을 결정해야 합니다.' }
    ] },
    { type: 'rules', id: 'P-02', bg: 'ai_lab', cast: LAB, title: '심의 규칙',
      rules: [
        '먼저 자신의 판단에 따라 결정을 내립니다.',
        '결정으로 발생할 수 있는 결과를 확인합니다.',
        '새로운 정보와 반론을 검토합니다.',
        '처음 결정을 유지하거나 수정합니다.'
      ],
      after: '모든 사건을 해결하면 최종 윤리 기준을 제정하게 됩니다.',
      note: '이 게임에는 정해진 하나의 정답이 없습니다. 중요한 것은 선택의 근거와 판단 과정입니다.' },
    { type: 'choice', id: 'P-03', bg: 'ai_lab', cast: LAB, set: 'initial', slot: 'initial', who: 'robot',
      title: '최초 판단',
      prompt: 'AI가 생성하는 콘텐츠에 다양한 사람들이 등장하도록 의도적으로 조정하는 것은 바람직할까요?',
      note: '지금의 생각을 기록해 두고, 마지막 성찰에서 다시 보여 드립니다.' },
    { type: 'talk', id: 'P-03', title: '의견 기록', bg: 'ai_lab', cast: LAB, lines: [
      { who: 'robot', expr: 'happy', text: '첫 번째 의견이 기록되었습니다. 이제 세 가지 사건을 심의하며 자신의 판단을 검토해 보세요.' }
    ] },

    // ── 미션 1. 뉴스 ──
    { type: 'chapter', part: 1, bg: 'library', cast: LIB, eyebrow: '미션 1 · 약 4분', title: '뉴스 AI — 다양성을 위해 사실을 바꿔도 될까?', issue: missions.news.issue },
    { type: 'case', id: 'N-01', bg: 'library', cast: LIB, label: '사건 01', title: '뉴스에 사용할 AI 이미지',
      body: ['한 언론사가 \'IT 개발자들의 근무 환경\'을 소개하는 기사를 준비하고 있습니다.'],
      request: '사무실에서 함께 일하는 IT 개발자 6명의 모습을 만들어 줘.',
      requester: '기자의 요청',
      output: '젊은 남성 6명만 등장한 이미지',
      quotes: [
        { who: '기자 A', text: '이 이미지를 그대로 사용하면 IT 개발자는 젊은 남성이라는 고정관념을 강화할 수 있어요.' },
        { who: '기자 B', text: '하지만 뉴스에서 다양성을 위해 인물 구성을 임의로 바꾸는 것이 적절할까요?' }
      ],
      ask: '당신은 이 기사에 사용할 이미지의 처리 방식을 결정해야 합니다.' },
    { type: 'choice', id: 'N-02', bg: 'library', cast: LIB, set: 'news', slot: 'first', who: 'librarian', title: '첫 번째 선택', prompt: '어떤 방식으로 기사의 이미지를 처리하겠습니까?' },
    { type: 'result', id: 'N-03', bg: 'library', cast: LIB, set: 'news' },
    { type: 'info', id: 'N-04', bg: 'library', cast: LIB, set: 'news' },
    { type: 'choice', id: 'N-05', bg: 'library', cast: LIB, set: 'news', slot: 'final', who: 'librarian', title: '최종 판단', prompt: '이제 당신은 처음보다 더 많은 정보를 알게 되었습니다. 처음의 결정을 유지하겠습니까, 아니면 수정하겠습니까?' },
    { type: 'verdict', id: 'N-05', bg: 'library', cast: LIB, set: 'news' },

    // ── 미션 2. 광고 ──
    { type: 'chapter', part: 2, bg: 'courtyard', cast: YARD, eyebrow: '미션 2 · 약 4분', title: '광고 AI — 다양성을 어디까지 요구해야 할까?', issue: missions.ad.issue },
    { type: 'link', id: 'A-01', bg: 'courtyard', cast: YARD, set: 'ad' },
    { type: 'case', id: 'A-02', bg: 'courtyard', cast: YARD, label: '사건 02', title: 'AI가 만든 운동화 광고',
      body: ['한 운동화 회사가 생성형 AI로 새로운 광고를 제작하고 있습니다.'],
      request: '운동화를 신고 활동하는 사람들의 모습을 만들어 줘.',
      requester: '회사의 요청',
      output: '젊고 날씬한 사람들만 등장한 광고',
      quotes: [
        { who: '광고 담당자', text: '우리 제품의 주요 고객층을 고려하면 자연스러운 결과예요. 광고는 기업의 전략에 따라 제작할 수 있어야 합니다.' },
        { who: '소비자 단체', text: '운동화는 다양한 연령과 체형의 사람들이 사용합니다. 광고에서 특정한 모습의 사람들만 반복적으로 등장하면 다른 소비자들이 배제될 수 있어요.' }
      ],
      ask: '당신은 AI 광고의 다양성 보정 기준을 결정해야 합니다.' },
    { type: 'choice', id: 'A-03', bg: 'courtyard', cast: YARD, set: 'ad', slot: 'first', who: 'robot', title: '첫 번째 선택', prompt: '광고의 다양성을 보장하기 위해 어떤 기준을 적용하겠습니까?' },
    { type: 'result', id: 'A-04', bg: 'courtyard', cast: YARD, set: 'ad' },
    { type: 'info', id: 'A-05', bg: 'courtyard', cast: YARD, set: 'ad' },
    { type: 'choice', id: 'A-06', bg: 'courtyard', cast: YARD, set: 'ad', slot: 'final', who: 'robot', title: '최종 판단', prompt: '새로운 정보를 검토한 뒤 광고의 다양성 보정 기준을 다시 결정하세요.' },
    { type: 'verdict', id: 'A-06', bg: 'courtyard', cast: YARD, set: 'ad' },

    // ── 미션 3. 교육 ──
    { type: 'chapter', part: 3, bg: 'classroom', cast: CLASS, eyebrow: '미션 3 · 약 4분', title: '교육 AI — 현실을 보여줄까, 가능성을 보여줄까?', issue: missions.edu.issue },
    { type: 'link', id: 'E-01', bg: 'classroom', cast: CLASS, set: 'edu' },
    { type: 'case', id: 'E-02', bg: 'classroom', cast: CLASS, label: '사건 03', title: 'AI가 만든 진로 교육자료',
      body: ['한 학교에서 생성형 AI를 활용하여 진로 교육자료를 제작하고 있습니다.'],
      request: '과학자, 간호사, 소방관, 유치원 교사가 일하는 모습을 만들어 줘.',
      requester: '교사의 요청',
      output: '과학자와 소방관은 남성으로, 간호사와 유치원 교사는 여성으로 표현된 이미지',
      quotes: [
        { who: '교사 A', text: '학생들이 이런 이미지를 반복해서 보면 특정 직업은 남성이나 여성에게 더 어울린다고 생각할 수 있어요.' },
        { who: '교사 B', text: '하지만 실제 직업별 성별 구성에 차이가 있다면, 교육자료에서도 현실을 정확하게 보여주는 것이 필요하지 않을까요?' }
      ],
      ask: '당신은 진로 교육자료에 적용할 AI 다양성 보정 기준을 결정해야 합니다.' },
    { type: 'choice', id: 'E-03', bg: 'classroom', cast: CLASS, set: 'edu', slot: 'first', who: 'teacher', title: '첫 번째 선택', prompt: '어떤 방식으로 교육자료를 제작하도록 하겠습니까?' },
    { type: 'result', id: 'E-04', bg: 'classroom', cast: CLASS, set: 'edu' },
    { type: 'info', id: 'E-05', bg: 'classroom', cast: CLASS, set: 'edu' },
    { type: 'choice', id: 'E-06', bg: 'classroom', cast: CLASS, set: 'edu', slot: 'final', who: 'teacher', title: '최종 판단', prompt: '교육자료의 목적과 새로운 정보를 고려하여 최종 기준을 결정하세요.' },
    { type: 'verdict', id: 'E-06', bg: 'classroom', cast: CLASS, set: 'edu' },

    // ── 최종 심의 ──
    { type: 'chapter', part: 4, bg: 'ai_lab', cast: ALL, eyebrow: '최종 미션 · 약 4분', title: 'AI 다양성 윤리 기준 제정', sub: '공통 윤리 원칙과 분야별 기준 제정' },
    { type: 'talk', id: 'F-01', title: '최종 심의 개시', bg: 'ai_lab', cast: ALL, lines: [
      { who: 'teacher', expr: 'happy', text: '세 가지 사건의 심의가 모두 완료되었습니다.' },
      { who: 'teacher', expr: 'explaining', text: '뉴스에서는 사실성과 다양성을, 광고에서는 표현의 자율성과 포용성을, 교육에서는 현실 반영과 편견 예방을 고려해야 했습니다.' },
      { who: 'teacher', expr: 'neutral', text: '세 분야에 동일한 기준을 적용하는 것이 적절했나요? 아니면 분야의 목적에 따라 기준이 달라져야 했나요?' },
      { who: 'teacher', expr: 'explaining', text: '이제 세 사건의 경험을 종합하여 AI가 다양성을 존중하기 위해 따라야 할 윤리 원칙을 제정하세요.' }
    ] },
    { type: 'principle', id: 'F-02', bg: 'ai_lab', cast: ALL, who: 'robot', title: '가장 중요한 공통 원칙',
      prompt: 'AI가 다양성을 존중하기 위해 가장 우선적으로 고려해야 할 원칙은 무엇이라고 생각하나요?',
      note: '하나의 원칙을 우선 선택하되, 다른 가치가 중요하지 않다는 의미는 아닙니다.' },
    { type: 'charter', id: 'F-03', bg: 'ai_lab', title: 'AI 다양성 윤리 기준 제정서',
      lead: '선택한 공통 원칙을 세 분야에 적용할 때 추가로 고려해야 할 조건을 작성하세요.' },
    { type: 'review', id: 'F-04', bg: 'ai_lab', title: '최종 점검', lead: '자신의 기준을 수정하거나 그대로 확정할 수 있습니다.' },

    // ── 에필로그 ──
    { type: 'chapter', part: 5, bg: 'ai_lab', cast: ALL, eyebrow: '에필로그 · 약 2분', title: '당신이 만든 AI 윤리 기준', sub: '결과 확인 및 판단 성찰' },
    { type: 'report', id: 'END-01', bg: 'ai_lab', title: 'AI 윤리 심의 결과 보고서', sub: '다양성 존중 윤리 기준 제정 완료' },
    { type: 'reflect', id: 'END-02', bg: 'ai_lab', cast: ALL, title: '최종 성찰' },
    { type: 'complete', bg: 'ai_lab', cast: ALL }
  ];

  global.DiversityStory = {
    gameId: 'diversity',
    title: 'AI 윤리 위원회',
    subtitle: '다양성의 기준을 정하라',
    principle: 'AI 윤리 원칙 · 다양성 존중',
    question: 'AI가 현실을 정확하게 반영하는 것과 사회의 다양성을 존중하는 것이 충돌할 때, 우리는 어떤 기준으로 판단해야 할까?',
    facts: [
      '약 18~20분 · 프롤로그 → 미션 3개 → 최종 심의 → 에필로그',
      '선택 뒤에 정답·오답을 보여 주지 않아요. 선택마다 함께 생각해 볼 결과와 반론이 이어져요.',
      '적은 글은 이 기기에만 저장되고 어디에도 전송되지 않아요.',
      '키보드: 숫자 키로 고르고 Enter로 결정, Space로 대사를 넘겨요. 터치만으로도 끝까지 할 수 있어요.'
    ],
    people: people,
    places: places,
    options: options,
    missions: missions,
    results: results,
    resultNote: resultNote,
    info: info,
    verdicts: verdicts,
    links: links,
    principles: principles,
    charter: charter,
    reviewChecks: reviewChecks,
    reflection: reflection,
    complete: complete,
    parts: parts,
    scenes: scenes
  };
})(window);
