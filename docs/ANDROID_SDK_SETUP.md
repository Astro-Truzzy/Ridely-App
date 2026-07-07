# Android SDK setup (Windows)

`expo run:android` needs the Android SDK, `ANDROID_HOME`, and a **JDK** (Java). Use this if you see:

- **"Failed to resolve the Android SDK path"**
- **"'adb' is not recognized"**
- **"No Java compiler found, please ensure you are running Gradle with a JDK"**
- **"could not open ... Android Studio\\jbr\\lib\\jvm.cfg"** (JAVA_HOME points to missing/broken JDK)

---

## 1. Install Android Studio (if you haven’t)

1. Download: https://developer.android.com/studio  
2. Run the installer and complete the setup.  
3. Open Android Studio once. In the wizard:
   - Choose **Standard** install.
   - Let it download the Android SDK (default location: `C:\Users\<YourName>\AppData\Local\Android\Sdk`).
4. In **More Actions** → **SDK Manager** (or **Settings** → **Languages & Frameworks** → **Android SDK**), ensure you have:
   - **Android SDK Platform** (e.g. latest or API 34)
   - **Android SDK Build-Tools**
   - **Android SDK Platform-Tools** (includes `adb`)

---

## 2. Set JAVA_HOME (JDK required for Gradle)

Gradle needs a **JDK** (not just a JRE). If you see *"No Java compiler found, please ensure you are running Gradle with a JDK"*:

### Option A: Use Android Studio’s bundled JDK (if Android Studio is installed)

In PowerShell (current session):

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

Or if you use a different install path:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
```

Then run `npx expo run:android` again in the **same** terminal.

### Option B: Use a standalone JDK (e.g. JDK 17)

1. Install [Microsoft Build of OpenJDK 17](https://learn.microsoft.com/en-us/java/openjdk/download#openjdk-17) (or [Adoptium](https://adoptium.net/)) and note the install path (e.g. `C:\Program Files\Microsoft\jdk-17.0.x`).
2. Set JAVA_HOME for the session:
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.13.11-hotspot"   # use your actual path
   $env:Path = "$env:JAVA_HOME\bin;$env:Path"
   ```
3. Run `npx expo run:android` in the same terminal.

### Make it permanent

1. **Win + R** → `sysdm.cpl` → **Advanced** → **Environment Variables**.
2. Under **User variables**: **New** → Variable name: `JAVA_HOME` → Value: your JDK path (e.g. `C:\Program Files\Android\Android Studio\jbr` or `C:\Program Files\Microsoft\jdk-17.0.13.11-hotspot`).
3. Edit **Path** → **New** → add `%JAVA_HOME%\bin`.
4. OK, then **close and reopen** PowerShell and run `npx expo run:android`.

---

## 3. Set ANDROID_HOME and PATH

Use your **actual** SDK path. Common one:

`C:\Users\<YourName>\AppData\Local\Android\Sdk`

Replace `<YourName>` with your Windows username (e.g. `Trust Williams` → path has a space: `C:\Users\Trust Williams\AppData\Local\Android\Sdk`).

### Option A: Current PowerShell session only

```powershell
$env:ANDROID_HOME = "C:\Users\Trust Williams\AppData\Local\Android\Sdk"
$env:Path += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools;$env:ANDROID_HOME\tools\bin"
```

Then run:

```powershell
npx expo run:android
```

### Option B: Set permanently (recommended)

1. Press **Win + R**, type `sysdm.cpl`, Enter.  
2. **Advanced** tab → **Environment Variables**.  
3. Under **User variables** (or **System** if you want it for all users):
   - **New** → Variable name: `ANDROID_HOME` → Value: `C:\Users\Trust Williams\AppData\Local\Android\Sdk` (use your real path).  
   - Select **Path** → **Edit** → **New** → add:
     - `%ANDROID_HOME%\platform-tools`
     - `%ANDROID_HOME%\tools`
     - `%ANDROID_HOME%\tools\bin`
4. OK out, **close and reopen** PowerShell/terminal, then:

```powershell
cd "C:\Users\Trust Williams\Desktop\New Ridely\Ridely-App"
npx expo run:android
```

---

## 4. If your SDK is in a different folder

If you installed the SDK somewhere else (e.g. another drive or custom path):

