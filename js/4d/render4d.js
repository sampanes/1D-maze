/**
 * js/4d/render4d.js
 *
 * 3D renderer for the 4D editor and scanner.
 *
 * Phase 0 corrections applied:
 *  - drawEditLayer4d now iterates the active hyperdiagonal (x+w = hyperLayer)
 *    instead of a flat W-layer.  Ghost cells (off-diagonal) are omitted for
 *    now; M10.2 will add them.
 *  - drawScanSlice4d uses per-axis toWorldX/Y/Z instead of a single toWorld
 *    that incorrectly applied the same transform to the centred scan_x and the
 *    origin-relative scan_y/scan_z.
 *  - isStartCell4d / isEndCell4d and pick-buffer now carry the w coordinate.
 */

let hyperCtx;
let hyperCanvas;

// Camera — simple orbit (azimuth/elevation) around the scene centre.
let cameraAz4d   = 45 * Math.PI / 180;
let cameraEl4d   = 30 * Math.PI / 180;
let cameraZoom4d = 1.0; // >1 = zoomed in, <1 = zoomed out

// Pick buffer: projected cube centres for nearest-neighbour click selection.
let pickCells4d = [];

function initRender4d() {
    hyperCanvas = document.getElementById('hyperCanvas');
    hyperCtx = hyperCanvas.getContext('2d');
}

// ── Perspective projection ────────────────────────────────────────────────────

function project3d(x, y, z, N) {
    const AZ = cameraAz4d;
    const EL = cameraEl4d;
    const D  = N * 3.5 / cameraZoom4d;

    const center = (N - 1) / 2;
    const Cx = center, Cy = center, Cz = center;

    const eye = [
        Cx + D * Math.sin(AZ) * Math.cos(EL),
        Cy - D * Math.cos(AZ) * Math.cos(EL),
        Cz + D * Math.sin(EL),
    ];

    const fwd   = norm3(sub3([Cx, Cy, Cz], eye));
    const right = norm3(cross3(fwd, [0, 0, 1]));
    const camUp = cross3(right, fwd);

    const focalLen = (hyperCanvas.width * 0.5) / Math.tan(32 * Math.PI / 180);
    const screenCx = hyperCanvas.width  / 2;
    const screenCy = hyperCanvas.height / 2;

    const dir = [x - eye[0], y - eye[1], z - eye[2]];
    const cz  = dot3(dir, fwd);
    if (cz < 0.01) return null;

    return [
        screenCx + (dot3(dir, right) / cz) * focalLen,
        screenCy - (dot3(dir, camUp) / cz) * focalLen,
        cz,
    ];
}

// ── Scan-space → world-space axis conversions ────────────────────────────────
//
// Axis remapping so the diagonal (x+w) dimension is VERTICAL (world Z = up),
// and the free maze axes y and z form the horizontal FLOOR plane:
//
//   scan_y  (origin-relative, [0, N√2])  → world X  =  v / √2
//   scan_z  (origin-relative, [0, N√2])  → world Y  =  v / √2
//   scan_x  (centred at 0)               → world Z  =  v / √2 + (N-1)/2
//
// Effect:  at the hyper-slice extremes, scan_x width → 0, so the cross-section
// collapses to a thin HORIZONTAL SLAB (floor/ceiling).  At the centre diagonal
// scan_x fills [–(N-1)/√2, (N-1)/√2], giving a full-height 3D volume.
// Arrow keys (world X/Y) navigate the floor; W/S moves vertically through the
// diagonal axis; E/D shifts which horizontal floors are visible.

function toWorldX(v)    { return v / SQRT2_4D; }
function toWorldY(v)    { return v / SQRT2_4D; }
function toWorldZ(v, N) { return v / SQRT2_4D + (N - 1) / 2; }

// ── Top-level draw dispatch ───────────────────────────────────────────────────

function drawHyperVolume4d() {
    hyperCtx.clearRect(0, 0, hyperCanvas.width, hyperCanvas.height);
    pickCells4d = [];
    if (scanActive4d && !peeking4d) {
        drawScanSlice4d();
        drawPlayerDot4d();
    } else {
        drawEditLayer4d();
    }
}

// ── Edit mode: render the active hyperdiagonal slice ─────────────────────────
//
// Only cells where x+w = hyperLayer are drawn (the active 3D cross-section).
// The cell position in world space is derived from getCellSliceSegment4d at
// the full-width slice S = hyperLayerToSlice4d(hyperLayer), i.e. C = hyperLayer+1.
// This gives each cell exactly [x, x+1] in the diagonal axis and
// [y, y+1] / [z, z+1] in the free axes — a proper unit-size 3D lattice.
//
// Ghost rendering of off-diagonal cells is deferred to M10.2.

