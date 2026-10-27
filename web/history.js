/*
 * What the person opened from Free My TV's cards, kept in localStorage (fmtv.history), up to 50.
 * Trakt can't see Netflix/Prime/Max/Disney on the TV; this is what fills Explore for those apps.
 */
var History = (function () {
  'use strict';
  var KEY = 'fmtv.history', MAX = 50;

  function load() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY));
      return a && a.length ? a : [];
    } catch (e) { return []; }
  }

  function save(a) {
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {}
  }

  /** Record a card the person opened. kind: "movie"|"tv", id: TMDB id, app: Free My TV service key or "". */
  function record(kind, id, app) {
    if (!kind || !id) return;
    var a = load(), i, out = [];
    for (i = 0; i < a.length; i++) {
      if (!(a[i].kind === kind && a[i].id === id)) out.push(a[i]);
    }
    out.unshift({kind: kind, id: id, app: app || '', at: Date.now()});
    if (out.length > MAX) out = out.slice(0, MAX);
    save(out);
  }

  /** Newest first. Each item: {kind, id, app, at}. */
  function list() { return load(); }

  function clear() { save([]); }

  return {record: record, list: list, clear: clear};
})();
