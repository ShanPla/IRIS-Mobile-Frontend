# Google Authentication Setup

This app uses native Google Sign-In via `@react-native-google-signin/google-signin`.

It is designed for:

- Expo development builds / `expo run:android`
- Expo development clients built with `expo-dev-client`
- EAS-built APKs / AABs
- native Android and iOS builds

It is not designed for Expo Go.

## Project values

- Android package: `com.iris.mobile`
- iOS bundle identifier: `com.iris.mobile`
- Expo scheme: `irismobile`

## Current client IDs

These should match the OAuth clients in Google Cloud Console:

- Android client ID: `261281750852-sq61ib1u2740haoh8coaocd0940mndim.apps.googleusercontent.com`
- iOS client ID: `261281750852-j4bprb92a2o24dn6rqgt3r24rmk16bad.apps.googleusercontent.com`
- Web client ID: `261281750852-q1id3s6l28dnno9k0rfmc1f1soh44ecd.apps.googleusercontent.com`

## Required Google Cloud Console setup

In the same Google Cloud project:

1. Configure the OAuth consent screen.
2. Add your testing Gmail accounts if the app is still in Testing mode.
3. Create or verify these OAuth client IDs:
   - Web application client
   - Android client for local debug signing
   - Android client for EAS signing
   - iOS client

## Android SHA-1 fingerprints

Google Sign-In on Android depends on the signing certificate fingerprint.
Create a separate Android OAuth client for each signing certificate.

### Local debug build

- Package name: `com.iris.mobile`
- SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

Source:

```bash
keytool -list -v -alias androiddebugkey -keystore android/app/debug.keystore -storepass android -keypass android
```

### Current EAS Android APK signing certificate

- Package name: `com.iris.mobile`
- SHA-1: `5B:B8:58:18:48:99:55:01:0F:FE:33:25:6C:D5:0D:92:AF:42:D4:D4`

Source:

```bash
apksigner verify --print-certs <eas-apk>
```

This SHA-1 was extracted from the current EAS preview APK artifact.

### Future Play Store release

If you ship through Google Play with Play App Signing, also add the Play app signing certificate SHA-1 from:

- Google Play Console
- Release
- Setup
- App Integrity

That Play signing key is different from the upload key / local debug key.

## App behavior notes

- Google Sign-In is blocked inside Expo Go on purpose.
- Google Sign-In is allowed in Expo development builds and EAS/native builds.
- The login screen now expects a native build and shows a clear message if the wrong runtime is used.
- The app uses the Web client ID when configuring the native Google SDK.
- The backend receives an ID token from Google Sign-In, then verifies it.

## Verification checklist

Before calling Google auth done, verify all of these:

1. Local Android dev build signs in successfully.
2. EAS preview APK signs in successfully.
3. If iOS is used, iOS native build signs in successfully.
4. OAuth consent screen has the right test users.
5. Each Android signing fingerprint has its own Android OAuth client.
6. The Web client ID in `.env` matches the Google Cloud Web OAuth client.

## Useful references

- React Native Google Sign-In Expo setup:
  https://react-native-google-signin.github.io/docs/setting-up/expo
- React Native Google Sign-In troubleshooting:
  https://react-native-google-signin.github.io/docs/troubleshooting
- Google Android client authentication:
  https://developers.google.com/android/guides/client-auth
