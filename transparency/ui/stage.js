// 장면 그림(무대)·대사 옆 작은 얼굴·축제 사진 canvas.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,esc}=UI;
 const A=D.art;

 // 대사 옆 작은 얼굴: 전신 그림(1024×1536)에서 얼굴 중심(가로·세로 비율). 그림이 없는 화자(마을 사람들·반 친구·앱 알림)는 이름만.
 const FACE_POS={
  moa:[.54,.12],
  lulu:[.51,.23],
  luluPaper:[.46,.23],
  dami:[.51,.15],
  bami:[.59,.13],
  teacher:[.48,.12],
  clerk:[.52,.13],
  clerkOpen:[.55,.12]
 };
 // 무대에만 쓰는 사건 4·5 새 포즈는 기본 인물의 자리·크기 규칙(.actor.dami 등)을 함께 받는다.
 const CAST_BASE={moaReporter:'moa',damiLetter:'dami',clerkPaper:'clerk',moaPhone:'moa',luluPhone:'lulu',bamiPhone:'bami'};
 const castCls=c=>c+(CAST_BASE[c]?' '+CAST_BASE[c]:'');
 const pct=(v,t)=>(v/t*100).toFixed(3)+'%';
 const rectStyle=([x,y,w,h])=>`left:${pct(x,1536)};top:${pct(y,1024)};width:${pct(w,1536)};height:${pct(h,1024)}`;

 function portrait(who){
  const p=FACE_POS[who];
  if(!p)return '';
  return `<span class="portrait" style="--fx:${p[0]};--fy:${p[1]}" aria-hidden="true"><img src="${A[who]}" alt=""></span>`;
 }
 function line([who,text],cls=''){
  return `<p class="line ${cls}">${portrait(who)}<span class="who">${esc(D.names[who])}</span> ${esc(text)}</p>`;
 }
 function more(text){
  return text?`<details class="more"><summary>자세히 보기</summary><p>${esc(text)}</p></details>`:'';
 }

 // 축제 사진의 한 부분을 canvas에 그린다. 그림이 열리기 전에 그려진 canvas는 열린 뒤 paint()가 채운다.
 const photo=new Image();
 photo.src=A.photo;
 photo.onload=paint;
 function canvas(rect,label){
  return `<canvas class="photo-canvas" width="${rect[2]}" height="${rect[3]}" data-crop="${rect.join(',')}" role="img" aria-label="${esc(label)}"></canvas>`;
 }
 function paint(){
  if(!photo.complete||!photo.naturalWidth)return;
  document.querySelectorAll('canvas[data-crop]').forEach(c=>{
   const r=c.dataset.crop.split(',').map(Number);
   const ctx=c.getContext('2d');
   ctx.clearRect(0,0,c.width,c.height);
   ctx.drawImage(photo,...r,0,0,c.width,c.height);
  });
 }

 // 장면 그림. 결과가 그림에 바로 보이게 한다(게시판 사진·입장 표시·점원 표정).
 // screen = 무대 오른쪽 위에 코드로 그린 화면 카드(사건 4 마을 신문 1면·사건 5 냥스타 게시물). 첫 줄은 작은 머리말.
 function screenLine(x,i){
  const cls=i?(x.startsWith('임시 표시')?'screen-line screen-flag':'screen-line'):'screen-head';
  return `<span class="${cls}">${esc(x)}</span>`;
 }
 function actor(c){
  return `<img class="actor ${castCls(c)}" src="${A[c]}" alt="${esc(D.names[c])}">`;
 }
 function nameTag(c,i){
  return `<span class="name-tag pos-${i} ${castCls(c)}"><span>${esc(D.names[c])}</span></span>`;
 }
 function stage(bg,cast,{photoRect,status,boxes,screen,screenCls=''}={}){
  const parts=[
   `<img class="backdrop" src="${A.backgrounds[bg]}" alt="${D.bgNames[bg]}">`,
   photoRect?`<div class="stage-photo">${canvas(photoRect,'게시판에 올린 사진')}</div>`:'',
   screen?`<div class="stage-screen ${screenCls}">${screen.map(screenLine).join('')}</div>`:'',
   boxes?`<div class="stage-boxes" aria-hidden="true">${[0,1,2].map(()=>`<span class="prop ${boxes}"></span>`).join('')}</div>`:'',
   status?`<p class="stage-status">${esc(status)}</p>`:'',
   `<div class="cast">${cast.map(actor).join('')}</div>`,
   `<div class="name-tags" aria-hidden="true">${cast.map(nameTag).join('')}</div>`
  ];
  return `<div class="stage">${parts.join('')}</div>`;
 }
 // 사건 무대. 사건마다 달라지는 것(등장인물·상태 글·게시판 사진·화면 카드)은 views[사건].stage가 돌려준다.
 function caseStage(k,{result=false}={}){
  const c=D.cases[k];
  const o=E.outcome(S.state,k);
  const opt=c.choose.options.find(x=>x.id===o.id);
  const look={cast:c.cast.slice(),status:'',photoRect:null,screen:null,screenCls:''};
  Object.assign(look,UI.views[k].stage({c,o,opt,result}));
  return stage(c.bg,look.cast,{photoRect:look.photoRect,status:look.status,screen:look.screen,screenCls:look.screenCls});
 }
 // 사건 4: 마을 신문 1면, 사건 5: 냥스타 게시물. 결과 화면에서는 고른 선택의 카드로 바뀐다.
 function screenCard({c,opt,result}){
  return result&&opt?opt.screen:c.screen;
 }

 Object.assign(UI,{pct,rectStyle,portrait,line,more,canvas,paint,stage,caseStage,screenCard});
})();
