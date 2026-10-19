/*
 * 주민 문장 데이터 — 이 파일만 고치면 게임 속 말풍선·주민 이야기·결말 문구가 바뀐다.
 *
 * ■ 고치는 법
 *   - 문장(text)만 바꾸면 된다. 조건 이름(키)은 그대로 둔다.
 *   - draft: true  = Claude가 쓴 초안(검수 전). 선생님이 쓰거나 고친 문장은 draft: false 로 바꾼다.
 *   - 배포 전에 draft: true 가 남은 문장을 검수한다(README의 목록 참고).
 *
 * ■ 자리표시자 — 운행 기록에서 실제 값으로 채워진다
 *   {name}  주민 이름          {이가} {은는}  앞 낱말의 받침에 맞춰 ‘이/가’, ‘은/는’
 *   {stop}  목적지 정류장 이름  {zone}  출발 생활권 이름
 *   {wait}  지금까지 기다린 초  {diff}  이전 단계와의 대기 차이(초)  {change} ‘줄었’ 또는 ‘늘었’
 *   {count} 인원               {buses} 버스 수   {requests} 요청 수
 *
 * ■ 지킬 것 (PRD §10)
 *   - 기록에 있는 것만 말한다: 기다림·탑승·환승·도착. 아직 끝나지 않은 이동을 ‘실패’라고 부르지 않는다.
 *   - 운행 밖 삶의 결과(시험·일·몸 상태·인생의 변화 등)를 지어내지 않는다.
 *   - 미래를 예언하지 않는다(운행 중 말풍선은 그 시각까지의 사실만).
 */
