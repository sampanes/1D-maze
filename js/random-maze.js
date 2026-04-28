(function(global) {
    'use strict';

    const DEFAULT_MIN_WALL_RATIO = 0.4;
    const TARGET_WALL_MIN = 0.42;
    const TARGET_WALL_MAX = 0.56;

    function coordKey(coord) {
        return coord.join(',');
    }

    function sameCoord(a, b) {
        return a.length === b.length && a.every((value, idx) => value === b[idx]);
    }

    function randomInt(maxExclusive) {
        return Math.floor(Math.random() * maxExclusive);
    }

    function shuffled(items) {
        const result = items.slice();
        for (let i = result.length - 1; i > 0; i--) {
            const j = randomInt(i + 1);
            const tmp = result[i];
            result[i] = result[j];
            result[j] = tmp;
        }
        return result;
    }

    function getNeighbors(coord, size) {
        const neighbors = [];
        for (let axis = 0; axis < coord.length; axis++) {
            for (const delta of [-1, 1]) {
                const next = coord.slice();
                next[axis] += delta;
                if (next[axis] >= 0 && next[axis] < size) neighbors.push(next);
            }
        }
        return neighbors;
    }

    function buildRandomSpine(size, start, end) {
        const current = start.slice();
        const spine = [current.slice()];

        while (!sameCoord(current, end)) {
            const axes = [];
            for (let axis = 0; axis < current.length; axis++) {
                if (current[axis] !== end[axis]) axes.push(axis);
            }

            const axis = axes[randomInt(axes.length)];
            current[axis] += Math.sign(end[axis] - current[axis]);
            spine.push(current.slice());
        }

        return spine;
    }

    function addFrontierFrom(coord, size, openKeys, frontier, frontierKeys) {
        for (const neighbor of shuffled(getNeighbors(coord, size))) {
            const key = coordKey(neighbor);
            if (openKeys.has(key) || frontierKeys.has(key)) continue;
            frontier.push(neighbor);
            frontierKeys.add(key);
        }
    }

    function growConnectedOpenSet(size, openCoords, targetOpenCount) {
        const openKeys = new Set(openCoords.map(coordKey));
        const frontier = [];
        const frontierKeys = new Set();

        for (const coord of shuffled(openCoords)) {
            addFrontierFrom(coord, size, openKeys, frontier, frontierKeys);
        }

        while (openCoords.length < targetOpenCount && frontier.length) {
            const idx = randomInt(frontier.length);
            const coord = frontier[idx];
            frontier[idx] = frontier[frontier.length - 1];
            frontier.pop();

            const key = coordKey(coord);
            frontierKeys.delete(key);
            if (openKeys.has(key)) continue;

            openKeys.add(key);
            openCoords.push(coord);
            addFrontierFrom(coord, size, openKeys, frontier, frontierKeys);
        }

        return openKeys;
    }

    function generateRandomSolvableMaze(options) {
        const size = options.size;
        const dimensions = options.dimensions;
        const start = options.start;
        const end = options.end;
        const minWallRatio = options.minWallRatio || DEFAULT_MIN_WALL_RATIO;

        if (!Number.isInteger(size) || size < 2) {
            throw new Error('Random maze size must be an integer >= 2.');
        }
        if (!Number.isInteger(dimensions) || dimensions < 2) {
            throw new Error('Random maze dimensions must be an integer >= 2.');
        }
        if (!Array.isArray(start) || !Array.isArray(end) || start.length !== dimensions || end.length !== dimensions) {
            throw new Error('Random maze start/end coordinates must match dimensions.');
        }

        const totalCells = size ** dimensions;
        const targetWallRatio = TARGET_WALL_MIN + Math.random() * (TARGET_WALL_MAX - TARGET_WALL_MIN);
        const minWallCount = Math.ceil(totalCells * minWallRatio);
        const requestedWallCount = Math.max(minWallCount, Math.floor(totalCells * targetWallRatio));

        const spine = buildRandomSpine(size, start, end);
        const maxWallCount = totalCells - spine.length;
        const targetWallCount = Math.min(requestedWallCount, maxWallCount);
        const targetOpenCount = totalCells - targetWallCount;
        const openKeys = growConnectedOpenSet(size, spine.map((coord) => coord.slice()), targetOpenCount);
        const wallCount = totalCells - openKeys.size;

        return {
            openKeys,
            wallCount,
            wallRatio: wallCount / totalCells,
            pathLength: spine.length,
            targetWallRatio,
        };
    }

    global.generateRandomSolvableMaze = generateRandomSolvableMaze;
})(window);
