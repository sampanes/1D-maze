// Mobile UI
btnToggleDetails.addEventListener('click', () => {
    const isHidden = mobileCollapseGroup.classList.contains('hidden');
    if (isHidden) {
        mobileCollapseGroup.classList.remove('hidden');
        btnToggleDetails.textContent = 'Details ▴';
    } else {
        mobileCollapseGroup.classList.add('hidden');
        btnToggleDetails.textContent = 'Details ▾';
    }
});

function applyMobileOptimizations() {
    const isMobile = window.innerWidth < 768;
    const peekHint = document.getElementById('peekHint');
    const headerP = document.querySelector('.header p');

    if (isMobile) {
        peekHint.style.display = 'none';
        mobileCollapseGroup.classList.add('hidden');
        headerP.textContent = "Tap & Slide the 1D Scanner to move.";
    } else {
        if (scanActive) peekHint.style.display = 'block';
        mobileCollapseGroup.classList.remove('hidden');
        headerP.textContent = "Paint a diamond maze, validate it, then navigate with the 1D scanner.";
    }
}

window.addEventListener('resize', applyMobileOptimizations);
applyMobileOptimizations();

// UI helpers
function setStatus(message, type = 'neutral') {
    statusBar.textContent = message;
    statusBar.className = 'status-bar ' + type;
}

function updateShareButton() {
    const ready = !!solvable;
    btnGetLink.disabled = !ready;
    btnGetLink.classList.toggle('hidden', !ready);
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 1800);
}

// Serialization
function serializeMazeToHex() {
    const sizeHex = gridSize.toString(16).toUpperCase().padStart(2, '0');
    let bits = '';
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            bits += grid[r][c] ? '1' : '0';
        }
    }
    while (bits.length % 4 !== 0) bits += '0';

    let hex = '';
    for (let i = 0; i < bits.length; i += 4) {
        hex += parseInt(bits.slice(i, i + 4), 2).toString(16).toUpperCase();
    }
    hex = hex.replace(/0+$/, '');
    return sizeHex + hex;
}

function applySerializedMap(mapString) {
    if (!mapString || mapString.length < 2) return false;
    const sizeHex = mapString.slice(0, 2);
    const parsedSize = parseInt(sizeHex, 16);
    if (!Number.isFinite(parsedSize) || parsedSize < 2 || parsedSize > 64) return false;

    gridSize = parsedSize;
    gridSlider.value = String(parsedSize);
    gridVal.textContent = String(parsedSize);
    grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));

    const payload = (mapString.slice(2).toUpperCase().match(/[0-9A-F]/g) || []).join('');
    const totalCells = gridSize * gridSize;
    let cellIndex = 0;

    for (let i = 0; i < payload.length && cellIndex < totalCells; i++) {
        const nibble = parseInt(payload[i], 16);
        for (let bit = 3; bit >= 0 && cellIndex < totalCells; bit--) {
            const value = (nibble >> bit) & 1;
            const row = Math.floor(cellIndex / gridSize);
            const col = cellIndex % gridSize;
            if (!isStart(row, col) && !isEnd(row, col)) {
                grid[row][col] = value;
            }
            cellIndex++;
        }
    }

    bfsPath = bfs();
    solvable = !!bfsPath;
    btnScan.disabled = !solvable;
    updateShareButton();
    resetScannerState();
    computeSizes();
    drawMaze(bfsPath);
    drawScanView(performance.now());

    if (solvable) {
        setStatus('Loaded maze from URL and validated successfully. Start Scan is enabled.', 'success');
    } else {
        setStatus('Loaded maze from URL, but no valid Start→End path exists.', 'error');
    }
    return true;
}

function tryLoadMapFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const mapString = params.get('map');
        if (!mapString) return false;
        return applySerializedMap(mapString.trim());
    } catch (_) {
        return false;
    }
}

// Grid management
function initGrid() {
    grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
    bfsPath = null;
    solvable = false;
    btnScan.disabled = true;
    updateShareButton();
}

function computeSizes() {
    const maxDim = Math.min(window.innerWidth * 0.66, 560);
    canvasSize = Math.max(240, Math.floor(maxDim / Math.SQRT2));
    cellSize = canvasSize / gridSize;

    mazeCanvas.width = canvasSize;
    mazeCanvas.height = canvasSize;
    diamondContainer.style.width = canvasSize + 'px';
    diamondContainer.style.height = canvasSize + 'px';
    diamondContainer.style.margin = '24px';

    startLabel.style.left = (-64) + 'px';
    startLabel.style.top = (cellSize * 0.42) + 'px';
    endLabel.style.right = (-56) + 'px';
    endLabel.style.bottom = (cellSize * 0.42) + 'px';
}

function setup() {
    gridSize = parseInt(gridSlider.value, 10);
    gridVal.textContent = gridSize;
    initGrid();
    resetScannerState();
    computeSizes();
    drawMaze();
    drawScanView(performance.now());
    setStatus('Click and drag on the diamond to paint walls. Right-click or hold Shift to erase.', 'neutral');
}

