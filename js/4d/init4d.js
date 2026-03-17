/**
 * js/4d/init4d.js
 *
 * Entry point, UI wiring, and game loop for the 4D editor/scanner.
 *
 * Phase 0: hyperLayer diagonal convention, toWorld fix, anchor coords.
 * Phase 1: BFS gate, auto-validate on paint, Validate button, Wipe button,
 *          path highlighting (delegated to render4d.js + 4d-core.js).
 * Phase 2: Continuous player physics, buildCrossSection4d, swept movement.
 * Phase 3: Phase transitions, win detection.
 * Phase 4: Audio wiring.
 */

// Module-level hook so 4d-core.js can call setStatus without DOM coupling.
let statusBar4d;
function setStatus4d(message, cls = 'neutral') {
    if (statusBar4d) {
        statusBar4d.className = `status-bar ${cls}`;
        statusBar4d.textContent = message;
    }
}

document.addEventListener('DOMContentLoaded', () => {

    // ── DOM refs ──────────────────────────────────────────────────────────────

    const gridSlider    = document.getElementById('gridSlider');
    const gridVal       = document.getElementById('gridVal');
    const zLayerPrevBtn = document.getElementById('zLayerPrevBtn');
    const zLayerNextBtn = document.getElementById('zLayerNextBtn');
    const zLayerDisplay = document.getElementById('zLayerDisplay');
    const btnReleaseZ   = document.getElementById('btnReleaseZ');
    const layerPrevBtn  = document.getElementById('layerPrevBtn');
    const layerNextBtn  = document.getElementById('layerNextBtn');
    const layerDisplay  = document.getElementById('layerDisplay');
    const btnScan       = document.getElementById('btnScan');
    const btnValidate  = document.getElementById('btnValidate');
    const btnWipe      = document.getElementById('btnWipe');
    const btnGetLink   = document.getElementById('btnGetLink');
    const btnResetView    = document.getElementById('btnResetView');
    const statusBar       = document.getElementById('statusBar');
    const scanReadout     = document.getElementById('scanReadout4d');
    const hyperSliceFill  = document.getElementById('hyperSliceFill');
    const hyperScanHint   = document.getElementById('hyperScanHint');
    const btnDismissHint  = document.getElementById('btnDismissHint');

    // Wire the module-level setStatus4d to the actual DOM element.
    statusBar4d = statusBar;

    // ── Rotate-drag state ─────────────────────────────────────────────────────

    let isRotating      = false;
    let lastMouseX      = 0;
    let lastMouseY      = 0;
    let rotateKeyHeld   = false;
    let lastFrame4d     = performance.now();
    let hintShown       = false;
    let needsValidation = false; // scan gate: must click Validate after each edit

    // ── Helpers ───────────────────────────────────────────────────────────────

    function setStatus(message, cls = 'neutral') {
        setStatus4d(message, cls);
    }

    // Edit mode:  hyperLayer + 1  (centre diagonal N-1 → "Layer N").
    // Scan mode:  continuous hyperSliceOffset to two decimal places.
    function updateLayerDisplays() {
        layerDisplay.textContent = scanActive4d
            ? hyperSliceOffset.toFixed(2)
            : String(hyperLayer + 1);
        if (zLayerDisplay) {
            zLayerDisplay.textContent = editLayerZ4d < 0 ? '—' : String(editLayerZ4d + 1);
        }
        if (hyperSliceFill) {
            const bounds = getSliceBounds4d();
            const pct = scanActive4d
                ? ((hyperSliceOffset - bounds.min) / (bounds.max - bounds.min)) * 100
                : (hyperLayer / Math.max(1, maxHyperLayerIndex4d())) * 100;
            hyperSliceFill.style.width = pct.toFixed(1) + '%';
        }
    }

    function updateUiForMode() {
        const edit = !scanActive4d;
        zLayerPrevBtn.disabled = !edit;
        zLayerNextBtn.disabled = !edit;
        btnReleaseZ.disabled   = !edit;
        layerPrevBtn.disabled  = !edit;
        layerNextBtn.disabled  = !edit;
        gridSlider.disabled    = !edit;
        btnValidate.disabled   = !edit;
        btnWipe.disabled       = !edit;
        if (btnGetLink) {
            btnGetLink.disabled = !edit || !solvable4d;
            btnGetLink.classList.toggle('hidden', !solvable4d);
        }
        btnScan.textContent = scanActive4d ? 'Stop Scan' : 'Start Scan';
        if (scanReadout) scanReadout.style.display = scanActive4d ? '' : 'none';
        updateLayerDisplays();
    }

    // ── BFS helpers ───────────────────────────────────────────────────────────

    // Sync the Scan button and Get Link to the current validated + solvable state.
    function syncScanButton() {
        const canScan = solvable4d && !needsValidation;
        btnScan.disabled = !canScan;
        if (btnGetLink) {
            btnGetLink.disabled  = !canScan;
            btnGetLink.classList.toggle('hidden', !canScan);
        }
    }

    // Run BFS to refresh path highlighting.  Does NOT enable the Scan button on
    // its own — caller must clear needsValidation and call syncScanButton().
    function runBfs() {
        bfs4d();
        syncScanButton();
        return solvable4d;
    }

    // ── Reset / initialise ────────────────────────────────────────────────────

    function reset4d(n) {
        initGrid4d(n);
        // Empty grid is always solvable; BFS runs here and the fresh grid is
        // considered pre-validated so scan is immediately available.
        needsValidation = false;
        runBfs();
        updateUiForMode();
        setStatus(
            `Edit: click a cube to toggle wall. Layer ◀▶ moves through hyperdiagonals (x+w). ` +
            `Centre = Layer ${n} (Start & End live here). Validate to check solvability.`,
            'neutral'
        );
        drawHyperVolume4d();
    }

    // ── Game loop ─────────────────────────────────────────────────────────────

    function tick4d(ts) {
        const dt = Math.min(0.05, (ts - lastFrame4d) / 1000);
        lastFrame4d = ts;

        if (scanActive4d) {
            updateHyperSliceFromInput4d(dt);
            const cs = buildCrossSection4d(hyperSliceOffset);
            updatePlayer4d(dt, cs);

            // Peek: sync editor layer to nearest hyperdiagonal for current slice.
            if (peeking4d) hyperLayer = pickEditorLayerForHyperSlice4d();

            updateLayerDisplays();
            drawHyperVolume4d();
            updateScanReadout4d(cs);

            if (playerHitsEnd4d(cs)) {
                if (typeof playCelebrate === 'function') playCelebrate();
                peeking4d = false;
                setScanActive4d(false);
                updateUiForMode();
                drawHyperVolume4d();
                setStatus('Scan complete — reached the End!', 'success');
            }
        }

        requestAnimationFrame(tick4d);
    }

    // ── Scan HUD ──────────────────────────────────────────────────────────────

    function updateScanReadout4d(cs) {
        if (!scanReadout) return;
        let cell = 'VOID';
        const { sx, sy, sz } = player4d;
        if (cs.startBox && pointInBox4d(sx, sy, sz, cs.startBox)) {
            cell = 'START';
        } else if (cs.endBox && pointInBox4d(sx, sy, sz, cs.endBox)) {
            cell = 'END';
        } else {
            for (const box of (cs.pathBoxes || [])) {
                if (pointInBox4d(sx, sy, sz, box)) { cell = 'BFS PATH'; break; }
            }
            if (cell === 'VOID') {
                for (const box of cs.passable) {
                    if (pointInBox4d(sx, sy, sz, box)) { cell = 'PATH'; break; }
                }
            }
        }
        scanReadout.textContent =
            `S: ${hyperSliceOffset.toFixed(2)}  ` +
            `x: ${sx.toFixed(2)}  y: ${sy.toFixed(2)}  z: ${sz.toFixed(2)}  ` +
            `[${cell}]` +
            (peeking4d ? '  · PEEKING' : '');
    }

    // ── URL map load ──────────────────────────────────────────────────────────

    function tryLoadMapFromUrl4d() {
        try {
            const params = new URLSearchParams(window.location.search);
            const mapString = params.get('map4d');
            if (!mapString) return false;
            const loaded = applySerializedMap4d(mapString.trim());
            if (!loaded) return false;
            gridSlider.value = String(gridSize4d);
            gridVal.textContent = String(gridSize4d);
            needsValidation = false; // URL-loaded maze is pre-validated
            runBfs();
            updateUiForMode();
            drawHyperVolume4d();
            if (solvable4d) {
                setScanActive4d(true);
                updateUiForMode();
                setStatus(
                    'Shared 4D maze loaded. Scan started — reach the red End. ' +
                    'Hold P to peek at the editor layer.',
                    'info'
                );
            }
            return true;
        } catch (_) {
            return false;
        }
    }

    // ── Onboarding hint (M10.4) ───────────────────────────────────────────────

    function showScanHint() {
        if (hintShown || !hyperScanHint) return;
        hintShown = true;
        hyperScanHint.style.display = '';
        setTimeout(() => { if (hyperScanHint) hyperScanHint.style.display = 'none'; }, 9000);
    }

    if (btnDismissHint) {
        btnDismissHint.addEventListener('click', () => {
            if (hyperScanHint) hyperScanHint.style.display = 'none';
        });
    }

    // ── Startup ───────────────────────────────────────────────────────────────

    initRender4d();
    reset4d(parseInt(gridSlider.value, 10));
    tryLoadMapFromUrl4d();
    requestAnimationFrame(tick4d);

    // ── Grid size slider ──────────────────────────────────────────────────────

    gridSlider.addEventListener('input', () => {
        const n = parseInt(gridSlider.value, 10);
        gridVal.textContent = String(n);
        reset4d(n);
    });

    // ── Z-layer focus navigation ──────────────────────────────────────────────
    // Focuses one z-slice (0..N-1) within the active hyperdiagonal prism.
    // editLayerZ4d = -1 means released (all z-slices visible at full opacity).

    zLayerPrevBtn.addEventListener('click', () => {
        const N = gridSize4d;
        // If released, start at z=0; otherwise decrement with wrap.
        editLayerZ4d = editLayerZ4d < 0
            ? 0
            : clamp4d(editLayerZ4d - 1, 0, N - 1);
        updateLayerDisplays();
        drawHyperVolume4d();
    });

    zLayerNextBtn.addEventListener('click', () => {
        const N = gridSize4d;
        editLayerZ4d = editLayerZ4d < 0
            ? N - 1
            : clamp4d(editLayerZ4d + 1, 0, N - 1);
        updateLayerDisplays();
        drawHyperVolume4d();
    });

    btnReleaseZ.addEventListener('click', () => {
        editLayerZ4d = -1;
        updateLayerDisplays();
        drawHyperVolume4d();
        setStatus('Z-layer released — all layers visible.', 'neutral');
    });

    // ── Layer navigation ──────────────────────────────────────────────────────
    // Controls hyperLayer (diagonal x+w), range 0..2*(N-1).

    layerPrevBtn.addEventListener('click', () => {
        hyperLayer = clamp4d(hyperLayer - 1, 0, maxHyperLayerIndex4d());
        hyperSliceOffset = hyperLayerToSlice4d(hyperLayer);
        updateLayerDisplays();
        drawHyperVolume4d();
    });

    layerNextBtn.addEventListener('click', () => {
        hyperLayer = clamp4d(hyperLayer + 1, 0, maxHyperLayerIndex4d());
        hyperSliceOffset = hyperLayerToSlice4d(hyperLayer);
        updateLayerDisplays();
        drawHyperVolume4d();
    });

    // ── Validate ──────────────────────────────────────────────────────────────

    btnValidate.addEventListener('click', () => {
        needsValidation = false; // explicit user action clears the dirty flag
        const ok = runBfs();
        if (ok) {
            setStatus(`Path found — ${bfsPath4d.length} cells. Ready to Start Scan.`, 'success');
        } else {
            setStatus('No path — connect Start (green) to End (red) through passable cells.', 'error');
        }
        drawHyperVolume4d();
    });

    // ── Wipe ─────────────────────────────────────────────────────────────────
    // Plain click: clear the active hyperdiagonal (x+w = hyperLayer).
    // Shift+click: clear the entire 4D grid.
    // Anchors are always restored to passable.

    btnWipe.addEventListener('click', (e) => {
        const N = gridSize4d;

        if (e.shiftKey) {
            for (let w = 0; w < N; w++) {
                for (let z = 0; z < N; z++) {
                    for (let y = 0; y < N; y++) {
                        grid4d[w][z][y].fill(0);
                    }
                }
            }
        } else {
            // Clear only cells on the active hyperdiagonal.
            const d4   = hyperLayer;
            const xMin = Math.max(0, d4 - (N - 1));
            const xMax = Math.min(N - 1, d4);
            for (let x = xMin; x <= xMax; x++) {
                const w = d4 - x;
                for (let z = 0; z < N; z++) {
                    for (let y = 0; y < N; y++) {
                        grid4d[w][z][y][x] = 0;
                    }
                }
            }
        }

        // Always restore anchors.
        grid4d[N - 1][0][0][0]         = 0; // Start
        grid4d[0][N - 1][N - 1][N - 1] = 0; // End
        invalidateCrossSection4d();

        needsValidation = true;
        runBfs();
        drawHyperVolume4d();
        setStatus(
            e.shiftKey
                ? 'Entire 4D grid cleared. Path is open.'
                : `Layer ${hyperLayer + 1} cleared (hyperdiagonal x+w=${hyperLayer}).`,
            'neutral'
        );
    });

    // ── Reset camera ──────────────────────────────────────────────────────────

    btnResetView.addEventListener('click', () => {
        cameraAz4d = 45 * Math.PI / 180;
        cameraEl4d = 30 * Math.PI / 180;
        drawHyperVolume4d();
    });

    // ── Scan toggle ───────────────────────────────────────────────────────────

    btnScan.addEventListener('click', () => {
        if (!scanActive4d && !solvable4d) return; // gate (belt-and-suspenders)
        setScanActive4d(!scanActive4d);
        updateUiForMode();
        drawHyperVolume4d();
        if (scanActive4d) {
            setStatus(
                'Scan mode: Arrow keys — walk the floor · W/S — climb/descend · E/D — shift hyper-slice. ' +
                'Path in gold. Reach the red End.',
                'info'
            );
            showScanHint();
        } else {
            setStatus('Returned to edit mode.', 'neutral');
        }
    });

    // ── Get Link ──────────────────────────────────────────────────────────────

    if (btnGetLink) {
        btnGetLink.addEventListener('click', async () => {
            if (!solvable4d) return;
            const encoded = serializeMaze4dToHex();
            const url = new URL(window.location.href);
            url.searchParams.set('map4d', encoded);
            const fullUrl = url.toString();
            try {
                await navigator.clipboard.writeText(fullUrl);
                setStatus('Shareable 4D maze URL copied to clipboard.', 'success');
            } catch (_) {
                setStatus('Link ready in address bar.', 'info');
            }
            try { window.history.replaceState({}, '', url.pathname + url.search); } catch (_) {}
        });
    }

    // ── Click-to-paint ────────────────────────────────────────────────────────
    // Left-click paints (sets wall).  Right-click erases (clears wall).
    // When a Z-layer is focused, clicks on other Z-layers are silently ignored.

    function handlePaint(clientX, clientY, value) {
        if (isRotating) return;

        if (scanActive4d) {
            setStatus('Painting is disabled in scan mode. Stop scan to edit.', 'info');
            return;
        }

        const picked = pickCellFromScreen4d(clientX, clientY);
        if (!picked) {
            setStatus('No cube selected — click closer to a cube centre.', 'info');
            return;
        }

        if (isAnchorCell4d(picked.x, picked.y, picked.z, picked.w)) {
            setStatus('Start/End anchors cannot be painted.', 'info');
            return;
        }

        setCell4d(picked.x, picked.y, picked.z, picked.w, value);

        // Keep path highlight up to date but require explicit Validate to re-enable scan.
        needsValidation = true;
        runBfs();
        drawHyperVolume4d();

        const cell   = `(x=${picked.x}, y=${picked.y}, z=${picked.z}, w=${picked.w})`;
        const action = value ? 'Painted wall' : 'Erased wall';
        if (solvable4d) {
            setStatus(`${action} ${cell} — path exists. Click Validate to enable scan.`, 'info');
        } else {
            setStatus(`${action} ${cell} — no path to End. Validate to check.`, 'error');
        }
    }

    hyperCanvas.addEventListener('click', (e) => handlePaint(e.clientX, e.clientY, 1));

    hyperCanvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handlePaint(e.clientX, e.clientY, 0);
    });

    // ── Camera orbit (middle-click or R + left-drag) ──────────────────────────

    hyperCanvas.addEventListener('mousedown', (e) => {
        const middleDrag = e.button === 1;
        const rDrag      = rotateKeyHeld && e.button === 0;
        if (!middleDrag && !rDrag) return;
        isRotating = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isRotating) return;
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        cameraAz4d -= dx * 0.01;
        cameraEl4d = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraEl4d + dy * 0.01));
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        drawHyperVolume4d();
    });

    window.addEventListener('mouseup', () => { isRotating = false; });

    // ── Keyboard ──────────────────────────────────────────────────────────────

    window.addEventListener('keydown', (e) => {
        keysDown4d[e.code] = true;

        if (e.code === 'KeyR') { rotateKeyHeld = true; return; }

        if (e.code === 'KeyP' && scanActive4d && !peeking4d) {
            peeking4d = true;
            e.preventDefault();
            return;
        }

        // Prevent page scroll for movement keys in scan mode.
        if (scanActive4d && (
            e.code === 'ArrowLeft' || e.code === 'ArrowRight' ||
            e.code === 'ArrowUp'   || e.code === 'ArrowDown'  ||
            e.code === 'KeyW'      || e.code === 'KeyS'       ||
            e.code === 'KeyE'      || e.code === 'KeyD'
        )) {
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => {
        delete keysDown4d[e.code];
        if (e.code === 'KeyR') rotateKeyHeld = false;
        if (e.code === 'KeyP') peeking4d = false;
    });

    // ── Touch support (M9.1) ──────────────────────────────────────────────────
    // Single tap  → paint wall (left-click equivalent).
    // Long press  → erase wall (right-click equivalent, 500 ms).
    // Single drag → camera orbit (same as R + left-drag on desktop).

    let touchStartX = 0, touchStartY = 0, touchMoved = false, touchTimer = null;

    hyperCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        touchStartX  = e.touches[0].clientX;
        touchStartY  = e.touches[0].clientY;
        touchMoved   = false;
        // Long-press = erase
        touchTimer = setTimeout(() => {
            touchTimer = null;
            handlePaint(touchStartX, touchStartY, 0);
        }, 500);
    }, { passive: false });

    hyperCanvas.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        const cx = e.touches[0].clientX;
        const cy = e.touches[0].clientY;
        const dist = Math.hypot(cx - touchStartX, cy - touchStartY);
        if (dist > 8) {
            if (!touchMoved) {
                // Transition to camera orbit
                touchMoved  = true;
                isRotating  = true;
                lastMouseX  = touchStartX;
                lastMouseY  = touchStartY;
                if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
            }
            cameraAz4d -= (cx - lastMouseX) * 0.01;
            cameraEl4d  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2,
                            cameraEl4d + (cy - lastMouseY) * 0.01));
            lastMouseX  = cx;
            lastMouseY  = cy;
            drawHyperVolume4d();
        }
    }, { passive: false });

    hyperCanvas.addEventListener('touchend', () => {
        isRotating = false;
        if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
            if (!touchMoved) {
                // Short tap = paint
                handlePaint(touchStartX, touchStartY, 1);
            }
        }
    }, { passive: false });
});
