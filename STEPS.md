# STEPS.md — 3D Scan Maze Extension

Each step is self-contained and testable. Complete 1–2 at a time.

---

## GEOMETRY REFERENCE (read before Phase 3)

This section documents the math so every step uses consistent conventions.

### Global Shape of the Lattice

The entire NxNxN lattice — before and after rotation — is a cube. After the 45° rotation about the long (X) axis, **the whole structure looks like a big version of a single cell**:

- **Front/back face (YZ plane)**: a diamond — a square rotated 45°, pointy top and bottom, widest in the middle
- **Top/bottom**: a ridge point (like the peak of a house roof), not a flat face
- **Left/right**: flat rectangular faces (the X extent, N·sqrt(2) wide)

The full Z_world range of the lattice is **[0, N·sqrt(2)]**:

```
S = 0             → bottom point of the diamond (single-cell sliver, barely visible)
S = N / sqrt(2)   → CENTER, widest point → perfect N×N grid of squares
S = N · sqrt(2)   → top point of the diamond (single-cell sliver, barely visible)
```

**Moving W (up)** from center: cross-section shrinks, corridors pinch, until it reaches a single point at the top.
**Moving S (down)** from center: same effect toward the bottom.
**Starting position** for scan mode: `S = N / sqrt(2)` (center) — player sees the full NxN maze as a grid of squares.

This means: **if the user builds walls only on the j+k=N-1 diagonal in the editor, the maze is only navigable at the center. Walls on other diagonals (j+k=N-2, j+k=N, etc.) appear as the slice moves away from center** — they smoothly grow in from nothing.

### Coordinate Axes

- **i** = column index (0 to N-1), maps to X_world
- **j** = row index (0 to N-1) in the cross-section, maps to Y_world
- **k** = depth layer (0 to N-1), pairs with j to determine slice visibility
- Each prism is 1×1×sqrt(2) (width × depth × long-axis), long axis along X

### World Transform (45° rotation about X axis)

For prism (i, j, k) with local coords Y_local ∈ [j, j+1], Z_local ∈ [k, k+1]:

```
X_world = X_local  (unchanged)
Y_world = (Y_local - Z_local) / sqrt(2)
Z_world = (Y_local + Z_local) / sqrt(2)
```

Total Z_world range of the lattice: **[0, N·sqrt(2)]**

### Slicing

At `sliceOffset` S (world Z height), define `C = S · sqrt(2)`.

A prism (i,j,k) is intersected when `j + k < C < j + k + 2`, i.e., `C ∈ (j+k, j+k+2)`.

Its cross-section rectangle in world space:
```
X_world: [i·sqrt(2),  (i+1)·sqrt(2)]          ← always full width
Y_world: [(2·Y_min - C) / sqrt(2),  (2·Y_max - C) / sqrt(2)]
  where Y_min = max(j,   C - k - 1)
        Y_max = min(j+1, C - k)
```

Height = `(Y_max - Y_min) · sqrt(2)` — shrinks continuously as the slice moves away from the cell's center.

### Center Slice

At `S = N / sqrt(2)` (center), `C = N`:
- Visible cells: exactly those where `j + k = N - 1`
- Each has full height sqrt(2), forming a perfect **N×N grid of squares**
- Row index in this grid = `j` (or equivalently `N-1-k`)

### Start & End — SAME layer, opposite corners

- **Start**: prism `(i=0, j=0, k=N-1)` — top-left of center cross-section (j+k = N-1 → **Layer N**)
- **End**: prism `(i=N-1, j=N-1, k=0)` — bottom-right of center cross-section (j+k = N-1 → **Layer N**)
- Both are passable and coplanar: they share diagonal d = N-1.

### Layer Numbering Convention

The editor labels diagonal `d` as **"Layer d+1"**, so:
- Layer 1 = bottom extreme (d=0, 1 cell wide)
- **Layer N** = center, full N×N grid (d=N-1)
- Layer 2N-1 = top extreme (d=2N-2, 1 cell wide)

Conceptual layers 0 and 2N are the geometric endpoints (single points) — not navigable in the editor but implicit at the scan extremes.

### BFS

3D BFS from Start `(0, 0, N-1)` to End `(N-1, N-1, 0)`, 6-connected (±i, ±j, ±k), through passable cells.

### Collision Notes

- Arrow key movement is constrained to the **current cross-section** (union of all passable rectangles at the current slice)
- The left/right edges of the cross-section (X=0 and X=N·sqrt(2)) act as hard walls
- As a cell's rectangle shrinks with W/S, the player is pushed out via the same nudge loop as the 2D game
- "Flat front/back" (top and bottom of shrinking rectangles) act as walls — no clip through them
- Slide behavior: if fully blocked in one axis, allow movement in the other (same as 2D scan-engine)