1. Find the folder that contains `platform-tools` (with `adb.exe` inside).  
2. Set `ANDROID_HOME` to that folder’s **parent** (the SDK root).  
   Example: if `adb` is at `D:\Android\Sdk\platform-tools\adb.exe`, then  
   `ANDROID_HOME` = `D:\Android\Sdk`.  
3. Add to **Path**: `%ANDROID_HOME%\platform-tools`, and optionally `%ANDROID_HOME%\tools` and `%ANDROID_HOME%\tools\bin`.

---

## 5. Check that it works

In a **new** terminal:

```powershell
echo $env:ANDROID_HOME
adb version
```

You should see your SDK path and adb version. Then run `npx expo run:android` again from the Ridely-App folder.

---

## 6. "No Android connected device found" / adb not recognized

### Get `adb` on your PATH (current session)

**Set ANDROID_HOME first**, then add to PATH. Run both lines in order:

```powershell
$env:ANDROID_HOME = "C:\Users\Trust Williams\AppData\Local\Android\Sdk"
$env:Path += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator"
adb version
```

If you use a different Windows username, change the path (e.g. `C:\Users\YourName\AppData\Local\Android\Sdk`).

Or run adb by full path (no ANDROID_HOME needed):

```powershell
& "C:\Users\Trust Williams\AppData\Local\Android\Sdk\platform-tools\adb.exe" version
```

### You need a device or emulator

`expo run:android` needs either:

**Option A: Physical Android phone**

1. On the phone: **Settings** → **About phone** → tap **Build number** 7 times (enables Developer options).
2. **Settings** → **Developer options** → turn on **USB debugging**.
3. Connect the phone via USB. If prompted on the phone, allow USB debugging and tap **Allow**.
4. In PowerShell run: `adb devices` (or `& "$env:ANDROID_HOME\platform-tools\adb.exe" devices`). You should see your device.
5. Run `npx expo run:android` again.

**Option B: Android emulator**

1. Open **Android Studio** → **More Actions** → **Virtual Device Manager** (or **Tools** → **Device Manager**).
2. Click **Create Device** → pick a phone (e.g. Pixel 6) → **Next**.
3. Select a system image (e.g. API 34) → **Download** if needed → **Next** → **Finish**.
4. In the device list, click **Run** (play button) to start the emulator. Wait until the virtual device is fully booted.
5. In your project folder run: `npx expo run:android`. It should detect the emulator and install the app.

---

## Troubleshooting: "could not open ... jbr\lib\jvm.cfg"

This means Gradle is using a JDK path that no longer exists or is broken (e.g. after moving or reinstalling Android Studio).

**Fix 1 – Android Studio on another drive**

If you installed Android Studio on a different drive (e.g. `D:\Android\Android Studio`), point `JAVA_HOME` to that JBR:

```powershell
$env:JAVA_HOME = "D:\Android\Android Studio\jbr"   # use your actual path
npx expo run:android
```

**Fix 2 – Use a standalone JDK (recommended)**

