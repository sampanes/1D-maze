// js/3d/geometry.js — diagonal cross-section geometry for the 3D scanner.

// ── Core slice function ───────────────────────────────────────────────────────

/**
 * Compute the intersection rectangle between one voxel prism and the active diagonal slice.
 *
 * Slice model used by scanner:
 * - The slice advances across the i+k diagonal (not j+k).
 * - At the center slice (S = N/SQ2), cells where i+k = N-1 are full SQ2 × SQ2 squares.
 * - j remains the full "front-to-back" axis of the slice grid.
 *
 * For the i-k intersection interval:
 *   iMin = max(i, C-k-1)
 *   iMax = min(i+1, C-k)
 * where C = S*SQ2, with hit only when iMin < iMax.
 *
 * @param {number} i - Cell i index.
 * @param {number} j - Cell j index.
 * @param {number} k - Cell k index.
 * @param {number} S - Slice offset in world-Z-like scanner units.
 * @returns {{x0:number,x1:number,y0:number,y1:number}|null}
 */
function getCellSliceRect(i, j, k, S) {
    const C = S * SQ2;
    const iMin = Math.max(i, C - k - 1);
    const iMax = Math.min(i + 1, C - k);
    if (iMin >= iMax) return null;

    // x-axis tracks the i↔k diagonal width (shrinks/expands with slicing)
    // y-axis tracks j depth (always full cell width)
    return {
        x0: (2 * iMin - C) / SQ2,
        x1: (2 * iMax - C) / SQ2,
        y0: j * SQ2,
        y1: (j + 1) * SQ2,
    };
}

// ── Cross-section builder ─────────────────────────────────────────────────────

/**
 * Build the walkable geometry for the current cross-section.
 * Also tags any currently validated BFS path cells that intersect this slice.
 * @param {number} S - Slice offset.
 * @returns {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}}
 */
function buildCrossSection(S) {
    const N = gridSize3d;
    const passable = [];
    const pathRects = [];
    let startRect = null;
    let endRect = null;
    const pathSet = bfsPath3d ? new Set(bfsPath3d.map(([i, j, k]) => `${i},${j},${k}`)) : null;

    for (let k = 0; k < N; k++) {
        for (let j = 0; j < N; j++) {
            for (let i = 0; i < N; i++) {
                if (grid3d[k][j][i] === 1) continue;
                const rect = getCellSliceRect(i, j, k, S);
                if (!rect) continue;

                if (i === 0 && j === 0 && k === N - 1) {
                    startRect = rect;
                } else if (i === N - 1 && j === N - 1 && k === 0) {
                    endRect = rect;
                } else {
                    passable.push(rect);
                    if (pathSet && pathSet.has(`${i},${j},${k}`)) pathRects.push(rect);
                }
            }
        }
    }

    return { passable, startRect, endRect, pathRects };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Return the slice offset that produces the center diagonal cross-section.
 * At this value the visible section is a perfect N×N square grid.
 * @returns {number}
 */
function getCenterSliceOffset() {
    return gridSize3d / SQ2;
}
