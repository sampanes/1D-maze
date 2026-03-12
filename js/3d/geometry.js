// js/3d/geometry.js — Phase 3 Step 5: prism slice intersection math

// Returns the cross-section rectangle of prism (i,j,k) at world slice S,
// in world-space coords { x0, x1, y0, y1 }, or null if the slice misses.
//
// Scan diagonal convention on this page is d = i + k. At center slice
// S = N/SQ2 (C=N), cells with i+k=N-1 have full-height rectangles.
function getCellSliceRect(i, j, k, S) {
    const C = S * SQ2;

    // Intersect along the (i,k) diagonal pair so scan matches the editor layering.
    const iMin = Math.max(i, C - k - 1);
    const iMax = Math.min(i + 1, C - k);
    if (iMin >= iMax) return null;

    const h = (iMax - iMin) * SQ2;
    const cy = (2 * j + 1 - C) / SQ2;

    return {
        x0: i * SQ2,
        x1: (i + 1) * SQ2,
        y0: cy - h * 0.5,
        y1: cy + h * 0.5,
    };
}

// Iterates every cell in grid3d and collects non-null slice rects.
// Returns { walls: [...], passable: [...], startRect: rect|null, endRect: rect|null }.
function buildCrossSection(S) {
    const N = gridSize3d;
    const walls = [];
    const passable = [];
    let startRect = null;
    let endRect = null;

    for (let k = 0; k < N; k++) {
        for (let j = 0; j < N; j++) {
            for (let i = 0; i < N; i++) {
                const rect = getCellSliceRect(i, j, k, S);
                if (!rect) continue;

                const isStart = i === 0 && j === 0 && k === N - 1;
                const isEnd = i === N - 1 && j === N - 1 && k === 0;
                if (isStart) startRect = rect;
                else if (isEnd) endRect = rect;
                else if (grid3d[k][j][i] === 1) walls.push(rect);
                else passable.push(rect);
            }
        }
    }

    return { walls, passable, startRect, endRect };
}

function getCenterSliceOffset() {
    return gridSize3d / SQ2;
}
