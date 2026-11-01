// 저장·이어하기·이전 저장 옮기기
const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
const v1c=(f)=>({first:f,final:f});
test('corrupt or impossible saves reset safely',()=>{
 for(const raw of [null,'{bad',{},{version:3},{version:2,scene:999},{version:1,revision:4,scene:2,furthest:2,evidence:['P1'],judgments:{},cases:{},question:null,completed:false}])assert.deepEqual(E.restore(raw),E.initial());
 let s=E.initial();s.scene=4;s.furthest=4;assert.deepEqual(E.restore(JSON.stringify(s)),E.initial(),'result scene without a choice');
 s=E.initial();s.judgments.photo=[null,'unknown',null];assert.deepEqual(E.restore(s),E.initial(),'judgment gap');
});
test('version 2 progress round-trips exactly',()=>{
 let s=E.initial();s=E.reduce(s,{type:'next'});s=E.reduce(s,{type:'next'});s=E.reduce(s,{type:'check',id:'photo-original'});
 assert.equal(s.scene,2);assert.deepEqual(E.restore(JSON.stringify(s)),s);
});
test('version 1 revision 4 save at scene 5 (writing case start) resumes at the writing case start',()=>{
 const old={version:1,revision:4,scene:5,furthest:5,evidence:['photo-original','photo-rule'],judgments:{photo:'unknown',writing:null,face:null},cases:{photo:v1c('auto'),writing:{first:null,final:null},face:{first:null,final:null}},question:null,completed:false};
 const s=E.restore(JSON.stringify(old));
 assert.equal(s.version,2);assert.equal(E.stepOf(s.scene),'hook');assert.equal(E.caseKey(s.scene),'writing');
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
test('version 1 revision 4 completed save lands on the ending, still completed',()=>{
 const old={version:1,revision:4,scene:13,furthest:13,evidence:Object.values(E.checks).flat(),judgments:{photo:'confirmed',writing:'unknown',face:'different'},cases:{photo:v1c('all'),writing:v1c('review'),face:v1c('release')},question:'input',completed:true};
 const s=E.restore(old);assert.equal(s.scene,E.END);assert.equal(s.completed,true);assert.ok(E.CASES.every(k=>s.follows[k].judgment==='legacy'));
});
test('revision 3 save (claim-card version) still migrates through revision 4',()=>{
 const old={version:1,revision:3,scene:7,furthest:7,evidence:['P1','P2','P3','W1','W2'],tasks:{},claims:{},attempts:{},assistedScenes:[],
  cases:{photo:{first:'auto',final:'manual',pending:null,help:false},writing:{first:null,final:null,pending:null,help:false},face:{first:null,final:null,pending:null,help:false}},crop:[0,0,1536,1024],completed:false};
 const s=E.restore(old);assert.deepEqual(s.cases.photo,{first:'auto',final:'all'});assert.deepEqual(s.judgments.photo,['legacy','legacy','legacy']);
 assert.equal(s.scene,E.sceneOf('writing','hook'));assert.ok(s.evidence.includes('writing-guide')&&!s.evidence.includes('writing-history'));
 const nr={version:1,scene:4,furthest:4,evidence:['P1','P2','P3'],tasks:{},cases:{photo:{first:null,final:'auto',pending:null,help:false},writing:{first:null,final:null,pending:null,help:false},face:{first:null,final:null,pending:null,help:false}},crop:[900,50,600,400],completed:false};
 const t=E.restore(nr);assert.equal(t.cases.photo.legacyFirst,true);assert.equal(t.scene,E.sceneOf('photo','result'));
});
