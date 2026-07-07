# Map marker images (Android)

On Android, custom pins use the Marker **`image`** prop (no View children, so no native crash). You can use:

1. **Remote URLs** (current default) – colored placeholder images from placehold.co.
2. **Local PNGs** (recommended for production) – bundle your own icons for bike, package, and pin.

## Use your own icons (local PNGs)

1. Add 3 PNGs in this folder (e.g. **72×72 px** or **96×96 px**):
   - `marker-rider.png` – bike/delivery icon (e.g. primary color circle)
   - `marker-pickup.png` – package icon (e.g. green)
   - `marker-dropoff.png` – map pin icon (e.g. red)

2. In `app/tracking.tsx`, replace `ANDROID_MARKER_IMAGES` with:

```ts
const ANDROID_MARKER_IMAGES = {
  rider: require('@/assets/markers/marker-rider.png'),
  pickup: require('@/assets/markers/marker-pickup.png'),
  dropoff: require('@/assets/markers/marker-dropoff.png'),
};
```

Use a solid background (e.g. circle) so pins are visible on the map. If these files are missing, the app uses the placeholder URLs.
