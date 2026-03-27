function initUi3dRun() {
    const PITCH_MIN = -0.55;
    const PITCH_MAX = 0.2;

    const loadMapIntoUrl = (paramName, value) => {
        const url = new URL(window.location.href);
        url.searchParams.delete('map');
        url.searchParams.delete('map3d');
        url.searchParams.set(paramName, value);
        window.location.href = url.toString();
    };

    const btn = document.getElementById('btnOpenScan3d');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const url = new URL(window.location.href);
        const target = new URL('scan3d.html', url);
        const map3d = url.searchParams.get('map3d');
        const map = url.searchParams.get('map');
        if (map3d) target.searchParams.set('map3d', map3d);
        else if (map) target.searchParams.set('map', map);
        window.location.href = target.toString();
    });

    const sampleBtn = document.getElementById('btnLoadSample3d');
    if (sampleBtn) {
        sampleBtn.addEventListener('click', () => loadMapIntoUrl('map3d', '03492ED42'));
    }

    const sampleBtnLarge = document.getElementById('btnLoadSample3dLarge');
    if (sampleBtnLarge) {
        sampleBtnLarge.addEventListener('click', () => loadMapIntoUrl('map3d', '05C6F7BD7BFFFE84B5AD5EFFFEE16B5A1'));
    }

    const sampleBtnSmallLink = document.getElementById('btnLoadSample3dSmallLink');
    if (sampleBtnSmallLink) {
        sampleBtnSmallLink.addEventListener('click', () => loadMapIntoUrl('map3d', '03492ED42'));
    }

    const sampleBtnLargeLink = document.getElementById('btnLoadSample3dLargeLink');
    if (sampleBtnLargeLink) {
        sampleBtnLargeLink.addEventListener('click', () => loadMapIntoUrl('map3d', '05C6F7BD7BFFFE84B5AD5EFFFEE16B5A1'));
    }

    const canvas = document.getElementById('run3dOverviewCanvas');
    if (canvas) {
        canvas.addEventListener('click', async () => {
            try {
                if (document.pointerLockElement !== canvas) await canvas.requestPointerLock();
            } catch (_) {}
        });
    }

    document.addEventListener('pointerlockchange', () => {
        run3dState.pointerLocked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', (e) => {
        if (!run3dState.pointerLocked) return;
        run3dState.yaw -= e.movementX * 0.0028;
        run3dState.pitch = Math.max(
            PITCH_MIN,
            Math.min(PITCH_MAX, run3dState.pitch - e.movementY * 0.0018)
        );
    });

    document.addEventListener('keydown', (e) => {
        run3dState.keys[e.code] = true;
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code)) e.preventDefault();
    });

    document.addEventListener('keyup', (e) => {
        delete run3dState.keys[e.code];
    });
}
