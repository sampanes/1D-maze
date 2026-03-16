/**
 * js/4d/init4d.js
 *
 * Entry point and controls for the 4D editor/scanner.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM wiring is intentionally colocated so a future maintainer (human or LLM)
    // can trace UI element IDs directly to behavior in one pass.
    const gridSlider = document.getElementById('gridSlider');
    const gridVal = document.getElementById('gridVal');
    const layerPrevBtn = document.getElementById('layerPrevBtn');
    const layerNextBtn = document.getElementById('layerNextBtn');
    const layerDisplay = document.getElementById('layerDisplay');
    const hyperPrevBtn = document.getElementById('hyperPrevBtn');
    const hyperNextBtn = document.getElementById('hyperNextBtn');
    const hyperDisplay = document.getElementById('hyperDisplay');
    const btnScan = document.getElementById('btnScan');
    const btnResetView = document.getElementById('btnResetView');
    const statusBar = document.getElementById('statusBar');

    let isRotating = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let rotateKeyHeld = false;
    let lastFrame4d = performance.now();

    // Small helper to keep status-bar updates visually consistent.
    // We use semantic classes (`neutral`, `info`, `success`, `error`) so styling can
    // evolve in CSS without touching control logic.
    function setStatus(message, cls = 'neutral') {
        statusBar.className = `status-bar ${cls}`;
        statusBar.textContent = message;
    }

    // Two displays are shown in the UI:
    // - Layer: integer Z index used in edit mode
    // - 4D Layer: integer W index in edit mode, or continuous slice offset in scan mode
    //   (continuous value reflects the scanner's true "between-cells" position)
    function updateLayerDisplays() {
        layerDisplay.textContent = String(layerOffset3d + 1);
        if (scanActive4d) {
            hyperDisplay.textContent = hyperSliceOffset.toFixed(2);
        } else {
            hyperDisplay.textContent = String(hyperOffset + 1);
        }
    }

    // Scan mode intentionally locks editing controls.
    // This avoids ambiguous states where the user modifies voxels while movement logic
    // is evaluating occupancy from a continuously moving 4D slice.
    function updateUiForMode() {
        const editMode = !scanActive4d;
        layerPrevBtn.disabled = !editMode;
        layerNextBtn.disabled = !editMode;
        hyperPrevBtn.disabled = !editMode;
        hyperNextBtn.disabled = !editMode;
        btnScan.textContent = scanActive4d ? 'Stop Scan' : 'Start Scan';
        updateLayerDisplays();
    }

    // Reset is used both on first load and when grid size changes.
    // Design choice: reinitialize state deterministically instead of trying to rescale
    // existing data, because preserving topology across different N values is ambiguous.
    function reset4d(n) {
        initGrid4d(n);
        updateUiForMode();
        setStatus('Edit mode: click cubes on the active Layer to paint walls. Start/End are opposite corners on the same cross-section.', 'neutral');
        drawHyperVolume4d();
        btnScan.disabled = false;
    }

    // Main animation/update loop.
    // Only redraw when the scan slice changed to reduce unnecessary canvas work.
    // dt is clamped to avoid giant time jumps when tab visibility changes.
    function tick4d(ts) {
        const dt = Math.min(0.05, (ts - lastFrame4d) / 1000);
        lastFrame4d = ts;

        let needsRedraw = false;
        if (updateHyperSliceFromInput4d(dt)) needsRedraw = true;

        if (needsRedraw) {
            updateLayerDisplays();
            drawHyperVolume4d();
        }

        requestAnimationFrame(tick4d);
    }

    initRender4d();
    reset4d(parseInt(gridSlider.value, 10));
    requestAnimationFrame(tick4d);

    // Any grid-size change is treated as creating a fresh puzzle space.
    gridSlider.addEventListener('input', () => {
        const n = parseInt(gridSlider.value, 10);
        gridVal.textContent = String(n);
        reset4d(n);
    });

    // Layer navigation is hard-clamped. We never wrap because physical layer ordering
    // is meaningful for users reasoning spatially.
    layerPrevBtn.addEventListener('click', () => {
        layerOffset3d = clamp4d(layerOffset3d - 1, 0, maxLayerIndex4d());
        updateLayerDisplays();
        drawHyperVolume4d();
    });

    layerNextBtn.addEventListener('click', () => {
        layerOffset3d = clamp4d(layerOffset3d + 1, 0, maxLayerIndex4d());
        updateLayerDisplays();
        drawHyperVolume4d();
    });

    // In edit mode, W is a discrete index. After changing W, we re-stabilize the player
    // so they are always in a valid empty cell for that layer.
    hyperPrevBtn.addEventListener('click', () => {
        hyperOffset = clamp4d(hyperOffset - 1, 0, maxLayerIndex4d());
        stabilizePlayer4d();
        updateLayerDisplays();
        drawHyperVolume4d();
    });

    hyperNextBtn.addEventListener('click', () => {
        hyperOffset = clamp4d(hyperOffset + 1, 0, maxLayerIndex4d());
        stabilizePlayer4d();
        updateLayerDisplays();
        drawHyperVolume4d();
    });

    btnResetView.addEventListener('click', () => {
        cameraAz4d = 45 * Math.PI / 180;
        cameraEl4d = 30 * Math.PI / 180;
        drawHyperVolume4d();
    });

    // Scan toggle bridges the two operating modes:
    // - edit mode: direct voxel editing on a chosen W layer
    // - scan mode: continuous x+w slice traversal with movement constraints
    btnScan.addEventListener('click', () => {
        setScanActive4d(!scanActive4d);
        updateUiForMode();
        drawHyperVolume4d();
        if (scanActive4d) {
            setStatus('Scan mode: Arrow keys move x/y, W/S move z, and E/D smoothly shift the hyper-slice through 4D.', 'info');
        } else {
            setStatus('Returned to edit mode. Layer controls and painting are enabled again.', 'neutral');
        }
    });

    // Camera rotation supports either middle-click drag or R+left-drag.
    // The latter is a convenience for trackpads/mice without middle-click.
    hyperCanvas.addEventListener('mousedown', (e) => {
        const middleDrag = e.button === 1;
        const rDrag = rotateKeyHeld && e.button === 0;
        if (!middleDrag && !rDrag) return;
        isRotating = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        e.preventDefault();
    });

    // Click-to-paint applies only in edit mode.
    // We pick by projected cube centers (with a radius threshold) for robust UX on
    // dense scenes where exact polygon hit-testing would be expensive/noisy.
    hyperCanvas.addEventListener('click', (e) => {
        if (isRotating) return;
        if (scanActive4d) {
            setStatus('Painting is disabled during scan mode. Stop scan to edit cells.', 'info');
            return;
        }

        const picked = pickCellFromScreen4d(e.clientX, e.clientY, layerOffset3d);
        if (!picked) {
            setStatus('No cube selected. Try clicking closer to a visible cube center.', 'info');
            return;
        }

        if (isAnchorCell4d(picked.x, picked.y, picked.z)) {
            setStatus('Start/End anchors are fixed and cannot be painted.', 'info');
            return;
        }
        toggleCell4d(picked.x, picked.y, picked.z, hyperOffset);
        stabilizePlayer4d();
        drawHyperVolume4d();
        setStatus(`Toggled cell (${picked.x}, ${picked.y}, ${picked.z}) on 4D layer ${hyperOffset + 1}.`, 'success');
    });

    // Orbit camera around scene center.
    // Azimuth rotates around vertical axis; elevation is clamped to prevent flipping
    // through the poles, which keeps controls intuitive.
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

    window.addEventListener('mouseup', () => {
        isRotating = false;
    });

    // Keyboard model notes:
    // - keysDown4d tracks held keys for continuous hyper-slice motion (E/D)
    // - movement keys are applied on keydown edge (non-repeat) for grid-step motion
    // - preventDefault is used where needed to avoid browser scrolling
    window.addEventListener('keydown', (e) => {
        keysDown4d[e.code] = true;
        if (e.code === 'KeyR') {
            rotateKeyHeld = true;
            return;
        }

        if (e.repeat) return;

        let moved = false;
        // Axis convention decision:
        // ArrowUp should feel like positive "forward" in the displayed grid,
        // so we map it to +Y and ArrowDown to -Y.
        // (This intentionally reverses the previous mapping that felt inverted.)
        if (e.code === 'ArrowLeft') moved = movePlayer4d(-1, 0, 0);
        else if (e.code === 'ArrowRight') moved = movePlayer4d(1, 0, 0);
        else if (e.code === 'ArrowUp') moved = movePlayer4d(0, 1, 0);
        else if (e.code === 'ArrowDown') moved = movePlayer4d(0, -1, 0);
        else if (e.code === 'KeyW') moved = movePlayer4d(0, 0, 1);
        else if (e.code === 'KeyS') moved = movePlayer4d(0, 0, -1);
        else if (e.code === 'KeyE' || e.code === 'KeyD') {
            if (scanActive4d) e.preventDefault();
            return;
        } else return;

        e.preventDefault();
        drawHyperVolume4d();
        if (moved) {
            if (playerReachedEnd4d()) {
                setStatus('Scan complete! Reached the end anchor on this cross-section.', 'success');
            } else {
                setStatus(`Player moved to (${player4d.x}, ${player4d.y}, ${player4d.z}).`, 'neutral');
            }
        } else {
            setStatus('Blocked: target cell is out of bounds or not present in the current slice.', 'error');
        }
    });

    window.addEventListener('keyup', (e) => {
        delete keysDown4d[e.code];
        if (e.code === 'KeyR') rotateKeyHeld = false;
    });
});
