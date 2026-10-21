import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),cfg=require('../js/config.js'),S=require('../js/session.js'),N=require('../js/narrative.js'),A=require('../js/advisor.js');
test('real default starts with two buses and two empty routes',()=>{
 const s=S.create(cfg);assert.equal(s.owned,2);assert.equal(s.draft.buses.length,2);assert.deepEqual(s.draft.routes.map(r=>r.nodes),[[],[]]);
 assert.deepEqual(s.draft.buses.map(b=>b.routeNum),[1,2]);S.beginPlan(s);assert.equal(S.startRun(s),null);
 assert.ok(N.hookLines(s)[1].includes('직접'));
 for(const [i,nodes] of [['1',['F','C','D']],['2',['B','A','G']]])S.updateRoute(s,Number(i),{nodes,stops:nodes.map(()=>true)});
 assert.ok(S.startRun(s));
});
test('two-bus AI works from empty draft',()=>{
 const s=S.create(cfg);S.beginPlan(s);const rec=A.recommendSync(S.revealed(s),'reach');S.applyRecommendation(s,rec);assert.equal(s.draft.buses.length,2);assert.deepEqual(S.validate(s),[]);
});
