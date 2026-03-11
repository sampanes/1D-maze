// Game constants
const EPS = 0.035;
const MOVE_SPEED_V = 6.5; // per second
const MOVE_SPEED_U = 5.2; // per second
const NUDGE_OFFSETS = [0.06, -0.06, 0.12, -0.12, 0.18, -0.18, 0.26, -0.26];
const SAMPLE_SUBDIVISIONS = 5;

// Mutable game state
let gridSize = 16;
let grid = [];
let bfsPath = null;
let solvable = false;

let cellSize = 24;
let canvasSize = 384;

let painting = false;
let paintMode = 1;

let scanActive = false;
let peeking = false;
let player = { u: 0, v: 1 };
let avatarSquish = 0;
let celebrateUntil = 0;
let winResetHandle = null;
const keysDown = {};

let audioCtx = null;
let lastFrameTime = performance.now();
let toastTimer = null;

// DOM element references
const mazeCanvas = document.getElementById('mazeCanvas');
const mazeCtx = mazeCanvas.getContext('2d');
const scanCanvas = document.getElementById('scanCanvas');
const scanCtx = scanCanvas.getContext('2d');

const diamondContainer = document.getElementById('diamondContainer');
const startLabel = document.getElementById('startLabel');
const endLabel = document.getElementById('endLabel');

const mazeSection = document.getElementById('mazeSection');
const scanSection = document.getElementById('scanSection');
const peekHint = document.getElementById('peekHint');
const statusBar = document.getElementById('statusBar');

const gridSlider = document.getElementById('gridSlider');
const gridVal = document.getElementById('gridVal');
const btnWipe = document.getElementById('btnWipe');
const btnValidate = document.getElementById('btnValidate');
const btnGetLink = document.getElementById('btnGetLink');
const btnScan = document.getElementById('btnScan');
const btnBack = document.getElementById('btnBack');
const toast = document.getElementById('toast');

const rowReadout = document.getElementById('rowReadout');
const colReadout = document.getElementById('colReadout');
const cellReadout = document.getElementById('cellReadout');
const btnToggleDetails = document.getElementById('btnToggleDetails');
const mobileCollapseGroup = document.getElementById('mobileCollapseGroup');
