/**
 * js/4d/4d-core.js
 *
 * Core state and interaction model for the 4D editor/scanner.
 */

const SQRT2_4D = Math.SQRT2;
const HYPER_SLICE_SPEED = 3.2;

let gridSize4d = 5;
let grid4d = []; // [w][z][y][x]

let layerOffset3d = 0;
let hyperOffset = 0; // discrete edit layer index (w)
let hyperSliceOffset = 0; // continuous scan slice offset (S)
let scanActive4d = false;
let keysDown4d = {};
let player4d = { x: 0, y: 0, z: 0 };

function getAnchorLayerZ4d() {
    return Math.floor(gridSize4d / 2);
}

function getStartCell4d() {
    return { x: 0, y: 0, z: getAnchorLayerZ4d() };
}

function getEndCell4d() {
    return { x: gridSize4d - 1, y: gridSize4d - 1, z: getAnchorLayerZ4d() };
}

function isStartCell4d(x, y, z) {
    const start = getStartCell4d();
    return x === start.x && y === start.y && z === start.z;
}

function isEndCell4d(x, y, z) {
    const end = getEndCell4d();
    return x === end.x && y === end.y && z === end.z;
}

function isAnchorCell4d(x, y, z) {
    return isStartCell4d(x, y, z) || isEndCell4d(x, y, z);
}

function playerReachedEnd4d() {
    return isEndCell4d(player4d.x, player4d.y, player4d.z);
}

function maxLayerIndex4d() {
    return gridSize4d - 1;
}

function clamp4d(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

function initGrid4d(n) {
    gridSize4d = n;
    grid4d = Array.from({ length: n }, () =>
        Array.from({ length: n }, () =>
            Array.from({ length: n }, () =>
                Array.from({ length: n }, () => 0)
            )
        )
    );

    const center = Math.floor(n / 2);
    layerOffset3d = center;
    hyperOffset = center;
    hyperSliceOffset = hyperOffsetToSlice4d(center);
    scanActive4d = false;
    keysDown4d = {};

    const start = getStartCell4d();
    player4d = { x: start.x, y: start.y, z: start.z };
}

function inBounds4d(x, y, z, w = hyperOffset) {
    const max = gridSize4d;
    return x >= 0 && y >= 0 && z >= 0 && w >= 0 && x < max && y < max && z < max && w < max;
}

function getCell4d(x, y, z, w = hyperOffset) {
    if (!inBounds4d(x, y, z, w)) return 1;
    return grid4d[w][z][y][x];
}

function setCell4d(x, y, z, w, value) {
    if (!inBounds4d(x, y, z, w)) return false;
    grid4d[w][z][y][x] = value ? 1 : 0;
    return true;
}

function toggleCell4d(x, y, z, w = hyperOffset) {
    if (!inBounds4d(x, y, z, w)) return false;
    if (isAnchorCell4d(x, y, z)) return false;
    grid4d[w][z][y][x] = grid4d[w][z][y][x] ? 0 : 1;
    return true;
}

function getSliceBounds4d() {
    const max = gridSize4d * SQRT2_4D;
    return { min: 0.0001, max: max - 0.0001 };
}

function hyperOffsetToSlice4d(wIndex) {
    return (wIndex + 0.5) / SQRT2_4D;
}

function getSliceEquationConstant4d() {
    return hyperSliceOffset * SQRT2_4D;
}

function getClosestWForSliceAndX(x, C = getSliceEquationConstant4d()) {
    const raw = C - (x + 0.5);
    return clamp4d(Math.round(raw), 0, maxLayerIndex4d());
}

function canOccupyPlayer4d(x, y, z) {
    if (scanActive4d) {
        if (!inBounds4d(x, y, z, 0)) return false;
        for (let w = 0; w < gridSize4d; w++) {
            if (getCellSliceSegment4d(x, y, z, w, hyperSliceOffset) && getCell4d(x, y, z, w) === 0) return true;
        }
        return false;
    }
    return inBounds4d(x, y, z, hyperOffset) && getCell4d(x, y, z, hyperOffset) === 0;
}

function movePlayer4d(dx, dy, dz) {
    const nx = player4d.x + dx;
    const ny = player4d.y + dy;
    const nz = player4d.z + dz;

    if (!canOccupyPlayer4d(nx, ny, nz)) return false;

    player4d.x = nx;
    player4d.y = ny;
    player4d.z = nz;
    return true;
}

function stabilizePlayer4d() {
    if (canOccupyPlayer4d(player4d.x, player4d.y, player4d.z)) return true;

    const maxRadius = gridSize4d - 1;
    for (let radius = 1; radius <= maxRadius; radius++) {
        for (let dz = -radius; dz <= radius; dz++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const manhattan = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
                    if (manhattan === 0 || manhattan > radius) continue;

                    const x = player4d.x + dx;
                    const y = player4d.y + dy;
                    const z = player4d.z + dz;

                    if (canOccupyPlayer4d(x, y, z)) {
                        player4d = { x, y, z };
                        return true;
                    }
                }
            }
        }
    }

    const start = getStartCell4d();
    player4d = { x: start.x, y: start.y, z: start.z };
    return canOccupyPlayer4d(player4d.x, player4d.y, player4d.z);
}

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
        z1: (z + 1) * SQRT2_4D
    };
}

function updateHyperSliceFromInput4d(dt) {
    if (!scanActive4d) return false;

    let dir = 0;
    if (keysDown4d['KeyE']) dir += 1;
    if (keysDown4d['KeyD']) dir -= 1;
    if (!dir) return false;

    const bounds = getSliceBounds4d();
    hyperSliceOffset = clamp4d(hyperSliceOffset + (dir * HYPER_SLICE_SPEED * dt), bounds.min, bounds.max);
    stabilizePlayer4d();
    return true;
}

function setScanActive4d(active) {
    scanActive4d = !!active;
    if (scanActive4d) {
        hyperSliceOffset = hyperOffsetToSlice4d(hyperOffset);
    } else {
        hyperOffset = clamp4d(Math.round(hyperSliceOffset * SQRT2_4D - 0.5), 0, maxLayerIndex4d());
    }
    stabilizePlayer4d();
}

function getFlattenFactorForHyperLayer() {
    const center = (gridSize4d - 1) / 2;
    const maxDist = Math.max(center, 0.0001);
    const dist = Math.abs(hyperOffset - center);
    return clamp4d(1 - (dist / maxDist), 0, 1);
}
