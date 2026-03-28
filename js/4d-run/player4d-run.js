const RUN4D_PLAYER_SPEED = 3.8;
const RUN4D_SLICE_SPEED = 3.2;
const RUN4D_PLAYER_RADIUS = 0.14;
const RUN4D_PLAYER_SWEEP_STEP = RUN4D_PLAYER_RADIUS * 0.35;
const RUN4D_PLAYER_NUDGES = [0, 0.04, -0.04, 0.08, -0.08, 0.12, -0.12];
const RUN4D_SLICE_SWEEP_STEP = 0.028;
const RUN4D_DEFAULT_PITCH = -12 * Math.PI / 180;

function pointInBox4dRun(x, y, z, box) {
    return x >= box.x0 + 0.0005 && x <= box.x1 - 0.0005
        && y >= box.y0 + 0.0005 && y <= box.y1 - 0.0005
        && z >= box.z0 + 0.0005 && z <= box.z1 - 0.0005;
}

function pointPassable4dRun(x, y, z, cs) {
    if (!cs) return false;
    if (cs.startBox && pointInBox4dRun(x, y, z, cs.startBox)) return true;
    if (cs.endBox && pointInBox4dRun(x, y, z, cs.endBox)) return true;
    for (const box of cs.passable) {
        if (pointInBox4dRun(x, y, z, box)) return true;
    }
    return false;
}

function canOccupy4dRun(x, y, z, cs) {
    const r = RUN4D_PLAYER_RADIUS;
    const d = r * Math.SQRT1_2;
    const samples = [
        [0, 0, 0],
        [r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r],
        [d, d, 0], [d, -d, 0], [-d, d, 0], [-d, -d, 0],
        [d, 0, d], [d, 0, -d], [-d, 0, d], [-d, 0, -d],
        [0, d, d], [0, d, -d], [0, -d, d], [0, -d, -d],
    ];
    for (const [dx, dy, dz] of samples) {
        if (!pointPassable4dRun(x + dx, y + dy, z + dz, cs)) return false;
    }
    return true;
}

function clampToWorld4dRun(x, y, z) {
    const n = run4dState.gridSize;
    return {
        x: Math.max(-0.5, Math.min(n + 0.5, x)),
        y: Math.max(-0.5, Math.min(n + 0.5, y)),
        z: Math.max(-1.0, Math.min(n, z)),
    };
}

function sweepMove4dRun(dx, dy, dz, cs) {
    const startX = run4dState.player.x;
    const startY = run4dState.player.y;
    const startZ = run4dState.player.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 1e-9) {
        return { moved: false, blocked: false, reached: true, usedDx: 0, usedDy: 0, usedDz: 0 };
    }

    const steps = Math.max(1, Math.ceil(dist / RUN4D_PLAYER_SWEEP_STEP));
    let blocked = false;
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const candidate = clampToWorld4dRun(startX + dx * t, startY + dy * t, startZ + dz * t);
        if (!canOccupy4dRun(candidate.x, candidate.y, candidate.z, cs)) {
            blocked = true;
            break;
        }
        run4dState.player.x = candidate.x;
        run4dState.player.y = candidate.y;
        run4dState.player.z = candidate.z;
    }

    const usedDx = run4dState.player.x - startX;
    const usedDy = run4dState.player.y - startY;
    const usedDz = run4dState.player.z - startZ;
    const moved = Math.hypot(usedDx, usedDy, usedDz) > 1e-8;
    const reached = !blocked
        && Math.abs(usedDx - dx) < 0.0006
        && Math.abs(usedDy - dy) < 0.0006
        && Math.abs(usedDz - dz) < 0.0006;
    return { moved, blocked, reached, usedDx, usedDy, usedDz };
}

