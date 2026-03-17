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

    const gridSlider   = document.getElementById('gridSlider');
    const gridVal      = document.getElementById('gridVal');
    const layerPrevBtn = document.getElementById('layerPrevBtn');
    const layerNextBtn = document.getElementById('layerNextBtn');
    const layerDisplay = document.getElementById('layerDisplay');
    const btnScan      = document.getElementById('btnScan');
    const btnValidate  = document.getElementById('btnValidate');
    const btnWipe      = document.getElementById('btnWipe');
    const btnResetView = document.getElementById('btnResetView');
    const statusBar    = document.getElementById('statusBar');

    // Wire the module-level setStatus4d to the actual DOM element.
    statusBar4d = statusBar;

    // ── Rotate-drag state ─────────────────────────────────────────────────────

    let isRotating    = false;
    let lastMouseX    = 0;
    let lastMouseY    = 0;
    let rotateKeyHeld = false;
    let lastFrame4d   = performance.now();

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
    }

    function updateUiForMode() {
        const edit = !scanActive4d;
        layerPrevBtn.disabled = !edit;
        layerNextBtn.disabled = !edit;
        gridSlider.disabled   = !edit;
        btnValidate.disabled  = !edit;
        btnWipe.disabled      = !edit;
        btnScan.textContent   = scanActive4d ? 'Stop Scan' : 'Start Scan';
        updateLayerDisplays();
    }

    // ── BFS helpers ───────────────────────────────────────────────────────────

    // Run BFS, update btnScan, return whether solvable.
    // Called after every grid edit so the Scan button is always in sync.
    function runBfs() {
        bfs4d();
        btnScan.disabled = !solvable4d;
        return solvable4d;
    }

    // ── Reset / initialise ────────────────────────────────────────────────────

    function reset4d(n) {
        initGrid4d(n);
        // Empty grid is always solvable; run BFS to populate bfsPath4d.
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
            updateLayerDisplays();
            drawHyperVolume4d();

            if (playerHitsEnd4d(cs)) {
                if (typeof playCelebrate === 'function') playCelebrate();
                setScanActive4d(false);
                updateUiForMode();
                drawHyperVolume4d();
                setStatus('Scan complete — reached the End!', 'success');
            }
        }

        requestAnimationFrame(tick4d);
    }

    // ── Startup ───────────────────────────────────────────────────────────────

    initRender4d();
    reset4d(parseInt(gridSlider.value, 10));
    requestAnimationFrame(tick4d);

    // ── Grid size slider ──────────────────────────────────────────────────────

    gridSlider.addEventListener('input', () => {
        const n = parseInt(gridSlider.value, 10);
        gridVal.textContent = String(n);
        reset4d(n);
    });

    // ── Layer navigation ──────────────────────────────────────────────────────
    // Controls hyperLayer (diagonal x+w), range 0..2*(N-1).

    layerPrevBtn.addEventListener('click', () => {
        hyperLayer = clamp4d(hyperLayer - 1, 0, maxHyperLayerIndex4d());
        hyperSliceOffset = hyperLayerToSlice4d(hyperLayer);
        stabilizePlayer4d();
        updateLayerDisplays();
        drawHyperVolume4d();
    });

    layerNextBtn.addEventListener('click', () => {
        hyperLayer = clamp4d(hyperLayer + 1, 0, maxHyperLayerIndex4d());
        hyperSliceOffset = hyperLayerToSlice4d(hyperLayer);
        stabilizePlayer4d();
        updateLayerDisplays();
        drawHyperVolume4d();
    });

    // ── Validate ──────────────────────────────────────────────────────────────

    btnValidate.addEventListener('click', () => {
        const path = bfs4d();
        btnScan.disabled = !solvable4d;
        if (path) {
            setStatus(`Path found — ${path.length} cells. Ready to Start Scan.`, 'success');
        } else {
            setStatus('No path — connect Start (green) to End (red) through passable cells.', 'error');
        }
        drawHyperVolume4d(); // redraws with updated path highlight
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

        runBfs();
        stabilizePlayer4d();
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
                'Scan mode: Arrow keys X/Y · W/S: Z · E/D: hyper-slice. ' +
                `Path shown in gold. Reach the red End.`,
                'info'
            );
        } else {
            setStatus('Returned to edit mode.', 'neutral');
        }
    });

    // ── Click-to-paint ────────────────────────────────────────────────────────

    hyperCanvas.addEventListener('click', (e) => {
        if (isRotating) return;

        if (scanActive4d) {
            setStatus('Painting is disabled in scan mode. Stop scan to edit.', 'info');
            return;
        }

        const picked = pickCellFromScreen4d(e.clientX, e.clientY);
        if (!picked) {
            setStatus('No cube selected — click closer to a cube centre.', 'info');
            return;
        }

        if (isAnchorCell4d(picked.x, picked.y, picked.z, picked.w)) {
            setStatus('Start/End anchors cannot be painted.', 'info');
            return;
        }

        toggleCell4d(picked.x, picked.y, picked.z, picked.w);
        stabilizePlayer4d();

        // Auto-validate so the Scan button stays in sync with every edit.
        const nowSolvable = runBfs();
        drawHyperVolume4d();

        const cell = `(x=${picked.x}, y=${picked.y}, z=${picked.z}, w=${picked.w})`;
        if (nowSolvable) {
            setStatus(
                `Toggled ${cell} — path still open (${bfsPath4d.length} cells).`,
                'success'
            );
        } else {
            setStatus(
                `Toggled ${cell} — no path to End yet.`,
                'info'
            );
        }
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
    });
});
