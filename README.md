# Paisa

A simple, offline-first expense tracker for Android, built for the Nepali ecosystem. Native-feeling Material 3 UI running in a WebView, with all data stored only on your device — the app has no internet permission and cannot send data anywhere.

## Features

- **Timeline** — transactions grouped by day; tap any transaction for a read-only detail view with Edit / Delete actions
- **Expense / Income / Transfers** — record spending, income, and money moves between wallets
- **Wallets** — Cash, eSewa, Khalti, Bank Account, ConnectIPS, Savings, each with a live balance; tap a wallet to filter the timeline
- **Analytics** — monthly income/expense totals, category breakdown bars, account distribution, savings rate, average daily spend, and budget progress
- **Budget** — configurable monthly budget with a progress bar
- **Material 3 UI** — light/dark theme, haptic feedback
- **Data tools**
  - *Backup as JSON* — saves a real `.json` file through the system "Save to" dialog (Downloads, Drive, ...)
  - *Export CSV* — same, saves a `.csv` file
  - *Restore Data* — pick a previously saved `.json` backup through the system file picker
- **100% offline** — the only declared permission is `VIBRATE`

Runs on Android 7.0+ (minSdk 24, targetSdk 33).

## Project structure

```
paisa/
├── app/src/main/
│   ├── AndroidManifest.xml        # package, permissions, activity
│   ├── assets/index.html          # ALL app UI, styles, and logic (HTML/CSS/JS)
│   ├── java/com/bespoke/paisa/
│   │   └── MainActivity.java      # thin native bridge + WebView host
│   └── res/                       # app theme, launcher icon, strings
├── build_and_install.sh           # one-command build & install (no Gradle needed)
├── debug.keystore                 # shared debug signing key (committed on purpose)
└── local.properties               # (gitignored) machine-specific SDK path
```

The app is intentionally minimal: `MainActivity` hosts a WebView and exposes a small JavaScript bridge (`AndroidBridge`) with vibration, toasts, sharing, key/value persistence (SharedPreferences), status-bar coloring, file picking (restore), and file saving (backup). Everything else — screens, logic, storage in `localStorage` — lives in `assets/index.html`.

## Requirements

- **JDK 11 or newer** (provides `javac`, `jar`, `keytool`)
- **Android SDK** with build-tools and at least one platform (build-tools 33.0.2 and platform android-33 are preferred; anything installed works)
- **adb** (optional — only needed for direct install to a connected device)
- **bash** (Linux, macOS, or Windows via WSL / Git Bash)

No Android Studio, no Gradle, no wrapper downloads.

## Setting up the SDK

The build script finds your SDK in this order:

1. `ANDROID_HOME` or `ANDROID_SDK_ROOT` environment variable
2. A `local.properties` file in the project root:
   ```
   sdk.dir=/absolute/path/to/android-sdk
   ```
3. Default locations: `~/Android/Sdk` (Linux), `~/Library/Android/sdk` (macOS), `/opt/android-sdk`, `/usr/lib/android-sdk`

If you don't have an SDK yet, grab the command-line tools from [developer.android.com](https://developer.android.com/studio#command-line-tools-only) and install the needed pieces:

```
sdkmanager "build-tools;33.0.2" "platforms;android-33"
```

`local.properties` is machine-specific and gitignored — each machine that builds the project sets its own path (or uses `ANDROID_HOME`). You can also pin versions per build with `BUILD_TOOLS_VERSION=34.0.0 ./build_and_install.sh` and `PLATFORM_VERSION=android-34 ./build_and_install.sh`.

## Build & install

```
./build_and_install.sh
```

The script compiles resources with `aapt2`, links the APK (bundling `assets/`), compiles the Java sources, dexes with `d8`, zipaligns, signs with `debug.keystore`, and produces `Paisa-debug.apk` in the project root. If a device is attached with `adb`, it installs and launches the app automatically.

Install manually instead:

```
adb install -r Paisa-debug.apk        # with adb
```

or copy `Paisa-debug.apk` to the phone and open it (allow "install unknown apps" when prompted).

> Updating over an existing install keeps app data, because every build is signed with the same committed `debug.keystore`. If you ever delete that file, a new one is generated and the signature changes — you'd need to uninstall the old app first (which wipes its data, so export a backup first).

## Editing the app

- UI, screens, styles, and logic: edit `app/src/main/assets/index.html`
- Native bridge / Android behavior: edit `app/src/main/java/com/bespoke/paisa/MainActivity.java`
- App name, theme colors, icon: `app/src/main/res/`

Rebuild after every change — assets are packaged inside the APK, so edits only take effect after `./build_and_install.sh`.

## Data & privacy

- All data lives on the device: WebView `localStorage`, mirrored to SharedPreferences as a safety copy (restored automatically if localStorage is cleared)
- *Backup as JSON* produces a full-state file (`Paisa-Backup-YYYY-MM-DD.json`) you can keep anywhere
- *Restore Data* accepts that file — a backup missing optional fields (like settings) still restores with safe defaults
- No `INTERNET` permission: the app physically cannot upload your data

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `ERROR: Android SDK not found` | Set `ANDROID_HOME`, or create `local.properties` with `sdk.dir=/path/to/sdk` |
| `No build-tools found` / `No Android platform found` | Run `sdkmanager "build-tools;33.0.2" "platforms;android-33"` |
| Device not detected by adb | Enable USB debugging on the phone; run `adb kill-server && adb devices` and accept the on-phone prompt |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Signature changed (keystore regenerated). Uninstall the old app first — export a JSON backup before doing so |
| Build succeeds but app shows old UI | You edited `index.html` without rebuilding — the asset is bundled into the APK |

## Contributing

Fork, edit, rebuild with `./build_and_install.sh`, and open a pull request. Keep changes to the HTML asset unless something genuinely needs native code.
