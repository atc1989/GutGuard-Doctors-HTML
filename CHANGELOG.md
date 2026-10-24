# Changelog

User-visible changes only. Rules: see "Patch notes" in `AGENTS.md`.

## Unreleased
- Admin: Affiliate stores can be transferred to a new upline from the Doctors list (the pass-up points they already earned move to the new upline), and pass-up points from stores with no upline show on the store's row and can be given to a partner.
- Partner codes: every partner now has a short number (e.g. 10001) and their QR codes link to `gutguard.ph/s/<number>` for the shop and `gutguard.ph/j/<number>` to join; admins can create a code with both QRs for a doctor before they register (Admin → Partner Codes, with a confirmation showing the account number first), the shop header shows "Become a partner" instead of Log in (in a partner's shop it also says "Shop of #<number>"; if that partner can't recruit yet, it shows Log in instead), and the registration form shows the inviting partner's code above Submit instead of their initials.
- Admin: every admin page now shares one sidebar navigation and sign-in, with a new admin home page; Orders opens on its own page again.
- Shop checkout: choose Maya, Consignment or Cash. Consignment and Cash orders show "Awaiting approval" on the order page and go to a "For approval" list in Admin → Orders, where an admin enters the payment reference number to approve them as paid (partner points and the receipt email follow).
- Admin → Wheel: downloading a doctor's QR now saves a PNG image instead of an SVG.
