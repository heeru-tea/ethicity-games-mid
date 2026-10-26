/*
 * 스토리 데이터 — 안건·인터뷰·시뮬레이터 문장·반론·마무리 질문. 문장 수정은 이 파일만 고치면 된다.
 *
 * 작성법
 *   AGENDAS[i].steps 순서는 Engine.STEPS 와 같다(브리핑 → 데이터 → 최초 판단 → 추가 정보 → 인터뷰 → 시뮬레이터 → 최종 판단).
 *   data.kind: 'checklist'(여러 개 고르기) | 'quiz'(문항 묶음: choice·number·text)
 *   sim.risks[].fixedBy: 이 위험을 줄이는 보호 조치 ID. 하나라도 고르면 '줄어든 위험'으로 옮긴다(0이 되지는 않음)
 *   sim.protNotes[보호ID]: 그 조치를 고를 때 따라오는 효율·비용 변화. slows:true 면 효율 기대치를 한 단계 낮춘다
 *   draft: true  — 시나리오 원문이 아니라 Claude가 채운 초안(교사 검토 대상). 검토 후 false 로 바꾼다
 */
(function (root) {
  'use strict';

  var CHOICES = {
    A: { label: '도입한다', short: '도입' },
    B: { label: '인권 보호 조건을 마련한 후 도입한다', short: '조건부 도입' },
    C: { label: '도입하지 않는다', short: '도입 안 함' }
  };

  // 목적격 조사까지 붙인 obj 는 일관성 점검 질문에 쓴다
  var PROTECTIONS = [
    { id: 'alt', name: '대체 인증 수단', obj: '대체 인증 수단을', desc: '얼굴 대신 신분증·출입증 등 다른 방법을 언제든 고를 수 있게 해요.' },
    { id: 'human', name: '사람에 의한 재확인', obj: '사람에 의한 재확인을', desc: 'AI가 실패하거나 누군가를 지목하면 사람이 직접 다시 확인해요.' },
    { id: 'groupTest', name: '집단별 성능 검증', obj: '집단별 성능 검증을', desc: '도입 전과 운영 중에 집단마다 오류율을 따로 측정하고 공개해요.' },
    { id: 'minimize', name: '개인정보 최소화', obj: '개인정보 최소화를', desc: '필요한 얼굴 정보만, 필요한 기간만 보관하고 바로 삭제해요.' },
    { id: 'appeal', name: '이의제기·구제', obj: '이의제기·구제 절차를', desc: '오류로 불이익을 받은 사람이 이의를 제기하고 바로잡을 수 있게 해요.' },
    { id: 'oversight', name: '독립 감독', obj: '독립 감독을', desc: '운영 기관이 아닌 외부 위원회가 사용 기록과 결과를 점검해요.' },
    { id: 'limit', name: '목적·장소 제한', obj: '목적·장소 제한을', desc: '정해진 목적과 장소에서만 쓰고 다른 용도로 넓히지 않아요.' }
  ];

  var ASPECTS = [
    { id: 'efficiency', name: '효율' },
    { id: 'cost', name: '비용' },
    { id: 'rights', name: '인권 침해 위험' },
    { id: 'trust', name: '시민 신뢰' }
  ];

  var AGENDAS = [
    {
      id: 'library',
      no: '제2026-01호',
      area: '건물 출입',
      short: '출입',
      title: '윤리시티 공공도서관의 스마트 출입 시스템',
      minutes: 6,
      values: ['편의성', '접근권', '개인정보 보호'],
      situation: '도서관이 출입증 대신 얼굴만 보여주면 들어가는 안면인식 출입을 도입하려 합니다.',
      benefits: ['출입증을 챙길 필요가 없어요.', '출입증 발급 업무가 줄어요.', '입구 대기 시간이 짧아져요.'],
      guideLines: [
        { text: '위원님, 첫 번째 안건입니다. 공공도서관이 출입증 대신 얼굴 인식으로 문을 열려고 해요.', draft: true },
        { text: '시청 보고서에는 “전체 정확도 99%”라고 적혀 있습니다. 먼저 이 숫자를 함께 살펴봐요.', draft: true }
      ],
      data: {
        kind: 'checklist',
        headline: '시청 보고: 전체 정확도 99%',
        prompt: '“99%”라는 숫자만으로는 알 수 없는 것을 모두 고르세요.',
        options: [
          { id: 'who', text: '누구에게 오류가 나는지', note: '99%는 전체 평균이에요. 오류가 특정 집단에 몰려 있어도 평균은 높게 나올 수 있어요.' },
          { id: 'sample', text: '몇 명을 대상으로 측정했는지(표본 수)', note: '측정한 사람이 적거나 한쪽으로 치우치면 실제 이용자에게서는 결과가 달라질 수 있어요.' },
          { id: 'condition', text: '어떤 조건에서 측정했는지(조명·각도·장소)', note: '실험실의 밝은 조명과 실제 도서관 입구의 역광·모자·마스크는 다른 조건이에요.' },
          { id: 'harm', text: '오류가 나면 이용자가 어떤 불편을 겪는지', note: '오류 1%가 “한 번 더 보기”인지 “직원에게 신분증 보여주기”인지에 따라 무게가 달라요.' }
        ],
        reveal: '네 가지 모두 “99%”만으로는 알 수 없어요. 정확도 숫자는 출발점이지 결론이 아니에요.'
      },
      initialQuestion: '전체 정확도 99%인 시스템을 도입하시겠습니까?',
      extra: {
        title: '추가 자료: 집단별 인식 실패율',
        bars: [
          { label: '집단 A', value: 0.5, text: '0.5%' },
          { label: '집단 B', value: 8.0, text: '8.0%' }
        ],
        unit: '인식 실패율',
        headline: '집단 B의 실패율이 집단 A의 16배예요.',
        notes: [
          '이 자료는 앞의 “전체 정확도 99%”와 다른 표본에서 측정했어요. 두 숫자를 바로 빼거나 더할 수 없어요.',
          '격차는 집단의 특성 때문이 아니라 학습 데이터와 사용 환경 때문에 생겨요.'
        ]
      },
      interviews: [
        { role: 'libStudent', who: '도서관 이용 학생', line: '친구들은 바로 들어가는데 저는 매번 직원에게 신분증을 보여줘야 해요. 불편하고 창피해요.', face: 'worried' },
        { role: 'libManager', who: '도서관 운영 담당자', line: '업무는 줄겠지만 누구나 불편 없이 이용할 수 있어야 합니다.', face: 'explaining' }
      ],
      finalQuestion: '일부 시민만 반복적으로 신원을 확인받아야 한다면, 이 시스템을 공정하다고 할 수 있을까요?',
      related: ['alt', 'minimize', 'groupTest'],
      sim: {
        adoptCost: '카메라·인식 서버 설치와 유지 비용이 들어요.',
        benefits: [
          { aspect: 'efficiency', text: '대부분의 이용자가 출입증 없이 바로 들어가요.', who: '대부분의 도서관 이용자' },
          { aspect: 'efficiency', text: '출입증 발급·재발급 업무가 줄어요.', who: '도서관 직원' }
        ],
        adoptProtects: [],
        risks: [
          { id: 'l-gap', aspect: 'rights', right: '차별받지 않을 권리(평등권)', text: '인식 실패율이 높은 집단 B 이용자는 출입할 때마다 직원 확인을 받아요.', who: '인식 실패가 잦은 이용자(집단 B)', fixedBy: ['alt', 'groupTest'], reduced: '다른 출입 방법이 있거나 격차를 줄인 뒤 도입해, 반복 확인 부담이 줄어요.', draft: true },
          { id: 'l-access', aspect: 'trust', right: '도서관을 이용할 권리(정보 접근권)', text: '창피함 때문에 도서관 이용을 줄이는 시민이 생길 수 있어요.', who: '인식 실패가 잦은 이용자(집단 B)', fixedBy: ['alt'], reduced: '얼굴 인식을 원하지 않거나 실패한 이용자도 같은 줄에서 출입증으로 들어가요.', draft: true },
          { id: 'l-bio', aspect: 'rights', right: '개인정보자기결정권', text: '모든 이용자의 얼굴 정보가 저장돼요. 유출되면 비밀번호처럼 바꿀 수 없어요.', who: '모든 도서관 이용자', fixedBy: ['minimize'], reduced: '출입 확인에 필요한 정보만 두고 기간이 지나면 삭제해 유출 피해 범위가 줄어요.', draft: true }
        ],
        alwaysUnresolved: ['학습 데이터의 격차 자체를 고치는 일은 개발사와 시청의 과제로 남아요.'],
        protNotes: {
          alt: { efficiency: '출입증 창구를 함께 운영해 줄어드는 업무가 조금 적어요.', cost: '출입증 발급을 계속 유지해요.', slows: false },
          human: { efficiency: '실패할 때마다 직원이 확인해야 해요.', cost: '확인 인력이 필요해요.', slows: true },
          groupTest: { efficiency: '검증이 끝날 때까지 도입이 늦어져요.', cost: '집단별 측정·공개 비용이 들어요.', slows: false },
          minimize: { efficiency: '', cost: '삭제 주기 관리가 필요해요.', slows: false },
          appeal: { efficiency: '', cost: '이의 접수 창구가 필요해요.', slows: false },
          oversight: { efficiency: '', cost: '외부 점검 비용이 들어요.', slows: false },
          limit: { efficiency: '', cost: '', slows: false }
        },
        noAdopt: {
          effects: [
            { aspect: 'rights', text: '얼굴 정보를 새로 모으지 않아요.' },
            { aspect: 'trust', text: '모든 이용자가 같은 방법으로 출입해요.' }
          ],
          risks: [
            { aspect: 'efficiency', text: '출입증 발급·분실 업무와 입구 대기가 그대로예요.' }
          ],
          unresolved: ['출입을 편하게 하려면 안면인식이 아닌 다른 방법을 찾아야 해요.'],
          affected: ['도서관 직원', '출입증을 자주 잊는 이용자']
        }
      }
    },

    {
      id: 'hiring',
      no: '제2026-02호',
      area: '채용',
      short: '채용',
      title: '윤리시티 시청의 AI 채용 신원 확인 시스템',
      minutes: 12,
      deep: true,
      values: ['업무 효율', '기회의 평등', '개인정보 보호'],
      situation: '필기시험장과 면접장 입구에서 지원자의 얼굴을 등록 사진과 비교해 본인인지 확인합니다. 외모나 표정으로 능력을 평가하는 기능은 없습니다.',
      benefits: ['신원 확인 시간이 줄어요.', '담당자의 업무 부담이 줄어요.', '대리 응시를 막아요.'],
      guideLines: [
        { text: '두 번째 안건은 심화 안건입니다. 시청 채용 시험장 입구에서 얼굴로 본인 확인을 하려고 해요.', draft: true },
        { text: '능력을 평가하는 기능은 없어요. 오직 “이 사람이 지원자 본인인가”만 확인합니다.', draft: true }
      ],
      data: {
        kind: 'quiz',
        headline: '지원자 2,000명 시험 결과',
        table: {
          head: ['집단', '지원자', '인증 실패', '실패율'],
          rows: [
            ['집단 A', '1,000명', '10명', '1%'],
            ['집단 B', '1,000명', '80명', '8%'],
            ['전체', '2,000명', '90명', '4.5%']
          ]
        },
        bars: [
          { label: '집단 A', value: 1, text: '1% (10명)' },
          { label: '집단 B', value: 8, text: '8% (80명)' }
        ],
        questions: [
          { id: 'q1', type: 'choice', text: '어느 집단의 인증 실패가 더 많나요?', options: ['집단 A', '집단 B'], answer: 1, explain: '집단 B는 80명, 집단 A는 10명이 실패했어요.' },
          { id: 'q2', type: 'number', text: '집단 B의 실패율은 집단 A의 몇 배인가요?', unit: '배', answer: 8, hint: '8%를 1%로 나누어 보세요.', explain: '8% ÷ 1% = 8배예요.' },
          { id: 'q3', type: 'text', text: '이 차이가 채용 기회에 어떤 영향을 줄 수 있을까요?' }
        ]
      },
      initialQuestion: '업무 효율을 위해 안면인식 신원 확인 시스템을 도입하시겠습니까?',
      extra: {
        title: '추가 자료: 인증에 실패하면',
        facts: [
          { big: '평균 25분', text: '인증에 실패한 지원자가 재확인을 기다리는 시간' },
          { big: '시작 시각 고정', text: '늦게 입실하면 그만큼 시험 시간이 줄어요' }
        ],
        headline: '집단 B 지원자 80명이 평균 25분씩 시험 시간을 잃을 수 있어요.',
        notes: ['실패는 지원자의 잘못이 아니라 시스템의 오류예요.']
      },
      interviews: [
        { role: 'recruiter', who: '채용 담당자', line: '절차가 빨라지지만, 인증 실패가 결과에 영향을 주지 않을 장치는 필요합니다.', face: 'explaining' },
        { role: 'applicant', who: '채용 지원자', line: '제 잘못이 아닌데 전형이 지연되거나 불이익을 받을까 걱정됩니다.', face: 'worried' },
        { role: 'expert', who: '인권 전문가', line: '전체가 정확해도 특정 집단의 실패율이 높다면 공정성을 검토해야 하고, 다른 인증 방식을 고를 수 있는지도 중요합니다.', face: 'explaining', optional: true }
      ],
      interviewTask: {
        prompt: '세 관점 중 가장 중요하다고 생각하는 관점 하나를 고르고 이유를 쓰세요.'
      },
      finalQuestion: '데이터, 인터뷰, 정책 결과 중 무엇이 판단에 가장 큰 영향을 주었나요? 판단을 유지하거나 바꾼 이유를 설명하세요.',
      finalFactor: ['데이터', '인터뷰', '정책 결과'],
      related: ['alt', 'human', 'groupTest', 'appeal'],
      sim: {
        adoptCost: '인식 장비와 등록 사진 관리 시스템 비용이 들어요.',
        benefits: [
          { aspect: 'efficiency', text: '대부분의 지원자가 입구를 빠르게 통과해요.', who: '대부분의 지원자' },
          { aspect: 'efficiency', text: '담당자의 신분증 대조 업무가 줄어요.', who: '채용 담당자' },
          { aspect: 'trust', text: '대리 응시를 막아 시험의 공정성을 지켜요.', who: '모든 지원자' }
        ],
        adoptProtects: ['공정한 시험(대리 응시 방지)'],
        risks: [
          { id: 'h-time', aspect: 'rights', right: '기회의 평등(평등권)', text: '인증에 실패한 집단 B 지원자가 평균 25분을 기다려 시험 시간을 잃어요.', who: '인증 실패가 잦은 지원자(집단 B)', fixedBy: ['alt', 'human'], reduced: '실패하면 바로 신분증이나 담당자 확인으로 입실해 시험 시간 손실이 줄어요.', draft: true },
          { id: 'h-gap', aspect: 'rights', right: '차별받지 않을 권리(평등권)', text: '집단 간 8배 격차를 확인하지 않은 채 운영돼요.', who: '집단 B 지원자', fixedBy: ['groupTest'], reduced: '집단별 오류율을 측정·공개하고 격차가 크면 개선한 뒤 써요.', draft: true },
          { id: 'h-appeal', aspect: 'trust', right: '공정한 절차를 요구할 권리', text: '인증 오류로 불이익을 받아도 바로잡을 길이 없어요.', who: '불이익을 받은 지원자', fixedBy: ['appeal'], reduced: '불이익을 받은 지원자가 이의를 제기하고 추가 시간이나 재시험을 받을 수 있어요.', draft: true },
          { id: 'h-bio', aspect: 'rights', right: '개인정보자기결정권', text: '지원자 얼굴 정보가 채용이 끝난 뒤에도 남을 수 있어요.', who: '모든 지원자', fixedBy: ['minimize'], reduced: '본인 확인이 끝나면 얼굴 정보를 삭제해요.', draft: true }
        ],
        alwaysUnresolved: ['인증 실패를 줄이려면 학습 데이터와 촬영 환경을 개선해야 해요.'],
        protNotes: {
          alt: { efficiency: '신분증 확인 줄을 함께 운영해요.', cost: '확인 인력을 일부 유지해요.', slows: false },
          human: { efficiency: '실패한 지원자마다 담당자가 다시 확인해요.', cost: '현장 담당자가 필요해요.', slows: true },
          groupTest: { efficiency: '검증이 끝날 때까지 도입이 늦어져요.', cost: '집단별 측정·공개 비용이 들어요.', slows: false },
          minimize: { efficiency: '', cost: '삭제 기록 관리가 필요해요.', slows: false },
          appeal: { efficiency: '이의 처리에 시간이 들어요.', cost: '재시험·추가 시간 운영 비용이 들어요.', slows: false },
          oversight: { efficiency: '', cost: '외부 점검 비용이 들어요.', slows: false },
          limit: { efficiency: '', cost: '', slows: false }
        },
        noAdopt: {
          effects: [
            { aspect: 'rights', text: '모든 지원자가 같은 방식(신분증 대조)으로 확인받아요.' },
            { aspect: 'rights', text: '지원자 얼굴 정보를 새로 모으지 않아요.' }
          ],
          risks: [
            { aspect: 'efficiency', text: '신분증 대조에 시간이 걸리고 담당자 업무가 그대로예요.' },
            { aspect: 'trust', text: '대리 응시는 기존 방식으로 막아야 해요.' }
          ],
          unresolved: ['확인 시간을 줄이고 대리 응시를 막을 다른 방법을 찾아야 해요.'],
          affected: ['채용 담당자', '입구에서 기다리는 지원자']
        }
      }
    },

    {
      id: 'policing',
      no: '제2026-03호',
      area: '치안',
      short: '치안',
      title: '윤리시티의 AI 스마트 치안 시스템',
      minutes: 7,
      values: ['시민의 안전', '사생활 보호', '이동의 자유'],
      situation: '경찰이 공공장소 CCTV에서 얼굴을 찾아 수배자·실종자 명단과 비교하려 합니다.',
      benefits: ['실종자를 찾는 시간이 줄어요.', '수사 후보 인물을 빠르게 추려요.'],
      guideLines: [
        { text: '마지막 안건입니다. 이번에는 정해진 사람이 아니라 광장을 지나는 모든 사람의 얼굴을 살펴요.', draft: true },
        { text: '오탐률은 0.1%입니다. 아주 작아 보이지만, 중앙광장에는 하루 10만 명이 지나가요.', draft: true }
      ],
      data: {
        kind: 'quiz',
        headline: '오탐률 0.1% · 중앙광장 하루 통행량 10만 명',
        facts: [
          { big: '0.1%', text: '오탐률: 찾는 사람이 아닌데 맞다고 잘못 지목할 비율' },
          { big: '100,000명', text: '중앙광장 하루 통행량' }
        ],
        questions: [
          { id: 'q1', type: 'number', text: '하루에 몇 명이 잘못 지목될까요?', unit: '명', answer: 100, hint: '100,000 × 0.1% = 100,000 × 0.001 이에요.', explain: '100,000명 × 0.1% = 하루 100명이에요. 한 달이면 약 3,000명이에요.' }
        ],
        glossary: [
          { term: '오탐(잘못 지목)', text: '찾는 사람이 아닌 무고한 시민을 찾는 사람이라고 잘못 지목하는 오류예요. 무고한 사람이 검문·조사를 받을 수 있어요.' },
          { term: '미탐(놓침)', text: '찾는 사람이 지나갔는데 알아보지 못하고 놓치는 오류예요. 실종자를 찾을 기회를 잃어요.' }
        ],
        glossaryNote: '두 오류는 한쪽을 줄이면 다른 쪽이 늘어나기 쉬워요. 어느 오류를 더 줄일지는 기술이 아니라 사회가 정할 문제예요.'
      },
      initialQuestion: '시민의 안전을 위해 공공장소에 안면인식 기술을 도입하시겠습니까?',
      extra: {
        title: '추가 정보: 사고실험',
        thought: '기술이 모든 사람을 완벽하게 식별할 수 있다면, 모든 공공장소에서 시민을 계속 추적해도 될까요?',
        notes: ['오탐이 0이 되어도 “언제, 어디에, 누구와 있었는지”가 모두 기록된다는 문제는 남아요.'],
        noteDraft: true
      },
      interviews: [
        { role: 'family', who: '실종자 가족', line: '가족을 찾을 방법이 있다면 쓰고 싶습니다. 다만 정확성과 책임 있는 운영이 중요합니다.', face: 'worried' },
        { role: 'activist', who: '인권단체 활동가', line: '실종자 수색을 위한 제한적 사용과 모든 시민을 상시 감시하는 것은 다릅니다.', face: 'explaining' }
      ],
      finalQuestion: '정확도가 높다는 사실은 그 기술의 모든 활용 방식이 정당하다는 뜻일까요?',
      related: ['limit', 'oversight', 'human', 'minimize'],
      sim: {
        adoptCost: 'CCTV 연결·분석 서버와 운영 인력 비용이 들어요.',
        benefits: [
          { aspect: 'efficiency', text: '실종자 수색 시간이 줄어요.', who: '실종자와 가족' },
          { aspect: 'efficiency', text: '수사 후보 인물을 빠르게 추려요.', who: '경찰' }
        ],
        adoptProtects: ['생명·신체의 안전(실종자 수색)'],
        risks: [
          { id: 'p-false', aspect: 'rights', right: '무죄 추정과 신체의 자유', text: '하루 100명의 무고한 시민이 잘못 지목돼 검문·조사를 받을 수 있어요.', who: '잘못 지목된 시민(하루 약 100명)', fixedBy: ['human', 'appeal'], reduced: 'AI가 지목해도 사람이 다시 확인하고, 잘못 지목된 시민은 기록 삭제와 구제를 요청할 수 있어요.', draft: true },
          { id: 'p-collect', aspect: 'rights', right: '사생활의 비밀과 자유', text: '광장을 지나는 모든 시민의 얼굴이 분석돼요.', who: '광장을 지나는 모든 시민(하루 10만 명)', fixedBy: ['minimize', 'limit'], reduced: '명단과 일치하지 않는 얼굴은 바로 지우고, 정해진 장소에서만 분석해요.', draft: true },
          { id: 'p-track', aspect: 'rights', right: '이동의 자유', text: '이동 기록이 쌓이면 누가 언제 어디에 갔는지 계속 추적할 수 있어요. 집회·모임에 가기를 꺼리게 될 수 있어요.', who: '모든 시민', fixedBy: ['limit', 'oversight'], reduced: '실종자 수색 같은 정해진 목적에만 쓰고 외부 위원회가 사용 기록을 점검해요.', draft: true },
          { id: 'p-scope', aspect: 'trust', right: '개인정보자기결정권', text: '처음 목적과 다른 용도로 쓰임이 넓어질 수 있어요.', who: '모든 시민', fixedBy: ['limit', 'oversight'], reduced: '쓸 수 있는 목적을 정하고 넓힐 때는 외부 점검을 거쳐요.', draft: true },
          { id: 'p-gap', aspect: 'rights', right: '차별받지 않을 권리(평등권)', text: '특정 집단이 더 자주 잘못 지목되는지 알 수 없어요.', who: '오탐이 잦을 수 있는 집단', fixedBy: ['groupTest'], reduced: '집단별 오탐률을 측정·공개해요.', draft: true }
        ],
        alwaysUnresolved: ['오탐을 줄이면 미탐이 늘 수 있어요. 어느 오류를 더 줄일지 계속 정해야 해요.'],
        protNotes: {
          alt: { efficiency: '', cost: '', slows: false },
          human: { efficiency: '지목된 사람마다 경찰이 직접 확인해요.', cost: '확인 인력이 필요해요.', slows: true },
          groupTest: { efficiency: '', cost: '집단별 측정·공개 비용이 들어요.', slows: false },
          minimize: { efficiency: '지난 기록으로 되돌아가 찾기는 어려워져요.', cost: '', slows: false },
          appeal: { efficiency: '', cost: '구제 창구가 필요해요.', slows: false },
          oversight: { efficiency: '사용할 때마다 기록·보고가 필요해요.', cost: '외부 위원회 운영 비용이 들어요.', slows: false },
          limit: { efficiency: '정해진 목적·장소 밖에서는 쓸 수 없어요.', cost: '', slows: true }
        },
        noAdopt: {
          effects: [
            { aspect: 'rights', text: '시민의 얼굴을 상시 분석하지 않아요.' },
            { aspect: 'rights', text: '잘못 지목되는 시민이 생기지 않아요.' }
          ],
          risks: [
            { aspect: 'efficiency', text: '실종자 수색은 기존 방식(제보·영상 직접 확인)에 기대야 해요.' }
          ],
          unresolved: ['실종자 가족의 절박한 필요에 답할 다른 방법을 찾아야 해요.'],
          affected: ['실종자와 가족', '경찰']
        }
      }
    }
  ];

  var GUIDELINE_FIELDS = [
    { id: 'allow', label: '허용 조건', hint: '어떤 경우에 안면인식을 쓸 수 있나요?' },
    { id: 'forbid', label: '금지 조건', hint: '어떤 경우에는 쓰면 안 되나요?' },
    { id: 'fairness', label: '공정성 보호', hint: '특정 집단이 불이익을 받지 않게 하려면?' },
    { id: 'privacy', label: '개인정보 보호', hint: '얼굴 정보는 어떻게 다뤄야 하나요?' },
    { id: 'remedy', label: '권리 구제', hint: '오류로 피해를 입은 사람은 어떻게 도와야 하나요?' },
    { id: 'principle', label: '핵심 원칙 한 문장', hint: '세 안건에 모두 적용할 원칙을 한 문장으로 쓰세요.' }
  ];

  var REBUTTALS = {
    base: { label: '기본 반론', text: '정확도가 충분히 높고 오류를 고칠 수 있다면 모든 분야에 도입해도 될까?' },
    safety: { label: '생명 안전', text: '아이가 실종된 지 한 시간이 지났습니다. 사람의 생명이 걸려 있다면 사생활이 조금 침해되더라도 모든 공공장소에서 얼굴을 찾아야 하지 않을까?', draft: true },
    cost: { label: '비용', text: '보호 조치에는 예산과 인력이 듭니다. 예산이 부족하다면 보호 조치 없이 먼저 도입하고 나중에 고치는 편이 낫지 않을까?', draft: true },
    majority: { label: '다수결', text: '시민 대부분이 편리하다며 찬성합니다. 소수가 불편하더라도 다수가 원하면 도입해야 하지 않을까?', draft: true }
  };

  var REFLECTION_FIELDS = [
    { id: 'influence', label: '무엇이 판단에 가장 큰 영향을 주었나요?' },
    { id: 'change', label: '판단을 유지하거나 바꾼 이유는 무엇인가요?' },
    { id: 'accuracy', label: '정확도와 정당성은 어떤 관계라고 생각하나요?' },
    { id: 'right', label: '가장 지키고 싶었던 권리는 무엇인가요? 그 이유도 쓰세요.' }
  ];

  var RIGHTS = ['차별받지 않을 권리(평등권)', '개인정보자기결정권', '사생활의 비밀과 자유', '이동의 자유', '기회의 평등', '정보 접근권', '무죄 추정과 신체의 자유', '생명·신체의 안전'];

  var INTRO = [
    { text: '윤리시티 안전위원회에 오신 것을 환영합니다, {name} 위원님.', draft: true },
    { text: '시청이 세 분야에 AI 안면인식을 도입하려 합니다. 위원님은 안건마다 도입 여부를 심의하게 됩니다.', draft: true },
    { text: '안건마다 브리핑 → 데이터 분석 → 최초 판단 → 추가 정보 → 시민 인터뷰 → 정책 결과 시뮬레이터 → 최종 판단 순서로 진행해요.', draft: false },
    { text: '최초 판단은 확정하면 바꿀 수 없어요. 대신 최종 판단에서 생각을 바꿀 수 있어요. 정답이나 점수는 없습니다.', draft: true }
  ];

  var stories = {
    CHOICES: CHOICES, PROTECTIONS: PROTECTIONS, ASPECTS: ASPECTS, AGENDAS: AGENDAS,
    GUIDELINE_FIELDS: GUIDELINE_FIELDS, REBUTTALS: REBUTTALS, REFLECTION_FIELDS: REFLECTION_FIELDS, RIGHTS: RIGHTS, INTRO: INTRO
  };
  root.HR = root.HR || {};
  root.HR.Stories = stories;
  if (typeof module !== 'undefined' && module.exports) module.exports = stories;
})(typeof window !== 'undefined' ? window : globalThis);
