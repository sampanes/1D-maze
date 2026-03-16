/**
 * js/4d/init4d.js
 *
 * Entry point for the 4D Hyper-Maze Architect.
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
    const btnResetView = document.getElementById('btnResetView');
    const statusBar = document.getElementById('statusBar');

    function updateLayerDisplays() {
        const maxLayer = maxLayerIndex4d();
        // Match 3D page convention: higher displayed layer means visually upward.
        layerDisplay.textContent = String(maxLayer + 1 - layerOffset3d);
        hyperDisplay.textContent = String(maxLayer + 1 - hyperOffset);
    }

    function reset4d(n) {
        initGrid4d(n);
        const center = n - 1;
        layerOffset3d = center;
        hyperOffset = center;
        updateLayerDisplays();
        drawHyperVolume4d();
    }

    initRender4d();
    reset4d(parseInt(gridSlider.value, 10));

    gridSlider.addEventListener('input', () => {
        const n = parseInt(gridSlider.value, 10);
        gridVal.textContent = String(n);
        reset4d(n);
    });

    layerPrevBtn.addEventListener('click', () => {
        if (layerOffset3d < maxLayerIndex4d()) {
            layerOffset3d++;
            updateLayerDisplays();
            drawHyperVolume4d();
        }
    });

    layerNextBtn.addEventListener('click', () => {
        if (layerOffset3d > 0) {
            layerOffset3d--;
            updateLayerDisplays();
            drawHyperVolume4d();
        }
    });

    hyperPrevBtn.addEventListener('click', () => {
        if (hyperOffset < maxLayerIndex4d()) {
            hyperOffset++;
            updateLayerDisplays();
            drawHyperVolume4d();
        }
    });

    hyperNextBtn.addEventListener('click', () => {
        if (hyperOffset > 0) {
            hyperOffset--;
            updateLayerDisplays();
            drawHyperVolume4d();
        }
    });

    btnResetView.addEventListener('click', () => {
        cameraAz4d = 45 * Math.PI / 180;
        cameraEl4d = 30 * Math.PI / 180;
        drawHyperVolume4d();
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
        if (e.code === 'KeyR') rotateKeyHeld = true;
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyR') rotateKeyHeld = false;
    });
});
