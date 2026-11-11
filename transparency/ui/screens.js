// 화면 그리기: 단계(프롤로그·궁금한 것·직접 확인·선택·결과·후속 조사·미리 알리기·생각 정리·마지막·보고서)마다 하나씩.
// 화면 하나는 {h: 머리(제목), v: 왼쪽 그림·자료 칸, b: 오른쪽 본문}을 돌려주고 render()가 #app에 넣는다.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,$,esc,btn,line,more,stage,caseStage,paint,itemView,evidenceHead,defaultView,judgeIndex,autoEvidence,judgeBlock,
  followView,followBody,noticeBody,noticeStage,reflectSummary,writeBox,reportPage}=UI;
 const STEP_LABELS={hook:'궁금한 것',check:'직접 확인',choose:'선택',result:'결과',follow:'후속 조사',notice:'만든 사람이라면: 미리 알리기',reflect:'생각 정리'};
 const lines=list=>list.map(l=>line(l)).join('');

 function nav(prev,next){
  return `<div class="step-nav">${prev?btn('이전','back'):'<span></span>'}${next||''}</div>`;
 }
 function nextButton(label,cls='primary'){
  return btn(label,'next',E.canAdvance(S.state)?'':'disabled',cls);
 }
 function head(meta,title){
  const resume=S.resumed?`<p class="resume" role="status">저장된 곳부터 이어서 해요. ${btn('처음부터 하기','reset-ask','','link')}</p>`:'';
  return `${resume}<p class="meta">${esc(meta)}</p><h1 tabindex="-1">${esc(title)}</h1>`;
 }

 // 사건 4: 구청에 묻기 넷. 하나 이상 물어야 직접 확인으로 간다. 대답은 마지막에 누른 질문의 것.
 function askBlock(c){
  const shown=c.asks.some(a=>a[0]===S.view)?S.view:S.state.asked[S.state.asked.length-1];
  const options=c.asks.map(([id,q])=>btn(esc(q),'ask',`data-id="${id}" aria-pressed="${S.state.asked.includes(id)}"`,'option'));
  let b=`<p class="question-label">${esc(c.askPrompt)}</p><div class="options asks">${options.join('')}</div>`;
  if(shown){
   const a=c.asks.find(x=>x[0]===shown);
   b+=`<div class="finding" role="status">${line([c.askWho,a[2]])}<p>${esc(c.afterAsk)}</p></div>`;
  }
  return b;
 }
 // 직접 확인의 오른쪽 위: 자료 버튼 줄
 function itemButtons(c){
  const buttons=c.checks.map(x=>{
   const seen=S.state.evidence.includes(x.id)?' <span class="seen">· 확인함</span>':'';
   return btn(esc(x.label)+seen,'item',`data-id="${x.id}" aria-pressed="${S.view===x.id}"`);
  });
  return `<div class="items" role="group" aria-label="확인할 자료">${buttons.join('')}</div>`;
 }
 // 펼친 자료 아래: 판단할 말이 나왔다는 한 줄, 찾을 것, 잘못 누른 안내, 찾은 내용
 function itemNotes(c,item,judging){
  let b='';
  if(S.revealCue&&judging)b+=`<p class="cue" role="status">아래에 판단할 말이 나왔어.</p>`;
  if(!S.state.evidence.includes(item.id))b+=`<p class="task">${esc(item.task)}</p>`;
  if(S.tapHint&&!c.solo)b+=`<p class="tap-hint" role="status">${esc(S.tapHint)}</p>`;
  const said=S.keepFinding?c.checks.find(x=>x.id===S.keepFinding):item;
  if(!c.solo&&S.state.evidence.includes(said.id)){
   b+=`<div class="finding${judging?' quiet':''}" role="status">${lines(said.finding)}${more(said.more)}</div>`;
  }
  return b;
 }
 // 직접 확인에서 아직 다음으로 못 갈 때: 남은 자료 이름, 다 찾았으면 남은 판단 수
 function checkHint(c,k){
  const left=c.checks.filter(x=>!S.state.evidence.includes(x.id)).map(x=>x.name);
  // 사건 5(혼자)는 '남은 자료' 힌트를 보이지 않는다.
  if(E.canAdvance(S.state)||left.length&&c.solo)return '';
  const done=S.state.judgments[k].filter(x=>x&&x!=='legacy').length;
  return `<p class="hint">${left.length?'남은 자료: '+esc(left.join(', ')):`말 3개를 모두 판단하면 다음으로 갈 수 있어. (지금 ${done}/3)`}</p>`;
 }

 const SCREENS={
  intro({meta}){
   return {
    h:head(meta,D.intro.title),
    v:stage(0,['moa'],{boxes:'box'}),
    b:lines(D.intro.lines)+`<p>${esc(D.intro.plan)}</p>`+nav(false,btn('첫 사건 시작하기','next','','primary'))+`<p class="hint">${esc(D.intro.note)}</p>`
   };
  },
  hook({meta,k,c}){
   const idle=UI.views[k].idle;
   let b=lines(c.hook)+(idle?idle():'')+`<p class="question-label">궁금한 것</p><p class="question">${esc(c.question)}</p>`;
   if(c.asks)b+=askBlock(c);
   b+=nav(true,nextButton('직접 확인하기'))+(E.canAdvance(S.state)?'':`<p class="hint">${esc(c.askNeed)}</p>`);
   return {
    h:(c.solo?`<p class="solo-note" role="note">${esc(c.soloNote)}</p>`:'')+head(meta,c.title),
    v:caseStage(k),
    b
   };
  },
  check({meta,k,c}){
   const h=head(meta,c.question);
   autoEvidence(k);
   const item=c.checks.find(x=>x.id===S.view);
   const judging=E.checked(S.state,k)&&judgeIndex(k)>=0;
   let b=itemButtons(c);
   if(!item)b+=`<p class="task">자료를 눌러 직접 확인해 봐.</p>`;
   else b+=itemNotes(c,item,judging);
   if(E.checked(S.state,k))b+=judgeBlock(k);
   b+=nav(true,nextButton('어떻게 할지 고르기'))+checkHint(c,k);
   return {h,v:item?evidenceHead(item.name)+itemView(k,item.id):defaultView(k),b};
  },
  choose({meta,k,c}){
   const cur=S.state.cases[k].final;
   const own=UI.views[k];
   const options=c.choose.options.map(o=>{
    const label=(own.optionArt?own.optionArt(o):'')+`<span>${esc(o.label)}</span>`;
    return btn(label,'choose',`data-id="${o.id}" aria-pressed="${cur===o.id}"`,'option');
   });
   return {
    h:head(meta,c.choose.question),
    v:caseStage(k,{result:!!cur}),
    b:`<div class="options${own.optionsCls||''}">${options.join('')}</div>`
     +`<p class="hint">${cur?'다시 고를 수 있어. 처음 고른 것도 수첩에 남아.':'고르면 바로 결과를 볼 수 있어.'}</p>`
     +nav(true,cur?btn('결과 다시 보기','next','','primary'):'')
   };
  },
  result({meta,k,c}){
   const o=c.choose.options.find(x=>x.id===S.state.cases[k].final);
   // 사건 5(혼자): 상태 글·모아 피드백 없이 결과 한 줄(summary)과 반응만.
   const b=(o.status?`<p class="status">${esc(o.status)}</p>`:'')
    +(o.summary?`<p class="result-summary">${esc(o.summary)}</p>`:'')
    +lines(o.reaction)
    +(o.feedback?line(['moa',o.feedback],'moa'):'')
    +more([o.more,c.more].filter(Boolean).join(' '))
    +nav(false,`<span class="nav-pair">${btn('다른 선택 해 보기','rechoose')}${btn('더 조사하기','next','','primary')}</span>`)
    +`<p class="hint">결과는 수첩에 자동으로 적혔어.</p>`;
   return {h:head(meta,o.title),v:caseStage(k,{result:true}),b};
  },
  follow({meta,k,c}){
   const f=c.follow;
   return {
    h:head(meta,f.question)+lines(f.lines)+(E.followReady(S.state,k)?'':`<p class="task">${esc(f.task)}</p>`),
    v:evidenceHead(f.src)+followView(k),
    b:followBody(k)+nav(true,nextButton('미리 알리기'))
   };
  },
  notice({meta,k,c}){
   return {
    h:head(meta,c.notice.title),
    v:noticeStage(k),
    b:noticeBody(k)+nav(true,nextButton('생각 정리하기'))
   };
  },
  reflect({meta,k,c}){
   const r=S.state.reflections[k];
   const toReport=S.state.furthest>=E.REPORT;
   const F=c.reflect||D.reflect;
   const last=k===E.CASES[E.CASES.length-1];
   // 보고서까지 갔다가 고치러 온 경우: ‘보고서로 돌아가기’가 으뜸 버튼이 된다.
   const next=btn(last?'마지막 장면으로':'다음 사건','next','',toReport?'':'primary');
   const back=toReport?`<span class="nav-pair">${next}${btn('보고서로 돌아가기','to-report',`data-case="${k}"`,'primary')}</span>`:next;
   return {
    h:head(meta,D.reflect.title),
    v:reflectSummary(k),
    b:`<p class="hint lead">${esc(D.reflect.lead)}</p>`
     +writeBox('reflect-q1',F.q1,r.q1,'data-reflect="q1"')
     +writeBox('reflect-q2',F.q2,r.q2,'data-reflect="q2"')
     +nav(true,back)
   };
  },
  // 마지막 장면: 질문은 사건 4(구청에 묻기)에 있다. 대사 2줄 + 마무리 한 줄 + 마지막 문장 + 마지막 서술 + 메뉴.
  end({meta}){
   const e=D.ending;
   const menu=btn('내 수첩 보기','notebook')+btn('참고한 실제 사례','sources')+btn('토론 질문','discussion')+btn('처음부터 다시 하기','reset-ask');
   return {
    h:head(meta,e.title),
    v:stage(0,['moa','lulu','dami'],{boxes:'window'}),
    b:lines(e.lines)+line(e.closing,'moa')
     +`<p class="ending-quote">${esc(e.quote)}</p>`
     +writeBox('final-note',D.reflect.finalPrompt,S.state.finalNote,'data-note',3)
     +nav(true,btn('나의 조사 보고서 보기','next','','primary'))
     +`<div class="menu">${menu}</div>`
   };
  },
  report({meta}){
   return {h:head(meta,D.report.title),v:'',b:reportPage()+nav(true,'')};
  }
 };

 function metaLine(step,k,c){
  if(k)return `${c.name} · ${E.CASES.indexOf(k)+1}/${E.CASES.length} · ${STEP_LABELS[step]}`;
  return step==='intro'?'프롤로그':step==='report'?'보고서':'마지막';
 }
 // 다시 그린 뒤 같은 버튼에 초점을 돌려주려고, 지금 초점이 있는 버튼을 가리키는 선택자를 만든다.
 // data-value까지 넣는다: 사진 후속 조사의 ‘나왔어’·‘잘렸어’는 data-act·data-id가 같고 data-value만 다르다.
 function focusSelector(){
  const el=document.activeElement;
  if(!el||!$('#app').contains(el))return null;
  const parts=['data-act','data-id','data-value'].filter(a=>el.hasAttribute(a)).map(a=>`[${a}="${CSS.escape(el.getAttribute(a))}"]`);
  return parts.length?el.tagName.toLowerCase()+parts.join(''):null;
 }
 // moved = 장면이 바뀌었다(제목에 초점을 주고 맨 위로). 아니면 누르던 버튼에 초점을 돌려준다.
 function render(moved){
  // 시작 화면을 보는 동안에는 게임 화면 대신 시작 화면을 그린다(ui/title.js).
  if(S.title)return UI.drawTitle(moved);
  const n=S.state.scene;
  const step=E.stepOf(n);
  const k=E.caseKey(n);
  const c=k&&D.cases[k];
  const {h,v,b}=SCREENS[step]({meta:metaLine(step,k,c),k,c});
  const focus=moved?null:focusSelector();
  const judging=step==='check'&&E.checked(S.state,k)&&judgeIndex(k)>=0;
  $('#app').className='step-'+step+(judging?' judging':'');
  $('#app').innerHTML=`<div class="screen${moved?' arrive':''}"><div class="head">${h}</div>${v?`<div class="visual">${v}</div>`:''}<div class="body" id="work" tabindex="-1">${b}</div></div>`;
  paint();
  if(moved){
   $('h1').focus({preventScroll:true});
   window.scrollTo(0,0);
  }else if(focus){
   const t=$('#app').querySelector(focus);
   (t&&!t.disabled?t:$('#work')).focus({preventScroll:true});
  }
 }

 UI.render=render;
 UI.STEP_LABELS=STEP_LABELS;
})();
