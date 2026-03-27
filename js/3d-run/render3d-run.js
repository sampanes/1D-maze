function render3dRunSummary() {
    const el = document.getElementById('run3dSummary');
    if (!el) return;
    const mapText = run3dState.mapParam
        ? `Map loaded from URL (${run3dState.mapParam.length} chars).`
        : 'No map parameter detected yet.';
    el.textContent = `${mapText} This page is reserved for the standalone 3D IRL implementation.`;
}
