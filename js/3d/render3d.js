// js/3d/render3d.js — Phase 3 Step 6: canvas mapping + debug overlay
// Full scan renderer added in Phase 5 (Step 9).

// ── Canvas ↔ World coordinate mapping ────────────────────────────────────────
//
//   canvas_x = m.ox + world_x * m.scale
//   canvas_y = m.oy − world_y * m.scale   (positive world-Y is up → smaller canvas-Y)
//
// World X spans [0, N·SQ2]; world Y spans [−N/SQ2, N/SQ2].
// The world is centred horizontally on the canvas; world Y=0 maps to vertical centre.
//
// Store the last-computed mapping so other modules (player, debug) can reuse it.
let worldToCanvas3d = null;   // set by getCanvasMapping3d() each frame

function getCanvasMapping3d() {
    const N   = gridSize3d;
    const cw  = scanCanvas3d.width;
    const ch  = scanCanvas3d.height;
    const pad = 24;
    const worldW = N * SQ2;
    const worldH = (2 * N) / SQ2;
    const scale  = Math.min((cw - 2 * pad) / worldW, (ch - 2 * pad) / worldH);
    // Centre world in canvas: left edge of world → canvas x = ox
    const ox = cw / 2 - (worldW / 2) * scale;
    const oy = ch / 2;   // world Y=0 → canvas vertical centre
    worldToCanvas3d = { scale, ox, oy };
    return worldToCanvas3d;
}

// Map a single world point to canvas pixel coords.
function wxToCanvas(wx, m) { return m.ox + wx * m.scale; }
function wyToCanvas(wy, m) { return m.oy - wy * m.scale; }

// Map a world rect { x0,x1,y0,y1 } to canvas { cx0, cy0, cw, ch }.
// In world coords y0 < y1 (y0 = bottom edge, y1 = top edge); on canvas y is
// flipped, so y1 maps to the smaller (upper) canvas-y.
function rectToCanvas(r, m) {
    const cx0 = wxToCanvas(r.x0, m);
    const cy0 = wyToCanvas(r.y1, m);   // world top edge → canvas top
    const cw  = (r.x1 - r.x0) * m.scale;
    const ch  = (r.y1 - r.y0) * m.scale;
    return { cx0, cy0, cw, ch };
}

// ── Debug overlay ─────────────────────────────────────────────────────────────
// Drawn on top of whatever is already rendered on the scan canvas.
// crossSection = { passable, startRect, endRect } from buildCrossSection().

function drawDebugOverlay3d(crossSection, m) {
    const ctx = scanCtx3d;
    const S   = sliceOffset;
    const C   = S * SQ2;
    const allCells = crossSection.passable.length
        + (crossSection.startRect ? 1 : 0)
        + (crossSection.endRect   ? 1 : 0);

    ctx.save();

    // Passable rects — cyan outline (1 px)
    ctx.lineWidth   = 1;
    ctx.strokeStyle = '#00ffff';
    for (const r of crossSection.passable) {
        const { cx0, cy0, cw, ch } = rectToCanvas(r, m);
        ctx.strokeRect(cx0, cy0, cw, ch);
    }

    // Start rect — green outline (2 px)
    if (crossSection.startRect) {
        const { cx0, cy0, cw, ch } = rectToCanvas(crossSection.startRect, m);
        ctx.strokeStyle = '#5dffb0';
        ctx.lineWidth   = 2;
        ctx.strokeRect(cx0, cy0, cw, ch);
    }

    // End rect — red outline (2 px)
    if (crossSection.endRect) {
        const { cx0, cy0, cw, ch } = rectToCanvas(crossSection.endRect, m);
        ctx.strokeStyle = '#ff6a6a';
        ctx.lineWidth   = 2;
        ctx.strokeRect(cx0, cy0, cw, ch);
    }

    // Text readout — top-left corner
    ctx.fillStyle    = '#00ffff';
    ctx.font         = '13px monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
        `S=${S.toFixed(2)}  C=${C.toFixed(2)}  layer=${currentLayer + 1}  cells=${allCells}`,
        8, 8
    );

    // Player dot ring — only meaningful while scan is running
    if (scanActive3d) {
        const px = wxToCanvas(player3d.x, m);
        const py = wyToCanvas(player3d.y, m);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

// ── Standalone debug preview ──────────────────────────────────────────────────
// Draws the cross-section geometry directly on the scan canvas without
// requiring an active scan.  Used in Phase 3 to verify the geometry engine
// before the player and movement systems are wired up.
//
// Always uses the centre slice (S = N/SQ2) so the result is a perfect N×N grid.

function renderDebugPreview3d() {
    const S  = getCenterSliceOffset();
    const cs = buildCrossSection(S);
    const m  = getCanvasMapping3d();

    // Temporarily set sliceOffset so the overlay text shows the correct S value.
    const prevSlice = sliceOffset;
    sliceOffset = S;

    const ctx = scanCtx3d;

    // Dark background
    ctx.fillStyle = '#0d1018';
    ctx.fillRect(0, 0, scanCanvas3d.width, scanCanvas3d.height);

    // Passable rects — faint fill
    ctx.fillStyle = 'rgba(242,245,255,0.12)';
    for (const r of cs.passable) {
        const { cx0, cy0, cw, ch } = rectToCanvas(r, m);
        ctx.fillRect(cx0, cy0, cw, ch);
    }

    // Start rect — faint green fill
    if (cs.startRect) {
        const { cx0, cy0, cw, ch } = rectToCanvas(cs.startRect, m);
        ctx.fillStyle = 'rgba(93,255,176,0.20)';
        ctx.fillRect(cx0, cy0, cw, ch);
    }

    // End rect — faint red fill
    if (cs.endRect) {
        const { cx0, cy0, cw, ch } = rectToCanvas(cs.endRect, m);
        ctx.fillStyle = 'rgba(255,106,106,0.20)';
        ctx.fillRect(cx0, cy0, cw, ch);
    }

    drawDebugOverlay3d(cs, m);

    sliceOffset = prevSlice;
}
