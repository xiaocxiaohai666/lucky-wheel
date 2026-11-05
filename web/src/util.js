/* ============================================================================
   util.js — 无依赖的小工具函数（必须最先加载）
   ============================================================================ */
(function (global) {
  'use strict';

  var App = global.CuteWheel = global.CuteWheel || {};
  var TAU = Math.PI * 2;

  function clamp(value, min, max) {
    return value < min ? min : (value > max ? max : value);
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomInt(min, max) {
    return Math.floor(randomBetween(min, max + 1));
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /** 正向取模：结果永远落在 [0, m) */
  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  /** 够用的唯一 id（同一会话内不重复即可） */
  function uid(prefix) {
    return (prefix || 'i') + Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6);
  }

  function prefersReducedMotion() {
    return !!(global.matchMedia &&
      global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /** 安全读取 localStorage：隐私模式/禁用时退回内存态 */
  var memoryStore = Object.create(null);

  var storage = {
    get: function (key) {
      var raw = null;
      try {
        raw = global.localStorage.getItem(key);
      } catch (err) {
        raw = null;
      }
      if (raw != null) {
        memoryStore[key] = raw;
        return raw;
      }
      return Object.prototype.hasOwnProperty.call(memoryStore, key)
        ? memoryStore[key]
        : null;
    },
    set: function (key, value) {
      memoryStore[key] = value;
      try {
        global.localStorage.setItem(key, value);
      } catch (err) { /* 存不下就算了，不打断玩法 */ }
    }
  };

  App.util = {
    TAU: TAU,
    clamp: clamp,
    randomBetween: randomBetween,
    randomInt: randomInt,
    pick: pick,
    mod: mod,
    uid: uid,
    prefersReducedMotion: prefersReducedMotion,
    storage: storage
  };
})(window);
