// 시작 화면(2026-11-11): 게임을 열면 먼저 나온다. 대표 그림(수리점 배경 + 모아 + 검은 상자 — 모두 기존 그림) 위·아래에 판 하나:
// 제목, 무슨 게임인지, 게임 속 한 장면(사진 사건의 판단 문장), ‘게임 시작하기’ — 저장된 진행이 있으면 ‘이어하기’(어디부터)와 ‘처음부터 하기’.
// 저장 형식은 그대로다: 시작 화면을 보고 있는지는 S.title(화면에만 쓰는 값)로만 안다. 글은 story.js title.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,$,esc,btn,actions}=UI;
 const A=D.art;
 const T=D.title;

 // 저장된 진행이 있는가: 프롤로그를 지나 봤으면 있다(미리보기는 저장을 쓰지 않는다).
 const hasProgress=()=>!UI.preview&&(S.state.scene>0||S.state.furthest>0);
 // 어디부터 이어 하는지 한 마디: ‘사건 2 · 글 검사 · 직접 확인부터’
 function whereFrom(){
  const n=S.state.scene;
  const k=E.caseKey(n);
  const step=E.stepOf(n);
  if(!k)return T.places[step]+T.from;
  const name=D.cases[k].name.replace(/ 사건$/,'');
  const stepName=UI.STEP_LABELS[step].split(': ').pop();
  return `사건 ${E.CASES.indexOf(k)+1} · ${name} · ${stepName}${T.from}`;
 }
 // 대표 그림: 수리점 배경(1672×941) 한 장에 검은 상자 셋과 모아를 얹는다 — SVG 하나라서 배경·상자·모아가 함께 늘고 함께 잘린다(slice = 칸을 가득 덮기).
 // 자리는 배경 그림의 픽셀 좌표: 작업대 윗면이 세로 489~536, 상자는 가로 1020~1422(바닥 528), 모아는 가로 610~1062·세로 207~885.
 // 상자는 소품 묶음(1254×1254, 3×2칸 — 0번 칸 닫힌 상자, 1번 칸 작은 창 상자)에서 한 칸씩 잘라 온다. 설명 글은 SVG의 이름 하나에 모은다.
 // ⚠ container query 단위(cqw·cqh)로 맞추지 않는다: 시작 화면에 container-type 칸이 한 번이라도 있었으면, 게임 화면(휴대폰)에서 세 구역을 다 눌렀을 때 화면이 29px 움직였다(Edge, 2026-11-11 확인).
 const BOX_CELLS=[0,0,1];
 function scene(cls,align,width){
  const box=(col,i)=>`<svg x="${1020+i*134}" y="350" width="134" height="201" viewBox="${col*418} 0 418 627" preserveAspectRatio="none"><image href="${A.props}" width="1254" height="1254"/></svg>`;
  const shade=(cx,cy,rx,ry)=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
  return `<svg class="title-scene ${cls}" viewBox="0 0 ${width} 941" preserveAspectRatio="${align} slice" role="img" aria-label="${esc(T.art)}">`
   +`<image class="title-bg" href="${A.backgrounds[0]}" width="1672" height="941"/>`
   +`<g class="title-shade">${BOX_CELLS.map((_,i)=>shade(1087+i*134,529,60,7)).join('')}${shade(846,868,118,13)}</g>`
   +`<g class="title-boxes">${BOX_CELLS.map(box).join('')}</g>`
   +`<image class="title-moa" href="${A.moa}" x="610" y="207" width="452" height="678"/>`
   +`</svg>`;
 }
 // 세로로 긴 배치는 오른쪽 아래(모아 발이 판에 가리지 않게)에 맞추고 오른쪽 끝 62px(돌담·꽃)을 덜어 낸다 — 좁은 화면에서 모아 꼬리가 왼쪽에서 잘리지 않게.
 // 넓은 배치는 그림 전체를 오른쪽 가운데에 맞춘다. 화면에는 CSS가 둘 중 하나만 보인다.
 function art(){
  return `<div class="title-art"><div class="title-frame">${scene('fit-tall','xMaxYMax',1610)}${scene('fit-wide','xMaxYMid',1672)}</div></div>`;
 }
 // 게임 속 한 장면: 누를 수 없는 그림 구실(role=img). 판단할 말 하나와 세 갈래.
 function peek(){
  const j=D.cases[T.peek.case].judges[T.peek.judge];
  const stamps=Object.values(D.stamps);
  const label=`${T.peek.tag}. ${D.names[j.who]}: “${j.text}” ${T.peek.ask} ${stamps.join(', ')} 가운데 하나로 판단한다.`;
  return `<figure class="title-peek"><figcaption>${esc(T.peek.tag)}</figcaption>`
   +`<div class="peek-card" role="img" aria-label="${esc(label)}">`
   +`<p class="peek-ask">${esc(T.peek.ask)}</p>`
   +`<p class="peek-say">“${esc(j.text)}” <span class="peek-who">${esc(D.names[j.who])}</span></p>`
   +`<p class="peek-stamps">${stamps.map(x=>`<span>${esc(x)}</span>`).join('')}</p>`
   +`</div></figure>`;
 }
 function buttons(){
  if(!hasProgress())return btn(esc(T.start),'start','','primary');
  const go=`<span class="go">${esc(T.resume)}</span><span class="from">${esc(whereFrom())}</span>`;
  return btn(go,'start','','primary')+btn(esc(T.restart),'reset-ask');
 }
 function titleScreen(){
  const facts=T.facts.map(x=>`<li>${esc(x)}</li>`).join('');
  return `<div class="title${hasProgress()?' has-save':''}">${art()}`
   +`<div class="title-panel" id="work" tabindex="-1">`
   +`<div class="title-head"><p class="title-kind">${esc(T.kind)}</p><h1 tabindex="-1" class="series-title"><span class="cat-title-first"><span class="cat-title-box"><span class="cat-box-border" aria-hidden="true"></span><span class="title-ink blackbox-word"><span class="title-text">블랙박스</span><img src="assets/title-type/blackbox.png" alt="" aria-hidden="true" onload="this.parentElement.classList.add('is-ready')" onerror="this.parentElement.classList.remove('is-ready')"></span></span><span class="cat-title-object">를</span></span> <span class="cat-title-rest">열어보는 고양이</span></h1>`
   +`<p class="title-hook">${esc(T.hook)}</p><p class="title-lead">${esc(T.lead)}</p>`
   +`<ul class="title-facts" aria-label="${esc(T.factsLabel)}">${facts}</ul></div>`
   +peek()
   +`<div class="title-actions">${buttons()}</div>`
   +`<p class="title-keys">${esc(T.keys)}</p>`
   +`</div></div>`;
 }
 // moved = 게임 안에서 시작 화면으로 돌아왔다(제목에 초점). 처음 열 때는 초점을 옮기지 않는다.
 function drawTitle(moved){
  $('#app').className='at-title';
  $('#app').innerHTML=titleScreen();
  if(moved){
   $('h1').focus({preventScroll:true});
   window.scrollTo(0,0);
  }
 }

 // 게임 시작하기·이어하기: 저장된 장면(없으면 프롤로그)으로 들어간다. 진행은 건드리지 않는다.
 actions.start=()=>{
  S.title=false;
  UI.render(true);
 };
 // 설정 창의 ‘시작 화면으로’
 actions.title=()=>{
  S.skipFocusReturn=true;
  UI.close();
  S.title=true;
  UI.render(true);
 };

 Object.assign(UI,{drawTitle,titleScreen});
})();
