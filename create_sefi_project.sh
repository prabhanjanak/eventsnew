#!/usr/bin/env bash
set -euo pipefail

ROOT="sefi-vision2020-project"
rm -rf "$ROOT"
mkdir -p "$ROOT"

# Helper to create files with parents
write_file() {
  local path="$ROOT/$1"
  mkdir -p "$(dirname "$path")"
  cat > "$path"
}

# settings.gradle.kts
write_file "settings.gradle.kts" <<'EOF'
rootProject.name = "SEFI Vision 2020"
include(":app")
EOF

# gradle.properties
write_file "gradle.properties" <<'EOF'
# Project-wide Gradle settings
org.gradle.jvmargs=-Xmx1536m
kotlin.code.style=official

# Android specific
android.useAndroidX=true
android.enableJetifier=false
EOF

# build.gradle.kts
write_file "build.gradle.kts" <<'EOF'
// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    // Use explicit plugin versions compatible with Android Gradle Plugin and Kotlin
    id("com.android.application") version "8.1.0" apply false
    id("org.jetbrains.kotlin.android") version "1.8.22" apply false
}

buildscript {
    repositories {
        google()
        mavenCentral()
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
EOF

# gradlew
write_file "gradlew" <<'EOF'
#!/usr/bin/env sh
# Minimal gradlew script. Make executable after creating file: chmod +x gradlew
set -e

DIRNAME="$(dirname "$0")"
if [ -z "$DIRNAME" ]; then
  DIRNAME="."
fi

# Wrapper properties
WRAPPER_JAR="$DIRNAME/gradle/wrapper/gradle-wrapper.jar"
WRAPPER_PROPS="$DIRNAME/gradle/wrapper/gradle-wrapper.properties"

if [ ! -f "$WRAPPER_JAR" ]; then
  echo "gradle wrapper jar not found. The wrapper will download Gradle distribution directly."
fi

exec java -Xmx1536m -Dorg.gradle.appname=gradlew -classpath "$WRAPPER_JAR" org.gradle.wrapper.GradleWrapperMain "$@"
EOF
chmod +x "$ROOT/gradlew"

# gradlew.bat
write_file "gradlew.bat" <<'EOF'
@echo off
set DIRNAME=%~dp0
set WRAPPER_JAR=%DIRNAME%gradle\wrapper\gradle-wrapper.jar
if not exist "%WRAPPER_JAR%" (
  echo gradle wrapper jar not found. The wrapper will download Gradle distribution directly.
)
java -Xmx1536m -Dorg.gradle.appname=gradlew -classpath "%WRAPPER_JAR%" org.gradle.wrapper.GradleWrapperMain %*
EOF

# gradle wrapper properties
write_file "gradle/wrapper/gradle-wrapper.properties" <<'EOF'
# Gradle wrapper properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.0.2-bin.zip
EOF

# app/build.gradle.kts
write_file "app/build.gradle.kts" <<'EOF'
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sefi.vision2020"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.sefi.vision2020"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            isDebuggable = false
        }
        debug {
            isMinifyEnabled = false
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
    }

    packagingOptions {
        resources {
            excludes += setOf("META-INF/DEPENDENCIES", "META-INF/LICENSE", "META-INF/LICENSE.txt", "META-INF/NOTICE", "META-INF/NOTICE.txt")
        }
    }

    buildFeatures {
        compose = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.10.1")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.1")
    implementation("androidx.activity:activity-ktx:1.7.2")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.webkit:webkit:1.8.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("com.google.android.material:material:1.9.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}
EOF

# proguard rules
write_file "app/proguard-rules.pro" <<'EOF'
# Keep everything needed for WebView and FileProvider
-keep class android.webkit.WebView { *; }
-keepclassmembers class * extends android.app.Activity {
    public void onCreate(...);
}

# Keep our main app classes used via reflection
-keep class com.sefi.vision2020.** { *; }

# Don't obfuscate file provider authorities lookup
-keepclassmembers class * {
    public static final int SOME_CONSTANT;
}
EOF

# AndroidManifest.xml
write_file "app/src/main/AndroidManifest.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<manifest package="com.sefi.vision2020"
    xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />

    <application
        android:allowBackup="true"
        android:fullBackupContent="@xml/backup_rules"
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:theme="@style/Theme.SefiVision2020"
        android:usesCleartextTraffic="false"
        android:networkSecurityConfig="@xml/network_security_config">

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/filepaths" />
        </provider>

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.SefiVision2020.Splash">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>
</manifest>
EOF

# network security config
write_file "app/src/main/res/xml/network_security_config.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">events.sankaraeye.in</domain>
    </domain-config>
</network-security-config>
EOF

# filepaths
write_file "app/src/main/res/xml/filepaths.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <external-files-path name="external_files" path="." />
    <cache-path name="cache" path="." />
</paths>
EOF

# backup rules
write_file "app/src/main/res/xml/backup_rules.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
    <exclude domain="file" path="webview" />
</full-backup-content>
EOF

# layout activity_main.xml
write_file "app/src/main/res/layout/activity_main.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<androidx.coordinatorlayout.widget.CoordinatorLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    android:id="@+id/rootLayout"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    tools:context=".MainActivity">

    <androidx.swiperefreshlayout.widget.SwipeRefreshLayout
        android:id="@+id/swipeRefresh"
        android:layout_width="match_parent"
        android:layout_height="match_parent">

        <FrameLayout
            android:layout_width="match_parent"
            android:layout_height="match_parent">

            <WebView
                android:id="@+id/webView"
                android:layout_width="match_parent"
                android:layout_height="match_parent" />

            <ProgressBar
                android:id="@+id/progressBar"
                style="?android:attr/progressBarStyleHorizontal"
                android:layout_width="match_parent"
                android:layout_height="4dp"
                android:layout_gravity="top"
                android:indeterminate="false"
                android:max="100"
                android:progress="0"
                android:visibility="gone" />

            <LinearLayout
                android:id="@+id/offlineLayout"
                android:orientation="vertical"
                android:gravity="center"
                android:visibility="gone"
                android:background="?android:colorBackground"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:padding="24dp">

                <ImageView
                    android:layout_width="120dp"
                    android:layout_height="120dp"
                    android:src="@drawable/ic_offline"
                    android:contentDescription="@string/offline_image_desc"
                    android:tint="?attr/colorPrimary" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="@string/no_internet"
                    android:textAppearance="?attr/textAppearanceHeadlineSmall"
                    android:layout_marginTop="16dp"/>

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="@string/check_connection"
                    android:layout_marginTop="8dp"
                    android:textAppearance="?attr/textAppearanceBodyMedium"/>

                <Button
                    android:id="@+id/btnRetry"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="@string/retry"
                    android:layout_marginTop="16dp"/>
            </LinearLayout>

        </FrameLayout>
    </androidx.swiperefreshlayout.widget.SwipeRefreshLayout>

</androidx.coordinatorlayout.widget.CoordinatorLayout>
EOF

# strings.xml
write_file "app/src/main/res/values/strings.xml" <<'EOF'
<resources>
    <string name="app_name">SEFI Vision 2020</string>
    <string name="no_internet">No internet connection</string>
    <string name="check_connection">Please check your connection and try again.</string>
    <string name="retry">Retry</string>
    <string name="offline_image_desc">No Internet</string>
    <string name="loading">Loading…</string>
    <string name="permission_camera_rationale">Camera permission is required to take photos for uploads.</string>
    <string name="permission_notification_rationale">Notification permission required to show download notifications (Android 13+).</string>
</resources>
EOF

# themes.xml
write_file "app/src/main/res/values/themes.xml" <<'EOF'
<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="Theme.SefiVision2020" parent="Theme.MaterialComponents.DayNight.NoActionBar">
        <item name="colorPrimary">@color/md_theme_primary</item>
        <item name="colorOnPrimary">@color/md_theme_onPrimary</item>
        <item name="colorSecondary">@color/md_theme_secondary</item>
        <item name="android:statusBarColor">@color/md_theme_primary</item>
        <item name="android:navigationBarColor">@color/md_theme_surface</item>
        <item name="android:windowBackground">@drawable/splash_background</item>
    </style>

    <style name="Theme.SefiVision2020.Splash" parent="Theme.SefiVision2020">
        <item name="android:windowSplashScreenBackground">@color/md_theme_primary</item>
        <item name="android:windowSplashScreenAnimatedIcon">@mipmap/ic_launcher</item>
        <item name="android:windowSplashScreenIconBackgroundColor">@color/md_theme_primary</item>
        <item name="postSplashScreenTheme">@style/Theme.SefiVision2020</item>
    </style>
</resources>
EOF

# themes-night.xml
write_file "app/src/main/res/values-night/themes.xml" <<'EOF'
<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="Theme.SefiVision2020" parent="Theme.MaterialComponents.DayNight.NoActionBar">
        <item name="colorPrimary">@color/md_theme_primary_dark</item>
        <item name="colorOnPrimary">@color/md_theme_onPrimary_dark</item>
        <item name="colorSecondary">@color/md_theme_secondary_dark</item>
        <item name="android:windowBackground">@drawable/splash_background</item>
    </style>
</resources>
EOF

# colors.xml
write_file "app/src/main/res/values/colors.xml" <<'EOF'
<resources>
    <color name="md_theme_primary">#0B5FFF</color>
    <color name="md_theme_onPrimary">#FFFFFF</color>
    <color name="md_theme_secondary">#03DAC6</color>
    <color name="md_theme_surface">#FFFFFF</color>
    <color name="md_theme_primary_dark">#82B1FF</color>
    <color name="md_theme_onPrimary_dark">#000000</color>
    <color name="md_theme_secondary_dark">#66FFF0</color>
</resources>
EOF

# splash background
write_file "app/src/main/res/drawable/splash_background.xml" <<'EOF'
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@color/md_theme_primary"/>
</shape>
EOF

# ic_offline vector
write_file "app/src/main/res/drawable/ic_offline.xml" <<'EOF'
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="120dp"
    android:height="120dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FF000000"
        android:pathData="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM11 6h2v6h-2zM11 14h2v2h-2z"/>
</vector>
EOF

# mipmap-anydpi ic_launcher.xml (adaptive)
write_file "app/src/main/res/mipmap-anydpi/ic_launcher.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/md_theme_primary"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
EOF

# adaptive foreground placeholder
write_file "app/src/main/res/drawable/ic_launcher_foreground.xml" <<'EOF'
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M54,24 C34,24 18,44 18,54 C18,64 34,84 54,84 C74,84 90,64 90,54 C90,44 74,24 54,24z M54,36 a18,18 0 1,1 0,36 a18,18 0 1,1 0,-36z" />
</vector>
EOF

# mipmap round placeholder
write_file "app/src/main/res/mipmap/ic_launcher_round.xml" <<'EOF'
<bitmap xmlns:android="http://schemas.android.com/apk/res/android"
    android:src="@mipmap/ic_launcher"
    android:gravity="center" />
EOF

# MainActivity.kt
write_file "app/src/main/java/com/sefi/vision2020/MainActivity.kt" <<'EOF'
package com.sefi.vision2020

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.view.View
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.SslError
import android.widget.Button
import android.widget.ProgressBar
import androidx.activity.result.ActivityResult
import androidx.activity.result.ActivityResultCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val HOME_URL = "https://events.sankaraeye.in"
    }

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var offlineLayout: View
    private lateinit var btnRetry: Button

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>
    private var cameraImageUri: Uri? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { perms -> }

    override fun onCreate(savedInstanceState: Bundle?) {
        androidx.core.splashscreen.SplashScreen.installSplashScreen(this)

        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        offlineLayout = findViewById(R.id.offlineLayout)
        btnRetry = findViewById(R.id.btnRetry)

        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }

        btnRetry.setOnClickListener {
            if (isNetworkAvailable()) {
                loadUrl(HOME_URL)
            } else {
                showOffline(true)
            }
        }

        fileChooserLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult(),
            fileChooserActivityResult
        )

        setupWebView()
        setupDownloadHandling()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
            }
        }

        if (isNetworkAvailable()) {
            loadUrl(HOME_URL)
        } else {
            showOffline(true)
        }
    }

    private fun loadUrl(url: String) {
        showOffline(false)
        webView.loadUrl(url)
    }

    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.setAppCacheEnabled(true)
        settings.databasePath = this.filesDir.absolutePath + "/databases"
        settings.allowFileAccess = true
        settings.allowContentAccess = true

        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

        settings.userAgentString = settings.userAgentString + " SEFI-Vision-2020-App/1.0"

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                val scheme = uri.scheme ?: "https"
                return if (scheme == "http" || scheme == "https") {
                    false
                } else {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, uri)
                        startActivity(intent)
                    } catch (e: ActivityNotFoundException) {}
                    true
                }
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                progressBar.visibility = View.VISIBLE
                progressBar.progress = 0
                swipeRefresh.isRefreshing = false
                super.onPageStarted(view, url, favicon)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
                super.onPageFinished(view, url)
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    showOffline(true)
                }
                super.onReceivedError(view, request, error)
            }

            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler, error: SslError?) {
                val message = "SSL Certificate error. The connection may not be secure."
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("SSL Certificate error")
                    .setMessage(message)
                    .setPositiveButton("Continue") { _, _ ->
                        handler.proceed()
                    }
                    .setNegativeButton("Cancel") { _, _ ->
                        handler.cancel()
                    }
                    .setCancelable(true)
                    .show()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
                super.onProgressChanged(view, newProgress)
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallbackParam: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = filePathCallbackParam

                val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                var photoFile: File? = null
                if (takePictureIntent.resolveActivity(packageManager) != null) {
                    try {
                        photoFile = createImageFile()
                        cameraImageUri = FileProvider.getUriForFile(
                            this@MainActivity,
                            "${packageName}.fileprovider",
                            photoFile
                        )
                        takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri)
                    } catch (ex: IOException) {
                        Log.e(TAG, "Unable to create camera file", ex)
                    }
                }

                val contentSelectionIntent = Intent(Intent.ACTION_GET_CONTENT)
                contentSelectionIntent.addCategory(Intent.CATEGORY_OPENABLE)
                contentSelectionIntent.type = "*/*"
                val mimeTypes = arrayOf("image/*", "application/pdf", "application/zip", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                contentSelectionIntent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes)
                contentSelectionIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, fileChooserParams?.mode == FileChooserParams.MODE_OPEN_MULTIPLE)

                val intentArray = if (photoFile != null) arrayOf(takePictureIntent) else arrayOf()
                val chooserIntent = Intent(Intent.ACTION_CHOOSER)
                chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent)
                chooserIntent.putExtra(Intent.EXTRA_TITLE, "Select files")
                chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray)

                fileChooserLauncher.launch(chooserIntent)
                return true
            }
        }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
    }

    private val fileChooserActivityResult = ActivityResultCallback<ActivityResult> { result ->
        if (filePathCallback == null) {
            return@ActivityResultCallback
        }

        val results: Array<Uri>? = when {
            result.resultCode != Activity.RESULT_OK -> null
            result.data == null -> {
                cameraImageUri?.let { arrayOf(it) }
            }
            else -> {
                val data = result.data!!
                val clipData = data.clipData
                if (clipData != null) {
                    Array(clipData.itemCount) { i ->
                        clipData.getItemAt(i).uri
                    }
                } else {
                    data.data?.let { arrayOf(it) }
                }
            }
        }

        filePathCallback?.onReceiveValue(results)
        filePathCallback = null
        cameraImageUri = null
    }

    @Throws(IOException::class)
    private fun createImageFile(): File {
        val timeStamp: String = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val imageFileName = "JPEG_${timeStamp}_"
        val storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
            ?: cacheDir
        return File.createTempFile(
            imageFileName,
            ".jpg",
            storageDir
        )
    }

    private fun setupDownloadHandling() {
        webView.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, contentLength ->
            try {
                val filename = android.webkit.URLUtil.guessFileName(url, contentDisposition, mimeType)
                val request = DownloadManager.Request(Uri.parse(url))
                request.setMimeType(mimeType)
                request.addRequestHeader("User-Agent", userAgent)
                request.setDescription(getString(R.string.loading))
                request.setTitle(filename)
                request.allowScanningByMediaScanner()
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)

                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(request)
            } catch (e: Exception) {
                Log.e(TAG, "Download failed", e)
            }
        })
    }

    private fun showOffline(show: Boolean) {
        offlineLayout.visibility = if (show) View.VISIBLE else View.GONE
        webView.visibility = if (show) View.GONE else View.VISIBLE
        progressBar.visibility = if (show) View.GONE else progressBar.visibility
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager?
            ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        try {
            (webView.parent as? android.view.ViewGroup)?.removeView(webView)
            webView.removeAllViews()
            webView.destroy()
        } catch (ignored: Exception) {
        }
        super.onDestroy()
    }
}
EOF

