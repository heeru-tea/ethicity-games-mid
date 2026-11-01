window.TransparencyStory = (()=>{
 const s='assets/s01/', r='assets/remaining/';
 const art={backgrounds:[r+'bg-repair-shop.png',s+'bg-festival-board.png',r+'bg-school-corridor.png',r+'bg-bakery-entrance.png'],moa:s+'moa-attentive.png',lulu:s+'lulu-concerned.png',dami:s+'dami-hurt.png',bami:r+'bami-concerned.png',teacher:r+'teacher-listening.png',clerk:r+'clerk-hesitant.png',clerkOpen:r+'clerk-reconsidering.png',luluPaper:r+'lulu-manuscript.png',photo:s+'festival-group-original.png',faces:r+'face-comparison-fictional.png',expressions:r+'moa-expressions.png',props:r+'props-atlas.png'};
 const names={moa:'모아',lulu:'루루',luluPaper:'루루',dami:'담이',bami:'밤이',teacher:'선생님',clerk:'점원',clerkOpen:'점원',town:'마을 사람들',classmate:'반 친구',app:'앱 알림'};
 const bgNames=['저녁 골목과 수리점','축제 게시판 앞','학교 복도','빵집 입구'];
 // 판단 세 갈래. 학습 목표: 자료로 확인된 것 / 자료로는 알 수 없는 것 / 자료와 다른 것을 나눈다.
 const stamps={confirmed:'자료로 확인돼',unknown:'자료로는 알 수 없어',different:'자료와 달라'};
 const intro={
  title:'다섯 친구가 찍은 사진에서, 담이 얼굴만 잘렸다.',
  lines:[['town','이유를 물으면 다들 말해. “시스템이 그렇게 정했대.”'],['moa','정말 그럴까? 직접 확인해 보자.']],
  plan:'사건은 세 개야. 사건마다 궁금한 것 하나를 직접 확인하고, 어떻게 할지 골라.',
  note:'이 마을과 자료는 창작이에요. 실제 사례에서 문제의 구조만 참고했어요.'
 };
 const drafts={before:'긴 여행 끝에 주인공은 집 앞에 도착했다.',draft:'문을 열자 모두가 돌아와 있었다. 주인공은 기뻤다.',memo:'결말이 너무 갑작스러움. 문을 열기 전에 망설이는 장면 넣기.',revision:'주인공은 손잡이를 잡고도 한참 서 있었다. 안에서 익숙한 웃음소리가 들렸다.'};
 const alertText='등록된 사진과 비슷한 얼굴이 감지되었습니다. 직원 확인이 필요합니다.';
 const cases={
  photo:{name:'사진 사건',title:'잘린 사진',bg:1,cast:['moa','lulu','dami'],
   hook:[['lulu','축제 사진을 올리려는데, 앱이 알아서 잘랐어.'],['dami','내 얼굴은 왜 잘렸지?']],
   question:'AI는 무엇을 기준으로 잘랐을까?',
   checks:[
    {id:'photo-original',label:'원본 보기',name:'원본 사진',task:'원본에서 담이를 찾아 눌러 봐.',
     finding:[['dami','원본에는 내가 앞줄 가운데에 있어.']],more:'원본에는 다섯 친구가 모두 나와요. 자동으로 자른 사진에는 오른쪽 부분만 남았어요.'},
    {id:'photo-rule',label:'AI의 자르기 기준 보기',name:'AI의 자르기 기준',task:'사진의 세 구역을 눌러 AI가 매긴 점수를 확인해 봐.',
     guide:'AI 안내: 사진의 각 부분에 눈길이 모일 정도를 예상해 점수를 매기고, 점수가 가장 높은 곳을 중심으로 자릅니다.',
     finding:[['moa','AI는 눈길이 모일 것으로 예상한 곳을 중심으로 잘랐어.']],more:'2·5·8은 게임에서 만든 가상 점수예요. 정답 확률이나 친구의 가치를 뜻하지 않아요. 안내에 따르면 이 AI는 친구 사이나 사진을 올리는 목적을 따지지 않아요.'}
   ],
   judge:{who:'lulu',text:'이번 사진은 점수가 가장 높은 곳을 중심으로 잘렸어.',
    feedback:{confirmed:'맞아. 가장 높은 점수 8이 있는 오른쪽이 중심이야. 기록과 같아.',unknown:'세 구역의 점수와 잘린 중심이 모두 기록에 나와 있어. 오른쪽 8이 중심이니, 자료로 확인돼.',different:'가장 높은 점수 8이 있는 오른쪽이 중심이야. 기록과 같으니, 자료로 확인돼.'},
    after:'기준대로 잘렸다는 것과, 그 사진이 우리에게 맞는다는 것은 다른 이야기야.'},
   choose:{question:'친구들 소개에 어떤 사진을 쓸까?',options:[
    {id:'auto',label:'자동으로 자른 사진',title:'자동으로 자른 사진을 올렸어',status:'게시판: 담이 얼굴이 빠진 사진',
     reaction:[['dami','왜 잘렸는지는 알겠어. 그래도 이건 우리 사진 같지 않아.']],feedback:'기준을 알게 됐다고, 결과가 우리 목적에 맞는 건 아니야.'},
    {id:'all',label:'모두 나오는 사진',title:'모두 나오는 사진을 올렸어',status:'게시판: 다섯 친구가 모두 나온 사진',
     reaction:[['dami','이제 다 보여. 이게 우리가 올리고 싶던 사진이야.']],feedback:'AI가 고른 중심이 우리 목적과 다르면, 사람이 범위를 고를 수 있어.'}
   ]},
   unknown:'AI가 왜 오른쪽에 눈길이 모인다고 예상했는지는 아직 몰라.',
   more:'이 사진 한 장으로는 다른 사진에서도 같은 친구가 자주 잘리는지 알 수 없어요.'},
  writing:{name:'글 검사 사건',title:'의심 표시가 붙은 원고',bg:2,cast:['moa','luluPaper','teacher'],
   hook:[['lulu','검사기가 내 발표 원고에 ‘AI 작성 의심’ 표시를 했어.'],['teacher','표시만 보고 정하지는 않을게. 같이 살펴보자.']],
   question:'의심 표시만으로 AI가 썼다고 할 수 있을까?',
   checks:[
    {id:'writing-guide',label:'AI 안내 보기',name:'검사기 안내',task:'검사기가 무엇을 보고 표시하는지 읽어 봐.',
     guide:['문장의 모양을 보고 AI가 썼을 가능성을 추정합니다.','사람이 쓴 글에도 표시될 수 있습니다.','글을 쓰는 과정은 직접 확인하지 않습니다.'],
     finding:[['moa','이 표시는 ‘의심’이야. AI가 썼다고 확정한 게 아니야.']],more:'이 문장이 왜 표시됐는지, 구체적인 이유는 보고서에 나와 있지 않아요.'},
    {id:'writing-history',label:'작성 기록 보기',name:'루루의 작성 기록',task:'표시된 문장을 루루의 기록에서 찾아 눌러 봐.',
     finding:[['lulu','결말이 갑작스러워서, 문 앞에서 망설이는 장면을 넣었어.'],['moa','고친 흔적은 남았어. 그래도 쓰는 과정 전부를 보여 주진 않아.']],
     more:'과제 규칙: 표현 조언을 받는 AI 사용은 밝히면 괜찮아요. 이야기 본문을 AI가 대신 쓰게 하는 것은 안 돼요. 그러니 AI를 썼는지와 규칙을 어겼는지는 따로 봐야 해요.'}
   ],
   judge:{who:'classmate',text:'표시가 떴으니, 루루가 AI로 본문을 썼어.',
    feedback:{unknown:'맞아. 표시는 ‘의심’이고, 초안은 과정의 일부야. 이것만으로는 알 수 없어.',confirmed:'검사기 안내를 다시 봐. 표시는 추정이고, 사람이 쓴 글에도 뜰 수 있어. 그래서 자료로는 알 수 없어.',different:'초안은 고친 흔적의 일부야. 루루가 AI를 안 썼다는 것까지 보여 주진 않아. 그래서 자료로는 알 수 없어.'},
    after:'의심과 확정은 달라. 확정하려면 다른 확인이 더 필요해.'},
   choose:{question:'루루의 발표, 어떻게 할까?',options:[
    {id:'detector',label:'표시를 근거로 발표에서 빼기',title:'루루가 발표에서 빠졌어',status:'발표: 빠짐',
     reaction:[['lulu','내가 고친 부분은 보지도 않고 끝나는 거예요?']],feedback:'의심 표시를 확정처럼 써 버렸어.'},
    {id:'review',label:'기록과 루루의 설명을 함께 보기',title:'루루가 발표를 했어',status:'발표: 함',
     reaction:[['teacher','이 표시만으로는 규칙을 어겼다고 볼 수 없어. 발표는 그대로 하자.'],['lulu','의심받은 기분은 남지만, 내 설명을 들어 줘서 다행이야.']],feedback:'표시와 기록, 루루의 설명을 나눠서 봤어.'},
    {id:'draft',label:'초안이 있으니 검사 끝내기',title:'초안 하나로 검사를 끝냈어',status:'발표: 함',
     reaction:[['lulu','그런데 초안 하나면 다 증명되는 거예요?']],feedback:'초안은 쓰는 과정의 일부만 보여 줘.'}
   ]},
   unknown:'그 문장이 왜 표시됐는지는 아직 몰라.',
   more:'검사기의 표시, 루루의 작성 기록, 과제 규칙은 각각 다른 자료예요.'},
  face:{name:'얼굴 인식 사건',title:'들어갈 수 없는 빵집',bg:3,cast:['moa','bami','clerk'],
   hook:[['clerk','시스템이 전에 문제를 일으킨 손님이래요. 들어오실 수 없어요.'],['bami','저는 여기 처음 왔는데요?']],
   question:'‘닮았다’는 알림으로 입장을 막아도 될까?',
   checks:[
    {id:'face-alert',label:'알림 기록 보기',name:'알림 기록',task:'앱 알림에 실제로 적힌 말을 읽어 봐.',
     finding:[['moa','알림은 ‘닮았으니 확인해 달라’까지만 말해.']],more:'알림은 누구인지, 잘못을 했는지 확정하지 않아요. 어떤 얼굴 특징이 얼마나 영향을 줬는지도 나와 있지 않아요.'},
    {id:'face-clerk',label:'점원의 말 보기',name:'점원의 말',task:'알림과 다른 부분을 점원의 말에서 찾아 눌러 봐.',
     finding:[['moa','점원은 ‘닮았다’를 ‘그 손님이다’로 바꿔 말했어.']],more:'가게 규칙에는 “경고가 뜨면 바로 입장을 막는다”라고 적혀 있어요. 알림의 ‘직원 확인 필요’와 다른 내용이에요.'},
    {id:'face-photo',label:'얼굴 비교 사진 보기',name:'얼굴 비교 사진',task:'알림이 비교한 사진을 살펴봐.',
     finding:[['moa','흐리고 가려져서, 이 사진만으로 같은 고양이인지 알 수 없어.']],more:'사진이 흐리다고 해서 이번 알림이 틀린 이유가 밝혀진 것도 아니에요.'}
   ],
   clerkSegments:[
    {id:'system',text:'시스템이 알려 줬어요.',hint:'시스템이 알림을 띄운 건 맞아. 알림에 뭐라고 적혔는지 비교해 봐.'},
    {id:'person',text:'전에 문제를 일으킨 그 손님이래요.',found:'알림은 ‘비슷한 얼굴’이라고만 했어. ‘그 손님’이라고 정한 건 점원이야.'},
    {id:'rule',text:'경고가 뜨면 바로 막으라고 배웠어요.',found:'알림은 ‘확인해 달라’고 했어. ‘바로 막아라’는 가게 규칙이야.'}
   ],
   judge:{who:'clerk',text:'AI가 이 손님을 그 문제 손님이라고 확정했어요.',
    feedback:{different:'맞아. 알림은 ‘비슷하니 확인해 달라’였어. 확정한 건 사람이었어.',confirmed:'알림 기록을 다시 봐. ‘확인이 필요하다’고 적혀 있어. 그래서 자료와 달라.',unknown:'알림에 적힌 말은 기록에 남아 있어. ‘확인 필요’와 ‘확정’은 다르니까, 자료와 달라.'},
    after:'같은 고양이인지는 아직 몰라. 그래도 확인 없이 막았다는 건 기록에 남아 있어.'},
   choose:{question:'밤이를 어떻게 할까?',options:[
    {id:'maintain',label:'안내문을 붙이고 계속 막기',title:'안내문만 붙었어',status:'입장 제한 중',
     reaction:[['bami','틀릴 수 있다는 말은 들었어요. 그런데 저는 계속 밖에 있네요.']],feedback:'설명은 늘었지만, 막은 조치는 그대로야.'},
    {id:'release',label:'막지 않고 담당자가 다시 확인하기',title:'빵집 문이 열렸어',status:'입장 제한 해제',
     reaction:[['clerkOpen','알림을 확정처럼 말했어요. 알림만으로 막은 건 지금 풀게요.'],['bami','빵은 찾을게요. 다음에 또 막힐까 봐 걱정돼요.']],feedback:'설명을 듣는 것과 잘못된 조치를 바로잡는 것은 달라. 이번엔 조치를 고쳤어.',
     unknown:'가게가 약속한 점검을 실제로 하는지는 아직 몰라.',more:'가게는 바로 막는 규칙을 멈추고, 알림을 확인하는 방법을 점검하겠다고 했어요. 점검을 마쳤는지는 아직 확인되지 않았어요.'},
    {id:'crowd',label:'손님들에게 사진을 보여 주고 묻기',title:'사진을 돌리자는 말이 나왔어',status:'입장 제한 중',
     reaction:[['bami','제 사진이 모르는 손님들에게 돌아다니는 건가요?']],feedback:'확인은 필요한 자료만 가지고, 맡은 담당자가 해야 해.',more:'게임에서는 실제 손님 명단이나 사진을 열지 않았어요. 밤이가 그 손님인지, 입장 문제도 아직 풀리지 않았어요.'}
   ]},
   unknown:'밤이가 등록된 사진 속 고양이와 같은지는 아직 아무도 확인하지 않았어.',
   more:'얼굴 비교 사진만으로 같은 고양이인지 단정할 수 없어요.'}
 };
 const ending={title:'닫히지 않은 질문',
  lines:[['lulu','이제 상자 속을 다 알게 된 거야?'],['moa','아니. 그래도 무엇을 물어야 하는지는 알게 됐어.']],
  question:'새 앱이 모아에게 ‘밤하늘 관찰 모임’을 추천했어. 무엇부터 물어볼까?',
  asks:[['input','어떤 정보를 썼어?','관심사로 고른 ‘별’과 ‘야외 활동’을 썼어요.'],['criteria','무엇을 기준으로 골랐어?','관심사와 이어진 모임을 먼저 골랐어요. 순위를 매긴 자세한 이유는 알려 주지 않았어요.'],['unknown','확인하지 못한 건 뭐야?','모임이 실제로 열리는지, 집에 오는 교통편은 확인하지 못했어요.']],
  afterAsk:'세 질문 모두 상자를 여는 질문이야.',
  closing:['moa','설명이 기록과 맞는지, 결과가 맞는지, 무엇을 해도 되는지는 따로 살펴야 해.'],
  quote:'상자를 여는 첫 번째 도구는, 질문이었다.'};
 return {art,names,bgNames,stamps,intro,drafts,alertText,cases,ending};
})();