function stabilizePlayer4dRun(cs, options = {}) {
    const { allowTeleport = true, maxDrift = 1.25, axisOnly = false } = options;
    if (canOccupy4dRun(run4dState.player.x, run4dState.player.y, run4dState.player.z, cs)) return true;

    const origin = { x: run4dState.player.x, y: run4dState.player.y, z: run4dState.player.z };
    const step = 0.045;
    const maxRing = Math.max(1, Math.ceil(maxDrift / step));

    for (let ring = 1; ring <= maxRing; ring++) {
        const candidates = [];
        if (axisOnly) {
            candidates.push([ring, 0, 0], [-ring, 0, 0], [0, ring, 0], [0, -ring, 0], [0, 0, ring], [0, 0, -ring]);
        } else {
            for (let ox = -ring; ox <= ring; ox++) {
                for (let oy = -ring; oy <= ring; oy++) {
                    for (let oz = -ring; oz <= ring; oz++) {
                        if (Math.max(Math.abs(ox), Math.abs(oy), Math.abs(oz)) !== ring) continue;
                        candidates.push([ox, oy, oz]);
                    }
                }
            }
        }
        candidates.sort((a, b) => Math.hypot(a[0], a[1], a[2]) - Math.hypot(b[0], b[1], b[2]));

        for (const [ox, oy, oz] of candidates) {
            const candidate = clampToWorld4dRun(origin.x + ox * step, origin.y + oy * step, origin.z + oz * step);
            if (!canOccupy4dRun(candidate.x, candidate.y, candidate.z, cs)) continue;
            run4dState.player.x = candidate.x;
            run4dState.player.y = candidate.y;
            run4dState.player.z = candidate.z;
            return true;
        }
    }

    if (allowTeleport) {
        const allBoxes = [];
        if (cs.startBox) allBoxes.push(cs.startBox);
        if (cs.endBox) allBoxes.push(cs.endBox);
        for (const box of cs.passable) allBoxes.push(box);

        let best = null;
        let bestDist2 = Infinity;
        for (const box of allBoxes) {
            const cx = (box.x0 + box.x1) * 0.5;
            const cy = (box.y0 + box.y1) * 0.5;
            const cz = (box.z0 + box.z1) * 0.5;
            const d2 = (run4dState.player.x - cx) ** 2 + (run4dState.player.y - cy) ** 2 + (run4dState.player.z - cz) ** 2;
            if (d2 < bestDist2) {
                bestDist2 = d2;
                best = box;
            }
        }
        if (best) {
            run4dState.player.x = (best.x0 + best.x1) * 0.5;
            run4dState.player.y = (best.y0 + best.y1) * 0.5;
            run4dState.player.z = (best.z0 + best.z1) * 0.5;
            return true;
        }
    }

    return false;
}

function tryAxisSlide4dRun(primary, secondary, tertiary, axis, cs) {
    const deltas = { x: 0, y: 0, z: 0 };
    deltas[axis] = primary;
    const direct = sweepMove4dRun(deltas.x, deltas.y, deltas.z, cs);
    if (direct.moved) {
        if (secondary.axis) {
            const s = { x: 0, y: 0, z: 0 };
            s[secondary.axis] = secondary.value;
            sweepMove4dRun(s.x, s.y, s.z, cs);
        }
        if (tertiary.axis) {
            const t = { x: 0, y: 0, z: 0 };
            t[tertiary.axis] = tertiary.value;
            sweepMove4dRun(t.x, t.y, t.z, cs);
        }
        return true;
    }

    const nudgeAxis = axis === 'z' ? ['x', 'y'] : [axis === 'x' ? 'y' : 'x'];
    for (const n of RUN4D_PLAYER_NUDGES) {
        if (n === 0) continue;
        for (const na of nudgeAxis) {
            const attempt = { x: 0, y: 0, z: 0 };
            attempt[axis] = primary;
            attempt[na] = n;
            const moved = sweepMove4dRun(attempt.x, attempt.y, attempt.z, cs);
            if (!moved.moved) continue;
            if (secondary.axis) {
                const s = { x: 0, y: 0, z: 0 };
                s[secondary.axis] = secondary.value;
                sweepMove4dRun(s.x, s.y, s.z, cs);
            }
            if (tertiary.axis) {
                const t = { x: 0, y: 0, z: 0 };
                t[tertiary.axis] = tertiary.value;
                sweepMove4dRun(t.x, t.y, t.z, cs);
            }
            return true;
        }
    }

    return false;
}

function moveWithNudge4dRun(dx, dy, dz, cs) {
    const first = sweepMove4dRun(dx, dy, dz, cs);
    if (first.reached) return;

    const remaining = [
        { axis: 'x', value: dx - first.usedDx, mag: Math.abs(dx - first.usedDx) },
        { axis: 'y', value: dy - first.usedDy, mag: Math.abs(dy - first.usedDy) },
        { axis: 'z', value: dz - first.usedDz, mag: Math.abs(dz - first.usedDz) },
    ].sort((a, b) => b.mag - a.mag);

    for (let i = 0; i < remaining.length; i++) {
        const primary = remaining[i];
        if (primary.mag < 1e-9) continue;
        const second = remaining[(i + 1) % 3];
        const third = remaining[(i + 2) % 3];
        if (tryAxisSlide4dRun(primary.value, second, third, primary.axis, cs)) return;
    }
}

