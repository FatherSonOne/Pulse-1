# 📱 Publishing Pulse to Google Play Console - Complete Guide

This guide walks you through publishing your Pulse web app as a native Android app on Google Play Store, while keeping your web version intact.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Understanding the Setup](#understanding-the-setup)
3. [Initial Setup & Configuration](#initial-setup--configuration)
4. [Building Your Android App](#building-your-android-app)
5. [Creating a Signing Key](#creating-a-signing-key)
6. [Google Play Console Setup](#google-play-console-setup)
7. [Preparing Your App Bundle](#preparing-your-app-bundle)
8. [Store Listing Configuration](#store-listing-configuration)
9. [Testing & Publishing](#testing--publishing)
10. [Maintenance & Updates](#maintenance--updates)

---

## Prerequisites

### Required Software

1. **Node.js** (v18+) - Already installed ✅
2. **Java Development Kit (JDK)** - Version 17 or higher
   - Download from: https://adoptium.net/ or https://www.oracle.com/java/technologies/downloads/
   - Verify installation: `java -version`
3. **Android Studio** (Recommended) or Android SDK Command Line Tools
   - Download: https://developer.android.com/studio
   - Install Android SDK Platform 34 (or latest)
   - Set `ANDROID_HOME` environment variable
4. **Google Play Console Account**
   - One-time registration fee: $25 USD
   - Sign up at: https://play.google.com/console/signup

### Environment Variables

Add to your system environment variables (Windows):

```powershell
# Set ANDROID_HOME (adjust path to your installation)
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Users\YourName\AppData\Local\Android\Sdk", "User")
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Java\jdk-17", "User")

# Add to PATH
$env:Path += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools;$env:JAVA_HOME\bin"
```

---

## Understanding the Setup

### How It Works

- **Capacitor** wraps your existing React web app in a native Android container
- Your web app code remains unchanged - it runs inside a WebView
- The Android app can access native features (camera, notifications, etc.)
- You maintain **one codebase** for both web and Android
- The web version continues to work independently

### Project Structure

```
pulse/
├── src/                    # Your React app (unchanged)
├── dist/                   # Web build output
├── android/                # Android native project (auto-generated)
│   ├── app/
│   │   ├── build.gradle   # App configuration
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       └── java/...    # Native Android code
│   └── build.gradle        # Project configuration
├── capacitor.config.ts     # Capacitor configuration
└── package.json            # NPM scripts
```

---

## Initial Setup & Configuration

### Step 1: Verify Capacitor Installation

```powershell
cd F:\pulse
npm list @capacitor/core @capacitor/cli @capacitor/android
```

You should see versions listed. If not, run:
```powershell
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/splash-screen
```

### Step 2: Update App Version

Edit `android/app/build.gradle`:

```gradle
defaultConfig {
    applicationId "com.pulse.app"
    minSdkVersion rootProject.ext.minSdkVersion
    targetSdkVersion rootProject.ext.targetSdkVersion
    versionCode 1              // Increment for each release (1, 2, 3...)
    versionName "1.0.0"        // User-visible version (1.0.0, 1.0.1...)
    // ...
}
```

**Important:** 
- `versionCode` must increase with each release (1, 2, 3, 4...)
- `versionName` is what users see (1.0.0, 1.0.1, 1.1.0...)

### Step 3: Configure App Details

Edit `android/app/src/main/res/values/strings.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Pulse</string>
    <string name="title_activity_main">Pulse</string>
    <string name="package_name">com.pulse.app</string>
    <string name="custom_url_scheme">pulse</string>
</resources>
```

### Step 4: Add App Icons

Replace the default icons in:
- `android/app/src/main/res/mipmap-hdpi/ic_launcher.png` (72x72)
- `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` (48x48)
- `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` (96x96)
- `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` (144x144)
- `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` (192x192)

And round versions:
- `android/app/src/main/res/mipmap-*/ic_launcher_round.png`

**Tip:** Use Android Asset Studio: https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html

---

## Building Your Android App

### Development Workflow

```powershell
# 1. Make changes to your React app
# Edit files in src/

# 2. Build web app
npm run build

# 3. Sync to Android
npm run android:sync
# OR manually:
npx cap sync android

# 4. Open in Android Studio
npm run android:open
# OR manually:
npx cap open android
```

### Testing on Device/Emulator

**Option 1: Android Studio**
1. Open Android Studio: `npm run android:open`
2. Connect Android device via USB (enable USB debugging)
3. Click "Run" button (green play icon)
4. Select your device/emulator

**Option 2: Command Line**
```powershell
# Build and run
npm run android:run

# Or manually:
cd android
.\gradlew assembleDebug
adb install app\build\outputs\apk\debug\app-debug.apk
```

---

## Creating a Signing Key

**⚠️ CRITICAL:** Keep your keystore file safe! If lost, you cannot update your app.

### Step 1: Generate Keystore

```powershell
# Navigate to android/app directory
cd android\app

# Generate keystore (replace with your details)
keytool -genkey -v -keystore pulse-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias pulse-key

# You'll be prompted for:
# - Password (remember this!)
# - Your name/organization
# - Location
# - Confirm password
```

**Save these details securely:**
- Keystore file: `android/app/pulse-release-key.jks`
- Keystore password: [your password]
- Key alias: `pulse-key`
- Key password: [your password]

### Step 2: Configure Signing in build.gradle

Edit `android/app/build.gradle`:

```gradle
android {
    // ... existing config ...
    
    signingConfigs {
        release {
            storeFile file('pulse-release-key.jks')
            storePassword System.getenv("KEYSTORE_PASSWORD") ?: ""
            keyAlias "pulse-key"
            keyPassword System.getenv("KEY_PASSWORD") ?: ""
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Step 3: Set Environment Variables (Optional but Recommended)

Create `android/app/keystore.properties`:

```properties
KEYSTORE_PASSWORD=your_keystore_password_here
KEY_PASSWORD=your_key_password_here
```

Then update `android/app/build.gradle`:

```gradle
def keystorePropertiesFile = rootProject.file("app/keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            storeFile file('pulse-release-key.jks')
            storePassword keystoreProperties['KEYSTORE_PASSWORD'] ?: ""
            keyAlias "pulse-key"
            keyPassword keystoreProperties['KEY_PASSWORD'] ?: ""
        }
    }
    // ...
}
```

**⚠️ Add to .gitignore:**
```
android/app/pulse-release-key.jks
android/app/keystore.properties
```

---

## Google Play Console Setup

### Step 1: Create Google Play Console Account

1. Go to: https://play.google.com/console/signup
2. Pay one-time $25 registration fee
3. Complete account setup

### Step 2: Create New App

1. Log into Google Play Console
2. Click "Create app"
3. Fill in:
   - **App name:** Pulse
   - **Default language:** English (United States)
   - **App or game:** App
   - **Free or paid:** Free (or Paid if you want)
   - **Declarations:** Check all that apply
4. Click "Create app"

### Step 3: Complete App Access

1. Navigate to **Setup** → **App access**
2. Answer questions about your app's content
3. Complete content rating questionnaire

---

## Preparing Your App Bundle

### Step 1: Build Release Bundle (AAB)

```powershell
# Make sure you've built the web app
npm run build

# Sync to Android
npx cap sync android

# Build release AAB
cd android
.\gradlew bundleRelease
```

The AAB file will be at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

### Step 2: Test the Bundle Locally (Optional)

```powershell
# Install bundletool (Google's tool for testing AABs)
# Download from: https://github.com/google/bundletool/releases

# Generate APKs from AAB for testing
java -jar bundletool.jar build-apks --bundle=app-release.aab --output=app-release.apks --ks=pulse-release-key.jks --ks-pass=pass:YOUR_PASSWORD --ks-key-alias=pulse-key --key-pass=pass:YOUR_PASSWORD

# Install on device
java -jar bundletool.jar install-apks --apks=app-release.apks
```

---

## Store Listing Configuration

### Step 1: App Details

Navigate to **Store presence** → **Main store listing**

**Required Information:**

1. **App name:** Pulse (or "Pulse - AI Communication Dashboard")
2. **Short description:** (80 characters max)
   ```
   AI-native communication dashboard for teams. Manage emails, messages, and meetings in one place.
   ```
3. **Full description:** (4000 characters max)
   ```
   Pulse is an AI-powered communication dashboard that helps teams stay on top of their messages, emails, meetings, and contacts all in one unified interface.

   Features:
   • Unified inbox for all your communications
   • AI-powered message insights and summaries
   • Smart calendar integration
   • Real-time notifications
   • Voice messaging and transcription
   • Advanced search across all channels
   • CRM integration
   • And much more!

   Stay on the pulse of your communication with Pulse.
   ```

### Step 2: Graphics Assets

**Required:**
- **App icon:** 512x512 PNG (no transparency)
- **Feature graphic:** 1024x500 PNG
- **Screenshots:** At least 2, up to 8
  - Phone: 16:9 or 9:16, min 320px, max 3840px
  - Tablet: 16:9 or 9:16, min 320px, max 3840px

**Optional but Recommended:**
- **Promo graphic:** 180x120 PNG
- **TV banner:** 1280x720 PNG
- **Phone screenshots:** 2-8 images
- **7-inch tablet screenshots:** 1-8 images
- **10-inch tablet screenshots:** 1-8 images

**Tools for creating graphics:**
- Canva: https://www.canva.com/
- Figma: https://www.figma.com/
- Android Asset Studio: https://romannurik.github.io/AndroidAssetStudio/

### Step 3: Categorization

- **App category:** Productivity (or Business)
- **Tags:** Communication, Productivity, AI, Dashboard

### Step 4: Contact Details

- **Email:** Your support email
- **Phone:** (Optional)
- **Website:** Your website URL

### Step 5: Privacy Policy

**Required if your app:**
- Collects user data
- Accesses personal information
- Uses third-party services

Create a privacy policy and host it online, then add the URL in:
**Store presence** → **Main store listing** → **Privacy Policy**

---

## Testing & Publishing

### Step 1: Internal Testing (Recommended First Step)

1. Go to **Testing** → **Internal testing**
2. Click "Create new release"
3. Upload your AAB file (`app-release.aab`)
4. Add release notes:
   ```
   Initial release of Pulse for Android
   - Full feature parity with web version
   - Native Android experience
   - Optimized performance
   ```
5. Click "Save"
6. Add testers (up to 100 email addresses)
7. Testers will receive an email with a link to install

### Step 2: Closed Testing (Optional)

1. Go to **Testing** → **Closed testing**
2. Create a new track (Alpha, Beta, etc.)
3. Upload AAB and add testers
4. Testers can join via opt-in link

### Step 3: Open Testing (Recommended Before Production)

1. Go to **Testing** → **Open testing**
2. Create release
3. Upload AAB
4. Anyone can join and test
5. Great for getting feedback before production

### Step 4: Production Release

1. Go to **Production**
2. Click "Create new release"
3. Upload your AAB file
4. Add release notes (visible to users)
5. Review and confirm
6. Click "Start rollout to Production"

**Review Process:**
- Google reviews your app (usually 1-3 days)
- You'll receive email notifications about status
- Once approved, your app goes live!

---

## Maintenance & Updates

### Updating Your App

1. **Update version numbers:**
   ```gradle
   // android/app/build.gradle
   versionCode 2  // Increment by 1
   versionName "1.0.1"  // Update as needed
   ```

2. **Make your changes** in `src/`

3. **Build and sync:**
   ```powershell
   npm run build
   npx cap sync android
   ```

4. **Build new AAB:**
   ```powershell
   cd android
   .\gradlew bundleRelease
   ```

5. **Upload to Play Console:**
   - Go to your app in Play Console
   - Create new release
   - Upload new AAB
   - Add release notes
   - Submit for review

### Best Practices

1. **Test thoroughly** before each release
2. **Increment versionCode** with every release
3. **Write clear release notes** for users
4. **Monitor crash reports** in Play Console
5. **Respond to user reviews** regularly
6. **Keep dependencies updated** (Capacitor, React, etc.)

### Monitoring

- **Play Console Dashboard:** Track installs, ratings, crashes
- **Crash reports:** Fix issues quickly
- **User reviews:** Respond and improve
- **Analytics:** Use Google Analytics or Firebase

---

## Troubleshooting

### Common Issues

**Issue: "Gradle build failed"**
- Solution: Ensure JDK 17+ is installed and `JAVA_HOME` is set
- Check: `java -version`

**Issue: "SDK not found"**
- Solution: Install Android SDK via Android Studio
- Set `ANDROID_HOME` environment variable

**Issue: "Keystore password incorrect"**
- Solution: Double-check your keystore.properties file
- Ensure no extra spaces or characters

**Issue: "App crashes on launch"**
- Solution: Check Android logs: `adb logcat`
- Ensure all web assets are synced: `npx cap sync android`

**Issue: "Network requests fail"**
- Solution: Check AndroidManifest.xml has INTERNET permission
- Verify CORS settings on your backend

### Getting Help

- **Capacitor Docs:** https://capacitorjs.com/docs
- **Google Play Console Help:** https://support.google.com/googleplay/android-developer
- **Stack Overflow:** Tag with `capacitor` and `android`

---

## Quick Reference Commands

```powershell
# Build web app
npm run build

# Sync to Android
npm run android:sync

# Open in Android Studio
npm run android:open

# Build release AAB
cd android
.\gradlew bundleRelease

# Clean build (if issues)
.\gradlew clean
.\gradlew bundleRelease

# Check connected devices
adb devices

# View logs
adb logcat
```

---

## Next Steps

After Android is published:

1. **iOS Version:** Follow similar process with Capacitor iOS
2. **App Store:** Publish to Apple App Store
3. **Feature Parity:** Ensure both platforms have same features
4. **Analytics:** Set up Firebase or similar for both platforms
5. **Push Notifications:** Implement native push notifications

---

## Summary Checklist

- [ ] Install JDK 17+
- [ ] Install Android Studio / SDK
- [ ] Set ANDROID_HOME environment variable
- [ ] Create Google Play Console account ($25)
- [ ] Generate signing keystore
- [ ] Configure build.gradle with signing
- [ ] Update app version numbers
- [ ] Add app icons
- [ ] Build release AAB
- [ ] Create app in Play Console
- [ ] Complete store listing
- [ ] Upload screenshots and graphics
- [ ] Set up privacy policy
- [ ] Test internally
- [ ] Submit for production review
- [ ] Monitor and respond to reviews

---

**Congratulations!** You're now ready to publish Pulse to Google Play Store! 🎉

For iOS publishing, we'll follow a similar process using Capacitor iOS. Let me know when you're ready to tackle that!