(function (root) {
  'use strict';

  var stories = {
    learning: [
      {title:'병원비가 적으면 덜 아픈 걸까요?',text:'미국의 한 의료 알고리즘은 추가 도움이 필요한 환자를 고를 때 의료비를 기준으로 삼았어요. 2019년 연구에서는 이 방식이 더 아픈 흑인 환자를 추가지원 대상에서 놓치는 문제를 발견했어요.',question:'버스를 적게 타는 동네의 필요를 알려면 무엇을 더 살펴봐야 할까요?',source:'UC Berkeley',url:'https://news.berkeley.edu/2019/10/24/widely-used-health-care-prediction-algorithm-biased-against-black-people/'},
      {title:'안내문을 읽을 수 없다면?',text:'2025년 1월, 인도의 한 노동자 지원 사이트는 AI 번역으로 안내 언어를 4개에서 22개로 늘렸어요. 더 많은 사람이 자기 언어로 정보를 읽도록 하려는 시도예요.',question:'노선이 연결돼 있어도 버스를 이용하기 어려운 사람에게는 어떤 도움이 필요할까요?',source:'인도 정부',url:'https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=2093333&lang=2&reg=48'},
      {title:'강력한 컴퓨터도 나눠 써요',text:'유럽에는 공공 예산으로 기업과 연구자의 AI용 컴퓨터 이용을 돕는 사업이 있어요. 많은 자원을 쓰는 신청은 심사를 거쳐 이용 기회를 나눠요.',question:'버스가 늘어나도 모든 곳에 충분히 보낼 수 없다면, 어떤 기준으로 배치할까요?',source:'LUMI AI Factory',url:'https://lumi-ai-factory.eu/faq/'},
      {title:'“AI가 정했어요”면 충분할까요?',text:'핀란드 헬싱키시는 시에서 쓰는 AI의 작동 방식과 담당자를 시민에게 공개해요. 한 상담 챗봇은 핀란드어만 지원한다는 한계도 밝혀 두었어요.',question:'주민에게 노선 변경을 설명한다면, 어떤 기준과 한계를 알려야 할까요?',source:'헬싱키시 AI 등록부',url:'https://www.hel.fi/en/decision-making/information-on-helsinki/design-and-digitalisation/digital-helsinki/ai-in-the-city-of-helsinkis-services/ai-register'},
      {title:'카메라가 글자를 읽어 준다면',text:'마이크로소프트의 Seeing AI는 시각장애인을 위해 만든 무료 앱이에요. 휴대전화 카메라에 잡힌 글자를 읽어 주고 사진 속 모습을 말로 설명해 줘요.',question:'복지관에 가는 사람이 적더라도, 버스는 배치해야 할까요?',source:'Microsoft',url:'https://blogs.microsoft.com/accessibility/seeing-ai-app-launches-on-android-including-new-and-updated-features-and-new-languages/'},
      {title:'전체 기준에 내 사정도 담길까요?',subtitle:'AI와 함께 생각할 자동화 사례',text:'2020년 잉글랜드는 시험이 취소되자 학교의 과거 성적 등을 반영해 학생 성적을 계산했어요. 논란 끝에 학교 평가와 계산 성적 중 높은 것을 주기로 바꿨어요.',question:'많은 사람이 목적지에 도착해도 나들이를 못 가는 가족이 있다면, 무엇을 더 알아봐야 할까요?',source:'Ofqual 산정 방식 분석',url:'https://www.gov.uk/government/publications/evaluation-of-centre-assessment-grades-and-grading-gaps-in-summer-2020/grading-gaps-in-summer-2020-who-was-affected-by-differences-between-centre-assessment-grades-and-calculated-grades',extraSources:[{label:'결정 변경 발표',url:'https://www.gov.uk/government/news/statement-from-roger-taylor-chair-ofqual'}]},
      {title:'편리함을 만드는 데도 자원이 들어요',text:'데이터센터는 인터넷 서비스를 위해 컴퓨터를 모아 둔 시설이에요. 2024년 아일랜드에서는 이 시설들이 집계된 전기의 22%를 썼어요. AI만의 사용량은 아니에요.',question:'붐비는 곳에 버스를 더 보내 얻는 편리함과 늘어나는 운행 비용을 어떻게 비교할까요?',source:'아일랜드 중앙통계청',url:'https://www.cso.ie/en/releasesandpublications/ep/p-dcmec/datacentresmeteredelectricityconsumption2024/keyfindings/'}
    ],
    phaseEthics: [
      {title:'외곽 마을도 우리 마을',text:'승객이 적고 멀리 산다는 이유로 이동에서 빠지지 않았나요? 외곽 마을에서 볼일을 보고 돌아오는 길까지 살펴보세요.'},
      {title:'혼잡과 필수 이동 사이',text:'많이 타는 노선의 기다림을 줄이면서, 병원·대학교로 가는 사람들의 길도 챙겼나요? 효율과 일상에 필요한 이동을 함께 살펴보세요.'},
      {title:'새 주민과 기존 주민',text:'신도시에 새 길을 내면서 기존 주민의 이동은 놓치지 않았나요? 새로 온 사람과 먼저 살던 사람의 하루를 함께 살펴보세요.'},
      {title:'경기가 끝나도 이동은 계속',text:'운동장에 가는 길뿐 아니라 경기 후 친구 집과 터미널로 가는 길도 있나요? 낮에 잘 다니는 노선이 밤에도 필요한 이동을 잇는지 살펴보세요.'},
      {title:'적은 수요에도 필요한 길',text:'복지관 이용자가 적어도 어린이·노인에게 필요한 길을 마련했나요? 수송량과 수익만으로 놓치기 쉬운 방문·귀가를 살펴보세요.'},
      {title:'함께 누리는 나들이',text:'호수공원의 즐거움을 어느 동네 가족이나 누릴 수 있나요? 가족 전원이 방문하고 돌아올 수 있는지, 특히 외곽 마을의 길을 살펴보세요.'},
      {title:'몰리는 수요와 조용한 일상',text:'솔잎몰의 많은 승객을 태우느라 병원·복지관·외곽 마을의 길이 줄지 않았나요? 눈에 띄는 혼잡과 적은 사람의 필수 이동을 함께 살펴보세요.'},
      {title:'경계를 넘어도 이어지는 이동',text:'광역버스를 타는 정류장까지 모든 동네에서 갈 수 있나요? 대도시로 가는 빠른 길과 마을 안의 필수 이동, 저녁 귀가를 함께 살펴보세요.'}
    ],
    // 시작 화면 두 문장. line2는 기본 노선이 외곽 마을을 지나지 않을 때만 쓴다
    hook: {
      line1: { text: '버스 {buses}대, 이번 운행의 승차 요청 {requests}건.', draft: true },
      line2: { text: '그런데 지금 노선도에는 외곽 마을을 지나는 버스가 한 대도 없습니다.', draft: true },
      line2Served: { text: '이 버스로 누구의 이동부터 책임질까요?', draft: true }
    },

    // 운행 중 말풍선 — 그 시각까지 실제로 일어난 일만
    bubbles: {
      noLink: { text: '여기서 {stop}까지 가는 버스 노선이 없어요.', draft: true },
      wait: [
        { minWait: 15, text: '지금까지 {wait}초 기다렸어요.', draft: true },
        { minWait: 30, text: '벌써 {wait}초째 기다리고 있어요.', draft: true }
      ],
      full: { text: '버스가 꽉 차서 다음 버스를 기다려요.', draft: true },
      transfer: { text: '여기서 한 번 갈아타야 해요.', draft: true },
      arrive: { text: '{stop}에 도착했어요.', draft: true }
    },

    // 주민 이야기 — 위에서부터 처음 맞는 조건 하나를 쓴다. 맞는 게 없으면 any.change → any.current
    residents: {
      haneul: {
        'haneul.waitDropped': { text: '학기 초, 하늘은 정류장에서 오래 기다렸습니다. 마지막 운행에서는 기다리는 시간이 조금 짧아졌습니다. 대학교로 가는 같은 길에서, 달라진 것은 버스를 기다리는 시간이었습니다.', draft: false }
      },
      narae: {
        'narae.nowArrives': { text: '처음 운행이 끝났을 때, 나래의 이동은 아직 끝나지 않았습니다. 최근 두 번의 운행에서는 병원·공공서비스 정류장에 도착했습니다. 지도에 그은 노선은 나래가 실제로 탈 수 있는 길이 되었습니다.', draft: false }
      },
      jun: {
        'jun.waitDropped': { text: '학기 초, 준은 일자리 단지 정류장에서 오래 기다렸습니다. 마지막 운행에서는 기다리는 시간이 조금 짧아졌습니다.', draft: true },
        'jun.steady': { text: '준은 운행이 있던 모든 단계에서 기차역에 도착했습니다. 매번 같은 길이었고, 매번 도착했습니다.', draft: true }
      },
      sol: {
        'sol.neverBoarded': { text: '새로 생긴 동네에도 버스를 기다리는 사람이 있었습니다. 마지막 운행이 끝났을 때, 솔은 아직 타지 못했습니다. 다음 노선을 그릴 때 기억할 정류장이 남았습니다.', draft: false },
        'sol.ridingAtEnd': { text: '새로 생긴 동네에도 버스를 기다리는 사람이 있었습니다. 마지막 운행이 끝났을 때, 솔은 아직 목적지에 도착하지 못했습니다. 다음 노선을 그릴 때 기억할 정류장이 남았습니다.', draft: false }
      },
      any: {
        'any.change': { text: '{name}{은는} 이번 단계에 {stop} 정류장에 도착했고, 이전 단계보다 대기가 {diff}초 {change}어요.', draft: false },
        'any.current.arrived': { text: '{name}{은는} 마지막 운행에서 {stop} 정류장에 도착했어요.', draft: true },
        'any.current.open': { text: '{name}{은는} 마지막 운행이 끝났을 때 아직 {stop} 정류장에 도착하지 못했어요.', draft: true }
      }
    },

    // 주민 카드 마무리 — 안내 방송 형식으로 제목 「이번 정류장은…」을 완성한다
    closing: {
      arrived: { text: '이번 정류장은 {stop}입니다. {name}{이가} 내렸습니다.', draft: false },
      riding: { text: '{name}{은는} 아직 이 정류장으로 가는 중입니다.', draft: true },
      notBoarded: { text: '{name}{은는} 아직 이 정류장에 닿지 못했습니다.', draft: false }
    },

    // 생활권 결말 소제목 (PRD §10)
    subtitles: {
      stable: '최근 이동이 비교적 안정적',
      improving: '개선이 이어지는 중',
      remaining: '남은 이동 과제가 있음'
    },

    // 성찰 질문 (PRD §10, 응답은 선택·채점 없음)
    reflection: [
      '어떤 목표를 선택했고 실제 결과는 예상과 어떻게 달랐나요?',
      '누구의 이동이 좋아졌고 누구에게 과제가 남았나요?',
      '다음 학기에는 어떤 기준이나 정보를 더 고려하겠나요?'
    ]
  };

  root.PB = root.PB || {};
  root.PB.stories = stories;
  if (typeof module !== 'undefined' && module.exports) module.exports = stories;
})(typeof window !== 'undefined' ? window : globalThis);
