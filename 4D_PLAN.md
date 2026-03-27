# 4D Hyper-Maze: Exhaustive Milestone Map

**Reading guide:**
- "3D truth" = `js/3d/` + `scan3d.html` — working reference implementation.
- "4D rough draft" = `js/4d/` + `scan4d.html` — the starting point; much has been fixed.
- Each milestone lists: what was wrong, the 3D analog it mirrors, which files changed, and what "done" looks like.
- ✅ = implemented and wired.  ⏳ = pending.

---

## Controls Reference

### Edit Mode
| Action | Control |
|---|---|
| Paint wall | Left-click a cube |
| Erase wall | Right-click a cube |
| Navigate hyper-layer (x+w diagonal) | Hyper-Layer ◀ / ▶ buttons |
| Focus Z-slice within prism | Z-Layer ◀ / ▶ buttons |
| Release Z-focus (show all) | Release button |
| Resize grid | Grid Size slider |
| Check solvability | Validate button |
| Clear active hyper-layer | Wipe Layer button |
| Clear entire grid | Shift + Wipe Layer |
| Orbit camera | Middle-drag or R + left-drag |
| Reset camera | Reset Camera button |
| Get shareable URL | Get Link button (appears when solvable) |

### Scan Mode
| Action | Control |
|---|---|
| Move X axis | ← / → Arrow keys |
| Move Y axis | ↑ / ↓ Arrow keys |
| Move Z axis | W / S |
| Shift hyper-slice (4th dimension) | E (forward) / D (backward) |
| Peek at edit view for current diagonal | Hold P |
| Exit scan / return to editor | Stop Scan button |

> **Navigation note:** All six movement keys (←→↑↓WS) and both hyper-slice keys (ED) are
> held-state: hold a key to move continuously, release to stop.  Collision physics applies
> swept movement with nudge-sliding so you can hug walls and slide around corners.
> The hyper-slice shift (E/D) moves you through the hidden fourth dimension — the 3D cross-section
> you see will morph as cells enter and leave the cutting hyperplane.  Near the edges of the
> slice range the world thins to a flat plane; the full N×N×N grid is visible at center.

---

## Phase 0 — Architecture Corrections ✅
*These were load-bearing bugs. All four are resolved.*

---

### M0.1 — Fix Start/End anchor coordinates ✅

**What was wrong:**
`getStartCell4d()` returned `{x:0, y:0, z:floor(N/2)}` with no W component.

**Fix applied:**
- Start = `(x=0, y=0, z=0, w=N-1)` → hyperdiagonal `x+w = N-1` ✓
- End = `(x=N-1, y=N-1, z=N-1, w=0)` → same center hyperdiagonal ✓
- `grid4d[N-1][0][0][0]` and `grid4d[0][N-1][N-1][N-1]` always forced passable.

**Files:** `js/4d/4d-core.js`

---

### M0.2 — Fix hyperLayer diagonal convention ✅

**What was wrong:**
`hyperOffset` tracked a raw W index (0..N-1).

**Fix applied:**
- Renamed to `hyperLayer`, range 0..2*(N-1), semantic `x+w`.
- Center = N-1, displayed as "Layer N".
- `hyperLayerToSlice4d(d4) = (d4+1)/√2` gives full-width cells.

**Files:** `js/4d/4d-core.js`, `js/4d/init4d.js`, `scan4d.html`

---

### M0.3 — Fix drawEditLayer4d to render the hyperdiagonal slice ✅

**What was wrong:**
Iterated all (x,y,z) for a fixed W = `hyperOffset`.

**Fix applied:**
Iterates only cells where `x+w = hyperLayer`.  Ghost cells deferred to M10.2.
Z-layer focus (`editLayerZ4d`) flags inactive z-slices as ghosts within the active prism.

**Files:** `js/4d/render4d.js`

---

### M0.4 — Fix drawScanSlice4d toWorld axis mapping ✅

