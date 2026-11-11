/*
 * 성찰 카드 — 화면(DOM)을 모르는 순수 로직. 브라우저와 Node(검사) 양쪽에서 쓴다. (2026-11-10)
 * ------------------------------------------------------------
 * 엔딩 뒤에 학생이 자기 선택을 돌아보고 PDF로 저장해 내는 카드. 화면 그리기·인쇄는 app.js, 문구는 story.js의 card.
 *   topics(story, E, run)  → 토픽 세 개: 게임이 채우는 "내 선택" 줄 + 학생이 쓰는 물음
 *   fileName(base, sid, name) → 인쇄하는 동안의 문서 제목 = 저장되는 PDF 이름(공유한순간_성찰카드_학번_이름)
 *   blank(run) / read(raw, run) / hasText(raw) → 이 기기 저장(ethicity.privacy.card.v1)의 모양·읽기·"쓴 글이 있나"
 * 저장 모양: { v: 1, ending: 'B', sig: '1a2b3c', sid: '20315', name: '김온유', answers: ['', '', ''] }
 *   ending·sig = 그 글을 쓴 진행(엔딩 코드 + 선택 경로 지문). 지금 진행과 다르면 답은 버리고 빈 카드로 — 다른 진행의 글이 섞이지 않게.
 * 어디로도 보내지 않는다. 공통 키(ethicity.player·ethicity.result.privacy)는 건드리지 않는다.
 */
