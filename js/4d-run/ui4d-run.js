function initUi4dRun() {
    const goBackToScan4d = (e) => {
        if (e) e.preventDefault();
        const url = new URL(window.location.href);
        const target = new URL('scan4d.html', url);
        const map4d = url.searchParams.get('map4d');
        if (map4d) target.searchParams.set('map4d', map4d);
        target.searchParams.set('edit', '1');
        window.location.href = target.toString();
    };

    const btn = document.getElementById('btnOpenScan4d');
    if (btn) btn.addEventListener('click', goBackToScan4d);

    const linkBack = document.getElementById('linkBackToScan4d');
    if (linkBack) linkBack.addEventListener('click', goBackToScan4d);

    const resetPose = () => {
        if (!run4dState.grid || !run4dState.crossSection) return;
        reset4dRunPoseFromStart();
        run4dState.completed = false;
        const statusBar = document.getElementById('statusBar');
        if (statusBar) {
            statusBar.textContent = '4D pose reset to the current slice start.';
            statusBar.className = 'status-bar neutral';
        }
    };

    const centerSlice = () => {
        if (!run4dState.grid || !run4dState.gridSize) return;
        run4dState.hyperLayer = run4dState.gridSize - 1;
        run4dState.hyperSliceOffset = getCenterSliceOffset4dRun(run4dState.gridSize);
        run4dState.crossSection = buildCrossSection4dRun(run4dState.grid, run4dState.hyperSliceOffset, run4dState.bfsPath);
        resetPose();
        const statusBar = document.getElementById('statusBar');
        if (statusBar) {
            statusBar.textContent = '4D hyper-slice recentered and pose reset.';
            statusBar.className = 'status-bar neutral';
        }
    };

    const centerBtn = document.getElementById('btnCenterRun4dSlice');
    if (centerBtn) centerBtn.addEventListener('click', centerSlice);

    const resetBtn = document.getElementById('btnResetRun4dPose');
    if (resetBtn) resetBtn.addEventListener('click', resetPose);

    const canvas = document.getElementById('run4dOverviewCanvas');
    if (canvas) {
        canvas.addEventListener('click', async () => {
            try {
                if (document.pointerLockElement !== canvas) await canvas.requestPointerLock();
            } catch (_) {}
        });
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) run4dState.xrayHeld = true;
        });
    }

    document.addEventListener('mouseup', (e) => {
        if (e.button === 0) run4dState.xrayHeld = false;
    });

    document.addEventListener('pointerlockchange', () => {
        run4dState.pointerLocked = document.pointerLockElement === canvas;
        const statusBar = document.getElementById('statusBar');
        if (!statusBar || !run4dState.grid) return;
        if (run4dState.pointerLocked) {
            statusBar.textContent = '4D mouse look active. Hold LMB for x-ray. Esc unlocks the cursor.';
            statusBar.className = 'status-bar info';
        } else if (!run4dState.completed) {
            statusBar.textContent = '4D IRL ready. Click the view to lock the mouse.';
            statusBar.className = 'status-bar neutral';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!run4dState.pointerLocked) return;
        run4dState.yaw += e.movementX * 0.0026;
        run4dState.pitch = Math.max(-0.7, Math.min(0.45, run4dState.pitch - e.movementY * 0.0018));
    });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyR') {
            resetPose();
            e.preventDefault();
            return;
        }
        if (e.code === 'KeyC') {
            centerSlice();
            e.preventDefault();
            return;
        }
        run4dState.keys[e.code] = true;
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
        delete run4dState.keys[e.code];
    });
}