function drawEditLayer4d() {
    const N  = gridSize4d;
    const d4 = hyperLayer;
    // Path cells on the active diagonal (null when unsolvable or no path crosses here).
    const pathSet = getBfsPathSetForHyperDiagonal(d4);

    const cubes = [];

    // Iterate ALL cells — active diagonal at full alpha, others as faint ghost context.
    // Mirrors drawMaze3d which renders every diagonal with layered opacity so the full
    // 4D volume shape is always visible as structural context.
    for (let w = 0; w < N; w++) {
        for (let z = 0; z < N; z++) {
            for (let y = 0; y < N; y++) {
                for (let x = 0; x < N; x++) {
                    const cellDiag   = x + w;
                    const isActiveDiag = cellDiag === d4;

                    // Project each cell at its own diagonal centre so ghost cells sit at
                    // their natural world-space positions (spread across the diagonal axis).
                    const S_cell = hyperLayerToSlice4d(cellDiag);
                    const seg = getCellSliceSegment4d(x, y, z, w, S_cell);
                    if (!seg) continue;

                    const isWall = getCell4d(x, y, z, w) === 1;

                    // Axis remapping: y→worldX, z→worldY, diagonal→worldZ (vertical)
                    const wx0 = toWorldX(seg.y0), wx1 = toWorldX(seg.y1);
                    const wy0 = toWorldY(seg.z0), wy1 = toWorldY(seg.z1);
                    const wz0 = toWorldZ(seg.x0, N), wz1 = toWorldZ(seg.x1, N);

                    const cornersWorld = [
                        [wx0, wy0, wz0], [wx1, wy0, wz0],
                        [wx1, wy1, wz0], [wx0, wy1, wz0],
                        [wx0, wy0, wz1], [wx1, wy0, wz1],
                        [wx1, wy1, wz1], [wx0, wy1, wz1],
                    ];

                    const corners = cornersWorld.map(pt => project3d(pt[0], pt[1], pt[2], N));
                    if (corners.some(pt => pt === null)) continue;

                    const depth = corners.reduce((acc, pt) => acc + pt[2], 0) / corners.length;

                    // Only pickable cells enter the pick buffer:
                    // must be on the active diagonal AND on the focused Z-layer (if any).
                    const isPickable = isActiveDiag && (editLayerZ4d < 0 || z === editLayerZ4d);
                    if (isPickable) {
                        const cx = (wx0 + wx1) * 0.5;
                        const cy = (wy0 + wy1) * 0.5;
                        const cz = (wz0 + wz1) * 0.5;
                        const cp = project3d(cx, cy, cz, N);
                        if (cp) pickCells4d.push({ x, y, z, w, depth, sx: cp[0], sy: cp[1] });
                    }

                    const EPS = 0.0005;
                    const isPlayer = isActiveDiag
                        && player4d.sx >= wx0 + EPS && player4d.sx <= wx1 - EPS
                        && player4d.sy >= wy0 + EPS && player4d.sy <= wy1 - EPS
                        && player4d.sz >= wz0 + EPS && player4d.sz <= wz1 - EPS;

                    // Z-layer focus applies only within the active diagonal.
                    const isActiveLayer = isActiveDiag && (editLayerZ4d < 0 || z === editLayerZ4d);

                    cubes.push({
                        corners,
                        depth,
                        isWall,
                        isPath:       isActiveDiag && !!(pathSet && pathSet.has(`${x},${y},${z},${w}`)),
                        isActiveLayer,
                        isActiveDiag,
                        isPlayer,
                        isStart:  isStartCell4d(x, y, z, w),
                        isEnd:    isEndCell4d(x, y, z, w),
                        mode: 'edit',
                    });
                }
            }
        }
    }

    cubes.sort((a, b) => b.depth - a.depth);
    cubes.forEach(cube => drawCube(cube));
}

// ── Scan mode: render the 4D hyperplane cross-section ────────────────────────
//
// Iterates all (w,z,y,x) and shows only cells that intersect the current
// hyperSliceOffset plane.  World-space mapping uses the per-axis conversions
// fixed in M0.4 so scan_x (centred) and scan_y/z (origin-relative) land in
// the correct positions for project3d.

