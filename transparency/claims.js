(function(root){
 'use strict';
 const stamps={confirmed:'자료로 확인됨',unknown:'자료로는 알 수 없음',different:'자료와 다름'};
 const claims={
  3:[
   {id:'p-rule',speaker:'앱',text:'친구의 중요도가 아니라 시선이 모일 위치를 예측해 중심을 고릅니다.',evidence:'P2',stamp:'confirmed',note:'도구가 밝힌 기준은 친구의 중요도가 아닌 시선 예측 위치다.',hint:'도구가 무엇을 기준으로 삼는지 안내문과 비교해 보자.'},
   {id:'p-run',speaker:'모아',text:'이번 사진은 가장 높은 예측값의 위치를 중심으로 잘렸어.',evidence:'P3',stamp:'confirmed',note:'최고 예측값 8의 위치와 실제 자르기 중심이 일치한다.',hint:'P2의 규칙을 이번 실행 중심과 대조해 보자.'},
   {id:'p-why',speaker:'루루',text:'이 기록이면 왜 오른쪽 값이 높아졌는지 모두 알 수 있어.',evidence:'P3',stamp:'unknown',note:'왜 오른쪽 예측값이 높아졌는지는 이 기록만으로 알 수 없다.',hint:'숫자와 위치가 남아 있다는 사실이 그 숫자의 이유까지 알려 줄까?'},
   {id:'p-worth',speaker:'담이',text:'도구 안내에 적힌 자르기 기준은 친구의 중요도야.',evidence:'P2',stamp:'different',note:'친구의 중요도를 판정한다는 해석은 도구 안내와 다르다.',hint:'안내문이 밝힌 기능과 하지 않는 기능을 구분해 보자.'}
  ],
  7:[
   {id:'w-mark',speaker:'교사',text:'보고서에는 원고의 일부 문장에 의심 표시가 있어.',evidence:'W1',stamp:'confirmed',note:'보고서의 일부 문장에 AI 작성 의심 표시가 있다.',hint:'보고서에 실제로 보이는 것과 그 표시를 해석한 것을 나누자.'},
   {id:'w-author',speaker:'마을 사람',text:'이 도구는 작성 과정을 직접 확인해서 표시해요.',evidence:'W2',stamp:'different',note:'작성 과정을 직접 확인했다는 해석은 도구 안내와 다르다.',hint:'문장 패턴을 추정하는 것과 작성 과정을 직접 보는 것은 같을까?'},
   {id:'w-draft',speaker:'루루',text:'초안이 있으니, 기록에 없는 과정까지 내가 썼다는 게 증명돼.',evidence:'W3',stamp:'unknown',note:'초안은 일부 기록이다. 기록에 없는 모든 작성 과정은 알 수 없다.',hint:'남아 있는 초안이 보여 주는 범위와 기록에 없는 범위를 나누자.'},
   {id:'w-reason',speaker:'교사',text:'이번 문장이 표시된 구체적인 이유를 알 수 있어.',evidence:'W2',stamp:'unknown',note:'이번 문장이 표시된 구체적 이유는 제공되지 않았다.',hint:'일반적인 작동 방식이 이번 문장에 대한 구체적 설명일까?'}
  ],
  11:[
   {id:'f-confirm',speaker:'점원',text:'AI가 문제를 일으킨 사람이라고 확정했어요.',evidence:'F1',stamp:'different',note:'알림은 직원 확인을 요청했다. 신원이나 잘못을 확정하지 않았다.',hint:'확정했다는 말과 확인이 필요하다는 말을 대조해 보자.'},
   {id:'f-person',speaker:'마을 사람',text:'비교 사진을 보니 밤이는 등록된 사진 속 사람과 같아요.',evidence:'F2',stamp:'unknown',note:'흐릿하고 가려진 비교 사진만으로 같은 사람인지 알 수 없다.',hint:'닮아 보이는 인상과 신원을 확정할 수 있는 근거를 구분하자.'},
   {id:'f-policy',speaker:'모아',text:'가게의 대응 지침에는 경고가 뜨면 즉시 입장을 제한하라고 적혀 있어.',evidence:'F3',stamp:'confirmed',note:'확인 요청과 달리 운영 지침은 즉시 입장을 제한하도록 한다.',hint:'알림의 확인 요청과 운영 지침에 적힌 행동을 따로 읽어 보자.',evidenceHints:{F1:'알림에는 직원 확인 필요가 있어. 그런데 즉시 제한 지침은 어디에 적혀 있지?',F2:'사진의 한계는 보았어. 가게가 무엇을 하도록 정했는지는 다른 자료에 있어.'}},
   {id:'f-check',speaker:'앱',text:'유사한 얼굴이 감지되었으니 직원 확인이 필요합니다.',evidence:'F1',stamp:'confirmed',note:'앱이 알린 것은 유사 얼굴 감지와 직원 확인 필요다.',hint:'알림에 적힌 요청 자체를 확인하자. 점원의 해석을 더하지 말자.'}
  ]
 };
 const evidenceHints={P1:'P1은 원본과 게시 목적을 보여줘. 도구의 기준이나 실행 기록도 찾아보자.',P2:'P2는 일반적인 도구 안내야. 이번 실행에서 일어난 일은 따로 기록돼 있어.',P3:'P3은 이번 값과 위치야. 도구가 밝힌 기능은 안내문에서 확인하자.',W1:'W1에는 표시가 있어. 도구의 한계나 작성 과정은 다른 자료와 대조하자.',W2:'W2는 도구의 기능과 한계야. 원고에 남은 실제 기록도 찾아보자.',W3:'W3는 작성 과정의 일부야. 도구가 무엇을 직접 확인하는지는 안내문을 보자.',F1:'F1은 앱의 알림이야. 비교 사진이나 가게 지침과 구분하자.',F2:'F2는 비교 사진이야. 앱의 문장이나 가게 지침을 보여 주지는 않아.',F3:'F3은 직원 발언과 운영 지침이야. 앱의 원래 알림과 구분하자.'};
 function find(scene,id){return (claims[scene]||[]).find(c=>c.id===id);}
 function feedback(claim,evidence,stamp){if(!evidence)return '먼저 근거 자료 하나를 선택해 주세요.';if(evidence!==claim.evidence)return claim.evidenceHints?.[evidence]||evidenceHints[evidence]||'이 주장과 직접 연결되는 자료를 찾아보자.';if(stamp!==claim.stamp)return claim.hint;return claim.note;}
 const api={claims,stamps,find,feedback};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TransparencyClaims=api;
})(typeof window==='undefined'?globalThis:window);
