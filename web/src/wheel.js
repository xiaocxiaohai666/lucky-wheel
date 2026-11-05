/* ============================================================================
   wheel.js — 转盘渲染与旋转引擎
   职责边界：只管"画"和"转"，不认识 DOM 按钮，也不认识 localStorage。
   外部通过 setItems / spin / on(...) 与之交互。
   ============================================================================ */
(function (global) {
  'use strict';

  var App = global.CuteWheel;
  var U = App.util;
  var TAU = U.TAU;

  var FONT_STACK = '"PingFang SC","Hiragino Sans GB","HanziPen SC","Microsoft YaHei",system-ui,sans-serif';

  /* ── 落点数学：纯函数，不碰 DOM，可单独跑单元测试 ──────────── */
  var math = {
    /**
     * 求"让第 index 个扇区停在顶部指针下"所需的旋转增量。
     * 约定：指针固定在世界角 -π/2（正上方），扇区 i 的本地起点为
     * -π/2 + i * sweep，绘制时整体再叠加 rotation。
     *
     * @param {number} count    扇区数量
     * @param {number} index    目标扇区下标
     * @param {number} rotation 当前旋转角（弧度）
     * @param {number} turns    额外整圈数
     * @param {number} jitter   扇区内抖动，[-1, 1]
     * @returns {{need:number, delta:number, midLocal:number}}
     */
    targetDelta: function (count, index, rotation, turns, jitter) {
      var sweep = TAU / count;
      var midLocal = -Math.PI / 2 + index * sweep + sweep * (0.5 + jitter);
      var need = U.mod(-Math.PI / 2 - midLocal - rotation, TAU);
      return { need: need, delta: turns * TAU + need, midLocal: midLocal };
    },

    /** 指针当前落在第几个扇区（用于音效分格判定） */
    sectorAt: function (rotation, count) {
      var sweep = TAU / count;
      return Math.floor(U.mod(rotation, TAU) / sweep);
    }
  };

  App.wheelMath = math;

  function createWheel(canvas, options) {
    var cfg = options.config;
    var spinCfg = cfg.spin;
    var palette = cfg.palette;
    var ctx = canvas.getContext('2d');

    var items = [];
    var rotation = 0;          // 当前旋转角（弧度，顺时针为正）
    var spinning = false;
    var rafId = 0;
    var observer = null;

    var view = { size: 0, dpr: 1 };

    var listeners = { start: [], tick: [], end: [] };

    function on(name, fn) {
      if (listeners[name] && typeof fn === 'function') listeners[name].push(fn);
      return api;
    }

    function emit(name, payload) {
      var group = listeners[name];
      if (!group) return;
      for (var i = 0; i < group.length; i++) group[i](payload);
    }

    /* ── 尺寸 ─────────────────────────────────────────────── */

    function measure() {
      var rect = canvas.getBoundingClientRect();
      var size = Math.max(160, Math.round(rect.width || canvas.width || 320));
      var dpr = Math.min(global.devicePixelRatio || 1, 2.5);

      view.size = size;
      view.dpr = dpr;

      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      draw();
    }

    /* ── 绘制 ─────────────────────────────────────────────── */

    function drawEmpty() {
      var size = view.size;
      var R = size / 2;

      ctx.beginPath();
      ctx.arc(R, R, R - 2, 0, TAU);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.fillStyle = '#C9B2C0';
      ctx.font = '600 ' + Math.round(size * 0.045) + 'px ' + FONT_STACK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('先加两个选项吧', R, R);
    }

    /** 把超长文字压到可用宽度内，超出用省略号（结果按文本+字体+宽度缓存） */
    var labelCache = Object.create(null);

    function fitLabel(text, maxWidth, font) {
      var key = text + '\u0000' + font + '\u0000' + Math.round(maxWidth);
      var cached = labelCache[key];
      if (cached !== undefined) return cached;

      var result = text;
      ctx.font = font;

      if (ctx.measureText(text).width > maxWidth) {
        var cut = text;
        while (cut.length > 1 && ctx.measureText(cut + '…').width > maxWidth) {
          cut = cut.slice(0, -1);
        }
        result = cut + '…';
      }

      labelCache[key] = result;
      return result;
    }

    function draw() {
      var size = view.size;
      if (!size) return;

      var R = size / 2;

      ctx.clearRect(0, 0, size, size);

      if (items.length < 2) {
        drawEmpty();
        return;
      }

      var n = items.length;
      var sweep = TAU / n;
      var rim = Math.max(7, size * 0.026);        // 外圈宽度
      var discR = R - rim;                        // 扇区半径
      var hubR = R * 0.258;                       // 中心圆（按钮盖在上面）
      var textOuter = discR - Math.max(8, size * 0.022);
      var textMaxWidth = textOuter - hubR - 6;

      ctx.save();
      ctx.translate(R, R);

      /* 底盘 */
      ctx.beginPath();
      ctx.arc(0, 0, R - 1, 0, TAU);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      /* 扇区 */
      ctx.save();
      ctx.rotate(rotation);

      for (var i = 0; i < n; i++) {
        var start = -Math.PI / 2 + i * sweep;
        var end = start + sweep;
        var color = palette[i % palette.length];

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, discR, start, end);
        ctx.closePath();
        ctx.fillStyle = color.bg;
        ctx.fill();

        ctx.lineWidth = Math.max(2, size * 0.0055);
        ctx.strokeStyle = 'rgba(255,255,255,.92)';
        ctx.stroke();
      }

      /* 文字（沿半径，自外向内读）
         字号取两条约束里更小的那条：
           1) 盘面尺寸 —— 大盘字大、小盘字小；
           2) 扇区中部弧宽 —— 扇区越多越窄，字高不能超过弧宽，
              否则相邻扇区的字会挤在一起。
         这样 2 个到 24 个扇区都能自适应，不需要把数量写死。 */
      var fontByRadius = U.clamp(size * 0.062, 11, 34);
      var arcWidth = discR * 0.58 * sweep;
      var fontByArc = arcWidth * 0.72;
      var fontSize = Math.round(U.clamp(Math.min(fontByRadius, fontByArc), 9, 34));
      var font = '800 ' + fontSize + 'px ' + FONT_STACK;

      for (var j = 0; j < n; j++) {
        var mid = -Math.PI / 2 + j * sweep + sweep / 2;
        var ink = palette[j % palette.length].text;

        ctx.save();
        ctx.rotate(mid);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = ink;
        ctx.font = font;

        var label = fitLabel(items[j].label, textMaxWidth, font);
        ctx.fillText(label, textOuter, 0);
        ctx.restore();
      }

      ctx.restore(); // 结束扇区旋转

      /* 中心白盘 */
      ctx.beginPath();
      ctx.arc(0, 0, hubR, 0, TAU);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      /* 外圈白环 */
      ctx.beginPath();
      ctx.arc(0, 0, R - rim / 2, 0, TAU);
      ctx.lineWidth = rim * 0.72;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      /* 外环小圆点装饰 */
      var dotCount = 24;
      var dotR = rim * 0.2;
      for (var d = 0; d < dotCount; d++) {
        var angle = (d / dotCount) * TAU + rotation;
        var px = Math.cos(angle) * (R - rim / 2);
        var py = Math.sin(angle) * (R - rim / 2);

        ctx.beginPath();
        ctx.arc(px, py, dotR, 0, TAU);
        ctx.fillStyle = palette[d % palette.length].bg;
        ctx.fill();
      }

      ctx.restore();
    }

    /* ── 旋转 ─────────────────────────────────────────────── */

    /** 缓动：幂次越大起步越猛、尾段越利落；前 5% 加一点起手缓冲 */
    function ease(t, power) {
      var value = 1 - Math.pow(1 - t, power);
      var ramp = spinCfg.rampIn;

      if (t < ramp && ramp > 0) {
        value *= 0.25 + 0.75 * (t / ramp);
      }
      return value;
    }

    /**
     * 转一次。
     * @returns {Promise<{index:number, item:{id:string,label:string}}|null>}
     */
    function spin() {
      if (spinning || items.length < 2) return Promise.resolve(null);

      spinning = true;

      var n = items.length;
      var sweep = TAU / n;

      /* 落点：扇区随机 + 扇区内再抖一下，避免每次都停在正中 */
      var index = U.randomInt(0, n - 1);
      var turns = U.randomInt(spinCfg.minTurns, spinCfg.maxTurns);
      var jitter = U.randomBetween(-1, 1) * spinCfg.jitterRatio;
      var target = math.targetDelta(n, index, rotation, turns, jitter);
      var delta = target.delta;

      /* 转速随机的三个旋钮：圈数、时长、缓动指数 */
      var duration = U.randomBetween(spinCfg.minDuration, spinCfg.maxDuration);
      var power = U.randomBetween(spinCfg.minPower, spinCfg.maxPower);

      var from = rotation;
      var startedAt = 0;
      var lastSector = null;
      var lastTickAt = 0;

      emit('start', { index: index, turns: turns, duration: duration });

      return new Promise(function (resolve) {
        function step(now) {
          if (!startedAt) startedAt = now;

          var t = U.clamp((now - startedAt) / duration, 0, 1);
          rotation = from + delta * ease(t, power);
          draw();

          /* 指针划格音效：按扇区编号变化触发，并做时间节流 */
          var sector = Math.floor(rotation / sweep);
          if (sector !== lastSector) {
            lastSector = sector;
            if (now - lastTickAt >= spinCfg.tickIntervalMs) {
              lastTickAt = now;
              emit('tick', { t: t });
            }
          }

          if (t < 1) {
            rafId = global.requestAnimationFrame(step);
            return;
          }

          rotation = U.mod(from + delta, TAU);
          draw();
          spinning = false;

          var result = { index: index, item: items[index] };
          emit('end', result);
          resolve(result);
        }

        rafId = global.requestAnimationFrame(step);
      });
    }

    /* ── 对外接口 ─────────────────────────────────────────── */

    function setItems(nextItems) {
      items = Array.isArray(nextItems) ? nextItems.slice() : [];
      draw();
    }

    function isSpinning() { return spinning; }

    function destroy() {
      if (rafId) global.cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
    }

    var api = {
      setItems: setItems,
      spin: spin,
      isSpinning: isSpinning,
      redraw: draw,
      on: on,
      destroy: destroy
    };

    /* 初始化尺寸，并跟随容器变化 */
    if (global.ResizeObserver) {
      observer = new global.ResizeObserver(function () { measure(); });
      observer.observe(canvas);
    } else {
      global.addEventListener('resize', measure);
    }

    measure();

    return api;
  }

  App.createWheel = createWheel;
})(window);
