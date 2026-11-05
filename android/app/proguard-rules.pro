# WebView 里的 JS 通过 addJavascriptInterface 反射调用 @JavascriptInterface 方法，
# 这些方法名不能被混淆掉。
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