function drawScanSlice4d() {
    const N = gridSize4d;
    const pathSet = getBfsPathSet4d(); // Set<"x,y,z,w"> or null
    const cubes = [];

    for (let w = 0; w < N; w++) {
        for (let z = 0; z < N; z++) {
            for (let y = 0; y < N; y++) {
                for (let x = 0; x < N; x++) {
                    const seg = getCellSliceSegment4d(x, y, z, w, hyperSliceOffset);
                    if (!seg) continue;

                    const isWall = getCell4d(x, y, z, w) === 1;

                    // Axis remapping: y→worldX, z→worldY, diagonal→worldZ (vertical)
                    const wx0 = toWorldX(seg.y0), wx1 = toWorldX(seg.y1);
                    const wy0 = toWorldY(seg.z0), wy1 = toWorldY(seg.z1);
                    const wz0 = toWorldZ(seg.x0, N), wz1 = toWorldZ(seg.x1, N);

                    const cornersWorld = [
                        [wx0, wy0, wz0], [wx1, wy0, wz0],
                        [wx1, wy1, wz0], [wx0, wy1, wz0],
                        [wx0, wy0, wz1], [wx1, wy0, wz1],
                        [wx1, wy1, wz1], [wx0, wy1, wz1],
                    ];

                    const corners = cornersWorld.map(pt => project3d(pt[0], pt[1], pt[2], N));
                    if (corners.some(pt => pt === null)) continue;

                    const depth = corners.reduce((acc, pt) => acc + pt[2], 0) / corners.length;

                    // Pick buffer follows the active hyperdiagonal so returning to edit
                    // mode lands on a meaningful layer.
                    if ((x + w) === hyperLayer) {
                        const cx = (wx0 + wx1) * 0.5;
                        const cy = (wy0 + wy1) * 0.5;
                        const cz = (wz0 + wz1) * 0.5;
                        const cp = project3d(cx, cy, cz, N);
                        if (cp) pickCells4d.push({ x, y, z, w, depth, sx: cp[0], sy: cp[1] });
                    }

                    cubes.push({
                        corners,
                        depth,
                        isWall,
                        isPath:       !!(pathSet && pathSet.has(`${x},${y},${z},${w}`)),
                        isActiveLayer: (x + w) === hyperLayer,
                        isPlayer: false,
                        isStart:  isStartCell4d(x, y, z, w),
                        isEnd:    isEndCell4d(x, y, z, w),
                        mode: 'scan',
                    });
                }
            }
        }
    }

    cubes.sort((a, b) => b.depth - a.depth);
    cubes.forEach(cube => drawCube(cube));
}

// ── Cube face renderer ────────────────────────────────────────────────────────

function drawCube(cube) {
    const faces = [
        [0, 1, 5, 4], [1, 2, 6, 5],
        [2, 3, 7, 6], [3, 0, 4, 7],
        [0, 1, 2, 3], [4, 5, 6, 7],
    ];

    // Ghost diagonal in edit mode: very low alpha structural context.
    // Skip expensive semantic-colour logic; anchors get a slight boost.
    if (cube.mode === 'edit' && !cube.isActiveDiag) {
        const isAnchor = cube.isStart || cube.isEnd;
        const color = cube.isStart ? [93, 255, 176]
                    : cube.isEnd   ? [255, 106, 106]
                    : cube.isWall  ? [22, 28, 42]
                                   : [95, 145, 235];
        const alpha = isAnchor ? 0.13 : (cube.isWall ? 0.06 : 0.012);
        faces.forEach((face, i) => {
            hyperCtx.beginPath();
            hyperCtx.moveTo(cube.corners[face[0]][0], cube.corners[face[0]][1]);
            for (let j = 1; j < face.length; j++) {
                hyperCtx.lineTo(cube.corners[face[j]][0], cube.corners[face[j]][1]);
            }
            hyperCtx.closePath();
            const shade = 0.56 + i * 0.08;
            hyperCtx.fillStyle = `rgba(${Math.round(color[0]*shade)},${Math.round(color[1]*shade)},${Math.round(color[2]*shade)},${alpha})`;
            hyperCtx.fill();
            if (isAnchor) {
                hyperCtx.strokeStyle = 'rgba(255,255,255,0.06)';
                hyperCtx.lineWidth = 0.5;
                hyperCtx.stroke();
            }
        });
        return;
    }

    const isInactive = !cube.isActiveLayer;

    // Base colour and alpha encode semantic role and layer activity.
    let baseColor = cube.isWall ? [22, 28, 42] : [95, 145, 235];
    let alpha     = cube.isWall ? 0.14 : 0.03;

    if (cube.isActiveLayer) {
        baseColor = cube.isWall ? [12, 16, 28] : [115, 180, 255];
        alpha     = cube.isWall ? 0.94 : 0.34;
    }

    if (cube.mode === 'scan') {
        alpha = cube.isWall ? 0.84 : 0.07;
        if (isInactive) alpha *= 0.68;
    }

    // Path highlight (gold) overrides the default passable colour.
    // isStart/isEnd checks below still take precedence over path colouring.
    if (cube.isPath && !cube.isWall) {
        baseColor = [255, 216, 79]; // #ffd84f — matches 3D's path gold
        alpha = cube.mode === 'scan'
            ? (cube.isActiveLayer ? 0.82 : 0.22)
            : 0.85;
    }

    if (cube.isStart) {
        baseColor = [93, 255, 176];
        alpha = cube.isActiveLayer ? 0.92 : 0.34;
    }

    if (cube.isEnd) {
        baseColor = [255, 106, 106];
        alpha = cube.isActiveLayer ? 0.92 : 0.34;
    }

    if (cube.isPlayer) {
        baseColor = [125, 255, 46];
        alpha = 0.9;
    }

    faces.forEach((face, i) => {
        hyperCtx.beginPath();
        hyperCtx.moveTo(cube.corners[face[0]][0], cube.corners[face[0]][1]);
        for (let j = 1; j < face.length; j++) {
            hyperCtx.lineTo(cube.corners[face[j]][0], cube.corners[face[j]][1]);
        }
        hyperCtx.closePath();

        const shade = 0.56 + i * 0.08;
        hyperCtx.fillStyle = `rgba(${Math.round(baseColor[0]*shade)},${Math.round(baseColor[1]*shade)},${Math.round(baseColor[2]*shade)},${alpha})`;
        hyperCtx.fill();

        hyperCtx.strokeStyle = cube.isPlayer
            ? 'rgba(220,255,180,0.95)'
            : `rgba(255,255,255,${isInactive ? 0.03 : (cube.isWall ? 0.22 : 0.11)})`;
        hyperCtx.lineWidth = (cube.isPlayer ? 1.5 : (isInactive ? 0.6 : 1)) * Math.sqrt(cameraZoom4d);
        hyperCtx.stroke();
    });
}