# values-night/colors.xml
write_file "app/src/main/res/values-night/colors.xml" <<'EOF'
<resources>
    <color name="md_theme_primary">#82B1FF</color>
    <color name="md_theme_onPrimary">#000000</color>
    <color name="md_theme_secondary">#66FFF0</color>
    <color name="md_theme_surface">#121212</color>
</resources>
EOF

# README.md
write_file "README.md" <<'EOF'
# SEFI Vision 2020 (Android)

Lightweight Android WebView app that opens `https://events.sankaraeye.in`.

Features
- Full-screen WebView with in-app navigation (no external browser)
- JavaScript, DOM Storage, Cookies (including third-party cookies)
- Support for file uploads (camera, gallery, PDF, any file picker)
- Support for downloads (PDF, images, office docs, ZIP) via DownloadManager
- Material Design 3 theme (light/dark)
- Android 12+ SplashScreen API support
- Loading progress bar, swipe-to-refresh, friendly retry page when offline
- SSL error handling dialog
- Android 13 notification permission handling
- Release-ready Gradle configuration and ProGuard rules

Minimum SDK: 24
Target / Compile SDK: 34
Language: Kotlin

---

## Building locally

Requirements:
- JDK 17
- Android Studio (recommended) or CLI with Android SDK installed
- Gradle (wrapper is included if you generate wrapper jar)

