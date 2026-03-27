const RUN3D_PLAYER_SPEED = 3.6;
const RUN3D_SLICE_SPEED = 3.1;
const RUN3D_PLAYER_RADIUS = 0.14;
const RUN3D_PLAYER_SWEEP_STEP = RUN3D_PLAYER_RADIUS * 0.35;
const RUN3D_PLAYER_NUDGES = [0, 0.04, -0.04, 0.08, -0.08, 0.12, -0.12];
const RUN3D_SLICE_SWEEP_STEP = 0.028;
const RUN3D_CELL_WORLD_SPAN = RUN3D_SQ2;
const RUN3D_SLICE_SQUEEZE_MAX_DRIFT = RUN3D_CELL_WORLD_SPAN * 0.25;

function pointInRect3dRun(x, y, rect) {
    return x >= rect.x0 + 0.0005 && x <= rect.x1 - 0.0005
        && y >= rect.y0 + 0.0005 && y <= rect.y1 - 0.0005;
}

function pointPassable3dRun(x, y, cs) {
    if (!cs) return false;
    if (cs.startRect && pointInRect3dRun(x, y, cs.startRect)) return true;
    if (cs.endRect && pointInRect3dRun(x, y, cs.endRect)) return true;
    for (const rect of cs.passable) {
        if (pointInRect3dRun(x, y, rect)) return true;
    }
    return false;
}

function canOccupy3dRun(x, y, cs) {
    const d = RUN3D_PLAYER_RADIUS * Math.SQRT1_2;
    const samples = [
        [0, 0],
        [RUN3D_PLAYER_RADIUS, 0], [-RUN3D_PLAYER_RADIUS, 0],
        [0, RUN3D_PLAYER_RADIUS], [0, -RUN3D_PLAYER_RADIUS],
        [d, d], [d, -d], [-d, d], [-d, -d],
    ];

    for (const [dx, dy] of samples) {
        if (!pointPassable3dRun(x + dx, y + dy, cs)) return false;
    }
    return true;
}

function clampToWorld3dRun(x, y) {
    const n = run3dState.gridSize;
    return {
        x: Math.max(-n / RUN3D_SQ2 + RUN3D_PLAYER_RADIUS, Math.min(n / RUN3D_SQ2 - RUN3D_PLAYER_RADIUS, x)),
        y: Math.max(0 + RUN3D_PLAYER_RADIUS, Math.min(n * RUN3D_SQ2 - RUN3D_PLAYER_RADIUS, y)),
    };
}

function sweepMove3dRun(dx, dy, cs) {
    const startX = run3dState.player.x;
    const startY = run3dState.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-9) {
        return { moved: false, blocked: false, reached: true, usedDx: 0, usedDy: 0 };
    }

    const steps = Math.max(1, Math.ceil(dist / RUN3D_PLAYER_SWEEP_STEP));
    let blocked = false;

    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const candidate = clampToWorld3dRun(startX + dx * t, startY + dy * t);
        if (!canOccupy3dRun(candidate.x, candidate.y, cs)) {
            blocked = true;
            break;
        }
        run3dState.player.x = candidate.x;
        run3dState.player.y = candidate.y;
    }

    const usedDx = run3dState.player.x - startX;
    const usedDy = run3dState.player.y - startY;
    const moved = Math.hypot(usedDx, usedDy) > 1e-8;
    const reached = !blocked && Math.abs(usedDx - dx) < 0.0006 && Math.abs(usedDy - dy) < 0.0006;
    return { moved, blocked, reached, usedDx, usedDy };
}

function stabilizePlayer3dRun(cs, options = {}) {
    const { allowTeleport = true, maxDrift = 1.2 } = options;
    if (canOccupy3dRun(run3dState.player.x, run3dState.player.y, cs)) return true;

    const origin = { x: run3dState.player.x, y: run3dState.player.y };
    const step = 0.045;
    const maxRing = Math.max(1, Math.ceil(maxDrift / step));

    for (let ring = 1; ring <= maxRing; ring++) {
        const candidates = [];
        for (let ox = -ring; ox <= ring; ox++) candidates.push([ox, -ring], [ox, ring]);
        for (let oy = -ring + 1; oy <= ring - 1; oy++) candidates.push([-ring, oy], [ring, oy]);
        candidates.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));

        for (const [ox, oy] of candidates) {
            const c = clampToWorld3dRun(origin.x + ox * step, origin.y + oy * step);
            if (!canOccupy3dRun(c.x, c.y, cs)) continue;
            run3dState.player.x = c.x;
            run3dState.player.y = c.y;
            return true;
        }
    }

    if (allowTeleport) {
        const allRects = [];
        if (cs.startRect) allRects.push(cs.startRect);
        if (cs.endRect) allRects.push(cs.endRect);
        for (const rect of cs.passable) allRects.push(rect);

        let bestRect = null;
        let bestDist2 = Infinity;
        for (const rect of allRects) {
            const cx = (rect.x0 + rect.x1) * 0.5;
            const cy = (rect.y0 + rect.y1) * 0.5;
            const d2 = (run3dState.player.x - cx) ** 2 + (run3dState.player.y - cy) ** 2;
            if (d2 < bestDist2) {
                bestDist2 = d2;
                bestRect = rect;
            }
        }

        if (bestRect) {
            run3dState.player.x = (bestRect.x0 + bestRect.x1) * 0.5;
            run3dState.player.y = (bestRect.y0 + bestRect.y1) * 0.5;
            return true;
        }
    }

    return false;
}

