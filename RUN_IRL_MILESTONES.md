# RUN IRL Milestones

This document breaks the IRL work into concrete milestones so the feature can be built incrementally without destabilizing the existing scan pages.

It is intentionally more execution-focused than `RUN_IRL_PLAN.md`.

## Purpose

Use this file to answer four questions at any point in the work:

1. What are we building right now?
2. What files should change for that milestone?
3. What does "done" mean?
4. What risks are we explicitly not taking on yet?

The governing strategy is:

- keep `scan3d.html` and `scan4d.html` stable
- build IRL on dedicated routes first
- reuse shared pure helpers only where it reduces risk
- defer refactors until the IRL routes are working

## Current architecture baseline

Before any milestone work, the baseline is:

- 2D lives on `index.html`
- 3D scan/editor lives on `scan3d.html`
- 4D scan/editor lives on `scan4d.html`
- new IRL scaffolds live on `run3d.html` and `run4d.html`
- new IRL bootstrap directories live under:
  - `js/3d-run/`
  - `js/4d-run/`

The following already exist and should be treated as the source of truth where possible:

- 3D grid state and serialization:
  - `js/3d/lattice.js`
- 3D cross-section geometry:
  - `js/3d/geometry.js`
- 3D movement legality and stabilization:
  - `js/3d/player3d.js`
- 4D grid state, serialization, cross-section geometry, movement legality:
  - `js/4d/4d-core.js`

## Milestone 0: Standalone Route Scaffold

### Goal

Establish the IRL routes as separate entry points with their own bootstraps and basic navigation.

This milestone exists to prove the routing and file separation strategy before gameplay work begins.

### Status expectation

After this milestone:

- the existing scan pages still behave exactly as before
- `run3d.html` and `run4d.html` load without script errors
- the new routes are reachable from the existing scan pages
- the new routes can parse URL map parameters even if they do not use them yet

### Primary files

- `run3d.html`
- `run4d.html`
- `js/3d-run/state3d-run.js`
- `js/3d-run/player3d-run.js`
- `js/3d-run/render3d-run.js`
- `js/3d-run/ui3d-run.js`
- `js/3d-run/init3d-run.js`
- `js/4d-run/state4d-run.js`
- `js/4d-run/player4d-run.js`
- `js/4d-run/render4d-run.js`
- `js/4d-run/ui4d-run.js`
- `js/4d-run/init4d-run.js`
- `scan3d.html`
- `scan4d.html`

### Done means

- `run3d.html` loads and shows a visible placeholder
- `run4d.html` loads and shows a visible placeholder
- `scan3d.html` links to `run3d.html`
- `scan4d.html` links to `run4d.html`
- each IRL page links back to its scan counterpart
- `run3d.html` reads `?map3d=` and `?map=`
- `run4d.html` reads `?map4d=`

### Risks

- accidentally importing scan-page assumptions into the new bootstraps
- touching shared UI styles too aggressively before the IRL layout exists

### Explicit non-goals

- no real IRL rendering yet
- no actual movement yet
- no pointer lock yet
- no shared-helper refactor yet

## Milestone 1: 3D Map Load And Core Reuse Boundary

### Goal

Make `run3d.html` load the real 3D maze data using the existing serialization format and define exactly which 3D helpers are reused versus copied.

This milestone is about data flow, not visuals.

### Why it matters

If map loading is not proven early, later rendering work can be misleading because it may be rendering placeholder state instead of the real maze.

### Primary files

- `run3d.html`
- `js/3d-run/init3d-run.js`
- `js/3d-run/state3d-run.js`
- any extracted shared 3D helper file, if needed
- possibly:
  - `js/3d/lattice.js`
  - `js/3d/geometry.js`

### Target approach

Preferred order:

1. Reuse existing serialization logic cleanly if possible.
2. If reuse is blocked by page-global coupling, extract only the pure serializer/grid-loading pieces.
3. Do not force `run3d.html` to load all of `scan3d.html`'s runtime just to decode maps.

### Done means

- `run3d.html?map3d=...` reconstructs the intended 3D maze state
- `run3d.html?map=...` works as an optional fallback
- the runtime can report grid size and successful map load status
- the shared/reused 3D helper boundary is clear in code

### Risks

