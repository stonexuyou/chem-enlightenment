/*
 * ChemViz — tiny widget registry + lifecycle for Chemical Enlightenment.
 *
 * Content pages embed an inert placeholder:
 *
 *   <div class="chem-widget" data-chem-widget="titration" data-acid="HCl" ...>
 *     <noscript>This interactive visualization requires JavaScript.</noscript>
 *   </div>
 *
 * Widget scripts register an initializer by name; app.js drives the lifecycle:
 * initAll() on first paint (including file://) and, during hydrated navigation,
 * destroyAll() before #app is replaced + initAll() on the new markup.
 *
 * An initializer may return a cleanup function. Nothing here needs one yet
 * beyond removing listeners, but the contract exists now so later widgets can
 * cancel rAF loops, ResizeObservers and Three.js renderers on page swap.
 */
(function (window, document) {
  "use strict";

  var types = {};      // widget name -> initializer
  var instances = [];  // { el: Element, cleanup: Function|null }

  /* data-* attributes become camelCased options, minus the two control keys. */
  function optionsFor(el) {
    var out = {};
    var data = el.dataset || {};
    for (var key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      if (key === "chemWidget" || key === "chemWidgetInitialized") continue;
      out[key] = data[key];
    }
    return out;
  }

  function register(name, initializer) {
    if (!name || typeof initializer !== "function") return;
    types[name] = initializer;
  }

  function initOne(el) {
    if (el.getAttribute("data-chem-widget-initialized") === "true") return;

    var name = el.getAttribute("data-chem-widget");
    var initializer = types[name];
    if (!initializer) {
      // Unknown type: leave the placeholder (and its fallback) alone.
      if (window.console) console.warn('ChemViz: no widget registered for "' + name + '"');
      return;
    }

    // Mark before initializing so a re-entrant initAll can never double-init.
    el.setAttribute("data-chem-widget-initialized", "true");
    var cleanup = null;
    try {
      cleanup = initializer(el, optionsFor(el));
    } catch (err) {
      // A broken widget must not take the page down.
      if (window.console) console.error('ChemViz: "' + name + '" failed to initialize', err);
    }
    instances.push({ el: el, cleanup: typeof cleanup === "function" ? cleanup : null });
  }

  function initAll(root) {
    var scope = root || document;
    if (scope.nodeType === 1 && scope.hasAttribute("data-chem-widget")) initOne(scope);
    if (!scope.querySelectorAll) return;
    var nodes = scope.querySelectorAll("[data-chem-widget]");
    for (var i = 0; i < nodes.length; i++) initOne(nodes[i]);
  }

  function destroyAll() {
    for (var i = instances.length - 1; i >= 0; i--) {
      var inst = instances[i];
      if (inst.cleanup) {
        try {
          inst.cleanup();
        } catch (err) {
          if (window.console) console.error("ChemViz: cleanup failed", err);
        }
      }
      if (inst.el) inst.el.removeAttribute("data-chem-widget-initialized");
    }
    instances.length = 0;
  }

  window.ChemViz = { register: register, initAll: initAll, destroyAll: destroyAll };
})(window, document);
