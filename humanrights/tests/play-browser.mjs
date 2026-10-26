// 실제 화면 완주 검증(헤드리스 Chromium): 버튼을 눌러 세 안건 → 마무리 → 보고서까지 진행한다.
//   PLAYWRIGHT_MODULE=<playwright 패키지 경로> node humanrights/tests/play-browser.mjs [스크린샷 폴더]
// 저장소 루트를 정적 서버로 열어 /humanrights/ 에 접속한다(공통 팩 ../shared 경로 확인 포함).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = process.argv[2] || null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const URL_BASE = `http://127.0.0.1:${server.address().port}/humanrights/`;

const browser = await chromium.launch();
const errors = [];
const missing = [];

async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); }
async function next(page) {
  const btn = page.locator('#nav [data-action=next]');
  assert.equal(await btn.isEnabled(), true, '다음 버튼이 켜져 있어야 함: ' + await page.locator('#nav').innerText());
  await btn.click();
}
async function fillAll(page) {
  for (const ta of await page.locator('main textarea').all()) await ta.fill('시험용으로 쓴 충분히 긴 답변이에요.');
}

async function play(width, height, label) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('console', m => { if (m.type() === 'error') errors.push(label + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(label + ': ' + e.message));
  page.on('response', r => { if (r.status() >= 400) missing.push(r.url()); });
  await page.addInitScript(() => localStorage.setItem('ethicity.player', JSON.stringify({ character: 'char_03', nickname: '<img src=x onerror=alert(1)>' })));
  await page.goto(URL_BASE + '?rebuttal=majority');
  await page.waitForFunction(() => document.querySelector('.scene.painted'), null, { timeout: 15000 });
  assert.ok((await page.locator('.talk').first().innerText()).includes('<img src=x onerror=a 위원님'), '별명은 글자 그대로(20자까지)');
  assert.equal(await page.locator('main img').count(), 0, '별명이 HTML로 해석되지 않음');
  await shot(page, label + '-0-intro');
  await next(page);

  for (let i = 0; i < 3; i++) {
    // 브리핑
    await shot(page, `${label}-${i + 1}-1-brief`);
    await next(page);
    // 데이터
    if (i === 0) {
      assert.equal(await page.locator('#nav [data-action=next]').isEnabled(), false);
      await page.locator('[data-action=pick]').first().click();
    } else if (i === 1) {
      await page.locator('[data-action=quiz][data-value="1"]').click();
      await page.locator('form.num input').fill('3');
      await page.locator('form.num button').click();
      assert.ok((await page.locator('.fb').last().innerText()).includes('다시 생각'));
      await page.locator('form.num input').fill('8');
      await page.locator('form.num button').click();
      await fillAll(page);
    } else {
      await page.locator('form.num input').fill('100');
      await page.locator('form.num button').click();
      assert.ok((await page.locator('.fb').innerText()).includes('맞아요'));
    }
    await shot(page, `${label}-${i + 1}-2-data`);
    await next(page);
    // 최초 판단(확정 대화 상자)
    await page.locator('[data-action=initial][data-value=A]').click();
    await page.locator('[data-action=lock]').click();
    await page.locator('#confirm button[value=ok]').click();
    await page.waitForFunction(() => document.querySelector('main').innerText.includes('🔒'), null, { timeout: 3000 });
    await next(page);
    // 추가 정보
    await shot(page, `${label}-${i + 1}-4-extra`);
    await next(page);
    // 인터뷰
    if (i === 1) {
      await page.locator('[data-action=open-optional]').click();
      await page.locator('[data-action=iv-pick][data-value="2"]').click();
      await fillAll(page);
    }
    await page.waitForTimeout(100);
    await shot(page, `${label}-${i + 1}-5-interview`);
    await next(page);
    // 시뮬레이터: A안 → B안(보호 조치 2개)
    await page.locator('[data-action=run]').click();
    assert.equal(await page.locator('.aspect').count(), 4);
    await page.locator('[data-action=sim-choice][data-value=B]').click();
    await page.locator('[data-action=sim-prot]').nth(0).click();
    await page.locator('[data-action=sim-prot]').nth(1).click();
    await shot(page, `${label}-${i + 1}-6-sim`);
    await next(page);
    // 최종 판단: 출입·채용은 B(시뮬레이터 조치 그대로), 치안은 C
    await page.locator(`[data-action=final-choice][data-value=${i === 2 ? 'C' : 'B'}]`).click();
    if (i === 1) await page.locator('[data-action=factor]').first().click();
    await fillAll(page);
    await shot(page, `${label}-${i + 1}-7-final`);
    await next(page);
  }

  // 마무리
  await fillAll(page);
  await shot(page, label + '-8-guideline');
  await next(page);
  assert.ok((await page.locator('.thought').innerText()).includes('다수가 원하면'), '?rebuttal=majority 반영');
  await page.locator('[data-action=decision][data-value=revise]').click();
  await fillAll(page);
  await next(page);
  await page.locator('[data-action=add-right]').first().click();
  await fillAll(page);
  await next(page);
  const report = await page.locator('main').innerText();
  assert.ok(report.includes('심의 결과'));
  const result = JSON.parse(await page.evaluate(() => localStorage.getItem('ethicity.result.humanrights')));
  assert.deepEqual(result, { game: 'humanrights', completed: true, ending: null, card: 'AI 안면인식 심의위원회 · 출입 조건부 도입 · 채용 조건부 도입 · 치안 도입 안 함' });
  await shot(page, label + '-9-report');

  // 새로고침해도 보고서에서 이어짐
  await page.reload();
  assert.ok((await page.locator('main').innerText()).includes('심의 결과'));

  // 가로 넘침 없음
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, label + ' 가로 넘침 ' + overflow + 'px');
  await page.close();
}

try {
  await play(1280, 800, 'desktop');
  await play(375, 740, 'mobile');
  assert.deepEqual(missing, [], '없는 파일: ' + missing.join(', '));
  assert.deepEqual(errors, [], '콘솔 오류: ' + errors.join(' / '));
  console.log('완주 확인: 1280px·375px');
} finally {
  await browser.close();
  server.close();
}
