# Map marker images

Custom pins for pickup, dropoff, and rider on tracking maps.

- `marker-pickup.png` — green pin (package)
- `marker-dropoff.png` — red pin (destination)
- `marker-rider.png` — primary circular badge (bike)

Used via the Marker **`image`** prop (no View children) so markers render reliably on Android and iOS.

Regenerate icons:

```bash
python scripts/generate-map-markers.py
```
