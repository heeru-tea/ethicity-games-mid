// 미리 알리기: 학생이 그 AI를 내놓는 쪽이 되어 안내문 카드를 고른다. 피드백·보고서는 마지막으로 붙인 안내문(posted) 기준.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,esc,btn,send,actions,line,caseStage}=UI;
 const N=D.notice;
 const sameSet=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
 const postedOf=k=>Array.isArray(S.state.notices[k].posted)?S.state.notices[k].posted:null;

 // 카드 한 장의 피드백: 상태 글자(✓/!/○ + 종류 · 넣음/빠짐/뺐음)와 짧은 한 줄. 색만으로 구분하지 않는다.
 function cardFeedback(k,card,posted){
  const kind=E.noticeKind(k,card.id);
  const on=posted.includes(card.id);
  // good: 잘한 것(true) · 고칠 것(false) · 있으면 좋음 카드라 판정 없음(null)
  const good=kind==='must'?on:kind==='nice'?null:!on;
  const mark=good===null?(on?'✓':'○'):good?'✓':'!';
  const state_=on?'넣음':kind==='must'?'빠짐':kind==='nice'?'안 넣음':'뺐음';
  // 사건 5(혼자): 다른 카드 설명은 숨기되, 부딪침 카드의 이유(상충관계)는 남긴다(2026-11-09 사용자)
  let say;
  if(D.cases[k].solo)say=kind==='conflict'?card.clash||'':'';
  else if(kind==='conflict')say=[N.fb.conflict[on?'in':'out'],card.clash].filter(Boolean).join(' ');
  else say=N.fb[kind][on?'in':'out'];
  const cls=good===false?'fb-again':good===null&&!on?'fb-plain':'fb-ok';
  return `<p class="card-fb ${cls}" id="fb-${card.id}"><span class="fb-tag">${mark} ${esc(N.kinds[kind])} · ${state_}</span>${say?' '+esc(say):''}</p>`;
 }
 function noticeVerdict(k,posted){
  const r=E.noticeCheck(k,posted);
  const parts=['missing','conflicts','promises'].filter(x=>r[x].length).map(x=>`${N.againParts[x]} ${r[x].length}장`);
  if(D.cases[k].solo){
   const rest=r.ok?'':' · '+esc(parts.join(' · '))+'.';
   return `<div class="finding${r.ok?'':' again'} notice-verdict" role="status"><p><strong>${esc(r.ok?N.ok:N.again)}</strong>${rest}</p></div>`;
  }
  if(r.ok)return `<div class="finding notice-verdict" role="status"><p><strong>${esc(N.ok)}</strong> ${esc(N.okMore)}</p></div>`;
  return `<div class="finding again notice-verdict" role="status"><p class="again-head">${esc(N.again)}</p><p>${esc(parts.join(' · '))}. ${esc(N.againMore)}</p></div>`;
 }
 // 고정 한 줄과 사건 도입 대사를 한 묶음으로 짧게: 같은 화자가 이어 말하면 얼굴·이름을 다시 쓰지 않는다.
 function noticeIntro(k){
  const nt=D.cases[k].notice;
  const pr=nt.principle||N.principle;
  if(D.cases[k].solo)return `<p class="line plain">${esc(pr)}</p>`;
  return [['moa',pr],...nt.lines].map((l,i,all)=>{
   if(i&&all[i-1][0]===l[0])return `<p class="line cont">${esc(l[1])}</p>`;
   return line(l,l[0]==='moa'?'moa':'');
  }).join('');
 }
 function noticeCard(k,card,posted,fresh){
  const on=S.state.notices[k].picked.includes(card.id);
  const fb=fresh?cardFeedback(k,card,posted):'';
  const label=`<span class="pick-box" aria-hidden="true">${on?'✓':''}</span><span>${esc(card.text)}</span>`;
  const attrs=`data-id="${card.id}" aria-pressed="${on}"${fb?` aria-describedby="fb-${card.id}"`:''}`;
  return `<div class="notice-item">${btn(label,'notice-pick',attrs,'notice-card')}${fb}</div>`;
 }
 function noticeBody(k){
  const nt=D.cases[k].notice;
  const ns=S.state.notices[k];
  const posted=postedOf(k);
  // fresh = 붙인 안내문과 지금 고른 카드가 같다(같을 때만 피드백을 보인다. 다르면 '다시 붙여 봐' 한 줄).
  const fresh=!!posted&&sameSet(posted,ns.picked);
  let b=`<div class="notice-intro">${noticeIntro(k)}</div><p class="task">${esc(N.task)}</p>`;
  b+=`<div class="notice-cards" role="group" aria-label="안내문에 붙일 카드">${nt.cards.map(card=>noticeCard(k,card,posted,fresh)).join('')}</div>`;
  // 아직 한 번도 안 붙였으면 '한 번 붙이면 다음으로' 안내를 버튼 옆에 둔다(휴대폰에서 줄 하나 아끼기).
  const need=E.noticeDone(S.state,k)?'':`<p class="hint">${esc(N.needPost)}</p>`;
  b+=`<div class="notice-post-row">${btn(esc(posted?N.repostLabel:N.post),'notice-post',ns.picked.length?'':'disabled')}${need}</div>`;
  if(ns.posted==='legacy')b+=`<p class="hint">${esc(N.legacy)}</p>`;
  if(fresh)b+=noticeVerdict(k,posted);
  else if(posted)b+=`<p class="hint repost" role="status">${esc(N.repost)}</p>`;
  return b;
 }
 // 왼쪽(휴대폰은 아래): 사건 무대와 붙인 안내문 종이
 function noticePaper(k){
  const nt=D.cases[k].notice;
  const posted=postedOf(k)||[];
  const cards=nt.cards.filter(x=>posted.includes(x.id));
  const list=cards.length?`<ul>${cards.map(x=>`<li>${esc(x.text)}</li>`).join('')}</ul>`:`<p class="paper-empty">${esc(N.empty)}</p>`;
  return `<div class="notice-paper${cards.length?'':' empty'}"><p class="doc-label">${esc(nt.paper)}</p>${list}</div>`;
 }
 function noticeStage(k){
  return caseStage(k,{result:true})+noticePaper(k);
 }
 // 보고서·수첩의 미리 알리기: 붙인 카드(부딪침·약속은 글자로 표시), 빠진 꼭 필요 카드, 판정 글자
 function noticeSummary(k){
  const ns=S.state.notices[k];
  const posted=postedOf(k);
  if(!posted)return `<p class="v-none">${ns.posted==='legacy'?'이전 저장에서 넘어와 아직 안 함':'아직 안 함'}</p>`;
  const nt=D.cases[k].notice;
  const r=E.noticeCheck(k,posted);
  const flag=id=>{
   const kind=E.noticeKind(k,id);
   return kind==='conflict'||kind==='promise'?` <span class="n-flag">(${esc(N.kinds[kind])})</span>`:'';
  };
  const put=nt.cards.filter(c=>posted.includes(c.id)).map(c=>`<li>${esc(c.text)}${flag(c.id)}</li>`);
  const missing=nt.cards.filter(c=>r.missing.includes(c.id)).map(c=>`<li class="n-missing">${esc(N.reportMissing)}: ${esc(c.text)}</li>`);
  const tag=r.ok?`<span class="v-tag v-ok">${esc(N.reportOk)}</span>`:`<span class="v-tag v-again">${esc(N.reportAgain)}</span>`;
  return `<div class="notice-sum"><ul class="notice-list">${put.concat(missing).join('')}</ul><p class="v-pick">판정: ${tag}</p></div>`;
 }

 actions['notice-pick']=b=>send({type:'notice-pick',id:b.dataset.id});
 actions['notice-post']=()=>send({type:'notice-post'});

 Object.assign(UI,{noticeBody,noticeStage,noticeSummary});
})();
