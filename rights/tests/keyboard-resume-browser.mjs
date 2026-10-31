// 키보드만으로 걷고 조사하기, 새로고침 뒤 이어 하기(조사한 곳 유지), 세로 휴대폰 가로 모드 안내.
// 실행: PLAYWRIGHT_MODULE=<playwright 경로> node rights/tests/keyboard-resume-browser.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startServer } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { server, url } = await startServer(0);
const browser = await chromium.launch();
const errors = [];
const top = (page) => page.evaluate(() => { const s = [...document.querySelectorAll('.r-sheet')].pop(); return s ? s.getAttribute('aria-label') : null; });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${url}/rights/`);
  await page.waitForFunction(() => !document.getElementById('btn-new').disabled);

  // 위원을 고르지 않고 시작하면 안내가 나온다
  await page.click('#btn-new');
  assert.ok(await page.locator('#pick-msg').isVisible(), '위원 선택 안내');
  await page.focus('.r-hero[data-id="onyu"]');
  await page.keyboard.press('Enter');
  await page.click('#btn-new');
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); // 가상 자료 안내: 제목에 초점 → Tab으로 '확인했어요'

  // 프롤로그 대화는 Enter로 넘긴다(타이핑 중이면 한 번 더)
  for (let i = 0; i < 40 && !(await top(page)); i++) await page.keyboard.press('Enter');
  assert.equal(await top(page), '윤리위원회 심의 원칙');
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  // 가치 판단: Tab으로 세 번째 선택지 → Enter → 기록 버튼
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ethicity.rights.progress.v1')));
  assert.equal(saved.prologue.first, 'weigh', '키보드로 고른 가치 판단 저장');

  // 1장 첫 결정까지 빠르게(마우스 없이 패널 버튼 클릭 대신 스크립트로)
  for (let i = 0; i < 200; i++) {
    if (await page.evaluate(() => document.body.classList.contains('r-free'))) break;
    if (await top(page)) {
      await page.evaluate(() => {
        const s = [...document.querySelectorAll('.r-sheet')].pop();
        s.querySelectorAll('.r-choices, .r-chips').forEach((g) => { if (!g.querySelector('[aria-pressed="true"]')) g.querySelector('button').click(); });
        const b = [...s.querySelectorAll('.r-actions .ee-button')].filter((x) => !x.disabled && x.offsetParent).pop(); if (b) b.click();
      });
    } else if (await page.locator('#talk').isVisible()) await page.click('#talk-skip');
    await page.waitForTimeout(30);
  }
  assert.match(await page.textContent('#hud-mission'), /도서관으로 이동하기/);

  // 출입구까지 키보드로 걸어가 Space → 지도 → 도서관
  await page.focus('#stage-canvas');
  const y0 = await page.evaluate(() => window.RightsStage._debug.hero().y);
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(600); await page.keyboard.up('ArrowDown');
  const y1 = await page.evaluate(() => window.RightsStage._debug.hero().y);
  assert.ok(y1 > y0 + 40, '방향키로 걷는다');
  await page.keyboard.press('Space');
  assert.equal(await top(page), '윤리시티 지도');
  await page.click('.r-place:not([disabled])');
  assert.match(await page.textContent('#hud-place'), /도서관/);

  // 사서에게 키보드로 걸어가기 어렵다면 목적지 버튼 — 하나 조사한 뒤 새로고침
  await page.click('#btn-go');
  await page.waitForSelector('#talk:not([hidden])');
  await page.click('#talk-skip');
  await page.waitForFunction(() => document.body.classList.contains('r-free'));
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ethicity.rights.progress.v1')));
  assert.ok(saved.found.s1_librarian, '조사한 곳 저장');

  await page.reload();
  await page.waitForFunction(() => !document.getElementById('btn-new').disabled);
  assert.ok(await page.locator('#btn-continue').isVisible(), '이어 하기 버튼');
  assert.match(await page.textContent('#btn-continue'), /온유/);
  await page.click('#btn-continue');
  await page.waitForFunction(() => document.body.classList.contains('r-free'));
  assert.match(await page.textContent('#hud-mission'), /도서관으로 이동하기/, '마지막 장소(회의실)에서 다시 이동');
  await page.click('#btn-go');
  await page.click('.r-place:not([disabled])');
  assert.match(await page.textContent('#hud-mission'), /다음: 출입 단말기/, '이미 조사한 사서는 건너뛴다');

  // 세로 휴대폰: 가로 모드 안내 → 세로로 계속
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  phone.on('pageerror', (e) => errors.push(String(e)));
  await phone.goto(`${url}/rights/`);
  await phone.waitForFunction(() => !document.getElementById('btn-new').disabled);
  assert.ok(!(await phone.locator('#rotate').isVisible()), '시작 화면에서는 안내 없음');
  await phone.tap('.r-hero[data-id="daon"]');
  await phone.tap('#btn-new');
  await phone.tap('.r-sheet .ee-button');
  assert.ok(await phone.locator('#rotate').isVisible(), '무대에서 가로 모드 안내');
  await phone.tap('#btn-rotate-ok');
  assert.ok(!(await phone.locator('#rotate').isVisible()), '세로로 계속');
  await phone.setViewportSize({ width: 844, height: 390 });
  assert.ok(!(await phone.locator('#rotate').isVisible()));

  assert.deepEqual(errors, []);
  console.log('ok — 키보드 걷기·조사, 이어 하기, 가로 모드 안내');
} finally {
  await browser.close();
  server.close();
}
