/*
 * 강조 표시 — 이야기 글자 속 [[…]]를 굵은 글씨(<strong class="em">)로 그린다. 색은 그대로(2026-11-02 사용자 결정: 굵게만).
 *   쓰는 곳: 정보가 어디까지·몇 명에게·무엇이 보이게 됐는지(예: "[[28명 방에]] 사진이 올라갔다"). 장면당 1~2개, 선택지·내 말(say)에는 쓰지 않는다.
 *   PrivacyEmph.plain(s)               [[ ]]를 뺀 글자(화면 읽기·캔버스 말풍선·글자 비교용)
 *   PrivacyEmph.parts(s)               [{ text, strong }] 조각(짝이 맞는 [[…]]만 강조, 짝 없는 괄호는 글자 그대로)
 *   PrivacyEmph.render(el, s, from, to) el을 비우고 글자 조각(text node)과 <strong>으로 채운다.
 *                                        from~to = 보일 글자 범위(plain 기준, 글자 = 코드 포인트) — 타자 효과(typer.js)가 쓴다
 *   PrivacyEmph.safe(s)                [[ ]]가 강조로 읽히지 않게 막은 글자(플레이어 별명 등 바깥에서 온 글자 — 보기에는 같음)
 * 글자는 HTML로 해석하지 않는다(createTextNode·textContent만).
 */
(function (root) {
  'use strict';

  var MARK = /\[\[([\s\S]+?)\]\]/g;
  function chars(text) { return Array.from ? Array.from(text) : String(text).split(''); }

  function parts(s) {
    s = String(s == null ? '' : s);
    var out = [], last = 0, m;
    MARK.lastIndex = 0;
    while ((m = MARK.exec(s))) {
      if (m.index > last) out.push({ text: s.slice(last, m.index), strong: false });
      out.push({ text: m[1], strong: true });
      last = m.index + m[0].length;
    }
    if (last < s.length) out.push({ text: s.slice(last), strong: false });
    return out;
  }
  function plain(s) { return parts(s).map(function (p) { return p.text; }).join(''); }
  function has(s) { MARK.lastIndex = 0; return MARK.test(String(s == null ? '' : s)); }
  // 별명 같은 바깥 글자: 대괄호 둘 사이에 폭 없는 공백을 넣어 표시로 읽히지 않게
  function safe(s) { return String(s == null ? '' : s).replace(/\[(?=\[)/g, '[​').replace(/\](?=\])/g, ']​'); }

  function render(el, s, from, to) {
    el.textContent = '';
    var ps = parts(s), pos = 0;
    from = from == null ? 0 : from;
    to = to == null ? Infinity : to;
    ps.forEach(function (p) {
      var cs = chars(p.text), a = Math.max(from, pos), b = Math.min(to, pos + cs.length);
      if (b > a) {
        var t = cs.slice(a - pos, b - pos).join('');
        if (p.strong) { var st = document.createElement('strong'); st.className = 'em'; st.textContent = t; el.appendChild(st); }
        else el.appendChild(document.createTextNode(t));
      }
      pos += cs.length;
    });
    return el;
  }

  var API = { parts: parts, plain: plain, has: has, safe: safe, render: render };
  root.PrivacyEmph = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