---

## PHASE 1 — Scaffold & Shared Foundation

### Step 1 — Create `scan3d.html`

- New HTML entry point
- Load shared styles: `css/base.css`, `css/game.css`
- Load shared scripts in order: `js/globals.js`, `js/maze-core.js`, `js/audio.js`
- Then load new 3D scripts (stubs for now): `js/3d/state3d.js`, `js/3d/lattice.js`, `js/3d/geometry.js`, `js/3d/slice.js`, `js/3d/render3d.js`, `js/3d/player3d.js`, `js/3d/ui3d.js`, `js/3d/init3d.js`
- Mirror layout from `index.html`: header, controls bar, maze section (with canvas), scan section (with canvas), status bar, toast
- Add layer selector UI in the controls bar: `"Layer k: 0  [< >]"` (styled like other controls)
- Add a small `"← 2D Game"` nav link in the header
- Grid size slider: range 2–16, default 5
- **Goal:** page loads, looks like the 2D game, no JS errors even with empty stub scripts

---

### Step 2 — Create `js/3d/state3d.js`

Constants and mutable state specific to the 3D game. **Do not modify `globals.js`.**

```javascript
// Constants
const SLICE_SPEED = 3.5;           // world-Z units per second
const SLICE_CENTER_OFFSET = 1.0;   // fractional nudge applied at startScan
const SQ2 = Math.SQRT2;

// State
let gridSize3d = 5;
let grid3d = [];                   // [k][j][i], 0=pass 1=wall
let currentLayer = 0;              // which k-layer the editor shows
let sliceOffset = 0;               // world Z of the cutting plane
let scanActive3d = false;
let peeking3d = false;
let player3d = { x: 0, y: 0 };    // world-X and world-Y in the cross-section
let bfsPath3d = null;              // array of [i,j,k] or null
let solvable3d = false;
let debugMode3d = false;
const keysDown3d = {};
let lastFrameTime3d = 0;
let celebrateUntil3d = 0;
```

- Add DOM refs for the new page elements (3d-specific canvas IDs, layer display span, layer prev/next buttons, etc.)
- **Goal:** file loads without errors; all globals accessible

---

## PHASE 2 — 3D Lattice & Build Phase

### Step 3 — Build the Layer Editor  ✅ COMPLETE (revised)

**Coordinate convention (IMPORTANT):**

`currentLayer` is the **diagonal index** `d = j + k`, NOT a raw k-slice.

| d value | display label | cross-section |
|---------|--------------|---------------|
| 0       | Layer 1      | 1 col × 1 row (bottom corner) |
| N-1     | **Layer N**  | N × N — **the full playable grid** |
| 2N-2    | Layer 2N-1   | 1 col × 1 row (top corner) |

- `initGrid3d(n)`: allocate `grid3d` as `n×n×n` filled with 0; force Start `(0,0,N-1)` and End `(N-1,N-1,0)` to 0; **set `currentLayer = n-1`** (center diagonal)
- Layer `< >` buttons: cycle `currentLayer` 0 to `2N-2`; display shows `currentLayer + 1`
- Paint: clicked `(row=j, col=i)` → `k = currentLayer - j`; skip if k out of `[0, N-1]`
- Wipe (no Shift): clears only cells on diagonal `d = currentLayer`; Shift wipes all
- Start `(j=0,k=N-1)` and End `(j=N-1,k=0)` are **both on diagonal N-1** ("Layer N") — same layer, opposite corners

### Step 3b — Perspective 3D Prism Editor View  ❌ NEEDS REIMPLEMENTATION

Replace the isometric renderer with a **perspective projection** of the actual prism geometry.
Each cell is a 1×1×√2 rectangular prism whose cross-section is a 45°-rotated square (diamond).
From the chosen camera angle the viewer clearly sees the diamond end-face **and** one long rectangular side ("house roof slope"), giving an unambiguous 3-D read.

Ghost cells form a full wireframe lattice. Passable ghost cells = wireframe only (clear interior).
Wall ghost cells = wireframe + dark semi-transparent "cloudy" fill.
Active diagonal cells = solid coloured fills with back-face culling.

---

#### World Coordinate Transform

Map any pre-rotation lattice corner (ci, cj, ck) — integers in {0 … N} — to world space via the 45° rotation about the X axis:

