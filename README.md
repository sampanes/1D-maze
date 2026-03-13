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

## Bunch of links dumped here

* [Squiggly 12](https://sampanes.github.io/1D-maze/index.html?map=0C4F840A5EA50A57A5025FE4207AF6286AA0A2) - One I drew to be as turny as I could get with 12x12
* [Slightly bigger](https://sampanes.github.io/1D-maze/index.html?map=1020402240AF1C21F67D042145B0643FF6702423AC0E241834106417C414461102) - Pretty mean tbh but not impossible.
* [3x3x3 NOICE](http://127.0.0.1:5500/scan3d.html?map3d=03492ED42) - Quite nice now that 3D is implemented
