// 시작 화면(2026-11-11)이 생긴 뒤의 브라우저 검사용: 페이지를 열거나 새로 고칠 때마다 시작 화면의 으뜸 버튼(게임 시작하기·이어하기)을 눌러
// 예전 첫 화면(프롤로그 또는 저장된 곳)으로 들어간다. 시작 화면이 없는 주소(?preview=s01, art.html)는 그대로 둔다.
// 시작 화면 자체는 tests/title-browser.cjs가 본다.
'use strict';
module.exports=function throughTitle(p){
 const enter=async()=>{
  const there=await p.evaluate(()=>!!document.querySelector('#app.at-title [data-act="start"]')).catch(()=>false);
  if(there)await p.locator('#app [data-act="start"]').click();
 };
 for(const name of ['goto','reload']){
  const go=p[name].bind(p);
  p[name]=async(...a)=>{const r=await go(...a);await enter();return r;};
 }
 return p;
};
