/**
 * js/4d/init4d.js
 *
 * Entry point and controls for the 4D editor/scanner.
 */

document.addEventListener('DOMContentLoaded', () => {
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

    function setStatus(message, cls = 'neutral') {
        statusBar.className = `status-bar ${cls}`;
        statusBar.textContent = message;
    }

    function updateLayerDisplays() {
        layerDisplay.textContent = String(layerOffset3d + 1);
        hyperDisplay.textContent = String(hyperOffset + 1);
    }

    function updateScanButtonState() {
        btnScan.disabled = false;
    }

    function reset4d(n) {
        initGrid4d(n);
        updateLayerDisplays();
        setStatus('Click cubes on the active Layer to paint walls. Start/End are opposite corners on the same cross-section. Arrow keys move x/y, W/S move z.');
        drawHyperVolume4d();
        updateScanButtonState();
    }

    initRender4d();
    reset4d(parseInt(gridSlider.value, 10));

    gridSlider.addEventListener('input', () => {
        const n = parseInt(gridSlider.value, 10);
        gridVal.textContent = String(n);
        reset4d(n);
    });

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

    hyperPrevBtn.addEventListener('click', () => {
        hyperOffset = clamp4d(hyperOffset - 1, 0, maxLayerIndex4d());
        stabilizePlayerAfterHyperShift();
        updateLayerDisplays();
        drawHyperVolume4d();
    });

    hyperNextBtn.addEventListener('click', () => {
        hyperOffset = clamp4d(hyperOffset + 1, 0, maxLayerIndex4d());
        stabilizePlayerAfterHyperShift();
        updateLayerDisplays();
        drawHyperVolume4d();
    });

    btnResetView.addEventListener('click', () => {
        cameraAz4d = 45 * Math.PI / 180;
        cameraEl4d = 30 * Math.PI / 180;
        drawHyperVolume4d();
    });

    btnScan.addEventListener('click', () => {
        setStatus('Scan mode is not wired yet in 4D. This button is a placeholder for upcoming scanner flow.', 'info');
    });

    let isRotating = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let rotateKeyHeld = false;

    hyperCanvas.addEventListener('mousedown', (e) => {
        const middleDrag = e.button === 1;
        const rDrag = rotateKeyHeld && e.button === 0;
        if (!middleDrag && !rDrag) return;
        isRotating = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        e.preventDefault();
    });

    hyperCanvas.addEventListener('click', (e) => {
        if (isRotating) return;
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
        stabilizePlayerAfterHyperShift();
        drawHyperVolume4d();
        setStatus(`Toggled cell (${picked.x}, ${picked.y}, ${picked.z}) on 4D layer ${hyperOffset + 1}.`, 'success');
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

    window.addEventListener('mouseup', () => {
        isRotating = false;
    });

    window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        if (e.code === 'KeyR') {
            rotateKeyHeld = true;
            return;
        }

        let moved = false;
        if (e.code === 'ArrowLeft') moved = movePlayer4d(-1, 0, 0);
        else if (e.code === 'ArrowRight') moved = movePlayer4d(1, 0, 0);
        else if (e.code === 'ArrowUp') moved = movePlayer4d(0, -1, 0);
        else if (e.code === 'ArrowDown') moved = movePlayer4d(0, 1, 0);
        else if (e.code === 'KeyW') moved = movePlayer4d(0, 0, 1);
        else if (e.code === 'KeyS') moved = movePlayer4d(0, 0, -1);
        else return;

        e.preventDefault();
        drawHyperVolume4d();
        if (moved) {
            if (playerReachedEnd4d()) {
                setStatus('Scan complete! Reached the end anchor on this cross-section.', 'success');
            } else {
                setStatus(`Player moved to (${player4d.x}, ${player4d.y}, ${player4d.z}) on 4D layer ${hyperOffset + 1}.`, 'neutral');
            }
        } else {
            setStatus('Blocked: target cell is out of bounds or a wall.', 'error');
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyR') rotateKeyHeld = false;
    });
});
