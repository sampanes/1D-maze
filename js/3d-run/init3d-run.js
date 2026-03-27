function init3dRun() {
    run3dState.params = new URLSearchParams(window.location.search);
    run3dState.mapParam = run3dState.params.get('map3d') || run3dState.params.get('map') || '';
    run3dState.ready = true;

    const statusBar = document.getElementById('statusBar');
    if (statusBar) {
        statusBar.textContent = run3dState.mapParam
            ? 'IRL 3D scaffold loaded with URL map data.'
            : 'IRL 3D scaffold loaded. No map data in URL yet.';
        statusBar.className = 'status-bar info';
    }

    initPlayer3dRun();
    initUi3dRun();
    render3dRunSummary();
}

document.addEventListener('DOMContentLoaded', init3dRun);
