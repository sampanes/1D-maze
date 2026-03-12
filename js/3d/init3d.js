// js/3d/init3d.js — 3D game entry point

gridSlider.min = String(GRID3D_MIN);
gridSlider.max = String(GRID3D_MAX);
gridSlider.value = String(GRID3D_DEFAULT);
gridVal.textContent = String(GRID3D_DEFAULT);

diamondContainer.style.transform = 'none';
diamondContainer.style.transformOrigin = '';
startLabel.style.display = 'none';
endLabel.style.display = 'none';

const _origComputeSizes = computeSizes;
computeSizes = function() {
    _origComputeSizes();
    diamondContainer.style.transform = 'none';
};

screenToCanvas = function(mouseX, mouseY) {
    const rect = mazeCanvas.getBoundingClientRect();
    const scale = canvasSize / rect.width;
    return { x: (mouseX - rect.left) * scale, y: (mouseY - rect.top) * scale };
};

function updateHeaderText() {
    const p = document.querySelector('.header p');
    if (p) p.textContent = 'Build a 3D lattice, validate it, then explore with a moving cross-section slice.';
}

function setup3d() {
    const n = parseInt(gridSlider.value, 10);
    gridSize3d = n;
    gridVal.textContent = n;
    initGrid3d(n);
    redraw3d();
    scanSection.style.display = 'none';
    peekHint.style.display = 'none';
    setStatus('Click and drag on the diamond to paint walls. Right-click or hold Shift to erase.', 'neutral');
}

function tick3d(ts) {
    const dt = Math.min(0.05, (ts - lastFrameTime3d) / 1000);
    lastFrameTime3d = ts;

    if (scanActive3d) {
        updateSliceFromInput3d(dt);
        const cs = buildCrossSection(sliceOffset);
        resolvePlayerIntoCrossSection3d(cs);
        updatePlayer3d(dt, cs);
        renderScan3d();

        if (playerHitsEnd3d(cs)) {
            playCelebrate();
            stopScan3d('Scan complete! Reached the red goal cell.');
        }
        if (peeking3d) drawMaze3d(getBfsPathSetForDiagonal(currentLayer));
    }

    requestAnimationFrame(tick3d);
}

window.addEventListener('resize', () => {
    updateHeaderText();
    redraw3d();
    if (scanActive3d) renderScan3d();
});

updateHeaderText();
setup3d();
tryLoad3dMapFromUrl();
lastFrameTime3d = performance.now();
requestAnimationFrame(tick3d);
