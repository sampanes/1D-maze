/**
 * js/4d/4d-core.js
 *
 * Core state and geometry for the 4D editor/scanner.
 *
 * Phase 0 corrections applied:
 *  - Start/End anchors placed on center hyperdiagonal x+w = N-1.
 *  - `hyperLayer` tracks diagonal index d4 = x+w (0..2*(N-1)), NOT a raw W index.
 *  - `hyperLayerToSlice4d(d4)` gives the slice offset where cells on d4 have full width.
 *  - Removed layerOffset3d (no separate Z-layer concept; mirrors 3D's single currentLayer).
 */

const SQRT2_4D = Math.SQRT2;

// Units are "grid-cells per second" in slice-space S.
// Kept conservative so stabilization has time to keep the player legal.
const HYPER_SLICE_SPEED = 3.2;

let gridSize4d = 5;

// Storage order [w][z][y][x] so a single w-layer is grid4d[w].
let grid4d = []; // [w][z][y][x]

// `hyperLayer` is the active hyperdiagonal index d4 = x+w.
// Range: 0 to 2*(N-1).  Center = N-1, displayed as "Layer N".
// Mirrors 3D's `currentLayer = i+k` convention exactly.
let hyperLayer = 0;

// Continuous scan parameter S for the x+w = S*√2 cutting hyperplane.
let hyperSliceOffset = 0;

let scanActive4d = false;
let keysDown4d = {};

// Float world-space player position (set here so initGrid4d can reset it before physics loads).
let player4d = { sx: 0, sy: 0, sz: 0 };

// Z-layer focus within the active hyperdiagonal prism.
// -1 = released (all Z visible at full opacity); 0..N-1 = focused z-slice.
let editLayerZ4d = -1;

// ── Anchor cells ──────────────────────────────────────────────────────────────
//
// Start = (x=0, y=0, z=0, w=N-1) → x+w = N-1  (center hyperdiagonal)
// End   = (x=N-1, y=N-1, z=N-1, w=0) → x+w = N-1  (same center hyperdiagonal)
//
// This mirrors 3D where Start=(i=0,j=0,k=N-1) and End=(i=N-1,j=N-1,k=0)
// both live on diagonal i+k = N-1.

function getStartCell4d() {
    const N = gridSize4d;
    return { x: 0, y: 0, z: 0, w: N - 1 };
}

function getEndCell4d() {
    const N = gridSize4d;
    return { x: N - 1, y: N - 1, z: N - 1, w: 0 };
}

function isStartCell4d(x, y, z, w) {
    const N = gridSize4d;
    return x === 0 && y === 0 && z === 0 && w === N - 1;
}

function isEndCell4d(x, y, z, w) {
    const N = gridSize4d;
    return x === N - 1 && y === N - 1 && z === N - 1 && w === 0;
}

function isAnchorCell4d(x, y, z, w) {
    return isStartCell4d(x, y, z, w) || isEndCell4d(x, y, z, w);
}

// ── Diagonal / layer helpers ──────────────────────────────────────────────────

function maxHyperLayerIndex4d() {
    // Diagonal x+w ranges from 0 to 2*(N-1).
    return 2 * (gridSize4d - 1);
}

