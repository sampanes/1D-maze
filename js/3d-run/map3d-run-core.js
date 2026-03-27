const RUN3D_MIN = 2;
const RUN3D_MAX = 16;
const RUN3D_SQ2 = Math.SQRT2;

function createEmptyGrid3dRun(n) {
    return Array.from({ length: n }, () =>
        Array.from({ length: n }, () => Array(n).fill(0))
    );
}

function decodeSerializedMap3dRun(mapString) {
    if (!mapString || mapString.length < 2) {
        return { ok: false, error: 'Missing or too-short map string.' };
    }

    const parsedSize = parseInt(mapString.slice(0, 2), 16);
    if (!Number.isFinite(parsedSize) || parsedSize < RUN3D_MIN || parsedSize > RUN3D_MAX) {
        return { ok: false, error: `Grid size must decode to ${RUN3D_MIN}-${RUN3D_MAX}.` };
    }

    const grid = createEmptyGrid3dRun(parsedSize);
    const payload = (mapString.slice(2).toUpperCase().match(/[0-9A-F]/g) || []).join('');
    const totalCells = parsedSize * parsedSize * parsedSize;
    let cellIndex = 0;

    for (let idx = 0; idx < payload.length && cellIndex < totalCells; idx++) {
        const nibble = parseInt(payload[idx], 16);
        for (let bit = 3; bit >= 0 && cellIndex < totalCells; bit--) {
            const value = (nibble >> bit) & 1;
            const plane = parsedSize * parsedSize;
            const k = Math.floor(cellIndex / plane);
            const rem = cellIndex % plane;
            const j = Math.floor(rem / parsedSize);
            const i = rem % parsedSize;

            const isStart = i === 0 && j === 0 && k === parsedSize - 1;
            const isEnd = i === parsedSize - 1 && j === parsedSize - 1 && k === 0;
            if (!isStart && !isEnd) {
                grid[k][j][i] = value;
            }
            cellIndex++;
        }
    }

    grid[parsedSize - 1][0][0] = 0;
    grid[0][parsedSize - 1][parsedSize - 1] = 0;

    return { ok: true, size: parsedSize, grid };
}

function bfs3dRun(grid) {
    const n = grid.length;
    if (!n) return null;
    if (grid[n - 1][0][0] === 1 || grid[0][n - 1][n - 1] === 1) return null;

    const parent = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => new Array(n).fill(null))
    );
    const visited = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => new Array(n).fill(false))
    );
    const queue = [{ i: 0, j: 0, k: n - 1 }];
    visited[n - 1][0][0] = true;

    const dirs = [
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1],
    ];

    while (queue.length) {
        const cur = queue.shift();
        if (cur.i === n - 1 && cur.j === n - 1 && cur.k === 0) {
            const path = [];
            let node = cur;
            while (node) {
                path.push([node.i, node.j, node.k]);
                node = parent[node.k][node.j][node.i];
            }
            return path;
        }

        for (const [di, dj, dk] of dirs) {
            const ni = cur.i + di;
            const nj = cur.j + dj;
            const nk = cur.k + dk;
            if (ni < 0 || nj < 0 || nk < 0 || ni >= n || nj >= n || nk >= n) continue;
            if (visited[nk][nj][ni] || grid[nk][nj][ni] === 1) continue;
            visited[nk][nj][ni] = true;
            parent[nk][nj][ni] = { i: cur.i, j: cur.j, k: cur.k };
            queue.push({ i: ni, j: nj, k: nk });
        }
    }

    return null;
}

function countWalls3dRun(grid) {
    let walls = 0;
    for (const layer of grid) {
        for (const row of layer) {
            for (const cell of row) {
                if (cell === 1) walls++;
            }
        }
    }
    return walls;
}

function getCenterSliceOffset3dRun(n) {
    return n / RUN3D_SQ2;
}

function getSliceBounds3dRun(n) {
    const max = n * RUN3D_SQ2;
    return { min: 0.0001, max: max - 0.0001 };
}

function getCellSliceRect3dRun(i, j, k, sliceOffset) {
    const c = sliceOffset * RUN3D_SQ2;
    const iMin = Math.max(i, c - k - 1);
    const iMax = Math.min(i + 1, c - k);
    if (iMin >= iMax) return null;

    return {
        x0: (2 * iMin - c) / RUN3D_SQ2,
        x1: (2 * iMax - c) / RUN3D_SQ2,
        y0: j * RUN3D_SQ2,
        y1: (j + 1) * RUN3D_SQ2,
    };
}

function buildCrossSection3dRun(grid, sliceOffset, bfsPath) {
    const n = grid.length;
    const passable = [];
    const pathRects = [];
    let startRect = null;
    let endRect = null;
    const pathSet = bfsPath ? new Set(bfsPath.map(([i, j, k]) => `${i},${j},${k}`)) : null;

    for (let k = 0; k < n; k++) {
        for (let j = 0; j < n; j++) {
            for (let i = 0; i < n; i++) {
                if (grid[k][j][i] === 1) continue;
                const rect = getCellSliceRect3dRun(i, j, k, sliceOffset);
                if (!rect) continue;

                if (i === 0 && j === 0 && k === n - 1) {
                    startRect = rect;
                } else if (i === n - 1 && j === n - 1 && k === 0) {
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
