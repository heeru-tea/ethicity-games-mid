// 끝까지 진행 검사: 키보드만(1280), 터치만(760·430)으로 표지 → 완료까지 가며
// 콘솔 오류·가로 넘침·통합 이벤트·저장 키·이어 하기를 확인하고 화면을 tests/_shot-*.png로 남긴다.
// 실행: PLAYWRIGHT_PATH=<playwright 경로> node diversity/tests/check-flow.cjs
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

const SHOT = (name) => path.join(__dirname, '_shot-' + name + '.png');

(async () => {
  const { startServer } = await import('./serve.mjs');
  const server = await startServer(0);
  const base = 'http://127.0.0.1:' + server.address().port + '/diversity/';
  const browser = await chromium.launch({ headless: true });
  try {
    for (const run of [
      { name: 'kbd-1280', viewport: { width: 1280, height: 800 }, keyboard: true },
      { name: 'touch-760', viewport: { width: 760, height: 1000 }, touch: true },
      { name: 'touch-430', viewport: { width: 430, height: 900 }, touch: true, reducedMotion: 'reduce' }
    ]) {
      const ctx = await browser.newContext({ viewport: run.viewport, hasTouch: !!run.touch, isMobile: !!run.touch, reducedMotion: run.reducedMotion || 'no-preference' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.addInitScript(() => {
        window.__events = [];
        ['ethicity:ready', 'ethicity:progress', 'ethicity:complete'].forEach((t) => window.addEventListener(t, (e) => window.__events.push(e.detail)));
      });
      await page.goto(base);
      await page.waitForSelector('.dv-start');
      // 대사는 한 번에(검사 속도) — 메뉴 설정으로 바꾼다
      await page.click('#btn-menu');
      await page.check('input[name=speed][value=instant]');
      await page.click('#btn-menu-close');
      await page.screenshot({ path: SHOT(run.name + '-start') });

      const press = async (sel) => {
        if (run.keyboard) { await page.locator(sel).focus(); await page.keyboard.press('Enter'); }
        else await page.locator(sel).tap();
      };
      const overflow = async (where) => {
        const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert(w <= 1, run.name + ' 가로 넘침 ' + w + 'px @ ' + where);
      };

      // 표지 → 시작
      if (run.keyboard) { await page.locator('.dv-title').focus(); await page.keyboard.press('Space'); }
      else await page.getByRole('button', { name: '탐험을 시작합니다' }).tap();

      const picks = { 'P-03': 3, 'N-02': 1, 'N-05': 3, 'A-03': 2, 'A-06': 2, 'E-03': 1, 'E-06': 3 };
      let guard = 0, shots = new Set();
      while (guard++ < 200) {
        await page.waitForTimeout(30);
        const eyebrow = (await page.locator('.dv-eyebrow').first().textContent()) || '';
        const id = eyebrow.split(' · ')[0];
        await overflow(eyebrow);
        const type = id === 'P-01' ? 'talk' : id === 'N-05' ? 'final' : eyebrow.includes('사건 제시') ? 'case' : eyebrow.includes('선택 결과') ? 'result' : eyebrow.includes('분야별 적용') ? 'charter' : eyebrow.includes('결과 보고서') ? 'report' : eyebrow.includes('최종 성찰') || eyebrow.includes('판단 성찰') ? 'reflect' : null;
        if (type && !shots.has(type)) { shots.add(type); await page.screenshot({ path: SHOT(run.name + '-' + type), fullPage: true }); }

        if (eyebrow.startsWith('탐험 완료')) break;
        if (picks[id] && await page.locator('.dv-choice').count()) {
          const n = picks[id];
          const decide = page.getByRole('button', { name: '결정하기' });
          assert(await decide.isDisabled(), id + ' 기본 선택이 없어야 함');
          if (id.endsWith('5') || id.endsWith('6')) assert.equal(await page.locator('.dv-first').count(), 1, id + ' 처음 선택 표시');
          if (run.keyboard) { await page.locator('.dv-title').focus(); await page.keyboard.press(String(n)); await page.keyboard.press('Enter'); }
          else { await page.locator('.dv-choice').nth(n - 1).tap(); await decide.tap(); }
          continue;
        }
        if (id === 'F-02') {
          if (run.keyboard) { await page.locator('.dv-title').focus(); await page.keyboard.press('2'); await page.keyboard.press('Enter'); }
          else { await page.locator('.dv-choice').nth(1).tap(); await page.getByRole('button', { name: '결정하기' }).tap(); }
          continue;
        }
        if (id === 'F-03') {
          await page.fill('#charter-news', 'AI 이미지임을 밝히고, 기사 목적에 맞게 인물을 구성한다.');
          await page.fill('#charter-ad', '비하와 부당한 배제를 점검한다.');
          // 교육 칸은 일부러 비워 '미작성' 확인
          await page.fill('#charter-reason', '세 분야 모두에서 배제되는 사람이 없어야 하기 때문이다.');
          await press('text=작성 완료 · 점검하기');
          continue;
        }
        if (id === 'F-04') {
          assert.equal(await page.locator('.dv-charter .dv-empty').count(), 1, '미작성 1칸');
          await press('text=이대로 확정하기');
          await page.waitForSelector('#confirm:not([hidden])');
          await press('#confirm-yes');
          continue;
        }
        if (id === 'END-01') {
          const rows = await page.locator('.dv-table tbody tr').allTextContents();
          assert.equal(rows.length, 3);
          assert(rows[0].includes('수정') && rows[1].includes('유지') && rows[2].includes('수정'), '유지/수정 표시: ' + rows);
          await press('text=최종 성찰로');
          continue;
        }
        if (id === 'END-02') {
          assert(await page.getByRole('button', { name: '제출하기' }).isDisabled());
          if (run.keyboard) { await page.locator('.dv-title').focus(); await page.keyboard.press('2'); }
          else await page.locator('.dv-choice').nth(1).tap();
          await page.fill('#reflect-reason', '분야마다 목적이 다르다는 것을 알게 되었다.');
          await press('text=제출하기');
          continue;
        }
        // 그 밖의 장면: 기본 버튼(카드 맨 아래 오른쪽)
        const btn = page.locator('.dv-actions .ee-button').last();
        if (run.keyboard) { await page.locator('.dv-title').focus(); await page.keyboard.press('Space'); }
        else await btn.tap();
      }
      assert(guard < 200, run.name + ' 완료 화면에 닿지 못함');
      await page.screenshot({ path: SHOT(run.name + '-complete'), fullPage: true });

      const events = await page.evaluate(() => window.__events);
      assert.equal(events[0].type, 'ethicity:ready');
      assert.deepEqual(events.filter((e) => e.type === 'ethicity:progress').map((e) => e.current), [0, 1, 2, 3, 4, 5, 6]);
      const done = events.filter((e) => e.type === 'ethicity:complete');
      assert.equal(done.length, 1);
      assert.deepEqual(done[0], { type: 'ethicity:complete', gameId: 'diversity', result: { completed: true } });

      const keys = await page.evaluate(() => Object.keys(localStorage).sort());
      assert.deepEqual(keys, ['ethicity.diversity.progress.v1', 'ethicity.diversity.settings.v1', 'ethicity.result.diversity']);

      // 새로고침 → 표지에 '완료 화면 보기'
      await page.reload();
      await page.waitForSelector('.dv-start');
      assert(await page.getByRole('button', { name: '완료 화면 보기' }).isVisible());

      assert.deepEqual(errors, [], run.name + ' 콘솔 오류');
      console.log('통과', run.name);
      await ctx.close();
    }

    // 손상된 저장값 → 멈추지 않고 표지
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await page.evaluate(() => { localStorage.setItem('ethicity.diversity.progress.v1', '{"v":1,"scene":'); localStorage.setItem('ethicity.player', '{"nickname":"새벽"}'); });
    await page.reload();
    await page.waitForSelector('.dv-start');
    assert(await page.getByRole('button', { name: '탐험을 시작합니다' }).isVisible());
    assert((await page.locator('.dv-start').textContent()).includes('새벽 위원님'));
    // 고르지 않은 선택 뒤로 저장된 진행 → 그 선택 장면으로
    await page.evaluate(() => localStorage.setItem('ethicity.diversity.progress.v1', JSON.stringify({ v: 1, scene: 12, initial: 'A', missions: { news: { first: 'B', final: null } } })));
    await page.reload();
    await page.getByRole('button', { name: '이어 하기' }).click();
    assert((await page.locator('.dv-eyebrow').first().textContent()).startsWith('N-05'));
    assert.deepEqual(errors, []);
    console.log('통과 저장 손상·이어 하기');
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
