# Android emulator: black screen / window disappears on Windows

If the emulator opens but shows a **black screen** (e.g. in the taskbar preview) and **disappears or does nothing when you click it**, try these in order.

**Note:** The `netsimd` messages in the terminal are the emulator’s network daemon starting. They are normal and not related to the black screen.

---

## 1. Use Software graphics (often fixes black screen)

1. Open **Android Studio** → **Tools** → **Device Manager** (or **AVD Manager**).
2. Click the **pencil (Edit)** on your virtual device.
3. Click **Show Advanced Settings**.
4. Under **Emulated Performance** → **Graphics**, change from **Hardware** or **Automatic** to **Software - GLES 2.0**.
5. Finish and **Cold Boot** the device (dropdown next to the play button → **Cold Boot Now**).

Then run your app again: `npx expo run:android`.

---

## 2. Cold boot and wipe data

Sometimes the AVD is in a bad state:

1. In **Device Manager**, open the dropdown next to your device.
2. Choose **Cold Boot Now**.
3. If it’s still black: **Wipe Data** (same dropdown), then start the emulator again.

---

## 3. Bring the window back on screen

The window might be open but off-screen or minimized:

- **Win + Left/Right Arrow** a few times to move the window to the current monitor.
- Or **Alt + Tab** to the “Android Emulator” window, then **Win + Shift + Left/Right** to move it between displays.

---

## 4. Create a new AVD

If one device always gives a black screen, create another:

1. **Device Manager** → **Create Device**.
2. Pick a **Phone** (e.g. Pixel 6).
3. Choose a **system image** (e.g. **API 34** with **Google APIs**). Download if needed.
4. Set **Graphics** to **Software - GLES 2.0** in **Show Advanced Settings**.
5. Finish and start this new AVD, then run `npx expo run:android`.

---

## 5. Use a physical Android device (bypasses emulator issues)

You can skip the emulator and run on a real phone:

1. On the phone: **Settings** → **Developer options** → enable **USB debugging**.
2. Connect via USB and allow debugging when prompted.
3. Run:
   ```bash
   npx expo run:android
   ```
   Your device should appear in the list; select it.

---

## 6. Update GPU drivers and Windows

- Update your **graphics drivers** (e.g. from NVIDIA/AMD/Intel or Windows Update).
- Ensure **Windows** and **Android Studio** (and **Android Emulator**) are up to date.

---

## Summary

- **Netsimd** logs = normal; ignore them for the black screen.
- First try: **Graphics → Software - GLES 2.0** and **Cold Boot**.
- If the window is missing: **Win + Arrow** or **Alt + Tab** and move it.
- Fallback: new AVD or **physical device** with USB debugging.