**What was wrong:**
A single `toWorld(v)` applied to all axes; scan_x is centred but scan_y/z are not.

**Fix applied:**
```javascript
toWorldX(v, N) = v / √2 + (N-1)/2   // centred diagonal axis
toWorldY(v)    = v / √2              // origin-relative
toWorldZ(v)    = v / √2
```

**Files:** `js/4d/render4d.js`

---

## Phase 1 — BFS and Solvability Gate ✅

---

### M1.1 — Implement 4D BFS ✅

8-connected BFS (±x ±y ±z ±w) from `(0,0,0,N-1)` to `(N-1,N-1,N-1,0)`.
Sets `bfsPath4d` and `solvable4d`.  `getBfsPathSet4d()` for scan renderer.
`getBfsPathSetForHyperDiagonal(d4)` for edit-mode path highlight on the active layer.

**Files:** `js/4d/4d-core.js`

---

### M1.2 — BFS gate, validate/wipe buttons, path highlight in edit mode ✅

- `btnScan` gated on `solvable4d`.
- `btnValidate` runs BFS and reports path length.
- `btnWipe`: plain click clears active hyperdiagonal; Shift+click clears entire grid.
- `btnGetLink` hidden until solvable.
- Every paint auto-validates so the Scan button stays in sync.
- Path cells highlighted gold in edit view via `getBfsPathSetForHyperDiagonal`.

**Files:** `scan4d.html`, `js/4d/init4d.js`

---

## Phase 2 — Continuous Player and 3D Physics ✅

---

### M2.1 — buildCrossSection4d and world-space box geometry ✅

`buildCrossSection4d(S4)` iterates all (w,z,y,x), calls `getCellSliceSegment4d`, converts
via `segToWorldBox` to world-space boxes, returns `{passable[], startBox, endBox, pathBoxes[]}`.

**Files:** `js/4d/4d-core.js`

---

### M2.2 — Continuous float player and occupancy check ✅

`player4d = { sx, sy, sz }` — float world-space position.
`canOccupy4d` samples 19 points (center + 6 cardinal + 12 body-diagonal) at `PLAYER4D_RADIUS=0.14`.

**Files:** `js/4d/4d-core.js`

---

### M2.3 — Swept movement, nudging, and sliding ✅

`sweepMove4d` — stepped collision in small increments (`PLAYER4D_SWEEP_STEP = radius × 0.35`).
`tryAxisSlide4d` — nudges secondary axes to slide around corners (7 nudge offsets).
`moveWithNudge4d` — full move → axis-slide fallback sorted by largest remaining delta.
`stabilizePlayer4d` — 3D ring search outward; fallback to startBox center.

**Files:** `js/4d/4d-core.js`

---

### M2.4 — Wire continuous movement into game loop ✅

`updatePlayer4d(dt, cs)` reads `keysDown4d` every frame (held-state, not keydown-edge).
Movement keys: `ArrowLeft/Right` = X, `ArrowUp/Down` = Y, `W/S` = Z.

**Files:** `js/4d/4d-core.js`, `js/4d/init4d.js`

---

### M2.5 — Wire hyper-slice input to use buildCrossSection4d ✅

`updateHyperSliceFromInput4d(dt)` moves `hyperSliceOffset` continuously with E/D.
Stabilization happens inside `updatePlayer4d` at the start of each frame.

**Files:** `js/4d/4d-core.js`

---

## Phase 3 — Phase Transitions and Win State ✅

---

### M3.1 — startScan4d / stopScan4d phase transitions ✅

`setScanActive4d(true)`: snaps slice to active diagonal center, places player at startBox center,
locks edit controls, changes button text, shows scan readout.
`setScanActive4d(false)`: snaps hyperLayer to nearest diagonal, restores controls.

**Files:** `js/4d/4d-core.js`, `js/4d/init4d.js`

---

### M3.2 — Win detection and celebration ✅

