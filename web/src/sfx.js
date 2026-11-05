/* ============================================================================
   sfx.js — 用 Web Audio 现场合成音效，不依赖任何音频文件
   ============================================================================ */
(function (global) {
  'use strict';

  var App = global.CuteWheel;

  function createSfx(config) {
    var enabled = !!(config.audio && config.audio.enabled);
    var volume = (config.audio && config.audio.volume) || 0.12;
    var ctx = null;

    function ensureContext() {
      if (ctx) return ctx;
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;

      try {
        ctx = new AC();
      } catch (err) {
        ctx = null;
      }
      return ctx;
    }

    /** 浏览器要求首次发声必须由用户手势触发 */
    function wake() {
      var ac = ensureContext();
      if (ac && ac.state === 'suspended') ac.resume();
      return ac;
    }

    function beep(freq, duration, type, gain) {
      if (!enabled) return;

      var ac = ensureContext();
      if (!ac) return;
      if (ac.state === 'suspended') ac.resume();

      var now = ac.currentTime;
      var osc = ac.createOscillator();
      var amp = ac.createGain();
      var peak = (gain == null ? volume : gain);

      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, now);

      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(peak, now + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(amp);
      amp.connect(ac.destination);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    }

    return {
      wake: wake,
      /** 指针划过一格：短促、轻、不扰民 */
      tick: function () {
        beep(1180 + Math.random() * 120, 0.042, 'triangle', volume * 0.5);
      },
      /** 点击 / 添加 */
      pop: function () {
        beep(660, 0.075, 'sine', volume * 0.9);
      },
      /** 中奖小琶音 */
      win: function () {
        if (!enabled) return;
        var notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach(function (freq, i) {
          global.setTimeout(function () {
            beep(freq, 0.26, 'sine', volume * 1.1);
          }, i * 92);
        });
      },
      setEnabled: function (next) {
        enabled = !!next;
        if (enabled) wake();
        return enabled;
      },
      isEnabled: function () { return enabled; }
    };
  }

  App.createSfx = createSfx;
})(window);
