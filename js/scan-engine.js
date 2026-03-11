// 1D scanner readout
function updateScanReadout() {
    const info = getCellInfoAtUV(player.u, player.v);
    rowReadout.textContent = 'u: ' + player.u.toFixed(2);
    colReadout.textContent = 'v: ' + player.v.toFixed(2);
    if (info) {
        cellReadout.textContent = 'Cell: ' + getCellLabel(info) + ' [' + info.row + ',' + info.col + ']';
    } else {
        cellReadout.textContent = 'Cell: VOID';
    }
}

function sampleSliceColumn(u, vStart, vEnd) {
    const tally = { wall: 0, start: 0, end: 0, solution: 0, open: 0, total: 0 };
    for (let i = 0; i < SAMPLE_SUBDIVISIONS; i++) {
        const v = vStart + ((i + 0.5) / SAMPLE_SUBDIVISIONS) * (vEnd - vStart);
        const info = getCellInfoAtUV(u, v);
        if (!info) continue;
        tally.total++;
        if (info.wall) tally.wall++;
        else if (info.end) tally.end++;
        else if (info.start) tally.start++;
        else if (info.solution) tally.solution++;
        else tally.open++;
    }
    return tally;
}

function drawScanView(now = performance.now()) {
    updateScanReadout();

    const ctx = scanCtx;
    const w = scanCanvas.width;
    const h = scanCanvas.height;
    const N = gridSize;
    const totalV = 2 * N;
    const padX = 34;
    const usableW = w - padX * 2;
    const centerY = Math.floor(h * 0.62);
    const laneH = 86;
    const laneTop = centerY - laneH / 2;
    const lineY = centerY;
    const bounds = getVBounds(player.u);
    const laneLeft = padX + (bounds.min / totalV) * usableW;
    const laneRight = padX + (bounds.max / totalV) * usableW;
    const avatarX = padX + (player.v / totalV) * usableW;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);

    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#091121');
    bg.addColorStop(1, '#060912');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const ambient = ctx.createRadialGradient(w / 2, centerY, 20, w / 2, centerY, w * 0.52);
    ambient.addColorStop(0, 'rgba(0, 217, 245, 0.12)');
    ambient.addColorStop(1, 'rgba(0, 217, 245, 0)');
    ctx.fillStyle = ambient;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#7afcff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('1D SHADOW SCANNER', 28, 28);
    ctx.fillStyle = '#9db1d8';
    ctx.font = '12px monospace';
    ctx.fillText('u=' + player.u.toFixed(2) + '   v=' + player.v.toFixed(2), 28, 48);

    ctx.textAlign = 'right';
    ctx.fillText('sampled along x-y=u', w - 28, 28);
    ctx.fillText('global v axis: 0 → ' + totalV.toFixed(0), w - 28, 48);
    ctx.textAlign = 'left';

    ctx.strokeStyle = 'rgba(120, 145, 215, 0.20)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, lineY);
    ctx.lineTo(w - padX, lineY);
    ctx.stroke();

    const tickStep = gridSize <= 24 ? 1 : 2;
    for (let t = 0; t <= totalV; t += tickStep) {
        const x = padX + (t / totalV) * usableW;
        ctx.strokeStyle = t % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)';
        ctx.beginPath();
        ctx.moveTo(x, centerY + laneH / 2 + 6);
        ctx.lineTo(x, centerY + laneH / 2 + 14);
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    roundRectPath(ctx, padX, laneTop, usableW, laneH, 18);
    ctx.fill();

    ctx.fillStyle = 'rgba(7, 13, 26, 0.90)';
    if (laneLeft > padX) ctx.fillRect(padX, laneTop, laneLeft - padX, laneH);
    if (laneRight < w - padX) ctx.fillRect(laneRight, laneTop, w - padX - laneRight, laneH);

    const laneGrad = ctx.createLinearGradient(0, laneTop, 0, laneTop + laneH);
    laneGrad.addColorStop(0, 'rgba(245, 248, 255, 0.95)');
    laneGrad.addColorStop(1, 'rgba(218, 225, 245, 0.92)');
    ctx.fillStyle = laneGrad;
    roundRectPath(ctx, laneLeft, laneTop, Math.max(2, laneRight - laneLeft), laneH, 18);
    ctx.fill();

    for (let px = Math.floor(laneLeft); px < Math.ceil(laneRight); px++) {
        const v0 = ((px - padX) / usableW) * totalV;
        const v1 = (((px + 1) - padX) / usableW) * totalV;
        const sample = sampleSliceColumn(player.u, v0, v1);
        if (!sample.total) continue;

        if (sample.solution > 0 && sample.wall === 0) {
            const a = sample.solution / sample.total;
            ctx.fillStyle = 'rgba(255, 216, 79, ' + (0.18 + a * 0.35).toFixed(3) + ')';
            ctx.fillRect(px, laneTop, 1, laneH);
        }
        if (sample.start > 0 && sample.wall === 0) {
            const a = sample.start / sample.total;
            ctx.fillStyle = 'rgba(93, 255, 176, ' + (0.26 + a * 0.55).toFixed(3) + ')';
            ctx.fillRect(px, laneTop, 1, laneH);
        }
        if (sample.end > 0 && sample.wall === 0) {
            const a = sample.end / sample.total;
            ctx.fillStyle = 'rgba(255, 106, 106, ' + (0.26 + a * 0.55).toFixed(3) + ')';
            ctx.fillRect(px, laneTop, 1, laneH);
        }
        if (sample.wall > 0) {
            const frac = sample.wall / sample.total;
            const colH = laneH * (0.10 + frac * 0.90);
            const y = centerY - colH / 2;
            ctx.fillStyle = 'rgba(7, 9, 14, ' + (0.30 + frac * 0.70).toFixed(3) + ')';
            ctx.fillRect(px, y, 1, colH);
            if (frac > 0.5) {
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                ctx.fillRect(px, y, 1, 1);
                ctx.fillRect(px, y + colH - 1, 1, 1);
            }
        }
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 217, 245, 0.30)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(laneLeft, lineY);
    ctx.lineTo(laneRight, lineY);
    ctx.stroke();

    ctx.strokeStyle = '#00d9f5';
    ctx.shadowColor = '#00d9f5';
    ctx.shadowBlur = 24;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(laneLeft, lineY);
    ctx.lineTo(laneRight, lineY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#00d9f5';
    ctx.beginPath();
    ctx.moveTo(laneLeft - 15, lineY - 8);
    ctx.lineTo(laneLeft - 4, lineY);
    ctx.lineTo(laneLeft - 15, lineY + 8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(laneRight + 15, lineY - 8);
    ctx.lineTo(laneRight + 4, lineY);
    ctx.lineTo(laneRight + 15, lineY + 8);
    ctx.fill();

    const squish = avatarSquish;
    const scaleX = 1 + squish * 0.48;
    const scaleY = 1 - squish * 0.30;
    const bob = squish * 2.5 * pulse;
    ctx.save();
    ctx.translate(avatarX, lineY - bob);
    ctx.scale(scaleX, scaleY);
    ctx.fillStyle = '#7dff2e';
    ctx.shadowColor = '#7dff2e';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#091002';
    ctx.beginPath();
    ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#9db1d8';
    ctx.font = '12px monospace';
    ctx.fillText('lane [' + bounds.min.toFixed(2) + ', ' + bounds.max.toFixed(2) + ']', 28, h - 24);
    ctx.textAlign = 'right';
    ctx.fillText('Use arrows • Hold P to peek', w - 28, h - 24);
    ctx.textAlign = 'left';

    if (performance.now() < celebrateUntil) {
        const t = (celebrateUntil - performance.now()) / 1600;
        const alpha = Math.max(0, Math.min(1, 1 - (t * 0.55)));
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(93, 255, 176, ' + (0.20 + alpha * 0.55).toFixed(3) + ')';
        roundRectPath(ctx, w * 0.19, h * 0.20, w * 0.62, 70, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 217, 245, ' + (0.35 + alpha * 0.45).toFixed(3) + ')';
        ctx.lineWidth = 2;
        roundRectPath(ctx, w * 0.19, h * 0.20, w * 0.62, 70, 18);
        ctx.stroke();
        ctx.fillStyle = '#ecfff8';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SCAN COMPLETE', w / 2, h * 0.20 + 30);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#d8ffee';
        ctx.fillText('Red End cell acquired — resetting scanner...', w / 2, h * 0.20 + 54);
        ctx.textAlign = 'left';
    }
}

// Collision and movement
function triggerBlocked(message) {
    avatarSquish = 1;
    playMerp();
    setStatus(message, 'error');
}

function tryMoveTo(nextU, nextV, successMessage, nudged = false) {
    nextU = clampU(nextU);
    nextV = clampV(nextU, nextV);
    if (!pointInsideDiamond(nextU, nextV)) return false;
    if (isWallAtUV(nextU, nextV)) return false;
    if (!isSegmentClear(player.u, player.v, nextU, nextV, 10)) return false;

    player.u = nextU;
    player.v = nextV;
    if (!checkWin()) {
        setStatus(successMessage || (nudged ? 'Greased nudge slipped around a corner.' : 'Scanner moved.'), 'info');
    }
    return true;
}

function checkWin() {
    const probes = [
        [0, 0],
        [0.03, 0],
        [-0.03, 0],
        [0, 0.03],
        [0, -0.03]
    ];

    let hitEnd = false;
    for (const [du, dv] of probes) {
        const info = getCellInfoAtUV(player.u + du, player.v + dv);
        if (info && info.end) {
            hitEnd = true;
            break;
        }
    }

    if (hitEnd) {
        celebrateUntil = performance.now() + 1600;
        playCelebrate();
        setStatus('Scan Complete! End cell reached. Resetting scanner...', 'success');
        if (winResetHandle) clearTimeout(winResetHandle);
        winResetHandle = setTimeout(() => {
            stopScan('Scan Complete! Scanner reset. You can scan again or edit the maze.', 'success');
            resetScannerState();
            drawScanView(performance.now());
        }, 1600);
        return true;
    }
    return false;
}

function isOutOfBounds(u, v) {
    const bounds = getVBounds(u);
    return v <= bounds.min + EPS || v >= bounds.max - EPS;
}

function isBlocked(u, v) {
    if (!pointInsideDiamond(u, v)) return true;
    if (isOutOfBounds(u, v)) return true;
    return isWallAtUV(u, v);
}

function isCellWallOnly(u, v) {
    if (!pointInsideDiamond(u, v)) return false;
    const info = getCellInfoAtUV(u, v);
    return !!(info && info.wall);
}

function canMoveTo(u0, v0, u1, v1, steps = 8) {
    const dist = Math.hypot(u1 - u0, v1 - v0);
    const dynamicSteps = Math.max(steps, Math.ceil(dist / 0.045));
    for (let i = 1; i <= dynamicSteps; i++) {
        const t = i / dynamicSteps;
        const u = u0 + (u1 - u0) * t;
        const v = v0 + (v1 - v0) * t;
        if (isBlocked(u, v)) return false;
    }
    return true;
}

function attemptMoveLateral(delta) {
    const desiredV = player.v + delta;
    const clampedV = clampV(player.u, desiredV);

    if (!isBlocked(player.u, clampedV) && canMoveTo(player.u, player.v, player.u, clampedV, 8)) {
        player.v = clampedV;
        checkWin();
        setStatus('Lateral movement.', 'info');
        return;
    }

    const sign = delta > 0 ? 1 : -1;
    const directBlockedByBoundary = isNearBoundary(player.u, clampedV) || !pointInsideDiamond(player.u, clampedV);

    const slideTargets = [0, ...NUDGE_OFFSETS];
    for (const du of slideTargets) {
        const nudgedU = clampU(player.u + du);
        const nudgedV = clampV(nudgedU, desiredV);
        if (!isBlocked(nudgedU, nudgedV) && canMoveTo(player.u, player.v, nudgedU, nudgedV, 10)) {
            player.u = nudgedU;
            player.v = nudgedV;
            setStatus(du === 0 ? 'Exited into open space.' : 'Greased nudge along edge.', 'info');
            checkWin();
            return;
        }
    }

    let lo = 0;
    let hi = 1;
    let bestU = player.u;
    let bestV = player.v;
    for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        const testV = clampV(player.u, player.v + delta * mid);
        if (!isBlocked(player.u, testV) && canMoveTo(player.u, player.v, player.u, testV, 8)) {
            bestV = testV;
            lo = mid;
        } else {
            hi = mid;
        }
    }
    if (Math.abs(bestV - player.v) > 0.0008) {
        player.v = bestV;
        setStatus('Sliding at edge.', 'info');
        checkWin();
        return;
    }

    const blendedOffsets = [...NUDGE_OFFSETS].sort((a, b) => Math.abs(a) - Math.abs(b));
    for (const du of blendedOffsets) {
        const testU = clampU(player.u + du);
        const testV = clampV(testU, player.v + delta * 0.45);
        if (!isBlocked(testU, testV) && canMoveTo(player.u, player.v, testU, testV, 10)) {
            player.u = testU;
            player.v = testV;
            setStatus(directBlockedByBoundary ? 'Border slide.' : 'Corner slide.', 'info');
            checkWin();
            return;
        }
    }

    triggerBlocked('Merp — Wall collision.');
}

