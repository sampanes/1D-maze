// js/3d/render3d.js — Cross-section render pipeline and canvas/world mapping.

// Store the last-computed mapping so movement/debug helpers can reuse it.
let worldToCanvas3d = null;

/**
 * Rotate a world-space point by +45° around the centerline so the cross-section
 * is displayed as a diamond, with start on the left and end on the right.
 * @param {number} wx - World x.
 * @param {number} wy - World y.
 * @returns {{rx:number, ry:number}} Rotated point in display-world coordinates.
 */
function rotateWorldPoint45(wx, wy) {
    return {
        rx: (wx + wy) / SQ2,
        ry: (wx - wy) / SQ2,
    };
}

/**
 * Build the canvas mapping for the current grid after 45° world rotation.
 * @returns {{scale:number, ox:number, oy:number, minRX:number, minRY:number}}
 */
function getCanvasMapping3d() {
    const N = gridSize3d;
    const cw = scanCanvas3d.width;
    const ch = scanCanvas3d.height;
    const pad = 24;

    const corners = [
        rotateWorldPoint45(-N / SQ2, 0),
        rotateWorldPoint45(-N / SQ2, N * SQ2),
        rotateWorldPoint45(N / SQ2, 0),
        rotateWorldPoint45(N / SQ2, N * SQ2),
    ];

    const minRX = Math.min(...corners.map((p) => p.rx));
    const maxRX = Math.max(...corners.map((p) => p.rx));
    const minRY = Math.min(...corners.map((p) => p.ry));
    const maxRY = Math.max(...corners.map((p) => p.ry));

    const worldW = maxRX - minRX;
    const worldH = maxRY - minRY;
    const scale = Math.min((cw - 2 * pad) / worldW, (ch - 2 * pad) / worldH);
    const ox = cw / 2 - ((minRX + maxRX) * 0.5) * scale;
    const oy = ch / 2 + ((minRY + maxRY) * 0.5) * scale;

    worldToCanvas3d = { scale, ox, oy, minRX, minRY };
    return worldToCanvas3d;
}

/**
 * Convert a world point to canvas coordinates using 45° display rotation.
 * @param {number} wx
 * @param {number} wy
 * @param {{scale:number,ox:number,oy:number}} m
 * @returns {{x:number,y:number}}
 */
function worldPointToCanvas(wx, wy, m) {
    const p = rotateWorldPoint45(wx, wy);
    return {
        x: m.ox + p.rx * m.scale,
        y: m.oy - p.ry * m.scale,
    };
}

/**
 * Convert a world-space slice rect into its rotated canvas quad.
 * @param {{x0:number,x1:number,y0:number,y1:number}} r
 * @param {{scale:number,ox:number,oy:number}} m
 * @returns {Array<{x:number,y:number}>}
 */
function rectToCanvasQuad(r, m) {
    return [
        worldPointToCanvas(r.x0, r.y0, m),
        worldPointToCanvas(r.x1, r.y0, m),
        worldPointToCanvas(r.x1, r.y1, m),
        worldPointToCanvas(r.x0, r.y1, m),
    ];
}

/**
 * Fill+stroke one rotated cell quad.
 * @param {Array<{x:number,y:number}>} quad
 * @param {string} fill
 * @param {string} stroke
 */