function clamp4d(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

// Convert a hyperLayer (diagonal index d4) to the slice-space offset S that
// gives FULL cell visibility for that diagonal.
//
// Derivation: cells on x+w=d4 have full width [x, x+1] when C = d4+1
// (verified: xMin_seg=x, xMax_seg=x+1 → width 1).  So S = (d4+1)/√2.
//
// This mirrors 3D's getCenterSliceOffset() = N/√2 = ((N-1)+1)/√2.
function hyperLayerToSlice4d(d4) {
    return (d4 + 1) / SQRT2_4D;
}

// ── Grid ─────────────────────────────────────────────────────────────────────

function initGrid4d(n) {
    gridSize4d = n;
    grid4d = Array.from({ length: n }, () =>
        Array.from({ length: n }, () =>
            Array.from({ length: n }, () =>
                Array.from({ length: n }, () => 0)
            )
        )
    );

    // Explicitly mark anchors passable (they are 0 by default above,
    // but this is belt-and-suspenders protection).
    grid4d[n - 1][0][0][0] = 0;       // Start: w=N-1, z=0, y=0, x=0
    grid4d[0][n - 1][n - 1][n - 1] = 0; // End:   w=0,   z=N-1, y=N-1, x=N-1

    // Begin at center hyperdiagonal where both anchors live.
    hyperLayer = n - 1;
    hyperSliceOffset = hyperLayerToSlice4d(hyperLayer);
    scanActive4d = false;
    keysDown4d = {};
    player4d = { sx: 0, sy: 0, sz: 0 };
    editLayerZ4d = -1;
    invalidateCrossSection4d();
}

function inBounds4d(x, y, z, w) {
    const max = gridSize4d;
    return x >= 0 && y >= 0 && z >= 0 && w >= 0
        && x < max && y < max && z < max && w < max;
}

function getCell4d(x, y, z, w) {
    // Out-of-bounds reads return wall (1) to naturally block movement.
    if (!inBounds4d(x, y, z, w)) return 1;
    return grid4d[w][z][y][x];
}

function setCell4d(x, y, z, w, value) {
    if (!inBounds4d(x, y, z, w)) return false;
    if (isAnchorCell4d(x, y, z, w)) return false;
    grid4d[w][z][y][x] = value ? 1 : 0;
    invalidateCrossSection4d();
    return true;
}

function toggleCell4d(x, y, z, w) {
    if (!inBounds4d(x, y, z, w)) return false;
    if (isAnchorCell4d(x, y, z, w)) return false;
    grid4d[w][z][y][x] = grid4d[w][z][y][x] ? 0 : 1;
    invalidateCrossSection4d();
    return true;
}

// ── Slice geometry ────────────────────────────────────────────────────────────

function getSliceBounds4d() {
    // Slightly inset to avoid degenerate zero-area intersections at exact bounds.
    const max = gridSize4d * SQRT2_4D;
    return { min: 0.0001, max: max - 0.0001 };
}

function getSliceEquationConstant4d() {
    return hyperSliceOffset * SQRT2_4D;
}

function getClosestWForSliceAndX(x, C = getSliceEquationConstant4d()) {
    const raw = C - (x + 0.5);
    return clamp4d(Math.round(raw), 0, gridSize4d - 1);
}

/**
 * Intersect a 4D unit hypercube at (x,y,z,w) with the hyperplane x+w = C,
 * returning the resulting 3D box in scan-space coordinates.
 *
 * Scan-space axes:
 *   scan_x  (x0,x1): diagonal width, ranges ≈ [−N/√2, N/√2], centred at 0.
 *   scan_y  (y0,y1): y axis scaled by √2, ranges [0, N·√2].
 *   scan_z  (z0,z1): z axis scaled by √2, ranges [0, N·√2].
 *
 * This function is GEOMETRICALLY CORRECT — do not alter the intersection math.
 */
function getCellSliceSegment4d(x, y, z, w, sliceS = hyperSliceOffset) {
    const C = sliceS * SQRT2_4D;
    const xMin = Math.max(x, C - (w + 1));
    const xMax = Math.min(x + 1, C - w);
    if (xMin >= xMax) return null;

    return {
        x0: ((2 * xMin) - C) / SQRT2_4D,
        x1: ((2 * xMax) - C) / SQRT2_4D,
        y0: y * SQRT2_4D,
        y1: (y + 1) * SQRT2_4D,
        z0: z * SQRT2_4D,
        z1: (z + 1) * SQRT2_4D,
    };
}

// ── Cross-section geometry ────────────────────────────────────────────────────

function segToWorldBox(seg, N) {
    // Axis remapping: seg.y → world X, seg.z → world Y, seg.x (diagonal) → world Z (vertical)
    return {
        x0: seg.y0 / SQRT2_4D,
        x1: seg.y1 / SQRT2_4D,
        y0: seg.z0 / SQRT2_4D,
        y1: seg.z1 / SQRT2_4D,
        z0: seg.x0 / SQRT2_4D + (N - 1) / 2,
        z1: seg.x1 / SQRT2_4D + (N - 1) / 2,
    };
}

// Cache last cross-section so static frames don't rebuild N^4 geometry.
let _csCache    = null;
let _csCacheKey = '';

function invalidateCrossSection4d() { _csCache = null; _csCacheKey = ''; }

/**
 * Build walkable world-space box geometry for the current hyperplane cross-section.
 * Mirrors buildCrossSection() from geometry.js — one dimension higher.
 */
function buildCrossSection4d(S4) {
    const key = S4.toFixed(9) + '|' + gridSize4d;
    if (_csCache && _csCacheKey === key) return _csCache;

    const N = gridSize4d;
    const passable = [];
    const pathBoxes = [];
    let startBox = null;
    let endBox = null;
    const pathSet = getBfsPathSet4d();

    for (let w = 0; w < N; w++) {
        for (let z = 0; z < N; z++) {
            for (let y = 0; y < N; y++) {
                for (let x = 0; x < N; x++) {
                    if (grid4d[w][z][y][x] === 1) continue;
                    const seg = getCellSliceSegment4d(x, y, z, w, S4);
                    if (!seg) continue;
                    const box = segToWorldBox(seg, N);
                    if (x === 0 && y === 0 && z === 0 && w === N - 1) {
                        startBox = box;
                    } else if (x === N - 1 && y === N - 1 && z === N - 1 && w === 0) {
                        endBox = box;
                    } else {
                        passable.push(box);
                        if (pathSet && pathSet.has(`${x},${y},${z},${w}`)) pathBoxes.push(box);
                    }
                }
            }
        }
    }

    _csCache    = { passable, startBox, endBox, pathBoxes };
    _csCacheKey = key;
    return _csCache;
}

// ── Continuous player physics ─────────────────────────────────────────────────
//
// Mirrors player3d.js exactly — same structure, one dimension higher.

const PLAYER4D_SPEED     = 3.9;
const PLAYER4D_RADIUS    = 0.14;
const PLAYER4D_NUDGES    = [0, 0.04, -0.04, 0.08, -0.08, 0.12, -0.12];
const PLAYER4D_SWEEP_STEP = PLAYER4D_RADIUS * 0.35;
const PLAYER4D_BLOCKED_BEEP_COOLDOWN_MS = 130;

let lastBlockedBeep4d = 0;

function pointInBox4d(sx, sy, sz, box) {
    // No positive EPS — a gap of 0.001 at every cell boundary is large enough to
    // make the player "invalid" at any wall face, triggering spurious stabilization
    // and teleportation.  Inclusive boundary lets adjacent cells share their face.
    return sx >= box.x0 && sx <= box.x1
        && sy >= box.y0 && sy <= box.y1
        && sz >= box.z0 && sz <= box.z1;
}

function pointPassable4d(sx, sy, sz, cs) {
    if (cs.startBox && pointInBox4d(sx, sy, sz, cs.startBox)) return true;
    if (cs.endBox   && pointInBox4d(sx, sy, sz, cs.endBox))   return true;
    for (const box of cs.passable) {
        if (pointInBox4d(sx, sy, sz, box)) return true;
    }
    return false;
}

function canOccupy4d(sx, sy, sz, cs) {
    const r = PLAYER4D_RADIUS;
    const d = r * Math.SQRT1_2;
    const samples = [
        [0, 0, 0],
        [r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r],
        [d, d, 0], [d, -d, 0], [-d, d, 0], [-d, -d, 0],
        [d, 0, d], [d, 0, -d], [-d, 0, d], [-d, 0, -d],
        [0, d, d], [0, d, -d], [0, -d, d], [0, -d, -d],
    ];
    for (const [dx, dy, dz] of samples) {
        if (!pointPassable4d(sx + dx, sy + dy, sz + dz, cs)) return false;
    }
    return true;
}

function clampToWorld4d(sx, sy, sz) {
    const N = gridSize4d;
    // With axis remapping: world X = maze-y ∈ [0,N], world Y = maze-z ∈ [0,N],
    // world Z = diagonal axis ≈ [−0.5, N−0.5].  All three use the same symmetric
    // tight clamp; canOccupy4d enforces the actual per-box passability constraint.
    return {
        sx: Math.max(-0.5, Math.min(N + 0.5, sx)),
        sy: Math.max(-0.5, Math.min(N + 0.5, sy)),
        sz: Math.max(-1.0, Math.min(N,        sz)),
    };
}

function triggerBlocked4d() {
    const now = performance.now();
    if (now - lastBlockedBeep4d >= PLAYER4D_BLOCKED_BEEP_COOLDOWN_MS) {
        if (typeof playMerp === 'function') playMerp();
        lastBlockedBeep4d = now;
    }
    if (typeof setStatus4d === 'function') setStatus4d('Merp — Wall collision.', 'error');
}

function sweepMove4d(dx, dy, dz, cs) {
    const startSx = player4d.sx, startSy = player4d.sy, startSz = player4d.sz;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 1e-9) return { moved: false, blocked: false, reached: true, usedDx: 0, usedDy: 0, usedDz: 0 };

    const steps = Math.max(1, Math.ceil(dist / PLAYER4D_SWEEP_STEP));
    let blocked = false;

    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const c = clampToWorld4d(startSx + dx * t, startSy + dy * t, startSz + dz * t);
        if (!canOccupy4d(c.sx, c.sy, c.sz, cs)) { blocked = true; break; }
        player4d.sx = c.sx;
        player4d.sy = c.sy;
        player4d.sz = c.sz;
    }

    const usedDx = player4d.sx - startSx;
    const usedDy = player4d.sy - startSy;
    const usedDz = player4d.sz - startSz;
    const moved = Math.hypot(usedDx, usedDy, usedDz) > 1e-8;
    const reached = !blocked
        && Math.abs(usedDx - dx) < 0.0006
        && Math.abs(usedDy - dy) < 0.0006
        && Math.abs(usedDz - dz) < 0.0006;
    return { moved, blocked, reached, usedDx, usedDy, usedDz };
}

