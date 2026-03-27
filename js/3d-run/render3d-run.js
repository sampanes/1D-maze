function render3dRunSummary() {
    const el = document.getElementById('run3dSummary');
    if (!el) return;
    if (!run3dState.mapParam) {
        el.textContent = 'No map parameter detected yet. Use a shared 3D URL or the sample button to verify decode, BFS behavior, and the same underlying 45 degree slice-world in-browser.';
        return;
    }

    const outcome = run3dState.solvable
        ? `Map decoded successfully. BFS found a route in ${run3dState.bfsPath.length} cells.`
        : 'Map decoded successfully, but BFS did not find a valid route.';
    el.textContent = `${outcome} This confirms the standalone route is reconstructing the real 3D map state that the IRL camera will inhabit, not a separate discrete-layer reinterpretation.`;
}

function render3dRunMetrics() {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    if (!run3dState.mapParam || !run3dState.grid) {
        setText('run3dGridSize', '--');
        setText('run3dSolvable', 'Awaiting map');
        setText('run3dCellCount', '--');
        setText('run3dPathLength', '--');
        setText('run3dMapSource', 'No URL parameter found.');
        setText('run3dMapMeta', 'Open this page with `?map3d=...` or `?map=...` to run the decode test.');
        setText('run3dOverviewCaption', 'No map loaded yet.');
        updateChecklist();
        return;
    }

    const totalCells = run3dState.gridSize ** 3;
    const walkableCells = totalCells - run3dState.wallCount;
    setText('run3dGridSize', `${run3dState.gridSize} x ${run3dState.gridSize} x ${run3dState.gridSize}`);
    setText('run3dSolvable', run3dState.solvable ? 'Solvable' : 'Blocked');
    setText('run3dCellCount', `${walkableCells}/${totalCells}`);
    setText('run3dPathLength', run3dState.bfsPath ? String(run3dState.bfsPath.length) : '0');
    setText('run3dMapSource', `${run3dState.mapSource} (${run3dState.mapParam.length} chars)`);
    setText(
        'run3dMapMeta',
        `Walls: ${run3dState.wallCount}. Start = (0,0,${run3dState.gridSize - 1}), End = (${run3dState.gridSize - 1},${run3dState.gridSize - 1},0). Slice S = ${run3dState.sliceOffset.toFixed(2)}.`
    );
    setText(
        'run3dOverviewCaption',
        'Continuous 45 degree slice-world view. White = path platform, gold = BFS hint, green/red = anchors. Q/E smoothly morphs the slice. R resets pose.'
    );
    updateChecklist();
}

function updateChecklist() {
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

    setCheck('run3dCheckBoot', 'pass');
    setCheck('run3dCheckMap3d', run3dState.mapParamName === 'map3d' && !!run3dState.grid ? 'pass' : 'pending');
    setCheck('run3dCheckFallback', run3dState.mapParamName === 'map' && !!run3dState.grid ? 'pass' : 'pending');
    setCheck('run3dCheckOverview', !!run3dState.grid ? 'pass' : 'pending');
}

function projectPoint3dRun(point, camera, canvas) {
    const dx = point.x - camera.pos.x;
    const dy = point.y - camera.pos.y;
    const dz = point.z - camera.pos.z;

    const cx = dx * camera.right.x + dy * camera.right.y + dz * camera.right.z;
    const cy = dx * camera.up.x + dy * camera.up.y + dz * camera.up.z;
    const cz = dx * camera.forward.x + dy * camera.forward.y + dz * camera.forward.z;
    if (cz <= 0.05) return null;

    const focal = Math.min(canvas.width, canvas.height) * 0.92;
    return {
        x: canvas.width * 0.5 + (cx / cz) * focal,
        y: canvas.height * 0.5 - (cy / cz) * focal,
        depth: cz,
    };
}

