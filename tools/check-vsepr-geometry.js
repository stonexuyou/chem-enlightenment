#!/usr/bin/env node
/*
 * Checks that every VSEPR shape is drawn with the bond angles it prints.
 *
 *   node tools/check-vsepr-geometry.js
 *
 * Optional developer aid: needs node, is not part of the build, and has no
 * dependencies. It reads the geometry block out of vsepr.js, measures the angle
 * between every pair of bonded domain vectors, and fails if an angle the widget
 * prints is not actually present in the drawn model.
 *
 * It exists because the first version shared one ideal tetrahedron between
 * CH4, NH3 and H2O, so all three were drawn at 109.5 degrees while the labels
 * read 109.5, 107 and 104.5.
 */
"use strict";
var fs = require("fs");
var path = require("path");

var src = fs.readFileSync(path.join(__dirname, "..", "static", "js", "visualizations", "vsepr.js"), "utf8");
var from = src.indexOf("var RAD");
var to = src.indexOf("/* Bonded domains come first");
if (from < 0 || to < 0) { console.error("could not locate the geometry block in vsepr.js"); process.exit(2); }

// The block defines SHAPES and ORDER; evaluate it in isolation.
var api = new Function(src.slice(from, to) + "; return { SHAPES: SHAPES, ORDER: ORDER };")();

var TOL = 0.6;       // degrees
var failures = 0;

function angle(a, b) {
  var d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.max(-1, Math.min(1, d / (Math.hypot(a[0], a[1], a[2]) * Math.hypot(b[0], b[1], b[2]))))) / (Math.PI / 180);
}
function fail(msg) { failures++; console.log("    FAIL: " + msg); }

api.ORDER.forEach(function (key) {
  var s = api.SHAPES[key];
  var bonds = s.domains.slice(0, s.domains.length - s.lone);
  var measured = [];
  for (var i = 0; i < bonds.length; i++) {
    for (var j = i + 1; j < bonds.length; j++) measured.push(angle(bonds[i], bonds[j]));
  }
  console.log("  " + (key + "      ").slice(0, 7) + (s.example + "     ").slice(0, 6) +
    "prints " + s.angle + "   drawn: " + Array.from(new Set(measured.map(function (m) { return m.toFixed(1); }))).join(", ") + "°");

  s.angles.forEach(function (want) {
    if (!measured.some(function (m) { return Math.abs(m - want) <= TOL; })) {
      fail(key + " prints " + want + "° but no bonded pair in the model is within " + TOL + "° of it");
    }
  });

  s.domains.forEach(function (d, n) {
    var len = Math.hypot(d[0], d[1], d[2]);
    if (Math.abs(len - 1) > 1e-9) fail(key + " domain " + n + " is not a unit vector (length " + len + ")");
  });

  // Electron domains must not sit on top of each other.
  for (var a = 0; a < s.domains.length; a++) {
    for (var b = a + 1; b < s.domains.length; b++) {
      if (angle(s.domains[a], s.domains[b]) < 60) fail(key + " domains " + a + " and " + b + " are closer than 60°");
    }
  }
});

console.log(failures ? "\n" + failures + " problem(s)" : "\nall shapes drawn as printed");
process.exit(failures ? 1 : 0);
