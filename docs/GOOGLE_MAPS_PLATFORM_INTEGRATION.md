# Google Maps Platform – Ridely Integration Guide

Step-by-step guide to use Google Maps services in the Ridely app for **distance calculation**, **live tracking**, **place/address suggestions**, and **map display**.

---

## 1. Services You Will Use

| Service | Purpose in Ridely |
|--------|--------------------|
| **Maps SDK for Android** | Show map (booking, tracking, rider active delivery) on Android |
| **Maps SDK for iOS** | Show map on iOS |
| **Maps JavaScript API** | Show map on Web (if you use Expo web) |
| **Places API** (new) | Address autocomplete for pickup/dropoff in booking |
| **Geocoding API** | Convert address ↔ lat/lng when needed |
| **Directions API** | Route between two points; distance + duration + polyline for tracking |
| **Distance Matrix API** | Optional: multiple origins/destinations (e.g. pricing for many pairs) |
| **Roads API** (optional) | Snap GPS points to roads for smoother rider trail |

---

## 2. Google Cloud Setup

### 2.1 Create or select a project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. **Select a project** or click **New Project**.
3. Name it (e.g. `Ridely`) and set billing if prompted.

### 2.2 Enable billing

- Google Maps Platform requires a billing account (you get free monthly credit).
- **Billing** → Link or create a billing account.
- Optional: set budget alerts under **Billing** → **Budgets & alerts**.

### 2.3 Enable the required APIs

In **APIs & Services** → **Library**, search and **Enable** each:

| API | Search term |
|-----|-------------|
| Maps SDK for Android | “Maps SDK for Android” |
| Maps SDK for iOS | “Maps SDK for iOS” |
| Maps JavaScript API | “Maps JavaScript API” (for web) |
| Places API (new) | “Places API” (prefer the **new** Places API) |
| Geocoding API | “Geocoding API” |
| Directions API | “Directions API” |
| Distance Matrix API | “Distance Matrix API” (optional) |
| Roads API | “Roads API” (optional, for snap-to-road) |

### 2.4 Create API keys

1. **APIs & Services** → **Credentials**.
2. **+ Create credentials** → **API key**.
3. You can use **one key** for all platforms or separate keys per platform (recommended for restriction).

**Recommended: create separate keys**

- **Android key** – for Maps SDK for Android (and optionally Directions/Places if called from app).
- **iOS key** – for Maps SDK for iOS.
- **Web/Server key** – for Maps JavaScript, Directions, Places, Geocoding (e.g. from your app or a backend).

Copy each key; you will store them in env and `app.json` (see below).

---

### 2.5 Using one API key for all

If you use **a single API key** for Android, iOS, web, Directions, Places, and Geocoding:

1. **Restrictions (optional but recommended):**
   - **API restrictions** → “Restrict key” → enable: **Maps SDK for Android**, **Maps SDK for iOS**, **Maps JavaScript API**, **Places API**, **Geocoding API**, **Directions API** (and **Distance Matrix API** if you use it).
   - **Application restrictions** → “None” (or add Android + iOS app restrictions if you want; with one key you can’t restrict by both app and HTTP referrer at once, so many devs leave application restriction “None” and rely on API restrictions).

