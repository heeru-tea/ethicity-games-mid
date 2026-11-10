// 사건 1 「사진」(photo): 축제 단체 사진을 자동으로 자른 AI. 이 사건만의 그림·자료·후속 조사·누르기 처리.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,esc,btn,send,actions,pct,rectStyle,canvas,found,miss,followCount}=UI;
 const A=D.art;
 const FACE_NAMES=['토리','루루','담이','모아','몽이'];
 const DAMI=2; // E.faces에서 담이 얼굴의 번호

 // ── 사진을 글로 ─────────────────────────────────────────────────────
 // 사진을 보지 못해도 같은 관찰을 할 수 있게, 누가 어디에 있고 틀 가장자리가 어느 얼굴을 지나는지를 글로 적는다.
 // 문장은 모두 engine 좌표(faces·AUTO·FOLLOW_CROPS)에서 만든다(손으로 쓰면 그림과 어긋난다). 답(잘렸어/나왔어)을 대신 말하지는 않는다.
 const COLS=['왼쪽','가운데','오른쪽'];
 const ROWS=['위','가운데','아래'];
 const ORDER=['첫째','둘째','셋째','넷째','다섯째'];
 const EDGES={left:'왼쪽',right:'오른쪽',top:'위쪽',bottom:'아래쪽'};
 const centerX=f=>f[0]+f[2]/2;
 const centerY=f=>f[1]+f[3]/2;
 // 원본을 3×3으로 나눈 자리 이름
 function placeName(rect){
  const [col,row]=E.place(rect);
  return col===1&&row===1?'한가운데':COLS[col]+' '+ROWS[row];
 }
 // 얼굴 번호를 왼쪽에 있는 순서대로
 const leftToRight=()=>E.faces.map((f,i)=>i).sort((a,b)=>centerX(E.faces[a])-centerX(E.faces[b]));
 // 얼굴 i의 자리: ‘왼쪽에서 셋째’, ‘사진의 한가운데’
 function facePlace(i){
  return {order:'왼쪽에서 '+ORDER[leftToRight().indexOf(i)],where:'사진의 '+placeName(E.faces[i])};
 }
 // 틀(rect)에서 얼굴을 온전히 보이는 것 · 가장자리에 걸린 것 · 안 보이는 것으로 나눈다.
 function sortFaces(rect){
  const groups={in:[],part:[],out:[]};
  for(const i of leftToRight()){
   const f=E.faceIn(rect,i);
   groups[f.state].push({name:FACE_NAMES[i],edges:f.edges.map(e=>EDGES[e]).join('·')});
  }
  return groups;
 }
 // 잘린 사진 한 장의 설명. 보이는 얼굴만 적는다(틀 밖 얼굴은 사진에 없으므로 적지 않는다).
 function cropText(rect){
  const g=sortFaces(rect);
  let t=`원본의 ${placeName(rect)} 부분.`;
  if(g.in.length)t+=` 온전히 보이는 얼굴: ${g.in.map(x=>x.name).join(', ')}${g.in.length===E.faces.length?'(다섯 모두)':''}.`;
  if(g.part.length)t+=` 가장자리에 걸려 일부만 보이는 얼굴: ${g.part.map(x=>`${x.name}(사진의 ${x.edges} 가장자리)`).join(', ')}.`;
  if(!g.in.length&&!g.part.length)t+=' 보이는 얼굴이 없다.';
  return t;
 }
 // 접을 수 있는 글 설명. 펼친 것은 화면을 다시 그려도 펼친 채로 둔다(S.textOpen).
 function textBox(key,body){
  return `<details class="more photo-text" data-text="${key}"${S.textOpen.has(key)?' open':''}><summary>사진을 글로 살펴보기</summary>${body}</details>`;
 }
 document.addEventListener('toggle',e=>{
  const d=e.target;
  if(!d.matches?.('details.photo-text'))return;
  if(d.open)S.textOpen.add(d.dataset.text);
  else S.textOpen.delete(d.dataset.text);
 },true);
 // 원본 사진의 글 설명: 다섯 친구의 자리(왼쪽부터)와 점선 틀(자동으로 남긴 부분)이 지나는 곳.
 function originalText(){
  const lowest=E.faces.map((f,i)=>i).sort((a,b)=>centerY(E.faces[b])-centerY(E.faces[a]))[0];
  const friends=leftToRight().map(i=>{
   const p=facePlace(i);
   return `<li><strong>${FACE_NAMES[i]}</strong>: ${p.order}. ${p.where}.${i===lowest?' 다섯 얼굴 가운데 가장 아래쪽.':''}</li>`;
  });
  const g=sortFaces(E.AUTO);
  const names=list=>list.map(x=>x.name).join(', ');
  let frame=`점선 틀(자동으로 남긴 부분)은 원본의 ${placeName(E.AUTO)} 부분이다.`;
  if(g.in.length)frame+=` 틀 안에 온전히 있는 얼굴: ${names(g.in)}.`;
  if(g.part.length)frame+=` 틀 가장자리에 걸린 얼굴: ${g.part.map(x=>`${x.name}(틀의 ${x.edges} 가장자리)`).join(', ')}.`;
  if(g.out.length)frame+=` 틀 밖에 있는 얼굴: ${names(g.out)}.`;
  return textBox('original',`<p>원본 사진에는 얼굴이 다섯 있다. 왼쪽부터:</p><ul class="text-list">${friends.join('')}</ul><p>${frame}</p>`);
 }
 // 후속 조사 사진 여섯 장의 글 설명
 function followText(){
  const items=E.FOLLOW_CROPS.map((r,i)=>`<li><strong>사진 ${i+1}</strong>: ${cropText(r)}</li>`);
  return textBox('follow',`<p>사진마다 보이는 얼굴을 적었다. 이름이 없는 친구는 그 사진에 보이지 않는다.</p><ul class="text-list">${items.join('')}</ul>`);
 }

 // 원본 사진: 다섯 얼굴 가운데 담이를 찾는다. 버튼 이름은 자리만 말한다(누구인지는 말하지 않는다). 찾은 뒤에는 찾은 얼굴에 이름이 붙는다.
 function original(done){
  const spots=E.faces.map((f,i)=>{
   const p=facePlace(i);
   const name=`얼굴 ${i+1}: ${p.order}, ${p.where}`+(done&&i===DAMI?` (찾았어: ${FACE_NAMES[i]})`:'');
   return `<button class="face-spot ${done&&i===DAMI?'found':''}" data-act="spot" data-id="${i}" style="${rectStyle(f)}" aria-label="${esc(name)}"></button>`;
  });
  return `<div class="photo-frame"><img src="${A.photo}" alt="다섯 친구가 모두 나온 축제 원본 사진. 친구들의 자리는 사진 아래 ‘사진을 글로 살펴보기’에 적혀 있다.">`
   +`<span class="crop-border dashed" style="${rectStyle(E.AUTO)}"><span class="crop-label">자동으로 남긴 부분</span></span>`
   +`${spots.join('')}</div>`
   +originalText();
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
  // 자르기 중심 = 자동으로 남긴 부분의 한가운데
  const cx=E.AUTO[0]+E.AUTO[2]/2;
  const cy=E.AUTO[1]+E.AUTO[3]/2;
  const cropped=all
   ?`<span class="crop-border" style="${rectStyle(E.AUTO)}"></span><span class="center-dot" style="left:${pct(cx,E.PHOTO[0])};top:${pct(cy,E.PHOTO[1])}"></span>`
   :'';
  // 노란 테두리와 점은 그림으로만 보이므로, 열린 뒤에는 그림 설명에 글로도 적는다.
  const alt='축제 원본 사진. 세 구역으로 나뉘어 있다.'
   +(all?` 실제로 잘린 범위는 원본의 ${placeName(E.AUTO)} 부분이고, 자르기 중심은 ${names[Math.min(2,Math.floor(cx/(E.PHOTO[0]/3)))]} 구역에 있다.`:'');
  const guide=D.cases.photo.checks[1].guide.replace(/^AI 안내:\s*/,'');
  return `<div class="photo-frame"><img src="${A.photo}" alt="${alt}">${cropped}<div class="regions">${regions.join('')}</div></div>`
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
 // 사진 이름(그림 설명)에는 그 사진에 보이는 것을 적는다: 어느 부분인지, 온전히 보이는 얼굴, 가장자리에 걸린 얼굴.
 function followPhoto(r,i,fs,locked){
  const id='p'+(i+1);
  const m=fs.marks[id];
  return `<figure class="follow-photo">${canvas(r,`사진 ${i+1}. ${cropText(r)}`)}<figcaption>사진 ${i+1}</figcaption>`
   +`<div class="mark-row" role="group" aria-label="사진 ${i+1}에 담이가 나왔나">${markButton(id,'shown','나왔어',m,locked)}${markButton(id,'cut','잘렸어',m,locked)}</div></figure>`;
 }
 function followView({f,fs,locked}){
  return `<div class="follow-grid">${E.FOLLOW_CROPS.map((r,i)=>followPhoto(r,i,fs,locked)).join('')}</div><p class="caption">${esc(f.note)}</p>`+followText();
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
