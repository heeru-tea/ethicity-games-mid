// 저장·이어하기·이전 저장 옮기기
const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
const v1c=(f)=>({first:f,final:f}),OLD3=['photo','writing','face'];
test('corrupt or impossible saves reset safely',()=>{
 for(const raw of [null,'{bad',{},{version:3},{version:2,scene:999},{version:1,revision:4,scene:2,furthest:2,evidence:['P1'],judgments:{},cases:{},question:null,completed:false}])assert.deepEqual(E.restore(raw),E.initial());
 let s=E.initial();s.scene=4;s.furthest=4;assert.deepEqual(E.restore(JSON.stringify(s)),E.initial(),'result scene without a choice');
 s=E.initial();s.judgments.photo=[null,'unknown',null];assert.deepEqual(E.restore(s),E.initial(),'judgment gap');
});
test('version 7 progress round-trips exactly',()=>{
 let s=E.initial();s=E.reduce(s,{type:'next'});s=E.reduce(s,{type:'next'});s=E.reduce(s,{type:'check',id:'photo-original'});
 const n0={picked:[],posted:null},nb=x=>({notices:{photo:x,writing:n0,face:n0,camp:n0,share:n0}});
 assert.equal(s.scene,2);assert.equal(s.version,7);assert.deepEqual(s.notices,{photo:n0,writing:n0,face:n0,camp:n0,share:n0});assert.deepEqual(s.asked,[]);assert.equal('question' in s,false);assert.deepEqual(E.restore(JSON.stringify(s)),s);
 const no=f=>{const c=JSON.parse(JSON.stringify(s[f]));delete c.share;return {[f]:c};};
 for(const bad of [{asked:null},{asked:['zzz']},{asked:['who','who']},{asked:['input']},{completed:true},no('cases'),no('judgments'),no('follows'),no('reflections'),no('notices'),{reflections:null},{finalNote:3},{reporter:{name:1,number:''}},{reflections:{photo:{q1:'a'},writing:{q1:'',q2:''},face:{q1:'',q2:''}}},
  {notices:null},{notices:undefined},nb({picked:['zzz'],posted:null}),nb({picked:['writing-human'],posted:null}),nb({picked:[],posted:[]}),nb({picked:['photo-auto','photo-auto'],posted:null}),nb({picked:[],posted:'x'})])
  assert.deepEqual(E.restore(JSON.stringify({...s,...bad})),E.initial(),'broken fields reset '+JSON.stringify(bad));
 // 사건 4 궁금한 것을 지났는데 물어본 질문이 없으면 손상으로 본다
 const fin=E.initial();for(const k of E.CASES.slice(0,3))doneCase(fin,k);fin.scene=fin.furthest=E.sceneOf('camp','check');assert.deepEqual(E.restore(fin),E.initial());
 fin.asked=['criteria'];assert.equal(E.restore(fin).scene,E.sceneOf('camp','check'));
 // 이 단계를 지났는데 안내문이 없는 version 4 저장은 조작·손상으로 본다
 const skip=doneCase(E.initial(),'photo');skip.notices.photo={picked:[],posted:null};skip.scene=skip.furthest=E.sceneOf('photo','reflect');assert.deepEqual(E.restore(skip),E.initial());
 skip.notices.photo={picked:['photo-auto'],posted:['photo-auto']};assert.equal(E.restore(skip).scene,E.sceneOf('photo','reflect'));
});
// version 2 저장(2026-11-06 판)을 그대로 만든다: 장면 0 프롤로그, 1~5 사진, 6~10 글, 11~15 얼굴, 16 마지막. 서술 칸 없음.
function v2(scene,furthest,extra={}){const s={version:2,scene,furthest,evidence:[],judgments:{photo:[null,null,null],writing:[null,null,null],face:[null,null,null]},
 cases:{photo:{first:null,final:null},writing:{first:null,final:null},face:{first:null,final:null}},follows:{photo:{marks:{},judgment:null},writing:{marks:{},judgment:null},face:{marks:{},judgment:null}},question:null,completed:false};return Object.assign(s,extra);}
const doneCase=(s,k)=>{s.evidence.push(...E.checks[k]);s.judgments[k]=E.answers[k].slice();s.cases[k]={first:E.choices[k][0],final:E.choices[k][0]};
 const m=E.followMarks[k],marks={};m.ids.forEach((id,i)=>{marks[id]=k==='photo'?E.truth[i]:m.values[0];});s.follows[k]={marks,judgment:E.followAnswers[k]};
 if(s.notices){const must=E.noticeCards[k].must.slice();s.notices[k]={picked:must,posted:must.slice()};}return s;};
