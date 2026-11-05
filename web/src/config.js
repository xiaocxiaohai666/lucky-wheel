/* ============================================================================
   config.js — 全部可调参数集中在这里（改风格 / 改手感只动本文件）
   ============================================================================ */
(function (global) {
  'use strict';

  var App = global.CuteWheel = global.CuteWheel || {};

  /** 扇区配色：浅马卡龙底 + 同色系深字，保证文字对比度 */
  var PALETTE = [
    { bg: '#FFC2D9', text: '#8A3556' }, // 草莓奶
    { bg: '#FFE3A3', text: '#8A6118' }, // 香草黄
    { bg: '#B7EBD5', text: '#1F6B4F' }, // 薄荷
    { bg: '#BFE0FF', text: '#235A8A' }, // 天空蓝
    { bg: '#D8CBFF', text: '#47328C' }, // 薰衣草
    { bg: '#FFD2B8', text: '#8A4A22' }, // 蜜桃
    { bg: '#FFBFC2', text: '#8A2E39' }, // 珊瑚
    { bg: '#C8F0F0', text: '#1B6666' }, // 汽水青
    { bg: '#F2CDFF', text: '#6A2E8A' }, // 葡萄
    { bg: '#EDE2C4', text: '#6B5A2E' }  // 奶咖
  ];

  App.CONFIG = {
    /* ── 数据 ─────────────────────────────────────────────── */
    storageKey: 'cute-wheel.items.v1',
    minItems: 2,
    // 扇区数量不锁死在某个数上：加到多少就画多少。
    // 这里只是给一个"再多人眼就分辨不清"的软上限，想更夸张可以继续调大，
    // 字号会自动跟着扇区宽度缩。
    maxItems: 24,
    maxLabelLength: 14,
    defaults: ['火锅', '烤肉', '日料', '炸鸡', '麻辣烫', '沙拉', '汉堡', '面条'],

    palette: PALETTE,

    /* ── 旋转手感（转速随机的三个来源都在这里）────────────── */
    spin: {
      minTurns: 4,          // 最少圈数
      maxTurns: 9,          // 最多圈数
      minDuration: 3800,    // 最短时长（ms）
      maxDuration: 6400,    // 最长时长（ms）
      minPower: 3.1,        // 缓动指数下限：越小尾段越软
      maxPower: 4.9,        // 缓动指数上限：越大起步越猛
      rampIn: 0.05,         // 起手缓冲占比，避免"啪"地一下弹出去
      jitterRatio: 0.32,    // 落点在扇区内的随机抖动（0 = 永远正中）
      tickIntervalMs: 46    // 经过扇区边界的音效最小间隔
    },

    /* ── 音效 ─────────────────────────────────────────────── */
    audio: {
      enabled: true,
      volume: 0.12
    },

    /* ── 背景飘落装饰 ─────────────────────────────────────── */
    background: {
      count: 22,
      minSize: 5,
      maxSize: 13,
      minSpeed: 8,          // px/s
      maxSpeed: 26,
      opacity: 0.5
    },

    /* ── 启动过渡 ─────────────────────────────────────────── */
    boot: {
      minDuration: 1100,    // 至少展示这么久，避免闪一下
      exitDuration: 640
    }
  };
})(window);
