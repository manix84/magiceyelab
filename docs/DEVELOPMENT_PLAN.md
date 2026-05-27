# 🧪 MagicEyeLab Development Plan

A practical development roadmap for building MagicEyeLab: a browser-based auto stereogram maker with a custom depth painter and repeating pattern maker.

---

## 🎯 Project Goal

MagicEyeLab should let users create Magic Eye style auto stereograms entirely in the browser.

The app should support three main workflows:

1. 🎨 Paint or import a monochrome depth map
2. 🧩 Draw or import a repeating pattern
3. 👁️ Generate, preview, and export the final stereogram

Privacy should stay central: no accounts, no ads, no tracking, and no required uploads.

---

## 🧱 Core App Areas

## 1. 👁️ Stereogram Generator

### Goal

Generate a Magic Eye style auto stereogram from:

- A grayscale depth map
- A repeating pattern image
- User-controlled depth/render settings

### Requirements

- Render output to canvas
- Support live preview updates
- Allow image export
- Allow configurable depth strength
- Allow configurable eye separation / repeat width
- Support imported depth maps
- Support imported pattern images
- Support internally-created depth maps and patterns

### Nice To Have

- Preset render profiles
- Fast preview mode
- High-quality export mode
- Debug overlay showing depth/sample offsets

---

## 2. 🎨 Monochrome Depth Painter

### Goal

Allow users to paint their own grayscale depth map inside the app.

### Requirements

- Canvas-based painting
- Brush tool
- Eraser tool
- Fill tool
- Adjustable brush size
- Adjustable grayscale value
- Undo / redo
- Clear canvas
- Import image as depth map
- Export depth map as image
- Restore in-progress controls and draft state locally after navigation

### Depth Rules

- White = closer
- Black = further away
- Mid-gray = middle depth

### Nice To Have

- Shape tools
- Text tool
- Blur/smooth tool
- Invert depth
- Posterise depth levels
- Layer support
- Symmetry drawing mode

---

## 3. 🧩 Pattern Maker

### Goal

Allow users to create a seamless repeating pattern directly in the browser.

### Requirements

- Canvas-based pattern drawing
- Pixel-style brush
- Hard-edged pencil tool
- Eraser
- Fill tool with contiguous/global modes and tolerance control
- Eyedropper
- Colour picker
- Palette support with hex entry and recent colours
- Adjustable brush size
- Adjustable brush opacity
- Circle/square brush shape controls
- Colour-aware brush, fill, and eyedropper previews
- Optional grid overlay
- Optional tile boundary guide
- Stroke-based undo / redo
- Keyboard shortcuts for pencil, brush, eraser, fill, eyedropper, undo, and redo
- Seamless tile preview with opposite-edge strips around the active painting tile
- Wraparound painting across tile boundaries and corners
- Repeated pattern preview that shows several tiled copies at once
- Import pattern image
- Export pattern image
- Clear pattern tile
- Send created patterns to the Generator and edit the Generator's current pattern
- Random pattern generator that creates wrapped motifs so generated tiles repeat cleanly
- Restore in-progress pattern drafts and tool settings locally after navigation

### Nice To Have

- Mirror/tile drawing mode
- Pattern presets
- Noise generator
- Stripe/dot/checker generators
- Palette randomiser
- Pixel-art zoom grid

---

## 4. 📤 Import / Export

### Import Requirements

Support importing:

- Depth maps
- Pattern images

Supported formats:

- PNG
- JPG / JPEG
- WEBP where browser-supported

### Export Requirements

Support exporting:

- Final stereogram
- Depth map
- Pattern tile

Preferred format:

- PNG

### Nice To Have

- Project save/load format
- Export all assets as ZIP
- Copy image to clipboard
- Drag-and-drop imports

---

## 🧭 Suggested Build Phases

## Phase 1 — Project Setup

### Tasks

- Create Vite + React + TypeScript project
- Add app routing/layout
- Add global styles
- Create base canvas utilities
- Add GitHub Pages deployment
- Add README, privacy policy, changelog, and license
- Add basic app shell

### Output

A running app with placeholder screens for:

- Generator
- Depth Painter
- Pattern Maker

---

## Phase 2 — Basic Stereogram Renderer

### Tasks

- Implement depth map loading
- Implement pattern loading
- Render basic auto stereogram to canvas
- Add controls for:
  - Depth strength
  - Repeat width
  - Output size
- Add PNG export

### Output

The app can generate a working stereogram from imported images.

---

## Phase 3 — Monochrome Depth Painter

### Tasks

- Add depth painting canvas
- Add brush tool
- Add eraser tool
- Add grayscale picker
- Add brush size control
- Add undo / redo
- Add clear button
- Add export depth map
- Connect painted depth map to generator

