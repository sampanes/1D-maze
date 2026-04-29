(function(global) {
    'use strict';

    const DEFAULT_MIN_WALL_RATIO = 0.4;
    const DIFFICULTY_PROFILES = {
        easy: { label: 'Easy', minWallRatio: 0.4, targetWallMin: 0.40, targetWallMax: 0.48 },
        normal: { label: 'Normal', minWallRatio: 0.4, targetWallMin: 0.46, targetWallMax: 0.56 },
        hard: { label: 'Hard', minWallRatio: 0.4, targetWallMin: 0.56, targetWallMax: 0.68 },
    };

    function coordKey(coord) {
        return coord.join(',');
    }

    function sameCoord(a, b) {
        return a.length === b.length && a.every((value, idx) => value === b[idx]);
    }

    function hashSeed(seed) {
        let h = 2166136261;
        const text = String(seed);
        for (let i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    function createRandom(seed) {
        if (seed === undefined || seed === null || seed === '') return Math.random;
        let state = hashSeed(seed);
        return function seededRandom() {
            state += 0x6D2B79F5;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function randomInt(maxExclusive, random) {
        return Math.floor(random() * maxExclusive);
    }

    function shuffled(items, random) {
        const result = items.slice();
        for (let i = result.length - 1; i > 0; i--) {
            const j = randomInt(i + 1, random);
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

    function buildRandomSpine(size, start, end, random) {
        const current = start.slice();
        const spine = [current.slice()];

        while (!sameCoord(current, end)) {
            const axes = [];
            for (let axis = 0; axis < current.length; axis++) {
                if (current[axis] !== end[axis]) axes.push(axis);
            }

            const axis = axes[randomInt(axes.length, random)];
            current[axis] += Math.sign(end[axis] - current[axis]);
            spine.push(current.slice());
        }

        return spine;
    }

    function addFrontierFrom(coord, size, openKeys, frontier, frontierKeys, random) {
        for (const neighbor of shuffled(getNeighbors(coord, size), random)) {
            const key = coordKey(neighbor);
            if (openKeys.has(key) || frontierKeys.has(key)) continue;
            frontier.push(neighbor);
            frontierKeys.add(key);
        }
    }

    function growConnectedOpenSet(size, openCoords, targetOpenCount, random) {
        const openKeys = new Set(openCoords.map(coordKey));
        const frontier = [];
        const frontierKeys = new Set();

        for (const coord of shuffled(openCoords, random)) {
            addFrontierFrom(coord, size, openKeys, frontier, frontierKeys, random);
        }

        while (openCoords.length < targetOpenCount && frontier.length) {
            const idx = randomInt(frontier.length, random);
            const coord = frontier[idx];
            frontier[idx] = frontier[frontier.length - 1];
            frontier.pop();

            const key = coordKey(coord);
            frontierKeys.delete(key);
            if (openKeys.has(key)) continue;

            openKeys.add(key);
            openCoords.push(coord);
            addFrontierFrom(coord, size, openKeys, frontier, frontierKeys, random);
        }

        return openKeys;
    }

    function getDifficultyProfile(difficulty) {
        return DIFFICULTY_PROFILES[difficulty] || DIFFICULTY_PROFILES.normal;
    }

    function getLocalDateStamp(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getDailyMazeSeed(options) {
        const dateStamp = options.dateStamp || getLocalDateStamp();
        const difficulty = options.difficulty || 'normal';
        const seed = `daily:${dateStamp}:${options.dimensions}d:n${options.size}:${difficulty}`;
        return { seed, dateStamp };
    }

    function generateRandomSolvableMaze(options) {
        const size = options.size;
        const dimensions = options.dimensions;
        const start = options.start;
        const end = options.end;
        const profile = getDifficultyProfile(options.difficulty);
        const minWallRatio = options.minWallRatio || profile.minWallRatio || DEFAULT_MIN_WALL_RATIO;
        const random = createRandom(options.seed);

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
        const targetWallRatio = profile.targetWallMin + random() * (profile.targetWallMax - profile.targetWallMin);
        const minWallCount = Math.ceil(totalCells * minWallRatio);
        const requestedWallCount = Math.max(minWallCount, Math.floor(totalCells * targetWallRatio));

        const spine = buildRandomSpine(size, start, end, random);
        const maxWallCount = totalCells - spine.length;
        const targetWallCount = Math.min(requestedWallCount, maxWallCount);
        const targetOpenCount = totalCells - targetWallCount;
        const openKeys = growConnectedOpenSet(size, spine.map((coord) => coord.slice()), targetOpenCount, random);
        const wallCount = totalCells - openKeys.size;

        return {
            openKeys,
            wallCount,
            wallRatio: wallCount / totalCells,
            pathLength: spine.length,
            targetWallRatio,
            difficulty: profile.label,
        };
    }

    global.generateRandomSolvableMaze = generateRandomSolvableMaze;
    global.getDailyMazeSeed = getDailyMazeSeed;
})(window);