test('version 2 saves move to version 5: same step, empty reflections, existing fields kept',()=>{
 // 글 사건 직접 확인 중(옛 scene 7)
 let old=doneCase(v2(7,7),'photo');old.evidence.push('writing-guide');
 let s=E.restore(JSON.stringify(old));
 assert.equal(s.version,7);assert.equal(E.caseKey(s.scene),'writing');assert.equal(E.stepOf(s.scene),'check');assert.equal(s.furthest,s.scene);
 assert.deepEqual(s.notices.photo,{picked:[],posted:'legacy'},'photo case already past the new notice step');assert.deepEqual(s.notices.writing,{picked:[],posted:null});
 assert.deepEqual(s.reflections,E.initial().reflections);assert.equal(s.finalNote,'');assert.deepEqual(s.asked,[]);assert.deepEqual(s.reporter,{name:'',number:''});
 assert.deepEqual(s.judgments.photo,old.judgments.photo);assert.deepEqual(s.follows.photo,old.follows.photo);assert.deepEqual(s.evidence,old.evidence);
 assert.deepEqual(E.restore(JSON.stringify(s)),s,'migrated save round-trips as version 5');
 // 사진 후속 조사 중(옛 scene 5): 다음은 새 미리 알리기 화면
 old=v2(5,5);old.evidence.push(...E.checks.photo);old.judgments.photo=E.answers.photo.slice();old.cases.photo={first:'all',final:'all'};
 s=E.restore(old);assert.equal(E.stepOf(s.scene),'follow');assert.equal(E.caseKey(s.scene),'photo');assert.equal(s.notices.photo.posted,null,'not past the notice step yet');
 for(const [i,id] of E.followMarks.photo.ids.entries())s=E.reduce(s,{type:'mark',id,value:E.truth[i]});s=E.reduce(s,{type:'follow-judge',stamp:'different'});
 s=E.reduce(s,{type:'next'});assert.equal(E.stepOf(s.scene),'notice','then the new notice screen');
 // 다 끝낸 저장(옛 scene 16): 새 사건 4 궁금한 것부터, 옛 질문은 버린다
 old=v2(16,16,{question:'criteria',completed:true});for(const k of OLD3)doneCase(old,k);
 s=E.restore(old);assert.equal(s.scene,E.sceneOf('camp','hook'));assert.equal(s.furthest,s.scene);assert.equal(s.completed,false);assert.deepEqual(s.asked,[]);assert.ok(OLD3.every(k=>s.notices[k].posted==='legacy'));
 assert.deepEqual(s.notices.camp,{picked:[],posted:null});s=E.reduce(E.reduce(s,{type:'ask',id:'purpose'}),{type:'next'});assert.equal(s.scene,E.sceneOf('camp','check'));
 // 옛 배치에서 범위를 벗어난 장면 번호
 assert.deepEqual(E.restore(v2(17,17)),E.initial());
});
// version 3 저장(2026-11-08 판): 장면 0 프롤로그, 1~6 사진, 7~12 글, 13~18 얼굴, 19 마지막, 20 보고서. notices 없음.
function v3(scene,furthest,extra={}){const s=v2(scene,furthest);s.version=3;s.reflections={photo:{q1:'',q2:''},writing:{q1:'',q2:''},face:{q1:'',q2:''}};s.finalNote='';s.reporter={name:'',number:''};return Object.assign(s,extra);}
test('version 3 saves move to version 5: same step; cases already past the notice step become legacy and can move on',()=>{
 // 사진 생각 정리 중(옛 scene 6): 새 배치의 사진 생각 정리, 사진 미리 알리기는 '아직 안 함'
 let old=doneCase(v3(6,6),'photo');old.reflections.photo.q1='원본 사진';
 let s=E.restore(JSON.stringify(old));
 assert.equal(s.version,7);assert.equal(E.caseKey(s.scene),'photo');assert.equal(E.stepOf(s.scene),'reflect');assert.equal(s.reflections.photo.q1,'원본 사진');
 assert.deepEqual(s.notices.photo,{picked:[],posted:'legacy'});assert.equal(E.canAdvance(s),true,'legacy does not block');
 assert.deepEqual(E.restore(JSON.stringify(s)),s,'round-trips as version 5');
 let r=E.reduce(s,{type:'revisit',scene:E.sceneOf('photo','notice')});assert.equal(E.canAdvance(r),true);
 r=E.reduce(r,{type:'notice-pick',id:'photo-auto'});r=E.reduce(r,{type:'notice-post'});assert.deepEqual(r.notices.photo.posted,['photo-auto'],'can be done later');
 // 사진 후속 조사 중(옛 scene 5): 다음 화면이 새 미리 알리기
 old=v3(5,5);old.evidence.push(...E.checks.photo);old.judgments.photo=E.answers.photo.slice();old.cases.photo={first:'all',final:'all'};
 s=E.restore(old);assert.equal(E.stepOf(s.scene),'follow');assert.equal(s.notices.photo.posted,null);
 // 글 사건 직접 확인 중(옛 scene 8), 사진은 끝냄
 old=doneCase(v3(8,8),'photo');old.evidence.push('writing-guide');s=E.restore(old);
 assert.equal(s.scene,E.sceneOf('writing','check'));assert.equal(s.notices.photo.posted,'legacy');assert.equal(s.notices.writing.posted,null);
 // 보고서까지 간 저장(옛 scene 20): 사건 4 궁금한 것부터, 세 사건 모두 legacy, 서술·이름 그대로
 old=v3(20,20,{question:'unknown',completed:true});for(const k of OLD3)doneCase(old,k);old.finalNote='먼저 물어볼래';old.reporter={name:'하늘',number:'10203'};
 s=E.restore(old);assert.equal(s.scene,E.sceneOf('camp','hook'));assert.equal(s.completed,false);assert.deepEqual(s.asked,[]);assert.ok(OLD3.every(k=>s.notices[k].posted==='legacy'));assert.equal(s.finalNote,'먼저 물어볼래');assert.deepEqual(s.reporter,{name:'하늘',number:'10203'});
 // 옛 배치(마지막 20)를 벗어난 장면 번호
 assert.deepEqual(E.restore(v3(21,21)),E.initial());
});
test('version 1 revision 4 save at scene 5 (writing case start) resumes at the writing case start',()=>{
 const old={version:1,revision:4,scene:5,furthest:5,evidence:['photo-original','photo-rule'],judgments:{photo:'unknown',writing:null,face:null},cases:{photo:v1c('auto'),writing:{first:null,final:null},face:{first:null,final:null}},question:null,completed:false};
 const s=E.restore(JSON.stringify(old));
 assert.equal(s.version,7);assert.equal(E.stepOf(s.scene),'hook');assert.equal(E.caseKey(s.scene),'writing');assert.equal(s.notices.photo.posted,'legacy');
 assert.deepEqual(s.reflections.photo,{q1:'',q2:''},'version 1 saves also get empty reflections');
 assert.deepEqual(s.judgments.photo,['unknown','legacy','legacy'],'old pick kept as judgment 1; new ones marked as not done');
 assert.equal(s.follows.photo.judgment,'legacy');assert.deepEqual(s.cases.photo,{first:'auto',final:'auto'});
 assert.equal(E.canAdvance(s),true);assert.equal(E.reduce(s,{type:'next'}).scene,s.scene+1);
 assert.deepEqual(E.restore(JSON.stringify(s)),s);
 let r=E.reduce(s,{type:'revisit',scene:2});r=E.reduce(r,{type:'judge',stamp:'different'});assert.deepEqual(r.judgments.photo,['unknown','different','legacy'],'legacy slot can be done later');
});
test('version 1 revision 4 at photo result continues into the new follow-up',()=>{
 const old={version:1,revision:4,scene:4,furthest:4,evidence:['photo-original','photo-rule'],judgments:{photo:'confirmed',writing:null,face:null},cases:{photo:v1c('all'),writing:{first:null,final:null},face:{first:null,final:null}},question:null,completed:false};
 const s=E.restore(old);assert.equal(E.stepOf(s.scene),'result');assert.equal(s.follows.photo.judgment,null);
 assert.equal(E.reduce(s,{type:'next'}).scene,E.sceneOf('photo','follow'));
});
test('version 1 revision 4 completed save resumes at the new case 4',()=>{
 const old={version:1,revision:4,scene:13,furthest:13,evidence:OLD3.flatMap(k=>E.checks[k]),judgments:{photo:'confirmed',writing:'unknown',face:'different'},cases:{photo:v1c('all'),writing:v1c('review'),face:v1c('release')},question:'input',completed:true};
 const s=E.restore(old);assert.equal(s.scene,E.sceneOf('camp','hook'));assert.equal(s.completed,false);assert.deepEqual(s.asked,[]);assert.ok(OLD3.every(k=>s.follows[k].judgment==='legacy'&&s.notices[k].posted==='legacy'));
 assert.deepEqual(s.follows.camp,{marks:{},judgment:null});
});
test('revision 3 save (claim-card version) still migrates through revision 4',()=>{
 const old={version:1,revision:3,scene:7,furthest:7,evidence:['P1','P2','P3','W1','W2'],tasks:{},claims:{},attempts:{},assistedScenes:[],
  cases:{photo:{first:'auto',final:'manual',pending:null,help:false},writing:{first:null,final:null,pending:null,help:false},face:{first:null,final:null,pending:null,help:false}},crop:[0,0,1536,1024],completed:false};
 const s=E.restore(old);assert.deepEqual(s.cases.photo,{first:'auto',final:'all'});assert.deepEqual(s.judgments.photo,['legacy','legacy','legacy']);
 assert.equal(s.scene,E.sceneOf('writing','hook'));assert.ok(s.evidence.includes('writing-guide')&&!s.evidence.includes('writing-history'));
 const nr={version:1,scene:4,furthest:4,evidence:['P1','P2','P3'],tasks:{},cases:{photo:{first:null,final:'auto',pending:null,help:false},writing:{first:null,final:null,pending:null,help:false},face:{first:null,final:null,pending:null,help:false}},crop:[900,50,600,400],completed:false};
 const t=E.restore(nr);assert.equal(t.cases.photo.legacyFirst,true);assert.equal(t.scene,E.sceneOf('photo','result'));
});

