(function(root){
 'use strict';
 // 장면 0 = 프롤로그, 1~4 사진, 5~8 글 검사, 9~12 얼굴 인식, 13 = 마지막.
 // 사건마다 네 단계: hook(궁금한 것) → check(직접 확인 + 판단 하나) → choose(선택) → result(결과).
 const CASES=['photo','writing','face'],STEPS=['hook','check','choose','result'];
 const checks={photo:['photo-original','photo-rule'],writing:['writing-guide','writing-history'],face:['face-alert','face-clerk','face-photo']};
 const choices={photo:['auto','all'],writing:['detector','review','draft'],face:['maintain','release','crowd']};
 const stamps=['confirmed','unknown','different'];
 const answers={photo:'confirmed',writing:'unknown',face:'different'};
 const questions=['input','criteria','unknown'];
 const AUTO=[900,50,600,400],ALL=[190,0,1200,800];
 const faces=[[300,210,220,180],[460,35,240,300],[695,350,165,150],[815,55,220,230],[1050,105,230,210]];
 function caseKey(scene){return scene>=1&&scene<=12?CASES[Math.floor((scene-1)/4)]:null;}
 function stepOf(scene){return scene===0?'intro':scene===13?'end':STEPS[(scene-1)%4];}
 function sceneOf(key,step){return 1+CASES.indexOf(key)*4+STEPS.indexOf(step);}
 function initial(){return {version:1,revision:4,scene:0,furthest:0,evidence:[],judgments:{photo:null,writing:null,face:null},cases:{photo:{first:null,final:null},writing:{first:null,final:null},face:{first:null,final:null}},question:null,completed:false};}
 const clone=v=>JSON.parse(JSON.stringify(v));
 function checked(s,key){return checks[key].every(id=>s.evidence.includes(id));}
 function judged(s,key){return checked(s,key)&&!!s.judgments[key];}
 function allFaces(rect){const [x,y,w,h]=rect;return faces.every(([fx,fy,fw,fh])=>fx>=x&&fy>=y&&fx+fw<=x+w&&fy+fh<=y+h);}
 function canAdvance(s){
  const k=caseKey(s.scene),step=stepOf(s.scene);
  if(step==='intro'||step==='hook')return true;
  if(step==='check')return judged(s,k);
  if(step==='choose'||step==='result')return !!s.cases[k].final;
  return false; // 마지막 장면은 질문(ask)으로 끝난다.
 }
 function reduce(state,action){
  const s=clone(state),k=caseKey(s.scene),step=stepOf(s.scene);
  if(action.type==='check'&&k&&checks[k].includes(action.id)&&!s.evidence.includes(action.id))s.evidence.push(action.id);
  if(action.type==='judge'&&step==='check'&&checked(s,k)&&!s.judgments[k]&&stamps.includes(action.stamp))s.judgments[k]=action.stamp;
  if(action.type==='choose'&&step==='choose'&&judged(s,k)&&choices[k].includes(action.id)){
   const c=s.cases[k];if(!c.first)c.first=action.id;c.final=action.id;s.scene++;s.furthest=Math.max(s.furthest,s.scene);
  }
  if(action.type==='next'&&s.scene<13&&canAdvance(s)){s.scene++;s.furthest=Math.max(s.furthest,s.scene);}
  if(action.type==='revisit'&&Number.isInteger(action.scene)&&action.scene>=0&&action.scene<=s.furthest)s.scene=action.scene;
  if(action.type==='ask'&&step==='end'&&questions.includes(action.id)&&CASES.every(c=>s.cases[c].final)){if(!s.question)s.question=action.id;s.completed=true;}
  return s;
 }
 function outcome(s,key){const id=s.cases[key].final;return {id,restricted:key==='face'?id!=='release':undefined,excluded:key==='writing'?id==='detector':undefined,rect:key==='photo'?(id==='all'?ALL:AUTO):undefined};}
 // 진행 위치가 앞 단계 조건과 맞는지 검사한다(손상·조작된 저장 방지).
 function consistent(v){
  for(const key of CASES){const c=v.cases[key];
   if(c.final&&!c.first)return false;if(c.first&&!c.final)return false;
   if(v.judgments[key]&&!checked(v,key))return false;
   if(v.furthest>=sceneOf(key,'choose')&&!judged(v,key))return false;
   if(v.furthest>=sceneOf(key,'result')&&!c.final)return false;
  }
  if(v.question&&!CASES.every(c=>v.cases[c].final))return false;
  if(v.completed!==!!v.question)return false;
  return true;
 }
 // revision 3 이전 저장(주장 판정 방식)을 새 흐름으로 옮긴다. 장면 의미가 바뀌었으므로 사건 단위로만 이어 간다.
 function migrate(v){
  const s=initial(),ev={P1:'photo-original',P2:'photo-rule',P3:'photo-rule',W2:'writing-guide',W3:'writing-history',F1:'face-alert',F3:'face-clerk',F2:'face-photo'};
  if(!Array.isArray(v.evidence)||!v.cases||typeof v.cases!=='object'||!Number.isInteger(v.scene)||v.scene<0||v.scene>13)return initial();
  s.evidence=[...new Set(v.evidence.map(id=>ev[id]).filter(Boolean))];
  const map={photo:{manual:'all',auto:'auto'},writing:{detector:'detector',review:'review',draft:'draft'},face:{crowd:'crowd',release:'release',maintain:'maintain'}};
  const oldIdx=v.scene===0?-1:v.scene===13?3:CASES.indexOf(caseKey(v.scene));
  CASES.forEach((key,i)=>{const c=v.cases[key]||{},fin=map[key][c.final]||null,first=map[key][c.first]||null;
   if(fin){s.cases[key]={first:first||fin,final:fin};if(!first||c.legacyFirst)s.cases[key].legacyFirst=true;}
   // 이전 판은 판단 방식이 달랐다. 그 사건을 지나갔다면 판단은 '이전 판에서 함'(legacy)으로 둔다.
   // 이전 판도 자료를 모두 연 뒤에만 조치를 고를 수 있었으므로, 조치가 있으면 자료 확인도 한 것으로 본다.
   if(fin&&!checked(s,key))s.evidence.push(...checks[key].filter(id=>!s.evidence.includes(id)));
   if(checked(s,key)&&(fin||i<oldIdx))s.judgments[key]='legacy';
  });
  const w=CASES.findIndex(key=>!s.cases[key].final),walk=w<0?3:w;
  if(oldIdx<0&&walk===0)s.scene=0;
  else if(walk>oldIdx)s.scene=oldIdx<0?0:sceneOf(CASES[oldIdx],'result');
  else if(walk===3)s.scene=13;
  else s.scene=sceneOf(CASES[walk],judged(s,CASES[walk])?'choose':'hook');
  s.furthest=s.scene;
  return consistent(s)?s:initial();
 }
 function restore(raw){
  try{const v=typeof raw==='string'?JSON.parse(raw):raw;
   if(!v||typeof v!=='object'||v.version!==1)return initial();
   if(v.revision!==4)return migrate(v);
   if(!Number.isInteger(v.scene)||v.scene<0||v.scene>13||!Number.isInteger(v.furthest)||v.furthest<v.scene||v.furthest>13)return initial();
   if(!Array.isArray(v.evidence)||v.evidence.some(id=>!CASES.some(k=>checks[k].includes(id))))return initial();
   if(!v.judgments||typeof v.judgments!=='object'||!v.cases||typeof v.cases!=='object'||typeof v.completed!=='boolean')return initial();
   if(v.question!==null&&!questions.includes(v.question))return initial();
   for(const key of CASES){const c=v.cases[key],j=v.judgments[key];
    if(!c||typeof c!=='object'||['first','final'].some(p=>c[p]!==null&&!choices[key].includes(c[p])))return initial();
    if(j!==null&&!stamps.includes(j)&&j!=='legacy')return initial();
   }
   if(!consistent(v))return initial();
   const s=initial();s.scene=v.scene;s.furthest=v.furthest;s.evidence=[...new Set(v.evidence)];s.question=v.question;s.completed=v.completed;
   for(const key of CASES){s.judgments[key]=v.judgments[key];s.cases[key]={first:v.cases[key].first,final:v.cases[key].final};if(v.cases[key].legacyFirst===true)s.cases[key].legacyFirst=true;}
   return s;
  }catch{return initial();}
 }
 const api={initial,reduce,canAdvance,restore,caseKey,stepOf,sceneOf,checked,judged,outcome,allFaces,CASES,checks,choices,stamps,answers,questions,AUTO,ALL,faces};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TransparencyEngine=api;
})(typeof window==='undefined'?globalThis:window);
