function getAudioContext() {
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playMerp() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(210, now);
        osc.frequency.exponentialRampToValueAtTime(116, now + 0.15);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.17);
    } catch (_) { }
}

function playCelebrate() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const notes = [330, 494, 659];
        const now = ctx.currentTime;
        notes.forEach((freq, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + index * 0.08);
            gain.gain.setValueAtTime(0.0001, now + index * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.07, now + index * 0.08 + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.22);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + index * 0.08);
            osc.stop(now + index * 0.08 + 0.24);
        });
    } catch (_) { }
}
