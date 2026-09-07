# Tayar Mobile

Native Android/iOS packaging workspace for the existing Tayar Vite app.

## Architecture

- Root web app remains the single product codebase.
- `npm run build` at repository root produces `dist/`.
- Capacitor packages that same build into Android and iOS native containers.
- Supabase/Auth/API behavior remains shared with the web app.
- Native-only integrations live under `mobile/` or behind feature detection in `src/lib/mobile`.

## First-time setup

```bash
cd mobile
npm install
npm run cap:add:android
npm run cap:add:ios
```

## Sync after a web build

```bash
cd ..
npm run build
cd mobile
npm run sync
```

## Open native projects

```bash
npm run open:android
npm run open:ios
```

Android requires Android Studio/JDK. iOS requires macOS + Xcode for device/App Store builds.

## App identity

- App ID: `se.tayar.tools`
- App name: `Tayar Tools`
- Web directory: `../dist`

Do not configure `server.url` for production releases: shipping the built web assets inside the native app avoids turning the store app into a thin remote-site wrapper and keeps startup resilient.
