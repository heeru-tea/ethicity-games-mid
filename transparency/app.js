(()=>{
 'use strict';
 const E=window.TransparencyEngine,D=window.TransparencyStory,A=D.art;
 const KEY='ethicity.transparency.progress.v1',preview=new URLSearchParams(location.search).get('preview')==='s01';
 const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let raw=null,saveOK=true,nickname='조사자';
 try{raw=localStorage.getItem(KEY);const p=JSON.parse(localStorage.getItem('ethicity.player'));if(p&&typeof p.nickname==='string')nickname=p.nickname.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40)||nickname;}catch{saveOK=false;}
 let state=E.restore(raw),line=0,feedback='',overlay=false,showOriginal=false,order=['revision','draft','memo'],flow=['action','alert','interpret'],linkAnswers={},lastFocus=null;
 if(preview){state=E.initial();state.scene=1;state.furthest=1;}
 const photo=new Image();photo.src=A.photo;photo.onload=paint;
 const modal=$('#modal');
 const taskDone=id=>state.tasks[state.scene+':'+id];
 function save(){if(!preview)try{localStorage.setItem(KEY,JSON.stringify(state));saveOK=true;}catch{saveOK=false;}$('#save-status').textContent=preview?'S01 미리보기 · 진행 저장 안 함':saveOK?'이 기기에 진행 자동 저장 · '+nickname:'저장할 수 없어 현재 창에서만 진행합니다. 창을 닫으면 기록이 사라집니다.';}
 function send(a,msg){state=E.reduce(state,a);if(msg!==undefined)feedback=msg;save();render();}
 function btn(label,act,attrs='',cls=''){return `<button ${cls?`class="${cls}"`:''} data-act="${act}" ${attrs}>${label}</button>`;}
 function status(id){const v=taskDone(id);return v?`<p class="task-status">${v==='helped'?'함께 확인함 · 독립 확인과 구분해 기록':'직접 확인함'}</p>`:'';}
 function quiz(id,title,opts,answer,wrong){
  return `<section class="quiz" data-task="${id}"><h3>${title}</h3>${status(id)}<div class="button-list">${opts.map(([value,label])=>btn(esc(label),'answer',`data-task="${id}" data-value="${value}" data-answer="${answer}" data-wrong="${esc(wrong)}"`)).join('')}</div></section>`;
 }
 function evidenceButtons(ids){return `<div class="evidence-nav">${ids.map(id=>btn(`${id} ${esc(D.evidence[id].title)}${state.evidence.includes(id)?' · 확인함':''}`,'evidence',`data-id="${id}"`)).join('')}</div>`;}
 function fullPhoto(mark=false,dami=false){return `<div class="photo-frame"><img src="${A.photo}" alt="다섯 친구가 모두 나온 축제 원본. 담이는 앞줄 가운데.">${mark?'<div class="values"><span>왼쪽 2</span><span>가운데 5</span><span>오른쪽 8</span></div><span class="crop-border" style="left:58.59375%;top:4.8828125%;width:39.0625%;height:39.0625%"></span><span class="center-dot" style="left:78.125%;top:24.4140625%"></span>':''}${dami?'<span class="crop-border" style="left:44.5%;top:33.5%;width:12%;height:17%"></span>':''}</div>`;}
 function canvas(rect=E.AUTO,label='선택한 범위의 사진'){return `<canvas class="photo-canvas" width="${rect[2]}" height="${rect[3]}" data-crop="${rect.join(',')}" role="img" aria-label="${label}"></canvas>`;}
 function paint(){if(!photo.complete||!photo.naturalWidth)return;document.querySelectorAll('canvas[data-crop]').forEach(c=>{const rect=c.dataset.crop.split(',').map(Number);const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(photo,...rect,0,0,c.width,c.height);});}
 function stage(){const sc=D.scenes[state.scene];let cast=sc.cast.slice();const o=E.outcome(state,'face');if(state.scene===12&&o.id==='release')cast=cast.map(c=>c==='clerk'?'clerkOpen':c);
  const statusText=state.scene>=9&&state.scene<=12?(state.scene===12&&o.id==='release'?'입장 제한 해제':'입장 제한 중'):'';
  return `<div class="stage"><img class="backdrop" src="${A.backgrounds[sc.bg]}" alt="${['저녁 골목과 수리점','축제 게시판 앞','학교 복도와 교실 문','빵집 입구'][sc.bg]}">${state.scene>=1&&state.scene<=4?`<button class="stage-photo" data-act="photo-zoom" aria-label="사진 미리보기 크게 보기">${canvas(state.scene===4?E.outcome(state,'photo').rect||E.AUTO:E.AUTO,'게시판 사진 미리보기')}</button>`:''}${[0,13].includes(state.scene)?`<div class="stage-boxes" aria-hidden="true">${[0,1,2].map(()=>`<span class="prop ${state.scene===0?'box':'window'}"></span>`).join('')}</div>`:''}${statusText?`<span class="stage-status">${statusText}</span>`:''}<div class="cast">${cast.map(c=>`<img class="actor ${c}" src="${A[c]}" alt="${D.names[c]||D.names[c==='clerkOpen'?'clerk':'lulu']}">`).join('')}</div></div>`;
 }
 function dialogue(){const lines=D.scenes[state.scene].lines,[who,text]=lines[Math.min(line,lines.length-1)];return `<section class="dialogue" aria-label="대화"><div class="speaker-row"><span class="speaker">${D.names[who]}</span><span class="line-count">${line+1} / ${lines.length}</span></div><p id="dialogue-text" aria-live="polite">${esc(text)}</p><div class="dialogue-actions">${btn('이전 대사','prev-line',line===0?'disabled':'')}${btn(line<lines.length-1?'다음 대사':'대화 읽음','next-line',line===lines.length-1?'disabled':'',line<lines.length-1?'primary':'')}</div><details class="transcript"><summary>대화 전체 다시 보기</summary>${lines.map(([w,t])=>`<p><strong>${D.names[w]}</strong> ${esc(t)}</p>`).join('')}</details></section>`;}
 function after(){const lines=D.scenes[state.scene].after;if(!lines||!E.canAdvance(state))return '';return `<div class="after-lines">${lines.map(([w,t])=>`<div class="after-line">${w==='moa'?'<span class="expression focus" role="img" aria-label="집중하는 모아"></span>':''}<p><strong>${D.names[w]}</strong>${esc(t)}</p></div>`).join('')}</div>`;}
 function nextArea(){if(state.scene===0)return '';const ready=E.canAdvance(state)&&line===D.scenes[state.scene].lines.length-1;const label=state.scene===13?'내 조사 마치기':state.scene===1?'조사하기':state.scene===5?'자료 살피기':state.scene===9?'기록 살피기':'다음 장면';return `<div class="next-row">${btn(label,'next',ready?'':'disabled','primary')}<p class="hint">${ready?'확인한 내용은 수첩에 남습니다.':line<D.scenes[state.scene].lines.length-1?'대화를 끝까지 읽고 계속할 수 있습니다.':'자료와 활동을 확인하면 다음 장면이 열립니다.'}</p></div>`;}
 function sortUI(kind){const done=taskDone(kind==='order'?'order':'flow');const items=done?(kind==='order'?['draft','memo','revision']:['alert','interpret','action']):(kind==='order'?order:flow);const labels=kind==='order'?{draft:'초안',memo:'메모',revision:'수정본'}:{alert:'유사 얼굴 알림',interpret:'같은 손님이라고 해석',action:'입장 제한'};return `<section class="quiz"><h3>${kind==='order'?'작성 과정을 순서대로 놓기':'사건 문장을 순서대로 놓기'}</h3>${status(kind==='order'?'order':'flow')}<ol class="sort-list">${items.map((id,i)=>`<li><span>${i+1}. ${labels[id]}</span>${btn('위로','move',`data-kind="${kind}" data-index="${i}" ${i===0||done?'disabled':''} aria-label="${labels[id]} 위로"`)}</li>`).join('')}</ol>${btn(done?'순서 확인 완료':'순서 확인','check-order',`data-kind="${kind}" ${done?'disabled':''}`)}</section>`;}
 function renderWork(){const n=state.scene;let h='';
  if(n===0)return `<h2>사진에서 사라진 친구</h2><p>함께 찍었는데, 게시판 사진에는 한 친구가 없다.</p><div class="box-row">${btn('<span class="prop box" aria-hidden="true"></span>사진 상자 열기','start','','primary')}${btn('<span class="prop box" aria-hidden="true"></span>원고 상자','later')}${btn('<span class="prop box" aria-hidden="true"></span>빵집 상자','later')}</div><p class="hint">이 마을과 조사 자료는 창작입니다. 실제 사례에서 문제의 구조를 참고했습니다.</p><p class="hint">플레이 목표 15~20분 · 실제 소요 시간은 아직 검증하지 않았습니다.</p>`;
  if([1,5,9].includes(n)){
   h='<h2>먼저 물어보기</h2>';
   if(n===1)h+=`<div class="button-list">${btn('무슨 사진이야?','ask',`data-id="photo-purpose"`)}${btn('어디가 잘렸어?','ask',`data-id="photo-cut"`)}</div>${btn(showOriginal?fullPhoto(false,true):canvas(E.AUTO,'담이 얼굴이 제외된 자동 미리보기'),'photo-zoom','aria-label="원본과 미리보기 크게 비교"','photo-open')}<p class="hint">사진을 누르면 크게 비교할 수 있어요.</p>`;
   if(n===5)h+=`<div class="button-list">${btn('발표에서 빠지는 거야?','ask','data-id="presentation"')}${btn('과제 규칙은 뭐였어?','evidence','data-id="W3"')}</div>`;
   if(n===9)h+=`<div class="button-list">${btn('화면 다시 보기','evidence','data-id="F1"')}${btn('왜 막았나요?','ask','data-id="blocked"')}</div>`;
   return h;
  }
  if([4,8,12].includes(n))return actionWork();
  if(n===13)return finalWork();
  h='<h2>자료 살피기</h2><p class="hint">자료를 모두 열어 본 뒤 대조 활동을 할 수 있어요.</p>'+evidenceButtons(D.scenes[n].evidence);
  if(!E.readyEvidence(state))return h+'<p>먼저 위의 자료를 모두 확인해 주세요. 확인한 자료도 언제든 다시 열 수 있습니다.</p>';
  if(n===2){h+=`<h3>원본과 미리보기 비교</h3>${showOriginal?fullPhoto(overlay):canvas(E.AUTO,'자동 자르기 결과')}<div class="inline-actions">${btn(showOriginal?'미리보기 보기':'원본과 비교하기','compare')}${btn(overlay?'값·중심점 숨기기':'값·중심점 보기','overlay')}</div>${status('compare')}${status('overlay')}<p class="hint">가상 예측값 2·5·8은 정답 확률이나 사람의 가치 점수가 아닙니다.</p>`;
   h+=quiz('center','P2 규칙대로라면 어느 영역의 위치가 중심일까?',[['left','왼쪽'],['middle','가운데'],['right','오른쪽']],'right','P2는 가장 높은 예측값의 위치를 고른다고 했어. P3의 2·5·8을 다시 비교해 보자.');}
  if(n===3){h+=quiz('rule','“덜 중요한 친구라고 평가했다”는 주장: 도구가 밝힌 기준을 연결하기',[['P1','P1 원본'],['P2','P2 도구 안내'],['P3','P3 실행 기록']],'P2','P1은 담이가 원본에 있다는 사실, P3은 실행 위치를 보여줘. 위치를 고르는 규칙은 어디에 있지?');h+=quiz('record','이번에도 안내된 규칙대로 잘렸는지 확인할 자료',[['P2','P2 도구 안내'],['P3','P3 실행 기록'],['P1','P1 원본']],'P3','규칙 설명만으로 이번 실행까지 확인되지는 않아. 실제 위치가 남은 기록을 찾아보자.');h+=quiz('known','“가장 높은 예측값의 위치를 중심으로 잘랐다.”',[['known','이번 기록으로 확인'],['unknown','아직 확인하지 못함']],'known','P2의 규칙과 P3의 실제 중심을 나란히 보자.');h+=quiz('unknown','“왜 오른쪽의 예측값이 높아졌는지 모두 알아냈다.”',[['known','이번 기록으로 확인'],['unknown','아직 확인하지 못함']],'unknown','최고 값의 위치를 확인한 것과, 그 값이 생긴 이유를 모두 아는 것은 달라.');}
  if(n===6){h+=sortUI('order');h+=quiz('revision','메모의 “망설이는 장면”과 연결되는 수정 문장',[['joy','문을 열자 모두가 돌아와 있었다.'],['hesitate','주인공은 손잡이를 잡고도 한참 서 있었다.'],['happy','주인공은 기뻤다.']],'hesitate','바로 문을 여는 대신 기다리는 행동이 드러난 문장을 찾아보자.');h+=`<section class="quiz"><h3>작성자에게 묻기</h3>${status('why')}${btn('루루에게 “왜 바꿨니?” 묻기','why')}</section>`;}
  if(n===7){h+=quiz('w-limit','“표시가 있으니 AI가 본문을 대신 쓴 사실이 확인됐다.” 한계를 보여 주는 자료',[['W1','W1 표시가 있는 보고서'],['W2','W2 도구 안내'],['W3','W3 작성 과정']],'W2','표시는 실제로 있어. 하지만 그 표시가 무엇을 뜻하는지는 W2에서 확인해야 해.');h+=quiz('draft-limit','“초안이 있으니 모든 작성 과정이 확인됐다.”',[['all','초안이 모든 과정을 보증한다'],['part','W3는 남아 있는 일부 기록이다'],['none','초안은 아무 정보도 주지 않는다']],'part','고친 흔적은 확인했어. 기록에 없는 과정까지 확인한 걸까?');}
  if(n===10){h+=sortUI('flow');[['link-alert','유사 얼굴 알림','F1'],['link-interpret','같은 손님이라고 해석','F3'],['link-action','입장 제한','F3']].forEach(([id,t,ans])=>h+=quiz(id,`“${t}”에 자료 붙이기`,[['F1','F1 알림 기록'],['F2','F2 비교 자료'],['F3','F3 운영 자료']],ans,'알림 문장에 입장을 막으라는 내용도 있었나요? 점원의 말과 대응 지침은 어느 자료에 있나요?'));h+=quiz('uncertainty','흐릿한 비교 사진으로 말할 수 있는 범위',[['cause','사진이 흐려 AI가 틀린 원인이 증명됐다'],['limit','이 사진만으로 신원을 확정하기 어렵다']],'limit','자료의 한계와 이번 오류의 원인 증명은 다릅니다.');}
  if(n===11){h+=quiz('word','점원의 주장 중 기록과 먼저 대조할 표현',[['AI','AI가'],['person','사람이라고'],['certain','확정했어요']],'certain','알림이 확정을 말했는지, 확인을 요청했는지 비교해 보자.');h+=quiz('f1','“확정했어요”에 연결할 자료',[['F3','F3 운영 자료'],['F1','F1 알림 기록'],['F2','F2 비교 사진']],'F1','사진의 한계만으로는 알림의 문장을 대조할 수 없어. 원래 알림 기록을 보자.');h+=quiz('f3','확인 요청과 즉시 제한 지침의 충돌을 확인할 자료',[['F1','F1 알림 기록'],['F2','F2 비교 사진'],['F3','F3 운영 자료']],'F3','사진의 한계는 보았어. 가게가 무엇을 하도록 정했는지는 다른 자료에 있어.');}
  return h+btn('함께 확인하고 계속','help')+after();
 }
 function actionWork(){const key=E.caseKey(state.scene),c=state.cases[key],id=c.pending||c.final,a=D.actions[key].find(a=>a.id===id);let h='<h2>어떤 조치를 할까?</h2><div class="button-list">'+D.actions[key].map(x=>btn(x.label,'choose',`data-id="${x.id}" aria-pressed="${id===x.id}"`)).join('')+'</div>';
  if(!a)return h+'<p class="hint">선택 뒤에 결과를 살피고, 유지하거나 다시 고를 수 있어요.</p>';
  if(key==='photo'){
   h+=canvas(E.outcome(state,key).rect,'현재 선택에 따른 사진 범위');
   if(a.id==='manual'&&c.pending){h+=`<div class="crop-controls"><label>가로 범위<input type="range" min="400" max="1536" step="1" value="${state.crop[2]}" data-crop-control="width"></label><label>가로 위치<input type="range" min="0" max="${1536-state.crop[2]}" value="${state.crop[0]}" data-crop-control="x"></label><label>세로 위치<input type="range" min="0" max="${1024-state.crop[3]}" value="${state.crop[1]}" data-crop-control="y"></label></div>${btn('전체 보기로 다섯 친구 포함하기','full-crop')}<p class="hint">키보드 방향키로도 조절할 수 있어요. ${E.allFaces(state.crop)?'다섯 친구의 얼굴이 범위에 들어왔어요.':'아직 범위 밖에 있는 얼굴이 있어요.'}</p>`;}
   h+=`<div class="document"><strong>사진에 붙일 설명</strong><p>${a.id==='auto'?'가장 높은 예측값의 위치를 중심으로 자동 자르기. 친구의 중요도를 판정한 결과가 아닙니다.':a.id==='manual'?'함께 준비한 친구가 보이도록 사람이 범위를 조정했습니다.':'담이를 중심으로 범위를 고정했습니다. 다른 친구가 잘릴 수 있습니다.'}</p></div>`;
  }
  if(key==='face')h+=`<p class="status-tag">${a.id==='release'?'입장 제한 해제':'입장 제한 유지'}</p>`;
  if(key==='writing')h+=`<p class="status-tag">${a.id==='detector'?'발표 제외':'표시만으로 발표 보류하지 않음'}</p>`;
  const response=(key==='photo'&&a.id==='manual'&&!E.allFaces(state.crop))?'아직 내 얼굴이나 다른 친구가 잘려 있어. 범위를 더 넓혀 줘.':a.response;
  h+=`<div class="outcome"><h3>${a.title}</h3><p>${esc(response)}</p>${a.detail?`<p>${esc(a.detail)}</p>`:''}${key==='face'&&a.id==='release'?'<p><strong>밤이</strong> 빵은 찾을게요. 그래도 다음에 또 막힐까 봐 걱정돼요.</p>':''}</div>`;
  if(c.pending){
   if(key==='photo')h+=quiz('effect','방금 선택은 무엇을 바꿨을까?',[['result','자르기 결과만'],['explanation','설명만'],['both','자르기 결과와 설명']],a.effect,'현재 사진 범위와 새로 붙인 설명을 함께 비교해 보자.');
   if(key==='face')h+=quiz('effect','이 조치는 사건 흐름의 어디를 바꿀까?',[['audience','자료 확인 주체와 공개 범위'],['restriction','입장 제한 조치'],['explanation','고객에게 전달하는 설명']],a.effect,'선택한 조치에서 실제 바뀐 화면 상태나 제안을 다시 보자.');
   if(key==='writing'){
    h+=quiz('tool-question','“어떤 문장 특징 때문에 표시됐나?”',[['tool','도구에 더 물을 것'],['process','작성 과정에서 확인할 것']],'tool','문장의 특징과 탐지 기준에 관한 질문은 도구에 물을 내용이야.');
    h+=quiz('process-question','“이 문단을 어떻게 바꿨나?”',[['tool','도구에 더 물을 것'],['process','작성 과정에서 확인할 것']],'process','고친 과정은 작성자의 설명과 남아 있는 자료를 함께 보자.');
    if(taskDone('effect'))h+='<p class="task-status">두 질문의 확인 경로를 연결했어요.</p>';
   }
   h+=`<div class="inline-actions">${btn('함께 확인하기','help')}${btn('이 선택으로 계속','confirm',E.canConfirm(state)?'':'disabled','primary')}${btn('다시 선택','rechoose')}</div>`;
  }else h+=`<p><strong>후일담</strong> ${a.epilogue}</p><p class="hint">${D.notebook[key].summary}</p>`;
  return h;
 }
 function finalWork(){let h='<h2>내가 남긴 조사 기록</h2>'+summary();if(state.completed)return h+`<section class="ending"><span class="expression relief" role="img" aria-label="안도하는 모아"></span><p class="ending-quote">상자를 여는 첫 번째 도구는, 질문이었다.</p><div class="button-list">${btn('내 수첩 다시 보기','notebook')}${btn('참고한 실제 사례','sources')}${btn('토론 질문','discussion')}</div></section>`;
  h+='<section class="quiz"><h3>새로운 가상 추천</h3><p>모아에게 ‘밤하늘 관찰 모임’을 추천합니다.</p><p>먼저 어떤 질문을 할까? 세 질문 모두 유효합니다.</p><div class="button-list">';
  [['input','어떤 정보를 썼지?'],['criteria','무엇을 기준으로 추천했지?'],['unknown','확인하지 못한 건 뭐지?']].forEach(([id,t])=>h+=btn(t,'recommend',`data-id="${id}"`));h+='</div>'+status('question')+'</section>';
  if(taskDone('question'))h+=quiz('schedule','추천의 적합성을 판단하려면 어떤 자료가 도움이 될까?',[['schedule','실제 운영 일정'],['color','화면 장식 색상'],['length','추천 문구 글자 수']],'schedule','화면의 모양은 알 수 있지만 실제로 참여할 수 있는지 확인하는 데는 부족합니다.')+btn('함께 확인하고 계속','help');return h;
 }
 function summary(){return Object.entries(D.actions).map(([key,acts])=>{const c=state.cases[key],name=id=>acts.find(a=>a.id===id)?.label||'아직 선택하지 않음',a=acts.find(a=>a.id===c.final);return `<section class="case-summary"><h3>${{photo:'사진',writing:'발표 원고',face:'빵집'}[key]}</h3><dl><dt>첫 조치</dt><dd>${name(c.first)}</dd><dt>최종 조치</dt><dd>${name(c.final)}</dd><dt>도움 이용</dt><dd>${c.help?'함께 확인 경로 이용 · 독립 이해로 판정하지 않음':'이용하지 않음'}</dd></dl>${a?`<p>${a.epilogue}</p>`:''}</section>`;}).join('');}
 function focusSelector(){const el=document.activeElement;if(!$('#app').contains(el))return null;const attrs=['data-act','data-task','data-value','data-id','data-kind','data-index','data-crop-control'];const parts=attrs.filter(a=>el.hasAttribute(a)).map(a=>`[${a}="${CSS.escape(el.getAttribute(a))}"]`);return parts.length?el.tagName.toLowerCase()+parts.join(''):null;}
 function render(){const focus=focusSelector(),sc=D.scenes[state.scene];$('#app').innerHTML=`<div class="scene-heading"><div><p class="meta">S${String(state.scene).padStart(2,'0')} · ${state.scene<=4?'사진 사건':state.scene<=8?'발표 원고 사건':state.scene<=12?'빵집 사건':'마지막 수첩'}</p><h1 tabindex="-1">${sc.title}</h1></div><p class="hint">물어보기 · 조사 · 대조 · 조치</p></div><div class="layout"><div class="story-column">${stage()}${dialogue()}</div><section class="work" id="work" tabindex="-1" aria-label="조사와 선택">${renderWork()}<div id="feedback" class="feedback" role="status" aria-live="polite">${esc(feedback)}</div>${state.completed&&state.scene===13?'':nextArea()}</section></div>`;paint();save();if(focus){const target=$('#app').querySelector(focus);(target&&!target.disabled?target:$('#work')).focus({preventScroll:true});}}
 function open(title,html){lastFocus=document.activeElement;$('#modal-title').textContent=title;$('#modal-body').innerHTML=html;if(!modal.open)modal.showModal();paint();}
 function close(){modal.close();lastFocus?.isConnected&&lastFocus.focus();}
 function evidence(id){const ev=D.evidence[id];state=E.reduce(state,{type:'read',id});render();let h=ev.text.map(t=>`<p>${esc(t)}</p>`).join('');
  if(ev.kind==='photo')h+=fullPhoto()+btn('원본 크게 보기','zoom');
  if(ev.kind==='record')h+=fullPhoto(true)+`<p class="hint">중심 (1200, 250) · 범위 x=900, y=50, 너비=600, 높이=400 · 원본 1536×1024 픽셀</p>${canvas(E.AUTO,'P3 실행 기록대로 자른 사진')}`;
  if(ev.kind==='faces')h+=`<img class="zoom-photo" src="${A.faces}" alt="흐릿하고 문틀과 반사에 가려진 가상의 고양이 얼굴 비교 사진">`;
  if(ev.kind==='report')h+=`<div class="document"><span class="status-tag">AI 작성 의심</span><p><mark>${D.drafts.revision}</mark></p></div>`;
  if(ev.kind==='drafts')h+=Object.entries(D.drafts).map(([k,t])=>`<section class="document"><h3>${{draft:'초안',memo:'메모',revision:'수정본'}[k]}</h3><p>${t}</p></section>`).join('');
  open(id+' · '+ev.title,h);
 }
 function help(){if(!E.readyEvidence(state))return;const n=state.scene;const explanations={2:'P2는 가장 높은 예측값을 고른다고 해. 왼쪽 2, 가운데 5, 오른쪽 8 중 8이 가장 높아. 오른쪽 중심점과 실제 미리보기를 함께 확인하자.',3:'도구가 밝힌 기준은 P2, 이번 실행 기록은 P3야. 최고 값의 위치를 중심으로 잘랐다는 건 확인했지만, 왜 그 값이 높은지 모두 알아낸 것은 아니야.',4:'자동 범위를 유지하면 설명만 바뀌어. 직접 범위를 고르거나 담이를 중심으로 고르면 사진과 붙인 설명이 함께 바뀌어. 직접 고르기에서는 다섯 친구를 모두 포함할 수 있게 전체 보기를 함께 적용하자.',6:'초안 → 메모 → 수정본 순서야. “손잡이를 잡고도 한참 서 있었다”가 망설임과 연결돼. 루루는 바로 기뻐하면 갑작스러워서 들어가기 전에 망설이게 했다고 설명했어.',7:'W2는 표시가 작성자를 증명하지 않는다는 한계를 알려줘. W3의 초안은 일부 과정의 기록이며 모든 과정을 보증하지 않아.',8:'어떤 문장 특징 때문에 표시됐는지는 도구에 더 물을 내용이야. 문단을 어떻게 고쳤는지는 작성자의 설명과 작성 과정 자료에서 확인해.',10:'유사 얼굴 알림 → 같은 손님이라고 해석 → 입장 제한. 첫 문장에는 F1, 뒤의 두 문장에는 F3을 붙여. F2는 신원을 확정하기 어렵다는 자료일 뿐 오류 원인 증명은 아니야.',11:'“확정했어요”를 F1과 대조하면 확인 요청이었음을 알 수 있어. 그 요청과 충돌하는 즉시 제한 지침은 F3에 있어.',12:'주민 비교는 확인 주체와 공개 범위, 제한 해제는 입장 조치, 안내 추가는 전달하는 설명을 바꿔.',13:'실제 운영 일정은 참여 조건을 확인하는 데 도움이 돼. 이것만으로 모든 적합성이 확인되는 것은 아니야.'};open('함께 확인하기',`<p>${explanations[n]}</p><p class="hint">이 경로를 이용하면 “함께 확인함”으로 남습니다. 독립 이해를 달성했다고 표시하지 않습니다.</p>${btn('함께 확인하고 계속','accept-help','','primary')}`);}
 function showNotebook(){let h='<div class="inline-actions">'+btn('확인한 자료 다시 열기','library')+'</div>';for(const [key,start]of [['photo',3],['writing',7],['face',11]]){const note=D.notebook[key];h+=`<section class="case-summary"><h3>${{photo:'사진',writing:'발표 원고',face:'빵집'}[key]}</h3>`;if(state.furthest<start||!(E.requirements[start].tasks.every(t=>state.tasks[start+':'+t]))){h+='<p>아직 조사 중입니다. 확인한 단서는 자료 모음에서 다시 볼 수 있어요.</p></section>';continue;}h+='<div class="notebook-grid">'+[['result','결과를 살피기'],['response','대응을 살피기']].map(([k,title])=>`<div><h3>${title}</h3><dl>${note[k].map(([t,v])=>`<dt>${t}</dt><dd>${v}</dd>`).join('')}</dl></div>`).join('')+'</div><p>'+note.summary+'</p></section>';}open('내 수첩',h+summary());}
 function sources(){open('참고한 실제 사례',`<p>도시·동물·대사·문서·수치·선택 결과는 모두 창작입니다. 실제 기업의 모델이나 내부 문서를 재현하지 않았습니다.</p><ul><li><a target="_blank" rel="noopener" href="https://www.nist.gov/publications/four-principles-explainable-artificial-intelligence">NIST (2021)</a>: 설명·이해 가능성·설명 정확성·지식 한계의 개념 참고.</li><li><a target="_blank" rel="noopener" href="https://blog.x.com/engineering/en_us/topics/insights/2021/sharing-learnings-about-our-image-cropping-algorithm">Twitter (2021)</a>: 자동 자르기와 사용자 통제 문제 참고.</li><li><a target="_blank" rel="noopener" href="https://www.vanderbilt.edu/brightspace/2023/08/16/guidance-on-ai-detection-and-why-were-disabling-turnitins-ai-detector/">Vanderbilt (2023)</a>: AI 탐지 기능 비활성화 발표와 신뢰성·설명 부족 우려 참고.</li><li><a target="_blank" rel="noopener" href="https://www.ftc.gov/news-events/news/press-releases/2023/12/rite-aid-banned-using-ai-facial-recognition-after-ftc-says-retailer-deployed-technology-without">FTC (2023)</a>: Rite Aid에 대한 규제기관의 주장과 제안된 합의 명령 발표 참고. 주장을 모두 법적으로 확정된 사실로 표현하지 않으며, 2023년 발표를 현재의 법적·운영 상태로 단정하지 않습니다.</li></ul><p class="hint">링크를 열 때만 외부 사이트로 이동합니다. 게임 진행이나 선택을 외부로 전송하지 않습니다.</p>`);}
 document.addEventListener('click',e=>{
  const b=e.target.closest('button[data-act]');if(!b||b.disabled)return;const act=b.dataset.act;
  if(act==='close'){close();return;}
  if(act==='prev-line'||act==='next-line'){line+=act==='prev-line'?-1:1;render();return;}
  if(act==='start'){line=0;send({type:'next'},'');return;}
  if(act==='later'){feedback='사진 사건을 살핀 뒤에 열립니다.';render();return;}
  if(act==='next'){if(line<D.scenes[state.scene].lines.length-1)return;const before=state.scene;state=E.reduce(state,{type:'next'});if(before!==state.scene){line=0;overlay=false;showOriginal=false;linkAnswers={};}feedback='';render();$('h1').focus();window.scrollTo(0,0);return;}
  if(act==='evidence'){evidence(b.dataset.id);return;}
  if(act==='ask'){
   const answers={'photo-purpose':'루루: 축제를 함께 준비한 친구들을 소개하려고.','photo-cut':'담이는 원본의 앞줄 가운데에 있어. 표시한 얼굴이 자동 미리보기 범위 밖인지 비교해 봐.','presentation':'교사: 아직 그런 결정을 한 건 아니야.','blocked':'점원: 경고가 뜨면 막으라고 배웠어요.'};if(b.dataset.id==='photo-cut')showOriginal=true;feedback=answers[b.dataset.id];render();return;
  }
  if(act==='photo-zoom'){open('원본과 현재 미리보기',`<div class="photo-compare"><figure><figcaption>원본</figcaption>${fullPhoto(false,true)}</figure><figure><figcaption>현재 범위</figcaption>${canvas(state.scene===4?E.outcome(state,'photo').rect||E.AUTO:E.AUTO)}</figure></div>`);return;}
  if(act==='zoom'){open('축제 단체 사진 원본',fullPhoto());return;}
  if(act==='compare'){showOriginal=!showOriginal;send({type:'solve',id:'compare',correct:true},'원본과 자동 미리보기를 비교했어요. 담이는 원본에 있지만 미리보기에는 없어요.');return;}
  if(act==='overlay'){overlay=!overlay;showOriginal=true;send({type:'solve',id:'overlay',correct:true},'노란 테두리는 실제 잘린 범위, 점은 선택 중심입니다.');return;}
  if(act==='answer'){
   const correct=b.dataset.value===b.dataset.answer,id=b.dataset.task;
   if(['tool-question','process-question'].includes(id)){if(correct)linkAnswers[id]=true;if(linkAnswers['tool-question']&&linkAnswers['process-question'])state=E.reduce(state,{type:'solve',id:'effect',correct:true});feedback=correct?'이 질문을 확인할 곳을 연결했어요.':b.dataset.wrong;render();return;}
   const msg=correct?(id==='schedule'?'실제 참여 조건을 확인할 수 있습니다. 이것만으로 모든 적합성이 확인되는 것은 아닙니다.':'자료와 연결했어요. 남아 있는 질문도 계속 살펴보세요.'):b.dataset.wrong;
   send({type:'solve',id,correct},msg);return;
  }
  if(act==='why'){send({type:'solve',id:'why',correct:true},'루루: 바로 기뻐하면 너무 갑작스러워서, 들어가기 전에 망설이게 했어.');return;}
  if(act==='move'){let list=b.dataset.kind==='order'?order:flow;const i=Number(b.dataset.index);[list[i-1],list[i]]=[list[i],list[i-1]];render();return;}
  if(act==='check-order'){const writing=b.dataset.kind==='order';const right=(writing?order:flow).join(',')===(writing?'draft,memo,revision':'alert,interpret,action');send({type:'solve',id:writing?'order':'flow',correct:right},right?'일어난 순서를 연결했어요.':writing?'먼저 쓴 문장, 고치려던 메모, 실제 고친 문장 순으로 살펴보자.':'기계가 알린 것, 사람이 해석한 것, 실행한 조치를 차례로 놓아 보자.');return;}
  if(act==='choose'){linkAnswers={};send({type:'choose',id:b.dataset.id},'아직 확정 전입니다. 결과와 바뀐 곳을 확인해 주세요.');return;}
  if(act==='full-crop'){send({type:'crop',rect:[0,0,1536,1024]},'전체 범위에 다섯 친구가 모두 들어왔어요. 실제 바뀐 부분을 아래에서 확인해 주세요.');return;}
  if(act==='confirm'){send({type:'confirm'},'선택을 기록했어요. 아래 후일담을 확인하고 다음 장면으로 갈 수 있어요.');return;}
  if(act==='rechoose'){$('#work').scrollIntoView({block:'start'});$('#work .button-list button')?.focus();return;}
  if(act==='help'){send({type:'help-view'});help();return;}
  if(act==='accept-help'){close();if(state.scene===4&&state.cases.photo.pending==='manual')state=E.reduce(state,{type:'crop',rect:[0,0,1536,1024]});if(state.scene===2){showOriginal=true;overlay=true;}if(state.scene===6)order=['draft','memo','revision'];if(state.scene===10)flow=['alert','interpret','action'];send({type:'help'},'함께 확인한 활동으로 기록했습니다. 선택이 있는 장면에서는 “이 선택으로 계속”을 눌러 주세요.');return;}
  if(act==='recommend'){const t={input:'선택한 관심사 ‘별’과 ‘야외 활동’을 사용했습니다.',criteria:'관심사와 연결된 모임을 우선했습니다. 구체적인 순위 산출 이유는 제공되지 않았습니다.',unknown:'실제 운영 상태와 귀가 교통편은 확인하지 못했습니다.'};send({type:'solve',id:'question',correct:true},t[b.dataset.id]);return;}
  if(act==='notebook'){if(state.scene===0){open('모아의 첫 질문','<span class="prop notebook" aria-hidden="true"></span><p>무엇을 입력했지?</p><p>어떤 결과가 나왔지?</p><p>설명은 기록과 맞을까?</p><p>아직 모르는 건 무엇이지?</p>');}else showNotebook();return;}
  if(act==='library'){open('확인한 자료 모음',state.evidence.length?evidenceButtons(state.evidence):'<p>아직 확인한 자료가 없습니다.</p>');return;}
  if(act==='scenes'){const pending=Object.values(state.cases).some(c=>c.pending);open('장면 기록',`<p class="hint">${pending?'변경 중인 선택을 먼저 확인하고 “이 선택으로 계속”을 눌러 주세요.':'이미 도달한 장면을 다시 살펴볼 수 있습니다. 최초 조치는 남고, 변경을 확정할 때 최종 조치가 갱신됩니다.'}</p><div class="scene-list">${D.scenes.map((s,i)=>btn(`S${String(i).padStart(2,'0')} ${s.title}`,'revisit',`data-scene="${i}" ${i>state.furthest||pending?'disabled':''}`)).join('')}</div>`);return;}
  if(act==='revisit'){close();line=0;send({type:'revisit',scene:Number(b.dataset.scene)},'');return;}
  if(act==='sources'){sources();return;}
  if(act==='discussion'){open('토론 질문','<ol><li>설명을 들었지만 문제가 해결되지 않은 장면은 어디였나?</li><li>끝까지 알 수 없었던 것은 무엇이고, 그래도 바꿀 수 있었던 조치는 무엇인가?</li></ol>');return;}
  if(act==='settings'){open('설정',`<p>진행은 이 브라우저에만 저장됩니다. 계정 가입이나 교사용 수집은 없습니다.</p><div class="button-list">${btn('참고한 실제 사례','sources')}${btn('진행 초기화하기','reset-ask')}</div><p class="hint">플레이 시간과 교육 효과는 아직 실제 학생을 대상으로 검증하지 않았습니다.</p>`);return;}
  if(act==='reset-ask'){open('진행 초기화',`<p>이 게임의 진행과 선택 기록을 지웁니다. 공통 플레이어 정보와 다른 게임 기록은 유지합니다.</p>${btn('초기화하고 처음으로','reset')}`);return;}
  if(act==='reset'){close();state=E.initial();line=0;feedback='';render();}
 });
 document.addEventListener('change',e=>{const control=e.target.dataset.cropControl;if(!control)return;let [x,y,w,h]=state.crop;const value=Number(e.target.value);if(control==='width'){w=value;h=Math.round(w*2/3);x=Math.min(x,1536-w);y=Math.min(y,1024-h);}if(control==='x')x=value;if(control==='y')y=value;send({type:'crop',rect:[x,y,w,h]},'사진 범위를 바꿨어요. 다섯 친구가 모두 보이는지 확인해 주세요.');});
 modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 modal.addEventListener('close',()=>{if(lastFocus?.isConnected&&!lastFocus.disabled)lastFocus.focus({preventScroll:true});});
 window.TransparencyGame={getState:()=>JSON.parse(JSON.stringify(state)),storageKey:KEY};
 render();
})();
