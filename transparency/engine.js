(function(root){
 'use strict';
 // 저장 version 8(2026-11-12 후속 요청: 사건 4 판단 3 다시 교체·마을별 결과에 참여 점수, 후속 조사 두 줄 — version 6·7 저장은 restore가 옮긴다). version 7(2026-11-12 수정 요청: 사건 4 자료 넷(버스 쪽지)·판단 3 교체, 사건 5 후속 조사 판단 교체 — version 6 저장은 restore가 옮긴다). 사건 다섯 개, 사건마다 일곱 단계: hook(궁금한 것) → check(직접 확인 + 판단 셋) → choose(선택) → result(결과) → follow(후속 조사)
 // → notice(만든 사람이라면: 미리 알리기) → reflect(생각 정리).
 // 마지막은 end(마무리 + 마지막 서술) → report(나의 조사 보고서). 질문 고르기(구청에 묻기)는 사건 4(camp)의 궁금한 것 화면에서 한다.
 // 장면 번호는 LAYOUT에서 계산한다: 0 프롤로그, 1~7 사진, 8~14 글, 15~21 얼굴, 22~28 구청 캠프, 29~35 은하수 그림, 36 마지막, 37 보고서.
 const CASES=['photo','writing','face','camp','share'];
 const OLD3=CASES.slice(0,3); // 저장 version 1~4에 있던 사건
 const SIX=['hook','check','choose','result','follow','reflect'],SEVEN=['hook','check','choose','result','follow','notice','reflect'];
 const STEPS=Object.fromEntries(CASES.map(k=>[k,SEVEN]));
 const LAYOUT=[{step:'intro',k:null}];for(const k of CASES)for(const step of STEPS[k])LAYOUT.push({step,k});LAYOUT.push({step:'end',k:null},{step:'report',k:null});
 const END=LAYOUT.findIndex(x=>x.step==='end'),REPORT=LAYOUT.length-1;
 // 옛 저장(version 1~4)의 마지막·보고서 자리는 새로 생긴 사건 4 첫 화면이 된다(다 마친 저장도 새 사건부터 이어 한다).
 const RESUME=LAYOUT.findIndex(x=>x.k==='camp'&&x.step==='hook');
 // version 2 장면 배치(reflect·report 없음). 옛 저장의 장면 번호를 새 배치로 옮길 때 쓴다.
 const LAYOUT2=[{step:'intro',k:null}];for(const k of OLD3)for(const step of SIX.slice(0,5))LAYOUT2.push({step,k});LAYOUT2.push({step:'end',k:null});
 const END2=LAYOUT2.length-1;
 // version 3 장면 배치(notice 없음). 0 프롤로그, 1~6 사진, 7~12 글, 13~18 얼굴, 19 마지막, 20 보고서.
 const LAYOUT3=[{step:'intro',k:null}];for(const k of OLD3)for(const step of SIX)LAYOUT3.push({step,k});LAYOUT3.push({step:'end',k:null},{step:'report',k:null});
 // version 4 장면 배치(사건 1~3만). 0 프롤로그, 1~21 사건(지금과 같은 번호), 22 마지막, 23 보고서.
 const LAYOUT4=[{step:'intro',k:null}];for(const k of OLD3)for(const step of SEVEN)LAYOUT4.push({step,k});LAYOUT4.push({step:'end',k:null},{step:'report',k:null});
 // 서술 칸 상한. 단위는 UTF-16 코드 단위 = 입력칸 maxlength·글자 수 표시와 같은 단위(ui/textbox.js). 화면에 남는 글과 저장되는 글이 같아야 한다.
 const TEXT_MAX=4000;
 const REPORTER=['name','number'];
 const checks={photo:['photo-original','photo-rule'],writing:['writing-guide','writing-history'],face:['face-alert','face-clerk','face-photo'],
  camp:['camp-page','camp-results','camp-criteria','camp-bus'],share:['share-log','share-photo','share-compare']};
 // version 5 저장에 있던 옛 사건 4·5(도서관·밤하늘) 자료. 옛 저장 검사에만 쓰고 버린다.
 const OLD5_CHECKS=['library-guide','library-loans','library-scores','recommend-reason','recommend-meeting','recommend-bus'];
 const choices={photo:['auto','all'],writing:['detector','review','draft'],face:['maintain','release','crowd'],camp:['loud','accurate','quiet'],share:['keep','tag','explain']};
 const stamps=['confirmed','unknown','different'];
 // 사건마다 판단 셋. 세 칸이 사건마다 한 번씩 정답이 된다.
 const answers={photo:['confirmed','different','unknown'],writing:['unknown','confirmed','different'],face:['different','confirmed','unknown'],camp:['unknown','different','confirmed'],share:['different','confirmed','unknown']};
 const followAnswers={photo:'different',writing:'confirmed',face:'unknown',camp:'different',share:'confirmed'};
 // 후속 조사 표시: 구청 캠프는 새 공개 페이지에서 달라진 두 줄(담당 부서·이의 신청)을 모두 찾는다(2026-11-12 후속 요청 4 — 그전에는 하나만, 칸 이름 changed), 은하수 그림은 세 곳(DM·냥스타·게시판)을 모두 연다.
 const followMarks={photo:{ids:['p1','p2','p3','p4','p5','p6'],values:['shown','cut']},writing:{ids:['run'],values:['done']},face:{ids:['r1','r2','r3','r4'],values:['open']},
  camp:{ids:['office','appeal'],values:['found']},share:{ids:['dm','post','board'],values:['open']}};
 // 사건 4 구청에 묻기. 옛 저장(version 1~5)의 질문(옛 사건 5 앱에 묻기)은 OLD_QUESTIONS로 검사만 하고 버린다.
 const questions=['purpose','criteria','who','appeal'],OLD_QUESTIONS=['input','criteria','unknown','notice'];
 // 미리 알리기 카드 종류: must(꼭 필요) · nice(있으면 좋음) · conflict(넣으면 다른 원칙과 부딪침) · promise(지킬 수 없는 약속). 문장과 화면 순서는 story.js.
 const noticeCards={
  photo:{must:['photo-auto','photo-choose'],nice:['photo-center'],conflict:['photo-formula'],promise:['photo-best']},
  writing:{must:['writing-human','writing-teacher'],nice:['writing-process'],conflict:['writing-patterns'],promise:['writing-perfect']},
  face:{must:['face-use','face-staff','face-report'],nice:['face-blur'],conflict:['face-wall'],promise:['face-never']},
  camp:{must:['camp-role','camp-office','camp-appeal'],nice:['camp-items'],conflict:['camp-everyone'],promise:['camp-never']},
  share:{must:['share-ai','share-real'],nice:['share-photo','share-spell'],conflict:['share-settings'],promise:['share-same']}};
 const KINDS=['must','nice','conflict','promise'];
 // 미리 알리기 '고치기'(2026-11-12 수정 요청 10 → 후속 요청 6, 사건 4·5만): 카드 고르기 대신 짧은 틀린 안내문(초안)을 칸마다 고친다.
 // 칸마다 문장 선택지(자유 서술·자동 채점 없음). draft = 초안에 든 카드(null이면 빈 칸), ok = 맞는 선택지. 칸·선택지 순서 = 화면 순서.
 // 선택지 id: 'keep'(초안 문장 그대로) · 'drop'(이 문장 빼기) · 'blank'(비워 두기·덧붙이지 않기) · 카드 id(noticeCards) · 고치기에만 있는 문장(camp-auto, share-tag — 글은 story.js).
 // 저장: notices[k]={mode:'fix',choice:{칸:선택지},posted:{칸:선택지}|null}. 모든 칸을 골라야 붙일 수 있고, 한 번 붙이면(틀려도) 다음으로 간다.
 // mode가 없으면 예전 카드 고르기({picked,posted}) — 이 기능 전(version 6·7)에 카드로 붙였거나 고르던 사건 4·5 안내문은 그대로 둔다(‘이전 방식으로 작성한 안내문’).
 const noticeSlots={
  camp:[{id:'role',draft:null,options:['blank','camp-auto','camp-role'],ok:['camp-role']},
   {id:'office',draft:null,options:['blank','camp-office'],ok:['camp-office']},
   {id:'appeal',draft:null,options:['blank','camp-appeal','camp-everyone'],ok:['camp-appeal']},
   {id:'claim',draft:'camp-never',options:['keep','drop','camp-items'],ok:['drop','camp-items']}],
  share:[{id:'ai',draft:null,options:['blank','share-spell','share-tag','share-ai'],ok:['share-tag','share-ai']},
   {id:'sky',draft:'share-same',options:['keep','share-real','drop'],ok:['share-real']},
   {id:'more',draft:null,options:['blank','share-settings','share-photo'],ok:['blank','share-photo']}]};
 function noticeFix(s,key){return s.notices[key].mode==='fix';}
 const slotOf=(key,id)=>(noticeSlots[key]||[]).find(x=>x.id===id);
 function validChoice(key,c,full){if(!c||typeof c!=='object'||Array.isArray(c))return false;const e=Object.entries(c);
  return e.every(([id,o])=>slotOf(key,id)&&slotOf(key,id).options.includes(o))&&(!full||noticeSlots[key].every(x=>x.id in c));}
 // 모든 칸을 골랐는가(붙이기 조건)
 function noticeFixReady(key,c){return noticeSlots[key].every(x=>x.id in c);}
 // 판정: 다 맞음 = 모든 칸이 맞는 선택지. again = 다시 볼 칸(화면 순서)
 function noticeFixCheck(key,c){const again=noticeSlots[key].filter(x=>!x.ok.includes(c[x.id])).map(x=>x.id);return {ok:!again.length,again};}
 // 고친 안내문에 남는 문장(칸 순서): keep = 초안 문장, drop·blank = 없음, 그 밖 = 고른 문장
 function noticeFixLines(key,c){return noticeSlots[key].map(x=>{const o=c[x.id];return o==='keep'?x.draft:o==='drop'||o==='blank'||!o?null:o;}).filter(Boolean);}
 // 고치기 사건의 미리 알리기에 처음 섰을 때(카드로 고르거나 붙인 것이 없으면) 초안을 연다. 카드로 고르던·붙인 안내문은 건드리지 않는다.
 function seedFix(s,key){const n=s.notices[key];
  if(noticeSlots[key]&&n.mode!=='fix'&&!n.picked.length&&n.posted===null&&s.furthest>=sceneOf(key,'notice'))s.notices[key]={mode:'fix',choice:{},posted:null};}
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
 // 사진을 글로 설명할 때 쓰는 기하(문장은 ui/case-photo.js가 만든다). PHOTO = 축제 원본 크기.
 // faceIn: 얼굴 i가 틀 안에서 온전히 보이면 in, 틀 가장자리에 걸리면 part(edges = 얼굴을 지나는 가장자리), 안 보이면 out.
 const PHOTO=[1536,1024];
 function faceIn([x,y,w,h],i){
  const [fx,fy,fw,fh]=faces[i];
  if(fx>=x+w||fx+fw<=x||fy>=y+h||fy+fh<=y)return {state:'out',edges:[]};
  const edges=[];
  if(fx<x)edges.push('left');
  if(fx+fw>x+w)edges.push('right');
  if(fy<y)edges.push('top');
  if(fy+fh>y+h)edges.push('bottom');
  return {state:edges.length?'part':'in',edges};
 }
 // place: 네모(얼굴·틀)의 가운데가 원본을 3×3으로 나눈 어느 칸에 있는지. [가로 0 왼쪽·1 가운데·2 오른쪽, 세로 0 위·1 가운데·2 아래]
 function place([x,y,w,h]){
  const third=(v,total)=>Math.min(2,Math.floor(v/(total/3)));
  return [third(x+w/2,PHOTO[0]),third(y+h/2,PHOTO[1])];
 }
 function caseKey(scene){return LAYOUT[scene]?.k||null;}
 function stepOf(scene){return LAYOUT[scene]?.step;}
 function sceneOf(key,step){return LAYOUT.findIndex(x=>x.k===key&&x.step===step);}
 const clone=v=>JSON.parse(JSON.stringify(v));
 const each=f=>Object.fromEntries(CASES.map(k=>[k,f(k)])),eachOld=f=>Object.fromEntries(OLD3.map(k=>[k,f(k)]));
 // asked = 사건 4 궁금한 것에서 물어본 질문(누른 순서). completed = 마지막 장면에 들어갔음.
 function initial(){return {version:8,scene:0,furthest:0,evidence:[],judgments:each(()=>[null,null,null]),cases:each(()=>({first:null,final:null})),follows:each(()=>({marks:{},judgment:null})),asked:[],completed:false,
  reflections:each(()=>({q1:'',q2:''})),finalNote:'',reporter:{name:'',number:''},notices:each(()=>({picked:[],posted:null}))};}
 // 처음부터 다시 하기: 진행은 모두 지운다. 이름·학번은 기본으로 함께 지우고(공용 PC), keepReporter일 때만 남긴다.
 function restart(s,{keepReporter=false}={}){const n=initial();if(keepReporter&&s&&s.reporter)for(const f of REPORTER)n.reporter[f]=typeof s.reporter[f]==='string'?s.reporter[f]:'';return n;}
 // 상한에서 자른다. 이모지처럼 두 단위짜리 글자가 상한에 걸려 반쪽만 남게 되면 그 글자는 통째로 뺀다(끝에 남은 앞 반쪽도).
 function clipText(v){
  if(typeof v!=='string')return '';
  let n=Math.min(v.length,TEXT_MAX);
  if(n===TEXT_MAX){const c=v.charCodeAt(n-1);if(c>=0xD800&&c<=0xDBFF)n--;}
  return v.slice(0,n);
 }
 const text=clipText;
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
  if(step==='intro')return true;
  if(step==='hook')return k!=='camp'||s.asked.length>0; // 사건 4는 질문을 하나 이상 해야 직접 확인으로 간다
  if(step==='check')return judged(s,k);
  if(step==='choose'||step==='result')return !!s.cases[k].final;
  if(step==='follow')return followDone(s,k);
  if(step==='notice')return noticeDone(s,k);
  if(step==='reflect')return true; // 서술은 비워도 된다(보고서에 '작성 안 함').
  if(step==='end')return s.completed; // 마지막 장면에 들어오면 완료.
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
  if(action.type==='notice-slot'&&step==='notice'&&noticeFix(s,k)&&slotOf(k,action.slot)&&slotOf(k,action.slot).options.includes(action.opt))s.notices[k].choice[action.slot]=action.opt;
  if(action.type==='notice-pick'&&step==='notice'&&!noticeFix(s,k)&&noticeKind(k,action.id)){const n=s.notices[k],i=n.picked.indexOf(action.id);if(i>=0)n.picked.splice(i,1);else n.picked.push(action.id);}
  // 고치기: 모든 칸을 골라야 붙인다(틀린 채 붙이고 넘어가는 것은 카드 고르기처럼 된다). 카드 고르기: 한 장 이상.
  if(action.type==='notice-post'&&step==='notice'){const n=s.notices[k];if(noticeFix(s,k)){if(noticeFixReady(k,n.choice))n.posted={...n.choice};}else if(n.picked.length)n.posted=n.picked.slice();}
  if(action.type==='reflect'&&step==='reflect'&&action.key===k&&['q1','q2'].includes(action.q)&&typeof action.text==='string')s.reflections[k][action.q]=text(action.text);
  if(action.type==='note'&&step==='end'&&s.completed&&typeof action.text==='string')s.finalNote=text(action.text);
  if(action.type==='reporter'&&step==='report'&&REPORTER.includes(action.field)&&typeof action.text==='string')s.reporter[action.field]=action.text.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,40);
  if(action.type==='next'&&s.scene<REPORT&&canAdvance(s)){s.scene++;s.furthest=Math.max(s.furthest,s.scene);if(s.scene===END)s.completed=true;if(stepOf(s.scene)==='notice')seedFix(s,caseKey(s.scene));}
  if(action.type==='revisit'&&Number.isInteger(action.scene)&&action.scene>=0&&action.scene<=s.furthest)s.scene=action.scene;
  if(action.type==='ask'&&step==='hook'&&k==='camp'&&questions.includes(action.id)&&!s.asked.includes(action.id))s.asked.push(action.id);
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
   const n=v.notices[key];if(v.furthest>sceneOf(key,'notice')&&!noticeDone(v,key))return false;
   if(v.furthest<sceneOf(key,'notice')&&(n.mode==='fix'||n.picked.length||n.posted!==null))return false;
  }
  if(v.furthest>sceneOf('camp','hook')&&!v.asked.length)return false;
  if(v.completed!==(v.furthest>=END))return false;
  return true;
 }
 // ── 이전 저장(version 1) ────────────────────────────────────────────
 // version 1 revision 4: 장면 0 프롤로그, 1~4 사진, 5~8 글, 9~12 얼굴, 13 마지막. 사건마다 판단 하나.
 const STEPS4=['hook','check','choose','result'];
 const key4=n=>n>=1&&n<=12?OLD3[Math.floor((n-1)/4)]:null,step4=n=>n===0?'intro':n===13?'end':STEPS4[(n-1)%4],scene4=(k,st)=>1+OLD3.indexOf(k)*4+STEPS4.indexOf(st);
 function initial4(){return {revision:4,scene:0,furthest:0,evidence:[],judgments:{photo:null,writing:null,face:null},cases:eachOld(()=>({first:null,final:null})),question:null,completed:false};}
 function consistent4(v){
  for(const key of OLD3){const c=v.cases[key];
   if(!!c.final!==!!c.first)return false;
   if(v.judgments[key]&&!checked(v,key))return false;
   if(v.furthest>=scene4(key,'choose')&&!(checked(v,key)&&v.judgments[key]))return false;
   if(v.furthest>=scene4(key,'result')&&!c.final)return false;
  }
  if(v.question&&!OLD3.every(c=>v.cases[c].final))return false;
  return v.completed===!!v.question;
 }
 // revision 3 이전(주장 판정 방식) → revision 4 모양.
 function migrate3(v){
  const s=initial4(),ev={P1:'photo-original',P2:'photo-rule',P3:'photo-rule',W2:'writing-guide',W3:'writing-history',F1:'face-alert',F3:'face-clerk',F2:'face-photo'};
  if(!Array.isArray(v.evidence)||!v.cases||typeof v.cases!=='object'||!Number.isInteger(v.scene)||v.scene<0||v.scene>13)return null;
  s.evidence=[...new Set(v.evidence.map(id=>ev[id]).filter(Boolean))];
  const map={photo:{manual:'all',auto:'auto'},writing:{detector:'detector',review:'review',draft:'draft'},face:{crowd:'crowd',release:'release',maintain:'maintain'}};
  const oldIdx=v.scene===0?-1:v.scene===13?3:OLD3.indexOf(key4(v.scene));
  OLD3.forEach((key,i)=>{const c=v.cases[key]||{},fin=map[key][c.final]||null,first=map[key][c.first]||null;
   if(fin){s.cases[key]={first:first||fin,final:fin};if(!first||c.legacyFirst)s.cases[key].legacyFirst=true;}
   if(fin&&!checked(s,key))s.evidence.push(...checks[key].filter(id=>!s.evidence.includes(id)));
   if(checked(s,key)&&(fin||i<oldIdx))s.judgments[key]='legacy';
  });
  const w=OLD3.findIndex(key=>!s.cases[key].final),walk=w<0?3:w;
  if(oldIdx<0&&walk===0)s.scene=0;
  else if(walk>oldIdx)s.scene=oldIdx<0?0:scene4(OLD3[oldIdx],'result');
  else if(walk===3)s.scene=13;
  else s.scene=scene4(OLD3[walk],checked(s,OLD3[walk])&&s.judgments[OLD3[walk]]?'choose':'hook');
  s.furthest=s.scene;
  return consistent4(s)?s:null;
 }
 function restore4(v){
  if(!Number.isInteger(v.scene)||v.scene<0||v.scene>13||!Number.isInteger(v.furthest)||v.furthest<v.scene||v.furthest>13)return null;
  if(!Array.isArray(v.evidence)||v.evidence.some(id=>!OLD3.some(k=>checks[k].includes(id))))return null;
  if(!v.judgments||typeof v.judgments!=='object'||!v.cases||typeof v.cases!=='object'||typeof v.completed!=='boolean')return null;
  if(v.question!==null&&v.question!==undefined&&!OLD_QUESTIONS.includes(v.question))return null;
  for(const key of OLD3){const c=v.cases[key],j=v.judgments[key];
   if(!c||typeof c!=='object'||['first','final'].some(p=>c[p]!==null&&!choices[key].includes(c[p])))return null;
   if(j!==null&&!stamps.includes(j)&&j!=='legacy')return null;
  }
  const s=initial4();Object.assign(s,{scene:v.scene,furthest:v.furthest,evidence:[...new Set(v.evidence)],question:v.question??null,completed:v.completed});
  for(const key of OLD3){s.judgments[key]=v.judgments[key];s.cases[key]={first:v.cases[key].first,final:v.cases[key].final};if(v.cases[key].legacyFirst===true)s.cases[key].legacyFirst=true;}
  return consistent4(s)?s:null;
 }
 // revision 4 → 지금 version. 예전 판단 하나는 새 판단 1번과 같은 문장이다. 새로 생긴 판단 2·3번과 이미 지나간 후속 조사는
 // 'legacy'(이전 저장에서 넘어와 하지 않음)로 두어 이어하기를 막지 않는다. 그 사건을 다시 열면 해 볼 수 있다.
 function upgrade(r){
  const s=initial(),map=n=>n===0?0:n===13?RESUME:sceneOf(key4(n),step4(n));
  // 이미 지나간 사건의 생각 정리(reflect)는 비워 둔 채로 지나간 것으로 본다(보고서에 '작성 안 함').
  // 옛 마지막 장면은 사건 4 첫 화면으로 옮기므로 완료가 아니다. 그때 고른 질문은 지금 사건에 없어서 버린다.
  s.scene=map(r.scene);s.furthest=map(r.furthest);s.evidence=r.evidence.slice();
  for(const key of OLD3){const j=r.judgments[key];s.cases[key]=clone(r.cases[key]);
   if(j)s.judgments[key]=[j,'legacy','legacy'];
   if(s.furthest>sceneOf(key,'follow'))s.follows[key].judgment='legacy';
  }
  legacyNotices(s);
  return consistent(s)?s:initial();
 }
 // 옛 저장에서 이미 미리 알리기 자리를 지난 사건은 '아직 안 함'(legacy)으로 둔다. 넘어가기는 막지 않고, 수첩에서 다시 열 수 있다.
 function legacyNotices(s){for(const key of CASES)if(s.furthest>sceneOf(key,'notice')&&s.notices[key].posted===null)s.notices[key].posted='legacy';}
 // version 6(2026-11-10~12) → 7. 장면 번호·칸은 그대로이고 문장이 바뀐 두 판단만 손본다.
 //  · 사건 4: 버스 쪽지가 기준표 카드 아래 한 줄에서 따로 여는 자료(camp-bus)가 됐다. 기준표를 다 연 저장은 그 쪽지를 이미 본 것이므로 확인한 자료에 넣는다.
 //    판단 3은 다른 문장(참여 횟수 비중 → 버스가 적은 마을에 불리했을 수 있다)이 됐으므로 옛 답은 'legacy'(이전 저장에서 넘어와 아직 안 함)로 둔다. 판단 1·2는 문장이 같아 그대로.
 //  · 사건 5 후속 조사 판단도 다른 문장(해도 된다 → 사실 문장, 정답도 다름)이라 옛 답은 'legacy'. 연 곳(marks)은 그대로.
 //  legacy는 이어하기를 막지 않고, 수첩에서 다시 열어 해 볼 수 있다.
 function from6(v){
  const w=clone(v);w.version=7;
  if(Array.isArray(w.evidence)&&w.evidence.includes('camp-criteria')&&!w.evidence.includes('camp-bus'))w.evidence.push('camp-bus');
  const j=w.judgments&&w.judgments.camp;if(Array.isArray(j)&&stamps.includes(j[2]))j[2]='legacy';
  const f=w.follows&&w.follows.share;if(f&&typeof f==='object'&&stamps.includes(f.judgment))f.judgment='legacy';
  return w;
 }
 // version 7(2026-11-12 오전~저녁) → 8. 장면 번호·칸은 그대로이고 바뀐 두 곳만 손본다.
 //  · 사건 4 판단 3이 또 다른 문장(버스 → 참여 횟수와 그 항목 점수, 근거는 마을별 결과의 새 칸)이 됐다. 옛 답은 'legacy'(이어하기는 막지 않고, 수첩에서 다시 해 볼 수 있다).
 //  · 사건 4 후속 조사는 달라진 줄 하나(marks.changed) → 두 줄(marks.office·appeal). 판단까지 끝난(또는 legacy) 저장은 두 줄 모두 찾은 것으로 두어 진행을 되돌리지 않는다.
 //    줄만 찾고 판단은 안 한 저장은 어느 줄을 찾았는지 알 수 없어 표시를 비운다(두 줄을 다시 찾으면 판단이 나온다).
 //  · 사건 4·5 미리 알리기: 카드로 붙였거나 고르던 안내문은 그대로(‘이전 방식으로 작성한 안내문’). 칸 모양이 같아 손대지 않는다.
 function from7(v){
  const w=clone(v);w.version=8;
  const j=w.judgments&&w.judgments.camp;if(Array.isArray(j)&&stamps.includes(j[2]))j[2]='legacy';
  const f=w.follows&&w.follows.camp;
  if(f&&f.marks&&typeof f.marks==='object'&&'changed' in f.marks){const had=f.marks.changed==='found';delete f.marks.changed;if(had&&f.judgment!==null&&f.judgment!==undefined){f.marks.office='found';f.marks.appeal='found';}}
  return w;
 }
 function restore(raw){
  try{let v=typeof raw==='string'?JSON.parse(raw):raw;
   if(!v||typeof v!=='object')return initial();
   if(v.version===6)v=from6(v);
   if(v.version===7)v=from7(v);
   if(v.version===1){const r=v.revision===4?restore4(v):migrate3(v);return r?upgrade(r):initial();}
   if(![2,3,4,5,8].includes(v.version))return initial();
   // version 2·3·4 → 5: 장면 번호를 새 배치로 옮긴다(옛 마지막·보고서는 사건 4 첫 화면, 완료 아님). version 2는 서술을, 2·3은 안내문을 빈 값(지난 사건은 legacy)으로 둔다.
   // version 5(옛 사건 4·5 = 도서관·밤하늘) → 6: 사건 1~3은 그대로, 장면 22 이상(옛 사건 4·5·마지막·보고서)은 새 사건 4 첫 화면(완료 아님). 옛 사건 4·5 칸·자료는 버린다.
   // 옛 저장의 질문(question·asked)은 지금 사건에 없는 질문이라 검사만 하고 버린다. 새 사건 4·5 칸은 빈 값.
   const OLD={2:LAYOUT2,3:LAYOUT3,4:LAYOUT4,5:LAYOUT}[v.version],KEYS=OLD?OLD3:CASES,last=OLD?OLD.length-1:REPORT,map=n=>{if(!OLD)return n;if(OLD===LAYOUT)return n>=RESUME?RESUME:n;const x=OLD[n];return x.step==='intro'?0:x.step==='end'||x.step==='report'?RESUME:sceneOf(x.k,x.step);};
   if(!Number.isInteger(v.scene)||v.scene<0||v.scene>last||!Number.isInteger(v.furthest)||v.furthest<v.scene||v.furthest>last)return initial();
   const ownId=id=>KEYS.some(k=>checks[k].includes(id));
   if(!Array.isArray(v.evidence)||v.evidence.some(id=>!ownId(id)&&!(v.version===5&&OLD5_CHECKS.includes(id))))return initial();
   if(!v.judgments||!v.cases||!v.follows||typeof v.completed!=='boolean')return initial();
   const s=initial();s.scene=map(v.scene);s.furthest=map(v.furthest);s.evidence=[...new Set(v.evidence.filter(ownId))];
   if(v.version===5){if(!Array.isArray(v.asked)||v.asked.some(q=>!OLD_QUESTIONS.includes(q)))return initial();}
   else if(OLD){if(v.question!==null&&!OLD_QUESTIONS.includes(v.question))return initial();}
   else{if(!Array.isArray(v.asked)||v.asked.some(q=>!questions.includes(q))||new Set(v.asked).size!==v.asked.length)return initial();s.asked=v.asked.slice();s.completed=v.completed;}
   if(v.version>=3){
    if(!v.reflections||typeof v.reflections!=='object'||!v.reporter||typeof v.reporter!=='object'||typeof v.finalNote!=='string')return initial();
    for(const key of KEYS){const r=v.reflections[key];if(!r||typeof r.q1!=='string'||typeof r.q2!=='string')return initial();s.reflections[key]={q1:text(r.q1),q2:text(r.q2)};}
    if(REPORTER.some(f=>typeof v.reporter[f]!=='string'))return initial();
    s.finalNote=text(v.finalNote);for(const f of REPORTER)s.reporter[f]=v.reporter[f].slice(0,40);
   }
   for(const key of KEYS){const c=v.cases[key],j=v.judgments[key],f=v.follows[key],m=followMarks[key];
    if(!c||['first','final'].some(p=>c[p]!==null&&!choices[key].includes(c[p])))return initial();
    if(!Array.isArray(j)||j.length!==3||j.some(x=>x!==null&&x!=='legacy'&&!stamps.includes(x)))return initial();
    if(!f||!f.marks||typeof f.marks!=='object'||Array.isArray(f.marks)||(f.judgment!==null&&f.judgment!=='legacy'&&!stamps.includes(f.judgment)))return initial();
    if(Object.entries(f.marks).some(([id,val])=>!m.ids.includes(id)||!m.values.includes(val)))return initial();
    s.cases[key]={first:c.first,final:c.final};if(c.legacyFirst===true)s.cases[key].legacyFirst=true;
    s.judgments[key]=j.slice();s.follows[key]={marks:{...f.marks},judgment:f.judgment};
    if(v.version>=4){const n=v.notices?.[key],ok=a=>Array.isArray(a)&&a.every(id=>noticeKind(key,id))&&new Set(a).size===a.length;
     // 고치기 모양(사건 4·5, 2026-11-12): 칸·선택지가 맞고, 붙인 것은 모든 칸을 고른 것이어야 한다. 미리 알리기 장면에 가기 전에는 없다(consistent).
     if(n&&n.mode==='fix'){if(!noticeSlots[key]||!validChoice(key,n.choice,false)||!(n.posted===null||validChoice(key,n.posted,true)))return initial();
      s.notices[key]={mode:'fix',choice:{...n.choice},posted:n.posted?{...n.posted}:null};continue;}
     if(!n||!ok(n.picked)||!(n.posted===null||n.posted==='legacy'||ok(n.posted)&&n.posted.length))return initial();
     s.notices[key]={picked:n.picked.slice(),posted:Array.isArray(n.posted)?n.posted.slice():n.posted};}
   }
   // 미리 알리기 장면까지 갔지만 아직 아무것도 안 고른 사건 4·5(version 6·7 저장, 이 기능 전)는 지금 초안을 넣는다. 고르던·붙인 안내문은 그대로.
   for(const key of KEYS)seedFix(s,key);
   if(OLD)legacyNotices(s);
   return consistent(s)?s:initial();
  }catch{return initial();}
 }
 const api={initial,restart,reduce,canAdvance,restore,caseKey,stepOf,sceneOf,checked,judged,currentJudgment,followReady,followDone,noticeIds,noticeKind,noticeCheck,noticeDone,noticeFix,noticeFixReady,noticeFixCheck,noticeFixLines,outcome,allFaces,cutFaces,faceIn,place,PHOTO,clipText,TEXT_MAX,
  CASES,STEPS,LAYOUT,OLD_QUESTIONS,LAYOUT2,LAYOUT3,LAYOUT4,END,REPORT,RESUME,checks,choices,stamps,answers,followAnswers,followMarks,questions,noticeCards,noticeSlots,AUTO,ALL,faces,FOLLOW_CROPS,truth};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TransparencyEngine=api;
})(typeof window==='undefined'?globalThis:window);
