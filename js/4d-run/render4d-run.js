function render4dRunSummary() {
    const el = document.getElementById('run4dSummary');
    if (!el) return;
    if (!run4dState.mapParam) {
        el.textContent = 'No `map4d` parameter detected yet. Open this route from a real shared 4D URL to verify decode, BFS behavior, and the same continuous hyper-slice data model in-browser.';
        return;
    }

    const outcome = run4dState.solvable
        ? `Map decoded successfully. BFS found a route in ${run4dState.bfsPath.length} cells.`
        : 'Map decoded successfully, but BFS did not find a valid route.';
    el.textContent = `${outcome} This route now embodies that same 4D maze state in first-person instead of leaving it in editor view.`;
}

function render4dRunMetrics() {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    if (!run4dState.mapParam || !run4dState.grid) {
        setText('run4dGridSize', '--');
        setText('run4dSolvable', 'Awaiting map');
        setText('run4dCellCount', '--');
        setText('run4dPathLength', '--');
        setText('run4dMapSource', 'No URL parameter found.');
        setText('run4dMapMeta', 'Open this page with `?map4d=...` to run the route.');
        setText('run4dOverviewCaption', 'No map loaded yet.');
        setText('run4dPointerState', 'Awaiting map');
        setText('run4dViewMode', 'Opaque nav');
        setText('run4dCompletionState', 'Not reached');
        setText('run4dPlayerPos', '--');
        setText('run4dReadHint', 'White surfaces are your immediate local structure. Dark space is void. Hold `LMB` when you need a temporary x-ray peek into upcoming geometry.');
        updateChecklist4dRun();
        return;
    }

    const totalCells = run4dState.gridSize ** 4;
    const walkableCells = totalCells - run4dState.wallCount;
    setText('run4dGridSize', `${run4dState.gridSize} x ${run4dState.gridSize} x ${run4dState.gridSize} x ${run4dState.gridSize}`);
    setText('run4dSolvable', run4dState.solvable ? 'Solvable' : 'Blocked');
    setText('run4dCellCount', `${walkableCells}/${totalCells}`);
    setText('run4dPathLength', run4dState.bfsPath ? String(run4dState.bfsPath.length) : '0');
    setText('run4dMapSource', `${run4dState.mapSource} (${run4dState.mapParam.length} chars)`);
    setText(
        'run4dMapMeta',
        `Walls: ${run4dState.wallCount}. Start = (0,0,0,${run4dState.gridSize - 1}), End = (${run4dState.gridSize - 1},${run4dState.gridSize - 1},${run4dState.gridSize - 1},0). Layer ${run4dState.hyperLayer + 1}. Slice S = ${run4dState.hyperSliceOffset.toFixed(2)}.`
    );
    setText(
        'run4dOverviewCaption',
        'First-person route through the current 4D hyper-slice. White = walkable space, gold = BFS hint, green/red = anchors.'
    );
    setText('run4dPointerState', run4dState.pointerLocked ? 'Mouse look active' : 'Click view to lock');
    setText('run4dViewMode', run4dState.xrayHeld ? 'X-ray held' : 'Opaque nav');
    setText('run4dCompletionState', run4dState.completed ? 'Finish reached' : 'Not reached');
    setText('run4dPlayerPos', `(${run4dState.player.x.toFixed(2)}, ${run4dState.player.y.toFixed(2)}, ${run4dState.player.z.toFixed(2)})`);
    setText(
        'run4dReadHint',
        run4dState.xrayHeld
            ? 'X-ray is temporarily active. Use it to inspect upcoming halls, shafts, and slice changes, then release to return to solid local navigation.'
            : 'White surfaces are your immediate local structure. Dark space is void. Hold `LMB` only when you need to peek through future geometry.'
    );
    updateChecklist4dRun();
}

