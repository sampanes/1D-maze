function initUi3dRun() {
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
}
