# RUN IRL Plan

This file replaces the earlier prompt-style plan with one that matches the current codebase.

## What the codebase actually does today

### 2D

- `index.html` loads the original 2D game.
- The maze is stored as `grid[row][col]`.
- `0` means passable, `1` means wall.
- Start is fixed at `(0,0)`, end at `(N-1,N-1)`.
- Share links use `?map=...`.

### 3D

- `scan3d.html` is both the editor and the play page.
- The maze is stored as `grid3d[k][j][i]`.
- `0` means passable, `1` means wall.
- Start is `(i=0, j=0, k=N-1)`, end is `(i=N-1, j=N-1, k=0)`.
- The active edit layer is not a flat z slice. It is a diagonal `i + k = currentLayer`.
- The run mode is not discrete tile-stepping between named slices. It uses a continuous diagonal cross-section parameter `sliceOffset`.
- `W` / `S` already move that slice continuously.
- Arrow keys already move the player continuously inside the resulting 2D cross-section geometry.
- Collision, stabilization after slice changes, and URL loading already exist.
- Share links use `?map3d=...`, with `?map=...` also accepted as a fallback on the 3D page.

Relevant files:

- `js/3d/lattice.js`
- `js/3d/geometry.js`
- `js/3d/player3d.js`
- `js/3d/render3d.js`
- `js/3d/ui3d.js`
- `js/3d/slice.js`
- `js/3d/init3d.js`

### 4D

- `scan4d.html` is both the editor and the play page.
- The maze is stored as `grid4d[w][z][y][x]`.
- `0` means passable, `1` means wall.
- Start is `(x=0, y=0, z=0, w=N-1)`, end is `(x=N-1, y=N-1, z=N-1, w=0)`.
- The active edit layer is not a raw `w` layer. It is a hyperdiagonal `x + w = hyperLayer`.
- The current run mode is already a true continuous 3D inhabited cross-section of the 4D maze.
- `E` / `D` already shift smoothly through the 4th dimension by moving `hyperSliceOffset`.
- Arrow keys already move across the floor plane.
- `W` / `S` already move vertically in the 3D scan volume.
- The player already has 3D collision, nudging, stabilization, and a world-space position.
- Share links use `?map4d=...`.

Relevant files:

- `js/4d/4d-core.js`
- `js/4d/render4d.js`
- `js/4d/init4d.js`

## Corrections to the earlier IRL idea

### Correction 1: 4D does not need an entirely new movement model

The earlier plan treated 4D as if it still needed a first-person inhabitable 3D mode. That is no longer true. The current 4D scanner already gives:

- a 3D volume
- continuous player motion inside that volume
- vertical movement on `W` / `S`
- smooth 4th-dimension shifting on `E` / `D`

What it does not have yet is a camera that feels first-person. The real gap is presentation, not core traversal.

### Correction 2: 3D is not based on simple discrete horizontal slices

The earlier plan described the 3D mode as if it were just showing an `N x N` slice and letting `W` / `S` switch between layers. The actual 3D scanner is a continuous diagonal slice through a rotated lattice:

- the visible shape narrows and widens continuously
- the player position is already continuous
- collision already happens against generated slice rectangles

So the IRL version should be built on top of `buildCrossSection(sliceOffset)`, not by inventing a new layer system.

### Correction 3: reuse current legality logic instead of replacing it

Both 3D and 4D already have:

- validated passability via BFS
- generated cross-section geometry
- continuous player collision
- relocation/stabilization when the slice changes under the player

The IRL mode should reuse those systems directly. New rendering should sit on top of the same geometry.

## Actual feature goal

Add an optional `Run IRL` presentation mode on top of the existing 3D and 4D scan systems.

This should preserve:

- existing editors
- existing scan modes
- current share-link formats
- current movement legality and win detection

This should add:

- a first-person camera presentation for 3D scans
- a first-person camera presentation for 4D scans
- dedicated IRL URLs that do not require modifying the existing scan pages
- a direct way to deep-link into the IRL variant

## Control decisions

These are the current intended controls for the IRL variants.

### 3D IRL controls

- mouse: look left/right with yaw
- `W`: move forward relative to facing
- `S`: move backward relative to facing
- `A`: strafe left
- `D`: strafe right
- no jump
- no gravity
- slice shifting stays available, but should move off the movement cluster:
  use `Q` / `E` for slice down/up in IRL mode

