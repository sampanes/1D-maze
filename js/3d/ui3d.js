// js/3d/ui3d.js — Phase 2: button wiring, paint override, layer navigation
// Phase 6 will add scan transitions and touch handling.

// ── Layer-aware isStart / isEnd overrides ─────────────────────────────────────
// Replaces the 2D versions in maze-core.js so drawMaze() only highlights the
// actual Start/End cells on the layer where they actually live.

// Start (j=0, k=N-1) and End (j=N-1, k=0) both live on the center diagonal d=N-1.
// Both are visible (and green/red) only when the editor is on that diagonal.
isStart = function(r, c) {
    return r === 0 && c === 0 && currentLayer === gridSize3d - 1;
};

isEnd = function(r, c) {
    return r === gridSize3d - 1 && c === gridSize3d - 1 && currentLayer === gridSize3d - 1;
};

// ── Paint override ────────────────────────────────────────────────────────────
// Replaces the 2D paintAt() so drag-to-paint writes into grid3d instead of grid.

paintAt = function(clientX, clientY) {
    if (scanActive3d) return;
    const point = screenToCanvas(clientX, clientY);
    const mx = point.x, my = point.y;

    // Perspective hit-test: project each cell centre on the active diagonal,
    // pick the one whose 2-D screen position is closest to the click.
    const proj = window._proj3d;
    if (!proj) return;
    const { project, worldPos, N } = proj;

    // Active diagonal is now ci+ck = currentLayer (not cj+ck).
    const dL   = currentLayer;
    const iMin = Math.max(0, dL - N + 1);
    const iMax = Math.min(N - 1, dL);

    let bestI = -1, bestJ = -1, bestK = -1, bestDist2 = Infinity;
    for (let i = iMin; i <= iMax; i++) {
        const k = dL - i;
        for (let j = 0; j < N; j++) {
            const p = project(...worldPos(i + 0.5, j + 0.5, k + 0.5));
            if (!p) continue;
            const dx = mx - p[0], dy = my - p[1];
            const d2 = dx * dx + dy * dy;
            if (d2 < bestDist2) { bestDist2 = d2; bestI = i; bestJ = j; bestK = k; }
        }
    }
    if (bestI < 0) return;
    if (isStart(bestJ, bestI) || isEnd(bestJ, bestI)) return;
    grid3d[bestK][bestJ][bestI] = paintMode;
    bfsPath3d = null;
    solvable3d = false;
    btnScan.disabled = true;
    btnGetLink.classList.add('hidden');
    btnGetLink.disabled = true;
    redraw3d();
};

// ── Layer navigation ──────────────────────────────────────────────────────────

// Diagonal index ranges 0 to 2*(N-1).  Display shows d+1 → "Layer 1" to "Layer 2N-1".
// ▶ goes visually UP → lower diagonal d → decrement currentLayer
// ◀ goes visually DOWN → higher diagonal d → increment currentLayer
layerPrevBtn.addEventListener('click', () => {
    if (currentLayer < 2 * gridSize3d - 2) {
        currentLayer++;
        redraw3d();
    }
});

layerNextBtn.addEventListener('click', () => {
    if (currentLayer > 0) {
        currentLayer--;
        redraw3d();
    }
});

// ── Grid size slider ──────────────────────────────────────────────────────────

gridSlider.addEventListener('input', () => {
    const n = parseInt(gridSlider.value, 10);
    gridVal.textContent = n;
    initGrid3d(n);      // resets currentLayer to 0 internally
    redraw3d();
    setStatus('Click and drag on the diamond to paint walls. Right-click or hold Shift to erase.', 'neutral');
});

// ── Wipe button ───────────────────────────────────────────────────────────────

btnWipe.addEventListener('click', (e) => {
    const N = gridSize3d;
    if (e.shiftKey) {
        // Wipe entire 3D grid
        for (let k = 0; k < N; k++) {
            for (let j = 0; j < N; j++) {
                grid3d[k][j].fill(0);
            }
        }
    } else {
        // Wipe only the cells on the active diagonal d = ci+ck = currentLayer
        const d = currentLayer;
        const iMin = Math.max(0, d - N + 1);
        const iMax = Math.min(N - 1, d);
        for (let i = iMin; i <= iMax; i++) {
            const k = d - i;
            for (let j = 0; j < N; j++) {
                grid3d[k][j][i] = 0;
            }
        }
    }
    // Always restore Start and End to passable
    grid3d[N - 1][0][0] = 0;
    grid3d[0][N - 1][N - 1] = 0;
    bfsPath3d = null;
    solvable3d = false;
    btnScan.disabled = true;
    btnGetLink.classList.add('hidden');
    btnGetLink.disabled = true;
    redraw3d();
    setStatus('Click and drag on the diamond to paint walls. Right-click or hold Shift to erase.', 'neutral');
});

