// js/3d/slice.js — 3D slice movement (W/S)

function getSliceBounds3d() {
    const max = gridSize3d * SQ2;
    return { min: 0.0001, max: max - 0.0001 };
}

function moveSlice3d(deltaS) {
    const b = getSliceBounds3d();
    sliceOffset = Math.max(b.min, Math.min(b.max, sliceOffset + deltaS));
}

function updateSliceFromInput3d(dt) {
    let dir = 0;
    if (keysDown3d['KeyW']) dir += 1;
    if (keysDown3d['KeyS']) dir -= 1;
    if (!dir) return;
    moveSlice3d(dir * SLICE_SPEED * dt);
}
