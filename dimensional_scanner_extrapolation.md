# From “2D Map, 1D Scanner” to “3D Map, 2D Scanner” to a Hypothetical “4D Map, 3D Scanner”

This document is intentionally **over-explained**.

It reverse-engineers the current codebase’s math, compares the 2D and 3D systems directly, and then extrapolates a coherent 4D design philosophy from the same geometric rules.

---

## 0) The big idea in one sentence

Each version keeps a full map in dimension \(D\), but the player perceives and moves inside a \((D-1)\)-dimensional cross-section that is cut at **45°** against one hidden axis, and that hidden-axis offset becomes the “layer shift” control.

---

## 1) Deep dive: current **2D map, 1D scanner** implementation

### 1.1 Coordinate change in the code

The 2D game stores map cells in ordinary Cartesian grid coordinates \((x, y)\), but the scanner logic uses transformed coordinates \((u, v)\):

\[
 x = \frac{u+v}{2},\quad y = \frac{v-u}{2}
\]

That comes directly from `uvToXY(u, v)`. Equivalent inverse form:

\[
 u = x - y,\quad v = x + y
\]

Interpretation:
- \(u\) labels which diagonal line you are on (the slice index).
- \(v\) is position along that diagonal.

So the 1D scanner is literally: “pick one diagonal line \(u=\text{const}\), move along \(v\).”

### 1.2 Why the valid \(v\)-range shrinks near ends

The playable map is a square \([0,N)\times[0,N)\). In \((u,v)\)-space, that square becomes a diamond-like feasible region with bounds:

\[
|u| \le v \le 2N-|u|
\]

Exactly what `getVBounds(u)` computes (`min = |u|`, `max = 2N - |u|`).

This is the formal reason for the “squish” feeling: as \(|u|\to N\), the interval length

\[
(2N-|u|)-|u|=2(N-|u|)
\]

collapses to zero. Your 1D lane pinches to a point (conceptually \(0\times0\)).

### 1.3 Movement and “nudging”

Movement tries local step candidates in \((u,v)\), checks wall collisions by sampling mapped \((x,y)\) cells, and includes nudge behavior so small layer shifts can slide around corners instead of hard-failing.

This is why the hidden dimension feels smooth instead of brittle: it is a constrained continuous probe with collision sampling, not a teleport between disconnected slices.

---

## 2) Deep dive: current **3D map, 2D scanner** implementation

### 2.1 Stored coordinates and the active slice

3D map cells are indexed by `(i, j, k)` where:
- `i`: left-right axis,
- `j`: front-back axis,
- `k`: vertical/layer axis.

The scanner does **not** show full 3D. It shows a 2D cross-section controlled by `sliceOffset = S`.

From `getCellSliceRect(i, j, k, S)`:

\[
C = S\sqrt{2}
\]

and slice intersection is computed over the diagonal relation

\[
i + k \approx C
\]

(more precisely via interval overlap for finite voxel thickness).

### 2.2 The core intersection math

For one voxel prism \([i,i+1]\times[j,j+1]\times[k,k+1]\), intersect with the diagonal slice band:

\[
i_{\min}=\max(i, C-k-1),\quad i_{\max}=\min(i+1, C-k)
\]

If \(i_{\min}<i_{\max}\), there is a non-empty 2D rectangle on the scanner plane.

Returned scanner-plane rectangle:

\[
 x_0=\frac{2i_{\min}-C}{\sqrt2},\quad x_1=\frac{2i_{\max}-C}{\sqrt2}
\]
\[
 y_0=j\sqrt2,\quad y_1=(j+1)\sqrt2
\]

Interpretation:
- scanner-\(x\): blended i↔k diagonal width (grows/shrinks as the slice moves),
- scanner-\(y\): j-depth axis (full width preserved).

### 2.3 Why center slice is a perfect \(N\times N\) square

`getCenterSliceOffset()` returns:

\[
S_{center}=\frac{N}{\sqrt2}\quad\Rightarrow\quad C=N
\]

At that center value, exactly the diagonal family \(i+k=N-1\) contributes full-width sections, giving an even, symmetric \(N\times N\) grid in scanner space.

### 2.4 Why edges collapse to a line-like dimensionality

As `sliceOffset` approaches min/max bounds (`getSliceBounds3d()`), the overlap interval \([i_{\min}, i_{\max}]\) narrows for most cells. The section loses area in one scanner direction, leaving something line-like (conceptually \(0\times N\)): one extent dies, the other remains.

Again: no teleport. The code stabilizes and nudges player occupancy as geometry shrinks/expands, preserving smoothness.

---

## 3) Side-by-side comparison: 2D→1D vs 3D→2D

| Concept | 2D map, 1D scanner | 3D map, 2D scanner |
|---|---|---|
| Full map dimension | 2 | 3 |
| Perceived scanner dimension | 1 | 2 |
| Hidden “sneaky” axis control | `u` shift (Up/Down) | `sliceOffset S` via W/S |
| Slice geometry | diagonal line \(u=x-y\) | diagonal plane family \(i+k=C\) |
| Position within slice | scalar \(v=x+y\) | 2D point `(x,y)` in slice rectangles |
| Edge behavior | lane shrinks to point \(0\times0\) | section shrinks toward line \(0\times N\) |
| Collision feel | sampled line + nudge | swept 2D movement + orthogonal nudges |

The important extrapolation pattern is: each extra world dimension adds one extra scanner dimension and one extra layer-control axis.

---

## 4) Thought experiment: drawing with fewer dimensions + “layer button(s)”

The user asked for this specifically, so here is a concrete mental model.

### 4.1 If we had to **draw the 2D map using only a 1D editor + one layer button**

