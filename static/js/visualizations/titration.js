/*
 * Strong acid / strong base titration simulator (AP Chemistry, Unit 8).
 *
 * Registers the "titration" ChemViz widget. Vanilla JS + native SVG only.
 *
 * The chemistry lives in solve() and is deliberately DOM-free: the curve, the
 * current-point marker, the pH readout and the explanation all come from that
 * one function, so the graph can never disagree with the numbers next to it.
 */
(function (window, document) {
  "use strict";

  if (!window.ChemViz) return;

  var KW = 1e-14;   // water autoionization constant at 25 °C
  var PKW = 14;     // -log10(KW)

  /* ------------------------------------------------------------------ *
   * Chemistry
   * ------------------------------------------------------------------ */

  /*
   * Net strong-acid concentration after neutralization:
   *
   *   C = (n_H+ added - n_OH- initial) / V_total
   *
   * C < 0 leaves excess OH-, C > 0 leaves excess H+, C = 0 is equivalence.
   * Feeding C through the charge balance [H+] - [OH-] = C with Kw = [H+][OH-]
   * gives [H+] = (C + sqrt(C^2 + 4Kw)) / 2.
   *
   * Away from equivalence the Kw term is negligible and this reduces exactly to
   * the AP formulas [OH-] = (n_OH - n_H)/V_total and [H+] = (n_H - n_OH)/V_total.
   * At equivalence it yields [H+] = sqrt(Kw) = 1e-7, i.e. pH 7.00, without a
   * special case and without the divide-by-zero the bare formulas hit there --
   * which is what makes the plotted curve a continuous sigmoid.
   *
   * Each branch is evaluated in the algebraically stable direction (solving for
   * [OH-] on the basic side) to avoid catastrophic cancellation.
   */
  function solve(volumeAcidMl, model) {
    var vAcid = volumeAcidMl / 1000;              // L
    var vBase = model.baseVolumeMl / 1000;        // L
    var nH = model.acidM * vAcid;                 // mol H+ added
    var nOH = model.baseM * vBase;                // mol OH- initially present
    var vTotal = vAcid + vBase;                   // L
    var diff = nH - nOH;                          // mol, signed

    // Never compare moles with ===; equivalence is a tolerance band.
    var tol = 1e-9 * Math.max(nOH, nH, 1e-12);
    var region = diff > tol ? "after" : (diff < -tol ? "before" : "equivalence");

    var c = diff / vTotal;
    var pH;
    if (region === "equivalence") {
      pH = PKW / 2;
    } else if (c > 0) {
      pH = -Math.log10((c + Math.sqrt(c * c + 4 * KW)) / 2);
    } else {
      var pOH = -Math.log10((-c + Math.sqrt(c * c + 4 * KW)) / 2);
      pH = PKW - pOH;
    }

    return {
      volumeMl: volumeAcidMl,
      pH: pH,
      region: region,
      molH: nH,
      molOH: nOH,
      excessMol: Math.abs(diff),
      totalVolumeMl: volumeAcidMl + model.baseVolumeMl
    };
  }

  /* Volume of titrant at which moles of H+ equal the initial moles of OH-. */
  function equivalenceMl(model) {
    return (model.baseM * model.baseVolumeMl) / model.acidM;
  }

  /* ------------------------------------------------------------------ *
   * Formatting
   * ------------------------------------------------------------------ */

  var SUPERSCRIPT = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²",
    "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷",
    "8": "⁸", "9": "⁹" };

  function superscript(n) {
    return String(n).replace(/[-0-9]/g, function (ch) { return SUPERSCRIPT[ch]; });
  }

  /* 0.0005 -> "5.00 × 10⁻⁴" */
  function sci(x, digits) {
    if (!x) return "0";
    var exp = Math.floor(Math.log10(Math.abs(x)));
    var mant = x / Math.pow(10, exp);
    // Guard the rounding edge, e.g. 9.999e-4 -> 10.0e-4.
    if (Math.abs(Number(mant.toFixed(digits))) >= 10) { mant /= 10; exp += 1; }
    return mant.toFixed(digits) + " × 10" + superscript(exp);
  }

  /* ------------------------------------------------------------------ *
   * Approximate universal-indicator colour
   *
   * Supporting feedback only. The numeric pH and the before/at/after status are
   * always shown as text, so nothing here is the sole carrier of meaning.
   * ------------------------------------------------------------------ */

  var COLOR_STOPS = [
    [0.0, 208, 42, 42], [2.0, 232, 89, 12], [4.0, 245, 159, 0], [5.0, 245, 208, 0],
    [6.0, 183, 212, 23], [7.0, 70, 179, 94], [8.0, 47, 163, 138], [9.0, 42, 142, 201],
    [11.0, 59, 91, 191], [12.5, 107, 63, 160], [14.0, 123, 45, 142]
  ];

  function indicatorColor(pH) {
    var p = Math.max(0, Math.min(14, pH));
    for (var i = 0; i < COLOR_STOPS.length - 1; i++) {
      var a = COLOR_STOPS[i], b = COLOR_STOPS[i + 1];
      if (p <= b[0]) {
        var t = (p - a[0]) / (b[0] - a[0]);
        return "rgb(" + Math.round(a[1] + (b[1] - a[1]) * t) + "," +
          Math.round(a[2] + (b[2] - a[2]) * t) + "," +
          Math.round(a[3] + (b[3] - a[3]) * t) + ")";
      }
    }
    return "rgb(123,45,142)";
  }

  // Thresholds track the interpolated stops above so the name matches the swatch.
  var COLOR_NAMES = [[1, "red"], [3, "orange-red"], [4.5, "orange"], [5.5, "yellow"],
    [6.5, "yellow-green"], [7.5, "green"], [8.5, "teal"], [10, "blue"],
    [11.75, "indigo"], [13.25, "violet"], [99, "purple"]];

  function indicatorName(pH) {
    for (var i = 0; i < COLOR_NAMES.length; i++) {
      if (pH < COLOR_NAMES[i][0]) return COLOR_NAMES[i][1];
    }
    return "purple";
  }

  /* ------------------------------------------------------------------ *
   * Curve sampling
   * ------------------------------------------------------------------ */

  /*
   * Uniform sampling alone renders the equivalence jump as a ragged staircase,
   * so add log-spaced samples closing in on the equivalence volume from both
   * sides. ~300 points total, computed once per widget.
   */
  function sampleVolumes(vmax, eqV) {
    var vs = [];
    var steps = 200;
    for (var i = 0; i <= steps; i++) vs.push((i * vmax) / steps);
    for (var e = -1; e >= -6.001; e -= 0.1) {
      var d = Math.pow(10, e);
      if (eqV - d > 0) vs.push(eqV - d);
      if (eqV + d < vmax) vs.push(eqV + d);
    }
    vs.push(eqV);
    vs.sort(function (a, b) { return a - b; });
    return vs;
  }

  /* ------------------------------------------------------------------ *
   * Chart geometry / rendering
   * ------------------------------------------------------------------ */

  var LAYOUTS = {
    wide: { w: 520, h: 320, top: 16, right: 20, bottom: 46, left: 54, font: 12 },
    compact: { w: 340, h: 300, top: 14, right: 12, bottom: 42, left: 40, font: 13 }
  };

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function chartMarkup(model, geom, layout, samples) {
    var L = layout;
    var plotW = L.w - L.left - L.right;
    var plotH = L.h - L.top - L.bottom;
    var x = function (v) { return L.left + (v / geom.vmax) * plotW; };
    var y = function (p) { return L.top + (1 - p / 14) * plotH; };

    var parts = [];
    var i, v, p;

    // pH gridlines + labels.
    for (p = 0; p <= 14; p += 2) {
      parts.push('<line class="chem-titration__grid" x1="' + x(0) + '" y1="' + y(p) +
        '" x2="' + x(geom.vmax) + '" y2="' + y(p) + '"/>');
      parts.push('<text class="chem-titration__tick" x="' + (L.left - 7) + '" y="' +
        (y(p) + 4) + '" text-anchor="end">' + p + "</text>");
    }

    // Volume gridlines + labels.
    for (i = 0; i <= 4; i++) {
      v = (i * geom.vmax) / 4;
      parts.push('<line class="chem-titration__grid" x1="' + x(v) + '" y1="' + y(0) +
        '" x2="' + x(v) + '" y2="' + y(14) + '"/>');
      parts.push('<text class="chem-titration__tick" x="' + x(v) + '" y="' +
        (y(0) + 18) + '" text-anchor="middle">' + v.toFixed(0) + "</text>");
    }

    // Axes.
    parts.push('<line class="chem-titration__axis" x1="' + x(0) + '" y1="' + y(0) +
      '" x2="' + x(geom.vmax) + '" y2="' + y(0) + '"/>');
    parts.push('<line class="chem-titration__axis" x1="' + x(0) + '" y1="' + y(0) +
      '" x2="' + x(0) + '" y2="' + y(14) + '"/>');
    parts.push('<text class="chem-titration__axis-label" x="' + (L.left + plotW / 2) +
      '" y="' + (L.h - 6) + '" text-anchor="middle">' + escapeAttr(model.acid) +
      " added (mL)</text>");
    parts.push('<text class="chem-titration__axis-label" transform="translate(' +
      (L.font + 1) + "," + (L.top + plotH / 2) + ') rotate(-90)" text-anchor="middle">pH</text>');

    // Equivalence point: dashed guide + hollow marker + label.
    parts.push('<line class="chem-titration__equiv-line" x1="' + x(geom.eqV) + '" y1="' +
      y(0) + '" x2="' + x(geom.eqV) + '" y2="' + y(14) + '"/>');
    // Flip the label to the left of its guide once the equivalence point sits far
    // enough right that the text would run past the plot area.
    var eqX = x(geom.eqV);
    var flip = eqX > L.left + plotW * 0.6;
    parts.push('<text class="chem-titration__equiv-label" x="' + (eqX + (flip ? -6 : 6)) +
      '" y="' + (L.top + 11) + '" text-anchor="' + (flip ? "end" : "start") + '">' +
      (L.w < 400 ? "Eq. " : "Equivalence ") + geom.eqV.toFixed(1) + " mL</text>");

    // The curve itself.
    var d = [];
    for (i = 0; i < samples.length; i++) {
      v = samples[i];
      p = solve(v, model).pH;
      d.push((i ? "L" : "M") + x(v).toFixed(2) + " " + y(p).toFixed(2));
    }
    parts.push('<path class="chem-titration__curve-line" d="' + d.join(" ") + '"/>');

    parts.push('<circle class="chem-titration__equiv-dot" cx="' + x(geom.eqV) + '" cy="' +
      y(7) + '" r="4.5"/>');

    // Current state: crosshair + filled marker (refs updated on every input).
    parts.push('<line class="chem-titration__crosshair" data-ref="hairX"/>');
    parts.push('<line class="chem-titration__crosshair" data-ref="hairY"/>');
    parts.push('<circle class="chem-titration__current-dot" data-ref="dot" r="6"/>');

    return '<svg class="chem-titration__curve" viewBox="0 0 ' + L.w + " " + L.h +
      '" style="font-size:' + L.font + 'px" role="img" aria-label="Titration curve: pH ' +
      "on the vertical axis against millilitres of " + escapeAttr(model.acid) +
      " added on the horizontal axis. The curve starts near pH " +
      solve(0, model).pH.toFixed(1) + ", falls steeply through the equivalence point at " +
      geom.eqV.toFixed(1) + ' mL and pH 7, and levels off near pH ' +
      solve(geom.vmax, model).pH.toFixed(1) + '.">' + parts.join("") + "</svg>";
  }

  /* ------------------------------------------------------------------ *
   * Beaker / burette diagram
   * ------------------------------------------------------------------ */

  function beakerMarkup() {
    return '<svg class="chem-titration__beaker" viewBox="0 0 140 210" ' +
      'role="presentation" aria-hidden="true" focusable="false">' +
      '<rect class="chem-titration__glass" x="60" y="4" width="20" height="88" rx="3"/>' +
      '<rect class="chem-titration__titrant" x="62" y="6" width="16" height="60" rx="2"/>' +
      '<path class="chem-titration__glass" d="M60 92 L80 92 L73 106 L67 106 Z"/>' +
      '<circle class="chem-titration__drop" data-ref="drop" cx="70" cy="116" r="3.5"/>' +
      // Liquid first, beaker outline over it, so the glass edge stays visible.
      '<rect data-ref="liquid" x="30" y="150" width="80" height="50"/>' +
      '<path class="chem-titration__glass" d="M28 122 L28 196 Q28 202 34 202 L106 202 ' +
      'Q112 202 112 196 L112 122"/>' +
      "</svg>";
  }

  /* ------------------------------------------------------------------ *
   * Widget
   * ------------------------------------------------------------------ */

  function num(value, fallback) {
    var n = parseFloat(value);
    return isFinite(n) ? n : fallback;
  }

  ChemViz.register("titration", function (el, options) {
    var model = {
      acid: options.acid || "HCl",
      base: options.base || "NaOH",
      acidM: num(options.acidMolarity, 0.1),
      baseM: num(options.baseMolarity, 0.1),
      baseVolumeMl: num(options.baseVolumeMl, 10)
    };

    var eqV = equivalenceMl(model);
    var geom = { eqV: eqV, vmax: num(options.maxVolumeMl, eqV * 2) };
    var samples = sampleVolumes(geom.vmax, geom.eqV);
    var maxTotalMl = geom.vmax + model.baseVolumeMl;

    var acid = model.acid + " (" + model.acidM.toFixed(3) + " M)";
    var base = model.base + " (" + model.baseM.toFixed(3) + " M, " +
      model.baseVolumeMl.toFixed(1) + " mL)";

    el.className = "chem-widget chem-titration";
    el.innerHTML =
      '<div class="chem-widget__header">' +
        "<h4>Acid–base titration</h4>" +
        "<p>" + escapeAttr(acid) + " titrated into " + escapeAttr(base) +
        " at 25 °C · H⁺ + OH⁻ → H₂O</p>" +
      "</div>" +
      '<div class="chem-widget__visual">' +
        '<div class="chem-titration__beaker-pane">' + beakerMarkup() +
          '<p class="chem-titration__swatch-label" data-ref="colorName"></p>' +
        "</div>" +
        '<div class="chem-titration__curve-pane" data-ref="chart"></div>' +
      "</div>" +
      '<div class="chem-widget__controls">' +
        '<label class="chem-titration__slider-label" data-ref="sliderLabel">' +
          escapeAttr(model.acid) + " added" +
        "</label>" +
        '<input class="chem-widget__slider" data-ref="slider" type="range" min="0" max="' +
          geom.vmax + '" step="0.1" value="0">' +
        '<div class="chem-titration__presets" data-ref="presets" role="group" ' +
          'aria-label="Jump to a titrant volume"></div>' +
      "</div>" +
      '<div class="chem-widget__status">' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Titrant added</span>' +
          '<span class="chem-widget__stat-value" data-ref="volume"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">pH</span>' +
          '<span class="chem-widget__stat-value" data-ref="ph"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Region</span>' +
          '<span class="chem-widget__stat-value" data-ref="region"></span></div>' +
      "</div>" +
      '<p class="chem-widget__explanation" data-ref="explanation" aria-live="polite"></p>' +
      '<div class="chem-titration__actions">' +
        '<button type="button" class="chem-widget__btn" data-ref="reset">Reset</button>' +
      "</div>";

    var ref = {};
    var nodes = el.querySelectorAll("[data-ref]");
    for (var i = 0; i < nodes.length; i++) ref[nodes[i].getAttribute("data-ref")] = nodes[i];

    // Unique id so the <label> binds correctly even with several widgets on a page.
    var sliderId = "chem-titration-slider-" + Math.random().toString(36).slice(2, 8);
    ref.slider.id = sliderId;
    ref.sliderLabel.setAttribute("for", sliderId);

    // Preset buttons at 0, 25, 50, 75, 100 % of the plotted range.
    var presets = [];
    for (i = 0; i <= 4; i++) presets.push((i * geom.vmax) / 4);
    ref.presets.innerHTML = presets.map(function (v) {
      return '<button type="button" class="chem-widget__btn chem-widget__btn--ghost" ' +
        'data-volume="' + v + '">' + v.toFixed(0) + " mL</button>";
    }).join("");

    /* -- rendering ---------------------------------------------------- */

    var layoutKey = null;
    var chart = {};

    function renderChart(key) {
      layoutKey = key;
      ref.chart.innerHTML = chartMarkup(model, geom, LAYOUTS[key], samples);
      chart = { layout: LAYOUTS[key] };
      var svgNodes = ref.chart.querySelectorAll("[data-ref]");
      for (var j = 0; j < svgNodes.length; j++) {
        chart[svgNodes[j].getAttribute("data-ref")] = svgNodes[j];
      }
    }

    function updateChart(state) {
      var L = chart.layout;
      var plotW = L.w - L.left - L.right;
      var plotH = L.h - L.top - L.bottom;
      var cx = L.left + (state.volumeMl / geom.vmax) * plotW;
      var cy = L.top + (1 - Math.max(0, Math.min(14, state.pH)) / 14) * plotH;

      cx = +cx.toFixed(2);
      cy = +cy.toFixed(2);
      chart.dot.setAttribute("cx", cx);
      chart.dot.setAttribute("cy", cy);
      chart.hairX.setAttribute("x1", L.left);
      chart.hairX.setAttribute("y1", cy);
      chart.hairX.setAttribute("x2", cx);
      chart.hairX.setAttribute("y2", cy);
      chart.hairY.setAttribute("x1", cx);
      chart.hairY.setAttribute("y1", cy);
      chart.hairY.setAttribute("x2", cx);
      chart.hairY.setAttribute("y2", L.top + plotH);
    }

    var REGION_TEXT = {
      before: "Before equivalence",
      equivalence: "At the equivalence point",
      after: "After equivalence"
    };

    function explain(state) {
      var vTotal = state.totalVolumeMl.toFixed(1);
      if (state.region === "before") {
        return "OH⁻ is in excess: " + sci(state.excessMol, 2) + " mol of OH⁻ " +
          "remain in " + vTotal + " mL of solution, so the pH is set by the leftover " +
          "strong base.";
      }
      if (state.region === "after") {
        return "H⁺ is in excess: " + sci(state.excessMol, 2) + " mol of H⁺ " +
          "remain in " + vTotal + " mL of solution, so the pH is set by the excess " +
          "strong acid.";
      }
      return "Moles of H⁺ added equal the initial moles of OH⁻ (" +
        sci(state.molOH, 2) + " mol). Only water and the spectator ions Na⁺ and " +
        "Cl⁻ are left, so at 25 °C the pH is 7.00.";
    }

    /*
     * `commit` marks an interaction the user has finished (keyboard step, drag
     * release, preset, reset) as opposed to a frame mid-drag. Everything visual
     * updates on every call; the aria-live explanation is only rewritten on a
     * commit, so dragging the slider cannot flood a screen reader.
     */
    function render(volumeMl, commit) {
      var state = solve(volumeMl, model);
      var phText = state.pH.toFixed(2);
      var volText = state.volumeMl.toFixed(1) + " mL";
      var color = indicatorColor(state.pH);

      ref.volume.textContent = volText;
      ref.ph.textContent = phText;
      ref.region.textContent = REGION_TEXT[state.region];
      ref.colorName.textContent = "Approximate indicator colour: " + indicatorName(state.pH);

      // Liquid level rises as titrant is added; colour tracks pH. Kept below the
      // 80-unit beaker interior so a full burette never overflows the rim.
      var level = 26 + 46 * (state.totalVolumeMl / maxTotalMl);
      chart.dot.style.fill = color;
      ref.liquid.setAttribute("y", (200 - level).toFixed(2));
      ref.liquid.setAttribute("height", level.toFixed(2));
      ref.liquid.style.fill = color;
      ref.drop.style.display = state.volumeMl > 0 ? "" : "none";

      updateChart(state);

      ref.slider.setAttribute("aria-valuetext", volText + " added, pH " + phText + ", " +
        REGION_TEXT[state.region].toLowerCase());

      if (commit) ref.explanation.textContent = explain(state);
    }

    function currentVolume() {
      return num(ref.slider.value, 0);
    }

    /* -- events ------------------------------------------------------- */

    function onInput() { render(currentVolume(), false); }
    function onChange() { render(currentVolume(), true); }

    function onPresetClick(e) {
      var btn = e.target.closest ? e.target.closest("button[data-volume]") : null;
      if (!btn) return;
      ref.slider.value = btn.getAttribute("data-volume");
      render(currentVolume(), true);
    }

    function onReset() {
      ref.slider.value = "0";
      render(0, true);
      ref.slider.focus();
    }

    var mq = window.matchMedia ? window.matchMedia("(max-width: 560px)") : null;

    function onLayoutChange() {
      var key = mq && mq.matches ? "compact" : "wide";
      if (key === layoutKey) return;
      renderChart(key);
      render(currentVolume(), false);
    }

    ref.slider.addEventListener("input", onInput);
    ref.slider.addEventListener("change", onChange);
    ref.presets.addEventListener("click", onPresetClick);
    ref.reset.addEventListener("click", onReset);
    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", onLayoutChange);
      else if (mq.addListener) mq.addListener(onLayoutChange);
    }

    renderChart(mq && mq.matches ? "compact" : "wide");
    render(0, true);

    return function cleanup() {
      ref.slider.removeEventListener("input", onInput);
      ref.slider.removeEventListener("change", onChange);
      ref.presets.removeEventListener("click", onPresetClick);
      ref.reset.removeEventListener("click", onReset);
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener("change", onLayoutChange);
        else if (mq.removeListener) mq.removeListener(onLayoutChange);
      }
      ref = chart = null;
    };
  });
})(window, document);
