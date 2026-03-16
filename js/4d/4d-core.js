/**
 * js/4d/4d-core.js
 *
 * Core state and interaction model for the 4D editor/scanner.
 */

let gridSize4d = 5;
let grid4d = []; // [w][z][y][x]

let layerOffset3d = 0;
let hyperOffset = 0;
let player4d = { x: 0, y: 0, z: 0 };
let start4d = { x: 0, y: 0, z: 0 };
let end4d = { x: 0, y: 0, z: 0 };

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

    // Extrapolating from 2D/3D conventions: Start/End sit on opposite corners
    // while sharing one scanner cross-section layer (same z).
    start4d = { x: 0, y: 0, z: center };
    end4d = { x: n - 1, y: n - 1, z: center };
    player4d = { x: start4d.x, y: start4d.y, z: start4d.z };

    for (let w = 0; w < n; w++) {
        setCell4d(start4d.x, start4d.y, start4d.z, w, 0);
        setCell4d(end4d.x, end4d.y, end4d.z, w, 0);
    }
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
    grid4d[w][z][y][x] = grid4d[w][z][y][x] ? 0 : 1;
    return true;
}

function isAnchorCell4d(x, y, z) {
    return (x === start4d.x && y === start4d.y && z === start4d.z)
        || (x === end4d.x && y === end4d.y && z === end4d.z);
}

function canOccupyPlayer4d(x, y, z, w = hyperOffset) {
    return inBounds4d(x, y, z, w) && getCell4d(x, y, z, w) === 0;
}

function movePlayer4d(dx, dy, dz) {
    const nx = player4d.x + dx;
    const ny = player4d.y + dy;
    const nz = player4d.z + dz;

    if (!canOccupyPlayer4d(nx, ny, nz, hyperOffset)) return false;

    player4d.x = nx;
    player4d.y = ny;
    player4d.z = nz;
    return true;
}

function stabilizePlayerAfterHyperShift() {
    if (canOccupyPlayer4d(player4d.x, player4d.y, player4d.z, hyperOffset)) return true;

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

                    if (canOccupyPlayer4d(x, y, z, hyperOffset)) {
                        player4d = { x, y, z };
                        return true;
                    }
                }
            }
        }
    }

    const c = Math.floor(gridSize4d / 2);
    player4d = { x: c, y: c, z: c };
    return canOccupyPlayer4d(player4d.x, player4d.y, player4d.z, hyperOffset);
}

function getFlattenFactorForHyperLayer() {
    const lowCenter = Math.floor((gridSize4d - 1) / 2);
    const highCenter = Math.ceil((gridSize4d - 1) / 2);
    const distToCenter = Math.min(
        Math.abs(hyperOffset - lowCenter),
        Math.abs(hyperOffset - highCenter)
    );

    const maxDist = Math.max(lowCenter, (gridSize4d - 1) - highCenter, 0.0001);
    return clamp4d(1 - (distToCenter / maxDist), 0, 1);
}