function tryAxisSlide4d(pdx, pdy, pdz, sdx, sdy, sdz, cs) {
    const direct = sweepMove4d(pdx, pdy, pdz, cs);
    if (direct.moved) {
        if (sdx !== 0 || sdy !== 0 || sdz !== 0) sweepMove4d(sdx, sdy, sdz, cs);
        return true;
    }

    // Nudge secondary axes to slide around corners.
    // Floor movement (X or Y = arrow keys) only nudges the other floor axis —
    // nudging Z (diagonal) while walking would silently shift the 4th dimension,
    // causing the world to morph unexpectedly.
    // Vertical movement (Z = W/S) nudges both floor axes.
    let n1dx = 0, n1dy = 0, n1dz = 0;
    let n2dx = 0, n2dy = 0, n2dz = 0;
    if (pdx !== 0 && pdy === 0 && pdz === 0) { n1dy = 1; }           // X: nudge Y only
    else if (pdy !== 0 && pdx === 0 && pdz === 0) { n1dx = 1; }      // Y: nudge X only
    else { n1dx = 1; n2dy = 1; }                                      // Z/mixed: nudge X and Y

    const hasN2 = n2dx !== 0 || n2dy !== 0 || n2dz !== 0;
    for (const n of PLAYER4D_NUDGES) {
        if (n === 0) continue;
        const r1 = sweepMove4d(pdx + n1dx * n, pdy + n1dy * n, pdz + n1dz * n, cs);
        if (r1.moved) {
            if (sdx !== 0 || sdy !== 0 || sdz !== 0) sweepMove4d(sdx, sdy, sdz, cs);
            return true;
        }
        if (hasN2) {
            const r2 = sweepMove4d(pdx + n2dx * n, pdy + n2dy * n, pdz + n2dz * n, cs);
            if (r2.moved) {
                if (sdx !== 0 || sdy !== 0 || sdz !== 0) sweepMove4d(sdx, sdy, sdz, cs);
                return true;
            }
        }
    }
    return false;
}