// version 4 저장(2026-11-08 미리 알리기 판): 0 프롤로그, 1~21 사건 1~3(지금과 같은 번호), 22 마지막, 23 보고서. 사건 4·5 칸·asked 없음.
function v4(scene,furthest,extra={}){const s=v3(scene,furthest);s.version=4;s.notices={photo:{picked:[],posted:null},writing:{picked:[],posted:null},face:{picked:[],posted:null}};return Object.assign(s,extra);}
test('version 4 saves move to version 5: case scenes unchanged; ending, report and completed saves resume at case 4',()=>{
 // 얼굴 사건 직접 확인 중(scene 16)
 let old=doneCase(doneCase(v4(16,16),'photo'),'writing');old.evidence.push('face-alert');
 let s=E.restore(JSON.stringify(old));assert.equal(s.version,7);assert.equal(s.scene,16);assert.equal(E.caseKey(s.scene),'face');assert.equal(E.stepOf(s.scene),'check');
 assert.deepEqual(s.notices.photo,old.notices.photo,'posted notices kept, not legacy');assert.deepEqual(s.judgments.writing,old.judgments.writing);assert.deepEqual(s.asked,[]);
 assert.deepEqual(E.restore(JSON.stringify(s)),s,'round-trips as version 5');
 // 마지막 장면에서 질문 전(scene 22)
 old=v4(22,22);for(const k of OLD3)doneCase(old,k);s=E.restore(old);assert.equal(s.scene,E.sceneOf('camp','hook'));assert.equal(s.completed,false);assert.deepEqual(s.asked,[]);
 // 다 마친 저장(보고서, scene 23): 사건 4 첫 화면. 사건 1~3 기록·서술·안내문·이름·마지막 서술 그대로
 old=v4(23,23,{question:'notice',completed:true,finalNote:'무엇을 썼는지',reporter:{name:'하늘',number:'10203'}});for(const k of OLD3)doneCase(old,k);old.reflections.face={q1:'점검표',q2:'기록'};
 old.notices.writing={picked:['writing-human','writing-patterns'],posted:['writing-human','writing-patterns']};
 s=E.restore(JSON.stringify(old));
 assert.equal(s.scene,E.sceneOf('camp','hook'));assert.equal(s.furthest,s.scene);assert.equal(s.completed,false);assert.deepEqual(s.asked,[]);
 for(const k of OLD3){assert.deepEqual(s.judgments[k],old.judgments[k]);assert.deepEqual(s.cases[k],old.cases[k]);assert.deepEqual(s.follows[k],old.follows[k]);assert.deepEqual(s.notices[k],old.notices[k]);assert.deepEqual(s.reflections[k],old.reflections[k]);}
 assert.equal(s.finalNote,'무엇을 썼는지');assert.deepEqual(s.reporter,{name:'하늘',number:'10203'});
 for(const k of ['camp','share']){assert.deepEqual(s.cases[k],{first:null,final:null});assert.deepEqual(s.judgments[k],[null,null,null]);assert.deepEqual(s.notices[k],{picked:[],posted:null});assert.deepEqual(s.reflections[k],{q1:'',q2:''});}
 assert.equal(E.reduce(s,{type:'revisit',scene:E.sceneOf('face','reflect')}).scene,E.sceneOf('face','reflect'),'earlier cases can be reopened');
 assert.deepEqual(E.restore(JSON.stringify(s)),s);
 // 옛 배치(마지막 23)를 벗어난 장면 번호
 assert.deepEqual(E.restore(v4(24,24)),E.initial());
});
// version 5 저장(2026-11-08~10 판, 옛 사건 4·5 = 도서관 library·밤하늘 recommend). 장면 번호는 지금과 같다.
function v5(scene,furthest){const K=['photo','writing','face','library','recommend'],each=f=>Object.fromEntries(K.map(k=>[k,f()]));
 return {version:5,scene,furthest,evidence:[],judgments:each(()=>[null,null,null]),cases:each(()=>({first:null,final:null})),follows:each(()=>({marks:{},judgment:null})),asked:[],completed:false,
  reflections:each(()=>({q1:'',q2:''})),finalNote:'',reporter:{name:'',number:''},notices:each(()=>({picked:[],posted:null}))};}
