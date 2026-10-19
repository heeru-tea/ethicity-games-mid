/*
 * 결말 — 짧은 주민 이야기부터, 수치 근거는 ‘운행 기록 보기’에서 펼친다.
 * 단일 승패·도덕 점수 대신 생활권별 변화(사실 기반 소제목)와 기록을 보여 준다.
 */
(function (root) {
  'use strict';
  var PB = root.PB, cfg = PB.config, M = PB.Metrics, S = PB.Session, N = PB.Narrative;
  var UI = PB.UI = PB.UI || {};
  var $ = function (s) { return document.querySelector(s); };
  var GOAL = { profit: '수익', time: '이동 시간', reach: '소외 지역 연결' };
  var ACTION = { accept: '수락', modify: '받아서 고침', reject: '거절' };
  var STATUS = { arrived: '도착', riding: '버스 안', transfer: '갈아타는 중', waiting: '아직 타지 못함' };

  function app() { return PB.App; }
  function el(t, a, x) { return app().el(t, a, x); }

  function residentCard(App, story) {
    var c = el('article', { 'class': 'card resident-card', 'data-id': story.residentId, 'aria-labelledby': 'res-' + story.residentId });
    var head = el('div', { 'class': 'resident-head' });
    var face = el('div', { 'class': 'face', 'aria-hidden': 'true' });
    var img = el('img', { src: 'assets/art/portrait-' + story.residentId + '-calm.webp', alt: '' });
    img.addEventListener('error', function () { face.textContent = story.name; img.remove(); });
    if(story.residentId==='yuna'||story.residentId==='daeun')face.textContent=story.name;else face.appendChild(img);
    head.appendChild(face);
    var rd = cfg.residents.filter(function (r) { return r.id === story.residentId; })[0];
    var t = el('div');
    t.appendChild(el('h3', { id: 'res-' + story.residentId }, story.role + ' ' + story.name));
    var lastRecord=story.evidence[story.evidence.length-1];
    t.appendChild(el('p', { 'class': 'note' }, rd.itineraries?App.nodeName(lastRecord.o)+' → '+App.nodeName(lastRecord.d)+' → '+App.nodeName(lastRecord.finalDestination):App.nodeName(rd.o) + ' → ' + App.nodeName(rd.d)));
    head.appendChild(t);
    c.appendChild(head);
    c.appendChild(el('p', null, story.text));
    c.appendChild(el('p', { 'class': 'closing' }, story.closing));
    var d = el('details');
    d.appendChild(el('summary', null, story.name + '의 운행 기록'));
    var rows = story.evidence.map(function (e) {
      return [e.phase + '단계', e.dayStatus?(e.multiStop?{complete:'일정 완료',returnIncomplete:'마지막 이동 미완료',outboundIncomplete:'첫 목적지 미도착'}:{complete:'왕복 완료',returnIncomplete:'귀가 미완료',outboundIncomplete:'외출 미완료'})[e.dayStatus]:STATUS[e.status], App.duration(e.waitTotal), e.arriveT != null ? App.clock(e.arriveT)+(e.homeT!=null?' / 최종 '+App.clock(e.homeT):'') : '-', e.transfer ? '한 번' : '-'];
    });
    d.appendChild(UI.table(['단계', '상태', '기다린 시간', '도착 시각', '환승'], rows));
    if (story.drop != null) d.appendChild(el('p', { 'class': 'note' }, '처음 ' + story.evidence[0].waitTotal + '초 → 마지막 ' + story.evidence[story.evidence.length - 1].waitTotal + '초, ' + story.drop + '초 줄었어요.'));
    c.appendChild(d);
    return c;
  }

  function records(App, sum) {
    var sec = el('section', { id: 'records', 'aria-labelledby': 'rec-h' });
    sec.hidden = true;
    sec.appendChild(el('h3', { id: 'rec-h' }, '운행 기록'));
    var ul = el('ul', { 'class': 'plain' });
    Object.keys(sum.zones).forEach(function (z) {
      var zs = sum.zones[z], sub = zs.subtitle, li = el('li', { 'class': 'zone-subtitle' });
      li.appendChild(el('b', null, App.nodeName(z) + '(' + z + '): ' + N.zoneSubtitleText(sub.kind)));
      var obs = zs.history.filter(function (h) { return h.N > 0; });
      var detail = sub.firstPhase == null ? ' — 요청 없음' :
        ' — ' + sub.firstPhase + '~' + sub.lastPhase + '단계 관측 · 도착률 ' + M.fmtRate(sub.first) + ' → ' + M.fmtRate(sub.last) +
        ' · 마지막 최장 대기 ' + App.duration(obs[obs.length - 1].maxWait);
      li.appendChild(document.createTextNode(detail));
      ul.appendChild(li);
    });
    sec.appendChild(ul);
    sec.appendChild(el('p', { 'class': 'note' }, '소제목 기준(게임 조정값): 마지막 두 관측 단계 모두 도착률 80% 이상·최장 대기 180분 이하면 “비교적 안정적”, 첫 관측보다 15%p 이상 오르면 “개선이 이어지는 중”.'));

    var heads = ['생활권'].concat(cfg.phases.map(function (p, i) { return (i + 1) + '단계'; })).concat(['마지막 신뢰']);
    var rows = Object.keys(sum.zones).map(function (z) {
      var h = sum.zones[z].history;
      return [App.nodeName(z) + '(' + z + ')'].concat(h.map(function (x) { return x.N ? M.fmtRate(x.rate) : '-'; })).concat([h.length && h[h.length - 1].trust != null ? String(h[h.length - 1].trust) : '-']);
    });
    sec.appendChild(el('h4', null, '단계별 도착률'));
    sec.appendChild(UI.table(heads, rows));

    sec.appendChild(el('h4', null, '재정'));
    var fr = sum.finance.perPhase.map(function (k, i) { return [(i + 1) + '단계', App.won(k.fare), App.won(-(k.holding + k.op + k.move)), App.won(k.total)]; });
    sec.appendChild(UI.table(['단계', '운임', '비용', '손익(지원금 포함)'], fr, ['누적 잔액', '', '', App.won(sum.finance.balance)]));
    sec.appendChild(el('p', { 'class': 'note' }, cfg.phases.length+'개 대표 운행 창의 합계예요. 한 학기 전체 결산이 아니에요.'));

    sec.appendChild(el('h4', null, 'AI 목표 선택 이력'));
    var gl = el('ul', { id: 'goal-history' });
    for (var p = 1; p <= cfg.phases.length; p++) {
      var g = sum.goalHistory.filter(function (x) { return x.phase === p; })[0];
      gl.appendChild(el('li', null, p + '단계: ' + (g && g.goal ? GOAL[g.goal] + ' — ' + (ACTION[g.action] || '제안을 보고 직접 계획') : '목표를 고르지 않음')));
    }
    sec.appendChild(gl);

    sec.appendChild(el('label', { 'for': 'next-change', 'class': 'h-small' }, '다음 운영에서 바꾸고 싶은 점(선택)'));
    sec.appendChild(el('textarea', { id: 'next-change', rows: '3', 'class': 'textarea' }));
    return sec;
  }

  UI.ending = function (App, panel) {
    var s = App.s, sum = S.endingSummary(s);
    cfg=s.config;
    var reactions=N.endingReactions(s.config,s.history),conclusion=N.endingConclusion(reactions,s.history);
    function showReactions(){PB.Cutscene.play('ending',function(){$('#btn-records').focus();},reactions.concat(conclusion));}
    if (App._resultFor !== s) {
      App._resultFor = s;
      var counts = { stable: 0, improving: 0, remaining: 0 };
      Object.keys(sum.zones).forEach(function (z) { if (sum.zones[z].subtitle.firstPhase != null) counts[sum.zones[z].subtitle.kind]++; });
      PB.Storage.writeResult('이번 정류장은… · 생활권 안정 ' + counts.stable + ' · 개선 중 ' + counts.improving + ' · 과제 ' + counts.remaining);
    }
    panel.appendChild(el('p', { 'class': 'eyebrow' }, '학기 말 — 마무리'));
    panel.appendChild(el('h2', null, '한 학기 운행이 끝났어요'));
    if (App.player) {
      var who = el('p', { id: 'end-player', 'class': 'player-name' });
      who.textContent = App.player.nickname + ' 운영자님의 기록';
      panel.appendChild(who);
    }
    panel.appendChild(el('p', {id:'ending-verdict','class':'outcome-lead'}, conclusion.verdict));
    panel.appendChild(el('p', {id:'ending-profit'}, '총 수익 '+App.won(conclusion.profit)+' · 지원금 포함 누적 손익'));
    var families=s.history.reduce(function(a,h){var f=h.metrics.families;if(f){a.total+=f.total;a.complete+=f.complete;}return a;},{total:0,complete:0});
    if(families.total)panel.appendChild(el('p',{id:'ending-families'},'호수공원 가족 일정 '+families.total+'팀 중 '+families.complete+'팀 전원 방문·귀가 완료'));
    panel.appendChild(el('button',{type:'button',id:'btn-ending-replay','class':'btn',onclick:showReactions},'인물 반응 다시 보기'));
    panel.appendChild(el('p', null, '주요 인물의 이동부터 돌아봐요. 이야기는 실제 운행 기록에서만 만들어졌어요.'));
    cfg.residents.forEach(function (rd) {
      var story = N.residentStory(sum.residents[rd.id], rd.id, s.config);
      if (story) panel.appendChild(residentCard(App, story));
    });
    var btn = el('button', { type: 'button', 'class': 'btn', id: 'btn-records', 'aria-expanded': 'false', 'aria-controls': 'records', onclick: function () {
      var r = $('#records'); r.hidden = !r.hidden; btn.setAttribute('aria-expanded', String(!r.hidden)); if (!r.hidden) $('#rec-h').focus();
    } }, '운행 기록 보기');
    panel.appendChild(btn);
    var rec = records(App, sum);
    rec.querySelector('#rec-h').setAttribute('tabindex', '-1');
    panel.appendChild(rec);

    var rf = el('section', { id: 'reflection', 'aria-labelledby': 'refl-h' });
    rf.appendChild(el('h3', { id: 'refl-h' }, '생각해 보기'));
    rf.appendChild(el('p', { 'class': 'note' }, '답은 선택이에요. 이 창에만 남고 저장·전송되지 않아요.'));
    PB.stories.reflection.forEach(function (q, i) {
      rf.appendChild(el('label', { 'for': 'refl-' + i }, (i + 1) + '. ' + q));
      rf.appendChild(el('textarea', { id: 'refl-' + i, rows: '3', 'class': 'textarea' }));
    });
    panel.appendChild(rf);
    panel.appendChild(el('p', { id: 'end-seed', 'class': 'note' }, '사건 세팅: ' + (s.mode === 'random' ? '랜덤' : s.mode === 'fixed' ? '지정' : '기본') + ' ' + s.seed + ' · 시나리오 ' + cfg.SCENARIO_VERSION));
    panel.appendChild(el('button', { type: 'button', 'class': 'btn', id: 'btn-restart', onclick: function () { $('#confirm-restart').showModal(); } }, '처음부터 다시'));
    if(!s.endingReactionsShown){s.endingReactionsShown=true;showReactions();}
    return {};
  };
})(window);
