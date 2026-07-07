# Fix "Address suggestions" – API key not authorized (IP / referer)

When you see:

**"This IP, site or mobile application is not authorized to use this API key. Request received from IP address ..., with empty referer"**

the **address autocomplete** on the booking screen is calling Google **Places API** from the app. The request goes from the **device** (no browser referer), so Google rejects it if the key is restricted to "HTTP referrers" (web only) or to specific apps in a way that doesn’t apply to direct HTTP calls.

---

## Why it happens

- The app uses **Places API** (autocomplete + place details) via `fetch()` from the device.
- Requests come from the **device IP** (e.g. 102.90.117.234) with **empty referer**.
- If the key has **Application restriction** = "HTTP referrers" or only "Android apps" (and Google doesn’t attribute this HTTP call to the app), the key is rejected.

---

## Fix in Google Cloud Console

Use **one** of these approaches.

### Option A: Separate key for Places/Geocoding (recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → your project → **APIs & Services** → **Credentials**.
2. **Create** a new API key (e.g. "Ridely Places / address autocomplete").
3. Enable these APIs for the project (if not already):
   - **Places API** (for autocomplete and place details)
   - **Geocoding API** (if you use it elsewhere)
4. Edit the **new** key:
   - **Application restrictions**: set to **None** (so it can be used from the app’s IP with no referer).
   - **API restrictions**: **Restrict key** and select at least **Places API** (and Geocoding API if needed).
5. In your app **.env**, set a key that’s used only for address/Places:
   - Either use this new key for **both** map and Places by setting:
     - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<this_new_key>`
     - and keep `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` for the native map if you use a different one.
   - Or, if you want one key for everything, use this new key as the only key and set **Application restrictions** = **None** (see Option B).

The hook `useAddressAutocomplete` uses, in order:  
`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` then `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`.  
So set the one you intend for Places/address (e.g. the new key with no app restriction).

### Option B: Single key with no application restriction

If you prefer **one** key for map + address:

1. **APIs & Services** → **Credentials** → open the key you use in the app.
2. **Application restrictions**: set to **None**.
3. **API restrictions**: **Restrict key** and include:
   - **Maps SDK for Android** (for the map)
   - **Places API** (for address autocomplete)
   - **Geocoding API** (if you use it)
4. Save. Wait 1–2 minutes and try address search again.

Note: With "None", the key can be used from any IP. For production, consider a backend that calls Places/Geocoding so the key stays on the server.

### Option C: Restrict by IP (if your IP is stable)

1. Open the API key in **Credentials**.
2. **Application restrictions**: choose **IP addresses**.
3. Add the IP from the error (e.g. **102.90.117.234**). Add any other IPs (e.g. office, home) if needed.
4. **API restrictions**: as in Option B.
5. Save.

This only works as long as the device or network keeps using one of the allowed IPs (mobile IPs often change).

---

## After changing the key

- If you changed the key value in **.env**, restart Metro (and the app) so the new env is picked up.
- No native rebuild needed for a key change used only in JS (Places/address); rebuild only if you changed the key used in AndroidManifest for the map.

---

## Summary

- **Error:** "IP/referer not authorized" → key is restricted in a way that blocks requests from the app.
- **Fix:** Use a key with **Application restriction = None** for Places/address (Option A or B), or add your IP (Option C).
- **APIs to enable:** Places API (and Geocoding API if used).