test('version 5 saves move to version 6: cases 1~3 kept, old cases 4·5 dropped, resume at the new case 4',()=>{
 // 사건 1~3 도중: 그대로
 let old=v5(9,9);doneCase(old,'photo');old.evidence.push('writing-guide');old.reflections.photo={q1:'원본',q2:'기준'};
 let s=E.restore(JSON.stringify(old));assert.equal(s.version,7);assert.equal(s.scene,9);assert.deepEqual(s.reflections.photo,{q1:'원본',q2:'기준'});assert.deepEqual(s.evidence,old.evidence);
 // 옛 사건 4 도중·옛 사건 5 도중·보고서·완료 → 새 사건 4 첫 화면, 완료 아님, 옛 자료·질문 버림
 for(const [scene,completed] of [[25,false],[31,false],[36,true],[37,true]]){
  old=v5(scene,scene);for(const k of OLD3)doneCase(old,k);old.evidence.push('library-guide','library-loans','recommend-reason');old.asked=['input','notice'];old.completed=completed;
  old.judgments.library=['different',null,null];old.reflections.library={q1:'옛 도서관',q2:''};old.finalNote='끝';old.reporter={name:'하늘',number:'10203'};
  old.reflections.face={q1:'점검표',q2:''};
  s=E.restore(JSON.stringify(old));
  assert.equal(s.version,7);assert.equal(s.scene,E.sceneOf('camp','hook'),'scene '+scene);assert.equal(s.furthest,s.scene);assert.equal(s.completed,false);assert.deepEqual(s.asked,[]);
  assert.ok(s.evidence.every(id=>OLD3.some(k=>E.checks[k].includes(id))),'old case 4·5 records dropped');
  for(const k of OLD3){assert.deepEqual(s.judgments[k],old.judgments[k]);assert.deepEqual(s.cases[k],old.cases[k]);assert.deepEqual(s.notices[k],old.notices[k]);}
  assert.deepEqual(s.reflections.face,{q1:'점검표',q2:''});assert.equal(s.finalNote,'끝');assert.deepEqual(s.reporter,{name:'하늘',number:'10203'});
  for(const k of ['camp','share']){assert.deepEqual(s.cases[k],{first:null,final:null});assert.deepEqual(s.judgments[k],[null,null,null]);assert.deepEqual(s.reflections[k],{q1:'',q2:''});}
  assert.equal('library' in s.cases,false);assert.deepEqual(E.restore(JSON.stringify(s)),s,'round-trips as version 7');
  assert.equal(E.canAdvance(s),false,'must ask the 구청 first');}
 // 옛 질문 목록에도 없는 질문은 손상
 old=v5(9,9);doneCase(old,'photo');old.asked=['zzz'];assert.deepEqual(E.restore(old),E.initial());
 old=v5(9,9);old.evidence=['zzz-id'];assert.deepEqual(E.restore(old),E.initial());
});

