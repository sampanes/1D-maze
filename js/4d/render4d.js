/**
 * js/4d/render4d.js
 * Renderer for editable/scannable 3D volume at current 4D layer.
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
    const D = N * 3.9;

    const Cx = N / 2;
    const Cy = N / 2;
    const Cz = N / 2;

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
    const N = gridSize4d;
    const flatten = getFlattenFactorForHyperLayer();
    const zCenter = (N - 1) / 2;

    hyperCtx.clearRect(0, 0, hyperCanvas.width, hyperCanvas.height);
    pickCells4d = [];

    const cubes = [];
    for (let z = 0; z < N; z++) {
        const zMapped = zCenter + (z - zCenter) * flatten;
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                const isWall = getCell4d(x, y, z, hyperOffset) === 1;

                const x0 = x;
                const x1 = x + 1;
                const y0 = y;
                const y1 = y + 1;
                const z0 = zMapped;
                const z1 = zMapped + Math.max(0.06, flatten);

                const corners = [
                    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
                    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]
                ].map((p) => project3d(p[0], p[1], p[2], N));

                if (corners.some((p) => p === null)) continue;

                const depth = corners.reduce((a, p) => a + p[2], 0) / 8;
                cubes.push({ corners, depth, isWall, x, y, z });

                const centerProj = project3d(x + 0.5, y + 0.5, zMapped + Math.max(0.03, flatten * 0.5), N);
                if (centerProj) {
                    pickCells4d.push({ sx: centerProj[0], sy: centerProj[1], depth: centerProj[2], x, y, z });
                }
            }
        }
    }

    cubes.sort((a, b) => b.depth - a.depth);
    for (const cube of cubes) {
        const isPlayer = cube.x === player4d.x && cube.y === player4d.y && cube.z === player4d.z;
        const isEditLayer = cube.z === layerOffset3d;
        drawCube(cube.corners, cube.isWall, isPlayer, isEditLayer);
    }
}

function drawCube(pts, isWall, isPlayer, isEditLayer) {
    const faces = [
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 0, 4, 7],
        [0, 1, 2, 3],
        [4, 5, 6, 7]
    ];

    let base = isWall ? [40, 50, 70] : [86, 132, 226];
    let alpha = isWall ? 0.9 : (isEditLayer ? 0.32 : 0.18);

    if (isPlayer) {
        base = [125, 255, 46];
        alpha = 0.96;
    }

    faces.forEach((face, i) => {
        hyperCtx.beginPath();
        hyperCtx.moveTo(pts[face[0]][0], pts[face[0]][1]);
        for (let j = 1; j < face.length; j++) hyperCtx.lineTo(pts[face[j]][0], pts[face[j]][1]);
        hyperCtx.closePath();

        const shade = 0.62 + i * 0.07;
        hyperCtx.fillStyle = `rgba(${base[0] * shade}, ${base[1] * shade}, ${base[2] * shade}, ${alpha})`;
        hyperCtx.fill();
        hyperCtx.strokeStyle = isPlayer ? 'rgba(196,255,153,0.95)' : 'rgba(255,255,255,0.12)';
        hyperCtx.lineWidth = isPlayer ? 1.5 : 1;
        hyperCtx.stroke();
    });
}

function pickCellFromScreen4d(clientX, clientY) {
    const rect = hyperCanvas.getBoundingClientRect();
    const sx = (clientX - rect.left) * (hyperCanvas.width / rect.width);
    const sy = (clientY - rect.top) * (hyperCanvas.height / rect.height);

    let best = null;
    for (const c of pickCells4d) {
        const dx = c.sx - sx;
        const dy = c.sy - sy;
        const d2 = dx * dx + dy * dy;
        if (d2 > 20 * 20) continue;
        if (!best || d2 < best.d2 || (Math.abs(d2 - best.d2) < 1e-5 && c.depth < best.depth)) {
            best = { ...c, d2 };
        }
    }
    return best;
}

function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
