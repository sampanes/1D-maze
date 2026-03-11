// Scanner state reset (called from multiple places)
function resetScannerState() {
    player.u = 0;
    player.v = 1;
    avatarSquish = 0;
    celebrateUntil = 0;
    if (winResetHandle) {
        clearTimeout(winResetHandle);
        winResetHandle = null;
    }
}

// Button listeners
btnWipe.addEventListener('click', () => {
    if (scanActive) stopScan();
    setup();
});

btnValidate.addEventListener('click', () => {
    bfsPath = bfs();
    if (bfsPath) {
        solvable = true;
        btnScan.disabled = false;
        updateShareButton();
        drawMaze(bfsPath);
        setStatus('✓ BFS found a valid path from Start to End. Start Scan is enabled.', 'success');
    } else {
        solvable = false;
        btnScan.disabled = true;
        updateShareButton();
        drawMaze();
        setStatus('✗ No valid path exists from Start to End.', 'error');
    }
});

btnGetLink.addEventListener('click', async () => {
    if (!solvable) return;
    const encoded = serializeMazeToHex();
    const url = new URL(window.location.href);
    url.searchParams.set('map', encoded);
    const fullUrl = url.toString();

    try {
        await navigator.clipboard.writeText(fullUrl);
        showToast('Link Copied!');
        setStatus('Shareable maze URL copied to clipboard.', 'success');
    } catch (_) {
        showToast('Link Ready in Address Bar');
        setStatus('Clipboard copy failed, but the URL was generated in the address bar.', 'info');
    }

    try {
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch (_) { }
});

btnScan.addEventListener('click', () => {
    if (!solvable) return;
    startScan();
});

btnBack.addEventListener('click', () => stopScan());

gridSlider.addEventListener('input', () => {
    if (scanActive) stopScan();
    setup();
});

// Keyboard listeners
document.addEventListener('keydown', (e) => {
    keysDown[e.code] = true;
    if ((e.code === 'KeyP') && scanActive && !peeking) {
        peeking = true;
        mazeSection.classList.add('peek');
        mazeSection.classList.remove('collapsed');
        drawMaze(bfsPath, true);
    }
    if (scanActive && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    keysDown[e.code] = false;
    if ((e.code === 'KeyP') && scanActive && peeking) {
        peeking = false;
        mazeSection.classList.remove('peek');
        mazeSection.classList.add('collapsed');
    }
});

// Touch/mouse input for scan canvas
function handleScanTouch(e) {
    if (!scanActive || performance.now() < celebrateUntil) return;
    e.preventDefault();

    const rect = scanCanvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;

    const w = rect.width;
    const h = rect.height;
    const padX = 34 * (w / 900);

    const usableW = w - padX * 2;
    const totalV = 2 * gridSize;
    const targetV = ((offsetX - padX) / usableW) * totalV;
    const targetU = ((offsetY / h) - 0.5) * -2 * gridSize;

    const deltaV = targetV - player.v;
    const deltaU = targetU - player.u;

    if (Math.abs(deltaV) > 0.01) attemptMoveLateral(deltaV * 0.5);
    if (Math.abs(deltaU) > 0.01) attemptMoveVertical(deltaU * 0.5);
}

scanCanvas.addEventListener('mousedown', (e) => { painting = true; handleScanTouch(e); });
window.addEventListener('mousemove', (e) => { if (painting && scanActive) handleScanTouch(e); });
window.addEventListener('mouseup', () => painting = false);

scanCanvas.addEventListener('touchstart', (e) => { painting = true; handleScanTouch(e); }, { passive: false });
scanCanvas.addEventListener('touchmove', (e) => { if (painting && scanActive) handleScanTouch(e); }, { passive: false });
scanCanvas.addEventListener('touchend', () => painting = false);

// Resize
window.addEventListener('resize', () => {
    computeSizes();
    if (scanActive) drawMaze(bfsPath, true);
    else drawMaze(bfsPath);
    drawScanView(performance.now());
});

// Render loop
function renderLoop(ts) {
    const dt = Math.min(0.05, (ts - lastFrameTime) / 1000);
    lastFrameTime = ts;
    avatarSquish = Math.max(0, avatarSquish - dt * 4.8);

    if (scanActive) {
        handleInputs(dt);
        drawScanView(ts);
        if (peeking) drawMaze(bfsPath, true);
    }

    requestAnimationFrame(renderLoop);
}

// Entry point
if (!tryLoadMapFromUrl()) {
    setup();
}
requestAnimationFrame(renderLoop);
