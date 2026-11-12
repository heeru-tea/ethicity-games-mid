// 미리 알리기: 학생이 그 AI를 내놓는 쪽이 되어 안내문 카드를 고른다. 피드백·보고서는 마지막으로 붙인 안내문(posted) 기준.
// 사건 4·5는 ‘고치기’(2026-11-12 요청 10·후속 6): 짧은 틀린 안내문(초안)을 칸마다 고친다 — 칸마다 문장 선택지(engine noticeSlots), 자유 서술·자동 채점 없음.
// 고치기인지는 저장의 notices[k].mode==='fix'(E.noticeFix). 이 기능 전(version 6·7)에 카드로 붙였거나 고르던 사건 4·5 안내문은 카드 화면 그대로이고,
// 수첩·보고서에는 ‘이전 방식으로 작성한 안내문’으로 보인다.
(function(){
 'use strict';
 const UI=window.TransparencyUI;
 const {E,D,S,esc,btn,send,actions,line,caseStage}=UI;
 const N=D.notice;
 const F=N.fix;
 const sameSet=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
 const postedOf=k=>Array.isArray(S.state.notices[k].posted)?S.state.notices[k].posted:null;
 const isFix=k=>E.noticeFix(S.state,k);

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
  if(isFix(k))return fixBody(k);
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

 // ── 고치기(사건 4·5) ──
 const slotsOf=k=>E.noticeSlots[k];
 const fixOf=k=>D.cases[k].notice.fix;
 const cardText=(k,id)=>D.cases[k].notice.cards.find(c=>c.id===id)?.text||fixOf(k).texts[id]||'';
 // 선택지 버튼 글: 그대로 두기 · 이 문장 빼기 · 비워 두기(칸마다 다른 말이 있으면 그 말) · 문장
 function optionText(k,slot,opt){
  if(opt==='keep')return F.keep;
  if(opt==='drop')return F.drop;
  if(opt==='blank')return fixOf(k).slots[slot.id].blank||F.blank;
  return cardText(k,opt);
 }
 const draftText=(k,slot)=>slot.draft?`“${cardText(k,slot.draft)}”`:F.empty;
 // 칸 하나의 한 줄: story say(그 선택지만의 말) → 카드 종류의 한 줄(keep·drop은 초안 카드의 넣음·뺌, 틀린 비워 두기는 ‘꼭 필요 · 빠짐’ 말). 혼자(사건 5)는 부딪침 이유만.
 function slotSay(k,slot,opt,good){
  const X=fixOf(k);
  if(D.cases[k].solo)return E.noticeKind(k,opt)==='conflict'?D.cases[k].notice.cards.find(c=>c.id===opt).clash||'':'';
  if(X.say[opt])return X.say[opt];
  if(opt==='keep')return N.fb[E.noticeKind(k,slot.draft)].in;
  if(opt==='drop')return N.fb[E.noticeKind(k,slot.draft)].out;
  if(opt==='blank')return good?'':N.fb.must.out;
  const kind=E.noticeKind(k,opt);
  if(kind==='conflict')return D.cases[k].notice.cards.find(c=>c.id===opt).clash||'';
  return kind?N.fb[kind].in:'';
 }
 function slotFeedback(k,slot,opt){
  const good=slot.ok.includes(opt);
  const say=slotSay(k,slot,opt,good);
  const label=fixOf(k).slots[slot.id].label;
  return `<p class="card-fb ${good?'fb-ok':'fb-again'}" id="fb-slot-${slot.id}"><span class="fb-tag">${good?'✓':'!'} ${esc(label)}${good?'':' · '+esc(F.slotAgain)}</span>${say?' '+esc(say):''}</p>`;
 }
 // 칸 하나: 칸 이름 + 초안 문장, 선택지 버튼(role=radio, aria-checked — 칸 묶음은 radiogroup). 묶음 이름 = ‘칸 1. AI가 하는 일, 초안: (비어 있음)’
 function fixSlot(k,slot,i,choice,posted,fresh){
  const label=fixOf(k).slots[slot.id].label;
  const draft=draftText(k,slot);
  const fb=fresh?slotFeedback(k,slot,posted[slot.id]):'';
  const opts=slot.options.map(opt=>{
   const on=choice[slot.id]===opt;
   // 칸마다 하나만 고른다 → 라디오(2026-11-12 사용자: 네모 체크 모양이면 여러 개 고를 수 있다고 오해) — 동그라미 + 고른 것엔 점, role=radio·aria-checked
   const text=`<span class="pick-dot" aria-hidden="true"></span><span>${esc(optionText(k,slot,opt))}</span>`;
   return btn(text,'notice-slot',`data-id="${slot.id}" data-value="${opt}" role="radio" aria-checked="${on}"${fb?` aria-describedby="fb-slot-${slot.id}"`:''}`,'notice-card slot-option');
  }).join('');
  const name=`칸 ${i+1}. ${label}, ${F.draft}: ${draft}`;
  return `<div class="fix-slot" role="radiogroup" aria-label="${esc(name)}"><p class="slot-head"><span class="slot-label">${esc(label)}</span> <span class="slot-draft">${esc(F.draft)}: ${esc(draft)}</span></p>`
   +`<div class="slot-options">${opts}</div>${fb}</div>`;
 }
 function fixVerdict(k,posted){
  const r=E.noticeFixCheck(k,posted);
  const names=r.again.map(id=>fixOf(k).slots[id].label).join(', ');
  if(D.cases[k].solo){
   const rest=r.ok?'':` · ${esc(F.again)}: ${esc(names)}.`;
   return `<div class="finding${r.ok?'':' again'} notice-verdict" role="status"><p><strong>${esc(r.ok?N.ok:N.again)}</strong>${rest}</p></div>`;
  }
  if(r.ok)return `<div class="finding notice-verdict" role="status"><p><strong>${esc(N.ok)}</strong> ${esc(N.okMore)}</p></div>`;
  return `<div class="finding again notice-verdict" role="status"><p class="again-head">${esc(N.again)}</p><p>${esc(F.again)}: ${esc(names)}. ${esc(F.againMore)}</p></div>`;
 }
 const sameChoice=(a,b)=>Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(x=>a[x]===b[x]);
 function fixBody(k){
  const ns=S.state.notices[k];
  const slots=slotsOf(k);
  const posted=ns.posted;
  const fresh=!!posted&&sameChoice(posted,ns.choice);
  let b=`<div class="notice-intro">${noticeIntro(k)}</div><p class="task">${esc(F.task)}</p>`;
  b+=`<div class="fix-slots" role="group" aria-label="${esc(F.group)}">${slots.map((x,i)=>fixSlot(k,x,i,ns.choice,posted,fresh)).join('')}</div>`;
  const left=slots.filter(x=>!(x.id in ns.choice)).length;
  // 아직 다 안 골랐으면 남은 칸 수, 다 골랐고 한 번도 안 붙였으면 ‘한 번 붙이면 다음으로’.
  const need=left?`<p class="hint">${esc(F.need.split('{left}').join(left))}</p>`:E.noticeDone(S.state,k)?'':`<p class="hint">${esc(N.needPost)}</p>`;
  b+=`<div class="notice-post-row">${btn(esc(posted?F.repostLabel:F.post),'notice-post',left?'disabled':'')}${need}</div>`;
  if(fresh)b+=fixVerdict(k,posted);
  else if(posted)b+=`<p class="hint repost" role="status">${esc(F.repost)}</p>`;
  return b;
 }
 // 고친 안내문(또는 초안)의 줄: 머리 줄(사건 5) + 칸마다 남는 문장
 function fixLines(k,choice){
  const X=fixOf(k);
  return (X.head?[X.head]:[]).concat(E.noticeFixLines(k,choice).map(id=>cardText(k,id)));
 }
 function draftLines(k){
  const X=fixOf(k);
  return (X.head?[X.head]:[]).concat(slotsOf(k).map(x=>x.draft?cardText(k,x.draft):`${X.slots[x.id].label}: ${F.empty}`));
 }
 // 화면 제목: 고치기면 그 사건의 fix.title(screens.js가 쓴다)
 function noticeTitle(k){const nt=D.cases[k].notice;return isFix(k)?nt.fix.title:nt.title;}

 // 왼쪽(휴대폰은 아래): 사건 무대와 붙인 안내문 종이
 function noticePaper(k){
  const nt=D.cases[k].notice;
  if(isFix(k)){
   // 고치기: 붙이기 전에는 처음 초안(휴대폰에서는 숨김 — 칸마다 초안이 적혀 있다), 붙인 뒤에는 고친 안내문
   const posted=S.state.notices[k].posted;
   const list=posted?fixLines(k,posted):draftLines(k);
   const head=posted?nt.fix.paper:`${F.draftLabel} · ${nt.fix.paper}`;
   return `<div class="notice-paper${posted?'':' draft'}"><p class="doc-label">${esc(head)}</p><ul>${list.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`;
  }
  const posted=postedOf(k)||[];
  const cards=nt.cards.filter(x=>posted.includes(x.id));
  const list=cards.length?`<ul>${cards.map(x=>`<li>${esc(x.text)}</li>`).join('')}</ul>`:`<p class="paper-empty">${esc(N.empty)}</p>`;
  return `<div class="notice-paper${cards.length?'':' empty'}"><p class="doc-label">${esc(nt.paper)}</p>${list}</div>`;
 }
 function noticeStage(k){
  return caseStage(k,{result:true})+noticePaper(k);
 }
 // 보고서·수첩의 미리 알리기: 붙인 카드(부딪침·약속은 글자로 표시), 빠진 꼭 필요 카드, 판정 글자
 // 고치기: 학생이 최종으로 만든 안내문 문장 + 다시 볼 칸 + 판정. 사건 4·5를 카드로 붙인 옛 저장은 ‘이전 방식으로 작성한 안내문’을 앞에 붙인다.
 function noticeSummary(k){
  const ns=S.state.notices[k];
  if(isFix(k)){
   if(!ns.posted)return '<p class="v-none">아직 안 함</p>';
   const r=E.noticeFixCheck(k,ns.posted);
   const tag=r.ok?`<span class="v-tag v-ok">${esc(N.reportOk)}</span>`:`<span class="v-tag v-again">${esc(N.reportAgain)}</span>`;
   const again=r.ok?'':`<li class="n-missing">${esc(F.again)}: ${esc(r.again.map(id=>fixOf(k).slots[id].label).join(', '))}</li>`;
   return `<div class="notice-sum"><p class="n-kind">${esc(F.made)}</p><ul class="notice-list">${fixLines(k,ns.posted).map(t=>`<li>${esc(t)}</li>`).join('')}${again}</ul><p class="v-pick">판정: ${tag}</p></div>`;
  }
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
  // 고치기 사건(4·5)을 이 기능 전에 카드로 붙인 저장
  const old=E.noticeSlots[k]?`<p class="n-kind">${esc(F.old)}</p>`:'';
  return `<div class="notice-sum">${old}<ul class="notice-list">${put.concat(missing).join('')}</ul><p class="v-pick">판정: ${tag}</p></div>`;
 }

 actions['notice-pick']=b=>send({type:'notice-pick',id:b.dataset.id});
 actions['notice-slot']=b=>send({type:'notice-slot',slot:b.dataset.id,opt:b.dataset.value});
 actions['notice-post']=()=>send({type:'notice-post'});

 Object.assign(UI,{noticeBody,noticeStage,noticeSummary,noticeTitle});
})();
