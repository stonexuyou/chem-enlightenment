# Chemistry Visualization Implementation Plan

## Purpose

Implement a reusable visualization foundation for **Chemical Enlightenment** and use it to ship the first production-quality interactive AP Chemistry visualization: a **strong acid / strong base titration simulator** for Unit 8.

This plan is intentionally incremental. Preserve the current lightweight architecture and avoid introducing a frontend framework or build toolchain.

---

## 1. Current repository constraints

Read `CLAUDE.md` before making changes and preserve these repo conventions:

- The site is a **prerendered + hydrated static site**.
- `content/*.md` is the content source of truth.
- `build.py` generates:
  - `dist/<slug>.html`
  - `dist/js/content.js`
- `static/js/app.js` provides client-side navigation by replacing `#app`.
- `templates/base.html` is the page shell.
- `static/css/style.css` contains the current site theme.
- `dist/` is generated output and must never be edited by hand.
- Internal navigation must continue using real `.html` URLs.
- The site must keep working as a normal prerendered multi-page site when hydration is unavailable.

### Architecture rule for this work

Do **not** introduce:

- React
- Vue
- Svelte
- Vite
- Webpack
- npm as a requirement for the 2D visualization work
- a runtime Python backend
- a database
- a new SPA router

Use:

- Vanilla JavaScript
- native SVG for charts/diagrams
- Canvas only where particle animation is materially easier than SVG
- existing CSS variables/theme
- Three.js only later, when the first genuinely 3D visualization is implemented

---

## 2. Primary objective for this implementation

Build the reusable widget lifecycle first, then implement one complete visualization that proves the architecture.

### MVP visualization

**Unit 8 — Acid/Base Titration Simulator**

Initial supported case:

- strong acid titrant: HCl
- strong base analyte: NaOH
- temperature: 25 °C
- HCl concentration: 0.100 M
- NaOH concentration: 0.100 M
- initial NaOH volume: 10.0 mL
- titrant range: 0.0–20.0 mL
- equivalence point: 10.0 mL

The visualization should allow the learner to change titrant volume and immediately see:

1. pH
2. titration curve
3. current point highlighted on the curve
4. approximate indicator/solution color
5. whether the solution is:
   - before equivalence
   - at equivalence
   - after equivalence
6. a short chemistry explanation of what species is in excess

This is an educational model, not a laboratory-grade simulation.

---

## 3. Proposed file structure

Create:

```text
static/
  css/
    visualizations.css

  js/
    visualizations/
      registry.js
      titration.js
```

Do not create a large abstraction hierarchy yet.

After several widgets exist, the structure may evolve toward:

```text
static/js/visualizations/
  registry.js
  chemistry-math.js
  titration.js
  reaction-energy.js
  equilibrium.js
  gas-law.js
  vsepr.js
```

But only add files that are justified by the current implementation.

---

## 4. Visualization embed format

For the first implementation, use a raw HTML placeholder inside the Markdown content.

Example:

```html
<div
  class="chem-widget"
  data-chem-widget="titration"
  data-acid="HCl"
  data-acid-molarity="0.100"
  data-base="NaOH"
  data-base-molarity="0.100"
  data-base-volume-ml="10.0">
  <noscript>
    This interactive titration visualization requires JavaScript.
  </noscript>
</div>
```

### Important

First verify that the current Python-Markdown configuration preserves this HTML correctly.

If it does, **do not modify `build.py`** for the MVP.

Only add shortcode/preprocessor syntax later if repeated raw HTML becomes difficult to maintain.

Possible future syntax, not part of this implementation:

```text
{{chem:titration acid="HCl" base="NaOH"}}
```

---

## 5. Widget registry and lifecycle

Create:

```text
static/js/visualizations/registry.js
```

Expose one small global API:

```javascript
window.ChemViz
```

Recommended responsibilities:

```javascript
ChemViz.register(name, initializer)
ChemViz.initAll(root)
ChemViz.destroyAll()
```

### `register(name, initializer)`

Registers a widget type.

Example conceptual usage:

```javascript
ChemViz.register("titration", function (element, options) {
  // initialize
  return function cleanup() {
    // optional cleanup
  };
});
```

### `initAll(root)`

- Find elements matching:

```text
[data-chem-widget]
```

- Read the requested widget name.
- Skip elements already initialized.
- Call the registered initializer.
- Store cleanup callbacks.
- Mark initialized elements with an attribute such as:

```text
data-chem-widget-initialized="true"
```

### `destroyAll()`

