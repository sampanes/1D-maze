# 3D Map Coordinate System (Diamond Maze Architect 3D)

This document defines a **shared language** for discussing cells in the 3D maze.

The current code uses `(i, j, k)` indices:
- `i` = x/column (left → right in world space)
- `j` = y/row (front → back in world space)
- `k` = z/layer (bottom → top in world space)

For a `3×3×3` map:
- `i, j, k ∈ {0,1,2}`
- **Start** is fixed at `(i=0, j=0, k=2)`
- **End** is fixed at `(i=2, j=2, k=0)`

---

## 1) Requested human-friendly labels: Start = 0, End = 9

To match your request, we define a communication-only label set:

- **Cell 0** = Start `(0,0,2)`
- **Cell 9** = End `(2,2,0)`
- **Cells 1..8** = intermediate labels (example ordering below)

> Important: this numbering is for discussion/docs and does **not** replace engine coordinates.

---

## 2) 3×3 center slice (`k=1`) labeling example

A practical ordering for the visible 3×3 center slice is row-major in `(j,i)`:

```text
k = 1 (middle horizontal slice)

j=2   [7] [8] [9*]
j=1   [4] [5] [6]
j=0   [1] [2] [3]
       i=0 i=1 i=2
```

- `9*` above is only a visual anchor in this 2D diagram.
- The true End cell is `(2,2,0)` (one slice lower than center for `N=3`).
- The true Start cell is `(0,0,2)` (one slice higher than center for `N=3`).

If you prefer, we can swap to a snake-order or diagonal-order numbering for 1..8.

---

## 3) Full 3×3×3 stack (horizontal slices)

### Top slice `k=2` (contains Start = 0)

```text
k = 2

j=2   (0,2,2) (1,2,2) (2,2,2)
j=1   (0,1,2) (1,1,2) (2,1,2)
j=0   (0,0,2)=0 (1,0,2) (2,0,2)
       i=0     i=1     i=2
```

### Middle slice `k=1`

```text
k = 1

j=2   (0,2,1) (1,2,1) (2,2,1)
j=1   (0,1,1) (1,1,1) (2,1,1)
j=0   (0,0,1) (1,0,1) (2,0,1)
       i=0     i=1     i=2
```

### Bottom slice `k=0` (contains End = 9)

```text
k = 0

j=2   (0,2,0) (1,2,0) (2,2,0)=9
j=1   (0,1,0) (1,1,0) (2,1,0)
j=0   (0,0,0) (1,0,0) (2,0,0)
       i=0     i=1     i=2
```

---

## 4) How this appears in scan mode (diamond-rotated view)

At the center slice, the cross-section is a perfect `N×N` grid rotated ~45° on screen:

```text
      ◇ ◇ ◇
    ◇ ◇ ◇ ◇
      ◇ ◇ ◇
```

Behavior expectations (as implemented intent):
- Arrow keys move relative to the viewed map directions.
- `W` slices upward in 3D.
- `S` slices downward in 3D.
- As slices move away from center, visible cells shrink/recede and movement should remain constrained to passable geometry.

---

## 5) Suggested debug shorthand for reports

When reporting an issue, include both forms:
- Label form (requested): `Cell 0`, `Cell 9`, etc.
- Engine form: `(i,j,k)`

Example:
- “Avatar got blocked between **Cell 2** and **Cell 5** at `(i=1,j=0,k=1)` while slicing to `k≈0.7`.”

This makes bug reports unambiguous for both design and implementation.

---

## 6) Explicit 3×3 example from latest geometry discussion

For `N=3`, the center diagonal slice (`i+k=2`) contains exactly these 9 prisms:

```text
Front row (j=0):  (0,0,2)  (1,0,1)  (2,0,0)
Middle row (j=1): (0,1,2)  (1,1,1)  (2,1,0)
Back row (j=2):   (0,2,2)  (1,2,1)  (2,2,0)
```

The next upward slice band (`i+k` moving toward `3`) tends toward 6 prisms:

```text
Front row (j=0):  (1,0,2)  (2,0,1)
Middle row (j=1): (1,1,2) (2,1,1)
Back row (j=2):   (1,2,2)  (2,2,1)
```

Interpretation:
- W moves the slice upward through this transition.
- S moves downward through the inverse transition.
- During this motion, the section shrinks in the `i↔k` axis while remaining `N` cells long in `j`.