function attemptMoveVertical(delta) {
    const desiredU = clampU(player.u + delta);
    const bounds = getVBounds(desiredU);

    let nextV = clampV(desiredU, player.v);

    if (!isBlocked(desiredU, nextV) && canMoveTo(player.u, player.v, desiredU, nextV, 8)) {
        player.u = desiredU;
        player.v = nextV;
        checkWin();
        setStatus('Vertical movement.', 'info');
        return;
    }

    const vCenter = (bounds.min + bounds.max) / 2;
    const playerSide = player.v >= vCenter ? 1 : -1;
    const directBlockedByBoundary = isNearBoundary(desiredU, nextV) || !pointInsideDiamond(desiredU, nextV);

    const sortedNudges = [...NUDGE_OFFSETS].sort((a, b) => {
        const aMatch = Math.sign(a || playerSide) === playerSide ? 0 : 1;
        const bMatch = Math.sign(b || playerSide) === playerSide ? 0 : 1;
        return aMatch - bMatch || Math.abs(a) - Math.abs(b);
    });

    for (const dv of sortedNudges) {
        const nudgedV = clampV(desiredU, player.v + dv);
        if (!isBlocked(desiredU, nudgedV) && canMoveTo(player.u, player.v, desiredU, nudgedV, 10)) {
            player.u = desiredU;
            player.v = nudgedV;
            setStatus(directBlockedByBoundary ? 'Border-guided vertical slide.' : 'Slid around convex corner.', 'info');
            checkWin();
            return;
        }
    }

    let lo = 0;
    let hi = 1;
    let bestU = player.u;
    let bestV = player.v;
    for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        const testU = clampU(player.u + delta * mid);
        const testV = clampV(testU, player.v);
        if (!isBlocked(testU, testV) && canMoveTo(player.u, player.v, testU, testV, 8)) {
            bestU = testU;
            bestV = testV;
            lo = mid;
        } else {
            hi = mid;
        }
    }
    if (Math.abs(bestU - player.u) > 0.0008) {
        player.u = bestU;
        player.v = bestV;
        setStatus('Vertical slide.', 'info');
        checkWin();
        return;
    }

    for (const dv of sortedNudges) {
        const testU = clampU(player.u + delta * 0.45);
        const testV = clampV(testU, player.v + dv);
        if (!isBlocked(testU, testV) && canMoveTo(player.u, player.v, testU, testV, 10)) {
            player.u = testU;
            player.v = testV;
            setStatus(directBlockedByBoundary ? 'Border corner slide.' : 'Corner slide.', 'info');
            checkWin();
            return;
        }
    }

    triggerBlocked('Merp — Wall collision.');
}

