// Browser regression: NODE_PATH=<bundled node_modules> node tests/browser.test.cjs
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const baseURL = process.env.TAROT_TEST_URL || 'http://127.0.0.1:4173/';
const results = [];
const errors = [];
let server;
let browser;

async function serveIfNeeded() {
  if (process.env.TAROT_TEST_URL) return;
  const running = await new Promise(resolve => {
    const request = http.get(baseURL, response => { response.resume(); resolve(true); });
    request.on('error', () => resolve(false));
    request.setTimeout(1000, () => { request.destroy(); resolve(false); });
  });
  if (running) return;
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
  server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, baseURL).pathname);
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
    fs.readFile(file, (error, data) => {
      response.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      response.end(error ? 'Not found' : data);
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4173, '127.0.0.1', resolve); });
}

async function test(name, run) {
  const started = Date.now();
  try { await run(); results.push({ name, status: 'PASS', ms: Date.now() - started }); }
  catch (error) { results.push({ name, status: 'FAIL', error: error.stack }); }
  console.log(JSON.stringify(results.at(-1)));
}

async function fresh(context, spread = 'three') {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('#question-guidance').waitFor();
  assert.equal(await page.locator('#ai-depth').count(), 1);
  await page.locator(`[data-spread="${spread}"]`).click();
  return page;
}

async function start(page) {
  await page.locator('#shuffle-button').click();
  await page.waitForFunction(() => document.querySelectorAll('.tarot-card:not([disabled])').length === 1);
}

async function revealAll(page, count, lineMode = false) {
  const increment = lineMode ? 7 : 1;
  for (let index = 0; index < count; index += increment) {
    const enabled = await page.locator('.tarot-card:not([disabled])').evaluateAll(cards => cards.map(card => Number(card.closest('[data-index]').dataset.index)));
    assert.deepEqual(enabled, [index], `only next ${lineMode ? 'line' : 'card'} may be revealed`);
    await page.locator(`.card-position[data-index="${index}"] .tarot-card`).click();
    assert.equal(await page.locator('.card-position.is-revealed').count(), index + increment);
  }
  assert.equal(await page.locator('.tarot-card:not([disabled])').count(), 0);
  await page.locator('#reading-result:not([hidden])').waitFor();
}

async function clipboard(page, selector) {
  await page.locator('#toast').evaluate(node => { node.textContent = ''; });
  await page.locator(selector).click();
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('已复制'));
  return (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
}

async function assertExports(page, count) {
  const sources = await page.locator('.card-front img').evaluateAll(images => images.map(image => image.getAttribute('src')));
  assert.equal(sources.length, count);
  assert.equal(new Set(sources).size, count, 'drawn card image files must be unique');
  const prompt = await clipboard(page, '#copy-ai-prompt');
  assert.equal((prompt.match(/^   抽到：/gm) || []).length, count, 'AI export must contain all card records');
  const record = prompt.split('\n<抽牌记录>\n')[1].split('\n</抽牌记录>')[0];
  const recordNumbers = [...record.matchAll(/^(\d+)\. /gm)].map(match => Number(match[1]));
  assert.deepEqual(recordNumbers, Array.from({ length: count }, (_, index) => index + 1));
  const names = [...record.matchAll(/^   抽到：.* · (.*?) \/ /gm)].map(match => match[1]);
  assert.equal(new Set(names).size, count, 'AI card names must be unique');
  const reading = await clipboard(page, '#copy-reading');
  assert.equal((reading.match(/^\d+\. .*｜/gm) || []).length, count, 'reading export must contain all cards');
  return { prompt, reading, names };
}

async function assertNoPageOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.width + 1, `page overflow: ${JSON.stringify(dimensions)}`);
}

async function assertZodiacOrder(page) {
  const locations = await page.evaluate(() => {
    const points = selector => [...document.querySelectorAll(selector)].slice(0, 12).map(node => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, row: style.gridRowStart, column: style.gridColumnStart };
    });
    return { diagram: points('.diagram-zodiac span'), cards: points('.layout-zodiac .card-position') };
  });
  for (const kind of ['diagram', 'cards']) {
    const points = locations[kind];
    assert.equal(points.length, 12);
    // Screen y increases downwards, so counterclockwise has negative signed area.
    const area = points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0);
    assert.ok(area < 0, `${kind} must run counterclockwise (signed area=${area})`);
  }
  assert.deepEqual(locations.diagram.map(p => [p.row, p.column]), locations.cards.map(p => [p.row, p.column]));
}

