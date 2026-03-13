// js/3d/lattice.js — Phase 2: 3D grid init, BFS, validation, serialisation

// ── Grid initialisation ───────────────────────────────────────────────────────

function initGrid3d(n) {
    gridSize3d = n;
    grid3d = [];
    for (let k = 0; k < n; k++) {
        const layer = [];
        for (let j = 0; j < n; j++) {
            layer.push(new Array(n).fill(0));
        }
        grid3d.push(layer);
    }
    // Force Start (i=0,j=0,k=N-1) and End (i=N-1,j=N-1,k=0) to passable
    grid3d[n - 1][0][0] = 0;
    grid3d[0][n - 1][n - 1] = 0;
    bfsPath3d = null;
    solvable3d = false;
    // Start at the center diagonal d=N-1, displayed as "Layer N"
    currentLayer = n - 1;
}

// ── Global sync ───────────────────────────────────────────────────────────────

// Point the shared 2D globals at the current layer so maze-core functions work.
function syncGridToGlobal() {
    gridSize = gridSize3d;
    grid = grid3d[currentLayer];
}

// Recompute canvas geometry and redraw all layers with opacity.
function redraw3d() {
    gridSize = gridSize3d;   // computeSizes() needs this
    computeSizes();
    const pathSet = getBfsPathSetForDiagonal(currentLayer);
    drawMaze3d(pathSet);
    // Display as "Layer X" where X increases going visually upward.
    // Higher currentLayer = lower wz (visually lower), so flip: X = (2N-1) - currentLayer.
    // Center diagonal (currentLayer=N-1) still shows "Layer N".
    layerDisplay.textContent = String(2 * gridSize3d - 1 - currentLayer);
}

// ── BFS ───────────────────────────────────────────────────────────────────────

// 3D BFS from Start (i=0,j=0,k=N-1) to End (i=N-1,j=N-1,k=0).
// Sets bfsPath3d and solvable3d; returns path array of [i,j,k] or null.
function bfs3d() {
    const N = gridSize3d;

    if (grid3d[N - 1][0][0] === 1 || grid3d[0][N - 1][N - 1] === 1) {
        bfsPath3d = null;
        solvable3d = false;
        return null;
    }

    // parent[k][j][i] stores the predecessor cell object, or null for the start
    const parent = Array.from({ length: N }, () =>
        Array.from({ length: N }, () => new Array(N).fill(null))
    );
    const visited = Array.from({ length: N }, () =>
        Array.from({ length: N }, () => new Array(N).fill(false))
    );

    const queue = [{ i: 0, j: 0, k: N - 1 }];
    visited[N - 1][0][0] = true;

    const dirs = [
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1]
    ];

    while (queue.length) {
        const cur = queue.shift();

        if (cur.i === N - 1 && cur.j === N - 1 && cur.k === 0) {
            // Trace path back to start
            const path = [];
            let c = cur;
            while (c) {
                path.push([c.i, c.j, c.k]);
                c = parent[c.k][c.j][c.i];
            }
            bfsPath3d = path;
            solvable3d = true;
            return path;
        }

        for (const [di, dj, dk] of dirs) {
            const ni = cur.i + di;
            const nj = cur.j + dj;
            const nk = cur.k + dk;
            if (ni < 0 || nj < 0 || nk < 0 || ni >= N || nj >= N || nk >= N) continue;
            if (visited[nk][nj][ni] || grid3d[nk][nj][ni] === 1) continue;
            visited[nk][nj][ni] = true;
            parent[nk][nj][ni] = { i: cur.i, j: cur.j, k: cur.k };
            queue.push({ i: ni, j: nj, k: nk });
        }
    }

    bfsPath3d = null;
    solvable3d = false;
    return null;
}

// Returns a Set<"i,j"> of BFS-path cells on the given diagonal d (i+k === d).
// Used by drawMaze3d() for the yellow BFS highlight on the active diagonal.
function getBfsPathSetForDiagonal(d) {
    if (!bfsPath3d) return null;
    const set = new Set();
    for (const [i, j, k] of bfsPath3d) {
        if (i + k === d) {
            set.add(i + ',' + j);   // key: "ci,cj"
        }
    }
    return set.size > 0 ? set : null;
}