// Grid helpers
function isStart(r, c) {
    return r === 0 && c === 0;
}

function isEnd(r, c) {
    return r === gridSize - 1 && c === gridSize - 1;
}

// Canvas drawing helper
function roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// Coordinate math
function uvToXY(u, v) {
    return {
        x: (u + v) / 2,
        y: (v - u) / 2
    };
}

function getVBounds(u) {
    const absU = Math.abs(u);
    return {
        min: absU,
        max: 2 * gridSize - absU
    };
}

function clampU(u) {
    const limit = gridSize - EPS;
    return Math.max(-limit, Math.min(limit, u));
}

function clampV(u, v) {
    const bounds = getVBounds(u);
    return Math.max(bounds.min + EPS, Math.min(bounds.max - EPS, v));
}

function pointInsideDiamond(u, v) {
    const { x, y } = uvToXY(u, v);
    return x >= 0 && x < gridSize && y >= 0 && y < gridSize;
}

function getCellInfoAtUV(u, v) {
    const { x, y } = uvToXY(u, v);
    if (!(x >= 0 && x < gridSize && y >= 0 && y < gridSize)) return null;

    const col = Math.max(0, Math.min(gridSize - 1, Math.floor(x)));
    const row = Math.max(0, Math.min(gridSize - 1, Math.floor(y)));
    const key = row + ',' + col;

    return {
        row,
        col,
        key,
        x,
        y,
        wall: grid[row][col] === 1,
        start: isStart(row, col),
        end: isEnd(row, col),
        solution: !!(bfsPath && bfsPath.has(key))
    };
}

function getCellLabel(info) {
    if (!info) return 'VOID';
    if (info.start) return 'START';
    if (info.end) return 'END';
    if (info.wall) return 'WALL';
    if (info.solution) return 'BFS PATH';
    return 'PATH';
}

function isWallAtUV(u, v) {
    const info = getCellInfoAtUV(u, v);
    return !info || info.wall;
}

function getBoundaryGap(u, v) {
    const bounds = getVBounds(u);
    return Math.min(v - bounds.min, bounds.max - v);
}

function isNearBoundary(u, v, margin = EPS * 1.35) {
    return getBoundaryGap(u, v) <= margin;
}

function isSegmentClear(u0, v0, u1, v1, steps = 8) {
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = u0 + (u1 - u0) * t;
        const v = v0 + (v1 - v0) * t;
        if (!pointInsideDiamond(u, v) || isWallAtUV(u, v)) return false;
    }
    return true;
}

function getScannerEndpoints(u) {
    const N = gridSize;
    if (u >= 0) {
        return { x0: u, y0: 0, x1: N, y1: N - u };
    }
    return { x0: 0, y0: -u, x1: N + u, y1: N };
}

// 2D maze renderer
function drawMaze(pathSet = null, drawScanner = false) {
    mazeCtx.clearRect(0, 0, canvasSize, canvasSize);

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const x = c * cellSize;
            const y = r * cellSize;

            if (isStart(r, c)) {
                mazeCtx.fillStyle = '#5dffb0';
            } else if (isEnd(r, c)) {
                mazeCtx.fillStyle = '#ff6a6a';
            } else if (pathSet && pathSet.has(r + ',' + c)) {
                mazeCtx.fillStyle = '#ffd84f';
            } else if (grid[r][c] === 1) {
                mazeCtx.fillStyle = '#0c0f18';
            } else {
                mazeCtx.fillStyle = '#f2f5ff';
            }

            mazeCtx.fillRect(x, y, cellSize + 0.5, cellSize + 0.5);
            mazeCtx.strokeStyle = 'rgba(97, 118, 191, 0.45)';
            mazeCtx.lineWidth = 0.75;
            mazeCtx.strokeRect(x, y, cellSize, cellSize);
        }
    }

    if (drawScanner && scanActive) {
        const line = getScannerEndpoints(player.u);
        mazeCtx.save();
        mazeCtx.strokeStyle = 'rgba(0, 217, 245, 0.26)';
        mazeCtx.lineWidth = Math.max(8, cellSize * 1.05);
        mazeCtx.lineCap = 'round';
        mazeCtx.beginPath();
        mazeCtx.moveTo(line.x0 * cellSize, line.y0 * cellSize);
        mazeCtx.lineTo(line.x1 * cellSize, line.y1 * cellSize);
        mazeCtx.stroke();

        mazeCtx.strokeStyle = '#00d9f5';
        mazeCtx.shadowColor = '#00d9f5';
        mazeCtx.shadowBlur = 12;
        mazeCtx.lineWidth = Math.max(3, cellSize * 0.22);
        mazeCtx.beginPath();
        mazeCtx.moveTo(line.x0 * cellSize, line.y0 * cellSize);
        mazeCtx.lineTo(line.x1 * cellSize, line.y1 * cellSize);
        mazeCtx.stroke();
        mazeCtx.restore();

        const { x, y } = uvToXY(player.u, player.v);
        const bounds = getVBounds(player.u);
        const leftGap = player.v - bounds.min;
        const rightGap = bounds.max - player.v;
        const edgeBias = Math.max(-1, Math.min(1, (leftGap - rightGap) / Math.max(0.001, leftGap + rightGap)));
        const inwardNormalX = Math.SQRT1_2 * edgeBias;
        const inwardNormalY = -Math.SQRT1_2 * edgeBias;
        const offsetMag = Math.min(cellSize * 0.16, Math.max(0, cellSize * 0.16 * Math.abs(edgeBias)));
        const cx = x * cellSize + inwardNormalX * offsetMag;
        const cy = y * cellSize + inwardNormalY * offsetMag;
        const radius = Math.max(4, cellSize * 0.28);

        mazeCtx.save();
        mazeCtx.strokeStyle = 'rgba(125, 255, 46, 0.4)';
        mazeCtx.lineWidth = 1.5;
        const crossSize = cellSize * 0.44;
        mazeCtx.beginPath();
        mazeCtx.moveTo(cx - crossSize, cy);
        mazeCtx.lineTo(cx + crossSize, cy);
        mazeCtx.moveTo(cx, cy - crossSize);
        mazeCtx.lineTo(cx, cy + crossSize);
        mazeCtx.stroke();

        mazeCtx.fillStyle = '#7dff2e';
        mazeCtx.shadowColor = '#7dff2e';
        mazeCtx.shadowBlur = 16;
        mazeCtx.beginPath();
        mazeCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        mazeCtx.fill();
        mazeCtx.fillStyle = '#0c1205';
        mazeCtx.beginPath();
        mazeCtx.arc(cx, cy, Math.max(2, radius * 0.38), 0, Math.PI * 2);
        mazeCtx.fill();
        mazeCtx.restore();
    }
}