// ── Validate button ───────────────────────────────────────────────────────────

btnValidate.addEventListener('click', () => {
    validatePath3d();
});

// ── Get Link button ───────────────────────────────────────────────────────────

btnGetLink.addEventListener('click', async () => {
    if (!solvable3d) return;

    const encoded = serializeMaze3dToHex();
    const url = new URL(window.location.href);
    url.searchParams.set('map3d', encoded);
    const fullUrl = url.toString();

    try {
        await navigator.clipboard.writeText(fullUrl);
        showToast('Link Copied!');
        setStatus('Shareable 3D maze URL copied to clipboard.', 'success');
    } catch (_) {
        showToast('Link Ready in Address Bar');
        setStatus('Clipboard copy failed, but the 3D URL was generated in the address bar.', 'info');
    }

    try {
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch (_) { }
});

// ── Back button (wired in Phase 6) ───────────────────────────────────────────
// btnBack listener added when scan transitions are implemented.

// ── Debug mode toggle (D key) ─────────────────────────────────────────────────
// Works in both build and scan phases.  In build mode, shows the scan section
// with a debug geometry preview (Step 6 / Phase 3); in scan mode, the overlay
// is drawn on top of the normal scan render each frame (Step 9 / Phase 5).

const scanSection3d = document.getElementById('scanSection');
let rotateDragActive3d = false;
let rotateDragByMiddle3d = false;
let rotateKeyHeld3d = false;
let rotateLastX3d = 0;
let rotateLastY3d = 0;

function isDefaultView3d() {
    return Math.abs(cameraAz3d - CAMERA3D_AZ_DEFAULT) < 1e-6
        && Math.abs(cameraEl3d - CAMERA3D_EL_DEFAULT) < 1e-6;
}

function updateResetViewButton3d() {
    if (!btnResetView3d) return;
    btnResetView3d.classList.toggle('hidden', isDefaultView3d());
}

function applyCameraRotation3d(dx, dy) {
    const azSpeed = 0.0085;
    const elSpeed = 0.0068;
    cameraAz3d -= dx * azSpeed;
    cameraEl3d += dy * elSpeed;

    const fullTurn = Math.PI * 2;
    while (cameraAz3d > Math.PI) cameraAz3d -= fullTurn;
    while (cameraAz3d < -Math.PI) cameraAz3d += fullTurn;
    cameraEl3d = Math.max(CAMERA3D_EL_MIN, Math.min(CAMERA3D_EL_MAX, cameraEl3d));
}

function beginRotateDrag3d(e, viaMiddleButton) {
    if (scanActive3d) return;
    rotateDragActive3d = true;
    rotateDragByMiddle3d = !!viaMiddleButton;
    rotateLastX3d = e.clientX;
    rotateLastY3d = e.clientY;
    painting = false;
    e.preventDefault();
    e.stopImmediatePropagation();
    setStatus('Rotate view: drag to orbit. Release to continue painting.', 'info');
}

function endRotateDrag3d() {
    if (!rotateDragActive3d) return;
    rotateDragActive3d = false;
    rotateDragByMiddle3d = false;
    setStatus('Click and drag on the diamond to paint walls. Right-click or hold Shift to erase. Rotate with MMB drag or hold R + drag.', 'neutral');
}

mazeCanvas.addEventListener('mousedown', (e) => {
    const middleDrag = e.button === 1;
    const rDrag = rotateKeyHeld3d && e.button === 0;
    if (!middleDrag && !rDrag) return;
    beginRotateDrag3d(e, middleDrag);
}, true);

mazeCanvas.addEventListener('mousemove', (e) => {
    if (!rotateDragActive3d || scanActive3d) return;
    const dx = e.clientX - rotateLastX3d;
    const dy = e.clientY - rotateLastY3d;
    rotateLastX3d = e.clientX;
    rotateLastY3d = e.clientY;
    applyCameraRotation3d(dx, dy);
    updateResetViewButton3d();
    redraw3d();
    e.preventDefault();
    e.stopImmediatePropagation();
}, true);

window.addEventListener('mouseup', (e) => {
    if (!rotateDragActive3d) return;
    if (rotateDragByMiddle3d && e.button !== 1) return;
    endRotateDrag3d();
});

mazeCanvas.addEventListener('mouseleave', () => {
    if (!rotateDragActive3d) return;
    if (!rotateDragByMiddle3d && rotateKeyHeld3d) return;
    endRotateDrag3d();
});

mazeCanvas.addEventListener('contextmenu', (e) => {
    if (!rotateDragByMiddle3d) return;
    e.preventDefault();
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') rotateKeyHeld3d = true;
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyR') {
        rotateKeyHeld3d = false;
        if (rotateDragActive3d && !rotateDragByMiddle3d) endRotateDrag3d();
    }
});