// ── Pure world-space helpers (module scope, reused by drawMaze3d & paintAt) ───

// Map lattice vertex (vi, vj, vk) → post-rotation world [wx, wy, wz].
//
// Pre-rotation block (vertex indices 0…N):
//   px = vi          (X axis, front-right, 1 unit/step)
//   py = vj * SQ2    (Y axis, back-right,  √2 unit/step — the prism long axis)
//   pz = N - vk      (Z axis, up;  vk=N → pz=0 = green corner, vk=0 → pz=N = red corner)
//
// After 45° rotation about Y (tilts block so red corner drops to Z=0 plane):
//   wx = (px + pz) / SQ2
//   wy =  py                 (Y unchanged)
//   wz = (-px + pz) / SQ2   ← scan direction; wz=0 at center diagonal (vi+vk=N)
//
// Active scan diagonal = ci+ck (NOT cj+ck); center diagonal d=N-1 → wz = 0.
function worldPos(vi, vj, vk) {
    const N  = gridSize3d;
    const px = vi;
    const py = vj * SQ2;
    const pz = N - vk;
    return [
        (px + pz) / SQ2,    // wx
        py,                  // wy (depth, unchanged by rotation)
        (-px + pz) / SQ2,   // wz (scan height; 0 at center diagonal)
    ];
}

