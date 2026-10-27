// Recovers from a stale index.html: after a deploy, a page cached from the
// previous build points at /assets files that no longer exist, so the app
// stays blank. When one of those fails to load, drop the service worker and
// its caches and reload once onto the current build.
//
// A plain file in public/, not inline: the CSP doesn't allow inline scripts,
// and this has to run even when the app's own bundle is the file missing.
(function () {
  var KEY = "oplanner.recoveredAt";
  window.addEventListener(
    "error",
    function (e) {
      var t = e.target;
      var url = t && (t.src || t.href);
      if (!url || !/\/assets\//.test(url) || (t.tagName !== "SCRIPT" && t.tagName !== "LINK")) return;
      try {
        // At most once a minute, so a real outage can't loop.
        var last = Number(sessionStorage.getItem(KEY) || 0);
        if (Date.now() - last < 60000) return;
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch (_) {
        return;
      }
      var work = [];
      if (navigator.serviceWorker) {
        work.push(
          navigator.serviceWorker.getRegistrations().then(function (regs) {
            return Promise.all(regs.map(function (r) { return r.unregister(); }));
          })
        );
      }
      if (window.caches) {
        work.push(
          caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) { return caches.delete(k); }));
          })
        );
      }
      Promise.all(work).then(
        function () { location.reload(); },
        function () { location.reload(); }
      );
    },
    true
  );
})();
