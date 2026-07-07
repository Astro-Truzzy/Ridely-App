# Fix Black Map (No Tiles, Only Google Logo) on Android

When the map shows but is **pitch black with only the Google logo**, map tiles are being **rejected** by Google. Do these in order.

---

## 1. Confirm the API key is in the build

Run a **clean** build so Gradle prints the key status:

```powershell
cd "E:\DESKTOP\New Ridely\Ridely-App"
npx expo run:android --no-bundler
```

In the Gradle output, look for one of:

- **`Google Maps API key: loaded (XX chars)`** → key is in the app; the problem is in Google Cloud (steps 2–4).
- **`WARNING: Google Maps API key is empty...`** → key not read. Fix:
  - In project root (Ridely-App), create or edit `.env`.
  - Add: `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY=your_actual_key_here`
  - No quotes needed. Rebuild.

---

## 2. Enable Maps SDK for Android (project)

- Open [Google Cloud Console](https://console.cloud.google.com/) and select your project.
- Go to **APIs & Services** → **Library** (not Credentials).
- Search **Maps SDK for Android** → open it → click **Enable**.

---

## 3. Enable billing

- In Cloud Console: **Billing** → link a **billing account** to this project.
- Maps needs billing enabled even for free quota; without it, tiles often return as black.

---

## 4. Fix API key restrictions (if you use “Android apps”)

Your app runs as package **`com.deliveryapp.ridely`** and uses the **debug** keystore when you run `npx expo run:android`.

- Go to **APIs & Services** → **Credentials** → open your API key.
- Under **Application restrictions**:
  - Choose **Android apps**.
  - Add an entry:
    - **Package name:** `com.deliveryapp.ridely`
    - **SHA-1 certificate fingerprint:** your **debug** SHA-1 (see below).

Get the debug SHA-1 (run in PowerShell from project root):

```powershell
cd "E:\DESKTOP\New Ridely\Ridely-App\android"
.\gradlew signingReport
```

In the report, find **Variant: debug** and copy the **SHA-1** value (e.g. `AB:CD:EF:12:...`) into the key’s Android restriction.

- Under **API restrictions**: either **Don’t restrict key** or **Restrict key** and include **Maps SDK for Android**.

Save the key. Wait 1–2 minutes, then run the app again.

---

## 5. Rebuild and test

```powershell
cd "E:\DESKTOP\New Ridely\Ridely-App"
npx expo run:android
```

If the key is loaded (step 1) and 2–4 are done, the map should show tiles. If it’s still black, double-check the key (no extra spaces, same key as in Console) and that the SHA-1 you added is the **debug** one from `signingReport`.