2. **One env var:** use a single variable, e.g. `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, for:
   - Native map tiles (Android/iOS) via `app.config.js`
   - Any REST calls from the app (Directions, Places, Geocoding).

3. **What to do next:** follow **section 4** below and use the **“One API key”** config: same key in `app.config.js` for both `android.config.googleMaps.apiKey` and `ios.config.googleMapsApiKey`, and the same key in your code for all Google API requests.

---

## 3. Restrict API keys (security)

For each key, click **Edit** (pencil) and set:

### 3.1 Android key

- **Application restrictions** → **Android apps**.
- Add your package name, e.g. `com.yourapp.ridely` (must match `expo.android.package` in `app.json`).
- Add SHA-1 fingerprint(s): from your keystore or, for debug, from:
  ```bash
  cd android && ./gradlew signingReport
  ```
- **API restrictions** → Restrict to: **Maps SDK for Android**, and if you call Directions/Places from the app: **Directions API**, **Places API**, **Geocoding API**.

### 3.2 iOS key

- **Application restrictions** → **iOS apps**.
- Add your bundle ID, e.g. `com.yourapp.ridely` (must match `expo.ios.bundleIdentifier` in `app.json`).
- **API restrictions** → Same as Android if you call Directions/Places from the app.

### 3.3 Key used for Directions / Places from the app (REST calls from device)

Ridely calls **Places API** (address autocomplete) and **Directions API** from the **mobile app** (client). Those requests come from the user’s device: they have **no HTTP referer** and the **IP is the user’s IP**, which changes.

- **Application restrictions** for this key must be **None**.  
  If you set “HTTP referrers” or “IP addresses”, Google will block the request with:  
  *“This IP, site or mobile application is not authorized to use this API key. Request received from IP address …, with empty referer”.*
- **API restrictions** → Restrict key to: **Places API**, **Directions API**, **Geocoding API** (and **Distance Matrix API** if used).
- You can use the **same key** as for Maps SDK (Android/iOS) and set Application restrictions to **None**, and rely on **API restrictions** only. Alternatively use separate keys per platform (Android app key, iOS app key) and add Directions + Places to each key’s API restrictions.

---

## 4. Expo / React Native configuration

Your app already uses **react-native-maps**. To use **Google Maps** as the provider:

### 4.1 Install config plugin (Expo)

```bash
npx expo install react-native-maps
```

If you use a prebuild / custom dev client, you need the Expo config plugin for Google Maps:

```bash
npm install react-native-maps
# Or with Expo:
npx expo install react-native-maps
```

### 4.2 Configure `app.json` / `app.config.js`

Add the Google Maps API keys and provider so native builds use Google Maps.

**One API key (same key for Android, iOS, and REST calls):**

Use `app.config.js` so the key comes from env and you don’t commit it. In the project root, create or replace with `app.config.js` (if you use it, Expo will prefer it over `app.json`):

```js
// app.config.js – one key for all (Android, iOS, Directions, Places, Geocoding)
const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export default {
  expo: {
    name: 'ridely',
    slug: 'ridely',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'myapp',
    userInterfaceStyle: 'automatic',
    plugins: [
      'expo-router',
      'expo-font',
      'expo-web-browser',
      [
        'react-native-maps',
        { useGoogleMaps: true },
      ],
    ],
    experiments: { typedRoutes: true },
    android: {
      package: 'com.anonymous.ridely',
      config: {
        googleMaps: { apiKey: key },
      },
    },
    ios: {
      supportsTablet: true,
      config: {
        googleMapsApiKey: key,
      },
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/images/favicon.png',
    },
    extra: { router: {}, eas: { projectId: 'f6270d95-21c0-4912-9e17-db7b676f0a7a' } },
  },
};
```

In `.env` add:

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_single_google_maps_api_key_here
```

Then use `process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (or a small helper) everywhere you call Directions, Places, or Geocoding.

**Using `app.json` (multiple keys):**

```json
{
  "expo": {
    "name": "Ridely",
    "plugins": [
      [
        "react-native-maps",
        {
          "useGoogleMaps": true
        }
      ]
    ],
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_ANDROID_GOOGLE_MAPS_API_KEY"
        }
      },
      "package": "com.yourapp.ridely"
    },
    "ios": {
      "config": {
        "googleMapsApiKey": "YOUR_IOS_GOOGLE_MAPS_API_KEY"
      },
      "bundleIdentifier": "com.yourapp.ridely"
    }
  }
}
```

**Using `app.config.js` (recommended so you can use env vars):**

```js
export default {
  expo: {
    name: 'Ridely',
    plugins: [
      [
        'react-native-maps',
        { useGoogleMaps: true },
      ],
    ],
    android: {
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY || '',
        },
      },
      package: 'com.yourapp.ridely',
    },
    ios: {
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY || '',
      },
      bundleIdentifier: 'com.yourapp.ridely',
    },
  },
};
```

### 4.3 Environment variables

In `.env` (and `.env.example`), add:

```env
# Google Maps Platform (for maps, directions, places)
EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY=your_android_key_here
EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY=your_ios_key_here
# Use this key for Directions, Places, Geocoding from the app (or from a backend)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_web_or_server_key_here
```

Use the **same** web/server key for Directions, Places, and Geocoding from the client if you are not using a backend. Restrict that key as in section 3.3.

### 4.4 Use Google Maps in `MapView`

On **Android**, `react-native-maps` uses Google Maps by default when the API key is set in config. On **iOS**, you must pass the provider:

```tsx
import MapView, { Marker, Polyline } from 'react-native-maps';

