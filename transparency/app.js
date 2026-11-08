(()=>{
 'use strict';
 const E=window.TransparencyEngine,D=window.TransparencyStory,A=D.art;
 const KEY='ethicity.transparency.progress.v1',preview=new URLSearchParams(location.search).get('preview')==='s01';
 const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let raw=null,saveOK=true,nickname='조사자';
 try{raw=localStorage.getItem(KEY);const p=JSON.parse(localStorage.getItem('ethicity.player'));if(p&&typeof p.nickname==='string')nickname=p.nickname.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40)||nickname;}catch{saveOK=false;}
 let state=E.restore(raw);
 if(preview){state=E.initial();state.scene=1;state.furthest=1;}
 // 화면에만 쓰는 상태(저장하지 않음): 지금 펼친 자료, 눌러 본 사진 구역, 잘못 누른 곳에 대한 짧은 안내.
 let view=null,regions=new Set(),tapHint='',justJudged=null,resumed=!preview&&state.scene>0,lastFocus=null,skipFocusReturn=false;
 // autoKey = 근거 자료를 자동으로 맞춘 판단 문장(한 문장에 한 번만 — 그 뒤 직접 고른 자료는 건드리지 않는다), keepFinding = 마지막 자료를 찾은 직후 자료가 바뀌어도 방금 찾은 내용을 남긴다.
 // revealCue = 마지막 자료를 막 찾아 판단할 말이 처음 나온 순간(화면을 움직이지 않고 한 줄로만 알린다).
 let autoKey=null,keepFinding=null,revealCue=false;
 // opened = 도서관 점수표에서 연 행(순위), tried = 사건 5(혼자)에서 눌러 봤지만 답이 아닌 곳(글 안내 대신 '아님' 표시만).
 let opened=new Set(),tried=new Set();
 const photo=new Image();photo.src=A.photo;photo.onload=paint;
 const modal=$('#modal');
 const STEP_LABELS={hook:'궁금한 것',check:'직접 확인',choose:'선택',result:'결과',follow:'후속 조사',notice:'만든 사람이라면: 미리 알리기',reflect:'생각 정리'};
 const FACE_NAMES=['토리','루루','담이','모아','몽이'];
 // 대사 옆 작은 얼굴: 전신 그림(1024×1536)에서 얼굴 중심(가로·세로 비율). 그림이 없는 화자(마을 사람들·반 친구·앱 알림)는 이름만.
 const FACE_POS={moa:[.54,.12],lulu:[.51,.23],luluPaper:[.46,.23],dami:[.51,.15],bami:[.59,.13],teacher:[.48,.12],clerk:[.52,.13],clerkOpen:[.55,.12],librarian:[.48,.12]};
 // 무대에만 쓰는 사건 4·5 새 포즈는 기본 인물의 자리·크기 규칙(.actor.dami 등)을 함께 받는다.
 const CAST_BASE={damiBooks:'dami',moaPhone:'moa',luluCasual:'lulu'},castCls=c=>c+(CAST_BASE[c]?' '+CAST_BASE[c]:'');
 const pct=(v,t)=>(v/t*100).toFixed(3)+'%';
 const rectStyle=([x,y,w,h])=>`left:${pct(x,1536)};top:${pct(y,1024)};width:${pct(w,1536)};height:${pct(h,1024)}`;

 function save(){if(!preview)try{localStorage.setItem(KEY,JSON.stringify(state));saveOK=true;}catch{saveOK=false;}
  $('#save-status').textContent=preview?'S01 미리보기 · 진행 저장 안 함':saveOK?'이 기기에 자동 저장 · '+nickname:'저장할 수 없어 이 창에서만 진행해요. 창을 닫으면 기록이 사라져요.';}
 function send(a){const before=state.scene,k=E.caseKey(before),was=k&&E.stepOf(before)==='check'&&E.checked(state,k);state=E.reduce(state,a);
  if(state.scene!==before)arrive();else if(k&&E.stepOf(before)==='check'&&!was&&E.checked(state,k))revealCue=true;
  save();render(state.scene!==before);}
 function arrive(){view=null;regions=new Set();opened=new Set();tried=new Set();tapHint='';justJudged=null;resumed=false;autoKey=null;keepFinding=null;revealCue=false;}
 function btn(label,act,attrs='',cls=''){return `<button ${cls?`class="${cls}"`:''} data-act="${act}" ${attrs}>${label}</button>`;}
 function portrait(who){const p=FACE_POS[who];return p?`<span class="portrait" style="--fx:${p[0]};--fy:${p[1]}" aria-hidden="true"><img src="${A[who]}" alt=""></span>`:'';}
 function line([who,text],cls=''){return `<p class="line ${cls}">${portrait(who)}<span class="who">${esc(D.names[who])}</span> ${esc(text)}</p>`;}
 function more(text){return text?`<details class="more"><summary>자세히 보기</summary><p>${esc(text)}</p></details>`:'';}
 function canvas(rect,label){return `<canvas class="photo-canvas" width="${rect[2]}" height="${rect[3]}" data-crop="${rect.join(',')}" role="img" aria-label="${esc(label)}"></canvas>`;}
 function paint(){if(!photo.complete||!photo.naturalWidth)return;document.querySelectorAll('canvas[data-crop]').forEach(c=>{const r=c.dataset.crop.split(',').map(Number),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(photo,...r,0,0,c.width,c.height);});}

 // 장면 그림. 결과가 그림에 바로 보이게 한다(게시판 사진·입장 표시·점원 표정).
 // screen = 무대 오른쪽 위에 코드로 그린 화면 카드(도서관 추천 화면·모임 추천 알림). 첫 줄은 작은 머리말.
 function stage(bg,cast,{photoRect,status,boxes,screen,screenCls=''}={}){
  return `<div class="stage"><img class="backdrop" src="${A.backgrounds[bg]}" alt="${D.bgNames[bg]}">${photoRect?`<div class="stage-photo">${canvas(photoRect,'게시판에 올린 사진')}</div>`:''}${screen?`<div class="stage-screen ${screenCls}">${screen.map((x,i)=>`<span class="${i?(x.startsWith('임시 표시')?'screen-line screen-flag':'screen-line'):'screen-head'}">${esc(x)}</span>`).join('')}</div>`:''}${boxes?`<div class="stage-boxes" aria-hidden="true">${[0,1,2].map(()=>`<span class="prop ${boxes}"></span>`).join('')}</div>`:''}${status?`<p class="stage-status">${esc(status)}</p>`:''}<div class="cast">${cast.map(c=>`<img class="actor ${castCls(c)}" src="${A[c]}" alt="${esc(D.names[c])}">`).join('')}</div><div class="name-tags" aria-hidden="true">${cast.map((c,i)=>`<span class="name-tag pos-${i} ${castCls(c)}"><span>${esc(D.names[c])}</span></span>`).join('')}</div></div>`;
 }
 function caseStage(k,{result=false}={}){const c=D.cases[k],o=E.outcome(state,k),opt=c.choose.options.find(x=>x.id===o.id);
  let cast=c.cast.slice(),status='';
  if(k==='face'){status=result&&o.id==='release'?'입장 제한 해제':'입장 제한 중';if(result&&o.id==='release')cast=cast.map(x=>x==='clerk'?'clerkOpen':x);}
  if(k==='writing'&&result&&opt)status=opt.status;
  // 도서관: 추천 화면 카드가 결과를 보여 준다. 밤하늘(혼자): 추천 알림 카드는 그대로(상태 표시가 아님).
  const screen=k==='library'?(result&&opt?opt.screen:c.screen):k==='recommend'?c.screen:null;
  return stage(c.bg,cast,{photoRect:k==='photo'?(result?o.rect:E.AUTO):null,status,screen,screenCls:k==='recommend'?'phone':''});
 }
 function report(){return `<div class="document"><p class="doc-label">글 검사 결과 · AI 작성 의심</p><p>${esc(D.drafts.before)} <mark>${esc(D.drafts.revision)}</mark></p></div>`;}

 // 자료 화면. 눌러서 차이를 찾게 한다.
 function itemView(k,id){
  const done=state.evidence.includes(id);
  if(id==='photo-original')return `<div class="photo-frame"><img src="${A.photo}" alt="다섯 친구가 모두 나온 축제 원본 사진"><span class="crop-border dashed" style="${rectStyle(E.AUTO)}"><span class="crop-label">자동으로 남긴 부분</span></span>${E.faces.map((f,i)=>`<button class="face-spot ${done&&i===2?'found':''}" data-act="spot" data-id="${i}" style="${rectStyle(f)}" aria-label="얼굴 ${i+1}"></button>`).join('')}</div>`;
  if(id==='photo-rule'){const all=done||regions.size===3,names=['왼쪽','가운데','오른쪽'],score=[2,5,8];
   return `<div class="photo-frame"><img src="${A.photo}" alt="축제 원본 사진. 세 구역으로 나뉘어 있다.">${all?`<span class="crop-border" style="${rectStyle(E.AUTO)}"></span><span class="center-dot" style="left:${pct(1200,1536)};top:${pct(250,1024)}"></span>`:''}<div class="regions">${names.map((n,i)=>{const open=all||regions.has(i);return `<button class="region ${open?'open':''}" data-act="region" data-id="${i}" aria-label="${n} 구역 점수${open?' '+score[i]+'점':' 보기'}"><span>${n} ${open?score[i]:'?'}</span></button>`;}).join('')}</div></div><div class="document guide-box"><p class="doc-label">AI 안내</p><p>${esc(D.cases.photo.checks[1].guide.replace(/^AI 안내:\s*/,''))}</p></div>${all?'<p class="legend">노란 테두리: 실제로 잘린 범위 · 점: 자르기 중심</p>':''}`;}
  if(id==='writing-guide')return `<div class="document"><p class="doc-label">AI 안내 · 글 검사기</p><ul>${D.cases.writing.checks[0].guide.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`;
  if(id==='writing-history'){const rec=r=>btn(`<span class="doc-label">${esc(r.time)} · ${esc(r.kind)}</span>${r.target&&done?`<mark>${esc(r.text)}</mark>`:esc(r.text)}`,'record',`data-id="${r.id}"`,'record');
   return `<div class="document compact"><p class="doc-label">검사기가 표시한 문장</p><p><mark>${esc(D.drafts.revision)}</mark></p></div><div class="records">${D.history.map(rec).join('')}</div>`;}
  if(id==='face-alert')return `<div class="document"><p class="doc-label">알림 기록 · 빵집 앱</p><p>${esc(D.alertText)}</p></div>`;
  if(id==='face-clerk')return `<div class="document compact"><p class="doc-label">알림 기록</p><p>${esc(D.alertText)}</p></div><div class="document"><p class="doc-label">점원의 말</p><p class="segments">${D.cases.face.clerkSegments.map(s=>btn(done&&s.found?`<mark>${esc(s.text)}</mark>`:esc(s.text),'segment',`data-id="${s.id}"`,'segment')).join(' ')}</p></div>`;
  // 사건 4: 안내문, 대출 기록 8권(공룡 책 하나 누르기), 점수표(1·2·3·5위 행을 열면 계산식 줄)
  const L=D.cases.library,R=D.cases.recommend,triedTag=key=>tried.has(key)?' <span class="tried-tag">아님</span>':'';
  if(id==='library-guide')return `<div class="document"><p class="doc-label">AI 안내 · 도서관 추천</p><p>${esc(L.checks[0].guide)}</p></div>`;
  if(id==='library-loans')return `<div class="document compact"><p class="doc-label">${esc(L.loansLabel)}</p></div><div class="records loans">${L.loans.map(([d,title,f],i)=>btn(`<span class="loan-date">${esc(d)}</span><span class="loan-title">${esc(title)}</span><span class="loan-field">${done&&f===L.top?`<mark>${esc(f)}</mark>`:esc(f)}</span>`,'loan',`data-id="${i}"`,'record loan')).join('')}</div>`;
  if(id==='library-scores'){const S=L.scores,all=done||S.rows.filter(r=>r[5]).every(r=>opened.has(r[0]));
   const cells=(r,show)=>`<span class="num">${r[0]}위</span><span class="score-book">${esc(r[1])}</span>${[2,3,4].map(i=>`<span class="num">${show?r[i]:'?'}</span>`).join('')}`;
   return `<div class="document score-table"><p class="doc-label">${esc(S.label)}</p><div class="score-headrow" aria-hidden="true">${S.head.map(x=>`<span>${esc(x)}</span>`).join('')}</div>${S.rows.map(r=>{const show=!r[5]||all||opened.has(r[0]);
    return r[5]&&!all?btn(cells(r,show),'score',`data-id="${r[0]}"${show?'':` aria-label="${r[0]}위 ${esc(r[1])} 점수 열기"`}`,'score-row'+(show?' open':'')):`<div class="score-row">${cells(r,true)}</div>`;}).join('')}${all?`<p class="score-formula">${esc(S.formula)}</p>`:''}</div>`;}
  // 사건 5(혼자): 앱 안내, 모임 안내(끝나는 시각 누르기), 버스 시간표(탈 버스 없음 누르기)
  if(id==='recommend-reason')return `<div class="document"><p class="doc-label">AI 안내 · 모임 추천 앱</p><p>${esc(R.checks[0].guide)}</p></div>`;
  if(id==='recommend-meeting'){const seg=sid=>{const x=R.meeting.segments.find(s=>s.id===sid);return btn((done&&x.target?`<mark>${esc(x.text)}</mark>`:esc(x.text))+triedTag('meet:'+sid),'meet',`data-id="${sid}"`,'segment');};
   return `<div class="document"><p class="doc-label">${esc(R.meeting.label)}</p><p class="segments">${seg('name')} · ${seg('day')} ${seg('start')}~${seg('end')} · ${seg('place')} · ${seg('fee')} · ${seg('consent')}</p></div>`;}
  if(id==='recommend-bus'){const B=R.bus;return `<div class="document compact"><p class="doc-label">${esc(B.label)}</p></div><div class="records">${B.rows.map(r=>btn(`<span class="bus-time">${esc(r.time)}</span>${r.note?` <span class="bus-note">${esc(r.note)}</span>`:''}${triedTag('bus:'+r.id)}`,'bus',`data-id="${r.id}"`,'record')).join('')}${btn(done?`<mark>${esc(B.none)}</mark>`:esc(B.none),'bus','data-id="none"','record bus-none')}</div>`;}
  if(id==='face-photo')return `<div class="compare-labels" aria-hidden="true"><span>등록된 사진</span><span>오늘 찍힌 사진</span></div><img class="evidence-photo" src="${A.faces}" alt="왼쪽은 등록된 사진, 오른쪽은 오늘 찍힌 사진. 둘 다 흐리고 문틀과 반사에 일부 가려진 가상의 고양이 얼굴이다.">`;
  return '';
 }
 // 왼쪽 그림 칸이 지금 ‘자료’라는 것을 보이게 한다(판단 도장 ‘자료로 확인돼’가 가리키는 곳).
 function evidenceHead(name){return `<p class="evidence-head"><span>자료</span> · ${esc(name)}</p>`;}
 function defaultView(k){if(k!=='photo'&&k!=='writing')return caseStage(k);if(k==='photo')return `<figure class="crop-figure">${canvas(E.AUTO,'자동으로 자른 사진. 담이 얼굴이 없다.')}<figcaption>자동으로 자른 사진</figcaption></figure>`;if(k==='writing')return report();return caseStage(k);}

 function nav(prev,next){return `<div class="step-nav">${prev?btn('이전','back'):'<span></span>'}${next||''}</div>`;}
 function head(meta,title){return `${resumed?`<p class="resume" role="status">저장된 곳부터 이어서 해요. ${btn('처음부터 하기','reset-ask','','link')}</p>`:''}<p class="meta">${esc(meta)}</p><h1 tabindex="-1">${esc(title)}</h1>`;}

 function render(moved){
  const n=state.scene,step=E.stepOf(n),k=E.caseKey(n),c=k&&D.cases[k];let h='',v='',b='';
  const meta=k?`${c.name} · ${E.CASES.indexOf(k)+1}/${E.CASES.length} · ${STEP_LABELS[step]}`:step==='intro'?'프롤로그':step==='report'?'보고서':'마지막';
  if(step==='intro'){h=head(meta,D.intro.title);v=stage(0,['moa'],{boxes:'box'});
   b=D.intro.lines.map(l=>line(l)).join('')+`<p>${esc(D.intro.plan)}</p>`+nav(false,btn('첫 사건 시작하기','next','','primary'))+`<p class="hint">${esc(D.intro.note)}</p>`;}
  if(step==='hook'){h=(c.solo?`<p class="solo-note" role="note">${esc(c.soloNote)}</p>`:'')+head(meta,c.title);v=caseStage(k);
   b=c.hook.map(l=>line(l)).join('')+(k==='photo'?defaultView('photo'):k==='writing'?report():'')+`<p class="question-label">궁금한 것</p><p class="question">${esc(c.question)}</p>`;
   // 사건 5: 예전 마지막 장면의 질문 넷. 하나 이상 물어야 직접 확인으로 간다. 대답은 마지막에 누른 질문의 것.
   if(c.asks){const shown=c.asks.some(a=>a[0]===view)?view:state.asked[state.asked.length-1];
    b+=`<p class="question-label">${esc(c.askPrompt)}</p><div class="options asks">${c.asks.map(([id,q])=>btn(esc(q),'ask',`data-id="${id}" aria-pressed="${state.asked.includes(id)}"`,'option')).join('')}</div>`;
    if(shown){const a=c.asks.find(x=>x[0]===shown);b+=`<div class="finding" role="status">${line(['recApp',a[2]])}<p>${esc(c.afterAsk)}</p></div>`;}}
   b+=nav(true,btn('직접 확인하기','next',E.canAdvance(state)?'':'disabled','primary'))+(E.canAdvance(state)?'':`<p class="hint">${esc(c.askNeed)}</p>`);}
  if(step==='check'){h=head(meta,c.question);autoEvidence(k);const item=c.checks.find(x=>x.id===view),judging=E.checked(state,k)&&judgeIndex(k)>=0;v=item?evidenceHead(item.name)+itemView(k,item.id):defaultView(k);
   b=`<div class="items" role="group" aria-label="확인할 자료">${c.checks.map(x=>btn(esc(x.label)+(state.evidence.includes(x.id)?' <span class="seen">· 확인함</span>':''),'item',`data-id="${x.id}" aria-pressed="${view===x.id}"`)).join('')}</div>`;
   if(!item)b+=`<p class="task">자료를 눌러 직접 확인해 봐.</p>`;
   else{if(revealCue&&judging)b+=`<p class="cue" role="status">아래에 판단할 말이 나왔어.</p>`;if(!state.evidence.includes(item.id))b+=`<p class="task">${esc(item.task)}</p>`;if(tapHint&&!c.solo)b+=`<p class="tap-hint" role="status">${esc(tapHint)}</p>`;const said=keepFinding?c.checks.find(x=>x.id===keepFinding):item;if(!c.solo&&state.evidence.includes(said.id))b+=`<div class="finding${judging?' quiet':''}" role="status">${said.finding.map(l=>line(l)).join('')}${more(said.more)}</div>`;}
   if(E.checked(state,k))b+=judgeBlock(k);
   const left=c.checks.filter(x=>!state.evidence.includes(x.id)).map(x=>x.name);
   // 사건 5(혼자)는 '남은 자료' 힌트를 보이지 않는다.
   b+=nav(true,btn('어떻게 할지 고르기','next',E.canAdvance(state)?'':'disabled','primary'))+(E.canAdvance(state)||left.length&&c.solo?'':`<p class="hint">${left.length?'남은 자료: '+esc(left.join(', ')):`말 3개를 모두 판단하면 다음으로 갈 수 있어. (지금 ${state.judgments[k].filter(x=>x&&x!=='legacy').length}/3)`}</p>`);}
  if(step==='choose'){const cur=state.cases[k].final;h=head(meta,c.choose.question);v=caseStage(k,{result:!!cur});
   b=`<div class="options${k==='photo'?' photo-options':''}">${c.choose.options.map(o=>btn((k==='photo'?canvas(o.id==='all'?E.ALL:E.AUTO,o.label):'')+`<span>${esc(o.label)}</span>`,'choose',`data-id="${o.id}" aria-pressed="${cur===o.id}"`,'option')).join('')}</div>`;
   b+=`<p class="hint">${cur?'다시 고를 수 있어. 처음 고른 것도 수첩에 남아.':'고르면 바로 결과를 볼 수 있어.'}</p>`+nav(true,cur?btn('결과 다시 보기','next','','primary'):'');}
  if(step==='result'){const o=c.choose.options.find(x=>x.id===state.cases[k].final);h=head(meta,o.title);v=caseStage(k,{result:true});
   // 사건 5(혼자): 상태 글·모아 피드백 없이 결과 한 줄(summary)과 반응만.
   b=(o.status?`<p class="status">${esc(o.status)}</p>`:'')+(o.summary?`<p class="result-summary">${esc(o.summary)}</p>`:'')+o.reaction.map(l=>line(l)).join('')+(o.feedback?line(['moa',o.feedback],'moa'):'')+more([o.more,c.more].filter(Boolean).join(' '))+nav(false,`<span class="nav-pair">${btn('다른 선택 해 보기','rechoose')}${btn('더 조사하기','next','','primary')}</span>`)+`<p class="hint">결과는 수첩에 자동으로 적혔어.</p>`;}
  if(step==='follow'){const f=c.follow;h=head(meta,f.question)+f.lines.map(l=>line(l)).join('')+(E.followReady(state,k)?'':`<p class="task">${esc(f.task)}</p>`);v=evidenceHead(f.src)+followView(k);
   b=followBody(k)+nav(true,btn('미리 알리기','next',E.canAdvance(state)?'':'disabled','primary'));}
  if(step==='notice'){h=head(meta,c.notice.title);v=noticeStage(k);b=noticeBody(k)+nav(true,btn('생각 정리하기','next',E.canAdvance(state)?'':'disabled','primary'));}
  if(step==='reflect'){const r=state.reflections[k],toReport=state.furthest>=E.REPORT;h=head(meta,D.reflect.title);v=reflectSummary(k);
   b=`<p class="hint lead">${esc(D.reflect.lead)}</p>`+writeBox('reflect-q1',D.reflect.q1,r.q1,'data-reflect="q1"')+writeBox('reflect-q2',D.reflect.q2,r.q2,'data-reflect="q2"');
   const next=btn(k===E.CASES[E.CASES.length-1]?'마지막 장면으로':'다음 사건','next','',toReport?'':'primary');
   b+=nav(true,toReport?`<span class="nav-pair">${next}${btn('보고서로 돌아가기','to-report',`data-case="${k}"`,'primary')}</span>`:next);}
  // 마지막 장면: 질문은 사건 5로 옮겼다. 대사 2줄 + 마무리 한 줄 + 마지막 문장 + 마지막 서술 + 메뉴.
  if(step==='end'){const e=D.ending;h=head(meta,e.title);v=stage(0,['moa','lulu','dami'],{boxes:'window'});
   b=e.lines.map(l=>line(l)).join('')+line(e.closing,'moa')+`<p class="ending-quote">${esc(e.quote)}</p>${writeBox('final-note',D.reflect.finalPrompt,state.finalNote,'data-note',3)}${nav(true,btn('나의 조사 보고서 보기','next','','primary'))}<div class="menu">${btn('내 수첩 보기','notebook')}${btn('참고한 실제 사례','sources')}${btn('토론 질문','discussion')}${btn('처음부터 다시 하기','reset-ask')}</div>`;}
  if(step==='report'){h=head(meta,D.report.title);b=reportPage()+nav(true,'');}
  const focus=moved?null:focusSelector();
  $('#app').className='step-'+step+(step==='check'&&E.checked(state,k)&&judgeIndex(k)>=0?' judging':'');
  $('#app').innerHTML=`<div class="screen"><div class="head">${h}</div>${v?`<div class="visual">${v}</div>`:''}<div class="body" id="work" tabindex="-1">${b}</div></div>`;
  paint();
  if(moved){$('h1').focus({preventScroll:true});window.scrollTo(0,0);}
  else if(focus){const t=$('#app').querySelector(focus);(t&&!t.disabled?t:$('#work')).focus({preventScroll:true});}
 }
 // 판단 뒤: 정답 칸에 ‘✓ 정답’, 고른 오답에 ‘내 선택’(점선). 색만으로 구분하지 않는다
 function stampButtons(act,picked,answer){return `<div class="stamps" role="group" aria-label="판단">${Object.entries(D.stamps).map(([id,label])=>{const right=!!picked&&id===answer,mine=!!picked&&id===picked&&!right;
  return btn(esc(label)+(right?' <span class="stamp-tag">✓ 정답</span>':mine?' <span class="stamp-tag">내 선택</span>':''),act,`data-id="${id}" aria-pressed="${picked===id}" ${picked?'disabled':''}`,right?'stamp-right':mine?'stamp-mine':'');}).join('')}</div>`;}
 // 사건 5(혼자)의 판단 피드백은 '기록과 맞춰 보면: …' 한 줄(sum). 틀리면 같은 줄 끝에 '정리: …'.
 function verdict(j,picked,answer){if(j.sum)return picked===answer?j.sum:`${j.sum} 정리: ${D.stamps[answer]}.`;return picked===answer?j.right:`${j.wrong} 정리: ${D.stamps[answer]}.`;}
 function verdictBox(j,picked,answer){const wrong=picked!==answer;return `<div class="finding${wrong?' again':''}" role="status">${wrong&&!j.sum?'<p class="again-head">다시 보자</p>':''}<p>${esc(verdict(j,picked,answer))}</p></div>`;}
 const judgeIndex=k=>justJudged!==null?justJudged:E.currentJudgment(state,k);
 // 판단 문장이 바뀌면 왼쪽 자료도 그 문장의 근거로. 문장마다 한 번만 맞추고, 그 뒤 직접 고른 자료는 그대로 둔다
 function autoEvidence(k){if(!E.checked(state,k))return;const idx=judgeIndex(k),key=idx<0?null:k+idx;if(!key||key===autoKey)return;const first=autoKey===null;autoKey=key;tapHint='';const src=D.cases[k].judges[idx].src;if(!src.includes(view)){if(first&&view)keepFinding=view;view=src[0];}}
 function sourceTags(k,src){const c=D.cases[k];return `<p class="judge-src">볼 자료: ${src.map(id=>btn(esc(c.checks.find(x=>x.id===id).name),'source',`data-id="${id}" aria-pressed="${view===id}"`,'source-tag')).join(' ')}</p>`;}
 function judgeCard(who,text,num,extra){return `<h2 class="question-label judge-head">이 말은 맞을까?${num?' '+num:''}</h2><blockquote class="judge-say"><p>“${esc(text)}”</p><cite>${portrait(who)}${esc(D.names[who])}</cite></blockquote>${extra}`;}
 function judgeBlock(k){const c=D.cases[k],js=state.judgments[k],idx=judgeIndex(k);
  const after=c.after?`<p>${esc(c.after)}</p>`:'';
  if(idx<0)return `<section class="judge"><p class="question-label">판단 3개를 마쳤어</p>${after}</section>`;
  const j=c.judges[idx],picked=js[idx]&&js[idx]!=='legacy'?js[idx]:null,answer=E.answers[k][idx];
  let h=`<section class="judge judge-card" aria-label="판단할 말 ${idx+1}/3">${judgeCard(j.who,j.text,(idx+1)+'/3',sourceTags(k,j.src))}${stampButtons('judge',picked,answer)}`;
  if(js[idx]==='legacy')h+='<p class="hint">이전 저장에서 넘어와 아직 하지 않은 판단이야. 지금 해 볼 수 있어.</p>';
  if(picked){h+=verdictBox(j,picked,answer);h+=E.currentJudgment(state,k)>=0?btn('다음 말 보기','judge-next'):after;}
  return h+'</section>';}
 // 후속 조사
 const tally=()=>{const counts=[0,0,0,0,0];for(const r of E.FOLLOW_CROPS)for(const i of E.cutFaces(r))counts[i]++;return counts.map((n,i)=>[FACE_NAMES[i],n]).sort((a,b)=>b[1]-a[1]);};
 const CHIPS={'완료':['done','✓'],'진행 중':['doing','◐'],'예정':['plan','○']};
 function chip(s){const [cls,mark]=CHIPS[s];return `<span class="chip chip-${cls}">${mark} ${esc(s)}</span>`;}
 function followView(k){const f=D.cases[k].follow,fs=state.follows[k],locked=!!fs.judgment&&fs.judgment!=='legacy';
  if(k==='photo')return `<div class="follow-grid">${E.FOLLOW_CROPS.map((r,i)=>{const id='p'+(i+1),m=fs.marks[id];return `<figure class="follow-photo">${canvas(r,'사진 '+(i+1))}<figcaption>사진 ${i+1}</figcaption><div class="mark-row" role="group" aria-label="사진 ${i+1}에 담이가 나왔나">${btn('나왔어','mark',`data-id="${id}" data-value="shown" aria-pressed="${m==='shown'}" ${locked?'disabled':''}`)}${btn('잘렸어','mark',`data-id="${id}" data-value="cut" aria-pressed="${m==='cut'}" ${locked?'disabled':''}`)}</div></figure>`;}).join('')}</div><p class="caption">${esc(f.note)}</p>`;
  // 사건 4: 예전 안내 · 새 안내(달라진 말 누르기) · 새 점수 기록 · 업체 답장
  if(k==='library'){const L=D.cases.library,found=fs.marks.changed==='found',seg=x=>found?(x.changed?`<mark>${esc(x.text)}</mark>`:esc(x.text)):btn(esc(x.text),'change',`data-id="${x.id}"`,'segment'),[t0,t1,t2]=f.segments;
   return `<div class="document compact"><p class="doc-label">${esc(f.oldLabel)}</p><p>${esc(L.checks[0].guide)}</p></div><div class="document"><p class="doc-label">${esc(f.newLabel)}</p><p class="segments">${seg(t0)} · ${seg(t1)} ${seg(t2)}</p></div>`
    +`<div class="document compact"><p class="doc-label">${esc(f.scoreLabel)}</p><p>${esc(L.scores.formula)}</p></div><div class="document compact"><p class="doc-label">${esc(f.replyLabel)}</p><p>${esc(f.reply)}</p></div>`;}
  // 사건 5: 세 친구의 추천 목록. 세 목록을 모두 열면 같은 모임 줄이 표시된다.
  if(k==='recommend'){const all=E.followReady(state,k);return `<div class="rec-lists">${f.lists.map(l=>{const open=fs.marks[l.id]==='open';
   return `<div class="rec-list">${btn(`<span class="rec-name">${esc(l.name)}</span> <span class="rec-interest">관심사: ${esc(l.interest)}</span>${open?'':' <span class="row-open">목록 보기 ▸</span>'}`,'list',`data-id="${l.id}" aria-expanded="${open}"`,'record')}${open?`<ol>${l.items.map(x=>`<li>${all&&x===f.target?`<mark>${esc(x)}</mark>`:esc(x)}</li>`).join('')}</ol>`:''}</div>`;}).join('')}</div>`;}
  if(k==='writing'){const ran=fs.marks.run==='done';return `<div class="document"><p class="doc-label">${esc(f.docLabel)}${ran?' · 검사 결과':''}</p><p>${f.sentences.map((t,i)=>ran&&f.flagged.includes(i)?`<mark>${esc(t)}</mark>`:esc(t)).join(' ')}</p>${ran?'<p class="legend">노란 표시: AI 작성 의심</p>':''}</div>`;}
  return `<div class="document compact"><p class="doc-label">${esc(f.docLabel)}</p></div><div class="records">${f.rows.map(r=>{const open=fs.marks[r.id]==='open';return btn(`<span class="row-top">${chip(r.status)}${open?'':'<span class="row-open">근거 보기 ▸</span>'}</span><span class="row-item">${esc(r.item)}</span>${open?`<span class="proof">근거: ${esc(r.proof)}</span>`:''}`,'row',`data-id="${r.id}" aria-expanded="${open}"`,'record');}).join('')}</div>`;}
 function followFact(k){const f=D.cases[k].follow,fs=state.follows[k];
  if(k==='photo'){const t=tally(),mine=E.followMarks.photo.ids.filter(id=>fs.marks[id]==='cut').length;return `여섯 장 가운데 담이가 잘린 사진은 ${E.truth.filter(x=>x==='cut').length}장이다. 얼굴이 일부라도 사진 틀 밖으로 나가면 잘린 것으로 셌다. 잘린 횟수: ${t.map(([n,c])=>n+' '+c).join(' · ')}. (내가 ‘잘렸어’로 고른 사진 ${mine}장)`;}
  if(k==='writing')return '선생님이 5년 전에 쓴 글을 같은 검사기에 넣자, 세 문장 가운데 두 문장에 ‘AI 작성 의심’ 표시가 붙었다.';
  if(f.fact)return f.fact;
  const n=s=>f.rows.filter(r=>r.status===s).length;return `점검표 ${f.rows.length}개 가운데 완료 ${n('완료')}개, 진행 중 ${n('진행 중')}개, 예정 ${n('예정')}개이고, 예정 항목에는 점검 기록이 없다.`;}
 function followBody(k){const f=D.cases[k].follow,fs=state.follows[k],m=E.followMarks[k],done=m.ids.filter(id=>fs.marks[id]).length;let b='';
  if(k==='writing')b+=btn('검사기에 넣기','run',fs.marks.run?'disabled':'');
  else if(k==='library'){if(tapHint)b+=`<p class="tap-hint" role="status">${esc(tapHint)}</p>`;}
  else if(!E.followReady(state,k))b+=`<p class="hint">${done}/${m.ids.length} ${k==='photo'?'장 골랐어':k==='recommend'?'개 열었어':'개 확인했어'}.</p>`;
  if(!E.followReady(state,k))return b;
  if(k==='photo'){const wrong=m.ids.map((id,i)=>fs.marks[id]!==E.truth[i]?i+1:null).filter(Boolean);b+=`<div class="finding" role="status"><p>${esc(followFact(k).replace(/ \(내가.*$/,''))}</p><p>${wrong.length?`네 표시와 기록이 다른 사진: ${wrong.join(', ')}번`:'네 표시는 기록과 같아.'}</p></div>`;}
  else b+=`<div class="finding" role="status"><p>${esc(followFact(k))}</p></div>`;
  const j=f.judge,picked=fs.judgment&&fs.judgment!=='legacy'?fs.judgment:null,answer=E.followAnswers[k];
  b+=`<section class="judge judge-card" aria-label="판단할 말">${judgeCard(j.who,j.text,'',`<p class="judge-src">볼 자료: <span class="source-name">${esc(f.src)}</span></p>`)}${stampButtons('follow-judge',picked,answer)}`;
  if(fs.judgment==='legacy')b+='<p class="hint">이전 저장에서 넘어와 아직 하지 않은 조사야. 지금 해 볼 수 있어.</p>';
  if(picked)b+=`${verdictBox(j,picked,answer)}<p class="unknown"><strong>아직 모르는 점</strong> ${esc(f.unknown)}</p>${more(f.more)}`;
  return b+'</section>';}
 // 미리 알리기: 학생이 그 AI를 내놓는 쪽이 되어 안내문 카드를 고른다. 피드백·보고서는 마지막으로 붙인 안내문(posted) 기준.
 const N=D.notice,sameSet=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
 const postedOf=k=>Array.isArray(state.notices[k].posted)?state.notices[k].posted:null;
 // 카드 한 장의 피드백: 상태 글자(✓/!/○ + 종류 · 넣음/빠짐/뺐음)와 짧은 한 줄. 색만으로 구분하지 않는다.
 function cardFeedback(k,card,posted){const kind=E.noticeKind(k,card.id),on=posted.includes(card.id);
  const good=kind==='must'?on:kind==='nice'?null:!on,mark=good===null?(on?'✓':'○'):good?'✓':'!',state_=on?'넣음':kind==='must'?'빠짐':kind==='nice'?'안 넣음':'뺐음';
  const say=D.cases[k].solo?'':kind==='conflict'?[N.fb.conflict[on?'in':'out'],card.clash].filter(Boolean).join(' '):N.fb[kind][on?'in':'out'];
  return `<p class="card-fb ${good===false?'fb-again':good===null&&!on?'fb-plain':'fb-ok'}" id="fb-${card.id}"><span class="fb-tag">${mark} ${esc(N.kinds[kind])} · ${state_}</span>${say?' '+esc(say):''}</p>`;}
 function noticeVerdict(k,posted){const r=E.noticeCheck(k,posted);
  if(D.cases[k].solo){const parts=['missing','conflicts','promises'].filter(x=>r[x].length).map(x=>`${N.againParts[x]} ${r[x].length}장`);
   return `<div class="finding${r.ok?'':' again'} notice-verdict" role="status"><p><strong>${esc(r.ok?N.ok:N.again)}</strong>${r.ok?'':' · '+esc(parts.join(' · '))+'.'}</p></div>`;}
  if(r.ok)return `<div class="finding notice-verdict" role="status"><p><strong>${esc(N.ok)}</strong> ${esc(N.okMore)}</p></div>`;
  const parts=['missing','conflicts','promises'].filter(x=>r[x].length).map(x=>`${N.againParts[x]} ${r[x].length}장`);
  return `<div class="finding again notice-verdict" role="status"><p class="again-head">${esc(N.again)}</p><p>${esc(parts.join(' · '))}. ${esc(N.againMore)}</p></div>`;}
 function noticeBody(k){const nt=D.cases[k].notice,ns=state.notices[k],posted=postedOf(k),fresh=!!posted&&sameSet(posted,ns.picked);
  // 고정 한 줄과 사건 도입 대사를 한 묶음으로 짧게: 같은 화자가 이어 말하면 얼굴·이름을 다시 쓰지 않는다.
  const intro=D.cases[k].solo?`<p class="line plain">${esc(N.principle)}</p>`:[['moa',N.principle],...nt.lines].map((l,i,all)=>i&&all[i-1][0]===l[0]?`<p class="line cont">${esc(l[1])}</p>`:line(l,l[0]==='moa'?'moa':'')).join('');
  let b=`<div class="notice-intro">${intro}</div><p class="task">${esc(N.task)}</p>`;
  b+=`<div class="notice-cards" role="group" aria-label="안내문에 붙일 카드">${nt.cards.map(card=>{const on=ns.picked.includes(card.id),fb=fresh?cardFeedback(k,card,posted):'';
   return `<div class="notice-item">${btn(`<span class="pick-box" aria-hidden="true">${on?'✓':''}</span><span>${esc(card.text)}</span>`,'notice-pick',`data-id="${card.id}" aria-pressed="${on}"${fb?` aria-describedby="fb-${card.id}"`:''}`,'notice-card')}${fb}</div>`;}).join('')}</div>`;
  // 아직 한 번도 안 붙였으면 '한 번 붙이면 다음으로' 안내를 버튼 옆에 둔다(휴대폰에서 줄 하나 아끼기).
  b+=`<div class="notice-post-row">${btn(esc(posted?N.repostLabel:N.post),'notice-post',ns.picked.length?'':'disabled')}${E.noticeDone(state,k)?'':`<p class="hint">${esc(N.needPost)}</p>`}</div>`;
  if(ns.posted==='legacy')b+=`<p class="hint">${esc(N.legacy)}</p>`;
  if(fresh)b+=noticeVerdict(k,posted);else if(posted)b+=`<p class="hint repost" role="status">${esc(N.repost)}</p>`;
  return b;}
 // 왼쪽(휴대폰은 아래): 사건 무대와 붙인 안내문 종이
 function noticePaper(k){const nt=D.cases[k].notice,posted=postedOf(k)||[],cards=nt.cards.filter(x=>posted.includes(x.id));
  return `<div class="notice-paper${cards.length?"":" empty"}"><p class="doc-label">${esc(nt.paper)}</p>${cards.length?`<ul>${cards.map(x=>`<li>${esc(x.text)}</li>`).join('')}</ul>`:`<p class="paper-empty">${esc(N.empty)}</p>`}</div>`;}
 function noticeStage(k){return caseStage(k,{result:true})+noticePaper(k);}
 function focusSelector(){const el=document.activeElement;if(!el||!$('#app').contains(el))return null;const parts=['data-act','data-id'].filter(a=>el.hasAttribute(a)).map(a=>`[${a}="${CSS.escape(el.getAttribute(a))}"]`);return parts.length?el.tagName.toLowerCase()+parts.join(''):null;}

 function open(title,html){lastFocus=document.activeElement;$('#modal-title').textContent=title;$('#modal-body').innerHTML=html;if(!modal.open)modal.showModal();paint();}
 function close(){modal.close();}
 // 수첩: 활동 결과를 자동으로 적는다. 열어 보는 것은 선택.
 // 사건 카드: 수첩과 보고서가 같이 쓴다. 단계별로 묶어(확인한 자료 → 이 말은 맞을까? → 조치 → 후속 조사 → 내 서술) 한눈에 보이게 한다.
 const R=D.report,filled=t=>typeof t==='string'&&t.trim()!=='';
 const frameHtml=t=>esc(t).replace(/___/g,'<span class="blank" aria-hidden="true"></span><span class="sr">빈칸</span>');
 // 판단 한 줄: 내 판단과 정답 여부를 글자로 적는다(색만으로 구분하지 않는다).
 function verdictLine(num,text,p,answer){
  const pick=!p?'<span class="v-none">아직 안 함</span>':p==='legacy'?'<span class="v-none">이전 저장에서 넘어와 아직 안 함</span>'
   :`내 판단: <strong>${esc(D.stamps[p])}</strong> · ${p===answer?'<span class="v-tag v-ok">정답</span>':`<span class="v-tag v-again">다시 볼 것</span> (정리: ${esc(D.stamps[answer])})`}`;
  return `<li class="verdict"><p class="v-say">${num?num+'. ':''}“${esc(text)}”</p><p class="v-pick">${pick}</p></li>`;}
 function verdicts(k){const c=D.cases[k];return `<ul class="verdicts">${state.judgments[k].map((p,i)=>verdictLine(i+1,c.judges[i].text,p,E.answers[k][i])).join('')}</ul>`;}
 const optLabel=(k,id)=>D.cases[k].choose.options.find(o=>o.id===id)?.label;
 function actions(k){const cs=state.cases[k];return `<div class="pairs"><p class="pair"><span class="k">처음 조치</span> ${esc(optLabel(k,cs.first)||'아직 안 고름')}${cs.legacyFirst?' (이전 저장에서는 마지막 선택만 남아 있었어)':''}</p><p class="pair"><span class="k">최종 조치</span> ${esc(optLabel(k,cs.final)||'아직 안 고름')}</p></div>`;}
 function group(title,html){return `<div class="group"><p class="group-label">${esc(title)}</p>${html}</div>`;}
 function written(frame,value){return `<p class="frame-text">${frameHtml(frame)}</p><p class="answer${filled(value)?'':' not-written'}">${filled(value)?esc(value):esc(R.notWritten)}</p>`;}
 function caseCard(k,mode){const c=D.cases[k],cs=state.cases[k],fs=state.follows[k],seen=c.checks.filter(x=>state.evidence.includes(x.id)),isReport=mode==='report',H=isReport?'h2':'h3',r=state.reflections[k];
  let h=`<section class="case-card" id="${mode}-${k}" tabindex="-1"><${H} class="case-title"><span class="case-num">사건 ${E.CASES.indexOf(k)+1}</span> ${esc(c.name)}</${H}>`;
  if(!seen.length&&!cs.final)return h+'<p class="hint">아직 시작하지 않았어.</p></section>';
  h+=group('궁금한 것',`<p>${esc(c.question)}</p>`);
  if(c.asks)h+=group(R.asked,`<p>${state.asked.length?state.asked.map(q=>esc(c.asks.find(a=>a[0]===q)[1])).join(' · '):esc(R.notAsked)}</p>`);
  h+=group('확인한 자료',isReport?`<p>${seen.map(x=>esc(x.name)).join(' · ')||'아직 없음'}</p>`:`<ul class="facts">${seen.map(x=>`<li><strong>${esc(x.name)}</strong> ${esc(x.fact)}</li>`).join('')||'<li>아직 없음</li>'}</ul>`);
  h+=group('이 말은 맞을까?',verdicts(k));
  h+=group('조치',actions(k));
  if(isReport||fs.judgment||E.followReady(state,k)){
   let f=E.followReady(state,k)?`<p>${esc(followFact(k))}</p>`:'';
   f+=fs.judgment?`<ul class="verdicts">${verdictLine(0,c.follow.judge.text,fs.judgment,E.followAnswers[k])}</ul>`:isReport?'<p class="v-none">아직 안 함</p>':'';
   if(!isReport&&fs.judgment&&fs.judgment!=='legacy')f+=`<p class="pair"><span class="k">아직 모르는 점</span> ${esc(c.follow.unknown)}</p>`;
   h+=group('후속 조사',f);}
  if(isReport||state.notices[k].posted!==null||state.furthest>=E.sceneOf(k,'notice'))h+=group(N.report,noticeSummary(k));
  if(isReport||state.furthest>=E.sceneOf(k,'reflect'))h+=group('내 서술',written(D.reflect.q1,r.q1)+written(D.reflect.q2,r.q2));
  const links=[];
  if(isReport){if(state.furthest>=E.sceneOf(k,'reflect'))links.push(btn('서술 고치기','revisit',`data-scene="${E.sceneOf(k,'reflect')}"`));}
  else{if(state.judgments[k].includes('legacy'))links.push(btn('남은 판단 해 보기','revisit',`data-scene="${E.sceneOf(k,'check')}"`));
   if(fs.judgment==='legacy')links.push(btn('후속 조사 해 보기','revisit',`data-scene="${E.sceneOf(k,'follow')}"`));
   if(state.notices[k].posted==='legacy')links.push(btn('미리 알리기 해 보기','revisit',`data-scene="${E.sceneOf(k,'notice')}"`));
   if(cs.final&&state.furthest>=E.sceneOf(k,'choose'))links.push(btn('이 사건 다시 골라 보기','revisit',`data-scene="${E.sceneOf(k,'choose')}"`));}
  if(links.length)h+=`<div class="card-links">${links.join('')}</div>`;
  return h+'</section>';}
 // 보고서·수첩의 미리 알리기: 붙인 카드(부딪침·약속은 글자로 표시), 빠진 꼭 필요 카드, 판정 글자
 function noticeSummary(k){const ns=state.notices[k],posted=postedOf(k);
  if(!posted)return `<p class="v-none">${ns.posted==='legacy'?'이전 저장에서 넘어와 아직 안 함':'아직 안 함'}</p>`;
  const nt=D.cases[k].notice,r=E.noticeCheck(k,posted),flag=id=>{const kind=E.noticeKind(k,id);return kind==='conflict'||kind==='promise'?` <span class="n-flag">(${esc(N.kinds[kind])})</span>`:'';};
  const items=nt.cards.filter(c=>posted.includes(c.id)).map(c=>`<li>${esc(c.text)}${flag(c.id)}</li>`).concat(nt.cards.filter(c=>r.missing.includes(c.id)).map(c=>`<li class="n-missing">${esc(N.reportMissing)}: ${esc(c.text)}</li>`));
  return `<div class="notice-sum"><ul class="notice-list">${items.join('')}</ul><p class="v-pick">판정: ${r.ok?`<span class="v-tag v-ok">${esc(N.reportOk)}</span>`:`<span class="v-tag v-again">${esc(N.reportAgain)}</span>`}</p></div>`;}
 function notebook(){open('내 수첩','<p class="hint">확인한 것과 고른 것이 자동으로 적혀. 판단 칸은 네가 고른 그대로 남아.</p>'+E.CASES.map(k=>caseCard(k,'note')).join(''));}
 // 생각 정리 화면 왼쪽: 이 사건에서 고른 판단 셋과 조치를 작게 보여 준다.
 function reflectSummary(k){return `<div class="document reflect-sum"><p class="doc-label">${esc(D.reflect.summary)}</p>${verdicts(k)}${actions(k)}</div>`;}
 // 서술 칸: 문장 틀은 입력칸 위의 실제 글. 글자 수는 보여 주기만 하고 막지 않는다. 앞 줄바꿈은 HTML이 하나 먹으므로 하나 붙인다.
 function writeBox(id,frame,value,data,rows=4){
  return `<div class="write-q"><label class="frame-text" for="${id}">${frameHtml(frame)}</label><textarea id="${id}" ${data} rows="${rows}">\n${esc(value)}</textarea><p class="count"><span class="count-n">${[...value].length}자</span> · ${esc(D.reflect.recommend)}</p><p class="empty-note"${filled(value)?' hidden':''}>${esc(D.reflect.empty)}</p></div>`;}
 const today=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return {text:`${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`,file:`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};};
 // 보고서: 이 화면이 그대로 인쇄된다. 이름·학번은 이 기기 저장에만 남는다.
 function reportPage(){const e=D.ending,rp=state.reporter;
  return `<article class="report" aria-label="${esc(R.title)}"><div class="report-head"><p class="report-game">${esc(R.game)} · ${esc(R.title)}</p><p class="report-date">작성일 ${today().text}</p>`
   +`<div class="reporter"><label>이름 <input data-reporter="name" maxlength="40" autocomplete="off" value="${esc(rp.name)}"></label><label>학번 <input data-reporter="number" maxlength="40" autocomplete="off" value="${esc(rp.number)}"></label></div>`
   +`<p class="hint no-print">${esc(R.privacy)}</p></div><div class="report-actions no-print">${btn('PDF로 저장하기','print','','primary')}<p class="hint">${esc(R.printHint)}</p></div>`
   +E.CASES.map(k=>caseCard(k,'report')).join('')
   +`<section class="case-card" id="report-end" tabindex="-1"><h2 class="case-title">${esc(e.title)}</h2>${group('마지막 서술',written(D.reflect.finalPrompt,state.finalNote))}<div class="card-links">${btn('서술 고치기','revisit',`data-scene="${E.END}"`)}</div></section></article>`;}
 // PDF 기본 파일 이름이 되도록 인쇄하는 동안만 제목을 바꾼다.
 const baseTitle=document.title;
 function reportTitle(){const name=state.reporter.name.trim().replace(/[\\/:*?"<>|\s]+/g,'_');return ['투명성_보고서',name,today().file].filter(Boolean).join('_');}
 window.addEventListener('beforeprint',()=>{if(E.stepOf(state.scene)==='report')document.title=reportTitle();});
 window.addEventListener('afterprint',()=>{document.title=baseTitle;});
 function sources(){open('참고한 실제 사례',`<p>도시·동물·대사·문서·수치·선택 결과는 모두 창작이에요. 실제 기업의 모델이나 내부 문서를 재현하지 않았어요.</p><ul><li><a target="_blank" rel="noopener" href="https://www.nist.gov/publications/four-principles-explainable-artificial-intelligence">NIST (2021)</a>: 설명·이해 가능성·설명 정확성·지식 한계의 개념 참고.</li><li><a target="_blank" rel="noopener" href="https://blog.x.com/engineering/en_us/topics/insights/2021/sharing-learnings-about-our-image-cropping-algorithm">Twitter (2021)</a>: 자동 자르기와 사용자 통제 문제 참고.</li><li><a target="_blank" rel="noopener" href="https://www.vanderbilt.edu/brightspace/2023/08/16/guidance-on-ai-detection-and-why-were-disabling-turnitins-ai-detector/">Vanderbilt (2023)</a>: AI 탐지 기능 비활성화 발표와 신뢰성·설명 부족 우려 참고.</li><li><a target="_blank" rel="noopener" href="https://www.ftc.gov/news-events/news/press-releases/2023/12/rite-aid-banned-using-ai-facial-recognition-after-ftc-says-retailer-deployed-technology-without">FTC (2023)</a>: Rite Aid에 대한 규제기관의 주장과 제안된 합의 명령 발표 참고. 주장을 모두 법적으로 확정된 사실로 표현하지 않으며, 2023년 발표를 현재의 법적·운영 상태로 단정하지 않아요.</li></ul><p class="hint">링크를 열 때만 외부 사이트로 이동해요. 게임 진행이나 선택은 외부로 보내지 않아요.</p>`);}
 function reset(keepReporter){state=E.restart(state,{keepReporter});arrive();skipFocusReturn=true;save();render(true);}

 document.addEventListener('click',e=>{
  const b=e.target.closest('button[data-act]');if(!b||b.disabled)return;const act=b.dataset.act,k=E.caseKey(state.scene);revealCue=false;
  if(act==='close'){close();return;}
  if(act==='next'){send({type:'next'});return;}
  if(act==='back'){send({type:'revisit',scene:state.scene-1});return;}
  if(act==='source'){view=b.dataset.id;keepFinding=null;tapHint='';render();const vis=$('.visual');if(vis&&vis.getBoundingClientRect().top<0)vis.scrollIntoView({block:'start'});return;}
  if(act==='item'){view=b.dataset.id;keepFinding=null;tapHint='';const plain=['writing-guide','face-alert','face-photo','library-guide','recommend-reason'];if(plain.includes(view)&&!state.evidence.includes(view)){send({type:'check',id:view});}else render();
   const vis=$('.visual');if(vis&&vis.getBoundingClientRect().top<0)vis.scrollIntoView({block:'start'});return;}
  if(act==='spot'){if(b.dataset.id==='2'){tapHint='';send({type:'check',id:'photo-original'});}else{tapHint='그 친구는 담이가 아니야. 담이는 원본 어디에 있었을까? 담이는 초록 얼굴에 등껍질을 멘 친구야.';render();}return;}
  if(act==='region'){regions.add(Number(b.dataset.id));if(regions.size===3)send({type:'check',id:'photo-rule'});else render();return;}
  if(act==='record'){const r=D.history.find(x=>x.id===b.dataset.id);if(r.target){tapHint='';send({type:'check',id:'writing-history'});}else{tapHint=r.hint;render();}return;}
  if(act==='segment'){const s=D.cases.face.clerkSegments.find(x=>x.id===b.dataset.id);if(s.found){tapHint=s.id==='rule'?s.found:'';send({type:'check',id:'face-clerk'});}else{tapHint=s.hint;render();}return;}
  // 사건 4·5 자료 찾기
  if(act==='loan'){const L=D.cases.library;if(L.loans[Number(b.dataset.id)][2]===L.top){tapHint='';send({type:'check',id:'library-loans'});}else{tapHint=L.checks[1].hint;render();}return;}
  if(act==='score'){opened.add(Number(b.dataset.id));if(D.cases.library.scores.rows.filter(r=>r[5]).every(r=>opened.has(r[0])))send({type:'check',id:'library-scores'});else render();return;}
  if(act==='meet'){const x=D.cases.recommend.meeting.segments.find(s=>s.id===b.dataset.id);if(x.target)send({type:'check',id:'recommend-meeting'});else{tried.add('meet:'+x.id);render();}return;}
  if(act==='bus'){if(b.dataset.id==='none')send({type:'check',id:'recommend-bus'});else{tried.add('bus:'+b.dataset.id);render();}return;}
  if(act==='change'){const x=D.cases.library.follow.segments.find(s=>s.id===b.dataset.id);if(x.changed){tapHint='';send({type:'mark',id:'changed',value:'found'});}else{tapHint=x.hint;render();}return;}
  if(act==='list'){send({type:'mark',id:b.dataset.id,value:'open'});return;}
  if(act==='judge'){keepFinding=null;justJudged=E.currentJudgment(state,k);send({type:'judge',stamp:b.dataset.id});return;}
  if(act==='judge-next'){justJudged=null;render();$('#work .judge [data-act="judge"]')?.focus({preventScroll:true});return;}
  if(act==='notice-pick'){send({type:'notice-pick',id:b.dataset.id});return;}
  if(act==='notice-post'){send({type:'notice-post'});return;}
  if(act==='mark'){send({type:'mark',id:b.dataset.id,value:b.dataset.value});return;}
  if(act==='run'){send({type:'mark',id:'run',value:'done'});return;}
  if(act==='row'){send({type:'mark',id:b.dataset.id,value:'open'});return;}
  if(act==='follow-judge'){send({type:'follow-judge',stamp:b.dataset.id});return;}
  if(act==='choose'){send({type:'choose',id:b.dataset.id});return;}
  if(act==='rechoose'){send({type:'revisit',scene:state.scene-1});return;}
  if(act==='ask'){view=b.dataset.id;send({type:'ask',id:b.dataset.id});return;}
  if(act==='notebook'){notebook();return;}
  if(act==='print'){document.title=reportTitle();window.print();return;}
  // 서술을 고친 뒤 보고서로: 고친 사건 카드로 바로 간다.
  if(act==='to-report'){send({type:'revisit',scene:E.REPORT});const card=document.getElementById('report-'+b.dataset.case);if(card){card.scrollIntoView({block:'start'});card.focus({preventScroll:true});}return;}
  if(act==='revisit'){skipFocusReturn=modal.open;close();send({type:'revisit',scene:Number(b.dataset.scene)});return;}
  if(act==='sources'){sources();return;}
  if(act==='discussion'){open('토론 질문',`<ol>${D.ending.discussion.map(q=>`<li>${esc(q)}</li>`).join('')}</ol>`);return;}
  if(act==='settings'){open('설정',`<p>진행은 이 브라우저에 자동 저장돼요. 다시 열면 하던 곳부터 이어져요. 계정 가입이나 교사용 수집은 없어요.</p><div class="menu">${btn('참고한 실제 사례','sources')}${btn('처음부터 다시 하기','reset-ask')}</div><p class="hint">플레이 시간과 교육 효과는 아직 실제 학생을 대상으로 검증하지 않았어요.</p>`);return;}
  if(act==='reset-ask'){open('처음부터 다시 하기',`<p>이 게임의 진행과 수첩 기록을 지우고 처음으로 돌아가요. 공통 플레이어 정보와 다른 게임 기록은 그대로 둬요.</p><label class="check-row"><input type="checkbox" id="reset-reporter" checked> 이름과 학번도 지우기</label><div class="menu">${btn('지우고 처음부터','reset','','primary')}${btn('취소','close')}</div>`);return;}
  if(act==='reset'){const keep=$('#reset-reporter')?.checked===false;close();reset(keep);return;}
 });
 // 서술·이름 칸: 입력할 때마다 자동 저장한다. 다시 그리지 않아 입력 중인 글(한글 조합)이 끊기지 않는다.
 document.addEventListener('input',e=>{const t=e.target;if(!t.matches?.('textarea,input'))return;
  if(t.dataset.reflect)state=E.reduce(state,{type:'reflect',key:E.caseKey(state.scene),q:t.dataset.reflect,text:t.value});
  else if('note' in t.dataset)state=E.reduce(state,{type:'note',text:t.value});
  else if(t.dataset.reporter)state=E.reduce(state,{type:'reporter',field:t.dataset.reporter,text:t.value});
  else return;
  save();const box=t.closest('.write-q');if(box){box.querySelector('.count-n').textContent=[...t.value].length+'자';box.querySelector('.empty-note').hidden=filled(t.value);}});
 modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 modal.addEventListener('close',()=>{if(skipFocusReturn){skipFocusReturn=false;return;}if(lastFocus?.isConnected&&!lastFocus.disabled)lastFocus.focus({preventScroll:true});});
 // 사건 4·5 새 그림: 게임용 사본(.webp) → 원본(.png)을 차례로 불러 보고, 열리는 것이 있으면 그것을 쓴다. 없으면 story의 대신 그림 그대로.
 const artFound={};
 for(const [key,{base,bg}] of Object.entries(A.newArt||{})){const tryNext=list=>{if(!list.length)return;const src=base+'.'+list[0],img=new Image();
  img.onload=()=>{A[key]=src;if(bg!==undefined)A.backgrounds[bg]=src;artFound[key]=src;if(['library','recommend'].includes(E.caseKey(state.scene)))render(false);};img.onerror=()=>tryNext(list.slice(1));img.src=src;};tryNext(['webp','png']);}
 window.TransparencyGame={getState:()=>JSON.parse(JSON.stringify(state)),storageKey:KEY,art:()=>({...artFound})};
 save();render(false);
})();