// Phase transitions
function startScan() {
    resetScannerState();
    scanActive = true;
    peeking = false;

    mazeSection.classList.add('collapsed');
    mazeSection.classList.remove('peek');
    scanSection.classList.add('active');
    peekHint.classList.add('active');

    drawMaze(bfsPath, true);
    drawScanView(performance.now());

    if (window.innerWidth < 768) {
        setStatus('Scan mode active. Tap or slide the 1D scanner with your stylus to navigate.', 'info');
    } else {
        setStatus('Scan mode active. Use arrows to move continuous u,v coordinates. Hold P to peek at the 2D diamond.', 'info');
    }
}

function stopScan(message = 'Back in Architect mode. Edit the maze or validate again.', type = 'neutral') {
    scanActive = false;
    peeking = false;
    celebrateUntil = 0;
    if (winResetHandle) {
        clearTimeout(winResetHandle);
        winResetHandle = null;
    }
    mazeSection.classList.remove('collapsed', 'peek');
    scanSection.classList.remove('active');
    peekHint.classList.remove('active');
    drawMaze(bfsPath);
    setStatus(message, type);
}

// Wall-push nudge (called every frame during scan)
function nudgeAwayFromWalls() {
    const probeRadius = 0.12;
    const probePoints = [
        { du: 0, dv: probeRadius },
        { du: 0, dv: -probeRadius },
        { du: probeRadius, dv: 0 },
        { du: -probeRadius, dv: 0 },
    ];

    let pushU = 0;
    let pushV = 0;
    let pushCount = 0;

    for (const probe of probePoints) {
        const testU = player.u + probe.du;
        const testV = player.v + probe.dv;
        if (isBlocked(testU, testV)) {
            pushU -= probe.du * 0.5;
            pushV -= probe.dv * 0.5;
            pushCount++;
        }
    }

    const boundaryGap = getBoundaryGap(player.u, player.v);
    if (boundaryGap < probeRadius * 0.9) {
        const bounds = getVBounds(player.u);
        const distLeft = player.v - bounds.min;
        const distRight = bounds.max - player.v;
        if (distLeft < distRight) pushV += (probeRadius - distLeft) * 0.85;
        else pushV -= (probeRadius - distRight) * 0.85;
        pushCount++;
    }

    if (pushCount > 0) {
        const newU = clampU(player.u + pushU * 0.08);
        const newV = clampV(newU, player.v + pushV * 0.08);
        if (!isBlocked(newU, newV) && canMoveTo(player.u, player.v, newU, newV, 8)) {
            player.u = newU;
            player.v = newV;
        }
    }

    if (isBlocked(player.u, player.v)) {
        let escaped = false;
        for (let radius = 0.1; radius <= 0.8; radius += 0.1) {
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
                const testU = clampU(player.u + Math.cos(angle) * radius);
                const testV = clampV(testU, player.v + Math.sin(angle) * radius);
                if (!isBlocked(testU, testV)) {
                    player.u = testU;
                    player.v = testV;
                    escaped = true;
                    break;
                }
            }
            if (escaped) break;
        }
        if (!escaped) {
            triggerBlocked('Merp — Squeezed by concave corner!');
        }
    }
}