### Output

Users can paint their own hidden image and generate a stereogram from it.

---

## Phase 4 — Pattern Maker

### Tasks

- Add pattern drawing canvas
- Add colour picker
- Add palette
- Add pencil, brush, and eraser tools
- Add fill tool with contiguous/global modes and tolerance control
- Add eyedropper colour picking
- Add hex colour entry and recent colour swatches
- Add brush size controls
- Add brush opacity and shape controls
- Add colour-aware brush, fill, and eyedropper previews on the canvas
- Add optional grid overlay
- Add optional tile boundary guide
- Add undo / redo
- Add keyboard shortcuts for core tools
- Add local draft restore for controls and painted work
- Add seamless tile preview with live opposite-edge references
- Add wraparound painting for strokes that cross tile boundaries
- Add random pattern generator that draws wrapped seamless shapes
- Add pattern image import, PNG export, and clear tile controls
- Add Pattern Maker / Generator handoff
- Add export pattern
- Connect created pattern to generator

### Output

Users can create the repeating texture used by the stereogram.

---

## Phase 5 — UX Polish

### Tasks

- Add onboarding hints
- Add example projects
- Add empty states
- Add loading/render states
- Add mobile-friendly layout
- Add keyboard shortcuts
- Add better export controls
- Add error handling for invalid imports

### Output

The app feels usable, friendly, and understandable for first-time users.

---

## Phase 6 — Advanced Creative Tools

### Possible Features

- Text-to-depth tool
- Shape tools
- Blur/smooth depth tool
- Invert depth
- Depth posterisation
- Procedural pattern generators
- Pattern presets
- Layer support
- Animated stereograms
- Project save/load
- ZIP export

---

## 🗂️ Suggested Folder Structure

```text
src/
  components/
    layout/
    controls/
    canvas/
  features/
    generator/
    depth-painter/
    pattern-maker/
    import-export/
  hooks/
  lib/
    canvas/
    stereogram/
    image/
    storage/
  styles/
  types/
  App.tsx
  main.tsx

docs/
  DEVELOPMENT_PLAN.md
```

---

## 🧠 Suggested Data Model

```ts
export type DepthMapSource =
  | { type: "painted"; canvas: HTMLCanvasElement }
  | { type: "imported"; image: HTMLImageElement };

export type PatternSource =
  | { type: "drawn"; canvas: HTMLCanvasElement }
  | { type: "imported"; image: HTMLImageElement }
  | { type: "generated"; canvas: HTMLCanvasElement };

export type StereogramSettings = {
  width: number;
  height: number;
  depthStrength: number;
  repeatWidth: number;
  invertDepth: boolean;
};
```

---

## ✅ MVP Checklist

The first usable version should include:

- [ ] Import depth map
- [ ] Import pattern image
- [ ] Generate stereogram
- [ ] Export stereogram as PNG
- [ ] Paint monochrome depth map
- [ ] Export depth map
- [ ] Draw repeating pattern
- [ ] Export pattern
- [ ] Live preview updates
- [ ] Privacy-friendly local processing

---

## 🔒 Privacy Principles

MagicEyeLab should avoid:

- Analytics
- Ad scripts
- User accounts
- Server-side image processing
- Required uploads
- Third-party tracking

Any future feature that stores, syncs, or shares user content should be opt-in and clearly explained.

---

## 🧪 Testing Ideas

### Manual Testing

- Import a black-to-white gradient depth map
- Import a simple repeating pattern
- Paint basic shapes
- Generate a stereogram
- Export and re-open generated images
- Test mobile/touch input
- Test large image handling
- Test browser compatibility

### Useful Test Assets

- Simple circle depth map
- Text depth map
- Checker pattern
- Noise pattern
- Stripe pattern
- High-contrast pixel pattern

---

## 🚀 Release Milestones

## v0.1.0 — First Working Generator

- Import depth map
- Import pattern
- Generate stereogram
- Export PNG

## v0.2.0 — Depth Painter

- Paint depth maps
- Brush/eraser tools
- Undo/redo
- Export depth map

## v0.3.0 — Pattern Maker

- Draw repeating patterns
- Palette tools
- Seamless preview
- Random pattern generator

## v0.4.0 — Polish Pass

- Better layout
- Better mobile support
- Help/onboarding
- Example assets

## v1.0.0 — Public Release

- Full local workflow
- Stable generator
- Depth painter
- Pattern maker
- Import/export
- Privacy docs
- GitHub Pages deployment

---

## 🧭 Guiding Principle

MagicEyeLab should feel like a creative toy first and a technical tool second.

The best version is simple enough for someone to play with immediately, but flexible enough for weird experiments.
