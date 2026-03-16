/**
 * js/4d/render4d.js
 *
 * 3D RENDERING PIPELINE FOR THE 4D HYPER-SLICE
 */

let hyperCtx;
let hyperCanvas;
let cameraAz4d = 45 * Math.PI / 180;
let cameraEl4d = 30 * Math.PI / 180;

function initRender4d() {
    hyperCanvas = document.getElementById('hyperCanvas');
    hyperCtx = hyperCanvas.getContext('2d');
}

function project3d(x, y, z, N) {
    const AZ = cameraAz4d;
    const EL = cameraEl4d;
    const D = N * 4.0;

    const Cx = 0;
    const Cy = N / 2;
    const Cz = 0;

    const eye = [
        Cx + D * Math.sin(AZ) * Math.cos(EL),
        Cy - D * Math.cos(AZ) * Math.cos(EL),
        Cz + D * Math.sin(EL)
    ];

    const fwd = norm3(sub3([Cx, Cy, Cz], eye));
    const right = norm3(cross3(fwd, [0, 0, 1]));
    const camUp = cross3(right, fwd);

    const focalLen = (hyperCanvas.width * 0.5) / Math.tan(30 * Math.PI / 180);
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
    const C3 = layerOffset3d;
    const C4 = hyperOffset;

    hyperCtx.clearRect(0, 0, hyperCanvas.width, hyperCanvas.height);

    const prisms = [];

    for (let id = 0; id < N; id++) {
        for (let ic = 0; ic < N; ic++) {
            for (let ib = 0; ib < N; ib++) {
                for (let ia = 0; ia < N; ia++) {
                    const rect = getCellHyperIntersection(ia, ib, ic, id, C3, C4);
                    if (!rect) continue;

                    const corners = [
                        [rect.x0, rect.y0, rect.z0], [rect.x1, rect.y0, rect.z0],
                        [rect.x1, rect.y1, rect.z0], [rect.x0, rect.y1, rect.z0],
                        [rect.x0, rect.y0, rect.z1], [rect.x1, rect.y0, rect.z1],
                        [rect.x1, rect.y1, rect.z1], [rect.x0, rect.y1, rect.z1]
                    ].map(p => project3d(p[0], p[1], p[2], N));

                    if (corners.some(p => p === null)) continue;

                    const depth = corners.reduce((acc, p) => acc + p[2], 0) / 8;
                    prisms.push({ corners, depth, isWall: rect.isWall });
                }
            }
        }
    }

    prisms.sort((a, b) => b.depth - a.depth);
    prisms.forEach((p) => drawPrism(p.corners, p.isWall));
}

function drawPrism(pts, isWall) {
    const faces = [
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 0, 4, 7],
        [0, 1, 2, 3],
        [4, 5, 6, 7]
    ];

    const baseColor = isWall ? [40, 50, 70] : [100, 150, 255];
    const alpha = isWall ? 0.8 : 0.22;

    faces.forEach((face, i) => {
        hyperCtx.beginPath();
        hyperCtx.moveTo(pts[face[0]][0], pts[face[0]][1]);
        for (let j = 1; j < face.length; j++) {
            hyperCtx.lineTo(pts[face[j]][0], pts[face[j]][1]);
        }
        hyperCtx.closePath();

        const shade = 0.62 + (i * 0.07);
        hyperCtx.fillStyle = `rgba(${baseColor[0] * shade}, ${baseColor[1] * shade}, ${baseColor[2] * shade}, ${alpha})`;
        hyperCtx.fill();

        hyperCtx.strokeStyle = `rgba(255, 255, 255, ${isWall ? 0.26 : 0.12})`;
        hyperCtx.lineWidth = 1;
        hyperCtx.stroke();
    });
}

function norm3(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
}
function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
