/**
 * js/4d/init4d.js
 * 
 * Entry point for the 4D Hyper-Maze Architect.
 * Binds UI controls and handles the animation loop.
 */

document.addEventListener('DOMContentLoaded', () => {
    const gridSlider = document.getElementById('gridSlider');
    const gridVal = document.getElementById('gridVal');
    const hyperSlider = document.getElementById('hyperSlider');
    const hyperVal = document.getElementById('hyperVal');
    const btnResetView = document.getElementById('btnResetView');

    // ── Initial State ────────────────────────────────────────────────────────

    function reset4d(n) {
        initGrid4d(n);
        
        // Max hyper-offset is 2N - 2 (since ia+id can range from 0+0 to (N-1)+(N-1))
        const maxHyper = 2 * n - 2;
        hyperSlider.max = maxHyper;
        hyperSlider.value = n - 1; // Start at center
        hyperOffset = n - 1;
        hyperVal.textContent = parseFloat(hyperSlider.value).toFixed(1);
        
        drawHyperVolume4d();
    }

    // Initialize 4D renderer
    initRender4d();
    reset4d(parseInt(gridSlider.value));

    // ── UI Listeners ─────────────────────────────────────────────────────────

    gridSlider.addEventListener('input', () => {
        const n = parseInt(gridSlider.value);
        gridVal.textContent = n;
        reset4d(n);
    });

    hyperSlider.addEventListener('input', () => {
        hyperOffset = parseFloat(hyperSlider.value);
        hyperVal.textContent = hyperOffset.toFixed(1);
        drawHyperVolume4d();
    });

    btnResetView.addEventListener('click', () => {
        cameraAz4d = 45 * Math.PI / 180;
        cameraEl4d = 30 * Math.PI / 180;
        drawHyperVolume4d();
    });

    // ── Mouse Rotation (MMB or R+Drag) ───────────────────────────────────────

    let isRotating = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    hyperCanvas.addEventListener('mousedown', (e) => {
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) { // MMB or Shift+LMB
            isRotating = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            e.preventDefault();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isRotating) return;
        
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        
        cameraAz4d -= dx * 0.01;
        cameraEl4d = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraEl4d + dy * 0.01));
        
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        
        drawHyperVolume4d();
    });

    window.addEventListener('mouseup', () => {
        isRotating = false;
    });

    // Handle "R" key for rotation as well
    let rPressed = false;
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'r') rPressed = true;
    });
    window.addEventListener('keyup', (e) => {
        if (e.key.toLowerCase() === 'r') rPressed = false;
    });

    hyperCanvas.addEventListener('mousedown', (e) => {
        if (rPressed && e.button === 0) {
            isRotating = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
    });
});
