// 미리 알리기: 학생이 그 AI를 내놓는 쪽이 되어 안내문 카드를 고른다. 피드백·보고서는 마지막으로 붙인 안내문(posted) 기준.
// 사건 4·5는 '고치기'(2026-11-12 요청 10): 틀린 초안(engine noticeDrafts)이 미리 들어 있고, 뺄 문장은 빼고 빠진 문장은 넣는다.
// 화면은 같은 토글 카드(aria-pressed = 지금 안내문에 들어 있음)에 초안에 있던 카드 표시만 더한다. 고치기인지는 저장의 notices[k].fix(E.noticeFix) —
// 이 기능 전에 카드 고르기로 붙인 사건 4·5 안내문은 fix가 없어 예전 화면·보고서 그대로 보인다.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,esc,btn,send,actions,line,caseStage}=UI;
 const N=D.notice;
 const sameSet=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
 const postedOf=k=>Array.isArray(S.state.notices[k].posted)?S.state.notices[k].posted:null;
 const F=N.fix;
 const isFix=k=>E.noticeFix(S.state,k);
 const draftOf=k=>isFix(k)?E.noticeDraft(k):[];
 // 화면 제목: 고치기면 그 사건의 fix.title(screens.js가 쓴다)
 function noticeTitle(k){const nt=D.cases[k].notice;return isFix(k)&&nt.fix?nt.fix.title:nt.title;}

 // 카드 한 장의 피드백: 상태 글자(✓/!/○ + 종류 · 넣음/빠짐/뺐음)와 짧은 한 줄. 색만으로 구분하지 않는다.
 function cardFeedback(k,card,posted){
  const kind=E.noticeKind(k,card.id);
  const on=posted.includes(card.id);
  // good: 잘한 것(true) · 고칠 것(false) · 있으면 좋음 카드라 판정 없음(null)
  const good=kind==='must'?on:kind==='nice'?null:!on;
  const mark=good===null?(on?'✓':'○'):good?'✓':'!';
  let state_=on?'넣음':kind==='must'?'빠짐':kind==='nice'?'안 넣음':'뺐음';
  // 고치기: 초안과 견준 상태 — 초안에 있던 것을 남김 ‘넣음’, 초안에서 뺌 ‘뺐음’, 초안에 없던 것을 넣음 ‘새로 넣음’, 초안에도 없고 안 넣음 ‘빠짐’(꼭 필요)·‘안 넣음’
  if(isFix(k)){const d=draftOf(k).includes(card.id);state_=on?(d?'넣음':F.added):d?F.removed:kind==='must'?'빠짐':F.notIn;}
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
  // 고치기: ‘아직 빠진 꼭 필요 문장 2개’처럼 무엇이 남았는지 말한다.
  const P=isFix(k)?F.againParts:N.againParts,unit=isFix(k)?F.unit:'장';
  const parts=['missing','conflicts','promises'].filter(x=>r[x].length).map(x=>`${P[x]} ${r[x].length}${unit}`);
  if(D.cases[k].solo){
   const rest=r.ok?'':' · '+esc(parts.join(' · '))+'.';
   return `<div class="finding${r.ok?'':' again'} notice-verdict" role="status"><p><strong>${esc(r.ok?N.ok:N.again)}</strong>${rest}</p></div>`;
  }
  if(r.ok)return `<div class="finding notice-verdict" role="status"><p><strong>${esc(N.ok)}</strong> ${esc(N.okMore)}</p></div>`;
  return `<div class="finding again notice-verdict" role="status"><p class="again-head">${esc(N.again)}</p><p>${esc(parts.join(' · '))}. ${esc(isFix(k)?F.againMore:N.againMore)}</p></div>`;
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
  // 고치기: 초안에 있던 카드에 글자 표시(색만으로 구분하지 않는다). 이름은 aria-label ‘문장 (초안에 있던 문장)’ — 사건 4 표 줄과 같은 방식(보이는 글 그대로).
  const inDraft=draftOf(k).includes(card.id);
  const tag=inDraft?` <span class="draft-tag">${esc(F.inDraft)}</span>`:'';
  const label=`<span class="pick-box" aria-hidden="true">${on?'✓':''}</span><span>${esc(card.text)}${tag}</span>`;
  const name=inDraft?` aria-label="${esc(card.text+' ('+F.inDraft+')')}"`:'';
  const attrs=`data-id="${card.id}" aria-pressed="${on}"${name}${fb?` aria-describedby="fb-${card.id}"`:''}`;
  return `<div class="notice-item">${btn(label,'notice-pick',attrs,'notice-card')}${fb}</div>`;
 }
 function noticeBody(k){
  const nt=D.cases[k].notice;
  const ns=S.state.notices[k];
  const posted=postedOf(k);
  // fresh = 붙인 안내문과 지금 고른 카드가 같다(같을 때만 피드백을 보인다. 다르면 '다시 붙여 봐' 한 줄).
  const fresh=!!posted&&sameSet(posted,ns.picked);
  const fix=isFix(k);
  // same = 고치기에서 아직 초안 그대로(붙이기 버튼을 끄고 ‘초안과 같아…’를 보인다).
  const same=fix&&E.noticeSameDraft(k,ns.picked);
  let b=`<div class="notice-intro">${noticeIntro(k)}</div><p class="task">${esc(fix?F.task:N.task)}</p>`;
  b+=`<div class="notice-cards" role="group" aria-label="${esc(fix?F.group:'안내문에 붙일 카드')}">${nt.cards.map(card=>noticeCard(k,card,posted,fresh)).join('')}</div>`;
  // 아직 한 번도 안 붙였으면 '한 번 붙이면 다음으로' 안내를 버튼 옆에 둔다(휴대폰에서 줄 하나 아끼기). 초안 그대로면 그 자리에 ‘초안과 같아…’.
  const need=same?`<p class="hint same">${esc(F.same)}</p>`:E.noticeDone(S.state,k)?'':`<p class="hint">${esc(N.needPost)}</p>`;
  const postLabel=fix?(posted?F.repostLabel:F.post):(posted?N.repostLabel:N.post);
  b+=`<div class="notice-post-row">${btn(esc(postLabel),'notice-post',ns.picked.length&&!same?'':'disabled')}${need}</div>`;
  if(ns.posted==='legacy')b+=`<p class="hint">${esc(N.legacy)}</p>`;
  if(fresh)b+=noticeVerdict(k,posted);
  else if(posted&&!same)b+=`<p class="hint repost" role="status">${esc(fix?F.repost:N.repost)}</p>`;
  return b;
 }
 // 왼쪽(휴대폰은 아래): 사건 무대와 붙인 안내문 종이
 function noticePaper(k){
  const nt=D.cases[k].notice;
  const posted=postedOf(k);
  // 고치기에서 아직 안 붙였으면 처음 초안을 보인다(휴대폰에서는 카드에 같은 표시가 있어 숨긴다 — style.css .notice-paper.draft).
  if(!posted&&isFix(k)){const d=draftOf(k);
   return `<div class="notice-paper draft"><p class="doc-label">${esc(F.draftLabel)} · ${esc(nt.paper)}</p><ul>${nt.cards.filter(x=>d.includes(x.id)).map(x=>`<li>${esc(x.text)}</li>`).join('')}</ul></div>`;}
  const cards=nt.cards.filter(x=>(posted||[]).includes(x.id));
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
  // 고치기로 붙인 안내문만: 초안에서 뺀 문장·새로 넣은 문장 개수 한 줄. 카드 고르기로 붙인 옛 안내문에는 없다(초안을 본 적이 없으므로).
  const ch=isFix(k)?E.noticeChanges(k,posted):null;
  const changes=ch?`<p class="n-changes">${esc(F.changes.split('{removed}').join(ch.removed.length).split('{added}').join(ch.added.length))}</p>`:'';
  return `<div class="notice-sum">${changes}<ul class="notice-list">${put.concat(missing).join('')}</ul><p class="v-pick">판정: ${tag}</p></div>`;
 }

 actions['notice-pick']=b=>send({type:'notice-pick',id:b.dataset.id});
 actions['notice-post']=()=>send({type:'notice-post'});

 Object.assign(UI,{noticeBody,noticeStage,noticeSummary,noticeTitle});
})();
