# Full Site Polish

This pass focuses on the public Tayar Intelligence experience while leaving Website Builder V1 feature logic untouched.

## What changed

- Rebuilt the landing hero, navigation, tools, business, facts, pricing, workflow, FAQ, CTA and footer sections.
- Removed placeholder social proof, fake usage counts, dead `#` links and debug logging.
- Added consistent English, Arabic and Swedish landing copy plus a public language switcher.
- Replaced random-rendered hero stars with deterministic visuals.
- Aligned pricing feature copy with the current Website Builder plan limits.
- Added working public routes for About, Privacy and Terms.
- Refreshed About, Privacy and Terms copy to match the current product more closely.
- Improved global spacing, focus states, responsive containers, reduced-motion behavior and mobile interaction polish.
- Updated page metadata and structured data; auth/workspace routes are marked `noindex`.
- Added `npm run smoke:site-polish`.

## Required QA before release

Run:

```bash
npm run smoke:site-polish
npm run typecheck
npm run build
```

Then manually verify:

1. Landing page at desktop, tablet and mobile widths.
2. English, Arabic RTL and Swedish language switching.
3. Start Free and Login flows.
4. About, Privacy and Terms footer routes.
5. Pricing amounts match the Stripe prices configured for Pro and Business.
6. The production domain matches `VITE_PUBLIC_SITE_URL` / canonical metadata before public launch.