Rationale:

- the current 3D scan already uses `W` / `S` for `sliceOffset`, but IRL mode needs standard first-person ground movement more than it needs keyboard continuity with the existing scan view
- using `Q` / `E` for slice motion keeps the mechanic close at hand without colliding with `WASD`
- no jump and no gravity preserve the intended "standing on a white platform over void" feel without turning it into a platformer

### 4D IRL controls

- mouse: look with yaw and pitch
- `W`: move forward relative to facing
- `S`: move backward relative to facing
- `A`: strafe left
- `D`: strafe right
- `Space`: ascend
- `Shift`: descend
- `Q` / `E`: shift through the 4th dimension
- no gravity in the first pass
- no jump impulse in the first pass

Rationale:

- the current 4D scan already has a real 3D navigable volume, so the natural upgrade is to give it standard FPS-style camera and movement controls
- `Space` + `Shift` is the cleanest up/down mapping once `WASD` is reserved for planar movement
- `Q` / `E` is a better fit for hyper-shifting in mouse-look mode than the existing `E` / `D`, because `D` is needed for strafe-right
- gravity can be revisited later as an optional polish/variant, but should not be part of the first implementation

## Smallest sensible architecture change

### 3D

Keep the current 3D scan model exactly as the source of truth:

- `buildCrossSection(sliceOffset)` stays authoritative for visible walkable geometry.
- `updatePlayer3d(dt, cs)` stays authoritative for legality and movement.
- `player3d.x` / `player3d.y` stay authoritative for player position.

Add a second renderer for scan mode:

- current renderer: top-down cross-section canvas
- new renderer: first-person IRL canvas

The new renderer should interpret the current 2D slice geometry as:

- white walkable platforms
- black infinite void outside passable regions
- no conventional walls

This produces the intended "standing on a white platform in infinite black space" feel while still matching the continuous slice logic already in place.

### 4D

Keep the current 4D scan geometry and movement exactly as-is:

- `buildCrossSection4d(hyperSliceOffset)` remains authoritative
- `updatePlayer4d(dt, cs)` remains authoritative
- `player4d.sx/sy/sz` remain authoritative

Add a first-person camera renderer that draws the already-generated 3D boxes from the player's eyes instead of from the current orbit camera.

This means the 4D IRL work is primarily:

- camera/view transform
- control remapping for mouse-look plus FPS motion
- HUD and slice-shift feedback

not a rewrite of the traversal model.

## Proposed implementation shape

### URL strategy

IRL mode should get its own pages first.

Recommended new entry points:

- `run3d.html`
- `run4d.html`

Existing pages should remain in place and should continue to work unchanged:

- `index.html`
- `scan3d.html`
- `scan4d.html`

This is the safest way to build the feature because:

- existing scan pages remain stable while IRL work happens in parallel
- control schemes can diverge cleanly without conditional complexity everywhere
- page-specific HTML, onboarding text, and canvas layout can evolve independently
- regressions are easier to isolate because the bootstraps are separate

### URL parameters

Use the same serialized map parameters the project already understands, but on the new IRL pages:

- `run3d.html?map3d=...`
- `run4d.html?map4d=...`

3D may also optionally support the current fallback:

- `run3d.html?map=...`

Optional future enhancement:

- `?view=irl` can still exist later on the scan pages as a redirect or convenience alias

But the primary implementation target should be:

- separate pages first
- query-param toggles second, only if they still feel useful after the dedicated pages exist

### Navigation / linking

Add explicit links between the paired pages:

- `scan3d.html` should link to `run3d.html`
- `scan4d.html` should link to `run4d.html`
- `run3d.html` should link back to `scan3d.html`
- `run4d.html` should link back to `scan4d.html`

The IRL pages should also retain the cross-links to:

- `index.html`
- the other dimensional mode where appropriate

This keeps every mode directly reachable without the user having to edit query strings.

### Directory structure

Recommended top-level page layout:

- `index.html`
- `scan3d.html`
- `scan4d.html`
- `run3d.html`
- `run4d.html`

Recommended JS layout:

- `js/3d/`
  existing 3D scan/editor code
- `js/4d/`
  existing 4D scan/editor code
- `js/3d-run/`
  new 3D IRL-specific bootstrap, rendering, and controls
- `js/4d-run/`
  new 4D IRL-specific bootstrap, rendering, and controls