```javascript
function worldPos(ci, cj, ck) {
    return [
        ci,               // wx — along prism long axis (X); range [0, N]
        (cj - ck) * 0.5, // wy — vertical after rotation;  range [−N/2, N/2]
        (cj + ck) * 0.5  // wz — depth after rotation;     range [0, N]
    ];
}
// Lattice centre: C = [N/2, 0, N/2]
```

The `× 0.5` factor scales the diamond cross-section to 1 world-unit across, matching
the visual expectation. No `SQ2` needed in the editor renderer.

---

#### Camera Setup

```javascript
// ── Tuneable angles ────────────────────────────────────────────────────────
// AZ: azimuth — how far off the X axis the camera sits.
//     0° = head-on diamond face only.  35° chosen so the long rectangular
//     side is clearly visible (Option B per design notes).
// EL: elevation — camera height above the mid-plane.
//     20° shows the diamond roof peak without flattening the structure.
// D:  viewing distance proportional to N.  Increase for less FOV distortion.
const AZ = 35 * Math.PI / 180;
const EL = 20 * Math.PI / 180;
const D  = N * 3.0;

const Cx = N / 2,  Cy = 0,  Cz = N / 2;  // lattice centre

const eye = [
    Cx - D * Math.cos(AZ) * Math.cos(EL),  // in front of face wx=0
         D * Math.sin(EL),                  // above mid-plane
    Cz + D * Math.sin(AZ) * Math.cos(EL)   // offset to reveal long side
];

// Orthonormal camera basis (recomputed once per drawMaze3d call)
const fwd   = norm3(sub3([Cx, Cy, Cz], eye)); // Z_cam — eye → centre
const right = norm3(cross3(fwd, [0, 1, 0]));  // X_cam — camera right
const camUp = cross3(right, fwd);              // Y_cam — camera up
```

Vector helpers (define at module scope, reused throughout):

```javascript
function norm3(v)    { const l=Math.hypot(v[0],v[1],v[2]); return [v[0]/l,v[1]/l,v[2]/l]; }
function sub3(a,b)   { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function cross3(a,b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function dot3(a,b)   { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
```

---

#### Perspective Projection

```javascript
// ~60° vertical FOV — natural feel, low distortion for N ≤ 8.
// Adjust fovDeg here if the view feels too wide or too compressed.
const fovDeg   = 60;
const focalLen = (canvasSize * 0.5) / Math.tan((fovDeg / 2) * Math.PI / 180);
const canvasCx = canvasSize / 2;
const canvasCy = canvasSize / 2;

// Returns [sx, sy, depth] in canvas pixels, or null if behind camera.
function project(wx, wy, wz) {
    const d  = [wx - eye[0], wy - eye[1], wz - eye[2]];
    const cz = dot3(d, fwd);
    if (cz < 0.01) return null;          // behind camera — clip
    const cx = dot3(d, right);
    const cy = dot3(d, camUp);
    return [
        canvasCx + (cx / cz) * focalLen,
        canvasCy - (cy / cz) * focalLen, // canvas Y increases downward
        cz
    ];
}
```

Expose `project`, `eye`, `worldPos` on `window._proj3d` so `paintAt` in `ui3d.js`
can reuse them without re-running the full camera setup:

```javascript
window._proj3d = { project, worldPos, N };
```

---

#### Cell Corner Layout

For cell (i, j, k), build its 8 projected corners once and reuse across all face draws:

```javascript
function getCellCorners(i, j, k) {
    // Index layout — memorise this mapping; all face definitions use it:
    //   0 = (i,   j,   k)   front-diamond  LEFT   vertex
    //   1 = (i+1, j,   k)   back-diamond   left   vertex
    //   2 = (i,   j+1, k)   front-diamond  TOP    vertex  ← house roof peak
    //   3 = (i+1, j+1, k)   back-diamond   top    vertex
    //   4 = (i,   j,   k+1) front-diamond  BOTTOM vertex
    //   5 = (i+1, j,   k+1) back-diamond   bottom vertex
    //   6 = (i,   j+1, k+1) front-diamond  RIGHT  vertex
    //   7 = (i+1, j+1, k+1) back-diamond   right  vertex
    const raw = [
        [i,   j,   k  ], [i+1, j,   k  ],
        [i,   j+1, k  ], [i+1, j+1, k  ],
        [i,   j,   k+1], [i+1, j,   k+1],
        [i,   j+1, k+1], [i+1, j+1, k+1],
    ];
    const pts = raw.map(([ci,cj,ck]) => project(...worldPos(ci, cj, ck)));
    if (pts.some(p => p === null)) return null; // cell straddles camera — skip
    return pts;
}
```

