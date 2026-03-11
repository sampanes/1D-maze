// js/3d/state3d.js — 3D-specific constants, mutable state, and DOM refs
// Loaded after globals.js and maze-core.js; defines stubs for 2D functions
// that maze-core.js calls but scan-engine.js/init.js are not loaded here.

// ── Constants ───────────────────────────────────────────────────────────────
const SQ2 = Math.SQRT2;
const SLICE_SPEED = 3.5;        // world-Z units per second
const GRID3D_MIN = 2;
const GRID3D_MAX = 16;
const GRID3D_DEFAULT = 5;

// ── Mutable state ────────────────────────────────────────────────────────────
let gridSize3d = GRID3D_DEFAULT;

// grid3d[k][j][i]: k = depth layer, j = row, i = column. 0 = pass, 1 = wall.
let grid3d = [];

// Active diagonal in the editor: d = j+k, range 0 to 2*(N-1).
// Displayed to the user as Layer d+1 (so center d=N-1 → "Layer N").
// Layer nav buttons cycle through all 2N-1 paintable diagonal slices.
let currentLayer = 0;  // set to N-1 (center) by initGrid3d()

// Vertical position of the cutting plane in world-Z (0 = bottom, N·SQ2 = top)
let sliceOffset = 0;

// Player position in world XY of the cross-section
let player3d = { x: 0, y: 0 };

// BFS result: array of [i,j,k] triples, or null
let bfsPath3d = null;
let solvable3d = false;

// Phase flags
let scanActive3d = false;
let peeking3d = false;
let debugMode3d = false;

// Input
const keysDown3d = {};

// Timing
let lastFrameTime3d = 0;
let celebrateUntil3d = 0;

// ── Stubs for 2D functions called by maze-core.js ────────────────────────────
// maze-core.js references resetScannerState() (from init.js) and
// drawScanView() (from scan-engine.js), neither of which are loaded here.

function resetScannerState() {
    // no-op on the 3D page
}

function drawScanView() {
    // no-op on the 3D page; 3D rendering is handled by render3d.js
}

// ── DOM refs for 3D-specific elements ────────────────────────────────────────
const layerPrevBtn   = document.getElementById('layerPrevBtn');
const layerNextBtn   = document.getElementById('layerNextBtn');
const layerDisplay   = document.getElementById('layerDisplay');
const yReadout3d     = document.getElementById('yReadout3d');
const scanCanvas3d   = document.getElementById('scanCanvas');   // reuses shared ID
const scanCtx3d      = scanCanvas3d.getContext('2d');