function buildCamera3dRun(canvas) {
    const px = run3dState.player.x;
    const pz = run3dState.player.y;
    const yaw = run3dState.yaw;
    const pitch = run3dState.pitch;
    const forward = {
        x: Math.sin(yaw) * Math.cos(pitch),
        y: Math.sin(pitch),
        z: Math.cos(yaw) * Math.cos(pitch),
    };
    const forwardLen = Math.hypot(forward.x, forward.y, forward.z) || 1;
    forward.x /= forwardLen;
    forward.y /= forwardLen;
    forward.z /= forwardLen;

    const eye = {
        x: px - Math.sin(yaw) * 1.9,
        y: 1.35,
        z: pz - Math.cos(yaw) * 1.9,
    };

    const right = {
        x: forward.z,
        y: 0,
        z: -forward.x,
    };
    const rightLen = Math.hypot(right.x, right.y, right.z) || 1;
    right.x /= rightLen;
    right.z /= rightLen;

    const up = {
        x: forward.y * right.z - forward.z * right.y,
        y: forward.z * right.x - forward.x * right.z,
        z: forward.x * right.y - forward.y * right.x,
    };

    return { pos: eye, forward, right, up };
}

function drawQuad3dRun(ctx, quad, fillStyle, strokeStyle) {
    ctx.beginPath();
    ctx.moveTo(quad[0].x, quad[0].y);
    for (let i = 1; i < quad.length; i++) ctx.lineTo(quad[i].x, quad[i].y);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

function rectToPrismFaces3dRun(rect, thickness) {
    const x0 = rect.x0;
    const x1 = rect.x1;
    const z0 = rect.y0;
    const z1 = rect.y1;
    const yTop = 0;
    const yBottom = -thickness;
    return {
        top: [
            { x: x0, y: yTop, z: z0 },
            { x: x1, y: yTop, z: z0 },
            { x: x1, y: yTop, z: z1 },
            { x: x0, y: yTop, z: z1 },
        ],
        sides: [
            [{ x: x0, y: yTop, z: z0 }, { x: x1, y: yTop, z: z0 }, { x: x1, y: yBottom, z: z0 }, { x: x0, y: yBottom, z: z0 }],
            [{ x: x1, y: yTop, z: z0 }, { x: x1, y: yTop, z: z1 }, { x: x1, y: yBottom, z: z1 }, { x: x1, y: yBottom, z: z0 }],
            [{ x: x1, y: yTop, z: z1 }, { x: x0, y: yTop, z: z1 }, { x: x0, y: yBottom, z: z1 }, { x: x1, y: yBottom, z: z1 }],
            [{ x: x0, y: yTop, z: z1 }, { x: x0, y: yTop, z: z0 }, { x: x0, y: yBottom, z: z0 }, { x: x0, y: yBottom, z: z1 }],
        ],
    };
}

function projectRectCenter3dRun(rect, camera, canvas) {
    const center = {
        x: (rect.x0 + rect.x1) * 0.5,
        y: 0,
        z: (rect.y0 + rect.y1) * 0.5,
    };
    return projectPoint3dRun(center, camera, canvas);
}

function render3dRunOverview() {
    const canvas = document.getElementById('run3dOverviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cssWidth = canvas.clientWidth || 1100;
    const cssHeight = canvas.clientHeight || 760;
    if (canvas.width !== cssWidth || canvas.height !== cssHeight) {
        canvas.width = cssWidth;
        canvas.height = cssHeight;
    }

    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#102034');
    sky.addColorStop(0.34, '#08111d');
    sky.addColorStop(1, '#020305');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!run3dState.grid || !run3dState.gridSize || !run3dState.crossSection) {
        ctx.fillStyle = '#9db1d8';
        ctx.font = '600 22px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Load a 3D shared map to inspect the decoded slice-world.', canvas.width / 2, canvas.height / 2 - 6);
        ctx.font = '16px system-ui';
        ctx.fillStyle = 'rgba(157,177,216,0.82)';
        ctx.fillText('The IRL route will animate the continuous 45 degree slice, not discrete k-layers.', canvas.width / 2, canvas.height / 2 + 28);
        return;
    }

    const camera = buildCamera3dRun(canvas);
    const cs = run3dState.crossSection;
    const slabs = [];
    const thickness = 0.28;
    const pushSlab = (rect, top, side, edge) => {
        const prism = rectToPrismFaces3dRun(rect, thickness);
        const topProjected = prism.top.map((p) => projectPoint3dRun(p, camera, canvas));
        if (topProjected.some((p) => p === null)) return;
        const avgDepth = topProjected.reduce((sum, p) => sum + p.depth, 0) / topProjected.length;
        slabs.push({ prism, rect, avgDepth, top, side, edge });
    };

    for (const rect of cs.passable) pushSlab(rect, '#f5f7ff', 'rgba(190,205,230,0.28)', 'rgba(255,255,255,0.10)');
    for (const rect of cs.pathRects) pushSlab(rect, '#ffd84f', 'rgba(162,118,14,0.34)', 'rgba(255,224,120,0.18)');
    if (cs.startRect) pushSlab(cs.startRect, '#5dffb0', 'rgba(50,150,100,0.35)', 'rgba(210,255,230,0.16)');
    if (cs.endRect) pushSlab(cs.endRect, '#ff6a6a', 'rgba(150,58,58,0.35)', 'rgba(255,220,220,0.16)');

    slabs.sort((a, b) => b.avgDepth - a.avgDepth);
    for (const slab of slabs) {
        const shadowCenter = projectRectCenter3dRun(slab.rect, camera, canvas);
        if (shadowCenter) {
            const shadowRadius = Math.max(8, 22 / Math.max(0.55, shadowCenter.depth));
            ctx.save();
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.ellipse(shadowCenter.x, shadowCenter.y + 1.5, shadowRadius * 1.5, shadowRadius * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        for (const face of slab.prism.sides) {
            const projected = face.map((p) => projectPoint3dRun(p, camera, canvas));
            if (projected.some((p) => p === null)) continue;
            drawQuad3dRun(ctx, projected, slab.side, null);
        }
        const topProjected = slab.prism.top.map((p) => projectPoint3dRun(p, camera, canvas));
        if (topProjected.some((p) => p === null)) continue;
        drawQuad3dRun(ctx, topProjected, slab.top, slab.edge);
    }

    const playerBase = projectPoint3dRun({ x: run3dState.player.x, y: 0.02, z: run3dState.player.y }, camera, canvas);
    const playerTop = projectPoint3dRun({ x: run3dState.player.x, y: 0.35, z: run3dState.player.y }, camera, canvas);
    if (playerBase) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(playerBase.x, playerBase.y + 1.5, 14, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    if (playerBase && playerTop) {
        ctx.save();
        ctx.strokeStyle = 'rgba(125,255,46,0.72)';
        ctx.shadowColor = 'rgba(125,255,46,0.85)';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(playerBase.x, playerBase.y);
        ctx.lineTo(playerTop.x, playerTop.y);
        ctx.stroke();
        ctx.restore();
    }
    if (playerTop) {
        ctx.save();
        ctx.shadowColor = '#7dff2e';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#c8ff9a';
        ctx.beginPath();
        ctx.arc(playerTop.x, playerTop.y, 7, 0, Math.PI * 2);
        ctx.fill();
        if (run3dState.completed) {
            ctx.fillStyle = '#ffe06d';
            ctx.beginPath();
            ctx.moveTo(playerTop.x - 5, playerTop.y - 8);
            ctx.lineTo(playerTop.x, playerTop.y - 20);
            ctx.lineTo(playerTop.x + 5, playerTop.y - 8);
            ctx.closePath();
            ctx.fill();

            for (let i = 0; i < 6; i++) {
                const angle = (performance.now() * 0.004) + i * (Math.PI * 2 / 6);
                const sx = playerTop.x + Math.cos(angle) * 15;
                const sy = playerTop.y - 12 + Math.sin(angle) * 7;
                ctx.fillStyle = i % 2 === 0 ? '#ffe06d' : '#ffffff';
                ctx.beginPath();
                ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    ctx.fillStyle = 'rgba(6,10,18,0.8)';
    ctx.fillRect(18, 18, 364, 114);
    ctx.strokeStyle = 'rgba(122,252,255,0.14)';
    ctx.strokeRect(18, 18, 364, 114);
    ctx.fillStyle = '#e8f5ff';
    ctx.font = '700 14px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('Continuous Slice Embodiment', 32, 42);
    ctx.font = '13px system-ui';
    ctx.fillStyle = '#9db1d8';
    ctx.fillText(`S ${run3dState.sliceOffset.toFixed(2)}  |  yaw ${(run3dState.yaw * 180 / Math.PI).toFixed(1)} deg`, 32, 64);
    ctx.fillText(`pitch ${(run3dState.pitch * 180 / Math.PI).toFixed(1)} deg  |  ${run3dState.pointerLocked ? 'mouse look active' : 'click to lock mouse'}`, 32, 84);
    ctx.fillText('WASD move  |  Q/E morph slice  |  R reset pose  |  Esc unlock', 32, 104);

    const mapLabel = run3dState.mapSource ? `${run3dState.mapSource}` : 'no map';
    const lockLabel = run3dState.pointerLocked ? 'locked' : 'free cursor';
    const badgeX = canvas.width - 228;
    ctx.fillStyle = 'rgba(6,10,18,0.7)';
    ctx.fillRect(badgeX, 18, 210, 58);
    ctx.strokeStyle = 'rgba(122,252,255,0.14)';
    ctx.strokeRect(badgeX, 18, 210, 58);
    ctx.fillStyle = '#7afcff';
    ctx.font = '700 12px system-ui';
    ctx.fillText('Route State', badgeX + 14, 38);
    ctx.fillStyle = '#d7e4ff';
    ctx.font = '12px system-ui';
    ctx.fillText(`map: ${mapLabel}`, badgeX + 14, 56);
    ctx.fillText(`cursor: ${lockLabel}`, badgeX + 14, 72);

    if (run3dState.completed) {
        ctx.fillStyle = 'rgba(93,255,176,0.12)';
        ctx.fillRect(canvas.width * 0.5 - 170, 24, 340, 48);
        ctx.strokeStyle = 'rgba(93,255,176,0.42)';
        ctx.strokeRect(canvas.width * 0.5 - 170, 24, 340, 48);
        ctx.fillStyle = '#dfffee';
        ctx.textAlign = 'center';
        ctx.font = '800 18px system-ui';
        ctx.fillText('Slice complete: reached the red finish.', canvas.width * 0.5, 54);
    }

    if (!run3dState.pointerLocked) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(canvas.width * 0.5 - 194, canvas.height - 66, 388, 42);
        ctx.fillStyle = '#dff5ff';
        ctx.textAlign = 'center';
        ctx.font = '600 13px system-ui';
        ctx.fillText('Click in the view to enable over-shoulder mouse look', canvas.width * 0.5, canvas.height - 46);
        ctx.fillText('Then use WASD to move, Q/E to morph, R to reset, Esc to unlock', canvas.width * 0.5, canvas.height - 29);
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

function render3dRunFrame() {
    if (run3dState.grid) {
        run3dState.crossSection = buildCrossSection3dRun(run3dState.grid, run3dState.sliceOffset, run3dState.bfsPath);
    }
    render3dRunMetrics();
    render3dRunOverview();
}

function tick3dRun(ts) {
    if (!run3dState.lastFrameAt) run3dState.lastFrameAt = ts;
    const dt = Math.min(0.05, (ts - run3dState.lastFrameAt) / 1000);
    run3dState.lastFrameAt = ts;

    if (run3dState.grid) {
        moveSlice3dRun(dt);
        run3dState.crossSection = buildCrossSection3dRun(run3dState.grid, run3dState.sliceOffset, run3dState.bfsPath);
        movePlayer3dRun(dt, run3dState.crossSection);
        if (!run3dState.completed && playerHitsEnd3dRun(run3dState.crossSection)) {
            run3dState.completed = true;
            const statusBar = document.getElementById('statusBar');
            if (statusBar) {
                statusBar.textContent = 'Continuous slice complete: reached the red finish.';
                statusBar.className = 'status-bar success';
            }
        } else if (run3dState.completed && !playerHitsEnd3dRun(run3dState.crossSection)) {
            const statusBar = document.getElementById('statusBar');
            if (statusBar) {
                statusBar.textContent = 'Continuous slice complete. You can keep exploring or morph the slice.';
                statusBar.className = 'status-bar success';
            }
        }
    }

    render3dRunFrame();
    requestAnimationFrame(tick3dRun);
}

function start3dRunLoop() {
    run3dState.lastFrameAt = 0;
    requestAnimationFrame(tick3dRun);
}

function reset3dRunPoseFromStart() {
    if (!run3dState.crossSection || !run3dState.crossSection.startRect) return;
    const start = run3dState.crossSection.startRect;
    run3dState.player.x = (start.x0 + start.x1) * 0.5;
    run3dState.player.y = (start.y0 + start.y1) * 0.5;
    run3dState.yaw = 0;
    run3dState.pitch = -0.14;
}
