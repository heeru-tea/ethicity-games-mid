(function(root){
 'use strict';
 const C=typeof module!=='undefined'&&module.exports?require('./claims.js'):root.TransparencyClaims;
 const requirements={
  2:{evidence:['P1','P2','P3'],tasks:['compare','overlay','center']},
  3:{evidence:['P1','P2','P3'],tasks:C.claims[3].map(c=>c.id)},
  6:{evidence:['W1','W2','W3'],tasks:['why']},
  7:{evidence:['W1','W2','W3'],tasks:C.claims[7].map(c=>c.id)},
  10:{evidence:['F1','F2','F3'],tasks:['trace']},
  11:{evidence:['F1','F2','F3'],tasks:C.claims[11].map(c=>c.id)},
  13:{evidence:[],tasks:['question','schedule']}
 };
 const choices={photo:['manual','auto','dami'],writing:['detector','review','draft'],face:['crowd','release','maintain']};
 const actionKey={4:'photo',8:'writing',12:'face'};
 const AUTO=[900,50,600,400],DAMI=[550,300,500,500];
 const faces=[[300,210,220,180],[460,35,240,300],[695,350,165,150],[815,55,220,230],[1050,105,230,210]];
 function caseKey(scene){return scene<=4?'photo':scene<=8?'writing':scene<=12?'face':null;}
 function initial(){return {version:1,revision:3,scene:0,furthest:0,evidence:[],tasks:{},claims:{},attempts:{},assistedScenes:[],cases:Object.fromEntries(Object.keys(choices).map(k=>[k,{first:null,final:null,pending:null,help:false}])),crop:AUTO.slice(),completed:false};}
 function readyEvidence(s){return (requirements[s.scene]?.evidence||[]).every(id=>s.evidence.includes(id));}
 function allFaces(rect){const [x,y,w,h]=rect;return faces.every(([fx,fy,fw,fh])=>fx>=x&&fy>=y&&fx+fw<=x+w&&fy+fh<=y+h);}
 function canConfirm(s){const k=actionKey[s.scene];return !!k&&!!s.cases[k].pending&&!!s.tasks[s.scene+':effect'];}
 function endingReady(s){return (s.cases.photo.final!=='manual'||allFaces(s.crop))&&Object.values(s.cases).every(c=>c.first&&c.final&&!c.pending)&&[4,8,12].every(n=>s.tasks[n+':effect'])&&Object.entries(requirements).every(([n,r])=>r.evidence.every(id=>s.evidence.includes(id))&&r.tasks.every(id=>s.tasks[n+':'+id]));}
 function canAdvance(s){
  if(s.scene===13)return endingReady(s);
  const k=actionKey[s.scene];if(k)return !!s.cases[k].final&&!s.cases[k].pending&&(k!=='photo'||s.cases.photo.final!=='manual'||allFaces(s.crop));
  return readyEvidence(s)&&(requirements[s.scene]?.tasks||[]).every(t=>!!s.tasks[s.scene+':'+t]);
 }
 function reduce(state,action){
  const s=JSON.parse(JSON.stringify(state));const k=caseKey(s.scene),ak=actionKey[s.scene];
  if(action.type==='read'&&/^[PWF][123]$/.test(action.id)&&!s.evidence.includes(action.id))s.evidence.push(action.id);
  if(action.type==='solve'&&action.correct&&readyEvidence(s)){
   const allowed=ak?['effect']:requirements[s.scene]?.tasks||[];
   if(allowed.includes(action.id)&&!C.find(s.scene,action.id))s.tasks[s.scene+':'+action.id]=s.tasks[s.scene+':'+action.id]||(s.assistedScenes.includes(s.scene)?'helped':'independent');
  }
  if(action.type==='judge'&&readyEvidence(s)){const c=C.find(s.scene,action.id),id=s.scene+':'+action.id;if(c&&!s.tasks[id]){if(c.evidence===action.evidence&&c.stamp===action.stamp){s.tasks[id]=s.assistedScenes.includes(s.scene)?'helped':'independent';s.claims[id]={evidence:action.evidence,stamp:action.stamp};}else s.attempts[id]=(s.attempts[id]||0)+1;}}
  if(action.type==='help'&&readyEvidence(s)){if(k)s.cases[k].help=true;if(!s.assistedScenes.includes(s.scene))s.assistedScenes.push(s.scene);}
  if(action.type==='help'&&readyEvidence(s)){
   if(k)s.cases[k].help=true;
   const tasks=ak?(s.cases[ak].pending?['effect']:[]):requirements[s.scene]?.tasks||[];
   tasks.forEach(t=>{const id=s.scene+':'+t;s.tasks[id]=s.tasks[id]||'helped';const c=C.find(s.scene,t);if(c)s.claims[id]={evidence:c.evidence,stamp:c.stamp};});
  }
  if(action.type==='choose'&&ak&&choices[ak].includes(action.id)){
   const c=s.cases[ak];if(c.final&&!c.pending)c.finalEffect=s.tasks[s.scene+':effect']||c.finalEffect||'independent';c.pending=action.id;s.completed=false;delete s.tasks[s.scene+':effect'];

  }
  if(action.type==='crop'&&s.scene===4&&!s.cases.photo.pending&&s.cases.photo.final==='manual'){
   const r=action.rect;if(Array.isArray(r)&&r.length===4&&r.every(Number.isFinite)&&r[0]>=0&&r[1]>=0&&r[2]>0&&r[3]>0&&r[0]+r[2]<=1536&&r[1]+r[3]<=1024){s.crop=r.slice();s.completed=false;}
  }
  if(action.type==='confirm'&&canConfirm(s)){const c=s.cases[ak];if(!c.first)c.first=c.pending;c.final=c.pending;c.finalEffect=s.tasks[s.scene+':effect'];c.pending=null;if(ak==='photo')s.crop=(c.final==='dami'?DAMI:AUTO).slice();}
  if(action.type==='cancel-choice'&&ak){const c=s.cases[ak];c.pending=null;if(c.final)s.tasks[s.scene+':effect']=c.finalEffect||'independent';else delete s.tasks[s.scene+':effect'];}
  if(action.type==='next'&&canAdvance(s)){if(s.scene<13){s.scene++;s.furthest=Math.max(s.furthest,s.scene);}else{s.completed=true;}}
  if(action.type==='revisit'&&!Object.values(s.cases).some(c=>c.pending)&&Number.isInteger(action.scene)&&action.scene>=0&&action.scene<=s.furthest){s.scene=action.scene;}
  return s;
 }
 function outcome(s,key){const id=s.cases[key].final;return {id,restricted:key==='face'?id!=='release':undefined,excluded:key==='writing'?id==='detector':undefined,rect:key==='photo'?(id==='auto'?AUTO:id==='dami'?DAMI:s.crop):undefined};}
 function restore(raw){
  try{const v=typeof raw==='string'?JSON.parse(raw):raw;
   if(!v||v.version!==1||!Number.isInteger(v.scene)||v.scene<0||v.scene>13||!Number.isInteger(v.furthest)||v.furthest<v.scene||v.furthest>13||!Array.isArray(v.evidence)||!v.tasks||Array.isArray(v.tasks)||typeof v.tasks!=='object'||!v.cases||typeof v.completed!=='boolean')return initial();
   for(const k of Object.keys(choices)){const c=v.cases[k];if(!c||typeof c.help!=='boolean'||['first','final','pending'].some(p=>c[p]!==null&&!choices[k].includes(c[p])))return initial();}
   if(!Array.isArray(v.crop)||v.crop.length!==4||!v.crop.every(Number.isFinite)||v.crop[0]<0||v.crop[1]<0||v.crop[2]<=0||v.crop[3]<=0||v.crop[0]+v.crop[2]>1536||v.crop[1]+v.crop[3]>1024)return initial();
   if(v.evidence.some(id=>!/^[PWF][123]$/.test(id))||Object.entries(v.tasks).some(([id,status])=>!/^\d{1,2}:[a-z0-9-]+$/.test(id)||!['helped','independent'].includes(status)))return initial();
   if(v.assistedScenes===undefined)v.assistedScenes=[];
   if(!Array.isArray(v.assistedScenes)||v.assistedScenes.some(n=>!Number.isInteger(n)||n<0||n>13))return initial();
   if(v.completed&&(v.furthest!==13||Object.values(v.cases).some(c=>!c.final||c.pending)))return initial();
   if(Object.entries(v.cases).some(([k,c])=>c.pending&&actionKey[v.scene]!==k))return initial();
   if(v.revision===undefined){for(const c of Object.values(v.cases)){c.first=c.final;c.legacyFirst=!!c.final;}v.revision=2;}
   if(v.revision!==3){v.claims={};v.attempts={};v.revision=3;if(v.completed&&!endingReady(v))v.completed=false;}
   if(!v.claims||Array.isArray(v.claims)||typeof v.claims!=='object'||!v.attempts||Array.isArray(v.attempts)||typeof v.attempts!=='object')return initial();
   for(const [id,value] of Object.entries(v.claims)){const [n,t]=id.split(':');const c=C.find(Number(n),t);if(!c||value?.evidence!==c.evidence||value?.stamp!==c.stamp||!v.tasks[id])return initial();}
   for(const [n,list] of Object.entries(C.claims))for(const c of list){const id=n+':'+c.id;if(v.tasks[id]&&!v.claims[id])delete v.tasks[id];}
   if(Object.entries(v.attempts).some(([id,n])=>!/^\d{1,2}:[a-z0-9-]+$/.test(id)||!Number.isInteger(n)||n<0))return initial();
   if(v.completed&&!endingReady(v))return initial();
   return JSON.parse(JSON.stringify(v));
  }catch{return initial();}
 }
 const api={initial,reduce,canAdvance,canConfirm,restore,requirements,choices,caseKey,outcome,allFaces,AUTO,DAMI,faces,readyEvidence};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TransparencyEngine=api;
})(typeof window==='undefined'?globalThis:window);
