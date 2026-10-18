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
 *   {wait}  지금까지 기다린 분  {diff}  이전 단계와의 대기 차이(분)  {change} ‘줄었’ 또는 ‘늘었’
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
        { minWait: 15, text: '지금까지 {wait}분 기다렸어요.', draft: true },
        { minWait: 30, text: '벌써 {wait}분째 기다리고 있어요.', draft: true }
      ],
      full: { text: '버스가 꽉 차서 다음 버스를 기다려요.', draft: true },
      transfer: { text: '여기서 한 번 갈아타야 해요.', draft: true },
      arrive: { text: '{stop}에 도착했어요.', draft: true }
    },

    // 주민 이야기 — 위에서부터 처음 맞는 조건 하나를 쓴다. 맞는 게 없으면 any.change → any.current
    residents: {
      haneul: {
        'haneul.waitDropped': { text: '학기 초, 하늘은 정류장에서 오래 기다렸습니다. 마지막 운행에서는 기다리는 시간이 조금 짧아졌습니다. 학교로 가는 같은 길에서, 달라진 것은 버스를 기다리는 시간이었습니다.', draft: false }
      },
      narae: {
        'narae.nowArrives': { text: '처음 운행이 끝났을 때, 나래의 이동은 아직 끝나지 않았습니다. 최근 두 번의 운행에서는 병원·공공서비스 정류장에 도착했습니다. 지도에 그은 노선은 나래가 실제로 탈 수 있는 길이 되었습니다.', draft: false }
      },
      jun: {
        'jun.waitDropped': { text: '학기 초, 준은 일자리 단지 정류장에서 오래 기다렸습니다. 마지막 운행에서는 기다리는 시간이 조금 짧아졌습니다.', draft: true },
        'jun.steady': { text: '준은 운행이 있던 모든 단계에서 중앙역에 도착했습니다. 매번 같은 길이었고, 매번 도착했습니다.', draft: true }
      },
      sol: {
        'sol.neverBoarded': { text: '새로 생긴 동네에도 버스를 기다리는 사람이 있었습니다. 마지막 운행이 끝났을 때, 솔은 아직 타지 못했습니다. 다음 노선을 그릴 때 기억할 정류장이 남았습니다.', draft: false },
        'sol.ridingAtEnd': { text: '새로 생긴 동네에도 버스를 기다리는 사람이 있었습니다. 마지막 운행이 끝났을 때, 솔은 아직 목적지에 도착하지 못했습니다. 다음 노선을 그릴 때 기억할 정류장이 남았습니다.', draft: false }
      },
      any: {
        'any.change': { text: '{name}{은는} 이번 단계에 {stop} 정류장에 도착했고, 이전 단계보다 대기가 {diff}분 {change}어요.', draft: false },
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