Before client-side page replacement:

- run cleanup callbacks
- clear stored instances

This is important for future widgets that may use:

- `requestAnimationFrame`
- `ResizeObserver`
- window-level event listeners
- Three.js render loops

Even though the first titration widget may not require much cleanup, build the lifecycle correctly now.

### Failure behavior

An unknown widget type must fail gracefully:

- do not break the page
- optionally log a concise `console.warn`
- leave fallback content visible if appropriate

---

## 6. Integrate lifecycle with the existing hydration router

`static/js/app.js` currently replaces the content of `#app` during hydrated navigation.

The visualization lifecycle must work for:

1. direct page load
2. internal SPA-style navigation
3. browser Back
4. browser Forward
5. `file://` preview mode

### Initial load

Load the visualization registry and widget scripts before `app.js`.

At the beginning of the app startup, initialize visualizations on the already-prerendered DOM:

```javascript
if (window.ChemViz) {
  window.ChemViz.initAll(document);
}
```

This initialization should occur **before** the current `file://` early return, so interactive widgets can still work when a generated HTML file is opened directly.

### Before `#app` replacement

Inside `swap(...)`, immediately before replacing `app.innerHTML`:

```javascript
if (window.ChemViz) {
  window.ChemViz.destroyAll();
}
```

### After `#app` replacement

Immediately after inserting the new page HTML:

```javascript
if (window.ChemViz) {
  window.ChemViz.initAll(app);
}
```

Do not rely on `<script>` tags embedded inside Markdown content to initialize a widget.

---

## 7. Update `templates/base.html`

Add the visualization stylesheet after the existing site stylesheet:

```html
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/visualizations.css">
```

At the bottom of `<body>`, preserve explicit script ordering.

Recommended order:

```html
<script src="js/content.js"></script>
<script src="js/visualizations/registry.js"></script>
<script src="js/visualizations/titration.js"></script>
<script src="js/app.js"></script>
```

The exact order can vary if implementation details justify it, but:

- registry must load before widgets register
- widgets must be registered before initial `ChemViz.initAll(...)`
- hydration must continue to work

Do not introduce module bundling for this phase.

---

## 8. Titration simulator chemistry model

### Fixed MVP inputs

```text
Base analyte:
NaOH
0.100 M
10.0 mL

Acid titrant:
HCl
0.100 M

Titrant added:
0.0–20.0 mL
```

### Calculation

Use liters internally.

Initial hydroxide moles:

```text
n_OH = C_base × V_base
```

Hydrogen ion moles added:

```text
n_H = C_acid × V_acid
```

Total volume:

```text
V_total = V_base + V_acid
```

#### Before equivalence

If:

```text
n_OH > n_H
```

then:

```text
[OH-] = (n_OH - n_H) / V_total
pOH = -log10([OH-])
pH = 14 - pOH
```

#### At equivalence

For this strong acid / strong base MVP:

```text
pH = 7.00
```

Use a small numeric tolerance when comparing moles. Do not rely on exact floating-point equality.

#### After equivalence

If:

```text
n_H > n_OH
```

then:

```text
[H+] = (n_H - n_OH) / V_total
pH = -log10([H+])
```

Clamp displayed pH to a sensible visible range if needed, but do not hide the underlying calculation.

### Display precision

Recommended:

- titrant volume: 1 decimal place
- pH: 2 decimal places
- concentrations/moles in explanatory text: appropriate scientific notation or 3 significant figures

---

## 9. Titration simulator UI

The widget should visually fit the current Chemical Enlightenment theme.

Suggested structure:

```text
┌──────────────────────────────────────────────┐
│ Acid–Base Titration                         │
│ HCl (0.100 M) → NaOH (0.100 M, 10.0 mL)    │
│                                              │
│  [simple burette/beaker diagram]             │
│                                              │
│  Titrant added                               │
│  0 mL ─────────────●────────────── 20 mL     │
│                                              │
│  9.8 mL added       pH 10.30                 │
│  Before equivalence                          │
│                                              │
│  [responsive SVG titration curve]            │
│                 ● current state              │
│                                              │
│  Explanation: OH⁻ is still in excess.        │
└──────────────────────────────────────────────┘
```

### Required controls

- native `<input type="range">`
- visible current volume
- Reset button

Optional but useful:

- small preset buttons:
  - `0 mL`
  - `5 mL`
  - `10 mL`
  - `15 mL`
  - `20 mL`

Do not add controls that are not educationally useful.

---