function updateChecklist4dRun() {
    const setCheck = (id, state) => {
        const el = document.getElementById(id);
        if (!el) return;
        let color = '#d7e4ff';
        let prefix = '[ ]';
        if (state === 'pass') {
            color = '#5dffb0';
            prefix = '[PASS]';
        } else if (state === 'fail') {
            color = '#ff9b9b';
            prefix = '[FAIL]';
        }
        el.style.color = color;
        const original = el.getAttribute('data-base-text') || el.textContent.replace(/^\[[A-Z ]+\]\s*/, '');
        if (!el.getAttribute('data-base-text')) el.setAttribute('data-base-text', original);
        el.textContent = `${prefix} ${original}`;
    };

    setCheck('run4dCheckBoot', 'pass');
    setCheck('run4dCheckMap4d', !!run4dState.grid ? 'pass' : 'pending');
    setCheck('run4dCheckOverview', !!run4dState.grid ? 'pass' : 'pending');
}

function cameraSpacePoint4dRun(point, camera) {
    const dx = point.x - camera.pos.x;
    const dy = point.y - camera.pos.y;
    const dz = point.z - camera.pos.z;

    return {
        cx: dx * camera.right.x + dy * camera.right.y + dz * camera.right.z,
        cy: dx * camera.up.x + dy * camera.up.y + dz * camera.up.z,
        cz: dx * camera.forward.x + dy * camera.forward.y + dz * camera.forward.z,
    };
}

function projectPoint4dRun(point, camera, canvas) {
    const view = cameraSpacePoint4dRun(point, camera);
    if (view.cz <= -0.6) return null;
    const cz = Math.max(0.02, view.cz);
    const focal = Math.min(canvas.width, canvas.height) * 0.74;
    return {
        x: canvas.width * 0.5 + (view.cx / cz) * focal,
        y: canvas.height * 0.5 - (view.cy / cz) * focal,
        depth: cz,
    };
}

function clipPolygonToNearPlane4dRun(points, nearZ) {
    if (!points.length) return [];
    const clipped = [];
    for (let i = 0; i < points.length; i++) {
        const cur = points[i];
        const prev = points[(i + points.length - 1) % points.length];
        const curInside = cur.cz >= nearZ;
        const prevInside = prev.cz >= nearZ;

        if (curInside !== prevInside) {
            const t = (nearZ - prev.cz) / (cur.cz - prev.cz);
            clipped.push({
                cx: prev.cx + (cur.cx - prev.cx) * t,
                cy: prev.cy + (cur.cy - prev.cy) * t,
                cz: nearZ,
            });
        }
        if (curInside) clipped.push(cur);
    }
    return clipped;
}

function projectClippedFace4dRun(faceQuad, camera, canvas) {
    const nearZ = 0.02;
    const cameraPoints = faceQuad
        .map((point) => cameraSpacePoint4dRun(point, camera))
        .filter((point) => point.cz > -0.6);
    if (cameraPoints.length < 3) return null;

    const clipped = clipPolygonToNearPlane4dRun(cameraPoints, nearZ);
    if (clipped.length < 3) return null;

    const focal = Math.min(canvas.width, canvas.height) * 0.74;
    const projected = clipped.map((point) => ({
        x: canvas.width * 0.5 + (point.cx / point.cz) * focal,
        y: canvas.height * 0.5 - (point.cy / point.cz) * focal,
        depth: point.cz,
    }));

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of projected) {
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const areaLike = width * height;
    if ((width < 1.5 || height < 1.5) && areaLike < 24) return null;

    return projected;
}

