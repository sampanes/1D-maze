// js/3d/player3d.js — 3D scan player movement and collision

const PLAYER3D_SPEED = 3.9;
const PLAYER3D_RADIUS = 0.14;
const PLAYER3D_SWEEP_STEP = PLAYER3D_RADIUS * 0.32;
const PLAYER3D_BLOCKED_BEEP_COOLDOWN_MS = 130;
let lastBlockedBeepAt3d = 0;

/**
 * Test whether a point is safely inside a slice rectangle with a tiny inset tolerance.
 * @param {number} x
 * @param {number} y
 * @param {{x0:number,x1:number,y0:number,y1:number}} r
 * @returns {boolean}
 */
function pointInRect3d(x, y, r) {
    return x >= r.x0 + 0.0005 && x <= r.x1 - 0.0005 && y >= r.y0 + 0.0005 && y <= r.y1 - 0.0005;
}

/**
 * Check whether a point lies in any walkable slice region.
 * @param {number} x
 * @param {number} y
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} cs
 * @returns {boolean}
 */
function pointPassable3d(x, y, cs) {
    if (cs.startRect && pointInRect3d(x, y, cs.startRect)) return true;
    if (cs.endRect && pointInRect3d(x, y, cs.endRect)) return true;
    for (const r of cs.passable) {
        if (pointInRect3d(x, y, r)) return true;
    }
    return false;
}

/**
 * Check whether the player circle can occupy a position.
 * Uses center + cardinal + diagonal samples to prevent clipping through
 * concave corners (cardinal-only checks can miss diagonal corner intrusions).
 * @param {number} x
 * @param {number} y
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} cs
 * @returns {boolean}
 */
function canOccupy3d(x, y, cs) {
    const d = PLAYER3D_RADIUS * Math.SQRT1_2;
    const samples = [
        [0, 0],
        [PLAYER3D_RADIUS, 0], [-PLAYER3D_RADIUS, 0],
        [0, PLAYER3D_RADIUS], [0, -PLAYER3D_RADIUS],
        [d, d], [d, -d], [-d, d], [-d, -d],
    ];
    for (const [dx, dy] of samples) {
        if (!pointPassable3d(x + dx, y + dy, cs)) return false;
    }
    return true;
}

/**
 * Clamp a world position inside the global cross-section bounds.
 * @param {number} x
 * @param {number} y
 * @returns {{x:number,y:number}}
 */
function clampToWorld3d(x, y) {
    const minX = -gridSize3d / SQ2;
    const maxX = gridSize3d / SQ2;
    const minY = 0;
    const maxY = gridSize3d * SQ2;
    return {
        x: Math.max(minX + PLAYER3D_RADIUS, Math.min(maxX - PLAYER3D_RADIUS, x)),
        y: Math.max(minY + PLAYER3D_RADIUS, Math.min(maxY - PLAYER3D_RADIUS, y)),
    };
}

/**
<<<<<<< HEAD
=======
 * Play the blocked sound/status with a short cooldown to avoid audio spam while
 * a key is held down against a wall.
 */
function triggerBlocked3d() {
    const now = performance.now();
    if (now - lastBlockedBeepAt3d >= PLAYER3D_BLOCKED_BEEP_COOLDOWN_MS) {
        playMerp();
        lastBlockedBeepAt3d = now;
    }
    setStatus('Merp — Wall collision.', 'error');
}

/**
 * Sweep movement from the current player position toward (dx,dy) in small
 * increments so we never tunnel through thin walls or corners.
 * Returns whether any motion happened and whether we hit an obstruction.
 * @param {number} dx
 * @param {number} dy
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} cs
 * @returns {{moved:boolean,blocked:boolean,usedDx:number,usedDy:number}}
 */
function sweepMove3d(dx, dy, cs) {
    const startX = player3d.x;
    const startY = player3d.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-9) {
        return { moved: false, blocked: false, usedDx: 0, usedDy: 0 };
    }

    const steps = Math.max(1, Math.ceil(dist / PLAYER3D_SWEEP_STEP));
    let blocked = false;

    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const candidate = clampToWorld3d(startX + dx * t, startY + dy * t);
        if (!canOccupy3d(candidate.x, candidate.y, cs)) {
            blocked = true;
            break;
        }
        player3d.x = candidate.x;
        player3d.y = candidate.y;
    }

    const usedDx = player3d.x - startX;
    const usedDy = player3d.y - startY;
    const moved = Math.hypot(usedDx, usedDy) > 1e-8;
    return { moved, blocked, usedDx, usedDy };
}

/**
 * Resolve one axis movement using swept collision.
 * @param {number} delta
 * @param {boolean} axisX
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} cs
 * @returns {{moved:boolean,blocked:boolean}}
 */
function sweepAxis3d(delta, axisX, cs) {
    if (Math.abs(delta) < 1e-9) return { moved: false, blocked: false };
    const r = axisX ? sweepMove3d(delta, 0, cs) : sweepMove3d(0, delta, cs);
    return { moved: r.moved, blocked: r.blocked };
}

/**
>>>>>>> codex/fix-wall-collision-behavior-in-3d-maze-dlycb0
 * Play the blocked sound/status with a short cooldown to avoid audio spam while
 * a key is held down against a wall.
 */
function triggerBlocked3d() {
    const now = performance.now();
    if (now - lastBlockedBeepAt3d >= PLAYER3D_BLOCKED_BEEP_COOLDOWN_MS) {
        playMerp();
        lastBlockedBeepAt3d = now;
    }
    setStatus('Merp — Wall collision.', 'error');
}

