/* ==========================================================================
   图标库：统一线性 SVG（24×24，stroke 1.8，currentColor）
   用法：XYIcons.get('close', 18)
   ========================================================================== */
(function (root) {
  'use strict';

  var P = {
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    cross: '<path d="M6 6l12 12M18 6L6 18"/>',
    speaker: '<path d="M4 9.5v5h3.2L12 19V5L7.2 9.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a8 8 0 0 1 0 11"/>',
    heart: '<path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20z"/>',
    book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5A1.5 1.5 0 0 0 20 18.5z"/>',
    pencil: '<path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4 16.5z"/><path d="M14.5 6.5 17.5 9.5"/>',
    medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8.5 10 6 3h12l-2.5 7"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5.5v1.5A3 3 0 0 0 8 9.5"/><path d="M16 5h2.5v1.5A3 3 0 0 1 16 9.5"/><path d="M12 13v4M9 20h6"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
    sprout: '<path d="M12 20v-7"/><path d="M12 13c0-3.5-2.5-6-6-6 0 3.5 2.5 6 6 6z"/><path d="M12 11c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6z"/>',
    flame: '<path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 1.5.8 2.4 1.6 2.4 1 0 1.4-.8 1.4-2 0-1.8-1-3.4-1-4.9z"/>',
    bolt: '<path d="M13 3 5.5 13.5H11l-1 7.5 8-11H12z"/>',
    books: '<path d="M4 4.5h4v15H4zM10 4.5h4v15h-4z"/><path d="M16.5 5.5l3.5 14"/>',
    star: '<path d="m12 4 2.4 5.2 5.6.7-4.1 3.9 1 5.6L12 16.7 7.1 19.4l1-5.6L4 9.9l5.6-.7z"/>',
    flag: '<path d="M6 3v18"/><path d="M6 4.5h11l-2 4 2 4H6"/>',
    map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    arrowRight: '<path d="M5 12h13M13 6l6 6-6 6"/>',
    tile: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    hand: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M15 11V6.5a1.5 1.5 0 0 1 3 0V13a6 6 0 0 1-6 6h-1.2a5 5 0 0 1-3.9-1.9L5 14.5a1.6 1.6 0 0 1 2.4-2.1L9 14"/>',
    leaf: '<path d="M20 4C10 4 4 9 4 16v4"/><path d="M20 4c0 8-5 12-12 12h-4"/>',
    party: '<path d="M4 20 9 8l7 7z"/><path d="M14 4l1 2M18 6l1.5-1.5M16.5 9.5 18 10"/>',
    frown: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 15.5a4.5 4.5 0 0 1 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>'
  };

  function get(name, size) {
    var d = P[name];
    if (!d) return '';
    var s = size || 20;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  root.XYIcons = { get: get, names: Object.keys(P) };
  /* ---------------- 自动注入：把 data-icon 变成 SVG ---------------- */
  function hydrate(root) {
    var scope = root || document;
    var list = scope.querySelectorAll ? scope.querySelectorAll("[data-icon]") : [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.getAttribute("data-icon-done") === "1") continue;
      var name = el.getAttribute("data-icon");
      var size = el.getAttribute("data-size") || 20;
      el.innerHTML = get(name, size);
      el.setAttribute("data-icon-done", "1");
    }
  }

  root.XYIcons.hydrate = hydrate;

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () {
      hydrate();
      /* 动态渲染的内容（闯关题目、结算页等）自动补齐 */
      try {
        var mo = new MutationObserver(function (muts) {
          for (var i = 0; i < muts.length; i++) {
            var added = muts[i].addedNodes;
            for (var j = 0; j < added.length; j++) {
              var n = added[j];
              if (n.nodeType !== 1) continue;
              if (n.hasAttribute && n.hasAttribute("data-icon")) hydrate(n.parentNode || document);
              else if (n.querySelector && n.querySelector("[data-icon]")) hydrate(n);
            }
          }
        });
        mo.observe(document.body, { childList: true, subtree: true });
      } catch (e) { }
    });
  }
})(typeof self !== 'undefined' ? self : this);
