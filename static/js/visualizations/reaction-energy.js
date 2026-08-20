/*
 * Reaction-coordinate / kinetics diagram (AP Chemistry, Units 5-6).
 *
 * Registers the "reaction-energy" ChemViz widget. Vanilla JS + native SVG only.
 *
 * The energetics live in solve() and are deliberately DOM-free: the curve, the
 * arrows, the stat tiles and the explanation all read from that one result, so
 * the diagram can never disagree with the numbers beside it.
 */
(function (window, document) {
  "use strict";

  if (!window.ChemViz) return;

  /* ------------------------------------------------------------------ *
   * Energetics
   * ------------------------------------------------------------------ */

  /*
   * Energies are measured from the reactant level: reactants sit at 0, products
   * at dH, the transition state at Ea above the reactants.
   *
   * Both barriers (forward Ea, reverse Ea - dH) must stay positive, so the
   * transition state can never drop below the higher of the two endpoints. A
   * catalyst therefore acts on the barrier *above that endpoint*:
   *
   *   base   = max(0, dH)                 the higher endpoint
   *   Ea_cat = base + (Ea - base) * (1 - effectiveness)
   *
   * That keeps Ea_cat > base for any effectiveness below 100 %, in both
   * directions, while leaving dH completely untouched -- which is the whole
   * point of the widget.
   */
  function solve(input) {
    var dH = input.dH;
    var base = Math.max(0, dH);
    var eaF = Math.max(input.ea, base + 5);
    var eff = Math.max(0, Math.min(0.8, input.catalyst));
    var eaFCat = base + (eaF - base) * (1 - eff);

    return {
      dH: dH,
      catalyst: eff,
      eaF: eaF,                 // forward barrier, uncatalysed
      eaR: eaF - dH,            // reverse barrier, uncatalysed
      eaFCat: eaFCat,           // forward barrier on the catalysed path
      eaRCat: eaFCat - dH,      // reverse barrier on the catalysed path
      peak: eaF,                // highest point drawn (uncatalysed transition state)
      peakActive: eaFCat,       // transition state of the path in effect
      type: dH < 0 ? "Exothermic" : (dH > 0 ? "Endothermic" : "Thermoneutral")
    };
  }

  /* ------------------------------------------------------------------ *
   * Formatting
   * ------------------------------------------------------------------ */

  function fmt(x) {
    var r = Math.round(x);
    return (Object.is(r, -0) ? 0 : r) + "";
  }

  function signed(x) {
    var r = Math.round(x);
    return (r > 0 ? "+" : "") + fmt(r);
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ------------------------------------------------------------------ *
   * Diagram geometry / rendering
   * ------------------------------------------------------------------ */

  var LAYOUTS = {
    wide: { w: 520, h: 340, top: 18, right: 18, bottom: 46, left: 64, font: 12 },
    compact: { w: 340, h: 300, top: 16, right: 12, bottom: 42, left: 50, font: 13 }
  };

  /* Snap the energy axis to 50 kJ/mol steps so it does not jitter while dragging. */
  function axisFor(s) {
    var lo = Math.min(0, s.dH) - 25;
    var hi = s.peak + 25;
    return { min: Math.floor(lo / 50) * 50, max: Math.ceil(hi / 50) * 50 };
  }

  /*
   * Reaction coordinate runs 0-100 (a qualitative axis, so it carries no ticks).
   * Flat reactant shelf, smooth hump to the transition state, flat product shelf.
   * The control points next to the peak are horizontal, giving a rounded top.
   */
  function pathFor(peak, dH, X, Y) {
    return "M" + X(0) + " " + Y(0) +
      " L" + X(20) + " " + Y(0) +
      " C" + X(32) + " " + Y(0) + " " + X(38) + " " + Y(peak) + " " + X(50) + " " + Y(peak) +
      " C" + X(62) + " " + Y(peak) + " " + X(68) + " " + Y(dH) + " " + X(80) + " " + Y(dH) +
      " L" + X(100) + " " + Y(dH);
  }

  /* Double-headed vertical measure arrow between two y positions. */
  function vArrow(x, ya, yb, cls) {
    var top = Math.min(ya, yb), bot = Math.max(ya, yb);
    if (bot - top < 6) return "";   // too short to draw heads cleanly
    return '<line class="' + cls + '" x1="' + x + '" y1="' + top + '" x2="' + x +
      '" y2="' + bot + '"/>' +
      '<path class="' + cls + '-head" d="M' + (x - 4) + " " + (top + 6) + " L" + x + " " +
      top + " L" + (x + 4) + " " + (top + 6) + 'Z"/>' +
      '<path class="' + cls + '-head" d="M' + (x - 4) + " " + (bot - 6) + " L" + x + " " +
      bot + " L" + (x + 4) + " " + (bot - 6) + 'Z"/>';
  }

  function diagramMarkup(s, L) {
    var plotW = L.w - L.left - L.right;
    var plotH = L.h - L.top - L.bottom;
    var ax = axisFor(s);
    var X = function (t) { return L.left + (t / 100) * plotW; };
    var Y = function (e) { return L.top + (1 - (e - ax.min) / (ax.max - ax.min)) * plotH; };

    var parts = [];
    var e;

    // Energy gridlines + labels.
    for (e = ax.min; e <= ax.max; e += 50) {
      parts.push('<line class="chem-reaction__grid" x1="' + X(0) + '" y1="' + Y(e) +
        '" x2="' + X(100) + '" y2="' + Y(e) + '"/>');
      parts.push('<text class="chem-reaction__tick" x="' + (L.left - 7) + '" y="' +
        (Y(e) + 4) + '" text-anchor="end">' + e + "</text>");
    }

    // Axes + titles.
    parts.push('<line class="chem-reaction__axis" x1="' + X(0) + '" y1="' + Y(ax.min) +
      '" x2="' + X(0) + '" y2="' + Y(ax.max) + '"/>');
    parts.push('<line class="chem-reaction__axis" x1="' + X(0) + '" y1="' + Y(ax.min) +
      '" x2="' + X(100) + '" y2="' + Y(ax.min) + '"/>');
    parts.push('<text class="chem-reaction__axis-label" x="' + (L.left + plotW / 2) +
      '" y="' + (L.h - 6) + '" text-anchor="middle">Reaction progress →</text>');
    parts.push('<text class="chem-reaction__axis-label" transform="translate(' +
      (L.font + 1) + "," + (L.top + plotH / 2) + ') rotate(-90)" text-anchor="middle">' +
      (L.w < 400 ? "Energy (kJ/mol)" : "Potential energy (kJ/mol)") + "</text>");

    // Reactant / product reference levels.
    parts.push('<line class="chem-reaction__level" x1="' + X(0) + '" y1="' + Y(0) +
      '" x2="' + X(100) + '" y2="' + Y(0) + '"/>');
    parts.push('<line class="chem-reaction__level" x1="' + X(0) + '" y1="' + Y(s.dH) +
      '" x2="' + X(100) + '" y2="' + Y(s.dH) + '"/>');

    // Uncatalysed path stays visible for comparison once a catalyst is applied.
    if (s.catalyst > 0) {
      parts.push('<path class="chem-reaction__curve chem-reaction__curve--plain" d="' +
        pathFor(s.peak, s.dH, X, Y) + '"/>');
    }
    parts.push('<path class="chem-reaction__curve chem-reaction__curve--active" d="' +
      pathFor(s.peakActive, s.dH, X, Y) + '"/>');

    /*
     * The measure arrows carry short symbols only. The sliders can drive the two
     * shelves and the peak into almost any arrangement, and a full "Ea = 150
     * kJ/mol" string collides with the curve or the species labels in a good
     * fraction of them. The values are read off the stat tiles directly below.
     */
    parts.push(vArrow(X(50), Y(0), Y(s.peakActive), "chem-reaction__arrow"));
    parts.push('<text class="chem-reaction__measure" x="' + (X(50) + 7) + '" y="' +
      ((Y(0) + Y(s.peakActive)) / 2 + 4) + '">E' + "ₐ" + "</text>");

    parts.push(vArrow(X(88), Y(0), Y(s.dH), "chem-reaction__arrow chem-reaction__arrow--dh"));
    parts.push('<text class="chem-reaction__measure" x="' + (X(88) - 7) + '" y="' +
      ((Y(0) + Y(s.dH)) / 2 + 4) + '" text-anchor="end">ΔH</text>');

    // Species labels sit on whichever side of their shelf is empty.
    parts.push('<text class="chem-reaction__species" x="' + X(2) + '" y="' + (Y(0) - 8) +
      '">Reactants</text>');
    parts.push('<text class="chem-reaction__species" x="' + X(98) + '" y="' +
      (s.dH < 0 ? Y(s.dH) + 18 : Y(s.dH) - 8) + '" text-anchor="end">Products</text>');
    // Anchored above the *highest* peak drawn, so it clears the uncatalysed
    // curve too whenever both paths are on screen.
    parts.push('<text class="chem-reaction__species" x="' + X(50) + '" y="' +
      (Y(s.peak) - 10) + '" text-anchor="middle">Transition state</text>');

    return '<svg class="chem-reaction__diagram" viewBox="0 0 ' + L.w + " " + L.h +
      '" style="font-size:' + L.font + 'px" role="img" aria-label="' +
      escapeAttr("Reaction coordinate diagram. Reactants at 0 kJ per mole rise to a " +
        "transition state " + fmt(s.eaFCat) + " kJ per mole higher, then fall to products at " +
        signed(s.dH) + " kJ per mole. The reaction is " + s.type.toLowerCase() + ".") +
      '">' + parts.join("") + "</svg>";
  }

  /* ------------------------------------------------------------------ *
   * Widget
   * ------------------------------------------------------------------ */

  function num(value, fallback) {
    var n = parseFloat(value);
    return isFinite(n) ? n : fallback;
  }

  ChemViz.register("reaction-energy", function (el, options) {
    var defaults = {
      ea: num(options.ea, 150),
      dH: num(options.deltaH, -80),
      catalystPercent: num(options.catalystPercent, 0)
    };

    el.className = "chem-widget chem-reaction";
    el.innerHTML =
      '<div class="chem-widget__header">' +
        "<h4>Reaction energy and catalysts</h4>" +
        "<p>Change the barrier, the enthalpy change and the catalyst, and watch " +
        "which parts of the diagram move — and which do not.</p>" +
      "</div>" +
      '<div class="chem-widget__visual">' +
        '<div class="chem-reaction__diagram-pane" data-ref="diagram"></div>' +
      "</div>" +
      '<p class="chem-reaction__legend" data-ref="legend" hidden>' +
        '<span class="chem-reaction__legend-item">' +
          '<span class="chem-reaction__key chem-reaction__key--active"></span>with catalyst</span>' +
        // Whitespace-only nodes are not flex items, so this separates the two
        // entries for textContent / screen readers without affecting layout.
        " " +
        '<span class="chem-reaction__legend-item">' +
          '<span class="chem-reaction__key chem-reaction__key--plain"></span>without catalyst</span>' +
      "</p>" +
      '<div class="chem-widget__controls">' +
        '<div class="chem-widget__control">' +
          '<label data-ref="eaLabel">Activation energy, uncatalysed ' +
            '<span class="chem-widget__control-value" data-ref="eaValue" aria-hidden="true"></span>' +
          "</label>" +
          '<input type="range" class="chem-widget__slider" data-ref="ea" min="20" max="300" step="5">' +
        "</div>" +
        '<div class="chem-widget__control">' +
          '<label data-ref="dhLabel">Enthalpy change ΔH ' +
            '<span class="chem-widget__control-value" data-ref="dhValue" aria-hidden="true"></span>' +
          "</label>" +
          '<input type="range" class="chem-widget__slider" data-ref="dh" min="-200" max="200" step="5">' +
        "</div>" +
        '<div class="chem-widget__control">' +
          '<label data-ref="catLabel">Catalyst effectiveness ' +
            '<span class="chem-widget__control-value" data-ref="catValue" aria-hidden="true"></span>' +
          "</label>" +
          '<input type="range" class="chem-widget__slider" data-ref="cat" min="0" max="80" step="5">' +
        "</div>" +
      "</div>" +
      '<div class="chem-widget__status">' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Eₐ forward</span>' +
          '<span class="chem-widget__stat-value" data-ref="statEaF"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Eₐ reverse</span>' +
          '<span class="chem-widget__stat-value" data-ref="statEaR"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">ΔH</span>' +
          '<span class="chem-widget__stat-value" data-ref="statDh"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Reaction</span>' +
          '<span class="chem-widget__stat-value" data-ref="statType"></span></div>' +
      "</div>" +
      '<p class="chem-widget__explanation" data-ref="explanation" aria-live="polite"></p>' +
      '<div class="chem-reaction__actions">' +
        '<button type="button" class="chem-widget__btn" data-ref="reset">Reset</button>' +
      "</div>";

    var ref = {};
    var nodes = el.querySelectorAll("[data-ref]");
    for (var i = 0; i < nodes.length; i++) ref[nodes[i].getAttribute("data-ref")] = nodes[i];

    // Unique ids so every <label> binds correctly even with several widgets on a page.
    var uid = "chem-reaction-" + Math.random().toString(36).slice(2, 8);
    [["ea", "eaLabel"], ["dh", "dhLabel"], ["cat", "catLabel"]].forEach(function (pair) {
      ref[pair[0]].id = uid + "-" + pair[0];
      ref[pair[1]].setAttribute("for", uid + "-" + pair[0]);
    });

    /* -- state ------------------------------------------------------- */

    function readInput() {
      return {
        ea: num(ref.ea.value, defaults.ea),
        dH: num(ref.dh.value, defaults.dH),
        catalyst: num(ref.cat.value, 0) / 100
      };
    }

    /*
     * An endothermic reaction cannot have a forward barrier smaller than dH, so
     * the Ea slider's floor tracks dH instead of silently clamping behind the
     * user's back.
     */
    function syncEaBounds() {
      var dH = num(ref.dh.value, defaults.dH);
      var min = Math.max(20, Math.round((dH + 20) / 5) * 5);
      ref.ea.min = String(min);
      if (num(ref.ea.value, min) < min) ref.ea.value = String(min);
    }

    function explain(s) {
      var text;
      if (s.dH < 0) {
        text = "ΔH = " + signed(s.dH) + " kJ/mol, so the reaction is exothermic: the " +
          "products sit below the reactants and energy is released to the surroundings.";
      } else if (s.dH > 0) {
        text = "ΔH = " + signed(s.dH) + " kJ/mol, so the reaction is endothermic: the " +
          "products sit above the reactants and energy is absorbed from the surroundings.";
      } else {
        text = "ΔH = 0 kJ/mol: reactants and products sit at the same energy.";
      }
      if (s.catalyst > 0) {
        text += " The catalyst lowers the activation energy from " + fmt(s.eaF) + " to " +
          fmt(s.eaFCat) + " kJ/mol forward, and from " + fmt(s.eaR) + " to " + fmt(s.eaRCat) +
          " kJ/mol in reverse, so both directions speed up. ΔH is unchanged at " +
          signed(s.dH) + " kJ/mol — a catalyst opens a lower-energy pathway, it does " +
          "not move the reactant or product energy levels.";
      } else {
        text += " Add a catalyst to see the barrier fall while ΔH stays put.";
      }
      return text;
    }

    /* -- rendering --------------------------------------------------- */

    var layoutKey = null;

    function render(commit) {
      syncEaBounds();
      var raw = readInput();
      var s = solve(raw);

      ref.eaValue.textContent = fmt(s.eaF) + " kJ/mol";
      ref.dhValue.textContent = signed(s.dH) + " kJ/mol";
      ref.catValue.textContent = Math.round(s.catalyst * 100) + "%";

      ref.statEaF.textContent = fmt(s.eaFCat) + " kJ/mol";
      ref.statEaR.textContent = fmt(s.eaRCat) + " kJ/mol";
      ref.statDh.textContent = signed(s.dH) + " kJ/mol";
      ref.statType.textContent = s.type;

      ref.ea.setAttribute("aria-valuetext", fmt(s.eaF) + " kilojoules per mole uncatalysed");
      ref.dh.setAttribute("aria-valuetext", signed(s.dH) + " kilojoules per mole, " +
        s.type.toLowerCase());
      ref.cat.setAttribute("aria-valuetext", s.catalyst > 0
        ? Math.round(s.catalyst * 100) + " percent, barrier " + fmt(s.eaFCat) + " kilojoules per mole"
        : "no catalyst");

      if (s.catalyst > 0) ref.legend.removeAttribute("hidden");
      else ref.legend.setAttribute("hidden", "");

      ref.diagram.innerHTML = diagramMarkup(s, LAYOUTS[layoutKey]);

      if (commit) ref.explanation.textContent = explain(s);
    }

    /* -- events ------------------------------------------------------ */

    function onInput() { render(false); }
    function onChange() { render(true); }

    function onReset() {
      ref.ea.value = String(defaults.ea);
      ref.dh.value = String(defaults.dH);
      ref.cat.value = String(defaults.catalystPercent);
      render(true);
      ref.ea.focus();
    }

    var mq = window.matchMedia ? window.matchMedia("(max-width: 560px)") : null;

    function onLayoutChange() {
      var key = mq && mq.matches ? "compact" : "wide";
      if (key === layoutKey) return;
      layoutKey = key;
      render(false);
    }

    ["ea", "dh", "cat"].forEach(function (k) {
      ref[k].addEventListener("input", onInput);
      ref[k].addEventListener("change", onChange);
    });
    ref.reset.addEventListener("click", onReset);
    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", onLayoutChange);
      else if (mq.addListener) mq.addListener(onLayoutChange);
    }

    layoutKey = mq && mq.matches ? "compact" : "wide";
    ref.ea.value = String(defaults.ea);
    ref.dh.value = String(defaults.dH);
    ref.cat.value = String(defaults.catalystPercent);
    render(true);

    return function cleanup() {
      ["ea", "dh", "cat"].forEach(function (k) {
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
