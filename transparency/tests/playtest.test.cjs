const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
test('unconfirmed choices never change the visible outcome',()=>{
 let s=E.initial();s.scene=12;s=E.reduce(s,{type:'choose',id:'release'});
 assert.equal(E.outcome(s,'face').id,null);
 s=E.reduce(s,{type:'solve',id:'effect',correct:true});s=E.reduce(s,{type:'confirm'});
 s=E.reduce(s,{type:'choose',id:'maintain'});assert.equal(E.outcome(s,'face').id,'release');
 s=E.reduce(s,{type:'cancel-choice'});assert.equal(s.cases.face.pending,null);assert.equal(s.cases.face.first,'release');
});
test('manual crop executes after commitment and blocks advancing until everyone is included',()=>{
 let s=E.initial();s.scene=4;s=E.reduce(s,{type:'choose',id:'manual'});s=E.reduce(s,{type:'solve',id:'effect',correct:true});
 assert.equal(E.canConfirm(s),true);s=E.reduce(s,{type:'confirm'});assert.equal(s.cases.photo.first,'manual');assert.equal(E.canAdvance(s),false);
 s=E.reduce(s,{type:'crop',rect:[0,0,1536,1024]});assert.equal(E.canAdvance(s),true);
});
test('claim requires both the correct evidence and stamp, errors encourage help',()=>{
 let s=E.initial();s.scene=11;for(const id of ['F1','F2','F3'])s=E.reduce(s,{type:'read',id});
 s=E.reduce(s,{type:'judge',id:'f-confirm',evidence:'F2',stamp:'different'});assert.equal(s.tasks['11:f-confirm'],undefined);
 s=E.reduce(s,{type:'judge',id:'f-confirm',evidence:'F1',stamp:'confirmed'});assert.equal(s.attempts['11:f-confirm'],2);
 s=E.reduce(s,{type:'judge',id:'f-confirm',evidence:'F1',stamp:'different'});assert.equal(s.tasks['11:f-confirm'],'independent');assert.equal(s.claims['11:f-confirm'].evidence,'F1');
});
test('legacy v1 S07 preserves progress without inventing new claim results',()=>{
 let old=E.initial();delete old.revision;delete old.claims;delete old.attempts;old.scene=7;old.furthest=7;old.evidence=['P1','P2','P3','W1','W2','W3'];old.cases.photo={first:'auto',final:'manual',pending:null,help:false};old.crop=[0,0,1536,1024];old.tasks={'7:w-limit':'independent'};
 const s=E.restore(old);assert.equal(s.scene,7);assert.equal(s.cases.photo.first,'manual');assert.deepEqual(s.claims,{});assert.equal(s.tasks['7:w-limit'],'independent');
});

test('rechoosing and cancelling legacy confirmed helped action preserves its assessment',()=>{
 let s=E.initial();s.scene=8;s.cases.writing={first:'review',final:'review',pending:null,help:true};s.tasks['8:effect']='helped';
 s=E.reduce(s,{type:'choose',id:'draft'});s=E.reduce(s,{type:'cancel-choice'});assert.equal(s.tasks['8:effect'],'helped');
});
