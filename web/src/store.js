/* ============================================================================
   store.js — 单一数据源：选项的增删改、持久化、变更广播
   UI 与 Canvas 都只读它的快照，不各自维护状态。
   ============================================================================ */
(function (global) {
  'use strict';

  var App = global.CuteWheel;
  var U = App.util;

  function createStore(options) {
    var cfg = options.config;
    var listeners = [];
    var items = readFromStorage();

    /* ── 持久化 ───────────────────────────────────────────── */

    function makeItem(label) {
      return { id: U.uid(), label: label };
    }

    /** 把任意来源的数据洗成合法列表；洗不干净就返回 null */
    function sanitize(raw) {
      if (!raw || !Array.isArray(raw)) return null;

      var out = [];
      var seen = Object.create(null);

      for (var i = 0; i < raw.length; i++) {
        var entry = raw[i];
        if (!entry || typeof entry.label !== 'string') continue;

        var label = entry.label.trim().slice(0, cfg.maxLabelLength);
        if (!label) continue;

        var id = (typeof entry.id === 'string' && entry.id && !seen[entry.id])
          ? entry.id
          : U.uid();

        seen[id] = true;
        out.push({ id: id, label: label });

        if (out.length >= cfg.maxItems) break;
      }

      return out.length >= cfg.minItems ? out : null;
    }

    function defaults() {
      return cfg.defaults.slice(0, cfg.maxItems).map(makeItem);
    }

    function readFromStorage() {
      var raw = U.storage.get(cfg.storageKey);
      if (!raw) return defaults();

      try {
        return sanitize(JSON.parse(raw)) || defaults();
      } catch (err) {
        return defaults();
      }
    }

    function persist() {
      U.storage.set(cfg.storageKey, JSON.stringify(items));
    }

    /* ── 广播 ─────────────────────────────────────────────── */

    function emit() {
      var snapshot = listeners.slice();
      for (var i = 0; i < snapshot.length; i++) snapshot[i](getItems());
    }

    function commit() {
      persist();
      emit();
    }

    /* ── 对外接口 ─────────────────────────────────────────── */

    function getItems() {
      return items.map(function (item) {
        return { id: item.id, label: item.label };
      });
    }

    function count() { return items.length; }

    function canAdd() { return items.length < cfg.maxItems; }
    function canRemove() { return items.length > cfg.minItems; }

    /**
     * 添加一个选项。
     * @returns {{ok: boolean, reason?: string, item?: object}}
     */
    function add(rawLabel) {
      var label = String(rawLabel == null ? '' : rawLabel).trim();

      if (!label) return { ok: false, reason: 'empty' };
      if (!canAdd()) return { ok: false, reason: 'max' };

      label = label.slice(0, cfg.maxLabelLength);

      for (var i = 0; i < items.length; i++) {
        if (items[i].label === label) return { ok: false, reason: 'dup' };
      }

      var item = makeItem(label);
      items.push(item);
      commit();
      return { ok: true, item: item };
    }

    /**
     * 删除一个选项。
     * @returns {{ok: boolean, reason?: string}}
     */
    function remove(id) {
      var index = -1;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) { index = i; break; }
      }
      if (index < 0) return { ok: false, reason: 'missing' };
      if (!canRemove()) return { ok: false, reason: 'min' };

      items.splice(index, 1);
      commit();
      return { ok: true };
    }

    function reset() {
      items = defaults();
      commit();
    }

    function subscribe(fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.push(fn);
      return function unsubscribe() {
        var i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    }

    return {
      getItems: getItems,
      count: count,
      canAdd: canAdd,
      canRemove: canRemove,
      add: add,
      remove: remove,
      reset: reset,
      subscribe: subscribe
    };
  }

  App.createStore = createStore;
})(window);
