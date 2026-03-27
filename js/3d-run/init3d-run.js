function init3dRun() {
    run3dState.params = new URLSearchParams(window.location.search);
    const explicitMap3d = run3dState.params.get('map3d');
    const fallbackMap = run3dState.params.get('map');
    run3dState.mapParam = explicitMap3d || fallbackMap || '';
    run3dState.mapSource = explicitMap3d ? 'Loaded from ?map3d' : (fallbackMap ? 'Loaded from ?map fallback' : '');
    run3dState.mapParamName = explicitMap3d ? 'map3d' : (fallbackMap ? 'map' : '');

    const statusBar = document.getElementById('statusBar');

    if (run3dState.mapParam) {
        const decoded = decodeSerializedMap3dRun(run3dState.mapParam);
        if (decoded.ok) {
            run3dState.gridSize = decoded.size;
            run3dState.grid = decoded.grid;
            run3dState.bfsPath = bfs3dRun(decoded.grid);
            run3dState.solvable = !!run3dState.bfsPath;
            run3dState.wallCount = countWalls3dRun(decoded.grid);
            run3dState.sliceOffset = getCenterSliceOffset3dRun(decoded.size);
            run3dState.crossSection = buildCrossSection3dRun(run3dState.grid, run3dState.sliceOffset, run3dState.bfsPath);
            run3dState.ready = true;
            if (statusBar) {
                statusBar.textContent = run3dState.solvable
                    ? `3D map decoded successfully. Grid ${decoded.size}^3, BFS route found.`
                    : `3D map decoded successfully. Grid ${decoded.size}^3, but BFS found no route.`;
                statusBar.className = `status-bar ${run3dState.solvable ? 'success' : 'error'}`;
            }
        } else {
            run3dState.ready = false;
            if (statusBar) {
                statusBar.textContent = `3D map decode failed: ${decoded.error}`;
                statusBar.className = 'status-bar error';
            }
        }
    } else {
        run3dState.ready = false;
        if (statusBar) {
            statusBar.textContent = 'IRL 3D route ready. No map data in URL yet.';
            statusBar.className = 'status-bar info';
        }
    }

    initPlayer3dRun();
    reset3dRunPoseFromStart();
    initUi3dRun();
    render3dRunSummary();
    render3dRunMetrics();
    render3dRunOverview();
    start3dRunLoop();
}

document.addEventListener('DOMContentLoaded', init3dRun);
window.addEventListener('resize', render3dRunOverview);
