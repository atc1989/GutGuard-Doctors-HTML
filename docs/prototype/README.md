# Prototype port: website (Addendum 05)

`components/GutguardSite.jsx` is generated from the approved prototype. Do not hand-edit it for design changes; change the prototype, then port again.

1. Put the new prototype in `docs/prototype/gutguard-site.prototype.jsx`.
2. Run `python3 docs/prototype/port_site.py docs/prototype/gutguard-site.prototype.jsx components/GutguardSite.jsx`.
3. If a step fails, the prototype changed at that line. Update the matching `rep(...)` in `port_site.py`.
4. `npm run build`, `npm test`, then `npx next start -p 3100` and `node docs/prototype/test_site_port.js` (needs Playwright).

What the port changes (production default; `NEXT_PUBLIC_PROTOTYPE_DEMO=1` restores the demo):
- Real paths (`/shop`, `/science`); old `#/` links still work.
- Checkout: email, first and last name, ZIP (Maya requires them); Maya only; no fake SMS code.
- Pay: `POST /api/shop/order` (server prices everything) then `/api/maya/checkout`. Maya returns to `/shop?order=CODE&p=…`, which shows the Done or retry screen.
- 5-Night Watch: `GET /api/shop/first-buyer` and `shop_watch_eligible()`; checked again when the order is created.
- Done screen: "Finish your free Lifestyle card" (the card is finished on Lifestyle, One Account).