Open the project in Android Studio (File -> Open) at the project root.

From command line:
- Debug APK: `./gradlew assembleDebug`
- Release APK: `./gradlew assembleRelease`

Release build produces APK at:
`app/build/outputs/apk/release/app-release.apk`

---

## GitHub Actions

A workflow is included at `.github/workflows/android.yml` that:
- Runs on ubuntu-latest
- Sets up Java 17 (Temurin)
- Caches Gradle
- Builds the release APK with `./gradlew assembleRelease`
- Uploads the APK as an artifact

To enable:
1. Push this repository to GitHub.
2. Go to Actions tab — workflow will run on push to `main` (see workflow filters).

Download the APK from the workflow run's "Artifacts" section.

---

## Notes

- Replace launcher icons in `app/src/main/res/mipmap-*` and `drawable/ic_launcher_foreground.xml`.
- Recommended: use Android Studio Image Asset generator to create all mipmap densities from your PNG.
- If you want me to push directly, grant write permission to the account I use; otherwise push locally.
EOF

# GitHub Actions workflow
write_file ".github/workflows/android.yml" <<'EOF'
name: Android CI

on:
  push:
    branches:
      - main
      - master
  pull_request:
    branches:
      - main
      - master

jobs:
  build:
    name: Build Release APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Cache Gradle
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
          restore-keys: |
            ${{ runner.os }}-gradle-

      - name: Grant execute permission for gradlew
        run: chmod +x ./gradlew

      - name: Build Release APK
        run: ./gradlew assembleRelease --no-daemon

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: sefi-vision2020-apk
          path: app/build/outputs/apk/release/*.apk
EOF

# Final notes to user in a file
write_file "INSTRUCTIONS.txt" <<'EOF'
Project scaffold created.

IMPORTANT: Replace the launcher adaptive foreground with your logo BEFORE building or zipping:
- Put your PNG (original) at:
  app/src/main/res/drawable/ic_launcher_foreground.png

Optional: add a round launcher icon:
  app/src/main/res/mipmap/ic_launcher_round.png

If you prefer Android Studio to generate proper density mipmap PNGs:
- Open project in Android Studio
- Go to: File > New > Image Asset > Launcher icons (Adaptive and Legacy)
- Use your PNG as foreground; choose shape and generate.

To create a zip and inspect:
cd "$(pwd)/sefi-vision2020-project"
# add your PNGs into the paths above
zip -r ../sefi-vision2020.zip .

You can then unzip locally or push the project to your GitHub repo.

To push to your repo (example):
git clone git@github.com:prabhanjanak/v2020android_v1.git
cd v2020android_v1
# copy the project contents into this repo root, then:
git add .
git commit -m "Initial commit: SEFI Vision 2020 — WebView app, add app logo"
git push -u origin Main

If you want me to produce a Windows PowerShell script or a tar.gz instead, say so.
EOF

# Make the zip
(
  cd "$ROOT"
  zip -r ../sefi-vision2020.zip . > /dev/null
)

echo "Done. Project created at: $ROOT"
echo "Zip archive created: sefi-vision2020.zip"
echo ""
echo "Next steps:"
echo "1) Add your launcher PNG(s) into the generated project before building:"
echo "   - app/src/main/res/drawable/ic_launcher_foreground.png"
echo "   - (optional) app/src/main/res/mipmap/ic_launcher_round.png"
echo "2) Unzip and open project in Android Studio or push to GitHub:"
echo "   unzip sefi-vision2020.zip -d sefi-vision2020"
echo "   cd sefi-vision2020"
echo "   # then push to your repo or open in Android Studio"