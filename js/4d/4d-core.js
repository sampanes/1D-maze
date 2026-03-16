/**
 * js/4d/4d-core.js
 * 
 * CORE GEOMETRY AND STATE FOR 4D HYPER-MAZE
 */

let gridSize4d = 5;
let grid4d = []; // ia, ib, ic, id
let hyperOffset = 4; // Cw = ia + id

/**
 * Initializes a 4D grid of size N.
 * For the prototype, we just randomize some walls.
 */
function initGrid4d(n) {
    gridSize4d = n;
    grid4d = [];
    
    for (let id = 0; id < n; id++) {
        grid4d[id] = [];
        for (let ic = 0; ic < n; ic++) {
            grid4d[id][ic] = [];
            for (let ib = 0; ib < n; ib++) {
                grid4d[id][ic][ib] = [];
                for (let ia = 0; ia < n; ia++) {
                    // Random walls for visualization (30% density)
                    // But keep a "core" area more likely to be clear
                    const distFromCenter = Math.abs(ia + id - (n - 1)) + Math.abs(ib - n/2) + Math.abs(ic - n/2);
                    const threshold = 0.3 + (distFromCenter / (2 * n)) * 0.2;
                    grid4d[id][ic][ib][ia] = Math.random() < threshold ? 1 : 0;
                }
            }
        }
    }
}

/**
 * Calculates the 3D prism intersection of a 4D hyper-cell at Cw = ia + id.
 * 
 * @param {number} ia - 1st dim index
 * @param {number} ib - 2nd dim index (maps to 3D X)
 * @param {number} ic - 3rd dim index (maps to 3D Y)
 * @param {number} id - 4th dim index
 * @param {number} Cw - The current hyper-slice value (ia + id)
 * @returns {Object|null} The bounding box of the 3D prism or null
 */
function getCellHyperIntersection(ia, ib, ic, id, Cw) {
    const iaMin = Math.max(ia, Cw - id - 1);
    const iaMax = Math.min(ia + 1, Cw - id);

    if (iaMin >= iaMax) return null;

    const SQ2 = Math.sqrt(2);

    // X and Y are just the independent ib and ic dimensions
    // Z is the derived dimension from the (ia, id) intersection with ia + id = Cw
    return {
        x0: ib,
        x1: ib + 1,
        y0: ic,
        y1: ic + 1,
        z0: (2 * iaMin - Cw), // We can skip /SQ2 for visualization scaling if we want
        z1: (2 * iaMax - Cw),
        isWall: grid4d[id][ic][ib][ia] === 1
    };
}
