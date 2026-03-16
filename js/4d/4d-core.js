/**
 * js/4d/4d-core.js
 *
 * CORE GEOMETRY AND STATE FOR 4D HYPER-MAZE
 */

let gridSize4d = 5;
let grid4d = []; // [id][ic][ib][ia]

// 3D slice control in the (b, c) plane: C3 = b + c
let layerOffset3d = 4;

// 4D slice control in the (a, d) plane: C4 = a + d
let hyperOffset = 4;

function maxLayerIndex4d() {
    return 2 * gridSize4d - 2;
}

/**
 * Initializes a deterministic 4D grid of size N.
 * Keeps both center slices reasonably traversable while still showing structure.
 */
function initGrid4d(n) {
    gridSize4d = n;
    grid4d = [];

    const center = n - 1;

    for (let id = 0; id < n; id++) {
        grid4d[id] = [];
        for (let ic = 0; ic < n; ic++) {
            grid4d[id][ic] = [];
            for (let ib = 0; ib < n; ib++) {
                grid4d[id][ic][ib] = [];
                for (let ia = 0; ia < n; ia++) {
                    // Deterministic structured pattern (no random flicker on resize).
                    const edgeBias = (ia === 0 || ib === 0 || ic === 0 || id === 0 ||
                        ia === n - 1 || ib === n - 1 || ic === n - 1 || id === n - 1);
                    const ring = Math.abs((ia + id) - center) + Math.abs((ib + ic) - center);
                    const patterned = ((ia * 7 + ib * 5 + ic * 3 + id * 11) % 9) < 3;
                    let isWall = edgeBias && patterned && ring > 1;

                    // Keep central crossing corridor open for visual continuity.
                    const onCrossA = (ia + id) === center;
                    const onCrossB = (ib + ic) === center;
                    if (onCrossA || onCrossB) isWall = false;

                    grid4d[id][ic][ib][ia] = isWall ? 1 : 0;
                }
            }
        }
    }
}

/**
 * 4D hypercell intersection with both active slice equations.
 * Returns a 3D prism chunk in scanner space, or null when no intersection.
 */
function getCellHyperIntersection(ia, ib, ic, id, c3, c4) {
    // For C4 = a + d: thickness over a in [ia, ia+1], d in [id, id+1]
    const aMin = Math.max(ia, c4 - id - 1);
    const aMax = Math.min(ia + 1, c4 - id);
    if (aMin >= aMax) return null;

    // For C3 = b + c: thickness over b in [ib, ib+1], c in [ic, ic+1]
    const bMin = Math.max(ib, c3 - ic - 1);
    const bMax = Math.min(ib + 1, c3 - ic);
    if (bMin >= bMax) return null;

    return {
        x0: 2 * bMin - c3,
        x1: 2 * bMax - c3,
        y0: ia,
        y1: ia + 1,
        z0: 2 * aMin - c4,
        z1: 2 * aMax - c4,
        isWall: grid4d[id][ic][ib][ia] === 1
    };
}
