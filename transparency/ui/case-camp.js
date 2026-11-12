// 사건 4 「겨울 캠프 명단」(camp): 구청 AI의 선발 점수. 이 사건만의 그림·자료·후속 조사·누르기 처리.
// (구청에 묻기는 story의 asks가 있는 사건이면 궁금한 것 화면이 그린다 — ui/screens.js.)
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {D,S,esc,btn,send,actions,found,miss,screenCard}=UI;
 const C=D.cases.camp;

 // 사건 4: 공개 페이지(빈 칸 둘을 모두 누르기), 마을별 결과(합격 비율이 가장 낮은 마을), 기준표(‘?’ 줄을 열면 마무리 줄), 버스 쪽지(읽기)
 // 빈 칸은 누른 칸만 확인 표시가 붙고(S.opened의 'page:칸'), 둘을 다 눌러야 자료를 확인한 것이 된다. 이미 확인한 저장은 둘 다 표시.
 // ⚠ 칸의 class는 is-empty — 생각 정리 문장 틀의 빈칸 밑줄(.blank, 너비 3.2em)과 이름이 겹치면 버튼이 54px로 줄어든다(2026-11-12 고침).
 const blanks=C.page.rows.filter(r=>r.blank);
 function page(done){
  const row=r=>{
   const hit=r.blank&&(done||S.opened.has('page:'+r.id));
   const value=hit?`<mark>${esc(r.text)}</mark> <span class="cell-tag">${esc(C.checks[0].cellTag)}</span>`:esc(r.text);
   const label=`<span class="kv-k">${esc(r.k)}</span><span class="kv-v">${value}</span>`;
   return btn(label,'cell',`data-id="${r.id}"`,'record kv'+(r.blank?' is-empty':''));
  };
  return `<div class="document"><p class="doc-label">${esc(C.page.label)}</p><div class="records">${C.page.rows.map(row).join('')}</div></div>`;
 }
 function tableHead(T){
  return `<p class="doc-label">${esc(T.label)}</p><div class="score-headrow" aria-hidden="true">${T.head.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`;
 }
 function results(done){
  const T=C.results;
  const row=r=>{
   const label=`<span class="score-book">${done&&r.target?`<mark>${esc(r.name)}</mark>`:esc(r.name)}</span><span class="num">${r.apply}명</span><span class="num">${r.pass}명</span>`;
   return btn(label,'village',`data-id="${r.id}"`,'score-row open');
  };
  return `<div class="document score-table camp-table">${tableHead(T)}${T.rows.map(row).join('')}</div>`;
 }
 function criteria(done){
  const T=C.criteria;
  const all=done||T.rows.every(r=>S.opened.has(r.id));
  const cells=(r,show)=>{
   const name=r.hidden&&show?`<span class="hidden-row">${esc(r.name)}</span>`:r.hidden?'가린 항목':esc(r.name);
   return `<span class="score-book">${name}</span><span class="num">${show?r.w.toFixed(1):'?'}</span>`;
  };
  const row=r=>{
   const show=all||S.opened.has(r.id);
   // 모두 열면 버튼이 아니라 읽기만 하는 줄이 된다.
   if(all)return `<div class="score-row${r.top?' top':''}">${cells(r,true)}</div>`;
   const label=show?'':` aria-label="${r.hidden?'가린 항목':esc(r.name)} 비중 열기"`;
   return btn(cells(r,show),'crit',`data-id="${r.id}"${label}`,'score-row'+(show?' open':''));
  };
  const closing=all?`<p class="score-formula">${esc(T.done)}</p>`:'';
  return `<div class="document score-table crit-table">${tableHead(T)}${T.rows.map(row).join('')}${closing}</div>`;
 }

 // 버스 쪽지: 본문 크기의 자료 카드. 누를 곳이 없어 여는 것만으로 확인한 것이 된다(plain).
 function busNote(){
  const N=C.note;
  return `<div class="document note-card"><p class="doc-label">${esc(N.label)}</p>${N.lines.map(t=>`<p>${esc(t)}</p>`).join('')}</div>`;
 }

 // 사건 4: 예전 공개 페이지 · 새 공개 페이지(달라진 말 누르기)
 function followView({f,fs}){
  const done=fs.marks.changed==='found';
  const seg=x=>{
   if(done)return x.changed?`<mark>${esc(x.text)}</mark>`:esc(x.text);
   return btn(esc(x.text),'change',`data-id="${x.id}"`,'segment');
  };
  return `<div class="document compact"><p class="doc-label">${esc(f.oldLabel)}</p><p>${C.page.rows.map(r=>esc(r.k+': '+r.text)).join(' · ')}</p></div>`
   +`<div class="document"><p class="doc-label">${esc(f.newLabel)}</p><p class="segments">${f.segments.map(seg).join(' ')}</p></div>`;
 }

 UI.views.camp={
  // 마을 신문 1면
  stage:x=>({screen:screenCard(x)}),
  plain:['camp-bus'],
  evidence:{'camp-page':page,'camp-results':results,'camp-criteria':criteria,'camp-bus':busNote},
  follow:{
   view:followView,
   fact:({f})=>f.fact,
   before:()=>(S.tapHint?`<p class="tap-hint" role="status">${esc(S.tapHint)}</p>`:'')
  }
 };

 // 사건 4·5 자료 찾기
 actions.cell=b=>{
  const x=C.page.rows.find(r=>r.id===b.dataset.id);
  if(!x.blank){
   miss(C.checks[0].hint);
   return;
  }
  // 누른 칸만 확인 표시. 빈 칸 둘을 다 눌러야 자료를 확인한 것이 된다.
  S.opened.add('page:'+x.id);
  if(blanks.every(r=>S.opened.has('page:'+r.id))||S.state.evidence.includes('camp-page'))found('camp-page');
  else miss(C.checks[0].one);
 };
 actions.village=b=>{
  const x=C.results.rows.find(r=>r.id===b.dataset.id);
  if(x.target)found('camp-results');
  else miss(C.checks[1].hint);
 };
 actions.crit=b=>{
  S.opened.add(b.dataset.id);
  if(C.criteria.rows.every(r=>S.opened.has(r.id)))send({type:'check',id:'camp-criteria'});
  else UI.render();
 };
 actions.change=b=>{
  const x=C.follow.segments.find(s=>s.id===b.dataset.id);
  if(!x.changed){
   miss(x.hint);
   return;
  }
  S.tapHint='';
  send({type:'mark',id:'changed',value:'found'});
 };
})();