## 10. SVG titration curve

Use **native SVG**, not a chart library.

### Requirements

- responsive `viewBox`
- x-axis: mL HCl added
- y-axis: pH
- pH range: 0–14
- volume range: 0–20 mL
- curve generated from the same chemistry calculation function used for the displayed current state
- highlight:
  - current point
  - equivalence point
- label the equivalence point
- include readable axis labels

Generate enough curve samples to appear smooth.

A simple approach:

- coarse sampling away from equivalence
- finer sampling near 10 mL

or use a sufficiently small uniform interval if performance remains trivial.

Do not duplicate chemistry logic separately for the graph and current-state calculation.

---

## 11. Solution color

Use a simple approximate universal-indicator color mapping based on pH.

This is supporting visual feedback only.

Requirements:

- numeric pH must always be visible
- meaning must not depend on color alone
- do not present the color as a quantitatively exact laboratory prediction

Use discrete ranges or smooth interpolation; either is acceptable if implementation is clear and maintainable.

---

## 12. Dynamic explanation

Display concise AP Chemistry-oriented feedback.

Examples:

### Before equivalence

```text
OH⁻ is in excess. The pH is determined by the concentration of the remaining strong base after neutralization.
```

### At equivalence

```text
Moles of H⁺ added equal the initial moles of OH⁻. For this strong acid–strong base titration at 25 °C, pH = 7.
```

### After equivalence

```text
H⁺ is in excess. The pH is determined by the concentration of excess strong acid after neutralization.
```

Optionally show:

```text
H⁺ + OH⁻ → H₂O
```

Keep explanations short enough that the visualization remains the primary learning tool.

---

## 13. Accessibility requirements

The widget must be usable without a mouse.

### Controls

- range slider must be keyboard accessible
- provide a visible `<label>`
- Reset must be a real `<button>`
- preset controls, if added, must be real buttons

### Dynamic output

Use a status region such as:

```html
<div aria-live="polite">
```

for important changing text, but avoid excessive screen-reader announcements while continuously dragging the slider.

If necessary, update the live region on `change` while the visual rendering can update on `input`.

### Color

Never communicate:

- acidic/basic
- before/after equivalence
- correct/incorrect

with color alone.

### Motion

If animations are added:

```css
@media (prefers-reduced-motion: reduce)
```

must disable or minimize nonessential motion.

---

## 14. Responsive design

Test at minimum:

- 375 px width
- 768 px width
- desktop around 1200 px

The widget must not cause horizontal page scrolling.

On narrow screens:

- controls may stack vertically
- curve must remain readable
- labels may simplify if needed
- minimum touch target size should remain reasonable

Reuse site CSS variables where possible:

```text
--navy
--blue
--blue-2
--ink
--muted
--line
--bg
```

Avoid introducing a second unrelated visual design language.

---

## 15. CSS organization

Put reusable visualization styles in:

```text
static/css/visualizations.css
```

Suggested class naming:

```text
.chem-widget
.chem-widget__header
.chem-widget__controls
.chem-widget__visual
.chem-widget__status
.chem-widget__explanation
.chem-titration
.chem-titration__curve
```

Prefer classes to inline styles.

Keep visualization-specific CSS out of `style.css` unless it is truly global.

---

## 16. Add the MVP widget to Unit 8

Edit:

```text
content/ap-chemistry-sub-page-unit-topics.md
```

Under:

```text
Unit 8: Acids and Bases
```

add:

1. a short introductory paragraph
2. the titration widget placeholder
3. a short static learning takeaway that remains useful even if JavaScript is unavailable

Do not attempt to fill all Unit 8 content as part of this task.

The goal is to prove the interactive architecture, not expand the entire AP Chemistry curriculum in one change.

---

## 17. No-JavaScript behavior

The site already prioritizes prerendered content.

Maintain that principle.

When JavaScript is unavailable:

- page title and Unit 8 explanatory text must still render
- the interactive portion may show a short fallback message
- the rest of the page must remain fully navigable

Interactive visualization itself does not need a static graphical equivalent in the MVP.

---

## 18. Build and manual verification

Run:

```bash
python build.py
```

Then test through an HTTP server, for example:

```bash
python -m http.server 8000 -d dist
```

Open:

```text
http://localhost:8000/ap-chemistry-sub-page-unit-topics.html
```

### Required manual test matrix

#### Direct page load

- widget renders
- slider works
- curve updates
- pH updates
- no console errors

#### Hydrated navigation

From another page:

