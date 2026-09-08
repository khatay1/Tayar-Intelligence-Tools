# Tayar Mobile Store Release Checklist

This file is the release checkpoint for the React Native mobile candidate. Keep the PR in draft until the blocking items below are resolved.

## Automated gates

- [x] Root Release Gate passes: lint, project health, production web build, dependency audit, whitespace.
- [x] Mobile lint, TypeScript and Expo Doctor pass.
- [x] iOS Simulator native build passes without signing.
- [x] Android native build has previously passed on the current native app state.
- [x] Android 16 KB page-size compatibility has been verified for 64-bit native libraries and with `zipalign -P 16`.
- [x] Store-readiness smoke covers identifiers, privacy declarations, blocked permissions, account deletion, legal links and purchase-steering checks.
- [x] Android production output is configured as an AAB.
- [x] The first Android submit profile targets Google Play internal testing rather than public production.

## Store-compliance surfaces

- [x] Permanent account deletion is available from the signed-in mobile profile.
- [x] A public `/account-deletion` path exists for store listing requirements.
- [x] Privacy Policy and Terms are accessible before sign-in and from the signed-in profile.
- [x] Mobile source does not expose Stripe checkout, Stripe billing portal or external purchase steering.
- [x] Unused camera and microphone permissions remain disabled.
- [x] High-risk Android permissions remain blocked.

## External blockers before signed delivery

- [ ] Configure a repository `EXPO_TOKEN` for CI/EAS authentication.
- [ ] Link the Expo/EAS project and commit the generated `extra.eas.projectId` only after the correct Expo project is confirmed.
- [ ] Configure and verify Android signing credentials in EAS.
- [ ] Configure and verify iOS signing credentials in EAS / Apple Developer.
- [ ] Verify Google Play app access and submission credentials.
- [ ] Verify Apple Developer and App Store Connect access for `se.tayar.tools`.
- [ ] Confirm the App Store commercial model before production review; the mobile app currently behaves as a companion-access app and does not initiate Stripe purchase flows.

## Merge rule

Do not merge the mobile release candidate into `main` solely because source-level gates pass. Merge only when the final Mobile CI and Release Gate are green and the required external signing/store account setup has been verified.