// version 6 저장(2026-11-10~12, 이번 수정 요청 전): 장면·칸은 그대로. 사건 4 기준표를 다 연 저장은 버스 쪽지(camp-bus)도 본 것으로,
// 문장이 바뀐 사건 4 판단 3과 사건 5 후속 조사 판단은 legacy(이전 저장에서 넘어와 아직 안 함)로 — 이어하기는 막지 않는다.
function v6at(key,step,tweak){
 let s=E.initial();const goal=E.sceneOf(key,step);
 while(s.scene<goal){const k=E.caseKey(s.scene),st=E.stepOf(s.scene);
  if(st==='hook'&&k==='camp')s=E.reduce(s,{type:'ask',id:'who'});
  if(st==='check'){for(const id of E.checks[k])s=E.reduce(s,{type:'check',id});for(const a of E.answers[k])s=E.reduce(s,{type:'judge',stamp:a});}
  if(st==='choose'){s=E.reduce(s,{type:'choose',id:E.choices[k][0]});continue;}
  if(st==='follow'){const m=E.followMarks[k];m.ids.forEach((id,i)=>{s=E.reduce(s,{type:'mark',id,value:k==='photo'?E.truth[i]:m.values[0]});});s=E.reduce(s,{type:'follow-judge',stamp:E.followAnswers[k]});}
  if(st==='notice'){for(const id of E.noticeIds(k))if(E.noticeKind(k,id)==='must'&&!s.notices[k].picked.includes(id))s=E.reduce(s,{type:'notice-pick',id});s=E.reduce(s,{type:'notice-post'});}
  s=E.reduce(s,{type:'next'});}
 // 옛 모양으로: version 6, 버스 쪽지 자료 없음, 사건 5 후속 조사의 옛 정답은 ‘자료와 달라’
 const old=JSON.parse(JSON.stringify(s));old.version=6;old.evidence=old.evidence.filter(id=>id!=='camp-bus');
 // version 6에는 고치기(fix)가 없었다: 사건 4·5 안내문은 카드 고르기 모양(꼭 필요 카드만 골라 붙임, 아직 미리 알리기에 서 있으면 빈 칸)으로 되돌린다.
 for(const k of ['camp','share']){const n=old.notices[k];if(n.fix){delete n.fix;const done=Array.isArray(n.posted);n.picked=done?E.noticeCards[k].must.slice():[];if(done)n.posted=E.noticeCards[k].must.slice();}}
 if(old.follows.share.judgment)old.follows.share.judgment='different';
 if(tweak)tweak(old);return old;
}
test('version 6 saves move to version 7: scenes and answers kept; the bus note counts as seen with the criteria table; the two replaced judgments become legacy',()=>{
 // 사건 1~3 도중: 한 글자도 안 바뀐다(version만)
 let old=v6at('face','follow'),s=E.restore(JSON.stringify(old));
 assert.deepEqual(s,{...old,version:7});assert.deepEqual(E.restore(JSON.stringify(s)),s);
 // 사건 4 판단을 마친 뒤(선택·결과·후속 조사·미리 알리기·생각 정리 어디든): 같은 장면, 판단 1·2 그대로, 판단 3만 legacy, 쪽지는 본 자료
 for(const step of ['choose','result','follow','notice','reflect']){
  old=v6at('camp',step);s=E.restore(JSON.stringify(old));
  assert.equal(s.version,7);assert.equal(s.scene,old.scene,step);assert.equal(s.furthest,old.furthest);
  assert.deepEqual(s.judgments.camp,[old.judgments.camp[0],old.judgments.camp[1],'legacy']);assert.deepEqual(s.evidence,[...old.evidence,'camp-bus']);
  // 미리 알리기에 서 있고 아직 아무것도 안 고른 저장만 초안이 들어간다(2026-11-12 고치기). 나머지 안내문은 그대로.
  const want=step==='notice'?{...old.notices,camp:{picked:E.noticeDraft('camp'),posted:null,fix:true}}:old.notices;
  assert.deepEqual(s.cases,old.cases);assert.deepEqual(s.asked,old.asked);assert.deepEqual(s.notices,want);assert.deepEqual(s.follows.camp,old.follows.camp);
  if(step==='result'||step==='reflect')assert.equal(E.canAdvance(s),true,'legacy never blocks: '+step);
  assert.deepEqual(E.restore(JSON.stringify(s)),s,'round-trips as version 7');}
 // 판단 3을 지금 다시 하면 새 문장의 답으로 들어간다
 s=E.restore(JSON.stringify(v6at('camp','choose')));s=E.reduce(s,{type:'revisit',scene:E.sceneOf('camp','check')});
 assert.equal(E.currentJudgment(s,'camp'),2);s=E.reduce(s,{type:'judge',stamp:'confirmed'});assert.deepEqual(s.judgments.camp,E.answers.camp);
 // 사건 4 직접 확인 도중: 판단 1개만 한 저장 → 그대로 이어서(쪽지는 본 자료), 자료만 다 연 저장 → 판단이 바로 열림, 기준표를 아직 안 연 저장 → 쪽지도 아직
 old=v6at('camp','check',o=>{o.evidence.push('camp-page','camp-results','camp-criteria');o.judgments.camp=['unknown',null,null];});s=E.restore(JSON.stringify(old));
 assert.equal(s.scene,E.sceneOf('camp','check'));assert.deepEqual(s.judgments.camp,['unknown',null,null]);assert.equal(E.checked(s,'camp'),true);
 s=E.reduce(E.reduce(s,{type:'judge',stamp:'different'}),{type:'judge',stamp:'confirmed'});assert.equal(E.canAdvance(s),true);
 old=v6at('camp','check',o=>{o.evidence.push('camp-page','camp-results','camp-criteria');});s=E.restore(JSON.stringify(old));assert.equal(E.checked(s,'camp'),true);assert.deepEqual(s.judgments.camp,[null,null,null]);
 old=v6at('camp','check',o=>{o.evidence.push('camp-page','camp-results');});s=E.restore(JSON.stringify(old));assert.equal(s.scene,E.sceneOf('camp','check'));assert.equal(s.evidence.includes('camp-bus'),false);assert.equal(E.checked(s,'camp'),false);
 s=E.reduce(E.reduce(s,{type:'check',id:'camp-criteria'}),{type:'check',id:'camp-bus'});assert.equal(E.checked(s,'camp'),true);
 // 사건 5 후속 조사: 판단까지 한 저장 → 연 곳은 그대로, 판단만 legacy(다음으로 갈 수 있다). 세 곳만 연 저장 → 그대로
 for(const step of ['notice','reflect']){old=v6at('share',step);s=E.restore(JSON.stringify(old));
  assert.equal(s.scene,old.scene);assert.deepEqual(s.follows.share,{marks:old.follows.share.marks,judgment:'legacy'});assert.deepEqual(s.judgments.share,old.judgments.share,'case 5 judgments kept');assert.equal(E.followDone(s,'share'),true);}
 old=v6at('share','follow',o=>{o.follows.share.marks={dm:'open',post:'open',board:'open'};});s=E.restore(JSON.stringify(old));
 assert.deepEqual(s.follows.share,{marks:{dm:'open',post:'open',board:'open'},judgment:null});s=E.reduce(s,{type:'follow-judge',stamp:'confirmed'});assert.equal(E.canAdvance(s),true);
 s=E.restore(JSON.stringify(v6at('share','reflect')));s=E.reduce(s,{type:'revisit',scene:E.sceneOf('share','follow')});s=E.reduce(s,{type:'follow-judge',stamp:'confirmed'});assert.equal(s.follows.share.judgment,'confirmed');
 // 다 마친 저장(마지막 장면·보고서): 완료·서술·이름 그대로
 for(const to of [E.END,E.REPORT]){old=v6at('share','reflect');let n=E.restore(JSON.stringify(old));while(n.scene<to)n=E.reduce(n,{type:'next'});
  n=JSON.parse(JSON.stringify(n));n.version=6;n.evidence=n.evidence.filter(id=>id!=='camp-bus');n.judgments.camp[2]='confirmed';n.follows.share.judgment='different';n.finalNote='먼저 물어볼래';n.reporter={name:'하늘',number:'10203'};n.reflections.share={q1:'게시물',q2:'DM'};
  s=E.restore(JSON.stringify(n));assert.equal(s.scene,to);assert.equal(s.completed,true);assert.equal(s.finalNote,'먼저 물어볼래');assert.deepEqual(s.reporter,{name:'하늘',number:'10203'});assert.deepEqual(s.reflections.share,{q1:'게시물',q2:'DM'});
  assert.equal(s.judgments.camp[2],'legacy');assert.equal(s.follows.share.judgment,'legacy');}
 // 망가진 version 6 저장은 여전히 처음부터
 old=v6at('camp','reflect');old.judgments.camp='x';assert.deepEqual(E.restore(JSON.stringify(old)),E.initial());
 old=v6at('camp','reflect');old.evidence=null;assert.deepEqual(E.restore(JSON.stringify(old)),E.initial());
 old=v6at('camp','reflect');old.follows=null;assert.deepEqual(E.restore(JSON.stringify(old)),E.initial());
 assert.deepEqual(E.restore({version:6}),E.initial());assert.deepEqual(E.restore({version:8,scene:0}),E.initial(),'unknown newer version');
});

