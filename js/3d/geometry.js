// js/3d/geometry.js — Phase 3 Step 5: prism slice intersection math
// Implements the geometry from STEPS.md "GEOMETRY REFERENCE".

// ── Core slice function ───────────────────────────────────────────────────────

// Returns the cross-section rectangle of prism (i,j,k) at world-Z slice S,
// in world-space coords { x0, x1, y0, y1 }, or null if the slice misses.
//
// World transform: X_world = i (× SQ2 for cell width), Y_world = (y-z)/SQ2,
// Z_world = (y+z)/SQ2.  At slice S, C = S·SQ2.  Prism is hit when
// j+k < C < j+k+2 (i.e. yMin < yMax below).
//
// Verified: getCellSliceRect(1,1,1, 3/SQ2) → { x0:SQ2, x1:2·SQ2, y0:−SQ2/2, y1:SQ2/2 }
/**
 * Compute the intersection rectangle between one voxel prism and the active slice plane.
 * @param {number} i - Cell x index.
 * @param {number} j - Cell y index.
 * @param {number} k - Cell z index.
 * @param {number} S - Slice offset in world-Z units.
 * @returns {{x0:number,x1:number,y0:number,y1:number}|null} Rect in world coords, or null if not intersected.
 */
function getCellSliceRect(i, j, k, S) {
    const C    = S * SQ2;
    const yMin = Math.max(j,     C - k - 1);
    const yMax = Math.min(j + 1, C - k);
    if (yMin >= yMax) return null;
    return {
        x0: i       * SQ2,
        x1: (i + 1) * SQ2,
        y0: (2 * yMin - C) / SQ2,
        y1: (2 * yMax - C) / SQ2,
    };
}

// ── Cross-section builder ─────────────────────────────────────────────────────

// Iterates every passable cell in grid3d and collects non-null slice rects.
// Start (i=0,j=0,k=N-1) and End (i=N-1,j=N-1,k=0) are tagged separately so
// the renderer can colour them distinctly; all three groups are walkable.
// Returns { passable: [...], startRect: rect|null, endRect: rect|null }.
/**
 * Build the walkable geometry for the current cross-section.
 * Also tags any currently validated BFS path cells that intersect this slice.
 * @param {number} S - Slice offset in world-Z units.
 * @returns {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}}
 */
function buildCrossSection(S) {
    const N = gridSize3d;
    const passable = [];
    const pathRects = [];
    let startRect = null;
    let endRect   = null;
    const pathSet = bfsPath3d ? new Set(bfsPath3d.map(([i, j, k]) => `${i},${j},${k}`)) : null;

    for (let k = 0; k < N; k++) {
        for (let j = 0; j < N; j++) {
            for (let i = 0; i < N; i++) {
                if (grid3d[k][j][i] === 1) continue;   // wall — skip
                const rect = getCellSliceRect(i, j, k, S);
                if (!rect) continue;
                if (i === 0 && j === 0 && k === N - 1) {
                    startRect = rect;
                } else if (i === N - 1 && j === N - 1 && k === 0) {
                    endRect = rect;
                } else {
                    passable.push(rect);
                    if (pathSet && pathSet.has(`${i},${j},${k}`)) {
                        pathRects.push(rect);
                    }
                }
            }
        }
    }

    return { passable, startRect, endRect, pathRects };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// World-Z of the centre cross-section: the slice where every cell on the
// centre diagonal (j+k = N-1) appears as a full-height SQ2 square, giving
// a perfect N×N grid.  S_centre = N / SQ2.
/**
 * Return the slice offset that produces the perfect N x N square cross-section.
 * @returns {number}
 */
function getCenterSliceOffset() {
    return gridSize3d / SQ2;
}
