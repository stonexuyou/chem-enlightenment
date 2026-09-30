/*
 * VSEPR molecular geometry viewer (AP Chemistry, Unit 2).
 *
 * Registers the "vsepr" ChemViz widget. Vanilla JS + Three.js (vendored,
 * pinned, and loaded on demand -- see static/vendor/three/README.md).
 *
 * A teaching model, not quantum chemistry. Each shape is a fixed set of unit
 * vectors chosen so that electron domains sit as far apart as possible, which
 * is the whole of VSEPR. Lone pairs occupy domains just like bonds do; hiding
 * them is what turns an electron-domain geometry into a molecular geometry, and
 * the widget shows both names side by side so that distinction is unavoidable.
 *
 * Three.js is imported dynamically the first time a viewer initialises, so the
 * other thirteen pages never pay for it.
 */
(function (window, document) {
  "use strict";

  if (!window.ChemViz) return;

  var THREE_URL = "vendor/three/three.module.min.js";

  /* One shared promise: several viewers on a page load the library once. */
  var threePromise = null;
  function loadThree() {
    if (!threePromise) {
      threePromise = import(new URL(THREE_URL, document.baseURI).href);
    }
    return threePromise;
  }

  /* ------------------------------------------------------------------ *
   * Geometry data
   *
   * Unit vectors for the electron-domain arrangements. Bonds and lone pairs
   * are drawn from the same list -- that is the point of the model.
   * ------------------------------------------------------------------ */

  var S3 = Math.sqrt(3) / 2;
  var T = 1 / Math.sqrt(3);

  var TRIGONAL = [[1, 0, 0], [-0.5, S3, 0], [-0.5, -S3, 0]];
  var TETRA = [[T, T, T], [T, -T, -T], [-T, T, -T], [-T, -T, T]];
  var BIPYRAMID = [[1, 0, 0], [-0.5, S3, 0], [-0.5, -S3, 0], [0, 0, 1], [0, 0, -1]];
  var OCTA = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  /*
   * Lone pairs are listed last in each domain set so the remaining positions
   * stay the bonded ones. For the tetrahedral cases this reproduces the
   * familiar NH3 / H2O pictures.
   */
  var SHAPES = {
    AX2:   { formula: "AX₂",   example: "CO₂",  domains: [[1,0,0],[-1,0,0]],
             lone: 0, electron: "Linear", molecular: "Linear", angle: "180°" },
    AX3:   { formula: "AX₃",   example: "BF₃",  domains: TRIGONAL,
             lone: 0, electron: "Trigonal planar", molecular: "Trigonal planar", angle: "120°" },
    AX2E:  { formula: "AX₂E",  example: "SO₂",  domains: TRIGONAL,
             lone: 1, electron: "Trigonal planar", molecular: "Bent", angle: "≈119°" },
    AX4:   { formula: "AX₄",   example: "CH₄",  domains: TETRA,
             lone: 0, electron: "Tetrahedral", molecular: "Tetrahedral", angle: "109.5°" },
    AX3E:  { formula: "AX₃E",  example: "NH₃",  domains: TETRA,
             lone: 1, electron: "Tetrahedral", molecular: "Trigonal pyramidal", angle: "≈107°" },
    AX2E2: { formula: "AX₂E₂", example: "H₂O",  domains: TETRA,
             lone: 2, electron: "Tetrahedral", molecular: "Bent", angle: "≈104.5°" },
    AX5:   { formula: "AX₅",   example: "PCl₅", domains: BIPYRAMID,
             lone: 0, electron: "Trigonal bipyramidal", molecular: "Trigonal bipyramidal",
             angle: "90° and 120°" },
    AX6:   { formula: "AX₆",   example: "SF₆",  domains: OCTA,
             lone: 0, electron: "Octahedral", molecular: "Octahedral", angle: "90°" }
  };

  var ORDER = ["AX2", "AX3", "AX2E", "AX4", "AX3E", "AX2E2", "AX5", "AX6"];

  /* Bonded domains come first, lone pairs take the trailing positions. */
  function split(shape) {
    var d = shape.domains;
    return { bonds: d.slice(0, d.length - shape.lone), lone: d.slice(d.length - shape.lone) };
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ------------------------------------------------------------------ *
   * Widget
   * ------------------------------------------------------------------ */

  var CENTRAL = 0x1c6ea4, TERMINAL = 0xb9ccdd, LONE = 0x8250a0, BOND = 0x9fb3c8;

  ChemViz.register("vsepr", function (el, options) {
    var initial = SHAPES[options.shape] ? options.shape : "AX4";

    el.className = "chem-widget chem-vsepr";
    el.innerHTML =
      '<div class="chem-widget__header">' +
        "<h4>VSEPR: electron domains decide the shape</h4>" +
        "<p>Electron domains — bonds and lone pairs alike — spread out as far " +
        "from each other as they can. Hide the lone pairs and what is left is " +
        "the <em>molecular</em> geometry, which is why H₂O is bent rather than " +
        "linear. Drag to rotate, or focus the model and use the arrow keys.</p>" +
      "</div>" +
      '<div class="chem-vsepr__stage">' +
        '<div class="chem-vsepr__canvas" data-ref="stage" tabindex="0" role="img" ' +
          'aria-label="' + escapeAttr("Rotatable 3D ball-and-stick model. The geometry " +
          "names, bond angle and domain counts are given as text below.") + '">' +
          '<p class="chem-vsepr__status" data-ref="loading">Loading 3D viewer…</p>' +
        "</div>" +
      "</div>" +
      '<p class="chem-vsepr__legend">' +
        '<span class="chem-vsepr__legend-item"><span class="chem-vsepr__key chem-vsepr__key--c"></span>central atom</span> ' +
        '<span class="chem-vsepr__legend-item"><span class="chem-vsepr__key chem-vsepr__key--t"></span>bonded atom</span> ' +
        '<span class="chem-vsepr__legend-item"><span class="chem-vsepr__key chem-vsepr__key--l"></span>lone pair</span>' +
      "</p>" +
      '<div class="chem-widget__controls">' +
        '<div class="chem-widget__control">' +
          '<label data-ref="shapeLabel">Domain arrangement</label>' +
          '<select class="chem-vsepr__select" data-ref="shape">' +
            ORDER.map(function (k) {
              var s = SHAPES[k];
              return '<option value="' + k + '">' + s.formula + " · " + s.example +
                " · " + s.molecular + "</option>";
            }).join("") +
          "</select>" +
        "</div>" +
        '<div class="chem-vsepr__toggles">' +
          '<label class="chem-vsepr__check"><input type="checkbox" data-ref="showLone" checked> ' +
            "Show lone pairs</label>" +
          '<label class="chem-vsepr__check"><input type="checkbox" data-ref="spin" checked> ' +
            "Auto-rotate</label>" +
        "</div>" +
      "</div>" +
      '<div class="chem-widget__status">' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Electron geometry</span>' +
          '<span class="chem-widget__stat-value" data-ref="statE"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Molecular geometry</span>' +
          '<span class="chem-widget__stat-value" data-ref="statM"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Bond angle</span>' +
          '<span class="chem-widget__stat-value" data-ref="statA"></span></div>' +
        '<div class="chem-widget__stat"><span class="chem-widget__stat-key">Domains</span>' +
          '<span class="chem-widget__stat-value" data-ref="statD"></span></div>' +
      "</div>" +
      '<p class="chem-widget__explanation" data-ref="explanation" aria-live="polite"></p>' +
      '<div class="chem-vsepr__actions">' +
        '<button type="button" class="chem-widget__btn" data-ref="reset">Reset view</button>' +
      "</div>";

    var ref = {};
    var nodes = el.querySelectorAll("[data-ref]");
    for (var i = 0; i < nodes.length; i++) ref[nodes[i].getAttribute("data-ref")] = nodes[i];

    var uid = "chem-vsepr-" + Math.random().toString(36).slice(2, 8);
    ref.shape.id = uid + "-shape";
    ref.shapeLabel.setAttribute("for", ref.shape.id);
    ref.shape.value = initial;

    var destroyed = false;
    var three = null, renderer = null, scene = null, camera = null, group = null;
    var ro = null, rafId = null;
    var rotX = 0.35, rotY = 0.6;
    var drag = null;
    var assets = [];          // geometries/materials to dispose on teardown

    var motionMq = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    function reducedMotion() { return !!(motionMq && motionMq.matches); }

    /* -- text readouts work with or without WebGL ---------------------- */

    function current() { return SHAPES[ref.shape.value] || SHAPES.AX4; }

    function updateText() {
      var s = current(), p = split(s);
      var showLone = ref.showLone.checked;
      ref.statE.textContent = s.electron;
      ref.statM.textContent = s.molecular;
      ref.statA.textContent = s.angle;
      ref.statD.textContent = p.bonds.length + " bonding" +
        (s.lone ? " + " + s.lone + " lone" : "");

      var text = s.formula + " (" + s.example + "): " + s.domains.length +
        " electron domains arrange themselves " + s.electron.toLowerCase() + ".";
      if (s.lone) {
        text += " " + s.lone + " of them " + (s.lone === 1 ? "is a lone pair, which" :
          "are lone pairs, which") + " still take up space but are not atoms — so the " +
          "shape you would measure is " + s.molecular.toLowerCase() + ", and the bond " +
          "angle closes to " + s.angle + " because lone pairs repel a little harder " +
          "than bonding pairs.";
      } else {
        text += " With no lone pairs the molecular geometry is the same as the " +
          "electron geometry: " + s.molecular.toLowerCase() + ", " + s.angle + ".";
      }
      if (!showLone && s.lone) text += " (Lone pairs hidden — this is what the molecule looks like.)";
      ref.explanation.textContent = text;
    }

    /* -- 3D scene ------------------------------------------------------ */

    function buildModel() {
      if (!three || !group) return;
      // Drop the previous model and release its GPU buffers.
      for (var i = group.children.length - 1; i >= 0; i--) group.remove(group.children[i]);
      while (assets.length) { var a = assets.pop(); if (a && a.dispose) a.dispose(); }

      var s = current(), p = split(s);
      var showLone = ref.showLone.checked;

      function sphere(pos, radius, color, opacity) {
        var g = new three.SphereGeometry(radius, 32, 24);
        var m = new three.MeshStandardMaterial({
          color: color, roughness: 0.45, metalness: 0.05,
          transparent: opacity < 1, opacity: opacity
        });
        assets.push(g, m);
        var mesh = new three.Mesh(g, m);
        mesh.position.set(pos[0], pos[1], pos[2]);
        return mesh;
      }

      function bond(dir) {
        var len = 1.0;
        var g = new three.CylinderGeometry(0.075, 0.075, len, 16);
        var m = new three.MeshStandardMaterial({ color: BOND, roughness: 0.6 });
        assets.push(g, m);
        var mesh = new three.Mesh(g, m);
        // CylinderGeometry runs along +Y; aim it down the domain vector.
        var v = new three.Vector3(dir[0], dir[1], dir[2]).normalize();
        mesh.quaternion.setFromUnitVectors(new three.Vector3(0, 1, 0), v);
        mesh.position.copy(v.clone().multiplyScalar(len / 2));
        return mesh;
      }

      group.add(sphere([0, 0, 0], 0.42, CENTRAL, 1));
      p.bonds.forEach(function (d) {
        group.add(bond(d));
        group.add(sphere([d[0], d[1], d[2]], 0.28, TERMINAL, 1));
      });
      if (showLone) {
        p.lone.forEach(function (d) {
          // Drawn closer in and translucent: a cloud of charge, not an atom.
          var at = [d[0] * 0.62, d[1] * 0.62, d[2] * 0.62];
          group.add(sphere(at, 0.34, LONE, 0.45));
        });
      }
    }

    function resize() {
      if (destroyed || !renderer) return;
      var r = ref.stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    }

    function frame() {
      if (destroyed) return;
      rafId = window.requestAnimationFrame(frame);
      if (ref.spin.checked && !drag && !reducedMotion()) rotY += 0.005;
      group.rotation.x = rotX;
      group.rotation.y = rotY;
      renderer.render(scene, camera);
    }

    function startScene(T) {
      three = T;
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setClearColor(0x000000, 0);

      scene = new T.Scene();
      camera = new T.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0, 4.6);

      scene.add(new T.AmbientLight(0xffffff, 1.7));
      var key = new T.DirectionalLight(0xffffff, 2.2);
      key.position.set(3, 4, 5);
      scene.add(key);
      var fill = new T.DirectionalLight(0xffffff, 0.8);
      fill.position.set(-4, -2, -3);
      scene.add(fill);

      group = new T.Group();
      scene.add(group);

      ref.loading.remove();
      ref.stage.appendChild(renderer.domElement);
      renderer.domElement.className = "chem-vsepr__gl";

      buildModel();
      resize();

      if (window.ResizeObserver) {
        ro = new window.ResizeObserver(resize);
        ro.observe(ref.stage);
      } else {
        window.addEventListener("resize", resize);
      }
      rafId = window.requestAnimationFrame(frame);
    }

    /* -- interaction --------------------------------------------------- */

    function onPointerDown(e) {
      drag = { x: e.clientX, y: e.clientY };
      if (ref.stage.setPointerCapture && e.pointerId !== undefined) {
        try { ref.stage.setPointerCapture(e.pointerId); } catch (err) { /* not fatal */ }
      }
    }
    function onPointerMove(e) {
      if (!drag) return;
      rotY += (e.clientX - drag.x) * 0.01;
      rotX += (e.clientY - drag.y) * 0.01;
      rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
      drag = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
    function onPointerUp() { drag = null; }

    /* Arrow keys give the same control without a pointer. */
    function onKeyDown(e) {
      var step = 0.18, used = true;
      if (e.key === "ArrowLeft") rotY -= step;
      else if (e.key === "ArrowRight") rotY += step;
      else if (e.key === "ArrowUp") rotX -= step;
      else if (e.key === "ArrowDown") rotX += step;
      else used = false;
      if (used) {
        rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
        e.preventDefault();
      }
    }

    function onShape() { buildModel(); updateText(); }
    function onLone() { buildModel(); updateText(); }
    function onReset() {
      rotX = 0.35; rotY = 0.6;
      ref.stage.focus();
    }

    ref.shape.addEventListener("change", onShape);
    ref.showLone.addEventListener("change", onLone);
    ref.reset.addEventListener("click", onReset);
    ref.stage.addEventListener("pointerdown", onPointerDown);
    ref.stage.addEventListener("pointermove", onPointerMove);
    ref.stage.addEventListener("pointerup", onPointerUp);
    ref.stage.addEventListener("pointercancel", onPointerUp);
    ref.stage.addEventListener("keydown", onKeyDown);

    updateText();

    loadThree().then(function (T) {
      if (destroyed) return;     // navigated away while the library was in flight
      startScene(T);
    }).catch(function (err) {
      if (destroyed) return;
      if (window.console) console.warn("ChemViz vsepr: 3D viewer unavailable", err);
      ref.loading.textContent = "The 3D viewer could not load. The geometry names, " +
        "bond angle and domain counts below still describe each shape.";
      ref.stage.classList.add("chem-vsepr__canvas--failed");
    });

    return function cleanup() {
      destroyed = true;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      rafId = null;
      if (ro) ro.disconnect(); else window.removeEventListener("resize", resize);

      ref.shape.removeEventListener("change", onShape);
      ref.showLone.removeEventListener("change", onLone);
      ref.reset.removeEventListener("click", onReset);
      ref.stage.removeEventListener("pointerdown", onPointerDown);
      ref.stage.removeEventListener("pointermove", onPointerMove);
      ref.stage.removeEventListener("pointerup", onPointerUp);
      ref.stage.removeEventListener("pointercancel", onPointerUp);
      ref.stage.removeEventListener("keydown", onKeyDown);

      // Browsers cap live WebGL contexts (~16). Without this, bouncing between
      // pages would leak one per visit and eventually kill the oldest viewer.
      while (assets.length) { var a = assets.pop(); if (a && a.dispose) a.dispose(); }
      if (renderer) {
        renderer.dispose();
        if (renderer.forceContextLoss) { try { renderer.forceContextLoss(); } catch (e) { /* ignore */ } }
        renderer.domElement = null;
        renderer = null;
      }
      three = scene = camera = group = null;
      ref = null;
    };
  });
})(window, document);
