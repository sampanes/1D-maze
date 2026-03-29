# 1D Dimensional Scanner: A Flatlander's Nightmare

Look, we've all been there. You're staring at a perfectly good 2D maze and you think, "This is too easy. I have too much spatial awareness. I wish I could perceive this like a confused entity peering through a mail slot." 

Well, wish granted. Welcome to the **1D Dimensional Scanner**. It’s a game about building a maze and then trying to solve it using a single, diagonal, one-dimensional cross-section. 



---

## What is this?
It's a "build-a-maze-then-run-it" simulator, but with a twist that will make your brain itch. You draw a grid (anywhere from 8x8 to 123x123), and then you navigate it through a 1D "viewstrip." 

The catch? Your view is a **diagonal slice** defined by the equation $y = x + \text{offset}$. As you "shift" the offset, the world morphs around you. It’s basically a high-tech version of trying to find your keys in the dark with a very thin, very angled flashlight.

---

## How to Use This (Without Breaking It)

### 1. The Architect Phase (Build Mode)
* **Paint:** Click and drag to draw walls. If you start on a wall, you're erasing. If you start on a path, you're building. 
* **The Scale Slider:** Use the slider to change the grid size. Warning: 123x123 is a lot of blocks. Don't say I didn't warn you.
* **Validation:** The "Start Scan" button stays disabled until the BFS algorithm confirms there’s actually a path from Green (Start) to Red (End). No cheating.

### 2. The Scanner Phase (Run Mode)
* **Left/Right Arrows:** Move your character along the current 1D line.
* **Up/Down Arrows:** Shift your diagonal cross-section (the "offset").
* **The Nudge:** If you try to shift into a wall but there’s an opening right next to you, the engine will "nudge" you into the gap. It's a feature to keep you from getting stuck in "diagonal purgatory."
* **The Peek (P):** If you get hopelessly lost (you will), hold the **'P'** key. The 2D blueprint will slide down so you can see where you actually are.

### 3. The "Merp"
* If you hear a sad square-wave beep, you hit a wall. Stop doing that.

---

## Next Steps (If I Ever Get More Coffee)
* **Mobile Support:** Adding touch gestures because apparently, people like playing games on their phones now.
* **Procedural Generation:** A button to generate a maze so you don't have to use your own brain to build one.
* **Timer/Leaderboard:** For the three people who want to speedrun a 123x123 1D maze.
* **Smarter "Squish":** Making the collision animation even more "slick" so the "merp" feels more emotionally devastating.

---

## Live Demo
Check it out here before I decide to refactor the whole thing and break it:
**https://sampanes.github.io/1D-maze/**

---
*Created by a tired developer who probably should have been debugging something else.*

## IRL Routes

There is now a separate experimental IRL route structure being built in parallel to the existing scan pages so the original modes stay stable.

Current dedicated routes:

- `run3d.html`
- `run4d.html`

Current intent:

- `run3d.html` should let you inhabit the same 45 degree continuously morphing 3D slice-world instead of replacing it with discrete floors
- `run4d.html` will do the same for the current 4D inhabited scan volume

Important design rule:

- these IRL routes are not supposed to reinterpret the mazes as ordinary room-based or stacked-layer games
- they are supposed to put the camera inside the same continuously deforming slice logic the scan modes already use

Current state of `run3d.html`:

- decodes existing `?map3d=` links
- also supports `?map=` as a fallback
- includes a browser-side decode/BFS verification surface
- includes a first playable pass of the embodied 3D route

Current state of `run4d.html`:

- decodes existing `?map4d=` links
- includes a real first-person playable route through the current 4D hyper-slice
- uses mouse look plus `WASD`, `Space` / `Shift`, and `Q` / `E`
- preserves the same continuous hyper-slice logic rather than turning the maze into discrete rooms
- renders passable volume as air by drawing exposed boundary faces instead of ghost-solid cubes
- defaults to more opaque surfaces for navigation readability
- lets you hold `LMB` for temporary x-ray inspection
- now includes stronger in-view HUD/readability feedback while shifting through the 4th dimension
- now includes live route-state readouts so you can tell pointer-lock state, current view mode, and current position without guesswork
- now treats the red finish more like a visible boundary/threshold to cross instead of only a flat colored endpoint
- finish-boundary lines can now persist even on hall-facing pass-through finish faces, so the goal reads more like crossing glowing planes than touching a red block
- near clean hyper-slice alignments, the 4D route now softly snaps the rendered slice to reduce tiny sliver layers without changing the underlying traversal logic
- completion now includes a brief center-screen celebration cue so the finish is noticeable even if you are not watching the top HUD

Route handoff behavior:

- entering `run4d.html` from `scan4d.html` now serializes the current live edited maze state before navigation
- returning from `run4d.html` to `scan4d.html` preserves `?map4d=...` and lands back in edit mode
- the same dedicated-route principle applies to the 3D pair as well

Example URLs once hosted:

- `run3d.html?map3d=03492ED42`
- `run3d.html?map=03492ED42`

The existing pages still remain the canonical stable routes:

- `index.html`
- `scan3d.html`
- `scan4d.html`

## Bunch of links dumped here

* [Squiggly 12](https://sampanes.github.io/1D-maze/index.html?map=0C4F840A5EA50A57A5025FE4207AF6286AA0A2) - One I drew to be as turny as I could get with 12x12
* [Slightly bigger](https://sampanes.github.io/1D-maze/index.html?map=1020402240AF1C21F67D042145B0643FF6702423AC0E241834106417C414461102) - Pretty mean tbh but not impossible.
* [3x3x3 NOICE](https://sampanes.github.io/1D-maze/scan3d.html?map3d=03492ED42) - Quite nice now that 3D is implemented
* [5x5x5 LOOPY](https://sampanes.github.io/1D-maze/scan3d.html?map3d=05C6F7BD7BFFFE84B5AD5EFFFEE16B5A1) - Pretty proud of this one but better is possible
* [3x3x3 NOICE IRL Route](https://sampanes.github.io/1D-maze/run3d.html?map3d=03492ED42) - Experimental embodied route using the same map data
* [5x5x5 LOOPY IRL Route](https://sampanes.github.io/1D-maze/run3d.html?map3d=05C6F7BD7BFFFE84B5AD5EFFFEE16B5A1) - Experimental embodied route on the larger sample
* [4x4x4x4 Edit-Mode Sample](https://sampanes.github.io/1D-maze/scan4d.html?map4d=041111111133313130113202025772547277745504777576744EC97F583B3A3028&edit=1) - Loads a shared 4D map directly into scan edit mode instead of auto-starting the run
