# Tayar Tools — App Privacy / Data Safety Worksheet

This is a release worksheet, not a substitute for the final Apple App Privacy or Google Play Data Safety declarations. Final answers must reflect the production backend, enabled providers and store build at submission time.

## Source-confirmed client flows

| Data / content | Client behavior confirmed in source | Purpose / review note |
| --- | --- | --- |
| Email address | Used for sign-in, sign-up and password recovery through Supabase Auth. | Account management / authentication. |
| Full name | Optional name can be supplied at sign-up and stored as account metadata. | Account profile / app functionality. |
| Authentication session | Supabase session is maintained by the mobile client using secure storage integration. | Authentication / app functionality. |
| AI prompt and user-provided AI text | Sent to the authenticated Tayar `ai-engine` backend when the user runs an AI workflow. | App functionality / AI generation. |
| Delimited-file contents | Parsed locally for analytics. | Local app functionality. |
| AI analytics sample | When AI analytics is used, the client sends a compact statistics payload plus a distributed sample of up to 12 rows; the full source file is not sent by this analytics path. | AI analysis / app functionality. |
| User-selected photos/images | Photo-library access occurs only when the user chooses an image. Supported image workflows may process locally. | User-requested image functionality. |
| Account deletion confirmation | The explicit deletion request is sent to the server-side `delete-account` function. | Account management / legal compliance. |

## Not present in the current mobile dependency/config surface

The current mobile package/config does not include a dedicated advertising SDK and does not request camera or microphone permission. The release gate also blocks Android `SYSTEM_ALERT_WINDOW` and `READ_PHONE_STATE`.

This does **not** by itself prove that a data category is absent from the final store declaration: backend logs, AI providers, authentication infrastructure, crash/hosting infrastructure and other production services must also be considered.

## Apple App Privacy — items to confirm in production

Before answering App Store Connect, verify for every collected category:

- Whether data is collected off-device at all.
- Whether it is linked to the user's identity/account.
- Whether it is used for App Functionality, Analytics, Product Personalization, Developer Advertising, Third-Party Advertising or another Apple purpose.
- Whether any third-party AI/provider processing receives user content from `ai-engine`.
- Whether authentication/server logs collect identifiers such as IP address or device/network information and whether those fall within Apple's disclosure definitions.
- Whether support tickets, team-workspace data, project content or uploaded assets are available in the submitted mobile feature set and stored server-side.
- Whether any crash reporting or telemetry service is enabled in the production build/environment even if no dedicated SDK is visible in `apps/mobile/package.json`.

## Google Play Data Safety — items to confirm in production

Before completing the Play Console form, verify:

- Data types collected: account information, user-generated content, files/images, app activity and identifiers as applicable to production.
- Which collected data is shared with service providers/processors and how Google expects that processing to be classified.
- Whether data is encrypted in transit for each production endpoint.
- Whether users can request deletion (Tayar provides in-app permanent account deletion and a public deletion path).
- Whether collection is required or optional for each data type.
- Whether data is processed ephemerally for any workflow and qualifies for Google's ephemeral-processing treatment.
- Whether the store build contains any SDK or provider not represented by this source-level worksheet.

## Commercial / payment data

The current mobile client does not initiate Stripe checkout or the Stripe billing portal. Do not declare mobile payment-card collection based solely on Tayar's separate web billing system. Conversely, confirm whether subscription status or entitlement information returned to the mobile app counts as a relevant store data category before answering.

## Submission rule

Do not mark the privacy questionnaires complete solely from this file. A release owner must compare this worksheet against:

1. the final signed binary,
2. Supabase/Edge Function production behavior,
3. enabled AI providers,
4. production logging/monitoring,
5. Apple/Google definitions current on the submission date.
