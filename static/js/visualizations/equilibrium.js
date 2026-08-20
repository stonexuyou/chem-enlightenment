/*
 * Equilibrium particle model (AP Chemistry, Unit 7).
 *
 * Registers the "equilibrium" ChemViz widget. Vanilla JS + Canvas.
 *
 *   N2O4(g)  <-->  2 NO2(g)        forward is endothermic, dH = +57.2 kJ/mol
 *
 * The classic demo reaction: colourless N2O4, brown NO2, and a real enthalpy
 * sign so the temperature control is well defined.
 *
 * Nothing here nudges the mixture toward an answer. Particles are converted by
 * two independent random processes whose rates follow the rate laws:
 *
 *   forward events per unit time = kf * nA          (unimolecular)
 *   reverse events per unit time = kr * nB^2 / V    (bimolecular)
 *
 * Equilibrium is where those two happen to balance, which is exactly
 * K = kf/kr = [NO2]^2/[N2O4]. Q approaching K, dynamic equilibrium, and every
 * Le Chatelier response are consequences of that, not special cases -- so the
 * model never implies a particle "knows" which way to shift.
 *
 * Canvas rather than SVG: this is the one widget so far with per-frame motion
 * of ~100 independent objects, which is materially simpler on a canvas.
 */
(function (window, document) {
  "use strict";

  if (!window.ChemViz) return;

  /* ------------------------------------------------------------------ *
   * Chemistry
   * ------------------------------------------------------------------ */

  var R = 8.314;          // J/(mol K)
  var DH = 57200;         // J/mol, forward direction (endothermic)
  var T_REF = 298.15;     // K
  var K_REF = 50;         // K at T_REF, in this model's particle units
  /*
   * Forward rate constant, in arbitrary time units. Tuned for watchability
   * rather than realism: the relaxation time is ~1/KF, so this settles in
   * roughly 5 s while still running ~9 conversions a second at equilibrium,
   * which is what makes the equilibrium visibly *dynamic*. Raising it much
   * above 0.5 makes the approach too fast to watch.
   */
  var KF = 0.15;

  /* van 't Hoff: an endothermic forward reaction has K rising with temperature. */
  function equilibriumConstant(tempK) {
    return K_REF * Math.exp((-DH / R) * (1 / tempK - 1 / T_REF));
  }

  /* Q has the same form as K but uses whatever the mixture happens to be now. */
  function reactionQuotient(nA, nB, volume) {
    if (nA <= 0) return nB > 0 ? Infinity : 0;
    var a = nA / volume, b = nB / volume;
    return (b * b) / a;
  }

  /* Expected event count -> whole events, keeping the fractional part honest. */
  function sampleEvents(expected) {
    if (!(expected > 0)) return 0;
    var whole = Math.floor(expected);
    if (Math.random() < expected - whole) whole += 1;
    return whole;
  }

  /* ------------------------------------------------------------------ *
   * Formatting
   * ------------------------------------------------------------------ */

  function fmtQK(x) {
    if (!isFinite(x)) return "very large";
    if (x >= 1000) return Math.round(x / 10) * 10 + "";
    if (x >= 10) return x.toFixed(0);
    return x.toFixed(1);
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ------------------------------------------------------------------ *
   * Widget
   * ------------------------------------------------------------------ */

  var A_COLOR = "#dbe6f2", A_EDGE = "#7d94ab", A_R = 8;      // N2O4, colourless
  var B_COLOR = "#a8552a", B_EDGE = "#7c3d1d", B_R = 5;      // NO2, brown

  var TOTAL_MIN = 40, TOTAL_MAX = 220;   // in NO2-equivalents (2*nA + nB)

  function num(value, fallback) {
    var n = parseFloat(value);
    return isFinite(n) ? n : fallback;
  }

  ChemViz.register("equilibrium", function (el, options) {
    var defaults = {
      volume: num(options.volume, 1),
      tempC: num(options.temperatureC, 25),
      total: Math.round(num(options.particles, 100))
    };

    el.className = "chem-widget chem-equilibrium";
    el.innerHTML =
      '<div class="chem-widget__header">' +
        "<h4>Dynamic equilibrium: N₂O₄ ⇌ 2 NO₂</h4>" +
        "<p>Colourless N₂O₄ splits into brown NO₂; the forward reaction is " +
        "endothermic (ΔH = +57 kJ/mol). Particles are converted at random by " +
        "the two rate laws — nothing steers them. Counts are model units, not moles.</p>" +
      "</div>" +
      '<div class="chem-equilibrium__stage">' +
        '<canvas class="chem-equilibrium__canvas" data-ref="canvas" role="img" ' +
          'aria-label="' + escapeAttr("Animated box of particles. Large pale circles are " +
          "N2O4, small brown circles are NO2. Live counts are given in the readouts below.") +
          '"></canvas>' +
      "</div>" +
      '<p class="chem-equilibrium__legend">' +
        '<span class="chem-equilibrium__legend-item">' +
          '<span class="chem-equilibrium__key chem-equilibrium__key--a"></span>N₂O₄ (large, pale)</span>' +
        " " +
        '<span class="chem-equilibrium__legend-item">' +
          '<span class="chem-equilibrium__key chem-equilibrium__key--b"></span>NO₂ (small, brown)</span>' +
      "</p>" +
      '<div class="chem-widget__controls">' +
        '<div class="chem-widget__control">' +
          '<label data-ref="volLabel">Container volume ' +
            '<span class="chem-widget__control-value" data-ref="volValue" aria-hidden="true"></span>' +
          "</label>" +
          '<input type="range" class="chem-widget__slider" data-ref="vol" min="0.5" max="2" step="0.1">' +
        "</div>" +
        '<div class="chem-widget__control">' +
          '<label data-ref="tempLabel">Temperature ' +
            '<span class="chem-widget__control-value" data-ref="tempValue" aria-hidden="true"></span>' +
          "</label>" +
          '<input type="range" class="chem-widget__slider" data-ref="temp" min="5" max="65" step="1">' +
        "</div>" +
        '<div class="chem-equilibrium__buttons">' +
          '<button type="button" class="chem-widget__btn chem-widget__btn--ghost" data-ref="addA">Add N₂O₄</button>' +
          '<button type="button" class="chem-widget__btn chem-widget__btn--ghost" data-ref="removeB">Remove NO₂</button>' +
          '<button type="button" class="chem-widget__btn" data-ref="reset">Reset</button>' +
        "</div>" +
      "</div>" +
      '<div class="chem-widget__status">' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">N₂O₄</span>' +
          '<span class="chem-widget__stat-value" data-ref="statA"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">NO₂</span>' +
          '<span class="chem-widget__stat-value" data-ref="statB"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Q</span>' +
          '<span class="chem-widget__stat-value" data-ref="statQ"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">K</span>' +
          '<span class="chem-widget__stat-value" data-ref="statK"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Status</span>' +
          '<span class="chem-widget__stat-value" data-ref="statStatus"></span></div>' +
      "</div>" +
      '<p class="chem-widget__explanation" data-ref="explanation" aria-live="polite"></p>';

    var ref = {};
    var nodes = el.querySelectorAll("[data-ref]");
    for (var i = 0; i < nodes.length; i++) ref[nodes[i].getAttribute("data-ref")] = nodes[i];

    var uid = "chem-eq-" + Math.random().toString(36).slice(2, 8);
    [["vol", "volLabel"], ["temp", "tempLabel"]].forEach(function (pair) {
      ref[pair[0]].id = uid + "-" + pair[0];
      ref[pair[1]].setAttribute("for", uid + "-" + pair[0]);
    });

    /* -- state ------------------------------------------------------- */

    var destroyed = false;
    var particles = [];        // { x, y, vx, vy, type: 0 = N2O4, 1 = NO2 }
    var cssW = 0, cssH = 0, boxW = 0;
    var ctx = ref.canvas.getContext("2d");
    var rafId = null, lastTs = 0;

    var motionMq = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    function reducedMotion() { return !!(motionMq && motionMq.matches); }

    function volume() { return num(ref.vol.value, 1); }
    function tempK() { return num(ref.temp.value, 25) + 273.15; }

    function counts() {
      var a = 0, b = 0;
      for (var j = 0; j < particles.length; j++) {
        if (particles[j].type === 0) a++; else b++;
      }
      return { a: a, b: b };
    }

    function spawn(type, x, y) {
      // Reduced motion: particles are placed but never drift. Reactions still
      // run, so the chemistry is intact while the nonessential motion is gone.
      var speed = reducedMotion() ? 0 : 26 + Math.random() * 34;
      var ang = Math.random() * Math.PI * 2;
      var r = type === 0 ? A_R : B_R;
      var spanX = Math.max(boxW - 2 * r, 1);
      var spanY = Math.max(cssH - 2 * r, 1);
      particles.push({
        x: x === undefined ? r + Math.random() * spanX : x,
        y: y === undefined ? r + Math.random() * spanY : y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        type: type
      });
    }

    function seed(total) {
      particles.length = 0;
      // Start as all N2O4 so the first thing a learner sees is the approach to
      // equilibrium rather than an already-settled mixture.
      var nA = Math.floor(total / 2);
      for (var j = 0; j < nA; j++) spawn(0);
    }

    /* -- simulation -------------------------------------------------- */

    function react(dt) {
      var c = counts();
      var V = volume();
      var K = equilibriumConstant(tempK());
      var kr = KF / K;

      var fwd = sampleEvents(KF * c.a * dt);
      var rev = sampleEvents(kr * (c.b * c.b / V) * dt);

      var j, p, idx;
      // Forward: one N2O4 becomes two NO2 at the same place.
      for (j = 0; j < fwd; j++) {
        idx = pickIndex(0);
        if (idx < 0) break;
        p = particles[idx];
        particles.splice(idx, 1);
        spawn(1, p.x, p.y);
        spawn(1, p.x, p.y);
      }
      // Reverse: two NO2 combine into one N2O4.
      for (j = 0; j < rev; j++) {
        var i1 = pickIndex(1);
        if (i1 < 0) break;
        p = particles[i1];
        particles.splice(i1, 1);
        var i2 = pickIndex(1);
        if (i2 < 0) { particles.push(p); break; }
        particles.splice(i2, 1);
        spawn(0, p.x, p.y);
      }
    }

    function pickIndex(type) {
      var pool = [];
      for (var j = 0; j < particles.length; j++) if (particles[j].type === type) pool.push(j);
      if (!pool.length) return -1;
      return pool[(Math.random() * pool.length) | 0];
    }

    function move(dt) {
      if (reducedMotion()) return;
      for (var j = 0; j < particles.length; j++) {
        var p = particles[j];
        var r = p.type === 0 ? A_R : B_R;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < r) { p.x = r; p.vx = Math.abs(p.vx); }
        if (p.x > boxW - r) { p.x = boxW - r; p.vx = -Math.abs(p.vx); }
        if (p.y < r) { p.y = r; p.vy = Math.abs(p.vy); }
        if (p.y > cssH - r) { p.y = cssH - r; p.vy = -Math.abs(p.vy); }
      }
    }

    /* Compressing the box must not leave particles outside the wall. */
    function clampIntoBox() {
      for (var j = 0; j < particles.length; j++) {
        var p = particles[j];
        var r = p.type === 0 ? A_R : B_R;
        if (p.x > boxW - r) p.x = Math.max(r, boxW - r);
        if (p.y > cssH - r) p.y = Math.max(r, cssH - r);
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
      boxW = cssW * (volume() / 2);
      clampIntoBox();
      draw();
    }

    function draw() {
      if (!cssW) return;
      ctx.clearRect(0, 0, cssW, cssH);

      // Space the piston has swept out of the container.
      ctx.fillStyle = "#f1f4f8";
      ctx.fillRect(boxW, 0, cssW - boxW, cssH);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, boxW, cssH);
      ctx.strokeStyle = "#5b6b7a";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, Math.max(boxW - 2, 0), cssH - 2);

      for (var j = 0; j < particles.length; j++) {
        var p = particles[j];
        var isA = p.type === 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, isA ? A_R : B_R, 0, Math.PI * 2);
        ctx.fillStyle = isA ? A_COLOR : B_COLOR;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isA ? A_EDGE : B_EDGE;
        ctx.stroke();
      }
    }

    /* -- readouts ---------------------------------------------------- */

    var STATUS = {
      forward: "Q < K — net forward",
      reverse: "Q > K — net reverse",
      equal: "Q ≈ K — at equilibrium"
    };

    function classify(Q, K) {
      if (!isFinite(Q)) return "reverse";
      // A stochastic model never lands exactly on K; treat a 12 % band as settled.
      if (Q < K * 0.88) return "forward";
      if (Q > K * 1.12) return "reverse";
      return "equal";
    }

    function updateReadouts() {
      var c = counts();
      var V = volume();
      var K = equilibriumConstant(tempK());
      var Q = reactionQuotient(c.a, c.b, V);

      ref.statA.textContent = c.a;
      ref.statB.textContent = c.b;
      ref.statQ.textContent = fmtQK(Q);
      ref.statK.textContent = fmtQK(K);
      ref.statStatus.textContent = STATUS[classify(Q, K)];

      ref.volValue.textContent = V.toFixed(1) + " units";
      ref.tempValue.textContent = Math.round(num(ref.temp.value, 25)) + " °C";
      ref.vol.setAttribute("aria-valuetext", V.toFixed(1) + " volume units");
      ref.temp.setAttribute("aria-valuetext",
        Math.round(num(ref.temp.value, 25)) + " degrees Celsius, K is " + fmtQK(K));
    }

    /*
     * Written on discrete user actions only, so the live region stays quiet
     * while the simulation relaxes on its own.
     */
    function say(text) { ref.explanation.textContent = text; }

    function describeShift() {
      var c = counts();
      var K = equilibriumConstant(tempK());
      var Q = reactionQuotient(c.a, c.b, volume());
      var state = classify(Q, K);
      if (state === "forward") {
        return " Q is now below K, so the forward rate outruns the reverse rate " +
          "until the two match again — the mixture drifts toward more NO₂.";
      }
      if (state === "reverse") {
        return " Q is now above K, so the reverse rate outruns the forward rate " +
          "until the two match again — the mixture drifts toward more N₂O₄.";
      }
      return " Q is still close to K, so the mixture is near equilibrium.";
    }

    /* -- events ------------------------------------------------------ */

    function onVolume() {
      boxW = cssW * (volume() / 2);
      clampIntoBox();
      updateReadouts();
      // Repaint immediately: rAF is throttled (or stopped) in a background tab,
      // so relying on the next frame would leave the box visibly stale.
      draw();
    }

    function onVolumeCommit() {
      onVolume();
      say("Changing the volume changes both concentrations, so Q moves — but K " +
        "does not, because K only depends on temperature." + describeShift() +
        " Expanding favours the side with more gas particles (2 NO₂); compressing " +
        "favours the side with fewer (1 N₂O₄).");
    }

    function onTemp() { updateReadouts(); }

    function onTempCommit() {
      updateReadouts();
      say("Temperature is the one change that moves K itself. The forward " +
        "reaction is endothermic, so heating raises K and cooling lowers it." +
        describeShift());
    }

    function onAddA() {
      var c = counts();
      if (2 * c.a + c.b >= TOTAL_MAX) { say("The container is already full for this model."); return; }
      for (var j = 0; j < 6; j++) spawn(0);
      updateReadouts();
      draw();
      say("Adding N₂O₄ raises [N₂O₄], which lowers Q while K stays put." +
        describeShift());
    }

    function onRemoveB() {
      var c = counts();
      if (c.b < 8 || 2 * c.a + c.b - 8 < TOTAL_MIN) { say("There is not enough NO₂ to remove."); return; }
      for (var j = 0; j < 8; j++) {
        var idx = pickIndex(1);
        if (idx < 0) break;
        particles.splice(idx, 1);
      }
      updateReadouts();
      draw();
      say("Removing NO₂ lowers [NO₂], which lowers Q while K stays put." +
        describeShift());
    }

    function onReset() {
      ref.vol.value = String(defaults.volume);
      ref.temp.value = String(defaults.tempC);
      boxW = cssW * (volume() / 2);
      seed(defaults.total);
      updateReadouts();
      draw();
      say("Starting from pure N₂O₄. Watch Q climb from 0 toward K as the forward " +
        "reaction runs faster than the reverse one; once they match, the counts " +
        "hold steady even though conversions keep happening in both directions.");
    }

    /* -- loop -------------------------------------------------------- */

    function frame(ts) {
      // Belt and braces: cleanup cancels the pending frame *and* nulls ctx/ref,
      // so a frame that somehow survived teardown would throw on every tick.
      if (destroyed) return;
      rafId = window.requestAnimationFrame(frame);
      if (!lastTs) lastTs = ts;
      var dt = Math.min((ts - lastTs) / 1000, 0.05);   // clamp after a background tab
      lastTs = ts;
      move(dt);
      react(dt);
      draw();
      updateReadouts();
    }

    var ro = null;
    if (window.ResizeObserver) {
      ro = new window.ResizeObserver(resize);
      ro.observe(ref.canvas);
    } else {
      window.addEventListener("resize", resize);
    }

    ref.vol.addEventListener("input", onVolume);
    ref.vol.addEventListener("change", onVolumeCommit);
    ref.temp.addEventListener("input", onTemp);
    ref.temp.addEventListener("change", onTempCommit);
    ref.addA.addEventListener("click", onAddA);
    ref.removeB.addEventListener("click", onRemoveB);
    ref.reset.addEventListener("click", onReset);

    ref.vol.value = String(defaults.volume);
    ref.temp.value = String(defaults.tempC);
    resize();      // establishes cssW / cssH / boxW
    onReset();     // seeds into the measured box, draws, writes the intro text
    rafId = window.requestAnimationFrame(frame);

    return function cleanup() {
      destroyed = true;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      rafId = null;
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", resize);
      ref.vol.removeEventListener("input", onVolume);
      ref.vol.removeEventListener("change", onVolumeCommit);
      ref.temp.removeEventListener("input", onTemp);
      ref.temp.removeEventListener("change", onTempCommit);
      ref.addA.removeEventListener("click", onAddA);
      ref.removeB.removeEventListener("click", onRemoveB);
      ref.reset.removeEventListener("click", onReset);
      particles.length = 0;
      ref = null;
      ctx = null;
    };
  });
})(window, document);
