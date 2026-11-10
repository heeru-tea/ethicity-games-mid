const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
const at=(scene,fn)=>{let s=E.initial();s.scene=scene;s.furthest=scene;return fn?fn(s):s;};
function checkAll(s,key){for(const id of E.checks[key])s=E.reduce(s,{type:'check',id});return s;}
function judgeAll(s,key){for(const st of E.answers[key])s=E.reduce(s,{type:'judge',stamp:st});return s;}

test('scene layout: five cases of seven steps (notice between follow-up and reflect), prologue, ending and report',()=>{
 assert.deepEqual(E.CASES,['photo','writing','face','camp','share']);
 assert.equal(E.END,36);assert.equal(E.REPORT,37);
 assert.deepEqual([0,1,2,3,4,5,6,7,8,14,15,20,21,22,28,29,35,36,37].map(E.stepOf),['intro','hook','check','choose','result','follow','notice','reflect','hook','reflect','hook','notice','reflect','hook','reflect','hook','reflect','end','report']);
 assert.deepEqual([1,7,8,14,15,21,22,28,29,35].map(E.caseKey),['photo','photo','writing','writing','face','face','camp','camp','share','share']);
 assert.equal(E.sceneOf('camp','hook'),22);assert.equal(E.sceneOf('share','follow'),33);
 assert.equal(E.sceneOf('face','choose'),17);
 for(const k of E.CASES)assert.equal(E.sceneOf(k,'notice'),E.sceneOf(k,'follow')+1,k);
});
// 미리 알리기: 학생이 AI를 내놓는 쪽이 되어 안내문 카드를 고른다.
const notice=k=>{const n=E.noticeCards[k];return {must:n.must,nice:n.nice,conflict:n.conflict,promise:n.promise};};
const atNotice=k=>at(E.sceneOf(k,'notice'),s=>{for(const c of E.CASES.slice(0,E.CASES.indexOf(k)+1))s.cases[c]={first:E.choices[c][0],final:E.choices[c][0]};return s;});
test('notice cards: 2~3 must, 1~2 nice, 1 conflict, 1 promise per case, ids unique',()=>{
 for(const k of E.CASES){const n=notice(k);assert.ok(n.must.length>=2&&n.must.length<=3,k);assert.ok(n.nice.length>=1&&n.nice.length<=2,k+' nice');for(const t of ['conflict','promise'])assert.equal(n[t].length,1,k+' '+t);
  const ids=E.noticeIds(k);assert.equal(new Set(ids).size,ids.length);assert.ok(ids.length>=5&&ids.length<=6);for(const id of ids)assert.ok(['must','nice','conflict','promise'].includes(E.noticeKind(k,id)));}
});
test('notice step: picking toggles cards, posting needs a card, posting once opens the next step, re-pick anytime',()=>{
 const k='writing',n=notice(k);let s=atNotice(k);
 assert.equal(E.stepOf(s.scene),'notice');assert.deepEqual(s.notices[k],{picked:[],posted:null});assert.equal(E.canAdvance(s),false);
 s=E.reduce(s,{type:'notice-post'});assert.equal(s.notices[k].posted,null,'nothing to post');
 s=E.reduce(s,{type:'notice-pick',id:n.must[0]});s=E.reduce(s,{type:'notice-pick',id:n.conflict[0]});s=E.reduce(s,{type:'notice-pick',id:E.noticeCards.photo.must[0]});s=E.reduce(s,{type:'notice-pick',id:'zzz'});
 assert.deepEqual(s.notices[k].picked,[n.must[0],n.conflict[0]],'other case cards and unknown ids ignored');assert.deepEqual(s.notices.photo.picked,[]);
 s=E.reduce(s,{type:'notice-pick',id:n.conflict[0]});assert.deepEqual(s.notices[k].picked,[n.must[0]],'second press removes');
 assert.equal(E.reduce(s,{type:'next'}).scene,s.scene,'not posted yet');
 s=E.reduce(s,{type:'notice-post'});assert.deepEqual(s.notices[k].posted,[n.must[0]]);assert.equal(E.canAdvance(s),true,'posting once is enough, even if not all right');
 s=E.reduce(s,{type:'notice-pick',id:n.must[1]});assert.deepEqual(s.notices[k].posted,[n.must[0]],'posted notice stays until posted again');assert.equal(E.canAdvance(s),true);
 s=E.reduce(s,{type:'notice-post'});assert.deepEqual(s.notices[k].posted,[n.must[0],n.must[1]]);
 const back=E.reduce(s,{type:'revisit',scene:E.sceneOf(k,'follow')});assert.deepEqual(E.reduce(back,{type:'notice-pick',id:n.nice[0]}).notices[k],s.notices[k],'only on the notice screen');
 const nx=E.reduce(s,{type:'next'});assert.equal(E.stepOf(nx.scene),'reflect');assert.equal(E.caseKey(nx.scene),k);
});
const D=(()=>{global.window={};require('../story.js');return global.window.TransparencyStory;})();
const DASH_EMOJI=/[—–]|\p{Extended_Pictographic}/u;
test('notice copy: story cards match engine kinds, conflict cards explain the clash, fixed lines as approved',()=>{
 assert.equal(D.notice.principle,'안내문이 잘못된 조치를 바로잡아 주지는 않아. 그래도 미리 알리는 건 따로 해야 할 일이야.');
 assert.ok(D.cases.face.notice.lines.some(([,t])=>t==='가게 입구에는 얼굴 인식을 쓴다는 안내가 없었어.'),'bakery intro line');
 for(const k of E.CASES){const n=D.cases[k].notice,ids=n.cards.map(c=>c.id);
  assert.deepEqual([...ids].sort(),[...E.noticeIds(k)].sort(),k+' same cards');
  assert.ok(n.title&&n.paper,k);assert.ok(!(E.noticeKind(k,ids[0])==='must'&&E.noticeKind(k,ids[1])==='must'),'must cards do not open the list together');
  for(const c of n.cards){assert.ok(c.text.length>4&&c.text.length<=30,c.id+' short');if(E.noticeKind(k,c.id)==='conflict')assert.ok(c.clash&&c.clash.length>10,c.id+' clash reason');}
  const all=[n.title,n.paper,...n.lines.map(l=>l[1]),...n.cards.flatMap(c=>[c.text,c.clash||''])].join(' ');assert.doesNotMatch(all,DASH_EMOJI,k+' no em dash or emoji');}
 const g=D.notice;assert.doesNotMatch(JSON.stringify(g),DASH_EMOJI);for(const kind of ['must','nice','conflict','promise'])assert.ok(g.kinds[kind]&&g.fb[kind],kind);
});
// 사건 4 궁금한 것: 구청에 묻기(옛 사건 5 질문 장치를 옮김). 하나 이상 물어야 직접 확인으로 간다.
test('case 4 hook: asking the 구청 at least one question opens the check; questions are kept in order without repeats',()=>{
 assert.deepEqual(E.questions,['purpose','criteria','who','appeal']);
 const hook=E.sceneOf('camp','hook');let s=at(hook,s=>{for(const c of E.CASES.slice(0,3))s.cases[c]={first:E.choices[c][0],final:E.choices[c][0]};return s;});
 assert.deepEqual(s.asked,[]);assert.equal(E.canAdvance(s),false,'ask first');assert.equal(E.reduce(s,{type:'next'}).scene,hook);
 s=E.reduce(s,{type:'ask',id:'input'});assert.deepEqual(s.asked,[],'old app questions are gone');
 s=E.reduce(s,{type:'ask',id:'appeal'});s=E.reduce(s,{type:'ask',id:'purpose'});s=E.reduce(s,{type:'ask',id:'appeal'});
 assert.deepEqual(s.asked,['appeal','purpose']);assert.equal(E.canAdvance(s),true);assert.equal(s.completed,false);
 assert.equal(E.stepOf(E.reduce(s,{type:'next'}).scene),'check');
 assert.deepEqual(E.reduce(at(E.sceneOf('share','hook')),{type:'ask',id:'who'}).asked,[],'only on the case 4 hook');
 assert.equal(E.canAdvance(at(E.sceneOf('share','hook'))),true,'case 5 has no question gate');
});
test('cases 4 and 5: records, choices, judgments (each stamp once), follow-up marks',()=>{
 assert.deepEqual(E.checks.camp,['camp-page','camp-results','camp-criteria']);assert.deepEqual(E.checks.share,['share-log','share-photo','share-compare']);
 assert.deepEqual(E.choices.camp,['loud','accurate','quiet']);assert.deepEqual(E.choices.share,['keep','tag','explain']);
 assert.deepEqual(E.answers.camp,['unknown','different','confirmed']);assert.deepEqual(E.answers.share,['different','confirmed','unknown']);
 assert.equal(E.followAnswers.camp,'different');assert.equal(E.followAnswers.share,'different');
 assert.deepEqual(E.followMarks.camp,{ids:['changed'],values:['found']});assert.deepEqual(E.followMarks.share,{ids:['dm','post','board'],values:['open']});
 // 사건 4 한 바퀴: 질문 → 자료 셋 → 판단 셋 → 선택 → 후속 조사 → 미리 알리기 → 생각 정리 → 사건 5
 let s=at(E.sceneOf('camp','check'),s=>{for(const c of E.CASES.slice(0,3))s.cases[c]={first:E.choices[c][0],final:E.choices[c][0]};s.asked=['who'];return s;});
 s=judgeAll(checkAll(s,'camp'),'camp');assert.equal(E.canAdvance(s),true);s=E.reduce(s,{type:'next'});
 s=E.reduce(s,{type:'choose',id:'accurate'});assert.equal(E.stepOf(s.scene),'result');s=E.reduce(s,{type:'next'});
 assert.equal(E.canAdvance(s),false);s=E.reduce(s,{type:'mark',id:'changed',value:'found'});s=E.reduce(s,{type:'follow-judge',stamp:'different'});s=E.reduce(s,{type:'next'});
 assert.equal(E.stepOf(s.scene),'notice');s=E.reduce(s,{type:'notice-pick',id:E.noticeCards.camp.must[0]});s=E.reduce(s,{type:'notice-post'});s=E.reduce(s,{type:'next'});
 assert.equal(E.stepOf(s.scene),'reflect');s=E.reduce(s,{type:'next'});assert.equal(s.scene,E.sceneOf('share','hook'));
 // 사건 5 후속 조사: 세 곳을 모두 열어야 판단
 s=at(E.sceneOf('share','follow'),s=>{for(const c of E.CASES)s.cases[c]={first:E.choices[c][0],final:E.choices[c][0]};s.asked=['who'];return s;});
 s=E.reduce(s,{type:'mark',id:'dm',value:'open'});s=E.reduce(s,{type:'mark',id:'post',value:'open'});s=E.reduce(s,{type:'follow-judge',stamp:'different'});assert.equal(s.follows.share.judgment,null);
 s=E.reduce(s,{type:'mark',id:'board',value:'open'});s=E.reduce(s,{type:'follow-judge',stamp:'different'});assert.equal(E.canAdvance(s),true);
});
test('ending: entering it after the case 5 reflection completes the game; the final note only there',()=>{
 const last=E.sceneOf('share','reflect');let s=at(last,s=>{for(const c of E.CASES)s.cases[c]={first:E.choices[c][0],final:E.choices[c][0]};s.asked=['who'];return s;});
 assert.equal(s.completed,false);s=E.reduce(s,{type:'note',text:'먼저'});assert.equal(s.finalNote,'','not on the reflect screen');
 s=E.reduce(s,{type:'next'});assert.equal(s.scene,E.END);assert.equal(s.completed,true);assert.equal(E.canAdvance(s),true);
 const back=E.reduce(E.reduce(s,{type:'revisit',scene:last}),{type:'next'});assert.equal(back.completed,true,'stays completed');
});
// 사건 4·5 문장(교사 검수 대기)의 구조: engine id와 맞고, 판단 근거는 그 사건의 자료, 사건 5는 혼자 규칙(모아 해설 없음, 판단은 한 줄)
test('cases 4 and 5 copy: ids match the engine, judgment sources are records of the case, case 5 has no 모아 lines',()=>{
 for(const k of ['camp','share']){const c=D.cases[k];
  assert.ok(c.title&&c.question&&c.hook.length&&c.cast.length===3,k);assert.deepEqual(c.checks.map(x=>x.id),E.checks[k]);assert.deepEqual(c.choose.options.map(o=>o.id),E.choices[k]);
  for(const x of c.checks)assert.ok(x.label&&x.name&&x.task&&x.fact,x.id);
  assert.equal(c.judges.length,3);for(const j of c.judges){assert.ok(j.src.length&&j.src.every(id=>E.checks[k].includes(id)),k+' src');assert.ok(D.names[j.who],j.who);}
  assert.ok(c.follow.question&&c.follow.task&&c.follow.unknown&&c.follow.fact&&c.follow.judge.text,k+' follow');
  assert.ok(c.reflect&&/___/.test(c.reflect.q1)&&/___/.test(c.reflect.q2),k+' own reflect frames');
  for(const o of c.choose.options)assert.ok(o.screen&&o.screen.length>=2,o.id+' screen card');
  for(const n of c.cast)assert.ok(D.names[n]&&D.art[n],n);
  const all=JSON.stringify(c);assert.doesNotMatch(all,DASH_EMOJI,k+' no em dash or emoji');assert.doesNotMatch(all,/인스타|Instagram|카카오|카톡/,k+' no real brand');}
 const C=D.cases.camp,S=D.cases.share;
 assert.deepEqual(C.asks.map(a=>a[0]),E.questions);assert.equal(C.askWho,'office');assert.equal(D.names.office,'구청 청소년과');
 assert.equal(C.page.rows.filter(x=>x.blank).length,2);
 const sol=C.results.rows.find(r=>r.target);assert.equal(sol.name,'솔숲마을');for(const r of C.results.rows)if(!r.target)assert.ok(r.pass/r.apply>sol.pass/sol.apply);
 assert.equal(C.criteria.rows.reduce((a,r)=>a+r.w,0).toFixed(1),'1.0');assert.equal(C.criteria.rows.filter(r=>r.hidden).length,1);assert.equal(Math.max(...C.criteria.rows.map(r=>r.w)),C.criteria.rows.find(r=>r.top).w);
 for(const j of [...C.judges,C.follow.judge])assert.ok(j.right&&j.wrong,'case 4 has right/wrong feedback');
 assert.equal(C.follow.segments.filter(x=>x.changed).length,2);for(const o of C.choose.options)assert.ok(o.feedback,o.id+' 모아 feedback');
 assert.equal(S.solo,true);assert.equal(S.soloNote,'이번에는 모아 혼자야. 확인하고, 정해 봐.');
 for(const j of [...S.judges,S.follow.judge]){assert.match(j.sum,/^기록과 맞춰 보면: /);assert.equal(j.right,undefined);assert.notEqual(j.who,'moa');}
 assert.ok(!S.hook.some(([w])=>w==='moa')&&!S.checks.some(x=>x.finding)&&!S.choose.options.some(o=>o.feedback||o.status)&&!S.follow.lines.some(([w])=>w==='moa'),'case 5: no 모아 lines, findings, feedback or status');
 assert.equal(S.log.filter(x=>x.target).length,1);assert.equal(S.photos.lines.filter(x=>x.target).length,1);assert.equal(S.compare.dm.target,true);
 assert.deepEqual(S.follow.places.map(p=>p.id),E.followMarks.share.ids);
 assert.ok(S.notice.principle&&S.notice.principle!==D.notice.principle,'case 5 has its own fixed line');
});
test('ending: three actors in the closing, four discussion questions; five cases in the prologue',()=>{
 assert.equal(D.ending.lines.length,2);assert.equal(D.ending.quote,'상자를 여는 첫 번째 도구는, 질문이었다.');
 assert.match(D.ending.closing[1],/만드는 쪽/);
 assert.equal(D.ending.discussion.length,4);assert.equal(D.ending.discussion[2],'AI로 만든 것을 나눌 때, 어디에 얼마나 알려야 할까?');
 assert.match(D.intro.plan,/^사건은 다섯 개야\./);
 for(const key of Object.keys(D.art.newArt))if(!D.art.newArt[key].code)assert.ok(D.art[key],key+' has a fallback picture');assert.equal(D.art.backgrounds.length,6);assert.equal(D.bgNames.length,6);
});
test('notice verdict: all must in and no conflict or promise = ok; nice does not change the verdict',()=>{
 for(const k of E.CASES){const n=notice(k);
  assert.deepEqual(E.noticeCheck(k,n.must),{ok:true,missing:[],conflicts:[],promises:[],extras:[]},k);
  assert.equal(E.noticeCheck(k,[...n.must,...n.nice]).ok,true,'nice is extra');assert.deepEqual(E.noticeCheck(k,[...n.must,...n.nice]).extras,n.nice);
  const miss=E.noticeCheck(k,n.must.slice(1));assert.equal(miss.ok,false);assert.deepEqual(miss.missing,[n.must[0]]);
  const clash=E.noticeCheck(k,[...n.must,...n.conflict]);assert.equal(clash.ok,false);assert.deepEqual(clash.conflicts,n.conflict);
  const prom=E.noticeCheck(k,[...n.must,...n.promise]);assert.equal(prom.ok,false);assert.deepEqual(prom.promises,n.promise);
  assert.equal(E.noticeCheck(k,E.noticeIds(k)).ok,false,'picking everything is not right');}
});
test('reflect step: two free-text answers per case, empty is allowed, other cases untouched',()=>{
 let s=at(E.sceneOf('photo','reflect'),s=>{s.cases.photo={first:'auto',final:'auto'};return s;});
 assert.equal(E.canAdvance(s),true,'empty reflection can move on');
 s=E.reduce(s,{type:'reflect',key:'photo',q:'q1',text:'원본 사진'});s=E.reduce(s,{type:'reflect',key:'writing',q:'q1',text:'x'});s=E.reduce(s,{type:'reflect',key:'photo',q:'q9',text:'x'});
 assert.deepEqual(s.reflections,{...E.initial().reflections,photo:{q1:'원본 사진',q2:''}});
 s=E.reduce(s,{type:'reflect',key:'photo',q:'q2',text:'가'.repeat(5000)});assert.equal(s.reflections.photo.q2.length,4000,'no hard limit in UI, only a storage cap');
 const t=at(2);assert.deepEqual(E.reduce(t,{type:'reflect',key:'photo',q:'q1',text:'x'}).reflections.photo.q1,'','only on the reflect screen');
});
test('ending: final note needs a completed game, then the report opens; reporter fields are cleaned',()=>{
 let s=at(E.END);for(const k of E.CASES)s.cases[k]={first:E.choices[k][0],final:E.choices[k][0]};
 s=E.reduce(s,{type:'note',text:'먼저'});assert.equal(s.finalNote,'');assert.equal(E.reduce(s,{type:'next'}).scene,E.END,'report locked before the game is completed');
 s.completed=true;s=E.reduce(s,{type:'note',text:'어떤 정보를 쓰는지'});assert.equal(s.finalNote,'어떤 정보를 쓰는지');
 s=E.reduce(s,{type:'next'});assert.equal(s.scene,E.REPORT);assert.equal(E.reduce(s,{type:'next'}).scene,E.REPORT);
 s=E.reduce(s,{type:'reporter',field:'name',text:'김\n하늘'});s=E.reduce(s,{type:'reporter',field:'number',text:'10203'});s=E.reduce(s,{type:'reporter',field:'x',text:'y'});
 assert.deepEqual(s.reporter,{name:'김하늘',number:'10203'});
});
test('restart: clears progress; name/학번 erased by default, kept only when asked',()=>{
 let s=at(E.REPORT);s.completed=true;s.reflections.photo.q1='메모';s.reporter={name:'하늘',number:'10203'};
 assert.deepEqual(E.restart(s),E.initial(),'default erases name and number too');
 assert.deepEqual(E.restart(s,{keepReporter:false}),E.initial());
 const kept=E.restart(s,{keepReporter:true});assert.deepEqual(kept,{...E.initial(),reporter:{name:'하늘',number:'10203'}},'only reporter kept');
 assert.notEqual(kept.reporter,s.reporter,'copied, not shared');assert.deepEqual(E.restore(JSON.stringify(kept)),kept,'kept reporter survives save/restore');
});
test('each case has three judgments and each stamp is the answer exactly once',()=>{
 for(const k of E.CASES){assert.equal(E.answers[k].length,3);assert.deepEqual([...E.answers[k]].sort(),[...E.stamps].sort(),k);}
 assert.ok(E.CASES.length*3+Object.keys(E.followAnswers).length>=12);
});
test('check step needs every record and all three judgments before choosing',()=>{
 let s=at(2);s=E.reduce(s,{type:'judge',stamp:'confirmed'});assert.deepEqual(s.judgments.photo,[null,null,null],'cannot judge before checking');
 s=E.reduce(s,{type:'check',id:'photo-original'});s=E.reduce(s,{type:'check',id:'writing-guide'});assert.deepEqual(s.evidence,['photo-original']);
 s=E.reduce(s,{type:'check',id:'photo-rule'});
 s=E.reduce(s,{type:'judge',stamp:'unknown'});s=E.reduce(s,{type:'judge',stamp:'different'});assert.equal(E.canAdvance(s),false);
 s=E.reduce(s,{type:'judge',stamp:'confirmed'});assert.deepEqual(s.judgments.photo,['unknown','different','confirmed']);assert.equal(E.canAdvance(s),true);
 s=E.reduce(s,{type:'judge',stamp:'unknown'});assert.deepEqual(s.judgments.photo,['unknown','different','confirmed'],'picks are locked');
});
test('choosing moves to the result; first choice survives a later change',()=>{
 const ch=E.sceneOf('face','choose');
 let s=judgeAll(checkAll(at(ch-1),'face'),'face');s=E.reduce(s,{type:'next'});assert.equal(s.scene,ch);
 s=E.reduce(s,{type:'choose',id:'maintain'});assert.equal(s.scene,ch+1);assert.equal(E.outcome(s,'face').restricted,true);
 s=E.reduce(s,{type:'revisit',scene:ch});s=E.reduce(s,{type:'choose',id:'release'});
 assert.deepEqual(s.cases.face,{first:'maintain',final:'release'});assert.equal(E.outcome(s,'face').restricted,false);
});
test('follow-up needs every mark, then one judgment; marks lock after judging',()=>{
 let s=at(5);s.cases.photo={first:'auto',final:'auto'};
 s=E.reduce(s,{type:'follow-judge',stamp:'different'});assert.equal(s.follows.photo.judgment,null);
 E.followMarks.photo.ids.forEach((id,i)=>{s=E.reduce(s,{type:'mark',id,value:E.truth[i]});});
 s=E.reduce(s,{type:'mark',id:'p9',value:'cut'});assert.equal(s.follows.photo.marks.p9,undefined);
 assert.equal(E.canAdvance(s),false);s=E.reduce(s,{type:'follow-judge',stamp:'different'});assert.equal(E.canAdvance(s),true);
 s=E.reduce(s,{type:'mark',id:'p1',value:'shown'});assert.equal(s.follows.photo.marks.p1,E.truth[0],'locked');
 s=E.reduce(s,{type:'next'});assert.equal(s.scene,6);assert.equal(E.stepOf(s.scene),'notice','follow-up leads to the notice screen');
});
test('follow-up photos: 담이 is cut in 3 of 6 and other friends are cut too',()=>{
 assert.equal(E.truth.filter(t=>t==='cut').length,3);
 const counts=[0,0,0,0,0];for(const r of E.FOLLOW_CROPS)for(const i of E.cutFaces(r))counts[i]++;
 assert.ok(counts.some((n,i)=>i!==2&&n>=3),'another friend is cut at least as often');assert.equal(E.followAnswers.photo,'different');
 for(const [x,y,w,h] of E.FOLLOW_CROPS){assert.ok(x+w<=1536&&y+h<=1024);assert.equal(Math.round(w/h*100),150);}
});
test('photo outcomes are real crops: automatic leaves 담이 out, the full choice includes all five',()=>{
 assert.equal(E.allFaces(E.AUTO),false);assert.equal(E.allFaces(E.ALL),true);assert.ok(E.cutFaces(E.AUTO).includes(2));
});
test('revisit cannot jump past the furthest scene',()=>{
 let s=at(3);s=E.reduce(s,{type:'revisit',scene:10});assert.equal(s.scene,3);
});
// ── 2026-11-10 외부 검토(review.md) 반영 ──
// 1. 사건 4 자료는 마을별 집계·항목 비중·버스 횟수뿐이다. 담이 한 사람이 왜 떨어졌는지(참여 횟수·항목별 점수·합격선)는 자료에 없으므로
//    결과·수첩·서술 틀 어디에서도 '개인 탈락 이유를 알았다'고 말하지 않는다.
test('review 1: case 4 never claims 담이\'s own reason is known; the record-matching result names a criterion that may be unfavourable and asks for a re-check',()=>{
 const C=D.cases.camp,all=JSON.stringify(C);
 assert.doesNotMatch(all,/왜 떨어졌는지[^”"']{0,12}알(겠|았|게 됐)/,'no "now I know why I failed"');
 const acc=C.choose.options.find(o=>o.id==='accurate'),said=acc.reaction.filter(([w])=>w==='dami').map(l=>l[1]).join(' ');
 assert.match(said,/불리할 수 있는 기준/);assert.match(said,/내 점수도 다시 확인받고 싶어/);
 // 자료에는 담이 개인 기록이 없다(있다면 이 검사를 함께 고친다)
 assert.deepEqual(Object.keys(C.results.rows[0]).sort(),['apply','id','name','pass']);assert.ok(!/담이/.test(JSON.stringify([C.page,C.results,C.criteria])));
 // 솔숲마을은 12명 가운데 1명이 붙었다: '다 떨어졌다'가 아니라 '거의 다'
 const pine=C.results.rows.find(r=>r.target);assert.ok(pine.pass>0);
 for(const [,t] of [...C.hook,...C.choose.options.flatMap(o=>o.reaction)])if(/떨어/.test(t)&&/(^|\s)다 떨어/.test(t))assert.match(t,/거의 다 떨어/,t);
 // 아직 모르는 것은 그대로 모른다고 말한다
 assert.match(C.follow.unknown,/아직 몰라/);assert.match(C.reflect.q2,/아직 확인하지 못한 것/);
});
// 2. 사진 사건 문장에 든 범위 말(만·모두·전부·늘·다)을 실제 자르기 좌표(engine AUTO·ALL·faces·FOLLOW_CROPS)와 맞춰 본다.
//    새 문장에 범위 말이 들어가면 아래 표에 '무엇으로 확인했는지'를 적어야 통과한다.
test('review 2: photo sentences with range words (만·모두·늘·다) agree with the real crops',()=>{
 const W=1536,H=1024,FULL=[0,0,W,H],TORI=0,LULU=1,DAMI=2,P=D.cases.photo;
 const overlaps=([x,y,w,h],[fx,fy,fw,fh])=>fx<x+w&&fx+fw>x&&fy<y+h&&fy+fh>y;
 const cx=f=>f[0]+f[2]/2,bottom=f=>f[1]+f[3];
 const counts=[0,0,0,0,0];for(const r of E.FOLLOW_CROPS)for(const i of E.cutFaces(r))counts[i]++;
 const shownIn=E.truth.filter(t=>t==='shown').length,cutIn=E.truth.filter(t=>t==='cut').length;
 // 도입: 자동으로 자른 사진에서 얼굴이 잘린 친구는 넷이다. '담이 얼굴만'은 사실이 아니고, 담이 얼굴은 조금도 남지 않는다.
 assert.deepEqual(E.cutFaces(E.AUTO),[0,1,2,3]);
 assert.equal(D.intro.title,'다섯 친구가 찍은 사진에서, 담이 얼굴이 사라졌다.');
 assert.equal(overlaps(E.AUTO,E.faces[DAMI]),false,'담이 얼굴은 자동으로 자른 사진에 조금도 남지 않는다');
 const allIn=r=>E.cutFaces(r).length===0;
 const front=()=>{assert.equal(Math.max(...E.faces.map(bottom)),bottom(E.faces[DAMI]),'앞줄: 다섯 얼굴 가운데 가장 아래');
  assert.equal([...E.faces].sort((a,b)=>cx(a)-cx(b)).indexOf(E.faces[DAMI]),2,'가운데: 왼쪽에서 셋째');
  assert.equal(Math.min(...E.faces.map(f=>Math.abs(cx(f)-W/2))),Math.abs(cx(E.faces[DAMI])-W/2),'가운데: 사진 가운데에 가장 가깝다');};
 const notCrop=()=>{}; // 자르기 범위가 아닌 것(기록·안내문 카드)을 말하는 문장
 const audited={
  '이 마을과 자료는 창작이에요. 실제 사례에서 문제의 구조만 참고했어요.':notCrop,
  '원본 사진에는 다섯 친구가 모두 있고, 담이는 앞줄 가운데에 있다.':()=>{assert.ok(allIn(FULL));front();},
  '원본에는 다섯 친구가 모두 나와요. 자동으로 자른 사진에는 오른쪽 부분만 남았어요.':()=>{assert.ok(allIn(FULL));assert.ok(E.AUTO[0]>=W/2,'자동으로 남긴 부분은 모두 사진 오른쪽 절반 안');},
  '기록에는 점수만 있어. 왜 오른쪽이 8점인지는 어디에도 없어.':notCrop,
  '모두 나오는 사진':()=>assert.ok(allIn(E.ALL)),
  '모두 나오는 사진을 올렸어':()=>assert.ok(allIn(E.ALL)),
  '게시판: 다섯 친구가 모두 나온 사진':()=>{assert.ok(allIn(E.ALL));assert.equal(E.faces.length,5);},
  '이제 다 보여. 이게 우리가 올리고 싶던 사진이야.':()=>assert.ok(allIn(E.ALL)),
  '같은 날 찍은 사진 여섯 장도 앱이 모두 자동으로 잘랐어.':()=>{assert.equal(E.FOLLOW_CROPS.length,6);for(const r of E.FOLLOW_CROPS)assert.ok(r[2]<W&&r[3]<H,'여섯 장 모두 원본보다 작게 잘렸다');},
  // 판단할 말(일부러 틀린 주장): 정답이 '자료와 달라'여야 하고, 실제로 담이가 나온 사진이 있고 다른 친구도 잘린다.
  '여섯 장을 보니, 이 AI는 담이만 늘 잘라.':()=>{assert.equal(E.followAnswers.photo,'different');assert.ok(shownIn>0,'늘 잘리지는 않는다');assert.ok(counts.some((n,i)=>i!==DAMI&&n>0),'담이만 잘리지는 않는다');},
  'AI가 늘 가장 좋은 사진을 골라 줘요.':()=>assert.equal(E.noticeKind('photo','photo-best'),'promise'), // 지킬 수 없는 약속 카드
  '점수 계산식을 전부 공개해요.':()=>assert.equal(E.noticeKind('photo','photo-formula'),'conflict'), // 부딪침 카드
  '알리는 것도 좋지만, 계산식은 너무 어려워 오히려 안 읽히고 회사 기술 비밀과도 부딪쳐. 알리되 기준 요약만큼만.':notCrop
 };
 const texts=[];const walk=v=>{if(typeof v==='string')texts.push(v);else if(v&&typeof v==='object')Object.values(v).forEach(walk);};
 walk(D.intro);walk(P);
 const RANGE=/(?<!지)만(?=[\s.,?!”’)]|$)|모두|전부|(?<=^|\s)(늘|다)(?=\s)/;
 const found=texts.filter(t=>RANGE.test(t));
 assert.deepEqual(found.filter(t=>!audited[t]),[],'좌표와 맞춰 보지 않은 범위 말 문장');
 assert.deepEqual(Object.keys(audited).filter(t=>!found.includes(t)),[],'지금은 없는 문장이 표에 남아 있음');
 for(const t of found)audited[t]();
 // 후속 조사: 묻는 말에 '담이만'을 미리 깔지 않는다. 숫자를 말하는 피드백은 세어 본 값과 같다.
 assert.equal(P.follow.question,'다른 사진에서도 담이가 잘릴까?');
 const NUM=['영','한','두','세','네','다섯','여섯'];
 assert.equal(P.follow.judge.right,`맞아, 자료와 달라. 담이는 ${NUM[cutIn]} 장에서 잘렸지만 ${NUM[shownIn]} 장에서는 나왔고, 다른 친구들도 잘렸어.`);
 assert.equal(P.follow.judge.wrong,`세어 본 결과를 다시 봐. 담이는 ${NUM[shownIn]} 장에서 나왔고, 루루는 ${NUM[counts[LULU]]} 장에서 잘렸어.`);
 assert.ok(counts[TORI]>0);
 // 결과 화면의 상태 글: 자동 사진에는 담이 얼굴이 없다
 assert.equal(P.choose.options[0].status,'게시판: 담이 얼굴이 빠진 사진');assert.ok(E.cutFaces(E.outcome({cases:{photo:{final:'auto'}}},'photo').rect).includes(DAMI));
});
// 5. 부딪침(상충) 카드의 이유 문장: '…까지만 알리면 돼'처럼 그것만 알리면 충분하다고 읽히면 안 된다.
//    '공개하지 않을 정보'와 '그래도 알릴 수 있는 것'을 함께 말하고, 같은 사건의 꼭 필요 카드를 모두 가리킨다. 법적 의무를 단정하지 않는다.
test('review 5: clash reasons name what stays private and what can still be told, in line with the must cards',()=>{
 const clash=(k,id)=>D.cases[k].notice.cards.find(c=>c.id===id).clash;
 for(const k of E.CASES)for(const c of D.cases[k].notice.cards)if(c.clash){
  assert.doesNotMatch(c.clash,/까지만/,c.id);assert.doesNotMatch(c.clash,/만 (알리면|알 수 있으면) 돼/,c.id+' reads as "this alone is enough"');
  assert.doesNotMatch(c.clash,/의무|법으로|법에|반드시|해야만/,c.id+' no legal-duty claim');}
 // 꼭 필요 카드마다 이유 문장이 그 내용을 '알릴 수 있는 것'으로 가리키는지(카드 → 이유 문장에 있어야 할 말)
 const MUST={
  writing:{id:'writing-patterns',keep:/패턴은 공개하지 않아도/,told:{'writing-human':/사람이 쓴 글에도 표시가 뜰 수 있다는 것/,'writing-teacher':/선생님이 확인한다는 것/}},
  face:{id:'face-wall',keep:/사진은 공개하지 않아도/,told:{'face-use':/얼굴 인식을 쓴다는 것/,'face-staff':/직원이 확인한다는 것/,'face-report':/잘못 막혔을 때 알릴 곳/}},
  camp:{id:'camp-everyone',keep:/이름과 점수는 공개하지 않아도/,told:{'camp-role':/AI를 어디에 썼는지/,'camp-office':/담당 부서/,'camp-appeal':/재검토를 신청하는 방법/}}};
 for(const [k,m] of Object.entries(MUST)){const t=clash(k,m.id);
  assert.equal(E.noticeKind(k,m.id),'conflict');assert.deepEqual(Object.keys(m.told).sort(),[...E.noticeCards[k].must].sort(),k+' every must card is covered');
  assert.match(t,m.keep,k+' what stays private');assert.match(t,/알릴 수 있어/,k+' what can still be told');
  for(const [id,re] of Object.entries(m.told))assert.match(t,re,id);}
});