1. Install [Microsoft Build of OpenJDK 17](https://learn.microsoft.com/en-us/java/openjdk/download#openjdk-17) (or [Eclipse Temurin 17](https://adoptium.net/)).
2. In PowerShell, set `JAVA_HOME` to the JDK install path (e.g. `C:\Program Files\Microsoft\jdk-17.0.x` or `C:\Program Files\Eclipse Adoptium\jdk-17.x.x`).
3. Run the build in the same terminal:

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.13.11-hotspot"   # use your actual path
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
npx expo run:android
```

To make it permanent: **Win + R** → `sysdm.cpl` → **Advanced** → **Environment Variables** → set **JAVA_HOME** (and add `%JAVA_HOME%\bin` to **Path**), then restart the terminal.

---

## Troubleshooting: "NDK at ... did not have a source.properties file"

The NDK under your Android SDK is incomplete or corrupted (e.g. after a failed install or "not enough space" during install).

**Fix: Remove the broken NDK, then reinstall**

1. **Delete the broken NDK folder** (use your actual SDK path; replace `Trust Williams` if your username differs):

   ```powershell
   Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Android\Sdk\ndk\27.1.12297006" -ErrorAction SilentlyContinue
   ```

   Or in File Explorer: go to `C:\Users\Trust Williams\AppData\Local\Android\Sdk\ndk\`, delete the folder `27.1.12297006`.

2. **Install the NDK via Android Studio** (recommended):
   - Open **Android Studio** (e.g. from E:\Android\Android Studio1).
   - **More Actions** → **SDK Manager** (or **Settings** → **Languages & Frameworks** → **Android SDK**).
   - Open the **SDK Tools** tab.
   - Enable **NDK (Side by side)** and optionally **Show Package Details** to select version **27.1.12297006**.
   - Click **Apply** and wait for the download to finish (ensure you have enough disk space on C: if the SDK is there).

3. Run `npx expo run:android` again.

If the SDK is on C: and you're low on space, free at least 3–5 GB before installing the NDK.

---

## Troubleshooting: "UnknownHostException: dl.google.com" and "Failed to find Build Tools revision 35.0.0"

Gradle cannot reach Google’s servers (`dl.google.com`), so it never downloads the Android SDK manifest or Build Tools. The "Failed to find Build Tools revision 35.0.0" message is a consequence of that.

**1. Fix network / DNS**

- **Check internet:** In a browser, open https://dl.google.com — it should load (or redirect). If it doesn’t, the PC has no access to Google’s download servers.
- **DNS:** Try switching to Google DNS (8.8.8.8 / 8.8.4.4) or Cloudflare (1.1.1.1) in your network adapter or router.
- **VPN / firewall:** If you use a VPN or corporate firewall, try disabling it temporarily or allowing `*.google.com` / `dl.google.com`. Then run `npx expo run:android` again.
- **Proxy:** If you’re behind a proxy, set `HTTP_PROXY` / `HTTPS_PROXY` (and optionally `JAVA_OPTS` with `-Dhttps.proxyHost=...`) so Gradle and the JDK can reach the internet.

**2. Install Build Tools 35.0.0 via Android Studio (once network works)**

If the browser can reach the internet but Gradle still fails, install Build Tools from Android Studio so it uses Android Studio’s downloader:

1. Open **Android Studio** → **Settings** → **Languages & Frameworks** → **Android SDK**.
2. Open the **SDK Tools** tab.
3. Enable **Show Package Details**.
4. Under **Android SDK Build-Tools**, check **35.0.0** (and 36.0.0 if the project needs it).
5. Click **Apply** and wait for the install to finish. Ensure **Android SDK location** points to your SDK (e.g. `E:\Android\Sdk`).
6. Run `npx expo run:android` again.

**3. Verify ANDROID_HOME**

Ensure `ANDROID_HOME` points to the SDK that contains the Build Tools you installed (e.g. `E:\Android\Sdk`). Gradle uses this to find Build Tools 35.0.0.

---

## Troubleshooting: CMake "path has 175 characters" / "Object file cannot be safely placed"

You may see a **CMake Warning** about the object file directory path being long (e.g. for `react-native-gesture-handler`), with "The build may not work correctly."

**Cause:** On Windows, very long paths (project path + `node_modules` + build intermediates) can approach or exceed limits, especially with the New Architecture.

**Fixes (try in order):**

1. **Use a shorter project path (recommended)**  
   Move or clone the project to a short path, then build from there, for example:
   - `E:\Ridely-App` or `C:\dev\Ridely`
   - Avoid deep paths like `E:\DESKTOP\New Ridely\Ridely-App`.

2. **Build only one ABI** (reduces path depth a bit)  
   In PowerShell, run:
   ```powershell
   npx expo run:android -- --no-build-cache -PreactNativeArchitectures=arm64-v8a
   ```
   This builds only `arm64-v8a` (most devices/emulators). If the build then succeeds, the warning was likely not fatal.

3. **Enable long paths in Windows**  
   - Run **Registry Editor** as admin, go to `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem`.
   - Set `LongPathsEnabled` to `1`, then reboot.  
   This allows paths up to 32,767 characters and can resolve the issue without moving the project.

The **AndroidManifest** warnings (`usesCleartextTraffic` / `FileSystemFileProvider` "tagged to replace but no other declaration present") are harmless and can be ignored; the debug manifest was adjusted to remove the redundant `tools:replace` where possible.
