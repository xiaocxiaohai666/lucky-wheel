/* ============================================================================
   ui.js — 面板交互层
   数据改动只走 store，转盘只走 wheel；本文件负责把两者和 DOM 缝在一起。
   ============================================================================ */
(function (global) {
  'use strict';

  var App = global.CuteWheel;
  var U = App.util;

  var SOUND_KEY = 'cute-wheel.sound.v1';
  var WIN_EMOJI = ['🎉', '💖', '✨', '🍀', '🌟', '🎀', '🍭'];

  var REASON_TEXT = {
    empty: '先写点什么呀～',
    max: '装满啦，先删一个吧～',
    dup: '这个已经有啦～',
    min: '至少要留 2 个选项哦',
    missing: '这个选项不见了'
  };

  function createUI(deps) {
    var cfg = deps.config;
    var store = deps.store;
    var wheel = deps.wheel;
    var sfx = deps.sfx;
    var confetti = deps.confetti;

    var els = {};
    var toastTimer = 0;
    var highlightId = null;
    var dialogOpen = false;

    /* ── 小工具 ───────────────────────────────────────────── */

    function $(id) { return document.getElementById(id); }

    function toast(message) {
      if (!els.toast) return;
      els.toast.textContent = message;
      els.toast.classList.add('is-show');

      global.clearTimeout(toastTimer);
      toastTimer = global.setTimeout(function () {
        els.toast.classList.remove('is-show');
      }, 1800);
    }

    function shake(el) {
      if (!el) return;
      el.classList.remove('is-shake');
      // 强制重排，让动画能重新播放
      void el.offsetWidth;
      el.classList.add('is-shake');
      global.setTimeout(function () { el.classList.remove('is-shake'); }, 420);
    }

    /* ── 标题逐字弹入 ─────────────────────────────────────── */

    function animateTitle(text) {
      if (!els.title) return;
      els.title.textContent = '';

      for (var i = 0; i < text.length; i++) {
        var span = document.createElement('span');
        span.textContent = text[i];
        span.style.setProperty('--i', String(i));
        els.title.appendChild(span);
      }
    }

    /* ── 列表 ─────────────────────────────────────────────── */

    function renderList() {
      if (!els.list) return;

      var items = store.getItems();
      var palette = cfg.palette;

      els.list.textContent = '';

      if (!items.length) {
        var empty = document.createElement('li');
        empty.className = 'list__empty';
        empty.textContent = '空空如也，加点想法吧';
        els.list.appendChild(empty);
        return;
      }

      items.forEach(function (item, index) {
        var color = palette[index % palette.length];

        var li = document.createElement('li');
        li.className = 'list__item';
        li.dataset.id = item.id;
        li.style.setProperty('--dot', color.bg);

        if (item.id === highlightId) {
          li.classList.add('is-new');
          highlightId = null;
        }

        var dot = document.createElement('span');
        dot.className = 'list__dot';

        var label = document.createElement('span');
        label.className = 'list__label';
        label.textContent = item.label;
        label.title = item.label;

        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'list__del';
        del.dataset.id = item.id;
        del.setAttribute('aria-label', '删除 ' + item.label);
        del.textContent = '\u00d7';

        li.appendChild(dot);
        li.appendChild(label);
        li.appendChild(del);
        els.list.appendChild(li);
      });
    }

    function updateCounter() {
      if (!els.counter) return;
      els.counter.textContent = store.count() + ' 个' + (store.canAdd() ? '' : ' · 满了');
    }

    /** 输入框的可用状态跟着数据走，不要在添加/删除里各写一遍 */
    function syncInputState() {
      if (!els.input) return;
      var full = !store.canAdd();
      els.input.disabled = full;
      els.input.setAttribute('placeholder', full ? '已经装满啦' : '添加一个选项…');
    }

    function syncWheel() {
      wheel.setItems(store.getItems());
      updateCounter();
      syncInputState();
    }

    /* ── 增删 ─────────────────────────────────────────────── */

    function submitAdd() {
      var value = els.input ? els.input.value : '';
      var result = store.add(value);

      if (!result.ok) {
        toast(REASON_TEXT[result.reason] || '加不进去呢');
        shake(els.input);
        sfx.pop();
        return;
      }

      highlightId = result.item.id;
      if (els.input) els.input.value = '';
      renderList();
      sfx.pop();
    }

    function handleRemove(id) {
      var result = store.remove(id);

      if (!result.ok) {
        toast(REASON_TEXT[result.reason] || '删不掉呢');
        return;
      }

      renderList();
      sfx.pop();
    }

    /* ── 旋转 ─────────────────────────────────────────────── */

    function requestSpin() {
      if (dialogOpen) return;
      if (wheel.isSpinning()) return;

      if (store.count() < cfg.minItems) {
        toast('先加两个选项吧');
        return;
      }

      sfx.wake();
      wheel.spin();
    }

    function setSpinningUI(on) {
      if (els.wheelWrap) els.wheelWrap.classList.toggle('is-spinning', on);
      if (els.spinBtn) els.spinBtn.disabled = on;
      if (els.spinLabel) els.spinLabel.textContent = on ? '转…' : '转一下';
    }

    /* ── 结果弹窗 ─────────────────────────────────────────── */

    function openResult(item) {
      if (!els.dialog) return;

      dialogOpen = true;
      els.dialogResult.textContent = item.label;
      els.dialogEmoji.textContent = U.pick(WIN_EMOJI);
      els.dialog.hidden = false;

      global.requestAnimationFrame(function () {
        els.dialog.classList.add('is-open');
      });

      global.setTimeout(function () {
        if (els.dialogOk) els.dialogOk.focus();
      }, 160);

      confetti.burst();
      sfx.win();
    }

    function closeResult() {
      if (!els.dialog || !dialogOpen) return;

      dialogOpen = false;
      els.dialog.classList.remove('is-open');

      global.setTimeout(function () {
        if (!dialogOpen) els.dialog.hidden = true;
      }, 280);

      if (els.spinBtn) els.spinBtn.focus();
    }

    /* ── 音效开关 ─────────────────────────────────────────── */

    function applySoundState(enabled) {
      sfx.setEnabled(enabled);
      U.storage.set(SOUND_KEY, enabled ? '1' : '0');

      if (els.soundBtn) {
        els.soundBtn.textContent = enabled ? '音效 · 开' : '音效 · 关';
        els.soundBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      }
    }

    function toggleSound() {
      var next = !sfx.isEnabled();
      applySoundState(next);
      if (next) sfx.pop();
    }

    /* ── 事件绑定 ─────────────────────────────────────────── */

    function bindEvents() {
      if (els.adder) {
        els.adder.addEventListener('submit', function (event) {
          event.preventDefault();
          submitAdd();
        });
      }

      if (els.list) {
        els.list.addEventListener('click', function (event) {
          var del = event.target.closest ? event.target.closest('.list__del') : null;
          if (!del) return;
          handleRemove(del.dataset.id);
        });
      }

      if (els.spinBtn) {
        els.spinBtn.addEventListener('click', requestSpin);
      }

      if (els.resetBtn) {
        els.resetBtn.addEventListener('click', function () {
          store.reset();
          renderList();
          sfx.pop();
          toast('已经恢复默认选项啦');
        });
      }

      if (els.soundBtn) {
        els.soundBtn.addEventListener('click', toggleSound);
      }

      if (els.dialog) {
        els.dialog.addEventListener('click', function (event) {
          if (event.target.hasAttribute('data-close')) closeResult();
        });
      }

      if (els.dialogOk) {
        els.dialogOk.addEventListener('click', closeResult);
      }

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          closeResult();
          return;
        }

        var isSpace = event.code === 'Space' || event.key === ' ';
        if (!isSpace) return;

        var tag = (event.target && event.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;

        event.preventDefault();
        requestSpin();
      });
    }

    /* ── 初始化 ───────────────────────────────────────────── */

    function init() {
      els = {
        title: $('title'),
        input: $('adderInput'),
        adder: $('adder'),
        list: $('list'),
        counter: $('counter'),
        spinBtn: $('spinBtn'),
        spinLabel: $('spinLabel'),
        wheelWrap: $('wheelWrap'),
        resetBtn: $('resetBtn'),
        soundBtn: $('soundBtn'),
        dialog: $('dialog'),
        dialogResult: $('dialogResult'),
        dialogEmoji: $('dialogEmoji'),
        dialogOk: $('dialogOk'),
        toast: $('toast')
      };

      animateTitle('好运转盘');

      store.subscribe(syncWheel);
      syncWheel();
      renderList();

      var soundSaved = U.storage.get(SOUND_KEY);
      applySoundState(soundSaved === null ? cfg.audio.enabled : soundSaved === '1');

      wheel.on('start', function () { setSpinningUI(true); });
      wheel.on('tick', function () { sfx.tick(); });
      wheel.on('end', function (result) {
        setSpinningUI(false);
        if (result && result.item) openResult(result.item);
      });

      bindEvents();

      /* 原生返回键会先问这里：有层可关就关掉并返回 true，没有才退出应用 */
      global.LuckyWheelApp = {
        dismissOverlay: function () {
          if (dialogOpen) {
            closeResult();
            return true;
          }
          return false;
        }
      };
    }

    return { init: init };
  }

  App.createUI = createUI;
})(window);
