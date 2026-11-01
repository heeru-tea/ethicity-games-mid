const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
const at=(scene,fn)=>{let s=E.initial();s.scene=scene;s.furthest=scene;return fn?fn(s):s;};
function checkAll(s,key){for(const id of E.checks[key])s=E.reduce(s,{type:'check',id});return s;}

test('scene layout: four steps per case, prologue and ending',()=>{
 assert.deepEqual([0,1,2,3,4,5,8,9,12,13].map(E.stepOf),['intro','hook','check','choose','result','hook','result','hook','result','end']);
 assert.deepEqual([1,4,5,8,9,12].map(E.caseKey),['photo','photo','writing','writing','face','face']);
 assert.equal(E.sceneOf('face','choose'),11);
});
test('check step needs every record and one judgment before choosing',()=>{
 let s=at(2);assert.equal(E.canAdvance(s),false);
 s=E.reduce(s,{type:'judge',stamp:'confirmed'});assert.equal(s.judgments.photo,null,'cannot judge before checking');
 s=E.reduce(s,{type:'check',id:'photo-original'});assert.equal(E.canAdvance(s),false);
 s=E.reduce(s,{type:'check',id:'writing-guide'});assert.deepEqual(s.evidence,['photo-original'],'other case records are ignored');
 s=E.reduce(s,{type:'check',id:'photo-rule'});assert.equal(E.canAdvance(s),false,'judgment still missing');
 s=E.reduce(s,{type:'judge',stamp:'unknown'});assert.equal(s.judgments.photo,'unknown');assert.equal(E.canAdvance(s),true);
});
test('a wrong judgment is recorded as the student chose it and is not overwritten',()=>{
 let s=checkAll(at(10),'face');s=E.reduce(s,{type:'judge',stamp:'confirmed'});s=E.reduce(s,{type:'judge',stamp:'different'});
 assert.equal(s.judgments.face,'confirmed');assert.equal(E.answers.face,'different');
});
test('choosing moves to the result; first choice survives a later change',()=>{
 let s=checkAll(at(11),'face');s=E.reduce(s,{type:'choose',id:'release'});assert.equal(s.scene,11,'no choice before judgment');
 s.scene=10;s=E.reduce(s,{type:'judge',stamp:'different'});s=E.reduce(s,{type:'next'});assert.equal(s.scene,11);
 s=E.reduce(s,{type:'choose',id:'maintain'});assert.equal(s.scene,12);assert.equal(E.outcome(s,'face').restricted,true);
 s=E.reduce(s,{type:'revisit',scene:11});s=E.reduce(s,{type:'choose',id:'release'});
 assert.deepEqual(s.cases.face,{first:'maintain',final:'release'});assert.equal(E.outcome(s,'face').restricted,false);
 s=E.reduce(s,{type:'choose',id:'crowd'});assert.equal(s.cases.face.final,'release','choose only works on the choose step');
});
test('photo outcomes are real crops: automatic leaves 담이 out, the full choice includes all five',()=>{
 assert.equal(E.allFaces(E.AUTO),false);assert.equal(E.allFaces(E.ALL),true);
 const [x,y,w,h]=E.AUTO,[fx,,fw]=E.faces[2];assert.ok(fx+fw<=x||fx>=x+w,'담이 face outside automatic crop');
 assert.equal(Math.round(E.ALL[2]/E.ALL[3]*100),150);
});
test('revisit cannot jump past the furthest scene',()=>{
 let s=at(3);s=E.reduce(s,{type:'revisit',scene:9});assert.equal(s.scene,3);s=E.reduce(s,{type:'revisit',scene:1});assert.equal(s.scene,1);
});
test('ending needs all three choices, then any question completes it',()=>{
 let s=at(13);s=E.reduce(s,{type:'ask',id:'input'});assert.equal(s.completed,false);
 for(const k of E.CASES)s.cases[k]={first:E.choices[k][0],final:E.choices[k][0]};
 s=E.reduce(s,{type:'ask',id:'nope'});assert.equal(s.completed,false);
 s=E.reduce(s,{type:'ask',id:'criteria'});assert.equal(s.completed,true);assert.equal(s.question,'criteria');
 s=E.reduce(s,{type:'next'});assert.equal(s.scene,13);
});