/**
 * Sweep movement from the current player position toward (dx,dy) in small
 * increments so we never tunnel through thin walls or corners.
 * Returns whether any motion happened and whether we hit an obstruction.
 * @param {number} dx
 * @param {number} dy
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} cs
 * @returns {{moved:boolean,blocked:boolean,usedDx:number,usedDy:number}}
 */
function sweepMove3d(dx, dy, cs) {
    const startX = player3d.x;
    const startY = player3d.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-9) {
        return { moved: false, blocked: false, usedDx: 0, usedDy: 0 };
    }

    const steps = Math.max(1, Math.ceil(dist / PLAYER3D_SWEEP_STEP));
    let blocked = false;

    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const candidate = clampToWorld3d(startX + dx * t, startY + dy * t);
        if (!canOccupy3d(candidate.x, candidate.y, cs)) {
            blocked = true;
            break;
        }
        player3d.x = candidate.x;
        player3d.y = candidate.y;
    }

    const usedDx = player3d.x - startX;
    const usedDy = player3d.y - startY;
    const moved = Math.hypot(usedDx, usedDy) > 1e-8;
    return { moved, blocked, usedDx, usedDy };
}

/**
 * Resolve one axis movement using swept collision.
 * @param {number} delta
 * @param {boolean} axisX
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} cs
 * @returns {{moved:boolean,blocked:boolean}}
 */
function sweepAxis3d(delta, axisX, cs) {
    if (Math.abs(delta) < 1e-9) return { moved: false, blocked: false };
    const r = axisX ? sweepMove3d(delta, 0, cs) : sweepMove3d(0, delta, cs);
    return { moved: r.moved, blocked: r.blocked };
}

/**
 * Move with axis-separated swept collision.
 *
 * Math intuition:
 * - We still request the same target delta (dx,dy) from input.
 * - We resolve one component, then the other.
 * - If one axis is blocked and the other is free, the free component survives,
 *   which yields natural wall-sliding.
 * - If both are blocked from the current position, emit Merp and stop.
 *
 * This mirrors typical tile/cell collision handling and avoids "pop" behaviour
 * caused by large orthogonal nudges after a diagonal impact.
 * @param {number} dx
 * @param {number} dy
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} cs
 */
function moveWithNudge3d(dx, dy, cs) {
    const xFirst = Math.abs(dx) >= Math.abs(dy);
    const first = xFirst ? sweepAxis3d(dx, true, cs) : sweepAxis3d(dy, false, cs);
    const second = xFirst ? sweepAxis3d(dy, false, cs) : sweepAxis3d(dx, true, cs);

    const moved = first.moved || second.moved;
    const blockedHard = !moved && (first.blocked || second.blocked);
    if (blockedHard) {
        triggerBlocked3d();
    }
}

/**
 * Attempt to relocate the player into valid space after slice changes shrink/grow the map.
 * Uses a bounded nearest-first search to avoid long-distance repositioning pops.
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} cs
 * @returns {boolean}
 */
function stabilizePlayerInSlice3d(cs) {
    if (canOccupy3d(player3d.x, player3d.y, cs)) return true;

    const origin = { x: player3d.x, y: player3d.y };
    const step = 0.045;
    const maxDrift = 1.2;
    const maxRing = Math.max(12, Math.ceil(maxDrift / step));

    for (let ring = 1; ring <= maxRing; ring++) {
        const candidates = [];
        for (let ox = -ring; ox <= ring; ox++) {
            candidates.push([ox, -ring], [ox, ring]);
        }
        for (let oy = -ring + 1; oy <= ring - 1; oy++) {
            candidates.push([-ring, oy], [ring, oy]);
        }

        candidates.sort((a, b) => {
            const da = Math.hypot(a[0], a[1]);
            const db = Math.hypot(b[0], b[1]);
            return da - db;
        });

        for (const [ox, oy] of candidates) {
            const c = clampToWorld3d(origin.x + ox * step, origin.y + oy * step);
            if (!canOccupy3d(c.x, c.y, cs)) continue;
            player3d.x = c.x;
            player3d.y = c.y;
            return true;
        }
    }

    return false;
}

/**
 * Advance player position from directional input, mapped to the visual 45° grid:
 * left/right travel along one diagonal family; up/down along the other.
 * Includes pre-move stabilization so shrinking slices cannot leave the avatar in void space.
 * @param {number} dt
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} cs
 */
function updatePlayer3d(dt, cs) {
    stabilizePlayerInSlice3d(cs);

    let dx = 0;
    let dy = 0;
    if (keysDown3d['ArrowLeft'])  { dx -= 1; dy -= 1; }
    if (keysDown3d['ArrowRight']) { dx += 1; dy += 1; }
    if (keysDown3d['ArrowUp'])    { dx -= 1; dy += 1; }
    if (keysDown3d['ArrowDown'])  { dx += 1; dy -= 1; }
    if (!dx && !dy) return;

    const m = Math.hypot(dx, dy);
    const speed = PLAYER3D_SPEED * dt;
    moveWithNudge3d((dx / m) * speed, (dy / m) * speed, cs);
}

/**
 * Check if the player is currently inside the end-cell slice rectangle.
 * @param {{endRect:Object|null}} cs
 * @returns {boolean}
 */
function playerHitsEnd3d(cs) {
    if (!cs.endRect) return false;
    return pointInRect3d(player3d.x, player3d.y, cs.endRect);
}
