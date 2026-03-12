// js/3d/render3d.js — Phase 3 Step 6: canvas mapping + debug overlay
// Full scan renderer added in Phase 5 (Step 9).

let worldToCanvas3d = null;

function worldToView3d(wx, wy) {
    // 45° rotation for scan presentation:
    // - Start corner appears on the left
    // - End corner appears on the right
    // - Top corner maps to back, bottom corner maps to front (vertical flip adjusted)
    return {
        vx: (wx + wy) / SQ2,
        vy: (wx - wy) / SQ2,
    };
}

function getCrossSectionViewBounds3d(cs) {
    const rects = [];
    for (const r of cs.walls) rects.push(r);
    for (const r of cs.passable) rects.push(r);
    if (cs.startRect) rects.push(cs.startRect);
    if (cs.endRect) rects.push(cs.endRect);

    if (!rects.length) return null;

    let minVx = Infinity, maxVx = -Infinity, minVy = Infinity, maxVy = -Infinity;
    for (const r of rects) {
        const corners = [
            worldToView3d(r.x0, r.y0),
            worldToView3d(r.x1, r.y0),
            worldToView3d(r.x1, r.y1),
            worldToView3d(r.x0, r.y1),
        ];
        for (const c of corners) {
            if (c.vx < minVx) minVx = c.vx;
            if (c.vx > maxVx) maxVx = c.vx;
            if (c.vy < minVy) minVy = c.vy;
            if (c.vy > maxVy) maxVy = c.vy;
        }
    }
    return { minVx, maxVx, minVy, maxVy };
}

function getCanvasMapping3d(cs = null) {
    const N = gridSize3d;
    const cw = scanCanvas3d.width;
    const ch = scanCanvas3d.height;
    const pad = 24;

    // Keep scale stable based on full world extents so movement doesn't zoom.
    const worldCorners = [
        worldToView3d(0, -N / SQ2),
        worldToView3d(0, N / SQ2),
        worldToView3d(N * SQ2, -N / SQ2),
        worldToView3d(N * SQ2, N / SQ2),
    ];
    const worldMinVx = Math.min(...worldCorners.map(c => c.vx));
    const worldMaxVx = Math.max(...worldCorners.map(c => c.vx));
    const worldMinVy = Math.min(...worldCorners.map(c => c.vy));
    const worldMaxVy = Math.max(...worldCorners.map(c => c.vy));

    const worldW = worldMaxVx - worldMinVx;
    const worldH = worldMaxVy - worldMinVy;
    const scale = Math.min((cw - 2 * pad) / worldW, (ch - 2 * pad) / worldH);

    // Recenter camera on current visible cross-section so slice stays centered.
    const csBounds = cs ? getCrossSectionViewBounds3d(cs) : null;
    const centerVx = csBounds ? (csBounds.minVx + csBounds.maxVx) * 0.5 : (worldMinVx + worldMaxVx) * 0.5;
    const centerVy = csBounds ? (csBounds.minVy + csBounds.maxVy) * 0.5 : (worldMinVy + worldMaxVy) * 0.5;

    const ox = cw * 0.5 - centerVx * scale;
    const oy = ch * 0.5 + centerVy * scale;

    worldToCanvas3d = { scale, ox, oy, minVx: worldMinVx, maxVx: worldMaxVx, minVy: worldMinVy, maxVy: worldMaxVy };
    return worldToCanvas3d;
}

function worldPointToCanvas3d(wx, wy, m) {
    const v = worldToView3d(wx, wy);
    return {
        x: m.ox + v.vx * m.scale,
        y: m.oy - v.vy * m.scale,
    };
}

function rectToCanvasPoly(r, m) {
    return [
        worldPointToCanvas3d(r.x0, r.y0, m),
        worldPointToCanvas3d(r.x1, r.y0, m),
        worldPointToCanvas3d(r.x1, r.y1, m),
        worldPointToCanvas3d(r.x0, r.y1, m),
    ];
}

