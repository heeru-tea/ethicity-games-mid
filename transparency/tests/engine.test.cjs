const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const E = fs.existsSync(require('node:path').join(__dirname,'../engine.js')) ? require('../engine.js') : {};
test('engine exposes tested state transitions',()=>assert.equal(typeof E.initial,'function'));
test('S02 cannot advance before all evidence and comparison tasks',()=>{
 let s=E.initial(); s.scene=2;
 assert.equal(E.canAdvance(s),false);
 for(const id of ['P1','P2','P3']) s=E.reduce(s,{type:'read',id});
 assert.equal(E.canAdvance(s),false);
 for(const id of E.requirements[2].tasks) s=E.reduce(s,{type:'solve',id,correct:true});
 assert.equal(E.canAdvance(s),true);
});
test('help cannot bypass unseen evidence; helped is distinct from independent',()=>{
 let s=E.initial(); s.scene=6;
 s=E.reduce(s,{type:'help'}); assert.equal(E.canAdvance(s),false);
 for(const id of ['W1','W2','W3']) s=E.reduce(s,{type:'read',id});
 s=E.reduce(s,{type:'help'}); assert.equal(E.canAdvance(s),true);
 assert.equal(s.cases.writing.help,true);
 for(const id of E.requirements[6].tasks) assert.equal(s.tasks['6:'+id],'helped');
});
test('first choice survives revisions and pending cannot advance',()=>{
 let s=E.initial(); s.scene=12;
 s=E.reduce(s,{type:'choose',id:'maintain'});
 assert.equal(s.cases.face.first,'maintain'); assert.equal(E.canAdvance(s),false);
 s=E.reduce(s,{type:'choose',id:'release'});
 assert.equal(s.cases.face.first,'maintain');
 s=E.reduce(s,{type:'solve',id:'effect',correct:true});
 s=E.reduce(s,{type:'confirm'});
 assert.equal(s.cases.face.final,'release'); assert.equal(E.canAdvance(s),true);
 assert.equal(E.outcome(s,'face').restricted,false);
});
test('all action branches can be confirmed and their outcomes match',()=>{
 for(const [scene,key,choices] of [[4,'photo',['manual','auto','dami']],[8,'writing',['detector','review','draft']],[12,'face',['crowd','release','maintain']]]){
  for(const id of choices){let s=E.initial();s.scene=scene;s=E.reduce(s,{type:'choose',id});
   if(id==='manual')s=E.reduce(s,{type:'crop',rect:[0,0,1536,1024]});
   s=E.reduce(s,{type:'solve',id:'effect',correct:true});s=E.reduce(s,{type:'confirm'});
   assert.equal(s.cases[key].final,id);assert.equal(E.canAdvance(s),true);
  }
 }
});
test('manual crop must contain all five faces before confirmation',()=>{
 let s=E.initial();s.scene=4;s=E.reduce(s,{type:'choose',id:'manual'});
 s=E.reduce(s,{type:'solve',id:'effect',correct:true});s=E.reduce(s,{type:'confirm'});
 assert.equal(s.cases.photo.final,null);
 s=E.reduce(s,{type:'crop',rect:[0,0,1536,1024]});s=E.reduce(s,{type:'solve',id:'effect',correct:true});s=E.reduce(s,{type:'confirm'});
 assert.equal(s.cases.photo.final,'manual');
});
test('corrupt or incompatible storage resets safely; valid progress round-trips',()=>{
 for(const raw of [null,'{bad',{}, {version:1,scene:999}, {version:1,scene:2,cases:[]}])assert.deepEqual(E.restore(raw),E.initial());
 let s=E.initial();s.scene=1;s=E.reduce(s,{type:'next'});s=E.reduce(s,{type:'read',id:'P1'});
 assert.deepEqual(E.restore(JSON.stringify(s)),s);
});
test('wrong answers never mark solved; rejected transitions preserve current scene',()=>{
 let s=E.initial();s.scene=3;s=E.reduce(s,{type:'solve',id:'rule',correct:false});
 assert.equal(s.tasks['3:rule'],undefined);assert.equal(E.reduce(s,{type:'next'}).scene,3);
});
test('viewing help records assistance even without accepting it',()=>{
 let s=E.initial();s.scene=3;for(const id of ['P1','P2','P3'])s=E.reduce(s,{type:'read',id});
 s=E.reduce(s,{type:'help-view'});assert.equal(s.cases.photo.help,true);
 s=E.reduce(s,{type:'solve',id:'rule',correct:true});assert.equal(s.tasks['3:rule'],'helped');
});
test('pending revised action preserves previous final, invalidates completion and cannot jump out',()=>{
 let s=E.initial();s.scene=12;s.furthest=13;s.completed=true;
 for(const key of ['photo','writing','face']){s.cases[key].first=E.choices[key][0];s.cases[key].final=E.choices[key][0];}
 s=E.reduce(s,{type:'choose',id:'release'});assert.equal(s.completed,false);assert.equal(s.cases.face.final,'crowd');
 s=E.reduce(s,{type:'revisit',scene:13});assert.equal(s.scene,12);
});
test('impossible completed save and unfinished ending are rejected',()=>{
 let s=E.initial();s.scene=13;s.furthest=13;s.completed=true;
 assert.deepEqual(E.restore(JSON.stringify(s)),E.initial());
 s.completed=false;s.tasks['13:question']='independent';s.tasks['13:schedule']='independent';assert.equal(E.canAdvance(s),false);
});
