function init4dRun() {
    run4dState.params = new URLSearchParams(window.location.search);
    run4dState.mapParam = (run4dState.params.get('map4d') || '').trim();
    run4dState.mapSource = run4dState.mapParam ? 'URL `map4d` parameter' : '';
    run4dState.ready = true;
    window.addEventListener('resize', render4dRunFrame);

    const statusBar = document.getElementById('statusBar');

    if (!run4dState.mapParam) {
        if (statusBar) {
            statusBar.textContent = 'IRL 4D route loaded. No map data in URL yet.';
            statusBar.className = 'status-bar neutral';
        }
        initPlayer4dRun();
        initUi4dRun();
        render4dRunSummary();
        render4dRunFrame();
        return;
    }

    const decoded = decodeSerializedMap4dRun(run4dState.mapParam);
    if (!decoded.ok) {
        if (statusBar) {
            statusBar.textContent = `4D map decode failed: ${decoded.error}`;
            statusBar.className = 'status-bar error';
        }
        initPlayer4dRun();
        initUi4dRun();
        render4dRunSummary();
        render4dRunFrame();
        return;
    }

    const bfsPath = bfs4dRun(decoded.grid);
    run4dState.gridSize = decoded.size;
    run4dState.grid = decoded.grid;
    run4dState.bfsPath = bfsPath;
    run4dState.solvable = !!bfsPath;
    run4dState.wallCount = countWalls4dRun(decoded.grid);
    run4dState.hyperLayer = decoded.size - 1;
    run4dState.hyperSliceOffset = getCenterSliceOffset4dRun(decoded.size);
    run4dState.crossSection = buildCrossSection4dRun(decoded.grid, run4dState.hyperSliceOffset, bfsPath);

    if (statusBar) {
        statusBar.textContent = bfsPath
            ? 'IRL 4D route ready. Click the view to lock the mouse.'
            : 'IRL 4D map decoded, but BFS did not find a valid route.';
        statusBar.className = bfsPath ? 'status-bar neutral' : 'status-bar error';
    }

    initPlayer4dRun();
    initUi4dRun();
    render4dRunSummary();
    render4dRunFrame();
    start4dRunLoop();
}

document.addEventListener('DOMContentLoaded', init4dRun);