function drawPoly(ctx, pts, fill, stroke = null, lineWidth = 1) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

function drawDebugOverlay3d(crossSection, m) {
    const ctx = scanCtx3d;
    const S = sliceOffset;
    const C = S * SQ2;
    const allCells = crossSection.walls.length + crossSection.passable.length
        + (crossSection.startRect ? 1 : 0) + (crossSection.endRect ? 1 : 0);

    ctx.save();

    for (const r of crossSection.walls) {
        drawPoly(ctx, rectToCanvasPoly(r, m), null, '#8b2b2b', 1);
    }
    for (const r of crossSection.passable) {
        drawPoly(ctx, rectToCanvasPoly(r, m), null, '#00ffff', 1);
    }

    if (crossSection.startRect) drawPoly(ctx, rectToCanvasPoly(crossSection.startRect, m), null, '#5dffb0', 2);
    if (crossSection.endRect) drawPoly(ctx, rectToCanvasPoly(crossSection.endRect, m), null, '#ff6a6a', 2);

    ctx.fillStyle = '#00ffff';
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`S=${S.toFixed(2)}  C=${C.toFixed(2)}  cells=${allCells}`, 8, 8);

    if (scanActive3d) {
        const p = worldPointToCanvas3d(player3d.x, player3d.y, m);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

function renderDebugPreview3d() {
    const S = getCenterSliceOffset();
    const cs = buildCrossSection(S);
    const m = getCanvasMapping3d(cs);

    const prevSlice = sliceOffset;
    sliceOffset = S;

    const ctx = scanCtx3d;
    ctx.fillStyle = '#0d1018';
    ctx.fillRect(0, 0, scanCanvas3d.width, scanCanvas3d.height);

    for (const r of cs.walls) drawPoly(ctx, rectToCanvasPoly(r, m), 'rgba(12,15,24,0.8)');
    for (const r of cs.passable) drawPoly(ctx, rectToCanvasPoly(r, m), 'rgba(242,245,255,0.12)');
    if (cs.startRect) drawPoly(ctx, rectToCanvasPoly(cs.startRect, m), 'rgba(93,255,176,0.20)');
    if (cs.endRect) drawPoly(ctx, rectToCanvasPoly(cs.endRect, m), 'rgba(255,106,106,0.20)');

    drawDebugOverlay3d(cs, m);
    sliceOffset = prevSlice;
}

function updateScanReadout3d(cs) {
    rowReadout.textContent = `S: ${sliceOffset.toFixed(2)}`;
    colReadout.textContent = `x: ${player3d.x.toFixed(2)}`;
    yReadout3d.textContent = `y: ${player3d.y.toFixed(2)}`;

    if (cs.startRect && pointInRect3d(player3d.x, player3d.y, cs.startRect)) return void (cellReadout.textContent = 'Cell: START');
    if (cs.endRect && pointInRect3d(player3d.x, player3d.y, cs.endRect)) return void (cellReadout.textContent = 'Cell: END');
    for (const r of cs.passable) {
        if (pointInRect3d(player3d.x, player3d.y, r)) return void (cellReadout.textContent = 'Cell: PATH');
    }
    cellReadout.textContent = 'Cell: VOID';
}

function drawCrossSectionRects3d(cs, m) {
    const ctx = scanCtx3d;
    ctx.fillStyle = '#0d1018';
    ctx.fillRect(0, 0, scanCanvas3d.width, scanCanvas3d.height);

    for (const r of cs.walls) drawPoly(ctx, rectToCanvasPoly(r, m), '#0c0f18', 'rgba(97,118,191,0.35)', 1);
    for (const r of cs.passable) drawPoly(ctx, rectToCanvasPoly(r, m), '#f2f5ff', 'rgba(97,118,191,0.4)', 1);
    if (cs.startRect) drawPoly(ctx, rectToCanvasPoly(cs.startRect, m), '#5dffb0', 'rgba(97,118,191,0.5)', 1);
    if (cs.endRect) drawPoly(ctx, rectToCanvasPoly(cs.endRect, m), '#ff6a6a', 'rgba(97,118,191,0.5)', 1);
}

function drawPlayer3d(m) {
    const ctx = scanCtx3d;
    const p = worldPointToCanvas3d(player3d.x, player3d.y, m);
    ctx.fillStyle = '#7dff2e';
    ctx.shadowColor = '#7dff2e';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(4, m.scale * PLAYER3D_RADIUS * 0.9), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function renderScan3d() {
    const cs = buildCrossSection(sliceOffset);
    const m = getCanvasMapping3d(cs);
    drawCrossSectionRects3d(cs, m);
    drawPlayer3d(m);
    if (debugMode3d) drawDebugOverlay3d(cs, m);
    updateScanReadout3d(cs);
}

function updateScanReadout3d(cs) {
    rowReadout.textContent = `S: ${sliceOffset.toFixed(2)}`;
    colReadout.textContent = `x: ${player3d.x.toFixed(2)}`;
    yReadout3d.textContent = `y: ${player3d.y.toFixed(2)}`;

    if (cs.startRect && pointInRect3d(player3d.x, player3d.y, cs.startRect)) {
        cellReadout.textContent = 'Cell: START';
        return;
    }
    if (cs.endRect && pointInRect3d(player3d.x, player3d.y, cs.endRect)) {
        cellReadout.textContent = 'Cell: END';
        return;
    }
    for (const r of cs.passable) {
        if (pointInRect3d(player3d.x, player3d.y, r)) {
            cellReadout.textContent = 'Cell: PATH';
            return;
        }
    }
    cellReadout.textContent = 'Cell: VOID';
}

function drawCrossSectionRects3d(cs, m) {
    const ctx = scanCtx3d;
    ctx.fillStyle = '#0d1018';
    ctx.fillRect(0, 0, scanCanvas3d.width, scanCanvas3d.height);

    ctx.fillStyle = '#f2f5ff';
    for (const r of cs.passable) {
        const c = rectToCanvas(r, m);
        ctx.fillRect(c.cx0, c.cy0, c.cw, c.ch);
        ctx.strokeStyle = 'rgba(97,118,191,0.4)';
        ctx.strokeRect(c.cx0, c.cy0, c.cw, c.ch);
    }

    if (cs.startRect) {
        const c = rectToCanvas(cs.startRect, m);
        ctx.fillStyle = '#5dffb0';
        ctx.fillRect(c.cx0, c.cy0, c.cw, c.ch);
        ctx.strokeStyle = 'rgba(97,118,191,0.5)';
        ctx.strokeRect(c.cx0, c.cy0, c.cw, c.ch);
    }
    if (cs.endRect) {
        const c = rectToCanvas(cs.endRect, m);
        ctx.fillStyle = '#ff6a6a';
        ctx.fillRect(c.cx0, c.cy0, c.cw, c.ch);
        ctx.strokeStyle = 'rgba(97,118,191,0.5)';
        ctx.strokeRect(c.cx0, c.cy0, c.cw, c.ch);
    }
}

function drawPlayer3d(m) {
    const ctx = scanCtx3d;
    const px = wxToCanvas(player3d.x, m);
    const py = wyToCanvas(player3d.y, m);
    ctx.fillStyle = '#7dff2e';
    ctx.shadowColor = '#7dff2e';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(4, m.scale * PLAYER3D_RADIUS * 0.9), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function renderScan3d() {
    const cs = buildCrossSection(sliceOffset);
    const m = getCanvasMapping3d();
    drawCrossSectionRects3d(cs, m);
    drawPlayer3d(m);
    if (debugMode3d) drawDebugOverlay3d(cs, m);
    updateScanReadout3d(cs);
}
