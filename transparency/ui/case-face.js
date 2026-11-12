// 사건 3 「얼굴 인식」(face): 빵집 입구의 얼굴 인식 알림. 이 사건만의 그림·자료·후속 조사·누르기 처리.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {D,S,esc,btn,send,actions,miss,followCount,openMark}=UI;
 const A=D.art;

 function alertDoc(){
  return `<div class="document"><p class="doc-label">알림 기록 · 빵집 앱</p><p>${esc(D.alertText)}</p></div>`;
 }
 // 점원의 말: 문장을 누르면 문장마다 다른 안내가 나온다. 알림의 말을 바꿔 말한 문장(found가 있는 문장)을 눌러야 자료를 확인한 것이 된다.
 function clerk(done){
  const segments=D.cases.face.clerkSegments.map(s=>
   btn(done&&s.found?`<mark>${esc(s.text)}</mark>`:esc(s.text),'segment',`data-id="${s.id}"`,'segment'));
  return `<div class="document compact"><p class="doc-label">알림 기록</p><p>${esc(D.alertText)}</p></div>`
   +`<div class="document"><p class="doc-label">점원의 말</p><p class="segments">${segments.join(' ')}</p></div>`;
 }
 function facePhotos(){
  return `<div class="compare-labels" aria-hidden="true"><span>등록된 사진</span><span>오늘 찍힌 사진</span></div>`
   +`<img class="evidence-photo" src="${A.faces}" alt="왼쪽은 등록된 사진, 오른쪽은 오늘 찍힌 사진. 둘 다 흐리고 문틀과 반사에 일부 가려진 가상의 고양이 얼굴이다.">`;
 }

 // 후속 조사: 가게가 붙인 점검표. 항목을 누르면 근거가 열린다.
 const CHIPS={'완료':['done','✓'],'진행 중':['doing','◐'],'예정':['plan','○']};
 function chip(s){
  const [cls,mark]=CHIPS[s];
  return `<span class="chip chip-${cls}">${mark} ${esc(s)}</span>`;
 }
 function checklistRow(r,fs){
  const open=fs.marks[r.id]==='open';
  const label=`<span class="row-top">${chip(r.status)}${open?'':'<span class="row-open">근거 보기 ▸</span>'}</span>`
   +`<span class="row-item">${esc(r.item)}</span>`
   +(open?`<span class="proof">근거: ${esc(r.proof)}</span>`:'');
  return btn(label,'row',`data-id="${r.id}" aria-expanded="${open}"`,'record');
 }
 function followView({f,fs}){
  return `<div class="document compact"><p class="doc-label">${esc(f.docLabel)}</p></div><div class="records">${f.rows.map(r=>checklistRow(r,fs)).join('')}</div>`;
 }
 function followFact({f}){
  const n=s=>f.rows.filter(r=>r.status===s).length;
  return `점검표 ${f.rows.length}개 가운데 완료 ${n('완료')}개, 진행 중 ${n('진행 중')}개, 예정 ${n('예정')}개이고, 예정 항목에는 점검 기록이 없다.`;
 }

 UI.views.face={
  // 입장 표시와 점원 표정: ‘제한을 푼다’를 고른 결과 화면에서만 풀린 모습.
  stage({c,o,result}){
   const released=result&&o.id==='release';
   return {
    status:released?'입장 제한 해제':'입장 제한 중',
    cast:released?c.cast.map(x=>x==='clerk'?'clerkOpen':x):c.cast.slice()
   };
  },
  plain:['face-alert','face-photo'],
  evidence:{'face-alert':alertDoc,'face-clerk':clerk,'face-photo':facePhotos},
  follow:{
   view:followView,
   fact:followFact,
   before:()=>followCount('face','개 확인했어')
  }
 };

 actions.segment=b=>{
  const s=D.cases.face.clerkSegments.find(x=>x.id===b.dataset.id);
  if(!s.found){
   // rest = 아직 찾지 못했을 때만 덧붙이는 한마디(‘가게 규칙’ 문장: 알림과 다르긴 하지만 찾는 문장은 아니다).
   miss(s.hint+(s.rest&&!S.state.evidence.includes('face-clerk')?' '+s.rest:''));
   return;
  }
  // 찾은 문장도 그 문장의 설명을 안내로 남긴다(문장마다 피드백).
  S.tapHint=s.found;
  send({type:'check',id:'face-clerk'});
 };
 actions.row=openMark;
})();
