# Tayar Tools — Store Screenshot Capture Plan

This plan is based on the mobile release candidate and should be executed against the final signed/release-equivalent build. Screenshots must show real app UI and must not include invented features, prices or reviewer-only data.

## Apple App Store

The current app configuration supports iPhone and iPad (`supportsTablet: true`), so prepare both device families.

### Recommended primary capture sizes

- **iPhone 6.9-inch portrait:** use an Apple-accepted 6.9-inch size such as `1320 × 2868`, `1290 × 2796`, or `1260 × 2736` pixels.
- **iPad 13-inch portrait:** use `2064 × 2752` or `2048 × 2732` pixels.
- Apple accepts **1–10 screenshots** per device set. Use PNG/JPEG without alpha/transparency.

Using the highest required device size allows App Store Connect to scale screenshots for smaller related device sizes when the UI is the same.

### Six-shot narrative

Capture the same functional sequence on iPhone and iPad where practical:

1. **Home / workspace overview**
   - Show the real Tayar Tools mobile home screen after sign-in.
   - Goal: communicate the unified mobile workspace.

2. **Tools catalog**
   - Show the real tools browsing/search surface.
   - Goal: demonstrate the breadth of practical workflows without adding a numeric tool-count claim.

3. **Representative local file workflow**
   - Use a PDF, CSV or supported image workflow that visibly processes on-device.
   - Do not show private real-world documents; use synthetic/demo content.

4. **Representative AI workflow**
   - Show a real AI writing/generation result from the submitted build.
   - Use neutral synthetic prompt content and do not expose user/account secrets.

5. **Project / creation workflow**
   - Show a representative website/code/project surface that is actually available in the submitted mobile build.
   - Avoid implying desktop-only controls exist on mobile unless visible in the build.

6. **Account, privacy and deletion controls**
   - Show Profile with Privacy Policy / Terms links or the account deletion area.
   - Goal: make account control and trust surfaces easy to verify.

### Localization rule

The current mobile UI should not be represented as Swedish- or Arabic-localized unless the submitted binary actually contains those UI localizations. Store listing text can be localized independently, but screenshots must accurately reflect the app UI. If using text overlays in localized screenshots, keep the underlying UI truthful and do not translate UI controls that are not translated in the app itself.

## Google Play

Google Play requires at least **two screenshots** across device types for a publishable store listing. Screenshots must be JPEG or 24-bit PNG without alpha, each dimension must be between 320 and 3840 pixels, and the longest dimension must not exceed twice the shortest dimension.

For a strong phone listing, use the same six-shot narrative above and keep a consistent portrait format. Add tablet screenshots only after the actual Android tablet layout has been visually checked.

## Capture safety

- Use a dedicated demo/reviewer account, never the owner/admin personal account.
- Use synthetic names, files, prompts and projects.
- Hide email addresses, invite tokens, auth recovery links and internal IDs if they appear.
- Do not show Stripe pricing or external purchase flows in mobile screenshots.
- Do not use screenshots from development menus, debug builds with dev overlays, or error states.
- Keep status bars/device chrome consistent across a device set.
- Do not add fake ratings, awards, customer counts, unsupported AI claims or unavailable features.

## Final asset checklist

- [ ] iPhone 6.9-inch set captured from release-equivalent build.
- [ ] iPad 13-inch set captured because tablet support is enabled.
- [ ] Google Play phone set captured.
- [ ] No personal/reviewer credentials visible.
- [ ] Every depicted feature exists in the submitted binary.
- [ ] Any localized overlays accurately describe the English UI shown, unless real UI localization has been added.
- [ ] Screenshots match final version `0.2.0` feature behavior or are recaptured after material UI changes.
