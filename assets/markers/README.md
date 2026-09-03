# Map marker images

Custom pins for pickup, dropoff, and rider on tracking maps.

- `marker-pickup.png` — green pin (package)
- `marker-dropoff.png` — red pin (destination)
- `marker-rider.png` — Ridely-blue pin with the 3D scooter illustration
- `rider-illustration.png` — source art used to build the rider pin

Used via the Marker **`image`** prop (no View children) so markers render reliably on Android and iOS.

Regenerate icons:

```bash
python scripts/generate-map-markers.py
```
