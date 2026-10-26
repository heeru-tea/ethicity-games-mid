/* Map-first shell; the existing text editor and map gestures share Session mutations. */
(function(root){
  'use strict';
  var PB=root.PB,S=PB.Session,original=PB.UI.plan,state={session:null,phase:null,text:false,ai:false,bus:null,person:null};
  function app(){return PB.App;}
  function button(id,text,fn){return app().el('button',{id:id,type:'button','class':'btn',onclick:fn},text);}
  function redraw(){app().keepFocus=true;app().render();}
  function assign(num){
    if(state.bus==null)return false;
    if(!S.canAssign(app().s,state.bus,num)){document.querySelector('#map-plan-message').textContent='이 버스는 해당 노선에 배정할 수 없어요.';return true;}
    PB.UI.planAssignBus(state.bus,num);state.bus=null;redraw();return true;
  }
  function routeAt(x,y){
    var stage=document.querySelector('#stage').getBoundingClientRect(),best=null,distance=26;
    S.routesInOrder(app().s).forEach(function(r){for(var i=1;i<r.nodes.length;i++){
      var a=app().nodeXY(r.nodes[i-1]),b=app().nodeXY(r.nodes[i]),p=app().view.project(a.x,a.y),q=app().view.project(b.x,b.y);
      var dx=q.left-p.left,dy=q.top-p.top,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((x-stage.left-p.left)*dx+(y-stage.top-p.top)*dy)/l)):0;
      var d=Math.hypot(x-stage.left-p.left-t*dx,y-stage.top-p.top-t*dy);if(d<distance){distance=d;best=r.num;}
    }});return best;
  }
  function drag(token,id){var start=null;
    token.addEventListener('pointerdown',function(e){if(e.button!==0)return;start={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false};token.setPointerCapture(e.pointerId);});
    token.addEventListener('pointermove',function(e){if(!start)return;start.moved=start.moved||Math.hypot(start.x-e.clientX,start.y-e.clientY)>7;if(start.moved){token.classList.add('dragging');token.style.transform='translate('+(e.clientX-start.x)+'px,'+(e.clientY-start.y)+'px)';}});
    function clear(){start=null;token.classList.remove('dragging');token.style.transform='';}
    token.addEventListener('pointerup',function(e){if(!start)return;var moved=start.moved;clear();if(moved){state.ignoreClickUntil=performance.now()+350;state.bus=id;var num=routeAt(e.clientX,e.clientY);if(num!=null)assign(num);else{state.bus=null;redraw();}}});
    token.addEventListener('pointercancel',clear);token.addEventListener('lostpointercapture',clear);
  }
  function positionPeople(){
    if(!app()||!app().s||document.body.dataset.screen!=='plan')return;
    var layer=document.querySelector('#map-people');if(!layer)return;
    var grouped={};PB.Demand.residents(app().s.config,app().s.phase).forEach(function(rd){var el=document.querySelector('#resident-map-'+rd.id);if(!el)return;var n=app().nodeXY(rd.o),p=app().view.project(n.x,n.y),i=grouped[rd.o]||0;grouped[rd.o]=i+1;el.style.left=(p.left+i*38-18)+'px';el.style.top=(p.top-62)+'px';});
    var svg=document.querySelector('#resident-destination');svg.textContent='';if(!state.person)return;
    var rd=PB.Demand.residents(app().s.config,app().s.phase).filter(function(r){return r.id===state.person;})[0];if(!rd)return;
    var a=app().nodeXY(rd.o),b=app().nodeXY(rd.d),p=app().view.project(a.x,a.y),q=app().view.project(b.x,b.y),line=document.createElementNS('http://www.w3.org/2000/svg','line');
    [['x1',p.left],['y1',p.top],['x2',q.left],['y2',q.top]].forEach(function(k){line.setAttribute(k[0],k[1]);});svg.appendChild(line);
  }
  PB.UI.plan=function(App,panel){
    if(state.session!==App.s||state.phase!==App.s.phase)state={session:App.s,phase:App.s.phase,text:false,ai:false,bus:null,person:null};
    var result=original(App,panel),stage=document.querySelector('#stage');
    ['plan-toolbar','map-people','resident-destination','plan-ai-popover'].forEach(function(id){var e=document.getElementById(id);if(e)e.remove();});
    var bar=App.el('div',{id:'plan-toolbar','aria-label':'노선 설계 도구'}),routes=panel.querySelector('.route-tabs');
    routes.addEventListener('click',function(e){var chip=e.target.closest('.route-tab');if(chip&&state.bus!=null){e.preventDefault();e.stopImmediatePropagation();assign(Number(chip.id.replace('route-','')));}},true);
    var primary=App.el('div',{'class':'map-tools-row'});primary.appendChild(routes);primary.appendChild(panel.querySelector('#btn-undo'));bar.appendChild(primary);
    var tokens=App.el('div',{'class':'bus-tokens',role:'group','aria-label':'버스를 선택하고 노선을 누르거나 노선으로 끌어 놓으세요'});
    App.s.draft.buses.forEach(function(b){var text='▰ '+b.id+'호차',token=button('bus-token-'+b.id,text,function(){if(performance.now()<(state.ignoreClickUntil||0))return;state.bus=state.bus===b.id?null:b.id;redraw();});
      token.classList.add('bus-token');token.setAttribute('aria-pressed',String(state.bus===b.id));token.setAttribute('aria-label',b.id+'호차 · '+(b.routeNum==null?'쉬는 중':b.routeNum+'번 노선')+' · 선택 후 노선을 누르세요');token.title=token.getAttribute('aria-label');
      token.appendChild(App.el('small',null,b.routeNum==null?'쉬기':b.routeNum+'번'));if(b.routeNum!=null)token.style.borderColor=App.routeStyle(b.routeNum).color;drag(token,b.id);tokens.appendChild(token);
    });
    if(state.bus!=null)tokens.appendChild(button('bus-rest','쉬게 하기',function(){assign(null);}));bar.appendChild(tokens);
    var actions=App.el('div',{'class':'map-tools-row'}),text=button('plan-text-toggle',state.text?'텍스트 닫기':'텍스트로 편집',function(){state.text=!state.text;redraw();}),ai=button('plan-ai-toggle','AI 제안',function(){state.ai=!state.ai;redraw();});
    text.setAttribute('aria-expanded',String(state.text));text.setAttribute('aria-controls','panel');ai.setAttribute('aria-expanded',String(state.ai));ai.setAttribute('aria-controls','plan-ai-popover');actions.appendChild(text);actions.appendChild(ai);actions.appendChild(panel.querySelector('#btn-depart'));bar.appendChild(actions);
    var message=panel.querySelector('#plan-message');bar.appendChild(App.el('p',{id:'map-plan-message',role:'status'},state.bus!=null?state.bus+'호차를 배정할 노선을 누르세요.':message.textContent));
    var issues=panel.querySelector('#plan-errors');if(issues.textContent)bar.appendChild(issues);
    stage.parentNode.insertBefore(bar,stage.nextSibling);
    document.body.classList.toggle('plan-text-open',state.text);
    var pop=App.el('div',{id:'plan-ai-popover'}),tools=panel.querySelector('#ai-tools');pop.hidden=!state.ai;tools.open=true;pop.appendChild(tools);stage.appendChild(pop);
    var people=App.el('div',{id:'map-people','aria-label':'주요 인물'});PB.Demand.residents(App.s.config,App.s.phase).forEach(function(rd){
      var face=button('resident-map-'+rd.id,'',function(){state.person=state.person===rd.id?null:rd.id;redraw();});face.className='map-person resident-face '+rd.id;
      face.setAttribute('aria-label',rd.name+' · '+App.nodeName(rd.o)+'에서 '+App.nodeName(rd.d)+'까지');face.setAttribute('aria-pressed',String(state.person===rd.id));
      face.appendChild(App.el('img',{src:'assets/art/'+(['yuna','daeun'].indexOf(rd.id)>=0?'interlude-cheer.webp':'portrait-'+rd.id+'-calm.webp'),alt:''}));face.appendChild(App.el('span',{'class':'map-person-name'},rd.name));people.appendChild(face);
    });stage.appendChild(people);var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='resident-destination';svg.setAttribute('aria-hidden','true');stage.appendChild(svg);
    var routeClick=App.onRouteClick;App.onRouteClick=function(num,index){if(!assign(num))routeClick(num,index);};
    requestAnimationFrame(positionPeople);return result;
  };
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.body.dataset.screen==='plan'&&!document.querySelector('dialog[open]')){state.bus=null;state.person=null;state.ai=false;redraw();}});
  root.setInterval(positionPeople,150);
})(window);