function handleInputs(dt) {
    if (!scanActive || performance.now() < celebrateUntil) return;

    let moveV = 0;
    let moveU = 0;
    if (keysDown['ArrowLeft']) moveV -= 1;
    if (keysDown['ArrowRight']) moveV += 1;
    if (keysDown['ArrowUp']) moveU += 1;
    if (keysDown['ArrowDown']) moveU -= 1;

    if (moveV !== 0 && moveU !== 0) {
        const deltaV = moveV * dt * MOVE_SPEED_V;
        const deltaU = moveU * dt * MOVE_SPEED_U;
        const targetU = clampU(player.u + deltaU);
        const targetV = clampV(targetU, player.v + deltaV);

        if (!isBlocked(targetU, targetV) && canMoveTo(player.u, player.v, targetU, targetV, 8)) {
            player.u = targetU;
            player.v = targetV;
            checkWin();
            setStatus('Diagonal movement.', 'info');
        } else {
            attemptMoveLateral(deltaV);
            attemptMoveVertical(deltaU);
        }
    } else {
        if (moveV !== 0) attemptMoveLateral(moveV * dt * MOVE_SPEED_V);
        if (moveU !== 0) attemptMoveVertical(moveU * dt * MOVE_SPEED_U);
    }

    nudgeAwayFromWalls();
}
