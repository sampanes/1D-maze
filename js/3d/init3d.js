// js/3d/init3d.js — Phase 2/3b: 3D game entry point

// Fix the slider range for 3D (globals.js carries the 2D default of 2–64)
gridSlider.min = String(GRID3D_MIN);
gridSlider.max = String(GRID3D_MAX);
gridSlider.value = String(GRID3D_DEFAULT);
gridVal.textContent = String(GRID3D_DEFAULT);

// ── Remove the 45° CSS rotation that the 2D game uses ────────────────────────
// maze-core.js's computeSizes() styles diamondContainer with rotate(-45deg).
// The perspective renderer draws the 3D view directly; no CSS rotation needed.
diamondContainer.style.transform = 'none';
diamondContainer.style.transformOrigin = '';

// Hide the 2D corner labels — their positions are cellSize-based and do not
// apply to the perspective view.
startLabel.style.display = 'none';
endLabel.style.display   = 'none';

// Wrap computeSizes so it can't re-apply the rotation on subsequent redraws.
const _origComputeSizes = computeSizes;
computeSizes = function() {
    _origComputeSizes();
    diamondContainer.style.transform = 'none';
};

// ── Override screenToCanvas (perspective renderer, no rotation correction) ────
// The 2D version undoes the CSS rotate(-45deg) transform.
// The perspective renderer needs a straight pixel mapping.
screenToCanvas = function(mouseX, mouseY) {
    const rect = mazeCanvas.getBoundingClientRect();
    const scale = canvasSize / rect.width;
    return {
        x: (mouseX - rect.left) * scale,
        y: (mouseY - rect.top)  * scale,
    };
};

// Correct the header subtitle that maze-core.js may overwrite on resize
function updateHeaderText() {
    const p = document.querySelector('.header p');
    if (p) p.textContent = 'Build a 3D lattice, validate it, then explore with a moving cross-section slice.';
}
updateHeaderText();
window.addEventListener('resize', updateHeaderText);

// ── Initial setup ─────────────────────────────────────────────────────────────

function setup3d() {
    const n = parseInt(gridSlider.value, 10);
    gridSize3d = n;
    gridVal.textContent = n;
    initGrid3d(n);          // also resets currentLayer = 0
    redraw3d();
    setStatus('Click and drag on the diamond to paint walls. Right-click or hold Shift to erase.', 'neutral');
}

setup3d();
tryLoad3dMapFromUrl();