(async () => {
  await serveIfNeeded();
  browser = await chromium.launch({ headless: true, executablePath: process.env.TAROT_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });

  await test('question guidance shared by meditation/write; empty write is blocked', async () => {
    const page = await fresh(desktop);
    const guidance = await page.locator('#question-guidance').textContent();
    assert.ok(await page.locator('#question-guidance').isVisible());
    assert.equal(await page.locator('#mode-meditation').getAttribute('aria-selected'), 'true');
    await page.locator('#mode-write').click();
    assert.ok(await page.locator('#question-guidance').isVisible());
    assert.equal(await page.locator('#question-guidance').textContent(), guidance);
    await page.locator('#question').fill('   ');
    await page.locator('#shuffle-button').click();
    assert.match(await page.locator('#toast').textContent(), /请先写下问题/);
    assert.equal(await page.locator('#shuffle-button').isDisabled(), false);
    assert.equal(await page.locator('.tarot-card:not([disabled])').count(), 0);
    assert.equal(await page.evaluate(() => state.phase), 'idle');
    await page.close();
  });

  const configs = [
    { id: 'single', count: 1 }, { id: 'three', count: 3 }, { id: 'cross-five', count: 5 },
    { id: 'horseshoe', count: 7 }, { id: 'choice', count: 7 }, { id: 'celtic-cross', count: 10 },
    { id: 'waite-celtic-1911', count: 10, waite: true },
    { id: 'zodiac', count: 12 }, { id: 'zodiac', count: 13, theme: true },
    { id: 'full-forty-two', count: 42, lineMode: true }
  ];
  for (const config of configs) {
    await test(`desktop ${config.id}/${config.count}: sequential reveal, complete exports, no overflow`, async () => {
      const page = await fresh(desktop, config.id);
      if (config.theme) await page.locator('#theme-card').check({ force: true });
      if (config.waite) {
        await page.locator('#waite-significator').selectOption('major:8');
        await page.locator('#waite-facing').selectOption('left');
        assert.equal(await page.locator('#reversals').isDisabled(), true);
        assert.equal(await page.locator('#reversals').isChecked(), false);
        assert.equal(await page.locator('.waite-significator-display img').getAttribute('alt'), '正义，代表牌正面置中');
      }
      assert.equal(await page.locator('.tarot-card').count(), config.count);
      if (config.id === 'zodiac') await assertZodiacOrder(page);
      await assertNoPageOverflow(page);
      await start(page);
      await revealAll(page, config.count, config.lineMode);
      const { prompt } = await assertExports(page, config.count);
      if (config.lineMode) {
        assert.equal(await page.locator('.line-card-detail').count(), 42);
        assert.equal(await page.locator('.line-reading').count(), 6);
        assert.match(prompt, /逐牌详读（全部 42 张）/);
        assert.match(prompt, /必须覆盖全部 42 张/);
        const work = path.resolve(root, '../../work');
        if (fs.existsSync(work)) {
          await page.locator('#reading-result').evaluate(node => node.scrollIntoView({ behavior: 'instant', block: 'start' }));
          await page.screenshot({ path: path.join(work, 'browser-regression-42-desktop-result.png') });
        }
      } else {
        assert.equal(await page.locator('.interpretation-card').count(), config.count);
        if (config.waite) {
          const prompt = await clipboard(page, '#copy-ai-prompt');
          assert.match(prompt, /连续完成三轮 Fisher–Yates 洗牌及随机切牌/);
          assert.match(prompt, /代表牌为正义.*面向左/s);
          assert.match(prompt, /第 7 节没有规定制造逆位.*仅使用正位/s);
          assert.equal(await page.locator('.orientation-badge').filter({ hasText: '逆位' }).count(), 0);
          assert.equal(await page.locator('#waite-follow-up').isVisible(), true);
        }
      }
      await assertNoPageOverflow(page);
      await page.close();
    });
  }

  await test('Waite 1911 original mode validates settings, overlays covers/crosses, and can reuse card 10', async () => {
    const page = await fresh(desktop, 'waite-celtic-1911');
    assert.ok(await page.locator('#waite-original-note').isVisible());
    await page.locator('#shuffle-button').click();
    assert.match(await page.locator('#toast').textContent(), /选择代表/);
    await page.locator('#waite-significator').selectOption('major:1');
    await page.locator('#shuffle-button').click();
    assert.match(await page.locator('#toast').textContent(), /确认代表牌面向/);
    await page.locator('#waite-facing').selectOption('left');
    const centers = await page.evaluate(() => {
      const center = selector => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      };
      return {
        first: center('#card-grid [data-index="0"] .tarot-card'),
        second: center('#card-grid [data-index="1"] .tarot-card'),
        sig: center('#card-grid .waite-significator-display img')
      };
    });
    assert.ok(Math.abs(centers.first.x - centers.second.x) < 4 && Math.abs(centers.first.y - centers.second.y) < 4);
    assert.ok(
      Math.abs(centers.first.x - centers.sig.x) < 20 && Math.abs(centers.first.y - centers.sig.y) < 20,
      JSON.stringify(centers)
    );
    await start(page);
    await revealAll(page, 10);
    await page.screenshot({ path: path.join(root, 'work', 'browser-regression-waite-1911-desktop.png'), fullPage: true });
    const tenthName = await page.evaluate(() => state.draws[9].card.name);
    await page.locator('#waite-follow-up').click();
    assert.equal(await page.evaluate(() => state.phase), 'idle');
    assert.equal(await page.locator('#waite-significator option:checked').textContent().then(text => text.includes(tenthName)), true);
    assert.equal(await page.locator('#waite-facing').inputValue(), '');
    await page.close();
  });

  await test('42 card summary mode + chosen significator excluded from 42 unique records', async () => {
    const page = await fresh(desktop, 'full-forty-two');
    await page.locator('#significator').selectOption('1');
    await page.locator('#ai-depth').selectOption('summary');
    await start(page);
    await revealAll(page, 42, true);
    const { prompt, reading, names } = await assertExports(page, 42);
    assert.match(prompt, /六行概览（压缩摘要）/);
    assert.match(prompt, /有效牌库为 77 张/);
    assert.match(reading, /历史人物牌：魔术师/);
    assert.ok(!names.includes('魔术师'));
    await page.close();
  });

  await test('shuffle snapshot survives changed DOM question, reversals, theme and spread values', async () => {
    const page = await fresh(desktop, 'zodiac');
    await page.locator('#mode-write').click();
    await page.locator('#question').fill('到年底，我在十二个领域有哪些值得关注的主题？');
    await page.locator('#theme-card').check({ force: true });
    await page.locator('#reversals').uncheck({ force: true });
    await page.locator('#shuffle-button').click();
    assert.equal(await page.evaluate(() => state.phase), 'shuffling');
    await page.evaluate(() => {
      document.querySelector('#question').value = 'DOM CHANGED';
      document.querySelector('#theme-card').checked = false;
      document.querySelector('#reversals').checked = true;
      document.querySelector('[data-spread="single"]').click();
    });
    await page.waitForFunction(() => state.phase === 'ready');
    await revealAll(page, 13);
    const { prompt } = await assertExports(page, 13);
    assert.match(prompt, /到年底，我在十二个领域有哪些值得关注的主题/);
    assert.ok(!prompt.includes('DOM CHANGED'));
    assert.match(prompt, /本次使用 13 张牌/);
    assert.match(prompt, /仅使用正位/);
    assert.ok(!(await page.locator('.card-front img.is-reversed').count()));
    await page.close();
  });

  await test('42 snapshot preserves significator and detail mode changed during shuffle', async () => {
    const page = await fresh(desktop, 'full-forty-two');
    await page.locator('#significator').selectOption('2');
    await page.locator('#ai-depth').selectOption('detailed');
    await page.locator('#shuffle-button').click();
    await page.evaluate(() => { document.querySelector('#significator').value = '1'; document.querySelector('#ai-depth').value = 'summary'; });
    await page.waitForFunction(() => state.phase === 'ready');
    await revealAll(page, 42, true);
    const { prompt, names } = await assertExports(page, 42);
    assert.match(prompt, /人物牌为女教皇/);
    assert.match(prompt, /逐牌详读（全部 42 张）/);
    assert.ok(!names.includes('女教皇'));
    await page.close();
  });

  await test('reset cancels pending shuffle; new session survives old timer completion', async () => {
    const page = await fresh(desktop);
    await page.locator('#shuffle-button').click();
    await page.evaluate(() => resetReading());
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => state.phase), 'idle');
    assert.equal(await page.locator('.tarot-card:not([disabled])').count(), 0);
    assert.equal(await page.locator('#reading-result').isVisible(), false);
    await page.locator('#shuffle-button').click();
    await page.evaluate(() => { resetReading(); selectSpread('single'); startShuffle(); });
    await page.waitForFunction(() => state.phase === 'ready');
    assert.equal(await page.locator('.tarot-card').count(), 1);
    await revealAll(page, 1);
    await assertExports(page, 1);
    await page.close();
  });

  await test('mobile 390px all layouts; 42 line draw and exports; scoped board scrolling', async () => {
    const page = await fresh(mobile);
    for (const config of configs) {
      await page.locator(`[data-spread="${config.id}"]`).click();
      if (config.theme) await page.locator('#theme-card').check({ force: true });
      assert.equal(await page.locator('.tarot-card').count(), config.count);
      await assertNoPageOverflow(page);
    }
    await start(page);
    await revealAll(page, 42, true);
    await assertExports(page, 42);
    await assertNoPageOverflow(page);
    const resultColumns = await page.locator('#interpretations').evaluate(node => getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length);
    assert.equal(resultColumns, 1, 'mobile reading rows should use one readable column');
    const grid = await page.locator('#card-grid').evaluate(node => ({ client: node.clientWidth, scroll: node.scrollWidth }));
    assert.ok(grid.scroll > grid.client, '42 card board should scroll inside its own bounds');
    const work = path.resolve(root, '../../work');
    if (fs.existsSync(work)) {
      await page.screenshot({ path: path.join(work, 'browser-regression-42-mobile.png'), fullPage: true });
      await page.locator('#reading-result').evaluate(node => node.scrollIntoView({ behavior: 'instant', block: 'start' }));
      await page.screenshot({ path: path.join(work, 'browser-regression-42-mobile-result.png') });
    }
    await page.close();
  });
  await test('no browser runtime errors', async () => assert.deepEqual(errors, []));
  console.log(JSON.stringify({ total: results.length, passed: results.filter(result => result.status === 'PASS').length, failed: results.filter(result => result.status === 'FAIL').length }, null, 2));
  if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});
