// 사건 1 「사진」(photo): 축제 단체 사진을 자동으로 자른 AI. 이 사건만의 그림·자료·후속 조사·누르기 처리.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,esc,btn,send,actions,pct,rectStyle,canvas,found,miss,followCount}=UI;
 const A=D.art;
 const FACE_NAMES=['토리','루루','담이','모아','몽이'];
 const DAMI=2; // E.faces에서 담이 얼굴의 번호

 // 원본 사진: 다섯 얼굴 가운데 담이를 찾는다.
 function original(done){
  const spots=E.faces.map((f,i)=>
   `<button class="face-spot ${done&&i===DAMI?'found':''}" data-act="spot" data-id="${i}" style="${rectStyle(f)}" aria-label="얼굴 ${i+1}"></button>`);
  return `<div class="photo-frame"><img src="${A.photo}" alt="다섯 친구가 모두 나온 축제 원본 사진">`
   +`<span class="crop-border dashed" style="${rectStyle(E.AUTO)}"><span class="crop-label">자동으로 남긴 부분</span></span>`
   +`${spots.join('')}</div>`;
 }
 // 자르기 규칙: 세 구역의 점수를 모두 열면 실제로 잘린 범위와 자르기 중심이 보인다.
 function rule(done){
  const all=done||S.regions.size===3;
  const names=['왼쪽','가운데','오른쪽'];
  const score=[2,5,8];
  const regions=names.map((n,i)=>{
   const open=all||S.regions.has(i);
   return `<button class="region ${open?'open':''}" data-act="region" data-id="${i}" aria-label="${n} 구역 점수${open?' '+score[i]+'점':' 보기'}"><span>${n} ${open?score[i]:'?'}</span></button>`;
  });
  const cropped=all
   ?`<span class="crop-border" style="${rectStyle(E.AUTO)}"></span><span class="center-dot" style="left:${pct(1200,1536)};top:${pct(250,1024)}"></span>`
   :'';
  const guide=D.cases.photo.checks[1].guide.replace(/^AI 안내:\s*/,'');
  return `<div class="photo-frame"><img src="${A.photo}" alt="축제 원본 사진. 세 구역으로 나뉘어 있다.">${cropped}<div class="regions">${regions.join('')}</div></div>`
   +`<div class="document guide-box"><p class="doc-label">AI 안내</p><p>${esc(guide)}</p></div>`
   +(all?'<p class="legend">노란 테두리: 실제로 잘린 범위 · 점: 자르기 중심</p>':'');
 }
 function croppedPhoto(){
  return `<figure class="crop-figure">${canvas(E.AUTO,'자동으로 자른 사진. 담이 얼굴이 없다.')}<figcaption>자동으로 자른 사진</figcaption></figure>`;
 }

 // 후속 조사: 같은 원본을 다르게 자른 사진 여섯 장에서 담이가 나왔는지 표시한다.
 function markButton(id,value,label,mark,locked){
  return btn(label,'mark',`data-id="${id}" data-value="${value}" aria-pressed="${mark===value}" ${locked?'disabled':''}`);
 }
 function followPhoto(r,i,fs,locked){
  const id='p'+(i+1);
  const m=fs.marks[id];
  return `<figure class="follow-photo">${canvas(r,'사진 '+(i+1))}<figcaption>사진 ${i+1}</figcaption>`
   +`<div class="mark-row" role="group" aria-label="사진 ${i+1}에 담이가 나왔나">${markButton(id,'shown','나왔어',m,locked)}${markButton(id,'cut','잘렸어',m,locked)}</div></figure>`;
 }
 function followView({f,fs,locked}){
  return `<div class="follow-grid">${E.FOLLOW_CROPS.map((r,i)=>followPhoto(r,i,fs,locked)).join('')}</div><p class="caption">${esc(f.note)}</p>`;
 }
 // 여섯 장에서 친구마다 잘린 횟수(많은 순)
 function tally(){
  const counts=[0,0,0,0,0];
  for(const r of E.FOLLOW_CROPS)for(const i of E.cutFaces(r))counts[i]++;
  return counts.map((n,i)=>[FACE_NAMES[i],n]).sort((a,b)=>b[1]-a[1]);
 }
 function followFact({fs}){
  const t=tally();
  const mine=E.followMarks.photo.ids.filter(id=>fs.marks[id]==='cut').length;
  return `여섯 장 가운데 담이가 잘린 사진은 ${E.truth.filter(x=>x==='cut').length}장이다. 얼굴이 일부라도 사진 틀 밖으로 나가면 잘린 것으로 셌다. 잘린 횟수: ${t.map(([n,c])=>n+' '+c).join(' · ')}. (내가 ‘잘렸어’로 고른 사진 ${mine}장)`;
 }
 // 조사를 마친 뒤: 사실 문장(내가 고른 장 수는 빼고)과, 내 표시가 기록과 다른 사진 번호
 function followFinding(fs){
  const wrong=E.followMarks.photo.ids.map((id,i)=>fs.marks[id]!==E.truth[i]?i+1:null).filter(Boolean);
  const fact=followFact({fs}).replace(/ \(내가.*$/,'');
  return `<div class="finding" role="status"><p>${esc(fact)}</p><p>${wrong.length?`네 표시와 기록이 다른 사진: ${wrong.join(', ')}번`:'네 표시는 기록과 같아.'}</p></div>`;
 }

 UI.views.photo={
  // 게시판에 올린 사진: 결과 화면에서는 고른 대로, 그 전에는 자동으로 자른 사진.
  stage:({o,result})=>({photoRect:result?o.rect:E.AUTO}),
  idle:croppedPhoto,
  // 선택 화면: 선택마다 그 선택대로 자른 사진을 보여 준다.
  optionsCls:' photo-options',
  optionArt:o=>canvas(o.id==='all'?E.ALL:E.AUTO,o.label),
  evidence:{'photo-original':original,'photo-rule':rule},
  follow:{
   view:followView,
   fact:followFact,
   before:()=>followCount('photo','장 골랐어'),
   finding:followFinding
  }
 };

 actions.spot=b=>{
  if(b.dataset.id===String(DAMI))found('photo-original');
  else miss('그 친구는 담이가 아니야. 담이는 원본 어디에 있었을까? 담이는 초록 얼굴에 등껍질을 멘 친구야.');
 };
 actions.region=b=>{
  S.regions.add(Number(b.dataset.id));
  if(S.regions.size===3)send({type:'check',id:'photo-rule'});
  else UI.render();
 };
 actions.mark=b=>send({type:'mark',id:b.dataset.id,value:b.dataset.value});
})();
