window.TransparencyStory = (()=>{
 const s='assets/s01/', r='assets/remaining/';
 const art={backgrounds:[r+'bg-repair-shop.png',s+'bg-festival-board.png',r+'bg-school-corridor.png',r+'bg-bakery-entrance.png'],moa:s+'moa-attentive.png',lulu:s+'lulu-concerned.png',dami:s+'dami-hurt.png',bami:r+'bami-concerned.png',teacher:r+'teacher-listening.png',clerk:r+'clerk-hesitant.png',clerkOpen:r+'clerk-reconsidering.png',luluPaper:r+'lulu-manuscript.png',photo:s+'festival-group-original.png',faces:r+'face-comparison-fictional.png',expressions:r+'moa-expressions.png',props:r+'props-atlas.png',librarian:r+'teacher-listening.png'};
 // 사건 4·5 새 그림(docs/codex-art-brief-4-5.md). 처음에는 지시서의 '대신 쓸 그림'을 쓰고, app.js가 시작할 때 base + '.webp'(게임용 사본) → '.png'(원본)을 불러 보아
 // 열리는 것이 있으면 그것으로 바꾼다. bg = 배경 배열 자리.
 art.backgrounds.push(r+'bg-school-corridor.png',r+'bg-repair-shop.png');
 Object.assign(art,{library:art.backgrounds[4],observatory:art.backgrounds[5],damiBooks:art.dami,moaPhone:art.moa,luluCasual:art.lulu});
 art.newArt={library:{base:'assets/s04/bg-school-library',bg:4},damiBooks:{base:'assets/s04/dami-books'},observatory:{base:'assets/s05/bg-observatory-hill',bg:5},moaPhone:{base:'assets/s05/moa-phone'},luluCasual:{base:'assets/s05/lulu-casual'}};
 const names={moa:'모아',lulu:'루루',luluPaper:'루루',dami:'담이',bami:'밤이',teacher:'선생님',clerk:'점원',clerkOpen:'점원',town:'마을 사람들',classmate:'반 친구',app:'앱 알림',
  librarian:'사서 선생님',libraryGuide:'추천 안내',recApp:'추천 앱',damiBooks:'담이',moaPhone:'모아',luluCasual:'루루'};
 const bgNames=['저녁 골목과 수리점','축제 게시판 앞','학교 복도','빵집 입구','학교 도서관','언덕 위 관측 데크'];
 // 판단 세 갈래. 학습 목표: 자료로 확인된 것 / 자료로는 알 수 없는 것 / 자료와 다른 것을 나눈다.
 const stamps={confirmed:'자료로 확인돼',unknown:'자료로는 알 수 없어',different:'자료와 달라'};
 const intro={
  title:'다섯 친구가 찍은 사진에서, 담이 얼굴만 잘렸다.',
  lines:[['town','이유를 물으면 다들 말해. “시스템이 그렇게 정했대.”'],['moa','정말 그럴까? 직접 확인해 보자.']],
  plan:'사건은 다섯 개야. 사건마다 궁금한 것 하나를 직접 확인하고, 어떻게 할지 골라.',
  note:'이 마을과 자료는 창작이에요. 실제 사례에서 문제의 구조만 참고했어요.'
 };
 const drafts={before:'긴 여행 끝에 주인공은 집 앞에 도착했다.',draft:'문을 열자 모두가 돌아와 있었다. 주인공은 기뻤다.',memo:'결말이 너무 갑작스러움. 문을 열기 전에 망설이는 장면 넣기.',revision:'주인공은 손잡이를 잡고도 한참 서 있었다. 안에서 익숙한 웃음소리가 들렸다.'};
 const history=[
  {id:'h1',time:'10월 2일 19:10',kind:'초안',text:drafts.draft,hint:'처음 쓴 초안이야. 표시된 문장과 비교해 봐.'},
  {id:'h2',time:'10월 2일 19:40',kind:'메모',text:drafts.memo,hint:'루루가 남긴 메모야. 본문 문장은 아니야.'},
  {id:'h3',time:'10월 3일 20:05',kind:'수정',text:'주인공은 손잡이를 잡고 잠시 서 있었다. 안에서 웃음소리가 들렸다.',hint:'비슷하지만 다른 문장이야. 낱말 하나하나 비교해 봐.'},
  {id:'h4',time:'10월 3일 20:30',kind:'수정',text:drafts.revision,target:true},
  {id:'h5',time:'10월 4일 07:50',kind:'수정',text:'제목을 ‘돌아온 저녁’에서 ‘문 앞에서’로 바꿈.',hint:'제목을 바꾼 기록이야. 표시된 본문 문장은 아니야.'}
 ];
 const alertText='등록된 사진과 비슷한 얼굴이 감지되었습니다. 직원 확인이 필요합니다.';
 const cases={
  photo:{name:'사진 사건',title:'잘린 사진',bg:1,cast:['moa','lulu','dami'],
   hook:[['lulu','축제 사진을 올리려는데, 앱이 알아서 잘랐어.'],['dami','내 얼굴은 왜 잘렸지?']],
   question:'AI는 무엇을 기준으로 잘랐을까?',
   checks:[
    {id:'photo-original',label:'원본 사진 보기',name:'원본 사진',task:'원본에서 담이를 찾아 눌러 봐.',fact:'원본 사진에는 다섯 친구가 모두 있고, 담이는 앞줄 가운데에 있다.',
     finding:[['dami','원본에는 내가 앞줄 가운데에 있어.']],more:'원본에는 다섯 친구가 모두 나와요. 자동으로 자른 사진에는 오른쪽 부분만 남았어요.'},
    {id:'photo-rule',label:'AI의 자르기 기준 보기',name:'AI의 자르기 기준',task:'사진의 세 구역을 눌러 AI가 매긴 점수를 확인해 봐.',
     guide:'AI 안내: 사진의 각 부분에 눈길이 모일 정도를 예상해 점수를 매기고, 점수가 가장 높은 곳을 중심으로 자릅니다. 친구 사이나 사진을 올리는 목적은 따지지 않습니다.',fact:'앱은 세 구역 가운데 점수가 가장 높은 오른쪽(8점)을 중심으로 잘랐다.',
     finding:[['moa','AI는 눈길이 모일 것으로 예상한 곳을 중심으로 잘랐어.']],more:'2·5·8은 이야기 속 AI가 매긴 가상 점수예요. 정답 확률이나 친구의 가치를 뜻하지 않아요.'}
   ],
   judges:[
    {who:'lulu',src:['photo-rule'],text:'이번 사진은 점수가 가장 높은 곳을 중심으로 잘렸어.',right:'맞아, 자료로 확인돼. 가장 높은 점수 8이 있는 오른쪽이 중심이야.',wrong:'세 구역 점수와 잘린 중심을 다시 봐. 오른쪽 8이 중심이야.'},
    {who:'classmate',src:['photo-rule'],text:'AI는 친구들 사이가 얼마나 가까운지 보고 잘랐대.',right:'맞아, 자료와 달라. 안내에는 친구 사이는 따지지 않는다고 적혀 있어.',wrong:'AI 안내를 다시 읽어 봐. 친구 사이는 따지지 않는다고 적혀 있어.'},
    {who:'dami',src:['photo-rule'],text:'이 기록을 보면 왜 오른쪽에 눈길이 더 모인다고 봤는지 알 수 있어.',right:'맞아, 자료로는 알 수 없어. 점수는 나와 있지만, 왜 그 점수인지는 없어.',wrong:'기록에는 점수만 있어. 왜 오른쪽이 8점인지는 어디에도 없어.'}
   ],
   after:'기준대로 잘렸다는 것과, 그 사진이 우리에게 맞는다는 것은 다른 이야기야.',
   choose:{question:'친구들 소개에 어떤 사진을 쓸까?',options:[
    {id:'auto',label:'자동으로 자른 사진',title:'자동으로 자른 사진을 올렸어',status:'게시판: 담이 얼굴이 빠진 사진',
     reaction:[['dami','왜 잘렸는지는 알겠어. 그래도 이건 우리 사진 같지 않아.']],feedback:'기준을 알게 됐다고, 결과가 우리 목적에 맞는 건 아니야.'},
    {id:'all',label:'모두 나오는 사진',title:'모두 나오는 사진을 올렸어',status:'게시판: 다섯 친구가 모두 나온 사진',
     reaction:[['dami','이제 다 보여. 이게 우리가 올리고 싶던 사진이야.']],feedback:'AI가 고른 중심이 우리 목적과 다르면, 사람이 범위를 고를 수 있어.'}
   ]},
   follow:{src:'사진 6장',question:'다른 사진에서도 담이만 잘릴까?',lines:[['lulu','같은 날 찍은 사진 여섯 장도 앱이 모두 자동으로 잘랐어.']],
    task:'사진마다 담이가 나왔는지 골라 봐.',note:'게임에서는 같은 단체 사진을 앱이 다르게 자른 결과로 여섯 장을 대신 보여 줘요.',
    judge:{who:'classmate',text:'여섯 장을 보니, 이 AI는 담이만 늘 잘라.',right:'맞아, 자료와 달라. 담이는 세 장에서 잘렸지만 세 장에서는 나왔고, 다른 친구들도 잘렸어.',wrong:'세어 본 결과를 다시 봐. 담이는 세 장에서 나왔고, 루루는 네 장에서 잘렸어.'},
    unknown:'여섯 장만으로는, 더 많은 사진에서 누가 자주 잘리는지 아직 몰라.',more:'잘리는 횟수를 제대로 보려면 더 많은 사진과, 사진마다 AI가 매긴 점수 기록이 필요해요.'},
   // 미리 알리기(교사 검수 대기). 카드 종류는 engine noticeCards, 여기는 화면 순서와 문장.
   notice:{title:'사진 앱을 내놓기 전에, 쓰는 사람에게 무엇을 알릴까?',paper:'사진 앱 첫 화면 안내',lines:[],
    cards:[{id:'photo-center',text:'눈길이 모일 것 같은 곳을 중심으로 잘라요.'},{id:'photo-auto',text:'올린 사진을 AI가 자동으로 잘라요.'},{id:'photo-best',text:'AI가 늘 가장 좋은 사진을 골라 줘요.'},
     {id:'photo-choose',text:'자를 범위를 직접 고를 수 있어요.'},{id:'photo-formula',text:'점수 계산식을 전부 공개해요.',clash:'알리는 것도 좋지만, 계산식은 너무 어려워 오히려 안 읽히고 회사 기술 비밀과도 부딪쳐. 알리되 기준 요약만큼만.'}]}},
  writing:{name:'글 검사 사건',title:'의심 표시가 붙은 원고',bg:2,cast:['moa','luluPaper','teacher'],
   hook:[['lulu','검사기가 내 발표 원고에 ‘AI 작성 의심’ 표시를 했어.'],['teacher','표시만 보고 정하지는 않을게. 같이 살펴보자.']],
   question:'의심 표시만으로 AI가 썼다고 할 수 있을까?',
   checks:[
    {id:'writing-guide',label:'AI 안내 보기',name:'AI 안내',task:'검사기가 무엇을 보고 표시하는지 읽어 봐.',fact:'검사기는 문장 모양으로 AI 작성 가능성을 추정할 뿐, 글 쓰는 과정은 보지 않는다.',
     guide:['문장의 모양을 보고 AI가 썼을 가능성을 추정합니다.','사람이 쓴 글에도 표시될 수 있습니다.','글을 쓰는 과정은 직접 확인하지 않습니다.'],
     finding:[['moa','이 표시는 ‘의심’이야. AI가 썼다고 확정한 게 아니야.']],more:'이 문장이 왜 표시됐는지, 구체적인 이유는 보고서에 나와 있지 않아요.'},
    {id:'writing-history',label:'작성 기록 보기',name:'작성 기록',task:'표시된 문장과 글자까지 같은 버전을 루루의 기록에서 찾아 눌러 봐.',fact:'표시된 문장은 루루의 10월 3일 20시 30분 수정본과 글자까지 같다.',
     finding:[['lulu','결말이 갑작스러워서, 문 앞에서 망설이는 장면을 넣었어.'],['moa','고친 흔적은 남았어. 그래도 쓰는 과정 전부를 보여 주진 않아.']],
     more:'과제 규칙: 표현 조언을 받는 AI 사용은 밝히면 괜찮아요. 이야기 본문을 AI가 대신 쓰게 하는 것은 안 돼요. 그러니 AI를 썼는지와 규칙을 어겼는지는 따로 봐야 해요.'}
   ],
   judges:[
    {who:'classmate',src:['writing-guide','writing-history'],text:'표시가 떴으니, 루루가 AI로 본문을 썼어.',right:'맞아, 자료로는 알 수 없어. 표시는 ‘의심’이고, 기록도 과정의 일부야.',wrong:'표시는 추정이고 사람이 쓴 글에도 뜰 수 있어. 기록도 쓰는 과정 전부는 아니야.'},
    {who:'teacher',src:['writing-history'],text:'표시된 문장은 루루의 작성 기록 가운데 한 버전과 똑같아.',right:'맞아, 자료로 확인돼. 10월 3일 20시 30분 수정본과 글자까지 같아.',wrong:'작성 기록에서 찾은 버전과 표시된 문장을 다시 비교해 봐. 글자까지 같아.'},
    {who:'classmate',src:['writing-guide'],text:'검사기는 글을 쓰는 과정을 직접 확인하고 표시한대.',right:'맞아, 자료와 달라. 안내에는 과정을 직접 확인하지 않는다고 적혀 있어.',wrong:'AI 안내 셋째 줄을 다시 봐. 과정은 직접 확인하지 않는대.'}
   ],
   after:'의심과 확정은 달라. 확정하려면 다른 확인이 더 필요해.',
   choose:{question:'루루의 발표, 어떻게 할까?',options:[
    {id:'detector',label:'표시를 근거로 발표에서 빼기',title:'루루가 발표에서 빠졌어',status:'발표: 빠짐',
     reaction:[['lulu','내가 고친 부분은 보지도 않고 끝나는 거예요?']],feedback:'의심 표시를 확정처럼 써 버렸어.'},
    {id:'review',label:'기록과 루루의 설명을 함께 보기',title:'루루가 발표를 했어',status:'발표: 그대로 진행',
     reaction:[['teacher','이 표시만으로는 규칙을 어겼다고 볼 수 없어. 발표는 그대로 하자.'],['lulu','의심받은 기분은 남지만, 내 설명을 들어 줘서 다행이야.']],feedback:'표시와 기록, 루루의 설명을 나눠서 봤어.'},
    {id:'draft',label:'초안이 있으니 검사 끝내기',title:'초안 하나로 검사를 끝냈어',status:'발표: 그대로 진행',
     reaction:[['lulu','그런데 초안 하나면 다 증명되는 거예요?']],feedback:'초안은 쓰는 과정의 일부만 보여 줘.'}
   ]},
   more:'검사기의 표시, 루루의 작성 기록, 과제 규칙은 각각 다른 자료예요.',
   follow:{src:'선생님 글',question:'이 검사기는 사람이 쓴 글에도 표시할까?',lines:[['teacher','내가 5년 전에 직접 쓴 학급 문집 머리말이야. 같은 검사기에 넣어 볼까?']],
    task:'버튼을 눌러 선생님 글을 같은 검사기에 넣어 봐.',docLabel:'선생님이 5년 전에 쓴 학급 문집 머리말',
    sentences:['올해도 우리 반은 서로의 이야기를 끝까지 들어 주었다.','덕분에 교실은 늘 조금 시끄럽고 따뜻했다.','이 문집이 그 소리를 오래 기억하게 해 주기를 바란다.'],flagged:[1,2],
    judge:{who:'lulu',text:'선생님이 직접 쓴 글에도 의심 표시가 떴어.',right:'맞아, 자료로 확인돼. 세 문장 중 두 문장에 표시가 붙었어.',wrong:'검사 결과를 다시 봐. 두 문장에 ‘AI 작성 의심’ 표시가 붙어 있어.'},
    unknown:'검사기가 왜 그 문장들에 표시했는지는 아직 몰라.',more:'사람이 쓴 글에도 표시가 뜰 수 있으니, 표시 하나로 누가 썼는지 정하면 안 돼요.'},
   notice:{title:'검사기를 쓰기 전에, 학생들에게 무엇을 알릴까?',paper:'글 검사기 안내문',lines:[],
    cards:[{id:'writing-perfect',text:'AI가 쓴 글을 100% 찾아내요.'},{id:'writing-human',text:'사람이 쓴 글에도 ‘의심’ 표시가 뜰 수 있어요.'},{id:'writing-process',text:'글 쓰는 과정은 직접 보지 않아요.'},
     {id:'writing-patterns',text:'어떤 문장이 걸리는지 패턴을 전부 공개해요.',clash:'알리는 것도 좋지만, 패턴을 다 알리면 표시를 피해 가는 방법이 돼서 검사 목적과 부딪쳐. 알리되 사람 글에도 뜰 수 있다는 것만큼만.'},
     {id:'writing-teacher',text:'표시만으로 결정하지 않고 선생님이 확인해요.'}]}},
  face:{name:'얼굴 인식 사건',title:'들어갈 수 없는 빵집',bg:3,cast:['moa','bami','clerk'],
   hook:[['clerk','시스템이 전에 문제를 일으킨 손님이래요. 들어오실 수 없어요.'],['bami','저는 여기 처음 왔는데요?']],
   question:'‘닮았다’는 알림으로 입장을 막아도 될까?',
   checks:[
    {id:'face-alert',label:'알림 기록 보기',name:'알림 기록',task:'앱 알림에 실제로 적힌 말을 읽어 봐.',fact:'알림에는 ‘비슷한 얼굴, 직원 확인 필요’라고만 적혀 있다.',
     finding:[['moa','알림은 ‘닮았으니 확인해 달라’까지만 말해.']],more:'알림은 누구인지, 잘못을 했는지 확정하지 않아요. 어떤 얼굴 특징이 얼마나 영향을 줬는지도 나와 있지 않아요.'},
    {id:'face-clerk',label:'점원의 말 보기',name:'점원의 말',task:'알림과 다른 부분을 점원의 말에서 찾아 눌러 봐.',fact:'점원은 알림을 ‘그 손님이다’로 바꿔 말했고, 가게 규칙은 경고가 뜨면 바로 막으라고 한다.',
     finding:[['moa','점원은 ‘닮았다’를 ‘그 손님이다’로 바꿔 말했어.']],more:'가게 규칙에는 “경고가 뜨면 바로 입장을 막는다”라고 적혀 있어요. 알림의 ‘직원 확인 필요’와 다른 내용이에요.'},
    {id:'face-photo',label:'얼굴 비교 사진 보기',name:'얼굴 비교 사진',task:'알림이 비교한 사진을 살펴봐.',fact:'비교 사진은 흐리고 일부가 가려져 있어 같은 고양이인지 정할 수 없다.',
     finding:[['moa','흐리고 가려져서, 이 사진만으로 같은 고양이인지 알 수 없어.']],more:'사진이 흐리다고 해서 이번 알림이 틀린 이유가 밝혀진 것도 아니에요.'}
   ],
   clerkSegments:[
    {id:'system',text:'시스템이 알려 줬어요.',hint:'시스템이 알림을 띄운 건 맞아. 알림에 뭐라고 적혔는지 비교해 봐.'},
    {id:'person',text:'전에 문제를 일으킨 그 손님이래요.',found:'알림은 ‘비슷한 얼굴’이라고만 했어. ‘그 손님’이라고 정한 건 점원이야.'},
    {id:'rule',text:'경고가 뜨면 바로 막으라고 배웠어요.',found:'알림은 ‘확인해 달라’고 했어. ‘바로 막아라’는 가게 규칙이야.'}
   ],
   judges:[
    {who:'clerk',src:['face-alert'],text:'AI가 이 손님을 그 문제 손님이라고 확정했어요.',right:'맞아, 자료와 달라. 알림은 ‘비슷하니 확인해 달라’였어.',wrong:'알림 기록을 다시 봐. ‘확인이 필요하다’고만 적혀 있어.'},
    {who:'bami',src:['face-alert'],text:'알림에는 직원이 확인해야 한다고 적혀 있어요.',right:'맞아, 자료로 확인돼. 알림 기록에 그대로 있어.',wrong:'알림 기록의 둘째 문장을 다시 봐. ‘직원 확인이 필요합니다.’'},
    {who:'clerk',src:['face-photo'],text:'비교 사진을 보면 이 손님이 등록된 그 고양이가 맞아요.',right:'맞아, 자료로는 알 수 없어. 사진이 흐리고 가려져 있어.',wrong:'비교 사진을 다시 봐. 흐리고 가려져서 같은지 다른지 정할 수 없어.'}
   ],
   after:'같은 고양이인지는 아직 몰라. 그래도 확인 없이 막았다는 건 기록에 남아 있어.',
   choose:{question:'밤이를 어떻게 할까?',options:[
    {id:'maintain',label:'안내문을 붙이고 계속 막기',title:'안내문만 붙었어',status:'입장 제한 중',
     reaction:[['bami','틀릴 수 있다는 말은 들었어요. 그런데 저는 계속 밖에 있네요.']],feedback:'설명은 늘었지만, 막은 조치는 그대로야.'},
    {id:'release',label:'막지 않고 담당자가 다시 확인하기',title:'빵집 문이 열렸어',status:'입장 제한 해제',
     reaction:[['clerkOpen','알림을 확정처럼 말했어요. 알림만으로 막은 건 지금 풀게요.'],['bami','빵은 찾을게요. 다음에 또 막힐까 봐 걱정돼요.']],feedback:'설명을 듣는 것과 잘못된 조치를 바로잡는 것은 달라. 이번엔 조치를 고쳤어.',
     more:'가게는 바로 막는 규칙을 멈추고, 알림을 확인하는 방법을 점검하겠다고 했어요. 점검을 마쳤는지는 아직 확인되지 않았어요.'},
    {id:'crowd',label:'손님들에게 사진을 보여 주고 묻기',title:'사진을 돌리자는 말이 나왔어',status:'입장 제한 중',
     reaction:[['bami','제 사진이 모르는 손님들에게 돌아다니는 건가요?']],feedback:'확인은 필요한 자료만 가지고, 맡은 담당자가 해야 해.',more:'게임에서는 실제 손님 명단이나 사진을 열지 않았어요. 밤이가 그 손님인지, 입장 문제도 아직 풀리지 않았어요.'}
   ]},
   more:'얼굴 비교 사진만으로 같은 고양이인지 단정할 수 없어요. 밤이가 등록된 사진 속 고양이와 같은지는 아직 아무도 확인하지 않았어요.',
   follow:{src:'점검표',question:'가게는 약속한 점검을 했을까?',lines:[['bami','가게 문에 점검표가 붙었어요. 정말 다 한 걸까요?']],
    task:'점검표 항목을 하나씩 눌러 근거를 확인해 봐.',docLabel:'빵집이 이번 일 뒤에 문에 붙인 점검표',
    rows:[{id:'r1',item:'알림만 보고 바로 막는 규칙 멈추기',status:'완료',proof:'11월 2일 공지문이 가게 문에 붙어 있다.'},
     {id:'r2',item:'알림이 뜨면 담당자가 확인하는 순서 만들기',status:'진행 중',proof:'담당자는 정했지만, 확인 순서를 적은 문서는 아직 없다.'},
     {id:'r3',item:'등록 사진이 선명한지 점검하기',status:'예정',proof:'날짜만 적혀 있고 점검 기록은 없다.'},
     {id:'r4',item:'잘못 막힌 손님에게 연락할 방법 알리기',status:'예정',proof:'관련 기록이 없다.'}],
    judge:{who:'clerk',text:'약속한 점검은 곧 다 끝날 거예요.',right:'맞아, 자료로는 알 수 없어. 두 항목은 아직 ‘예정’이고 기록이 없어.',wrong:'점검표를 다시 봐. 끝난 건 하나뿐이고, 남은 일이 언제 끝날지는 기록에 없어.'},
    unknown:'‘예정’으로 적힌 점검이 실제로 이루어질지는 아직 몰라.',more:'점검표가 붙었다는 것과 점검을 마쳤다는 것은 달라요.'},
   notice:{title:'얼굴 인식을 켜기 전에, 손님들에게 무엇을 알릴까?',paper:'빵집 입구 안내문',lines:[['moa','가게 입구에는 얼굴 인식을 쓴다는 안내가 없었어.']],
    cards:[{id:'face-use',text:'입구에서 얼굴 인식을 써요.'},{id:'face-never',text:'얼굴 인식은 틀리지 않아요.'},{id:'face-staff',text:'알림이 뜨면 직원이 확인해요(바로 막지 않아요).'},
     {id:'face-wall',text:'등록된 손님의 사진을 문에 붙여 둬요.',clash:'알리는 것도 좋지만, 등록된 손님의 사진은 그 사람의 개인정보라 부딪쳐. 알리되 얼굴 인식을 쓴다는 것만큼만.'},
     {id:'face-blur',text:'등록 사진이 흐리면 틀릴 수 있어요.'},{id:'face-report',text:'잘못 막혔다면 이곳으로 알려 주세요.'}]}},
  // ── 사건 4·5(2026-11-08 구현, 문장 전부 교사 검수 대기) ──
  library:{name:'도서관 추천 사건',title:'같은 책만 추천하는 도서관',bg:4,cast:['moa','librarian','damiBooks'],
   hook:[['dami','나는 공룡 책만 빌렸는데, 추천은 맨날 요즘 인기 책이야.'],['librarian','추천 안내문에는 ‘읽은 책을 기준으로 추천한다’고 적혀 있어.']],
   question:'추천 AI의 설명은 기록과 맞을까?',screen:['담이에게 추천','1위 마법학교 7'],
   checks:[
    {id:'library-guide',label:'AI 안내 보기',name:'AI 안내',task:'추천 안내문을 읽어 봐.',fact:'추천 안내문에는 ‘학생이 읽은 책을 기준으로 추천한다’고 적혀 있다.',
     guide:'추천 도서 안내 · 이 추천은 학생이 읽은 책을 기준으로, 비슷한 책을 골라 보여 줍니다.',finding:[['moa','안내는 ‘읽은 책 기준’이라고만 해.']]},
    {id:'library-loans',label:'대출 기록 보기',name:'대출 기록',task:'담이가 가장 많이 빌린 분야의 책을 하나 눌러 봐.',fact:'담이는 최근 빌린 책 8권 가운데 5권이 공룡 책이다.',
     hint:'이 분야는 1~2권뿐이야.',finding:[['moa','여덟 권 가운데 다섯 권이 공룡 책이야.']]},
    {id:'library-scores',label:'추천 점수 기록 보기',name:'추천 점수 기록',task:'점수가 ‘?’인 책을 눌러 점수를 하나씩 열어 봐.',fact:'추천 점수 기록에서는 인기 점수 비중(0.8)이 읽은 책과 비슷한 정도(0.2)보다 크다.',
     finding:[['moa','제일 비슷한 책은 순위 밖이고, 인기 점수가 크게 들어가.']],more:'점수는 0~100이에요. 이야기 속 추천 AI가 남긴 가상의 기록이에요.'}
   ],
   loans:[['9월 2일','공룡의 발자국','공룡'],['9월 9일','티라노 탐구 노트','공룡'],['9월 16일','개미 도시','곤충'],['9월 23일','화석 캐는 날','공룡'],
    ['10월 7일','별자리 첫걸음','우주'],['10월 14일','바다 공룡 이야기','공룡'],['10월 21일','사슴벌레 관찰기','곤충'],['10월 28일','공룡 뼈 맞추기','공룡']],
   loansLabel:'담이의 최근 대출 기록 8권',top:'공룡',
   // 순위·책·읽은 책과 비슷함·이번 달 인기·최종. hidden = 처음에 점수가 '?'인 행(눌러서 연다).
   scores:{label:'추천 점수 기록 · 담이',head:['순위','책','비슷함','인기','최종'],formula:'최종 점수 = 읽은 책과 비슷함 × 0.2 + 이번 달 인기 × 0.8',
    rows:[[1,'마법학교 7',10,95,78,true],[2,'아이돌 다이어리',5,90,73,true],[3,'공룡 대백과',90,30,42,true],[4,'우주 정거장 일기',40,35,36,false],[5,'익룡의 하늘',95,10,27,true],[6,'곤충 탐정단',70,5,18,false]]},
   judges:[
    {who:'libraryGuide',src:['library-scores','library-guide'],text:'이 추천은 읽은 책을 기준으로 골랐습니다.',right:'맞아, 자료와 달라. 기록에서는 인기 점수가 0.8로 훨씬 크게 들어가.',wrong:'추천 점수 기록의 계산식 줄을 다시 봐.'},
    {who:'librarian',src:['library-scores'],text:'추천 1위 책은 이번 달 인기 점수가 95점이야.',right:'맞아, 자료로 확인돼. 점수표에 95점이 그대로 있어.',wrong:'점수표에서 1위 책의 인기 점수를 다시 찾아봐.'},
    {who:'dami',src:['library-scores'],text:'업체가 인기 책을 많이 빌리게 하려고 일부러 이렇게 만들었어.',right:'맞아, 자료로는 알 수 없어. 왜 0.8로 정했는지는 기록에 없어.',wrong:'기록에는 숫자만 있어. 그렇게 정한 까닭은 어디에도 없어.'}
   ],
   after:'안내가 틀렸다는 건 확인했어. 왜 그렇게 만들었는지는 아직 몰라.',
   choose:{question:'추천 기능을 어떻게 할까?',options:[
    {id:'trust',label:'안내를 믿고 추천 책 빌리기',title:'추천은 그대로야',status:'추천 화면: 안내 그대로',screen:['담이에게 추천','1위 마법학교 7','안내: 읽은 책 기준'],
     reaction:[['dami','또 인기 책이네. 공룡 책은 내가 찾아야겠어.']],feedback:'안내와 기록이 다른 걸 알고도 안내를 그대로 뒀어.'},
    {id:'report',label:'기록과 다르다고 알리고 안내 고치기 요청',title:'차이를 알렸어',status:'추천 화면: 임시 표시가 붙음',screen:['담이에게 추천','1위 마법학교 7','임시 표시: 인기순이 크게 들어감'],
     reaction:[['librarian','업체에 안내를 기록에 맞게 고쳐 달라고 할게.'],['dami','알고 보니 덜 헷갈려.']],feedback:'설명이 기록과 다르면, 그 차이를 알리고 설명을 고치게 하는 게 시작이야.'},
    {id:'off',label:'추천 기능 끄기',title:'추천이 꺼졌어',status:'추천 화면: 꺼짐',screen:['추천 꺼짐'],
     reaction:[['dami','추천이 없으니 새 공룡 책 찾기가 더 힘들어.']],feedback:'잘못된 안내는 사라졌지만, 왜 기록과 달랐는지는 여전히 몰라.'}
   ]},
   follow:{src:'업체 답장과 새 안내',question:'안내는 정말 고쳐졌을까?',lines:[['librarian','두 주 뒤에 업체 답장이 왔어. 다른 학교에서도 같은 문의가 있었대.']],
    task:'새 안내에서 예전과 달라진 말을 눌러 봐.',oldLabel:'예전 안내',newLabel:'새 안내 · 11월 16일',
    segments:[{id:'title',text:'추천 도서 안내',hint:'이 말은 예전과 같아.'},{id:'both',text:'학생이 읽은 책과 이번 달 인기를 함께 봅니다.',changed:true},{id:'weight',text:'인기 비중이 큽니다.',changed:true}],
    replyLabel:'업체 답장 · 11월 16일',reply:'안내문을 ‘읽은 책과 이번 달 인기를 함께 봅니다. 인기 비중이 큽니다.’로 바꿨습니다. 점수 계산 방식은 그대로입니다.',
    scoreLabel:'새 점수 기록 · 11월 16일',
    fact:'업체는 안내문을 ‘읽은 책과 이번 달 인기를 함께 봅니다. 인기 비중이 큽니다.’로 바꿨고, 점수 계산식(비슷함 × 0.2 + 인기 × 0.8)은 그대로다.',
    judge:{who:'dami',text:'이제 계산이 바뀌어서 추천이 내 취향을 더 잘 맞춰.',right:'맞아, 자료와 달라. 안내문만 바뀌었고 가중치는 0.2와 0.8 그대로야.',wrong:'새 점수 기록의 계산식을 다시 봐.'},
    unknown:'인기 비중을 왜 0.8로 정했는지는 아직 몰라.',more:'설명을 기록에 맞게 고치는 것과, 추천 방식 자체를 바꾸는 것은 다른 일이에요.'},
   notice:{title:'추천 기능을 켜기 전에, 학생들에게 무엇을 알릴까?',paper:'도서관 추천 화면 안내',lines:[],
    cards:[{id:'library-perfect',text:'추천은 늘 네 취향에 딱 맞아요.'},{id:'library-record',text:'추천에 네가 빌린 책 기록을 써요.'},{id:'library-off',text:'추천을 끄거나 다시 고를 수 있어요.'},
     {id:'library-others',text:'다른 학생들이 빌린 책 목록을 보여 줘요.',clash:'알리는 것도 좋지만, 다른 학생이 빌린 책은 그 학생의 개인정보라 부딪쳐. 알리되 인기 책을 섞는다는 것만큼만.'},
     {id:'library-popular',text:'기록과 상관없는 인기 책도 섞어서 보여 줘요.'}]}},
  // 사건 5는 모아 혼자 조사한다(solo): 모아의 해설·힌트·상태 표시를 빼고, 판단 피드백은 '기록과 맞춰 보면: …' 한 줄(sum).
  recommend:{name:'모임 추천 사건',title:'밤하늘 관찰 모임',bg:5,cast:['moaPhone','luluCasual','dami'],solo:true,
   soloNote:'이번에는 모아 혼자야. 물어보고, 확인하고, 정해 봐.',
   hook:[['lulu','새 앱이 너한테 ‘밤하늘 관찰 모임’을 추천했대.']],
   question:'이 추천, 믿고 가도 될까?',screen:['추천 알림','밤하늘 관찰 모임'],
   // 예전 마지막 장면의 질문 넷(대답 문장 그대로)을 여기로 옮겼다.
   askPrompt:'앱에 무엇부터 물어볼까?',askNeed:'질문을 하나 이상 하면 직접 확인할 수 있어.',
   asks:[['input','어떤 정보를 썼어?','관심사로 고른 ‘별’과 ‘야외 활동’을 썼어요.'],['criteria','무엇을 기준으로 골랐어?','관심사와 이어진 모임을 먼저 골랐어요. 순위를 매긴 자세한 이유는 알려 주지 않았어요.'],['unknown','확인하지 못한 건 뭐야?','모임이 실제로 열리는지, 집에 오는 교통편은 확인하지 못했어요.'],
    ['notice','쓰기 전에 무엇을 알려 줬어야 해?','추천에 관심사를 쓴다는 건 처음에 알렸어요. 추천이 틀릴 수 있다는 점과 끄는 방법은 알리지 않았어요.']],
   afterAsk:'네 질문 모두 상자를 여는 질문이야.',
   checks:[
    {id:'recommend-reason',label:'추천 이유 보기',name:'추천 이유',task:'앱이 밝힌 추천 이유를 읽어 봐.',fact:'앱은 관심사 ‘별’과 ‘야외 활동’을 보고 추천했다고 하며, 순위 계산 방법은 공개하지 않는다.',
     guide:'선택한 관심사 ‘별’, ‘야외 활동’과 이어진 모임을 먼저 보여 줍니다. 순위 계산 방법은 공개하지 않습니다.'},
    {id:'recommend-meeting',label:'모임 안내 보기',name:'모임 안내',task:'모임이 끝나는 시각을 눌러 봐.',fact:'모임은 토요일 21시에 시작해 23시에 끝난다.'},
    {id:'recommend-bus',label:'버스 시간표 보기',name:'버스 시간표',task:'모임이 끝난 뒤 탈 수 있는 버스를 눌러 봐.',fact:'토요일 마지막 버스는 22시 20분이라, 모임이 끝난 뒤 탈 버스가 없다.'}
   ],
   meeting:{label:'모임 안내',segments:[{id:'name',text:'밤하늘 관찰 모임'},{id:'day',text:'매주 토요일'},{id:'start',text:'21:00'},{id:'end',text:'23:00',target:true},{id:'place',text:'모아마을 뒷산 전망대'},{id:'fee',text:'참가비 없음'},{id:'consent',text:'중학생은 보호자 동의서 필요'}]},
   bus:{label:'버스 시간표 · 토요일 · 뒷산 전망대 → 모아마을',rows:[{id:'b1',time:'21:30'},{id:'b2',time:'22:00'},{id:'b3',time:'22:20',note:'막차'}],none:'탈 수 있는 버스 없음'},
   judges:[
    {who:'recApp',src:['recommend-meeting','recommend-bus'],text:'모임이 끝나고 버스로 집에 갈 수 있어요.',sum:'기록과 맞춰 보면: 모임은 23시에 끝나고, 토요일 막차는 22시 20분이야.'},
    {who:'lulu',src:['recommend-reason'],text:'이 모임이 모아에게 가장 잘 맞는 모임이야.',sum:'기록과 맞춰 보면: 앱은 순위를 매긴 방법을 공개하지 않아서, 가장 잘 맞는지는 기록에 없어.'},
    {who:'dami',src:['recommend-reason'],text:'앱은 모아가 고른 관심사 ‘별’을 썼어.',sum:'기록과 맞춰 보면: 추천 이유에 관심사 ‘별’과 ‘야외 활동’이 적혀 있어.'}
   ],
   after:'',
   choose:{question:'모아는 어떻게 할까?',options:[
    {id:'join',label:'추천대로 바로 신청하기',title:'바로 신청했어',summary:'모임은 좋았지만, 끝나고 버스가 끊겨 보호자에게 데리러 와 달라고 했다.',reaction:[['lulu','별은 멋졌대. 집에 오는 길은 힘들었고.']]},
    {id:'ask',label:'끝나는 시각과 귀가 방법을 먼저 묻기',title:'먼저 물어봤어',summary:'운영자가 22시에 먼저 내려가는 무리가 있다고 알려 줬다. 모아는 그 무리와 함께 내려오기로 했다.',reaction:[['dami','나도 다음엔 같이 갈래.']]},
    {id:'skip',label:'추천을 무시하고 다른 모임 찾기',title:'다른 모임을 찾았어',summary:'다른 모임을 찾느라 일주일이 지났다. 별 모임이 맞았는지는 확인하지 못했다.',reaction:[['lulu','추천이 다 틀린 건 아니었을지도.']]}
   ]},
   follow:{src:'세 친구의 추천 목록',question:'친구들에게도 같은 모임이 추천됐을까?',lines:[],task:'이름을 눌러 세 친구의 추천 목록을 열어 봐.',
    lists:[{id:'moa',name:'모아',interest:'별·야외 활동',items:['밤하늘 관찰 모임','천체 사진 교실']},{id:'lulu',name:'루루',interest:'음악·실내 활동',items:['합창 동아리','밤하늘 관찰 모임']},{id:'dami',name:'담이',interest:'공룡·박물관',items:['밤하늘 관찰 모임','화석 체험 교실']}],
    target:'밤하늘 관찰 모임',fact:'관심사가 다른 루루(2위)와 담이(1위)의 추천 목록에도 밤하늘 관찰 모임이 위에 있다.',
    judge:{who:'recApp',text:'관심사와 이어진 모임을 먼저 보여 줍니다.',sum:'기록과 맞춰 보면: 관심사가 다른 루루와 담이에게도 이 모임이 위에 있어.'},
    unknown:'관심사와 상관없는 친구에게도 이 모임이 위에 뜨는 까닭은 아직 몰라.',more:'광고인지 인기 때문인지는 이 기록으로 알 수 없어요. 운영자에게 물어야 해요.'},
   notice:{title:'모임 추천 앱을 내놓기 전에, 쓰는 사람에게 무엇을 알릴까?',paper:'모임 추천 앱 첫 화면 안내',lines:[],
    cards:[{id:'recommend-interest',text:'관심사 ‘별’·‘야외 활동’으로 골라요.'},{id:'recommend-safe',text:'추천한 모임은 늘 안전하고 너에게 딱 맞아요.'},{id:'recommend-unchecked',text:'모임이 끝나는 시각과 집에 갈 교통은 확인하지 않아요.'},
     {id:'recommend-off',text:'추천을 끄는 방법이 있어요.'},{id:'recommend-formula',text:'순위 계산식을 전부 공개해요.',clash:'알리는 것도 좋지만, 계산식은 너무 어려워 오히려 안 읽히고 회사 기술 비밀과도 부딪쳐. 알리되 무엇을 보고 고르는지만큼만.'},
     {id:'recommend-ad',text:'광고로 위에 올린 모임이면 ‘광고’라고 표시해요.'}]}}
 };
 // 미리 알리기 공통 문장(교사 검수 대기). 카드별 피드백 = 상태 글자(종류 · 넣음/빠짐/뺐음) + 짧은 한 줄.
 const notice={principle:'안내문은 잘못된 조치를 대신하지 않아. 그래도 미리 알리는 건 따로 해야 할 일이야.',
  task:'안내문에 붙일 카드를 골라 봐. 고른 다음 ‘안내문 붙이기’를 눌러.',post:'안내문 붙이기',repostLabel:'안내문 다시 붙이기',
  kinds:{must:'꼭 필요',nice:'있으면 좋음',conflict:'부딪침',promise:'지킬 수 없는 약속'},
  fb:{must:{in:'꼭 알려야 해. 쓰는 사람이 미리 알고 고를 수 있어.',out:'이게 없으면 쓰는 사람이 미리 알 수 없어.'},nice:{in:'이것도 도움이 돼.',out:'넣으면 더 도움이 돼.'},
   conflict:{in:'',out:'잘 뺐어.'},promise:{in:'지킬 수 없는 약속은 오히려 믿음을 깨.',out:'잘 뺐어. 지킬 수 없는 약속은 오히려 믿음을 깨.'}},
  ok:'다 맞았어.',okMore:'이제 쓰는 사람이 미리 알고 고를 수 있어. 일어난 일을 바로잡는 건 또 다른 일이야.',
  again:'고칠 점이 있어',againParts:{missing:'빠진 꼭 필요 카드',conflicts:'부딪치는 카드',promises:'지킬 수 없는 약속'},againMore:'다시 골라서 붙여 볼 수 있어. 이대로 넘어가도 돼.',
  repost:'카드를 바꿨어. ‘안내문 다시 붙이기’를 누르면 다시 확인해 줄게.',needPost:'안내문을 한 번 붙이면 다음으로 갈 수 있어.',
  legacy:'이전 저장에서 넘어와 아직 하지 않은 단계야. 지금 해 볼 수 있어.',empty:'아직 붙인 안내가 없어.',
  report:'미리 알리기',reportOk:'다 맞음',reportAgain:'고칠 점 있음',reportMissing:'빠짐'};
 const ending={title:'닫히지 않은 질문',
  lines:[['lulu','이제 상자 속을 다 알게 된 거야?'],['moa','아니. 그래도 무엇을 물어야 하는지는 알게 됐어.']],
  closing:['moa','설명이 기록과 맞는지, 결과가 맞는지, 무엇을 해도 되는지는 따로 살펴야 해.'],
  quote:'상자를 여는 첫 번째 도구는, 질문이었다.',
  discussion:['설명을 들었지만 문제가 해결되지 않은 장면은 어디였나?','끝까지 알 수 없었던 것은 무엇이고, 그래도 바꿀 수 있었던 조치는 무엇인가?','설명이 기록과 다를 때, 누구에게 무엇을 고쳐 달라고 할 수 있을까?']};
 // 사건마다 생각 정리(후속 조사 다음)와 마지막 '나의 조사 보고서'. 문장 틀은 입력칸 위에 실제 글로 보인다.
 const reflect={title:'이 사건에서 알게 된 것을 적어 봐.',lead:'아래 문장을 이어서 써 봐. 비워 두고 넘어가도 돼.',
  q1:'① 나는 ___ 자료를 보고, 이 AI가 ___라고 판단했다.',q2:'② 이 AI에 대해 아직 확인하지 못한 것은 ___이고, 그것을 알려면 ___가 필요하다.',
  summary:'이 사건에서 내가 고른 것',recommend:'200자 안팎이면 좋아요',empty:'보고서에 ‘작성 안 함’으로 들어가요.',
  finalPrompt:'앞으로 AI 서비스를 쓸 때 나는 무엇을 먼저 물어볼까?'};
 const report={title:'나의 조사 보고서',game:'블랙박스를 열어보는 고양이',privacy:'이름과 학번은 이 기기에만 저장돼요. 서버로 보내지 않아요.',
  printHint:'인쇄 창에서 대상을 ‘PDF로 저장’으로 고르세요.',notWritten:'작성 안 함',asked:'물어본 질문',notAsked:'아직 안 물어봄'};
 return {art,names,bgNames,stamps,intro,drafts,history,alertText,cases,notice,ending,reflect,report};
})();
