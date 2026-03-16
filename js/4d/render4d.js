/**
 * js/4d/render4d.js
 *
 * 3D renderer for edit-layer view and 4D scan cross-sections.
 */

let hyperCtx;
let hyperCanvas;
let cameraAz4d = 45 * Math.PI / 180;
let cameraEl4d = 30 * Math.PI / 180;
let pickCells4d = [];

function initRender4d() {
    hyperCanvas = document.getElementById('hyperCanvas');
    hyperCtx = hyperCanvas.getContext('2d');
}

function project3d(x, y, z, N) {
    const AZ = cameraAz4d;
    const EL = cameraEl4d;
    const D = N * 3.5;

    const center = (N - 1) / 2;
    const Cx = center;
    const Cy = center;
    const Cz = center;

    const eye = [
        Cx + D * Math.sin(AZ) * Math.cos(EL),
        Cy - D * Math.cos(AZ) * Math.cos(EL),
        Cz + D * Math.sin(EL)
    ];

    const fwd = norm3(sub3([Cx, Cy, Cz], eye));
    const right = norm3(cross3(fwd, [0, 0, 1]));
    const camUp = cross3(right, fwd);

    const focalLen = (hyperCanvas.width * 0.5) / Math.tan(32 * Math.PI / 180);
    const screenCx = hyperCanvas.width / 2;
    const screenCy = hyperCanvas.height / 2;

    const dir = [x - eye[0], y - eye[1], z - eye[2]];
    const cz = dot3(dir, fwd);
    if (cz < 0.01) return null;

    return [
        screenCx + (dot3(dir, right) / cz) * focalLen,
        screenCy - (dot3(dir, camUp) / cz) * focalLen,
        cz
    ];
}

function drawHyperVolume4d() {
    hyperCtx.clearRect(0, 0, hyperCanvas.width, hyperCanvas.height);
    pickCells4d = [];

    if (scanActive4d) drawScanSlice4d();
    else drawEditLayer4d();
}

function drawEditLayer4d() {
    const N = gridSize4d;
    const w = hyperOffset;
    const flatten = getFlattenFactorForHyperLayer();
    const zCenter = (N - 1) / 2;
    const thickness = Math.max(0.06, flatten);

    const cubes = [];

    for (let z = 0; z < N; z++) {
        const zMapped = zCenter + (z - zCenter) * flatten;
        const z0 = zMapped - thickness / 2;
        const z1 = zMapped + thickness / 2;

        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                const isWall = getCell4d(x, y, z, w) === 1;

                const cornersWorld = [
                    [x - 0.5, y - 0.5, z0], [x + 0.5, y - 0.5, z0],
                    [x + 0.5, y + 0.5, z0], [x - 0.5, y + 0.5, z0],
                    [x - 0.5, y - 0.5, z1], [x + 0.5, y - 0.5, z1],
                    [x + 0.5, y + 0.5, z1], [x - 0.5, y + 0.5, z1]
                ];

                const corners = cornersWorld.map((pt) => project3d(pt[0], pt[1], pt[2], N));
                if (corners.some((pt) => pt === null)) continue;

                const depth = corners.reduce((acc, pt) => acc + pt[2], 0) / corners.length;
                const centerProj = project3d(x, y, zMapped, N);
                if (centerProj) pickCells4d.push({ x, y, z, depth, sx: centerProj[0], sy: centerProj[1] });

                cubes.push({
                    corners,
                    depth,
                    isWall,
                    isActiveLayer: z === layerOffset3d,
                    isPlayer: player4d.x === x && player4d.y === y && player4d.z === z,
                    isStart: isStartCell4d(x, y, z),
                    isEnd: isEndCell4d(x, y, z),
                    mode: 'edit'
                });
            }
        }
    }

    cubes.sort((a, b) => b.depth - a.depth);
    cubes.forEach((cube) => drawCube(cube));
}

