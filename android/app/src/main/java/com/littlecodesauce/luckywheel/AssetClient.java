package com.littlecodesauce.luckywheel;

import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * 把 appassets 域名下的请求映射到 assets/www，一个字节都不出网。
 *
 * <p>写成顶层类而不是内部类：build-tools 34 自带的 d8（8.2.x）在解析
 * 带 InnerClasses 属性、且父类来自 android.jar 的内部类时会抛内部 NPE。
 * 拆成独立文件是最省事的规避方式，也让 MainActivity 更短。
 */
final class AssetClient extends WebViewClient {

    private final MainActivity host;

    AssetClient(MainActivity host) {
        this.host = host;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view,
                                                      WebResourceRequest request) {
        return host.serveAsset(request.getUrl());
    }
}