function tryAxisSlide3dRun(primaryDelta, secondaryDelta, primaryIsX, cs) {
    const direct = primaryIsX
        ? sweepMove3dRun(primaryDelta, 0, cs)
        : sweepMove3dRun(0, primaryDelta, cs);
    if (direct.moved) {
        if (secondaryDelta !== 0) {
            if (primaryIsX) sweepMove3dRun(0, secondaryDelta, cs);
            else sweepMove3dRun(secondaryDelta, 0, cs);
        }
        return true;
    }

    for (const n of RUN3D_PLAYER_NUDGES) {
        const attempt = primaryIsX
            ? sweepMove3dRun(primaryDelta, n, cs)
            : sweepMove3dRun(n, primaryDelta, cs);
        if (!attempt.moved) continue;
        if (secondaryDelta !== 0) {
            if (primaryIsX) sweepMove3dRun(0, secondaryDelta, cs);
            else sweepMove3dRun(secondaryDelta, 0, cs);
        }
        return true;
    }

    return false;
}

function moveWithNudge3dRun(dx, dy, cs) {
    const first = sweepMove3dRun(dx, dy, cs);
    if (first.reached) return;

    const remainingDx = dx - first.usedDx;
    const remainingDy = dy - first.usedDy;
    const xMajor = Math.abs(remainingDx) >= Math.abs(remainingDy);

    if (xMajor) {
        tryAxisSlide3dRun(remainingDx, remainingDy, true, cs)
            || tryAxisSlide3dRun(remainingDy, remainingDx, false, cs);
    } else {
        tryAxisSlide3dRun(remainingDy, remainingDx, false, cs)
            || tryAxisSlide3dRun(remainingDx, remainingDy, true, cs);
    }
}

function movePlayer3dRun(dt, cs) {
    stabilizePlayer3dRun(cs);

    let forward = 0;
    let strafe = 0;
    if (run3dState.keys['KeyW']) forward += 1;
    if (run3dState.keys['KeyS']) forward -= 1;
    if (run3dState.keys['KeyD']) strafe += 1;
    if (run3dState.keys['KeyA']) strafe -= 1;

    if (!forward && !strafe) return;

    const sin = Math.sin(run3dState.yaw);
    const cos = Math.cos(run3dState.yaw);
    let dx = sin * forward + cos * strafe;
    let dy = cos * forward - sin * strafe;
    const mag = Math.hypot(dx, dy);
    if (mag < 1e-9) return;
    const speed = RUN3D_PLAYER_SPEED * dt;
    moveWithNudge3dRun((dx / mag) * speed, (dy / mag) * speed, cs);
}

function moveSlice3dRun(dt) {
    let dir = 0;
    if (run3dState.keys['KeyE']) dir += 1;
    if (run3dState.keys['KeyQ']) dir -= 1;
    if (!dir || !run3dState.gridSize) return false;

    const bounds = getSliceBounds3dRun(run3dState.gridSize);
    const target = Math.max(
        bounds.min,
        Math.min(bounds.max, run3dState.sliceOffset + dir * RUN3D_SLICE_SPEED * dt)
    );

    const startSlice = run3dState.sliceOffset;
    const playerStartX = run3dState.player.x;
    const playerStartY = run3dState.player.y;
    const totalDelta = target - startSlice;
    const dist = Math.abs(totalDelta);
    if (dist < 1e-9) return false;

    const steps = Math.max(1, Math.ceil(dist / RUN3D_SLICE_SWEEP_STEP));
    let changed = false;

    for (let i = 1; i <= steps; i++) {
        const candidateSlice = startSlice + totalDelta * (i / steps);
        const candidateCrossSection = buildCrossSection3dRun(run3dState.grid, candidateSlice, run3dState.bfsPath);

        if (canOccupy3dRun(run3dState.player.x, run3dState.player.y, candidateCrossSection)) {
            run3dState.sliceOffset = candidateSlice;
            run3dState.crossSection = candidateCrossSection;
            changed = true;
            continue;
        }

        const savedX = run3dState.player.x;
        const savedY = run3dState.player.y;
        if (stabilizePlayer3dRun(candidateCrossSection, {
            allowTeleport: false,
            maxDrift: RUN3D_SLICE_SQUEEZE_MAX_DRIFT,
        })) {
            run3dState.sliceOffset = candidateSlice;
            run3dState.crossSection = candidateCrossSection;
            changed = true;
            continue;
        }

        run3dState.player.x = savedX;
        run3dState.player.y = savedY;
        break;
    }

    if (!changed) {
        run3dState.sliceOffset = startSlice;
        run3dState.player.x = playerStartX;
        run3dState.player.y = playerStartY;
        run3dState.crossSection = buildCrossSection3dRun(run3dState.grid, run3dState.sliceOffset, run3dState.bfsPath);
    }

    return changed;
}

function initPlayer3dRun() {
    if (!run3dState.crossSection) return false;
    const startRect = run3dState.crossSection.startRect;
    if (startRect) {
        run3dState.player.x = (startRect.x0 + startRect.x1) * 0.5;
        run3dState.player.y = (startRect.y0 + startRect.y1) * 0.5;
    }
    run3dState.yaw = 0;
    run3dState.pitch = -0.14;
    run3dState.completed = false;
    return true;
}

function playerHitsEnd3dRun(cs) {
    if (!cs || !cs.endRect) return false;
    return pointInRect3dRun(run3dState.player.x, run3dState.player.y, cs.endRect);
}
