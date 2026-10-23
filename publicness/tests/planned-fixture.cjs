// Explicit three-bus traffic fixture for established capacity/transfer/AI regressions.
// This is NOT the application start state; empty-start.test.mjs covers that separately.
const cfg=structuredClone(require('../js/config.js'));
cfg.challenge=null;
cfg.nodes.find(n=>n.id==='H').fromPhase=1;cfg.demandRows.find(r=>r.a==='H'&&r.b==='A').fromPhase=1;
cfg.nodes=cfg.nodes.filter(n=>!['J','K'].includes(n.id));cfg.demandRows=cfg.demandRows.filter(r=>!['J','K'].includes(r.a)&&!['J','K'].includes(r.b));
cfg.residents=cfg.residents.filter(r=>!r.itineraries);
cfg.demandRows=cfg.demandRows.filter(r=>!(r.a==='A'&&r.b==='C'));
// 2026-10-22 신도시 성장 행(4·5단계)은 레거시 시나리오에서 제외
cfg.demandRows=cfg.demandRows.filter(r=>!(r.a==='I'&&r.fromPhase>=4));
cfg.bus.initialBuses=3;
cfg.progression=null;cfg.bus.maxBuses=4;cfg.bus.autoSpacing=false;
cfg.initialDraft={routes:[['B','A','G','E'],['B','C','D','A'],['H','A','G']].map(nodes=>({nodes,stops:nodes.map(()=>true)})),buses:[1,2,3].map(id=>({id,routeNum:id,offset:0}))};
cfg.nodes.find(n=>n.id==='F').x=-4.5;cfg.nodes.find(n=>n.id==='F').y=1;
cfg.day=null;cfg.map.pixelsPerSecond=55;
const positions={D:[.2,2.6],E:[2.5,1.6],G:[2.6,-1],I:[4.8,.4]};for(const n of cfg.nodes)if(positions[n.id])[n.x,n.y]=positions[n.id];
cfg.residents.find(r=>r.id==='jun').o='G';cfg.residents.find(r=>r.id==='jun').d='A';cfg.residents.find(r=>r.id==='sol').d='D';
module.exports=cfg;