- navigate to Unit Topics
- widget initializes

Then:

- navigate away
- navigate back
- widget initializes exactly once

#### Browser history

- Back works
- Forward works
- no duplicate controls
- no duplicate event handling
- no console errors

#### `file://`

Open generated Unit Topics HTML directly:

- page works as normal multi-page content
- titration widget should still initialize if JavaScript is enabled
- normal navigation fallback remains intact

#### No JavaScript

Disable JavaScript:

- content remains readable
- fallback text is reasonable
- navigation still works through real HTML files

---

## 19. Chemistry verification cases

Verify the numerical implementation against these known points.

For:

```text
0.100 M NaOH
10.0 mL

titrated with:

0.100 M HCl
```

### 0.0 mL HCl

```text
[OH-] = 0.100 M
pOH = 1.00
pH = 13.00
```

### 5.0 mL HCl

Initial NaOH:

```text
0.00100 mol OH-
```

Added HCl:

```text
0.000500 mol H+
```

Remaining:

```text
0.000500 mol OH-
```

Total volume:

```text
0.0150 L
```

Therefore approximately:

```text
[OH-] = 0.0333 M
pOH ≈ 1.48
pH ≈ 12.52
```

### 10.0 mL HCl

```text
equivalence
pH = 7.00
```

### 15.0 mL HCl

Excess H+:

```text
0.000500 mol
```

Total volume:

```text
0.0250 L
```

Therefore:

```text
[H+] = 0.0200 M
pH ≈ 1.70
```

### 20.0 mL HCl

Excess H+:

```text
0.00100 mol
```

Total volume:

```text
0.0300 L
```

Therefore:

```text
[H+] = 0.0333 M
pH ≈ 1.48
```

Use these as manual regression checks.

---

## 20. Definition of done for MVP

The MVP is complete only when all of the following are true:

- [ ] `registry.js` exists and supports registration/init/cleanup
- [ ] direct-load initialization works
- [ ] SPA page-swap initialization works
- [ ] Back/Forward initialization works
- [ ] `file://` initialization works
- [ ] no framework/build-tool dependency added
- [ ] `titration.js` uses one central chemistry calculation function
- [ ] slider updates pH correctly
- [ ] SVG titration curve updates/highlights current state
- [ ] equivalence point is visible
- [ ] before/equivalence/after status is shown
- [ ] solution color responds approximately to pH
- [ ] numerical pH is always visible
- [ ] keyboard interaction works
- [ ] mobile layout does not overflow
- [ ] `python build.py` succeeds
- [ ] no files under `dist/` are committed or hand-edited
- [ ] no unrelated code is refactored

---

# Phase 2 — Additional 2D visualizations

Do not implement these until the titration architecture is stable.

Recommended order:

## 2.1 Reaction energy / kinetics

AP Chemistry Unit 5 / Unit 6.

Interactive controls:

- activation energy
- catalyst on/off or effectiveness
- product energy / ΔH

Visualization:

- SVG reaction-coordinate diagram
- reactants level
- transition state
- products level

Teach:

- catalyst lowers activation energy
- catalyst does not change ΔH
- exothermic vs endothermic reactions

## 2.2 Equilibrium particle model

AP Chemistry Unit 7.

Use:

- Canvas or SVG

Controls may include:

- add reactant
- remove product
- change volume/pressure
- temperature only if the model clearly defines endothermic/exothermic direction

Teach:

- dynamic equilibrium
- Q vs K conceptually
- Le Châtelier's principle

Avoid implying that particles literally "know" how to shift equilibrium.

## 2.3 Gas-law visualization

AP Chemistry Unit 3.

Start with one model:

- ideal gas law
- Boyle's law
- Charles's law

Possible visual:

- piston/container
- moving particles
- sliders for pressure, volume, or temperature

Canvas is appropriate for particle motion.

## 2.4 Solution dilution

Use SVG or Canvas.

Teach:

```text
M1V1 = M2V2
```

Show:

- same amount of solute
- increasing volume
- lower concentration
- particles distributed through a larger volume

---

# Phase 3 — First 3D visualization

Only after several 2D widgets are working well.

## VSEPR molecular geometry viewer

Recommended first 3D feature:

- linear
- trigonal planar
- tetrahedral
- trigonal pyramidal
- bent
- trigonal bipyramidal
- octahedral

### Technology

Use **Three.js** directly with Vanilla JavaScript.

Do not migrate the site to React or React Three Fiber.

### Requirements before adding Three.js

Decide one dependency strategy:

