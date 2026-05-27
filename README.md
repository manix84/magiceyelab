# 👁️ MagicEyeLab

Create Magic Eye style auto stereograms directly in your browser.

✨ MagicEyeLab is a free, privacy-friendly stereogram generator that lets you create hidden-depth images from custom depth maps and repeating patterns — all locally in your browser.

🚫 No ads.  
🚫 No tracking.  
🚫 No accounts.  
🖼️ No uploads required.

---

# ✨ Features

## 🌀 Auto Stereogram Generator

Generate classic Magic Eye style hidden 3D images instantly.

- 🎛️ Adjustable stereogram depth
- 🔁 Pattern repetition controls
- ⚡ Live preview rendering
- 🧭 Depth overlay preview
- 💾 Restores generator controls and imported images from local browser storage
- 💾 Export generated images
- 🌐 Browser-based processing

---

## 🎨 Monochrome Depth Painter

Draw your own depth map directly inside the app.

⚪ White areas appear closer.  
⚫ Black areas appear deeper into the image.

### Includes

- 🖌️ Brush tools
- 🧽 Eraser
- 🪣 Fill tool
- 📏 Adjustable brush sizes
- ↩️ Undo / redo
- 📥 Import external depth maps
- 📤 Export depth maps

Perfect for hidden scenes, text, symbols, and weird experimental depth art.

---

## 🧩 Pattern Maker

Create your own repeating stereogram texture patterns.

Instead of relying on imported images, you can draw your own seamless repeating patterns directly in the browser.

### Includes

- 🎮 Canvas-based drawing tools
- ✏️ Hard-edged Pencil mode for crisp tile work
- 🪣 Contiguous and global Fill modes with tolerance control
- 💧 Eyedropper colour picking from the tile
- 🖌️ Adjustable brush size
- 🌫️ Brush opacity, flow, hardness, spacing, and circle/square shape controls
- ⭕ Colour-aware brush, fill, and eyedropper previews on the canvas
- ♾️ Square painting tile with opposite-edge seam previews
- 🔁 Wraparound painting across tile edges and corners
- #️⃣ Optional grid overlay
- ⬚ Optional tile boundary guide
- ↩️ Stroke-based undo / redo
- ⌨️ Tool shortcuts for pencil, brush, eraser, and picker
- 🧱 Repeated preview panel showing multiple tiled copies
- 🎨 Palette controls with hex input and recent colours
- 🔗 Send the current tile to the Generator, or edit the Generator's current pattern
- 📥 Import/export pattern PNGs
- 🧹 Clear tile control
- 🎲 Seamless random pattern generation
- 💾 Restores your pattern draft and tool settings when you return
- ⚡ Live stereogram updates

---

# 🔒 Privacy First

MagicEyeLab processes everything locally in your browser whenever possible.

Your images are not uploaded to a server.

Generator settings, imported working images, Pattern Maker drafts, and drawing tool settings may be saved in your browser's local storage so the app can restore your workspace when you come back. This data stays on your device.

- 🚫 No accounts
- 🚫 No analytics
- 🚫 No tracking
- 🚫 No advertisements

---

# 🚀 Planned Features

- 🎞️ Animated stereograms
- 🥽 VR stereogram viewing
- 📱 Mobile-friendly drawing tools
- 🗂️ Layer support
- 🌈 Procedural pattern generators
- 📼 Retro 90s viewing modes

---

# 🧠 How Auto Stereograms Work

Auto stereograms repeat a horizontal pattern while subtly shifting sections based on depth information.

Your brain merges the repeated patterns together and perceives a hidden 3D image.

The depth effect is controlled using a grayscale depth map:

- ⚪ White = closer
- ⚫ Black = further away

---

# 🛠️ Tech Stack

Built with:

- TypeScript
- React
- Vite
- HTML Canvas

---

# 💻 Development

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build production version:

```bash
npm run build
```

---

# 🤝 Contributing

Pull requests, ideas, bug reports, and feature suggestions are welcome.

If you build something weird and wonderful with MagicEyeLab, definitely share it.

---

# 📄 License

MIT License

See [LICENSE](LICENSE)
