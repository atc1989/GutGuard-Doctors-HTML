// Parity + wiring test for the ported website (Next.js build on :3100).
// The order, Maya and first-buyer endpoints are intercepted, so it runs without Supabase or Maya keys.
const { chromium } = require('playwright');
const B = process.env.BASE || 'http://localhost:3100';
const OUT = process.env.SHOTS || require('os').tmpdir() + '/gg-shots';
require('fs').mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  const b = await chromium.launch(); const errs = [];
  const fresh = async (path, w = 390, h = 844, eligible = true) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(path + ': ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|fonts|Supabase is not configured/.test(m.text())) errs.push(path + ' console: ' + m.text()); });
    p.orders = [];
    await p.route('**/api/shop/first-buyer**', (r) => r.fulfill({ json: { eligible } }));
    await p.route('**/api/shop/order', async (r) => { p.orders.push(JSON.parse(r.request().postData())); await r.fulfill({ json: { id: 'o-1', orderCode: 'GG-TEST1' } }); });
    await p.route('**/api/maya/checkout', (r) => r.fulfill({ json: { redirectUrl: B + '/shop?order=GG-TEST1&p=success', orderUrl: B + '/shop/order/GG-TEST1' } }));
    await p.route('**/api/maya/reconcile', (r) => r.fulfill({ json: { paymentStatus: 'paid', changed: false } }));
    await p.goto(B + path); await p.waitForTimeout(900); return p;
  };
  const fill = async (p) => {
    await p.fill('#co-m', '0917 111 2233'); await p.waitForTimeout(150);
    await p.fill('#co-fn', 'Rey'); await p.fill('#co-ln', 'Aquino'); await p.fill('#co-em', 'rey@example.com');
    await p.fill('#co-cityq', 'general santos'); await p.click('.co-sugg button:has-text("General Santos City")');
    await p.waitForSelector('#co-brgy option:has-text("Lagao")', { state: 'attached', timeout: 5000 }); await p.selectOption('#co-brgy', 'Lagao');
    await p.fill('#co-st', '12 Rizal St.'); await p.fill('#co-zip', '9500');
  };

  // 1. every page renders, real paths
  for (const path of ['/', '/science', '/system', '/physicians', '/about', '/legal', '/shop']) {
    const p = await fresh(path, 1280, 900);
    ok(await p.locator('h1').first().isVisible(), `page ${path} renders a heading`);
    if (path === '/' || path === '/shop') await p.screenshot({ path: `${OUT}/desk${path === '/' ? '-home' : path.replace('/', '-')}.png` });
    await p.context().close();
  }

  // 2. nav goes to real URLs
  let p = await fresh('/', 1280, 900);
  await p.locator('nav a:has-text("The Science")').first().click(); await p.waitForTimeout(500);
  ok(new URL(p.url()).pathname === '/science', 'nav: The Science -> /science (' + p.url() + ')');
  await p.context().close();

  // 3. 5-Night Watch: live checkout fields, one pay option, order body, Maya return -> Done
  p = await fresh('/shop?start=watch');
  ok(await p.locator('.sl-co.on').count() === 1, 'start=watch opens checkout');
  const pays = await p.$$eval('.sl-co.on .co-pay b', (e) => e.map((x) => x.textContent));
  ok(pays.length === 1 && pays[0] === 'Maya', 'one pay option: Maya (' + pays + ')');
  ok(await p.locator('.co-code').count() === 0, 'no fake SMS code box');
  await p.locator('.sl-co.on .co-paybtn').click(); await p.waitForTimeout(300);
  ok(/mobile/i.test(await p.locator('.sl-co.on .co-hint').last().textContent()), 'empty form: hint asks for mobile');
  await fill(p); await p.screenshot({ path: `${OUT}/watch-filled.png` });
  ok(/Free/.test(await p.locator('.sl-co.on .co-tots').textContent()), 'Watch alone: free shipping');
  await p.locator('.sl-co.on .co-paybtn').click(); await p.waitForURL(/p=success|\/shop$/, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(1500);
  const body = p.orders[0] || {};
  ok(JSON.stringify(body.items) === JSON.stringify([{ id: 'watch', qty: 1 }]), 'order body items: ' + JSON.stringify(body.items));
  ok(body.firstName === 'Rey' && body.lastName === 'Aquino' && body.email === 'rey@example.com' && body.zip === '9500' && body.barangay === 'Lagao', 'order body contact + address');
  ok(!('price' in (body.items || [{}])[0]), 'browser sends no prices');
  await p.screenshot({ path: `${OUT}/watch-done.png` });
  const done = await p.locator('.sl-co.on .co-ok').textContent().catch(() => '');
  ok(/Payment confirmed/.test(done) && /Finish your free Lifestyle card/.test(done), 'Maya return shows Done + finish-card step');
  ok(new URL(p.url()).search === '', 'URL cleaned after return (' + p.url() + ')');
  await p.context().close();

  // 4. number with a recent order: the Watch becomes a Blister
  p = await fresh('/shop?start=watch', 390, 844, false);
  await fill(p); await p.waitForTimeout(800);
  ok(await p.locator('.co-swap').isVisible().catch(() => false), 'recent order: swap note shown');
  ok(/Blister/.test(await p.locator('.sl-co.on .co-items').textContent()), 'recent order: Blister in the order');
  ok(/₱150/.test(await p.locator('.sl-co.on .co-tots').textContent()), 'Blister pays flat ₱150 shipping');
  await p.context().close();

  // 5. Gutguard Daily: plan id sent, renewal box required
  p = await fresh('/shop?tab=subscribe&goal=full');
  await p.click('.sl-bar button'); await p.waitForTimeout(400); await fill(p);
  await p.locator('.sl-co.on .co-paybtn').click(); await p.waitForTimeout(300);
  ok(p.orders.length === 0, 'plan: no order before the renewal box is ticked');
  await p.check('#co-agree input'); await p.locator('.sl-co.on .co-paybtn').click(); await p.waitForTimeout(1500);
  ok(JSON.stringify((p.orders[0] || {}).items) === JSON.stringify([{ id: 'plan-full-monthly', qty: 1 }]) && p.orders[0].planAgree === true, 'plan body: ' + JSON.stringify((p.orders[0] || {}).items));
  await p.context().close();

  // 6. cancelled at Maya: back to checkout with the retry message
  p = await fresh('/shop?order=GG-TEST1&p=cancel');
  ok(/cancelled/.test(await p.locator('.co-fail').textContent().catch(() => '')), 'cancel return: retry message');
  await p.context().close();

  // 7. widths
  for (const w of [360, 768, 1440]) { p = await fresh('/shop', w, 900); const sw = await p.evaluate(() => document.documentElement.scrollWidth); ok(sw <= w, `no side scroll at ${w}px (${sw})`); await p.context().close(); }

  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 5)));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})();