You would not draw a whole 2D square at once.

You would:
1. Choose a diagonal layer index \(u\).
2. Paint a 1D strip along \(v\) for that layer.
3. Press layer up/down to move to next \(u\).
4. Repeat until all \(u\)-layers are painted.

That is effectively tomography-by-diagonals. A 2D wall pattern emerges from many 1D “scanlines.”

### 4.2 If we had to **draw the 3D map using only a 1D editor + two layer buttons**

Now the fully stored object is 3D, but the editor itself is 1D.

One coherent way:
1. Keep a 1D brush coordinate (like \(v\) along a line).
2. Use Layer Button A to change diagonal slice offset (analogue of \(u\) or \(S\)).
3. Use Layer Button B to move across the orthogonal index family (analogue of which row family, e.g. \(j\) bucket).
4. Painting one 1D strip now specifies occupancy in a thin subset of 3D; iterating both layer buttons reconstructs the whole volume.

This is “serializing” 3D painting into stacks of 1D strokes.

It would feel painfully abstract but mathematically valid, and it mirrors exactly how high-dimensional datasets are often entered: one low-dimensional slice at a time.

---

## 5) The “special even cross-sections” principle and the 45° rule

You highlighted this key principle:
- we deliberately use 45° coupling to create smooth birth/death of visible extent,
- and we choose anisotropic cell extents so the **center cross-section** is aesthetically even (square/cube-like).

For the existing 3D case, phrased your way:
- think of each solid as \(A\times A\times A\sqrt2\),
- with a 45° cut against that stretched axis,
- giving a central section with equalized dimensions (e.g. \(A\sqrt2\times A\sqrt2\)) after the chosen projection scale.

The exact coordinate convention can vary, but the invariant is: **scale + 45° cut are co-designed** so center slices are regular and off-center slices shrink smoothly.

---

## 6) Extrapolating to **4D map, 3D scanner**

Now apply the same template one dimension up.

### 6.1 State and controls

A 4D map cell index might be \((a,b,c,d)\).
- The scanner presents a 3D cross-section volume.
- Movement controls inside scanner become 3D navigation (6 directions or camera-relative motion).
- A new “hyper-layer” control shifts slice offset along the hidden coupling with the 4th axis.

Minimal conceptual slice equation:

\[
a + d = C_4
\]

where \(C_4\) is controlled by a new offset \(S_4\) (often \(C_4=S_4\sqrt2\) in the same normalization style).

### 6.2 What collapses near extremes

At center, scanner sees a full 3D volume (regular lattice-like cube in scanner coordinates).

As \(S_4\) approaches bounds, one scanner extent shrinks toward zero while the other two remain, so perception compresses from 3D toward a 2D sheet (analogue of prior \(0\times N\) collapse, now \(0\times N\times N\)).

### 6.3 Generalized “no sudden walls” requirement

To preserve feel:
- use swept-volume collision in 3D scanner space,
- include nearest-valid stabilization when slice changes invalidate current occupancy,
- include nudge/slide fallback across local tangent directions.

That is the 4D equivalent of the existing smooth nudge logic.

---

## 7) What would a 4D game *feel like* (using your style language)

### 7.1 Existing feel recap

- **2D map → 1D scanner**: appears one-directional with a sneaky extra axis. Shifting that axis morphs the lane continuously. Near top/bottom corners, dimensionality squishes to a point (\(0\times0\)).
- **3D map → 2D scanner**: appears two-directional with sneaky extra slice directions. Shifting slice morphs the floorplan continuously. Near top/bottom edges, dimensionality squishes to a line-like state (\(0\times N\)).

### 7.2 Extrapolated feel

- **4D map → 3D scanner**: appears like normal 3D navigation (forward/back, strafe, vertical), but with sneaky hyper-layer motion that causes the whole volume to breathe, twist, and re-route gradually.
- Instead of walls popping in, corridors should **grow into existence** and **shrink out of existence** as a consequence of the 45° hyper-slice moving through stretched 4D cells.
- Near hyper-extremes, the navigable 3D volume collapses toward a 2D manifold (a “sheet world”), so the player experiences temporary loss of one degree of freedom.

If implemented correctly, this is disorienting but fair: geometry changes continuously, not discretely.

---

## 8) A compact math ladder (dimension-by-dimension)

Let map dimension be \(D\), scanner dimension \(D-1\).

1. Choose one paired axis relation with the new dimension: \(x_1 + x_D = C_D\).
2. Use \(C_D\) as layer offset control.
3. Intersect each \(D\)-cell with that hyperplane band to get a \((D-1)\)-polytope.
4. At centered \(C_D\), tune scale so the visible lattice is regular/even.
5. As \(C_D\) moves to bounds, one visible extent collapses smoothly.

This is exactly the repeated extrapolation from current 2D→1D and 3D→2D implementations.

---

## 9) Practical design notes for a future 4D implementation

1. **Representation:** sparse storage likely needed for anything non-trivial (\(N^4\) blows up fast).
2. **Rendering:** render only intersected 3D polytopes of current hyper-slice.
3. **Input UX:** keep hyper-layer controls analog/continuous (hold key, wheel, trigger).
4. **Onboarding:** mandatory “peek mode” that reveals nearby 4D context (just like current P-peek helps in 2D mode).
5. **Comfort:** add motion smoothing and anticipation ghosting so players can predict shape births/deaths.

---

## 10) Final intuition

The progression is not “more complicated maze graphics.”
It is a consistent geometric trick:

- hide one dimension,
- cut at 45°,
- navigate the cross-section,
- and let layer motion reveal higher-dimensional structure continuously.

That is why the games feel like ordinary navigation plus a mischievous extra axis that quietly rewrites the world.
