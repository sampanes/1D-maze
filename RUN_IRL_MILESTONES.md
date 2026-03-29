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

The governing visual/gameplay invariant is:

- preserve the existing 45 degree continuous slice paradigm
- preserve smooth slice-driven world morphing
- only change the point of view and controls, not the underlying maze interpretation

Stretch-goal invariant:

- if a POV route is later added for the original 2D map / 1D runner, it must still preserve the existing 1D runner logic rather than turning into a free-roaming path game

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

This means:

- Milestone work must not accidentally drift into a discrete-floor interpretation
- If a milestone result looks like stepping between layers instead of smoothly morphing between them, it is not complete

## Milestone 0: Standalone Route Scaffold

Status: complete

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

Status: working

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
- the browser route includes a visible decode/test surface large enough to use without devtools
- known-good sample maps can be loaded directly from the page for quick verification

### Current implementation notes

At the current checkpoint, Milestone 1 is effectively in place:

- `run3d.html` decodes `?map3d=` and `?map=`
- BFS status, grid size, path length, and wall count are reported on-page
- the page includes built-in sample-map buttons
- the page no longer depends on the `scan3d.html` bootstrap to validate map decoding

Remaining value from this milestone can be treated as maintenance only if future refactors threaten the clean boundary.

### Risks

- `js/3d/lattice.js` currently has page-level dependencies beyond serialization
- pulling in too much scan-page logic would make later isolation harder

### Explicit non-goals

- no final IRL camera yet
- no final floor rendering yet
- no pointer lock yet

## Milestone 2: 3D IRL Continuous Slice Embodiment

Status: in progress, first playable pass exists

### Goal

Turn the real 3D scan cross-section into an embodied POV scene:

- white walkable platform
- black infinite void
- no jump
- no gravity

This is the first milestone that should actually feel like the target experience.

The key design constraint for this milestone is:

- the platform must still be the same continuous 45 degree slice-world you already have now
- the player is simply inhabiting it

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

The slice behavior must remain:

- continuous
- smooth
- visibly morphing as `sliceOffset` changes

This milestone must not collapse into:

- discrete floor swapping
- editor-layer stepping
- a generic voxel floor model

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
- the player can look slightly up/down with a clamped pitch
- the player cannot walk into void
- `Q/E` changes the slice and the floor updates
- slice changes still use stabilization rather than custom teleport behavior
- `Q/E` changes produce smooth continuous platform morphing, not stepped transitions
- the IRL view still clearly reads as the same diagonal 45 degree paradigm, only embodied
- near-miss movement keeps the original nudge/slide feel where possible
- when slice morphing pinches the player, `Q/E` stops rather than popping to an unrelated legal island

### Risks

- camera and movement may initially feel mis-scaled
- if collision helpers are too tightly coupled to scan globals, a small extraction may be needed
- rendering may be visually correct but hard to read without a horizon, reticle, or slice HUD

### Current implementation notes

At the current checkpoint, the first playable pass already exists:

- the camera is over-shoulder rather than abstract
- mouse yaw is active
- mouse pitch is lightly clamped for subtle up/down viewing
- `WASD` movement is active on the embodied slice-world
- `Q/E` smoothly morphs the continuous slice
- completion detection exists and uses a celebratory avatar state rather than freezing all interaction

Known follow-up work still belongs here or in Milestone 3:

- continue tuning movement feel
- decide whether `WASD` should be allowed to borrow a small amount of invisible-dimension nudge
- improve readability only where necessary without drifting into a different world model

### Explicit non-goals

- no mouse pitch required here
- no gravity
- no jump
- no polish-heavy art pass
- no reinterpretation of the maze as stacked discrete levels

## Milestone 3: 3D IRL Usability Pass

Status: in progress

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
- a thin glowing green locator rod from the avatar marker down to the current floor contact point
- subtle contact shadows under the player marker and readable floor surfaces

### Done means

- onboarding is understandable
- the player knows how to enter/exit look mode
- the page communicates that `Q/E` changes the slice
- the route feels stable enough that 4D implementation can follow the same UX pattern
- the player can intuitively tell where they are standing on the platform
- the scene reads spatially without needing heavy realistic lighting

### Current implementation notes

Some Milestone 3 polish has already started because it directly improved playability:

- a thin glowing green locator rod is already present
- subtle contact shadows are already present
- the completion state has a lightweight celebratory marker

That is acceptable. The remaining Milestone 3 work should still be deliberate and restrained.

### Risks

- over-polishing before 4D exists
- mixing UX polish with large architectural changes

### Explicit non-goals

- no 4D implementation yet
- no major shared-refactor yet

## Milestone 4: 4D Map Load And Core Reuse Boundary

Status: complete

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

### Current implementation notes

Milestone 4 is now in place:

- `run4d.html` loads real `?map4d=` data
- the route reports grid size, solvability, path length, wall count, and load source
- the route starts on the centered hyper-layer presentation rather than an arbitrary view
- the standalone route no longer depends on the scan-page orbit/editor bootstrap to prove map loading

### Risks

- `js/4d/4d-core.js` currently mixes pure logic with runtime state
- careless reuse could drag scan-page assumptions into IRL code

### Explicit non-goals

- no final first-person render yet
- no final pointer-lock camera yet

## Milestone 5: 4D First-Person Traversal

Status: in progress, first playable pass exists

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

The key design constraint for this milestone is:

