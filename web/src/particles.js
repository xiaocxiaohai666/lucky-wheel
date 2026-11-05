/* ============================================================================
   particles.js — 两块全屏画布：
     1. createBackground —— 背景缓缓飘落的小心心 / 星星
     2. createConfetti   —— 中奖时从中心炸开的彩纸
   两者都用固定 DPR 的内部缓冲区 + 仅在需要时跑 rAF，空闲不吃 CPU。
   ============================================================================ */
(function (global) {
  'use strict';

  var App = global.CuteWheel;
  var U = App.util;

  var COLORS = ['#FFC2D9', '#FFE3A3', '#B7EBD5', '#BFE0FF', '#D8CBFF', '#FFD2B8', '#F2CDFF'];

  /** 给画布套上 DPR 缓冲区，返回 CSS 像素尺寸 */
  function fitCanvas(canvas) {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var width = canvas.clientWidth || global.innerWidth;
    var height = canvas.clientHeight || global.innerHeight;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, width: width, height: height, dpr: dpr };
  }

  /* ────────────────────────────────────────────────────────────
     背景：飘落装饰
     ──────────────────────────────────────────────────────────── */
  function createBackground(canvas, config) {
    var cfg = config.background;
    var view = fitCanvas(canvas);
    var ctx = view.ctx;
    var particles = [];
    var rafId = 0;
    var lastTime = 0;
    var running = false;
    var reduced = U.prefersReducedMotion();

    function spawn(initial) {
      return {
        x: Math.random() * view.width,
        y: initial ? Math.random() * view.height : -20,
        size: U.randomBetween(cfg.minSize, cfg.maxSize),
        speed: U.randomBetween(cfg.minSpeed, cfg.maxSpeed),
        sway: U.randomBetween(10, 26),
        phase: Math.random() * U.TAU,
        color: U.pick(COLORS),
        heart: Math.random() < 0.55,
        alpha: U.randomBetween(0.35, 1)
      };
    }

    function drawHeart(cx, cy, size) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + size * 0.34);
      ctx.bezierCurveTo(cx - size * 1.05, cy - size * 0.55,
                        cx - size * 0.5, cy - size * 1.25, cx, cy - size * 0.35);
      ctx.bezierCurveTo(cx + size * 0.5, cy - size * 1.25,
                        cx + size * 1.05, cy - size * 0.55, cx, cy + size * 0.34);
      ctx.fill();
    }

    function drawStar(cx, cy, size) {
      ctx.beginPath();
      for (var i = 0; i < 5; i++) {
        var a1 = -Math.PI / 2 + i * U.TAU / 5;
        var a2 = a1 + U.TAU / 10;
        var r1 = size;
        var r2 = size * 0.44;
        if (i === 0) ctx.moveTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
        else ctx.lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
        ctx.lineTo(cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2);
      }
      ctx.closePath();
      ctx.fill();
    }

    function render() {
      ctx.clearRect(0, 0, view.width, view.height);

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        ctx.globalAlpha = p.alpha * cfg.opacity;
        ctx.fillStyle = p.color;
        var x = p.x + Math.sin(p.phase) * p.sway;
        if (p.heart) drawHeart(x, p.y, p.size);
        else drawStar(x, p.y, p.size);
      }

      ctx.globalAlpha = 1;
    }

    function frame(now) {
      if (!running) return;

      var dt = Math.min((now - lastTime) / 1000, 0.05) || 0;
      lastTime = now;

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.y += p.speed * dt;
        p.phase += dt * 1.1;
        if (p.y > view.height + 30) particles[i] = spawn(false);
      }

      render();
      rafId = global.requestAnimationFrame(frame);
    }

    function start() {
      if (running || reduced) return;
      running = true;
      lastTime = 0;
      rafId = global.requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (rafId) global.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function init() {
      particles = [];
      for (var i = 0; i < cfg.count; i++) particles.push(spawn(true));
      render();
      start();
    }

    global.addEventListener('resize', function () {
      view = fitCanvas(canvas);
      ctx = view.ctx;
      init();
    });

    init();

    return { start: start, stop: stop };
  }

  /* ────────────────────────────────────────────────────────────
     彩带：中奖爆发
     ──────────────────────────────────────────────────────────── */
  function createConfetti(canvas) {
    var view = fitCanvas(canvas);
    var ctx = view.ctx;
    var pieces = [];
    var rafId = 0;
    var running = false;
    var lastTime = 0;

    global.addEventListener('resize', function () {
      view = fitCanvas(canvas);
      ctx = view.ctx;
    });

    function spawnBurst() {
      var originX = view.width / 2;
      var originY = view.height * 0.42;
      var total = U.prefersReducedMotion() ? 24 : 90;

      for (var i = 0; i < total; i++) {
        var angle = U.randomBetween(-Math.PI, 0) + U.randomBetween(-0.35, 0.35);
        var speed = U.randomBetween(320, 780);
        pieces.push({
          x: originX + U.randomBetween(-40, 40),
          y: originY + U.randomBetween(-20, 20),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          w: U.randomBetween(5, 10),
          h: U.randomBetween(8, 16),
          rot: U.randomBetween(0, U.TAU),
          vr: U.randomBetween(-9, 9),
          color: U.pick(COLORS),
          life: 1
        });
      }
    }

    function frame(now) {
      if (!running) return;

      var dt = Math.min((now - lastTime) / 1000, 0.05) || 0;
      lastTime = now;

      ctx.clearRect(0, 0, view.width, view.height);

      var alive = 0;

      for (var i = 0; i < pieces.length; i++) {
        var p = pieces[i];
        if (p.life <= 0) continue;

        p.vy += 1250 * dt;      // 重力
        p.vx *= 0.992;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.life -= dt * 0.42;

        if (p.life <= 0 || p.y > view.height + 60) { p.life = 0; continue; }

        alive++;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (alive === 0) {
        running = false;
        pieces = [];
        ctx.clearRect(0, 0, view.width, view.height);
        return;
      }

      rafId = global.requestAnimationFrame(frame);
    }

    return {
      burst: function () {
        spawnBurst();
        if (running) return;
        running = true;
        lastTime = 0;
        rafId = global.requestAnimationFrame(frame);
      }
    };
  }

  App.createBackground = createBackground;
  App.createConfetti = createConfetti;
})(window);
