/**
 * js/4d/4d-core.js
 * Core state/model for 4D maze editor + scanner prototype.
 */

let gridSize4d = 5;
let grid4d = []; // [w][z][y][x], 0 = passable, 1 = wall

// Build/edit layer in 3D volume (z axis)
let layerOffset3d = 2;

// 4th-d layer selector (w axis)
let hyperOffset = 2;

// Player (scanner controls): arrows for x/y, W/S for z.
let player4d = { x: 0, y: 0, z: 0 };

function maxLayerIndex4d() {
    return gridSize4d - 1;
}

function clamp4d(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

function initGrid4d(n) {
    gridSize4d = n;
    grid4d = [];

    for (let w = 0; w < n; w++) {
        grid4d[w] = [];
        for (let z = 0; z < n; z++) {
            grid4d[w][z] = [];
            for (let y = 0; y < n; y++) {
                grid4d[w][z][y] = new Array(n).fill(0);
            }
        }
    }

    const center = Math.floor(n / 2);
    layerOffset3d = center;
    hyperOffset = center;
    player4d = { x: 0, y: 0, z: center };
}

function getCell4d(x, y, z, w) {
    return grid4d[w][z][y][x];
}

function setCell4d(x, y, z, w, val) {
    grid4d[w][z][y][x] = val ? 1 : 0;
}

function toggleCell4d(x, y, z, w) {
    grid4d[w][z][y][x] = grid4d[w][z][y][x] ? 0 : 1;
}

function inBounds4d(x, y, z) {
    const N = gridSize4d;
    return x >= 0 && x < N && y >= 0 && y < N && z >= 0 && z < N;
}

function canOccupyPlayer4d(x, y, z) {
    if (!inBounds4d(x, y, z)) return false;
    return getCell4d(x, y, z, hyperOffset) === 0;
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

function stabilizePlayerAfterHyperShift() {
    if (canOccupyPlayer4d(player4d.x, player4d.y, player4d.z)) return;

    // Cheap nearest-position stabilization in same local neighborhood.
    for (let r = 1; r <= gridSize4d; r++) {
        for (let dz = -r; dz <= r; dz++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const x = player4d.x + dx;
                    const y = player4d.y + dy;
                    const z = player4d.z + dz;
                    if (canOccupyPlayer4d(x, y, z)) {
                        player4d.x = x;
                        player4d.y = y;
                        player4d.z = z;
                        return;
                    }
                }
            }
        }
    }
}

function getFlattenFactorForHyperLayer() {
    const center = (gridSize4d - 1) / 2;
    if (center <= 0) return 1;
    const dist = Math.abs(hyperOffset - center);
    return Math.max(0, 1 - dist / center);
}