- `js/3d/lattice.js` currently has page-level dependencies beyond serialization
- pulling in too much scan-page logic would make later isolation harder

### Explicit non-goals

- no final IRL camera yet
- no final floor rendering yet
- no pointer lock yet

## Milestone 2: 3D IRL Walkable Floor

### Goal

Turn the real 3D scan cross-section into a first-person scene:

- white walkable platform
- black infinite void
- no jump
- no gravity

This is the first milestone that should actually feel like the target experience.

### Primary files

- `run3d.html`
- `js/3d-run/render3d-run.js`
- `js/3d-run/player3d-run.js`
- `js/3d-run/state3d-run.js`
- `js/3d-run/init3d-run.js`
- `js/3d-run/ui3d-run.js`
- possibly shared geometry reuse from:
  - `js/3d/geometry.js`
  - `js/3d/player3d.js`

### Technical target

The world should be derived from:

- `buildCrossSection(sliceOffset)`

The legal movement should still be governed by the existing 3D occupancy rules:

- `canOccupy3d`
- `sweepMove3d`
- `moveWithNudge3d`
- `stabilizePlayerInSlice3d`

The major change is input interpretation and rendering, not passability logic.

### Controls for this milestone

- mouse: yaw
- `W`: forward
- `S`: backward
- `A`: strafe left
- `D`: strafe right
- `Q` / `E`: slice down/up

### Done means

- the 3D IRL page renders visible floor geometry from the actual maze
- the player can move with `WASD`
- the player can look left/right with the mouse
- the player cannot walk into void
- `Q/E` changes the slice and the floor updates
- slice changes still use stabilization rather than custom teleport behavior

### Risks

- camera and movement may initially feel mis-scaled
- if collision helpers are too tightly coupled to scan globals, a small extraction may be needed
- rendering may be visually correct but hard to read without a horizon, reticle, or slice HUD

### Explicit non-goals

- no mouse pitch required here
- no gravity
- no jump
- no polish-heavy art pass

## Milestone 3: 3D IRL Usability Pass

### Goal

Make the 3D IRL route feel intentional rather than prototype-only.

### Primary files

- `run3d.html`
- `js/3d-run/ui3d-run.js`
- `js/3d-run/render3d-run.js`
- optional:
  - `css/run.css`

### Candidate improvements

- pointer-lock prompt
- slice readout
- basic reticle
- current map loaded indicator
- stronger start/end visual treatment
- clearer "back to scan" navigation

### Done means

- onboarding is understandable
- the player knows how to enter/exit look mode
- the page communicates that `Q/E` changes the slice
- the route feels stable enough that 4D implementation can follow the same UX pattern

### Risks

- over-polishing before 4D exists
- mixing UX polish with large architectural changes

### Explicit non-goals

- no 4D implementation yet
- no major shared-refactor yet

## Milestone 4: 4D Map Load And Core Reuse Boundary

### Goal

Make `run4d.html` load the real 4D maze data using the existing `map4d` format and define exactly which 4D helpers are reused.

### Why it matters

The 4D mode already has much more real geometry and physics than the 3D IRL target, so a clean data/loading boundary matters before camera work begins.

### Primary files

- `run4d.html`
- `js/4d-run/init4d-run.js`
- `js/4d-run/state4d-run.js`
- possibly extracted shared helpers from:
  - `js/4d/4d-core.js`

### Target approach

Preferred order:

1. Reuse pure serialization and cross-section builders from `js/4d/4d-core.js`.
2. If needed, extract shared pure helpers from `js/4d/4d-core.js`.
3. Do not make `run4d.html` depend on the orbit-camera editor UI from `scan4d.html`.

### Done means

- `run4d.html?map4d=...` reconstructs the intended 4D maze state
- the route can report successful load status and grid size
- the shared/reused 4D helper boundary is clear in code

### Risks

- `js/4d/4d-core.js` currently mixes pure logic with runtime state
- careless reuse could drag scan-page assumptions into IRL code

### Explicit non-goals

- no final first-person render yet
- no final pointer-lock camera yet

## Milestone 5: 4D First-Person Traversal

### Goal

Convert the existing 4D inhabited scan volume into a first-person IRL route with standard mouse-look controls.

### Primary files

