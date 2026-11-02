# Кодик для Android 9+
Native Android shell for the web app. Package: ua.kodik.python; Android version 1.0, web v1.21. Minimum API 28, target API 35.

UI and Pyodide 0.26.2 core / Python standard library are bundled offline. Optional third-party Python packages are not bundled. Updated Android System WebView (112+) is required. Older WebViews display an update prompt.

Code stays in app-local storage. Uninstall erases it. PNG sharing uses Android chooser and read-only FileProvider URIs, without storage permissions. Only bundled HTTPS resources load inside the WebView. Website is unchanged.

Build with Node 22, JDK 17, Gradle 8.9, SDK 35: run node android/prepare-web.cjs, then cd android and gradle :app:assembleDebug :app:lintDebug. APK: android/app/build/outputs/apk/debug/app-debug.apk.

CI verifies offline execution and sharing in mobile Chromium, minSdk and APK signature. This does not replace testing on a physical Android 9 phone.

Initial APK is debug-signed for testing, not Google Play. Hosted builds may use different debug certificates. Preserve code before uninstalling a previous test APK. A stable private release-signing key is needed for production updates.

Pyodide and CPython retain their upstream licenses.
