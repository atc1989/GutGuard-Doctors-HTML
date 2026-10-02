# Prototype port: website (Addendum 05)

These files are **generated** from the approved prototype. Do not hand-edit them for design or copy
changes; change the prototype, then port again:

- `components/GutguardSite.jsx` - every page except the Shop
- `components/GutguardShop.jsx` - the Shop and checkout (its own download)
- `components/GutguardSite.css` - the site styles
- `components/GutguardLogo.jsx` - the logo (also used by SiteNav, Shoplet, PartnerPortal)

## Port again

1. Put the new prototype in `docs/prototype/gutguard-site.prototype.jsx`.
2. From the repo root:
   `python3 docs/prototype/port_site.py docs/prototype/gutguard-site.prototype.jsx components/GutguardSite.jsx`
   (it writes all four files).
3. If a step stops with "expected 1 match", the prototype changed at that line. Update that one `rep(...)` in `port_site.py`.
4. Check for undefined names: `npx eslint --rule '{"no-undef":"error"}' components/GutguardShop.jsx components/GutguardSite.jsx`
   (only browser globals such as `window` may appear).

## Test

1. Once: `npm i -D playwright && npx playwright install chromium`.
2. `npm test`, `npm run build`, then `npx next start -p 3100`.
3. `node docs/prototype/test_site_port.js` - 28 browser checks (order, Maya and first-buyer calls are stubbed).
4. `node docs/prototype/speed_check.js http://localhost:3100/ http://localhost:3100/science http://localhost:3100/shop` -
   the speed budget (Addendum 05, 7a). Add `W=1440` for desktop. Any **OVER** blocks the release.

## What the port changes

Production is the default. `NEXT_PUBLIC_PROTOTYPE_DEMO=1` brings back the prototype demo (visitor switcher, any-6-digit SMS code, fake payment).

- Real paths (`/shop`, `/science`); old `#/` links still work.
- Checkout adds email, first and last name, and ZIP (Maya needs them). Maya is the only payment option. There is no SMS code yet.
- Pay calls `POST /api/shop/order` (the server prices everything), then `/api/maya/checkout`. Maya returns to `/shop?order=CODE&p=…`, which shows the Done or retry screen.
- 5-Night Watch: `GET /api/shop/first-buyer` and `shop_watch_eligible()`. The rule is checked again when the order is made and before Maya.
- Copy promises only what is built: no "we emailed you a link" or "we texted them" until those messages exist (Addendum 05, back-end tasks 2 and 8).
- Speed: the Shop and the shop API load only when needed; styles are a cached stylesheet; the first screen shows at once.
