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
 let autoKey=null,keepFinding=null,scrollJudge=false;
 const photo=new Image();photo.src=A.photo;photo.onload=paint;
 const modal=$('#modal');
 const STEP_LABELS={hook:'궁금한 것',check:'직접 확인',choose:'선택',result:'결과',follow:'후속 조사'};
 const FACE_NAMES=['토리','루루','담이','모아','몽이'];
 const pct=(v,t)=>(v/t*100).toFixed(3)+'%';
 const rectStyle=([x,y,w,h])=>`left:${pct(x,1536)};top:${pct(y,1024)};width:${pct(w,1536)};height:${pct(h,1024)}`;

 function save(){if(!preview)try{localStorage.setItem(KEY,JSON.stringify(state));saveOK=true;}catch{saveOK=false;}
  $('#save-status').textContent=preview?'S01 미리보기 · 진행 저장 안 함':saveOK?'이 기기에 자동 저장 · '+nickname:'저장할 수 없어 이 창에서만 진행해요. 창을 닫으면 기록이 사라져요.';}
 function send(a){const before=state.scene;state=E.reduce(state,a);if(state.scene!==before)arrive();save();render(state.scene!==before);}
 function arrive(){view=null;regions=new Set();tapHint='';justJudged=null;resumed=false;autoKey=null;keepFinding=null;scrollJudge=false;}
 function btn(label,act,attrs='',cls=''){return `<button ${cls?`class="${cls}"`:''} data-act="${act}" ${attrs}>${label}</button>`;}
 function line([who,text],cls=''){return `<p class="line ${cls}"><span class="who">${esc(D.names[who])}</span> ${esc(text)}</p>`;}
 function more(text){return text?`<details class="more"><summary>자세히 보기</summary><p>${esc(text)}</p></details>`:'';}
 function canvas(rect,label){return `<canvas class="photo-canvas" width="${rect[2]}" height="${rect[3]}" data-crop="${rect.join(',')}" role="img" aria-label="${esc(label)}"></canvas>`;}
 function paint(){if(!photo.complete||!photo.naturalWidth)return;document.querySelectorAll('canvas[data-crop]').forEach(c=>{const r=c.dataset.crop.split(',').map(Number),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(photo,...r,0,0,c.width,c.height);});}

 // 장면 그림. 결과가 그림에 바로 보이게 한다(게시판 사진·입장 표시·점원 표정).
 function stage(bg,cast,{photoRect,status,boxes}={}){
  return `<div class="stage"><img class="backdrop" src="${A.backgrounds[bg]}" alt="${D.bgNames[bg]}">${photoRect?`<div class="stage-photo">${canvas(photoRect,'게시판에 올린 사진')}</div>`:''}${boxes?`<div class="stage-boxes" aria-hidden="true">${[0,1,2].map(()=>`<span class="prop ${boxes}"></span>`).join('')}</div>`:''}${status?`<p class="stage-status">${esc(status)}</p>`:''}<div class="cast">${cast.map(c=>`<img class="actor ${c}" src="${A[c]}" alt="${esc(D.names[c])}">`).join('')}</div></div>`;
 }
 function caseStage(k,{result=false}={}){const c=D.cases[k],o=E.outcome(state,k),opt=c.choose.options.find(x=>x.id===o.id);
  let cast=c.cast.slice(),status='';
  if(k==='face'){status=result&&o.id==='release'?'입장 제한 해제':'입장 제한 중';if(result&&o.id==='release')cast=cast.map(x=>x==='clerk'?'clerkOpen':x);}
  if(k==='writing'&&result&&opt)status=opt.status;
  return stage(c.bg,cast,{photoRect:k==='photo'?(result?o.rect:E.AUTO):null,status});
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
  if(id==='face-photo')return `<div class="compare-labels" aria-hidden="true"><span>등록된 사진</span><span>오늘 찍힌 사진</span></div><img class="evidence-photo" src="${A.faces}" alt="왼쪽은 등록된 사진, 오른쪽은 오늘 찍힌 사진. 둘 다 흐리고 문틀과 반사에 일부 가려진 가상의 고양이 얼굴이다.">`;
  return '';
 }
 function defaultView(k){if(k==='photo')return `<figure class="crop-figure">${canvas(E.AUTO,'자동으로 자른 사진. 담이 얼굴이 없다.')}<figcaption>자동으로 자른 사진</figcaption></figure>`;if(k==='writing')return report();return caseStage(k);}

 function nav(prev,next){return `<div class="step-nav">${prev?btn('이전','back'):'<span></span>'}${next||''}</div>`;}
 function head(meta,title){return `${resumed?`<p class="resume" role="status">저장된 곳부터 이어서 해요. ${btn('처음부터 하기','reset-ask','','link')}</p>`:''}<p class="meta">${esc(meta)}</p><h1 tabindex="-1">${esc(title)}</h1>`;}

 function render(moved){
  const n=state.scene,step=E.stepOf(n),k=E.caseKey(n),c=k&&D.cases[k];let h='',v='',b='';
  const meta=k?`${c.name} · ${E.CASES.indexOf(k)+1}/3 · ${STEP_LABELS[step]}`:step==='intro'?'프롤로그':'마지막';
  if(step==='intro'){h=head(meta,D.intro.title);v=stage(0,['moa'],{boxes:'box'});
   b=D.intro.lines.map(l=>line(l)).join('')+`<p>${esc(D.intro.plan)}</p>`+nav(false,btn('첫 사건 시작하기','next','','primary'))+`<p class="hint">${esc(D.intro.note)}</p>`;}
  if(step==='hook'){h=head(meta,c.title);v=caseStage(k);
   b=c.hook.map(l=>line(l)).join('')+(k==='photo'?defaultView('photo'):k==='writing'?report():'')+`<p class="question-label">궁금한 것</p><p class="question">${esc(c.question)}</p>`+nav(true,btn('직접 확인하기','next','','primary'));}
  if(step==='check'){h=head(meta,c.question);autoEvidence(k);const item=c.checks.find(x=>x.id===view),judging=E.checked(state,k)&&judgeIndex(k)>=0;v=item?itemView(k,item.id):defaultView(k);
   b=`<div class="items" role="group" aria-label="확인할 자료">${c.checks.map(x=>btn(esc(x.label)+(state.evidence.includes(x.id)?' <span class="seen">· 확인함</span>':''),'item',`data-id="${x.id}" aria-pressed="${view===x.id}"`)).join('')}</div>`;
   if(!item)b+=`<p class="task">자료를 눌러 직접 확인해 봐.</p>`;
   else{if(!state.evidence.includes(item.id))b+=`<p class="task">${esc(item.task)}</p>`;if(tapHint)b+=`<p class="tap-hint" role="status">${esc(tapHint)}</p>`;const said=keepFinding?c.checks.find(x=>x.id===keepFinding):item;if(state.evidence.includes(said.id))b+=`<div class="finding${judging?' quiet':''}" role="status">${said.finding.map(l=>line(l)).join('')}${more(said.more)}</div>`;}
   if(E.checked(state,k))b+=judgeBlock(k);
   const left=c.checks.filter(x=>!state.evidence.includes(x.id)).map(x=>x.name);
   b+=nav(true,btn('어떻게 할지 고르기','next',E.canAdvance(state)?'':'disabled','primary'))+(E.canAdvance(state)?'':`<p class="hint">${left.length?'남은 자료: '+esc(left.join(', ')):`말 3개를 모두 판단하면 다음으로 갈 수 있어. (지금 ${state.judgments[k].filter(x=>x&&x!=='legacy').length}/3)`}</p>`);}
  if(step==='choose'){const cur=state.cases[k].final;h=head(meta,c.choose.question);v=caseStage(k,{result:!!cur});
   b=`<div class="options${k==='photo'?' photo-options':''}">${c.choose.options.map(o=>btn((k==='photo'?canvas(o.id==='all'?E.ALL:E.AUTO,o.label):'')+`<span>${esc(o.label)}</span>`,'choose',`data-id="${o.id}" aria-pressed="${cur===o.id}"`,'option')).join('')}</div>`;
   b+=`<p class="hint">${cur?'다시 고를 수 있어. 처음 고른 것도 수첩에 남아.':'고르면 바로 결과를 볼 수 있어.'}</p>`+nav(true,cur?btn('결과 다시 보기','next','','primary'):'');}
  if(step==='result'){const o=c.choose.options.find(x=>x.id===state.cases[k].final);h=head(meta,o.title);v=caseStage(k,{result:true});
   b=`<p class="status">${esc(o.status)}</p>`+o.reaction.map(l=>line(l)).join('')+line(['moa',o.feedback],'moa')+more([o.more,c.more].filter(Boolean).join(' '))+nav(false,`<span class="nav-pair">${btn('다른 선택 해 보기','rechoose')}${btn('더 조사하기','next','','primary')}</span>`)+`<p class="hint">결과는 수첩에 자동으로 적혔어.</p>`;}
  if(step==='follow'){const f=c.follow;h=head(meta,f.question)+f.lines.map(l=>line(l)).join('')+(E.followReady(state,k)?'':`<p class="task">${esc(f.task)}</p>`);v=followView(k);
   b=followBody(k)+nav(true,btn(k==='face'?'마지막 장면으로':'다음 사건','next',E.canAdvance(state)?'':'disabled','primary'));}
  if(step==='end'){const e=D.ending;h=head(meta,e.title);v=stage(0,['moa','lulu','dami'],{boxes:'window'});
   b=e.lines.map(l=>line(l)).join('')+`<p class="question">${esc(e.question)}</p><div class="options">${e.asks.map(([id,t])=>btn(esc(t),'ask',`data-id="${id}" aria-pressed="${state.question===id&&view===null||view===id}"`,'option')).join('')}</div>`;
   const asked=view||state.question;
   if(asked){const a=e.asks.find(x=>x[0]===asked);b+=`<div class="finding" role="status">${line(['app',a[2]])}<p>${esc(e.afterAsk)}</p></div>`+line(e.closing,'moa')+`<p class="ending-quote">${esc(e.quote)}</p><div class="menu">${btn('내 수첩 보기','notebook')}${btn('참고한 실제 사례','sources')}${btn('토론 질문','discussion')}${btn('처음부터 다시 하기','reset-ask')}</div>`;}
   b+=nav(true,'');}
  const focus=moved?null:focusSelector();
  $('#app').className='step-'+step+(step==='check'&&E.checked(state,k)&&judgeIndex(k)>=0?' judging':'');
  $('#app').innerHTML=`<div class="screen"><div class="head">${h}</div><div class="visual">${v}</div><div class="body" id="work" tabindex="-1">${b}</div></div>`;
  paint();
  if(moved){$('h1').focus({preventScroll:true});window.scrollTo(0,0);}
  else if(focus){const t=$('#app').querySelector(focus);(t&&!t.disabled?t:$('#work')).focus({preventScroll:true});}
  if(scrollJudge){scrollJudge=false;if(!moved)$('.judge')?.scrollIntoView({block:matchMedia('(max-width:860px)').matches?'start':'nearest'});}
 }
 // 판단 뒤: 정답 칸에 ‘✓ 정답’, 고른 오답에 ‘내 선택’(점선). 색만으로 구분하지 않는다
 function stampButtons(act,picked,answer){return `<div class="stamps" role="group" aria-label="판단">${Object.entries(D.stamps).map(([id,label])=>{const right=!!picked&&id===answer,mine=!!picked&&id===picked&&!right;
  return btn(esc(label)+(right?' <span class="stamp-tag">✓ 정답</span>':mine?' <span class="stamp-tag">내 선택</span>':''),act,`data-id="${id}" aria-pressed="${picked===id}" ${picked?'disabled':''}`,right?'stamp-right':mine?'stamp-mine':'');}).join('')}</div>`;}
 function verdict(j,picked,answer){return picked===answer?j.right:`${j.wrong} 정리: ${D.stamps[answer]}.`;}
 function verdictBox(j,picked,answer){const wrong=picked!==answer;return `<div class="finding${wrong?' again':''}" role="status">${wrong?'<p class="again-head">다시 보자</p>':''}<p>${esc(verdict(j,picked,answer))}</p></div>`;}
 const judgeIndex=k=>justJudged!==null?justJudged:E.currentJudgment(state,k);
 // 판단 문장이 바뀌면 왼쪽 자료도 그 문장의 근거로. 문장마다 한 번만 맞추고, 그 뒤 직접 고른 자료는 그대로 둔다
 function autoEvidence(k){if(!E.checked(state,k))return;const idx=judgeIndex(k),key=idx<0?null:k+idx;if(!key||key===autoKey)return;const first=autoKey===null;autoKey=key;scrollJudge=true;tapHint='';const src=D.cases[k].judges[idx].src;if(!src.includes(view)){if(first&&view)keepFinding=view;view=src[0];}}
 function sourceTags(k,src){const c=D.cases[k];return `<p class="judge-src">볼 자료: ${src.map(id=>btn(esc(c.checks.find(x=>x.id===id).name),'source',`data-id="${id}" aria-pressed="${view===id}"`,'source-tag')).join(' ')}</p>`;}
 function judgeCard(who,text,num,extra){return `<h2 class="question-label judge-head">이 말은 맞을까?${num?' '+num:''}</h2><blockquote class="judge-say"><p>“${esc(text)}”</p><cite>- ${esc(D.names[who])}</cite></blockquote>${extra}`;}
 function judgeBlock(k){const c=D.cases[k],js=state.judgments[k],idx=judgeIndex(k);
  if(idx<0)return `<section class="judge"><p class="question-label">판단 3개를 마쳤어</p><p>${esc(c.after)}</p></section>`;
  const j=c.judges[idx],picked=js[idx]&&js[idx]!=='legacy'?js[idx]:null,answer=E.answers[k][idx];
  let h=`<section class="judge judge-card" aria-label="판단할 말 ${idx+1}/3">${judgeCard(j.who,j.text,(idx+1)+'/3',sourceTags(k,j.src))}${stampButtons('judge',picked,answer)}`;
  if(js[idx]==='legacy')h+='<p class="hint">이전 저장에서 넘어와 아직 하지 않은 판단이야. 지금 해 볼 수 있어.</p>';
  if(picked){h+=verdictBox(j,picked,answer);h+=E.currentJudgment(state,k)>=0?btn('다음 말 보기','judge-next'):`<p>${esc(c.after)}</p>`;}
  return h+'</section>';}
 // 후속 조사
 const tally=()=>{const counts=[0,0,0,0,0];for(const r of E.FOLLOW_CROPS)for(const i of E.cutFaces(r))counts[i]++;return counts.map((n,i)=>[FACE_NAMES[i],n]).sort((a,b)=>b[1]-a[1]);};
 const CHIPS={'완료':['done','✓'],'진행 중':['doing','◐'],'예정':['plan','○']};
 function chip(s){const [cls,mark]=CHIPS[s];return `<span class="chip chip-${cls}">${mark} ${esc(s)}</span>`;}
 function followView(k){const f=D.cases[k].follow,fs=state.follows[k],locked=!!fs.judgment&&fs.judgment!=='legacy';
  if(k==='photo')return `<div class="follow-grid">${E.FOLLOW_CROPS.map((r,i)=>{const id='p'+(i+1),m=fs.marks[id];return `<figure class="follow-photo">${canvas(r,'사진 '+(i+1))}<figcaption>사진 ${i+1}</figcaption><div class="mark-row" role="group" aria-label="사진 ${i+1}에 담이가 나왔나">${btn('나왔어','mark',`data-id="${id}" data-value="shown" aria-pressed="${m==='shown'}" ${locked?'disabled':''}`)}${btn('잘렸어','mark',`data-id="${id}" data-value="cut" aria-pressed="${m==='cut'}" ${locked?'disabled':''}`)}</div></figure>`;}).join('')}</div><p class="caption">${esc(f.note)}</p>`;
  if(k==='writing'){const ran=fs.marks.run==='done';return `<div class="document"><p class="doc-label">${esc(f.docLabel)}${ran?' · 검사 결과':''}</p><p>${f.sentences.map((t,i)=>ran&&f.flagged.includes(i)?`<mark>${esc(t)}</mark>`:esc(t)).join(' ')}</p>${ran?'<p class="legend">노란 표시: AI 작성 의심</p>':''}</div>`;}
  return `<div class="document compact"><p class="doc-label">${esc(f.docLabel)}</p></div><div class="records">${f.rows.map(r=>{const open=fs.marks[r.id]==='open';return btn(`<span class="row-top">${chip(r.status)}${open?'':'<span class="row-open">근거 보기 ▸</span>'}</span><span class="row-item">${esc(r.item)}</span>${open?`<span class="proof">근거: ${esc(r.proof)}</span>`:''}`,'row',`data-id="${r.id}" aria-expanded="${open}"`,'record');}).join('')}</div>`;}
 function followFact(k){const f=D.cases[k].follow,fs=state.follows[k];
  if(k==='photo'){const t=tally(),mine=E.followMarks.photo.ids.filter(id=>fs.marks[id]==='cut').length;return `여섯 장 가운데 담이가 잘린 사진은 ${E.truth.filter(x=>x==='cut').length}장이다. 얼굴이 일부라도 사진 틀 밖으로 나가면 잘린 것으로 셌다. 잘린 횟수: ${t.map(([n,c])=>n+' '+c).join(' · ')}. (내가 ‘잘렸어’로 고른 사진 ${mine}장)`;}
  if(k==='writing')return '선생님이 5년 전에 쓴 글을 같은 검사기에 넣자, 세 문장 가운데 두 문장에 ‘AI 작성 의심’ 표시가 붙었다.';
  const n=s=>f.rows.filter(r=>r.status===s).length;return `점검표 ${f.rows.length}개 가운데 완료 ${n('완료')}개, 진행 중 ${n('진행 중')}개, 예정 ${n('예정')}개이고, 예정 항목에는 점검 기록이 없다.`;}
 function followBody(k){const f=D.cases[k].follow,fs=state.follows[k],m=E.followMarks[k],done=m.ids.filter(id=>fs.marks[id]).length;let b='';
  if(k==='writing')b+=btn('검사기에 넣기','run',fs.marks.run?'disabled':'');
  else if(!E.followReady(state,k))b+=`<p class="hint">${done}/${m.ids.length} ${k==='photo'?'장 골랐어':'개 확인했어'}.</p>`;
  if(!E.followReady(state,k))return b;
  if(k==='photo'){const wrong=m.ids.map((id,i)=>fs.marks[id]!==E.truth[i]?i+1:null).filter(Boolean);b+=`<div class="finding" role="status"><p>${esc(followFact(k).replace(/ \(내가.*$/,''))}</p><p>${wrong.length?`네 표시와 기록이 다른 사진: ${wrong.join(', ')}번`:'네 표시는 기록과 같아.'}</p></div>`;}
  else b+=`<div class="finding" role="status"><p>${esc(followFact(k))}</p></div>`;
  const j=f.judge,picked=fs.judgment&&fs.judgment!=='legacy'?fs.judgment:null,answer=E.followAnswers[k];
  b+=`<section class="judge judge-card" aria-label="판단할 말">${judgeCard(j.who,j.text,'',`<p class="judge-src">볼 자료: <span class="source-name">${esc(f.src)}</span></p>`)}${stampButtons('follow-judge',picked,answer)}`;
  if(fs.judgment==='legacy')b+='<p class="hint">이전 저장에서 넘어와 아직 하지 않은 조사야. 지금 해 볼 수 있어.</p>';
  if(picked)b+=`${verdictBox(j,picked,answer)}<p class="unknown"><strong>아직 모르는 점</strong> ${esc(f.unknown)}</p>${more(f.more)}`;
  return b+'</section>';}
 function focusSelector(){const el=document.activeElement;if(!el||!$('#app').contains(el))return null;const parts=['data-act','data-id'].filter(a=>el.hasAttribute(a)).map(a=>`[${a}="${CSS.escape(el.getAttribute(a))}"]`);return parts.length?el.tagName.toLowerCase()+parts.join(''):null;}

 function open(title,html){lastFocus=document.activeElement;$('#modal-title').textContent=title;$('#modal-body').innerHTML=html;if(!modal.open)modal.showModal();paint();}
 function close(){modal.close();}
 // 수첩: 활동 결과를 자동으로 적는다. 열어 보는 것은 선택.
 function notebook(){let h='<p class="hint">확인한 것과 고른 것이 자동으로 적혀. 판단 칸은 네가 고른 그대로 남아.</p>';
  const pickText=(text,p,answer)=>`“${esc(text)}” → ${p==='legacy'?'이전 저장에서 넘어와 아직 안 함':'내가 고른 칸: '+esc(D.stamps[p])+(p!==answer?` (정리: ${esc(D.stamps[answer])})`:'')}`;
  for(const k of E.CASES){const c=D.cases[k],cs=state.cases[k],js=state.judgments[k],fs=state.follows[k],seen=c.checks.filter(x=>state.evidence.includes(x.id)),label=id=>c.choose.options.find(o=>o.id===id)?.label;
   h+=`<section class="note-case"><h3>${esc(c.name)}</h3>`;
   if(!seen.length&&!cs.final){h+='<p class="hint">아직 시작하지 않았어.</p></section>';continue;}
   h+=`<dl><dt>궁금한 것</dt><dd>${esc(c.question)}</dd><dt>확인한 것</dt><dd>${seen.map(x=>esc(x.fact)).join('<br>')||'아직 없음'}</dd>`;
   h+=`<dt>내 판단</dt><dd>${js.some(Boolean)?js.map((p,i)=>p?`${i+1}. ${pickText(c.judges[i].text,p,E.answers[k][i])}`:'').filter(Boolean).join('<br>'):'아직 안 함'}</dd>`;
   h+=`<dt>처음 고른 것</dt><dd>${esc(label(cs.first)||'아직 안 고름')}${cs.legacyFirst?' (이전 저장에서는 마지막 선택만 남아 있었어)':''}</dd><dt>마지막으로 고른 것</dt><dd>${esc(label(cs.final)||'아직 안 고름')}</dd>`;
   if(fs.judgment||E.followReady(state,k)){h+=`<dt>후속 조사</dt><dd>${E.followReady(state,k)?esc(followFact(k))+'<br>':''}${fs.judgment?pickText(c.follow.judge.text,fs.judgment,E.followAnswers[k]):''}</dd>`;
    if(fs.judgment&&fs.judgment!=='legacy')h+=`<dt>아직 모르는 점</dt><dd>${esc(c.follow.unknown)}</dd>`;}
   h+='</dl>';
   if(js.includes('legacy'))h+=btn('남은 판단 해 보기','revisit',`data-scene="${E.sceneOf(k,'check')}"`);
   if(fs.judgment==='legacy')h+=btn('후속 조사 해 보기','revisit',`data-scene="${E.sceneOf(k,'follow')}"`);
   if(cs.final&&state.furthest>=E.sceneOf(k,'choose'))h+=btn('이 사건 다시 골라 보기','revisit',`data-scene="${E.sceneOf(k,'choose')}"`);
   h+='</section>';}
  open('내 수첩',h);}
 function sources(){open('참고한 실제 사례',`<p>도시·동물·대사·문서·수치·선택 결과는 모두 창작이에요. 실제 기업의 모델이나 내부 문서를 재현하지 않았어요.</p><ul><li><a target="_blank" rel="noopener" href="https://www.nist.gov/publications/four-principles-explainable-artificial-intelligence">NIST (2021)</a>: 설명·이해 가능성·설명 정확성·지식 한계의 개념 참고.</li><li><a target="_blank" rel="noopener" href="https://blog.x.com/engineering/en_us/topics/insights/2021/sharing-learnings-about-our-image-cropping-algorithm">Twitter (2021)</a>: 자동 자르기와 사용자 통제 문제 참고.</li><li><a target="_blank" rel="noopener" href="https://www.vanderbilt.edu/brightspace/2023/08/16/guidance-on-ai-detection-and-why-were-disabling-turnitins-ai-detector/">Vanderbilt (2023)</a>: AI 탐지 기능 비활성화 발표와 신뢰성·설명 부족 우려 참고.</li><li><a target="_blank" rel="noopener" href="https://www.ftc.gov/news-events/news/press-releases/2023/12/rite-aid-banned-using-ai-facial-recognition-after-ftc-says-retailer-deployed-technology-without">FTC (2023)</a>: Rite Aid에 대한 규제기관의 주장과 제안된 합의 명령 발표 참고. 주장을 모두 법적으로 확정된 사실로 표현하지 않으며, 2023년 발표를 현재의 법적·운영 상태로 단정하지 않아요.</li></ul><p class="hint">링크를 열 때만 외부 사이트로 이동해요. 게임 진행이나 선택은 외부로 보내지 않아요.</p>`);}
 function reset(){state=E.initial();arrive();skipFocusReturn=true;save();render(true);}

 document.addEventListener('click',e=>{
  const b=e.target.closest('button[data-act]');if(!b||b.disabled)return;const act=b.dataset.act,k=E.caseKey(state.scene);
  if(act==='close'){close();return;}
  if(act==='next'){send({type:'next'});return;}
  if(act==='back'){send({type:'revisit',scene:state.scene-1});return;}
  if(act==='source'){view=b.dataset.id;keepFinding=null;tapHint='';render();const vis=$('.visual');if(vis&&vis.getBoundingClientRect().top<0)vis.scrollIntoView({block:'start'});return;}
  if(act==='item'){view=b.dataset.id;keepFinding=null;tapHint='';const plain=['writing-guide','face-alert','face-photo'];if(plain.includes(view)&&!state.evidence.includes(view)){send({type:'check',id:view});}else render();
   const vis=$('.visual');if(vis&&vis.getBoundingClientRect().top<0)vis.scrollIntoView({block:'start'});return;}
  if(act==='spot'){if(b.dataset.id==='2'){tapHint='';send({type:'check',id:'photo-original'});}else{tapHint='그 친구는 담이가 아니야. 담이는 원본 어디에 있었을까? 담이는 초록 얼굴에 등껍질을 멘 친구야.';render();}return;}
  if(act==='region'){regions.add(Number(b.dataset.id));if(regions.size===3)send({type:'check',id:'photo-rule'});else render();return;}
  if(act==='record'){const r=D.history.find(x=>x.id===b.dataset.id);if(r.target){tapHint='';send({type:'check',id:'writing-history'});}else{tapHint=r.hint;render();}return;}
  if(act==='segment'){const s=D.cases.face.clerkSegments.find(x=>x.id===b.dataset.id);if(s.found){tapHint=s.id==='rule'?s.found:'';send({type:'check',id:'face-clerk'});}else{tapHint=s.hint;render();}return;}
  if(act==='judge'){keepFinding=null;justJudged=E.currentJudgment(state,k);send({type:'judge',stamp:b.dataset.id});return;}
  if(act==='judge-next'){justJudged=null;render();$('#work .judge [data-act="judge"]')?.focus({preventScroll:true});return;}
  if(act==='mark'){send({type:'mark',id:b.dataset.id,value:b.dataset.value});return;}
  if(act==='run'){send({type:'mark',id:'run',value:'done'});return;}
  if(act==='row'){send({type:'mark',id:b.dataset.id,value:'open'});return;}
  if(act==='follow-judge'){send({type:'follow-judge',stamp:b.dataset.id});return;}
  if(act==='choose'){send({type:'choose',id:b.dataset.id});return;}
  if(act==='rechoose'){send({type:'revisit',scene:state.scene-1});return;}
  if(act==='ask'){view=b.dataset.id;send({type:'ask',id:b.dataset.id});return;}
  if(act==='notebook'){notebook();return;}
  if(act==='revisit'){skipFocusReturn=modal.open;close();send({type:'revisit',scene:Number(b.dataset.scene)});return;}
  if(act==='sources'){sources();return;}
  if(act==='discussion'){open('토론 질문','<ol><li>설명을 들었지만 문제가 해결되지 않은 장면은 어디였나?</li><li>끝까지 알 수 없었던 것은 무엇이고, 그래도 바꿀 수 있었던 조치는 무엇인가?</li></ol>');return;}
  if(act==='settings'){open('설정',`<p>진행은 이 브라우저에 자동 저장돼요. 다시 열면 하던 곳부터 이어져요. 계정 가입이나 교사용 수집은 없어요.</p><div class="menu">${btn('참고한 실제 사례','sources')}${btn('처음부터 다시 하기','reset-ask')}</div><p class="hint">플레이 시간과 교육 효과는 아직 실제 학생을 대상으로 검증하지 않았어요.</p>`);return;}
  if(act==='reset-ask'){open('처음부터 다시 하기',`<p>이 게임의 진행과 수첩 기록을 지우고 처음으로 돌아가요. 공통 플레이어 정보와 다른 게임 기록은 그대로 둬요.</p><div class="menu">${btn('지우고 처음부터','reset','','primary')}${btn('취소','close')}</div>`);return;}
  if(act==='reset'){close();reset();return;}
 });
 modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 modal.addEventListener('close',()=>{if(skipFocusReturn){skipFocusReturn=false;return;}if(lastFocus?.isConnected&&!lastFocus.disabled)lastFocus.focus({preventScroll:true});});
 window.TransparencyGame={getState:()=>JSON.parse(JSON.stringify(state)),storageKey:KEY};
 save();render(false);
})();
