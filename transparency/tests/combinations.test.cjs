const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
function play(pick,judge){let s=E.initial();
 for(let n=0;n<13;n++){assert.equal(s.scene,n);const k=E.caseKey(n),step=E.stepOf(n);
  if(step==='check'){for(const id of E.checks[k])s=E.reduce(s,{type:'check',id});s=E.reduce(s,{type:'judge',stamp:judge(k)});}
  if(step==='choose'){s=E.reduce(s,{type:'choose',id:pick[k]});assert.equal(s.scene,n+1);continue;}
  assert.equal(E.canAdvance(s),true,'scene '+n);s=E.reduce(s,{type:'next'});}
 return E.reduce(s,{type:'ask',id:'unknown'});}
test('all 18 choice combinations reach the ending and survive reload',()=>{let count=0;
 for(const photo of E.choices.photo)for(const writing of E.choices.writing)for(const face of E.choices.face){
  const s=play({photo,writing,face},k=>E.answers[k]);count++;
  assert.equal(s.completed,true);assert.equal(E.outcome(s,'face').restricted,face!=='release');assert.equal(E.outcome(s,'writing').excluded,writing==='detector');
  assert.deepEqual(E.restore(JSON.stringify(s)),s);}
 assert.equal(count,18);
});
test('wrong judgments do not block the story; every stamp can be carried to the ending',()=>{
 for(const stamp of E.stamps){const s=play({photo:'auto',writing:'detector',face:'maintain'},()=>stamp);assert.equal(s.completed,true);assert.deepEqual(Object.values(s.judgments),[stamp,stamp,stamp]);}
});
