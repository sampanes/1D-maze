// js/3d/slice.js — 3D slice movement (W/S)

/**
 * Return inclusive slice movement bounds, slightly inset to avoid degenerate zero-area intersections.
 * @returns {{min:number,max:number}}
 */
function getSliceBounds3d() {
    const max = gridSize3d * SQ2;
    return { min: 0.0001, max: max - 0.0001 };
}

/**
 * Move the slice by delta, clamped to valid world bounds.
 * @param {number} deltaS
 */
function moveSlice3d(deltaS) {
    const b = getSliceBounds3d();
    sliceOffset = Math.max(b.min, Math.min(b.max, sliceOffset + deltaS));
}

/**
 * Update slice position from keyboard input (W upward layer, S downward layer).
 * @param {number} dt - Frame delta in seconds.
 */
function updateSliceFromInput3d(dt) {
    let dir = 0;
    if (keysDown3d['KeyW']) dir += 1;
    if (keysDown3d['KeyS']) dir -= 1;
    if (!dir) return;
    moveSlice3d(dir * SLICE_SPEED * dt);
}
