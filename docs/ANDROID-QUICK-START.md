# 🚀 Android Quick Start Guide

This is a condensed version of the full guide. Use this for quick reference during development.

## Prerequisites Checklist

- [ ] JDK 17+ installed (`java -version`)
- [ ] Android Studio installed
- [ ] `ANDROID_HOME` environment variable set
- [ ] Google Play Console account created ($25 fee)

## Development Commands

```powershell
# Build web app and sync to Android
npm run build
npm run android:sync

# Open in Android Studio
npm run android:open

# Build release AAB for Google Play
cd android
.\gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

## First-Time Setup

### 1. Create Signing Key

```powershell
cd android\app
keytool -genkey -v -keystore pulse-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias pulse-key
```

### 2. Configure Signing

Edit `android/app/build.gradle` - see full guide for details.

### 3. Update Version

Edit `android/app/build.gradle`:
```gradle
versionCode 1
versionName "1.0.0"
```

## Publishing Workflow

1. **Make changes** in `src/`
2. **Build:** `npm run build`
3. **Sync:** `npm run android:sync`
4. **Update version** in `build.gradle`
5. **Build AAB:** `cd android && .\gradlew bundleRelease`
6. **Upload** to Google Play Console
7. **Submit** for review

## Version Management

- `versionCode`: Must increment (1, 2, 3, 4...)
- `versionName`: User-visible (1.0.0, 1.0.1, 1.1.0...)

## File Locations

- **AAB output:** `android/app/build/outputs/bundle/release/app-release.aab`
- **Keystore:** `android/app/pulse-release-key.jks` (keep safe!)
- **Config:** `android/app/build.gradle`
- **Manifest:** `android/app/src/main/AndroidManifest.xml`

## Testing

```powershell
# Connect device
adb devices

# Install debug APK
cd android
.\gradlew installDebug

# View logs
adb logcat
```

## Common Issues

**Build fails?**
- Check `JAVA_HOME` and `ANDROID_HOME`
- Run `.\gradlew clean` then rebuild

**App crashes?**
- Check `adb logcat` for errors
- Ensure `npm run build` completed successfully
- Run `npx cap sync android` again

**Can't find device?**
- Enable USB debugging on device
- Run `adb devices` to verify connection

---

For detailed instructions, see **ANDROID-PUBLISHING-GUIDE.md**
