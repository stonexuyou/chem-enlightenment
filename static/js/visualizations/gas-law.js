/*
 * Ideal gas law with a movable piston (AP Chemistry, Unit 3).
 *
 * Registers the "gas-law" ChemViz widget. Vanilla JS + Canvas.
 *
 *   PV = nRT      with n held at 1.00 mol
 *
 * One model rather than three: pressure and temperature are the inputs, volume
 * is whatever PV = nRT requires. Moving the pressure slider alone *is* Boyle's
 * law; moving the temperature slider alone *is* Charles's law. The explanation
 * names whichever one the learner just demonstrated, so the special cases fall
 * out of the general equation instead of being separate widgets.
 *
 * Canvas for the same reason as the equilibrium model: per-frame motion of
 * many independent particles.
 */
(function (window, document) {
  "use strict";

  if (!window.ChemViz) return;

  /* ------------------------------------------------------------------ *
   * Physics
   * ------------------------------------------------------------------ */

  var R = 0.082057;        // L atm / (mol K)
  var N_MOL = 1.00;        // held constant so the widget has two free inputs
  var T_REF = 300;         // K, reference for particle speed
  var V_DISPLAY_MAX = 75;  // L mapped to a full cylinder

  /* The piston settles where the gas pressure matches the applied pressure. */
  function solve(pressureAtm, tempK) {
    var V = (N_MOL * R * tempK) / pressureAtm;
    return {
      P: pressureAtm,
      T: tempK,
      n: N_MOL,
      V: V,
      // PV/nT is R for any ideal gas at any state -- the invariant behind all
      // three named gas laws, shown so learners can watch it not move.
      invariant: (pressureAtm * V) / (N_MOL * tempK)
    };
  }

  /* Root-mean-square speed scales with sqrt(T); this is that, not m/s. */
  function speedFactor(tempK) {
    return Math.sqrt(tempK / T_REF);
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ------------------------------------------------------------------ *
   * Widget
   * ------------------------------------------------------------------ */

  var PARTICLES = 45;
  var P_R = 4;                    // particle radius, css px
  var BASE_SPEED = 52;            // css px per second at T_REF
  var PISTON_H = 14;              // piston thickness, css px

  function num(value, fallback) {
    var n = parseFloat(value);
    return isFinite(n) ? n : fallback;
  }

  ChemViz.register("gas-law", function (el, options) {
    var defaults = {
      pressure: num(options.pressureAtm, 1),
      temperature: num(options.temperatureK, 300)
    };

    el.className = "chem-widget chem-gas";
    el.innerHTML =
      '<div class="chem-widget__header">' +
        "<h4>Ideal gas law: PV = nRT</h4>" +
        "<p>A cylinder holding " + N_MOL.toFixed(2) + " mol of gas under a free piston. " +
        "Set the applied pressure and the temperature; the piston settles where " +
        "PV = nRT is satisfied. Change one slider at a time to isolate a gas law.</p>" +
      "</div>" +
      '<div class="chem-gas__stage">' +
        '<canvas class="chem-gas__canvas" data-ref="canvas" role="img" aria-label="' +
          escapeAttr("A gas cylinder with a piston. Particles move faster at higher " +
          "temperature and the piston rises as the gas volume increases. Numeric values " +
          "are in the readouts below.") + '"></canvas>' +
      "</div>" +
      '<div class="chem-widget__controls">' +
        '<div class="chem-widget__control">' +
          '<label data-ref="pLabel">Applied pressure ' +
            '<span class="chem-widget__control-value" data-ref="pValue" aria-hidden="true"></span>' +
          "</label>" +
          '<input type="range" class="chem-widget__slider" data-ref="p" min="0.5" max="2" step="0.05">' +
        "</div>" +
        '<div class="chem-widget__control">' +
          '<label data-ref="tLabel">Temperature ' +
            '<span class="chem-widget__control-value" data-ref="tValue" aria-hidden="true"></span>' +
          "</label>" +
          '<input type="range" class="chem-widget__slider" data-ref="t" min="250" max="450" step="5">' +
        "</div>" +
      "</div>" +
      '<div class="chem-widget__status">' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Pressure</span>' +
          '<span class="chem-widget__stat-value" data-ref="statP"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Volume</span>' +
          '<span class="chem-widget__stat-value" data-ref="statV"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Temperature</span>' +
          '<span class="chem-widget__stat-value" data-ref="statT"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">PV / nT</span>' +
          '<span class="chem-widget__stat-value" data-ref="statR"></span></div>' +
      "</div>" +
      '<p class="chem-widget__explanation" data-ref="explanation" aria-live="polite"></p>' +
      '<div class="chem-gas__actions">' +
        '<button type="button" class="chem-widget__btn" data-ref="reset">Reset</button>' +
      "</div>";

    var ref = {};
    var nodes = el.querySelectorAll("[data-ref]");
    for (var i = 0; i < nodes.length; i++) ref[nodes[i].getAttribute("data-ref")] = nodes[i];

    var uid = "chem-gas-" + Math.random().toString(36).slice(2, 8);
    [["p", "pLabel"], ["t", "tLabel"]].forEach(function (pair) {
      ref[pair[0]].id = uid + "-" + pair[0];
      ref[pair[1]].setAttribute("for", uid + "-" + pair[0]);
    });

    /* -- state ------------------------------------------------------- */

    var destroyed = false;
    var particles = [];
    var cssW = 0, cssH = 0;
    var gasTop = 0;                     // y of the underside of the piston
    var ctx = ref.canvas.getContext("2d");
    var rafId = null, lastTs = 0;

    var motionMq = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    function reducedMotion() { return !!(motionMq && motionMq.matches); }

    function pressure() { return num(ref.p.value, 1); }
    function temperature() { return num(ref.t.value, 300); }
    function state() { return solve(pressure(), temperature()); }

    function gasTopFor(V) {
      var frac = Math.max(0.08, Math.min(1, V / V_DISPLAY_MAX));
      return cssH - frac * (cssH - PISTON_H);
    }

    function seed() {
      particles.length = 0;
      var f = reducedMotion() ? 0 : speedFactor(temperature());
      for (var j = 0; j < PARTICLES; j++) {
        var ang = Math.random() * Math.PI * 2;
        particles.push({
          x: P_R + Math.random() * Math.max(cssW - 2 * P_R, 1),
          y: gasTop + P_R + Math.random() * Math.max(cssH - gasTop - 2 * P_R, 1),
          vx: Math.cos(ang) * BASE_SPEED * f,
          vy: Math.sin(ang) * BASE_SPEED * f
        });
      }
    }

    /* Particle speed tracks sqrt(T); direction is left alone. */
    function retune() {
      var target = reducedMotion() ? 0 : BASE_SPEED * speedFactor(temperature());
      for (var j = 0; j < particles.length; j++) {
        var p = particles[j];
        var mag = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (mag < 1e-6) {
          var ang = Math.random() * Math.PI * 2;
          p.vx = Math.cos(ang) * target;
          p.vy = Math.sin(ang) * target;
        } else {
          p.vx = (p.vx / mag) * target;
          p.vy = (p.vy / mag) * target;
        }
      }
    }

    function clampIntoGas() {
      for (var j = 0; j < particles.length; j++) {
        var p = particles[j];
        if (p.x < P_R) p.x = P_R;
        if (p.x > cssW - P_R) p.x = cssW - P_R;
        if (p.y < gasTop + P_R) p.y = gasTop + P_R;
        if (p.y > cssH - P_R) p.y = Math.max(gasTop + P_R, cssH - P_R);
      }
    }

    function move(dt) {
      if (reducedMotion()) return;
      for (var j = 0; j < particles.length; j++) {
        var p = particles[j];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < P_R) { p.x = P_R; p.vx = Math.abs(p.vx); }
        if (p.x > cssW - P_R) { p.x = cssW - P_R; p.vx = -Math.abs(p.vx); }
        if (p.y < gasTop + P_R) { p.y = gasTop + P_R; p.vy = Math.abs(p.vy); }
        if (p.y > cssH - P_R) { p.y = cssH - P_R; p.vy = -Math.abs(p.vy); }
      }
    }

    /* -- drawing ----------------------------------------------------- */

    function resize() {
      if (destroyed) return;
      var rect = ref.canvas.getBoundingClientRect();
      if (!rect.width) return;
      var dpr = window.devicePixelRatio || 1;
      cssW = rect.width;
      cssH = rect.height;
      ref.canvas.width = Math.round(cssW * dpr);
      ref.canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gasTop = gasTopFor(state().V);
      if (!particles.length) seed(); else clampIntoGas();
      draw();
    }

    function draw() {
      if (!cssW) return;
      ctx.clearRect(0, 0, cssW, cssH);

      // Space above the piston.
      ctx.fillStyle = "#f1f4f8";
      ctx.fillRect(0, 0, cssW, gasTop);

      // Gas column.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, gasTop, cssW, cssH - gasTop);

      for (var j = 0; j < particles.length; j++) {
        var p = particles[j];
        ctx.beginPath();
        ctx.arc(p.x, p.y, P_R, 0, Math.PI * 2);
        ctx.fillStyle = "#2487c7";
        ctx.fill();
      }

      // Piston: a slab plus a rod, so it reads as a piston and not a stray line.
      ctx.fillStyle = "#5b6b7a";
      ctx.fillRect(0, gasTop - PISTON_H, cssW, PISTON_H);
      ctx.fillRect(cssW / 2 - 5, Math.max(0, gasTop - PISTON_H - 18), 10,
        Math.min(18, Math.max(0, gasTop - PISTON_H)));

      // Cylinder walls.
      ctx.strokeStyle = "#5b6b7a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(1, 0); ctx.lineTo(1, cssH - 1); ctx.lineTo(cssW - 1, cssH - 1);
      ctx.lineTo(cssW - 1, 0);
      ctx.stroke();
    }

    /* -- readouts ---------------------------------------------------- */

    function updateReadouts() {
      var s = state();
      ref.statP.textContent = s.P.toFixed(2) + " atm";
      ref.statV.textContent = s.V.toFixed(1) + " L";
      ref.statT.textContent = Math.round(s.T) + " K";
      ref.statR.textContent = s.invariant.toFixed(4);

      ref.pValue.textContent = s.P.toFixed(2) + " atm";
      ref.tValue.textContent = Math.round(s.T) + " K";
      ref.p.setAttribute("aria-valuetext",
        s.P.toFixed(2) + " atmospheres, volume " + s.V.toFixed(1) + " litres");
      ref.t.setAttribute("aria-valuetext",
        Math.round(s.T) + " kelvin, volume " + s.V.toFixed(1) + " litres");
    }

    function explainBoyle() {
      var s = state();
      return "Only the pressure changed, so this is Boyle's law: at constant " +
        "temperature and amount, V ∝ 1/P. Doubling the applied pressure halves the " +
        "volume. Right now P × V = " + (s.P * s.V).toFixed(1) + " L·atm, and that " +
        "product stays fixed as long as T does.";
    }

    function explainCharles() {
      var s = state();
      return "Only the temperature changed, so this is Charles's law: at constant " +
        "pressure and amount, V ∝ T in kelvin. Faster particles strike the piston " +
        "harder and more often, pushing it out until the pressures balance again. " +
        "Right now V / T = " + (s.V / s.T).toFixed(4) + " L/K, and that ratio stays " +
        "fixed as long as P does.";
    }

    /* -- events ------------------------------------------------------ */

    function refresh() {
      gasTop = gasTopFor(state().V);
      clampIntoGas();
      updateReadouts();
      draw();     // repaint now; rAF is throttled in a background tab
    }

    function onPressure() { refresh(); }
    function onPressureCommit() { refresh(); ref.explanation.textContent = explainBoyle(); }
    function onTemp() { retune(); refresh(); }
    function onTempCommit() { retune(); refresh(); ref.explanation.textContent = explainCharles(); }

    /* Split from onReset so start-up can apply defaults without stealing focus. */
    function applyDefaults() {
      ref.p.value = String(defaults.pressure);
      ref.t.value = String(defaults.temperature);
      retune();
      refresh();
      ref.explanation.textContent = "Move one slider at a time. Changing only the " +
        "pressure demonstrates Boyle's law; changing only the temperature " +
        "demonstrates Charles's law. PV/nT holds at R = " + R + " L·atm/(mol·K) " +
        "throughout — that single constant is what both laws are special cases of.";
    }

    function onReset() {
      applyDefaults();
      ref.p.focus();
    }

    /* -- loop -------------------------------------------------------- */

    function frame(ts) {
      if (destroyed) return;
      rafId = window.requestAnimationFrame(frame);
      if (!lastTs) lastTs = ts;
      var dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      move(dt);
      draw();
    }

    var ro = null;
    if (window.ResizeObserver) {
      ro = new window.ResizeObserver(resize);
      ro.observe(ref.canvas);
    } else {
      window.addEventListener("resize", resize);
    }

    ref.p.addEventListener("input", onPressure);
    ref.p.addEventListener("change", onPressureCommit);
    ref.t.addEventListener("input", onTemp);
    ref.t.addEventListener("change", onTempCommit);
    ref.reset.addEventListener("click", onReset);

    ref.p.value = String(defaults.pressure);
    ref.t.value = String(defaults.temperature);
    resize();
    applyDefaults();
    rafId = window.requestAnimationFrame(frame);

    return function cleanup() {
      destroyed = true;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      rafId = null;
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", resize);
      ref.p.removeEventListener("input", onPressure);
      ref.p.removeEventListener("change", onPressureCommit);
      ref.t.removeEventListener("input", onTemp);
      ref.t.removeEventListener("change", onTempCommit);
      ref.reset.removeEventListener("click", onReset);
      particles.length = 0;
      ref = null;
      ctx = null;
    };
  });
})(window, document);
