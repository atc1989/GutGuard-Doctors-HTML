// Speed budget check (Addendum 05, Section 7a). Run against a production build before every release:
//   npm run build && npx next start -p 3100
//   node docs/prototype/speed_check.js http://localhost:3100/ http://localhost:3100/shop ...
// Phone (W=390 default; W=1440 for desktop) on slow 4G: 1.6 Mbps down, 150 ms latency, CPU 4x slower. Cache off. Each page loads 3 times;
// the median is checked. Exit code 1 when any page is over budget.
const { chromium } = require('playwright');
const BUDGET = { lcp: 2500, cls: 0.1, jsKB: 220, tbt: 400 };
const urls = process.argv.slice(2);
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
(async () => {
  if (!urls.length) { console.log('usage: node speed_check.js <url> [url...]'); process.exit(2); }
  const b = await chromium.launch(); let failed = 0;
  console.log(`budget: main content ≤ ${BUDGET.lcp} ms · layout jumps ≤ ${BUDGET.cls} · page code ≤ ${BUDGET.jsKB} KB · blocking ≤ ${BUDGET.tbt} ms\n`);
  for (const u of urls) {
    const runs = [];
    for (let k = 0; k < 3; k++) {
      const ctx = await b.newContext({ viewport: { width: Number(process.env.W || 390), height: 900 }, deviceScaleFactor: 1 });
      const p = await ctx.newPage(); const c = await ctx.newCDPSession(p);
      await c.send('Network.enable'); await c.send('Network.setCacheDisabled', { cacheDisabled: true });
      await c.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
      await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const types = new Map(); let js = 0;
      c.on('Network.responseReceived', (e) => types.set(e.requestId, e.type));
      c.on('Network.loadingFinished', (e) => { if (types.get(e.requestId) === 'Script') js += e.encodedDataLength; });
      await p.addInitScript(() => {
        window.__m = { lcp: 0, cls: 0, tbt: 0 };
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.tbt += Math.max(0, e.duration - 50); }).observe({ type: 'longtask', buffered: true });
      });
      await p.goto(u, { waitUntil: 'load', timeout: 90000 }); await p.waitForTimeout(3000);
      const m = await p.evaluate(() => window.__m);
      runs.push({ lcp: Math.round(m.lcp), cls: Math.round(m.cls * 1000) / 1000, tbt: Math.round(m.tbt), jsKB: Math.round(js / 1024) });
      await ctx.close();
    }
    const r = { lcp: med(runs.map((x) => x.lcp)), cls: med(runs.map((x) => x.cls)), tbt: med(runs.map((x) => x.tbt)), jsKB: med(runs.map((x) => x.jsKB)) };
    const over = Object.keys(BUDGET).filter((k) => r[k] > BUDGET[k]);
    if (over.length) failed++;
    console.log(`${over.length ? 'OVER' : 'OK  '} ${u.padEnd(44)} main content ${r.lcp} ms · jumps ${r.cls} · code ${r.jsKB} KB · blocking ${r.tbt} ms${over.length ? '  ← ' + over.join(', ') : ''}`);
  }
  await b.close(); process.exit(failed ? 1 : 0);
})();