<MapView
  provider={Platform.OS === 'ios' ? 'google' : undefined}
  style={StyleSheet.absoluteFillObject}
  initialRegion={{ latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
  showsUserLocation
>
  <Marker coordinate={{ latitude, longitude }} title="Rider" />
</MapView>
```

After changing `app.json` / `app.config.js`, run a **new native build** (e.g. `npx expo prebuild --clean` and then run on device/simulator).

---

## 5. Feature-by-feature integration

### 5.1 Place/address suggestions (Places API)

**Current Ridely usage:** `hooks/useAddressAutocomplete.ts` and `app/booking/address.tsx` (pickup/dropoff).

**Google option: Places API (New) – Autocomplete**

- Endpoint: `https://places.googleapis.com/v1/places:autocomplete` (POST) or use the **Place Autocomplete** (get place predictions, then get place details for lat/lng).
- Or use **Places API (New) – Autocomplete (Address)** for address-only predictions.

**Minimal flow:**

1. **Autocomplete** – get `place_id` and suggestion text.
2. **Place Details** (or **Place Details (New)**) – get `location.latitude`, `location.longitude` and formatted address.

**Example (REST):**

```http
POST https://places.googleapis.com/v1/places:autocomplete
Content-Type: application/json
X-Goog-Api-Key: YOUR_API_KEY

{
  "input": "Lagos Victoria Island",
  "locationBias": {
    "circle": {
      "center": { "latitude": 6.4281, "longitude": 3.4219 },
      "radius": 50000
    }
  }
}
```

Then call Place Details with the returned `placeId` to get coordinates and address. You can keep your existing `AddressSuggestion` interface and map Google’s response into it in `useAddressAutocomplete.ts` (replace the Mapbox URL with Google Places calls).

**Country restriction:** Use `includedRegionCodes: ["ng"]` (or your target countries) in the autocomplete request body to bias results.

---

### 5.2 Distance and duration (Directions API)

**Current Ridely usage:** `app/booking/pricing.tsx` (road distance for pricing), `app/tracking.tsx` (route polyline).

**Google: Directions API**

- Endpoint: `https://maps.googleapis.com/maps/api/directions/json`
- Params: `origin`, `destination`, `key`, optional `mode=driving`, `alternatives=false`.

**Example:**

```
GET https://maps.googleapis.com/maps/api/directions/json?origin=6.5244,3.3792&destination=6.4541,3.3947&key=YOUR_API_KEY
```

Response includes:

- `routes[0].legs[0].distance.value` (meters) and `text`
- `routes[0].legs[0].duration.value` (seconds) and `text`
- `routes[0].overview_polyline.points` (encoded polyline for the map)

Use this in:

- **Pricing:** replace the Mapbox Directions call in `booking/pricing.tsx` with a `fetch` to the Google Directions URL; compute distance km and duration, then your existing pricing logic stays the same.
- **Tracking:** replace the Mapbox route fetch in `tracking.tsx` with Google Directions; decode the polyline (e.g. `decodePolyline()` from a small util or `@googlemaps/js-api-loader` is for web – for React Native use a simple decoder or a small lib) and pass the coordinates to `<Polyline coordinates={...} />`.

**Optional: Distance Matrix API**

- Use when you need distance/duration for **many** origin–destination pairs in one request (e.g. batch pricing or matching riders to jobs).
- Endpoint: `https://maps.googleapis.com/maps/api/distancematrix/json`.

---

### 5.3 Live tracking (map + location updates)

**Current Ridely usage:** Supabase Realtime for `rider_locations`; map on `tracking.tsx` and rider `active-delivery.tsx`.

**What Google provides here:**

- **Map:** Already covered – use Google Maps via `react-native-maps` and the config above.
- **Location stream:** Keep using **expo-location** and **Supabase** to store and broadcast rider position; no change needed for “live” updates.
- **Optional – Roads API:** If you want to snap the rider’s raw GPS to the road for a smoother trail, call **Roads API – Snap to Roads** with the last N points and use the snapped coordinates for the polyline. This is optional and can be added later.

So for “live tracking”: ensure Google Maps is the map provider, keep your existing realtime subscription and rider location updates; optionally add Roads API later.

---

### 5.4 Geocoding (address ↔ coordinates)

**When to use:** Converting a selected place or typed address to lat/lng, or reverse (lat/lng → address).

- **Geocoding API:** `https://maps.googleapis.com/maps/api/geocode/json?address=...&key=...`
- **Reverse:** `latlng=6.5244,3.3792`

Use this if you need a fallback when Places doesn’t return coordinates, or for “current location” → address display.

---

## 6. Where to change code in Ridely

| Current (Mapbox) | Replace with (Google) |
|------------------|------------------------|
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (for Directions, Places, Geocoding) |
| `hooks/useAddressAutocomplete.ts` – Mapbox Geocoding URL | Google Places Autocomplete + Place Details (or Geocoding as fallback) |
| `app/booking/pricing.tsx` – Mapbox Directions URL | Google Directions API URL |
| `app/tracking.tsx` – Mapbox Directions for route polyline | Google Directions API; decode `overview_polyline.points` and pass to `<Polyline>` |
| Map display (`MapView`) | Set Google as provider (section 4) and ensure API keys in `app.json` / `app.config.js` |
| Rider `active-delivery.tsx` map | Same: use Google Maps via config; no URL changes if you only show a map there |

Keep your existing interfaces (e.g. `AddressSuggestion`, pricing result shape) and swap the underlying API calls and response mapping.

---

## 7. What to do next (single API key)

1. **Put your key in `.env`:**
   ```env
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...your_actual_key
   ```

2. **Config is already set:** The project has `app.config.js` that reads `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` and passes it to Android and iOS for the map. Expo uses `app.config.js` when present (it overrides `app.json`).

3. **Rebuild native apps** so the key is baked in:
   ```bash
   npx expo prebuild --clean
   npx expo run:android
   # or
   npx expo run:ios
   ```
   (Expo Go cannot load custom native config; use a dev build or local run.)

4. **Use the same key in code** for Directions, Places, and Geocoding:
   - `process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `useAddressAutocomplete`, `booking/pricing.tsx`, and `tracking.tsx` when you replace Mapbox with Google (see section 6).

5. **Optional:** Restrict the key in Google Cloud (section 3): under **API restrictions** enable only the APIs you use (Maps SDK for Android/iOS, Places, Geocoding, Directions).

---

## 8. Checklist

- [ ] Google Cloud project created; billing enabled
- [ ] APIs enabled: Maps SDK (Android, iOS, JavaScript), Places API, Geocoding, Directions (and optionally Distance Matrix, Roads)
- [ ] API keys created (Android, iOS, Web/Server)
- [ ] Keys restricted (app restrictions + API restrictions)
- [ ] `app.json` / `app.config.js` updated with Google Maps keys and `react-native-maps` plugin
- [ ] `.env` and `.env.example` updated with Google keys
- [ ] `useAddressAutocomplete` updated to use Places API (and optionally Geocoding)
- [ ] `booking/pricing.tsx` updated to use Directions API for distance/duration
- [ ] `tracking.tsx` updated to use Directions API for route polyline and Google Maps as provider
- [ ] Rider and customer map screens use Google Maps (provider + keys)
- [ ] New native build run (`npx expo prebuild --clean` then run app)
- [ ] Test: address search, pricing distance, tracking map and live rider position

---

## 9. Troubleshooting

### “This IP, site or mobile application is not authorized to use this API key. Request received from IP address …, with empty referer”

This means the API key has **Application restrictions** that block requests from your app.

- **Cause:** The key is restricted to “HTTP referrers” or “IP addresses”. Requests from the Expo/React Native app come from the device with **no referer** and the **user’s IP**, so they are rejected.
- **Fix:** In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → click your API key → under **Application restrictions** choose **None** (or use separate Android/iOS keys restricted by app, and add Places + Directions to those keys). Keep **API restrictions** so only the APIs you need (e.g. Places API, Directions API) are enabled.

After changing the key, wait a minute and try address autocomplete again.

---

## 10. References

- [Google Maps Platform – Get Started](https://developers.google.com/maps/documentation/android-sdk/start)
- [Maps SDK for Android](https://developers.google.com/maps/documentation/android-sdk/overview)
- [Maps SDK for iOS](https://developers.google.com/maps/documentation/ios-sdk/overview)
- [Places API (New)](https://developers.google.com/maps/documentation/places/web-service/overview)
- [Directions API](https://developers.google.com/maps/documentation/directions/overview)
- [Distance Matrix API](https://developers.google.com/maps/documentation/distance-matrix/overview)
- [Geocoding API](https://developers.google.com/maps/documentation/geocoding/overview)
- [Roads API – Snap to Roads](https://developers.google.com/maps/documentation/roads/snap) (optional)
- [Expo – react-native-maps](https://docs.expo.dev/versions/latest/sdk/map-view/)
- [react-native-maps – Google Maps](https://github.com/react-native-maps/react-native-maps/blob/master/docs/googlemaps.md)
