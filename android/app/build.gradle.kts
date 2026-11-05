plugins {
    id("com.android.application")
}

android {
    namespace = "com.littlecodesauce.luckywheel"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.littlecodesauce.luckywheel"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

// 零第三方依赖：WebView 的资源拦截用框架自带的 shouldInterceptRequest 实现，
// 不需要 androidx.webkit，也就不需要联网下载任何 AAR。
dependencies {
}

/**
 * 网页源码只维护一份（../lucky-wheel）。
 * 每次构建前自动同步到 assets/www，避免出现"改了网页版但 App 没跟上"。
 */
val syncWebAssets by tasks.registering(Copy::class) {
    from(rootProject.file("../lucky-wheel")) {
        exclude("preview.png", "preview-mobile.png", "preview-many.png")
        exclude("README.md", "test/**", "_*")
    }
    into(layout.projectDirectory.dir("src/main/assets/www"))
}

tasks.named("preBuild") {
    dependsOn(syncWebAssets)
}
