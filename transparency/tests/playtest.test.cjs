// 저장·이어하기·이전 판 저장 호환
const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
test('corrupt or impossible saves reset safely',()=>{
 for(const raw of [null,'{bad',{},{version:2},{version:1,revision:4,scene:999},{version:1,revision:4,scene:2,furthest:2,evidence:['P1'],judgments:{},cases:{},question:null,completed:false}])assert.deepEqual(E.restore(raw),E.initial());
 let s=E.initial();s.scene=4;s.furthest=4;assert.deepEqual(E.restore(JSON.stringify(s)),E.initial(),'result scene without a choice');
 s=E.initial();s.completed=true;assert.deepEqual(E.restore(JSON.stringify(s)),E.initial(),'completed without question');
});
test('progress mid-case round-trips exactly',()=>{
 let s=E.initial();s=E.reduce(s,{type:'next'});s=E.reduce(s,{type:'next'});s=E.reduce(s,{type:'check',id:'photo-original'});
 assert.equal(s.scene,2);assert.deepEqual(E.restore(JSON.stringify(s)),s);
});
test('revision 3 save (claim-card version) continues by case without inventing judgments',()=>{
 const old={version:1,revision:3,scene:7,furthest:7,evidence:['P1','P2','P3','W1','W2'],tasks:{'3:p-rule':'independent'},claims:{},attempts:{},assistedScenes:[],
  cases:{photo:{first:'auto',final:'manual',pending:null,help:false},writing:{first:null,final:null,pending:null,help:false},face:{first:null,final:null,pending:null,help:false}},crop:[0,0,1536,1024],completed:false};
 const s=E.restore(old);
 assert.equal(s.revision,4);assert.deepEqual(s.cases.photo,{first:'auto',final:'all'});
 assert.equal(s.judgments.photo,'legacy');assert.equal(s.judgments.writing,null);
 assert.equal(s.scene,E.sceneOf('writing','hook'),'resumes at the start of the unfinished writing case');
 assert.ok(s.evidence.includes('writing-guide')&&!s.evidence.includes('writing-history'));
 assert.deepEqual(E.restore(JSON.stringify(s)),s);
});
test('revision 3 completed save keeps all choices and lands on the ending',()=>{
 const c=(f)=>({first:f,final:f,pending:null,help:false});
 const old={version:1,revision:3,scene:13,furthest:13,evidence:['P1','P2','P3','W1','W2','W3','F1','F2','F3'],tasks:{},claims:{},attempts:{},assistedScenes:[],cases:{photo:c('dami'),writing:c('review'),face:c('release')},crop:[550,300,500,500],completed:true};
 let s=E.restore(old);assert.equal(s.cases.photo.final,null,'removed photo option must be chosen again');assert.equal(s.scene,E.sceneOf('photo','choose'));
 old.cases.photo=c('auto');s=E.restore(old);assert.equal(s.scene,13);assert.equal(s.completed,false);assert.equal(s.cases.face.final,'release');
});
test('legacy save without revision marks first choice as reconstructed',()=>{
 const old={version:1,scene:4,furthest:4,evidence:['P1','P2','P3'],tasks:{},cases:{photo:{first:null,final:'auto',pending:null,help:false},writing:{first:null,final:null,pending:null,help:false},face:{first:null,final:null,pending:null,help:false}},crop:[900,50,600,400],completed:false};
 const s=E.restore(old);assert.equal(s.cases.photo.legacyFirst,true);assert.equal(s.scene,E.sceneOf('photo','result'));
});