function buildCamera4dRun() {
    const px = run4dState.player.x;
    const py = run4dState.player.y;
    const pz = run4dState.player.z;
    const yaw = run4dState.yaw;
    const pitch = run4dState.pitch;
    const forward = {
        x: Math.sin(yaw) * Math.cos(pitch),
        y: Math.cos(yaw) * Math.cos(pitch),
        z: Math.sin(pitch),
    };
    const forwardLen = Math.hypot(forward.x, forward.y, forward.z) || 1;
    forward.x /= forwardLen;
    forward.y /= forwardLen;
    forward.z /= forwardLen;

    const eye = {
        x: px,
        y: py,
        z: pz,
    };
    const worldUp = { x: 0, y: 0, z: 1 };
    let right = {
        x: forward.y * worldUp.z - forward.z * worldUp.y,
        y: forward.z * worldUp.x - forward.x * worldUp.z,
        z: forward.x * worldUp.y - forward.y * worldUp.x,
    };
    const rightLen = Math.hypot(right.x, right.y, right.z) || 1;
    right.x /= rightLen;
    right.y /= rightLen;
    right.z /= rightLen;

    const up = {
        x: right.y * forward.z - right.z * forward.y,
        y: right.z * forward.x - right.x * forward.z,
        z: right.x * forward.y - right.y * forward.x,
    };

    return { pos: eye, forward, right, up };
}

function boxToFaces4dRun(box) {
    const x0 = box.x0;
    const x1 = box.x1;
    const y0 = box.y0;
    const y1 = box.y1;
    const z0 = box.z0;
    const z1 = box.z1;
    return [
        {
            normal: { x: 0, y: -1, z: 0 },
            center: { x: (x0 + x1) * 0.5, y: y0, z: (z0 + z1) * 0.5 },
            quad: [{ x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y0, z: z1 }, { x: x0, y: y0, z: z1 }],
        },
        {
            normal: { x: 0, y: 1, z: 0 },
            center: { x: (x0 + x1) * 0.5, y: y1, z: (z0 + z1) * 0.5 },
            quad: [{ x: x0, y: y1, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x1, y: y1, z: z1 }, { x: x0, y: y1, z: z1 }],
        },
        {
            normal: { x: 0, y: 0, z: -1 },
            center: { x: (x0 + x1) * 0.5, y: (y0 + y1) * 0.5, z: z0 },
            quad: [{ x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x0, y: y1, z: z0 }],
        },
        {
            normal: { x: 1, y: 0, z: 0 },
            center: { x: x1, y: (y0 + y1) * 0.5, z: (z0 + z1) * 0.5 },
            quad: [{ x: x1, y: y0, z: z0 }, { x: x1, y: y0, z: z1 }, { x: x1, y: y1, z: z1 }, { x: x1, y: y1, z: z0 }],
        },
        {
            normal: { x: 0, y: 0, z: 1 },
            center: { x: (x0 + x1) * 0.5, y: (y0 + y1) * 0.5, z: z1 },
            quad: [{ x: x1, y: y0, z: z1 }, { x: x0, y: y0, z: z1 }, { x: x0, y: y1, z: z1 }, { x: x1, y: y1, z: z1 }],
        },
        {
            normal: { x: -1, y: 0, z: 0 },
            center: { x: x0, y: (y0 + y1) * 0.5, z: (z0 + z1) * 0.5 },
            quad: [{ x: x0, y: y0, z: z1 }, { x: x0, y: y0, z: z0 }, { x: x0, y: y1, z: z0 }, { x: x0, y: y1, z: z1 }],
        },
    ];
}

function drawQuad4dRun(ctx, quad, fillStyle, strokeStyle) {
    ctx.beginPath();
    ctx.moveTo(quad[0].x, quad[0].y);
    for (let i = 1; i < quad.length; i++) ctx.lineTo(quad[i].x, quad[i].y);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1.8;
        ctx.stroke();
    }
}

function drawFinishFrame4dRun(ctx, quad, color, glowColor) {
    if (!quad || quad.length < 3) return;
    const cx = quad.reduce((sum, p) => sum + p.x, 0) / quad.length;
    const cy = quad.reduce((sum, p) => sum + p.y, 0) / quad.length;
    const inset = 0.14;
    const inner = quad.map((p) => ({
        x: p.x + (cx - p.x) * inset,
        y: p.y + (cy - p.y) * inset,
    }));

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(inner[0].x, inner[0].y);
    for (let i = 1; i < inner.length; i++) ctx.lineTo(inner[i].x, inner[i].y);
    ctx.closePath();
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(inner[0].x, inner[0].y);
    for (let i = 1; i < inner.length; i++) ctx.lineTo(inner[i].x, inner[i].y);
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
}