Recommended initial file layout:

- `js/3d-run/state3d-run.js`
- `js/3d-run/render3d-run.js`
- `js/3d-run/player3d-run.js`
- `js/3d-run/ui3d-run.js`
- `js/3d-run/init3d-run.js`

- `js/4d-run/state4d-run.js`
- `js/4d-run/render4d-run.js`
- `js/4d-run/player4d-run.js`
- `js/4d-run/ui4d-run.js`
- `js/4d-run/init4d-run.js`

This keeps the IRL code visually and structurally separate from the existing scan code.

### Sharing strategy

Use this rule:

- shared pure data/geometry/serialization helpers may be reused
- page wiring, controls, and rendering should be separated

In practice that means:

- reuse the current maze representations and serializers
- reuse the current geometry builders where possible
- avoid directly extending `scan3d.html` and `scan4d.html` bootstraps unless there is a very strong reason
- allow some duplication in page-level setup code if it keeps the IRL work isolated and safer

Good candidates for reuse from the current codebase:

- 3D serialization and grid helpers from `js/3d/lattice.js`
- 3D slice geometry from `js/3d/geometry.js`
- 3D collision helper logic from `js/3d/player3d.js`, if factored carefully
- 4D serialization, grid state, and cross-section geometry from `js/4d/4d-core.js`
- shared audio from `js/audio.js`

Poor candidates for reuse without refactoring:

- `js/3d/ui3d.js`
- `js/3d/init3d.js`
- `js/4d/init4d.js`

Those files are heavily page-wiring-oriented already, so trying to make them serve both scan and IRL pages immediately is likely to create risk rather than reduce it.

### CSS strategy

Keep using the existing CSS files as the base:

- `css/base.css`
- `css/game.css`

If the IRL pages need additional layout or HUD treatment, add a dedicated stylesheet instead of overloading existing scan styles:

- `css/run.css`

That keeps scan-page styling stable while allowing the IRL HUD, pointer-lock prompts, reticles, and fullscreen-first layout to evolve independently.

### Bootstrapping principle

Each page should have its own bootstrap:

- `scan3d.html` boots existing scan code
- `run3d.html` boots IRL 3D code
- `scan4d.html` boots existing scan code
- `run4d.html` boots IRL 4D code

This is more important than avoiding a little duplication.

### Long-term refactor option

If both IRL pages become stable and obvious duplication appears, shared pure helpers can later be extracted into narrower shared files such as:

- `js/3d/core3d-shared.js`
- `js/4d/core4d-shared.js`
- `js/shared/pointer-lock.js`

But that should happen after the dedicated IRL pages are working, not before.

### Why this is the recommended structure

This structure optimizes for:

- low regression risk
- easy deployment on GitHub Pages
- clean deep-linking
- simpler reasoning while features are still moving fast
- the ability to compare old scan behavior and new IRL behavior side by side

It intentionally optimizes less for:

- zero duplication
- early abstraction
- having one page that does everything

That tradeoff is correct for the current stage of the project.

### URL / mode selection inside the IRL pages

Once inside the IRL pages, keep mode selection simple:

- `run3d.html?map3d=...`
- `run4d.html?map4d=...`

Optional fallback:

- `run3d.html?map=...`

The important point is still that map serialization should remain unchanged.

### UI

Because IRL gets dedicated pages, the UI goal changes slightly:

- the scan pages should offer a link or button to open the matching IRL page
- the IRL pages should offer a link or button to return to the matching scan page

This is better than trying to maintain a heavy in-page toggle during the first implementation.

### 3D IRL renderer

Render the current `buildCrossSection(sliceOffset)` output as 3D floor slabs:

- each passable rect becomes a white floor plate
- start and end can remain green/red accents
- path highlight can be optional or disabled in IRL mode
- everything outside passable rects is void

Camera model:

- player position comes from `player3d`
- add a yaw angle
- mouse-look should update yaw
- movement should be standard FPS-style on the existing 2D walk plane
- `Q` / `E` should shift `sliceOffset` in IRL mode
- no pitch is required for the first 3D IRL version

Movement legality:

- convert intended first-person motion into the same world-space XY plane used now
- keep using `canOccupy3d`, `sweepMove3d`, `moveWithNudge3d`, and `stabilizePlayerInSlice3d`
- only the input-to-`dx/dy` mapping should change in IRL mode

