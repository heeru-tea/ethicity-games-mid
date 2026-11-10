// 사건 2 「글 검사」(writing): 루루의 글에 ‘AI 작성 의심’을 붙인 검사기. 이 사건만의 그림·자료·후속 조사·누르기 처리.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {D,esc,btn,send,actions,found,miss}=UI;

 // 검사 결과 종이: 루루의 글과 검사기가 표시한 문장
 function flaggedDraft(){
  return `<div class="document"><p class="doc-label">글 검사 결과 · AI 작성 의심</p><p>${esc(D.drafts.before)} <mark>${esc(D.drafts.revision)}</mark></p></div>`;
 }
 function guide(){
  const items=D.cases.writing.checks[0].guide.map(t=>`<li>${esc(t)}</li>`);
  return `<div class="document"><p class="doc-label">AI 안내 · 글 검사기</p><ul>${items.join('')}</ul></div>`;
 }
 // 작성 기록: 표시된 문장과 글자까지 같은 버전을 찾는다.
 function history(done){
  const rec=r=>{
   const label=`<span class="doc-label">${esc(r.time)} · ${esc(r.kind)}</span>${r.target&&done?`<mark>${esc(r.text)}</mark>`:esc(r.text)}`;
   return btn(label,'record',`data-id="${r.id}"`,'record');
  };
  return `<div class="document compact"><p class="doc-label">검사기가 표시한 문장</p><p><mark>${esc(D.drafts.revision)}</mark></p></div>`
   +`<div class="records">${D.history.map(rec).join('')}</div>`;
 }

 // 후속 조사: 선생님이 직접 쓴 글을 같은 검사기에 넣어 본다.
 function followView({f,fs}){
  const ran=fs.marks.run==='done';
  const sentences=f.sentences.map((t,i)=>ran&&f.flagged.includes(i)?`<mark>${esc(t)}</mark>`:esc(t));
  return `<div class="document"><p class="doc-label">${esc(f.docLabel)}${ran?' · 검사 결과':''}</p><p>${sentences.join(' ')}</p>`
   +`${ran?'<p class="legend">노란 표시: AI 작성 의심</p>':''}</div>`;
 }

 UI.views.writing={
  // 결과 화면에서는 고른 선택의 상태 글(발표 표시)을 무대에 띄운다.
  stage:({opt,result})=>(result&&opt?{status:opt.status}:{}),
  idle:flaggedDraft,
  plain:['writing-guide'],
  evidence:{'writing-guide':guide,'writing-history':history},
  follow:{
   view:followView,
   fact:()=>'선생님이 5년 전에 쓴 글을 같은 검사기에 넣자, 세 문장 가운데 두 문장에 ‘AI 작성 의심’ 표시가 붙었다.',
   before:({fs})=>btn('검사기에 넣기','run',fs.marks.run?'disabled':'')
  }
 };

 actions.record=b=>{
  const r=D.history.find(x=>x.id===b.dataset.id);
  if(r.target)found('writing-history');
  else miss(r.hint);
 };
 actions.run=()=>send({type:'mark',id:'run',value:'done'});
})();
