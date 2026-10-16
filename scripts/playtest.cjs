// Headless playtest + screenshots. Usage: node scripts/playtest.cjs <before|after> <baseUrl> <outDir>
// Needs the playwright package (NODE_PATH) and its chromium. Records a video of the desktop run.
const { chromium } = require('playwright');
const fs = require('fs');
const [, , which, base, out] = process.argv;
fs.mkdirSync(out, { recursive: true });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(label, viewport, opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: !!opts.touch, isMobile: !!opts.touch,
    recordVideo: opts.video ? { dir: out + '/video-' + label, size: viewport } : undefined });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label} console: ${m.text()}`); });
  const shot = async (n) => { await page.screenshot({ path: `${out}/${which}-${label}-${n}.png` }); console.log('shot', label, n); };
  const t0 = Date.now();
  await page.goto(base, { waitUntil: 'load' });
  console.log(label, 'load ms', Date.now() - t0);
  if (which === 'before') {
    await shot('01-login');
    await page.fill('input', 'Playtest');
    await page.click('button[type=submit]');
    await sleep(800); await shot('02-after-login-no-cards');
    await page.getByRole('button', { name: 'New Game' }).click(); await sleep(500); await shot('02b-table');
    for (let i = 0; i < 5; i++) {
      await page.locator('.player-hand .card').first().click(); await sleep(200);
      if (i === 0) await shot('03-selected');
      await page.getByRole('button', { name: 'Play Card' }).click(); await sleep(500);
      if (i === 1) await shot('04-round');
    }
    await sleep(500); await shot('05-end');
  } else {
    await sleep(600); await shot('01-title');
    await page.getByRole('button', { name: /Play the first match/ }).click(); await sleep(700);
    await shot('02-coach');
    const tap = async (i) => { const c = page.locator('.hand .card').nth(i); await c.click(); };
    for (let r = 0; r < 6; r++) {
      const n = await page.locator('.hand .card').count();
      await tap(n - 1 - (r % n)); await sleep(250);
      if (r === 0) await shot('03-selected');
      await page.locator('.play-btn').click();
      await sleep(260); if (r === 1) await shot('04-flip');
      await sleep(700); if (r === 1 || r === 3) await shot(`05-result-r${r + 1}`);
      await sleep(1200);
    }
    await sleep(900); await shot('06-over');
    await page.getByRole('button', { name: 'Menu', exact: true }).click(); await sleep(700);
    await page.evaluate(() => window.scrollTo(0, 99999)); await sleep(400); await shot('07-menu-record');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: /Premium · \$3/ }).click(); await sleep(500); await shot('08-premium');
    await page.keyboard.press('Escape'); await page.mouse.click(5, 5); await sleep(300);
    // keyboard-only round on Sharp
    await page.locator('.plate', { hasText: 'Sharp' }).click(); await sleep(700);
    await page.keyboard.press('3'); await sleep(150); await page.keyboard.press('Enter'); await sleep(1100);
    await shot('09-keyboard-round');
    // rival 1 (house rules strip)
    await page.getByRole('button', { name: 'Back to menu' }).click(); await sleep(500);
    await page.locator('.title-row', { hasText: 'Dot' }).click(); await sleep(700); await shot('10-rival');
  }
  await ctx.close(); await browser.close();
}

(async () => {
  await run('desktop', { width: 1280, height: 860 }, { video: true });
  await run('mobile', { width: 390, height: 844 }, { touch: true });
  fs.writeFileSync(`${out}/${which}-errors.txt`, errors.join('\n') || 'no page errors');
  console.log('errors:', errors.length ? errors : 'none');
})().catch((e) => { console.error(e); process.exit(1); });