function drawScanSlice4d() {
    const N = gridSize4d;
    const cubes = [];

    const scanScale = SQRT2_4D;
    const scanCenter = ((N * scanScale) / 2);
    const worldCenter = (N - 1) / 2;

    const toWorld = (v) => ((v - scanCenter) / scanScale) + worldCenter;

    for (let w = 0; w < N; w++) {
        for (let z = 0; z < N; z++) {
            for (let y = 0; y < N; y++) {
                for (let x = 0; x < N; x++) {
                    const seg = getCellSliceSegment4d(x, y, z, w, hyperSliceOffset);
                    if (!seg) continue;

                    const isWall = getCell4d(x, y, z, w) === 1;
                    const cornersWorld = [
                        [toWorld(seg.x0), toWorld(seg.y0), toWorld(seg.z0)],
                        [toWorld(seg.x1), toWorld(seg.y0), toWorld(seg.z0)],
                        [toWorld(seg.x1), toWorld(seg.y1), toWorld(seg.z0)],
                        [toWorld(seg.x0), toWorld(seg.y1), toWorld(seg.z0)],
                        [toWorld(seg.x0), toWorld(seg.y0), toWorld(seg.z1)],
                        [toWorld(seg.x1), toWorld(seg.y0), toWorld(seg.z1)],
                        [toWorld(seg.x1), toWorld(seg.y1), toWorld(seg.z1)],
                        [toWorld(seg.x0), toWorld(seg.y1), toWorld(seg.z1)]
                    ];

                    const corners = cornersWorld.map((pt) => project3d(pt[0], pt[1], pt[2], N));
                    if (corners.some((pt) => pt === null)) continue;

                    const depth = corners.reduce((acc, pt) => acc + pt[2], 0) / corners.length;

                    const centerProj = project3d(
                        toWorld((seg.x0 + seg.x1) * 0.5),
                        toWorld((seg.y0 + seg.y1) * 0.5),
                        toWorld((seg.z0 + seg.z1) * 0.5),
                        N
                    );
                    if (centerProj && w === hyperOffset) {
                        pickCells4d.push({ x, y, z, depth, sx: centerProj[0], sy: centerProj[1] });
                    }

                    cubes.push({
                        corners,
                        depth,
                        isWall,
                        isActiveLayer: w === hyperOffset,
                        isPlayer: player4d.x === x && player4d.y === y && player4d.z === z,
                        isStart: isStartCell4d(x, y, z),
                        isEnd: isEndCell4d(x, y, z),
                        mode: 'scan'
                    });
                }
            }
        }
    }

    cubes.sort((a, b) => b.depth - a.depth);
    cubes.forEach((cube) => drawCube(cube));
}

function drawCube(cube) {
    const faces = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [0, 1, 2, 3], [4, 5, 6, 7]];

    const isInactiveLayer = !cube.isActiveLayer;

    let baseColor = cube.isWall ? [22, 28, 42] : [95, 145, 235];
    let alpha = cube.isWall ? 0.14 : 0.03;

    if (cube.isActiveLayer) {
        baseColor = cube.isWall ? [12, 16, 28] : [115, 180, 255];
        alpha = cube.isWall ? 0.94 : 0.34;
    }

    if (cube.mode === 'scan') {
        alpha = cube.isWall ? 0.84 : 0.07;
        if (isInactiveLayer) alpha *= 0.68;
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
        for (let j = 1; j < face.length; j++) hyperCtx.lineTo(cube.corners[face[j]][0], cube.corners[face[j]][1]);
        hyperCtx.closePath();

        const shade = 0.56 + (i * 0.08);
        hyperCtx.fillStyle = `rgba(${baseColor[0] * shade}, ${baseColor[1] * shade}, ${baseColor[2] * shade}, ${alpha})`;
        hyperCtx.fill();

        hyperCtx.strokeStyle = cube.isPlayer
            ? 'rgba(220,255,180,0.95)'
            : `rgba(255,255,255,${isInactiveLayer ? 0.03 : (cube.isWall ? 0.22 : 0.11)})`;
        hyperCtx.lineWidth = cube.isPlayer ? 1.5 : (isInactiveLayer ? 0.6 : 1);
        hyperCtx.stroke();
    });
}

function pickCellFromScreen4d(clientX, clientY, targetLayer = null) {
    const rect = hyperCanvas.getBoundingClientRect();
    const scaleX = hyperCanvas.width / rect.width;
    const scaleY = hyperCanvas.height / rect.height;
    const sx = (clientX - rect.left) * scaleX;
    const sy = (clientY - rect.top) * scaleY;

    const threshold = 26;
    let best = null;

    for (const cell of pickCells4d) {
        if (targetLayer !== null && cell.z !== targetLayer) continue;
        const dx = sx - cell.sx;
        const dy = sy - cell.sy;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > threshold * threshold) continue;

        if (!best || dist2 < best.dist2 - 1e-6 || (Math.abs(dist2 - best.dist2) < 1e-6 && cell.depth > best.depth)) best = { ...cell, dist2 };
    }

    if (!best) return null;
    return { x: best.x, y: best.y, z: best.z };
}

function norm3(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
}
function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
