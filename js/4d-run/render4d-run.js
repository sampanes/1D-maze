function render4dRunSummary() {
    const el = document.getElementById('run4dSummary');
    if (!el) return;
    const mapText = run4dState.mapParam
        ? `Map loaded from URL (${run4dState.mapParam.length} chars).`
        : 'No map parameter detected yet.';
    el.textContent = `${mapText} This page is reserved for the standalone 4D IRL implementation.`;
}
