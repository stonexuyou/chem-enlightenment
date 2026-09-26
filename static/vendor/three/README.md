# Three.js — vendored, pinned

    version:  0.186.1
    source:   https://cdn.jsdelivr.net/npm/three@0.186.1/build/
    licence:  MIT (see the header inside each file)

Vendored rather than loaded from a CDN so the site keeps working with no
network dependency and no npm, matching the rest of the build.

## The one local modification

Upstream `three.module.min.js` imports `"./three.core.js"` — the *unminified*
core — so shipping the minified pair as-is would pull in 1.4 MB of unminified
code. Both occurrences were rewritten to `"./three.core.min.js"`. Nothing else
was touched; reversing that substitution reproduces the upstream file exactly.

    789 KB (minified pair)  vs  2070 KB (unminified pair)

## Upgrading

1. Download `three.module.min.js` and `three.core.min.js` for the new version.
2. Re-apply the import rewrite:
   `sed 's|"\./three\.core\.js"|"./three.core.min.js"|g'`
3. Update the version above, rebuild, and check the VSEPR widget still renders.

Only `vsepr.js` uses Three.js, and it loads it on demand — the other thirteen
pages never fetch it.
