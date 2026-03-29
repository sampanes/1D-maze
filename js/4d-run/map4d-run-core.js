const RUN4D_MIN = 3;
const RUN4D_MAX = 10;
const RUN4D_SQ2 = Math.SQRT2;

function createEmptyGrid4dRun(n) {
    return Array.from({ length: n }, () =>
        Array.from({ length: n }, () =>
            Array.from({ length: n }, () => Array(n).fill(0))
        )
    );
}

function isStartCell4dRun(x, y, z, w, n) {
    return x === 0 && y === 0 && z === 0 && w === n - 1;
}

function isEndCell4dRun(x, y, z, w, n) {
    return x === n - 1 && y === n - 1 && z === n - 1 && w === 0;
}

function decodeSerializedMap4dRun(mapString) {
    if (!mapString || mapString.length < 2) {
        return { ok: false, error: 'Missing or too-short map string.' };
    }

    const parsedSize = parseInt(mapString.slice(0, 2), 16);
    if (!Number.isFinite(parsedSize) || parsedSize < RUN4D_MIN || parsedSize > RUN4D_MAX) {
        return { ok: false, error: `Grid size must decode to ${RUN4D_MIN}-${RUN4D_MAX}.` };
    }

    const grid = createEmptyGrid4dRun(parsedSize);
    const payload = (mapString.slice(2).toUpperCase().match(/[0-9A-F]/g) || []).join('');
    const totalCells = parsedSize ** 4;
    let cellIndex = 0;

    for (let idx = 0; idx < payload.length && cellIndex < totalCells; idx++) {
        const nibble = parseInt(payload[idx], 16);
        for (let bit = 3; bit >= 0 && cellIndex < totalCells; bit--) {
            const value = (nibble >> bit) & 1;
            const hyperPlane = parsedSize * parsedSize * parsedSize;
            const w = Math.floor(cellIndex / hyperPlane);
            const rem1 = cellIndex % hyperPlane;
            const z = Math.floor(rem1 / (parsedSize * parsedSize));
            const rem2 = rem1 % (parsedSize * parsedSize);
            const y = Math.floor(rem2 / parsedSize);
            const x = rem2 % parsedSize;

            if (!isStartCell4dRun(x, y, z, w, parsedSize) && !isEndCell4dRun(x, y, z, w, parsedSize)) {
                grid[w][z][y][x] = value;
            }
            cellIndex++;
        }
    }

    grid[parsedSize - 1][0][0][0] = 0;
    grid[0][parsedSize - 1][parsedSize - 1][parsedSize - 1] = 0;

    return { ok: true, size: parsedSize, grid };
}

function bfs4dRun(grid) {
    const n = grid.length;
    if (!n) return null;
    if (grid[n - 1][0][0][0] === 1 || grid[0][n - 1][n - 1][n - 1] === 1) return null;

    const parent = Array.from({ length: n }, () =>
        Array.from({ length: n }, () =>
            Array.from({ length: n }, () => new Array(n).fill(null))
        )
    );
    const visited = Array.from({ length: n }, () =>
        Array.from({ length: n }, () =>
            Array.from({ length: n }, () => new Array(n).fill(false))
        )
    );
    const queue = [{ x: 0, y: 0, z: 0, w: n - 1 }];
    visited[n - 1][0][0][0] = true;

    const dirs = [
        [1, 0, 0, 0], [-1, 0, 0, 0],
        [0, 1, 0, 0], [0, -1, 0, 0],
        [0, 0, 1, 0], [0, 0, -1, 0],
        [0, 0, 0, 1], [0, 0, 0, -1],
    ];

    while (queue.length) {
        const cur = queue.shift();
        if (cur.x === n - 1 && cur.y === n - 1 && cur.z === n - 1 && cur.w === 0) {
            const path = [];
            let node = cur;
            while (node) {
                path.push([node.x, node.y, node.z, node.w]);
                node = parent[node.w][node.z][node.y][node.x];
            }
            return path;
        }

        for (const [dx, dy, dz, dw] of dirs) {
            const nx = cur.x + dx;
            const ny = cur.y + dy;
            const nz = cur.z + dz;
            const nw = cur.w + dw;
            if (nx < 0 || ny < 0 || nz < 0 || nw < 0 || nx >= n || ny >= n || nz >= n || nw >= n) continue;
            if (visited[nw][nz][ny][nx] || grid[nw][nz][ny][nx] === 1) continue;
            visited[nw][nz][ny][nx] = true;
            parent[nw][nz][ny][nx] = { x: cur.x, y: cur.y, z: cur.z, w: cur.w };
            queue.push({ x: nx, y: ny, z: nz, w: nw });
        }
    }

    return null;
}

function countWalls4dRun(grid) {
    let walls = 0;
    for (const wLayer of grid) {
        for (const zLayer of wLayer) {
            for (const row of zLayer) {
                for (const cell of row) {
                    if (cell === 1) walls++;
                }
            }
        }
    }
    return walls;
}

function getCenterSliceOffset4dRun(n) {
    return n / RUN4D_SQ2;
}

function getSliceBounds4dRun(n) {
    const max = n * RUN4D_SQ2;
    return { min: 0.0001, max: max - 0.0001 };
}

function getCellSliceSegment4dRun(x, y, z, w, sliceOffset) {
    const c = sliceOffset * RUN4D_SQ2;
    const xMin = Math.max(x, c - (w + 1));
    const xMax = Math.min(x + 1, c - w);
    if (xMin >= xMax) return null;

    return {
        x0: ((2 * xMin) - c) / RUN4D_SQ2,
        x1: ((2 * xMax) - c) / RUN4D_SQ2,
        y0: y * RUN4D_SQ2,
        y1: (y + 1) * RUN4D_SQ2,
        z0: z * RUN4D_SQ2,
        z1: (z + 1) * RUN4D_SQ2,
    };
}

function segToWorldBox4dRun(seg, n) {
    return {
        x0: seg.y0 / RUN4D_SQ2,
        x1: seg.y1 / RUN4D_SQ2,
        y0: seg.z0 / RUN4D_SQ2,
        y1: seg.z1 / RUN4D_SQ2,
        z0: seg.x0 / RUN4D_SQ2 + (n - 1) / 2,
        z1: seg.x1 / RUN4D_SQ2 + (n - 1) / 2,
    };
}

function buildCrossSection4dRun(grid, sliceOffset, bfsPath) {
    const n = grid.length;
    const passable = [];
    const pathBoxes = [];
    let startBox = null;
    let endBox = null;
    const pathSet = bfsPath ? new Set(bfsPath.map(([x, y, z, w]) => `${x},${y},${z},${w}`)) : null;

    for (let w = 0; w < n; w++) {
        for (let z = 0; z < n; z++) {
            for (let y = 0; y < n; y++) {
                for (let x = 0; x < n; x++) {
                    if (grid[w][z][y][x] === 1) continue;
                    const seg = getCellSliceSegment4dRun(x, y, z, w, sliceOffset);
                    if (!seg) continue;
                    const box = segToWorldBox4dRun(seg, n);
                    if (isStartCell4dRun(x, y, z, w, n)) {
                        startBox = box;
                    } else if (isEndCell4dRun(x, y, z, w, n)) {
                        endBox = box;
                    } else {
                        passable.push(box);
                        if (pathSet && pathSet.has(`${x},${y},${z},${w}`)) {
                            pathBoxes.push(box);
                        }
                    }
                }
            }
        }
    }

    return { passable, pathBoxes, startBox, endBox };
}
