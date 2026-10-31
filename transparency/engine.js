(function(root){
 'use strict';
 const requirements={
  2:{evidence:['P1','P2','P3'],tasks:['compare','overlay','center']},
  3:{evidence:['P1','P2','P3'],tasks:['rule','record','known','unknown']},
  6:{evidence:['W1','W2','W3'],tasks:['order','revision','why']},
  7:{evidence:['W1','W2','W3'],tasks:['w-limit','draft-limit']},
  10:{evidence:['F1','F2','F3'],tasks:['flow','link-alert','link-interpret','link-action','uncertainty']},
  11:{evidence:['F1','F2','F3'],tasks:['word','f1','f3']},
  13:{evidence:[],tasks:['question','schedule']}
 };
 const choices={photo:['manual','auto','dami'],writing:['detector','review','draft'],face:['crowd','release','maintain']};
 const actionKey={4:'photo',8:'writing',12:'face'};
 const AUTO=[900,50,600,400],DAMI=[550,300,500,500];
 const faces=[[300,210,220,180],[460,35,240,300],[695,350,165,150],[815,55,220,230],[1050,105,230,210]];
 function caseKey(scene){return scene<=4?'photo':scene<=8?'writing':scene<=12?'face':null;}
 function initial(){return {version:1,scene:0,furthest:0,evidence:[],tasks:{},assistedScenes:[],cases:Object.fromEntries(Object.keys(choices).map(k=>[k,{first:null,final:null,pending:null,help:false}])),crop:AUTO.slice(),completed:false};}
 function readyEvidence(s){return (requirements[s.scene]?.evidence||[]).every(id=>s.evidence.includes(id));}
 function allFaces(rect){const [x,y,w,h]=rect;return faces.every(([fx,fy,fw,fh])=>fx>=x&&fy>=y&&fx+fw<=x+w&&fy+fh<=y+h);}
 function canConfirm(s){const k=actionKey[s.scene];return !!k&&!!s.cases[k].pending&&!!s.tasks[s.scene+':effect']&&(k!=='photo'||s.cases[k].pending!=='manual'||allFaces(s.crop));}
 function endingReady(s){return Object.values(s.cases).every(c=>c.first&&c.final&&!c.pending)&&[4,8,12].every(n=>s.tasks[n+':effect'])&&Object.entries(requirements).every(([n,r])=>r.evidence.every(id=>s.evidence.includes(id))&&r.tasks.every(id=>s.tasks[n+':'+id]));}
 function canAdvance(s){
  if(s.scene===13)return endingReady(s);
  const k=actionKey[s.scene];if(k)return !!s.cases[k].final&&!s.cases[k].pending;
  return readyEvidence(s)&&(requirements[s.scene]?.tasks||[]).every(t=>!!s.tasks[s.scene+':'+t]);
 }
 function reduce(state,action){
  const s=JSON.parse(JSON.stringify(state));const k=caseKey(s.scene),ak=actionKey[s.scene];
  if(action.type==='read'&&/^[PWF][123]$/.test(action.id)&&!s.evidence.includes(action.id))s.evidence.push(action.id);
  if(action.type==='solve'&&action.correct&&readyEvidence(s)){
   const allowed=ak?['effect']:requirements[s.scene]?.tasks||[];
   if(allowed.includes(action.id))s.tasks[s.scene+':'+action.id]=s.tasks[s.scene+':'+action.id]||(s.assistedScenes.includes(s.scene)?'helped':'independent');
  }
  if(['help','help-view'].includes(action.type)&&readyEvidence(s)){if(k)s.cases[k].help=true;if(!s.assistedScenes.includes(s.scene))s.assistedScenes.push(s.scene);}
  if(action.type==='help'&&readyEvidence(s)){
   if(k)s.cases[k].help=true;
   const tasks=ak?(s.cases[ak].pending?['effect']:[]):requirements[s.scene]?.tasks||[];
   tasks.forEach(t=>{s.tasks[s.scene+':'+t]=s.tasks[s.scene+':'+t]||'helped';});
  }
  if(action.type==='choose'&&ak&&choices[ak].includes(action.id)){
   const c=s.cases[ak];if(!c.first)c.first=action.id;c.pending=action.id;s.completed=false;delete s.tasks[s.scene+':effect'];
   if(ak==='photo')s.crop=(action.id==='dami'?DAMI:AUTO).slice();
  }
  if(action.type==='crop'&&s.scene===4&&s.cases.photo.pending==='manual'){
   const r=action.rect;if(Array.isArray(r)&&r.length===4&&r.every(Number.isFinite)&&r[0]>=0&&r[1]>=0&&r[2]>0&&r[3]>0&&r[0]+r[2]<=1536&&r[1]+r[3]<=1024){s.crop=r.slice();delete s.tasks['4:effect'];}
  }
  if(action.type==='confirm'&&canConfirm(s)){s.cases[ak].final=s.cases[ak].pending;s.cases[ak].pending=null;}
  if(action.type==='next'&&canAdvance(s)){if(s.scene<13){s.scene++;s.furthest=Math.max(s.furthest,s.scene);}else{s.completed=true;}}
  if(action.type==='revisit'&&!Object.values(s.cases).some(c=>c.pending)&&Number.isInteger(action.scene)&&action.scene>=0&&action.scene<=s.furthest){s.scene=action.scene;}
  return s;
 }
 function outcome(s,key){const id=s.cases[key].pending||s.cases[key].final;return {id,restricted:key==='face'?id!=='release':undefined,excluded:key==='writing'?id==='detector':undefined,rect:key==='photo'?(id==='auto'?AUTO:id==='dami'?DAMI:s.crop):undefined};}
 function restore(raw){
  try{const v=typeof raw==='string'?JSON.parse(raw):raw;
   if(!v||v.version!==1||!Number.isInteger(v.scene)||v.scene<0||v.scene>13||!Number.isInteger(v.furthest)||v.furthest<v.scene||v.furthest>13||!Array.isArray(v.evidence)||!v.tasks||Array.isArray(v.tasks)||typeof v.tasks!=='object'||!v.cases||typeof v.completed!=='boolean')return initial();
   for(const k of Object.keys(choices)){const c=v.cases[k];if(!c||typeof c.help!=='boolean'||['first','final','pending'].some(p=>c[p]!==null&&!choices[k].includes(c[p])))return initial();}
   if(!Array.isArray(v.crop)||v.crop.length!==4||!v.crop.every(Number.isFinite)||v.crop[0]<0||v.crop[1]<0||v.crop[2]<=0||v.crop[3]<=0||v.crop[0]+v.crop[2]>1536||v.crop[1]+v.crop[3]>1024)return initial();
   if(v.evidence.some(id=>!/^[PWF][123]$/.test(id))||Object.entries(v.tasks).some(([id,status])=>!/^\d{1,2}:[a-z0-9-]+$/.test(id)||!['helped','independent'].includes(status)))return initial();
   if(v.assistedScenes===undefined)v.assistedScenes=[];
   if(!Array.isArray(v.assistedScenes)||v.assistedScenes.some(n=>!Number.isInteger(n)||n<0||n>13))return initial();
   if(v.completed&&(!endingReady(v)||v.furthest!==13))return initial();
   if(Object.entries(v.cases).some(([k,c])=>c.pending&&actionKey[v.scene]!==k))return initial();
   return JSON.parse(JSON.stringify(v));
  }catch{return initial();}
 }
 const api={initial,reduce,canAdvance,canConfirm,restore,requirements,choices,caseKey,outcome,allFaces,AUTO,DAMI,faces,readyEvidence};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TransparencyEngine=api;
})(typeof window==='undefined'?globalThis:window);
