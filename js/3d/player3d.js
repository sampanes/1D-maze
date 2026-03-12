// js/3d/player3d.js — 3D scan player movement and collision

const PLAYER3D_SPEED = 3.9;
const PLAYER3D_RADIUS = 0.14;
const PLAYER3D_NUDGES = [0, 0.05, -0.05, 0.1, -0.1, 0.16, -0.16, 0.22, -0.22];

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
 * Check whether the player circle can occupy a position using center+cardinal samples.
 * @param {number} x
 * @param {number} y
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} cs
 * @returns {boolean}
 */
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

/**
 * Clamp a world position inside the global cross-section bounds.
 * @param {number} x
 * @param {number} y
 * @returns {{x:number,y:number}}
 */
function clampToWorld3d(x, y) {
    const maxX = gridSize3d * SQ2;
    const minY = -gridSize3d / SQ2;
    const maxY = gridSize3d / SQ2;
    return {
        x: Math.max(0 + PLAYER3D_RADIUS, Math.min(maxX - PLAYER3D_RADIUS, x)),
        y: Math.max(minY + PLAYER3D_RADIUS, Math.min(maxY - PLAYER3D_RADIUS, y)),
    };
}

/**
 * Attempt one direct movement step.
 * @param {number} dx
 * @param {number} dy
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} cs
 * @returns {boolean}
 */
function tryMove3d(dx, dy, cs) {
    const c = clampToWorld3d(player3d.x + dx, player3d.y + dy);
    if (canOccupy3d(c.x, c.y, cs)) {
        player3d.x = c.x;
        player3d.y = c.y;
        return true;
    }
    return false;
}

/**
 * Move with orthogonal nudges so the avatar slides around nearby corners naturally.
 * @param {number} dx
 * @param {number} dy
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} cs
 */
function moveWithNudge3d(dx, dy, cs) {
    if (tryMove3d(dx, dy, cs)) return;

    if (Math.abs(dx) > Math.abs(dy)) {
        for (const n of PLAYER3D_NUDGES) {
            if (tryMove3d(dx, n, cs)) return;
        }
        tryMove3d(0, dy, cs);
    } else {
        for (const n of PLAYER3D_NUDGES) {
            if (tryMove3d(n, dy, cs)) return;
        }
        tryMove3d(dx, 0, cs);
    }
}

/**
 * Advance player position from directional input, mapped to the visual 45° grid:
 * left/right travel along one diagonal family; up/down along the other.
 * @param {number} dt
 * @param {{passable:Array,startRect:Object|null,endRect:Object|null,pathRects:Array}} cs
 */
function updatePlayer3d(dt, cs) {
    let dx = 0;
    let dy = 0;
    if (keysDown3d['ArrowLeft'])  { dx -= 1; dy -= 1; }
    if (keysDown3d['ArrowRight']) { dx += 1; dy += 1; }
    if (keysDown3d['ArrowUp'])    { dx += 1; dy -= 1; }
    if (keysDown3d['ArrowDown'])  { dx -= 1; dy += 1; }
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