function moveWithNudge4d(dx, dy, dz, cs) {
    const first = sweepMove4d(dx, dy, dz, cs);
    if (first.reached) return;

    const remDx = dx - first.usedDx;
    const remDy = dy - first.usedDy;
    const remDz = dz - first.usedDz;

    // Try axis-aligned slides in order of largest remaining delta.
    const axes = [
        { pdx: remDx, pdy: 0,    pdz: 0,    sdx: 0,    sdy: remDy, sdz: remDz, mag: Math.abs(remDx) },
        { pdx: 0,    pdy: remDy, pdz: 0,    sdx: remDx, sdy: 0,    sdz: remDz, mag: Math.abs(remDy) },
        { pdx: 0,    pdy: 0,    pdz: remDz, sdx: remDx, sdy: remDy, sdz: 0,    mag: Math.abs(remDz) },
    ].sort((a, b) => b.mag - a.mag);

    let slid = false;
    for (const ax of axes) {
        if (ax.mag < 1e-9) continue;
        if (tryAxisSlide4d(ax.pdx, ax.pdy, ax.pdz, ax.sdx, ax.sdy, ax.sdz, cs)) { slid = true; break; }
    }

    if (!first.moved && !slid && first.blocked) {
        triggerBlocked4d();
    }
}

function stabilizePlayer4d(cs) {
    if (canOccupy4d(player4d.sx, player4d.sy, player4d.sz, cs)) return true;

    const origin = { sx: player4d.sx, sy: player4d.sy, sz: player4d.sz };
    const step = 0.045;
    const maxRing = 27;

    for (let ring = 1; ring <= maxRing; ring++) {
        const candidates = [];
        for (let ox = -ring; ox <= ring; ox++) {
            for (let oy = -ring; oy <= ring; oy++) {
                for (let oz = -ring; oz <= ring; oz++) {
                    if (Math.max(Math.abs(ox), Math.abs(oy), Math.abs(oz)) !== ring) continue;
                    candidates.push([ox, oy, oz]);
                }
            }
        }
        candidates.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));

        for (const [ox, oy, oz] of candidates) {
            const c = clampToWorld4d(
                origin.sx + ox * step,
                origin.sy + oy * step,
                origin.sz + oz * step
            );
            if (!canOccupy4d(c.sx, c.sy, c.sz, cs)) continue;
            player4d.sx = c.sx;
            player4d.sy = c.sy;
            player4d.sz = c.sz;
            return true;
        }
    }

    // Ring search failed.  Teleporting to start is jarring — find the nearest
    // passable box centre instead to minimise perceived jump distance.
    const allBoxes = [];
    if (cs.startBox) allBoxes.push(cs.startBox);
    if (cs.endBox)   allBoxes.push(cs.endBox);
    for (const b of cs.passable) allBoxes.push(b);

    let bestBox = null, bestDist2 = Infinity;
    for (const b of allBoxes) {
        const cx = (b.x0 + b.x1) * 0.5;
        const cy = (b.y0 + b.y1) * 0.5;
        const cz = (b.z0 + b.z1) * 0.5;
        const d2 = (player4d.sx - cx) ** 2 + (player4d.sy - cy) ** 2 + (player4d.sz - cz) ** 2;
        if (d2 < bestDist2) { bestDist2 = d2; bestBox = b; }
    }
    if (bestBox) {
        player4d.sx = (bestBox.x0 + bestBox.x1) * 0.5;
        player4d.sy = (bestBox.y0 + bestBox.y1) * 0.5;
        player4d.sz = (bestBox.z0 + bestBox.z1) * 0.5;
    } else if (cs.startBox) {
        player4d.sx = (cs.startBox.x0 + cs.startBox.x1) * 0.5;
        player4d.sy = (cs.startBox.y0 + cs.startBox.y1) * 0.5;
        player4d.sz = (cs.startBox.z0 + cs.startBox.z1) * 0.5;
    }
    return false;
}