---

#### Face Definitions

Using the corner indices above:

```
FRONT diamond  (wx = i):    [0, 2, 6, 4]   left → top → right → bottom
BACK  diamond  (wx = i+1):  [1, 3, 7, 5]

TOP-LEFT  slope (j+1 edge): [0, 2, 3, 1]   ← "left roof slope",  faces up-left
TOP-RIGHT slope (k+1 edge): [2, 6, 7, 3]   ← "right roof slope", faces up-right

// ── Full 6-face: uncomment the two lines below when needed ──────────────
// BOT-RIGHT side (k edge):  [6, 4, 5, 7]
// BOT-LEFT  side (j edge):  [4, 0, 1, 5]
```

**Back-face culling** — skip any face whose screen-space winding is clockwise
(meaning it faces away from the camera):

```javascript
// Returns true if face [p0, p1, p2, …] faces the camera (CCW winding).
function facingCamera(pts, ...indices) {
    const [ax, ay] = pts[indices[0]];
    const [bx, by] = pts[indices[1]];
    const [cx, cy] = pts[indices[2]];
    return (bx-ax)*(cy-ay) - (by-ay)*(cx-ax) < 0;
}
```

---

#### Colour Coding (active diagonal only)

| Condition | Base colour |
|-----------|-------------|
| Start `(i=0, j=0, k=N−1)` | `#5dffb0` |
| End `(i=N−1, j=N−1, k=0)` | `#ff6a6a` |
| BFS path cell | `#ffd84f` |
| Passable | `#d8e0ff` |
| Wall | `#1a1f30` |

Face brightness multipliers (simulate light from upper-left):

| Face | Multiplier |
|------|-----------|
| TOP-LEFT slope | × 1.00 |
| FRONT diamond | × 0.82 |
| TOP-RIGHT slope | × 0.68 |
| BOT faces | × 0.50 (when enabled) |

```javascript
function shadeHex(hex, t) {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgb(${Math.round(r*t)},${Math.round(g*t)},${Math.round(b*t)})`;
}
```

---

#### Ghost Wireframe & Cloudy Fill

Ghost cells (all cells where `j + k ≠ currentLayer`):

```
dist = |( j + k ) − currentLayer|
alpha_wire = dist===1 ? 0.22 : dist===2 ? 0.13 : 0.06
alpha_fill = alpha_wire * 0.55   (for wall "cloudy" fill)
```

For N ≤ 8, skip cells at dist ≥ 4 (negligible visual contribution).

**Passable ghost cell** — wireframe edges only, no fill.
**Wall ghost cell** — draw a dark semi-transparent fill (`#0a0d1a`) on each visible
face first, then stroke the same edges on top.

##### Wireframe edge deduplication

Each pair of adjacent cells (i, j, k) and (i+1, j, k) shares a diamond face.
Drawing it twice wastes strokes and slightly brightens the line.
Rule: **draw the BACK diamond of cell (i, j, k) only if `i+1 === N`** (it would
be the outermost face with no neighbour).  Otherwise cell (i+1, j, k) will draw
it as its own front diamond.

```javascript
// In strokeCellEdges(pts, i, j, k, N):

strokePoly(pts, 0, 2, 6, 4);          // FRONT diamond — always draw

if (i + 1 === N)                       // BACK diamond — only on lattice boundary
    strokePoly(pts, 1, 3, 7, 5);       // (neighbour's front face is co-linear)

// 4 longitudinal edges connecting front corners to back corners:
strokeLine(pts[0], pts[1]);            // left
strokeLine(pts[2], pts[3]);            // top  (the "roof ridge")
strokeLine(pts[6], pts[7]);            // right
strokeLine(pts[4], pts[5]);            // bottom
// Note: lateral edges on the Y/Z sides (e.g. pts[0]→pts[2]) are part of
// the diamond face polygons and do NOT need separate strokeLine calls.
```

---

#### Rendering Pipeline