1. vendor a pinned Three.js build under `static/vendor/`, or
2. use a pinned CDN version

Prefer a pinned version; do not depend on an unversioned URL.

The 3D viewer should be loaded only when needed if practical, but do not build a complicated dependency loader prematurely.

### VSEPR behavior

The viewer is a teaching model, not quantum chemistry.

Use predefined geometry coordinates based on:

- bonding domains
- lone-pair domains

Allow:

- mouse/touch rotation
- keyboard-accessible alternative controls if feasible
- labels for geometry
- bond angles
- electron-domain geometry vs molecular geometry

---

# Phase 4 — Reusable visualization catalog

After at least 3–5 widgets exist, consider adding a dedicated page such as:

```text
AP Chemistry Interactive Visualizations
```

Possible catalog:

```text
Unit 1
- atomic composition
- electron configuration

Unit 2
- VSEPR
- bond polarity
- hybridization

Unit 3
- intermolecular forces
- gas laws
- solutions

Unit 4
- stoichiometric particle ratios

Unit 5
- kinetics / activation energy

Unit 6
- calorimetry / enthalpy

Unit 7
- equilibrium

Unit 8
- titration
- buffers

Unit 9
- Gibbs free energy
- electrochemical cells
```

Do not create this catalog until enough real widgets exist to justify a page.

---

# Phase 5 — Optional embed syntax

Raw HTML is acceptable for the first few widgets.

If repeated embeds become verbose, add a minimal `build.py` preprocessor.

Target authoring experience could become:

```text
{{chem:titration
  acid="HCl"
  acid_molarity="0.100"
  base="NaOH"
  base_molarity="0.100"
  base_volume_ml="10.0"
}}
```

The build step would convert this into the standard widget placeholder.

Requirements if this is implemented:

- deterministic output
- safe parsing
- useful build error for unknown widget names
- no generated inline JavaScript
- same output used by prerendered HTML and `content.js`

This is future work, not required for MVP.

---

# Documentation updates after implementation

Once the MVP works:

## `architecture.md`

Update the interactive-widget section to record:

- `window.ChemViz` registry/lifecycle
- raw HTML widget placeholder convention
- SPA cleanup/init behavior
- SVG/Canvas first approach
- Three.js reserved for true 3D widgets

## `tasks.md`

Move the visualization work from "up next" to the current/active section as appropriate and mark completed items.

Suggested completed entries:

```text
- [x] Choose first visualization architecture
- [x] Implement reusable widget registry/lifecycle
- [x] Add Unit 8 strong acid/strong base titration prototype
- [x] Verify widget lifecycle across hydrated navigation
```

## `plan.md`

Optionally add:

```text
- `visualization-plan.md` — implementation plan for reusable 2D/3D AP Chemistry visualizations
```

Do not rewrite unrelated roadmap content.

---

# Guardrails for Claude Code

When executing this plan:

1. Read `CLAUDE.md`, `architecture.md`, `roadmap.md`, `tasks.md`, `build.py`, `templates/base.html`, `static/js/app.js`, and the Unit Topics Markdown before editing.
2. Implement the **MVP only** first.
3. Do not implement Three.js in the MVP.
4. Do not introduce React or a frontend build system.
5. Do not redesign the whole site.
6. Do not refactor unrelated navigation/build code.
7. Do not edit `dist/`.
8. Reuse the current design variables.
9. Keep chemistry calculation code separate from DOM rendering where practical.
10. Run `python build.py` after changes.
11. Serve `dist/` over HTTP and test direct navigation plus hydrated navigation.
12. Report:
    - files changed
    - architecture decisions made
    - chemistry cases verified
    - manual tests performed
    - any remaining known limitations

---

# Suggested Claude Code execution prompt

Use this after placing this file in the repository:

```text
Read CLAUDE.md and visualization-plan.md completely.

Implement the MVP described in visualization-plan.md: the reusable ChemViz widget lifecycle plus the Unit 8 strong-acid/strong-base titration simulator.

Follow the repository's existing prerendered + hydrated static architecture. Do not introduce React, npm/Vite, a backend, or Three.js for this MVP. Do not edit dist/ manually and do not refactor unrelated code.

Before editing, inspect the current relevant files and confirm the exact integration points. Then implement the changes, run python build.py, and perform the manual checks that can be performed locally.

At the end, summarize:
1. files changed,
2. architecture implemented,
3. chemistry test values verified,
4. navigation/lifecycle tests performed,
5. remaining limitations.
```