function updatePlayer4d(dt, cs) {
    stabilizePlayer4d(cs);

    // Camera-relative axis remap (M11.1).
    // Snap cameraAz4d to the nearest 90° quadrant; remap arrow keys to world X/Y accordingly.
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
    if (!dx && !dy && !dz) return;

    const m = Math.hypot(dx, dy, dz);
    const speed = PLAYER4D_SPEED * dt;
    moveWithNudge4d((dx / m) * speed, (dy / m) * speed, (dz / m) * speed, cs);
}

function playerHitsEnd4d(cs) {
    if (!cs.endBox) return false;
    return pointInBox4d(player4d.sx, player4d.sy, player4d.sz, cs.endBox);
}

// ── Input ─────────────────────────────────────────────────────────────────────

function updateHyperSliceFromInput4d(dt) {
    if (!scanActive4d) return false;

    let dir = 0;
    if (keysDown4d['KeyE']) dir += 1;
    if (keysDown4d['KeyD']) dir -= 1;
    if (!dir) return false;

    const bounds = getSliceBounds4d();
    hyperSliceOffset = clamp4d(
        hyperSliceOffset + (dir * HYPER_SLICE_SPEED * dt),
        bounds.min, bounds.max
    );

    // Keep hyperLayer in sync so isActiveLayer rendering tracks the current diagonal.
    hyperLayer = clamp4d(
        Math.round(hyperSliceOffset * SQRT2_4D - 1),
        0, maxHyperLayerIndex4d()
    );

    return true;
}

