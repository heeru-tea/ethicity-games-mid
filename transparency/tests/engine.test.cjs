const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
const at=(scene,fn)=>{let s=E.initial();s.scene=scene;s.furthest=scene;return fn?fn(s):s;};
function checkAll(s,key){for(const id of E.checks[key])s=E.reduce(s,{type:'check',id});return s;}
function judgeAll(s,key){for(const st of E.answers[key])s=E.reduce(s,{type:'judge',stamp:st});return s;}

test('scene layout: seven steps per case (notice between follow-up and reflect), prologue, ending and report',()=>{
 assert.equal(E.END,22);assert.equal(E.REPORT,23);
 assert.deepEqual([0,1,2,3,4,5,6,7,8,14,15,20,21,22,23].map(E.stepOf),['intro','hook','check','choose','result','follow','notice','reflect','hook','reflect','hook','notice','reflect','end','report']);
 assert.deepEqual([1,7,8,14,15,21].map(E.caseKey),['photo','photo','writing','writing','face','face']);
 assert.equal(E.sceneOf('face','choose'),17);
 for(const k of E.CASES)assert.equal(E.sceneOf(k,'notice'),E.sceneOf(k,'follow')+1,k);
});
// 미리 알리기: 학생이 AI를 내놓는 쪽이 되어 안내문 카드를 고른다.
const notice=k=>{const n=E.noticeCards[k];return {must:n.must,nice:n.nice,conflict:n.conflict,promise:n.promise};};
const atNotice=k=>at(E.sceneOf(k,'notice'),s=>{for(const c of E.CASES.slice(0,E.CASES.indexOf(k)+1))s.cases[c]={first:E.choices[c][0],final:E.choices[c][0]};return s;});
test('notice cards: 2~3 must, 1 nice, 1 conflict, 1 promise per case, ids unique',()=>{
 for(const k of E.CASES){const n=notice(k);assert.ok(n.must.length>=2&&n.must.length<=3,k);for(const t of ['nice','conflict','promise'])assert.equal(n[t].length,1,k+' '+t);
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
 assert.equal(D.notice.principle,'안내문은 잘못된 조치를 대신하지 않아. 그래도 미리 알리는 건 따로 해야 할 일이야.');
 assert.ok(D.cases.face.notice.lines.some(([,t])=>t==='가게 입구에는 얼굴 인식을 쓴다는 안내가 없었어.'),'bakery intro line');
 for(const k of E.CASES){const n=D.cases[k].notice,ids=n.cards.map(c=>c.id);
  assert.deepEqual([...ids].sort(),[...E.noticeIds(k)].sort(),k+' same cards');
  assert.ok(n.title&&n.paper,k);assert.ok(!(E.noticeKind(k,ids[0])==='must'&&E.noticeKind(k,ids[1])==='must'),'must cards do not open the list together');
  for(const c of n.cards){assert.ok(c.text.length>4&&c.text.length<=30,c.id+' short');if(E.noticeKind(k,c.id)==='conflict')assert.ok(c.clash&&c.clash.length>10,c.id+' clash reason');}
  const all=[n.title,n.paper,...n.lines.map(l=>l[1]),...n.cards.flatMap(c=>[c.text,c.clash||''])].join(' ');assert.doesNotMatch(all,DASH_EMOJI,k+' no em dash or emoji');}
 const g=D.notice;assert.doesNotMatch(JSON.stringify(g),DASH_EMOJI);for(const kind of ['must','nice','conflict','promise'])assert.ok(g.kinds[kind]&&g.fb[kind],kind);
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
 assert.deepEqual(s.reflections,{photo:{q1:'원본 사진',q2:''},writing:{q1:'',q2:''},face:{q1:'',q2:''}});
 s=E.reduce(s,{type:'reflect',key:'photo',q:'q2',text:'가'.repeat(5000)});assert.equal(s.reflections.photo.q2.length,4000,'no hard limit in UI, only a storage cap');
 const t=at(2);assert.deepEqual(E.reduce(t,{type:'reflect',key:'photo',q:'q1',text:'x'}).reflections.photo.q1,'','only on the reflect screen');
});
test('ending: final note needs the question first, then the report opens; reporter fields are cleaned',()=>{
 let s=at(E.END);for(const k of E.CASES)s.cases[k]={first:E.choices[k][0],final:E.choices[k][0]};
 s=E.reduce(s,{type:'note',text:'먼저'});assert.equal(s.finalNote,'');assert.equal(E.reduce(s,{type:'next'}).scene,E.END,'report locked before the question');
 s=E.reduce(s,{type:'ask',id:'input'});s=E.reduce(s,{type:'note',text:'어떤 정보를 쓰는지'});assert.equal(s.finalNote,'어떤 정보를 쓰는지');
 s=E.reduce(s,{type:'next'});assert.equal(s.scene,E.REPORT);assert.equal(E.reduce(s,{type:'next'}).scene,E.REPORT);
 s=E.reduce(s,{type:'reporter',field:'name',text:'김\n하늘'});s=E.reduce(s,{type:'reporter',field:'number',text:'10203'});s=E.reduce(s,{type:'reporter',field:'x',text:'y'});
 assert.deepEqual(s.reporter,{name:'김하늘',number:'10203'});
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
test('revisit cannot jump past the furthest scene; ending needs choices then a question',()=>{
 let s=at(3);s=E.reduce(s,{type:'revisit',scene:10});assert.equal(s.scene,3);
 s=at(E.END);s=E.reduce(s,{type:'ask',id:'input'});assert.equal(s.completed,false);
 for(const k of E.CASES)s.cases[k]={first:E.choices[k][0],final:E.choices[k][0]};
 s=E.reduce(s,{type:'ask',id:'criteria'});assert.equal(s.completed,true);
});