(function (root) {
  'use strict';

  var KEY = 'ethicity.privacy.card.v1';
  var ANSWERS = 3;      // 쓰는 칸 수
  var MAX_TEXT = 200;   // 칸마다 글자 수(2~3문장 — 세 칸을 다 채워도 A4 한 장)
  var MAX_SID = 12, MAX_NAME = 20;

  function str(v) { return typeof v === 'string' ? v : ''; }
  // 한 줄 입력(학번·이름): 제어 문자·줄바꿈을 빼고 앞뒤 공백을 다듬어 max자까지
  function cleanLine(v, max) { return str(v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
  // 여러 줄 입력(답): 줄바꿈은 두고 다른 제어 문자만 뺀다
  function cleanText(v, max) { return str(v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').slice(0, max == null ? MAX_TEXT : max); }

  /* 인쇄용 답: 앞뒤 공백을 떼고 빈 줄을 없앤다. 줄바꿈은 3번까지(네 줄) — 그 뒤는 한 줄로 이어, 엔터만 잔뜩 쳐도 카드가 한 장을 넘지 않게 */
  var PRINT_LINES = 4;
  function printText(v) {
    var lines = cleanText(v).split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    if (lines.length > PRINT_LINES) lines = lines.slice(0, PRINT_LINES - 1).concat(lines.slice(PRINT_LINES - 1).join(' '));
    return lines.join('\n');
  }

  /* 파일 이름 조각: 파일 이름에 쓸 수 없는 글자(\ / : * ? " < > |)·제어 문자·공백 → '_', 겹친 '_'는 하나로, 앞뒤의 '_'와 점은 뗀다 */
  function safePart(v, max) {
    return str(v).replace(/[\\/:*?"<>|\u0000-\u001f\u007f\s]+/g, '_').replace(/_+/g, '_').replace(/^[_.]+|[_.]+$/g, '').slice(0, max).replace(/[_.]+$/g, '');
  }
  // 공유한순간_성찰카드_{학번}_{이름}. 비어 있는 칸은 건너뛴다(막지는 않는다 — 화면에서 채우라고 안내만)
  function fileName(base, sid, name) {
    return [safePart(base, 40) || '성찰카드', safePart(sid, MAX_SID), safePart(name, MAX_NAME)].filter(Boolean).join('_');
  }

  // 진행 지문: 이번 진행에서 고른 것들(장면#선택)의 짧은 해시. 같은 엔딩 코드라도 다른 진행이면 달라진다
  function sig(run) {
    var s = ((run && run.history) || []).map(function (h) { return h.scene + '#' + h.choice; }).join('>') + '|' + ((run && run.ending) || '');
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function finished(run) { return !!(run && run.screen === 'ending' && run.ending); }

  function blank(run) {
    var a = []; for (var i = 0; i < ANSWERS; i++) a.push('');
    return { v: 1, ending: finished(run) ? run.ending : null, sig: finished(run) ? sig(run) : null, sid: '', name: '', answers: a };
  }
  /* 저장된 값(raw, 아무 모양이나 올 수 있다) → 지금 진행(run)에 쓸 카드.
   *   모양이 틀리면 빈 카드. 다른 진행의 것이면(stale) 답·이름·학번 모두 버린다(공용 PC). */
  function read(raw, run) {
    var c = blank(run);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.v !== 1) return { card: c, stale: false, found: false };
    if (!finished(run) || raw.ending !== c.ending || raw.sig !== c.sig) return { card: c, stale: true, found: true };
    c.sid = cleanLine(raw.sid, MAX_SID);
    c.name = cleanLine(raw.name, MAX_NAME);
    if (Array.isArray(raw.answers)) for (var i = 0; i < ANSWERS; i++) c.answers[i] = cleanText(raw.answers[i]);
    return { card: c, stale: false, found: true };
  }
  // 새로 시작하기 전에 물어볼지: 답 칸에 쓴 글이 하나라도 있나(이름·학번만 있으면 묻지 않고 지운다)
  function hasText(raw) {
    return !!(raw && typeof raw === 'object' && Array.isArray(raw.answers) && raw.answers.some(function (a) { return typeof a === 'string' && a.trim().length > 0; }));
  }

  /* 토픽 세 개(문구 = story.card.topics): 게임이 채우는 줄(items) + 물음(q)
   *   events + pick   → 사건마다 결과 문장을 pick[사건]줄까지(없으면 1줄). 더 많으면 앞의 것들 + 마지막 한 줄 — 첫 행동과 마지막 대응이 남는다
   *                     (예: 사진 사건 = 찍기 / 올리기 / 지우기·거절). 문장은 엔딩 화면 「사건별 결과」와 같다. 2026-11-12 외부 검토 3번
   *   events + first  → 사건마다 결과 문장의 첫 줄(옛 방식)
   *   events          → 그 사건들의 결과 문장 모두
   *   plan            → 「우리 반이 정한 AI CCTV 안」 줄(특별 수업을 하지 않은 옛 진행이면 items 없음 + empty 문구)
   * 선택 문장에는 평가를 붙이지 않는다. 강조 기호 [[ ]]는 뺀다. */
  function plainText(t) { return str(t).replace(/\[\[|\]\]/g, ''); }
  function pickLines(outs, n) {
    if (outs.length <= n) return outs;
    return n <= 1 ? outs.slice(0, 1) : outs.slice(0, n - 1).concat(outs.slice(-1));
  }
  function topics(story, E, run) {
    var def = (story.card && story.card.topics) || [];
    return def.map(function (t, i) {
      var items = [];
      if (t.plan) {
        E.specialClassRows(story, run).forEach(function (r) { items.push({ head: r.label, text: r.text }); });
      } else {
        (t.events || []).forEach(function (e) {
          if (!story.events[e]) return;
          var outs = E.eventOutcomes(story, e, run);
          (t.pick ? pickLines(outs, t.pick[e] || 1) : t.first ? outs.slice(0, 1) : outs).forEach(function (text, k) { items.push({ head: k === 0 ? story.events[e].title : '', text: plainText(text) }); });
        });
      }
      return { n: i + 1, id: t.id, title: t.title, label: t.label || story.card.autoLabel, items: items, empty: items.length ? '' : (t.empty || ''), q: t.q };
    });
  }

  var api = { KEY: KEY, ANSWERS: ANSWERS, MAX_TEXT: MAX_TEXT, MAX_SID: MAX_SID, MAX_NAME: MAX_NAME,
    cleanLine: cleanLine, cleanText: cleanText, printText: printText, safePart: safePart, fileName: fileName, sig: sig, finished: finished,
    blank: blank, read: read, hasText: hasText, topics: topics };
  root.PrivacyCard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