`playerHitsEnd4d(cs)` — float `pointInBox4d` test against `cs.endBox`.
On win: `playCelebrate()`, exit scan, status message "Scan complete — reached the End!".

**Files:** `js/4d/4d-core.js`, `js/4d/init4d.js`

---

## Phase 4 — Audio ✅

---

### M4.1 — Wire audio.js ✅

`audio.js` loaded in `scan4d.html`.
`triggerBlocked4d()` calls `playMerp()` with 130 ms cooldown and sets error status.
Win calls `playCelebrate()`.

**Files:** `scan4d.html`, `js/4d/4d-core.js`

---

## Phase 5 — Scan Rendering Improvements ✅

---

### M5.1 — Path highlighting in scan view ✅

`drawScanSlice4d` uses `isPath` flag (from `pathSet`) to color BFS path cells gold (`#ffd84f`).
Active-layer path cells full gold; inactive-layer path cells at 22% alpha.

**Files:** `js/4d/render4d.js`

---

### M5.2 — Player avatar in scan view ✅

`drawEditLayer4d` and `drawScanSlice4d` both check whether the player's float world-space
position falls within each cell's world-space box and mark it `isPlayer = true`.
Player cubes render bright green (`#7dff2e`, alpha 0.9) with a light stroke.

**Files:** `js/4d/render4d.js`

---

### M5.3 — Scan mode HUD readouts ✅

`updateScanReadout4d(cs)` shows: S offset, player sx/sy/sz, cell type (START/END/BFS PATH/PATH/VOID),
and a PEEKING indicator when P is held.  Rendered in a `#scanReadout4d` div below the canvas.

**Files:** `js/4d/init4d.js`, `scan4d.html`

---

## Phase 6 — Peek Mode and Debug

---

### M6.1 — Peek mode (P key shows editor while scanning) ✅

`peeking4d` flag set on P keydown; cleared on P keyup.
In the game loop: if peeking, `hyperLayer = pickEditorLayerForHyperSlice4d()` and
`drawHyperVolume4d()` calls `drawEditLayer4d()` instead of `drawScanSlice4d()`.
HUD shows "PEEKING" indicator.

**Files:** `js/4d/init4d.js`, `js/4d/render4d.js`, `js/4d/4d-core.js`

---

### M6.2 — Debug overlay (D key) ⏳

D key toggles `debugMode4d`.
In scan mode: draw outlined boxes on all passable/start/end boxes with coordinate labels.
In edit mode: overlay a center-slice preview panel.

**Files:** `js/4d/init4d.js`, `js/4d/render4d.js`

---

## Phase 7 — URL Sharing ✅

---

### M7.1 — Serialize / deserialize 4D grid ✅

`serializeMaze4dToHex()` — `<2-hex N><nibble-packed bits>`, iteration order w/z/y/x, trailing zeros trimmed.
`applySerializedMap4d(str)` — parses N, fills grid, calls BFS.
`tryLoadMapFromUrl4d()` — reads `?map4d=` on page load; auto-starts scan if solvable.

**Files:** `js/4d/4d-core.js`, `js/4d/init4d.js`

---

### M7.2 — Get Link button ✅

`btnGetLink` hidden until solvable; click serializes grid, writes `?map4d=` to URL,
copies to clipboard, shows status message.

**Files:** `scan4d.html`, `js/4d/init4d.js`

---

## Phase 8 — Navigation Links ✅

---

### M8.1 — Add 4D nav links across all pages ✅

- `index.html`: "3D Game →" and "4D Game →" links in header.
- `scan3d.html`: "4D Game →" link alongside existing links.
- `scan4d.html`: "← 2D Game" and "← 3D Game" links in header.

**Files:** `index.html`, `scan3d.html`, `scan4d.html`

---

## Phase 9 — Touch / Mobile Support

---

### M9.1 — Touch event handlers ✅