Expected result:

- minimal visual world
- no walls
- player cannot step into void
- current slice changes can still reshape the platform under the player, with existing stabilization logic handling invalid positions

### 4D IRL renderer

Render the current `buildCrossSection4d(hyperSliceOffset)` boxes from a first-person camera:

- passable boxes define the navigable volume
- walls remain visible as solid dark boundaries
- start/end keep their existing semantic colors
- hyper-slice changes should visibly morph the space

Camera model:

- player position comes from `player4d`
- add yaw and pitch
- mouse-look should drive both
- `WASD` should move on the world X/Y floor plane relative to camera yaw
- `Space` / `Shift` should move vertically using the existing world Z axis
- `Q` / `E` should change `hyperSliceOffset`
- no gravity or jump impulse in the first pass

Movement legality:

- keep using the existing 3D collision in `updatePlayer4d`
- preserve `canOccupy4d`, `sweepMove4d`, `moveWithNudge4d`, and `stabilizePlayer4d`
- replace the current key-to-axis mapping with a yaw-relative FPS mapping in IRL mode

Technical note:

- today `updatePlayer4d` quantizes movement to the nearest 90 degree camera quadrant for arrow-key navigation
- IRL mode should stop doing that and instead compute continuous forward/right vectors from camera yaw
- pitch should affect camera view, not horizontal movement
- vertical movement should remain explicit on `Space` / `Shift` rather than being coupled to look pitch

## File-level integration plan

### New pages

- `run3d.html`
  New dedicated 3D IRL page. Should own its controls, canvas, pointer-lock onboarding, and HUD.

- `run4d.html`
  New dedicated 4D IRL page. Should own its controls, canvas, pointer-lock onboarding, and HUD.

### Existing pages to touch lightly

- `scan3d.html`
  Add a clear link/button to `run3d.html`, ideally preserving the current serialized map when one exists.

- `scan4d.html`
  Add a clear link/button to `run4d.html`, ideally preserving the current serialized map when one exists.

### 3D IRL files

- `js/3d-run/state3d-run.js`
  New 3D IRL state module. Owns view state, player-facing yaw, pointer-lock state, and page-local DOM refs.

- `js/3d-run/player3d-run.js`
  New 3D IRL movement module. Should translate `WASD` plus `Q/E` slice controls into the same XY collision and slice logic used by the current 3D scanner.

- `js/3d-run/render3d-run.js`
  New 3D IRL renderer. Should turn cross-section rectangles into floor slabs over black void.

- `js/3d-run/ui3d-run.js`
  New 3D IRL UI module. Handles pointer lock, HUD updates, onboarding text, and navigation back to scan mode.

- `js/3d-run/init3d-run.js`
  New 3D IRL bootstrap. Loads maps from the URL, initializes the page, starts the IRL loop, and keeps this mode isolated from `scan3d.html`.

### 4D IRL files

- `js/4d-run/state4d-run.js`
  New 4D IRL state module. Owns first-person camera state, pitch clamps, pointer-lock state, and page-local DOM refs.

- `js/4d-run/player4d-run.js`
  New 4D IRL movement module. Should translate `WASD`, `Space`, `Shift`, and `Q/E` into the existing 4D collision and hyper-slice logic.

- `js/4d-run/render4d-run.js`
  New 4D IRL renderer. Should reuse the current 4D cross-section boxes but draw them from the player's first-person camera.

- `js/4d-run/ui4d-run.js`
  New 4D IRL UI module. Handles pointer lock, HUD updates, onboarding text, and navigation back to scan mode.

- `js/4d-run/init4d-run.js`
  New 4D IRL bootstrap. Loads maps from the URL, initializes the page, starts the IRL loop, and keeps this mode isolated from `scan4d.html`.

## Technical integration notes from the existing code

### 3D input and movement

- Current movement is updated every frame in `tick3d` inside `js/3d/init3d.js`.
- Slice motion is currently handled by `updateSliceFromInput3d(dt)` in `js/3d/slice.js`.
- Cross-section movement is currently handled by `updatePlayer3d(dt, cs)` in `js/3d/player3d.js`.
- The safest IRL approach is not to add a second path into `tick3d`; instead, `run3d.html` should have its own loop in `js/3d-run/init3d-run.js`.
- That loop should still call shared 3D geometry and legality helpers where practical, but should not depend on the scan page's DOM structure.
- If any 3D helpers are too coupled to scan-page globals, extract the pure parts later rather than forcing `run3d.html` to inherit scan-page wiring.