```javascript
function drawMaze3d(pathSet) {
    const N = gridSize3d;
    const d = currentLayer;

    // ── 1. Camera & projection setup (inline from Camera Setup section) ──────

    // ── 2. Partition cells ───────────────────────────────────────────────────
    const ghost  = [];
    const active = [];
    for (let k = 0; k < N; k++)
        for (let j = 0; j < N; j++)
            for (let i = 0; i < N; i++) {
                const dist = Math.abs(j + k - d);
                if (dist === 0)        active.push([i, j, k]);
                else if (dist < 4)     ghost.push([i, j, k, dist]);  // N≤8 cutoff
            }

    // ── 3. Sort active cells back-to-front by projected centre depth ─────────
    active.sort((a, b) => {
        const pa = project(...worldPos(a[0]+.5, a[1]+.5, a[2]+.5));
        const pb = project(...worldPos(b[0]+.5, b[1]+.5, b[2]+.5));
        return (pb ? pb[2] : 0) - (pa ? pa[2] : 0);
    });

    // ── 4. Clear ─────────────────────────────────────────────────────────────
    mazeCtx.clearRect(0, 0, canvasSize, canvasSize);

    // ── 5. Ghost pass (back-to-front not strictly required for wireframe,
    //       but sort ghost fills by depth for correctness of cloudy walls) ───
    ghost.sort((a, b) => {
        const pa = project(...worldPos(a[0]+.5, a[1]+.5, a[2]+.5));
        const pb = project(...worldPos(b[0]+.5, b[1]+.5, b[2]+.5));
        return (pb ? pb[2] : 0) - (pa ? pa[2] : 0);
    });
    for (const [i, j, k, dist] of ghost) drawGhostCell(i, j, k, dist, N);

    // ── 6. Active pass — solid fills + edges ─────────────────────────────────
    for (const [i, j, k] of active) drawActiveCell(i, j, k, pathSet, N, d);

    mazeCtx.globalAlpha = 1.0;

    // ── 7. Expose projection state for paintAt ───────────────────────────────
    window._proj3d = { project, worldPos, N };
}
```

---

#### `drawGhostCell(i, j, k, dist, N)`

```javascript
function drawGhostCell(i, j, k, dist, N) {
    const pts = getCellCorners(i, j, k);
    if (!pts) return;
    const aWire = dist===1 ? 0.22 : dist===2 ? 0.13 : 0.06;
    const isWall = grid3d[k][j][i] === 1;

    if (isWall) {
        // "Cloudy" fill — dark semi-transparent fog on each visible face
        mazeCtx.globalAlpha = aWire * 0.55;
        mazeCtx.fillStyle = '#0a0d1a';
        for (const face of [[0,2,6,4],[0,2,3,1],[2,6,7,3]]) {
            // ← Add [6,4,5,7] and [4,0,1,5] here for full 6-face cloudy fill
            if (facingCamera(pts, ...face)) fillFacePts(pts, face);
        }
    }

    mazeCtx.globalAlpha = aWire;
    mazeCtx.strokeStyle = isWall ? '#3d4468' : '#252e52';
    mazeCtx.lineWidth   = 0.8;
    strokeCellEdges(pts, i, j, k, N);
}
```

---

#### `drawActiveCell(i, j, k, pathSet, N, d)`

```javascript
function drawActiveCell(i, j, k, pathSet, N, d) {
    const pts = getCellCorners(i, j, k);
    if (!pts) return;

    const isStart = i===0   && j===0   && k===N-1;
    const isEnd   = i===N-1 && j===N-1 && k===0;
    const isPath  = pathSet && pathSet.has(j+','+i);
    const isWall  = grid3d[k][j][i] === 1;

    const base = isStart ? '#5dffb0' : isEnd ? '#ff6a6a' : isPath ? '#ffd84f'
               : isWall  ? '#1a1f30' : '#d8e0ff';

    mazeCtx.globalAlpha = 1.0;

    // Face order: draw back-facing faces first (they'll be hidden by CCW cull anyway,
    // but explicit ordering avoids z-fighting on shared edges).
    const faces = [
        { idx: [0,2,3,1], shade: 1.00 },  // TOP-LEFT slope  — lightest
        { idx: [0,2,6,4], shade: 0.82 },  // FRONT diamond
        { idx: [2,6,7,3], shade: 0.68 },  // TOP-RIGHT slope
        // ← Uncomment for full 6-face rendering:
        // { idx: [6,4,5,7], shade: 0.50 },  // BOT-RIGHT side
        // { idx: [4,0,1,5], shade: 0.50 },  // BOT-LEFT  side
        // { idx: [1,3,7,5], shade: 0.40 },  // BACK diamond
    ];
    for (const { idx, shade } of faces) {
        if (facingCamera(pts, ...idx))
            fillFacePts(pts, idx, shadeHex(base, shade));
    }

    // Crisp edge strokes on active cells
    mazeCtx.strokeStyle = 'rgba(255,255,255,0.28)';
    mazeCtx.lineWidth   = 1.0;
    strokeCellEdges(pts, i, j, k, N);
}
```

---

#### Canvas Drawing Helpers