Single-finger tap/drag: paint (left = set wall, right = erase — tap context unclear on mobile;
consider single tap = toggle, long-press = erase).
Two-finger swipe vertical: hyper-layer nav (hyperLayer ± 1).
In scan mode: on-screen D-pad or swipe-to-move (stretch).

**Files:** `js/4d/init4d.js`, `scan4d.html`

---

## Phase 10 — Stretch Goals

---

### M10.1 — Hyper-slice position overlay in edit view ⏳

Translucent tint on cells where `|x+w - (hyperSliceOffset·√2)| < 0.5`,
showing where the scan hyperplane currently sits within the edit volume.

**Files:** `js/4d/render4d.js`

---

### M10.2 — Adjacent hyperdiagonal ghost cells ✅

Currently only active hyperdiagonal cells are drawn in edit mode.
Render adjacent diagonals (d4 ± 1, ± 2, …) at progressively lower alpha as structural context,
matching how `drawMaze3d` renders the full 3D volume with ghost layers.

**Files:** `js/4d/render4d.js`

---

### M10.3 — Hyper-layer progress bar ✅

Horizontal bar below the canvas showing `hyperSliceOffset` within `[bounds.min, bounds.max]`.
Edit mode: discrete step markers at each integer diagonal.

**Files:** `scan4d.html`, `js/4d/init4d.js`

---

### M10.4 — Onboarding text / first-run hint ✅

Dismissible hint on first scan entry:
"E/D shifts the hyper-slice — watch the world breathe as a new dimension opens up.
Near the edges of the range the 3D world collapses toward a flat plane."

**Files:** `scan4d.html`, `js/4d/init4d.js`

---

## Implementation Status

```
Phase 0 (correctness): M0.1 ✅  M0.2 ✅  M0.3 ✅  M0.4 ✅
Phase 1 (playable):    M1.1 ✅  M1.2 ✅
Phase 2 (physics):     M2.1 ✅  M2.2 ✅  M2.3 ✅  M2.4 ✅  M2.5 ✅
Phase 3 (transitions): M3.1 ✅  M3.2 ✅
Phase 4 (audio):       M4.1 ✅
Phase 5 (render):      M5.1 ✅  M5.2 ✅  M5.3 ✅
Phase 6 (peek/debug):  M6.1 ✅  M6.2 ⏳
Phase 7 (sharing):     M7.1 ✅  M7.2 ✅
Phase 8 (nav):         M8.1 ✅
Phase 9 (touch):       M9.1 ✅
Phase 10 (stretch):    M10.1 ⏳  M10.2 ✅  M10.3 ✅  M10.4 ✅
Phase 11 (camera-rel): M11.1 ✅
```

**Shippable baseline (Phases 0–9 + M10.2–10.4):** ✅ Complete.  The game is fully playable.

**Remaining:**
- M6.2: Debug overlay (low priority, skippable)
- M10.1: Hyper-slice position overlay in edit view (low priority)
- M11.1: Camera-relative arrow key remapping ✅

---

## Phase 11 — Camera-Relative Arrow Key Remapping

---

### M11.1 — Snap arrow keys to nearest camera-facing quadrant ✅

**What is wrong now:**
`updatePlayer4d` in `js/4d/4d-core.js` hard-codes ArrowLeft/Right to ±X and ArrowUp/Down to ±Y regardless of camera orientation, so when the user orbits the view 180° the controls feel inverted.

**Desired behaviour:**
The four arrow keys should map to world-space X/Y axes in a way that matches the camera's current horizontal facing, snapped to the nearest 90° quadrant.  Z (W/S) and the hyper-slice (E/D) are unaffected.

**Camera variable:**
`cameraAz4d` (radians, module-level in `js/4d/render4d.js`) is the camera's azimuth.  It is already a plain global, so `4d-core.js` can read it directly.  Positive `cameraAz4d` rotates the camera counter-clockwise when viewed from above (consistent with `cos(AZ)` / `sin(AZ)` usage in `project3d`).

**Face computation:**
Convert `cameraAz4d` to a normalised degree value, then snap to one of four quadrant indices:

```
azDeg = ((cameraAz4d × 180 / π) mod 360 + 360) mod 360
face  = floor((azDeg + 45) / 90) mod 4
```

`face` is an integer 0–3 with the following meaning:

| face | azDeg range  | Camera is "facing toward" |
|------|-------------|---------------------------|
| 0    | [315°, 45°) | –Y world direction        |
| 1    | [45°, 135°) | +X world direction        |
| 2    | [135°, 225°)| +Y world direction        |
| 3    | [225°, 315°)| –X world direction        |

**Key → world-axis lookup tables (index = face):**

```
DX_RIGHT = [ 1,  0, -1,  0]   // world dX produced by pressing ArrowRight
DY_RIGHT = [ 0,  1,  0, -1]   // world dY produced by pressing ArrowRight
DX_UP    = [ 0, -1,  0,  1]   // world dX produced by pressing ArrowUp
DY_UP    = [ 1,  0, -1,  0]   // world dY produced by pressing ArrowUp
```

Verification against user spec (all four faces):

| face | ↑ key    | ↓ key    | → key    | ← key    |
|------|----------|----------|----------|----------|
| 0    | +Y       | −Y       | +X       | −X       |
| 1    | −X       | +X       | +Y       | −Y       |
| 2    | −Y       | +Y       | −X       | +X       |
| 3    | +X       | −X       | −Y       | +Y       |

**Implementation — replace the dx/dy block in `updatePlayer4d`:**

```javascript
// Camera-relative axis remap (M11.1).
// face 0 = az near 0°, face 1 = near 90°, face 2 = near 180°, face 3 = near 270°.
const azDeg = ((cameraAz4d * 180 / Math.PI) % 360 + 360) % 360;
const face  = Math.floor((azDeg + 45) / 90) % 4;
const DX_RIGHT = [ 1,  0, -1,  0];
const DY_RIGHT = [ 0,  1,  0, -1];
const DX_UP    = [ 0, -1,  0,  1];
const DY_UP    = [ 1,  0, -1,  0];

const horiz = (keysDown4d['ArrowRight'] ? 1 : 0) - (keysDown4d['ArrowLeft'] ? 1 : 0);
const vert  = (keysDown4d['ArrowUp']    ? 1 : 0) - (keysDown4d['ArrowDown'] ? 1 : 0);

let dx = horiz * DX_RIGHT[face] + vert * DX_UP[face];
let dy = horiz * DY_RIGHT[face] + vert * DY_UP[face];
let dz = 0;
if (keysDown4d['KeyW']) dz += 1;
if (keysDown4d['KeyS']) dz -= 1;
```

The rest of `updatePlayer4d` (speed scaling, `moveWithNudge4d`, hyper-slice update, win check) is unchanged.

**No other files need to change.**  `cameraAz4d` is already a global; the HUD readout already displays `az` in degrees so the player can see which quadrant they are in.

**Done when:**
- Rotating the camera 90° clockwise causes the arrow keys to remap to the next quadrant with no discontinuity mid-move.
- Rotating 180° fully inverts the feel as expected.
- W/S/E/D are unaffected.
- No regression in collision physics or win detection.

**Files:** `js/4d/4d-core.js`

---

## What is Already Correct (Do Not Break)

- `getCellSliceSegment4d()` — the `x+w=C` hyperplane intersection math is geometrically correct. ✓
- `getSliceBounds4d()` — correct bounds formula. ✓
- `project3d()` + vector helpers — correct perspective pipeline. ✓
- `grid4d[w][z][y][x]` — correct storage order. ✓
- `pickCellFromScreen4d()` — correct pick-buffer approach. ✓
- `drawCube()` — correct cube renderer; color scheme established. ✓
- Camera orbit (mouse drag, R key, Reset Camera button) — correct. ✓
- `HYPER_SLICE_SPEED`, `clamp4d()` — fine. ✓
