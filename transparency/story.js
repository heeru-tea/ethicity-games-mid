window.TransparencyStory = (()=>{
 const s='assets/s01/', r='assets/remaining/';
 const art={backgrounds:[r+'bg-repair-shop.png',s+'bg-festival-board.png',r+'bg-school-corridor.png',r+'bg-bakery-entrance.png'],moa:s+'moa-attentive.png',lulu:s+'lulu-concerned.png',dami:s+'dami-hurt.png',bami:r+'bami-concerned.png',teacher:r+'teacher-listening.png',clerk:r+'clerk-hesitant.png',clerkOpen:r+'clerk-reconsidering.png',luluPaper:r+'lulu-manuscript.png',photo:s+'festival-group-original.png',faces:r+'face-comparison-fictional.png',expressions:r+'moa-expressions.png',props:r+'props-atlas.png'};
 // 사건 4·5 새 그림(docs/codex-art-brief-4-5-v2.md). 처음에는 지시서의 '대신 쓸 그림'을 쓰고, app.js가 시작할 때 base + '.webp'(게임용 사본) → '.png'(원본)을 불러 보아
 // 열리는 것이 있으면 그것으로 바꾼다. bg = 배경 배열 자리.
 art.backgrounds.push(r+'bg-school-corridor.png',r+'bg-repair-shop.png');
 // 대신 그림: 신문부실 = 복도, 은하수·실제 사진 = 코드로 그린 하늘(app.js), 새 포즈 = 기존 인물(루루 휴대폰은 먼저 이미 있는 lulu-casual을 써 본다).
 Object.assign(art,{newsroom:art.backgrounds[4],observatory:art.backgrounds[5],moaReporter:art.moa,damiLetter:art.dami,clerkPaper:art.clerk,moaPhone:art.moa,luluPhone:art.lulu,bamiPhone:art.bami,galaxy:null,hillReal:null});
 art.newArt={newsroom:{base:'assets/s04/bg-newsroom',bg:4},moaReporter:{base:'assets/s04/moa-reporter'},damiLetter:{base:'assets/s04/dami-letter'},clerkPaper:{base:'assets/s04/clerk-newspaper'},
  observatory:{base:'assets/s05/bg-observatory-hill',bg:5},moaPhone:{base:'assets/s05/moa-phone'},luluPhone:{base:'assets/s05/lulu-phone',alt:'assets/s05/lulu-casual'},bamiPhone:{base:'assets/s05/bami-phone'},galaxy:{base:'assets/s05/galaxy-ai',code:true},hillReal:{base:'assets/s05/hill-real-photo',code:true}};
 const names={moa:'모아',lulu:'루루',luluPaper:'루루',dami:'담이',bami:'밤이',teacher:'선생님',clerk:'점원',clerkOpen:'점원',town:'마을 사람들',classmate:'반 친구',app:'앱 알림',
  office:'구청 청소년과',paper:'마을 신문',moaReporter:'모아',damiLetter:'담이',clerkPaper:'점원',moaPhone:'모아',luluPhone:'루루',bamiPhone:'밤이'};
 const bgNames=['저녁 골목과 수리점','축제 게시판 앞','학교 복도','빵집 입구','학교 신문부실','언덕 위 관측 데크'];
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
    {id:'writing-history',label:'작성 기록 보기',name:'작성 기록',task:'루루의 기록에서 표시된 문장과 글자까지 같은 버전을 찾아 눌러 봐.',fact:'표시된 문장은 루루의 10월 3일 20시 30분 수정본과 글자까지 같다.',
     finding:[['lulu','결말이 갑작스러워서, 문 앞에서 망설이는 장면을 넣었어.'],['moa','고친 흔적은 남았어. 그래도 쓰는 과정을 전부 보여 주진 않아.']],
     more:'과제 규칙: AI에게 표현 조언을 받는 것은 사용했다고 밝히면 괜찮아요. 이야기 본문을 AI가 대신 쓰게 하는 것은 안 돼요. 그러니 AI를 썼는지와 규칙을 어겼는지는 따로 봐야 해요.'}
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
     {id:'writing-patterns',text:'어떤 문장이 걸리는지 패턴을 전부 공개해요.',clash:'알리는 것도 좋지만, 패턴을 다 알리면 표시를 피해 가는 방법이 돼서 검사 목적과 부딪쳐. 사람 글에도 뜰 수 있다는 것까지만 알리면 돼.'},
     {id:'writing-teacher',text:'표시만으로 결정하지 않고 선생님이 확인해요.'}]}},
  face:{name:'얼굴 인식 사건',title:'들어갈 수 없는 빵집',bg:3,cast:['moa','bami','clerk'],
   hook:[['clerk','시스템이 그러는데, 전에 문제를 일으킨 손님이래요. 들어오실 수 없어요.'],['bami','저는 여기 처음 왔는데요?']],
   question:'‘닮았다’는 알림으로 입장을 막아도 될까?',
   checks:[
    {id:'face-alert',label:'알림 기록 보기',name:'알림 기록',task:'앱 알림에 실제로 적힌 말을 읽어 봐.',fact:'알림에는 ‘비슷한 얼굴, 직원 확인 필요’라고만 적혀 있다.',
     finding:[['moa','알림은 ‘닮았으니 확인해 달라’까지만 말해.']],more:'알림은 누구인지도, 잘못을 했는지도 확정하지 않아요. 어떤 얼굴 특징이 얼마나 영향을 줬는지도 나와 있지 않아요.'},
    {id:'face-clerk',label:'점원의 말 보기',name:'점원의 말',task:'점원의 말에서 알림과 다른 부분을 찾아 눌러 봐.',fact:'점원은 알림을 ‘그 손님이다’로 바꿔 말했고, 가게 규칙은 경고가 뜨면 바로 막으라고 한다.',
     finding:[['moa','점원은 ‘닮았다’를 ‘그 손님이다’로 바꿔 말했어.']],more:'가게 규칙에는 “경고가 뜨면 바로 입장을 막는다”라고 적혀 있어요. 알림의 ‘직원 확인 필요’와 다른 내용이에요.'},
    {id:'face-photo',label:'얼굴 비교 사진 보기',name:'얼굴 비교 사진',task:'알림이 비교한 사진을 살펴봐.',fact:'비교 사진은 흐리고 일부가 가려져 있어 같은 고양이인지 정할 수 없다.',
     finding:[['moa','흐리고 가려져서, 이 사진만으로 같은 고양이인지 알 수 없어.']],more:'사진이 흐리다고 해서 이번 알림이 틀린 이유가 밝혀진 것도 아니에요.'}
   ],
   clerkSegments:[
    {id:'system',text:'시스템이 알려 줬어요.',hint:'시스템이 알림을 띄운 건 맞아. 알림에 뭐라고 적혀 있는지 비교해 봐.'},
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
     reaction:[['clerkOpen','알림을 확정처럼 말했어요. 알림만으로 막은 건 지금 풀게요.'],['bami','빵을 고를게요. 다음에 또 막힐까 봐 걱정돼요.']],feedback:'설명을 듣는 것과 잘못된 조치를 바로잡는 것은 달라. 이번엔 조치를 고쳤어.',
     more:'가게는 바로 막는 규칙을 멈추고, 알림을 확인하는 방법을 점검하겠다고 했어요. 점검을 마쳤는지는 아직 확인되지 않았어요.'},
    {id:'crowd',label:'손님들에게 사진을 보여 주고 묻기',title:'사진을 돌리자는 말이 나왔어',status:'입장 제한 중',
     reaction:[['bami','제 사진이 모르는 손님들에게 돌아다니는 건가요?']],feedback:'확인은 맡은 담당자가 필요한 자료만 가지고 해야 해.',more:'게임에서는 실제 손님 명단이나 사진을 열지 않았어요. 밤이가 그 손님인지도, 입장 문제도 아직 풀리지 않았어요.'}
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
     {id:'face-wall',text:'등록된 손님의 사진을 문에 붙여 둬요.',clash:'알리는 것도 좋지만, 등록된 손님의 사진은 그 사람의 개인정보야. 알리는 것과 개인정보 보호가 부딪치니까 얼굴 인식을 쓴다는 것까지만 알리면 돼.'},
     {id:'face-blur',text:'등록 사진이 흐리면 틀릴 수 있어요.'},{id:'face-report',text:'잘못 막혔다면 이곳으로 알려 주세요.'}]}},
  // ── 사건 4·5(2026-11-08 구현, 문장 전부 교사 검수 대기) ──
  // 사건 4·5(2026-11-10 새로 짬, 설계 docs/2026-11-10-cases-4-5-rework-design.md). 문장 모두 교사 검수 대기.
  // 사건 4: 정부·사회의 몫. 구청 AI 선발이 본의 아니게 버스 드문 마을에 불리했다. 모아는 신문부 기자.
  camp:{name:'구청 캠프 사건',title:'겨울 캠프 명단',bg:4,cast:['moaReporter','clerkPaper','damiLetter'],
   hook:[['dami','캠프 떨어졌어. 우리 마을 애들은 거의 다 떨어졌대.'],['clerk','AI가 솔숲마을 애들을 일부러 떨어뜨린 거래!'],['teacher','신문부가 확인해서 기사로 써 보자.']],
   question:'솔숲마을 아이들만 많이 떨어진 까닭은 뭘까?',screen:['마을 신문 · 소문','“AI가 솔숲마을 차별”'],
   askPrompt:'구청에 무엇부터 물어볼까?',askNeed:'질문을 하나 이상 하면 직접 확인할 수 있어.',askWho:'office',
   asks:[['purpose','AI를 어디에 썼어요?','신청서에 점수를 매기는 데 썼어요. 최종 명단은 담당자가 확인했어요.'],['criteria','무엇을 기준으로 뽑았어요?','기준표를 보내 드릴게요. 일부 항목은 업체 영업비밀이라 가렸어요.'],
    ['who','누가 책임지는 부서예요?','구청 청소년과예요. 공개 페이지에는 아직 안 적혀 있어요.'],['appeal','결과가 이상하면 어떻게 다시 확인받아요?','아직 따로 정한 방법이 없어요.']],
   afterAsk:'물어보면 상자가 조금 열려. 이제 받은 자료를 확인해 보자.',
   checks:[
    {id:'camp-page',label:'구청 공개 페이지 보기',name:'구청 공개 페이지',task:'공개 페이지에서 비어 있는 칸을 찾아 눌러 봐.',fact:'구청 공개 페이지에는 AI를 썼다는 것과 목적은 적혀 있지만, 담당 부서와 이의 신청 방법은 비어 있다.',
     hint:'이 칸은 적혀 있어.',finding:[['moa','AI를 썼다는 말은 있는데, 누가 맡는지와 이의 신청 방법은 비어 있어.']]},
    {id:'camp-results',label:'마을별 결과 보기',name:'마을별 결과',task:'합격 비율이 가장 낮은 마을을 눌러 봐.',fact:'솔숲마을은 12명이 신청해 1명이 붙어, 네 마을 가운데 합격 비율이 가장 낮다.',
     hint:'이 마을은 절반 넘게 붙었어.',finding:[['moa','솔숲마을만 12명 가운데 1명이야. 다른 마을은 절반 넘게 붙었어.']]},
    {id:'camp-criteria',label:'선발 기준표 보기',name:'선발 기준표',task:'비중이 ‘?’인 줄을 눌러 하나씩 열어 봐.',fact:'선발 기준표에서는 지난 구청 프로그램 참여 횟수(0.5)가 가장 크게 들어가고, 0.2만큼의 비중은 영업비밀이라 가려져 있다.',
     finding:[['moa','참여 횟수가 절반을 차지해. 가려진 줄도 하나 있어.']],more:'비중을 모두 더하면 1이에요. 이야기 속 구청이 남긴 가상의 기록이에요. 솔숲마을에서 구청까지 가는 버스는 하루 네 번이라, 예전 프로그램에 오기 어려웠어요.'}
   ],
   page:{label:'구청 공개 페이지 · 청소년 겨울 캠프',rows:[{id:'use',k:'AI 활용',text:'신청서 점수 매기기'},{id:'purpose',k:'목적',text:'공정하고 빠른 선발'},{id:'office',k:'담당 부서',text:'(적혀 있지 않음)',blank:true},{id:'appeal',k:'이의 신청',text:'(적혀 있지 않음)',blank:true}]},
   results:{label:'마을별 결과 · 겨울 캠프 40명 (가상 기록)',head:['마을','신청','합격'],rows:[{id:'city',name:'시내마을',apply:18,pass:16},{id:'river',name:'강변마을',apply:14,pass:12},{id:'hill',name:'언덕마을',apply:16,pass:11},{id:'pine',name:'솔숲마을',apply:12,pass:1,target:true}]},
   criteria:{label:'선발 기준표 · 구청 청소년과 (가상 기록)',head:['항목','비중'],done:'참여 횟수가 가장 크게 들어가.',bus:'쪽지 · 솔숲마을에서 구청까지 버스는 하루 네 번',
    rows:[{id:'join',name:'지난 구청 프로그램 참여 횟수',w:0.5,top:true},{id:'essay',name:'신청서 글',w:0.2},{id:'order',name:'신청 순서',w:0.1},{id:'secret',name:'업체 영업비밀이라 공개 안 함',w:0.2,hidden:true}]},
   judges:[
    {who:'clerk',src:['camp-criteria','camp-results'],text:'구청 AI가 솔숲마을 아이들을 일부러 떨어뜨렸어.',right:'맞아, 자료로는 알 수 없어. 기록에는 점수와 결과만 있어.',wrong:'기록에는 점수와 결과만 있어. 누가 무슨 마음이었는지는 어디에도 없어.'},
    {who:'paper',src:['camp-results'],text:'솔숲마을 아이들도 다른 마을과 비슷하게 뽑혔다.',right:'맞아, 자료와 달라. 솔숲마을은 12명 가운데 1명만 붙었어.',wrong:'마을별 결과에서 솔숲마을 줄을 다시 봐.'},
    {who:'teacher',src:['camp-criteria'],text:'선발 점수에서는 지난 프로그램 참여 횟수가 가장 크게 들어가.',right:'맞아, 자료로 확인돼. 기준표에서 참여 횟수가 0.5로 가장 커.',wrong:'선발 기준표에서 참여 횟수 비중을 다시 봐.'}
   ],
   after:'차별하려던 건지는 몰라. 그래도 결과가 한쪽에 불리했던 건 기록에 있어.',
   choose:{question:'신문부 기사, 어떻게 낼까?',options:[
    {id:'loud',label:'“AI가 솔숲마을 아이들 일부러 차별” 제목으로 내기',title:'기사가 크게 퍼졌어',status:'마을 신문: 큰 제목',screen:['마을 신문 1면','“AI가 일부러 차별”','구청: 사실과 다르다'],
     summary:'구청은 “일부러 그런 적 없다”는 반박만 냈다. 다툼은 누구 탓이냐로 흘렀고, 기준 이야기는 묻혔다.',
     reaction:[['dami','다들 화만 내고, 내 결과는 그대로야.']],feedback:'부풀린 제목은 관심은 끌지만, 고쳐야 할 기준을 가려.'},
    {id:'accurate',label:'기록에 맞는 제목으로 내고, 구청에 기준 공개와 재검토를 요청하기',title:'기록대로 썼어',status:'마을 신문: 기록에 맞는 제목',screen:['마을 신문 1면','참여 횟수 기준, 솔숲마을에 불리','구청: 고치겠습니다'],
     summary:'구청은 “공개 페이지를 고치고 재검토 방법을 만들겠다”고 답했다.',
     reaction:[['dami','내가 왜 떨어졌는지 이제 알겠어.']],feedback:'기록에 맞게 쓰고, 다시 확인받을 길을 요구하는 게 시작이야.'},
    {id:'quiet',label:'구청 발표대로 “AI가 공정하게 뽑았다”고 싣기',title:'기사가 조용히 지나갔어',status:'마을 신문: 작은 기사',screen:['마을 신문 6면','“AI가 공정하게 뽑았다”'],
     summary:'솔숲마을 아이들은 왜 떨어졌는지 모른 채 겨울을 보냈다.',
     reaction:[['clerk','공정하다니 됐네.'],['dami','그럼 우리 마을은 왜 다 떨어진 거야?']],feedback:'줄여서 쓴 기사도 기록과 다르면, 고칠 기회를 놓쳐.'}
   ]},
   // 후속 조사는 선택과 상관없이 하나(엔진 구조). 결과 문장은 이것과 어긋나지 않게 썼다.
   follow:{src:'예전·새 공개 페이지',question:'구청은 정말 다 고쳤을까?',lines:[['teacher','석 달 뒤, 다른 마을에서도 문의가 이어져 구청이 공개 페이지를 고쳤대.']],
    task:'새 공개 페이지에서 예전과 달라진 말을 눌러 봐.',oldLabel:'예전 공개 페이지',newLabel:'새 공개 페이지 · 3월 2일',
    segments:[{id:'use',text:'AI 활용: 신청서 점수 매기기.',hint:'이 말은 예전과 같아.'},{id:'office',text:'담당 부서: 구청 청소년과.',changed:true},{id:'appeal',text:'이의 신청: 결과 발표 뒤 14일 안에 재검토 신청.',changed:true},{id:'criteria',text:'선발 기준: 일부 항목 비공개.',hint:'이 말은 예전 기준표와 같아.'}],
    fact:'새 공개 페이지에는 담당 부서(구청 청소년과)와 이의 신청 방법(결과 발표 뒤 14일 안에 재검토)이 생겼지만, 선발 기준의 일부 항목은 여전히 비공개다.',
    judge:{who:'office',text:'이제 선발 기준을 모두 공개합니다.',right:'맞아, 자료와 달라. 가려진 항목은 그대로야.',wrong:'새 공개 페이지의 선발 기준 줄을 다시 봐.'},
    unknown:'가려진 항목이 결과를 얼마나 바꿨는지는 아직 몰라.',more:'영업비밀은 지켜야 할 정보이기도 해요. 그래도 결과에 얼마나 영향을 줬는지는 설명할 수 있어야 해요. 어디까지 알릴지 정하는 기준은 나라와 사회가 만들어요.'},
   notice:{title:'구청이 AI로 뽑기 전에, 시민에게 무엇을 공개할까?',paper:'구청 공개 페이지',lines:[],
    cards:[{id:'camp-role',text:'AI가 점수를 매기고, 담당자가 최종 확인해요.'},{id:'camp-never',text:'AI가 뽑으니 절대 차별이 없어요.'},{id:'camp-office',text:'담당 부서는 구청 청소년과예요.'},
     {id:'camp-everyone',text:'신청자 모두의 이름과 점수를 공개해요.',clash:'기준을 알리는 건 좋지만, 다른 사람의 이름과 점수는 개인정보야. 기준과 내 점수만 알 수 있으면 돼.'},
     {id:'camp-appeal',text:'이의가 있으면 14일 안에 재검토를 신청해요.'},{id:'camp-items',text:'점수에 쓰는 항목과 비중을 알려 드려요.'}]},
   reflect:{q1:'① 나는 ___ 자료를 보고, 구청이 ___을(를) 더 공개하거나 설명해야 한다고 판단했다.',q2:'② 이 선발에 대해 아직 확인하지 못한 것은 ___이고, 그것을 알려면 ___가 필요하다.'}},
  // 사건 5: 이용자도 알릴 의무. 사건 2에서 억울하게 의심받았던 루루가 이번엔 정말 AI로 그림을 만들었다.
  // 모아(학생) 혼자 판단한다(solo): 모아의 해설·힌트·상태 표시를 빼고, 판단 피드백은 '기록과 맞춰 보면: …' 한 줄(sum).
  share:{name:'은하수 그림 사건',title:'은하수 홍보 그림',bg:5,cast:['luluPhone','moaPhone','bamiPhone'],solo:true,
   soloNote:'이번에는 모아 혼자야. 확인하고, 정해 봐.',
   hook:[['lulu','관찰 모임 홍보 그림, AI로 만들었어. 그런데 그렇게 쓰면 다들 또 내가 안 한 걸로 볼까 봐.'],['bami','뒷산에서 진짜 이렇게 보여요?']],
   question:'이 그림, AI로 만들었다고 밝혀야 할까?',screen:['냥스타 · 루루','은하수 그림','이번 주 토요일, 뒷산에서 만나요!','공유 37'],
   checks:[
    {id:'share-log',label:'루루의 작업 기록 보기',name:'작업 기록',task:'AI가 처음부터 만든 부분을 눌러 봐.',fact:'홍보물의 은하수 그림은 AI 도구로 만들었고, 소개 글은 루루가 쓴 뒤 AI로 맞춤법만 다듬었다.'},
    {id:'share-photo',label:'지난 모임 사진 보기',name:'지난 모임 사진',task:'실제 하늘에서 보인 것을 적은 줄을 눌러 봐.',fact:'지난 모임에서 찍은 실제 사진에는 별 몇 개만 보이고, 은하수는 마을 불빛 때문에 거의 보이지 않았다.'},
    {id:'share-compare',label:'DM과 게시물 비교하기',name:'DM과 게시물',task:'둘 가운데 AI라고 밝힌 말을 눌러 봐.',fact:'루루는 모아에게 보낸 DM에서는 AI로 만들었다고 밝혔지만, 냥스타 게시물에는 적지 않았다.'}
   ],
   logLabel:'루루의 작업 기록 · 관찰 모임 홍보물',
   log:[{id:'pic',part:'은하수 그림',how:'AI 그림 도구로 만듦',target:true},{id:'text',part:'소개 글',how:'루루가 쓰고, AI로 맞춤법만 다듬음'},{id:'time',part:'모임 시간과 장소',how:'루루가 직접 적음'}],
   photos:{label:'지난달 관찰 모임 기록 · 뒷산 전망대',caption:'왼쪽: 홍보 그림 · 오른쪽: 지난 모임 실제 사진',
    lines:[{id:'date',text:'10월 11일 토요일 21시'},{id:'sky',text:'마을 불빛 때문에 은하수는 거의 안 보임',target:true},{id:'people',text:'참가 9명'}]},
   compare:{dm:{label:'DM · 루루가 모아에게',text:'AI로 만들어 봤어 ㅎㅎ',target:true},post:{label:'냥스타 게시물 · 루루',text:'이번 주 토요일, 뒷산에서 만나요! 밤하늘 관찰 모임',meta:'공유 37'}},
   judges:[
    {who:'bami',src:['share-photo'],text:'뒷산에 가면 이 그림처럼 은하수를 볼 수 있어요.',sum:'기록과 맞춰 보면: 지난 모임 사진에는 별 몇 개만 있고, 은하수는 거의 안 보였어.'},
    {who:'lulu',src:['share-log'],text:'그림은 AI로 만들었고, 모임 시간과 장소는 내가 적었어.',sum:'기록과 맞춰 보면: 작업 기록에 그림은 AI 도구로 만들었고, 시간과 장소는 루루가 적었다고 나와.'},
    {who:'classmate',src:['share-compare'],text:'게시물을 공유한 37명은 다 AI 그림인 줄 알고 공유했을 거야.',sum:'기록과 맞춰 보면: 공유 숫자만 있고, 누가 무엇을 알고 공유했는지는 기록에 없어.'}
   ],
   after:'',
   choose:{question:'루루에게 뭐라고 할까?',options:[
    {id:'keep',label:'그대로 둬도 괜찮다고 하기',title:'게시물을 그대로 뒀어',screen:['냥스타 · 루루','은하수 그림','이번 주 토요일, 뒷산에서 만나요!'],
     summary:'토요일에 온 몇 명이 은하수가 안 보인다며 실망했다.',reaction:[['bami','그림이랑 너무 달라서 좀 속은 기분이에요.']]},
    {id:'tag',label:'‘#AI그림’ 한 줄만 붙이자고 하기',title:'한 줄을 붙였어',screen:['냥스타 · 루루','은하수 그림','이번 주 토요일, 뒷산에서 만나요!','#AI그림'],
     summary:'AI 그림인 건 알렸지만, 밤이는 여전히 은하수를 기대하고 왔다.',reaction:[['bami','AI라도 이만큼은 보일 줄 알았어요.']]},
    {id:'explain',label:'AI로 만든 부분과 실제 하늘을 같이 밝히자고 하기',title:'고쳐 썼어',screen:['냥스타 · 루루','은하수 그림 + 실제 사진','그림은 AI로 만들었어요.','실제로는 별이 이만큼 보여요.'],
     summary:'게시물 글에 ‘그림은 AI로 만들었어요. 실제로는 별이 이만큼 보여요’를 쓰고 지난 모임 사진을 붙였다.',reaction:[['bami','솔직히 알려 줘서 좋아요. 그래도 가 볼래요.'],['lulu','밝혀도 내가 한 일이 줄어드는 건 아니네.']]}
   ]},
   follow:{src:'그림을 올린 세 곳',question:'같은 그림, 어디에 얼마나 알려야 할까?',lines:[],task:'세 곳을 눌러 누가 보는지 열어 봐.',
    places:[{id:'dm',name:'모아에게 보낸 DM',who:'모아 한 명',know:'모아는 루루가 AI로 만든 걸 안다.'},
     {id:'post',name:'냥스타 게시물',who:'팔로워와, 공유로 본 모르는 사람들',know:'만든 방법을 모른다. 진짜 사진인지 가릴 단서는 게시물 글뿐이다.'},
     {id:'board',name:'동아리 홍보 게시판(학교 복도)',who:'학교 학생과 선생님',know:'동아리 공식 홍보라서 그대로 믿는다.'}],
    allLine:'보는 사람이 사정을 모를수록, 더 분명하게 알려야 해.',
    fact:'DM을 본 모아만 AI 그림인 걸 알고, 냥스타 게시물과 학교 게시판을 본 사람들은 만든 방법을 알 수 없다.',
    judge:{who:'lulu',text:'DM에서 AI라고 말했으니, 어디에 올리든 따로 안 알려도 돼.',sum:'기록과 맞춰 보면: 게시물과 게시판을 본 사람들은 DM을 보지 못했어.'},
    unknown:'공유된 게시물을 본 사람 가운데 몇 명이 진짜 사진으로 믿었는지는 아직 몰라.',more:'친한 친구와의 DM처럼 사정을 아는 사이에서는 짧게 말해도 돼요. 모르는 사람이 보는 곳일수록 무엇이 AI이고 실제와 무엇이 다른지 분명히 적어야 해요.'},
   notice:{title:'루루와 함께, 냥스타 게시물에 무엇을 붙일까?',paper:'냥스타 게시물 글',lines:[],principle:'알리는 건 벌이 아니야. 보는 사람이 제대로 고를 수 있게 정보를 주는 거야.',
    cards:[{id:'share-same',text:'토요일에 이 그림처럼 보일 거예요.'},{id:'share-ai',text:'은하수 그림은 AI로 만들었어요.'},{id:'share-photo',text:'지난 모임의 진짜 사진도 함께 올려요.'},
     {id:'share-settings',text:'AI 도구에 넣은 말과 설정을 전부 적어요.',clash:'알리는 건 좋지만, 보는 사람에게 필요한 건 ‘AI로 만들었고 실제와 다르다’는 거야. 설정을 다 적으면 오히려 중요한 말이 묻혀.'},
     {id:'share-real',text:'실제 뒷산에서는 은하수가 거의 안 보여요.'},{id:'share-spell',text:'소개 글은 AI로 맞춤법만 다듬었어요.'}]},
   reflect:{q1:'① 나는 ___ 자료를 보고, 루루가 ___에는 AI로 만들었다고 알려야 한다고 판단했다.',q2:'② 내가 AI로 만든 것을 나눈다면, ___에는 ___라고 알리겠다.'}}
 };
 // 미리 알리기 공통 문장(교사 검수 대기). 카드별 피드백 = 상태 글자(종류 · 넣음/빠짐/뺐음) + 짧은 한 줄.
 const notice={principle:'안내문이 잘못된 조치를 바로잡아 주지는 않아. 그래도 미리 알리는 건 따로 해야 할 일이야.',
  task:'안내문에 붙일 카드를 골라 봐. 고른 다음 ‘안내문 붙이기’를 눌러.',post:'안내문 붙이기',repostLabel:'안내문 다시 붙이기',
  kinds:{must:'꼭 필요',nice:'있으면 좋음',conflict:'부딪침',promise:'지킬 수 없는 약속'},
  fb:{must:{in:'꼭 알려야 해. 그래야 쓰는 사람이 미리 알고 고를 수 있어.',out:'이게 없으면 쓰는 사람이 미리 알 수 없어.'},nice:{in:'이것도 도움이 돼.',out:'넣으면 더 도움이 돼.'},
   conflict:{in:'',out:'잘 뺐어.'},promise:{in:'지킬 수 없는 약속은 오히려 믿음을 깨.',out:'잘 뺐어. 지킬 수 없는 약속은 오히려 믿음을 깨.'}},
  ok:'다 맞았어.',okMore:'이제 쓰는 사람이 미리 알고 고를 수 있어. 일어난 일을 바로잡는 건 또 다른 일이야.',
  again:'고칠 점이 있어',againParts:{missing:'빠진 꼭 필요 카드',conflicts:'부딪치는 카드',promises:'지킬 수 없는 약속'},againMore:'다시 골라서 붙여 볼 수 있어. 이대로 넘어가도 돼.',
  repost:'카드를 바꿨어. ‘안내문 다시 붙이기’를 누르면 다시 확인해 줄게.',needPost:'안내문을 한 번 붙이면 다음으로 갈 수 있어.',
  legacy:'이전 저장에서 넘어왔어. 이 단계는 아직 하지 않았어. 지금 해 볼 수 있어.',empty:'아직 붙인 안내문이 없어.',
  report:'미리 알리기',reportOk:'다 맞음',reportAgain:'고칠 점 있음',reportMissing:'빠짐'};
 const ending={title:'닫히지 않은 질문',
  lines:[['lulu','이제 상자 속을 다 알게 된 거야?'],['moa','아니. 그래도 무엇을 물어야 하는지는 알게 됐어.']],
  closing:['moa','AI를 만드는 쪽, 쓰는 쪽, 지켜보는 쪽이 각자 물어야 할 게 있어.'],
  quote:'상자를 여는 첫 번째 도구는, 질문이었다.',
  discussion:['설명을 들었지만 문제가 해결되지 않은 장면은 어디였나?','끝까지 알 수 없었던 것은 무엇이고, 그래도 바꿀 수 있었던 조치는 무엇인가?','AI로 만든 것을 나눌 때, 어디에 얼마나 알려야 할까?','공공기관이 AI로 우리 일을 정할 때, 무엇을 공개해 달라고 할 수 있을까?']};
 // 사건마다 생각 정리(후속 조사 다음)와 마지막 '나의 조사 보고서'. 문장 틀은 입력칸 위에 실제 글로 보인다.
 const reflect={title:'이 사건에서 알게 된 것을 적어 봐.',lead:'아래 문장을 이어서 써 봐. 비워 두고 넘어가도 돼.',
  q1:'① 나는 ___ 자료를 보고, 이 AI가 ___라고 판단했다.',q2:'② 이 AI에 대해 아직 확인하지 못한 것은 ___이고, 그것을 알려면 ___가 필요하다.',
  summary:'이 사건에서 내가 고른 것',recommend:'200자 안팎이면 좋아요',empty:'비워 두면 보고서에 ‘작성 안 함’으로 들어가요.',
  finalPrompt:'앞으로 AI 서비스를 쓸 때 나는 무엇을 먼저 물어볼까?'};
 const report={title:'나의 조사 보고서',game:'블랙박스를 열어보는 고양이',privacy:'이름과 학번은 이 기기에만 저장돼요. 서버로 보내지 않아요.',
  printHint:'인쇄 창에서 대상을 ‘PDF로 저장’으로 고르세요.',notWritten:'작성 안 함',asked:'물어본 질문',notAsked:'아직 안 물어봄'};
 return {art,names,bgNames,stamps,intro,drafts,history,alertText,cases,notice,ending,reflect,report};
})();