function drawQuad(quad, fill, stroke) {
    const ctx = scanCtx3d;
    ctx.beginPath();
    ctx.moveTo(quad[0].x, quad[0].y);
    for (let i = 1; i < quad.length; i++) ctx.lineTo(quad[i].x, quad[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.stroke();
}

/**
 * Draw debug overlay for slice geometry and player position.
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} crossSection
 * @param {{scale:number,ox:number,oy:number}} m
 */
function drawDebugOverlay3d(crossSection, m) {
    const ctx = scanCtx3d;
    const S = sliceOffset;
    const C = S * SQ2;
    const allCells = crossSection.passable.length + (crossSection.startRect ? 1 : 0) + (crossSection.endRect ? 1 : 0);

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#00ffff';
    for (const r of crossSection.passable) {
        const q = rectToCanvasQuad(r, m);
        ctx.beginPath();
        ctx.moveTo(q[0].x, q[0].y);
        for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].x, q[i].y);
        ctx.closePath();
        ctx.stroke();
    }

    if (crossSection.startRect) {
        const q = rectToCanvasQuad(crossSection.startRect, m);
        ctx.strokeStyle = '#5dffb0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(q[0].x, q[0].y);
        for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].x, q[i].y);
        ctx.closePath();
        ctx.stroke();
    }

    if (crossSection.endRect) {
        const q = rectToCanvasQuad(crossSection.endRect, m);
        ctx.strokeStyle = '#ff6a6a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(q[0].x, q[0].y);
        for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].x, q[i].y);
        ctx.closePath();
        ctx.stroke();
    }

    ctx.fillStyle = '#00ffff';
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`S=${S.toFixed(2)}  C=${C.toFixed(2)}  layer=${currentLayer + 1}  cells=${allCells}`, 8, 8);

    if (scanActive3d) {
        const p = worldPointToCanvas(player3d.x, player3d.y, m);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Render a debug-only preview of the center slice while scan is not active.
 */
function renderDebugPreview3d() {
    const S = getCenterSliceOffset();
    const cs = buildCrossSection(S);
    const m = getCanvasMapping3d();
    const prevSlice = sliceOffset;
    sliceOffset = S;

    scanCtx3d.fillStyle = '#0d1018';
    scanCtx3d.fillRect(0, 0, scanCanvas3d.width, scanCanvas3d.height);

    for (const r of cs.passable) drawQuad(rectToCanvasQuad(r, m), 'rgba(242,245,255,0.12)', 'rgba(97,118,191,0.4)');
    for (const r of cs.pathRects) drawQuad(rectToCanvasQuad(r, m), 'rgba(255,216,79,0.5)', 'rgba(255,216,79,0.8)');
    if (cs.startRect) drawQuad(rectToCanvasQuad(cs.startRect, m), 'rgba(93,255,176,0.26)', 'rgba(97,118,191,0.5)');
    if (cs.endRect) drawQuad(rectToCanvasQuad(cs.endRect, m), 'rgba(255,106,106,0.26)', 'rgba(97,118,191,0.5)');

    drawDebugOverlay3d(cs, m);
    sliceOffset = prevSlice;
}

/**
 * Update HUD readouts for scan position and current occupancy class.
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} cs
 */
function updateScanReadout3d(cs) {
    rowReadout.textContent = `S: ${sliceOffset.toFixed(2)}`;
    colReadout.textContent = `x: ${player3d.x.toFixed(2)}`;
    yReadout3d.textContent = `y: ${player3d.y.toFixed(2)}`;

    if (cs.startRect && pointInRect3d(player3d.x, player3d.y, cs.startRect)) return void (cellReadout.textContent = 'Cell: START');
    if (cs.endRect && pointInRect3d(player3d.x, player3d.y, cs.endRect)) return void (cellReadout.textContent = 'Cell: END');
    for (const r of cs.pathRects) {
        if (pointInRect3d(player3d.x, player3d.y, r)) return void (cellReadout.textContent = 'Cell: BFS PATH');
    }
    for (const r of cs.passable) {
        if (pointInRect3d(player3d.x, player3d.y, r)) return void (cellReadout.textContent = 'Cell: PATH');
    }
    cellReadout.textContent = 'Cell: VOID';
}

/**
 * Render the rotated cross-section with path/start/end coloring.
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} cs
 * @param {{scale:number,ox:number,oy:number}} m
 */
function drawCrossSectionRects3d(cs, m) {
    const ctx = scanCtx3d;
    ctx.fillStyle = '#0d1018';
    ctx.fillRect(0, 0, scanCanvas3d.width, scanCanvas3d.height);

    for (const r of cs.passable) drawQuad(rectToCanvasQuad(r, m), '#f2f5ff', 'rgba(97,118,191,0.40)');
    for (const r of cs.pathRects) drawQuad(rectToCanvasQuad(r, m), '#ffd84f', 'rgba(123,91,0,0.65)');
    if (cs.startRect) drawQuad(rectToCanvasQuad(cs.startRect, m), '#5dffb0', 'rgba(97,118,191,0.50)');
    if (cs.endRect) drawQuad(rectToCanvasQuad(cs.endRect, m), '#ff6a6a', 'rgba(97,118,191,0.50)');
}

/**
 * Draw the scanner avatar at its rotated on-screen position.
 * @param {{scale:number,ox:number,oy:number}} m
 */
function drawPlayer3d(m) {
    const ctx = scanCtx3d;
    const p = worldPointToCanvas(player3d.x, player3d.y, m);
    ctx.fillStyle = '#7dff2e';
    ctx.shadowColor = '#7dff2e';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(4, m.scale * PLAYER3D_RADIUS * 0.9), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

/**
 * Full scan render pass: geometry, avatar, optional debug, then readouts.
 */
function renderScan3d() {
    const cs = buildCrossSection(sliceOffset);
    const m = getCanvasMapping3d();
    drawCrossSectionRects3d(cs, m);
    drawPlayer3d(m);
    if (debugMode3d) drawDebugOverlay3d(cs, m);
    updateScanReadout3d(cs);
}
