/* ============================================================================
   main.js — 引导：把各模块装配起来，收尾启动过渡
   任何模块都不互相 new，全部在这里组装；换实现时只改这一处。
   ============================================================================ */
(function (global) {
  'use strict';

  var App = global.CuteWheel;

  /** 跑在安卓外壳里时，window.NativeShell 由 WebView 注入 */
  function nativeShell() {
    try {
      return typeof global.NativeShell !== 'undefined' ? global.NativeShell : null;
    } catch (err) {
      return null;
    }
  }

  function bootWaitMs(config) {
    // 原生外壳自己有一段图标过渡，网页这边就别再慢悠悠地等一秒了
    if (nativeShell()) return 200;

    return App.util.prefersReducedMotion()
      ? Math.min(320, config.boot.minDuration)
      : config.boot.minDuration;
  }

  /** 告诉原生外壳：首帧已经画好了，可以开始收图标了 */
  function notifyNativeReady() {
    var shell = nativeShell();
    if (!shell || typeof shell.onReady !== 'function') return;

    try {
      shell.onReady();
    } catch (err) {
      /* 桥不可用不影响网页本体，静默兜底 */
    }
  }

  function hideBoot() {
    var bootEl = document.getElementById('boot');
    document.body.classList.remove('is-booting');
    document.body.classList.add('is-ready');

    if (!bootEl) return;

    bootEl.classList.add('is-gone');
    global.setTimeout(function () {
      if (bootEl.parentNode) bootEl.parentNode.removeChild(bootEl);
    }, App.CONFIG.boot.exitDuration);
  }

  function boot() {
    var cfg = App.CONFIG;

    var store = App.createStore({ config: cfg });
    var sfx = App.createSfx(cfg);
    var wheel = App.createWheel(document.getElementById('wheel'), { config: cfg });

    App.createBackground(document.getElementById('stars'), cfg);
    var confetti = App.createConfetti(document.getElementById('confetti'));

    var ui = App.createUI({
      config: cfg,
      store: store,
      wheel: wheel,
      sfx: sfx,
      confetti: confetti
    });

    ui.init();

    /* 首帧已经画好：先通知原生收图标，再让网页自己的过渡层散开 */
    notifyNativeReady();
    global.setTimeout(hideBoot, bootWaitMs(cfg));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
