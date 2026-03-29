# Android (Capacitor) Runbook

This project now supports Android packaging via Capacitor in hosted-WebView mode.

## 1) One-time prerequisites (macOS)

```bash
brew install openjdk@21 android-platform-tools
brew install --cask android-commandlinetools
```

Set env vars in your shell before Android builds:

```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
export ANDROID_SDK_ROOT="/opt/homebrew/share/android-commandlinetools"
export PATH="$JAVA_HOME/bin:$PATH"
```

If Android SDK packages are missing:

```bash
yes | sdkmanager --sdk_root="$ANDROID_SDK_ROOT" --licenses
sdkmanager --sdk_root="$ANDROID_SDK_ROOT" "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

## 2) Capacitor config

`capacitor.config.ts` is set to hosted mode with:

- `server.url`: `https://www.fmllabs.ai` (override with `CAPACITOR_SERVER_URL`)
- `cleartext: false`
- Navigation allowlist for `fmllabs.ai` and Clerk domains

## 3) Build artifacts

From repo root:

```bash
npm run mobile:sync
npm run mobile:apk:debug
npm run mobile:apk:release
npm run mobile:aab:release
```

Outputs:

- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release APK: `android/app/build/outputs/apk/release/app-release.apk`
- Release AAB: `android/app/build/outputs/bundle/release/app-release.aab`

## 4) Release signing

`android/app/build.gradle` now uses `android/keystore.properties` when present.

Use the template:

```bash
cp android/keystore.properties.example android/keystore.properties
```

Expected fields:

- `storeFile` (relative to `android/app`, default template points to `../keystore/...`)
- `storePassword`
- `keyAlias`
- `keyPassword`

Keystore and property files are gitignored.

## 5) Install on your Android phone

1. Enable Developer Options + USB Debugging on your phone.
2. Connect phone by USB and trust this computer.
3. Verify device:

```bash
adb devices
```

4. Install debug APK (fastest test path):

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

5. Or install signed release APK:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## 6) Smoke test checklist (phone)

- Sign in at `/sign-in` and verify session persists after app restart.
- Open core chat flow (`/chat/new`) and confirm API-backed actions work.
- Test microphone input flows.
- Test geolocation-dependent UI.
- Validate behavior on poor network / offline transitions.

## 7) Notes and limitations

- This phase uses hosted WebView mode (Next.js server APIs remain remote).
- `webkitSpeechRecognition` support can vary by Android WebView; keep fallback UX.
- If auth behavior differs on phone, re-check Clerk production domain + redirect setup.

## 8) Clerk auth return-to-app configuration

To send users back from external browser auth into the Android app, set Clerk redirect URLs to the custom scheme callback:

- `ai.fmllabs.app://auth-callback?redirect=/chat/new`

In Clerk dashboard, ensure this callback is included in allowed redirect URLs for sign-in/sign-up flows.