// ── BFS ───────────────────────────────────────────────────────────────────────
//
// Mirrors bfs3d() in lattice.js exactly — same structure, one dimension higher.

let bfsPath4d = null;   // array of [x,y,z,w] from Start to End, or null
let solvable4d = false;

/**
 * 8-connected BFS through the 4D grid (±x ±y ±z ±w).
 * Sets bfsPath4d and solvable4d; returns the path array or null.
 */
function bfs4d() {
    const N = gridSize4d;

    // Anchors are forced passable by initGrid4d, but guard just in case.
    if (grid4d[N - 1][0][0][0] === 1 || grid4d[0][N - 1][N - 1][N - 1] === 1) {
        bfsPath4d = null;
        solvable4d = false;
        return null;
    }

    const dirs = [
        [1, 0, 0, 0], [-1, 0, 0, 0],
        [0, 1, 0, 0], [0, -1, 0, 0],
        [0, 0, 1, 0], [0, 0, -1, 0],
        [0, 0, 0, 1], [0, 0, 0, -1],
    ];

    // parent[w][z][y][x] = predecessor cell object, or null at start.
    const parent = Array.from({ length: N }, () =>
        Array.from({ length: N }, () =>
            Array.from({ length: N }, () => new Array(N).fill(null))
        )
    );
    const visited = Array.from({ length: N }, () =>
        Array.from({ length: N }, () =>
            Array.from({ length: N }, () => new Array(N).fill(false))
        )
    );

    const queue = [{ x: 0, y: 0, z: 0, w: N - 1 }];
    visited[N - 1][0][0][0] = true;

    while (queue.length) {
        const cur = queue.shift();

        if (cur.x === N - 1 && cur.y === N - 1 && cur.z === N - 1 && cur.w === 0) {
            // Trace path from end back to start.
            const path = [];
            let c = cur;
            while (c) {
                path.push([c.x, c.y, c.z, c.w]);
                c = parent[c.w][c.z][c.y][c.x];
            }
            bfsPath4d = path;
            solvable4d = true;
            return path;
        }

        for (const [dx, dy, dz, dw] of dirs) {
            const nx = cur.x + dx, ny = cur.y + dy;
            const nz = cur.z + dz, nw = cur.w + dw;
            if (nx < 0 || ny < 0 || nz < 0 || nw < 0
                || nx >= N || ny >= N || nz >= N || nw >= N) continue;
            if (visited[nw][nz][ny][nx] || grid4d[nw][nz][ny][nx] === 1) continue;
            visited[nw][nz][ny][nx] = true;
            parent[nw][nz][ny][nx] = { x: cur.x, y: cur.y, z: cur.z, w: cur.w };
            queue.push({ x: nx, y: ny, z: nz, w: nw });
        }
    }

    bfsPath4d = null;
    solvable4d = false;
    return null;
}

/**
 * Returns Set<"x,y,z,w"> for all BFS path cells — used by the scan renderer.
 */
function getBfsPathSet4d() {
    if (!bfsPath4d) return null;
    return new Set(bfsPath4d.map(([x, y, z, w]) => `${x},${y},${z},${w}`));
}

/**
 * Returns Set<"x,y,z,w"> for BFS path cells that lie on hyperdiagonal d4 (x+w === d4).
 * Used by the edit renderer to highlight the path on the active layer.
 * Mirrors getBfsPathSetForDiagonal(d) in lattice.js.
 */
function getBfsPathSetForHyperDiagonal(d4) {
    if (!bfsPath4d) return null;
    const set = new Set();
    for (const [x, y, z, w] of bfsPath4d) {
        if (x + w === d4) set.add(`${x},${y},${z},${w}`);
    }
    return set.size > 0 ? set : null;
}

