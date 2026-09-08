# Tayar Tools — Store Review Notes

Release candidate bundle/package: `se.tayar.tools`

These notes are intended for App Store Connect / Google Play review preparation. Do not commit reviewer passwords, one-time codes, Apple credentials, Google credentials, service-account keys or Expo tokens to this repository.

## Reviewer walkthrough

1. Launch **Tayar Tools**.
2. Privacy Policy and Terms of Service are available from the sign-in screen before authentication.
3. Sign in with the dedicated reviewer account configured in the store console. The app uses the same Tayar identity across supported web, Android and iOS experiences.
4. Open the Home/Tools areas to review available productivity workflows.
5. Open **Profile** to see account information and mobile access.
6. In **Profile**, Privacy Policy and Terms remain directly accessible.
7. In **Profile → Delete account**, choose **Delete account permanently** to initiate permanent account deletion. The action requires a destructive confirmation before it is sent to the server.
8. The public deletion instructions are also available at `https://tayar.se/account-deletion`.
9. Official support information is available at `https://tayar.se/support.html`.

## Commercial-model reviewer note

### iOS release

The first iOS release is intentionally configured as a **free stand-alone companion**. The submitted iOS app does not initiate Stripe checkout, open the Stripe billing portal, display an external upgrade link, direct users to web pricing or unlock additional iOS functionality based on a Pro/Business entitlement purchased outside the app.

For the submitted iOS build:

- Pro- and Business-only tools are not listed in the iOS tools catalog and their direct routes are guarded.
- Existing web/Android Pro or Business plan state is normalized to the same included iOS access as every other signed-in account.
- Server-backed AI tools included in the iOS companion use the same fixed free mobile allowance for every signed-in iOS account.
- Included local/on-device companion tools do not receive a higher quota from a web/Android subscription.
- There is no purchase button, upgrade call-to-action or external pricing link in the iOS app.

This is a release-contract decision for the submitted iOS build, not a claim that Apple has pre-approved an exception. If paid iOS functionality is added later, App Store in-app purchase requirements must be reassessed before that build is submitted.

### Android release

Android may continue to use the Tayar account's normal server-side plan and quota state. Google Play release material must still avoid unsupported pricing or purchase claims and must accurately match the submitted Android build.

## Account deletion

- Account creation is available in the mobile app.
- Permanent account deletion is available in the mobile app.
- The deletion flow invokes the server-side `delete-account` function and requires the explicit `DELETE` confirmation payload.
- The user is signed out locally after successful deletion.
- The public deletion page documents mobile and web deletion paths.

## Permissions

Current app configuration does not request camera or microphone access. Photo-library access is requested only when the user explicitly chooses an image to process. High-risk Android `SYSTEM_ALERT_WINDOW` and `READ_PHONE_STATE` permissions are blocked in app configuration.

## Local processing and AI processing

Tayar uses a mixed processing model and review answers should preserve that distinction:

- Supported PDF, CSV and image workflows can process selected content locally on the device.
- The local analytics parser reads the selected delimited file on-device where that workflow is available in the submitted platform build.
- For AI-assisted analytics on platforms where that tool is included, the full analytics file is not uploaded; the client creates a compact statistical summary and a distributed sample of up to 12 rows, then that compact payload can be sent to Tayar AI.
- AI writing/generation requests send the user's AI prompt/content to the authenticated `ai-engine` backend for generation.
- Account authentication and account profile identity use the Tayar Supabase backend.

## Reviewer account fields — fill only in store consoles

- Reviewer email: **NOT COMMITTED — configure in App Store Connect / Play Console**
- Reviewer password: **NOT COMMITTED — configure in App Store Connect / Play Console**
- Any OTP/2FA instructions: **NOT COMMITTED — configure in review notes if required**

Use a stable dedicated reviewer account. The iOS reviewer account does not need Pro or Business access because paid web/Android entitlements do not unlock extra functionality in the submitted iOS build. Do not use the owner's personal/admin account for store review.

## Final manual checks before submission

- Verify `https://tayar.se/support.html` is live on the production domain after the web changes are merged/deployed.
- Verify `https://tayar.se/account-deletion` is live without authentication.
- Verify Privacy Policy and Terms are live and contain the final operator/legal contact information.
- Complete Google Play Data Safety using the production data flows, not only client-side permissions.
- Complete Apple App Privacy using the production data flows and relevant third-party/backend processing.
- Configure reviewer credentials in the store consoles, never in source control.
- Verify the iOS reviewer account sees only the included iOS companion catalog and no external-plan unlocks.
- Verify screenshots and marketing claims match the submitted platform build.
