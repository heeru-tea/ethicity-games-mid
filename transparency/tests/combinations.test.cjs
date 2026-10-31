const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
test('all 27 final action combinations reach the ending; first choices survive',()=>{
 for(const photo of E.choices.photo)for(const writing of E.choices.writing)for(const face of E.choices.face){
  let s=E.initial();
  for(let n=0;n<=13;n++){
   assert.equal(s.scene,n);
   for(const id of E.requirements[n]?.evidence||[])s=E.reduce(s,{type:'read',id});
   const key={4:'photo',8:'writing',12:'face'}[n];
   if(key){const target={photo,writing,face}[key];s=E.reduce(s,{type:'choose',id:E.choices[key][0]});s=E.reduce(s,{type:'choose',id:target});if(target==='manual')s=E.reduce(s,{type:'crop',rect:[0,0,1536,1024]});s=E.reduce(s,{type:'solve',id:'effect',correct:true});s=E.reduce(s,{type:'confirm'});assert.equal(s.cases[key].first,E.choices[key][0]);assert.equal(s.cases[key].final,target);}
   else for(const id of E.requirements[n]?.tasks||[])s=E.reduce(s,{type:'solve',id,correct:true});
   assert.equal(E.canAdvance(s),true);s=E.reduce(s,{type:'next'});
  }
  assert.equal(s.completed,true);assert.equal(E.outcome(s,'face').restricted,face!=='release');
  assert.deepEqual(E.restore(JSON.stringify(s)),s,'completed play must survive reload including f1/f3 task ids');
 }
});