// ── 2026-11-12 수정 요청 10: 사건 4·5 미리 알리기 ‘고치기’ ──
// 틀린 초안(engine noticeDrafts)에서 시작한다. 카드·판정은 그대로. 초안 그대로는 붙일 수 없다. 저장은 version 7 그대로, 칸 notices[k].fix 하나만 더한다.
// 그 전에 카드 고르기로 붙인(또는 고르던) 사건 4·5 안내문은 fix 없이 그대로 둔다.
function walk(key,step){let s=E.initial();const goal=E.sceneOf(key,step);
 while(s.scene<goal){const k=E.caseKey(s.scene),st=E.stepOf(s.scene);
  if(st==='hook'&&k==='camp')s=E.reduce(s,{type:'ask',id:'who'});
  if(st==='check'){for(const id of E.checks[k])s=E.reduce(s,{type:'check',id});for(const a of E.answers[k])s=E.reduce(s,{type:'judge',stamp:a});}
  if(st==='choose'){s=E.reduce(s,{type:'choose',id:E.choices[k][0]});continue;}
  if(st==='follow'){const m=E.followMarks[k];m.ids.forEach((id,i)=>{s=E.reduce(s,{type:'mark',id,value:k==='photo'?E.truth[i]:m.values[0]});});s=E.reduce(s,{type:'follow-judge',stamp:E.followAnswers[k]});}
  if(st==='notice'){for(const id of E.noticeIds(k))if(E.noticeCards[k].must.includes(id)!==s.notices[k].picked.includes(id))s=E.reduce(s,{type:'notice-pick',id});s=E.reduce(s,{type:'notice-post'});}
  s=E.reduce(s,{type:'next'});}
 return s;}
