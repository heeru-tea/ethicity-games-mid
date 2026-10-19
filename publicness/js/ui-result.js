/*
 * 결과 화면 — 예상과 실제를 한 카드에 나눠 보이고, 모든 생활권 표·재정·주민 반응을 원자료와 함께 보여 준다.
 * 단계마다 수요·사건이 다를 수 있으므로 차이를 전부 노선 변경 탓으로 말하지 않는다.
 */
(function (root) {
  'use strict';
  var PB = root.PB, cfg = PB.config, M = PB.Metrics, S = PB.Session;
  var UI = PB.UI = PB.UI || {};

  function app() { return PB.App; }
  function el(t, a, x) { return app().el(t, a, x); }
  function table(headers, rows, foot) {
    var t = el('table'), th = el('thead'), tr = el('tr');
    headers.forEach(function (h) { tr.appendChild(el('th', { scope: 'col' }, h)); });
    th.appendChild(tr); t.appendChild(th);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var row = el('tr');
      r.forEach(function (c, i) { row.appendChild(el(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row' } : null, c)); });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    if (foot) {
      var tf = el('tfoot'), fr = el('tr');
      foot.forEach(function (c, i) { fr.appendChild(el(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row' } : null, c)); });
      tf.appendChild(fr); t.appendChild(tf);
    }
    var w = el('div', { 'class': 'table-wrap' }); w.appendChild(t);
    return w;
  }
  UI.table = table;
  function residentCard(App,rd,r,t){
    var data=PB.Narrative.residentResult(rd,r,App.s.current.result.passengers,App.s.config.bus.window);
    var li=el('li',{'data-resident':rd.id}),card=el('details',{'class':'resident-card'}),head=el('summary');
    var face=el('span',{'class':'resident-face '+rd.id,'aria-hidden':'true'});
    face.appendChild(el('img',{src:'assets/art/'+(['yuna','daeun'].indexOf(rd.id)>=0?'interlude-cheer.png':'portrait-'+rd.id+'-calm.png'),alt:'',loading:'lazy'}));
    head.appendChild(face);var words=el('span',{'class':'resident-identity'});words.appendChild(el('strong',null,rd.name));
    words.appendChild(el('span',{'class':'resident-state '+(data.complete?'complete':'incomplete')},(data.complete?'✓ ':'○ ')+data.label));head.appendChild(words);
    head.appendChild(el('span',{'class':'resident-expand','aria-hidden':'true'},'＋'));card.appendChild(head);
    var body=el('div',{'class':'resident-journey'});
    data.legs.forEach(function(leg){body.appendChild(el('p',{'class':'journey-leg'},(leg.state==='도착'?'✓ ':leg.state==='미도착'?'✕ ':'— ')+App.nodeName(leg.o)+' → '+App.nodeName(leg.d)+' · '+leg.state));});
    if(data.reason)body.appendChild(el('p',{'class':'journey-reason'},data.reason));
    if(t)body.appendChild(el('p',{'class':'note'},'엔딩 기준 · 누적 '+t.completed+'/'+t.threshold+'회'+(t.completed>=t.threshold?' · 기준 달성':' · 남은 '+t.remaining+'단계')));
    var times=el('details',{'class':'resident-times'});times.appendChild(el('summary',null,'도착 시각 기록'));
    times.appendChild(el('p',{'class':'note'},'첫 도착 '+(r.arriveT!=null?App.clock(r.arriveT):'미도착')+' · 최종 도착 '+(r.homeT!=null?App.clock(r.homeT):'미도착')));body.appendChild(times);card.appendChild(body);
    var pinned=false;
    head.addEventListener('click',function(e){e.preventDefault();pinned=!pinned;card.open=pinned;});
    card.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse'&&matchMedia('(hover: hover)').matches)card.open=true;});
    card.addEventListener('pointerleave',function(){if(!pinned&&!card.contains(document.activeElement))card.open=false;});
    card.addEventListener('focusout',function(e){if(!pinned&&!card.contains(e.relatedTarget)&&!card.matches(':hover'))card.open=false;});
    card.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();pinned=false;card.open=false;head.focus();}});
    li.appendChild(card);return li;
  }
  function showRouteReport(App){
    var s=App.s,dialog=document.querySelector('#route-report');
    if(!dialog){dialog=el('dialog',{id:'route-report','aria-labelledby':'route-report-title'});document.body.appendChild(dialog);}
    dialog.textContent='';
    dialog.appendChild(el('p',{'class':'eyebrow'},s.phase+'단계 · 23:00 운행 종료'));
    dialog.appendChild(el('h2',{id:'route-report-title'},'오늘 노선은 얼마나 쓰였을까요?'));
    var rows=M.routeReport(s.current.result,S.routesInOrder(s),s.draft.buses);
    dialog.appendChild(table(['노선','배정 차량','승차','최종 도착','대당 승차','만차 발생'],rows.map(function(r){return [r.num+'번',r.buses+'대',r.boardings+'회',r.arrived+'건',r.perBus==null?'미배정':r.perBus+'회',r.fulls+'회'];})));
    dialog.appendChild(el('p',{'class':'note'},'승차는 환승을 포함한 횟수예요. 최종 도착은 목적지에서 내린 마지막 노선에만 기록해요. 만차 발생은 정류장에서 승객을 남긴 횟수이며, 같은 사람이 여러 번 기다릴 수 있어요.'));
    dialog.appendChild(el('p',{'class':'callout'},'대당 승차가 적어도 누군가에게 꼭 필요한 노선일 수 있어요. 아래의 주민별 이동 결과도 함께 살펴보세요.'));
    dialog.appendChild(el('button',{type:'button',id:'btn-route-report-close','class':'btn btn-primary',onclick:function(){dialog.close();}},'주민별 결과 살펴보기'));
    if(!dialog.open)dialog.showModal();
  }

  UI.result = function (App, panel) {
    document.querySelector('#stage-overlay').textContent='';
    var s = App.s, h = s.history[s.history.length - 1], m = h.metrics, e = h.expected;
    cfg=s.config;
    panel.appendChild(el('p', { 'class': 'eyebrow' }, h.phase + '단계 · ' + cfg.phases[h.phase - 1] + ' — 결과'));
    panel.appendChild(el('h2', null, '운행이 끝났어요'));
    panel.appendChild(el('button',{type:'button','class':'btn',id:'btn-route-report',onclick:function(){showRouteReport(App);}},'노선별 효율 다시 보기'));
    if(m.families&&m.families.total)panel.appendChild(el('p',{id:'family-result','class':'callout'},'호수공원 가족 나들이 · '+m.families.total+'팀 중 '+m.families.complete+'팀이 전원 방문·귀가를 마쳤어요. 가족 중 한 명이라도 이동을 마치지 못하면 그 팀의 일정은 미완료예요.'));
    var summary=el('section',{id:'resident-summary'});
    summary.appendChild(el('p',{'class':'outcome-lead'},m.N+'명 중 '+m.arrived+'명이 목적지에 도착했어요.'));
    if(s.config.day){
      summary.firstChild.textContent='발생한 이동 요청 '+m.N+'건 중 '+m.arrived+'건이 목적지에 도착했어요.';
      summary.appendChild(el('h3',null,'오늘, 주민들의 이동은'));
      summary.appendChild(el('p',{'class':'note'},'얼굴에 마우스를 올리거나 눌러 이동 코스를 확인하세요. 키보드로는 Enter로 열고 Esc로 닫을 수 있어요.'));
      var days=el('ul',{id:'resident-day-results','class':'resident-cards'}),tally=PB.Narrative.residentTally(s.config,s.history);
      PB.Demand.residents(s.config,s.phase).forEach(function(rd){var r=h.residents[rd.id],t=tally[rd.id];if(!r)return;
        days.appendChild(residentCard(App,rd,r,t));
      });summary.appendChild(days);
      summary.appendChild(el('p',{'class':'note'},'주요 인물의 다음 이동은 첫 목적지에 도착하고 체류 시간을 채운 뒤 생겨요. 한 일정은 이동 요청 두 건이며, 나머지 승객의 개인 일정은 추적하지 않아요.'));
    }
    var outcomes=el('ul',{'class':'resident-outcomes'});
    var reasons=PB.Sim.unfinishedReasons(s.current.result);
    Object.keys(reasons).forEach(function(id){
      var g=reasons[id],li=el('li'),parts=[];
      if(g.noLink)parts.push('탈 수 있는 노선 없음 '+g.noLink+'명');
      if(g.full)parts.push('만차로 못 탄 경험이 있는 미도착 '+g.full+'명');
      if(g.time)parts.push('운행 종료까지 대기·이동 중 '+g.time+'명');
      var b=el('button',{type:'button','class':'btn reason-location','data-origin':id,onclick:function(){
        App.view.setSelected([id]);App.view.flash(id);
        document.querySelector('#reason-focus').textContent=App.nodeName(id)+' 출발 정류장을 지도에 표시했어요. '+parts.join(' · ');
        document.querySelector('#stage').dataset.reasonOrigin=id;
      }},App.nodeName(id)+' · 미도착 '+(g.noLink+g.full+g.time)+'명 — 지도에서 보기');
      li.appendChild(b);li.appendChild(el('p',{'class':'note'},parts.join(' · ')));outcomes.appendChild(li);
    });
    if(!outcomes.children.length)outcomes.appendChild(el('li',null,'모든 지역의 요청이 목적지에 도착했어요.'));
    summary.appendChild(outcomes);summary.appendChild(el('p',{id:'reason-focus',role:'status','class':'note'},'지역을 누르면 출발 정류장을 지도에서 확인할 수 있어요. 만차 경험은 지연의 단서이며 유일한 원인이라는 뜻은 아니에요.'));summary.appendChild(el('p',{'class':'note'},'가장 긴 기다림 '+App.duration(m.maxWait)+' · 다음 운행에서 바꿀 노선을 떠올려 보세요.'));panel.appendChild(summary);
    var details=el('details',{id:'result-details'});details.appendChild(el('summary',null,'전체 통계와 재정 보기'));panel.appendChild(details);

    // 사건
    if (h.event && h.event.type === 'demand') {
      var od = PB.Demand.directional(cfg, h.phase)[h.event.odIndex];
      panel.appendChild(el('p', { 'class': 'callout' }, App.clock(h.event.t) + '에 ' + App.nodeName(od.o) + '→' + App.nodeName(od.d) + ' 요청이 12건 늘었어요(추가 수요).'));
    }
    if (h.petition) panel.appendChild(el('p', { 'class': 'callout warn' }, App.clock(h.petition.t) + ' ' + App.nodeName(h.petition.zone) + ' 주민 청원: 그때까지 요청 ' + h.petition.total + '건 중 ' + h.petition.count + '명이 아직 도착하지 못했어요.'));

    // 예상과 실제
    var cmp = el('section', { id: 'result-compare', 'class': 'card' });
    cmp.appendChild(el('h3', null, '예상과 실제'));
    var row = function (name, f) { return [name, f(e), f(m)]; };
    cmp.appendChild(table(['', '예상', '실제'], [
      row('요청', function (x) { return x.N + '건'; }),
      row('도착', function (x) { return x.arrived + '명 (' + M.fmtRate(x.arrivalRate) + ')'; }),
      row('최장 대기', function (x) { return App.duration(x.maxWait); }),
      row('이번 단계 손익', function (x) { return App.won(x.costs.total); }),
      row('대학교·병원 도착률', function (x) { return M.fmtRate(x.essential.arriveRate); })
    ]));
    var notes = ['예상은 추가 사건 없는 기본 수요 기준이에요.'];
    if (m.N !== e.N) notes.push('실제 요청 수는 예상과 '+Math.abs(m.N-e.N)+'건 달라요. 추가 사건과 실제 도착에 따른 귀가 요청이 반영돼요.');
    notes.push('단계마다 수요와 사건이 달라서, 차이를 모두 노선 변경의 효과로 볼 수는 없어요.');
    cmp.appendChild(el('p', { 'class': 'note' }, notes.join(' ')));
    details.appendChild(cmp);

    // 생활권 표
    var zs = el('section', { 'aria-labelledby': 'zone-h' });
    zs.appendChild(el('h3', { id: 'zone-h' }, '출발 생활권별 결과'));
    var ids = Object.keys(m.zones);
    var rows = ids.map(function (id) {
      var z = m.zones[id];
      return [App.nodeName(id) + '(' + id + ')', String(z.N), String(z.arrived), String(z.waiting), String(z.transfer), String(z.riding),
        M.fmtRate(z.rate), z.N ? App.duration(z.maxWait) : '-', z.D == null ? '-' : String(z.D),
        (h.trustBefore[id] != null ? h.trustBefore[id] : cfg.trust.initial) + '→' + h.trustAfter[id]];
    });
    var tbl = table(['생활권', '요청', '도착', '미탑승', '환승 중', '탑승 중', '도착률', '최장 대기', '불만', '신뢰'], rows,
      ['합계', String(m.N), String(m.arrived), String(m.waiting), String(m.transfer), String(m.riding), M.fmtRate(m.arrivalRate), App.duration(m.maxWait), '', '']);
    tbl.querySelector('table').id = 'zone-table';
    zs.appendChild(tbl);
    zs.appendChild(el('p', { 'class': 'note' }, '전체 도착률은 인원 합으로 계산해요(생활권 비율의 평균이 아니에요). 불만·신뢰는 게임 반응을 위한 지수예요. 노선 연결률은 공식 공공성 지수가 아니에요.'));
    var extra = el('dl', { 'class': 'kv' });
    [['이용자(한 번 이상 탄 사람)', m.users + '명 / ' + m.N],
      ['승차 횟수(환승 포함)', m.boardings + '회'],
      ['요금 낸 미완료', m.costs.paidUnfinished + '명'],
      ['완료한 이동의 평균 소요', m.travel.doneAvg == null ? '-' : App.duration(m.travel.doneAvg)],
      ['미완료 이동의 관측 경과(운행 종료까지)', m.travel.openAvg == null ? '-' : App.duration(m.travel.openAvg)],
      ['대학교·병원 연결률 / 도착률', M.fmtRate(m.essential.linkRate) + ' / ' + M.fmtRate(m.essential.arriveRate)]
    ].forEach(function (kv) { extra.appendChild(el('dt', null, kv[0])); extra.appendChild(el('dd', null, kv[1])); });
    zs.appendChild(extra);
    details.appendChild(zs);

    // 주민
    var rs = el('section', { 'aria-labelledby': 'res-h' });
    rs.appendChild(el('h3', { id: 'res-h' }, '자주 보는 주민'));
    var ul = el('ul', { 'class': 'plain' });
    PB.Demand.residents(s.config,s.phase).forEach(function (rd) {
      var r = h.residents[rd.id];
      if (!r) return;
      var state = r.status === 'arrived' ? App.nodeName(rd.d) + '에 도착' : r.status === 'riding' ? '아직 버스 안' : r.status === 'transfer' ? '갈아타는 중' : (r.fail === 'NO_LINK' ? '탈 수 있는 노선 없음' : '아직 타지 못함');
      ul.appendChild(el('li', null, rd.role + ' ' + rd.name + '(' + rd.o + '→' + rd.d + '): ' + state + ' · 기다린 시간 ' + App.duration(r.waitTotal) + (r.transfer ? ' · 한 번 갈아탐' : '')));
    });
    rs.appendChild(ul);
    details.appendChild(rs);

    var bs = el('section', { 'aria-labelledby': 'bub-h' });
    bs.appendChild(el('h3', { id: 'bub-h' }, '운행 중 들린 말'));
    var bl = el('ul', { id: 'bubble-replay', 'class': 'feed' });
    PB.Narrative.bubbles(s.current.result, s.config, cfg.bus.window).forEach(function (b) {
      var who = b.residentId ? cfg.residents.filter(function (r) { return r.id === b.residentId; })[0].name : '주민';
      bl.appendChild(el('li', null, App.clock(b.t) + ' · ' + who + '(' + App.nodeName(b.node) + '): “' + b.text + '”'));
    });
    bs.appendChild(bl);
    var news=el('details');news.appendChild(el('summary',null,'운행 중 들린 말'));news.appendChild(bs);panel.appendChild(news);

    // 재정
    var fs = el('section', { id: 'finance', 'aria-labelledby': 'fin-h' });
    fs.appendChild(el('h3', { id: 'fin-h' }, '재정(가상원)'));
    var k = m.costs, bal = s.history.reduce(function (a, x) { return a + x.metrics.costs.total; }, 0);
    fs.appendChild(table(['항목', '금액'], [
      ['위탁 지원금', App.won(k.subsidy)], ['운임 수입', App.won(k.fare)], ['차량 보유비', App.won(-k.holding)],
      ['원격 관제·운영비', App.won(-k.op)], ['에너지·정비(이동)', App.won(-k.move)]
    ], ['이번 단계 손익', App.won(k.total)]));
    fs.appendChild(el('p', null, '누적 잔액: ' + App.won(bal)));
    if (bal < 0) fs.appendChild(el('p', { 'class': 'note' }, '잔액이 마이너스여도 운행과 다음 단계는 그대로 이어져요.'));
    details.appendChild(fs);

    var last = s.phase >= cfg.phases.length;
    panel.appendChild(el('button', { type: 'button', 'class': 'btn btn-primary btn-lg', id: 'btn-next-phase', onclick: function () {
      function advance(){S.nextPhase(s); App.go(s.stage === 'ending' ? 'ending' : 'reveal');if(s.stage!=='ending')App.showLearning();}
      if(last){advance();return;}
      var stage={number:s.phase+1,total:cfg.phases.length,name:cfg.phases[s.phase]};
      var kind=s.phase===2?'sol':s.phase===3&&s.config.residents.some(function(r){return r.id==='yuna';})?'baseball':'stage';
      PB.Cutscene.play(kind,advance,null,stage);
    } }, last ? '학기 마무리 보기' : (s.phase + 1) + '단계로'));
    if(!s.current.routeReportShown){s.current.routeReportShown=true;showRouteReport(App);}
    return {};
  };
})(window);
