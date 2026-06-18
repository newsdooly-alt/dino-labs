# Native Push Notification Setup

This document describes the steps required to enable real push notifications
in the DinoInvest Android and iOS apps. The Capacitor plugins are already
installed and wired up — you only need to add the platform credentials.

## Android (Firebase Cloud Messaging)

1. Go to [Firebase Console](https://console.firebase.google.com/) and create
   a project (or use an existing one).
2. Add an Android app with package name `com.dinoinvest.app`.
3. Download `google-services.json` and place it at:
   ```
   android/app/google-services.json
   ```
4. In `android/build.gradle`, ensure the Google services classpath is present:
   ```groovy
   classpath 'com.google.gms:google-services:4.4.0'
   ```
5. In `android/app/build.gradle`, apply the plugin at the bottom:
   ```groovy
   apply plugin: 'com.google.gms.google-services'
   ```
6. Run `npx cap sync android` to sync plugin changes.
7. Build and run on a device — FCM tokens will now be issued and sent to
   `POST /api/notifications/register` automatically.

## iOS (Apple Push Notification service)

1. In [Apple Developer Portal](https://developer.apple.com/), enable Push
   Notifications for the `com.dinoinvest.app` App ID.
2. Create an APNs Auth Key (`.p8`) or certificate and download it.
3. Open `ios/App/App.xcodeproj` in Xcode:
   - Select the App target → Signing & Capabilities → **+ Capability** →
     add **Push Notifications**.
   - Also add **Background Modes** and check **Remote notifications**.
4. Run `npx cap sync ios` to sync plugin changes.
5. Build and run on a physical device (simulator cannot receive push).
6. APNS tokens will be issued and sent to
   `POST /api/notifications/register` with `platform: "apns"`.

## Server-side push (future)

The `/api/notifications/register` endpoint currently stores tokens in an
in-memory Map. To send server-initiated pushes (e.g. at 8 PM for streak
alerts), upgrade to:

1. Persist tokens in a `push_tokens` DB table (userId, token, platform).
2. Use the Firebase Admin SDK (`firebase-admin` npm package) with your
   service account key to send FCM messages.
3. For APNS, use the same Firebase Admin SDK (it supports both platforms)
   or the `apns2` npm library directly.

See follow-up task #19 for full implementation details.