```javascript
function fillFacePts(pts, indices, color) {
    mazeCtx.beginPath();
    mazeCtx.moveTo(pts[indices[0]][0], pts[indices[0]][1]);
    for (let n = 1; n < indices.length; n++)
        mazeCtx.lineTo(pts[indices[n]][0], pts[indices[n]][1]);
    mazeCtx.closePath();
    mazeCtx.fillStyle = color;
    mazeCtx.fill();
}

function strokePoly(pts, ...indices) {
    mazeCtx.beginPath();
    mazeCtx.moveTo(pts[indices[0]][0], pts[indices[0]][1]);
    for (let n = 1; n < indices.length; n++)
        mazeCtx.lineTo(pts[indices[n]][0], pts[indices[n]][1]);
    mazeCtx.closePath();
    mazeCtx.stroke();
}

function strokeLine(a, b) {
    mazeCtx.beginPath();
    mazeCtx.moveTo(a[0], a[1]);
    mazeCtx.lineTo(b[0], b[1]);
    mazeCtx.stroke();
}
```

---

#### Paint Input — Perspective Hit-Test

`paintAt` in `ui3d.js` must use `window._proj3d` instead of `window._iso3d`.
Algorithm is unchanged: iterate all cells on the active diagonal, project each
cell's 3D centre via `project(...worldPos(i+.5, j+.5, k+.5))`, pick the closest
to the click in 2D screen space.

Remove references to `cellIso`, `originX`, `originY` from `paintAt`.

---

#### What to Remove / Update

- Delete the `cellIso`, `originX`, `originY`, `isx`, `isy` variables from `lattice.js`.
- In `init3d.js`: the `screenToCanvas` override and `diamondContainer.style.transform = 'none'`
  remain correct (the perspective renderer also does not need the CSS rotation).
- `redraw3d()` in `lattice.js` calls `computeSizes()` solely to set `canvasSize`; that is
  still needed and unchanged.

---

#### Goal

- Full NxNxN lattice visible as a perspective 3D box — diamond end-faces, house-roof slopes, clear depth recession
- Active diagonal cross-section rendered as solid coloured prisms; ghost lattice = wireframe ± cloudy fills for walls
- Navigating layers with `< >` visually sweeps the filled slice through the ghost structure
- Camera angle (AZ/EL/D constants) is clearly labelled for easy tuning

---

### Step 4 — Create `js/3d/lattice.js` — BFS & Serialization

**BFS:**
- `bfs3d()`: 3D BFS from `(0, 0, N-1)` to `(N-1, N-1, 0)` through passable cells, 6-connected neighbors (±i, ±j, ±k), bounds-checked
- Returns array of `[i,j,k]` triples (the path), or `null`
- Sets `bfsPath3d` and `solvable3d`

**Validation feedback:**
- When BFS finds a path: highlight the path on the current layer's canvas (cells where the path passes through `currentLayer` are shown in yellow, same style as 2D BFS highlight)
- Status bar: "Path found! N cells." or "No path found."

**Serialization (can defer to Step 12):**
- `serializeMaze3dToHex()`: `<2-hex N><bit-packed NxNxN>` into `?map3d=` query param
- `tryLoad3dMapFromUrl()`: runs on init to restore from URL

- **Goal:** validate button works; BFS correctly detects solvable/unsolvable 3D mazes; Start Scan enabled only when solvable

---

## PHASE 3 — Geometry Engine

### Step 5 — Create `js/3d/geometry.js` — Slice Intersection

Implements the math from the Geometry Reference above.

```javascript
// Returns { x0, x1, y0, y1 } in world space, or null if no intersection
function getCellSliceRect(i, j, k, S) {
  const C = S * SQ2;
  const yMin = Math.max(j,   C - k - 1);
  const yMax = Math.min(j+1, C - k);
  if (yMin >= yMax) return null;
  return {
    x0: i * SQ2,
    x1: (i + 1) * SQ2,
    y0: (2 * yMin - C) / SQ2,
    y1: (2 * yMax - C) / SQ2
  };
}
```

- `buildCrossSection(S)`: iterate all `(i, j, k)` in `grid3d`, for passable cells call `getCellSliceRect`, collect results into `{ passable: [...rects], startRect, endRect }`
  - Tag Start `(0,0,N-1)` and End `(N-1,N-1,0)` rects separately for coloring
  - Returns only non-null rects

- `getCenterSliceOffset()`: returns `N / SQ2` (the center S value where cross-section is perfect squares)