function drawFinishStripes4dRun(ctx, quad, color) {
    if (!quad || quad.length !== 4) return;
    const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const stripeTs = [0.24, 0.5, 0.76];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (const t of stripeTs) {
        const p0 = lerp(quad[0], quad[1], t);
        const p1 = lerp(quad[3], quad[2], t);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
    }
    ctx.restore();
}

function drawRoundedHud4dRun(ctx, x, y, w, h, fill, stroke) {
    const r = 14;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

function drawCompletionCelebration4dRun(ctx, canvas, pulse) {
    if (pulse <= 0.001) return;
    const t = Math.max(0, Math.min(1, pulse / 1.35));
    const alpha = smoothStep4dRun(t);
    const fade = Math.max(0, Math.min(1, pulse / 0.95));

    drawRoundedHud4dRun(
        ctx,
        canvas.width * 0.5 - 230,
        canvas.height * 0.5 - 56,
        460,
        104,
        `rgba(10,18,24,${(0.28 * alpha).toFixed(3)})`,
        `rgba(255,220,120,${(0.24 * alpha).toFixed(3)})`
    );
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,247,220,${(0.95 * alpha).toFixed(3)})`;
    ctx.font = '800 28px system-ui';
    ctx.fillText('FINISH', canvas.width * 0.5, canvas.height * 0.5 - 8);
    ctx.font = '700 15px system-ui';
    ctx.fillStyle = `rgba(223,255,238,${(0.88 * alpha).toFixed(3)})`;
    ctx.fillText('Crossed the glowing boundary', canvas.width * 0.5, canvas.height * 0.5 + 20);

    const colors = ['#ffe27a', '#ff8f70', '#7afcff', '#5dffb0', '#fff5d1'];
    const confettiCount = 56;
    ctx.save();
    for (let i = 0; i < confettiCount; i++) {
        const phase = i / confettiCount;
        const angle = phase * Math.PI * 4 + 0.25;
        const radial = 54 + phase * 130;
        const drift = (1 - fade) * 74;
        const x = canvas.width * 0.5 + Math.cos(angle) * (radial + drift * 0.55);
        const y = canvas.height * 0.5 - 10 + Math.sin(angle) * (radial * 0.35 + drift) - (1 - fade) * 26;
        const w = 8 + (i % 4);
        const h = 5 + (i % 3);
        ctx.translate(x, y);
        ctx.rotate(angle + (1 - fade) * 2.4);
        ctx.fillStyle = colors[i % colors.length] + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.restore();
}

function withAlpha4dRun(color, alpha) {
    const match = color.match(/^rgba\(([^,]+),([^,]+),([^,]+),([^)]+)\)$/);
    if (!match) return color;
    return `rgba(${match[1].trim()},${match[2].trim()},${match[3].trim()},${alpha.toFixed(3)})`;
}

function smoothStep4dRun(t) {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped * clamped * (3 - 2 * clamped);
}

function getVisualSliceOffset4dRun(sliceOffset) {
    const scaled = sliceOffset * RUN4D_SQ2;
    const target = Math.round(scaled);
    const delta = target - scaled;
    const absDelta = Math.abs(delta);

    // Only collapse very small residual slivers; leave ordinary partial intersections intact.
    const snapOuter = 0.055;
    const snapInner = 0.018;
    if (absDelta >= snapOuter) return sliceOffset;
    if (absDelta <= snapInner) return target / RUN4D_SQ2;

    const t = smoothStep4dRun((snapOuter - absDelta) / (snapOuter - snapInner));
    return (scaled + delta * t) / RUN4D_SQ2;
}

function pointInBoxRender4dRun(x, y, z, box) {
    const eps = 0.002;
    return x >= box.x0 - eps && x <= box.x1 + eps
        && y >= box.y0 - eps && y <= box.y1 + eps
        && z >= box.z0 - eps && z <= box.z1 + eps;
}

function pointPassableRender4dRun(x, y, z, cs) {
    if (!cs) return false;
    if (cs.startBox && pointInBoxRender4dRun(x, y, z, cs.startBox)) return true;
    if (cs.endBox && pointInBoxRender4dRun(x, y, z, cs.endBox)) return true;
    for (const box of cs.passable) {
        if (pointInBoxRender4dRun(x, y, z, box)) return true;
    }
    return false;
}

function render4dRunOverview() {
    const canvas = document.getElementById('run4dOverviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cssWidth = canvas.clientWidth || 1100;
    const cssHeight = canvas.clientHeight || 760;
    if (canvas.width !== cssWidth || canvas.height !== cssHeight) {
        canvas.width = cssWidth;
        canvas.height = cssHeight;
    }

    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#10172a');
    sky.addColorStop(0.36, '#08101b');
    sky.addColorStop(1, '#020305');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const vignette = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.48, canvas.height * 0.12, canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.7);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.30)');

    if (!run4dState.grid || !run4dState.crossSection) {
        ctx.fillStyle = '#9db1d8';
        ctx.font = '600 22px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Load a 4D shared map to inhabit the decoded hyper-slice.', canvas.width / 2, canvas.height / 2 - 6);
        ctx.font = '16px system-ui';
        ctx.fillStyle = 'rgba(157,177,216,0.82)';
        ctx.fillText('This route will turn the current 4D cross-section into first-person traversal.', canvas.width / 2, canvas.height / 2 + 28);
        return;
    }

    const renderSliceOffset = getVisualSliceOffset4dRun(run4dState.hyperSliceOffset);
    const renderCrossSection = buildCrossSection4dRun(run4dState.grid, renderSliceOffset, run4dState.bfsPath);
    const camera = buildCamera4dRun();
    const drawables = [];
    const pushBox = (box, palette) => {
        const faces = boxToFaces4dRun(box);
        for (const face of faces) {
            const sample = {
                x: face.center.x + face.normal.x * 0.02,
                y: face.center.y + face.normal.y * 0.02,
                z: face.center.z + face.normal.z * 0.02,
            };
            const passThroughFace = pointPassableRender4dRun(sample.x, sample.y, sample.z, renderCrossSection);

            const centerDx = face.center.x - camera.pos.x;
            const centerDy = face.center.y - camera.pos.y;
            const centerDz = face.center.z - camera.pos.z;
            const centerDepth = centerDx * camera.forward.x + centerDy * camera.forward.y + centerDz * camera.forward.z;
            if (centerDepth <= 0.02) continue;

            const projected = projectClippedFace4dRun(face.quad, camera, canvas);
            if (!projected) continue;
            const avgDepth = projected.reduce((sum, p) => sum + p.depth, 0) / projected.length;
            const maxDepth = projected.reduce((best, p) => Math.max(best, p.depth), -Infinity);
            let fill = palette.wall;
            let edge = palette.edge;
            if (face.normal.z > 0.5) {
                fill = palette.ceiling;
            } else if (face.normal.z < -0.5) {
                fill = palette.floor;
            }
            if (passThroughFace && !palette.finishThrough) continue;
            drawables.push({
                projected,
                avgDepth,
                maxDepth,
                fill: passThroughFace ? null : fill,
                edge: passThroughFace ? null : edge,
                finishFrame: !!palette.finishFrame,
                finishStripe: !!palette.finishStripe,
                finishThrough: !!passThroughFace && !!palette.finishThrough,
            });
        }
    };

    const xray = run4dState.xrayHeld;
    const alphaProfile = xray
        ? { floor: 0.95, wall: 0.42, ceiling: 0.26, edge: 0.10 }
        : { floor: 1.0, wall: 0.96, ceiling: 0.95, edge: 0.30 };
    const basePalette = {
        floor: withAlpha4dRun('rgba(245,247,255,0.94)', alphaProfile.floor),
        wall: withAlpha4dRun('rgba(198,210,228,0.42)', alphaProfile.wall),
        ceiling: withAlpha4dRun('rgba(176,186,204,0.26)', alphaProfile.ceiling),
        edge: withAlpha4dRun('rgba(38,46,60,0.40)', alphaProfile.edge),
    };
    const pathPalette = {
        floor: withAlpha4dRun('rgba(255,216,79,0.95)', alphaProfile.floor),
        wall: withAlpha4dRun('rgba(202,154,36,0.40)', alphaProfile.wall),
        ceiling: withAlpha4dRun('rgba(184,136,24,0.24)', alphaProfile.ceiling),
        edge: withAlpha4dRun('rgba(92,66,16,0.44)', alphaProfile.edge),
    };
    const startPalette = {
        floor: withAlpha4dRun('rgba(93,255,176,0.96)', alphaProfile.floor),
        wall: withAlpha4dRun('rgba(50,150,100,0.42)', alphaProfile.wall),
        ceiling: withAlpha4dRun('rgba(36,122,78,0.24)', alphaProfile.ceiling),
        edge: withAlpha4dRun('rgba(20,72,48,0.44)', alphaProfile.edge),
    };
    const endPalette = {
        floor: withAlpha4dRun('rgba(255,106,106,0.96)', alphaProfile.floor),
        wall: withAlpha4dRun('rgba(150,58,58,0.42)', alphaProfile.wall),
        ceiling: withAlpha4dRun('rgba(126,44,44,0.24)', alphaProfile.ceiling),
        edge: withAlpha4dRun('rgba(84,28,28,0.44)', alphaProfile.edge),
        finishFrame: true,
        finishStripe: true,
        finishThrough: true,
    };

    const pathSet = new Set(renderCrossSection.pathBoxes.map((box) => `${box.x0}|${box.x1}|${box.y0}|${box.y1}|${box.z0}|${box.z1}`));
    for (const box of renderCrossSection.passable) {
        const key = `${box.x0}|${box.x1}|${box.y0}|${box.y1}|${box.z0}|${box.z1}`;
        pushBox(box, pathSet.has(key) ? pathPalette : basePalette);
    }
    if (renderCrossSection.startBox) pushBox(renderCrossSection.startBox, startPalette);
    if (renderCrossSection.endBox) pushBox(renderCrossSection.endBox, endPalette);

    drawables.sort((a, b) => (b.maxDepth - a.maxDepth) || (b.avgDepth - a.avgDepth));
    for (const item of drawables) {
        if (item.fill) drawQuad4dRun(ctx, item.projected, item.fill, item.edge);
        if (item.finishFrame) {
            drawFinishFrame4dRun(
                ctx,
                item.projected,
                item.finishThrough ? 'rgba(255,236,176,0.98)' : 'rgba(255,242,199,0.95)',
                item.finishThrough ? 'rgba(255,210,120,0.26)' : 'rgba(255,120,120,0.22)'
            );
        }
        if (item.finishStripe) {
            drawFinishStripes4dRun(ctx, item.projected, item.finishThrough ? 'rgba(255,226,150,0.82)' : 'rgba(255,232,184,0.68)');
        }
    }

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const playerBase = projectPoint4dRun({ x: run4dState.player.x, y: run4dState.player.y, z: run4dState.player.z - 0.2 }, camera, canvas);
    if (playerBase) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(playerBase.x, playerBase.y + 1.5, 15, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawRoundedHud4dRun(ctx, 18, 18, 462, 136, 'rgba(6,10,18,0.84)', 'rgba(122,252,255,0.14)');
    ctx.fillStyle = '#e8f5ff';
    ctx.font = '700 14px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('4D First-Person Traversal', 32, 42);
    ctx.font = '13px system-ui';
    ctx.fillStyle = '#9db1d8';
    ctx.fillText(`S ${run4dState.hyperSliceOffset.toFixed(2)}  |  layer ${run4dState.hyperLayer + 1}  |  yaw ${(run4dState.yaw * 180 / Math.PI).toFixed(1)} deg`, 32, 64);
    ctx.fillText(`pitch ${(run4dState.pitch * 180 / Math.PI).toFixed(1)} deg  |  ${run4dState.pointerLocked ? 'mouse look active' : 'click to lock mouse'}`, 32, 84);
    ctx.fillText(`pos (${run4dState.player.x.toFixed(2)}, ${run4dState.player.y.toFixed(2)}, ${run4dState.player.z.toFixed(2)})  |  ${xray ? 'LMB x-ray active' : 'hold LMB for x-ray'}`, 32, 104);
    ctx.fillText(`Open volume is air. Black is void. Q/E morphs the 4th dimension continuously.`, 32, 124);

    const modeBadge = xray ? { text: 'X-RAY HELD', fill: 'rgba(255,216,79,0.18)', stroke: 'rgba(255,216,79,0.42)', textColor: '#ffe8a6' }
        : { text: 'OPAQUE NAV', fill: 'rgba(122,252,255,0.14)', stroke: 'rgba(122,252,255,0.34)', textColor: '#dffbff' };
    drawRoundedHud4dRun(ctx, canvas.width - 180, 18, 146, 34, modeBadge.fill, modeBadge.stroke);
    ctx.fillStyle = modeBadge.textColor;
    ctx.textAlign = 'center';
    ctx.font = '700 12px system-ui';
    ctx.fillText(modeBadge.text, canvas.width - 107, 40);

    if (run4dState.shiftPulse > 0.01) {
        const shiftLabel = run4dState.shiftDirection >= 0 ? 'SHIFTING +W' : 'SHIFTING -W';
        const alpha = Math.min(0.9, run4dState.shiftPulse * 0.9);
        drawRoundedHud4dRun(
            ctx,
            canvas.width - 208,
            60,
            174,
            34,
            `rgba(93,255,176,${(0.10 + alpha * 0.18).toFixed(3)})`,
            `rgba(93,255,176,${(0.20 + alpha * 0.30).toFixed(3)})`
        );
        ctx.fillStyle = `rgba(223,255,238,${(0.75 + alpha * 0.25).toFixed(3)})`;
        ctx.fillText(shiftLabel, canvas.width - 121, 82);

        const laneW = 10;
        const laneGap = 7;
        const laneHeight = canvas.height * 0.18;
        const laneY = canvas.height * 0.5 - laneHeight * 0.5;
        const leftX = 26;
        const rightX = canvas.width - 26 - laneW;
        const laneAlpha = (0.04 + run4dState.shiftPulse * 0.14).toFixed(3);
        ctx.fillStyle = `rgba(93,255,176,${laneAlpha})`;
        ctx.fillRect(leftX, laneY, laneW, laneHeight);
        ctx.fillRect(leftX + laneW + laneGap, laneY + 18, laneW, laneHeight - 36);
        ctx.fillRect(rightX, laneY, laneW, laneHeight);
        ctx.fillRect(rightX - laneW - laneGap, laneY + 18, laneW, laneHeight - 36);
    }

    if (run4dState.completed) {
        drawRoundedHud4dRun(
            ctx,
            canvas.width * 0.5 - 254,
            22,
            508,
            58,
            'rgba(93,255,176,0.12)',
            'rgba(93,255,176,0.42)'
        );
        ctx.fillStyle = '#dfffee';
        ctx.textAlign = 'center';
        ctx.font = '800 18px system-ui';
        ctx.fillText('Hyper-slice complete: crossed the finish boundary.', canvas.width * 0.5, 58);
    }

    if (run4dState.completionPulse > 0.001) {
        drawCompletionCelebration4dRun(ctx, canvas, run4dState.completionPulse);
    }

    if (!run4dState.pointerLocked) {
        drawRoundedHud4dRun(ctx, canvas.width * 0.5 - 244, canvas.height - 74, 488, 52, 'rgba(255,255,255,0.05)', null);
        ctx.fillStyle = '#dff5ff';
        ctx.textAlign = 'center';
        ctx.font = '600 13px system-ui';
        ctx.fillText('Click in the view to enable first-person mouse look', canvas.width * 0.5, canvas.height - 52);
        ctx.fillText('Then use WASD, Space/Shift, Q/E, and hold LMB for temporary x-ray', canvas.width * 0.5, canvas.height - 34);
    } else {
        ctx.strokeStyle = 'rgba(122,252,255,0.8)';
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.5 - 8, canvas.height * 0.5);
        ctx.lineTo(canvas.width * 0.5 + 8, canvas.height * 0.5);
        ctx.moveTo(canvas.width * 0.5, canvas.height * 0.5 - 8);
        ctx.lineTo(canvas.width * 0.5, canvas.height * 0.5 + 8);
        ctx.stroke();
    }
}

function render4dRunFrame() {
    if (run4dState.grid) {
        run4dState.crossSection = buildCrossSection4dRun(run4dState.grid, run4dState.hyperSliceOffset, run4dState.bfsPath);
    }
    render4dRunMetrics();
    render4dRunOverview();
}

function tick4dRun(ts) {
    if (!run4dState.lastFrameAt) run4dState.lastFrameAt = ts;
    const dt = Math.min(0.05, (ts - run4dState.lastFrameAt) / 1000);
    run4dState.lastFrameAt = ts;
    run4dState.shiftPulse = Math.max(0, run4dState.shiftPulse - dt * 1.7);
    run4dState.completionPulse = Math.max(0, run4dState.completionPulse - dt);

    if (run4dState.grid) {
        const prevSliceOffset = run4dState.hyperSliceOffset;
        moveSlice4dRun(dt);
        const shiftDelta = run4dState.hyperSliceOffset - prevSliceOffset;
        if (Math.abs(shiftDelta) > 0.0001) {
            run4dState.shiftPulse = Math.min(1, run4dState.shiftPulse + Math.min(0.45, Math.abs(shiftDelta) * 8.5));
            run4dState.shiftDirection = shiftDelta >= 0 ? 1 : -1;
        }
        run4dState.crossSection = buildCrossSection4dRun(run4dState.grid, run4dState.hyperSliceOffset, run4dState.bfsPath);
        movePlayer4dRun(dt, run4dState.crossSection);
        if (!run4dState.completed && playerHitsEnd4dRun(run4dState.crossSection)) {
            run4dState.completed = true;
            run4dState.completionPulse = 1.35;
            const statusBar = document.getElementById('statusBar');
            if (statusBar) {
                statusBar.textContent = '4D route complete: reached the red finish.';
                statusBar.className = 'status-bar success';
            }
        } else if (run4dState.completed && !playerHitsEnd4dRun(run4dState.crossSection)) {
            const statusBar = document.getElementById('statusBar');
            if (statusBar) {
                statusBar.textContent = '4D route complete. You can keep exploring or shift the hyper-slice.';
                statusBar.className = 'status-bar success';
            }
        }
    }

    render4dRunFrame();
    requestAnimationFrame(tick4dRun);
}

function start4dRunLoop() {
    run4dState.lastFrameAt = 0;
    requestAnimationFrame(tick4dRun);
}

function reset4dRunPoseFromStart() {
    if (!run4dState.crossSection || !run4dState.crossSection.startBox) return;
    const start = run4dState.crossSection.startBox;
    run4dState.player.x = (start.x0 + start.x1) * 0.5;
    run4dState.player.y = (start.y0 + start.y1) * 0.5;
    run4dState.player.z = (start.z0 + start.z1) * 0.5;
    run4dState.yaw = 0;
    run4dState.pitch = RUN4D_DEFAULT_PITCH;
}
