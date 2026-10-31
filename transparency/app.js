(()=>{
 'use strict';
 const C=window.TransparencyClaims,E=window.TransparencyEngine,D=window.TransparencyStory,A=D.art;
 const KEY='ethicity.transparency.progress.v1',preview=new URLSearchParams(location.search).get('preview')==='s01';
 const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let raw=null,saveOK=true,nickname='조사자';
 try{raw=localStorage.getItem(KEY);const p=JSON.parse(localStorage.getItem('ethicity.player'));if(p&&typeof p.nickname==='string')nickname=p.nickname.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40)||nickname;}catch{saveOK=false;}
 let state=E.restore(raw),line=0,feedback='',overlay=false,showOriginal=false,claimEvidence={},claimFeedback={},notebookOpen=false,noteSeen={},lastFocus=null;
 if(preview){state=E.initial();state.scene=1;state.furthest=1;}
 const photo=new Image();photo.src=A.photo;photo.onload=paint;
 const modal=$('#modal');
 const taskDone=id=>state.tasks[state.scene+':'+id];
 function save(){if(!preview)try{localStorage.setItem(KEY,JSON.stringify(state));saveOK=true;}catch{saveOK=false;}$('#save-status').textContent=preview?'S01 미리보기 · 진행 저장 안 함':saveOK?'이 기기에 진행 자동 저장 · '+nickname:'저장할 수 없어 현재 창에서만 진행합니다. 창을 닫으면 기록이 사라집니다.';}
 function send(a,msg){state=E.reduce(state,a);if(msg!==undefined)feedback=msg;save();render();}
 function btn(label,act,attrs='',cls=''){return `<button ${cls?`class="${cls}"`:''} data-act="${act}" ${attrs}>${label}</button>`;}
 function status(id){const v=taskDone(id);return v?`<span class="task-status">${v==='helped'?'함께 확인함':'직접 확인함'}</span>`:'';}
 function quiz(id,title,opts,answer,wrong){
  return `<section class="quiz" data-task="${id}"><h3>${title} ${status(id)}</h3><div class="button-list">${opts.map(([value,label])=>btn(esc(label),'answer',`data-task="${id}" data-value="${value}" data-answer="${answer}" data-wrong="${esc(typeof wrong==='object'?wrong[value]:wrong)}"`)).join('')}</div></section>`;
 }
 function evidenceButtons(ids){return `<div class="evidence-nav">${ids.map(id=>btn(`${id} ${esc(D.evidence[id].title)}${state.evidence.includes(id)?' · 확인함':''}`,'evidence',`data-id="${id}"`)).join('')}</div>`;}
 function fullPhoto(mark=false,dami=false){return `<div class="photo-frame"><img src="${A.photo}" alt="다섯 친구가 모두 나온 축제 원본. 담이는 앞줄 가운데.">${mark?`${state.scene!==2||taskDone('center')?'<div class="values"><span>왼쪽 2</span><span>가운데 5</span><span>오른쪽 8</span></div>':''}<span class="crop-border" style="left:58.59375%;top:4.8828125%;width:39.0625%;height:39.0625%"></span><span class="center-dot" style="left:78.125%;top:24.4140625%"></span>`:''}${dami?'<span class="crop-border" style="left:44.5%;top:33.5%;width:12%;height:17%"></span>':''}</div>`;}
 function canvas(rect=E.AUTO,label='선택한 범위의 사진'){return `<canvas class="photo-canvas" width="${rect[2]}" height="${rect[3]}" data-crop="${rect.join(',')}" role="img" aria-label="${label}"></canvas>`;}
 function paint(){if(!photo.complete||!photo.naturalWidth)return;document.querySelectorAll('canvas[data-crop]').forEach(c=>{const rect=c.dataset.crop.split(',').map(Number);const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(photo,...rect,0,0,c.width,c.height);});}
 function stage(){const sc=D.scenes[state.scene];let cast=sc.cast.slice();const o=E.outcome(state,'face');if(state.scene===12&&o.id==='release')cast=cast.map(c=>c==='clerk'?'clerkOpen':c);
  const statusText=state.scene>=9&&state.scene<=12?(state.scene===12&&o.id==='release'?'입장 제한 해제':'입장 제한 중'):'';
  return `<div class="stage"><img class="backdrop" src="${A.backgrounds[sc.bg]}" alt="${['저녁 골목과 수리점','축제 게시판 앞','학교 복도와 교실 문','빵집 입구'][sc.bg]}">${state.scene>=1&&state.scene<=4?`<button class="stage-photo" data-act="photo-zoom" aria-label="사진 미리보기 크게 보기">${canvas(state.scene===4?E.outcome(state,'photo').rect||E.AUTO:E.AUTO,'게시판 사진 미리보기')}</button>`:''}${[0,13].includes(state.scene)?`<div class="stage-boxes" aria-hidden="true">${[0,1,2].map(()=>`<span class="prop ${state.scene===0?'box':'window'}"></span>`).join('')}</div>`:''}${statusText?`<span class="stage-status">${statusText}</span>`:''}<div class="cast">${cast.map(c=>`<img class="actor ${c}" src="${A[c]}" alt="${D.names[c]||D.names[c==='clerkOpen'?'clerk':'lulu']}">`).join('')}</div></div>`;
 }
 function dialogue(){const lines=D.scenes[state.scene].lines,[who,text]=lines[Math.min(line,lines.length-1)];return `<section class="dialogue" aria-label="대화"><div class="speaker-row"><span class="speaker">${D.names[who]}</span><span class="line-count">${line+1} / ${lines.length}</span></div><p id="dialogue-text" aria-live="polite">${esc(text)}</p><div class="dialogue-actions">${btn('이전 대사','prev-line',line===0?'disabled':'')}${btn(line<lines.length-1?'다음 대사':'대화 읽음','next-line',line===lines.length-1?'disabled':'',line<lines.length-1?'primary':'')}</div><details class="transcript"><summary>대화 전체 다시 보기</summary>${lines.map(([w,t])=>`<p><strong>${D.names[w]}</strong> ${esc(t)}</p>`).join('')}</details></section>`;}
 function after(){const lines=D.scenes[state.scene].after;if(!lines||!E.canAdvance(state))return '';return `<div class="after-lines">${lines.map(([w,t])=>`<div class="after-line">${w==='moa'?'<span class="expression focus" role="img" aria-label="집중하는 모아"></span>':''}<p><strong>${D.names[w]}</strong>${esc(t)}</p></div>`).join('')}</div>`;}
 function cropDescription(){return E.allFaces(state.crop)?'함께 준비한 친구가 보이도록 사람이 범위를 조정했습니다.':state.crop.every((v,i)=>v===E.AUTO[i])?'아직 범위를 조정하지 않았습니다(자동 범위와 같음).':'사람이 범위를 조정 중입니다. 아직 다섯 얼굴이 모두 들어오지 않았습니다.';}
 const taskLabels={compare:'원본과 비교',overlay:'값·중심점 보기',center:'중심 위치 판정',why:'작성자에게 묻기',trace:'출력·해석·조치 나눠 읽기',question:'추천에 질문하기',schedule:'참여 조건 확인'};
 function successMessage(id){return {center:'가장 높은 값이 있는 오른쪽 위치가 중심입니다.',effect:'선택한 조치가 바꾸는 부분을 예측했습니다. 이제 확정 후 결과와 비교해 보세요.'}[id]||'이 질문을 확인할 자료를 연결했습니다.';}
 function remaining(){const r=E.requirements[state.scene]||{evidence:[],tasks:[]};const items=[...r.evidence.map(id=>({name:id+' '+D.evidence[id].title,done:state.evidence.includes(id)})),...r.tasks.map(id=>({name:C.find(state.scene,id)?.text||taskLabels[id]||id,done:!!taskDone(id)}))];if([4,8,12].includes(state.scene)){const c=state.cases[E.caseKey(state.scene)];items.push({name:'조치 선택',done:!!(c.pending||c.final)},{name:'바뀌는 부분 확인',done:!!taskDone('effect')},{name:'조치 확정',done:!!c.final&&!c.pending});if(!c.pending&&c.final==='manual')items.push({name:'다섯 친구 포함',done:E.allFaces(state.crop)});}if(line<D.scenes[state.scene].lines.length-1)items.push({name:'대화 끝까지 읽기',done:false});return items;}
 function nextArea(){if(state.scene===0)return '';const ready=E.canAdvance(state)&&line===D.scenes[state.scene].lines.length-1,items=remaining();const label=state.scene===13?'내 조사 마치기':state.scene===1?'조사하기':state.scene===5?'자료 살피기':state.scene===9?'기록 살피기':'다음 장면';return `<div class="next-row"><ul class="activity-checklist" aria-label="필수 활동">${items.map(x=>`<li>${x.done?'완료':'미완료'} · ${esc(x.name)}</li>`).join('')}</ul>${btn(label,'next',ready?'':'disabled','primary')}<p class="hint">${ready?'확인한 내용은 수첩에 남습니다.':'남은 활동: '+(items.filter(x=>!x.done).map(x=>x.name).join(', ')||'이전 사건의 조사 완료')}</p></div>`;}
 function helpButton(){const emphasized=Object.entries(state.attempts).some(([id,n])=>id.startsWith(state.scene+':')&&n>=2&&!state.tasks[id]);return btn(emphasized?'함께 확인하기 · 막힌 주장을 같이 살펴봐요':'함께 확인하기','help','',emphasized?'help-emphasis':'');}
 function claimCards(){return `<p class="hint">주장마다 근거 자료 하나를 고르고 도장을 찍어 주세요. 자료가 말하지 않는 것은 알 수 없다고 남겨도 됩니다.</p>`+(C.claims[state.scene]||[]).map(c=>{const done=taskDone(c.id),record=state.claims[state.scene+':'+c.id],selected=record?.evidence||claimEvidence[c.id];return `<section class="quiz claim-card" data-claim="${c.id}"><h3>${esc(c.speaker)}의 주장 ${status(c.id)}</h3><p>${esc(c.text)}</p><fieldset ${done?'disabled':''}><legend>근거 자료</legend><div class="evidence-nav">${D.scenes[state.scene].evidence.map(id=>btn(id+' '+esc(D.evidence[id].title),'claim-evidence',`data-task="${c.id}" data-id="${id}" aria-pressed="${selected===id}"`)).join('')}</div><div class="stamp-buttons" role="group" aria-label="주장 판정">${Object.entries(C.stamps).map(([stamp,label])=>btn(label,'stamp',`data-task="${c.id}" data-value="${stamp}" aria-pressed="${record?.stamp===stamp}" ${!selected?'disabled':''}`)).join('')}</div></fieldset>${!done&&claimFeedback[c.id]?`<p class="feedback" role="status">${esc(claimFeedback[c.id])}</p>`:''}${done?`<p class="claim-result" role="status">${C.stamps[record.stamp]} · ${record.evidence}<br>${esc(c.note)}</p>`:''}</section>`;}).join('');}
 function renderWork(){const n=state.scene;let h='';
  if(n===0)return `<h2>다섯 명이 찍었는데, 사진에는 한 친구가 없다.</h2><p>이유를 알면, 문제도 풀릴까?</p><section class="mission"><h3>너는 모아마을의 조사자야.</h3><p>사건마다 AI의 설명을 자료와 대조해 세 가지를 가려내.</p><ul class="mission-frame"><li>자료로 확인된 것</li><li>아직 알 수 없는 것</li><li>그래서 해도 되는 조치</li></ul></section><div class="box-row">${btn('<span class="prop box" aria-hidden="true"></span>사진 상자 열기','start','','primary')}${btn('<span class="prop box" aria-hidden="true"></span>원고 상자','later')}${btn('<span class="prop box" aria-hidden="true"></span>빵집 상자','later')}</div><p class="hint">이 마을과 조사 자료는 창작입니다. 실제 사례에서 문제의 구조를 참고했습니다.</p>`;
  if([1,5,9].includes(n)){
   h='<h2>먼저 물어보기</h2>';
   if(n===1)h+=`<div class="button-list">${btn('무슨 사진이야?','ask','data-id="photo-purpose"')}${btn('어디가 잘렸어?','ask','data-id="photo-cut"')}</div>${btn(showOriginal?fullPhoto(false,true):canvas(E.AUTO,'담이 얼굴이 제외된 자동 미리보기'),'photo-zoom','aria-label="원본과 미리보기 크게 비교"','photo-open')}<p class="hint">사진을 누르면 크게 비교할 수 있어요.</p>`;
   if(n===5)h+=`<div class="button-list">${btn('발표에서 빠지는 거야?','ask','data-id="presentation"')}${btn('과제 규칙은 뭐였어?','evidence','data-id="W3"')}</div>`;
   if(n===9)h+=`<div class="button-list">${btn('화면 다시 보기','evidence','data-id="F1"')}${btn('왜 막았나요?','ask','data-id="blocked"')}</div>`;
   return h;
  }
  if([4,8,12].includes(n))return actionWork();
  if(n===13)return finalWork();
  h='<h2>자료 살피기</h2><p class="hint">자료를 모두 열어 본 뒤 주장과 대조할 수 있어요.</p>'+evidenceButtons(D.scenes[n].evidence);
  if(!E.readyEvidence(state))return h+'<p>먼저 위의 자료를 모두 확인해 주세요. 확인한 자료도 언제든 다시 열 수 있습니다.</p>';
  if(C.claims[n])h+=claimCards();
  if(n===2){h+=`<h3>원본과 미리보기 비교 ${status('compare')}</h3>${showOriginal?fullPhoto(overlay):canvas(E.AUTO,'자동 자르기 결과')}<div class="inline-actions">${btn(showOriginal?'미리보기 보기':'원본과 비교하기','compare')}${btn(overlay?'값·중심점 숨기기':'값·중심점 보기','overlay')}</div><h3>값·중심점 확인 ${status('overlay')}</h3><p class="hint">가상 예측값은 정답 확률이나 사람의 가치 점수가 아닙니다. 숫자는 P3에서 살펴보고, 중심 위치를 판정하면 이 화면에도 표시됩니다.</p>`;
   h+=quiz('center','P2 규칙대로라면 어느 영역의 위치가 중심일까?',[['left','왼쪽'],['middle','가운데'],['right','오른쪽']],'right',{left:'왼쪽 값은 2야. P2가 가장 작은 값을 고르라고 했는지 다시 보자.',middle:'가운데 값은 5야. P3의 다른 값과 비교해 가장 높은 위치를 찾아보자.'});}
  if(n===6){h+=Object.entries(D.drafts).map(([k,t])=>`<section class="document"><h3>${{draft:'초안',memo:'메모',revision:'수정본'}[k]}</h3><p>${esc(t)}</p></section>`).join('');h+=`<section class="quiz"><h3>작성자에게 묻기 ${status('why')}</h3>${btn('루루에게 “왜 바꿨니?” 묻기','why')}</section>`;}
  if(n===10){h+=`<section class="document"><h3>사건의 세 단계 ${status('trace')}</h3><ol><li>출력: 유사 얼굴 알림, 직원 확인 필요 (F1)</li><li>해석: 전에 문제를 일으킨 같은 손님 (F3 직원 발언)</li><li>조치: 즉시 입장 제한 (F3 대응 지침)</li></ol><p>F2의 사진만으로 같은 사람인지 확정할 수 있는지도 살펴봐.</p>${btn('출력·해석·조치를 나눠 읽었어요','trace')}</section>`;}
  return h+helpButton()+after();
 }
 function actionWork(){const key=E.caseKey(state.scene),c=state.cases[key],id=c.pending||c.final,a=D.actions[key].find(a=>a.id===id);let h='<h2>어떤 조치를 할까?</h2><div class="action-options">'+D.actions[key].map(x=>`<section>${btn(x.label,'choose',`data-id="${x.id}" aria-pressed="${id===x.id}"`)}<p class="hint">${esc(x.plan)}</p></section>`).join('')+'</div>';
  if(!a)return h+'<p class="hint">조치를 고르고 무엇이 바뀔지 예측해 주세요. 결과와 인물의 반응은 확정한 뒤에 나타납니다.</p>';
  if(c.pending){
   h+=`<section class="decision"><h3>선택한 계획: ${esc(a.label)}</h3><p>${esc(a.plan)}</p>${key==='photo'&&a.id==='manual'?`<p class="hint">${c.final?'아직 새 범위를 조정하지 않았습니다. 이전 확정 사진은 유지됩니다. 새로 확정하면 자동 범위에서 다시 조정합니다.':'아직 범위를 조정하지 않았습니다(자동 범위와 같음). 확정 뒤 범위를 직접 조정합니다.'}</p>`:''}`;
   h+=quiz('effect','이 조치가 바꾸는 것은 무엇일까?',[['result','결과'],['explanation','설명'],['both','둘 다']],a.effect,{result:'계획에 결과나 처리 방식뿐 아니라 설명을 고치는 일도 있는지 살펴보자.',explanation:'사진 범위, 발표 여부, 확인을 맡길 사람, 입장 가능 여부도 바뀌는지 살펴보자.',both:'결과와 설명 중 그대로 유지하는 것이 있는지 계획을 다시 읽어 보자.'});
   return h+`<div class="inline-actions">${helpButton()}${btn('이 조치로 정하기','confirm',E.canConfirm(state)?'':'disabled','primary')}${btn('다시 선택','rechoose')}</div></section>`;
  }
  if(key==='photo'){
   h+=canvas(E.outcome(state,key).rect,'확정한 조치에 따른 사진 범위');
   if(a.id==='manual'){h+=`<div class="crop-controls"><label>가로 범위<input type="range" min="400" max="1536" step="1" value="${state.crop[2]}" data-crop-control="width"></label><label>가로 위치<input type="range" min="0" max="${1536-state.crop[2]}" value="${state.crop[0]}" data-crop-control="x"></label><label>세로 위치<input type="range" min="0" max="${1024-state.crop[3]}" value="${state.crop[1]}" data-crop-control="y"></label></div>${btn('전체 보기로 다섯 친구 포함하기','full-crop')}<p class="hint">키보드 방향키로도 조절할 수 있어요. ${E.allFaces(state.crop)?'다섯 친구의 얼굴이 범위에 들어왔어요.':'아직 범위 밖에 있는 얼굴이 있어요.'}</p>`;}
   h+=`<div class="document"><strong>사진에 붙일 설명</strong><p>${a.id==='auto'?'가장 높은 예측값의 위치를 중심으로 자동 자르기. 친구의 중요도를 판정한 결과가 아닙니다.':a.id==='manual'?cropDescription():'담이를 중심으로 범위를 고정했습니다. 다른 친구가 잘릴 수 있습니다.'}</p></div>`;
  }
  if(key==='face')h+=`<p class="status-tag">${a.id==='release'?'입장 제한 해제':'입장 제한 유지'}</p>`;
  if(key==='writing')h+=`<p class="status-tag">${a.id==='detector'?'발표 제외':'표시만으로 발표 보류하지 않음'}</p>`;
  const incomplete=key==='photo'&&a.id==='manual'&&!E.allFaces(state.crop);
  const response=key==='photo'&&a.id==='manual'?(incomplete?'아직 내 얼굴이나 다른 친구가 잘려 있어. 범위를 더 넓혀 줘.':'이제 다 보여. 이게 우리가 올리고 싶던 사진이야.'):a.response;
  h+=`<div class="outcome"><h3>${a.title}</h3><p>${esc(response)}</p>${a.detail?`<p>${esc(a.detail)}</p>`:''}${key==='face'&&a.id==='release'?'<p><strong>밤이</strong> 빵은 찾을게요. 그래도 다음에 또 막힐까 봐 걱정돼요.</p>':''}</div>`;
  if(!incomplete)h+=`<p><strong>후일담</strong> ${a.epilogue}</p><p class="hint">${D.notebook[key].summary}</p>`;
  return h+btn('다시 선택','rechoose');
 }
 function finalWork(){let h='<h2>내가 남긴 조사 기록</h2>'+summary();const missing=missingScenes();if(missing.length)h+=`<section><h3>이어 확인할 주장</h3><p>기존 조사 기록은 유지했습니다. 새 판정 활동이 남아 있는 장면을 확인해 주세요.</p><div class="button-list">${missing.map(n=>btn('S'+String(n).padStart(2,'0')+' '+D.scenes[n].title,'revisit',`data-scene="${n}"`)).join('')}</div></section>`;if(state.completed)return h+`<section class="ending"><span class="expression relief" role="img" aria-label="안도하는 모아"></span><p class="ending-quote">상자를 여는 첫 번째 도구는, 질문이었다.</p><div class="button-list">${btn('내 수첩 다시 보기','notebook')}${btn('참고한 실제 사례','sources')}${btn('토론 질문','discussion')}</div></section>`;
  h+='<section class="quiz"><h3>새로운 가상 추천</h3><p>모아에게 ‘밤하늘 관찰 모임’을 추천합니다.</p><p>먼저 어떤 질문을 할까? 세 질문 모두 유효합니다.</p><div class="button-list">';
  [['input','어떤 정보를 썼지?'],['criteria','무엇을 기준으로 추천했지?'],['unknown','확인하지 못한 건 뭐지?']].forEach(([id,t])=>h+=btn(t,'recommend',`data-id="${id}"`));h+='</div>'+status('question')+'</section>';
  if(taskDone('question'))h+=quiz('schedule','모아의 시간표와 맞는지 판단하려면 어떤 자료가 필요할까?',[['schedule','실제 운영 일정'],['color','다른 학생들의 추천 클릭 수'],['length','모임 소개 문구']],'schedule',{color:'클릭 수는 관심 정도를 보여줘. 내가 실제로 참석할 수 있는 시간도 확인해야 하지 않을까?',length:'소개 문구는 활동 내용을 알려줘. 실제로 언제 운영하는지도 확인해야 하지 않을까?'})+helpButton();return h;
 }
 function summary(){return Object.entries(D.actions).map(([key,acts])=>{const c=state.cases[key],name=id=>acts.find(a=>a.id===id)?.label||'아직 선택하지 않음',a=acts.find(a=>a.id===c.final);return `<section class="case-summary"><h3>${{photo:'사진',writing:'발표 원고',face:'빵집'}[key]}</h3><dl><dt>처음 확정한 조치</dt><dd>${name(c.first)}${c.legacyFirst?' (이전 저장에서는 마지막 확정만 복원 가능)':''}</dd><dt>최종 조치</dt><dd>${name(c.final)}</dd><dt>도움 이용</dt><dd>${c.help?'함께 확인 경로 이용 · 독립 이해로 판정하지 않음':'이용하지 않음'}</dd></dl>${a?`<p>${key==='photo'&&a.id==='manual'&&!E.allFaces(state.crop)?'범위 조정 중입니다. 아직 다섯 친구가 모두 보이지 않습니다.':a.epilogue}</p>`:''}</section>`;}).join('');}
 function focusSelector(){const el=document.activeElement;if(!$('#app').contains(el))return null;const attrs=['data-act','data-task','data-value','data-id','data-kind','data-index','data-crop-control'];const parts=attrs.filter(a=>el.hasAttribute(a)).map(a=>`[${a}="${CSS.escape(el.getAttribute(a))}"]`);return parts.length?el.tagName.toLowerCase()+parts.join(''):null;}
 function render(){const focus=focusSelector(),sc=D.scenes[state.scene];$('#app').className='scene-'+state.scene;$('#app').innerHTML=`<div class="scene-heading"><div><p class="meta">S${String(state.scene).padStart(2,'0')} · ${state.scene===0?'프롤로그':state.scene<=4?'사진 사건':state.scene<=8?'발표 원고 사건':state.scene<=12?'빵집 사건':'마지막 수첩'}</p><h1 tabindex="-1">${sc.title}</h1></div>${boxProgress()}</div><div class="layout"><div class="story-column">${stage()}${dialogue()}</div><div class="activity-column"><section class="work" id="work" tabindex="-1" aria-label="조사와 선택">${renderWork()}<div id="feedback" class="feedback" role="status" aria-live="polite">${esc(feedback)}</div>${state.completed&&state.scene===13?'':nextArea()}</section>${liveNotebook()}</div></div>`;paint();save();if(focus){const target=$('#app').querySelector(focus);(target&&!target.matches(':disabled')?target:$('#work')).focus({preventScroll:true});}}
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
 function help(){if(!E.readyEvidence(state))return;const n=state.scene,key=E.caseKey(n),pending=key&&state.cases[key].pending,a=pending&&D.actions[key].find(a=>a.id===pending);let text='';
  if(C.claims[n])text=C.claims[n].map(c=>`<p><strong>${esc(c.text)}</strong><br>${c.evidence} · ${C.stamps[c.stamp]}<br>${esc(c.note)}</p>`).join('');
  else if(a)text=`<p>${esc(a.plan)}</p><p>이 계획은 ${ {result:'결과나 처리 방식',explanation:'설명',both:'결과와 설명을 모두'}[a.effect]} 바꿔. 확정한 뒤 실제 결과와도 비교하자.</p>`;
  else text='<p>'+({2:'P2는 가장 높은 예측값을 고른다고 해. 왼쪽 2, 가운데 5, 오른쪽 8 중 8이 가장 높아. 원본과 중심점을 함께 확인하자.',6:'초안, 메모, 수정본을 나란히 읽자. 루루는 결말이 갑작스러워서 손잡이를 잡고 망설이는 장면을 넣었다고 설명했어.',10:'F1은 유사 얼굴 알림과 확인 요청이야. F3에는 같은 손님이라는 해석과 즉시 제한 지침이 있어. F2만으로 신원은 확정할 수 없어.',13:'클릭 수나 소개 문구도 참고가 돼. 실제 운영 일정은 내가 참석할 수 있는지를 확인하는 자료야.'}[n]||'조치 계획을 먼저 골라 주세요.')+'</p>';
  open('함께 확인하기',text+`<p class="hint">아래 버튼을 눌러야 도움 이용으로 기록됩니다. 닫거나 Esc를 누르면 기록하지 않습니다.</p>${btn('함께 확인하고 계속','accept-help','','primary')}`);
 }
 const caseNames={photo:'사진',writing:'발표 원고',face:'빵집'};
 function noteRows(key){const scene={photo:3,writing:7,face:11}[key],prefix={photo:'P',writing:'W',face:'F'}[key],note=D.notebook[key],c=state.cases[key],a=D.actions[key].find(a=>a.id===c.final),records=C.claims[scene].filter(x=>state.claims[scene+':'+x.id]);
  const notes=stamp=>records.filter(c=>c.stamp===stamp).map(c=>c.note).join(' '),all=records.length===C.claims[scene].length,done=all&&!!a&&!c.pending&&(key!=='photo'||a.id!=='manual'||E.allFaces(state.crop));
  return {done,rows:[['입력',state.evidence.includes(prefix+(key==='writing'?'3':key==='face'?'2':'1'))?note.result[0][1]:''],['출력',state.evidence.includes(prefix+(key==='photo'?'3':'1'))?note.result[1][1]:''],['설명',notes('confirmed')],['아직 모르는 점',notes('unknown')],['사람의 해석',notes('different')],['실행한 조치',a?a.label+(key==='photo'&&a.id==='manual'&&!E.allFaces(state.crop)?' · 범위 조정 중':''):''],['다음 확인',all&&a?note.response[2][1]:'']]};
 }
 function notebookContent(key,animate=false){const {rows,done}=noteRows(key);return `<h3>${caseNames[key]} 사건 ${done?'<span class="task-status">수첩 완성</span>':'<span class="hint">조사 중</span>'}</h3><dl class="live-note">${rows.map(([label,value],i)=>{const id=key+':'+i,fresh=animate&&!!value&&noteSeen[id]!==value;if(animate)noteSeen[id]=value;return `<div class="note-field ${value?'filled':''} ${fresh?'just-filled':''}"><dt>${label}</dt><dd>${esc(value||'아직 기록하지 않음')}</dd></div>`;}).join('')}</dl>`;}
 function liveNotebook(){if(state.scene===0||state.scene===13)return '';const key=E.caseKey(state.scene),count=noteRows(key).rows.filter(x=>x[1]).length;return `<aside class="live-notebook ${notebookOpen?'expanded':''}" aria-label="진행 중 조사 수첩"><div class="notebook-heading"><h2>내 조사 수첩 <span class="hint">${count}/7칸</span></h2>${btn(notebookOpen?'수첩 접기':'수첩 펼치기','notebook-toggle',`aria-expanded="${notebookOpen}" aria-controls="live-note-body"`)}</div><div id="live-note-body">${notebookContent(key,notebookOpen||matchMedia('(min-width:901px)').matches)}</div></aside>`;}
 function boxProgress(){const count=Object.keys(caseNames).filter(k=>noteRows(k).done).length;return `<div class="box-progress" role="img" aria-label="조사 상자 ${count}/3단계 열림"><span class="opening-box" style="--opening:${count*18}deg" aria-hidden="true"></span><span>조사 상자 ${count}/3단계</span></div>`;}
 function showNotebook(){open('내 수첩',btn('확인한 자료 다시 열기','library')+Object.keys(caseNames).map(key=>`<section class="case-summary">${notebookContent(key)}</section>`).join('')+summary());}
 function missingScenes(){const missing=Object.entries(E.requirements).filter(([n,r])=>Number(n)!==13&&(!r.evidence.every(id=>state.evidence.includes(id))||!r.tasks.every(id=>state.tasks[n+':'+id]))).map(([n])=>Number(n));for(const [n,key]of [[4,'photo'],[8,'writing'],[12,'face']])if(!state.cases[key].final||(key==='photo'&&state.cases.photo.final==='manual'&&!E.allFaces(state.crop)))missing.push(n);return missing.sort((a,b)=>a-b);}
 function sources(){open('참고한 실제 사례',`<p>도시·동물·대사·문서·수치·선택 결과는 모두 창작입니다. 실제 기업의 모델이나 내부 문서를 재현하지 않았습니다.</p><ul><li><a target="_blank" rel="noopener" href="https://www.nist.gov/publications/four-principles-explainable-artificial-intelligence">NIST (2021)</a>: 설명·이해 가능성·설명 정확성·지식 한계의 개념 참고.</li><li><a target="_blank" rel="noopener" href="https://blog.x.com/engineering/en_us/topics/insights/2021/sharing-learnings-about-our-image-cropping-algorithm">Twitter (2021)</a>: 자동 자르기와 사용자 통제 문제 참고.</li><li><a target="_blank" rel="noopener" href="https://www.vanderbilt.edu/brightspace/2023/08/16/guidance-on-ai-detection-and-why-were-disabling-turnitins-ai-detector/">Vanderbilt (2023)</a>: AI 탐지 기능 비활성화 발표와 신뢰성·설명 부족 우려 참고.</li><li><a target="_blank" rel="noopener" href="https://www.ftc.gov/news-events/news/press-releases/2023/12/rite-aid-banned-using-ai-facial-recognition-after-ftc-says-retailer-deployed-technology-without">FTC (2023)</a>: Rite Aid에 대한 규제기관의 주장과 제안된 합의 명령 발표 참고. 주장을 모두 법적으로 확정된 사실로 표현하지 않으며, 2023년 발표를 현재의 법적·운영 상태로 단정하지 않습니다.</li></ul><p class="hint">링크를 열 때만 외부 사이트로 이동합니다. 게임 진행이나 선택을 외부로 전송하지 않습니다.</p>`);}
 document.addEventListener('click',e=>{
  const b=e.target.closest('button[data-act]');if(!b||b.disabled)return;const act=b.dataset.act;
  if(act==='close'){close();return;}
  if(act==='prev-line'||act==='next-line'){line+=act==='prev-line'?-1:1;render();return;}
  if(act==='start'){line=0;send({type:'next'},'');return;}
  if(act==='later'){feedback='사진 사건을 살핀 뒤에 열립니다.';render();return;}
  if(act==='next'){if(line<D.scenes[state.scene].lines.length-1)return;const before=state.scene;state=E.reduce(state,{type:'next'});if(before!==state.scene){line=0;overlay=false;showOriginal=false;claimEvidence={};}feedback='';render();$('h1').focus();window.scrollTo(0,0);return;}
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
   const msg=correct?(id==='schedule'?'실제 참여 조건을 확인할 수 있습니다. 이것만으로 모든 적합성이 확인되는 것은 아닙니다.':successMessage(id)):b.dataset.wrong;
   if(!correct){const key=state.scene+':'+id;state.attempts[key]=(state.attempts[key]||0)+1;}send({type:'solve',id,correct},msg);return;
  }
  if(act==='trace'){send({type:'solve',id:'trace',correct:true},'앱의 알림과 사람의 해석, 실제 제한 조치를 나눠 읽었습니다.');return;}
  if(act==='claim-evidence'){claimEvidence[b.dataset.task]=b.dataset.id;render();return;}
  if(act==='stamp'){const c=C.find(state.scene,b.dataset.task),ev=claimEvidence[c.id];claimFeedback[c.id]=C.feedback(c,ev,b.dataset.value);send({type:'judge',id:c.id,evidence:ev,stamp:b.dataset.value},'');return;}
  if(act==='notebook-toggle'){notebookOpen=!notebookOpen;render();if(notebookOpen&&matchMedia('(max-width:900px)').matches)$('#live-note-body').scrollIntoView({block:'end'});return;}
  if(act==='why'){send({type:'solve',id:'why',correct:true},'루루: 바로 기뻐하면 너무 갑작스러워서, 들어가기 전에 망설이게 했어.');return;}
  if(act==='choose'){send({type:'choose',id:b.dataset.id},'아직 확정 전입니다. 계획을 읽고 무엇이 바뀔지 예측해 주세요.');return;}
  if(act==='full-crop'){send({type:'crop',rect:[0,0,1536,1024]},'전체 범위에 다섯 친구가 모두 들어왔어요. 실제 바뀐 부분을 아래에서 확인해 주세요.');return;}
  if(act==='confirm'){send({type:'confirm'},'선택을 기록했어요. 아래 후일담을 확인하고 다음 장면으로 갈 수 있어요.');return;}
  if(act==='rechoose'){send({type:'cancel-choice'},'다른 조치를 고를 수 있어요. 확정한 기록은 유지됩니다.');$('#work').scrollIntoView({block:'start'});$('#work [data-act=choose]')?.focus();return;}
  if(act==='help'){help();return;}
  if(act==='accept-help'){close();if(state.scene===2){showOriginal=true;overlay=true;}send({type:'help'},'함께 확인한 활동으로 기록했습니다. 선택이 있는 장면에서는 “이 조치로 정하기”를 눌러 주세요.');return;}
  if(act==='recommend'){const t={input:'선택한 관심사 ‘별’과 ‘야외 활동’을 사용했습니다.',criteria:'관심사와 연결된 모임을 우선했습니다. 구체적인 순위 산출 이유는 제공되지 않았습니다.',unknown:'실제 운영 상태와 귀가 교통편은 확인하지 못했습니다.'};send({type:'solve',id:'question',correct:true},t[b.dataset.id]);return;}
  if(act==='notebook'){if(state.scene===0){open('모아의 첫 질문','<span class="prop notebook" aria-hidden="true"></span><p>무엇을 입력했지?</p><p>어떤 결과가 나왔지?</p><p>설명은 기록과 맞을까?</p><p>아직 모르는 건 무엇이지?</p>');}else showNotebook();return;}
  if(act==='library'){open('확인한 자료 모음',state.evidence.length?evidenceButtons(state.evidence):'<p>아직 확인한 자료가 없습니다.</p>');return;}
  if(act==='scenes'){const pending=Object.values(state.cases).some(c=>c.pending);open('장면 기록',`<p class="hint">${pending?'변경 중인 선택을 먼저 확인하고 “이 조치로 정하기”를 눌러 주세요.':'이미 도달한 장면을 다시 살펴볼 수 있습니다. 최초 조치는 남고, 변경을 확정할 때 최종 조치가 갱신됩니다.'}</p><div class="scene-list">${D.scenes.map((s,i)=>btn(`S${String(i).padStart(2,'0')} ${s.title}`,'revisit',`data-scene="${i}" ${i>state.furthest||pending?'disabled':''}`)).join('')}</div>`);return;}
  if(act==='revisit'){if(modal.open)close();line=0;claimEvidence={};send({type:'revisit',scene:Number(b.dataset.scene)},'');return;}
  if(act==='sources'){sources();return;}
  if(act==='discussion'){open('토론 질문','<ol><li>설명을 들었지만 문제가 해결되지 않은 장면은 어디였나?</li><li>끝까지 알 수 없었던 것은 무엇이고, 그래도 바꿀 수 있었던 조치는 무엇인가?</li></ol>');return;}
  if(act==='settings'){open('설정',`<p>진행은 이 브라우저에만 저장됩니다. 계정 가입이나 교사용 수집은 없습니다.</p><div class="button-list">${btn('참고한 실제 사례','sources')}${btn('진행 초기화하기','reset-ask')}</div><p class="hint">플레이 시간과 교육 효과는 아직 실제 학생을 대상으로 검증하지 않았습니다.</p>`);return;}
  if(act==='reset-ask'){open('진행 초기화',`<p>이 게임의 진행과 선택 기록을 지웁니다. 공통 플레이어 정보와 다른 게임 기록은 유지합니다.</p>${btn('초기화하고 처음으로','reset')}`);return;}
  if(act==='reset'){close();state=E.initial();line=0;feedback='';claimEvidence={};claimFeedback={};noteSeen={};notebookOpen=false;render();}
 });
 document.addEventListener('change',e=>{const control=e.target.dataset.cropControl;if(!control)return;let [x,y,w,h]=state.crop;const value=Number(e.target.value);if(control==='width'){w=value;h=Math.round(w*2/3);x=Math.min(x,1536-w);y=Math.min(y,1024-h);}if(control==='x')x=value;if(control==='y')y=value;send({type:'crop',rect:[x,y,w,h]},'사진 범위를 바꿨어요. 다섯 친구가 모두 보이는지 확인해 주세요.');});
 modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 modal.addEventListener('close',()=>{if(lastFocus?.isConnected&&!lastFocus.disabled)lastFocus.focus({preventScroll:true});});
 window.TransparencyGame={getState:()=>JSON.parse(JSON.stringify(state)),storageKey:KEY};
 render();
})();