// ── Player dot (scan mode) ────────────────────────────────────────────────────
//
// Drawn AFTER all cubes so it always appears on top.
// A radial-gradient halo + a hard bright core give the "glowing" look.

function drawPlayerDot4d() {
    const N  = gridSize4d;
    const pt = project3d(player4d.sx, player4d.sy, player4d.sz, N);
    if (!pt) return;
    const [sx, sy] = pt;

    hyperCtx.save();

    // Soft outer glow
    const grd = hyperCtx.createRadialGradient(sx, sy, 1, sx, sy, 20);
    grd.addColorStop(0,    'rgba(180,255,80,0.55)');
    grd.addColorStop(0.4,  'rgba(125,255,46,0.22)');
    grd.addColorStop(1,    'rgba(80,200,20,0)');
    hyperCtx.beginPath();
    hyperCtx.arc(sx, sy, 20, 0, Math.PI * 2);
    hyperCtx.fillStyle = grd;
    hyperCtx.fill();

    // Hard bright core
    hyperCtx.shadowColor = 'rgba(160,255,70,0.85)';
    hyperCtx.shadowBlur  = 12;
    hyperCtx.beginPath();
    hyperCtx.arc(sx, sy, 4, 0, Math.PI * 2);
    hyperCtx.fillStyle = 'rgba(225,255,160,0.97)';
    hyperCtx.fill();

    hyperCtx.restore();
}

// ── Click / pick ──────────────────────────────────────────────────────────────

function pickCellFromScreen4d(clientX, clientY) {
    const rect   = hyperCanvas.getBoundingClientRect();
    const scaleX = hyperCanvas.width  / rect.width;
    const scaleY = hyperCanvas.height / rect.height;
    const sx = (clientX - rect.left) * scaleX;
    const sy = (clientY - rect.top)  * scaleY;

    const threshold = 26;
    let best = null;

    for (const cell of pickCells4d) {
        const dx = sx - cell.sx;
        const dy = sy - cell.sy;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > threshold * threshold) continue;
        if (!best
            || dist2 < best.dist2 - 1e-6
            || (Math.abs(dist2 - best.dist2) < 1e-6 && cell.depth > best.depth)) {
            best = { ...cell, dist2 };
        }
    }

    if (!best) return null;
    // Return all four coordinates so callers can pass w to toggleCell4d / isAnchorCell4d.
    return { x: best.x, y: best.y, z: best.z, w: best.w };
}

// ── Vector math helpers ───────────────────────────────────────────────────────

function norm3(v)    { const l = Math.hypot(v[0], v[1], v[2]); return [v[0]/l, v[1]/l, v[2]/l]; }
function sub3(a, b)  { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function cross3(a,b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function dot3(a, b)  { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
