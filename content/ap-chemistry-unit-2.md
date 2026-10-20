---
title: "AP Chemistry — Unit 2: Compound Structure and Properties"
description: "Rotate 3D VSEPR models and see why lone pairs change molecular geometry."
slug: "ap-chemistry-unit-2"
---
[← Back to Topics by Unit](ap-chemistry-sub-page-unit-topics.html)

## VSEPR and molecular geometry

Valence Shell Electron Pair Repulsion says something almost embarrassingly
simple: **electron domains push each other as far apart as they can get**. A
domain is a single bond, a double bond, a triple bond, or a lone pair — count
them, spread them out, and you have the shape.

The catch is that lone pairs are invisible. You count them when working out the
arrangement, but you do not see them when you look at the molecule. Toggle them
off in the viewer below and watch a tetrahedral arrangement turn into a bent
molecule.

<div class="chem-widget"
     data-chem-widget="vsepr"
     data-shape="AX4">
  <noscript>
    This interactive 3D viewer requires JavaScript. The geometries it covers are
    summarized below.
  </noscript>
</div>

**What to take away:** *electron geometry* counts every domain; *molecular
geometry* counts only the atoms. They are identical when there are no lone
pairs, and they diverge the moment there is one:

| Domains | Electron geometry | Lone pairs | Molecular geometry | Selected bond angles |
|---|---|---|---|---|
| 2 | Linear | 0 | Linear | 180° |
| 3 | Trigonal planar | 0 | Trigonal planar | 120° |
| 3 | Trigonal planar | 1 | Bent | ≈119° |
| 4 | Tetrahedral | 0 | Tetrahedral | 109.5° |
| 4 | Tetrahedral | 1 | Trigonal pyramidal | ≈107° |
| 4 | Tetrahedral | 2 | Bent | ≈104.5° |
| 5 | Trigonal bipyramidal | 0 | Trigonal bipyramidal | 90° and 120° |
| 5 | Trigonal bipyramidal | 1 | Seesaw | ≈87.8°, ≈101.6° and ≈173.1° |
| 5 | Trigonal bipyramidal | 2 | T-shaped | ≈87.5° and ≈174.9° |
| 5 | Trigonal bipyramidal | 3 | Linear | 180° |
| 6 | Octahedral | 0 | Octahedral | 90° |
| 6 | Octahedral | 1 | Square pyramidal | ≈84.8° and ≈89.5° |
| 6 | Octahedral | 2 | Square planar | 90° |

An angle marked ≈ is a rounded reference value for the example molecule, not a
universal value for every molecule with that VSEPR formula. An unmarked angle
is ideal. The table lists selected angles; opposite bonds can also form angles
near 180°. The model reproduces the listed angles to rounding precision, but
bond lengths and lone-pair clouds are schematic. VSEPR predicts arrangements
and qualitative distortions; it does not calculate exact experimental angles.

With five or six domains the lone pairs go where they have the most room. In a
trigonal bipyramid that is the equatorial plane, where a lone pair has two
neighbours at 90° instead of the three it would have on the axis; in an octahedron
two lone pairs go opposite each other, which is why XeF₄ is a flat square.

Notice the angles shrink as lone pairs are added — 109.5° → 107° → 104.5° across
CH₄, NH₃, H₂O. A lone pair is held by only one nucleus instead of two, so it
spreads out more and squeezes the bonding pairs together.


### Angle references and how to read them

The ideal arrangements, including linear AX₂E₃ and square-planar AX₄E₂, follow
[OpenStax Chemistry 2e, §7.6](https://openstax.org/books/chemistry-2e/pages/7-6-molecular-structure-and-polarity).
For the five- and six-domain lone-pair examples, the rounded angles use the
experimental-geometry records in the NIST CCCBDB (checked October 19, 2026):

| Example | Bond pair | NIST reference angle | Viewer |
|---|---|---|---|
| [SF₄](https://cccbdb.nist.gov/expgeom2x.asp?casno=7783600) | Axial–equatorial | 87.81° (from symmetry) | ≈87.8° |
| SF₄ | Equatorial–equatorial | 101.55° | ≈101.6° |
| SF₄ | Axial–axial | 173.07° | ≈173.1° |
| [ClF₃](https://cccbdb.nist.gov/expgeom2x.asp?casno=7790912&charge=0) | Axial–equatorial | 87.45° | ≈87.5° |
| ClF₃ | Axial–axial | 174.9° (from symmetry, planar) | ≈174.9° |
| [BrF₅](https://cccbdb.nist.gov/expgeom2x.asp?casno=7789302&charge=0) | Apical–basal | 84.8° | ≈84.8° |
| BrF₅ | Adjacent basal–basal | 89.53° | ≈89.5° |

For SF₄ and ClF₃, *axial* and *equatorial* refer to the parent trigonal
bipyramid. For BrF₅, *apical* means the top of the square pyramid and *basal*
means one of its four base atoms. NIST cites Tolles and Gwinn (1962) for SF₄,
Müller (2001) for ClF₃, and the Gurvich compilation for BrF₅. These records
include symmetry-derived angles, so not every listed angle is an independent
measurement. The viewer is a model of an isolated molecule, not a claim about
all phases, temperatures or experimental structure definitions.
