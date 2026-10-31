// 끝까지 진행 검사: 키보드만(1280), 터치만(760·430)으로 표지 → 완료까지 가며
// 시작 전 학생 고르기: 1280 지호(뉴스 결과 위원 → 하늘이 대신), 760 온유, 430 새봄.
// 뉴스·광고·교육·최종 심의 모두 걸어 다니며 진행한다.
// 탐험 화면(지도·도서관)은 플레이어가 걸어간다. 키보드는 Space('어디로 가지?')→Enter, 760은 무대 위 표시, 430은 패널 목록을 누른다.
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
      { name: 'kbd-1280', viewport: { width: 1280, height: 800 }, keyboard: true, pick: 1, reporter: '하늘' },
      { name: 'touch-760', viewport: { width: 760, height: 1000 }, touch: true, pick: 4, reporter: '지호' },
      { name: 'touch-430', viewport: { width: 430, height: 900 }, touch: true, reducedMotion: 'reduce', pick: 3, reporter: '지호' }
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
      let guard = 0, shots = new Set(), checkedLock = false, checkedWalk = false;
      const pos = () => page.evaluate(() => window.DiversityWalk.position());
      const screenKey = () => page.evaluate(() => (document.querySelector('.dv-eyebrow') || {}).textContent + '|' + (document.querySelector('.dv-title') || {}).textContent);
      while (guard++ < 200) {
        await page.waitForTimeout(30);
        const eyebrow = (await page.locator('.dv-eyebrow').first().textContent()) || '';
        const id = eyebrow.split(' · ')[0];
        await overflow(eyebrow);
        const type = id === 'P-01' ? 'talk' : id === 'N-05' ? 'final' : eyebrow.startsWith('지도') ? 'map' : eyebrow.includes('미션 1 탐험') ? 'explore' : eyebrow.includes('새로운 정보') ? 'info' : eyebrow.includes('사건 제시') ? 'case' : eyebrow.includes('선택 결과') ? 'result' : eyebrow.includes('분야별 적용') ? 'charter' : eyebrow.includes('결과 보고서') ? 'report' : eyebrow.includes('최종 성찰') || eyebrow.includes('판단 성찰') ? 'reflect' : null;
        if (type && !shots.has(type)) { shots.add(type); await page.screenshot({ path: SHOT(run.name + '-' + type), fullPage: true }); }

        if (eyebrow.startsWith('탐험 완료')) break;
        if (eyebrow.startsWith('시작')) {
          assert(await page.getByRole('button', { name: '이 모습으로 시작' }).isDisabled(), '학생을 골라야 시작');
          if (run.keyboard) { await page.locator('.dv-title').focus(); await page.keyboard.press(String(run.pick)); await page.keyboard.press('Enter'); }
          else { await page.locator('.dv-pick').nth(run.pick - 1).tap(); await page.getByRole('button', { name: '이 모습으로 시작' }).tap(); }
          continue;
        }
        if (await page.locator('#spots:not([hidden])').count()) {
          const task = await page.locator('#hud-task-text').textContent();
          assert(task && !(await page.locator('#hud-task').isHidden()), '지금 할 일 표시');
          if (eyebrow.startsWith('지도') && run.name === 'touch-760' && !checkedLock) {
            checkedLock = true;
            // 바닥을 누르면 그쪽으로 걸어간다
            const before = await pos();
            await page.locator('#spots').tap({ position: { x: 40, y: 140 } });
            await page.waitForFunction((b) => window.DiversityWalk.position().x < b.x - 40, before, { timeout: 8000 });
            await page.locator('.dv-spot[data-state=locked]').first().tap();
            await page.waitForFunction(() => document.querySelector('.dv-buddy-line').textContent.includes('마친 뒤에 열려요'), null, { timeout: 15000 });
            await page.getByRole('button', { name: '물어보기' }).tap();
            assert((await page.locator('.dv-buddy-line').textContent()).endsWith('?'), '로봇 질문');
          }
          if (eyebrow.includes('미션 1 탐험') && !checkedWalk) {
            checkedWalk = true;
            assert((await page.locator('.dv-spot-row[data-spot=reporter]').textContent()).includes(run.reporter), '결과 위원 대신 맡기');
            if (run.keyboard) {
              const before = await pos();
              await page.locator('.dv-title').focus();
              await page.keyboard.down('ArrowUp'); await page.waitForTimeout(400); await page.keyboard.up('ArrowUp');
              const after = await pos();
              assert(after.y < before.y - 30 && after.dir === 'up', '방향키로 걷기 ' + JSON.stringify([before, after]));
            }
          }
          const key = await screenKey();
          if (run.keyboard) {
            // Space는 앞에 있는 곳을 살펴보는 키라, 길 안내는 '어디로 가지?' 버튼으로
            await page.getByRole('button', { name: '어디로 가지?' }).focus(); await page.keyboard.press('Enter');
            assert.equal(await page.evaluate(() => document.activeElement.dataset.state), 'new', '어디로 가지? → 다음 목적지에 초점');
            await page.keyboard.press('Enter');
          } else if (run.name === 'touch-430') await page.locator('.dv-spot-row[data-state=new]').first().tap();
          else await page.locator('.dv-spot[data-state=new]').first().tap();
          // 걸어가서 살펴볼 때까지
          await page.waitForFunction((k) => (document.querySelector('.dv-eyebrow') || {}).textContent + '|' + (document.querySelector('.dv-title') || {}).textContent !== k, key, { timeout: 20000 });
          continue;
        }
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
      assert.deepEqual(keys, ['ethicity.diversity.progress.v2', 'ethicity.diversity.settings.v1', 'ethicity.result.diversity']);

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
    await page.evaluate(() => { localStorage.setItem('ethicity.diversity.progress.v2', '{"v":2,"scene":'); localStorage.setItem('ethicity.diversity.progress.v1', '{"v":1,"scene":3}'); localStorage.setItem('ethicity.player', '{"nickname":"새벽"}'); });
    await page.reload();
    await page.waitForSelector('.dv-start');
    assert(await page.getByRole('button', { name: '탐험을 시작합니다' }).isVisible());
    assert((await page.locator('.dv-start').textContent()).includes('새벽 위원님'));
    assert.equal(await page.evaluate(() => localStorage.getItem('ethicity.diversity.progress.v1')), null, '첫 판 저장은 지움');
    // 뉴스 최종 판단 전인데 더 뒤로 저장된 진행 → 도서관 탐험으로, 살펴본 곳에 이어서
    await page.evaluate(() => localStorage.setItem('ethicity.diversity.progress.v2', JSON.stringify({ v: 2, scene: 15, player: 'saebom', initial: 'A', found: { news: ['plan', 'output', 'quotes', 'good', 'BAD!'] }, missions: { news: { first: 'B', final: null } } })));
    await page.reload();
    await page.getByRole('button', { name: '이어 하기' }).click();
    assert((await page.locator('.dv-eyebrow').first().textContent()).includes('미션 1 탐험'));
    assert.equal(await page.locator('#hud-task-text').textContent(), '지호·온유에게 결과 듣기 (1/2)');
    assert.deepEqual(await page.locator('.dv-spot[data-state=new]').evaluateAll((b) => b.map((x) => x.dataset.spot)), ['critic']);
    // 학생을 고르기 전 저장 → 고르기 화면으로
    await page.evaluate(() => localStorage.setItem('ethicity.diversity.progress.v2', JSON.stringify({ v: 2, scene: 8, initial: 'A' })));
    await page.reload();
    await page.getByRole('button', { name: '이어 하기' }).click();
    assert((await page.locator('.dv-eyebrow').first().textContent()).startsWith('시작'));
    assert.deepEqual(errors, []);
    console.log('통과 저장 손상·이어 하기');
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
