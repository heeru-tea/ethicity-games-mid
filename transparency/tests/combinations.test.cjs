const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
function play(pick,judge){let s=E.initial(),count=0;
 for(let n=0;n<E.END;n++){assert.equal(s.scene,n);const k=E.caseKey(n),step=E.stepOf(n);
  if(step==='check'){for(const id of E.checks[k])s=E.reduce(s,{type:'check',id});for(let i=0;i<3;i++){s=E.reduce(s,{type:'judge',stamp:judge(k,i)});count++;}}
  if(step==='choose'){s=E.reduce(s,{type:'choose',id:pick[k]});assert.equal(s.scene,n+1);continue;}
  if(step==='reflect'&&k!=='writing'){s=E.reduce(s,{type:'reflect',key:k,q:'q1',text:k+' 자료를 보고'});}
  if(step==='follow'){const m=E.followMarks[k];m.ids.forEach((id,i)=>{s=E.reduce(s,{type:'mark',id,value:k==='photo'?E.truth[i]:m.values[0]});});s=E.reduce(s,{type:'follow-judge',stamp:judge(k,'follow')});count++;}
  assert.equal(E.canAdvance(s),true,'scene '+n);s=E.reduce(s,{type:'next'});}
 s=E.reduce(s,{type:'ask',id:'unknown'});s=E.reduce(s,{type:'note',text:'무엇을 기준으로'});s=E.reduce(s,{type:'next'});assert.equal(s.scene,E.REPORT);
 s=E.reduce(s,{type:'reporter',field:'name',text:'하늘'});return {s,count};}
const right=(k,i)=>i==='follow'?E.followAnswers[k]:E.answers[k][i];
test('all 18 choice combinations reach the ending with 12 judgments and survive reload',()=>{let n=0;
 for(const photo of E.choices.photo)for(const writing of E.choices.writing)for(const face of E.choices.face){
  const {s,count}=play({photo,writing,face},right);n++;assert.equal(count,12);
  assert.equal(s.completed,true);assert.equal(s.reflections.photo.q1,'photo 자료를 보고');assert.equal(s.reflections.writing.q1,'');assert.equal(s.finalNote,'무엇을 기준으로');assert.equal(E.outcome(s,'face').restricted,face!=='release');
  assert.deepEqual(E.restore(JSON.stringify(s)),s);}
 assert.equal(n,18);
});
test('wrong judgments never block the story',()=>{
 for(const stamp of E.stamps){const {s}=play({photo:'auto',writing:'detector',face:'maintain'},()=>stamp);assert.equal(s.completed,true);assert.deepEqual(s.judgments.writing,[stamp,stamp,stamp]);}
});
