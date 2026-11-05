package com.littlecodesauce.luckywheel;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * 好运转盘的原生外壳。
 *
 * <p>只做三件事：
 * <ol>
 *   <li>把 assets/www 挂到 https://appassets.androidplatform.net 下（请求全部本地读取，
 *       不联网），这样网页拿到的是正常 origin —— localStorage 才能稳定工作；</li>
 *   <li>盖一层启动图标，等网页报告首帧就绪后放大淡出；</li>
 *   <li>返回键先交给网页处理（关弹窗），网页不需要才退出。</li>
 * </ol>
 *
 * <p>刻意不引入 AppCompat / AndroidX：整个 App 零第三方依赖，
 * 包体小、启动快，也不需要任何网络权限。
 */
public class MainActivity extends Activity {

    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String ASSET_PREFIX = "/assets/www/";
    private static final String START_URL = "https://" + ASSET_HOST + ASSET_PREFIX + "index.html";
    private static final long SPLASH_TIMEOUT_MS = 4500L;

    private static final Map<String, String> MIME = new HashMap<>();

    static {
        MIME.put("html", "text/html");
        MIME.put("css", "text/css");
        MIME.put("js", "application/javascript");
        MIME.put("json", "application/json");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("svg", "image/svg+xml");
        MIME.put("woff", "font/woff");
        MIME.put("woff2", "font/woff2");
    }

    private WebView webView;
    private View splashLayer;
    private boolean splashDismissed;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(buildRoot());
        configureWebView();

        webView.loadUrl(START_URL);

        // 兜底：网页脚本万一挂了没回调，也不能让用户永远卡在图标上
        webView.postDelayed(this::dismissSplash, SPLASH_TIMEOUT_MS);
    }

    /* ── 视图 ─────────────────────────────────────────────── */

    private View buildRoot() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFFFFF8FC);

        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        splashLayer = buildSplashLayer();
        root.addView(splashLayer, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        return root;
    }

    private View buildSplashLayer() {
        FrameLayout layer = new FrameLayout(this);
        layer.setBackground(new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{0xFFFFF3F9, 0xFFF3EDFF, 0xFFEFF9FF}));

        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.ic_splash);

        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(112), dp(112));
        lp.gravity = Gravity.CENTER;
        layer.addView(icon, lp);

        return layer;
    }

    /** 图标放大 + 淡出，把画面交给已经画好的转盘 */
    private void dismissSplash() {
        if (splashDismissed || splashLayer == null) {
            return;
        }
        splashDismissed = true;

        final View layer = splashLayer;
        layer.animate()
                .alpha(0f)
                .scaleX(1.28f)
                .scaleY(1.28f)
                .setDuration(430L)
                .setInterpolator(new DecelerateInterpolator(1.6f))
                .withEndAction(() -> {
                    ViewGroup parent = (ViewGroup) layer.getParent();
                    if (parent != null) {
                        parent.removeView(layer);
                    }
                    if (splashLayer == layer) {
                        splashLayer = null;
                    }
                })
                .start();
    }

    /* ── WebView ──────────────────────────────────────────── */

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);          // 不跟随系统字体缩放，保证转盘排版
        settings.setMediaPlaybackRequiresUserGesture(false);
        // 不处理深色模式：targetSdk 34 下 WebView 的算法化暗黑默认关闭，
        // 页面自己就是浅色主题，不需要额外关一遍。

        webView.setBackgroundColor(0xFFFFF8FC);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.addJavascriptInterface(new Bridge(this), "NativeShell");
        webView.setWebViewClient(new AssetClient(this));
    }

    /** 把 appassets 域名下的请求映射到 assets/www，不经过网络 */
    WebResourceResponse serveAsset(Uri uri) {
        if (uri == null || !ASSET_HOST.equals(uri.getHost())) {
            return null;
        }

        String path = uri.getPath();
        if (path == null || !path.startsWith(ASSET_PREFIX)) {
            return null;
        }

        String assetPath = "www/" + path.substring(ASSET_PREFIX.length());

        try {
            InputStream stream = getAssets().open(assetPath);
            String mime = mimeOf(assetPath);
            boolean textual = mime.startsWith("text/") || mime.contains("javascript")
                    || mime.contains("json") || mime.contains("svg");
            return new WebResourceResponse(mime, textual ? "utf-8" : null, stream);
        } catch (IOException notFound) {
            return new WebResourceResponse("text/plain", "utf-8",
                    new ByteArrayInputStream("404".getBytes()));
        }
    }

    private static String mimeOf(String path) {
        int dot = path.lastIndexOf('.');
        if (dot >= 0) {
            String mime = MIME.get(path.substring(dot + 1).toLowerCase());
            if (mime != null) {
                return mime;
            }
        }
        return "application/octet-stream";
    }

    /** 网页报告首帧就绪，交给 UI 线程收图标 */
    void onWebReady() {
        runOnUiThread(this::dismissSplash);
    }

    /* ── 生命周期 ─────────────────────────────────────────── */

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }

        // 先问网页有没有要关的层（结果弹窗），没有才退出应用
        webView.evaluateJavascript(
                "window.LuckyWheelApp ? window.LuckyWheelApp.dismissOverlay() : false",
                value -> {
                    if (!"true".equals(value)) {
                        finish();
                    }
                });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.setWebViewClient(null);
            webView.removeJavascriptInterface("NativeShell");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