// Build-mode painting
function screenToCanvas(mouseX, mouseY) {
    const rect = mazeCanvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = mouseX - cx;
    const dy = mouseY - cy;

    const angle = Math.PI / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    const expectedWidth = canvasSize * Math.SQRT2;
    const scale = rect.width / expectedWidth;

    return {
        x: localX / scale + canvasSize / 2,
        y: localY / scale + canvasSize / 2
    };
}

function canvasToGrid(x, y) {
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (row < 0 || col < 0 || row >= gridSize || col >= gridSize) return null;
    return { row, col };
}

function paintAt(clientX, clientY) {
    const point = screenToCanvas(clientX, clientY);
    const cell = canvasToGrid(point.x, point.y);
    if (!cell) return;

    const { row, col } = cell;
    if (isStart(row, col) || isEnd(row, col)) return;

    grid[row][col] = paintMode;
    bfsPath = null;
    solvable = false;
    btnScan.disabled = true;
    updateShareButton();
    drawMaze();
    if (scanActive) drawScanView(performance.now());
}

mazeCanvas.addEventListener('mousedown', (e) => {
    if (scanActive) return;
    e.preventDefault();
    painting = true;
    paintMode = (e.button === 2 || e.shiftKey) ? 0 : 1;
    paintAt(e.clientX, e.clientY);
});

mazeCanvas.addEventListener('mousemove', (e) => {
    if (!painting || scanActive) return;
    paintAt(e.clientX, e.clientY);
});

['mouseup', 'mouseleave'].forEach(type => {
    mazeCanvas.addEventListener(type, () => painting = false);
});

mazeCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

mazeCanvas.addEventListener('touchstart', (e) => {
    if (scanActive) return;
    e.preventDefault();
    painting = true;
    paintMode = 1;
    const touch = e.touches[0];
    paintAt(touch.clientX, touch.clientY);
}, { passive: false });

mazeCanvas.addEventListener('touchmove', (e) => {
    if (!painting || scanActive) return;
    e.preventDefault();
    const touch = e.touches[0];
    paintAt(touch.clientX, touch.clientY);
}, { passive: false });

mazeCanvas.addEventListener('touchend', () => painting = false);

// BFS pathfinder
function bfs() {
    if (grid[0][0] === 1 || grid[gridSize - 1][gridSize - 1] === 1) return null;

    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const visited = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
    const parent = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
    const queue = [{ r: 0, c: 0 }];
    visited[0][0] = true;

    while (queue.length) {
        const current = queue.shift();
        if (current.r === gridSize - 1 && current.c === gridSize - 1) {
            const path = new Set();
            let cur = current;
            while (cur) {
                path.add(cur.r + ',' + cur.c);
                cur = parent[cur.r][cur.c];
            }
            return path;
        }

        for (const [dr, dc] of dirs) {
            const nr = current.r + dr;
            const nc = current.c + dc;
            if (nr < 0 || nc < 0 || nr >= gridSize || nc >= gridSize) continue;
            if (visited[nr][nc] || grid[nr][nc] === 1) continue;
            visited[nr][nc] = true;
            parent[nr][nc] = current;
            queue.push({ r: nr, c: nc });
        }
    }

    return null;
}