- `run4d.html`
- `js/4d-run/render4d-run.js`
- `js/4d-run/player4d-run.js`
- `js/4d-run/state4d-run.js`
- `js/4d-run/ui4d-run.js`
- `js/4d-run/init4d-run.js`
- possibly extracted shared helpers from:
  - `js/4d/4d-core.js`

### Technical target

The rendered world should still come from:

- `buildCrossSection4d(hyperSliceOffset)`

The legal movement should still be governed by:

- `canOccupy4d`
- `sweepMove4d`
- `moveWithNudge4d`
- `stabilizePlayer4d`

The main change is the control scheme and camera transform.

### Controls for this milestone

- mouse: yaw and pitch
- `W`: forward
- `S`: backward
- `A`: strafe left
- `D`: strafe right
- `Space`: ascend
- `Shift`: descend
- `Q` / `E`: shift through the 4th dimension

### Important implementation rule

Pitch affects view only.

Do not make pitch alter horizontal movement direction. Horizontal movement should remain based on yaw, while vertical movement remains explicit on `Space` / `Shift`.

### Done means

- the 4D IRL page renders the real 3D cross-section of the 4D maze
- mouse look controls yaw and pitch
- `WASD` moves relative to the camera's yaw
- `Space` / `Shift` move vertically
- `Q/E` shifts the 4th dimension
- the player stays constrained by the existing 4D legality rules

### Risks

- too much visual clutter from the current scan coloring
- movement can feel disorienting if the camera or speed tuning is poor
- first-person rendering may require a simpler draw strategy than the current orbit renderer

### Explicit non-goals

- no gravity
- no jump impulse
- no exotic 4D visualization beyond the current cross-section model

## Milestone 6: 4D Usability Pass

### Goal

Make the 4D IRL route readable and comfortable enough to use for real exploration.

### Primary files

- `run4d.html`
- `js/4d-run/ui4d-run.js`
- `js/4d-run/render4d-run.js`
- optional:
  - `css/run.css`

### Candidate improvements

- pointer-lock prompt
- hyper-slice readout
- current coordinates readout
- reticle
- clearer start/end indicators
- subtle visual feedback when shifting the 4th dimension

### Done means

- the player can understand how to control the route without reading code
- the hyper-shift mechanic is clearly visible
- the route feels immersive rather than merely functional

### Risks

- visual noise from too much HUD
- spending too long on effects before the core route is robust

## Milestone 7: Sharing Cleanup

### Goal

Refactor only the shared pure pieces that have clearly proven themselves useful across scan and IRL routes.

### This milestone happens late on purpose

Do not do this while core behavior is still moving quickly.

### Candidate outputs

- `js/3d/core3d-shared.js`
- `js/4d/core4d-shared.js`
- `js/shared/pointer-lock.js`
- `css/run.css`

### Good extraction targets

- serializers
- URL map parsing helpers
- pure geometry builders
- small camera/math helpers
- pointer-lock event helpers

### Bad extraction targets

- page bootstraps
- route-specific UI wiring
- anything still changing rapidly

### Done means

- duplication is reduced where it is obviously safe to reduce
- scan routes remain stable
- IRL routes remain readable and isolated

### Risks

- refactoring too broadly after the routes already work
- accidentally re-coupling scan and IRL pages

## Suggested execution order

1. Milestone 0: Standalone Route Scaffold
2. Milestone 1: 3D Map Load And Core Reuse Boundary
3. Milestone 2: 3D IRL Walkable Floor
4. Milestone 3: 3D IRL Usability Pass
5. Milestone 4: 4D Map Load And Core Reuse Boundary
6. Milestone 5: 4D First-Person Traversal
7. Milestone 6: 4D Usability Pass
8. Milestone 7: Sharing Cleanup

## Progress tracking template

Copy this block for active work if needed:

```md
### Active milestone

- Name:
- Goal:
- Files:
- Current blocker:
- Next concrete step:
- Done means:
```

## Definition of success for the whole project

The IRL project is successful when all of the following are true:

- `run3d.html` is a real playable first-person white-platform-over-void route
- `run4d.html` is a real playable first-person route through the current 4D cross-section volume
- both routes use the same existing map formats as the scan pages
- existing `scan3d.html` and `scan4d.html` still work
- the code structure remains understandable enough that future polish does not require a rewrite
