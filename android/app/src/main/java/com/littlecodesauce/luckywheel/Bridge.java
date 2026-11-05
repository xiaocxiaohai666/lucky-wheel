package com.littlecodesauce.luckywheel;

import android.webkit.JavascriptInterface;

/**
 * 暴露给网页的桥。网页只判断 "window.NativeShell 是否存在"，
 * 有就说明自己跑在 App 外壳里，会把开场等待压短、并回调 onReady。
 */
final class Bridge {

    private final MainActivity host;

    Bridge(MainActivity host) {
        this.host = host;
    }

    @JavascriptInterface
    public void onReady() {
        host.onWebReady();
    }
}