- **Verify in console:**
  ```javascript
  // With N=3, S=3/sqrt(2) ≈ 2.12, prism (1,1,1) should give a full square
  getCellSliceRect(1, 1, 1, 3/Math.SQRT2)
  // Expected: { x0: sqrt(2), x1: 2*sqrt(2), y0: -sqrt(2)/2, y1: sqrt(2)/2 }
  ```

- **Goal:** geometry function returns correct rectangles; center slice gives N×N perfectly tiled squares

---

### Step 6 — Debug Overlay

- Toggle with `D` key; `debugMode3d` flag
- When active, after the normal scan render, draw on top:
  - Outline each passable rect in **cyan** (1px stroke)
  - Outline Start rect in **green**, End rect in **red**
  - Text overlay (top-left of canvas): `S=2.12  C=3.00  layer=1  cells=9`
  - Player dot highlighted with a larger ring
- On the peek map (when peeking): highlight cells whose rect is currently non-null
- **Goal:** can visually verify geometry matches expectations before wiring player

---

## PHASE 4 — Slice Control & Movement

### Step 7 — Create `js/3d/slice.js` — Slice Updates

```javascript
function updateSlice(dt) {
  if (keysDown3d['w']) sliceOffset += SLICE_SPEED * dt;
  if (keysDown3d['s']) sliceOffset -= SLICE_SPEED * dt;
  // Clamp to full lattice range
  sliceOffset = Math.max(0, Math.min(sliceOffset, gridSize3d * SQ2));
}
```

- After updating `sliceOffset`, if the player is now inside a wall rect (or outside all passable rects), apply nudge: try small offsets in ±X and ±Y until a passable position is found, up to `NUDGE_OFFSETS` distances
- If no nudge succeeds (player is in a closed-off region), hold position and play `playMerp()`
- **Goal:** W/S moves the slice smoothly; player cannot clip through a shrinking wall

---

### Step 8 — Create `js/3d/player3d.js` — Movement & Collision

```javascript
function isInPassable(px, py, rects) {
  return rects.some(r => px > r.x0 + EPS && px < r.x1 - EPS &&
                         py > r.y0 + EPS && py < r.y1 - EPS);
}
```

- `updatePlayer3d(dt, crossSection)`:
  - Read arrow keys from `keysDown3d`
  - Compute `dx`, `dy` from speed × dt (reuse `MOVE_SPEED_V` constant)
  - Try full move: if `isInPassable(newX, newY)` → accept
  - Try X only (slide): if `isInPassable(newX, oldY)` → accept X, play merp
  - Try Y only (slide): if `isInPassable(oldX, newY)` → accept Y, play merp
  - Neither → blocked, play merp (once per collision, not every frame)
  - Collision = the player rect is not inside any passable rect (includes cross-section edges)

- `checkGoal3d(crossSection)`:
  - If `crossSection.endRect !== null` and `isInPassable(player3d.x, player3d.y, [crossSection.endRect])`: win!
  - Call `playCelebrate()`, set `celebrateUntil3d`, show status "You reached the End!"
  - Disable further movement for celebration duration then allow Back

- **Goal:** player navigates freely; walls block; slide along walls works; reaching End triggers win

---

## PHASE 5 — Rendering

### Step 9 — Create `js/3d/render3d.js` — Cross-Section Renderer

`drawScanView3d(timestamp, crossSection)`:

1. Clear canvas to `#0d1018`
2. **Fill passable rects** in `#f2f5ff` — these are the walkable floors
3. **Fill Start rect** in `#5dffb0` (green), End rect in `#ff6a6a` (red)
4. **BFS path highlight**: if `bfsPath3d` contains any `(i,j,k)` whose rect is non-null at current slice, tint those rects `#ffd84f` (yellow), 50% opacity over the path color
5. **Grid lines**: faint lines at X = i·sqrt(2) and Y = j-level boundaries for orientation
6. **Player avatar**: same green dot + squish animation as existing game, drawn at `player3d.{x,y}` mapped to canvas pixel coords
7. **Slice readout**: draw `S = 2.12` and layer info in top-left in monospace cyan (same font style as existing scanner)
8. **Peek overlay**: if `peeking3d`, draw the 2D diamond map semi-transparently over the scan view (show `grid3d[currentLayer]` in diamond orientation)
9. **Celebration**: if within `celebrateUntil3d`, flash the End rect and player

Canvas-to-world mapping:
- World X range [0, N·sqrt(2)] → canvas width (with padding)
- World Y range [-(N/sqrt(2)), N/sqrt(2)] → canvas height (symmetric)
- Store scale factor as `worldToCanvas3d` for use in player and debug rendering

- **Goal:** scan view looks like the existing game's aesthetic; passable area visible; player dot moves correctly

---

