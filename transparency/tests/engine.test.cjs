const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
const at=(scene,fn)=>{let s=E.initial();s.scene=scene;s.furthest=scene;return fn?fn(s):s;};
function checkAll(s,key){for(const id of E.checks[key])s=E.reduce(s,{type:'check',id});return s;}
function judgeAll(s,key){for(const st of E.answers[key])s=E.reduce(s,{type:'judge',stamp:st});return s;}

test('scene layout: five steps per case, prologue and ending',()=>{
 assert.equal(E.END,16);
 assert.deepEqual([0,1,2,3,4,5,6,10,11,15,16].map(E.stepOf),['intro','hook','check','choose','result','follow','hook','follow','hook','follow','end']);
 assert.deepEqual([1,5,6,10,11,15].map(E.caseKey),['photo','photo','writing','writing','face','face']);
 assert.equal(E.sceneOf('face','choose'),13);
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
 let s=judgeAll(checkAll(at(12),'face'),'face');s=E.reduce(s,{type:'next'});assert.equal(s.scene,13);
 s=E.reduce(s,{type:'choose',id:'maintain'});assert.equal(s.scene,14);assert.equal(E.outcome(s,'face').restricted,true);
 s=E.reduce(s,{type:'revisit',scene:13});s=E.reduce(s,{type:'choose',id:'release'});
 assert.deepEqual(s.cases.face,{first:'maintain',final:'release'});assert.equal(E.outcome(s,'face').restricted,false);
});
test('follow-up needs every mark, then one judgment; marks lock after judging',()=>{
 let s=at(5);s.cases.photo={first:'auto',final:'auto'};
 s=E.reduce(s,{type:'follow-judge',stamp:'different'});assert.equal(s.follows.photo.judgment,null);
 E.followMarks.photo.ids.forEach((id,i)=>{s=E.reduce(s,{type:'mark',id,value:E.truth[i]});});
 s=E.reduce(s,{type:'mark',id:'p9',value:'cut'});assert.equal(s.follows.photo.marks.p9,undefined);
 assert.equal(E.canAdvance(s),false);s=E.reduce(s,{type:'follow-judge',stamp:'different'});assert.equal(E.canAdvance(s),true);
 s=E.reduce(s,{type:'mark',id:'p1',value:'shown'});assert.equal(s.follows.photo.marks.p1,E.truth[0],'locked');
 s=E.reduce(s,{type:'next'});assert.equal(s.scene,6);
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
 let s=at(3);s=E.reduce(s,{type:'revisit',scene:9});assert.equal(s.scene,3);
 s=at(E.END);s=E.reduce(s,{type:'ask',id:'input'});assert.equal(s.completed,false);
 for(const k of E.CASES)s.cases[k]={first:E.choices[k][0],final:E.choices[k][0]};
 s=E.reduce(s,{type:'ask',id:'criteria'});assert.equal(s.completed,true);
});