if (btnResetView3d) {
    btnResetView3d.addEventListener('click', () => {
        cameraAz3d = CAMERA3D_AZ_DEFAULT;
        cameraEl3d = CAMERA3D_EL_DEFAULT;
        updateResetViewButton3d();
        redraw3d();
        setStatus('View reset to the default camera angle.', 'info');
    });
}

updateResetViewButton3d();


function pickEditorLayerForSlice() {
    const N = gridSize3d;
    const middle = N - 1;
    const maxLayer = 2 * N - 2;
    const diagonal = sliceOffset * SQ2 - 1;

    const lo = Math.max(0, Math.floor(diagonal));
    const hi = Math.min(maxLayer, Math.ceil(diagonal));

    if (lo === hi) return lo;

    const dLo = Math.abs(diagonal - lo);
    const dHi = Math.abs(hi - diagonal);
    if (Math.abs(dLo - dHi) <= 1e-9) {
        return Math.abs(lo - middle) <= Math.abs(hi - middle) ? lo : hi;
    }
    return dLo < dHi ? lo : hi;
}

function syncEditorLayerToPeekSlice() {
    currentLayer = pickEditorLayerForSlice();
    layerDisplay.textContent = String(2 * gridSize3d - 1 - currentLayer);
}

document.addEventListener('keydown', (e) => {
    if (e.key !== 'd' && e.key !== 'D') return;
    debugMode3d = !debugMode3d;
    if (scanActive3d) return;  // scan loop redraws itself when active
    // Build-mode preview: show/hide the scan section with the geometry overlay.
    if (debugMode3d) {
        scanSection3d.style.display = 'block';
        renderDebugPreview3d();
    } else {
        scanSection3d.style.display = '';
    }
});

function startScan3d(opts = {}) {
    const { showMapFirst = false } = opts;
    if (!solvable3d) return;
    scanActive3d = true;
    peeking3d = false;
    sliceOffset = getCenterSliceOffset();
    const startRect = getCellSliceRect(0, 0, gridSize3d - 1, sliceOffset);
    player3d.x = (startRect.x0 + startRect.x1) * 0.5;
    player3d.y = (startRect.y0 + startRect.y1) * 0.5;

    scanSection3d.style.display = 'block';
    peekHint.style.display = 'block';
    mazeSection.classList.add('collapsed');
    mazeSection.classList.remove('peek');

    btnScan.textContent = 'Scanning…';
    setStatus('Scan started. Use arrow keys to move, W/S to scan up/down.', 'info');
}

function stopScan3d(message = 'Scan stopped.') {
    scanActive3d = false;
    peeking3d = false;
    mazeSection.classList.remove('peek');
    mazeSection.classList.remove('collapsed');
    peekHint.style.display = 'none';
    btnScan.textContent = 'Start Scan';
    setStatus(message, 'neutral');
    redraw3d();
}

btnScan.addEventListener('click', () => {
    if (!scanActive3d) startScan3d();
});

btnBack.addEventListener('click', () => {
    if (scanActive3d) stopScan3d('Returned to build mode.');
});

document.addEventListener('keydown', (e) => {
    keysDown3d[e.code] = true;
    if (!scanActive3d) return;

    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S'].includes(e.key)) {
        e.preventDefault();
    }
    if (e.code === 'KeyP' && !peeking3d) {
        peeking3d = true;
        syncEditorLayerToPeekSlice();
        mazeSection.classList.add('peek');
        mazeSection.classList.remove('collapsed');
        drawMaze3d(getBfsPathSetForDiagonal(currentLayer));
    }
});

document.addEventListener('keyup', (e) => {
    keysDown3d[e.code] = false;
    if (!scanActive3d) return;
    if (e.code === 'KeyP' && peeking3d) {
        peeking3d = false;
        mazeSection.classList.remove('peek');
        mazeSection.classList.add('collapsed');
    }
});