// ── Peek mode ─────────────────────────────────────────────────────────────────

let peeking4d = false;

/**
 * Return the hyperdiagonal index that best represents the current hyperSliceOffset.
 * Mirrors pickEditorLayerForSlice() from ui3d.js.
 */
function pickEditorLayerForHyperSlice4d() {
    const d4 = hyperSliceOffset * SQRT2_4D - 1;
    return clamp4d(Math.round(d4), 0, maxHyperLayerIndex4d());
}

// ── Serialization ─────────────────────────────────────────────────────────────
//
// Format: <2-hex N><hex-packed bits>  (mirrors serializeMaze3dToHex in lattice.js)
// Iteration order: w, z, y, x (matches grid4d[w][z][y][x] storage).
// Anchor cells are always encoded as 0 (passable) so they compress away.

function serializeMaze4dToHex() {
    const N = gridSize4d;
    const sizeHex = N.toString(16).toUpperCase().padStart(2, '0');
    let bits = '';

    for (let w = 0; w < N; w++) {
        for (let z = 0; z < N; z++) {
            for (let y = 0; y < N; y++) {
                for (let x = 0; x < N; x++) {
                    bits += (!isAnchorCell4d(x, y, z, w) && grid4d[w][z][y][x]) ? '1' : '0';
                }
            }
        }
    }

    while (bits.length % 4 !== 0) bits += '0';
    let hex = '';
    for (let i = 0; i < bits.length; i += 4) {
        hex += parseInt(bits.slice(i, i + 4), 2).toString(16).toUpperCase();
    }
    return sizeHex + hex.replace(/0+$/, '');
}

/**
 * Restore grid from a serialized hex string.
 * Returns true on success; the caller is responsible for updating DOM (slider, etc.)
 * and calling runBfs() / redraw.
 */
function applySerializedMap4d(mapString) {
    if (!mapString || mapString.length < 2) return false;

    const parsedSize = parseInt(mapString.slice(0, 2), 16);
    if (!Number.isFinite(parsedSize) || parsedSize < 3 || parsedSize > 10) return false;

    initGrid4d(parsedSize);

    const payload = (mapString.slice(2).toUpperCase().match(/[0-9A-F]/g) || []).join('');
    const N = parsedSize;
    const totalCells = N * N * N * N;
    let cellIndex = 0;

    for (let idx = 0; idx < payload.length && cellIndex < totalCells; idx++) {
        const nibble = parseInt(payload[idx], 16);
        for (let bit = 3; bit >= 0 && cellIndex < totalCells; bit--) {
            const value = (nibble >> bit) & 1;
            const plane = N * N * N;
            const w  = Math.floor(cellIndex / plane);
            const r1 = cellIndex % plane;
            const z  = Math.floor(r1 / (N * N));
            const r2 = r1 % (N * N);
            const y  = Math.floor(r2 / N);
            const x  = r2 % N;
            if (!isAnchorCell4d(x, y, z, w)) grid4d[w][z][y][x] = value;
            cellIndex++;
        }
    }

    bfs4d();
    return true;
}

// ── Mode transitions ──────────────────────────────────────────────────────────

function setScanActive4d(active) {
    scanActive4d = !!active;
    if (scanActive4d) {
        // Enter scan at the canonical centre hyperdiagonal where Start/End live.
        hyperLayer = gridSize4d - 1;
        hyperSliceOffset = hyperLayerToSlice4d(hyperLayer);
        // Place player at the start-box centre for this slice.
        const cs = buildCrossSection4d(hyperSliceOffset);
        if (cs.startBox) {
            player4d.sx = (cs.startBox.x0 + cs.startBox.x1) * 0.5;
            player4d.sy = (cs.startBox.y0 + cs.startBox.y1) * 0.5;
            player4d.sz = (cs.startBox.z0 + cs.startBox.z1) * 0.5;
        }
    } else {
        // Exit: snap hyperLayer to nearest diagonal for the current slice.
        hyperLayer = clamp4d(
            Math.round(hyperSliceOffset * SQRT2_4D - 1),
            0, maxHyperLayerIndex4d()
        );
        hyperSliceOffset = hyperLayerToSlice4d(hyperLayer);
    }
}