function movePlayer4dRun(dt, cs) {
    stabilizePlayer4dRun(cs);

    let forward = 0;
    let strafe = 0;
    let vertical = 0;
    if (run4dState.keys['KeyW']) forward += 1;
    if (run4dState.keys['KeyS']) forward -= 1;
    if (run4dState.keys['KeyD']) strafe += 1;
    if (run4dState.keys['KeyA']) strafe -= 1;
    if (run4dState.keys['Space']) vertical += 1;
    if (run4dState.keys['ShiftLeft'] || run4dState.keys['ShiftRight']) vertical -= 1;
    if (!forward && !strafe && !vertical) return;

    const sin = Math.sin(run4dState.yaw);
    const cos = Math.cos(run4dState.yaw);
    let dx = sin * forward + cos * strafe;
    let dy = cos * forward - sin * strafe;
    let dz = vertical;
    const mag = Math.hypot(dx, dy, dz);
    if (mag < 1e-9) return;
    const speed = RUN4D_PLAYER_SPEED * dt;
    moveWithNudge4dRun((dx / mag) * speed, (dy / mag) * speed, (dz / mag) * speed, cs);
}

function moveSlice4dRun(dt) {
    let dir = 0;
    if (run4dState.keys['KeyE']) dir += 1;
    if (run4dState.keys['KeyQ']) dir -= 1;
    if (!dir || !run4dState.gridSize) return false;

    const bounds = getSliceBounds4dRun(run4dState.gridSize);
    const startSlice = run4dState.hyperSliceOffset;
    const target = Math.max(bounds.min, Math.min(bounds.max, startSlice + dir * RUN4D_SLICE_SPEED * dt));
    const totalDelta = target - startSlice;
    const dist = Math.abs(totalDelta);
    if (dist < 1e-9) return false;

    const steps = Math.max(1, Math.ceil(dist / RUN4D_SLICE_SWEEP_STEP));
    const playerStart = { ...run4dState.player };
    let changed = false;

    for (let i = 1; i <= steps; i++) {
        const candidateSlice = startSlice + totalDelta * (i / steps);
        const candidateCrossSection = buildCrossSection4dRun(run4dState.grid, candidateSlice, run4dState.bfsPath);

        if (canOccupy4dRun(run4dState.player.x, run4dState.player.y, run4dState.player.z, candidateCrossSection)) {
            run4dState.hyperSliceOffset = candidateSlice;
            run4dState.hyperLayer = Math.max(0, Math.min((run4dState.gridSize - 1) * 2, Math.round(candidateSlice * RUN4D_SQ2 - 1)));
            run4dState.crossSection = candidateCrossSection;
            changed = true;
            continue;
        }

        const saved = { ...run4dState.player };
        if (stabilizePlayer4dRun(candidateCrossSection, { allowTeleport: false, maxDrift: 0.36, axisOnly: true })) {
            run4dState.hyperSliceOffset = candidateSlice;
            run4dState.hyperLayer = Math.max(0, Math.min((run4dState.gridSize - 1) * 2, Math.round(candidateSlice * RUN4D_SQ2 - 1)));
            run4dState.crossSection = candidateCrossSection;
            changed = true;
            continue;
        }

        run4dState.player.x = saved.x;
        run4dState.player.y = saved.y;
        run4dState.player.z = saved.z;
        break;
    }

    if (!changed) {
        run4dState.hyperSliceOffset = startSlice;
        run4dState.player.x = playerStart.x;
        run4dState.player.y = playerStart.y;
        run4dState.player.z = playerStart.z;
        run4dState.crossSection = buildCrossSection4dRun(run4dState.grid, run4dState.hyperSliceOffset, run4dState.bfsPath);
    }

    return changed;
}

function initPlayer4dRun() {
    if (!run4dState.crossSection) return false;
    const startBox = run4dState.crossSection.startBox;
    if (startBox) {
        run4dState.player.x = (startBox.x0 + startBox.x1) * 0.5;
        run4dState.player.y = (startBox.y0 + startBox.y1) * 0.5;
        run4dState.player.z = (startBox.z0 + startBox.z1) * 0.5;
    }
    run4dState.yaw = 0;
    run4dState.pitch = RUN4D_DEFAULT_PITCH;
    run4dState.completed = false;
    return true;
}

function playerHitsEnd4dRun(cs) {
    if (!cs || !cs.endBox) return false;
    return pointInBox4dRun(run4dState.player.x, run4dState.player.y, run4dState.player.z, cs.endBox);
}
