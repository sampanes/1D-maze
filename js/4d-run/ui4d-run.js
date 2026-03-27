function initUi4dRun() {
    const btn = document.getElementById('btnOpenScan4d');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const url = new URL(window.location.href);
        const target = new URL('scan4d.html', url);
        const map4d = url.searchParams.get('map4d');
        if (map4d) target.searchParams.set('map4d', map4d);
        window.location.href = target.toString();
    });
}