const pick=(s,id)=>E.reduce(s,{type:'notice-pick',id}),post=s=>E.reduce(s,{type:'notice-post'});
test('notice fix (request 10): cases 4 and 5 start from a flawed draft; cases 1~3 still start empty; the drafts hold no right answer set',()=>{
 assert.deepEqual(E.noticeDrafts,{camp:['camp-role','camp-never','camp-everyone'],share:['share-same','share-spell']});
 for(const k of ['photo','writing','face']){const s=walk(k,'notice');assert.deepEqual(s.notices[k],{picked:[],posted:null},k+' card picking as before');assert.equal(E.noticeFix(s,k),false);assert.equal(E.noticeDraft(k),null);}
 for(const k of ['camp','share']){const s=walk(k,'notice');
  assert.deepEqual(s.notices[k],{picked:E.noticeDrafts[k],posted:null,fix:true},k+' draft put in on arrival');assert.equal(E.noticeFix(s,k),true);
  const r=E.noticeCheck(k,E.noticeDrafts[k]);assert.equal(r.ok,false,'the draft is wrong');assert.ok(r.missing.length>=2,'at least two must cards to add');assert.equal(r.promises.length,1,'one promise to remove');
  for(const id of E.noticeDrafts[k])assert.ok(E.noticeKind(k,id),'draft cards are this case’s cards');
  assert.equal(E.canAdvance(s),false,'post once before moving on');
  // 다른 단계에는 초안이 없다(미리 알리기 전에는 picked가 비어 있다)
  const before=walk(k,'follow');assert.deepEqual(before.notices[k],{picked:[],posted:null});}
 // 모양이 다른 두 초안: 사건 4는 부딪침 카드가 있고 사건 5는 없다(사건 5 초안에는 있으면 좋음 카드)
 assert.deepEqual(E.noticeCheck('camp',E.noticeDrafts.camp).conflicts,['camp-everyone']);assert.deepEqual(E.noticeCheck('share',E.noticeDrafts.share).conflicts,[]);
 assert.deepEqual(E.noticeCheck('share',E.noticeDrafts.share).extras,['share-spell']);
});
test('notice fix: the draft cannot be posted unchanged; one change is enough to post (even if still wrong); back to the draft blocks posting again but keeps the last posted notice',()=>{
 let s=walk('camp','notice');
 s=post(s);assert.equal(s.notices.camp.posted,null,'draft as it is cannot be posted');assert.equal(E.canAdvance(s),false);
 s=pick(s,'camp-never');assert.deepEqual(s.notices.camp.picked,['camp-role','camp-everyone']);s=post(s);
 assert.deepEqual(s.notices.camp.posted,['camp-role','camp-everyone'],'one change: can post');assert.equal(E.canAdvance(s),true,'posting once is enough, as before');
 const r=E.noticeCheck('camp',s.notices.camp.posted);assert.deepEqual([r.ok,r.missing,r.conflicts,r.promises],[false,['camp-office','camp-appeal'],['camp-everyone'],[]]);
 assert.deepEqual(E.noticeChanges('camp',s.notices.camp.posted),{removed:['camp-never'],added:[]});
 s=pick(s,'camp-never');assert.equal(E.noticeSameDraft('camp',s.notices.camp.picked),true);s=post(s);
 assert.deepEqual(s.notices.camp.posted,['camp-role','camp-everyone'],'back to the draft: posting ignored, the last posted notice stays');assert.equal(E.canAdvance(s),true);
 // 모두 고침: 다 맞음
 for(const id of ['camp-never','camp-everyone','camp-office','camp-appeal'])s=pick(s,id);s=post(s);
 assert.deepEqual(s.notices.camp.posted,['camp-role','camp-office','camp-appeal']);assert.equal(E.noticeCheck('camp',s.notices.camp.posted).ok,true);
 assert.deepEqual(E.noticeChanges('camp',s.notices.camp.posted),{removed:['camp-never','camp-everyone'],added:['camp-office','camp-appeal']});
 // 빈 안내문은 여전히 붙일 수 없다
 let e=walk('share','notice');e=pick(pick(e,'share-same'),'share-spell');assert.deepEqual(e.notices.share.picked,[]);e=post(e);assert.equal(e.notices.share.posted,null);
 // 사건 5: 순서가 달라도 같은 집합이면 초안 그대로
 e=pick(pick(e,'share-spell'),'share-same');assert.equal(E.noticeSameDraft('share',e.notices.share.picked),true);assert.equal(post(e).notices.share.posted,null);
 e=pick(pick(e,'share-ai'),'share-real');e=post(e);assert.deepEqual(E.noticeCheck('share',e.notices.share.posted).promises,['share-same']);
 // 다시 들어와도 초안을 다시 넣지 않는다(고친 것 그대로)
 let back=E.reduce(e,{type:'revisit',scene:E.sceneOf('share','follow')});back=E.reduce(back,{type:'next'});assert.deepEqual(back.notices.share,e.notices.share);
 // 다 고친 뒤 다음으로, 저장·복원 그대로
 s=E.reduce(s,{type:'next'});assert.equal(E.stepOf(s.scene),'reflect');assert.deepEqual(E.restore(JSON.stringify(s)),s);
 // 같은 화면에서 모두 빼도 picked가 비고 fix는 남는다 — 다시 열어도 초안을 다시 넣지 않는다
 let none=walk('camp','notice');for(const id of E.noticeDrafts.camp)none=pick(none,id);assert.deepEqual(none.notices.camp,{picked:[],posted:null,fix:true});assert.deepEqual(E.restore(JSON.stringify(none)),none);
});
test('notice fix: the fix mark is only kept where it makes sense; a bad mark never wipes a save',()=>{
 const s=walk('camp','reflect');assert.equal(s.notices.camp.fix,true);
 for(const bad of ['yes',1,false,null]){const v=JSON.parse(JSON.stringify(s));v.notices.camp.fix=bad;const r=E.restore(JSON.stringify(v));
  assert.equal(r.scene,s.scene,'save kept: '+bad);assert.equal('fix' in r.notices.camp,false,'not a fix notice: '+bad);assert.deepEqual(r.notices.camp.posted,s.notices.camp.posted);}
 const v=JSON.parse(JSON.stringify(s));v.notices.photo.fix=true;assert.equal('fix' in E.restore(JSON.stringify(v)).notices.photo,false,'cases 1~3 never fix');
 const early=walk('camp','follow');const w=JSON.parse(JSON.stringify(early));w.notices.share.fix=true;const r=E.restore(JSON.stringify(w));assert.deepEqual(r.notices.share,{picked:[],posted:null},'not reached yet');assert.equal(r.scene,early.scene);
});
test('notice fix and old saves (version 6 and 7 from before this change): card-picked notices stay card-picked; an untouched notice step gets the draft',()=>{
 // 옛 모양: 사건 4·5 안내문은 꼭 필요 카드만 골라 붙임(fix 없음)
 const oldShape=(key,step,ver)=>{const s=JSON.parse(JSON.stringify(walk(key,step)));s.version=ver;
  for(const k of ['camp','share']){const n=s.notices[k];if(n.fix){delete n.fix;const done=Array.isArray(n.posted);n.picked=done?E.noticeCards[k].must.slice():[];if(done)n.posted=E.noticeCards[k].must.slice();}}
  if(ver===6){s.evidence=s.evidence.filter(id=>id!=='camp-bus');if(s.follows.share.judgment)s.follows.share.judgment='different';if(stamps(s.judgments.camp[2]))s.judgments.camp[2]='confirmed';}
  return s;};
 const stamps=x=>E.stamps.includes(x);
 for(const ver of [6,7]){
  // 미리 알리기를 지난 저장(생각 정리·다음 사건·마지막·보고서): 카드로 붙인 안내문 그대로, fix 없음
  for(const [key,step] of [['camp','reflect'],['share','hook'],['share','notice'],['share','reflect']]){const old=oldShape(key,step,ver),s=E.restore(JSON.stringify(old));
   assert.equal(s.scene,old.scene,ver+' '+key+' '+step);assert.deepEqual(s.notices.camp,{picked:E.noticeCards.camp.must,posted:E.noticeCards.camp.must},ver+' camp kept as card-picked');
   assert.equal(E.noticeFix(s,'camp'),false);assert.equal(E.noticeCheck('camp',s.notices.camp.posted).ok,true);}
  for(const to of [E.END,E.REPORT]){let n=walk('share','reflect');while(n.scene<to)n=E.reduce(n,{type:'next'});
   const old=JSON.parse(JSON.stringify(n));old.version=ver;for(const k of ['camp','share']){delete old.notices[k].fix;old.notices[k]={picked:E.noticeCards[k].must.slice(),posted:E.noticeCards[k].must.slice()};}
   const s=E.restore(JSON.stringify(old));assert.equal(s.scene,to);assert.equal(s.completed,true);
   for(const k of ['camp','share'])assert.deepEqual(s.notices[k],{picked:E.noticeCards[k].must,posted:E.noticeCards[k].must},ver+' finished save: '+k+' as the student posted it');}
  // 미리 알리기에 서 있고 아직 아무것도 안 고른 저장: 초안이 들어간다
  for(const k of ['camp','share']){const old=oldShape(k,'notice',ver);assert.deepEqual(old.notices[k],{picked:[],posted:null});
   const s=E.restore(JSON.stringify(old));assert.equal(s.scene,old.scene);assert.deepEqual(s.notices[k],{picked:E.noticeDrafts[k],posted:null,fix:true},ver+' '+k+' draft put in');
   assert.deepEqual(E.restore(JSON.stringify(s)),s,'round-trips');}
  // 미리 알리기에서 카드를 고르던 저장: 고른 것 그대로, 카드 고르기로 이어서(초안을 덮어쓰지 않는다)
  for(const k of ['camp','share']){const old=oldShape(k,'notice',ver);old.notices[k].picked=[E.noticeCards[k].must[1]];
   let s=E.restore(JSON.stringify(old));assert.deepEqual(s.notices[k],{picked:[E.noticeCards[k].must[1]],posted:null},ver+' '+k+' picks kept, no draft');
   s=post(s);assert.deepEqual(s.notices[k].posted,[E.noticeCards[k].must[1]],'card picking: posts as before');s=E.reduce(s,{type:'next'});assert.equal(E.stepOf(s.scene),'reflect');}
  // 미리 알리기에서 붙인 뒤 뒤로 갔다 온 저장(furthest = 미리 알리기, 장면은 후속 조사): 붙인 것 그대로, 다음으로 가도 초안을 넣지 않는다
  {const old=oldShape('camp','reflect',ver);old.scene=E.sceneOf('camp','follow');old.furthest=E.sceneOf('camp','notice');
   let s=E.restore(JSON.stringify(old));assert.deepEqual(s.notices.camp,{picked:E.noticeCards.camp.must,posted:E.noticeCards.camp.must});s=E.reduce(s,{type:'next'});assert.deepEqual(s.notices.camp,{picked:E.noticeCards.camp.must,posted:E.noticeCards.camp.must});}
  // 사건 4 후속 조사 도중(미리 알리기 전): 칸 그대로, 들어가면 초안
  {const old=oldShape('camp','follow',ver);let s=E.restore(JSON.stringify(old));assert.deepEqual(s.notices.camp,{picked:[],posted:null});
   s=E.reduce(E.reduce(s,{type:'mark',id:'changed',value:'found'}),{type:'follow-judge',stamp:'different'});s=E.reduce(s,{type:'next'});
   assert.equal(E.stepOf(s.scene),'notice');assert.deepEqual(s.notices.camp,{picked:E.noticeDrafts.camp,posted:null,fix:true},ver+' reaches the notice step after the change: draft');}
 }
});
