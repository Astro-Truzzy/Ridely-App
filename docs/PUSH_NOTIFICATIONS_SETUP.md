# Real push notifications (OS-delivered)

This app is set up to send and receive **real** push notifications delivered and displayed by the OS (FCM on Android, APNs on iOS). To get them working on physical devices you must use an **EAS Build** (not Expo Go) and configure credentials.

## Requirements

- **Physical device** – Push does not work on Android emulator or iOS simulator.
- **EAS Build** – Run `eas build` for Android and/or iOS. Expo Go does not support your project’s native push config.
- **Firebase (Android)** – FCM v1 credentials and `google-services.json`.
- **Apple Developer (iOS)** – APNs key and, if needed, push entitlement.

## 1. Android (FCM)

### 1.1 Firebase project and `google-services.json`

1. Open [Firebase Console](https://console.firebase.google.com/) and create or select a project.
2. Add an **Android app** with package name: `com.anonymous.ridely` (must match `app.json` → `expo.android.package`).
3. Download **google-services.json** and place it in the project root:
   ```
   Ridely-App/
     google-services.json   <-- here
     app.json
     ...
   ```
4. In `app.json`, under `expo.android`, add:
   ```json
   "googleServicesFile": "./google-services.json"
   ```
   So the `android` block looks like:
   ```json
   "android": {
     "package": "com.anonymous.ridely",
     "googleServicesFile": "./google-services.json"
   }
   ```
   If you use a different package name, update both Firebase and `app.json`.

### 1.2 FCM v1 credentials in EAS

1. In Firebase: **Project settings** → **Service accounts** → **Generate new private key** (JSON).
2. Keep this file **private** (e.g. add `*credentials*.json` or the filename to `.gitignore`). Do **not** commit it.
3. Run:
   ```bash
   npx eas credentials
   ```
4. Choose **Android** → **production** (or the profile you build with).
5. Open **Push notifications: Manage your FCM Api Key** (or similar) and choose **Set up a Google Service Account Key for Push Notifications (FCM v1)**.
6. Upload the **service account JSON** you downloaded from Firebase.

After this, EAS Build will use FCM v1 to deliver pushes to your Android app.

## 2. iOS (APNs)

1. You need an **Apple Developer Program** account and an App ID with **Push Notifications** enabled.
2. Run:
   ```bash
   npx eas credentials
   ```
3. Choose **iOS** → **production** (or the profile you use).
4. Go to **Push Notifications: Manage your Apple Push Notifications key** and follow the prompts to create/select an APNs key and attach it to your app.

Your `app.json` already has the `expo-notifications` plugin and `ios.bundleIdentifier`; EAS will use your credentials to enable push in the built app.

## 3. Build and install

```bash
# Android
npx eas build --platform android --profile production

# iOS
npx eas build --platform ios --profile production
```

Install the built binary on a **physical device**. Push notifications will not work in Expo Go or in simulators/emulators.

## 4. How it works in this project

- **Registration:** When a user logs in, the app calls `registerForPushNotificationsAsync()`, gets an Expo push token, and saves it to Supabase `push_tokens`.
- **Sending:** Backend (e.g. Supabase Edge Function `send-push`) sends messages to the **Expo Push API** (`https://exp.host/--/api/v2/push/send`) with that token. Expo forwards the message to FCM (Android) or APNs (iOS).
- **Display:** The **OS** shows the notification in the status bar / notification shade. When the app is in the background or closed, the user sees the notification and can tap it to open the app.
- **Tap handling:** The app uses `addNotificationResponseReceivedListener` and `getLastNotificationResponseAsync()` to open the right screen (e.g. delivery request modal, tracking, notifications list).

No extra code is required for “real” push once the app is built with EAS and credentials are set. The same `expo-notifications` and Supabase/Expo Push API code path is used; the OS delivers and displays the notification because the native build has FCM/APNs configured.

## 5. Build without Firebase (Android)

Until you add `google-services.json` and the `googleServicesFile` entry in `app.json`, Android builds will still succeed but **push notifications will not be delivered** on Android. Add the file and FCM credentials when you are ready for real Android push.

## 6. Troubleshooting

- **No notification when app is closed/background:** Ensure you installed an **EAS-built** app and completed FCM (Android) and/or APNs (iOS) setup. Check that the device has notification permission for the app.
- **Token is null:** Usually means not a physical device, or permission denied, or missing `projectId` in `app.json` → `extra.eas.projectId`.
- **Android: notification not shown:** Confirm the app was built with the same `google-services.json` and that the FCM v1 key is set in EAS credentials for that build profile.
