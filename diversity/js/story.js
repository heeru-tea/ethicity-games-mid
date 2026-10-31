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

  // 플레이어로 고를 수 있는 학생(공통 팩 학생 5명). 고른 학생이 맡던 위원 역할은 standIn이 대신 맡는다
  // (그 장면에 함께 나오지 않는 학생으로 정했다).
  var students = ['jiho', 'haneul', 'saebom', 'onyu', 'daon'];
  var standIn = { jiho: 'haneul', haneul: 'jiho', saebom: 'daon', onyu: 'daon', daon: 'onyu' };

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
      who: 'teacher',
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

  // ── 탐험 ──
  // 플레이어(고른 학생)가 걸어 다니며 장소·인물에 다가가 살펴본다. 좌표는 1280×720 논리 화면, 인물은 발 기준점.
  // walks: 배경마다 발이 설 수 있는 영역(area)과 가구 충돌(block) — 공통 팩 walkAreas(예제용) 대신 장면에 맞춰 정했다.
  // spot: rect[x, y, w, h](누르는 영역), at[x, y, 바라볼 방향](다가가 설 자리), locked(아직 열리지 않았을 때 로봇의 한마디),
  //       who/role(인물이면 공통 ID 또는 결과를 전하는 역할 — 발 좌표 x, y에 세운다), idle(지금 할 일이 없을 때 한마디)
  var walks = {
    courtyard: {
      // 길 + 아래쪽 잔디(벤치까지 걸어갈 수 있게)
      area: [[30, 335, 1200, 120], [575, 60, 130, 655], [225, 235, 355, 100], [700, 255, 420, 80], [990, 225, 120, 35], [230, 215, 145, 25], [100, 455, 450, 127], [735, 455, 460, 127]],
      block: [[130, 565, 135, 50], [1015, 565, 135, 50]]
    },
    library: {
      area: [[140, 240, 1010, 390], [455, 630, 370, 75]],
      block: [[100, 150, 305, 165], [520, 130, 230, 95], [1025, 190, 140, 95], [92, 470, 248, 145], [955, 470, 240, 145]],
      enter: { x: 640, y: 690, dir: 'up' }
    },
    classroom: {
      area: [[120, 285, 1100, 420]],
      block: [[90, 180, 280, 140], [0, 300, 130, 90], [575, 165, 130, 110], [880, 140, 300, 145], [10, 380, 270, 260], [1005, 380, 260, 260]],
      enter: { x: 640, y: 690, dir: 'up' }
    },
    ai_lab: {
      area: [[120, 215, 1080, 410], [560, 620, 200, 95]],
      block: [[575, 150, 145, 100], [0, 180, 240, 320], [0, 420, 125, 210], [150, 465, 285, 160], [1070, 215, 210, 250], [990, 520, 290, 115]],
      enter: { x: 655, y: 690, dir: 'up' }
    }
  };
  // 로봇 동료: 정답을 알려 주지 않고 질문하기(ask)·다음 행동 안내(hint)·선택 뒤 돌아보기를 맡는다.
  var maps = {
    'MAP-1': {
      robot: '여기는 중앙마당이에요. 첫 번째 안건은 도서관에 접수되었대요. 책 간판이 달린 오른쪽 건물로 가 봐요.',
      hint: '오른쪽, 책 간판이 달린 건물이 도서관이에요.',
      ask: '뉴스 사진 속 사람들은 실제로 있었던 사람들이라고 생각하나요?',
      open: 'library', done: [], task: '도서관으로 가기',
      enter: { x: 300, y: 270, dir: 'down' } // 회의실(본관)에서 나온 자리
    },
    'MAP-2': {
      robot: '뉴스 심의를 마쳤어요. 다음 안건은 마당 게시판에 붙은 운동화 광고예요.',
      hint: '가운데 길 위쪽, 지붕이 있는 게시판이에요.',
      ask: '뉴스에서 정한 기준을 광고에도 그대로 쓸 수 있을까요?',
      open: 'board', done: ['library'], task: '게시판의 광고 살펴보기',
      enter: { x: 1050, y: 285, dir: 'down' } // 도서관에서 나온 자리
    },
    'MAP-3': {
      robot: '광고 심의도 마쳤어요. 교육 안건은 본관 교실에 접수되었대요. 시계가 달린 왼쪽 건물로 가 봐요.',
      hint: '왼쪽, 시계가 달린 건물이 본관이에요.',
      ask: '뉴스와 광고에서 고른 기준은 서로 같은 방향이었나요?',
      open: 'main', done: ['library', 'board'], task: '본관 교실로 가기',
      enter: { x: 690, y: 210, dir: 'down' } // 게시판 앞
    }
  };
  var mapSpots = [
    { id: 'library', label: '도서관', rect: [990, 110, 140, 135], at: [1050, 245, 'up'] },
    { id: 'board', label: '게시판', rect: [735, 80, 105, 100], at: [690, 175, 'right'], locked: '그 안건은 뉴스 심의를 마친 뒤에 열려요.' },
    { id: 'main', label: '본관 (교실·AI 실습실)', rect: [230, 95, 145, 120], at: [302, 232, 'up'], locked: '교육 안건과 최종 심의는 광고 심의를 마친 뒤에 열려요.' }
  ];
  // 지도에서 이미 다녀온 곳을 눌렀을 때
  var mapDone = { library: '뉴스 심의는 이미 마친 곳이에요.', board: '광고 심의는 이미 마친 곳이에요.' };

  var explore = {
    news: {
      place: 'library', title: '도서관 · 뉴스 사건 조사', tag: '미션 1 탐험', exit: '도서관 나가기 ▶',
      ids: { case: 'N-01', result: 'N-03', info: 'N-04' },
      spots: [
        { id: 'shelf', label: '통계 자료 서가', rect: [40, 340, 95, 130], at: [160, 400, 'left'], idle: '직업 통계 자료가 꽂힌 서가예요. 아직은 찾아볼 때가 아니에요.' },
        { id: 'display', label: '신간 전시대', rect: [525, 110, 220, 105], at: [635, 245, 'up'], idle: '신간 전시대예요. 지금은 더 볼 것이 없어요.' },
        { id: 'pc', label: '검색 PC', rect: [1030, 140, 140, 135], at: [1095, 300, 'up'], idle: '검색 PC예요. 지금은 더 볼 것이 없어요.' },
        { id: 'memo', label: '열람 테이블', rect: [110, 470, 200, 135], at: [375, 540, 'left'], idle: '열람 테이블이에요. 기자들의 의견 메모가 놓여 있어요.' },
        { id: 'librarian', label: '사서 선생님', who: 'librarian', x: 250, y: 335, dir: 'down', at: [250, 390, 'up'], idle: '자료를 충분히 살펴본 뒤에 판단을 들려주세요. 서두르지 않아도 괜찮아요.' },
        // 결과를 전하는 두 위원(results.news의 reporter·critic). 플레이어가 그 학생을 고르면 standIn이 선다.
        { id: 'reporter', role: 'reporter', x: 530, y: 480, dir: 'right', at: [530, 535, 'up'], idle: '기사에 쓸 이미지 이야기로 도서관이 시끌시끌해.' },
        { id: 'critic', role: 'critic', x: 770, y: 480, dir: 'left', at: [770, 535, 'up'], idle: '네가 어떤 결정을 내릴지 궁금해.' }
      ],
      // 단계마다 할 일. key는 저장(found)에 남는 상호작용 ID.
      steps: [
        { id: 'case', task: '사건 단서 살펴보기', items: [{ spot: 'display', key: 'plan' }, { spot: 'pc', key: 'output' }, { spot: 'memo', key: 'quotes' }],
          hint: '전시대, 검색 PC, 열람 테이블에 단서가 있어요.',
          ask: '이 이미지를 본 독자는 IT 개발자를 어떤 사람들이라고 생각하게 될까요?',
          done: '단서를 모두 모았어요. 사서 선생님께 첫 판단을 알려 주세요.' },
        { id: 'first', task: '사서 선생님께 첫 판단 알리기', items: [{ spot: 'librarian', key: 'first' }],
          hint: '왼쪽 대출 데스크 앞의 사서 선생님께 가요.',
          ask: '뉴스에서 가장 먼저 지켜야 할 것은 무엇일까요? 그것과 다양성은 함께 지킬 수 있을까요?',
          done: '첫 판단을 기록했어요. 그 결정으로 무슨 일이 생겼는지 {reporter}·{critic} 위원이 이야기해 줄 거예요.' },
        { id: 'result', task: '{reporter}·{critic}에게 결과 듣기', items: [{ spot: 'reporter', key: 'good' }, { spot: 'critic', key: 'rebuttal' }],
          hint: '가운데에 있는 두 위원, {reporter}·{critic}에게 다가가 말을 걸어 봐요.',
          ask: '내 선택으로 좋아진 점과 새로 생긴 문제를 나란히 놓고 보면 어때요?',
          done: '반론까지 들었어요. 판단에 도움이 될 정보를 더 찾아봐요. 새로 표시된 곳이 생겼어요.' },
        { id: 'info', task: '추가 정보 찾기', items: [{ spot: 'shelf', key: 'info1' }, { spot: 'display', key: 'info2' }, { spot: 'pc', key: 'info3' }],
          hint: '통계 자료 서가, 신간 전시대, 검색 PC를 다시 살펴봐요.',
          ask: '이 기사는 무엇을 알리려는 기사일까요? 기사의 목적이 판단을 바꿀 수 있을까요?',
          done: '새로운 정보를 모두 찾았어요. 사서 선생님께 최종 판단을 알려 주세요.' },
        { id: 'final', task: '사서 선생님께 최종 판단 알리기', items: [{ spot: 'librarian', key: 'final' }],
          hint: '사서 선생님께 가서 최종 판단을 알려 주세요.',
          ask: '처음 선택을 지켜도, 바꿔도 괜찮아요. 어떤 정보나 반론이 가장 마음에 걸렸나요?',
          done: '' }
      ],
      arrive: '도서관에 도착했어요. 기사에 쓸 이미지 문제로 자료가 여기저기 흩어져 있대요. 표시된 곳에 다가가 살펴봐요.',
      // 단서 카드 제목
      titles: { plan: '기사 기획 메모', output: 'AI 생성 결과', quotes: '기자들의 의견 메모', good: '결과 보고 · {reporter}', rebuttal: '위원회에 접수된 반론', info1: '직업 통계 자료', info2: '기사 기획안', info3: 'AI 이미지 표기 안내' },
      // 사건 자료(원본 N-01)
      case: {
        label: '사건 01', title: '뉴스에 사용할 AI 이미지',
        body: ['한 언론사가 \'IT 개발자들의 근무 환경\'을 소개하는 기사를 준비하고 있습니다.'],
        request: '사무실에서 함께 일하는 IT 개발자 6명의 모습을 만들어 줘.',
        requester: '기자의 요청',
        output: '젊은 남성 6명만 등장한 이미지',
        quotes: [
          { who: '기자 A', text: '이 이미지를 그대로 사용하면 IT 개발자는 젊은 남성이라는 고정관념을 강화할 수 있어요.' },
          { who: '기자 B', text: '하지만 뉴스에서 다양성을 위해 인물 구성을 임의로 바꾸는 것이 적절할까요?' }
        ],
        ask: '당신은 이 기사에 사용할 이미지의 처리 방식을 결정해야 합니다.'
      },
      first: { id: 'N-02', set: 'news', slot: 'first', who: 'librarian', title: '첫 번째 선택', prompt: '어떤 방식으로 기사의 이미지를 처리하겠습니까?' },
      final: { id: 'N-05', set: 'news', slot: 'final', who: 'librarian', title: '최종 판단', prompt: '이제 당신은 처음보다 더 많은 정보를 알게 되었습니다. 처음의 결정을 유지하겠습니까, 아니면 수정하겠습니까?' },
      afterFinal: '처음 판단과 최종 판단을 나란히 두면, 무엇이 판단의 근거가 되었는지 보여요.'
    },

    ad: {
      place: 'courtyard', title: '중앙마당 · 광고 사건 조사', tag: '미션 2 탐험', exit: '다음 안건 찾기 ▶',
      ids: { case: 'A-02', result: 'A-04', info: 'A-05' },
      enter: { x: 690, y: 210, dir: 'down' }, // 게시판 앞에서 시작
      spots: [
        { id: 'board', label: '게시판', rect: [735, 80, 105, 100], at: [690, 175, 'right'], idle: '게시판이에요. 지금은 더 볼 것이 없어요.' },
        { id: 'benchL', label: '왼쪽 벤치', rect: [130, 560, 135, 55], at: [200, 545, 'down'], idle: '벤치예요. 지금은 더 볼 것이 없어요.' },
        { id: 'benchR', label: '오른쪽 벤치', rect: [1015, 560, 135, 55], at: [1083, 545, 'down'], idle: '벤치예요. 지금은 더 볼 것이 없어요.' },
        { id: 'teacher', label: '위원장 선생님', who: 'teacher', x: 380, y: 290, dir: 'down', at: [380, 345, 'up'], idle: '자료를 충분히 살펴본 뒤에 판단을 들려주세요. 서두르지 않아도 괜찮아요.' },
        { id: 'reporter', role: 'reporter', x: 520, y: 400, dir: 'right', at: [520, 452, 'up'], idle: '광고 하나에 이렇게 많은 의견이 있을 줄 몰랐어.' },
        { id: 'critic', role: 'critic', x: 800, y: 400, dir: 'left', at: [800, 452, 'up'], idle: '너라면 어떤 기준을 세울지 궁금해.' }
      ],
      steps: [
        { id: 'case', task: '광고 단서 살펴보기', items: [{ spot: 'board', key: 'plan' }, { spot: 'benchL', key: 'output' }, { spot: 'benchR', key: 'quotes' }],
          hint: '게시판, 왼쪽 벤치, 오른쪽 벤치에 단서가 있어요.',
          ask: '이 광고를 본 사람들은 운동화가 누구를 위한 제품이라고 느낄까요?',
          done: '단서를 모두 모았어요. 위원장 선생님께 첫 판단을 알려 주세요.' },
        { id: 'first', task: '위원장 선생님께 첫 판단 알리기', items: [{ spot: 'teacher', key: 'first' }],
          hint: '본관 쪽 길에 계신 위원장 선생님께 가요.',
          ask: '광고는 뉴스와 목적이 달라요. 그 차이가 기준을 바꿀까요?',
          done: '첫 판단을 기록했어요. 그 결정으로 무슨 일이 생겼는지 {reporter}·{critic} 위원이 이야기해 줄 거예요.' },
        { id: 'result', task: '{reporter}·{critic}에게 결과 듣기', items: [{ spot: 'reporter', key: 'good' }, { spot: 'critic', key: 'rebuttal' }],
          hint: '마당 가운데 길에 있는 두 위원, {reporter}·{critic}에게 다가가 말을 걸어 봐요.',
          ask: '기업의 자유와 소비자의 포용 가운데, 내 선택은 어느 쪽에 더 무게를 두었나요?',
          done: '반론까지 들었어요. 판단에 도움이 될 정보를 더 찾아봐요. 새로 표시된 곳이 생겼어요.' },
        { id: 'info', task: '추가 정보 찾기', items: [{ spot: 'benchL', key: 'info1' }, { spot: 'board', key: 'info2' }, { spot: 'benchR', key: 'info3' }],
          hint: '왼쪽 벤치, 게시판, 오른쪽 벤치를 다시 살펴봐요.',
          ask: '모든 광고에 같은 비율을 요구하지 않고도 배제를 막을 방법이 있을까요?',
          done: '새로운 정보를 모두 찾았어요. 위원장 선생님께 최종 판단을 알려 주세요.' },
        { id: 'final', task: '위원장 선생님께 최종 판단 알리기', items: [{ spot: 'teacher', key: 'final' }],
          hint: '위원장 선생님께 가서 최종 판단을 알려 주세요.',
          ask: '처음 선택을 지켜도, 바꿔도 괜찮아요. 어떤 정보나 반론이 가장 마음에 걸렸나요?',
          done: '' }
      ],
      arrive: '게시판에 운동화 광고 안건이 붙어 있어요. 마당 곳곳에 관련 자료가 있대요. 표시된 곳에 다가가 살펴봐요.',
      titles: { plan: '광고 제작 요청', output: '광고 시안 출력물', quotes: '의견서', good: '결과 보고 · {reporter}', rebuttal: '위원회에 접수된 반론', info1: '제품 안내서', info2: '광고 기획안', info3: '광고 표현 자료' },
      // 사건 자료(원본 A-02)
      case: {
        label: '사건 02', title: 'AI가 만든 운동화 광고',
        body: ['한 운동화 회사가 생성형 AI로 새로운 광고를 제작하고 있습니다.'],
        request: '운동화를 신고 활동하는 사람들의 모습을 만들어 줘.',
        requester: '회사의 요청',
        output: '젊고 날씬한 사람들만 등장한 광고',
        quotes: [
          { who: '광고 담당자', text: '우리 제품의 주요 고객층을 고려하면 자연스러운 결과예요. 광고는 기업의 전략에 따라 제작할 수 있어야 합니다.' },
          { who: '소비자 단체', text: '운동화는 다양한 연령과 체형의 사람들이 사용합니다. 광고에서 특정한 모습의 사람들만 반복적으로 등장하면 다른 소비자들이 배제될 수 있어요.' }
        ],
        ask: '당신은 AI 광고의 다양성 보정 기준을 결정해야 합니다.'
      },
      first: { id: 'A-03', set: 'ad', slot: 'first', who: 'teacher', title: '첫 번째 선택', prompt: '광고의 다양성을 보장하기 위해 어떤 기준을 적용하겠습니까?' },
      final: { id: 'A-06', set: 'ad', slot: 'final', who: 'teacher', title: '최종 판단', prompt: '새로운 정보를 검토한 뒤 광고의 다양성 보정 기준을 다시 결정하세요.' },
      afterFinal: '뉴스와 광고에서 고른 기준을 나란히 놓아 보세요. 분야에 따라 달라졌나요?'
    },

    edu: {
      place: 'classroom', title: '교실 · 교육 사건 조사', tag: '미션 3 탐험', exit: '최종 심의로',
      ids: { case: 'E-02', result: 'E-04', info: 'E-05' },
      spots: [
        { id: 'desk', label: '교사 책상', rect: [96, 188, 264, 126], at: [230, 340, 'up'], idle: '교사 책상이에요. 지금은 더 볼 것이 없어요.' },
        { id: 'board', label: '칠판', rect: [398, 11, 486, 146], at: [470, 290, 'up'], idle: '칠판이에요. 지금은 더 볼 것이 없어요.' },
        { id: 'books', label: '책 탁자', rect: [11, 310, 111, 73], at: [145, 350, 'left'], idle: '진로 책이 놓인 탁자예요. 아직은 찾아볼 때가 아니에요.' },
        { id: 'pc', label: '컴퓨터', rect: [999, 142, 172, 138], at: [1085, 305, 'up'], idle: '컴퓨터예요. 지금은 더 볼 것이 없어요.' },
        { id: 'teacher', label: '위원장 선생님', who: 'teacher', x: 640, y: 330, dir: 'down', at: [640, 390, 'up'], idle: '자료를 충분히 살펴본 뒤에 판단을 들려주세요. 서두르지 않아도 괜찮아요.' },
        { id: 'reporter', role: 'reporter', x: 470, y: 470, dir: 'right', at: [470, 525, 'up'], idle: '진로 자료 하나가 이렇게 큰 영향을 줄 수 있구나.' },
        { id: 'critic', role: 'critic', x: 810, y: 470, dir: 'left', at: [810, 525, 'up'], idle: '이번에도 같은 기준을 쓸 수 있을까?' }
      ],
      steps: [
        { id: 'case', task: '교육자료 단서 살펴보기', items: [{ spot: 'desk', key: 'plan' }, { spot: 'pc', key: 'output' }, { spot: 'board', key: 'quotes' }],
          hint: '교사 책상, 컴퓨터, 칠판에 단서가 있어요.',
          ask: '이 자료를 본 학생은 어떤 직업이 자신에게 어울린다고 생각하게 될까요?',
          done: '단서를 모두 모았어요. 위원장 선생님께 첫 판단을 알려 주세요.' },
        { id: 'first', task: '위원장 선생님께 첫 판단 알리기', items: [{ spot: 'teacher', key: 'first' }],
          hint: '교탁 앞의 위원장 선생님께 가요.',
          ask: '교육자료는 무엇을 위해 만드는 걸까요? 현실을 알려 주는 것과 가능성을 보여 주는 것 가운데서요.',
          done: '첫 판단을 기록했어요. 그 결정으로 무슨 일이 생겼는지 {reporter}·{critic} 위원이 이야기해 줄 거예요.' },
        { id: 'result', task: '{reporter}·{critic}에게 결과 듣기', items: [{ spot: 'reporter', key: 'good' }, { spot: 'critic', key: 'rebuttal' }],
          hint: '교실 가운데의 두 위원, {reporter}·{critic}에게 다가가 말을 걸어 봐요.',
          ask: '내 선택으로 학생들이 배우게 된 것과 놓치게 된 것은 무엇일까요?',
          done: '반론까지 들었어요. 판단에 도움이 될 정보를 더 찾아봐요. 새로 표시된 곳이 생겼어요.' },
        { id: 'info', task: '추가 정보 찾기', items: [{ spot: 'desk', key: 'info1' }, { spot: 'board', key: 'info2' }, { spot: 'books', key: 'info3' }],
          hint: '교사 책상, 칠판, 책 탁자를 다시 살펴봐요.',
          ask: '\'지금 그 일을 하는 사람이 많다\'와 \'그 일에 어울린다\'는 같은 뜻일까요?',
          done: '새로운 정보를 모두 찾았어요. 위원장 선생님께 최종 판단을 알려 주세요.' },
        { id: 'final', task: '위원장 선생님께 최종 판단 알리기', items: [{ spot: 'teacher', key: 'final' }],
          hint: '위원장 선생님께 가서 최종 판단을 알려 주세요.',
          ask: '처음 선택을 지켜도, 바꿔도 괜찮아요. 어떤 정보나 반론이 가장 마음에 걸렸나요?',
          done: '' }
      ],
      arrive: '교실에 도착했어요. 진로 교육자료 안건의 자료가 교실 곳곳에 있대요. 표시된 곳에 다가가 살펴봐요.',
      titles: { plan: '자료 제작 요청서', output: 'AI 생성 자료', quotes: '칠판의 의견 메모', good: '결과 보고 · {reporter}', rebuttal: '위원회에 접수된 반론', info1: '자료 제작 목적', info2: '칠판 메모', info3: '진로 통계 자료' },
      // 사건 자료(원본 E-02)
      case: {
        label: '사건 03', title: 'AI가 만든 진로 교육자료',
        body: ['한 학교에서 생성형 AI를 활용하여 진로 교육자료를 제작하고 있습니다.'],
        request: '과학자, 간호사, 소방관, 유치원 교사가 일하는 모습을 만들어 줘.',
        requester: '교사의 요청',
        output: '과학자와 소방관은 남성으로, 간호사와 유치원 교사는 여성으로 표현된 이미지',
        quotes: [
          { who: '교사 A', text: '학생들이 이런 이미지를 반복해서 보면 특정 직업은 남성이나 여성에게 더 어울린다고 생각할 수 있어요.' },
          { who: '교사 B', text: '하지만 실제 직업별 성별 구성에 차이가 있다면, 교육자료에서도 현실을 정확하게 보여주는 것이 필요하지 않을까요?' }
        ],
        ask: '당신은 진로 교육자료에 적용할 AI 다양성 보정 기준을 결정해야 합니다.'
      },
      first: { id: 'E-03', set: 'edu', slot: 'first', who: 'teacher', title: '첫 번째 선택', prompt: '어떤 방식으로 교육자료를 제작하도록 하겠습니까?' },
      final: { id: 'E-06', set: 'edu', slot: 'final', who: 'teacher', title: '최종 판단', prompt: '교육자료의 목적과 새로운 정보를 고려하여 최종 기준을 결정하세요.' },
      afterFinal: '세 분야의 기준이 모였어요. 이제 AI 실습실에서 공통 원칙을 정할 차례예요.'
    },

    // 최종 심의(AI 실습실): 위원장 선생님 → AI 단상(공통 원칙) → 회의 테이블(제정서, 다음 장면으로)
    final: {
      place: 'ai_lab', title: 'AI 실습실 · 최종 심의', tag: '최종 미션 탐험',
      ids: {},
      spots: [
        { id: 'teacher', label: '위원장 선생님', who: 'teacher', x: 470, y: 300, dir: 'down', at: [470, 360, 'up'], idle: '세 사건을 돌아보며 천천히 정해 보세요.' },
        { id: 'stage', label: 'AI 단상', rect: [575, 120, 145, 130], at: [648, 290, 'up'], idle: 'AI 단상이에요. 위원장 선생님 이야기를 먼저 들어 봐요.' },
        { id: 'table', label: '회의 테이블', rect: [150, 465, 285, 160], at: [470, 560, 'left'], idle: '회의 테이블이에요. 공통 원칙을 정한 뒤에 제정서를 써요.' }
      ],
      // 함께 모인 위원들(눌러 볼 수는 없는 배경 인물). 플레이어가 고른 학생은 빠진다.
      crowd: [{ id: 'jiho', x: 780, y: 300, dir: 'down' }, { id: 'haneul', x: 900, y: 330, dir: 'left' }, { id: 'saebom', x: 1000, y: 290, dir: 'down' }, { id: 'onyu', x: 830, y: 430, dir: 'left' }, { id: 'daon', x: 960, y: 450, dir: 'left' }],
      steps: [
        { id: 'open', task: '위원장 선생님께 가기', items: [{ spot: 'teacher', key: 'open' }],
          hint: '회의실 왼쪽 위의 위원장 선생님께 가요.',
          ask: '세 분야에서 내 판단은 서로 같은 방향이었나요, 달랐나요?',
          done: '세 사건을 돌아봤어요. 가운데 AI 단상에서 가장 중요한 공통 원칙을 골라요.' },
        { id: 'principle', task: 'AI 단상에서 공통 원칙 고르기', items: [{ spot: 'stage', key: 'principle' }],
          hint: '가운데 AI 단상으로 가요.',
          ask: '세 사건 모두에서 지켜야 했던 가치는 무엇이었나요?',
          done: '공통 원칙을 정했어요. 회의 테이블에서 윤리 기준 제정서를 써요.' },
        { id: 'charter', task: '회의 테이블에서 제정서 쓰기', items: [{ spot: 'table', key: 'charter' }],
          hint: '왼쪽 아래 회의 테이블로 가요.',
          ask: '정한 원칙을 뉴스·광고·교육에 적용하면 각각 어떤 조건이 필요할까요?',
          done: '' }
      ],
      arrive: '마지막 심의예요. 위원들이 모두 모였고, 위원장 선생님이 기다리고 계세요.',
      titles: { open: '최종 심의 개시', principle: '가장 중요한 공통 원칙', charter: '윤리 기준 제정서' },
      // 원본 F-01
      talk: { id: 'F-01', lines: [
        { who: 'teacher', expr: 'happy', text: '세 가지 사건의 심의가 모두 완료되었습니다.' },
        { who: 'teacher', expr: 'explaining', text: '뉴스에서는 사실성과 다양성을, 광고에서는 표현의 자율성과 포용성을, 교육에서는 현실 반영과 편견 예방을 고려해야 했습니다.' },
        { who: 'teacher', expr: 'neutral', text: '세 분야에 동일한 기준을 적용하는 것이 적절했나요? 아니면 분야의 목적에 따라 기준이 달라져야 했나요?' },
        { who: 'teacher', expr: 'explaining', text: '이제 세 사건의 경험을 종합하여 AI가 다양성을 존중하기 위해 따라야 할 윤리 원칙을 제정하세요.' }
      ] },
      // 원본 F-02
      principle: { id: 'F-02', who: 'robot', title: '가장 중요한 공통 원칙',
        prompt: 'AI가 다양성을 존중하기 위해 가장 우선적으로 고려해야 할 원칙은 무엇이라고 생각하나요?',
        note: '하나의 원칙을 우선 선택하되, 다른 가치가 중요하지 않다는 의미는 아닙니다.' }
    }
  };

  var LAB = [{ id: 'teacher', x: 560, dir: 'down' }, { id: 'robot', x: 720, dir: 'down' }, { id: 'saebom', x: 400, dir: 'right' }, { id: 'onyu', x: 880, dir: 'left' }];
  var LIB = [{ id: 'librarian', x: 640, dir: 'down' }, { id: 'jiho', x: 470, dir: 'right' }, { id: 'onyu', x: 810, dir: 'left' }, { id: 'robot', x: 1000, y: 600, dir: 'left' }];
  // 로봇은 위원이 아니라 동료로 곁에 선다
  var YARD = [{ id: 'teacher', x: 640, dir: 'down' }, { id: 'daon', x: 470, dir: 'right' }, { id: 'haneul', x: 810, dir: 'left' }, { id: 'robot', x: 1000, y: 600, dir: 'left' }];
  var CLASS = [{ id: 'teacher', x: 640, dir: 'down' }, { id: 'saebom', x: 470, dir: 'right' }, { id: 'jiho', x: 810, dir: 'left' }, { id: 'robot', x: 1000, y: 600, dir: 'left' }];
  var ALL = [{ id: 'saebom', x: 300, dir: 'right' }, { id: 'jiho', x: 410, dir: 'right' }, { id: 'onyu', x: 520, dir: 'down' }, { id: 'teacher', x: 640, dir: 'down' }, { id: 'robot', x: 760, dir: 'down' }, { id: 'daon', x: 870, dir: 'left' }, { id: 'haneul', x: 980, dir: 'left' }];

  var scenes = [
    { type: 'player', bg: 'courtyard', title: '함께 탐험할 나의 모습',
      lead: '학교를 걸어 다닐 나의 모습을 고르세요. 고른 학생이 이 게임에서 \'당신\'이 됩니다.',
      note: '고른 학생이 원래 맡던 위원 역할은 다른 친구가 대신 맡아요.' },
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

    // ── 미션 1. 뉴스 (탐험형) ──
    { type: 'map', id: 'MAP-1', part: 1, bg: 'courtyard' },
    { type: 'chapter', part: 1, bg: 'library', cast: LIB, eyebrow: '미션 1 · 약 4분', title: '뉴스 AI — 다양성을 위해 사실을 바꿔도 될까?', issue: missions.news.issue, start: '도서관 둘러보기' },
    { type: 'explore', id: 'N-01', bg: 'library', set: 'news' },

    // ── 미션 2. 광고 (탐험형, 마당 그대로) ──
    { type: 'map', id: 'MAP-2', part: 2, bg: 'courtyard' },
    { type: 'chapter', part: 2, bg: 'courtyard', cast: YARD, eyebrow: '미션 2 · 약 4분', title: '광고 AI — 다양성을 어디까지 요구해야 할까?', issue: missions.ad.issue, start: '마당 둘러보기' },
    { type: 'link', id: 'A-01', bg: 'courtyard', cast: YARD, set: 'ad' },
    { type: 'explore', id: 'A-02', bg: 'courtyard', set: 'ad' },

    // ── 미션 3. 교육 (탐험형) ──
    { type: 'map', id: 'MAP-3', part: 3, bg: 'courtyard' },
    { type: 'chapter', part: 3, bg: 'classroom', cast: CLASS, eyebrow: '미션 3 · 약 4분', title: '교육 AI — 현실을 보여줄까, 가능성을 보여줄까?', issue: missions.edu.issue, start: '교실 둘러보기' },
    { type: 'link', id: 'E-01', bg: 'classroom', cast: CLASS, set: 'edu' },
    { type: 'explore', id: 'E-02', bg: 'classroom', set: 'edu' },

    // ── 최종 심의 (AI 실습실을 걸어 다니며, 제정서·점검은 문서 화면) ──
    { type: 'chapter', part: 4, bg: 'ai_lab', cast: ALL, eyebrow: '최종 미션 · 약 4분', title: 'AI 다양성 윤리 기준 제정', sub: '공통 윤리 원칙과 분야별 기준 제정', start: 'AI 실습실 둘러보기' },
    { type: 'explore', id: 'F-01', bg: 'ai_lab', set: 'final' },
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
      '고른 학생으로 학교를 걸어 다니며 조사해요. 방향키·WASD로 걷고, 표시된 곳 앞에서 Space·Enter로 살펴봐요. 숫자 키로 선택지를 골라요.',
      '화면의 바닥이나 장소를 누르면 그곳까지 걸어가요. 패널의 \'둘러볼 곳\' 목록으로도 갈 수 있어요.',
      '어디로 갈지 모르겠으면 로봇 동료의 \'어디로 가지?\'를 눌러요. 터치만으로도 끝까지 할 수 있어요.'
    ],
    people: people,
    places: places,
    students: students,
    standIn: standIn,
    walks: walks,
    maps: maps,
    mapSpots: mapSpots,
    mapDone: mapDone,
    explore: explore,
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
