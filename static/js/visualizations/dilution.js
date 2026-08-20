/*
 * Solution dilution (AP Chemistry, Unit 3).
 *
 * Registers the "dilution" ChemViz widget. Vanilla JS + native SVG.
 *
 *   M1 V1 = M2 V2
 *
 * The point the equation makes is that diluting adds solvent, never solute, so
 * both beakers are drawn with the *same solute dots in the same relative
 * positions* -- only the liquid column they are spread through changes. Watching
 * a fixed number of dots thin out as the column grows is the whole lesson.
 *
 * SVG rather than Canvas: nothing here animates, so there is no reason to take
 * on a render loop.
 */
(function (window, document) {
  "use strict";

  if (!window.ChemViz) return;

  /* ------------------------------------------------------------------ *
   * Chemistry
   * ------------------------------------------------------------------ */

  /* Moles of solute are fixed by the aliquot; only the volume changes. */
  function solve(m1, v1Ml, v2Ml) {
    var moles = m1 * (v1Ml / 1000);
    var m2 = v2Ml > 0 ? (m1 * v1Ml) / v2Ml : 0;
    return {
      m1: m1, v1: v1Ml,
      m2: m2, v2: v2Ml,
      moles: moles,
      dilutionFactor: v1Ml > 0 ? v2Ml / v1Ml : 1,
      waterAdded: v2Ml - v1Ml
    };
  }

  /* ------------------------------------------------------------------ *
   * Deterministic dot layout
   *
   * A seeded generator, not Math.random: the dots must keep their relative
   * positions as the sliders move, otherwise the two beakers look like
   * different samples instead of the same solute in more water.
   * ------------------------------------------------------------------ */

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var MAX_DOTS = 90;
  var LAYOUT = (function () {
    var rand = mulberry32(20240617);
    var pts = [];
    for (var i = 0; i < MAX_DOTS; i++) pts.push({ u: rand(), v: rand() });
    return pts;
  })();

  function dotCount(moles) {
    return Math.max(8, Math.min(MAX_DOTS, Math.round(moles * 900)));
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  var V_SCALE_MAX = 150;   // mL mapped to a full beaker

  var LAYOUTS = {
    wide: { w: 520, h: 300, font: 12, bx: [70, 300], bw: 150, top: 40, bottom: 268 },
    compact: { w: 340, h: 280, font: 12, bx: [30, 190], bw: 120, top: 36, bottom: 250 }
  };

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtM(m) { return m >= 1 ? m.toFixed(2) : m.toFixed(3); }

  function beakerMarkup(L, x, volumeMl, dots, caption, subcaption) {
    var innerH = L.bottom - L.top;
    var h = Math.max(4, (volumeMl / V_SCALE_MAX) * innerH);
    var liquidTop = L.bottom - h;
    var parts = [];

    parts.push('<rect class="chem-dilution__liquid" x="' + (x + 2) + '" y="' + liquidTop +
      '" width="' + (L.bw - 4) + '" height="' + h + '"/>');

    // Solute dots spread through the liquid column only.
    for (var i = 0; i < dots; i++) {
      var p = LAYOUT[i];
      var cx = x + 8 + p.u * (L.bw - 16);
      var cy = liquidTop + 5 + p.v * Math.max(h - 10, 1);
      parts.push('<circle class="chem-dilution__solute" cx="' + cx.toFixed(1) +
        '" cy="' + cy.toFixed(1) + '" r="3.2"/>');
    }

    // Glass drawn over the liquid so the rim stays visible.
    parts.push('<path class="chem-dilution__glass" d="M' + x + " " + L.top +
      " L" + x + " " + (L.bottom - 8) + " Q" + x + " " + L.bottom + " " + (x + 8) +
      " " + L.bottom + " L" + (x + L.bw - 8) + " " + L.bottom + " Q" + (x + L.bw) +
      " " + L.bottom + " " + (x + L.bw) + " " + (L.bottom - 8) + " L" + (x + L.bw) +
      " " + L.top + '"/>');

    parts.push('<text class="chem-dilution__caption" x="' + (x + L.bw / 2) + '" y="' +
      (L.top - 20) + '" text-anchor="middle">' + escapeAttr(caption) + "</text>");
    parts.push('<text class="chem-dilution__sub" x="' + (x + L.bw / 2) + '" y="' +
      (L.top - 6) + '" text-anchor="middle">' + escapeAttr(subcaption) + "</text>");
    return parts.join("");
  }

  function diagramMarkup(s, L) {
    var dots = dotCount(s.moles);
    var parts = [];

    parts.push(beakerMarkup(L, L.bx[0], s.v1, dots,
      "Before", fmtM(s.m1) + " M · " + s.v1.toFixed(0) + " mL"));
    parts.push(beakerMarkup(L, L.bx[1], s.v2, dots,
      "After", fmtM(s.m2) + " M · " + s.v2.toFixed(0) + " mL"));

    // Arrow between the beakers, labelled with the water actually added.
    var ax = L.bx[0] + L.bw + 12;
    var aw = L.bx[1] - ax - 12;
    var ay = (L.top + L.bottom) / 2;
    if (aw > 24) {
      parts.push('<line class="chem-dilution__arrow" x1="' + ax + '" y1="' + ay +
        '" x2="' + (ax + aw - 8) + '" y2="' + ay + '"/>');
      parts.push('<path class="chem-dilution__arrow-head" d="M' + (ax + aw) + " " + ay +
        " L" + (ax + aw - 9) + " " + (ay - 5) + " L" + (ax + aw - 9) + " " + (ay + 5) + 'Z"/>');
      parts.push('<text class="chem-dilution__sub" x="' + (ax + aw / 2) + '" y="' +
        (ay - 10) + '" text-anchor="middle">+ ' + s.waterAdded.toFixed(0) + " mL</text>");
      parts.push('<text class="chem-dilution__sub" x="' + (ax + aw / 2) + '" y="' +
        (ay + 20) + '" text-anchor="middle">water</text>');
    }

    parts.push('<text class="chem-dilution__note" x="' + (L.w / 2) + '" y="' + (L.h - 6) +
      '" text-anchor="middle">Same ' + dots + " solute particles in both beakers</text>");

    return '<svg class="chem-dilution__diagram" viewBox="0 0 ' + L.w + " " + L.h +
      '" style="font-size:' + L.font + 'px" role="img" aria-label="' +
      escapeAttr("Two beakers. Before: " + fmtM(s.m1) + " molar in " + s.v1.toFixed(0) +
        " millilitres. After adding " + s.waterAdded.toFixed(0) + " millilitres of water: " +
        fmtM(s.m2) + " molar in " + s.v2.toFixed(0) + " millilitres. Both contain the same " +
        "amount of solute.") + '">' + parts.join("") + "</svg>";
  }

  /* ------------------------------------------------------------------ *
   * Widget
   * ------------------------------------------------------------------ */

  function num(value, fallback) {
    var n = parseFloat(value);
    return isFinite(n) ? n : fallback;
  }

  ChemViz.register("dilution", function (el, options) {
    var defaults = {
      m1: num(options.stockMolarity, 1),
      v1: num(options.aliquotMl, 25),
      v2: num(options.finalMl, 100)
    };

    el.className = "chem-widget chem-dilution";
    el.innerHTML =
      '<div class="chem-widget__header">' +
        "<h4>Dilution: M₁V₁ = M₂V₂</h4>" +
        "<p>Diluting adds solvent, never solute. Both beakers hold the same " +
        "particles — only the volume they are spread through changes.</p>" +
      "</div>" +
      '<div class="chem-widget__visual">' +
        '<div class="chem-dilution__diagram-pane" data-ref="diagram"></div>' +
      "</div>" +
      '<div class="chem-widget__controls">' +
        '<div class="chem-widget__control">' +
          '<label data-ref="m1Label">Stock concentration M₁ ' +
            '<span class="chem-widget__control-value" data-ref="m1Value" aria-hidden="true"></span>' +
          "</label>" +
          '<input type="range" class="chem-widget__slider" data-ref="m1" min="0.25" max="2" step="0.05">' +
        "</div>" +
        '<div class="chem-widget__control">' +
          '<label data-ref="v1Label">Volume taken V₁ ' +
            '<span class="chem-widget__control-value" data-ref="v1Value" aria-hidden="true"></span>' +
          "</label>" +
          '<input type="range" class="chem-widget__slider" data-ref="v1" min="10" max="50" step="1">' +
        "</div>" +
        '<div class="chem-widget__control">' +
          '<label data-ref="v2Label">Diluted to V₂ ' +
            '<span class="chem-widget__control-value" data-ref="v2Value" aria-hidden="true"></span>' +
          "</label>" +
          '<input type="range" class="chem-widget__slider" data-ref="v2" min="25" max="150" step="1">' +
        "</div>" +
      "</div>" +
      '<div class="chem-widget__status">' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">M₂</span>' +
          '<span class="chem-widget__stat-value" data-ref="statM2"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Moles solute</span>' +
          '<span class="chem-widget__stat-value" data-ref="statMol"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Dilution factor</span>' +
          '<span class="chem-widget__stat-value" data-ref="statFactor"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Water added</span>' +
          '<span class="chem-widget__stat-value" data-ref="statWater"></span></div>' +
      "</div>" +
      '<p class="chem-widget__explanation" data-ref="explanation" aria-live="polite"></p>' +
      '<div class="chem-dilution__actions">' +
        '<button type="button" class="chem-widget__btn" data-ref="reset">Reset</button>' +
      "</div>";

    var ref = {};
    var nodes = el.querySelectorAll("[data-ref]");
    for (var i = 0; i < nodes.length; i++) ref[nodes[i].getAttribute("data-ref")] = nodes[i];

    var uid = "chem-dil-" + Math.random().toString(36).slice(2, 8);
    [["m1", "m1Label"], ["v1", "v1Label"], ["v2", "v2Label"]].forEach(function (pair) {
      ref[pair[0]].id = uid + "-" + pair[0];
      ref[pair[1]].setAttribute("for", uid + "-" + pair[0]);
    });

    var layoutKey = null;

    /* You cannot dilute into a smaller volume, so V2's floor tracks V1. */
    function syncBounds() {
      var v1 = num(ref.v1.value, 25);
      var min = Math.max(25, Math.ceil(v1));
      ref.v2.min = String(min);
      if (num(ref.v2.value, min) < min) ref.v2.value = String(min);
    }

    function current() {
      syncBounds();
      return solve(num(ref.m1.value, 1), num(ref.v1.value, 25), num(ref.v2.value, 100));
    }

    function explain(s) {
      if (s.waterAdded <= 0) {
        return "No water has been added yet, so M₂ = M₁. Increase V₂ to dilute.";
      }
      return "M₁V₁ = M₂V₂ rearranges to M₂ = M₁V₁ / V₂ = (" + fmtM(s.m1) + " × " +
        s.v1.toFixed(0) + ") / " + s.v2.toFixed(0) + " = " + fmtM(s.m2) + " M. " +
        "The " + (s.moles * 1000).toFixed(1) + " mmol of solute never changes — adding " +
        s.waterAdded.toFixed(0) + " mL of water spreads the same particles through " +
        s.dilutionFactor.toFixed(1) + "× the volume, so the concentration falls by the " +
        "same factor.";
    }

    function render(commit) {
      var s = current();

      ref.m1Value.textContent = fmtM(s.m1) + " M";
      ref.v1Value.textContent = s.v1.toFixed(0) + " mL";
      ref.v2Value.textContent = s.v2.toFixed(0) + " mL";

      ref.statM2.textContent = fmtM(s.m2) + " M";
      ref.statMol.textContent = (s.moles * 1000).toFixed(1) + " mmol";
      ref.statFactor.textContent = s.dilutionFactor.toFixed(1) + "×";
      ref.statWater.textContent = s.waterAdded.toFixed(0) + " mL";

      ref.m1.setAttribute("aria-valuetext", fmtM(s.m1) + " molar stock");
      ref.v1.setAttribute("aria-valuetext", s.v1.toFixed(0) + " millilitres taken");
      ref.v2.setAttribute("aria-valuetext",
        s.v2.toFixed(0) + " millilitres final, giving " + fmtM(s.m2) + " molar");

      ref.diagram.innerHTML = diagramMarkup(s, LAYOUTS[layoutKey]);
      if (commit) ref.explanation.textContent = explain(s);
    }

    function onInput() { render(false); }
    function onChange() { render(true); }

    function applyDefaults() {
      ref.m1.value = String(defaults.m1);
      ref.v1.value = String(defaults.v1);
      ref.v2.value = String(defaults.v2);
      render(true);
    }

    function onReset() { applyDefaults(); ref.m1.focus(); }

    var mq = window.matchMedia ? window.matchMedia("(max-width: 560px)") : null;

    function onLayoutChange() {
      var key = mq && mq.matches ? "compact" : "wide";
      if (key === layoutKey) return;
      layoutKey = key;
      render(false);
    }

    ["m1", "v1", "v2"].forEach(function (k) {
      ref[k].addEventListener("input", onInput);
      ref[k].addEventListener("change", onChange);
    });
    ref.reset.addEventListener("click", onReset);
    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", onLayoutChange);
      else if (mq.addListener) mq.addListener(onLayoutChange);
    }

    layoutKey = mq && mq.matches ? "compact" : "wide";
    applyDefaults();

    return function cleanup() {
      ["m1", "v1", "v2"].forEach(function (k) {
        ref[k].removeEventListener("input", onInput);
        ref[k].removeEventListener("change", onChange);
      });
      ref.reset.removeEventListener("click", onReset);
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener("change", onLayoutChange);
        else if (mq.removeListener) mq.removeListener(onLayoutChange);
      }
      ref = null;
    };
  });
})(window, document);
