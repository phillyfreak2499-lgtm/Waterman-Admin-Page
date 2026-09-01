/*
 * Quad score bridge — loaded by every Quad game.
 *
 * The games keep their results in localStorage with their own keys and shapes.
 * This bridge (running inside the game, same origin as the app) reports two
 * things to the parent COGS window via postMessage, which the GameFrame relays
 * to the server so a Specialist's Locker can show their Quad activity:
 *
 *   { type: 'cogs:quad', slug, opened: true }  on load        -> counts a play
 *   { type: 'cogs:quad', slug, score: <int> }  on leave/hide  -> best/last score
 *
 * A game can also report explicitly at any time: window.QuadScore.report(123).
 *
 * Everything is best-effort and wrapped so it can never throw into or slow down
 * the game. If a game persists nothing recognizable, only the play is recorded.
 */
(function () {
  "use strict";
  var slug = "";
  try {
    var m = String(location.pathname).match(/\/games\/([a-z0-9-]+)\.html$/i);
    slug = m ? m[1] : "";
  } catch (e) {}
  if (!slug) return;

  var ORIGIN = location.origin;
  function post(payload) {
    try {
      (window.parent || window).postMessage(
        Object.assign({ type: "cogs:quad", slug: slug }, payload),
        ORIGIN,
      );
    } catch (e) {}
  }

  // NOTE: this bridge used to guess a score by scanning every localStorage key
  // the game had changed for anything matching /score|best|high|xp|.../ and
  // reporting the maximum. That was wrong in two ways: some games persist a
  // whole high-score TABLE, so the max could be a previous learner's best on a
  // shared store tablet, reported as the current user's; and three games write
  // no storage at all, so they could never produce a score. Games now report
  // explicitly via QuadScore.report() at the end of a run.

  var lastSent = null;
  // Insurance only: re-post the score the game already reported, in case the
  // first postMessage raced the parent unmounting its listener on the way out.
  // The server upserts, so a duplicate is harmless.
  function sync() {
    if (lastSent == null) return;
    post({ score: lastSent });
  }

  // Explicit API for games that want to report a precise score.
  window.QuadScore = {
    report: function (score) {
      var n = Number(score);
      if (isFinite(n) && n >= 0 && n <= 1e9) {
        lastSent = n;
        post({ score: Math.round(n) });
      }
    },
  };

  // Count the play once the game has loaded.
  if (document.readyState === "complete" || document.readyState === "interactive") {
    post({ opened: true });
  } else {
    window.addEventListener("DOMContentLoaded", function () {
      post({ opened: true });
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") sync();
  });
  window.addEventListener("pagehide", sync);

  // --- content-height reporting ---
  // Mobile browsers often refuse to scroll INSIDE an iframe (the gesture chains
  // to the parent page instead), so games taller than the frame were
  // unreachable. The parent fixes this by owning the scrollbar: it sizes the
  // iframe to the game's real content height and scrolls a wrapper. We report
  // that height here on load, resize, and DOM changes.
  //
  // Guard against feedback loops (games sized with 100vh track the iframe
  // height, which we just changed): only report when the height moved by more
  // than a small threshold since the last report.
  var lastHeight = 0;
  function reportHeight() {
    try {
      var doc = document.documentElement;
      var body = document.body;
      var h = Math.max(
        doc ? doc.scrollHeight : 0,
        body ? body.scrollHeight : 0,
      );
      if (!isFinite(h) || h <= 0) return;
      h = Math.min(h, 20000);
      if (Math.abs(h - lastHeight) <= 8) return;
      lastHeight = h;
      post({ height: Math.ceil(h) });
    } catch (e) {}
  }
  var heightTimer = null;
  function queueHeight() {
    if (heightTimer) return;
    heightTimer = setTimeout(function () {
      heightTimer = null;
      reportHeight();
    }, 120);
  }
  window.addEventListener("load", queueHeight);
  window.addEventListener("resize", queueHeight);
  if (document.readyState === "complete" || document.readyState === "interactive") {
    queueHeight();
  } else {
    window.addEventListener("DOMContentLoaded", queueHeight);
  }
  try {
    if (window.ResizeObserver && document.body) {
      new ResizeObserver(queueHeight).observe(document.body);
    }
  } catch (e) {}
  try {
    if (window.MutationObserver) {
      new MutationObserver(queueHeight).observe(
        document.documentElement,
        { childList: true, subtree: true },
      );
    }
  } catch (e) {}
})();