function norm3(v)    { const l = Math.hypot(v[0],v[1],v[2]); return [v[0]/l,v[1]/l,v[2]/l]; }
function sub3(a, b)  { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function cross3(a,b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function dot3(a, b)  { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

// Darken/lighten a hex colour by multiplying each channel by t.
function shadeHex(hex, t) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgb(${Math.round(r*t)},${Math.round(g*t)},${Math.round(b*t)})`;
}

// Screen-space back-face cull: returns true when the face [idx0,idx1,idx2,…]
// winds counter-clockwise (= faces the camera) in canvas Y-down coords.
function facingCamera(pts, i0, i1, i2) {
    const ax = pts[i1][0]-pts[i0][0], ay = pts[i1][1]-pts[i0][1];
    const bx = pts[i2][0]-pts[i0][0], by = pts[i2][1]-pts[i0][1];
    return (ax*by - ay*bx) < 0;
}

// Canvas polygon fill/stroke helpers (use mazeCtx directly — it's global).
function fillFacePts(pts, indices, color) {
    mazeCtx.beginPath();
    mazeCtx.moveTo(pts[indices[0]][0], pts[indices[0]][1]);
    for (let n = 1; n < indices.length; n++)
        mazeCtx.lineTo(pts[indices[n]][0], pts[indices[n]][1]);
    mazeCtx.closePath();
    mazeCtx.fillStyle = color;
    mazeCtx.fill();
}
function strokePolyPts(pts, ...idx) {
    mazeCtx.beginPath();
    mazeCtx.moveTo(pts[idx[0]][0], pts[idx[0]][1]);
    for (let n = 1; n < idx.length; n++) mazeCtx.lineTo(pts[idx[n]][0], pts[idx[n]][1]);
    mazeCtx.closePath();
    mazeCtx.stroke();
}
function strokeLinePts(a, b) {
    mazeCtx.beginPath();
    mazeCtx.moveTo(a[0], a[1]);
    mazeCtx.lineTo(b[0], b[1]);
    mazeCtx.stroke();
}

// ── Perspective 3D prism editor renderer ─────────────────────────────────────
// Each cell is a 1×1×√2 rectangular prism whose 45°-rotated cross-section is a
// diamond.  A perspective camera at AZ=35°/EL=20° shows the diamond end-face
// AND one long rectangular "house-roof" side simultaneously.
//
// Ghost cells (j+k ≠ currentLayer): wireframe only for passable, + dark misty
// fill for walls.  Active cells: solid coloured fills with back-face culling.
function drawMaze3d(pathSet) {
    const N  = gridSize3d;
    const dL = currentLayer;   // active diagonal index (avoid shadowing 'project' inner vars)

    // ── Camera setup ─────────────────────────────────────────────────────────
    // Tweak these three constants to reposition the viewpoint:
    //   AZ  — azimuth (0–90°): 0 = dead-on front, 90 = pure side view.
    //          ~35° gives a comfortable 3/4 angle so depth is clear.
    //   EL  — elevation (0–90°): 0 = eye-level, 90 = directly overhead.
    //          Higher values tilt the camera downward, compressing vertical
    //          spread and revealing more of the top faces.
    //   D   — distance from lattice centre in world units.
    //          N * 2.5 keeps the whole lattice in frame for N ≤ 8.
    const AZ = 35 * Math.PI / 180;
    const EL = 35 * Math.PI / 180;   // ← raise/lower camera here (was 20°)
    const D  = N * 2.5;

    // Lattice centre in post-rotation world space.
    // postX and postY both span [0, N*SQ2]; centre = N/SQ2 each.
    // postZ = 0 at the centre diagonal (d = N-1).
    const Cx = N / SQ2, Cy = N / SQ2, Cz = 0;
    // Camera sits mostly in front (-wy), slight right (+wx), above (+wz).
    // This makes the flat front face (wy=wy_lo) appear on the LEFT side of the
    // scene, and the wy-depth of each box recedes to the right at ~45°.
    // worldUp = [0,0,1] keeps diagonal layers (d=j+k=const) stacking horizontally.
    const eye = [
        Cx + D * Math.sin(AZ) * Math.cos(EL),
        Cy - D * Math.cos(AZ) * Math.cos(EL),
        Cz + D * Math.sin(EL)
    ];
    const fwd   = norm3(sub3([Cx, Cy, Cz], eye));
    const right = norm3(cross3(fwd, [0, 0, 1]));
    const camUp = cross3(right, fwd);

    // ~60° vertical FOV — natural feel, low distortion for N ≤ 8.
    const focalLen = (canvasSize * 0.5) / Math.tan(30 * Math.PI / 180);
    const screenCx = canvasSize / 2;
    const screenCy = canvasSize / 2;

    // Returns [sx, sy, depth] or null if the point is behind the camera.
    function project(wx, wy, wz) {
        const dir = [wx - eye[0], wy - eye[1], wz - eye[2]];
        const cz  = dot3(dir, fwd);
        if (cz < 0.01) return null;
        return [
            screenCx + (dot3(dir, right) / cz) * focalLen,
            screenCy - (dot3(dir, camUp) / cz) * focalLen,
            cz
        ];
    }

    // ── 3D slab box renderer ──────────────────────────────────────────────────
    // Each cell (ci,cj,ck) occupies a box:
    //   wx : [ci, ci+1]
    //   wy : [(cj-ck-1)/2, (cj-ck+1)/2]   (diagonal cross-section depth)
    //   wz : [d/2, d/2+1]                   (layer height, d = cj+ck)
    //
    // Wall cells on active layer  → solid black box (3 camera-facing faces).
    // Passable cells on active layer → white outline of the top (horizontal) face only.
    // Off-layer wall cells (|d-dL| < 4) → same box at 50% opacity (half as dark).
    // Off-layer passable cells → invisible.

    // Return the 8 projected corners of a cell's box via worldPos, or null if any clip.
    // Corner layout (vertex indices into the lattice):
    //   0:(ci,  cj,  ck)   1:(ci+1,cj,  ck)   — low vk  (higher wz, "upper" in scan)
    //   2:(ci+1,cj+1,ck)   3:(ci,  cj+1,ck)
    //   4:(ci,  cj,  ck+1) 5:(ci+1,cj,  ck+1) — high vk (lower wz, "lower" in scan)
    //   6:(ci+1,cj+1,ck+1) 7:(ci,  cj+1,ck+1)
    function getCellBox(ci, cj, ck) {
        const raw = [
            [ci,   cj,   ck  ], [ci+1, cj,   ck  ],
            [ci+1, cj+1, ck  ], [ci,   cj+1, ck  ],
            [ci,   cj,   ck+1], [ci+1, cj,   ck+1],
            [ci+1, cj+1, ck+1], [ci,   cj+1, ck+1],
        ].map(([vi,vj,vk]) => project(...worldPos(vi, vj, vk)));
        return raw.some(p => p === null) ? null : raw;
    }

    // Render a solid coloured box (back-face culled).
    // Visible faces from camera at (-wy mostly, slight +wx, +wz):
    //   Front  [0,4,5,1]: diamond cross-section (faces -wy)    ← "pointed" side
    //   Left   [0,3,7,4]: flat parallelogram (faces -wx/+wz)   ← "flat left" side
    //   Bottom [4,7,6,5]: bottom-facing slab (faces +wx/+wz)
    function drawSolidBox(pts, base) {
        const faces = [
            { idx: [0,4,5,1], sh: 0.80 },  // Front  — diamond cross-section
            { idx: [0,3,7,4], sh: 1.00 },  // Left   — flat parallelogram (lightest)
            { idx: [4,7,6,5], sh: 0.65 },  // Bottom — lower slab face
            { idx: [3,2,6,7], sh: 0.30 },  // Back   — hidden from front
            { idx: [1,2,6,5], sh: 0.40 },  // Right  — hidden from left-camera
            { idx: [0,1,2,3], sh: 0.45 },  // Top    — hidden from above
        ];
        mazeCtx.lineWidth = 1.6;
        mazeCtx.strokeStyle = 'rgba(255,255,255,0.22)';
        for (const { idx, sh } of faces) {
            if (!facingCamera(pts, idx[0], idx[1], idx[2])) continue;
            fillFacePts(pts, idx, shadeHex(base, sh));
            strokePolyPts(pts, ...idx);
        }
    }

    // Collect cells to render — all layers included so ghosts are visible.
    // Active scan diagonal is ci+ck (not cj+ck).
    const cells = [];
    for (let ck = 0; ck < N; ck++) {
        for (let cj = 0; cj < N; cj++) {
            for (let ci = 0; ci < N; ci++) {
                const d      = ci + ck;          // ← new diagonal
                const dist   = Math.abs(d - dL);
                const isWall = grid3d[ck][cj][ci] === 1;
                const pc = project(...worldPos(ci + 0.5, cj + 0.5, ck + 0.5));
                if (!pc) continue;
                cells.push({ ci, cj, ck, d, dist, isWall, depth: pc[2] });
            }
        }
    }

    // Back-to-front painter's algorithm
    cells.sort((a, b) => b.depth - a.depth);

    mazeCtx.clearRect(0, 0, canvasSize, canvasSize);

    for (const { ci, cj, ck, dist, isWall } of cells) {
        const pts    = getCellBox(ci, cj, ck);
        if (!pts) continue;
        const isSt   = ci === 0   && cj === 0   && ck === N - 1;
        const isEnd  = ci === N-1 && cj === N-1 && ck === 0;
        const isPath = pathSet && pathSet.has(ci + ',' + cj) && dist === 0;

        if (dist === 0) {
            mazeCtx.globalAlpha = 1.0;
            if (isWall || isSt || isEnd) {
                const base = isSt ? '#5dffb0' : isEnd ? '#ff6a6a' : '#0d1018';
                drawSolidBox(pts, base);
            } else {
                // Passable: full wireframe prism.
                // Edge boldness guide (lineWidth):
                //   1.8 — front face, back face, bottom depth edges
                //   0.9 — top depth edges (half-bold, recede visually)
                const color = isPath ? '#ffd84f' : 'rgba(255,255,255,0.85)';
                mazeCtx.strokeStyle = color;

                // Front face (low-cj): 0→4→5→1
                mazeCtx.lineWidth = 1.8;
                strokePolyPts(pts, 0, 4, 5, 1);

                // Back face (high-cj): 3→7→6→2
                mazeCtx.lineWidth = 1.8;
                strokePolyPts(pts, 3, 7, 6, 2);

                // Bottom depth edges (high-ck): 4→7, 5→6
                mazeCtx.lineWidth = 1.8;
                strokeLinePts(pts[4], pts[7]);
                strokeLinePts(pts[5], pts[6]);

                // Top depth edges (low-ck): 0→3, 1→2 — half-bold so they recede
                mazeCtx.lineWidth = 0.9;
                strokeLinePts(pts[0], pts[3]);
                strokeLinePts(pts[1], pts[2]);
            }
        } else {
            // Off-layer ghost — flat uniform alpha so every inactive layer reads equally
            mazeCtx.globalAlpha = 0.06;
            if (isWall) {
                // Ghost wall: dark blue-grey box so it reads as solid mass in the mist
                drawSolidBox(pts, '#253558');
            } else {
                // Ghost passable: faint full wireframe so the corridor network reads through
                mazeCtx.strokeStyle = 'rgba(160,200,255,1.0)';
                mazeCtx.lineWidth   = 0.5;
                strokePolyPts(pts, 0, 4, 5, 1);        // front face
                strokePolyPts(pts, 3, 7, 6, 2);        // back face
                strokeLinePts(pts[0], pts[3]);          // depth edges
                strokeLinePts(pts[1], pts[2]);
                strokeLinePts(pts[4], pts[7]);
                strokeLinePts(pts[5], pts[6]);
            }
        }
    }

    mazeCtx.globalAlpha = 1.0;


    if (scanActive3d && peeking3d) {
        const C = sliceOffset * SQ2;
        const planeWz = (N - C) / SQ2;
        const planeCorners = [
            project(0, 0, planeWz),
            project(N * SQ2, 0, planeWz),
            project(N * SQ2, N * SQ2, planeWz),
            project(0, N * SQ2, planeWz),
        ];

        if (planeCorners.every(Boolean)) {
            mazeCtx.save();
            mazeCtx.globalAlpha = 1;
            mazeCtx.beginPath();
            mazeCtx.moveTo(planeCorners[0][0], planeCorners[0][1]);
            for (let i = 1; i < planeCorners.length; i++) mazeCtx.lineTo(planeCorners[i][0], planeCorners[i][1]);
            mazeCtx.closePath();
            mazeCtx.fillStyle = 'rgba(0, 217, 245, 0.10)';
            mazeCtx.fill();
            mazeCtx.strokeStyle = 'rgba(0, 217, 245, 0.55)';
            mazeCtx.lineWidth = 1.5;
            mazeCtx.stroke();

            const playerProj = project(player3d.x + N / SQ2, player3d.y, planeWz);
            if (playerProj) {
                mazeCtx.fillStyle = '#7dff2e';
                mazeCtx.shadowColor = '#7dff2e';
                mazeCtx.shadowBlur = 12;
                mazeCtx.beginPath();
                mazeCtx.arc(playerProj[0], playerProj[1], 5, 0, Math.PI * 2);
                mazeCtx.fill();
                mazeCtx.shadowBlur = 0;
                mazeCtx.fillStyle = 'rgba(236, 255, 248, 0.95)';
                mazeCtx.font = 'bold 12px sans-serif';
                mazeCtx.fillText('YOU ARE HERE', playerProj[0] + 10, playerProj[1] - 8);
            }
            mazeCtx.restore();
        }
    }

    // Expose camera/projection state so paintAt (ui3d.js) can do hit-testing
    // without re-running the full camera setup.
    window._proj3d = { project, worldPos, N };
}

// Run BFS, update button states and status bar, then redraw.
function validatePath3d() {
    const path = bfs3d();
    if (path) {
        setStatus(`Path found! ${path.length} cells.`, 'success');
        btnScan.disabled = false;
        btnGetLink.disabled = false;
        btnGetLink.classList.remove('hidden');
    } else {
        setStatus('No path found. Add or remove walls to create a solvable maze.', 'error');
        btnScan.disabled = true;
        btnGetLink.disabled = true;
        btnGetLink.classList.add('hidden');
    }
    redraw3d();
}

// ── Serialisation (Step 12) ───────────────────────────────────────────────────

function serializeMaze3dToHex() {
    return '';  // TODO: Step 12
}

function tryLoad3dMapFromUrl() {
    return false;  // TODO: Step 12
}
