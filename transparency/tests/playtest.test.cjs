// 저장·이어하기·이전 저장 옮기기
const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
const v1c=(f)=>({first:f,final:f}),OLD3=['photo','writing','face'];
test('corrupt or impossible saves reset safely',()=>{
 for(const raw of [null,'{bad',{},{version:3},{version:2,scene:999},{version:1,revision:4,scene:2,furthest:2,evidence:['P1'],judgments:{},cases:{},question:null,completed:false}])assert.deepEqual(E.restore(raw),E.initial());
 let s=E.initial();s.scene=4;s.furthest=4;assert.deepEqual(E.restore(JSON.stringify(s)),E.initial(),'result scene without a choice');
 s=E.initial();s.judgments.photo=[null,'unknown',null];assert.deepEqual(E.restore(s),E.initial(),'judgment gap');
});
test('version 6 progress round-trips exactly',()=>{
 let s=E.initial();s=E.reduce(s,{type:'next'});s=E.reduce(s,{type:'next'});s=E.reduce(s,{type:'check',id:'photo-original'});
 const n0={picked:[],posted:null},nb=x=>({notices:{photo:x,writing:n0,face:n0,camp:n0,share:n0}});
 assert.equal(s.scene,2);assert.equal(s.version,6);assert.deepEqual(s.notices,{photo:n0,writing:n0,face:n0,camp:n0,share:n0});assert.deepEqual(s.asked,[]);assert.equal('question' in s,false);assert.deepEqual(E.restore(JSON.stringify(s)),s);
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
 assert.equal(s.version,6);assert.equal(E.caseKey(s.scene),'writing');assert.equal(E.stepOf(s.scene),'check');assert.equal(s.furthest,s.scene);
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
 assert.equal(s.version,6);assert.equal(E.caseKey(s.scene),'photo');assert.equal(E.stepOf(s.scene),'reflect');assert.equal(s.reflections.photo.q1,'원본 사진');
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
 assert.equal(s.version,6);assert.equal(E.stepOf(s.scene),'hook');assert.equal(E.caseKey(s.scene),'writing');assert.equal(s.notices.photo.posted,'legacy');
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
 let s=E.restore(JSON.stringify(old));assert.equal(s.version,6);assert.equal(s.scene,16);assert.equal(E.caseKey(s.scene),'face');assert.equal(E.stepOf(s.scene),'check');
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
 let s=E.restore(JSON.stringify(old));assert.equal(s.version,6);assert.equal(s.scene,9);assert.deepEqual(s.reflections.photo,{q1:'원본',q2:'기준'});assert.deepEqual(s.evidence,old.evidence);
 // 옛 사건 4 도중·옛 사건 5 도중·보고서·완료 → 새 사건 4 첫 화면, 완료 아님, 옛 자료·질문 버림
 for(const [scene,completed] of [[25,false],[31,false],[36,true],[37,true]]){
  old=v5(scene,scene);for(const k of OLD3)doneCase(old,k);old.evidence.push('library-guide','library-loans','recommend-reason');old.asked=['input','notice'];old.completed=completed;
  old.judgments.library=['different',null,null];old.reflections.library={q1:'옛 도서관',q2:''};old.finalNote='끝';old.reporter={name:'하늘',number:'10203'};
  old.reflections.face={q1:'점검표',q2:''};
  s=E.restore(JSON.stringify(old));
  assert.equal(s.version,6);assert.equal(s.scene,E.sceneOf('camp','hook'),'scene '+scene);assert.equal(s.furthest,s.scene);assert.equal(s.completed,false);assert.deepEqual(s.asked,[]);
  assert.ok(s.evidence.every(id=>OLD3.some(k=>E.checks[k].includes(id))),'old case 4·5 records dropped');
  for(const k of OLD3){assert.deepEqual(s.judgments[k],old.judgments[k]);assert.deepEqual(s.cases[k],old.cases[k]);assert.deepEqual(s.notices[k],old.notices[k]);}
  assert.deepEqual(s.reflections.face,{q1:'점검표',q2:''});assert.equal(s.finalNote,'끝');assert.deepEqual(s.reporter,{name:'하늘',number:'10203'});
  for(const k of ['camp','share']){assert.deepEqual(s.cases[k],{first:null,final:null});assert.deepEqual(s.judgments[k],[null,null,null]);assert.deepEqual(s.reflections[k],{q1:'',q2:''});}
  assert.equal('library' in s.cases,false);assert.deepEqual(E.restore(JSON.stringify(s)),s,'round-trips as version 6');
  assert.equal(E.canAdvance(s),false,'must ask the 구청 first');}
 // 옛 질문 목록에도 없는 질문은 손상
 old=v5(9,9);doneCase(old,'photo');old.asked=['zzz'];assert.deepEqual(E.restore(old),E.initial());
 old=v5(9,9);old.evidence=['zzz-id'];assert.deepEqual(E.restore(old),E.initial());
});