- the current continuously morphing hyper-slice world remains the world
- the player is moving inside that same world rather than a simplified replacement

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
- `Q/E` produces smooth continuous world morphing, not discrete hyper-layer jumps
- the route still feels like the same original scan paradigm, just from inside
- passable space reads as air rather than ghost-solid cubes
- faces between adjacent passable regions are not rendered
- only exposed boundary faces remain visible so the space reads as halls, shafts, floors, ceilings, and walls
- scan-to-IRL handoff uses the current live edited maze, not only stale URL state
- IRL-to-scan return preserves the encoded maze state

### Risks

- too much visual clutter from the current scan coloring
- movement can feel disorienting if the camera or speed tuning is poor
- first-person rendering may require a simpler draw strategy than the current orbit renderer

### Explicit non-goals

- no gravity
- no jump impulse
- no exotic 4D visualization beyond the current cross-section model
- no reinterpretation into ordinary rooms or stacked discrete 3D levels

### Current implementation notes

At the current checkpoint, the first playable 4D pass already exists:

- `run4d.html` is now a real playable first-person route rather than just a decode surface
- pointer lock, yaw/pitch mouse-look, and `WASD` movement are active
- `Space` / `Shift` move vertically
- `Q/E` continuously shifts the 4th dimension
- the renderer now uses exposed boundary faces so open volume reads as air instead of ghost cubes
- default surfaces are mostly opaque for navigation readability
- holding `LMB` temporarily enables x-ray-style inspection
- scan-to-IRL handoff from `scan4d.html` serializes the current in-memory maze state before navigation
- IRL-to-scan return preserves `map4d` and returns to edit mode

Remaining work here is mostly:

- finish render stability polish at close range
- continue tuning readability without weakening the continuous hyper-slice paradigm

## Milestone 6: 4D Usability Pass

Status: partially started early

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
- stronger surface semantics so exposed faces read differently as floors, ceilings, walls, or open edges
- preserve visibility into passable volume by treating non-boundary interior faces as fully absent rather than translucent
- default opaque surface rendering so the current local space reads like a real place
- hold `LMB` for temporary x-ray mode so the player can inspect upcoming geometry without permanently losing spatial clarity

### Done means

- the player can understand how to control the route without reading code
- the hyper-shift mechanic is clearly visible
- the route feels immersive rather than merely functional
- the player can visually read where open air is versus where actual blocking surfaces are
- temporary x-ray behaves like a deliberate inspection aid rather than the default navigation mode
- close-range projection artifacts are reduced enough that they feel like minor polish rather than a camera-model problem

### Risks

- visual noise from too much HUD
- spending too long on effects before the core route is robust

### Current implementation notes

Some Milestone 6 work has already started because it materially improved navigation:

- default opaque rendering is already in place
- hold `LMB` x-ray is already in place
- exposed faces already use stronger floor / wall / ceiling semantics
- darker, thicker borders already improve cell-to-cell readability
- near-plane clipping and thin-sliver suppression have already reduced the worst angle-dependent artifacts
- the in-canvas HUD now shows current pose data more clearly
- transient hyper-shift feedback now appears while `Q/E` is actively morphing the 4th dimension
- the route presentation itself now labels this work as Milestone 6 rather than treating it as a hidden follow-up

The remaining work here should stay narrow:

- tighten close-camera polish
- improve immersion/readability
- avoid turning usability work into a major renderer rewrite

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

## Stretch Goal: 2D Map / 1D Runner POV

### Goal

Add an over-the-shoulder or constrained POV presentation for the original 2D map / 1D runner.

The intended feeling is:

- walking a tight rope in space
- or moving along a narrow floating road
- with gaps appearing and disappearing as the underlying 1D scan changes

### Important design rule

The player's movement remains constrained to the current 1D runner path.

That means:

- the camera may look around
- the player may move forward/backward along the rope
- the camera angle must not redefine the runner direction

So if the camera is rotated 90 degrees relative to the rope:

- forward still means "advance along the rope"
- backward still means "retreat along the rope"

This avoids the control problem where camera-relative movement would fight the underlying 1D mechanic.

### Recommended controls

- mouse: view direction / camera orbit
- `W` / `S` or `Up` / `Down`: move forward/backward along the current 1D path
- keep the scan-line shift control separate from movement

### This should not become

- free `WASD` movement
- a camera-relative walking system
- a reinterpretation where the rope is just visual decoration

### Candidate route structure

If implemented, prefer a dedicated page:

- `run1d.html`
- `js/run-1d/`

This should follow the same route-isolation principle used for `run3d.html` and `run4d.html`.

### Suggested timing

Do not start this until:

- `run3d.html` is genuinely playable
- `run4d.html` is genuinely playable
- the shared POV patterns are stable enough to reuse safely

## Suggested execution order

1. Milestone 0: Standalone Route Scaffold
2. Milestone 1: 3D Map Load And Core Reuse Boundary
3. Milestone 2: 3D IRL Continuous Slice Embodiment
4. Milestone 3: 3D IRL Usability Pass
5. Milestone 4: 4D Map Load And Core Reuse Boundary
6. Milestone 5: 4D First-Person Traversal
7. Milestone 6: 4D Usability Pass
8. Milestone 7: Sharing Cleanup
9. Stretch Goal: 2D Map / 1D Runner POV

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
- both IRL routes preserve the existing smooth 45 degree slice-morphing paradigm rather than replacing it with discrete level changes

Optional stretch success:

- a future `run1d.html` presents the original 1D runner as an over-the-shoulder rope/road in space
- movement remains constrained to the original runner axis even while the camera looks around
