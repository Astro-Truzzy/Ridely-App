# Android: Fix "libworklets.so missing" (Reanimated + Worklets build)

If `npx expo run:android` fails with:

```text
ninja: error: '.../libworklets.so', needed by '.../libreanimated.so', missing and no known rule to make it
```

react-native-reanimated is building before react-native-worklets, or the native build cache is stale.

## What we changed in the project

1. **react-native-worklets** is now a **dependency** (not devDependency) so Gradle always builds it and Reanimated can link to it.
2. **Babel** uses `react-native-worklets/plugin` (required for Reanimated 4.x) in `babel.config.js`.

## Clean rebuild (do this after pulling the fix)

**Run all commands from your project root**, e.g. `E:\DESKTOP\New Ridely\Ridely-App` (not from `E:\` or another folder).

1. **Clean Android build:**

   **Option A – npm script (from project root):**
   ```bash
   npm run android:clean
   ```

   **Option B – manually:**

   On **Windows (PowerShell or CMD)** from project root:
   ```powershell
   cd android
   .\gradlew.bat clean
   cd ..
   ```

   On **macOS/Linux**:
   ```bash
   cd android && ./gradlew clean && cd ..
   ```

2. **Remove native build caches for Reanimated and Worklets (optional but recommended):**

   - Delete `node_modules/react-native-reanimated/android/.cxx`
   - Delete `node_modules/react-native-worklets/android/build`
   - Delete `node_modules/react-native-worklets/android/.cxx` (if it exists)

   On PowerShell (from project root):

   ```powershell
   Remove-Item -Recurse -Force -ErrorAction SilentlyContinue node_modules\react-native-reanimated\android\.cxx
   Remove-Item -Recurse -Force -ErrorAction SilentlyContinue node_modules\react-native-worklets\android\build
   Remove-Item -Recurse -Force -ErrorAction SilentlyContinue node_modules\react-native-worklets\android\.cxx
   ```

3. **Reinstall and rebuild:**

   ```bash
   npm install
   npx expo run:android
   ```

4. **Use one project path:** Run all commands from the **same** project path (e.g. always `E:\DESKTOP\New Ridely\Ridely-App` or always `C:\Users\...\Desktop\New Ridely\Ridely-App`). Mixing paths can make the linker look for `libworklets.so` in the wrong place.

If it still fails, try a full clean: remove `node_modules`, run `npm install`, then run `npm run android:clean` (or on Windows: `cd android && .\gradlew.bat clean && cd ..`) and `npx expo run:android` again.
