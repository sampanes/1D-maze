function init4dRun() {
    run4dState.params = new URLSearchParams(window.location.search);
    run4dState.mapParam = run4dState.params.get('map4d') || '';
    run4dState.ready = true;

    const statusBar = document.getElementById('statusBar');
    if (statusBar) {
        statusBar.textContent = run4dState.mapParam
            ? 'IRL 4D scaffold loaded with URL map data.'
            : 'IRL 4D scaffold loaded. No map data in URL yet.';
        statusBar.className = 'status-bar info';
    }

    initPlayer4dRun();
    initUi4dRun();
    render4dRunSummary();
}

document.addEventListener('DOMContentLoaded', init4dRun);