## PHASE 6 — Transitions & Wiring

### Step 10 — Create `js/3d/ui3d.js` — Event Wiring

**Keyboard:**
```
Arrow keys   → keysDown3d (player movement)
W / S        → keysDown3d (slice up/down)
P            → peeking3d = true/false (keydown/keyup)
D            → toggle debugMode3d
```

**Touch (reuse pattern from `init.js`):**
- Horizontal swipe → X movement (arrow left/right)
- Vertical swipe → Y movement (arrow up/down)
- Two-finger vertical swipe → slice (W/S)

**`startScan3d()`:**
1. `mazeSection.classList.add('collapsed')` (same class as existing)
2. `scanSection.style.display = 'block'`
3. `sliceOffset = getCenterSliceOffset()` — start at the perfect-square center view
4. Place `player3d` at center of Start rect: `{ x: SQ2/2, y: startRect.y0 + (startRect.y1-startRect.y0)/2 }`
5. Set `scanActive3d = true`
6. `lastFrameTime3d = performance.now()`
7. `requestAnimationFrame(gameLoop3d)`

**`stopScan3d()`:**
1. `scanActive3d = false`
2. Reverse collapse animation
3. Restore edit mode

- **Goal:** full build → scan → back transition works; slice starts at center showing the NxN grid

---

### Step 11 — Create `js/3d/init3d.js` — Game Loop Entry Point

```javascript
function gameLoop3d(timestamp) {
  if (!scanActive3d) return;
  const dt = Math.min((timestamp - lastFrameTime3d) / 1000, 0.1); // cap at 100ms
  lastFrameTime3d = timestamp;

  updateSlice(dt);
  const cs = buildCrossSection(sliceOffset);
  updatePlayer3d(dt, cs);
  checkGoal3d(cs);
  drawScanView3d(timestamp, cs);

  // Update readout spans
  document.getElementById('slice3dReadout').textContent = `S: ${sliceOffset.toFixed(2)}`;

  requestAnimationFrame(gameLoop3d);
}
```

- On page load: `initGrid3d(gridSize3d)`, draw initial maze for `currentLayer = 0`
- Wire all button event listeners (delegate to `ui3d.js` functions)
- `tryLoad3dMapFromUrl()` to restore from URL if present
- **Goal:** complete playable loop; everything works end-to-end

---

## PHASE 7 — Polish & Integration

### Step 12 — URL Sharing

- `serializeMaze3dToHex()`:
  - Format: `<2-hex N><bit-packed N³ bits>`
  - Bits stored in `grid3d[k][j][i]` order, MSB first, packed into hex bytes
  - Prepend `3d` prefix to distinguish from 2D map param: `?map=3d<hex>`
  - Or use a separate param `?map3d=<hex>`
- `tryLoad3dMapFromUrl()`: decode on init, call `initGrid3d` with decoded data
- Get Link button: `navigator.clipboard.writeText(url)` + toast (reuse toast element)
- **Goal:** share a URL, open it, same 3D maze loads

---

### Step 13 — Nav Link in `index.html`

- Add to header: `<a href="scan3d.html" class="btn-link">Try 3D Mode →</a>`
- Matches existing button style
- **Goal:** both pages link to each other; app feels cohesive

---

### Step 14 — Final Polish & Testing

Checklist:
- [ ] Grid sizes 2, 4, 5, 8, 12, 16 all work correctly
- [ ] At center slice, cross-section is visually a perfect NxN grid
- [ ] Moving slice: walls pinch smoothly, no popping/jumping
- [ ] Player can traverse the maze when a path exists
- [ ] Unreachable regions block correctly
- [ ] Win triggers correctly when entering End rect
- [ ] Peek shows current layer's diamond correctly
- [ ] Back button restores edit mode and canvas state
- [ ] No per-frame allocations (reuse arrays in `buildCrossSection`)
- [ ] Mobile touch navigation functional
- [ ] URL sharing round-trips correctly for all N sizes
- [ ] BFS 3D path highlighted on current layer view

---

## Answered Questions

1. **Grid**: NxNxN, each cell individually wall/pass, max N=16.
2. **Start/End**: Both at center cross-section. Start = `(i=0, j=0, k=N-1)` = top-left corner. End = `(i=N-1, j=N-1, k=0)` = bottom-right corner. Coplanar at center slice.
3. **Slice edges**: Act as hard walls (soft-slide if possible, stop if flat). Player stays in 2D plane; only W/S changes the slice.
4. **Win**: Stepping into the End prism's cross-section rectangle (at any sliceOffset where it is visible) triggers win.
