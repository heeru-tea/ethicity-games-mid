(function(root){
 'use strict';
 // 저장 version 3. 사건마다 일곱 단계: hook(궁금한 것) → check(직접 확인 + 판단 셋) → choose(선택) → result(결과) → follow(후속 조사)
 // → notice(만든 사람이라면: 미리 알리기) → reflect(생각 정리).
 // 마지막은 end(닫히지 않은 질문 + 마지막 서술) → report(나의 조사 보고서).
 // 장면 번호는 LAYOUT에서 계산한다. 사건 4·5를 붙일 때는 CASES·STEPS·checks·choices·answers만 늘리면 된다.
 const CASES=['photo','writing','face'];
 const SIX=['hook','check','choose','result','follow','reflect'],SEVEN=['hook','check','choose','result','follow','notice','reflect'];
 const STEPS={photo:SEVEN,writing:SEVEN,face:SEVEN};
 const LAYOUT=[{step:'intro',k:null}];for(const k of CASES)for(const step of STEPS[k])LAYOUT.push({step,k});LAYOUT.push({step:'end',k:null},{step:'report',k:null});
 const END=LAYOUT.findIndex(x=>x.step==='end'),REPORT=LAYOUT.length-1;
 // version 2 장면 배치(reflect·report 없음). 옛 저장의 장면 번호를 새 배치로 옮길 때 쓴다.
 const LAYOUT2=[{step:'intro',k:null}];for(const k of CASES)for(const step of SIX.slice(0,5))LAYOUT2.push({step,k});LAYOUT2.push({step:'end',k:null});
 const END2=LAYOUT2.length-1;
 const TEXT_MAX=4000; // 서술 칸은 강제 제한이 없다. 저장이 지나치게 커지지 않게만 막는다.
 const REPORTER=['name','number'];
 const checks={photo:['photo-original','photo-rule'],writing:['writing-guide','writing-history'],face:['face-alert','face-clerk','face-photo']};
 const choices={photo:['auto','all'],writing:['detector','review','draft'],face:['maintain','release','crowd']};
 const stamps=['confirmed','unknown','different'];
 // 사건마다 판단 셋. 세 칸이 사건마다 한 번씩 정답이 된다.
 const answers={photo:['confirmed','different','unknown'],writing:['unknown','confirmed','different'],face:['different','confirmed','unknown']};
 const followAnswers={photo:'different',writing:'confirmed',face:'unknown'};
 const followMarks={photo:{ids:['p1','p2','p3','p4','p5','p6'],values:['shown','cut']},writing:{ids:['run'],values:['done']},face:{ids:['r1','r2','r3','r4'],values:['open']}};
 const questions=['input','criteria','unknown'];
 // 미리 알리기 카드 종류: must(꼭 필요) · nice(있으면 좋음) · conflict(넣으면 다른 원칙과 부딪침) · promise(지킬 수 없는 약속). 문장과 화면 순서는 story.js.
 const noticeCards={
  photo:{must:['photo-auto','photo-choose'],nice:['photo-center'],conflict:['photo-formula'],promise:['photo-best']},
  writing:{must:['writing-human','writing-teacher'],nice:['writing-process'],conflict:['writing-patterns'],promise:['writing-perfect']},
  face:{must:['face-use','face-staff','face-report'],nice:['face-blur'],conflict:['face-wall'],promise:['face-never']}};
 const KINDS=['must','nice','conflict','promise'];
 function noticeIds(key){return KINDS.flatMap(t=>noticeCards[key][t]);}
 function noticeKind(key,id){return KINDS.find(t=>noticeCards[key][t].includes(id))||null;}
 // 다 맞음 = 꼭 필요 카드를 모두 넣고 상충·약속 카드는 하나도 없음. 있으면 좋음(extras)은 판정에 넣지 않는다.
 function noticeCheck(key,ids){const n=noticeCards[key],has=id=>ids.includes(id),missing=n.must.filter(id=>!has(id)),conflicts=n.conflict.filter(has),promises=n.promise.filter(has);
  return {ok:!missing.length&&!conflicts.length&&!promises.length,missing,conflicts,promises,extras:n.nice.filter(has)};}
 const AUTO=[900,50,600,400],ALL=[190,0,1200,800];
 const faces=[[300,210,220,180],[460,35,240,300],[695,350,165,150],[815,55,220,230],[1050,105,230,210]];
 // 후속 조사용 사진 6장: 같은 원본을 자동으로 다르게 자른 결과(새 그림 대신 기존 원본을 쓴다).
 const FOLLOW_CROPS=[AUTO,[300,0,900,600],[0,60,660,440],[636,24,900,600],[860,0,676,451],[240,0,1050,700]];
 const inside=([x,y,w,h],[fx,fy,fw,fh])=>fx>=x&&fy>=y&&fx+fw<=x+w&&fy+fh<=y+h;
 function cutFaces(rect){return faces.map((f,i)=>inside(rect,f)?null:i).filter(i=>i!==null);}
 const truth=FOLLOW_CROPS.map(r=>cutFaces(r).includes(2)?'cut':'shown');
 function caseKey(scene){return LAYOUT[scene]?.k||null;}
 function stepOf(scene){return LAYOUT[scene]?.step;}
 function sceneOf(key,step){return LAYOUT.findIndex(x=>x.k===key&&x.step===step);}
 const clone=v=>JSON.parse(JSON.stringify(v));
 const each=f=>Object.fromEntries(CASES.map(k=>[k,f(k)]));
 function initial(){return {version:3,scene:0,furthest:0,evidence:[],judgments:each(()=>[null,null,null]),cases:each(()=>({first:null,final:null})),follows:each(()=>({marks:{},judgment:null})),question:null,completed:false,
  reflections:each(()=>({q1:'',q2:''})),finalNote:'',reporter:{name:'',number:''},notices:each(()=>({picked:[],posted:null}))};}
 const text=v=>typeof v==='string'?v.slice(0,TEXT_MAX):'';
 function checked(s,key){return checks[key].every(id=>s.evidence.includes(id));}
 function judged(s,key){return checked(s,key)&&s.judgments[key].every(Boolean);}
 // 지금 판단할 칸: 비어 있거나 이전 저장에서 넘어와 하지 않은('legacy') 첫 칸.
 function currentJudgment(s,key){return s.judgments[key].findIndex(j=>j===null||j==='legacy');}
 function followReady(s,key){const m=followMarks[key],f=s.follows[key];return m.ids.every(id=>m.values.includes(f.marks[id]));}
 function followDone(s,key){const f=s.follows[key];return f.judgment==='legacy'||(!!f.judgment&&followReady(s,key));}
 // 안내문을 한 번 붙였거나(다 맞지 않아도) 이전 저장에서 넘어온 경우('legacy') 다음으로 갈 수 있다.
 function noticeDone(s,key){return s.notices[key].posted!==null;}
 function allFaces(rect){return faces.every(f=>inside(rect,f));}
 function canAdvance(s){
  const k=caseKey(s.scene),step=stepOf(s.scene);
  if(step==='intro'||step==='hook')return true;
  if(step==='check')return judged(s,k);
  if(step==='choose'||step==='result')return !!s.cases[k].final;
  if(step==='follow')return followDone(s,k);
  if(step==='notice')return noticeDone(s,k);
  if(step==='reflect')return true; // 서술은 비워도 된다(보고서에 '작성 안 함').
  if(step==='end')return s.completed; // 질문을 골라야 보고서로 간다.
  return false; // 보고서가 마지막 장면이다.
 }
 function reduce(state,action){
  const s=clone(state),k=caseKey(s.scene),step=stepOf(s.scene);
  if(action.type==='check'&&k&&step==='check'&&checks[k].includes(action.id)&&!s.evidence.includes(action.id))s.evidence.push(action.id);
  if(action.type==='judge'&&step==='check'&&checked(s,k)&&stamps.includes(action.stamp)){const i=currentJudgment(s,k);if(i>=0)s.judgments[k][i]=action.stamp;}
  if(action.type==='choose'&&step==='choose'&&judged(s,k)&&choices[k].includes(action.id)){
   const c=s.cases[k];if(!c.first)c.first=action.id;c.final=action.id;s.scene++;s.furthest=Math.max(s.furthest,s.scene);
  }
  if(action.type==='mark'&&step==='follow'){const m=followMarks[k],f=s.follows[k];if(m.ids.includes(action.id)&&m.values.includes(action.value)&&(f.judgment===null||f.judgment==='legacy'))f.marks[action.id]=action.value;}
  if(action.type==='follow-judge'&&step==='follow'&&followReady(s,k)&&stamps.includes(action.stamp)){const f=s.follows[k];if(f.judgment===null||f.judgment==='legacy')f.judgment=action.stamp;}
  if(action.type==='notice-pick'&&step==='notice'&&noticeKind(k,action.id)){const n=s.notices[k],i=n.picked.indexOf(action.id);if(i>=0)n.picked.splice(i,1);else n.picked.push(action.id);}
  if(action.type==='notice-post'&&step==='notice'&&s.notices[k].picked.length)s.notices[k].posted=s.notices[k].picked.slice();
  if(action.type==='reflect'&&step==='reflect'&&action.key===k&&['q1','q2'].includes(action.q)&&typeof action.text==='string')s.reflections[k][action.q]=text(action.text);
  if(action.type==='note'&&step==='end'&&s.completed&&typeof action.text==='string')s.finalNote=text(action.text);
  if(action.type==='reporter'&&step==='report'&&REPORTER.includes(action.field)&&typeof action.text==='string')s.reporter[action.field]=action.text.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,40);
  if(action.type==='next'&&s.scene<REPORT&&canAdvance(s)){s.scene++;s.furthest=Math.max(s.furthest,s.scene);}
  if(action.type==='revisit'&&Number.isInteger(action.scene)&&action.scene>=0&&action.scene<=s.furthest)s.scene=action.scene;
  if(action.type==='ask'&&step==='end'&&questions.includes(action.id)&&CASES.every(c=>s.cases[c].final)){if(!s.question)s.question=action.id;s.completed=true;}
  return s;
 }
 function outcome(s,key){const id=s.cases[key].final;return {id,restricted:key==='face'?id!=='release':undefined,excluded:key==='writing'?id==='detector':undefined,rect:key==='photo'?(id==='all'?ALL:AUTO):undefined};}
 // 진행 위치가 앞 단계 조건과 맞는지 검사한다(손상·조작된 저장 방지).
 function consistent(v){
  for(const key of CASES){const c=v.cases[key],f=v.follows[key];
   if(!!c.final!==!!c.first)return false;
   if(v.judgments[key].some(Boolean)&&!checked(v,key))return false;
   const i=v.judgments[key].findIndex(j=>j===null);if(i>=0&&v.judgments[key].slice(i).some(Boolean))return false;
   if(f.judgment&&f.judgment!=='legacy'&&!followReady(v,key))return false;
   if(v.furthest>sceneOf(key,'check')&&!judged(v,key))return false;
   if(v.furthest>=sceneOf(key,'result')&&!c.final)return false;
   if(v.furthest>sceneOf(key,'follow')&&!followDone(v,key))return false;
  }
  if(v.question&&!CASES.every(c=>v.cases[c].final))return false;
  if(v.completed!==!!v.question)return false;
  if(v.furthest>END&&!v.completed)return false;
  return true;
 }
 // ── 이전 저장(version 1) ────────────────────────────────────────────
 // version 1 revision 4: 장면 0 프롤로그, 1~4 사진, 5~8 글, 9~12 얼굴, 13 마지막. 사건마다 판단 하나.
 const STEPS4=['hook','check','choose','result'];
 const key4=n=>n>=1&&n<=12?CASES[Math.floor((n-1)/4)]:null,step4=n=>n===0?'intro':n===13?'end':STEPS4[(n-1)%4],scene4=(k,st)=>1+CASES.indexOf(k)*4+STEPS4.indexOf(st);
 function initial4(){return {revision:4,scene:0,furthest:0,evidence:[],judgments:{photo:null,writing:null,face:null},cases:each(()=>({first:null,final:null})),question:null,completed:false};}
 function consistent4(v){
  for(const key of CASES){const c=v.cases[key];
   if(!!c.final!==!!c.first)return false;
   if(v.judgments[key]&&!checked(v,key))return false;
   if(v.furthest>=scene4(key,'choose')&&!(checked(v,key)&&v.judgments[key]))return false;
   if(v.furthest>=scene4(key,'result')&&!c.final)return false;
  }
  if(v.question&&!CASES.every(c=>v.cases[c].final))return false;
  return v.completed===!!v.question;
 }
 // revision 3 이전(주장 판정 방식) → revision 4 모양.
 function migrate3(v){
  const s=initial4(),ev={P1:'photo-original',P2:'photo-rule',P3:'photo-rule',W2:'writing-guide',W3:'writing-history',F1:'face-alert',F3:'face-clerk',F2:'face-photo'};
  if(!Array.isArray(v.evidence)||!v.cases||typeof v.cases!=='object'||!Number.isInteger(v.scene)||v.scene<0||v.scene>13)return null;
  s.evidence=[...new Set(v.evidence.map(id=>ev[id]).filter(Boolean))];
  const map={photo:{manual:'all',auto:'auto'},writing:{detector:'detector',review:'review',draft:'draft'},face:{crowd:'crowd',release:'release',maintain:'maintain'}};
  const oldIdx=v.scene===0?-1:v.scene===13?3:CASES.indexOf(key4(v.scene));
  CASES.forEach((key,i)=>{const c=v.cases[key]||{},fin=map[key][c.final]||null,first=map[key][c.first]||null;
   if(fin){s.cases[key]={first:first||fin,final:fin};if(!first||c.legacyFirst)s.cases[key].legacyFirst=true;}
   if(fin&&!checked(s,key))s.evidence.push(...checks[key].filter(id=>!s.evidence.includes(id)));
   if(checked(s,key)&&(fin||i<oldIdx))s.judgments[key]='legacy';
  });
  const w=CASES.findIndex(key=>!s.cases[key].final),walk=w<0?3:w;
  if(oldIdx<0&&walk===0)s.scene=0;
  else if(walk>oldIdx)s.scene=oldIdx<0?0:scene4(CASES[oldIdx],'result');
  else if(walk===3)s.scene=13;
  else s.scene=scene4(CASES[walk],checked(s,CASES[walk])&&s.judgments[CASES[walk]]?'choose':'hook');
  s.furthest=s.scene;
  return consistent4(s)?s:null;
 }
 function restore4(v){
  if(!Number.isInteger(v.scene)||v.scene<0||v.scene>13||!Number.isInteger(v.furthest)||v.furthest<v.scene||v.furthest>13)return null;
  if(!Array.isArray(v.evidence)||v.evidence.some(id=>!CASES.some(k=>checks[k].includes(id))))return null;
  if(!v.judgments||typeof v.judgments!=='object'||!v.cases||typeof v.cases!=='object'||typeof v.completed!=='boolean')return null;
  if(v.question!==null&&v.question!==undefined&&!questions.includes(v.question))return null;
  for(const key of CASES){const c=v.cases[key],j=v.judgments[key];
   if(!c||typeof c!=='object'||['first','final'].some(p=>c[p]!==null&&!choices[key].includes(c[p])))return null;
   if(j!==null&&!stamps.includes(j)&&j!=='legacy')return null;
  }
  const s=initial4();Object.assign(s,{scene:v.scene,furthest:v.furthest,evidence:[...new Set(v.evidence)],question:v.question??null,completed:v.completed});
  for(const key of CASES){s.judgments[key]=v.judgments[key];s.cases[key]={first:v.cases[key].first,final:v.cases[key].final};if(v.cases[key].legacyFirst===true)s.cases[key].legacyFirst=true;}
  return consistent4(s)?s:null;
 }
 // revision 4 → version 2. 예전 판단 하나는 새 판단 1번과 같은 문장이다. 새로 생긴 판단 2·3번과 이미 지나간 후속 조사는
 // 'legacy'(이전 저장에서 넘어와 하지 않음)로 두어 이어하기를 막지 않는다. 그 사건을 다시 열면 해 볼 수 있다.
 function upgrade(r){
  const s=initial(),map=n=>n===0?0:n===13?END:sceneOf(key4(n),step4(n));
  // 이미 지나간 사건의 생각 정리(reflect)는 비워 둔 채로 지나간 것으로 본다(보고서에 '작성 안 함').
  s.scene=map(r.scene);s.furthest=map(r.furthest);s.evidence=r.evidence.slice();s.question=r.question;s.completed=r.completed;
  for(const key of CASES){const j=r.judgments[key];s.cases[key]=clone(r.cases[key]);
   if(j)s.judgments[key]=[j,'legacy','legacy'];
   if(s.furthest>sceneOf(key,'follow'))s.follows[key].judgment='legacy';
  }
  return consistent(s)?s:initial();
 }
 function restore(raw){
  try{const v=typeof raw==='string'?JSON.parse(raw):raw;
   if(!v||typeof v!=='object')return initial();
   if(v.version===1){const r=v.revision===4?restore4(v):migrate3(v);return r?upgrade(r):initial();}
   if(v.version!==2&&v.version!==3)return initial();
   // version 2 → 3: 장면 번호를 새 배치로 옮기고 서술은 빈 값으로 둔다.
   const last=v.version===2?END2:REPORT,map=n=>{if(v.version===3)return n;const x=LAYOUT2[n];return x.step==='intro'?0:x.step==='end'?END:sceneOf(x.k,x.step);};
   if(!Number.isInteger(v.scene)||v.scene<0||v.scene>last||!Number.isInteger(v.furthest)||v.furthest<v.scene||v.furthest>last)return initial();
   if(!Array.isArray(v.evidence)||v.evidence.some(id=>!CASES.some(k=>checks[k].includes(id))))return initial();
   if(!v.judgments||!v.cases||!v.follows||typeof v.completed!=='boolean')return initial();
   if(v.question!==null&&!questions.includes(v.question))return initial();
   const s=initial();s.scene=map(v.scene);s.furthest=map(v.furthest);s.evidence=[...new Set(v.evidence)];s.question=v.question;s.completed=v.completed;
   if(v.version===3){
    if(!v.reflections||typeof v.reflections!=='object'||!v.reporter||typeof v.reporter!=='object'||typeof v.finalNote!=='string')return initial();
    for(const key of CASES){const r=v.reflections[key];if(!r||typeof r.q1!=='string'||typeof r.q2!=='string')return initial();s.reflections[key]={q1:text(r.q1),q2:text(r.q2)};}
    if(REPORTER.some(f=>typeof v.reporter[f]!=='string'))return initial();
    s.finalNote=text(v.finalNote);for(const f of REPORTER)s.reporter[f]=v.reporter[f].slice(0,40);
   }
   for(const key of CASES){const c=v.cases[key],j=v.judgments[key],f=v.follows[key],m=followMarks[key];
    if(!c||['first','final'].some(p=>c[p]!==null&&!choices[key].includes(c[p])))return initial();
    if(!Array.isArray(j)||j.length!==3||j.some(x=>x!==null&&x!=='legacy'&&!stamps.includes(x)))return initial();
    if(!f||!f.marks||typeof f.marks!=='object'||Array.isArray(f.marks)||(f.judgment!==null&&f.judgment!=='legacy'&&!stamps.includes(f.judgment)))return initial();
    if(Object.entries(f.marks).some(([id,val])=>!m.ids.includes(id)||!m.values.includes(val)))return initial();
    s.cases[key]={first:c.first,final:c.final};if(c.legacyFirst===true)s.cases[key].legacyFirst=true;
    s.judgments[key]=j.slice();s.follows[key]={marks:{...f.marks},judgment:f.judgment};
    if(v.notices!==undefined){const n=v.notices?.[key],ok=a=>Array.isArray(a)&&a.every(id=>noticeKind(key,id))&&new Set(a).size===a.length;
     if(!n||!ok(n.picked)||!(n.posted===null||n.posted==='legacy'||ok(n.posted)&&n.posted.length))return initial();
     s.notices[key]={picked:n.picked.slice(),posted:Array.isArray(n.posted)?n.posted.slice():n.posted};}
   }
   return consistent(s)?s:initial();
  }catch{return initial();}
 }
 const api={initial,reduce,canAdvance,restore,caseKey,stepOf,sceneOf,checked,judged,currentJudgment,followReady,followDone,noticeIds,noticeKind,noticeCheck,noticeDone,outcome,allFaces,cutFaces,
  CASES,STEPS,LAYOUT,LAYOUT2,END,REPORT,checks,choices,stamps,answers,followAnswers,followMarks,questions,noticeCards,AUTO,ALL,faces,FOLLOW_CROPS,truth};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TransparencyEngine=api;
})(typeof window==='undefined'?globalThis:window);
