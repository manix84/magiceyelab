# ✨ What's New

## 🧩 Pattern Maker Improvements

- Added a square pattern painting tile for building seamless textures.
- Added Pencil mode for hard-edged pattern drawing.
- Added Fill mode with contiguous/global fill options and tolerance control.
- Added Eyedropper mode for picking colours from the tile.
- Added adjustable brush size.
- Added brush opacity and circle/square shape controls.
- Added colour-aware brush, fill, and eyedropper previews in the controls and over the paint tile.
- Added an optional grid overlay for precise tile work.
- Added an optional tile boundary guide.
- Added stroke/action-based undo and redo controls.
- Added keyboard shortcuts for pencil, brush, eraser, picker, undo, and redo.
- Added opposite-edge preview strips around the tile so top/bottom and left/right seams can be checked while painting.
- Added wraparound painting so manual strokes continue across tile edges and corners.
- Added a repeated preview panel that shows multiple tiled copies instead of stretching one tile.
- Added hex colour entry and recent colour swatches.
- Updated random pattern generation so generated motifs wrap across tile edges.
- Added pattern PNG import, export, and clear tile controls.
- Added Pattern Maker to Generator handoff, plus editing support for the Generator's current pattern.
- Pattern Maker now restores the current tile and tool settings after navigating away.
- Added Pattern Maker unit coverage and a Storybook story for the seamless tile workflow.

---

## 💾 Workspace Restore

- Generator controls now restore from browser local storage.
- Imported generator depth and pattern images can be restored locally when returning to the page.
- Pattern Maker drafts and Depth Painter controls now restore locally when returning to the page.
- Stored images are bounded before saving, with a controls-only fallback if browser storage quota is exceeded.

---

## 🚀 v0.1.0 — Initial Concept

Initial public project setup.

---

## ✅ Setup

- Added Vite, React, and TypeScript app scaffold
- Added placeholder screens for Generator, Depth Painter, and Pattern Maker
- Added GitHub Pages deployment workflow
- Added baseline folder structure for canvas, stereogram, image, and storage utilities

---

# ✅ Added

- 🌀 Browser-based auto stereogram generation
- 🎨 Monochrome depth painter
- 🧩 Repeating pattern creator
- 📥 Image import support
- 📤 Image export support
- 🔒 Local-only processing approach
- 🌐 Privacy-first design goals

---

# 🔜 Planned Next

- ⚡ Live rendering optimisations
- 📱 Better mobile support
- 🎞️ Animated stereograms
- 🌈 Procedural patterns
- 🗂️ Advanced depth editing
- 🧠 Layer support
- 🔗 Shareable presets
- 🖼️ Export improvements
