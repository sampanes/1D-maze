// js/3d/player3d.js — 3D scan player movement and collision

const PLAYER3D_SPEED = 3.9;
const PLAYER3D_RADIUS = 0.14;
const PLAYER3D_NUDGES = [0, 0.05, -0.05, 0.1, -0.1, 0.16, -0.16, 0.22, -0.22, 0.3, -0.3];
let player3dLastBlockedAt = 0;

function pointInRect3d(x, y, r) {
    return x >= r.x0 + 0.0005 && x <= r.x1 - 0.0005 && y >= r.y0 + 0.0005 && y <= r.y1 - 0.0005;
}

function pointPassable3d(x, y, cs) {
    if (cs.startRect && pointInRect3d(x, y, cs.startRect)) return true;
    if (cs.endRect && pointInRect3d(x, y, cs.endRect)) return true;
    for (const r of cs.passable) {
        if (pointInRect3d(x, y, r)) return true;
    }
    return false;
}

function canOccupy3d(x, y, cs) {
    const samples = [
        [0, 0],
        [PLAYER3D_RADIUS, 0], [-PLAYER3D_RADIUS, 0],
        [0, PLAYER3D_RADIUS], [0, -PLAYER3D_RADIUS],
    ];
    for (const [dx, dy] of samples) {
        if (!pointPassable3d(x + dx, y + dy, cs)) return false;
    }
    return true;
}

function clampToWorld3d(x, y) {
    const maxX = gridSize3d * SQ2;
    const minY = -gridSize3d / SQ2;
    const maxY = gridSize3d / SQ2;
    return {
        x: Math.max(0 + PLAYER3D_RADIUS, Math.min(maxX - PLAYER3D_RADIUS, x)),
        y: Math.max(minY + PLAYER3D_RADIUS, Math.min(maxY - PLAYER3D_RADIUS, y)),
    };
}


function clampPointToRect3d(x, y, r, margin = PLAYER3D_RADIUS + 0.002) {
    const minX = r.x0 + margin;
    const maxX = r.x1 - margin;
    const minY = r.y0 + margin;
    const maxY = r.y1 - margin;
    return {
        x: Math.max(minX, Math.min(maxX, x)),
        y: Math.max(minY, Math.min(maxY, y)),
    };
}

function getAllWalkableRects3d(cs) {
    const arr = [];
    if (cs.startRect) arr.push(cs.startRect);
    if (cs.endRect) arr.push(cs.endRect);
    for (const r of cs.passable) arr.push(r);
    return arr;
}

function tryMove3d(dx, dy, cs) {
    const c = clampToWorld3d(player3d.x + dx, player3d.y + dy);
    if (canOccupy3d(c.x, c.y, cs)) {
        player3d.x = c.x;
        player3d.y = c.y;
        return true;
    }
    return false;
}

function noteBlocked3d() {
    const now = performance.now();
    if (now - player3dLastBlockedAt > 150) {
        playMerp();
        player3dLastBlockedAt = now;
    }
}

function moveWithNudge3d(dx, dy, cs) {
    if (tryMove3d(dx, dy, cs)) return true;

    if (Math.abs(dx) > Math.abs(dy)) {
        for (const n of PLAYER3D_NUDGES) {
            if (tryMove3d(dx, n, cs)) return true;
        }
        if (tryMove3d(0, dy, cs)) return true;
    } else {
        for (const n of PLAYER3D_NUDGES) {
            if (tryMove3d(n, dy, cs)) return true;
        }
        if (tryMove3d(dx, 0, cs)) return true;
    }

    noteBlocked3d();
    return false;
}

function resolvePlayerIntoCrossSection3d(cs) {
    if (canOccupy3d(player3d.x, player3d.y, cs)) return true;

    for (const ox of PLAYER3D_NUDGES) {
        for (const oy of PLAYER3D_NUDGES) {
            const c = clampToWorld3d(player3d.x + ox, player3d.y + oy);
            if (canOccupy3d(c.x, c.y, cs)) {
                player3d.x = c.x;
                player3d.y = c.y;
                return true;
            }
        }
    }

    // Hard fallback: snap to nearest point inside any currently walkable rect.
    const walkable = getAllWalkableRects3d(cs);
    let best = null;
    let bestD2 = Infinity;
    for (const r of walkable) {
        if ((r.x1 - r.x0) <= 2 * PLAYER3D_RADIUS || (r.y1 - r.y0) <= 2 * PLAYER3D_RADIUS) continue;
        const c = clampPointToRect3d(player3d.x, player3d.y, r);
        const d2 = (c.x - player3d.x) ** 2 + (c.y - player3d.y) ** 2;
        if (d2 < bestD2) {
            bestD2 = d2;
            best = c;
        }
    }
    if (best) {
        player3d.x = best.x;
        player3d.y = best.y;
        return true;
    }

    noteBlocked3d();
    return false;
}

function updatePlayer3d(dt, cs) {
    let dx = 0;
    let dy = 0;
    if (keysDown3d['ArrowLeft']) dx -= 1;
    if (keysDown3d['ArrowRight']) dx += 1;
    if (keysDown3d['ArrowUp']) dy += 1;
    if (keysDown3d['ArrowDown']) dy -= 1;
    if (!dx && !dy) return;

    const m = Math.hypot(dx, dy);
    const speed = PLAYER3D_SPEED * dt;
    moveWithNudge3d((dx / m) * speed, (dy / m) * speed, cs);
}

function playerHitsEnd3d(cs) {
    if (!cs.endRect) return false;
    return pointInRect3d(player3d.x, player3d.y, cs.endRect);
}