### 3D rendering

- `buildCrossSection(sliceOffset)` in `js/3d/geometry.js` already yields the authoritative visible walkable rectangles.
- The current scan renderer in `js/3d/render3d.js` already distinguishes `passable`, `startRect`, `endRect`, and `pathRects`.
- IRL mode should reuse those outputs directly rather than sampling `grid3d` again.
- The visual conversion should be "rectangles become floor slabs", not "voxelize the entire 3D maze again".
- Because `run3d.html` is its own page, `render3d-run.js` should not try to coexist in the same render loop as `render3d.js`.

### 4D input and movement

- Current movement, hyper-slice shifting, and win checks are updated every frame in `tick4d` inside `js/4d/init4d.js`.
- Hyper-slice motion is currently handled by `updateHyperSliceFromInput4d(dt)` in `js/4d/4d-core.js`.
- Player motion is currently handled by `updatePlayer4d(dt, cs)` in `js/4d/4d-core.js`.
- The safest IRL approach is for `run4d.html` to have its own loop in `js/4d-run/init4d-run.js`.
- That loop should reuse shared 4D geometry and legality helpers where practical, but should not rely on the scan page's orbit-camera UI or editor DOM.
- The existing 4D movement code already separates horizontal motion from vertical motion and hyper-slice shifting, which fits the new controls well.

### 4D rendering

- `buildCrossSection4d(hyperSliceOffset)` in `js/4d/4d-core.js` already yields the authoritative world-space boxes for the current 3D slice of the 4D maze.
- `drawScanSlice4d()` in `js/4d/render4d.js` already iterates those intersected cells and colors start/end/path/walls distinctly.
- The new IRL renderer should reuse the same cross-section boxes but swap the orbit camera projection for a player-centered first-person projection.
- Existing semantic coloring can be reused initially, then simplified later if needed for readability.
- Because `run4d.html` is separate, `render4d-run.js` can be written purely for first-person rendering without carrying scan/orbit compatibility code.

## Behavioral decisions already answered by the codebase

### What happens if the slice changes and the player would become invalid?

Do not invent a new rule. Reuse the current one:

- 3D already uses `stabilizePlayerInSlice3d`
- 4D already uses `stabilizePlayer4d`

### Should map encoding change?

No. Keep:

- 3D map encoding exactly as `serializeMaze3dToHex`
- 4D map encoding exactly as `serializeMaze4dToHex`

Only add new pages that consume the same query parameters.

### Should existing scan mode be replaced?

No. IRL mode is additive.

### Should IRL live behind the same page bootstraps?

No, not in the first implementation.

Use:

- separate HTML pages
- separate JS bootstrap directories
- shared pure helpers only where reuse is clearly safe

This is the lowest-risk structure.

## Recommended delivery order

1. Create `run3d.html` and `run4d.html` as dedicated IRL entry points.
2. Create `js/3d-run/` and `js/4d-run/` with separate bootstraps.
3. Add navigation links between scan pages and IRL pages.
4. Add pointer-lock mouse-look plumbing shared conceptually across both IRL pages.
5. Implement 3D IRL first, because it is the genuinely new presentation mode.
6. Implement 4D IRL as a first-person camera variant of the existing 4D scan volume.
7. Reuse current stabilization behavior before attempting any custom snapping rules.
8. Add light polish only after the core mode works.

## Non-goals for the first pass

- no external engine rewrite
- no new map format
- no gravity or jumping
- no visible character model
- no tap-space float mechanic in the first pass
- no attempt at a mathematically exotic 4D projection beyond the current slice-based model
- no replacement of the existing scan canvases

## Summary

The real project direction is:

- 3D: add a new first-person presentation on top of the current continuous 2D slice geometry
- 4D: add a first-person camera presentation on top of the already-existing inhabitable 3D scan volume

And the safest delivery structure is:

- dedicated URLs: `run3d.html` and `run4d.html`
- dedicated JS directories: `js/3d-run/` and `js/4d-run/`
- reuse of shared pure helpers only where it reduces risk instead of increasing coupling

That is smaller, safer, and much more compatible with the current codebase than trying to retrofit IRL into the existing scan pages immediately.
