// 사건 5 「은하수 홍보 그림」(share, 모아 혼자): 루루가 AI로 만든 홍보 그림. 이 사건만의 그림·자료·후속 조사·누르기 처리.
// 혼자 규칙: 모아의 해설은 없다. 답이 아닌 곳을 누르면 '아님' 표시와 짧은 중립 안내 한 줄만 남긴다(2026-11-12).
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,esc,btn,send,actions,missQuietly,triedTag,screenCard,followCount,openMark}=UI;
 const A=D.art;
 const C=D.cases.share;

 // 사건 5 하늘 그림. 그림 파일(A.galaxy·A.hillReal)이 없으면 코드로 그린 하늘(별 점)로 대신한다.
 function skyArt(key,alt,small){
  const cls='sky-art '+key+(small?' small':'');
  if(A[key])return `<img class="${cls}" src="${A[key]}" alt="${esc(alt)}">`;
  return `<div class="${cls}" role="img" aria-label="${esc(alt)}"></div>`;
 }
 // 사건 5(혼자): 작업 기록(AI가 처음부터 만든 부분), 지난 모임 사진(실제 하늘 줄), DM과 게시물(AI라고 밝힌 말)
 function workLog(done){
  const row=r=>{
   const part=done&&r.target?`<mark>${esc(r.part)}</mark>`:esc(r.part);
   const label=`<span class="kv-k">${part}</span><span class="kv-v">${esc(r.how)}</span>${triedTag('log:'+r.id)}`;
   return btn(label,'part',`data-id="${r.id}"`,'record kv');
  };
  return `<div class="document compact"><p class="doc-label">${esc(C.logLabel)}</p></div><div class="records">${C.log.map(row).join('')}</div>`;
 }
 function meetingPhotos(done){
  const P=C.photos;
  const row=r=>{
   const text=done&&r.target?`<mark>${esc(r.text)}</mark>`:esc(r.text);
   return btn(text+triedTag('sky:'+r.id),'skyline',`data-id="${r.id}"`,'record');
  };
  return `<div class="sky-pair">${skyArt('galaxy','AI로 만든 홍보 그림. 언덕 위로 은하수가 쏟아진다.')}${skyArt('hillReal','지난 모임에서 찍은 실제 사진. 마을 불빛 위로 별이 몇 개만 보인다.')}</div>`
   +`<p class="caption">${esc(P.caption)}</p>`
   +`<div class="document compact"><p class="doc-label">${esc(P.label)}</p></div>`
   +`<div class="records">${P.lines.map(row).join('')}</div>`;
 }
 function compare(done){
  const M=C.compare;
  const dm=`<div class="document dm"><p class="doc-label">${esc(M.dm.label)}</p>${skyArt('galaxy','루루가 보낸 은하수 그림',true)}`
   +`${btn(done?`<mark>${esc(M.dm.text)}</mark>`:esc(M.dm.text),'said','data-id="dm"','segment')}</div>`;
  const post=`<div class="document post"><p class="doc-label">${esc(M.post.label)}</p>${skyArt('galaxy','게시물의 은하수 그림',true)}`
   +`${btn(esc(M.post.text)+triedTag('said:post'),'said','data-id="post"','segment')}<p class="caption">${esc(M.post.meta)}</p></div>`;
  return `<div class="compare-pair">${dm}${post}</div>`;
 }

 // 사건 5: 그림을 올린 세 곳. 모두 열면 마무리 줄.
 function place(l,fs){
  const open=fs.marks[l.id]==='open';
  const label=`<span class="rec-name">${esc(l.name)}</span>${open?'':' <span class="row-open">누가 보는지 ▸</span>'}`;
  const detail=open?`<dl class="place"><dt>보는 사람</dt><dd>${esc(l.who)}</dd><dt>아는 것</dt><dd>${esc(l.know)}</dd></dl>`:'';
  return `<div class="rec-list">${btn(label,'list',`data-id="${l.id}" aria-expanded="${open}"`,'record')}${detail}</div>`;
 }
 function followView({f,fs}){
  const all=E.followReady(S.state,'share');
  return `<div class="rec-lists">${f.places.map(l=>place(l,fs)).join('')}</div>${all?`<p class="score-formula">${esc(f.allLine)}</p>`:''}`;
 }

 UI.views.share={
  // 냥스타 게시물(휴대폰 모양 카드)
  stage:x=>({screen:screenCard(x),screenCls:'phone'}),
  evidence:{'share-log':workLog,'share-photo':meetingPhotos,'share-compare':compare},
  follow:{
   view:followView,
   fact:({f})=>f.fact,
   before:()=>followCount('share','곳 열었어')
  }
 };

 // 맞는 곳: 답이 아닌 곳을 눌렀을 때의 안내를 지우고 자료를 확인한 것으로 한다.
 const hit=id=>{
  S.tapHint='';
  send({type:'check',id});
 };
 actions.part=b=>{
  const x=C.log.find(r=>r.id===b.dataset.id);
  if(x.target)hit('share-log');
  else missQuietly('log:'+x.id,x.hint);
 };
 actions.skyline=b=>{
  const x=C.photos.lines.find(r=>r.id===b.dataset.id);
  if(x.target)hit('share-photo');
  else missQuietly('sky:'+x.id,x.hint);
 };
 actions.said=b=>{
  if(b.dataset.id==='dm')hit('share-compare');
  else missQuietly('said:post',C.compare.post.hint);
 };
 actions.list=openMark;
})();
